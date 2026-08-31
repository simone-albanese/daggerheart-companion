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
  it('creates all five stores on a device that has never run the app', async () => {
    // Five since `campaigns` joined them at DB_VERSION 2. The upgrade path
    // that adds it to a device already holding the four is exercised in
    // `tests/store/campaignDb.test.ts`, next to the store it belongs to.
    const database = await db.db();
    expect([...database.objectStoreNames].sort()).toEqual([
      'art',
      'campaigns',
      'characters',
      'content',
      'layers',
    ]);
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

describe('the rest of the stores, which nothing had ever opened', () => {
  it('removes a layer and everything it contributed, and leaves the SRD alone', async () => {
    await db.putLayer({ id: 'manual', label: 'Core Rulebook', priority: 1 });
    await db.putLayer({ id: 'srd', label: 'SRD', priority: 0 });
    await db.putOverlays([
      { key: 'manual:card-a', layerId: 'manual', entityId: 'card-a', kind: 'domainCards', fields: { text: 'x' } },
      { key: 'manual:card-b', layerId: 'manual', entityId: 'card-b', kind: 'domainCards', fields: { text: 'y' } },
      { key: 'srd:card-a', layerId: 'srd', entityId: 'card-a', kind: 'domainCards', fields: { text: 'z' } },
    ]);

    /*
     * And its pictures, which are the half of "everything it contributed" that
     * no longer has an API to write or read it. `removeLayer` still names
     * `art` in its transaction and still sweeps it by `layerId`; without this
     * record that clause would be a line no test can tell from a no-op, on a
     * store that legacy devices are still carrying.
     */
    const raw = await db.db();
    await raw.put('art', {
      key: 'manual:card-a',
      layerId: 'manual',
      blob: new Blob([new Uint8Array([1])], { type: 'image/webp' }),
      width: 2,
      height: 2,
    } as never);
    await raw.put('art', {
      key: 'srd:card-a',
      layerId: 'srd',
      blob: new Blob([new Uint8Array([2])], { type: 'image/webp' }),
      width: 2,
      height: 2,
    } as never);

    await db.removeLayer('manual');

    expect((await db.listLayers()).map((l) => l.id)).toEqual(['srd']);
    expect((await db.listOverlays()).map((o) => o.key)).toEqual(['srd:card-a']);
    expect(await (await db.db()).getAllKeys('art')).toEqual(['srd:card-a']);
  });

  it('wipes everything, which is what the reset button promises', async () => {
    await db.putCharacter(makeCharacter({ name: 'Gone' }));
    await db.putLayer({ id: 'manual', label: 'Core Rulebook', priority: 1 });
    await db.putOverlays([
      { key: 'manual:a', layerId: 'manual', entityId: 'a', kind: 'domainCards', fields: {} },
    ]);
    /*
     * Art is written through the raw store because there is no longer an API
     * that can write one: the importer that filled this store is gone, and so
     * are `putArt` and `artKeys`. That is exactly why this line has to stay.
     * The bytes are still on the devices that imported before the removal, the
     * version 1 `upgrade` block still creates the store, and `clearAll` is the
     * only thing standing between "the feature was removed" and "the pictures
     * were left on your phone with nothing able to reach them". Asserting
     * through the raw store keeps the guarantee checkable after the API that
     * used to check it was deleted.
     */
    await (await db.db()).put('art', {
      key: 'manual:arcana',
      layerId: 'manual',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
      width: 4,
      height: 4,
    } as never);
    expect(await (await db.db()).getAllKeys('art')).toEqual(['manual:arcana']);

    await db.clearAll();

    expect(await db.listCharacters()).toEqual([]);
    expect(await db.listLayers()).toEqual([]);
    expect(await db.listOverlays()).toEqual([]);
    expect(await (await db.db()).getAllKeys('art')).toEqual([]);
  });

  it('deletes one character without touching the others', async () => {
    const doomed = makeCharacter({ name: 'Doomed' });
    await db.putCharacter(doomed);
    await db.putCharacter(makeCharacter({ name: 'Spared' }));

    await db.deleteCharacter(doomed.id);

    expect((await db.listCharacters()).map((c) => c.name)).toEqual(['Spared']);
  });
});
