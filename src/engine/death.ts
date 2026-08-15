/**
 * The death move: the arithmetic behind the three options, and nothing else.
 *
 * `hasFallen` in damage.ts says when the move is owed. What it costs is here,
 * because "is the Hope Die at or below my level" and "how much of it can I
 * still spend on Stress" are exactly the kind of question a component gets
 * subtly wrong - and a wrong answer here permanently crosses out a Hope slot.
 *
 * Nothing in this file decides *for* the player. Every function either rolls
 * dice or returns what a choice would do; applying it is a separate call the
 * UI makes only after a confirmation.
 */
import type { Character } from '../../shared/types.ts';
import { BASE_HOPE } from './character.ts';
import { cryptoRng, rollDuality, type DualityInput, type Rng } from './dice.ts';

export type DeathMoveId = 'blaze' | 'avoid' | 'risk';

/**
 * A death move is not an action roll. It neither gains you Hope nor hands the
 * GM a Fear, and `reaction` is how the engine already says "this roll pays
 * nothing" - so the dice come from the one place that defines what a Hope Die
 * and a Fear Die are, without inventing a payout the rules never granted.
 */
const DEATH_ROLL: DualityInput = { modifier: 0, difficulty: null, reaction: true };

// ---------------------------------------------------------------------------
// Avoid Death
// ---------------------------------------------------------------------------

export interface AvoidDeathRoll {
  hopeDie: number;
  level: number;
  /** The Hope Die came up at or below the character's level. */
  scar: boolean;
}

export function avoidDeath(c: Character, rng: Rng = cryptoRng): AvoidDeathRoll {
  const hopeDie = rollDuality(DEATH_ROLL, rng).hope;
  return { hopeDie, level: c.level, scar: hopeDie <= c.level };
}

/** What one more scar would cost, so it can be shown before it is applied. */
export interface ScarCost {
  /** Hope slots left afterwards. */
  hopeSlots: number;
  /** Hope still available afterwards - the track is clamped to the new max. */
  hopeAvailable: number;
  /** The last slot goes: the character's journey ends. */
  journeyEnds: boolean;
}

export function scarCost(c: Character): ScarCost {
  const hopeSlots = Math.max(0, BASE_HOPE - (c.scars.length + 1));
  return {
    hopeSlots,
    hopeAvailable: Math.min(c.hope.marked, hopeSlots),
    journeyEnds: hopeSlots === 0,
  };
}

/**
 * Cross out a Hope slot.
 *
 * The maximum itself is `deriveStats`' business, so the caller re-syncs the
 * counters afterwards rather than this file keeping a second opinion on what
 * `maxHope` is.
 */
export function addScar(c: Character, note: string): Character {
  const text = note.trim();
  return {
    ...c,
    scars: [...c.scars, text === '' ? 'Unnamed scar' : text],
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Risk It All
// ---------------------------------------------------------------------------

export type RiskResult = 'stay' | 'die' | 'clear-all';

export interface RiskItAllRoll {
  hope: number;
  fear: number;
  result: RiskResult;
  /** Points to divide between Hit Points and Stress. Zero unless `stay`. */
  clear: number;
}

export function riskItAll(rng: Rng = cryptoRng): RiskItAllRoll {
  const roll = rollDuality(DEATH_ROLL, rng);
  // Matching dice are checked first: they are their own outcome here, not the
  // critical success the same pair would be on an action roll.
  if (roll.critical) return { hope: roll.hope, fear: roll.fear, result: 'clear-all', clear: 0 };
  const stay = roll.hope > roll.fear;
  return {
    hope: roll.hope,
    fear: roll.fear,
    result: stay ? 'stay' : 'die',
    clear: stay ? roll.hope : 0,
  };
}

/**
 * A legal way to divide the Hope Die between the two tracks: the split is the
 * player's, but you cannot clear a box that was never marked, and the two
 * halves together never exceed the die.
 */
export function splitClear(
  c: Character,
  total: number,
  want: { hp: number; stress: number },
): { hp: number; stress: number } {
  const hp = Math.max(0, Math.min(want.hp, c.hp.marked, total));
  const stress = Math.max(0, Math.min(want.stress, c.stress.marked, total - hp));
  return { hp, stress };
}

export function clearMarks(c: Character, hp: number, stress: number): Character {
  return {
    ...c,
    hp: { ...c.hp, marked: Math.max(0, c.hp.marked - hp) },
    stress: { ...c.stress, marked: Math.max(0, c.stress.marked - stress) },
    updatedAt: new Date().toISOString(),
  };
}

export const clearAllMarks = (c: Character): Character =>
  clearMarks(c, c.hp.marked, c.stress.marked);
