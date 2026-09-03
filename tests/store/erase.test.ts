// @vitest-environment jsdom
/**
 * "Erase everything" has to survive the reload it ends with.
 *
 * Both debounced writers keep what failed so the next `pagehide` can try it
 * again: `state.ts` re-queues a refused character into `pending`, and
 * `gmStore.ts` leaves the board `dirty`. About's reset ran `clearAll()` and
 * then `location.reload()`, and the reload fires `pagehide` - so the flush ran
 * against the stores the reset had just emptied, succeeded, and put the record
 * back on a device the user was told was clean. For a campaign that record
 * holds other players' sheets.
 *
 * The failure planted here is the shipping one: a record stamped with a newer
 * schema than this build knows, which `putCharacter` and `putCampaign` both
 * refuse on purpose. It is also the state a user is likeliest to be in when
 * they reach for the reset.
 *
 * jsdom rather than node so that `window` exists and the `pagehide` listeners
 * both modules register are the thing dispatched, not a stand-in for them.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_SCHEMA_VERSION, type Campaign } from '../../shared/campaigns.ts';
import { SCHEMA_VERSION, type Character } from '../../shared/types.ts';
import { indexDataset } from '../../src/engine/character.ts';
import { makeCharacter, makeClass, makeDataset, makeSubclass } from '../fixtures/factories.ts';

const dataset = makeDataset({ classes: [makeClass()], subclasses: [makeSubclass()] });

type Store = typeof import('../../src/store/state.ts');
type Db = typeof import('../../src/store/db.ts');
type Gm = typeof import('../../src/ui/gm/gmStore.ts');

let store: Store;
let db: Db;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
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

/** The reload's own lifecycle event, which both writers answer with a flush. */
const pagehide = (): void => {
  window.dispatchEvent(new Event('pagehide'));
};

describe('a character whose write failed before the reset', () => {
  it('does not come back through the pagehide flush the reload fires', async () => {
    const c = makeCharacter({ name: 'Rook' });
    const database = await db.db();
    await database.put('characters', { ...c, schemaVersion: SCHEMA_VERSION + 1 } as unknown as Character);
    store.useApp.setState({ characters: [c], activeId: c.id });

    store.useApp.getState().update((x) => ({ ...x, name: 'Rook, edited' }));
    await store.flushPending();
    expect(store.useApp.getState().writeError?.kind, 'the precondition is a refused write').toBe(
      'stale',
    );

    await db.clearAll();
    expect(await database.count('characters')).toBe(0);

    pagehide();
    await store.flushPending();

    expect(
      await database.count('characters'),
      'the retry copy of the failed write was written back after the erase',
    ).toBe(0);
    expect(store.useApp.getState().writeError, 'nothing is unwritten any more').toBeNull();
  });
});

describe('a campaign whose write failed before the reset', () => {
  it('does not come back through the pagehide flush the reload fires', async () => {
    const gm: Gm = await import('../../src/ui/gm/gmStore.ts');
    await gm.hydrateGm();
    const campaign = await gm.useGm.getState().createCampaign('The Witherwild');
    const database = await db.db();
    // Another tab on a newer build got to the record first.
    await database.put('campaigns', {
      ...campaign,
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
    } as unknown as Campaign);

    gm.useGm.getState().setFear(3);
    await gm.flushGm();
    expect(gm.useGm.getState().writeRetry, 'the precondition is a refused write').toBe('write');

    await db.clearAll();
    expect(await database.count('campaigns')).toBe(0);

    pagehide();
    await gm.flushGm();

    expect(
      await database.count('campaigns'),
      'the dirty board was written back after the erase',
    ).toBe(0);
    expect(gm.useGm.getState().writeError, 'nothing is unwritten any more').toBeNull();
  });
});
