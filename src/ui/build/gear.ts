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
 * Nothing here decides what a player may OWN, and one thing here decides what
 * they may EQUIP. Tier is arithmetic - tier 3 gear appears at level 5 - and
 * the Equipment chapter spends a verb on the consequence: *"You can't equip
 * weapons or armor with a higher tier than you."* So the tier a character has
 * reached is computed, said out loud, and then acted on at exactly one moment:
 * `canEquip` is the predicate the two pickers refuse a pick on.
 *
 * That paragraph used to end "and then left alone", with a GM who hands a
 * level 2 party a tier 4 sword as the case it was protecting. The sword is
 * still protected and the sentence was still wrong: nothing stops the GM
 * giving it, nothing takes it off a sheet that already carries it, it stays in
 * every list at full length - and the app now declines to be the thing that
 * puts it on, because the book it ships in the same build says it cannot. What
 * this file must not do is DROP something; refusing to add is a different act.
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

/**
 * Whether a character at this level may put gear of this tier ON.
 *
 * Equipment: *"You can't equip weapons or armor with a higher tier than you."*
 * That is the whole of the rule and the whole of this predicate. It is a
 * separate export from `tierNote` below rather than a reading of it, because
 * the two are asked in different places for different reasons and only one of
 * them refuses: a list asks `tierNote` what to print under a row it is
 * showing, and a pick asks `canEquip` whether to happen at all.
 *
 * ## Where it is asked, and where it deliberately is not
 *
 * Asked in `WeaponPicker` and `ArmorPicker` - the two dialogs, shared by the
 * wizard and the sheet, so all four screen-and-kind combinations get one
 * answer - on the row's tap AND on the RANDOM draw, which is the same act with
 * dice in front of it.
 *
 * Not asked of a sheet that already holds something. There is no sweep, no
 * normalisation on load, nothing that reads `activeArmor` and clears it. A
 * sheet arriving by file or QR from a level 10 character, or one whose level
 * was edited down, keeps every ref it came with and is TOLD about it by
 * `slotTierNote`. `Edit.tsx` refuses the other shape in writing - *"a sheet
 * that quietly unequipped the off-hand when a greatsword arrived would be the
 * app making a call the table gets to make"* - and stripping gear on load is
 * that call made behind the player's back, at the moment they are least able
 * to see it happen.
 */
export const canEquip = (tier: Tier, level: number): boolean => tier <= tierOf(level);

/**
 * Why gear of this tier is out of reach at this level, as a LIST says it. Null
 * when it is not.
 *
 * "Usable from level 8" and not "you can't equip this": a picker row is a
 * thing being offered, and the useful fact about a row you cannot take is when
 * you can. The row itself carries the refusal, by declining the tap.
 */
export const tierNote = (tier: Tier, level: number): string | null =>
  canEquip(tier, level) ? null : `Tier ${tier} — usable from level ${tierLevel(tier)}`;

/**
 * The same fact as a SLOT says it: this is on the character, it is staying on
 * the character, and it cannot be put back once it comes off. Null when the
 * tier is within reach.
 *
 * ## Why the slot needs its own sentence at all
 *
 * Before the pickers refused anything, `tierNote` was true in both places and
 * said the same useful thing in both: this is above your level, here is when
 * it opens. It stopped being enough under a slot the moment a pick could be
 * refused, because the slot is now the one place in the app showing a state
 * the app will not re-enter. A player reading `TIER 4 — USABLE FROM LEVEL 8`
 * under a sword they are holding, with a ✕ beside it, has been told nothing
 * about the only thing that could hurt them: the ✕ is a one-way door until
 * level 8.
 *
 * So the slot's line names the two halves of the owner's decision in the order
 * they matter - **kept**, then **not again** - and the level it opens at,
 * which is the only actionable number in the sentence. It replaces `tierNote`
 * under a slot rather than being appended to it: appended, the line reads
 * "usable from level 8 · you cannot equip it again until level 8", which says
 * the same number twice and reads as a contradiction on the first pass.
 *
 * ## What this sentence is NOT, and it is a gap named rather than closed
 *
 * It is not an arming. `Edit.tsx`'s stance section states the rule this app
 * now holds one-way controls to - arm when there is no way back - and the ✕
 * beside a gear slot has two states that rule indicts: it clears out-of-tier
 * gear the pickers will not hand back until the level arrives, and it clears a
 * ref this build cannot name, which nothing anywhere can re-enter. Neither is
 * armed today.
 *
 * That is left standing on purpose rather than overlooked. The arming would
 * belong on `GearSlot`, which draws three slots across two screens and whose
 * ORDINARY state is a reversible swap that has to stay one tap - so it is its
 * own repair with its own measurement, not a rider on this one. The sentence
 * is what stands in the meantime, and it is strictly more than the slot said
 * before it existed.
 */
