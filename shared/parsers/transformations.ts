/**
 * Transformations - SRD 2.0 folios 42-45. A chapter SRD 1.0 does not print.
 *
 * The book's own contents page lists `Transformations` at folio 42, among CORE
 * MATERIALS, between `Communities` (38) and `CORE MECHANICS` (46). Folio 42
 * carries the 17.3pt `TRANSFORMATIONS` chapter head and the GM prose under it -
 * including a 12pt `GRANTING TRANSFORMATIONS` section - and folios 43, 44 and
 * 45 print two cards each, one per column: DEMIGOD/GHOST, REANIMATED/
 * SHAPESHIFTER, VAMPIRE/WEREWOLF.
 *
 * A card is, in the book's own order: a 12pt display name, two or three
 * paragraphs of prose, a `TRANSFORMATION FEATURES` banner over the features,
 * and a `TRANSFORMATION QUESTIONS` banner over a bulleted list of prompts.
 *
 * ## "This book has none" is an answer, and it is not the same as failing
 *
 * SRD 1.0 has no Transformations chapter at all, so `folioOf`/`sectionRange`
 * throw on it - correctly, since there is no entry to find. Wrapping the whole
 * parser in a `try { ... } catch { return [] }` would turn that into the right
 * answer for the wrong reason, and would go on returning the right answer after
 * the parser broke on a book that DOES print the chapter. It is the failure
 * mode this repository has already paid for twice: SRD 2.0's U+25E6 bullet,
 * which no parser knew and which no gate called an error, so 41 domain cards
 * shipped with their option lists silently un-listed; and a range trimmed at
 * one end only, which fed `communities.ts` the ancestry Simiah and produced a
 * community rather than a failure.
 *
 * So absence is decided BEFORE any parsing, from the one place that can state
 * it - the book's own contents page - and it is cross-examined against the
 * pages: `TRANSFORMATION FEATURES` is the banner every card prints, and a book
 * whose contents omits the chapter while its pages print that banner is a book
 * this parser has failed to read, not a book without transformations. Measured:
 * SRD 1.0 prints the banner zero times and SRD 2.0 six times, and SRD 1.0
 * prints no heading matching /transformation/i at all.
 *
 * After that gate, every failure throws. There is no `catch` in this file.
 *
 * ## Why the card banner is Eveleth-and-bold and the section heads are not
 *
 * Measured across the four folios: the chapter head is
 * `17.3 EvelethCleanRegular`, `GRANTING TRANSFORMATIONS` is
 * `12.0 EvelethCleanRegular`, and all six card names are
 * `12.0 EvelethCleanThin` with the weight the extractor reports as bold. So
 * within the chapter, "display type, under 15pt, bold" selects the six card
 * names and nothing else. Both ways of being wrong are loud rather than silent:
 * a banner wrongly INCLUDED opens a block with no `TRANSFORMATION FEATURES`
 * inside it, and a banner wrongly MISSED welds two cards into one block with
 * two of them. Only a missed FIRST banner is quiet, and that one loses a whole
 * card, which is what `REVISION_COUNTS.transformations` is for.
 *
 * ## Why a feature starts at "bold prefix ending in a colon"
 *
 * The two features on a card are separated by nothing but a paragraph gap and
 * the bold name that opens each one, and `Community`'s rule - "the colon is the
 * only reliable delimiter" - is not enough here, because a feature's BODY
 * contains colons ("...for their blood. What...") and, worse, contains bold
 * runs mid-sentence: the book bolds its mechanical nouns, so `mark 2 Stress`,
 * `permanently mark a Hit Point`, `d6`, `1d10` and `d20s` are all bold, and two
 * of them open a line. Bold alone would cut a feature in half; a colon alone
 * would cut it somewhere else. The book sets a feature name as a bold run that
 * ENDS in a colon, and that conjunction is what this reads.
 */
import type { BookPage, Line, TextRun } from '../textLayout.ts';
import type { Feature, Transformation } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBoldSans,
  isDisplay,
  joinLines,
  linesWithFolio,
  normalizeText,
  splitOn,
  titleCase,
} from './util.ts';
import { parseContents, sectionRange, sliceSection } from './contents.ts';

/** The contents-page title. SRD 2.0 prints it; SRD 1.0 has no such entry. */
const SECTION = 'Transformations';

