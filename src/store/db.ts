/**
 * IndexedDB. Two stores, deliberately separate:
 *
 *   characters  the user's work of months. The only truly precious data.
 *   campaigns   the GM's: one per table, with its own schema and own chain
 *
 * `campaigns` is separate because a campaign holds whole copies of other
 * people's sheets, and the one thing that must never happen is a campaign
 * write reaching the store those sheets actually live in. Nothing here writes
 * across the two.
 *
 * There were five. `layers`, `content` and `art` were the Core Rulebook
 * import's, and version 3 deletes all three - see `DB_VERSION`. Keeping the
 * manual's contribution out of the character store was what made that deletion
 * cost a character nothing, which is the argument paying off rather than
 * ending: the same separation is why `campaigns` can be reasoned about alone.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Campaign } from '../../shared/campaigns.ts';
import { checkReadable, versionOf } from '../../shared/migrations.ts';
import { readCharacterRecord } from '../transfer/fileIo.ts';
import { SCHEMA_VERSION, type Character } from '../../shared/types.ts';

export const DB_NAME = 'daggerheart-companion';

/**
 * The shape of the database, which is a different number from any schema.
 *
 * Two, because the `campaigns` store was added. Neither `SCHEMA_VERSION` nor
 * `CAMPAIGN_SCHEMA_VERSION` moved with it: this number is about which object
 * stores and indexes exist, and Architecture 6.1 lists it as the third of the
 * three things a change may need rather than as a synonym for either of the
 * other two.
 *
 * The other direction has now happened too, which is what makes the three
 * genuinely independent rather than merely notionally so:
 * `CAMPAIGN_SCHEMA_VERSION` moved to 2 on 2026-08-18 for two new session-list
 * kinds, and this number stayed at 2 because no store and no index changed.
 *
 * Three, because `layers`, `content` and `art` are deleted. Removing the Core
 * Rulebook importer stopped anything writing them; it did not take one byte
 * off a device that had already imported, and dropping them from the schema
 * alone would have taken even less - a store absent from `CompanionDB` is a
 * store this file has stopped looking at, not one the browser has stopped
 * holding. `art` in particular is full-size WebP, tens of megabytes against a
 * quota the About screen prints. Neither `SCHEMA_VERSION` nor
 * `CAMPAIGN_SCHEMA_VERSION` moves with it: no character and no campaign record
 * changes shape, which is the same independence the paragraph above claims and
 * this is the third demonstration of it.
 *
 * The cost of raising it is real and is already handled: a build still on
 * version 1 that meets a version 2 database gets `VersionError` from `openDB`,
 * which becomes the `StaleBuildError` below - "close every tab and open it
 * again" - rather than a blank screen. That is the same coexistence the whole
 * schema policy is written around.
 */
export const DB_VERSION = 3;

/**
 * The database refused to open because it is newer than this build.
 *
 * Distinct from every other storage failure because the remedy is the
 * opposite. `state.ts` used to fold this into the generic banner, which tells
 * the user to close the other tabs and reload - advice that cannot work, since
 * the stale bundle reloads into the same failure.
 */
export class StaleBuildError extends Error {
  override name = 'StaleBuildError';
}

interface CompanionDB extends DBSchema {
  characters: { key: string; value: Character; indexes: { updatedAt: string } };
  campaigns: { key: string; value: Campaign; indexes: { updatedAt: string } };
}

/** Every store, for the two places that must not miss one. */
export const STORES = ['characters', 'campaigns'] as const;

let dbPromise: Promise<IDBPDatabase<CompanionDB>> | null = null;

