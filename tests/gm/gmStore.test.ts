/**
 * The GM store, now that it writes campaigns instead of one localStorage key.
 *
 * Nothing had ever tested this file. It held the live fight, the Fear pool,
 * every countdown and whole copies of the players' character sheets, and the
 * only thing standing between all of that and a lost evening was a synchronous
 * `localStorage.setItem` inside a `try` with an empty `catch`.
 *
 * Three properties are worth more than the rest here, and each one is a way
 * the move could have made things quietly worse rather than better:
 *
 *   1. the fight survives a reload, which is the one promise this file has
 *      always made and the one a debounce could have broken;
 *   2. switching campaign never touches the other campaign, and never touches
 *      a character - a sheet on two boards is two sightings, not one shared
 *      record;
 *   3. a write that failed is *said*, not swallowed. The old code caught
 *      `QuotaExceededError` and carried on with a comment.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import type { Adversary, Character } from '../../shared/types.ts';

type Gm = typeof import('../../src/ui/gm/gmStore.ts');
type Store = typeof import('../../src/store/campaigns.ts');

let gm: Gm;
let store: Store;

/**
 * A localStorage, because neither the node environment nor the jsdom this repo
 * pins provides one - and the migration this store runs on the way in is
 * defined entirely in terms of it.
 */
function installStorage(): Map<string, string> {
  const keys = new Map<string, string>();
  const storage = {
    get length() {
      return keys.size;
    },
    key: (i: number) => [...keys.keys()][i] ?? null,
    getItem: (k: string) => keys.get(k) ?? null,
    setItem: (k: string, v: string) => {
      keys.set(k, v);
    },
    removeItem: (k: string) => {
      keys.delete(k);
    },
    clear: () => {
      keys.clear();
    },
  };
  globalThis.localStorage = storage as unknown as Storage;
  return keys;
}

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  installStorage();
  vi.resetModules();
  store = await import('../../src/store/campaigns.ts');
  gm = await import('../../src/ui/gm/gmStore.ts');
  // The module starts hydrating the moment it is imported, the way it does
  // when the lazy GM chunk arrives. Every test starts from a settled store.
  await gm.hydrateGm();
});

const sheet = (id: string, name: string): Character =>
  ({
    id,
    schemaVersion: 3,
    name,
    hp: { marked: 0, max: 6 },
    stress: { marked: 0, max: 6 },
    hope: { marked: 2, max: 6 },
    armorSlots: { marked: 0, max: 3 },
  }) as unknown as Character;

const adversary = {
  id: 'acid-burrower',
  name: 'Acid Burrower',
  role: 'Standard',
  hp: 8,
  stress: 3,
  thresholds: [8, 15] as [number, number],
  difficulty: 14,
} as unknown as Adversary;

describe('hydration', () => {
  it('gives a device with nothing on it exactly one campaign', async () => {
    const s = gm.useGm.getState();
    expect(s.hydrated).toBe(true);
    expect(s.campaigns).toHaveLength(1);
    expect(s.activeCampaignId).toBe(s.campaigns[0]!.id);
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });

  it('runs the localStorage move on the way in', async () => {
    localStorage.setItem(
      'dhc.gm.v1',
      JSON.stringify({ fear: 5, countdowns: [], party: [], combatants: [] }),
    );
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    const fresh = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await fresh.hydrateGm();

    expect(fresh.useGm.getState().fear).toBe(5);
    expect(localStorage.getItem('dhc.gm.v1')).toBeNull();
  });

  it('joins an already-running hydration rather than doing it twice', async () => {
    await Promise.all([gm.hydrateGm(), gm.hydrateGm(), gm.hydrateGm()]);
    expect(gm.useGm.getState().campaigns).toHaveLength(1);
  });
});

describe('the fight survives a reload, which is the promise this file has always made', () => {
  it('writes the board and reads it back into the same numbers', async () => {
    const s = gm.useGm.getState();
    s.setFear(7);
    s.setEnvironment('raging-river');
    s.setPartyTier(3);
    s.spawn(adversary, 4);
    s.patchCombatant('acid-burrower-0', { spotlighted: true, notes: 'far bank' });
    s.addCountdown('The ice gives way', 'standard', 6);
    await gm.flushGm();

    // A reload: a new module, a new store object, the same database.
    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    const after = reloaded.useGm.getState();

    expect(after.fear).toBe(7);
    expect(after.environmentRef).toBe('raging-river');
    expect(after.partyTier).toBe(3);
    expect(after.combatants[0]?.spotlighted).toBe(true);
    expect(after.combatants[0]?.notes).toBe('far bank');
    expect(after.countdowns.map((c) => c.name)).toEqual(['The ice gives way']);
  });

  it('does not write inside the tap, nor in the turn after it', async () => {
    // The whole reason for the move. The old store did a synchronous
    // `JSON.stringify` of the entire board - party sheets included - inside
    // the tap handler that changed one number.
    const spy = vi.spyOn(store, 'putCampaign');
    gm.useGm.getState().nudgeFear(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).not.toHaveBeenCalled();
    await gm.flushGm();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst of taps into one write', async () => {
    const spy = vi.spyOn(store, 'putCampaign');
    const s = gm.useGm.getState();
    for (let i = 0; i < 8; i += 1) s.nudgeFear(1);
    await gm.flushGm();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(gm.useGm.getState().fear).toBe(8);
  });
});

