import { describe, expect, it } from 'vitest';
import {
  BASE_HOPE,
  MAX_ARMOR_SCORE,
  MAX_HP,
  MAX_LOADOUT,
  MAX_STRESS,
  baseProficiency,
  deriveStats,
  indexDataset,
  newCharacter,
  rollModifier,
  syncCounters,
  tierOf,
  weaponDamage,
} from '@engine/character.ts';
import type { Character, Dataset } from '@shared/types.ts';
import {
  advancement,
  makeArmor,
  makeCharacter,
  makeClass,
  makeDataset,
  makeSubclass,
  makeWeapon,
  traits,
} from '../fixtures/factories.ts';

const CASTER = makeSubclass({ id: 'caster', name: 'Caster', spellcastTrait: 'presence' });
const MARTIAL = makeSubclass({ id: 'martial', name: 'Martial', spellcastTrait: null });
const PLATE = makeArmor({ id: 'plate', baseThresholds: [7, 15], baseScore: 6 });
const OVERSIZED = makeArmor({ id: 'oversized', baseThresholds: [1, 2], baseScore: 40 });

const ds: Dataset = makeDataset({
  classes: [makeClass({ startingEvasion: 11, startingHitPoints: 5, domains: ['blade', 'valor'] })],
  subclasses: [CASTER, MARTIAL],
  armors: [makeArmor(), PLATE, OVERSIZED],
  weapons: [makeWeapon()],
});

const stats = (c: Partial<Character>) => deriveStats(makeCharacter(c), ds);

describe('tierOf', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 3],
    [8, 4],
    [9, 4],
    [10, 4],
  ])('puts level %i in tier %i', (level, tier) => {
    expect(tierOf(level)).toBe(tier);
  });
});

describe('proficiency', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 3],
    [8, 4],
    [9, 4],
    [10, 4],
  ])('is %2$i at level %1$i', (level, expected) => {
    expect(baseProficiency(level)).toBe(expected);
    expect(stats({ level }).proficiency).toBe(expected);
  });

  it('rises by one per Proficiency advancement on top of the tier floor', () => {
    const history = [
      advancement('proficiency', 'proficiency', 3, 6),
      advancement('proficiency', 'proficiency', 4, 9),
    ];
    expect(stats({ level: 9, levelUpHistory: history }).proficiency).toBe(4 + 2);
  });

  it('does not count other advancements towards Proficiency', () => {
    const history = [advancement('evasion', 'evasion', 2, 3), advancement('stress', 'stress', 2, 4)];
    expect(stats({ level: 4, levelUpHistory: history }).proficiency).toBe(2);
  });
});

describe('damage thresholds', () => {
  it('adds the level to the armor base', () => {
    expect(stats({ level: 3, activeArmor: 'plate' }).thresholds).toEqual([10, 18]);
  });

  it('is level and twice level when unarmored, with no Armor Score', () => {
    for (const level of [1, 4, 7, 10]) {
      const s = stats({ level });
      expect(s.thresholds).toEqual([level, level * 2]);
      expect(s.armorScore).toBe(0);
    }
  });

  it('doubles Severe for the optional Massive Damage rule', () => {
    expect(stats({ level: 2, activeArmor: 'plate' }).massiveThreshold).toBe((15 + 2) * 2);
  });

  it('honours a manual override untouched by level', () => {
    const s = stats({ level: 5, activeArmor: 'plate', thresholdOverride: [3, 4] });
    expect(s.thresholds).toEqual([3, 4]);
    expect(s.massiveThreshold).toBe(8);
  });
});

/**
 * Armor the sheet names and this build cannot resolve.
 *
 * It happens whenever a character crosses builds: a `.dhchar` written where a
 * homebrew layer was installed, a QR from a newer bundle whose registry has
 * grown, a ref parked as `?60007` by the codec. The sheet still says the
 * character is wearing armor. What this build must not do is answer the
 * question it was not asked - "what are the thresholds of someone wearing
 * nothing" - and hand back the answer as though it were theirs.
 */
describe('armor this build cannot resolve', () => {
  const parked = { level: 5, activeArmor: '?60007' } as const;

  it('says so, instead of quietly deriving the unarmored numbers', () => {
    const s = stats(parked);
    expect(s.unresolvedArmor).toBe('?60007');
    // Control: the same level with the slot really empty is the same numbers
    // and no ref, which is exactly the pair that used to be indistinguishable.
    const bare = stats({ level: 5 });
    expect(bare.unresolvedArmor).toBeNull();
    expect(bare.thresholds).toEqual(s.thresholds);
  });

  it('is null for armor the dataset holds, and for an empty slot', () => {
    expect(stats({ activeArmor: 'plate' }).unresolvedArmor).toBeNull();
    expect(stats({ activeArmor: null }).unresolvedArmor).toBeNull();
  });

  it('keeps the Armor Slots the sheet arrived with rather than zeroing them', () => {
    // The score cannot be recomputed - the armor is unknown - so the maximum
    // the sheet carries is the last one a build that could read it wrote.
    const s = stats({ ...parked, armorSlots: { marked: 2, max: 6 } });
    expect(s.armorScore).toBe(6);
    // Control: with nothing equipped there is nothing to preserve, and a
    // stored maximum is not evidence of armor.
    expect(stats({ armorSlots: { marked: 2, max: 6 } }).armorScore).toBe(0);
  });

  it('still clamps a preserved Armor Score at twelve', () => {
    expect(stats({ ...parked, armorSlots: { marked: 0, max: 99 } }).armorScore).toBe(
      MAX_ARMOR_SCORE,
    );
  });

  it('does not let syncCounters empty the Armor track of armor it cannot name', () => {
    // This is where zero used to do its damage: `normalizeActive` runs on every
    // level-up and armor change, and it would have written max 0 over a track
    // the player is marking, taking their marked slots with it.
    const c = makeCharacter({ ...parked, armorSlots: { marked: 3, max: 6 } });
    expect(syncCounters(c, deriveStats(c, ds)).armorSlots).toEqual({ marked: 3, max: 6 });
  });
});

