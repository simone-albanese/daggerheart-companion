import { describe, expect, it } from 'vitest';
import type { Character, Tier } from '@shared/types.ts';
import { deriveStats, tierOf } from '@engine/character.ts';
import {
  applyLevelUp,
  availableOptions,
  optionsForTier,
  slotUsage,
  tierAchievementFor,
  validatePlan,
  type LevelUpPlan,
} from '@engine/levelUp.ts';
import { advancement, makeCharacter, makeDataset, traits } from '../fixtures/factories.ts';

const ds = makeDataset();

const pick = (
  optionId: string,
  optionTier: Tier,
  detail: Record<string, unknown> = {},
): LevelUpPlan['picks'][number] => ({ optionId, optionTier, detail });

const plan = (toLevel: number, picks: LevelUpPlan['picks'], p: Partial<LevelUpPlan> = {}): LevelUpPlan => ({
  fromLevel: toLevel - 1,
  toLevel,
  tier: tierOf(toLevel),
  achievement: tierAchievementFor(toLevel),
  picks,
  newCardRef: 'blade-test-card',
  ...p,
});

const at = (level: number, p: Partial<Character> = {}): Character =>
  makeCharacter({ level: level - 1, ...p });

const errorsOf = (c: Character, pl: LevelUpPlan): string => validatePlan(c, pl).errors.join(' | ');

/** Proficiency floor at a level, without going through the character. */
const baseAt = (level: number): number => 1 + [2, 5, 8].filter((l) => level >= l).length;

describe('advancement options', () => {
  it('offers nothing at tier 1 - the first level-up happens on the way to 2', () => {
    expect(optionsForTier(1)).toEqual([]);
  });

  it('offers the six base options at tier 2, none of them boxed', () => {
    const o = optionsForTier(2);
    expect(o.map((x) => x.id).sort()).toEqual([
      'domain-card',
      'evasion',
      'experience',
      'hit-point',
      'stress',
      'traits',
    ]);
    expect(o.every((x) => !x.costsBothPicks)).toBe(true);
  });

  it('adds subclass, Proficiency and Multiclass from tier 3', () => {
    const ids = optionsForTier(3).map((o) => o.id);
    expect(ids).toContain('subclass');
    expect(ids).toContain('proficiency');
    expect(ids).toContain('multiclass');
    expect(optionsForTier(4).map((o) => o.id)).toEqual(ids);
  });

  it('boxes Proficiency and Multiclass so each costs both picks', () => {
    const boxed = optionsForTier(3).filter((o) => o.costsBothPicks).map((o) => o.id);
    expect(boxed.sort()).toEqual(['multiclass', 'proficiency']);
  });

  it('keeps a separate slot pool per tier', () => {
    const pools = availableOptions(4).filter((o) => o.id === 'experience').map((o) => o.tier);
    expect(pools).toEqual([2, 3, 4]);
    expect(availableOptions(2)).toHaveLength(6);
    expect(availableOptions(3)).toHaveLength(15);
    expect(availableOptions(4)).toHaveLength(24);
  });
});

describe('tier achievements', () => {
  it('lands at levels 2, 5 and 8 and nowhere else', () => {
    for (const level of [2, 5, 8]) expect(tierAchievementFor(level)).not.toBeNull();
    for (const level of [1, 3, 4, 6, 7, 9, 10]) expect(tierAchievementFor(level)).toBeNull();
  });

  it('grants an Experience and a Proficiency at every one of them', () => {
    for (const level of [2, 5, 8]) {
      const a = tierAchievementFor(level)!;
      expect(a.newExperience).toBe(true);
      expect(a.proficiency).toBe(1);
    }
  });

  it('clears trait marks at 5 and 8 but not at 2', () => {
    expect(tierAchievementFor(2)!.clearTraitMarks).toBe(false);
    expect(tierAchievementFor(5)!.clearTraitMarks).toBe(true);
    expect(tierAchievementFor(8)!.clearTraitMarks).toBe(true);
  });
});

