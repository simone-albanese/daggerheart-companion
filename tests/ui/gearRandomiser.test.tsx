// @vitest-environment jsdom
/**
 * RANDOM, on the two pickers whose data can honour it.
 *
 * The feature is deliberately narrower than its name. `data/srd-1.0.json`
 * gives all 204 weapons and all 34 sets of armor a tier and gives none of the
 * 60 loot entries or 60 consumables one - counted in
 * `tests/engine/randomGear.test.ts`, which is where that premise is pinned -
 * so a "randomise by tier" control over loot would be offering a filter the
 * dataset cannot answer. This file holds the surface to that: the button is on
 * weapons and armor, it is not on loot, and what it returns obeys the same
 * chips the list obeys.
 *
 * WHAT IS ASKED HERE AND WHAT IS ASKED IN THE ENGINE. `randomGear` is pure and
 * is tested against 400 seeds and the whole armoury next door; nothing about
 * the distribution or the off-by-one is re-asked here. What only this file can
 * see is the wiring: that the dice arrive from the call site rather than from
 * module scope, that the pool handed to them is the rows the filters left, and
 * that the button exists on two screens and not on the third.
 *
 * jsdom computes no layout, so the floor is read as a *declaration*, resolved
 * through `tokens.ts` against a real device rather than compared to a
 * remembered 44.
 */
