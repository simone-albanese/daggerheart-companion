import { describe, expect, it } from 'vitest';
import { deriveStats, indexDataset } from '@engine/character.ts';
import {
  COMPANION_START,
  COMPANION_UPGRADES,
  companionDamage,
  hasCompanionFeature,
  newCompanion,
  withCompanion,
} from '@engine/companion.ts';
import type { Dataset } from '@shared/types.ts';
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

describe('the level-up options', () => {
  it('are the eight from the sheet, each with a distinct slug', () => {
    expect(COMPANION_UPGRADES).toHaveLength(8);
    expect(new Set(COMPANION_UPGRADES.map((u) => u.id)).size).toBe(8);
    expect(COMPANION_UPGRADES.every((u) => u.text.length > 0)).toBe(true);
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
