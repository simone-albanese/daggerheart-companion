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
  /** Extra dice a feature grants, e.g. a Rally d6. */
  bonusDice?: number[];
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
  fixed?: { hope?: number; fear?: number; advantage?: number; bonus?: number[] };
}

export interface DualityResult {
  hope: number;
  fear: number;
  /** The d6 rolled for advantage or disadvantage, if any. */
  advantageDie: number | null;
  advantageSign: 1 | -1 | 0;
  bonusDice: number[];
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
 * They are booleans rather than counts because this is one dice pool: sources
 * that grant a die outside your pool - an ally's Help an Ally - stack instead,
 * and belong in `bonusDice`, where they are rolled and added on their own.
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

  const experienceBonus = input.experienceBonus ?? 0;
  const total =
    hope +
    fear +
    input.modifier +
    experienceBonus +
    (advantageDie ?? 0) * sign +
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

/** `2d6+3`, `d12`, `d10+2`, `1d20`. */
export interface DamageDice {
  count: number;
  sides: number;
  modifier: number;
}

export function parseDamage(spec: string): DamageDice | null {
  const m = /(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i.exec(spec.replace(/−/g, '-'));
  if (!m) return null;
  return {
    count: m[1] ? Number(m[1]) : 1,
    sides: Number(m[2]),
    modifier: m[3] ? Number(m[3].replace(/\s+/g, '')) : 0,
  };
}

export function formatDamage(d: DamageDice): string {
  const mod = d.modifier === 0 ? '' : d.modifier > 0 ? `+${d.modifier}` : `${d.modifier}`;
  return `${d.count}d${d.sides}${mod}`;
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
  const rolled = Array.from({ length: dice.count }, (_, i) =>
    options.fixed?.[i] ?? rng(dice.sides),
  );
  const modifier = dice.modifier + (options.extraModifier ?? 0);
  const criticalBonus = options.critical === true ? dice.count * dice.sides : 0;
  return {
    dice: rolled,
    modifier,
    criticalBonus,
    total: rolled.reduce((a, b) => a + b, 0) + modifier + criticalBonus,
    critical: options.critical === true,
    spec: formatDamage({ ...dice, modifier }),
  };
}

/** Scale a weapon's damage by Proficiency: `d8+2` at Proficiency 3 -> `3d8+2`. */
export function applyProficiency(dice: DamageDice, proficiency: number): DamageDice {
  return { ...dice, count: Math.max(1, dice.count * Math.max(1, proficiency)) };
}
