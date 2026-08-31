/**
 * Weapons, the Combat Wheelchair and armor, read out of two books.
 *
 * The parser used to carry four folio pairs - `PRIMARY_FOLIOS = [45, 51]` and
 * three siblings - which are right for SRD 1.0 and land in *Transformations* on
 * SRD 2.0. What is asserted here is not that the new ranges exist but the three
 * things SRD 2.0 does that SRD 1.0 never does, each of which the old reader got
 * wrong in a different way:
 *
 * 1. it runs a table over a page break and reprints the header WITHOUT the tier
 *    banner (folios 58, 61, 65 carry a header at the top of the page and no
 *    banner at all),
 * 2. it runs the tier-2 armor table over a page break and reprints NEITHER
 *    (folio 73 opens with ten more tier-2 armors above its TIER 3 banner) - the
 *    silent one, which loses ten records and throws nothing,
 * 3. it renames the section the armor range stops before, `Loot` -> `Loot &
 *    Items`.
 *
 * The SRD 1.0 block is the control: the same code, the same counts, and the
 * committed dataset is the real proof (`npm run build:srd -- --check`).
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseArmors, parseWeapons } from '../../shared/parsers/equipment.ts';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

/*
 * A two-page armor chapter, built by hand.
 *
 * `readTables` used to throw on ANY page in its range that carried no table,
 * which is the property that stops a whole page of equipment going missing when
 * a header row changes shape. Both books open Weapons on a page of prose, so
 * that throw had to be relaxed once the range came from the contents instead of
 * from `const ARMOR_FOLIOS = [56, 57]`. These two fixtures pin what it was
 * relaxed TO: a page may carry no table only when it carries no run in the face
 * the header rows are set in.
 */
const erun = (text: string, x: number, y: number, size = 8): TextRun => ({
  x, y, w: text.length * 5, h: size, text, family: 'EvelethCleanRegular', size, bold: false, italic: false,
});
const brun = (text: string, x: number, y: number): TextRun => ({
  x, y, w: text.length * 4, h: 8, text, family: 'QuestaSans-Light', size: 8, bold: false, italic: false,
});
const asLine = (runs: TextRun[]): Line => ({
  text: runs.map((r) => r.text).join(' '), x: runs[0]!.x, y: runs[0]!.y, w: 400,
  size: runs[0]!.size, family: runs[0]!.family, bold: false, italic: false, column: 0, runs,
});
const sheet = (folio: number, runs: TextRun[]): BookPage => ({
  index: folio, folio, pdfPage: folio, side: 'single', width: 612, height: 792,
  columns: 1, lines: runs.map((r) => asLine([r])), runs,
});
const contentsPage = (): BookPage =>
  sheet(1, [brun('CONTENTS', 60, 20), brun('Armor 2', 60, 40), brun('Loot 4', 60, 60)]);
/** One tier-1 table with one row, headed however the caller spells it. */
const armorSheet = (folio: number, nameHeader: string): BookPage =>
  sheet(folio, [
    erun('TIER 1 (LEVEL 1)', 60, 50, 12),
    erun(nameHeader, 60, 100), erun('Thresholds', 170, 100), erun('Score', 240, 100), erun('Feature', 290, 100),
    brun('Test Armor', 60, 120), brun('4 / 10', 170, 120), brun('2', 245, 120),
    brun('Flexible: +1 to Evasion', 290, 120),
  ]);

