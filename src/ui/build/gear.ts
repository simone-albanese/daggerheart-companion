/**
 * What a gear list is filtered by, and what a character has actually reached.
 *
 * This is separated from the picker that draws it because crossing eight
 * filters is the part that can be wrong without ever looking wrong: a filter
 * that quietly drops a weapon is indistinguishable on screen from a dataset
 * that never had it. Here it can be tested against a list you can count.
 *
 * Nothing here decides what a player may own. Tier is arithmetic - tier 3 gear
 * appears at level 5 - so the tier a character has reached is computed, said
 * out loud, and then left alone. A GM who hands a level 2 party a tier 4 sword
 * has not broken a rule this app is entitled to enforce.
 *
 * The search box is one of those filters and reads the same axes the chips do,
 * for the same reason: a box that answered "melee" with 26 of the 100 melee
 * weapons was telling the player, in the only language a list has, that the
 * other 74 were not in the book.
 */
import type { Armor, Item, Range, Tier, Weapon, WeaponTrait } from '../../../shared/types.ts';
import { TIER_LEVELS, tierOf } from '../../engine/character.ts';

/** One line of a picker: the thing, and whether it is within reach. */
export interface GearRow<T> {
  item: T;
  /** True when the character's level has reached this tier of gear. */
  eligible: boolean;
  /** Why it is out of reach, phrased for the screen. Null when it is not. */
  reason: string | null;
}

/** The level at which a tier's gear starts appearing. */
export const tierLevel = (tier: Tier): number => TIER_LEVELS[tier][0] ?? 1;

/** Show everything, or only what this level can use. */
export type Reach = 'all' | 'usable';

/** Why gear of this tier is out of reach at this level. Null when it is not. */
export const tierNote = (tier: Tier, level: number): string | null =>
  tier <= tierOf(level) ? null : `Tier ${tier} — usable from level ${tierLevel(tier)}`;

const row = <T extends { tier: Tier }>(item: T, level: number): GearRow<T> => {
  const reason = tierNote(item.tier, level);
  return { item, eligible: reason === null, reason };
};

/**
 * Prose - a name, a weapon's feature, an item's text - matched anywhere inside
 * it, which is what makes "sword" find the Broadsword.
 */
const inProse = (text: string, search: string): boolean => text.toLowerCase().includes(search);

/**
 * An axis label - Melee, instinct, Magic, Two-Handed, d8+3 - matched from the
 * start of one of its words.
 *
 * A label is one word or two rather than a sentence, and a substring landing
 * inside one is almost never what was typed. Folded in as plain text, "hand"
 * would mean the entire armoury, because all 204 weapons print ONE-HANDED or
 * TWO-HANDED on their row; matched from word starts it still finds the sixteen
 * weapons that say "hand" - the Hand Crossbows, the Hand Runes - and nothing
 * else. "far" still finds both Far and Very Far, because a space is a word
 * start.
 *
 * A hyphen is deliberately not one: it is the whole reason "hand" is safe. But
 * a hyphen the player did not type must not cost them the match either, so a
 * space in the search matches a hyphen in the label and "two handed" and
 * "two-handed" both land on the same 92 weapons.
 */
const atWordStart = (label: string, search: string): boolean => {
  const text = label.toLowerCase();
  const loose = text.replace(/-/g, ' ');
  const needle = search.replace(/-/g, ' ');
  for (let i = loose.indexOf(needle); i >= 0; i = loose.indexOf(needle, i + 1)) {
    if (i === 0 || text[i - 1] === ' ') return true;
  }
  return false;
};

/**
 * What one row answers to, in the two ways a row can be read.
 *
 * An empty box matches everything, which is why no filter narrows anything
 * until a letter is typed.
 */
const matches = (search: string, prose: readonly string[], labels: readonly string[]): boolean =>
  search === '' ||
  prose.some((text) => inProse(text, search)) ||
  labels.some((label) => atWordStart(label, search));

/** The two words a weapon's burden is printed as. */
const HANDS: Record<1 | 2, string> = { 1: 'One-Handed', 2: 'Two-Handed' };

/**
 * The axes a weapon row prints, in the words it prints them in.
 *
 * `GearPicker` writes the meta line as `d8+3 PHY · MELEE · AGILITY ·
 * ONE-HANDED`, and every word of it except the damage type is a chip row as
 * well. Searching them is what stops "melee" answering 26 when 100 weapons are
 * Melee - an answer that reads on screen as an armoury missing its swords,
 * which is the one thing this app may never imply.
 *
 * Three things are left out on purpose. The tier is a badge and a chip, but it
 * is a bare digit, and folding "Tier 3" in would let a stray "3" pick out a
 * quarter of the book. The slot is a segmented control the picker already
 * opens pre-set, and it appears nowhere on the row, so a search for
 * "secondary" would return 37 rows with nothing on them saying why. The damage
 * type has no chip at all, and the category chip covers the same ground for
 * all but one weapon.
 *
 * The damage is the book's `d8+3` rather than the `3d8+3` the row prints at
 * Proficiency 3: the printed one moves with the character, and a search whose
 * results depend on whose sheet is open is a worse surprise than "3d8" finding
 * nothing. The book's form is a suffix of the printed one, so what matches
 * here is visible there.
 */
