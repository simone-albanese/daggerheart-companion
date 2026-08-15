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
import { TRAITS, TRAIT_LABELS } from '../../../shared/types.ts';
import {
  deriveStats,
  weaponDamage,
  type DatasetIndex,
  type DerivedStats,
} from '../../engine/character.ts';
import { SEVERITY_HP, SEVERITY_LABEL, type Severity } from '../../engine/damage.ts';
import { formatGold, MAX_CHESTS, PER_STEP } from '../../engine/gold.ts';
import { resolveCards } from '../../engine/loadout.ts';
import type { TrackKind } from '../shared/Track.tsx';

export interface SheetTrait {
  trait: Trait;
  label: string;
  value: number;
  /** Marked for this tier's advancement. Printed as a box, ticked or not. */
  marked: boolean;
  spellcast: boolean;
}

export interface SheetTrack {
  kind: TrackKind;
  label: string;
  /** How many boxes to draw. Zero means the character has no such track. */
  boxes: number;
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
  lineage: string;

  traits: SheetTrait[];
  evasion: number;
  thresholds: [number, number];
  proficiency: number;
  /** Minor/Major/Severe, and Massive when the table has turned it on. */
  ladder: Array<{ label: string; from: string; hp: number }>;
  tracks: SheetTrack[];

  weapons: SheetWeapon[];
  armor: SheetArmor | null;

  loadout: DomainCard[];
  loadoutLimit: number;
  vaultCount: number;
  /** Refs this dataset could not resolve. Shown, never silently dropped. */
  missing: string[];

  experiences: Experience[];
  gold: SheetGold;
  inventory: InventoryEntry[];
  features: SheetFeature[];
}

export interface SheetOptions {
  /** The optional Massive Damage rule, from the table's preferences. */
  massiveDamageRule?: boolean;
}

const sign = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

const named = (value: unknown): string | undefined =>
  (value as { name?: string } | undefined)?.name;

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

  const klass = index.classes.get(character.classRef);
  const multiclass = character.multiclassRef ? index.classes.get(character.multiclassRef) : undefined;
  const subclasses = character.subclassRefs
    .map((r) => index.subclasses.get(r))
    .filter((s): s is Subclass => s !== undefined);

  const classNames = [klass?.name, multiclass?.name].filter(Boolean).join(' / ');
  const headline = [classNames === '' ? 'No class' : classNames, subclasses.map((s) => s.name).join(' · ')]
    .filter((part) => part !== '')
    .join(' — ');

  const lineage = [
    ...character.ancestryRefs.map((r) => named(index.byRef.get(r))),
    named(index.byRef.get(character.communityRef ?? '')),
  ]
    .filter(Boolean)
    .join(' · ');

  const ladder = buildLadder(stats, options.massiveDamageRule === true);

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
    lineage,

    traits: TRAITS.map((t) => ({
      trait: t,
      label: TRAIT_LABELS[t],
      value: stats.traits[t],
      marked: (character.traitMarks[t] ?? 0) > 0,
      spellcast: stats.spellcastTrait === t,
    })),
    evasion: stats.evasion,
    thresholds: stats.thresholds,
    proficiency: stats.proficiency,
    ladder,
    tracks: [
      { kind: 'hp', label: 'Hit Points', boxes: stats.maxHp },
      { kind: 'stress', label: 'Stress', boxes: stats.maxStress },
      { kind: 'hope', label: 'Hope', boxes: stats.maxHope },
      { kind: 'armor', label: 'Armor', boxes: stats.armorScore },
    ],

    weapons: [primary, secondary]
      .filter((w): w is Weapon => w !== undefined)
      .map((w) => describeWeapon(w, stats)),
    armor: armor ? describeArmor(armor) : null,

    loadout: resolveCards(character.loadout, index),
    loadoutLimit: stats.loadoutLimit,
    vaultCount: character.vault.length,
    missing: [...character.loadout, ...character.vault].filter((r) => !index.cards.has(r)),

    experiences: character.experiences,
    gold: {
      ...character.gold,
      perStep: PER_STEP,
      maxChests: MAX_CHESTS,
      summary: formatGold(character.gold),
    },
    inventory: character.inventory,
    features: collectFeatures(character, index, klass, multiclass, subclasses),
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

/**
 * Every feature the character actually has, in the order they were acquired.
 *
 * Which subclass cards are held is read out of `levelUpHistory` rather than
 * inferred from the level: the advancement that takes a specialization is a
 * choice, and a character who spent those two slots elsewhere does not have
 * the card. A mixed ancestry takes the first feature of the first ancestry and
 * the second of the second, which is the SRD's own wording for it.
 */
function collectFeatures(
  c: Character,
  index: DatasetIndex,
  klass: CharClass | undefined,
  multiclass: CharClass | undefined,
  subclasses: Subclass[],
): SheetFeature[] {
  const out: SheetFeature[] = [];
  const push = (source: string, list: Array<{ name: string; text: string }>): void => {
    for (const f of list) out.push({ source, name: f.name, text: f.text });
  };

  if (klass) {
    push(`${klass.name} · Hope`, [klass.hopeFeature]);
    push(klass.name, klass.classFeatures);
  }
  // Multiclassing grants the second class's class feature, not its Hope one.
  if (multiclass) push(`${multiclass.name} · Multiclass`, multiclass.classFeatures);

  for (const sub of subclasses) {
    const cards = new Set(
      c.levelUpHistory
        .filter((h) => h.kind === 'subclass' && h.detail['subclassRef'] === sub.id)
        .map((h) => String(h.detail['card'] ?? '')),
    );
    push(`${sub.name} · Foundation`, sub.foundationFeatures);
    if (cards.has('specialization')) push(`${sub.name} · Specialization`, sub.specializationFeatures);
    if (cards.has('mastery')) push(`${sub.name} · Mastery`, sub.masteryFeatures);
  }

  const ancestries = c.ancestryRefs
    .map((r) => index.byRef.get(r) as Ancestry | undefined)
    .filter((a): a is Ancestry => a !== undefined);
  if (ancestries.length === 1) {
    push(ancestries[0]!.name, ancestries[0]!.features);
  } else if (ancestries.length > 1) {
    const [top, bottom] = ancestries;
    if (top?.features[0]) push(`${top.name} · Mixed`, [top.features[0]]);
    if (bottom?.features[1]) push(`${bottom.name} · Mixed`, [bottom.features[1]]);
  }

  const community = index.byRef.get(c.communityRef ?? '') as Community | undefined;
  if (community) push(community.name, [community.feature]);

  return out;
}

/** `+2` / `−1`, with the minus sign the rest of the app uses. */
export const modifier = sign;
