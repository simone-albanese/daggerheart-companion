/**
 * The GM screen.
 *
 * These are personal tools. There is no session, no network, no player sheet on
 * the other side of a wire - a GM opens this the way they open a notebook, and
 * the only thing it owes them is that the notebook is still open where they
 * left it after the browser dies mid-fight.
 *
 * ## What changed, and why
 *
 * It used to be five regions behind a strip of tabs: encounter, scene, party,
 * bestiary, countdowns. Every one of them worked. What none of them was is *the
 * night* - a GM runs scene one, then an encounter, then scene two, in an order
 * they decided beforehand and change on the fly, and the app made them navigate
 * a menu to reach each one.
 *
 * So the session list is the screen, and the five regions are what a row opens.
 * The record has held that list since campaigns were built; nothing had ever
 * drawn it.
 *
 * ## This file is the integrator, and holds two pieces of state
 *
 * `tool` is which of them is open over the list, or none - the five, plus the
 * two MENU opens: the SRD reference and the name generator, neither of which is
 * a thing a session row can hold, plus the merchant, which SHOW opens beside
 * the bestiary and the party board and which no row can hold either. Each one is
 * rendered inside a `GmSheet` and **unmounted** when it closes - never hidden.
 * That is not tidiness: the party board's camera - `PartyScanner.tsx`, which
 * `PartyBoard` loads lazily - opens the stream in an effect and stops it on
 * unmount, so a sheet kept alive behind `display: none` leaves the camera
 * running on a phone in a dark room. It costs the bestiary its
 * filter and the encounter builder its search on every close, which is exactly
 * what switching region cost before, so it is not a regression.
 *
 * `board.region` is the second, and it is the subtle one. Four call sites
 * outside this file already navigate by writing it - `Encounter` sends a roster
 * to the scene, `Bestiary` drops an adversary into it, `Scene`'s empty state
 * offers the other two - and all four keep working unedited because the effect
 * below follows *changes* to it. What that effect must never do is act on the
 * value it finds at mount: `emptyBoard()` sets `region: 'encounter'` and every
 * campaign record carries one, so an effect that opened whatever it read would
 * put the encounter builder over the session list every single time the GM
 * arrives - the exact five-menus behaviour this change exists to remove. Hence
 * the seeding ref, and hence the wait for `hydrated`: the region that arrives
 * from the disk a beat after mount is just as much a stored value as the one
 * that was there at mount.
 *
 * **A campaign change is that same arrival, later.** `switchCampaign`,
 * `createCampaign` and `removeCampaign` all replace `region` wholesale out of
 * the record they are opening (`spread`) or out of `emptyBoard()`, so a ref
 * that only ever seeded the *first* region read every change of table as a
 * navigation: tapping "Open A one-shot" in MENU landed the GM in whatever tool
 * that campaign had last open, and NEW CAMPAIGN landed them in the encounter
 * builder, because `emptyBoard()` says `encounter`. So the id of the table is
 * seeded beside the region, and a region that arrived with a new one is stored
 * state again rather than an instruction.
 *
 * The other guard is `offered`. A region can name a tool the GM has switched
 * off in Settings, and following it would make this the one control in the app
 * that opens something that is not there - which is exactly what the Settings
 * hint promises does not happen. A switched-off region is remembered and not
 * opened.
 *
 * `sheet` is the third, and it is the shallow one: which of the bar's three
 * verbs is answering. A sheet and a tool are never both open. That is not
 * tidiness either - `useDialog` registers one unconditional window keydown
 * listener per dialog with no topmost check, so two live at once means one
 * Escape closing both and two Tab handlers fighting over the focus. Opening
 * either closes the other, and SHOW's choices all go through `openTool`, which
 * is what makes the sheet hand the screen over rather than stack on it.
 *
 * ## The tab bar is not on this screen, and MENU is why
 *
 * Inside the GM section the bottom of the phone belongs to `GmBar`. That is the
 * owner's decision - leaving the section is a rare gesture, ADD and SHOW are
 * continuous ones, and the thumb arc should go to the continuous - and it is
 * only honest once the door is somewhere else, which is `MenuSheet` behind the
 * campaign name at the top. Both halves land together on purpose: a commit that
 * removed the tab bar before MENU existed would strand a phone in the GM
 * section with the header's SETTINGS button as its only way anywhere.
 *
 * `App.tsx` carries the two lines that do it, and the licence notice moves with
 * them - into the session list's scroll, not off the screen. See
 * `LicenceFooter.tsx`.
 *
 * ## The stage, which is what keeps the bar on the glass
 *
 * Between `<GmTopBar>` and `<GmBar>` there is one `position: relative` box, and
 * both `GmSheet` mounts are `position: absolute; inset: 0` inside it. That box
 * is the *stage*: a tool or a sheet fills it exactly, and the two bars are
 * outside it by construction rather than by an offset somebody has to keep in
 * step. Before it, every tool was a fixed overlay over the whole window with
 * `useDialog`'s Tab trap on it, so the Fear pool, the pinned countdown, MENU
 * and the bar's three verbs were covered and keyboard-unreachable for as long
 * as any of the twelve was open - while `FearPool.tsx` went on giving "spent
 * from every one of them" as the reason the control exists. The owner's second
 * recorded decision for this screen is that the night is a sheet, not a modal,
 * and the bar stays under it. `GmSheet.tsx` costs the height that buys.
 *
 * The stage is what is left of `<main>` after the pinned chrome, so the two
 * alerts below take their band off a tool exactly as they already took it off
 * the list: they are outside the stage, above it, and stay readable and
 * answerable with a tool open. That is the right way round - they are about
 * work being lost while the GM is doing something else.
 *
 * **The list inside it is `inert` while anything is open**, and that is the
 * half of the Tab trap worth keeping. Under a `full` tool the list is not
 * visible at all and under a `sheet` it is behind a 55% wash where a tap closes
 * the sheet rather than reaching a row; either way it is not a place a keyboard
 * should be able to go, and `inert` says so to the focus order and to the
 * accessibility tree at once. What it does not do is what the trap did - reach
 * outside the stage and take the bars with it.
 *
 * ## The two things here that are not navigation
 *
 * `NotSaved`, at the foot of this file, is mounted between the top bar and the
 * list whenever the store's `writeError` is set. It is here rather than in a
 * sheet for the reason its own docblock gives: the GM who needs that sentence
 * is the one who has not opened anything.
 *
 * `ReplacedOnLoad` is the same argument about the other direction of the same
 * disk. It says that a change the GM made while the campaign was still being
 * read has been replaced by the saved one - which is a thing that happened *to
 * their hand*, and the only notice in this store that is.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Prefs } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { useLayout } from '../shared/useLayout.ts';
import { useRetry } from '../shared/useRetry.ts';
import { AddSheet } from './AddSheet.tsx';
import { Bestiary } from './Bestiary.tsx';
import { Countdowns } from './Countdowns.tsx';
import { Encounter } from './Encounter.tsx';
import { GmBar, type GmSheetId } from './GmBar.tsx';
import { GmSheet } from './GmSheet.tsx';
import { GmTopBar } from './GmTopBar.tsx';
import { REPLACED_ON_LOAD, retryGm, useGm, type GmRegion } from './gmStore.ts';
import { MenuSheet } from './MenuSheet.tsx';
import { Merchant } from './Merchant.tsx';
import { Names } from './Names.tsx';
import { PartyBoard } from './PartyBoard.tsx';
import { Reference } from './Reference.tsx';
import { SaveSheet } from './SaveSheet.tsx';
import { Scene } from './Scene.tsx';
import { SessionList } from './SessionList.tsx';
import { ShowSheet } from './ShowSheet.tsx';
import { andList, liveDoors, sentenceCase, SHOW_DOORS } from './showDoors.ts';

/** The dialog's accessible name, one per tool. */
const TOOL_LABEL: Record<GmRegion, string> = {
  encounter: 'Encounter builder',
  scene: 'The live scene',
  party: 'The party board',
  bestiary: 'Bestiary',
  countdowns: 'Fear and countdowns',
  reference: 'The rules at hand',
  names: 'Names and places',
  merchant: 'The merchant',
};

