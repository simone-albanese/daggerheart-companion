/**
 * The campaigns object store, and the upgrade that adds it.
 *
 * `DB_VERSION` moved from 1 to 2 here, which is the one change in this whole
 * lane that runs on a device that already has data on it. `tests/store/db.test.ts`
 * says why the `oldVersion` branch matters - `createObjectStore` on a store
 * that already exists throws `ConstraintError`, so a version 2 that ran the
 * version 1 body unguarded would fail on *every* device with a character on
 * it - and until this file nothing had ever exercised a second branch, because
 * there had never been one.
 *
 * The rest is the character discipline, asked of the store that holds copies
 * of other people's characters: a record from a newer build is quarantined
 * rather than rendered and never written over, a damaged record is named
 * rather than counted, and one bad record does not cost the other three.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SCHEMA_VERSION,
  newCampaign,
  type Campaign,
} from '../../shared/campaigns.ts';
import type { Character } from '../../shared/types.ts';

type Db = typeof import('../../src/store/db.ts');
type Store = typeof import('../../src/store/campaigns.ts');

let db: Db;
let store: Store;

// Each test gets its own database: `db.ts` caches the connection in a module
// variable, so a fresh factory has to arrive with a fresh module.
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  db = await import('../../src/store/db.ts');
  store = await import('../../src/store/campaigns.ts');
});

let counter = 0;
const make = (patch: Partial<Campaign> = {}): Campaign => {
  counter += 1;
  return {
    ...newCampaign(`Campaign ${String(counter)}`, '2026-08-01T12:00:00.000Z', `c${String(counter)}`),
    ...patch,
  };
};

/** A raw record, written past the type system the way another build would. */
const writeRaw = async (record: Record<string, unknown>): Promise<void> => {
  const database = await db.db();
  await database.put('campaigns', record as unknown as Campaign);
};

