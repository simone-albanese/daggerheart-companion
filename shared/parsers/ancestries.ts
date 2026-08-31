/**
 * Ancestries - SRD folios 27-31.
 *
 * Each entry is a display banner, a body description, an ANCESTRY FEATURES
 * banner, then exactly two features. Two 12pt display banners in the range are
 * not ancestries: the "ANCESTRY FEATURES" rules sub-section that opens the
 * chapter, and "MIXED ANCESTRY", which is a character-creation rule and belongs
 * to the rules parser. Both are rejected by checking every banner against the
 * roster the chapter prints in its own intro, so a nineteenth ancestry would
 * fail here rather than be silently dropped.
 */
import { WORD_JOIN_RATIO, type BookPage, type Line, type TextRun } from '../textLayout.ts';
import type { Ancestry, Feature } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBoldSans,
  isDisplay,
  joinLines,
  normalizeText,
  pagesInFolios,
  splitOn,
  titleCase,
} from './util.ts';
import { parseContents, sectionRange, sliceSection } from './contents.ts';

/*
 * The folio range comes from the book's own contents page. It used to be
 * written here, `FROM = 27` / `TO = 31`, which is right for SRD 1.0 and wrong for
 * every other printing - SRD 2.0 reflows 135 printed pages into 224.
 */
const SECTION = 'Ancestries';
/*
 * The offer sentence is not in this chapter. Both books print it in character
 * creation, on folio 4, beside the Heritage field it tells you to fill in - so
 * the roster and the manifest come from two different parts of the book, and
 * this parser reads both.
 */
const CREATION = 'CHARACTER CREATION';

/** The book states every ancestry grants two ancestry features. */
const FEATURE_COUNT = 2;

/** Display banners in this range that name something other than an ancestry. */
const NOT_ANCESTRIES = new Set(['Ancestry Features', 'Mixed Ancestry']);

/**
 * Word spaces in this book's display type measure 0.26-0.36 of the glyph
 * height; the column gutter measures 9-16. Nothing lands in between.
 */
const GUTTER_GAP_RATIO = 3;

/** A banner is indented ~3pt from the body of its own column. */
const COLUMN_X_TOL = 30;

type Sourced = Line & { folio: number };

export function parseAncestries(pages: BookPage[]): Ancestry[] {
  const range = sectionRange(parseContents(pages), SECTION);
  const lines = sourcedLines(pages);
  const roster = parseRoster(lines, sourcedIn(pages, sectionRange(parseContents(pages), CREATION)));

  const blocks = splitOn(lines, isBanner);
  const out: Ancestry[] = [];
  /*
   * A banner the roster does not name is either a mistake or a FAMILY heading,
   * and the book tells the two apart on its own: SRD 2.0's ELEMENTAL KIN has
   * prose and no ANCESTRY FEATURES block, while every ancestry has one. So the
   * absence of features is the signal, rather than a list of family names
   * written here that the next printing would silently outgrow.
   *
   * ## Where a family ENDS, which the typography does not say
   *
   * Measured: ELEMENTAL KIN, EARTHKIN and ELF are all EvelethCleanThin at 12pt
   * at the same column origin. There is no size, face or indent that separates
   * a family heading from its members or its members from what follows. A first
   * version applied the family to every ancestry after the heading and gave
   * `Elemental Kin` to Simiah.
   *
   * The signal is in the ORDER. The chapter is alphabetical, and the family is
   * the one place it is not: Dwarf, [Earthkin, Emberkin, Skykin, Tidekin], Elf.
   * The members run alphabetically among themselves, and the break comes when
   * the chapter's own sequence resumes - `Elf` sorts before `Tidekin`. So the
   * family claims the ascending run that follows it and stops at the first name
   * that sorts below the one before it.
   *
   * That is inference, so it is CHECKED rather than trusted: a family that
   * claims nothing is an error, and the assertion below makes a change in the
   * book's ordering a loud failure instead of a quiet mis-grouping.
   */
  let family: string | undefined;
  let previousInFamily: string | undefined;
  let claimed = 0;
  for (const block of blocks) {
    const name = titleCase(normalizeText(block[0]!.text));
    if (NOT_ANCESTRIES.has(name)) continue;
    if (!roster.all.has(name)) {
      const hasFeatures = block.some((l) => /^ANCESTRY FEATURES$/i.test(normalizeText(l.text)));
      if (hasFeatures) {
        throw new ParseError('display banner is neither a listed ancestry nor a known rule', name);
      }
      if (family !== undefined && claimed === 0) {
        throw new ParseError('family heading claims no ancestries', family);
      }
      family = name;
      previousInFamily = undefined;
      claimed = 0;
      continue;
    }
    if (family !== undefined && previousInFamily !== undefined && name < previousInFamily) {
      // The chapter's alphabetical sequence has resumed: the family is over.
      if (claimed === 0) throw new ParseError('family heading claims no ancestries', family);
      family = undefined;
      previousInFamily = undefined;
    }

    const ancestry = parseAncestry(block, name);
    if (family !== undefined) {
      ancestry.family = family;
      previousInFamily = name;
      claimed += 1;
    }
    // Only where the book fences the two. A book that does not say leaves this
    // absent, which is a different fact from saying `core`.
    if (roster.fenced) ancestry.set = roster.core.has(name) ? 'core' : 'expansion';
    out.push(ancestry);
  }
  if (family !== undefined && claimed === 0) {
    throw new ParseError('family heading claims no ancestries', family);
  }

  const seen = new Set<string>();
  for (const a of out) {
    if (seen.has(a.id)) throw new ParseError('duplicate ancestry id', a.id);
    seen.add(a.id);
  }
  const missing = [...roster.all].filter((n) => !seen.has(slugify(n)));
  if (missing.length > 0) {
    throw new ParseError('listed ancestry has no banner', missing.join(', '));
  }
  return out;
}

