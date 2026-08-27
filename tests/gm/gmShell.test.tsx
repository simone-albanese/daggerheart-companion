// @vitest-environment jsdom
/**
 * What the GM screen does to the shell around it.
 *
 * Two changes land in `App.tsx` with `MenuSheet`, and both are the kind that
 * are easy to make and easy to make wrongly. The tab bar does not render inside
 * the GM section, because `GmBar` is the bottom bar there and two stacked bars
 * would cost the plan a band it does not have - both bars measure 95.00 at
 * 393x852 with a 34px inset, `GmBar` on the GM screen and this one on Play, and
 * the 94 that stood here dropped the 1px `border-top` both of them carry; that
 * is only honest because MENU
 * carries the way back to Play, Cards and Build, which is why the two arrive in
 * one commit rather than two. And the licence notice does not leave: it moves
 * *into* the session list's scroll, where it costs a scroll position rather
 * than content.
 *
 * `tests/ui/attribution.test.tsx` is the gate on the second one, and since P5-6
 * it asks that of *every* screen: the GM screen was the first to take the notice
 * into its scroll and is now simply one of five that do. This file keeps the
 * questions that are about this screen in particular - what is underneath the
 * notice here, and which single element pays the home-indicator inset when the
 * bottom bar is `GmBar` rather than the shell's tab bar.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS, openingScreen, savePrefs } from '../../src/store/prefs.ts';
import { useApp, type Screen } from '../../src/store/state.ts';
import { ATTRIBUTION } from '../../src/ui/shared/CompatibleMark.tsx';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const NOTICE = ATTRIBUTION.join(' ');

let container: HTMLDivElement;
let root: Root;

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

/** A 393x852 phone, which is the width the tab bar exists at. */
const setPhone = (): void => setViewport(393);
/** A laptop, where the tab bar is gone and the header's nav is the navigation. */
const setDesktop = (): void => setViewport(1280);

