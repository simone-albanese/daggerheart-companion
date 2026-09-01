/**
 * Everything derivable from a character plus the dataset.
 *
 * Nothing here interprets a feature's text. If a value cannot be reached by
 * unambiguous arithmetic from the rules, it is not computed - it is left to
 * the player, with an override field where one is needed.
 */
import { SCHEMA_VERSION, TRAITS } from '../../shared/types.ts';
import type {
  Adversary,
  Ancestry,
  Armor,
  Beastform,
  CharClass,
  Character,
  Community,
  Dataset,
  DomainCard,
  DomainId,
  Environment,
  Item,
  Ref,
  Subclass,
  Tier,
  Trait,
  Transformation,
  Weapon,
} from '../../shared/types.ts';
import { applyProficiency, formatDamage, parseDamage } from './dice.ts';
import { collectModifiers, sumOf, traitDeltas, type Ledger } from './modifiers.ts';

export const MAX_HP = 12;
export const MAX_STRESS = 12;
export const MAX_ARMOR_SCORE = 12;
export const MAX_LOADOUT = 5;
export const BASE_HOPE = 6;
export const MAX_LEVEL = 10;

/**
 * The most a counter's maximum may ever be, one entry per track.
 *
 * A different question from `deriveStats`, and the difference is the whole
 * reason this exists separately. A derived maximum is what *this* build, with
 * *this* dataset, works out for one sheet: it can be a fallback when a ref will
 * not resolve, and a later update can raise it - which is exactly why
 * `normalizeIncoming` refuses to clamp against one. These are the rules'
 * ceilings instead. Hit Points and Stress are capped at twelve by the
 * advancement tables above, Armor Score by the same cap in `deriveStats`, and
 * Hope at six before scars start crossing slots out. No layer, no homebrew and
 * no class from a future book makes a thirteenth Hit Point box legal, so a
 * maximum above one of these did not come from a device with content this build
 * has not met - it is not a number at all. That is what lets the codec refuse
 * one and the store clamp one without either of them destroying a real reading.
 *
 * The companion's Stress track takes the character's ceiling because it is a
 * Stress track and the engine has exactly one; the arithmetic agrees anyway -
 * three slots on the folio 18 sheet plus one Resilient per level-up from 2 to
 * 10 is twelve.
 *
 * These are ceilings and never answers. Nothing here should be shown to a
 * player as their maximum; `deriveStats` is the only thing that knows that.
 */
export const COUNTER_CEILINGS = {
  hp: MAX_HP,
  stress: MAX_STRESS,
  hope: BASE_HOPE,
  armorSlots: MAX_ARMOR_SCORE,
  companionStress: MAX_STRESS,
} as const;

export type CounterName = keyof typeof COUNTER_CEILINGS;

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