/** The chapter title "ANCESTRIES" is set at 17pt, the entry banners at 12pt. */
function isBanner(l: Line): boolean {
  return isDisplay(l) && l.size < 15;
}

/** Every line in a folio range, banners unmerged, carrying its folio. */
function sourcedIn(pages: BookPage[], range: { from: number; to: number }): Sourced[] {
  const out: Sourced[] = [];
  for (const page of pagesInFolios(pages, range.from, range.to)) {
    for (const l of unmergeBanners(page)) out.push({ ...l, folio: page.folio! });
  }
  return out;
}

/**
 * The chapter's lines, cut at the next chapter's banner.
 *
 * The folio range overlaps the next section by a page because a chapter can end
 * on the page the next one starts - SRD 2.0 prints SIMIAH above the COMMUNITIES
 * banner on folio 38. So the last page arrives carrying both, and the banner is
 * where this chapter stops.
 */
function sourcedLines(pages: BookPage[]): Sourced[] {
  const range = sectionRange(parseContents(pages), SECTION);
  const out: Sourced[] = [];
  for (const page of pagesInFolios(pages, range.from, range.to)) {
    for (const l of unmergeBanners(page)) out.push({ ...l, folio: page.folio! });
  }
  return sliceSection(out, SECTION, range.next);
}

/**
 * When the top band of a page holds nothing but the banner of each column, the
 * XY-cut isolates that band and is then left with a single band that has no
 * gutter to cut, so both banners arrive as one line - "ELF FAUN" on folio 28,
 * "HUMAN KATARI" on folio 30. Split them on the gutter-sized gap and move each
 * fragment to the head of the column it was printed in. A no-op on every page
 * the layout got right, and it will quietly stop firing if it is ever fixed
 * upstream.
 */
function unmergeBanners(page: BookPage): Line[] {
  const out: Line[] = [];
  let queued: Array<{ line: Line; column: number }> = [];
  for (const line of page.lines) {
    for (const q of queued.filter((q) => q.column === line.column)) {
      if (Math.abs(line.x - q.line.x) > COLUMN_X_TOL) {
        throw new ParseError(
          'split banner does not line up with its column',
          `${q.line.text} @${q.line.x} vs ${line.text} @${line.x}`,
        );
      }
      out.push(q.line);
    }
    queued = queued.filter((q) => q.column !== line.column);

    if (!isBanner(line)) {
      out.push(line);
      continue;
    }
    const parts = splitAtGutter(line);
    out.push(parts[0]!);
    for (let k = 1; k < parts.length; k++) queued.push({ line: parts[k]!, column: line.column + k });
  }
  if (queued.length > 0) {
    throw new ParseError(
      'split banner has no column to belong to',
      queued.map((q) => q.line.text).join(' | '),
    );
  }
  return out;
}

