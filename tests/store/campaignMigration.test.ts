/**
 * The one-way door: reading `dhc.gm.v1` and then deleting it.
 *
 * Everything else in this lane can be run again. This cannot, because its last
 * step removes the only copy of the GM's fight, their Fear pool, their
 * countdowns and whole copies of the players' character sheets. P0-5 is the
 * precedent and the sentence is `backup.ts`'s: an unverified backup is not a
 * backup, and a migration that deletes its source is a backup with the
 * original thrown away.
 *
 * So the tests that matter here are the ones where the write *appears* to
 * succeed and has not: a `put` that resolves and stores nothing, a read-back
 * that comes back different, a quota error on the second of two writes. In
 * every one of them the localStorage key has to still be there afterwards.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import { newCharacter } from '../../src/engine/character.ts';

type Migration = typeof import('../../src/store/campaignMigration.ts');
type Store = typeof import('../../src/store/campaigns.ts');

let migration: Migration;
let store: Store;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  migration = await import('../../src/store/campaignMigration.ts');
  store = await import('../../src/store/campaigns.ts');
});

/** A localStorage that is a Map, so a test can look at what is left in it. */
function fakeStorage(seed: Record<string, string> = {}): {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  keys: Map<string, string>;
} {
  const keys = new Map(Object.entries(seed));
  return {
    keys,
    storage: {
      getItem: (k) => keys.get(k) ?? null,
      setItem: (k, v) => {
        keys.set(k, v);
      },
      removeItem: (k) => {
        keys.delete(k);
      },
    },
  };
}

/** What `gmStore.save()` writes today, with something in every field. */
const LEGACY = {
  region: 'scene',
  partyTier: 2,
  roster: [{ ref: 'acid-burrower', count: 1 }],
  adjustments: { easier: false, harder: true, damageBump: false },
  combatants: [
    {
      id: 'acid-burrower-0',
      adversaryRef: 'acid-burrower',
      name: 'Acid Burrower',
      hp: { marked: 3, max: 8 },
      stress: { marked: 1, max: 3 },
      thresholds: [8, 15],
      difficulty: 14,
      spotlighted: true,
      notes: 'on the far bank',
    },
  ],
  environmentRef: 'raging-river',
  fear: 7,
  countdowns: [
    { id: 'cd-1', name: 'The ice gives way', kind: 'standard', start: 6, value: 4, notes: '' },
    { id: 'cd-2', name: 'Reinforcements', kind: 'loop', start: 3, value: 3, notes: 'x' },
  ],
  party: [
    {
      id: 'pc-1',
      importedAt: '2026-07-04T18:02:00.000Z',
      source: 'file',
      markedAt: null,
      tracks: { hp: 2, stress: 4, hope: 3, armor: 1 },
      // A whole sheet, still stamped at the schema the old GM screen wrote,
      // so the character chain has something to convert and `readPartyMember`
      // has a character rather than a stub to put on the board.
      sheet: { ...newCharacter({ name: 'Ilya of the Ninth' }), id: 'pc-1', schemaVersion: 3, level: 4 },
    },
  ],
};

const at = (): string => '2026-08-16T10:00:00.000Z';