export function db(): Promise<IDBPDatabase<CompanionDB>> {
  dbPromise ??= openDB<CompanionDB>(DB_NAME, DB_VERSION, {
    /*
     * `oldVersion` is 0 on a database that does not exist yet, and the version
     * that is already there otherwise. Branching on it is the difference
     * between an upgrade and a crash: `createObjectStore` on a store that
     * already exists throws `ConstraintError`, so a version 2 that ran this
     * body unguarded would fail on every device that already had version 1.
     *
     * Each future version adds its own block below and never edits the ones
     * above it. The blocks run in order for a device that skipped a release,
     * which is the ordinary case for an app people open every few weeks.
     */
    upgrade(database, oldVersion) {
      /*
       * `CompanionDB` describes the database this build wants, and the blocks
       * below describe the ones it may find. Those two disagree on purpose from
       * version 3 on: the version 1 block still creates `layers`, `content` and
       * `art`, and the version 3 block deletes them, and neither name is in the
       * schema any more. `idb` types every store name against the current
       * schema, so the historical branches talk to the database through a view
       * that does not know about it.
       *
       * The version 1 block keeps creating three stores the version 3 block
       * below loses again, which on a device that has never run the app is a
       * real create-then-drop. It costs microseconds and it was left
       * deliberately: these branches are a history, and a history that has been
       * tidied is no longer evidence of what shipped. Rewriting version 1 to
       * match today would tell the next reader that `art` never existed - and
       * it is the question "did this device ever hold art?" that the version 3
       * block exists to answer yes to.
       */
      const historical = database as unknown as IDBPDatabase;

      if (oldVersion < 1) {
        const chars = database.createObjectStore('characters', { keyPath: 'id' });
        chars.createIndex('updatedAt', 'updatedAt');
        historical.createObjectStore('layers', { keyPath: 'id' });
        const content = historical.createObjectStore('content', { keyPath: 'key' });
        content.createIndex('layerId', 'layerId');
        const art = historical.createObjectStore('art', { keyPath: 'key' });
        art.createIndex('layerId', 'layerId');
      }
      if (oldVersion < 2) {
        // The GM's campaigns, moving out of localStorage. A device that has
        // been running version 1 for months arrives here with four stores and
        // gains the fifth without any of the other four being touched; a
        // device that has never run the app runs both blocks in order.
        const campaigns = database.createObjectStore('campaigns', { keyPath: 'id' });
        campaigns.createIndex('updatedAt', 'updatedAt');
      }
      if (oldVersion < 3) {
        /*
         * The Core Rulebook's three stores, deleted rather than cleared.
         *
         * Cleared would have been enough for the bytes and wrong for the
         * schema: an empty store nothing declares is one `STORES` no longer
         * reaches, so `clearAll` would stop iterating it and the next reader of
         * this file would find three stores on real devices that the type says
         * do not exist. Deleting them makes the disk and `CompanionDB` agree.
         *
         * Deleting the *stores* rather than sweeping by layer is also the only
         * complete answer, and the reason is a seam the importer left. `.dhart`
         * art packs wrote `art` records under the fixed layerId `art-pack` and
         * never wrote a `Layer` beside them, so a migration that walked
         * `layers` and swept each one's `layerId` index - which is exactly what
         * the deleted `removeLayer` did - would have left every pack-installed
         * illustration on the device. There is no list to walk that is
         * guaranteed to name them.
         */
        for (const store of ['art', 'content', 'layers'] as const) {
          /*
           * Guarded, and the asymmetry is the whole argument. `deleteObjectStore`
           * on a name that is not there throws `NotFoundError`, and a throw in
           * here aborts the versionchange transaction, which rejects `openDB` -
           * on every subsequent open, because every one of them re-runs this
           * block. The cost of the guard is a lookup. The cost of not having it,
           * on any device whose database is not shaped the way these branches
           * assume, is an app that can never reach the characters again.
           *
           * Nothing in this file can produce that device: the version 1 block
           * creates all three unconditionally. That is exactly why the guard is
           * here rather than an assertion - it is protecting against the case
           * this file cannot see, and a case this file cannot see is not one it
           * gets to be confident about.
           */
          if (historical.objectStoreNames.contains(store)) {
            historical.deleteObjectStore(store);
          }
        }
      }
    },

    /*
     * Two tabs, one database, and an upgrade between them. `blocked` fires in
     * the tab that wants the new version while an old connection is still
     * open; `blocking` fires in the tab holding it open. Without the second
     * one the upgrade waits forever on a tab the user has forgotten about, and
     * the app sits on its loading mark - which `init()`'s eight-second
     * deadline turns into "storage did not respond", a sentence that names the
     * wrong problem.
     */
    blocked() {
      // Nothing to do but let the deadline in `init()` speak. Closing the
      // other tab is the user's call, and this callback cannot reach it.
    },
    /*
     * The browser can close a connection on its own - a storage pressure
     * eviction, a profile switch, a devtools "clear site data". `dbPromise`
     * held the dead connection for the life of the tab, so one force-close
     * meant every write from then on rejected into nothing. Dropping the
     * reference lets the next call open a new one.
     */
    terminated() {
      dbPromise = null;
    },
    blocking() {
      // Let the other tab upgrade. Everything is written through a debounce
      // that flushes on `pagehide`, so a connection closed here has already
      // saved; holding it open would block an update indefinitely.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  }).catch((error: unknown) => {
    dbPromise = null;
    if (error instanceof Error && error.name === 'VersionError') {
      throw new StaleBuildError(
        'This device has a newer version of the app installed than the one running now. Your characters are safe and this build cannot read them. Close every tab of this app and open it again to load the newer version.',
      );
    }
    throw error;
  });
  return dbPromise;
}

/**
 * Hold a transaction's `done`, so a refused request is one failure and not two.
 *
 * `idb` creates `tx.done` the moment a transaction is wrapped and attaches its
 * `reject` to the transaction's `error` and `abort` events straight away. Every
 * function below is written as `await request; await tx.done;` - so when the
 * request fails, the `await tx.done` line is never reached, the transaction
 * aborts anyway, and `tx.done` rejects with an `AbortError` that nobody is
 * holding. Measured: one unhandled rejection per refused write, *in addition*
 * to the error the caller catches.
 *
 * That is the exact failure P0-3 is about, arriving from the code that reports
 * it. `idb`'s own shorthand methods avoid it with
 * `Promise.all([op, isWrite && tx.done])` under the comment "Must handle both
 * promises (no unhandled rejections)"; these transactions are hand-written
 * because they need more than one request, so they have to do it themselves.
 *
 * A `catch` rather than that `Promise.all`: awaiting `tx.done` between two
 * requests would wait for a transaction that only finishes once no request is
 * pending, and the next request would then land on a finished transaction.
 * Whatever aborted it is already being thrown by the request that caused it, so
 * there is nothing here left to report.
 *
 * Exported because `campaigns.ts` hand-writes multi-request transactions of its
 * own against the same database, and a second copy of this would be a second
 * place for the unhandled rejection to come back.
 */
export function hold<T extends { done: Promise<void> }>(tx: T): T {
  void tx.done.catch(() => {
    // Reported by the request that caused it. This exists so the abort is not
    // *also* an unhandled rejection.
  });
  return tx;
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

/** A record this build must not render and must not write over. */
export interface QuarantinedRecord {
  id: string;
  /** Whatever the record calls itself, when that much is readable. */
  name: string | null;
  schemaVersion: number | null;
  /** One sentence, shown to the user. */
  reason: string;
}

export interface LibraryRead {
  characters: Character[];
  quarantined: QuarantinedRecord[];
  /** Records that came back different - converted, or repaired. Write these. */
  repaired: Character[];
}

/**
 * Read the library, and refuse to misread any of it.
 *
 * `schemaVersion` is written into every record and, until this function
 * existed, was read in exactly one place - the *file* path. The database path,
 * which holds the only copy, never looked. That matters because this app makes
 * two builds coexist on one device by design: `UpdateBanner` offers the
 * waiting worker rather than swapping the bundle mid-session. So the old
 * bundle would read a newer record, render it as its own schema, and write it
 * back through the 400 ms debounce - degrading the character in place, in the
 * only copy, with nothing on screen.
 *
 * A record from the future is therefore quarantined rather than rendered: it
 * is left exactly as it is on disk, kept out of the store so no screen can
 * edit it, and named to the user. A record from an older readable schema is
 * converted, and handed back separately so the caller can persist it once
 * rather than converting it again on every launch.
 */
export async function readLibrary(): Promise<LibraryRead> {
  const all = await (await db()).getAll('characters');

  const characters: Character[] = [];
  const quarantined: QuarantinedRecord[] = [];
  const repaired: Character[] = [];

  for (const record of all) {
    const raw = record as unknown as Record<string, unknown>;
    const id = typeof raw['id'] === 'string' ? raw['id'] : '(no id)';
    const name = typeof raw['name'] === 'string' ? raw['name'] : null;
    const stamped = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : null;
    try {
      const version = versionOf(raw);
      checkReadable(version);

      /*
       * The same reader the file path uses, on the database path.
       *
       * A record here is not more trustworthy than one in a file: it may have
       * been written by a build with a bug, half-written when a phone froze,
       * or restored from a file that was. `listCharacters` used to be a
       * `getAll` and a sort, and the sort was where it fell over - a record
       * with no `updatedAt` made `localeCompare` throw and took the whole
       * library with it, which surfaced as the storage banner saying
       * everything was probably fine.
       */
      const repairs: string[] = [];
      const character = readCharacterRecord(raw, 'A character saved on this device', repairs);
      characters.push(character);
      /*
       * Write back only what actually changed shape.
       *
       * A conversion is real work that must not be repeated every launch, and
       * a record already at this schema and already whole is left alone rather
       * than churned. The third clause is the subtle one: the reader fills a
       * missing `updatedAt` or `createdAt` from a blank sheet, which means a
       * record without one would be stamped with a *different* fresh time on
       * every launch - and would therefore win every merge comparison against
       * a backup, forever, because it always looks like the most recent edit.
       */
      const identityInvented =
        typeof raw['id'] !== 'string' ||
        typeof raw['updatedAt'] !== 'string' ||
        typeof raw['createdAt'] !== 'string';
      if (version !== SCHEMA_VERSION || repairs.length > 0 || identityInvented) {
        repaired.push(character);
      }
    } catch (error) {
      quarantined.push({
        id,
        name,
        schemaVersion: stamped,
        reason:
          error instanceof Error && error.message !== ''
            ? error.message
            : 'This character could not be read by this version of the app, and has been left untouched.',
      });
    }
  }

  characters.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { characters, quarantined, repaired };
}

/** The readable half of the library. Everything else goes through `readLibrary`. */
export async function listCharacters(): Promise<Character[]> {
  return (await readLibrary()).characters;
}

export const getCharacter = async (id: string): Promise<Character | undefined> =>
  (await db()).get('characters', id);

/**
 * Write a character, unless what is already there is newer than this build.
 *
 * The read costs one extra round trip on a debounced write, and it buys the
 * one guarantee that matters: an old bundle cannot flatten a record a newer
 * one wrote. `readLibrary` already keeps such a record out of the store, so
 * reaching this branch means something else went wrong - which is exactly when
 * a backstop is worth having.
 */
export async function putCharacter(c: Character): Promise<void> {
  const database = await db();
  const tx = hold(database.transaction('characters', 'readwrite'));
  const existing = (await tx.store.get(c.id)) as unknown as Record<string, unknown> | undefined;

  if (existing !== undefined) {
    let stored: number;
    try {
      stored = versionOf(existing);
    } catch {
      // A stored version this build cannot even parse is not one to overwrite.
      stored = Number.POSITIVE_INFINITY;
    }
    if (stored > SCHEMA_VERSION) {
      /*
       * Let the transaction close on its own rather than aborting it.
       *
       * Nothing has been written either way - the only request so far is the
       * read above - and `tx.abort()` makes `tx.done` reject with an
       * `AbortError` that nothing is waiting for. A deliberate refusal that
       * also emits an unhandled rejection is the exact failure P0-3 is about,
       * arriving as a side effect of the fix for a different one. The suite
       * caught it: three unhandled rejections, in the run that added these
       * tests.
       */
      await tx.done;
      throw new StaleBuildError(
        `"${c.name || 'This character'}" was last saved by a newer version of the app (schema ${String(stored)}), so this one has not written over it. Close every tab of this app and open it again to load the newer version.`,
      );
    }
  }

  await tx.store.put(c);
  await tx.done;
}

export async function deleteCharacter(id: string): Promise<void> {
  await (await db()).delete('characters', id);
}

// ---------------------------------------------------------------------------
// Durability
// ---------------------------------------------------------------------------

export interface StorageHealth {
  persisted: boolean;
  /** Bytes used and available, when the browser will say. */
  usage: number | null;
  quota: number | null;
}

/**
 * Ask for persistent storage.
 *
 * Safari's ITP can evict IndexedDB after about seven days of inactivity, and
 * a group that plays every three weeks would lose a character between
 * sessions. Installing to the home screen makes the grant far more likely, so
 * the caller should explain that before asking.
 */
export async function requestPersistence(): Promise<StorageHealth> {
  let persisted = false;
  try {
    if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    if (!persisted && navigator.storage?.persist) persisted = await navigator.storage.persist();
  } catch {
    persisted = false;
  }
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const est = await navigator.storage?.estimate?.();
    usage = est?.usage ?? null;
    quota = est?.quota ?? null;
  } catch {
    /* estimate is optional */
  }
  return { persisted, usage, quota };
}

/**
 * Wipe everything. Used by "reset app" in settings, never automatically.
 *
 * Over `STORES` rather than a list written out again here: the list written
 * out again is how a new store gets added and quietly survives the button that
 * promises to remove everything, which for `campaigns` would mean the reset
 * leaving other people's character sheets on the device.
 */
export async function clearAll(): Promise<void> {
  const database = await db();
  const tx = hold(database.transaction(STORES, 'readwrite'));
  await Promise.all(STORES.map((name) => tx.objectStore(name).clear()));
  await tx.done;
}
