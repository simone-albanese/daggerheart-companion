/**
 * The reconciliation report shown after an import.
 *
 * Two books, two typesetters, one join key: the slug. Most entities line up
 * exactly, and the ones that do not are the whole reason this screen exists -
 * `Monett's Cloak` against `Monetts Cloak`, `Arcana-Touched` against `Arcana
 * Touched`. Guessing at those is how a card silently acquires the wrong
 * illustration, so a near miss is *proposed* and waits for the user, while an
 * exact slug match is taken automatically.
 *
 * Nothing here is destructive. An entity the manual has and the SRD does not
 * is kept as new content; an entity only the SRD has is left exactly as it
 * was. The layer resolver merges field by field, so a manual entry that
 * matched contributes its art and its flavour text without erasing a single
 * SRD value.
 *
 * Pure on purpose: no database, no pdf.js, no DOM. The report is a value the
 * UI renders and the user edits, and it is the only part of the importer that
 * can be tested exhaustively.
 */
import { slugify } from '../../shared/slugify.ts';

/** The minimum an entity must expose to be reconciled. */
export interface Entry {
  id: string;
  name: string;
}

/** A section the importer could not read, reported rather than swallowed. */
export interface UnreadSection {
  /** Running head as printed in the book, e.g. `Chapter 4: Tier 1 Adversaries`. */
  section: string;
  /** The collection it would have contributed to. */
  kind: string;
  reason: string;
}

/**
 * A decision the user made on a previous pass. `baseId: null` means "these are
 * genuinely different things" and stops the pair being suggested again.
 */
export interface Pairing {
  importedId: string;
  baseId: string | null;
}

export interface Match {
  imported: Entry;
  base: Entry;
  how: 'slug' | 'manual';
}

export interface Suggestion {
  imported: Entry;
  base: Entry;
  /** 0-1. Only pairs at or above `SUGGEST_MIN` are ever offered. */
  score: number;
  why: string;
}

export interface KindReport {
  kind: string;
  matched: Match[];
  /** In the manual, not in the SRD. Kept as new content. */
  manualOnly: Entry[];
  /** In the SRD, not in the manual. Left untouched. */
  srdOnly: Entry[];
  /** Near misses. The user confirms or rejects each one. */
  suggestions: Suggestion[];
}

export interface ReconcileInput {
  /** The SRD side, by collection name. */
  base: Readonly<Record<string, readonly Entry[]>>;
  /** What this import produced, by collection name. */
  imported: Readonly<Record<string, readonly Entry[]>>;
  unread?: readonly UnreadSection[];
  pairings?: readonly Pairing[];
}

export interface ReconcileReport {
  kinds: KindReport[];
  totals: {
    matched: number;
    manualOnly: number;
    srdOnly: number;
    suggested: number;
  };
  unread: UnreadSection[];
  /** True when the import matched nothing and added nothing. */
  empty: boolean;
}

/** Below this a pair is not worth a user's attention; it is noise. */
export const SUGGEST_MIN = 0.62;

/**
 * Tokens that carry no identity. `The Witherwild` and `Witherwild` are the
 * same frame; `Bone` and `Blade` are not the same domain, so nothing that
 * distinguishes two real entries may go in here.
 */
const NOISE = new Set(['the', 'a', 'an', 'of']);

const tokens = (slug: string): string[] => slug.split('-').filter((t) => t && !NOISE.has(t));

/** Levenshtein distance, iterative with one row. Slugs are short. */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

interface Scored {
  score: number;
  why: string;
}

/**
 * How likely two entries are the same thing.
 *
 * The three signals are ordered by how much they prove. Identical word sets
 * means only the punctuation or the word order moved, which is exactly the
 * apostrophe and hyphen damage this exists to catch. Containment covers a
 * subtitle appearing on one side only. Edit distance is the last resort and
 * scores lowest, because it is the one that can pair two genuinely different
 * short names.
 */
