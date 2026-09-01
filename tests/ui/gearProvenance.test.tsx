// @vitest-environment jsdom
/**
 * Where a piece of gear came from: on the row, in the search box, and on one
 * control.
 *
 * SRD 2.0 fences its content two ways at once and `data/srd-1.0.json` fences it
 * not at all, which is why almost every test here builds its own book. Measured
 * with the real parsers over `Manuali/DH_SRD_2_2026_08_25.pdf`:
 *
 *   weapons      391    module 76 (Everyday Hero 32, Western 20, Monster 24)   set   0
 *   armors        85    module 16 (Everyday Hero  4,             Monster 12)   set   0
 *   loot         120    module  0                                              set 120 (60/60)
 *   consumables  120    module  0                                              set 120 (60/60)
 *
 * Those numbers are the reason this lane exists and they are NOT what this file
 * asserts. The pipeline needs the owner's PDF, which is not in the repository,
 * so a test that reached for it would be one of the 68 that skip in CI. What is
 * asserted here is the behaviour those numbers argued for, against books this
 * file writes, plus the one thing only the shipped dataset can prove: that on
 * `data/srd-1.0.json` none of this draws anything at all.
 *
 * ## What jsdom can and cannot say here
 *
 * It computes no layout, so not one pixel below is measured here. The geometry
 * that chose this control over the chip row - the filter column at seven
 * viewports, and the whole rows of gear the two cost - was measured in Chrome
 * against the SRD 2.0 dataset and the tables live in `GearPicker.tsx`'s own
 * docblocks beside the code. What is left for jsdom is the half that a later
 * edit would quietly break and that a Chrome sweep would not notice: which
 * element the control is a child of (its zero cost is a fact about it sharing
 * the `Seg` row's wrapped line - move it into a row of its own and the measured
 * table becomes fiction), that the stamp is a separate `.t-meta` node rather
 * than text spliced into the stat line, and that every filter actually filters.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Armor, Character, Dataset, Item, Weapon } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import type { Rng } from '../../src/engine/dice.ts';
import { useApp } from '../../src/store/state.ts';
import { ArmorPicker, ItemPicker, WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import {
  armorQuery,
  armorQueryChanged,
  filterArmors,
  filterItems,
  filterWeapons,
  itemQuery,
  moduleSplit,
  originStamp,
  weaponQuery,
  weaponQueryChanged,
} from '../../src/ui/build/gear.ts';
import { dataset as shipped, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** Nothing in this file rolls; a picker that starts to should say so by name. */
const neverRolls: Rng = () => {
  throw new Error('nothing in this file may roll for gear');
};

const WESTERN = 'Western Campaigns';
const HERO = 'Everyday Hero Starting Equipment';

const weapon = (name: string, extra: Partial<Weapon> = {}): Weapon => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  tier: 1,
  slot: 'primary',
  category: 'Physical',
  trait: 'agility',
  range: 'Melee',
  damage: 'd8+1',
  damageType: 'phy',
  burden: 1,
  feature: '',
  ...extra,
});

const armor = (name: string, extra: Partial<Armor> = {}): Armor => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  tier: 1,
  baseThresholds: [6, 13],
  baseScore: 3,
  feature: '',
  ...extra,
});

const item = (name: string, extra: Partial<Item> = {}): Item => ({
  id: name.toLowerCase().replace(/[^a-z]+/g, '-'),
  name,
  kind: 'loot',
  text: '',
  ...extra,
});

// ---------------------------------------------------------------------------
// The two axes, read off a record
// ---------------------------------------------------------------------------

