/**
 * The GM's own state, and the campaign it belongs to.
 *
 * This file used to open by arguing that a scene is not a character and could
 * therefore live in localStorage, written synchronously on every change. Half
 * of that was true and half of it was never checked. What is actually in here
 * is the Fear pool, every countdown, the whole session list - which is where
 * the live fight lives, on the scene row it is fought in - and the party
 * board, which holds *whole copies of the players' character sheets*,
 * deliberately, for the reason `party.ts` gives. Keeping those in the
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
 * The screens above this file did not change when the campaign arrived under
 * them. Every field they read then - `fear`, `countdowns`, `combatants`,
 * `party` and the rest - kept its name and its shape, and only the place it
 * was written moved.
 *
 * `combatants` is the one of those that has since stopped being a field of
 * this store at all. Campaign schema 5 put the fight on the scene row it is
 * fought in, so there is no board-wide combatant list left to read: the runner
 * asks `openCombatants` for the fight in the row `openScene` names, and every
 * writer of a fight is addressed by `(sceneId, id)`. What the board still
 * holds is the builder's workbench - `region`, `partyTier`, `roster`,
 * `adjustments`, `environmentRef` - plus `openScene`, which is navigation and
 * not ownership. `countdowns` is the one field that is
 * derived rather than stored: countdowns are rows of the session list, because
 * that is where the wireframe draws them, and keeping a second array beside
 * the list would be two things to hold in step. It is recomputed in `commit`,
 * which is the single write path, so it cannot drift.
 */
import { create } from 'zustand';
import {
  COUNTDOWN_BEATS_MAX,
  COUNTDOWN_TEXT_MAX,
  combatantsIn,
  countdownsOf,
  emptyBoard,
  environmentIn,
  newCampaign,
  withPrimaryCountdown,
  withSceneScope,
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
import { noteCampaignCopy } from '../../store/backup.ts';
import { deleteCampaign, putCampaign, readCampaigns } from '../../store/campaigns.ts';
import { publishCampaignSource, type CampaignSnapshot } from '../../store/campaignSource.ts';
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
// No cycle: `session.ts` imports only from `shared/` and `engine/`.
import { newScene } from './session.ts';

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

  /**
   * Put `times` copies of an adversary into one scene row's fight.
   *
   * `sceneId` first, and on all four of these verbs, because that is the whole
   * address of a combatant now: `SceneCombatant.id` is unique inside its row
   * and means nothing outside it, so a writer that took an id alone would have
   * to guess which fight it meant. The compiler asks every caller the question
   * instead.
   *
   * TOTAL, AND IT MINTS NOTHING. An id that names no `kind: 'scene'` row
   * commits nothing at all. The verb that makes a row to fight in is
   * `openNewScene`, it is a separate tap with its own label, and the split is
   * the point: a store that minted a home behind the GM's back is how a fight
   * used to end up on a board belonging to nobody, unnameable and undrawable
   * on the plan.
   *
   * The free index is scanned over THAT ROW's array only - the same scope the
   * board scan had when there was one array, now stated rather than accidental.
   * Two rows may each hold an `acid-burrower-0`; `SessionItem`'s row-local id
   * invariant says so in as many words.
   */
  spawn: (sceneId: string, adversary: Adversary, partySize: number, times?: number) => void;
  patchCombatant: (sceneId: string, id: string, patch: Partial<SceneCombatant>) => void;
  removeCombatant: (sceneId: string, id: string) => void;
  /**
   * Empty one row's fight, and leave the runner where it is.
   *
   * `openScene` is deliberately untouched: ending the fight in the Foresta
   * leaves you looking at the Foresta. It used to clear the pointer too, and
   * its own words were "the board is empty and belongs to no row" - true while
   * the pointer meant ownership of a fight that lived somewhere else. It means
   * navigation now, and a GM who ends a fight has not asked to leave the
   * scene.
   */
  clearScene: (sceneId: string) => void;
  /**
   * Point the runner at a scene row, or at none.
   *
   * Navigation, and one string written. It does NOT set `region`, and that is
   * a division of labour rather than an omission: opening the runner is the
   * caller's `onOpenTool('scene')`, and keeping the two apart is what lets a
   * switcher chip change which fight is drawn without moving the screen
   * underneath it. A door that wants both does both, in that order.
   *
   * Refuses an id that names no `kind: 'scene'` row, so nothing in this store
   * can leave `openScene` dangling. `null` always lands - it is how the runner
   * is closed.
   */
  showScene: (sceneId: string | null) => void;
  /**
   * Mint a scene row, open it, and hand back its id. One commit.
   *
   * The id comes back for the same reason `addCountdown`'s does: a caller that
   * has to do something to the row it just made - `spawn` into it - has no
   * other way to name it, and reading `session.at(-1)` would be the caller
   * holding an opinion about how this function appends.
   *
   * It takes the board's `environmentRef`, which is what `newScene` does for
   * every other door that mints a row. That is the builder's place being
   * offered to a scene that has none yet, not the board owning anything: the
   * row can be given a different one, and from then on the row's is what the
   * runner draws.
   */
  openNewScene: (name?: string) => string;

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
  /**
   * Give a countdown row to a scene, or hand it back to the campaign.
   *
   * Scope changes reach and attention, never arithmetic. Nothing here ticks:
   * "a countdown that ticks on its own is one you stop trusting", and a clock
   * moving because a scene started would be exactly that. It is the first
   * optimisation somebody will propose, so it is refused here in writing.
   */
  setCountdownScene: (rowId: string, sceneId: string | null) => void;

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
  environmentRef: c.board.environmentRef,
  openScene: c.board.openScene,
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
    environmentRef: live.environmentRef,
    openScene: live.openScene,
  },
});

