/**
 * The dice a player is holding, and nothing at all about where they came from.
 *
 * A Rally Die, a Prayer Die, a Slayer Die, an Unstoppable Die, the d6 an ally
 * hands you for Help an Ally: a dozen features grant a die, in sizes and
 * numbers that depend on subclass, on level, and on what happened this scene.
 * Knowing which feature gives which die is reading the feature text, which the
 * app shows and the player applies - so this is a tray, not an inventory. The
 * player puts a die in when they are given one and takes it out when it is
 * spent, and the app only ever rolls what is in the tray.
 *
 * ONE OF THEM COSTS SOMETHING, and the tray still does not know what. A
 * Warlock spends a Favor to roll their Patron Die into an action roll, so that
 * die reaches the tray through `buy` rather than through `add` - one call that
 * takes the payment as a predicate and adds nothing if it is refused. The tray
 * learns that something said yes; the Favor, the class feature and the die's
 * size all stay outside this file, where `engine/dicePools.ts` keeps them.
 * `buy`'s own docblock is the argument for why that is one call and not two.
 *
 * It is session state, not character state, which is why it lives here in
 * localStorage beside the GM's scene rather than in the character record: it
 * has no transfer codec, it does not travel with an export, and losing it costs
 * one scene rather than one campaign. Keyed by character id all the same -
 * two characters on one device do not share a Rally Die.
 */
import { create } from 'zustand';
import { DIE_SIZES, type DieSize } from '../../engine/dice.ts';

// Re-exported rather than redeclared: the tray offers exactly the sizes the
// rules use, and `engine/dice.ts` is where that list lives now.
export { DIE_SIZES, type DieSize };

export interface HeldDie {
  id: string;
  sides: DieSize;
}

/**
 * A ceiling, because the tray shares one scrolling row with every other roll
 * control. No feature in the SRD hands out anything close to this many at once.
 */
export const MAX_HELD = 12;

interface HeldDiceState {
  byCharacter: Record<string, HeldDie[]>;
  add: (characterId: string, sides: DieSize) => void;
  /**
   * Put a die in the tray that costs something to put there, and pay for it in
   * the same call. True when both halves happened, false when neither did.
   *
   * `charge` runs at most once and MUST write nothing when it returns false -
   * it is asked "may I, and did you take it?", not told to take it.
   */
  buy: (characterId: string, sides: DieSize, charge: () => boolean) => boolean;
  discard: (characterId: string, id: string) => void;
  clear: (characterId: string) => void;
}

const KEY = 'dhc.dice.v1';

/** One frozen empty array: a fresh `[]` per read would spin the subscription. */
const NONE: HeldDie[] = [];

const isSize = (n: unknown): n is DieSize => (DIE_SIZES as readonly unknown[]).includes(n);

