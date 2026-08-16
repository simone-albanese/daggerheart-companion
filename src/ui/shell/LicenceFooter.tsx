/**
 * The licence notice, on screens a real user actually reaches.
 *
 * It used to live in `EmptyState` and nowhere else in the shell, which meant it
 * was on screen for exactly as long as somebody had no characters - so every
 * real user at every real table lost it permanently the moment they made one,
 * and the only remaining copy was at the bottom of Settings. Meanwhile
 * `Architecture.md` says twice that the attribution is *"sempre visibile nel
 * footer"* and there was no `<footer>` in the app at all. Nothing breaks at a
 * table over this; what it risks is the project, because the remedy for a
 * community-content licence that requires a notice to be *displayed* is a
 * takedown.
 *
 * **Where, and the arithmetic behind it.** This is a read-only strip: no
 * control, no target, nothing to hit, so the 44px floor does not apply to it
 * and the thumb arc is not the question. The question is only how much vertical
 * room it costs the screen above it, and the answer is set by the notice being
 * verbatim - 342 characters that cannot be trimmed.
 *
 *   On a 393px phone the text column is 393 - 40 of padding - 22 for the icon
 *   and its gap = 331px. Archivo at `.t-dense`, 11.5px/1.38, averages about
 *   5.4px per character, so 342 characters is ~1847px of text: six lines, 95px,
 *   plus 16px of padding = ~111px. On a 1024px tablet the column is 964px and
 *   the same text is two lines, ~48px. There is no typographic trick that beats
 *   this; 9px would fit it in 70px and this project's own type ramp says Archivo
 *   never runs at 400 below 11.5px.
 *
 * So it sits inside `<main>`, as the last thing before the tab bar rather than
 * after it - a strip below `TabBar` would push the four navigation targets up
 * out of the arc they were placed in, which is the one thing this must not do -
 * and it is **not rendered on Play**. Play is laid out to fit rather than to
 * flow on a desktop and has been fought over for two passes on a phone; 48px
 * there is 6% of the sheet and 111px is a loadout row. Cards, Build and
 * Settings all scroll, so there the strip costs a scroll position rather than
 * content.
 *
 * **The GM screen scrolls too, and takes it the same way for the same reason -
 * but inside the scroll rather than above the bar.** That screen now has pinned
 * chrome at both ends, and 111px of the 653 that is not shell header is 17% of
 * it spent between the plan and the two verbs the GM uses all evening. What it
 * must not be is the thing that leaves: this notice is a licence obligation and
 * a layout budget is not a reason to drop one. So it moves into the session
 * list's own scroll region, which is exactly what the sentence above already
 * argues for three other screens - the strip costs a scroll position rather
 * than content. `App.tsx` therefore does not draw it on `gm`, and
 * `SessionList` does.
 *
 * What that leaves on Play is not nothing: `CompatibleIcon` is in the header on
 * every screen including this one, so the mark never leaves, and the words are
 * one tap away on any other tab. That is a deliberate trade and it is the one
 * thing here worth arguing with.
 *
 * ## Extracted from `App.tsx`, and why it had to be
 *
 * The GM chunk is lazily imported *by* `App.tsx`, so a GM component importing
 * `App.tsx` back for this would be a cycle. It is its own module now, which is
 * also what lets the two callers differ on the one thing they actually differ
 * on: who pays the home-indicator inset.
 */
import { ATTRIBUTION, CompatibleIcon } from '../shared/CompatibleMark.tsx';

export function LicenceFooter({
  bottomMost,
}: {
  /**
   * True when nothing in `<main>` follows this strip.
   *
   * `env(safe-area-inset-bottom)` is paid **once**, by whatever is last: two
   * payments leave 34px of empty panel between them on an iPhone, and none
   * leaves the last 34px of the window under the home indicator. In `App.tsx`
   * that is `!phone`, because `TabBar` follows on a phone and nothing does on
   * anything wider. Inside the GM screen's scroll it is always false, because
   * `GmBar` is below at every width and pays it there.
   */
  bottomMost: boolean;
}): React.JSX.Element {
  return (
    <footer
      className="row"
      style={{
        flex: 'none',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: bottomMost ? '8px 20px calc(8px + env(safe-area-inset-bottom))' : '8px 20px',
        borderTop: '1px solid var(--line-soft)',
        background: 'var(--panel)',
      }}
    >
      <span style={{ flex: 'none', paddingTop: 1 }}>
        <CompatibleIcon size={14} />
      </span>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: 760 }}>
        {ATTRIBUTION.join(' ')}
      </p>
    </footer>
  );
}
