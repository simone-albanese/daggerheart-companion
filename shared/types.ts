/**
 * The dataset contract.
 *
 * Everything downstream - parsers, engine, UI, transfer codec - agrees here.
 * Two rules govern this file:
 *
 *   1. A character stores `Ref`s and values, never copies of content. Updating
 *      the dataset must never touch a saved character.
 *   2. Anything the rules leave open to interpretation is stored as text and
 *      rendered, never modelled. Only unambiguous arithmetic gets a type.
 */

/** A stable slug, e.g. `arcana-rune-ward`. Produced by `slugify`. */
export type Ref = string;

export const SCHEMA_VERSION = 3 as const;

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const TRAITS = [
  'agility',
  'strength',
  'finesse',
  'instinct',
  'presence',
  'knowledge',
] as const;
export type Trait = (typeof TRAITS)[number];

export const TRAIT_LABELS: Record<Trait, string> = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

export const DOMAINS = [
  'arcana',
  'blade',
  'bone',
  'codex',
  'grace',
  'midnight',
  'sage',
  'splendor',
  'valor',
] as const;
export type DomainId = (typeof DOMAINS)[number];

export const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'] as const;
export type Range = (typeof RANGES)[number];

export type DamageKind = 'phy' | 'mag';

export const ADVERSARY_ROLES = [
  'Bruiser',
  'Horde',
  'Leader',
  'Minion',
  'Ranged',
  'Skulk',
  'Social',
  'Solo',
  'Standard',
  'Support',
] as const;
export type AdversaryRole = (typeof ADVERSARY_ROLES)[number];

export type Tier = 1 | 2 | 3 | 4;

export type DomainCardType = 'Ability' | 'Spell' | 'Grimoire';

// ---------------------------------------------------------------------------
// Provenance and layering
// ---------------------------------------------------------------------------

export interface Layer {
  id: string;
  label: string;
  /** Higher wins, field by field. 0 = SRD, 1 = Core Rulebook, 2 = reserved. */
  priority: number;
  importedAt?: string;
}

/** Field name -> id of the layer that defined it. */
export type Provenance = Record<string, string>;

