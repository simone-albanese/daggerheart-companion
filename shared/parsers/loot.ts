/**
 * The random-item tables: Loot and Consumables.
 *
 * Both are set as wide `ROLL | name | description` grids, sometimes two grids
 * side by side on one page, so the de-columnised line stream interleaves them.
 * Everything here works from `page.runs` geometry instead: the 8pt Eveleth
 * header row of each grid gives the x anchor of its three columns, and a run's
 * x decides which cell it belongs to.
 *
 * ## Where the material is
 *
 * The chapter used to be named here, `FROM_FOLIO = 58` / `TO_FOLIO = 62`, which
 * is right for SRD 1.0 and wrong for every other printing - SRD 2.0 reflows 135
 * printed pages into 224 and prints the same chapter on folios 75-84. The
 * range comes from the book's own contents page now.
 *
 * It takes BOTH ends by name rather than `sectionRange`, because this file
 * covers two contents entries: stopping where the next entry begins would stop
 * at Consumables and drop half the material. The far end is the next top-level
 * chapter, RUNNING AN ADVENTURE.
 *
 * And the chapter is the one place the two indexes disagree about a title:
 * SRD 1.0 prints `Loot`, SRD 2.0 prints `Loot & Items`. Both are listed,
 * oldest first, so a later book's rename never shadows the name a current book
 * still uses.
 *
 * ## How many tables there are is a fact about the book, not about the material
 *
 * SRD 1.0 prints one table per kind, each rolled 1..60. SRD 2.0 prints TWO per
 * kind, and says so in an italic line above each: "The following table includes
 * the items from the Daggerheart Core Set." on folio 75, and "...from the Hope
 * & Fear Expansion Set." on folio 77, with the same pair over Consumables on
 * folios 80 and 82. Each of the four is independently rolled 1..60, so 120 loot
 * and 120 consumables, and the roll column restarts three times inside the
 * chapter instead of once. The old "exactly one restart" rule was reading that
 * one restart as the boundary between Loot and Consumables; it was measuring
 * the wrong thing, and on SRD 2.0 there is no single restart to find.
 *
 * The boundary between the two KINDS is the CONSUMABLES banner, and the
 * contents page says which folio to look for it on. That matters because the
 * two books share a page differently: SRD 1.0 ends Loot and starts Consumables
 * both on folio 60, so the folio alone does not separate them and the banner's
 * height on the page does.
 *
 * The boundary between the two PRODUCTS is the italic sentence, which is also
 * what stops `roll` from becoming a lie. Two items of a kind now carry roll 1,
 * and what tells them apart is `set` - `core` for the Daggerheart Core Set,
 * `expansion` for the Hope & Fear Expansion Set. SRD 1.0 prints no such
 * sentence anywhere in the chapter, so its items carry no `set` at all, which
 * is the right record of a book that does not fence its products.
 */