/**
 * The same, one per sheet - **except SHOW, which has no fixed name to keep.**
 *
 * A dialog with no name is a dialog nobody can find, so all four are named; the
 * type excludes `'show'` rather than carrying a string nothing reads, because
 * SHOW's name is computed from the doors that are live and a constant beside
 * `showLabel` would be a second, staler answer to the same question. It used to
 * be one: `show: 'Bestiary, party board and rules search'` sat here and was
 * returned verbatim by the both-on branch, which is exactly how a name and the
 * sheet it names come apart.
 */
const SHEET_LABEL: Record<Exclude<GmSheetId, 'show'>, string> = {
  menu: 'Menu and campaigns',
  add: 'Add to the night',
  save: 'Where this campaign is kept',
};

/**
 * SHOW's name, which has to say what is behind it *today*.
 *
 * Every door is switchable, so a fixed label is only true while all of them are
 * on. A dialog announced as "the bestiary, the party board and the merchant"
 * that offers one of the three is the small, everyday version of the rule this
 * project keeps: the screen does not get to claim something that is not there.
 *
 * The rule cuts the other way as well, and this function only did half of it
 * until the search arrived. `ShowSheet` draws the rules field under the doors
 * in **every** state it can be in, so the search is the one part of this name
 * that never varies, and a name that left it out described the sheet a GM heard
 * announced less well than the one they could see.
 *
 * ## Why this is built rather than enumerated
 *
 * It used to be three hardcoded strings for two doors, and three doors would
 * have made it **seven**. Seven literals is not a table of names; it is seven
 * chances to write down a sheet that is not there, in a function whose entire
 * job is to stop the screen doing that - and six of the seven would be
 * unreachable in any state a reviewer happens to be looking at. So the name is
 * assembled from `SHOW_DOORS` filtered by the same preferences `ShowSheet`
 * filters by, plus the search, which is why it cannot disagree with the sheet:
 * both read one array.
 *
 * All seven read as English, which is the property a join like this can lose
 * silently, so all seven are enumerated in `merchant.test.tsx` against this
 * function rather than left to the two states a screenshot would show.
 */
