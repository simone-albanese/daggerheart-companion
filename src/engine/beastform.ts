/**
 * Beastform: the Druid's transformation, treated as a live combat state.
 *
 * Everything the form changes - Evasion, one trait, the attack you make - is
 * layered over the character by `deriveStats` and never written into the sheet.
 * This module is the two costs the rules state as numbers, the level filter on
 * the list, and the one line of arithmetic the attack needs; the form's
 * features are text, shown and never executed.
 */
import type { Beastform, Character, Dataset, Feature, Ref } from '../../shared/types.ts';
import { tierOf, type DatasetIndex } from './character.ts';
import { markStress } from './damage.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';

/** "Mark a Stress to magically transform into a creature of your tier or lower." */
export const BEASTFORM_STRESS_COST = 1;

/** "Class Hope features ... cost 3 Hope to activate." */
export const EVOLUTION_HOPE_COST = 3;

/** The forms a character may take: their tier or lower. */
export function beastformOptions(level: number, ds: Dataset): Beastform[] {
  const tier = tierOf(level);
  return ds.beastforms.filter((b) => b.tier <= tier);
}

/**
 * Whether this character can transform at all.
 *
 * Asked of the dataset rather than of a hardcoded `druid` ref, because a
 * multiclass into Druid grants the class feature too, and because a layer that
 * renames the class must not silently take the control away.
 */
export function hasBeastform(c: Character, ix: DatasetIndex): boolean {
  return [c.classRef, c.multiclassRef]
    .filter((r): r is Ref => typeof r === 'string' && r !== '')
    .some((r) => ix.classes.get(r)?.classFeatures.some((f) => f.name === 'Beastform') === true);
}

/**
 * The Hope Feature that pays for a transformation, when this character has one.
 *
 * Only the character's own class is asked. Multiclassing "acquires its class
 * feature" and nothing else, so a Ranger who multiclassed into Druid gets
 * Beastform but never got Evolution, and must not be offered its price. Matched
 * on the feature's own text rather than on the name `Evolution`, so the button
 * says whatever the dataset calls it.
 */
export function evolutionFeature(c: Character, ix: DatasetIndex): Feature | null {
  const hope = ix.classes.get(c.classRef)?.hopeFeature;
  return hope !== undefined && /beastform/i.test(hope.text) ? hope : null;
}

/**
 * The damage a worn form's attack rolls, with Proficiency applied.
 *
 * *"When you make an attack while transformed, you use the creature's listed
 * range, trait, and damage dice, but you use your Proficiency"* - folio 12,
 * which the dataset carries as `beastform-options`. So a form's printed
 * `d12+10` is a die and a flat bonus exactly the way a weapon's is, and it goes
 * through the same two calls a weapon does. That is deliberate: `weaponDamage`
 * and `companionDamage` are these two calls as well, and a third route to one
 * number is how the three stop agreeing.
 *
 * Null for a damage string that will not parse, which the SRD's own forms never
 * produce but a layer's can.
 */
export function beastformDamage(
  form: Beastform,
  proficiency: number,
): { spec: string; count: number; sides: number; modifier: number } | null {
  const parsed = parseDamage(form.attack.damage);
  if (!parsed) return null;
  const scaled = applyProficiency(parsed, proficiency);
  return { spec: formatDamage(scaled), ...scaled };
}

export interface TransformOutcome {
  character: Character;
  stressMarked: number;
  /** Stress that overflowed into Hit Points, if the track was already full. */
  hpMarked: number;
  hopeSpent: number;
}

/**
 * Pay for a transformation and enter the form.
 *
 * The cost is unambiguous and the player asked for it by name, so it is
 * applied; what the form then *does* is its printed text and stays theirs.
 */
export function enterBeastform(
  c: Character,
  ref: Ref,
  pay: 'stress' | 'evolution',
): TransformOutcome {
  const activatedAt = new Date().toISOString();

  if (pay === 'evolution') {
    const hopeSpent = Math.min(EVOLUTION_HOPE_COST, c.hope.marked);
    return {
      character: {
        ...c,
        hope: { ...c.hope, marked: c.hope.marked - hopeSpent },
        beastform: { ref, activatedAt },
      },
      stressMarked: 0,
      hpMarked: 0,
      hopeSpent,
    };
  }

  const out = markStress(c, BEASTFORM_STRESS_COST);
  return {
    character: { ...out.character, beastform: { ref, activatedAt } },
    stressMarked: out.stressMarked,
    hpMarked: out.hpMarked,
    hopeSpent: 0,
  };
}

/** Dropping out is free, always available, and loses nothing. */
export function leaveBeastform(c: Character): Character {
  return { ...c, beastform: null };
}

/**
 * *"If you mark your last Hit Point, you automatically drop out of this form."*
 *
 * The last clause of the Beastform feature, and the only part of it that is the
 * app's to do: no choice is being made and no number is being guessed, which is
 * the same bar `enterBeastform` pays a Stress on.
 *
 * IT IS EDGE-TRIGGERED, AND THAT IS THE RULE AND NOT AN OPTIMISATION. The
 * sentence is about the moment of marking, not about a standing condition. A
 * character who is already on their last Hit Point and lives - a death move
 * they walked away from, an ally who cleared it back - may transform again, and
 * a level-triggered version of this would strip the form off them on the next
 * write and never say why. So it needs both sides, and takes them.
 *
 * AND THE EDGE IS THE MARK, NOT THE GAP CLOSING. The first version asked
 * whether the track had *become* full - `before.marked < before.max &&
 * after.marked >= after.max` - which is true of a mark and also true of a
 * maximum that dropped onto a mark already there. `syncCounters` writes
 * `hp.max` from the derived maximum and clamps `marked` to it, so a dataset
 * reload that lowers a class's starting Hit Points would have dropped a Druid
 * out of their form and written "Last Hit Point marked" into the log, which
 * would have been a false sentence about something nobody did. Asking whether
 * `marked` went UP covers every real route - the damage calculator, the pips,
 * a Stress that overflowed - and covers no other.
 *
 * Every route that marks Hit Points goes through the store's one `update`: the
 * damage calculator, the pips on the track, and a Stress mark that overflowed -
 * including the Stress that paid for the transformation itself, which is how a
 * Druid can enter a form and fall out of it in a single tap.
 */
export function dropFormOnLastHitPoint(before: Character, after: Character): Character {
  if (after.beastform === null) return after;
  const marked = after.hp.marked > before.hp.marked;
  const fell = marked && after.hp.marked >= after.hp.max;
  return fell ? leaveBeastform(after) : after;
}