describe('originStamp says both axes in the book’s words', () => {
  it('is empty when the book fenced nothing', () => {
    expect(originStamp(weapon('Broadsword'))).toBe('');
  });

  it('names the product', () => {
    expect(originStamp(item('Premium Bedroll', { set: 'core' }))).toBe('Core Set');
    expect(originStamp(item('Caltrops', { set: 'expansion' }))).toBe('Hope & Fear Expansion');
  });

  it('names the module with the contents page’s own title, untrimmed', () => {
    // The tidy short names - "Everyday Hero", "Western" - are what every
    // document in this repository writes and what the book does not print.
    // `shared/types.ts` refuses to store them; a screen that shortened them
    // would be that same rename one layer later.
    expect(originStamp(weapon('Revolver', { module: WESTERN }))).toBe('Western Campaigns');
    expect(originStamp(weapon('Cleaver', { module: HERO }))).toBe(
      'Everyday Hero Starting Equipment',
    );
  });

  it('says both, product first, when a record carries both', () => {
    // No record in SRD 2.0 does. The axes cross rather than nest, so a later
    // printing that fences the Western revolvers by product needs no change.
    expect(originStamp(weapon('Revolver', { set: 'core', module: WESTERN }))).toBe(
      'Core Set · Western Campaigns',
    );
  });
});

// ---------------------------------------------------------------------------
// Whether the control exists at all
// ---------------------------------------------------------------------------

