// @vitest-environment jsdom
/**
 * The display cutout, which this app had never paid for.
 *
 * `grep -rn 'safe-area-inset-left\|safe-area-inset-right' src/` returned zero
 * hits across the whole tree. `env(safe-area-inset-bottom)` is paid by three
 * bars, `-top` by the header and by five overlays, and the horizontal pair by
 * nothing at all - which is where the cutout is on a notched or Dynamic-Island
 * iPhone **held in landscape**.
 *
 * The inset is symmetric. iOS reports `-left` and `-right` at the same non-zero
 * value in landscape, because UIKit insets both long edges so that a
 * 180-degree rotation does not reflow the layout; only portrait has a zero on
 * the horizontal pair. This docblock used to say the inset was on one side
 * "and 0 on the other", which is false, and it presented the two casualties
 * below as two mutually exclusive rotations. They are one case.
 *
 * What that cost, measured in Chrome through the audit rig at 852x393 - an
 * iPhone 14/15 in landscape - with 59px substituted on BOTH sides, so both
 * strips are live in the same frame:
 *
 *   - the right strip [793, 852]: SETTINGS laid out at [777.6, 832], 54.4px
 *     wide. 39.0px of it, 71.7%, inside the cutout, leaving 15.4px of visible
 *     glass on the app's only permanent door to export, import, backup and
 *     print. The overlap is `inset - 20`, the padding the header already had,
 *     so it is the same 39.0 at 932x430.
 *   - the left strip [0, 59]: the app mark at [20, 40.8], 100% inside it. PLAY
 *     starts at 62.8 and clears it by 3.8px, so the nav was never the casualty
 *     on that side.
 *
 * ## What this file can and cannot hold
 *
 * `env()` resolves to 0px in jsdom and on every device without a cutout, and
 * jsdom lays nothing out, so none of the above can fail here. What can fail
 * here is the declaration - and only because this repo spells insets
 * `calc(<base> + env(...))` on a longhand.
 *
 * jsdom's CSS parser drops a bare `env()` and drops any shorthand containing
 * one, and the two shapes that produces are not the same. Probed against this
 * worktree's own jsdom:
 *
 *   - a shorthand that itself carries an `env()` - `padding: 'env(...) 20px 0'`
 *     - is dropped whole, and all four longhands read back `''`, taking the two
 *     ordinary 20s down with it.
 *   - the shape this header actually had before the fix - `padding: '0 20px'`
 *     followed by a bare `paddingTop: 'env(...)'` - reads back
 *     `{top: '0px', right: '20px', bottom: '0px', left: '20px'}`. The longhand
 *     is rejected, but the shorthand has already written a value, so nothing
 *     reads back empty. That is the worse of the two: it looks like a real
 *     number, and the top inset the app has always paid is silently gone.
 *
 * So the first case here asserts the four longhands' exact values rather than
 * their non-emptiness. It used to assert only `.not.toBe('')`, which passes
 * against the second shape - the exact pre-fix code its own comment named - and
 * its failure message claimed every assertion below would otherwise pass
 * against `''`, which was never true of any of them: they are all positive
 * matches (`toMatch(/env\(safe-area-inset-left\)/)`, `toBe('0px')`) and all of
 * them fail against an empty string. The claim was true where it came from -
 * `TabBar`'s `paddingBottom` had no shorthand above it - and false here.
 *
 * The pixels are the Chrome rig's half: `audit-harness/cases-safearea.json`,
 * `cases-safearea2.json`, and `cases-safearea3.json` through `-7` for the
 * symmetric re-measurement.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Header } from '../../src/ui/shell/Header.tsx';
import { TabBar } from '../../src/ui/shell/TabBar.tsx';
import { UpdateBanner } from '../../src/ui/shell/UpdateBanner.tsx';
import { GUTTER_LEFT, GUTTER_RIGHT } from '../../src/ui/shell/gutter.ts';
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

const mount = (element: ReactElement, width: number): void => {
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
  act(() => root.render(element));
};

/**
 * The header, at a width, in one of its two states.
 *
 * `onboarding` became a required prop when the first-run questions landed: that
 * bar carries the mark alone while they are up, with no nav and no door to
 * Settings. It takes a default here because the cutout is not what decides it -
 * the padding is on the one `<header>` element, above the branch and outside it,
 * so both states pay the same four declarations. `pays it in both of the
 * header's states` is the assertion that keeps that true; if the padding is ever
 * moved inside the branch, that case fails and this default stops being safe.
 */
const mountHeader = (width: number, onboarding = false): void =>
  mount(createElement(Header, { onboarding }), width);