export interface Sourced {
  provenance?: Provenance;
  /** Printed folio in the source book, for "look it up" affordances. */
  sourcePage?: number;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export interface Domain extends Sourced {
  id: DomainId;
  name: string;
  description: string;
}

export interface DomainCard extends Sourced {
  id: Ref;
  name: string;
  domain: DomainId;
  /** 1-10. */
  level: number;
  type: DomainCardType;
  recallCost: number;
  /** Rules text, verbatim. Never executed. */
  text: string;
  /** Key into the art store once a Core Rulebook has been imported. */
  artKey?: string;
  flavorText?: string;
}

/** A named block of rules text. The engine renders it and never runs it. */
export interface Feature {
  name: string;
  text: string;
  /** Adversary/environment features carry a kind in their heading. */
  kind?: 'Action' | 'Reaction' | 'Passive';
  /** Level at which a class/subclass feature is gained, when stated. */
  level?: number;
}

export interface CharClass extends Sourced {
  id: Ref;
  name: string;
  description: string;
  domains: [DomainId, DomainId];
  startingEvasion: number;
  startingHitPoints: number;
  /** Text of the "choose one" starting equipment lines. */
  suggestedEquipment: string[];
  classItems: string[];
  hopeFeature: Feature;
  classFeatures: Feature[];
  backgroundQuestions: string[];
  connectionQuestions: string[];
  subclasses: Ref[];
}

export interface Subclass extends Sourced {
  id: Ref;
  name: string;
  classRef: Ref;
  /** "Spellcast Trait: Presence" - null for the non-casting subclasses. */
  spellcastTrait: Trait | null;
  foundationFeatures: Feature[];
  specializationFeatures: Feature[];
  masteryFeatures: Feature[];
}

export interface Ancestry extends Sourced {
  id: Ref;
  name: string;
  description: string;
  features: [Feature, Feature];
}

export interface Community extends Sourced {
  id: Ref;
  name: string;
  description: string;
  /** Adjective list from "you likely..." prose. */
  traits: string[];
  feature: Feature;
}

export interface Beastform extends Sourced {
  id: Ref;
  name: string;
  /** Beastform tier: 1 at level 1, higher forms unlock with level. */
  tier: number;
  category: string;
  examples: string[];
  /** Trait bonus granted while transformed, e.g. `{ agility: 1 }`. */
  traitBonus: Partial<Record<Trait, number>>;
  evasionBonus: number;
  attack: { name: string; range: Range; damage: string; trait: Trait };
  advantageOn: string[];
  features: Feature[];
}

/**
 * A weapon's attack trait. The arcane-frame wheelchairs deliberately do not
 * name one: the SRD says to use the Spellcast trait your subclass indicates,
 * so it stays unresolved in the data and is looked up per character.
 */
export type WeaponTrait = Trait | 'spellcast';

export interface Weapon extends Sourced {
  id: Ref;
  name: string;
  tier: Tier;
  /** Primary weapons occupy the main slot; secondary the off-hand. */
  slot: 'primary' | 'secondary';
  category: 'Physical' | 'Magic';
  trait: WeaponTrait;
  range: Range;
  /** e.g. `d8+3`. Proficiency multiplies the die count at roll time. */
  damage: string;
  damageType: DamageKind;
  burden: 1 | 2;
  feature: string;
}

export interface Armor extends Sourced {
  id: Ref;
  name: string;
  tier: Tier;
  /** Base thresholds before level is added. */
  baseThresholds: [number, number];
  baseScore: number;
  feature: string;
}

export interface Item extends Sourced {
  id: Ref;
  name: string;
  kind: 'loot' | 'consumable';
  /** d100 roll that yields this item on the random table. */
  roll?: number;
  text: string;
}

export interface AdversaryAttack {
  name: string;
  range: Range;
  /** e.g. `2d6+3`, or `1d20` - kept as text because some are special. */
  damage: string;
  damageType: DamageKind | 'direct phy' | 'direct mag';
}

export interface Adversary extends Sourced {
  id: Ref;
  name: string;
  tier: Tier;
  role: AdversaryRole;
  description: string;
  motives: string[];
  difficulty: number;
  /** Minions and some Solos have no thresholds. */
  thresholds: [number, number] | null;
  hp: number;
  stress: number;
  attackBonus: number;
  attack: AdversaryAttack;
  experiences: Array<{ name: string; bonus: number }>;
  features: Feature[];
  /** Parsed out of `Horde (N/HP)` / `Minion (N)` for the encounter builder. */
  hordeThreshold?: number;
  minionGroup?: number;
}

export interface Environment extends Sourced {
  id: Ref;
  name: string;
  tier: Tier;
  type: 'Exploration' | 'Social' | 'Traversal' | 'Event';
  description: string;
  impulses: string;
  difficulty: number;
  potentialAdversaries: string[];
  features: Feature[];
}

/** A named rules table the UI shows verbatim (downtime moves, GM moves...). */
export interface RulesSection extends Sourced {
  id: Ref;
  title: string;
  /** Markdown-ish: paragraphs, `- ` bullets, `## ` subheads. */
  body: string;
}

export interface Dataset {
  schemaVersion: typeof SCHEMA_VERSION;
  /** Source revision id, e.g. `srd-1.0-2025-09-09`. */
  revision: string;
  generatedAt: string;
  layers: Layer[];
  domains: Domain[];
  domainCards: DomainCard[];
  classes: CharClass[];
  subclasses: Subclass[];
  beastforms: Beastform[];
  ancestries: Ancestry[];
  communities: Community[];
  weapons: Weapon[];
  armors: Armor[];
  loot: Item[];
  consumables: Item[];
  adversaries: Adversary[];
  environments: Environment[];
  rules: RulesSection[];
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------

/** A marked/unmarked track. `marked` counts *used* boxes for every track. */
export interface Counter {
  marked: number;
  max: number;
}

export interface InventoryEntry {
  /** Dataset reference when the item is official, else null for free text. */
  ref: Ref | null;
  name: string;
  quantity: number;
  note?: string;
}

export interface Experience {
  id: string;
  name: string;
  bonus: number;
}

export interface Gold {
  handfuls: number;
  bags: number;
  chests: number;
}

export type AdvancementKind =
  | 'trait'
  | 'hitPoint'
  | 'stress'
  | 'experience'
  | 'domainCard'
  | 'evasion'
  | 'subclass'
  | 'proficiency'
  | 'multiclass';

export interface LevelUpChoice {
  level: number;
  /** Index into the tier's advancement list, for re-editing. */
  slot: number;
  kind: AdvancementKind;
  /** Traits marked, card taken, subclass chosen... shape depends on `kind`. */
  detail: Record<string, unknown>;
}

export interface CompanionState {
  name: string;
  /** Freeform species/description. */
  description: string;
  evasion: number;
  stress: Counter;
  damage: string;
  range: Range;
  experiences: Experience[];
  /** Levelled-up companion upgrades, by slug. */
  upgrades: string[];
}

export interface BeastformState {
  ref: Ref;
  /** Snapshot of what the form overrides, so leaving it is lossless. */
  activatedAt: string;
}

export interface Character {
  id: string;
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  pronouns: string;