describe('moduleSplit asks the pool, not the revision', () => {
  it('is false when every record is base content', () => {
    expect(moduleSplit([weapon('Broadsword'), weapon('Dagger')])).toBe(false);
  });

  it('is false when EVERY record is module content', () => {
    // A control whose second position empties the list is worse than no
    // control, so "has a module" is not enough on its own.
    expect(moduleSplit([weapon('Revolver', { module: WESTERN })])).toBe(false);
  });

  it('is true only when the pool holds both', () => {
    expect(moduleSplit([weapon('Broadsword'), weapon('Revolver', { module: WESTERN })])).toBe(true);
  });

  it('is true for the two gear collections of the book this app ships, and false for the two item ones', () => {
    /*
     * THE SWITCH ARRIVED. Every one of these read `false` while the app
     * shipped SRD 1.0, which fences nothing, and the lane's whole geometric
     * argument was "this costs nothing today". It costs something now, and
     * the numbers are the ones that lane measured: 76 module weapons and 16
     * module armors sit beside base content, so the control is drawn on both
     * gear pickers; loot and consumables carry a `set` and no `module`, so it
     * is drawn on neither of them.
     */
    expect(moduleSplit(shipped.weapons)).toBe(true);
    expect(moduleSplit(shipped.armors)).toBe(true);
    expect(moduleSplit(shipped.loot)).toBe(false);
    expect(moduleSplit(shipped.consumables)).toBe(false);
    // The counts the control exists for, asked of the shipped file.
    expect(shipped.weapons.filter((w) => w.module !== undefined)).toHaveLength(76);
    expect(shipped.armors.filter((a) => a.module !== undefined)).toHaveLength(16);
    expect(shipped.loot.filter((i) => i.module !== undefined)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The filter itself
// ---------------------------------------------------------------------------

const WEAPONS = [
  weapon('Broadsword'),
  weapon('Dagger', { slot: 'secondary' }),
  weapon('Revolver', { module: WESTERN }),
  weapon('Cleaver', { module: HERO }),
];

const ARMORS = [armor('Gambeson'), armor('Leather Apron', { module: HERO })];

describe('the module axis narrows, and “all” narrows nothing', () => {
  it('opens on the whole book', () => {
    // 76 of SRD 2.0's 391 weapons belong to subsystems most tables are not
    // running, so opening on the base rules would be the friendlier list. A
    // filter that is on before anyone touched it hides content while every
    // control on the screen says nothing is narrowed.
    expect(weaponQuery().modules).toBe('all');
    expect(armorQuery().modules).toBe('all');
    expect(filterWeapons(WEAPONS, weaponQuery(), 10)).toHaveLength(4);
  });

  it('drops exactly the module records when set to base', () => {
    const rows = filterWeapons(WEAPONS, { ...weaponQuery(), modules: 'base' }, 10);
    expect(rows.map((r) => r.item.name).sort()).toEqual(['Broadsword', 'Dagger']);
  });

  it('drops module armor too', () => {
    expect(filterArmors(ARMORS, armorQuery(), 10)).toHaveLength(2);
    const rows = filterArmors(ARMORS, { ...armorQuery(), modules: 'base' }, 10);
    expect(rows.map((r) => r.item.name)).toEqual(['Gambeson']);
  });

  it('crosses the other filters rather than replacing them', () => {
    const q = { ...weaponQuery('secondary'), modules: 'base' as const };
    expect(filterWeapons(WEAPONS, q, 10).map((r) => r.item.name)).toEqual(['Dagger']);
  });

  it('is a filter CLEAR FILTERS can see', () => {
    // The row that offers the way out only exists once something is filtered.
    const base = weaponQuery();
    expect(weaponQueryChanged({ ...base, modules: 'base' }, base)).toBe(true);
    expect(weaponQueryChanged({ ...base }, base)).toBe(false);
    const ab = armorQuery();
    expect(armorQueryChanged({ ...ab, modules: 'base' }, ab)).toBe(true);
    expect(armorQueryChanged({ ...ab }, ab)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The search box, which is the other half of the control
// ---------------------------------------------------------------------------

describe('the box reads what the row prints', () => {
  const find = (search: string): string[] =>
    filterWeapons(WEAPONS, { ...weaponQuery(), search }, 10).map((r) => r.item.name);

  it('finds a module by its own name - the narrowing the two-state control cannot say', () => {
    expect(find('western')).toEqual(['Revolver']);
    expect(find('everyday hero')).toEqual(['Cleaver']);
  });

  it('matches from a word start, so “campaigns” finds the chapter that ends in it', () => {
    expect(find('campaigns')).toEqual(['Revolver']);
  });

  it('does not invent a word for base content', () => {
    // "base" is a label this UI made up for a control. Answering with the 315
    // base weapons would be the box asserting a category the book never
    // printed on any of those rows.
    expect(find('base')).toEqual([]);
  });

  it('reads armor’s module, which had no searchable axis at all before', () => {
    const rows = filterArmors(ARMORS, { ...armorQuery(), search: 'everyday' }, 10);
    expect(rows.map((r) => r.item.name)).toEqual(['Leather Apron']);
  });

  it('reads the product axis on items, which gets no control of its own', () => {
    // `DECISIONI-SRD-2` §4 gives ownership to Settings. The search box is what
    // this screen can offer that axis for nothing.
    const items = [
      item('Premium Bedroll', { set: 'core', roll: 1 }),
      item('Caltrops', { set: 'expansion', roll: 1 }),
    ];
    expect(
      filterItems(items, { ...itemQuery(), search: 'hope & fear' }).map((i) => i.name),
    ).toEqual(['Caltrops']);
    expect(filterItems(items, { ...itemQuery(), search: 'core' }).map((i) => i.name)).toEqual([
      'Premium Bedroll',
    ]);
  });
});

// ---------------------------------------------------------------------------
// On the screen
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // A phone: nothing here depends on the desktop-only `autoFocus`.
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The shipped book with provenance written onto a handful of records.
 *
 * A book rather than a stub, because these are screens: they draw class names,
 * domain marks and weapon features that only the real dataset has, and a
 * synthetic dataset lets a render path that crashes on real content pass.
 */
function fenced(): Dataset {
  const [w0, w1, ...restW] = shipped.weapons;
  const [a0, ...restA] = shipped.armors;
  return {
    ...shipped,
    weapons: [{ ...w0!, module: WESTERN }, { ...w1!, module: HERO }, ...restW],
    armors: [{ ...a0!, module: HERO }, ...restA],
    loot: shipped.loot.map((l, i) => ({ ...l, set: i % 2 === 0 ? 'core' : 'expansion' }) as Item),
    consumables: shipped.consumables,
  };
}

function draw(ds: Dataset, element: ReactElement): void {
  const character: Character = playedCharacter();
  act(() => {
    useApp.setState({
      ready: true,
      storageError: null,
      dataset: ds,
      index: indexDataset(ds),
      characters: [character],
      activeId: character.id,
      log: [],
      openCard: null,
    });
    root.render(element);
  });
}

const groups = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('[role="group"]')];
const groupNamed = (name: string): HTMLElement | undefined =>
  groups().find((g) => g.getAttribute('aria-label') === name);

const weaponsPicker = (): ReactElement => {
  const c = playedCharacter();
  return createElement(WeaponPicker, {
    rng: neverRolls,
    slot: 'primary',
    value: c.activePrimaryWeapon,
    sheet: c,
    stats: playedStats(c),
    onPick: () => {},
    onClose: () => {},
  });
};

const armorPicker = (): ReactElement => {
  const c = playedCharacter();
  return createElement(ArmorPicker, {
    rng: neverRolls,
    value: c.activeArmor,
    sheet: c,
    onPick: () => {},
    onClose: () => {},
  });
};

describe('the control is drawn only where it can do something', () => {
  it('is drawn on the weapons picker of the book this app ships', () => {
    // It was absent while the app shipped SRD 1.0 and this asserted so; the
    // shipped book now fences its weapons, so the control has work to do.
    draw(shipped, weaponsPicker());
    expect(groupNamed('Rules')).toBeDefined();
    expect(groups().map((g) => g.getAttribute('aria-label'))).toEqual([
      'Reach',
      'Slot',
      'Category',
      'Rules',
    ]);
  });

  it('is drawn on the armor picker of that book too', () => {
    draw(shipped, armorPicker());
    expect(groupNamed('Rules')).toBeDefined();
  });

  it('is still absent from a book that fences nothing', () => {
    /*
     * The half the switch took away, kept: SRD 1.0 is still committed and
     * still parses, so "a book with no module content draws no control" is
     * still assertable against a real book rather than only against a fixture.
     */
    const one = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as Dataset;
    expect(moduleSplit(one.weapons)).toBe(false);
    draw(one, weaponsPicker());
    expect(groupNamed('Rules')).toBeUndefined();
  });

  it('appears on a book that has both kinds of content', () => {
    draw(fenced(), weaponsPicker());
    const rules = groupNamed('Rules');
    expect(rules).toBeDefined();
    expect([...rules!.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'All',
      'Base',
    ]);
  });

  it('shares the Category group’s row rather than opening one of its own', () => {
    // This is the whole of its measured cost. At 320x568, 360x800, 375x667,
    // 393x852, 744x1133, 852x393 and 667x375 the 94.00px group lands on the
    // same wrapped flex line as Category and the filter column does not move -
    // 364/310/310/310/256/256/256 with it and without it, measured in Chrome.
    // A row of its own would be +52px there and the table in `ModuleFilter`
    // would be fiction, which jsdom cannot see and this can.
    draw(fenced(), weaponsPicker());
    expect(groupNamed('Rules')!.parentElement).toBe(groupNamed('Category')!.parentElement);
  });

  it('states the 44px floor on both axes, like every other control in the dialog', () => {
    draw(fenced(), weaponsPicker());
    for (const b of groupNamed('Rules')!.querySelectorAll('button')) {
      expect(b.style.minHeight).toBe('var(--control)');
      expect(b.style.minWidth).toBe('var(--control)');
    }
  });

  it('narrows the list, and the count says so', () => {
    draw(fenced(), weaponsPicker());
    // The count line, found by what it says rather than by position: the ✕ in
    // band 1 is `.t-meta` too.
    const countOf = (): string =>
      [...container.querySelectorAll('.t-meta')]
        .map((n) => n.textContent ?? '')
        .find((t) => /^\d+ OF \d+/.test(t)) ?? '';
    const shown = (t: string): number => Number(/^(\d+) OF (\d+)/.exec(t)![1]);
    const before = countOf();
    expect(before).toMatch(/^\d+ OF \d+/);
    act(() => {
      [...groupNamed('Rules')!.querySelectorAll('button')][1]!.click();
    });
    // Exactly the module weapons of this slot leave, and no others: the picker
    // opened with `slot: 'primary'` pre-applied, so the drop is that count and
    // not the number of fenced records.
    const gone = fenced().weapons.filter(
      (w) => w.module !== undefined && w.slot === 'primary',
    ).length;
    expect(gone).toBeGreaterThan(0);
    expect(shown(countOf())).toBe(shown(before) - gone);
    expect(container.textContent).not.toContain('WESTERN CAMPAIGNS');
  });
});

describe('the row says where it came from', () => {
  it('prints the chapter on the book this app ships, and nothing on the one it used to', () => {
    draw(shipped, weaponsPicker());
    expect(container.textContent).toContain('CAMPAIGNS');
    const one = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as Dataset;
    draw(one, weaponsPicker());
    expect(container.textContent).not.toContain('CAMPAIGNS');
    expect(container.textContent).not.toContain('CORE SET');
  });

  it('prints the module on a weapon row, in the book’s words', () => {
    draw(fenced(), weaponsPicker());
    expect(container.textContent).toContain('WESTERN CAMPAIGNS');
  });

  it('prints it as its own dim line and not inside the stat line', () => {
    // Measured and looked at: appended to `meta` it is `.t-num`'s 600 13px
    // mono, the same ink and separator as ONE-HANDED, which tells the player
    // the weapon has a fifth stat. It also makes the row's height a property
    // of the item's name - 0.0, 18.2 or 36.4 depending on where the stats
    // happened to wrap - where its own line is a flat +20.0 everywhere.
    draw(fenced(), weaponsPicker());
    const stamp = [...container.querySelectorAll('span')].find(
      (s) => s.textContent === 'WESTERN CAMPAIGNS',
    );
    expect(stamp).toBeDefined();
    expect(stamp!.className).toBe('t-meta');
    // Spelled out rather than `.not.toContain(expect.stringContaining(...))`,
    // which compares the matcher by identity against each string and passes
    // whatever the page says.
    const stats = [...container.querySelectorAll('.t-num')];
    expect(stats.length).toBeGreaterThan(0);
    for (const n of stats) expect(n.textContent ?? '').not.toContain('WESTERN CAMPAIGNS');
  });

  it('prints it on an armor row too', () => {
    draw(fenced(), armorPicker());
    expect(container.textContent).toContain('EVERYDAY HERO STARTING EQUIPMENT');
  });
});

describe('two items that the book numbers alike', () => {
  /**
   * SRD 2.0 prints two loot tables and two consumable tables, one per product,
   * each numbered 1..60, so `Item.roll` is no longer unique inside its
   * collection: all 120 loot rolls and all 120 consumable rolls collide. Drawn
   * at 393x852 on that dataset, the first two rows of this picker were
   * "Acidpaste, CONSUMABLE · ROLL 36" and "Arcticite Shard, CONSUMABLE · ROLL
   * 36" - adjacent, on one screen, identical.
   */
  const twins: Item[] = [
    item('Premium Bedroll', { set: 'core', roll: 1, text: 'A bedroll.' }),
    item('Caltrops', { set: 'expansion', roll: 1, text: 'Caltrops.' }),
  ];

  const twinBook = (): Dataset => ({ ...shipped, loot: twins, consumables: [] });

  it('drew the same line for both before the stamp existed', () => {
    // The defect, stated as a property of the data the screen was given.
    expect(twins.map((i) => `${i.kind} ROLL ${String(i.roll)}`)).toEqual([
      'loot ROLL 1',
      'loot ROLL 1',
    ]);
  });

  it('now differ by the product that numbered them', () => {
    draw(twinBook(), createElement(ItemPicker, { carried: new Map(), onAdd: () => {}, onClose: () => {} }));
    const rows = [...container.querySelectorAll('button')].filter((b) =>
      (b.textContent ?? '').includes('ROLL 1'),
    );
    expect(rows).toHaveLength(2);
    // Sorted by name, so Caltrops is first; what matters is that the two lines
    // are no longer the same line.
    const text = rows.map((b) => b.textContent ?? '');
    expect(text.find((t) => t.includes('Caltrops'))).toContain('HOPE & FEAR EXPANSION');
    expect(text.find((t) => t.includes('Premium Bedroll'))).toContain('CORE SET');
    expect(text[0]).not.toBe(text[1]);
  });
});
