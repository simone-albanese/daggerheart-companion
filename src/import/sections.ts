/**
 * Finding the book's sections, and running the SRD parsers over them.
 *
 * THE PROBLEM
 * -----------
 * Every parser in `shared/parsers/` selects its material by SRD folio -
 * `parseAdversaries` reads folios 75 to 101 and nothing else. Those numbers
 * are meaningless in a 397-page book whose adversaries start on folio 210. But
 * the parsers are the tested, reviewed reading of Daggerheart's own layout
 * conventions, and re-implementing them for a second book is exactly the
 * duplication that would let the two readings drift apart.
 *
 * So the section is found, not assumed: the Core Rulebook prints a running
 * head on every page (`Chapter 4: Tier 1 Adversaries`, `Appendix: Domain Card
 * Reference`), which survives a revision that moves pages around. The pages of
 * a section are then presented to the parser renumbered into the folio window
 * it expects.
 *
 * WHY EVERY RESULT IS GATED
 * -------------------------
 * The two books are not the same typesetting. Measure, banners and table
 * geometry differ, and a parser tuned to the SRD can read a Core Rulebook
 * section *partly* - four communities out of nine, a stat block missing its
 * last feature. A partial read is worse than no read: it is a wrong rule at
 * the table that nobody can reproduce. So a section's output is accepted only
 * if it produces at least as many entities as the SRD already has, the manual
 * being a superset of the SRD by construction. Anything short is reported as
 * unread, and the SRD keeps the field.
 *
 * At the time of writing, on the 2025-09-06 printing, most sections do not
 * clear that bar. That is the honest state of affairs and the report says so;
 * the art, which is what the manual is really being imported for, does not
 * depend on any of this.
 */
import { layoutPages, type BookPage, type TextRun } from '../../shared/textLayout.ts';
import { parseAdversaries } from '../../shared/parsers/adversaries.ts';
import { parseAncestries } from '../../shared/parsers/ancestries.ts';
import { parseBeastforms } from '../../shared/parsers/beastforms.ts';
import { parseClasses } from '../../shared/parsers/classes.ts';
import { parseCommunities } from '../../shared/parsers/communities.ts';
import { parseDomainCards, parseDomains } from '../../shared/parsers/domainCards.ts';
import { parseEnvironments } from '../../shared/parsers/environments.ts';
import { parseArmors, parseWeapons } from '../../shared/parsers/equipment.ts';
import { parseConsumables, parseLoot } from '../../shared/parsers/loot.ts';
import type { RawPage } from './pdfRuns.ts';
import type { Entry, UnreadSection } from './reconcile.ts';

/** A run of pages under one running head. */
export interface Section {
  head: string;
  fromFolio: number;
  toFolio: number;
  pages: number;
}

/** Bottom band of the page, where the folio and the running head are set. */
const FOOT_FRAC = 0.955;
/** Vertical tolerance for "same line" inside the running foot. */
const FOOT_LINE_TOL = 4;

/**
 * The heads worth recognising. Anchored at the start so a cross-reference in
 * body text that happens to fall in the foot band cannot invent a section.
 */
const HEAD_RE = /^(Introduction|Chapter\s+\d+\s*:\s*.+?|Appendix\s*:\s*.+?)$/;

