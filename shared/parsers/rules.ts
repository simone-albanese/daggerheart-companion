/**
 * The prose the app renders and never executes: the introduction, character
 * creation, the core mechanics, combat, downtime, levelling and the GM
 * chapter. The Witherwild campaign frame is read and dropped; see the manifest.
 *
 * Three things make this harder than reading `page.lines` in order.
 *
 * 1. The XY-cut in `textLayout` is tuned for cards and stat blocks. Where a
 *    page sets two *independent* columns - folio 3's sidebar, folio 102's
 *    stat-block glossary - it walks them band by band and interleaves them,
 *    and where two headings share a baseline in different columns it welds
 *    them into one line ("ENVIRONMENT STAT BLOCK" + "DESCRIPTION"). So this
 *    parser re-assembles lines from `page.runs`, cutting every band at the
 *    gutter before anything else.
 * 2. Section boundaries are typographic, not textual: a heading is a heading
 *    because of its face and size. The manifest below names every heading
 *    that opens a section, in book order, so a layout change fails loudly
 *    instead of silently merging two topics.
 * 3. The rules are not one chapter. They are nine islands scattered through
 *    the book - two pages out of the class chapter, one out of the
 *    environments chapter - and the reference tables inside them are the only
 *    material in this directory that has to be selected by GEOMETRY rather
 *    than by text, because a table's cells are only a table by where they sit.
 *
 * ## Nothing here is a coordinate carried in the source
 *
 * It used to be. Eight folio ranges and thirteen boxes of absolute x/y, all
 * measured on SRD 1.0, all correct for exactly one book. Seven of the thirteen
 * boxes were worse than wrong: `layoutPages` splits a 1224pt spread into two
 * `BookPage`s but leaves the runs in SPREAD coordinates, so a right-hand page's
 * text sits at x 612-1224. Those seven boxes were written in that frame and
 * select **zero runs** on SRD 2.0's 612pt single pages; the other six select
 * whatever the same rectangle happens to cover on a different page, which on
 * SRD 2.0 is weapon tables and adversary features.
 *
 * So every number is now read off the book:
 *
 * - **Page-local x.** `originX` is the page's own left edge in the coordinates
 *   its runs carry: `page.width` for the right half of a spread, 0 otherwise.
 *   Translated by it, SRD 1.0 folio 67 and SRD 2.0 folio 89 are the same page
 *   to within a point and a half.
 * - **The column gutter** is measured from the book: the widest whitespace
 *   column in the middle of each page, taken over every page of the stream and
 *   reduced to one value per page parity, because the SRD sets recto and verso
 *   on margins 14pt apart.
 * - **The islands** come from the contents page (`contents.ts`) where the
 *   chapter is in it, and from a banner the page prints where it is not:
 *   `BEASTFORM OPTIONS` and `RANGER COMPANION` have no contents entry.
 * - **The tables** are found by the text of their own first row and end at the
 *   first band below it that is a heading, or is set in a different size.
 *   Their `rows`/`cols`/`verify` gates are unchanged and still checks, not
 *   inputs: nothing below counts rows in order to decide where to stop.
 */
