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
import { decideImport, duplicateFor, freeName } from '../../src/store/merge.ts';
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

  it('counts past a copy whose name differs only in case', () => {
    // The blind spot in the old comparison, on the door that already had a
    // guard. `new Set(taken.map((c) => c.name))` holds "ilya (imported)" and
    // is asked about "Ilya (imported)", so it said the name was free - and the
    // picker got two rows that read the same at 13px.
    const incoming = makeCharacter({ name: 'Ilya' });
    const taken = [incoming, { ...incoming, id: 'a-lower-case-copy', name: 'ilya (imported)' }];
    expect(duplicateFor(incoming, taken, now).name).toBe('Ilya (imported 2)');
  });

  it('builds the copy out of the name the app speaks, not the string it stored', () => {
    // A sheet arriving as "  Ilya  " used to become "  Ilya   (imported)":
    // identical on screen to "Ilya (imported)", different to every comparison
    // and every sort. Minting the name is this function's job, so it mints the
    // one the app can actually show.
    expect(duplicateFor(makeCharacter({ name: '  Ilya  ' }), [], now).name).toBe('Ilya (imported)');
  });
});

/**
 * The one rule about two characters with the same name.
 *
 * `merge.ts:63-75` stated this rule and argued for it - *"the character picker
 * in the header is a `<select>` of names, so two characters called 'Ilya' would
 * be indistinguishable at exactly the moment the user most needs to tell them
 * apart"* - and then enforced it on one of its two doors. The other door, a
 * person typing a name on the sheet, had no guard at all.
 *
 * And the comparison it did make was `new Set(taken.map((c) => c.name))`, which
 * cannot see "ilya", cannot see " Ilya", and cannot see two characters both
 * stored as `''` - all three of which the `<select>` draws identically. So the
 * rule is now one function with one definition of "the same name", and these
 * are tests of that definition rather than of either door.
 */
describe('the one rule about two characters with the same name', () => {
  it('offers the bare base when the base is free', () => {
    // The difference between the two sequences, and the reason the rename path
    // could not simply call `duplicateFor`: a person renaming a character wants
    // the nearest free name, and the bare one when it is free.
    expect(freeName('Ilya', [])).toBe('Ilya');
  });

  it('counts up past every name that is taken', () => {
    const taken = [makeCharacter({ name: 'Ilya' }), makeCharacter({ name: 'Ilya (2)' })];
    expect(freeName('Ilya', taken)).toBe('Ilya (3)');
  });

  it('counts up case-blind, so the offer is not itself a collision', () => {
    const taken = [makeCharacter({ name: 'ilya' }), makeCharacter({ name: 'ILYA (2)' })];
    expect(freeName('Ilya', taken)).toBe('Ilya (3)');
  });

  it('reads leading and trailing space as no difference', () => {
    expect(freeName(' Ilya ', [makeCharacter({ name: 'Ilya' })])).toBe('Ilya (2)');
  });

  it('reads a doubled space as no difference, because HTML collapses it', () => {
    expect(freeName('Il  ya', [makeCharacter({ name: 'Il ya' })])).toBe('Il ya (2)');
  });

  it('reads an empty name as the word every screen prints for it', () => {
    // P5-1(b)'s third bullet. Two characters stored as '' both draw "Unnamed",
    // and the old comparison saw two empty strings colliding with nothing.
    expect(freeName('', [])).toBe('Unnamed');
    expect(freeName('', [makeCharacter({ name: '' })])).toBe('Unnamed (2)');
    expect(freeName('   ', [makeCharacter({ name: 'Unnamed' })])).toBe('Unnamed (2)');
  });

  it('never offers the bare base to the import path', () => {
    // The copy's job is to be tellably different from the original, even when
    // the original is not in `taken` at all.
    expect(freeName('Ilya', [], { suffix: 'imported' })).toBe('Ilya (imported)');
  });

  it('leaves the character being renamed out of the count', () => {
    // Without this, opening rename and pressing SAVE unchanged would offer to
    // rename Ilya to "Ilya (2)".
    const c = makeCharacter({ name: 'Ilya' });
    expect(freeName('Ilya', [c], { except: c.id })).toBe('Ilya');
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

  /**
   * The clamp that runs on both branches, and why it is not the one above.
   *
   * `syncCounters` is skipped when a ref will not resolve, because the maximum
   * it would clamp against is a fallback - six Hit Points for a class this
   * build cannot name - and clamping a real seven against a guess destroys it.
   * The rules' own ceilings are not a guess and cannot become one: twelve is
   * the top of the advancement table, so no update and no layer can ever make
   * the number thrown away here turn out to have been right.
   *
   * It matters most on exactly the branch P0-7 leaves alone. A `.dhchar` naming
   * a class from a book this build has never seen is the *normal* way to get an
   * unclamped sheet into the store, so before this the shortest path to a
   * million-pip track was also the most ordinary one.
   */
  it('holds a maximum inside the rules ceiling even when it cannot resolve the class', async () => {
    const arriving = {
      ...makeCharacter({ name: 'From the future', classRef: '?60007' }),
      hp: { marked: 3, max: 1_048_576 },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.hp).toEqual({ marked: 3, max: 12 });
  });

  it('still keeps a number between the fallback and the ceiling, which is the P0-7 rule', async () => {
    // 11 is above the six `deriveStats` would fall back to and below the twelve
    // the rules allow. Surviving is the whole point: the class may well resolve
    // after the next update, and then this really is an eleven-box track.
    const arriving = {
      ...makeCharacter({ name: 'From the future', classRef: '?60007' }),
      hp: { marked: 9, max: 11 },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.hp).toEqual({ marked: 9, max: 11 });
  });

  it('bounds Hope at six, which is a different ceiling from HP’s twelve', async () => {
    const arriving = {
      ...makeCharacter({ name: 'Hopeful', classRef: '?60007' }),
      hope: { marked: 900, max: 900 },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.hope).toEqual({ marked: 6, max: 6 });
  });

  it('bounds the companion’s Stress, which syncCounters has never touched', async () => {
    // The one track that reached the screen unclamped even on the happy path:
    // the class resolves, the armour resolves, `syncCounters` runs - and it
    // writes four keys, none of them the companion's.
    const arriving = {
      ...makeCharacter({ name: 'Beastbound' }),
      companion: {
        name: 'Ash',
        description: 'A one-eyed raven',
        evasion: 12,
        stress: { marked: 0, max: 1_048_576 },
        damage: 'd6',
        range: 'Melee' as const,
        experiences: [],
        upgrades: [],
      },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.companion?.stress).toEqual({ marked: 0, max: 12 });
    // And nothing else about the companion was rewritten on the way past.
    expect(report.imported[0]!.companion?.name).toBe('Ash');
  });

  it('leaves no more marked than there are boxes to mark', async () => {
    const arriving = {
      ...makeCharacter({ name: 'Overmarked', classRef: '?60007' }),
      stress: { marked: 40, max: 6 },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.stress).toEqual({ marked: 6, max: 6 });
  });

  it('reads a maximum that is not a number as none rather than as the ceiling', async () => {
    // JSON.parse produces no NaN, but a hand-edited file and a half-written
    // backup both can, and `Math.min(12, NaN)` is NaN - which renders as an
    // empty track that silently refuses every tap.
    const arriving = {
      ...makeCharacter({ name: 'Damaged', classRef: '?60007' }),
      armorSlots: { marked: Number.NaN, max: Number.POSITIVE_INFINITY },
    };

    const report = await store.useApp.getState().importCharacters([arriving]);
    expect(report.imported[0]!.armorSlots).toEqual({ marked: 0, max: 0 });
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
