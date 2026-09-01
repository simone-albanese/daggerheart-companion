/**
 * The search a player uses to find their sword, proved against the whole
 * armoury instead of a handful of fixtures.
 *
 * Two things can go wrong here and neither of them looks wrong on screen. The
 * first is a filter that quietly drops a weapon: a picker showing 96 of 391 is
 * indistinguishable from a picker showing 95, and the one that fell out is
 * somebody's character concept. So every axis below is counted against the real
 * `data/srd-2.0.json` - 391 weapons, 85 armors, 120 loot, 120 consumables - and
 * the crossing queries are checked twice, once through `filterWeapons` and once
 * through plain array code written here, so an assertion cannot pass by
 * re-running the bug.
 *
 * The second is the honesty rule, which is the reason this module exists at
 * all. Tier is arithmetic: tier 3 gear appears at level 5. A picker that hid
 * everything above your level would be lying by omission - it would tell a
 * level 2 party that the tier 4 sword their GM just handed them does not exist.
 * So out-of-reach gear stays in the list, dimmed, carrying the sentence that
 * says when it opens up. These tests hold that line item by item and level by
 * level: present, explained, and eligible the moment the level arrives.
 *
 * Where a cross-product is too large to enumerate - eight weapon axes are
 * roughly 4.7 million chip combinations before you type a single letter - the
 * sweep prints exactly what it walked and exactly what it left alone, so no
 * number in this file can be read as "we covered everything".
 */
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Armor, Dataset, Item, Range, Tier, Weapon, WeaponTrait } from '@shared/types.ts';
import {
  armorQuery,
  armorQueryChanged,
  filterArmors,
  filterItems,
  filterWeapons,
  itemQuery,
  itemQueryChanged,
  tierLevel,
  tierNote,
  weaponNote,
  MAX_BURDEN,
  weaponQuery,
  weaponQueryChanged,
  type ArmorQuery,
  type CategoryChoice,
  type GearRow,
  type ItemQuery,
  type Reach,
  type SlotChoice,
  type WeaponQuery,
} from '../../src/ui/build/gear.ts';

const dataset = srd as unknown as Dataset;
const weapons: readonly Weapon[] = dataset.weapons;
const armors: readonly Armor[] = dataset.armors;
/** The picker is handed loot and consumables as one list, the way the UI does. */
const items: readonly Item[] = [...dataset.loot, ...dataset.consumables];

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const TIERS: readonly Tier[] = [1, 2, 3, 4];
const TRAITS: readonly WeaponTrait[] = [
  'agility',
  'strength',
  'finesse',
  'instinct',
  'presence',
  'knowledge',
  'spellcast',
];
const RANGES: readonly Range[] = ['Melee', 'Very Close', 'Close', 'Far', 'Very Far'];

/**
 * The tier a level has reached, written out here rather than imported, so the
 * expectations below are not the engine agreeing with itself.
 */
const reachedTier = (level: number): Tier =>
  level <= 1 ? 1 : level <= 4 ? 2 : level <= 7 ? 3 : 4;

const names = <T extends { name: string }>(rows: Array<GearRow<T>>): string[] =>
  rows.map((r) => r.item.name);

