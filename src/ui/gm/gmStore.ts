/**
 * The GM's own state, and the campaign it belongs to.
 *
 * This file used to open by arguing that a scene is not a character and could
 * therefore live in localStorage, written synchronously on every change. Half
 * of that was true and half of it was never checked. What is actually in here
 * is the live fight, the Fear pool, every countdown, the whole session list -
 * and the party board, which holds *whole copies of the players' character
 * sheets*, deliberately, for the reason `party.ts` gives. Keeping those in the
 * store iOS clears first, under a five-megabyte ceiling shared with everything
 * else on the origin, was the one place in this app where the durability
 * argument in Architecture 6 had never been applied.
 *
 * So state lives in a campaign now, in IndexedDB, beside the characters and
 * never inside them. What that buys, in order:
 *
 *   - the same eviction story, the same quarantine and the same refusal to let
 *     an old build write over a new record that `characters` has had since
 *     P0-4, applied to records that contain other people's sheets;
 *   - more than one campaign, and switching between them, without a switch
 *     ever touching the character store - a sheet can be on two boards at once
 *     and neither contradicts the other;
 *   - writes on a 400 ms debounce instead of a synchronous `JSON.stringify` of
 *     the entire board on every `+1` of Fear.
 *
 * The screens above this file did not change. Every field they read - `fear`,
 * `countdowns`, `combatants`, `party` and the rest - is still here with the
 * same name and the same shape; what changed is where it is written and that
 * there is now a campaign under it. `countdowns` is the one field that is
 * derived rather than stored: countdowns are rows of the session list, because
 * that is where the wireframe draws them, and keeping a second array beside
 * the list would be two things to hold in step. It is recomputed in `commit`,
 * which is the single write path, so it cannot drift.
 */
import { create } from 'zustand';
import {
  countdownsOf,
  emptyBoard,
  newCampaign,
  withPrimaryCountdown,
  type Campaign,
  type GmBoard,
  type GmRegion,
  type SessionItem,
} from '../../../shared/campaigns.ts';
import type {
  Adversary,
  Character,
  Ref,
  RosterEntry,
  Tier,
} from '../../../shared/types.ts';
import {
  MAX_FEAR,
  makeCombatant,
  tickCountdown,
  type Countdown,
  type CountdownKind,
  type EncounterAdjustments,
  type SceneCombatant,
} from '../../engine/encounter.ts';
import { exportCampaign } from '../../transfer/campaignFile.ts';
import type { SaveOptions, SaveResult } from '../../transfer/fileIo.ts';
import { deleteCampaign, putCampaign, readCampaigns } from '../../store/campaigns.ts';
import { FIRST_CAMPAIGN_NAME, migrateLegacyGmState } from '../../store/campaignMigration.ts';
import type { QuarantinedRecord } from '../../store/db.ts';
import {
  tracksFromSheet,
  upsertMember,
  type PartyMember,
  type PartySource,
  type PartyTracks,
} from './party.ts';

/** Declared in `shared/campaigns.ts` now: the campaign record stores them. */
export type { GmRegion } from '../../../shared/campaigns.ts';
export type { RosterEntry } from '../../../shared/types.ts';

/** Which sheets landed on the board, and which ones were already on it. */
export interface PartyImportSummary {
  added: string[];
  updated: string[];
}

/**
 * The part of the state that belongs to the active campaign.
 *
 * Every field here is written into the campaign record on the next flush, and
 * every one of them is replaced wholesale when the GM switches campaign. The
 * actions and the campaign list below are not: they belong to the app.
 */
export interface GmLive extends GmBoard {
  fear: number;
  session: SessionItem[];
  party: PartyMember[];
  /** Derived from `session`. Never set directly; `commit` recomputes it. */
  countdowns: Countdown[];
}

