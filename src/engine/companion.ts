/**
 * The Beastbound Ranger's companion: a second creature the player operates.
 *
 * One rule here is arithmetic and gets computed - "their damage roll uses your
 * Proficiency and their damage die". Everything else on the companion sheet is
 * a choice the player records: their Evasion, their Stress slots, the eight
 * level-up options. The app holds the sheet; it does not play the animal.
 *
 * The sheet's own text lives in this module rather than in the dataset because
 * the SRD prints it as a *sheet* (folio 18), not as a stat block, and the build
 * parses stat blocks. If `parseRules` ever reaches folio 18 this constant
 * becomes a `RulesSection` and should be deleted.
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

export interface CompanionUpgrade {
  id: string;
  name: string;
  text: string;
}

/** "When your character levels up, choose one available option." Folio 18. */
export const COMPANION_UPGRADES: readonly CompanionUpgrade[] = [
  {
    id: 'intelligent',
    name: 'Intelligent',
    text: 'Your companion gains a permanent +1 bonus to a Companion Experience of your choice.',
  },
  {
    id: 'light-in-the-dark',
    name: 'Light in the Dark',
    text: 'Use this as an additional Hope slot your character can mark.',
  },
  {
    id: 'creature-comfort',
    name: 'Creature Comfort',
    text: 'Once per rest, when you take time during a quiet moment to give your companion love and attention, you can gain a Hope or you can both clear a Stress.',
  },
  {
    id: 'armored',
    name: 'Armored',
    text: 'When your companion takes damage, you can mark one of your Armor Slots instead of marking one of their Stress.',
  },
  {
    id: 'vicious',
    name: 'Vicious',
    text: 'Increase your companion’s damage dice or range by one step (d6 to d8, Close to Far, etc.).',
  },
  {
    id: 'resilient',
    name: 'Resilient',
    text: 'Your companion gains an additional Stress slot.',
  },
  {
    id: 'bonded',
    name: 'Bonded',
    text: 'When you mark your last Hit Point, your companion rushes to your side to comfort you. Roll a number of d6s equal to the unmarked Stress slots they have and mark them. If any roll a 6, your companion helps you up. Clear your last Hit Point and return to the scene.',
  },
  {
    id: 'aware',
    name: 'Aware',
    text: 'Your companion gains a permanent +2 bonus to their Evasion.',
  },
];

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
