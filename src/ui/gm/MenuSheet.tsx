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
 * ## Four blocks, in the order a hand reaches them
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
 * and the party board are behind SHOW. The encounter builder had nothing, and
 * the live scene had only a chip that exists while adversaries are on the
 * board - so a GM improvising a fight had to ADD an encounter row, name it,
 * submit it, open it and press OPEN THE BUILDER, creating a plan row they may
 * not have wanted, where the old screen had a tab.
 *
 * The other three are deliberately *not* repeated here, and that is the same
 * rule Settings is kept out by: a second route to a destination that already
 * has one is a door nobody chose to build. The sentence under these two says
 * where those three are, so their absence is an answer rather than a gap.
 * **The rules** are second, and they are here rather than in the bottom bar for
 * the reason `Reference.tsx` gives at length: ADD and SHOW are the continuous
 * gestures of an evening and hold the thumb arc, while looking a rule up stops
 * play, happens once or twice a session, and is read rather than pressed. That
 * is the same kind of act as leaving the section or changing table, which is
 * what this sheet already is. It is the second block and not the last because
 * it is the one of the four a GM reaches for *during* a session.
 *
 * **The campaigns** are third. Switching, making a new one, renaming the open
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
 * **A campaign cannot be renamed to nothing.** `renameCampaign` trims, so an
 * empty name would be written straight through, and the list would then hold
 * two rows both reading "Unnamed campaign" with no way to tell them apart -
 * which is the same defect the character rename has open under P5-1(b). The
 * button refuses and the sheet says so in words rather than quietly restoring
 * the old name, because silently rewriting what somebody typed is the other
 * half of that defect.
 *
 * **Only the open campaign can be renamed here.** `patchCampaign` updates the
 * list in memory and schedules a write *only when the id is the active one*,
 * and `writeActive` gathers only the active record - so a rename typed against
 * any other row would look right until the next reload and then be gone. The
 * fix is in the store, not in this sheet, and until it is made the control is
 * not offered. The reason is written beside the list rather than left as an
 * absence somebody later "fixes" by adding the control.
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
 * thumb. The inner column is 393 - 28 = 365px.
 *
 *   the three destinations   three across at (365 - 16) / 3 = 116 x 56 each
 *   the two tools            two across at (365 - 8) / 2 = 178 x 56 each, the
 *                            same height as the row above them because they are
 *                            the same gesture: one tap, and the sheet is gone
 *   THE RULES AT HAND        full width, 365 x 44
 *   a campaign row           the name is the target, 365 - 44 - 8 = 313 x 44,
 *                            with REMOVE beside it as a 44px word
 *   RENAME / NEW CAMPAIGN    full-width, minHeight var(--tap) = 44
 *   the rename field         365 x 44, and it is the only keyboard on the sheet
 *
 * Read, not touched: every notice, every quarantined record, the "this device"
 * block entire, and the sentence explaining why a closed campaign has no rename
 * button. Touched: everything above.
 */
import { useEffect, useState } from 'react';
import { useApp, type Screen } from '../../store/state.ts';
import { useGm, type GmRegion } from './gmStore.ts';

/** Where MENU can go. Settings is deliberately not here - see the docblock. */
const WAYS_OUT: Array<{ id: Screen; label: string }> = [
  { id: 'play', label: 'PLAY' },
  { id: 'cards', label: 'CARDS' },
  { id: 'build', label: 'BUILD' },
];

/**
 * The tools nothing else on this screen can open.
 *
 * Not all five, and the two that are missing from the list are missing on
 * purpose: the bestiary and the party board are behind SHOW, Fear and the
 * countdowns is behind the readout that is always in the top bar, and none of
 * the three is switchable in the way that would make this list a hedge. These
 * two are the content of a row and nothing else, which was fine until a GM
 * wanted one without a row.
 */
const TOOLS: Array<{ id: GmRegion; label: string }> = [
  { id: 'encounter', label: 'THE ENCOUNTER BUILDER' },
  { id: 'scene', label: 'THE LIVE SCENE' },
];

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
        <div className="row" style={{ gap: 8 }}>
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
          writing a row for it first. The other three already have a way in and are not repeated
          here: Fear and the countdowns are behind the Fear number at the top, the bestiary and
          the party board are behind SHOW.
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
      {active !== null && <Rename key={active.id} id={active.id} name={active.name} />}

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

function Rename({ id, name }: { id: string; name: string }): React.JSX.Element {
  const rename = useGm((s) => s.renameCampaign);
  const [draft, setDraft] = useState(name);
  const trimmed = draft.trim();
  const blank = trimmed === '';

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <label className="stack" style={{ gap: 5 }}>
        <span className="t-meta">NAME OF THE OPEN CAMPAIGN</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1.2 var(--sans)' }}
        />
      </label>
      <button
        type="button"
        disabled={blank || trimmed === name}
        onClick={() => rename(id, trimmed)}
        className="btn"
        style={{ flex: 'none', minHeight: 'var(--tap)', opacity: blank || trimmed === name ? 0.5 : 1 }}
      >
        RENAME
      </button>
      {blank && (
        <p role="status" className="t-dense" style={{ margin: 0, color: 'var(--stress)', maxWidth: '62ch' }}>
          A campaign needs a name. Two called nothing at all are two rows in the list above that you
          cannot tell apart — so this refuses rather than quietly putting the old name back.
        </p>
      )}
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        Only the open campaign can be renamed here. A rename typed against any other row would sit
        in this window looking right and never reach the disk, because the store schedules a write
        for the open campaign alone — that is a bug to fix in the store, not a control to add here.
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
