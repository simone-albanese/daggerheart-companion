/**
 * A cross-section of the game, built the way the app builds one character.
 *
 *   npx tsx tools/sampleCharacters.ts        # print the matrix
 *
 * The transfer layer carries months of somebody's play between their own
 * devices, so proving it on one wizard proves it on one wizard. This walks all
 * nine classes up all ten levels through the real path - `newCharacter`, then
 * `availableOptions` / `validatePlan` / `applyLevelUp` a level at a time, then
 * `recallCard` to fill the loadout - and hangs on each sheet the fields a
 * fixture usually forgets: a companion, an active Beastform, scars, inventory
 * notes, connections, references a device could not name, and free text in
 * scripts that are not ASCII.
 *
 * Nothing is invented: every ref comes out of `data/srd-1.0.json`, so a size
 * measured here is a size somebody's phone will really have to send.
 *
 * Deterministic on purpose. Ids, timestamps and every choice are functions of
 * the row index, so a byte count printed today means the same thing tomorrow
 * and a failure can be reproduced by name.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TRAITS,
  type Character,
  type Dataset,
  type DomainCard,
  type DomainId,
  type InventoryEntry,
  type Ref,
  type Tier,
  type Trait,
} from '../shared/types.ts';
import {
  deriveStats,
  indexDataset,
  newCharacter,
  syncCounters,
  tierOf,
  type DatasetIndex,
} from '../src/engine/character.ts';
import {
  applyLevelUp,
  availableOptions,
  tierAchievementFor,
  validatePlan,
  type LevelUpPlan,
} from '../src/engine/levelUp.ts';
import { recallCard } from '../src/engine/loadout.ts';
import { newCompanion } from '../src/engine/companion.ts';
import { beastformOptions } from '../src/engine/beastform.ts';

export const SRD_PATH = fileURLToPath(new URL('../data/srd-1.0.json', import.meta.url));

export const hasDataset = (): boolean => existsSync(SRD_PATH);

export const loadDataset = (): Dataset => JSON.parse(readFileSync(SRD_PATH, 'utf8')) as Dataset;

export interface Sample {
  /** Reads like a row: `wizard L7 · multiclass · beastform`. */
  label: string;
  character: Character;
  /** What this row is here to exercise, for the reports. */
  exercises: string[];
}

// ---------------------------------------------------------------------------
// Free text
//
// Real sheets are not ASCII and are not short. Everything below is text a
// player would actually type: accents, CJK, Cyrillic, Arabic, an em dash, a
// combining mark, a ZWJ emoji. None of it is any slug in the dataset, so the
// degraded-import test can search for a ref without hitting prose.
// ---------------------------------------------------------------------------

const NAMES = [
  'Kaelith',
  'Ríoghnach',
  '鈴木ハル',
  'Zaïd al-Ḥakīm',
  'Þóra Ashgrove',
  'Оксана Вовк',
  'Māui-tikitiki',
  'Brônwyn Ó Súilleabháin',
  'Ниса',
  'Amaré Ọlá',
  '林小雨',
  'Ñico',
];

const PRONOUNS = ['she/her', 'they/them', 'he/him', 'ze/hir', 'she/they', '', 'e/em', 'he/they'];

const NOTES = [
  '',
  'Owes the Knife a debt. Do not mention the tower.',
  'Sigil: ✶ — "a door, not a wall". Sworn at the gate before the second bell. 🜁',
  '日本語のメモ：三日目、橋は落ちた。次は北へ。',
  'الوعد قُطع عند الفجر، ولم يعد أحد.',
  'Bräunlich still writes. Every letter says the same thing and I keep them all.',
  'The tower burned in the spring — ashes still, and something under them that hums.',
  'Family: 👩‍👩‍👧‍👦 all of them south of the river. None of them know what I do.',
];

const CONNECTIONS = [
  'Oriel taught me to read the old script',
  'I owe the Knife a debt I cannot name',
  '彼女は私の命を救った — 二度',
  'Ты был там, когда никого не было',
  'We buried the same person and told two different stories about it',
  'They still call me by the name I left',
];

