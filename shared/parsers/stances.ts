/**
 * Martial Stances - SRD 2.0 folio 13. A chapter SRD 1.0 does not print, and a
 * page that sat inside a parsed range yielding nothing.
 *
 * ## What the page is, measured before this shape was chosen
 *
 * Folio 13 is one page, set in two columns, and the whole of it is this
 * chapter. Column 0 carries a `MARTIAL STANCES` chapter head and four rules
 * sections under bold-sans banners - `STANCES`, `FOCUS`, `SHIFTING INTO
 * STANCES`, `DROPPING OUT OF STANCES`. Column 1 carries a `STANCE FEATURES`
 * banner, then four `TIER n` heads with four stances each: sixteen in all.
 *
 *     TIER 1  Favored, Invigorating, Quick, Reliable
 *     TIER 2  Aggressive, Anchored, Defensive, Otherworldly
 *     TIER 3  Grappling, Scary, Stable, Vigilant
 *     TIER 4  Crushing, Exacting, Honed, Isolating
 *
 * A stance is set ALMOST the way a transformation's feature is: a bold name, a
 * colon, then light body text that wraps. So `boldPrefix` / `featureNameOf` in
 * `shared/parsers/transformations.ts` is the precedent this follows, and
 * `bodyAfterName` is taken from it unchanged.
 *
 * Almost, and the difference costs a stance. That file's rule is "a bold run
 * that ENDS in a colon", and one of the sixteen does not: the book sets
 * `Honed: Spend a Focus` with the mechanical phrase bolded straight through, so
 * the line's opening bold run runs past the colon. Under the borrowed rule the
 * parser returned fifteen. `nameOf` below carries the measurement and the wider
 * rule; `tools/validate.ts` carries the two gates that refused the fifteen.
 *
 * ## Why the banner selects this chapter and the contents page cannot
 *
 * `contents.ts`'s docblock sets the rule: a parser takes its range from the
 * book's own contents page. This chapter is the case that rule reserves for a
 * banner, and it is measured rather than assumed. `parseContents` over the
 * 2026-08-25 book returns 44 entries and NOT ONE of them is `Martial Stances`;
 * SRD 1.0's 38 entries do not name it either. The page sits inside `Classes`
 * (folio 8, running to `Ancestries` at 32) with no entry of its own, which is
 * why it was the only folio in that span yielding zero records.
 *
 * So the contents page is used for the one thing it can state - where `Classes`
 * begins and ends - and the chapter head is what selects the material inside
 * it. Measured on both books, every page rather than a sample:
 *
 *     display line folding to `MARTIAL STANCES`  SRD 2.0 folio 13; SRD 1.0 none
 *     bold-sans `STANCE FEATURES` banner         SRD 2.0 folio 13; SRD 1.0 none
 *     bold-sans `TIER n` head inside Classes     SRD 2.0 four, all folio 13;
 *                                                SRD 1.0 none
 *
 * The word "stance" on its own proves nothing and was checked: it appears on 49
 * pages of SRD 2.0 and 25 of SRD 1.0, inside `circumstance` and `substance` and
 * in the Brawler's own `Stance Fighter` feature on folio 12. The BANNER is the
 * evidence, and the banner is what this reads.
 *
 * ## "This book has none" is an answer, and it is not the same as failing
 *
 * The same discipline `transformations.ts` states, with the two signals
 * swapped. There the contents decides absence and the pages cross-examine it;
 * here the pages decide and there is no contents entry to appeal to, so the
 * cross-examination is the OTHER banner. A book whose Classes range prints no
 * `MARTIAL STANCES` head while some page prints a `STANCE FEATURES` banner - or
 * prints the head outside the Classes range - is a book this parser has failed
 * to select, not a book without stances, and it throws saying so.
 *
 * After that gate, every failure throws. There is no `catch` in this file.
 *
 * ## Why the tail is the next display line and not a title
 *
 * `sectionRange`'s `to` deliberately overlaps the next section by a page, so a
 * range arrives carrying its neighbours at BOTH ends; trimming only the tail is
 * the bug that made `communities.ts` read the ancestry Simiah as a community.
 * Here the head cut is the chapter banner itself, and the tail cannot be a
 * contents title because the chapter has none and does not end where a contents
 * entry begins - it ends where the next CLASS begins. Folio 14 opens `DRUID` in
 * `12.0 EvelethCleanThin` bold, and folio 13 carries exactly one display line
 * (the chapter head). So the tail is the first display line after the head,
 * whatever it is called, and it is handed to `sliceSection` as the `next` title
 * so both ends are cut by the one function that knows how to do it.
 *
 * ## Which of the two cuts is load-bearing, measured rather than asserted
 *
 * This paragraph used to claim both were, and one of them is not. Measured, by
 * deleting each and running the build:
 *
 *   tail cut removed  `npm run build:srd -- --check` dies with
 *                     `ParseError: duplicate stance id ... near:
 *                     gain-advantage-on`, because folios 14-32 are class
 *                     material and every `Name:` in them parses as a stance.
 *                     The vitest check *"drops the subclass feature above it
 *                     and the class printed after it"* goes red on `Beastform`.
 *   head cut removed  every gate stays GREEN, and the sixteen are unchanged.
 *
 * The head cut is green because it is not the only thing cutting that end:
 * `bannerAt` below drops everything above `STANCE FEATURES`, and on this book
 * that banner is printed once. So the head cut is the parser refusing to depend
 * on that being true - a book that printed the banner twice, or printed one
 * earlier in `Classes`, would hand `findIndex` the wrong one - and it is pinned
 * by *"reads the chapter under the head, not an earlier page that prints the
 * same banner"* rather than left as untested defence.
 *
 * Saying which is which matters more than having two: a reader who believed
 * both were load-bearing would take the wrong one out first.
 */