/**
 * The collections `byRef` carries, in the order that decides a bare-slug lookup.
 *
 * ## Why an order is needed at all
 *
 * A `Ref` is a bare slug and always has been, so one key space holds every
 * kind of record. SRD 2.0 ends the assumption that a bare slug names one
 * thing: it prints an Event environment called *Hold the Line* (folio 164)
 * beside the Valor domain card of the same name (folio 223), and `slugify`
 * reduces both to `hold-the-line`. Measured on the parsed book, that is the
 * only collision among these twelve collections: 1336 entries in `byRef`
 * against 1337 records across the twelve, one key short. There are none at all
 * in `data/srd-1.0.json`, so this order changes nothing about the dataset the
 * app ships today.
 *
 * `npm run build:srd -- --check --pdf Manuali/DH_SRD_2_2026_08_25.pdf` is the
 * command that names the colliding pairs out loud; it reports two, because
 * `tools/validate.ts` walks all fifteen collections and the second pair is in
 * a collection this map does not carry.
 *
 * ## Why THIS order
 *
 * It is `BANDED_COLLECTIONS` from `src/transfer/registry.ts`, minus the one
 * entry that is not indexed (see below), and it is deliberately the same
 * decision rather than a second opinion: that docblock says the collection
 * coming first "runs character-facing content first and GM-only content last,
 * so `hold-the-line` resolves to the domain card a loadout can hold rather
 * than to the environment a sheet can never point at". A ref that encodes to
 * the domain card's registry id and reads back as an environment through
 * `byRef` would be one app disagreeing with itself about one slug.
 *
 * The list is duplicated here rather than imported because `src/engine` does
 * not depend on `src/transfer`, and importing it would pull all 771 rows of
 * `data/registry.json` into every consumer of this module - including the
 * parsers and the build tools, which have no wire format in them. The two
 * lists are held together by a test instead
 * (`tests/engine/byRefPrecedence.test.ts`), which fails if either moves.
 *
 * ## First wins, and it used to be last
 *
 * `put` used to write into `byRef` as it filled each typed map, so the LAST
 * collection written won and the effective precedence was the reverse of the
 * call order: consumables beat loot beat environments beat adversaries beat
 * communities beat ancestries beat domain cards. Nothing chose that; it was
 * the order the six returned maps happened to be needed in. Measured, it made
 * `indexDataset(srd2).byRef.get('hold-the-line')` return the ENVIRONMENT - the
 * record a `Character` has no field for - and lose the card a loadout holds.
 *
 * `transformations` is absent, and since `Character.transformationRef` exists
 * that absence is a decision rather than a gap. `indexDataset` DOES carry the
 * collection now - `collections.transformations`, the exact map - but this
 * list is the bare-slug precedence and the card must stay out of it.
 *
 * The reason is the second collision SRD 2.0 prints: the Vampire adversary
 * (folio 142) against the VAMPIRE transformation card (folio 45). Measured on
 * the 2026-08-25 book, `parseAdversaries` and `parseTransformations` both
 * produce the slug `vampire`. Appended here the card would lose the bare name
 * to the adversary anyway (adversaries come first), so it would buy nothing;
 * inserted higher it would TAKE that name from the adversary, which is a change
 * to what every other caller in the app means by `vampire` in exchange for a
 * lookup that has an exact map of its own. `byRef.get('vampire')` therefore
 * still returns the adversary, which is what `BANDED_COLLECTIONS` decides, and
 * `collections.transformations.get('vampire')` returns the card.
 */
export const INDEXED_COLLECTIONS = [
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'domainCards',
  'beastforms',
  'weapons',
  'armors',
  'loot',
  'consumables',
  'adversaries',
  'environments',
] as const;

export type IndexedCollection = (typeof INDEXED_COLLECTIONS)[number];

/**
 * One typed map per collection: the exact lookup for a caller that knows its
 * kind.
 *
 * This is the `idIn` of the runtime index. `byRef` answers "whatever this slug
 * names", which is the right question for an inventory row (it can hold a
 * weapon, an armor, a loot item or a consumable) and the wrong one for a GM
 * scene's `environmentRef`, a `LinkTarget` that already carries its own kind,
 * or a character's `ancestryRefs` - those callers know the collection, and
 * asking the whole key space is how they end up holding a domain card and
 * calling it an environment.
 *
 * It also retires four unchecked casts. `features.ts` wrote
 * `index.byRef.get(r) as Ancestry`, which is an assertion the map could not
 * support: `byRef` is `Map<Ref, unknown>` precisely because it holds twelve
 * kinds, so the cast said "trust me" about the one thing the collision makes
 * untrue. These maps make the same lookups type-check on their own.
 */
