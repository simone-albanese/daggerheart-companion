/**
 * Backup is the one subsystem allowed to be pessimistic. Most of these tests
 * are about what it says when it did *not* work: a user who thinks they have a
 * backup and does not is worse off than one who knows they have none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import type { Character } from '../../shared/types.ts';
import type { CampaignLibrary } from '../../src/store/campaigns.ts';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import {
  INACTIVE_DAYS,
  backupStatus,
  chooseBackupFolder,
  forgetBackupFolder,
  installBackupHooks,
  integrityCheck,
  runBackup,
  type BackupDeps,
} from '../../src/store/backup.ts';
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
/** The campaigns this device has. Empty in every test that predates them. */
let tables: Campaign[];
/** Records a newer build wrote: on the disk, never in the backup. */
let held: CampaignLibrary['quarantined'];

const deps = (patch: Partial<BackupDeps> = {}): Partial<BackupDeps> => ({
  listCharacters: () => Promise.resolve(library),
  // Both campaign doors are injected, and they are two doors on purpose:
  // `liveCampaigns` is what a backup is written from (memory, through the
  // publish seam) and `listCampaigns` is what the seven-day check reads (the
  // disk, which can throw, which is its only evidence).
  liveCampaigns: () => Promise.resolve({ campaigns: tables, quarantined: held }),
  listCampaigns: () =>
    Promise.resolve({ campaigns: tables, quarantined: held, repaired: [], warnings: [] }),
  readPrefs: () => prefs,
  writePrefs: (p) => {
    prefs = { ...prefs, ...p };
  },
  now: () => NOW,
  ...patch,
});

/**
 * A folder handle that records what was written, like the real one would.
 *
 * Keyed on the **file name**, and that is not a tidy-up. This fake used to take
 * no arguments at all and put every write under `'latest'`, so it could not tell
 * two files apart - which was invisible while exactly one file was ever written
 * and makes every multi-file assertion vacuous the moment a second one is. The
 * run now writes one `.dhbackup` and one `.dhcampaign` per changed campaign, and
 * a fake that conflated them would happily report a campaign file that had been
 * overwritten by the next campaign as verified.
 *
 * `latest` is kept as a live alias of the last write, so the tests that predate
 * the campaign leg keep asking the question they were written to ask.
 */
function fakeFolder(options: { fail?: boolean } = {}): Map<string, string> {
  const files = new Map<string, string>();
  const handle = {
    name: 'Daggerheart',
    getFileHandle: (name: string) => {
      if (options.fail === true) return Promise.reject(new Error('the folder is read-only'));
      return Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              files.set(name, text);
              files.set('latest', text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
        // `writeIntoDirectory` opens the file again and compares: an
        // unverified backup is not counted as one. A fake that could not be
        // read back would report every backup as a failure.
        getFile: () => Promise.resolve({ text: () => Promise.resolve(files.get(name) ?? '') }),
      });
    },
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
  return files;
}

beforeEach(() => {
  prefs = { ...DEFAULT_PREFS };
  library = [wizard()];
  tables = [];
  held = [];
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
  it('does nothing, loudly, when there is nothing at all to save', async () => {
    // Both stores empty, not just the library. A GM who runs the table and
    // plays nobody is a normal user of this app, and the sentence that named
    // characters alone was true and beside the point for them.
    library = [];
    const outcome = await runBackup('manual', {}, deps());
    expect(outcome).toMatchObject({ wrote: false, route: 'none' });
    expect(outcome.reason).toMatch(/nothing to back up yet/);
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

  /**
   * The settings screen promises two things - a copy when you leave the app,
   * and a copy when it closes. The test above fires `pagehide` first, so the
   * shared guard swallows the second event and the *leaving* half was never
   * exercised on its own. It is the half a phone actually uses: swiping an app
   * away sends `visibilitychange`, and `pagehide` may never follow.
   */
  it('backs up when the user only leaves the app, without the page going away', async () => {
    const listeners = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
      removeEventListener: () => {},
    });
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (type: string, fn: () => void) => void listeners.set(type, fn),
      removeEventListener: () => {},
    });

    const files = fakeFolder();
    await chooseBackupFolder(deps());
    installBackupHooks(deps());

    listeners.get('visibilitychange')!();
    await vi.waitFor(() => expect(files.get('latest')).toBeDefined());
    expect(prefs.lastBackupAt).toBe(NOW.toISOString());
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
    expect(report.message).toMatch(/2 characters that were here at the end of the last session/);
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
    expect(report.message).toMatch(/2 characters that were here at the end of the last session/);
  });

  /**
   * The cause is a separate claim from the fact.
   *
   * This branch used to append "This browser clears stored data after about a
   * week of not being used" to *any* absence, with no gate on `triggered` -
   * which has existed here since the beginning. Delete a character, have the
   * tab closed before the session note ran, come back five minutes later, and
   * the module whose first rule is never to claim something happened blamed the
   * browser for something the user did.
   */
  it('does not blame the browser for an absence it has no evidence about', async () => {
    library = [wizard(), wizard({ id: 'second-character', name: 'Bram' })];
    // Ten minutes ago, not eight days: nothing has been evicted by anything.
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 600_000) }));

    library = [wizard()];
    const report = await integrityCheck(deps());

    expect(report.triggered).toBe(false);
    expect(report.healthy).toBe(false);
    expect(report.message).toMatch(/1 character that was here at the end of the last session/);
    expect(
      report.message,
      'the app blamed the browser for a character the user deleted themselves',
    ).not.toMatch(/clears stored data/);
  });

  it('says how long it has been when it does have the evidence', async () => {
    library = [wizard(), wizard({ id: 'second-character', name: 'Bram' })];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 9 * DAY) }));
    library = [];
    expect((await integrityCheck(deps())).message).toMatch(/about a week .*and it has been 9 days/);
  });

  it('is quiet when a week has passed and everything is still there', async () => {
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));
    const report = await integrityCheck(deps());
    expect(report.triggered).toBe(true);
    expect(report.healthy).toBe(true);
    expect(report.message).toMatch(/still here after 8 days away/);
  });
});
