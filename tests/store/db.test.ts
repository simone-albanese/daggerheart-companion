/**
 * The database path, which no test in this repository had ever opened.
 *
 * `tests/store/` was two backup files, `package.json` had no `fake-indexeddb`,
 * and so `upgrade`, `listCharacters`, `removeLayer` and `clearAll` were
 * entirely unexercised - on the four stores that hold the one copy of the
 * user's work that exists anywhere.
 *
 * What this is really about is `schemaVersion`. It is written into every
 * record in three places and, until now, read in exactly one: the *file* path.
 * The database path never looked. That matters because this app makes two
 * builds coexist on one device on purpose - `UpdateBanner` offers the waiting
 * worker rather than swapping the bundle out from under a session - so an old
 * bundle would read a newer record, render it as its own schema, and write it
 * straight back through the 400 ms debounce. The character degrades in place,
 * in the only copy, with nothing on screen. That is exactly the silent
 * misinterpretation `fileIo.ts` spends ten lines and a test preventing on the
 * file path.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Character } from '../../shared/types.ts';
import { makeCharacter } from '../fixtures/factories.ts';

// Each test gets its own database. `db.ts` caches the connection in a module
// variable, so the module has to be re-imported alongside a fresh factory or
// the second test would talk to the first one's database.
type Db = typeof import('../../src/store/db.ts');
let db: Db;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  db = await import('../../src/store/db.ts');
});

/** A raw record, written past the type system the way another build would. */
const writeRaw = async (record: Record<string, unknown>): Promise<void> => {
  const database = await db.db();
  await database.put('characters', record as unknown as Character);
};

describe('opening the database', () => {
  it('creates two stores on a device that has never run the app', async () => {
    /*
     * Two, and it takes all three `oldVersion` blocks to get there. A device
     * that has never run the app runs them in order, so version 1 creates
     * `layers`, `content` and `art` and version 3 deletes them again inside the
     * same versionchange transaction. That is deliberate - the blocks are a
     * history and version 1 really did create those stores - and this assertion
     * is what keeps the round trip honest: if the deletion stopped happening,
     * a brand-new install would quietly carry three stores nothing declares.
     */
    const database = await db.db();
    expect([...database.objectStoreNames].sort()).toEqual(['campaigns', 'characters']);
  });

  it('does not try to create a store that is already there', async () => {
    // The `oldVersion` branch is the whole point: `createObjectStore` on an
    // existing store throws ConstraintError, so a version 2 that ran the
    // version 1 body unguarded would fail on every device that already had a
    // database - which is every device with a character on it.
    await db.db();
    const database = await db.db();
    expect(database.version).toBe(db.DB_VERSION);
    expect([...database.objectStoreNames]).toContain('characters');
  });

  it('says the app is out of date when the database is newer than this build', async () => {
    // What a user actually meets: they accepted an update in another tab, then
    // opened this one. The old advice was "close the other tabs and reload",
    // which cannot work - the stale bundle reloads into the same wall.
    const ahead = indexedDB.open(db.DB_NAME, db.DB_VERSION + 1);
    await new Promise((resolve, reject) => {
      ahead.onsuccess = () => {
        ahead.result.close();
        resolve(null);
      };
      ahead.onerror = () => reject(ahead.error);
      ahead.onupgradeneeded = () => {
        ahead.result.createObjectStore('characters', { keyPath: 'id' });
      };
    });

    await expect(db.db()).rejects.toBeInstanceOf(db.StaleBuildError);
    await expect(db.db()).rejects.toThrow(/newer version of the app installed/);
    await expect(db.db()).rejects.toThrow(/characters are safe/);
  });
});