describe('the ordinary case', () => {
  it('turns the old key into one campaign with a name', async () => {
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    const result = await migration.migrateLegacyGmState({ storage, now: at });

    expect(result.outcome).toBe('migrated');
    expect(result.campaign?.name).toBe(migration.FIRST_CAMPAIGN_NAME);
    expect(keys.has('dhc.gm.v1')).toBe(false);
  });

  it('brings across every part of it, not just the Fear', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    await migration.migrateLegacyGmState({ storage, now: at });

    const { campaigns } = await store.readCampaigns();
    expect(campaigns).toHaveLength(1);
    const c = campaigns[0]!;

    expect(c.fear).toBe(7);
    expect(c.board.region).toBe('scene');
    expect(c.board.partyTier).toBe(2);
    expect(c.board.environmentRef).toBe('raging-river');
    expect(c.board.roster).toEqual([{ ref: 'acid-burrower', count: 1 }]);
    expect(c.board.adjustments.harder).toBe(true);
    /*
     * The fight, which no longer arrives on the board.
     *
     * `dhc.gm.v1` was written by a build whose fight lived in one list on the
     * GM screen, and `campaignFromLegacy` still copies that list into
     * `board.combatants` - a schema-4 board, by construction. At schema 5 the
     * board has no such field, so the ONLY road from that blob to a fight the
     * app can draw is the `from: 4` converter, which lands it on a scene row
     * and points `openScene` at it.
     *
     * Asserted through the pointer rather than against a minted id, because
     * which id the rescue row gets is the converter's business and is held
     * against frozen bytes in `campaignSchema.test.ts`. What this file owns is
     * the one-way door: these two marks are the only assertions in the suite
     * that say a GM's fight survived the trip out of localStorage, and the key
     * is deleted immediately afterwards.
     */
    const open = c.session.find((i) => i.id === c.board.openScene);
    const fight = open?.kind === 'scene' ? open.combatants : [];
    expect(fight[0]?.hp).toEqual({ marked: 3, max: 8 });
    expect(fight[0]?.notes).toBe('on the far bank');
    // The rescue row is the only place that fight can be drawn, so it has to
    // carry the place the blob was being played in.
    expect(open?.kind === 'scene' && open.environmentRef).toBe('raging-river');
    expect(c.party.map((m) => m.sheet.name)).toEqual(['Ilya of the Ninth']);
    expect(c.party[0]?.tracks).toEqual({ hp: 2, stress: 4, hope: 3, armor: 1 });
  });

  it('makes the countdowns session items, keeping their numbers', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    await migration.migrateLegacyGmState({ storage, now: at });

    const c = (await store.readCampaigns()).campaigns[0]!;
    const items = c.session.filter((i) => i.kind === 'countdown');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.name)).toEqual(['The ice gives way', 'Reinforcements']);
    expect(items[0]!.kind === 'countdown' && items[0]!.countdown.value).toBe(4);
    expect(items[1]!.kind === 'countdown' && items[1]!.countdown.kind).toBe('loop');
  });

  it('marks none of them primary, because the old store had no such idea', async () => {
    // Choosing one on the GM's behalf would be the app deciding which clock
    // they are watching tonight.
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    await migration.migrateLegacyGmState({ storage, now: at });
    const c = (await store.readCampaigns()).campaigns[0]!;
    expect(c.session.some((i) => i.kind === 'countdown' && i.primary)).toBe(false);
  });

  it('does nothing at all when there is no old key', async () => {
    const { storage } = fakeStorage();
    const result = await migration.migrateLegacyGmState({ storage, now: at });
    expect(result.outcome).toBe('nothing-to-do');
    expect((await store.readCampaigns()).campaigns).toEqual([]);
  });

  it('does not run a second time once the key is gone', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    await migration.migrateLegacyGmState({ storage, now: at });
    const again = await migration.migrateLegacyGmState({ storage, now: at });
    expect(again.outcome).toBe('nothing-to-do');
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });
});

describe('verify before delete', () => {
  it('keeps the old key when the write is refused', async () => {
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    const result = await migration.migrateLegacyGmState({
      storage,
      now: at,
      write: () => Promise.reject(new Error('QuotaExceededError')),
    });

    expect(result.outcome).toBe('not-verified');
    expect(keys.get('dhc.gm.v1')).toBe(JSON.stringify(LEGACY));
  });

  it('keeps the old key when the write resolves and stores nothing', async () => {
    // The failure the whole file exists for. A resolved `put` is not a record
    // on the disk: quota can bite at commit, a transaction can abort, a
    // private window can accept writes and keep none of them.
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    const result = await migration.migrateLegacyGmState({
      storage,
      now: at,
      write: () => Promise.resolve(),
      read: () => Promise.resolve(null),
    });

    expect(result.outcome).toBe('not-verified');
    expect(result.message).toMatch(/Nothing has been changed/);
    expect(keys.get('dhc.gm.v1')).toBe(JSON.stringify(LEGACY));
  });

  it('keeps the old key when what comes back is not what went in', async () => {
    // A count would pass this. The Fear pool comes back at 3 instead of 7 and
    // every list is the right length.
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    const result = await migration.migrateLegacyGmState({
      storage,
      now: at,
      read: async (id) => {
        const c = await store.getCampaign(id);
        return c === null ? null : { ...c, fear: 3 };
      },
    });

    expect(result.outcome).toBe('not-verified');
    expect(result.message).toMatch(/not what was written/);
    expect(keys.has('dhc.gm.v1')).toBe(true);
  });

  it('keeps the old key when the read-back itself throws', async () => {
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    const result = await migration.migrateLegacyGmState({
      storage,
      now: at,
      write: () => Promise.resolve(),
      read: () => Promise.reject(new Error('storage did not respond')),
    });
    expect(result.outcome).toBe('not-verified');
    expect(keys.has('dhc.gm.v1')).toBe(true);
  });

  it('does not fail an identical pair over the order of its keys', async () => {
    // A structured clone need not preserve key order, and a `JSON.stringify`
    // comparison would then refuse every migration on this device forever.
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    const result = await migration.migrateLegacyGmState({
      storage,
      now: at,
      read: async (id) => {
        const c = await store.getCampaign(id);
        if (c === null) return null;
        // Same content, rebuilt with the keys in the opposite order.
        const flipped = Object.fromEntries(Object.entries(c).reverse()) as unknown as Campaign;
        return flipped;
      },
    });

    expect(result.outcome).toBe('migrated');
    expect(keys.has('dhc.gm.v1')).toBe(false);
  });

  it('overwrites its own campaign on a retry rather than making a second one', async () => {
    // Write succeeds, verification fails, the key is correctly left alone -
    // and the next launch must not leave the GM with two identical tables.
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });

    await migration.migrateLegacyGmState({
      storage,
      now: at,
      read: () => Promise.resolve(null),
    });
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);

    const second = await migration.migrateLegacyGmState({ storage, now: at });
    expect(second.outcome).toBe('migrated');
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });

  it('leaves the campaign written even when the key will not go away', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify(LEGACY) });
    const stubborn = {
      ...storage,
      removeItem: () => {
        throw new Error('storage is read-only');
      },
    };

    const result = await migration.migrateLegacyGmState({ storage: stubborn, now: at });

    // The data is on the disk and verified. A key that will not go away only
    // costs one more identical write next launch.
    expect(result.outcome).toBe('migrated');
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });
});