export const slotTierNote = (tier: Tier, level: number): string | null =>
  canEquip(tier, level)
    ? null
    : `Tier ${tier} — kept; you cannot equip it again until level ${tierLevel(tier)}`;

// ---------------------------------------------------------------------------
// What a filled slot says about what is in it
// ---------------------------------------------------------------------------

/*
 * ONE LINE UNDER A SLOT, BUILT IN ONE PLACE.
 *
 * `tierNote` above is the oldest of these and for a while it was the only one,
 * so both build screens wrote their slot's note as a ternary: the burden
 * sentence, ELSE the tier sentence. Two costs came out of that shape and the
 * second is the one that mattered.
 *
 * The cheap one: a ternary drops the tier line whenever the burden line fires,
 * so a level 1 character holding a tier 4 off-hand beside a greatsword was told
 * about the hands and never about the tier. Both were true; one was printed.
 *
 * The expensive one: the two screens wrote the ternary differently. `Edit.tsx`
 * asked `secondary && primary?.burden === 2` and `Wizard.tsx` asked
 * `twoHanded && primary` - so the wizard printed "there is no hand left for an
 * off-hand weapon" over an EMPTY optional slot, every time the primary happened
 * to be two-handed. Neither asked which class was holding the weapon, so both
 * said it to a Warrior, whose Combat Training reads *"You ignore burden when
 * equipping weapons."*
 *
 * So the sentence is composed here, once, from the slot's own contents, and the
 * screens pass what they have. `ignoresBurden` is a parameter rather than a
 * lookup because this module is filtering and phrasing - it takes no
 * `DatasetIndex` and asks the dataset nothing - and because a boolean at the
 * call site is the thing a test can sweep both ways in one line.
 */

/** Folio 55: *"Your character's maximum burden is 2 hands."* */
export const MAX_BURDEN = 2;

/** A slot, and everything the sentence under it depends on. */
export interface WeaponInSlot {
  /** Which hand is being drawn. */
  slot: Weapon['slot'];
  /** What is in it, or undefined for an empty slot. */
  weapon: Weapon | undefined;
  /** What is in the main hand - the other half of the burden question. */
  primary: Weapon | undefined;
  level: number;
  /** Combat Training: this character equips without counting hands. */
  ignoresBurden: boolean;
}

/**
 * How many hands the two weapons take together, when that is over the book's
 * limit. Null when it is not, and null for anyone the limit does not bind.
 *
 * ## It is counted, not inferred from `burden === 2`
 *
 * The old test was "is the primary two-handed", which misses the other way to
 * be over: the pickers do not filter by slot (see `WeaponQuery.slot`, a default
 * and not a fence), so a two-handed PRIMARY-slot weapon goes into the off-hand
 * as happily as anything else. `1 + 2` is three hands and the old test said
 * nothing at all. Adding the two burdens covers both, and says the true number
 * in the case where it is four.
 *
 * ## It is drawn under the off-hand only
 *
 * The sentence names both weapons, so one printing of it says the whole thing;
 * printing it under the primary as well would put the same sentence on the
 * screen twice. The off-hand is where it goes because that is the slot the
 * sentence is about - it is the optional one, and it is the one whose ✕ is the
 * cheap way out if the table decides the limit stands.
 *
 * ## And it does not refuse anything, where the tier limit now does
 *
 * The book states this limit and stops: *"Your character's maximum burden is 2
 * hands."* No verb follows the number and no sentence in the chapter says what
 * a character over it may not do. That is the table's call, so this is a count
 * and a limit side by side with no verb between them - not "no hand left for
 * this", which reads as the app declining to hold the weapon it is in fact
 * holding.
 *
 * The SAME chapter writes the other limit with the verb in it: *"You can't
 * equip weapons or armor with a higher tier than you."* That one is a refusal
 * and `canEquip` above is it, so this one file now treats two limits from one
 * chapter in two different ways.
 *
 * **The book is what distinguishes them, not us.** One sentence stops at the
 * number and the other spends a "can't" on it; the app follows that grammar
 * instead of choosing a policy and applying it evenly. It is worth being blunt
 * about how thin the evidence is - the whole distinction is one modal verb -
 * and that is exactly why it is not a judgement call to be re-argued at every
 * call site: both sentences are read off the shipped dataset by
 * `tests/ui/gear.test.ts`, and `MAX_BURDEN` is pinned to the number inside the
 * first of them, so a printing that adds a consequence to the burden line or
 * takes the "can't" out of the tier line reddens a test before it reaches a
 * screen.
 *
 * The third sentence in that chapter is a refusal this app deliberately does
 * not implement: *"They can't equip armor while in danger or under pressure."*
 * That is a state of play - the app does not know whether you are in danger,
 * and nothing on any sheet could tell it - where the tier is a property of the
 * character and the item. See the note in `tests/ui/gear.test.ts`.
 */
