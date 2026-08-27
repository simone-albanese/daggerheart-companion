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
  EncounterAdjustments,
  RosterEntry,
  SceneCombatant,
  Subclass,
  Tier,
  Trait,
  Weapon,
} from '@shared/types.ts';
import type { SessionItem } from '@shared/campaigns.ts';
import { MAX_LOADOUT, newCharacter, type DerivedStats } from '@engine/character.ts';
import { makeCombatant } from '@engine/encounter.ts';
import { emptyLedger } from '@engine/modifiers.ts';
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
    unresolvedArmor: null,
    maxHp: 6,
    maxStress: 6,
    maxHope: 6,
    // No gear, no heritage, no carried relic: the fixture is arithmetic and not a
    // sheet, so its ledger is the empty one `collectModifiers` returns for a
    // character whose every lane is unset.
    modifiers: emptyLedger(),
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

// ---------------------------------------------------------------------------
// What `CAMPAIGN_SCHEMA_VERSION` 3 added, as empty as a fresh row makes it
// ---------------------------------------------------------------------------

/**
 * The three fields the `scene` row absorbed from `encounter` at campaign
 * schema 3 (decision 1), all empty.
 *
 * Spread into a scene literal rather than typed out in each of them. A test
 * that cares about the fight sets its own roster over the top; the many that
 * predate the bump and only ever cared about a name and an environment say so
 * by spreading this, which reads as *"no fight here"* rather than as three
 * fields somebody forgot to think about.
 */
export const NO_FIGHT = {
  roster: [] as RosterEntry[],
  adjustments: { easier: false, harder: false, damageBump: false } as EncounterAdjustments,
  combatants: [] as SceneCombatant[],
};

/**
 * The five fields a `Countdown` gained at campaign schema 3 (decision 8), all
 * empty — the Activation / Advancement / Effect triad, the owner, and the
 * per-tick beats.
 *
 * Empty is not a placeholder here: it is exactly what every countdown written
 * before the bump holds after `readCountdown` has supplied its defaults, so a
 * fixture spreading this is a faithful schema-2 clock read forward.
 */
export const NO_CLOCK_PROSE = {
  activation: '',
  advancement: '',
  effect: '',
  owner: '',
  beats: [] as string[],
};

// ---------------------------------------------------------------------------
// The scene row, when the fight is IN it
// ---------------------------------------------------------------------------

/**
 * The one arm of `SessionItem` that holds a fight, given a name.
 *
 * `Extract<SessionItem, { kind: 'scene' }>` written out at a call site is
 * unreadable, and written out twice it is two things that can drift.
 */
export type SceneRow = Extract<SessionItem, { kind: 'scene' }>;

/**
 * One body on the table, as the app itself would have minted it.
 *
 * The whole object is `makeCombatant`'s, with the id renamed. Not a nine-field
 * literal copied out of `src/engine/encounter.ts`: `makeCombatant` is the only
 * thing in the app that ever mints a combatant, so a fixture body it could not
 * have produced is a fiction, and one that reimplements its derivation goes on
 * passing after the derivation changes. Deriving it here means it cannot.
 *
 * The id is positional and is deliberately not reachable through the patch.
 * `campaignRoundTrip.test.ts`, `names.test.tsx` and `sceneSwitcher.test.tsx`
 * each hand-build the same nine fields to get a body they can name and point
 * at, so the id is the argument; and two ways to set one field is one too many.
 *
 * Everything else is the patch's, including the fields the app never writes by
 * hand: `hp.marked`, `spotlighted`, `minionsRemaining` and an `adversaryRef`
 * naming nothing, which is how a test asks for a fight already in progress or
 * for a body this dataset cannot resolve.
 */
export const combatant = (
  id: string,
  p: Partial<Omit<SceneCombatant, 'id'>> = {},
): SceneCombatant => ({
  ...makeCombatant(makeAdversary(), 0, 1),
  id,
  ...p,
});

/**
 * A scene row that IS the fight, minted whole rather than typed out again.
 *
 * This and `NO_FIGHT` are the two halves of `CAMPAIGN_SCHEMA_VERSION` 3, and
 * they are not the same shape of thing. `NO_FIGHT` is a *spread*: the three
 * fields a row carries because the schema says it must, dropped into a literal
 * by a test whose subject is a name and a place - it reads as *"no fight
 * here"*. This is a *constructor*: the caller has bodies in hand and the row is
 * where they live, so the fight is the argument and everything else is
 * default - *"this row IS the fight"*. A seed that spreads `NO_FIGHT` and then
 * writes `combatants:` over the top has said two contradictory things about
 * itself in three lines; it wants this instead.
 *
 * One helper rather than a seed per file, because the seeds are about to be
 * rewritten roughly a dozen at a time. Moving the GM's live fight off the board
 * and onto the row it is fought in turns every `setState({ combatants: [...] })`
 * in `tests/gm/` into a session row. A dozen rows hand-built from memory is a
 * dozen chances to write a shape nothing can reach - and every one of them
 * typechecks, because a row is a record of plain fields and a *plausible* one
 * is indistinguishable from a reachable one until something reads it. Behind
 * one function the dozen either all move or all fail to compile, once, here.
 *
 * That is also why `opts` is `Partial<Omit<SceneRow, …>>` rather than a hand-
 * listed six: when the scene arm gains a seventh field, the object literal
 * below stops compiling until somebody gives it a default, which is exactly the
 * moment to decide what an unstated one means.
 *
 * Every array it hands back is its own. `NO_FIGHT` is a const spread, so the
 * `[]` in one row and the `[]` in the next are the same array - harmless for a
 * row that is empty by definition, and the wrong property for a row built to be
 * filled and then mutated.
 *
 * Two defaults are choices rather than emptiness. `collapsed: false`, because a
 * shut row draws only its header and the half of a row that resolves refs
 * against the dataset - the half that can throw - is the open one.
 * `tests/ui/screens.test.tsx` chose `collapsed: false` for its own scene
 * fixture and gives that reason. And `environmentRef: null`, because this
 * file's header promises every value in it is invented: a default that named a
 * real place would be an SRD id living in the repo, and a test that means to
 * pin one passes it.
 */
export const sceneWith = (
  id: string,
  combatants: SceneCombatant[],
  opts: Partial<Omit<SceneRow, 'kind' | 'id' | 'combatants'>> = {},
): SceneRow => ({
  id,
  kind: 'scene',
  name: 'A scene',
  order: 0,
  collapsed: false,
  environmentRef: null,
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  ...opts,
  // Last, and copied. Last so no `opts` a caller widened past its type can
  // contradict the argument the helper is named for; copied so two rows seeded
  // from one array are two fights rather than one shared by both.
  combatants: [...combatants],
});