describe('validatePlan: exactly two picks', () => {
  const c = at(3);

  it('accepts two ordinary advancements', () => {
    const v = validatePlan(c, plan(3, [pick('evasion', 2), pick('experience', 2)]));
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });

  it('rejects none', () => {
    expect(errorsOf(c, plan(3, []))).toMatch(/Choose 2 more/);
  });

  it('rejects one', () => {
    expect(errorsOf(c, plan(3, [pick('evasion', 2)]))).toMatch(/Choose 1 more advancement\./);
  });

  it('rejects three', () => {
    const v = validatePlan(
      c,
      plan(3, [pick('evasion', 2), pick('experience', 2), pick('domain-card', 2)]),
    );
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/more than two/);
  });

  it('rejects an option that does not exist', () => {
    expect(errorsOf(c, plan(3, [pick('sorcery', 2), pick('evasion', 2)]))).toMatch(/not available/);
  });
});

describe('validatePlan: boxed options consume both picks', () => {
  it('accepts Proficiency on its own', () => {
    const v = validatePlan(at(6), plan(6, [pick('proficiency', 3)]));
    expect(v.ok).toBe(true);
  });

  it('rejects Proficiency alongside anything else', () => {
    const v = validatePlan(at(6), plan(6, [pick('proficiency', 3), pick('evasion', 3)]));
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/more than two/);
  });

  it('accepts Multiclass on its own', () => {
    const v = validatePlan(
      at(5),
      plan(5, [
        pick('multiclass', 3, {
          classRef: 'other-class',
          domain: 'grace',
          subclassRef: 'other-subclass',
        }),
      ]),
    );
    expect(v.ok).toBe(true);
  });

  it('rejects Multiclass alongside anything else', () => {
    const v = validatePlan(
      at(5),
      plan(5, [
        pick('multiclass', 3, { classRef: 'x', domain: 'grace', subclassRef: 'y' }),
        pick('evasion', 3),
      ]),
    );
    expect(v.ok).toBe(false);
  });
});

describe('validatePlan: slots run out per option, per tier', () => {
  it('refuses an option whose tier slots are all marked', () => {
    // Experience has a single slot per tier.
    const c = at(4, { levelUpHistory: [advancement('experience', 'experience', 2, 3)] });
    expect(errorsOf(c, plan(4, [pick('experience', 2), pick('evasion', 2)]))).toMatch(
      /no unmarked slots left at tier 2/,
    );
  });

  it('refuses the same one-slot option taken twice in a single level-up', () => {
    expect(errorsOf(at(4), plan(4, [pick('evasion', 2), pick('evasion', 2)]))).toMatch(
      /no unmarked slots left/,
    );
  });

  it('allows a two-slot option twice in a single level-up', () => {
    expect(validatePlan(at(4), plan(4, [pick('hit-point', 2), pick('hit-point', 2)])).ok).toBe(true);
  });

  it('counts the tiers separately, so the same option opens again', () => {
    const c = at(6, { levelUpHistory: [advancement('experience', 'experience', 2, 3)] });
    expect(validatePlan(c, plan(6, [pick('experience', 3), pick('evasion', 3)])).ok).toBe(true);
  });

  it('lets the character spend a lower tier\'s leftover slots', () => {
    expect(validatePlan(at(6), plan(6, [pick('evasion', 2), pick('experience', 2)])).ok).toBe(true);
  });

  it('exhausts the three trait slots of a tier', () => {
    const history = [1, 2, 3].map((i) => advancement('trait', 'traits', 2, i + 1));
    const c = at(5, { levelUpHistory: history });
    expect(
      errorsOf(
        c,
        plan(5, [pick('traits', 2, { traits: ['agility', 'strength'] }), pick('evasion', 2)]),
      ),
    ).toMatch(/no unmarked slots left/);
  });
});