const SCARS = [
  'A hand that will not stop shaking',
  'Frostbite — two fingers',
  '声が半分だけ残った',
  'A white stripe through the hair, from the night at the ford',
];

const ITEM_NOTES: Array<string | undefined> = [
  undefined,
  '',
  'Given by Oriel',
  'Not for sale — ever',
  '母の指輪',
  'Cracked. Still works.',
];

const FREE_ITEMS = [
  "Mother's ring",
  'A letter, unopened',
  'Half a map',
  'Bird skull',
  'Три монеты',
  'The other boot',
];

const COMPANION_NAMES = ['Ash', 'Vörös', 'クロ', 'Bramble', 'Nightjar'];
const COMPANION_KINDS = [
  'A one-eyed raven',
  'A wolfhound with a grey muzzle',
  'Un lince de montaña, muy poco impresionado',
  'A river otter that steals things',
];

/** The Beastbound Ranger's eight sheet options, by slug. */
const COMPANION_UPGRADE_IDS = [
  'intelligent',
  'light-in-the-dark',
  'creature-comfort',
  'armored',
  'vicious',
  'resilient',
  'bonded',
  'aware',
];

const EXPERIENCE_NAMES = [
  'Bookish',
  'Silver Tongue',
  'Astronomer',
  'Ex-Smuggler',
  '山で育った',
  'Reads a room',
  'Never forgets a face',
  'Sailor’s hands',
];

const TASTES: Record<string, readonly string[]> = {
  // The order a player reaches for advancements in. Each taste is a different
  // route through the same table, which is what spreads the matrix out.
  scholar: ['domain-card', 'experience', 'traits', 'evasion', 'subclass', 'hit-point', 'stress'],
  brawler: ['hit-point', 'stress', 'proficiency', 'traits', 'evasion', 'domain-card'],
  wanderer: ['multiclass', 'traits', 'domain-card', 'evasion', 'stress', 'hit-point'],
  duelist: ['proficiency', 'traits', 'evasion', 'subclass', 'domain-card', 'hit-point'],
  // Takes the specialization card the moment tier 3 offers it, which also
  // crosses this tier's multiclass option out.
  devotee: ['subclass', 'traits', 'experience', 'evasion', 'domain-card', 'stress'],
};

const TASTE_NAMES = Object.keys(TASTES);

/** Level 1 trait array from the SRD: +2, +1, +1, +0, +0, -1. */
const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1];

const pick = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length]!;

/** UUID-shaped and stable, so two runs produce the same bytes. */
const idFor = (n: number): string => `a1c7ed00-0000-4000-8000-${String(n).padStart(12, '0')}`;

const whenFor = (n: number, hour: number): string =>
  new Date(Date.UTC(2026, 0, 1 + (n % 300), hour, (n * 7) % 60, 0)).toISOString();

// ---------------------------------------------------------------------------
// Levelling, through the real path
// ---------------------------------------------------------------------------

interface PlanContext {
  ds: Dataset;
  ix: DatasetIndex;
  taste: readonly string[];
}

/** Cards this character may take: their domains, at or under their cap. */
function eligibleCards(c: Character, ctx: PlanContext, taken: Set<Ref>): DomainCard[] {
  const stats = deriveStats(c, ctx.ds, ctx.ix);
  const owned = new Set<Ref>([...c.loadout, ...c.vault, ...taken]);
  return ctx.ds.domainCards
    .filter(
      (card) =>
        stats.domains.includes(card.domain) &&
        card.level <= stats.cardLevelCap(card.domain) &&
        !owned.has(card.id),
    )
    .sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));
}

/** The best card on offer, varied a little so nine wizards are not one wizard. */
function nextCard(c: Character, ctx: PlanContext, taken: Set<Ref>): Ref | null {
  const cards = eligibleCards(c, ctx, taken);
  if (cards.length === 0) return null;
  const card = cards[(c.level * 3 + taken.size) % Math.min(4, cards.length)]!;
  taken.add(card.id);
  return card.id;
}

function unmarkedTraits(c: Character, cleared: boolean, taken: Set<Trait>): Trait[] {
  const marks = cleared ? {} : c.traitMarks;
  return TRAITS.filter((t) => (marks[t] ?? 0) === 0 && !taken.has(t));
}

