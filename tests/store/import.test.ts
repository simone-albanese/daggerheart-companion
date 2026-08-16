/**
 * Importing a character, which used to be an unconditional overwrite.
 *
 * `importCharacter` was one line: `await db.putCharacter(c)`. IndexedDB's
 * `put` is keyed on `id`, so restoring an August backup wrote over the
 * September character in place - no prompt, no undo, no history, and a hint
 * beside the button that encouraged it. Deleting *one* character in this app
 * requires arm-then-confirm with an inventory of what is lost.
 *
 * Two rules are tested here and both are about not losing work. A newer local
 * copy is never written over: the import comes back as a question with nothing
 * written. And the counters are synced the way every other write path syncs
 * them - except when this build cannot resolve the refs those maxima are
 * derived from, where syncing would clamp a real number against a fallback.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../shared/types.ts';
import { decideImport, duplicateFor } from '../../src/store/merge.ts';
import { indexDataset } from '../../src/engine/character.ts';
import {
  makeArmor,
  makeCharacter,
  makeClass,
  makeDataset,
  makeSubclass,
} from '../fixtures/factories.ts';

const at = (iso: string) => (c: Character): Character => ({ ...c, updatedAt: iso });
const AUGUST = at('2026-08-01T12:00:00.000Z');
const SEPTEMBER = at('2026-09-01T12:00:00.000Z');

describe('the merge rule, on its own', () => {
  const incoming = AUGUST(makeCharacter({ name: 'Ilya' }));

  it('imports what is not here', () => {
    expect(decideImport(incoming, undefined)).toBe('import');
  });

  it('replaces a copy that is older than what arrived', () => {
    const local = at('2026-07-01T12:00:00.000Z')({ ...incoming });
    expect(decideImport(incoming, local)).toBe('replace');
  });

  it('keeps the local copy when it is newer - the August-over-September case', () => {
    const local = SEPTEMBER({ ...incoming });
    expect(decideImport(incoming, local)).toBe('keep-local');
  });

  it('keeps the local copy when the two are the same age', () => {
    // Equal means the same edit. Writing a record over a copy of itself is
    // churn the debounce would then replicate into the next backup.
    expect(decideImport(incoming, { ...incoming })).toBe('keep-local');
  });

  it('overwrites regardless in replace mode, which is the point of that mode', () => {
    expect(decideImport(incoming, SEPTEMBER({ ...incoming }), 'replace')).toBe('replace');
  });
});

describe('keeping both copies', () => {
  const now = new Date('2026-10-05T09:00:00.000Z');

  it('mints a new id, so the two cannot collide again', () => {
    const incoming = makeCharacter({ name: 'Ilya' });
    const copy = duplicateFor(incoming, [incoming], now);
    expect(copy.id).not.toBe(incoming.id);
  });

  it('renames it, because the header picker is a list of names', () => {
    const incoming = makeCharacter({ name: 'Ilya' });
    expect(duplicateFor(incoming, [incoming], now).name).toBe('Ilya (imported)');
  });

  it('counts up rather than producing two identical names', () => {
    const incoming = makeCharacter({ name: 'Ilya' });
    const taken = [incoming, { ...incoming, name: 'Ilya (imported)' }];
    expect(duplicateFor(incoming, taken, now).name).toBe('Ilya (imported 2)');
  });

  it('leaves updatedAt alone, so the copy does not look newer than it is', () => {
    const incoming = AUGUST(makeCharacter({ name: 'Ilya' }));
    const copy = duplicateFor(incoming, [incoming], now);
    expect(copy.updatedAt).toBe(incoming.updatedAt);
    expect(copy.createdAt).toBe(now.toISOString());
  });

  it('keeps everything else the character was', () => {
    const incoming = makeCharacter({ name: 'Ilya', level: 7, notes: 'a ledger of names' });
    const copy = duplicateFor(incoming, [incoming], now);
    expect(copy.level).toBe(7);
    expect(copy.notes).toBe('a ledger of names');
  });
});

describe('the store, against a real database', () => {
  type Store = typeof import('../../src/store/state.ts');
  let store: Store;

  const dataset = makeDataset({
    classes: [makeClass({ id: 'test-class', startingHitPoints: 6 })],
    subclasses: [makeSubclass()],
    armors: [makeArmor({ id: 'test-armor', baseScore: 4 })],
  });

  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    store = await import('../../src/store/state.ts');
    store.useApp.setState({
      ready: true,
      dataset,
      index: indexDataset(dataset),
      characters: [],
      activeId: null,
    });
  });

  const seed = (c: Character): void => {
    store.useApp.setState({ characters: [c], activeId: c.id });
  };

  it('imports a character nothing here has', async () => {
    const report = await store.useApp.getState().importCharacters([makeCharacter({ name: 'New' })]);
    expect(report.imported.map((c) => c.name)).toEqual(['New']);
    expect(report.conflicts).toEqual([]);
    expect(store.useApp.getState().characters.map((c) => c.name)).toEqual(['New']);
  });

  it('updates a character this device has an older copy of', async () => {
    const local = at('2026-07-01T12:00:00.000Z')(makeCharacter({ name: 'Ilya', level: 3 }));
    seed(local);

    const report = await store
      .useApp.getState()
      .importCharacters([AUGUST({ ...local, level: 4 })]);

    expect(report.replaced).toHaveLength(1);
    expect(store.useApp.getState().characters[0]!.level).toBe(4);
  });

  it('writes nothing when this device has the newer copy', async () => {
    const local = SEPTEMBER(makeCharacter({ name: 'Ilya', level: 5 }));
    const db = await import('../../src/store/db.ts');
    await db.putCharacter(local);
    seed(local);

    const report = await store
      .useApp.getState()
      .importCharacters([AUGUST({ ...local, level: 2 })]);

    expect(report.conflicts).toHaveLength(1);
    expect(report.replaced).toEqual([]);
    // The September character is untouched, in memory and on disk. The disk
    // half is the one that mattered: the old code had already written by now.
    expect(store.useApp.getState().characters[0]!.level).toBe(5);
    expect((await db.getCharacter(local.id))?.level).toBe(5);
  });

  it('takes theirs only when asked', async () => {
    const local = SEPTEMBER(makeCharacter({ name: 'Ilya', level: 5 }));
    seed(local);
    const incoming = AUGUST({ ...local, level: 2 });

    const report = await store.useApp.getState().importCharacters([incoming]);
    await store.useApp.getState().resolveImport(report.conflicts[0]!, 'take-theirs');

    expect(store.useApp.getState().characters[0]!.level).toBe(2);
  });

  it('keeps mine by changing nothing at all', async () => {
    const local = SEPTEMBER(makeCharacter({ name: 'Ilya', level: 5 }));
    seed(local);
    const report = await store
      .useApp.getState()
      .importCharacters([AUGUST({ ...local, level: 2 })]);

    const result = await store.useApp.getState().resolveImport(report.conflicts[0]!, 'keep-mine');

    expect(result).toBeNull();
    expect(store.useApp.getState().characters).toHaveLength(1);
    expect(store.useApp.getState().characters[0]!.level).toBe(5);
  });

  it('keeps both under a new id and a name that can be told apart', async () => {
    const local = SEPTEMBER(makeCharacter({ name: 'Ilya', level: 5 }));
    seed(local);
    const report = await store
      .useApp.getState()
      .importCharacters([AUGUST({ ...local, level: 2 })]);

    await store.useApp.getState().resolveImport(report.conflicts[0]!, 'keep-both');

    const names = store.useApp.getState().characters.map((c) => c.name).sort();
    expect(names).toEqual(['Ilya', 'Ilya (imported)']);
    const ids = new Set(store.useApp.getState().characters.map((c) => c.id));
    expect(ids.size).toBe(2);
  });

  it('syncs the counters, which every other write path has always done', async () => {
    // A sheet from a device whose engine derived a bigger track. The stored
    // maximum and the derived one disagreeing is what `validatePlan` reads,
    // one advancement early.
    const arriving = {
      ...makeCharacter({ name: 'From elsewhere' }),
      hp: { marked: 9, max: 12 },
      armorSlots: { marked: 5, max: 9 },
      activeArmor: 'test-armor',
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    const stored = report.imported[0]!;

    expect(stored.hp.max).toBe(6);
    expect(stored.hp.marked).toBe(6);
    expect(stored.armorSlots.max).toBe(4);
    expect(stored.armorSlots.marked).toBe(4);
  });

  it('does not clamp against a fallback when it cannot resolve the class', async () => {
    // The scenario P0-7 itself describes: a class ref this build cannot name.
    // `deriveStats` would fall back to 6 HP, and clamping a 12 down to it
    // would destroy the number rather than reconcile it - and the ref may well
    // resolve after the next update, which is what P1-6 is about.
    const arriving = {
      ...makeCharacter({ name: 'From the future', classRef: '?60007' }),
      hp: { marked: 9, max: 12 },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.hp).toEqual({ marked: 9, max: 12 });
  });

  it('does not clamp the armour track against an armour it cannot resolve', async () => {
    const arriving = {
      ...makeCharacter({ name: 'Wearing something unknown', activeArmor: 'improved-chainmail' }),
      armorSlots: { marked: 2, max: 6 },
    };
    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.armorSlots).toEqual({ marked: 2, max: 6 });
  });

  it('carries the file layer’s warnings through to the caller', async () => {
    const report = await store
      .useApp.getState()
      .importCharacters([makeCharacter({ name: 'A' })], { warnings: ['said something'] });
    expect(report.warnings).toEqual(['said something']);
  });

  it('handles a mixed library in one pass', async () => {
    const mine = SEPTEMBER(makeCharacter({ name: 'Mine' }));
    const stale = at('2026-06-01T12:00:00.000Z')(makeCharacter({ name: 'Stale' }));
    store.useApp.setState({ characters: [mine, stale], activeId: mine.id });

    const report = await store.useApp.getState().importCharacters([
      AUGUST({ ...mine, level: 1 }),
      AUGUST({ ...stale, level: 9 }),
      makeCharacter({ name: 'Brand new' }),
    ]);

    expect(report.conflicts.map((c) => c.local.name)).toEqual(['Mine']);
    expect(report.replaced.map((c) => c.name)).toEqual(['Stale']);
    expect(report.imported.map((c) => c.name)).toEqual(['Brand new']);
  });
});
