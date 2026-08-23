/**
 * The dice pools a character's own features grant them, and the arithmetic that
 * says how many and how big.
 *
 * THREE FEATURES IN THE SRD HAND OUT A POOL OF DICE, and until now the app knew
 * about none of them. `ui/player/heldDice.ts` is a *tray*: a player picks a die
 * size by hand, holds it, and arms it into a Duality Roll. Its docblock is
 * explicit that it is not an inventory and that it deliberately knows nothing
 * about where a die came from. That is the right answer for a die somebody
 * hands you - the Rally Die a bard gives each ally, the d6 from Help an Ally,
 * an Unstoppable Die - and it stays exactly as it is.
 *
 * What it cannot do is the thing a Seraph needs, which is why this file exists:
 *
 *   - it cannot say HOW MANY you have (a Seraph's Prayer Dice are "a number of
 *     d4s equal to your subclass's Spellcast trait", a Slayer's cap is their
 *     Proficiency),
 *   - it cannot say HOW BIG (a Rally Die is a d6, a d8 from level 5, and a d10
 *     for a Wordsmith holding `Epic Poetry`),
 *   - and it cannot hold a VALUE. Prayer Dice are rolled at the start of the
 *     session and sit on the sheet showing what they came up; you then spend a
 *     die whose number you already know. The tray holds unrolled dice and rolls
 *     them at the moment of spending, which is right for Rally and Slayer and
 *     wrong for Prayer.
 *
 * NOTHING HERE READS A FEATURE'S TEXT, for the same reason `modifiers.ts` does
 * not: the register below is hand-authored against `data/srd-1.0.json`, keyed
 * on the granting entity's ref and the feature's own name, and
 * `tests/engine/dicePools.test.ts` walks the dataset against it in both
 * directions. Which features a character actually HOLDS is not decided here
 * either - `characterFeatures` already answers that, including the
 * multiclass rule and which subclass cards were really taken - so a Wordsmith
 * who never took the mastery card does not get a d10.
 */
import type { DieSize } from './dice.ts';
import { characterFeatures } from './features.ts';
import type { Character, Ref } from '../../shared/types.ts';
import type { DatasetIndex, DerivedStats } from './character.ts';

export type PoolId = 'rally' | 'prayer' | 'slayer';

/**
 * When the die's number is decided.
 *
 * `grant` - rolled when you receive them, and they sit on the sheet showing
 * their faces. Only Prayer Dice work this way, and it is the whole reason a
 * pool has to be able to hold a value.
 *
 * `spend` - held blank and rolled at the moment you use them. Rally and Slayer.
 */
export type RolledAt = 'grant' | 'spend';

/**
 * Who a spent die may be aimed at.
 *
 * `self` - the rules give it to you and nobody else. A Rally Die is spent by
 * the PC holding it; a Slayer Die is added to a roll you are making.
 *
 * `either` - Prayer Dice, and this is the one distinction in this file that
 * changes what the app is allowed to WRITE. The SRD: "You can spend any number
 * of Prayer Dice to aid yourself **or an ally within Far range**." An app that
 * saw "gain Hope equal to the result" and added Hope to the sheet in front of
 * it would be writing the wrong sheet half the time - the ally is on their own
 * device, and this build holds one character. So a pool marked `either` must
 * ask who before it applies anything, and applies nothing at all when the
 * answer is the ally.
 */
export type Beneficiary = 'self' | 'either';

/** One thing the rules say a spent die may be used for. */
export interface Spend {
  /** The button, when the app can apply it. Null when it can only be described. */
  apply: 'hope' | 'stress' | null;
  /** The SRD's own words for it. Rendered, never parsed. */
  text: string;
}

