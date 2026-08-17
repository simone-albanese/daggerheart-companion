// @vitest-environment jsdom
/**
 * Is the licence notice actually on the screen?
 *
 * It was, once, for as long as somebody had no characters. `<Attribution />`
 * lived inside `EmptyState`, `EmptyState` renders only while the library is
 * empty, and creating a character is the first thing every user does - so the
 * DPCGL notice and the Daggerheart Compatible lockup left the app permanently
 * at the end of the first minute anyone spent in it, and the only remaining
 * copy was at the bottom of Settings. Meanwhile `Architecture.md` said twice
 * that the attribution is *"sempre visibile nel footer"* and there was no
 * `<footer>` in the app at all.
 *
 * Nothing fails at a table over that. What it risks is the project: if the
 * licence requires the notice to be *displayed* rather than merely available,
 * every install past the first character is out of compliance, and the remedy
 * for that is a takedown.
 *
 * So this file asks the questions no unit test can:
 *
 *   1. does the string reach the DOM, on **every** screen, with a character in
 *      the library - which is the state the old code failed in;
 *   2. is it in a region that scrolls, as the last thing in it, rather than in
 *      a strip pinned above the tab bar;
 *   3. is there exactly one copy of it in `src`, so that a refactor of any one
 *      surface cannot quietly drop the notice with CI green. There were two
 *      before this, in `About.tsx` and `CompatibleMark.tsx`, normalising to the
 *      same 342 characters with nothing pinning them together - and About.tsx
 *      is on the P4 work list.
 *
 * ## What P5-6 changed here, and why it is a strengthening rather than a fit
 *
 * Until P5-6 this file asserted the notice on four screens of five and then
 * asserted, in `stays out of Play`, that it was deliberately absent from the
 * fifth - the screen the README says is open ninety per cent of the time. That
 * exemption was argued on a height budget for a *pinned* strip, and the owner's
 * decision removes the strip: the notice is now the last thing in each screen's
 * own scrolling content, where on Play it sits below every fold and costs the
 * sheet nothing. So the exemption is gone, and with it the one assertion in
 * this file that said the licence did not have to be displayed somewhere.
 *
 * Both new questions are written from what the licence needs rather than from
 * what was built. The DPCGL asks for the notice to be *displayed*: a screen
 * that never shows it fails that outright, which is question 1 extended to
 * five. And a notice a layout budget can argue away is a notice with a shelf
 * life - a pinned strip costs a band on every frame, so there is always a next
 * pass with a reason to drop it, and that is exactly how Play came to have
 * none. Inside the scroll it costs a scroll position, which nobody ever needs
 * to reclaim. Question 2 is that property, pinned.
 *
 * ## And exactly one thing per screen pays the home-indicator inset
 *
 * Not a licence question, but it is the one this move is easy to get wrong on,
 * and now that there are seven call sites it is worth a sweep rather than an
 * argument. Paid twice it leaves 34px of empty panel between two bars; paid
 * never it tucks the last row of the window under the indicator. The count is
 * read off the real tree, which only became possible when the three bars that
 * pay it started spelling it `calc(0px + env(...))` - jsdom's CSS parser drops
 * a bare `env()`, so before P5-6 no assertion on it could ever have failed.
 */
import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp, type Screen } from '../../src/store/state.ts';
import { ATTRIBUTION } from '../../src/ui/shared/CompatibleMark.tsx';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** The notice as one paragraph, which is the form About and the footer render. */
const NOTICE = ATTRIBUTION.join(' ');

/**
 * The half that is the copyright notice proper, and the probe that works on
 * every surface: `EmptyState` sets the two sentences as two `<p>` elements, so
 * its `textContent` runs them together with no separator and the joined form
 * above does not appear in it.
 */
const NOTICE_HEAD = ATTRIBUTION[0];

let container: HTMLDivElement;
let root: Root;

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

/** Answer media queries as a viewport of this width would. */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) || (min !== null && width >= Number(min[1])),
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

