/**
 * Levelling up.
 *
 * Four steps: tier achievements, two advancements, +1 to both damage
 * thresholds, and a new domain card. Everything here is a constraint the rules
 * state numerically, so it is enforced; nothing here interprets a feature.
 *
 * A NOTE ON THE SLOT COUNTS
 * -------------------------
 * The SRD gives the advancement options and the rule ("choose any two
 * advancements with at least one unmarked slot from your tier or below"), but
 * the number of slots each option has is printed on the character sheet as
 * checkboxes, not as text, so it is not extractable from either PDF. The
 * counts below were read off the printed advancement table and are the plain
 * mechanical numbers, not book text.
 */
import type {
  AdvancementKind,
  Character,
  DomainCard,
  DomainId,
  LevelUpChoice,
  Ref,
  Tier,
  Trait,
} from '../../shared/types.ts';
import { MAX_HP, MAX_LEVEL, MAX_STRESS, TIER_LEVELS, tierOf } from './character.ts';
import { COMPANION_START } from './companion.ts';

export interface AdvancementOption {
  kind: AdvancementKind;
  /** Unique within a tier. */
  id: string;
  label: string;
  detail: string;
  /**
   * How many of the tier's boxes this option prints on the sheet.
   *
   * Not "how many times it may be taken" - that is only the same number for the
   * options whose boxes are separate. See `slotsPerTaking`.
   */
  slots: number;
  /**
   * Proficiency and Multiclass are printed inside a black box: taking one
   * consumes both of the level's advancement picks.
   */
  costsBothPicks: boolean;
  /** Earliest tier at which the option appears. */
  fromTier: Tier;
}

const TRAIT_OPTION: Omit<AdvancementOption, 'fromTier'> = {
  kind: 'trait',
  id: 'traits',
  label: 'Gain a +1 bonus to two unmarked character traits and mark them',
  detail:
    "Choose two unmarked character traits and gain a permanent +1 bonus to them. You can't increase these again until the next tier, when your tier achievement clears the marks.",
  slots: 3,
  costsBothPicks: false,
};

const BASE_OPTIONS: Array<Omit<AdvancementOption, 'fromTier'>> = [
  TRAIT_OPTION,
  {
    kind: 'hitPoint',
    id: 'hit-point',
    label: 'Permanently gain one Hit Point slot',
    detail: 'Add a Hit Point slot, to a maximum of 12.',
    slots: 2,
    costsBothPicks: false,
  },
  {
    kind: 'stress',
    id: 'stress',
    label: 'Permanently gain one Stress slot',
    detail: 'Add a Stress slot, to a maximum of 12.',
    slots: 2,
    costsBothPicks: false,
  },
  {
    kind: 'experience',
    id: 'experience',
    label: 'Permanently gain a +1 bonus to two Experiences',
    detail: 'Choose two Experiences and gain a permanent +1 bonus to both.',
    slots: 1,
    costsBothPicks: false,
  },
  {
    kind: 'domainCard',
    id: 'domain-card',
    label: 'Choose an additional domain card',
    detail:
      'Take an additional domain card at or below your level from a domain you have access to. If you have multiclassed, a card from the multiclass domain may be at most half your level, rounded up.',
    slots: 1,
    costsBothPicks: false,
  },
  {
    kind: 'evasion',
    id: 'evasion',
    label: 'Permanently gain a +1 bonus to your Evasion',
    detail: 'Gain a permanent +1 bonus to your Evasion.',
    slots: 1,
    costsBothPicks: false,
  },
];

