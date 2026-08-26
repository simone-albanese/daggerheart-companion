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
 * The Play screen is no longer the only reader. `combatantHit` at the bottom of
 * this file answers the same question for an adversary on the GM's scene card -
 * same ladder, same optional rule, two branches a PC has not got - so the two
 * sides of the table cannot come to different numbers for one hit. It is at the
 * bottom rather than beside `applyDamage` because it reuses `severityFor` and
 * nothing else here; the armor arithmetic above is the player's alone.
 *
 * Marking an Armor Slot moves the result down one rung, and can take a Minor
 * hit all the way to nothing. ONE slot, for one incoming damage - and
 * "incoming damage" is the SRD's own unit: "the total damage from a single
 * attack or source, before Armor Slots are marked" (Additional Rules, p42).
 *
 * ## The cap is a parameter, and its default is one
 *
 * Until this file was fixed the calculator let a single hit spend three slots,
 * walking Severe all the way to nothing, which is three times what the game
 * allows on the one control a player reaches for at the worst moment of a
 * fight. The cap now lives here rather than in a screen, so the next surface
 * that spends armor cannot re-invent it.
 *
 * It is a parameter and not a hard-coded 1 because the rule's own escape
 * clause - "unless an ability or domain card says otherwise" - is not
 * hypothetical. Four things in the shipped dataset raise it:
 *
 *   - `brace` (Bone 3): mark a Stress to mark an additional Armor Slot.
 *   - `forest-sprites` (Sage 8): an ally near a sprite may mark an additional
 *     Armor Slot.
 *   - `stalwart`'s Iron Will foundation feature: an additional Armor Slot
 *     against physical damage.
 *   - `i-am-your-shield` (Valor 1): taking a hit meant for an ally, "you can
 *     mark any number of Armor Slots" - the one case where the cap is
 *     `Number.POSITIVE_INFINITY`.
 *
 * Two other things in the dataset look like this and are not: `full-fortified-
 * armor` and `shield-aura` change how far *one* slot moves the severity, not
 * how many slots may be spent, and belong to a different parameter that this
 * engine does not model yet.
 *
 * ## Why nothing on screen may cite a rulebook for the cap
 *
 * `data/srd-1.0.json` is the only rules text this app may quote, because it is
 * the only one the user can open inside the app - and it does not carry this
 * sentence. Its rules chapters never explain that marking an Armor Slot
 * reduces damage at all; they only presuppose it ("Direct damage is damage
 * that can't be reduced by marking Armor Slots"). The nearest thing to the cap
 * is Additional Rules' SPENDING RESOURCES, and it enumerates Hope and Stress,
 * not Armor Slots. The four cards above are strong internal evidence - a card
 * that grants "an additional Armor Slot" is meaningless unless the default is
 * one - but evidence is not a quotation. So: enforce the cap, and say what the
 * app does. Do not print a citation the reader cannot go and check.
 *
 * ## What a surface must do with this
 *
 * Build the armor control from `armorSlotsSpendable` on the outcome, never
 * from a literal and never from `armorSlots.max`. It already accounts for the
 * cap, the slots the character actually has left, and how far the ladder can
 * still fall - so a control that cycles up to it can never ask for a slot the
 * engine would refuse, and one that cycles past it is asking for a refusal.
 */
import type { Character, Counter } from '../../shared/types.ts';
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

/**
 * The most Armor Slots one incoming damage may spend when nothing says
 * otherwise. Not exported: a surface that needs the number needs the one on
 * the outcome, which has already been cut down by the character's own track
 * and by how far the ladder can fall.
 */
const DEFAULT_ARMOR_SLOT_CAP = 1;

/**
 * Read a count of Armor Slots off a caller.
 *
 * Every one of these numbers arrives from somewhere the type system stops
 * caring about - a text input, a stored sheet, a feature's arithmetic - and a
 * NaN that reached the clamp below used to walk straight off the end of the
 * ladder and hand back `severity: undefined` and `hp: undefined`, with the
 * non-null assertion holding the door open. Slots are whole and never
 * negative; "any number" is a real answer and stays one.
 */
function slotCount(value: number | undefined, fallback: number): number {
  if (value === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export interface DamageOptions {
  /**
   * Armor Slots the player chose to mark. Each steps the severity down one.
   * Asking for more than `armorSlotCap` allows is not an error and is not
   * honoured: the engine spends what the rules permit and reports both.
   */
  armorSlots?: number;
  /**
   * The most Armor Slots this one incoming damage may spend. One unless an
   * ability or a domain card says otherwise; `Number.POSITIVE_INFINITY` for
   * the cards that say "any number". Anything that is not a whole count of
   * slots falls back to one, because one is what the rules say when nothing
   * has spoken.
   */
  armorSlotCap?: number;
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
  /**
   * What the caller asked to spend, before any limit was applied. Kept beside
   * `armorSlotsUsed` so a refusal is legible rather than silent: the two
   * differing is the engine declining to break the rule a screen just asked it
   * to break.
   */
  armorSlotsRequested: number;
  /** The per-incoming-damage cap that was in force. One unless raised. */
  armorSlotCap: number;
  /**
   * The most this hit can spend: the cap, the slots the character has left,
   * and the rungs the ladder still has, whichever runs out first. This is the
   * number an armor control is built from.
   */
  armorSlotsSpendable: number;
  /** Whether any Armor Slot beyond the ones already spent would still help. */
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

  const cap = slotCount(options.armorSlotCap, DEFAULT_ARMOR_SLOT_CAP);
  const available = slotCount(availableArmorSlots, 0);
  const requested = slotCount(options.armorSlots, 0);
  const rawIndex = LADDER.indexOf(rawSeverity);

  /*
   * Three separate limits, and the cap is the new one. Direct damage takes the
   * whole thing to zero; otherwise a hit can spend at most the cap in force,
   * at most the slots still open on the track, and at most the rungs there are
   * left to fall - a Minor hit has one rung under it no matter how much armor
   * is going spare. The spend is what was asked for, cut to that.
   */
  const spendable = options.direct === true ? 0 : Math.min(cap, available, rawIndex);
  const used = Math.min(requested, spendable);
  const severity = LADDER[rawIndex - used]!;

  const parts = [`${incoming} incoming`];
  if (reduction > 0) parts.push(`-${reduction} reduced`);
  parts.push(
    `vs ${stats.thresholds[0]}/${stats.thresholds[1]} -> ${SEVERITY_LABEL[rawSeverity]}`,
  );
  // The log line says what was spent, never what was asked for. A screen that
  // asked for three and got one has a refusal to report; the sheet's own
  // history has only the one slot that was really marked.
  if (used > 0) parts.push(`-${used} armor -> ${SEVERITY_LABEL[severity]}`);

  return {
    incoming,
    effective,
    rawSeverity,
    severity,
    hp: SEVERITY_HP[severity],
    armorSlotsUsed: used,
    armorSlotsRequested: requested,
    armorSlotCap: cap,
    armorSlotsSpendable: spendable,
    furtherReductionPossible: spendable - used > 0,
    explanation: parts.join(' · '),
  };
}

/**
 * Apply an outcome to a character's tracks. Never exceeds the maxima, and
 * never exceeds the cap the outcome itself declares.
 *
 * The second clamp is the half that makes the cap unforgeable. `applyDamage`
 * is the only thing that should ever build a `DamageOutcome`, but nothing in
 * the type system says so, and an object literal with `armorSlotsUsed: 3` is
 * three keystrokes away from any screen that finds the engine's answer
 * inconvenient. The cap rides on the outcome so this end can check it: the
 * only way to mark three slots for one hit is to have declared a cap that
 * allows three.
 */
export function markDamage(c: Character, outcome: DamageOutcome): Character {
  const slots = Math.min(
    slotCount(outcome.armorSlotsUsed, 0),
    slotCount(outcome.armorSlotCap, DEFAULT_ARMOR_SLOT_CAP),
  );
  return {
    ...c,
    hp: { ...c.hp, marked: Math.min(c.hp.max, c.hp.marked + outcome.hp) },
    armorSlots: {
      ...c.armorSlots,
      marked: Math.min(c.armorSlots.max, c.armorSlots.marked + slots),
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

/**
 * The Vulnerable test on two numbers, for the surfaces that do not hold a
 * `Character`.
 *
 * The sibling of `hasFallenAt` below, and it exists for the same reason and now
 * for a second one. An adversary is not a `Character` - it has no class, no
 * Armor Slots and no `DerivedStats` - but it does have a Stress track, and the
 * GM's combatant card keeps it as a plain `Counter`. Without this, the card
 * would have to write `marked >= max` itself, which is a second answer to a
 * question this file already answers, and the two would be free to drift.
 *
 * `max > 0` is the clause that matters rather than the comparison: a track with
 * no maximum is a record the dataset could not size, and calling everyone on
 * one Vulnerable would put the condition on every row of an unresolved import.
 *
 * ## That an adversary gets this at all is a reading, and it is registered
 *
 * The SRD says it of a *character*, in the `stress` section: "When a character
 * marks their last Stress, they become Vulnerable (see: Conditions) until they
 * clear at least 1 Stress." What carries it across is `using-adversaries`,
 * under DAMAGE THRESHOLDS, HIT POINTS, AND STRESS: "These systems function the
 * same way they do for PCs."
 *
 * So this is a reading of p.71 and not a quotation, exactly like the Massive
 * Damage argument above, and the owner took it the same way and for the same
 * reason on 2026-08-26 (`DECISIONI-2026-08-25.md` section 17): a table that
 * sees a rule applied to their own PCs and not to the monsters, with nothing on
 * screen saying so, is the worst shape, because it is silent.
 */
export const isVulnerableAt = (marked: number, max: number): boolean => max > 0 && marked >= max;

/** True while the character has every Stress slot marked - they are Vulnerable. */
export const isVulnerableFromStress = (c: Character): boolean =>
  isVulnerableAt(c.stress.marked, c.stress.max);

/**
 * The fallen test on two numbers, for the surfaces that do not hold a
 * `Character`.
 *
 * The GM's party board keeps its own tally in `PartyTracks` - four plain
 * counts and a maximum derived from the sheet beside them - so it cannot call
 * `hasFallen`, and writing `hp >= maxHp` there instead would be a second answer
 * to a question this file already answers. Both ends delegate here, so the
 * board and the sheet cannot start disagreeing about when a PC has to make a
 * death move.
 *
 * `max > 0` is the clause worth keeping rather than the comparison: a track
 * with no maximum is a sheet the dataset could not size, and treating everyone
 * on it as already down would put a death prompt on every row of an unresolved
 * import.
 */
export const hasFallenAt = (marked: number, max: number): boolean => max > 0 && marked >= max;

/** True when the last Hit Point is marked - the character must make a death move. */
export const hasFallen = (c: Character): boolean => hasFallenAt(c.hp.marked, c.hp.max);

/**
 * One hit on one adversary, and everything it decides at once.
 *
 * `applyDamage` above is the player's, and it is not reusable here: it wants a
 * `DerivedStats`, which an adversary has not got, and it spends Armor Slots,
 * which an adversary has not got either. What an adversary has is a threshold
 * pair that may be absent, a Hit Point counter, and - for a Minion group - a
 * divisor that turns one big hit into several dead bodies. Those three answers
 * come out together because they come from one number the GM typed.
 *
 * ## Three branches, and only one of them is `severityFor`
 *
 * `severityFor(amount, thresholds: [number, number], massiveDamageRule)` does
 * not take `null`, and that is not an oversight to work around: the SRD does
 * not give Minions a severity at all. Its sixteen no-threshold adversaries are
 * all and only Minions, and what it says about them is that any damage defeats
 * one. So the no-thresholds branch is the caller's, it returns `severity: null`
 * rather than an invented rung, and it marks the whole track.
 *
 * Nothing at or below zero does anything. An empty field, a minus sign, a
 * pasted word - these arrive from a text input on a card, and a NaN that walked
 * into the ladder would come back out as `hp: undefined`.
 *
 * ## The optional rule is an argument, and the caller reads the preference
 *
 * `prefs.massiveDamageRule` is off by default and a table turns it on
 * deliberately. Whether it also applies against an adversary is a reading, not
 * a quotation - the SRD says at p.71 that thresholds, HP and Stress "function
 * the same way they do for PCs", and the Massive text itself sits in the PC
 * chapter - and the owner took it on 2026-08-25: yes, the same preference, on
 * both sides. So this takes the flag and never a default, because the failure
 * being avoided is silent: a table that switched the rule on would otherwise
 * see it applied to their own PCs and not to the monsters, with nothing on
 * screen saying so.
 *
 * ## Minion overkill, and why the divisor is optional
 *
 * "For every N damage a PC deals to the X, defeat an additional Minion within
 * range the attack would succeed against" - so one hit defeats
 * `1 + floor(amount / N)` of them, and `amount === N` defeats two rather than
 * one. The divisor lives on the `Adversary` record and not on the combatant,
 * so a combatant whose `adversaryRef` this dataset cannot resolve has none, and
 * then there is no Minion arithmetic at all rather than a guessed divisor.
 * `minionsRemaining` caps it: a card must never offer to defeat bodies that are
 * not standing.
 */
export interface CombatantHit {
  /** What the GM typed, after the guard above. */
  amount: number;
  /** Null for an adversary with no thresholds: the SRD gives it no rung. */
  severity: Severity | null;
  /** Hit Points this hit marks. */
  hp: number;
  /** Where the HP track lands, already clamped to its maximum. */
  marked: number;
  /** The track is full: this combatant is out of the fight. */
  defeated: boolean;
  minionsDefeated: number;
  /** What `minionsRemaining` becomes, or undefined when nothing tracks it. */
  minionsRemaining: number | undefined;
  explanation: string;
}

export function combatantHit(
  amount: number,
  combatant: {
    thresholds: [number, number] | null;
    hp: Counter;
    minionsRemaining?: number;
  },
  options: { massiveDamageRule: boolean; minionGroup?: number },
): CombatantHit {
  const { hp, thresholds } = combatant;
  const clean = Number.isFinite(amount) ? Math.floor(amount) : 0;
  const standing = combatant.minionsRemaining;

  if (clean <= 0) {
    return {
      amount: Math.max(0, clean),
      severity: thresholds === null ? null : 'none',
      hp: 0,
      marked: hp.marked,
      defeated: hasFallenAt(hp.marked, hp.max),
      minionsDefeated: 0,
      minionsRemaining: standing,
      explanation: 'no damage',
    };
  }

  const parts = [`${clean} incoming`];
  let severity: Severity | null;
  let marks: number;
  if (thresholds === null) {
    severity = null;
    marks = Math.max(0, hp.max - hp.marked);
    parts.push('no thresholds -> defeated');
  } else {
    severity = severityFor(clean, thresholds, options.massiveDamageRule);
    marks = SEVERITY_HP[severity];
    parts.push(`vs ${thresholds[0]}/${thresholds[1]} -> ${SEVERITY_LABEL[severity]}`);
  }
  const marked = Math.min(hp.max, hp.marked + marks);

  const divisor = options.minionGroup;
  let minionsDefeated = 0;
  let minionsRemaining = standing;
  if (divisor !== undefined && Number.isFinite(divisor) && divisor > 0) {
    const raw = 1 + Math.floor(clean / divisor);
    minionsDefeated = standing === undefined ? raw : Math.min(raw, Math.max(0, standing));
    if (standing !== undefined) minionsRemaining = Math.max(0, standing - minionsDefeated);
    parts.push(`${minionsDefeated} minion${minionsDefeated === 1 ? '' : 's'} defeated`);
  }

  return {
    amount: clean,
    severity,
    hp: marks,
    marked,
    defeated: hasFallenAt(marked, hp.max),
    minionsDefeated,
    minionsRemaining,
    explanation: parts.join(' · '),
  };
}
