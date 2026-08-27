/**
 * Backup is the one subsystem allowed to be pessimistic. Most of these tests
 * are about what it says when it did *not* work: a user who thinks they have a
 * backup and does not is worse off than one who knows they have none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newCampaign, type Campaign } from '../../shared/campaigns.ts';
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
  noteCampaignCopy,
  noteSession,
  runBackup,
  type BackupDeps,
} from '../../src/store/backup.ts';
import { publishCampaignSource } from '../../src/store/campaignSource.ts';
import { parseCampaignFile, serializeCampaign } from '../../src/transfer/campaignFile.ts';
import * as fileIo from '../../src/transfer/fileIo.ts';
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
 *
 * `refuse` and `tamper` are per file name for the same reason: the interesting
 * runs are the ones where the character file lands and one campaign does not,
 * and a folder that could only fail as a whole cannot produce one.
 */
function fakeFolder(
  options: {
    fail?: boolean;
    /** This file, and only this file, will not open. */
    refuse?: (name: string) => boolean;
    /** What comes back when the file is read again, which need not be what went in. */
    tamper?: (name: string, written: string) => string;
  } = {},
): Map<string, string> {
  const files = new Map<string, string>();
  const handle = {
    name: 'Daggerheart',
    getFileHandle: (name: string) => {
      if (options.fail === true || options.refuse?.(name) === true) {
        return Promise.reject(new Error('the folder is read-only'));
      }
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
        getFile: () =>
          Promise.resolve({
            text: () => {
              const written = files.get(name) ?? '';
              return Promise.resolve(options.tamper?.(name, written) ?? written);
            },
          }),
      });
    },
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
  return files;
}

/** A campaign with nothing in it but a name and an id, which is all a file needs. */
const table = (name: string, id: string, patch: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign(name, '2026-08-10T18:00:00.000Z', id),
  ...patch,
});

const campaignFiles = (files: Map<string, string>): string[] =>
  [...files.keys()].filter((name) => name.endsWith('.dhcampaign')).sort();

/** Whose campaign is actually inside a file the run says it wrote. */
const campaignIdIn = (files: Map<string, string>, name: string): string =>
  parseCampaignFile(files.get(name) ?? '').campaign.id;

