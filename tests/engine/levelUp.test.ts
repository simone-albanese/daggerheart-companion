/**
 * Levelling up is the one moment a Daggerheart sheet changes shape, and it
 * happens perhaps nine times in a campaign. There is no undo: the player picks
 * two advancements, the sheet is rewritten, and the session moves on.
 *
 * So this file proves two different things. validatePlan is the gate - it must
 * refuse a plan that spends a slot twice, multiclasses at level 4 or clears a
 * tier's trait marks a level early, because applyLevelUp trusts it completely
 * and will happily write level 11. And applyLevelUp is the record - it must
 * write down not only how many advancements were taken, which every derived
 * number can be recomputed from, but WHICH ones they were, which nothing can.
 */
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
import { newCompanion } from '@engine/companion.ts';

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

  it('grants the tier achievement Experience at +2, under the name the player typed', () => {
    // The bonus is the rule; the name is the player's. Levels 2, 5 and 8 are
    // the only three times a campaign asks "what did you learn getting here?",
    // and the answer is typed into the level-up screen and read off pick zero.
    // An Experience that arrives blank three times over is the whole feature
    // silently missing, with the +2 still there to make it look like it worked.
    const next = applyLevelUp(
      at(2),
      plan(2, [
        pick('evasion', 2, { achievementExperience: 'Walked out of Bloodstone alive' }),
        pick('experience', 2),
      ]),
    );
    expect(next.experiences).toHaveLength(1);
    expect(next.experiences[0]!.name).toBe('Walked out of Bloodstone alive');
    expect(next.experiences[0]!.bonus).toBe(2);

    // Same at the other two achievement levels, so this is the rule and not
    // an accident of level 2.
    for (const level of [5, 8] as const) {
      const tier = tierOf(level);
      const grown = applyLevelUp(
        at(level),
        plan(level, [
          pick('evasion', tier, { achievementExperience: `Learned at ${level}` }),
          pick('experience', tier),
        ]),
      );
      expect(grown.experiences.map((e) => [e.name, e.bonus])).toEqual([
        [`Learned at ${level}`, 2],
      ]);
    }
  });

  it('reads that name off the first pick only, and grants the Experience regardless', () => {
    // Documented and deliberate: applyLevelUp looks at plan.picks[0] alone.
    // A screen that attaches the name to the second pick gets an Experience
    // with an empty name rather than no Experience - pinned here so the day
    // someone widens the search, the change is a decision and not a surprise.
    const misfiled = applyLevelUp(
      at(2),
      plan(2, [pick('evasion', 2), pick('experience', 2, { achievementExperience: 'Too late' })]),
    );
    expect(misfiled.experiences).toHaveLength(1);
    expect(misfiled.experiences[0]!.name).toBe('');
    expect(misfiled.experiences[0]!.bonus).toBe(2);
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

  it('stamps the sheet as changed, so a restore cannot quietly undo the level', () => {
    // updatedAt is not decoration. src/store/db.ts sorts the library by it, and
    // src/store/merge.ts::decideImport keeps the LOCAL copy on merge whenever
    // local.updatedAt >= incoming.updatedAt. A level-up that never moves the clock is a
    // level-up the next restore is entitled to throw away - the player levels
    // to 6, syncs their backup, and comes back a level 5 character with the
    // advancement screen offering the same two picks again.
    const before = at(3, {
      createdAt: '2019-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    });
    const next = applyLevelUp(before, plan(3, [pick('evasion', 2), pick('experience', 2)]));

    expect(Number.isNaN(Date.parse(next.updatedAt))).toBe(false);
    expect(Date.parse(next.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
    // The sheet was changed, not re-made: its birthday stays where it was.
    expect(next.createdAt).toBe('2019-01-01T00:00:00.000Z');
    expect(before.updatedAt).toBe('2020-01-01T00:00:00.000Z');
  });
});

/**
 * `levelUpHistory` is the only place the app remembers WHICH advancement a
 * player took, as opposed to how many. deriveStats counts entries by `kind`
 * and slotUsage keys off `detail.optionId` + `detail.optionTier`, so every
 * other key in a record can be dropped without one derived number moving:
 * the sheet still reads level 6 with the right Evasion, and the level-up
 * journal simply stops saying which two traits went up or which card was
 * taken. These tests read the record itself, not what it happens to derive.
 */
describe('the level-up record keeps what the player actually chose', () => {
  it('writes the whole pick detail, not only the two keys slotUsage reads', () => {
    const next = applyLevelUp(
      at(3),
      plan(3, [
        pick('domain-card', 2, { cardRef: 'valor-extra' }),
        pick('traits', 2, { traits: ['agility', 'finesse'] }),
      ]),
    );

    expect(next.levelUpHistory).toHaveLength(2);
    expect(next.levelUpHistory[0]!.detail).toEqual({
      cardRef: 'valor-extra',
      optionId: 'domain-card',
      optionTier: 2,
    });
    expect(next.levelUpHistory[1]!.detail).toEqual({
      traits: ['agility', 'finesse'],
      optionId: 'traits',
      optionTier: 2,
    });
  });

  it('names the class, domain and foundation card a multiclass was spent on', () => {
    // Without this the sheet says "you multiclassed at 5" and cannot say into
    // what - and the transfer codec, which reads detail.classRef and
    // detail.subclassRef to put refs on the wire, sends a sheet that has
    // forgotten half of its own second class.
    const next = applyLevelUp(
      at(5),
      plan(5, [
        pick('multiclass', 3, {
          classRef: 'other-class',
          domain: 'grace',
          subclassRef: 'other-subclass',
          achievementExperience: 'Studied under a rival',
        }),
      ]),
    );

    expect(next.levelUpHistory).toHaveLength(1);
    expect(next.levelUpHistory[0]!.detail).toEqual({
      classRef: 'other-class',
      domain: 'grace',
      subclassRef: 'other-subclass',
      achievementExperience: 'Studied under a rival',
      optionId: 'multiclass',
      optionTier: 3,
    });
  });

  it('carries a note the engine itself has no use for', () => {
    // The detail is a Record<string, unknown> on purpose: a GM's ruling, or a
    // future screen's field, rides along in it. If applyLevelUp only copied
    // the keys it knows, anything a later version adds would vanish at the
    // moment it was written.
    const next = applyLevelUp(
      at(3),
      plan(3, [pick('evasion', 2, { gmNote: 'earned in the Hush' }), pick('experience', 2)]),
    );
    expect(next.levelUpHistory[0]!.detail['gmNote']).toBe('earned in the Hush');
  });

  it('numbers the two advancements of a level 0 and 1, which is what the wire packs', () => {
    // src/transfer/codec.ts branches on (choice.slot === 0 || choice.slot === 1)
    // and packs slot & 1 into a header bit. Pin both slots to 0 and that branch
    // stops being exercised by anything, while the level-up journal loses the
    // order the two picks were made in.
    const next = applyLevelUp(at(3), plan(3, [pick('evasion', 2), pick('hit-point', 2)]));

    expect(next.levelUpHistory.map((h) => h.slot)).toEqual([0, 1]);
    expect(next.levelUpHistory.map((h) => h.kind)).toEqual(['evasion', 'hitPoint']);
    expect(next.levelUpHistory.map((h) => h.level)).toEqual([3, 3]);
  });

  it('keeps slot 0 and slot 1 straight across two levels', () => {
    let c = at(3);
    c = applyLevelUp(c, plan(3, [pick('evasion', 2), pick('experience', 2)]));
    c = applyLevelUp(c, plan(4, [pick('hit-point', 2), pick('stress', 2)]));
    expect(c.levelUpHistory.map((h) => `${h.level}.${h.slot}`)).toEqual([
      '3.0',
      '3.1',
      '4.0',
      '4.1',
    ]);
  });

  it('gives a boxed advancement the one slot it occupies', () => {
    const next = applyLevelUp(at(6), plan(6, [pick('proficiency', 3)]));
    expect(next.levelUpHistory.map((h) => h.slot)).toEqual([0]);
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

describe('validatePlan: a black-boxed option marks both of its boxes', () => {
  /**
   * The rule is explicit: *"you must spend two advancements and mark BOTH
   * level-up slots in order to take it."* Proficiency and Multiclass are the two
   * printed inside a black box, and each prints two boxes joined.
   *
   * Everything counted one box per taking, and `slots` was documented as the
   * number of takings - which is true only of the options whose boxes are
   * separate. So Proficiency validated `ok` at level 5 and again at level 6,
   * `LevelUp.tsx` even rendered "TIER 3 · 1 OF 2 LEFT" in between, and a level 10
   * character reached Proficiency 8 where the sheet allows 6. That is a `d8+2`
   * weapon rolling `8d8+2` instead of `6d8+2` - two extra damage dice on the roll
   * a player makes most, with nothing on screen saying anything was wrong.
   */
  const proficiencyAt = (level: number, tier: Tier): Character =>
    at(level, { levelUpHistory: [advancement('proficiency', 'proficiency', tier, level - 1)] });

  it('fills the tier in one taking', () => {
    const c = proficiencyAt(6, 3);
    const usage = slotUsage(c).find((u) => u.optionId === 'proficiency' && u.tier === 3)!;
    expect(usage.used, 'one taking marked one box, so the other is still on offer').toBe(2);
    expect(usage.remaining).toBe(0);
  });

  it('refuses a second Proficiency in the same tier', () => {
    expect(errorsOf(proficiencyAt(6, 3), plan(6, [pick('proficiency', 3)]))).toMatch(
      /has no unmarked slots left at tier 3/,
    );
  });

  it('refuses a second Multiclass in the same tier', () => {
    const c = at(7, { levelUpHistory: [advancement('multiclass', 'multiclass', 3, 6)] });
    expect(errorsOf(c, plan(7, [pick('multiclass', 3, { classRef: 'c2', subclassRef: 's2', domain: 'blade' })]))).toMatch(
      /has no unmarked slots left at tier 3/,
    );
  });

  it('offers it again in the next tier, which prints its own pair of boxes', () => {
    const c = at(9, { levelUpHistory: [advancement('proficiency', 'proficiency', 3, 5)] });
    expect(validatePlan(c, plan(9, [pick('proficiency', 4)])).ok).toBe(true);
  });

  /**
   * The control. A change that made every option single-take would satisfy every
   * assertion above, so an unboxed option with two boxes has to still take two.
   */
  it('leaves the options whose boxes are separate taking one box each', () => {
    const c = at(4, { levelUpHistory: [advancement('hitPoint', 'hit-point', 2, 3)] });
    const usage = slotUsage(c).find((u) => u.optionId === 'hit-point' && u.tier === 2)!;
    expect(usage.used).toBe(1);
    expect(usage.remaining).toBe(1);
    expect(validatePlan(c, plan(4, [pick('hit-point', 2), pick('evasion', 2)])).ok).toBe(true);
  });

  /**
   * And the number the player actually reads. Two legal takings, one per tier,
   * and the weapon rolls two more dice than it did - not four.
   */
  it('is worth exactly one damage die per tier', () => {
    const c = at(10, {
      level: 10,
      levelUpHistory: [
        advancement('proficiency', 'proficiency', 3, 5),
        advancement('proficiency', 'proficiency', 4, 8),
      ],
    });
    expect(deriveStats(c, ds).proficiency).toBe(baseAt(10) + 2);
  });
});

/**
 * *"Whenever you gain a new Experience, your companion also gains one. All new
 * Experiences start at +2."* Folio 18.
 *
 * A tier achievement is the only place a character gains a *new* Experience -
 * the `experience` advancement raises two they already have, which is not what
 * the sentence is about - so this is the one moment the rule fires.
 *
 * Applied rather than offered, because the sentence offers nothing. What the
 * player chooses is the words, and those are theirs: it arrives unnamed and is
 * named on the companion sheet, exactly as the character's own does when
 * nothing was typed.
 */
describe('a tier achievement, for the companion too', () => {
  const withCompanion = (level: number) =>
    at(level, { companion: newCompanion('Ashfoot', 'A grey wolf') });

  it('gives the companion an Experience at +2, unnamed', () => {
    const next = applyLevelUp(
      withCompanion(2),
      plan(2, [
        pick('evasion', 2, { achievementExperience: 'Walked out of Bloodstone alive' }),
        pick('experience', 2),
      ]),
    );
    expect(next.companion?.experiences).toHaveLength(3);
    const gained = next.companion!.experiences[2]!;
    expect(gained.name).toBe('');
    expect(gained.bonus).toBe(2);
  });

  it('does it at every achievement level and nowhere else', () => {
    for (const level of [2, 5, 8] as const) {
      const grown = applyLevelUp(
        withCompanion(level),
        plan(level, [
          pick('evasion', tierOf(level), { achievementExperience: `Learned at ${level}` }),
          pick('experience', tierOf(level)),
        ]),
      );
      expect(grown.companion?.experiences, `level ${level}`).toHaveLength(3);
    }

    // Level 3 is not an achievement level: nobody gains a new Experience, so
    // neither does the animal.
    const quiet = applyLevelUp(
      withCompanion(3),
      plan(3, [pick('evasion', 2), pick('experience', 2)]),
    );
    expect(quiet.companion?.experiences).toHaveLength(2);
  });

  it('leaves a character with no companion exactly as it found them', () => {
    const next = applyLevelUp(
      at(2),
      plan(2, [pick('evasion', 2, { achievementExperience: 'x' }), pick('experience', 2)]),
    );
    expect(next.companion).toBeNull();
  });

  it('gives them one each time, rather than one ever', () => {
    let c = withCompanion(2);
    c = applyLevelUp(c, plan(2, [pick('evasion', 2, { achievementExperience: 'a' }), pick('experience', 2)]));
    c = { ...c, level: 4 };
    c = applyLevelUp(c, plan(5, [pick('evasion', 3, { achievementExperience: 'b' }), pick('experience', 3)]));
    expect(c.companion?.experiences).toHaveLength(4);
  });
});
