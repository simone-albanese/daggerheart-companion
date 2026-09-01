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
import { MAX_FAVOR, MAX_FOCUS, type Character, type Dataset } from '@shared/types.ts';
import { hasDataset, loadDataset } from '../../tools/sampleCharacters.ts';
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
    expect(c.consecutiveShortRests).toBe(0);
    // The literal, not the constant: `toBe(SCHEMA_VERSION)` would agree with
    // whatever the constant said, and this assertion exists to notice a bump.
    // It noticed this one: 5 -> 6, for the SRD 2.0 dataset contract, then
    // 6 -> 7, for `transformationRef`, then 7 -> 8, for the martial stances,
    // then 8 -> 9, for the Warlock's Favor.
    expect(c.schemaVersion).toBe(9);
    // Seeded here as well as by the converter, because `readCharacterRecord`
    // spreads an imported file over a blank sheet: a build with no key here
    // would drop the field out of any file that did not carry it.
    expect(c.transformationRef).toBeNull();
    expect(c.stanceRefs).toEqual([]);
    expect(c.focus).toEqual({ marked: 0, max: MAX_FOCUS });
    /*
     * ZERO, and this line used to say three.
     *
     * The Warlock's feature reads *"You start with 3 Favor"* and only the
     * Warlock has it, so three on a classless blank sheet was a resource handed
     * to twelve classes that do not have one. `c` here is `newCharacter()` with
     * no partial and no index: no class to read, so the seed falls to none -
     * the same degradation the Hit Point track accepts three tests down, where
     * an unindexed call falls back to six.
     *
     * The Warlock's three, the twelve zeroes beside it and the multiclass that
     * does NOT get three are all in `tests/favor.test.tsx`; what is pinned here
     * is only that a blank sheet no longer starts holding somebody else's
     * resource. The 8 -> 9 converter also seeds zero, for a different reason -
     * it runs on somebody already playing - and `tests/tools/schema.test.ts`
     * pins that half.
     */
    expect(c.favor).toEqual({ marked: 0, max: MAX_FAVOR });
  });

  it('lets a caller override any field', () => {
    expect(newCharacter({ name: 'Vex', level: 4 }).name).toBe('Vex');
  });

  it('gives every character its own id', () => {
    expect(newCharacter().id).not.toBe(newCharacter().id);
  });

  it('seeds the Hit Point track from the class when it is given one to read', () => {
    // The fixture class starts on 5, not the 6 this used to write for everyone.
    const ix = indexDataset(ds);
    const c = newCharacter({ classRef: 'test-class' }, ix);
    expect(c.hp).toEqual({ marked: 0, max: 5 });
    // And the point of it: what is stored agrees with what the engine derives,
    // with no syncCounters pass in between to paper over the difference.
    expect(c.hp.max).toBe(deriveStats(c, ds, ix).maxHp);
    // Control, and the limit of the fix said out loud: with no index there is
    // nothing to look the class up in, so the same call falls back to 6 while
    // the engine, which has the dataset, derives 5. That is why every path
    // that stores a character passes one, and why the wizard's preview sheets
    // - which read `deriveStats` and not this track - can do without.
    expect(newCharacter({ classRef: 'test-class' }).hp.max).toBe(6);
  });

  it('falls back to the engine’s own six when there is no class to read', () => {
    // Two ways to have no class: the wizard's blank sheet before the class
    // step, and a class this build cannot resolve. Both seed the number
    // `deriveStats` falls back to, so neither is stored disagreeing with it.
    for (const c of [newCharacter(), newCharacter({ classRef: 'no-such-class' }, indexDataset(ds))]) {
      expect(c.hp).toEqual({ marked: 0, max: 6 });
      expect(c.hp.max).toBe(deriveStats(c, ds).maxHp);
    }
  });

  it('still lets a caller hand over a Hit Point track of its own', () => {
    const c = newCharacter({ classRef: 'test-class', hp: { marked: 3, max: 9 } }, indexDataset(ds));
    expect(c.hp).toEqual({ marked: 3, max: 9 });
  });

  it('starts Stress at six, which no class in the game changes', () => {
    expect(newCharacter({ classRef: 'test-class' }, indexDataset(ds)).stress).toEqual({
      marked: 0,
      max: 6,
    });
  });
});

/**
 * The nine classes as the SRD really prints them.
 *
 * The backlog said six of nine were wrong and an auditor said four; neither is
 * worth taking on trust, so the numbers are read off `data/srd-1.0.json` here
 * and pinned. Four of the nine differ from six, and the Stress track does not
 * vary at all - there is no per-class Stress anywhere in the data.
 */
describe.skipIf(!hasDataset())('the SRD’s own Hit Point numbers', () => {
  it('seeds every class from its own number rather than from six', () => {
    const dataset = loadDataset();
    const ix = indexDataset(dataset);
    const seeded = Object.fromEntries(
      dataset.classes.map((k) => [k.id, newCharacter({ classRef: k.id }, ix).hp.max]),
    );
    /*
     * Thirteen, and the nine that were here before did not move.
     *
     * The switch to SRD 2.0 added Assassin, Brawler, Warlock and Witch. Every
     * one of the original nine seeds the same Hit Points it seeded off
     * `data/srd-1.0.json` - bard 5, druid 6, guardian 7, ranger 6, rogue 6,
     * seraph 7, sorcerer 6, warrior 6, wizard 5 - so a saved character's
     * starting HP is not something the switch moved. That is worth asserting
     * as a SET rather than leaving to be read off a diff.
     */
    expect(seeded).toEqual({
      assassin: 5,
      bard: 5,
      brawler: 6,
      druid: 6,
      guardian: 7,
      ranger: 6,
      rogue: 6,
      seraph: 7,
      sorcerer: 6,
      warlock: 5,
      warrior: 6,
      witch: 6,
      wizard: 5,
    });
    expect(Object.values(seeded).filter((hp) => hp !== 6)).toHaveLength(6);

    // Every one of them stored in agreement with the engine, HP and Stress
    // both, and named in the failure so a wrong one says which class it was.
    for (const k of dataset.classes) {
      const c = newCharacter({ classRef: k.id }, ix);
      const stats = deriveStats(c, dataset, ix);
      expect([k.id, c.hp.max, c.stress.max]).toEqual([k.id, stats.maxHp, stats.maxStress]);
    }
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