export interface CollectionIndex {
  classes: Map<Ref, CharClass>;
  subclasses: Map<Ref, Subclass>;
  ancestries: Map<Ref, Ancestry>;
  communities: Map<Ref, Community>;
  domainCards: Map<Ref, DomainCard>;
  beastforms: Map<Ref, Beastform>;
  weapons: Map<Ref, Weapon>;
  armors: Map<Ref, Armor>;
  loot: Map<Ref, Item>;
  consumables: Map<Ref, Item>;
  adversaries: Map<Ref, Adversary>;
  environments: Map<Ref, Environment>;
  /**
   * The one collection here that is NOT in `INDEXED_COLLECTIONS`, and the only
   * way to resolve a `transformationRef`.
   *
   * It is deliberately reachable only through its own map. SRD 2.0 prints an
   * adversary VAMPIRE (folio 142) and a VAMPIRE transformation card (folio 45),
   * and both slugify to `vampire` - measured on the 2026-08-25 book, not
   * assumed. Putting transformations into the bare-slug map would either take
   * that name off the adversary (if it went first) or hand a
   * `transformationRef` the adversary (if it went last), and the second is the
   * quiet one: `byRef.get('vampire')` would return a stat block and the sheet
   * would draw its features as a transformation's.
   *
   * So `byRef` keeps exactly the twelve collections it had, the precedence
   * `BANDED_COLLECTIONS` fixes is untouched, and the one field on `Character`
   * that points here asks this map by name. `Registry.idIn` is the same
   * decision one layer down, on the wire.
   */
  transformations: Map<Ref, Transformation>;
}

export interface DatasetIndex {
  classes: Map<Ref, CharClass>;
  subclasses: Map<Ref, Subclass>;
  weapons: Map<Ref, Weapon>;
  armors: Map<Ref, Armor>;
  cards: Map<Ref, DomainCard>;
  beastforms: Map<Ref, Beastform>;
  /**
   * Every indexed record under its bare slug, first collection in
   * `INDEXED_COLLECTIONS` winning a slug two of them print.
   *
   * Ask this only when the caller genuinely does not know the kind. When it
   * does, `collections` below is the lookup that cannot answer with the wrong
   * one.
   */
  byRef: Map<Ref, unknown>;
  /** The same records, kept apart by collection. See `CollectionIndex`. */
  collections: CollectionIndex;
}

