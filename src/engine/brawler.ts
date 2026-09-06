/**
 * The Brawler's own weapon, which is not in the dataset because it is not an
 * item.
 *
 * SRD 2 p12, Brawler, *I Am the Weapon*: *"You have a primary weapon called
 * Brawler's Strike equipped while you have no other Active Weapons. It uses a
 * trait of your choice, has Melee range, and deals d8+d6 physical damage using
 * your Proficiency (both the d8 and d6 scale off your Proficiency). While this
 * weapon is active, you gain a +1 bonus to your Evasion."*
 *
 * Two numbers, and the app computed neither: a weaponless level-1 Brawler was
 * offered the generic Unarmed row's `1d4` (the p50 rule for everyone else) and
 * read Evasion 10 where the class is built around 11. The Evasion half is a
 * row in `modifiers.ts`'s class lane; the damage half is `brawlersStrike`
 * below; and both read `isBarehanded` for "no other Active Weapons", because
 * the sentence has one gate and two halves that must not disagree about it.
 *
 * The gate is a fact the sheet stores - both weapon slots empty - which is the
 * register's own criterion for a row. The FEATURE is found by its printed name
 * on the class the sheet names (and the multiclass, which grants a class
 * feature the same way `drawsFavor` reads it), the way `hasCompanionFeature`
 * finds *Companion*: the name is the key, and nothing here reads the sentence.
 */
import type { Character, Ref } from '../../shared/types.ts';
import type { DatasetIndex, DerivedStats } from './character.ts';
import { applyProficiency, parseDamage, type DamageDice } from './dice.ts';

export const I_AM_THE_WEAPON = 'I Am the Weapon';
export const BRAWLERS_STRIKE = 'Brawler’s Strike';
/** "deals d8+d6 physical damage using your Proficiency" - the unscaled pool. */
export const BRAWLERS_STRIKE_DAMAGE = 'd8+d6';

/** "no other Active Weapons": both weapon slots empty. */
export function isBarehanded(c: Character): boolean {
  const empty = (ref: Ref | null): boolean => ref === null || ref === '';
  return empty(c.activePrimaryWeapon) && empty(c.activeSecondaryWeapon);
}

/** Whether a class this sheet names grants *I Am the Weapon*. */
export function hasIAmTheWeapon(c: Character, ix: DatasetIndex): boolean {
  return [c.classRef, c.multiclassRef]
    .filter((r): r is Ref => typeof r === 'string' && r !== '')
    .some((r) => ix.classes.get(r)?.classFeatures.some((f) => f.name === I_AM_THE_WEAPON) === true);
}

/**
 * The Brawler's Strike this sheet has equipped, Proficiency applied, or null
 * when it has none: no class grants it, or a weapon is in either hand.
 */
export function brawlersStrike(c: Character, stats: DerivedStats, ix: DatasetIndex): DamageDice | null {
  if (!hasIAmTheWeapon(c, ix) || !isBarehanded(c)) return null;
  const parsed = parseDamage(BRAWLERS_STRIKE_DAMAGE);
  return parsed === null ? null : applyProficiency(parsed, stats.proficiency);
}
