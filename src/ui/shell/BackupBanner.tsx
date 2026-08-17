/**
 * The backup nag.
 *
 * Safari's ITP can evict IndexedDB after roughly seven days of inactivity, and
 * `navigator.storage.persist()` is granted inconsistently. A group that plays
 * every three weeks would lose a character between sessions. So: a quiet line
 * that becomes loud at five days, and an offer to restore after seven.
 *
 * A character is months of someone's work. Losing it is the one unforgivable
 * bug in an app like this, and a discreet indicator is a cheap insurance
 * premium against it.
 *
 * ## The warning wraps. It used to ellipsise away the reason it exists
 *
 * One span carries both clauses: the state (`No backup yet`, `Last backup: 15
 * days ago`) and, when `navigator.storage.persisted()` has answered false, the
 * eviction warning ` · this browser may clear local data on its own`. It was
 * declared `white-space: nowrap` + `text-overflow: ellipsis` over `overflow:
 * hidden`, and the clause an ellipsis eats is always the last one - so the half
 * that was cut on every phone in the world was the half that says what the risk
 * is. A warning that hides its own reason cannot be acted on: `No backup yet ·
 * this browser may cl…` is a status line, not a warning.
 *
 * Measured in Chrome against the running app (seeded `wizard10`, no
 * `lastBackupAt`, `persisted()` false). The never-backed-up sentence is
 * 299.17px of natural width; the span is given `viewport − 176` (40 of margin,
 * 18 of padding, 2 of border, 12 of gap, 55.89 of BACK UP, 4 of the inner gap,
 * 44 of the dismiss), so what was hidden was **155.1px at 320, 131.1 at 344,
 * 115.1 at 360, 100.1 at 375, 82.1 at 393, 73.1 at 402, 45.1 at 430**, and the
 * sentence was whole only from 476px up. The days-ago variant is 354.83px and
 * was whole only from 531. There is no `title` and no second line, so on a
 * phone the text was unreadable by any means.
 *
 * ## Wrapping is free, which is why there was never a trade to make here
 *
 * The banner is 58px because its two buttons hold the row open at
 * `var(--control)` - 44px under `(max-width: 1179px), (pointer: coarse)` - plus
 * 6+6 of padding and 2 of border. The text is not what is being paid for: two
 * `.t-dense` lines are 2 × 15.87 = 31.74px and fit inside that 44 with 12px to
 * spare. Measured, with the banner up, before and after this change: the Play
 * column is **487 at 375×667, 672 at 393×852, 694 at 402×874 and 752 at 430×932
 * either way** - wrapping cost those widths nothing at all.
 *
 * It is not free everywhere, and the third line is where it stops being free.
 * At 360 and 344 the days-ago string takes three lines (47.61px, over the 44),
 * so the banner is 61.58 and the column pays **70 instead of 66**: 620 → 616 at
 * 360×800, 702 → 698 at 344×882. At 320×568 both strings do, and the column
 * goes 388 → 384. Four pixels, on the three widths where the folded sheet is
 * already 60-150px over, to make the warning readable at all. That is the whole
 * cost of this change.
 *
 * ## Why `overflow: hidden` went with the ellipsis, and why `minWidth: 0` is
 * not here to replace it
 *
 * A flex item with `overflow: visible` has an automatic minimum size: it cannot
 * be shrunk below its min-content width, which here is the longest word
 * (`browser`, ~44px). That floor is what makes the sentence wrap rather than
 * vanish. `overflow: hidden` removes the floor - the item may then be squeezed
 * to nothing - and with no ellipsis to mark it, text would simply stop
 * mid-word with nothing on screen saying so, which is the defect above wearing
 * a different mechanism. `minWidth: 0` does the same thing by hand. So neither
 * is here, on purpose: below the width where the buttons and one word no longer
 * fit, this row is allowed to look cramped, because a cramped warning can still
 * be read.
 *
 * ## Ergonomics, which the wrap does not move
 *
 * Targets, measured: BACK UP is 55.89×44 and the dismiss 44×44 at 320, 344,
 * 360, 375, 393, 402 and 430 - `var(--control)` is `--tap` = 44 under
 * `(max-width: 1179px), (pointer: coarse)` - and 55.89×34 and 34×34 on the
 * cockpit, where the pointer is a mouse and WCAG 2.5.8's floor is 24. Wrapping
 * changes neither: the row's height is the buttons' and their widths are their
 * own text plus `--control` as a minimum.
 *
 * Placement: y61 to y119 at every phone width, at the top of `<main>`, which
 * at 393×852 is 733px above the bottom bezel - the furthest thing on the screen
 * from a thumb. That is deliberate, and it is the argument `App.tsx`'s
 * `UnsavedWork` makes for the same slot: this is read before it is touched and
 * its action is a decision, not a reflex. The one reflex here is the dismiss,
 * and a stray dismiss costs nothing you cannot get back from Settings.
 */
import { useEffect, useState } from 'react';
import { NAG_AFTER_DAYS } from '../../store/backup.ts';
import { daysSinceBackup } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';

export function BackupBanner(): React.JSX.Element | null {
  const prefs = useApp((s) => s.prefs);
  const characters = useApp((s) => s.characters);
  const setScreen = useApp((s) => s.setScreen);
  const [dismissed, setDismissed] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const phone = useIsPhone();

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (dismissed || characters.length === 0) return null;

  const days = daysSinceBackup(prefs);
  const never = days === null;
  const urgent = never || days >= NAG_AFTER_DAYS;
  if (!never && days < 3) return null;
  /*
   * A phone has no vertical room to spare on Play, so the nag waits there
   * until it is genuinely urgent; Settings carries the same state permanently.
   *
   * "Urgent" has to include *never*. This read `days >= 5` with no `never`
   * clause, and `daysSinceBackup` returns null when there is no stamp - so the
   * one user who most needs telling, the one who has never exported anything,
   * was the one user a phone never told. Day 1 or day 90, it showed nothing.
   */
  if (phone && !urgent) return null;

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
        {never ? 'No backup yet' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
        {persisted === false && ' · this browser may clear local data on its own'}
      </span>
      <span className="row" style={{ flex: 'none', gap: 4 }}>
        <button
          type="button"
          className="chip"
          onClick={() => setScreen('settings')}
          style={{ minHeight: 'var(--control)', background: 'var(--raised)', color: 'var(--text)' }}
        >
          BACK UP
        </button>
        <button
          type="button"
          className="t-meta"
          onClick={() => setDismissed(true)}
          style={{ minHeight: 'var(--control)', minWidth: 'var(--control)' }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
