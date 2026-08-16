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
 * So this file asks the two questions no unit test can:
 *
 *   1. does the string reach the DOM, on each screen that has to carry it, with
 *      a character in the library - which is the state the old code failed in;
 *   2. is there exactly one copy of it in `src`, so that a refactor of any one
 *      surface cannot quietly drop the notice with CI green. There were two
 *      before this, in `About.tsx` and `CompatibleMark.tsx`, normalising to the
 *      same 342 characters with nothing pinning them together - and About.tsx
 *      is on the P4 work list.
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

/** Boot the real shell with one character in the library, on `screen`. */
async function mountOn(screen: Screen): Promise<void> {
  await db.putCharacter(playedCharacter());
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
  await act(async () => {
    useApp.getState().setScreen(screen);
  });
  // Build, GM and Settings are `lazy()`; the dynamic import needs turns.
  await settle(() => text().includes(NOTICE));
}

describe('the notice, once there is a character', () => {
  // The regression in one line: every one of these screens showed the notice
  // only while `characters.length === 0`.
  for (const screen of ['cards', 'build', 'gm', 'settings'] as const) {
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

  it('stays out of Play, where the mark carries it alone', async () => {
    // The deliberate exception, asserted rather than assumed. Verbatim, the
    // notice is 342 characters: six lines and ~111px at 11.5px on a 393px
    // phone, two lines and ~48px on a tablet. Play is laid out to fit rather
    // than to flow and has been fought over for two passes, so it does not pay
    // that - and `CompatibleIcon` is in the header on every screen, Play
    // included, so the mark itself never leaves.
    await db.putCharacter(playedCharacter());
    await act(async () => {
      root.render(createElement(App));
    });
    await settle(() => useApp.getState().ready);
    await act(async () => {
      useApp.getState().setScreen('play');
    });
    await settle(() => text().length > 200);

    expect(useApp.getState().screen).toBe('play');
    expect(
      container.querySelector('main > footer'),
      'the licence strip is taking vertical space from Play',
    ).toBeNull();
    expect(
      [...container.querySelectorAll('img')].some(
        (img) => img.getAttribute('alt') === 'Daggerheart Compatible',
      ),
      'Play has neither the notice nor the mark, which leaves it with nothing at all',
    ).toBe(true);
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
