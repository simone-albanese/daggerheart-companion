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
  COUNTDOWN_BEATS_MAX,
  COUNTDOWN_TEXT_MAX,
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
import { CAMPAIGN_NAMES, freeName } from '../../store/names.ts';
import type { QuarantinedRecord } from '../../store/db.ts';
import { publishCampaignAlert, type CampaignRetry } from '../shell/campaignAlert.ts';
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

/**
 * The two remedies this store has for a failure, and the absence of one.
 *
 * `'write'` is "there is something in memory that is not on the disk", so
 * `flushGm` will try it again. `'read'` is the opposite direction: the disk
 * could not be *read*, there is no campaign to write, and the retry is another
 * attempt at reading it. `null` is a failure with no remedy in this store -
 * today that is a delete that threw, where the campaign is untouched and the
 * only retry is the REMOVE control the GM already has.
 *
 * The union itself is declared in `ui/shell/campaignAlert.ts` and aliased here,
 * so that the shell - which must never import this module, because importing it
 * *is* the campaign read starting - can name the same three answers without a
 * second hand-written copy to keep in step. The name stays `WriteRetry` because
 * that is what this store's own field is called.
 */
export type WriteRetry = CampaignRetry;

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
   *
   * It does not stay on the GM screen either. The subscription at the foot of
   * this file mirrors it into `ui/shell/campaignAlert.ts`, so leaving the
   * section does not take the sentence with it.
   */
  writeError: string | null;
  /**
   * What retrying would actually do about `writeError`, and null when the
   * honest answer is nothing.
   *
   * Set by every path that sets `writeError`, because no screen can work it
   * out: `flushGm` writes the active campaign **if the store is dirty**, which
   * is true of a write that threw and is false of three of the six failures
   * this store can report - a delete that threw, a read that failed, and (until
   * it was fixed in the store) `createCampaign`'s rejected write, which *should*
   * have left the store dirty and did not. A TRY AGAIN drawn over one of those is a button that flashes and
   * writes nothing - the founding rule failing on the control offered to
   * repair it. `retryGm` dispatches on this, and the three surfaces that draw
   * the button - the GM strip, SAVE, and the shell block that carries this
   * failure onto every other screen - read it to decide whether there is a
   * button to draw.
   */
  writeRetry: WriteRetry;

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
   *
   * There are three callers and only that one keeps the id. `AddSheet.tsx`'s
   * countdown form pins with it when its PIN switch is on; `Countdowns.tsx`'s
   * ADD button has always discarded it; and the countdown template shelf,
   * third and newest, discards it too. Dropping a template makes a clock and
   * pins nothing, because a GM dropping the third clock of the evening has not
   * asked for the top bar to change. It is otherwise this exact call - a clock
   * made from a template is indistinguishable from one typed into either form
   * the moment it exists, which is what `src/ui/gm/countdownTemplates.ts` means
   * by an instance.
   */
  /**
   * `more` carries what `CAMPAIGN_SCHEMA_VERSION` 3 added — the Activation /
   * Advancement / Effect triad, the owner, and the per-tick beats.
   *
   * One optional bag rather than five more positional parameters, because five
   * strings in a row at a call site is how the owner ends up in the effect. It
   * is optional because a clock with none of them is still a clock: every one
   * of the five defaults to empty, which is exactly what every countdown
   * written before schema 3 holds.
   */
  addCountdown: (
    name: string,
    kind: CountdownKind,
    start: number,
    more?: Partial<Pick<Countdown, 'activation' | 'advancement' | 'effect' | 'owner' | 'beats'>>,
  ) => string;
  advanceCountdown: (id: string, delta: number) => void;
  /**
   * The sentence for one tick of a long-term clock.
   *
   * `Countdown.beats` has been persisted and read since schema 3 and nothing
   * has ever written one. `shared/types.ts` describes the case in as many
   * words: *"A rest that advances a long-term countdown should produce a
   * sentence to narrate, not a decrement."* Index 0 is the first tick.
   *
   * Writing past the end fills the gap with `''` rather than refusing, because
   * a GM who writes the beat for tick four before the beat for tick two has not
   * made a mistake - the array is sparse in practice and `readCountdown` says
   * so. Both bounds are the reader's own, imported rather than restated: a
   * writer that let through more than the reader keeps would hand back cut text
   * on the next load, with the GM's own words as the thing that changed.
   */
  writeCountdownBeat: (id: string, index: number, text: string) => void;
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
  liveScene: c.board.liveScene,
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
    liveScene: live.liveScene,
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
 * Campaigns that are **not** the open one and differ from what is on the disk.
 *
 * `dirty` answers that question for the board, and the board is only ever the
 * active campaign - `writeActive` gathers `activeCampaignId` and nothing else.
 * So until this set existed there was no way to write a record the GM was not
 * looking at, and two callers needed one:
 *
 *   - `renameCampaign` on a campaign that is not open. `patchCampaign` changed
 *     the list in memory and scheduled nothing, so the new name sat in the
 *     window looking right and was gone on the next reload. MENU still offers
 *     the field on the open campaign alone, but that is now an ergonomic
 *     decision with its reason on the screen rather than a wall around a write
 *     that could not land - see `MenuSheet.tsx`.
 *   - the records `readCampaigns` repaired on the way in. They were computed,
 *     returned and dropped, so the same repair ran on every launch.
 *
 * Ids rather than records, so the write takes whatever the list holds when the
 * flush runs instead of a snapshot taken 400 ms earlier.
 */