const tally = <T>(xs: readonly T[], key: (x: T) => string | number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = String(key(x));
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

const escaped = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The search rule written a second way: a regex, where the module walks string
 * indexes. Two formulations that agree are evidence; one formulation asserted
 * against itself is only a copy of the bug.
 *
 * Prose - the name and the feature - matches anywhere inside. An axis label
 * matches from the start of one of its words, where a space is a word start
 * and a hyphen is not, and a space the player typed matches either.
 */
const hitsSearch = (
  needle: string,
  prose: readonly string[],
  labels: readonly string[],
): boolean => {
  if (needle === '') return true;
  if (prose.some((t) => t.toLowerCase().includes(needle))) return true;
  const atWordStart = new RegExp(`(^| )${escaped(needle).replace(/[- ]/g, '[- ]')}`, 'i');
  return labels.some((l) => atWordStart.test(l));
};

const weaponHits = (w: Weapon, needle: string): boolean =>
  hitsSearch(needle, [w.name, w.feature], [
    w.range,
    w.trait,
    w.category,
    w.burden === 2 ? 'Two-Handed' : 'One-Handed',
    w.damage,
  ]);

/** Plain array code, deliberately not calling the module under test. */
const expectedWeapons = (q: WeaponQuery, level: number): Weapon[] => {
  const needle = q.search.trim().toLowerCase();
  return weapons.filter(
    (w) =>
      (q.reach !== 'usable' || w.tier <= reachedTier(level)) &&
      (q.slot === 'all' || w.slot === q.slot) &&
      (q.category === 'all' || w.category === q.category) &&
      (q.tiers.size === 0 || q.tiers.has(w.tier)) &&
      (q.burdens.size === 0 || q.burdens.has(w.burden)) &&
      (q.traits.size === 0 || q.traits.has(w.trait)) &&
      (q.ranges.size === 0 || q.ranges.has(w.range)) &&
      weaponHits(w, needle),
  );
};

const sortedNames = (xs: ReadonlyArray<{ name: string }>): string[] =>
  xs.map((x) => x.name).sort();

const inPickerOrder = (rows: Array<GearRow<Weapon>>): boolean =>
  rows.every((r, i) => {
    if (i === 0) return true;
    const p = rows[i - 1]!.item;
    const c = r.item;
    return (p.tier - c.tier || p.slot.localeCompare(c.slot) || p.name.localeCompare(c.name)) <= 0;
  });

const search = (text: string): WeaponQuery => ({ ...weaponQuery(), search: text });

// ---------------------------------------------------------------------------

describe('the armoury these filters run over', () => {
  it('is the whole SRD: 204 weapons, 34 armors, 60 pieces of loot and 60 consumables', () => {
    expect(weapons.length).toBe(391);
    expect(armors.length).toBe(85);
    expect(dataset.loot.length).toBe(120);
    expect(dataset.consumables.length).toBe(120);
    expect(items.length).toBe(240);
    // Names are what a player types, so two weapons sharing one would make the
    // search ambiguous in a way no filter could fix.
    expect(new Set(weapons.map((w) => w.name)).size).toBe(358);
    expect(new Set(weapons.map((w) => w.id)).size).toBe(391);
    expect(new Set(items.map((i) => i.id)).size).toBe(240);
  });

  it('spreads those weapons across every tier, slot, category, burden, trait and range', () => {
    expect(tally(weapons, (w) => w.tier)).toEqual({ '1': 96, '2': 101, '3': 93, '4': 101 });
    expect(tally(weapons, (w) => w.slot)).toEqual({ primary: 291, secondary: 100 });
    expect(tally(weapons, (w) => w.category)).toEqual({ Physical: 251, Magic: 140 });
    expect(tally(weapons, (w) => w.burden)).toEqual({ '1': 239, '2': 152 });
    expect(tally(weapons, (w) => w.trait)).toEqual({
      agility: 76,
      strength: 94,
      finesse: 82,
      instinct: 50,
      presence: 50,
      knowledge: 35,
      spellcast: 4,
    });
    expect(tally(weapons, (w) => w.range)).toEqual({
      Melee: 191,
      'Very Close': 67,
      Close: 39,
      Far: 70,
      'Very Far': 24,
    });
    expect(tally(armors, (a) => a.tier)).toEqual({ '1': 15, '2': 24, '3': 23, '4': 23 });
    expect(tally(items, (i) => i.kind)).toEqual({ loot: 120, consumable: 120 });
  });
});

describe('typing a name into the search box', () => {
  it('finds the whole Longsword family, in tier order, and nothing else', () => {
    const rows = filterWeapons(weapons, search('longsword'), 1);
    expect(names(rows)).toEqual([
      'Longsword',
      'Improved Longsword',
      'Advanced Longsword',
      'Legendary Longsword',
    ]);
    expect(rows.map((r) => r.item.tier)).toEqual([1, 2, 3, 4]);
  });

  it('does not care about case, or about the spaces a thumb leaves behind', () => {
    const lower = names(filterWeapons(weapons, search('sword'), 1));
    expect(lower).toHaveLength(31);
    expect(names(filterWeapons(weapons, search('SWORD'), 1))).toEqual(lower);
    expect(names(filterWeapons(weapons, search('SwOrD'), 1))).toEqual(lower);
    expect(names(filterWeapons(weapons, search('  sword  '), 1))).toEqual(lower);
  });

  it('matches a substring of the printed name, and is not a thesaurus', () => {
    const swords = names(filterWeapons(weapons, search('sword'), 1));
    expect(swords).toHaveLength(31);
    expect(swords).toContain('Broadsword');
    expect(swords).toContain('Dual-Ended Sword');
    expect(swords).toContain('Sword of Light & Flame');
    // Both are swords in any other sense; neither says so in its name.
    expect(swords).not.toContain('Rapier');
    expect(swords).not.toContain('Cutlass');
    // The full name narrows all the way down to the one weapon.
    expect(names(filterWeapons(weapons, search('Legendary Longsword'), 1))).toEqual([
      'Legendary Longsword',
    ]);
  });

  it('reads the weapon feature too, so "reliable" finds thirteen weapons no name mentions', () => {
    const rows = filterWeapons(weapons, search('reliable'), 1);
    expect(rows).toHaveLength(14);
    expect(rows.filter((r) => r.item.name.toLowerCase().includes('reliable'))).toEqual([]);
    for (const r of rows) expect(r.item.feature).toBe('Reliable: +1 to attack rolls');
    expect(names(rows)).toContain('Aantari Bow');
    expect(names(rows)).toContain('Broadsword');
  });

  it('reads armor features as well as armor names', () => {
    /*
     * Nine rows for four families, and the repeats are not a bug in the
     * search. SRD 2.0's Monster Hunting chapter prints ONE `Leather Longcoat`
     * row that covers all four tiers, so the parser emits four records under
     * one name (`leather-longcoat-tier-1` … `-tier-4`). Eleven weapon names
     * and three armor names are printed that way - 33 and 9 extra records -
     * which is why 391 weapons carry only 358 distinct names. The picker tells
     * them apart by the tier badge and by the module stamp beside it.
     */
    expect(names(filterArmors(armors, { ...armorQuery(), search: 'leather' }, 1))).toEqual([
      'Leather Apron',
      'Leather Armor',
      'Leather Longcoat',
      'Improved Leather Armor',
      'Leather Longcoat',
      'Advanced Leather Armor',
      'Leather Longcoat',
      'Leather Longcoat',
      'Legendary Leather Armor',
    ]);
    const flexible = filterArmors(armors, { ...armorQuery(), search: 'flexible' }, 1);
    expect(names(flexible)).toEqual([
      'Gambeson Armor',
      'Quilted Clothing',
      'Improved Gambeson Armor',
      'Advanced Gambeson Armor',
      'Legendary Gambeson Armor',
    ]);
    for (const r of flexible) expect(r.item.feature).toBe('Flexible: +1 to Evasion');
  });

  it('reads item text, so "stress" finds the thirteen things that clear it', () => {
    const found = filterItems(items, { ...itemQuery(), search: 'stress' });
    expect(found).toHaveLength(25);
    expect(found.filter((i) => i.name.toLowerCase().includes('stress'))).toEqual([]);
    expect(tally(found, (i) => i.kind)).toEqual({ consumable: 15, loot: 10 });
    expect(found.map((i) => i.name)).toContain('Stamina Potion');
    expect(found.map((i) => i.name)).toContain('Premium Bedroll');
  });
});

/*
 * These five counts were 26, 2, 1, 0 and 5 until the box learned to read the
 * axes, and they were pinned here deliberately so that a search box ignoring
 * the range was a choice somebody had made rather than an accident. It was the
 * wrong choice. A list is the only vocabulary this screen has: answering
 * "melee" with 26 rows when 100 weapons are Melee tells the player the other 74
 * are not in the book. Every number below is measured against
 * data/srd-1.0.json, and the axis totals are counted here rather than asked of
 * the module.
 */
describe('what the search box reads besides the name and the feature', () => {
  it('reads the range, so "melee" finds the 100 melee weapons and not 26', () => {
    const melee = filterWeapons(weapons, search('melee'), 1);
    expect(weapons.filter((w) => w.range === 'Melee')).toHaveLength(191);
    expect(melee).toHaveLength(228);
    expect(melee.filter((r) => r.item.range === 'Melee')).toHaveLength(191);

    // The other 14 are the ones the box already found: weapons that reach
    // further than Melee whose printed feature says "melee" anyway - the Whips
    // that shove adversaries out of it, the Grapplers that drag them into it,
    // and the four Scepters, whose Versatile line offers a Melee d8+3 profile.
    const elsewhere = melee.filter((r) => r.item.range !== 'Melee');
    expect(elsewhere).toHaveLength(37);
    for (const r of elsewhere) expect(r.item.feature.toLowerCase()).toContain('melee');
    // Nothing in the armoury is *named* "melee", which is why the old answer
    // was 26 feature matches and looked like a short shelf.
    expect(melee.filter((r) => r.item.name.toLowerCase().includes('melee'))).toEqual([]);

    // A space is a word start, so "far" reaches Far and Very Far both, and
    // "very far" narrows to the fifteen.
    expect(weapons.filter((w) => w.range === 'Far')).toHaveLength(70);
    expect(weapons.filter((w) => w.range === 'Very Far')).toHaveLength(24);
    expect(filterWeapons(weapons, search('far'), 1)).toHaveLength(101);
    expect(filterWeapons(weapons, search('very far'), 1)).toHaveLength(26);
    // The ones over 94 are weapons out of those two bands whose FEATURE says
    // "far" - the search reads the printed sentence, which is the point.
    expect(
      names(filterWeapons(weapons, search('far'), 1)).filter(
        (n) => !weapons.some((w) => w.name === n && (w.range === 'Far' || w.range === 'Very Far')),
      ),
    ).toEqual([
      'Casting Sword',
      'Displacement Razor',
      'Javelins',
      'Blitz Hammer',
      'Rocket Maul',
      'Impact Gauntlet',
      'Infinite Staff',
    ]);

    expect(filterWeapons(weapons, search('close'), 1)).toHaveLength(124);
    expect(weapons.filter((w) => w.range === 'Close' || w.range === 'Very Close')).toHaveLength(106);
    expect(filterWeapons(weapons, search('very close'), 1)).toHaveLength(81);
  });

  it('reads the trait, the category and the damage die', () => {
    expect(weapons.filter((w) => w.trait === 'instinct')).toHaveLength(50);
    expect(filterWeapons(weapons, search('instinct'), 1)).toHaveLength(50);
    expect(filterWeapons(weapons, search('spellcast'), 1)).toHaveLength(4);
    // 23 by trait plus the Ego Blade, whose feature is about Presence.
    expect(weapons.filter((w) => w.trait === 'presence')).toHaveLength(50);
    expect(filterWeapons(weapons, search('presence'), 1)).toHaveLength(51);

    expect(weapons.filter((w) => w.category === 'Magic')).toHaveLength(140);
    expect(filterWeapons(weapons, search('magic'), 1)).toHaveLength(140);
    // Every one of the 71 comes from the category; before, "magic" found one.
    expect(
      filterWeapons(weapons, search('magic'), 1).every((r) => r.item.category === 'Magic'),
    ).toBe(true);
    /*
     * 251 Physical, and the four Shadowblades, which are MAGIC weapons whose
     * feature offers "physical or magic damage". The damage *type* is not an
     * axis - it has no chip - so they arrive through their printed feature.
     *
     * This named the Ghostblade until the switch. The Ghostblade is one of the
     * nine weapons SRD 2.0 stopped printing, so the example had to be a
     * different weapon rather than a different number; `shadowblade` and its
     * three upgrades are what the shipped book offers in its place, and
     * `tests/ui/damageKind.test.tsx` holds the same four.
     */
    expect(weapons.filter((w) => w.category === 'Physical')).toHaveLength(251);
    expect(names(filterWeapons(weapons, search('physical'), 1))).toContain('Shadowblade');
    expect(filterWeapons(weapons, search('physical'), 1)).toHaveLength(255);

    // The die is the book's `d8+3`, not the `3d8+3` a Proficiency 3 sheet
    // prints, so the same search answers the same way on every character.
    expect(weapons.filter((w) => w.damage.includes('d8'))).toHaveLength(149);
    expect(filterWeapons(weapons, search('d8'), 1)).toHaveLength(160);
    expect(
      names(filterWeapons(weapons, search('d8'), 1)).filter(
        (n) => !weapons.some((w) => w.name === n && w.damage.includes('d8')),
      ),
    ).toEqual([
      'Casting Dagger',
      'Scepter',
      'Improved Casting Dagger',
      'Improved Scepter',
      'Advanced Casting Dagger',
      'Advanced Scepter',
      'Gunblade',
      'Hand Sling',
      'War Dart',
      'Legendary Casting Dagger',
      'Legendary Scepter',
    ]);
    expect(weapons.filter((w) => w.damage.includes('d12'))).toHaveLength(12);
    expect(filterWeapons(weapons, search('d12'), 1)).toHaveLength(12);
    expect(filterWeapons(weapons, search('d8+3'), 1)).toHaveLength(21);
    // A die is matched from the start of the string it is printed in, so the
    // "8" inside "d8+3" is not a search term of its own: 149 weapons roll a d8
    // and a bare "8" finds thirteen, every one of them through a feature that
    // prints the digit.
    expect(weapons.filter((w) => w.damage.includes('d8'))).toHaveLength(149);
    const eight = filterWeapons(weapons, search('8'), 1);
    expect(eight).toHaveLength(13);
    for (const r of eight) expect(r.item.feature).toContain('8');
  });

  it('reads the burden as the words the row prints, however the player spaces it', () => {
    expect(weapons.filter((w) => w.burden === 1)).toHaveLength(239);
    expect(weapons.filter((w) => w.burden === 2)).toHaveLength(152);
    expect(filterWeapons(weapons, search('one-handed'), 1)).toHaveLength(239);
    expect(filterWeapons(weapons, search('two-handed'), 1)).toHaveLength(152);
    // The row prints TWO-HANDED; nobody should have to find the hyphen.
    expect(filterWeapons(weapons, search('two handed'), 1)).toHaveLength(152);
    expect(filterWeapons(weapons, search('one handed'), 1)).toHaveLength(239);
    expect(filterWeapons(weapons, search('two'), 1)).toHaveLength(152);

    // And the reason the labels are matched from word starts rather than
    // folded into one string: every weapon in the book prints ONE-HANDED or
    // TWO-HANDED, so a plain substring search would answer "hand" with all 391
    // and bury the thirty weapons that actually say it.
    const hand = filterWeapons(weapons, search('hand'), 1);
    expect(hand).toHaveLength(30);
    for (const r of hand) expect(`${r.item.name} ${r.item.feature}`.toLowerCase()).toContain('hand');
    expect(names(hand)).toContain('Hand Crossbow');
    expect(names(hand)).toContain('Midas Scythe');
  });

  it('still does not read the id, the slot or the tier', () => {
    // The id is a slug the player never sees; the name it belongs to is found.
    expect(weapons.some((w) => w.id === 'aantari-bow')).toBe(true);
    expect(filterWeapons(weapons, search('aantari-bow'), 1)).toHaveLength(0);
    expect(names(filterWeapons(weapons, search('aantari bow'), 1))).toEqual(['Aantari Bow']);

    // The slot is a segmented control the picker already opens pre-set, and no
    // row prints the word, so a search for it would return rows that never say
    // why they are there. The twelve are features that mention a primary hand.
    expect(weapons.filter((w) => w.slot === 'secondary')).toHaveLength(100);
    expect(filterWeapons(weapons, search('secondary'), 1)).toHaveLength(0);
    expect(filterWeapons(weapons, search('primary'), 1)).toHaveLength(42);
    expect(
      filterWeapons(weapons, search('primary'), 1).every((r) =>
        `${r.item.name} ${r.item.feature}`.toLowerCase().includes('primary'),
      ),
    ).toBe(true);

    /*
     * The tier is a badge and a chip row, but it is a bare digit: folding
     * "Tier 3" in would let a stray 3 pick out a quarter of the armoury. The
     * thirteen a "3" does find are features that print one - "+3 to Armor
     * Score", "d8+3" - and only four of the thirteen are tier 3.
     *
     * "tier" now answers with four rows and that is still not the badge: they
     * are the four `Wooden Stake` records, whose printed feature reads "Gain a
     * bonus equal to 1 + your tier to primary weapon damage". The word is in
     * the book's own sentence, which is exactly what the box reads. "tier 3"
     * still finds nothing.
     */
    expect(weapons.filter((w) => w.tier === 3)).toHaveLength(93);
    expect(names(filterWeapons(weapons, search('tier'), 1))).toEqual([
      'Wooden Stake',
      'Wooden Stake',
      'Wooden Stake',
      'Wooden Stake',
    ]);
    expect(filterWeapons(weapons, search('tier 3'), 1)).toHaveLength(0);
    const three = filterWeapons(weapons, search('3'), 1);
    expect(three).toHaveLength(13);
    expect(three.filter((r) => r.item.tier === 3)).toHaveLength(4);
    for (const r of three) expect(r.item.feature).toContain('3');
  });

  it('crosses a typed axis with the chips, which are now a shortcut and not the only route', () => {
    // The chips still narrow what the text found: 114 weapons answer "melee",
    // 21 of them at tier 1.
    expect(
      filterWeapons(weapons, { ...search('melee'), tiers: new Set<Tier>([1]) }, 1),
    ).toHaveLength(58);
    // Typing an axis and chipping a different value of the same axis is not a
    // contradiction the filter has to resolve: these are Far weapons whose
    // feature is about melee attackers, and they are the answer.
    expect(
      names(filterWeapons(weapons, { ...search('melee'), ranges: new Set<Range>(['Far']) }, 1)),
    ).toEqual([
      'Enchanted Kite',
      'Scepter',
      'Improved Scepter',
      'Advanced Scepter',
      'Gunblade',
      'War Dart',
      'Gravity Arbalest',
      'Legendary Scepter',
    ]);
    expect(
      filterWeapons(weapons, { ...search('two-handed'), category: 'Magic' }, 1),
    ).toHaveLength(56);
    expect(weapons.filter((w) => w.burden === 2 && w.category === 'Magic')).toHaveLength(56);
  });

  it('matches inside a name or a feature, but not across the seam between them', () => {
    // The old code searched `${name} ${feature}` as one string, so a query
    // spanning the two matched. Nothing prints them adjacently - the picker
    // draws the name and the feature on separate lines - so that match was an
    // artefact of the join rather than something a player could have meant.
    const broadsword = weapons.find((w) => w.name === 'Broadsword');
    expect(broadsword?.feature).toBe('Reliable: +1 to attack rolls');
    expect(filterWeapons(weapons, search('broadsword reliable'), 1)).toEqual([]);
    expect(names(filterWeapons(weapons, search('broadsword'), 1))).toEqual([
      'Broadsword',
      'Improved Broadsword',
      'Urok Broadsword',
      'Advanced Broadsword',
      'Legendary Broadsword',
    ]);
    expect(filterWeapons(weapons, search('reliable'), 1)).toHaveLength(14);
  });

  it('folds nothing into the armor search, because armor has no axis to fold', () => {
    // Armor's only chip is tier. Two sets mention melee in their feature and
    // that is all "melee" may return: an armor list that grew because weapons
    // did would be inventing a filter the picker does not have.
    expect(filterArmors(armors, { ...armorQuery(), search: 'melee' }, 1)).toHaveLength(3);
    expect(filterArmors(armors, { ...armorQuery(), search: 'magic' }, 1)).toHaveLength(8);
    // One armor prints "tier" in its own feature, the way four weapons do.
    expect(filterArmors(armors, { ...armorQuery(), search: 'tier' }, 1)).toHaveLength(1);
    expect(filterArmors(armors, { ...armorQuery(), search: 'one-handed' }, 1)).toHaveLength(0);
    for (const q of ['melee', 'magic']) {
      for (const r of filterArmors(armors, { ...armorQuery(), search: q }, 1)) {
        expect(`${r.item.name} ${r.item.feature}`.toLowerCase()).toContain(q);
      }
    }
  });

  it('reads the one axis an item has, in both the words the picker uses for it', () => {
    // "Loot" and "Consumables" are the two buttons over this list, and typing
    // either used to return nothing - 0 for "loot", 1 for "consumable".
    expect(filterItems(items, { ...itemQuery(), search: 'loot' })).toHaveLength(121);
    /*
     * 120 loot and one consumable: Formoid Serum, whose text says the drinker
     * "keeps and has access to all equipment, loot, and features". The word is
     * printed on the row, so the box answers with it - the same rule that
     * makes "consumable" return the Box of Many Goods below.
     */
    expect(
      filterItems(items, { ...itemQuery(), search: 'loot' })
        .filter((i) => i.kind !== 'loot')
        .map((i) => i.name),
    ).toEqual(['Formoid Serum']);
    // 120 consumables, plus the Box of Many Goods, which is loot whose text
    // says it contains random common consumables. The plural is what the
    // button says, so both forms answer.
    expect(filterItems(items, { ...itemQuery(), search: 'consumable' })).toHaveLength(121);
    expect(filterItems(items, { ...itemQuery(), search: 'consumables' })).toHaveLength(121);
    expect(
      filterItems(items, { ...itemQuery(), search: 'consumable', kind: 'loot' }).map((i) => i.name),
    ).toEqual(['Box of Many Goods']);
  });
});

describe('each filter axis on its own', () => {
  it('counts every weapon tier, and the four tiers are the whole armoury', () => {
    const counted = TIERS.map((t) => {
      const q: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([t]) };
      const rows = filterWeapons(weapons, q, 1);
      expect(rows).toHaveLength(weapons.filter((w) => w.tier === t).length);
      for (const r of rows) expect(r.item.tier).toBe(t);
      return rows.length;
    });
    expect(counted).toEqual([96, 101, 93, 101]);
    expect(counted.reduce((a, b) => a + b, 0)).toBe(391);
  });

  it('counts primary and secondary weapons, and they add up to the armoury', () => {
    const primary = filterWeapons(weapons, weaponQuery('primary'), 1);
    const secondary = filterWeapons(weapons, weaponQuery('secondary'), 1);
    expect(primary).toHaveLength(291);
    expect(secondary).toHaveLength(100);
    expect(primary.length + secondary.length).toBe(391);
    for (const r of primary) expect(r.item.slot).toBe('primary');
    for (const r of secondary) expect(r.item.slot).toBe('secondary');
  });

  it('separates Physical from Magic', () => {
    const physical = filterWeapons(weapons, { ...weaponQuery(), category: 'Physical' }, 1);
    const magic = filterWeapons(weapons, { ...weaponQuery(), category: 'Magic' }, 1);
    expect(physical).toHaveLength(251);
    expect(magic).toHaveLength(140);
    expect(physical.length + magic.length).toBe(391);
    for (const r of magic) expect(r.item.category).toBe('Magic');
  });

  it('finds every weapon trait, down to the four spellcast weapons', () => {
    const counts: Record<string, number> = {};
    for (const t of TRAITS) {
      const q: WeaponQuery = { ...weaponQuery(), traits: new Set<WeaponTrait>([t]) };
      const rows = filterWeapons(weapons, q, 1);
      expect(rows).toHaveLength(weapons.filter((w) => w.trait === t).length);
      counts[t] = rows.length;
    }
    expect(counts).toEqual({
      agility: 76,
      strength: 94,
      finesse: 82,
      instinct: 50,
      presence: 50,
      knowledge: 35,
      spellcast: 4,
    });
    expect(
      names(filterWeapons(weapons, { ...weaponQuery(), traits: new Set<WeaponTrait>(['spellcast']) }, 1)),
    ).toEqual([
      'Arcane-Frame Wheelchair',
      'Improved Arcane-Frame Wheelchair',
      'Advanced Arcane-Frame Wheelchair',
      'Legendary Arcane-Frame Wheelchair',
    ]);
  });

  it('finds every range band, and the five bands are the whole armoury', () => {
    const counts: Record<string, number> = {};
    for (const range of RANGES) {
      const q: WeaponQuery = { ...weaponQuery(), ranges: new Set<Range>([range]) };
      const rows = filterWeapons(weapons, q, 1);
      expect(rows).toHaveLength(weapons.filter((w) => w.range === range).length);
      for (const r of rows) expect(r.item.range).toBe(range);
      counts[range] = rows.length;
    }
    expect(counts).toEqual({ Melee: 191, 'Very Close': 67, Close: 39, Far: 70, 'Very Far': 24 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(391);
  });

  it('separates one-handed from two-handed', () => {
    const one = filterWeapons(weapons, { ...weaponQuery(), burdens: new Set<1 | 2>([1]) }, 1);
    const two = filterWeapons(weapons, { ...weaponQuery(), burdens: new Set<1 | 2>([2]) }, 1);
    expect(one).toHaveLength(239);
    expect(two).toHaveLength(152);
    expect(one.length + two.length).toBe(391);
    for (const r of two) expect(r.item.burden).toBe(2);
  });

  it('filters armor by tier, and the four tiers are the whole rack', () => {
    const counted = TIERS.map(
      (t) => filterArmors(armors, { ...armorQuery(), tiers: new Set<Tier>([t]) }, 1).length,
    );
    expect(counted).toEqual([15, 24, 23, 23]);
    expect(counted.reduce((a, b) => a + b, 0)).toBe(85);
    expect(
      names(filterArmors(armors, { ...armorQuery(), tiers: new Set<Tier>([1]) }, 1)),
    ).toEqual([
      'Baking Tray Breastplate',
      'Banded Armor',
      'Brigandine Armor',
      'Chainmail Armor',
      'Coffinwood Armor',
      'Full Plate Armor',
      'Gambeson Armor',
      'Leather Apron',
      'Leather Armor',
      'Leather Longcoat',
      'Mage Robes',
      'Quilted Clothing',
      'Scale Mail Armor',
      'Silverweave Armor',
      'Tree Bark Armor',
    ]);
  });

  it('splits loot from consumables, and keeps both when neither chip is chosen', () => {
    const loot = filterItems(items, { ...itemQuery(), kind: 'loot' });
    const consumable = filterItems(items, { ...itemQuery(), kind: 'consumable' });
    expect(loot).toHaveLength(120);
    expect(consumable).toHaveLength(120);
    for (const i of loot) expect(i.kind).toBe('loot');
    for (const i of consumable) expect(i.kind).toBe('consumable');

    const all = filterItems(items, itemQuery());
    expect(all).toHaveLength(240);
    // Consumables sort ahead of loot, then alphabetically inside each kind.
    expect([all[0]!.name, all[0]!.kind]).toEqual(['Acidpaste', 'consumable']);
    expect([all[119]!.name, all[119]!.kind]).toEqual(['Yakamel Milk', 'consumable']);
    expect([all[120]!.name, all[120]!.kind]).toEqual(['Airblade Charm', 'loot']);
    expect([all[239]!.name, all[239]!.kind]).toEqual(['Zephyr\u2019s Jar', 'loot']);
  });
});

describe('filters crossing each other', () => {
  it('ANDs across axes: the off-hand tier-one rack holds exactly these', () => {
    const q: WeaponQuery = { ...weaponQuery('secondary'), tiers: new Set<Tier>([1]) };
    const rows = filterWeapons(weapons, q, 1);
    // Seven on SRD 1.0; twenty-five on the book the app ships.
    expect(names(rows)).toEqual([
      'Barrel Lid Shield',
      'Chain Whip',
      'Festival Whip',
      'Fighting Cloak',
      'Flare Launcher',
      'Focus Runes',
      'Grappler',
      'Hallowed Shield',
      'Hand Crossbow',
      'Hatchet',
      'Large Fork',
      'Lasso',
      'Offhand Brass Knuckles',
      'Paring Knife',
      'Round Shield',
      'Rune Shield',
      'Shortsword',
      'Small Dagger',
      'Small Revolver',
      'Table Shield',
      'Throwing Knives',
      'Tower Shield',
      'Towline Hook',
      'Whip',
      'Wooden Stake',
    ]);
    // Counted again here, without the module under test.
    expect(sortedNames(rows.map((r) => r.item))).toEqual(
      sortedNames(weapons.filter((w) => w.slot === 'secondary' && w.tier === 1)),
    );
  });

  it('ORs inside an axis, and an untouched chip row narrows nothing at all', () => {
    const tiers: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([2, 4]) };
    expect(filterWeapons(weapons, tiers, 1)).toHaveLength(202);
    expect(202).toBe(
      weapons.filter((w) => w.tier === 2).length + weapons.filter((w) => w.tier === 4).length,
    );

    const traits: WeaponQuery = {
      ...weaponQuery(),
      traits: new Set<WeaponTrait>(['finesse', 'knowledge']),
    };
    expect(filterWeapons(weapons, traits, 1)).toHaveLength(117);
    expect(117).toBe(weapons.filter((w) => w.trait === 'finesse' || w.trait === 'knowledge').length);

    const ranges: WeaponQuery = {
      ...weaponQuery(),
      ranges: new Set<Range>(['Far', 'Very Far']),
    };
    expect(filterWeapons(weapons, ranges, 1)).toHaveLength(94);

    // Every set empty is the opening state, and it hides nothing.
    expect(filterWeapons(weapons, weaponQuery(), 1)).toHaveLength(391);
    expect(filterArmors(armors, armorQuery(), 1)).toHaveLength(85);
  });

  it('crosses text, tier and range at once, down to sixteen bows', () => {
    const q: WeaponQuery = {
      ...weaponQuery(),
      search: 'bow',
      tiers: new Set<Tier>([2, 3]),
      ranges: new Set<Range>(['Far', 'Very Far']),
    };
    const rows = filterWeapons(weapons, q, 10);
    expect(names(rows)).toEqual([
      'Elder Bow',
      'Finehair Bow',
      'Greatbow',
      'Improved Crossbow',
      'Improved Longbow',
      'Improved Shortbow',
      'Repeating Crossbow',
      'Splintershaft Bow',
      'Yutari Bloodbow',
      'Improved Hand Crossbow',
      'Advanced Crossbow',
      'Advanced Longbow',
      'Advanced Shortbow',
      'Repeating Crossbow',
      'Spiked Bow',
      'Advanced Hand Crossbow',
    ]);
    // Cross-checked without the filter: same sixteen, however they are ordered.
    expect(sortedNames(rows.map((r) => r.item))).toEqual(
      sortedNames(
        weapons.filter(
          (w) =>
            weaponHits(w, 'bow') &&
            (w.tier === 2 || w.tier === 3) &&
            (w.range === 'Far' || w.range === 'Very Far'),
        ),
      ),
    );
    // Primaries come before secondaries inside a tier, which is why the two
    // Hand Crossbows sit at the end of their tier rather than under "H".
    expect(rows[8]!.item.slot).toBe('primary');
    expect(rows[9]!.item.name).toBe('Improved Hand Crossbow');
    expect(rows[9]!.item.slot).toBe('secondary');
  });

  it('crosses a search with the loot/consumable chip', () => {
    const potions = filterItems(items, { ...itemQuery(), search: 'potion' });
    expect(potions).toHaveLength(36);
    expect(filterItems(items, { ...itemQuery(), search: 'potion', kind: 'consumable' })).toHaveLength(
      34,
    );
    // The two that are loot are recipes, not potions - the crossing is what
    // tells them apart.
    expect(
      filterItems(items, { ...itemQuery(), search: 'potion', kind: 'loot' }).map((i) => i.name),
    ).toEqual(['Minor Health Potion Recipe', 'Minor Stamina Potion Recipe']);
    expect(filterItems(items, { ...itemQuery(), search: 'gem', kind: 'consumable' })).toHaveLength(0);
    expect(filterItems(items, { ...itemQuery(), search: 'gem', kind: 'loot' })).toHaveLength(7);
  });

  it('agrees with plain array code across every combination this sweep walks', () => {
    const slots: SlotChoice[] = ['all', 'primary', 'secondary'];
    const categories: CategoryChoice[] = ['all', 'Physical', 'Magic'];
    const reaches: Reach[] = ['all', 'usable'];
    const tierSets: Array<ReadonlySet<Tier>> = [
      new Set<Tier>(),
      new Set<Tier>([1]),
      new Set<Tier>([2]),
      new Set<Tier>([3]),
      new Set<Tier>([4]),
    ];
    const burdenSets: Array<ReadonlySet<1 | 2>> = [
      new Set<1 | 2>(),
      new Set<1 | 2>([1]),
      new Set<1 | 2>([2]),
      new Set<1 | 2>([1, 2]),
    ];
    const traitSets: Array<ReadonlySet<WeaponTrait>> = [
      new Set<WeaponTrait>(),
      ...TRAITS.map((t) => new Set<WeaponTrait>([t])),
    ];
    const rangeSets: Array<ReadonlySet<Range>> = [
      new Set<Range>(),
      ...RANGES.map((r) => new Set<Range>([r])),
      new Set<Range>(['Far', 'Very Far']),
    ];

    let walked = 0;
    let rowsReturned = 0;
    let nonEmpty = 0;
    const disagreed: string[] = [];
    const misordered: string[] = [];

    const check = (q: WeaponQuery, level: number, label: string): void => {
      const rows = filterWeapons(weapons, q, level);
      walked += 1;
      rowsReturned += rows.length;
      if (rows.length > 0) nonEmpty += 1;
      const mine = sortedNames(expectedWeapons(q, level));
      if (JSON.stringify(sortedNames(rows.map((r) => r.item))) !== JSON.stringify(mine)) {
        disagreed.push(label);
      }
      if (!inPickerOrder(rows)) misordered.push(label);
    };

    // Sweep one: reach x slot x category x one tier chip, at level 4.
    for (const reach of reaches)
      for (const slot of slots)
        for (const category of categories)
          for (const tiers of tierSets)
            check(
              { ...weaponQuery(), reach, slot, category, tiers },
              4,
              `L4 ${reach}/${slot}/${category}/[${[...tiers].join(',')}]`,
            );

    // Sweep two: burden x trait x range, at level 3.
    for (const burdens of burdenSets)
      for (const traits of traitSets)
        for (const ranges of rangeSets)
          check(
            { ...weaponQuery(), burdens, traits, ranges },
            3,
            `L3 [${[...burdens].join(',')}]/[${[...traits].join(',')}]/[${[...ranges].join(',')}]`,
          );

    expect(disagreed).toEqual([]);
    expect(misordered).toEqual([]);
    expect(walked).toBe(314);
    expect(rowsReturned).toBe(9960);
    // A sweep of 314 empty results would agree with anything. 233 of these
    // combinations return weapons; the other 81 are intersections the armoury
    // genuinely has nothing in, such as a secondary Magic weapon.
    expect(nonEmpty).toBe(248);

    // The eight chip axes are 2 x 3 x 3 x 16 x 4 x 128 x 32 combinations before
    // a single letter is typed. This is what was left alone.
    const whole = 2 * 3 * 3 * 16 * 4 * 128 * 32;
    console.log(
      `[gear] crossed ${walked} of ${whole.toLocaleString('en-US')} chip combinations ` +
        `(${((walked / whole) * 100).toFixed(4)}%), returning ${rowsReturned} rows. ` +
        `NOT swept: multi-tier chip sets beyond the singletons, trait pairs, ` +
        `slot/category crossed with burden/trait/range, and every search string - ` +
        `the search axis alone is unbounded.`,
    );
  });
});

describe('the honesty rule: out of reach stays on screen and says why', () => {
  it('shows a level-one character the Legendary Longsword and tells them when it opens up', () => {
    const rows = filterWeapons(weapons, search('longsword'), 1);
    expect(rows.map((r) => [r.item.name, r.item.tier, r.eligible, r.reason])).toEqual([
      ['Longsword', 1, true, null],
      ['Improved Longsword', 2, false, 'Tier 2 — usable from level 2'],
      ['Advanced Longsword', 3, false, 'Tier 3 — usable from level 5'],
      ['Legendary Longsword', 4, false, 'Tier 4 — usable from level 8'],
    ]);
    // The sentence the screen prints comes from tierNote and nowhere else.
    expect(rows[3]!.reason).toBe(tierNote(4, 1));
    // An em dash, not a hyphen: the picker uppercases this string as-is.
    expect(rows[3]!.reason!.codePointAt(7)).toBe(0x2014);
  });

  it('drops the reason the moment the level reaches the tier', () => {
    const at = (level: number): Array<string | null> =>
      filterWeapons(weapons, search('longsword'), level).map((r) => r.reason);

    expect(at(1)).toEqual([
      null,
      'Tier 2 — usable from level 2',
      'Tier 3 — usable from level 5',
      'Tier 4 — usable from level 8',
    ]);
    expect(at(2)).toEqual([null, null, 'Tier 3 — usable from level 5', 'Tier 4 — usable from level 8']);
    expect(at(4)).toEqual([null, null, 'Tier 3 — usable from level 5', 'Tier 4 — usable from level 8']);
    expect(at(5)).toEqual([null, null, null, 'Tier 4 — usable from level 8']);
    expect(at(7)).toEqual([null, null, null, 'Tier 4 — usable from level 8']);
    expect(at(8)).toEqual([null, null, null, null]);
    expect(at(10)).toEqual([null, null, null, null]);
    expect(filterWeapons(weapons, search('longsword'), 8).every((r) => r.eligible)).toBe(true);
  });

  it('names the level each tier opens at, and never fences off tier one', () => {
    expect(TIERS.map(tierLevel)).toEqual([1, 2, 5, 8]);
    for (const level of LEVELS) expect(tierNote(1, level)).toBeNull();
    expect(tierNote(2, 2)).toBeNull();
    expect(tierNote(3, 5)).toBeNull();
    expect(tierNote(4, 8)).toBeNull();
    expect(tierNote(2, 1)).toBe('Tier 2 — usable from level 2');
    expect(tierNote(3, 4)).toBe('Tier 3 — usable from level 5');
    expect(tierNote(4, 7)).toBe('Tier 4 — usable from level 8');
  });

  it('says the same three sentences for every weapon and armor, at every level', () => {
    const sentence = (tier: Tier): string | null =>
      tier === 2
        ? 'Tier 2 — usable from level 2'
        : tier === 3
          ? 'Tier 3 — usable from level 5'
          : tier === 4
            ? 'Tier 4 — usable from level 8'
            : null;

    let checked = 0;
    let outOfReach = 0;
    const wrong: string[] = [];
    for (const level of LEVELS) {
      const rows = [
        ...filterWeapons(weapons, weaponQuery(), level),
        ...filterArmors(armors, armorQuery(), level),
      ];
      for (const r of rows) {
        checked += 1;
        const expected = r.item.tier <= reachedTier(level) ? null : sentence(r.item.tier);
        if (r.reason !== expected) wrong.push(`L${level} ${r.item.name}: ${String(r.reason)}`);
        // The two fields are one fact: a dimmed row with no sentence would be
        // the silent refusal this module exists to avoid.
        if (r.eligible !== (r.reason === null)) wrong.push(`L${level} ${r.item.name}: split`);
        if (r.reason !== null) outOfReach += 1;
      }
    }
    expect(wrong).toEqual([]);
    expect(checked).toBe((391 + 85) * 10);
    // 295 weapons + 70 armors out of reach at level 1, 194 + 46 through levels
    // 2-4, 101 + 23 through 5-7, and nothing at all from level 8.
    expect(outOfReach).toBe(295 + 70 + (194 + 46) * 3 + (101 + 23) * 3);
    expect(outOfReach).toBe(1457);
  });

  it('never hides a weapon while reach is "all", however low the level', () => {
    for (const level of LEVELS) {
      expect(filterWeapons(weapons, weaponQuery(), level)).toHaveLength(391);
      expect(filterArmors(armors, armorQuery(), level)).toHaveLength(85);
    }
    // A level 1 party handed a tier 4 sword can still find it and equip it.
    const legendary = filterWeapons(weapons, weaponQuery(), 1).filter((r) => r.item.tier === 4);
    expect(legendary).toHaveLength(101);
    expect(legendary.every((r) => r.reason === 'Tier 4 — usable from level 8')).toBe(true);
  });

  it('hides exactly the out-of-reach rows when reach is "usable", and nothing else', () => {
    const usableWeapons: Record<number, number> = {};
    const usableArmors: Record<number, number> = {};
    for (const level of LEVELS) {
      const all = filterWeapons(weapons, weaponQuery(), level);
      const usable = filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, level);
      // Same rows, minus the ones carrying a reason - not a different search.
      expect(names(usable)).toEqual(names(all.filter((r) => r.eligible)));
      expect(usable.every((r) => r.reason === null && r.eligible)).toBe(true);
      expect(usable).toHaveLength(weapons.filter((w) => w.tier <= reachedTier(level)).length);
      usableWeapons[level] = usable.length;

      const armorAll = filterArmors(armors, armorQuery(), level);
      const armorUsable = filterArmors(armors, { ...armorQuery(), reach: 'usable' }, level);
      expect(names(armorUsable)).toEqual(names(armorAll.filter((r) => r.eligible)));
      usableArmors[level] = armorUsable.length;
    }
    expect(usableWeapons).toEqual({
      1: 96,
      2: 197,
      3: 197,
      4: 197,
      5: 290,
      6: 290,
      7: 290,
      8: 391,
      9: 391,
      10: 391,
    });
    expect(usableArmors).toEqual({
      1: 15,
      2: 39,
      3: 39,
      4: 39,
      5: 62,
      6: 62,
      7: 62,
      8: 85,
      9: 85,
      10: 85,
    });
    console.log(
      `[gear] weapons within reach by level: ${LEVELS.map((l) => `${l}:${usableWeapons[l]}`).join(' ')} (of 391)`,
    );
  });

  it('treats a level below one or far above ten as the tier it behaves like', () => {
    // Nothing validates the level, so the picker must not invent a fifth tier.
    expect(tierNote(2, 0)).toBe('Tier 2 — usable from level 2');
    expect(tierNote(4, -3)).toBe('Tier 4 — usable from level 8');
    expect(tierNote(4, 99)).toBeNull();
    expect(filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 0)).toHaveLength(96);
    expect(filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 99)).toHaveLength(391);
  });
});

