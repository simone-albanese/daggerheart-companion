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
import type { Character, Layer } from '../../shared/types.ts';

export const DB_NAME = 'daggerheart-companion';
export const DB_VERSION = 1;

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
    upgrade(database) {
      const chars = database.createObjectStore('characters', { keyPath: 'id' });
      chars.createIndex('updatedAt', 'updatedAt');
      database.createObjectStore('layers', { keyPath: 'id' });
      const content = database.createObjectStore('content', { keyPath: 'key' });
      content.createIndex('layerId', 'layerId');
      const art = database.createObjectStore('art', { keyPath: 'key' });
      art.createIndex('layerId', 'layerId');
    },
  });
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export async function listCharacters(): Promise<Character[]> {
  const all = await (await db()).getAll('characters');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export const getCharacter = async (id: string): Promise<Character | undefined> =>
  (await db()).get('characters', id);

export async function putCharacter(c: Character): Promise<void> {
  await (await db()).put('characters', c);
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
