/**
 * IndexedDB. Four stores, deliberately separate:
 *
 *   characters  the user's work of months. The only truly precious data.
 *   layers      imported source layers (the Core Rulebook), removable
 *   content     per-layer field overlays, keyed `<layerId>:<entityId>`
 *   art         card illustrations as Blobs, keyed by slug
 *
 * Keeping the manual's content and art out of the character store means
 * removing the manual can never damage a character, and re-importing it never
 * has to touch one.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { checkReadable, versionOf } from '../../shared/migrations.ts';
import { readCharacterRecord } from '../transfer/fileIo.ts';
import { SCHEMA_VERSION, type Character, type Layer } from '../../shared/types.ts';

export const DB_NAME = 'daggerheart-companion';
export const DB_VERSION = 1;

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

/** One entity's fields as contributed by one layer. */
export interface ContentOverlay {
  /** `<layerId>:<entityId>` */
  key: string;
  layerId: string;
  entityId: string;
  kind: string;
  fields: Record<string, unknown>;
}

export interface ArtRecord {
  key: string;
  layerId: string;
  blob: Blob;
  width: number;
  height: number;
}

interface CompanionDB extends DBSchema {
  characters: { key: string; value: Character; indexes: { updatedAt: string } };
  layers: { key: string; value: Layer };
  content: { key: string; value: ContentOverlay; indexes: { layerId: string } };
  art: { key: string; value: ArtRecord; indexes: { layerId: string } };
}

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
      if (oldVersion < 1) {
        const chars = database.createObjectStore('characters', { keyPath: 'id' });
        chars.createIndex('updatedAt', 'updatedAt');
        database.createObjectStore('layers', { keyPath: 'id' });
        const content = database.createObjectStore('content', { keyPath: 'key' });
        content.createIndex('layerId', 'layerId');
        const art = database.createObjectStore('art', { keyPath: 'key' });
        art.createIndex('layerId', 'layerId');
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
  const tx = database.transaction('characters', 'readwrite');
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
// Layers, content overlays and art
// ---------------------------------------------------------------------------

export const listLayers = async (): Promise<Layer[]> => (await db()).getAll('layers');

export async function putLayer(layer: Layer): Promise<void> {
  await (await db()).put('layers', layer);
}

/** Remove a layer and everything it contributed. The SRD is untouched. */
export async function removeLayer(layerId: string): Promise<void> {
  const database = await db();
  const tx = database.transaction(['layers', 'content', 'art'], 'readwrite');
  await tx.objectStore('layers').delete(layerId);
  for (const store of ['content', 'art'] as const) {
    const index = tx.objectStore(store).index('layerId');
    let cursor = await index.openCursor(layerId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

export const listOverlays = async (): Promise<ContentOverlay[]> => (await db()).getAll('content');

export async function putOverlays(overlays: ContentOverlay[]): Promise<void> {
  const database = await db();
  const tx = database.transaction('content', 'readwrite');
  await Promise.all(overlays.map((o) => tx.store.put(o)));
  await tx.done;
}

export const getArt = async (key: string): Promise<ArtRecord | undefined> =>
  (await db()).get('art', key);

export async function putArt(records: ArtRecord[]): Promise<void> {
  const database = await db();
  const tx = database.transaction('art', 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

export const artKeys = async (): Promise<string[]> => (await db()).getAllKeys('art');

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

/** Wipe everything. Used by "reset app" in settings, never automatically. */
export async function clearAll(): Promise<void> {
  const database = await db();
  const tx = database.transaction(['characters', 'layers', 'content', 'art'], 'readwrite');
  await Promise.all([
    tx.objectStore('characters').clear(),
    tx.objectStore('layers').clear(),
    tx.objectStore('content').clear(),
    tx.objectStore('art').clear(),
  ]);
  await tx.done;
}