/** The banner over a card's features, and the proof a card is printed here. */
const FEATURES_BANNER = /^transformation features$/i;
/** The banner over a card's questions. */
const QUESTIONS_BANNER = /^transformation questions$/i;

/**
 * The bullet the question lists use.
 *
 * U+2022, checked rather than assumed. SRD 2.0 opens option lists inside a card
 * with U+25E6, a hollow ring that `joinWithBullets` does not know and that cost
 * 41 records in the domain-card appendix, so its absence here is a measurement:
 * 172 line-initial rings in SRD 2.0, on folios 10, 11, 14, 19, 20, 23, 25, 28,
 * 86, 87, 203-205 and 207-223, and NONE on 42-45. The 36 prompts in this
 * chapter are U+2022, the same bullet SRD 1.0 uses everywhere.
 */
const BULLET = /^•\s*/;

type Sourced = Line & { folio: number };

/**
 * A line-final hyphen or dash, which in this chapter is never hyphenation.
 *
 * U+002D and U+2010..U+2015. `joinLines` in `shared/parsers/util.ts` treats all
 * of them as a soft hyphen: when a line ends in one and the next begins
 * lowercase, it DELETES the character and welds the two halves into a single
 * word. The book is set justified with hyphenation OFF - `util.ts`'s own
 * docblock says so - so a character at a line end is a real one, and deleting
 * it loses a character out of the middle of a sentence.
 *
 * Measured on both books, every occurrence rather than a sample. The rule fires
 * (next line lowercase) 15 times in SRD 2.0 and 11 times in SRD 1.0, and every
 * one of the 26 is wrong: `one-shot` -> `oneshot`, `two-handed` -> `twohanded`,
 * `piston-driven` -> `pistondriven`, `long-dead` -> `longdead`, `2-foot-deep`
 * -> `2-footdeep`, `pre-scripting` -> `prescripting`, `time-sensitive` ->
 * `timesensitive`, `long-term` -> `longterm`, `tech-based` -> `techbased`,
 * `one-for-one` -> `one-forone`, `campfire—at` -> `campfireat`,
 * `monuments—the` -> `monumentsthe`, `Fear Die—that` -> `Fear Diethat`,
 * `swordpoint—to` -> `swordpointto`, `Fanewick—there` -> `Fanewickthere`,
 * `becomes incorporeal—which` -> `incorporealwhich`, `tough galapa—their` ->
 * `galapatheir`. The last two are on these folios, in the GHOST and
 * SHAPESHIFTER card prose.
 *
 * ## Scope, stated rather than assumed
 *
 * This helper's claim is about folios 42-45, where exactly three lines end in
 * one of these characters - `a long-` / `dead ghost` in the GM prose this
 * parser drops, and the two above - and closing all three up is right. It is
 * NOT a claim about the book: 70 lines in SRD 2.0 and 53 in SRD 1.0 end in one
 * of these characters followed by a letter, and most are a lone em dash used as
 * an empty cell in the weapon and armor tables (`... Two-Handed —` above
 * `Battleaxe ...`), where closing up would be wrong. Those lines belong to
 * `equipment.ts` and never reach this function.
 *
 * ## This is the repository's own workaround, widened by four characters
 *
 * `shared/parsers/adversaries.ts` already shadows `joinLines` with a local copy
 * for exactly this reason, in exactly these words: "This chapter is set with
 * hyphenation off, so the two lines that break on a hyphen break inside a real
 * compound and must close up with the hyphen intact." Its guard - next line
 * starts with a letter - is reused here unchanged; what is widened is the
 * character class, which there covers U+002D, U+2010 and U+2011 and here has to
 * cover the em dash as well.
 *
 * `util.ts` is shared with every other parser and is not this lane's to change.
 * The strictly minimal edit it wants is in the handoff, and it is NOT this
 * function: it is deleting the `.replace()` from the branch `joinLines` already
 * has, which fixes all 26 sites and, because its lowercase guard excludes every
 * lone-em-dash table row, can reach nothing else.
 */
const BROKEN_END = /[‐-―-]$/;