describe('the upgrade that adds the store', () => {
  it('creates all five stores on a device that has never run the app', async () => {
    const database = await db.db();
    expect([...database.objectStoreNames].sort()).toEqual([
      'art',
      'campaigns',
      'characters',
      'content',
      'layers',
    ]);
  });

  it('adds campaigns to a device that already has the version 1 database', async () => {
    // The case the `oldVersion` branch exists for, and the one no test could
    // reach before there was a second version. A device with a character on it
    // must arrive at version 2 with that character still in it.
    const first = indexedDB.open(db.DB_NAME, 1);
    await new Promise((resolve, reject) => {
      first.onupgradeneeded = () => {
        const d = first.result;
        d.createObjectStore('characters', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        d.createObjectStore('layers', { keyPath: 'id' });
        d.createObjectStore('content', { keyPath: 'key' }).createIndex('layerId', 'layerId');
        d.createObjectStore('art', { keyPath: 'key' }).createIndex('layerId', 'layerId');
      };
      first.onsuccess = () => {
        const tx = first.result.transaction('characters', 'readwrite');
        tx.objectStore('characters').put({ id: 'ch1', name: 'Ilya', schemaVersion: 3 });
        tx.oncomplete = () => {
          first.result.close();
          resolve(null);
        };
        tx.onerror = () => reject(tx.error);
      };
      first.onerror = () => reject(first.error);
    });

    const database = await db.db();
    expect(database.version).toBe(2);
    expect([...database.objectStoreNames]).toContain('campaigns');
    expect(await database.count('characters')).toBe(1);
  });

  it('keeps the campaigns index the reader sorts on', async () => {
    const database = await db.db();
    expect([...database.transaction('campaigns').store.indexNames]).toContain('updatedAt');
  });

  it('says the app is out of date when the database is newer than this build', async () => {
    const ahead = indexedDB.open(db.DB_NAME, db.DB_VERSION + 1);
    await new Promise((resolve, reject) => {
      ahead.onupgradeneeded = () => {
        ahead.result.createObjectStore('campaigns', { keyPath: 'id' });
      };
      ahead.onsuccess = () => {
        ahead.result.close();
        resolve(null);
      };
      ahead.onerror = () => reject(ahead.error);
    });

    await expect(db.db()).rejects.toBeInstanceOf(db.StaleBuildError);
    await expect(db.db()).rejects.toThrow(/newer version of the app installed/);
  });
});

describe('reading the campaigns', () => {
  it('returns what is there, most recently played first', async () => {
    await store.putCampaign(make({ name: 'Older', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await store.putCampaign(make({ name: 'Newer', updatedAt: '2026-06-01T00:00:00.000Z' }));

    const { campaigns, quarantined, repaired } = await store.readCampaigns();
    expect(campaigns.map((c) => c.name)).toEqual(['Newer', 'Older']);
    expect(quarantined).toEqual([]);
    expect(repaired).toEqual([]);
  });

  it('does not fall over on a record with no updatedAt', async () => {
    // `listCharacters` used to be a getAll and a sort, and the sort was where
    // it fell over: one record without the field took the whole library with
    // it, and surfaced as a banner saying everything was probably fine.
    await writeRaw({ id: 'c-bare', schemaVersion: CAMPAIGN_SCHEMA_VERSION, name: 'Bare' });
    await store.putCampaign(make({ name: 'Whole', updatedAt: '2026-06-01T00:00:00.000Z' }));

    const { campaigns } = await store.readCampaigns();
    expect(campaigns.map((c) => c.name)).toEqual(['Whole', 'Bare']);
  });

  it('quarantines a campaign a newer build wrote, and names it', async () => {
    await store.putCampaign(make({ name: 'Readable' }));
    await writeRaw({
      id: 'c-ahead',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
      name: 'The Sablewood Winter',
    });

    const { campaigns, quarantined } = await store.readCampaigns();

    expect(campaigns.map((c) => c.name)).toEqual(['Readable']);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]!.name).toBe('The Sablewood Winter');
    expect(quarantined[0]!.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION + 1);
    expect(quarantined[0]!.reason).toMatch(/newer version of the app/);
  });

  it('leaves the quarantined record exactly as it was on disk', async () => {
    await writeRaw({
      id: 'c-ahead',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 2,
      name: 'Untouched',
      fear: 99,
    });
    await store.readCampaigns();

    const stored = (await (await db.db()).get('campaigns', 'c-ahead')) as unknown as Record<
      string,
      unknown
    >;
    expect(stored['schemaVersion']).toBe(CAMPAIGN_SCHEMA_VERSION + 2);
    expect(stored['fear']).toBe(99);
  });

  it('keeps reading the rest around a record it cannot read', async () => {
    for (const name of ['A', 'B', 'C']) await store.putCampaign(make({ name }));
    await writeRaw({ id: 'c-bad', schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1, name: 'Bad' });

    const { campaigns, quarantined } = await store.readCampaigns();
    expect(campaigns).toHaveLength(3);
    expect(quarantined).toHaveLength(1);
  });

  it('names a repair rather than performing it in silence', async () => {
    await writeRaw({
      id: 'c-fear',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      name: 'Overflowing',
      fear: 40,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const { campaigns, warnings, repaired } = await store.readCampaigns();
    expect(campaigns[0]!.fear).toBe(12);
    expect(warnings.join(' ')).toMatch(/Overflowing.*Fear pool held 40/);
    // Handed back so the caller can persist the repair once, rather than
    // redoing it on every launch.
    expect(repaired.map((c) => c.id)).toEqual(['c-fear']);
  });

  it('does not call a whole record repaired just for being read', async () => {
    await store.putCampaign(make({ name: 'Whole' }));
    expect((await store.readCampaigns()).repaired).toEqual([]);
  });

  it('treats a record with no timestamps as needing writing back', async () => {
    // The reader invents them. Left unwritten, they would be invented afresh
    // on every launch, and this campaign would always look like the last one
    // played.
    await writeRaw({ id: 'c-undated', schemaVersion: CAMPAIGN_SCHEMA_VERSION, name: 'Undated' });
    expect((await store.readCampaigns()).repaired.map((c) => c.id)).toEqual(['c-undated']);
  });
});

describe('writing a campaign', () => {
  it('writes when there is nothing there', async () => {
    const c = make({ name: 'First' });
    await store.putCampaign(c);
    expect((await store.getCampaign(c.id))?.name).toBe('First');
  });

  it('writes over its own schema without complaint', async () => {
    const c = make({ name: 'Before' });
    await store.putCampaign(c);
    await store.putCampaign({ ...c, name: 'After' });
    expect((await store.getCampaign(c.id))?.name).toBe('After');
  });

  it('refuses to write over a record a newer build saved', async () => {
    const c = make({ name: 'Mine' });
    await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1, name: 'Theirs' });

    await expect(store.putCampaign(c)).rejects.toBeInstanceOf(db.StaleBuildError);

    const stored = (await (await db.db()).get('campaigns', c.id)) as unknown as Record<
      string,
      unknown
    >;
    expect(stored['name']).toBe('Theirs');
  });

  it('refuses when the stored version cannot be read at all', async () => {
    const c = make({ name: 'Mine' });
    await writeRaw({ ...c, schemaVersion: {} });
    await expect(store.putCampaign(c)).rejects.toBeInstanceOf(db.StaleBuildError);
  });

  it('names the campaign in the refusal, so the message is about something', async () => {
    const c = make({ name: 'The Sablewood Winter' });
    await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
    await expect(store.putCampaign(c)).rejects.toThrow(/The Sablewood Winter/);
  });

  it('emits no unhandled rejection when it refuses', async () => {
    // P0-3 arriving from the code that reports it: `tx.abort()` on a refusal
    // makes `tx.done` reject with an AbortError nobody is holding.
    const unhandled: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent | { reason?: unknown }): void => {
      unhandled.push(e);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const c = make({ name: 'Mine' });
      await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
      await expect(store.putCampaign(c)).rejects.toBeInstanceOf(db.StaleBuildError);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('deletes one campaign without touching the others', async () => {
    const doomed = make({ name: 'Doomed' });
    await store.putCampaign(doomed);
    await store.putCampaign(make({ name: 'Spared' }));

    await store.deleteCampaign(doomed.id);

    expect((await store.readCampaigns()).campaigns.map((c) => c.name)).toEqual(['Spared']);
  });

  it('hands back nothing for a campaign that is not there', async () => {
    expect(await store.getCampaign('nobody')).toBeNull();
  });

  /*
   * The guard `putCampaign` had and this did not.
   *
   * Refusing to *overwrite* a newer build's record and then deleting it on
   * request is not a policy, it is an oversight with a sharp edge: the write
   * path protects other people's sheets and the delete path destroys them,
   * for the same record, in the same session. Every assertion below fails
   * against the one-line `await (await db()).delete('campaigns', id)` this
   * replaced - it deleted whatever was asked for and returned.
   */
  it('refuses to delete a record a newer build saved', async () => {
    const c = make({ name: 'Mine' });
    await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1, name: 'Theirs' });

    await expect(store.deleteCampaign(c.id)).rejects.toBeInstanceOf(db.StaleBuildError);

    const stored = (await (await db.db()).get('campaigns', c.id)) as unknown as Record<
      string,
      unknown
    >;
    expect(stored, 'the record was destroyed anyway').not.toBeUndefined();
    expect(stored['name']).toBe('Theirs');
  });

  it('refuses to delete when the stored version cannot be read at all', async () => {
    const c = make({ name: 'Mine' });
    await writeRaw({ ...c, schemaVersion: {} });
    await expect(store.deleteCampaign(c.id)).rejects.toBeInstanceOf(db.StaleBuildError);
    expect(await (await db.db()).get('campaigns', c.id)).not.toBeUndefined();
  });

  it('names the campaign in the delete refusal too', async () => {
    const c = make({ name: 'The Sablewood Winter' });
    await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
    await expect(store.deleteCampaign(c.id)).rejects.toThrow(/The Sablewood Winter/);
  });

  it('emits no unhandled rejection when the delete refuses', async () => {
    // The same AbortError trap the write path fell into: `tx.abort()` on a
    // refusal rejects `tx.done` into nobody's hands.
    const unhandled: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent | { reason?: unknown }): void => {
      unhandled.push(e);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const c = make({ name: 'Mine' });
      await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
      await expect(store.deleteCampaign(c.id)).rejects.toBeInstanceOf(db.StaleBuildError);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  /*
   * The control, and the reason the guard is safe to add.
   *
   * `clearAll` is the one path that must still take a quarantined record - a
   * device somebody has just wiped must not keep copies of other people's
   * character sheets because this build could not parse the wrapper. It does
   * not come through `deleteCampaign`, and this pins that: if somebody ever
   * routes it through here, this fails rather than the promise quietly
   * narrowing.
   */
  it('does not stand between the reset button and a quarantined record', async () => {
    const c = make({ name: 'Theirs' });
    await writeRaw({ ...c, schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 });
    await db.clearAll();
    expect(await (await db.db()).get('campaigns', c.id)).toBeUndefined();
  });
});

describe('the reset button, which promises to remove everything', () => {
  it('wipes campaigns too', async () => {
    // A new store that survives "reset app" would leave copies of other
    // people's character sheets on a device somebody has just wiped.
    await store.putCampaign(make({ name: 'Gone' }));
    await db.clearAll();
    expect((await store.readCampaigns()).campaigns).toEqual([]);
  });

  it('names every store, so the next one cannot be forgotten', async () => {
    const database = await db.db();
    expect([...db.STORES].sort()).toEqual([...database.objectStoreNames].sort());
  });

  it('counts the campaign the reader refuses, because the reset destroys that one too', async () => {
    /*
     * The number About prints on the erase confirmation has to be the number
     * of records `clearAll` deletes, and those are two different numbers.
     * `readCampaigns` holds a newer-build record out of `campaigns` on purpose
     * - that is the whole quarantine - while `clearAll` clears the store
     * wholesale and takes it with everything else. A confirmation counted from
     * the reader would promise to erase one campaign and erase two, which is
     * the undercount wearing the fix's clothes.
     *
     * This is also the assertion that refuses the obvious implementation:
     * `countCampaigns` written as `(await readCampaigns()).campaigns.length`
     * reads 1 here while every assertion in eraseConfirmation.test.tsx stays
     * green.
     */
    await store.putCampaign(make({ name: 'Readable' }));
    await writeRaw({
      id: 'c-ahead',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
      name: 'Written by a newer build',
    });

    const library = await store.readCampaigns();
    expect(library.campaigns).toHaveLength(1);
    expect(library.quarantined).toHaveLength(1);
    expect(
      await store.countCampaigns(),
      'the confirmation would name fewer campaigns than the reset deletes',
    ).toBe(2);

    await db.clearAll();
    expect(await store.countCampaigns()).toBe(0);
  });
});

describe('nothing here can reach the characters store', () => {
  it('leaves a character untouched when a campaign is written and deleted', async () => {
    // The whole reason the two are separate object stores. A campaign carries
    // whole copies of sheets; a campaign write reaching the store the real
    // sheets live in is the failure that must be impossible rather than rare.
    const database = await db.db();
    await database.put('characters', {
      id: 'ch1',
      name: 'Ilya',
      schemaVersion: 3,
    } as unknown as Character);

    const c = make({ name: 'A table' });
    await store.putCampaign(c);
    await store.deleteCampaign(c.id);

    expect(await database.count('characters')).toBe(1);
  });
});