describe('maxima', () => {
  it('clamps Hit Points at 12', () => {
    const history = Array.from({ length: 20 }, () => advancement('hitPoint', 'hit-point', 2));
    expect(stats({ level: 10, levelUpHistory: history }).maxHp).toBe(MAX_HP);
    expect(MAX_HP).toBe(12);
  });

  it('clamps Stress at 12', () => {
    const history = Array.from({ length: 20 }, () => advancement('stress', 'stress', 2));
    expect(stats({ level: 10, levelUpHistory: history }).maxStress).toBe(MAX_STRESS);
    expect(MAX_STRESS).toBe(12);
  });

  it('clamps Armor Score at 12 however heavy the armor', () => {
    expect(stats({ activeArmor: 'oversized' }).armorScore).toBe(MAX_ARMOR_SCORE);
  });

  it('starts Hit Points from the class and grows one per advancement', () => {
    expect(stats({}).maxHp).toBe(5);
    expect(stats({ levelUpHistory: [advancement('hitPoint', 'hit-point', 2)] }).maxHp).toBe(6);
  });

  it('caps the loadout at five cards', () => {
    expect(stats({}).loadoutLimit).toBe(MAX_LOADOUT);
    expect(MAX_LOADOUT).toBe(5);
  });
});

describe('scars', () => {
  it('crosses out one Hope slot each', () => {
    expect(stats({}).maxHope).toBe(BASE_HOPE);
    expect(stats({ scars: ['a'] }).maxHope).toBe(BASE_HOPE - 1);
    expect(stats({ scars: ['a', 'b', 'c'] }).maxHope).toBe(BASE_HOPE - 3);
  });

  it('never goes below zero Hope', () => {
    const many = Array.from({ length: BASE_HOPE + 4 }, (_, i) => `scar ${i}`);
    expect(stats({ scars: many }).maxHope).toBe(0);
  });
});

describe('evasion', () => {
  it('comes from the class and rises with advancements', () => {
    expect(stats({}).evasion).toBe(11);
    expect(stats({ levelUpHistory: [advancement('evasion', 'evasion', 2)] }).evasion).toBe(12);
  });

  it('honours a manual override', () => {
    expect(stats({ evasionOverride: 3 }).evasion).toBe(3);
  });
});

describe('domains and the multiclass card cap', () => {
  it('caps multiclass cards at half the level, rounded up', () => {
    for (const [level, cap] of [
      [1, 1],
      [5, 3],
      [6, 3],
      [7, 4],
      [8, 4],
      [9, 5],
      [10, 5],
    ] as const) {
      const s = stats({ level, multiclassDomain: 'grace', multiclassRef: 'other-class' });
      expect(s.cardLevelCap('grace')).toBe(cap);
      expect(s.cardLevelCap('blade')).toBe(level);
    }
  });

  it('adds the multiclass domain to the class domains without duplicating', () => {
    expect(stats({ multiclassDomain: 'grace' }).domains).toEqual(['blade', 'valor', 'grace']);
    expect(stats({ multiclassDomain: 'blade' }).domains).toEqual(['blade', 'valor']);
  });

  it('caps every domain at the character level without a multiclass', () => {
    const s = stats({ level: 6 });
    expect(s.cardLevelCap('blade')).toBe(6);
    expect(s.cardLevelCap('valor')).toBe(6);
  });
});

describe('spellcast trait', () => {
  it('comes from the subclass that has one', () => {
    const s = stats({ subclassRefs: ['martial', 'caster'] });
    expect(s.spellcastTrait).toBe('presence');
  });

  it('is null when no subclass casts', () => {
    expect(stats({ subclassRefs: ['martial'] }).spellcastTrait).toBeNull();
  });
});

