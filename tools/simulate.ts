/**
 * The whole matrix, played out.
 *
 * 18 subclasses x 18 ancestries x 10 levels: 3240 characters, every one of
 * them built the way a player builds one - level 1 out of `newCharacter`, then
 * walked up a level at a time through `availableOptions`, `validatePlan` and
 * `applyLevelUp`. A hand-written level 8 sheet proves nothing: if play cannot
 * reach it, neither can a bug.
 *
 * Every choice is decided by the three coordinates and nothing else, so a
 * failure report is a recipe:
 *
 *   npx tsx tools/simulate.ts                          the full matrix
 *   npx tsx tools/simulate.ts --level 10               one level of it
 *   npx tsx tools/simulate.ts --subclass syndicate --ancestry faun --level 7 --dump
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { TRAITS } from '../shared/types.ts';
import type {
  Armor,
  CharClass,
  Character,
  Dataset,
  DomainCard,
  DomainId,
  Experience,
  InventoryEntry,
  Ref,
  Subclass,
  Tier,
  Trait,
  Weapon,
} from '../shared/types.ts';
import {
  MAX_ARMOR_SCORE,
  MAX_HP,
  MAX_LEVEL,
  MAX_LOADOUT,
  MAX_STRESS,
  BASE_HOPE,
  deriveStats,
  indexDataset,
  newCharacter,
  syncCounters,
  tierOf,
  type DatasetIndex,
  type DerivedStats,
} from '../src/engine/character.ts';
import {
  applyLevelUp,
  availableOptions,
  slotUsage,
  tierAchievementFor,
  validatePlan,
  type LevelUpPlan,
} from '../src/engine/levelUp.ts';
import { canAddToLoadout, cardAvailability, recallCard } from '../src/engine/loadout.ts';
import { addScar } from '../src/engine/death.ts';
import { gain } from '../src/engine/gold.ts';
import { seededRng, type Rng } from '../src/engine/dice.ts';

// ---------------------------------------------------------------------------
// The dataset
// ---------------------------------------------------------------------------

/**
 * Read rather than imported: this file is run by tsx and by vitest, and only
 * one of the two resolves a JSON import without ceremony.
 */
export function loadDataset(): Dataset {
  const path = new URL('../data/srd-2.0.json', import.meta.url);
  return JSON.parse(readFileSync(path, 'utf8')) as Dataset;
}

export const dataset: Dataset = loadDataset();
export const index: DatasetIndex = indexDataset(dataset);

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

export interface Coord {
  subclass: Ref;
  ancestry: Ref;
  level: number;
}

export const coordLabel = (c: Coord): string =>
  `${c.subclass} / ${c.ancestry} / level ${c.level}`;

export function matrix(ds: Dataset = dataset): Coord[] {
  const out: Coord[] = [];
  for (const subclass of ds.subclasses) {
    for (const ancestry of ds.ancestries) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        out.push({ subclass: subclass.id, ancestry: ancestry.id, level });
      }
    }
  }
  return out;
}

/**
 * A coordinate's place in the canonical matrix.
 *
 * Computed from the coordinate rather than from the position in whatever
 * subset is being run, so `--level 7` and the full sweep build the same
 * character out of the same three names.
 */
export function coordIndex(coord: Coord, ds: Dataset = dataset): number {
  const s = ds.subclasses.findIndex((x) => x.id === coord.subclass);
  const a = ds.ancestries.findIndex((x) => x.id === coord.ancestry);
  return (s * ds.ancestries.length + a) * MAX_LEVEL + (coord.level - 1);
}

/** FNV-1a. Any stable hash will do, as long as the coordinates alone decide it. */
export function hash(text: string): number {
  let h = 0x811c_9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x0100_0193);
  }
  return h >>> 0;
}

export const seedOf = (coord: Coord): number => hash(coordLabel(coord));

/**
 * Where a character's sweeps start. Two lanes, and a purpose picks one by name.
 *
 * Not `coordIndex`: that number carries the level in its last digit, so a list
 * of ten armors would be indexed by the level alone - the first tier 2 armor
 * would fall only to level 1 characters, who cannot wear it, and to nobody
 * else. And not one lane: two lists in the same lane move in lockstep, so the
 * offhand thrown away by a two-handed primary would be the same one every
 * time and one shield in the dataset would never be carried.
 */
export function sweepLanes(coord: Coord, ds: Dataset = dataset): number[] {
  const s = ds.subclasses.findIndex((x) => x.id === coord.subclass);
  const a = ds.ancestries.findIndex((x) => x.id === coord.ancestry);
  return [
    (s * ds.ancestries.length + a) * 31 + coord.level * 7,
    (a * ds.subclasses.length + s) * 31 + coord.level * 11,
  ];
}

// ---------------------------------------------------------------------------
// Deterministic choices
// ---------------------------------------------------------------------------

const rotate = <T,>(list: readonly T[], by: number): T[] =>
  list.map((_, i) => list[(i + by) % list.length]!);

/**
 * Two ways of choosing, because the matrix wants two different things.
 *
 * `any` is the seeded rng, for what only has to vary. `sweep` is a cursor that
 * starts at this character's place in the matrix and steps on with every call,
 * for what has to be *covered*: 3240 characters walk the whole weapon rack
 * instead of clustering on the dice's favourites. Each purpose keeps its own
 * cursor, offset by the purpose's name, so its k-th call is always the same
 * distance from the start and two lists never move in lockstep - the offhand
 * a two-handed primary throws away would otherwise be the same one every time.
 */
class Choices {
  private readonly rng: Rng;
  private readonly cursors = new Map<string, number>();

  constructor(
    seed: number,
    readonly index: number,
    private readonly lanes: number[],
  ) {
    this.rng = seededRng(seed);
  }

  /** 0 .. n-1. */
  int(n: number): number {
    return n <= 0 ? 0 : this.rng(n) - 1;
  }

  any<T>(list: readonly T[]): T | undefined {
    return list.length === 0 ? undefined : list[this.int(list.length)];
  }

  sweep<T>(key: string, list: readonly T[]): T | undefined {
    if (list.length === 0) return undefined;
    const h = hash(key);
    const at = this.cursors.get(key) ?? (this.lanes[h % this.lanes.length] ?? 0) + (h % 1009);
    this.cursors.set(key, at + 1);
    return list[at % list.length];
  }