export interface DicePool {
  id: PoolId;
  /** As the book names it: `Rally Die`, `Prayer Dice`, `Slayer Dice`. */
  name: string;
  /** Where it came from, for the sheet: `Bard · Rally`. */
  source: string;
  /** The ref of the entity whose feature granted it. */
  ref: Ref;
  sides: DieSize;
  /**
   * How many you are given, when the rules decide it for you.
   *
   * Null for Slayer Dice, which you bank one at a time by declining a Hope, so
   * the number you hold is a fact about your session rather than about your
   * sheet. `cap` still bounds it.
   */
  granted: number | null;
  /** The most this pool may hold at once. */
  cap: number;
  rolledAt: RolledAt;
  beneficiary: Beneficiary;
  /** Roll one extra and discard the lowest. Divine Wielder's `Devout`. */
  dropLowest: boolean;
  /** What the rules say a spent die may do. */
  spends: Spend[];
  /**
   * Clearing the pool at the end of a session pays a Hope per die.
   *
   * Only the Slayer's: "At the end of each session, clear any unspent Slayer
   * Dice on this card and gain a Hope per die cleared." Rally and Prayer both
   * say to clear and neither pays for it, so this is a per-pool fact and not a
   * rule about pools.
   */
  clearGrantsHope: boolean;
  /** Feature text this pool is governed by, verbatim, for the sheet to print. */
  rule: string;
}

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

interface PoolSpec {
  id: PoolId;
  name: string;
  base: DieSize;
  rolledAt: RolledAt;
  beneficiary: Beneficiary;
  spends: Spend[];
  clearGrantsHope?: true;
  /** How many the rules grant, from the sheet. Null means "you bank them". */
  granted: (stats: DerivedStats) => number | null;
  cap: (stats: DerivedStats) => number;
}

/**
 * `<granting ref>:<feature name>` -> the pool it opens.
 *
 * Keyed on BOTH halves rather than on the ref alone, because a class or a
 * subclass may carry several features and only one of them is a pool.
 */
const POOLS: Record<string, PoolSpec> = {
  'bard:Rally': {
    id: 'rally',
    name: 'Rally Die',
    base: 6,
    rolledAt: 'spend',
    beneficiary: 'self',
    spends: [
      { apply: null, text: 'Add the result to an action roll, reaction roll or damage roll.' },
      { apply: 'stress', text: 'Clear a number of Stress equal to the result.' },
    ],
    // One. The bard gives "yourself and each of your allies a Rally Die", and
    // the allies' copies live on the allies' sheets - see the tray.
    granted: () => 1,
    cap: () => 1,
  },
  'seraph:Prayer Dice': {
    id: 'prayer',
    name: 'Prayer Dice',
    base: 4,
    rolledAt: 'grant',
    beneficiary: 'either',
    spends: [
      { apply: null, text: 'Reduce incoming damage by the result.' },
      { apply: null, text: "Add the result to a roll's result after the roll is made." },
      { apply: 'hope', text: 'Gain Hope equal to the result.' },
    ],
    /*
     * "roll a number of d4s equal to your subclass's Spellcast trait".
     *
     * A trait can be zero or negative, and the honest answer there is none
     * rather than a negative pool. A Seraph with no subclass this build can
     * read has no Spellcast trait at all, and `deriveStats` reports that as
     * null - so the pool is drawn with nothing in it and the sheet says why.
     */
    granted: (stats) =>
      stats.spellcastTrait === null ? 0 : Math.max(0, stats.traits[stats.spellcastTrait]),
    cap: (stats) =>
      stats.spellcastTrait === null ? 0 : Math.max(0, stats.traits[stats.spellcastTrait]),
  },
  'call-of-the-slayer:Slayer': {
    id: 'slayer',
    name: 'Slayer Dice',
    base: 6,
    rolledAt: 'spend',
    beneficiary: 'self',
    spends: [
      { apply: null, text: 'Add the result to an attack roll or a damage roll.' },
    ],
    clearGrantsHope: true,
    // Banked one at a time, by declining a Hope on a roll with Hope.
    granted: () => null,
    cap: (stats) => stats.proficiency,
  },
};

