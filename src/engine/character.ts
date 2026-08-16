/**
 * Everything derivable from a character plus the dataset.
 *
 * Nothing here interprets a feature's text. If a value cannot be reached by
 * unambiguous arithmetic from the rules, it is not computed - it is left to
 * the player, with an override field where one is needed.
 */
import { TRAITS } from '../../shared/types.ts';
import type {
  Armor,
  Beastform,
  CharClass,
  Character,
  Dataset,
  DomainCard,
  DomainId,
  Ref,
  Subclass,
  Tier,
  Trait,
  Weapon,
} from '../../shared/types.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';

export const MAX_HP = 12;
export const MAX_STRESS = 12;
export const MAX_ARMOR_SCORE = 12;
export const MAX_LOADOUT = 5;
export const BASE_HOPE = 6;
export const MAX_LEVEL = 10;

/**
 * The Hit Points to start a track with when no class can be read.
 *
 * Measured against `data/srd-1.0.json` rather than taken on trust: bard 5,
 * druid 6, guardian 7, ranger 6, rogue 6, seraph 7, sorcerer 6, warrior 6,
 * wizard 5. Six is the most common of the nine and it is what `deriveStats`
 * has always fallen back to, so it is the one number that cannot make a seeded
 * track disagree with the maximum the engine derives for the same sheet. It is
 * a fallback and never an answer: a character with a class gets the class's.
 */
const HIT_POINTS_WITHOUT_A_CLASS = 6;

/**
 * Stress is six for every character in the game.
 *
 * Not a fallback, unlike the constant above: there is no per-class Stress in
 * the SRD, none in `data/srd-1.0.json`, and no field for one on `CharClass`.
 * Named so the seeded track and the derived maximum read it from one place.
 */
const BASE_STRESS = 6;

/** Hit Points at level 1, from the class if this build can name it. */
const startingHitPoints = (klass: CharClass | undefined): number =>
  klass?.startingHitPoints ?? HIT_POINTS_WITHOUT_A_CLASS;

/** Tier 1 is level 1, tier 2 is 2-4, tier 3 is 5-7, tier 4 is 8-10. */
export function tierOf(level: number): Tier {
  if (level <= 1) return 1;
  if (level <= 4) return 2;
  if (level <= 7) return 3;
  return 4;
}

export const TIER_LEVELS: Record<Tier, number[]> = {
  1: [1],
  2: [2, 3, 4],
  3: [5, 6, 7],
  4: [8, 9, 10],
};

/**
 * Proficiency starts at 1 and rises by 1 as a tier achievement at levels 2, 5
 * and 8. Advancements can raise it further, so the tier achievement is the
 * floor, not the value.
 */
export function baseProficiency(level: number): number {
  return 1 + [2, 5, 8].filter((l) => level >= l).length;
}

export interface DatasetIndex {
  classes: Map<Ref, CharClass>;
  subclasses: Map<Ref, Subclass>;
  weapons: Map<Ref, Weapon>;
  armors: Map<Ref, Armor>;
  cards: Map<Ref, DomainCard>;
  beastforms: Map<Ref, Beastform>;
  byRef: Map<Ref, unknown>;
}

export function indexDataset(ds: Dataset): DatasetIndex {
  const byRef = new Map<Ref, unknown>();
  const put = <T extends { id: Ref }>(items: T[]): Map<Ref, T> => {
    const m = new Map<Ref, T>();
    for (const it of items) {
      m.set(it.id, it);
      byRef.set(it.id, it);
    }
    return m;
  };
  const classes = put(ds.classes);
  const subclasses = put(ds.subclasses);
  const weapons = put(ds.weapons);
  const armors = put(ds.armors);
  const cards = put(ds.domainCards);
  const beastforms = put(ds.beastforms);
  put(ds.ancestries);
  put(ds.communities);
  put(ds.adversaries);
  put(ds.environments);
  put(ds.loot);
  put(ds.consumables);
  return { classes, subclasses, weapons, armors, cards, beastforms, byRef };
}