function load(): Record<string, HeldDie[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, HeldDie[]> = {};
    for (const [id, dice] of Object.entries(stored)) {
      if (!Array.isArray(dice)) continue;
      // A hand-edited or half-written record must not put a d7 in the pool.
      const clean = (dice as HeldDie[])
        .filter((d) => d !== null && typeof d?.id === 'string' && isSize(d.sides))
        .slice(0, MAX_HELD)
        .map((d) => ({ id: d.id, sides: d.sides }));
      if (clean.length > 0) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function save(byCharacter: Record<string, HeldDie[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(byCharacter));
  } catch {
    // Private mode or quota. The tray stays live in memory either way.
  }
}

export const useHeldDice = create<HeldDiceState>((set, get) => {
  /** Every mutation goes through here, so nothing can forget to persist. */
  const commit = (byCharacter: Record<string, HeldDie[]>): void => {
    set({ byCharacter });
    save(byCharacter);
  };

  return {
    byCharacter: load(),

    add(characterId, sides) {
      const held = get().byCharacter[characterId] ?? NONE;
      if (held.length >= MAX_HELD) return;
      commit({
        ...get().byCharacter,
        [characterId]: [...held, { id: crypto.randomUUID(), sides }],
      });
    },

    /**
     * A die that has to be paid for, paid for and put in the tray in one call.
     *
     * ## `buy` and not `arm`, which is what the brief for it asked for
     *
     * In this app ARMING is a gesture of the Duality Roll's, not of the tray's:
     * `DualityRoll` keeps an `armedDice` list, a tray die starts off it, and
     * the player taps the chip to put it in the roll. The header above uses the
     * word that way - "holds it, and arms it into a Duality Roll" - so an `arm`
     * here would promise that the die lands in the next roll already counted,
     * which is not what happens and not what this file can make happen.
     *
     * What the payment buys is the die, in the tray, alongside every other held
     * die. Arming it is the free gesture it has always been. The screen says
     * so; a verb that said otherwise would be the first thing a player found
     * out was untrue, mid-roll.
     *
     * THE ONE CALLER TODAY IS THE WARLOCK'S PATRON DIE, and its sentence is why
     * this is not two lines at the call site: *"you can spend a Favor to call
     * upon their aid, rolling your Patron Die and adding its result to the
     * total."* The Favor and the die are one decision of the player's. There is
     * no state in the book in which somebody has paid and has no die, and none
     * in which somebody has the die and has not paid.
     *
     * ## Both of those states were reachable by a caller doing it by hand
     *
     * `pay(); add(sides)` charges for a die that is never handed over, because
     * `add` returns nothing and silently drops the die when the tray is already
     * holding `MAX_HELD` - the caller cannot even tell. `add(sides); pay()`
     * puts the die in the tray first and finds out afterwards that the track
     * was empty, and by then it is on the screen to be armed.
     *
     * So the caller does not get to sequence them. It hands the charge IN, the
     * same move `GearSlot` makes by taking `{ banner, ref }` as one object
     * instead of two props: the half-done state is not something a caller is
     * trusted to avoid, it is something they have no way to express. The order
     * is fixed here, and it is the only order with no losing branch -
     *
     *   1. no room in the tray  -> nothing is charged, `false`
     *   2. `charge()` says no   -> nothing is added, `false`
     *   3. both                 -> the die is in the tray, `true`
     *
     * - and step 1 is not decoration. It is the exact hole `add` has had all
     * along, which cost nothing while dice were free and costs a Favor now.
     *
     * ## `charge` is a predicate, which is what keeps this file blind
     *
     * The header above stakes this tray on knowing nothing about where a die
     * came from, and taking a price would have been the end of that: a `cost:
     * 'favor'` argument here would put the Warlock's currency, the character
     * record and a class feature into a file whose whole claim is that it holds
     * dice and nothing else. A function that answers yes or no puts none of
     * them here. This file does not know that the price is a Favor, that the
     * track is on the character record, or that the die belongs to a patron -
     * only that something was asked and said yes.
     *
     * `engine/dicePools.ts::PoolCost` is the other half: it says WHICH pools
     * cost something, and it is read by the screen, not by the tray.
     */
    buy(characterId, sides, charge) {
      const held = get().byCharacter[characterId] ?? NONE;
      if (held.length >= MAX_HELD) return false;
      if (!charge()) return false;
      commit({
        ...get().byCharacter,
        [characterId]: [...held, { id: crypto.randomUUID(), sides }],
      });
      return true;
    },

    discard(characterId, id) {
      const held = get().byCharacter[characterId] ?? NONE;
      commit({ ...get().byCharacter, [characterId]: held.filter((d) => d.id !== id) });
    },

    clear(characterId) {
      const { [characterId]: _gone, ...rest } = get().byCharacter;
      commit(rest);
    },
  };
});

/** The tray for one character, or an empty one when there is no character. */
export const useHeldFor = (characterId: string | null): HeldDie[] =>
  useHeldDice((s) => (characterId === null ? NONE : (s.byCharacter[characterId] ?? NONE)));
