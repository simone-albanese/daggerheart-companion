/**
 * Shapes for the engine tests. Every value here is invented: the SRD content
 * lives in the user's IndexedDB, never in the repo, so the fixtures carry the
 * *structure* the engine does arithmetic on and nothing else.
 */
import { SCHEMA_VERSION } from '@shared/types.ts';
import type {
  Adversary,
  AdversaryRole,
  Armor,
  CharClass,
  Character,
  Dataset,
  DomainCard,
  DomainId,
  Feature,
  Item,
  LevelUpChoice,
  Subclass,
  Tier,
  Trait,
  Weapon,
} from '@shared/types.ts';
import { MAX_LOADOUT, newCharacter, type DerivedStats } from '@engine/character.ts';
import type { Rng } from '@engine/dice.ts';

export const feature = (name = 'A Feature'): Feature => ({ name, text: `${name} does a thing.` });

export const makeClass = (p: Partial<CharClass> = {}): CharClass => ({
  id: 'test-class',
  name: 'Test Class',
  description: '',
  domains: ['blade', 'valor'],
  startingEvasion: 10,
  startingHitPoints: 6,
  suggestedEquipment: [],
  classItems: [],
  hopeFeature: feature('Hope Feature'),
  classFeatures: [],
  backgroundQuestions: [],
  connectionQuestions: [],
  subclasses: ['test-subclass'],
  ...p,
});

export const makeSubclass = (p: Partial<Subclass> = {}): Subclass => ({
  id: 'test-subclass',
  name: 'Test Subclass',
  classRef: 'test-class',
  spellcastTrait: null,
  foundationFeatures: [],
  specializationFeatures: [],
  masteryFeatures: [],
  ...p,
});

export const makeWeapon = (p: Partial<Weapon> = {}): Weapon => ({
  id: 'test-weapon',
  name: 'Test Weapon',
  tier: 1,
  slot: 'primary',
  category: 'Physical',
  trait: 'agility',
  range: 'Melee',
  damage: 'd8+3',
  damageType: 'phy',
  burden: 1,
  feature: '',
  ...p,
});

export const makeArmor = (p: Partial<Armor> = {}): Armor => ({
  id: 'test-armor',
  name: 'Test Armor',
  tier: 1,
  baseThresholds: [5, 11],
  baseScore: 4,
  feature: '',
  ...p,
});

export const makeCard = (p: Partial<DomainCard> = {}): DomainCard => ({
  id: 'blade-test-card',
  name: 'Test Card',
  domain: 'blade',
  level: 1,
  type: 'Ability',
  recallCost: 1,
  text: 'Card text, rendered and never executed.',
  ...p,
});

export const makeAdversary = (p: Partial<Adversary> = {}): Adversary => ({
  id: 'test-adversary',
  name: 'Test Adversary',
  tier: 2,
  role: 'Standard',
  description: '',
  motives: [],
  difficulty: 13,
  thresholds: [8, 15],
  hp: 5,
  stress: 3,
  attackBonus: 2,
  attack: { name: 'Swipe', range: 'Melee', damage: '2d6+3', damageType: 'phy' },
  experiences: [],
  features: [],
  ...p,
});

/** An adversary of a given role, with a distinct id so rosters stay readable. */
export const adversaryOfRole = (role: AdversaryRole, tier: Tier = 2): Adversary =>
  makeAdversary({ id: `test-${role.toLowerCase()}`, name: `Test ${role}`, role, tier });

export const makeItem = (p: Partial<Item> = {}): Item => ({
  id: 'test-item',
  name: 'Test Item',
  kind: 'loot',
  text: '',
  ...p,
});

export const makeDataset = (p: Partial<Dataset> = {}): Dataset => ({
  schemaVersion: SCHEMA_VERSION,
  revision: 'test-0',
  generatedAt: '2024-01-01T00:00:00.000Z',
  layers: [{ id: 'test', label: 'Test', priority: 0 }],
  domains: [],
  domainCards: [],
  classes: [makeClass()],
  subclasses: [makeSubclass()],
  beastforms: [],
  ancestries: [],
  communities: [],
  weapons: [makeWeapon()],
  armors: [makeArmor()],
  loot: [],
  consumables: [],
  adversaries: [],
  environments: [],
  rules: [],
  ...p,
});

export const makeCharacter = (p: Partial<Character> = {}): Character =>
  newCharacter({ name: 'Test', classRef: 'test-class', ...p });

/**
 * A `levelUpHistory` entry as `applyLevelUp` writes it: `slotUsage` keys off
 * `detail.optionId` and `detail.optionTier`, so a hand-built history must carry
 * both or it will not count against a slot.
 */
export const advancement = (
  kind: LevelUpChoice['kind'],
  optionId: string,
  optionTier: Tier,
  level = 2,
  detail: Record<string, unknown> = {},
): LevelUpChoice => ({
  level,
  slot: 0,
  kind,
  detail: { ...detail, optionId, optionTier },
});

/** DerivedStats without having to build a whole dataset around them. */
export const makeStats = (p: Partial<DerivedStats> = {}): DerivedStats => {
  const base: DerivedStats = {
    tier: 1,
    proficiency: 1,
    evasion: 10,
    traits: traits(),
    beastform: null,
    thresholds: [7, 12],
    massiveThreshold: 24,
    armorScore: 3,
    maxHp: 6,
    maxStress: 6,
    maxHope: 6,
    spellcastTrait: null,
    domains: ['blade', 'valor'],
    cardLevelCap: () => 1,
    loadoutLimit: MAX_LOADOUT,
    ...p,
  };
  // Keep the optional Massive rule consistent with whatever thresholds a test
  // asked for, so no test can accidentally assert against a stale doubling.
  return { ...base, massiveThreshold: p.massiveThreshold ?? base.thresholds[1] * 2 };
};

export const traits = (p: Partial<Record<Trait, number>> = {}): Record<Trait, number> => ({
  agility: 0,
  strength: 0,
  finesse: 0,
  instinct: 0,
  presence: 0,
  knowledge: 0,
  ...p,
});

export const DOMAIN_BLADE: DomainId = 'blade';

/** An Rng that hands back a script and records the sides it was asked for. */
export interface ScriptedRng extends Rng {
  /** Sides requested, in call order. */
  calls: number[];
}

export const scriptedRng = (...results: number[]): ScriptedRng => {
  let i = 0;
  const rng = ((sides: number) => {
    rng.calls.push(sides);
    const v = results[i++];
    if (v === undefined) throw new Error(`scriptedRng ran out after ${i - 1} rolls`);
    return v;
  }) as ScriptedRng;
  rng.calls = [];
  return rng;
};

/** For proving a code path never touches the dice. */
export const refusingRng: Rng = () => {
  throw new Error('the RNG must not be consulted here');
};