function showLabel(prefs: Prefs): string {
  return sentenceCase(andList([...liveDoors(prefs).map((door) => door.name), 'rules search']));
}

export function Gm(): React.JSX.Element {
  const layout = useLayout();
  const phone = layout === 'phone';
  // The whole record rather than a field per door, for `GmBar`'s reason: the
  // two questions this screen asks of it - what to call SHOW, and whether a
  // region names a tool this build offers - are both questions about
  // `SHOW_DOORS`, and a selector per door is the list copied out by hand.
  const prefs = useApp((s) => s.prefs);
  const writeError = useGm((s) => s.writeError);
  const writeRetry = useGm((s) => s.writeRetry);
  const replacedOnLoad = useGm((s) => s.replacedOnLoad);
  const dismissReplaced = useGm((s) => s.dismissReplacedOnLoad);
  const region = useGm((s) => s.region);
  const setRegion = useGm((s) => s.setRegion);
  const hydrated = useGm((s) => s.hydrated);
  const campaignId = useGm((s) => s.activeCampaignId);
  const [tool, setTool] = useState<GmRegion | null>(null);
  const [sheet, setSheet] = useState<GmSheetId | null>(null);

  /**
   * Whether this build is prepared to open that tool at all.
   *
   * Only a door behind SHOW can be switched off; every other region is the
   * content of a session row and is always offered, which is why an unlisted
   * region answers `true` rather than falling through to a default nobody
   * argued for.
   */
  const offered = useCallback(
    (next: GmRegion): boolean => {
      const door = SHOW_DOORS.find((entry) => entry.tool === next);
      return door === undefined || prefs[door.pref] === true;
    },
    [prefs],
  );

  /*
   * The last value of `board.region` this screen has acted on, and the table it
   * arrived with.
   *
   * Null until the store has answered, and then seeded rather than opened: the
   * stored region says which tool was last open, which is worth keeping and is
   * not an instruction to open it. Only a change *after* that seeding is a
   * navigation, and the only things that make one are the four cross-links
   * inside the tools themselves.
   *
   * `table` is the other half of that. Every campaign record carries a region,
   * so a change of campaign changes this value without anybody navigating; the
   * id says which of the two happened.
   */
  const followed = useRef<GmRegion | null>(null);
  const table = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const seeding = followed.current === null || table.current !== campaignId;
    const unchanged = followed.current === region;
    followed.current = region;
    table.current = campaignId;
    if (seeding || unchanged) return;
    // Remembered, not opened: a tool that is switched off has no dialog for
    // this screen to put over the list.
    if (!offered(region)) return;
    setSheet(null);
    setTool(region);
  }, [hydrated, region, campaignId, offered]);

  const openTool = useCallback(
    (next: GmRegion) => {
      // Seeded before the write, so opening a tool from this screen is not
      // read back by the effect above as a navigation someone else asked for.
      followed.current = next;
      setSheet(null);
      setTool(next);
      setRegion(next);
    },
    [setRegion],
  );

  const openSheet = useCallback((next: GmSheetId) => {
    setTool(null);
    setSheet(next);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <GmTopBar layout={layout} onOpenMenu={() => openSheet('menu')} onOpenTool={openTool} />
      {writeError !== null && (
        <NotSaved message={writeError} retryable={writeRetry !== null} phone={phone} />
      )}
      {replacedOnLoad && <ReplacedOnLoad phone={phone} onDismiss={dismissReplaced} />}
      <div className="stack" style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div className="stack" style={{ flex: 1, minHeight: 0 }} inert={tool !== null || sheet !== null}>
          <SessionList phone={phone} onOpenTool={openTool} />
        </div>

        {tool !== null && (
          <GmSheet label={TOOL_LABEL[tool]} size="full" onClose={() => setTool(null)}>
            {tool === 'encounter' && <Encounter phone={phone} />}
            {tool === 'scene' && <Scene phone={phone} />}
            {tool === 'party' && <PartyBoard phone={phone} />}
            {tool === 'bestiary' && <Bestiary phone={phone} />}
            {tool === 'countdowns' && <Countdowns phone={phone} />}
            {tool === 'reference' && <Reference />}
            {tool === 'names' && <Names phone={phone} />}
            {tool === 'merchant' && <Merchant phone={phone} />}
          </GmSheet>
        )}

        {sheet !== null && (
          <GmSheet
            label={sheet === 'show' ? showLabel(prefs) : SHEET_LABEL[sheet]}
            onClose={closeSheet}
          >
            {sheet === 'menu' && <MenuSheet onClose={closeSheet} onOpenTool={openTool} />}
            {sheet === 'add' && <AddSheet onClose={closeSheet} />}
            {sheet === 'show' && <ShowSheet onOpenTool={openTool} />}
            {sheet === 'save' && <SaveSheet />}
          </GmSheet>
        )}
      </div>
      <GmBar open={sheet} onOpenSheet={openSheet} />
    </div>
  );
}

