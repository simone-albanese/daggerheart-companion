/**
 * The stage every GM tool now opens on - and it is a stage rather than a
 * window, which is the whole of this file's change.
 *
 * The GM screen used to be five regions behind a strip of tabs, so reaching the
 * bestiary meant leaving the plan. The plan is the screen now, and a tool is
 * something drawn *over* it and dismissed.
 *
 * ## What was wrong with drawing it over the window
 *
 * This panel was `position: fixed; inset: 0` with a 55% backdrop and
 * `useDialog`'s Tab trap, so while any of the twelve was open the GM screen's
 * own chrome was gone twice over. Covered: the `full` panel was opaque from
 * y 55.00 to the bottom of the window, and the `sheet` panel, capped at 85% of
 * a 797.00 content box, put its top edge at 174.55 - into the Fear row, which
 * `GmTopBar`'s declarations put at y 156.00 to 200.00. And unreachable:
 * `useDialog` scoped its stops to this overlay, so EVERY focusable outside it
 * came back `-1` from `stops.indexOf`, which the hook reads as *outside the
 * dialog* and pulls back in. The bar's own are the ones worth naming, because
 * they are on the glass on every night whatever the plan holds: MENU, Fear
 * `−`, the Fear readout, Fear `+`, ADD, SHOW and SAVE, plus a pinned
 * countdown's two. The rows of the plan underneath add however many that night
 * has.
 *
 * ("Of the eleven focusables on the screen, the seven outside it" stood here.
 * Eleven is the count of one unnamed fixture - `Gm` mounted alone on an empty
 * session - and not of a screen: a verifier counting a real one found thirteen
 * outside. The property is that the live controls are outside the overlay, and
 * it does not need a number; the number it had described something else.)
 *
 * `FearPool.tsx`'s docblock is the reason the Fear control exists and it says
 * the pool "stays there whichever region is open, because Fear is spent from
 * every one of them: to spotlight in the scene, to trigger a feature you are
 * reading in the bestiary". That sentence named the two regions where the
 * control was gone. It was true before this panel became a dialog; nothing was
 * moved when it did, and no test held it.
 *
 * ## What it is instead
 *
 * `Gm.tsx` gives the session list a `position: relative` stage between
 * `<GmTopBar>` and `<GmBar>`, and this overlay is `position: absolute; inset:
 * 0` inside it. That is the owner's second recorded decision for this screen -
 * *the night is a sheet, not a modal*, with the bar left on the glass under it:
 * the Fear pool, the pinned countdown and ADD/SHOW/SAVE.
 *
 * **The stage is derived, not declared, and that is deliberate.** The obvious
 * way to keep the bars clear is a fixed overlay inset by the height of the
 * chrome - `top: 209px`, or a variable that says so. Every one of those numbers
 * moves: with the safe area, with a pinned countdown (which takes `GmTopBar`
 * from 109.00 to 159.00), and at each of the three layouts. A number that moves
 * and is written down is a number that goes stale silently, which is the exact
 * failure the docblocks around this screen have paid for four times. Flexbox
 * already knows where the band is. So nothing here states an offset, and there
 * is no offset to correct.
 *
 * ## Two sizes, and why there are only two
 *
 * `full` is for every tool `GmRegion` names - Encounter, Scene, PartyBoard,
 * Bestiary, Countdowns, Reference, Names and Merchant, eight of them now.
 * ("Seven of them now" stood here, and before that five; the count in this
 * sentence has been wrong twice, which is a sentence asking to be written
 * without one.) All eight are built as whole screens - each one is `flex: 1;
 * min-height: 0` with its own scroll region inside - so anything smaller than
 * the stage makes them scroll twice. `Countdowns` at desktop width lays out
 * `1fr minmax(280px, 340px)` and `FearBoard` draws twelve pips across up to
 * 620px; in a 520px card both of those overflow sideways.
 *
 * `sheet` is for the short question: the bottom sheet a thumb reaches on a
 * phone, a 520px card on anything wider, and it is the default. All four sheets
 * it was written for use it - `Gm.tsx` mounts `MenuSheet`, `AddSheet`,
 * `ShowSheet` and `SaveSheet` inside it from the bottom bar. ("Nothing uses it
 * yet - the sheets that will (ADD, SHOW, SAVE, MENU) arrive with the bottom
 * bar" stood here; the bar arrived and the sentence did not move.) The size
 * decision still belongs to the shell rather than to each of them.
 *
 * ## THE PRICE, WHICH IS HEIGHT, AND IT IS NOT SMALL
 *
 * A `full` tool used to run the window: y 55.00 to 852.00 at 393x852 with a
 * 47px top inset, **797.00** of panel. On the stage it runs the band the
 * session list runs, which `SessionList.tsx` measures at **548.00** - the 852
 * less the shell header's 100.00, `GmTopBar`'s 109.00 and `GmBar`'s 95.00,
 * region y 209.00 to 757.00. So every full tool loses **249.00px**, which is
 * **31.24%** of what it had. With a primary countdown pinned `GmTopBar` is
 * 159.00, the stage is 498.00 (region 259.00 to 757.00), and the loss is
 * **299.00px** - **37.52%**.
 *
 * **That percentage is the panel's and it is not the content's.** Every one of
 * these eight pins chrome of its own above its own scroller - a filter row, a
 * heading, a topic strip - and that chrome does not shrink when the stage does,
 * so the box a GM actually scrolls does not keep the panel's proportion. WHICH
 * WAY it differs is measurement rather than arithmetic, and only one tool has
 * been measured: this wave's verifier took the bestiary in Chrome, same
 * campaign and same four adversaries in both builds, and its adversary scroller
 * goes **609 → 394** with nothing pinned and **609 → 344** with a countdown
 * pinned. Read against the 31.24% and 37.52% above, those are the larger share
 * of a smaller box - so the panel's percentage is the floor of what this costs
 * a GM, not the figure. The four numbers are the verifier's, taken in a
 * browser; they are quoted rather than re-derived, nothing here turns them into
 * a percentage of their own, and the other seven `full` tools have not been in
 * front of a browser at all.
 *
 * ("A quarter of the bestiary and a third of the scene" stood here. It read the
 * panel's percentage straight onto what a GM reads, which is the one place the
 * fixed chrome makes the two differ, and so it undersold the price in the
 * direction that flatters the change.)
 *
 * It is written here in the file that spends it rather than left for a GM to
 * discover, and it is spent knowingly: a tool that is 249px taller and
 * takes the Fear pool off the glass is not a bigger tool, it is a tool with the
 * one control the GM touches most often removed while it is open. Every one of
 * these eight scrolls; the pool does not.
 *
 * A `sheet` pays less and gains room to breathe: 85% of the stage is 465.80
 * against the old 677.45, and its top edge moves from 174.55 - inside the Fear
 * row - down to 291.20, clear of the bar entirely.
 *
 * `Merchant.tsx` records the other half of this, from the far end: a `full`
 * panel that ran to y 852.00 put its own controls inside the home-indicator
 * band, and that file says explicitly that the fix was "not this tool's" and
 * was gated on an overlay inset nobody had. This is that inset. The stage stops
 * at 757.00, `GmBar` below it pays `env(safe-area-inset-bottom)`, and nothing
 * inside a tool is in the indicator's band any more.
 *
 * ## Ergonomics, and the dismiss target a `full` tool does not get
 *
 * The title row is 44px and CLOSE is a 44x44 square at its right edge - the
 * corner a right thumb reaches by sliding up the edge rather than across the
 * glass, and the same corner every other dismissal in this app uses.
 *
 * **A `full` tool has no backdrop at all below 1100.** Not a smaller one: none,
 * and not only on a phone. The overlay declares `padding: full || phone ? 0 : 24`
 * - the `full` arm answers first, so the padding is 0 at every width - and the
 * panel inside is `flex: 1` with `width: '100%'` under `maxWidth: full ? 1100`.
 * That cap is the only thing that can expose a strip of `rgb(0 0 0 / 0.55)`, and
 * it does not bind until 1100. So there is nothing to tap at any width from a
 * phone up through the whole tablet band. Tap-outside-to-close is gone there,
 * and what is left is CLOSE and - for a keyboard - Escape. A phone has no
 * Escape key, so on a phone it is CLOSE, alone. ("The backdrop is also a
 * target: a tap outside the panel closes it. That surface is smaller than it
 * was" stood here, and for those eight it was describing a target of zero. This
 * paragraph then said "on a phone" for a whole revision, which was the same
 * mistake one scope wider: `phone` is `PHONE_MAX` 719 and the cap is 1100.)
 *
 * That is accepted rather than repaired, and the reason is the section above:
 * a dismissable margin can only come off the same band, and a margin thin
 * enough not to be noticed is a stripe that looks tappable and misses - 44px is
 * the floor a target has to clear to be one. Eight tools would each pay it, on
 * top of what they have already paid, to restore a gesture whose whole job
 * CLOSE already does, in a corner the same thumb is already going to. It is not
 * bought.
 *
 * So the whole of dismissal on a phone rests on one control, and it is sized
 * and placed for that: 44x44, at the panel's top-right, which under `full` is
 * the STAGE's top-right - below `GmTopBar` rather than up against the status
 * bar, so a right thumb slides up the right edge to reach it instead of arching
 * across the glass. And the hand is not trapped while it is open: `Gm.tsx`
 * leaves both bars live, so Fear, ADD, SHOW and SAVE are all reachable without
 * dismissing anything, which is the whole reason the stage exists.
 *
 * The cases that keep a backdrop keep the tap. A `sheet` on a phone caps at 85%
 * of the stage and leaves the band above it exposed; off a phone the overlay
 * pads 24 round a 520 card; and a `full` tool gets one only above 1100, where
 * the cap finally leaves something either side. What none of
 * them has any more is the surface the fixed overlay had, and that one was not
 * a loss: it ran over BOTH BARS, so a thumb aimed at Fear `+` or at ADD closed
 * the tool instead of pressing the button under it.
 *
 * **The panel's own 1px border is 2px off every column drawn inside it**, and
 * it is the pixel every docblock that ever costed a column in here dropped. At
 * 393 the panel's content box is 391.00, so a `full` tool padding 12px either
 * side has a 367.00px column (measured, `Reference.tsx`) and a `sheet` padding
 * 14 has 363px (measured, `ShowSheet.tsx`) - not the "369" and "365" that
 * `393 - 24` and `393 - 28` give. Anything reading a width off this panel
 * starts from 391, not from 393. **None of that moved with the stage**: the
 * change is vertical, the panel is still `width: '100%'` inside an overlay that
 * pads nothing horizontally, and every measured column on this screen is the
 * number it was.
 *
 * ## Not a modal, and it says so
 *
 * `useDialog(label, onClose, { modal: false })`. It keeps Escape, keeps the
 * focus return to the control that opened it, keeps `role="dialog"` and its
 * accessible name - and gives up the Tab trap and `aria-modal`, together,
 * because a node drawn *specifically* so that live controls sit outside it
 * cannot also tell a screen reader that nothing outside it exists. `useDialog`
 * argues that at length; the argument is answered rather than stepped around,
 * and answered in its own terms - the rule there is that the markup must be
 * true of the code, and here that rule takes the attribute off.
 *
 * What the trap was protecting against does not go unanswered either: the
 * session list under this panel is invisible under `full` and washed out under
 * `sheet`, and Tab must not walk into it. `Gm.tsx` marks it `inert` while
 * anything is open, which is the honest form of the same intention - what
 * cannot be seen is not a tab stop and is not in the accessibility tree - and,
 * unlike a trap, it leaves the two bars alone.
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
  const dialog = useDialog(label, onClose, { modal: false });
  const full = size === 'full';

  return (
    <div
      {...dialog}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'rgb(0 0 0 / 0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: full || phone ? 'flex-end' : 'center',
        alignItems: 'center',
        // Nothing at the top: the stage already starts below the shell
        // header and `GmTopBar`, so a safe-area payment here would be the
        // second one and would push the panel 55px down its own band. The
        // horizontal zero is unchanged, which is why every column measured
        // inside this panel still divides 391 and not 393.
        padding: full || phone ? 0 : 24,
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