import type { BookPage, Line, TextRun } from '../textLayout.ts';
import type { Stance, Tier } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBoldSans,
  isDisplay,
  joinLines,
  linesWithFolio,
  normalizeText,
  splitOn,
} from './util.ts';
import { parseContents, sectionRange, sliceSection } from './contents.ts';

/**
 * The contents-page title that bounds the search. Not the chapter's own name:
 * neither book's contents mentions the stances at all, and this is the chapter
 * they are printed inside.
 */
const ENCLOSING_SECTION = 'Classes';

/** The chapter head, and the only thing that says this chapter is here. */
const CHAPTER = 'Martial Stances';

/** The banner over the stance list, and the second proof the chapter is here. */
const FEATURES_BANNER = /^stance features$/i;

/** A tier head: `TIER 1` .. `TIER 4`, set in bold sans at 10pt. */
const TIER_HEAD = /^tier\s+(\d+)$/i;

/**
 * A tail title no printed line can equal, for a chapter that runs to the end of
 * its enclosing range.
 *
 * `sliceSection` takes everything after the head when it cannot find the tail,
 * which is the right answer there - but only if the tail it is given is
 * genuinely unmatchable, and the two obvious candidates are not.
 * `contents.ts`'s `key` collapses whitespace and trims, so `key('')`,
 * `key(' ')` and `key` of any blank line are all `''`: measured, a tail of
 * either truncates `['a', ' ', 'b']` to `['a']`, while U+0000 returns all
 * three. Written as an escape rather than as the character itself, because a
 * raw NUL in a source file is a byte that tools quietly eat.
 */
const NO_TAIL = '\u0000';

type Sourced = Line & { folio: number };

/** The section title folded the way `contents.ts` folds it, for comparison. */
const fold = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** The chapter head: display type, and the chapter's printed name. */
const isChapterHead = (l: Line): boolean =>
  isDisplay(l) && fold(normalizeText(l.text)) === fold(CHAPTER);

/** Every printing of this chapter prints this banner over its list. */
const isFeaturesBanner = (l: Line): boolean =>
  isBoldSans(l) && FEATURES_BANNER.test(normalizeText(l.text));

/**
 * A tier head, or `null`. Bold sans, which `STANCE FEATURES` and the four rules
 * banners also are - the digit is what separates them, and none of those four
 * carries one. Measured inside the Classes range of both books: four matches in
 * SRD 2.0, all on folio 13, and none at all in SRD 1.0.
 *
 * Not `isDisplay`, which is what SRD 1.0 sets ITS tier heads in - the beastform
 * chapter's `TIER 2` on folio 13 of that book is `11.3 EvelethCleanThin`. This
 * chapter's are `10.0 QuestaSans-Medium` with the weight the extractor reports
 * as bold. Reading the wrong signal would make every beastform tier head open a
 * stance block.
 */
const tierOf = (l: Line): number | null => {
  if (!isBoldSans(l)) return null;
  const m = TIER_HEAD.exec(normalizeText(l.text));
  return m === null ? null : Number(m[1]);
};

