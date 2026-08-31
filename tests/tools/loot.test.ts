/**
 * The Loot and Consumables tables, read from two books.
 *
 * The parser used to carry `FROM_FOLIO = 58` / `TO_FOLIO = 62` and to find the
 * boundary between the two kinds by looking for the one place the roll column
 * restarts. Both are facts about SRD 1.0 alone. SRD 2.0 prints the chapter on
 * folios 75-84, calls it `Loot & Items` instead of `Loot`, and prints FOUR
 * tables rather than two - a Daggerheart Core Set table and a Hope & Fear
 * Expansion Set table for each kind, each independently rolled 1..60 - so the
 * roll column restarts three times and no single restart is the boundary.
 *
 * These are the assertions that would have caught each of those, and the SRD 1
 * ones are here so that "it reads the new book" cannot be bought by changing
 * what it reads out of the old one.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseConsumables, parseLoot } from '../../shared/parsers/loot.ts';
import type { Item } from '../../shared/types.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));

const read = async (i: number): Promise<{ loot: Item[]; consumables: Item[] }> => {
  const { pages } = await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! });
  return { loot: parseLoot(pages), consumables: parseConsumables(pages) };
};

/** The folios a kind's rows were actually taken from, in order. */
const folios = (items: readonly Item[]): number[] =>
  [...new Set(items.map((i) => i.sourcePage!))].sort((a, b) => a - b);

/** Every table the book prints for a kind, as its run of roll numbers. */
const tables = (items: readonly Item[]): number[][] => {
  const out: number[][] = [];
  for (const item of items) {
    const open = out[out.length - 1];
    if (open !== undefined && item.roll! > open[open.length - 1]!) open.push(item.roll!);
    else out.push([item.roll!]);
  }
  return out;
};

const oneToSixty = Array.from({ length: 60 }, (_, i) => i + 1);

