/**
 * The overlay every GM tool now opens inside.
 *
 * The GM screen used to be five regions behind a strip of tabs, so reaching the
 * bestiary meant leaving the plan. The plan is the screen now, and a tool is
 * something drawn *over* it and dismissed - which means the tool has to be a
 * real dialog rather than a panel that looks like one. `useDialog` is what
 * makes that true: it traps Tab, closes on Escape and puts focus back on the
 * control that opened it. Six overlays in this app carried `role="dialog"` and
 * did none of the three; this one does not add a seventh.
 *
 * ## Two sizes, and why there are only two
 *
 * `full` is for the five tools. Encounter, Scene, Bestiary, PartyBoard and
 * Countdowns are all built as whole screens - each one is `flex: 1;
 * min-height: 0` with its own scroll region inside - so anything smaller than
 * the window makes them scroll twice. `Countdowns` at desktop width lays out
 * `1fr minmax(280px, 340px)` and `FearBoard` draws twelve pips across up to
 * 620px; in a 520px card both of those overflow sideways.
 *
 * `sheet` is for the short question: the bottom sheet a thumb reaches on a
 * phone, a 520px card on anything wider. Nothing uses it yet - the sheets that
 * will (ADD, SHOW, SAVE, MENU) arrive with the bottom bar - and it is here
 * because the size decision belongs to the shell rather than to each of them.
 *
 * ## Ergonomics
 *
 * On a 393x852 phone the panel starts at the top safe area plus 8px and runs to
 * the bottom of the window, so a `full` tool gets 852 - 47 - 8 = 797px and its
 * own scroll. The title row is 44px and CLOSE is a 44x44 square at its right
 * edge - the corner a right thumb reaches by sliding up the edge rather than
 * across the glass, and the same corner every other dismissal in this app uses.
 * The backdrop is also a target: a tap anywhere outside the panel closes it,
 * which on a phone is 393px of forgiving surface above the panel.
 *
 * ## z-index 30, deliberately below 40
 *
 * Every other overlay in this app is 40, and `CardReader` is one of them.
 * Nothing in the GM screen opens a card reader today - a link row to a domain
 * card draws the card in the row rather than over the sheet, precisely so two
 * focus traps are never alive at once - but the next thing that wants to read a
 * card over an open tool must be able to, and a sheet at 40 or above would put
 * the card behind the sheet that produced it.
 */
import { useIsPhone } from '../shared/useLayout.ts';
import { useDialog } from '../shared/useDialog.ts';

export function GmSheet({
  label,
  onClose,
  children,
  size = 'sheet',
}: {
  /** The dialog's accessible name and its visible title. */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sheet' | 'full';
}): React.JSX.Element {
  const phone = useIsPhone();
  const dialog = useDialog(label, onClose);
  const full = size === 'full';

  return (
    <div
      {...dialog}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'rgb(0 0 0 / 0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: full || phone ? 'flex-end' : 'center',
        alignItems: 'center',
        padding:
          full || phone ? 'calc(env(safe-area-inset-top) + 8px) 0 0' : '24px',
      }}
    >
      <div
        className="stack"
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: full ? 1 : 'none',
          minHeight: 0,
          width: '100%',
          maxWidth: full ? 1100 : phone ? undefined : 520,
          maxHeight: full ? undefined : '85%',
          background: 'var(--app)',
          border: '1px solid var(--line)',
          borderRadius: phone || full ? 'var(--r4) var(--r4) 0 0' : 'var(--r4)',
        }}
      >
        <div
          className="row"
          style={{
            flex: 'none',
            gap: 12,
            padding: '0 6px 0 14px',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>
            {label}
          </span>
          <span className="keycap" aria-hidden="true">
            ESC
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${label}`}
            style={{ flex: 'none', width: 44, height: 44, color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>
        <div className="stack" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