/** Another class to multiclass into, with one of its domains and a subclass. */
function multiclassDetail(c: Character, ctx: PlanContext): Record<string, unknown> | null {
  const own = new Set([c.classRef, c.multiclassRef]);
  const klass = ctx.ds.classes.filter((k) => !own.has(k.id))[(c.level * 5) % 8];
  if (klass === undefined) return null;
  const stats = deriveStats(c, ctx.ds, ctx.ix);
  const domain: DomainId | undefined = klass.domains.find((d) => !stats.domains.includes(d));
  const subclassRef = klass.subclasses[c.level % klass.subclasses.length];
  if (domain === undefined || subclassRef === undefined) return null;
  return { classRef: klass.id, domain, subclassRef };
}

interface Taken {
  cards: Set<Ref>;
  traits: Set<Trait>;
}

function detailFor(
  optionId: string,
  c: Character,
  ctx: PlanContext,
  taken: Taken,
  clearsMarks: boolean,
): Record<string, unknown> | null {
  switch (optionId) {
    case 'traits': {
      const free = unmarkedTraits(c, clearsMarks, taken.traits);
      const chosen = [free[(c.level * 2) % Math.max(1, free.length)], free[0]]
        .filter((t): t is Trait => t !== undefined)
        .filter((t, i, all) => all.indexOf(t) === i);
      const pair = chosen.length === 2 ? chosen : free.slice(0, 2);
      if (pair.length !== 2) return null;
      pair.forEach((t) => taken.traits.add(t));
      return { traits: pair };
    }
    case 'experience': {
      if (c.experiences.length < 2) return null;
      const ids = [
        c.experiences[c.level % c.experiences.length]!.id,
        c.experiences[(c.level + 1) % c.experiences.length]!.id,
      ];
      return { experiences: [...new Set(ids)] };
    }
    case 'domain-card': {
      const ref = nextCard(c, ctx, taken.cards);
      return ref === null ? null : { cardRef: ref };
    }
    case 'subclass': {
      const ref = c.subclassRefs[0];
      return ref === undefined ? null : { subclassRef: ref };
    }
    case 'multiclass':
      return multiclassDetail(c, ctx);
    default:
      return {};
  }
}

/**
 * The first plan this character's taste finds that `validatePlan` accepts.
 *
 * The search is over the real option table and the real validator, so a plan
 * that comes out of here is one the app would have let somebody build.
 */
function planFor(c: Character, ctx: PlanContext): LevelUpPlan {
  const toLevel = c.level + 1;
  const tier = tierOf(toLevel);
  const achievement = tierAchievementFor(toLevel);
  const clearsMarks = achievement?.clearTraitMarks === true;

  const rank = (id: string): number => {
    const at = ctx.taste.indexOf(id);
    return at < 0 ? ctx.taste.length : at;
  };
  const options = [...availableOptions(tier)].sort(
    (a, b) => rank(a.id) - rank(b.id) || b.tier - a.tier,
  );

  const attempt = (combo: typeof options): LevelUpPlan | null => {
    const taken: Taken = { cards: new Set(), traits: new Set() };
    const picks: LevelUpPlan['picks'] = [];
    for (const option of combo) {
      const detail = detailFor(option.id, c, ctx, taken, clearsMarks);
      if (detail === null) return null;
      picks.push({ optionId: option.id, optionTier: option.tier, detail });
    }
    if (achievement !== null && picks[0] !== undefined) {
      // `applyLevelUp` reads the new Experience's name off the first pick.
      picks[0].detail['achievementExperience'] = pick(EXPERIENCE_NAMES, toLevel + c.name.length);
    }
    const plan: LevelUpPlan = {
      fromLevel: c.level,
      toLevel,
      tier,
      achievement,
      picks,
      newCardRef: nextCard(c, ctx, taken.cards),
    };
    return validatePlan(c, plan).ok ? plan : null;
  };

  for (const first of options) {
    if (first.costsBothPicks) {
      const one = attempt([first]);
      if (one !== null) return one;
      continue;
    }
    for (const second of options) {
      if (second.costsBothPicks) continue;
      const two = attempt([first, second]);
      if (two !== null) return two;
    }
  }
  throw new Error(
    `No valid level-up plan for ${c.classRef} going to level ${toLevel}. ` +
      `Either the option table changed or the sampler needs to know about it.`,
  );
}

