/**
 * The step between an attack roll and a damage roll.
 *
 * The SRD puts these in an order and the app never has: *"An attack roll is an
 * action roll intended to inflict harm... On a successful attack, roll
 * damage."* The engine has been able to roll damage correctly since the first
 * commit - `rollDamage` multiplies the die count by Proficiency and not the
 * modifier, and adds the maximum possible result of the damage dice on a
 * critical, exactly as the text says - and `rollDamage` has never had a single
 * caller outside its tests. No screen has ever rolled damage. The critical the
 * Duality Roll determines is thrown away one line after it is computed, which
 * is precisely the link the rule is about.
 *
 * So this module is the carrier between the two rolls, and it exists as a
 * module rather than as state inside a component because four rules live in
 * `damageOffer` that have to be readable in one place and provable in a test.
 * None of them can be read out of JSX.
 *
 * The one that matters most is the third. `succeeded` is three-valued, not two:
 * the engine returns `null` when the GM has not shared the Difficulty, and
 * `dice.ts:44-49` refuses on purpose to guess a verdict that is the GM's to
 * give. A naive `if (result.succeeded)` reads that `null` as a miss and
 * silently drops the offer - which would mean every table that keeps its
 * Difficulties hidden could never roll damage at all. That is why the offer is
 * computed here, from a value with three states, rather than inline from a
 * truthiness check.
 *
 * And it offers. There is no adversary on this screen, so "applying" damage
 * could only ever mean printing a total and writing a log line; the number goes
 * to the GM by being read aloud. The precedent is the incoming-damage
 * calculator in `Vitals`, which previews and then commits, not the Duality
 * Roll's own Hope and Stress, which are applied because they are unambiguous
 * and belong to the sheet in front of you.
 */
import type { Weapon } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { weaponDamage } from '../../engine/character.ts';
import { formatDamage, type DamageDice, type RollOutcome } from '../../engine/dice.ts';

/** What the attack was made with. */
export type AttackSource =
  | {
      kind: 'weapon';
      ref: string;
      name: string;
      /** The trait the weapon rolls with, so the ARM row can arm it. */
      trait: Weapon['trait'];
      damage: DamageDice;
      damageType: 'phy' | 'mag';
    }
  | { kind: 'unarmed'; damage: DamageDice }
  | { kind: 'companion'; name: string; damage: DamageDice };

export interface ArmedAttack {
  /**
   * What was attacked with. A bare trait roll - persuasion, a saving throw -
   * carries no source and is offered no damage.
   */
  source: AttackSource;
  /**
   * THE critical, taken straight off the DualityResult that produced it.
   *
   * Never recomputed from the dice. Recomputing is how a critical and its
   * damage come to disagree, and the whole point of carrying the attack is
   * that the number the player saw is the number that pays.
   */
  critical: boolean;
  /** true, false, or null when the GM did not share the Difficulty. */
  succeeded: boolean | null;
  outcome: RollOutcome;
  reaction: boolean;
  /** Proficiency at the instant of the attack, for the log line. */
  proficiency: number;
}

/**
 * The damage a weapon deals for this character, Proficiency already applied.
 *
 * `weaponDamage` and not a regex. `Play.tsx` rescaled the die count with an
 * inline `replace(/^(\d*)d/, ...)`, which is the exact thing the comment at
 * `sheetModel.ts:249` warns against: a weapon spelled `d10 + 2` has to keep
 * its modifier, and two routes to one number is two numbers eventually.
 * Returns null for a weapon whose damage string will not parse, and then no
 * damage is offered rather than a guess being printed.
 */
export function sourceFromWeapon(weapon: Weapon, stats: DerivedStats): AttackSource | null {
  const scaled = weaponDamage(weapon, stats);
  if (scaled === null) return null;
  return {
    kind: 'weapon',
    ref: weapon.id,
    name: weapon.name,
    trait: weapon.trait,
    damage: { count: scaled.count, sides: scaled.sides, modifier: scaled.modifier },
    damageType: weapon.damageType === 'mag' ? 'mag' : 'phy',
  };
}

