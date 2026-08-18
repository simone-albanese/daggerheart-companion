// @vitest-environment jsdom
/**
 * The gear picker's five bands, and which of them is allowed to give.
 *
 * The defect this file was written for: the picker was three bands - a filter
 * head at `flex: none`, the list, a footer at `flex: none` - and at 320 CSS
 * pixels of width the head measures 489px against the 546px a 320x568 phone
 * leaves inside the overlay. The list, the only child that could shrink, was
 * squeezed to its own 22px of padding and **0px of content** (scrollHeight
 * 20534), and the 28px that still would not fit went under the panel's
 * `overflow: hidden`, taking 19px off each of Unequip and Done. On a landscape
 * phone - 852x393 and 667x375 - the whole 63px footer was drawn below the clip
 * edge, so both verbs were **0px on glass** and `elementFromPoint` at their own
 * centres returned nothing. That is the screen a player equips a weapon on,
 * showing no weapons, with no visible Done.
 *
 * ## What this file can and cannot prove
 *
 * jsdom computes no layout. Not one of the numbers above can be measured here,
 * and nothing in this file pretends to: every assertion is on a *declaration* -
 * which band exists, in which order, with which flex terms and which floor -
 * because the declarations are what the layout engine then acts on and they
 * are what a later edit would quietly change. The half that needs a layout
 * engine was measured in Chrome and the table lives in `GearPicker.tsx`'s own
 * docblock beside the code it describes, on both sides of the change:
 *
 *   320x568   head 489 -> filters 226 of 372, list 22/0px -> 140, Done cut 19 -> 0
 *   852x393   head 381 -> filters  51 of 264, list 22/0px -> 140, Done cut 86 -> 0
 *   667x375   head 381 -> filters  33 of 264, list 22/0px -> 140, Done cut 104 -> 0
 *   375x667, 393x852, 744x1133  unchanged to the pixel, both pickers
 *
 * ## Why the assertions are shaped as bands rather than as one component
 *
 * `PickerDialog` is behind three doors - weapons, armor, loot - and this repo
 * has shipped "a component drawn behind two doors describing the door it did
 * not come through" often enough to have a name for it. So each question is
 * asked of all three pickers, mounted the way `Edit.tsx` mounts them.
 *
 * Escape is deliberately not re-tested here. It arrives from `useDialog`, and
 * `tests/ui/dialogs.test.tsx` already asks this picker for it by name, along
 * with the focus trap and the return of focus on close. It was wired before
 * this change and is wired after it; what was missing was never the key, it
 * was every visible way out except the ✕.
 */