// ---------------------------------------------------------------------------
// Building one character
// ---------------------------------------------------------------------------

export interface BuildOptions {
  classRef: Ref;
  level: number;
  /** Row index: everything cosmetic is a function of it. */
  index: number;
  ds: Dataset;
  ix: DatasetIndex;
}

const gearFor = (ds: Dataset, tier: Tier, n: number) => {
  const primaries = ds.weapons.filter((w) => w.slot === 'primary' && w.tier === tier);
  const secondaries = ds.weapons.filter((w) => w.slot === 'secondary' && w.tier === tier);
  const armors = ds.armors.filter((a) => a.tier === tier);
  return {
    primary: pick(primaries, n * 7).id,
    secondary: n % 3 === 0 ? null : pick(secondaries, n * 3).id,
    armor: pick(armors, n * 5).id,
  };
};

function startingInventory(ds: Dataset, klassItems: readonly string[], n: number): InventoryEntry[] {
  const loot = pick(ds.loot, n * 11);
  const consumable = pick(ds.consumables, n * 13);
  const entries: InventoryEntry[] = [
    { ref: null, name: 'Torch', quantity: 1 },
    { ref: null, name: 'Rations', quantity: 3 },
  ];
  for (const [i, item] of klassItems.entries()) {
    const note = pick(ITEM_NOTES, n + i);
    entries.push(
      note === undefined
        ? { ref: null, name: item, quantity: 1 }
        : { ref: null, name: item, quantity: 1, note },
    );
  }
  entries.push({ ref: consumable.id, name: consumable.name, quantity: 1 + (n % 3) });
  const lootNote = pick(ITEM_NOTES, n + 2);
  entries.push(
    lootNote === undefined
      ? { ref: loot.id, name: loot.name, quantity: 1 }
      : { ref: loot.id, name: loot.name, quantity: 1, note: lootNote },
  );
  entries.push({ ref: null, name: pick(FREE_ITEMS, n), quantity: 1, note: pick(ITEM_NOTES, n + 4) ?? '' });
  return entries;
}

/** One row of the matrix: a class, a level, and the fields that class earns. */
export function buildCharacter(options: BuildOptions): Sample {
  const { classRef, level, index: n, ds, ix } = options;
  const klass = ds.classes.find((k) => k.id === classRef);
  if (klass === undefined) throw new Error(`No class "${classRef}" in the dataset.`);

  const exercises: string[] = [];
  const tier = tierOf(level);
  const gear = gearFor(ds, tier, n);
  const subclass = pick(klass.subclasses, n);
  const ancestries = n % 4 === 0 ? [pick(ds.ancestries, n).id, pick(ds.ancestries, n + 5).id] : [pick(ds.ancestries, n).id];
  if (ancestries.length === 2) exercises.push('mixed ancestry');

  const traits = {} as Record<Trait, number>;
  TRAIT_ARRAY.forEach((value, i) => {
    traits[pick(TRAITS, i + n)] = value;
  });

  let c = newCharacter({
    id: idFor(n),
    name: pick(NAMES, n),
    pronouns: pick(PRONOUNS, n),
    classRef,
    subclassRefs: [subclass],
    ancestryRefs: ancestries,
    communityRef: pick(ds.communities, n * 3).id,
    traits,
    activePrimaryWeapon: gear.primary,
    activeSecondaryWeapon: gear.secondary,
    activeArmor: gear.armor,
    inventory: startingInventory(ds, klass.classItems, n),
    experiences: [
      { id: idFor(1000 + n * 2), name: pick(EXPERIENCE_NAMES, n), bonus: 2 },
      { id: idFor(1001 + n * 2), name: pick(EXPERIENCE_NAMES, n + 3), bonus: 2 },
    ],
    gold: { handfuls: n % 10, bags: n % 5, chests: n % 3 },
    createdAt: whenFor(n, 9),
    updatedAt: whenFor(n, 21),
  });

  // Two level 1 domain cards from the class's own domains, as the sheet starts.
  const starting = eligibleCards(c, { ds, ix, taste: [] }, new Set())
    .filter((card) => card.level === 1)
    .slice(0, 2);
  c = { ...c, vault: starting.map((card) => card.id) };

  const ctx: PlanContext = { ds, ix, taste: TASTES[pick(TASTE_NAMES, n)]! };
  for (let at = c.level; at < level; at += 1) {
    c = applyLevelUp(c, planFor(c, ctx));
  }
  if (level > 1) exercises.push(`${c.levelUpHistory.length} advancements`);
  if (c.multiclassRef !== null) exercises.push(`multiclass ${c.multiclassRef}/${c.multiclassDomain}`);

  // Fill the loadout out of the vault the way a player does, in downtime.
  for (const ref of [...c.vault]) {
    if (c.loadout.length >= 5) break;
    const card = ix.cards.get(ref);
    if (card !== undefined) c = recallCard(c, card, { downtime: true }).character;
  }

  c = decorate(c, { ds, ix, index: n, exercises });

  const stats = deriveStats(c, ds, ix);
  c = syncCounters(c, stats);
  c = {
    ...c,
    hp: { ...c.hp, marked: Math.min(n % 4, c.hp.max) },
    stress: { ...c.stress, marked: Math.min(n % 5, c.stress.max) },
    hope: { ...c.hope, marked: Math.min(3 + (n % 3), c.hope.max) },
    armorSlots: { ...c.armorSlots, marked: Math.min(n % 3, c.armorSlots.max) },
    updatedAt: whenFor(n, 21),
  };

  const label = [`${classRef} L${level}`, ...exercises].join(' · ');
  return { label, character: c, exercises };
}

