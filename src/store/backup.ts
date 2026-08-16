/**
 * Automatic backup, and the honesty around it.
 *
 * Safari's ITP can evict IndexedDB after about seven idle days and
 * `navigator.storage.persist()` is granted inconsistently, so a group that
 * plays every three weeks can lose a character between sessions. A character
 * is months of someone's work: losing it is the one unforgivable bug in an app
 * like this (Architecture 6).
 *
 * Four things, in the order the architecture lists them:
 *   1. a folder the user picks once, remembered across sessions
 *   2. an export at the end of a session and when the page goes away
 *   3. "last backup: 3 days ago", which gets loud after five
 *   4. after seven idle days, an integrity check that offers a restore
 *
 * And one rule that outranks all of them: **never claim a backup happened.**
 * If the browser has no folder, or the permission lapsed, or the write failed,
 * that is what the status says. A user who believes they are backed up and is
 * not is worse off than one who knows they are not.
 *
 * The folder handle lives in a small IndexedDB of its own rather than in the
 * app database: it is the one thing here that must survive a `clearAll()`, and
 * keeping it separate means backup can never be the reason a schema migration
 * touches the character store.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { Character } from '../../shared/types.ts';
import {
  backupFileName,
  directoryAccess,
  chooseDirectory,
  parseTransferFile,
  saveTextFile,
  serializeBackup,
  writeIntoDirectory,
  type DirectoryAccess,
  type SaveRoute,
} from '../transfer/fileIo.ts';
import * as db from './db.ts';
import { loadPrefs, savePrefs, type Prefs } from './prefs.ts';

/** The indicator stops being discreet here. */
export const NAG_AFTER_DAYS = 5;
/** ITP's eviction window. Past this, check before trusting what is on disk. */
export const INACTIVE_DAYS = 7;

// ---------------------------------------------------------------------------
// The bits of bookkeeping that are not preferences
// ---------------------------------------------------------------------------

const RECORD_KEY = 'dhc.backup.v1';

interface BackupRecord {
  /** ISO of the last session that ran the integrity check. */
  lastSeenAt?: string;
  /** Character ids present at the end of the last session. */
  knownCharacterIds?: string[];
  /** Count and latest edit at the last successful backup, to skip no-op writes. */
  fingerprint?: string;
  lastError?: string;
  lastFileName?: string;
}

function readRecord(): BackupRecord {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(RECORD_KEY);
    return raw === null ? {} : (JSON.parse(raw) as BackupRecord);
  } catch {
    return {};
  }
}

function writeRecord(patch: BackupRecord): BackupRecord {
  const next = { ...readRecord(), ...patch };
  try {
    localStorage?.setItem(RECORD_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota. The backup itself still happened.
  }
  return next;
}

export interface BackupDeps {
  listCharacters: () => Promise<Character[]>;
  readPrefs: () => Prefs;
  /** Merged into the stored preferences. The app passes the store's setter. */
  writePrefs: (patch: Partial<Prefs>) => void;
  now: () => Date;
}

const DEFAULT_DEPS: BackupDeps = {
  listCharacters: () => db.listCharacters(),
  readPrefs: loadPrefs,
  writePrefs: (patch) => savePrefs({ ...loadPrefs(), ...patch }),
  now: () => new Date(),
};

const withDeps = (deps?: Partial<BackupDeps>): BackupDeps => ({ ...DEFAULT_DEPS, ...deps });

// ---------------------------------------------------------------------------
// The folder
// ---------------------------------------------------------------------------

const HANDLE_DB = 'daggerheart-backup';
const HANDLE_STORE = 'handles';
const HANDLE_KEY = 'directory';

let sessionHandle: FileSystemDirectoryHandle | null = null;
let sessionAccess: DirectoryAccess | null = null;

/**
 * One connection, held for the session, the way `db.ts` holds the app's.
 * `loadBackupFolder` runs on every `visibilitychange`, so opening a fresh
 * connection per call would leave dozens of them open - and an open connection
 * blocks any future version change of this database.
 */
let handlePromise: Promise<IDBPDatabase> | null = null;

async function handleStore(): Promise<IDBPDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    // A failure is not cached: it may be a transient lock, and giving up on the
    // folder for the rest of the session would silently stop the backups.
    handlePromise ??= openDB(HANDLE_DB, 1, {
      upgrade(database) {
        database.createObjectStore(HANDLE_STORE);
      },
    });
    return await handlePromise;
  } catch {
    handlePromise = null;
    return null;
  }
}

