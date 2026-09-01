/**
 * What a gear list is filtered by, and what a character has actually reached.
 *
 * This is separated from the picker that draws it because crossing nine
 * filters is the part that can be wrong without ever looking wrong: a filter
 * that quietly drops a weapon is indistinguishable on screen from a dataset
 * that never had it. Here it can be tested against a list you can count.
 *
 * (Eight until the module axis arrived. The count is written out rather than
 * derived because it is the kind of inherited number this project keeps
 * catching itself copying forward: it is the field count of `WeaponQuery`,
 * which is nine, and `filterWeapons` applies all nine.)
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
import type {
  Armor,
  Item,
  ProductSet,
  Range,
  Sourced,
  Tier,
  Weapon,
  WeaponTrait,
} from '../../../shared/types.ts';
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

/**
 * Which tiers a control is about to act on, said in words.
 *
 * The TIER chips are the tier filter, and the randomiser in the count row
 * draws from whatever they left standing - so on screen the tier is already
 * said, twice: by the lit chips and by the count beside the button. It is not
 * said in the button's own label, which stays one short word so that it and
 * CLEAR FILTERS both fit beside the count at 320 CSS pixels. A screen reader
 * gets none of that adjacency, so it gets the sentence instead, and this is
 * where the sentence is built.
 *
 * An empty set is "any tier", the same convention every chip row here uses:
 * nothing selected means nothing narrowed.
 */
export const tierPhrase = (tiers: ReadonlySet<Tier>): string => {
  const chosen = [...tiers].sort((a, b) => a - b);
  if (chosen.length === 0) return 'any tier';
  if (chosen.length === 1) return `tier ${String(chosen[0])}`;
  return `tiers ${chosen.join(', ')}`;
};

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

// ---------------------------------------------------------------------------
// Where a piece of gear came from
// ---------------------------------------------------------------------------

/*
 * TWO AXES, NOT ONE, AND THEY CROSS.
 *
 * `Sourced` carries both and `shared/types.ts` says at length why they are not
 * the same question. `set` is which box you bought - Core Set or the Hope &
 * Fear Expansion. `module` is which optional subsystem your table switched on.
 * A player who owns only the Core Set can be sitting at a Monster Hunting
 * table, so neither one nests inside the other and one record can carry both.
 *
 * MEASURED on SRD 2.0, by running `parseWeapons`/`parseArmors`/`parseLoot`/
 * `parseConsumables` over `Manuali/DH_SRD_2_2026_08_25.pdf` and counting the
 * records:
 *
 *   weapons      391    module 76 (Everyday Hero 32, Western 20, Monster 24)   set   0
 *   armors        85    module 16 (Everyday Hero  4,             Monster 12)   set   0
 *   loot         120    module  0                                              set 120 (60/60)
 *   consumables  120    module  0                                              set 120 (60/60)
 *
 * So in THIS printing the two axes happen not to meet: the gear that carries a
 * module carries no set, and the items that carry a set carry no module. That
 * is a fact about one book and not a shape to build on, which is why every
 * function below takes a `Sourced` and asks it for both. A later printing that
 * fences the Western revolvers by product needs no change here.
 *
 * WHAT GETS A CONTROL, AND WHAT DOES NOT.
 *
 * The module axis gets one, because the numbers say it has to. At tier 1 - the
 * tier every new character picks from - 31 of 71 primary weapons, 12 of 25
 * secondaries and 7 of 15 sets of armor come from an optional module, so a
 * table running none of them is reading a list that is nearly half somebody
 * else's subsystem. Which control, and what it cost, is on `ModuleChoice`.
 *
 * The product axis gets NO control here, on purpose. `DECISIONI-SRD-2` §4
 * gives ownership to a switch in Settings, where it belongs: it is one answer
 * for the whole app and every collection, not a thing to re-ask in each
 * picker, and a second control here would let the two disagree. What it gets
 * instead are the two things a picker can honestly give it at no cost in
 * pixels - it is printed on the row (`originStamp`) and it is readable by the
 * search box (`originLabels`).
 */

/** What a `ProductSet` is called on glass. A closed union, because the book states it. */
const PRODUCT_SET_LABELS: Record<ProductSet, string> = {
  core: 'Core Set',
  expansion: 'Hope & Fear Expansion',
};

