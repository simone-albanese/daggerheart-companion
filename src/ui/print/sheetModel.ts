/**
 * Everything the printed sheet says, worked out once and handed over as data.
 *
 * Nothing in here decides a rule. Every number comes back out of
 * `src/engine/*` - `deriveStats` for the defences and the track maxima,
 * `weaponDamage` for the die count after Proficiency, `SEVERITY_HP` for what a
 * hit costs, `gold.ts` for how many boxes a purse has. The file's own job is
 * selection and wording, which is the part that differs between a screen you
 * tap and a page you write on.
 *
 * Keeping it separate from the layout is also what makes it testable: the
 * assertion that a Proficiency 3 character prints `3d8+2` is a string
 * comparison in Node, with no DOM anywhere near it.
 */
import type {
  Ancestry,
  Armor,
  CharClass,
  Character,
  Community,
  Dataset,
  DomainCard,
  Experience,
  InventoryEntry,
  Subclass,
  Trait,
  Weapon,
} from '../../../shared/types.ts';
import { TRAITS, TRAIT_LABELS, TRAIT_VERBS } from '../../../shared/types.ts';
import {
  BASE_HOPE,
  deriveStats,
  MAX_HP,
  MAX_LEVEL,
  MAX_STRESS,
  weaponDamage,
  type DatasetIndex,
  type DerivedStats,
} from '../../engine/character.ts';
import { companionDamage, companionUpgradeAllowance } from '../../engine/companion.ts';
import { characterFeatures } from '../../engine/features.ts';
import { SEVERITY_HP, SEVERITY_LABEL, type Severity } from '../../engine/damage.ts';
import { formatGold, MAX_CHESTS, PER_STEP } from '../../engine/gold.ts';
import { tierAchievementFor } from '../../engine/levelUp.ts';
import { resolveCards } from '../../engine/loadout.ts';
import { companionUpgrades } from '../shared/srdReference.ts';
import type { TrackKind } from '../shared/Track.tsx';

export interface SheetTrait {
  trait: Trait;
  label: string;
  value: number;
  /** The SRD's three verbs, joined. "Sprint · Leap · Maneuver". */
  verbs: string;
  /** Marked for this tier's advancement. Printed as a box, ticked or not. */
  marked: boolean;
  spellcast: boolean;
}

export interface SheetTrack {
  kind: TrackKind;
  label: string;
  /** How many boxes to draw solid. Zero means the character has no track. */
  boxes: number;
  /**
   * Boxes past the current maximum, drawn dashed.
   *
   * Stolen from the paper sheet, and the best idea on it: the printed HP and
   * Stress tracks run to twelve whatever your maximum is, with the slots you
   * have not earned yet drawn as broken outlines. It answers a question the app
   * cannot answer anywhere else - *how much room is left* - without ever
   * implying you have a slot you do not.
   */
  growth: number;
  /**
   * Slots crossed out for good. Hope only, one per scar.
   *
   * The SRD's death moves say a scar means "permanently cross out a Hope slot",
   * so a scarred Hope track is six diamonds with some of them struck through -
   * not four diamonds, which would lose the fact that this character used to
   * have six.
   */
  crossed: number;
}

export interface SheetWeapon {
  name: string;
  slot: Weapon['slot'];
  /** Damage with Proficiency already multiplied into the die count. */
  damage: string;
  /** The line under the name: trait, range, physical or magic, burden. */
  meta: string;
  feature: string;
}

export interface SheetArmor {
  name: string;
  score: number;
  baseThresholds: [number, number];
  feature: string;
}

export interface SheetFeature {
  /** Where it came from, e.g. "Wizard" or "School of Knowledge · Mastery". */
  source: string;
  name: string;
  text: string;
}

export interface SheetGold {
  handfuls: number;
  bags: number;
  chests: number;
  /** Boxes per row: ten handfuls to a bag, ten bags to a chest. */
  perStep: number;
  maxChests: number;
  summary: string;
}

export interface PrintSheet {
  name: string;
  pronouns: string;
  level: number;
  tier: number;
  headline: string;
  /** Ancestry (or both) and community, the SRD's own Heritage field. */
  heritage: string;

