// @vitest-environment jsdom
/**
 * The sentence the unsaved-work strip prints after SAVE A COPY NOW.
 *
 * This strip appears at the moment a write has already failed, which makes it
 * the worst place in the app to be told a half-truth about what was written.
 * Two things about that sentence had no test at all: that it carries
 * `outcome.notice` - the campaigns a device with no folder could not take, and
 * the records a newer build wrote - and that it is styled as the prose it now
 * is rather than as the 53 characters of metadata it used to be.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backup from '../../src/store/backup.ts';
import { appBackupDeps } from '../../src/store/backupDeps.ts';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
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

const NO_FOLDER =
  'Campaign files can only be written into a folder, and this browser has none, so ' +
  '"The Sablewood Winter", "Bones of the Reach", "The Hollow Gate" are not in this backup. ' +
  'SAVE A COPY in the GM section writes one campaign to a file by hand.';

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
  await backup.forgetBackupFolder(appBackupDeps);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function settle(until: () => boolean = () => true, turns = 80): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

const text = (): string => container.textContent ?? '';

async function press(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  expect(button, `no button says "${label}"`).toBeDefined();
  await act(async () => {
    button!.click();
  });
  await settle(() => true, 5);
}

/** Mount, break the writes, and take the strip's own copy. */
async function saveACopyFromTheStrip(): Promise<HTMLElement> {
  await db.putCharacter(playedCharacter());
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);

  await act(async () => {
    useApp.setState({
      writeError: {
        message: 'This device is out of space, so the last 3 changes could not be saved.',
        count: 3,
        kind: 'quota',
      },
    });
  });

  await press('SAVE A COPY NOW');
  const note = [...container.querySelectorAll('span')].find((s) =>
    (s.textContent ?? '').startsWith('Saved '),
  );
  expect(note, `the strip printed nothing after the export - screen said: ${text()}`).toBeDefined();
  return note!;
}

describe('what the unsaved-work strip says it wrote', () => {
  beforeEach(() => {
    vi.spyOn(backup, 'runBackup').mockResolvedValue({
      ok: true,
      wrote: true,
      route: 'download',
      fileName: 'daggerheart-backup-2026-08-27.dhbackup',
      characters: 1,
      campaigns: 0,
      campaignNames: [],
      notReadable: [],
      notice: NO_FOLDER,
      reason: null,
      at: '2026-08-27T10:00:00.000Z',
    });
  });

  /**
   * The run succeeded, stamped the clock and cleared `lastError`, and three
   * campaigns are not in the file. `notice` is the only thing that says so.
   */
  it('names what the export left out and not only what it wrote', async () => {
    const note = await saveACopyFromTheStrip();
    expect(note.textContent).toContain('Saved daggerheart-backup-2026-08-27.dhbackup');
    expect(
      note.textContent,
      'the strip told a user with unsaved work that a backup was saved, and never that ' +
        'three of their campaigns are not in it',
    ).toContain('are not in this backup');
    expect(note.textContent).toContain('The Sablewood Winter');
  });

  /**
   * And it is set as prose. `.t-meta` is a mono metadata line with no width at
   * all - fine for the 53 characters this line used to carry, and wrong for a
   * sentence: when it was `500 10px/1`, before the readability ramp, this
   * sentence on a 393px phone was ten line boxes of 13px glyphs stepping 10px,
   * three pixels of overlap per line, or 1232px of unbroken width on a desktop.
   */
  it('sets that sentence as prose rather than as a one-line label', async () => {
    const note = await saveACopyFromTheStrip();
    expect(
      note.className,
      'a 400-character sentence in the 10px/1 mono metadata role overlaps its own lines',
    ).not.toContain('t-meta');
    expect(note.className).toContain('t-hint');
    expect(note.style.maxWidth, 'nothing caps the line, so it runs the width of the window').toBe(
      '420px',
    );
  });
});