describe('the header pays the cutout', () => {
  it('spells all four insets in the form jsdom keeps', () => {
    /*
     * The anti-vacuity guard, and it has to assert the values rather than
     * their non-emptiness to be one.
     *
     * The pre-fix header was `padding: '0 20px'` with a bare
     * `paddingTop: 'env(safe-area-inset-top)'` after it. jsdom rejects the
     * bare longhand, but the shorthand has already written padding-top, so
     * that code reads back `0px/20px/0px/20px` - four non-empty strings, one
     * of which is a top inset that has quietly stopped existing. Only a
     * shorthand that itself carries an `env()` reads back `''`. Asserting the
     * exact declared value catches both shapes; `.not.toBe('')`, which this
     * used to be, catches only the second.
     */
    mountHeader(LANDSCAPE);
    const header = container.querySelector('header');
    expect(header, 'the header did not render').not.toBeNull();
    const style = header!.style;

    for (const [property, value, want] of [
      ['padding-top', style.paddingTop, 'calc(0px + env(safe-area-inset-top))'],
      ['padding-right', style.paddingRight, 'calc(20px + env(safe-area-inset-right))'],
      ['padding-bottom', style.paddingBottom, '0px'],
      ['padding-left', style.paddingLeft, 'calc(20px + env(safe-area-inset-left))'],
    ] as const) {
      expect(
        value,
        `${property} is not the declaration this header is supposed to carry. Read back ` +
          `${value === '' ? "'' - a shorthand carrying an env(), dropped whole by jsdom" : `'${value}'`}` +
          '. A plain length here means the inset was written as a bare env() longhand under ' +
          'a padding shorthand: jsdom drops the longhand, the shorthand supplies the number, ' +
          'and the inset is gone while the property still looks answered.',
      ).toBe(want);
    }
  });

  it('pays left and right on top of the 20px it already had', () => {
    mountHeader(LANDSCAPE);
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
    mountHeader(LANDSCAPE);
    const style = container.querySelector('header')!.style;
    expect(style.paddingTop).toMatch(/env\(safe-area-inset-top\)/);
    expect(style.paddingBottom).toBe('0px');
  });

  it('pays it in every band, because the cutout does not ask what width we are', () => {
    // The header is the one piece of chrome drawn at every width, and a phone
    // in landscape lands in the tablet band - 852 and 932 are both 720-1179.
    for (const width of [PHONE, 719, 720, LANDSCAPE, 932, 1180]) {
      mountHeader(width);
      const style = container.querySelector('header')!.style;
      expect(style.paddingLeft, `at ${String(width)}px`).toMatch(/env\(safe-area-inset-left\)/);
      expect(style.paddingRight, `at ${String(width)}px`).toMatch(/env\(safe-area-inset-right\)/);
    }
  });

  it('pays it in both of the header states, because a cutout does not wait for the questions', () => {
    /*
     * The first-run questions gave this bar a second state - mark alone, no nav
     * and no door to Settings - and that state is the FIRST thing a new device
     * ever draws. It is also drawn on a phone that may be sideways in a cutout,
     * so it has to pay exactly what the ordinary state pays.
     *
     * This case is what lets `mountHeader` default `onboarding` to false: the
     * padding lives on the one `<header>` element, above the branch, so both
     * states carry the same four declarations. Move the padding inside the
     * branch and this fails - which is the point of it.
     */
    for (const onboarding of [false, true]) {
      mountHeader(LANDSCAPE, onboarding);
      const style = container.querySelector('header')!.style;
      const state = onboarding ? 'during the first run' : 'in the ordinary state';
      expect(style.paddingLeft, state).toBe('calc(20px + env(safe-area-inset-left))');
      expect(style.paddingRight, state).toBe('calc(20px + env(safe-area-inset-right))');
      expect(style.paddingTop, state).toBe('calc(0px + env(safe-area-inset-top))');
    }
  });
});