describe('reading the library', () => {
  it('returns what is there, newest first', async () => {
    await db.putCharacter(makeCharacter({ name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await db.putCharacter(makeCharacter({ name: 'Newer', updatedAt: '2026-06-01T00:00:00.000Z' }));

    const { characters, quarantined, repaired } = await db.readLibrary();
    expect(characters.map((c) => c.name)).toEqual(['Newer', 'Older']);
    expect(quarantined).toEqual([]);
    expect(repaired).toEqual([]);
  });

  it('quarantines a record a newer build wrote, and names it', async () => {
    await db.putCharacter(makeCharacter({ name: 'Readable' }));
    await writeRaw({
      ...makeCharacter({ name: 'From the future' }),
      schemaVersion: SCHEMA_VERSION + 1,
    });

    const { characters, quarantined } = await db.readLibrary();

    // Not rendered: the store never sees it, so no screen can edit it and the
    // debounce can never write over it.
    expect(characters.map((c) => c.name)).toEqual(['Readable']);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]!.name).toBe('From the future');
    expect(quarantined[0]!.schemaVersion).toBe(SCHEMA_VERSION + 1);
    expect(quarantined[0]!.reason).toMatch(/newer version of the app/);
  });

  it('leaves the quarantined record exactly as it was on disk', async () => {
    const original = { ...makeCharacter({ name: 'Untouched' }), schemaVersion: SCHEMA_VERSION + 2 };
    await writeRaw(original);
    await db.readLibrary();

    const database = await db.db();
    const stored = (await database.get('characters', original.id)) as unknown as Record<
      string,
      unknown
    >;
    expect(stored['schemaVersion']).toBe(SCHEMA_VERSION + 2);
    expect(stored['name']).toBe('Untouched');
  });

  it('quarantines a record whose version is not a number at all', async () => {
    await writeRaw({ ...makeCharacter({ name: 'Damaged' }), schemaVersion: 'three' });
    const { characters, quarantined } = await db.readLibrary();
    expect(characters).toEqual([]);
    expect(quarantined[0]!.reason).toMatch(/not a whole number/);
  });

  it('keeps reading the rest of the library around a record it cannot read', async () => {
    // One bad record must not cost the other five. The whole library failing
    // to load is the failure this shape exists to avoid.
    for (const name of ['A', 'B', 'C']) await db.putCharacter(makeCharacter({ name }));
    await writeRaw({ ...makeCharacter({ name: 'Bad' }), schemaVersion: SCHEMA_VERSION + 1 });

    const { characters, quarantined } = await db.readLibrary();
    expect(characters).toHaveLength(3);
    expect(quarantined).toHaveLength(1);
  });

  it('hands back only the readable half through listCharacters', async () => {
    await db.putCharacter(makeCharacter({ name: 'Fine' }));
    await writeRaw({ ...makeCharacter({ name: 'Ahead' }), schemaVersion: SCHEMA_VERSION + 1 });
    expect((await db.listCharacters()).map((c) => c.name)).toEqual(['Fine']);
  });
});

describe('writing a character', () => {
  it('writes when there is nothing there', async () => {
    const c = makeCharacter({ name: 'First' });
    await db.putCharacter(c);
    expect((await db.getCharacter(c.id))?.name).toBe('First');
  });

  it('writes over its own schema without complaint', async () => {
    const c = makeCharacter({ name: 'Before' });
    await db.putCharacter(c);
    await db.putCharacter({ ...c, name: 'After' });
    expect((await db.getCharacter(c.id))?.name).toBe('After');
  });

  it('refuses to write over a record a newer build saved', async () => {
    const c = makeCharacter({ name: 'Theirs' });
    await writeRaw({ ...c, schemaVersion: SCHEMA_VERSION + 1 });

    await expect(db.putCharacter({ ...c, name: 'Mine' })).rejects.toBeInstanceOf(db.StaleBuildError);

    const database = await db.db();
    const stored = (await database.get('characters', c.id)) as unknown as Record<string, unknown>;
    expect(stored['name']).toBe('Theirs');
    expect(stored['schemaVersion']).toBe(SCHEMA_VERSION + 1);
  });

  it('refuses when the stored version cannot be read at all', async () => {
    const c = makeCharacter({ name: 'Theirs' });
    await writeRaw({ ...c, schemaVersion: {} });
    await expect(db.putCharacter({ ...c, name: 'Mine' })).rejects.toBeInstanceOf(db.StaleBuildError);
  });

  it('names the character in the refusal, so the message is about something', async () => {
    const c = makeCharacter({ name: 'Ilya of the Ninth' });
    await writeRaw({ ...c, schemaVersion: SCHEMA_VERSION + 1 });
    await expect(db.putCharacter(c)).rejects.toThrow(/Ilya of the Ninth/);
  });
});

/**
 * Version 2 as a device actually holds it, so the upgrade under test is the one
 * that ships rather than one the test invented.
 *
 * Opened raw and at the old version on purpose: `db.ts` only knows how to open
 * version 3, so seeding through it would be seeding the destination. This
 * builds the five stores the version 1 and version 2 blocks built, fills the
 * three that version 3 removes, and closes - which is the state of a phone that
 * imported the Core Rulebook and has not yet been given this build.
 */
interface LegacyStores {
  characters: IDBObjectStore;
  layers: IDBObjectStore;
  content: IDBObjectStore;
  art: IDBObjectStore;
}

const seedVersion2 = async (fill: (stores: LegacyStores) => void): Promise<void> => {
  const request = indexedDB.open(db.DB_NAME, 2);
  await new Promise((resolve, reject) => {
    request.onupgradeneeded = () => {
      const database = request.result;
      const chars = database.createObjectStore('characters', { keyPath: 'id' });
      chars.createIndex('updatedAt', 'updatedAt');
      database.createObjectStore('layers', { keyPath: 'id' });
      const content = database.createObjectStore('content', { keyPath: 'key' });
      content.createIndex('layerId', 'layerId');
      const art = database.createObjectStore('art', { keyPath: 'key' });
      art.createIndex('layerId', 'layerId');
      const campaigns = database.createObjectStore('campaigns', { keyPath: 'id' });
      campaigns.createIndex('updatedAt', 'updatedAt');

      const tx = request.transaction;
      if (tx === null) throw new Error('no versionchange transaction');
      fill({
        characters: tx.objectStore('characters'),
        layers: tx.objectStore('layers'),
        content: tx.objectStore('content'),
        art: tx.objectStore('art'),
      });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
};

const webp = (byte: number): Blob => new Blob([new Uint8Array([byte])], { type: 'image/webp' });

describe('version 3, which takes the Core Rulebook off the device', () => {
  it('deletes the layer, its overlays and its art from a device that imported one', async () => {
    /*
     * The lane's whole claim, asserted where it is judged: on the device, not
     * in the repository. Removing the importer stopped anything writing these
     * three stores and took nothing off a phone that had already used it - the
     * layer went on being merged over the SRD by `dataset.ts`, the WebP went on
     * occupying quota the About screen prints, and the only control that could
     * still reach any of it was "reset everything", which takes the characters
     * too. This upgrade is what makes the removal true for the user.
     */
    await seedVersion2((stores) => {
      stores.characters.put(makeCharacter({ name: 'Kept' }));
      stores.layers.put({ id: 'core-2025-09-06', label: 'Core Rulebook', priority: 1 });
      stores.content.put({
        key: 'core-2025-09-06:arcana',
        layerId: 'core-2025-09-06',
        entityId: 'arcana',
        kind: 'domains',
        fields: { sourcePage: 214 },
      });
      stores.art.put({ key: 'core-2025-09-06:arcana', layerId: 'core-2025-09-06', blob: webp(1), width: 2, height: 2 });
    });

    const database = await db.db();

    expect(database.version).toBe(3);
    expect([...database.objectStoreNames].sort()).toEqual(['campaigns', 'characters']);
    // The half that must survive: the upgrade is next to the only copy of the
    // user's work that exists anywhere, and it must not be within reach of it.
    expect((await db.listCharacters()).map((c) => c.name)).toEqual(['Kept']);
  });

  it('reaches art an art pack wrote, which no layer record names', async () => {
    /*
     * Why this deletes stores instead of sweeping by layer.
     *
     * `.dhart` art packs wrote into `art` under the fixed layerId `art-pack`
     * and never wrote a `Layer` beside it - `putLayer` was only ever called by
     * the import worker, and installing a pack did not run one. So the obvious
     * migration, the one that walks `listLayers()` and sweeps each id's
     * `layerId` index exactly as the deleted `removeLayer` did, would have left
     * every pack-installed illustration on the device and reported success.
     * There is no list to walk that is guaranteed to name them; there is only
     * the store.
     */
    await seedVersion2((stores) => {
      stores.art.put({ key: 'art-pack:midnight', layerId: 'art-pack', blob: webp(2), width: 4, height: 4 });
    });

    const database = await db.db();

    expect([...database.objectStoreNames]).not.toContain('art');
  });

  it('still opens when a store it is told to delete is not there', async () => {
    /*
     * The case none of this file's branches can produce, which is why it is
     * worth a test rather than an assertion. A throw inside the versionchange
     * transaction rejects `openDB`, and it does so on every later open too,
     * because each one re-runs the upgrade - so an unguarded delete would take
     * the characters out of reach permanently on any device whose database is
     * not shaped the way these branches assume. The upgrade has to survive a
     * shape it did not build.
     */
    const request = indexedDB.open(db.DB_NAME, 2);
    await new Promise((resolve, reject) => {
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore('characters', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        database.createObjectStore('campaigns', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => {
        request.result.close();
        resolve(null);
      };
      request.onerror = () => reject(request.error);
    });

    const database = await db.db();

    expect(database.version).toBe(3);
    expect([...database.objectStoreNames].sort()).toEqual(['campaigns', 'characters']);
  });

  it('leaves a device that never imported with the same two stores', async () => {
    // The overwhelming majority, and every new install. The upgrade has to be a
    // no-op for them in everything except the schema - three empty stores stop
    // existing, and nothing they can see changes.
    await seedVersion2((stores) => {
      stores.characters.put(makeCharacter({ name: 'Only mine' }));
    });

    const database = await db.db();

    expect([...database.objectStoreNames].sort()).toEqual(['campaigns', 'characters']);
    expect((await db.listCharacters()).map((c) => c.name)).toEqual(['Only mine']);
  });
});

describe('the rest of the stores, which nothing had ever opened', () => {
  it('wipes everything, which is what the reset button promises', async () => {
    await db.putCharacter(makeCharacter({ name: 'Gone' }));

    await db.clearAll();

    expect(await db.listCharacters()).toEqual([]);
    // Over `STORES` rather than a list written again here, which is the point
    // of that constant: the two stores it names are the two the database has.
    const database = await db.db();
    expect([...db.STORES].sort()).toEqual([...database.objectStoreNames].sort());
  });

  it('deletes one character without touching the others', async () => {
    const doomed = makeCharacter({ name: 'Doomed' });
    await db.putCharacter(doomed);
    await db.putCharacter(makeCharacter({ name: 'Spared' }));

    await db.deleteCharacter(doomed.id);

    expect((await db.listCharacters()).map((c) => c.name)).toEqual(['Spared']);
  });
});