/** The fields a fixture forgets. Hung on by row index so coverage is spread. */
function decorate(
  c: Character,
  options: { ds: Dataset; ix: DatasetIndex; index: number; exercises: string[] },
): Character {
  const { ds, ix, index: n, exercises } = options;
  let next = c;

  const notes = pick(NOTES, n);
  if (notes !== '') exercises.push('notes');
  const connectionCount = n % 4;
  const connections = Array.from({ length: connectionCount }, (_u, i) => pick(CONNECTIONS, n + i));
  if (connectionCount > 0) exercises.push(`${connectionCount} connections`);

  const scarCount = next.level >= 5 ? n % 3 : n % 2;
  const scars = Array.from({ length: scarCount }, (_u, i) => pick(SCARS, n + i * 2));
  if (scarCount > 0) exercises.push(`${scarCount} scars`);

  next = { ...next, notes, connections, scars };

  if (n % 5 === 0) {
    next = { ...next, evasionOverride: 10 + (n % 6), thresholdOverride: [8 + n % 7, 17 + (n % 9)] };
    exercises.push('overrides');
  }

  // A companion belongs to the subclass that grants one; a Beastform to the
  // class that transforms. Neither is decoration - both are somebody's sheet.
  if (next.subclassRefs.includes('beastbound')) {
    const companion = newCompanion(pick(COMPANION_NAMES, n), pick(COMPANION_KINDS, n));
    next = {
      ...next,
      companion: {
        ...companion,
        evasion: 10 + (n % 4),
        stress: { marked: n % 3, max: 3 + (n % 2) },
        damage: pick(['d6', 'd8', 'd6+2'], n),
        range: pick(['Melee', 'Very Close', 'Close', 'Far'] as const, n),
        experiences: companion.experiences.map((e, i) => ({
          ...e,
          name: pick(['Tracks by scent', 'Fearless', '影に強い'], n + i),
          bonus: 2 + i,
        })),
        upgrades: COMPANION_UPGRADE_IDS.slice(0, 1 + (n % 4)),
      },
    };
    exercises.push('companion');
  }

  const transforms =
    ix.classes.get(next.classRef)?.classFeatures.some((f) => f.name === 'Beastform') === true;
  const forms = transforms ? beastformOptions(next.level, ds) : [];
  if (forms.length > 0 && n % 2 === 0) {
    const form = pick(forms, n);
    next = { ...next, beastform: { ref: form.id, activatedAt: whenFor(n, 22) } };
    exercises.push(`beastform ${form.id}`);
  }

  return next;
}

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

