// @vitest-environment jsdom
/**
 * The display cutout, which this app had never paid for.
 *
 * `grep -rn 'safe-area-inset-left\|safe-area-inset-right' src/` returned zero
 * hits across the whole tree. `env(safe-area-inset-bottom)` is paid by three
 * bars, `-top` by the header and by five overlays, and the horizontal pair by
 * nothing at all - which is where the cutout is on a notched or Dynamic-Island
 * iPhone **held in landscape**, reported as `-left` or `-right` depending on
 * which way it was rotated and 0 on the other side.
 *
 * What that cost, measured in Chrome through the audit rig at 852x393 - an
 * iPhone 14/15 in landscape - with the inset substituted at 59px:
 *
 *   - the cutout on the right: SETTINGS laid out at [777.6, 832], 54.4px wide,
 *     against a strip of [793, 852]. 39.0px of it, 71.7%, inside the cutout,
 *     leaving 15.4px of visible glass on the app's only permanent door to
 *     export, import, backup and print. The overlap is `inset - 20`, the
 *     padding the header already had, so it is the same 39.0 at 932x430.
 *   - the cutout on the left: the app mark at [20, 40.8], 100% inside the
 *     strip. PLAY starts at 62.8 and clears it by 3.8px, so the nav was never
 *     the casualty on that side.
 *
 * ## What this file can and cannot hold
 *
 * `env()` resolves to 0px in jsdom and on every device without a cutout, and
 * jsdom lays nothing out, so none of the above can fail here. What can fail
 * here is the declaration - and only because this repo spells insets
 * `calc(<base> + env(...))` on a longhand. jsdom's CSS parser drops a bare
 * `env()`, and drops any shorthand containing one, so `padding: '0 20px'` with
 * an `env()` in it would read back as `''` and every assertion below would pass
 * against an empty string. The spelling is the testability, which is why the
 * first case here asserts the values are non-empty before it asserts what they
 * say.
 *
 * The pixels are the Chrome rig's half: `audit-harness/cases-safearea.json` and
 * `cases-safearea2.json`.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Header } from '../../src/ui/shell/Header.tsx';
import { TabBar } from '../../src/ui/shell/TabBar.tsx';
import { makeCharacter } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** An iPhone 14 in portrait, where the tab bar is drawn and both insets are 0. */
const PHONE = 393;
/** An iPhone 14 in landscape: the width the cutout was measured at. */
const LANDSCAPE = 852;

let container: HTMLDivElement;
let root: Root;
let viewport = LANDSCAPE;

beforeEach(() => {
  // jsdom's matchMedia answers `false` to everything, so without this the
  // header would always render its desktop branch and the landscape band -
  // which is the whole subject here - would never be reached.
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
  useApp.setState({ prefs: { ...DEFAULT_PREFS } });
});

const mount = (element: Parameters<typeof createElement>[0], width: number): void => {
  viewport = width;
  const characters = [makeCharacter({ name: 'Wizard Ten' })];
  act(() => {
    useApp.setState({
      characters,
      activeId: characters[0]!.id,
      screen: 'play',
      prefs: { ...DEFAULT_PREFS },
    });
  });
  act(() => root.render(createElement(element)));
};