/**
 * What an active Beastform replaces, alongside what it replaced it with.
 *
 * The character's own traits and Evasion are never written to, so dropping out
 * of the form is lossless; this is the layer that sits on top of them for as
 * long as the Druid is transformed.
 */
export interface BeastformInPlay {
  form: Beastform;
  /** Evasion before the form's bonus, so the sheet can show what it replaced. */
  baseEvasion: number;
  /** Every trait the form raises, with the value it had before. */
  raised: Array<{ trait: Trait; from: number; to: number }>;
}

export interface DerivedStats {
  tier: Tier;
  proficiency: number;
  evasion: number;
  /** Trait values in play: the character's own, plus an active Beastform's. */
  traits: Record<Trait, number>;
  /** The Beastform being worn right now, or null. */
  beastform: BeastformInPlay | null;
  /** [Major, Severe]. Not this character's numbers when `unresolvedArmor` is set. */
  thresholds: [number, number];
  /** Twice Severe: the optional Massive Damage rule. */
  massiveThreshold: number;
  armorScore: number;
  /**
   * The armor the sheet names that this build cannot resolve, or null.
   *
   * "Wearing armor this build cannot name" and "wearing no armor" are two
   * different situations and they must not read as one number. When this is
   * set, `thresholds` above is the *unarmored* ladder - a floor, not a fact:
   * a level 5 character in improved chainmail reads 16/29 on the sheet the
   * armor came from and 5/10 out of that formula. Anything that prints those
   * two numbers without saying where they came from is telling the table
   * something untrue, so the ref rides out with the stats rather than being
   * swallowed by the branch that means "no armor".
   *
   * `armorScore` is the other half: with the armor unknown its Score is
   * unknown too, so the sheet's own Armor Slot maximum is carried through
   * instead of the unarmored zero.
   */
  unresolvedArmor: Ref | null;
  maxHp: number;
  maxStress: number;
  maxHope: number;
  /** Which trait a Spellcast Roll uses, from the subclass. Null if none. */
  spellcastTrait: Trait | null;
  /** Domains this character may draw cards from. */
  domains: DomainId[];
  /** Highest card level that may be taken, per domain. */
  cardLevelCap: (domain: DomainId) => number;
  loadoutLimit: number;
}

/**
 * Count the advancements of a given kind the character has taken. Advancement
 * effects that are pure arithmetic are applied here; everything else is text.
 */
function advancementCount(c: Character, kind: string): number {
  return c.levelUpHistory.filter((a) => a.kind === kind).length;
}