describe('when the old key cannot be read at all', () => {
  it('keeps it, renames it, and says where it went', async () => {
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': '{ this is not json' });

    const result = await migration.migrateLegacyGmState({ storage, now: at });

    expect(result.outcome).toBe('unreadable');
    expect(result.message).toMatch(/Nothing has been deleted/);
    expect(result.message).toMatch(/dhc\.gm\.v1\.unreadable/);
    expect(keys.get('dhc.gm.v1.unreadable')).toBe('{ this is not json');
    expect(keys.has('dhc.gm.v1')).toBe(false);
  });

  it('writes no campaign for it', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': 'null' });
    await migration.migrateLegacyGmState({ storage, now: at });
    expect((await store.readCampaigns()).campaigns).toEqual([]);
  });

  it('does not try again on every launch', async () => {
    // Leaving it in place would mean the same failure, and the same sentence
    // on screen, every time the app starts for the rest of the device's life.
    const { storage } = fakeStorage({ 'dhc.gm.v1': '{ this is not json' });
    await migration.migrateLegacyGmState({ storage, now: at });
    expect((await migration.migrateLegacyGmState({ storage, now: at })).outcome).toBe(
      'nothing-to-do',
    );
  });

  it('leaves both keys alone when it cannot even write the quarantine copy', async () => {
    const { storage, keys } = fakeStorage({ 'dhc.gm.v1': '{ this is not json' });
    const full = {
      ...storage,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    await migration.migrateLegacyGmState({ storage: full, now: at });
    expect(keys.get('dhc.gm.v1')).toBe('{ this is not json');
  });
});

describe('what the reader repaired on the way through, named rather than counted', () => {
  it('reports a party row it had to leave out, and still migrates the rest', async () => {
    const { storage } = fakeStorage({
      'dhc.gm.v1': JSON.stringify({ ...LEGACY, party: [{ id: 'ghost' }, ...LEGACY.party] }),
    });

    const result = await migration.migrateLegacyGmState({ storage, now: at });

    expect(result.outcome).toBe('migrated');
    expect(result.warnings.join(' ')).toMatch(/no character sheet/);
    expect(result.campaign?.party.map((m) => m.id)).toEqual(['pc-1']);
  });

  it('survives a half-written blob rather than quarantining the lot', async () => {
    const { storage } = fakeStorage({ 'dhc.gm.v1': JSON.stringify({ fear: 'lots' }) });
    const result = await migration.migrateLegacyGmState({ storage, now: at });
    expect(result.outcome).toBe('migrated');
    expect(result.campaign?.fear).toBe(0);
  });
});

describe('a platform with no localStorage at all', () => {
  it('says there is nothing to do rather than throwing during boot', async () => {
    const result = await migration.migrateLegacyGmState({ storage: null, now: at });
    expect(result.outcome).toBe('nothing-to-do');
  });

  it('says the same when reading the key throws', async () => {
    const result = await migration.migrateLegacyGmState({
      now: at,
      storage: {
        getItem: () => {
          throw new Error('access is denied');
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
    expect(result.outcome).toBe('nothing-to-do');
  });
});