/**
 * The fight the runner is showing, and the place it is being fought in.
 *
 * Both read the open row and nothing else. There is no board array behind
 * either of them to disagree with, which is the whole of what schema 5 bought,
 * and neither falls back to the board: `board.environmentRef` is the builder's
 * workbench, and a runner that borrowed it would open a fight silently in the
 * *previous* scene's place - the defect the scene row absorbed the fight to
 * close. `environmentIn`'s own docblock carries that argument.
 *
 * Referentially stable while `openScene` and the row are: `combatantsIn`
 * returns the row's OWN array, never a copy, and one shared empty array for
 * the two ways of having no fight. That is load-bearing rather than tidy -
 * zustand 5 memoizes no selector, so a fresh `[]` here would repaint the
 * runner on every `+1` of Fear - and it holds only while every writer of a
 * fight rebuilds the array instead of marking it in place. In this store there
 * is exactly one such writer, `withSceneFight`, and it rebuilds by spread.
 */
export const openCombatants = (s: GmState): SceneCombatant[] =>
  combatantsIn(s.session, s.openScene);

export const openEnvironment = (s: GmState): Ref | null =>
  environmentIn(s.session, s.openScene);

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
 * that is still in flight.
 *
 * **Ordering, and not safety.** Awaiting this proves the write was *attempted*,
 * never that it landed: `writeActive` catches its own rejection, so this
 * resolves on the failing evening exactly as it does on the ordinary one, with
 * `dirty` still true and `state.campaigns` still holding the record from before
 * the failure. Every caller that follows a flush with something irreversible
 * has to read `dirty` or `writeError` itself, and all four in this file now
 * do. `exportActiveCampaign` reads `dirty` and folds the live board into the
 * record it serializes. `switchCampaign` and `createCampaign` both `spread` a
 * different campaign over the live board immediately afterwards, and both call
 * `keepUnlandedBoard` first - one step, holding the reading of `dirty` for the
 * pair of them, where a KNOWN DEFECT notice used to stand instead of a call.
 * `removeCampaign` spreads only when the record it just deleted was the open
 * one, so the board it discards belongs to a campaign the GM asked to be rid
 * of. The fifth awaiting caller is
 * outside this file - `TakeIn`'s `bringIn` - and it is add-only: it writes a new
 * key and never over one, so a flush that did not land costs it nothing it was
 * promising.
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
 * Every campaign as it stands right now, with the live board folded into the
 * open one, and the records this build must not touch named beside them.
 *
 * This is what the automatic backup writes, and it is memory rather than the
 * disk for one reason that is the whole design: `writeActive` updates
 * `state.campaigns` only inside the `try` *after* `putCampaign` resolves, and on
 * a throw deliberately leaves `dirty` true. So on the evening writes are failing
 * - a full disk, an older build refusing a newer record, which is exactly the
 * work about to be lost - a flush cannot make the disk fresh, and a
 * disk-sourced backup would write the stale record, verify it happily (it is a
 * valid `.dhcampaign` of the wrong record) and stamp "last backup: today" over
 * an evening that exists nowhere.
 *
 * `exportActiveCampaign` composes the same record for the same reason, one
 * campaign at a time. The two legs of the net must not be able to disagree
 * about what tonight was: a hand-save reading `state.campaigns` straight would
 * hand the GM the record from before the failed write under "Saved as …", which
 * is this fatal wearing the other leg's clothes.
 *
 * It lives here and can live nowhere else: `gather` and `dirty` are both
 * module-private, and `backup.ts` may not import this file. It is published
 * through `store/campaignSource.ts` instead, from this file's module-scope
 * epilogue, beside the alert publisher that inverts the same edge for the other
 * half of this problem.
 *
 * **`c.updatedAt`, not a fresh stamp, and that is not a shortcut.**
 * `writeActive` stamps `new Date().toISOString()` at the moment the record
 * actually reaches the disk. Inventing a different time here would put a time
 * in the backup file that no write ever happened at. It is also what forces the
 * backup's skip gate to be `campaignChecksum` rather than `updatedAt`: a
 * gathered dirty snapshot keeps that field still on purpose, so an `updatedAt`
 * fingerprint would be blind to precisely the board the GM has been editing.
 */
