/**
 * Weapons (folios 45-55) and armor (folios 56-57).
 *
 * These are the only pages whose meaning lives entirely in the geometry. A cell
 * wraps onto its own line, so the de-columnised `Line` stream splices unrelated
 * cells together ("Improved Spear Finesse Very Close", "Shortsword Melee
 * range"). Everything below therefore works from `page.runs`: columns come from
 * the x of the printed header words, rows from the y of the second column,
 * which is the one cell in every table that never wraps.
 */
import { slugify } from '../slugify.ts';
import type { BookPage, TextRun } from '../textLayout.ts';
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

const PRIMARY_FOLIOS = [45, 51] as const;
const SECONDARY_FOLIOS = [52, 53] as const;
const WHEELCHAIR_FOLIOS = [54, 55] as const;
const ARMOR_FOLIOS = [56, 57] as const;

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

interface Table {
  folio: number;
  /** Top of the header row, so callers can find the banners above it. */
  headerY: number;
  rows: Row[];
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

/**
 * Read every table on a page whose header words are exactly `columns`.
 *
 * Armor sets its header over two lines ("Base" / "Base" above "Name
 * Thresholds Score Feature"); only the line carrying "Name" defines the grid,
 * and the spill line above it is left out of the body by construction.
 */
function readTables(page: BookPage, columns: readonly string[]): Table[] {
  const folio = page.folio!;
  const headings = byLine(
    page.runs.filter((r) => r.family.startsWith('Eveleth') && r.size < BANNER_SIZE),
  ).filter((l) => l[0]!.text === 'Name');

  const out: Table[] = [];
  for (const [i, heading] of headings.entries()) {
    const labels = heading.map((r) => r.text);
    if (labels.length !== columns.length || labels.some((l, k) => l !== columns[k])) {
      throw new ParseError(`unexpected table header on folio ${folio}`, labels.join(' | '));
    }
    const headerY = heading[0]!.y;
    const bounds = heading.map((r) => r.x - COL_TOL);

    // A table runs until the next header or the next banner, whichever is first.
    const nextBanner = page.runs
      .filter((r) => r.size >= BANNER_SIZE && r.y > headerY + LINE_TOL)
      .reduce((min, r) => Math.min(min, r.y), Infinity);
    const bottom = Math.min(headings[i + 1]?.[0]!.y ?? Infinity, nextBanner, page.height);

    const body = page.runs.filter((r) => r.y > headerY + LINE_TOL && r.y < bottom - LINE_TOL);
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
    if (anchors.length === 0) {
      throw new ParseError(`no rows under the table header on folio ${folio}`, labels.join(' | '));
    }

    const grid: TextRun[][][] = anchors.map(() => columns.map(() => []));
    for (const r of body) {
      let row = -1;
      for (let k = 0; k < anchors.length; k++) if (r.y >= anchors[k]! - ROW_TOL) row = k;
      if (row < 0) {
        throw new ParseError(`run above the first row on folio ${folio}`, `${r.text} @ y=${r.y}`);
      }
      grid[row]![columnOf(r)]!.push(r);
    }

    out.push({
      folio,
      headerY,
      rows: grid.map((cells) => {
        const text = cells.map(cellText);
        return { cells: text, where: `folio ${folio}: ${text.join(' | ')}` };
      }),
    });
  }
  // Every folio these are called on carries at least one table. Finding none
  // means the header row changed shape, and silently yielding no rows would
  // hide a whole page of missing equipment.
  if (out.length === 0) {
    throw new ParseError(`no ${columns.join('/')} table on folio ${folio}`, `${page.lines.length} lines`);
  }
  return out;
}

/** The last banner above `y` matching `re`, or null. */
function bannerAbove(page: BookPage, y: number, re: RegExp): RegExpExecArray | null {
  let best: { y: number; m: RegExpExecArray } | null = null;
  for (const l of page.lines) {
    if (l.y >= y) continue;
    const m = re.exec(normalizeText(l.text));
    if (m && (best === null || l.y > best.y)) best = { y: l.y, m };
  }
  return best?.m ?? null;
}

function tierAbove(page: BookPage, y: number): Tier {
  const m = bannerAbove(page, y, /^TIER (\d)\b/);
  if (!m) throw new ParseError(`no tier banner above a table on folio ${page.folio}`, `y=${y}`);
  return toTier(m[1]!, `folio ${page.folio}`);
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

/** "d10+7 phy" -> die and type. Ghostblade prints "d10+7 phy or mag". */
function toDamage(s: string, where: string): { damage: string; damageType: DamageKind } {
  const m = /^(d\d+(?:[+-]\d+)?) (phy|mag|phy or mag)$/.exec(s);
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
  const out: Weapon[] = [];

  for (const [folios, slot] of [
    [PRIMARY_FOLIOS, 'primary'],
    [SECONDARY_FOLIOS, 'secondary'],
  ] as const) {
    for (const page of pagesInFolios(pages, folios[0], folios[1])) {
      for (const table of readTables(page, WEAPON_COLUMNS)) {
        const tier = tierAbove(page, table.headerY);
        // Primary tables are split under a "Physical Weapons" / "Magic Weapons"
        // banner; the secondary tables have no such split, and there the damage
        // type is the only thing that says which category a weapon is in.
        const banner = bannerAbove(page, table.headerY, /^(Physical|Magic) Weapons$/);
        for (const row of table.rows) {
          const c = named(row, WEAPON_COLUMNS);
          const { damageType } = toDamage(c.damage!, row.where);
          const category = banner
            ? (banner[1] as Weapon['category'])
            : damageType === 'mag'
              ? 'Magic'
              : 'Physical';
          out.push(weaponFrom(row, c, { folio: table.folio, tier, slot, category }));
        }
      }
    }
  }

  // The Combat Wheelchair sidebar: three tables of primary weapons carrying
  // their tier in a column of their own instead of in a banner.
  for (const page of pagesInFolios(pages, WHEELCHAIR_FOLIOS[0], WHEELCHAIR_FOLIOS[1])) {
    for (const table of readTables(page, WHEELCHAIR_COLUMNS)) {
      const frame = bannerAbove(page, table.headerY, /^(Light|Heavy|Arcane) Frame Models$/);
      if (!frame) {
        throw new ParseError(`no frame banner above a wheelchair table`, `folio ${table.folio}`);
      }
      const category = frame[1] === 'Arcane' ? 'Magic' : 'Physical';
      for (const row of table.rows) {
        const c = named(row, WHEELCHAIR_COLUMNS);
        out.push(
          weaponFrom(row, c, {
            folio: table.folio,
            tier: toTier(c.tier!, row.where),
            // "All combat wheelchairs are equipped as Primary Weapons."
            slot: 'primary',
            category,
          }),
        );
      }
    }
  }

  assertUniqueIds(out, 'weapon');
  return out;
}

export function parseArmors(pages: BookPage[]): Armor[] {
  const out: Armor[] = [];
  for (const page of pagesInFolios(pages, ARMOR_FOLIOS[0], ARMOR_FOLIOS[1])) {
    for (const table of readTables(page, ARMOR_COLUMNS)) {
      const tier = tierAbove(page, table.headerY);
      for (const row of table.rows) {
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
          sourcePage: table.folio,
        });
      }
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
