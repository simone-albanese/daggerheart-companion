/**
 * Backup is the one subsystem allowed to be pessimistic. Most of these tests
 * are about what it says when it did *not* work: a user who thinks they have a
 * backup and does not is worse off than one who knows they have none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../shared/types.ts';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import {
  INACTIVE_DAYS,
  backupStatus,
  chooseBackupFolder,
  forgetBackupFolder,
  installBackupHooks,
  integrityCheck,
  restoreFromText,
  runBackup,
  type BackupDeps,
} from '../../src/store/backup.ts';
import { serializeBackup } from '../../src/transfer/fileIo.ts';
import { wizard } from '../transfer/fixtures.ts';

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

const DAY = 86_400_000;
const NOW = new Date('2026-08-15T20:00:00.000Z');
const daysAgo = (n: number): string => new Date(NOW.getTime() - n * DAY).toISOString();

let prefs: Prefs;
let library: Character[];

const deps = (patch: Partial<BackupDeps> = {}): Partial<BackupDeps> => ({
  listCharacters: () => Promise.resolve(library),
  readPrefs: () => prefs,
  writePrefs: (p) => {
    prefs = { ...prefs, ...p };
  },
  now: () => NOW,
  ...patch,
});

/** A folder handle that records what was written, like the real one would. */
function fakeFolder(options: { fail?: boolean } = {}): Map<string, string> {
  const files = new Map<string, string>();
  const handle = {
    name: 'Daggerheart',
    getFileHandle: () => {
      if (options.fail === true) return Promise.reject(new Error('the folder is read-only'));
      return Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              // The real API is told the file name up front; the fake records
              // whatever the last write was, which is all these tests need.
              files.set('latest', text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
        // `writeIntoDirectory` opens the file again and compares: an
        // unverified backup is not counted as one. A fake that could not be
        // read back would report every backup as a failure.
        getFile: () => Promise.resolve({ text: () => Promise.resolve(files.get('latest') ?? '') }),
      });
    },
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
  return files;
}

