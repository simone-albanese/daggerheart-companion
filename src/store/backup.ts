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
 *
 * ## Campaigns
 *
 * The GM's campaigns live in the same IndexedDB that ITP evicts, and for a long
 * time this file had never heard of them - `grep -ci campaign backup.ts` was 0,
 * so a GM with three tables and no characters was told there were no characters
 * to back up and got nothing. A campaign holds the night's plan, the archive,
 * the register and whole copies of the players' sheets; it is the same class of
 * loss as a character and it had no net at all.
 *
 * Each campaign is one dated `.dhcampaign` beside the `.dhbackup`, in the same
 * folder, never a field inside it. That envelope carries the *character* schema
 * number, validates against character numbers and has no checksum, so an older
 * build meeting a combined file would restore the characters and drop the
 * campaigns in silence - half a restore, arriving by the back door. Separate
 * files also keep the daily rotation intact: a `pagehide` write cut short can
 * only ever spoil today's copy of one campaign.
 *
 * Nothing here is ever evicted or deleted. The count stays sane because a
 * campaign that was not played produces no file, not because anything prunes:
 * the folder is the user's, and a delete bug in the one place that holds the
 * only copies is not a bug this subsystem is willing to be able to have.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { Campaign } from '../../shared/campaigns.ts';
import { slugify } from '../../shared/slugify.ts';
import type { Character } from '../../shared/types.ts';
import {
  CAMPAIGN_EXTENSION,
  campaignChecksum,
  parseCampaignFile,
  serializeCampaign,
} from '../transfer/campaignFile.ts';
import { crc32 } from '../transfer/crc32.ts';
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
import { readCampaigns, type CampaignLibrary } from './campaigns.ts';
import { currentCampaigns, type CampaignSnapshot } from './campaignSource.ts';
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

/**
 * What is known about one campaign's copies.
 *
 * `checksum` is `campaignChecksum` of the record that was last *verified* into
 * the folder, and it is the whole skip gate for that campaign. Content, not
 * `updatedAt`, and that is forced rather than preferred: `snapshotCampaigns`
 * gathers a dirty board keeping `c.updatedAt` stable on purpose, so an
 * `updatedAt` fingerprint would look unchanged and skip exactly the board the
 * GM has spent the evening editing.
 *
 * `lastCopyAt` and `route` are a copy the GM saved by hand, and they
 * deliberately do **not** set `checksum`. `saveTextFile` reads nothing back: a
 * `download` or a `share` means the click happened, not that a file exists.
 * Recording it anyway is what lets an iOS GM who exports every week read
 * something other than "no backup yet" for ever.
 */
interface CampaignNote {
  /** crc32 of the record last read back out of the folder. */
  checksum?: number;
  fileName?: string;
  at?: string;
  /** A copy saved by hand, through a route that cannot be verified. */
  lastCopyAt?: string;
  route?: SaveRoute;
}

interface BackupRecord {
  /** ISO of the last session that ran the integrity check. */
  lastSeenAt?: string;
  /** Character ids present at the end of the last session. */
  knownCharacterIds?: string[];
  /** Campaign ids present at the end of the last session, quarantine included. */
  knownCampaignIds?: string[];
  /** Count and latest edit at the last successful backup, to skip no-op writes. */
  fingerprint?: string;
  /** Per campaign, keyed on `campaign.id`. One entry per campaign, not per file. */
  campaigns?: Record<string, CampaignNote>;
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
  /**
   * What `runBackup` writes: the freshest campaigns this app has, from memory
   * when the GM store has published itself. See `campaignSource.ts` for why a
   * disk-sourced backup is wrong in exactly the case a backup is for.
   */
  liveCampaigns: () => Promise<CampaignSnapshot>;
  /**
   * What is on the **disk**, quarantine included, and never the snapshot.
   *
   * `integrityCheck` and `noteSession` take this one and nothing else. Their
   * only evidence is the difference between a disk read and a list in
   * localStorage, and a store-sourced list can never throw - which would make
   * the "could not be opened" branch unreachable and turn one bad launch into a
   * fabricated loss.
   */
  listCampaigns: () => Promise<CampaignLibrary>;
  readPrefs: () => Prefs;
  /** Merged into the stored preferences. The app passes the store's setter. */
  writePrefs: (patch: Partial<Prefs>) => void;
  now: () => Date;
}

