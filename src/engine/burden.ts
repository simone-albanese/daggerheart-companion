/**
 * Burden - how many hands a weapon takes - and the one class that ignores it.
 *
 * SRD 2.0 folio 55, under BURDEN: *"A weapon's burden indicates how many hands
 * it occupies when equipped. Your character's maximum burden is 2 hands."*
 *
 * The rule has a NAMED EXCEPTION and until this file the app carried none of
 * it. Folio 28, the Warrior's class feature Combat Training: *"You ignore
 * burden when equipping weapons."* `Weapon.burden` is a bare number, no screen
 * had ever asked whose hands were being counted, and so both build screens
 * printed "there is no hand left for an off-hand weapon" over the sheet of the
 * one class the book wrote the exception for. The wizard did more than say it:
 * it disabled the off-hand slot and deleted a weapon already chosen.
 *
 * ## Nothing here refuses anything
 *
 * The callers use this to decide whether to print a SENTENCE. That is the
 * decision `Edit.tsx` had already taken for the sheet - *"Said, not enforced. A
 * sheet that quietly unequipped the off-hand when a greatsword arrived would be
 * the app making a call the table gets to make"* - and this file is what lets
 * the wizard take it too, instead of the two screens disagreeing about whether
 * a rule is the app's to apply. A predicate that gated a control would put this
 * module straight back on the wrong side of that line.
 *
 * ## Only the first half of Combat Training
 *
 * The feature has a second sentence - *"When you deal physical damage, you gain
 * a bonus to your damage roll equal to your level."* - and it is deliberately
 * not here. `modifiers.ts` is the register of static bonuses, and every member
 * of its `RegisterStat` union is a number the SHEET prints: Evasion, the two
 * thresholds, max HP, max Stress, Armor Score, a trait. A damage roll is none
 * of those, so applying that half would mean opening a channel rather than
 * adding a row - a decision about what this app computes, which belongs to the
 * owner and not to a lane repairing a sentence. The text is still on the glass:
 * the Play screen prints class features verbatim.
 *
 * ## Asked of the dataset, and asked of BOTH class refs
 *
 * The same two reasons `hasBeastform` gives, and they hold here unchanged.
 *
 * Not a hardcoded `warrior` ref, because the question is "does this character
 * have the feature", and a layer that renames or re-slugs the class must not
 * silently take the exception away from the people the book gave it to.
 *
 * And both refs, because folio 54 MULTICLASSING says *"you choose an additional
 * class, gain access to one of its domains, and acquire its class feature"*. A
 * Ranger who multiclassed into Warrior ignores burden, and a version of this
 * that read `classRef` alone would tell them they cannot hold what they are
 * holding.
 *
 * ## One port, because two is how the multiclass gets dropped
 *
 * There is an obvious pull towards a second entry point taking a `CharClass`,
 * since the wizard's equipment step has a `klass` prop in hand. It is not
 * offered, and the paragraph above is the reason: a caller holding a
 * `Character` can always write `ix.classes.get(c.classRef)`, and the moment a
 * class-shaped port exists that becomes the cheap call - silently answering
 * `false` for every multiclassed Warrior, with no type error and no red test.
 * The only signature here is the one that cannot lose a ref.
 *
 * The wizard pays nothing for that. `StepEquipment` already assembles a real
 * `Character` out of the draft, because the gear pickers need one for their own
 * numbers, and the comment over it states the rule this reuses: *"Nothing is
 * transcribed twice."*
 */
import type { Character, Ref } from '../../shared/types.ts';
import type { DatasetIndex } from './character.ts';

/**
 * The class feature that lifts the two-hand limit, by the name the book prints
 * over it.
 *
 * This is an ADDRESS, and the rule this repo puts on writing one into `src/` is
 * that it is CHECKED AGAINST THE DATASET EVERY RUN - the same condition
 * `STANCE_SUBCLASS` is held to. `tests/engine/burden.test.ts` does it: if a
 * printing renames the feature, that test reddens rather than the exception
 * quietly ceasing to exist for everybody who has it.
 *
 * The NAME and not the sentence, which is a real trade and worth stating.
 * Matching `/ignore burden/i` over `feature.text` would survive a rename and
 * die on a re-wording; matching the name survives a re-wording and dies on a
 * rename. Neither is free, so the tie goes to the form `hasBeastform` already
 * uses - one shape for "does this class carry feature X" - and to the half that
 * a test can pin without reading prose.
 */
export const IGNORES_BURDEN_FEATURE = 'Combat Training';

/**
 * Whether this character equips weapons without counting hands.
 *
 * False is also the answer for a sheet whose class this build cannot name - an
 * imported character parked on `''` or on a ref from a later dataset. That is
 * the honest default and not a silent one: false means the screens print the
 * general rule, which is what the book says for everybody the exception is not
 * written down for.
 */
export function ignoresBurden(c: Character, ix: DatasetIndex): boolean {
  return [c.classRef, c.multiclassRef]
    .filter((r): r is Ref => typeof r === 'string' && r !== '')
    .some(
      (r) =>
        ix.classes.get(r)?.classFeatures.some((f) => f.name === IGNORES_BURDEN_FEATURE) === true,
    );
}