/** The folder chosen in an earlier session, if the browser still has it. */
export async function loadBackupFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (sessionHandle !== null) return sessionHandle;
  const store = await handleStore();
  if (store === null) return null;
  try {
    const handle = (await store.get(HANDLE_STORE, HANDLE_KEY)) as
      | FileSystemDirectoryHandle
      | undefined;
    sessionHandle = handle ?? null;
    if (sessionHandle !== null) sessionAccess = await directoryAccess(sessionHandle);
    return sessionHandle;
  } catch {
    return null;
  }
}

export interface FolderChoice {
  ok: boolean;
  name: string | null;
  cancelled: boolean;
  reason: string | null;
}

/** Ask for the backup folder. Must be called from a user gesture. */
export async function chooseBackupFolder(deps?: Partial<BackupDeps>): Promise<FolderChoice> {
  const d = withDeps(deps);
  const choice = await chooseDirectory();
  if (!choice.ok || choice.handle === null) {
    return { ok: false, name: null, cancelled: choice.cancelled, reason: choice.reason };
  }
  sessionHandle = choice.handle;
  sessionAccess = await directoryAccess(choice.handle, { request: true });
  const store = await handleStore();
  let reason: string | null = null;
  try {
    await store?.put(HANDLE_STORE, choice.handle, HANDLE_KEY);
  } catch {
    // Firefox has the picker but will not structured-clone the handle. Say so:
    // backups will work this session and have to be re-picked in the next one.
    reason = 'This browser will not remember the folder, so it has to be chosen again next time.';
  }
  d.writePrefs({ backupTarget: choice.name ?? undefined });
  return { ok: true, name: choice.name, cancelled: false, reason };
}

export async function forgetBackupFolder(deps?: Partial<BackupDeps>): Promise<void> {
  sessionHandle = null;
  sessionAccess = null;
  const store = await handleStore();
  try {
    await store?.delete(HANDLE_STORE, HANDLE_KEY);
  } catch {
    // Nothing to forget.
  }
  withDeps(deps).writePrefs({ backupTarget: undefined });
}

/** Re-check the folder permission. The settings screen calls this when opened. */
export async function checkBackupFolder(): Promise<{
  name: string | null;
  access: DirectoryAccess | 'none';
}> {
  const handle = await loadBackupFolder();
  if (handle === null) return { name: null, access: 'none' };
  sessionAccess = await directoryAccess(handle);
  return { name: handle.name, access: sessionAccess };
}

// ---------------------------------------------------------------------------
// Running a backup
// ---------------------------------------------------------------------------

export type BackupTrigger = 'manual' | 'session-end' | 'page-hide' | 'startup';

export interface BackupOutcome {
  ok: boolean;
  /** False when nothing needed doing, which is not a failure. */
  wrote: boolean;
  route: SaveRoute | 'none';
  fileName: string | null;
  characters: number;
  /** English, ready to show. Null when a backup was written. */
  reason: string | null;
  at: string | null;
}

const fingerprintOf = (characters: readonly Character[]): string =>
  `${characters.length}:${characters.map((c) => c.updatedAt).sort().at(-1) ?? ''}`;

/**
 * Write the whole library out.
 *
 * Automatic triggers only ever write into the chosen folder: a download or a
 * share sheet needs a user gesture, and a browser that refuses one silently
 * would leave the app claiming a backup that never happened. A manual run may
 * use any route.
 */
