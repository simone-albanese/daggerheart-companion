/**
 * Environments, selected without a contents entry.
 *
 * The chapter "Adversaries and Environments" is indexed; the environments
 * inside it are not, so the near end of the range has to come off the page. The
 * anchor is the section's own index heading, `ENVIRONMENT STAT BLOCKS BY TIER`.
 *
 * The load-bearing assertion is the last one, and it is the reason to trust the
 * rest: every one of SRD 1.0's nineteen environments comes back out of SRD 2.0
 * FIELD FOR FIELD, off a completely different page geometry - 135 spread-set
 * pages against 224 single ones, folios 103-111 against 159-182. A parser that
 * reproduces a known answer from unknown pages is doing something other than
 * landing on plausible material.
 *
 * These halves are book-gated: the manuals are the owner's and are not in the
 * repository, so they skip themselves in CI.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEnvironments } from '../../shared/parsers/environments.ts';
import type { Environment } from '../../shared/types.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const read = async (i: number): Promise<Environment[]> =>
  parseEnvironments((await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages);

/**
 * `sourcePage` is optional on `Sourced`, so a block that lost its folio would
 * otherwise vanish from a min/max instead of failing one. -1 makes it fail.
 */
const folios = (envs: Environment[]): [number, number] => {
  const pages = envs.map((e) => e.sourcePage ?? -1);
  return [Math.min(...pages), Math.max(...pages)];
};

describe.skipIf(!have(0))('SRD 1.0, where the range used to be written down', () => {
  it('recovers the folios the hardcoded FROM/TO named', async () => {
    // `const FROM = 103` / `const TO = 111`, now derived. A method that cannot
    // reproduce the answer already known is not one to point at a new book.
    const envs = await read(0);
    expect(envs).toHaveLength(19);
    expect(folios(envs)).toEqual([103, 111]);
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0, which moves the section and reshapes its opener', () => {
  it('reads all forty-seven, on the folios after the index page', async () => {
    const envs = await read(1);
    expect(envs).toHaveLength(47);
    // Folio 159 is the index page and carries no stat block; 182 is Time
    // Court, the last one before ADDITIONAL GM GUIDANCE on 183.
    expect(folios(envs)).toEqual([160, 182]);
    const byTier = [1, 2, 3, 4].map((t) => envs.filter((e) => e.tier === t).length);
    expect(byTier).toEqual([16, 12, 11, 8]);
  }, 120_000);

  it('keeps a name that is set on two display lines in one piece', async () => {
    /*
     * SRD 1.0 fits every environment name on one line. SRD 2.0 breaks two, and
     * left alone the second line starts a stat block of its own while the first
     * becomes a block with no "Tier N Type" line under it.
     */
    const envs = await read(1);
    const names = envs.map((e) => e.name);
    expect(names).toContain('Alchemist’s Abandoned Workshop');
    expect(names).toContain('Convergence, the City of Portals');
    expect(names.filter((n) => /^Workshop$|^City of Portals$/.test(n))).toEqual([]);
  }, 120_000);

  it('prefers the stat block’s own heading where the index shortens it', async () => {
    // The index on folio 159 lists "Convergence, City of Portals"; the block on
    // folio 179 heads itself "CONVERGENCE, THE / CITY OF PORTALS". The block
    // wins, as `Outer Realms Corrupter` does in adversaries.ts.
    const envs = await read(1);
    const c = envs.find((e) => e.id === 'convergence-the-city-of-portals');
    expect(c?.name).toBe('Convergence, the City of Portals');
    expect(c?.tier).toBe(4);
    expect(c?.type).toBe('Social');
    expect(c?.sourcePage).toBe(179);
  }, 120_000);

  it('reads a third Difficulty: Special, which SRD 1.0 did not print', async () => {
    // Ambushed and Ambushers in both books; Duel is new, and its Relative
    // Strength names the challenger rather than the strongest adversary.
    const envs = await read(1);
    expect(envs.filter((e) => e.difficulty === 0).map((e) => e.name)).toEqual([
      'Ambushed',
      'Ambushers',
      'Duel',
    ]);
    const duel = envs.find((e) => e.id === 'duel');
    expect(duel?.features.map((f) => f.name)).toContain('Relative Strength');
  }, 120_000);
});

describe.skipIf(!have(0) || !have(1))('the same nineteen, off two different geometries', () => {
  it('reproduces every SRD 1.0 environment field for field', async () => {
    const [one, two] = [await read(0), await read(1)];
    const byId = new Map(two.map((e) => [e.id, e]));
    // The folio is the one thing that legitimately moves.
    const shape = (e: Environment): string => JSON.stringify({ ...e, sourcePage: 0 });
    for (const e of one) {
      const other = byId.get(e.id);
      expect(other, `${e.name} is missing from SRD 2.0`).toBeDefined();
      expect(shape(other!), `${e.name} differs between the books`).toBe(shape(e));
    }
    // Additive: nothing was dropped, twenty-eight were added.
    expect(two.length - one.length).toBe(28);
  }, 180_000);
});
