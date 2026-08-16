/**
 * A write that does not reach the disk has to reach the screen.
 *
 * `flush` used to clear `pending` before awaiting the writes, with no try/catch
 * and three bare `void flush()` call sites, and there is no `unhandledrejection`
 * handler anywhere in the app. So a refused `putCharacter` was thrown into a
 * promise nobody was holding, the batch it belonged to was already gone, and
 * the sheet went on showing every mark, every point of Hope and every level-up
 * as applied - because zustand's copy is in memory and nothing ever reads back.
 *
 * The failure used here is not a hypothetical. `db.putCharacter` refuses, on
 * purpose, to write over a record stamped with a newer schema than this build
 * knows (P0-8): an ordinary device that has taken an update in another tab
 * reaches it. Planting such a record is therefore a real, shipping rejection
 * rather than a mock of one.
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

const seed = (characters: Character[]): void => {
  store.useApp.setState({
    ready: true,
    characters,
    activeId: characters[0]?.id ?? null,
    writeError: null,
  });
};

describe('a write the device refuses', () => {
  it('does not become a rejection nobody is holding', async () => {
    const c = makeCharacter({ name: 'Rook' });
    await blockWritesTo(c);
    seed([c]);

    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));

    await expect(
      store.flushPending(),
      'a refused write was thrown into a promise nobody catches',
    ).resolves.toBeUndefined();
  });

  it('puts the refusal on the store, in the words the failure itself used', async () => {
    const c = makeCharacter({ name: 'Rook' });
    await blockWritesTo(c);
    seed([c]);

    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();

    const failure = store.useApp.getState().writeError;
    expect(
      failure,
      'the write failed and the store carries no signal the shell could render',
    ).not.toBeNull();
    expect(failure!.kind).toBe('stale');
    expect(failure!.count).toBe(1);
    expect(failure!.message).toMatch(/has not written over it/);
    expect(failure!.message).toMatch(/only in this tab/);
  });

  it('keeps the batch instead of dropping it on the way past the failure', async () => {
    const c = makeCharacter({ name: 'Rook' });
    await blockWritesTo(c);
    seed([c]);

    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();

    // Whatever was in the way is gone - the other tab closed, the space was
    // freed - and the change the user made an hour ago is still there to write.
    await unblock(c);
    await store.flushPending();

    expect(
      (await db.getCharacter(c.id))?.name,
      'the failed batch was dropped instead of re-queued',
    ).toBe('Renamed');
    expect(store.useApp.getState().writeError).toBeNull();
  });

  it('does not clear the warning while another character is still failing', async () => {
    const bad = makeCharacter({ name: 'Blocked' });
    const good = makeCharacter({ name: 'Fine' });
    await blockWritesTo(bad);
    seed([bad, good]);

    store.useApp.setState({ activeId: bad.id });
    store.useApp.getState().update((x) => ({ ...x, name: 'Blocked, edited' }));
    store.useApp.setState({ activeId: good.id });
    store.useApp.getState().update((x) => ({ ...x, name: 'Fine, edited' }));
    await store.flushPending();

    expect(
      store.useApp.getState().writeError?.count,
      'one character failed and one succeeded, and the count does not say which',
    ).toBe(1);
    expect((await db.getCharacter(good.id))?.name).toBe('Fine, edited');

    await unblock(bad);
    await store.flushPending();
    expect(store.useApp.getState().writeError).toBeNull();
  });

  it('never re-queues a character the user deleted while it was in flight', async () => {
    const c = makeCharacter({ name: 'Doomed' });
    await blockWritesTo(c);
    seed([c]);

    store.useApp.getState().update((x) => ({ ...x, name: 'Edited' }));
    // The delete lands while the refused write is still on its way back.
    const flushing = store.flushPending();
    await store.useApp.getState().remove(c.id);
    await flushing;
    await store.flushPending();

    await unblock(c);
    await store.flushPending();

    expect(
      await db.getCharacter(c.id),
      'a write that failed brought a deleted character back on the retry',
    ).toBeUndefined();
    expect(store.useApp.getState().characters).toEqual([]);
    expect(store.useApp.getState().writeError).toBeNull();
  });
});

describe('a request the database itself refuses', () => {
  /**
   * The shape a full disk has: the `put` request fails, and the transaction
   * aborts because of it. Reached here by aborting the transaction from inside
   * `put`, which produces exactly that pair - a request error and an abort -
   * without needing a device that is actually out of space.
   */
  function refuseTheNextWrite(): () => void {
    const real = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function refused(
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ): IDBRequest<IDBValidKey> {
      const request = real.apply(this, args);
      this.transaction.abort();
      return request;
    };
    return () => {
      IDBObjectStore.prototype.put = real;
    };
  }

  /**
   * `idb` builds `tx.done` the moment the transaction is made and attaches its
   * reject to `error` and `abort` immediately. `putCharacter` is written as
   * `await tx.store.put(c); await tx.done;`, so a refused request skips the
   * second line, the transaction aborts anyway, and `tx.done` rejects with an
   * `AbortError` nobody is holding.
   *
   * Catching `putCharacter` does not help: the rejection is on a promise the
   * caller has never seen. So the one function whose job is to report a failed
   * write was emitting a second, invisible failure every time it did - which is
   * the defect this whole file exists for, coming out of the fix for it.
   */
  it('does not leave a second rejection behind that nobody is holding', async () => {
    const seen: unknown[] = [];
    const record = (reason: unknown): void => void seen.push(reason);
    process.on('unhandledRejection', record);

    const restore = refuseTheNextWrite();
    const c = makeCharacter({ name: 'Rook' });
    seed([c]);
    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();
    restore();

    // A turn of the loop, which is when Node decides a rejection is unhandled.
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.off('unhandledRejection', record);

    expect(
      seen.map((e) => (e instanceof Error ? e.name : String(e))),
      'the refused write reported itself once to the store and once to nobody',
    ).toEqual([]);
    // And it did report itself: without this the test would pass against a
    // write that simply succeeded.
    expect(store.useApp.getState().writeError).not.toBeNull();
  });
});

