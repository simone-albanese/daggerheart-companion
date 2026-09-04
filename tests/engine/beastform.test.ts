import { describe, expect, it } from 'vitest';
import { deriveStats, indexDataset, rollModifier } from '@engine/character.ts';
import {
  BEASTFORM_STRESS_COST,
  EVOLUTION_HOPE_COST,
  beastformCost,
  beastformDamage,
  beastformExtraStress,
  beastformOptions,
  dropFormOnLastHitPoint,
  enterBeastform,
  evolutionFeature,
  hasBeastform,
  leaveBeastform,
} from '@engine/beastform.ts';
import type { Beastform, Character, Dataset } from '@shared/types.ts';
import { feature, makeCharacter, makeClass, makeDataset, traits } from '../fixtures/factories.ts';

const form = (p: Partial<Beastform> = {}): Beastform => ({
  id: 'nimble-grazer',
  name: 'Nimble Grazer',
  tier: 1,
  category: 'Nimble Grazer',
  examples: ['Deer'],
  traitBonus: { agility: 1 },
  evasionBonus: 3,
  attack: { name: 'Nimble Grazer', range: 'Melee', damage: 'd6', trait: 'agility' },
  advantageOn: ['sprint'],
  features: [feature('Elusive Prey')],
  ...p,
});

const EVOLUTION = {
  name: 'Evolution',
  text: 'Spend 3 Hope to transform into a Beastform without marking a Stress.',
};

const DRUID = makeClass({
  id: 'druid',
  name: 'Druid',
  startingEvasion: 10,
  hopeFeature: EVOLUTION,
  classFeatures: [feature('Beastform'), feature('Wildtouch')],
});

const ds: Dataset = makeDataset({
  classes: [DRUID, makeClass({ id: 'plain-class', classFeatures: [feature('Something Else')] })],
  beastforms: [
    form(),
    form({ id: 'powerful-beast', name: 'Powerful Beast', tier: 2, traitBonus: { strength: 3 } }),
    form({ id: 'great-predator', name: 'Great Predator', tier: 3 }),
    /*
     * SRD 2 p18, verbatim from the dataset's own feature text. The two Hybrid
     * forms are the only Beastforms whose entry prices the transformation
     * itself: "mark an additional Stress" and "mark 2 additional Stress".
     */
    form({
      id: 'legendary-hybrid',
      name: 'Legendary Hybrid',
      tier: 3,
      features: [
        {
          name: 'Hybrid Features',
          text: 'To transform into this creature, mark an additional Stress. Choose any two Beastform options from Tiers 1-2.',
        },
      ],
    }),
    form({
      id: 'mythic-hybrid',
      name: 'Mythic Hybrid',
      tier: 4,
      features: [
        {
          name: 'Hybrid Features',
          text: 'To transform into this creature, mark 2 additional Stress. Choose any three Beastform options from Tiers 1-3.',
        },
      ],
    }),
  ],
});

const ix = indexDataset(ds);
const druid = (p: Partial<Character> = {}): Character =>
  makeCharacter({ classRef: 'druid', traits: traits({ agility: 2 }), ...p });
const stats = (c: Character) => deriveStats(c, ds, ix);

describe('beastformOptions', () => {
  it.each([
    [1, ['nimble-grazer']],
    [4, ['nimble-grazer', 'powerful-beast']],
    [7, ['nimble-grazer', 'powerful-beast', 'great-predator', 'legendary-hybrid']],
    [10, ['nimble-grazer', 'powerful-beast', 'great-predator', 'legendary-hybrid', 'mythic-hybrid']],
  ])('offers a level-%i Druid their tier and below', (level, expected) => {
    expect(beastformOptions(level, ds).map((b) => b.id)).toEqual(expected);
  });
});