/** Both axes, in the book's own words, in the order a row prints them. */
const origin = (r: Pick<Sourced, 'set' | 'module'>): string[] =>
  [r.set === undefined ? null : PRODUCT_SET_LABELS[r.set], r.module ?? null].filter(
    // `typeof`, not `!== null`: `PRODUCT_SET_LABELS` is a closed union, so a
    // product set outside it indexes to `undefined`, which `!== null` waves
    // through and then declares a `string`. See `gearProvenance.test.tsx`.
    (s): s is string => typeof s === 'string',
  );

/**
 * The one line a row prints to say where it came from. Empty when the book did
 * not say, which is every record of `data/srd-1.0.json`.
 *
 * THIS IS THE FIX FOR A MEASURED DEFECT, not decoration. SRD 2.0 prints two
 * loot tables and two consumable tables, one per product, each numbered 1..60,
 * so `Item.roll` is no longer unique inside its collection: all 120 loot rolls
 * and all 120 consumable rolls collide. Rendered at 393x852 with the SRD 2.0
 * dataset, the first two rows of the item picker were **Acidpaste, CONSUMABLE
 * · ROLL 36** and **Arcticite Shard, CONSUMABLE · ROLL 36** - adjacent, on the
 * same screen, identical. They now read `CORE SET` and `HOPE & FEAR EXPANSION`
 * on the line beneath.
 *
 * The module titles are verbatim, and the shortening that suggests itself is
 * the trap `shared/types.ts` refuses at the dataset layer for the same reason:
 * trimming `Campaigns` off two of them and `Starting Equipment` off the third
 * is renaming the source, one layer later, and the words on the row would stop
 * being the words on the contents page a player is holding.
 */
export const originStamp = (r: Pick<Sourced, 'set' | 'module'>): string => origin(r).join(' · ');

/**
 * The same two axes as search labels, so the box reads what the row prints.
 *
 * This is the OTHER half of the module control, and on the wide-open cases it
 * is the whole of it: `filterWeapons` matches labels from word starts, so
 * "western" answers with the 20 Western weapons and "monster hunting" with the
 * 24 - a per-module narrowing that the two-state chip beside it cannot express
 * and that costs no vertical pixels to offer. It is also the only way to act
 * on the product axis from this screen at all.
 *
 * Only the book's own strings. There is deliberately no synthetic label for
 * base content: "base" answering with 315 of 391 weapons would be the search
 * box asserting a category the book never named on any of those rows.
 */
const originLabels = origin;

/**
 * How much of the book a gear list is showing: everything, or the base rules
 * only.
 *
 * ## Two states, and the measurement that settled on two
 *
 * The obvious control is a chip row - `MODULE  BASE RULES · EVERYDAY HERO
 * STARTING EQUIPMENT · WESTERN CAMPAIGNS · MONSTER HUNTING CAMPAIGNS` - with
 * this file's usual "empty means any". It is strictly more expressive: a
 * Western table taps BASE RULES and WESTERN CAMPAIGNS and gets exactly its
 * 335 weapons, which two states cannot say. It was built, rendered against the
 * SRD 2.0 dataset in Chrome at seven viewports, and measured against the
 * two-state `Seg` and against no control at all. What follows is the whole
 * reason it is not what shipped.
 *
 * The chips are four buttons whose labels are the book's own titles, so they
 * are 74.70, 212.64, 118.59 and 168.75 CSS pixels wide, and they wrap. The
 * weapons picker's filter column, `PickerDialog`'s band 2:
 *
 *   viewport   no control   Seg      chips     chip row is
 *   320x568       364       364      566       4 lines
 *   360x800       310       310      462       3 lines
 *   375x667       310       310      462       3 lines
 *   393x852       310       310      412       2 lines
 *   744x1133      256       256      358       2 lines
 *   852x393       256       256      358       2 lines
 *   667x375       256       256      358       2 lines
 *
 * The `Seg` is 94.00px wide and lands on the SAME flex line as the Category
 * group at every one of the seven, so it costs the column NOTHING anywhere -
 * measured, not deduced: 364/310/310/310/256/256/256 with it and without it,
 * byte for byte.
 *
 * What band 2 takes, band 4 gives, and band 4 is the list. Whole rows on
 * glass, same seven viewports, SRD 2.0, primary slot pre-applied:
 *
 *   weapons   none  1 2 1 2 7 1 1     Seg  1 2 1 2 7 1 1     chips  1 1 1 1 6 1 1
 *   armor     none  1 4 2 5 9 1 1     Seg  1 4 2 4 9 1 1     chips  1 2 1 4 8 1 1
 *
 * The chips cost a whole row at three of seven viewports on weapons (360x800
 * and 393x852 go from two rows to ONE, 744x1133 from seven to six) and at four
 * of seven on armor (360x800 loses two). The `Seg` costs one row at one
 * viewport, armor at 393x852, five to four: its 94px pushes that picker's
 * single wrapped rail from 345.30 to 445.30 against a 347px content box, which
 * is the same 391.3px threshold `ChipRow` derives and re-measures.
 *
 * A comparison screen that shows one row is not a comparison screen. So the
 * expressive control loses to the cheap one on the only ground this file
 * recognises, and the expressiveness it takes with it is handed to the search
 * box, which has no ergonomics to pay: `originLabels` puts the module titles
 * in it, so "western" answers 20 and "everyday hero" answers 36. What is
 * genuinely gone is *base plus exactly one module* in a single gesture. It is
 * written down here rather than in a backlog because reversing it is a
 * measurement, not an opinion: the chip row exists, its cost is the table
 * above, and a device or a layout that changes those numbers changes the
 * answer.
 *
 * ## Why `all` is the default
 *
 * 76 of 391 weapons belong to subsystems most tables are not running, so
 * opening on the base rules would be the friendlier list. It is not what this
 * opens on. The dataset holding content the screen will not show is the exact
 * failure this wave exists to end, and a filter that is ON before anyone
 * touched it hides content while every control on the screen says nothing is
 * narrowed. Every other axis here opens wide; this one does too, and the row
 * says which module each thing came from so the first tap is informed.
 */