/**
 * Every class at every level, plus three rows no class produces on its own:
 * a sheet nobody has filled in yet, a sheet somebody writes their journal on,
 * and a sheet that came from a device holding content this build has never
 * heard of.
 */
export function sampleMatrix(ds: Dataset = loadDataset()): Sample[] {
  const ix = indexDataset(ds);
  const samples: Sample[] = [];
  let n = 0;

  for (const klass of ds.classes) {
    for (let level = 1; level <= 10; level += 1) {
      samples.push(buildCharacter({ classRef: klass.id, level, index: n, ds, ix }));
      n += 1;
    }
  }

  samples.push(blankSheet());
  samples.push(journal(ds, ix, n + 1));
  samples.push(fromANewerDevice(ds, ix, n + 2));
  return samples;
}

/** Character creation, step one, before anything has been chosen. */
function blankSheet(): Sample {
  const c = newCharacter({
    id: idFor(9001),
    createdAt: whenFor(9001, 8),
    updatedAt: whenFor(9001, 8),
  });
  return { label: 'blank sheet', character: c, exercises: ['nothing chosen yet'] };
}

/** The player who keeps the campaign journal in the notes field. */
function journal(ds: Dataset, ix: DatasetIndex, n: number): Sample {
  const base = buildCharacter({ classRef: 'bard', level: 10, index: n, ds, ix });
  const entries = [
    'Day 1 — the road out of Hush was quiet and I did not trust it.',
    '三日目：橋が落ちた。荷は失った、人は失っていない。',
    'Day 9 — Oriel says the script is older than the tower. I believe her, which is the problem.',
    'يوم ١٢: لم يعد أحد من الوادي.',
    'Day 20 — bought a second lute. Do not tell anyone what it cost. ✶',
    'Day 31 — we found the door. It was not a door.',
  ];
  const character: Character = {
    ...base.character,
    notes: entries.join('\n\n'),
    connections: CONNECTIONS,
    scars: SCARS.slice(0, 2),
    inventory: [
      ...base.character.inventory,
      ...ds.consumables.slice(0, 6).map((item, i) => ({
        ref: item.id,
        name: item.name,
        quantity: 1 + i,
        note: `Bought in ${pick(['Hush', 'Ardenmoor', '港町'], i)}`,
      })),
    ],
  };
  return {
    label: 'bard L10 · journal',
    character,
    exercises: ['long free text', 'six connections', 'large inventory'],
  };
}

/**
 * A sheet that arrived from a device with content this build does not have.
 * The parked ids are in the reserved range, which no build of this app can
 * ever name - the one case the codec must not resolve by guessing.
 */
function fromANewerDevice(ds: Dataset, ix: DatasetIndex, n: number): Sample {
  const base = buildCharacter({ classRef: 'sorcerer', level: 6, index: n, ds, ix });
  const inLoadout = 60_007;
  const inVault = 60_211;
  const character: Character = {
    ...base.character,
    loadout: [`?${inLoadout}`, ...base.character.loadout.slice(1)],
    vault: [...base.character.vault, `?${inVault}`],
    unresolvedRefs: [inLoadout, inVault],
  };
  return {
    label: 'sorcerer L6 · parked references',
    character,
    exercises: ['unresolved refs forwarded'],
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  if (!hasDataset()) {
    console.error(`data/srd-1.0.json not found. Build it first:\n  npm run build:srd`);
    process.exitCode = 1;
    return;
  }
  const samples = sampleMatrix();
  const json = (c: Character): number => new TextEncoder().encode(JSON.stringify(c)).length;
  for (const s of samples) {
    console.log(
      `${s.label.padEnd(64)} ${String(json(s.character)).padStart(6)} bytes of JSON  ` +
        `${s.character.loadout.length}+${s.character.vault.length} cards  ` +
        `${s.character.levelUpHistory.length} advancements`,
    );
  }
  console.log(`\n${samples.length} characters`);
}

// Only when run as a script: the tests import the matrix from here.
const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) main();