describe.skipIf(!have(0))('SRD 1.0, whose output is the byte-identity baseline', () => {
  it('reads one table of 60 per kind, off the folios the old constants named', async () => {
    const { loot, consumables } = await read(0);
    expect(loot).toHaveLength(60);
    expect(consumables).toHaveLength(60);
    expect(tables(loot)).toEqual([oneToSixty]);
    expect(tables(consumables)).toEqual([oneToSixty]);
    expect(folios(loot)).toEqual([58, 59, 60]);
    expect(folios(consumables)).toEqual([60, 61, 62]);
  }, 120_000);

  it('leaves every item without a set, because this book never fences its products', async () => {
    // SRD 1.0 prints no "The following table includes the items from the ..."
    // sentence anywhere in the chapter. Absent is the record of that; `core`
    // would be an assertion the book never makes.
    const { loot, consumables } = await read(0);
    expect(loot.filter((i) => i.set !== undefined)).toEqual([]);
    expect(consumables.filter((i) => i.set !== undefined)).toEqual([]);
  }, 120_000);

  it('splits the two kinds by height on folio 60, which carries the end of one and the start of the other', async () => {
    /*
     * The load-bearing case for reading the banner rather than the roll
     * sequence: `Belt of Unity` (Loot 60) and `Stride Potion` (Consumable 1)
     * are printed on the same page, with the CONSUMABLES banner between them.
     * A split that only compared folios would put both on the same side.
     */
    const { loot, consumables } = await read(0);
    expect(loot[59]).toEqual({
      id: 'belt-of-unity',
      name: 'Belt of Unity',
      kind: 'loot',
      roll: 60,
      text: 'Once per session, you can spend 5 Hope to lead a Tag Team Roll with three PCs instead of two.',
      sourcePage: 60,
    });
    expect(consumables[0]).toEqual({
      id: 'stride-potion',
      name: 'Stride Potion',
      kind: 'consumable',
      roll: 1,
      text: 'You gain a +1 bonus to your next Agility Roll.',
      sourcePage: 60,
    });
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0, which renames the chapter and doubles both tables', () => {
  it('finds the chapter under its new name, on folios no constant in the tree knows', async () => {
    // `Loot & Items` at 75, and the material runs to 84 - the folio before
    // RUNNING AN ADVENTURE - rather than stopping where Consumables begins.
    const { loot, consumables } = await read(1);
    expect(folios(loot)).toEqual([75, 76, 77, 78, 79]);
    expect(folios(consumables)).toEqual([80, 81, 82, 83, 84]);
  }, 120_000);

  it('reads two tables of 60 per kind, each rolled 1..60 on its own', async () => {
    const { loot, consumables } = await read(1);
    expect(loot).toHaveLength(120);
    expect(consumables).toHaveLength(120);
    expect(tables(loot)).toEqual([oneToSixty, oneToSixty]);
    expect(tables(consumables)).toEqual([oneToSixty, oneToSixty]);
  }, 120_000);

  it('fences the two tables of each kind by the product each names above itself', async () => {
    /*
     * Four italic sentences, one over each table: "...includes the items from
     * the Daggerheart Core Set." over folio 75's, "...from the Hope & Fear
     * Expansion Set." over folio 77's, and the same pair over Consumables on
     * folios 80 and 82. Without this the two rows numbered 1 in a kind are
     * indistinguishable.
     */
    const { loot, consumables } = await read(1);
    for (const items of [loot, consumables]) {
      expect(items.slice(0, 60).map((i) => i.set)).toEqual(Array(60).fill('core'));
      expect(items.slice(60).map((i) => i.set)).toEqual(Array(60).fill('expansion'));
    }
  }, 120_000);

  it('keeps the printed roll, so a kind carries each number twice', async () => {
    /*
     * The first row of each expansion table. Renumbering them 61..120 would
     * read as one table of 120 that nobody at a table can roll on, so the
     * number stays the book's - and that means `roll` no longer identifies an
     * item within a kind.
     */
    const { loot, consumables } = await read(1);
    expect(loot[60]).toEqual({
      id: 'caltrops',
      name: 'Caltrops',
      kind: 'loot',
      roll: 1,
      text: 'You can spread these caltrops in a Very Close area around you. A creature hastening through that area must mark a Stress.',
      sourcePage: 77,
      set: 'expansion',
    });
    expect(consumables[60]).toEqual({
      id: 'warding-candle',
      name: 'Warding Candle',
      kind: 'consumable',
      roll: 1,
      text: 'You can light this candle to fill an area within Close range with a halo of light. A creature outside the halo can’t enter it if they have ill intent toward a creature within it. The candle burns for an hour.',
      sourcePage: 82,
      set: 'expansion',
    });
  }, 120_000);

  it('reads the last row of the last table, which shares its page with the Gold rules', async () => {
    const { consumables } = await read(1);
    expect(consumables[119]).toEqual({
      id: 'featherstep-potion',
      name: 'Featherstep Potion',
      kind: 'consumable',
      roll: 60,
      text: 'You can drink this potion to sprout small wings from your ankles that give you a bonus to your Evasion equal to your tier until your next rest.',
      sourcePage: 84,
      set: 'expansion',
    });
  }, 120_000);

  it('gives all 240 entries distinct ids, which the registry requires', async () => {
    const { loot, consumables } = await read(1);
    const ids = [...loot, ...consumables].map((i) => i.id);
    expect(new Set(ids).size).toBe(240);
  }, 120_000);

  it('carries the Core Set tables forward from SRD 1.0 unchanged', async () => {
    /*
     * Not a restatement of the counts: it says WHICH sixty. SRD 2.0's first
     * table of each kind is the SRD 1.0 table, same items at the same rolls
     * with the same wording, and the second is sixty items SRD 1.0 never
     * printed. A range that had drifted by a page would break this long before
     * it broke a count.
     */
    if (!have(0)) return;
    const one = await read(0);
    const two = await read(1);
    const shape = (i: Item): string => `${i.roll!}|${i.id}|${i.text}`;
    expect(two.loot.slice(0, 60).map(shape)).toEqual(one.loot.map(shape));
    expect(two.consumables.slice(0, 60).map(shape)).toEqual(one.consumables.map(shape));
    const old = new Set(one.loot.concat(one.consumables).map((i) => i.id));
    expect(two.loot.slice(60).filter((i) => old.has(i.id))).toEqual([]);
    expect(two.consumables.slice(60).filter((i) => old.has(i.id))).toEqual([]);
  }, 240_000);
});
