import { describe, expect, it } from 'vitest';
import { deriveStats, indexDataset } from '@engine/character.ts';
import {
  COMPANION_START,
  clearCompanionStress,
  companionDamage,
  companionIsAway,
  companionUpgradeAllowance,
  hasCompanionFeature,
  newCompanion,
  withCompanion,
} from '@engine/companion.ts';
import type { Character, Dataset } from '@shared/types.ts';
import { feature, makeCharacter, makeDataset, makeSubclass } from '../fixtures/factories.ts';

const BEASTBOUND = makeSubclass({
  id: 'beastbound',
  name: 'Beastbound',
  foundationFeatures: [feature('Companion')],
});
const WAYFINDER = makeSubclass({
  id: 'wayfinder',
  name: 'Wayfinder',
  foundationFeatures: [feature('Ruthless Predator')],
});

const ds: Dataset = makeDataset({ subclasses: [BEASTBOUND, WAYFINDER] });
const ix = indexDataset(ds);

describe('hasCompanionFeature', () => {
  it('is true for the subclass that grants the sheet', () => {
    expect(hasCompanionFeature(makeCharacter({ subclassRefs: ['beastbound'] }), ix)).toBe(true);
  });

  it('is false for a subclass that does not', () => {
    expect(hasCompanionFeature(makeCharacter({ subclassRefs: ['wayfinder'] }), ix)).toBe(false);
    expect(hasCompanionFeature(makeCharacter({ subclassRefs: [] }), ix)).toBe(false);
  });

  it('survives a subclass ref this device cannot resolve', () => {
    expect(hasCompanionFeature(makeCharacter({ subclassRefs: ['gone'] }), ix)).toBe(false);
  });
});

describe('newCompanion', () => {
  it('starts from the sheet: Evasion 10, a d6 in Melee, two Experiences at +2', () => {
    const c = newCompanion('Ashfoot', 'A one-eyed hawk');
    expect(c.evasion).toBe(COMPANION_START.evasion);
    expect(c.damage).toBe('d6');
    expect(c.range).toBe('Melee');
    expect(c.stress).toEqual({ marked: 0, max: COMPANION_START.stressSlots });
    expect(c.experiences).toHaveLength(2);
    expect(c.experiences.every((e) => e.bonus === 2)).toBe(true);
    expect(c.upgrades).toEqual([]);
  });

  it('gives every Experience its own id', () => {
    const c = newCompanion('A', '');
    expect(new Set(c.experiences.map((e) => e.id)).size).toBe(c.experiences.length);
  });
});

describe('companionDamage', () => {
  const c = newCompanion('Ashfoot', '');

  it.each([
    [1, '1d6'],
    [2, '2d6'],
    [3, '3d6'],
    [4, '4d6'],
  ])('rolls Proficiency %i dice of the companion die', (proficiency, spec) => {
    expect(companionDamage(c, proficiency)?.spec).toBe(spec);
  });

  it('steps up with the die the Vicious upgrade gave them', () => {
    expect(companionDamage({ ...c, damage: 'd8' }, 3)?.spec).toBe('3d8');
  });

  it('keeps a flat modifier out of the multiplication', () => {
    expect(companionDamage({ ...c, damage: 'd6+2' }, 3)).toMatchObject({
      spec: '3d6+2',
      count: 3,
      modifier: 2,
    });
  });

  it('returns null rather than guessing at a die it cannot read', () => {
    expect(companionDamage({ ...c, damage: 'whatever' }, 2)).toBeNull();
  });

  it('reads the character Proficiency, which is where the rule points', () => {
    const character = makeCharacter({ level: 5 });
    expect(companionDamage(c, deriveStats(character, ds, ix).proficiency)?.spec).toBe('3d6');
  });
});

describe('withCompanion', () => {
  it('patches the companion and nothing else', () => {
    const c = makeCharacter({ name: 'Vex', companion: newCompanion('Ashfoot', '') });
    const next = withCompanion(c, { evasion: 12 });
    expect(next.companion?.evasion).toBe(12);
    expect(next.companion?.name).toBe('Ashfoot');
    expect(next.name).toBe('Vex');
  });

  it('is a no-op when there is no companion to patch', () => {
    const c = makeCharacter();
    expect(withCompanion(c, { evasion: 12 })).toBe(c);
  });
});

/**
 * The box on folio 18 that no module had a copy of, because `parseRules` did
 * not reach the folio: *"When your companion would take any amount of damage,
 * they mark a Stress. When they mark their last Stress, they drop out of the
 * scene... They remain unavailable until the start of your next long rest,
 * where they return with 1 Stress cleared."*
 */