beforeEach(() => {
  prefs = { ...DEFAULT_PREFS };
  library = [wizard()];
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(async () => {
  await forgetBackupFolder(deps());
  vi.unstubAllGlobals();
});

describe('the indicator', () => {
  it('reads the way the architecture writes it', () => {
    prefs = { ...prefs, lastBackupAt: daysAgo(3) };
    const status = backupStatus(deps());
    expect(status.label).toBe('last backup: 3 days ago');
    expect(status.daysSince).toBe(3);
    expect(status.level).toBe('fresh');
  });

  it('has a word for today, yesterday and never', () => {
    expect(backupStatus(deps()).label).toBe('no backup yet');
    expect(backupStatus(deps()).level).toBe('never');

    prefs = { ...prefs, lastBackupAt: daysAgo(0) };
    expect(backupStatus(deps()).label).toBe('last backup: today');

    prefs = { ...prefs, lastBackupAt: daysAgo(1) };
    expect(backupStatus(deps()).label).toBe('last backup: yesterday');
  });

  it('gets louder at five days and again at seven', () => {
    prefs = { ...prefs, lastBackupAt: daysAgo(5) };
    expect(backupStatus(deps()).level).toBe('aging');
    prefs = { ...prefs, lastBackupAt: daysAgo(INACTIVE_DAYS) };
    expect(backupStatus(deps()).level).toBe('overdue');
  });

  it('says that nothing is automatic until a folder is chosen', () => {
    const status = backupStatus(deps());
    expect(status.automatic).toBe(false);
    expect(status.detail).toMatch(/until you choose a folder/);
  });

  it('says that the remembered folder has not been re-opened', () => {
    prefs = { ...prefs, backupTarget: 'Daggerheart' };
    expect(backupStatus(deps()).detail).toMatch(/has not re-opened that folder yet/);
  });
});

describe('running a backup', () => {
  it('does nothing, loudly, when there is nothing to save', async () => {
    library = [];
    const outcome = await runBackup('manual', {}, deps());
    expect(outcome).toMatchObject({ wrote: false, route: 'none' });
    expect(outcome.reason).toMatch(/no characters to back up/);
  });

  it('will not export automatically without a folder, and says why', async () => {
    const outcome = await runBackup('page-hide', {}, deps());
    expect(outcome.wrote).toBe(false);
    expect(outcome.reason).toMatch(/No backup folder has been chosen/);
    expect(prefs.lastBackupAt).toBeUndefined();
  });

  it('writes into the chosen folder and stamps the time', async () => {
    const files = fakeFolder();
    const chosen = await chooseBackupFolder(deps());
    expect(chosen).toMatchObject({ ok: true, name: 'Daggerheart' });
    expect(prefs.backupTarget).toBe('Daggerheart');

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome).toMatchObject({ ok: true, wrote: true, route: 'file-system', characters: 1 });
    expect(outcome.fileName).toBe('daggerheart-backup-2026-08-15.dhbackup');
    expect(prefs.lastBackupAt).toBe(NOW.toISOString());

    const written = files.get('latest')!;
    expect(JSON.parse(written)).toMatchObject({ format: 'dhbackup' });
    expect(backupStatus(deps()).automatic).toBe(true);
  });

  it('skips an automatic run when nothing has changed', async () => {
    fakeFolder();
    await chooseBackupFolder(deps());
    await runBackup('session-end', {}, deps());

    const second = await runBackup('page-hide', {}, deps());
    expect(second.wrote).toBe(false);
    expect(second.reason).toMatch(/Nothing has changed/);

    // An edit brings it back.
    library = [wizard({ updatedAt: '2026-08-15T19:00:00.000Z' })];
    expect((await runBackup('page-hide', {}, deps())).wrote).toBe(true);
  });

  it('reports a folder that refuses the write, and remembers that it failed', async () => {
    fakeFolder({ fail: true });
    await chooseBackupFolder(deps());

    const outcome = await runBackup('page-hide', {}, deps());
    expect(outcome.ok).toBe(false);
    expect(outcome.wrote).toBe(false);
    expect(outcome.reason).toMatch(/Could not write/);

    const status = backupStatus(deps());
    expect(status.level).toBe('failing');
    expect(status.lastError).toMatch(/Could not write/);
  });

  it('falls back to saving by hand when a person asked for it', async () => {
    const written: string[] = [];
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockResolvedValue({
        name: 'daggerheart-backup-2026-08-15.dhbackup',
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

    const outcome = await runBackup('manual', {}, deps());
    expect(outcome).toMatchObject({ ok: true, wrote: true, route: 'file-system' });
    expect(JSON.parse(written[0]!)).toMatchObject({ format: 'dhbackup' });
  });

  it('installs nothing when there is no page to hide', () => {
    expect(installBackupHooks(deps())()).toBeUndefined();
  });

  /**
   * `pagehide` is the only lifecycle event iOS Safari reliably delivers, so
   * this is the hook the seven-day problem actually depends on, and until now
   * only its does-nothing branch was covered. In Node there is no page, so the
   * listeners stand in for one: they have to be registered, a hidden page has
   * to produce a real write, and the disposer has to remove both again.
   */
  it('backs up when the page goes away, once, and unhooks cleanly', async () => {
    const listeners = new Map<string, () => void>();
    const removed: string[] = [];
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
      removeEventListener: (type: string) => void removed.push(type),
    });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
      removeEventListener: (type: string) => void removed.push(type),
    });

    const files = fakeFolder();
    await chooseBackupFolder(deps());

    const dispose = installBackupHooks(deps());
    expect([...listeners.keys()].sort()).toEqual(['pagehide', 'visibilitychange']);

    listeners.get('pagehide')!();
    listeners.get('visibilitychange')!(); // a second trigger must not double-write
    await vi.waitFor(() => expect(files.get('latest')).toBeDefined());
    expect(prefs.lastBackupAt).toBe(NOW.toISOString());

    dispose();
    expect(removed.sort()).toEqual(['pagehide', 'visibilitychange']);
  });
});