const DEFAULT_DEPS: BackupDeps = {
  listCharacters: () => db.listCharacters(),
  liveCampaigns: currentCampaigns,
  listCampaigns: () => readCampaigns(),
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
  /**
   * True only when everything that needed writing wrote.
   *
   * False when nothing needed doing, which is not a failure - and false on a
   * run that got some files down and not others, which is. Four callers branch
   * on this field to choose between "Saved …" and `reason`, so a partial run
   * reading as a success here would be the false claim this file opens by
   * forbidding, printed in four places. What *did* land on a failed run is named
   * in `reason` rather than swallowed.
   */
  wrote: boolean;
  route: SaveRoute | 'none';
  /** The `.dhbackup`, when one landed. Campaign files are counted separately. */
  fileName: string | null;
  characters: number;
  /** Campaign files written by this run. */
  campaigns: number;
  /** Their names, in the order they were written, for a sentence that names. */
  campaignNames: string[];
  /**
   * Campaigns a newer build wrote, which are on this device and not in the
   * backup. A notice, never a failure - see `notice`.
   */
  notReadable: string[];
  /**
   * Something the user should know that is **not** a failure claim.
   *
   * A quarantined campaign is present on the disk and untouched, so it does not
   * block the stamp and is not reported missing; a device with no folder cannot
   * take campaign files at all. Both are true sentences about a run that
   * succeeded, and the one thing this module may never do is let a true sentence
   * be read as a failure or a failure be read as a success.
   */
  notice: string | null;
  /** English, ready to show. Null when a backup was written. */
  reason: string | null;
  at: string | null;
}

/**
 * What a run that wrote something actually wrote, in words.
 *
 * Here rather than at the four screens that show it, because the campaign leg
 * made the old one-liner a lie and it was copied four times. Every caller said
 * `Saved ${outcome.fileName ?? 'the copy'} - ${outcome.characters} characters`,
 * which was safe only while `wrote` implied a character file: `runBackup`
 * returned early on an empty library, so `fileName` was never null on a run
 * that succeeded. It can be now. A GM who plays nobody, and a run where the
 * library was unchanged and only a board moved, both land here with
 * `fileName: null` and a `characters` count of a file that was not written -
 * and four screens would have said "Saved the copy - 4 characters" over a
 * folder holding one `.dhcampaign`. That is the claim this module opens by
 * forbidding, printed in four places.
 *
 * So the count is spoken only when the file holding it landed this run, and the
 * campaigns are **named** rather than counted, because "and 2 campaign files"
 * is exactly the naming-versus-counting failure one step from coming back.
 *
 * `notice` is not folded in: it is a true sentence about something that is not
 * a failure, each screen has its own tail to put after this one, and a caller
 * that dropped it would be silently deciding the user does not need to know.
 */
export function savedFiles(outcome: BackupOutcome): string {
  const files = [
    outcome.fileName,
    outcome.campaigns === 0
      ? null
      : `${String(outcome.campaigns)} campaign file${outcome.campaigns === 1 ? '' : 's'}`,
  ].filter((line): line is string => line !== null);
  const held = [
    outcome.fileName === null
      ? null
      : `${String(outcome.characters)} character${outcome.characters === 1 ? '' : 's'}`,
    ...outcome.campaignNames.map((name) => `"${name}"`),
  ].filter((line): line is string => line !== null);
  // Unreachable through `runBackup`, which returns before the stamp when
  // nothing landed - and said rather than left as `Saved  — .` if it ever is.
  if (files.length === 0) return 'Nothing was written.';
  return `Saved ${files.join(' and ')} — ${held.join(', ')}.`;
}

const fingerprintOf = (characters: readonly Character[]): string =>
  `${characters.length}:${characters.map((c) => c.updatedAt).sort().at(-1) ?? ''}`;