describe('hasBeastform', () => {
  it('reads the class feature rather than a hardcoded class ref', () => {
    expect(hasBeastform(druid(), ix)).toBe(true);
    expect(hasBeastform(makeCharacter({ classRef: 'plain-class' }), ix)).toBe(false);
  });

  it('finds it through a multiclass too', () => {
    const c = makeCharacter({ classRef: 'plain-class', multiclassRef: 'druid' });
    expect(hasBeastform(c, ix)).toBe(true);
  });
});

describe('evolutionFeature', () => {
  it('is the Hope Feature of the character’s own class', () => {
    expect(evolutionFeature(druid(), ix)?.name).toBe('Evolution');
  });

  it('is null for a class whose Hope Feature says nothing about Beastform', () => {
    expect(evolutionFeature(makeCharacter({ classRef: 'plain-class' }), ix)).toBeNull();
  });

  // Multiclassing "acquires its class feature" and nothing else, so the second
  // class brings Beastform along but never its Hope Feature's price.
  it('is null for a multiclass into the Druid, which grants Beastform but not Evolution', () => {
    const c = makeCharacter({ classRef: 'plain-class', multiclassRef: 'druid' });
    expect(hasBeastform(c, ix)).toBe(true);
    expect(evolutionFeature(c, ix)).toBeNull();
  });
});

describe('the override', () => {
  const worn = druid({ beastform: { ref: 'nimble-grazer', activatedAt: 'now' } });

  it('adds the form Evasion bonus and keeps the base for the readout', () => {
    expect(stats(druid()).evasion).toBe(10);
    expect(stats(worn).evasion).toBe(13);
    expect(stats(worn).beastform?.baseEvasion).toBe(10);
  });

  it('adds the form trait bonus without touching the character', () => {
    expect(stats(worn).traits.agility).toBe(3);
    expect(worn.traits.agility).toBe(2);
    expect(stats(worn).beastform?.raised).toEqual([{ trait: 'agility', from: 2, to: 3 }]);
  });

  it('leaves every other trait alone', () => {
    expect(stats(worn).traits.strength).toBe(0);
    expect(stats(worn).traits).not.toBe(worn.traits);
  });

  it('rolls the trait the form gives you', () => {
    expect(rollModifier(worn, stats(worn), 'agility').value).toBe(3);
    expect(rollModifier(druid(), stats(druid()), 'agility').value).toBe(2);
  });

  it('stacks on top of a manual Evasion override', () => {
    const c = druid({ beastform: { ref: 'nimble-grazer', activatedAt: 'now' }, evasionOverride: 5 });
    expect(stats(c).evasion).toBe(8);
  });

  it('is nothing at all when the ref does not resolve', () => {
    const c = druid({ beastform: { ref: 'no-such-form', activatedAt: 'now' } });
    expect(stats(c).beastform).toBeNull();
    expect(stats(c).evasion).toBe(10);
  });

  it('does not touch the damage thresholds, which no form declares', () => {
    expect(stats(worn).thresholds).toEqual(stats(druid()).thresholds);
  });
});