export interface GmState extends GmLive {
  /** Every campaign on this device, newest played first. */
  campaigns: Campaign[];
  activeCampaignId: string | null;
  /** False until the database has answered. Nothing has been written yet. */
  hydrated: boolean;
  /** Campaigns a newer build wrote. Left on the disk, named, never rendered. */
  quarantined: QuarantinedRecord[];
  /** Repairs and one-off notices, each a sentence. Never a count. */
  notices: string[];
  /**
   * The disk replaced something the GM had already changed.
   *
   * It is in `notices` too, and this flag is not a duplicate of it: every other
   * notice is about a *record* - a Fear pool clamped back inside its range, a
   * campaign a newer build wrote - and those recur on every launch, which is
   * why they live in MENU rather than in a banner. This one is about the GM's
   * own tap being undone, it happens once, and a sentence reporting that
   * something you did has been reversed cannot wait behind a button. `Gm.tsx`
   * draws it on the screen it happened on and `dismissReplacedOnLoad` clears
   * it; the copy in `notices` stays, so dismissing it is not erasing it.
   */
  replacedOnLoad: boolean;
  /**
   * Set while what is on screen has failed to reach the disk.
   *
   * The GM screen must never imply a change is saved when it is not - the same
   * rule `state.ts` learned with `writeError`, and the reason a silent `catch`
   * around `localStorage.setItem` was not good enough here.
   */
  writeError: string | null;

  /** Take the sentence off the screen. It stays in `notices`. */
  dismissReplacedOnLoad: () => void;

  setRegion: (region: GmRegion) => void;
  setPartyTier: (tier: Tier) => void;

  addToRoster: (ref: Ref) => void;
  setRosterCount: (ref: Ref, count: number) => void;
  clearRoster: () => void;
  toggleAdjustment: (key: keyof EncounterAdjustments) => void;

  /** Put `times` copies of an adversary into the live scene. */
  spawn: (adversary: Adversary, partySize: number, times?: number) => void;
  patchCombatant: (id: string, patch: Partial<SceneCombatant>) => void;
  removeCombatant: (id: string) => void;
  clearScene: () => void;

  setEnvironment: (ref: Ref | null) => void;

  setFear: (value: number) => void;
  nudgeFear: (delta: number) => void;

  /**
   * Start a countdown, and hand back the id it was given.
   *
   * The id is minted in here - the row and the countdown deliberately share one
   * - so a caller that has to do something to the row it just made has no way
   * to name it. ADD is that caller: "pin it to the top bar" is
   * `setPrimaryCountdown(id)`, and the alternative is reading
   * `session.at(-1)`, which is the caller holding an opinion about how this
   * function appends.
   */
  addCountdown: (name: string, kind: CountdownKind, start: number) => string;
  advanceCountdown: (id: string, delta: number) => void;
  resetCountdown: (id: string) => void;
  removeCountdown: (id: string) => void;
  /** At most one, always. Pass null to have none. */
  setPrimaryCountdown: (id: string | null) => void;

  addSessionItem: (item: SessionItem) => void;
  patchSessionItem: (id: string, patch: Partial<SessionItem>) => void;
  removeSessionItem: (id: string) => void;
  moveSessionItem: (id: string, toIndex: number) => void;

  createCampaign: (name?: string) => Promise<Campaign>;
  switchCampaign: (id: string) => Promise<void>;
  renameCampaign: (id: string, name: string) => void;
  removeCampaign: (id: string) => Promise<void>;
  /** The open campaign as a `.dhcampaign` file. Never throws; read `ok`. */
  exportActiveCampaign: (options?: SaveOptions & { at?: Date }) => Promise<SaveResult>;

  /** Put sheets on the party board. Never writes to the character store. */
  importParty: (sheets: Character[], source: PartySource) => PartyImportSummary;
  markPartyTracks: (id: string, patch: Partial<PartyTracks>) => void;
  /** Put a row's tracks back to the numbers that arrived with the sheet. */
  resetPartyTracks: (id: string) => void;
  removePartyMember: (id: string) => void;
}

const EMPTY_LIVE: GmLive = {
  ...emptyBoard(),
  fear: 0,
  session: [],
  party: [],
  countdowns: [],
};

/** A campaign's contents, as the screens read them. */
const spread = (c: Campaign): GmLive => ({
  region: c.board.region,
  partyTier: c.board.partyTier,
  roster: c.board.roster,
  adjustments: c.board.adjustments,
  combatants: c.board.combatants,
  environmentRef: c.board.environmentRef,
  fear: c.fear,
  session: c.session,
  party: c.party,
  countdowns: countdownsOf(c.session),
});