export function parseStances(pages: BookPage[]): Stance[] {
  const contents = parseContents(pages);
  const range = sectionRange(contents, ENCLOSING_SECTION);
  const all: Sourced[] = linesWithFolio(pages, range.from, range.to);

  const headAt = all.findIndex(isChapterHead);
  if (headAt < 0) {
    /*
     * The Classes range prints no chapter head. Before believing that this book
     * has no stances, ask the rest of the pages: the list cannot be printed
     * without its banner, and the head cannot be printed outside the range
     * without this parser having selected the wrong span.
     */
    const listed = pages.filter((p) => p.lines.some(isFeaturesBanner));
    if (listed.length > 0) {
      throw new ParseError(
        `no "${CHAPTER}" head inside ${ENCLOSING_SECTION} (folios ${range.from}-${range.to}), ` +
          `but ${listed.length} page(s) print a STANCE FEATURES banner`,
        `folios ${listed.map((p) => p.folio ?? '?').join(', ')} - the chapter is in the book and this parser cannot select it`,
      );
    }
    const elsewhere = pages.filter((p) => p.lines.some(isChapterHead));
    if (elsewhere.length > 0) {
      throw new ParseError(
        `the "${CHAPTER}" head is printed outside ${ENCLOSING_SECTION} (folios ${range.from}-${range.to})`,
        `folios ${elsewhere.map((p) => p.folio ?? '?').join(', ')} - this book files the chapter somewhere else`,
      );
    }
    return [];
  }

  /*
   * Cut at BOTH ends. The head is the chapter banner; the tail is the next
   * display line after it, which is the next class's name - `DRUID` on folio 14
   * in this printing. Passing its text to `sliceSection` rather than cutting by
   * index keeps one function responsible for both ends, and that function is
   * the one whose docblock carries the Simiah scar.
   */
  const tail = all.slice(headAt + 1).find(isDisplay);
  const lines = sliceSection(all, all[headAt]!.text, tail?.text ?? NO_TAIL);
  if (lines.length === 0) {
    throw new ParseError(
      `no lines between the "${CHAPTER}" head and ${tail === undefined ? 'the end of ' + ENCLOSING_SECTION : `"${tail.text}"`}`,
      `folios ${range.from}-${range.to}`,
    );
  }

  const bannerAt = lines.findIndex(isFeaturesBanner);
  if (bannerAt < 0) {
    throw new ParseError(
      `"${CHAPTER}" has no STANCE FEATURES banner`,
      joinLines(lines.map((l) => l.text)),
    );
  }

  /*
   * Everything above the banner is the chapter's rules prose - the four
   * bold-sans sections that say what a stance is, what Focus is, and how you
   * shift into and drop out of one. It is dropped here for the reason
   * `transformations.ts` drops folio 42's `GRANTING TRANSFORMATIONS`: it is
   * rules text about a mechanic, not a record. See this lane's openQuestions
   * for where it should live.
   */
  const blocks = splitOn(lines.slice(bannerAt + 1), (l) => tierOf(l) !== null);
  if (blocks.length === 0) {
    throw new ParseError(
      `"${CHAPTER}" prints no TIER heads under STANCE FEATURES`,
      joinLines(lines.slice(bannerAt + 1).map((l) => l.text)),
    );
  }

  const out: Stance[] = [];
  const tiersSeen = new Set<number>();
  for (const block of blocks) {
    const head = block[0]!;
    const tier = tierOf(head)!;
    if (tier < 1 || tier > 4) {
      throw new ParseError(`"${CHAPTER}" prints a TIER ${tier} head`, normalizeText(head.text));
    }
    if (tiersSeen.has(tier)) {
      throw new ParseError(`"${CHAPTER}" prints TIER ${tier} twice`, normalizeText(head.text));
    }
    tiersSeen.add(tier);
    out.push(...parseTier(block.slice(1), tier as Tier, head.folio));
  }

  const seen = new Set<string>();
  for (const s of out) {
    if (seen.has(s.id)) throw new ParseError('duplicate stance id', s.id);
    seen.add(s.id);
  }
  return out;
}

/**
 * The stances under one tier head.
 *
 * A stance opens where the book sets a bold name ending in a colon, and a line
 * that does not continues the one above it. Identical to a transformation
 * card's features, and for the same reason: a paragraph gap and a bold name are
 * all that separate two entries, and the book bolds mechanical nouns mid-body -
 * `Restrain` inside Grappling's text is bold, and `Focus Cannon:` one folio
 * back is bold-and-colon and is a SUBCLASS feature, which is why the head cut
 * above is load-bearing rather than tidy.
 *
 * `joinLines` and not the local `joinProse` `transformations.ts` carries:
 * measured, folio 13 has ZERO lines ending in a hyphen or dash, so the rule
 * that file works around cannot fire here and shadowing a shared helper to
 * neutralise a case the page does not contain would be a workaround with no
 * defect under it.
 */
