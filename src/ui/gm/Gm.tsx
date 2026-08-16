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
 * SRD reference MENU opens, which is a tool no session row can hold. Each one is
 * rendered inside a `GmSheet` and **unmounted** when it closes - never hidden.
 * That is not tidiness: `PartyBoard`'s scanner opens the camera in an effect
 * and stops it on unmount, so a sheet kept alive behind `display: none` leaves
 * the camera running on a phone in a dark room. It costs the bestiary its
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
 * either closes the other, and SHOW's two choices go through `openTool`, which
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
import { useApp } from '../../store/state.ts';
import { useLayout } from '../shared/useLayout.ts';
import { AddSheet } from './AddSheet.tsx';
import { Bestiary } from './Bestiary.tsx';
import { Countdowns } from './Countdowns.tsx';
import { Encounter } from './Encounter.tsx';
import { GmBar, type GmSheetId } from './GmBar.tsx';
import { GmSheet } from './GmSheet.tsx';
import { GmTopBar } from './GmTopBar.tsx';
import { flushGm, REPLACED_ON_LOAD, useGm, type GmRegion } from './gmStore.ts';
import { MenuSheet } from './MenuSheet.tsx';
import { PartyBoard } from './PartyBoard.tsx';
import { Reference } from './Reference.tsx';
import { SaveSheet } from './SaveSheet.tsx';
import { Scene } from './Scene.tsx';
import { SessionList } from './SessionList.tsx';
import { ShowSheet } from './ShowSheet.tsx';

/** The dialog's accessible name, one per tool. */
const TOOL_LABEL: Record<GmRegion, string> = {
  encounter: 'Encounter builder',
  scene: 'The live scene',
  party: 'The party board',
  bestiary: 'Bestiary',
  countdowns: 'Fear and countdowns',
  reference: 'The rules at hand',
};

/** The same, one per sheet. A dialog with no name is a dialog nobody can find. */
const SHEET_LABEL: Record<GmSheetId, string> = {
  menu: 'Menu and campaigns',
  add: 'Add to the night',
  show: 'Bestiary and party board',
  save: 'Where this campaign is kept',
};

/**
 * SHOW's name, which has to say what is behind it *today*.
 *
 * Both halves of the fork are switchable, so the fixed label above is only true
 * while both are on. A dialog announced as "Bestiary and party board" that
 * offers one of the two is the small, everyday version of the rule this project
 * keeps: the screen does not get to claim something that is not there.
 */
function showLabel(bestiary: boolean, partyBoard: boolean): string {
  if (bestiary && partyBoard) return SHEET_LABEL.show;
  return bestiary ? 'Bestiary' : 'The party board';
}

