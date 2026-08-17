// @vitest-environment jsdom
/**
 * What Build pins above the level-up, and what it stops pinning.
 *
 * Every band on this screen that is not the scrolling column is a band the
 * column does not get, and on a rotated phone there is very little column to
 * begin with. Measured in Chrome at `HEAD`, fixture `played`, Build -> Level
 * up at 667x375: shell header 53, mode header 69, level-up nav 69, tab bar 61
 * - 252 of 375px of fixed chrome, leaving the advancement column 123px of
 * window onto 1938px of flow, 6.3% of it. With the backup nag up - which is
 * the state every install is in three days after a backup - the column fell to
 * 57, and at 568x320 to 34, which is the scroll's own 14 + 20 of padding
 * around a content box of nothing.
 *
 * One of those four bands was redundant. The mode header is Sheet | Level up |
 * New, and during a level-up `LevelUp` already pins its own Cancel next to
 * Apply; both call the same `onDone`. So it is drawn on the sheet and nowhere
 * else, and the column gets the 69px back - 192 at 667x375, 126 with the nag,
 * and 267 at 852x393 where the header is 75.
 *
 * ## jsdom computes no layout, so none of the numbers above are asserted here
 *
 * Not one assertion in this file measures anything. Every number in it was
 * taken from Chrome and lives in the docblocks of `Build.tsx` and
 * `LevelUp.tsx` beside the code that produces it. What a rendered tree *can*
 * answer is the question the numbers turn on, which is whether the band is in
 * the tree at all - so that is what is asked, three times, on the two modes
 * that share this screen.
 *
 * ## The third question is not about pixels
 *
 * The character switcher lives in that same band. `LevelUp` holds its `picks`
 * in component state and reads the active character out of the store, and
 * `update()` writes to whatever is active at the moment it runs - so a tap on
 * another name with a plan half-built left the plan standing and pointed it at
 * the character that was tapped. Gating the band removes the affordance, and
 * that is worth its own assertion because a later pass could give the header
 * back to the level-up for a reason that has nothing to do with height.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { useApp } from '../../src/store/state.ts';
import { Build } from '../../src/ui/build/Build.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // A phone, which is the viewport the band costs the most on. Nothing here
  // depends on the answer - both modes draw the same tree either way - but a
  // media query with no stub throws in jsdom.
  window.matchMedia = ((query: string) =>
    ({
      matches: /max-width:\s*719px/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
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

/** Build, on the sheet, with `characters` in the library and the first active. */
function mount(characters: Character[]): void {
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters,
    activeId: characters[0]!.id,
  });
  act(() => {
    root.render(createElement(Build));
  });
}

/** The mode switch, by the name a screen reader reads it out under. */
const modeHeader = (): Element | null => container.querySelector('[aria-label="Build mode"]');

/** The switcher row, which is in the same band. */
const switcher = (): Element | null =>
  container.querySelector('[aria-label="Characters on this device"]');

const button = (starts: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').trim().startsWith(starts),
  );

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Onto the level-up, the way a player gets there: the sheet's own button. */
function levelUp(): void {
  const enter = button('Level up to');
  expect(enter, 'the Build sheet no longer offers a level-up, so this file tests nothing').toBeDefined();
  click(enter!);
  expect(
    container.textContent ?? '',
    'the level-up did not open, so what follows is measuring the sheet',
  ).toContain('Tier achievement');
}

describe('the band Build pins above whichever flow is open', () => {
  it('draws the mode header on the sheet, and not over a level-up', () => {
    mount([playedCharacter()]);
    expect(
      modeHeader(),
      'the sheet has no mode switch, so there is no way into a level-up but the ' +
        'sheet button and no way to see which mode you are in',
    ).not.toBeNull();

    levelUp();
    expect(
      modeHeader(),
      'the Sheet | Level up band is still pinned over the level-up. It is 69px of a ' +
        '375px landscape phone off a column that has 192, and every verb in it is one ' +
        "the level-up's own nav already offers",
    ).toBeNull();
  });

  it('leaves by the nav’s own Cancel, and the header comes back with the sheet', () => {
    mount([playedCharacter()]);
    levelUp();
    expect(
      modeHeader(),
      'the mode header is drawn during the level-up, so this test cannot tell whether ' +
        'Cancel is a way out or the mode switch is',
    ).toBeNull();

    const cancel = button('Cancel');
    expect(
      cancel,
      'with the mode header gone, Cancel is the only way back to the sheet and it is not ' +
        'on the screen',
    ).toBeDefined();
    click(cancel!);

    expect(
      container.textContent ?? '',
      'Cancel did not return to the sheet, and the mode switch it replaced is gone',
    ).not.toContain('Tier achievement');
    expect(
      modeHeader(),
      'the sheet came back without its mode header, so the level-up is now unreachable',
    ).not.toBeNull();
  });

  it('puts no character switcher on screen while a plan is half-built', () => {
    const first = playedCharacter();
    const second = { ...playedCharacter(), id: `${first.id}-2`, name: 'The other one' };
    mount([first, second]);
    expect(
      switcher(),
      'the sheet stopped offering the switcher, which is the only way to change ' +
        'character without going through Settings',
    ).not.toBeNull();

    levelUp();
    expect(
      switcher(),
      'the character switcher is on screen during a level-up. `LevelUp` keeps its picks ' +
        'in component state and `update()` writes to whoever is active when Apply runs, ' +
        'so a tap here mid-plan applies this level to the other character',
    ).toBeNull();
  });
});
