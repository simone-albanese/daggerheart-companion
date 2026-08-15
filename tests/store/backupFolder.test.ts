/**
 * The backup folder handle lives in its own tiny IndexedDB, and it is read on
 * every `visibilitychange` - which is to say, every time the user glances at
 * another tab. Opening a connection per read is invisible until the day the
 * database needs a version change and every one of those connections blocks
 * it, so the connection is pinned here the way `db.ts` pins the app's.
 *
 * `idb` is mocked rather than shimmed: what is being counted is how many times
 * the database is opened, and no fake IndexedDB is needed to count that.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const { openDB, opens, contents } = vi.hoisted(() => {
  const opens = { count: 0 };
  const contents = new Map<string, unknown>();
  const database = {
    get: (_store: string, key: string) => Promise.resolve(contents.get(key)),
    put: (_store: string, value: unknown, key: string) => {
      contents.set(key, value);
      return Promise.resolve(key);
    },
    delete: (_store: string, key: string) => {
      contents.delete(key);
      return Promise.resolve();
    },
  };
  return {
    opens,
    contents,
    openDB: vi.fn(() => {
      opens.count += 1;
      return Promise.resolve(database);
    }),
  };
});

vi.mock('idb', () => ({ openDB }));

/** A fresh module, because the pinned connection is module state. */
const freshBackup = async (): Promise<typeof import('../../src/store/backup.ts')> => {
  vi.resetModules();
  opens.count = 0;
  contents.clear();
  openDB.mockClear();
  return import('../../src/store/backup.ts');
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the remembered folder', () => {
  it('opens its database once, however often it is read', async () => {
    vi.stubGlobal('indexedDB', {});
    const { loadBackupFolder } = await freshBackup();

    for (let i = 0; i < 5; i += 1) expect(await loadBackupFolder()).toBeNull();

    expect(opens.count).toBe(1);
  });

  it('retries after a failure instead of giving up for the session', async () => {
    vi.stubGlobal('indexedDB', {});
    const { loadBackupFolder } = await freshBackup();
    openDB.mockImplementationOnce(() => {
      opens.count += 1;
      return Promise.reject(new Error('the database is locked'));
    });

    expect(await loadBackupFolder()).toBeNull();
    expect(await loadBackupFolder()).toBeNull();
    expect(opens.count).toBe(2);
  });
});