describe('entering and leaving', () => {
  it('marks one Stress by default', () => {
    const out = enterBeastform(druid(), 'nimble-grazer', 'stress', ix);
    expect(out.stressMarked).toBe(BEASTFORM_STRESS_COST);
    expect(out.character.stress.marked).toBe(1);
    expect(out.character.beastform?.ref).toBe('nimble-grazer');
    expect(out.hopeSpent).toBe(0);
    expect(out.refused).toBe(false);
  });

  /*
   * SRD 2 p50: "A character can't use a move that requires them to mark Stress
   * if all of their Stress is marked." Beastform is such a move by its own
   * sentence ("Mark a Stress to magically transform"), so at a full track the
   * Stress path is refused outright rather than paid in a Hit Point. This used
   * to enter the form and mark a Hit Point; at 5/6 HP that was the last one,
   * and `dropFormOnLastHitPoint` threw the form away in the same tap.
   */
  it('refuses the Stress path when every Stress is marked, and marks nothing (p50)', () => {
    const c = druid({ stress: { marked: 6, max: 6 }, hp: { marked: 5, max: 6 } });
    const cost = beastformCost(c, 'nimble-grazer', 'stress', ix);
    expect(cost.allowed).toBe(false);
    expect(cost.hpCost).toBe(0);
    const out = enterBeastform(c, 'nimble-grazer', 'stress', ix);
    expect(out.refused).toBe(true);
    expect(out.stressMarked).toBe(0);
    expect(out.hpMarked).toBe(0);
    expect(out.character).toBe(c);
  });

  it('still allows Evolution at a full Stress track, which costs no Stress', () => {
    const c = druid({ stress: { marked: 6, max: 6 }, hope: { marked: 3, max: 6 } });
    expect(beastformCost(c, 'nimble-grazer', 'evolution', ix).allowed).toBe(true);
    const out = enterBeastform(c, 'nimble-grazer', 'evolution', ix);
    expect(out.refused).toBe(false);
    expect(out.character.beastform?.ref).toBe('nimble-grazer');
  });

  it('spends three Hope for Evolution and marks no Stress', () => {
    const c = druid({ hope: { marked: 5, max: 6 } });
    const out = enterBeastform(c, 'nimble-grazer', 'evolution', ix);
    expect(out.hopeSpent).toBe(EVOLUTION_HOPE_COST);
    expect(out.character.hope.marked).toBe(2);
    expect(out.character.stress.marked).toBe(0);
  });

  it('never spends Hope it does not have', () => {
    const c = druid({ hope: { marked: 1, max: 6 } });
    const out = enterBeastform(c, 'nimble-grazer', 'evolution', ix);
    expect(out.hopeSpent).toBe(1);
    expect(out.character.hope.marked).toBe(0);
  });

  it('is lossless: dropping out restores every number', () => {
    const before = druid({ traits: traits({ agility: 2, strength: 1 }) });
    const after = leaveBeastform(enterBeastform(before, 'nimble-grazer', 'evolution', ix).character);
    expect(after.traits).toEqual(before.traits);
    expect(after.beastform).toBeNull();
    expect(stats(after).evasion).toBe(stats(before).evasion);
    expect(stats(after).traits).toEqual(stats(before).traits);
  });
});

/**
 * SRD 2 p18. Legendary Hybrid: "To transform into this creature, mark an
 * additional Stress." Mythic Hybrid: "mark 2 additional Stress." On top of the
 * Druid feature's own Stress (p14), that is 2 and 3. The app charged a flat 1
 * for every form and the picker said MARK 1 STRESS beside the sentence that
 * contradicted it.
 */