import type { BookPage, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import type { RulesSection } from '../types.ts';
import { slugify } from '../slugify.ts';
import { ParseError, normalizeText } from './util.ts';
import { folioOf, parseContents, rangeBetween, sectionRange, type ChapterEntry } from './contents.ts';

// ---------------------------------------------------------------------------
// Where the page is
// ---------------------------------------------------------------------------

/**
 * The page's own left edge, in the coordinates `page.runs` are given in.
 *
 * `layoutPages` cuts a spread in two and records each half as a `BookPage` of
 * half the width - but it does not translate the runs, so the right-hand half
 * carries x 612-1224 while its `width` is 612. That is the single fact that
 * made seven of this file's boxes select nothing on a single-page book.
 */
const originX = (page: BookPage): number => (page.side === 'right' ? page.width : 0);

const LOCAL = new WeakMap<BookPage, TextRun[]>();

/** `page.runs` with x measured from the page's own left edge. */
function localRuns(page: BookPage): TextRun[] {
  let hit = LOCAL.get(page);
  if (hit === undefined) {
    const ox = originX(page);
    hit = ox === 0 ? page.runs : page.runs.map((r) => ({ ...r, x: r.x - ox }));
    LOCAL.set(page, hit);
  }
  return hit;
}

/**
 * The x of the gutter between the two text columns, one value per page parity.
 *
 * Not a constant, and not per page either. Per page fails: folio 73's roster
 * sets a different grid and offers a convincing wrong one. Per book it is
 * stable to a point - the SRD prints its verso pages on a 57pt outer margin and
 * its recto pages on 71pt, and both books use the same two - so the median over
 * the whole stream is the grid, and the pages that show no gutter simply do not
 * vote.
 *
 * WHICH pages those are is worth stating exactly, because it is the only
 * description of what the median is a median OF - and it has now been got wrong
 * twice, in opposite directions, by people who did not instrument this loop.
 *
 * Measured by printing the abstention from inside THIS loop - not from a
 * re-implementation of it, which is how it was got wrong the first two times -
 * on both books. Twenty-six pages abstain in SRD 1.0 and thirty-seven in SRD
 * 2.0, and they fall into two groups that are not the same abstention:
 *
 * - `best = 0` at the gap test: no gap in the middle 40%, because there is one
 *   column. The full-width pages - covers, chapter openers, rosters - plus
 *   every equipment folio whose 8pt table grid leaves fewer than two columns of
 *   9pt text. SRD 1.0: 3, 4, 6, 35, 45-58, 60, 62, 63, 102, 103. SRD 2.0: 3, 4,
 *   6, 46, 56, 57, 59, 60, 62-64, 66, 70-72, 75, 77, 80, 82, 84, 85, 158, 159.
 * - `runs.length < 6`, never reaching the gap test at all, because almost
 *   nothing on the page is set at 9pt or larger: the two benchmark tables
 *   (folios 67 / 89) and the pure weapon, armor, loot and consumable table
 *   pages. SRD 1.0: 59, 61, 67. SRD 2.0: 58, 61, 65, 67-69, 73, 74, 76, 78,
 *   79, 81, 83, 89.
 *
 * A reader checking this by re-implementing the gap test alone will conclude
 * the second group votes. It does not.
 *
 * ## The equipment chapter added one voter per book, and moved neither median
 *
 * Twenty-nine folios entered the stream with `the equipment chapter` and
 * twenty-eight of them abstain, so the vote counts went 15 -> 16 even in SRD
 * 1.0 and 16 -> 17 odd in SRD 2.0: the single new voter is each book's
 * chapter-opening prose page, folio 44 and folio 55. Both medians are the same
 * numbers afterwards, 299 for even folios and 313.5 for odd ones, measured on
 * both books before and after.
 *
 * Only the classification matters, not the value: no run is wide enough to
 * straddle the gutter, so any x strictly inside it sorts the columns the same
 * way. That is what makes this an exact replacement for the 294/920 it
 * replaces rather than a re-tuning - and it is why twenty-nine folios can join
 * the stream while every section that existed before comes out byte-identical.
 */
function gutterGrid(pages: readonly BookPage[]): [number, number] {
  const votes: [number[], number[]] = [[], []];
  for (const page of pages) {
    const runs = localRuns(page).filter((r) => r.size >= 9);
    if (runs.length < 6) continue;
    const lo = Math.floor(Math.min(...runs.map((r) => r.x)));
    const hi = Math.ceil(Math.max(...runs.map((r) => r.x + r.w)));
    const filled = new Uint8Array(hi - lo + 1);
    for (const r of runs) {
      filled.fill(1, Math.max(0, Math.floor(r.x - lo)), Math.min(filled.length, Math.ceil(r.x + r.w - lo) + 1));
    }
    let best = 0;
    let centre = NaN;
    let gap = 0;
    for (let i = 0; i <= filled.length; i++) {
      if (i === filled.length || filled[i]) {
        const c = lo + i - gap / 2;
        // Only the middle of the block can be the gutter: a wide margin or a
        // roster's own grid is not one.
        if (gap > best && c > lo + (hi - lo) * 0.3 && c < lo + (hi - lo) * 0.7) {
          best = gap;
          centre = c;
        }
        gap = 0;
      } else gap++;
    }
    if (best >= MIN_COLUMN_GUTTER - 3) votes[page.folio! % 2 === 0 ? 0 : 1]!.push(centre);
  }
  const of = (xs: number[], what: string): number => {
    if (xs.length < 5) {
      throw new ParseError(`too few pages show a column gutter (${what})`, `${xs.length} of the stream`);
    }
    return median(xs);
  };
  return [of(votes[0]!, 'even folios'), of(votes[1]!, 'odd folios')];
}

/**
 * The folio a banner is printed on, for the sections the contents page does
 * not list. Exactly one page must carry it, which is the gate: an ambiguous
 * banner stops the build instead of choosing.
 */
function bannerFolio(pages: readonly BookPage[], text: string): number {
  const hits = pages.filter((p) => p.folio !== null && p.lines.some((l) => l.text.trim() === text));
  if (hits.length !== 1) {
    throw new ParseError(
      `"${text}" is printed on ${hits.length} pages, not one`,
      hits.map((p) => `folio ${p.folio}`).join(', ') || 'nowhere in the book',
    );
  }
  return hits[0]!.folio!;
}

/**
 * The same, for a chapter one book prints and the other does not.
 *
 * `null` when NO page carries the banner - but an ambiguous banner is still
 * fatal, because two pages printing it is a parser that has lost its place, not
 * a book that lacks a chapter. Absence is only ever believed from zero.
 */
function bannerFolioOptional(pages: readonly BookPage[], text: string): number | null {
  const hits = pages.filter((p) => p.folio !== null && p.lines.some((l) => l.text.trim() === text));
  if (hits.length === 0) return null;
  if (hits.length > 1) {
    throw new ParseError(
      `"${text}" is printed on ${hits.length} pages, not one`,
      hits.map((p) => `folio ${p.folio}`).join(', '),
    );
  }
  return hits[0]!.folio!;
}

// ---------------------------------------------------------------------------
// The islands
// ---------------------------------------------------------------------------

/** The display head folio 13 prints, and the banner that ends its rules. */
const MARTIAL_STANCES_HEAD = 'MARTIAL STANCES';
const STANCE_FEATURES = 'STANCE FEATURES';

interface Island {
  /** What this island is, for an error message. */
  what: string;
  /**
   * Its folios, read off this book's contents page and banners - or `null` for
   * a chapter THIS BOOK DOES NOT PRINT. An island that may be absent must also
   * declare `provides`, and must cross-examine the absence itself.
   */
  folios: (
    entries: ChapterEntry[],
    pages: readonly BookPage[],
  ) => { from: number; to: number } | null;
  /**
   * The banner that opens it. Units before it on the first page are not rules
   * - SRD 2.0 sets `BEASTFORM OPTIONS` in the second column of a page whose
   * first column is a druid subclass. Required to be found when stated.
   */
  open?: string;
  /** The banner that closes it; it and everything after are not rules. */
  close?: string;
  /**
   * The section headings this island supplies. Named only by an island that can
   * return `null`: when it does, exactly these are struck from the sequence for
   * that book, and every other heading is still demanded. Without it, a book
   * missing the chapter would fail on `section heading never found`.
   */
  provides?: readonly string[];
}

/**
 * The rules stream, island by island, in book order.
 *
 * Each end is either a contents entry or a banner the page prints. Folio
 * numbers appear only in this comment, as the measurement they came from:
 *
 *   island                     SRD 1.0    SRD 2.0
 *   Introduction                   3-3        3-3
 *   Character Creation             4-6        4-6
 *   Beastform preamble           12-12      15-15
 *   Ranger Companion             18-19      21-22
 *   Core Mechanics               35-43      46-54
 *   Equipment                    44-61      55-83
 *   Gold + the GM chapter        62-73      84-95
 *   Using Environments         102-103    158-159
 *   Additional GM Guidance     112-118    183-189
 */
const ISLANDS: readonly Island[] = [
  {
    what: 'the introduction',
    folios: (e) => rangeBetween(e, ['INTRODUCTION'], ['CHARACTER CREATION']),
  },
  {
    what: 'character creation',
    folios: (e) => rangeBetween(e, ['CHARACTER CREATION'], ['CORE MATERIALS']),
  },
  /*
   * Folio 13 in SRD 2.0, and NOWHERE in SRD 1.0 - the first island in this list
   * that one book prints and the other does not.
   *
   * The page is two columns: the left is rules prose under four banners, the
   * right is the stance cards, which are `parseStances`'s. `close` cuts at
   * `STANCE FEATURES`, so the cards never flow into the rules - the same job
   * `{ start: 'TIER 1', drop: true }` does after the Beastform preamble.
   *
   * THE ABSENCE IS CROSS-EXAMINED, not assumed. A book with no `MARTIAL
   * STANCES` head that nevertheless prints a `STANCE FEATURES` banner is a
   * parser that has lost the chapter, not a book without one. That is the same
   * pairing `shared/parsers/stances.ts` makes, in the same direction, and it is
   * why `folios` and not the caller does the asking: only this entry knows what
   * the chapter cannot be printed without.
   */
  {
    what: 'the Martial Stances rules',
    folios: (e, p) => {
      const f = bannerFolioOptional(p, MARTIAL_STANCES_HEAD);
      if (f !== null) return { from: f, to: f };
      const listed = p.filter((q) => q.lines.some((l) => l.text.trim() === STANCE_FEATURES));
      if (listed.length > 0) {
        throw new ParseError(
          `no "${MARTIAL_STANCES_HEAD}" head, but ${listed.length} page(s) print "${STANCE_FEATURES}"`,
          listed.map((q) => `folio ${q.folio ?? '?'}`).join(', '),
        );
      }
      return null;
    },
    open: MARTIAL_STANCES_HEAD,
    close: STANCE_FEATURES,
    provides: [
      MARTIAL_STANCES_HEAD,
      'STANCES',
      'FOCUS',
      'SHIFTING INTO STANCES',
      'DROPPING OUT OF STANCES',
    ],
  },
  /*
   * Two pages out of the class chapter that are rules and not stat blocks.
   * The first opens the Beastform list with the paragraphs that say how a form
   * is *used* - the Proficiency sentence among them - and the second is the
   * whole Ranger Companion sheet. Both were unreachable prose until this
   * existed, and `engine/companion.ts` carried a copy of the sheet because of
   * it. Neither has a contents entry; both print a banner.
   */
  {
    what: 'the Beastform preamble',
    folios: (e, p) => {
      const f = bannerFolio(p, 'BEASTFORM OPTIONS');
      return { from: f, to: f };
    },
    open: 'BEASTFORM OPTIONS',
  },
  {
    /*
     * Ends at the Rogue, who follows the sheet in both books - on the next
     * page in SRD 1.0, in the next column in SRD 2.0. Naming the class rather
     * than counting pages is what lets one range serve both.
     */
    what: 'the Ranger Companion sheet',
    folios: (e, p) => ({ from: bannerFolio(p, 'RANGER COMPANION'), to: bannerFolio(p, 'ROGUE') }),
    open: 'RANGER COMPANION',
    close: 'ROGUE',
  },
  {
    what: 'the core mechanics',
    folios: (e) => rangeBetween(e, ['CORE MECHANICS'], ['Equipment']),
  },
  {
    /*
     * The equipment chapter, whose prose reached nothing until this entry
     * existed. The island above it stops one folio BEFORE `Equipment` and the
     * island below it starts at the `GOLD` banner, so folios 44-61 of SRD 1.0
     * and 55-83 of SRD 2.0 fell between two ends that were each correct on
     * their own. Measured on the committed datasets before this entry: zero of
     * the 69 sections of SRD 1.0 and zero of the 74 of SRD 2.0 contain the word
     * `burden`, or `consumable`, or the armor chapter's `Armor Slot` prose.
     *
     * ## The far end is the next island's own measurement, not a second one
     *
     * `bannerFolio(p, 'GOLD') - 1` and not the contents entry that follows,
     * because the two would disagree by a page and the disagreement would be
     * silent. The contents says `RUNNING AN ADVENTURE` opens on folio 85 in SRD
     * 2.0 (63 in SRD 1.0), but GOLD is printed at the head of the third column
     * of folio 84 (62), under the tail of the consumables table. A range ending
     * at 84 would hand that page to this island AND to the next one, and every
     * unit of the Gold page would be read twice. Ending one folio before the
     * banner the next island opens on is the only form in which the seam cannot
     * drift: one measurement, both sides of the cut.
     *
     * The near end is `folioOf` and not `sectionRange`, for the mirror reason -
     * `sectionRange` deliberately overlaps the next section by a page, which is
     * right for a chapter that shares a page with the next one and wrong here,
     * where the seam is already exact.
     */
    what: 'the equipment chapter',
    folios: (e, p) => ({ from: folioOf(e, 'Equipment'), to: bannerFolio(p, 'GOLD') - 1 }),
  },
  {
    /*
     * Gold closes the equipment chapter and has no contents entry of its own;
     * the GM chapter runs from there to the adversary roster, which is where
     * `parseAdversaries`'s material starts and this one's stops.
     */
    what: 'Gold and the GM chapter',
    folios: (e, p) => ({ from: bannerFolio(p, 'GOLD'), to: bannerFolio(p, 'ADVERSARIES BY TIER') }),
  },
  {
    /*
     * The environments chapter's own prose, ahead of its roster. In SRD 2.0
     * the first of these two pages also carries the last two adversary stat
     * blocks, above the banner - hence `open`.
     */
    what: 'the environments preamble',
    folios: (e, p) => ({
      from: bannerFolio(p, 'USING ENVIRONMENTS'),
      to: bannerFolio(p, 'ENVIRONMENT STAT BLOCKS BY TIER'),
    }),
    open: 'USING ENVIRONMENTS',
    close: 'ENVIRONMENT STAT BLOCKS BY TIER',
  },
  {
    /*
     * Additional GM Guidance and the campaign frame that follows it, up to
     * whatever the contents page says comes after the frame: the appendix in
     * SRD 1.0, the supplemental campaign mechanics in SRD 2.0. Reading the far
     * end off the contents rather than naming it is what keeps a chapter that
     * only one book has from being either swallowed or hardcoded.
     */
    what: 'additional GM guidance',
    folios: (e) => ({
      from: folioOf(e, 'Additional GM Guidance'),
      to: sectionRange(e, 'The Witherwild Campaign Frame').to - 1,
    }),
  },
];

/**
 * A section, keyed by the heading text that opens it - exactly as the book
 * sets it. `drop` marks front matter and the stat-block index, which the
 * dataset already models elsewhere.
 *
 * ## Why `start` may be a list
 *
 * For the one heading the two books do not spell the same way, and for that
 * one only. SRD 1.0 sets the consumables head as `Consumables` at 17.3pt, a
 * sibling of `LOOT`; SRD 2.0 sets it as `CONSUMABLES` at 12.0pt, a rank below
 * `LOOT` on the same page. Matching is on the exact string the book prints - a
 * case-insensitive compare is not available, because `INTRODUCTION` opens two
 * different sections in this manifest and `Introduction` is what the contents
 * page calls the second one - so the two spellings are listed instead.
 *
 * This is `folioOf`'s rule at a different layer, and it obeys the same one:
 * oldest book first, so a later revision's rename never shadows the name a
 * current one still prints. Every OTHER heading in the chapter is identical in
 * both books, which is what makes one list the whole of the exception.
 */
type Spec =
  | { start: string | readonly string[]; id: string; title: string; drop?: undefined }
  | { start: string | readonly string[]; drop: true };

/** The heading texts that open a spec: one, or the books' two spellings. */
const opensWith = (spec: Spec): readonly string[] =>
  typeof spec.start === 'string' ? [spec.start] : spec.start;

/**
 * Every heading that opens a section, in the order the stream produces them.
 * Matching is sequential, so two sections may share a heading text.
 */
const SPECS: readonly Spec[] = [
  { id: 'introduction', title: 'Introduction', start: 'INTRODUCTION' },
  { id: 'the-basics', title: 'The Basics', start: 'THE BASICS' },
  { id: 'the-golden-rule', title: 'The Golden Rule', start: 'THE GOLDEN RULE' },
  { id: 'rulings-over-rules', title: 'Rulings Over Rules', start: 'RULINGS OVER RULES' },

  { id: 'character-creation', title: 'Character Creation', start: 'CHARACTER CREATION' },

  /*
   * Folio 13, SRD 2.0 only - struck from the sequence for a book whose island
   * answered `null`. The display head carries a preamble of its own before the
   * first banner, so it is a section and not just an opening.
   */
  { id: 'martial-stances', title: 'Martial Stances', start: MARTIAL_STANCES_HEAD },
  { id: 'stances', title: 'Stances', start: 'STANCES' },
  { id: 'focus', title: 'Focus', start: 'FOCUS' },
  { id: 'shifting-into-stances', title: 'Shifting into Stances', start: 'SHIFTING INTO STANCES' },
  {
    id: 'dropping-out-of-stances',
    title: 'Dropping out of Stances',
    start: 'DROPPING OUT OF STANCES',
  },

  // Folio 12. The preamble only; `TIER 1` opens the stat cards, which are
  // `parseBeastforms`'s and would otherwise flow into this section.
  { id: 'beastform-options', title: 'Beastform Options', start: 'BEASTFORM OPTIONS' },
  { start: 'TIER 1', drop: true },

  // Folio 18, in the order the page is read: the sheet down column one, then
  // the two boxes down column two.
  { id: 'ranger-companion', title: 'Ranger Companion', start: 'RANGER COMPANION' },
  {
    id: 'working-with-your-companion',
    title: 'Working with Your Companion',
    start: 'WORKING WITH YOUR COMPANION',
  },
  {
    id: 'companion-taking-damage',
    title: 'Companion: Taking Damage as Stress',
    start: 'TAKING DAMAGE AS STRESS',
  },
  {
    id: 'leveling-up-your-companion',
    title: 'Leveling Up Your Companion',
    start: 'LEVELING UP YOUR COMPANION',
  },

  { start: 'CORE MECHANICS', drop: true },
  { id: 'flow-of-the-game', title: 'Flow of the Game', start: 'FLOW OF THE GAME' },
  {
    id: 'player-principles-and-best-practices',
    title: 'Player Principles & Best Practices',
    start: 'PLAYER PRINCIPLES & BEST PRACTICES',
  },
  { id: 'core-gameplay-loop', title: 'Core Gameplay Loop', start: 'Core Gameplay Loop' },
  { id: 'the-spotlight', title: 'The Spotlight', start: 'The Spotlight' },
  {
    id: 'turn-order-and-action-economy',
    title: 'Turn Order & Action Economy',
    start: 'Turn Order & Action Economy',
  },
  {
    id: 'making-moves-and-taking-action',
    title: 'Making Moves & Taking Action',
    start: 'MAKING MOVES & TAKING ACTION',
  },
  {
    id: 'gm-moves-and-adversary-actions',
    title: 'GM Moves and Adversary Actions',
    start: 'GM MOVES AND ADVERSARY ACTIONS',
  },
  { id: 'adversary-actions', title: 'Adversary Actions', start: 'ADVERSARY ACTIONS' },
  { id: 'special-rolls', title: 'Special Rolls', start: 'SPECIAL ROLLS' },
  { id: 'group-action-rolls', title: 'Group Action Rolls', start: 'GROUP ACTION ROLLS' },
  { id: 'tag-team-rolls', title: 'Tag Team Rolls', start: 'TAG TEAM ROLLS' },
  {
    id: 'advantage-and-disadvantage',
    title: 'Advantage & Disadvantage',
    start: 'ADVANTAGE & DISADVANTAGE',
  },
  { id: 'hope-and-fear', title: 'Hope & Fear', start: 'HOPE & FEAR' },
  { id: 'combat', title: 'Combat', start: 'COMBAT' },
  { id: 'stress', title: 'Stress', start: 'STRESS' },
  { id: 'attacking', title: 'Attacking', start: 'ATTACKING' },
  {
    id: 'maps-range-and-movement',
    title: 'Maps, Range, and Movement',
    start: 'MAPS, RANGE, AND MOVEMENT',
  },
  { id: 'conditions', title: 'Conditions', start: 'CONDITIONS' },
  { id: 'downtime', title: 'Downtime', start: 'DOWNTIME' },
  { id: 'death', title: 'Death', start: 'DEATH' },
  { id: 'additional-rules', title: 'Additional Rules', start: 'ADDITIONAL RULES' },
  { id: 'leveling-up', title: 'Leveling Up', start: 'LEVELING UP' },
  { id: 'multiclassing', title: 'Multiclassing', start: 'MULTICLASSING' },

  /*
   * The equipment chapter. Folios 44-61 / 55-83, and the only chapter in the
   * book whose prose shares its pages with four other parsers' records: the
   * weapon, armor, loot and consumable tables belong to `equipment.ts` and
   * `loot.ts`, and appear in the dataset as `weapons`, `armors`, `loot` and
   * `consumables`.
   *
   * ## What keeps the tables out is the book's own type size, not a rectangle
   *
   * `pageUnits` reads runs at 9pt and above; the SRD sets every table cell on
   * these folios at 8pt. So the weapon, armor, loot and consumable rows are
   * gone before this manifest sees a thing, and the eight sections below are
   * the chapter's prose alone. Counted on the folios themselves: SRD 2.0's 29
   * pages carry 4,016 lines of which 3,809 are under 9pt, SRD 1.0's 18 carry
   * 1,921 of which 1,737 are. Nine parts in ten of this chapter is table.
   *
   * ## The furniture that survives the size filter, and the two drops that end it
   *
   * What is left above 8pt on a table page is its heading furniture - `TIER 1
   * (LEVEL 1)`, `Physical Weapons`, `Magic Weapons` - a heading with nothing
   * under it, four to eight times over. Two `drop` specs cut those runs, and
   * both start one heading LATER than the obvious place, because the banner
   * itself carries a sentence of rules that the obvious drop would swallow:
   * `PRIMARY WEAPON TABLES` and `SECONDARY WEAPON TABLES` each open with the
   * sentence saying a player picks one Tier 1 weapon of that category at
   * character creation. Dropping from `TIER 1 (LEVEL 1)` keeps both sentences
   * and loses only `All magic weapons require a Spellcast trait`: a 9.3pt slab
   * italic printed under each magic-weapon table, four times in the chapter of
   * either book (folios 45, 47, 49, 51 / 56, 59, 62, 64), and already stated in
   * full by the `DAMAGE TYPE` paragraph of `weapons` above. SRD 2.0 prints a
   * fifth on folio 191, which is outside every island in this file.
   *
   * `Physical Weapons` and `Magic Weapons` never reach a spec: they fall inside
   * a drop's run, like every `TIER n` after the first.
   */
  { id: 'equipment', title: 'Equipment', start: 'EQUIPMENT' },
  { id: 'weapons', title: 'Weapons', start: 'WEAPONS' },
  { id: 'primary-weapon-tables', title: 'Primary Weapon Tables', start: 'PRIMARY WEAPON TABLES' },
  { start: 'TIER 1 (LEVEL 1)', drop: true },
  {
    id: 'secondary-weapon-tables',
    title: 'Secondary Weapon Tables',
    start: 'SECONDARY WEAPON TABLES',
  },
  { start: 'TIER 1 (LEVEL 1)', drop: true },
  /*
   * Mixed case, in both books, and it is the book's own setting rather than a
   * typo to normalise - the SRD sets ten of its 17.3pt heads that way, `The
   * Spotlight` and `Class Domains` among them, and two of those are already
   * matched in caseful form by the manifest above.
   *
   * Its `By Mark Thompson` credit is 9.3pt italic, so it is body text and stays
   * inside the section. That is where a credit belongs, and it is the reason
   * this section is not merged into `armor` or `weapons`: the wheelchair
   * ruleset is another author's contribution and the book names him on it.
   */
  { id: 'combat-wheelchair', title: 'Combat Wheelchair', start: 'Combat Wheelchair' },
  { id: 'armor', title: 'Armor', start: 'ARMOR' },
  { start: 'ARMOR TABLES', drop: true },
  { id: 'loot', title: 'Loot', start: 'LOOT' },
  { id: 'consumables', title: 'Consumables', start: ['Consumables', 'CONSUMABLES'] },

  { id: 'gold', title: 'Gold', start: 'GOLD' },

  { start: 'RUNNING AN ADVENTURE', drop: true },
  { id: 'running-an-adventure', title: 'Running an Adventure', start: 'INTRODUCTION' },
  { id: 'gm-guidance', title: 'GM Guidance', start: 'GM GUIDANCE' },
  { id: 'gm-principles', title: 'GM Principles', start: 'GM PRINCIPLES' },
  { id: 'gm-practices', title: 'GM Practices', start: 'GM PRACTICES' },
  { id: 'pitfalls-to-avoid', title: 'Pitfalls to Avoid', start: 'PITFALLS TO AVOID' },
  { id: 'core-gm-mechanics', title: 'Core GM Mechanics', start: 'CORE GM MECHANICS' },
  {
    id: 'guidance-on-action-rolls',
    title: 'Guidance on Action Rolls',
    start: 'GUIDANCE ON ACTION ROLLS',
  },
  { id: 'making-gm-moves', title: 'Making GM Moves', start: 'MAKING MOVES' },
  { id: 'using-fear', title: 'Using Fear', start: 'USING FEAR' },
  { id: 'difficulty-benchmarks', title: 'Difficulty Benchmarks', start: 'DIFFICULTY BENCHMARKS' },
  {
    id: 'giving-advantage-and-disadvantage',
    title: 'Giving Advantage and Disadvantage',
    start: 'GIVING ADVANTAGE AND DISADVANTAGE',
  },
  { id: 'adversary-action-rolls', title: 'Adversary Action Rolls', start: 'ADVERSARY ACTION ROLLS' },
  { id: 'countdowns', title: 'Countdowns', start: 'COUNTDOWNS' },
  {
    id: 'giving-out-gold-equipment-and-loot',
    title: 'Giving Out Gold, Equipment, and Loot',
    start: 'GIVING OUT GOLD, EQUIPMENT, AND LOOT',
  },
  { id: 'running-gm-npcs', title: 'Running GM NPCs', start: 'RUNNING GM NPCS' },
  { id: 'npc-feature-examples', title: 'NPC Feature Examples', start: 'NPC FEATURE EXAMPLES' },
  { id: 'optional-gm-mechanics', title: 'Optional GM Mechanics', start: 'OPTIONAL GM MECHANICS' },
  { start: 'ADVERSARIES AND ENVIRONMENTS', drop: true },
  { id: 'using-adversaries', title: 'Using Adversaries', start: 'USING ADVERSARIES' },
  {
    id: 'example-adversary-features',
    title: 'Example Adversary Features',
    start: 'EXAMPLE ADVERSARY FEATURES:',
  },
  {
    id: 'building-balanced-encounters',
    title: 'Building Balanced Encounters',
    start: 'BUILDING BALANCED ENCOUNTERS',
  },
  {
    id: 'adversary-stat-block-benchmarks',
    title: 'Adversary Stat Block Benchmarks',
    start: 'ADVERSARY STAT BLOCK BENCHMARKS',
  },
  { start: 'ADVERSARIES BY TIER', drop: true },

  { id: 'using-environments', title: 'Using Environments', start: 'USING ENVIRONMENTS' },
  { id: 'adapting-environments', title: 'Adapting Environments', start: 'ADAPTING ENVIRONMENTS' },

  {
    id: 'additional-gm-guidance',
    title: 'Additional GM Guidance',
    start: 'ADDITIONAL GM GUIDANCE',
  },
  { id: 'story-beats', title: 'Story Beats', start: 'STORY BEATS' },
  {
    id: 'preparing-combat-encounters',
    title: 'Preparing Combat Encounters',
    start: 'PREPARING COMBAT ENCOUNTERS',
  },
  { id: 'battles-and-narrative', title: 'Battles and Narrative', start: 'BATTLES AND NARRATIVE' },
  { id: 'session-rewards', title: 'Session Rewards', start: 'SESSION REWARDS' },
  { id: 'crafting-scenes', title: 'Crafting Scenes', start: 'CRAFTING SCENES' },
  { id: 'engaging-your-players', title: 'Engaging Your Players', start: 'ENGAGING YOUR PLAYERS' },
  { id: 'phased-battles', title: 'Phased Battles', start: 'PHASED BATTLES' },
  { id: 'using-downtime', title: 'Using Downtime', start: 'USING DOWNTIME' },

  {
    id: 'projects-during-downtime',
    title: 'Projects During Downtime',
    start: 'PROJECTS DURING DOWNTIME',
  },
  { id: 'extended-downtime', title: 'Extended Downtime', start: 'EXTENDED DOWNTIME' },
  { id: 'campaign-frames', title: 'Campaign Frames', start: 'CAMPAIGN FRAMES' },

  /*
   * The Witherwild campaign frame is read and dropped, not left unnamed.
   *
   * THE REASON IS LICENSING, NOT TECHNICAL, and that sentence is the point of
   * this one. Folio 1 of SRD 2.0 states that the document "including the
   * Witherwild Campaign Frame, is considered Public Game Content", and DPCGL
   * 2.0 §1.6 names SRD 2.0 as Public Game Content — so nothing here is beyond
   * this parser's reach and a reader who finds only a citation will conclude
   * the omission is a bug and try to "fix" it. It is not. The owner excluded
   * it, the grounds are the owner's to revisit, and no measurement changes it.
   *
   * Removed from the shipped dataset by the owner's decision of 2026-08-23
   * (`docs/handoff/DECISIONI-2026-08-23.md` §4), reaffirmed 2026-09-01 when
   * the licence question was reopened: eleven sections, 27,679
   * characters of body, 21.7% of the rules corpus. The pages stay inside
   * `RANGES` and this spec stays in the manifest so the removal is a stated
   * choice rather than a gap - a heading the parser cannot find still throws,
   * which is the property the manifest exists for.
   *
   * One `drop` covers all eleven because the frame is the last thing in the
   * stream and every unit after this heading falls into it. What bounds that
   * is not luck: `RANGES` ends at folio 118, so nothing past the frame is ever
   * read. Extend the range and this spec starts swallowing whatever follows.
   */
  { start: 'The Witherwild', drop: true },
];

// ---------------------------------------------------------------------------
// The reference tables
// ---------------------------------------------------------------------------

/** Which of the page's two columns a table sits in, or neither. */
type Region = 'left' | 'right' | 'full';

interface TableSpec {
  /**
   * The text of the table's own first row, as the book prints it, joined the
   * way `lineUnit` joins a band. This is the whole address: exactly one band
   * in the whole stream may carry it, in this table's region, which is a
   * tighter gate than a rectangle ever was - a box can land on the wrong page
   * and still be full of plausible runs, and on SRD 2.0 six of them did.
   */
  anchor: string;
  region: Region;
  cols: number;
  /** Rows the grid must yield, header rows included. */
  rows: number;
  /** Column whose presence in a band opens a new row; other bands wrap it. */
  anchorCol: number;
  /** Cells of the first row, to pin the box to the table it is meant for. */
  verify?: readonly string[];
  /** Leading rows that are the book's own header, and are replaced by it. */
  headerRows?: number;
  header?: readonly string[];
  /** `## ` line emitted above the table. */
  heading?: string;
  /** A list flowed into columns, not a table: read column by column. */
  list?: true;
}

/**
 * One trait's difficulty benchmarks: a roll column and three action columns,
 * under a trait name the book sets sideways down the left edge. The rotated
 * word is not a cell and is dropped by `cellX0`; see `findTable`.
 */
function trait(heading: string, head: readonly string[]): TableSpec {
  return {
    anchor: head.join(' '),
    region: 'full',
    cols: 4,
    rows: 7,
    anchorCol: 0,
    verify: head,
    headerRows: 1,
    header: ['Roll', ...head.slice(1).map((h) => h[0]!.toUpperCase() + h.slice(1))],
    heading,
  };
}

/**
 * The tables, by the row each one starts with. Column boundaries are still
 * found from the whitespace inside the table, so only the first row and the
 * shape have to be stated here.
 */
const TABLES: readonly TableSpec[] = [
  {
    anchor: 'Incidental A catch-up between PCs 0-1 Fear',
    region: 'left',
    cols: 3,
    rows: 5,
    anchorCol: 0,
    header: ['Scene', 'Examples', 'Fear to Spend'],
  },
  trait('Agility', ['roll', 'sprint', 'leap', 'Maneuver']),
  trait('Strength', ['roll', 'lift', 'smash', 'grapple']),
  trait('Finesse', ['roll', 'control', 'hide', 'tinker']),
  trait('Instinct', ['roll', 'perceive', 'sense', 'navigate']),
  trait('Presence', ['roll', 'charm', 'perform', 'deceive']),
  trait('Knowledge', ['roll', 'recall', 'analyze', 'comprehend']),
  {
    anchor: 'Roll Result Progress Consequence',
    region: 'left',
    cols: 3,
    rows: 7,
    anchorCol: 2,
    verify: ['Roll Result', 'Progress', 'Consequence'],
    headerRows: 2,
    header: ['Roll Result', 'Progress Advancement', 'Consequence Advancement'],
  },
  {
    anchor: 'Meals for a party of adventurers per 1 Handful',
    region: 'right',
    cols: 2,
    rows: 12,
    anchorCol: 1,
    header: ['Expense', 'Cost'],
  },
  {
    anchor: 'Acrobatics Hunt from Above Navigation',
    region: 'right',
    cols: 3,
    rows: 6,
    anchorCol: 0,
    list: true,
  },
  {
    anchor: 'Adversary Statistic Tier 1 Tier 2 Tier 3 Tier 4',
    region: 'full',
    cols: 5,
    rows: 5,
    anchorCol: 0,
    verify: ['Adversary Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    headerRows: 1,
    header: ['Adversary Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
  },
  {
    anchor: '1d12 Objective',
    region: 'right',
    cols: 2,
    rows: 13,
    anchorCol: 0,
    verify: ['1d12', 'Objective'],
    headerRows: 1,
    header: ['1d12', 'Objective'],
  },
  {
    anchor: 'Environment Statistic Tier 1 Tier 2 Tier 3 Tier 4',
    region: 'full',
    cols: 5,
    rows: 3,
    anchorCol: 0,
    verify: ['Environment Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    headerRows: 1,
    header: ['Environment Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
  },
];

/** A table, once the book has said where it is. */
interface FoundTable {
  spec: TableSpec;
  page: BookPage;
  /** The region's own bounds: what belongs to the table and not to the prose. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /**
   * Left edge of the cells, when the region reaches further left to catch
   * something that is not one: the trait benchmarks set their trait name
   * sideways, and a rotated word's band would otherwise be a row of its own.
   * Nothing in a table's first column starts a whole cell gutter to the left
   * of its own header row, so one gutter in front of that edge is the cut.
   */
  cellX0: number;
}

/**
 * Where a table is, from the row it starts with rather than from a rectangle.
 *
 * Its foot is the first band below the head that is either a heading or set in
 * a different size from the head. Both are needed and neither is enough: the
 * six trait tables are separated only by a heading, because a table and the
 * next table's header are the same 8pt face; the Knowledge table is separated
 * only by a size, because the two-column banner that follows it welds an
 * Eveleth line to a text-face one and stops reading as display.
 */
function findTable(spec: TableSpec, pages: readonly BookPage[], cutOf: (p: BookPage) => number): FoundTable {
  const hits: FoundTable[] = [];
  for (const page of pages) {
    const cut = cutOf(page);
    const x0 = spec.region === 'right' ? cut : -Infinity;
    const x1 = spec.region === 'left' ? cut : Infinity;
    const inRegion = localRuns(page).filter((r) => r.x >= x0 && r.x < x1);
    const at = bands(inRegion).findIndex((b) => lineUnit(b, 0, 0).text === spec.anchor);
    if (at < 0) continue;

    const head = bands(inRegion)[at]!;
    const y0 = Math.min(...head.map((r) => r.y));
    const face = Math.max(...head.map((r) => r.size));
    const cellX0 = Math.min(...head.map((r) => r.x)) - MIN_CELL_GUTTER;

    // The foot is read off the cells, not off the region: on folio 67 the
    // rotated word INSTINCT sits inside the Instinct table and is set 1.3pt
    // larger than it, so a region-wide scan would end the table on its own
    // second band.
    let y1 = Infinity;
    for (const band of bands(inRegion.filter((r) => r.x >= cellX0))) {
      const top = Math.min(...band.map((r) => r.y));
      if (top <= y0) continue;
      const size = Math.max(...band.map((r) => r.size));
      if (isHeadingBand(band) || Math.abs(size - face) > 0.5) {
        y1 = top;
        break;
      }
    }
    hits.push({ spec, page, x0, x1, y0, y1, cellX0 });
  }
  if (hits.length !== 1) {
    throw new ParseError(
      `the table row "${spec.anchor}" is printed ${hits.length} times, not once`,
      hits.map((h) => `folio ${h.page.folio}`).join(', ') || 'nowhere in the rules stream',
    );
  }
  return hits[0]!;
}

/** Display type at any size, or bold at 10pt and up: the test `markHeadings` uses. */
function isHeadingBand(band: readonly TextRun[]): boolean {
  const byFamily = new Map<string, number>();
  for (const r of band) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + r.text.length);
  const family = [...byFamily].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  if (family.startsWith('Eveleth')) return true;
  return band.every((r) => r.bold) && Math.max(...band.map((r) => r.size)) > 9.9;
}

/**
 * Pages that stack two independent multi-column regions, named by the banner
 * that opens the lower one. Everywhere else a page is one region and reads
 * left column then right column; on these the lower region would otherwise be
 * pulled up into the left column's stream.
 *
 * Named rather than measured in points, because the same four bands are 1 to
 * 2pt lower in SRD 1.0 than in SRD 2.0 and on a different page in two cases -
 * and because a page can carry a full-width whitespace break that is not one
 * of these, so a gap threshold would over-cut.
 */
const SPLIT_ABOVE: readonly string[] = [
  'DIFFICULTY BENCHMARKS',
  'roll sprint leap Maneuver',
  'USING ENVIRONMENTS',
  'ADAPTING ENVIRONMENTS',
  'BENCHMARK STATISTICS FOR ENVIRONMENTS BY TIER',
  /*
   * The two equipment pages that stack a full-width table under two columns of
   * prose. Both were measured on both books, and each one costs a sentence of
   * the book if the split is missing:
   *
   * - `Light Frame Models` (folio 54 / 70, y 466 / 464, alone on its band) is
   *   the label of a full-width table - its own header runs x 61-536 across a
   *   page whose gutter is near 294. Without the split it sorts into the left
   *   column's pool and is emitted before `EVASION`, three headings ahead of
   *   the paragraph it labels; the paragraph itself spans the gutter, so it
   *   survives in place and is left orphaned under `CHOOSING YOUR MODEL`.
   * - `ARMOR TABLES` (folio 56 / 72, y 255 / 253, alone on its band) is worse
   *   than untidy. The armor prose above it is two columns, and the right one
   *   carries `REDUCING INCOMING DAMAGE`; without the split that heading lands
   *   BETWEEN `TIER 2 (LEVELS 2-4)` and `TIER 3 (LEVELS 5-7)`, inside the run
   *   of table furniture the manifest below drops - so the drop would eat it.
   */
  'Light Frame Models',
  'ARMOR TABLES',
];
/** Points of whitespace that separate two cells of a table. */
const MIN_CELL_GUTTER = 6;
/**
 * Whitespace across the gutter, in points, below which a band is one line and
 * not two. The two populations do not overlap anywhere in these folios: a
 * full-width line leaves at most 9pt there, a genuine gutter at least 12.
 */
const MIN_COLUMN_GUTTER = 11;
/**
 * Leading, as a multiple of point size, above which a paragraph ends. The
 * book sets its 9.3pt body far tighter than its 12pt standfirsts, so one
 * ratio cannot serve both.
 */
const paragraphGap = (size: number): number => size * (size >= 11 ? 1.5 : 1.34);
/** Leading, as a multiple of point size, below which two headings are one. */
const HEADING_GAP = 1.7;
/** The book labels a step on its own line and names it on the next one. */
const STEP_LABEL = /^STEP\b/i;
/**
 * Bullet glyphs the book uses, plus the arrow of the tier list on folio 42.
 *
 * U+25E6 is SRD 2.0's second-level bullet and appears nowhere in SRD 1.0,
 * which set both levels with U+2022: the twelve lines it opens are the GM's
 * move lists on folios 86 and 87, and without it here they are read as the
 * continuation of the sentence above and welded into it.
 */
const BULLET = /^\s*[•‣▪●◦→]\s*/;
/**
 * The SRD is set with hyphenation off, so a line-final hyphen, slash or dash
 * is part of the word: "two-" + "handed", "(she/" + "her)".
 */
const NO_SPACE = /[-‐-―/]$/;

interface Unit {
  folio: number;
  /** Page column, 0 or 1. A spanning band is 0. */
  column: number;
  x: number;
  y: number;
  size: number;
  /** Eveleth: a section title or a banner, at any size. */
  display: boolean;
  /** Set across the gutter, so it belongs to no column. */
  spans: boolean;
  /** Every word set bold: a banner, or the book's "Notes:" label. */
  bold: boolean;
  heading: boolean;
  text: string;
  /** Rendered markdown, for a table unit. */
  table?: string;
}

export function parseRules(pages: BookPage[]): RulesSection[] {
  const entries = parseContents(pages);

  /*
   * An island that answers `null` is a chapter this book does not print. It
   * contributes no pages AND strikes its own headings from the sequence below;
   * every other heading is still demanded by name. The absence itself is
   * cross-examined inside `folios`, not here, because only that function knows
   * what the chapter cannot be printed without.
   */
  const absentStarts = new Set<string>();
  const islands = ISLANDS.flatMap((island) => {
    const range = island.folios(entries, pages);
    if (range === null) {
      if (island.provides === undefined) {
        throw new ParseError(`${island.what} is absent and declares no headings`, island.what);
      }
      for (const start of island.provides) absentStarts.add(start);
      return [];
    }
    const { from, to } = range;
    if (to < from) throw new ParseError(`${island.what} runs backwards`, `folios ${from}-${to}`);
    const inRange = pages
      .filter((p) => p.folio !== null && p.folio >= from && p.folio <= to)
      .sort((a, b) => a.index - b.index);
    if (inRange.length === 0) throw new ParseError(`no pages for ${island.what}`, `folios ${from}-${to}`);
    return [{ island, pages: inRange }];
  });
  const specs =
    absentStarts.size === 0
      ? SPECS
      : SPECS.filter((s) => !opensWith(s).some((t) => absentStarts.has(t)));
  const streamPages = islands.flatMap((i) => i.pages);

  const grid = gutterGrid(streamPages);
  const cutOf = (p: BookPage): number => grid[p.folio! % 2 === 0 ? 0 : 1]!;

  const boxes = new Map<BookPage, FoundTable[]>();
  for (const spec of TABLES) {
    const hit = findTable(spec, streamPages, cutOf);
    boxes.set(hit.page, [...(boxes.get(hit.page) ?? []), hit]);
  }

  const splitsUsed = new Set<string>();
  const stream: Unit[] = [];
  for (const { island, pages: inRange } of islands) {
    const units: Unit[] = [];
    for (const page of inRange) {
      units.push(...pageUnits(page, cutOf(page), boxes.get(page) ?? [], splitsUsed));
    }
    stream.push(...trimIsland(units, island));
  }
  for (const text of SPLIT_ABOVE) {
    if (!splitsUsed.has(text)) throw new ParseError('a region split anchor is not printed', text);
  }
  if (stream.length === 0) throw new ParseError('no rules pages found', ISLANDS.map((i) => i.what).join(', '));

  const out: RulesSection[] = [];
  let spec = 0;
  let current: Spec | null = null;
  let units: Unit[] = [];

  const close = (): void => {
    if (current !== null && current.drop !== true) out.push(section(current, units));
    units = [];
  };

  for (const unit of stream) {
    const next = specs[spec];
    if (next && unit.heading && opensWith(next).includes(unit.text)) {
      close();
      current = next;
      spec += 1;
      continue;
    }
    if (!current) throw new ParseError('rules text before the first section', unit.text);
    units.push(unit);
  }
  close();

  if (spec !== specs.length) {
    throw new ParseError('section heading never found', opensWith(specs[spec]!).join(' / '));
  }

  const seen = new Set<string>();
  for (const s of out) {
    if (seen.has(s.id)) throw new ParseError('duplicate rules section id', s.id);
    seen.add(s.id);
  }
  return out;
}

/**
 * Cut an island at the banners that open and close it.
 *
 * A stated banner must be there. That is the whole gate: SRD 2.0 sets the
 * Beastform preamble beside a druid subclass and the Companion sheet beside a
 * ranger one, so without this the class chapter's stat text flows into the
 * rules; with a silent fallback it would flow in whenever the banner moved.
 */
function trimIsland(units: Unit[], island: Island): Unit[] {
  let out = units;
  if (island.open !== undefined) {
    const at = out.findIndex((u) => u.text === island.open);
    if (at < 0) throw new ParseError(`${island.what} never opens`, island.open);
    out = out.slice(at);
  }
  if (island.close !== undefined) {
    const at = out.findIndex((u) => u.text === island.close);
    if (at < 0) throw new ParseError(`${island.what} never closes`, island.close);
    out = out.slice(0, at);
  }
  return out;
}

function section(spec: Spec & { id: string; title: string }, units: Unit[]): RulesSection {
  const id = slugify(spec.id);
  if (id !== spec.id) throw new ParseError('rules section id is not a slug', spec.id);
  const body = render(units);
  const folio = units[0]?.folio;
  if (body.length === 0 || folio === undefined) {
    throw new ParseError('rules section has no body', spec.title);
  }
  return { id, title: spec.title, body, sourcePage: folio };
}

// ---------------------------------------------------------------------------
// Page -> ordered units
// ---------------------------------------------------------------------------

function pageUnits(
  page: BookPage,
  cut: number,
  boxes: readonly FoundTable[],
  splitsUsed: Set<string>,
): Unit[] {
  const folio = page.folio!;
  const local = localRuns(page);
  const inBox = (r: TextRun): boolean =>
    boxes.some((b) => r.x >= b.x0 && r.x < b.x1 && r.y >= b.y0 && r.y < b.y1);

  // 8pt is the book's table face; every 8pt grid on these folios is either
  // parsed as a table below or belongs to another parser's dataset.
  const runs = local.filter((r) => r.size >= 9 && !inBox(r));

  const splits: number[] = [];
  for (const band of bands(local)) {
    const text = lineUnit(band, folio, 0).text;
    if (!SPLIT_ABOVE.includes(text)) continue;
    splitsUsed.add(text);
    splits.push(Math.min(...band.map((r) => r.y)) - 1);
  }
  splits.sort((a, b) => a - b);

  const tables: Unit[] = boxes.map((b) => ({
    folio,
    column: b.x0 >= cut ? 1 : 0,
    x: b.cellX0,
    y: b.y0,
    size: 0,
    display: false,
    spans: false,
    bold: false,
    heading: false,
    text: '',
    table: table(b),
  }));

  const ordered: Unit[] = [];
  const bounds = [-Infinity, ...splits, Infinity];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i]!;
    const hi = bounds[i + 1]!;
    const region = runs.filter((r) => r.y >= lo && r.y < hi);
    const here = tables.filter((t) => t.y >= lo && t.y < hi);
    ordered.push(...orderRegion(bands(region), here, cut, folio));
  }
  return mergeHeadings(indentX(markHeadings(ordered)));
}

/** Group runs into visual lines by their mid-height, as `textLayout` does. */
function bands(runs: TextRun[]): TextRun[][] {
  if (runs.length === 0) return [];
  const tol = Math.max(2, median(runs.map((r) => r.h)) * 0.6);
  const sorted = [...runs].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const out: TextRun[][] = [];
  let group: TextRun[] = [];
  let anchor = Number.NaN;
  for (const r of sorted) {
    const mid = r.y + r.h / 2;
    if (group.length === 0 || Math.abs(mid - anchor) <= tol) {
      if (group.length === 0) anchor = mid;
      group.push(r);
    } else {
      out.push(group);
      group = [r];
      anchor = mid;
    }
  }
  if (group.length > 0) out.push(group);
  return out.sort((a, b) => Math.min(...a.map((r) => r.y)) - Math.min(...b.map((r) => r.y)));
}

/**
 * Left column, then right column - except that a band whose words run
 * uninterrupted across the gutter is genuinely full width and acts as a
 * barrier, flushing what came before it.
 *
 * ## Why each column is banded a second time, on its own
 *
 * A page-wide band is the wrong unit for a line. The two columns are not set
 * on the same grid - on SRD 2.0 folio 50 the right column's baselines run
 * 6.5pt below the left's - so a page-wide band can weld one column's line to
 * the OTHER column's neighbour and leave part of the first line behind. It
 * did: `bands`'s tolerance is 0.6 of the median word-box height, and the same
 * 9.3pt face measures 8.91pt tall in SRD 1.0's extraction and 10.87pt in SRD
 * 2.0's, which lifts the tolerance from 5.35 to 6.52 and puts that 6.5pt
 * offset inside it. "Hit Points (HP) represent a character's ability to
 * withstand physical injury" came out as "represent a character's ability to
 * withstand Hit Points (HP) physical injury".
 *
 * So the page-wide band is kept for the one thing it is right about - whether
 * a line runs across the gutter - and everything that does not is pooled by
 * column and banded again inside it, where one grid governs and the
 * tolerance cannot reach a neighbour.
 */
function orderRegion(
  regionBands: TextRun[][],
  tables: Unit[],
  cut: number,
  folio: number,
): Unit[] {
  const out: Unit[] = [];
  const pools: TextRun[][][] = [[], []];
  const pending: Unit[][] = [[], []];
  const flush = (): void => {
    for (let c = 0; c < 2; c++) {
      const lines = bands(pools[c]!.flat()).map((band) => lineUnit(band, folio, c));
      out.push(...[...lines, ...pending[c]!].sort((a, b) => a.y - b.y));
      pools[c] = [];
      pending[c] = [];
    }
  };

  const items: Array<{ y: number; unit?: Unit; band?: TextRun[] }> = [
    ...regionBands.map((band) => ({ y: Math.min(...band.map((r) => r.y)), band })),
    ...tables.map((unit) => ({ y: unit.y, unit })),
  ].sort((a, b) => a.y - b.y);

  for (const item of items) {
    if (item.unit) {
      pending[item.unit.column]!.push(item.unit);
      continue;
    }
    const band = item.band!;
    const left = band.filter((r) => r.x + r.w / 2 < cut);
    const right = band.filter((r) => r.x + r.w / 2 >= cut);
    const spans =
      left.length > 0 &&
      right.length > 0 &&
      Math.min(...right.map((r) => r.x)) - Math.max(...left.map((r) => r.x + r.w)) <
        MIN_COLUMN_GUTTER;
    if (spans) {
      flush();
      out.push({ ...lineUnit(band, folio, 0), spans: true });
      continue;
    }
    if (left.length > 0) pools[0]!.push(left);
    if (right.length > 0) pools[1]!.push(right);
  }
  flush();
  return out;
}

function lineUnit(runs: TextRun[], folio: number, column: number): Unit {
  const ordered = [...runs].sort((a, b) => a.x - b.x);
  let text = '';
  let prevEnd = Number.NaN;
  for (const r of ordered) {
    if (text.length > 0) {
      text += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
    }
    text += r.text;
    prevEnd = r.x + r.w;
  }
  const byFamily = new Map<string, number>();
  for (const r of ordered) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + r.text.length);
  const family = [...byFamily].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return {
    folio,
    column,
    x: Math.min(...ordered.map((r) => r.x)),
    y: Math.min(...ordered.map((r) => r.y)),
    size: Math.max(...ordered.map((r) => r.size)),
    display: family.startsWith('Eveleth'),
    spans: false,
    bold: ordered.every((r) => r.bold),
    heading: false,
    text: normalizeText(text),
  };
}

/**
 * A heading is display type at any size, or bold at 10pt and up. The book
 * also sets a few 9.3pt bold labels ("Optional Rule: Massive Damage", each
 * character-creation step, "Notes:"); those only count when extra leading
 * sets them off, because the same face turns up mid-paragraph on folio 113.
 */
function markHeadings(units: Unit[]): Unit[] {
  let prev: Unit | null = null;
  for (const u of units) {
    if (u.table) {
      prev = null;
      continue;
    }
    const bold = u.bold && !BULLET.test(u.text);
    const apart =
      prev === null || prev.column !== u.column || u.y - prev.y > paragraphGap(u.size);
    u.heading = u.display || (bold && (u.size > 9.9 || apart));
    prev = u;
  }
  return units;
}

/**
 * Restate x as an indent from the column's own left edge, so the renderer can
 * tell an indented block from body text. Headings and full-width lines set
 * their own margins and never define the edge.
 */
function indentX(units: Unit[]): Unit[] {
  const edge = new Map<number, number>();
  for (const u of units) {
    if (u.heading || u.spans || u.table !== undefined) continue;
    edge.set(u.column, Math.min(edge.get(u.column) ?? Infinity, u.x));
  }
  for (const u of units) u.x -= edge.get(u.column) ?? u.x;
  return units;
}

/** Two-line headings: the book breaks long ones, and labels its steps. */
function mergeHeadings(units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) {
    const prev = out[out.length - 1];
    const joinable =
      prev !== undefined &&
      prev.heading &&
      u.heading &&
      prev.column === u.column &&
      prev.folio === u.folio &&
      u.y - prev.y < prev.size * HEADING_GAP &&
      (Math.abs(prev.size - u.size) < 0.5 || STEP_LABEL.test(prev.text));
    if (joinable) {
      prev.text = `${prev.text} ${u.text}`;
      continue;
    }
    out.push(u);
  }
  return out;
}
// ---------------------------------------------------------------------------
// Units -> markdown
// ---------------------------------------------------------------------------

