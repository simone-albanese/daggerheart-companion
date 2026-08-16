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
import { chooseBackupFolder, forgetBackupFolder } from '../../src/store/backup.ts';
import { appBackupDeps } from '../../src/store/backupDeps.ts';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS, loadPrefs } from '../../src/store/prefs.ts';
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
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  // The chosen folder is module state as well: `backup.ts` holds it for the
  // session, so a folder picked by one test would silently take the writes of
  // the next one. After the reset above, or it writes the *previous* test's
  // preferences back into the fresh storage on its way out.
  await forgetBackupFolder(appBackupDeps);
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

function press(label: string): void {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  expect(button, `no button on screen says "${label}" — found: ${buttonNames().join(' | ')}`).toBeDefined();
  button!.click();
}

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

describe('the automatic backup', () => {
  /** A folder handle the app can actually write into, as `Settings` would pick. */
  function fakeFolder(): Map<string, string> {
    const files = new Map<string, string>();
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn().mockResolvedValue({
        name: 'Daggerheart',
        getFileHandle: (fileName: string) =>
          Promise.resolve({
            name: fileName,
            createWritable: () =>
              Promise.resolve({
                write: (text: string) => {
                  files.set(fileName, text);
                  return Promise.resolve();
                },
                close: () => Promise.resolve(),
              }),
            getFile: () =>
              Promise.resolve({ text: () => Promise.resolve(files.get(fileName) ?? '') }),
          }),
      }),
    );
    return files;
  }

  it('writes a copy when the page goes away, which nothing in the app ever asked it to do', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(appBackupDeps);

    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await settle(() => files.size > 0, 80);

    expect(
      [...files.keys()],
      'the page went away and the app wrote no backup, while Settings says it does',
    ).toHaveLength(1);
    expect([...files.keys()][0]).toMatch(/^daggerheart-backup-\d{4}-\d{2}-\d{2}\.dhbackup$/);
  });

  it('takes its listeners with it when the shell goes, so a second mount is not a second backup', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(appBackupDeps);

    await db.putCharacter(playedCharacter());
    await mount();
    act(() => root.unmount());

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await settle(() => false, 20);

    expect(
      files.size,
      'the disposer was dropped, so every mount leaves a listener behind and the next event runs N backups',
    ).toBe(0);

    // The shared afterEach unmounts too; give it something that is still there.
    root = createRoot(container);
  });

  it('writes down what was on the disk, so the next launch has something to compare against', async () => {
    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await settle(() => localStorage.getItem('dhc.backup.v1') !== null, 80);

    const record = JSON.parse(localStorage.getItem('dhc.backup.v1') ?? '{}') as {
      knownCharacterIds?: string[];
    };
    expect(
      record.knownCharacterIds,
      'the app went away without noting what was here, so the seven-day check has nothing to compare against',
    ).toHaveLength(1);
  });
});

describe('the seven-day check', () => {
  it('says what is missing, and offers the screen that can put it back', async () => {
    // Last session, nine days ago, left two characters behind and a backup to
    // restore from. This launch has neither.
    const gone = playedCharacter();
    localStorage.setItem(
      'dhc.backup.v1',
      JSON.stringify({
        lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        knownCharacterIds: [gone.id, 'a-second-character'],
      }),
    );
    // Through the store, because that is the one writer of the preferences now
    // and `integrityCheck` reads them from where they are actually kept.
    useApp.getState().setPrefs({ lastBackupAt: new Date().toISOString() });

    await mount();
    await settle(() => text().includes('SOMETHING IS MISSING'), 80);

    expect(
      text(),
      'two characters vanished between sessions and the app said nothing about it',
    ).toMatch(/2 characters that were here at the end of the last session are not on this device now/);
    expect(text()).toMatch(/about a week/);
    expect(buttonNames().join(' | ')).toMatch(/RESTORE FROM A BACKUP/);
  });

  it('does not offer a restore it cannot make', async () => {
    localStorage.setItem(
      'dhc.backup.v1',
      JSON.stringify({
        lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        knownCharacterIds: ['a-character-that-is-gone'],
      }),
    );

    await mount();
    await settle(() => text().includes('SOMETHING IS MISSING'), 80);

    expect(text()).toMatch(/no backup to restore from/);
    expect(
      buttonNames().join(' | '),
      'the app offered to restore from a backup that does not exist',
    ).not.toMatch(/RESTORE FROM A BACKUP/);
  });

  it('stays quiet when nothing is missing', async () => {
    const here = playedCharacter();
    await db.putCharacter(here);
    localStorage.setItem(
      'dhc.backup.v1',
      JSON.stringify({
        lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        knownCharacterIds: [here.id],
      }),
    );

    await mount();
    await settle(() => false, 30);

    expect(text()).not.toMatch(/SOMETHING IS MISSING/);
  });
});

