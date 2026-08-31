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

/**
 * The contract's version. It governs `.dhchar`, `.dhbackup`, the `characters`
 * store **and** `Dataset` - `Dataset.schemaVersion` is typed `typeof
 * SCHEMA_VERSION` and `data/srd-1.0.json` carries the number.
 *
 * ## Six, and why one bump and not four
 *
 * SRD 2.0 needs four things this contract could not say, and every one of them
 * was reaching the dataset today through a cast, which is to say invisibly:
 *
 *   1. `DamageKind` could not hold `phy or mag` or `phy/mag`;
 *   2. `Feature.kind` could not hold `Evolution`;
 *   3. `Adversary.stress` could not hold `Stress: None`;
 *   4. `Feature` could not nest, so seven sub-features were flattened into
 *      their parent's prose.
 *
 * Plus one new collection, `transformations`. Five changes, one number: the
 * version is not a changelog, it is the answer to "can this build read that
 * record", and the answer moves once however many fields moved with it.
 * `shared/campaigns.ts` made the same call for the URL row and the note row -
 * "two new kinds create exactly one hazard, and the hazard is answered once".
 *
 * ## The character converter changes no field, and here is the price of that
 *
 * Nothing above is on `Character`. A schema-5 sheet is a valid schema-6 sheet
 * byte for byte, so `MIGRATIONS`' `from: 5` entry copies and seeds nothing -
 * the shape `CAMPAIGN_MIGRATIONS` already uses four times over.
 *
 * The price is real and is not hidden: a schema-6 `.dhchar` is refused by a
 * schema-5 build, and for a character that refusal buys nothing, because a
 * schema-5 build would have read it perfectly. It is bought by the DATASET
 * half. `data/srd-1.0.json` is a static import, so a stale dataset cannot
 * reach a new build - but the reverse happens on every build, and
 * `baseDataset.schemaVersion === SCHEMA_VERSION`
 * (`tests/store/migrations.test.ts`) is the only thing standing between a moved
 * constant and a dataset that still has the old shape, because the JSON reaches
 * the app through `srd as unknown as Dataset` and the cast believes whatever
 * number it finds.
 *
 * Whether the dataset should have a number of its own - the way campaigns do,
 * for the reason `shared/campaigns.ts` gives at length - is a live question and
 * is the owner's. It is not answered here; what is answered here is that while
 * `Dataset.schemaVersion` is typed off THIS constant, a `Dataset` change that
 * left the constant still would make the number lie about the artifact it is
 * stamped on.
 */
export const SCHEMA_VERSION = 6 as const;

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

/**
 * The three verbs the SRD prints in brackets beside each trait.
 *
 * Straight out of `data/srd-1.0.json`, rule `character-creation`, step 3:
 * "Agility (Use it to Sprint, Leap, Maneuver, etc.)" and its five siblings. The
 * SRD's own spellings are kept - Maneuver and Analyze, not the British forms -
 * because this table has to agree with the rules text the app also ships.
 *
 * It lives beside TRAIT_LABELS rather than in either screen that prints it:
 * character creation names the verbs while you are assigning the array, and the
 * printed sheet names them again beside the finished modifier. Two copies of six
 * triples is how one of them ends up saying Manoeuvre and the other Maneuver.
 */
export const TRAIT_VERBS: Record<Trait, readonly [string, string, string]> = {
  agility: ['Sprint', 'Leap', 'Maneuver'],
  strength: ['Lift', 'Smash', 'Grapple'],
  finesse: ['Control', 'Hide', 'Tinker'],
  instinct: ['Perceive', 'Sense', 'Navigate'],
  presence: ['Charm', 'Perform', 'Deceive'],
  knowledge: ['Recall', 'Analyze', 'Comprehend'],
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
  /*
   * SRD 2.0's tenth domain, APPENDED and not sorted into place.
   *
   * `dread` belongs between `codex` and `grace` alphabetically, and putting it
   * there would be a data-loss bug. `src/transfer/codec.ts` writes
   * `DOMAINS.indexOf(domain) + 1` as a u8 and reads it back positionally, so
   * this array's ORDER IS THE WIRE FORMAT: inserting in the middle shifts every
   * later domain by one, and every QR ever generated and every `.dhchar` ever
   * saved would decode a Grace multiclass as Midnight. Silently - the frame
   * carries an integer and nothing else.
   *
   * Alphabetical order is a display concern, and `DOMAINS_FOR_DISPLAY` below is
   * where it is served. Nothing sorts THIS.
   */
  'dread',
] as const;