export function similarity(a: Entry, b: Entry): Scored {
  const sa = slugify(a.name) || a.id;
  const sb = slugify(b.name) || b.id;
  if (sa === sb) return { score: 1, why: 'same slug' };

  const ta = tokens(sa);
  const tb = tokens(sb);
  const setA = new Set(ta);
  const setB = new Set(tb);
  if (setA.size > 0 && setA.size === setB.size && [...setA].every((t) => setB.has(t))) {
    return { score: 0.95, why: 'same words, different punctuation' };
  }

  const [shortSlug, longSlug] = sa.length <= sb.length ? [sa, sb] : [sb, sa];
  if (shortSlug.length >= 4 && longSlug.includes(shortSlug)) {
    return { score: 0.8, why: 'one name contains the other' };
  }

  const shared = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const overlap = union === 0 ? 0 : shared / union;

  const longest = Math.max(sa.length, sb.length);
  const edit = longest === 0 ? 0 : 1 - distance(sa, sb) / longest;

  // Weighted towards shared words: `rune-ward` and `rune-word` differ by one
  // character but are different cards, while `wall-walk` / `the-wall-walk`
  // differ by four and are not.
  const score = Math.max(edit * 0.75, overlap * 0.9);
  return { score, why: `${Math.round(overlap * 100)}% shared words, ${Math.round(edit * 100)}% alike` };
}

function reconcileKind(
  kind: string,
  base: readonly Entry[],
  imported: readonly Entry[],
  pairings: Map<string, string | null>,
): KindReport {
  const baseById = new Map(base.map((e) => [e.id, e]));
  const usedBase = new Set<string>();
  const matched: Match[] = [];
  const pending: Entry[] = [];

  for (const entry of imported) {
    const decided = pairings.get(entry.id);
    if (decided !== undefined) {
      const target = decided === null ? undefined : baseById.get(decided);
      if (target) {
        matched.push({ imported: entry, base: target, how: 'manual' });
        usedBase.add(target.id);
      } else {
        // Either rejected outright, or paired with something that has since
        // gone. Both mean: keep it separate, do not suggest it again.
        pending.push(entry);
      }
      continue;
    }
    const exact = baseById.get(entry.id);
    if (exact && !usedBase.has(exact.id)) {
      matched.push({ imported: entry, base: exact, how: 'slug' });
      usedBase.add(exact.id);
      continue;
    }
    pending.push(entry);
  }

  const leftoverBase = base.filter((e) => !usedBase.has(e.id));

  // Score every remaining cross pair, then assign greedily from the best down,
  // so one strong candidate cannot be stolen by a weaker pair listed earlier.
  const candidates: Suggestion[] = [];
  for (const entry of pending) {
    if (pairings.has(entry.id)) continue; // explicitly rejected
    for (const other of leftoverBase) {
      const { score, why } = similarity(entry, other);
      if (score >= SUGGEST_MIN) candidates.push({ imported: entry, base: other, score, why });
    }
  }
  candidates.sort(
    (x, y) => y.score - x.score || x.imported.id.localeCompare(y.imported.id),
  );

  const suggestions: Suggestion[] = [];
  const claimedImported = new Set<string>();
  const claimedBase = new Set<string>();
  for (const c of candidates) {
    if (claimedImported.has(c.imported.id) || claimedBase.has(c.base.id)) continue;
    claimedImported.add(c.imported.id);
    claimedBase.add(c.base.id);
    suggestions.push(c);
  }

  return {
    kind,
    matched,
    manualOnly: pending.filter((e) => !claimedImported.has(e.id)),
    srdOnly: leftoverBase.filter((e) => !claimedBase.has(e.id)),
    suggestions,
  };
}