const aside = new Set<string>();

function armFlush(): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushGm();
  }, 400);
}

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
  queue = queue.then(writeAll, writeAll);
  return queue;
}

/**
 * The records nobody is looking at first, then the board.
 *
 * That order is not arbitrary. `writeAside` can hand a repaired record back to
 * the board's own writer by setting `dirty` - a repaired *active* campaign has
 * to go through `gather`, or the write would put back the record as it was
 * read and lose whatever the GM has done since. And `writeActive` clears
 * `writeError` when it succeeds, so an aside failure has to be reported after
 * it or a successful board write would wipe the sentence off the screen.
 */
async function writeAll(): Promise<void> {
  const hadAside = aside.size > 0;
  const asideError = await writeAside();
  await writeActive();

  if (asideError !== null) {
    useGm.setState({ writeError: asideError, writeRetry: 'write' });
    return;
  }
  /*
   * Clear it here too, or the retry works and the screen keeps the sentence.
   *
   * `writeActive` is what normally takes the strip down, and it only does so
   * when *it* writes something. An aside failure can happen with a board that
   * is perfectly clean - a rename of another campaign is not a change to this
   * one - so the next flush would land the rename and leave "could not be
   * written" on screen for the rest of the evening. A sentence the code has
   * already disproved is the defect this app is written against.
   *
   * `!dirty` because a board write that just failed has set its own sentence
   * and must keep it; `writeRetry === 'write'` because a read failure is not
   * ours to clear - there `retryGm` reads again, and a flush cannot help.
   */
  if (hadAside && !dirty && useGm.getState().writeRetry === 'write') {
    useGm.setState({ writeError: null, writeRetry: null });
  }
}

/**
 * Write the campaigns that are not open, and say so if one will not go.
 *
 * Left in the set on failure, exactly as `dirty` is left true: the next change
 * or the next `pagehide` tries again. The sentence has to say which campaign,
 * because this is the one write whose subject is not on the screen - "what is
 * on this screen is only in this tab" would be false and, worse, would point
 * the GM at the wrong board.
 */
async function writeAside(): Promise<string | null> {
  if (aside.size === 0) return null;
  const state = useGm.getState();
  let failure: string | null = null;

  for (const id of [...aside]) {
    if (id === state.activeCampaignId) {
      // The board's writer owns this one; a bare `put` here would write the
      // record as stored over a live board that has moved on.
      aside.delete(id);
      dirty = true;
      continue;
    }
    const record = state.campaigns.find((c) => c.id === id);
    if (record === undefined) {
      // Removed while it was waiting. Nothing to write and nothing wrong.
      aside.delete(id);
      continue;
    }
    try {
      await putCampaign(record);
      aside.delete(id);
    } catch (error) {
      failure =
        `"${record.name || 'A campaign'}" could not be written to this device's storage` +
        (error instanceof Error ? ` (${error.message})` : '') +
        '. It is not the campaign open here, so nothing on this screen shows it: the change is ' +
        'only in this tab.';
    }
  }
  return failure;
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
      writeRetry: null,
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
      writeRetry: 'write',
    });
  }
}

