/**
 * MENU: the way out of the GM section, and the campaigns behind the one that
 * is open.
 *
 * This sheet exists because the bottom bar took the tab bar's place. Inside the
 * GM section the tab bar's destinations are gone and ADD / SHOW / SAVE are in
 * that slot, which is the owner's decision and the right one - leaving the section
 * is a rare gesture and the thumb arc belongs to the continuous ones - but it
 * is only defensible if the door is somewhere. It is here, at the top of the
 * screen, behind the campaign name that was already drawn there.
 *
 * ## Six blocks, in the order a hand reaches them
 *
 * **Where to go** is first because it is the reason the sheet has to exist at
 * all, and because a GM who opened it by accident wants out. Play, Cards and
 * Build; not Settings, because the header's SETTINGS button is on every screen
 * including this one and a second route to it would be the only duplicated
 * destination in the app.
 *
 * **The two tools with no door of their own** are second, and they are here
 * because the screen otherwise had no way to reach them. The five regions are
 * the content of a session row now, which is the whole point of the rebuild -
 * but three of them have a fixed control as well and two did not. Fear and the
 * countdowns are behind the Fear readout, which is always drawn; the bestiary
 * and the party board are behind SHOW, for as long as Settings leaves any door
 * switched on - see `whereTheOthersAre`. The encounter builder had nothing, and
 * the live scene had only a chip that exists while adversaries are on the
 * board - so a GM improvising a fight had to ADD an encounter row, name it,
 * submit it, open it and press OPEN THE BUILDER, creating a plan row they may
 * not have wanted, where the old screen had a tab.
 *
 * The others are deliberately *not* repeated here, and that is the same
 * rule Settings is kept out by: a second route to a destination that already
 * has one is a door nobody chose to build. The sentence under these two says
 * where the rest are, so their absence is an answer rather than a gap. It said
 * "the other three" and counted them itself, which is one more place for the
 * count to go stale the day a door is added - and a door was added: the
 * merchant is a fourth.
 * **The rules** are third, and they are here rather than in the bottom bar for
 * the reason `Reference.tsx` gives at length: ADD and SHOW are the continuous
 * gestures of an evening and hold the thumb arc, while looking a rule up stops
 * play, happens once or twice a session, and is read rather than pressed. That
 * is the same kind of act as leaving the section or changing table, which is
 * what this sheet already is. It is near the top and not at the bottom because
 * it is one of the two blocks a GM reaches for *during* a session.
 *
 * **A name** is fourth, and it is the other one. It is beside the rules rather
 * than in the bottom bar for the same argument and one addition of its own: the
 * generator is a burst - open it, tap DRAW four times, take one, close it - so
 * what belongs under the thumb is the repeated tap *inside* the tool, not the
 * door to it. `Names.tsx` puts DRAW at the bottom of its own panel for exactly
 * that reason.
 *
 * **The campaigns** are fifth. Switching, making a new one, renaming the open
 * one, and removing one behind two taps.
 *
 * **This device** is last, and is the block nothing had ever drawn. `useGm`
 * has carried `notices`, `quarantined` and `hydrated` since campaigns were
 * built: repairs the reader made, campaigns a newer build wrote and this one
 * refuses to touch, and the state before the database has answered. All three
 * were computed, tested and rendered nowhere.
 *
 * ## Two things it refuses, and says why on the screen
 *
 * **A campaign cannot be given a name another campaign already has**, and that
 * includes no name at all. This field used to hold a rule of its own - every
 * empty name refused, every duplicate allowed - which was backwards in both
 * directions: two rows reading "The Sablewood Winter" are exactly as impossible
 * to tell apart as two reading "Unnamed campaign", and refusing an empty name
 * on the only campaign on the device refused something that collided with
 * nothing. It now asks `judgeName` in `store/names.ts`, the one definition of
 * "the same name" in this app, and prints that function's sentence: the same
 * words, from the same place, as the control that renames a character. The
 * button refuses and the sheet says so in words, with the nearest free name
 * offered in a control you have to press, because silently rewriting what
 * somebody typed is the other half of the same defect.
 *
 * **Only the open campaign can be renamed here, and the reason has changed
 * twice.** It began as a wall around a write that could not land: `patchCampaign`
 * scheduled a write only when the id was the active one, so a rename typed
 * against any other row looked right until the next reload and was then gone.
 * The store honours it now - `patchCampaign` sends any other id down
 * `scheduleAside` - so that reason is dead.
 *
 * What kept it is the row, and this is the answer the unique-name item settled
 * on rather than a question left open. **A campaign row is exactly the sheet's
 * 363px column wide, and it is the 277px inside it that has no room to spare.**
 * The row is a `.panel` and `.panel` is border-box, so the `.stack` above it
 * stretches it to the full 363.00 and its own 1px border and
 * `padding: '2px 4px 2px 10px'` come out of its content box rather than off its
 * outer edge: 363 - 2 of border - 14 of padding = 347.00 of content, less the
 * 8px gap, leaves **339.00 for the two controls**. REMOVE is `flex: 'none'` at
 * `padding: '0 10px'`, so the word sets its width - **62.00** - and the 44 it
 * declares is a floor on its *height*; the name button is `flex: 1` and takes
 * what is left, **277.00**. 363.00 / 277.00 / 62.00 are measured in Chrome at
 * 393x852 with the rig in `AUDIT-HANDOFF.md`, on the one seeded campaign; the
 * row measures 50.00 tall there, which is the 44px floor plus 2+2 of padding
 * and 2 of border. (Two sentences have stood here and both were wrong. "A 365px
 * row: a 313px name button and a 44px REMOVE" missed the sheet's own border,
 * the row panel's border and padding, and read a height as a width; the
 * correction that replaced it - "narrower than the column and nobody has
 * measured by how much" - was wrong in the other direction and in the wrong
 * axis, because a border-box row spends its border inwards.) A third target on
 * that row comes out of those 277 and takes a gap with it, on the screen where
 * the whole point of the row is reading which table it is, and a rename that
 * opens *in* the row would push REMOVE - an armed, destructive control - down
 * the list under a thumb already travelling. One field, on the campaign whose
 * name is already drawn at the top of the screen, one tap from any other
 * campaign in the list above it. The sentence on the screen says that, and it
 * is the one thing the GM can act on.
 *
 * ## The list is not re-sorted while it is on screen
 *
 * `readCampaigns` sorts newest-played first, once, on the way in. This sheet
 * draws them in that order and does not re-sort by `updatedAt` as it renders:
 * the open campaign is written every 400ms, so live sorting would move exactly
 * one row - always the open one - to the top under a thumb that is reaching for
 * REMOVE on the row below it.
 *
 * ## Ergonomics, 393x852
 *
 * A bottom sheet: it opens from the MENU button at the top of the screen, which
 * is the hardest reach on the phone and deliberately so, and answers under the
 * thumb. The inner column is **363px**, not the "365" that `393 - 28 of padding`
 * gives: this sheet draws inside `GmSheet`'s panel - `Gm.tsx` mounts all four
 * sheets there - which is border-box with a 1px border (`GmSheet.tsx`), so a
 * pixel goes on each edge as well. 363 is measured in Chrome at 393x852 and recorded in
 * `ShowSheet.tsx`, which draws in the same panel at the same `padding: 14`; it
 * is not re-derived here - and it is confirmed here, because OPEN THE REFERENCE
 * measures 363.00 in the same pass that measured the campaign row. The two
 * derived cell widths below - the 115.67 and the 177.5 - are implied by that
 * column rather than measured, and are written as implied; the campaign row's
 * figures below them were measured directly and say so.
 *
 *   the three destinations   three across at (363 - 16) / 3 = 115.67 x 56 each
 *   the two tools            two across at (363 - 8) / 2 = 177.5 x 56 each, the
 *                            same height as the row above them because they are
 *                            the same gesture: one tap, and the sheet is gone
 *   THE RULES AT HAND        full width, 363 x 44
 *   A NAME, NOW              full width, 363 x 44, the same as the rules above
 *                            it because it is the same gesture: one tap, and
 *                            the work happens inside the tool that opens
 *   a campaign row           363 x 50, measured: the row is a border-box
 *                            `.panel` stretched to the full column, so its own
 *                            border and `padding: '2px 4px 2px 10px'` are spent
 *                            inside it. 363 - 2 - 14 - 8 of gap = 339 shared by
 *                            a 277.00 name button and a 62.00 REMOVE, and the
 *                            50 is the 44px floor plus that padding and border.
 *                            "365 - 44 - 8 = 313 x 44" stood here and none of
 *                            it held; "narrower than the column, NOT MEASURED"
 *                            replaced it and was wrong the other way
 *   RENAME / NEW CAMPAIGN    full-width, minHeight var(--tap) = 44
 *   the rename field         363 x 44, and it is the only keyboard on the sheet
 *
 * Read, not touched: every notice, every quarantined record, the "this device"
 * block entire, the refusal sentence, and the sentence explaining why a closed
 * campaign has no rename button. Touched: everything above, and the offer beside
 * a refusal - which is a control precisely so that nothing is rewritten without
 * a tap.
 */