/** Compare an import against the SRD, collection by collection. */
export function reconcile(input: ReconcileInput): ReconcileReport {
  const pairings = new Map<string, string | null>(
    (input.pairings ?? []).map((p) => [p.importedId, p.baseId]),
  );

  const names = [...new Set([...Object.keys(input.base), ...Object.keys(input.imported)])].sort();
  const kinds = names
    .map((kind) =>
      reconcileKind(kind, input.base[kind] ?? [], input.imported[kind] ?? [], pairings),
    )
    // A collection the import never touched would otherwise fill the report
    // with "189 SRD-only cards", which reads like a failure and is not one.
    .filter((k) => (input.imported[k.kind] ?? []).length > 0);

  const totals = kinds.reduce(
    (acc, k) => ({
      matched: acc.matched + k.matched.length,
      manualOnly: acc.manualOnly + k.manualOnly.length,
      srdOnly: acc.srdOnly + k.srdOnly.length,
      suggested: acc.suggested + k.suggestions.length,
    }),
    { matched: 0, manualOnly: 0, srdOnly: 0, suggested: 0 },
  );

  return {
    kinds,
    totals,
    unread: [...(input.unread ?? [])],
    empty: totals.matched === 0 && totals.manualOnly === 0 && totals.suggested === 0,
  };
}

/**
 * Rewrite imported ids onto the SRD ids they matched, so the overlays land on
 * the right entity. Unmatched entries keep their own id and become new
 * content; suggestions are deliberately *not* applied - they are not decisions
 * yet.
 */
export function rekey<T extends Entry>(entries: readonly T[], report: KindReport): T[] {
  const byImported = new Map(report.matched.map((m) => [m.imported.id, m.base.id]));
  return entries.map((e) => {
    const target = byImported.get(e.id);
    return target && target !== e.id ? { ...e, id: target } : e;
  });
}

/**
 * Collections the manual produced that there is nothing to check against.
 *
 * Both guards in this file compare the two books: the count gate needs the
 * SRD's count, and `contributedFields` needs the SRD's own values to refuse
 * anything shorter. A collection the caller did not supply has neither, so it
 * would pass both without being examined and land on the SRD unexamined - the
 * one outcome worse than not importing it. It happened: the app sent ten of
 * the thirteen collections, and `domains`, the only section this printing
 * actually parses, was one of the three it left out.
 *
 * Returned rather than thrown: the rest of the import is still worth having,
 * and the reconciliation report is where a user can see what was left behind.
 */
export function uncheckable(
  imported: Readonly<Record<string, unknown>>,
  base: Readonly<Record<string, unknown>>,
): string[] {
  return Object.keys(imported).filter((kind) => base[kind] === undefined);
}

/**
 * What one imported entity is allowed to contribute to the layer.
 *
 * The manual adds; it never subtracts. That is the rule the layer model is
 * built on, and it has to be enforced here rather than trusted to the parsers,
 * because a parser can read a section *almost* right and nothing downstream
 * would notice. It does exactly that today: on the 2025-09-06 printing the
 * domain descriptions come back one sentence shorter than the SRD's, and
 * without this the richer text would be overwritten by the thinner one - a
 * loss no error message would ever mention.
 *
 * So a value shorter than what the SRD already holds for the same field is
 * dropped and the SRD keeps it. Anything the SRD does not have at all -
 * flavour text, a page number, art - is contributed unconditionally, which is
 * the entire point of importing the book.
 */
export function contributedFields(
  entity: object,
  base: object | undefined,
): Record<string, unknown> {
  const held = (base ?? {}) as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    if (key === 'id' || key === 'provenance') continue;
    if (value === undefined || value === null) continue;

    // An empty value is not a contribution, and where the SRD has nothing to
    // compare against it would sneak past the length test below and leave the
    // field defined-but-empty - which reads downstream as "the manual says
    // this is blank" rather than "the manual never said".
    if (typeof value === 'string' && value.trim().length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    const existing = held[key];
    if (typeof value === 'string' && typeof existing === 'string' && value.length < existing.length) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(existing) && value.length < existing.length) continue;

    fields[key] = value;
  }
  return fields;
}