/** The same contents, as a record. `base` carries the id and the timestamps. */
const gather = (base: Campaign, live: GmLive, at: string): Campaign => ({
  ...base,
  updatedAt: at,
  fear: live.fear,
  session: live.session,
  party: live.party,
  board: {
    region: live.region,
    partyTier: live.partyTier,
    roster: live.roster,
    adjustments: live.adjustments,
    combatants: live.combatants,
    environmentRef: live.environmentRef,
  },
});

function clampFear(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_FEAR, Math.round(n))) : 0;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * The active campaign, on a 400 ms debounce, always flushed before the page
 * can go away.
 *
 * `pagehide` is the only lifecycle event iOS Safari reliably delivers, which
 * is why `state.ts` uses it and why this does too. The debounce is the whole
 * point of the move: the old store wrote the entire board - party sheets
 * included - synchronously, inside the tap that changed one number.
 */
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
let queue: Promise<void> = Promise.resolve();

/**
 * One batch at a time, in order.
 *
 * Chained rather than fired in parallel for the reason `state.ts` gives: a
 * second flush while the first is in flight must not resolve early, or a
 * `switchCampaign` awaiting it would swap the board out from under a write
 * that has not landed.
 */
export function flushGm(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  queue = queue.then(writeActive, writeActive);
  return queue;
}

async function writeActive(): Promise<void> {
  if (!dirty) return;
  const state = useGm.getState();
  const base = state.campaigns.find((c) => c.id === state.activeCampaignId);
  if (base === undefined) return;

  const record = gather(base, state, new Date().toISOString());
  try {
    await putCampaign(record);
    dirty = false;
    useGm.setState({
      campaigns: state.campaigns.map((c) => (c.id === record.id ? record : c)),
      writeError: null,
    });
  } catch (error) {
    /*
     * Left dirty on purpose, so the next change or the next `pagehide` tries
     * again - and said out loud in the meantime, because a GM who believes
     * tonight's fight is saved and closes the tab has lost the evening.
     */
    useGm.setState({
      writeError:
        error instanceof Error
          ? `${error.message} What is on this screen is only in this tab, so closing it now loses it.`
          : 'This campaign could not be written to this device’s storage. What is on this screen is only in this tab, so closing it now loses it.',
    });
  }
}

function schedule(): void {
  dirty = true;
  if (useGm.getState().activeCampaignId === null) return;
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushGm();
  }, 400);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushGm();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushGm();
  });
}

// ---------------------------------------------------------------------------
// Reading, once
// ---------------------------------------------------------------------------

let hydration: Promise<void> | null = null;

/**
 * What the GM is told when the disk won a race against their own hand.
 *
 * One string, two renderings: `notices`, which MENU lists and keeps, and
 * `replacedOnLoad`, which puts it under the top bar where the tap happened. A
 * second sentence saying the same thing in different words is how two screens
 * come to describe one event differently.
 */
export const REPLACED_ON_LOAD =
  'Your table was still loading when you changed something, so what was saved on this device has been used instead.';

/**
 * Open the campaigns, running the one-time move out of localStorage first.
 *
 * Started at the bottom of this module rather than by a screen, because the GM
 * chunk is loaded lazily: importing this file *is* the GM screen arriving, and
 * a hydration that waited for a component to ask would be a feature shipped
 * switched off - which is the defect class `tests/harness/orphans.test.ts`
 * exists for. Idempotent, so a second caller joins the first.
 */
