/**
 * The one banner the shell draws, twice.
 *
 * `App.tsx` mounts `<UpdateBanner/>` and `<BackupBanner/>` as `flex: none`
 * children of `<main>`, above whichever screen is up. They had been written
 * separately and had ended up almost identical - the same `role="status"`, the
 * same `.spread` row, the same `8px 20px 0` margin, the same `6px 6px 6px 12px`
 * padding, the same 1px border, the same `.t-dense` message, the same
 * chip-and-dismiss pair - which is not the same thing as being one shape. Two
 * declarations that agree today drift tomorrow, and they had already drifted in
 * four places: the actions gap (4 against 6), the dismiss glyph and class, a
 * redundant `background` on one primary chip, and - the one that mattered - a
 * dismiss target that was 44px wide in one banner and **18.28px** in the other.
 *
 * So the box, the message slot, the two controls and the dismissal live here,
 * once. A banner declares only what is its own: whether it should be on screen
 * at all, whether it is urgent, its sentence, and what its one action does.
 *
 * ## The box, measured rather than intended
 *
 * 6 + 6 of padding and 2 of border around a row whose height is set by the two
 * buttons at `minHeight: var(--control)`. `--control` is `var(--tap)` = 44 under
 * `(max-width: 1179px), (pointer: coarse)` and 34 above it, so the border box is
 * **58px on a phone or tablet and 48px on the cockpit** - measured at 320, 344,
 * 360, 375, 393, 402, 430 and 1180 with the app running, and 58 again at 1180
 * when the pointer is coarse, because a touchscreen laptop reads the same
 * `--control`. The text does not set the height until it needs a third line: a
 * `.t-dense` line is 15.87px, two are 31.74 and fit inside the 44 with room,
 * three are 47.61 and push the banner to **61.58**, four are 63.48 and make it
 * **77.44**. Which sentence needs how many lines at which width is the banner's
 * own business and is written down in each of them.
 *
 * ## What a banner costs the screen under it is 66, and 58 is the wrong number
 *
 * `<main>` is a flex column with `minHeight: 0; overflow: hidden` and a banner
 * is a `flex: none` child of it, so the screen below loses the banner's whole
 * border box **and its 8px top margin**. `HANDOFF.md` and the commit that first
 * wrote this down carry **58**, which is the border box alone; what the Play
 * column actually loses is **66**. Measured, banner off → on, at every iPhone
 * width and identical at all four: 553→487 at 375×667, 738→672 at 393×852,
 * 760→694 at 402×874, 818→752 at 430×932. On a mouse cockpit the box is 48 and
 * the column loses 56 (729→673 at 1180×820). Where a sentence takes a third or
 * fourth line it is 70 or 85, and each banner records which of its own
 * sentences does that where.
 *
 * **Both at once is 132, measured rather than added up.** A new user with a
 * waiting worker gets both banners, and two stacked 8px margins are exactly the
 * case where the arithmetic would be wrong if they collapsed. They do not:
 * `<main>` is a flex container and flex items do not collapse margins. Measured
 * at 393×852, 738 with neither → 672 with the nag → **606 with both**; at
 * 375×667 it is 553 → 487 → 417, and at 320×568 454 → 384 → 299, where the two
 * extra costs are the update sentence's third and fourth lines.
 *
 * The other half of that correction is a convention, not a measurement. The
 * Play budget states its column **net** of the phone root's own 8px foot - 738
 * of glass is the documented 730 - so with a banner up the usable column is
 * 664, and the 697px folded sheet is **33px over rather than the 25 the head
 * commit carries**: the exact mirror of the +33 of slack the budget asserts
 * with no banner on the screen. 672 against 730 was two conventions compared,
 * and it understated the miss by precisely the 8px of margin.
 *
 * Neither `Play.tsx`'s budget docblock nor `playSheet.test.tsx` knows a banner
 * exists, and neither is this file's to edit. This is where the number is
 * measured; `tests/ui/banners.test.tsx` adds it up out of the declarations
 * above so it cannot drift, and the budget can take 66 from there.
 *
 * ## The message wraps and is never ellipsised
 *
 * This is the rule the backup nag was breaking: it declared `white-space:
 * nowrap` + `text-overflow: ellipsis` over `overflow: hidden` on a span that
 * carried both its clauses, so on every phone width it hid the eviction warning
 * and kept the status. The rule is here now rather than in one of the two
 * banners, because "the message is the payload and a truncated payload is a
 * lie" is not a fact about backups.
 *
 * There is deliberately no `overflow: hidden` and no `minWidth: 0` on the
 * message. A flex item with visible overflow keeps its automatic min-content
 * minimum - the longest word - and that floor is what makes a long sentence
 * wrap rather than be squeezed to nothing. Either of those two declarations
 * removes the floor, and with no ellipsis the text would then stop mid-word
 * with nothing on screen saying so: the same defect, quieter.
 *
 * ## Ergonomics
 *
 * **Targets.** Every control here declares `minHeight` and `minWidth` of
 * `var(--control)`, so all four buttons across the two banners are at least
 * 44×44 on touch and 34×34 on the cockpit, against WCAG 2.5.8's floor of 24.
 * Measured: BACK UP 55.89×44, RELOAD 49.63×44, both dismisses 44×44 at 320
 * through 430. `UpdateBanner`'s dismiss was **18.28×44** before this - a `.chip`
 * with `minHeight` and no `minWidth`, holding one glyph - which is below this
 * project's floor and below WCAG's, and nothing had ever seen it because no
 * measurement in the audit ever seeded a waiting service worker.
 *
 * **The gap between them is 6, not 4.** The two controls do opposite things:
 * one goes and does the thing, the other makes the reason go away. 6px is the
 * wider of the two values the banners had, and the extra 2px of separation is
 * bought on the side where a mis-tap is a dismissal you did not mean.
 *
 * **One dismiss, and it is the higher-contrast of the two the banners had.**
 * `.t-meta` on the inherited ink rather than a `.chip` on `var(--dim)`: the
 * glyph resolves to `--muted`, which is `#a6acb7` against `--dim`'s `#888e9c`
 * on the dark theme and `#575b68` against `#616979` on the light one - lighter
 * on dark, darker on light, so it is the better-contrasting choice in both
 * rather than a coin toss between two tokens. It is also the quieter of the two
 * *shapes*: a chip beside a chip reads as two peers, and these are not peers -
 * BACK UP and RELOAD are what the banner is for. One glyph too, `✕` in both,
 * where the update banner used `×`.
 *
 * **A dismissal lasts as long as the banner does.** The state is here, so it
 * survives every re-render of the banner's owner - a day ticking over on the
 * nag, a new `apply` on the update offer - and is discarded only when the owner
 * stops drawing a banner at all and starts again. That is the behaviour worth
 * having: what brings a dismissed banner back is a fresh reason, not a repaint.
 *
 * **Thumb arc.** These sit at the very top of `<main>` - y61 to y119 at every
 * phone width, 733px above the bottom bezel at 393×852 - which is the furthest
 * point on the screen from a thumb. That is right for a thing that is read
 * before it is touched and whose action is a decision rather than a reflex, and
 * it is the argument `App.tsx`'s `UnsavedWork` already makes for the same slot.
 * The reflex control is the dismiss, and neither dismissal costs anything that
 * cannot be got back - the nag returns on the next launch, the update on the
 * next cold start.
 *
 * **Read before touch.** The message is `.t-dense` at 11.5px on `--text-2`,
 * sized to be read at a glance and given every pixel the row has left after the
 * two controls have taken their floor.
 */