import { useEffect, useId, useState } from 'react';
import { CAMPAIGN_NAMES, judgeName } from '../../store/names.ts';
import { useApp, type Screen } from '../../store/state.ts';
import { NameRefusal } from '../shared/NameRefusal.tsx';
import type { Prefs } from '../../store/prefs.ts';
import { useGm, type GmRegion } from './gmStore.ts';
import { andList, liveDoors, sentenceCase, SHOW_DOORS } from './showDoors.ts';

/** Where MENU can go. Settings is deliberately not here - see the docblock. */
const WAYS_OUT: Array<{ id: Screen; label: string }> = [
  { id: 'play', label: 'PLAY' },
  { id: 'cards', label: 'CARDS' },
  { id: 'build', label: 'BUILD' },
];

/**
 * The row-backed tools nothing else on this screen can open.
 *
 * "Row-backed" is what separates this list from the two blocks under it: the
 * reference and the name generator are also only reachable from here, and
 * neither of them is ever the content of a session row, so neither belongs in
 * a pair whose whole argument is "these two are a row and nothing else".
 *
 * Not all of them, and the four that are missing from the list are missing on
 * purpose: Fear and the countdowns is behind the readout that is always in the
 * top bar, and the bestiary, the party board and the merchant are behind SHOW.
 * These two are the content of a row and nothing else, which was fine until a
 * GM wanted one without a row.
 *
 * The list itself is fixed; the *sentence* under it is not, because every door
 * it names but the Fear one is switchable. See `whereTheOthersAre`.
 */
