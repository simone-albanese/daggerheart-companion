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
import type { Trait, Weapon } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { weaponDamage } from '../../engine/character.ts';
import {
  formatDamage,
  type DamageDice,
  type DamageResult,
  type RollOutcome,
} from '../../engine/dice.ts';
import type { LogEntry } from '../../store/state.ts';

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
  | {
      kind: 'spellcast';
      /** Which trait the count came from, so the panel can name it. */
      trait: Trait;
      damage: DamageDice;
    }
  | { kind: 'companion'; name: string; damage: DamageDice };

/**
 * What the next attack is declared with, before the dice.
 *
 * A kind and a ref, never a resolved pool. The pool is re-derived from this on
 * every render, which is the whole reason it is this small: a level-up, a
 * Beastform, or a weapon taken off in Build moves the dice or removes the offer
 * outright, where a `{ count, sides, modifier }` stored at the moment of the tap
 * would sit there being quietly wrong until somebody rolled it.
 *
 * `unarmed` carries nothing at all, because there is nothing to carry: the pool
 * is the character's own Proficiency and the trait is the GM's to pick.
 *
 * `spellcast` carries the die and only the die. The count is the Spellcast
 * trait, which is on the sheet and moves with a level-up or a Beastform, and
 * the modifier is typed beside the chips - so what is remembered here is the
 * one thing the app cannot work out for itself, which is which die the card in
 * the player's hand names.
 */
export type Declaration =
  | { kind: 'weapon'; ref: string }
  | { kind: 'unarmed' }
  | { kind: 'spellcast'; sides: number };

/**
 * The declaration, what it resolves to, and the one way to change it.
 *
 * One object rather than three props because the three must not be able to
 * drift: `source` is derived from `declared`, and a component handed them
 * separately could render one against a stale other.
 */
export interface Arming {
  declared: Declaration | null;
  /**
   * The pool the declaration resolves to right now, or null when it cannot -
   * a weapon removed in Build, or one whose damage string will not parse.
   */
  source: AttackSource | null;
  /**
   * Declare an attack, or withdraw one with null.
   *
   * A weapon also arms its own trait, because the weapon is what decides it:
   * *"The trait that applies to an attack roll is specified by the weapon or
   * spell being used."* A spell arms the Spellcast slot for the same half of
   * the same sentence. An unarmed declaration does not, because the same rule
   * hands that one over: *"Unarmed attack rolls use either Strength or Finesse
   * (GM's choice)"*, and the app does not choose on the GM's behalf.
   * Withdrawing leaves the trait alone too - putting a sword down is not a
   * statement about what you are rolling instead.
   *
   * This is deliberately not the same route as picking a trait by hand. Arming
   * sets the trait the declaration specifies; `chooseTrait` withdraws a
   * declaration that specified one. Sending the spell chips through
   * `chooseTrait` would put the spell down in the same tap that armed it.
   */
  arm: (declaration: Declaration | null) => void;
  /**
   * The flat modifier the card carries - the `+3` in *"d8+3 using your
   * Spellcast trait"*.
   *
   * It is asked for rather than read, because a `DomainCard` carries only free
   * prose and parsing a formula out of it would be the app guessing at the one
   * number a player can see in their own hand. It lives beside the declaration
   * rather than inside it so that changing the die does not clear it: on a card
   * the die and the modifier are one formula, and re-typing the `+3` after
   * every chip tap would be the app forgetting something it was just told.
   */
  spellModifier: number;
  setSpellModifier: (value: number) => void;
}

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

/**
 * Every die this app will build a damage pool out of, smallest first.
 *
 * The docblock over this array used to say "largest first" above an ascending
 * list, which is the kind of sentence that is believed until somebody sorts
 * something by it. It is ascending because that is the order a die is read in
 * on a card - d4 through d20 - and it is one list because the spell chips and
 * the typed faces have to offer the same dice: two lists is two lists that
 * disagree eventually.
 */
export const DAMAGE_SIDES: readonly number[] = [4, 6, 8, 10, 12, 20];

/**
 * How many dice a spell rolls, and what to say when the answer is none.
 *
 * *"Any time an effect says to deal damage using your Spellcast trait, you roll
 * a number of dice equal to your Spellcast trait. Note: If your Spellcast trait
 * is +0 or lower, you don't roll anything."*
 *
 * Two shapes rather than a number and a flag, because the refusal is not a
 * degenerate roll: it is a different thing to put on the screen, and a `count:
 * 0` would travel happily into a pool and come back out as a total of `+3`.
 * The value is carried on the refusal so the panel can say *which* +0 it means
 * - a player whose Spellcast trait is Presence needs to be told it is Presence
 * that is stopping them, not left to work out which of six numbers it reads.
 */
export type SpellcastDamage =
  | { rollable: true; trait: Trait; count: number }
  | { rollable: false; trait: Trait; value: number };