const TIER3_OPTIONS: Array<Omit<AdvancementOption, 'fromTier'>> = [
  {
    kind: 'subclass',
    id: 'subclass',
    label: 'Take an upgraded subclass card',
    detail:
      'Take the next card for your subclass: a specialization if you only have the foundation, a mastery if you already have a specialization. Then cross out the multiclass option for this tier.',
    slots: 1,
    costsBothPicks: false,
  },
  {
    kind: 'proficiency',
    id: 'proficiency',
    label: 'Increase your Proficiency by +1',
    detail:
      'Your weapon rolls one more damage die. This option is printed inside a black box: it costs both of this level’s advancement picks.',
    slots: 2,
    costsBothPicks: true,
  },
  {
    kind: 'multiclass',
    id: 'multiclass',
    label: 'Multiclass',
    detail:
      'Choose an additional class, select one of its domains, gain its class feature and take a foundation card from one of its subclasses. Then cross out an unused "upgraded subclass" option and the other multiclass option. Costs both of this level’s advancement picks.',
    slots: 2,
    costsBothPicks: true,
  },
];

/**
 * The two advancements that cross each other out within a tier: the upgraded
 * subclass card says "cross out this tier's multiclass option", and multiclass
 * says "cross out the upgraded subclass advancement option in this tier". Each
 * tier therefore offers one or the other, never both.
 */
const CROSSES_OUT: Record<string, string> = { subclass: 'multiclass', multiclass: 'subclass' };
const OPTION_NOUN: Record<string, string> = {
  subclass: 'upgraded subclass',
  multiclass: 'multiclass',
};

export function optionsForTier(tier: Tier): AdvancementOption[] {
  if (tier <= 1) return [];
  const base = BASE_OPTIONS.map((o) => ({ ...o, fromTier: 2 as Tier }));
  if (tier === 2) return base;
  return [...base, ...TIER3_OPTIONS.map((o) => ({ ...o, fromTier: 3 as Tier }))];
}

/**
 * Options available at a given tier, which includes every option from lower
 * tiers - each tier's slots are tracked separately.
 */
export function availableOptions(tier: Tier): Array<AdvancementOption & { tier: Tier }> {
  const out: Array<AdvancementOption & { tier: Tier }> = [];
  for (const t of [2, 3, 4] as Tier[]) {
    if (t > tier) break;
    for (const o of optionsForTier(t)) out.push({ ...o, tier: t });
  }
  return out;
}

export interface TierAchievement {
  level: number;
  newExperience: boolean;
  proficiency: number;
  clearTraitMarks: boolean;
  text: string;
}

/** What the character gains automatically on entering a new tier. */
export function tierAchievementFor(level: number): TierAchievement | null {
  if (level === 2) {
    return {
      level,
      newExperience: true,
      proficiency: 1,
      clearTraitMarks: false,
      text: 'Gain a new Experience at +2 and permanently increase your Proficiency by 1.',
    };
  }
  if (level === 5 || level === 8) {
    return {
      level,
      newExperience: true,
      proficiency: 1,
      clearTraitMarks: true,
      text: 'Gain a new Experience at +2, permanently increase your Proficiency by 1, and clear any marked traits.',
    };
  }
  return null;
}

/**
 * How many of a tier's boxes one taking of this option marks.
 *
 * The black-boxed options - Proficiency and Multiclass - print their two boxes
 * joined, and the rule is explicit: *"you must spend two advancements and mark
 * BOTH level-up slots in order to take it."* One taking therefore fills the
 * option for that tier.
 *
 * Everything here used to count one box per taking, and `slots` was documented
 * as the number of takings - true only of the unboxed options. So Proficiency
 * could be taken at level 5 and again at level 6, both validating `ok`, and a
 * level 10 character reached Proficiency 8 where the sheet allows 6: a `d8+2`
 * weapon rolling `8d8+2` instead of `6d8+2`, which is a wrong number on the one
 * roll a player makes most.
 */
export const slotsPerTaking = (option: AdvancementOption): number =>
  option.costsBothPicks ? option.slots : 1;

export interface SlotUsage {
  optionId: string;
  tier: Tier;
  used: number;
  slots: number;
  remaining: number;
}