  classRef: Ref;
  subclassRefs: Ref[];
  ancestryRefs: Ref[];
  communityRef: Ref | null;
  /** Second class taken at level 5+, with its own subclass in subclassRefs. */
  multiclassRef: Ref | null;
  multiclassDomain: DomainId | null;

  level: number;
  traits: Record<Trait, number>;
  /** Traits marked as used for this tier's advancement, by trait. */
  traitMarks: Partial<Record<Trait, number>>;

  hp: Counter;
  stress: Counter;
  hope: Counter;
  armorSlots: Counter;

  /** Manual overrides; null means "computed from class + level + gear". */
  evasionOverride: number | null;
  thresholdOverride: [number, number] | null;

  loadout: Ref[];
  vault: Ref[];

  activePrimaryWeapon: Ref | null;
  activeSecondaryWeapon: Ref | null;
  activeArmor: Ref | null;
  inventory: InventoryEntry[];

  experiences: Experience[];
  gold: Gold;
  connections: string[];
  notes: string;

  levelUpHistory: LevelUpChoice[];
  companion: CompanionState | null;
  beastform: BeastformState | null;

  /** Scars from Death Moves - each permanently costs a Hope slot. */
  scars: string[];

  createdAt: string;
  updatedAt: string;
  /** Registry ids that this device could not resolve. Never discarded. */
  unresolvedRefs?: number[];
}

// ---------------------------------------------------------------------------
// The GM's own records
// ---------------------------------------------------------------------------

/*
 * Four of these were declared in `src/engine/encounter.ts` and three more in
 * `src/ui/gm/party.ts`. That was right while the GM's state lived in
 * localStorage and belonged to whichever screen drew it. It stops being right
 * the moment a campaign record in IndexedDB stores every one of them verbatim:
 * they are persisted shapes now, and persisted shapes belong here beside
 * `Character`, where Architecture 6.1's schema policy can see them. Both
 * modules re-export what they used to declare, so every existing import reads
 * exactly the same.
 */

/** The Fear pool's ceiling. A rule number, and the bound the reader clamps to. */
export const MAX_FEAR = 12;

export type CountdownKind = 'standard' | 'dynamic' | 'loop' | 'long-term';

export interface Countdown {
  id: string;
  name: string;
  kind: CountdownKind;
  start: number;
  value: number;
  notes: string;
}

export interface SceneCombatant {
  id: string;
  adversaryRef: string;
  name: string;
  hp: Counter;
  stress: Counter;
  thresholds: [number, number] | null;
  difficulty: number;
  spotlighted: boolean;
  /** Minions in this group still standing. */
  minionsRemaining?: number;
  notes: string;
}

export interface EncounterAdjustments {
  /** -1 for an easier or shorter fight. */
  easier: boolean;
  /** +2 for a harder or longer fight. */
  harder: boolean;
  /** -2 if you add +1d4 (or a static +2) to all adversaries' damage rolls. */
  damageBump: boolean;
}

/** One line of the encounter builder: an adversary, and how many of it. */
export interface RosterEntry {
  ref: Ref;
  /** For Minions this counts *groups*, each the size of the party. */
  count: number;
}

/** How a sheet reached the party board. Both are one-time handovers. */
export type PartySource = 'file' | 'code';

/**
 * The GM's own tally, in the same terms the tracks use everywhere else: HP,
 * Stress and Armor count what is *marked*, Hope counts what is *available*.
 */
export interface PartyTracks {
  hp: number;
  stress: number;
  hope: number;
  armor: number;
}

export interface PartyMember {
  /**
   * The board's handle, and the character's own id - so a second import of the
   * same sheet lands on the row it already had instead of beside it.
   */
  id: string;
  sheet: Character;
  importedAt: string;
  source: PartySource;
  tracks: PartyTracks;
  /**
   * When the GM last moved a track by hand. Null while the tracks are still
   * exactly the ones that arrived, which is the only time the board may say so.
   */
  markedAt: string | null;
}