interface Para {
  lines: Unit[];
  indented: boolean;
  /** Opened with a bullet glyph, rather than by indentation alone. */
  glyph: boolean;
  bullet: boolean;
}

const ENDS_SENTENCE = /[.!?:;)"'’”]$/;

function render(units: Unit[]): string {
  const blocks: Array<{ text: string } | { para: Para }> = [];
  let para: Para | null = null;

  for (const u of units) {
    if (u.table !== undefined) {
      para = null;
      blocks.push({ text: u.table });
      continue;
    }
    if (u.heading) {
      para = null;
      blocks.push({ text: `## ${u.text}` });
      continue;
    }
    const prev = para?.lines[para.lines.length - 1];
    const bullet = BULLET.test(u.text);
    const broken =
      prev === undefined ||
      bullet ||
      (prev.column === u.column && prev.folio === u.folio
        ? u.y - prev.y > paragraphGap(u.size)
        : // Prose runs on into the next column when it was cut mid-sentence
          // and picks up at the same indent. A list item never does.
          para!.glyph || ENDS_SENTENCE.test(prev.text) || Math.abs(prev.x - u.x) > 3);
    if (broken) {
      para = { lines: [], indented: u.x > 3, glyph: bullet, bullet };
      blocks.push({ para });
    }
    para!.lines.push(u);
  }

  // An indented paragraph is a list item only where the book stacks several
  // of them; a lone one is a note or an example.
  const paras = blocks.flatMap((b) => ('para' in b ? [b.para] : [null]));
  const listy = (p: Para | null | undefined): boolean => p?.indented === true && !p.glyph;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    if (listy(p) && (listy(paras[i - 1]) || listy(paras[i + 1]))) p!.bullet = true;
  }

  const rendered = blocks
    .map((b) => ({
      bullet: 'para' in b && b.para.bullet,
      text: 'text' in b ? b.text : paragraph(b.para),
    }))
    .filter((b) => b.text.length > 0);

  let body = '';
  for (const [i, b] of rendered.entries()) {
    if (i > 0) body += b.bullet && rendered[i - 1]!.bullet ? '\n' : '\n\n';
    body += b.text;
  }
  return body;
}