/** How many slots of each option the character has already spent. */
export function slotUsage(c: Character): SlotUsage[] {
  return availableOptions(4).map((o) => {
    const takings = c.levelUpHistory.filter(
      (h) => h.detail['optionId'] === o.id && h.detail['optionTier'] === o.tier,
    ).length;
    const used = takings * slotsPerTaking(o);
    /*
     * Clamped, because a character levelled by a build that had this wrong
     * carries two takings of a boxed option in one tier and would report four
     * boxes used of two. Their sheet is not rewritten: the advancement was
     * taken, the history says so, and quietly removing one would be the app
     * deciding a player's record was wrong. What changes is that the tier is
     * full from here on.
     */
    // `used` is what the history says and is deliberately not clamped - it is
    // the record. `remaining` is what is still on offer, which cannot be
    // negative. On a sheet from the older build the two disagree, and that
    // disagreement is the honest description of it.
    return {
      optionId: o.id,
      tier: o.tier,
      used,
      slots: o.slots,
      remaining: Math.max(0, o.slots - used),
    };
  });
}

export interface LevelUpPlan {
  fromLevel: number;
  toLevel: number;
  tier: Tier;
  achievement: TierAchievement | null;
  /** Two picks, or one entry that costs both. */
  picks: Array<{ optionId: string; optionTier: Tier; detail: Record<string, unknown> }>;
  /** The card taken at step four, which is not an advancement. */
  newCardRef: string | null;
  /**
   * Step four's second sentence: one card given up for one card taken.
   *
   * *"You can also exchange one domain card you've previously acquired for a
   * different domain card of the same level or lower."* Folio 53. Separate from
   * `newCardRef` because they are two different offers in the same step - a
   * level grants the new card whether or not anything is exchanged - and
   * because only this one has a rule attached that something has to enforce.
   */
  exchange: CardExchange | null;
}

/** One card given up for one card taken, at step four. */
export interface CardExchange {
  /** A card the character already owns, in the loadout or the vault. */
  fromRef: Ref;
  /** A card they do not, at the level of `fromRef` or lower. */
  toRef: Ref;
}

/** The `optionId` an exchange records. No `AdvancementOption` has this id. */
export const CARD_EXCHANGE_OPTION = 'card-exchange';

/**
 * The two dataset facts the exchange rule needs, and nothing else.
 *
 * Two fields rather than a `DatasetIndex` and a `DerivedStats`, because those
 * are what the caller HAS and this is what the rule NEEDS - and a validator
 * that takes the whole index is a validator the next rule can quietly start
 * reading anything out of.
 *
 * `domains` comes from `deriveStats` and is not recomputed here. A second
 * derivation of "which domains can this character reach" would be a second
 * answer to a question `cardAvailability` and every card list already ask, and
 * the day a multiclass or a subclass feature changes that answer, one of the
 * two would keep the old one.
 */
export interface PlanContext {
  /** Every card this build can name, for the level comparison. */
  cards: ReadonlyMap<Ref, DomainCard>;
  /** The domains the sheet this plan PRODUCES can reach, from `deriveStats`. */
  domains: readonly DomainId[];
}

export interface Validation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check a plan, and - when an exchange is in it - check it against the cards.
 *
 * ## Why there is a third parameter at all
 *
 * This module has no dataset, on purpose: everything it enforces is a number
 * the rules state, and a card's LEVEL is not one of those - it is a fact about
 * a printing. The precedent for a dataset question is `applyLevelUp`'s granted
 * card, where `src/ui/build/cardAllowance.ts` decides and the plan carries the
 * answer.
 *
 * The exchange cannot take that shape. "Of the same level or lower" is a rule
 * of character construction rather than a ruling the table makes, so a plan
 * that carried its own answer would be a plan that could lie - and the caller
 * that built it is the same screen that would be lying. So the levels are
 * looked up here, out of the index the caller already holds, and the plan
 * carries only the two refs.
 *
 * `context` is optional so that the two callers with no dataset - the simulator
 * and the sample builder - keep compiling, and an exchange without one is
 * REFUSED rather than waved through. A missing lookup is the one case where
 * "cannot check" and "is fine" must not be the same answer.
 */