import type { BookPage, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import type { Item, ProductSet } from '../types.ts';
import { slugify } from '../slugify.ts';
import { ParseError, normalizeText, pagesInFolios } from './util.ts';
import { type ChapterEntry, folioOf, parseContents, rangeBetween } from './contents.ts';

/** Oldest name first: SRD 1.0 prints `Loot`, SRD 2.0 prints `Loot & Items`. */
const CHAPTER = ['Loot', 'Loot & Items'];
/** The chapter runs past Consumables, so its far end is the next chapter. */
const NEXT_CHAPTER = ['RUNNING AN ADVENTURE'];
/** The banner that separates the two kinds, and its contents entry. */
const CONSUMABLES = 'Consumables';

/**
 * Table cells are the only 8pt QuestaSans on these pages - the surrounding
 * prose (including the Gold rules sharing folio 62 of SRD 1.0 and folio 84 of
 * SRD 2.0) is 9.3pt or display type. That is what keeps a grid whose right edge
 * is the page edge from swallowing the neighbouring column.
 */
const isCell = (r: TextRun): boolean => Math.abs(r.size - 8) < 0.5 && r.family === 'QuestaSans';
const isHead = (r: TextRun): boolean =>
  Math.abs(r.size - 8) < 0.5 && r.family.startsWith('Eveleth');

/** Left x of the three columns of one grid, read off its header row. */
interface Grid {
  rollX: number;
  nameX: number;
  descX: number;
  /** Exclusive right edge: the next grid on the same header row, or the page. */
  rightX: number;
  yTop: number;
  /** Exclusive bottom: the next header row on the page, or the page foot. */
  yBottom: number;
}

interface Row {
  roll: number;
  name: string;
  text: string;
  folio: number;
  /** Top of the grid this row was read from, for placing it against a caption. */
  gridY: number;
}

/**
 * The sentence a table prints above itself, naming the product it comes from.
 *
 * Measured: exactly four in SRD 2.0's chapter and none at all in SRD 1.0's,
 * all four set in QuestaSlab-LightItalic at 9.3pt. The 8pt italic inside the
 * cells - condition names like "Resilient:" and "Ablaze" - is QuestaSans, and
 * is body text of a row rather than a heading over a table, which is why the
 * family and not the italic flag is what selects these.
 */
interface Caption {
  folio: number;
  y: number;
  set: ProductSet;
}

/** One side of the CONSUMABLES banner: the rows, and the captions over them. */
interface Side {
  rows: Row[];
  captions: Caption[];
}

function gridsOn(page: BookPage): Grid[] {
  const heads = page.runs.filter(isHead);
  const rolls = heads
    .filter((r) => r.text.toUpperCase() === 'ROLL')
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (rolls.length === 0) return [];

  // Side-by-side grids can sit a few points apart vertically; one header row.
  const bands: TextRun[][] = [];
  for (const r of rolls) {
    const last = bands[bands.length - 1];
    if (last && Math.abs(r.y - last[0]!.y) < 8) last.push(r);
    else bands.push([r]);
  }

  const out: Grid[] = [];
  bands.forEach((band, i) => {
    const yTop = Math.min(...band.map((r) => r.y));
    const next = bands[i + 1];
    const yBottom = next ? Math.min(...next.map((r) => r.y)) - 2 : Infinity;
    const byX = [...band].sort((a, b) => a.x - b.x);
    byX.forEach((roll, j) => {
      const after = byX[j + 1];
      const rightX = after ? after.x - 6 : Infinity;
      const inCell = (r: TextRun): boolean =>
        r.x > roll.x && r.x < rightX && Math.abs(r.y - roll.y) < 8;
      const name = heads.find((r) => r.text.toUpperCase() === 'LOOT' && inCell(r));
      const desc = heads.find((r) => r.text.toUpperCase() === 'DESCRIPTION' && inCell(r));
      if (!name || !desc) {
        throw new ParseError(
          `Item table header on folio ${page.folio} is missing its name/description column`,
          band.map((r) => `${r.text}@${r.x.toFixed(0)},${r.y.toFixed(0)}`).join(' '),
        );
      }
      out.push({ rollX: roll.x, nameX: name.x, descX: desc.x, rightX, yTop, yBottom });
    });
  });
  return out;
}

const inGrid = (g: Grid, r: TextRun): boolean =>
  r.y > g.yTop + 2 && r.y < g.yBottom && r.x >= g.rollX - 6 && r.x < g.rightX;

/**
 * Append a word, re-applying the ligature repair `assembleLines` does for the
 * line stream: poppler splits a word wherever a ligature glyph sits, and a
 * spurious boundary has no advance at all. `prevEnd` is NaN at the start of a
 * visual line, so a wrapped cell always gets its space.
 */
function append(acc: string, r: TextRun, prevEnd: number): string {
  if (acc.length === 0) return r.text;
  const glued = (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO;
  return acc + (glued ? '' : ' ') + r.text;
}

function rowsIn(page: BookPage, g: Grid): Row[] {
  const folio = page.folio!;
  const runs = page.runs
    .filter((r) => isCell(r) && inGrid(g, r))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // Baselines within a visual line differ by under a point; lines are 10 apart.
  const lines: TextRun[][] = [];
  for (const r of runs) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.y - last[0]!.y) < 4) last.push(r);
    else lines.push([r]);
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);

  const nameLeft = (g.rollX + g.nameX) / 2;
  const descLeft = g.descX - 6;

  const out: Row[] = [];
  for (const line of lines) {
    const head = line.find((r) => r.x < nameLeft);
    if (head) {
      // SRD 2.0's Core Set tables zero-pad the first nine rolls (`01`), its
      // expansion tables do not. `Number` reads both; the shape check is what
      // catches a stray word landing in the roll column.
      if (!/^\d{1,3}$/.test(head.text)) {
        throw new ParseError(
          `Item table roll column on folio ${folio} is not a number`,
          line.map((r) => r.text).join(' '),
        );
      }
      out.push({ roll: Number(head.text), name: '', text: '', folio, gridY: g.yTop });
    }
    const row = out[out.length - 1];
    if (!row) {
      throw new ParseError(
        `Item table text on folio ${folio} precedes any roll number`,
        line.map((r) => r.text).join(' '),
      );
    }
    let nameEnd = Number.NaN;
    let textEnd = Number.NaN;
    for (const r of line) {
      if (r.x < nameLeft) continue;
      if (r.x < descLeft) {
        row.name = append(row.name, r, nameEnd);
        nameEnd = r.x + r.w;
      } else {
        row.text = append(row.text, r, textEnd);
        textEnd = r.x + r.w;
      }
    }
  }
  return out;
}