const TOOLS: Array<{ id: GmRegion; label: string }> = [
  { id: 'encounter', label: 'THE ENCOUNTER BUILDER' },
  { id: 'scene', label: 'THE LIVE SCENE' },
];

/**
 * The words for a count this sentence has to say out loud.
 *
 * Indexed by the number itself less one, and long enough for a door more than
 * `SHOW_DOORS` carries. Past the end it falls back to the digit rather than to
 * `undefined`: a sentence reading "The other 5" is worse prose and a perfectly
 * true one, which is the right way round for a fallback nobody has hit.
 */
const COUNTED: readonly string[] = ['one', 'two', 'three', 'four', 'five'];

/**
 * Where the tools this sheet does not repeat are, in whichever build the GM is
 * actually holding.
 *
 * This sentence named SHOW unconditionally, and SHOW is not unconditional.
 * `GmBar` filters the verb out when every door behind it is switched off, and
 * `ShowSheet` draws only the doors that survive - so with all of them off the
 * sheet was pointing at a control the GM can look down at the bar and not find,
 * and with some off it was promising things behind a verb that does not offer
 * them. Settings has said the first half of this out loud since it was written
 * - "With all three off SHOW has nothing left to open, so it leaves the GM
 * screen's bottom bar" - which made this the app contradicting itself about its
 * own bar, two settings apart, with each half tested and neither read against
 * the other.
 *
 * A switched-off tool is named as switched off rather than as somewhere to go:
 * it drops out of the count as well as out of the route, and the reader is sent
 * to Settings, which is where it went, instead of to a verb that is not there.
 * Read here rather than taken as a prop for the same reason `GmBar` reads it -
 * what this sheet says is this sheet's business.
 *
 * **It was three hardcoded sentences for the four states two doors can be
 * switched into, and three doors can be switched into eight.** Unlike the name
 * `Gm.tsx` gives the dialog, this sentence is asked for in the all-off state
 * too - MENU is always in the top bar - so its states are 2³ and not the 2³ − 1
 * live ones, and `merchant.test.tsx` enumerates all eight against this
 * function. The count in the opening clause, the list of what is behind SHOW,
 * the list of what is switched off and the verb agreeing with each of them all
 * move together, so they are all derived from one filter over
 * `SHOW_DOORS` - the same filter `ShowSheet` draws with and `Gm.tsx` names the
 * dialog with. The one thing that is *not* derived is the Fear clause, because
 * Fear and the countdowns is not a door and is not switchable: it is why the
 * count is the live doors plus one rather than the live doors.
 */