describe('the seven-day check', () => {
  it('has nothing to say on a first run', async () => {
    library = [];
    const report = await integrityCheck(deps());
    expect(report).toMatchObject({ inactiveDays: null, triggered: false, healthy: true });
    expect(report.message).toBe('Nothing to check yet.');
  });

  it('notices that a character it saw last time is gone', async () => {
    prefs = { ...prefs, lastBackupAt: daysAgo(9) };
    library = [wizard(), wizard({ id: 'second-character', name: 'Bram' })];
    // Last session, eight days ago, recorded both.
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));

    // Safari cleared the store in between.
    library = [];
    const report = await integrityCheck(deps());

    expect(report.triggered).toBe(true);
    expect(report.inactiveDays).toBe(8);
    expect(report.healthy).toBe(false);
    expect(report.expected).toBe(2);
    expect(report.found).toBe(0);
    expect(report.missingIds.sort()).toEqual([wizard().id, 'second-character'].sort());
    expect(report.canRestore).toBe(true);
    expect(report.message).toMatch(/2 characters that were here last time are gone/);
    expect(report.message).toMatch(/about a week/);
  });

  it('admits there is nothing to restore from', async () => {
    library = [wizard()];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));
    library = [];
    const report = await integrityCheck(deps());
    expect(report.canRestore).toBe(false);
    expect(report.message).toMatch(/no backup to restore from/);
  });

  it('says so when the store cannot be opened at all', async () => {
    const report = await integrityCheck(
      deps({ listCharacters: () => Promise.reject(new Error('QuotaExceededError')) }),
    );
    expect(report.healthy).toBe(false);
    expect(report.message).toMatch(/could not be opened/);
  });

  /**
   * "No answer" is not "no characters". Recording an unreadable store as an
   * empty one erases the only record of what used to be here, and every later
   * check then reports a clean bill of health over an empty database - the one
   * failure this whole module exists to catch.
   */
  it('does not forget what was here when the store cannot be read', async () => {
    library = [wizard(), wizard({ id: 'second-character', name: 'Bram' })];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));

    const failed = await integrityCheck(
      deps({ listCharacters: () => Promise.reject(new Error('InvalidStateError')) }),
    );
    expect(failed.healthy).toBe(false);

    // Next launch: the store opens again, and both characters really are gone.
    library = [];
    const report = await integrityCheck(deps());
    expect(report.expected).toBe(2);
    expect(report.missingIds).toHaveLength(2);
    expect(report.healthy).toBe(false);
    expect(report.message).toMatch(/2 characters that were here last time are gone/);
  });

  it('is quiet when a week has passed and everything is still there', async () => {
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));
    const report = await integrityCheck(deps());
    expect(report.triggered).toBe(true);
    expect(report.healthy).toBe(true);
    expect(report.message).toMatch(/still here after 8 days away/);
  });
});

describe('restoring', () => {
  const backup = (characters: Character[]): string => serializeBackup(characters, NOW);

  it('brings back what is missing', async () => {
    library = [];
    const result = await restoreFromText(
      backup([wizard(), wizard({ id: 'second-character', name: 'Bram' })]),
      { put: () => Promise.resolve() },
      deps(),
    );
    expect(result).toMatchObject({ imported: 2, replaced: 0, skipped: 0 });
  });

  it('never overwrites work that is newer than the backup', async () => {
    library = [wizard({ updatedAt: '2026-08-15T23:00:00.000Z' })];
    const stale = backup([wizard({ updatedAt: '2026-08-01T10:00:00.000Z' })]);

    const merged = await restoreFromText(stale, { put: () => Promise.resolve() }, deps());
    expect(merged).toMatchObject({ imported: 0, skipped: 1, replaced: 0 });
    expect(merged.warnings.join(' ')).toMatch(/newer than the backup/);

    // Unless the user says the local copy is the damaged one.
    const forced = await restoreFromText(
      stale,
      { mode: 'replace', put: () => Promise.resolve() },
      deps(),
    );
    expect(forced).toMatchObject({ imported: 0, skipped: 0, replaced: 1 });
  });

  it('takes a single character file as readily as a backup', async () => {
    library = [];
    const put = vi.fn().mockResolvedValue(undefined);
    const result = await restoreFromText(
      JSON.stringify(wizard()),
      { put },
      deps(),
    );
    expect(result.imported).toBe(1);
    expect(result.warnings.join(' ')).toMatch(/no export header/);
    expect(put).toHaveBeenCalledTimes(1);
  });
});