  /** One characteristic in n, spread evenly over the matrix rather than rolled. */
  cycle(n: number): number {
    return this.index % n;
  }
}

// ---------------------------------------------------------------------------
// Building one, the long way round
// ---------------------------------------------------------------------------

/** The array step 3 of character creation hands out. */
const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1] as const;

/** The three lines step 5 gives every character, whatever their class. */
const STARTER_KIT = ['A torch', '50 feet of rope', 'Basic supplies'];

/** Player-written free text, so the shape is what matters, not the words. */
const EXPERIENCE_NAMES = [
  'Fast talker',
  'Steady hands',
  'Well travelled',
  'Light sleeper',
  'Old debts',
  'Sharp eyes',
  'Raised at sea',
  'Read every book in town',
];

const SCAR_NOTES = ['A cold that never leaves', 'The hand that does not close'];

export interface Touched {
  weapons: Set<Ref>;
  armors: Set<Ref>;
  items: Set<Ref>;
  advancements: Set<string>;
  multiclasses: Set<Ref>;
  unarmored: boolean;
}

export interface Built {
  coord: Coord;
  character: Character;
  touched: Touched;
  /** One line per level-up, for a failure that needs the road and not the map. */
  trace: string[];
}

/** A plan the simulator built that the engine refused. Reported, never swallowed. */
export class IllegalPlanError extends Error {
  constructor(
    readonly level: number,
    readonly plan: LevelUpPlan,
    readonly errors: string[],
  ) {
    super(`level ${level}: ${errors.join(' | ')}`);
    this.name = 'IllegalPlanError';
  }
}

const sync = (c: Character, ds: Dataset, ix: DatasetIndex): Character =>
  syncCounters(c, deriveStats(c, ds, ix));

/** Cards this character could take right now, in dataset order. */
function eligibleCards(
  c: Character,
  stats: DerivedStats,
  ds: Dataset,
  taken: ReadonlySet<Ref>,
): DomainCard[] {
  return cardAvailability(c, stats, ds.domainCards)
    .filter((a) => a.eligible && !a.owned && !taken.has(a.card.id))
    .map((a) => a.card);
}

function gearFor(
  tier: Tier,
  ds: Dataset,
  ch: Choices,
  unarmored: boolean,
): { primary: Weapon | undefined; secondary: Weapon | undefined; armor: Armor | undefined } {
  const primary = ch.sweep(`primary-${tier}`, ds.weapons.filter((w) => w.tier === tier && w.slot === 'primary'));
  // Swept even when it will be dropped, so the cursor stays a function of the
  // tier alone and the whole rack still gets walked.
  const offhand = ch.sweep(`secondary-${tier}`, ds.weapons.filter((w) => w.tier === tier && w.slot === 'secondary'));
  const armor = ch.sweep(`armor-${tier}`, ds.armors.filter((a) => a.tier === tier));
  return {
    primary,
    secondary: primary?.burden === 2 ? undefined : offhand,
    armor: unarmored ? undefined : armor,
  };
}

function buildLevelOne(coord: Coord, ds: Dataset, ix: DatasetIndex, ch: Choices, touched: Touched): Character {
  const subclass = ix.subclasses.get(coord.subclass);
  if (!subclass) throw new Error(`no such subclass: ${coord.subclass}`);
  const klass = ix.classes.get(subclass.classRef);
  if (!klass) throw new Error(`subclass ${subclass.id} points at no class`);
  const ancestry = ds.ancestries.find((a) => a.id === coord.ancestry);
  if (!ancestry) throw new Error(`no such ancestry: ${coord.ancestry}`);

  const traits = {} as Record<Trait, number>;
  const pool = [...TRAITS];
  for (const value of TRAIT_ARRAY) traits[pool.splice(ch.int(pool.length), 1)[0]!] = value;

  // A mixed ancestry is two halves; the coordinate is always the top half.
  const second = ch.cycle(7) === 0 ? ch.sweep('mixed', ds.ancestries.filter((a) => a.id !== ancestry.id)) : undefined;
  const community = ch.sweep('community', ds.communities);

  const gear = gearFor(1, ds, ch, ch.cycle(11) === 0);
  if (gear.primary) touched.weapons.add(gear.primary.id);
  if (gear.secondary) touched.weapons.add(gear.secondary.id);
  if (gear.armor) touched.armors.add(gear.armor.id);
  touched.unarmored = gear.armor === undefined;

  const experiences: Experience[] = [0, 1].map((n) => ({
    id: `exp-${ch.index}-${n}`,
    name: ch.sweep(`experience-${n}`, EXPERIENCE_NAMES) ?? 'An experience',
    bonus: 2,
  }));

  const inventory: InventoryEntry[] = STARTER_KIT.map((name) => ({ ref: null, name, quantity: 1 }));
  const classItem = ch.sweep('class-item', klass.classItems);
  if (classItem !== undefined) inventory.push({ ref: null, name: classItem, quantity: 1 });
  const carried = ch.sweep('item', [...ds.consumables, ...ds.loot]);
  if (carried) {
    inventory.push({ ref: carried.id, name: carried.name, quantity: 1 + ch.int(3) });
    touched.items.add(carried.id);
  }

  const base = newCharacter({
    name: `${subclass.name} ${ancestry.name}`,
    pronouns: 'they/them',
    classRef: klass.id,
    subclassRefs: [subclass.id],
    ancestryRefs: second ? [ancestry.id, second.id] : [ancestry.id],
    communityRef: community?.id ?? null,
    level: 1,
    traits,
    activePrimaryWeapon: gear.primary?.id ?? null,
    activeSecondaryWeapon: gear.secondary?.id ?? null,
    activeArmor: gear.armor?.id ?? null,
    inventory,
    experiences,
    // The SRD hands you one handful at step 5; the rest is what play added.
    gold: gain({ handfuls: 1, bags: 0, chests: 0 }, { handfuls: ch.int(9), bags: ch.int(4) }).gold,
    connections: [`They owe ${ancestry.name === 'Human' ? 'a rival' : 'an old friend'} a favour.`],
    notes: '',
  });

  // Two level 1 cards, and at level 1 they fit inside the loadout.
  const stats = deriveStats(base, ds, ix);
  const taken = new Set<Ref>();
  const loadout: Ref[] = [];
  for (let i = 0; i < 2; i++) {
    const card = ch.sweep('start-card', eligibleCards(base, stats, ds, taken));
    if (!card) break;
    taken.add(card.id);
    loadout.push(card.id);
  }

  let c: Character = { ...base, loadout };
  // A scar is what a Death Move leaves behind, so it goes on through death.ts.
  for (let i = 0; i < ch.cycle(13) % 3; i++) c = addScar(c, SCAR_NOTES[i] ?? '');
  return sync(c, ds, ix);
}

