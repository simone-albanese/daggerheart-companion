/**
 * The static bonuses a sheet's own contents make to its derived numbers, and
 * where each one came from.
 *
 * WHAT THIS EXISTS TO FIX. `deriveStats` computed Evasion as the class's
 * starting value plus the advancements that raise it, and nothing else. A
 * Simiah's *Nimble* - "Gain a permanent +1 bonus to your Evasion at character
 * creation" - did not reach it. Neither did a Gambeson's *Flexible: +1 to
 * Evasion*, a Chainmail's -1, a Greatsword's *Massive*, a Tower Shield's
 * *Barrier*, a Full Plate's -2 and -1 Agility, a Giant's extra Hit Point slot,
 * a Human's extra Stress slot, a Stalwart's thresholds or a carried Relic's +1
 * to a trait. The owner reported it as «il conteggio non sale, resta fermo alla
 * base di classe», and that is exactly what it was: of the static effects the
 * shipped dataset carries, the engine applied the Beastform's and no others.
 *
 * NOTHING HERE READS A FEATURE'S TEXT, and that is the whole architecture.
 * `shared/types.ts` opens with the rule - "Anything the rules leave open to
 * interpretation is stored as text and rendered, never modelled. Only
 * unambiguous arithmetic gets a type" - and `character.ts` restates it as
 * "Nothing here interprets a feature's text". A regex over `feature` would
 * break both: it would read `-1` out of *"Barrier: +2 to Armor Score; -1 to
 * Evasion"* and have no way to know which of the two numbers it had, and it
 * would find nothing at all in *"Gain an additional Hit Point slot at character
 * creation"*, which carries no digit. So the arithmetic is HAND-AUTHORED here,
 * ref by ref, and `tests/engine/modifiers.test.ts` walks the dataset in both
 * directions against it: every row must still match the sentence it was read
 * from, and every sentence that looks like it carries a static bonus must have
 * a row. The register is an auditor, not a checklist.
 *
 * WHAT IS DELIBERATELY ABSENT. A row exists only if the number is true of the
 * sheet at every instant its gate is satisfied, and the gate has to be a fact
 * the sheet STORES rather than a fact about the moment. That excludes, on
 * purpose and with the reason attached:
 *
 *   - Rogue's Dodge (+2 Evasion for 3 Hope, until an attack succeeds) and
 *     Faerie's Wings (+2 against one attack, for a Stress) - both are spends.
 *   - School of War's *Conjure Shield*, "While you have at least 2 Hope, you add
 *     your Proficiency to your Evasion". No cost, no roll, exact arithmetic -
 *     and still out, because the gate is a counter that moves several times a
 *     scene. A number that changes when you spend a Hope is not a number a
 *     sheet can print.
 *   - Buckler's *Deflecting*, Dunamis Silkchain's *Timeslowing*, Irontree
 *     Breastplate's *Reinforced* - all pay an Armor Slot per attack.
 *   - Beastbound's *Battle-Bonded* and Wayfinder's *Elusive Predator* - +2
 *     against one attacker in one circumstance.
 *   - Every potion. A relic is carried and a potion is drunk; "until your next
 *     rest" is a duration, and this file holds no clock.
 *
 * None of these is hidden from the player: they are feature text, and the Play
 * screen prints feature text. What they are not is a term in a total.
 *
 * THE BEASTFORM IS NOT HERE EITHER, and that is not an omission. It was already
 * layered by `deriveStats` at read time before this file existed, it is a state
 * rather than a fact about the character, and it sits ABOVE a manual override
 * where everything here sits below one. `character.ts` keeps it.
 */
import { TRAITS } from '../../shared/types.ts';
import type { Character, Ref, Trait } from '../../shared/types.ts';
import type { DatasetIndex } from './character.ts';