describe('a page in the range that carries no table', () => {
  it('is prose, and only when nothing on it is set in the header face', () => {
    const prose = sheet(2, [brun('Every armor has a name, base damage thresholds,', 60, 80)]);
    const armors = parseArmors([contentsPage(), prose, armorSheet(3, 'Name')]);
    expect(armors.map((a) => a.name)).toEqual(['Test Armor']);
    expect(armors[0]!.sourcePage).toBe(3);
  });

  it('stops the build when the header row changed shape instead', () => {
    // Same page, one word different, and nothing else on it says so.
    expect(() => parseArmors([contentsPage(), armorSheet(2, 'Nome'), armorSheet(3, 'Name')])).toThrow(
      /no Name\/Thresholds\/Score\/Feature table on folio 2/,
    );
  });
});

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const load = async (i: number): Promise<BookPage[]> =>
  (await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages;

describe.skipIf(!have(0))('SRD 1.0, whose answer is already known', () => {
  it('reads the same equipment the hardcoded folios did', async () => {
    const pages = await load(0);
    const weapons = parseWeapons(pages);
    const armors = parseArmors(pages);
    expect(weapons.length).toBe(204);
    expect(armors.length).toBe(34);
    // The split that has no contents entry: folios 45-51 against 52-53.
    expect(weapons.filter((w) => w.slot === 'secondary').length).toBe(37);
    /*
     * A secondary table prints no Physical/Magic banner, so the damage decides -
     * and in THIS book every secondary weapon is physical, which is why the
     * fallback is only really exercised against SRD 2.0 below.
     */
    expect(new Set(weapons.filter((w) => w.slot === 'secondary').map((w) => w.category))).toEqual(
      new Set(['Physical']),
    );
    // The one weapon that deals either kind, kept as folio 49 sets it.
    expect(weapons.find((w) => w.name === 'Ghostblade')).toMatchObject({
      tier: 3,
      slot: 'primary',
      category: 'Magic',
      damage: 'd10+7',
      damageType: 'phy or mag',
      sourcePage: 49,
    });
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0, 224 pages where the constants pointed at 135', () => {
  it('reads every weapon and armor, including the ones no header announces', async () => {
    const pages = await load(1);
    const weapons = parseWeapons(pages);
    const armors = parseArmors(pages);

    expect(weapons.length).toBe(315);
    expect(armors.length).toBe(69);
    expect(weapons.filter((w) => w.slot === 'primary').length).toBe(242);
    expect(weapons.filter((w) => w.slot === 'secondary').length).toBe(73);

    /*
     * (1) Folio 58 prints a table header at the top and not one banner. Its
     * tier and category are three and two pages back respectively, so a reader
     * that looks for a banner "above the header, on this page" either throws or
     * mis-files 23 weapons.
     */
    const f58 = weapons.filter((w) => w.sourcePage === 58);
    expect(f58.length).toBe(23);
    expect(new Set(f58.map((w) => `${w.slot}/t${w.tier}/${w.category}`))).toEqual(
      new Set(['primary/t2/Physical']),
    );

    /*
     * (2) Folio 73 opens with the tail of the tier-2 armor table - ten records
     * with no header of their own, printed above the TIER 3 banner. Losing them
     * is silent, so the whole tenth record is here rather than a count.
     */
    const carried = armors.filter((a) => a.sourcePage === 73 && a.tier === 2);
    expect(carried.map((a) => a.name)).toEqual([
      'Stormthread Habit',
      'Elundrian Chain Armor',
      'Harrowbone Armor',
      'Irontree Breastplate Armor',
      'Runetan Floating Armor',
      'Tyris Soft Armor',
      'Wyrdwood Splint Armor',
      'Rosewild Armor',
      'Trollhide Cuirass',
      'Gilded Sunplate',
    ]);
    expect(armors.find((a) => a.id === 'gilded-sunplate')).toEqual({
      id: 'gilded-sunplate',
      name: 'Gilded Sunplate',
      tier: 2,
      baseThresholds: [12, 26],
      baseScore: 5,
      feature:
        'Resplendent: Once per scene when you spend Hope, you can clear an Armor Slot.',
      sourcePage: 73,
    });

    /*
     * (3) The armor range stops before the section SRD 1.0 calls `Loot` and
     * this book calls `Loot & Items`. Get that wrong and folio 75 - the LOOT
     * page, whose table is headed ROLL - joins the range and stops the build.
     */
    expect(armors.filter((a) => a.tier === 4).map((a) => a.sourcePage)).toEqual(
      Array.from({ length: 20 }, () => 74),
    );

    // The slot banner, which is the only thing on the page that says which is
    // which: the primary tier-4 magic table's tail and the first secondary
    // table share folio 66.
    const f66 = weapons.filter((w) => w.sourcePage === 66);
    expect(f66.filter((w) => w.slot === 'primary').length).toBe(4);
    expect(f66.filter((w) => w.slot === 'secondary').length).toBe(13);
    expect(f66.find((w) => w.slot === 'secondary')?.name).toBe('Hatchet');

    // SRD 2.0 spells "either kind of damage" `phy/mag`; SRD 1.0's one such
    // weapon prints `phy or mag`. Both are kept as the book sets them.
    expect(weapons.filter((w) => w.damageType === ('phy/mag' as never)).map((w) => w.name)).toEqual([
      'Shadowblade',
      'Improved Shadowblade',
      'Advanced Shadowblade',
      'Legendary Shadowblade',
    ]);

    /*
     * Not a defect: this book drops nine named tier-3 magic weapons that SRD 1.0
     * prints on folio 49. Whether the merged dataset should keep them is a
     * decided-elsewhere question; this only records that their absence is the
     * book's and not the reader's.
     */
    for (const gone of ['Ghostblade', 'Mage Orb', 'Ilmari’s Rifle', 'Gilded Bow']) {
      expect(weapons.some((w) => w.name === gone), gone).toBe(false);
    }
  }, 120_000);
});