/**
 * Every product sentence on one page, in reading order.
 *
 * Strict on purpose: a QuestaSlab italic line in this chapter IS a table
 * caption in both books, so one that names neither product is a book that has
 * changed its wording, and binding tables to captions by position afterwards
 * would then be pairing the wrong things silently. Better to stop and be read.
 */
function captionsOn(page: BookPage): Caption[] {
  const runs = page.runs
    .filter((r) => r.family.startsWith('QuestaSlab') && r.italic)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const lines: TextRun[][] = [];
  for (const r of runs) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(r.y - last[0]!.y) < 4) last.push(r);
    else lines.push([r]);
  }

  return lines.map((line) => {
    const text = normalizeText(line.map((r) => r.text).join(' '));
    const set: ProductSet | null = /Daggerheart Core Set/i.test(text)
      ? 'core'
      : /Hope\s*&\s*Fear Expansion Set/i.test(text)
        ? 'expansion'
        : null;
    if (set === null) {
      throw new ParseError(
        `Italic line over the item tables on folio ${page.folio} names no product`,
        text,
      );
    }
    return { folio: page.folio!, y: line[0]!.y, set };
  });
}

/**
 * Where the Consumables tables begin: a folio, and a height on that folio.
 *
 * The two kinds are typographically identical - same three columns, same 8pt
 * cells, both rolled from 1 - so nothing inside a grid says which kind it
 * belongs to. The banner between them does, and the contents page says which
 * folio it is printed on. The height matters because SRD 1.0 ends Loot and
 * begins Consumables on one page, folio 60, with the banner between them.
 *
 * The banner is display type - EvelethClean at 17.3pt in SRD 1.0, at 12pt in
 * SRD 2.0 - and the only other Eveleth on these pages is the 8pt column header,
 * which reads ROLL/LOOT/DESCRIPTION and never this. Exactly one match is
 * required: none means the banner moved, and more than one would make "the
 * first" a guess.
 */