// ---------------------------------------------------------------------------
// The level-up path
// ---------------------------------------------------------------------------

/**
 * Preference order for the advancements, rotated per character so that across
 * the matrix every option is taken by someone, in every tier that offers it.
 */
const PREFERENCE = [
  'traits',
  'hit-point',
  'stress',
  'experience',
  'domain-card',
  'evasion',
  'subclass',
  'proficiency',
  'multiclass',
] as const;

const BOXED = new Set(['proficiency', 'multiclass']);

function planFor(c: Character, toLevel: number, ds: Dataset, ix: DatasetIndex, ch: Choices): LevelUpPlan {
  const tier = tierOf(toLevel);
  const achievement = tierAchievementFor(toLevel);
  const stats = deriveStats({ ...c, level: toLevel }, ds, ix);
  const taken = new Set<Ref>([...c.loadout, ...c.vault]);

  // Step four is not an advancement, and choosing it first keeps the
  // domain-card advancement from reaching for the same card. A player reaches
  // for the card their new level just opened, so this does too - and that is
  // also what walks the top of every domain, which nothing else would reach.
  const open = eligibleCards(c, stats, ds, taken);
  const fresh = open.filter((card) => card.level === toLevel);
  const stepFour = ch.sweep('step-four', fresh.length > 0 ? fresh : open);
  if (stepFour) taken.add(stepFour.id);

  const remaining = new Map(slotUsage(c).map((u) => [`${u.optionId}@${u.tier}`, u.remaining]));
  const spent = (id: string, t: Tier): boolean =>
    c.levelUpHistory.some((h) => h.detail['optionId'] === id && h.detail['optionTier'] === t);
  const marks = new Set<Trait>(
    achievement?.clearTraitMarks === true ? [] : TRAITS.filter((t) => (c.traitMarks[t] ?? 0) > 0),
  );

  /** The detail an option needs, or null when this character cannot take it. */
  const detailFor = (id: string, t: Tier): Record<string, unknown> | null => {
    if (id === 'traits') {
      const open = TRAITS.filter((x) => !marks.has(x));
      if (open.length < 2) return null;
      const first = ch.sweep('trait', open)!;
      const second = ch.sweep('trait', open.filter((x) => x !== first))!;
      return { traits: [first, second] };
    }
    if (id === 'experience') {
      if (c.experiences.length < 2) return null;
      const ids = rotate(c.experiences, ch.cycle(c.experiences.length)).slice(0, 2).map((e) => e.id);
      return { experiences: ids };
    }
    if (id === 'domain-card') {
      const card = ch.sweep('extra-card', eligibleCards(c, stats, ds, taken));
      return card ? { cardRef: card.id } : null;
    }
    if (id === 'subclass') {
      // The tier that multiclassed crossed this option out, and vice versa.
      if (spent('multiclass', t)) return null;
      const own = c.subclassRefs[0];
      if (own === undefined) return null;
      const upgrades = c.levelUpHistory.filter((h) => h.kind === 'subclass').length;
      return { subclassRef: own, card: upgrades === 0 ? 'specialization' : 'mastery' };
    }
    if (id === 'multiclass') {
      if (c.multiclassRef !== null || spent('subclass', t)) return null;
      // Never a domain this character already has: the second class is worth
      // taking for a domain that is new, and the level cap for a domain that
      // is both is a question the rules do not ask.
      const classes = ds.classes.filter(
        (k) => k.id !== c.classRef && k.domains.some((d) => !stats.domains.includes(d)),
      );
      const klass = ch.sweep('multiclass', classes);
      if (!klass) return null;
      const domain = klass.domains.find((d) => !stats.domains.includes(d))!;
      const sub = ch.sweep('multiclass-subclass', ds.subclasses.filter((s) => s.classRef === klass.id));
      if (!sub) return null;
      return { classRef: klass.id, domain, subclassRef: sub.id };
    }
    return {};
  };

  const picks: LevelUpPlan['picks'] = [];
  let budget = 2;
  // Rotated by the level as well as by the character, so the boxed options are
  // not always reached in the same tier: a character who never wanted the
  // multiclass at level 5 may still want it at 9.
  const order = rotate(PREFERENCE, (ch.cycle(PREFERENCE.length) + toLevel) % PREFERENCE.length);

  while (budget > 0) {
    let chosen: LevelUpPlan['picks'][number] | null = null;
    let cost = 0;
    for (const id of order) {
      const boxed = BOXED.has(id);
      if (boxed && budget < 2) continue;
      for (let t = tier; t >= 2; t--) {
        if ((remaining.get(`${id}@${t}`) ?? 0) <= 0) continue;
        const detail = detailFor(id, t as Tier);
        if (detail === null) continue;
        chosen = { optionId: id, optionTier: t as Tier, detail };
        cost = boxed ? 2 : 1;
        break;
      }
      if (chosen) break;
    }
    if (!chosen) break;

    // Commit what the choice consumes, so the second pick sees it.
    for (const t of (chosen.detail['traits'] as Trait[] | undefined) ?? []) marks.add(t);
    const cardRef = chosen.detail['cardRef'];
    if (typeof cardRef === 'string') taken.add(cardRef);
    remaining.set(
      `${chosen.optionId}@${chosen.optionTier}`,
      (remaining.get(`${chosen.optionId}@${chosen.optionTier}`) ?? 0) - 1,
    );
    picks.push(chosen);
    budget -= cost;
  }

  if (achievement && picks[0]) {
    picks[0] = {
      ...picks[0],
      detail: {
        ...picks[0].detail,
        achievementExperience: ch.sweep('achievement', EXPERIENCE_NAMES) ?? 'An experience',
      },
    };
  }

  return {
    fromLevel: toLevel - 1,
    toLevel,
    tier,
    achievement,
    // Never traded, for the reason `sampleCharacters.ts` gives: the simulator
    // hands `validatePlan` no index, and an unchecked exchange is a refusal.
    exchange: null,
    picks,
    newCardRef: stepFour?.id ?? null,
  };
}