/**
 * `daggerheart-<slug>-<8 hex of the id>-YYYY-MM-DD.dhcampaign`.
 *
 * Minted here rather than in `campaignFile.ts`: the undated `campaignFileName`
 * there is the *hand-off* name, and a dated per-campaign name is a rule of this
 * regime rather than of the format.
 *
 * The eight hex of the id is not decoration. `slugify` collapses every run of
 * non-alphanumerics to one dash, so "The Sablewood, Winter" and "The Sablewood
 * Winter" are the same slug, and a name written entirely in a non-Latin script
 * slugifies to `''`. Two campaigns landing on one file name is a silent loss
 * *inside the backup*, which is the one place this app must not have one. The
 * id itself cannot go in the name - it is any string a record carries, today
 * `campaign-from-gm-v1` and tomorrow whatever a hand-edited file holds - and a
 * crc32 collision is caught anyway, because `verify` parses the file back and
 * compares `campaign.id`. The date is last so a listing groups by campaign and
 * orders by day.
 */
export const campaignBackupFileName = (c: Campaign, at: Date): string =>
  `daggerheart-${slugify(c.name) || 'campaign'}-${crc32(new TextEncoder().encode(c.id))
    .toString(16)
    .padStart(8, '0')}-${at.toISOString().slice(0, 10)}${CAMPAIGN_EXTENSION}`;

/**
 * The sentence about a campaign a newer build wrote.
 *
 * Named, never counted, and never `lastError`. The record is on the disk and
 * left exactly as it is, which is what `readCampaigns` quarantine is *for*;
 * nothing in the UI can even reach such a record to clear it, and the next
 * campaign schema bump manufactures this state on every older tab by design. A
 * net that goes red the day a bump ships trains the GM to ignore the one
 * indicator that matters, which is this module's own first rule failing from
 * the other direction.
 */
const notReadableNotice = (
  quarantined: readonly { name: string | null }[],
): string | null => {
  if (quarantined.length === 0) return null;
  const one = quarantined.length === 1;
  const named = quarantined.map((q) => `"${q.name ?? 'A campaign'}"`).join(', ');
  return (
    `${one ? 'One campaign' : `${String(quarantined.length)} campaigns`} on this device ` +
    `${one ? 'was' : 'were'} written by a newer version of this app and ${one ? 'is' : 'are'} ` +
    `not in the backup (${named}): close every tab of this app and open it again, then back up.`
  );
};

/**
 * The sentence for a device that has campaigns and no folder to put them in.
 *
 * A `.dhbackup` can go out through a share sheet because one gesture carries
 * one file. Campaigns are one file each, and firing N share sheets at somebody
 * leaving the app is not a backup, it is an ambush. So on iOS - where there is
 * no folder picker at all - the campaign route is SAVE A COPY, by hand, and
 * this says so rather than leaving the folder quietly short.
 */
const noFolderNotice = (campaigns: readonly Campaign[]): string =>
  `Campaign files can only be written into a folder, and this browser has none, so ` +
  `${campaigns.map((c) => `"${c.name || 'A campaign'}"`).join(', ')} ` +
  `${campaigns.length === 1 ? 'is' : 'are'} not in this backup. SAVE A COPY in the GM ` +
  `section writes one campaign to a file by hand.`;

/**
 * Write the whole library out, and every campaign that has changed with it.
 *
 * Automatic triggers only ever write into the chosen folder: a download or a
 * share sheet needs a user gesture, and a browser that refuses one silently
 * would leave the app claiming a backup that never happened. A manual run may
 * use any route - for the characters. Campaign files go into the folder and
 * nowhere else, for the reason `noFolderNotice` gives.
 *
 * Characters first (`db.ts`: "the only truly precious data"), then one file per
 * changed campaign, then **one** stamp. The stamp used to be a `return` the
 * moment the character file landed; it is now reached only when everything that
 * needed writing wrote. A run where four characters landed and one campaign did
 * not names that campaign in `lastError`, leaves `lastBackupAt` exactly where it
 * was and reports `failing` - because "last backup: today" sitting over a
 * campaign that has never reached the folder is the precise lie this file opens
 * by forbidding.
 *
 * The gates are per target. An unchanged library must not stop a campaign file
 * being written, and an unchanged campaign must not stop the `.dhbackup`.
 */
