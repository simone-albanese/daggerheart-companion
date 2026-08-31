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
import type { Campaign, SessionItem } from '../../shared/campaigns.ts';
import { COUNTDOWN_BEATS_MAX, COUNTDOWN_TEXT_MAX } from '../../shared/campaigns.ts';
import type { Adversary, Character } from '../../shared/types.ts';
import { NO_FIGHT, combatant, sceneWith } from '../fixtures/factories.ts';
import { newCharacter } from '../../src/engine/character.ts';

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

/*
 * A whole sheet, and it has to be one.
 *
 * This used to be the four tracks and a name, which is all `importParty` and
 * `markPartyTracks` read - but the round trip below goes through
 * `readPartyMember`, and since it started refusing a sheet the party board
 * could not draw, the four tracks are no longer a character. `newCharacter`
 * supplies the rest, and the tracks stay overridden because two of the tests
 * here read the numbers back.
 */
const sheet = (id: string, name: string): Character => ({
  ...newCharacter({ name }),
  id,
  hp: { marked: 0, max: 6 },
  stress: { marked: 0, max: 6 },
  hope: { marked: 2, max: 6 },
  armorSlots: { marked: 0, max: 3 },
});

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

  it('lets the disk win a race against the GM’s hand, and says so out loud', async () => {
    /*
     * The window is small - this module is imported as the GM chunk loads, so
     * hydration is running before the screen has painted - but small is not a
     * guarantee, and the store's answer to it is the right one: adopting the
     * live state would write an empty board over a real campaign, and merging
     * the two would invent a state that was never true.
     *
     * What was missing is the other half. The sentence went into `notices`,
     * which only MENU draws, so a Fear tap made during the read was reverted
     * with nothing on the screen to say why. `replacedOnLoad` is the flag
     * `Gm.tsx` puts under the top bar.
     */
    gm.useGm.getState().setFear(5);
    await gm.flushGm();

    vi.resetModules();
    const freshStore = await import('../../src/store/campaigns.ts');
    // The read is held open, so "the GM was faster than the disk" is a fact of
    // this test rather than a race it hopes to win.
    let release = (): void => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realRead = freshStore.readCampaigns;
    const spy = vi.spyOn(freshStore, 'readCampaigns').mockImplementation(async () => {
      await held;
      return realRead();
    });

    const freshGm = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    freshGm.useGm.getState().nudgeFear(1);
    expect(freshGm.useGm.getState().fear, 'the tap never landed on screen').toBe(1);

    release();
    await freshGm.hydrateGm();

    expect(freshGm.useGm.getState().fear).toBe(5);
    expect(freshGm.useGm.getState().notices).toContain(freshGm.REPLACED_ON_LOAD);
    expect(
      freshGm.useGm.getState().replacedOnLoad,
      'the tap was reverted with nothing on the screen to say so',
    ).toBe(true);
    spy.mockRestore();
  });
});