/**
 * The domains in the order a person should meet them.
 *
 * Separate from `DOMAINS` because that one's order is the wire format and must
 * never move, and because leaving the two implicit got it wrong immediately:
 * the card grid already sorted its rows by `domain.localeCompare`, while the
 * filter rail above it and the shape legend in Settings both mapped `DOMAINS`
 * raw. Appending `dread` therefore put it between Codex and Grace in the grid
 * and last, after Valor, in the chips over the same grid on the same screen.
 *
 * Sorted once here rather than at each call site so the next screen that lists
 * domains cannot pick the wrong one by omission.
 */
export type DomainId = (typeof DOMAINS)[number];

export const DOMAINS_FOR_DISPLAY: readonly DomainId[] = [...DOMAINS].sort((a, b) =>
  a.localeCompare(b),
);

export const RANGES = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'] as const;
export type Range = (typeof RANGES)[number];

/**
 * The damage-type cell, in the spellings the books print.
 *
 * Four members for three states, and the fourth is not redundant. A weapon that
 * deals EITHER kind is printed two ways: SRD 1.0's one such weapon says
 * `d10+7 phy or mag` (Ghostblade, folio 49) and SRD 2.0's four say `d8 phy/mag`
 * (Shadowblade and three more). They are one game state in two typographies.
 *
 * **They are kept apart rather than folded**, and that is a decision with a
 * cost on each side. Folding them into a single `either` member would be this
 * contract inventing a spelling neither book prints - the exact move that put
 * two rules sections into `data/srd-1.0.json` under names our own parser made
 * up, which then took a measurement to disprove. Keeping them apart means a
 * consumer that wants "does this deal magic damage" has two strings to know
 * about instead of one, and every consumer today asks `=== 'mag'`, so both
 * either-kind spellings read as physical.
 *
 * That last sentence is a defect, not a design: a Ghostblade CAN be swung as a
 * magic weapon and the app says it cannot. It is out of this lane's reach
 * because the fix is a choice on the character sheet, not a shape here. What
 * this bump changes is only that the state is now sayable and `tsc` can see it;
 * before, `shared/parsers/equipment.ts` reached the dataset through
 * `m[2] as DamageKind` and the contract was quietly wrong on four records.
 */
export type DamageKind = 'phy' | 'mag' | 'phy or mag' | 'phy/mag';

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

/**
 * Which printed product an entry comes from.
 *
 * `core` is the Daggerheart Core Set - the box on a shelf. `expansion` is the
 * Hope & Fear Expansion Set. SRD 2.0 fences the two explicitly, four times, in
 * sentences of the form "the Daggerheart Core Set includes only the following
 * ancestries: ..."; SRD 1.0 makes no such distinction anywhere, which is why
 * this is optional rather than defaulted. Absent means THE BOOK DID NOT SAY,
 * and that is a different fact from `core`.
 */
export type ProductSet = 'core' | 'expansion';