/** A feature that changes a pool the character already has. */
interface Upgrade {
  pool: PoolId;
  sides?: DieSize;
  dropLowest?: true;
}

/**
 * `<ref>:<feature name>` -> what it changes.
 *
 * Both of these are gated on a subclass card actually taken, and neither is
 * gated here: `characterFeatures` only reports a specialization or a mastery
 * feature when `levelUpHistory` says the card was chosen.
 */
const UPGRADES: Record<string, Upgrade> = {
  // "Your Rally Die increases to a d10."
  'wordsmith:Epic Poetry': { pool: 'rally', sides: 10 },
  // "When you roll your Prayer Dice, you can roll an additional die and
  // discard the lowest result."
  'divine-wielder:Devout': { pool: 'prayer', dropLowest: true },
};

/** Exported for the auditor, and reached by nothing in `src/`. */
export const POOL_REGISTER = { pools: POOLS, upgrades: UPGRADES } as const;

/**
 * The level at which a Rally Die becomes a d8.
 *
 * A number rather than a line in the register because it is the one upgrade in
 * the book that is not a feature: "At level 5, your Rally Die increases to a
 * d8" is in the Rally feature's own text, so there is no second feature for the
 * register to key on.
 */
const RALLY_D8_AT = 5;

/**
 * Every pool this character actually has, with its numbers worked out.
 *
 * Returns an empty array for the great majority of characters, and the screen
 * draws nothing at all when it does - a Ranger has no pool and must not be
 * charged a fold for one.
 */
export function poolsFor(c: Character, ix: DatasetIndex, stats: DerivedStats): DicePool[] {
  const held = characterFeatures(c, ix);
  const keys = new Set(held.features.map((f) => `${f.ref}:${f.name}`));

  const out: DicePool[] = [];
  for (const f of held.features) {
    const spec = POOLS[`${f.ref}:${f.name}`];
    if (spec === undefined) continue;

    let sides: DieSize = spec.base;
    let dropLowest = false;
    for (const [key, up] of Object.entries(UPGRADES)) {
      if (up.pool !== spec.id || !keys.has(key)) continue;
      if (up.sides !== undefined) sides = up.sides;
      if (up.dropLowest === true) dropLowest = true;
    }
    // The one upgrade written into the granting feature's own text rather than
    // into a feature of its own.
    if (spec.id === 'rally' && sides === spec.base && c.level >= RALLY_D8_AT) sides = 8;

    out.push({
      id: spec.id,
      name: spec.name,
      source: f.source,
      ref: f.ref,
      sides,
      granted: spec.granted(stats),
      cap: Math.max(0, spec.cap(stats)),
      rolledAt: spec.rolledAt,
      beneficiary: spec.beneficiary,
      dropLowest,
      spends: spec.spends,
      clearGrantsHope: spec.clearGrantsHope === true,
      rule: f.text,
    });
  }
  return out;
}

/**
 * Roll a pool's dice, applying the one roll rule the SRD states for one of them.
 *
 * `dropLowest` is Divine Wielder's `Devout`, "roll an additional die and
 * discard the lowest result" - so it rolls `count + 1` and drops one, which is
 * arithmetic and not interpretation. Everything else about a spend is text.
 */
export function rollPool(
  pool: DicePool,
  count: number,
  rng: (sides: number) => number,
): number[] {
  if (count <= 0) return [];
  const rolled = Array.from({ length: pool.dropLowest ? count + 1 : count }, () =>
    rng(pool.sides),
  );
  if (!pool.dropLowest) return rolled;
  const lowest = rolled.indexOf(Math.min(...rolled));
  return rolled.filter((_, i) => i !== lowest);
}

/** Guard for a value typed in by a player rolling physical dice. */
export const isFace = (pool: DicePool, n: number): boolean =>
  Number.isInteger(n) && n >= 1 && n <= pool.sides;
