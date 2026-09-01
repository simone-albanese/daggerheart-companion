/**
 * The character the architecture measures: a level 5 wizard with five cards in
 * the loadout, six in the vault and three Experiences.
 *
 * Every slug here is a real one from `data/registry.json`, so the sizes these
 * tests print are the sizes a real sheet takes on the wire.
 */
import { SCHEMA_VERSION, type Character, type LevelUpChoice } from '../../shared/types.ts';
import {
  createRegistry,
  parseRegistryKey,
  registry,
  REGISTRY_VERSION,
  type Registry,
} from '../../src/transfer/registry.ts';
import type { SlugSource } from '../../tools/buildRegistry.ts';

// ---------------------------------------------------------------------------
// Measuring a transfer
//
// `matrix.test.ts` and `fullMatrix.test.ts` both weigh payloads and both
// reassemble frames out of order, over a 93-row cross-section and over all
// 3240 respectively. They shared these four helpers by copy until the numbers
// they print were reconciled; they share them by import now, so that a byte
// counted in one file is a byte counted the same way in the other.
// ---------------------------------------------------------------------------

const utf8 = new TextEncoder();

/** Bytes on the wire, not UTF-16 code units: `é` is two, an emoji is four. */
export const bytesOf = (s: string): number => utf8.encode(s).length;

/** Every word this character's player typed. What a QR mostly carries. */
export function freeTextBytes(c: Character): number {
  const parts = [
    c.name,
    c.pronouns,
    c.notes,
    ...c.connections,
    ...c.scars,
    ...c.experiences.map((e) => e.name),
    ...c.inventory.flatMap((e) => [e.name, e.note ?? '']),
    ...(c.companion === null
      ? []
      : [c.companion.name, c.companion.description, ...c.companion.experiences.map((e) => e.name)]),
  ];
  return parts.reduce((n, s) => n + bytesOf(s), 0);
}

/**
 * A deterministic shuffle, for handing frames to the collector in the order a
 * camera really sees them. Seeded so a reassembly failure can be replayed.
 */