/**
 * The campaign is not on the disk, said on the screen it happened on.
 *
 * `gmStore` has carried `writeError` since it was written, and until SAVE
 * existed nothing read it at all; since SAVE, one sheet reads it. That is one
 * tap too many for this particular sentence. Every other failure in this app
 * that costs the user work is a strip at the top of `<main>` -
 * `App.tsx::UnsavedWork` for the character store, the storage banner, the
 * quarantine banner - precisely because the GM who needs to know is the one who
 * has *not* opened anything: they are three hours into a session, adding rows,
 * watching them appear, and the tab is going to close on all of it. A warning
 * that waits behind a button is a warning for the person who already suspected.
 *
 * It stays in SAVE as well, and that is not duplication: SAVE's whole job is to
 * report where the campaign is, and a sheet that answered "already on this
 * device" while this strip contradicted it a layer below would be worse than
 * either alone. They read the same field and say the same sentence - the
 * store's own, not a second one invented here, because a failure that already
 * has words does not need paraphrasing.
 *
 * There is a third surface now, and it is the one this strip could not be:
 * `shell/CampaignNotSaved.tsx`, at the top of `<main>`, on every screen that is
 * not this one. The argument above stops at the edge of the GM section - the GM
 * who taps MENU → PLAY to read a player's sheet takes this strip off the glass
 * with them, and the tab still closes on the evening. `App.tsx` mounts that
 * block only while the GM screen is *not* the one rendered, so the two are
 * never up together: this one is under the pinned top bar and that one is above
 * it, and 40px apart they would be the app raising its voice rather than saying
 * anything new.
 *
 * Not dismissible. A dismissed warning about work that is not saved is exactly
 * the false reassurance this app is not allowed to give, and unlike the backup
 * nag this is usually an event with a remedy.
 *
 * ## The retry is drawn only where there is one, which is new
 *
 * This docblock used to claim that TRY AGAIN "calls `flushGm`, which does
 * something on every path that sets this field". It did not. `flushGm` writes
 * the open campaign when the store is dirty, and two of the failures it can
 * report left it clean: `createCampaign`'s rejected write, which is fixed in
 * the store because it *should* have been dirty, and a delete that threw, which
 * no flush can undo at all. A third, the read that failed, has no campaign to
 * write and
 * `writeActive` returns at `base === undefined` - inert forever. So the GM
 * pressed a red button, watched it say TRYING…, and got the same strip back
 * with nothing written.
 *
 * The store answers that now with `writeRetry`: `retryGm` does the right thing
 * per failure, and where the answer is "nothing this button can do" there is no
 * button - the store's sentence says what does help instead. And a retry that
 * fails says so, rather than flashing and leaving the reader to guess whether
 * anything happened.
 *
 * ## Ergonomics, 393x852
 *
 * It sits under the pinned top bar and above the list: y 217.00 to about 360,
 * which is the top third of the screen and nowhere near the 560-820 band a
 * right thumb covers. The 217.00 is the 100.00 shell header, measured under
 * `SessionList.tsx`'s `## Scroll` heading alongside the 548.00 below, plus the
 * 109.00 `GmTopBar`, measured under that file's `## The phone, in numbers
 * (393 x 852)` heading - plus this block's own 8px top margin, with nothing
 * else between them: `Gm` renders
 * this strip as the next sibling after `<GmTopBar>` inside a `.stack`, and
 * `.stack` declares no gap. ("y 215" stood here, off by the two 1px rules the
 * corrected 100.00 and 109.00 added.) That is deliberate twice over - it has
 * to be *read*, and its one control is a decision rather than a reflex. **The
 * inner column is narrower than the "393 − 24 of page margin − 24 of padding =
 * 345px" that stood here, and by this alert's own frame.** `base.css:13` puts
 * everything on `box-sizing: border-box`, and the alert declares `border: '1px
 * solid var(--fear)'` alongside its 12px margin and 12px padding either side,
 * so that sum spends nothing for a pixel on each edge. How much column is left
 * has not been measured, and neither has the "four lines at `.t-dense`" the
 * longest store sentence used to be given here, which was counted against the
 * "345": both go to the rig before anything leans on them. The block is about
 * 143px, which takes the session list from the 548.00 measured in
 * `SessionList.tsx` to about 405. ("551px of list" and "nine rows" stood here.
 * Both were a 1px rule short, though not of the same rules: 551 missed the
 * three hairlines on the pinned chrome, and nine missed the two `.panel`
 * borders on every row. And 143 was never measured, so the row count it
 * implies is not asserted here at all.) It is on screen only while writes are
 * actually failing, and a night's plan cut by roughly a quarter while the app
 * is losing it is the right trade.
 *
 * TRY AGAIN is a chip at `minHeight: var(--control)` - 34px against a precise
 * pointer, 44 on every phone and tablet - and deliberately not the full width
 * of the strip: a full-width primary button at the top of a screen is a thing
 * thumbs hit on the way past, and pressing this twice while a write is in flight is
 * the one thing it should be hard to do by accident. The disabled state during
 * the retry says TRYING… rather than going grey silently.
 */