export function deriveStats(c: Character, ds: Dataset, index?: DatasetIndex): DerivedStats {
  const ix = index ?? indexDataset(ds);
  const klass = ix.classes.get(c.classRef);
  const tier = tierOf(c.level);

  // Each "increase Proficiency" advancement costs two slots but adds one.
  const proficiency = baseProficiency(c.level) + advancementCount(c, 'proficiency');

  // A ref this dataset does not hold is not the same fact as an empty slot, and
  // taking the same branch for both is how a Guardian in improved chainmail
  // reads 5/10 at level 5 instead of 16/29 with nothing on screen saying the
  // armor was not understood. The unresolved ref is carried out with the stats
  // so a caller can tell the two apart; this is the call `normalizeIncoming`
  // (P0-7) already makes at the store's door, where a maximum this build had to
  // guess at is not allowed to clamp the numbers a sheet arrived with.
  const wornRef: Ref | null = c.activeArmor === null || c.activeArmor === '' ? null : c.activeArmor;
  const armor = wornRef === null ? undefined : ix.armors.get(wornRef);
  const unresolvedArmor: Ref | null = armor === undefined ? wornRef : null;

  // Unarmored: Major equals level, Severe equals twice level, no armor slots.
  const baseThresholds: [number, number] = armor
    ? [armor.baseThresholds[0], armor.baseThresholds[1]]
    : [0, c.level];
  const thresholds: [number, number] = c.thresholdOverride ?? [
    baseThresholds[0] + c.level,
    baseThresholds[1] + c.level,
  ];

  /*
   * Zero is an answer, and it is the wrong one for armor nobody can name.
   * `syncCounters` writes this number straight into `armorSlots.max` and pulls
   * `marked` down with it, so answering "no slots" for an unresolvable ref
   * empties the Armor track of a character who is wearing armor - permanently,
   * at the next level-up or armor change, on a sheet that was only ever passing
   * through this build. The slot maximum the sheet already carries was written
   * by a build that *could* name the armor, so it is kept rather than replaced.
   */
  const baseScore =
    armor?.baseScore ?? (unresolvedArmor === null ? 0 : Math.max(0, c.armorSlots.max));
  const armorScore = Math.min(MAX_ARMOR_SCORE, baseScore);

  const baseEvasion =
    c.evasionOverride ??
    (klass?.startingEvasion ?? 10) + advancementCount(c, 'evasion');

  // A Beastform is a state, not a fact about the character. It is layered here,
  // at read time, and never written back - a Druid who drops out of a form must
  // find their own numbers untouched. An unresolvable ref simply means no form.
  const form = c.beastform ? (ix.beastforms.get(c.beastform.ref) ?? null) : null;
  const traits = form
    ? Object.fromEntries(
        TRAITS.map((t) => [t, c.traits[t] + (form.traitBonus[t] ?? 0)]),
      ) as Record<Trait, number>
    : c.traits;
  const evasion = baseEvasion + (form?.evasionBonus ?? 0);
  const beastform: BeastformInPlay | null = form
    ? {
        form,
        baseEvasion,
        raised: TRAITS.filter((t) => (form.traitBonus[t] ?? 0) !== 0).map((t) => ({
          trait: t,
          from: c.traits[t],
          to: traits[t],
        })),
      }
    : null;

  const maxHp = Math.min(MAX_HP, startingHitPoints(klass) + advancementCount(c, 'hitPoint'));
  const maxStress = Math.min(MAX_STRESS, BASE_STRESS + advancementCount(c, 'stress'));
  // A scar permanently crosses out a Hope slot.
  const maxHope = Math.max(0, BASE_HOPE - c.scars.length);

  const subclasses = c.subclassRefs
    .map((r) => ix.subclasses.get(r))
    .filter((s): s is Subclass => s !== undefined);
  const spellcastTrait = subclasses.find((s) => s.spellcastTrait !== null)?.spellcastTrait ?? null;

  const domains: DomainId[] = [...(klass?.domains ?? [])];
  if (c.multiclassDomain && !domains.includes(c.multiclassDomain)) {
    domains.push(c.multiclassDomain);
  }

  // A multiclass domain only opens cards at or below half your level, rounded
  // up; Daggerheart rounds up everywhere unless it says otherwise.
  const cardLevelCap = (domain: DomainId): number =>
    domain === c.multiclassDomain ? Math.ceil(c.level / 2) : c.level;

  return {
    tier,
    proficiency,
    evasion,
    traits,
    beastform,
    thresholds,
    massiveThreshold: thresholds[1] * 2,
    armorScore,
    unresolvedArmor,
    maxHp,
    maxStress,
    maxHope,
    spellcastTrait,
    domains,
    cardLevelCap,
    loadoutLimit: MAX_LOADOUT,
  };
}

/**
 * The modifier a roll uses, given a trait or the special Spellcast slot.
 *
 * Reads `stats.traits`, not the character's own, so a Druid in a Beastform
 * rolls the trait the form actually gives them.
 */