export interface Sourced {
  provenance?: Provenance;
  /** Printed folio in the source book, for "look it up" affordances. */
  sourcePage?: number;
  /** Which product carries this. Absent when the source book does not fence them. */
  set?: ProductSet;
  /**
   * The optional rules module this belongs to, for content that is not part of
   * the base rules at all - SRD 2.0's Everyday Hero, Western and Monster
   * Hunting chapters print weapons and armor that a table using the base rules
   * never sees. Absent means base content, which is the overwhelming majority.
   *
   * ## The value is the book's own contents-page title, verbatim
   *
   * Exactly three strings occur in SRD 2.0, and they are what
   * `parseContents(pages)` already hands back:
   *
   *     'Everyday Hero Starting Equipment'   folio 191
   *     'Western Campaigns'                  folio 197
   *     'Monster Hunting Campaigns'          folio 201
   *
   * Pinned here because two lanes need to agree on it and because the tidier
   * answer is a trap. The obvious move is to store `'Everyday Hero'`,
   * `'Western'` and `'Monster Hunting'` - which is how every document in this
   * repository, including the decision that ordered this field, writes them.
   * Those three names are not in the book. Producing them means trimming
   * `Starting Equipment` off one entry and `Campaigns` off two, which is a
   * parser renaming its source: the same move that put two sections into
   * `data/srd-1.0.json` under headings our own `rules.ts` invented, went
   * unnoticed for a printing, and had to be disproved by measurement rather
   * than by reading.
   *
   * Not a slug, for the same reason `Ancestry.family` is not one: this is drawn
   * on screen, and a slug would need a slug-to-label table somewhere to be
   * drawable - a second place holding the same three strings, and the one that
   * goes stale.
   *
   * Not a union type either. A closed union is what the CODE can represent; a
   * fourth module in SRD 3 would then reach the dataset through a cast or not
   * at all, which is the failure mode this whole bump is repairing.
   *
   * ## A module is a different axis from `set`, not a third member of it
   *
   * `set` answers *which box did I buy* - Core Set or Hope & Fear Expansion -
   * and SRD 2.0 fences it in prose, four times, for content that is in play at
   * every table that owns it. `module` answers *is this subsystem switched on
   * at our table*, which is the GM's call and has nothing to do with what
   * anyone owns: the Western chapter is in the same free SRD as the Core Set
   * ancestries.
   *
   * They intersect rather than nest, and a filter needs both. Folding a module
   * into `ProductSet` would put "I do not own this" and "we are not playing
   * with this" on one switch, so a player who owns only the Core Set and whose
   * table is running Monster Hunting could not express their situation at all -
   * and the ownership filter that DECISIONI §4 asks Settings for would silently
   * become a rules filter as well. Their shapes differ for the same reason:
   * `set` is a closed two-member union the book states, `module` is an open
   * list of chapters a later printing can add to.
   */
  module?: string;
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
  flavorText?: string;
}

/** A named block of rules text. The engine renders it and never runs it. */
export interface Feature {
  name: string;
  text: string;
  /**
   * Adversary/environment features carry a kind in their heading.
   *
   * `Evolution` is SRD 2.0's fourth, and it is a different sort of word from
   * the other three. Action, Reaction and Passive say WHEN a feature fires; an
   * Evolution says the stat block becomes a different creature - the Roc's
   * `Nest Warden`, the Vampire Lord's `Hellwing`, the Mountain Troll's enraged
   * form, Adonix's `Alpha to Omega`, the Phoenix's `Resurrection`, the
   * Cephilith Titan's `It's Here…`. Six blocks carry one.
   *
   * It goes in this union anyway rather than becoming a field of its own,
   * because the BOOK sets it in the same slot with the same punctuation
   * (`Nest Warden - Evolution: ...`), and a parser that had to sort the fourth
   * word into a different field would be reading a distinction the typography
   * does not make. What the Evolution being a state change buys is the field
   * below.
   */
  kind?: 'Action' | 'Reaction' | 'Passive' | 'Evolution';
  /** Level at which a class/subclass feature is gained, when stated. */
  level?: number;
  /**
   * Features the book sets INDENTED beneath this one, and which the creature
   * does not have until the parent fires.
   *
   * Seven of them in SRD 2.0, under four Evolutions - Mountain Troll x1, Roc
   * x2, Vampire Lord x2, Adonix x2 - and none in SRD 1.0. `shared/parsers/
   * adversaries.ts` measured the signal and it is indent and nothing else: 417
   * of 417 feature headings in SRD 1.0 sit exactly on the block's column, and
   * 905 of 912 in SRD 2.0; the seven that do not are indented by 6pt and every
   * one of them sits under an Evolution.
   *
   * Until this field existed they were appended to the parent's text as extra
   * paragraphs, which is a wrong record that nothing throws on: the block
   * parses, the roster agrees, and at the table a GM reads `Wrathful` as
   * something the Roc has had since initiative rather than something it gains.
   *
   * ## Why `features` and not `subfeatures`
   *
   * Because the book's own sentence is "it gains the following features:" - a
   * nested feature IS a feature, with a name, a body and sometimes a kind of
   * its own. Same word and same type means one renderer, applied recursively,
   * where a second name would invite a second renderer that drifts from the
   * first. The recursion is not a promise of arbitrary depth; it is a promise
   * that whatever depth a book prints, this can hold without another bump.
   *
   * Optional, and absent rather than `[]` when there is no nesting, so a
   * schema-5 record and a schema-6 record of an unnested feature are the same
   * bytes. That is what keeps `data/srd-1.0.json` free of 417 empty arrays.
   */
  features?: Feature[];
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
  /**
   * The group an ancestry is printed under, when the book prints one.
   *
   * SRD 2.0 gathers Earthkin, Emberkin, Skykin and Tidekin beneath an ELEMENTAL
   * KIN heading that has its own prose and NO features of its own - the four
   * carry theirs individually. So the family is real and is not a fifth
   * ancestry, which is why it is a field here rather than a record of its own:
   * a `families` collection would be one entry, no mechanics, and a second
   * thing for every consumer to learn.
   */
  family?: string;
}

