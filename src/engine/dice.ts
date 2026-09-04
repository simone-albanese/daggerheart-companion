/**
 * Dice. Pure functions plus an injected source of randomness, so every roll in
 * the app is reproducible in a test and so a table that prefers physical dice
 * can feed in the numbers it actually rolled.
 */

/** Returns an integer in [1, sides]. */
export type Rng = (sides: number) => number;

/**
 * The faces a die in this game has, and the only sizes anything may hold.
 *
 * It lives here rather than beside either of its two readers because there are
 * two: `ui/player/heldDice.ts`, the tray a player hand-picks a die into, and
 * `engine/dicePools.ts`, which reads the size a feature actually grants. One
 * list, so a Rally Die that grows to a d10 and a tray that offers a d10 cannot
 * disagree about what sizes exist.
 */
export const DIE_SIZES = [4, 6, 8, 10, 12] as const;
export type DieSize = (typeof DIE_SIZES)[number];

export const cryptoRng: Rng = (sides) => {
  // Rejection sampling keeps the distribution flat; a plain modulo would bias
  // low faces for sides that do not divide 2^32.
  const limit = Math.floor(0x1_0000_0000 / sides) * sides;
  const buf = new Uint32Array(1);
  let v: number;
  do {
    crypto.getRandomValues(buf);
    v = buf[0]!;
  } while (v >= limit);
  return (v % sides) + 1;
};

/** Deterministic RNG for tests and for replaying a logged roll. */
export const seededRng = (seed: number): Rng => {
  // xorshift is stuck at zero forever once its state reaches it, and a seed of
  // 0 starts it there: every roll would come back a 1, and every duality roll a
  // critical. Substituting a fixed constant keeps seed 0 reproducible.
  let s = (seed >>> 0) || 0x9e37_79b9;
  return (sides) => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s % sides) + 1;
  };
};

// ---------------------------------------------------------------------------
// Duality roll
// ---------------------------------------------------------------------------

/**
 * The five outcomes the rules name, plus two the app needs and the rules
 * assume: when the GM has not shared the Difficulty there is no success or
 * failure yet, only a total and which die won. Reporting "Success with Hope"
 * there would be the app inventing a verdict that is the GM's to give.
 */
export type RollOutcome =
  | 'critical'
  | 'success-hope'
  | 'success-fear'
  | 'failure-hope'
  | 'failure-fear'
  | 'undecided-hope'
  | 'undecided-fear';

export interface DualityInput {
  /** Trait modifier, or whatever the move says to add. */
  modifier: number;
  /** Target number. `null` when the GM has not shared it. */
  difficulty: number | null;
  advantage?: boolean;
  disadvantage?: boolean;
  /** Experience bonuses the player chose to spend Hope on. */
  experienceBonus?: number;
  /**
   * Extra dice a feature grants and ADDS, e.g. a Rally d6, a Prayer d4, a
   * Slayer d6, a Patron d8. Each is rolled and added on its own.
   */
  bonusDice?: number[];
  /**
   * Advantage dice other players rolled for this roll - Help an Ally, SRD 2
   * p49: *"they roll their own advantage die and apply it to an ally's action
   * roll"*. They are NOT `bonusDice`: *"the player making the action roll adds
   * only the highest result of all advantage dice rolled (including their own)
   * and ignores the rest"*. So these and the roller's own advantage die form
   * one pool of which the highest face is added once - see `highestAdvantage`.
   */
  helpDice?: number[];
  /**
   * A reaction roll: made in response to an attack or a hazard.
   *
   * It resolves like an action roll and then pays nothing. The SRD: "they
   * don't generate Hope or Fear, don't trigger additional GM moves, and other
   * characters can't aid you with Help an Ally... If you critically succeed on
   * a reaction roll, you don't clear a Stress or gain a Hope."
   *
   * This is not a corner case. 38 of the 129 adversaries and 9 of the 19
   * environments call for one, and every non-leader roll in a Group Action
   * Roll is one - so a sheet that pays out on them hands the player several
   * Hope a session they never earned.
   */
  reaction?: boolean;
  /** Fixed die results, for a table rolling physical dice. */
  fixed?: { hope?: number; fear?: number; advantage?: number; bonus?: number[]; help?: number[] };
}

