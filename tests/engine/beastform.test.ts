import { describe, expect, it } from 'vitest';
import { deriveStats, indexDataset, rollModifier } from '@engine/character.ts';
import {
  BEASTFORM_STRESS_COST,
  EVOLUTION_HOPE_COST,
  beastformDamage,
  beastformOptions,
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
    form({ id: 'mythic-hybrid', name: 'Mythic Hybrid', tier: 4 }),
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
    [7, ['nimble-grazer', 'powerful-beast', 'great-predator']],
    [10, ['nimble-grazer', 'powerful-beast', 'great-predator', 'mythic-hybrid']],
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
    const out = enterBeastform(druid(), 'nimble-grazer', 'stress');
    expect(out.stressMarked).toBe(BEASTFORM_STRESS_COST);
    expect(out.character.stress.marked).toBe(1);
    expect(out.character.beastform?.ref).toBe('nimble-grazer');
    expect(out.hopeSpent).toBe(0);
  });

  it('spends Hit Points when Stress is already full', () => {
    const c = druid({ stress: { marked: 6, max: 6 } });
    const out = enterBeastform(c, 'nimble-grazer', 'stress');
    expect(out.stressMarked).toBe(0);
    expect(out.hpMarked).toBe(1);
  });

  it('spends three Hope for Evolution and marks no Stress', () => {
    const c = druid({ hope: { marked: 5, max: 6 } });
    const out = enterBeastform(c, 'nimble-grazer', 'evolution');
    expect(out.hopeSpent).toBe(EVOLUTION_HOPE_COST);
    expect(out.character.hope.marked).toBe(2);
    expect(out.character.stress.marked).toBe(0);
  });

  it('never spends Hope it does not have', () => {
    const c = druid({ hope: { marked: 1, max: 6 } });
    const out = enterBeastform(c, 'nimble-grazer', 'evolution');
    expect(out.hopeSpent).toBe(1);
    expect(out.character.hope.marked).toBe(0);
  });

  it('is lossless: dropping out restores every number', () => {
    const before = druid({ traits: traits({ agility: 2, strength: 1 }) });
    const after = leaveBeastform(enterBeastform(before, 'nimble-grazer', 'evolution').character);
    expect(after.traits).toEqual(before.traits);
    expect(after.beastform).toBeNull();
    expect(stats(after).evasion).toBe(stats(before).evasion);
    expect(stats(after).traits).toEqual(stats(before).traits);
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
