/**
 * Beastform: the Druid's transformation, treated as a live combat state.
 *
 * Everything the form changes - Evasion, one trait, the attack you make - is
 * layered over the character by `deriveStats` and never written into the sheet.
 * This module is the costs the rules state as numbers - a Stress to transform,
 * the Hybrid forms' surcharge on top of it, three Hope for Evolution - the one
 * refusal the Stress rule states, the level filter on the list, and the one
 * line of arithmetic the attack needs. The form's features are text, shown and
 * never executed, with one sentence excepted and named: `beastformExtraStress`
 * reads the two Hybrid forms' "mark an additional Stress", because that
 * sentence IS the price of entry and a picker that charged 1 beside it was
 * printing a number the book contradicts two lines lower.
 */
import type { Beastform, Character, Dataset, Feature, Ref } from '../../shared/types.ts';
import { tierOf, type DatasetIndex } from './character.ts';
import { markStress } from './damage.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';

/** "Mark a Stress to magically transform into a creature of your tier or lower." */
export const BEASTFORM_STRESS_COST = 1;

/**
 * The Stress a form charges ON TOP of the Druid feature's own, read off its
 * printed text.
 *
 * SRD 2 p18 prices two forms this way and no other: Legendary Hybrid, *"To
 * transform into this creature, mark an additional Stress"*, and Mythic
 * Hybrid, *"mark 2 additional Stress"*. So a Legendary Hybrid costs 2 and a
 * Mythic Hybrid 3, and the app used to charge 1 for both.
 *
 * A REGEX OVER FEATURE TEXT, WHICH THIS CODEBASE REFUSES ALMOST EVERYWHERE -
 * `modifiers.ts` opens with why. It is allowed here on the narrowest possible
 * grounds: the match is the exact phrase "mark (an|N) additional Stress" and
 * nothing looser, so tier 4's *Devastating Strikes* - "mark a Stress to force
 * them to mark an additional Hit Point", a Stress spent in play - reads 0, and
 * the dataset has no field for it because `shared/types.ts::Beastform` was
 * shaped before SRD 2 printed a form with a price. Zero for a form this build
 * cannot resolve, so an unknown ref costs what the base feature says.
 */
export function beastformExtraStress(form: Beastform | undefined): number {
  if (form === undefined) return 0;
  for (const f of form.features) {
    const m = /\bmark (an|\d+) additional Stress\b/i.exec(f.text);
    if (m !== null) return m[1]!.toLowerCase() === 'an' ? 1 : Number(m[1]);
  }
  return 0;
}

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
 * range, trait, and damage dice, but you use your Proficiency"* - folio 15,
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

/** What a transformation would cost, and whether the book lets it happen. */
export interface BeastformCost {
  /** Stress the entry marks: the Druid feature's own plus the form's surcharge. */
  stressCost: number;
  /** Hope the entry spends: `EVOLUTION_HOPE_COST` on that path, else 0. */
  hopeCost: number;
  /**
   * False when the entry requires marking Stress and every Stress is marked.
   *
   * SRD 2 p50: *"A character can't use a move that requires them to mark
   * Stress if all of their Stress is marked."* Beastform is such a move by its
   * own sentence - *"Mark a Stress to magically transform"* - so this is a
   * refusal and not, as it was, a Hit Point taken instead. That used to be
   * reachable in one tap on a 6/6 track, and at 5/6 HP it was the last Hit
   * Point and `dropFormOnLastHitPoint` threw the form away in the same tap.
   * Evolution costs no Stress and stays open at a full track, unless the form
   * is a Hybrid, whose surcharge is Stress the entry still requires.
   */
  allowed: boolean;
  /** True when every Stress the entry marks fits on the track. */
  affordable: boolean;
  /**
   * Hit Points the entry would mark: 1 when the cost exceeds the free Stress
   * and a Hit Point is free to mark, else 0. One and never the shortfall,
   * which is `markStress`'s rule and p50's sentence.
   */
  hpCost: number;
}

export function beastformCost(
  c: Character,
  ref: Ref,
  pay: 'stress' | 'evolution',
  ix: DatasetIndex,
): BeastformCost {
  const extra = beastformExtraStress(ix.beastforms.get(ref));
  const stressCost = (pay === 'evolution' ? 0 : BEASTFORM_STRESS_COST) + extra;
  const free = Math.max(0, c.stress.max - c.stress.marked);
  const allowed = stressCost === 0 || free > 0;
  const overflow = Math.max(0, stressCost - free);
  return {
    stressCost,
    hopeCost: pay === 'evolution' ? EVOLUTION_HOPE_COST : 0,
    allowed,
    affordable: overflow === 0,
    hpCost: allowed && overflow > 0 && c.hp.marked < c.hp.max ? 1 : 0,
  };
}

export interface TransformOutcome {
  character: Character;
  stressMarked: number;
  /** Stress that overflowed into a Hit Point, if the track could not take it all. */
  hpMarked: number;
  hopeSpent: number;
  /** True when p50 refused the entry: nothing was marked and no form was entered. */
  refused: boolean;
}

/**
 * Pay for a transformation and enter the form.
 *
 * The cost is unambiguous and the player asked for it by name, so it is
 * applied; what the form then *does* is its printed text and stays theirs.
 * `beastformCost` is the price list and the refusal; this is the payment, and
 * the two are one rule because this reads that.
 */
export function enterBeastform(
  c: Character,
  ref: Ref,
  pay: 'stress' | 'evolution',
  ix: DatasetIndex,
): TransformOutcome {
  const cost = beastformCost(c, ref, pay, ix);
  if (!cost.allowed) {
    return { character: c, stressMarked: 0, hpMarked: 0, hopeSpent: 0, refused: true };
  }
  const activatedAt = new Date().toISOString();

  const hopeSpent = Math.min(cost.hopeCost, c.hope.marked);
  const paidHope: Character =
    hopeSpent === 0 ? c : { ...c, hope: { ...c.hope, marked: c.hope.marked - hopeSpent } };
  const out =
    cost.stressCost === 0
      ? { character: paidHope, stressMarked: 0, hpMarked: 0 }
      : markStress(paidHope, cost.stressCost);
  return {
    character: { ...out.character, beastform: { ref, activatedAt } },
    stressMarked: out.stressMarked,
    hpMarked: out.hpMarked,
    hopeSpent,
    refused: false,
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
 * Druid can enter a form and fall out of it in a single tap. Narrower than it
 * was: a full track now refuses the entry (`beastformCost`, p50), so the one
 * route left is a Hybrid whose surcharge exceeds the Stress still free.
 */
export function dropFormOnLastHitPoint(before: Character, after: Character): Character {
  if (after.beastform === null) return after;
  const marked = after.hp.marked > before.hp.marked;
  const fell = marked && after.hp.marked >= after.hp.max;
  return fell ? leaveBeastform(after) : after;
}