describe('the header pays the cutout', () => {
  it('spells all four insets in the form jsdom keeps', () => {
    /*
     * This case exists before the ones below it because without it they are
     * vacuous. A `padding` shorthand carrying an `env()` reads back as `''`
     * here, and `expect('').not.toContain(...)` is a test that cannot fail.
     */
    mount(Header, LANDSCAPE);
    const header = container.querySelector('header');
    expect(header, 'the header did not render').not.toBeNull();
    const style = header!.style;

    for (const [property, value] of [
      ['padding-top', style.paddingTop],
      ['padding-right', style.paddingRight],
      ['padding-bottom', style.paddingBottom],
      ['padding-left', style.paddingLeft],
    ] as const) {
      expect(
        value,
        `${property} read back empty, which means it was written as a shorthand or as a ` +
          'bare env() and jsdom dropped it. Every assertion in this file would then pass ' +
          'against nothing.',
      ).not.toBe('');
    }
  });

  it('pays left and right on top of the 20px it already had', () => {
    mount(Header, LANDSCAPE);
    const style = container.querySelector('header')!.style;

    // The base padding survives: on every device without a cutout `env()` is
    // 0px and this bar has to keep looking exactly as it did.
    expect(style.paddingLeft).toMatch(/20px/);
    expect(style.paddingRight).toMatch(/20px/);
    expect(style.paddingLeft).toMatch(/env\(safe-area-inset-left\)/);
    expect(style.paddingRight).toMatch(/env\(safe-area-inset-right\)/);
    expect(style.paddingLeft).toMatch(/^calc\(/);
    expect(style.paddingRight).toMatch(/^calc\(/);
  });

  it('has not lost the top inset it has always paid', () => {
    // The regression this fix could most easily cause: `paddingTop` used to be
    // a bare `env(safe-area-inset-top)` written after a `padding` shorthand,
    // and rewriting the four longhands is exactly where it would go missing.
    // It is now in the same calc form, which is also the first time this
    // declaration has been visible to the suite at all.
    mount(Header, LANDSCAPE);
    const style = container.querySelector('header')!.style;
    expect(style.paddingTop).toMatch(/env\(safe-area-inset-top\)/);
    expect(style.paddingBottom).toBe('0px');
  });

  it('pays it in every band, because the cutout does not ask what width we are', () => {
    // The header is the one piece of chrome drawn at every width, and a phone
    // in landscape lands in the tablet band - 852 and 932 are both 720-1179.
    for (const width of [PHONE, 719, 720, LANDSCAPE, 932, 1180]) {
      mount(Header, width);
      const style = container.querySelector('header')!.style;
      expect(style.paddingLeft, `at ${String(width)}px`).toMatch(/env\(safe-area-inset-left\)/);
      expect(style.paddingRight, `at ${String(width)}px`).toMatch(/env\(safe-area-inset-right\)/);
    }
  });
});

describe('the tab bar pays it too, as a guarantee', () => {
  /*
   * Measured at 852x393, `main > nav` is null: `App.tsx` draws this bar only
   * below 720 and every notched iPhone in landscape is 812px wide or more. In
   * the orientation it *is* drawn in, iOS reports 0 on both sides. So these
   * declarations cost 0px on every device that draws the bar, and they are
   * here for the same reason `minmax(0, 1fr)` is: what the bar does if the
   * band ever moves.
   */
  it('declares both horizontal insets without touching the bottom one', () => {
    mount(TabBar, PHONE);
    const nav = container.querySelector('nav');
    expect(nav, 'the tab bar did not render').not.toBeNull();
    const style = nav!.style;

    expect(style.paddingLeft).toBe('calc(0px + env(safe-area-inset-left))');
    expect(style.paddingRight).toBe('calc(0px + env(safe-area-inset-right))');
    // The home indicator, which this bar has paid all along and which the
    // per-screen sweep in `attribution.test.tsx` counts.
    expect(style.paddingBottom).toBe('calc(0px + env(safe-area-inset-bottom))');
  });

  it('does not spend the tabs to pay it', () => {
    // Horizontal padding, so the 60px height is untouched and the grid
    // redistributes: 98.3 per column at 393 becomes 83.5 under a 59px inset,
    // still far above the 44px floor.
    mount(TabBar, PHONE);
    const nav = container.querySelector('nav')!;
    expect(nav.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    for (const button of nav.querySelectorAll<HTMLButtonElement>('button')) {
      expect(button.style.minHeight).toBe('60px');
    }
  });
});

describe('the precondition, and the grep that found this', () => {
  it('keeps viewport-fit=cover, without which every env() in this repo is 0', () => {
    /*
     * Nothing asserted this and everything depends on it. Without
     * `viewport-fit=cover` iOS letterboxes the page inside the safe area and
     * reports every inset as 0 - so the home-indicator padding three bars pay,
     * the notch padding this header pays and the cutout padding added here all
     * silently become no-ops together. It is one word in one attribute and it
     * is the switch for all of them.
     */
    const html = readFileSync('index.html', 'utf8');
    const viewportMeta = /<meta[^>]*name="viewport"[^>]*content="([^"]*)"/s.exec(html)?.[1] ?? '';
    expect(viewportMeta, 'no viewport meta found').not.toBe('');
    expect(viewportMeta.replace(/\s+/g, ' ')).toMatch(/viewport-fit\s*=\s*cover/);
  });

  it('answers the grep that returned nothing', () => {
    // The finding, in its original form: neither string appeared anywhere in
    // `src/`. This is the direct guard on it, and it is a source sweep rather
    // than a DOM check because the next surface to need one may not be a
    // component this file mounts.
    const sources = globSync('src/**/*.{ts,tsx,css}');
    expect(sources.length).toBeGreaterThan(20);
    const all = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(all, 'nothing in src/ pays the left cutout again').toMatch(/env\(safe-area-inset-left\)/);
    expect(all, 'nothing in src/ pays the right cutout again').toMatch(
      /env\(safe-area-inset-right\)/,
    );
  });
});