describe('the Hybrid surcharge', () => {
  it('reads the surcharge off the two Hybrid sentences and nothing else', () => {
    expect(beastformExtraStress(ix.beastforms.get('nimble-grazer'))).toBe(0);
    expect(beastformExtraStress(ix.beastforms.get('legendary-hybrid'))).toBe(1);
    expect(beastformExtraStress(ix.beastforms.get('mythic-hybrid'))).toBe(2);
    expect(beastformExtraStress(undefined)).toBe(0);
  });

  it('does not read a Stress the form charges for something OTHER than transforming', () => {
    // Tier 4's Devastating Strikes: "you can mark a Stress to force them to
    // mark an additional Hit Point" - a Stress spent in play, not on entry.
    const form = ix.beastforms.get('nimble-grazer')!;
    const striker = {
      ...form,
      features: [
        {
          name: 'Devastating Strikes',
          text: 'When you deal Severe damage to a target within Melee range, you can mark a Stress to force them to mark an additional Hit Point.',
        },
      ],
    };
    expect(beastformExtraStress(striker)).toBe(0);
  });

  it('charges 2 Stress for a Legendary Hybrid and 3 for a Mythic Hybrid (p18)', () => {
    const legendary = enterBeastform(druid(), 'legendary-hybrid', 'stress', ix);
    expect(legendary.stressMarked).toBe(2);
    expect(legendary.hpMarked).toBe(0);
    const mythic = enterBeastform(druid(), 'mythic-hybrid', 'stress', ix);
    expect(mythic.stressMarked).toBe(3);
    expect(beastformCost(druid(), 'mythic-hybrid', 'stress', ix).stressCost).toBe(3);
  });

  it('keeps the surcharge on the Evolution path, which waives only the base Stress', () => {
    // "Spend 3 Hope to transform into a Beastform without marking a Stress" is
    // the Druid feature's Stress; the Hybrid's "additional Stress" is the
    // creature's own price.
    const c = druid({ hope: { marked: 6, max: 6 } });
    const out = enterBeastform(c, 'mythic-hybrid', 'evolution', ix);
    expect(out.hopeSpent).toBe(EVOLUTION_HOPE_COST);
    expect(out.stressMarked).toBe(2);
    expect(beastformCost(c, 'mythic-hybrid', 'evolution', ix).stressCost).toBe(2);
  });

  it('marks what fits and ONE Hit Point for the rest when some Stress is free (p50)', () => {
    // 5/6 Stress, a cost of 3: one Stress and one Hit Point - the move is
    // usable because a Stress can still be marked, and the unpayable
    // remainder is one HP whatever its size.
    const c = druid({ stress: { marked: 5, max: 6 }, hp: { marked: 0, max: 6 } });
    const cost = beastformCost(c, 'mythic-hybrid', 'stress', ix);
    expect(cost.allowed).toBe(true);
    expect(cost.affordable).toBe(false);
    expect(cost.hpCost).toBe(1);
    const out = enterBeastform(c, 'mythic-hybrid', 'stress', ix);
    expect(out.stressMarked).toBe(1);
    expect(out.hpMarked).toBe(1);
  });

  it('refuses a Hybrid on the Evolution path too when every Stress is marked', () => {
    const c = druid({ stress: { marked: 6, max: 6 }, hope: { marked: 6, max: 6 } });
    expect(beastformCost(c, 'legendary-hybrid', 'evolution', ix).allowed).toBe(false);
    expect(enterBeastform(c, 'legendary-hybrid', 'evolution', ix).refused).toBe(true);
  });
});

/**
 * *"When you make an attack while transformed, you use the creature's listed
 * range, trait, and damage dice, but you use your Proficiency."* Folio 12,
 * which the dataset now carries as `beastform-options`.
 *
 * The rule is the same shape as a weapon's and a companion's, so the arithmetic
 * is the same two calls; what is pinned here is that it IS the same, because
 * the alternative - a `d12+10` rolled flat - looks entirely plausible on a
 * screen and is wrong by three dice at tier 4.
 */
describe('beastformDamage', () => {
  it.each([
    [1, '1d6'],
    [2, '2d6'],
    [3, '3d6'],
    [4, '4d6'],
  ])('rolls Proficiency %i dice of the form’s die', (proficiency, spec) => {
    expect(beastformDamage(form(), proficiency)?.spec).toBe(spec);
  });

  it('multiplies the dice and not the flat bonus', () => {
    // The tier-4 shape: `d12+10` at Proficiency 4 is 4d12+10, never 4d12+40.
    const terrible = form({ attack: { name: 'x', range: 'Melee', damage: 'd12+10', trait: 'strength' } });
    expect(beastformDamage(terrible, 4)).toMatchObject({
      spec: '4d12+10',
      count: 4,
      sides: 12,
      modifier: 10,
    });
  });

  it('never rolls no dice, whatever Proficiency says', () => {
    expect(beastformDamage(form(), 0)?.count).toBe(1);
  });

  it('is null for a damage string that will not parse', () => {
    const broken = form({ attack: { name: 'x', range: 'Melee', damage: 'a bite', trait: 'agility' } });
    expect(beastformDamage(broken, 3)).toBeNull();
  });
});