export async function runBackup(
  trigger: BackupTrigger = 'manual',
  options: { interactive?: boolean } = {},
  deps?: Partial<BackupDeps>,
): Promise<BackupOutcome> {
  const d = withDeps(deps);
  const at = d.now();
  const characters = await d.listCharacters();
  const none = (reason: string): BackupOutcome => ({
    ok: true,
    wrote: false,
    route: 'none',
    fileName: null,
    characters: characters.length,
    reason,
    at: null,
  });

  if (characters.length === 0) return none('There are no characters to back up yet.');

  const record = readRecord();
  const fingerprint = fingerprintOf(characters);
  if (trigger !== 'manual' && record.fingerprint === fingerprint) {
    return none('Nothing has changed since the last backup.');
  }

  const text = serializeBackup(characters, at);
  const fileName = backupFileName(at);
  const interactive = options.interactive === true || trigger === 'manual';

  const handle = await loadBackupFolder();
  if (handle !== null) {
    const access = await directoryAccess(handle, { request: interactive });
    sessionAccess = access;
    if (access === 'granted' || access === 'unsupported') {
      // Read it back and count it before believing it. `backup.ts` opens with
      // "never claim a backup happened"; a stream that resolved is not a file
      // on disk that a future build can open.
      const result = await writeIntoDirectory(handle, fileName, text, {
        verify: (written) => {
          try {
            const found = parseTransferFile(written).characters.length;
            return found === characters.length
              ? null
              : `${fileName} came back holding ${String(found)} character${found === 1 ? '' : 's'} instead of ${String(characters.length)}`;
          } catch (error) {
            return `${fileName} was written but could not be read back (${error instanceof Error ? error.message : String(error)})`;
          }
        },
      });
      if (result.ok) return stamp(d, at, fileName, 'file-system', characters.length, fingerprint);
      writeRecord({ lastError: result.reason ?? 'The backup folder refused the write.' });
      if (!interactive) return { ...none(result.reason ?? 'The backup folder refused the write.'), ok: false };
    } else if (!interactive) {
      const reason =
        access === 'denied'
          ? `This browser no longer has permission to write to "${handle.name}". Open Settings and choose the folder again.`
          : `"${handle.name}" needs your confirmation before it can be written to again. Open Settings and choose the folder.`;
      writeRecord({ lastError: reason });
      return { ...none(reason), ok: false };
    }
  } else if (!interactive) {
    return none('No backup folder has been chosen, so nothing is exported automatically.');
  }

  // Manual, or the folder let us down while somebody was watching.
  const saved = await saveTextFile(fileName, text);
  if (saved.ok) {
    return stamp(d, at, saved.fileName, saved.route ?? 'download', characters.length, fingerprint);
  }
  if (saved.cancelled) return none('The export was cancelled, so nothing was written.');
  writeRecord({ lastError: saved.reason ?? 'The export failed.' });
  return { ...none(saved.reason ?? 'The export failed.'), ok: false };
}

function stamp(
  d: BackupDeps,
  at: Date,
  fileName: string,
  route: SaveRoute,
  characters: number,
  fingerprint: string,
): BackupOutcome {
  const iso = at.toISOString();
  d.writePrefs({ lastBackupAt: iso });
  writeRecord({ fingerprint, lastFileName: fileName, lastError: undefined });
  return { ok: true, wrote: true, route, fileName, characters, reason: null, at: iso };
}

/** End of session: the app is closing or the user has finished playing. */
export const backupAtSessionEnd = (deps?: Partial<BackupDeps>): Promise<BackupOutcome> =>
  runBackup('session-end', {}, deps);

/**
 * Back up when the user leaves the app, and when the page goes away.
 *
 * Two events, because the sentence on the settings screen makes two promises
 * and both of them have to be true: `visibilitychange` to `hidden` is a person
 * putting the app down, and `pagehide` is the page being taken away.
 *
 * `pagehide` is the only lifecycle event iOS Safari reliably delivers, and it
 * does not wait for a promise: the write is started, and may be cut short if
 * the phone freezes the page immediately. That is why the file carries a date
 * in its name - a truncated write can only ever spoil today's copy, and
 * yesterday's is still sitting next to it.
 *
 * One `running` flag across both. Closing a tab fires `visibilitychange` and
 * then `pagehide`, and two `createWritable()` calls on the same file collide on
 * the lock - the loser records a failure, and the settings screen would go red
 * every single time the app was closed.
 */
