/**
 * The search a player uses to find their sword, proved against the whole
 * armoury instead of a handful of fixtures.
 *
 * Two things can go wrong here and neither of them looks wrong on screen. The
 * first is a filter that quietly drops a weapon: a picker showing 96 of 204 is
 * indistinguishable from a picker showing 95, and the one that fell out is
 * somebody's character concept. So every axis below is counted against the real
 * `data/srd-1.0.json` - 204 weapons, 34 armors, 60 loot, 60 consumables - and
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
import srd from '../../data/srd-1.0.json' with { type: 'json' };
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
      `${w.name} ${w.feature}`.toLowerCase().includes(needle),
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
    expect(weapons.length).toBe(204);
    expect(armors.length).toBe(34);
    expect(dataset.loot.length).toBe(60);
    expect(dataset.consumables.length).toBe(60);
    expect(items.length).toBe(120);
    // Names are what a player types, so two weapons sharing one would make the
    // search ambiguous in a way no filter could fix.
    expect(new Set(weapons.map((w) => w.name)).size).toBe(204);
    expect(new Set(weapons.map((w) => w.id)).size).toBe(204);
    expect(new Set(items.map((i) => i.id)).size).toBe(120);
  });

  it('spreads those weapons across every tier, slot, category, burden, trait and range', () => {
    expect(tally(weapons, (w) => w.tier)).toEqual({ '1': 35, '2': 56, '3': 57, '4': 56 });
    expect(tally(weapons, (w) => w.slot)).toEqual({ primary: 167, secondary: 37 });
    expect(tally(weapons, (w) => w.category)).toEqual({ Physical: 133, Magic: 71 });
    expect(tally(weapons, (w) => w.burden)).toEqual({ '1': 112, '2': 92 });
    expect(tally(weapons, (w) => w.trait)).toEqual({
      agility: 39,
      strength: 54,
      finesse: 44,
      instinct: 24,
      presence: 23,
      knowledge: 16,
      spellcast: 4,
    });
    expect(tally(weapons, (w) => w.range)).toEqual({
      Melee: 100,
      'Very Close': 27,
      Close: 19,
      Far: 43,
      'Very Far': 15,
    });
    expect(tally(armors, (a) => a.tier)).toEqual({ '1': 4, '2': 10, '3': 10, '4': 10 });
    expect(tally(items, (i) => i.kind)).toEqual({ loot: 60, consumable: 60 });
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
    expect(lower).toHaveLength(21);
    expect(names(filterWeapons(weapons, search('SWORD'), 1))).toEqual(lower);
    expect(names(filterWeapons(weapons, search('SwOrD'), 1))).toEqual(lower);
    expect(names(filterWeapons(weapons, search('  sword  '), 1))).toEqual(lower);
  });

  it('matches a substring of the printed name, and is not a thesaurus', () => {
    const swords = names(filterWeapons(weapons, search('sword'), 1));
    expect(swords).toHaveLength(21);
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
    expect(rows).toHaveLength(13);
    expect(rows.filter((r) => r.item.name.toLowerCase().includes('reliable'))).toEqual([]);
    for (const r of rows) expect(r.item.feature).toBe('Reliable: +1 to attack rolls');
    expect(names(rows)).toContain('Aantari Bow');
    expect(names(rows)).toContain('Broadsword');
  });

  it('reads armor features as well as armor names', () => {
    expect(names(filterArmors(armors, { ...armorQuery(), search: 'leather' }, 1))).toEqual([
      'Leather Armor',
      'Improved Leather Armor',
      'Advanced Leather Armor',
      'Legendary Leather Armor',
    ]);
    const flexible = filterArmors(armors, { ...armorQuery(), search: 'flexible' }, 1);
    expect(names(flexible)).toEqual([
      'Gambeson Armor',
      'Improved Gambeson Armor',
      'Advanced Gambeson Armor',
      'Legendary Gambeson Armor',
    ]);
    for (const r of flexible) expect(r.item.feature).toBe('Flexible: +1 to Evasion');
  });

  it('reads item text, so "stress" finds the thirteen things that clear it', () => {
    const found = filterItems(items, { ...itemQuery(), search: 'stress' });
    expect(found).toHaveLength(13);
    expect(found.filter((i) => i.name.toLowerCase().includes('stress'))).toEqual([]);
    expect(tally(found, (i) => i.kind)).toEqual({ consumable: 9, loot: 4 });
    expect(found.map((i) => i.name)).toContain('Stamina Potion');
    expect(found.map((i) => i.name)).toContain('Premium Bedroll');
  });
});

describe('what the search box deliberately does not read', () => {
  it('ignores the range, so "melee" finds 26 features and not the 100 melee weapons', () => {
    const melee = filterWeapons(weapons, search('melee'), 1);
    expect(weapons.filter((w) => w.range === 'Melee')).toHaveLength(100);
    expect(melee).toHaveLength(26);
    expect(melee.filter((r) => r.item.name.toLowerCase().includes('melee'))).toEqual([]);
    for (const r of melee) expect(r.item.feature.toLowerCase()).toContain('melee');
    // 43 weapons have range Far; two of them say so in their printed text.
    expect(weapons.filter((w) => w.range === 'Far')).toHaveLength(43);
    expect(filterWeapons(weapons, search('far'), 1)).toHaveLength(2);
  });

  it('ignores the trait, the category, the damage and the id', () => {
    expect(weapons.filter((w) => w.trait === 'instinct')).toHaveLength(24);
    expect(filterWeapons(weapons, search('instinct'), 1)).toHaveLength(0);

    expect(weapons.filter((w) => w.category === 'Magic')).toHaveLength(71);
    expect(filterWeapons(weapons, search('magic'), 1)).toHaveLength(1);

    expect(weapons.filter((w) => w.damage.includes('d8'))).toHaveLength(66);
    expect(filterWeapons(weapons, search('d8'), 1)).toHaveLength(5);

    // The id is a slug the player never sees; the name it belongs to is found.
    expect(weapons.some((w) => w.id === 'aantari-bow')).toBe(true);
    expect(filterWeapons(weapons, search('aantari-bow'), 1)).toHaveLength(0);
    expect(names(filterWeapons(weapons, search('aantari bow'), 1))).toEqual(['Aantari Bow']);
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
    expect(counted).toEqual([35, 56, 57, 56]);
    expect(counted.reduce((a, b) => a + b, 0)).toBe(204);
  });

  it('counts primary and secondary weapons, and they add up to the armoury', () => {
    const primary = filterWeapons(weapons, weaponQuery('primary'), 1);
    const secondary = filterWeapons(weapons, weaponQuery('secondary'), 1);
    expect(primary).toHaveLength(167);
    expect(secondary).toHaveLength(37);
    expect(primary.length + secondary.length).toBe(204);
    for (const r of primary) expect(r.item.slot).toBe('primary');
    for (const r of secondary) expect(r.item.slot).toBe('secondary');
  });

  it('separates Physical from Magic', () => {
    const physical = filterWeapons(weapons, { ...weaponQuery(), category: 'Physical' }, 1);
    const magic = filterWeapons(weapons, { ...weaponQuery(), category: 'Magic' }, 1);
    expect(physical).toHaveLength(133);
    expect(magic).toHaveLength(71);
    expect(physical.length + magic.length).toBe(204);
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
      agility: 39,
      strength: 54,
      finesse: 44,
      instinct: 24,
      presence: 23,
      knowledge: 16,
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
    expect(counts).toEqual({ Melee: 100, 'Very Close': 27, Close: 19, Far: 43, 'Very Far': 15 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(204);
  });

  it('separates one-handed from two-handed', () => {
    const one = filterWeapons(weapons, { ...weaponQuery(), burdens: new Set<1 | 2>([1]) }, 1);
    const two = filterWeapons(weapons, { ...weaponQuery(), burdens: new Set<1 | 2>([2]) }, 1);
    expect(one).toHaveLength(112);
    expect(two).toHaveLength(92);
    expect(one.length + two.length).toBe(204);
    for (const r of two) expect(r.item.burden).toBe(2);
  });

  it('filters armor by tier, four at tier one and ten at each tier above', () => {
    const counted = TIERS.map(
      (t) => filterArmors(armors, { ...armorQuery(), tiers: new Set<Tier>([t]) }, 1).length,
    );
    expect(counted).toEqual([4, 10, 10, 10]);
    expect(counted.reduce((a, b) => a + b, 0)).toBe(34);
    expect(
      names(filterArmors(armors, { ...armorQuery(), tiers: new Set<Tier>([1]) }, 1)),
    ).toEqual(['Chainmail Armor', 'Full Plate Armor', 'Gambeson Armor', 'Leather Armor']);
  });

  it('splits loot from consumables, and keeps both when neither chip is chosen', () => {
    const loot = filterItems(items, { ...itemQuery(), kind: 'loot' });
    const consumable = filterItems(items, { ...itemQuery(), kind: 'consumable' });
    expect(loot).toHaveLength(60);
    expect(consumable).toHaveLength(60);
    for (const i of loot) expect(i.kind).toBe('loot');
    for (const i of consumable) expect(i.kind).toBe('consumable');

    const all = filterItems(items, itemQuery());
    expect(all).toHaveLength(120);
    // Consumables sort ahead of loot, then alphabetically inside each kind.
    expect([all[0]!.name, all[0]!.kind]).toEqual(['Acidpaste', 'consumable']);
    expect([all[59]!.name, all[59]!.kind]).toEqual(['Wingsprout', 'consumable']);
    expect([all[60]!.name, all[60]!.kind]).toEqual(['Airblade Charm', 'loot']);
    expect([all[119]!.name, all[119]!.kind]).toEqual(['Woven Net', 'loot']);
  });
});

describe('filters crossing each other', () => {
  it('ANDs across axes: the off-hand tier-one rack holds exactly seven things', () => {
    const q: WeaponQuery = { ...weaponQuery('secondary'), tiers: new Set<Tier>([1]) };
    const rows = filterWeapons(weapons, q, 1);
    expect(names(rows)).toEqual([
      'Grappler',
      'Hand Crossbow',
      'Round Shield',
      'Shortsword',
      'Small Dagger',
      'Tower Shield',
      'Whip',
    ]);
    // Counted again here, without the module under test.
    expect(sortedNames(rows.map((r) => r.item))).toEqual(
      sortedNames(weapons.filter((w) => w.slot === 'secondary' && w.tier === 1)),
    );
  });

  it('ORs inside an axis, and an untouched chip row narrows nothing at all', () => {
    const tiers: WeaponQuery = { ...weaponQuery(), tiers: new Set<Tier>([2, 4]) };
    expect(filterWeapons(weapons, tiers, 1)).toHaveLength(112);
    expect(112).toBe(
      weapons.filter((w) => w.tier === 2).length + weapons.filter((w) => w.tier === 4).length,
    );

    const traits: WeaponQuery = {
      ...weaponQuery(),
      traits: new Set<WeaponTrait>(['finesse', 'knowledge']),
    };
    expect(filterWeapons(weapons, traits, 1)).toHaveLength(60);
    expect(60).toBe(weapons.filter((w) => w.trait === 'finesse' || w.trait === 'knowledge').length);

    const ranges: WeaponQuery = {
      ...weaponQuery(),
      ranges: new Set<Range>(['Far', 'Very Far']),
    };
    expect(filterWeapons(weapons, ranges, 1)).toHaveLength(58);

    // Every set empty is the opening state, and it hides nothing.
    expect(filterWeapons(weapons, weaponQuery(), 1)).toHaveLength(204);
    expect(filterArmors(armors, armorQuery(), 1)).toHaveLength(34);
  });

  it('crosses text, tier and range at once, down to fourteen bows', () => {
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
      'Yutari Bloodbow',
      'Improved Hand Crossbow',
      'Advanced Crossbow',
      'Advanced Longbow',
      'Advanced Shortbow',
      'Gilded Bow',
      'Spiked Bow',
      'Advanced Hand Crossbow',
    ]);
    // Cross-checked without the filter: same fourteen, however they are ordered.
    expect(sortedNames(rows.map((r) => r.item))).toEqual(
      sortedNames(
        weapons.filter(
          (w) =>
            `${w.name} ${w.feature}`.toLowerCase().includes('bow') &&
            (w.tier === 2 || w.tier === 3) &&
            (w.range === 'Far' || w.range === 'Very Far'),
        ),
      ),
    );
    // Primaries come before secondaries inside a tier, which is why the two
    // Hand Crossbows sit at the end of their tier rather than under "H".
    expect(rows[6]!.item.slot).toBe('primary');
    expect(rows[7]!.item.name).toBe('Improved Hand Crossbow');
    expect(rows[7]!.item.slot).toBe('secondary');
  });

  it('crosses a search with the loot/consumable chip', () => {
    const potions = filterItems(items, { ...itemQuery(), search: 'potion' });
    expect(potions).toHaveLength(25);
    expect(filterItems(items, { ...itemQuery(), search: 'potion', kind: 'consumable' })).toHaveLength(
      23,
    );
    // The two that are loot are recipes, not potions - the crossing is what
    // tells them apart.
    expect(
      filterItems(items, { ...itemQuery(), search: 'potion', kind: 'loot' }).map((i) => i.name),
    ).toEqual(['Minor Health Potion Recipe', 'Minor Stamina Potion Recipe']);
    expect(filterItems(items, { ...itemQuery(), search: 'gem', kind: 'consumable' })).toHaveLength(0);
    expect(filterItems(items, { ...itemQuery(), search: 'gem', kind: 'loot' })).toHaveLength(6);
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
    expect(rowsReturned).toBe(5156);
    // A sweep of 314 empty results would agree with anything. 233 of these
    // combinations return weapons; the other 81 are intersections the armoury
    // genuinely has nothing in, such as a secondary Magic weapon.
    expect(nonEmpty).toBe(233);

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
    expect(checked).toBe((204 + 34) * 10);
    // 169 weapons + 30 armors out of reach at level 1, 113 + 20 through levels
    // 2-4, 56 + 10 through 5-7, and nothing at all from level 8.
    expect(outOfReach).toBe(169 + 30 + (113 + 20) * 3 + (56 + 10) * 3);
    expect(outOfReach).toBe(796);
  });

  it('never hides a weapon while reach is "all", however low the level', () => {
    for (const level of LEVELS) {
      expect(filterWeapons(weapons, weaponQuery(), level)).toHaveLength(204);
      expect(filterArmors(armors, armorQuery(), level)).toHaveLength(34);
    }
    // A level 1 party handed a tier 4 sword can still find it and equip it.
    const legendary = filterWeapons(weapons, weaponQuery(), 1).filter((r) => r.item.tier === 4);
    expect(legendary).toHaveLength(56);
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
      1: 35,
      2: 91,
      3: 91,
      4: 91,
      5: 148,
      6: 148,
      7: 148,
      8: 204,
      9: 204,
      10: 204,
    });
    expect(usableArmors).toEqual({
      1: 4,
      2: 14,
      3: 14,
      4: 14,
      5: 24,
      6: 24,
      7: 24,
      8: 34,
      9: 34,
      10: 34,
    });
    console.log(
      `[gear] weapons within reach by level: ${LEVELS.map((l) => `${l}:${usableWeapons[l]}`).join(' ')} (of 204)`,
    );
  });

  it('treats a level below one or far above ten as the tier it behaves like', () => {
    // Nothing validates the level, so the picker must not invent a fifth tier.
    expect(tierNote(2, 0)).toBe('Tier 2 — usable from level 2');
    expect(tierNote(4, -3)).toBe('Tier 4 — usable from level 8');
    expect(tierNote(4, 99)).toBeNull();
    expect(filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 0)).toHaveLength(35);
    expect(filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 99)).toHaveLength(204);
  });
});

describe('the count on screen and the CLEAR FILTERS chip', () => {
  it('counts what is shown, which is not what exists', () => {
    const shown = filterWeapons(weapons, { ...weaponQuery(), reach: 'usable' }, 1);
    // The picker prints "<shown> OF <total>", and the total is the armoury.
    expect(shown).toHaveLength(35);
    expect(weapons.length).toBe(204);
    // Eleven weapons say "dagger"; five of them can go in the off hand.
    expect(filterWeapons(weapons, search('dagger'), 1)).toHaveLength(11);
    expect(filterWeapons(weapons, { ...weaponQuery('secondary'), search: 'dagger' }, 1)).toHaveLength(
      5,
    );
    expect(filterArmors(armors, { ...armorQuery(), reach: 'usable' }, 1)).toHaveLength(4);
    expect(filterItems(items, { ...itemQuery(), kind: 'loot' })).toHaveLength(60);
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
    expect(filterWeapons(weapons, tierTwo, 8)).toHaveLength(56);
    expect(filterWeapons(weapons, tierThree, 8)).toHaveLength(57);

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
    expect(filterArmors(armors, armorLow, 8)).toHaveLength(14);
    expect(filterArmors(armors, armorHigh, 8)).toHaveLength(20);
  });

  it('does not count a stray space as a filter, and still shows everything', () => {
    const base = weaponQuery();
    expect(weaponQueryChanged({ ...base, search: '   ' }, base)).toBe(false);
    expect(filterWeapons(weapons, { ...base, search: '   ' }, 1)).toHaveLength(204);
    // A word with spaces around it is a real filter, trimmed before it matches.
    expect(weaponQueryChanged({ ...base, search: '  sword  ' }, base)).toBe(true);
    expect(filterWeapons(weapons, { ...base, search: '  sword  ' }, 1)).toHaveLength(21);

    const armorBase = armorQuery();
    expect(armorQueryChanged({ ...armorBase, search: ' ' }, armorBase)).toBe(false);
    const itemBase = itemQuery();
    expect(itemQueryChanged({ ...itemBase, search: '\t ' }, itemBase)).toBe(false);
    expect(filterItems(items, { ...itemBase, search: '\t ' })).toHaveLength(120);
  });

  it('remembers that the off-hand picker opens already narrowed', () => {
    const base = weaponQuery('secondary');
    expect(base.slot).toBe('secondary');
    expect(weaponQueryChanged(base, base)).toBe(false);
    expect(filterWeapons(weapons, base, 1)).toHaveLength(37);
    // Widening to "Any" is a change, and clearing puts the slot back rather
    // than opening the whole 204 onto an off-hand picker.
    const widened: WeaponQuery = { ...base, slot: 'all' };
    expect(weaponQueryChanged(widened, base)).toBe(true);
    expect(filterWeapons(weapons, widened, 1)).toHaveLength(204);
    expect(filterWeapons(weapons, weaponQuery('secondary'), 1)).toHaveLength(37);
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
    expect(filterWeapons(weapons, weaponQuery(), 1)).toHaveLength(204);
    expect(filterWeapons(weapons, weaponQuery(), 10)).toHaveLength(204);
    expect(filterArmors(armors, armorQuery(), 1)).toHaveLength(34);
    expect(filterItems(items, itemQuery())).toHaveLength(120);
  });

  it('returns exactly nothing for a search nothing matches, and does not throw', () => {
    for (const term of ['zzzz', 'excalibur', '🐉', 'sword sword']) {
      expect(filterWeapons(weapons, search(term), 1)).toEqual([]);
      expect(filterArmors(armors, { ...armorQuery(), search: term }, 1)).toEqual([]);
      expect(filterItems(items, { ...itemQuery(), search: term })).toEqual([]);
    }
    // Empty because the axes disagree, not because the text failed: there are
    // 71 Magic weapons and 37 secondary ones, and no weapon is both.
    expect(weapons.filter((w) => w.category === 'Magic')).toHaveLength(71);
    expect(
      filterWeapons(weapons, { ...weaponQuery('secondary'), category: 'Magic' }, 10),
    ).toEqual([]);
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