/** Downtime: move cards out of the vault until the loadout is full. */
function fillLoadout(c: Character, ds: Dataset, ix: DatasetIndex, ch: Choices): Character {
  if (ch.cycle(3) === 0) return c; // some players keep a lean loadout
  const downtime = ch.cycle(5) !== 0; // and some recall mid-scene, and pay for it
  let cur = c;
  for (const ref of [...cur.vault]) {
    if (cur.loadout.length >= MAX_LOADOUT) break;
    const card = ix.cards.get(ref);
    if (!card) continue;
    if (!canAddToLoadout(cur, card, { downtime }).allowed) continue;
    cur = recallCard(cur, card, { downtime }).character;
  }
  return sync(cur, ds, ix);
}

export function build(coord: Coord, ds: Dataset = dataset, ix: DatasetIndex = index): Built {
  const ch = new Choices(seedOf(coord), coordIndex(coord, ds), sweepLanes(coord, ds));
  const touched: Touched = {
    weapons: new Set(),
    armors: new Set(),
    items: new Set(),
    advancements: new Set(),
    multiclasses: new Set(),
    unarmored: false,
  };
  const trace: string[] = [];

  let c = buildLevelOne(coord, ds, ix, ch, touched);

  for (let level = 2; level <= coord.level; level++) {
    const plan = planFor(c, level, ds, ix, ch);
    const verdict = validatePlan(c, plan);
    if (!verdict.ok) throw new IllegalPlanError(level, plan, verdict.errors);

    c = applyLevelUp(c, plan);
    for (const pick of plan.picks) {
      touched.advancements.add(`${pick.optionId}@${pick.optionTier}`);
      const classRef = pick.detail['classRef'];
      if (typeof classRef === 'string') touched.multiclasses.add(classRef);
    }

    // A new tier is when a character goes shopping.
    if (tierOf(level) !== tierOf(level - 1)) {
      const gear = gearFor(tierOf(level), ds, ch, c.activeArmor === null);
      if (gear.primary) touched.weapons.add(gear.primary.id);
      if (gear.secondary) touched.weapons.add(gear.secondary.id);
      if (gear.armor) touched.armors.add(gear.armor.id);
      c = {
        ...c,
        activePrimaryWeapon: gear.primary?.id ?? c.activePrimaryWeapon,
        activeSecondaryWeapon: gear.secondary?.id ?? null,
        activeArmor: gear.armor?.id ?? null,
      };
    }

    c = sync(c, ds, ix);
    c = fillLoadout(c, ds, ix, ch);
    trace.push(
      `L${level}  ${plan.picks.map((p) => `${p.optionId}@${p.optionTier}`).join(' + ')}` +
        `  card ${plan.newCardRef ?? 'none'}`,
    );
  }

  return { coord, character: c, touched, trace };
}

// ---------------------------------------------------------------------------
// What the engine claims, checked against what it produced
// ---------------------------------------------------------------------------

export interface Failure {
  coord: Coord;
  assertion: string;
  detail: string;
}

/** Fields the types genuinely allow to be null. Array indices collapse to `[]`. */
const NULLABLE_CHARACTER = new Set([
  'communityRef',
  'multiclassRef',
  'multiclassDomain',
  'evasionOverride',
  'thresholdOverride',
  'activePrimaryWeapon',
  'activeSecondaryWeapon',
  'activeArmor',
  'companion',
  'beastform',
  'inventory[].ref',
]);

const NULLABLE_STATS = new Set(['beastform', 'spellcastTrait']);

/**
 * Every value in an object graph, checked for the three ways a number or a
 * reference goes missing. Walked rather than spot-checked: the bug that
 * matters is the field nobody thought to look at.
 */
