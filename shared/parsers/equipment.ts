/**
 * Weapons, the Combat Wheelchair and armor.
 *
 * These are the only pages whose meaning lives entirely in the geometry. A cell
 * wraps onto its own line, so the de-columnised `Line` stream splices unrelated
 * cells together ("Improved Spear Finesse Very Close", "Shortsword Melee
 * range"). Everything below therefore works from `page.runs`: columns come from
 * the x of the printed header words, rows from the y of the second column,
 * which is the one cell in every table that never wraps.
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
import { parseContents, rangeBetween } from './contents.ts';

/** Contents entries, oldest book's wording first. */
const WEAPONS_SECTION = ['Weapons'] as const;
const WHEELCHAIR_SECTION = ['Combat Wheelchair'] as const;
const ARMOR_SECTION = ['Armor'] as const;
/** SRD 1.0 prints `Loot`; SRD 2.0 renamed it `Loot & Items`. */
const AFTER_ARMOR = ['Loot', 'Loot & Items'] as const;

const WEAPON_COLUMNS = ['Name', 'Trait', 'Range', 'Damage', 'Burden', 'Feature'] as const;
const WHEELCHAIR_COLUMNS = [
  'Name',
  'Tier',
  'Trait',
  'Range',
  'Damage',
  'Burden',
  'Feature',
] as const;
const ARMOR_COLUMNS = ['Name', 'Thresholds', 'Score', 'Feature'] as const;

/** The banners the tables are filed under, none of which the contents lists. */
const SLOT_BANNER = /^(PRIMARY|SECONDARY) WEAPON TABLES$/;
const TIER_BANNER = /^TIER (\d)\b/;
const CATEGORY_BANNER = /^(Physical|Magic) Weapons$/;
const FRAME_BANNER = /^(Light|Heavy|Arcane) Frame Models$/;

/** A cell's first line sits ~0.6pt above its row anchor; rows are >=13pt apart. */
const ROW_TOL = 5;
/** Body runs start ~1.7pt left of their header word; columns are >40pt apart. */
const COL_TOL = 5;
/** Two runs this close in y are on the same visual line. */
const LINE_TOL = 3;
/** Point size at or above which a run is a banner, never table content. */
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
  columns: readonly string[],
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

  // The second column never wraps, so its baselines are the row anchors.
  const anchors: number[] = [];
  for (const r of body.filter((r) => columnOf(r) === 1).sort((a, b) => a.y - b.y)) {
    if (anchors.length === 0 || r.y - anchors[anchors.length - 1]! > LINE_TOL) anchors.push(r.y);
  }
  if (anchors.length === 0) return [];

  const grid: TextRun[][][] = anchors.map(() => columns.map(() => []));
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
 * The rows above the first header on a page: the tail of a table that began on
 * an earlier page and was not given a fresh header here.
 *
 * The region ends at the topmost banner above that header - on SRD 2.0 folio 73
 * the TIER 3 banner - or at the header itself when there is none.
 */
function continuedRows(page: BookPage, columns: readonly string[], heading: TextRun[]): Row[] {
  const headerY = heading[0]!.y;
  let bottom = headerY;
  for (const r of page.runs) {
    if (r.size >= BANNER_SIZE && r.y < headerY - LINE_TOL) bottom = Math.min(bottom, r.y);
  }
  return gridRows(
    page,
    columns,
    heading.map((r) => r.x - COL_TOL),
    -Infinity,
    bottom - LINE_TOL,
  );
}

/**
 * Every band of rows in a folio range, in reading order.
 *
 * A page that carries no table is only allowed to be leading prose - see the
 * file docblock for the two conditions and what they were measured against.
 */
function readBands(
  pages: BookPage[],
  range: { from: number; to: number },
  columns: readonly string[],
): Band[] {
  const out: Band[] = [];
  let pending: Line[] = [];
  /**
   * Some earlier page in this range carried a table.
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
  let open = false;

  for (const page of pagesInFolios(pages, range.from, range.to)) {
    const folio = page.folio!;
    const headings = tableHeadings(page);

    if (headings.length === 0) {
      if (open || page.runs.some(isTableType)) {
        throw new ParseError(
          `no ${columns.join('/')} table on folio ${folio}`,
          `${page.lines.length} lines`,
        );
      }
      pending.push(...bannersBetween(page, -Infinity, Infinity));
      continue;
    }

    for (const heading of headings) {
      const labels = heading.map((r) => r.text);
      if (labels.length !== columns.length || labels.some((l, k) => l !== columns[k])) {
        throw new ParseError(`unexpected table header on folio ${folio}`, labels.join(' | '));
      }
    }

    if (open) {
      // No banner can be above this block: the block stops at the first one.
      const rows = continuedRows(page, columns, headings[0]!);
      if (rows.length > 0) {
        out.push({ folio, rows, banners: pending });
        pending = [];
      }
    }

    let prevY = -Infinity;
    for (const [i, heading] of headings.entries()) {
      const headerY = heading[0]!.y;
      pending.push(...bannersBetween(page, prevY, headerY));

      // A table runs until the next header or the next banner, whichever is first.
      const nextBanner = page.runs
        .filter((r) => r.size >= BANNER_SIZE && r.y > headerY + LINE_TOL)
        .reduce((min, r) => Math.min(min, r.y), Infinity);
      const bottom = Math.min(headings[i + 1]?.[0]!.y ?? Infinity, nextBanner, page.height);

      const rows = gridRows(
        page,
        columns,
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
      out.push({ folio, rows, banners: pending });
      pending = [];
      prevY = headerY;
    }
    pending.push(...bannersBetween(page, prevY, Infinity));
    open = true;
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
      `no ${columns.join('/')} table anywhere in folios ${range.from}-${range.to}`,
      `${pagesInFolios(pages, range.from, range.to).length} pages, none carrying a table header`,
    );
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

  for (const band of readBands(pages, rangeBetween(toc, WEAPONS_SECTION, WHEELCHAIR_SECTION), WEAPON_COLUMNS)) {
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
      const c = named(row, WEAPON_COLUMNS);
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
  for (const band of readBands(pages, rangeBetween(toc, WHEELCHAIR_SECTION, ARMOR_SECTION), WHEELCHAIR_COLUMNS)) {
    for (const line of band.banners) {
      const f = FRAME_BANNER.exec(normalizeText(line.text));
      if (f) frame = f[1]!;
    }
    if (frame === null) {
      throw new ParseError(`no frame banner above a wheelchair table`, `folio ${band.folio}`);
    }
    const category = frame === 'Arcane' ? 'Magic' : 'Physical';
    for (const row of band.rows) {
      const c = named(row, WHEELCHAIR_COLUMNS);
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

  assertUniqueIds(out, 'weapon');
  return out;
}

export function parseArmors(pages: BookPage[]): Armor[] {
  const toc = parseContents(pages);
  const out: Armor[] = [];
  let tier: Tier | null = null;

  for (const band of readBands(pages, rangeBetween(toc, ARMOR_SECTION, AFTER_ARMOR), ARMOR_COLUMNS)) {
    for (const line of band.banners) {
      const t = TIER_BANNER.exec(normalizeText(line.text));
      if (t) tier = toTier(t[1]!, `folio ${band.folio}`);
    }
    if (tier === null) {
      throw new ParseError(`no tier banner above a table on folio ${band.folio}`, band.rows[0]!.where);
    }
    for (const row of band.rows) {
      const c = named(row, ARMOR_COLUMNS);
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