function consumablesBanner(
  pages: BookPage[],
  entries: readonly ChapterEntry[],
): { folio: number; y: number } {
  const folio = folioOf(entries, CONSUMABLES);
  const page = pages.find((p) => p.folio === folio);
  if (page === undefined) {
    throw new ParseError(
      `contents puts ${CONSUMABLES} on folio ${folio}, which the book has no page for`,
      'the contents and the pages disagree',
    );
  }
  const hits = page.runs.filter(
    (r) => r.family.startsWith('Eveleth') && r.text.trim().toUpperCase() === 'CONSUMABLES',
  );
  if (hits.length !== 1) {
    throw new ParseError(
      `folio ${folio} carries ${hits.length} CONSUMABLES banners, not 1`,
      page.runs
        .filter((r) => r.family.startsWith('Eveleth'))
        .map((r) => `${r.text}@${r.x.toFixed(0)},${r.y.toFixed(0)}`)
        .join(' '),
    );
  }
  return { folio, y: hits[0]!.y };
}

/**
 * Every table row of the chapter, split into the two kinds at the banner.
 *
 * A grid belongs to Consumables when it starts below the banner, or on any
 * later folio. Reading order is the page order and then, within a page,
 * `gridsOn`'s order: header rows top to bottom, and left to right within a row.
 */
function tableRows(pages: BookPage[]): { loot: Side; consumables: Side } {
  const entries = parseContents(pages);
  const range = rangeBetween(entries, CHAPTER, NEXT_CHAPTER);
  const banner = consumablesBanner(pages, entries);
  const past = (folio: number, y: number): boolean =>
    folio > banner.folio || (folio === banner.folio && y > banner.y);

  const loot: Side = { rows: [], captions: [] };
  const consumables: Side = { rows: [], captions: [] };
  for (const page of pagesInFolios(pages, range.from, range.to)) {
    const grids = gridsOn(page);
    // A cell outside every grid is a row clipped by a bad edge, and a cell
    // inside two is a grid that reaches into its neighbour. Both would lose or
    // duplicate text silently, so neither is allowed to pass.
    for (const r of page.runs) {
      if (!isCell(r)) continue;
      const claims = grids.filter((g) => inGrid(g, r)).length;
      if (claims === 1) continue;
      throw new ParseError(
        `Item table cell on folio ${page.folio} is claimed by ${claims} grids, not 1`,
        `"${r.text}" at ${r.x.toFixed(0)},${r.y.toFixed(0)}`,
      );
    }
    for (const caption of captionsOn(page)) {
      (past(caption.folio, caption.y) ? consumables : loot).captions.push(caption);
    }
    for (const g of grids) {
      (past(page.folio!, g.yTop) ? consumables : loot).rows.push(...rowsIn(page, g));
    }
  }
  for (const [kind, side] of [['loot', loot], ['consumable', consumables]] as const) {
    if (side.rows.length === 0) {
      throw new ParseError(
        `No ${kind} table rows found`,
        `folios ${range.from}-${range.to}, banner on folio ${banner.folio} at y=${banner.y.toFixed(0)}`,
      );
    }
  }
  return { loot, consumables };
}

/**
 * Cut one kind's rows into the tables the book prints, wherever the roll
 * sequence stops climbing.
 *
 * SRD 1.0 yields one table per kind and SRD 2.0 two, and the count is not
 * asserted here on purpose: how many printings a book collects is the book's
 * business. What each table has to be is checked in `toItems`, and a pair of
 * grids read out of order fails there rather than here - a table that resumes
 * at 31 is not a complete sequence from 1.
 */
function splitTables(rows: readonly Row[]): Row[][] {
  const tables: Row[][] = [];
  for (const row of rows) {
    const open = tables[tables.length - 1];
    if (open !== undefined && row.roll > open[open.length - 1]!.roll) open.push(row);
    else tables.push([row]);
  }
  return tables;
}

/**
 * Which product each table belongs to, when the book says.
 *
 * The captions and the tables are two independent witnesses of the same
 * division - one typographic, one arithmetic - and this is where they are made
 * to agree. A book that captions its tables must caption ALL of them, each
 * caption sitting above the table it introduces and below the previous one's
 * first row. When they disagree, the pairing would be a guess, so it throws
 * instead of picking one.
 *
 * No captions at all is not a disagreement: it is SRD 1.0, which never fences
 * its products, and every item is then left with no `set` - which records that
 * the book did not say, rather than asserting `core` on its behalf.
 */