describe('the count on screen and the CLEAR FILTERS chip', () => {
  it('counts what is shown, which is not what exists', () => {
    const shown = filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 1);
    // The picker prints "<shown> OF <total>", and the total is the armoury.
    expect(shown).toHaveLength(96);
    expect(weapons.length).toBe(391);
    // Eleven weapons say "dagger"; five of them can go in the off hand.
    expect(filterWeapons(weapons, search('dagger'), 1)).toHaveLength(19);
    expect(filterWeapons(weapons, { ...weaponQuery('secondary'), search: 'dagger' }, 1)).toHaveLength(
      5,
    );
    expect(filterArmors(armors, { ...armorQuery(), reach: 'usable' }, 1)).toHaveLength(15);
    expect(filterItems(items, { ...itemQuery(), kind: 'loot' })).toHaveLength(120);
  });

  it('reads pristine until an axis moves, and then reads dirty on that axis alone', () => {
    const base = weaponQuery();
    expect(weaponQueryChanged(base, base)).toBe(false);
    expect(weaponQueryChanged(weaponQuery(), base)).toBe(false);

    expect(weaponQueryChanged({ ...base, search: 'sword' }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, reach: 'usable' }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, slot: 'primary' }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, category: 'Magic' }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, tiers: new Set<Tier>([3]) }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, burdens: new Set<1 | 2>([2]) }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base, traits: new Set<WeaponTrait>(['finesse']) }, base)).toBe(
      true,
    );
    expect(weaponQueryChanged({ ...base, ranges: new Set<Range>(['Melee']) }, base)).toBe(true);
  });

  it('compares chip sets by their members, not by which Set object holds them', () => {
    // React hands back a new Set on every toggle; two of them holding the same
    // chips must not light up CLEAR FILTERS.
    const base: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([2, 3]) };
    const same: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([2, 3]) };
    const reordered: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([3, 2]) };
    expect(base.tiers).not.toBe(same.tiers);
    expect(weaponQueryChanged(same, base)).toBe(false);
    expect(weaponQueryChanged(reordered, base)).toBe(false);
    expect(weaponQueryChanged({ ...weaponQuery(), tiers: new Set<Tier>([2]) }, base)).toBe(true);
    expect(weaponQueryChanged({ ...weaponQuery(), tiers: new Set<Tier>([2, 3, 4]) }, base)).toBe(
      true,
    );
    // And the two queries really do return the same list.
    expect(names(filterWeapons(weapons, same, 1))).toEqual(names(filterWeapons(weapons, base, 1)));
  });

  it('tells one chip from another at the same count, not just one count from another', () => {
    // The comparison above only ever moves the number of lit chips, so a
    // size-only check would pass every line of it. Swapping a chip is the case
    // that matters the moment a picker opens with something already applied -
    // which weaponQuery(slot) does today for the slot axis. A picker showing
    // tier 3 only, against a base of tier 2 only, would read as untouched:
    // CLEAR FILTERS stays hidden and the player has no way back to the full
    // armoury except closing the dialog.
    const tierTwo: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([2]) };
    const tierThree: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([3]) };
    expect(weaponQueryChanged(tierThree, tierTwo)).toBe(true);
    expect(weaponQueryChanged(tierTwo, tierThree)).toBe(true);
    // The two really are different pickers: 56 tier 2 weapons, 57 tier 3.
    expect(filterWeapons(weapons, tierTwo, 8)).toHaveLength(101);
    expect(filterWeapons(weapons, tierThree, 8)).toHaveLength(93);

    // Same size, disjoint members, on every set-valued axis.
    const swaps: Array<[string, WeaponQuery, WeaponQuery]> = [
      [
        'tiers {1,2} vs {3,4}',
        { ...weaponQuery(), tiers: new Set<Tier>([1, 2]) },
        { ...weaponQuery(), tiers: new Set<Tier>([3, 4]) },
      ],
      [
        'burdens {1} vs {2}',
        { ...weaponQuery(), burdens: new Set<1 | 2>([1]) },
        { ...weaponQuery(), burdens: new Set<1 | 2>([2]) },
      ],
      [
        'traits {finesse} vs {strength}',
        { ...weaponQuery(), traits: new Set<WeaponTrait>(['finesse']) },
        { ...weaponQuery(), traits: new Set<WeaponTrait>(['strength']) },
      ],
      [
        'ranges {Melee} vs {Far}',
        { ...weaponQuery(), ranges: new Set<Range>(['Melee']) },
        { ...weaponQuery(), ranges: new Set<Range>(['Far']) },
      ],
    ];
    for (const [label, left, right] of swaps) {
      expect(weaponQueryChanged(right, left), label).toBe(true);
      expect(weaponQueryChanged(left, right), label).toBe(true);
      // A swap nobody can see on screen would not be worth reporting, so each
      // pair really does show a different armoury.
      expect(names(filterWeapons(weapons, left, 8)), label).not.toEqual(
        names(filterWeapons(weapons, right, 8)),
      );
    }

    // Armor has only the one chip row, and it must answer the same way.
    const armorLow = { ...armorQuery(), tiers: new Set<Tier>([1, 2]) };
    const armorHigh = { ...armorQuery(), tiers: new Set<Tier>([3, 4]) };
    expect(armorQueryChanged(armorHigh, armorLow)).toBe(true);
    expect(filterArmors(armors, armorLow, 8)).toHaveLength(39);
    expect(filterArmors(armors, armorHigh, 8)).toHaveLength(46);
  });

  it('does not count a stray space as a filter, and still shows everything', () => {
    const base = weaponQuery();
    expect(weaponQueryChanged({ ...base, search: '   ' }, base)).toBe(false);
    expect(filterWeapons(weapons, { ...base, search: '   ' }, 1)).toHaveLength(391);
    // A word with spaces around it is a real filter, trimmed before it matches.
    expect(weaponQueryChanged({ ...base, search: '  sword  ' }, base)).toBe(true);
    expect(filterWeapons(weapons, { ...base, search: '  sword  ' }, 1)).toHaveLength(31);

    const armorBase = armorQuery();
    expect(armorQueryChanged({ ...armorBase, search: ' ' }, armorBase)).toBe(false);
    const itemBase = itemQuery();
    expect(itemQueryChanged({ ...itemBase, search: '\t ' }, itemBase)).toBe(false);
    expect(filterItems(items, { ...itemBase, search: '\t ' })).toHaveLength(240);
  });

  it('remembers that the off-hand picker opens already narrowed', () => {
    const base = weaponQuery('secondary');
    expect(base.slot).toBe('secondary');
    expect(weaponQueryChanged(base, base)).toBe(false);
    expect(filterWeapons(weapons, base, 1)).toHaveLength(100);
    // Widening to "Any" is a change, and clearing puts the slot back rather
    // than opening the whole 204 onto an off-hand picker.
    const widened: WeaponQuery = { ...base, slot: 'all' };
    expect(weaponQueryChanged(widened, base)).toBe(true);
    expect(filterWeapons(weapons, widened, 1)).toHaveLength(391);
    expect(filterWeapons(weapons, weaponQuery('secondary'), 1)).toHaveLength(100);
  });

  it('tracks the armor and item queries the same way', () => {
    const a = armorQuery();
    expect(armorQueryChanged(a, a)).toBe(false);
    expect(armorQueryChanged({ ...a, reach: 'usable' }, a)).toBe(true);
    expect(armorQueryChanged({ ...a, search: 'leather' }, a)).toBe(true);
    const tiered: ArmorQuery = { ...armorQuery(), tiers: new Set<Tier>([4]) };
    expect(armorQueryChanged(tiered, a)).toBe(true);
    expect(armorQueryChanged({ ...armorQuery(), tiers: new Set<Tier>([4]) }, tiered)).toBe(false);

    const i = itemQuery();
    expect(itemQueryChanged(i, i)).toBe(false);
    expect(itemQueryChanged({ ...i, kind: 'consumable' }, i)).toBe(true);
    const searched: ItemQuery = { ...i, search: 'potion' };
    expect(itemQueryChanged(searched, i)).toBe(true);
    expect(itemQueryChanged({ ...searched, search: 'potion' }, searched)).toBe(false);
  });
});