describe('a companion out of the scene', () => {
  const at = (marked: number, max = 3) => ({
    ...newCompanion('Ashfoot', ''),
    stress: { marked, max },
  });

  it('is away exactly when the last Stress slot is marked', () => {
    expect(companionIsAway(at(2))).toBe(false);
    expect(companionIsAway(at(3))).toBe(true);
  });

  it('is away on a track that arrived over-marked, not just exactly full', () => {
    // A file or a QR can carry one. `>=` and not `===`, so a companion at 4 of
    // 3 is out of the scene rather than quietly still in it.
    expect(companionIsAway(at(4))).toBe(true);
  });

  it('is not away for a companion with no Stress slots at all', () => {
    // Not a sheet `newCompanion` can make, but one a hand-written file can.
    // `0 >= 0` would strand them permanently out of a scene they never entered.
    expect(companionIsAway(at(0, 0))).toBe(false);
  });
});

describe('clearCompanionStress', () => {
  const withCompanionAt = (marked: number, max = 3): Character =>
    makeCharacter({ companion: { ...newCompanion('Ashfoot', ''), stress: { marked, max } } });

  it('clears the number asked for', () => {
    const out = clearCompanionStress(withCompanionAt(3), 2);
    expect(out.cleared).toBe(2);
    expect(out.character.companion?.stress.marked).toBe(1);
  });

  it('never clears more than they have marked', () => {
    const out = clearCompanionStress(withCompanionAt(1), 5);
    expect(out.cleared).toBe(1);
    expect(out.character.companion?.stress.marked).toBe(0);
  });

  it('does nothing, and reports nothing, with no companion', () => {
    const c = makeCharacter();
    const out = clearCompanionStress(c, 3);
    expect(out).toEqual({ character: c, cleared: 0 });
  });

  it('does nothing at zero, so no line is written claiming it did', () => {
    const c = withCompanionAt(2);
    expect(clearCompanionStress(c, 0)).toEqual({ character: c, cleared: 0 });
  });

  it('does nothing for a companion with nothing marked', () => {
    const c = withCompanionAt(0);
    expect(clearCompanionStress(c, 3)).toEqual({ character: c, cleared: 0 });
  });
});

/**
 * How many of the eight boxes are owed.
 *
 * One per level-up - *"when your character levels up, choose one available
 * option for your companion"* - plus the Beastbound's two training features.
 * The formula was written down in a docblock long before anything computed it;
 * what is new here is that it is read out of the features' own words rather
 * than out of a table keyed on `beastbound`, so the next subclass to grant one
 * is caught by the same regex.
 */
describe('companionUpgradeAllowance', () => {
  const TRAINED = makeSubclass({
    id: 'beastbound',
    name: 'Beastbound',
    foundationFeatures: [feature('Companion')],
    specializationFeatures: [
      { name: 'Expert Training', text: 'Choose an additional level-up option for your companion.' },
    ],
    masteryFeatures: [
      { name: 'Advanced Training', text: 'Choose two additional level-up options for your companion.' },
    ],
  });
  const trainedIx = indexDataset(makeDataset({ subclasses: [TRAINED, WAYFINDER] }));

  const took = (card: 'specialization' | 'mastery') => ({
    level: 5,
    kind: 'subclass' as const,
    slot: 0,
    detail: { subclassRef: 'beastbound', card },
  });

  it.each([
    [1, 0],
    [2, 1],
    [5, 4],
    [10, 9],
  ])('gives one per level-up: level %i earns %i', (level, expected) => {
    expect(companionUpgradeAllowance(makeCharacter({ level }), ix)).toBe(expected);
  });

  it('adds one for Expert Training, once it has been taken', () => {
    const before = makeCharacter({ level: 5, subclassRefs: ['beastbound'] });
    expect(companionUpgradeAllowance(before, trainedIx)).toBe(4);

    const after = { ...before, levelUpHistory: [took('specialization')] };
    expect(companionUpgradeAllowance(after, trainedIx)).toBe(5);
  });

  it('adds two for Advanced Training, reading the number out of the sentence', () => {
    const c = makeCharacter({
      level: 8,
      subclassRefs: ['beastbound'],
      levelUpHistory: [took('specialization'), took('mastery')],
    });
    // 7 level-ups + 1 + 2.
    expect(companionUpgradeAllowance(c, trainedIx)).toBe(10);
  });

  it('does not credit training a Ranger has not taken yet', () => {
    // The trap a naive scan falls into: the feature is on the subclass whether
    // or not the character has advanced into it.
    const c = makeCharacter({ level: 8, subclassRefs: ['beastbound'] });
    expect(companionUpgradeAllowance(c, trainedIx)).toBe(7);
  });

  it('gives a subclass with no such feature nothing extra', () => {
    const c = makeCharacter({ level: 5, subclassRefs: ['wayfinder'] });
    expect(companionUpgradeAllowance(c, trainedIx)).toBe(4);
  });

  it('never goes below zero on a sheet claiming level 0', () => {
    expect(companionUpgradeAllowance(makeCharacter({ level: 0 }), ix)).toBe(0);
  });
});
