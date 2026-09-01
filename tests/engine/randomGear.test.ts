/**
 * The randomiser, and the premise it is built on.
 *
 * The premise is a fact about `data/srd-1.0.json` and it is checked here first,
 * against the shipped file, because the whole shape of this feature follows
 * from it: weapons and armor carry a tier and loot and consumables do not, so
 * "randomise by tier" is offered on two of the three gear pickers and not on
 * the third. If that ever stops being true - the SRD grows a tier for loot, or
 * a build step drops the field from a weapon - the feature is either missing a
 * surface or lying on one, and the first test below is the thing that says so.
 *
 * Everything after it is about the draw. Three things can be wrong in a
 * randomiser and none of them look wrong on screen:
 *
 *   - it consults a generator of its own, so the same seed gives a different
 *     sword and nothing about it is testable ever again;
 *   - it returns something outside the tier that was asked for, which is a
 *     filter silently not applied;
 *   - it is off by one, so one end of the pool never comes up - and a sword
 *     that is never offered is indistinguishable, from the outside, from a
 *     sword the book does not have.
 *
 * So the seeded runs are compared to each other rather than to a hard-coded
 * name, the tier is checked on every single result of a full sweep, and both
 * ends of a two-item pool are proved reachable over 400 seeds.
 */
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Armor, Dataset, Tier, Weapon } from '@shared/types.ts';
import { seededRng } from '../../src/engine/dice.ts';
import { ofTiers, randomGear, tiersIn, type Tiered } from '../../src/engine/randomGear.ts';

const dataset = srd as unknown as Dataset;
const weapons: readonly Weapon[] = dataset.weapons;
const armors: readonly Armor[] = dataset.armors;

/** How many of a list carry a usable tier, counted rather than assumed. */
const tiered = (list: readonly unknown[]): number =>
  list.filter((x) => typeof (x as { tier?: unknown }).tier === 'number').length;

/** The seeds every sweep below walks. 1 is included; `seededRng` handles 0. */
const SEEDS = Array.from({ length: 400 }, (_, i) => i);

describe('the premise: which gear the SRD gives a tier', () => {
  /**
   * A DATASET GUARD, AND DELIBERATELY NOT KILLED BY A SOURCE MUTATION.
   *
   * No edit to `randomGear.ts` or `GearPicker.tsx` can turn this red, which is
   * the point: it is not testing code, it is pinning the fact the code was
   * shaped around. It goes red when `data/srd-1.0.json` changes underneath the
   * feature, which is the only way this particular premise can rot.
   */
  it('gives every weapon and every set of armor one, and no loot or consumable any', () => {
    expect(weapons.length, 'weapons in the shipped dataset').toBe(391);
    expect(tiered(weapons), 'weapons carrying a tier').toBe(391);

    expect(armors.length, 'sets of armor in the shipped dataset').toBe(85);
    expect(tiered(armors), 'sets of armor carrying a tier').toBe(85);

    expect(dataset.loot.length, 'loot entries in the shipped dataset').toBe(120);
    expect(tiered(dataset.loot), 'loot entries carrying a tier').toBe(0);

    expect(dataset.consumables.length, 'consumables in the shipped dataset').toBe(120);
    expect(tiered(dataset.consumables), 'consumables carrying a tier').toBe(0);
  });
});

describe('tiersIn', () => {
  it('reads the tiers off the pool rather than off a constant', () => {
    // Killed by writing `[1, 2, 3, 4]` into `tiersIn` and returning it: these
    // three pools disagree with each other and only one of them is the book.
    expect(tiersIn(weapons), 'the whole armoury').toEqual([1, 2, 3, 4]);
    expect(tiersIn(armors), 'every set of armor').toEqual([1, 2, 3, 4]);
    expect(tiersIn(weapons.filter((w) => w.tier === 3)), 'one tier of weapons').toEqual([3]);
    expect(tiersIn([]), 'nothing at all').toEqual([]);
  });

  it('sorts ascending, so a caller can read the low end off the front', () => {
    // Killed by dropping the `.sort`: `Set` keeps insertion order and the SRD
    // does not ship its armor tier-ordered end to end.
    const scrambled = [...armors].reverse();
    expect(tiersIn(scrambled)).toEqual([1, 2, 3, 4]);
  });
});

