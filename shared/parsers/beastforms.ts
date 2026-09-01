/**
 * Druid Beastform options.
 *
 * A plain two-column list of stat cards under `TIER n` banners. Two of the
 * cards are not creatures but upgrade templates ("Evolved: pick a Tier 1
 * option and become a larger version of it"); they carry no trait, Evasion,
 * attack or advantage line and cannot be expressed as a `Beastform`. They are
 * recognised by their `(Upgraded ...)` subtitle and skipped - any *other* card
 * missing its stat line is a parse failure, not a silent drop.
 *
 * ## Where the section is, and why it is not a contents entry
 *
 * This used to carry `FOLIO_FROM = 12` / `FOLIO_TO = 15`, which is right for
 * SRD 1.0 and wrong for SRD 2.0, where the same material is printed on folios
 * 15-18. Every other parser in this directory now takes its range from the
 * book's own contents page - but BEASTFORM OPTIONS has no contents entry in
 * either book. It is printed inside the Druid, which is printed inside
 * `Classes`, and the index stops at the chapter.
 *
 * So the range comes from an anchor measured on the page instead: the display
 * banner the book prints above the first card, `BEASTFORM OPTIONS`, set in
 * EvelethCleanRegular at 12pt in both books. The contents page still says where
 * to look for it - the `Classes` chapter, folios 8-27 in SRD 1.0 and 8-32 in
 * SRD 2.0 - so a banner of the same words somewhere else in the book cannot be
 * mistaken for this one.
 *
 * ## Both ends, and why the far one is typographic
 *
 * The section ends where the next class begins, and which class that is is not
 * a fact about beastforms: SRD 1.0 follows the Druid with GUARDIAN because it
 * has nine classes, SRD 2.0 follows it with GUARDIAN because ASSASSIN and
 * BRAWLER were inserted before it and JUGGERNAUT after. Naming the successor
 * would be reading the class list, in a file that parses none of it. What both
 * books do state, in type, is that a display banner which is not a `TIER n`
 * heading is somebody else's - so that is the cut, and its absence is an error
 * rather than a licence to read the rest of the chapter as beastforms.
 *
 * Resolved on the books this was measured against: folios 12-15 on SRD 1.0
 * (the range the two constants used to hardcode) and 15-18 on SRD 2.0.
 */
import type { BookPage, Line, TextRun } from '../textLayout.ts';
import { slugify } from '../slugify.ts';
import {
  RANGES,
  TRAITS,
  TRAIT_LABELS,
  type Beastform,
  type Feature,
  type Range,
  type Trait,
} from '../types.ts';
import {
  isBoldSans,
  isDisplay,
  joinWithBullets,
  linesWithFolio,
  normalizeText,
  titleCase,
  ParseError,
} from './util.ts';
import { parseContents, sectionRange } from './contents.ts';

/** The chapter the section is printed inside; the contents page knows this one. */
const CHAPTER = 'Classes';

/** The banner the book prints above the first card. Identical in both books. */
const SECTION_BANNER = 'BEASTFORM OPTIONS';

