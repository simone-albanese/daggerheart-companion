// @vitest-environment jsdom
/**
 * The header's one button, which used to be labelled with the wrong word.
 *
 * Below 720px the header's nav is not rendered and TabBar carries only
 * play/cards/build/gm, so a single control in the top-right corner is the only
 * permanent way to reach export, import, backup, persistent storage, print and
 * About. That control was labelled `theme === 'light' ? 'LIGHT' : 'MENU'`,
 * and neither word is true of it: it has never toggled the theme, it has only
 * ever called setScreen('settings'). A light-theme phone therefore said LIGHT
 * on the door to everything a person reaches for when they are afraid of
 * losing a character, and `system` said MENU on a white screen, so the word
 * was not even a reliable readout of the thing it appeared to report.
 *
 * The reason it survived a year is worth writing down, because it is the
 * general trap rather than this instance of it: the `aria-label` said
 * "Settings" all along. Every automated check reads the accessible name, and
 * so does every screen reader, which means the only reader who ever saw the
 * wrong word was the sighted one nobody was testing for. So the last block
 * here is not about this button at all - it is the rule that no button in this
 * header may be *called* something other than what it *says*, which is WCAG
 * 2.5.3 and is the thing that would have caught this.
 *
 * There was no test for Header.tsx of any kind before this file.
 */
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import { useApp, type Screen } from '../../src/store/state.ts';
import { Header } from '../../src/ui/shell/Header.tsx';
import { TabBar } from '../../src/ui/shell/TabBar.tsx';
import { makeCharacter } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** An iPhone 14, the width the header's own comments are written against. */
const PHONE = 393;
/** An iPad mini in portrait: the width the nav collision was measured at. */
const TABLET = 744;
const DESKTOP = 1280;

let container: HTMLDivElement;
let root: Root;
let viewport = DESKTOP;

/**
 * A matchMedia that answers, which jsdom's does not - it returns `matches:
 * false` for everything, so every component would render its desktop branch
 * and the phone, which is the whole subject here, would never be tested.
 */
