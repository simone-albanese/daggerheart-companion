/**
 * Handing the choice to the dice, on the two lists that can honour it.
 *
 * WEAPONS AND ARMOR, AND NOT LOOT OR CONSUMABLES. That is a fact about the
 * shipped dataset rather than a preference. In `data/srd-1.0.json` all 204
 * weapons and all 34 sets of armor carry a `tier`; not one of the 60 loot
 * entries and not one of the 60 consumables carries one, because the book does
 * not give them one. A "randomise by tier" control over loot would therefore
 * be offering a filter the data cannot answer, and a control that implies an
 * axis the dataset does not have is the same defect as a screen implying an
 * absence that is not real. `tests/engine/randomGear.test.ts` counts all four
 * numbers against the shipped file so the premise cannot rot silently.
 *
 * The constraint is spelled `T extends Tiered` and not checked at runtime,
 * which is the strongest form available here: `Item` has no `tier`, so
 * `randomGear(loot, ...)` does not compile. There is nothing to guard against
 * at runtime because there is no way to get there.
 *
 * THE DICE ARE INJECTED, like every other roll in this engine - see
 * `rollDuality` in `dice.ts`, whose signature this matches to the character.
 * A module-scope generator would make the one thing this file does impossible
 * to test: that the same seed picks the same sword.
 *
 * WHAT "BY TIER" MEANS HERE, because there are two readings and they are not
 * the same distribution. This draws uniformly over the *items* of the wanted
 * tiers, not a tier first and then an item inside it. Armor is why: the SRD
 * ships 4 sets at tier 1 and 10 at each of tiers 2, 3 and 4 (weapons run
 * 35/56/57/56). Rolling the tier first with TIER 1 and TIER 4 both lit would
 * give each tier-1 set 1/2 x 1/4 = 12.5% and each tier-4 set 1/2 x 1/10 = 5%,
 * so a Gambeson would come back two and a half times as often as any
 * particular tier-4 set. A player who lights two chips has said "either of
 * these", and every row they can see should be equally likely to come back.
 *
 * NO TIER BOUNDARY IS WRITTEN DOWN. `tiersIn` reads the tiers off the pool it
 * is handed, so a dataset that grows a fifth tier grows one here too, and an
 * empty `want` means "every tier this pool has" rather than a list of four
 * digits typed into a source file.
 */
import type { Tier } from '../../shared/types.ts';
import { cryptoRng, type Rng } from './dice.ts';

/** The one thing the randomiser needs of what it draws from. */
export interface Tiered {
  readonly tier: Tier;
}

/**
 * The tiers a pool actually offers, ascending.
 *
 * Read from the pool rather than from a constant, so this answers for whatever
 * list it is handed - the whole armoury, or the eleven weapons left after five
 * chips and a search.
 */
export function tiersIn<T extends Tiered>(pool: readonly T[]): Tier[] {
  return [...new Set(pool.map((g) => g.tier))].sort((a, b) => a - b);
}

/**
 * What a request for these tiers can return.
 *
 * An empty `want` is "any", the same convention the gear chips use: an
 * untouched chip row narrows nothing, so an untouched chip row must not narrow
 * this either.
 */
export function ofTiers<T extends Tiered>(pool: readonly T[], want: ReadonlySet<Tier>): T[] {
  return want.size === 0 ? [...pool] : pool.filter((g) => want.has(g.tier));
}

/**
 * One piece of gear, drawn uniformly from those of the wanted tiers.
 *
 * Null when nothing in the pool is of a wanted tier - which the caller must
 * handle rather than fall back to a random anything, because "no tier 4 armor
 * matches those filters" and "here is a tier 1 set instead" are different
 * answers and only one of them is true.
 *
 * The tier is enforced here and not merely upstream. The picker hands in rows
 * its own chips have already narrowed, so `want` is normally redundant - and
 * that is exactly why it is applied again: the guarantee this function makes
 * is its own, and it does not depend on a caller having filtered correctly.
 */
export function randomGear<T extends Tiered>(
  pool: readonly T[],
  want: ReadonlySet<Tier>,
  rng: Rng = cryptoRng,
): T | null {
  const eligible = ofTiers(pool, want);
  if (eligible.length === 0) return null;
  // `Rng` returns 1..sides, so the index is one less. Both ends of the pool
  // are reachable and neither is reachable twice; `randomGear.test.ts` walks
  // 400 seeds over a two-item pool to hold that, because an off-by-one here is
  // invisible on screen - it just quietly never offers the last sword.
  return eligible[rng(eligible.length) - 1] ?? null;
}