export function validatePlan(
  c: Character,
  plan: LevelUpPlan,
  context?: PlanContext,
): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (plan.toLevel !== plan.fromLevel + 1) errors.push('Level up moves exactly one level.');
  if (plan.toLevel > MAX_LEVEL) errors.push(`Level ${MAX_LEVEL} is the maximum.`);
  // The plan carries its own levels, and nothing else ties them to the sheet
  // being levelled: without this a stale or hand-built plan walks a level 2
  // character straight to level 9, and `applyLevelUp` writes it down.
  if (plan.fromLevel !== c.level) {
    errors.push(`This plan starts at level ${plan.fromLevel}, but the character is level ${c.level}.`);
  }
  // The tier decides which advancements are on the table, so a plan that
  // disagrees with its own level would hand out options the level has not
  // unlocked.
  if (plan.tier !== tierOf(plan.toLevel)) {
    errors.push(`Level ${plan.toLevel} is tier ${tierOf(plan.toLevel)}, not tier ${plan.tier}.`);
  }
  // `achievement` decides whether the trait marks are cleared before the picks
  // are read. Taking the caller's word for it lets a plan at level 3 clear the
  // marks and take the same two traits again.
  const expectedAchievement = tierAchievementFor(plan.toLevel);
  if ((plan.achievement?.level ?? null) !== (expectedAchievement?.level ?? null)) {
    errors.push(
      expectedAchievement === null
        ? `Level ${plan.toLevel} has no tier achievement.`
        : `Level ${plan.toLevel}'s tier achievement is missing from this plan.`,
    );
  }

  const options = new Map(availableOptions(plan.tier).map((o) => [`${o.id}@${o.tier}`, o]));
  const usage = new Map(slotUsage(c).map((u) => [`${u.optionId}@${u.tier}`, u]));

  // A tier achievement clears the trait marks *before* the advancements are
  // chosen, so at level 5 and 8 every trait is available again. Marks made by
  // an earlier pick in this same plan still count. The level decides this, not
  // the plan: reading `plan.achievement` here would let the forgery above clear
  // the marks in the very check that is meant to catch it.
  const marks: Partial<Record<Trait, number>> =
    expectedAchievement?.clearTraitMarks === true ? {} : { ...c.traitMarks };

  let picksUsed = 0;
  const takenThisLevel = new Map<string, number>();

  for (const pick of plan.picks) {
    const key = `${pick.optionId}@${pick.optionTier}`;
    const option = options.get(key);
    if (!option) {
      errors.push(`"${pick.optionId}" is not available at tier ${plan.tier}.`);
      continue;
    }
    picksUsed += option.costsBothPicks ? 2 : 1;

    const already = (usage.get(key)?.used ?? 0) + (takenThisLevel.get(key) ?? 0);
    takenThisLevel.set(key, (takenThisLevel.get(key) ?? 0) + slotsPerTaking(option));
    if (already >= option.slots) {
      errors.push(`"${option.label}" has no unmarked slots left at tier ${option.tier}.`);
    }

    const crossedOut = CROSSES_OUT[option.id];
    if (crossedOut !== undefined) {
      const otherKey = `${crossedOut}@${option.tier}`;
      const otherTaken = (usage.get(otherKey)?.used ?? 0) + (takenThisLevel.get(otherKey) ?? 0);
      if (otherTaken > 0) {
        errors.push(
          `The ${OPTION_NOUN[crossedOut]} advancement at tier ${option.tier} crossed out that tier's ${OPTION_NOUN[option.id]} option.`,
        );
      }
    }

    if (option.kind === 'trait') {
      const traits = (pick.detail['traits'] as Trait[] | undefined) ?? [];
      if (traits.length !== 2) errors.push('Choose exactly two traits to increase.');
      if (new Set(traits).size !== traits.length) errors.push('Choose two different traits.');
      for (const t of traits) {
        if ((marks[t] ?? 0) > 0) errors.push(`${t} is already marked this tier.`);
        marks[t] = (marks[t] ?? 0) + 1;
      }
    }
    if (option.kind === 'multiclass') {
      if (plan.tier < 3) errors.push('Multiclassing unlocks at level 5.');
      if (c.multiclassRef !== null) errors.push('You have already multiclassed.');
      if (!pick.detail['classRef']) errors.push('Choose the class to multiclass into.');
      if (!pick.detail['domain']) errors.push('Choose which of its domains you gain access to.');
      if (!pick.detail['subclassRef']) errors.push('Choose a foundation card from one of its subclasses.');
    }
    if (option.kind === 'hitPoint' && c.hp.max >= MAX_HP) {
      warnings.push(`Hit Points are already at the maximum of ${MAX_HP}.`);
    }
    if (option.kind === 'stress' && c.stress.max >= MAX_STRESS) {
      warnings.push(`Stress is already at the maximum of ${MAX_STRESS}.`);
    }
  }

  if (picksUsed !== 2) {
    errors.push(
      picksUsed < 2
        ? `Choose ${2 - picksUsed} more advancement${2 - picksUsed === 1 ? '' : 's'}.`
        : 'That is more than two advancements.',
    );
  }

  if (plan.newCardRef === null) {
    warnings.push('Step four: take a new domain card at your level or lower.');
  }

  errors.push(...exchangeErrors(c, plan, context));

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * The one rule step four's second sentence carries, enforced rather than said.
 *
 * *"You can also exchange one domain card you've previously acquired for a
 * different domain card of the same level or lower."* Folio 53. Four clauses,
 * and each is a refusal because each is a rule of construction rather than a
 * ruling a table makes:
 *
 *   "previously acquired"  -> the card given up is checked against the sheet as
 *                             it was BEFORE this level. A card taken at step
 *                             four of the same level-up is not previously
 *                             acquired, and `applyLevelUp` banks the new one
 *                             after this check has read the old sheet.
 *   "a different"          -> the two refs cannot be equal, and the card taken
 *                             cannot be one already owned or one already
 *                             spoken for elsewhere in this plan - the vault is
 *                             a list, and pushing a ref twice is how a
 *                             character comes to own two copies of a card.
 *   "of the same level or  -> the levels are compared. This is the clause the
 *    lower"                   lane exists for, and it is why an index is asked
 *                             for rather than a number carried on the plan.
 *   (unstated)             -> the card taken has to be one this character could
 *                             have taken at step four anyway: a domain they
 *                             have access to. The sentence does not repeat the
 *                             first half's "from one of your class's domains",
 *                             and reading its silence as permission would let a
 *                             wizard exchange into Valor. It is the second
 *                             sentence of one step, not a second step, so the
 *                             first sentence's domain clause still applies -
 *                             and the level cap does not, because this sentence
 *                             replaces it with its own.
 *
 * A card either side of the exchange that this build cannot name is a refusal
 * and not a shrug: without both levels there is no comparison to make, and
 * "cannot check" must not read the same as "is fine".
 */