import 'fake-indexeddb/auto';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character, Ref, Tier } from '@shared/types.ts';
import { seededRng, type Rng } from '../../src/engine/dice.ts';
import { tiersIn } from '../../src/engine/randomGear.ts';
import { useApp } from '../../src/store/state.ts';
import { ArmorPicker, ItemPicker, WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';
import { NARROW, PHONE, px, tokens } from './tokens.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/** Whatever the last mounted picker equipped, in order. */
let picked: Array<Ref | null>;

beforeAll(() => {
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
  picked = [];
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function seed(character: Character): void {
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
}

/**
 * The three doors, each given dice it may not need.
 *
 * `ItemPicker` takes none, and that is not an omission in this harness - it is
 * the feature. There is no `rng` prop on it to pass, because there is no tier
 * on the 120 items behind it, so the absence is enforced by the type checker
 * before any assertion in this file runs.
 */
const PICKERS: Record<string, (rng: Rng) => ReactElement> = {
  weapons: (rng) => {
    const character = playedCharacter();
    seed(character);
    return (
      <WeaponPicker
        rng={rng}
        slot="primary"
        value={character.activePrimaryWeapon}
        sheet={character}
        stats={playedStats(character)}
        onPick={(ref) => picked.push(ref)}
        onClose={() => {}}
      />
    );
  },
  armor: (rng) => {
    const character = playedCharacter();
    seed(character);
    return (
      <ArmorPicker
        rng={rng}
        value={character.activeArmor}
        sheet={character}
        onPick={(ref) => picked.push(ref)}
        onClose={() => {}}
      />
    );
  },
  loot: () => {
    const character = playedCharacter();
    seed(character);
    return <ItemPicker carried={new Map()} onAdd={() => {}} onClose={() => {}} />;
  },
};

/**
 * A fresh picker every time, and the null render is why.
 *
 * Rendering the same component type into the same root reconciles rather than
 * remounts, so `useState`'s query survives - and a test that taps TIER 3 on
 * each of five "mounts" is toggling it on, off, on, off, on while reading like
 * five identical runs. Three of five results then land inside the filter by
 * accident, which is the most misleading possible amount. Unmounting first
 * makes each iteration the fresh dialog it claims to be.
 */
const mount = (name: string, rng: Rng = seededRng(1)): void => {
  act(() => root.render(null));
  const element = PICKERS[name]!(rng);
  act(() => root.render(element));
};

const panel = (): HTMLElement => {
  const overlay = container.querySelector<HTMLElement>('[role="dialog"]');
  if (overlay === null) throw new Error('nothing on screen carries role="dialog"');
  const box = overlay.firstElementChild;
  if (!(box instanceof HTMLElement)) throw new Error('the overlay has no panel inside it');
  return box;
};

const bands = (): HTMLElement[] =>
  [...panel().children].filter((el): el is HTMLElement => el instanceof HTMLElement);

/** Band 3, the pinned row that holds the count and the two verbs. */
const countBand = (): HTMLElement => bands()[2]!;

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** The RANDOM button, wherever it is, or null when the picker offers none. */
const randomButton = (): HTMLButtonElement | null => {
  const hit = [...panel().querySelectorAll('button')].filter(
    (b) => (b.textContent ?? '').trim() === 'RANDOM',
  );
  if (hit.length > 1) throw new Error('two RANDOM buttons on one picker');
  return hit[0] ?? null;
};

/** A filter chip, by the accessible name `Chips` gives it. */
const chip = (label: string): HTMLButtonElement => {
  const hit = panel().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (hit === null) throw new Error(`no chip labelled "${label}"`);
  return hit;
};

const weapons = dataset.weapons;
const armors = dataset.armors;
/**
 * The picker opens on a slot and pre-applies it - `weaponQuery('primary')` -
 * so 167 of the 204 weapons are on screen before anything is tapped. Every
 * count below is against that, because that is what the dialog is showing.
 */
const primaries = weapons.filter((w) => w.slot === 'primary');
/**
 * The tier the fixture has reached, and what the draw is now measured against.
 *
 * RANDOM draws from the rows on screen THAT THIS CHARACTER CAN EQUIP, which is
 * a narrower set than the rows on screen and used not to be. The old pool was
 * every row, under a comment saying that skipping out-of-reach gear would be
 * hiding it; that held while a tap could equip it and inverts now that a tap
 * cannot - the button's promise is that it will equip what it lands on, so its
 * pool has to be the pool a tap has. `src/ui/build/GearPicker.tsx` carries the
 * argument; `tests/ui/gear.test.ts` carries the sentence out of the book.
 *
 * Written as a number rather than imported so the counts below are not the
 * implementation agreeing with itself, and pinned to the fixture's level by
 * the first assertion in `what it draws`.
 */
const FIXTURE_TIER = 2;
const takeable = <T extends { tier: Tier }>(rows: readonly T[]): T[] =>
  rows.filter((r) => r.tier <= FIXTURE_TIER);
const tierOfWeapon = (ref: Ref | null): Tier | undefined =>
  weapons.find((w) => w.id === ref)?.tier;
const tierOfArmor = (ref: Ref | null): Tier | undefined => armors.find((a) => a.id === ref)?.tier;

describe('which pickers offer it', () => {
  /**
   * THE KILLING MUTATIONS, one per direction: dropping the `random={...}` prop
   * from `WeaponPicker`'s or `ArmorPicker`'s `CountRow` fails the first two
   * lines; adding one to `ItemPicker`'s - the mistake this whole item exists
   * to avoid - fails the third.
   */
  it('is on weapons and armor, and is not on loot or consumables', () => {
    mount('weapons');
    expect(randomButton(), 'weapons carry a tier and offer no randomiser').not.toBeNull();

    mount('armor');
    expect(randomButton(), 'armor carries a tier and offers no randomiser').not.toBeNull();

    mount('loot');
    expect(
      randomButton(),
      'loot and consumables have no tier, so a randomiser by tier is a filter the data cannot honour',
    ).toBeNull();
  });

  /**
   * Killed by rendering the button anywhere in band 2 - the filter head - which
   * is the band the flex algorithm takes every missing pixel out of: at
   * 852x393 it draws 51px of a 264px column, so a control put there is off the
   * glass on a landscape phone with no scrollbar to say so.
   */
  it('is pinned in the count band, not in the band that scrolls', () => {
    for (const name of ['weapons', 'armor']) {
      mount(name);
      const button = randomButton()!;
      expect(countBand().contains(button), `${name}: RANDOM is not in band 3`).toBe(true);
      expect(bands()[1]!.contains(button), `${name}: RANDOM is inside the filters`).toBe(false);
    }
  });

  /**
   * Killed by moving the floor off the inline style and onto `.chip` - which
   * is 4px/6px of padding and no height at all - or by declaring one axis and
   * not the other. `--control` is the right token and `--tap` would also pass:
   * both resolve to 44 on a coarse pointer, and 34 on a fine one is this
   * project's stated fine-pointer floor.
   */
  it('states the touch floor inline, on both axes', () => {
    for (const name of ['weapons', 'armor']) {
      mount(name);
      const button = randomButton()!;
      expect(button.style.minHeight, `${name}: no inline height`).not.toBe('');
      expect(button.style.minWidth, `${name}: no inline width`).not.toBe('');
      expect(px(button.style.minHeight, NARROW), `${name}: height at 320 coarse`).toBeGreaterThanOrEqual(44);
      expect(px(button.style.minWidth, NARROW), `${name}: width at 320 coarse`).toBeGreaterThanOrEqual(44);
      expect(px(button.style.minHeight, PHONE), `${name}: height on the phone`).toBeGreaterThanOrEqual(44);
      // A fine pointer is allowed the smaller floor and nothing below it.
      const fine = { glass: 1440, coarse: false };
      expect(px(button.style.minHeight, fine), `${name}: height with a mouse`).toBeGreaterThanOrEqual(34);
      expect(px(button.style.minWidth, fine), `${name}: width with a mouse`).toBeGreaterThanOrEqual(34);
    }
  });

  /**
   * The glass says "one of these 12" by putting RANDOM next to `12 OF 204`. A
   * screen reader is read the label and never the neighbour, so the label has
   * to carry both facts on its own.
   *
   * IT SAYS "YOU CAN EQUIP" AND NOT "SHOWING", and that word is the whole of
   * the honesty here. The count beside the button is the rows on screen; the
   * draw is the subset of them this character may equip, and on a level 3
   * fixture those two numbers are 291 and 147. A label that said "from the 291
   * showing" would now be naming a pool the button does not have.
   *
   * THE KILLING MUTATION: `label="Equip a random weapon"` - the sentence
   * without the tier and the size of the draw, which is what the button would
   * say if it were named after itself rather than after what it is about to
   * do. Dropping `tierPhrase` from `gear.ts` fails it the same way, and so
   * does putting `rows.length` back in place of the drawable count.
   */
  it('says which tiers and how many it may equip, for a reader that cannot see the count', () => {
    mount('weapons');
    expect(randomButton()!.getAttribute('aria-label'), 'unfiltered').toBe(
      `Equip a random weapon of any tier, from the ${String(takeable(primaries).length)} you can equip`,
    );

    click(chip('TIER 2'));
    const two = primaries.filter((w) => w.tier === 2).length;
    expect(randomButton()!.getAttribute('aria-label'), 'one chip lit').toBe(
      `Equip a random weapon of tier 2, from the ${String(two)} you can equip`,
    );

    click(chip('TIER 1'));
    const both = primaries.filter((w) => w.tier === 1 || w.tier === 2).length;
    expect(randomButton()!.getAttribute('aria-label'), 'two chips lit, said in order').toBe(
      `Equip a random weapon of tiers 1, 2, from the ${String(both)} you can equip`,
    );

    mount('armor');
    expect(randomButton()!.getAttribute('aria-label'), 'the armor picker names its own verb').toBe(
      `Wear a random set of armor of any tier, from the ${String(takeable(armors).length)} you can equip`,
    );
  });

  /** The two floors are one token, read from the stylesheet, not from memory. */
  it('reads its floor from a token that is 44 coarse and 34 fine', () => {
    expect(px('var(--control)', NARROW), 'the coarse floor').toBe(44);
    expect(px('var(--control)', { glass: 1440, coarse: false }), 'the fine floor').toBe(34);
    expect(tokens(NARROW).has('--control'), '--control is not declared on :root').toBe(true);
  });
});

describe('what it draws', () => {
  /**
   * THE KILLING MUTATION: use `cryptoRng` inside `randomGear` instead of the
   * injected `rng`, or default the pickers' `rng` prop instead of requiring it
   * at the call site. Two runs of the same seed then disagree, and this is the
   * only place in the suite that would notice - the engine test proves the
   * function is reproducible, not that the dialog is wired to it.
   */
  it('is standing on a level 3 fixture, which has reached tier 2', () => {
    /*
     * The premise every count in this file now rests on. `playedCharacter()`
     * is levelled on purpose - the empty sheet exercises nothing - and the
     * level is what decides which rows RANDOM may land on. If the fixture ever
     * moves to level 8, `FIXTURE_TIER` moves with it or every assertion below
     * quietly stops testing the narrowing.
     */
    expect(playedCharacter().level).toBe(3);
    expect(FIXTURE_TIER).toBe(2);
    expect(takeable(primaries).length).toBeLessThan(primaries.length);
    expect(takeable(armors).length).toBeLessThan(armors.length);
  });

  it('equips the same thing twice for the same seed', () => {
    mount('weapons', seededRng(20250909));
    click(randomButton()!);
    mount('weapons', seededRng(20250909));
    click(randomButton()!);

    expect(picked, 'two identical seeds gave two different weapons').toEqual([picked[0], picked[0]]);
    expect(picked[0], 'RANDOM equipped nothing').not.toBeNull();
    expect(tierOfWeapon(picked[0]!), 'RANDOM equipped something that is not a weapon').toBeDefined();
  });

  /**
   * THE KILLING MUTATION: `randomGear(weapons, new Set(), rng)` - the picker
   * handing over the whole dataset instead of the rows its chips left, with
   * the tiers dropped on the way. 17 of these 20 draws then land outside the
   * lit chip.
   *
   * Neither half of that mutation kills this on its own, and that is worth
   * knowing rather than hiding: widening the pool while still passing
   * `q.tiers` keeps the tier (the engine re-applies it, which is why it takes
   * `want` at all) and is caught by the sibling test below on the chips that
   * are not about tier; passing `new Set()` while still handing over `rows`
   * keeps the tier too, because the rows were already filtered. The two
   * together are what "the randomiser ignores the chips" looks like, and this
   * is the assertion that sees it.
   */
  it('stays inside the tier the chips asked for', () => {
    /*
     * TIER 2 on both, where the weapon half used to lift TIER 3. The chip is
     * not the subject of this test - the pool being the filtered rows is - and
     * TIER 3 is now an empty draw on a level 3 fixture, which would prove the
     * narrowing rather than the composition. The empty case has its own test
     * below; this one needs a chip with something behind it.
     */
    for (const s of [1, 2, 3, 5, 8, 13, 21, 34, 55, 89]) {
      mount('weapons', seededRng(s));
      click(chip('TIER 2'));
      click(randomButton()!);

      mount('armor', seededRng(s));
      click(chip('TIER 2'));
      click(randomButton()!);
    }

    const drawn = picked.filter((_, i) => i % 2 === 0);
    const worn = picked.filter((_, i) => i % 2 === 1);
    expect(drawn.map(tierOfWeapon), 'a weapon came back from outside TIER 2').toEqual(
      drawn.map(() => 2),
    );
    expect(worn.map(tierOfArmor), 'armor came back from outside TIER 2').toEqual(
      worn.map(() => 2),
    );
  });

  /**
   * The second door, shut.
   *
   * A tap on a tier 4 row does nothing on a level 3 sheet - the book says
   * *"You can't equip weapons or armor with a higher tier than you."* - and
   * this is the control one column to the left of it that would otherwise have
   * equipped the same row with dice in front of it. Both pickers, because both
   * have the button.
   *
   * THE KILLING MUTATION: `randomGear(rows.map((r) => r.item), ...)` in either
   * picker - the pool it had before - which re-arms the button and lands a
   * tier 4 weapon on a level 3 character on the first seed.
   */
  it('will not draw what a tap cannot equip, on either picker', () => {
    for (const [name, chipLabel] of [
      ['weapons', 'TIER 4'],
      ['armor', 'TIER 4'],
    ] as const) {
      mount(name, seededRng(7));
      click(chip(chipLabel));
      const button = randomButton()!;
      expect(button.disabled, `${name}: RANDOM is live over a pool it may not draw`).toBe(true);
      expect(button.getAttribute('aria-label'), `${name}: the label counts the wrong pool`).toContain(
        'from the 0 you can equip',
      );
      click(button);
    }
    expect(picked, 'RANDOM equipped gear above the character’s tier').toEqual([]);

    // The control, on the same two pickers with a tier they have reached: the
    // button is not simply dead.
    for (const name of ['weapons', 'armor']) {
      mount(name, seededRng(7));
      click(chip('TIER 2'));
      click(randomButton()!);
    }
    expect(picked.length, 'the tier the character does have drew nothing either').toBe(2);
  });

  /**
   * Killed by widening the pool to the whole armoury - the same mutation as
   * above, seen from the other side: it composes with every chip, not only
   * with TIER.
   */
  it('composes with the chips that are not about tier', () => {
    for (const s of [2, 4, 6, 8, 10]) {
      mount('weapons', seededRng(s));
      click(chip('HANDS 2H'));
      click(chip('RANGE FAR'));
      click(randomButton()!);
    }
    const got = picked.map((ref) => weapons.find((w) => w.id === ref));
    expect(got.every((w) => w !== undefined), 'RANDOM equipped something not in the dataset').toBe(
      true,
    );
    expect(
      got.map((w) => `${String(w!.burden)}/${w!.range}`),
      'a one-handed or non-Far weapon came back',
    ).toEqual(got.map(() => '2/Far'));
  });

  /**
   * Killed by removing the `disabled` term, or by rendering the button only
   * when `rows.length > 0`: the first makes an empty draw a silent no-op the
   * player taps twice, the second takes the control away at the moment the
   * player is reading "No weapons match those filters" and moves CLEAR FILTERS
   * sideways under their thumb.
   */
  it('goes dim rather than away when nothing matches', () => {
    mount('weapons');
    const search = panel().querySelector<HTMLInputElement>('input[type="search"]')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(search, 'zzzzzzzz');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const button = randomButton();
    expect(button, 'RANDOM vanished with the last row').not.toBeNull();
    expect(button!.disabled, 'RANDOM is still live over an empty list').toBe(true);
    click(button!);
    expect(picked, 'an empty draw equipped something').toEqual([]);
  });
});

/**
 * A CONTROL, AND IT IS KILLABLE.
 *
 * The point of this block is that the randomiser did not cost the chips
 * anything - the filters this feature composes with have to still filter. It
 * is a control in the sense that it would pass against the code as it stood
 * before this change; it is not a control in the sense of passing either way,
 * because deleting `if (!anyOf(q.tiers, item.tier)) return false;` from
 * `filterWeapons` - or the matching line in `filterArmors` - turns both
 * assertions red.
 */
describe('the tiers the chips offer', () => {
  /**
   * The randomiser composes with the TIER chips, so the chips have to be the
   * dataset's tiers and not a list typed into the picker - which is what they
   * were: `const TIERS: Tier[] = [1, 2, 3, 4]`, four digits in a source file,
   * beside a rule that says a rule value is read from the shipped SRD data.
   *
   * THE KILLING MUTATION: put that constant back, or write `values={[1, 2, 3]}`
   * on either `Chips`. The first is killed only when the data disagrees with
   * the constant - which is exactly the day it matters and no day before it -
   * so the assertion is against `tiersIn` of the shipped list rather than
   * against a 4 written here; the second is killed immediately.
   */
  it('are the tiers the dataset has, on both pickers', () => {
    const chipsIn = (): number[] =>
      [...panel().querySelectorAll('button')]
        .map((b) => /^TIER (\d+)$/.exec(b.getAttribute('aria-label') ?? ''))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => Number(m[1]));

    mount('weapons');
    expect(chipsIn(), 'the weapon TIER chips').toEqual(tiersIn(weapons));

    mount('armor');
    expect(chipsIn(), 'the armor TIER chips').toEqual(tiersIn(armors));
  });

  it('draws no TIER row at all on a device whose catalogue is empty', () => {
    /*
     * The cost of deriving the chips instead of typing them, and the one state
     * that pays it. Every other row here - HANDS, TRAIT, RANGE - comes from a
     * module constant and is never empty; TIER comes from `tiersIn(weapons)`
     * and is `[]` before the dataset is built, a state this picker writes
     * explicit copy for three times over.
     *
     * Without the guard the screen drew a bare "TIER" with nothing after it,
     * beside three rows that had populated: a filter that lost its options
     * rather than a catalogue that has not arrived. Mutation: delete the
     * `values.length === 0` return in `Chips` and this goes red.
     */
    // Emptied AFTER the mount, because the fixture's own `seed` puts the full
    // dataset back on its way in.
    mount('weapons');
    expect(panel().textContent ?? '', 'the fixture stopped drawing TIER at all').toContain('TIER');
    act(() => {
      useApp.setState({ dataset: { ...dataset, weapons: [], armors: [] } });
    });
    expect(panel().textContent ?? '').not.toContain('TIER');
    // The control: the rows that do not derive their values are still there.
    expect(panel().textContent ?? '').toContain('HANDS');
  });
});

describe('the chip filters, unchanged', () => {
  it('still narrows the list and still says by how much', () => {
    const tier3 = primaries.filter((w) => w.tier === 3).length;
    expect(primaries.length, 'primary weapons in the shipped dataset').toBe(291);
    expect(tier3, 'primary weapons at tier 3').toBe(68);

    mount('weapons');
    expect(countBand().textContent, 'the count the slot alone leaves').toContain(
      `${String(primaries.length)} OF ${String(weapons.length)}`,
    );

    click(chip('TIER 3'));
    expect(countBand().textContent, 'TIER 3 did not narrow the count').toContain(
      `${String(tier3)} OF ${String(weapons.length)}`,
    );

    const badges = [...bands()[3]!.querySelectorAll('button')].map((row) => row.textContent ?? '');
    expect(badges.length, 'the list drew the wrong number of rows').toBe(tier3);
    expect(
      badges.filter((t) => t.includes('TIER 3') || t.includes('EQUIPPED')).length,
      'a row outside tier 3 survived the chip',
    ).toBe(tier3);
  });
});