/**
 * *"If you mark your last Hit Point, you automatically drop out of this form."*
 *
 * The whole of what is asserted here is that it is EDGE-triggered. A level
 * check - "is this character on their last Hit Point?" - passes every test that
 * only ever marks damage, and then quietly forbids a Druid who survived their
 * last Hit Point from ever transforming again, stripping the form on the next
 * write with nothing on screen to explain it.
 */
describe('dropping out on the last Hit Point', () => {
  const worn = { ref: 'nimble-grazer', activatedAt: '2026-08-23T00:00:00.000Z' };
  const at = (marked: number, max = 6): Pick<Character, 'hp'> => ({ hp: { marked, max } });

  it('drops the form when the last Hit Point is newly marked', () => {
    const before = druid({ ...at(4), beastform: worn });
    const after = { ...before, ...at(6) };
    expect(dropFormOnLastHitPoint(before, after).beastform).toBeNull();
  });

  it('drops it when a Stress that overflowed did the marking', () => {
    // The route that makes this reachable in one tap: a Hybrid costs 2 Stress
    // (p18), one Stress is free, and the remainder is a Hit Point (p50). A
    // full track no longer gets here - the move is refused (p50).
    const before = druid({ ...at(5), stress: { marked: 5, max: 6 }, beastform: null });
    const entered = enterBeastform(before, 'legendary-hybrid', 'stress', ix);
    expect(entered.stressMarked).toBe(1);
    expect(entered.hpMarked).toBe(1);
    expect(dropFormOnLastHitPoint(before, entered.character).beastform).toBeNull();
  });

  it('leaves a form alone when the character was ALREADY on their last one', () => {
    // Not a hypothetical: a death move can be walked away from, and an ally can
    // clear a Hit Point back. The sentence is about marking, and nothing was
    // marked here.
    const before = druid({ ...at(6), beastform: worn });
    const after = { ...before, stress: { marked: 1, max: 6 } };
    expect(dropFormOnLastHitPoint(before, after).beastform).toEqual(worn);
  });

  it('lets a character on their last Hit Point transform', () => {
    const before = druid({ ...at(6), beastform: null });
    const after = enterBeastform(before, 'nimble-grazer', 'evolution', ix).character;
    expect(dropFormOnLastHitPoint(before, after).beastform).not.toBeNull();
  });

  it('does nothing at all to a character wearing no form', () => {
    const before = druid({ ...at(4), beastform: null });
    const after = { ...before, ...at(6) };
    expect(dropFormOnLastHitPoint(before, after)).toBe(after);
  });

  it('does nothing when Hit Points are cleared rather than marked', () => {
    const before = druid({ ...at(6), beastform: worn });
    const after = { ...before, ...at(2) };
    expect(dropFormOnLastHitPoint(before, after).beastform).toEqual(worn);
  });
});

/**
 * The edge is the mark, and not the gap closing.
 *
 * `syncCounters` writes `hp.max` from the derived maximum and clamps `marked`
 * to it, so a maximum that falls onto a mark already there makes the track full
 * without anybody having marked anything. The first version of this rule asked
 * whether the track had *become* full and fired on exactly that.
 */
describe('a maximum that drops is not a Hit Point being marked', () => {
  const worn = { ref: 'nimble-grazer', activatedAt: '2026-08-23T00:00:00.000Z' };

  it('keeps the form when hp.max falls onto the marks, marking nothing', () => {
    const before = druid({ hp: { marked: 5, max: 8 }, beastform: worn });
    // What `syncCounters` would write if the derived maximum became 5.
    const after = { ...before, hp: { marked: 5, max: 5 } };
    expect(dropFormOnLastHitPoint(before, after).beastform).toEqual(worn);
  });

  it('still drops it when a mark is what filled the track', () => {
    const before = druid({ hp: { marked: 4, max: 5 }, beastform: worn });
    const after = { ...before, hp: { marked: 5, max: 5 } };
    expect(dropFormOnLastHitPoint(before, after).beastform).toBeNull();
  });
});
