/**
 * Weapons, the Combat Wheelchair and armor.
 *
 * These are the only pages whose meaning lives entirely in the geometry. A cell
 * wraps onto its own line, so the de-columnised `Line` stream splices unrelated
 * cells together ("Improved Spear Finesse Very Close", "Shortsword Melee
 * range"). Everything below therefore works from `page.runs`: columns come from
 * the x of the printed header words, rows from the y of whichever column that
 * table sets one line per row in - the second for a weapon table, the first for
 * an armor one. See `Shape` for why that is no longer the same column for both.
 *
 * ## Where the pages come from
 *
 * The four folio pairs this used to carry - `PRIMARY_FOLIOS = [45, 51]` and its
 * three siblings - are right for SRD 1.0 and point into *Transformations* on
 * SRD 2.0. The three outer ranges are read off the book's own contents page
 * instead (`Weapons`..`Combat Wheelchair`, `Combat Wheelchair`..`Armor`,
 * `Armor`..`Loot`), which both books print.
 *
 * The primary/secondary split has NO contents entry in either book, so it is
 * taken from what the page prints: a 12pt `PRIMARY WEAPON TABLES` /
 * `SECONDARY WEAPON TABLES` banner, measured on SRD 1.0 folios 45 and 52 and on
 * SRD 2.0 folios 56 and 66.
 *
 * ## Why a table's tier is carried across the page break
 *
 * SRD 1.0 reprints the tier banner at the top of every continuation page, so
 * "the last TIER banner above this header, on this page" was enough. SRD 2.0
 * does not: folios 58, 61 and 65 carry a table header at the very top of the
 * page and no banner at all, because the table began two pages earlier. So the
 * banners are read as a stream in reading order and the tier, the slot and the
 * Physical/Magic category are state that survives a page break, rather than
 * something looked up per page. On SRD 1.0 that state is reset by the reprinted
 * banner on every page, which is why the output is unchanged.
 *
 * ## Two things a page may do that used to be impossible
 *
 * - **Open with rows and no header.** SRD 2.0 folio 73 prints ten more tier-2
 *   armors above its TIER 3 banner; the tier-2 header is on folio 72. Runs
 *   above the first header on a page are read as a continuation of the table
 *   that was left open, using the column bounds of that page's own first
 *   header - the two tables on one page share the page's measure, and the
 *   previous page's bounds do not, because the inner margin flips with the
 *   page's parity.
 * - **Carry no table at all.** Both books open Weapons on a prose page (SRD 1.0
 *   folio 44, SRD 2.0 folio 55). That page is skipped rather than thrown on,
 *   but ONLY when nothing was left open by the previous page AND the page
 *   carries no run in the small display face the header rows are set in.
 *   Measured: those two prose pages have zero such runs, while every page
 *   carrying a table has at least six. So a page whose header row changed shape
 *   still stops the build, which is the property the old unconditional throw
 *   was there for: silently yielding no rows hides a whole page of equipment.
 *
 * ## The optional-module tables, and why they are NOT read as a folio range
 *
 * SRD 2.0's `Supplemental Campaign Mechanics` chapter (folios 190-205) prints
 * equipment tables in three of its eleven sub-chapters. They are not
 * contiguous, and - this is the whole difficulty - the pages BETWEEN them carry
 * tables of other kinds set in the very same header face: the Feasts flavor
 * guides on folios 193-194, the Tech scrap and parts tables on folio 196. A
 * folio range over the chapter therefore meets the "no table on this folio"
 * throw above on nine pages, and the only way to survive it would be to weaken
 * the throw - which is exactly the relaxation that already cost this file a
 * silent zero once.
 *
 * So the pages are selected rather than ranged, by a property the book prints:
 *
 *   A page carries module equipment when it prints an equipment table header -
 *   a `Name`-led row in the table face, matching one of the shapes this file
 *   reads - and lies outside the three main equipment ranges.
 *
 * Measured, over every folio of both books: SRD 1.0 yields NOTHING (it has no
 * such chapter), and SRD 2.0 yields exactly folios 191, 192, 197 and 201. The
 * Feasts and Tech tables are excluded because their headers do not begin with
 * `Name` (`maximum hit points ...`, `result 1 2 3 ...`, `NAME FLAVOR PROFILE
 * FEATURE` - the last one in capitals, which is a different string).
 *
 * Consecutive selected folios are one run, and a run's module is the contents
 * entry that starts it. That is what attributes folio 192 correctly: its
 * Secondary Weapons and Armor tables are Everyday Hero's, printed above the
 * `Feasts` banner on the folio the contents page gives to Feasts. A run may
 * not reach past the next contents entry, which is the gate on that overlap.
 *
 * ## Two things these tables do that the main chapter never does
 *
 * - **One page, two shapes.** Folio 192 prints a weapon table and an armor
 *   table; folio 201 prints two weapon tables and an armor table. In the main
 *   chapter the two shapes are in different folio ranges and never met. So a
 *   reader is given the shapes it accepts and each band is tagged with the one
 *   it matched; a header matching NONE of them still throws, which is the check
 *   the single-shape comparison was making.
 * - **One row, four tiers.** Western and Monster Hunting have no room for four
 *   tier tables, so they print the ladder inside the cell: `Tier 1: d8+1 phy
 *   Tier 2: d8+4 phy Tier 3: d8+7 phy Tier 4: d8+10 phy`, and the armor the
 *   same in both Base Thresholds and Base Score. That is the same fact the main
 *   chapter states as four records - the ladders match, +3 a tier for primary
 *   weapons and +2 for secondary - printed in less space, so it becomes four
 *   records here too. See `STATLINE_TIER` for the one value in this file the
 *   book does not print.
 */
