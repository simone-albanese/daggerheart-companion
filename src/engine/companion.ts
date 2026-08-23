/**
 * The Beastbound Ranger's companion: a second creature the player operates.
 *
 * One rule here is arithmetic and gets computed - "their damage roll uses your
 * Proficiency and their damage die". Everything else on the companion sheet is
 * a choice the player records: their Evasion, their Stress slots, the eight
 * level-up options. The app holds the sheet; it does not play the animal.
 *
 * The sheet's own text no longer lives here. It used to, because the SRD prints
 * folio 18 as a *sheet* and the build parsed stat blocks; `parseRules` reaches
 * that folio now, so the eight level-up options are read out of the dataset by
 * `companionUpgrades` in `src/ui/shared/srdReference.ts` and the constant that
 * held them is gone, as the note that stood here asked.
 *
 * What stays is arithmetic. `COMPANION_START` is four numbers the app needs in
 * order to seed a sheet, and the book states them inside English sentences
 * ("Fill in their Evasion, which starts at 10"). Reading them back out of prose
 * is the move this codebase refuses everywhere else - see `spellcastSource` -
 * so they are written down, and the sentences they came from are one tap away
 * in the Rulebook now that the section exists.
 */
import type { Character, CompanionState, Range, Ref } from '../../shared/types.ts';
import type { DatasetIndex } from './character.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';

/** Folio 18, steps 2-4: what a companion starts with. */
export const COMPANION_START = {
  evasion: 10,
  /** Printed as checkboxes on the sheet, so it is editable rather than fixed. */
  stressSlots: 3,
  damage: 'd6',
  range: 'Melee' as Range,
  experiences: 2,
  experienceBonus: 2,
} as const;

/**
 * Whether this character is owed a companion sheet.
 *
 * The SRD hands the sheet over through a subclass feature literally named
 * "Companion", so that is what is looked for - a hardcoded `beastbound` ref
 * would go stale the moment a layer renames or adds a subclass.
 */
export function hasCompanionFeature(c: Character, ix: DatasetIndex): boolean {
  return c.subclassRefs.some((r: Ref) => {
    const sub = ix.subclasses.get(r);
    if (!sub) return false;
    return [...sub.foundationFeatures, ...sub.specializationFeatures, ...sub.masteryFeatures].some(
      (f) => f.name === 'Companion',
    );
  });
}

export function newCompanion(name: string, description: string): CompanionState {
  return {
    name,
    description,
    evasion: COMPANION_START.evasion,
    stress: { marked: 0, max: COMPANION_START.stressSlots },
    damage: COMPANION_START.damage,
    range: COMPANION_START.range,
    experiences: Array.from({ length: COMPANION_START.experiences }, () => ({
      id: crypto.randomUUID(),
      name: '',
      bonus: COMPANION_START.experienceBonus,
    })),
    upgrades: [],
  };
}

/**
 * "On a success, their damage roll uses your Proficiency and their damage die."
 * The one number on this sheet the app is allowed to work out for you.
 */
export function companionDamage(
  companion: CompanionState,
  proficiency: number,
): { spec: string; count: number; sides: number; modifier: number } | null {
  const parsed = parseDamage(companion.damage);
  if (!parsed) return null;
  const scaled = applyProficiency(parsed, proficiency);
  return { spec: formatDamage(scaled), ...scaled };
}

/** Write a companion back onto its character. */
export function withCompanion(c: Character, patch: Partial<CompanionState>): Character {
  if (c.companion === null) return c;
  return { ...c, companion: { ...c.companion, ...patch } };
}