export interface Community extends Sourced {
  id: Ref;
  name: string;
  description: string;
  /** Adjective list from "you likely..." prose. */
  traits: string[];
  feature: Feature;
}

/**
 * One of SRD 2.0's transformation cards. Six of them, folios 43-45.
 *
 * Read off the page before this shape was chosen, not from a summary of it.
 * The chapter opens on folio 42 with a `TRANSFORMATIONS` chapter head and a
 * `GRANTING TRANSFORMATIONS` subhead - both of which are prose for the GM and
 * belong in `rules`, not here - and then prints six cards on three folios, two
 * to a page, one per column: DEMIGOD and GHOST (43), REANIMATED and
 * SHAPESHIFTER (44), VAMPIRE and WEREWOLF (45). The contents page lists
 * `Transformations` at folio 42 among CORE MATERIALS, beside `Ancestries` (32)
 * and `Communities` (38), which is why this is a collection of its own rather
 * than a shape hung off one of those.
 *
 * Each card is, in the book's own order: a display name; two or three
 * paragraphs of prose; a `TRANSFORMATION FEATURES` banner; a
 * `TRANSFORMATION QUESTIONS` banner over a bulleted list. Every one of the six
 * prints exactly two features and exactly six questions - measured on the
 * three folios, twelve features and thirty-six questions in all.
 *
 * ## Why `features` is an array and not `[Feature, Feature]`
 *
 * `Ancestry` uses the tuple, so the tuple was the obvious move and is the wrong
 * one. Two features per card is what THIS printing does; two features per
 * ancestry is what both printings do, in the chapter character creation cannot
 * be completed without. A tuple here would make the first card that prints one
 * feature or three into a parser that must either invent a feature or throw -
 * and this whole chapter is content the book itself calls optional and hands
 * the GM to give out. It is one book old. `Feature[]` costs a consumer an
 * `.length` check it would want anyway.
 *
 * ## Why the questions are `string[]` and not `Feature[]`
 *
 * They are prompts with no name and no mechanics, exactly like
 * `CharClass.backgroundQuestions` and `CharClass.connectionQuestions`, and they
 * are stored the way those are. Named `questions` rather than
 * `transformationQuestions` because the banner's first word is the record's own
 * type; repeating it would be the only stutter in this file.
 *
 * ## What is NOT here
 *
 * Anything about a character HAVING one. Folio 42 states two rules that will
 * need somewhere to live - "Transformation cards do not count toward your
 * loadout maximum" and "A PC can't have more than one transformation" - and
 * both are facts about `Character`, not about the card. Adding a field to
 * `Character` for them means a codec decision (`src/transfer/codec.ts` carries
 * refs as registry ids on a wire that has no room reserved) and a screen to
 * choose one on, neither of which is this lane's. A field nobody writes and
 * nobody reads is decoration, and this repository has already shipped one of
 * those and had it named in review.
 */