import { useState, type ReactNode } from 'react';

/** A button in a banner: what it says, and what it does. */
export interface BannerAction {
  label: string;
  onClick: () => void;
}

/**
 * The floor every control in a banner stands on.
 *
 * Declared for the primary chips as well as the dismisses, where it is a no-op
 * today - BACK UP is 55.89 wide and RELOAD 49.63 - because a floor that is only
 * declared where it currently binds is not a floor. A shorter label later
 * inherits it instead of quietly landing at 20px.
 */
const CONTROL = { minHeight: 'var(--control)', minWidth: 'var(--control)' } as const;

export function ShellBanner({
  urgent,
  action,
  dismissLabel,
  children,
}: {
  urgent: boolean;
  action: BannerAction;
  dismissLabel: string;
  children: ReactNode;
}): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="status"
      className="spread"
      style={{
        flex: 'none',
        alignItems: 'center',
        gap: 12,
        margin: '8px 20px 0',
        padding: '6px 6px 6px 12px',
        borderRadius: 'var(--r2)',
        background: urgent ? 'var(--hope-wash)' : 'var(--panel)',
        border: `1px solid ${urgent ? 'var(--hope)' : 'var(--line-soft)'}`,
      }}
    >
      <span className="t-dense" style={{ color: 'var(--text-2)' }}>
        {children}
      </span>
      <span className="row" style={{ flex: 'none', gap: 6 }}>
        <button
          type="button"
          className="chip"
          onClick={action.onClick}
          style={{ ...CONTROL, color: 'var(--text)' }}
        >
          {action.label}
        </button>
        <button
          type="button"
          className="t-meta"
          onClick={() => setDismissed(true)}
          style={CONTROL}
          aria-label={dismissLabel}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