describe('the tab bar pays it too, and not only as a guarantee', () => {
  /*
   * Measured at 852x393, `main > nav` is null: `App.tsx` draws this bar only
   * below 720 and every notched iPhone at its native resolution is 812px wide
   * or more in landscape. But Display Zoom drops a 6.1" iPhone to 320x693, and
   * held sideways that is 693x320 - inside the phone band, on a device that
   * still has a cutout on a side edge. Measured there with 59 injected on both
   * sides: this bar is drawn, its padding reads 59px/59px, and its four tabs
   * are 143.8x60 spanning [59, 634], clear of both strips. So these two
   * declarations are a live repair on a configuration a person can reach from
   * Settings, not only a guarantee.
   */
  it('declares both horizontal insets without touching the bottom one', () => {
    mount(createElement(TabBar), PHONE);
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
    /*
     * Horizontal padding, so the 60px height is untouched and the grid
     * redistributes. Both sides are paid, so the cost is 2x the inset, and the
     * grid divides what is left: at 393 with 59 on each side that is 275, and
     * at 693x320 it is 575.
     *
     * The figures this comment carried were for four columns - 98.3 becoming
     * 68.8 at 393, and 173.3 becoming 143.8 at 693x320. At five the same
     * division gives **55.00** and **115.00**, which are 1.25x and 2.6x the
     * 44px floor. The height is what the floor is really protected by here and
     * it is untouched: every button is 60px in both configurations.
     */
    mount(createElement(TabBar), PHONE);
    const nav = container.querySelector('nav')!;
    expect(nav.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
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

/**
 * THE GUTTER THE HEADER INSETS AND THE BLOCKS UNDER IT DID NOT.
 *
 * The cutout fix moved this bar's side padding to `calc(20px + env(...))`. The
 * shell-chrome blocks `App.tsx` draws inside `<main>` directly beneath it - the
 * write-failure, campaign-failure, storage, integrity and quarantine alerts, and
 * `UpdateBanner` and `BackupBanner` through `ShellBanner` - stayed at a flat
 * `margin: '8px 20px 0'`, so under a cutout the two stopped lining up.
 *
 * Measured in Chrome through the audit rig at 852x393 with 59px substituted on
 * both sides: the header's content ran [79, 773] and the banner's box [20, 832],
 * identical to its box with the insets at 0. Fifty-nine pixels of misalignment
 * on each side - and, worse than the misalignment, `ShellBanner`'s dismiss ✕ is
 * a 44x44 target at [781, 825] against a right strip beginning at 793, so 32 of
 * its 44 pixels (72.7%) sat inside the cutout. That is a worse casualty than the
 * SETTINGS button this whole repair began with, which kept 15.4px of glass.
 *
 * Both now come from `gutter.ts`. jsdom resolves `env()` to nothing and lays
 * nothing out, so what these cases can hold is the declaration and the identity
 * of the two spellings - which is precisely what drifted, and precisely what a
 * shared constant is for.
 */
describe('the header and the blocks beneath it share one gutter', () => {
  it('declares the same two horizontal values on both, from one place', () => {
    mountHeader(LANDSCAPE);
    const header = container.querySelector('header')!.style;

    act(() => root.render(createElement(UpdateBanner, { apply: () => undefined })));
    const banner = container.querySelector<HTMLElement>('[role="status"]');
    expect(banner, 'the shell banner did not render').not.toBeNull();
    const block = banner!.style;

    expect(
      block.marginLeft,
      'the blocks under the header keep a flat 20px gutter while the header ' +
        'insets past the cutout, so under a notch they no longer line up',
    ).toBe(header.paddingLeft);
    expect(block.marginRight).toBe(header.paddingRight);
    expect(block.marginLeft).toBe(GUTTER_LEFT);
    expect(block.marginRight).toBe(GUTTER_RIGHT);
    // And the vertical half is unchanged: 8px of air under the bar, none below.
    expect(block.marginTop).toBe('8px');
    expect(block.marginBottom).toBe('0px');
  });

  it('spells the margin in longhands, so jsdom does not drop the 8px with it', () => {
    /*
     * The trap this file's first case exists for, arriving on a second
     * property. `Header.tsx` proposed this repair as `margin: '8px calc(20px +
     * env(...)) 0 calc(...)'`; jsdom drops a shorthand carrying an `env()`
     * whole, so all four margins would have read back `''` and the 8px top
     * margin would have gone with the insets - silently, in every test.
     */
    act(() => root.render(createElement(UpdateBanner, { apply: () => undefined })));
    const block = container.querySelector<HTMLElement>('[role="status"]')!.style;
    for (const [property, value] of [
      ['margin-top', block.marginTop],
      ['margin-right', block.marginRight],
      ['margin-bottom', block.marginBottom],
      ['margin-left', block.marginLeft],
    ] as const) {
      expect(
        value,
        `${property} read back empty, which is what a margin shorthand carrying ` +
          'an env() does in jsdom - and it takes the 8px top margin down with it',
      ).not.toBe('');
    }
  });

  it('leaves no hard-coded copy of the old gutter in the shell', () => {
    // The five call sites this replaced, guarded as a source sweep because the
    // sixth one will be written by somebody who never read `gutter.ts`.
    // `CampaignNotSaved.tsx` is that sixth one; it read the file and is in the
    // sweep so that the seventh is caught the same way.
    for (const file of [
      'src/ui/shell/App.tsx',
      'src/ui/shell/ShellBanner.tsx',
      'src/ui/shell/CampaignNotSaved.tsx',
    ]) {
      expect(
        readFileSync(file, 'utf8'),
        `${file} declares a flat 20px shell gutter again, which is the gutter ` +
          'that stops agreeing with the header the moment there is a cutout',
      ).not.toMatch(/margin:\s*'8px 20px 0'/);
    }
  });
});
