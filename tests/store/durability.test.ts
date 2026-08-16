/**
 * Second-tier durability: four ways the only copy could go quietly.
 *
 * None of these loses a character on its own. Each one removes a guard that
 * the next failure would have needed, and every one of them was silent - which
 * is what puts them in P0 rather than in hygiene.
 *
 *   - persistent storage was requested only by `create()`, and only when the
 *     library was empty, so a library that arrived by import was never asked
 *     about and a later `create()` never asked either;
 *   - a debounced write still holding a character put it back after the delete;
 *   - one malformed record made `listCharacters` throw and took the whole
 *     library with it;
 *   - a backup was recorded as successful the moment `close()` resolved.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../shared/types.ts';
import { writeIntoDirectory } from '../../src/transfer/fileIo.ts';
import { indexDataset } from '../../src/engine/character.ts';
import { makeCharacter, makeClass, makeDataset, makeSubclass } from '../fixtures/factories.ts';

const dataset = makeDataset({ classes: [makeClass()], subclasses: [makeSubclass()] });

type Store = typeof import('../../src/store/state.ts');
type Db = typeof import('../../src/store/db.ts');

let store: Store;
let db: Db;
let persistCalls: number;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();

  persistCalls = 0;
  vi.stubGlobal('navigator', {
    storage: {
      persisted: () => Promise.resolve(false),
      persist: () => {
        persistCalls += 1;
        return Promise.resolve(true);
      },
      estimate: () => Promise.resolve({ usage: 0, quota: 1 }),
    },
  });

  db = await import('../../src/store/db.ts');
  store = await import('../../src/store/state.ts');
  store.useApp.setState({
    ready: true,
    dataset,
    index: indexDataset(dataset),
    characters: [],
    activeId: null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
 * Real timers, not fake ones. `fake-indexeddb` drives every request through
 * `setImmediate`, so replacing the clock stops the database answering at all -
 * the first draft of this file timed out on nine tests for that reason. The
 * debounce here is 400 ms and there is exactly one place that has to outlast
 * it, so a real wait is cheaper than the machinery to avoid one.
 */
const settle = (ms = 0): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('asking the browser to keep the storage', () => {
  it('asks when the first character is created', async () => {
    await store.useApp.getState().create({ name: 'First' });
    await settle();
    expect(persistCalls).toBe(1);
  });

  it('asks when the first character arrives by import instead', async () => {
    // The path that never asked, and the one where the user has the most at
    // stake: they have just restored a library onto a fresh origin.
    await store.useApp.getState().importCharacters([makeCharacter({ name: 'Restored' })]);
    await settle();
    expect(persistCalls).toBe(1);
  });

  it('does not ask again for every character in the same restore', async () => {
    await store
      .useApp.getState()
      .importCharacters([makeCharacter({ name: 'A' }), makeCharacter({ name: 'B' })]);
    await settle();
    expect(persistCalls).toBe(1);
  });
});

describe('deleting a character', () => {
  it('does not let a pending write put it back', async () => {
    // The sequence: edit a character, which schedules a write on a 400 ms
    // debounce, then delete it inside that window. The write used to land
    // afterwards and the character reappeared on the next launch.
    const c = makeCharacter({ name: 'Doomed' });
    await db.putCharacter(c);
    store.useApp.setState({ characters: [c], activeId: c.id });

    store.useApp.getState().update((current) => ({ ...current, name: 'Edited' }));
    await store.useApp.getState().remove(c.id);

    await settle(600);
    await store.flushPending();

    expect(await db.getCharacter(c.id)).toBeUndefined();
    expect(store.useApp.getState().characters).toEqual([]);
  });
});