describe('a full device', () => {
  it('says it is out of space rather than naming no cause at all', async () => {
    const quota = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(db, 'putCharacter').mockRejectedValue(quota);

    const c = makeCharacter({ name: 'Rook' });
    seed([c]);
    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();

    const failure = store.useApp.getState().writeError;
    expect(failure?.kind).toBe('quota');
    expect(failure?.message).toMatch(/out of space/);
    expect(failure?.message).toMatch(/free some space/);
  });

  it('reads the browser’s own error out of whatever aborted around it', async () => {
    // A transaction that aborts carries the request's error underneath rather
    // than being it. Classifying only the outermost error would call this one
    // "other" and print a sentence that names no cause.
    const abort = new Error('The transaction was aborted.');
    abort.name = 'AbortError';
    abort.cause = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(db, 'putCharacter').mockRejectedValue(abort);

    const c = makeCharacter({ name: 'Rook' });
    seed([c]);
    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();

    expect(store.useApp.getState().writeError?.kind).toBe('quota');
  });

  it('names the failure it does not recognise instead of inventing one', async () => {
    const odd = new Error('the disk fell off');
    odd.name = 'UnknownError';
    vi.spyOn(db, 'putCharacter').mockRejectedValue(odd);

    const c = makeCharacter({ name: 'Rook' });
    seed([c]);
    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));
    await store.flushPending();

    const failure = store.useApp.getState().writeError;
    expect(failure?.kind).toBe('other');
    expect(failure?.message).toMatch(/UnknownError/);
    expect(failure?.message).not.toMatch(/out of space/);
  });
});

describe('one batch at a time', () => {
  /**
   * `await flush()` has to mean the disk has it. It did not: `flush` cleared
   * `pending` synchronously and then awaited, so a second call while the first
   * was in flight found an empty map and resolved *before* the first one's
   * writes had landed. Everything built on that promise - the delete below, and
   * a backup taken as the page goes away - was being told yes too early.
   */
  it('does not let a second flush resolve before the first one has written', async () => {
    // The write is held open deliberately. Against a database that answers in
    // a tick, the old code's second flush also *looked* correct: it resolved
    // early, and by the time the assertion read the record back the first
    // write had landed anyway. A phone under memory pressure is not that
    // database, and `pagehide` is measured in the same milliseconds.
    let land = (): void => {};
    const held = new Promise<void>((resolve) => {
      land = resolve;
    });
    const put = vi.spyOn(db, 'putCharacter').mockReturnValue(held);

    const c = makeCharacter({ name: 'Rook' });
    seed([c]);
    store.useApp.getState().update((x) => ({ ...x, name: 'Renamed' }));

    const first = store.flushPending();
    const second = store.flushPending();
    let settled = false;
    void second.then(() => {
      settled = true;
    });

    // Several turns, so "not yet" is an answer rather than a race.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      settled,
      'a flush reported the disk had it while the write was still in the air',
    ).toBe(false);
    expect(put).toHaveBeenCalledTimes(1);

    land();
    await first;
    await second;
    expect(settled).toBe(true);
  });
});