export type ModuleChoice = 'all' | 'base';

/**
 * Whether a pool has both kinds of content, and so whether the control can do
 * anything at all.
 *
 * Read off the pool for the reason `tiersIn` is: a control over a dataset that
 * has no module content is the same lie as a list with a weapon missing from
 * it, one indirection earlier. It is what makes this whole lane free on the
 * shipped book - every weapon and every set of armor in `data/srd-1.0.json` is
 * base content, so this is false, so `GearPicker` draws no control and that
 * picker is unchanged to the pixel.
 *
 * BOTH halves are required, not just "has a module". A pool that is entirely
 * module content would give the `base` state nothing to show, and a control
 * whose second position empties the list is worse than no control.
 */
export const moduleSplit = (rows: ReadonlyArray<Pick<Sourced, 'module'>>): boolean =>
  rows.some((r) => r.module !== undefined) && rows.some((r) => r.module === undefined);

/** Whether this row survives the module control. */
const withinModules = (choice: ModuleChoice, r: Pick<Sourced, 'module'>): boolean =>
  choice === 'all' || r.module === undefined;

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
  /** How much of the book: everything, or the base rules only. */
  modules: ModuleChoice;
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
  // The whole book. `ModuleChoice` says why the friendlier default - the 315
  // base weapons, without the 76 an optional module brought - is the wrong one.
  modules: 'all',
});

export const weaponQueryChanged = (q: WeaponQuery, base: WeaponQuery): boolean =>
  q.search.trim() !== base.search ||
  q.reach !== base.reach ||
  q.slot !== base.slot ||
  q.category !== base.category ||
  !sameSet(q.tiers, base.tiers) ||
  !sameSet(q.burdens, base.burdens) ||
  !sameSet(q.traits, base.traits) ||
  !sameSet(q.ranges, base.ranges) ||
  q.modules !== base.modules;

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
      if (!withinModules(q.modules, item)) return false;
      return matches(search, [item.name, item.feature], [
        ...weaponLabels(item),
        ...originLabels(item),
      ]);
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
  /** See `WeaponQuery.modules`; 16 of the 85 sets of armor carry a module. */
  modules: ModuleChoice;
}

export const armorQuery = (): ArmorQuery => ({
  search: '',
  reach: 'all',
  tiers: new Set(),
  modules: 'all',
});

export const armorQueryChanged = (q: ArmorQuery, base: ArmorQuery): boolean =>
  q.search.trim() !== base.search ||
  q.reach !== base.reach ||
  !sameSet(q.tiers, base.tiers) ||
  q.modules !== base.modules;

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
      if (!withinModules(q.modules, item)) return false;
      // Tier is still not foldable in - it is a bare digit, and the box would
      // pick up the damage dice with it - but the module is a phrase the row
      // prints, so it reads here for the same reason a weapon's RANGE does.
      // On SRD 1.0 this is the empty list it always was.
      return matches(search, [item.name, item.feature], originLabels(item));
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
      return matches(search, [it.name, it.text], [
        ...ITEM_LABELS[it.kind],
        ...originLabels(it),
      ]);
    })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}