function schedule(): void {
  dirty = true;
  if (useGm.getState().activeCampaignId === null) return;
  armFlush();
}

/**
 * Queue a campaign that is not the open one.
 *
 * No `activeCampaignId === null` guard, which `schedule` has and needs: this
 * write does not go through `gather` and does not care whether a board is
 * open, so a device with nothing open must still be able to write a repaired
 * record back.
 */
function scheduleAside(id: string): void {
  aside.add(id);
  armFlush();
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
      /*
       * Persist what the reader repaired, once, here - the same move
       * `state.ts:364` makes for characters, and for the same reason.
       *
       * `readCampaigns` has always returned `repaired`, and nothing has ever
       * read it: a converted or repaired record went back into memory and
       * never onto the disk, so the identical repair ran again on the next
       * launch, and every launch after that. The notices it produces are in
       * MENU rather than in a banner *because* they recur, which is a
       * workaround dressed as a design.
       *
       * Through the debounce rather than a bare `void putCampaign(c)`, again
       * as `state.ts` does: a rejection on a bare call is swallowed, and this
       * one has a sentence to reach. Not awaited into hydration - a slow write
       * must not hold up the first paint of the GM screen.
       */
      for (const c of read.repaired) scheduleAside(c.id);
    } catch (error) {
      /*
       * The board still works in memory; it just will not be written. Saying
       * so is the whole point - the old code caught this and said nothing.
       *
       * `'read'` rather than `'write'`, because a flush is inert on this path
       * forever: there are no campaigns and `activeCampaignId` is null, so
       * `writeActive` returns at `base === undefined` every time. Reading
       * again is the only thing that can help, and `retryGm` is what does it.
       */
      useGm.setState({
        hydrated: true,
        writeError: `This device’s storage could not be read (${
          error instanceof Error ? error.message : String(error)
        }), so nothing on this screen is being saved.`,
        writeRetry: 'read',
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
          writeRetry: 'write',
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
      /*
       * A read that worked clears the last one that did not, and only that.
       * On the first hydration of a tab this is a no-op; it matters when this
       * run *is* the retry of a failed read, where leaving the sentence up
       * over a campaign that has just arrived would be the alarm outliving the
       * failure. It cannot be unconditional: the first-write failure above set
       * `writeError` a few lines ago and that one is still true.
       */
      ...(firstWriteFailed ? {} : { writeError: null, writeRetry: null }),
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

/**
 * TRY AGAIN, wherever it is drawn.
 *
 * One function rather than a `flushGm` in each of the three surfaces that draw
 * it - the GM strip, SAVE, and the shell block on every other screen - because
 * "what would fix this" is a property of the failure and the store is the only
 * thing that knows which failure it was. The docblock on `NotSaved` used to
 * claim `flushGm` "does something on every path that sets this field"; it does
 * something on the paths that leave the store dirty, and the read failure is
 * not one of them - there `activeCampaignId` is null, `writeActive` returns at
 * `base === undefined`, and the only thing that can help is reading again.
 *
 * A `null` retry never reaches here, because no surface draws the button for
 * one; if one ever does, a flush is the harmless answer.
 *
 * ## It answers whether it worked
 *
 * `true` means the failure is gone. That used to be each surface's own job -
 * `retryGm().finally(() => setFailedAgain(useGm.getState().writeError !== null))`,
 * written out three times - and the third surface cannot do it at all: the
 * shell has no access to this store and must not acquire one. So the reading is
 * taken here, on both settlements, which is exactly what `.finally` plus a
 * re-read amounted to. `hydrateGm` can reject - `migrateLegacyGmState` is
 * awaited outside its `try` - so the rejected path is a real one and not
 * ceremony.
 */
export function retryGm(): Promise<boolean> {
  const landed = (): boolean => useGm.getState().writeError === null;
  if (useGm.getState().writeRetry !== 'read') return flushGm().then(landed, landed);
  /*
   * The memo is dropped here rather than in the failing branch, because this
   * is the one caller that means "again". `hydrateGm` is idempotent so that a
   * second arrival joins the first, and a retry that joined a settled, failed
   * promise would report the same failure for the life of the tab.
   */
  hydration = null;
  return hydrateGm().then(landed, landed);
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

  /**
   * Patch the campaign list, and get the patch onto the disk either way.
   *
   * The `else` is the fix. `schedule` marks the *board* dirty and `writeActive`
   * gathers the active campaign, so for any other id this used to change the
   * list in memory and schedule nothing: the patch looked applied for as long
   * as the window stayed open and was gone on the next reload. `renameCampaign`
   * is the only caller that can reach that branch today, and MENU still offers
   * the field on the open campaign alone - not because the write cannot land
   * any more, but because a third target on a campaign row costs the name more
   * width than a rename saves gestures. The row is exactly the sheet's 363.00
   * column - measured in Chrome at 393x852 - and its border and padding come
   * out of that, so the name button already has only 277.00 beside a 62.00
   * REMOVE. That reason is on the screen and argued in `MenuSheet.tsx`, which
   * holds the whole measurement; this branch exists so that the day it changes,
   * nothing here has to.
   */
  const patchCampaign = (id: string, patch: Partial<Campaign>): void => {
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    if (get().activeCampaignId === id) schedule();
    else scheduleAside(id);
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
    writeRetry: null,
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

    addCountdown(name, kind, start, more) {
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
            // The campaign's, like every clock ADD mints. Scope is chosen on
            // the row afterwards, for the reason this literal's own note
            // gives about the triad: a default written in two places is one
            // that goes stale in the place nobody reads.
            sceneId: null,
            // The item's id and the countdown's are the same on purpose: every
            // screen that has ever drawn a countdown holds the countdown's id,
            // and a second identifier would be a second thing to keep in step.
            countdown: {
              id,
              name,
              kind,
              start: value,
              value,
              notes: '',
              // Every one of the five defaults to empty rather than absent.
              // `readCountdown` would supply the same defaults on the next
              // read, but a row that is briefly missing them in memory is a
              // row whose shape differs from the one a reload produces, and
              // that difference is where "works until you refresh" lives.
              activation: more?.activation ?? '',
              advancement: more?.advancement ?? '',
              effect: more?.effect ?? '',
              owner: more?.owner ?? '',
              beats: [...(more?.beats ?? [])],
            },
          },
        ],
      });
      return id;
    },

    advanceCountdown(id, delta) {
      commit({ session: withCountdown(id, (c) => tickCountdown(c, delta)) });
    },

    writeCountdownBeat(id, index, text) {
      const at = Math.floor(index);
      if (!Number.isFinite(at) || at < 0 || at >= COUNTDOWN_BEATS_MAX) return;
      commit({
        session: withCountdown(id, (c) => {
          const beats = [...c.beats];
          while (beats.length <= at) beats.push('');
          beats[at] = text.slice(0, COUNTDOWN_TEXT_MAX);
          return { ...c, beats: beats.slice(0, COUNTDOWN_BEATS_MAX) };
        }),
      });
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
      /*
       * The name is minted against the list, not taken on trust.
       *
       * NEW CAMPAIGN passes nothing, so every campaign made from MENU used to
       * arrive as `FIRST_CAMPAIGN_NAME` - press it twice and the list holds two
       * rows reading "My campaign", which is the same failure two characters
       * called Ilya are in the header's `<select>`: a list you cannot pick out
       * of. `freeName` counts up instead, so the second is "My campaign (2)".
       *
       * A mint and not a refusal, and the difference is who typed it. Nobody
       * typed this: the door that *does* take a typed name is MENU's rename
       * field, and that one refuses in words and offers rather than rewriting.
       * See `names.ts` for the rule both of them read.
       */
      const campaign = newCampaign(
        freeName((name ?? '').trim() || FIRST_CAMPAIGN_NAME, get().campaigns, CAMPAIGN_NAMES),
        at,
        crypto.randomUUID(),
      );
      let failed = false;
      try {
        await putCampaign(campaign);
      } catch (error) {
        failed = true;
        set({
          writeError:
            error instanceof Error
              ? `That campaign could not be saved (${error.message}), so it only exists in this tab.`
              : 'That campaign could not be saved, so it only exists in this tab.',
          writeRetry: 'write',
        });
      }
      set({
        campaigns: [campaign, ...get().campaigns],
        activeCampaignId: campaign.id,
        ...spread(campaign),
      });
      /*
       * Left dirty, and after the `set` that makes it the open one - exactly
       * what `hydrateGm` does for the first campaign of a device, and for the
       * same reason. `dirty` answers "is what is in memory anywhere else yet",
       * and for a campaign whose write threw the answer is no. Without this
       * line the next flush returns at `if (!dirty)`, so the retry the strip
       * offers writes nothing, `pagehide` writes nothing, and the campaign
       * survives only because some later unrelated change happens to carry it.
       *
       * AND IT IS MADE ACTIVE EVEN THOUGH THE WRITE FAILED, which the backlog
       * filed as a defect and which is a decision, re-examined on 2026-08-18
       * and kept. It used to be forced: leaving the GM on the old board left
       * the new campaign unwritable, because nothing could write a campaign
       * that was not open. `aside` can now, so for the first time the other
       * behaviour is buildable - and it is still not the better one. The tap
       * said NEW CAMPAIGN and a board arrives; the failure is a sentence on
       * that board rather than a screen that did not change, which reads as
       * the tap having been ignored. Nothing is at risk either way: the
       * campaign being left lands first, on the `flushGm` at the top of this
       * function, so the only thing the failure can cost is a campaign that
       * has nothing in it yet. Do not re-open this as "the campaign is made
       * active either way" - that is true, and it is the answer.
       */
      if (failed) dirty = true;
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

    /**
     * Write a name the door already judged.
     *
     * No uniqueness check here, and that is the same shape `state.update` has
     * for a character: the rule belongs in front of the person typing, where a
     * refusal can be a sentence and an offer, and a store that silently
     * substituted a different name would be the rewrite the door refuses to
     * make. `MenuSheet`'s field asks `judgeName` before this is reachable.
     */
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
        // Nothing waiting can be about a record that is gone. `writeAside`
        // drops an id whose record has left the list anyway; this is the
        // cheaper half of the same statement, made where the delete succeeds.
        aside.delete(id);
      } catch (error) {
        /*
         * No retry, and the sentence says what to do instead.
         *
         * Nothing in this store can retry a delete: `flushGm` writes the open
         * campaign, which is not what failed and, when the doomed one *is* the
         * open one, is the opposite of what was asked for. What did happen is
         * nothing at all - the record is untouched and still in the list - so
         * the control that retries this is the REMOVE the GM already has.
         */
        set({
          writeError:
            error instanceof Error
              ? `That campaign could not be deleted (${error.message}). It is still on this device and still in the list, and nothing else has changed — REMOVE tries again.`
              : 'That campaign could not be deleted. It is still on this device and still in the list, and nothing else has changed — REMOVE tries again.',
          writeRetry: null,
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
 * The failure, forwarded to the shell, from one place.
 *
 * A subscription rather than a call beside each `setState`, and that is the
 * whole of the design. Six paths in this file set `writeError` - the aside
 * write, the board write, the failed read, the first campaign of a device,
 * `createCampaign` and `removeCampaign` - and four of them clear it again. A
 * seventh will be written by somebody who has never read this comment, and a
 * publish they forget is a sentence that reaches the GM screen and no other. So
 * the mirror hangs off the field instead of off its writers, and cannot be
 * forgotten.
 *
 * Registered before `hydrateGm()` on the last line of this file, because that
 * call is one of the six.
 *
 * `retryGm` is handed over as-is: the dispatch between a flush and a second
 * read stays in here, where the failure is known, and the shell decides only
 * whether `retry` is null - which is the difference between a button and the
 * store's sentence naming the control that does help instead.
 */
useGm.subscribe((state, previous) => {
  if (state.writeError === previous.writeError && state.writeRetry === previous.writeRetry) return;
  publishCampaignAlert(
    state.writeError === null
      ? null
      : { message: state.writeError, retry: state.writeRetry, tryAgain: retryGm },
  );
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