function walkValues(root: unknown, allowNull: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown, path: string, where: string): void => {
    if (value === null) {
      if (!allowNull.has(path)) bad.push(`${where} is null`);
      return;
    }
    if (value === undefined) {
      bad.push(`${where} is undefined`);
      return;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      bad.push(`${where} is ${String(value)}`);
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[]`, `${where}[${i}]`));
      return;
    }
    for (const [k, v] of Object.entries(value)) {
      visit(v, path === '' ? k : `${path}.${k}`, where === '' ? k : `${where}.${k}`);
    }
  };
  visit(root, '', '');
  return bad;
}

const advancementsOfKind = (c: Character, kind: string): number =>
  c.levelUpHistory.filter((h) => h.kind === kind).length;

export function check(built: Built, ds: Dataset = dataset, ix: DatasetIndex = index): Failure[] {
  const { coord, character: c } = built;
  const failures: Failure[] = [];
  const fail = (assertion: string, detail: string): void => {
    failures.push({ coord, assertion, detail });
  };
  const expect = (ok: boolean, assertion: string, detail: string): void => {
    if (!ok) fail(assertion, detail);
  };

  const stats = deriveStats(c, ds, ix);
  const klass = ix.classes.get(c.classRef);
  const armor = c.activeArmor === null ? undefined : ix.armors.get(c.activeArmor);

  expect(c.level === coord.level, 'the walk arrives at the level it was asked for', `level ${c.level}`);
  expect(
    stats.tier === (c.level <= 1 ? 1 : c.level <= 4 ? 2 : c.level <= 7 ? 3 : 4),
    'the tier is the level’s tier',
    `level ${c.level} reported tier ${stats.tier}`,
  );

  // --- proficiency, thresholds, evasion -----------------------------------

  // The floor is written out again rather than asked of the engine: a checker
  // that calls `baseProficiency` only proves the function equals itself.
  const floor = 1 + [2, 5, 8].filter((l) => c.level >= l).length;
  const bought = advancementsOfKind(c, 'proficiency');
  expect(
    stats.proficiency === floor + bought,
    'proficiency is the level’s floor plus every proficiency advancement',
    `level ${c.level} floor ${floor} + ${bought} advancement(s) = ${floor + bought}, got ${stats.proficiency}`,
  );

  const expectedThresholds: [number, number] = armor
    ? [armor.baseThresholds[0] + c.level, armor.baseThresholds[1] + c.level]
    : [c.level, c.level * 2];
  expect(
    stats.thresholds[0] === expectedThresholds[0] && stats.thresholds[1] === expectedThresholds[1],
    armor
      ? 'thresholds are the equipped armor’s base plus level'
      : 'unarmored thresholds are level and twice level',
    `${armor ? `${armor.id} ${JSON.stringify(armor.baseThresholds)}` : 'unarmored'} at level ${c.level}` +
      ` wants ${JSON.stringify(expectedThresholds)}, got ${JSON.stringify(stats.thresholds)}`,
  );
  expect(
    stats.massiveThreshold === stats.thresholds[1] * 2,
    'the massive threshold is twice severe',
    `severe ${stats.thresholds[1]}, massive ${stats.massiveThreshold}`,
  );

  const expectedScore = Math.min(MAX_ARMOR_SCORE, armor ? armor.baseScore : 0);
  expect(
    stats.armorScore === expectedScore,
    'the armor score is the equipped armor’s, and never above 12',
    `${armor ? `${armor.id} base ${armor.baseScore}` : 'unarmored'} wants ${expectedScore}, got ${stats.armorScore}`,
  );
  expect(
    !armor ? stats.armorScore === 0 : true,
    'an unarmored character has an armor score of 0',
    `got ${stats.armorScore}`,
  );

  const evasions = advancementsOfKind(c, 'evasion');
  expect(
    stats.evasion === (klass?.startingEvasion ?? 10) + evasions,
    'evasion is the class’s starting value plus every evasion advancement',
    `${c.classRef} starts at ${klass?.startingEvasion ?? '?'} + ${evasions} = ` +
      `${(klass?.startingEvasion ?? 10) + evasions}, got ${stats.evasion}`,
  );

  // --- the tracks ----------------------------------------------------------

  const hpBought = advancementsOfKind(c, 'hitPoint');
  expect(
    stats.maxHp === Math.min(MAX_HP, (klass?.startingHitPoints ?? 6) + hpBought),
    'max HP is the class’s starting HP plus its advancements, capped at 12',
    `${klass?.startingHitPoints ?? '?'} + ${hpBought}, got ${stats.maxHp}`,
  );
  const stressBought = advancementsOfKind(c, 'stress');
  expect(
    stats.maxStress === Math.min(MAX_STRESS, 6 + stressBought),
    'max Stress is 6 plus its advancements, capped at 12',
    `6 + ${stressBought}, got ${stats.maxStress}`,
  );
  expect(
    stats.maxHp <= MAX_HP && stats.maxStress <= MAX_STRESS && stats.armorScore <= MAX_ARMOR_SCORE,
    'HP, Stress and armor score never exceed 12',
    `hp ${stats.maxHp}, stress ${stats.maxStress}, armor ${stats.armorScore}`,
  );
  expect(
    stats.maxHope === Math.max(0, BASE_HOPE - c.scars.length),
    'max Hope is 6 minus the scars',
    `${c.scars.length} scar(s) want ${BASE_HOPE - c.scars.length}, got ${stats.maxHope}`,
  );

  // --- nothing missing anywhere -------------------------------------------

  const badCharacter = walkValues(c, NULLABLE_CHARACTER);
  expect(
    badCharacter.length === 0,
    'no NaN, no undefined and no unexpected null in the character',
    badCharacter.join('; '),
  );
  const badStats = walkValues(stats, NULLABLE_STATS);
  expect(
    badStats.length === 0,
    'no NaN, no undefined and no unexpected null in the derived stats',
    badStats.join('; '),
  );

  // --- every ref resolves --------------------------------------------------

  const dangling: string[] = [];
  const resolves = (label: string, ref: Ref | null, has: (r: Ref) => boolean): void => {
    if (ref !== null && !has(ref)) dangling.push(`${label} "${ref}"`);
  };
  const ancestryIds = new Set(ds.ancestries.map((a) => a.id));
  const communityIds = new Set(ds.communities.map((a) => a.id));
  resolves('classRef', c.classRef, (r) => ix.classes.has(r));
  resolves('multiclassRef', c.multiclassRef, (r) => ix.classes.has(r));
  for (const r of c.subclassRefs) resolves('subclassRef', r, (x) => ix.subclasses.has(x));
  for (const r of c.ancestryRefs) resolves('ancestryRef', r, (x) => ancestryIds.has(x));
  resolves('communityRef', c.communityRef, (r) => communityIds.has(r));
  for (const r of c.loadout) resolves('loadout card', r, (x) => ix.cards.has(x));
  for (const r of c.vault) resolves('vault card', r, (x) => ix.cards.has(x));
  resolves('primary weapon', c.activePrimaryWeapon, (r) => ix.weapons.has(r));
  resolves('secondary weapon', c.activeSecondaryWeapon, (r) => ix.weapons.has(r));
  resolves('armor', c.activeArmor, (r) => ix.armors.has(r));
  for (const e of c.inventory) resolves('inventory item', e.ref, (x) => ix.byRef.has(x));
  expect(dangling.length === 0, 'every ref in the character resolves in the dataset', dangling.join(', '));
  expect(
    c.unresolvedRefs === undefined || c.unresolvedRefs.length === 0,
    'a character built from this dataset carries no unresolved refs',
    JSON.stringify(c.unresolvedRefs),
  );
  expect(
    c.subclassRefs[0] === coord.subclass,
    'the sheet keeps the subclass it was built with',
    `${JSON.stringify(c.subclassRefs)} for coordinate ${coord.subclass}`,
  );
  const firstCasting = c.subclassRefs
    .map((r) => ix.subclasses.get(r))
    .find((s): s is Subclass => s !== undefined && s.spellcastTrait !== null);
  expect(
    stats.spellcastTrait === (firstCasting?.spellcastTrait ?? null),
    'the Spellcast trait comes from the subclass',
    `${firstCasting?.id ?? 'none'} wants ${String(firstCasting?.spellcastTrait ?? null)}, got ${String(stats.spellcastTrait)}`,
  );

  // --- cards ---------------------------------------------------------------

  const classDomains: DomainId[] = [...(klass?.domains ?? [])];
  const expectedDomains: DomainId[] =
    c.multiclassDomain !== null && !classDomains.includes(c.multiclassDomain)
      ? [...classDomains, c.multiclassDomain]
      : classDomains;
  expect(
    JSON.stringify(stats.domains) === JSON.stringify(expectedDomains),
    'the domains are the class’s, plus the multiclass domain',
    `${JSON.stringify(expectedDomains)} vs ${JSON.stringify(stats.domains)}`,
  );
  expect(
    c.loadout.length <= MAX_LOADOUT && stats.loadoutLimit === MAX_LOADOUT,
    'the loadout holds at most five cards',
    `${c.loadout.length} cards`,
  );
  const both = c.loadout.filter((r) => c.vault.includes(r));
  expect(both.length === 0, 'no card is in the loadout and the vault at once', both.join(', '));
  const owned = [...c.loadout, ...c.vault];
  expect(new Set(owned).size === owned.length, 'no card is owned twice', owned.join(', '));
  for (const ref of owned) {
    const card = ix.cards.get(ref);
    if (!card) continue;
    const cap = stats.cardLevelCap(card.domain);
    expect(
      stats.domains.includes(card.domain),
      'every card owned is in one of the character’s domains',
      `${ref} is ${card.domain}; this character has ${stats.domains.join(', ')}`,
    );
    expect(
      card.level <= cap,
      'every card owned is at or below its domain’s level cap',
      `${ref} is level ${card.level}; the cap in ${card.domain} at level ${c.level} is ${cap}`,
    );
  }

  // --- counters ------------------------------------------------------------

  const resynced = syncCounters(c, stats);
  expect(
    JSON.stringify([resynced.hp, resynced.stress, resynced.hope, resynced.armorSlots]) ===
      JSON.stringify([c.hp, c.stress, c.hope, c.armorSlots]),
    'the counters on the sheet are already in sync with the derived stats',
    `${JSON.stringify([c.hp, c.stress, c.hope, c.armorSlots])} -> ` +
      `${JSON.stringify([resynced.hp, resynced.stress, resynced.hope, resynced.armorSlots])}`,
  );
  // The claim is that it clamps, so it is handed something to clamp.
  const overmarked = syncCounters(
    {
      ...c,
      hp: { ...c.hp, marked: stats.maxHp + 5 },
      stress: { ...c.stress, marked: stats.maxStress + 5 },
      hope: { ...c.hope, marked: stats.maxHope + 5 },
      armorSlots: { ...c.armorSlots, marked: stats.armorScore + 5 },
    },
    stats,
  );
  for (const [name, track] of [
    ['hp', overmarked.hp],
    ['stress', overmarked.stress],
    ['hope', overmarked.hope],
    ['armorSlots', overmarked.armorSlots],
  ] as const) {
    expect(
      track.marked <= track.max,
      'syncCounters never leaves a marked value above its maximum',
      `${name} came back ${track.marked}/${track.max}`,
    );
  }

  // --- gold and experiences ------------------------------------------------

  const { handfuls, bags, chests } = c.gold;
  expect(
    handfuls >= 0 && handfuls <= 9 && bags >= 0 && bags <= 9 && chests >= 0 && chests <= 1,
    'the purse is a legal purse',
    JSON.stringify(c.gold),
  );
  const expIds = c.experiences.map((e) => e.id);
  expect(new Set(expIds).size === expIds.length, 'every Experience has its own id', expIds.join(', '));
  expect(
    c.experiences.every((e) => e.name !== '' && Number.isInteger(e.bonus)),
    'every Experience has a name and a whole-number bonus',
    JSON.stringify(c.experiences),
  );

  failures.push(...checkHistory(built, stats));
  return failures;
}

/** The level-up history, read back for internal consistency. */
function checkHistory(built: Built, stats: DerivedStats): Failure[] {
  const { coord, character: c } = built;
  const failures: Failure[] = [];
  const expect = (ok: boolean, assertion: string, detail: string): void => {
    if (!ok) failures.push({ coord, assertion, detail });
  };

  const options = new Map(availableOptions(4).map((o) => [`${o.id}@${o.tier}`, o]));

  for (const usage of slotUsage(c)) {
    expect(
      usage.used <= usage.slots,
      'no advancement is taken more often than its tier has slots',
      `${usage.optionId}@${usage.tier} used ${usage.used} of ${usage.slots}`,
    );
  }

  const spentAt = new Map<number, number>();
  for (const entry of c.levelUpHistory) {
    const key = `${String(entry.detail['optionId'])}@${String(entry.detail['optionTier'])}`;
    const option = options.get(key);
    expect(option !== undefined, 'every history entry names an option that exists', `${key} at level ${entry.level}`);
    if (!option) continue;
    expect(
      option.kind === entry.kind,
      'a history entry’s kind matches the option it spent',
      `${key} is a ${option.kind}, recorded as ${entry.kind}`,
    );
    expect(
      entry.level >= 2 && entry.level <= c.level,
      'no advancement is recorded outside the levels that were played',
      `${key} at level ${entry.level}, character is level ${c.level}`,
    );
    expect(
      tierOf(entry.level) >= option.tier,
      'no advancement spends a slot from a tier the character had not reached',
      `${key} taken at level ${entry.level}, which is tier ${tierOf(entry.level)}`,
    );
    spentAt.set(entry.level, (spentAt.get(entry.level) ?? 0) + (option.costsBothPicks ? 2 : 1));
  }

  for (let level = 2; level <= c.level; level++) {
    expect(
      spentAt.get(level) === 2,
      'every level-up spends exactly two advancement picks',
      `level ${level} spent ${spentAt.get(level) ?? 0}`,
    );
  }

  // A tier achievement clears the marks at 5 and 8, so a tier's trait picks are
  // exactly the levels that share `tierOf`.
  const raisedInTier = new Map<Tier, Trait[]>();
  for (const entry of c.levelUpHistory) {
    if (entry.kind !== 'trait') continue;
    const tier = tierOf(entry.level);
    const list = raisedInTier.get(tier) ?? [];
    list.push(...((entry.detail['traits'] as Trait[] | undefined) ?? []));
    raisedInTier.set(tier, list);
  }
  for (const [tier, raised] of raisedInTier) {
    const twice = raised.filter((t, i) => raised.indexOf(t) !== i);
    expect(twice.length === 0, 'no trait is raised twice inside one tier', `tier ${tier}: ${twice.join(', ')}`);
  }
  const thisTier = (raisedInTier.get(stats.tier) ?? []).slice().sort();
  const marked = TRAITS.filter((t) => (c.traitMarks[t] ?? 0) > 0).sort();
  expect(
    JSON.stringify(thisTier) === JSON.stringify(marked),
    'the trait marks are exactly this tier’s trait advancements',
    `history ${JSON.stringify(thisTier)}, marks ${JSON.stringify(marked)}`,
  );
  expect(
    Object.values(c.traitMarks).every((n) => (n ?? 0) <= 1),
    'a trait is never marked more than once',
    JSON.stringify(c.traitMarks),
  );

  for (const tier of [2, 3, 4] as Tier[]) {
    const took = (id: string): boolean =>
      c.levelUpHistory.some((h) => h.detail['optionId'] === id && h.detail['optionTier'] === tier);
    expect(
      !(took('subclass') && took('multiclass')),
      'the upgraded subclass and the multiclass never share a tier - each crosses the other out',
      `both taken at tier ${tier}`,
    );
  }

  const multiclasses = c.levelUpHistory.filter((h) => h.kind === 'multiclass');
  expect(multiclasses.length <= 1, 'a character multiclasses at most once', `${multiclasses.length} times`);
  const first = multiclasses[0];
  expect(
    (c.multiclassRef === null) === (first === undefined),
    'the multiclass on the sheet is the one the history recorded',
    `sheet ${String(c.multiclassRef)}, history ${multiclasses.length} entr(ies)`,
  );
  if (first) {
    expect(
      c.multiclassRef === first.detail['classRef'] && c.multiclassDomain === first.detail['domain'],
      'the multiclass class and domain match the advancement that granted them',
      `sheet ${String(c.multiclassRef)}/${String(c.multiclassDomain)}, history ${String(first.detail['classRef'])}/${String(first.detail['domain'])}`,
    );
    expect(
      tierOf(first.level) >= 3,
      'multiclassing never happens before level 5',
      `taken at level ${first.level}`,
    );
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Running the matrix
// ---------------------------------------------------------------------------

export interface Coverage {
  subclasses: Set<Ref>;
  ancestries: Set<Ref>;
  communities: Set<Ref>;
  classes: Set<Ref>;
  domains: Set<DomainId>;
  levels: Set<number>;
  cards: Set<Ref>;
  weapons: Set<Ref>;
  armors: Set<Ref>;
  items: Set<Ref>;
  advancements: Set<string>;
  multiclasses: Set<Ref>;
  unarmored: number;
  scarred: number;
}

const emptyCoverage = (): Coverage => ({
  subclasses: new Set(),
  ancestries: new Set(),
  communities: new Set(),
  classes: new Set(),
  domains: new Set(),
  levels: new Set(),
  cards: new Set(),
  weapons: new Set(),
  armors: new Set(),
  items: new Set(),
  advancements: new Set(),
  multiclasses: new Set(),
  unarmored: 0,
  scarred: 0,
});

function record(cov: Coverage, built: Built, ds: Dataset, ix: DatasetIndex): void {
  const c = built.character;
  cov.subclasses.add(built.coord.subclass);
  for (const r of c.ancestryRefs) cov.ancestries.add(r);
  if (c.communityRef) cov.communities.add(c.communityRef);
  cov.classes.add(c.classRef);
  cov.levels.add(c.level);
  for (const r of [...c.loadout, ...c.vault]) {
    cov.cards.add(r);
    const card = ix.cards.get(r);
    if (card) cov.domains.add(card.domain);
  }
  for (const r of built.touched.weapons) cov.weapons.add(r);
  for (const r of built.touched.armors) cov.armors.add(r);
  for (const r of built.touched.items) cov.items.add(r);
  for (const a of built.touched.advancements) cov.advancements.add(a);
  for (const m of built.touched.multiclasses) cov.multiclasses.add(m);
  if (c.activeArmor === null) cov.unarmored += 1;
  if (c.scars.length > 0) cov.scarred += 1;
  void ds;
}

export interface Report {
  built: number;
  failures: Failure[];
  coverage: Coverage;
  ms: number;
}

export function run(
  coords: Coord[],
  ds: Dataset = dataset,
  ix: DatasetIndex = index,
  onBuilt?: (built: Built) => void,
): Report {
  const started = Date.now();
  const failures: Failure[] = [];
  const coverage = emptyCoverage();
  let built = 0;

  for (const coord of coords) {
    try {
      const one = build(coord, ds, ix);
      built += 1;
      record(coverage, one, ds, ix);
      failures.push(...check(one, ds, ix));
      onBuilt?.(one);
    } catch (err) {
      failures.push({
        coord,
        assertion: 'the character can be built by playing it up from level 1',
        detail:
          err instanceof IllegalPlanError
            ? `the engine refused the plan the simulator chose at level ${err.level}: ${err.errors.join(' | ')}\n` +
              `        plan ${JSON.stringify(err.plan)}`
            : String(err instanceof Error ? err.stack ?? err.message : err),
      });
    }
  }

  return { built, failures, coverage, ms: Date.now() - started };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function describeCharacter(c: Character, ix: DatasetIndex): string {
  const stats = deriveStats(c, dataset, ix);
  const lines = [
    `level ${c.level} ${c.classRef} · ${c.subclassRefs.join(' + ')} · ${c.ancestryRefs.join(' + ')} · ${String(c.communityRef)}`,
    `traits ${TRAITS.map((t) => `${t.slice(0, 3)} ${c.traits[t] >= 0 ? '+' : ''}${c.traits[t]}`).join(' ')}`,
    `evasion ${stats.evasion} · proficiency ${stats.proficiency} · thresholds ${stats.thresholds.join('/')} · armor ${stats.armorScore}`,
    `hp ${c.hp.marked}/${c.hp.max} · stress ${c.stress.marked}/${c.stress.max} · hope ${c.hope.marked}/${c.hope.max} · scars ${c.scars.length}`,
    `weapons ${String(c.activePrimaryWeapon)} + ${String(c.activeSecondaryWeapon)} · armor ${String(c.activeArmor)}`,
    `loadout ${c.loadout.join(', ') || 'empty'}`,
    `vault ${c.vault.join(', ') || 'empty'}`,
    `history ${c.levelUpHistory.map((h) => `L${h.level}:${String(h.detail['optionId'])}@${String(h.detail['optionTier'])}`).join(' ')}`,
  ];
  return lines.map((l) => `        ${l}`).join('\n');
}

const reproduce = (coord: Coord): string =>
  `npx tsx tools/simulate.ts --subclass ${coord.subclass} --ancestry ${coord.ancestry} --level ${coord.level} --dump`;

export function formatFailure(f: Failure): string {
  return [
    `  FAIL  ${coordLabel(f.coord)}`,
    `        ${f.assertion}`,
    `        ${f.detail}`,
    `        reproduce: ${reproduce(f.coord)}`,
  ].join('\n');
}

const bar = (label: string, got: number, want: number): string => {
  const flag = got === want ? ' ' : '!';
  return `  ${flag} ${label.padEnd(14)} ${String(got).padStart(4)} / ${String(want).padEnd(4)}`;
};

export function formatReport(report: Report, ds: Dataset = dataset): string {
  const c = report.coverage;
  const lines: string[] = [];

  for (const f of report.failures.slice(0, 40)) lines.push(formatFailure(f), '');
  if (report.failures.length > 40) {
    lines.push(`  ... and ${report.failures.length - 40} more failures`, '');
  }

  lines.push('  Coverage');
  lines.push(bar('subclasses', c.subclasses.size, ds.subclasses.length));
  lines.push(bar('ancestries', c.ancestries.size, ds.ancestries.length));
  lines.push(bar('communities', c.communities.size, ds.communities.length));
  lines.push(bar('classes', c.classes.size, ds.classes.length));
  lines.push(bar('domains', c.domains.size, ds.domains.length));
  lines.push(bar('levels', c.levels.size, MAX_LEVEL));
  lines.push(bar('domain cards', c.cards.size, ds.domainCards.length));
  lines.push(bar('weapons', c.weapons.size, ds.weapons.length));
  lines.push(bar('armors', c.armors.size, ds.armors.length));
  lines.push(bar('loot/consumables', c.items.size, ds.loot.length + ds.consumables.length));
  lines.push(bar('advancements', c.advancements.size, availableOptions(4).length));
  lines.push(bar('multiclasses', c.multiclasses.size, ds.classes.length));
  lines.push(`    ${'unarmored'.padEnd(14)} ${String(c.unarmored).padStart(4)} characters`);
  lines.push(`    ${'scarred'.padEnd(14)} ${String(c.scarred).padStart(4)} characters`);
  lines.push('');
  lines.push(
    `  ${report.built} characters built, ${report.failures.length} failure(s), ` +
      `${(report.ms / 1000).toFixed(1)}s`,
  );
  return lines.join('\n');
}

/** Every collection the matrix promises to touch, with what it actually did. */
export function coverageGaps(report: Report, ds: Dataset = dataset): string[] {
  const c = report.coverage;
  const gaps: string[] = [];
  const missing = <T>(label: string, got: ReadonlySet<Ref>, all: Array<{ id: Ref }> | T[]): void => {
    const ids = (all as Array<{ id: Ref }>).map((x) => x.id).filter((id) => !got.has(id));
    if (ids.length > 0) gaps.push(`${label}: ${ids.join(', ')}`);
  };
  missing('subclasses never built', c.subclasses, ds.subclasses);
  missing('ancestries never built', c.ancestries, ds.ancestries);
  missing('communities never chosen', c.communities, ds.communities);
  missing('cards never taken', c.cards, ds.domainCards);
  missing('weapons never equipped', c.weapons, ds.weapons);
  missing('armors never worn', c.armors, ds.armors);
  return gaps;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(argv: string[]): void {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (name: string): boolean => argv.includes(name);

  if (has('--help')) {
    console.log(
      [
        'Play every subclass x ancestry x level up from level 1 and check the engine against itself.',
        '',
        '  npx tsx tools/simulate.ts                     the full matrix',
        '  npx tsx tools/simulate.ts --level 7           one level',
        '  npx tsx tools/simulate.ts --subclass syndicate --ancestry faun --level 7 --dump',
        '',
        '  --subclass ID   --ancestry ID   --level N   --limit N',
        '  --dump          print the built sheets',
        '  --trace         print the level-up path',
        '  --gaps          list what the run never touched',
      ].join('\n'),
    );
    return;
  }

  const subclass = flag('--subclass');
  const ancestry = flag('--ancestry');
  const level = flag('--level');
  const limit = flag('--limit');

  let coords = matrix(dataset);
  if (subclass !== undefined) coords = coords.filter((c) => c.subclass === subclass);
  if (ancestry !== undefined) coords = coords.filter((c) => c.ancestry === ancestry);
  if (level !== undefined) coords = coords.filter((c) => c.level === Number(level));
  if (limit !== undefined) coords = coords.slice(0, Number(limit));

  if (coords.length === 0) {
    console.error('  No coordinates match. Check --subclass and --ancestry against the dataset.');
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n  Daggerheart matrix · ${dataset.revision}\n` +
      `  ${dataset.subclasses.length} subclasses × ${dataset.ancestries.length} ancestries × ${MAX_LEVEL} levels` +
      ` · running ${coords.length}\n`,
  );

  const dump = has('--dump');
  const trace = has('--trace');
  const report = run(coords, dataset, index, (built) => {
    if (dump) {
      console.log(`  ${coordLabel(built.coord)}`);
      console.log(describeCharacter(built.character, index));
    }
    if (trace) for (const line of built.trace) console.log(`        ${line}`);
    if (dump || trace) console.log('');
  });

  console.log(formatReport(report, dataset));

  if (has('--gaps')) {
    const gaps = coverageGaps(report, dataset);
    console.log('');
    for (const g of gaps) console.log(`  gap  ${g}`);
    if (gaps.length === 0) console.log('  no gaps: every subclass, ancestry, community, card, weapon and armor was touched');
  }

  if (report.failures.length > 0) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main(process.argv.slice(2));
}