export interface Transformation extends Sourced {
  id: Ref;
  name: string;
  /** The card's prose, verbatim. */
  description: string;
  /** Under `TRANSFORMATION FEATURES`. Two on every card the book prints. */
  features: Feature[];
  /** Under `TRANSFORMATION QUESTIONS`; the bulleted prompts, one per entry. */
  questions: string[];
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
  /** `null` where the stat block says `None`: the SRD's 16 Minions, no others. */
  thresholds: [number, number] | null;
  hp: number;
  /**
   * `null` where the stat block says `Stress: None` - one block in SRD 2.0,
   * none in SRD 1.0.
   *
   * Spellbound Armor (SRD 2.0 folio 110) prints it, and its own Tireless
   * feature says why: *"The Armor can't be forced to mark Stress."* It was
   * stored as `0` behind a `NO_STRESS_TRACK` constant in
   * `shared/parsers/adversaries.ts`, whose own docblock asked for this bump and
   * said the honest fix was `number | null`.
   *
   * Zero and absent are different states and the difference shows on a GM's
   * screen: a zero-box Stress track is a creature whose Stress you have not
   * been able to mark YET - it is what every Minion looks like a moment before
   * the roll - while `None` is a creature that has no such track at all. The
   * shape is the one `thresholds` two lines up already uses for the same word
   * on the same printed line, which is the strongest argument available for it:
   * one stat block, one spelling of `None`, one representation.
   */
  stress: number | null;
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
  /**
   * Markdown-ish: paragraphs, `- ` bullets, `## ` subheads, and **pipe
   * tables** - twelve of them across seven sections.
   *
   * The tables were missing from this sentence for a year, and that is a large
   * part of why the benchmark tables a GM looks up by hand had no screen:
   * anyone reading this type saw three shapes, the parser beside it read three
   * shapes, and a table came through `paragraphs()` as one undifferentiated
   * string. `src/ui/shared/ruleText.ts` reads all four.
   */
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
  /**
   * SRD 2.0's six transformation cards. **Empty for SRD 1.0**, which has no
   * such chapter, and empty is the honest value: it is the same fact as an
   * empty `Dataset.layers` would be, not a hole.
   *
   * Required rather than optional, unlike every field this bump adds to an
   * existing record type. A `Dataset` is not a stored record - it is rebuilt by
   * `npm run build:srd` from a book and shipped inside the bundle, so there is
   * no old one to stay valid - and making it optional would buy nothing except
   * a `?? []` at every call site forever, in the one collection out of fifteen
   * that has one.
   */
  transformations: Transformation[];
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
  /**
   * Physical or magic, which the player chooses.
   *
   * Folio 18, step 4: *"Choose whether they deal physical or magic damage."*
   * Until this field existed `damageTypeOf` answered `phy` for every companion
   * and a comment called it the SRD's default - which is true of an unarmed
   * attack and was never true of this sheet, where the book asks the question
   * outright.
   */
  damageType: 'phy' | 'mag';
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