beforeEach(() => {
  window.matchMedia = ((query: string): MediaQueryList => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: max?.[1] !== undefined && viewport <= Number(max[1]),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

interface World {
  width?: number;
  theme?: Prefs['theme'];
  /** How many characters exist, which decides name-vs-picker in the header. */
  characters?: number;
}

const mount = (element: Parameters<typeof createElement>[0], world: World = {}): void => {
  viewport = world.width ?? DESKTOP;
  const characters = Array.from({ length: world.characters ?? 1 }, (_, i) =>
    makeCharacter({ name: `Character ${i + 1}` }),
  );
  act(() => {
    useApp.setState({
      characters,
      activeId: characters[0]?.id ?? null,
      screen: 'play',
      prefs: { ...DEFAULT_PREFS, theme: world.theme ?? 'dark' },
    });
  });
  act(() => root.render(createElement(element)));
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

/** What a button says, as a person reading the screen would read it. */
const word = (el: Element): string => (el.textContent ?? '').trim();

/** What a button is called, as the accessibility tree resolves it. */
const name = (el: Element): string => el.getAttribute('aria-label') ?? word(el);

/** Where a button actually goes, asked by pressing it. */
const routesTo = (button: HTMLButtonElement): Screen => {
  act(() => {
    useApp.setState({ screen: 'play' });
  });
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const landed = useApp.getState().screen;
  act(() => {
    useApp.setState({ screen: 'play' });
  });
  return landed;
};

/**
 * The controls that open Settings, identified by what they do rather than by
 * what they are called - the whole point being that the two disagreed.
 */
const doorsToSettings = (): HTMLButtonElement[] =>
  buttons().filter((b) => routesTo(b) === 'settings');

describe('the door to Settings', () => {
  it('says where it goes, on every theme', () => {
    const said = new Map<Prefs['theme'], string>();

    for (const theme of ['dark', 'light', 'system'] as const) {
      mount(Header, { width: PHONE, theme });
      const doors = doorsToSettings();
      expect(doors, `theme ${theme}: expected one control to open Settings`).toHaveLength(1);
      said.set(theme, word(doors[0]!));
    }

    for (const [theme, text] of said) {
      expect(text, `on the ${theme} theme the door to Settings reads "${text}"`).toMatch(
        /^settings$/i,
      );
    }

    // And the word is not a readout of anything. It was `light` that made this
    // visible, but `system` is the worse case: it renders on a white screen and
    // on a black one and the word could only ever be right about one of them.
    expect([...new Set(said.values())], 'the word changes with the theme').toHaveLength(1);
  });

  it('is the only permanent route to Settings on a phone, and a 44px target', () => {
    // The tab bar is the other navigation a phone has, and it has four
    // destinations, none of which is this one.
    mount(TabBar, { width: PHONE });
    const tabs = buttons();
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(routesTo(tab), `the ${word(tab)} tab reaches Settings`).not.toBe('settings');
    }

    mount(Header, { width: PHONE, theme: 'light' });
    const doors = doorsToSettings();
    expect(doors).toHaveLength(1);
    const door = doors[0]!;

    // The corner of a phone is out of the thumb arc on purpose: this is tapped
    // rarely and never mid-roll. Out of reach is only acceptable while it is
    // both legible and big enough to hit deliberately.
    // Case-insensitively, because the word is uppercase and a redundant
    // `aria-label="Settings"` beside it would be harmless. What is not
    // harmless is the two being different words.
    expect(
      name(door).toLowerCase(),
      'the door is called something other than what it says',
    ).toBe(word(door).toLowerCase());
    expect(door.style.minHeight).toBe('var(--control)');
    expect(door.style.minWidth).toBe('var(--control)');

    // ...and --control is the 44px touch floor at every phone width, which is
    // the claim the two lines above depend on.
    const tokens = readFileSync('src/ui/tokens.css', 'utf8');
    expect(tokens).toMatch(/--tap:\s*44px/);
    expect(tokens).toMatch(
      /@media\s*\(max-width:\s*1179px\),\s*\(pointer:\s*coarse\)\s*\{\s*:root\s*\{\s*--control:\s*var\(--tap\)/,
    );
  });
});

describe('the nav and the readout share one line', () => {
  /**
   * What this can and cannot prove.
   *
   * The defect is invisible to jsdom by construction: the DOM was always
   * correct. `<header className="spread">` is one flex line, the right group is
   * `flex: 'none'` and the left group carries `minWidth: 0`, so the whole of the
   * line's deficit came off the left group's box while its four one-word nav
   * buttons kept their size and painted outside it. The right group is the later
   * sibling in the same stacking context, so it was painted over the nav and won
   * the hit test. Measured in Chrome at 744x1133: GM 100% covered, BUILD 73%,
   * and `document.elementFromPoint` at either centre returning the "SRD ONLY ·
   * NO ART" span. jsdom computes no layout, so it can see none of that, and the
   * whole occlusion is exactly why it survived a repo with 2292 tests.
   *
   * What jsdom *can* hold is the rule the fix is made of, which is a rule about
   * what is rendered rather than about where: the two things that were fighting
   * over one line are never both on it below 1180, and the one that yields is
   * the readout rather than the nav. The pixels are the Chrome harness's half -
   * post-fix the right group measures 184.2 instead of 485.7, the left group's
   * 330px of content is allotted all 330 from 720 up, and every tab returns
   * itself from its own centre at 720, 744, 768, 802, 828, 856, 864 and 1179.
   */
  it('draws the status readout only in the band whose line can hold it', () => {
    const NAV = ['play', 'cards', 'build', 'gm'];

    for (const width of [PHONE, 719, 720, TABLET, 1179, 1180, DESKTOP]) {
      mount(Header, { width });

      const tabs = buttons()
        .filter((b) => NAV.includes(word(b).toLowerCase()))
        .map((b) => word(b));
      expect(tabs, `the nav at ${width}px`).toEqual(
        width >= 720 ? ['Play', 'Cards', 'Build', 'GM'] : [],
      );

      // The dataset line and the library count, either wording of the first.
      const readout = /SRD ONLY · NO ART|SRD \+ CORE RULEBOOK|LOCAL ·/.test(
        container.textContent ?? '',
      );
      expect(
        readout,
        `at ${width}px the readout is ${readout ? 'drawn' : 'absent'} and the nav is ${
          tabs.length > 0 ? 'drawn' : 'absent'
        }`,
      ).toBe(width >= 1180);

      // Nothing above may be bought with the two things this header is not
      // allowed to lose: the only door to Settings, and the licence mark.
      const doors = doorsToSettings();
      expect(doors, `one door to Settings at ${width}px`).toHaveLength(1);
      expect(doors[0]!.style.minHeight).toBe('var(--control)');
      expect(doors[0]!.style.minWidth).toBe('var(--control)');
      expect(
        container.querySelector('img[alt="Daggerheart Compatible"]'),
        `the compatibility mark at ${width}px`,
      ).not.toBeNull();
    }
  });
});

describe('what the header calls its buttons', () => {
  it('never labels one with a word that is not the word on it', () => {
    // The general form. A visible label that the accessible name does not
    // contain is WCAG 2.5.3, and it is also how a wrong word hides from every
    // test in this repo: the machines read the label and only the eye reads
    // the button.
    for (const width of [PHONE, DESKTOP]) {
      for (const theme of ['dark', 'light', 'system'] as const) {
        for (const characters of [0, 1, 2]) {
          mount(Header, { width, theme, characters });
          for (const button of buttons()) {
            const label = button.getAttribute('aria-label');
            const text = word(button);
            if (label === null || text === '') continue;
            expect(
              label.toLowerCase(),
              `at ${width}px on the ${theme} theme a button reads "${text}" and is labelled "${label}"`,
            ).toContain(text.toLowerCase());
          }
        }
      }
    }
  });
});