function whereTheOthersAre(prefs: Prefs): string {
  const fear = 'Fear and the countdowns are behind the Fear number at the top';
  const live = liveDoors(prefs);
  const gone = SHOW_DOORS.filter((door) => prefs[door.pref] !== true);
  const total = live.length + 1;

  const opening =
    total === 1
      ? `The one that is left already has a way in and is not repeated here: ${fear}`
      : `The other ${COUNTED[total - 1] ?? String(total)} already have a way in and are not repeated here: ${fear}`;

  const behind =
    live.length === 0
      ? '.'
      : `, and ${andList(live.map((door) => door.name))} ${live.length === 1 ? 'is' : 'are'} behind SHOW.`;

  if (gone.length === 0) return `${opening}${behind}`;

  const names = sentenceCase(andList(gone.map((door) => door.name)));
  const verb = gone.length === 1 ? 'is' : 'are';
  const bar = live.length === 0 ? ', so SHOW is not on the bottom bar at all' : '';
  return `${opening}${behind} ${names} ${verb} switched off in Settings${bar}.`;
}

export function MenuSheet({
  onClose,
  onOpenTool,
}: {
  onClose: () => void;
  /**
   * Opening a tool closes this sheet on its own - `Gm.tsx`'s `openTool` clears
   * the sheet before it sets the tool - so this is not paired with `onClose`
   * the way the destinations above it are.
   */
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const setScreen = useApp((s) => s.setScreen);
  // The record rather than a field per door: what this sentence has to say is a
  // question about `SHOW_DOORS`, and a selector per door would be that list
  // copied out here by hand - the copy that goes stale when a door is added.
  const prefs = useApp((s) => s.prefs);
  const campaigns = useGm((s) => s.campaigns);
  const activeId = useGm((s) => s.activeCampaignId);
  const hydrated = useGm((s) => s.hydrated);
  const notices = useGm((s) => s.notices);
  const quarantined = useGm((s) => s.quarantined);
  const switchCampaign = useGm((s) => s.switchCampaign);
  const createCampaign = useGm((s) => s.createCampaign);
  const removeCampaign = useGm((s) => s.removeCampaign);

  const active = campaigns.find((c) => c.id === activeId) ?? null;

  return (
    <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 16, padding: 14 }}>
      <div className="stack" style={{ flex: 'none', gap: 8 }}>
        <span className="t-label">LEAVE THE GM TOOLS</span>
        {/*
          Named as a group, the way SHOW's moment chips are. This is the only
          exit from the GM screen - the tab bar is not drawn here - so the set
          of destinations is a thing worth being able to address as a set,
          both for a screen reader and for the test that guards it from
          shrinking.
        */}
        <div role="group" aria-label="Leave the GM tools" className="row" style={{ gap: 8 }}>
          {WAYS_OUT.map((way) => (
            <button
              key={way.id}
              type="button"
              onClick={() => {
                setScreen(way.id);
                onClose();
              }}
              className="btn"
              style={{ flex: 1, minWidth: 0, minHeight: 56, letterSpacing: '0.1em' }}
            >
              {way.label}
            </button>
          ))}
        </div>
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          The tab bar is not on this screen: the bottom of it belongs to ADD, SHOW and SAVE while
          you are running a session. Settings is where it always is, in the header.
        </p>
      </div>

      <div className="stack" style={{ flex: 'none', gap: 8 }}>
        <span className="t-label">OPEN A TOOL WITHOUT A ROW</span>
        <div className="row" style={{ gap: 8 }}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onOpenTool(tool.id)}
              aria-haspopup="dialog"
              className="btn"
              style={{ flex: 1, minWidth: 0, minHeight: 56, letterSpacing: '0.08em' }}
            >
              {tool.label}
            </button>
          ))}
        </div>
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          These two are otherwise the content of a session row, so improvising a fight meant
          writing a row for it first. {whereTheOthersAre(prefs)}
        </p>
      </div>

      <div className="stack" style={{ flex: 'none', gap: 8 }}>
        <span className="t-label">THE RULES AT HAND</span>
        <button
          type="button"
          onClick={() => onOpenTool('reference')}
          aria-haspopup="dialog"
          className="btn"
          style={{ flex: 'none', minHeight: 'var(--tap)' }}
        >
          OPEN THE REFERENCE
        </button>
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          The tables you would otherwise be turning pages for, read out of the SRD this app ships
          rather than retyped from it — so a rules layer that changes one changes what you see.
        </p>
      </div>

      <div className="stack" style={{ flex: 'none', gap: 8 }}>
        <span className="t-label">A NAME, NOW</span>
        <button
          type="button"
          onClick={() => onOpenTool('names')}
          aria-haspopup="dialog"
          className="btn"
          style={{ flex: 'none', minHeight: 'var(--tap)' }}
        >
          OPEN THE NAME GENERATOR
        </button>
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          People, places and regions, for the moment the players walk up to someone you had not
          planned. It knows what is already on the board and in tonight&apos;s list, so it will not
          hand you a name that is taken.
        </p>
      </div>

      <Campaigns
        campaigns={campaigns}
        activeId={activeId}
        onSwitch={(id) => {
          void switchCampaign(id);
          onClose();
        }}
        onNew={() => {
          void createCampaign();
          onClose();
        }}
        onRemove={(id) => void removeCampaign(id)}
      />

      {/*
        Keyed on the campaign, so the draft below belongs to the name above it.
        Switching closes this sheet today, which makes the key belt and braces -
        and it is the cheap half of the pair.
      */}
      {active !== null && (
        <Rename key={active.id} id={active.id} name={active.name} campaigns={campaigns} />
      )}

      <ThisDevice hydrated={hydrated} notices={notices} quarantined={quarantined} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Campaigns({
  campaigns,
  activeId,
  onSwitch,
  onNew,
  onRemove,
}: {
  campaigns: ReadonlyArray<{ id: string; name: string }>;
  activeId: string | null;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRemove: (id: string) => void;
}): React.JSX.Element {
  const [armed, setArmed] = useState<string | null>(null);

  // The same four seconds the session row's DELETE gives itself: long enough
  // to be a second deliberate tap, short enough that a campaign left armed in
  // a pocket is not one thumb away from gone.
  useEffect(() => {
    if (armed === null) return undefined;
    const timer = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <span className="t-label">CAMPAIGNS</span>
      <ul className="stack" style={{ gap: 6, margin: 0, padding: 0 }}>
        {campaigns.map((campaign) => {
          const open = campaign.id === activeId;
          const name = campaign.name.trim();
          return (
            <li
              key={campaign.id}
              className="row panel"
              style={{ flex: 'none', listStyle: 'none', gap: 8, padding: '2px 4px 2px 10px' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!open) onSwitch(campaign.id);
                }}
                aria-current={open ? 'true' : undefined}
                aria-label={open ? `${name || 'Unnamed campaign'} — open` : `Open ${name || 'Unnamed campaign'}`}
                className="row"
                style={{ flex: 1, minWidth: 0, minHeight: 44, gap: 8, textAlign: 'left' }}
              >
                <span
                  title={name === '' ? undefined : name}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    font: '700 15px/1.2 var(--sans)',
                    color: name === '' ? 'var(--dim)' : 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name === '' ? 'Unnamed campaign' : name}
                </span>
                {open && (
                  <span className="t-meta" style={{ flex: 'none', color: 'var(--hope)' }}>
                    OPEN
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (armed !== campaign.id) {
                    setArmed(campaign.id);
                    return;
                  }
                  onRemove(campaign.id);
                  setArmed(null);
                }}
                aria-label={`${armed === campaign.id ? 'TAP AGAIN TO REMOVE' : 'REMOVE'} — ${name || 'Unnamed campaign'}`}
                className="t-meta"
                style={{
                  flex: 'none',
                  minHeight: 44,
                  padding: '0 10px',
                  letterSpacing: '0.1em',
                  color: armed === campaign.id ? 'var(--damage)' : 'var(--dim)',
                  fontWeight: armed === campaign.id ? 600 : undefined,
                }}
              >
                {armed === campaign.id ? 'TAP AGAIN TO REMOVE' : 'REMOVE'}
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onNew} className="btn" style={{ flex: 'none', minHeight: 'var(--tap)' }}>
        NEW CAMPAIGN
      </button>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        Switching campaign never touches the characters you play — those live in their own store
        and are not owned by any table, so the same sheet can sit on two boards at once.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Rename({
  id,
  name,
  campaigns,
}: {
  id: string;
  name: string;
  campaigns: ReadonlyArray<{ id: string; name: string }>;
}): React.JSX.Element {
  const rename = useGm((s) => s.renameCampaign);
  const [draft, setDraft] = useState(name);
  const refusalId = useId();
  const trimmed = draft.trim();
  /*
   * The same function the character rename asks, on the same rule.
   *
   * This field used to enforce a rule of its own: *any* empty name refused,
   * *any* duplicate allowed. That is backwards in both directions. Two
   * campaigns called "The Sablewood Winter" are two rows in the list above that
   * nobody can tell apart, which is the whole failure; and refusing an empty
   * name on the only campaign on the device was refusing something that
   * collides with nothing, in words that did not match what the app says to a
   * player clearing a character's name three screens away.
   *
   * So: an empty name is refused exactly when something else already reads
   * "Unnamed campaign", and stored as `''` otherwise - never as the word, which
   * is the app's and not the GM's. `judgeName` writes both sentences.
   */
  const { refusal, offer } = judgeName(draft, campaigns, CAMPAIGN_NAMES, id);
  const held = refusal !== null || trimmed === name;

  return (
    // No `gap`: `NameRefusal` is mounted refusing nothing, and carries its own
    // 6px when it has something to say. See the rename control on the sheet.
    <div className="stack" style={{ flex: 'none' }}>
      <label className="stack" style={{ gap: 5 }}>
        <span className="t-meta">NAME OF THE OPEN CAMPAIGN</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={refusal !== null}
          aria-describedby={refusal === null ? undefined : refusalId}
          style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1.2 var(--sans)' }}
        />
      </label>
      <NameRefusal id={refusalId} refusal={refusal} offer={offer} onTake={setDraft} />
      <button
        type="button"
        disabled={held}
        onClick={() => rename(id, trimmed)}
        aria-label={refusal === null ? undefined : `Cannot rename: ${refusal}`}
        className="btn"
        style={{ flex: 'none', marginTop: 8, minHeight: 'var(--tap)', opacity: held ? 0.5 : 1 }}
      >
        RENAME
      </button>
      <p className="t-dense" style={{ margin: 0, marginTop: 8, color: 'var(--muted)', maxWidth: '62ch' }}>
        Only the open campaign can be renamed here. Open another campaign to rename that one.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * What this device did with the campaigns on it, which nothing had ever drawn.
 *
 * A quarantined campaign is named rather than counted, for the reason the
 * library's own quarantine gives: "one campaign could not be read" is a
 * sentence nobody can act on, and the person reading it has to know *which*
 * table is missing before they can decide whether it matters.
 */
function ThisDevice({
  hydrated,
  notices,
  quarantined,
}: {
  hydrated: boolean;
  notices: readonly string[];
  quarantined: ReadonlyArray<{ id: string; name: string | null; reason: string }>;
}): React.JSX.Element | null {
  if (hydrated && notices.length === 0 && quarantined.length === 0) return null;

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <span className="t-label">THIS DEVICE</span>
      {!hydrated && (
        <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
          The campaigns on this device are still being read. Nothing has been written yet.
        </p>
      )}
      {notices.map((notice) => (
        <p key={notice} className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          {notice}
        </p>
      ))}
      {quarantined.length > 0 && (
        <div className="panel stack" style={{ flex: 'none', gap: 6, padding: 12 }}>
          <span className="t-meta" style={{ color: 'var(--stress)' }}>
            LEFT UNTOUCHED
          </span>
          {quarantined.map((record) => (
            <p key={record.id} className="t-dense" style={{ margin: 0, maxWidth: '62ch' }}>
              <strong>{record.name ?? 'A campaign with no readable name'}</strong> — {record.reason}
            </p>
          ))}
          <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
            Nothing has been deleted. A newer version of this app wrote these, and this one will not
            open them rather than read them as its own shape and write that back over the original.
          </p>
        </div>
      )}
    </div>
  );
}