export function installBackupHooks(deps?: Partial<BackupDeps>): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let running = false;
  const fire = (leaving: boolean): void => {
    if (running) return;
    running = true;
    /*
     * What is on the disk right now, so the next launch has something to
     * compare against. Deliberately on the default deps, and deliberately
     * reading IndexedDB rather than the store: a list taken from memory would
     * record a character whose write had not landed, and the next launch would
     * then report it as one the browser had evicted. Reading the disk can only
     * fail to notice a loss, never invent one.
     */
    void noteSession().catch(() => {
      // A bookkeeping note is not worth a sentence on screen.
    });
    void (leaving ? backupAtSessionEnd(deps) : runBackup('page-hide', {}, deps)).finally(() => {
      running = false;
    });
  };
  const onPageHide = (): void => fire(false);
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') fire(true);
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onHidden);
  return () => {
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onHidden);
  };
}

// ---------------------------------------------------------------------------
// The indicator
// ---------------------------------------------------------------------------

export type BackupLevel = 'never' | 'fresh' | 'aging' | 'overdue' | 'failing';

export interface BackupStatus {
  lastBackupAt: string | null;
  daysSince: number | null;
  level: BackupLevel;
  /** "last backup: 3 days ago". */
  label: string;
  /** The honest second line, when there is something the user should know. */
  detail: string | null;
  targetName: string | null;
  /** True only when a folder is live *and* permitted right now. */
  automatic: boolean;
  lastError: string | null;
}

/**
 * Whole days between a stamp and now. `prefs.daysSinceBackup` says the same
 * thing against the wall clock; this one takes its clock from the caller, so
 * the status and a backup written in the same breath cannot disagree.
 */
const daysSince = (iso: string | undefined, now: Date): number | null => {
  if (iso === undefined) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
};

const agoLabel = (days: number | null): string => {
  if (days === null) return 'no backup yet';
  if (days <= 0) return 'last backup: today';
  if (days === 1) return 'last backup: yesterday';
  return `last backup: ${days} days ago`;
};

/**
 * Synchronous on purpose: it is read on every render of the header. The
 * permission state it reports is the one last observed, so a settings screen
 * that wants certainty calls `checkBackupFolder` first.
 */
export function backupStatus(deps?: Partial<BackupDeps>): BackupStatus {
  const d = withDeps(deps);
  const prefs = d.readPrefs();
  const record = readRecord();
  const days = daysSince(prefs.lastBackupAt, d.now());
  const automatic = sessionHandle !== null && (sessionAccess === 'granted' || sessionAccess === 'unsupported');

  let level: BackupLevel;
  if (record.lastError !== undefined) level = 'failing';
  else if (days === null) level = 'never';
  else if (days >= INACTIVE_DAYS) level = 'overdue';
  else if (days >= NAG_AFTER_DAYS) level = 'aging';
  else level = 'fresh';

  let detail: string | null = null;
  if (record.lastError !== undefined) detail = record.lastError;
  else if (!automatic && prefs.backupTarget !== undefined) {
    detail = `Backups go to "${prefs.backupTarget}", but this browser has not re-opened that folder yet.`;
  } else if (!automatic) {
    detail = 'Nothing is exported automatically until you choose a folder to keep backups in.';
  }

  return {
    lastBackupAt: prefs.lastBackupAt ?? null,
    daysSince: days,
    level,
    label: agoLabel(days),
    detail,
    targetName: prefs.backupTarget ?? null,
    automatic,
    lastError: record.lastError ?? null,
  };
}

// ---------------------------------------------------------------------------
// Seven days later
// ---------------------------------------------------------------------------

export interface IntegrityReport {
  /** Days since the app was last opened, null on a first run. */
  inactiveDays: number | null;
  /** True when the gap was long enough for ITP to have been at work. */
  triggered: boolean;
  healthy: boolean;
  /** Characters at the end of the last session, and now. */
  expected: number;
  found: number;
  missingIds: string[];
  persisted: boolean;
  /** True when there is a backup worth offering. */
  canRestore: boolean;
  lastBackupAt: string | null;
  message: string;
}