/**
 * A number a row can move.
 *
 * `thresholds` is the register's word and never the ledger's: the SRD says
 * "damage thresholds", plural, and a row that quoted it as two rows would be
 * inventing a sentence. The collector expands it into `major` and `severe`,
 * which are the two numbers a sheet actually prints.
 */
export type RegisterStat =
  | 'evasion'
  | 'maxHp'
  | 'maxStress'
  | 'armorScore'
  | 'thresholds'
  | 'severe'
  | Trait;

/** A number the ledger totals. One per thing the sheet shows. */
export type LedgerStat = Exclude<RegisterStat, 'thresholds'> | 'major';

/**
 * How much, where the amount is not a constant.
 *
 * One value and one case: Galapa's *Shell*, "Gain a bonus to your damage
 * thresholds equal to your Proficiency". It is the reason this is a union and
 * not a number, and it is why the collector takes Proficiency as an argument -
 * `deriveStats` works that out before it gets here.
 */
export type Amount = number | 'proficiency';

interface Row {
  stat: RegisterStat;
  amount: Amount;
  /** The feature's own name, as the book prints it: `Flexible`, `Nimble`. */
  feature: string;
}

/**
 * An ancestry row, with which of the two feature slots grants it.
 *
 * THE SLOT IS LOAD-BEARING AND IT IS THE EASIEST THING HERE TO GET WRONG. The
 * SRD's mixed-ancestry rule takes the FIRST feature of one ancestry and the
 * SECOND of another, which `collectFeatures` in `src/ui/print/sheetModel.ts`
 * already implements for the printed sheet. Simiah's *Nimble* is `features[1]`,
 * so a mixed character who took Simiah as their first ancestry does not have
 * it; Giant's *Endurance*, Human's *High Stamina* and Galapa's *Shell* are all
 * `features[0]`, so they are the half a first ancestry does grant. A register
 * that ignored the slot would hand out four bonuses nobody has.
 */
interface AncestryRow extends Row {
  slot: 0 | 1;
}

/** A subclass row, with the card that grants it. */
interface SubclassRow extends Row {
  card: 'foundation' | 'specialization' | 'mastery';
}

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

/*
 * The four tiers of a weapon or armour print the SAME feature string, so each
 * appears here four times rather than once behind a name match. Matching on the
 * printed name would be a text rule wearing a lookup's clothes, and it would
 * break the moment a layer renamed one.
 */