export interface DualityResult {
  hope: number;
  fear: number;
  /** The d6 rolled for advantage or disadvantage, if any. */
  advantageDie: number | null;
  advantageSign: 1 | -1 | 0;
  bonusDice: number[];
  /** What each Help an Ally die rolled, in the order `helpDice` was given. */
  helpDice: number[];
  /**
   * The one advantage die that reached the total: the highest of the roller's
   * own advantage die and every Help die (p49). Null when there was no
   * advantage die of any kind. A disadvantage die is subtracted on its own and
   * is never in this pool.
   */
  highestAdvantage: number | null;
  modifier: number;
  experienceBonus: number;
  difficulty: number | null;
  total: number;
  outcome: RollOutcome;
  /** A critical counts as a roll "with Hope". */
  withHope: boolean;
  critical: boolean;
  /** null when no Difficulty was supplied - the GM decides. */
  succeeded: boolean | null;
  reaction: boolean;
  /** What the roll grants: +1 Hope, -1 Stress, or a Fear to the GM. */
  effects: { hope: number; stress: number; gmFear: number };
}

/**
 * Advantage and disadvantage cancel one-for-one, so they are never both rolled.
 * They are booleans rather than counts because this is one dice pool: a second
 * source of advantage does not add a second die. The exception the book makes
 * is Help an Ally, and it is not a stacking exception - p49 says the roller
 * "adds only the highest result of all advantage dice rolled (including their
 * own)". So a Help die goes in `helpDice`, pooled with this one, and a die
 * that is ADDED on its own - Rally, Prayer, Slayer, Patron - is a `bonusDice`
 * entry. This docblock used to say Help dice "stack instead" and belong in
 * `bonusDice`; that premise is the one p49 contradicts in two places, and the
 * engine answered 23 on the book's own worked example, whose answer is 18.
 *
 * Whether a Help die cancels a DISADVANTAGE is left to the table: the sign
 * here is the roller's own declaration, a disadvantage die is subtracted as
 * declared, and the Help pool is added on top. A table that rules the Help
 * cancels it drops the DIS.
 */
function advantageSign(input: DualityInput): 1 | -1 | 0 {
  const adv = input.advantage === true;
  const dis = input.disadvantage === true;
  if (adv === dis) return 0;
  return adv ? 1 : -1;
}

export function rollDuality(input: DualityInput, rng: Rng = cryptoRng): DualityResult {
  const hope = input.fixed?.hope ?? rng(12);
  const fear = input.fixed?.fear ?? rng(12);
  const sign = advantageSign(input);
  const advantageDie = sign === 0 ? null : (input.fixed?.advantage ?? rng(6));

  const bonusSpec = input.bonusDice ?? [];
  const bonusDice = bonusSpec.map((sides, i) => input.fixed?.bonus?.[i] ?? rng(sides));
  const helpSpec = input.helpDice ?? [];
  const helpDice = helpSpec.map((sides, i) => input.fixed?.help?.[i] ?? rng(sides));

  // p49: one advantage die reaches the total, the highest of the roller's own
  // and every Help die. A disadvantage die is the roller's alone and is
  // subtracted as before.
  const advantagePool = [...(sign === 1 && advantageDie !== null ? [advantageDie] : []), ...helpDice];
  const highestAdvantage = advantagePool.length === 0 ? null : Math.max(...advantagePool);
  const disadvantage = sign === -1 ? -(advantageDie ?? 0) : 0;

  const experienceBonus = input.experienceBonus ?? 0;
  const total =
    hope +
    fear +
    input.modifier +
    experienceBonus +
    (highestAdvantage ?? 0) +
    disadvantage +
    bonusDice.reduce((a, b) => a + b, 0);

  const critical = hope === fear;
  const withHope = critical || hope > fear;
  const succeeded =
    critical ? true : input.difficulty === null ? null : total >= input.difficulty;

  let outcome: RollOutcome;
  if (critical) outcome = 'critical';
  else if (succeeded === null) outcome = withHope ? 'undecided-hope' : 'undecided-fear';
  else if (succeeded) outcome = withHope ? 'success-hope' : 'success-fear';
  else outcome = withHope ? 'failure-hope' : 'failure-fear';

  const reaction = input.reaction === true;

  return {
    hope,
    fear,
    reaction,
    advantageDie,
    advantageSign: sign,
    bonusDice,
    helpDice,
    highestAdvantage,
    modifier: input.modifier,
    experienceBonus,
    difficulty: input.difficulty,
    total,
    outcome,
    withHope,
    critical,
    succeeded,
    effects: reaction
      ? { hope: 0, stress: 0, gmFear: 0 }
      : {
          hope: withHope ? 1 : 0,
          stress: critical ? -1 : 0,
          gmFear: withHope ? 0 : 1,
        },
  };
}