  traits: SheetTrait[];
  evasion: number;
  /** Where Evasion came from, in the sheet's own words. */
  evasionNote: string;
  armorScore: number;
  thresholds: [number, number];
  /** Whether the level is already in the thresholds, or a hand-set override. */
  thresholdNote: string;
  proficiency: number;
  /** Minor/Major/Severe, and Massive when the table has turned it on. */
  ladder: Array<{ label: string; from: string; hp: number }>;
  tracks: SheetTrack[];
  /** What the dashed boxes on the HP and Stress tracks mean. */
  growthNote: string;
  /** What a Hope is spent on, and what a crossed-out slot means. */
  hopeNote: string;
  /**
   * The class's Hope feature, printed beside the Hope track rather than filed
   * with everything else - it is the one feature that is *about* this track.
   */
  hopeFeature: SheetFeature | null;

  weapons: SheetWeapon[];
  armor: SheetArmor | null;
  /** Blank rows for weapons carried but not equipped. See `WEAPON_LINES`. */
  weaponLines: number;

  loadout: DomainCard[];
  loadoutLimit: number;
  vaultCount: number;
  /** Refs this dataset could not resolve. Shown, never silently dropped. */
  missing: string[];

  experiences: Experience[];
  /** Total Experience rows to draw, the held ones plus blanks to write on. */
  experienceLines: number;
  gold: SheetGold;
  inventory: InventoryEntry[];
  features: SheetFeature[];
  /** The Ranger Companion sheet, for the one subclass that has one. */
  companion: SheetCompanion | null;
}

/**
 * The companion, as a page.
 *
 * The SRD prints this as a sheet of its own that a player tucks under the right
 * side of theirs, and this app printed it nowhere at all: a Beastbound Ranger
 * took a printout to the table with a whole creature missing from it.
 *
 * IT IS NOT DROPPED THE WAY A BEASTFORM IS, and the difference is the one
 * `buildSheet` opens with. A Beastform is a state - a Druid would come back to
 * a page saying their Evasion is 14 because they were a bear on Tuesday - so
 * the printout is the character at rest. A companion is not a state; it is the
 * other half of the sheet, and it is as true in a folder a month from now as it
 * is mid-scene.
 *
 * The damage is printed with Proficiency applied, because that is the number
 * rolled: *"their damage roll uses your Proficiency and their damage die."*
 */
export interface SheetCompanion {
  name: string;
  description: string;
  evasion: number;
  stressSlots: number;
  /** With the character's Proficiency in it, as it will be rolled. */
  damage: string;
  range: string;
  damageType: 'phy' | 'mag';
  experiences: Experience[];
  /** Every option the dataset carries, with the ones this sheet has marked. */
  upgrades: Array<{ id: string; name: string; text: string; marked: boolean }>;
  /** Boxes earned so far. A readout on paper as much as on glass. */
  allowance: number;
}

export interface SheetOptions {
  /** The optional Massive Damage rule, from the table's preferences. */
  massiveDamageRule?: boolean;
}

const sign = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

const named = (value: unknown): string | undefined =>
  (value as { name?: string } | undefined)?.name;

/**
 * Experience rows a campaign can fill, worked out rather than counted off the
 * paper sheet.
 *
 * Character creation gives two. `tierAchievementFor` grants one more on
 * entering each new tier - levels 2, 5 and 8 - so a level 10 character has
 * five, which is how many ruled lines the sheet needs. Derived from the engine
 * so that a rules change moves the sheet with it, and so the number is not a
 * literal somebody has to remember to keep true.
 */
const STARTING_EXPERIENCES = 2;

const EXPERIENCE_LINES: number =
  STARTING_EXPERIENCES +
  Array.from({ length: MAX_LEVEL }, (_, i) => tierAchievementFor(i + 1)).filter(
    (a) => a?.newExperience === true,
  ).length;

/**
 * Blank rows for weapons carried but not wielded.
 *
 * The character model has exactly two weapon slots and no notion of a weapon in
 * the pack: `Character.inventory` holds loot and consumables, and `ItemPicker`
 * is the only thing that writes to it. So this block cannot be filled in from
 * the app - it is pencil room, and three rows is what fits beside the inventory
 * without pushing the page. The moment the model can hold a stowed weapon, this
 * constant is what the printed rows stop being.
 */
const WEAPON_LINES = 3;

/**
 * The companion's page, or null for the sheets that have no animal.
 *
 * Built off `resting` like everything else on this page - the Proficiency a
 * companion's damage uses is the character's, and a Beastform does not change
 * it, but taking it from the same stats the rest of the page is derived from is
 * what keeps one printout internally consistent.
 */
