/**
 * Beastform: the Druid's transformation, treated as a live combat state.
 *
 * Everything the form changes - Evasion, one trait, the attack you make - is
 * layered over the character by `deriveStats` and never written into the sheet.
 * This module is only the two costs the rules state as numbers and the level
 * filter on the list; the form's features are text, shown and never executed.
 */
import type { Beastform, Character, Dataset, Feature, Ref } from '../../shared/types.ts';
import { tierOf, type DatasetIndex } from './character.ts';
import { markStress } from './damage.ts';

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