function exchangeErrors(
  c: Character,
  plan: LevelUpPlan,
  context?: PlanContext,
): string[] {
  const swap = plan.exchange;
  if (swap === null) return [];
  const errors: string[] = [];

  const owned = new Set<Ref>([...c.loadout, ...c.vault]);
  if (!owned.has(swap.fromRef)) {
    errors.push(`You can only exchange a domain card you have already acquired, and ${swap.fromRef} is not one of yours.`);
  }
  if (swap.toRef === swap.fromRef) {
    errors.push('An exchange takes a different card than the one it gives up.');
  } else if (owned.has(swap.toRef)) {
    errors.push(`${swap.toRef} is already in your loadout or vault.`);
  } else if (
    swap.toRef === plan.newCardRef ||
    plan.picks.some(
      (p) => p.detail['cardRef'] === swap.toRef || p.detail['grantCardRef'] === swap.toRef,
    )
  ) {
    errors.push(`${swap.toRef} is already being taken elsewhere in this level.`);
  }

  if (context === undefined) {
    errors.push('This build cannot check the level of an exchanged card, so the exchange is refused.');
    return errors;
  }
  const from = context.cards.get(swap.fromRef);
  const to = context.cards.get(swap.toRef);
  for (const [ref, card] of [
    [swap.fromRef, from],
    [swap.toRef, to],
  ] as const) {
    if (card === undefined) errors.push(`This build cannot name ${ref}, so it cannot check its level.`);
  }
  if (from === undefined || to === undefined) return errors;

  if (!context.domains.includes(to.domain)) {
    errors.push(`${swap.toRef} is not in a domain you have access to.`);
  }
  if (to.level > from.level) {
    errors.push(
      `${to.name} is level ${to.level}, and an exchange takes a card of the same level or lower - ${from.name} is level ${from.level}.`,
    );
  }
  return errors;
}