const weaponLabels = (w: Weapon): string[] => [
  w.range,
  w.trait,
  w.category,
  HANDS[w.burden],
  w.damage,
];

/**
 * Loot and consumables have one axis, and the control that sets it says
 * "Consumables" in the plural - so typing the word off the button has to work.
 */
const ITEM_LABELS: Record<Item['kind'], readonly string[]> = {
  loot: ['Loot'],
  consumable: ['Consumable', 'Consumables'],
};

/** Empty means "any", so an untouched chip row never narrows anything. */
const anyOf = <T>(chosen: ReadonlySet<T>, value: T): boolean =>
  chosen.size === 0 || chosen.has(value);

const sameSet = (a: ReadonlySet<unknown>, b: ReadonlySet<unknown>): boolean =>
  a.size === b.size && [...a].every((v) => b.has(v));

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

export type SlotChoice = 'all' | Weapon['slot'];
export type CategoryChoice = 'all' | 'Physical' | 'Magic';

export interface WeaponQuery {
  search: string;
  reach: Reach;
  slot: SlotChoice;
  category: CategoryChoice;
  tiers: ReadonlySet<Tier>;
  burdens: ReadonlySet<1 | 2>;
  traits: ReadonlySet<WeaponTrait>;
  ranges: ReadonlySet<Range>;
}

/**
 * The query a picker opens with. The slot being filled is pre-applied rather
 * than hidden: opening the off-hand picker on 204 weapons of which two thirds
 * cannot go there is a list you have to fight, and the chip that says so is
 * one tap from "Any".
 */
export const weaponQuery = (slot: SlotChoice = 'all'): WeaponQuery => ({
  search: '',
  reach: 'all',
  slot,
  category: 'all',
  tiers: new Set(),
  burdens: new Set(),
  traits: new Set(),
  ranges: new Set(),
});

export const weaponQueryChanged = (q: WeaponQuery, base: WeaponQuery): boolean =>
  q.search.trim() !== base.search ||
  q.reach !== base.reach ||
  q.slot !== base.slot ||
  q.category !== base.category ||
  !sameSet(q.tiers, base.tiers) ||
  !sameSet(q.burdens, base.burdens) ||
  !sameSet(q.traits, base.traits) ||
  !sameSet(q.ranges, base.ranges);

export function filterWeapons(
  weapons: readonly Weapon[],
  q: WeaponQuery,
  level: number,
): Array<GearRow<Weapon>> {
  const search = q.search.trim().toLowerCase();
  return weapons
    .map((w) => row(w, level))
    .filter(({ item, eligible }) => {
      if (q.reach === 'usable' && !eligible) return false;
      if (q.slot !== 'all' && item.slot !== q.slot) return false;
      if (q.category !== 'all' && item.category !== q.category) return false;
      if (!anyOf(q.tiers, item.tier)) return false;
      if (!anyOf(q.burdens, item.burden)) return false;
      if (!anyOf(q.traits, item.trait)) return false;
      if (!anyOf(q.ranges, item.range)) return false;
      return matches(search, [item.name, item.feature], weaponLabels(item));
    })
    .sort(
      (a, b) =>
        a.item.tier - b.item.tier ||
        a.item.slot.localeCompare(b.item.slot) ||
        a.item.name.localeCompare(b.item.name),
    );
}

// ---------------------------------------------------------------------------
// Armor
// ---------------------------------------------------------------------------

export interface ArmorQuery {
  search: string;
  reach: Reach;
  tiers: ReadonlySet<Tier>;
}

export const armorQuery = (): ArmorQuery => ({ search: '', reach: 'all', tiers: new Set() });

export const armorQueryChanged = (q: ArmorQuery, base: ArmorQuery): boolean =>
  q.search.trim() !== base.search || q.reach !== base.reach || !sameSet(q.tiers, base.tiers);

export function filterArmors(
  armors: readonly Armor[],
  q: ArmorQuery,
  level: number,
): Array<GearRow<Armor>> {
  const search = q.search.trim().toLowerCase();
  return armors
    .map((a) => row(a, level))
    .filter(({ item, eligible }) => {
      if (q.reach === 'usable' && !eligible) return false;
      if (!anyOf(q.tiers, item.tier)) return false;
      // Armor has no axis to fold in: tier is its only chip, and a bare digit
      // is not something the box can read without picking up the damage dice.
      return matches(search, [item.name, item.feature], []);
    })
    .sort((a, b) => a.item.tier - b.item.tier || a.item.name.localeCompare(b.item.name));
}

// ---------------------------------------------------------------------------
// Loot and consumables
// ---------------------------------------------------------------------------

export type ItemKindChoice = 'all' | 'loot' | 'consumable';

export interface ItemQuery {
  search: string;
  kind: ItemKindChoice;
}

export const itemQuery = (): ItemQuery => ({ search: '', kind: 'all' });

export const itemQueryChanged = (q: ItemQuery, base: ItemQuery): boolean =>
  q.search.trim() !== base.search || q.kind !== base.kind;

/** Items carry no tier, so there is nothing here a level could put out of reach. */
export function filterItems(items: readonly Item[], q: ItemQuery): Item[] {
  const search = q.search.trim().toLowerCase();
  return items
    .filter((it) => {
      if (q.kind !== 'all' && it.kind !== q.kind) return false;
      return matches(search, [it.name, it.text], ITEM_LABELS[it.kind]);
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