function NotSaved({
  message,
  retryable,
  phone,
}: {
  message: string;
  retryable: boolean;
  phone: boolean;
}): React.JSX.Element {
  /*
   * The busy state, the unmount guard and "did that one land either" are all
   * `useRetry`'s now, because this strip, SAVE and the shell's block had three
   * copies of them. What is still this file's is the shape they are drawn in.
   */
  const { retrying, failedAgain, again: retry } = useRetry(retryGm);

  return (
    <div
      role="alert"
      className="stack"
      style={{
        flex: 'none',
        gap: 8,
        margin: phone ? '8px 12px 0' : '8px 20px 0',
        padding: '10px 12px',
        borderRadius: 'var(--r2)',
        background: 'var(--fear-wash)',
        border: '1px solid var(--fear)',
      }}
    >
      <span className="t-label" style={{ color: 'var(--text)' }}>
        NOT ON THIS DEVICE
      </span>
      <span className="t-dense" style={{ color: 'var(--text-2)', maxWidth: '62ch' }}>
        {message}
      </span>
      {retryable && (
        <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="chip"
            onClick={retry}
            disabled={retrying}
            style={{
              flex: 'none',
              minHeight: 'var(--control)',
              color: 'var(--text)',
              background: 'var(--raised)',
            }}
          >
            {retrying ? 'TRYING…' : 'TRY AGAIN'}
          </button>
          {failedAgain && (
            <span className="t-meta" style={{ color: 'var(--damage)' }}>
              THAT TRY DID NOT LAND EITHER
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * The tap the disk undid, said where the tap was made.
 *
 * `hydrateGm` adopts the saved campaign and drops whatever the GM changed in
 * the window before the database answered - the right decision, argued in the
 * store: adopting the live state would write an empty board over a real
 * campaign and merging the two would invent a state that was never true. What
 * was missing is the other half of it. The store pushes a sentence into
 * `notices`, `notices` is drawn inside MENU's THIS DEVICE block, and a GM who
 * pressed Fear `+` during the read watched it go back down with nothing on the
 * screen to say why. A reversal the app performs on purpose and reports only
 * to whoever opens a sheet is a reversal it has performed quietly.
 *
 * Dismissible, where `NotSaved` above is not, and the difference is the tense.
 * That one is about work that is *still* at risk, so a dismissal would be
 * false reassurance. This is a completed event with nothing left to lose by it,
 * and a strip that stayed for the rest of the evening would cost the list two
 * rows to say something that stopped being true the moment it was read. The
 * sentence stays in `notices` either way, so the ✕ is not an erasure.
 *
 * ## Ergonomics, 393x852
 *
 * The same slot as `NotSaved`, under the pinned top bar at y 217.00 and far
 * above the 560-820 band a right thumb covers, because it is read rather than
 * answered. **The column is narrower than the "393 − 24 of page margin − 24 of
 * padding = 345px" that stood here, and by a different rule from the one
 * `NotSaved` above drops**: this strip declares `borderLeft: '3px solid
 * var(--hope)'` and no other border, so under `box-sizing: border-box` it loses
 * three pixels on one edge where `NotSaved` loses one on each - the two were
 * never the same width and the shared "345" said they were. Neither has been
 * measured, and nor has the "three lines at `.t-dense`" that was counted
 * against the "345". The block is about 100px, taken off the 548.00 the list
 * measures. ("Nine rows" stood here and
 * was never the count: it dropped the two `.panel` borders every row carries -
 * see `SessionList.tsx`, which measures eight whole and a ninth cut but
 * legible. 100 is an estimate, so what it leaves is not asserted.) Its only
 * control is the ✕ every dismissal in this app uses, `var(--control)` square -
 * 44 on a phone - in the top corner, away from the text it removes.
 */
function ReplacedOnLoad({
  phone,
  onDismiss,
}: {
  phone: boolean;
  onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div
      role="status"
      className="row"
      style={{
        flex: 'none',
        alignItems: 'flex-start',
        gap: 10,
        margin: phone ? '8px 12px 0' : '8px 20px 0',
        padding: '10px 12px',
        borderRadius: 'var(--r2)',
        background: 'var(--raised)',
        borderLeft: '3px solid var(--hope)',
      }}
    >
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <span className="t-label" style={{ color: 'var(--text)' }}>
          THE SAVED TABLE WON
        </span>
        <span className="t-dense" style={{ color: 'var(--text-2)', maxWidth: '62ch' }}>
          {REPLACED_ON_LOAD}
        </span>
      </span>
      <button
        type="button"
        className="t-meta"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ flex: 'none', minHeight: 'var(--control)', minWidth: 'var(--control)' }}
      >
        ✕
      </button>
    </div>
  );
}