function parseTier(lines: readonly Sourced[], tier: Tier, tierFolio: number): Stance[] {
  const blocks: Array<{ name: string; body: string[]; folio: number }> = [];
  for (const line of lines) {
    const text = normalizeText(line.text);
    if (text.length === 0) continue;
    const name = nameOf(line);
    if (name === null) {
      const open = blocks[blocks.length - 1];
      if (open === undefined) {
        throw new ParseError(`TIER ${tier}: text under the tier head before any bold "Name:"`, text);
      }
      open.body.push(text);
      continue;
    }
    blocks.push({ name, body: [bodyAfterName(text, name)], folio: line.folio });
  }

  if (blocks.length === 0) {
    throw new ParseError(
      `TIER ${tier} has no stances under it`,
      `folio ${tierFolio}: ${joinLines(lines.map((l) => l.text))}`,
    );
  }

  return blocks.map((b) => {
    const text = normalizeText(joinLines(b.body));
    if (text.length === 0) {
      throw new ParseError(`TIER ${tier}: stance "${b.name}" has no text`, b.name);
    }
    return { id: slugify(b.name), name: b.name, tier, text, sourcePage: b.folio };
  });
}

/**
 * The bold run(s) that open a line, as one string, or `null` when the line does
 * not open in bold.
 *
 * Runs and not the line's own `bold`, which is true only when EVERY run is -
 * and a stance's first line is bold name plus light body, so the line is never
 * bold as a whole. Same shape as `transformations.ts`, which needs the same
 * thing for the same typography.
 */
function boldPrefix(line: Sourced): string | null {
  const bold: TextRun[] = [];
  for (const run of line.runs) {
    if (!run.bold) break;
    bold.push(run);
  }
  if (bold.length === 0) return null;
  return normalizeText(bold.map((r) => r.text).join(' '));
}

/**
 * A stance opens where the book sets a bold name and a colon - the name being
 * whatever precedes the FIRST colon in the line's opening bold run.
 *
 * ## Not `prefix.endsWith(':')`, and the difference is one whole stance
 *
 * `transformations.ts` reads a feature name as "a bold run that ENDS in a
 * colon", and that rule loses `Honed`. The book sets folio 13's Tier 4 entry as
 *
 *     [bold]Honed:[/bold] [bold]Spend a Focus[/bold] before you make an attack
 *
 * with no light run between the colon and the bolded mechanical phrase, so the
 * line's opening bold run is `Honed: Spend a Focus` and does not end in a
 * colon. Under the stricter rule the line is a continuation, `Honed` is welded
 * onto `Exacting`'s body, and the answer is fifteen stances - which was the
 * first thing this parser produced. The build refused it, on
 * `REVISION_COUNTS.stances` and on the per-tier evenness check in
 * `tools/validate.ts` (tier 4 had three), and neither would have said a word if
 * the count had been written down after the parser rather than before it.
 *
 * Measured on the sixteen: `Honed` is the only one the book bolds through. The
 * other fifteen open `[bold]Name:[/bold]` and a light run, and Crushing's own
 * `spend a Hope` is bolded five words later, after light runs, so `boldPrefix`
 * has already stopped.
 *
 * ## What the wider rule cannot do
 *
 * It cannot open a stance on a continuation line, because a continuation would
 * need a colon inside its OPENING bold run, and no line in the chapter has one:
 * measured, the sixteen matches under this rule are exactly the sixteen names.
 * If a printing ever produced a seventeenth match the total stops being sixteen
 * and the tiers stop being even, which is what the two gates are for.
 */
const nameOf = (line: Sourced): string | null => {
  const prefix = boldPrefix(line);
  if (prefix === null) return null;
  const colon = prefix.indexOf(':');
  if (colon < 0) return null;
  const bare = prefix.slice(0, colon).trim();
  return bare.length === 0 ? null : bare;
};

/**
 * What follows the colon that CLOSES the bold name, not the first colon on the
 * line. They are the same colon on all sixteen stances this book prints, and
 * they stop being the same the moment a name contains one.
 *
 * Unchanged from `transformations.ts` even though `nameOf` above is not: the
 * count it walks is the number of colons IN THE NAME plus one, so a name taken
 * from before the first colon of a longer bold run lands on exactly that colon.
 */
function bodyAfterName(text: string, name: string): string {
  let at = -1;
  for (let n = (name.match(/:/g) ?? []).length + 1; n > 0; n -= 1) at = text.indexOf(':', at + 1);
  return text.slice(at + 1).trim();
}