/**
 * *"Successful unarmed attacks inflict [Proficiency]d4 damage."*
 *
 * The word "unarmed" appeared nowhere in `src/` before this. The trait is not
 * decided here: the rule says unarmed attacks use *"either Strength or Finesse
 * (GM's choice)"*, so the player picks the trait the way they pick any other
 * and the app does not choose on the GM's behalf.
 *
 * `applyProficiency` is deliberately not reused. Its `Math.max(1, ...)` floor
 * is right for a weapon, which always rolls something; here the count is the
 * Proficiency itself, and a character with Proficiency below 1 is a rules
 * question rather than a reason to invent a die.
 */
export function unarmedSource(stats: DerivedStats): AttackSource {
  return {
    kind: 'unarmed',
    damage: { count: Math.max(1, stats.proficiency), sides: 4, modifier: 0 },
  };
}

/** The dice a typed damage result can be entered for, largest first. */
export const DAMAGE_SIDES: readonly number[] = [4, 6, 8, 10, 12, 20];

/** A damage pool that can actually be rolled. */
export const isRollableDamage = (d: DamageDice): boolean =>
  d.count >= 1 && d.sides >= 2 && Number.isFinite(d.modifier);

export interface DamageOffer {
  /** Whether a damage control is put in front of the player at all. */
  show: boolean;
  tone: 'hit' | 'unknown' | 'miss' | 'reaction';
  label: string;
  detail: string;
}

/**
 * Whether to offer a damage roll, and what to call it.
 *
 * The reaction gate comes first and overrides everything, including a
 * critical. By the SRD an attack roll is *"an action roll intended to inflict
 * harm"* and a reaction roll is not one - it is made in response to something.
 * Without this gate a critical reaction would show *"Ignore what a success
 * would have cost you"* and an offer of critical damage on the same row, which
 * is the app contradicting itself in the space of two lines.
 *
 * A miss says so in words rather than rendering nothing. A blank where a
 * button was is an absence the screen does not admit to, and the house rule
 * cuts against exactly that: the player should be told there is no damage, not
 * left to infer it from a gap.
 */
export function damageOffer(attack: ArmedAttack): DamageOffer {
  const spec = formatDamage(attack.source.damage);

  if (attack.reaction) {
    return {
      show: false,
      tone: 'reaction',
      label: 'REACTION · NO DAMAGE',
      detail: 'A reaction roll is not an attack roll.',
    };
  }

  if (attack.critical) {
    // The bonus is stated before it is rolled, and it is stated on the pool
    // after Proficiency: 2d8+1 at Proficiency 3 is 6d8+1, so the critical adds
    // 48 and not 16. Printing the unscaled bonus would be a wrong number that
    // looks entirely plausible.
    const bonus = attack.source.damage.count * attack.source.damage.sides;
    return {
      show: true,
      tone: 'hit',
      label: `CRITICAL · ${spec} +${bonus}`,
      detail: 'A critical adds the highest the damage dice could have rolled.',
    };
  }

  if (attack.succeeded === true) {
    return { show: true, tone: 'hit', label: `ROLL DAMAGE · ${spec}`, detail: 'On a successful attack, roll damage.' };
  }

  if (attack.succeeded === null) {
    return {
      show: true,
      tone: 'unknown',
      label: `IF IT HIT · ${spec}`,
      detail: 'The GM says whether it hit.',
    };
  }

  return {
    show: false,
    tone: 'miss',
    label: 'MISSED · NO DAMAGE',
    detail: 'A damage roll follows a successful attack.',
  };
}

/** The name to put on a log line or an arming chip. */
export const sourceName = (source: AttackSource): string =>
  source.kind === 'unarmed' ? 'Unarmed' : source.name;