beforeEach(() => {
  prefs = { ...DEFAULT_PREFS };
  library = [wizard()];
  tables = [];
  held = [];
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(async () => {
  await forgetBackupFolder(deps());
  publishCampaignSource(null);
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
    expect(outcome).toMatchObject({ wrote: false, route: 'none', characters: 0, campaigns: 0 });
    expect(outcome.reason).toMatch(/nothing to back up yet/);
    // The sentence that named characters alone is gone, and it must not come
    // back as a fallback: a device with three tables and no player characters
    // reaches this branch only when it has neither.
    expect(outcome.reason).not.toMatch(/character/i);
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

/*
 * The campaign leg.
 *
 * `grep -ci campaign src/store/backup.ts` was 0 for the whole life of this
 * subsystem, so every assertion below is about a class of loss that had no net
 * at all: the night's plan, the archive, the register and whole copies of the
 * players' sheets, in the same IndexedDB the seven-day check exists because
 * Safari evicts.
 */
const BACKUP_FILE = 'daggerheart-backup-2026-08-15.dhbackup';
const WINTER_FILE = 'daggerheart-the-sablewood-winter-c94c8729-2026-08-15.dhcampaign';
const REACH_FILE = 'daggerheart-bones-of-the-reach-045346c8-2026-08-15.dhcampaign';
const REACH_TWIN_FILE = 'daggerheart-bones-of-the-reach-9d5a1772-2026-08-15.dhcampaign';

describe('backing up the campaigns', () => {
  it('writes one dated file per campaign, named after the campaign and the day', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1')];

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome).toMatchObject({ ok: true, wrote: true, characters: 1, campaigns: 1 });
    expect(outcome.campaignNames).toEqual(['The Sablewood Winter']);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);
    expect(files.has(BACKUP_FILE)).toBe(true);
  });

  it('gives two campaigns two files, each holding the campaign it is named for', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1'), table('Bones of the Reach', 'reach-1')];

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome.campaigns).toBe(2);
    expect(outcome.campaignNames).toEqual(['The Sablewood Winter', 'Bones of the Reach']);
    expect(campaignFiles(files)).toEqual([REACH_FILE, WINTER_FILE].sort());
    expect(campaignIdIn(files, WINTER_FILE)).toBe('winter-1');
    expect(campaignIdIn(files, REACH_FILE)).toBe('reach-1');
  });

  /**
   * The eight hex of the id, earning its place.
   *
   * `slugify` collapses every run of non-alphanumerics to one dash and returns
   * `''` for a name in a non-Latin script, so two campaigns sharing a name -
   * which nothing stops, and which `campaign-from-gm-v1` makes the *common*
   * case on two upgraded devices - would land on one file name. That is a
   * silent loss inside the backup, which is the one place this app must not
   * have one.
   */
  it('keeps two campaigns with the same name apart, which the slug alone cannot', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('Bones of the Reach', 'reach-1'), table('Bones of the Reach', 'reach-2')];

    expect((await runBackup('session-end', {}, deps())).campaigns).toBe(2);
    expect(campaignFiles(files)).toEqual([REACH_FILE, REACH_TWIN_FILE].sort());
    expect(campaignIdIn(files, REACH_FILE)).toBe('reach-1');
    expect(campaignIdIn(files, REACH_TWIN_FILE)).toBe('reach-2');
  });

  /**
   * One gate per target, because the gate used to be global.
   *
   * An unchanged library must not stop a campaign file being written, and an
   * unchanged campaign must not stop the `.dhbackup` - and with one fingerprint
   * over both, a GM who plays every week and never touches their own character
   * would have had every campaign write skipped by a library that had not moved
   * since March.
   */
  it('gates each target on its own, so an unchanged one cannot stop the other', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1')];
    expect((await runBackup('session-end', {}, deps())).wrote).toBe(true);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);

    // Only a character moved. The campaign is byte-identical, so it is skipped,
    // and skipping it does not stop the library going out.
    files.clear();
    library = [wizard({ updatedAt: '2026-08-15T19:00:00.000Z' })];
    const charactersOnly = await runBackup('page-hide', {}, deps());
    expect(charactersOnly).toMatchObject({ wrote: true, campaigns: 0 });
    expect(files.has(BACKUP_FILE)).toBe(true);
    expect(campaignFiles(files)).toEqual([]);

    // And the other way round: only the board moved.
    files.clear();
    tables = [table('The Sablewood Winter', 'winter-1', { fear: 6 })];
    const campaignsOnly = await runBackup('page-hide', {}, deps());
    expect(campaignsOnly).toMatchObject({ wrote: true, campaigns: 1, fileName: null });
    expect(files.has(BACKUP_FILE)).toBe(false);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);

    // Nothing moved at all, so neither gate opens.
    files.clear();
    const neither = await runBackup('page-hide', {}, deps());
    expect(neither.wrote).toBe(false);
    expect(neither.reason).toMatch(/Nothing has changed/);
    expect([...files.keys()]).toEqual([]);
  });

  /**
   * A run that got some files down and not others is not a backup.
   *
   * Stamping here would let "last backup: today" sit over a campaign that has
   * never reached the folder - the precise lie the module opens by forbidding -
   * so `lastBackupAt` stays where it was, the failure names the campaign, and
   * what *did* land is named beside it rather than swallowed.
   */
  it('does not stamp the clock when one campaign would not go, and says which', async () => {
    const files = fakeFolder({ refuse: (name) => name.startsWith('daggerheart-the-sablewood') });
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1'), table('Bones of the Reach', 'reach-1')];

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome.ok).toBe(false);
    expect(outcome.wrote).toBe(false);
    expect(prefs.lastBackupAt).toBeUndefined();

    // The characters and the other campaign still landed, and the sentence says so.
    expect(files.has(BACKUP_FILE)).toBe(true);
    expect(campaignFiles(files)).toEqual([REACH_FILE]);
    expect(outcome.campaignNames).toEqual(['Bones of the Reach']);
    expect(outcome.reason).toMatch(/The Sablewood Winter/);
    expect(outcome.reason).toMatch(/did reach the folder/);

    const status = backupStatus(deps());
    expect(status.level).toBe('failing');
    expect(status.lastError).toMatch(/The Sablewood Winter/);
    expect(status.lastError).not.toMatch(/Bones of the Reach/);
  });

  /**
   * The file that did land is remembered even though the run failed.
   *
   * It was written and read back; rewriting it on the next trigger would be
   * work with nothing behind it, and the campaign that failed is still due.
   */
  it('keeps what reached the folder on a run that failed overall', async () => {
    const refuse = { on: true };
    const files = fakeFolder({
      refuse: (name) => refuse.on && name.startsWith('daggerheart-the-sablewood'),
    });
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1'), table('Bones of the Reach', 'reach-1')];
    await runBackup('session-end', {}, deps());

    refuse.on = false;
    files.clear();
    const second = await runBackup('page-hide', {}, deps());
    expect(second.wrote).toBe(true);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);
    expect(second.campaignNames).toEqual(['The Sablewood Winter']);
  });

  /**
   * A GM who runs the table and plays nobody is a normal user of this app, and
   * until the campaign leg existed they were told there were no characters to
   * back up, got nothing, and watched the indicator never move.
   */
  it('backs up a device that has campaigns and no characters at all', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    library = [];
    tables = [table('The Sablewood Winter', 'winter-1')];

    const outcome = await runBackup('manual', {}, deps());
    expect(outcome).toMatchObject({ ok: true, wrote: true, characters: 0, campaigns: 1 });
    expect(outcome.reason).toBeNull();
    expect(outcome.fileName).toBeNull();
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);
    expect(files.has(BACKUP_FILE)).toBe(false);
    expect(prefs.lastBackupAt).toBe(NOW.toISOString());
    expect(backupStatus(deps()).label).toBe('last backup: today');
  });

  it('does not count a campaign file the folder gave back different', async () => {
    const files = fakeFolder({
      tamper: (name, written) => (name.endsWith('.dhcampaign') ? written.slice(0, 200) : written),
    });
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1')];

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome.ok).toBe(false);
    expect(outcome.campaigns).toBe(0);
    expect(outcome.reason).toMatch(/came back different when it was read again/);
    expect(outcome.reason).toMatch(/not been counted as a backup/);
    expect(prefs.lastBackupAt).toBeUndefined();
  });

  /**
   * The campaign leg's `verify` is a parse, not a count, and that is stronger
   * than the character leg's: the CRC lives inside the reader, so a file whose
   * bytes were edited fails here rather than being counted as a backup.
   *
   * The callback is captured rather than provoked through the folder, because
   * `writeIntoDirectory` compares the whole text first: any tampering it can
   * see never reaches `verify` at all. What `verify` is *for* is the file that
   * came back byte-identical to what was handed over and is still not the
   * campaign it claims to be.
   */
  it('reads a campaign file back through the parser before counting it', async () => {
    const real = fileIo.writeIntoDirectory;
    let verify: ((written: string) => string | null) | undefined;
    const spy = vi
      .spyOn(fileIo, 'writeIntoDirectory')
      .mockImplementation((handle, name, text, options) => {
        if (name.endsWith('.dhcampaign')) verify = options?.verify;
        return real(handle, name, text, options);
      });

    try {
      fakeFolder();
      await chooseBackupFolder(deps());
      const winter = table('The Sablewood Winter', 'winter-1', { fear: 7 });
      tables = [winter];
      expect((await runBackup('session-end', {}, deps())).campaigns).toBe(1);
      expect(verify).toBeDefined();

      const honest = serializeCampaign(winter, NOW);
      expect(verify!(honest)).toBeNull();

      // One digit of the board, changed by hand in a text editor.
      const edited = honest.replace('"fear": 7', '"fear": 6');
      expect(edited).not.toBe(honest);
      const damaged = verify!(edited);
      expect(damaged).toMatch(/could not be read back/);
      expect(damaged).toMatch(/checksum does not match/);

      // Whole, valid, correctly checksummed - and somebody else's table.
      const wrong = verify!(serializeCampaign(table('Bones of the Reach', 'reach-1'), NOW));
      expect(wrong).toMatch(/came back holding a different campaign/);
      expect(wrong).toMatch(/the-sablewood-winter/);
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * One share sheet, not N.
   *
   * A `.dhbackup` can go out through a share sheet because one gesture carries
   * one file. Firing one per campaign at somebody who pressed a button once is
   * not a backup, it is an ambush - so on a device with no folder the campaigns
   * are *named*, with the manual route beside them, and only the character file
   * is offered.
   */
  it('offers exactly one file by hand when there is no folder, and names the rest', async () => {
    const spy = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: true,
      route: 'download',
      fileName: BACKUP_FILE,
      cancelled: false,
      reason: null,
    });

    try {
      tables = [table('The Sablewood Winter', 'winter-1'), table('Bones of the Reach', 'reach-1')];
      const outcome = await runBackup('manual', {}, deps());

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]![0]).toBe(BACKUP_FILE);
      expect(outcome).toMatchObject({ ok: true, wrote: true, campaigns: 0 });
      expect(outcome.notice).toMatch(/The Sablewood Winter/);
      expect(outcome.notice).toMatch(/Bones of the Reach/);
      expect(outcome.notice).toMatch(/SAVE A COPY/);
    } finally {
      spy.mockRestore();
    }
  });

  it('says the campaigns are the whole of what was missed when there is nothing else', async () => {
    const spy = vi.spyOn(fileIo, 'saveTextFile');
    try {
      library = [];
      tables = [table('The Sablewood Winter', 'winter-1')];
      const outcome = await runBackup('manual', {}, deps());

      expect(spy).not.toHaveBeenCalled();
      expect(outcome.wrote).toBe(false);
      expect(outcome.reason).toMatch(/The Sablewood Winter/);
      expect(outcome.reason).toMatch(/only be written into a folder/);
      // Not a claim about a file that does not exist.
      expect(prefs.lastBackupAt).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * A copy saved by hand is evidence that a click happened, never that a file
   * exists: `saveTextFile` reads nothing back. So it must not set the checksum
   * that suppresses the folder write, or an iOS GM's weekly export would start
   * cancelling the one write this app can actually verify.
   */
  it('does not let a copy saved by hand suppress the folder write', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('The Sablewood Winter', 'winter-1')];
    noteCampaignCopy('winter-1', 'share', new Date(NOW.getTime() - DAY));

    expect((await runBackup('page-hide', {}, deps())).campaigns).toBe(1);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);
  });

  /**
   * A record a newer build wrote is on the disk and untouched - that is what
   * quarantine is for - so it is named as a notice and never as a failure, and
   * it does not hold the clock back. The next campaign schema bump manufactures
   * this state on every older tab by design, and a net that goes red the day a
   * bump ships trains the GM to ignore the one indicator that matters.
   */
  it('names a campaign it must not touch without calling the backup a failure', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    tables = [table('Bones of the Reach', 'reach-1')];
    held = [
      {
        id: 'winter-1',
        name: 'The Sablewood Winter',
        schemaVersion: 99,
        reason: 'written by a newer version of this app',
      },
    ];

    const outcome = await runBackup('session-end', {}, deps());
    expect(outcome).toMatchObject({ ok: true, wrote: true, campaigns: 1 });
    expect(outcome.reason).toBeNull();
    expect(prefs.lastBackupAt).toBe(NOW.toISOString());
    expect(backupStatus(deps()).level).not.toBe('failing');

    expect(outcome.notReadable).toEqual(['The Sablewood Winter']);
    expect(outcome.notice).toMatch(/The Sablewood Winter/);
    expect(outcome.notice).toMatch(/close every tab/);
    expect(campaignFiles(files)).toEqual([REACH_FILE]);
  });
});