const TIER_BANNER = /^TIER ([1-4])$/;
const ENTRY_TITLE = /^[A-Z][A-Z’'\- ]+$/;
const SUBTITLE = /^\((.+)\)$/;
const UPGRADE_TEMPLATE = /^\(Upgraded\b/i;
const TRAIT_EVASION = /^([A-Za-z]+)\s*\+(\d+)\s*\|\s*Evasion\s*\+(\d+)$/;
const ATTACK = /^(.+?)\s+(\d*d\d+(?:[+-]\d+)?)\s+(phy|mag)$/;
const ADVANTAGE = /^Gain advantage on:\s*(.*)$/;

const TRAIT_BY_LABEL = new Map<string, Trait>(
  TRAITS.map((t) => [TRAIT_LABELS[t].toLowerCase(), t]),
);

type SrcLine = Line & { folio: number };

const isEntryTitle = (l: Line): boolean =>
  isBoldSans(l) && l.size > 10.5 && ENTRY_TITLE.test(l.text);

/** A feature opens with its name set in bold italic and closed by a colon. */
function featureName(l: Line): string | null {
  const lead: TextRun[] = [];
  for (const r of l.runs) {
    if (!(r.bold && r.italic)) break;
    lead.push(r);
  }
  if (lead.length === 0 || !lead[lead.length - 1]!.text.endsWith(':')) return null;
  const colon = l.text.indexOf(':');
  return colon > 0 ? l.text.slice(0, colon) : null;
}

function parseTraitBonus(text: string): { trait: Trait; bonus: number; evasion: number } {
  const m = TRAIT_EVASION.exec(text);
  if (!m) throw new ParseError('beastform trait/Evasion line not understood', text);
  const trait = TRAIT_BY_LABEL.get(m[1]!.toLowerCase());
  if (!trait) throw new ParseError(`unknown beastform trait "${m[1]}"`, text);
  return { trait, bonus: Number(m[2]), evasion: Number(m[3]) };
}

/** `Melee Agility d4 phy` - but Mythic Hybrid prints `Strength Melee d12+10 phy`. */
function parseAttack(text: string): { range: Range; trait: Trait; damage: string } {
  const m = ATTACK.exec(text);
  if (!m) throw new ParseError('beastform attack line not understood', text);
  if (m[3] !== 'phy') {
    throw new ParseError('magic beastform attack has nowhere to go in Beastform', text);
  }
  const words = m[1]!.split(/\s+/);
  const at = words.findIndex((w) => TRAIT_BY_LABEL.has(w.toLowerCase()));
  if (at < 0) throw new ParseError('no trait in beastform attack line', text);
  const range = [...words.slice(0, at), ...words.slice(at + 1)].join(' ');
  if (!(RANGES as readonly string[]).includes(range)) {
    throw new ParseError(`unknown beastform attack range "${range}"`, text);
  }
  return { range: range as Range, trait: TRAIT_BY_LABEL.get(words[at]!.toLowerCase())!, damage: m[2]! };
}

function parseFeatures(lines: SrcLine[]): Feature[] {
  const out: Feature[] = [];
  let name: string | null = null;
  let buffer: string[] = [];
  const flush = (): void => {
    if (name !== null) out.push({ name, text: joinWithBullets(buffer) });
    buffer = [];
  };
  for (const l of lines) {
    const fn = featureName(l);
    if (fn !== null) {
      flush();
      name = fn;
      buffer = [l.text.slice(fn.length + 1).trim()];
    } else {
      buffer.push(l.text);
    }
  }
  flush();
  return out;
}

function parseEntry(block: SrcLine[], tier: number): Beastform | null {
  const head = block[0]!;
  const name = titleCase(normalizeText(head.text));
  const body = block.slice(1).map((l) => ({ ...l, text: normalizeText(l.text) }));

  const subtitle = SUBTITLE.exec(body[0]?.text ?? '');
  if (!subtitle) {
    throw new ParseError(`beastform "${name}" has no examples line`, body[0]?.text ?? '(end)');
  }

  const statAt = body.findIndex((l) => TRAIT_EVASION.test(l.text));
  if (UPGRADE_TEMPLATE.test(body[0]!.text)) {
    if (statAt >= 0) {
      throw new ParseError(`upgrade template "${name}" unexpectedly has stats`, body[statAt]!.text);
    }
    return null;
  }
  if (statAt < 0) {
    throw new ParseError(`beastform "${name}" has no trait/Evasion line`, body[1]?.text ?? '(end)');
  }

  // Two stat lines in one block means the second card's title was not
  // recognised and its whole entry is about to be swallowed as feature text.
  const second = body.slice(statAt + 1).find((l) => TRAIT_EVASION.test(l.text));
  if (second) {
    throw new ParseError(`beastform "${name}" absorbed a second stat line`, second.text);
  }

  const stat = parseTraitBonus(body[statAt]!.text);
  const attack = parseAttack(body[statAt + 1]?.text ?? '(end)');

  const firstFeature = body.findIndex((l) => featureName(l) !== null);
  if (firstFeature < 0) throw new ParseError(`beastform "${name}" has no features`, name);

  // The hybrids print no advantage line at all; anything else between the
  // attack and the first feature would be content we are about to lose.
  const advantageOn: string[] = [];
  for (const l of body.slice(statAt + 2, firstFeature)) {
    const m = ADVANTAGE.exec(l.text);
    if (!m) throw new ParseError(`unexpected line in beastform "${name}"`, l.text);
    advantageOn.push(...m[1]!.split(/\s*,\s*/).filter((s) => s.length > 0));
  }

  return {
    id: slugify(name),
    name,
    tier,
    category: name,
    examples: subtitle[1]!
      .split(/\s*,\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^etc\.?$/i.test(s)),
    traitBonus: { [stat.trait]: stat.bonus },
    evasionBonus: stat.evasion,
    attack: { name, range: attack.range, damage: attack.damage, trait: attack.trait },
    advantageOn,
    features: parseFeatures(body.slice(firstFeature)),
    sourcePage: head.folio,
  };
}

/**
 * The cards, cut at both ends by the banners the book prints around them.
 *
 * `from`/`to` are the folios the section resolves to on this book, which is
 * what the two constants used to state; they are returned so a caller can
 * report the range it actually read rather than the one it assumed.
 */
export function beastformSection(
  pages: BookPage[],
): { lines: SrcLine[]; from: number; to: number } {
  const chapter = sectionRange(parseContents(pages), CHAPTER);
  const stream = linesWithFolio(pages, chapter.from, chapter.to);

  const banner = stream.findIndex(
    (l) => isDisplay(l) && normalizeText(l.text) === SECTION_BANNER,
  );
  if (banner < 0) {
    throw new ParseError(
      `no "${SECTION_BANNER}" banner in the ${CHAPTER} chapter`,
      `folios ${chapter.from}-${chapter.to}`,
    );
  }

  const start = stream.findIndex(
    (l, i) => i > banner && isDisplay(l) && TIER_BANNER.test(l.text),
  );
  if (start < 0) {
    throw new ParseError(
      'no TIER banner in the Beastform section',
      stream.slice(banner, banner + 4).map((l) => l.text).join(' / '),
    );
  }
  /*
   * Only the section's own prose stands between the two banners. A display
   * banner in that gap is a sub-section this does not know about, and skipping
   * silently to the first TIER is how its cards would go missing.
   */
  const intruder = stream.slice(banner + 1, start).find((l) => isDisplay(l));
  if (intruder !== undefined) {
    throw new ParseError(
      `unexpected banner between "${SECTION_BANNER}" and its first tier`,
      intruder.text,
    );
  }

  // The section runs until the next display banner that is not a tier heading.
  let end = -1;
  for (let i = start + 1; i < stream.length; i++) {
    if (isDisplay(stream[i]!) && !TIER_BANNER.test(stream[i]!.text)) {
      end = i;
      break;
    }
  }
  if (end < 0) {
    throw new ParseError(
      'the Beastform section has no closing banner',
      `it would run to the end of ${CHAPTER} (folio ${chapter.to})`,
    );
  }

  const lines = stream.slice(start, end);
  return { lines, from: stream[banner]!.folio, to: lines[lines.length - 1]!.folio };
}

export function parseBeastforms(pages: BookPage[]): Beastform[] {
  const { lines: section } = beastformSection(pages);

  const out: Beastform[] = [];
  let tier = 0;
  let block: SrcLine[] | null = null;
  const finish = (): void => {
    if (block === null) return;
    const parsed = parseEntry(block, tier);
    if (parsed) out.push(parsed);
    block = null;
  };
  for (const l of section) {
    const banner = TIER_BANNER.exec(l.text);
    if (isDisplay(l) && banner) {
      finish();
      tier = Number(banner[1]);
      continue;
    }
    if (isEntryTitle(l)) {
      finish();
      block = [l];
      continue;
    }
    // Nothing sits between a tier banner and the first card; a line here means
    // a card title went unrecognised and that card would vanish unnoticed.
    if (block === null) throw new ParseError('beastform line outside any card', l.text);
    block.push(l);
  }
  finish();

  const seen = new Set<string>();
  for (const b of out) {
    if (seen.has(b.id)) throw new ParseError(`duplicate beastform id "${b.id}"`, b.name);
    seen.add(b.id);
  }
  return out;
}