describe('countdowns are rows of the session list', () => {
  it('puts a new countdown into the list and into the derived array', () => {
    gm.useGm.getState().addCountdown('Reinforcements', 'loop', 3);
    const s = gm.useGm.getState();
    expect(s.session.map((i) => i.kind)).toEqual(['countdown']);
    expect(s.countdowns.map((c) => c.name)).toEqual(['Reinforcements']);
  });

  it('keeps the two in step through every countdown action', () => {
    const s = () => gm.useGm.getState();
    s().addCountdown('A', 'standard', 4);
    const id = s().countdowns[0]!.id;

    s().advanceCountdown(id, -1);
    expect(s().countdowns[0]!.value).toBe(3);
    expect(
      s().session.flatMap((i) => (i.kind === 'countdown' ? [i.countdown.value] : [])),
    ).toEqual([3]);

    s().resetCountdown(id);
    expect(s().countdowns[0]!.value).toBe(4);

    s().removeCountdown(id);
    expect(s().countdowns).toEqual([]);
    expect(s().session).toEqual([]);
  });

  it('marks one primary and only one', () => {
    const s = () => gm.useGm.getState();
    s().addCountdown('A', 'standard', 4);
    s().addCountdown('B', 'standard', 4);
    const [a, b] = s().session;

    s().setPrimaryCountdown(a!.id);
    s().setPrimaryCountdown(b!.id);

    const primary = s().session.filter((i) => i.kind === 'countdown' && i.primary);
    expect(primary.map((i) => i.name)).toEqual(['B']);
  });

  it('survives a reload with the primary flag still on the same row', async () => {
    gm.useGm.getState().addCountdown('A', 'standard', 4);
    gm.useGm.getState().addCountdown('B', 'standard', 4);
    gm.useGm.getState().setPrimaryCountdown(gm.useGm.getState().session[1]!.id);
    await gm.flushGm();

    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    const kept = reloaded.useGm
      .getState()
      .session.filter((i) => i.kind === 'countdown' && i.primary);
    expect(kept.map((i) => i.name)).toEqual(['B']);
  });
});