function splitAtGutter(line: Line): Line[] {
  const groups: TextRun[][] = [[]];
  let prev: TextRun | null = null;
  for (const r of line.runs) {
    if (prev && (r.x - (prev.x + prev.w)) / Math.max(r.h, 1) > GUTTER_GAP_RATIO) groups.push([]);
    groups[groups.length - 1]!.push(r);
    prev = r;
  }
  if (groups.length === 1) return [line];
  return groups.map((runs, i) => {
    const x = Math.min(...runs.map((r) => r.x));
    return {
      ...line,
      text: joinRuns(runs),
      x,
      y: Math.min(...runs.map((r) => r.y)),
      w: Math.max(...runs.map((r) => r.x + r.w)) - x,
      size: Math.max(...runs.map((r) => r.size)),
      column: line.column + i,
      runs,
    };
  });
}

/** Join runs the way `assembleLines` does, so ligature-split words survive. */
function joinRuns(runs: readonly TextRun[]): string {
  let out = '';
  let prevEnd = Number.NaN;
  for (const r of runs) {
    if (out.length > 0) out += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
    out += r.text;
    prevEnd = r.x + r.w;
  }
  return normalizeText(out);
}

interface Roster {
  /** Every ancestry the chapter offers. */
  all: Set<string>;
  /** The subset the Core Set carries, when the book fences the two. */
  core: Set<string>;
  /**
   * Whether the book draws the distinction at all. Decided by comparing the two
   * lists rather than by reading the wording: SRD 2.0 says "the Daggerheart
   * Core Set includes ONLY the following" where SRD 1.0 says "the core ruleset
   * includes the following", and hanging a schema field on the word "only"
   * would be a rule one reprint could break in silence. Two lists that agree
   * are a book that does not fence; two that differ are one that does.
   */
  fenced: boolean;
}

/**
 * The chapter's two manifests, which SRD 2.0 made two.
 *
 * The roster tells banners apart from sub-section headings set in the same face
 * and size, so it has to be the FULL list or a new ancestry reads as a stray
 * heading. SRD 1.0 had one sentence and it meant both things at once:
 *
 *   "Take the card for one of the following ancestries, then write its name in
 *    the Heritage field ...: Clank, ..."           - everything on offer
 *   "The Daggerheart Core Set includes only the following ancestries: ..."
 *                                                  - what is in the box
 *
 * Measured: 18 and 18 in SRD 1.0, 24 and 18 in SRD 2.0. The six that the
 * second list drops - Aetheris, Earthkin, Emberkin, Gnome, Skykin, Tidekin -
 * are the Hope & Fear Expansion Set's.
 *
 * They also live in different parts of the book: the offer is in character
 * creation on folio 4, beside the Heritage field it tells you to write in, and
 * only the manifest is in this chapter.
 *
 * Both are matched over WHOLE sections joined into one string rather than per
 * line, because SRD 2.0 breaks a line between "following" and "ancestries:"
 * and a per-line search finds neither.
 */