describe('the fight survives a reload, which is the promise this file has always made', () => {
  it('writes the row the fight is on and reads it back into the same numbers', async () => {
    const s = gm.useGm.getState();
    s.setFear(7);
    s.setEnvironment('raging-river');
    s.setPartyTier(3);
    const dungeon = s.openNewScene('The dungeon');
    s.spawn(dungeon, adversary, 4);
    s.patchCombatant(dungeon, 'acid-burrower-0', { spotlighted: true, notes: 'far bank' });
    s.addCountdown('The ice gives way', 'standard', 6);
    await gm.flushGm();

    // A reload: a new module, a new store object, the same database.
    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    const after = reloaded.useGm.getState();

    expect(after.fear).toBe(7);
    // The BOARD's environment, which is the builder's workbench and is still
    // the board's. The runner's place is the open row's, asserted below.
    expect(after.environmentRef).toBe('raging-river');
    expect(after.partyTier).toBe(3);
    expect(after.openScene).toBe(dungeon);
    expect(gm.openCombatants(after)[0]?.spotlighted).toBe(true);
    expect(gm.openCombatants(after)[0]?.notes).toBe('far bank');
    expect(after.countdowns.map((c) => c.name)).toEqual(['The ice gives way']);
  });

  it('brings back two fights and the pointer that says which one is on the glass', async () => {
    /*
     * The promise the schema bump exists to make, and the one a single board
     * could not make at all. Under schema 4 the second fight did not survive
     * being left - it was parked into its row as a copy and the board carried
     * only one - so "both fights, both sets of marks, after a reload" is a
     * sentence that had no state to be true of.
     */
    const s = gm.useGm.getState();
    const foresta = s.openNewScene('Foresta');
    s.spawn(foresta, adversary, 4, 2);
    s.patchCombatant(foresta, 'acid-burrower-1', { hp: { max: 8, marked: 5 } });
    const pub = s.openNewScene('Pub');
    s.spawn(pub, adversary, 4, 1);
    s.patchCombatant(pub, 'acid-burrower-0', { stress: { max: 3, marked: 2 } });
    s.showScene(foresta);
    await gm.flushGm();

    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    const after = reloaded.useGm.getState();

    const held = (id: string): number => {
      const row = after.session.find((i) => i.id === id);
      return row?.kind === 'scene' ? row.combatants.length : -1;
    };
    expect(held(foresta)).toBe(2);
    expect(held(pub)).toBe(1);
    expect(after.openScene).toBe(foresta);
    expect(reloaded.openCombatants(after)[1]?.hp.marked).toBe(5);
    const other = after.session.find((i) => i.id === pub);
    expect(other?.kind === 'scene' && other.combatants[0]?.stress.marked).toBe(2);
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

/**
 * The first writer `Countdown.beats` has ever had.
 *
 * The field has been persisted, read by `readCountdown` and seeded by
 * `addCountdown` since schema 3, and nothing in the app drew or wrote one. What
 * these hold is the two ends agreeing: the writer's bounds are the reader's
 * own, so a sentence that goes in is the sentence that comes back out after a
 * reload rather than a shorter one.
 */
describe('the sentence a long-term tick is for', () => {
  const s = () => gm.useGm.getState();
  const beatsOf = (): string[] => s().countdowns[0]!.beats;

  it('writes one beat at its own index, and pads what is not written yet', () => {
    s().addCountdown('The winter', 'long-term', 6);
    const id = s().countdowns[0]!.id;

    s().writeCountdownBeat(id, 0, 'The frost reaches the outer farms.');
    expect(beatsOf()).toEqual(['The frost reaches the outer farms.']);

    // A GM who writes tick four before tick two has not made a mistake: the
    // array is sparse in practice and `readCountdown` says so.
    s().writeCountdownBeat(id, 3, 'The river stops.');
    expect(beatsOf()).toEqual(['The frost reaches the outer farms.', '', '', 'The river stops.']);
  });

  it('replaces the beat that is already at that index', () => {
    s().addCountdown('The winter', 'long-term', 6);
    const id = s().countdowns[0]!.id;
    s().writeCountdownBeat(id, 0, 'first');
    s().writeCountdownBeat(id, 0, 'second');
    expect(beatsOf()).toEqual(['second']);
  });

  it('bounds the text where the reader bounds it, so nothing comes back cut', () => {
    s().addCountdown('The winter', 'long-term', 6);
    const id = s().countdowns[0]!.id;
    s().writeCountdownBeat(id, 0, 'x'.repeat(COUNTDOWN_TEXT_MAX + 500));
    expect(beatsOf()[0]!.length).toBe(COUNTDOWN_TEXT_MAX);
  });

  it('refuses an index that is not one, rather than growing an array to reach it', () => {
    s().addCountdown('The winter', 'long-term', 6);
    const id = s().countdowns[0]!.id;
    for (const bad of [-1, COUNTDOWN_BEATS_MAX, Number.NaN, Number.POSITIVE_INFINITY]) {
      s().writeCountdownBeat(id, bad, 'nowhere');
    }
    expect(beatsOf()).toEqual([]);
  });

  it('survives a reload with the beat on the same tick', async () => {
    s().addCountdown('The winter', 'long-term', 6);
    const id = s().countdowns[0]!.id;
    s().advanceCountdown(id, -1);
    s().writeCountdownBeat(id, 0, 'The frost reaches the outer farms.');
    await gm.flushGm();

    vi.resetModules();
    const reloaded = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    await reloaded.hydrateGm();
    const clock = reloaded.useGm.getState().countdowns[0]!;
    expect(clock.value).toBe(5);
    expect(clock.beats).toEqual(['The frost reaches the outer farms.']);
  });
});

describe('the session list', () => {
  const scene = (id: string, name: string) =>
    ({ id, kind: 'scene', name, order: 0, collapsed: false, environmentRef: null, ...NO_FIGHT }) as const;

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

  it('will not write a fight through a general row patch, on either arm that has one', () => {
    /*
     * The same argument as the kind above, one field along. `withSceneFight`
     * is the one writer of a row's combatants and the runner holds that array
     * by reference, so a caller reaching a fight through the general patcher
     * is how a marked array - or another row's - ends up on a row.
     *
     * BOTH ARMS, because two of them carry a fight: `scene`, and the legacy
     * `encounter` that `SESSION_ITEM_KINDS` no longer lets anybody make. The
     * store's guard is written `'combatants' in item` rather than against the
     * kind, and the encounter row is the sharper half of the two - there is no
     * verb anywhere that could put its marks back.
     *
     * The patch is not refused, it is stripped: the ordinary half of it lands.
     */
    const s = () => gm.useGm.getState();
    const body = combatant('acid-burrower-0');
    s().addSessionItem(sceneWith('a', [body], { name: 'A' }));
    s().addSessionItem({
      id: 'b',
      kind: 'encounter',
      name: 'B',
      order: 1,
      collapsed: false,
      roster: [],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [body],
    });

    for (const id of ['a', 'b']) {
      s().patchSessionItem(id, { combatants: [], name: 'Renamed' } as Partial<SessionItem>);
      const row = s().session.find((i) => i.id === id)!;
      expect(row.kind !== 'link' && 'combatants' in row && row.combatants, id).toHaveLength(1);
      expect(row.name, id).toBe('Renamed');
    }
  });
});

describe('more than one campaign', () => {
  it('keeps each one’s fight to itself', async () => {
    const s = () => gm.useGm.getState();
    s().setFear(9);
    const dungeon = s().openNewScene('The dungeon');
    s().spawn(dungeon, adversary, 4);

    const second = await s().createCampaign('Ashes of Rivermarch');
    expect(s().fear).toBe(0);
    // A new campaign has no plan, so it has nowhere a fight could be: the
    // pointer is null and the selector answers for it rather than throwing.
    expect(s().session).toEqual([]);
    expect(s().openScene).toBeNull();
    expect(gm.openCombatants(s())).toEqual([]);
    expect(s().activeCampaignId).toBe(second.id);

    s().setFear(2);
    await gm.flushGm();

    const first = s().campaigns.find((c) => c.id !== second.id)!;
    await s().switchCampaign(first.id);
    expect(s().fear).toBe(9);
    expect(s().openScene).toBe(dungeon);
    expect(gm.openCombatants(s())).toHaveLength(1);

    await s().switchCampaign(second.id);
    expect(s().fear).toBe(2);
    expect(gm.openCombatants(s())).toEqual([]);
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

/*
 * The defect `switchCampaign`'s docblock used to name, now that it is closed.
 *
 * Both doors that replace the live board with another campaign's `await
 * flushGm()` first, and a flush proves only that the write was *attempted*:
 * `writeActive` catches its own rejection, assigns `state.campaigns` only
 * inside the `try`, and leaves the store dirty. So on the evening
 * `putCampaign` is rejecting - a full disk, an older build refusing a newer
 * record - the flush changed nothing and the `spread` that followed discarded
 * the evening, with `state.campaigns` still holding the record from before the
 * edit and nothing on the glass saying so.
 *
 * TWO TESTS BECAUSE THERE ARE TWO DOORS, and the fix is one step both call. A
 * repair of `switchCampaign` alone would close MENU's campaign row and BRING
 * IT IN and leave NEW CAMPAIGN open, which is the half-fix that docblock
 * existed to refuse - so a mutant that deletes one of the two calls has to be
 * caught, and only a test per door catches it.
 *
 * Each one reads the edit back twice: out of `state.campaigns`, which is where
 * it was being lost, and off the disk once writes work again, which is the
 * half `scheduleAside` is doing. Asserting only the first would pass a fold
 * that kept the board in memory and queued nothing - a record that is one
 * reload from gone.
 */
describe('a campaign being left while writes are failing', () => {
  it('keeps the unlanded board when the GM switches to another campaign', async () => {
    const s = () => gm.useGm.getState();
    const first = s().activeCampaignId!;
    const second = await s().createCampaign('Ashes of Rivermarch');
    await s().switchCampaign(first);
    s().setFear(3);
    await gm.flushGm();

    const put = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    s().setFear(11);
    await gm.flushGm();
    // The flush resolved and landed nothing. This is the evening the repair is
    // for, and without this line the test could pass on a store that is simply
    // writing normally.
    expect(s().writeError).not.toBeNull();
    expect((await store.readCampaigns()).campaigns.find((c) => c.id === first)!.fear).toBe(3);

    await s().switchCampaign(second.id);

    expect(s().activeCampaignId).toBe(second.id);
    expect(s().campaigns.find((c) => c.id === first)!.fear).toBe(11);

    put.mockRestore();
    await gm.flushGm();
    expect((await store.readCampaigns()).campaigns.find((c) => c.id === first)!.fear).toBe(11);
  });

  it('keeps it through NEW CAMPAIGN, which carried the identical line', async () => {
    const s = () => gm.useGm.getState();
    const first = s().activeCampaignId!;
    s().setFear(3);
    await gm.flushGm();

    const put = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    s().setFear(11);
    await gm.flushGm();
    expect(s().writeError).not.toBeNull();

    const made = await s().createCampaign('Ashes of Rivermarch');

    expect(s().activeCampaignId).toBe(made.id);
    expect(s().campaigns.find((c) => c.id === first)!.fear).toBe(11);

    /*
     * Both records are still owed to the disk here, and the two halves of that
     * are owed for different reasons: the campaign being left through `aside`,
     * because the fold cleared `dirty` and handed the promise over; the new
     * campaign through `dirty` itself, which `createCampaign` sets again
     * because its own `putCampaign` threw. A fold that cleared `dirty` and
     * stopped there would lose the second one.
     */
    put.mockRestore();
    await gm.flushGm();
    const onDisk = (await store.readCampaigns()).campaigns;
    expect(onDisk.find((c) => c.id === first)!.fear).toBe(11);
    expect(onDisk.map((c) => c.name)).toContain('Ashes of Rivermarch');
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

describe('exporting the open campaign', () => {
  it('writes what is on the screen, not what the debounce last wrote', async () => {
    // The debounce is 400 ms. An export that ran off the last written record
    // would hand the GM a file that is nearly the state they were in, which is
    // the kind of quiet wrongness this app exists not to have.
    const fileIo = await import('../../src/transfer/fileIo.ts');
    const campaignFile = await import('../../src/transfer/campaignFile.ts');
    const spy = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: true,
      route: 'download',
      fileName: 'x',
      cancelled: false,
      reason: null,
    });

    const s = gm.useGm.getState();
    s.renameCampaign(s.activeCampaignId!, 'The Sablewood Winter');
    s.setFear(7);
    await s.exportActiveCampaign();

    expect(spy).toHaveBeenCalledOnce();
    const [fileName, text] = spy.mock.calls[0]!;
    expect(fileName).toBe('the-sablewood-winter.dhcampaign');
    const back = campaignFile.parseCampaignFile(text);
    expect(back.campaign.fear).toBe(7);
    expect(back.campaign.name).toBe('The Sablewood Winter');
    spy.mockRestore();
  });

  it('writes the evening the failed write did not, rather than the record before it', async () => {
    /*
     * The one evening a hand-save is worth anything is the evening writes are
     * failing, and it was the one it got wrong. `writeActive` assigns
     * `state.campaigns` only inside its `try`, after `putCampaign` resolves, so
     * on a rejection the list still holds the record from before the failure and
     * the `flushGm` above re-enters the same rejecting write. An export off that
     * list serializes the stale record, verifies its checksum happily - it is a
     * perfectly valid `.dhcampaign` of the wrong campaign - and prints "Saved
     * as …" over an evening that exists nowhere. That is the fatal
     * `snapshotCampaigns` closed on the automatic leg, and it stayed open on
     * this one until the export read the same memory-first record.
     */
    const fileIo = await import('../../src/transfer/fileIo.ts');
    const campaignFile = await import('../../src/transfer/campaignFile.ts');
    const save = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: true,
      route: 'download',
      fileName: 'x',
      cancelled: false,
      reason: null,
    });

    const s = () => gm.useGm.getState();
    s().setFear(3);
    await gm.flushGm();
    expect((await store.readCampaigns()).campaigns[0]!.fear, 'the disk took the first one').toBe(3);

    const put = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    s().setFear(9);
    await gm.flushGm();
    expect(s().writeError).toMatch(/quota has been exceeded/);
    expect((await store.readCampaigns()).campaigns[0]!.fear, 'the disk is stale').toBe(3);

    expect((await s().exportActiveCampaign()).ok).toBe(true);
    const [, text] = save.mock.calls[0]!;
    expect(
      campaignFile.parseCampaignFile(text).campaign.fear,
      'the file holds the evening on the screen',
    ).toBe(9);
    // The same record the automatic leg would have written, to the byte.
    expect(campaignFile.parseCampaignFile(text).campaign.updatedAt).toBe(
      gm.snapshotCampaigns()!.campaigns[0]!.updatedAt,
    );

    put.mockRestore();
    save.mockRestore();
  });

  it('says there is nothing to export rather than writing an empty file', async () => {
    gm.useGm.setState({ activeCampaignId: null });
    const result = await gm.useGm.getState().exportActiveCampaign();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no campaign open/);
  });

  /**
   * A copy saved by hand is evidence a click happened, never that a file
   * exists: `saveTextFile` reads nothing back, and a `download` or a `share`
   * route ends at an operating system this app cannot ask.
   *
   * It is recorded anyway, because an iOS GM - where there is no folder picker
   * and so no automatic backup at all - who dutifully exports every week read
   * "no backup yet" for ever, and that trains them to ignore the one indicator
   * that matters. What it must not do is set the checksum that suppresses the
   * folder write: only `writeIntoDirectory`, which opens the file again and
   * compares it, has earned that.
   */
  it('records a copy saved by hand without letting it look like a backup', async () => {
    const fileIo = await import('../../src/transfer/fileIo.ts');
    const campaignFile = await import('../../src/transfer/campaignFile.ts');
    const spy = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: true,
      route: 'share',
      fileName: 'the-sablewood-winter.dhcampaign',
      cancelled: false,
      reason: null,
    });

    const s = gm.useGm.getState();
    s.renameCampaign(s.activeCampaignId!, 'The Sablewood Winter');
    const id = s.activeCampaignId!;
    expect(localStorage.getItem('dhc.backup.v1')).toBeNull();

    expect((await s.exportActiveCampaign()).ok).toBe(true);

    const note = (
      JSON.parse(localStorage.getItem('dhc.backup.v1')!) as {
        campaigns: Record<string, { lastCopyAt?: string; route?: string; checksum?: number }>;
      }
    ).campaigns[id]!;
    expect(note.route).toBe('share');
    expect(Date.parse(note.lastCopyAt!)).not.toBeNaN();
    expect(
      note.checksum,
      'a share sheet was recorded as a verified write, so the folder copy will be skipped',
    ).toBeUndefined();
    // And it is not the checksum by accident either: that is the number the
    // folder leg stores, and nothing here may have produced it.
    expect(Object.values(note)).not.toContain(
      campaignFile.campaignChecksum(gm.useGm.getState().campaigns.find((c) => c.id === id)!),
    );
    spy.mockRestore();
  });

  it('records nothing when the copy did not happen', async () => {
    const fileIo = await import('../../src/transfer/fileIo.ts');
    const spy = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: false,
      route: null,
      fileName: 'the-sablewood-winter.dhcampaign',
      cancelled: true,
      reason: null,
    });

    expect((await gm.useGm.getState().exportActiveCampaign()).ok).toBe(false);
    expect(localStorage.getItem('dhc.backup.v1')).toBeNull();
    spy.mockRestore();
  });
});

/**
 * What the automatic backup is written from, and why it cannot be the disk.
 *
 * `writeActive` updates `state.campaigns` only inside the `try` *after*
 * `putCampaign` resolves, and on a throw deliberately leaves the record dirty.
 * So on the evening writes are failing - a full disk, an older build refusing a
 * newer record, which is exactly the work about to be lost - a flush cannot
 * make the disk fresh, and a disk-sourced backup would write the stale record,
 * verify it happily and stamp "last backup: today" over an evening that exists
 * nowhere.
 */
describe('the snapshot the backup reads', () => {
  it('folds the live evening into the open campaign before it has been written', async () => {
    /*
     * The fight moved off the board and onto a row, so the leg this test
     * stands on moved with it: what has to be in the snapshot is the SESSION
     * list, not `board.combatants`, and a bare `spawn` no longer has anywhere
     * to go. The row is opened first, by the same verb the glass uses.
     *
     * The claim is unchanged and is the one the whole backup rests on: what is
     * in memory and not yet on the disk is what gets backed up.
     */
    const s = () => gm.useGm.getState();
    s().setFear(9);
    const dungeon = s().openNewScene('The dungeon');
    s().spawn(dungeon, adversary, 2);

    const snapshot = gm.snapshotCampaigns()!;
    expect(snapshot.campaigns).toHaveLength(1);
    expect(snapshot.campaigns[0]!.fear).toBe(9);
    expect(snapshot.campaigns[0]!.board.openScene).toBe(dungeon);
    const row = snapshot.campaigns[0]!.session.find((i) => i.id === dungeon);
    expect(row?.kind === 'scene' && row.combatants.map((c) => c.adversaryRef)).toEqual([
      'acid-burrower',
    ]);
    // The debounce is 400 ms and nothing has flushed, so the disk still holds
    // the campaign as it was created.
    expect((await store.readCampaigns()).campaigns[0]!.fear).toBe(0);

    await gm.flushGm();
    expect(gm.snapshotCampaigns()!.campaigns[0]!.fear).toBe(9);
    expect((await store.readCampaigns()).campaigns[0]!.fear).toBe(9);
  });

  it('still holds the evening after the write that should have saved it failed', async () => {
    const spy = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));

    const s = () => gm.useGm.getState();
    s().setFear(9);
    await gm.flushGm();
    expect(s().writeError).not.toBeNull();

    expect(gm.snapshotCampaigns()!.campaigns[0]!.fear).toBe(9);
    expect((await store.readCampaigns()).campaigns[0]!.fear).toBe(0);
    spy.mockRestore();
  });

  /**
   * `writeActive` stamps `new Date().toISOString()` at the moment the record
   * actually reaches the disk. Inventing a different time here would put a time
   * in the backup file that no write ever happened at - and it would also make
   * an `updatedAt` fingerprint look changed on every trigger, which is the
   * mirror image of the bug the content checksum exists to avoid.
   */
  it('does not invent a time no write ever happened at', async () => {
    const campaignFile = await import('../../src/transfer/campaignFile.ts');
    const s = () => gm.useGm.getState();
    await gm.flushGm();
    const before = (await store.readCampaigns()).campaigns[0]!.updatedAt;

    /*
     * An hour later, with the evening still unwritten. The clock has to be
     * moved for this assertion to have teeth at all: a snapshot that stamped
     * itself in the same millisecond as the write it followed would agree with
     * one that did not, and the test would pass over the bug.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(before) + 3_600_000));
    try {
      s().setFear(4);
      const first = gm.snapshotCampaigns()!.campaigns[0]!;
      s().setFear(5);
      const second = gm.snapshotCampaigns()!.campaigns[0]!;

      expect(first.updatedAt).toBe(before);
      expect(second.updatedAt).toBe(before);
      // Which is exactly why the backup's skip gate is the content and not this
      // field: the board moved between the two snapshots and the clock did not.
      expect(campaignFile.campaignChecksum(second)).not.toBe(
        campaignFile.campaignChecksum(first),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('names the campaigns this build must not touch beside the ones it can', async () => {
    await gm.flushGm();
    const held = [
      { id: 'held-1', name: 'The Sablewood Winter', schemaVersion: 99, reason: 'a newer build' },
    ];
    gm.useGm.setState({ quarantined: held });

    const snapshot = gm.snapshotCampaigns()!;
    expect(snapshot.quarantined).toEqual([{ id: 'held-1', name: 'The Sablewood Winter' }]);
    // The reason belongs to the screen that renders it, not to a file.
    expect(Object.keys(snapshot.quarantined[0]!).sort()).toEqual(['id', 'name']);
  });

  /**
   * Null is a third answer, and it has to be.
   *
   * `hydrateGm` sets `hydrated: true` on a read that *failed* as well as on one
   * that worked - so that the screen stops waiting and says what went wrong -
   * and leaves `campaigns` empty with `writeRetry: 'read'`. Handing that empty
   * list to the backup would read as "this device has no campaigns" and quietly
   * take every one of them out of the folder, on precisely the launch where the
   * storage is already misbehaving. Falling through to the disk can fail to
   * notice a campaign; it can never invent one.
   */
  it('says nothing at all rather than "no campaigns" when it has no answer', () => {
    gm.useGm.setState({ hydrated: false });
    expect(gm.snapshotCampaigns()).toBeNull();

    gm.useGm.setState({ hydrated: true, campaigns: [], writeRetry: 'read' });
    expect(gm.snapshotCampaigns()).toBeNull();

    // A *write* failure is the case the snapshot exists for: the disk is stale
    // and memory is the only copy of the evening. It must still answer.
    gm.useGm.setState({ writeRetry: 'write' });
    expect(gm.snapshotCampaigns()).not.toBeNull();
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

  it('leaves a campaign whose own write threw for the retry to write', async () => {
    /*
     * `createCampaign` set `writeError` and left the store clean, so the very
     * next `flushGm` - which is exactly what TRY AGAIN calls - returned at
     * `if (!dirty)` and wrote nothing. On screen: the red strip, TRYING…, and
     * the same strip back, with the campaign still in this tab alone. It only
     * ever reached the disk if some later unrelated change happened to carry
     * it, which is why no test caught it.
     */
    const spy = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    const made = await gm.useGm.getState().createCampaign('A second table');

    expect(gm.useGm.getState().writeError).toMatch(/only exists in this tab/);
    expect(gm.useGm.getState().writeRetry).toBe('write');
    expect((await store.readCampaigns()).campaigns.map((c) => c.id)).not.toContain(made.id);

    spy.mockRestore();
    await gm.retryGm();

    expect(gm.useGm.getState().writeError, 'the retry wrote nothing').toBeNull();
    expect((await store.readCampaigns()).campaigns.map((c) => c.id)).toContain(made.id);
  });

  it('offers no retry for a delete that threw, because no flush can delete', async () => {
    // `flushGm` writes the open campaign, which is not what failed - and when
    // the doomed campaign is the open one it is the opposite of what was asked
    // for. Nothing happened, so the retry is the REMOVE the GM already has,
    // and the sentence says so instead of a button pretending otherwise.
    const doomed = await gm.useGm.getState().createCampaign('Doomed');
    const spy = vi
      .spyOn(store, 'deleteCampaign')
      .mockRejectedValue(new Error('The database is closed'));

    await gm.useGm.getState().removeCampaign(doomed.id);

    expect(gm.useGm.getState().writeError).toMatch(/could not be deleted/);
    expect(gm.useGm.getState().writeError).toMatch(/REMOVE tries again/);
    expect(gm.useGm.getState().writeRetry).toBeNull();
    expect(gm.useGm.getState().campaigns.map((c) => c.id)).toContain(doomed.id);
    spy.mockRestore();
  });

  it('retries the read when reading is what failed, where a flush is inert forever', async () => {
    /*
     * The worst of the four. `readCampaigns` threw, so `activeCampaignId` is
     * null and there are no campaigns: `writeActive` returns at
     * `base === undefined` on every flush, for the life of the tab. TRY AGAIN
     * called `flushGm`, so it could never do anything at all on this path.
     */
    globalThis.indexedDB = new IDBFactory();
    installStorage();
    vi.resetModules();
    const freshStore = await import('../../src/store/campaigns.ts');
    const spy = vi
      .spyOn(freshStore, 'readCampaigns')
      .mockRejectedValueOnce(new Error('The database is closed'));
    const freshGm = (await import('../../src/ui/gm/gmStore.ts')) as Gm;
    // Joins the hydration the import started, which is the one that failed.
    await freshGm.hydrateGm();

    expect(freshGm.useGm.getState().writeError).toMatch(/could not be read/);
    expect(freshGm.useGm.getState().writeRetry).toBe('read');
    await freshGm.flushGm();
    expect(freshGm.useGm.getState().writeError, 'a flush was not inert here').not.toBeNull();

    await freshGm.retryGm();

    expect(freshGm.useGm.getState().writeError, 'the alarm outlived the failure').toBeNull();
    expect(freshGm.useGm.getState().writeRetry).toBeNull();
    expect(freshGm.useGm.getState().campaigns).toHaveLength(1);
    spy.mockRestore();
  });

  it('says so for the very first campaign of all, which used to fail in silence', async () => {
    /*
     * The one write in this file nothing was ever told about.
     *
     * `hydrateGm` makes a campaign for a device that has none, and the `catch`
     * around that `putCampaign` was empty, carrying "an empty campaign that
     * failed to save has lost nothing". Nothing is dirty at that moment, so
     * `writeActive` returns at `if (!dirty)` and no later flush reports it
     * either - and SAVE, whose whole job is to say where the campaign is,
     * would stamp "already on this device, just now" over it.
     *
     * The spy has to be installed before the module is imported, because
     * importing `gmStore` *is* hydration starting.
     */
    globalThis.indexedDB = new IDBFactory();
    installStorage();
    vi.resetModules();
    const freshStore = await import('../../src/store/campaigns.ts');
    const spy = vi
      .spyOn(freshStore, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    const freshGm = await import('../../src/ui/gm/gmStore.ts');
    await freshGm.hydrateGm();

    expect(freshGm.useGm.getState().writeError).toMatch(/quota has been exceeded/);
    expect(freshGm.useGm.getState().hydrated).toBe(true);
    // Still usable in memory: the sentence is about where the campaign is, not
    // about whether the GM can work.
    expect(freshGm.useGm.getState().campaigns).toHaveLength(1);

    // And left dirty, so the next change, `pagehide` and SAVE's TRY AGAIN all
    // retry the write that never landed. Without that, the retry is a button
    // that does nothing - `writeActive` would return at `if (!dirty)`.
    spy.mockRestore();
    await freshGm.flushGm();
    expect(freshGm.useGm.getState().writeError).toBeNull();
    expect((await freshStore.readCampaigns()).campaigns).toHaveLength(1);
  });
});

/**
 * The campaigns nobody is looking at.
 *
 * `writeActive` gathers `activeCampaignId` and nothing else, which is right for
 * a board and was the whole story for everything else too. Two things needed
 * writing that were not the open campaign, and neither one reached the disk:
 * a rename of another campaign, and the records the reader repaired on the way
 * in. Both sat in memory looking correct until the next reload.
 *
 * Every test below fails against the store as it was. The mutation that kills
 * the first four is deleting `else scheduleAside(id)` from `patchCampaign`; the
 * one that kills the last two is deleting the `for (const c of read.repaired)`
 * line from `hydrateGm`.
 */
describe('a campaign that is not the one on screen', () => {
  it('writes a rename of a campaign that is not open', async () => {
    const s = () => gm.useGm.getState();
    const first = s().campaigns[0]!;
    await s().createCampaign('Second table');
    expect(s().activeCampaignId, 'the fixture stopped exercising the branch').not.toBe(first.id);

    s().renameCampaign(first.id, 'The Sablewood Winter');
    await gm.flushGm();

    const onDisk = (await store.readCampaigns()).campaigns.find((c) => c.id === first.id);
    expect(onDisk?.name, 'the rename never left this tab').toBe('The Sablewood Winter');
  });

  it('still writes a rename of the campaign that is open', async () => {
    // The control. A change that sent every patch down the aside path would
    // satisfy the test above and write the stored record over a live board.
    const s = () => gm.useGm.getState();
    const open = s().campaigns.find((c) => c.id === s().activeCampaignId)!;
    s().setFear(5);
    s().renameCampaign(open.id, 'Renamed in place');
    await gm.flushGm();

    const onDisk = await store.getCampaign(open.id);
    expect(onDisk?.name).toBe('Renamed in place');
    expect(onDisk?.fear, 'the stored record was written over the live board').toBe(5);
  });

  it('names the campaign that would not write, because it is not the one on screen', async () => {
    const s = () => gm.useGm.getState();
    const first = s().campaigns[0]!;
    await s().createCampaign('Second table');

    const spy = vi
      .spyOn(store, 'putCampaign')
      .mockRejectedValue(new Error('The quota has been exceeded.'));
    s().renameCampaign(first.id, 'Ashfall');
    await gm.flushGm();

    expect(s().writeError).toMatch(/Ashfall/);
    expect(s().writeError).toMatch(/not the campaign open here/);
    // The board's own sentence would be false here: what is on the screen is
    // fine, and pointing the GM at it sends them to the wrong table.
    expect(s().writeError).not.toMatch(/on this screen is only in this tab/);

    // And left in the set, so the next flush is a real retry.
    spy.mockRestore();
    await gm.flushGm();
    expect((await store.getCampaign(first.id))?.name).toBe('Ashfall');
    expect(s().writeError).toBeNull();
  });

  it('does not let a board write that worked wipe the sentence about one that did not', async () => {
    /*
     * The ordering, pinned. `writeActive` clears `writeError` when it lands,
     * so an aside failure reported before it is erased by a board write that
     * has nothing to do with it - the GM sees a clean screen and a rename that
     * is not on the disk.
     */
    const s = () => gm.useGm.getState();
    const first = s().campaigns[0]!;
    await s().createCampaign('Second table');

    const realPut = store.putCampaign;
    const spy = vi.spyOn(store, 'putCampaign').mockImplementation(async (c) => {
      if (c.id === first.id) throw new Error('The quota has been exceeded.');
      await realPut(c);
    });

    s().renameCampaign(first.id, 'Ashfall');
    s().setFear(3);
    await gm.flushGm();

    expect(s().writeError, 'the board write cleared it').toMatch(/Ashfall/);
    expect(s().writeRetry).toBe('write');
    expect((await store.getCampaign(s().activeCampaignId!))?.fear, 'the board write was lost').toBe(
      3,
    );
    spy.mockRestore();
  });

  it('writes back what the reader repaired, instead of repairing it again every launch', async () => {
    const seeded = gm.useGm.getState().campaigns[0]!;
    // Past the pool's ceiling, which the reader clamps and reports. The value
    // matters less than that `readCampaigns` hands the record back as repaired.
    await store.putCampaign({ ...seeded, fear: 40 });
    expect((await store.readCampaigns()).repaired.map((c) => c.id)).toEqual([seeded.id]);

    vi.resetModules();
    const store2 = await import('../../src/store/campaigns.ts');
    const gm2 = await import('../../src/ui/gm/gmStore.ts');
    await gm2.hydrateGm();
    await gm2.flushGm();

    const after = await store2.readCampaigns();
    expect(after.repaired, 'the same repair runs on every launch, for ever').toEqual([]);
    expect(after.campaigns.find((c) => c.id === seeded.id)?.fear).toBe(12);
  });

  it('writes nothing back when the reader repaired nothing', async () => {
    // The control on that one: a change that wrote every campaign on every
    // hydration would satisfy the test above and turn each launch into a full
    // rewrite of every board on the device.
    await gm.flushGm();

    vi.resetModules();
    const store2 = await import('../../src/store/campaigns.ts');
    const spy = vi.spyOn(store2, 'putCampaign');
    const gm2 = await import('../../src/ui/gm/gmStore.ts');
    await gm2.hydrateGm();
    await gm2.flushGm();

    expect(spy, 'every launch rewrites every campaign').not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

/*
 * THE FIGHT IS ON THE ROW IT IS FOUGHT IN, AND THERE IS NOWHERE ELSE FOR IT
 * TO BE.
 *
 * What stood here was three describes about a fight that lived on the board
 * and visited rows: `running a scene` (15 its), `ending a scene, once a fight
 * can be parked` (3) and `deleting a row a fight came from` (4). Fourteen of
 * those twenty-two are gone rather than rewritten, because the states they
 * pinned cannot be reached any more - a board holding a fight no row owns, a
 * row holding a copy of a fight that is also on the glass, a mint that happens
 * behind the GM's back on the way past. Each was a real property of schema 4
 * and each is now unstateable.
 *
 * The rest inverted. Where the old file asserted that resume EMPTIES the row
 * it took the fight from, this one asserts that nothing moves at all.
 */
describe('two fights, two rows, and nothing in between', () => {
  const s = () => gm.useGm.getState();
  const held = (id: string): number => {
    const row = s().session.find((i) => i.id === id);
    return row?.kind === 'scene' ? row.combatants.length : -1;
  };
  /** The row object itself, for the identity assertions below. */
  const rowOf = (id: string): SessionItem => s().session.find((i) => i.id === id)!;

  /** Two named rows, in order, with the runner showing neither. */
  const twoRows = (): void => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().addSessionItem(sceneWith('forest', [], { name: 'The forest' }));
  };

  it('spawns into the row it is told and into no other', () => {
    // Both rows already hold a body with the SAME id, which is legal: a
    // combatant id is unique inside its row and means nothing outside it.
    s().addSessionItem(sceneWith('dungeon', [combatant('acid-burrower-0')]));
    s().addSessionItem(sceneWith('forest', [combatant('acid-burrower-0')]));
    const before = rowOf('forest');

    s().spawn('dungeon', adversary, 4, 2);

    expect(held('dungeon')).toBe(3);
    expect(held('forest')).toBe(1);
    // Deep-equal AND identical: the untouched row is not rebuilt at all, which
    // is what `MemoSessionRow` rests on.
    expect(rowOf('forest')).toEqual(before);
    expect(rowOf('forest')).toBe(before);
  });

  it('patches and removes inside one row when both hold the same combatant id', () => {
    /*
     * The id-collision property, stated as a test because it is what keeps
     * `openScene` non-derivable: you cannot find the fight by looking for a
     * combatant, so the pointer has to be written down, and `Scene.tsx`'s card
     * key has to carry the row id as well as the body's.
     */
    s().addSessionItem(sceneWith('dungeon', [combatant('acid-burrower-0')]));
    s().addSessionItem(sceneWith('forest', [combatant('acid-burrower-0')]));

    s().patchCombatant('dungeon', 'acid-burrower-0', { hp: { max: 8, marked: 5 } });
    const dungeonBody = rowOf('dungeon');
    const forestBody = rowOf('forest');
    expect(dungeonBody.kind === 'scene' && dungeonBody.combatants[0]!.hp.marked).toBe(5);
    expect(forestBody.kind === 'scene' && forestBody.combatants[0]!.hp.marked).toBe(0);

    s().removeCombatant('dungeon', 'acid-burrower-0');
    expect(held('dungeon')).toBe(0);
    expect(held('forest')).toBe(1);
  });

  it('leaves both fights exactly as they were left, across a flip and back', () => {
    /*
     * The owner's complaint, at store level. Two fights stand at once now;
     * neither is copied, parked, swapped or emptied by moving between them.
     */
    twoRows();
    s().spawn('dungeon', adversary, 4, 2);
    s().patchCombatant('dungeon', 'acid-burrower-1', { hp: { max: 8, marked: 6 } });
    s().spawn('forest', adversary, 4, 1);
    s().patchCombatant('forest', 'acid-burrower-0', { stress: { max: 3, marked: 2 } });

    s().showScene('dungeon');
    s().showScene('forest');
    s().showScene('dungeon');

    expect(gm.openCombatants(s())).toHaveLength(2);
    expect(gm.openCombatants(s())[1]!.hp.marked).toBe(6);
    const forest = rowOf('forest');
    expect(forest.kind === 'scene' && forest.combatants[0]!.stress.marked).toBe(2);
    expect(forest.kind === 'scene' && forest.combatants).toHaveLength(1);
  });

  it('moves nothing on a flip, in either direction, object for object', () => {
    /*
     * ONE TEST IN PLACE OF THREE. Schema 4 needed a deep-copy case for the
     * park, one for the resume and one for `thresholds` riding along as a
     * mutable tuple, because a flip carried an array between two homes and an
     * alias between them was invisible until a writer stopped rebuilding.
     *
     * There is no carry to alias now. `showScene` writes one string, so the
     * strongest statement available is also the simplest: the row objects
     * either side of a flip are the same objects.
     */
    twoRows();
    s().spawn('dungeon', adversary, 4, 1);
    s().spawn('forest', adversary, 4, 1);
    s().showScene('dungeon');

    const dungeonBefore = rowOf('dungeon');
    const forestBefore = rowOf('forest');

    s().showScene('forest');
    expect(rowOf('dungeon')).toBe(dungeonBefore);
    expect(rowOf('forest')).toBe(forestBefore);

    s().showScene('dungeon');
    expect(rowOf('dungeon')).toBe(dungeonBefore);
    expect(rowOf('forest')).toBe(forestBefore);
  });

  it('rebuilds only the row a mark lands on, and leaves every other row’s object alone', () => {
    /*
     * What `MemoSessionRow` rests on, held here rather than assumed there. A
     * memo compares props, and the prop is the row object; if `withSceneFight`
     * rebuilt the array by `map` over the whole list without the identity
     * check, every row of the plan would be a new object on every HP tap and
     * the memo would skip nothing.
     */
    twoRows();
    const clockId = s().addCountdown('The tide', 'standard', 6);
    s().spawn('dungeon', adversary, 4, 1);
    const untouched = s().session.filter((i) => i.id !== 'dungeon');

    s().patchCombatant('dungeon', 'acid-burrower-0', { hp: { max: 8, marked: 1 } });

    expect(untouched).toHaveLength(2);
    for (const before of untouched) expect(rowOf(before.id)).toBe(before);
    expect(rowOf(clockId).kind).toBe('countdown');
  });

  it('hands the runner the row’s own array, and the same empty one twice when nothing is open', () => {
    /*
     * THE ZUSTAND TRAP, HELD BY A TEST. zustand 5 memoizes no selector: it
     * calls the function on every commit and re-renders when the result fails
     * `Object.is`. A selector that built a fresh array - or a fresh `[]` for
     * "no fight" - would repaint the whole runner on every `+1` of Fear.
     */
    twoRows();
    s().spawn('dungeon', adversary, 4, 1);
    s().showScene('dungeon');

    const before = gm.openCombatants(s());
    s().nudgeFear(1);
    expect(gm.openCombatants(s())).toBe(before);

    s().patchCombatant('dungeon', 'acid-burrower-0', { spotlighted: true });
    expect(gm.openCombatants(s())).not.toBe(before);

    // And the two ways of having no fight share one array rather than minting.
    s().showScene(null);
    expect(gm.openCombatants(s())).toBe(gm.openCombatants(s()));
    expect(gm.openCombatants(s())).toEqual([]);
  });

  it('leaves Fear, the countdowns and the party where they are', () => {
    twoRows();
    s().setFear(5);
    s().addCountdown('The tide', 'standard', 6);
    s().spawn('dungeon', adversary, 4, 1);

    s().showScene('dungeon');
    s().showScene('forest');

    expect(s().fear).toBe(5);
    expect(s().countdowns).toHaveLength(1);
    expect(s().countdowns[0]!.value).toBe(6);
  });
});

describe('pointing the runner at a scene', () => {
  const s = () => gm.useGm.getState();

  it('refuses an id that names no scene row, rather than leaving the pointer dangling', () => {
    /*
     * `readCampaignRecord` nulls a dangling pointer in silence on the way in
     * from disk, because a hand-edited file is not the app's fault. One
     * written by this store would be: `liveScenes` draws no chip for it and
     * the runner would show a scene the plan does not list.
     *
     * Three shapes of wrong id, because the reader checks `openScene` against
     * every row's id rather than every SCENE row's - an `unreadable` row keeps
     * its id so a build that cannot parse it cannot lose it.
     */
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    const clockId = s().addCountdown('The tide', 'standard', 6);
    s().addSessionItem({
      id: 'mystery',
      kind: 'unreadable',
      name: '',
      order: 2,
      collapsed: true,
      why: 'this version of the app has no “photo” item',
      raw: '{"kind":"photo"}',
    });
    s().showScene('dungeon');

    for (const bad of [clockId, 'mystery', 'no-such-row']) {
      s().showScene(bad);
      expect(s().openScene, bad).toBe('dungeon');
    }

    // Null always lands: it is how the runner is closed.
    s().showScene(null);
    expect(s().openScene).toBeNull();
  });

  it('does nothing at all when asked for the scene already open', () => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().showScene('dungeon');
    s().spawn('dungeon', adversary, 4, 1);
    const before = s().session;
    s().showScene('dungeon');
    expect(s().session).toBe(before);
    expect(s().openScene).toBe('dungeon');
  });

  it('mints nothing when asked to spawn into a row that is not a scene', () => {
    /*
     * The split that used to be a side effect. Schema 4's flip minted an
     * untitled home for a fight that had none, so a fight was kept - but only
     * by leaving it, and under a name nobody chose. `spawn` is total and
     * mints nothing at all; the verb that makes a row to fight in is
     * `openNewScene`, and it is a separate tap with its own label.
     */
    const clockId = s().addCountdown('The tide', 'standard', 6);
    const before = s().session;

    s().spawn(clockId, adversary, 4, 2);
    s().spawn('no-such-row', adversary, 4, 2);

    expect(s().session).toBe(before);
    expect(s().session).toHaveLength(1);
  });
});

describe('minting a scene to fight in', () => {
  const s = () => gm.useGm.getState();

  it('makes exactly one row, puts it last, opens it and hands back its id', () => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    const before = s().session.length;

    const id = s().openNewScene('Ambush at the ford');

    expect(s().session).toHaveLength(before + 1);
    const minted = s().session.at(-1)!;
    expect(minted.id).toBe(id);
    expect(minted.name).toBe('Ambush at the ford');
    expect(minted.order).toBe(before);
    expect(s().openScene).toBe(id);
    expect(gm.openCombatants(s())).toEqual([]);
  });

  it('offers the board’s place to a scene that has none yet', () => {
    // The workbench's environment, handed to a row that can then be given a
    // different one. `newScene` does this for every other door that mints.
    s().setEnvironment('raging-river');
    const id = s().openNewScene();
    const row = s().session.find((i) => i.id === id)!;
    expect(row.kind === 'scene' && row.environmentRef).toBe('raging-river');
    // An empty name is legal, and `sessionTitle` draws it as SCENE.
    expect(row.name).toBe('');
  });
});

describe('ending a fight', () => {
  const s = () => gm.useGm.getState();
  const held = (id: string): number => {
    const row = s().session.find((i) => i.id === id);
    return row?.kind === 'scene' ? row.combatants.length : -1;
  };

  it('empties the row it is told and leaves the runner looking at it', () => {
    /*
     * INVERTED. END SCENE used to clear the pointer as well, and its own words
     * were "the board is empty and belongs to no row" - true while the pointer
     * meant ownership of a fight that lived somewhere else. It means
     * navigation now, and a GM who ends a fight has not asked to leave the
     * table.
     */
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().addSessionItem(sceneWith('forest', [], { name: 'The forest' }));
    s().showScene('dungeon');
    s().spawn('dungeon', adversary, 4, 2);
    s().spawn('forest', adversary, 4, 1);

    s().clearScene('dungeon');

    expect(held('dungeon')).toBe(0);
    expect(s().openScene).toBe('dungeon');
    expect(gm.openCombatants(s())).toEqual([]);
    // And the dead do not stand back up on the way back: there is no second
    // copy anywhere to fall out of step with this one.
    s().showScene('forest');
    s().showScene('dungeon');
    expect(gm.openCombatants(s())).toEqual([]);
  });

  it('does not reach into any other row’s fight', () => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().addSessionItem(sceneWith('forest', [], { name: 'The forest' }));
    s().spawn('dungeon', adversary, 4, 2);
    s().spawn('forest', adversary, 4, 1);

    s().clearScene('forest');

    expect(held('dungeon')).toBe(2);
    expect(held('forest')).toBe(0);
  });

  it('leaves the environment, Fear and the countdowns standing, as it always has', () => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().showScene('dungeon');
    s().setEnvironment('ruined-hall');
    s().setFear(4);
    s().addCountdown('The tide', 'standard', 6);
    s().spawn('dungeon', adversary, 4, 1);

    s().clearScene('dungeon');

    expect(s().environmentRef).toBe('ruined-hall');
    expect(s().fear).toBe(4);
    expect(s().countdowns).toHaveLength(1);
  });
});

describe('deleting a row that is holding a fight', () => {
  const s = () => gm.useGm.getState();

  it('takes the fight with it and lets go of the pointer', () => {
    /*
     * INVERTED, AND THIS IS THE CLAUSE THE WHOLE CHANGE TURNS ON. What stood
     * here was "lets go of the pointer and keeps the fight on the glass": the
     * GM deleted a row of the plan, they did not ask to end a fight, so the
     * fight was kept and became nobody's. That homeless state is what schema 5
     * deletes, and the control has always said so - `SessionRow.tsx` arms this
     * delete as TAP AGAIN TO DELETE THE FIGHT.
     */
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().showScene('dungeon');
    s().spawn('dungeon', adversary, 4, 2);

    s().removeSessionItem('dungeon');

    expect(s().openScene).toBeNull();
    expect(s().session).toEqual([]);
    expect(gm.openCombatants(s())).toEqual([]);
  });

  it('hands a clock that belonged to it back to the campaign, in the same commit', () => {
    // Without this the clock is invisible until some scene happens to be
    // opened again. The reader repairs a dangling scope on the way in from
    // disk, but that is cold, and this is a GM deleting a row with the app
    // open.
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    const clockId = s().addCountdown('The tide', 'standard', 6);
    s().setCountdownScene(clockId, 'dungeon');

    s().removeSessionItem('dungeon');

    const clock = s().session.find((i) => i.id === clockId);
    expect(clock?.kind === 'countdown' && clock.sceneId).toBe(null);
    // Never re-pinned: a countdown does not become the top bar's by accident.
    expect(clock?.kind === 'countdown' && clock.primary).toBe(false);
  });

  it('does not touch the pointer, or any other fight, when a different row is deleted', () => {
    s().addSessionItem(sceneWith('dungeon', [], { name: 'The dungeon' }));
    s().addSessionItem(sceneWith('forest', [], { name: 'The forest' }));
    s().spawn('dungeon', adversary, 4, 2);
    s().showScene('dungeon');

    s().removeSessionItem('forest');

    expect(s().openScene).toBe('dungeon');
    expect(gm.openCombatants(s())).toHaveLength(2);
  });
});