/**
 * Run at startup. After a week of silence, check that what the last session
 * left behind is still there, and say plainly when it is not.
 *
 * The comparison is against a list kept in localStorage, which is a different
 * store with different eviction rules: when IndexedDB has been cleared and
 * localStorage has not, the difference is the evidence. When both are gone
 * there is nothing to compare and nothing to claim, so the report says the
 * check could not be made rather than inventing a clean bill of health.
 */
export async function integrityCheck(deps?: Partial<BackupDeps>): Promise<IntegrityReport> {
  const d = withDeps(deps);
  const prefs = d.readPrefs();
  const record = readRecord();
  const now = d.now();

  const lastSeen = record.lastSeenAt === undefined ? null : Date.parse(record.lastSeenAt);
  const inactiveDays =
    lastSeen === null || Number.isNaN(lastSeen)
      ? null
      : Math.floor((now.getTime() - lastSeen) / 86_400_000);

  let characters: Character[] = [];
  let readable = true;
  try {
    characters = await d.listCharacters();
  } catch {
    readable = false;
  }

  let persisted = false;
  try {
    persisted = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    persisted = false;
  }

  const known = record.knownCharacterIds ?? [];
  const here = new Set(characters.map((c) => c.id));
  const missingIds = known.filter((id) => !here.has(id));
  const triggered = inactiveDays !== null && inactiveDays >= INACTIVE_DAYS;
  const healthy = readable && missingIds.length === 0;
  const canRestore = prefs.lastBackupAt !== undefined;

  let message: string;
  if (!readable) {
    message = 'The character store could not be opened on this device.';
  } else if (missingIds.length > 0) {
    /*
     * The cause is a separate claim from the fact, and it is only ever made
     * when there is evidence for it.
     *
     * This used to append "This browser clears stored data after about a week
     * of not being used" whenever anything was missing, with no gate. Delete a
     * character, have the tab closed before `noteSession` ran, open the app
     * five minutes later, and the app blamed the browser for something the
     * user did - inside the one module whose first rule is never to claim
     * something happened that did not. `triggered` is the evidence, and it has
     * existed here since the beginning without being consulted.
     */
    const one = missingIds.length === 1;
    message =
      `${missingIds.length} character${one ? '' : 's'} that ${one ? 'was' : 'were'} here at the end of the last session ${one ? 'is' : 'are'} not on this device now.` +
      (triggered
        ? ` This browser clears stored data after about a week of not being used, and it has been ${String(inactiveDays)} days.`
        : '');
  } else if (known.length === 0 && characters.length === 0) {
    message = 'Nothing to check yet.';
  } else if (triggered) {
    message = `${characters.length} character${characters.length === 1 ? '' : 's'} still here after ${String(inactiveDays)} days away.`;
  } else {
    message = `${characters.length} character${characters.length === 1 ? '' : 's'} on this device.`;
  }
  if (!healthy && !canRestore) {
    message += ' There is no backup to restore from.';
  }

  // Record what this session can see, so the next one has something to compare
  // against - including after a loss, so the same loss is only reported once.
  //
  // Except when the store could not be opened at all: `here` is then empty for
  // want of an answer, not because the characters are gone, and writing it
  // would destroy the only record of what used to be here. One unreadable
  // startup would leave every later check reporting a clean bill of health
  // over an empty database.
  writeRecord(
    readable
      ? { lastSeenAt: now.toISOString(), knownCharacterIds: [...here] }
      : { lastSeenAt: now.toISOString() },
  );

  return {
    inactiveDays,
    triggered,
    healthy,
    expected: known.length,
    found: characters.length,
    missingIds,
    persisted,
    canRestore,
    lastBackupAt: prefs.lastBackupAt ?? null,
    message,
  };
}

/** Record the current library without checking anything. Cheap, call on save. */
export async function noteSession(deps?: Partial<BackupDeps>): Promise<void> {
  const d = withDeps(deps);
  const characters = await d.listCharacters();
  writeRecord({
    lastSeenAt: d.now().toISOString(),
    knownCharacterIds: characters.map((c) => c.id),
  });
}

/** Ask for persistent storage. Best asked while explaining why (Architecture 6). */
export const requestPersistence = (): Promise<db.StorageHealth> => db.requestPersistence();