function printedCompanion(
  character: Character,
  dataset: Dataset,
  index: DatasetIndex,
  stats: DerivedStats,
): SheetCompanion | null {
  const companion = character.companion;
  if (companion === null) return null;
  const rolled = companionDamage(companion, stats.proficiency);
  return {
    name: companion.name,
    description: companion.description,
    evasion: companion.evasion,
    stressSlots: companion.stress.max,
    // The unmultiplied string when it will not parse, rather than a blank: the
    // sheet says what the player typed and lets them see it is wrong.
    damage: rolled?.spec ?? companion.damage,
    range: companion.range,
    damageType: companion.damageType,
    experiences: companion.experiences,
    upgrades: companionUpgrades(dataset.rules).map((u) => ({
      ...u,
      marked: companion.upgrades.includes(u.id),
    })),
    allowance: companionUpgradeAllowance(character, index),
  };
}

export function buildSheet(
  character: Character,
  dataset: Dataset,
  index: DatasetIndex,
  options: SheetOptions = {},
): PrintSheet {
  /*
   * A Beastform is a state, not a fact. `deriveStats` layers it over the
   * traits and Evasion at read time, which is right on a screen you are
   * looking at mid-scene and wrong on a page that will sit in a folder for a
   * month - a Druid would come back to a sheet that says their Evasion is 14
   * because they were a bear on Tuesday. The printout is the character.
   */
  const resting: Character = { ...character, beastform: null };
  const stats: DerivedStats = deriveStats(resting, dataset, index);

  const held = characterFeatures(character, index);
  const klass = index.classes.get(character.classRef);
  const multiclass = character.multiclassRef ? index.classes.get(character.multiclassRef) : undefined;
  const subclasses = character.subclassRefs
    .map((r) => index.subclasses.get(r))
    .filter((s): s is Subclass => s !== undefined);

  const classNames = [klass?.name, multiclass?.name].filter(Boolean).join(' / ');
  const headline = [classNames === '' ? 'No class' : classNames, subclasses.map((s) => s.name).join(' · ')]
    .filter((part) => part !== '')
    .join(' — ');

  const heritage = [
    ...character.ancestryRefs.map((r) => named(index.byRef.get(r))),
    named(index.byRef.get(character.communityRef ?? '')),
  ]
    .filter(Boolean)
    .join(' · ');

  const ladder = buildLadder(stats, options.massiveDamageRule === true);

  /*
   * Both notes exist because the paper sheet prints its derivation next to the
   * number - Evasion is captioned with the class's starting value, thresholds
   * with the instruction to add your level - and an app that prints the answer
   * without the derivation has taken away the only way to check it.
   *
   * Neither may be printed unconditionally. `Character` carries an override for
   * each, and a sheet that says "level 5 is already added" over a pair of
   * numbers somebody typed in by hand is telling the table something untrue
   * about where those numbers came from.
   */
  const evasionNote =
    character.evasionOverride !== null
      ? 'Set by hand on this sheet'
      : klass
        ? `${klass.name} starts at ${klass.startingEvasion}`
        : 'No class on this sheet';
  const thresholdNote =
    character.thresholdOverride !== null
      ? 'Set by hand on this sheet'
      : `Level ${character.level} is already added to both`;

  const hopeSpend = 'Spend a Hope to Help an Ally or Utilize an Experience.';
  const scars = character.scars.length;

  const primary = character.activePrimaryWeapon
    ? index.weapons.get(character.activePrimaryWeapon)
    : undefined;
  const secondary = character.activeSecondaryWeapon
    ? index.weapons.get(character.activeSecondaryWeapon)
    : undefined;
  const armor = character.activeArmor ? index.armors.get(character.activeArmor) : undefined;

  return {
    name: character.name.trim() === '' ? 'Unnamed' : character.name,
    pronouns: character.pronouns,
    level: character.level,
    tier: stats.tier,
    headline,
    heritage,

    traits: TRAITS.map((t) => ({
      trait: t,
      label: TRAIT_LABELS[t],
      value: stats.traits[t],
      verbs: TRAIT_VERBS[t].join(' · '),
      marked: (character.traitMarks[t] ?? 0) > 0,
      spellcast: stats.spellcastTrait === t,
    })),
    evasion: stats.evasion,
    evasionNote,
    armorScore: stats.armorScore,
    thresholds: stats.thresholds,
    thresholdNote,
    proficiency: stats.proficiency,
    ladder,
    /*
     * Only HP and Stress grow. Hope's ceiling is fixed at six and can only ever
     * fall - a scar crosses a slot out - so dashing anything there would offer
     * the player room the rules never give them back. Armor Score is a property
     * of the armor you are wearing, not a track you level into, so the same
     * applies: its boxes are the slots this armor has and there is no more.
     */
    tracks: [
      {
        kind: 'hp',
        label: 'Hit Points',
        boxes: stats.maxHp,
        growth: Math.max(0, MAX_HP - stats.maxHp),
        crossed: 0,
      },
      {
        kind: 'stress',
        label: 'Stress',
        boxes: stats.maxStress,
        growth: Math.max(0, MAX_STRESS - stats.maxStress),
        crossed: 0,
      },
      {
        kind: 'hope',
        label: 'Hope',
        boxes: stats.maxHope,
        growth: 0,
        crossed: Math.min(scars, BASE_HOPE),
      },
      { kind: 'armor', label: 'Armor', boxes: stats.armorScore, growth: 0, crossed: 0 },
    ],
    growthNote:
      `Dashed boxes are the slots advancements can still add: ` +
      `${MAX_HP} Hit Points and ${MAX_STRESS} Stress at most.`,
    hopeNote:
      scars === 0
        ? hopeSpend
        : `${hopeSpend} ${scars} scar${scars === 1 ? '' : 's'}: a crossed-out slot is gone for good.`,
    hopeFeature: klass ? { source: klass.name, ...klass.hopeFeature } : null,

    weapons: [primary, secondary]
      .filter((w): w is Weapon => w !== undefined)
      .map((w) => describeWeapon(w, stats)),
    armor: armor ? describeArmor(armor) : null,
    weaponLines: WEAPON_LINES,

    loadout: resolveCards(character.loadout, index),
    loadoutLimit: stats.loadoutLimit,
    vaultCount: character.vault.length,
    missing: [...character.loadout, ...character.vault].filter((r) => !index.cards.has(r)),

    experiences: character.experiences,
    experienceLines: Math.max(EXPERIENCE_LINES, character.experiences.length),
    gold: {
      ...character.gold,
      perStep: PER_STEP,
      maxChests: MAX_CHESTS,
      summary: formatGold(character.gold),
    },
    inventory: character.inventory,
    // Mapped down to the three fields the page prints, rather than handed
    // over whole: `HeldFeature` also carries a `site` and a `ref`, which the
    // Play screen groups by and a sheet of paper has no use for.
    features: held.features.map((f) => ({ source: f.source, name: f.name, text: f.text })),
    companion: printedCompanion(character, dataset, index, stats),
  };
}