describe('validatePlan: traits', () => {
  it('wants exactly two, and two different ones', () => {
    expect(errorsOf(at(3), plan(3, [pick('traits', 2, { traits: ['agility'] }), pick('evasion', 2)]))).toMatch(
      /exactly two traits/,
    );
    expect(
      errorsOf(at(3), plan(3, [pick('traits', 2, { traits: ['agility', 'agility'] }), pick('evasion', 2)])),
    ).toMatch(/two different traits/);
  });

  it('rejects a trait already marked this tier', () => {
    const c = at(4, { traitMarks: { agility: 1 } });
    expect(
      errorsOf(c, plan(4, [pick('traits', 2, { traits: ['agility', 'strength'] }), pick('evasion', 2)])),
    ).toMatch(/agility is already marked/);
  });

  it('rejects marking the same trait twice inside one level-up', () => {
    const v = validatePlan(
      at(4),
      plan(4, [
        pick('traits', 2, { traits: ['agility', 'strength'] }),
        pick('traits', 2, { traits: ['strength', 'finesse'] }),
      ]),
    );
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/strength is already marked/);
  });

  it('accepts two disjoint trait picks inside one level-up', () => {
    expect(
      validatePlan(
        at(4),
        plan(4, [
          pick('traits', 2, { traits: ['agility', 'strength'] }),
          pick('traits', 2, { traits: ['finesse', 'instinct'] }),
        ]),
      ).ok,
    ).toBe(true);
  });

  it('accepts a trait marked in the last tier when this level clears the marks', () => {
    // Level 5 is a tier achievement: it clears every mark before the
    // advancements are chosen, so agility is free again.
    const c = at(5, { traitMarks: { agility: 1, strength: 1 } });
    const v = validatePlan(
      c,
      plan(5, [pick('traits', 3, { traits: ['agility', 'strength'] }), pick('evasion', 3)]),
    );
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('still rejects it at a level with no achievement', () => {
    const c = at(6, { traitMarks: { agility: 1 } });
    expect(
      errorsOf(c, plan(6, [pick('traits', 3, { traits: ['agility', 'strength'] }), pick('evasion', 3)])),
    ).toMatch(/agility is already marked/);
  });
});

describe('validatePlan: multiclass', () => {
  const details = { classRef: 'other-class', domain: 'grace', subclassRef: 'other-subclass' };

  it('is refused before level 5', () => {
    for (const level of [2, 3, 4]) {
      const v = validatePlan(at(level), plan(level, [pick('multiclass', 3, details)]));
      expect(v.ok).toBe(false);
      expect(v.errors.join(' ')).toMatch(/multiclass/i);
    }
  });

  it('is refused a second time', () => {
    const c = at(8, { multiclassRef: 'other-class', multiclassDomain: 'grace' });
    expect(errorsOf(c, plan(8, [pick('multiclass', 4, details)]))).toMatch(/already multiclassed/);
  });

  it('wants the class, the domain and the foundation card', () => {
    const errs = errorsOf(at(5), plan(5, [pick('multiclass', 3, {})]));
    expect(errs).toMatch(/Choose the class/);
    expect(errs).toMatch(/Choose which of its domains/);
    expect(errs).toMatch(/Choose a foundation card/);
  });
});

describe('validatePlan: the shape of the level-up itself', () => {
  it('moves exactly one level', () => {
    expect(errorsOf(at(3), plan(3, [pick('evasion', 2), pick('experience', 2)], { fromLevel: 1 }))).toMatch(
      /exactly one level/,
    );
  });

  it('stops at level 10', () => {
    const c = makeCharacter({ level: 10 });
    expect(errorsOf(c, plan(11, [pick('evasion', 4), pick('experience', 4)]))).toMatch(/maximum/);
  });

  it('refuses a plan whose tier is not the tier of the new level', () => {
    // Otherwise a caller could hand itself tier 3 options at level 4.
    const bad = plan(4, [pick('proficiency', 3)], { tier: 3 });
    const v = validatePlan(at(4), bad);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/tier/i);
  });

  it('warns rather than errors when a track is already at its maximum', () => {
    const c = at(4, { hp: { marked: 0, max: 12 }, stress: { marked: 0, max: 12 } });
    const v = validatePlan(c, plan(4, [pick('hit-point', 2), pick('stress', 2)]));
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/Hit Points are already at the maximum/);
    expect(v.warnings.join(' ')).toMatch(/Stress is already at the maximum/);
  });

  it('warns about the domain card of step four', () => {
    const v = validatePlan(at(3), plan(3, [pick('evasion', 2), pick('experience', 2)], { newCardRef: null }));
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/Step four/);
  });
});

