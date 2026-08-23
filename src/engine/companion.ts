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
import { characterFeatures } from './features.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';

/** Folio 18, steps 2-4: what a companion starts with. */
export const COMPANION_START = {
  evasion: 10,
  /** Printed as checkboxes on the sheet, so it is editable rather than fixed. */
  stressSlots: 3,
  damage: 'd6',
  range: 'Melee' as Range,
  /** Step 4 asks, and physical is where the sheet starts rather than a guess. */
  damageType: 'phy' as const,
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
    damageType: COMPANION_START.damageType,
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

/**
 * How many of the eight boxes this character has earned.
 *
 * *"When your character levels up, choose one available option for your
 * companion"* - so one per level-up, which is `level - 1` - plus whatever the
 * Beastbound's two training features grant: Expert Training reads *"Choose an
 * additional level-up option for your companion"* and Advanced Training
 * *"Choose two additional level-up options for your companion"*.
 *
 * A READOUT AND NOT A GATE. Nothing here refuses a box, and `CompanionSheet`
 * still lets every one of the eight be toggled. That was already the decision
 * when the count did not exist at all - the app does not overrule a GM who
 * allowed something - and this changes only the other half of it: the app was
 * silent about a number it could work out, and a player had no way to know
 * whether they had marked more than they were owed.
 *
 * IT SCANS RATHER THAN NAMING THE TWO FEATURES. A table keyed on `beastbound`
 * would be right today and wrong the first time a layer adds a subclass that
 * grants one, and the count comes out of the feature's own words so a third
 * one is caught by the same regex. The number word is read too: "an additional"
 * is one and "two additional" is two, and a feature that says neither is
 * counted as one rather than as none, because it plainly grants something.
 *
 * It reads `characterFeatures`, which gates specialization and mastery on the
 * level-up history - so a tier-2 Beastbound is not credited with the Advanced
 * Training they have not taken yet.
 */
const ADDITIONAL_OPTIONS = /(\w+)\s+additional\s+level-up\s+options?/i;
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };

export function companionUpgradeAllowance(c: Character, ix: DatasetIndex): number {
  let extra = 0;
  for (const held of characterFeatures(c, ix).features) {
    const match = ADDITIONAL_OPTIONS.exec(held.text);
    if (match) extra += COUNT_WORDS[match[1]!.toLowerCase()] ?? 1;
  }
  return Math.max(0, c.level - 1) + extra;
}

/**
 * *"When they mark their last Stress, they drop out of the scene (by hiding,
 * fleeing, or a similar action). They remain unavailable until the start of
 * your next long rest, where they return with 1 Stress cleared."* Folio 18.
 *
 * DERIVED AND NOT STORED. A full Stress track *is* the state - there is no
 * second way to be out of the scene and no way to be in it with the track full
 * - so a flag on `CompanionState` would be a second place for one truth to
 * live, and the first time the two disagreed the sheet would show a companion
 * fighting with every box marked. It also costs the transfer codec nothing,
 * which matters: a field here is a wire-format version for every sheet ever
 * saved.
 *
 * A companion with no Stress slots at all is not away. That is not a real
 * sheet, but `newCompanion` is not the only way one arrives - a file and a QR
 * are others - and `0 >= 0` would put such a companion permanently out of a
 * scene they were never in.
 */
export const companionIsAway = (companion: CompanionState): boolean =>
  companion.stress.max > 0 && companion.stress.marked >= companion.stress.max;

/**
 * *"When you choose a downtime move that clears Stress on yourself, your
 * companion clears an equal number of Stress."* Folio 18.
 *
 * WHICH NUMBER, because the sentence does not quite say. "An equal number" can
 * be read as the number the move produced - `1d4+Tier`, whether or not you had
 * that much marked - or as the number you actually cleared. This takes the
 * second, for the reason this module opens with: between two readings the app
 * takes the one that invents nothing, and the first would hand a companion a
 * clear the character never got. The number goes in the rest log either way, so
 * a table reading it the other way can see what happened and say so.
 *
 * Nothing happens without a companion, and nothing happens at zero - a rest
 * that cleared nothing must not put a line in the log claiming it did.
 */
export function clearCompanionStress(
  c: Character,
  amount: number,
): { character: Character; cleared: number } {
  const companion = c.companion;
  if (companion === null || amount <= 0) return { character: c, cleared: 0 };
  const cleared = Math.min(amount, companion.stress.marked);
  if (cleared === 0) return { character: c, cleared: 0 };
  return {
    character: {
      ...c,
      companion: {
        ...companion,
        stress: { ...companion.stress, marked: companion.stress.marked - cleared },
      },
    },
    cleared,
  };
}

/** Write a companion back onto its character. */
export function withCompanion(c: Character, patch: Partial<CompanionState>): Character {
  if (c.companion === null) return c;
  return { ...c, companion: { ...c.companion, ...patch } };
}
