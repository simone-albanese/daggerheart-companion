/**
 * The optional-module equipment: SRD 2.0 folios 191, 192, 197 and 201.
 *
 * Three chapters of `Supplemental Campaign Mechanics` print weapon and armor
 * tables in the two shapes `shared/parsers/equipment.ts` already reads. What is
 * asserted here is the four things about them that the base chapters never made
 * anyone deal with, each of which had a wrong first answer:
 *
 * 1. the pages are NOT a folio range - the chapter's other sub-chapters print
 *    tables of other kinds in the same header face, so a range meets the
 *    no-table throw on nine pages;
 * 2. one page carries two different table shapes (192, 201);
 * 3. one printed row carries four tier statlines in a single cell, which the
 *    main chapter prints as four rows in four tier tables;
 * 4. the armor row anchor is the Name, not the second column, because the
 *    second column is where that ladder is printed.
 *
 * The counts here are the ones in `REVISION_COUNTS`, and they were counted on
 * the page first: 43 printed weapon rows and 7 printed armor rows, becoming 76
 * and 16 records because 11 weapon rows and 3 armor rows print four tiers each.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArmors, parseWeapons } from '../../shared/parsers/equipment.ts';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';
import type { Armor, Weapon } from '../../shared/types.ts';

// ---------------------------------------------------------------------------
// A book built by hand, for the properties a real book states only once
// ---------------------------------------------------------------------------

const run = (
  text: string,
  x: number,
  y: number,
  size: number,
  family: string,
): TextRun => ({
  x,
  y,
  w: text.length * (size / 2),
  h: size,
  text,
  family,
  size,
  bold: false,
  italic: false,
});
/** A header word: the small display face every one of these tables is set in. */
const head = (text: string, x: number, y: number): TextRun =>
  run(text, x, y, 8, 'EvelethCleanRegular');
/** A body cell: 8pt, the size the whole table is set in. */
const cell = (text: string, x: number, y: number): TextRun =>
  run(text, x, y, 8, 'QuestaSans');
/** A banner: anything the book sets larger than the table. */
const banner = (text: string, x: number, y: number, size = 11.3): TextRun =>
  run(text, x, y, size, 'QuestaSans');

const asLine = (r: TextRun): Line => ({
  text: r.text,
  x: r.x,
  y: r.y,
  w: r.w,
  size: r.size,
  family: r.family,
  bold: false,
  italic: false,
  column: 0,
  runs: [r],
});
const sheet = (folio: number, runs: TextRun[]): BookPage => ({
  index: folio,
  folio,
  pdfPage: folio,
  side: 'single',
  width: 612,
  height: 792,
  columns: 1,
  lines: runs.map(asLine),
  runs,
});

/**
 * A contents page. `Armor`/`Loot` bound the base armor chapter; the rest are
 * the module sub-entries whose folios attribute a run.
 */
const contents = (...entries: string[]): BookPage =>
  sheet(
    1,
    ['CONTENTS', ...entries].map((t, i) => run(t, 60, 20 + i * 14, 9, 'QuestaSans-Light')),
  );

/** The base armor chapter, so the module reader has something to exclude. */
const baseArmor = (folio: number): BookPage =>
  sheet(folio, [
    run('TIER 1 (LEVEL 1)', 60, 50, 12, 'EvelethCleanThin'),
    head('Name', 60, 100),
    head('Thresholds', 170, 100),
    head('Score', 240, 100),
    head('Feature', 290, 100),
    cell('Base Armor', 60, 120),
    cell('4 / 10', 170, 120),
    cell('2', 245, 120),
    cell('Flexible: +1 to Evasion', 290, 120),
  ]);