describe('applyLevelUp', () => {
  it('raises the level and takes the step four card', () => {
    const next = applyLevelUp(at(3), plan(3, [pick('evasion', 2), pick('experience', 2)]));
    expect(next.level).toBe(3);
    expect(next.vault).toContain('blade-test-card');
  });

  it('adds +1 to each chosen trait and marks it', () => {
    const c = at(3, { traits: traits({ agility: 1 }) });
    const next = applyLevelUp(
      c,
      plan(3, [pick('traits', 2, { traits: ['agility', 'finesse'] }), pick('evasion', 2)]),
    );
    expect(next.traits.agility).toBe(2);
    expect(next.traits.finesse).toBe(1);
    expect(next.traitMarks).toEqual({ agility: 1, finesse: 1 });
    expect(next.traits.strength).toBe(0);
  });

  it('grows the Hit Point and Stress tracks, capped at 12', () => {
    const next = applyLevelUp(at(3), plan(3, [pick('hit-point', 2), pick('stress', 2)]));
    expect(next.hp.max).toBe(7);
    expect(next.stress.max).toBe(7);

    const full = at(4, { hp: { marked: 0, max: 12 }, stress: { marked: 0, max: 12 } });
    const capped = applyLevelUp(full, plan(4, [pick('hit-point', 2), pick('stress', 2)]));
    expect(capped.hp.max).toBe(12);
    expect(capped.stress.max).toBe(12);
  });

  it('agrees with deriveStats about the new maxima', () => {
    // The track is written here and recomputed there from the same history:
    // the two must not drift, or a sync would silently undo the advancement.
    const next = applyLevelUp(at(3), plan(3, [pick('hit-point', 2), pick('stress', 2)]));
    const derived = deriveStats(next, ds);
    expect(derived.maxHp).toBe(next.hp.max);
    expect(derived.maxStress).toBe(next.stress.max);
  });

  it('raises only the Experiences the pick named', () => {
    const c = at(3, {
      experiences: [
        { id: 'e1', name: 'Sailor', bonus: 2 },
        { id: 'e2', name: 'Brawler', bonus: 2 },
      ],
    });
    const next = applyLevelUp(
      c,
      plan(3, [pick('experience', 2, { experiences: ['e1'] }), pick('evasion', 2)]),
    );
    expect(next.experiences.find((e) => e.id === 'e1')?.bonus).toBe(3);
    expect(next.experiences.find((e) => e.id === 'e2')?.bonus).toBe(2);
  });

  it('puts an extra domain card in the vault', () => {
    const next = applyLevelUp(
      at(3),
      plan(3, [pick('domain-card', 2, { cardRef: 'valor-extra' }), pick('evasion', 2)]),
    );
    expect(next.vault).toContain('valor-extra');
    expect(next.vault).toContain('blade-test-card');
  });

  it('records Evasion and Proficiency in the history for deriveStats to read', () => {
    const before = at(6);
    const next = applyLevelUp(before, plan(6, [pick('proficiency', 3)]));
    expect(deriveStats(next, ds).proficiency).toBe(baseAt(6) + 1);
    const evaded = applyLevelUp(at(3), plan(3, [pick('evasion', 2), pick('experience', 2)]));
    expect(deriveStats(evaded, ds).evasion).toBe(deriveStats(at(3), ds).evasion + 1);
  });

  it('takes the upgraded subclass card without duplicating it', () => {
    const c = at(6, { subclassRefs: ['test-subclass'] });
    const next = applyLevelUp(
      c,
      plan(6, [pick('subclass', 3, { subclassRef: 'test-subclass' }), pick('evasion', 3)]),
    );
    expect(next.subclassRefs).toEqual(['test-subclass']);
  });

  it('records the multiclass, its domain and its foundation subclass', () => {
    const next = applyLevelUp(
      at(5),
      plan(5, [
        pick('multiclass', 3, {
          classRef: 'other-class',
          domain: 'grace',
          subclassRef: 'other-subclass',
        }),
      ]),
    );
    expect(next.multiclassRef).toBe('other-class');
    expect(next.multiclassDomain).toBe('grace');
    expect(next.subclassRefs).toContain('other-subclass');
  });

  it('grants the tier achievement Experience at +2', () => {
    const next = applyLevelUp(at(2), plan(2, [pick('evasion', 2), pick('experience', 2)]));
    expect(next.experiences).toHaveLength(1);
    expect(next.experiences[0]!.bonus).toBe(2);
  });

  it('grants no Experience at a level without an achievement', () => {
    const next = applyLevelUp(at(3), plan(3, [pick('evasion', 2), pick('experience', 2)]));
    expect(next.experiences).toHaveLength(0);
  });

  it('clears trait marks at 5 and 8, keeps them at 2', () => {
    const marked = { agility: 1 } as const;
    const two = applyLevelUp(at(2, { traitMarks: marked }), plan(2, [pick('evasion', 2), pick('experience', 2)]));
    expect(two.traitMarks).toEqual({ agility: 1 });

    const five = applyLevelUp(at(5, { traitMarks: marked }), plan(5, [pick('evasion', 3), pick('experience', 3)]));
    expect(five.traitMarks).toEqual({});

    const eight = applyLevelUp(at(8, { traitMarks: marked }), plan(8, [pick('evasion', 4), pick('experience', 4)]));
    expect(eight.traitMarks).toEqual({});
  });

  it('clears the marks before the new picks are marked', () => {
    const c = at(5, { traitMarks: { agility: 1 } });
    const next = applyLevelUp(
      c,
      plan(5, [pick('traits', 3, { traits: ['agility', 'strength'] }), pick('evasion', 3)]),
    );
    expect(next.traitMarks).toEqual({ agility: 1, strength: 1 });
    expect(next.traits.agility).toBe(1);
  });

  it('leaves the character it was given untouched', () => {
    const c = at(3);
    applyLevelUp(c, plan(3, [pick('hit-point', 2), pick('evasion', 2)]));
    expect(c.level).toBe(2);
    expect(c.hp.max).toBe(6);
    expect(c.levelUpHistory).toEqual([]);
  });
});