describe('randomGear', () => {
  it('gives the same answer twice for the same seed', () => {
    // THE KILLING MUTATION: replace the `rng` parameter with `cryptoRng` (or
    // `Math.random`) inside `randomGear`, which is the module-scope generator
    // this project's engine forbids. The two runs then disagree on all 400.
    const a = SEEDS.map((s) => randomGear(weapons, new Set(), seededRng(s))?.id ?? null);
    const b = SEEDS.map((s) => randomGear(weapons, new Set(), seededRng(s))?.id ?? null);
    expect(a).toEqual(b);
    expect(a.every((id) => id !== null), 'a full armoury returned nothing').toBe(true);
  });

  it('never leaves the tiers it was asked for', () => {
    // THE KILLING MUTATION: delete `want.has(g.tier)` from `ofTiers` (or make
    // it `want.size === 0 ? pool : pool` - the same defect written twice). The
    // single-tier sweeps then return three quarters foreign results.
    const singles: Tier[] = [1, 2, 3, 4];
    for (const tier of singles) {
      for (const seed of SEEDS) {
        const w = randomGear(weapons, new Set([tier]), seededRng(seed));
        expect(w?.tier, `weapons, tier ${String(tier)}, seed ${String(seed)}`).toBe(tier);
        const a = randomGear(armors, new Set([tier]), seededRng(seed));
        expect(a?.tier, `armor, tier ${String(tier)}, seed ${String(seed)}`).toBe(tier);
      }
    }

    // Two lit chips is an OR, not a widening to everything.
    const pair = new Set<Tier>([1, 4]);
    for (const seed of SEEDS) {
      const w = randomGear(weapons, pair, seededRng(seed));
      expect(pair.has(w?.tier ?? 2), `tiers 1 and 4, seed ${String(seed)}`).toBe(true);
    }
  });

  it('draws only from the pool it was handed', () => {
    // Killed by having `randomGear` reach for the whole dataset instead of its
    // argument - which is exactly what a picker's chips would stop meaning.
    const magic = weapons.filter((w) => w.category === 'Magic');
    expect(magic.length, 'the fixture pool is empty').toBeGreaterThan(0);
    const ids = new Set(magic.map((w) => w.id));
    for (const seed of SEEDS) {
      const w = randomGear(magic, new Set(), seededRng(seed));
      expect(ids.has(w?.id ?? ''), `seed ${String(seed)}`).toBe(true);
    }
  });

  it('reaches both ends of the pool, and no index outside it', () => {
    // THE KILLING MUTATION: `eligible[rng(n)]` instead of `eligible[rng(n) - 1]`
    // - the first item then never comes up and the last resolves to
    // `undefined`, so this returns null where a pool of two can never be
    // empty. `eligible[rng(n) - 2]` fails the same way at the other end.
    const two: Tiered[] = [{ tier: 1 }, { tier: 4 }];
    const seen = new Set<Tier>();
    for (const seed of SEEDS) {
      const got = randomGear(two, new Set(), seededRng(seed));
      expect(got, `seed ${String(seed)} drew nothing from a pool of two`).not.toBeNull();
      seen.add(got!.tier);
    }
    expect([...seen].sort((a, b) => a - b), 'one end of the pool never came up').toEqual([1, 4]);
  });

  it('says no rather than substituting, when nothing is of the wanted tier', () => {
    // Killed by falling back to the unfiltered pool when `ofTiers` is empty:
    // "no tier 4 armor matches" and "here is a tier 1 set" are different
    // answers, and the picker prints the count that makes the first one true.
    const tierOne = armors.filter((a) => a.tier === 1);
    expect(randomGear(tierOne, new Set<Tier>([4]), seededRng(7))).toBeNull();
    expect(randomGear([] as Armor[], new Set<Tier>(), seededRng(7))).toBeNull();
  });

  it('spreads over the items and not over the tiers', () => {
    // The distribution the docblock argues for. With TIER 1 (15 sets) and TIER
    // 4 (23 sets) both lit, a uniform draw over the 38 items gives each tier-1
    // set 1/38 = 2.6% and the tier-1 group 15/38 = 39.5%. Rolling the tier
    // first would give the group 50%, which is what this kills.
    const want = new Set<Tier>([1, 4]);
    const pool = ofTiers(armors, want);
    expect(pool.length, 'the two tiers together').toBe(38);

    let low = 0;
    const N = 4_000;
    const rng = seededRng(20250909);
    for (let i = 0; i < N; i++) {
      if (randomGear(armors, want, rng)?.tier === 1) low += 1;
    }
    // 15/38 = 0.3947; five standard errors at this N is 0.0387. A tier-first
    // draw would sit at 0.5, thirteen sigma away.
    expect(Math.abs(low / N - 15 / 38), 'the tier-1 share').toBeLessThan(0.039);
  });
});