export function indexDataset(ds: Dataset): DatasetIndex {
  const put = <T extends { id: Ref }>(items: T[]): Map<Ref, T> => {
    const m = new Map<Ref, T>();
    for (const it of items) m.set(it.id, it);
    return m;
  };
  const collections: CollectionIndex = {
    classes: put(ds.classes),
    subclasses: put(ds.subclasses),
    ancestries: put(ds.ancestries),
    communities: put(ds.communities),
    domainCards: put(ds.domainCards),
    beastforms: put(ds.beastforms),
    weapons: put(ds.weapons),
    armors: put(ds.armors),
    loot: put(ds.loot),
    consumables: put(ds.consumables),
    adversaries: put(ds.adversaries),
    environments: put(ds.environments),
    transformations: put(ds.transformations),
  };
  /*
   * The bare-slug view, filled in `INDEXED_COLLECTIONS` order and never
   * overwritten. The loop reads the exported list rather than the literal
   * above so the precedence is stated in exactly one place - the object's own
   * key order is a coincidence a refactor can break silently, and a test can
   * only hold this file to the registry by reading a value.
   */
  const byRef = new Map<Ref, unknown>();
  for (const name of INDEXED_COLLECTIONS) {
    for (const [ref, record] of collections[name]) {
      if (!byRef.has(ref)) byRef.set(ref, record);
    }
  }
  return {
    classes: collections.classes,
    subclasses: collections.subclasses,
    weapons: collections.weapons,
    armors: collections.armors,
    cards: collections.domainCards,
    beastforms: collections.beastforms,
    byRef,
    collections,
  };
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
  /**
   * Every static bonus this sheet's own contents granted, with its provenance.
   *
   * The totals are already IN the numbers above; this is what they were made
   * of. It rides out with the stats rather than being recomputed by whoever
   * wants to print a derivation, for the reason `deriveStats` exists at all:
   * two routes to one number is two numbers eventually.
   *
   * It is also the answer to how this defect went unnoticed for as long as it
   * did. An Evasion of 12 with nothing on screen saying where the 12 came from
   * is a number nobody can check; the same 12 shown as `10 + 1 + 1` is one a
   * player checks by looking. See `src/engine/modifiers.ts`.
   */
  modifiers: Ledger;
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

  /*
   * The Spellcast trait, worked out HERE and used twice.
   *
   * It used to be computed at the bottom, next to the returned object, and it
   * has moved up because the register now needs it: Mage Robes' *Enchanted* is
   * "a bonus to your damage thresholds equal to your Spellcast trait", and Mage
   * Robes is tier 1 starting armour. Moved rather than copied - the same const
   * is handed to `collectModifiers` and returned in `spellcastTrait` below - so
   * the number the armour reads and the number the roll uses cannot disagree.
   */
  const subclasses = c.subclassRefs
    .map((r) => ix.subclasses.get(r))
    .filter((s): s is Subclass => s !== undefined);
  const spellcastTrait = subclasses.find((s) => s.spellcastTrait !== null)?.spellcastTrait ?? null;

  /*
   * What the sheet's own contents add, before anything below reads a total.
   *
   * FIRST, because Proficiency is a term in one of the rows - Galapa's *Shell*
   * is "a bonus to your damage thresholds equal to your Proficiency" - and last
   * would mean working Proficiency out twice. Nothing here interprets a
   * feature's text; `modifiers.ts` holds a hand-authored register keyed on ref
   * and a test walks the dataset against it in both directions.
   *
   * Tier and the Spellcast trait ride along for the same reason Proficiency
   * does: three more rows say "equal to your <that>", and this function is
   * where all three are already known. A sheet with no Spellcast trait passes
   * `null` and the rows that read it are simply not emitted - see `Amount` in
   * `modifiers.ts` for why that is not a zero.
   */
  const modifiers = collectModifiers(c, ix, proficiency, { tier, spellcastTrait });

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
    baseThresholds[0] + c.level + sumOf(modifiers, 'major'),
    baseThresholds[1] + c.level + sumOf(modifiers, 'severe'),
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
  /*
   * AND THE SHIELD'S BONUS GOES ON THE FIRST BRANCH ONLY. THIS IS THE ONE
   * DERIVED NUMBER THAT WRITES ITSELF BACK, AND ADDING TO BOTH BRANCHES IS A
   * FEEDBACK LOOP THAT INFLATES A SHEET EVERY TIME IT IS SAVED.
   *
   * `syncCounters` below writes `armorSlots.max = stats.armorScore`, and
   * `store/state.ts` calls it on every level-up, armour change and death move -
   * so this number leaves the engine, lands in persisted state, and goes out in
   * `.dhchar`, `.dhbackup` and the QR payload. The second branch then reads it
   * BACK as its base. So a sheet wearing armour this build cannot name, with a
   * Tower Shield in the off-hand, would go 5 -> 7 -> 9 -> 11 -> 12, two points
   * per save, until it hit the ceiling. Nothing would have failed and the
   * numbers would all have looked plausible on the way up.
   *
   * The fix is the same sentence the branch was written for. A carried
   * `armorSlots.max` is a FINISHED Armor Score, written by a build that could
   * name the armour, which means the shield it was worn with is already in it.
   * Re-adding is double-counting even on the first save. So gear adds to a base
   * this engine worked out itself, and never to one it inherited.
   */
  const gearArmor = sumOf(modifiers, 'armorScore');
  const armorScore =
    unresolvedArmor === null
      ? Math.min(MAX_ARMOR_SCORE, Math.max(0, (armor?.baseScore ?? 0) + gearArmor))
      : Math.min(MAX_ARMOR_SCORE, Math.max(0, c.armorSlots.max));

  /*
   * THE MODIFIERS GO INSIDE THE `??` AND THE OVERRIDE STAYS OUTSIDE IT, WHICH
   * IS THE WHOLE OF THE PRECEDENCE QUESTION AND IS EASY TO GET BACKWARDS.
   *
   * An override is the sheet asserting a finished number about itself - the
   * print sheet captions it "Set by hand on this sheet" - and it can only
   * arrive here from a file this device imported, because nothing in `src/`
   * writes one. A sheet that says 14 was written by a build that had already
   * counted its own armour, so adding Gambeson's +1 on top would move a
   * hand-stated 14 to 15 in precisely the population this fix exists for.
   *
   * So the override replaces the entire computed value, modifiers included, and
   * the Beastform still stacks ON TOP of whichever of the two won - which is
   * the asymmetry that was already here and is deliberate: a form is a state,
   * an override is a fact. `tests/engine/character.test.ts` and
   * `tests/engine/beastform.test.ts` pin both halves and neither changed for
   * this commit, which is how the precedence is known to have stayed put.
   */
  const baseEvasion =
    c.evasionOverride ??
    (klass?.startingEvasion ?? 10) + advancementCount(c, 'evasion') + sumOf(modifiers, 'evasion');

  /*
   * The traits in play, gear first and the form on top.
   *
   * `geared` is the character's own numbers plus everything worn and carried:
   * Full Plate's -1 Agility, savior chainmail's -1 to all six, a Halberd's -1
   * Finesse, a Relic's +1. It is the sheet's real number, and it is what a roll
   * uses when no form is worn.
   */
  const gearedTraits = traitDeltas(modifiers);
  const geared = Object.fromEntries(
    TRAITS.map((t) => [t, c.traits[t] + gearedTraits[t]]),
  ) as Record<Trait, number>;

  // A Beastform is a state, not a fact about the character. It is layered here,
  // at read time, and never written back - a Druid who drops out of a form must
  // find their own numbers untouched. An unresolvable ref simply means no form.
  const form = c.beastform ? (ix.beastforms.get(c.beastform.ref) ?? null) : null;
  const traits = form
    ? (Object.fromEntries(
        TRAITS.map((t) => [t, geared[t] + (form.traitBonus[t] ?? 0)]),
      ) as Record<Trait, number>)
    : geared;
  const evasion = baseEvasion + (form?.evasionBonus ?? 0);
  const beastform: BeastformInPlay | null = form
    ? {
        form,
        baseEvasion,
        /*
         * `from` IS THE GEARED NUMBER AND NOT THE RAW ONE, and the difference
         * is a struck-through lie on screen.
         *
         * `Beastform.tsx` prints `from` beside `to` as "what this replaced".
         * Reading it off `c.traits` while `to` comes from `traits` - which now
         * carries Full Plate's -1 Agility, a Halberd's -1 Finesse, a Relic's +1
         * - would print a "before" that was never on any sheet: a wizard in
         * full plate with Agility 1 would read `1 -> 3` where their sheet says
         * 0 and the form gives 2. Both ends come off the same layer.
         */
        raised: TRAITS.filter((t) => (form.traitBonus[t] ?? 0) !== 0).map((t) => ({
          trait: t,
          from: geared[t],
          to: traits[t],
        })),
      }
    : null;

  /*
   * The two tracks that grow, and the four features that grow them.
   *
   * Giant's *Endurance* and School of War's *Battlemage* each say "Gain an
   * additional Hit Point slot"; Human's *High Stamina* and Vengeance's *At
   * Ease* say the same of Stress. None of the four carries a digit, which is
   * the second reason `modifiers.ts` is a hand-authored register rather than a
   * scan: no regex over the SRD's own words finds any of them.
   *
   * Clamped at the rules' ceiling exactly as before. These flow into
   * `syncCounters` and become the track's `max`, so a character who loses the
   * feature loses the slot - which is right, and is the same thing that already
   * happened when an advancement was un-taken.
   */
  const maxHp = Math.min(
    MAX_HP,
    startingHitPoints(klass) + advancementCount(c, 'hitPoint') + sumOf(modifiers, 'maxHp'),
  );
  const maxStress = Math.min(
    MAX_STRESS,
    BASE_STRESS + advancementCount(c, 'stress') + sumOf(modifiers, 'maxStress'),
  );
  // A scar permanently crosses out a Hope slot.
  const maxHope = Math.max(0, BASE_HOPE - c.scars.length);

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
    modifiers,
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
    schemaVersion: SCHEMA_VERSION,
    name: '',
    pronouns: '',
    classRef: '',
    subclassRefs: [],
    ancestryRefs: [],
    communityRef: null,
    // Also the fallback for every file older than schema 7, because
    // `readCharacterRecord` spreads the file over a blank sheet.
    transformationRef: null,
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
    // Also the fallback for every file older than schema 4, because
    // `readCharacterRecord` spreads the file over a blank sheet.
    consecutiveShortRests: 0,
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
