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
 * arrive at level up, through `levelUpCardGrants` at the bottom of this file.
 * One table, three tiers, two screens: the level-up path does not get its own
 * copy of the rule, because two copies of a rule is how they drift.
 */
import type { Dataset, Feature, Ref, Subclass } from '../../../shared/types.ts';

/** Which of a subclass's three feature lists a grant sits in. */
export type FeatureTier = 'foundation' | 'specialization' | 'mastery';

/**
 * The field each tier names on a `Subclass`. One mapping rather than a ternary
 * at each reader, which is how two of them end up disagreeing about which list
 * "mastery" means.
 */
const FEATURE_LIST = {
  foundation: 'foundationFeatures',
  specialization: 'specializationFeatures',
  mastery: 'masteryFeatures',
} as const satisfies Record<FeatureTier, keyof Subclass>;

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
 * Whether the dataset actually loaded still offers the subclass a grant is
 * keyed to.
 *
 * Consulted for the same reason the wizard's `review` consults the dataset
 * before raising a blocker: a subclass the dataset does not offer cannot have
 * been chosen from it, so a ref left over from an earlier draft or an older
 * dataset must not buy a card the player was never shown.
 *
 * The *feature* is deliberately not required to still be there. Keying on a
 * feature name at runtime is the same mistake as keying on its prose, one field
 * along: a layer that renames Accomplished has not removed the card, and the
 * grant would vanish with nothing failing anywhere. Checking that the table and
 * the dataset still agree about the names is the scan's job, in
 * `tests/ui/cardAllowance.test.ts`, where a mismatch is loud.
 */
const grantIsOffered = (grant: CardGrant, dataset: Pick<Dataset, 'subclasses'>): boolean =>
  dataset.subclasses.some((s) => s.id === grant.subclass);

/**
 * The feature a grant names, as this dataset words it, or null if this dataset
 * words it differently. Only the screen uses it, and only to print the sentence
 * verbatim beside the card picker - nothing decides anything on it.
 */
export function grantFeature(
  grant: CardGrant,
  dataset: Pick<Dataset, 'subclasses'>,
): Feature | null {
  const subclass = dataset.subclasses.find((s) => s.id === grant.subclass);
  return subclass?.[FEATURE_LIST[grant.tier]].find((f) => f.name === grant.feature) ?? null;
}

/** The grants that are live at creation, for the subclasses actually chosen. */
export function startingCardGrants(
  subclassRefs: readonly (Ref | null | undefined)[],
  dataset: Pick<Dataset, 'subclasses'>,
): CardGrant[] {
  return DOMAIN_CARD_GRANTS.filter(
    (grant) =>
      grant.tier === 'foundation' &&
      subclassRefs.includes(grant.subclass) &&
      grantIsOffered(grant, dataset),
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

// ---------------------------------------------------------------------------
// Level up
// ---------------------------------------------------------------------------

/**
 * A subclass card a level-up plan hands over.
 *
 * Three advancements produce one: "take an upgraded subclass card" produces a
 * specialization or a mastery, and multiclassing produces the foundation card
 * of a subclass belonging to the new class.
 */
export interface SubclassCardTaken {
  subclass: Ref;
  tier: FeatureTier;
}

/**
 * The extra domain card each of these subclass cards earns, index for index,
 * with null where it earns none.
 *
 * Index for index rather than a filtered list, because the screen has to put
 * the card picker underneath the advancement that paid for it - a bare list of
 * grants would leave it guessing which pick each one belonged to, and it would
 * guess wrong the first time a player takes two subclass advancements at once.
 *
 * A grant fires at most once per plan. Tier 4 offers the upgraded-subclass
 * advancement again beside tier 3's, and both read the same subclass, so a
 * player who takes both in one level would otherwise be handed Accomplished's
 * card twice for a feature that grants it once.
 */
export function levelUpCardGrants(
  taken: readonly (SubclassCardTaken | null | undefined)[],
  dataset: Pick<Dataset, 'subclasses'>,
): Array<CardGrant | null> {
  const spent = new Set<string>();
  return taken.map((card) => {
    if (!card) return null;
    const grant = DOMAIN_CARD_GRANTS.find(
      (g) => g.subclass === card.subclass && g.tier === card.tier,
    );
    if (!grant || !grantIsOffered(grant, dataset)) return null;
    const key = `${grant.subclass} · ${grant.tier}`;
    if (spent.has(key)) return null;
    spent.add(key);
    return grant;
  });
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'] as const;

/**
 * "Three level 1 cards", not "3 level 1 cards": two numerals with a space
 * between them read as one number at a glance, and this heading has to survive
 * being skimmed in bad light.
 */
export const cardCountWord = (n: number): string => WORDS[n] ?? String(n);