import 'fake-indexeddb/auto';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { useApp } from '../../src/store/state.ts';
import type { Rng } from '../../src/engine/dice.ts';
import { ArmorPicker, ItemPicker, WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

/**
 * The dice the weapon and armor pickers require, which nothing here rolls.
 *
 * It throws rather than returning a number, the way `Rest.tsx`'s preview RNG
 * does. No test in this file taps RANDOM - the floor sweep below reads the
 * button's declarations and does not press it - so a render or a sweep that
 * starts rolling has changed behaviour, and should say so by name rather than
 * quietly equipping something.
 */
const neverRolls: Rng = () => {
  throw new Error('nothing in this file may roll for gear');
};

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // A phone, so nothing here depends on the desktop-only `autoFocus`.
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

/** The three doors `PickerDialog` is drawn behind, mounted as `Edit.tsx` mounts them. */
const PICKERS: Record<string, () => ReactElement> = {
  weapons: () => {
    const character = playedCharacter();
    seed(character);
    return (
      <WeaponPicker
        rng={neverRolls}
        slot="primary"
        value={character.activePrimaryWeapon}
        sheet={character}
        stats={playedStats(character)}
        onPick={() => {}}
        onClose={() => {}}
      />
    );
  },
  armor: () => {
    const character = playedCharacter();
    seed(character);
    return (
      <ArmorPicker
        rng={neverRolls}
        value={character.activeArmor}
        sheet={character}
        onPick={() => {}}
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

const mount = (name: string): void => {
  const element = PICKERS[name]!();
  act(() => root.render(element));
};

const panel = (): HTMLElement => {
  const overlay = container.querySelector<HTMLElement>('[role="dialog"]');
  if (overlay === null) throw new Error('nothing on screen carries role="dialog"');
  const box = overlay.firstElementChild;
  if (!(box instanceof HTMLElement)) throw new Error('the overlay has no panel inside it');
  return box;
};

const bands = (): HTMLElement[] => [...panel().children].filter((el): el is HTMLElement => el instanceof HTMLElement);

/** `flex` is a shorthand; read whichever of the two spellings the element used. */
const flexOf = (el: HTMLElement): string =>
  el.style.flex !== '' ? el.style.flex : `${el.style.flexGrow} ${el.style.flexShrink} ${el.style.flexBasis}`;

const px = (v: string): number => (v.endsWith('px') ? Number.parseFloat(v) : Number.NaN);

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * One whole row, the column's gap, a sliver of the next, and the list's own
 * padding. 85px is the tallest first row any of the three pickers draws at 320
 * wide, measured in Chrome; 82 for weapons, 64 at tablet width.
 */
const ROW = 85;
const GAP = 8;
const SLIVER = 25;
const PADDING = 10 + 12;

describe.each(Object.keys(PICKERS))('the %s picker', (name) => {
  it('is five bands, in the order they give', () => {
    mount(name);
    // Title, filters, count, list, verbs - read as jsdom expands the shorthand,
    // which is the useful spelling here because the middle term is the whole
    // argument. Exactly one band has a non-zero shrink factor against a
    // non-zero base, so the flex algorithm takes every missing pixel out of the
    // filters; the list's shrink factor is scaled by a zero base and so takes
    // none of it, and grows into whatever is spare instead. The three `0 0
    // auto` bands are the ones a player must be able to reach without
    // scrolling: the name and the ✕, the count and CLEAR FILTERS, Unequip and
    // Done.
    expect(bands().map(flexOf), 'the bands, top to bottom').toEqual([
      '0 0 auto',
      '0 1 auto',
      '0 0 auto',
      '1 1 0%',
      '0 0 auto',
    ]);
  });

  it('gives the list a floor of one whole row', () => {
    mount(name);
    const list = bands()[3]!;
    expect(px(list.style.minHeight), 'the list has no declared floor').toBeGreaterThanOrEqual(
      ROW + GAP + SLIVER + PADDING,
    );
  });

  it('gives the panel a definite height rather than a maximum', () => {
    mount(name);
    // `max-height` leaves a flex column's main size indefinite, and the bands
    // are then resolved against the list's max-content - 15818px of weapons -
    // and never re-resolved against the clamped height. Measured in Chrome at
    // 744x1133 under `max-height: 100%`: the filter band's base size came out
    // 22px around 264px of content, with 847px free.
    expect(panel().style.height, 'the panel is sized by a maximum').toBe('100%');
    expect(panel().style.maxHeight, 'a maximum is still declared beside it').toBe('');
  });

  it('scrolls the filters inside their own band, without the band being the column', () => {
    mount(name);
    const filters = bands()[1]!;
    expect(filters.className.split(/\s+/), 'the filter band does not scroll').toContain('scroll');
    expect(px(filters.style.minHeight), 'the filter band cannot go under its content').toBe(0);
    // A scroll container that is *itself* the flex column shrinks its own
    // children instead of overflowing: measured at 320x568 with the band at its
    // squeezed 226px, collapsing this wrapper took scrollHeight from 372 to 240
    // and the three chip rows from 44px each to zero, unreachable by scrolling.
    expect(filters.className.split(/\s+/), 'the scrollport is the flex column itself').not.toContain(
      'stack',
    );
    const column = filters.firstElementChild;
    expect(column, 'the filter band has no column inside it').toBeInstanceOf(HTMLElement);
    expect(
      (column as HTMLElement).className.split(/\s+/),
      'the child of the scrollport is not the column',
    ).toContain('stack');
  });

  it('keeps the way out and the way back out of the filters off the band that scrolls', () => {
    mount(name);
    const [title, filters, count, , verbs] = bands();
    // The ✕ is the only control on glass at every viewport measured, before and
    // after (y21-65, uncut at all six). It may not become something you scroll
    // a band to reach.
    expect(title!.querySelector('[aria-label="Close the picker"]'), 'the ✕ is not in band 1').not.toBe(
      null,
    );
    expect(filters!.querySelector('[aria-label="Close the picker"]'), 'the ✕ scrolls away').toBe(
      null,
    );
    // The count is the only feedback that a filter did anything, and where it
    // is filtered it carries CLEAR FILTERS - the way back out of a list filtered
    // down to nothing. Scrolled away above "No weapons match those filters" it
    // strands the player with an empty list and no visible way to empty it.
    expect(count!.textContent ?? '', 'band 3 is not the count').toMatch(/\d+ OF \d+/);
    expect(filters!.textContent ?? '', 'the count scrolls with the filters').not.toMatch(
      /\d+ OF \d+/,
    );
    const verbNames = [...verbs!.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
    expect(verbNames, 'Done is not in the last band').toContain('Done');
  });

  /*
   * The 44px floor, on the axis these buttons never declared.
   *
   * THE ARITHMETIC, ONCE, FOR THE WHOLE CLASS. `.chip` is
   * `font: 600 9.5px/1 var(--mono); letter-spacing: 0.06em`, `base.css:42-50`
   * zeroes a button's border, and the shipped `plexmono-600-latin.woff2` is a
   * flat 600/1000 advance on every glyph (checked in the file: `unitsPerEm`
   * 1000). So a character is 9.5 x 0.6 + 9.5 x 0.06 = 6.27px, and a
   * three-character label is 18.81px plus whatever padding the control
   * declares. `Seg` declared `padding: '0 10px'` when this was written, so
   * `All` (Reach), `Any` (Slot), `Any` (Category) and `All` (Kind) measured
   * **38.81px** wide inside a 44px-tall box. (It declares `'0 6px'` now, and
   * the test after this one is why: the same four labels are 30.81px natural
   * there and the `min-width` still lifts them to a true 44.) They clear WCAG
   * 2.5.8's 24px with room; the floor they
   * break is this project's own `--control` / `--tap`, which resolves to 44 at
   * every width below 1180 and under any coarse pointer - so at every viewport
   * this dialog is measured at.
   *
   * The same omission, same commit: `Conditions.tsx`'s SET chip at
   * `padding: '0 12px'` was 42.81, `Play.tsx`'s USE at `.chip`'s own
   * `padding: 4px 6px` was 30.81. `Cards.tsx` closed its own two in `112cb7f`
   * and reported this file as out of its lane; this is that report, taken up.
   *
   * jsdom computes no layout, so 38.81 is not reachable here. What is testable
   * is the declaration that produces 44, asked of every button in the two
   * bands the filters live in rather than of the four labels that were caught -
   * `Chips` already passed it and is asserted anyway, because the claim is
   * about the block and not about the buttons that happened to be found.
   *
   * A filter is set first so that band 3 has a button in it at all: CLEAR
   * FILTERS only exists once something is filtered, and asserting over an empty
   * band is how a test covers nothing and says it covered something. The tap is
   * on the last option of the first `Seg`, which is the one option all three
   * pickers agree is not the default (`gear.ts` starts every one of them at
   * `reach: 'all'` / `kind: 'all'`).
   *
   * `minWidth === minHeight` rather than a literal token, because the two
   * floors in this repo are not interchangeable by accident: `--tap` is always
   * 44 and `--control` is 44 below 1180 and 34 above it, and a control that
   * says one on one axis and the other on the other is claiming a difference
   * it does not mean. Both are accepted; disagreeing with itself is not.
   */
  it('states the control floor on both axes, for every button in the filter bands', () => {
    mount(name);
    const groups = [...bands()[1]!.querySelectorAll<HTMLElement>('[role="group"]')];
    expect(groups.length, 'the filter band has no segmented control').toBeGreaterThan(0);
    const options = [...groups[0]!.querySelectorAll('button')];
    click(options[options.length - 1]!);

    const [, filters, count] = bands();
    const chips = [...filters!.querySelectorAll('button'), ...count!.querySelectorAll('button')];
    const labelled = chips.map((c) => (c.getAttribute('aria-label') ?? c.textContent ?? '').trim());
    expect(labelled, 'the tap did not open the way back out of the filters').toContain(
      'CLEAR FILTERS',
    );
    expect(
      labelled.filter((l) => l === 'All' || l === 'Any'),
      'none of the three-character labels this test exists for is on screen',
    ).not.toHaveLength(0);

    for (const chip of chips) {
      const label = (chip.getAttribute('aria-label') ?? chip.textContent ?? '').trim();
      expect(chip.style.minHeight, `"${label}" declares no height floor`).toMatch(
        /^var\(--(control|tap)\)$/,
      );
      expect(chip.style.minWidth, `"${label}" declares no width floor`).toMatch(
        /^var\(--(control|tap)\)$/,
      );
      expect(
        chip.style.minWidth,
        `"${label}" states one floor on its height and another on its width`,
      ).toBe(chip.style.minHeight);
    }
  });

  /*
   * Where the width floor is paid from, which is the part that went wrong.
   *
   * `min-width: 44` on its own is not free: it only binds on the
   * three-character labels, every `Seg` group has exactly one of them, and each
   * group therefore grew 5.19px. Measured in Chrome on both sides, with the
   * shipped fonts: the weapons filter row's line 1 went 301.84 -> 312.22 and
   * flipped from two lines to three across **windows 348 to 358** - at 356 the
   * head went 318 -> 372 and the weapon list 332 -> 278 - while the armor rail
   * went 348.10 -> 353.29 and pushed 5.19px more of the TIER `4` chip behind a
   * `scrollbar-width: none` scrollport. Raising one control to the floor may
   * not push the control next to it further off the glass.
   *
   * `padding: '0 6px'` is where the width comes from instead: it is `.chip`'s
   * own horizontal padding in `base.css`, it takes 8px off only the long
   * labels, and it leaves line 1 at 288.22 - narrower than before the floor was
   * declared at all, so no supported width gains a line and 360 has 25.78px of
   * margin against 12.16 before.
   *
   * jsdom cannot see any of those numbers. What it can hold still is the
   * declaration they follow from, which is the thing an edit would change.
   */
  it('pays for the width floor out of its own padding, not out of the row beside it', () => {
    mount(name);
    const groups = [...bands()[1]!.querySelectorAll<HTMLElement>('[role="group"]')];
    expect(groups.length, 'the filter band has no segmented control').toBeGreaterThan(0);
    for (const group of groups) {
      for (const option of group.querySelectorAll<HTMLElement>('button')) {
        const label = (option.textContent ?? '').trim();
        expect(
          option.style.padding.replace(/(^|\s)0px/g, '$10'),
          `"${label}" widens itself past .chip's own padding`,
        ).toBe('0 6px');
      }
    }
  });

  /*
   * The one chip rail that may not be a rail.
   *
   * Three of the four rails in this file hold nothing but `Chips`, and they
   * scroll sideways with the scrollbar hidden - a standing cost this file's own
   * docblock names and does not pay off here. The armor picker's rail is the
   * exception, because it is the only one that also holds a `Seg`, and its
   * 345.30px of content clears a 393px window's 347px content box and nothing
   * narrower. Wrapped, every TIER chip is a whole 44x44 on glass at every
   * supported width; unwrapped, the `4` chip measured 27.70px at 375, 12.70 at
   * 360 and 0.00 at 320, behind a scrollbar that is not drawn.
   *
   * The loot picker has no rail at all - one `Seg` and a search box - so the
   * count is asserted per picker rather than assumed to be non-zero, which is
   * how a loop over an empty list covers nothing and reports a pass.
   */
  it('wraps the rail that holds a segmented control and scrolls the ones that do not', () => {
    mount(name);
    const rails = [...bands()[1]!.querySelectorAll<HTMLElement>('div.row')].filter(
      (el) => el.style.overflowX === 'auto' || el.style.flexWrap === 'wrap',
    );
    expect(rails.length, 'this picker does not have the rails it is drawn with').toBe(
      { weapons: 4, armor: 1, loot: 0 }[name],
    );
    for (const rail of rails) {
      const holdsSeg = rail.querySelector('[role="group"]') !== null;
      // The `Seg` row in the weapons picker is a wrapping row of groups, not a
      // rail of chips; it is the armor rail this asks about, so a rail is only
      // interesting when it carries both a group and a chip.
      const holdsChips = [...rail.children].some((c) => c.matches('button.chip'));
      if (holdsSeg && holdsChips) {
        expect(rail.style.flexWrap, 'the rail with a Seg in it still clips its last chip').toBe(
          'wrap',
        );
        expect(rail.style.overflowX, 'the rail wraps and scrolls sideways at once').toBe('');
        expect(rail.style.scrollbarWidth, 'a wrapping rail has no scrollbar to hide').toBe('');
      } else if (!holdsSeg) {
        expect(rail.style.overflowX, 'a chip-only rail stopped scrolling sideways').toBe('auto');
        expect(rail.style.flexWrap, 'a chip-only rail started wrapping').toBe('');
      }
    }
  });
});
