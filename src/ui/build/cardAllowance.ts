/**
 * How many domain cards a character takes at creation.
 *
 * The SRD's step 8 says two, and for seventeen of the eighteen subclasses it is
 * two. A Wizard who takes School of Knowledge gets three, because that
 * subclass's foundation feature Prepared reads "Take an additional domain card
 * of your level or lower from a domain you have access to." An app that
 * hardcodes two tells that player they are finished one card short, and they
 * find out weeks later, from a GM, mid-fight, holding a sheet the app built.
 *
 * The grant is recorded in a table keyed by subclass id, not read out of the
 * feature's prose at runtime. Prose is the wrong key: a revision can reword a
 * sentence without changing a rule, and a regex over /additional domain card/
 * would then stop granting the card with nothing anywhere failing - the same
 * silent undercount, arrived at by a longer road. A table cannot notice a
 * subclass a future revision adds, so that job is the test's:
 * `tests/ui/cardAllowance.test.ts` scans every subclass feature in the real
 * dataset for that phrase and fails, naming the feature it found, if this table
 * does not already account for it. The table decides what the app does; the
 * test is what keeps the table honest.
 *
 * Only foundation features apply at creation. School of Knowledge grants the
 * same card again at specialization and again at mastery, and both of those
 * arrive at level up. They are listed here anyway so the dataset scan can tell
 * "known, but not yet" apart from "nobody has ever looked at this".
 */
import type { Dataset, Ref } from '../../../shared/types.ts';

/** Which of a subclass's three feature lists a grant sits in. */
export type FeatureTier = 'foundation' | 'specialization' | 'mastery';

/** One subclass feature that hands out one extra domain card. */
export interface CardGrant {
  /** `dataset.subclasses[].id`. */
  subclass: Ref;
  tier: FeatureTier;
  /** The feature's name in the SRD. The scan matches on it; the UI names it. */
  feature: string;
}

/** What the SRD's step 8 gives everyone: "Choose two cards from your class's domains." */
export const BASE_STARTING_CARDS = 2;

/**
 * Every subclass feature in the SRD that grants an extra domain card. Each one
 * grants exactly one - "an additional domain card", singular, in all three.
 */
export const DOMAIN_CARD_GRANTS: readonly CardGrant[] = [
  { subclass: 'school-of-knowledge', tier: 'foundation', feature: 'Prepared' },
  { subclass: 'school-of-knowledge', tier: 'specialization', feature: 'Accomplished' },
  { subclass: 'school-of-knowledge', tier: 'mastery', feature: 'Brilliant' },
];

/**
 * The grants that are live at creation, for the subclasses actually chosen.
 *
 * The dataset is consulted for the same reason the wizard's `review` consults
 * it before raising a blocker: a subclass the dataset does not offer cannot
 * have been chosen from it, so a ref left over from an earlier draft or an
 * older dataset must not buy a card the player was never shown.
 */
export function startingCardGrants(
  subclassRefs: readonly (Ref | null | undefined)[],
  dataset: Pick<Dataset, 'subclasses'>,
): CardGrant[] {
  return DOMAIN_CARD_GRANTS.filter(
    (grant) =>
      grant.tier === 'foundation' &&
      subclassRefs.includes(grant.subclass) &&
      dataset.subclasses.some((s) => s.id === grant.subclass),
  );
}

/**
 * How many level 1 cards this character takes at creation. Two, plus one per
 * live foundation grant - a multiclass would add each of its subclasses' - and
 * never fewer than two, because a grant only ever adds.
 */
export function startingCardAllowance(
  subclassRefs: readonly (Ref | null | undefined)[],
  dataset: Pick<Dataset, 'subclasses'>,
): number {
  return BASE_STARTING_CARDS + startingCardGrants(subclassRefs, dataset).length;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'] as const;

/**
 * "Three level 1 cards", not "3 level 1 cards": two numerals with a space
 * between them read as one number at a glance, and this heading has to survive
 * being skimmed in bad light.
 */
export const cardCountWord = (n: number): string => WORDS[n] ?? String(n);
