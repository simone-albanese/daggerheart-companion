/**
 * An import against a disk that refuses, or that is about to be written twice.
 *
 * Two doors in `state.ts` write straight to `db.putCharacter`: `importCharacters`
 * and `resolveImport`. Both are exercised here against the one refusal that
 * ships on purpose - a record stamped with a newer schema than this build
 * knows, which `putCharacter` will not write over - because a `.dhbackup`
 * restore onto a device that has taken an update in another tab reaches it.
 *
 * The first describe is about the loop: one refused character used to reject
 * the whole call, so the characters after it never landed and the report that
 * would have named the ones before it was thrown away. The second is about the
 * debounced writer's retry copy, which `remove()` clears before its delete
 * (BACKLOG, "a pending debounced write can resurrect a just-deleted character")
 * and which neither import door cleared before its put.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type Character } from '../../shared/types.ts';
import { indexDataset } from '../../src/engine/character.ts';
import { makeCharacter, makeClass, makeDataset, makeSubclass } from '../fixtures/factories.ts';

const dataset = makeDataset({ classes: [makeClass()], subclasses: [makeSubclass()] });

type Store = typeof import('../../src/store/state.ts');
type Db = typeof import('../../src/store/db.ts');

let store: Store;
let db: Db;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  vi.resetModules();
  vi.restoreAllMocks();

  db = await import('../../src/store/db.ts');
  store = await import('../../src/store/state.ts');
  store.useApp.setState({
    ready: true,
    writeError: null,
    dataset,
    index: indexDataset(dataset),
    characters: [],
    activeId: null,
  });
});

/** Put a record on the disk that this build is not allowed to write over. */
async function blockWritesTo(c: Character): Promise<void> {
  const database = await db.db();
  await database.put('characters', {
    ...c,
    schemaVersion: SCHEMA_VERSION + 1,
  } as unknown as Character);
}

/** Take the block away, so the same character can be written after all. */
async function unblock(c: Character): Promise<void> {
  const database = await db.db();
  await database.delete('characters', c.id);
}

const names = (list: Character[]): string[] => list.map((c) => c.name);

describe('a backup with one record the device refuses to take', () => {
  const a = makeCharacter({ name: 'Anselm' });
  const b = makeCharacter({ name: 'Brix' });
  const c = makeCharacter({ name: 'Cass' });

  it('lands the characters after the refused one, and says which one was refused', async () => {
    await blockWritesTo(b);

    const report = await store.useApp.getState().importCharacters([a, b, c]);

    expect(names(report.imported), 'the restore stopped at the refused record').toEqual([
      'Anselm',
      'Cass',
    ]);
    expect((await db.getCharacter(c.id))?.name, 'the character after the refusal never landed').toBe(
      'Cass',
    );
    expect(report.warnings, 'the refusal was not reported').toHaveLength(1);
    expect(report.warnings[0]).toMatch(/"Brix" was last saved by a newer version/);
    expect(report.warnings[0]).toMatch(/has not written over it/);
  });

  it('leaves the newer record alone and keeps the refused character out of the library', async () => {
    await blockWritesTo(b);

    await store.useApp.getState().importCharacters([a, b, c]);

    const stored = (await (await db.db()).get('characters', b.id)) as unknown as Record<
      string,
      unknown
    >;
    expect(stored['schemaVersion'], 'the newer record was written over').toBe(
      SCHEMA_VERSION + 1,
    );
    expect(
      names(store.useApp.getState().characters),
      'a character that is not on the disk was shown as if it were',
    ).toEqual(['Cass', 'Anselm']);
  });

  it('still throws a failure that is not a schema refusal, once the rest has landed', async () => {
    // CONTROL for the other arm: a disk that fails for a reason this build did
    // not choose is not folded into a warning the user would read as "done".
    // `db.ts` is mocked at the module seam because `state.ts` holds the live
    // binding, which a spy on the namespace object cannot reach.
    vi.doMock('../../src/store/db.ts', async (importOriginal) => {
      const actual = await importOriginal<Db>();
      return {
        ...actual,
        putCharacter: async (x: Character): Promise<void> => {
          if (x.id === b.id) throw new Error('QuotaExceededError');
          await actual.putCharacter(x);
        },
      };
    });
    vi.resetModules();
    store = await import('../../src/store/state.ts');
    store.useApp.setState({
      ready: true,
      writeError: null,
      dataset,
      index: indexDataset(dataset),
      characters: [],
      activeId: null,
    });

    await expect(store.useApp.getState().importCharacters([a, b, c])).rejects.toThrow(
      'QuotaExceededError',
    );
    expect((await db.getCharacter(c.id))?.name, 'the loop stopped at the failure').toBe('Cass');
    vi.doUnmock('../../src/store/db.ts');
  });
});

describe('an import the user chose, against the retry copy of a failed write', () => {
  const a = makeCharacter({ name: 'Rook' });
  const fromBackup = (): Character => ({ ...a, name: 'Rook, from the backup', updatedAt: '2026-07-01T12:00:00.000Z' });

  /** A refused write of the local copy, which leaves its retry copy in `pending`. */
  async function leaveARetryCopy(): Promise<void> {
    await blockWritesTo(a);
    store.useApp.setState({ characters: [a], activeId: a.id });
    store.useApp.getState().update((x) => ({ ...x, name: 'Rook, edited in the tab' }));
    await store.flushPending();
    expect(store.useApp.getState().writeError?.kind, 'the precondition is a refused write').toBe(
      'stale',
    );
    // The other tab closed; the record can be written again.
    await unblock(a);
  }

  it('TAKE THEIRS is not written over by the next flush', async () => {
    await leaveARetryCopy();
    const local = store.useApp.getState().characters[0]!;

    await store.useApp.getState().resolveImport({ incoming: fromBackup(), local }, 'take-theirs');
    // What an edit to another character, or `pagehide`, does next.
    await store.flushPending();

    expect(
      (await db.getCharacter(a.id))?.name,
      'the retry copy of the rejected local edit was written over the copy the user chose',
    ).toBe('Rook, from the backup');
    expect(store.useApp.getState().characters[0]?.name).toBe('Rook, from the backup');
    expect(store.useApp.getState().writeError, 'nothing is unwritten any more').toBeNull();
  });

  it('a replace-mode import is not written over by the next flush', async () => {
    await leaveARetryCopy();

    await store.useApp.getState().importCharacters([fromBackup()], { mode: 'replace' });
    await store.flushPending();

    expect(
      (await db.getCharacter(a.id))?.name,
      'the retry copy of the rejected local edit was written over the copy the user chose',
    ).toBe('Rook, from the backup');
    expect(store.useApp.getState().writeError).toBeNull();
  });
});