export async function runBackup(
  trigger: BackupTrigger = 'manual',
  options: { interactive?: boolean } = {},
  deps?: Partial<BackupDeps>,
): Promise<BackupOutcome> {
  const d = withDeps(deps);
  const at = d.now();
  const characters = await d.listCharacters();
  /*
   * Guarded on its own, the way `integrityCheck` and `noteSession` guard their
   * reads of the same store, and for a stronger reason: this is the one that
   * *writes*.
   *
   * Unguarded, this await was the second statement of the function, so a
   * campaign store that would not open aborted the whole run - the character
   * file included - from inside a `void … .finally()` with no `.catch`, which
   * left the indicator green over a backup that never happened. The characters
   * are already in hand at this point (`backupDeps.ts` serves them from memory)
   * and they have nothing to do with the campaign store; before the campaign
   * leg existed a broken campaign store could not cost them anything, and it
   * must not start now.
   *
   * It degrades to a *named failure*, never to an empty list: the empty list is
   * seeded into `campaignFailures` in the same breath, so the run takes the
   * `lastError` exit, the `.dhbackup` still lands, the clock is not stamped and
   * the indicator goes red with the reason on it.
   */
  let snapshot: CampaignSnapshot = { campaigns: [], quarantined: [] };
  let campaignDoorFailure: string | null = null;
  try {
    snapshot = await d.liveCampaigns();
  } catch {
    campaignDoorFailure =
      'The campaigns on this device could not be read, so none of them is in this backup. ' +
      'Close every tab of this app and open it again, then back up.';
  }
  const campaigns = snapshot.campaigns;

  const quarantine = notReadableNotice(snapshot.quarantined);
  /** Set once the folder question has been answered and the answer is "none". */
  let noFolderSaid: string | null = null;
  const notice = (): string | null => {
    const said = [quarantine, noFolderSaid].filter((s): s is string => s !== null);
    return said.length === 0 ? null : said.join(' ');
  };

  const none = (reason: string): BackupOutcome => ({
    ok: true,
    wrote: false,
    route: 'none',
    fileName: null,
    characters: characters.length,
    campaigns: 0,
    campaignNames: [],
    notReadable: snapshot.quarantined.map((q) => q.name ?? q.id),
    notice: notice(),
    reason,
    at: null,
  });

  /*
   * Both empty, not just no characters.
   *
   * A GM who runs the table and plays nobody is a normal user of this app, and
   * until this line they were told there was nothing to back up and got
   * nothing - while the folder they had chosen sat empty and the indicator
   * never moved.
   */
  // `campaignDoorFailure` exempts both "nothing to do" returns, or the guard
  // above trades one lie for a quieter one: an unreadable campaign store on a
  // character-less device would report "nothing to back up" over campaigns that
  // are sitting right there.
  if (characters.length === 0 && campaigns.length === 0 && campaignDoorFailure === null) {
    return none('There is nothing to back up yet.');
  }

  const record = readRecord();
  const notes = record.campaigns ?? {};
  const fingerprint = fingerprintOf(characters);
  const sums = new Map(campaigns.map((c) => [c.id, campaignChecksum(c)] as const));
  const charactersDue =
    characters.length > 0 && (trigger === 'manual' || record.fingerprint !== fingerprint);
  const campaignsDue = campaigns.filter(
    (c) => trigger === 'manual' || notes[c.id]?.checksum !== sums.get(c.id),
  );

  if (!charactersDue && campaignsDue.length === 0 && campaignDoorFailure === null) {
    return none('Nothing has changed since the last backup.');
  }

  const interactive = options.interactive === true || trigger === 'manual';
  const fileName = backupFileName(at);
  const text = charactersDue ? serializeBackup(characters, at) : null;

  const handle = await loadBackupFolder();
  let folder: FileSystemDirectoryHandle | null = null;
  /**
   * Why the folder is unusable, when there *is* one and it said no.
   *
   * Remembered rather than composed and thrown away inside the `!interactive`
   * arm. An interactive run falls through here on purpose - the character file
   * still goes out by hand - but it used to fall through with `folder` null and
   * nothing else, and the line below then read that null as "this device has no
   * folder". A Chrome user whose remembered handle had gone back to `prompt`
   * was told their browser has no folder picker, handed the iOS remedy, stamped
   * "last backup: today" and had a standing `lastError` wiped off the panel -
   * the honest sentence the automatic run had already recorded, erased by the
   * button pressed to fix it.
   */
  let folderRefused: string | null = null;
  if (handle !== null) {
    const access = await directoryAccess(handle, { request: interactive });
    sessionAccess = access;
    if (access === 'granted' || access === 'unsupported') {
      folder = handle;
    } else {
      folderRefused =
        access === 'denied'
          ? `This browser no longer has permission to write to "${handle.name}". Open Settings and choose the folder again.`
          : `"${handle.name}" needs your confirmation before it can be written to again. Open Settings and choose the folder.`;
      if (!interactive) {
        writeRecord({ lastError: folderRefused });
        return { ...none(folderRefused), ok: false };
      }
    }
  } else if (!interactive) {
    return none('No backup folder has been chosen, so nothing is exported automatically.');
  }
  /**
   * Campaigns that missed the folder because it refused, not because there is
   * none. A failure, and never a `notice`: `notice` is documented as a true
   * sentence about a run that *succeeded*, which is what the device with no
   * picker at all gets, and folding a broken permission into it is how a run
   * over a dead folder came back green.
   */
  let refusedCampaigns: string | null = null;
  if (folder === null && campaignsDue.length > 0) {
    if (folderRefused === null) noFolderSaid = noFolderNotice(campaignsDue);
    else {
      const one = campaignsDue.length === 1;
      refusedCampaigns =
        `Campaign files can only be written into a folder. ${folderRefused} Until then ` +
        `${campaignsDue.map((c) => `"${c.name || 'A campaign'}"`).join(', ')} ` +
        `${one ? 'is' : 'are'} not in this backup.`;
    }
  }

  let charactersLanded = false;
  let characterFailure: string | null = null;
  let route: SaveRoute | null = null;
  const campaignNames: string[] = [];
  // Seeded with the campaign door, when it would not open. That is what routes
  // the guard at the top of this function through the machinery already here:
  // `lastError` is recorded, `partial(…, false)` is returned, the clock is not
  // stamped - and the character file, written above, is kept.
  const campaignFailures: string[] = campaignDoorFailure === null ? [] : [campaignDoorFailure];
  const landed: Record<string, CampaignNote> = {};

  /**
   * Keep what actually reached the folder, even on a run that failed overall.
   *
   * Those files were written and read back; rewriting them on the next trigger
   * would be work with nothing behind it. Re-read rather than merged onto the
   * copy taken at the top of the run, because `noteCampaignCopy` writes into
   * the same key from the GM's own SAVE A COPY.
   */
  const remember = (patch: BackupRecord = {}): void => {
    if (Object.keys(landed).length === 0) {
      writeRecord(patch);
      return;
    }
    writeRecord({ ...patch, campaigns: { ...readRecord().campaigns, ...landed } });
  };

  /**
   * A run that stopped short: `wrote` stays false, and what landed is counted.
   *
   * `none`'s `wrote: false` is inherited deliberately rather than overridden -
   * see the field's docblock. The files that did land are still reported, so a
   * caller has the facts even though the run is not a backup.
   */
  const partial = (reason: string, ok: boolean): BackupOutcome => ({
    ...none(reason),
    ok,
    route: route ?? 'none',
    fileName: charactersLanded ? fileName : null,
    campaigns: campaignNames.length,
    campaignNames,
  });

  /**
   * "…and this much did get through", so a failure never hides a success.
   *
   * Route-aware, because the folder is no longer the only way anything leaves.
   * When the folder refuses an interactive run the `.dhbackup` still goes out
   * through a download or a share sheet, and this sentence is printed over that
   * outcome - saying a file "did reach the folder" when the folder is precisely
   * what turned it away is the same class of false claim as the stamp.
   */
  const alsoLanded = (): string => {
    const said = [
      charactersLanded ? fileName : null,
      campaignNames.length === 0
        ? null
        : `${String(campaignNames.length)} campaign file${campaignNames.length === 1 ? '' : 's'} (${campaignNames
            .map((name) => `"${name}"`)
            .join(', ')})`,
    ].filter((line): line is string => line !== null);
    if (said.length === 0) return '';
    const where = route === 'file-system' ? 'did reach the folder' : 'did get out';
    return ` ${said.join(' and ')} ${where}; the rest is written again on the next attempt.`;
  };

  /**
   * Every leg that failed, character sentence first - not the first one.
   *
   * This was `characterFailure ?? campaignFailures.join(' ')`, and the `??`
   * meant a failing character leg swallowed the campaign sentences whole: a
   * campaign that never reached the folder was then named in `reason`, in
   * `detail`, in `lastError`, in `notice` and in `campaignNames` nowhere at
   * all, while the surviving sentence still appended which campaigns *did*
   * land, which reads as reassurance. Single-leg runs are unchanged, so the two
   * behaviours the suite already pins do not move.
   */
  const failedLegs = (): string | null => {
    const failures = [characterFailure, refusedCampaigns, ...campaignFailures].filter(
      (line): line is string => line !== null,
    );
    return failures.length === 0 ? null : failures.join(' ');
  };

  if (folder !== null) {
    if (text !== null) {
      // Read it back and count it before believing it. `backup.ts` opens with
      // "never claim a backup happened"; a stream that resolved is not a file
      // on disk that a future build can open.
      const result = await writeIntoDirectory(folder, fileName, text, {
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
      if (result.ok) {
        charactersLanded = true;
        route = 'file-system';
      } else {
        characterFailure = result.reason ?? 'The backup folder refused the write.';
      }
    }

    for (const c of campaignsDue) {
      const name = campaignBackupFileName(c, at);
      /*
       * The parse is inlined here rather than borrowed from `exportCampaign`,
       * exactly as the character leg above inlines `parseTransferFile`. It is
       * a stronger check than the character leg's count, because the CRC lives
       * inside the reader: a file whose bytes were edited fails here.
       */
      const result = await writeIntoDirectory(folder, name, serializeCampaign(c, at), {
        verify: (written) => {
          try {
            const back = parseCampaignFile(written).campaign;
            return back.id === c.id ? null : `${name} came back holding a different campaign`;
          } catch (error) {
            return `${name} was written but could not be read back (${error instanceof Error ? error.message : String(error)})`;
          }
        },
      });
      if (result.ok) {
        route ??= 'file-system';
        campaignNames.push(c.name || 'A campaign');
        landed[c.id] = {
          ...notes[c.id],
          checksum: sums.get(c.id) ?? 0,
          fileName: name,
          at: at.toISOString(),
        };
      } else {
        campaignFailures.push(
          `"${c.name || 'A campaign'}": ${result.reason ?? 'the backup folder refused the write.'}`,
        );
      }
    }
  }

  // Manual, or the folder let us down while somebody was watching. Characters
  // only: see `noFolderNotice`.
  if (text !== null && !charactersLanded && interactive) {
    const saved = await saveTextFile(fileName, text);
    if (saved.ok) {
      charactersLanded = true;
      characterFailure = null;
      route = saved.route ?? 'download';
    } else if (saved.cancelled) {
      /*
       * Cancelling is not an error, so no `lastError` - and not a backup
       * either, so no stamp.
       *
       * But this branch is only ever reached because something *else* already
       * failed: entering the fallback at all needs the folder leg to have gone
       * wrong with somebody watching, so `characterFailure` is non-null on
       * entry. It used to `remember()` and return here, ahead of the only line
       * on this path that writes `lastError`, which threw the folder's own
       * refusal away and left a device whose last run was clean reading "last
       * backup: 3 days ago" over a folder that had just turned everything
       * away. The cancel carries the refusal now instead of returning over it.
       * With no folder configured there is nothing to carry and the "cancelling
       * is not an error" intent is untouched.
       */
      const failed = failedLegs();
      if (failed !== null) {
        remember({ lastError: failed });
        return partial(
          `${failed} The export was cancelled, so nothing was written by hand either.${alsoLanded()}`,
          false,
        );
      }
      remember();
      return partial(
        campaignNames.length === 0
          ? 'The export was cancelled, so nothing was written.'
          : `The export was cancelled, so the character file was not written.${alsoLanded()}`,
        true,
      );
    } else {
      characterFailure = saved.reason ?? 'The export failed.';
    }
  }

  const lastError = failedLegs();
  if (lastError !== null) {
    remember({ lastError });
    return partial(`${lastError}${alsoLanded()}`, false);
  }

  if (!charactersLanded && campaignNames.length === 0) {
    /*
     * Nothing failed and nothing was written. The only route here is a device
     * whose campaigns are due and which has no folder to put them in - so the
     * clock is not touched, because it would be a claim about a file that does
     * not exist. It is the whole of what happened, so it is said as the reason
     * rather than as a note beside one.
     */
    const said = noFolderSaid ?? 'Nothing was written.';
    noFolderSaid = null;
    remember();
    return partial(said, true);
  }

  const iso = at.toISOString();
  d.writePrefs({ lastBackupAt: iso });
  const patch: BackupRecord = { lastError: undefined };
  // Only when the character file itself landed: a run that wrote campaigns
  // alone must not move the library's fingerprint past a library it did not
  // write, or the next trigger would skip it for ever.
  if (charactersLanded) {
    patch.fingerprint = fingerprint;
    patch.lastFileName = fileName;
  }
  remember(patch);

  return {
    ok: true,
    wrote: true,
    route: route ?? 'none',
    fileName: charactersLanded ? fileName : null,
    characters: characters.length,
    campaigns: campaignNames.length,
    campaignNames,
    notReadable: snapshot.quarantined.map((q) => q.name ?? q.id),
    notice: notice(),
    reason: null,
    at: iso,
  };
}

/**
 * Record a copy the GM saved by hand, without letting it look like a backup.
 *
 * Deliberately no `checksum`: that field is what suppresses a folder write, and
 * only `writeIntoDirectory` - which opens the file again and compares it - has
 * earned the right to set it. A `download` or a `share` route means the click
 * happened. Leaving it unrecorded, which is what this app did until now, leaves
 * an iOS GM who dutifully saves a copy every week reading "no backup yet" for
 * ever, and that trains them to ignore the one indicator that matters.
 */
export function noteCampaignCopy(id: string, route: SaveRoute, at: Date = new Date()): void {
  const notes = readRecord().campaigns ?? {};
  writeRecord({
    campaigns: { ...notes, [id]: { ...notes[id], lastCopyAt: at.toISOString(), route } },
  });
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
 *
 * That flag is a closure-local `let` and it serializes **these two events
 * only**. The four manual `runBackup('manual', …)` callers - the settings
 * button, both error boundaries and the unsaved-work strip - never touch it,
 * and the campaign leg multiplied the number of files one run opens. There is
 * no lock here and none is being built: the whole mitigation for a manual run
 * overlapping an automatic one is the same as the mitigation for two tabs of
 * this app, and it is two things. Every file carries the date in its name, so
 * only today's copy can be spoiled and yesterday's is still beside it; and
 * `writeIntoDirectory` opens what it wrote and refuses to count a file that
 * came back wrong. A run that loses that race records a failure and writes
 * again on the next trigger, which is the outcome a lock would have bought at
 * the price of a subsystem that can deadlock the one write that matters.
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
  /**
   * Campaigns that were here at the end of the last session and are not now.
   *
   * Empty whenever the campaign store could not be read at all: an unanswered
   * question is not a loss, and reporting one would be this module inventing
   * the thing it exists to detect.
   */
  missingCampaignIds: string[];
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

  let campaignIds: string[] = [];
  let campaignsReadable = true;
  try {
    const library = await d.listCampaigns();
    /*
     * The "here" set is `campaigns ∪ quarantined`, and the union is the whole
     * point of reading the library rather than the list.
     *
     * A record a newer build wrote is held back from `campaigns` on purpose and
     * is sitting on the disk, untouched. Without the union, the day a second tab
     * writes a newer schema this check announces that the GM's campaign has
     * vanished and blames ITP for behaviour this app has deliberately - and the
     * next campaign schema bump manufactures exactly that state on every older
     * tab, by design.
     */
    campaignIds = [
      ...library.campaigns.map((c) => c.id),
      ...library.quarantined.map((q) => q.id),
    ];
  } catch {
    campaignsReadable = false;
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
  const knownCampaigns = record.knownCampaignIds ?? [];
  const hereCampaigns = new Set(campaignIds);
  const missingCampaignIds = campaignsReadable
    ? knownCampaigns.filter((id) => !hereCampaigns.has(id))
    : [];
  const triggered = inactiveDays !== null && inactiveDays >= INACTIVE_DAYS;
  const healthy =
    readable && campaignsReadable && missingIds.length === 0 && missingCampaignIds.length === 0;
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
  } else if (
    known.length === 0 &&
    characters.length === 0 &&
    knownCampaigns.length === 0 &&
    campaignIds.length === 0
  ) {
    message = 'Nothing to check yet.';
  } else if (triggered) {
    message = `${characters.length} character${characters.length === 1 ? '' : 's'} still here after ${String(inactiveDays)} days away.`;
  } else {
    message = `${characters.length} character${characters.length === 1 ? '' : 's'} on this device.`;
  }
  /*
   * The campaign clause is appended rather than folded in, because the two
   * halves are separate claims about separate stores and either can be true
   * without the other. A device that lost only its campaigns gets a sentence
   * that says so, instead of a count of characters that are all still here.
   */
  if (missingCampaignIds.length > 0) {
    const one = missingCampaignIds.length === 1;
    message +=
      ` ${String(missingCampaignIds.length)} campaign${one ? '' : 's'} that ${one ? 'was' : 'were'}` +
      ` here at the end of the last session ${one ? 'is' : 'are'} not on this device now.` +
      ' A campaign is its own file: the .dhcampaign copies sit beside the character backup' +
      ' in the same folder, one per campaign per day.';
  } else if (!campaignsReadable) {
    message += ' The campaign store could not be opened on this device.';
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
  const patch: BackupRecord = { lastSeenAt: now.toISOString() };
  if (readable) patch.knownCharacterIds = [...here];
  if (campaignsReadable) patch.knownCampaignIds = [...hereCampaigns];
  writeRecord(patch);

  return {
    inactiveDays,
    triggered,
    healthy,
    expected: known.length,
    found: characters.length,
    missingIds,
    missingCampaignIds,
    persisted,
    canRestore,
    lastBackupAt: prefs.lastBackupAt ?? null,
    message,
  };
}

/**
 * Record what is on the disk without checking anything. Cheap, call on save.
 *
 * The disk, for both stores, and never the snapshot - `backupDeps.ts` gives the
 * reason and `integrityCheck` depends on it. The campaign read is guarded
 * separately so that a campaign store which will not open cannot also cost the
 * character note: a key that is not written keeps whatever the last good
 * session left there, which is the conservative direction, and writing an empty
 * list would destroy the only record of what used to be here.
 */
export async function noteSession(deps?: Partial<BackupDeps>): Promise<void> {
  const d = withDeps(deps);
  const characters = await d.listCharacters();
  const patch: BackupRecord = {
    lastSeenAt: d.now().toISOString(),
    knownCharacterIds: characters.map((c) => c.id),
  };
  try {
    const library = await d.listCampaigns();
    patch.knownCampaignIds = [
      ...library.campaigns.map((c) => c.id),
      ...library.quarantined.map((q) => q.id),
    ];
  } catch {
    // Left as it was. See the docblock.
  }
  writeRecord(patch);
}

/** Ask for persistent storage. Best asked while explaining why (Architecture 6). */
export const requestPersistence = (): Promise<db.StorageHealth> => db.requestPersistence();