export function hydrateGm(): Promise<void> {
  hydration ??= (async () => {
    const notices: string[] = [];

    const legacy = await migrateLegacyGmState();
    if (legacy.message !== null) notices.push(legacy.message);
    notices.push(...legacy.warnings);

    let campaigns: Campaign[] = [];
    let quarantined: QuarantinedRecord[] = [];
    try {
      const read = await readCampaigns();
      campaigns = read.campaigns;
      quarantined = read.quarantined;
      notices.push(...read.warnings);
    } catch (error) {
      // The board still works in memory; it just will not be written. Saying
      // so is the whole point - the old code caught this and said nothing.
      useGm.setState({
        hydrated: true,
        writeError: `This device’s storage could not be read (${
          error instanceof Error ? error.message : String(error)
        }), so nothing on this screen is being saved.`,
        notices,
      });
      return;
    }

    /*
     * A device with no campaign at all gets one, rather than a screen with
     * nowhere to put a change. Same name as the migrated one, from the same
     * constant, because two paths arriving at different names would be a
     * difference with nothing behind it.
     */
    let firstWriteFailed = false;
    if (campaigns.length === 0) {
      const at = new Date().toISOString();
      const first = newCampaign(FIRST_CAMPAIGN_NAME, at, crypto.randomUUID());
      try {
        await putCampaign(first);
      } catch (error) {
        /*
         * Said out loud, where it used to be swallowed.
         *
         * The line here was an empty `catch` carrying "an empty campaign that
         * failed to save has lost nothing". That is true about the data and
         * beside the point about the person holding the phone. Nothing is
         * dirty at this moment, so the next `flushGm` returns early at
         * `if (!dirty)` and no later write reports it either - and the screen
         * that reads this field is SAVE, whose whole job is to say where the
         * campaign is. Without this the sheet stamps "already on this device,
         * just now" over a write that threw.
         *
         * The campaign still works in memory. What is not true is that it is
         * anywhere else, and that is the sentence.
         */
        firstWriteFailed = true;
        useGm.setState({
          writeError:
            error instanceof Error
              ? `This device’s first campaign could not be written (${error.message}). Nothing you plan here is reaching the disk, so closing this tab loses it.`
              : 'This device’s first campaign could not be written. Nothing you plan here is reaching the disk, so closing this tab loses it.',
        });
      }
      campaigns = [first];
    }

    const active = campaigns[0]!;

    /*
     * If the GM has already touched something in the window before the
     * database answered, the record on the disk wins and they are told.
     *
     * That window is small - this module is imported as the GM chunk loads, so
     * hydration is running before the screen has painted - but "small" is not
     * a guarantee, and the alternative is worse in both directions: adopting
     * the live state would write an empty board over a real campaign, and
     * merging them would invent a state that was never true. Losing one tap
     * and saying so is the only honest option of the three - and "saying so"
     * means on the screen, not only in `notices`, which is what
     * `replacedOnLoad` is for.
     */
    let replacedOnLoad = false;
    if (dirty) {
      notices.push(REPLACED_ON_LOAD);
      replacedOnLoad = true;
      dirty = false;
    }

    useGm.setState({
      campaigns,
      activeCampaignId: active.id,
      hydrated: true,
      quarantined,
      notices,
      replacedOnLoad,
      ...spread(active),
    });

    /*
     * Left dirty, and after the block above rather than inside the `catch`.
     *
     * `dirty` is the answer to "is what is in memory somewhere else yet", and
     * for a first campaign whose write threw the answer is no - so the next
     * change, the next `pagehide`, and SAVE's own TRY AGAIN all retry it. It
     * cannot be set in the `catch` because the check above reads `dirty` as
     * "the GM touched something while the disk was being read" and would push
     * a notice about a tap nobody made.
     */
    if (firstWriteFailed) dirty = true;
  })();
  return hydration;
}

// ---------------------------------------------------------------------------