describe('the backup clock', () => {
  /**
   * The manual backup that *does* run lost its own stamp on the next tab tap.
   *
   * `runBackup` wrote `lastBackupAt` straight to localStorage through its
   * default deps, while `state.setPrefs` merges each patch onto the copy the
   * store loaded at launch — which never received the stamp — and writes the
   * whole key back. Every `setScreen` calls `setPrefs`. So `daysSinceBackup`
   * stayed `null` forever, and the phone banner, which only appears from five
   * days, could never appear at all.
   */
  it('survives the next screen change, because one thing writes the preferences', async () => {
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

    await db.putCharacter(playedCharacter());
    await mount();

    await act(async () => {
      useApp.getState().setScreen('settings');
    });
    // Settings is `lazy()`, and the dynamic import needs more turns than the
    // default here before there is a button to press at all.
    await settle(() => text().includes('Back up everything'), 120);

    await act(async () => {
      press('Back up everything');
    });
    await settle(() => useApp.getState().prefs.lastBackupAt !== undefined, 80);

    const stamped = useApp.getState().prefs.lastBackupAt;
    expect(written, 'the backup never wrote anything, so this proves nothing').toHaveLength(1);
    expect(
      stamped,
      'the backup that just ran did not reach the copy of the preferences the app reads',
    ).toBeDefined();

    await act(async () => {
      useApp.getState().setScreen('play');
    });

    expect(
      loadPrefs().lastBackupAt,
      'a tab tap destroyed the stamp of the backup the user had just taken',
    ).toBe(stamped);
    expect(
      useApp.getState().prefs.lastBackupAt,
      'the store and localStorage disagree about when the last backup was',
    ).toBe(loadPrefs().lastBackupAt);
  });
});

describe('the backup nag, on a phone', () => {
  /** Answer media queries as a 390px viewport would. */
  function phoneViewport(): void {
    window.matchMedia = ((query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query);
      return {
        matches: max !== null && 390 <= Number(max[1]),
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

  /**
   * The one user who most needs telling was the one a phone never told.
   *
   * The gate read `days >= 5` with no clause for *never*, and `daysSinceBackup`
   * returns null when there is no stamp. So a phone showed nothing on day 1 and
   * nothing on day 90 — and because the stamp was being destroyed by the next
   * tab tap anyway, "never" was the state every phone was permanently in.
   */
  it('tells a user who has never backed up anything', async () => {
    phoneViewport();
    await db.putCharacter(playedCharacter());
    await mount();
    await settle(() => text().includes('No backup yet'), 40);

    expect(
      text(),
      'a phone with a character and no backup at all says nothing about it, ever',
    ).toMatch(/No backup yet/);
    expect(buttonNames().join(' | ')).toMatch(/BACK UP/);
  });

  it('still waits until it is urgent when there is a recent backup', async () => {
    phoneViewport();
    await db.putCharacter(playedCharacter());
    useApp.getState().setPrefs({
      lastBackupAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    await mount();
    await settle(() => false, 20);

    expect(
      text(),
      'three days is not urgent, and a phone has no vertical room to spare on Play',
    ).not.toMatch(/Last backup: 3 days ago/);
  });
});