import { slugify } from '../slugify.ts';
import type { BookPage, Line, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import {
  RANGES,
  TRAITS,
  type Armor,
  type DamageKind,
  type Range,
  type Tier,
  type Trait,
  type Weapon,
} from '../types.ts';
import { ParseError, joinLines, normalizeText, pagesInFolios } from './util.ts';
import { folioOf, parseContents, rangeBetween, type ChapterEntry } from './contents.ts';

/** Contents entries, oldest book's wording first. */
const WEAPONS_SECTION = ['Weapons'] as const;
const WHEELCHAIR_SECTION = ['Combat Wheelchair'] as const;
const ARMOR_SECTION = ['Armor'] as const;
/** SRD 1.0 prints `Loot`; SRD 2.0 renamed it `Loot & Items`. */
const AFTER_ARMOR = ['Loot', 'Loot & Items'] as const;

/**
 * A table shape this file can read: the header labels as printed, and which
 * column's baselines are the rows.
 *
 * ## Why the anchor is per shape and not the constant 1
 *
 * "The second column never wraps" was measured, was true of every table in both
 * books, and stopped being true inside this wave. Monster Hunting armor prints
 * its whole tier ladder in Base Thresholds - four lines where the Name has one
 * - so anchoring an armor table on column 1 cuts three armors into twelve rows,
 * eleven of which have no name. Anchoring it on the Name instead gives 3.
 *
 * Measured over every armor band in both books before it was changed: the Name
 * column and the Thresholds column carry the SAME number of lines everywhere
 * except that one table - 4/10/10/10 in SRD 1.0, 8/11/20/20/4 in SRD 2.0 - so
 * the armor anchor moves without moving any armor either book already shipped.
 *
 * Weapons keep column 1. Their Name wraps freely ("Sharpened Rake", "Firework
 * Launcher", "Repeating Crossbow") while the Trait is one word, so for THAT
 * shape the old rule is still the right one. Which cell never wraps is a fact
 * about a table, which is why it now lives beside the table's columns.
 */
interface Shape {
  columns: readonly string[];
  /** Index of the column whose baselines are the row anchors. */
  anchor: number;
}

const WEAPON_TABLE: Shape = {
  columns: ['Name', 'Trait', 'Range', 'Damage', 'Burden', 'Feature'],
  anchor: 1,
};
const WHEELCHAIR_TABLE: Shape = {
  columns: ['Name', 'Tier', 'Trait', 'Range', 'Damage', 'Burden', 'Feature'],
  anchor: 1,
};
const ARMOR_TABLE: Shape = {
  columns: ['Name', 'Thresholds', 'Score', 'Feature'],
  anchor: 0,
};

/** The banners the tables are filed under, none of which the contents lists. */
const SLOT_BANNER = /^(PRIMARY|SECONDARY) WEAPON TABLES$/;
const TIER_BANNER = /^TIER (\d)\b/;
const CATEGORY_BANNER = /^(Physical|Magic) Weapons$/;
const FRAME_BANNER = /^(Light|Heavy|Arcane) Frame Models$/;

/**
 * The banner over a module weapon table, which names the slot and sometimes
 * the category. All four wordings SRD 2.0 prints, measured off the pages:
 * `Primary Physical Weapons` and `Primary Magic Weapons` (folio 191),
 * `Secondary Weapons` (folios 192, 197, 201), `Primary Weapons` (folios 197,
 * 201). It is deliberately NOT `SLOT_BANNER` or `CATEGORY_BANNER`: the main
 * chapter prints `PRIMARY WEAPON TABLES` in capitals over a `Physical Weapons`
 * sub-banner, two lines where this is one, and folding the two spellings
 * together would mean a parser deciding the books say the same thing.
 */
const MODULE_WEAPON_BANNER = /^(Primary|Secondary)(?: (Physical|Magic))? Weapons$/;

/**
 * A cell that carries the whole tier ladder: `Tier 1: d8+1 phy Tier 2: ...`.
 *
 * Anchored, because a Feature cell may well say "Tier 1" in a sentence and must
 * not be mistaken for a statline. Only the first token of the cell counts.
 */
const TIERED_CELL = /^Tier \d:/;

/**
 * A cell's first line sits within ~1pt of its row anchor; rows are >=13pt apart.
 *
 * Was "~0.6pt above", which is what a cell does relative to the second column.
 * The armor tables anchor on the first, where the other cells sit ~0.1pt BELOW
 * the name - SRD 2.0 folio 201, Coffinwood Armor at y 544.6 against its
 * thresholds at 544.7. Both directions are inside this tolerance and always
 * were; only the sentence was one-sided.
 */
const ROW_TOL = 5;
/** Body runs start ~1.7pt left of their header word; columns are >40pt apart. */
const COL_TOL = 5;
/** Two runs this close in y are on the same visual line. */
const LINE_TOL = 3;
/**
 * Point size at or above which a LINE is one of the banners the state machines
 * read - the tier, slot, category, frame and module banners.
 *
 * It used to end a table as well ("never table content"), and that half was
 * wrong: SRD 2.0 folio 197 sets an ordinary 9.3pt paragraph directly under a
 * table with no banner between, and 9.3 is under this floor. Where a table
 * stops is `bodyBottom`, which asks the table's own header instead. So this is
 * now "big enough to be a banner", and NOT "small enough to be a row" - the two
 * had been one number and the book prints something between them.
 */
const BANNER_SIZE = 10;

/** An em dash is how the SRD prints "no feature". */
const NONE = '—';

interface Row {
  cells: string[];
  /** For ParseError context. */
  where: string;
}

/**
 * One run of table rows, with everything the book printed since the previous
 * one. A band is usually a table; it is also the headerless remainder of a
 * table at the top of the next page.
 */
interface Band {
  folio: number;
  rows: Row[];
  /** Banner lines between the previous band and this one, in reading order. */
  banners: Line[];
  /** The header shape whose column bounds cut these rows. */
  shape: Shape;
}

function joinRuns(runs: readonly TextRun[]): string {
  let text = '';
  let prevEnd = Number.NaN;
  for (const r of runs) {
    if (text.length > 0 && (r.x - prevEnd) / Math.max(r.h, 1) >= WORD_JOIN_RATIO) text += ' ';
    text += r.text;
    prevEnd = r.x + r.w;
  }
  return text;
}

/** Runs grouped into visual lines, top to bottom, each ordered left to right. */
function byLine(runs: readonly TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [];
  for (const r of [...runs].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.y - last[0]!.y) <= LINE_TOL) last.push(r);
    else lines.push([r]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}

const cellText = (runs: readonly TextRun[]): string =>
  normalizeText(joinLines(byLine(runs).map(joinRuns)));

/** The face and size the header row of every one of these tables is set in. */
const isTableType = (r: TextRun): boolean =>
  r.family.startsWith('Eveleth') && r.size < BANNER_SIZE;

/**
 * The header rows on a page.
 *
 * Armor sets its header over two lines ("Base" / "Base" above "Name
 * Thresholds Score Feature"); only the line carrying "Name" defines the grid,
 * and the spill line above it is left out of the body by construction.
 */
function tableHeadings(page: BookPage): TextRun[][] {
  return byLine(page.runs.filter(isTableType)).filter((l) => l[0]!.text === 'Name');
}

/** Banner-sized lines in a y interval, in reading order. */
function bannersBetween(page: BookPage, after: number, before: number): Line[] {
  return page.lines
    .filter((l) => l.size >= BANNER_SIZE && l.y > after && l.y < before)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Rows in a y interval, cut into `columns` by `bounds`.
 *
 * Returns no rows rather than throwing when the interval holds none; whether
 * that is a defect depends on whether a header promised any, which is the
 * caller's business.
 */
function gridRows(
  page: BookPage,
  shape: Shape,
  bounds: readonly number[],
  after: number,
  before: number,
): Row[] {
  const folio = page.folio!;
  const body = page.runs.filter((r) => r.y > after && r.y < before);
  const columnOf = (r: TextRun): number => {
    const mid = r.x + r.w / 2;
    let c = 0;
    for (let k = 1; k < bounds.length; k++) if (mid >= bounds[k]!) c = k;
    return c;
  };

  // The anchor column has one line per row, so its baselines ARE the rows.
  const anchors: number[] = [];
  for (const r of body.filter((r) => columnOf(r) === shape.anchor).sort((a, b) => a.y - b.y)) {
    if (anchors.length === 0 || r.y - anchors[anchors.length - 1]! > LINE_TOL) anchors.push(r.y);
  }
  if (anchors.length === 0) return [];

  const grid: TextRun[][][] = anchors.map(() => shape.columns.map(() => []));
  for (const r of body) {
    let row = -1;
    for (let k = 0; k < anchors.length; k++) if (r.y >= anchors[k]! - ROW_TOL) row = k;
    if (row < 0) {
      throw new ParseError(`run above the first row on folio ${folio}`, `${r.text} @ y=${r.y}`);
    }
    grid[row]![columnOf(r)]!.push(r);
  }

  return grid.map((cells) => {
    const text = cells.map(cellText);
    return { cells: text, where: `folio ${folio}: ${text.join(' | ')}` };
  });
}

/**
 * Where a table's rows stop: the first thing below `headerY` that the book sets
 * LARGER than the table's own header, or `Infinity` when there is none.
 *
 * Not "the next banner", which is what this said while `BANNER_SIZE` was the
 * only threshold in the file. On SRD 2.0 folio 197 the Western secondary weapon
 * table is followed, with no banner between, by an ordinary 9.3pt paragraph
 * offering Dynamite - below the 10pt banner floor and therefore invisible to
 * the old rule, which swallowed all four of its lines into the Small Revolver's
 * cells. The tables are set at 8pt in both books and everything else on their
 * pages is bigger, so the table's own header size is the honest floor.
 *
 * Measured before it was changed: over all 46 bands the two books' main
 * equipment ranges produce, the runs inside a band are 3925 + 7099 of
 * `8.0 QuestaSans` and nothing else, and moving this floor from 10 to the
 * header's own 8 moves ZERO of those 46 bottoms.
 */
function bodyBottom(page: BookPage, heading: TextRun[]): number {
  const headerY = heading[0]!.y;
  const headerSize = heading[0]!.size;
  return page.runs
    .filter((r) => r.size > headerSize && r.y > headerY + LINE_TOL)
    .reduce((min, r) => Math.min(min, r.y), Infinity);
}

/**
 * The rows above the first header on a page: the tail of a table that began on
 * an earlier page and was not given a fresh header here.
 *
 * The region ends at the topmost thing above that header set larger than it -
 * on SRD 2.0 folio 73 the TIER 3 banner - or at the header itself when there is
 * none.
 */
function continuedRows(page: BookPage, shape: Shape, heading: TextRun[]): Row[] {
  const headerY = heading[0]!.y;
  const headerSize = heading[0]!.size;
  let bottom = headerY;
  for (const r of page.runs) {
    if (r.size > headerSize && r.y < headerY - LINE_TOL) bottom = Math.min(bottom, r.y);
  }
  return gridRows(
    page,
    shape,
    heading.map((r) => r.x - COL_TOL),
    -Infinity,
    bottom - LINE_TOL,
  );
}

/**
 * The shape a header row matches, or `null` when it matches none of them.
 *
 * A LIST of shapes, because folio 192 prints a weapon table and an armor table
 * on one page and folio 201 prints three tables in two shapes. Given one shape
 * this is exactly the equality the single-shape reader used to make, which is
 * why the main chapter's behaviour is unchanged: it passes one.
 */
function shapeOf(heading: TextRun[], shapes: readonly Shape[]): Shape | null {
  const labels = heading.map((r) => r.text);
  return (
    shapes.find(
      (s) => s.columns.length === labels.length && labels.every((l, k) => l === s.columns[k]),
    ) ?? null
  );
}

/**
 * The bands one page prints, with the banners that lead each of them.
 *
 * `open` is the shape of a table left running by an earlier page, or `null`.
 * `pending` is the banners seen since the last band anywhere; what this page
 * prints after its last table comes back out to lead the next page's first.
 */
function pageBands(
  page: BookPage,
  shapes: readonly Shape[],
  open: Shape | null,
  pending: readonly Line[],
): { bands: Band[]; pending: Line[] } {
  const folio = page.folio!;
  const headings = tableHeadings(page);
  const matched = headings.map((h) => {
    const s = shapeOf(h, shapes);
    if (s === null) {
      throw new ParseError(
        `unexpected table header on folio ${folio}`,
        h.map((r) => r.text).join(' | '),
      );
    }
    return s;
  });

  const bands: Band[] = [];
  let banners = [...pending];

  if (open !== null) {
    // No banner can be above this block: the block stops at the first one.
    const rows = continuedRows(page, matched[0]!, headings[0]!);
    if (rows.length > 0) {
      if (matched[0] !== open) {
        throw new ParseError(
          `folio ${folio} opens with the tail of a table under a header of another shape`,
          `${open.columns.join('/')} was left open; this page starts ${matched[0]!.columns.join('/')}`,
        );
      }
      bands.push({ folio, rows, banners, shape: open });
      banners = [];
    }
  }

  let prevY = -Infinity;
  for (const [i, heading] of headings.entries()) {
    const shape = matched[i]!;
    const headerY = heading[0]!.y;
    banners.push(...bannersBetween(page, prevY, headerY));

    // A table runs until the next header or the next larger type, whichever is first.
    const bottom = Math.min(headings[i + 1]?.[0]!.y ?? Infinity, bodyBottom(page, heading), page.height);

    const rows = gridRows(
      page,
      shape,
      heading.map((r) => r.x - COL_TOL),
      headerY + LINE_TOL,
      bottom - LINE_TOL,
    );
    if (rows.length === 0) {
      throw new ParseError(
        `no rows under the table header on folio ${folio}`,
        heading.map((r) => r.text).join(' | '),
      );
    }
    bands.push({ folio, rows, banners, shape });
    banners = [];
    prevY = headerY;
  }
  banners.push(...bannersBetween(page, prevY, Infinity));
  return { bands, pending: banners };
}

/**
 * Every band of rows in a folio range, in reading order.
 *
 * A page that carries no table is only allowed to be leading prose - see the
 * file docblock for the two conditions and what they were measured against.
 */
function readBands(pages: BookPage[], range: { from: number; to: number }, ...shapes: Shape[]): Band[] {
  const out: Band[] = [];
  let pending: Line[] = [];
  /**
   * The shape of a table some earlier page in this range carried, or `null`.
   *
   * NOT "a table was still running at the foot of the previous page", which is
   * what this said and what the relaxed throw below is described as testing.
   * It is set at the end of every page that had a heading and is never cleared,
   * so it is a latch, not a state. The difference is not academic: it makes the
   * throw STRICTER than advertised - a blank page in the middle of the chapter
   * is refused, where the sentence promises it would be tolerated. Documented
   * rather than changed, because strict is the side to err on here and the
   * behaviour is what both books were measured against.
   */
  let open: Shape | null = null;

  for (const page of pagesInFolios(pages, range.from, range.to)) {
    const folio = page.folio!;

    if (tableHeadings(page).length === 0) {
      if (open !== null || page.runs.some(isTableType)) {
        throw new ParseError(
          `no ${shapes.map((s) => s.columns.join('/')).join(' or ')} table on folio ${folio}`,
          `${page.lines.length} lines`,
        );
      }
      pending.push(...bannersBetween(page, -Infinity, Infinity));
      continue;
    }

    const read = pageBands(page, shapes, open, pending);
    out.push(...read.bands);
    pending = read.pending;
    // Every page with a heading yields at least one band, so this is the same
    // latch the boolean was: set on such a page, never cleared.
    open = read.bands[read.bands.length - 1]?.shape ?? open;
  }

  /*
   * The backstop, and the price of the one relaxation in this file.
   *
   * `readTables` used to throw on ANY page in range that carried no table, and
   * that unconditional throw was the thing that turned a wrong folio range into
   * a loud failure - it is how the SRD 2.0 run announced itself in the first
   * place ("no Name/Trait/Range/Damage/Burden/Feature table on folio 45").
   * Relaxing it for the prose page both books open their Weapons chapter on
   * bought a silent zero: a range landing entirely on pages with no table and
   * no run in the header face returns an EMPTY list and no error. Proved by
   * shifting every folio by +30, which pointed the derived range at Classes
   * prose and yielded 0 weapons, 0 armors, exit 0.
   *
   * A chapter that the contents page names always has at least one table. None
   * means the range is wrong, and that is worth more than the page it costs.
   */
  if (out.length === 0) {
    throw new ParseError(
      `no ${shapes.map((s) => s.columns.join('/')).join(' or ')} table anywhere in folios ${range.from}-${range.to}`,
      `${pagesInFolios(pages, range.from, range.to).length} pages, none carrying a table header`,
    );
  }
  return out;
}

/**
 * A section's folio, or `undefined` when this book has no such section.
 *
 * `folioOf` throws for exactly one reason - no entry carries any of the titles
 * - so catching it means that and nothing else. Written this way rather than by
 * comparing titles here, because matching a contents title is `contents.ts`'s
 * job and a second normaliser beside its `key()` is a second place to drift.
 */
function optionalFolio(toc: readonly ChapterEntry[], titles: readonly string[]): number | undefined {
  try {
    return folioOf(toc, ...titles);
  } catch {
    return undefined;
  }
}

/**
 * The folio ranges the book's base equipment chapters occupy.
 *
 * Not to read them - the two parsers below take their own ranges from
 * `rangeBetween` and still throw when a section they need is missing - but to
 * EXCLUDE them, because a module table is one printed outside all of these.
 *
 * A section this book does not name contributes no range, and that is not a
 * hole in the gate. It cannot hide a missing chapter, because the reader that
 * wants that chapter asks for it directly and throws. And it cannot let a base
 * table in through the back door either: an unexcluded base chapter becomes a
 * candidate module run, and its tables begin on a folio the contents page does
 * not name - folio 45 in SRD 1.0, folio 56 in SRD 2.0, both books opening the
 * chapter on prose - which `moduleRuns` refuses. What it buys is that reading
 * ARMOR no longer requires the book to have a Weapons chapter, which the range
 * version quietly did.
 */
function mainEquipmentRanges(toc: readonly ChapterEntry[]): Array<{ from: number; to: number }> {
  const bounds = [
    [WEAPONS_SECTION, WHEELCHAIR_SECTION],
    [WHEELCHAIR_SECTION, ARMOR_SECTION],
    [ARMOR_SECTION, AFTER_ARMOR],
  ] as const;
  const out: Array<{ from: number; to: number }> = [];
  for (const [from, before] of bounds) {
    const start = optionalFolio(toc, from);
    const end = optionalFolio(toc, before);
    if (start === undefined || end === undefined) continue;
    out.push({ from: start, to: end - 1 });
  }
  return out;
}

/** One module's equipment: consecutive folios, and the chapter that names them. */
interface ModuleRun {
  /** The contents-page title, verbatim - this becomes `Sourced.module`. */
  module: string;
  pages: BookPage[];
}

/**
 * The optional-module equipment runs a book prints, in reading order.
 *
 * See the file docblock for why this selects pages instead of taking a folio
 * range. Returning an EMPTY list is a correct answer and is what SRD 1.0 gets:
 * measured over all 135 of its folios, it prints no `Name`-led equipment header
 * outside the three main ranges. It is not a silent zero of the kind the
 * backstop above exists for - that one hid a wrong range for a chapter the book
 * definitely has, where this reports the absence of a chapter the book may not
 * have at all. What holds the number up on a book that DOES have one is
 * `moduleWeapons`/`moduleArmors` in `REVISION_COUNTS`.
 */
function moduleRuns(pages: BookPage[], toc: readonly ChapterEntry[]): ModuleRun[] {
  const main = mainEquipmentRanges(toc);
  const inMain = (folio: number): boolean => main.some((r) => folio >= r.from && folio <= r.to);
  const carrying = pages
    .filter((p) => p.folio !== null && !inMain(p.folio) && tableHeadings(p).length > 0)
    .sort((a, b) => a.folio! - b.folio!);

  const runs: BookPage[][] = [];
  for (const page of carrying) {
    const last = runs[runs.length - 1];
    if (last !== undefined && page.folio! === last[last.length - 1]!.folio! + 1) last.push(page);
    else runs.push([page]);
  }

  return runs.map((run) => {
    const first = run[0]!.folio!;
    const named = toc.filter((e) => e.folio === first);
    if (named.length === 0) {
      throw new ParseError(
        `an equipment table on folio ${first} belongs to no section the contents page names`,
        `folios ${run.map((p) => p.folio).join(', ')} carry equipment outside the main chapters`,
      );
    }
    if (named.length > 1) {
      throw new ParseError(
        `folio ${first} starts ${named.length} sections, so its equipment has no one module`,
        named.map((e) => e.title).join(' | '),
      );
    }
    /*
     * A run may reach onto the folio the NEXT section starts, and no further.
     *
     * SRD 2.0 needs the page: Everyday Hero's Secondary Weapons and Armor
     * tables are printed on folio 192, above the `Feasts` banner, and the
     * contents gives folio 192 to Feasts. That is the same one-page overlap
     * `sectionRange` documents for SIMIAH and COMMUNITIES. Anything past it
     * would mean this run is being attributed to the wrong chapter.
     */
    const next = toc.find((e) => e.folio > first);
    const last = run[run.length - 1]!.folio!;
    if (next !== undefined && last > next.folio) {
      throw new ParseError(
        `"${named[0]!.title}" equipment runs to folio ${last}, past "${next.title}" on folio ${next.folio}`,
        `folios ${run.map((p) => p.folio).join(', ')}`,
      );
    }
    return { module: named[0]!.title, pages: run };
  });
}

/**
 * The bands of one module run.
 *
 * The no-table-on-this-page throw `readBands` carries is not repeated, and not
 * because it is being relaxed: a run is BUILT from the pages that carry a
 * table, so the condition cannot arise. The gate it stands for - a page of
 * equipment silently yielding nothing - is met earlier here, by the selection
 * itself, and later by the counts in `tools/validate.ts`.
 */
function readRunBands(run: ModuleRun, shapes: readonly Shape[]): Band[] {
  const out: Band[] = [];
  let pending: Line[] = [];
  let open: Shape | null = null;
  for (const page of run.pages) {
    const read = pageBands(page, shapes, open, pending);
    out.push(...read.bands);
    pending = read.pending;
    open = read.bands[read.bands.length - 1]?.shape ?? open;
  }
  return out;
}

function toTier(s: string, where: string): Tier {
  const n = Number(s);
  if (n !== 1 && n !== 2 && n !== 3 && n !== 4) throw new ParseError(`bad tier ${s}`, where);
  return n;
}

function toTrait(s: string, where: string): Trait {
  const t = s.toLowerCase();
  if ((TRAITS as readonly string[]).includes(t)) return t as Trait;
  // The arcane-frame wheelchairs print "Spellcast" where every other weapon
  // prints one of the six traits: the trait is whatever the subclass grants.
  // `Trait` cannot hold that, so the source value is kept verbatim and a
  // validator's "trait is one of TRAITS" check is meant to trip on it.
  if (t === 'spellcast') return t as Trait;
  throw new ParseError(`unknown weapon trait "${s}"`, where);
}

function toRange(s: string, where: string): Range {
  const r = RANGES.find((v) => v.toLowerCase() === s.toLowerCase());
  if (!r) throw new ParseError(`unknown range "${s}"`, where);
  return r;
}

function toBurden(s: string, where: string): 1 | 2 {
  if (s === 'One-Handed') return 1;
  if (s === 'Two-Handed') return 2;
  throw new ParseError(`unknown burden "${s}"`, where);
}

/**
 * "d10+7 phy" -> die and type.
 *
 * A weapon that deals either kind prints it three ways across the two books:
 * SRD 1.0's one such weapon (Ghostblade, "d10+7 phy or mag") and SRD 2.0's four
 * ("d8 phy/mag" - Shadowblade, and three more). The book's own spelling is kept
 * rather than folded into one, the way `toTrait` keeps "Spellcast": `DamageKind`
 * is `phy | mag` and cannot hold either of them, so inventing a third spelling
 * the source never prints would only make the lie harder to find. Everything
 * downstream tests `=== 'mag'`, so both read as physical, as they did before.
 */
function toDamage(s: string, where: string): { damage: string; damageType: DamageKind } {
  const m = /^(d\d+(?:[+-]\d+)?) (phy|mag|phy or mag|phy\/mag)$/.exec(s);
  if (!m) throw new ParseError(`unreadable damage cell "${s}"`, where);
  return { damage: m[1]!, damageType: m[2] as DamageKind };
}

const featureText = (s: string): string => (s === NONE ? '' : s);

/** A row's cells keyed by their lower-cased column header. */
const named = (row: Row, columns: readonly string[]): Record<string, string> =>
  Object.fromEntries(columns.map((c, i) => [c.toLowerCase(), row.cells[i] ?? '']));

/**
 * The tier a module row takes when the book prints no tier for it at all.
 *
 * This is the one value in this file the source does not state, so here is the
 * whole of what the book DOES state, and where.
 *
 *   - Folio 191's chapter head, at 17.3pt: `EVERYDAY HERO STARTING EQUIPMENT`,
 *     which is also its contents entry. Under it: "PCs without access to
 *     standard weapons and armor can choose from the following tables."
 *   - Folio 5, CHARACTER CREATION, under "Choose Your Starting Equipment.":
 *     "Select from the **Tier 1** Weapon Tables ..." and "Choose and equip one
 *     set of armor from the **Tier 1** Armor [Table]".
 *
 * So the book says starting equipment is chosen at tier 1, and says these
 * tables are the starting equipment of a table that has no standard tables.
 * A third, independent check agrees and could have disagreed: all four of the
 * chapter's armors carry a statline the main Armor chapter also prints, and
 * ONLY at tier 1 - 5/11 score 3, 6/13 score 3, 7/15 score 4, 8/17 score 4, the
 * Gambeson, Leather, Chainmail and Full Plate rows. Tier 2's lowest is 6/15.
 *
 * It is still a derived value and is marked as one, because `Tier` cannot hold
 * "the book did not say" - see the note in `parseModuleWeapons`.
 */
const STATLINE_TIER: Tier = 1;

/** One tier's worth of a cell that prints the whole ladder. */
interface Statline {
  tier: Tier;
  text: string;
}

/**
 * A cell that carries every tier at once, split into one entry per tier.
 *
 * `null` when the cell carries no tier, which is how an Everyday Hero row is
 * told from a Western or Monster Hunting one - by what the cell prints, not by
 * which chapter it is in.
 *
 * The ladder must be exactly tiers 1 to 4, in order. A cell printing three
 * tiers, or 1/2/2/3, is a cell this has misread, and there is no reading of
 * such a table that should reach the dataset.
 */
function splitStatlines(cell: string, where: string): Statline[] | null {
  if (!TIERED_CELL.test(cell)) return null;
  const parts = cell
    .split(/(?=Tier \d:)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out = parts.map((part) => {
    const m = /^Tier (\d): ?(.*)$/.exec(part);
    if (m === null) throw new ParseError(`unreadable tiered cell "${part}"`, where);
    return { tier: toTier(m[1]!, where), text: m[2]!.trim() };
  });
  if (out.length !== 4 || out.some((s, i) => s.tier !== i + 1)) {
    throw new ParseError(
      `a tiered cell must print tiers 1-4 in order, and this prints ${out.map((s) => s.tier).join('/')}`,
      `${cell} -- ${where}`,
    );
  }
  return out;
}

/**
 * The id of one statline of a row the book prints once.
 *
 * Every id in this dataset is derived - the books print no identifiers - so
 * this is disambiguating a key we invented, not renaming the source. The NAME
 * stays exactly what folio 197 prints, "Revolver", on all four records. The
 * tempting alternative is to borrow the main chapter's own words for the higher
 * tiers ("Improved Revolver", "Advanced Revolver"): those names are not in this
 * book, and putting them in `name` would be the parser-renames-its-source move
 * that put two invented headings into a shipped dataset for a whole printing.
 */
const statlineId = (name: string, tier: Tier): string => `${slugify(name)}-tier-${tier}`;

function weaponFrom(
  row: Row,
  c: Record<string, string>,
  fixed: { folio: number; tier: Tier; slot: Weapon['slot']; category: Weapon['category'] },
): Weapon {
  const name = c.name!;
  if (name.length === 0) throw new ParseError('weapon with no name', row.where);
  return {
    id: slugify(name),
    name,
    tier: fixed.tier,
    slot: fixed.slot,
    category: fixed.category,
    trait: toTrait(c.trait!, row.where),
    range: toRange(c.range!, row.where),
    ...toDamage(c.damage!, row.where),
    burden: toBurden(c.burden!, row.where),
    feature: featureText(c.feature!),
    sourcePage: fixed.folio,
  };
}

/**
 * The weapons one module run prints.
 *
 * ## Why a row can become four records
 *
 * Everyday Hero prints a plain `d8 phy` and one record comes out. Western and
 * Monster Hunting print `Tier 1: d8+1 phy Tier 2: d8+4 phy Tier 3: d8+7 phy
 * Tier 4: d8+10 phy` and four do. Both are the book's own doing: the ladders in
 * those cells are the main chapter's ladders exactly - +3 a tier for a primary
 * weapon, +2 for a secondary - and the main chapter states that same fact as
 * four separate rows in four tier tables. The compact form is a typesetting
 * decision about a page with no room for four tables, not a different game
 * object, and reading it as one record would throw away three printed
 * statlines with nothing red, which is this file's own worst-case history.
 *
 * ## The one thing the schema cannot say
 *
 * `Weapon.tier` is `1 | 2 | 3 | 4` and has no "the book did not say". Everyday
 * Hero prints no tier anywhere on folios 191-192, so its 32 rows take
 * `STATLINE_TIER`, whose docblock carries the printed sentences that value
 * rests on. That is a derivation, it is the only one here, and it is pinned by
 * a test so that it stays a decision rather than becoming a fact.
 */
function parseModuleWeapons(run: ModuleRun, bands: readonly Band[]): Weapon[] {
  const out: Weapon[] = [];
  let slot: Weapon['slot'] | null = null;
  /*
   * Cleared by every slot banner, because these banners carry BOTH facts in one
   * line - `Primary Physical Weapons` names the category, `Primary Weapons`
   * declines to. Where the main chapter needs two banners and has to remember
   * to clear the second when the first changes, here a new banner simply
   * replaces both, so a table can never inherit the category of the one before.
   */
  let category: Weapon['category'] | null = null;

  for (const band of bands) {
    for (const line of band.banners) {
      const m = MODULE_WEAPON_BANNER.exec(normalizeText(line.text));
      if (m === null) continue;
      slot = m[1] === 'Primary' ? 'primary' : 'secondary';
      category = (m[2] as Weapon['category'] | undefined) ?? null;
    }
    if (band.shape !== WEAPON_TABLE) continue;
    if (slot === null) {
      throw new ParseError(
        `no Primary/Secondary Weapons banner above a module weapon table`,
        `${run.module}, folio ${band.folio}`,
      );
    }
    for (const row of band.rows) {
      const c = named(row, WEAPON_TABLE.columns);
      const name = c.name!;
      if (name.length === 0) throw new ParseError('weapon with no name', row.where);
      const ladder = splitStatlines(c.damage!, row.where);
      const statlines: Statline[] = ladder ?? [{ tier: STATLINE_TIER, text: c.damage! }];
      for (const line of statlines) {
        const { damage, damageType } = toDamage(line.text, row.where);
        out.push({
          id: ladder === null ? slugify(name) : statlineId(name, line.tier),
          name,
          tier: line.tier,
          slot,
          /*
           * The same fallback the main chapter's secondary tables use, and for
           * the same reason: `Primary Weapons` and `Secondary Weapons` do not
           * say which category their rows are in, so the damage type is the
           * only thing on the page that does. It puts the Monster Hunting
           * Blessed Brass Knuckles - Strength, `mag` - in `Magic`, which no
           * main-chapter Magic weapon is, because no main-chapter Magic weapon
           * has a trait that is not a Spellcast trait. The book prints the
           * trait and the damage type; `category` is ours, and this is the rule
           * this file already had for a table that does not state one.
           */
          category: category ?? (damageType === 'mag' ? 'Magic' : 'Physical'),
          trait: toTrait(c.trait!, row.where),
          range: toRange(c.range!, row.where),
          damage,
          damageType,
          burden: toBurden(c.burden!, row.where),
          feature: featureText(c.feature!),
          sourcePage: band.folio,
          module: run.module,
        });
      }
    }
  }
  return out;
}

/** The armors one module run prints. Tiers work exactly as in `parseModuleWeapons`. */
function parseModuleArmors(run: ModuleRun, bands: readonly Band[]): Armor[] {
  const out: Armor[] = [];
  for (const band of bands) {
    if (band.shape !== ARMOR_TABLE) continue;
    for (const row of band.rows) {
      const c = named(row, ARMOR_TABLE.columns);
      const name = c.name!;
      if (name.length === 0) throw new ParseError('armor with no name', row.where);

      const ladder = splitStatlines(c.thresholds!, row.where);
      const scores = splitStatlines(c.score!, row.where);
      /*
       * Both cells scale or neither does. Monster Hunting prints the ladder in
       * Base Thresholds AND in Base Score, and a row where only one of them did
       * would mean the two cells were cut apart wrongly, not that the book had
       * invented a half-scaling armor.
       */
      if ((ladder === null) !== (scores === null)) {
        throw new ParseError(
          `an armor row scales in one cell and not the other`,
          `thresholds "${c.thresholds}" vs score "${c.score}" -- ${row.where}`,
        );
      }
      const thresholds: Statline[] = ladder ?? [{ tier: STATLINE_TIER, text: c.thresholds! }];
      const points: Statline[] = scores ?? [{ tier: STATLINE_TIER, text: c.score! }];

      for (const [i, line] of thresholds.entries()) {
        const t = /^(\d+) ?\/ ?(\d+)$/.exec(line.text);
        if (t === null) {
          throw new ParseError(`unreadable base thresholds "${line.text}"`, row.where);
        }
        const score = points[i]!.text;
        if (!/^\d+$/.test(score)) throw new ParseError(`unreadable base score "${score}"`, row.where);
        out.push({
          id: ladder === null ? slugify(name) : statlineId(name, line.tier),
          name,
          tier: line.tier,
          baseThresholds: [Number(t[1]), Number(t[2])],
          baseScore: Number(score),
          feature: featureText(c.feature!),
          sourcePage: band.folio,
          module: run.module,
        });
      }
    }
  }
  return out;
}

export function parseWeapons(pages: BookPage[]): Weapon[] {
  const toc = parseContents(pages);
  const out: Weapon[] = [];

  let slot: Weapon['slot'] | null = null;
  let tier: Tier | null = null;
  /*
   * Primary tables are split under a "Physical Weapons" / "Magic Weapons"
   * banner; the secondary tables have no such split, and there the damage type
   * is the only thing that says which category a weapon is in.
   *
   * Clearing it when the book changes subject is load-bearing, and the two
   * places that do it are redundant with each other - measured, not assumed.
   * Delete EITHER `category = null` and both books still build byte-identical,
   * because a slot banner is always followed by a tier banner and vice versa.
   * Delete BOTH and `npm run build:srd -- --check` fails: every secondary
   * weapon in SRD 1.0 then inherits the "Magic Weapons" banner that headed the
   * last primary table, four folios back.
   */
  let category: Weapon['category'] | null = null;

  for (const band of readBands(pages, rangeBetween(toc, WEAPONS_SECTION, WHEELCHAIR_SECTION), WEAPON_TABLE)) {
    for (const line of band.banners) {
      const text = normalizeText(line.text);
      const s = SLOT_BANNER.exec(text);
      if (s) {
        slot = s[1] === 'PRIMARY' ? 'primary' : 'secondary';
        category = null;
        continue;
      }
      const t = TIER_BANNER.exec(text);
      if (t) {
        tier = toTier(t[1]!, `folio ${band.folio}`);
        category = null;
        continue;
      }
      const c = CATEGORY_BANNER.exec(text);
      if (c) category = c[1] as Weapon['category'];
    }
    if (slot === null) {
      throw new ParseError(
        `no PRIMARY/SECONDARY WEAPON TABLES banner above a weapon table`,
        `folio ${band.folio}`,
      );
    }
    if (tier === null) {
      throw new ParseError(`no tier banner above a table on folio ${band.folio}`, band.rows[0]!.where);
    }
    for (const row of band.rows) {
      const c = named(row, WEAPON_TABLE.columns);
      const { damageType } = toDamage(c.damage!, row.where);
      out.push(
        weaponFrom(row, c, {
          folio: band.folio,
          tier,
          slot,
          category: category ?? (damageType === 'mag' ? 'Magic' : 'Physical'),
        }),
      );
    }
  }

  // The Combat Wheelchair sidebar: three tables of primary weapons carrying
  // their tier in a column of their own instead of in a banner.
  let frame: string | null = null;
  for (const band of readBands(pages, rangeBetween(toc, WHEELCHAIR_SECTION, ARMOR_SECTION), WHEELCHAIR_TABLE)) {
    for (const line of band.banners) {
      const f = FRAME_BANNER.exec(normalizeText(line.text));
      if (f) frame = f[1]!;
    }
    if (frame === null) {
      throw new ParseError(`no frame banner above a wheelchair table`, `folio ${band.folio}`);
    }
    const category = frame === 'Arcane' ? 'Magic' : 'Physical';
    for (const row of band.rows) {
      const c = named(row, WHEELCHAIR_TABLE.columns);
      out.push(
        weaponFrom(row, c, {
          folio: band.folio,
          tier: toTier(c.tier!, row.where),
          // "All combat wheelchairs are equipped as Primary Weapons."
          slot: 'primary',
          category,
        }),
      );
    }
  }

  // The optional modules, after the base rules and marked as theirs.
  for (const run of moduleRuns(pages, toc)) {
    out.push(...parseModuleWeapons(run, readRunBands(run, [WEAPON_TABLE, ARMOR_TABLE])));
  }

  assertUniqueIds(out, 'weapon');
  return out;
}

export function parseArmors(pages: BookPage[]): Armor[] {
  const toc = parseContents(pages);
  const out: Armor[] = [];
  let tier: Tier | null = null;

  for (const band of readBands(pages, rangeBetween(toc, ARMOR_SECTION, AFTER_ARMOR), ARMOR_TABLE)) {
    for (const line of band.banners) {
      const t = TIER_BANNER.exec(normalizeText(line.text));
      if (t) tier = toTier(t[1]!, `folio ${band.folio}`);
    }
    if (tier === null) {
      throw new ParseError(`no tier banner above a table on folio ${band.folio}`, band.rows[0]!.where);
    }
    for (const row of band.rows) {
      const c = named(row, ARMOR_TABLE.columns);
      if (!c.name) throw new ParseError('armor with no name', row.where);
      const t = /^(\d+) ?\/ ?(\d+)$/.exec(c.thresholds!);
      if (!t) throw new ParseError(`unreadable base thresholds "${c.thresholds}"`, row.where);
      if (!/^\d+$/.test(c.score!)) {
        throw new ParseError(`unreadable base score "${c.score}"`, row.where);
      }
      out.push({
        id: slugify(c.name),
        name: c.name,
        tier,
        baseThresholds: [Number(t[1]), Number(t[2])],
        baseScore: Number(c.score),
        feature: featureText(c.feature!),
        sourcePage: band.folio,
      });
    }
  }
  for (const run of moduleRuns(pages, toc)) {
    out.push(...parseModuleArmors(run, readRunBands(run, [WEAPON_TABLE, ARMOR_TABLE])));
  }

  assertUniqueIds(out, 'armor');
  return out;
}

function assertUniqueIds(items: ReadonlyArray<{ id: string; name: string }>, what: string): void {
  const seen = new Set<string>();
  const clashes = items.filter((i) => (seen.has(i.id) ? true : (seen.add(i.id), false)));
  if (clashes.length > 0) {
    throw new ParseError(
      `duplicate ${what} ids`,
      clashes.map((c) => `${c.id} (${c.name})`).join(', '),
    );
  }
}