export const OUTCOME_LABEL: Record<RollOutcome, string> = {
  critical: 'Critical Success',
  'success-hope': 'Success with Hope',
  'success-fear': 'Success with Fear',
  'failure-hope': 'Failure with Hope',
  'failure-fear': 'Failure with Fear',
  'undecided-hope': 'Rolled with Hope',
  'undecided-fear': 'Rolled with Fear',
};

export const OUTCOME_DETAIL: Record<RollOutcome, string> = {
  critical: 'Gain a Hope and clear a Stress',
  'success-hope': 'You gain a Hope',
  'success-fear': 'The GM gains a Fear',
  'failure-hope': 'You gain a Hope',
  'failure-fear': 'The GM gains a Fear',
  'undecided-hope': 'You gain a Hope · the GM sets the Difficulty',
  'undecided-fear': 'The GM gains a Fear · the GM sets the Difficulty',
};

/**
 * The label to put in front of a player.
 *
 * A thin wrapper over the table, and deliberately so: the honesty lives in
 * `RollOutcome` itself, so there is no way to reach a misleading string by
 * indexing the table directly.
 */
export const outcomeLabel = (r: DualityResult): string => OUTCOME_LABEL[r.outcome];

/**
 * What the roll costs or grants, in words.
 *
 * A reaction roll grants nothing, so it says nothing - promising a Hope the
 * rules do not give is the same error as handing one over.
 */
export const outcomeDetail = (r: DualityResult): string =>
  r.reaction
    ? r.critical
      ? 'Ignore what a success would have cost you'
      : 'A reaction roll pays nothing either way'
    : OUTCOME_DETAIL[r.outcome];

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/** A second kind of die in the same pool: the `d6` of `d8+d6`. */
export interface DieGroup {
  count: number;
  sides: number;
}

/**
 * `2d6+3`, `d12`, `d10+2`, `1d20` - and `d8+d6`.
 *
 * `also` is the pool's other dice, when it has any. Every weapon and every
 * Beastform in the shipped dataset rolls one kind of die, so it is absent for
 * all of them; the one pool in the book that rolls two is the Brawler's
 * *Brawler's Strike* (SRD 2 p12), "d8+d6 physical damage using your
 * Proficiency (both the d8 and d6 scale off your Proficiency)". `parseDamage`
 * used to read that spec as `1d8` and drop the d6 without a word, which is
 * why the field exists rather than a second parse: a reader that copies
 * `count`, `sides` and `modifier` by name and forgets this one drops the d6
 * the same way, so `diceOf` is the one place the pool is flattened and
 * `rollDamage`, `highestDamage` and the face slots all read it.
 */
export interface DamageDice {
  count: number;
  sides: number;
  modifier: number;
  also?: DieGroup[];
}

/**
 * Read a damage spec: a die, then any number of `+` terms that are each a die
 * or a flat number. Null when there is no die in it at all.
 *
 * `d8+d6` reads as one d8 and `also` one d6; `d8-d6` is not a pool and reads
 * null rather than as a d8. The first die is found wherever it sits in the
 * string - a layer spelling `1d8+2 mag` keeps working - and the terms after it
 * are read only while they follow on directly, so trailing words are ignored
 * the way they always were.
 */