function paragraph(para: Para): string {
  let text = '';
  for (const line of para.lines) {
    if (text.length > 0 && !NO_SPACE.test(text)) text += ' ';
    text += line.text;
  }
  text = text.replace(/\s+/g, ' ').trim();
  return para.bullet ? `- ${text.replace(BULLET, '')}` : text;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function table(found: FoundTable): string {
  const spec = found.spec;
  const where = `folio ${found.page.folio}`;
  const runs = localRuns(found.page).filter(
    (r) => r.x >= found.cellX0 && r.x < found.x1 && r.y >= found.y0 && r.y < found.y1,
  );
  if (runs.length === 0) throw new ParseError('table is empty', where);

  const cuts = cellCuts(runs);
  if (cuts.length + 1 !== spec.cols) {
    throw new ParseError(
      `${where} table: expected ${spec.cols} columns, found ${cuts.length + 1}`,
      cuts.map((c) => c.toFixed(0)).join(', '),
    );
  }

  const rows: string[][] = [];
  for (const band of bands(runs)) {
    const cells: TextRun[][] = Array.from({ length: spec.cols }, () => []);
    for (const r of band) {
      let i = 0;
      while (i < cuts.length && r.x + r.w / 2 >= cuts[i]!) i++;
      cells[i]!.push(r);
    }
    const text = cells.map((cell) => (cell.length === 0 ? '' : lineUnit(cell, 0, 0).text));
    const last = rows[rows.length - 1];
    if (text[spec.anchorCol]!.length > 0 || last === undefined) rows.push(text);
    else last.forEach((cell, i) => (last[i] = join(cell, text[i]!)));
  }
  if (rows.length !== spec.rows) {
    throw new ParseError(
      `${where} table: expected ${spec.rows} rows, found ${rows.length}`,
      rows.map((r) => r[spec.anchorCol]).join(' / '),
    );
  }
  if (spec.verify && rows[0]!.join('|').toLowerCase() !== spec.verify.join('|').toLowerCase()) {
    throw new ParseError(`${where} table: unexpected header`, rows[0]!.join(' | '));
  }

  const body = rows.slice(spec.headerRows ?? 0);
  const heading = spec.heading === undefined ? '' : `## ${spec.heading}\n\n`;

  if (spec.list) {
    const items: string[] = [];
    for (let c = 0; c < spec.cols; c++) {
      for (const row of body) if (row[c]!.length > 0) items.push(`- ${row[c]!}`);
    }
    return heading + items.join('\n');
  }

  const header = spec.header!;
  return (
    heading +
    [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n')
  );
}

/** Join a wrapped cell's lines, with the same hyphen rule the prose uses. */
const join = (a: string, b: string): string =>
  a.length === 0 ? b : b.length === 0 ? a : NO_SPACE.test(a) ? `${a}${b}` : `${a} ${b}`;

/** Cell boundaries, from the whitespace columns inside the table's box. */
function cellCuts(runs: TextRun[]): number[] {
  const x0 = Math.floor(Math.min(...runs.map((r) => r.x)));
  const x1 = Math.ceil(Math.max(...runs.map((r) => r.x + r.w)));
  const filled = new Uint8Array(x1 - x0 + 1);
  for (const r of runs) {
    filled.fill(1, Math.max(0, Math.floor(r.x - x0)), Math.min(filled.length, Math.ceil(r.x + r.w - x0) + 1));
  }
  const cuts: number[] = [];
  let gap = 0;
  for (let i = 0; i < filled.length; i++) {
    if (filled[i]) {
      if (gap >= MIN_CELL_GUTTER) cuts.push(x0 + i - gap / 2);
      gap = 0;
    } else gap++;
  }
  return cuts;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length === 0 ? 0 : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
