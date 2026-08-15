/**
 * The two random-item tables: Loot (folios 58-60) and Consumables (60-62).
 *
 * Both are set as wide `ROLL | name | description` grids, sometimes two grids
 * side by side on one page, so the de-columnised line stream interleaves them.
 * Everything here works from `page.runs` geometry instead: the 8pt Eveleth
 * header row of each grid gives the x anchor of its three columns, and a run's
 * x decides which cell it belongs to.
 */
import type { BookPage, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import type { Item } from '../types.ts';
import { slugify } from '../slugify.ts';
import { ParseError, normalizeText, pagesInFolios } from './util.ts';

const FROM_FOLIO = 58;
const TO_FOLIO = 62;

/**
 * Table cells are the only 8pt QuestaSans on these pages - the surrounding
 * prose (including the Gold rules sharing folio 62) is 9.3pt or display type.
 * That is what keeps a grid whose right edge is the page edge from swallowing
 * the neighbouring column.
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
      if (!/^\d{1,3}$/.test(head.text)) {
        throw new ParseError(
          `Item table roll column on folio ${folio} is not a number`,
          line.map((r) => r.text).join(' '),
        );
      }
      out.push({ roll: Number(head.text), name: '', text: '', folio });
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

/** Every table row on folios 58-62, in reading order. */
function tableRows(pages: BookPage[]): Row[] {
  const out: Row[] = [];
  for (const page of pagesInFolios(pages, FROM_FOLIO, TO_FOLIO)) {
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
    for (const g of grids) out.push(...rowsIn(page, g));
  }
  if (out.length === 0) {
    throw new ParseError('No item table rows found', `folios ${FROM_FOLIO}-${TO_FOLIO}`);
  }
  return out;
}

/**
 * The two tables both run 1..60 and are otherwise typographically identical,
 * so the roll sequence itself is the boundary: it restarts at the Consumables
 * table. Anything else means the grids were read out of order.
 */
function splitTables(rows: Row[]): [Row[], Row[]] {
  const cuts = rows
    .map((r, i) => (i > 0 && r.roll <= rows[i - 1]!.roll ? i : -1))
    .filter((i) => i > 0);
  if (cuts.length !== 1) {
    throw new ParseError(
      `Expected exactly one restart of the roll sequence across the item tables, found ${cuts.length}`,
      rows.map((r) => r.roll).join(','),
    );
  }
  return [rows.slice(0, cuts[0]), rows.slice(cuts[0])];
}

function toItems(rows: Row[], kind: Item['kind']): Item[] {
  const items = rows.map((r) => {
    const name = normalizeText(r.name);
    const text = normalizeText(r.text);
    if (name.length === 0 || text.length === 0) {
      throw new ParseError(
        `${kind} ${r.roll} on folio ${r.folio} is missing its name or description`,
        `${r.roll} | ${r.name} | ${r.text}`,
      );
    }
    return { id: slugify(name), name, kind, roll: r.roll, text, sourcePage: r.folio };
  });

  items.forEach((item, i) => {
    if (item.roll !== i + 1) {
      throw new ParseError(
        `${kind} rolls are not a complete 1..${items.length} sequence`,
        `expected ${i + 1}, got ${item.roll} (${item.name})`,
      );
    }
  });

  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new ParseError(`Duplicate ${kind} id`, item.id);
    seen.add(item.id);
  }
  return items;
}

/** Both tables at once, so their ids can be checked against each other. */
function parseTables(pages: BookPage[]): [Item[], Item[]] {
  const [lootRows, consumableRows] = splitTables(tableRows(pages));
  const loot = toItems(lootRows, 'loot');
  const consumables = toItems(consumableRows, 'consumable');

  // The recipes deliberately differ from what they craft ("Mythic Dust Recipe"
  // vs "Mythic Dust"), so the bare slug is unique across both tables today.
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