/** A module armor table, given the cells of its one row. */
const moduleArmor = (
  folio: number,
  row: { name: string; thresholds: string[]; score: string[]; feature: string },
  extra: TextRun[] = [],
): BookPage =>
  sheet(folio, [
    banner('Armor', 56, 50),
    head('Name', 60, 100),
    head('Thresholds', 170, 100),
    head('Score', 240, 100),
    head('Feature', 290, 100),
    cell(row.name, 60, 120),
    ...row.thresholds.map((t, i) => cell(t, 170, 120 + i * 10)),
    ...row.score.map((s, i) => cell(s, 245, 120 + i * 10)),
    cell(row.feature, 290, 120),
    ...extra,
  ]);

const PLAIN = { name: 'Module Armor', thresholds: ['5 / 11'], score: ['3'], feature: 'Quiet: +1' };
const LADDER = {
  name: 'Ladder Armor',
  thresholds: ['Tier 1: 4/10', 'Tier 2: 6/15', 'Tier 3: 8/22', 'Tier 4: 10/31'],
  score: ['Tier 1: 3', 'Tier 2: 4', 'Tier 3: 5', 'Tier 4: 6'],
  feature: 'Splintering: something',
};

const TOC = ['Armor 2', 'Loot 3', 'Test Module 6', 'Next Section 9'];

/**
 * A module WEAPON table. Weapons need a slot, and no contents entry names one:
 * it comes from a `Primary Weapons` / `Secondary Weapons` banner the page
 * prints. `withBanner: false` is a page that carries the table and not the
 * banner, which is what the throw below exists for.
 */
const moduleWeapon = (folio: number, withBanner: boolean): BookPage =>
  sheet(folio, [
    ...(withBanner ? [banner('Primary Weapons', 56, 40)] : []),
    banner('TIER 1', 56, 60, 12),
    head('Name', 60, 100),
    head('Trait', 150, 100),
    head('Range', 210, 100),
    head('Damage', 270, 100),
    head('Burden', 340, 100),
    head('Feature', 410, 100),
    cell('Module Blade', 60, 120),
    cell('Agility', 150, 120),
    cell('Melee', 210, 120),
    cell('d8 phy', 270, 120),
    cell('One-Handed', 340, 120),
    cell('Reliable: +1 to attack rolls', 410, 120),
  ]);

describe('which pages carry module equipment', () => {
  it('takes a table outside the base ranges, and names it after the section it starts in', () => {
    const armors = parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, PLAIN)]);
    expect(armors.map((a) => a.name)).toEqual(['Base Armor', 'Module Armor']);
    expect(armors[0]!.module).toBeUndefined();
    expect(armors[1]!.module).toBe('Test Module');
  });

  it('leaves a book with no such chapter alone, rather than inventing one', () => {
    const armors = parseArmors([contents('Armor 2', 'Loot 3'), baseArmor(2)]);
    expect(armors.map((a) => a.name)).toEqual(['Base Armor']);
    expect(armors.every((a) => a.module === undefined)).toBe(true);
  });

  it('refuses an equipment table on a folio the contents page does not name', () => {
    expect(() =>
      parseArmors([contents('Armor 2', 'Loot 3', 'Test Module 6'), baseArmor(2), moduleArmor(7, PLAIN)]),
    ).toThrow(/folio 7 belongs to no section the contents page names/);
  });

  it('refuses a run that reaches past the section the contents says comes next', () => {
    // Test Module 6, Next Section 9: a run of 6-7-8-9-10 overshoots.
    const pages = [contents(...TOC), baseArmor(2)];
    for (const f of [6, 7, 8, 9, 10]) pages.push(moduleArmor(f, PLAIN));
    expect(() => parseArmors(pages)).toThrow(
      /"Test Module" equipment runs to folio 10, past "Next Section" on folio 9/,
    );
  });

  it('reads an armor chapter from a book that has no Weapons chapter at all', () => {
    // The excluded ranges are for excluding. Requiring all three made reading
    // ARMOR depend on the book having WEAPONS, which is not a real dependency.
    const armors = parseArmors([contents('Armor 2', 'Loot 3'), baseArmor(2)]);
    expect(armors).toHaveLength(1);
  });
});