/** Equipped in the slot the dataset gives the weapon - primary or secondary. */
const WEAPON_MODS: Record<Ref, Row[]> = {
  // Massive: -1 to Evasion; ... (primary)
  greatsword: [{ stat: 'evasion', amount: -1, feature: 'Massive' }],
  'improved-greatsword': [{ stat: 'evasion', amount: -1, feature: 'Massive' }],
  'advanced-greatsword': [{ stat: 'evasion', amount: -1, feature: 'Massive' }],
  'legendary-greatsword': [{ stat: 'evasion', amount: -1, feature: 'Massive' }],
  // Heavy: -1 to Evasion (primary)
  warhammer: [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'improved-warhammer': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'advanced-warhammer': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'legendary-warhammer': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'heavy-frame-wheelchair': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'improved-heavy-frame-wheelchair': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'advanced-heavy-frame-wheelchair': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'legendary-heavy-frame-wheelchair': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  // Brave: -1 to Evasion; +3 to Severe damage threshold (primary)
  bravesword: [
    { stat: 'evasion', amount: -1, feature: 'Brave' },
    { stat: 'severe', amount: 3, feature: 'Brave' },
  ],
  // Cumbersome: -1 to Finesse (primary)
  halberd: [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'improved-halberd': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'advanced-halberd': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'legendary-halberd': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  longbow: [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'improved-longbow': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'advanced-longbow': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  'legendary-longbow': [{ stat: 'finesse', amount: -1, feature: 'Cumbersome' }],
  // Destructive: -1 to Agility; ... (primary)
  'sledge-axe': [{ stat: 'agility', amount: -1, feature: 'Destructive' }],
  // Protective: +N to Armor Score - one axe and the four round shields.
  'labrys-axe': [{ stat: 'armorScore', amount: 1, feature: 'Protective' }],
  'round-shield': [{ stat: 'armorScore', amount: 1, feature: 'Protective' }],
  'improved-round-shield': [{ stat: 'armorScore', amount: 2, feature: 'Protective' }],
  'advanced-round-shield': [{ stat: 'armorScore', amount: 3, feature: 'Protective' }],
  'legendary-round-shield': [{ stat: 'armorScore', amount: 4, feature: 'Protective' }],
  // Barrier: +N to Armor Score; -1 to Evasion. The Evasion half is -1 at every
  // tier and only the Armor Score half steps.
  'tower-shield': [
    { stat: 'armorScore', amount: 2, feature: 'Barrier' },
    { stat: 'evasion', amount: -1, feature: 'Barrier' },
  ],
  'improved-tower-shield': [
    { stat: 'armorScore', amount: 3, feature: 'Barrier' },
    { stat: 'evasion', amount: -1, feature: 'Barrier' },
  ],
  'advanced-tower-shield': [
    { stat: 'armorScore', amount: 4, feature: 'Barrier' },
    { stat: 'evasion', amount: -1, feature: 'Barrier' },
  ],
  'legendary-tower-shield': [
    { stat: 'armorScore', amount: 5, feature: 'Barrier' },
    { stat: 'evasion', amount: -1, feature: 'Barrier' },
  ],
  // Double Duty: +1 to Armor Score; +1 to primary weapon damage within Melee
  // range. Only the first half is a sheet number; the damage half is a roll.
  'spiked-shield': [{ stat: 'armorScore', amount: 1, feature: 'Double Duty' }],
};

/** Worn as `activeArmor`. */
const ARMOR_MODS: Record<Ref, Row[]> = {
  // Flexible: +1 to Evasion
  'gambeson-armor': [{ stat: 'evasion', amount: 1, feature: 'Flexible' }],
  'improved-gambeson-armor': [{ stat: 'evasion', amount: 1, feature: 'Flexible' }],
  'advanced-gambeson-armor': [{ stat: 'evasion', amount: 1, feature: 'Flexible' }],
  'legendary-gambeson-armor': [{ stat: 'evasion', amount: 1, feature: 'Flexible' }],
  // Heavy: -1 to Evasion
  'chainmail-armor': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'improved-chainmail-armor': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'advanced-chainmail-armor': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  'legendary-chainmail-armor': [{ stat: 'evasion', amount: -1, feature: 'Heavy' }],
  // Very Heavy: -2 to Evasion; -1 to Agility
  'full-plate-armor': [
    { stat: 'evasion', amount: -2, feature: 'Very Heavy' },
    { stat: 'agility', amount: -1, feature: 'Very Heavy' },
  ],
  'improved-full-plate-armor': [
    { stat: 'evasion', amount: -2, feature: 'Very Heavy' },
    { stat: 'agility', amount: -1, feature: 'Very Heavy' },
  ],
  'advanced-full-plate-armor': [
    { stat: 'evasion', amount: -2, feature: 'Very Heavy' },
    { stat: 'agility', amount: -1, feature: 'Very Heavy' },
  ],
  'legendary-full-plate-armor': [
    { stat: 'evasion', amount: -2, feature: 'Very Heavy' },
    { stat: 'agility', amount: -1, feature: 'Very Heavy' },
  ],
  // Gilded: +1 to Presence - the one armour in the book that raises a trait.
  'bellamoi-fine-armor': [{ stat: 'presence', amount: 1, feature: 'Gilded' }],
  // Difficult: -1 to all character traits and Evasion. Seven rows from one
  // sentence, and they are written out rather than looped so that the auditor
  // reads the same shape here as everywhere else.
  'savior-chainmail': [
    { stat: 'evasion', amount: -1, feature: 'Difficult' },
    { stat: 'agility', amount: -1, feature: 'Difficult' },
    { stat: 'strength', amount: -1, feature: 'Difficult' },
    { stat: 'finesse', amount: -1, feature: 'Difficult' },
    { stat: 'instinct', amount: -1, feature: 'Difficult' },
    { stat: 'presence', amount: -1, feature: 'Difficult' },
    { stat: 'knowledge', amount: -1, feature: 'Difficult' },
  ],
};

/**
 * Carried in the inventory, with a ref this build resolved.
 *
 * The six Relics, and every one of them says "You gain a +1 bonus to your
 * <trait>. You can only carry one relic." Carrying IS the gate - there is no
 * attune step in the SRD and none in this app - so an entry whose `ref` names
 * one counts, once, however many the quantity says. Two DIFFERENT relics both
 * count, because the rule that forbids it is a rule for the player and not an
 * arithmetic this file may quietly enforce; the sheet shows both rows, so an
 * illegal pair is visible rather than silently halved.
 *
 * A hand-typed "Stride Relic" has `ref: null` - `InventoryEditor` clears the
 * ref the moment the name is edited - and correctly grants nothing. This file
 * does not read names.
 */
const LOOT_MODS: Record<Ref, Row[]> = {
  'stride-relic': [{ stat: 'agility', amount: 1, feature: 'Stride Relic' }],
  'bolster-relic': [{ stat: 'strength', amount: 1, feature: 'Bolster Relic' }],
  'control-relic': [{ stat: 'finesse', amount: 1, feature: 'Control Relic' }],
  'attune-relic': [{ stat: 'instinct', amount: 1, feature: 'Attune Relic' }],
  'charm-relic': [{ stat: 'presence', amount: 1, feature: 'Charm Relic' }],
  'enlighten-relic': [{ stat: 'knowledge', amount: 1, feature: 'Enlighten Relic' }],
};

/** On the sheet, in a feature slot the mixed-ancestry rule actually grants. */
const ANCESTRY_MODS: Record<Ref, AncestryRow[]> = {
  simiah: [{ slot: 1, stat: 'evasion', amount: 1, feature: 'Nimble' }],
  giant: [{ slot: 0, stat: 'maxHp', amount: 1, feature: 'Endurance' }],
  human: [{ slot: 0, stat: 'maxStress', amount: 1, feature: 'High Stamina' }],
  galapa: [{ slot: 0, stat: 'thresholds', amount: 'proficiency', feature: 'Shell' }],
};

/**
 * On the sheet, with the card that grants it taken.
 *
 * Stalwart STACKS and that is not a typo: *Unwavering* (+1), *Unrelenting*
 * (+2) and *Undaunted* (+3) are three separate features gained at three
 * separate tiers, so a Stalwart holding the mastery card is at +6 to both
 * thresholds and not +3.
 */
const SUBCLASS_MODS: Record<Ref, SubclassRow[]> = {
  nightwalker: [{ card: 'mastery', stat: 'evasion', amount: 1, feature: 'Fleeting Shadow' }],
  'school-of-war': [{ card: 'foundation', stat: 'maxHp', amount: 1, feature: 'Battlemage' }],
  vengeance: [{ card: 'foundation', stat: 'maxStress', amount: 1, feature: 'At Ease' }],
  'winged-sentinel': [{ card: 'mastery', stat: 'severe', amount: 4, feature: 'Ascendant' }],
  stalwart: [
    { card: 'foundation', stat: 'thresholds', amount: 1, feature: 'Unwavering' },
    { card: 'specialization', stat: 'thresholds', amount: 2, feature: 'Unrelenting' },
    { card: 'mastery', stat: 'thresholds', amount: 3, feature: 'Undaunted' },
  ],
};

/**
 * On the sheet. Empty, and kept rather than deleted.
 *
 * Not one of the nine communities in `data/srd-1.0.json` moves a derived
 * number - Orderborne rolls a d20 as its Hope Die, Wanderborne adds a pack -
 * so this register has no rows today. It exists because the COLLECTOR walks it,
 * and the collector's walk is what the auditor measures coverage against: a
 * community that arrives in a Core Rulebook layer with a flat +1 in it gets
 * caught by a test that already knows to look here. Deleting the empty map
 * would delete the lane.
 */
const COMMUNITY_MODS: Record<Ref, Row[]> = {};

/** Every register, by the lane that reads it. Exported for the auditor. */
export const REGISTERS = {
  weapon: WEAPON_MODS,
  armor: ARMOR_MODS,
  loot: LOOT_MODS,
  ancestry: ANCESTRY_MODS,
  subclass: SUBCLASS_MODS,
  community: COMMUNITY_MODS,
} as const;

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/** Where a contribution came from, in the order the sheet reads them. */
export type Lane =
  | 'ancestry'
  | 'community'
  | 'subclass'
  | 'armor'
  | 'primary'
  | 'secondary'
  | 'carried';

/** One row of the derivation, ready to print. */
export interface Contribution {
  lane: Lane;
  ref: Ref;
  /** The thing's own name: `Simiah`, `Gambeson Armor`, `Tower Shield`. */
  source: string;
  /** The feature's name: `Nimble`, `Flexible`, `Barrier`. */
  feature: string;
  /** Resolved: `proficiency` has already become a number by the time it is here. */
  amount: number;
}

export type Ledger = Record<LedgerStat, Contribution[]>;

/** A ledger with no rows in any lane. The answer for a sheet with nothing on it. */
export const emptyLedger = (): Ledger => ({
  evasion: [],
  maxHp: [],
  maxStress: [],
  armorScore: [],
  major: [],
  severe: [],
  agility: [],
  strength: [],
  finesse: [],
  instinct: [],
  presence: [],
  knowledge: [],
});

/** What a lane's rows add up to. The one way anything reads a total. */
export function sumOf(ledger: Ledger, stat: LedgerStat): number {
  return ledger[stat].reduce((total, row) => total + row.amount, 0);
}

/** Trait totals in one object, so the caller does not loop over six keys. */
export function traitDeltas(ledger: Ledger): Record<Trait, number> {
  return Object.fromEntries(TRAITS.map((t) => [t, sumOf(ledger, t)])) as Record<Trait, number>;
}

/**
 * Every static bonus this sheet's own contents grant, with its provenance.
 *
 * `proficiency` is passed in rather than derived here because `deriveStats`
 * already knows it and one of the rows is *equal to your Proficiency*; a second
 * copy of that arithmetic is a second answer waiting to happen.
 *
 * A ref this build cannot resolve contributes nothing and is not an error here:
 * `deriveStats` already carries `unresolvedArmor` out with the stats for
 * exactly that reason, and the screen that prints a total is the one that has
 * to say the total may be short.
 */
export function collectModifiers(
  c: Character,
  ix: DatasetIndex,
  proficiency: number,
): Ledger {
  const ledger = emptyLedger();

  const add = (lane: Lane, ref: Ref, source: string, row: Row): void => {
    const amount = row.amount === 'proficiency' ? proficiency : row.amount;
    const entry = { lane, ref, source, feature: row.feature, amount };
    if (row.stat === 'thresholds') {
      // One sentence, two numbers. Both halves carry the same feature name, so
      // MAJOR and SEVERE each read "Stalwart · Unwavering +1" and neither says
      // it twice.
      ledger.major.push(entry);
      ledger.severe.push({ ...entry });
      return;
    }
    ledger[row.stat].push(entry);
  };

  /*
   * Heritage, under the SRD's mixed-ancestry rule.
   *
   * One ancestry grants both of its features; two or more grant the first's
   * `features[0]` and the second's `features[1]`. This is the same rule
   * `collectFeatures` applies in `src/ui/print/sheetModel.ts`, and the two must
   * not drift: a bonus that reaches the number but not the printed feature list
   * - or the other way round - is a sheet disagreeing with itself.
   */
  const ancestries = c.ancestryRefs;
  const grantedSlots: Array<[Ref, 0 | 1]> =
    ancestries.length === 1 && ancestries[0] !== undefined
      ? [
          [ancestries[0], 0],
          [ancestries[0], 1],
        ]
      : ancestries.length > 1 && ancestries[0] !== undefined && ancestries[1] !== undefined
        ? [
            [ancestries[0], 0],
            [ancestries[1], 1],
          ]
        : [];
  for (const [ref, slot] of grantedSlots) {
    // The ancestries map rather than `byRef`: an `ancestryRef` names an
    // ancestry, and the bare-slug map cannot promise that is what comes back.
    const named = ix.collections.ancestries.get(ref);
    if (named === undefined) continue;
    for (const row of ANCESTRY_MODS[ref] ?? []) {
      if (row.slot === slot) add('ancestry', ref, named.name ?? ref, row);
    }
  }

  if (c.communityRef !== null) {
    const community = ix.collections.communities.get(c.communityRef);
    if (community !== undefined) {
      for (const row of COMMUNITY_MODS[c.communityRef] ?? []) {
        add('community', c.communityRef, community.name ?? c.communityRef, row);
      }
    }
  }

  /*
   * Subclasses, gated on the card actually taken.
   *
   * Foundation comes with the subclass. Specialization and Mastery are
   * advancements, so which of them a character holds is read out of
   * `levelUpHistory` and never inferred from the level - a character who spent
   * those two slots on something else does not have the card, and must not have
   * the bonus.
   */
  for (const ref of c.subclassRefs) {
    const sub = ix.subclasses.get(ref);
    if (sub === undefined) continue;
    const taken = new Set(
      c.levelUpHistory
        .filter((h) => h.kind === 'subclass' && h.detail['subclassRef'] === ref)
        .map((h) => String(h.detail['card'] ?? '')),
    );
    for (const row of SUBCLASS_MODS[ref] ?? []) {
      if (row.card === 'foundation' || taken.has(row.card)) add('subclass', ref, sub.name, row);
    }
  }

  if (c.activeArmor !== null && c.activeArmor !== '') {
    const armor = ix.armors.get(c.activeArmor);
    if (armor !== undefined) {
      for (const row of ARMOR_MODS[c.activeArmor] ?? []) {
        add('armor', c.activeArmor, armor.name, row);
      }
    }
  }

  for (const [lane, ref] of [
    ['primary', c.activePrimaryWeapon],
    ['secondary', c.activeSecondaryWeapon],
  ] as const) {
    if (ref === null || ref === '') continue;
    const weapon = ix.weapons.get(ref);
    if (weapon === undefined) continue;
    for (const row of WEAPON_MODS[ref] ?? []) add(lane, ref, weapon.name, row);
  }

  /*
   * Carried items, counted once per ref rather than once per unit.
   *
   * `quantity` is a count of objects and a relic's bonus is not per object -
   * "You can only carry one relic" is the book saying so out loud - so two
   * Stride Relics in one row are still +1 Agility. A `Set` because a sheet can
   * also carry the same ref on two separate rows, which the inventory editor
   * merges but an imported sheet need not have.
   */
  const counted = new Set<Ref>();
  for (const entry of c.inventory) {
    if (entry.ref === null || counted.has(entry.ref)) continue;
    counted.add(entry.ref);
    const item = ix.byRef.get(entry.ref) as { name?: string } | undefined;
    if (item === undefined) continue;
    for (const row of LOOT_MODS[entry.ref] ?? []) {
      add('carried', entry.ref, item.name ?? entry.ref, row);
    }
  }

  return ledger;
}