describe('rollModifier', () => {
  const c = makeCharacter({
    subclassRefs: ['caster'],
    traits: traits({ agility: 2, presence: 3 }),
  });

  it('reads a plain trait', () => {
    expect(rollModifier(c, deriveStats(c, ds), 'agility')).toEqual({
      trait: 'agility',
      value: 2,
      label: 'agility',
    });
  });

  it('routes Spellcast through the subclass trait', () => {
    const r = rollModifier(c, deriveStats(c, ds), 'spellcast');
    expect(r.trait).toBe('presence');
    expect(r.value).toBe(3);
    expect(r.label).toBe('Spellcast (presence)');
  });

  it('is worth nothing when the character cannot cast', () => {
    const plain = makeCharacter({ subclassRefs: ['martial'] });
    expect(rollModifier(plain, deriveStats(plain, ds), 'spellcast').value).toBe(0);
  });
});

describe('weaponDamage', () => {
  it('multiplies only the die count by Proficiency', () => {
    const s = stats({ level: 5 }); // Proficiency 3
    expect(weaponDamage(makeWeapon({ damage: 'd8+3' }), s)).toEqual({
      spec: '3d8+3',
      count: 3,
      sides: 8,
      modifier: 3,
    });
  });

  it('keeps a negative modifier and a multi-die weapon', () => {
    const s = stats({ level: 2 }); // Proficiency 2
    expect(weaponDamage(makeWeapon({ damage: '2d6-1' }), s)?.spec).toBe('4d6-1');
  });

  it('reads the same damage strings parseDamage does, spaces included', () => {
    const s = stats({ level: 1 });
    expect(weaponDamage(makeWeapon({ damage: 'd10 + 2' }), s)?.modifier).toBe(2);
  });

  it('returns null rather than guessing at an unreadable damage cell', () => {
    expect(weaponDamage(makeWeapon({ damage: 'special' }), stats({}))).toBeNull();
  });
});

describe('indexDataset', () => {
  it('indexes every kind by ref', () => {
    const ix = indexDataset(ds);
    expect(ix.classes.get('test-class')?.name).toBe('Test Class');
    expect(ix.subclasses.get('caster')?.spellcastTrait).toBe('presence');
    expect(ix.armors.get('plate')?.baseScore).toBe(6);
    expect(ix.weapons.get('test-weapon')).toBeDefined();
    expect(ix.byRef.get('plate')).toBe(ix.armors.get('plate'));
    expect(ix.cards.size).toBe(0);
  });

  it('can be handed to deriveStats instead of being rebuilt', () => {
    const ix = indexDataset(ds);
    const c = makeCharacter({ level: 3, activeArmor: 'plate', multiclassDomain: 'grace' });
    const { cardLevelCap: withIndex, ...a } = deriveStats(c, ds, ix);
    const { cardLevelCap: rebuilt, ...b } = deriveStats(c, ds);
    expect(a).toEqual(b);
    expect(withIndex('grace')).toBe(rebuilt('grace'));
    expect(withIndex('blade')).toBe(rebuilt('blade'));
  });
});

describe('newCharacter', () => {
  it('starts at level 1 with the documented defaults', () => {
    const c = newCharacter();
    expect(c.level).toBe(1);
    expect(c.hope).toEqual({ marked: 2, max: BASE_HOPE });
    expect(c.loadout).toEqual([]);
    expect(c.scars).toEqual([]);
    expect(c.schemaVersion).toBe(3);
  });

  it('lets a caller override any field', () => {
    expect(newCharacter({ name: 'Vex', level: 4 }).name).toBe('Vex');
  });

  it('gives every character its own id', () => {
    expect(newCharacter().id).not.toBe(newCharacter().id);
  });
});

describe('syncCounters', () => {
  it('never leaves a marked value above a shrunken max', () => {
    const c = makeCharacter({
      level: 1,
      hp: { marked: 6, max: 6 },
      stress: { marked: 6, max: 6 },
      hope: { marked: 6, max: 6 },
      armorSlots: { marked: 4, max: 4 },
      scars: ['one', 'two'],
    });
    const next = syncCounters(c, deriveStats(c, ds));
    expect(next.hp).toEqual({ marked: 5, max: 5 });
    expect(next.stress).toEqual({ marked: 6, max: 6 });
    expect(next.hope).toEqual({ marked: 4, max: 4 });
    expect(next.armorSlots).toEqual({ marked: 0, max: 0 });
  });

  it('leaves a marked value alone when the max grew', () => {
    const c = makeCharacter({
      levelUpHistory: [advancement('hitPoint', 'hit-point', 2)],
      hp: { marked: 2, max: 5 },
    });
    const next = syncCounters(c, deriveStats(c, ds));
    expect(next.hp).toEqual({ marked: 2, max: 6 });
  });

  it('re-clamps Armor Slots to the armor actually worn', () => {
    const c = makeCharacter({ activeArmor: 'plate', armorSlots: { marked: 9, max: 9 } });
    expect(syncCounters(c, deriveStats(c, ds)).armorSlots).toEqual({ marked: 6, max: 6 });
  });

  it('does not touch anything else on the sheet', () => {
    const c = makeCharacter({ name: 'Vex', notes: 'keep me' });
    const next = syncCounters(c, deriveStats(c, ds));
    expect(next.name).toBe('Vex');
    expect(next.notes).toBe('keep me');
    expect(next.id).toBe(c.id);
  });
});