export const shuffled = <T>(items: T[], seed: number): T[] => {
  const out = [...items];
  let n = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    n = (n * 1103515245 + 12345) % 2147483648;
    const j = n % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/** Nearest-rank percentile over an already-sorted array. */
export const percentile = (sorted: number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

/** The committed registry: what a device actually has. */
export const testRegistry: Registry = registry;

/**
 * The same registry minus a few entries: a device with older content.
 *
 * Takes BARE slugs, because that is what a caller has: a `Character` field
 * holds `'rune-ward'` and nothing else. Since version 2 the registry file is
 * keyed by `collection/slug`, so removing "the content named X" means removing
 * every row whose slug is X - which is also the right meaning, a device that
 * has not got a card has not got it under any collection.
 */
export function registryWithout(...slugs: string[]): Registry {
  const gone = new Set(slugs);
  const ids: Record<string, number> = {};
  for (const [key, id] of registry.entries()) {
    if (!gone.has(parseRegistryKey(key)?.slug ?? key)) ids[key] = id;
  }
  return createRegistry({ version: REGISTRY_VERSION, ids });
}

/** A small invented dataset for the id-allocation tests, which need no SRD. */
export const SOURCE: SlugSource = {
  classes: [{ id: 'wizard' }, { id: 'sorcerer' }, { id: 'bard' }],
  subclasses: [{ id: 'school-of-knowledge' }, { id: 'school-of-war' }, { id: 'primal-origin' }],
  ancestries: [{ id: 'elf' }, { id: 'human' }, { id: 'clank' }],
  communities: [{ id: 'loreborne' }, { id: 'highborne' }],
  domainCards: [
    { id: 'book-of-ava', domain: 'codex' },
    { id: 'teleport', domain: 'codex' },
    { id: 'bolt-beacon', domain: 'splendor' },
    { id: 'second-wind', domain: 'splendor' },
    { id: 'rune-ward', domain: 'arcana' },
    { id: 'unleash-chaos', domain: 'arcana' },
  ],
  beastforms: [{ id: 'nimble-grazer' }],
  weapons: [{ id: 'improved-wand' }, { id: 'dagger' }],
  armors: [{ id: 'chainmail-armor' }],
  loot: [{ id: 'arcane-cloak' }],
  consumables: [{ id: 'attune-potion' }],
  adversaries: [{ id: 'jagged-knife-lackey' }],
  environments: [{ id: 'abandoned-grove' }],
};

const advancement = (
  level: number,
  slot: number,
  kind: LevelUpChoice['kind'],
  optionId: string,
  detail: Record<string, unknown> = {},
): LevelUpChoice => ({
  level,
  slot,
  kind,
  detail: { ...detail, optionId, optionTier: level <= 4 ? 2 : 3 },
});

const EXPERIENCE_IDS = [
  '2f5a6d1c-0b2e-4c8a-9f31-5c7d1e2a3b40',
  '7c1b9e44-3a52-4f0d-8e19-6b2f4a8c0d51',
  'b3d80f27-91ac-4e6b-a7c5-2d4e8f1b6a92',
];

/** Levels 2 to 5, two advancements each - what a level 5 sheet really carries. */
const HISTORY: LevelUpChoice[] = [
  advancement(2, 0, 'trait', 'traits', { traits: ['knowledge', 'instinct'] }),
  advancement(2, 1, 'hitPoint', 'hit-point'),
  advancement(3, 0, 'domainCard', 'domain-card', { cardRef: 'teleport' }),
  advancement(3, 1, 'evasion', 'evasion'),
  advancement(4, 0, 'trait', 'traits', { traits: ['agility', 'finesse'] }),
  advancement(4, 1, 'stress', 'stress'),
  advancement(5, 0, 'subclass', 'subclass', { subclassRef: 'school-of-knowledge' }),
  advancement(5, 1, 'experience', 'experience', { experiences: [EXPERIENCE_IDS[0]!] }),
];

export function wizard(patch: Partial<Character> = {}): Character {
  return {
    id: 'd2a4e9b0-5c31-4f7a-8b6d-1e0c9f2a3b4c',
    schemaVersion: SCHEMA_VERSION,
    name: 'Kaelith',
    pronouns: 'she/her',

    classRef: 'wizard',
    subclassRefs: ['school-of-knowledge'],
    ancestryRefs: ['elf'],
    communityRef: 'loreborne',
    // `null`, because the registry this fixture measures against is the
    // committed one and SRD 1.0 prints no transformations. A sheet holding one
    // is `tests/transformations.test.ts`'s to build, against a registry that
    // has the band.
    transformationRef: null,
    multiclassRef: null,
    multiclassDomain: null,

    level: 5,
    traits: { agility: 1, strength: 0, finesse: 1, instinct: 2, presence: -1, knowledge: 3 },
    traitMarks: {},

    hp: { marked: 2, max: 7 },
    stress: { marked: 3, max: 7 },
    hope: { marked: 4, max: 6 },
    armorSlots: { marked: 1, max: 4 },

    evasionOverride: null,
    thresholdOverride: null,

    loadout: ['book-of-ava', 'mending-touch', 'bolt-beacon', 'book-of-korvax', 'second-wind'],
    vault: ['teleport', 'banish', 'shape-material', 'safe-haven', 'reassurance', 'manifest-wall'],

    activePrimaryWeapon: 'improved-wand',
    activeSecondaryWeapon: null,
    activeArmor: 'chainmail-armor',
    inventory: [],

    experiences: [
      { id: EXPERIENCE_IDS[0]!, name: 'Bookish', bonus: 3 },
      { id: EXPERIENCE_IDS[1]!, name: 'Silver Tongue', bonus: 2 },
      { id: EXPERIENCE_IDS[2]!, name: 'Astronomer', bonus: 2 },
    ],
    gold: { handfuls: 4, bags: 2, chests: 0 },
    connections: [],
    notes: '',

    levelUpHistory: HISTORY,
    companion: null,
    beastform: null,
    scars: [],
    consecutiveShortRests: 0,

    createdAt: '2026-02-14T19:05:00.000Z',
    updatedAt: '2026-08-15T21:30:00.000Z',
    ...patch,
  };
}

/** The same sheet with everything optional filled in, for round-trip coverage. */
export function loadedWizard(): Character {
  return wizard({
    pronouns: 'they/them',
    multiclassRef: 'sorcerer',
    multiclassDomain: 'arcana',
    subclassRefs: ['school-of-knowledge', 'primal-origin'],
    ancestryRefs: ['elf', 'human'],
    traitMarks: { knowledge: 1, instinct: 1 },
    evasionOverride: 13,
    thresholdOverride: [14, 25],
    activeSecondaryWeapon: 'dagger',
    inventory: [
      { ref: 'attune-potion', name: 'Attune Potion', quantity: 2 },
      { ref: 'arcane-cloak', name: 'Arcane Cloak', quantity: 1, note: 'Given by Oriel' },
      { ref: null, name: "Mother's ring", quantity: 1, note: 'Not for sale' },
    ],
    connections: ['Oriel taught me to read the old script', 'I owe the Knife a debt'],
    notes: 'Looking for the second half of the Codex. The tower burned in the spring — ashes still.',
    scars: ['A hand that will not stop shaking'],
    beastform: { ref: 'nimble-grazer', activatedAt: '2026-08-15T20:00:00.000Z' },
    companion: {
      name: 'Ash',
      description: 'A one-eyed raven',
      evasion: 12,
      stress: { marked: 1, max: 3 },
      damage: 'd6+2',
      range: 'Close',
      // Physical, and deliberately so: the codec does not carry this field, so
      // a 'mag' here would make every round-trip assertion in the matrix fail
      // for a reason that has nothing to do with what it is testing. The loss
      // itself is pinned on its own, in codec.test.ts.
      damageType: 'phy',
      experiences: [{ id: 'c0ffee00-1111-4222-8333-444455556666', name: 'Sharp eyes', bonus: 2 }],
      upgrades: ['intelligent', 'light-in-the-dark'],
    },
  });
}

/**
 * Both sides of a round-trip, reduced to what the wire promises to carry.
 *
 * Experience ids are local handles the codec deliberately does not carry, so
 * they are replaced by their position - which is also the check that the
 * level-up records still point at the right one.
 *
 * `consecutiveShortRests` is the third documented loss (see the header of
 * `src/transfer/codec.ts` for why it stays off the wire), so it is zeroed on
 * both sides rather than compared. Zeroing it here rather than deleting it is
 * deliberate: a codec that stopped writing the *field* would still be caught,
 * because the decoded sheet would then be missing a key this one has.
 *
 * `companion.damageType` is the fourth, and it is flattened to `phy` on both
 * sides for exactly the same reason and in exactly the same shape. It arrived
 * with schema 5 and this function was not extended with it, which was harmless
 * only because the sample generator produced `phy` for every companion it made
 * - so the sweep agreed with the codec by accident rather than by contract.
 * The generator varies it now, and this is the line that says the difference is
 * a decision. `phy` and not deletion, again: a codec that stopped writing the
 * key at all is a different failure and has to stay visible.
 */
export function normalizeHandles(c: Character): unknown {
  const at = new Map(c.experiences.map((e, i) => [e.id, `experience#${i}`]));
  const companionAt = new Map(
    (c.companion?.experiences ?? []).map((e, i) => [e.id, `companion-experience#${i}`]),
  );
  const rename = (id: string): string => at.get(id) ?? companionAt.get(id) ?? id;

  return {
    ...c,
    consecutiveShortRests: 0,
    experiences: c.experiences.map((e) => ({ ...e, id: rename(e.id) })),
    companion:
      c.companion === null
        ? null
        : {
            ...c.companion,
            damageType: 'phy',
            experiences: c.companion.experiences.map((e) => ({ ...e, id: rename(e.id) })),
          },
    levelUpHistory: c.levelUpHistory.map((choice) => {
      const ids = choice.detail['experiences'];
      if (!Array.isArray(ids)) return choice;
      return {
        ...choice,
        detail: { ...choice.detail, experiences: ids.map((id) => rename(String(id))) },
      };
    }),
  };
}