/*
 * Two campaign doors, and they must never be the same door.
 *
 * What a backup is *written from* is memory, through the publish seam:
 * `writeActive` updates `state.campaigns` only inside the `try` after
 * `putCampaign` resolves and leaves the record dirty on a throw, so on the
 * evening writes are failing - the exact evening a backup is for - a flush
 * cannot make the disk fresh, and a disk-sourced backup would write the stale
 * record, verify it happily and stamp "last backup: today" over an evening that
 * exists nowhere.
 *
 * What the seven-day check *compares against* is the disk, and only the disk: a
 * store-sourced list can never throw, which would make the "could not be
 * opened" branch unreachable and turn one bad launch into a fabricated loss.
 */
describe('where the campaigns come from', () => {
  /** Everything except the two campaign doors, so the module's own are used. */
  const bareDeps = (): Partial<BackupDeps> => ({
    listCharacters: () => Promise.resolve(library),
    readPrefs: () => prefs,
    writePrefs: (p) => {
      prefs = { ...prefs, ...p };
    },
    now: () => NOW,
  });

  it('writes what the GM store published, not what the disk last accepted', async () => {
    const files = fakeFolder();
    await chooseBackupFolder(deps());
    // The disk holds nothing this run can reach - there is no IndexedDB in this
    // environment at all - so a run that reads it cannot quietly pass.
    publishCampaignSource(() => ({
      campaigns: [table('The Sablewood Winter', 'winter-1', { fear: 6 })],
      quarantined: [],
    }));

    const outcome = await runBackup('session-end', {}, bareDeps());
    expect(outcome.campaigns).toBe(1);
    expect(campaignFiles(files)).toEqual([WINTER_FILE]);
    expect(parseCampaignFile(files.get(WINTER_FILE)!).campaign.fear).toBe(6);
  });

  it('compares the seven-day check against the disk even when memory disagrees', async () => {
    const doors = (disk: Campaign[]): Partial<BackupDeps> =>
      deps({
        liveCampaigns: () =>
          Promise.resolve({ campaigns: [table('Open on screen', 'live-1')], quarantined: [] }),
        listCampaigns: () =>
          Promise.resolve({ campaigns: disk, quarantined: [], repaired: [], warnings: [] }),
      });

    await integrityCheck({
      ...doors([table('On the disk', 'disk-1')]),
      now: () => new Date(NOW.getTime() - 8 * DAY),
    });
    const report = await integrityCheck(doors([]));

    expect(report.missingCampaignIds).toEqual(['disk-1']);
    expect(report.missingCampaignIds).not.toContain('live-1');
  });

  it('records the disk in the session note as well, for the same reason', async () => {
    const doors = (disk: Campaign[]): Partial<BackupDeps> =>
      deps({
        liveCampaigns: () =>
          Promise.resolve({ campaigns: [table('Open on screen', 'live-1')], quarantined: [] }),
        listCampaigns: () =>
          Promise.resolve({ campaigns: disk, quarantined: [], repaired: [], warnings: [] }),
      });

    await noteSession(doors([table('On the disk', 'disk-1')]));
    const report = await integrityCheck(doors([]));

    expect(report.missingCampaignIds).toEqual(['disk-1']);
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

  /**
   * A device that lost only its campaigns used to be told nothing at all: the
   * check counted characters, and every character was still there.
   */
  it('notices that a campaign it saw last time is gone', async () => {
    tables = [table('The Sablewood Winter', 'winter-1'), table('Bones of the Reach', 'reach-1')];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));

    tables = [table('Bones of the Reach', 'reach-1')];
    const report = await integrityCheck(deps());

    expect(report.missingIds).toEqual([]);
    expect(report.missingCampaignIds).toEqual(['winter-1']);
    expect(report.healthy).toBe(false);
    expect(report.message).toMatch(/1 campaign that was here at the end of the last session/);
    // The remedy names where a campaign copy actually lives, which is not the
    // character backup file.
    expect(report.message).toMatch(/\.dhcampaign copies sit beside the character backup/);
  });

  /**
   * The union, and it is the most valuable assertion in this file.
   *
   * A record a newer build wrote is held back from `campaigns` on purpose and
   * is sitting on the disk untouched. Without `campaigns ∪ quarantined` here,
   * the day a second tab writes a newer schema this check announces that the
   * GM's campaign has vanished and blames ITP for behaviour this app has
   * deliberately - and the next campaign schema bump manufactures exactly that
   * state on every older tab.
   */
  it('does not report a campaign a newer build wrote as one that went missing', async () => {
    tables = [table('The Sablewood Winter', 'winter-1')];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));

    // The other tab upgraded and wrote it back at a schema this build refuses.
    tables = [];
    held = [
      {
        id: 'winter-1',
        name: 'The Sablewood Winter',
        schemaVersion: 99,
        reason: 'written by a newer version of this app',
      },
    ];
    const report = await integrityCheck(deps());

    expect(report.missingCampaignIds).toEqual([]);
    expect(report.healthy).toBe(true);
    expect(report.message).not.toMatch(/not on this device now/);
  });

  /**
   * "No answer" is not "no campaigns", and the campaign read is guarded on its
   * own so that a campaign store which will not open cannot also cost the
   * character note.
   */
  it('does not forget what campaigns were here when their store cannot be read', async () => {
    tables = [table('The Sablewood Winter', 'winter-1')];
    await integrityCheck(deps({ now: () => new Date(NOW.getTime() - 8 * DAY) }));

    const failed = await integrityCheck(
      deps({ listCampaigns: () => Promise.reject(new Error('InvalidStateError')) }),
    );
    expect(failed.missingCampaignIds).toEqual([]);
    expect(failed.healthy).toBe(false);
    expect(failed.message).toMatch(/campaign store could not be opened/);
    // The characters are readable, so their half of the sentence is unharmed.
    expect(failed.message).toMatch(/1 character still here after 8 days away/);

    // Next launch: the store opens again, and the campaign really is gone.
    tables = [];
    const report = await integrityCheck(deps());
    expect(report.missingCampaignIds).toEqual(['winter-1']);
  });
});