describe('applyLevelUp round-trips through slotUsage', () => {
  it('marks exactly the slots that were spent', () => {
    const next = applyLevelUp(at(3), plan(3, [pick('evasion', 2), pick('hit-point', 2)]));
    const usage = new Map(slotUsage(next).map((u) => [`${u.optionId}@${u.tier}`, u]));
    expect(usage.get('evasion@2')).toMatchObject({ used: 1, slots: 1, remaining: 0 });
    expect(usage.get('hit-point@2')).toMatchObject({ used: 1, slots: 2, remaining: 1 });
    expect(usage.get('evasion@3')).toMatchObject({ used: 0, remaining: 1 });
    expect(usage.get('experience@2')).toMatchObject({ used: 0, remaining: 1 });
  });

  it('makes the same plan invalid the second time round', () => {
    const first = plan(3, [pick('evasion', 2), pick('experience', 2)]);
    const next = applyLevelUp(at(3), first);
    const second = plan(4, [pick('evasion', 2), pick('experience', 2)]);
    const v = validatePlan(next, second);
    expect(v.ok).toBe(false);
    expect(v.errors.filter((e) => /no unmarked slots/.test(e))).toHaveLength(2);
  });

  it('writes the option id and tier every history entry needs', () => {
    const next = applyLevelUp(at(6), plan(6, [pick('proficiency', 3)]));
    expect(next.levelUpHistory).toHaveLength(1);
    expect(next.levelUpHistory[0]).toMatchObject({
      level: 6,
      slot: 0,
      kind: 'proficiency',
      detail: { optionId: 'proficiency', optionTier: 3 },
    });
  });

  it('accumulates history across levels', () => {
    let c = at(3);
    c = applyLevelUp(c, plan(3, [pick('evasion', 2), pick('experience', 2)]));
    c = applyLevelUp(c, plan(4, [pick('hit-point', 2), pick('stress', 2)]));
    expect(c.level).toBe(4);
    expect(c.levelUpHistory).toHaveLength(4);
    expect(slotUsage(c).filter((u) => u.used > 0).map((u) => u.optionId).sort()).toEqual([
      'evasion',
      'experience',
      'hit-point',
      'stress',
    ]);
  });
});

