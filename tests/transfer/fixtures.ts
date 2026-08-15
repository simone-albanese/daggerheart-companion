/**
 * The character the architecture measures: a level 5 wizard with five cards in
 * the loadout, six in the vault and three Experiences.
 *
 * Every slug here is a real one from `data/registry.json`, so the sizes these
 * tests print are the sizes a real sheet takes on the wire.
 */
import type { Character, LevelUpChoice } from '../../shared/types.ts';
import { createRegistry, registry, type Registry } from '../../src/transfer/registry.ts';
import type { SlugSource } from '../../tools/buildRegistry.ts';

/** The committed registry: what a device actually has. */
export const testRegistry: Registry = registry;

/** The same registry minus a few entries: a device with older content. */
export function registryWithout(...slugs: string[]): Registry {
  const ids = Object.fromEntries(registry.entries());
  for (const slug of slugs) delete ids[slug];
  return createRegistry({ version: 1, ids });
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
    schemaVersion: 3,
    name: 'Kaelith',
    pronouns: 'she/her',

    classRef: 'wizard',
    subclassRefs: ['school-of-knowledge'],
    ancestryRefs: ['elf'],
    communityRef: 'loreborne',
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
      experiences: [{ id: 'c0ffee00-1111-4222-8333-444455556666', name: 'Sharp eyes', bonus: 2 }],
      upgrades: ['intelligent', 'light-in-the-dark'],
    },
  });
}

/**
 * Experience ids are local handles the codec deliberately does not carry, so a
 * round-trip is compared with them replaced by their position - which is also
 * the check that the level-up records still point at the right one.
 */
export function normalizeHandles(c: Character): unknown {
  const at = new Map(c.experiences.map((e, i) => [e.id, `experience#${i}`]));
  const companionAt = new Map(
    (c.companion?.experiences ?? []).map((e, i) => [e.id, `companion-experience#${i}`]),
  );
  const rename = (id: string): string => at.get(id) ?? companionAt.get(id) ?? id;

  return {
    ...c,
    experiences: c.experiences.map((e) => ({ ...e, id: rename(e.id) })),
    companion:
      c.companion === null
        ? null
        : {
            ...c.companion,
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