/**
 * What a hit costs, in the printed sheet's own words.
 *
 * The bands and the HP they cost both come from `damage.ts`; only the phrasing
 * ("below 8", "8+") is added here, because a page cannot be tapped to ask.
 */
function buildLadder(
  stats: DerivedStats,
  massiveDamageRule: boolean,
): PrintSheet['ladder'] {
  const [major, severe] = stats.thresholds;
  const rows: Array<{ severity: Severity; from: string }> = [
    { severity: 'minor', from: `below ${major}` },
    { severity: 'major', from: `${major}+` },
    { severity: 'severe', from: `${severe}+` },
  ];
  if (massiveDamageRule) rows.push({ severity: 'massive', from: `${stats.massiveThreshold}+` });
  return rows.map((row) => ({
    label: SEVERITY_LABEL[row.severity],
    from: row.from,
    hp: SEVERITY_HP[row.severity],
  }));
}

function describeWeapon(weapon: Weapon, stats: DerivedStats): SheetWeapon {
  // `weaponDamage`, not a regex here: a weapon spelled `d10 + 2` has to keep
  // its +2, and the engine is where that is already known and already tested.
  const rolled = weaponDamage(weapon, stats);
  return {
    name: weapon.name,
    slot: weapon.slot,
    damage: rolled?.spec ?? weapon.damage,
    meta: [
      weapon.slot === 'primary' ? 'Primary' : 'Secondary',
      weapon.trait === 'spellcast' ? 'Spellcast' : TRAIT_LABELS[weapon.trait],
      weapon.range,
      weapon.damageType === 'mag' ? 'Magic' : 'Physical',
      `Burden ${weapon.burden}`,
    ].join(' · '),
    feature: weapon.feature,
  };
}

const describeArmor = (armor: Armor): SheetArmor => ({
  name: armor.name,
  score: armor.baseScore,
  baseThresholds: armor.baseThresholds,
  feature: armor.feature,
});

/** `+2` / `−1`, with the minus sign the rest of the app uses. */
export const modifier = sign;