function productSets(
  captions: readonly Caption[],
  tables: readonly Row[][],
  kind: Item['kind'],
): (ProductSet | undefined)[] {
  if (captions.length === 0) return tables.map(() => undefined);
  type At = { folio: number; y: number };
  const where = (c: At): string => `folio ${c.folio} at y=${c.y.toFixed(0)}`;
  const before = (a: At, b: At): boolean => a.folio < b.folio || (a.folio === b.folio && a.y < b.y);
  const startOf = (table: readonly Row[]): At => ({ folio: table[0]!.folio, y: table[0]!.gridY });
  if (captions.length !== tables.length) {
    throw new ParseError(
      `${kind} has ${tables.length} tables but ${captions.length} product captions`,
      captions.map((c) => `${c.set} on ${where(c)}`).join(' | '),
    );
  }
  return tables.map((table, i) => {
    const caption = captions[i]!;
    const head = startOf(table);
    const prior = tables[i - 1];
    const after = prior === undefined || before(startOf(prior), caption);
    if (!before(caption, head) || !after) {
      throw new ParseError(
        `${kind} caption "${caption.set}" on ${where(caption)} does not introduce the table it is paired with`,
        `table ${i + 1} starts on ${where(head)}`,
      );
    }
    return caption.set;
  });
}

/**
 * One kind's items, in printed order.
 *
 * `roll` is what the book prints, which in SRD 2.0 means two items of a kind
 * can carry the same number: the Core Set and the Hope & Fear tables are rolled
 * separately and each runs 1..60. Renumbering them 1..120 would read as one
 * table nobody can roll on, so the number stays the book's and `set` is what
 * tells the two apart.
 */
function toItems(side: Side, kind: Item['kind']): Item[] {
  const tables = splitTables(side.rows);
  const sets = productSets(side.captions, tables, kind);
  const items: Item[] = [];
  for (const [t, table] of tables.entries()) {
    for (const [i, r] of table.entries()) {
      if (r.roll !== i + 1) {
        throw new ParseError(
          `${kind} rolls are not a complete 1..${table.length} sequence`,
          `expected ${i + 1}, got ${r.roll} on folio ${r.folio} (${r.name})`,
        );
      }
      const name = normalizeText(r.name);
      const text = normalizeText(r.text);
      if (name.length === 0 || text.length === 0) {
        throw new ParseError(
          `${kind} ${r.roll} on folio ${r.folio} is missing its name or description`,
          `${r.roll} | ${r.name} | ${r.text}`,
        );
      }
      const item: Item = { id: slugify(name), name, kind, roll: r.roll, text, sourcePage: r.folio };
      const set = sets[t];
      if (set !== undefined) item.set = set;
      items.push(item);
    }
  }

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new ParseError(`Duplicate ${kind} id`, item.id);
    seen.add(item.id);
  }
  return items;
}

/** Both kinds at once, so their ids can be checked against each other. */
function parseTables(pages: BookPage[]): [Item[], Item[]] {
  const rows = tableRows(pages);
  const loot = toItems(rows.loot, 'loot');
  const consumables = toItems(rows.consumables, 'consumable');

  // The recipes deliberately differ from what they craft ("Mythic Dust Recipe"
  // vs "Mythic Dust"), so the bare slug is unique across both kinds today - in
  // both books, across all four of SRD 2.0's tables.
  const lootIds = new Set(loot.map((i) => i.id));
  for (const item of consumables) {
    if (lootIds.has(item.id)) {
      throw new ParseError('Item id collides across the loot and consumable tables', item.id);
    }
  }
  return [loot, consumables];
}

export function parseLoot(pages: BookPage[]): Item[] {
  return parseTables(pages)[0];
}

export function parseConsumables(pages: BookPage[]): Item[] {
  return parseTables(pages)[1];
}