export const useGm = create<GmState>((set, get) => {
  /**
   * Every mutation goes through here, so nothing can forget to persist and
   * nothing can leave `countdowns` disagreeing with the session list.
   */
  const commit = (patch: Partial<GmLive>): void => {
    set(patch.session === undefined ? patch : { ...patch, countdowns: countdownsOf(patch.session) });
    schedule();
  };

  /** Patch the campaign list and, when it is the active one, the board too. */
  const patchCampaign = (id: string, patch: Partial<Campaign>): void => {
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    if (get().activeCampaignId === id) schedule();
  };

  const withCountdown = (id: string, f: (c: Countdown) => Countdown): SessionItem[] =>
    get().session.map((item) =>
      item.kind === 'countdown' && item.countdown.id === id
        ? { ...item, countdown: f(item.countdown) }
        : item,
    );

  return {
    ...EMPTY_LIVE,
    campaigns: [],
    activeCampaignId: null,
    hydrated: false,
    quarantined: [],
    notices: [],
    writeError: null,
    replacedOnLoad: false,

    dismissReplacedOnLoad: () => set({ replacedOnLoad: false }),

    setRegion: (region) => commit({ region }),
    setPartyTier: (partyTier) => commit({ partyTier }),

    addToRoster(ref) {
      const roster = get().roster;
      const existing = roster.find((e) => e.ref === ref);
      commit({
        roster: existing
          ? roster.map((e) => (e.ref === ref ? { ...e, count: e.count + 1 } : e))
          : [...roster, { ref, count: 1 } satisfies RosterEntry],
      });
    },

    setRosterCount(ref, count) {
      commit({
        roster:
          count <= 0
            ? get().roster.filter((e) => e.ref !== ref)
            : get().roster.map((e) => (e.ref === ref ? { ...e, count } : e)),
      });
    },

    clearRoster: () => commit({ roster: [] }),

    toggleAdjustment(key) {
      const adjustments = get().adjustments;
      commit({ adjustments: { ...adjustments, [key]: !adjustments[key] } });
    },

    spawn(adversary, partySize, times = 1) {
      const combatants = [...get().combatants];
      // makeCombatant derives the id from an index; find free ones so a second
      // Acid Burrower cannot collide with the first.
      let index = 0;
      for (let n = 0; n < times; n += 1) {
        while (combatants.some((c) => c.id === `${adversary.id}-${index}`)) index += 1;
        combatants.push(makeCombatant(adversary, index, partySize));
        index += 1;
      }
      commit({ combatants });
    },

    patchCombatant(id, patch) {
      commit({
        combatants: get().combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },

    removeCombatant: (id) => commit({ combatants: get().combatants.filter((c) => c.id !== id) }),
    clearScene: () => commit({ combatants: [] }),
    setEnvironment: (environmentRef) => commit({ environmentRef }),

    setFear: (value) => commit({ fear: clampFear(value) }),
    nudgeFear: (delta) => commit({ fear: clampFear(get().fear + delta) }),

    addCountdown(name, kind, start) {
      const value = Math.max(1, Math.round(start));
      const id = crypto.randomUUID();
      const session = get().session;
      commit({
        session: [
          ...session,
          {
            id,
            kind: 'countdown',
            name,
            order: session.length,
            // Closed, like every other row ADD mints. A new row that arrived
            // open pushes the rest of the night off a phone at the moment it
            // is added, and the countdown that matters gets pinned instead.
            collapsed: true,
            primary: false,
            // The item's id and the countdown's are the same on purpose: every
            // screen that has ever drawn a countdown holds the countdown's id,
            // and a second identifier would be a second thing to keep in step.
            countdown: { id, name, kind, start: value, value, notes: '' },
          },
        ],
      });
      return id;
    },

    advanceCountdown(id, delta) {
      commit({ session: withCountdown(id, (c) => tickCountdown(c, delta)) });
    },

    resetCountdown(id) {
      commit({ session: withCountdown(id, (c) => ({ ...c, value: c.start })) });
    },

    removeCountdown(id) {
      commit({
        session: get().session.filter(
          (item) => !(item.kind === 'countdown' && item.countdown.id === id),
        ),
      });
    },

    setPrimaryCountdown(id) {
      commit({ session: withPrimaryCountdown(get().session, id) });
    },

    addSessionItem(item) {
      const session = get().session;
      commit({ session: [...session, { ...item, order: session.length }] });
    },

    patchSessionItem(id, patch) {
      commit({
        session: get().session.map((item) =>
          // The kind is not patchable: a `scene` becoming an `encounter` would
          // leave the fields of the one it stopped being sitting on the row.
          item.id === id ? ({ ...item, ...patch, kind: item.kind } as SessionItem) : item,
        ),
      });
    },

    removeSessionItem(id) {
      commit({
        session: get()
          .session.filter((item) => item.id !== id)
          .map((item, order) => ({ ...item, order })),
      });
    },

    moveSessionItem(id, toIndex) {
      const session = [...get().session];
      const from = session.findIndex((item) => item.id === id);
      if (from === -1) return;
      const [moved] = session.splice(from, 1);
      session.splice(Math.max(0, Math.min(session.length, toIndex)), 0, moved!);
      commit({ session: session.map((item, order) => ({ ...item, order })) });
    },

    // -----------------------------------------------------------------------
    // Campaigns
    // -----------------------------------------------------------------------

    async createCampaign(name) {
      // The one being left lands first, or the debounce would write it into
      // the new campaign's turn and the GM would watch the old board reappear.
      await flushGm();
      const at = new Date().toISOString();
      const campaign = newCampaign(
        (name ?? '').trim() || FIRST_CAMPAIGN_NAME,
        at,
        crypto.randomUUID(),
      );
      try {
        await putCampaign(campaign);
      } catch (error) {
        set({
          writeError:
            error instanceof Error
              ? `That campaign could not be saved (${error.message}), so it only exists in this tab.`
              : 'That campaign could not be saved, so it only exists in this tab.',
        });
      }
      set({
        campaigns: [campaign, ...get().campaigns],
        activeCampaignId: campaign.id,
        ...spread(campaign),
      });
      return campaign;
    },

    async switchCampaign(id) {
      if (id === get().activeCampaignId) return;
      await flushGm();
      const target = get().campaigns.find((c) => c.id === id);
      // Nothing happens rather than an empty board appearing: an id that is
      // not here is a bug in the caller, not a campaign the GM has emptied.
      if (target === undefined) return;
      set({ activeCampaignId: id, ...spread(target) });
    },

    renameCampaign(id, name) {
      patchCampaign(id, { name: name.trim() });
    },

    async exportActiveCampaign(options) {
      /*
       * Flush first, so the file holds what is on the screen.
       *
       * Without it the export runs off the last record written, which on a
       * 400 ms debounce is up to four hundred milliseconds behind the GM - and
       * a backup that is *nearly* the state you were in is the kind of quiet
       * wrongness this app exists not to have.
       */
      await flushGm();
      const state = get();
      const campaign = state.campaigns.find((c) => c.id === state.activeCampaignId);
      if (campaign === undefined) {
        return {
          ok: false,
          route: null,
          fileName: '',
          cancelled: false,
          reason: 'There is no campaign open to export.',
        };
      }
      return exportCampaign(campaign, options);
    },

    async removeCampaign(id) {
      /*
       * Flush before the delete, for the reason `state.remove` gives: a
       * debounced write still holding this campaign would put it straight back
       * a few hundred milliseconds later, and the GM would watch a table they
       * deleted return.
       */
      await flushGm();
      try {
        await deleteCampaign(id);
      } catch (error) {
        set({
          writeError:
            error instanceof Error
              ? `That campaign could not be deleted (${error.message}).`
              : 'That campaign could not be deleted.',
        });
        return;
      }

      const campaigns = get().campaigns.filter((c) => c.id !== id);
      if (get().activeCampaignId !== id) {
        set({ campaigns });
        return;
      }
      // A GM always has a table. Deleting the last one leaves a fresh one
      // rather than a screen with nowhere to put the next change.
      if (campaigns.length === 0) {
        set({ campaigns, activeCampaignId: null, ...EMPTY_LIVE });
        await get().createCampaign();
        return;
      }
      const next = campaigns[0]!;
      set({ campaigns, activeCampaignId: next.id, ...spread(next) });
    },

    // -----------------------------------------------------------------------
    // The party board
    // -----------------------------------------------------------------------

    importParty(sheets, source) {
      const at = new Date().toISOString();
      const summary: PartyImportSummary = { added: [], updated: [] };
      let party = get().party;
      for (const sheet of sheets) {
        const result = upsertMember(party, sheet, source, at);
        party = result.party;
        summary[result.outcome].push(sheet.name || 'Unnamed');
      }
      commit({ party });
      return summary;
    },

    markPartyTracks(id, patch) {
      const at = new Date().toISOString();
      commit({
        party: get().party.map((m) =>
          // `markedAt` is what lets the board stop calling these numbers the
          // player's, so it is stamped by the same write that changes them.
          m.id === id ? { ...m, tracks: { ...m.tracks, ...patch }, markedAt: at } : m,
        ),
      });
    },

    resetPartyTracks(id) {
      commit({
        party: get().party.map((m) =>
          m.id === id ? { ...m, tracks: tracksFromSheet(m.sheet), markedAt: null } : m,
        ),
      });
    },

    removePartyMember: (id) => commit({ party: get().party.filter((m) => m.id !== id) }),
  };
});

/*
 * Start reading as soon as this module exists.
 *
 * Not inside a component and not behind a setting: the GM chunk is lazy, so
 * this line runs exactly when the GM screen arrives and never for a player who
 * only ever opens Play. A hydration that waited to be called would be a
 * feature that ships switched off, which is the one defect class this repo has
 * shipped four times.
 */
void hydrateGm();
