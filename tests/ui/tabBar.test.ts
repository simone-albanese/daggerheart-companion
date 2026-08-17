// @vitest-environment jsdom
/**
 * The four navigation glyphs, which were invisible.
 *
 * Each tab is meant to carry a distinct silhouette so the destination you want
 * is findable by shape at the bottom of a dim room - a diamond, a rectangle, a
 * triangle, a hexagon. Three of the four painted transparent from the first
 * commit, and the fourth was only visible because it also draws a border.
 *
 * The mechanism is worth writing down, because it is silent and it is easy to
 * repeat. The style object set `background` - a shorthand - and then
 * `backgroundColor: undefined` for every tab except Cards. React applies style
 * properties in key order, and an `undefined` longhand is not "leave this
 * alone", it is a removal: it deleted the background-color the shorthand had
 * just set. Nothing throws when a shape ends up the same colour as the panel
 * behind it, no test looked at the nav, and so four icons were missing for as
 * long as the app has existed.
 *
 * So there are two tests here. One renders the real component and asks whether
 * each glyph would actually be seen. The other is the general form: no style
 * object anywhere in the app may mix the `background` shorthand with a
 * background longhand, because that is the trap rather than this instance of
 * it.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { TabBar } from '../../src/ui/shell/TabBar.tsx';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // Stated rather than inherited. The bar's shape is a function of the
  // preferences now, so every case here says which ones it is drawn under -
  // and the store is a module singleton, so a case that changes them and does
  // not put them back would decide the next file's answer too.
  act(() => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS } });
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useApp.setState({ prefs: { ...DEFAULT_PREFS } });
});

/** The glyph span in each tab, with what it would be drawn with. */
const glyphs = (): Array<{ tab: string; fill: string; border: string }> => {
  const nav = container.querySelector('nav');
  if (nav === null) throw new Error('the tab bar did not render');
  return [...nav.querySelectorAll('button')].map((button) => {
    const glyph = button.querySelector('span');
    if (glyph === null) throw new Error('a tab rendered no glyph');
    return {
      tab: (button.textContent ?? '').trim(),
      fill: glyph.style.backgroundColor,
      border: glyph.style.borderTopWidth,
    };
  });
};

describe('the navigation glyphs', () => {
  it('all four are drawn with something', () => {
    act(() => root.render(createElement(TabBar)));

    const drawn = glyphs();
    expect(drawn).toHaveLength(4);
    for (const { tab, fill, border } of drawn) {
      // A glyph is visible if it has a fill or an outline. Cards is the one
      // that is deliberately an outline; the other three are solid.
      const visible = fill !== '' || border !== '';
      expect(visible, `the ${tab} glyph would paint nothing`).toBe(true);
    }
  });

  it('gives the three solid glyphs an actual fill', () => {
    // The specific failure: `background` set and `background-color` removed,
    // so the fill is empty and only Cards' border survives.
    act(() => root.render(createElement(TabBar)));

    const solid = glyphs().filter((g) => g.tab !== 'CARDS');
    expect(solid).toHaveLength(3);
    for (const { tab, fill } of solid) {
      expect(fill, `the ${tab} glyph has no background-color`).not.toBe('');
    }
  });
});

describe('a tab with nothing behind it', () => {
  /** The bar's buttons, as the words a person reads on them. */
  const labels = (): string[] =>
    [...container.querySelectorAll('nav button')].map((b) => (b.textContent ?? '').trim());

  const nav = (): HTMLElement => container.querySelector('nav')!;

  it('is four tabs and four columns with the default preferences', () => {
    act(() => root.render(createElement(TabBar)));

    expect(labels()).toEqual(['PLAY', 'CARDS', 'BUILD', 'GM']);
    /*
     * This assertion read `toBe('repeat(4, 1fr)')` and the reversal is
     * deliberate. `1fr` is `minmax(auto, 1fr)`: a column's minimum is its
     * content's min-content size, so a label that outgrew its share would
     * widen the bar past the viewport rather than shrink - the same trap
     * `.app` was actually caught in one file over. Latent here, and measured
     * as latent: in Chrome the columns resolve to 80px at 320 against a widest
     * per-tab min-content of 35. So this pins a guarantee, not a repair.
     */
    expect(nav().style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
  });

  it('drops the GM tab when the GM section is switched off, and takes its column with it', () => {
    /*
     * The two halves fail differently and both matter. A tab that survives is
     * a door to a screen `App` now substitutes away - it would look like a
     * button that does nothing at all. A column that survives is a 98px hole
     * in the middle of the bar and three tabs that no longer sit where the
     * hand learned them: at three, each is 131px of a 393px phone, which is a
     * wider target and not a smaller one.
     */
    act(() => {
      useApp.setState({ prefs: { ...DEFAULT_PREFS, gmSection: false } });
    });
    act(() => root.render(createElement(TabBar)));

    expect(labels()).toEqual(['PLAY', 'CARDS', 'BUILD']);
    expect(labels()).not.toContain('GM');
    // Was `toBe('repeat(3, 1fr)')`, for the reason given above: the count is
    // what this case is about, and the minimum is now zero either way.
    expect(nav().style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('keeps every surviving tab a 60px target with a glyph', () => {
    // The GM tab leaving must not cost the other three anything they had.
    act(() => {
      useApp.setState({ prefs: { ...DEFAULT_PREFS, gmSection: false } });
    });
    act(() => root.render(createElement(TabBar)));

    const drawn = glyphs();
    expect(drawn).toHaveLength(3);
    for (const { tab, fill, border } of drawn) {
      expect(fill !== '' || border !== '', `the ${tab} glyph would paint nothing`).toBe(true);
    }
    for (const button of container.querySelectorAll<HTMLButtonElement>('nav button')) {
      expect(button.style.minHeight).toBe('60px');
    }
  });
});

describe('the shorthand trap, everywhere', () => {
  /**
   * The general form of the bug above.
   *
   * `background` is a shorthand that includes background-color. Setting it in
   * the same React style object as a background longhand means the two race on
   * key order, and an `undefined` longhand wins by deleting what the shorthand
   * set. There is no situation in this app where mixing them is what somebody
   * meant, so the rule is simply: pick one.
   */
  const sources = globSync('src/**/*.tsx');

  it('has sources to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('never mixes the background shorthand with a background longhand', () => {
    const offenders: string[] = [];

    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/style=\{\{/g)) {
        // Walk to the matching brace so nested objects stay inside the block.
        let depth = 2;
        let i = match.index + match[0].length;
        while (i < text.length && depth > 0) {
          if (text[i] === '{') depth += 1;
          else if (text[i] === '}') depth -= 1;
          i += 1;
        }
        const object = text.slice(match.index + match[0].length, i);
        const hasShorthand = /(^|[\s,{])background\s*:/.test(object);
        const hasLonghand = /background(Color|Image|Size|Position|Repeat|Clip|Origin|Attachment)\s*:/.test(
          object,
        );
        if (hasShorthand && hasLonghand) {
          offenders.push(`${file}:${text.slice(0, match.index).split('\n').length}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
