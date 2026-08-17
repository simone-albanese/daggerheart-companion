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
import { ArmorPicker, ItemPicker, WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

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
});