export function parseDamage(spec: string): DamageDice | null {
  const text = spec.replace(/−/g, '-');
  const head = /(\d*)\s*d\s*(\d+)/i.exec(text);
  if (!head) return null;
  let modifier = 0;
  const also: DieGroup[] = [];
  const term = /\s*([+-])\s*(?:(\d*)\s*d\s*(\d+)|(\d+))/iy;
  term.lastIndex = head.index + head[0].length;
  for (let m = term.exec(text); m !== null; m = term.exec(text)) {
    const sign = m[1] === '-' ? -1 : 1;
    if (m[4] !== undefined) modifier += sign * Number(m[4]);
    else if (sign === 1) also.push({ count: m[2] ? Number(m[2]) : 1, sides: Number(m[3]) });
    else return null;
  }
  const out: DamageDice = { count: head[1] ? Number(head[1]) : 1, sides: Number(head[2]), modifier };
  return also.length === 0 ? out : { ...out, also };
}

export function formatDamage(d: DamageDice): string {
  const mod = d.modifier === 0 ? '' : d.modifier > 0 ? `+${d.modifier}` : `${d.modifier}`;
  const also = (d.also ?? []).map((g) => `+${g.count}d${g.sides}`).join('');
  return `${d.count}d${d.sides}${also}${mod}`;
}

/**
 * Every die in the pool, as the number of faces each has, in the order they
 * are rolled and typed: the main dice first, then each `also` group. The one
 * flattening of a pool, so the roller, the critical bonus and the face slots
 * cannot disagree about how many dice there are or which one is the d6.
 */
export function diceOf(d: DamageDice): number[] {
  return [
    ...Array.from({ length: d.count }, () => d.sides),
    ...(d.also ?? []).flatMap((g) => Array.from({ length: g.count }, () => g.sides)),
  ];
}

/**
 * The highest the damage dice could have rolled, modifier excluded: what a
 * critical adds. `count * sides` for a one-kind pool, and the d6s as well for
 * the Brawler's.
 */
export function highestDamage(d: DamageDice): number {
  return diceOf(d).reduce((a, b) => a + b, 0);
}

export interface DamageResult {
  dice: number[];
  modifier: number;
  /** Max face value of every die, added on a critical hit. */
  criticalBonus: number;
  total: number;
  critical: boolean;
  spec: string;
}

/**
 * Roll damage.
 *
 * A weapon's listed die count is multiplied by Proficiency; the flat modifier
 * is not. On a critical the maximum possible result of the damage dice is
 * added to the total, so 2d8+1 becomes 2d8+1+16.
 */
export function rollDamage(
  dice: DamageDice,
  options: { critical?: boolean; extraModifier?: number; fixed?: number[] } = {},
  rng: Rng = cryptoRng,
): DamageResult {
  // `diceOf`, so a `d8+d6` pool rolls its d6s too, after its d8s, and a
  // `fixed` face lands on the die of the same index.
  const rolled = diceOf(dice).map((sides, i) => options.fixed?.[i] ?? rng(sides));
  const modifier = dice.modifier + (options.extraModifier ?? 0);
  const criticalBonus = options.critical === true ? highestDamage(dice) : 0;
  return {
    dice: rolled,
    modifier,
    criticalBonus,
    total: rolled.reduce((a, b) => a + b, 0) + modifier + criticalBonus,
    critical: options.critical === true,
    spec: formatDamage({ ...dice, modifier }),
  };
}

/**
 * Scale a weapon's damage by Proficiency: `d8+2` at Proficiency 3 -> `3d8+2`,
 * and `d8+d6` -> `3d8+3d6` - "both the d8 and d6 scale off your Proficiency"
 * (SRD 2 p12).
 */
export function applyProficiency(dice: DamageDice, proficiency: number): DamageDice {
  const scale = (count: number): number => Math.max(1, count * Math.max(1, proficiency));
  return {
    ...dice,
    count: scale(dice.count),
    ...(dice.also === undefined
      ? {}
      : { also: dice.also.map((g) => ({ ...g, count: scale(g.count) })) }),
  };
}