export function rollModifier(
  _c: Character,
  stats: DerivedStats,
  which: Trait | 'spellcast',
): { trait: Trait | null; value: number; label: string } {
  if (which === 'spellcast') {
    const t = stats.spellcastTrait;
    return {
      trait: t,
      value: t ? stats.traits[t] : 0,
      label: t ? `Spellcast (${t})` : 'Spellcast',
    };
  }
  return { trait: which, value: stats.traits[which], label: which };
}

/**
 * Weapon damage after Proficiency, ready to roll.
 *
 * Goes through `parseDamage` rather than a second regex of its own: a layer
 * that spells a weapon `d10 + 2` must not quietly lose the +2 here while the
 * damage roller reads it correctly.
 */
export function weaponDamage(
  weapon: Weapon,
  stats: DerivedStats,
): { spec: string; count: number; sides: number; modifier: number } | null {
  const parsed = parseDamage(weapon.damage);
  if (!parsed) return null;
  const scaled = applyProficiency(parsed, stats.proficiency);
  return { spec: formatDamage(scaled), ...scaled };
}

/**
 * A blank sheet, optionally with a class already chosen.
 *
 * The index is optional and it is what makes the Hit Point track right. Without
 * it there is no way to look a class up, and the hardcoded 6 this used to write
 * is wrong for four of the nine SRD classes - a wizard or a bard starts on 5, a
 * guardian or a seraph on 7 - which is a 6-box track under an engine deriving
 * 5, and `validatePlan` warning "Hit Points are already at the maximum of 12"
 * one advancement early. It has stayed latent only because the one persisting
 * caller, `store.create`, happens to be handed an already-synced sheet; a
 * second caller - duplicate-character, a template, a test seed - is all it
 * takes. So the class is read here when it can be, and the store passes its
 * index in.
 *
 * With no index, or with a class this build cannot resolve, the track is seeded
 * at `HIT_POINTS_WITHOUT_A_CLASS`, which is exactly what `deriveStats` derives
 * for the same sheet. Both read the one constant, so the two cannot drift: a
 * blank sheet is never stored disagreeing with the engine about itself.
 */
export function newCharacter(
  partial: Partial<Character> = {},
  index?: DatasetIndex,
): Character {
  const now = new Date().toISOString();
  const klass = index?.classes.get(partial.classRef ?? '');
  return {
    id: crypto.randomUUID(),
    schemaVersion: 3,
    name: '',
    pronouns: '',
    classRef: '',
    subclassRefs: [],
    ancestryRefs: [],
    communityRef: null,
    multiclassRef: null,
    multiclassDomain: null,
    level: 1,
    traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    traitMarks: {},
    hp: { marked: 0, max: Math.min(MAX_HP, startingHitPoints(klass)) },
    stress: { marked: 0, max: BASE_STRESS },
    hope: { marked: 2, max: BASE_HOPE },
    armorSlots: { marked: 0, max: 0 },
    evasionOverride: null,
    thresholdOverride: null,
    loadout: [],
    vault: [],
    activePrimaryWeapon: null,
    activeSecondaryWeapon: null,
    activeArmor: null,
    inventory: [],
    experiences: [],
    gold: { handfuls: 0, bags: 0, chests: 0 },
    connections: [],
    notes: '',
    levelUpHistory: [],
    companion: null,
    beastform: null,
    scars: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

/**
 * Re-clamp the counters after anything that can change a maximum.
 *
 * Hope is stored as *available*, every other track as *marked*, because that
 * is how each is read at the table: "4 Hope left", "3 HP marked".
 */
export function syncCounters(c: Character, stats: DerivedStats): Character {
  return {
    ...c,
    hp: { marked: Math.min(c.hp.marked, stats.maxHp), max: stats.maxHp },
    stress: { marked: Math.min(c.stress.marked, stats.maxStress), max: stats.maxStress },
    hope: { marked: Math.min(c.hope.marked, stats.maxHope), max: stats.maxHope },
    armorSlots: {
      marked: Math.min(c.armorSlots.marked, stats.armorScore),
      max: stats.armorScore,
    },
  };
}