describe('the session list', () => {
  const scene = (id: string, name: string) =>
    ({ id, kind: 'scene', name, order: 0, collapsed: false, environmentRef: null }) as const;

  it('numbers the items as they are added', () => {
    const s = () => gm.useGm.getState();
    s().addSessionItem(scene('a', 'A'));
    s().addSessionItem(scene('b', 'B'));
    expect(s().session.map((i) => [i.id, i.order])).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('re-numbers after a removal, so the order never has a hole in it', () => {
    const s = () => gm.useGm.getState();
    s().addSessionItem(scene('a', 'A'));
    s().addSessionItem(scene('b', 'B'));
    s().addSessionItem(scene('c', 'C'));
    s().removeSessionItem('b');
    expect(s().session.map((i) => [i.id, i.order])).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
  });

  it('moves a row without losing the others', () => {
    const s = () => gm.useGm.getState();
    for (const id of ['a', 'b', 'c']) s().addSessionItem(scene(id, id.toUpperCase()));
    s().moveSessionItem('c', 0);
    expect(s().session.map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(s().session.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('will not turn one kind of row into another by patching it', () => {
    // A `scene` that became an `encounter` would carry the fields of the thing
    // it stopped being, and every screen reading the union would be wrong.
    const s = () => gm.useGm.getState();
    s().addSessionItem(scene('a', 'A'));
    s().patchSessionItem('a', { kind: 'encounter' } as never);
    expect(s().session[0]!.kind).toBe('scene');
  });

  it('renames a row', () => {
    const s = () => gm.useGm.getState();
    s().addSessionItem(scene('a', 'A'));
    s().patchSessionItem('a', { name: 'The frozen ford' });
    expect(s().session[0]!.name).toBe('The frozen ford');
  });
});

describe('more than one campaign', () => {
  it('keeps each one’s board to itself', async () => {
    const s = () => gm.useGm.getState();
    s().setFear(9);
    s().spawn(adversary, 4);

    const second = await s().createCampaign('Ashes of Rivermarch');
    expect(s().fear).toBe(0);
    expect(s().combatants).toEqual([]);
    expect(s().activeCampaignId).toBe(second.id);

    s().setFear(2);
    await gm.flushGm();

    const first = s().campaigns.find((c) => c.id !== second.id)!;
    await s().switchCampaign(first.id);
    expect(s().fear).toBe(9);
    expect(s().combatants).toHaveLength(1);

    await s().switchCampaign(second.id);
    expect(s().fear).toBe(2);
    expect(s().combatants).toEqual([]);
  });

  it('lands the campaign being left before the switch, not after', async () => {
    // The debounce is 400 ms and a switch is instant. Without the flush, the
    // pending write would arrive during the next campaign's turn and the GM
    // would watch the old board reappear on top of the new one.
    const s = () => gm.useGm.getState();
    const first = s().activeCampaignId!;
    s().setFear(6);

    const second = await s().createCampaign('Second');
    await s().switchCampaign(first);

    expect(s().fear).toBe(6);
    const onDisk = (await store.readCampaigns()).campaigns;
    expect(onDisk.find((c) => c.id === first)!.fear).toBe(6);
    expect(onDisk.find((c) => c.id === second.id)!.fear).toBe(0);
  });

  it('does nothing when asked to switch to a campaign that is not here', async () => {
    const s = () => gm.useGm.getState();
    s().setFear(4);
    await s().switchCampaign('nobody');
    expect(s().fear).toBe(4);
    expect(s().activeCampaignId).not.toBe('nobody');
  });

  it('renames one without touching the board', () => {
    const s = () => gm.useGm.getState();
    s().setFear(3);
    s().renameCampaign(s().activeCampaignId!, '  The Sablewood Winter  ');
    expect(s().campaigns[0]!.name).toBe('The Sablewood Winter');
    expect(s().fear).toBe(3);
  });

  it('deletes one and moves to another, leaving the survivor intact', async () => {
    const s = () => gm.useGm.getState();
    s().setFear(9);
    await gm.flushGm();
    const first = s().activeCampaignId!;

    const second = await s().createCampaign('Second');
    await s().removeCampaign(second.id);

    expect(s().campaigns.map((c) => c.id)).toEqual([first]);
    expect(s().activeCampaignId).toBe(first);
    expect(s().fear).toBe(9);
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });

  it('never leaves the GM with no table at all', async () => {
    const s = () => gm.useGm.getState();
    await s().removeCampaign(s().activeCampaignId!);
    expect(s().campaigns).toHaveLength(1);
    expect(s().activeCampaignId).toBe(s().campaigns[0]!.id);
    expect((await store.readCampaigns()).campaigns).toHaveLength(1);
  });

  it('does not let a debounced write bring a deleted campaign back', async () => {
    // `state.remove` learned this: a pending write still holding the record
    // puts it straight back a few hundred milliseconds later.
    const s = () => gm.useGm.getState();
    const doomed = await s().createCampaign('Doomed');
    s().setFear(5);
    await s().removeCampaign(doomed.id);
    await gm.flushGm();

    expect((await store.readCampaigns()).campaigns.map((c) => c.name)).not.toContain('Doomed');
  });
});

describe('the party board, which holds other people’s sheets', () => {
  it('goes into the campaign, and comes back out of it', async () => {
    const s = () => gm.useGm.getState();
    const summary = s().importParty([sheet('pc-1', 'Ilya of the Ninth')], 'file');
    expect(summary.added).toEqual(['Ilya of the Ninth']);
    await gm.flushGm();

    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    expect(reloaded.useGm.getState().party.map((m) => m.sheet.name)).toEqual([
      'Ilya of the Ninth',
    ]);
  });

  it('lets the same sheet sit on two boards without either one moving', async () => {
    // The whole reason a campaign does not own characters. Two campaigns, one
    // player, two independent tallies of how hurt they are.
    const s = () => gm.useGm.getState();
    s().importParty([sheet('pc-1', 'Ilya')], 'file');
    s().markPartyTracks('pc-1', { hp: 4 });

    const second = await s().createCampaign('Second');
    s().importParty([sheet('pc-1', 'Ilya')], 'file');
    s().markPartyTracks('pc-1', { hp: 1 });
    await gm.flushGm();

    const first = s().campaigns.find((c) => c.id !== second.id)!;
    await s().switchCampaign(first.id);
    expect(s().party[0]!.tracks.hp).toBe(4);
    await s().switchCampaign(second.id);
    expect(s().party[0]!.tracks.hp).toBe(1);
  });

  it('never writes anything into the characters store', async () => {
    const db = await import('../../src/store/db.ts');
    const s = () => gm.useGm.getState();
    s().importParty([sheet('pc-1', 'Ilya')], 'file');
    s().markPartyTracks('pc-1', { hp: 4 });
    await gm.flushGm();
    expect(await (await db.db()).count('characters')).toBe(0);
  });
});

describe('a write that did not happen', () => {
  it('says so instead of swallowing it', async () => {
    // The line this replaces was `catch { /* Private mode or quota. */ }`.
    const spy = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));

    gm.useGm.getState().setFear(4);
    await gm.flushGm();

    expect(gm.useGm.getState().writeError).toMatch(/quota has been exceeded/);
    expect(gm.useGm.getState().writeError).toMatch(/only in this tab/);
    spy.mockRestore();
  });

  it('tries again on the next flush rather than giving up on the evening', async () => {
    const spy = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValueOnce(new Error('nope'));

    gm.useGm.getState().setFear(4);
    await gm.flushGm();
    expect(gm.useGm.getState().writeError).not.toBeNull();

    await gm.flushGm();
    expect(gm.useGm.getState().writeError).toBeNull();
    expect((await store.readCampaigns()).campaigns[0]!.fear).toBe(4);
    spy.mockRestore();
  });
});