/** `joinLines`, with the character at a line break kept rather than deleted. */
function joinProse(lines: readonly string[]): string {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (out.length === 0) out = line;
    else if (BROKEN_END.test(out) && /^\p{L}/u.test(line)) out += line;
    else out += ' ' + line;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** The section title folded the way `contents.ts` folds it, for comparison. */
const fold = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Every card prints this banner, so it is the evidence a chapter is present. */
const isFeaturesBanner = (l: Line): boolean =>
  isBoldSans(l) && FEATURES_BANNER.test(normalizeText(l.text));

const isQuestionsBanner = (l: Line): boolean =>
  isBoldSans(l) && QUESTIONS_BANNER.test(normalizeText(l.text));

/**
 * A card's name banner: display type, smaller than the chapter head, bold.
 *
 * Measured over folios 42-45, every line in display type: the chapter head is
 * `17.3 EvelethCleanRegular`, `GRANTING TRANSFORMATIONS` is
 * `12.0 EvelethCleanRegular`, and the six card names are `12.0
 * EvelethCleanThin` with the weight the extractor reports as bold. So size
 * alone - which is all `communities.ts` needs, since it has only its own 17.3pt
 * chapter head to exclude - would take the rules section as a seventh card
 * here, and the weight is the third signal.
 *
 * Weight rather than the family string, because `bold` is the signal the rest
 * of this directory already reads (`isBoldSans`) and because a family name is
 * whatever the PDF's font subset happens to be called: `EvelethCleanThin` is a
 * name this printing chose, and a printing that set its card names in
 * `EvelethCleanBold` would break a family test while leaving the weight test
 * exactly right.
 */
const isCardBanner = (l: Line): boolean => isDisplay(l) && l.size < 15 && l.bold;

export function parseTransformations(pages: BookPage[]): Transformation[] {
  const contents = parseContents(pages);
  const listed = contents.some((e) => fold(e.title) === fold(SECTION));

  if (!listed) {
    /*
     * The book's contents does not name the chapter. Before believing that,
     * ask the pages: a card cannot be printed without its banner.
     */
    const printed = pages.filter((p) => p.lines.some(isFeaturesBanner));
    if (printed.length > 0) {
      throw new ParseError(
        `contents has no "${SECTION}" entry, but ${printed.length} page(s) print a TRANSFORMATION FEATURES banner`,
        `folios ${printed.map((p) => p.folio ?? '?').join(', ')} - the chapter is in the book and this parser cannot select it`,
      );
    }
    return [];
  }

  const range = sectionRange(contents, SECTION);
  const all: Sourced[] = linesWithFolio(pages, range.from, range.to);

  /*
   * Cut at BOTH ends. `sectionRange.to` deliberately includes the next
   * section's first folio, and here the FIRST folio is the shared one: folio 42
   * prints WILDBORNE, the last community, in its left column and opens this
   * chapter in its right. Trimming only the tail is the bug that made
   * `communities.ts` read the ancestry Simiah as a community; trimming only the
   * head would take CORE MECHANICS' own headings as cards, and folio 46 sets
   * PRINCIPLES and BEST PRACTICES in exactly the face and size a card name uses.
   */
  const lines = sliceSection(all, SECTION, range.next);
  if (lines.length === 0) {
    throw new ParseError(
      `no lines between the "${SECTION}" banner and "${range.next}"`,
      `folios ${range.from}-${range.to}`,
    );
  }

  /*
   * `splitOn` drops everything before the first match, and that is load-bearing
   * rather than incidental here: what it drops is folio 42's GM prose and the
   * `GRANTING TRANSFORMATIONS` section, which are rules text and belong in
   * `rules`, not on a card.
   */
  const blocks = splitOn(lines, isCardBanner);
  if (blocks.length === 0) {
    throw new ParseError(
      'no transformation card banners found',
      `folios ${range.from}-${range.to}, ${lines.length} lines after the section cut`,
    );
  }

  const out = blocks.map(parseCard);

  const seen = new Set<string>();
  for (const t of out) {
    if (seen.has(t.id)) throw new ParseError('duplicate transformation id', t.id);
    seen.add(t.id);
  }
  return out;
}

function parseCard(block: Sourced[]): Transformation {
  const banner = block[0];
  if (!banner) throw new ParseError('empty transformation block', '');
  const rest = block.slice(1);
  const name = titleCase(normalizeText(banner.text));

  const features = rest.filter(isFeaturesBanner).length;
  const questions = rest.filter(isQuestionsBanner).length;
  /*
   * One of each. Two means a neighbouring card was swallowed whole - the
   * failure `communities.ts` names - and zero means this block is not a card at
   * all, which is what a section head wrongly taken for a banner produces.
   */
  if (features !== 1 || questions !== 1) {
    throw new ParseError(
      `${name}: expected 1 TRANSFORMATION FEATURES and 1 TRANSFORMATION QUESTIONS banner, found ${features} and ${questions}`,
      joinLines(rest.map((l) => l.text)),
    );
  }
  const featuresAt = rest.findIndex(isFeaturesBanner);
  const questionsAt = rest.findIndex(isQuestionsBanner);
  if (questionsAt < featuresAt) {
    throw new ParseError(
      `${name}: TRANSFORMATION QUESTIONS is printed above TRANSFORMATION FEATURES`,
      joinLines(rest.map((l) => l.text)),
    );
  }

  const description = normalizeText(joinProse(rest.slice(0, featuresAt).map((l) => l.text)));
  if (description.length === 0) throw new ParseError('transformation has no description', name);

  return {
    id: slugify(name),
    name,
    description,
    features: parseFeatures(rest.slice(featuresAt + 1, questionsAt), name),
    questions: parseQuestions(rest.slice(questionsAt + 1), name),
    sourcePage: banner.folio,
  };
}

/**
 * The bold run(s) that open a line, as one string, or `null` when the line does
 * not open in bold.
 *
 * Runs and not the line's own `bold`, which is true only when EVERY run is -
 * and a feature's first line is bold name plus light body, so the line is never
 * bold as a whole.
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

/** A feature opens where the book sets a bold name ending in a colon. */
const featureNameOf = (line: Sourced): string | null => {
  const prefix = boldPrefix(line);
  if (prefix === null || !prefix.endsWith(':')) return null;
  const bare = prefix.slice(0, -1).trim();
  return bare.length === 0 ? null : bare;
};

/**
 * What follows the colon that CLOSES the bold name, not the first colon on the
 * line. They are the same colon on all twelve features this book prints, and
 * they stop being the same the moment a name contains one - which is a card
 * away, not a book away, and costs one loop to be right about.
 */
function bodyAfterName(text: string, name: string): string {
  let at = -1;
  for (let n = (name.match(/:/g) ?? []).length + 1; n > 0; n -= 1) at = text.indexOf(':', at + 1);
  return text.slice(at + 1).trim();
}

function parseFeatures(lines: readonly Sourced[], card: string): Feature[] {
  const blocks: Array<{ name: string; body: string[] }> = [];
  for (const line of lines) {
    const text = normalizeText(line.text);
    if (text.length === 0) continue;
    const name = featureNameOf(line);
    if (name === null) {
      const open = blocks[blocks.length - 1];
      if (open === undefined) {
        throw new ParseError(
          `${card}: text under TRANSFORMATION FEATURES before any bold "Name:"`,
          text,
        );
      }
      open.body.push(text);
      continue;
    }
    blocks.push({ name, body: [bodyAfterName(text, name)] });
  }

  if (blocks.length === 0) {
    throw new ParseError(
      `${card}: no features under TRANSFORMATION FEATURES`,
      joinLines(lines.map((l) => l.text)),
    );
  }

  return blocks.map((b) => {
    const text = normalizeText(joinProse(b.body));
    if (text.length === 0) {
      throw new ParseError(`${card}: feature "${b.name}" has no text`, b.name);
    }
    return { name: b.name, text };
  });
}

/**
 * The prompts, one per bullet.
 *
 * Not `joinWithBullets`: that returns one string with `- ` markers, and the
 * schema wants `string[]`, the shape `CharClass.backgroundQuestions` already
 * uses for exactly this kind of list. A line that is not a bullet continues the
 * one above it.
 */
function parseQuestions(lines: readonly Sourced[], card: string): string[] {
  const out: string[][] = [];
  for (const line of lines) {
    const text = normalizeText(line.text);
    if (text.length === 0) continue;
    if (BULLET.test(text)) {
      out.push([text.replace(BULLET, '')]);
      continue;
    }
    if (out.length === 0) {
      throw new ParseError(
        `${card}: text under TRANSFORMATION QUESTIONS before the first bullet`,
        text,
      );
    }
    out[out.length - 1]!.push(text);
  }
  if (out.length === 0) {
    throw new ParseError(
      `${card}: no questions under TRANSFORMATION QUESTIONS`,
      joinLines(lines.map((l) => l.text)),
    );
  }
  return out.map((q) => normalizeText(joinProse(q)));
}
