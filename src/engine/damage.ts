/**
 * Incoming damage: the one place the app does arithmetic on someone getting
 * hit, and the reason the Play screen can answer "how many HP is that?" in
 * under a second.
 *
 *   below Major                 -> 1 HP  (Minor)
 *   at or above Major, below Severe -> 2 HP  (Major)
 *   at or above Severe          -> 3 HP  (Severe)
 *   at or above twice Severe    -> 4 HP  (Massive, optional rule)
 *   reduced to 0 or less        -> nothing
 *
 * Marking one Armor Slot moves the result down one step, and can take a Minor
 * hit all the way to nothing.
 */
import type { Character } from '../../shared/types.ts';
import type { DerivedStats } from './character.ts';

export type Severity = 'none' | 'minor' | 'major' | 'severe' | 'massive';

export const SEVERITY_HP: Record<Severity, number> = {
  none: 0,
  minor: 1,
  major: 2,
  severe: 3,
  massive: 4,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  none: 'No damage',
  minor: 'Minor',
  major: 'Major',
  severe: 'Severe',
  massive: 'Massive',
};

const LADDER: Severity[] = ['none', 'minor', 'major', 'severe', 'massive'];

export interface DamageOptions {
  /** Armor Slots the player chose to mark. Each steps the severity down one. */
  armorSlots?: number;
  /** Flat reduction from a feature, applied before thresholds. */
  reduction?: number;
  /** Damage that ignores armor entirely. */
  direct?: boolean;
  /** The Massive Damage optional rule is off unless the table turns it on. */
  massiveDamageRule?: boolean;
}

export interface DamageOutcome {
  incoming: number;
  /** After flat reductions, before thresholds. */
  effective: number;
  /** Severity before Armor Slots. */
  rawSeverity: Severity;
  severity: Severity;
  hp: number;
  armorSlotsUsed: number;
  /** How many Armor Slots could still be usefully spent. */
  furtherReductionPossible: boolean;
  explanation: string;
}

export function severityFor(
  amount: number,
  thresholds: [number, number],
  massiveDamageRule = false,
): Severity {
  if (amount <= 0) return 'none';
  const [major, severe] = thresholds;
  if (massiveDamageRule && amount >= severe * 2) return 'massive';
  if (amount >= severe) return 'severe';
  if (amount >= major) return 'major';
  return 'minor';
}

export function applyDamage(
  incoming: number,
  stats: DerivedStats,
  availableArmorSlots: number,
  options: DamageOptions = {},
): DamageOutcome {
  const reduction = options.reduction ?? 0;
  const effective = Math.max(0, incoming - reduction);
  const rawSeverity = severityFor(effective, stats.thresholds, options.massiveDamageRule);

  const canUseArmor = options.direct !== true && availableArmorSlots > 0;
  const requested = Math.max(0, options.armorSlots ?? 0);
  const rawIndex = LADDER.indexOf(rawSeverity);
  const used = canUseArmor ? Math.min(requested, availableArmorSlots, rawIndex) : 0;
  const severity = LADDER[rawIndex - used]!;

  const parts = [`${incoming} incoming`];
  if (reduction > 0) parts.push(`-${reduction} reduced`);
  parts.push(
    `vs ${stats.thresholds[0]}/${stats.thresholds[1]} -> ${SEVERITY_LABEL[rawSeverity]}`,
  );
  if (used > 0) parts.push(`-${used} armor -> ${SEVERITY_LABEL[severity]}`);

  return {
    incoming,
    effective,
    rawSeverity,
    severity,
    hp: SEVERITY_HP[severity],
    armorSlotsUsed: used,
    furtherReductionPossible:
      options.direct !== true && availableArmorSlots - used > 0 && LADDER.indexOf(severity) > 0,
    explanation: parts.join(' · '),
  };
}

/** Apply an outcome to a character's tracks. Never exceeds the maxima. */
export function markDamage(c: Character, outcome: DamageOutcome): Character {
  return {
    ...c,
    hp: { ...c.hp, marked: Math.min(c.hp.max, c.hp.marked + outcome.hp) },
    armorSlots: {
      ...c.armorSlots,
      marked: Math.min(c.armorSlots.max, c.armorSlots.marked + outcome.armorSlotsUsed),
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Marking Stress when every Stress slot is full costs 1 HP instead. Returns
 * the character and what actually happened, so the UI can say so.
 */
export function markStress(
  c: Character,
  amount = 1,
): { character: Character; stressMarked: number; hpMarked: number } {
  let stress = c.stress.marked;
  let hp = c.hp.marked;
  let stressMarked = 0;
  let hpMarked = 0;
  for (let i = 0; i < amount; i++) {
    if (stress < c.stress.max) {
      stress++;
      stressMarked++;
    } else if (hp < c.hp.max) {
      hp++;
      hpMarked++;
    }
  }
  return {
    character: {
      ...c,
      stress: { ...c.stress, marked: stress },
      hp: { ...c.hp, marked: hp },
      updatedAt: new Date().toISOString(),
    },
    stressMarked,
    hpMarked,
  };
}

/** True while the character has every Stress slot marked - they are Vulnerable. */
export const isVulnerableFromStress = (c: Character): boolean =>
  c.stress.max > 0 && c.stress.marked >= c.stress.max;

/** True when the last Hit Point is marked - the character must make a death move. */
export const hasFallen = (c: Character): boolean =>
  c.hp.max > 0 && c.hp.marked >= c.hp.max;