/**
 * The Spellcast damage this character can roll, or null when they have no
 * Spellcast trait at all - most Warriors, Rogues and Guardians.
 *
 * It reads `stats.traits` and not the character's own, so a Beastform that
 * raises the trait raises the number of dice. That is the same source
 * `rollModifier` uses for the attack roll itself, and the alternative is a
 * sheet whose spell attack and spell damage disagree about what the trait is.
 */
export function spellcastDamage(stats: DerivedStats): SpellcastDamage | null {
  const trait = stats.spellcastTrait;
  if (trait === null) return null;
  const value = stats.traits[trait];
  // `>= 1` and not `>= 0`: +0 is the case the rule is written about, and a
  // pool of zero dice is exactly what `isRollableDamage` exists to refuse.
  return value >= 1 ? { rollable: true, trait, count: value } : { rollable: false, trait, value };
}

/**
 * A spell as something the damage row can roll.
 *
 * The die and the modifier come from the card in the player's hand and the
 * count comes from the sheet, which is the whole division of labour here: a
 * `DomainCard` carries only free text, so parsing `2d8+4` out of prose would
 * mean the app silently overwriting the `2` a card actually printed with a
 * Proficiency or a trait it invented. Nothing is parsed. The app supplies the
 * one number that is genuinely its own - the count - and asks for the rest.
 *
 * Null at +0 or lower, so the unrollable pool is never built rather than built
 * and then refused downstream.
 */
export function spellcastSource(
  stats: DerivedStats,
  sides: number,
  modifier: number,
): AttackSource | null {
  const damage = spellcastDamage(stats);
  if (damage === null || !damage.rollable) return null;
  return {
    kind: 'spellcast',
    trait: damage.trait,
    damage: { count: damage.count, sides, modifier },
  };
}

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

/**
 * The name to put on a log line or an arming chip.
 *
 * A spell is `Spellcast` and not the name of a card. The declaration is a die
 * and a modifier typed off whatever the player is holding, so naming a card
 * here would be the app claiming to know which one - and being wrong the first
 * time somebody rolls the same d8+3 for a different spell.
 */
export const sourceName = (source: AttackSource): string =>
  source.kind === 'unarmed' ? 'Unarmed' : source.kind === 'spellcast' ? 'Spellcast' : source.name;

/**
 * Which of the two damage types this source deals.
 *
 * *"There are two damage types: physical damage (phy) and magic damage (mag).
 * Unless stated otherwise, mundane weapons and unarmed attacks deal physical
 * damage, and spells deal magic damage."*
 *
 * A weapon carries its own answer and it is read rather than guessed: 70 of the
 * 204 shipped weapons are `mag`, so "weapon means physical" would be wrong more
 * than a third of the time. A spell is the sentence's other half and is magic.
 * The two that state nothing take the default: an unarmed attack is physical by
 * the sentence above, and a companion's attack is the Ranger's beast biting
 * something.
 */
export const damageTypeOf = (source: AttackSource): 'phy' | 'mag' =>
  source.kind === 'weapon' ? source.damageType : source.kind === 'spellcast' ? 'mag' : 'phy';

/**
 * Every number that went into the total, in the order it was added.
 *
 * It exists so the row and the log line cannot print two different sums for one
 * roll. The critical bonus is in here for the same reason it is in the offer's
 * label: it is part of the total, so a line that left it out would show
 * arithmetic that does not reach its own answer.
 */
export function damageArithmetic(result: DamageResult): string {
  const parts = [result.dice.join(' + ')];
  if (result.modifier !== 0) {
    parts.push(`${result.modifier > 0 ? '+' : '−'}${Math.abs(result.modifier)}`);
  }
  if (result.criticalBonus > 0) parts.push(`+${result.criticalBonus} crit`);
  return `${parts.join(' ')} = ${result.total}`;
}

/**
 * The damage roll, as a line in the log.
 *
 * The prefix is the honesty rule at its narrowest. A line reading *"Battleaxe ·
 * 21 PHY"* says damage was dealt; when `succeeded` is null nobody has said the
 * attack hit, and the app is not entitled to record a hit the GM has not given.
 * So the null case is announced as conditional rather than rendered flat, and
 * a critical says so too, because the total is 20 higher than the pool beside
 * it explains.
 *
 * `outcome` rides along so the damage line colours the way the attack line
 * above it did. `RecentLog` tints by outcome; without this a critical's damage
 * would render grey next to the gold roll that earned it.
 */
export function damageLogEntry(
  attack: ArmedAttack,
  result: DamageResult,
): Omit<LogEntry, 'id' | 'at'> {
  const prefix = attack.critical
    ? 'CRITICAL · '
    : attack.succeeded === null
      ? 'IF IT HIT · '
      : '';
  return {
    kind: 'damage',
    label: `${prefix}${result.total} ${damageTypeOf(attack.source).toUpperCase()}`,
    detail: `${sourceName(attack.source)} ${result.spec} · ${damageArithmetic(result)}`,
    outcome: attack.outcome,
    total: result.total,
  };
}