function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse|pointer:\s*coarse/.test(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) ||
        (min !== null && width >= Number(min[1])) ||
        (coarse && width < 1180),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  /*
   * Pull the GM chunk in before anything is mounted.
   *
   * `App.tsx` reaches it through `lazy()`, and `settle` below turns a hundred
   * empty macrotasks - which is *fast*, a few milliseconds, and can easily
   * finish before Vite has transformed twenty modules for a cold dynamic
   * import. The result is a test that fails on how quickly the loop spins
   * rather than on anything the app did. Importing it here puts it in the
   * module cache, so `lazy()` resolves from memory and the wait is real.
   */
  await import('../../src/ui/gm/Gm.tsx');
});

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setPhone();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await db.clearAll();
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
  useApp.setState({
    ready: false,
    storageError: null,
    writeError: null,
    quarantined: [],
    characters: [],
    activeId: null,
    screen: 'play',
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function settle(until: () => boolean = () => true, turns = 120): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

const text = (): string => container.textContent ?? '';
const main = (): HTMLElement => container.querySelector('main')!;

/**
 * Boot the real shell with one character in the library, and let `init` decide
 * where it lands - which is the whole subject of the last block in this file.
 */
async function boot(): Promise<void> {
  await db.putCharacter(playedCharacter());
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
}

/** The same, then switched to `screen` the way a person switches. */
async function mountOn(screen: Screen, ready: () => boolean): Promise<void> {
  await boot();
  await act(async () => {
    useApp.getState().setScreen(screen);
  });
  // GM is `lazy()`; the dynamic import and the store's hydration need turns.
  await settle(ready);
}

/**
 * Is this element the last thing inside `<main>`, at every level above it?
 *
 * Not a direct-child check. `ScreenBoundary` returns its children untouched in
 * the happy path, so the chain is `main > div > nav` and `main > nav` would be
 * false for a reason that has nothing to do with the question being asked.
 */
function lastInMain(el: Element): boolean {
  let node: Element | null = el;
  while (node !== null && node !== main()) {
    if (node.parentElement?.lastElementChild !== node) return false;
    node = node.parentElement;
  }
  return node === main();
}

const onGm = (): Promise<void> => mountOn('gm', () => text().includes('Nothing planned yet'));

// ---------------------------------------------------------------------------

describe('the bottom of the GM screen', () => {
  it('carries the session tools and no tab bar', async () => {
    await onGm();
    const navs = [...main().querySelectorAll('nav')];
    expect(navs.map((n) => n.getAttribute('aria-label'))).toEqual(['Session tools']);
  });

  it('still has a way back to Play, Cards and Build, in MENU', async () => {
    /*
     * The tab bar leaving is only defensible because this exists. A commit that
     * did one without the other would strand a phone in the GM section.
     *
     * The list is read whole and no longer filtered through
     * `['PLAY','CARDS','BUILD']` before being compared to it. That filter made
     * this test structurally incapable of noticing a *fourth* way out - it
     * would have stayed green through the addition of one, which is the
     * opposite of what a test guarding the only exit from a screen is for.
     *
     * SEARCH is deliberately not among them, and that is the fact this now
     * pins rather than hides. The search screen is reachable from the tab bar
     * on every screen that draws one, and the GM screen draws none - but a GM
     * has the rules search already, inside SHOW, on the sheet they are working
     * on. A fourth way out would be a second door to a search this screen
     * already has, and it would take MENU's three destinations from 115.67px
     * across to 84.75.
     */
    await onGm();
    const menu = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').startsWith('MENU'),
    )!;
    expect(menu, 'no MENU button at the top of the GM screen').toBeDefined();
    act(() => {
      menu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const ways = [
      ...container.querySelectorAll('[role="dialog"] [role="group"][aria-label="Leave the GM tools"] button'),
    ].map((b) => (b.textContent ?? '').trim());
    expect(ways).toEqual(['PLAY', 'CARDS', 'BUILD']);

    act(() => {
      [...container.querySelectorAll('[role="dialog"] button')]
        .find((b) => (b.textContent ?? '').trim() === 'CARDS')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useApp.getState().screen).toBe('cards');
  });

  it('puts the tab bar back the moment the GM section is left', async () => {
    await onGm();
    await act(async () => {
      useApp.getState().setScreen('cards');
    });
    await settle(() => main().querySelectorAll('nav').length > 0);
    const navs = [...main().querySelectorAll('nav')];
    expect(navs).toHaveLength(1);
    expect(navs[0]!.getAttribute('aria-label')).not.toBe('Session tools');
  });

  it('leaves the session tools as the last thing in main, so one element pays the inset', async () => {
    await onGm();
    const bar = main().querySelector('nav[aria-label="Session tools"]')!;
    expect(lastInMain(bar), 'something is drawn under the GM bar').toBe(true);
  });

  it('declares the home-indicator inset on that bar, and nowhere else on the screen', async () => {
    /*
     * Read from the DOM now, where this used to have to be read from the
     * source. The old version said, correctly, that jsdom's CSS parser drops
     * `env(...)` - an inline style declaring it reads back as `''`, so an
     * assertion against `style.paddingBottom` would have passed whether the
     * line was there or not - and settled for checking that exactly one of the
     * two *files* contained the string.
     *
     * P5-6 removed the excuse rather than the assertion. The payment is spelled
     * `calc(0px + env(...))` in `GmBar`, which the parser keeps and the browser
     * computes identically, so the real question can be asked of the real tree:
     * how many elements on this screen declare the inset. Two leaves 34px of
     * empty panel between them, none puts the bar under the home indicator.
     *
     * The source check stays as well, one layer down, because a `calc()` that
     * lost its `env()` would still be a padding and would still be one element.
     */
    await onGm();
    const payers = [...main().querySelectorAll<HTMLElement>('*')].filter((el) =>
      (el.getAttribute('style') ?? '').includes('safe-area-inset-bottom'),
    );
    expect(
      payers.map((el) => `${el.tagName}[${el.getAttribute('aria-label') ?? ''}]`),
      'the home-indicator inset is not paid exactly once on the GM screen',
    ).toEqual(['NAV[Session tools]']);

    const src = (path: string): string => readFileSync(join(process.cwd(), 'src', path), 'utf8');
    expect(src('ui/gm/GmBar.tsx')).toContain(
      "paddingBottom: 'calc(0px + env(safe-area-inset-bottom))'",
    );
    expect(
      src('ui/gm/SessionList.tsx'),
      'the session list stopped telling the notice that GmBar is under it, so the notice ' +
        'pays the inset as well and there are 34px of empty panel between them',
    ).toContain('<LicenceFooter pinnedBelow />');
  });
});

describe('the GM section, switched off', () => {
  /** The words on the phone's bottom bar, in order. */
  const tabs = (): string[] =>
    [...main().querySelectorAll('nav button')].map((b) => (b.textContent ?? '').trim());

  /** The words on the desktop header's nav, which is the other navigation. */
  const headerNav = (): string[] =>
    [...container.querySelectorAll('header nav button')].map((b) => (b.textContent ?? '').trim());

  /**
   * Where the app opens, as arithmetic rather than as a mounted screen.
   *
   * Both rules are in one function precisely so their order is a thing that can
   * be asserted, and this file's stake in that order is the *first* one: a
   * stored `'gm'` has to be filtered through `allowedScreen` before anything
   * else looks at it, or switching the section off opens the app on a screen
   * with no tab pointing at it. Both cases below carry `lastScreen: 'gm'` for
   * that reason, and the one with the section off is the one that regresses.
   *
   * ## What changed here, and it is not this file's rule
   *
   * The second rule used to be `if (characterCount === 0) return 'build';`,
   * ahead of everything, and both empty-library cases below therefore expected
   * `'build'`. The onboarding step carved one exception into it - a stored
   * `'gm'` survives an empty library, because the GM screen has never needed a
   * character and is fully usable without one - so `on` with nothing on the
   * device is now `'gm'`. The comment that used to sit on those two lines said
   * the empty-library rule came first "however the last session ended and
   * whatever the GM preference says"; the second half of that is still exactly
   * true, and `off` is still `'build'` because `allowedScreen` makes it so.
   */
  it('opens somewhere that exists, whatever the last screen was', () => {
    const off = { ...DEFAULT_PREFS, lastScreen: 'gm' as const, gmSection: false };
    const on = { ...DEFAULT_PREFS, lastScreen: 'gm' as const, gmSection: true };

    expect(openingScreen(off, 2)).toBe('play');
    expect(openingScreen(on, 2)).toBe('gm');
    // With nothing on the device: a section switched off still cannot be opened
    // on, and a section switched on now survives to the next launch.
    expect(openingScreen(off, 0)).toBe('build');
    expect(
      openingScreen(on, 0),
      'a GM with no characters is handed the character wizard on every launch ' +
        'after the one that asked whose phone this is',
    ).toBe('gm');
    // And nothing else is touched by any of it.
    expect(openingScreen({ ...DEFAULT_PREFS, lastScreen: 'cards' }, 2)).toBe('cards');
    expect(openingScreen({ ...DEFAULT_PREFS, lastScreen: 'cards' }, 0)).toBe('build');
  });

  it('does not open the app on the screen it just took away', async () => {
    // Written to the disk, not to the store: `init` reads `loadPrefs()`, so a
    // preference set in memory would be overwritten by the boot this is about.
    savePrefs({ ...DEFAULT_PREFS, lastScreen: 'gm', gmSection: false });
    await boot();

    expect(useApp.getState().screen, 'the app opened on a screen with no tab').toBe('play');
    expect(text()).toContain('EVASION');
    expect(tabs()).toEqual(['PLAY', 'CARDS', 'BUILD', 'SEARCH']);
  });

  it('draws Play rather than nothing if the store is told GM anyway', async () => {
    /*
     * The running half of the same rule, and it fails differently from the one
     * above: `setScreen` accepts all six whatever the preferences say, and the
     * section can be switched off from Settings in the middle of a session. A
     * shell that only gated the *boot* would answer that with a header, a
     * bottom bar, and 700px of nothing between them.
     */
    savePrefs({ ...DEFAULT_PREFS, gmSection: false });
    await boot();
    await act(async () => {
      useApp.getState().setScreen('gm');
    });
    await settle();

    expect(useApp.getState().screen, 'the store refused the value, so this proves nothing').toBe(
      'gm',
    );
    expect(text(), 'the GM screen was drawn behind a switched-off section').not.toContain(
      'Nothing planned yet',
    );
    expect(text(), 'the shell drew nothing at all').toContain('EVASION');
  });

  it('takes the desktop header entry with it, and not only the phone tab', async () => {
    setDesktop();
    savePrefs({ ...DEFAULT_PREFS, gmSection: false });
    await boot();

    expect(headerNav()).toEqual(['Play', 'Cards', 'Build', 'Search']);
    // The door to Settings is not in that nav and has to survive: it is the
    // only permanent route there, and this is the screen a person switches the
    // section back on from.
    expect(text()).toContain('SETTINGS');
  });

  it('is five tabs and a GM entry again with the default preferences', async () => {
    await boot();
    expect(tabs()).toEqual(['PLAY', 'CARDS', 'BUILD', 'GM', 'SEARCH']);

    act(() => root.unmount());
    root = createRoot(container);
    setDesktop();
    await boot();
    expect(headerNav()).toEqual(['Play', 'Cards', 'Build', 'GM', 'Search']);
  });
});

describe('where the licence notice went', () => {
  it('is on the GM screen, inside the scroll rather than pinned under it', async () => {
    await onGm();
    expect(text(), 'the GM screen lost the licence notice').toContain(NOTICE);
    // Pinned, it is a direct child of `<main>`. Here it is the last block of
    // the session list's scroll region.
    expect(
      container.querySelector('main > footer'),
      'the notice is pinned on the GM screen, in the arc the bar was placed in',
    ).toBeNull();
    const footer = container.querySelector('footer')!;
    expect(footer.closest('.scroll'), 'the notice is not inside a scrolling region').not.toBeNull();
  });

  /*
   * REVERSED, RATHER THAN DELETED. This test used to read:
   *
   *   it('is still pinned on Cards, which has no bottom bar of its own', ...)
   *     expect(container.querySelector('main > footer')).not.toBeNull();
   *
   * and it was true and deliberate: the GM screen took the notice into its
   * scroll because it had chrome at both ends, and the other four kept the
   * pinned strip. P5-6 is the owner deciding that the reason the GM screen had
   * was a reason every screen has - *"i crediti in basso devono essere visibili
   * scorrendo alla fine di ogni pagina, non fisso"* - so the assertion is
   * inverted rather than dropped. `attribution.test.tsx` is where the full
   * sweep lives; this keeps the one screen this file is about honest about
   * being no longer special.
   */
  it('is no longer pinned on Cards either, which is what stopped the GM screen being special', async () => {
    await mountOn('cards', () => text().includes(NOTICE));
    expect(
      container.querySelector('main > footer'),
      'Cards has gone back to a pinned licence strip, which is at least the 126.16px this ' +
        'notice measures on a 369px column at 393x852 - a pinned one also paints a panel and ' +
        'its own padding - spent permanently on something a reader looks at once',
    ).toBeNull();
    expect(
      container.querySelector('footer')!.closest('.scroll'),
      'the notice on Cards is neither pinned nor in the scroll, so it is nowhere',
    ).not.toBeNull();
  });
});