describe('a row that prints every tier at once', () => {
  it('becomes one record per printed tier, each keeping the printed name', () => {
    const armors = parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, LADDER)]).filter(
      (a) => a.module !== undefined,
    );
    expect(armors).toHaveLength(4);
    expect(new Set(armors.map((a) => a.name))).toEqual(new Set(['Ladder Armor']));
    expect(armors.map((a) => a.id)).toEqual([
      'ladder-armor-tier-1',
      'ladder-armor-tier-2',
      'ladder-armor-tier-3',
      'ladder-armor-tier-4',
    ]);
    expect(armors.map((a) => [a.tier, ...a.baseThresholds, a.baseScore])).toEqual([
      [1, 4, 10, 3],
      [2, 6, 15, 4],
      [3, 8, 22, 5],
      [4, 10, 31, 6],
    ]);
  });

  it('takes tier 1 when the book prints no tier, and says so nowhere else', () => {
    const armors = parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, PLAIN)]);
    expect(armors[1]).toEqual({
      id: 'module-armor',
      name: 'Module Armor',
      tier: 1,
      baseThresholds: [5, 11],
      baseScore: 3,
      feature: 'Quiet: +1',
      sourcePage: 6,
      module: 'Test Module',
    });
  });

  it('refuses a ladder that is not tiers 1 to 4 in order', () => {
    const short = { ...LADDER, thresholds: LADDER.thresholds.slice(0, 3), score: LADDER.score.slice(0, 3) };
    expect(() => parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, short)])).toThrow(
      /must print tiers 1-4 in order, and this prints 1\/2\/3/,
    );
  });

  it('refuses a row that scales in one cell and not the other', () => {
    const half = { ...LADDER, score: ['3'] };
    expect(() => parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, half)])).toThrow(
      /scales in one cell and not the other/,
    );
  });
});