export function Gm(): React.JSX.Element {
  const layout = useLayout();
  const phone = layout === 'phone';
  const bestiary = useApp((s) => s.prefs.gmBestiary);
  const partyBoard = useApp((s) => s.prefs.gmPartyBoard);
  const writeError = useGm((s) => s.writeError);
  const replacedOnLoad = useGm((s) => s.replacedOnLoad);
  const dismissReplaced = useGm((s) => s.dismissReplacedOnLoad);
  const region = useGm((s) => s.region);
  const setRegion = useGm((s) => s.setRegion);
  const hydrated = useGm((s) => s.hydrated);
  const campaignId = useGm((s) => s.activeCampaignId);
  const [tool, setTool] = useState<GmRegion | null>(null);
  const [sheet, setSheet] = useState<GmSheetId | null>(null);

  /** Whether this build is prepared to open that tool at all. */
  const offered = useCallback(
    (next: GmRegion): boolean =>
      next === 'bestiary' ? bestiary : next === 'party' ? partyBoard : true,
    [bestiary, partyBoard],
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
      {writeError !== null && <NotSaved message={writeError} phone={phone} />}
      {replacedOnLoad && <ReplacedOnLoad phone={phone} onDismiss={dismissReplaced} />}
      <SessionList phone={phone} onOpenTool={openTool} />
      <GmBar open={sheet} onOpenSheet={openSheet} />

      {tool !== null && (
        <GmSheet label={TOOL_LABEL[tool]} size="full" onClose={() => setTool(null)}>
          {tool === 'encounter' && <Encounter phone={phone} />}
          {tool === 'scene' && <Scene phone={phone} />}
          {tool === 'party' && <PartyBoard phone={phone} />}
          {tool === 'bestiary' && <Bestiary phone={phone} />}
          {tool === 'countdowns' && <Countdowns phone={phone} />}
          {tool === 'reference' && <Reference />}
        </GmSheet>
      )}

      {sheet !== null && (
        <GmSheet
          label={sheet === 'show' ? showLabel(bestiary, partyBoard) : SHEET_LABEL[sheet]}
          onClose={closeSheet}
        >
          {sheet === 'menu' && <MenuSheet onClose={closeSheet} onOpenTool={openTool} />}
          {sheet === 'add' && <AddSheet onClose={closeSheet} />}
          {sheet === 'show' && <ShowSheet onOpenTool={openTool} />}
          {sheet === 'save' && <SaveSheet />}
        </GmSheet>
      )}
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
 * Not dismissible. A dismissed warning about work that is not saved is exactly
 * the false reassurance this app is not allowed to give, and unlike the backup
 * nag this is an event with a remedy: TRY AGAIN calls `flushGm`, which does
 * something on every path that sets this field - a failed write is left dirty
 * on purpose, including the very first campaign of a device.
 *
 * ## Ergonomics, 393x852
 *
 * It sits under the pinned top bar and above the list: y 215 to about 360,
 * which is the top third of the screen and nowhere near the 560-820 band a
 * right thumb covers. That is deliberate twice over - it has to be *read*, and
 * its one control is a decision rather than a reflex. The strip's inner column
 * is 393 − 24 of page margin − 24 of padding = 345px, so the store's longest
 * sentence is four lines at `.t-dense`; with the label and the button the block
 * is about 143px, which takes the session list from 551px (nine rows) to about
 * 400 (six). It is on screen only while writes are actually failing, and six
 * rows of a night the app is losing is the right trade.
 *
 * TRY AGAIN is a chip at `minHeight: var(--control)` - 34px against a precise
 * pointer, 44 on every phone and tablet - and deliberately not the full 345px
 * width: a full-width primary button at the top of a screen is a thing thumbs
 * hit on the way past, and pressing this twice while a write is in flight is
 * the one thing it should be hard to do by accident. The disabled state during
 * the retry says TRYING… rather than going grey silently.
 */
function NotSaved({ message, phone }: { message: string; phone: boolean }): React.JSX.Element {
  const [retrying, setRetrying] = useState(false);
  /*
   * Whether this strip is still on the page when the retry settles.
   *
   * A retry that works clears `writeError`, which unmounts this component -
   * before `flushGm()` resolves, because the store's `setState` runs inside the
   * write's own success path. So the flag has to outlive the callback that
   * reads it and has to be *cleared by the unmount*, which is what makes it a
   * ref with an effect rather than a local: the first draft declared
   * `let alive = true` inside `retry`, where nothing could ever set it false,
   * and the comment beside it described a guard the code did not have.
   * `SaveSheet` does the same thing correctly for the same reason.
   */
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const retry = useCallback(() => {
    setRetrying(true);
    void flushGm().finally(() => {
      if (alive.current) setRetrying(false);
    });
  }, []);

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
      </span>
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
 * The same slot as `NotSaved`, under the pinned top bar at y 215 and far above
 * the 560-820 band a right thumb covers, because it is read rather than
 * answered. The column is 393 − 24 of page margin − 24 of padding = 345px, so
 * the store's sentence is three lines at `.t-dense` and the block is about
 * 100px: the list goes from nine rows to seven while it is up. Its only control
 * is the ✕ every dismissal in this app uses, `var(--control)` square - 44 on a
 * phone - in the top corner, away from the text it removes.
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