function parseRoster(chapter: Sourced[], creation: Sourced[]): Roster {
  const prose = normalizeText(joinLines(chapter.map((l) => l.text)));
  const offerProse = normalizeText(joinLines(creation.map((l) => l.text)));
  const folios = chapter.map((l) => l.folio);
  const where = `folios ${Math.min(...folios)}-${Math.max(...folios)}`;

  const listOf = (m: RegExpExecArray | null): string[] =>
    m === null
      ? []
      : m[1]!
          .split(/\s*,\s*/)
          .map((n) => n.replace(/^and\s+/i, '').trim())
          .filter((n) => n.length > 0);

  const offered = listOf(
    /take the card for one of the following\s+ancestries[^:]*:\s*([^.]+)\./i.exec(offerProse),
  );
  if (offered.length === 0) {
    const cf = creation.map((l) => l.folio);
    throw new ParseError(
      'ancestry offer sentence not found in character creation',
      `folios ${Math.min(...cf)}-${Math.max(...cf)}`,
    );
  }

  const boxedRaw = listOf(
    /(?:core ruleset|Core Set) includes (?:only )?the following\s+ancestries:\s*([^.]+)\./i.exec(
      prose,
    ),
  );
  if (boxedRaw.length === 0) {
    throw new ParseError('ancestry manifest sentence not found', where);
  }
  // The manifest names Mixed Ancestry and the offer does not; it is a rule for
  // combining two ancestries, not an ancestry, and it has no banner of its own.
  const boxed = boxedRaw.filter((n) => !NOT_ANCESTRIES.has(n));
  if (boxed.length !== boxedRaw.length - 1) {
    throw new ParseError(
      'ancestry manifest does not list Mixed Ancestry exactly once',
      boxedRaw.join(', '),
    );
  }

  const all = new Set(offered.filter((n) => !NOT_ANCESTRIES.has(n)));
  const core = new Set(boxed);
  const stray = [...core].filter((n) => !all.has(n));
  if (stray.length > 0) {
    throw new ParseError('manifest names an ancestry the chapter does not offer', stray.join(', '));
  }
  return { all, core, fenced: core.size !== all.size };
}

function parseAncestry(block: Sourced[], name: string): Ancestry {
  const [banner, ...rest] = block as [Sourced, ...Sourced[]];
  // Faerie's banner reads "ANCESTRY FEATURE", singular - a typo in the SRD.
  const featureAt = rest.findIndex(
    (l) => isBoldSans(l) && /^ancestry features?$/i.test(normalizeText(l.text)),
  );
  if (featureAt < 0) throw new ParseError('ancestry has no ANCESTRY FEATURES banner', name);

  const description = normalizeText(joinLines(rest.slice(0, featureAt).map((l) => l.text)));
  if (description.length === 0) throw new ParseError('ancestry has no description', name);

  return {
    id: slugify(name),
    name,
    description,
    features: parseFeatures(rest.slice(featureAt + 1), name),
    sourcePage: banner.folio,
  };
}

function parseFeatures(lines: Sourced[], name: string): [Feature, Feature] {
  const groups = splitOn(lines, startsFeature);
  if (groups.length !== FEATURE_COUNT) {
    throw new ParseError(
      `${name}: expected ${FEATURE_COUNT} ancestry features, got ${groups.length}`,
      lines.map((l) => l.text).join(' '),
    );
  }
  const [first, second] = groups.map((g) => toFeature(g, name)) as [Feature, Feature];
  return [first, second];
}

/**
 * A feature opens with its name in bold, but bold is also used for inline
 * emphasis, which sometimes lands at the start of a continuation line ("2 Hope
 * to reroll your Hope Die."). The colon is what separates a name from emphasis.
 * It can sit mid-way through the bold lead-in, because the emphasis may run
 * straight on from the name ("**Increased Fortitude: Spend 3 Hope** to halve").
 */
function startsFeature(l: Line): boolean {
  return boldLeadIn(l).indexOf(':') > 0;
}

/** The line's leading bold runs. */
function boldLeadIn(l: Line): string {
  const lead: TextRun[] = [];
  for (const r of l.runs) {
    if (!r.bold) break;
    lead.push(r);
  }
  return joinRuns(lead);
}

function toFeature(group: Sourced[], ancestry: string): Feature {
  const text = normalizeText(joinLines(group.map((l) => l.text)));
  const colon = text.indexOf(':');
  if (colon < 1) throw new ParseError(`${ancestry}: feature has no leading "Name:"`, text);
  const body = text.slice(colon + 1).trim();
  if (body.length === 0) throw new ParseError(`${ancestry}: feature has no text`, text);
  return { name: text.slice(0, colon).trim(), text: body };
}