export function snapshotCampaigns(): CampaignSnapshot | null {
  const state = useGm.getState();
  /*
   * Null, not an empty list, while this store has nothing to say.
   *
   * `hydrateGm` sets `hydrated: true` on a read that *failed* as well as on one
   * that worked - deliberately, so the screen stops waiting and says what went
   * wrong - and leaves `campaigns` empty with `writeRetry: 'read'`. An empty
   * list handed to the backup there would read as "this device has no
   * campaigns" and quietly take every one of them out of the folder, on exactly
   * the launch where storage is already misbehaving. The seam falls back to the
   * disk instead.
   *
   * Only `'read'`. A `'write'` failure is the case this whole function exists
   * for: the disk is stale and memory is the only copy of the evening.
   */
  if (!state.hydrated || state.writeRetry === 'read') return null;
  return {
    campaigns: state.campaigns.map((c) =>
      c.id === state.activeCampaignId && dirty ? gather(c, state, c.updatedAt) : c,
    ),
    quarantined: state.quarantined.map(({ id, name }) => ({ id, name })),
  };
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

  /**
   * THE ONLY FUNCTION IN THIS STORE THAT WRITES A SCENE ROW'S COMBATANTS.
   *
   * Total: an id that names no `kind: 'scene'` row commits nothing, so no verb
   * above has to guard for itself and none of them can mint a home by accident.
   *
   * It rebuilds only the row it changes. Every other row keeps its object
   * identity, so the plan list does not re-render under an HP tap - and the
   * row it does change gets a NEW array, never a marked one, which is the
   * precondition `combatantsIn` is written against. One writer is what makes
   * that discipline checkable: `patchSessionItem` strips `combatants` out of a
   * general row patch for the same reason.
   */
  const withSceneFight = (
    sceneId: string,
    f: (row: Extract<SessionItem, { kind: 'scene' }>) => SceneCombatant[],
  ): void => {
    const session = get().session;
    if (!session.some((i) => i.kind === 'scene' && i.id === sceneId)) return;
    commit({
      session: session.map((i) =>
        i.kind === 'scene' && i.id === sceneId ? { ...i, combatants: f(i) } : i,
      ),
    });
  };

  /**
   * Put the live board into `campaigns` before something spreads over it.
   *
   * THE REPAIR OF THE DEFECT `switchCampaign`'s docblock used to merely name.
   * Both doors that replace the whole live board with another campaign's -
   * MENU's campaign row and BRING IT IN through `switchCampaign`, NEW CAMPAIGN
   * through `createCampaign` - `await flushGm()` first, and that await proves
   * the write was *attempted*, never that it landed. `writeActive` catches its
   * own rejection, assigns `state.campaigns` only inside the `try`, and leaves
   * `dirty` true. So on the evening writes are failing - a full disk, an older
   * build refusing a newer record - the flush changed nothing and the `spread`
   * that followed threw the evening away with nothing on the glass to say so.
   *
   * `dirty` is the whole test, and it is the honest one: it is the same field
   * `snapshotCampaigns` and `exportActiveCampaign` already read to decide that
   * memory is ahead of the disk. When it is false there is nothing to keep and
   * this does nothing, so the ordinary evening pays one boolean.
   *
   * ONE STEP, CALLED BY BOTH DOORS, which is not a style preference. A fix
   * applied to `switchCampaign` alone would close MENU and BRING IT IN and
   * leave NEW CAMPAIGN open - the half-repair the old notice existed to refuse.
   * Two mutants hold it: delete the fold and both doors go red; delete one of
   * the two call sites and only that door does.
   *
   * NOT PUT INSIDE `flushGm` INSTEAD, though both doors share that too.
   * `flushGm` has five callers and three of them must not do this: `pagehide`
   * and `visibilitychange` are not leaving the campaign at all,
   * `removeCampaign` would be preserving a board the GM asked to be rid of, and
   * `exportActiveCampaign` already folds the same board itself without touching
   * the list. It would also fire on every 400 ms debounce of a failing evening,
   * handing `writeAside` an id that is still the active one - which it
   * correctly refuses, setting `dirty` back to true and undoing the work. The
   * doors are where the loss happens, so the doors are where this goes.
   *
   * `c.updatedAt`, never a fresh stamp, for `snapshotCampaigns`' reason:
   * `writeActive` stamps the moment a record actually reaches the disk, and a
   * time invented here would be a time no write ever happened at.
   *
   * `dirty` IS CLEARED, and the guarantee is transferred rather than dropped.
   * What `dirty` promised was "this board is not on the disk, try again"; after
   * this the board is inside `campaigns` and the id is inside `aside`, and
   * `writeAside` leaves a failed id in the set exactly as `dirty` stayed true -
   * the same retry, on the same flush, from the next change or the next
   * `pagehide`. It also buys a truer sentence: `writeAside`'s failure names the
   * campaign, and this board is no longer the one on the screen. Leaving it
   * true would be worse than redundant - the next `writeActive` would `gather`
   * the campaign that just ARRIVED, which nobody has edited, and stamp it with
   * a write time it did not earn. `createCampaign` sets it again afterwards
   * when its own `putCampaign` threw; that line is about the new campaign, not
   * this one.
   *
   * Scheduled BEFORE the switch, which only reads as unsafe: `writeAside` skips
   * an id equal to the active one, and by the time the armed flush runs this id
   * is no longer active, because the `set` that spreads follows with no `await`
   * between.
   */
  const keepUnlandedBoard = (): void => {
    if (!dirty) return;
    const id = get().activeCampaignId;
    if (id === null || !get().campaigns.some((c) => c.id === id)) return;
    set((prev) => ({
      campaigns: prev.campaigns.map((c) => (c.id === id ? gather(c, prev, c.updatedAt) : c)),
    }));
    scheduleAside(id);
    dirty = false;
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

    spawn(sceneId, adversary, partySize, times = 1) {
      withSceneFight(sceneId, (row) => {
        const combatants = [...row.combatants];
        // makeCombatant derives the id from an index; find free ones so a
        // second Acid Burrower cannot collide with the first in THIS row. Ids
        // are row-local, so a collision with another row's is not one.
        let index = 0;
        for (let n = 0; n < times; n += 1) {
          while (combatants.some((c) => c.id === `${adversary.id}-${index}`)) index += 1;
          combatants.push(makeCombatant(adversary, index, partySize));
          index += 1;
        }
        return combatants;
      });
    },

    patchCombatant(sceneId, id, patch) {
      withSceneFight(sceneId, (row) =>
        row.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },

    removeCombatant: (sceneId, id) =>
      withSceneFight(sceneId, (row) => row.combatants.filter((c) => c.id !== id)),

    /*
     * END SCENE empties the row, which is now the only place there is to empty,
     * and leaves `openScene` alone.
     *
     * This comment used to argue the opposite half - that emptying the board
     * was not enough, because a parked copy on the row would have the dead all
     * standing again after a flip. There is no second copy to fall out of step
     * any more, so the argument is retired rather than restated: one write to
     * one array ends the fight everywhere it was.
     *
     * What is deliberate is what does NOT happen. The pointer stays, so the
     * runner keeps drawing the scene whose fight just ended - the GM said
     * "this fight is over", not "take me away from this table".
     */
    clearScene: (sceneId) => withSceneFight(sceneId, () => []),

    showScene(sceneId) {
      /*
       * Refused rather than written, and refused HERE rather than repaired on
       * the way back off the disk.
       *
       * `readCampaignRecord` nulls a dangling pointer in silence on load,
       * because a hand-edited file is not the app's fault. A dangling pointer
       * written by this store would be: `liveScenes` would draw no chip for it
       * and the runner would show an empty scene that the plan does not list.
       */
      if (sceneId !== null && !get().session.some((i) => i.kind === 'scene' && i.id === sceneId))
        return;
      commit({ openScene: sceneId });
    },

    openNewScene(name) {
      const s = get();
      const row = newScene(name ?? '', s.environmentRef);
      /*
       * ONE commit for the mint and the open together. Two would leave a frame
       * with a row on the plan that the runner is not showing, and the whole
       * point of this verb is that the GM taps once and arrives somewhere.
       *
       * An empty name is legal and `sessionTitle` draws it as SCENE. That is
       * the difference between this and the mint schema 4 did as a side effect
       * of a flip: this one was asked for by a labelled button, and the row it
       * makes is renameable while the GM is still looking at it.
       */
      commit({
        session: [...s.session, { ...row, order: s.session.length }],
        openScene: row.id,
      });
      return row.id;
    },

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

    setCountdownScene(rowId, sceneId) {
      commit({ session: withSceneScope(get().session, rowId, sceneId) });
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
          //
          // Neither is the fight, and for a sharper reason. `withSceneFight` is
          // the one writer of a row's combatants, and "one writer" is not a
          // tidiness claim - `combatantsIn` hands the runner the row's own
          // array by reference, so its identity is what decides whether the
          // whole runner repaints, and a caller reaching a fight through a
          // general row patcher is exactly the shape that puts a marked array,
          // or another row's array, onto a row. A patch that carries
          // `combatants` is not refused, it is stripped: the rest of what it
          // asked for is ordinary row editing and still lands.
          //
          // `'combatants' in item` and not `item.kind === 'scene'`, which is
          // one clause wider than the change that brought this line. Two arms
          // of `SessionItem` carry a fight - `scene` and the legacy
          // `encounter` - and `withSceneFight` can rebuild only the first, so
          // an `encounter` row's marks are the ones with no writer to put them
          // back. Naming the kind would have left exactly those reachable, and
          // would go stale in silence the day a third arm carries a fight.
          // Rows that hold none spread nothing and are untouched.
          item.id === id
            ? ({
                ...item,
                ...patch,
                kind: item.kind,
                ...('combatants' in item ? { combatants: item.combatants } : {}),
              } as SessionItem)
            : item,
        ),
      });
    },

    removeSessionItem(id) {
      const s = get();
      commit({
        session: s.session
          .filter((item) => item.id !== id)
          /*
           * A clock that belonged to the deleted row becomes the campaign's, in
           * the same commit. Without it the clock would be invisible until the
           * next time some scene happened to be run - the reader repairs a
           * dangling scope on the way in from disk, but that is cold, and this
           * is a GM deleting a row with the app open.
           *
           * Never re-pinned. A countdown does not become the one on the top bar
           * because of a deletion.
           */
          .map((item, order) =>
            item.kind === 'countdown' && item.sceneId === id
              ? { ...item, order, sceneId: null }
              : { ...item, order },
          ),
        /*
         * THE FIGHT GOES WITH THE ROW. This clause used to say the opposite,
         * and the inversion is the change, not a tidy-up.
         *
         * Under schema 4 the fight was on the board and the row only pointed at
         * it, so deleting a row had to keep the fight and drop the pointer -
         * "the GM deleted a row of the plan; they did not ask to end a fight" -
         * and what was left was a fight belonging to nobody, which the next
         * flip had to mint a home for. Schema 5 deleted that state. A scene
         * row's `combatants` IS the fight, so deleting the row deletes it, in
         * the `filter` above and with no clause of its own.
         *
         * That is what the control has always said: `SessionRow.tsx` arms this
         * delete as TAP AGAIN TO DELETE THE FIGHT. The arming was already
         * written for the behaviour this line now has.
         *
         * What is left here is navigation. `openScene` names a row that no
         * longer exists, so the runner is closed rather than left pointing at
         * nothing - the same repair `readCampaignRecord` makes in silence on
         * the way in from disk, made warm, while the GM is looking at it.
         */
        ...(s.openScene === id ? { openScene: null } : {}),
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
      // The same step `switchCampaign` calls, in the same position: last thing
      // before the board is replaced. It reads `get().campaigns` after the
      // fold, so the record it folded is the one that goes into the list.
      keepUnlandedBoard();
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
       * the tap having been ignored. Do not re-open this as "the campaign is
       * made active even though its own write failed" - that is true, and it
       * is the answer.
       *
       * WHAT THIS PARAGRAPH USED TO CLAIM ALONGSIDE THAT IS FALSE, AND HAS
       * BEEN DELETED RATHER THAN SOFTENED. It said "Nothing is at risk either
       * way: the campaign being left lands first, on the `flushGm` at the top
       * of this function". The flush proves the write was *attempted*, never
       * that it landed - see `flushGm`'s own docblock - so on an evening writes
       * are failing the `spread` above discarded the live board of the campaign
       * being left, exactly as `switchCampaign` did. Measured: flush Fear 3,
       * make `putCampaign` reject, Fear 11, flush, then `createCampaign`, and
       * the leaving campaign read Fear 3 again in `state.campaigns` with
       * nothing on the glass naming the loss.
       *
       * THAT HALF IS NOW REPAIRED, in this door and in `switchCampaign` at
       * once, by the `keepUnlandedBoard()` that now stands above that `spread`. The measurement above is a
       * test rather than a memory - `tests/gm/gmStore.test.ts`, "a campaign
       * being left while writes are failing" - so it cannot quietly become
       * true again. The paragraph above it is untouched: making the campaign
       * active even though its own write failed is still the decision.
       */
      if (failed) dirty = true;
      return campaign;
    },

    /**
     * THE KNOWN DEFECT THIS DOCBLOCK USED TO NAME IS FIXED. What follows is
     * the record of it, kept rather than deleted because the defect is one
     * removed line away from being back.
     *
     * What it was: `spread` replaces every live field, and the `flushGm` above
     * proves only that the write was attempted. On an evening writes are
     * failing - a full disk, or `putCampaign` throwing `StaleBuildError`
     * because a second tab on a newer build got there first - `dirty` is still
     * true and `state.campaigns` still holds the record from before the edit,
     * so this line discarded the live board of the campaign being left, and
     * nothing on the glass said so. Not new, and not the import door's: MENU's
     * campaign row drove the same line, and a bare `switchCampaign` with no
     * import anywhere lost the same board - which is why it was not closed by
     * making `TakeIn` careful.
     *
     * What was done: `keepUnlandedBoard()`, immediately before the `set`. It
     * reads `dirty`, folds the live board back into `campaigns` through
     * `gather`, and hands the id to `scheduleAside` - the writer that exists
     * for exactly a record nobody is looking at. Its docblock carries the
     * argument for each part, including why `dirty` is cleared and why this is
     * not inside `flushGm`.
     *
     * **AND `createCampaign` CALLS THE SAME STEP.** It carried the identical
     * line and lost the identical evening. A repair applied only here would
     * have closed MENU's campaign row and BRING IT IN and left NEW CAMPAIGN
     * open, which is the shape of half-fix this notice existed to refuse - so
     * the fold is one private step both doors call, and one of the two mutants
     * that defends it deletes exactly one of the two calls.
     */
    async switchCampaign(id) {
      if (id === get().activeCampaignId) return;
      await flushGm();
      const target = get().campaigns.find((c) => c.id === id);
      // Nothing happens rather than an empty board appearing: an id that is
      // not here is a bug in the caller, not a campaign the GM has emptied.
      if (target === undefined) return;
      /*
       * After the guard, so a switch that does not happen queues no write; and
       * immediately before the `set`, with no `await` between the two, so
       * nothing can flush while this id is still the active one. `target` is
       * not the record the fold rewrites - the guard at the top of this
       * function proves the two ids differ - so it is still the record to
       * spread.
       */
      keepUnlandedBoard();
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
       *
       * **AND THE FLUSH IS NOT ENOUGH, WHICH IS THE WHOLE OF THE LINE BELOW.**
       * `writeActive` assigns `state.campaigns` only *inside* its `try`, after
       * `putCampaign` resolves, and on a throw deliberately leaves `dirty`
       * true. So on the one evening a hand-save is worth anything - a full
       * disk, an older build refusing a record a newer one wrote - the flush
       * re-enters the same rejecting write, changes nothing, and the list still
       * holds the record from before the failure. Exporting that would
       * serialize the stale record, verify its checksum happily (it is a
       * perfectly valid `.dhcampaign` of the wrong campaign) and print "Saved
       * as …" over an evening that exists nowhere - the exact fatal
       * `snapshotCampaigns` was built to close on the automatic leg, still open
       * on the manual one.
       *
       * So this reads what `snapshotCampaigns` reads: memory first, the live
       * board folded in whenever `dirty` says the disk is behind it. The two
       * legs of the net cannot then disagree about what tonight was.
       *
       * `base.updatedAt` and not a fresh stamp, for `snapshotCampaigns`' own
       * reason: `writeActive` stamps the moment a record actually reaches the
       * disk, and inventing a time here would put a time in the file that no
       * write ever happened at.
       */
      await flushGm();
      const state = get();
      const base = state.campaigns.find((c) => c.id === state.activeCampaignId);
      const campaign = base !== undefined && dirty ? gather(base, state, base.updatedAt) : base;
      if (campaign === undefined) {
        return {
          ok: false,
          route: null,
          fileName: '',
          cancelled: false,
          reason: 'There is no campaign open to export.',
        };
      }
      const result = await exportCampaign(campaign, options);
      /*
       * A copy the GM made by hand, recorded so the backup indicator can stop
       * lying to them - and recorded as a *copy*, never as a backup.
       *
       * `noteCampaignCopy` writes `{lastCopyAt, route}` and deliberately not the
       * checksum that suppresses a folder write: `saveTextFile` reads nothing
       * back, so a `download` or a `share` means the click happened, not that a
       * file exists. On iOS, where there is no folder picker and no automatic
       * backup at all, this is the only evidence the app will ever have that a
       * campaign got out of it.
       */
      if (result.ok && result.route !== null) noteCampaignCopy(campaign.id, result.route);
      return result;
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
 * The freshest campaigns, in the slot `backup.ts` reads them from.
 *
 * Here rather than in `backupDeps.ts` because the edge only runs in this
 * direction: this file starts a campaign read on its last line, and a static
 * import of it from the backup deps - which `App.tsx`, `Settings.tsx` and both
 * error boundaries pull into the first paint - would drag the lazy GM chunk and
 * that read into the launch of every player who never opens this screen.
 * `publishCampaignAlert` below is the same inversion for the other half.
 *
 * Unconditional: the seam falls back to the disk while it is empty, so the
 * campaigns of a device whose GM screen was never opened are still backed up.
 * What this line buys is that once the screen *has* been opened, the backup
 * reads the board rather than the last write that succeeded.
 */
publishCampaignSource(snapshotCampaigns);

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