const handsNote = ({ slot, weapon, primary, ignoresBurden }: WeaponInSlot): string | null => {
  if (slot !== 'secondary' || ignoresBurden) return null;
  if (weapon === undefined || primary === undefined) return null;
  const hands = primary.burden + weapon.burden;
  return hands <= MAX_BURDEN
    ? null
    : `${primary.name} and ${weapon.name} are ${hands} hands — your maximum burden is ${MAX_BURDEN}`;
};


/**
 * Which hand the book files this weapon under, when it is not the hand it is
 * sitting in. Null when they agree.
 *
 * ## The slot chip is a default, and nothing downstream of it is a fence
 *
 * `weaponQuery(slot)` opens each picker pre-set to the hand being filled, and
 * `ModuleChoice` explains why that is a default rather than a hide: it is one
 * tap from "Any", and a list that refused to show the rest would be the same
 * lie by omission this module refuses everywhere. But no `onPick` on either
 * build screen ever compared `weapon.slot` with the slot it was filling, so
 * every one of the 291 primary-slot weapons - Greatsword included - goes into
 * the off-hand the moment that chip is tapped over to Any, and neither screen
 * said one word about it afterwards. The row that put it there is gone; the
 * slot it landed in shows a name, a damage die and nothing else.
 *
 * ## Said, not refused, and that is the owner's call rather than an oversight
 *
 * Filtering the pick would be this file deciding a table's question, and it is
 * the same question the burden line above declines to decide. So the picker is
 * left alone - `filterWeapons` is unchanged, the chip still opens where it
 * always did - and the slot carries a sentence instead.
 *
 * ## It has nothing to do with burden
 *
 * Combat Training lifts a hand count; it says nothing about which hand a
 * weapon belongs in. So this line is drawn for a Warrior too, and it is the
 * half of the off-hand's note that survives the exception.
 */
const bookSlotNote = ({ slot, weapon }: WeaponInSlot): string | null =>
  weapon === undefined || weapon.slot === slot
    ? null
    : `The book lists ${weapon.name} as a ${weapon.slot} weapon`;

/**
 * Everything true of the thing in this slot that the slot itself does not
 * already show, in the one line `GearSlot` has for it. Null when there is
 * nothing to say, and null for an empty slot - an empty slot has its own words.
 *
 * Joined with the same `·` `originStamp` uses, in order of how far the fact
 * reaches: the hands are about this character's whole loadout, the book's slot
 * and the tier are about this one item. All of them are printed, because the
 * ternary that used to choose between two of them was choosing which true thing
 * to withhold.
 */
export function weaponNote(at: WeaponInSlot): string | null {
  if (at.weapon === undefined) return null;
  // `slotTierNote`, never `tierNote`: this is a slot, and a slot is the one
  // place where "usable from level 8" is no longer the whole truth.
  const lines = [handsNote(at), bookSlotNote(at), slotTierNote(at.weapon.tier, at.level)].filter(
    (line): line is string => line !== null,
  );
  return lines.length === 0 ? null : lines.join(' · ');
}

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