describe('validatePlan: the plan is tied to the character it levels', () => {
  it("refuses a plan that does not start at the character's level", () => {
    // Nothing else ties the plan's levels to the sheet: without this a stale
    // plan walks a level 2 character to level 9 and applyLevelUp writes it down.
    const c = makeCharacter({ level: 2 });
    const v = validatePlan(c, plan(9, [pick('evasion', 4), pick('experience', 4)]));
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/starts at level 8, but the character is level 2/);
  });

  it('accepts the same plan for the character it was built for', () => {
    expect(validatePlan(at(9), plan(9, [pick('evasion', 4), pick('experience', 4)])).ok).toBe(true);
  });

  it('refuses a forged achievement that would clear the trait marks early', () => {
    // Level 3 grants no achievement. Claiming one would free a trait marked at
    // level 2 and let the same trait be raised twice inside one tier.
    const c = at(3, { traitMarks: { agility: 1 } });
    const forged = plan(
      3,
      [pick('traits', 2, { traits: ['agility', 'strength'] }), pick('evasion', 2)],
      { achievement: tierAchievementFor(5) },
    );
    const v = validatePlan(c, forged);
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/Level 3 has no tier achievement/);
    expect(v.errors.join(' ')).toMatch(/agility is already marked/);
  });

  it('refuses a plan that drops the achievement its level does grant', () => {
    const v = validatePlan(
      at(5),
      plan(5, [pick('evasion', 3), pick('experience', 3)], { achievement: null }),
    );
    expect(v.ok).toBe(false);
    expect(v.errors.join(' ')).toMatch(/tier achievement is missing/);
  });

  it('clears the marks off the level, not off the plan', () => {
    // applyLevelUp must reach the same verdict validatePlan did, or an
    // unvalidated caller could clear the marks just by asking.
    const c = at(3, { traitMarks: { agility: 1 } });
    const forged = plan(3, [pick('evasion', 2), pick('experience', 2)], {
      achievement: tierAchievementFor(5),
    });
    expect(applyLevelUp(c, forged).traitMarks).toEqual({ agility: 1 });
  });
});

describe('validatePlan: the upgraded subclass and multiclass cross each other out', () => {
  const details = { classRef: 'other-class', domain: 'grace', subclassRef: 'other-subclass' };

  it('refuses multiclass in a tier that already took the upgraded subclass', () => {
    const c = at(6, { levelUpHistory: [advancement('subclass', 'subclass', 3, 5)] });
    expect(errorsOf(c, plan(6, [pick('multiclass', 3, details)]))).toMatch(
      /upgraded subclass advancement at tier 3 crossed out that tier's multiclass option/,
    );
  });

  it('refuses the upgraded subclass in a tier that already multiclassed', () => {
    const c = at(6, {
      multiclassRef: 'other-class',
      multiclassDomain: 'grace',
      levelUpHistory: [advancement('multiclass', 'multiclass', 3, 5)],
    });
    expect(
      errorsOf(c, plan(6, [pick('subclass', 3, { subclassRef: 's2' }), pick('evasion', 3)])),
    ).toMatch(/multiclass advancement at tier 3 crossed out that tier's upgraded subclass option/);
  });

  it('leaves each of them alone when the other was never taken', () => {
    expect(validatePlan(at(6), plan(6, [pick('multiclass', 3, details)])).ok).toBe(true);
    expect(
      validatePlan(at(6), plan(6, [pick('subclass', 3, { subclassRef: 's2' }), pick('evasion', 3)]))
        .ok,
    ).toBe(true);
  });

  it('offers both again in the next tier, which has its own slots', () => {
    const c = at(9, { levelUpHistory: [advancement('subclass', 'subclass', 3, 5)] });
    expect(
      validatePlan(c, plan(9, [pick('subclass', 4, { subclassRef: 's3' }), pick('evasion', 4)])).ok,
    ).toBe(true);
  });
});