describe('where a table stops', () => {
  it('ends at the first thing set larger than it, not at the first banner', () => {
    /*
     * SRD 2.0 folio 197 follows the Western secondary table with a 9.3pt
     * paragraph and no banner between. 9.3 is under the 10pt banner floor, so
     * the old rule read those lines as table rows and glued them into the last
     * record's cells.
     */
    const prose = [
      run('You can also make the following consumable available:', 60, 200, 9.3, 'QuestaSans-Light'),
      run('Dynamite: (Consumable) You can light this and toss it.', 60, 212, 9.3, 'QuestaSans-Light'),
    ];
    const armors = parseArmors([contents(...TOC), baseArmor(2), moduleArmor(6, PLAIN, prose)]);
    expect(armors[1]!.feature).toBe('Quiet: +1');
    expect(armors[1]!.name).toBe('Module Armor');
    expect(armors).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// The book itself
// ---------------------------------------------------------------------------

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const load = async (i: number): Promise<BookPage[]> =>
  (await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages;

const rows = (items: ReadonlyArray<{ name: string; module?: string }>): number =>
  new Set(items.map((i) => `${i.module}|${i.name}`)).size;

describe.skipIf(!have(0))('SRD 1.0, which has no optional modules', () => {
  it('finds no module equipment, and its base equipment is untouched', async () => {
    const pages = await load(0);
    const weapons = parseWeapons(pages);
    const armors = parseArmors(pages);
    expect(weapons.filter((w) => w.module !== undefined)).toEqual([]);
    expect(armors.filter((a) => a.module !== undefined)).toEqual([]);
    expect(weapons.length).toBe(204);
    expect(armors.length).toBe(34);
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0 folios 191, 192, 197 and 201', () => {
  it('reads 43 printed weapon rows and 7 printed armor rows, from four folios', async () => {
    const pages = await load(1);
    const weapons = parseWeapons(pages).filter((w) => w.module !== undefined);
    const armors = parseArmors(pages).filter((a) => a.module !== undefined);

    expect([...new Set([...weapons, ...armors].map((r) => r.sourcePage))].sort()).toEqual([
      191, 192, 197, 201,
    ]);
    expect(rows(weapons)).toBe(43);
    expect(rows(armors)).toBe(7);
    expect(weapons).toHaveLength(76);
    expect(armors).toHaveLength(16);
  }, 120_000);

  it('files each table under the contents-page title of its own chapter', async () => {
    const pages = await load(1);
    const weapons = parseWeapons(pages).filter((w) => w.module !== undefined);
    const armors = parseArmors(pages).filter((a) => a.module !== undefined);
    const per = (m: string): [number, number, number, number] => [
      weapons.filter((w) => w.module === m).length,
      rows(weapons.filter((w) => w.module === m)),
      armors.filter((a) => a.module === m).length,
      rows(armors.filter((a) => a.module === m)),
    ];
    // records, printed rows, records, printed rows
    expect(per('Everyday Hero Starting Equipment')).toEqual([32, 32, 4, 4]);
    expect(per('Western Campaigns')).toEqual([20, 5, 0, 0]);
    expect(per('Monster Hunting Campaigns')).toEqual([24, 6, 12, 3]);
  }, 120_000);

  it('keeps Everyday Hero on folio 192, where the contents page starts Feasts', async () => {
    /*
     * The Secondary Weapons and Armor tables are printed above the `Feasts`
     * banner on the folio the contents gives to Feasts. Attributing by folio
     * alone files eleven of Everyday Hero's records under the wrong chapter.
     */
    const pages = await load(1);
    const onF192 = [
      ...parseWeapons(pages).filter((w) => w.sourcePage === 192 && w.module !== undefined),
      ...parseArmors(pages).filter((a) => a.sourcePage === 192 && a.module !== undefined),
    ];
    expect(onF192).toHaveLength(11);
    expect(new Set(onF192.map((r) => r.module))).toEqual(
      new Set(['Everyday Hero Starting Equipment']),
    );
  }, 120_000);

  it('reads both table shapes off one page', async () => {
    const pages = await load(1);
    const w = parseWeapons(pages).filter((x) => x.sourcePage === 201 && x.module !== undefined);
    const a = parseArmors(pages).filter((x) => x.sourcePage === 201 && x.module !== undefined);
    // Folio 201 prints two weapon tables and an armor table, in that order.
    expect(rows(w)).toBe(6);
    expect(rows(a)).toBe(3);
    expect(w.filter((x) => x.slot === 'primary').length).toBe(12);
    expect(w.filter((x) => x.slot === 'secondary').length).toBe(12);
  }, 120_000);

  it('gives three armors on folio 201, not twelve rows of one tier each', async () => {
    /*
     * The anchor. Base Thresholds carries the ladder there, four lines to the
     * Name's one, so anchoring on the second column cuts each armor into four
     * rows and leaves three of them nameless.
     */
    const pages = await load(1);
    const a = parseArmors(pages).filter((x) => x.sourcePage === 201);
    expect(a.map((x) => x.name)).toEqual([
      'Coffinwood Armor', 'Coffinwood Armor', 'Coffinwood Armor', 'Coffinwood Armor',
      'Leather Longcoat', 'Leather Longcoat', 'Leather Longcoat', 'Leather Longcoat',
      'Silverweave Armor', 'Silverweave Armor', 'Silverweave Armor', 'Silverweave Armor',
    ]);
    expect(a.every((x) => x.name !== '')).toBe(true);
  }, 120_000);

  it('keeps the Dynamite paragraph out of the last Western weapon', async () => {
    /*
     * Folio 197 ends its secondary table and then, with no banner between, sets
     * four lines of 9.3pt prose. Under a 10pt banner floor they are table rows.
     */
    const pages = await load(1);
    const small = parseWeapons(pages).filter((w) => w.name === 'Small Revolver');
    expect(small).toHaveLength(4);
    for (const w of small) {
      expect(w.feature).toBe(
        'Quick Shot: Spend 2 Hope to gain a +4 bonus to primary weapon damage.',
      );
      expect(w.range).toBe('Far');
      expect(w.burden).toBe(1);
    }
    expect(small.map((w) => w.damage)).toEqual(['d6', 'd6+3', 'd6+6', 'd6+9']);
  }, 120_000);

  it('reads the Everyday Hero rows exactly as folio 191 prints them', async () => {
    const pages = await load(1);
    const eh = parseWeapons(pages).filter(
      (w) => w.module === 'Everyday Hero Starting Equipment',
    );
    const whole = (name: string): Weapon => eh.find((w) => w.name === name)!;
    expect(whole('Cleaver')).toEqual({
      id: 'cleaver',
      name: 'Cleaver',
      tier: 1,
      slot: 'primary',
      category: 'Physical',
      trait: 'agility',
      range: 'Melee',
      damage: 'd8',
      damageType: 'phy',
      burden: 1,
      feature: 'Reliable: +1 to attack rolls',
      sourcePage: 191,
      module: 'Everyday Hero Starting Equipment',
    });
    // The `Primary Magic Weapons` banner, which is the only thing on the page
    // that says these are Magic: their traits are ordinary ones.
    expect(whole('Enchanted Hammer')).toMatchObject({
      category: 'Magic',
      trait: 'strength',
      damage: 'd10+1',
      damageType: 'mag',
      slot: 'primary',
    });
    // Two names that wrap onto a second line, which is why a weapon table
    // cannot anchor its rows on the Name column.
    expect(eh.map((w) => w.name)).toContain('Sharpened Rake');
    expect(eh.map((w) => w.name)).toContain('Firework Launcher');
    // The whole chapter is one tier, because the chapter prints none.
    expect(new Set(eh.map((w) => w.tier))).toEqual(new Set([1]));
  }, 120_000);

  it('reads the Western Revolver as the four statlines folio 197 prints', async () => {
    const pages = await load(1);
    const rev = parseWeapons(pages).filter((w) => w.name === 'Revolver');
    expect(rev.map((w) => [w.tier, w.damage])).toEqual([
      [1, 'd8+1'],
      [2, 'd8+4'],
      [3, 'd8+7'],
      [4, 'd8+10'],
    ]);
    expect(new Set(rev.map((w) => w.id))).toEqual(
      new Set(['revolver-tier-1', 'revolver-tier-2', 'revolver-tier-3', 'revolver-tier-4']),
    );
    for (const w of rev) {
      expect(w.module).toBe('Western Campaigns');
      expect(w.slot).toBe('primary');
      expect(w.trait).toBe('finesse');
      expect(w.range).toBe('Far');
      expect(w.sourcePage).toBe(197);
    }
  }, 120_000);

  it('reads Monster Hunting armor as the four statlines folio 201 prints', async () => {
    const pages = await load(1);
    const coffin = parseArmors(pages).filter((a) => a.name === 'Coffinwood Armor');
    expect(coffin.map((a) => [a.tier, ...a.baseThresholds, a.baseScore])).toEqual([
      [1, 4, 10, 3],
      [2, 6, 15, 4],
      [3, 8, 22, 5],
      [4, 10, 31, 6],
    ]);
    expect(coffin[3]).toEqual({
      id: 'coffinwood-armor-tier-4',
      name: 'Coffinwood Armor',
      tier: 4,
      baseThresholds: [10, 31],
      baseScore: 6,
      feature:
        'Splintering: Gain a bonus to your damage thresholds equal to your unmarked Armor Slots.',
      sourcePage: 201,
      module: 'Monster Hunting Campaigns',
    });
  }, 120_000);

  it('adds to the base chapters without touching them', async () => {
    const pages = await load(1);
    const weapons = parseWeapons(pages);
    const armors = parseArmors(pages);
    expect(weapons.filter((w) => w.module === undefined)).toHaveLength(315);
    expect(armors.filter((a) => a.module === undefined)).toHaveLength(69);
    // No base record strayed onto a module folio, and no module record onto a
    // base one: the two populations are separated by the page they are on.
    const base = [...weapons, ...armors].filter((r) => r.module === undefined);
    expect(base.some((r) => (r.sourcePage ?? 0) >= 190)).toBe(false);
    const mod: Array<Weapon | Armor> = [...weapons, ...armors].filter(
      (r) => r.module !== undefined,
    );
    expect(mod.every((r) => (r.sourcePage ?? 0) >= 190)).toBe(true);
  }, 120_000);

  it('gives every module record an id nothing else in the dataset uses', async () => {
    const pages = await load(1);
    const ids = [...parseWeapons(pages), ...parseArmors(pages)].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, 120_000);
});

/*
 * A THROW WITH NO CHECK BEHIND IT, until now.
 *
 * The module weapon reader refuses a weapon table it cannot give a slot to. An
 * independent verifier demoted that throw to `slot = 'primary'` -- removing
 * exactly one behaviour -- and the entire composed suite stayed green at 4370
 * passing, with both build gates unchanged. A guard nothing can fail is a
 * comment with a `throw` in it.
 *
 * The consequence it guards is not an exception: it is 43 module weapons
 * silently filed as primary, on a page where the book prints Secondary.
 */
describe('a module weapon table with no slot banner above it', () => {
  /*
   * `parseWeapons` reads three base ranges before it ever looks at a module, so
   * the fixture has to give it a whole small book: Weapons, Combat Wheelchair
   * and Armor, each with one table, then the module folio outside all three.
   */
  const TOC_W = ['Weapons 2', 'Combat Wheelchair 3', 'Armor 4', 'Loot 5', 'Test Module 6', 'Next Section 9'];

  const baseWeapons = (folio: number): BookPage =>
    sheet(folio, [
      banner('PRIMARY WEAPON TABLES', 56, 30, 12),
      banner('TIER 1', 56, 45, 11.5),
      banner('Physical Weapons', 56, 60),
      head('Name', 60, 100), head('Trait', 150, 100), head('Range', 210, 100),
      head('Damage', 270, 100), head('Burden', 340, 100), head('Feature', 410, 100),
      cell('Base Blade', 60, 120), cell('Agility', 150, 120), cell('Melee', 210, 120),
      cell('d8 phy', 270, 120), cell('One-Handed', 340, 120), cell('Reliable: +1', 410, 120),
    ]);

  const wheelchair = (folio: number): BookPage =>
    sheet(folio, [
      banner('Light Frame Models', 56, 60),
      head('Name', 60, 100), head('Tier', 130, 100), head('Trait', 175, 100),
      head('Range', 235, 100), head('Damage', 290, 100), head('Burden', 355, 100),
      head('Feature', 420, 100),
      cell('Base Chair', 60, 120), cell('1', 133, 120), cell('Agility', 175, 120),
      cell('Melee', 235, 120), cell('d6 phy', 290, 120), cell('One-Handed', 355, 120),
      cell('Rolling: +1', 420, 120),
    ]);

  const book = (moduleFolio: BookPage): BookPage[] => [
    contents(...TOC_W), baseWeapons(2), wheelchair(3), baseArmor(4), moduleFolio,
  ];

  it('is refused, and the message names the module and the folio', () => {
    expect(() => parseWeapons(book(moduleWeapon(6, false)))).toThrow(
      /no Primary\/Secondary Weapons banner above a module weapon table/,
    );
    expect(() => parseWeapons(book(moduleWeapon(6, false)))).toThrow(/Test Module.*folio 6/s);
  });

  it('reads the same table when the banner is there, so the refusal is about the banner', () => {
    const weapons = parseWeapons(book(moduleWeapon(6, true)));
    expect(weapons.map((w) => [w.name, w.slot, w.module])).toEqual([
      ['Base Blade', 'primary', undefined],
      ['Base Chair', 'primary', undefined],
      ['Module Blade', 'primary', 'Test Module'],
    ]);
  });
});