/** Read the running head off one raw page, if it has one. */
export function runningHead(page: RawPage): string | null {
  const band = page.runs.filter((r) => r.y >= page.height * FOOT_FRAC);
  if (band.length === 0) return null;

  const lines = new Map<number, TextRun[]>();
  for (const run of band) {
    const key = [...lines.keys()].find((k) => Math.abs(k - run.y) <= FOOT_LINE_TOL);
    if (key === undefined) lines.set(run.y, [run]);
    else lines.get(key)!.push(run);
  }

  for (const runs of lines.values()) {
    const text = runs
      .sort((a, b) => a.x - b.x)
      .map((r) => r.text.trim())
      .join(' ')
      // The folio sits on the same line as the head, at the outer margin.
      .replace(/(^\s*\d{1,3}\s+|\s+\d{1,3}\s*$)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const m = HEAD_RE.exec(text);
    if (m) return m[1]!.replace(/\s*:\s*/, ': ');
  }
  return null;
}

/**
 * Most common value, with ties going to `fallback`.
 *
 * The values here are folio-to-page offsets, and averaging two of those is
 * meaningless - halfway between "this page is folio 166" and "this page is
 * folio 3" is not a page in the book. A vote is the only sensible summary.
 */
function mode(values: readonly number[], fallback: number): number {
  const tally = new Map<number, number>();
  for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
  let best = fallback;
  let bestVotes = 0;
  for (const [value, votes] of tally) {
    if (votes > bestVotes || (votes === bestVotes && value === fallback)) {
      best = value;
      bestVotes = votes;
    }
  }
  return bestVotes > 0 ? best : fallback;
}

/**
 * Group the book into sections by running head.
 *
 * A section is a folio range, not a page list, because a folio is what the
 * parsers filter on and what survives a page being added ahead of it. It is
 * not a way of keeping unnumbered pages: `renumber` drops anything without a
 * folio, so a chapter opener or a full-bleed illustration inside a section is
 * never shown to a parser. On this printing that costs nothing - the pages it
 * loses carry no text at all - but it is the code's behaviour and not an
 * oversight to be tidied away later.
 *
 * The range is built from the *offset* between folio and PDF page rather than
 * from the folios directly, because the odd page mis-reads its own. Where the
 * running head is set as several runs - `Chapter`, `3`, `: Running GM NPCs` -
 * the layout's folio detector finds a bare `3` sitting in the running foot and
 * believes it, and one such page would drag a section back a hundred and fifty
 * folios. Offsets are agreed by vote, first inside the section and then across
 * the whole book, so a page that mis-reads its own number is outvoted.
 */
export function findSections(raw: readonly RawPage[], pages: readonly BookPage[]): Section[] {
  const headByPdfPage = new Map<number, string>();
  for (const page of raw) {
    const head = runningHead(page);
    if (head) headByPdfPage.set(page.number, head);
  }

  const numbered = pages.filter((p) => p.folio !== null);
  const bookOffset = mode(
    numbered.map((p) => p.folio! - p.pdfPage),
    0,
  );

  const grouped = new Map<string, Array<{ pdfPage: number; folio: number }>>();
  for (const page of numbered) {
    const head = headByPdfPage.get(page.pdfPage);
    if (!head) continue;
    const list = grouped.get(head) ?? [];
    list.push({ pdfPage: page.pdfPage, folio: page.folio! });
    grouped.set(head, list);
  }

  const sections: Section[] = [];
  for (const [head, entries] of grouped) {
    const run = longestRun(entries.sort((a, b) => a.pdfPage - b.pdfPage));
    const offset = mode(
      run.map((e) => e.folio - e.pdfPage),
      bookOffset,
    );
    sections.push({
      head,
      fromFolio: run[0]!.pdfPage + offset,
      toFolio: run[run.length - 1]!.pdfPage + offset,
      pages: run.length,
    });
  }
  return sections.sort((a, b) => a.fromFolio - b.fromFolio);
}

/**
 * The longest unbroken stretch of pages carrying the head.
 *
 * A running head runs, so a section is contiguous. Text that only *looks* like
 * one is not: `Chapter 3: Running GM NPCs` also appears as a cross-reference in
 * body text a hundred pages earlier, and taking the outer bounds of both would
 * hand a parser a hundred pages of the wrong chapter. Gaps of a few pages are
 * still one stretch, because chapter openers and full-bleed illustrations
 * carry no head at all.
 */
const HEAD_GAP = 4;

function longestRun<T extends { pdfPage: number }>(sorted: T[]): T[] {
  let best: T[] = [];
  let current: T[] = [];
  for (const entry of sorted) {
    const previous = current[current.length - 1];
    if (previous && entry.pdfPage - previous.pdfPage > HEAD_GAP) {
      if (current.length > best.length) best = current;
      current = [];
    }
    current.push(entry);
  }
  return current.length > best.length ? current : best;
}

/** Present a section's pages under the folios a parser expects to see. */
export function renumber(
  pages: readonly BookPage[],
  from: number,
  to: number,
  target: number,
): BookPage[] {
  return pages
    .filter((p) => p.folio !== null && p.folio >= from && p.folio <= to)
    .map((p) => ({ ...p, folio: p.folio! - from + target }));
}

type Parsed = Partial<Record<string, Entry[]>>;

export interface SectionPlan {
  /**
   * Running heads to match, in reading order. More than one where the SRD
   * treats as a single stretch of folios what the manual splits into separate
   * sections - the weapon tables, or the adversary roster and its stat blocks.
   */
  heads: RegExp[];
  /** Collections this section contributes to, for the count gate. */
  kinds: string[];
  /**
   * The SRD folio the section's *first* page is renumbered to.
   *
   * Almost always `srdFrom`, because a section starts where its parser starts
   * reading. Beastforms are the exception that makes the field necessary: they
   * sit four folios inside the class chapter, so the manual's chapter opener
   * has to land on the chapter's folio and not on the beastform tables' - and
   * setting it to `srdFrom` there hands the parser a window with none of the
   * section in it.
   */
  srdAnchor?: number;
  /** The SRD folio window the parser filters on. */
  srdFrom: number;
  srdTo: number;
  parse(pages: BookPage[]): Parsed;
}

/**
 * SRD folio windows are copied from the parsers themselves; changing one there
 * without changing it here shows up as a section that suddenly reads nothing,
 * not as quietly wrong content. `tests/import/sections.test.ts` asserts every
 * pair against the parser it belongs to, because three of them had drifted and
 * nothing said so: only `srdAnchor` changes what the parser is shown, so a
 * wrong `srdTo` shows up as a truncation warning that is simply untrue.
 */
export const PLANS: SectionPlan[] = [
  {
    heads: [/^Chapter \d+: Domains$/i],
    kinds: ['domains'],
    srdFrom: 7,
    srdTo: 7,
    parse: (p) => ({ domains: parseDomains(p) }),
  },
  {
    heads: [/^Appendix: Domain Card Reference$/i],
    kinds: ['domainCards'],
    srdFrom: 119,
    srdTo: 135,
    parse: (p) => ({ domainCards: parseDomainCards(p) }),
  },
  {
    heads: [/^Chapter \d+: Class$/i],
    kinds: ['classes', 'subclasses'],
    srdFrom: 8,
    srdTo: 26,
    parse: (p) => {
      const { classes, subclasses } = parseClasses(p);
      return { classes, subclasses };
    },
  },
  {
    heads: [/^Chapter \d+: Ancestry$/i],
    kinds: ['ancestries'],
    srdFrom: 27,
    srdTo: 31,
    parse: (p) => ({ ancestries: parseAncestries(p) }),
  },
  {
    heads: [/^Chapter \d+: Community$/i],
    kinds: ['communities'],
    srdFrom: 32,
    srdTo: 34,
    parse: (p) => ({ communities: parseCommunities(p) }),
  },
  {
    // Inside the class chapter, so anchored on the chapter's own first folio.
    heads: [/^Chapter \d+: Class$/i],
    kinds: ['beastforms'],
    srdAnchor: 8,
    srdFrom: 12,
    srdTo: 15,
    parse: (p) => ({ beastforms: parseBeastforms(p) }),
  },
  {
    heads: [
      /^Chapter \d+: Primary Weapon Tables$/i,
      /^Chapter \d+: Secondary Weapon Tables$/i,
    ],
    kinds: ['weapons'],
    srdFrom: 45,
    srdTo: 55,
    parse: (p) => ({ weapons: parseWeapons(p) }),
  },
  {
    heads: [/^Chapter \d+: Armor Tables$/i],
    kinds: ['armors'],
    srdFrom: 56,
    srdTo: 57,
    parse: (p) => ({ armors: parseArmors(p) }),
  },
  {
    heads: [/^Chapter \d+: Loot$/i],
    kinds: ['loot', 'consumables'],
    srdFrom: 58,
    srdTo: 62,
    parse: (p) => ({ loot: parseLoot(p), consumables: parseConsumables(p) }),
  },
  {
    heads: [
      /^Chapter \d+: Choosing Adversaries$/i,
      /^Chapter \d+: Tier [1-4] Adversaries$/i,
    ],
    kinds: ['adversaries'],
    srdFrom: 75,
    srdTo: 101,
    parse: (p) => ({ adversaries: parseAdversaries(p) }),
  },
  {
    // The 2025-09-06 printing sets this head as "Enviroment Stat Blocks".
    heads: [/^Chapter \d+: Enviro(?:n)?ment Stat Blocks$/i],
    kinds: ['environments'],
    srdFrom: 103,
    srdTo: 111,
    parse: (p) => ({ environments: parseEnvironments(p) }),
  },
];

/**
 * Sections the manual has and the SRD does not, so no parser exists for them.
 * Listed so the report can say what was left behind instead of leaving the
 * user to wonder where the campaign frames went.
 */
const NO_READER: Array<{ head: RegExp; kind: string; what: string }> = [
  { head: /^Chapter \d+: Campaign Frames$/i, kind: 'rules', what: 'campaign frames' },
];

export interface ParseOutcome {
  /** Entities per collection, only from sections that passed the gate. */
  imported: Record<string, Entry[]>;
  unread: UnreadSection[];
  sections: Section[];
}

/**
 * Run every parser that has a section to read, gating each on entity count.
 *
 * `baseCounts` is how many entities the SRD already has per collection. It is
 * the bar a section has to clear, and it is deliberately data-driven: no table
 * of expected numbers to fall out of date.
 */
export function parseSections(
  raw: RawPage[],
  baseCounts: Readonly<Record<string, number>>,
  onSection?: (head: string) => void,
): ParseOutcome {
  const pages = layoutPages(raw);
  const sections = findSections(raw, pages);
  const imported: Record<string, Entry[]> = {};
  const unread: UnreadSection[] = [];

  for (const plan of PLANS) {
    const found = plan.heads.flatMap((head) => sections.filter((s) => head.test(s.head)));
    if (found.length === 0) {
      unread.push({
        section: plan.heads.map((h) => h.source).join(', '),
        kind: plan.kinds[0]!,
        reason: 'no section with that running head in this printing',
      });
      continue;
    }

    const label = found.map((s) => s.head).join(' + ');
    const fromFolio = Math.min(...found.map((s) => s.fromFolio));
    const toFolio = Math.max(...found.map((s) => s.toFolio));
    const anchor = plan.srdAnchor ?? plan.srdFrom;
    onSection?.(label);

    // The manual usually sets a section over more pages than the SRD's window
    // holds, so the tail gets dropped. That is not fatal on its own - the
    // count gate below is what decides - but it is the likeliest reason a
    // parser came up short, so it is worth saying. Measured from the anchor,
    // because that is what fixes where the manual's pages land.
    const dropped = toFolio - fromFolio - (plan.srdTo - anchor);
    const truncation =
      dropped > 0
        ? dropped === 1
          ? ' (the last page was out of reach)'
          : ` (the last ${dropped} pages were out of reach)`
        : '';

    let produced: Parsed;
    try {
      produced = plan.parse(renumber(pages, fromFolio, toFolio, anchor));
    } catch (err) {
      unread.push({
        section: label,
        kind: plan.kinds[0]!,
        reason: (err instanceof Error ? err.message.split('\n')[0]! : String(err)) + truncation,
      });
      continue;
    }

    const short = plan.kinds.find(
      (kind) => (produced[kind]?.length ?? 0) < (baseCounts[kind] ?? 0),
    );
    if (short !== undefined) {
      unread.push({
        section: label,
        kind: short,
        reason:
          `read ${produced[short]?.length ?? 0} of the ${baseCounts[short] ?? 0} the SRD has, ` +
          `so the section was left to the SRD rather than half-replaced${truncation}`,
      });
      continue;
    }

    // Parsers stamp `sourcePage` with the folio they were handed, which is an
    // SRD folio because that is what they were shown. Put it back into the
    // manual's own numbering, or "look it up in the book" sends the reader to
    // the wrong page of a 397-page book.
    const shift = fromFolio - anchor;
    for (const kind of plan.kinds) {
      imported[kind] = (produced[kind] ?? []).map((entity) => {
        const page = (entity as { sourcePage?: unknown }).sourcePage;
        return typeof page === 'number' ? { ...entity, sourcePage: page + shift } : entity;
      });
    }
  }

  for (const gap of NO_READER) {
    const section = sections.find((s) => gap.head.test(s.head));
    if (section) {
      unread.push({
        section: section.head,
        kind: gap.kind,
        reason: `${gap.what} are only in the manual, and there is no reader for them yet`,
      });
    }
  }

  return { imported, unread, sections };
}
