// @vitest-environment jsdom
/**
 * What happens when the *shell* throws, rather than a screen?
 *
 * `ScreenBoundary` wraps each of the five screens, which is what a reader of
 * `App.tsx` sees and stops reading. It is mounted by `App`, so everything at or
 * above App's own render is outside it: `useStats()`, which derives a whole
 * sheet in that render; `Header`; `TabBar`; the storage, unsaved-work,
 * quarantine and integrity banners; `CardReader`; the licence footer. A throw
 * in any of those was a white page.
 *
 * P3-1's fifth bullet found no reachable throw up there and neither did this,
 * so the boundary is hardening. Which makes the fallback the part that matters:
 * a white page is survivable, and a white page that a worried user answers by
 * clearing site data is not - IndexedDB goes with it. So the one control it
 * draws writes a file, unconditionally.
 *
 * The tests here throw on purpose from inside the boundary. `console.error` is
 * silenced while they run, because React reports a caught render error there
 * and the sibling suite treats any React console output as a failure.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { AppBoundary } from '../../src/ui/shell/AppBoundary.tsx';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function settle(until: () => boolean = () => true, turns = 60): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

const text = (): string => container.textContent ?? '';

const buttonNames = (): string[] =>
  [...container.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());

function press(label: string): void {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  expect(button, `no button says "${label}" — found: ${buttonNames().join(' | ')}`).toBeDefined();
  button!.click();
}

/** A component whose render throws, the way a bad derive in the shell would. */
function Detonate({ message }: { message: string }): React.JSX.Element {
  throw new Error(message);
}

async function render(element: ReactElement): Promise<void> {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => {
    root.render(element);
  });
  await settle();
}

describe('a throw above every screen', () => {
  it('draws something rather than a white page', async () => {
    await render(
      createElement(AppBoundary, null, createElement(Detonate, { message: 'useStats blew up' })),
    );

    expect(
      text().trim().length,
      'the shell threw and the page is empty, which is the state this exists to prevent',
    ).toBeGreaterThan(40);
    expect(text()).toContain('useStats blew up');
    expect(container.querySelector('[role="alert"]'), 'the failure is not announced').not.toBeNull();
  });

  it('offers the export unconditionally, with nothing in the library and no folder chosen', async () => {
    await render(
      createElement(AppBoundary, null, createElement(Detonate, { message: 'boom' })),
    );

    expect(
      buttonNames().join(' | '),
      'the app died and gave the user no way to get their characters out — the next thing ' +
        'a worried person does is clear site data, and IndexedDB goes with it',
    ).toContain('Export everything');
  });

  it('says what the export actually did, rather than that it happened', async () => {
    // No characters at all. `runBackup` writes nothing and says so, and the
    // fallback has to repeat its answer rather than invent a reassuring one.
    await render(createElement(AppBoundary, null, createElement(Detonate, { message: 'boom' })));

    await act(async () => {
      press('Export everything');
    });
    await settle(() => text().includes('no characters'));

    expect(
      text(),
      'the export button reported success over a file that was never written',
    ).toContain('There are no characters to back up yet.');
  });

  it('writes a real file when there is something to write', async () => {
    const written: string[] = [];
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockResolvedValue({
        name: 'daggerheart-backup.dhbackup',
        createWritable: () =>
          Promise.resolve({
            write: (t: string) => {
              written.push(t);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      }),
    );
    const character = playedCharacter();
    await db.putCharacter(character);
    useApp.setState({ ready: true, characters: [character], activeId: character.id });

    await render(createElement(AppBoundary, null, createElement(Detonate, { message: 'boom' })));
    await act(async () => {
      press('Export everything');
    });
    await settle(() => written.length > 0);

    expect(written, 'the fallback pressed its own button and no bytes reached a file').toHaveLength(
      1,
    );
    expect(written[0]).toContain(character.name);
    expect(text()).toMatch(/Saved .* — 1 character\./);
  });

  it('lets the user out again', async () => {
    await render(createElement(AppBoundary, null, createElement(Detonate, { message: 'boom' })));
    expect(buttonNames()).toContain('Try again');
  });
});

describe('where the boundary sits', () => {
  /**
   * The load-bearing structural fact, asserted rather than trusted: the
   * boundary has to be above the component that calls `useStats`, and the
   * obvious refactor - `<AppBoundary>` inside the same component that does the
   * work - type-checks, renders identically, and catches nothing.
   *
   * `useStats` is mocked to throw, which is the exact shape of the hazard: it
   * runs in the shell's own render, outside every `ScreenBoundary`.
   */
  it('catches a throw from useStats, which runs in the shell’s own render', async () => {
    const state = await import('../../src/store/state.ts');
    vi.spyOn(state, 'useStats').mockImplementation(() => {
      throw new Error('derive failed for the active character');
    });

    const character = playedCharacter();
    await db.putCharacter(character);
    await render(createElement(App));
    await settle(() => text().includes('derive failed'));

    expect(
      text(),
      'a throw from useStats takes the whole app down with no way to export',
    ).toContain('derive failed for the active character');
    expect(buttonNames().join(' | ')).toContain('Export everything');
  });
});
