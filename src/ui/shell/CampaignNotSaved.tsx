/**
 * The campaign failure, said on whatever screen the GM is actually looking at.
 *
 * `gmStore` has always known when a campaign will not reach the disk. Two
 * surfaces drew it and both are inside the GM section - the strip under
 * `GmTopBar` and the panel inside SAVE - so the sentence was only ever true
 * while the GM stayed put. Tap MENU → PLAY to read a player's sheet, or open
 * Cards because somebody asked what Rune Ward does, and the warning goes with
 * the screen. The tab still closes on the evening; nothing on it says so.
 *
 * This is the shell's copy, mounted from `App.tsx` beside the alert that does
 * the same job for the character store. It is the same shape as those on
 * purpose - a `flex: none`, `role="alert"` block at the top of `<main>`, on the
 * shared `SHELL_BLOCK_MARGIN` gutter - because a second shape for a shell-level
 * message is the thing `ShellBanner.tsx` was written to stop happening again.
 *
 * ## It is not drawn twice
 *
 * `App.tsx` mounts this only when the GM screen is *not* the one on show. The
 * GM screen keeps its own strip, which sits below the pinned top bar rather
 * than above it and is argued for where it is drawn; two blocks carrying one
 * store field, 40px apart, would be the app raising its voice rather than
 * saying something new. The condition is "the GM screen is what is rendered",
 * not `screen === 'gm'` - the first-run questions are drawn *instead of* all
 * five screens, and a GM whose library emptied mid-session would otherwise lose
 * the sentence again on exactly the screen that cannot show it.
 *
 * ## The heading names the section, and does not name the failure
 *
 * A reader of this block is by definition somewhere else - on Play, on Cards,
 * in Settings - so the first thing it has to say is where this came from. What
 * it must *not* do is summarise, and the GM screen's own `NOT ON THIS DEVICE`
 * is the demonstration: one of the **six** failures the store can report is a
 * delete that threw, where the campaign is emphatically still on this device
 * and still in the list. Six, counted rather than remembered - the aside write,
 * the board write, a read that failed, the first campaign of a device,
 * `createCampaign` and `removeCampaign`, each with its own sentence. The
 * heading here is true of all six, and the sentence
 * under it is the store's own words, which already say which one this is.
 *
 * That matters most for the aside failure. `writeAside` names the campaign,
 * because that write's subject is *not* the open board - "what is on this
 * screen is only in this tab" would be false and would point the GM at the
 * wrong table. Rewriting the store's sentence here is the one edit that could
 * reintroduce that, so this file does not have one to rewrite.
 *
 * ## Ergonomics, 393x852
 *
 * It sits at the top of `<main>`, under the header at y61 and above every
 * screen - the furthest point on the glass from a thumb, which is the right
 * place for a thing that is read before it is touched and whose one control is
 * a decision rather than a reflex. That is the same argument `UnsavedWork`
 * makes for the same slot, and the block is the same 10px/12px padding on the
 * same gutter, so the two stack without a seam when both are up.
 *
 * **The inner column is narrower than the "393 − 40 of gutter − 24 of padding =
 * 329px" that stood here, and by this block's own frame** - the same missing
 * hairline the two GM alerts in `Gm.tsx` have already dropped. `base.css` puts
 * everything on `box-sizing: border-box`, this block declares `border: '1px
 * solid var(--fear)'` alongside `SHELL_BLOCK_MARGIN` (`calc(20px + env(...))` a
 * side, so 20 each without a cutout) and its 12px of padding either side, so
 * that sum spends nothing for a pixel on each edge. How much column is left has
 * not been measured, and neither has the "five lines at `.t-dense`" the store's
 * longest sentence - the aside failure, which carries a campaign name - used to
 * be given here, because that count was made against the "329": both go to the
 * rig before anything leans on them. With the heading on two lines and the chip
 * the block is about 160px, and it is on screen only while the disk is
 * refusing. TRY AGAIN is a chip declaring `minHeight`/`minWidth` of
 * `var(--control)` inline, which is 44px under `(max-width: 1179px), (pointer:
 * coarse)` and 34 on a mouse cockpit, and deliberately not the full width of
 * the column: a full-width button at the top of a screen is something thumbs
 * hit on the way past, and pressing this twice while a write is in flight is
 * the one thing that should be hard to do by accident.
 *
 * Not dismissible, exactly as `UnsavedWork` is not. A dismissed warning about
 * work that is not saved is the false reassurance this app is not allowed to
 * give.
 */
import { useRetry } from '../shared/useRetry.ts';
import type { CampaignAlert } from './campaignAlert.ts';
import { SHELL_BLOCK_MARGIN } from './gutter.ts';

export function CampaignNotSaved({ alert }: { alert: CampaignAlert }): React.JSX.Element {
  const { retrying, failedAgain, again } = useRetry(alert.tryAgain);

  return (
    <div
      role="alert"
      className="stack"
      style={{
        flex: 'none',
        gap: 8,
        ...SHELL_BLOCK_MARGIN,
        padding: '10px 12px',
        borderRadius: 'var(--r2)',
        background: 'var(--fear-wash)',
        border: '1px solid var(--fear)',
      }}
    >
      <span className="t-label" style={{ color: 'var(--text)' }}>
        THE GM TOOLS CANNOT USE THIS DEVICE’S STORAGE
      </span>
      <span className="t-dense" style={{ color: 'var(--text-2)', maxWidth: '62ch' }}>
        {alert.message}
      </span>
      {/*
        Only where a retry does something. `writeRetry` is null for a delete
        that threw, and a TRY AGAIN over that one flushes the *open* campaign -
        which is not what failed and, when the doomed campaign is the open one,
        is the opposite of what was asked for. The store's sentence names the
        control that does help instead.
      */}
      {alert.retry !== null && (
        <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="chip"
            onClick={again}
            disabled={retrying}
            style={{
              flex: 'none',
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
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