describe('a record this build cannot read', () => {
  const writeRaw = async (record: Record<string, unknown>): Promise<void> => {
    const database = await db.db();
    await database.put('characters', record as unknown as Character);
  };

  it('does not take the rest of the library down with it', async () => {
    // The measured failure: `listCharacters` sorted on
    // `b.updatedAt.localeCompare(...)`, so a record missing that field threw
    // and the whole read failed - intermittently, because whether it throws
    // depends on where `getAll` put the record, which is key order, which is a
    // UUID. It surfaced as the storage banner saying everything was probably
    // fine.
    //
    // A missing `updatedAt` does not even cost the record now: the reader
    // fills it from the blank sheet, the way it fills every other absent
    // optional field, so the character comes back with a timestamp rather than
    // being quarantined. Recovering it is strictly better than naming it.
    await db.putCharacter(makeCharacter({ name: 'Fine' }));
    const broken = makeCharacter({ name: 'Broken' }) as unknown as Record<string, unknown>;
    delete broken['updatedAt'];
    await writeRaw(broken);

    const { characters, quarantined, repaired } = await db.readLibrary();
    expect(characters.map((c) => c.name).sort()).toEqual(['Broken', 'Fine']);
    expect(quarantined).toEqual([]);
    expect(characters.find((c) => c.name === 'Broken')!.updatedAt).not.toBe('');
    expect(repaired.map((c) => c.name)).toEqual(['Broken']);
  });

  it('quarantines a record with no traits, and says which one', async () => {
    const broken = makeCharacter({ name: 'No traits' }) as unknown as Record<string, unknown>;
    delete broken['traits'];
    await writeRaw(broken);
    await db.putCharacter(makeCharacter({ name: 'Fine' }));

    const { characters, quarantined } = await db.readLibrary();
    expect(characters.map((c) => c.name)).toEqual(['Fine']);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]!.name).toBe('No traits');
    expect(quarantined[0]!.reason).toMatch(/has no traits/);
  });

  it('quarantines a record whose gold is the wrong shape, rather than rendering it', async () => {
    const broken = makeCharacter({ name: 'Bad gold' }) as unknown as Record<string, unknown>;
    broken['gold'] = null;
    await writeRaw(broken);

    const { characters, quarantined } = await db.readLibrary();
    expect(characters).toEqual([]);
    expect(quarantined[0]!.reason).toMatch(/damaged "gold" field/);
  });

  it('hands back a repaired record for the caller to write down', async () => {
    // An Experience with no id renders two chips with the same React key and
    // arms the wrong one. The reader mints ids; this is what says so.
    const broken = makeCharacter({ name: 'No experience ids' }) as unknown as Record<
      string,
      unknown
    >;
    broken['experiences'] = [{ name: 'Ran with the wolves', bonus: 2 }];
    await writeRaw(broken);

    const { characters, repaired } = await db.readLibrary();
    expect(characters[0]!.experiences[0]!.id).not.toBe('');
    expect(repaired.map((c) => c.name)).toEqual(['No experience ids']);
  });

  it('leaves a record alone when nothing about it needed repairing', async () => {
    await db.putCharacter(makeCharacter({ name: 'Whole' }));
    const { repaired } = await db.readLibrary();
    expect(repaired).toEqual([]);
  });
});

describe('a backup that was written but not read back', () => {
  /** A folder whose files can be opened again, and mangled on the way out. */
  function folder(options: { truncate?: boolean; drop?: boolean } = {}): FileSystemDirectoryHandle {
    const files = new Map<string, string>();
    return {
      name: 'Daggerheart',
      getFileHandle: (fileName: string) =>
        Promise.resolve({
          name: fileName,
          createWritable: () =>
            Promise.resolve({
              write: (text: string) => {
                files.set(fileName, options.truncate === true ? text.slice(0, 40) : text);
                return Promise.resolve();
              },
              close: () => Promise.resolve(),
            }),
          getFile: () =>
            Promise.resolve({
              text: () => Promise.resolve(options.drop === true ? '' : (files.get(fileName) ?? '')),
            }),
        }),
    } as unknown as FileSystemDirectoryHandle;
  }

  it('reports success when the file reads back byte for byte', async () => {
    const result = await writeIntoDirectory(folder(), 'backup.dhbackup', 'contents');
    expect(result.ok).toBe(true);
  });

  it('refuses to call a truncated write a backup', async () => {
    const result = await writeIntoDirectory(
      folder({ truncate: true }),
      'backup.dhbackup',
      'a'.repeat(200),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/came back different when it was read again/);
    expect(result.reason).toMatch(/has not been counted as a backup/);
  });

  it('refuses when the file comes back empty', async () => {
    const result = await writeIntoDirectory(folder({ drop: true }), 'backup.dhbackup', 'contents');
    expect(result.ok).toBe(false);
  });

  it('lets the caller check what the bytes mean, not only that they match', async () => {
    const result = await writeIntoDirectory(folder(), 'backup.dhbackup', 'contents', {
      verify: () => 'backup.dhbackup came back holding 2 characters instead of 3',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/2 characters instead of 3/);
  });
});