/** Apply a validated plan. Callers should refuse to call this when !ok. */
export function applyLevelUp(c: Character, plan: LevelUpPlan): Character {
  let next: Character = { ...c, level: plan.toLevel };
  const history: LevelUpChoice[] = [...c.levelUpHistory];

  // The level grants the achievement, so it is read from the level and not from
  // the plan - `validatePlan` rejects a plan that disagrees, and a caller that
  // skipped validation must not be able to clear the trait marks by asking.
  const achievement = tierAchievementFor(plan.toLevel);
  if (achievement?.clearTraitMarks === true) next = { ...next, traitMarks: {} };

  plan.picks.forEach((pick, i) => {
    const option = availableOptions(plan.tier).find(
      (o) => o.id === pick.optionId && o.tier === pick.optionTier,
    );
    if (!option) return;

    history.push({
      level: plan.toLevel,
      slot: i,
      kind: option.kind,
      detail: { ...pick.detail, optionId: option.id, optionTier: option.tier },
    });

    /*
     * A subclass card can arrive holding a domain card.
     *
     * School of Knowledge's Accomplished and Brilliant each read "Take an
     * additional domain card of your level or lower from a domain you have
     * access to", and the advancement that hands over the specialization or
     * mastery card is what triggers them; multiclassing into that subclass
     * triggers Prepared the same way. Which subclasses do that is a dataset
     * question and this module has no dataset, so `src/ui/build/cardAllowance.ts`
     * decides whether a card is owed and the plan carries the ref.
     *
     * It is banked here, in the same pass that writes the history entry
     * carrying it, so the record and the vault cannot disagree. Doing it in the
     * screen instead would have written a history saying the card was taken and
     * left `applyLevelUp`'s other two callers - the simulator and the sample
     * builder - producing sheets that say so and do not hold it.
     */
    const granted = pick.detail['grantCardRef'];
    if (typeof granted === 'string' && granted !== '') {
      next = { ...next, vault: [...next.vault, granted] };
    }

    switch (option.kind) {
      case 'trait': {
        const traits = (pick.detail['traits'] as Trait[] | undefined) ?? [];
        const marks = { ...next.traitMarks };
        const values = { ...next.traits };
        for (const t of traits) {
          values[t] = values[t] + 1;
          marks[t] = (marks[t] ?? 0) + 1;
        }
        next = { ...next, traits: values, traitMarks: marks };
        break;
      }
      case 'hitPoint':
        next = { ...next, hp: { ...next.hp, max: Math.min(MAX_HP, next.hp.max + 1) } };
        break;
      case 'stress':
        next = { ...next, stress: { ...next.stress, max: Math.min(MAX_STRESS, next.stress.max + 1) } };
        break;
      case 'experience': {
        const ids = (pick.detail['experiences'] as string[] | undefined) ?? [];
        next = {
          ...next,
          experiences: next.experiences.map((e) =>
            ids.includes(e.id) ? { ...e, bonus: e.bonus + 1 } : e,
          ),
        };
        break;
      }
      case 'domainCard': {
        const ref = pick.detail['cardRef'] as string | undefined;
        if (ref) next = { ...next, vault: [...next.vault, ref] };
        break;
      }
      case 'subclass': {
        const ref = pick.detail['subclassRef'] as string | undefined;
        if (ref && !next.subclassRefs.includes(ref)) {
          next = { ...next, subclassRefs: [...next.subclassRefs, ref] };
        }
        break;
      }
      case 'multiclass': {
        next = {
          ...next,
          multiclassRef: (pick.detail['classRef'] as string | undefined) ?? null,
          multiclassDomain: (pick.detail['domain'] as Character['multiclassDomain']) ?? null,
          subclassRefs: [
            ...next.subclassRefs,
            ...(pick.detail['subclassRef'] ? [pick.detail['subclassRef'] as string] : []),
          ],
        };
        break;
      }
      case 'evasion':
      case 'proficiency':
        // Both are read back out of levelUpHistory by deriveStats.
        break;
    }
  });

  if (achievement) {
    const name = (plan.picks[0]?.detail['achievementExperience'] as string | undefined) ?? '';
    next = {
      ...next,
      experiences: [
        ...next.experiences,
        { id: crypto.randomUUID(), name, bonus: 2 },
      ],
    };
    /*
     * *"Whenever you gain a new Experience, your companion also gains one. All
     * new Experiences start at +2."* Folio 18.
     *
     * Applied rather than offered, because the sentence offers nothing: it is
     * the same shape as the Stress a transformation costs. What the player
     * chooses is the words, and those are theirs - it arrives unnamed and is
     * named on the companion sheet, the way an achievement Experience with no
     * name typed arrives unnamed here.
     *
     * The `experience` advancement above raises two Experiences the character
     * already has, which is not what the sentence is about - so it correctly
     * gives the companion nothing.
     *
     * IT IS NOT THE ONLY PLACE A CHARACTER GAINS A NEW ONE, and this comment
     * used to say it was. `ExperienceEditor` has an "Add an Experience" button
     * (`src/ui/build/parts.tsx`), reachable from Build and from the wizard, and
     * folio 18's *"whenever"* covers that route too. Nothing there hands the
     * companion anything, so a hand-added Experience quietly leaves the animal
     * one behind. That is a real gap in the rule and not a decision; it is
     * written down here because the false sentence was hiding it.
     */
    if (next.companion !== null) {
      next = {
        ...next,
        companion: {
          ...next.companion,
          experiences: [
            ...next.companion.experiences,
            { id: crypto.randomUUID(), name: '', bonus: COMPANION_START.experienceBonus },
          ],
        },
      };
    }
  }

  if (plan.newCardRef) next = { ...next, vault: [...next.vault, plan.newCardRef] };

  /*
   * The exchange, last, and IN PLACE.
   *
   * Last because `validatePlan` reads "previously acquired" off the sheet as it
   * was, so applying it before the level's own grants would be checking one
   * sheet and changing another.
   *
   * In place - loadout for loadout, vault for vault - rather than always into
   * the vault the way `newCardRef` goes. Two reasons, and the first is the
   * rules': `MAX_LOADOUT` is five, and a swap that took a card OUT of the
   * loadout and put its replacement in the vault would leave a player one card
   * down for a step the book describes as an exchange. The count is invariant
   * this way, so no overflow is possible and none has to be handled. The second
   * is that it is what the word means.
   *
   * `filter` on both lists rather than on the one it was found in: a ref in
   * both is not a state this app writes, and removing it from only one would
   * leave a sheet still owning the card it just gave up.
   */
  const swap = plan.exchange;
  if (swap !== null) {
    const inLoadout = next.loadout.includes(swap.fromRef);
    next = {
      ...next,
      loadout: next.loadout.flatMap((r) => (r === swap.fromRef ? [swap.toRef] : [r])),
      vault: inLoadout
        ? next.vault.filter((r) => r !== swap.fromRef)
        : next.vault.flatMap((r) => (r === swap.fromRef ? [swap.toRef] : [r])),
    };
    history.push({
      level: plan.toLevel,
      slot: 0,
      kind: 'cardExchange',
      detail: { optionId: CARD_EXCHANGE_OPTION, fromRef: swap.fromRef, toRef: swap.toRef },
    });
  }

  return { ...next, levelUpHistory: history, updatedAt: new Date().toISOString() };
}

export const levelsInTier = (tier: Tier): number[] => TIER_LEVELS[tier];
export const tierFor = tierOf;