describe('the empty search and the search that finds nothing', () => {
  it('shows the whole list when the box is empty', () => {
    expect(filterWeapons(weapons, weaponQuery(), 1)).toHaveLength(391);
    expect(filterWeapons(weapons, weaponQuery(), 10)).toHaveLength(391);
    expect(filterArmors(armors, armorQuery(), 1)).toHaveLength(85);
    expect(filterItems(items, itemQuery())).toHaveLength(240);
  });

  it('returns exactly nothing for a search nothing matches, and does not throw', () => {
    for (const term of ['zzzz', 'excalibur', '🐉', 'sword sword']) {
      expect(filterWeapons(weapons, search(term), 1)).toEqual([]);
      expect(filterArmors(armors, { ...armorQuery(), search: term }, 1)).toEqual([]);
      expect(filterItems(items, { ...itemQuery(), search: term })).toEqual([]);
    }
    /*
     * The crossing that used to be empty is not any more, and the change is
     * the BOOK's. SRD 1.0 printed 71 Magic weapons and 37 secondary ones and
     * not one weapon was both, so this pair proved "empty because the axes
     * disagree". SRD 2.0 prints eighteen magic off-hands - Focus Runes, Rune
     * Shield, Hallowed Shield and the rest - so the pair no longer proves it
     * and the assertion says what is true instead.
     */
    expect(weapons.filter((w) => w.category === 'Magic')).toHaveLength(140);
    expect(
      filterWeapons(weapons, { ...weaponQuery('secondary'), category: 'Magic' }, 10),
    ).toHaveLength(18);
    // A real word crossed with an axis that has none of it: the dataset holds
    // twelve wheelchairs, three of them at tier 1, and not one is an off-hand.
    expect(filterWeapons(weapons, search('wheelchair'), 1)).toHaveLength(12);
    expect(
      names(filterWeapons(weapons, { ...search('wheelchair'), tiers: new Set<Tier>([1]) }, 1)),
    ).toEqual([
      'Arcane-Frame Wheelchair',
      'Heavy-Frame Wheelchair',
      'Light-Frame Wheelchair',
    ]);
    expect(filterWeapons(weapons, { ...search('wheelchair'), slot: 'secondary' }, 1)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The one line under a filled slot
// ---------------------------------------------------------------------------

/**
 * The sentence a slot prints about what is in it, counted against the whole
 * armoury for the reason the filters are.
 *
 * This one is not a filter and it can still be wrong invisibly, in the harder
 * direction: a note that does not appear looks exactly like a note that had
 * nothing to say. Both screens had that defect and in opposite ways - the
 * wizard printed the burden sentence over an EMPTY off-hand slot, and both
 * printed it to a Warrior, whose Combat Training reads *"You ignore burden when
 * equipping weapons."*
 *
 * MEASURED on `data/srd-2.0.json`, and the numbers pick the cases below:
 *
 *   primary slot, burden 1     139        primary slot, burden 2     152
 *   secondary slot, burden 1   100        secondary slot, burden 2     0
 *
 * The zero is why the count matters rather than the old `primary.burden === 2`
 * test. No weapon the book files as an off-hand takes two hands, so on this
 * printing three hands can only be reached by a two-handed PRIMARY beside an
 * off-hand, and four hands only by a primary-slot weapon sitting in the
 * off-hand - which the pickers allow, because their slot chip is a default and
 * not a fence.
 */
const weapon = (name: string): Weapon => {
  const found = weapons.find((w) => w.name === name);
  if (!found) throw new Error(`no weapon called ${name} in this build`);
  return found;
};

describe('what a filled weapon slot says about what is in it', () => {
  const LONGSWORD = weapon('Longsword'); // primary, two-handed, tier 1
  const BROADSWORD = weapon('Broadsword'); // primary, one-handed, tier 1
  const HATCHET = weapon('Hatchet'); // secondary, one-handed, tier 1
  const LEGENDARY_HATCHET = weapon('Legendary Hatchet'); // secondary, tier 4

  it('is standing on the weapons it says it is', () => {
    expect([LONGSWORD.slot, LONGSWORD.burden, LONGSWORD.tier]).toEqual(['primary', 2, 1]);
    expect([BROADSWORD.slot, BROADSWORD.burden, BROADSWORD.tier]).toEqual(['primary', 1, 1]);
    expect([HATCHET.slot, HATCHET.burden, HATCHET.tier]).toEqual(['secondary', 1, 1]);
    expect(LEGENDARY_HATCHET.tier).toBe(4);
    expect(MAX_BURDEN).toBe(2);
    // The measurement the header is built on, re-taken every run.
    expect(weapons.filter((w) => w.slot === 'secondary' && w.burden === 2)).toEqual([]);
    expect(weapons.filter((w) => w.slot === 'primary' && w.burden === 2)).toHaveLength(152);
  });

  it('says nothing about an empty slot', () => {
    const empty = { weapon: undefined, primary: LONGSWORD, level: 1, ignoresBurden: false };
    expect(weaponNote({ slot: 'secondary', ...empty })).toBeNull();
    expect(weaponNote({ slot: 'primary', ...empty, primary: undefined })).toBeNull();
  });

  it('counts the hands rather than asking whether the primary is two-handed', () => {
    const at = { slot: 'secondary', weapon: HATCHET, level: 1, ignoresBurden: false } as const;
    expect(weaponNote({ ...at, primary: LONGSWORD })).toBe(
      'Longsword and Hatchet are 3 hands — your maximum burden is 2',
    );
    // Exactly two hands is exactly the limit, and the limit is not exceeded.
    expect(weaponNote({ ...at, primary: BROADSWORD })).toBeNull();
    expect(weaponNote({ ...at, primary: undefined })).toBeNull();
  });

  it('reaches four hands the only way this printing can', () => {
    // A primary-slot two-hander in the off-hand: no filter refuses it, and the
    // old `primary.burden === 2` test could never have printed the real number.
    expect(
      weaponNote({
        slot: 'secondary',
        weapon: LONGSWORD,
        primary: LONGSWORD,
        level: 1,
        ignoresBurden: false,
      }),
    ).toBe('Longsword and Longsword are 4 hands — your maximum burden is 2');
  });

  it('says nothing to a character who ignores burden', () => {
    expect(
      weaponNote({
        slot: 'secondary',
        weapon: HATCHET,
        primary: LONGSWORD,
        level: 1,
        ignoresBurden: true,
      }),
    ).toBeNull();
  });

  it('leaves the burden sentence off the main hand, where it would be said twice', () => {
    expect(
      weaponNote({
        slot: 'primary',
        weapon: LONGSWORD,
        primary: LONGSWORD,
        level: 1,
        ignoresBurden: false,
      }),
    ).toBeNull();
  });

  it('prints both true things instead of choosing one', () => {
    /*
     * The ternary both screens used dropped the tier line whenever the burden
     * line fired. A level 1 character holding a tier 4 off-hand beside a
     * two-handed primary was told about the hands and never about the tier.
     */
    expect(
      weaponNote({
        slot: 'secondary',
        weapon: LEGENDARY_HATCHET,
        primary: LONGSWORD,
        level: 1,
        ignoresBurden: false,
      }),
    ).toBe(
      'Longsword and Legendary Hatchet are 3 hands — your maximum burden is 2 · ' +
        `Tier 4 — usable from level ${tierLevel(4)}`,
    );
    // And at a level that reaches tier 4, only the hands are left to say.
    expect(
      weaponNote({
        slot: 'secondary',
        weapon: LEGENDARY_HATCHET,
        primary: LONGSWORD,
        level: 10,
        ignoresBurden: false,
      }),
    ).toBe('Longsword and Legendary Hatchet are 3 hands — your maximum burden is 2');
  });

  it('fires on exactly the pairs that are over the limit, across the whole armoury', () => {
    /*
     * 391 x 391 is 152,881 pairs, walked rather than sampled, against plain
     * arithmetic written here - so the assertion cannot pass by re-running the
     * implementation's own test.
     */
    let over = 0;
    let said = 0;
    for (const p of weapons) {
      for (const w of weapons) {
        const shouldSay = p.burden + w.burden > 2;
        const note = weaponNote({
          slot: 'secondary',
          weapon: w,
          primary: p,
          level: 10,
          ignoresBurden: false,
        });
        const saysHands = note !== null && note.includes('hands');
        expect(saysHands, `${p.name} + ${w.name}`).toBe(shouldSay);
        if (shouldSay) over += 1;
        if (saysHands) said += 1;
      }
    }
    // Printed rather than only compared, so "we covered everything" is a number.
    expect(over).toBe(said);
    expect(over).toBe(
      weapons.filter((w) => w.burden === 2).length * weapons.length +
        weapons.filter((w) => w.burden === 1).length * weapons.filter((w) => w.burden === 2).length,
    );
    expect(over).toBe(152 * 391 + 239 * 152);
  });
});
