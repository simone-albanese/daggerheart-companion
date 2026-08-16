// @vitest-environment jsdom
/**
 * Is the shell plugged in?
 *
 * `screens.test.tsx` asks whether every component *renders*. This asks the
 * other question, the one four shipped defects turned on: whether the app
 * actually reaches the code that is supposed to be protecting it. Two of them
 * live here.
 *
 * A refused write had no signal at all - `flush` threw into a promise nobody
 * held while the sheet kept showing every change as applied. And the whole
 * automatic-backup regime (`installBackupHooks`, `backupAtSessionEnd`,
 * `noteSession`, `integrityCheck`) had no caller anywhere in `src`, while the
 * settings screen told the user a copy was being written at the end of every
 * session. Rollup tree-shook the lot: `page-hide` and `knownCharacterIds` did
 * not appear anywhere in `dist/assets`.
 *
 * So these mount the real `App` and drive the real events.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../../src/store/db.ts';
import { useApp } from '../../src/store/state.ts';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/**
 * jsdom under this runner has no `localStorage` at all, and both preferences
 * and the backup record live there. Without one the seven-day check has nothing
 * to compare against and quietly reports that there is nothing to check.
 */
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
  // The store, the database and localStorage are all module state shared by
  // every test in this file, and the backup record lives in the third of them.
  vi.stubGlobal('localStorage', new MemoryStorage());
  useApp.setState({
    ready: false,
    storageError: null,
    writeError: null,
    quarantined: [],
    characters: [],
    activeId: null,
    screen: 'play',
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

async function settle(until: () => boolean = () => true, turns = 50): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

async function mount(): Promise<void> {
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
}

const text = (): string => container.textContent ?? '';

const buttonNames = (): string[] =>
  [...container.querySelectorAll('button')].map((b) => b.textContent ?? '');

describe('a write that did not reach the disk', () => {
  it('says so, and offers the one thing that still helps', async () => {
    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      useApp.setState({
        writeError: {
          message: 'This device is out of space, so the last 3 changes could not be saved.',
          count: 3,
          kind: 'quota',
        },
      });
    });

    expect(text(), 'a failed write puts nothing on screen').toMatch(/3 CHANGES ARE NOT SAVED/);
    expect(text()).toMatch(/out of space/);
    expect(
      buttonNames().join(' | '),
      'the alert says work is unsaved and gives no way to save it',
    ).toMatch(/SAVE A COPY NOW/);
  });

  it('never reuses the storage banner’s copy, which says the opposite of the truth', async () => {
    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      useApp.setState({
        storageError: 'This browser’s storage did not respond',
        writeError: { message: 'The last change could not be written.', count: 1, kind: 'other' },
      });
    });

    // "Close the other tabs and reload; nothing has been written in the
    // meantime" is an invitation to throw away exactly the work the alert
    // above it is about.
    expect(
      text(),
      'the app tells a user with unsaved work that nothing has been written, and to reload',
    ).not.toMatch(/nothing has been written in the meantime/);
    expect(text(), 'the storage banner is gone as well as its promise').toMatch(
      /Close the other tabs and reload/,
    );
  });

  it('keeps saying it: an alert about unsaved work has no dismiss', async () => {
    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      useApp.setState({
        writeError: { message: 'The last change could not be written.', count: 1, kind: 'other' },
      });
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert, 'the unsaved-work alert is not an alert').not.toBeNull();
    expect(
      [...alert!.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent),
      'a dismissable warning about unsaved work is the false reassurance this app forbids',
    ).toEqual(['SAVE A COPY NOW']);
  });
});