beforeAll(() => {
  setViewport(1024);
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  setViewport(1024);
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

/**
 * The three screens `App.tsx` code-splits, by the specifier it splits them on.
 *
 * This file has to wait for the chunk explicitly, and the reason is worth
 * writing down because it made the licence check answer differently depending
 * on how it was run. `App` mounts Build, GM and Settings behind `lazy()`, so
 * arriving on one of them renders a `<Suspense>` fallback until the dynamic
 * import settles. `settle` below spends macrotask turns waiting, and a turn
 * budget is a stopwatch, not a condition: run with the whole suite, another
 * file has already paid Vite's transform cost for the GM tree and the import
 * lands in a turn or two; run `npx vitest run tests/ui/attribution.test.tsx` on
 * its own and the transform happens here for the first time, the 120 turns
 * expire with the fallback still on screen, and "is on the gm screen" fails
 * saying the GM screen carries no licence notice.
 *
 * That is a false alarm - `SessionList.tsx` renders `<LicenceFooter>`
 * unconditionally inside the GM scroll - and it is the worst possible one to
 * have here. This is the file standing between the project and a DPCGL
 * takedown, and running exactly this file is what anybody would do to check
 * the notice. A guard that cries wolf alone and is quiet in company teaches
 * people to disbelieve it.
 *
 * So the wait is on the module rather than on the clock: awaiting the same
 * specifier `App.tsx` awaits puts it in the runner's cache, and `lazy()` then
 * resolves out of it. Nothing is asserted more weakly - the assertions below
 * are untouched and still run against the real shell, mounted for real. What
 * changed is that they run after the screen exists rather than after 120 turns.
 */
const CHUNK: Partial<Record<Screen, () => Promise<unknown>>> = {
  build: () => import('../../src/ui/build/Build.tsx'),
  gm: () => import('../../src/ui/gm/Gm.tsx'),
  settings: () => import('../../src/ui/settings/Settings.tsx'),
};

/** Boot the real shell with one character in the library, on `screen`. */
async function mountOn(screen: Screen): Promise<void> {
  await db.putCharacter(playedCharacter());
  await CHUNK[screen]?.();
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
  await act(async () => {
    useApp.getState().setScreen(screen);
  });
  // The chunk is in the cache by now; `lazy()` still resolves on a microtask
  // and Suspense still needs the re-render, so the turns are still spent.
  await settle(() => text().includes(NOTICE));
}

/**
 * Every screen the app has. Not a list of the ones that happen to carry the
 * notice - that list *was* four of these, and Play's absence from it is the
 * defect P5-6 fixed. If a sixth screen is ever added it belongs here on the day
 * it is added, and this file failing is the correct way to find that out.
 */
const SCREENS = ['play', 'cards', 'build', 'gm', 'settings'] as const;

/**
 * The one `<footer>` in the shell, which is the notice.
 *
 * Asserted to be one rather than taken as the first, because two would be the
 * same failure as none: the notice printed twice on one screen is 684
 * characters of a phone, and whichever of them a later refactor deletes, the
 * test that reads `[0]` goes on passing.
 */
function theNotice(): HTMLElement {
  const footers = [...container.querySelectorAll<HTMLElement>('footer')];
  expect(footers, 'the shell draws no <footer>, or draws more than one').toHaveLength(1);
  return footers[0]!;
}

/**
 * Every element in the mounted shell whose inline style declares the
 * home-indicator inset.
 *
 * Readable from the DOM only because the three bars that pay it spell it
 * `calc(0px + env(...))`: jsdom's CSS parser drops a bare `env()`, and drops
 * any shorthand containing one, so the declaration used to read back as `''`.
 */
function insetPayers(): string[] {
  return [...container.querySelectorAll<HTMLElement>('*')]
    .filter((el) => (el.getAttribute('style') ?? '').includes('safe-area-inset-bottom'))
    .map((el) => {
      const name = el.getAttribute('aria-label');
      return name === null ? el.tagName : `${el.tagName}[${name}]`;
    });
}

describe('the notice, once there is a character', () => {
  // The regression in one line: every one of these screens showed the notice
  // only while `characters.length === 0`. Play showed it in no state at all
  // until P5-6, which is why it is in this loop now and not exempted below it.
  for (const screen of SCREENS) {
    it(`is on the ${screen} screen`, async () => {
      await mountOn(screen);
      expect(
        text(),
        `the ${screen} screen carries no licence notice with a character in the library, ` +
          'which is the state every real install is in from the first minute onwards',
      ).toContain(NOTICE);
    });
  }

  it('is inside a real <footer>, which Architecture.md has claimed twice and the app never had', async () => {
    await mountOn('cards');
    const footer = container.querySelector('footer');
    expect(footer, 'there is still no <footer> in the app shell').not.toBeNull();
    expect(footer!.textContent ?? '').toContain(NOTICE);
  });

  it('keeps the mark on the screen with the words', async () => {
    await mountOn('cards');
    const marks = [...container.querySelectorAll('img')].filter(
      (img) => img.getAttribute('alt') === 'Daggerheart Compatible',
    );
    expect(marks.length, 'the notice is on screen without the compatibility mark').toBeGreaterThan(
      0,
    );
  });

  /*
   * REPLACES `stays out of Play, where the mark carries it alone`.
   *
   * That test asserted the exemption rather than assuming it, which was the
   * right way to hold a decision that has now been reversed. What it said:
   *
   *   > "The deliberate exception, asserted rather than assumed. Verbatim, the
   *   > notice is 342 characters: six lines and ~111px at 11.5px on a 393px
   *   > phone, two lines and ~48px on a tablet. Play is laid out to fit rather
   *   > than to flow and has been fought over for two passes, so it does not
   *   > pay that - and `CompatibleIcon` is in the header on every screen, Play
   *   > included, so the mark itself never leaves."
   *
   * Every number in it is the cost of a *pinned* strip, and there is no longer
   * one anywhere in the app. Below the last shut fold of a scrolling sheet the
   * notice takes none of the 730px column `playSheet.test.tsx` budgets; it is
   * simply the last thing you reach if you keep scrolling. So the exemption is
   * deleted and this is what stands in its place - the same screen, the same
   * mount, asking that the notice is there *and* that it is not costing Play a
   * band, which is the half of the old argument that still has to be true.
   */
  it('is on Play at the end of the scroll, and takes no band off the sheet', async () => {
    await db.putCharacter(playedCharacter());
    await act(async () => {
      root.render(createElement(App));
    });
    await settle(() => useApp.getState().ready);
    await act(async () => {
      useApp.getState().setScreen('play');
    });
    await settle(() => text().includes(NOTICE));

    expect(useApp.getState().screen).toBe('play');
    expect(
      text(),
      'Play carries no licence notice. It is the screen the README says is open ninety per ' +
        'cent of the time, so a DPCGL notice that is not on it is a notice most sessions ' +
        'never display at all.',
    ).toContain(NOTICE);
    expect(
      container.querySelector('main > footer'),
      'the licence strip is pinned again, and on Play that is a band off the tightest ' +
        'height budget in the app',
    ).toBeNull();
    expect(
      [...container.querySelectorAll('img')].some(
        (img) => img.getAttribute('alt') === 'Daggerheart Compatible',
      ),
      'Play has the notice but not the mark',
    ).toBe(true);
  });
});

/**
 * WHERE THE NOTICE IS, WHICH IS THE HALF THAT DECIDES WHETHER IT SURVIVES.
 *
 * A notice in the DOM is the licence's question. A notice in a *scroll* is the
 * question of whether it will still be in the DOM in six months, and it is not
 * a rhetorical one: the pinned strip cost every screen it was on ~111px of a
 * 393px phone on every frame, so every layout pass since had a reason to argue
 * it away - and one of them won, which is how Play came to have none. Inside
 * the scroll it costs a scroll position, and nobody has ever needed to reclaim
 * one of those.
 */
describe('the notice sits at the end of a scrolling region, on every screen', () => {
  for (const screen of SCREENS) {
    it(`is the last thing in ${screen}'s own scroll`, async () => {
      await mountOn(screen);
      const footer = theNotice();

      expect(
        container.querySelector('main > footer'),
        `the notice on ${screen} is a pinned sibling of the screen again, which is the ` +
          'strip P5-6 removed: it costs the screen a band on every frame instead of a ' +
          'scroll position once',
      ).toBeNull();

      const scroll = footer.closest('.scroll');
      expect(
        scroll,
        `the notice on ${screen} is not inside a scrolling region at all, so it is neither ` +
          'pinned nor reachable by scrolling to the end of the page',
      ).not.toBeNull();

      // Last, not merely present. A notice in the middle of a screen's content
      // is a block of legal text between two things somebody is using.
      const within = [...scroll!.querySelectorAll<HTMLElement>('*')];
      const after = within.slice(within.indexOf(footer) + 1).filter((el) => !footer.contains(el));
      expect(
        after.map((el) => `${el.tagName}.${el.className || '(none)'}`),
        `these are drawn after the notice inside ${screen}'s scroll, so it is not the last ` +
          'thing on the page any more',
      ).toEqual([]);
    });
  }
});

/**
 * `env(safe-area-inset-bottom)`, paid exactly once per screen.
 *
 * Three things can be last in the window and each pays it where it is: the
 * shell's `TabBar` on a phone, `GmBar` inside the GM section at every width,
 * the wizard's and the level-up's navigation rows on Build, and the notice
 * itself where there is none of those. Paid twice it leaves 34px of empty panel
 * between two bars; paid never it puts the last row of the window under the
 * home indicator.
 *
 * This is a sweep rather than a check on `LicenceFooter`, because the failure
 * mode is a *pair* and either half of it can be the new one.
 */
describe('the home-indicator inset', () => {
  /** A phone, where `TabBar` is drawn, and a tablet, where it is not. */
  for (const width of [393, 1024]) {
    for (const screen of SCREENS) {
      const expected =
        screen === 'gm' ? 'NAV[Session tools]' : width === 393 ? 'NAV' : 'FOOTER';
      it(`is paid once on ${screen} at ${String(width)}px, by ${expected}`, async () => {
        setViewport(width);
        await mountOn(screen);
        expect(
          insetPayers(),
          'the home-indicator inset is not paid exactly once by the thing that is last in ' +
            'the window. Two payments are 34px of empty panel; none tucks the last row ' +
            'under the indicator.',
        ).toEqual([expected]);
      });
    }
  }

  /*
   * Build's other two modes, which are the two places in the app where a screen
   * pins chrome of its own under its scroll and is not the GM section. Both
   * navs had gone their whole life without paying the inset and had never
   * needed to, because the shell drew the licence strip underneath them. With
   * the strip gone they are last, and they say so.
   */
  it('is paid by the wizard’s nav, on the first screen a new device ever shows', async () => {
    setViewport(1024);
    // No character at all: `openingScreen` sends an empty library to Build, and
    // Build with an empty library is the wizard.
    await act(async () => {
      root.render(createElement(App));
    });
    await settle(() => useApp.getState().ready);
    await act(async () => {
      useApp.getState().setScreen('build');
    });
    await settle(() => text().includes(NOTICE));
    expect(text(), 'the wizard lost the licence notice').toContain(NOTICE);
    expect(insetPayers()).toEqual(['NAV[Wizard navigation]']);
  });

  it('is paid by the level-up’s nav, which is the other bar under a scroll', async () => {
    setViewport(1024);
    await mountOn('build');
    const up = [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      (b.textContent ?? '').startsWith('Level up to'),
    );
    expect(up, 'Build no longer offers a level-up, so this test is testing nothing').toBeDefined();
    await act(async () => {
      up!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle(() => text().includes('Tier achievement'));
    expect(text(), 'the level-up lost the licence notice').toContain(NOTICE);
    expect(insetPayers()).toEqual(['NAV']);
  });
});

describe('the first-run screen', () => {
  it('still carries it, and does not print it twice', async () => {
    await act(async () => {
      root.render(createElement(App));
    });
    await settle(() => useApp.getState().ready);
    await act(async () => {
      useApp.getState().setScreen('cards');
    });
    await settle(() => text().includes('No character yet'));

    expect(text(), 'the empty state lost the notice').toContain(NOTICE_HEAD);
    // `EmptyState` renders on play and on cards, and the footer renders on
    // cards: without the stand-down the same 342 characters appear twice.
    const copies = (
      text().match(new RegExp(NOTICE_HEAD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []
    ).length;
    expect(copies, 'the notice is on the empty state twice').toBe(1);
  });
});

// ---------------------------------------------------------------------------

// `process.cwd()` rather than `import.meta.url`: under the jsdom environment
// this file needs, `import.meta.url` is not a file: URL and `fileURLToPath`
// throws at collection time.
const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('how many copies of it there are', () => {
  it('declares the notice in exactly one module', () => {
    // Matched on the opening clause rather than the whole string, because the
    // two copies that existed were wrapped differently - one an array of two
    // sentences, the other a `+`-concatenated paragraph - and a check that only
    // caught byte-identical twins would have caught neither.
    const declaring = sourceFiles(SRC)
      .filter((path) =>
        /['`]This product includes materials from the Daggerheart/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map((path) => relative(SRC, path).split(sep).join('/'));

    expect(
      declaring,
      'the licence notice is written out as a literal in more than one place:\n' +
        declaring.map((f) => `  ${f}`).join('\n') +
        '\n\nTwo copies of a licence notice with nothing pinning them together is one ' +
        'refactor away from an app that ships the wrong one, or none.',
    ).toEqual(['ui/shared/CompatibleMark.tsx']);
  });
});
