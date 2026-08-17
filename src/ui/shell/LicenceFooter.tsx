/**
 * The licence notice, and it is the last thing in the screen's own scroll.
 *
 * One behaviour, on every screen, Play included. Not a fixed strip, not floated
 * to the bottom of a short list with `marginTop: auto`, not absent. You scroll
 * to the end of a page and there it is.
 *
 * ## Where it came from
 *
 * It used to live in `EmptyState` and nowhere else in the shell, which meant it
 * was on screen for exactly as long as somebody had no characters - so every
 * real user at every real table lost it permanently the moment they made one,
 * and the only remaining copy was at the bottom of Settings. Meanwhile
 * `Architecture.md` said twice that the attribution is *"sempre visibile nel
 * footer"* and there was no `<footer>` in the app at all. Nothing breaks at a
 * table over this; what it risks is the project, because the remedy for a
 * community-content licence that requires a notice to be *displayed* is a
 * takedown.
 *
 * P3-10 fixed the absence and left three behaviours behind it:
 *
 *   Cards, Build, Settings   a `flex: 'none'` sibling of the screen inside
 *                            `<main>` - a fixed strip above the tab bar, ~111px
 *                            of a 393px phone, permanently
 *   GM                       inside the session list's scroll but pushed down
 *                            with `marginTop: 'auto'`, which on a short list
 *                            looks and costs exactly like the fixed strip
 *   Play                     not drawn at all
 *
 * The owner, looking at the GM screen on a phone: *"I crediti in basso devono
 * essere visibili scorrendo alla fine di ogni pagina, non fisso o prende troppo
 * spazio per la lettura delle altre informazioni."* Three answers to one
 * question, and the two that cost a band are the two being objected to.
 *
 * ## SUPERSEDED: the argument for keeping Play out of it
 *
 * This file used to carry the following, and it is kept rather than deleted
 * because this project keeps its reversals visible:
 *
 *   > "So it sits inside `<main>`, as the last thing before the tab bar rather
 *   > than after it [...] and it is **not rendered on Play**. Play is laid out
 *   > to fit rather than to flow on a desktop and has been fought over for two
 *   > passes on a phone; 48px there is 6% of the sheet and 111px is a loadout
 *   > row. [...] What that leaves on Play is not nothing: `CompatibleIcon` is in
 *   > the header on every screen including this one, so the mark never leaves,
 *   > and the words are one tap away on any other tab. That is a deliberate
 *   > trade and it is the one thing here worth arguing with."
 *
 * It was argued with, and it loses on its own terms. Every number in it is
 * about a *fixed* strip: 111px taken off the top of the scroll window, forever,
 * on the one screen with the tightest budget in the app. Below the last fold of
 * a scrolling sheet it takes none of that - `PlayPhone`'s budget runs to the
 * bottom edge of the lineage fold and the notice is below it, so it costs the
 * sheet nothing that the sheet was ever counting. The trade the paragraph
 * describes therefore no longer exists, and what is left of it is a screen that
 * never displays a notice the licence asks to be displayed.
 *
 * ## What it costs now, which is a scroll position and not a band
 *
 * The notice is verbatim: 342 characters that cannot be trimmed. On a 393px
 * phone inside Play's column the text runs 393 − 24 of page padding − 22 for
 * the icon and its gap = 347px wide; Archivo at `.t-dense`, 11.5px/1.38,
 * averages about 5.4px per character, so 342 characters is ~1847px of text -
 * six lines, 95px, plus the 12px rule gap above and 18px below = ~125px. On a
 * 1024px tablet the same text is two lines, ~48px. There is no typographic
 * trick that beats this; 9px would fit it in 70px and this project's own type
 * ramp says Archivo never runs at 400 below 11.5px. Every pixel of it is now
 * below the last thing anybody scrolls for.
 *
 * ## It looks like content now, because it is content
 *
 * It used to carry `background: var(--panel)` and a full-bleed top border,
 * which is what a pinned chrome strip should look like. Inside a scroll region
 * that has its own side padding, a panel-coloured band inset by 12px reads as a
 * card that lost its panel - which is why `SessionList` had to cancel the
 * padding with negative margins to make it look right. So the background goes,
 * the horizontal padding goes with it, and what is left is a hairline rule and
 * muted text at the end of a page: the ordinary shape of a colophon, and one
 * that needs no call site to tell it how wide its container's gutter is.
 *
 * The 18px foot is not a round number. `Play`'s column carries `.scroll-fade`,
 * whose mask takes the last 18px of the box to transparent, so a notice ending
 * flush with the padding edge would have its final line faded out on the one
 * screen where it is newest. 18px of foot puts the last line clear of the mask.
 *
 * ## Who pays `env(safe-area-inset-bottom)`
 *
 * The inset is paid **once**, by whatever is genuinely last in the viewport:
 * two payments leave 34px of empty panel between them on an iPhone, and none
 * leaves the last 34px of the window under the home indicator.
 *
 * There are two facts and they compose. `TabBar` is the shell's own bottom bar
 * and is drawn on a phone, which this component can ask the media query about
 * itself. Everything else below a scroll is *screen-local* chrome that only the
 * screen knows it has - `GmBar` under the session list, and the wizard's and
 * the level-up's navigation rows - so those three screens say `pinnedBelow` and
 * the thing they pinned pays instead. Nothing else in the app pins anything
 * under its scroll, so the default is the common case and a screen that grows a
 * bar has one word to add.
 *
 * That is deliberately not the old `bottomMost` prop inverted for tidiness. The
 * old prop asked every call site to work out the *answer*; this one asks each
 * for the one *fact* it alone holds, and leaves the arithmetic in one place. A
 * screen cannot get it wrong by forgetting how wide a phone is.
 *
 * `tests/ui/attribution.test.tsx` sweeps every screen at both widths, and both
 * of Build's other two modes, counting the inline declarations of the inset in
 * the whole tree. It fails if the count is ever not one. That sweep is why
 * `TabBar`, `GmBar` and the two Build navigation rows now spell the payment
 * `calc(0px + env(...))`: jsdom's CSS parser drops a bare `env()` and drops any
 * shorthand containing one, so the property the owner actually asked for was
 * unobservable - `GmBar`'s docblock said outright that an assertion on it
 * "could never fail". Inside `calc()` the declaration survives, and the same
 * pixels come out the other end.
 *
 * ## Extracted from `App.tsx`, and why it had to be
 *
 * The GM chunk is lazily imported *by* `App.tsx`, so a GM component importing
 * `App.tsx` back for this would be a cycle. It is its own module, which is now
 * what lets seven scroll regions end with the same one line.
 */
import { ATTRIBUTION, CompatibleIcon } from '../shared/CompatibleMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';

export function LicenceFooter({
  pinnedBelow = false,
}: {
  /**
   * True when this screen pins chrome of its own under the scroll this notice
   * ends - `GmBar`, the wizard's nav, the level-up's nav. That thing is last in
   * the viewport, so it pays the home-indicator inset and this does not.
   *
   * Not "am I last": the tab bar is the shell's business and is asked below.
   */
  pinnedBelow?: boolean;
} = {}): React.JSX.Element {
  // The shell draws `TabBar` on a phone, and it pays the inset there. Above
  // 720px there is no tab bar, so unless the screen pinned something of its
  // own this notice is the last thing in the window.
  const phone = useIsPhone();
  const paysTheInset = !pinnedBelow && !phone;
  return (
    <footer
      className="row"
      style={{
        flex: 'none',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginTop: 18,
        paddingTop: 12,
        paddingBottom: paysTheInset ? 'calc(18px + env(safe-area-inset-bottom))' : 18,
        borderTop: '1px solid var(--line-soft)',
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