  /**
   * Short rests taken in a row, cleared by a long rest.
   *
   * The SRD's rule is about the party - three short rests in a row and the next
   * rest must be a long one - and this app holds one sheet per device, so what
   * it can honestly count is what this sheet did. `mustTakeLongRest` has read
   * this number since `engine/rest.ts` was written and nothing has ever
   * persisted it, which meant the refusal could never fire: the count was
   * recomputed as zero on every render.
   *
   * Not carried by the QR codec. A sheet that arrives by QR arrives at zero,
   * so nothing on screen may present this number as a history of the table.
   */
  consecutiveShortRests: number;

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
  /**
   * Persisted, read back, written back, and drawn by nothing. On purpose.
   *
   * `addCountdown` seeds it `''` (`src/ui/gm/gmStore.ts`), `readCountdown`
   * carries it through every load (`shared/campaigns.ts`), and the frozen v1
   * fixture holds a non-empty one — so the bytes survive, and a campaign
   * written by a build that *did* draw the field would keep it. What no screen
   * does is show it, and `grep -rn 'countdown.notes' src/` is empty.
   *
   * That was a gap (`BACKLOG.md` P5-2, «persisted, read, rendered nowhere»)
   * until 2026-08-18, when it became a decision. The prose a GM wants at the
   * table is formatted — bold, bullets, a centred heading — and it belongs to
   * a scene or a session, not to a clock. It has a row of its own now: the
   * `note` kind of `SessionItem`, carrying a `NoteDoc` from
   * `shared/richText.ts`. Drawing a second, plainer note field on the countdown
   * beside it would put two note surfaces in one list disagreeing about what a
   * note is, which costs more than the absence does.
   *
   * The same decision withdrew the «history» that backlog line asked for:
   * there is no undo here and no dated register.
   *
   * `CAMPAIGN_MIGRATIONS` did move that afternoon, and it is worth saying why
   * that is not this field's doing. The chain gained its first entry because
   * the `note` row and the `url` row are *new kinds* an older build would wrap
   * as `unreadable` and then write back over — so the version had to move to
   * make that build quarantine the record instead. Nothing about `notes`
   * changed, and the converter changes no field at all.
   *
   * Not deleted, and deleting it is not a cleanup. `readCountdown` rebuilds
   * this object field by field and drops every key it does not name, so a
   * build without `notes` would erase it from every stored campaign on the
   * next 400ms write — a schema change wearing a tidy-up's clothes. If it is
   * ever really to go, it goes through the migration chain like anything else.
   *
   * **It now has neighbours, and they are not it.** `CAMPAIGN_SCHEMA_VERSION` 3
   * gave this object the Activation / Advancement / Effect triad below. That
   * does not reopen the decision above and does not make `notes` drawable: what
   * :2117 rejected was *a second plain free-text box*, and three named fields
   * answering three named questions are a different shape doing a different
   * job. The prose a GM wants at the table still belongs to the `note` row.
   */
  notes: string;
  /**
   * Activation / Advancement / Effect — the triad, `CAMPAIGN_SCHEMA_VERSION` 3.
   *
   * The three questions that keep a clock legible an hour later and let a GM
   * resume one next session: what starts it, what moves it, and what happens
   * when it fills. All three are structure the GM types; nothing here is ever
   * quoted from the book, which is why the triad costs the licence nothing.
   *
   * Plain strings and not a `NoteDoc`, deliberately. A `NoteDoc` is the answer
   * where the GM wants *prose* - bold, bullets, a centred heading - and that is
   * the `note` row's job. These are three short answers to three fixed
   * questions, and giving them a block editor apiece would put four note
   * surfaces on one sheet disagreeing about what a note is.
   *
   * Empty is the honest default and the only thing every clock written before
   * schema 3 can be. Nothing derives from them and nothing validates them: a
   * clock with three blank fields behaves exactly as it did at schema 2.
   */
  activation: string;
  advancement: string;
  effect: string;
  /**
   * Whose clock this is. A `PartyMember` id, or `''` for nobody's.
   *
   * The same correction as `eb4c60e`, which made the dice pools ask whose sheet
   * a die is for: with three or four projects running, unowned clocks are
   * indistinguishable from each other. A ref rather than a name, so renaming a
   * character does not orphan the sentence.
   *
   * **Not a foreign key, and the reader does not check it.** A party member can
   * be removed while a clock still names them, and that is the same class of
   * thing as `LinkTarget`'s `unknown` arm: the screen says "somebody who is no
   * longer on the party board" rather than the field being silently emptied by
   * a read. Emptying it would destroy the GM's own data to satisfy an invariant
   * nobody asked for.
   */
  owner: string;
  /**
   * One written beat per tick, for a `long-term` clock.
   *
   * A rest that advances a long-term countdown should produce *a sentence to
   * narrate*, not a decrement. Index 0 is the first tick. The array is allowed
   * to be shorter than `start` - a GM who has written the first two beats and
   * not the rest is the normal case, not an error - and it is allowed to be
   * longer, because shortening a clock must not throw away words that were
   * typed.
   *
   * Empty for every clock written before schema 3, and empty is what a clock of
   * any other kind keeps: the field exists on all four kinds because the kind is
   * editable, and moving a clock to `long-term` and back must not lose the
   * beats typed in between.
   */
  beats: string[];
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
