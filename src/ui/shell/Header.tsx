/**
 * The header states three things and then gets out of the way: which character,
 * which screen, and - where the line is wide enough to hold it - what this
 * device actually holds.
 *
 * That last clause is this file's whole layout problem, and it was bought at a
 * price nothing in the suite could see.
 *
 * The bar is one flex line with two groups: the app mark and the nav on the
 * left, the identity and the door to Settings on the right. The right group is
 * `flex: 'none'` and the left group carries `minWidth: 0`, so every pixel the
 * line is over-subscribed by comes off the left group's *box* - and none of it
 * off its contents, because a nav of four one-word buttons has nothing to give.
 * The nav therefore paints outside its own box, and the right group, being the
 * later sibling in the same stacking context, is painted over it and wins the
 * hit test. Nothing is positioned, nothing is transformed, and no test in this
 * repo can see it: the DOM is correct and only the pixels are wrong.
 *
 * Measured in Chrome at 744x1133 with a one-character library: the left group's
 * contents want a constant 330px and are allotted 210, GM is painted x295.9-349.8
 * and is 100% covered by the "SRD ONLY · NO ART" span, BUILD is 73% covered, and
 * `document.elementFromPoint` at either button's own centre returns the span.
 * The centre of GM is dead from 720 through 828, the last covered pixel goes at
 * 856, and the line stops being over-subscribed at 864. Below 720 none of this
 * exists, because the nav is not drawn and `TabBar` carries the same four
 * destinations - so the band where the collision lives is exactly the band where
 * `App.tsx` draws no tab bar and this nav is the only navigation the app has.
 *
 * So the readout is the thing that yields. It is read and never touched; the nav
 * is touched and has to be reachable. It yields by band and not by pixel: the
 * clean width is 856 and inventing an 856 or an 864 breakpoint here is precisely
 * the drift `useLayout.ts` was written to stop, so this uses the band boundary
 * that already exists. What a tablet loses is said out loud rather than
 * discovered: Settings > Rulebook prints the same total, `CompatibleIcon` is
 * unconditional at every width, and `LicenceFooter` still ends every screen's
 * own scroll.
 *
 * ## The display cutout, which this bar has never paid for
 *
 * `grep -rn 'safe-area-inset-left\|safe-area-inset-right' src/` returned zero
 * hits across the whole tree. The app has paid `-top` here and `-bottom` in
 * three bars since it was written, and has never once paid the horizontal pair
 * - which on a notched or Dynamic-Island iPhone **held in landscape** is where
 * the cutout is.
 *
 * The inset is symmetric, and this paragraph used to say it was not. iOS
 * reports `env(safe-area-inset-left)` AND `env(safe-area-inset-right)` at the
 * same non-zero value in landscape: UIKit insets both long edges so that a
 * 180-degree rotation does not reflow anything, and WebKit mirrors the view's
 * insets into `env()`. Only portrait has a zero on the horizontal pair, which
 * is why the tab-bar half of this measurement came out right. The earlier
 * version of this docblock stated as measured fact that iOS reports one side
 * "and the other side as 0"; every number derived from it below was a
 * one-sided number, and they are redone here on the symmetric model.
 *
 * Measured in Chrome through the audit rig at 852x393 - an iPhone 14/15 in
 * landscape, which `useLayout.ts` names in its own comments - with 59px
 * substituted on BOTH sides, that being the figure this audit measured for the
 * *top* inset in portrait on the same class of device and the same physical
 * cutout seen edge-on. The header's padding was `0 20px`, so both strips were
 * live in the same frame, in either rotation:
 *
 *   The RIGHT strip, [793, 852]. SETTINGS is laid out at [777.6, 832], 54.4px
 *     wide, so **39.0px of it - 71.7% - is inside the cutout**, leaving 15.4px
 *     of visible, aimable glass on the only permanent door this app has to
 *     export, import, backup and print. The overlap is `inset - 20`, the
 *     padding this bar already had, so it does not change with the viewport:
 *     measured identically at 932x430.
 *   The LEFT strip, [0, 59]. The app mark is at [20, 40.8] and is **100%
 *     inside it**. PLAY, the first nav button, starts at 62.8 and clears the
 *     strip by 3.8px - so the nav was never the casualty on that side, and the
 *     audit's "the header's left group runs under the cutout" is true only of
 *     the 20.8px mark.
 *
 * Those are one case and not two. The earlier write-up reported the left one
 * as a partial refutation of the finding - "only the mark, and only in the
 * other rotation" - which the symmetry removes: the mark was buried and the
 * door was 71.7% gone at the same instant, however the phone was held. What
 * survives of the refutation is the word "group": the nav cleared the strip
 * by 3.8px and was never a casualty.
 *
 * The fix is the two padding longhands below, and it is deliberately no more
 * than that: `env()` resolves to 0px on every device without a cutout and in
 * jsdom, so this is a change nobody can observe on this machine, and a layout
 * restructured around a number that cannot be watched is how a real-device pass
 * gets wasted. Padding that resolves to 0 everywhere else is the conservative
 * shape of the same fix.
 *
 * It is paid HERE and not on `.app` or on `<main>`, and that is the whole
 * design decision. This `<header>` is one of exactly two things in the shell
 * that paint a `--panel` background to the physical screen edge. Padding on
 * this element moves the *contents* in and leaves the background painting edge
 * to edge, which is the native convention and the thing a bar is supposed to do
 * under a cutout; padding on an ancestor would stop the panel colour 59px short
 * of the glass and draw a strip of `--app` beside it.
 *
 * WHAT `<main>` OWNS, said correctly this time. This used to read "`main` is
 * transparent and owns no content of its own, so the screens inside it are
 * their own files' half of this", and the second half of that is wrong.
 * `App.tsx` renders seven blocks directly inside `<main>`, above every screen
 * and below this bar: `UnsavedWork`, `CampaignNotSaved`, the storage-error
 * alert, the integrity alert, the quarantined-characters alert, and
 * `UpdateBanner` and `BackupBanner` through `ShellBanner.tsx`. (The line numbers
 * that used to be written beside the first four were wrong within two commits
 * of being typed; the names are searchable and do not rot.) None is a screen;
 * all seven are shell chrome, and six of them were hard-coded to
 * `margin: '8px 20px 0'`. Measured at 852x393 with 59 on both sides,
 * `BackupBanner` rendered at [20, 832] and its box was identical with the insets
 * at 0 - it did not move, so its first 39px sat inside the left strip while this
 * bar 8px above it was correctly inset to 79. The two gutters used to line up at
 * 20 and had stopped.
 *
 * So the unpaid surface was in two columns and neither is "the Cards filter
 * rails", which is what this file used to name.
 *
 *   Shell chrome: those six margins. DONE - they take `SHELL_BLOCK_MARGIN` from
 *     `gutter.ts` now, which is the same two `calc()` strings this bar's padding
 *     uses, from the same file, so the two cannot drift again. The repair was
 *     proposed here as a `margin` shorthand carrying `env()`; that would have
 *     been wrong for the reason stated thirty lines below, since jsdom drops
 *     such a shorthand whole and would have taken the 8px top margin with it.
 *     Four longhands, as this bar pays its padding. The right strip is why it
 *     was worth doing rather than recording: `ShellBanner`'s dismiss ✕ is a
 *     44x44 target at [781, 825] against a strip starting at 793, so 32 of its
 *     44px - 72.7% - were inside the cutout, leaving 12px of glass. That is a
 *     worse casualty than the SETTINGS button this bar's own fix was written
 *     for, which kept 15.4.
 *   Screens: measured on Play at 852x393 with 59 on both sides, `<main>`'s
 *     only other child is the column at [0, 852] and it pays nothing. ROLL
 *     2d12 sits at [12, 788] with 47px of its left end under the left strip;
 *     the Agility trait button at [12, 138.7], 37% of it under; the HP and
 *     Hope tracks at [12, 327]; six section headers at [12, 840]. At the other
 *     end MODS, the trait-help button and the three `+` steppers are each
 *     44x44 at [796, 840], which is *entirely* inside a right strip that
 *     starts at 793.
 *
 * That second list is the half inside the thumb arc, and it is the half that
 * is left. This bar's own casualties were at the top of the glass and outside
 * every arc; Play's are the controls a thumb actually lands on mid-scene. A
 * reader of this file should not come away thinking the cutout is paid.
 *
 * `calc(20px + env(...))` and not a bare `env()` in a `padding` shorthand: this
 * is the idiom `TabBar.tsx` established and the reason is testability at both
 * ends. jsdom's CSS parser drops a bare `env()` and any shorthand containing
 * one, so the declaration reads back as `''` and no assertion can fail on it;
 * and the audit rig substitutes insets by rewriting inline `style` attributes,
 * so a value hidden in `tokens.css` behind a custom property could never be
 * measured again. `paddingTop` is converted to the same form here - it computes
 * the same pixels and it is the first time that declaration has been visible to
 * the suite at all.
 *
 * ## THE FALLBACK THIS GAVE UP, AND WHY IT IS NOT OWED
 *
 * Written down rather than fixed, with the evidence, because it is unreachable.
 *
 * `padding: '0 20px'` gave 20px side gutters unconditionally. These two
 * longhands do not: a CSS parser that has never heard of `env()` drops the whole
 * declaration, so such a browser would get **zero** side padding on this bar
 * where it used to get 20. The standard repair is the shorthand first and the
 * longhands after it, so the 20 survives the drop. It is not written here
 * because the browser it protects does not exist in this app's supported set,
 * and the set is defined by what the app already requires without a fallback:
 *
 *   - `base.css:222` declares `.app { height: 100svh }` and nothing else. `svh`
 *     shipped in Safari 15.4 and Chrome 108. Drop that declaration and the whole
 *     shell grid has no height.
 *   - nine `color-mix(in srgb, ...)` backgrounds across `Play`, `DomainCardView`,
 *     `Conditions`, `DeathMove`, `Beastform` and `Companion`, none with a
 *     fallback colour. `color-mix()` shipped in Safari 16.2 and Chrome 111.
 *
 * `env(safe-area-inset-*)` shipped in Safari 11.2 and Chrome 69, four years
 * before either. A browser that parses `svh` and `color-mix()` but not `env()`
 * would have to be four years newer and four years older at once. And a browser
 * that fails all three does not lose a 20px gutter here - it loses the app's
 * height and every washed background in it.
 *
 * Six overlays make the point sharper still. `GearPicker`, `DomainCardView`,
 * `Conditions`, `DeathMove`, `Beastform` and `Companion` each declare a `padding`
 * SHORTHAND carrying `env()` (`max(10px, env(safe-area-inset-top)) 10px ...`),
 * and a parser that does not know `env()` drops each of those whole - taking
 * every side's padding with it, not merely an inset. So the hypothetical browser
 * loses far more elsewhere than a fallback here could return, and repairing this
 * bar alone would leave the same shape in six places while implying it had been
 * dealt with. `tests/ui/safeArea.test.ts` asserts these exact declared values on
 * purpose; adding a shorthand above them would change what that file reads back
 * and buy nothing any real device can use.
 *
 * ERGONOMICS, and landscape is the case, so this reasons about landscape. At
 * 852x393 both thumbs are on the short edges and the arc each sweeps is wide
 * and shallow, anchored at its own bottom corner; the cutout takes a
 * full-height strip down BOTH of those edges at once, so each thumb rests
 * against one. Nothing this bar holds is *in* either arc - the row is y4-48,
 * at the top of the glass, which is the right home for navigation you reach
 * for deliberately and the reason the corner was chosen for SETTINGS in the
 * first place. So this is not a reach failure, it is worse and it was worse at
 * both ends simultaneously: an aimed 54.4px target 71.7% invisible on the
 * right, and the 20.8px app mark wholly buried on the left, in one frame. A
 * control you must look at to hit, and cannot see, is worse than one out of
 * reach.
 *
 * After the fix, measured at 852x393 with 59 on both sides: SETTINGS is
 * [718.6, 773] against a strip that starts at 793 - zero overlap, 54.4x44 of
 * visible glass, clearing this repo's own 44px floor (`--tap`; `tokens.css`
 * resolves `--control` to it under `(max-width: 1179px), (pointer: coarse)`,
 * and a phone in landscape answers both) in both axes rather than in one. The
 * app mark is [79, 99.8], clear of [0, 59]. The nav's four buttons shift
 * inward by the inset - PLAY from 62.8 to 121.8 - and that is toward the
 * centre of the left thumb's sweep, not away from it, so nothing here loses
 * reach to buy this. Read-versus-touch is unchanged: the app mark and the
 * identity line are read, the nav and SETTINGS are touched, and both classes
 * move inward by the same amount, so what is read still sits above and outside
 * what is reached.
 *
 * WHAT IT COSTS IN PIXELS, on the symmetric model. The content box is
 * `width - 40 - insetLeft - insetRight`, so in landscape it loses twice the
 * inset, and nothing at all on a device without a cutout or on either
 * orientation of an iPad. The worst line this bar can be asked for is the one
 * derived at the foot of this file: 329.8 (left group) + 8 (gap) + 318.4
 * (right group at the 220px name cap) = 656.2. That is by painted rect; by
 * content it is 330 + 8 + 318.4 = 656.4, which is where the 0.2px between the
 * two sets of figures in this file comes from.
 *
 * Measured at 812x375 - an iPhone 12/13 mini in landscape, the narrowest
 * notched phone there is - with a name long enough to bind the 220px cap:
 *
 *     insets     padding    content box    slack at the cap
 *      0 / 0      20/20         772             115.8
 *     44 / 44     64/64         684              27.8
 *     50 / 50     70/70         672              15.8
 *     59 / 59     79/79         654              -2.2
 *     0 / 59      20/79         713              56.8
 *
 * The last row is the one-sided model, and 56.8 is the number this paragraph
 * used to print as the worst case. On the symmetric model at the same viewport
 * and the same 59 the line is over-subscribed again and this file's signature
 * failure returns: the left group's box measures [79, 406.6] with a
 * clientWidth of 328 against a scrollWidth of 330, and its `<nav>` paints to
 * 408.8 - 2.2px outside its own parent, into the 8px between the groups. The
 * one-sided control at the same viewport shows none of it: box [20, 349.8],
 * clientWidth 330, scrollWidth 330.
 *
 * Nothing on shipping hardware reaches that -2.2, and the margin is thinner
 * than it reads. Every Dynamic-Island phone - the class the 59 was measured on
 * - is 852 or wider in landscape, where the same 59 on both sides still leaves
 * 37.8px (measured), and 117.8 at 932x430. The devices that are 812 wide in
 * landscape are notched rather than Dynamic-Island and the figure usually
 * quoted for those is 44, which leaves 27.8. But 50 already leaves 15.8, and
 * this band's floor elsewhere is the 23.8px at 720x1133 (measured, same rig,
 * same name), so anything above about 46 per side at 812 would make
 * phone-in-landscape the app's worst line rather than the narrowest tablet.
 *
 * TWO THINGS HERE ARE UNVERIFIED ON HARDWARE, and the budget rests on both.
 * The magnitude: 44 or 50 or 59 per side, per device class, none of it read
 * off a phone - the 59 is this audit's own portrait top-inset figure reused
 * edge-on. And, until this rewrite, the shape: one side or both. The shape is
 * now taken to be symmetric because insetting both long edges is what keeps a
 * 180-degree rotation from reflowing a layout, which is reasoning rather than
 * a reading. Both belong in the one on-device pass this fix gets, and the
 * doc-delta records them together.
 *
 * The viewport meta is untouched and was already right: `index.html` says
 * `width=device-width, initial-scale=1, viewport-fit=cover`, and without that
 * `viewport-fit=cover` iOS letterboxes the page and every `env()` in this repo
 * is 0. It is the precondition for all of this and nothing asserted it, so
 * `tests/ui/safeArea.test.ts` does now.
 */
import { allowedScreen } from '../../store/prefs.ts';
import { GUTTER_LEFT, GUTTER_RIGHT } from './gutter.ts';
import { useActive, useApp } from '../../store/state.ts';
import { AppMark } from '../shared/DomainMark.tsx';
import { CompatibleIcon } from '../shared/CompatibleMark.tsx';
import { useLayout } from '../shared/useLayout.ts';
import type { Screen } from '../../store/state.ts';

const SCREENS: Array<{ id: Screen; label: string }> = [
  { id: 'play', label: 'Play' },
  { id: 'cards', label: 'Cards' },
  { id: 'build', label: 'Build' },
  { id: 'gm', label: 'GM' },
];

export function Header({
  onboarding,
}: {
  /*
   * Whether the first-run questions are up, decided by `App` and never here.
   *
   * This bar carries the mark and nothing else while they are - no nav, and no
   * door to Settings either.
   *
   * The paragraph on the SETTINGS button below says the GM filter may never
   * take that door away, because Settings is the screen the section is switched
   * back on from. That argument is about a *preference*, which is permanent
   * until somebody changes it back and therefore must never be able to remove
   * its own remedy. This is not that: onboarding is at most three taps long, it
   * always has a Skip in its own nav, and it writes `onboarded` the moment it
   * ends. The door is a few seconds away rather than gone.
   *
   * Leaving it live is the worse option, and not by a little. Onboarding is
   * drawn instead of all five screens, so a tap on SETTINGS would either do
   * nothing at all - a dead control on the first screen anybody sees - or land
   * somebody on a Settings screen with no tab bar, no nav here and no way back:
   * exactly the trap the paragraph below exists to prevent, arriving through
   * the door it protects.
   *
   * A prop rather than a second call to `needsOnboarding`, because the second
   * call is what went wrong. This file computed the gate without the
   * pasteboard-bridge term `App` applies, so on an installed iOS or iPadOS app
   * with an empty library the shell drew the ordinary screens while this bar
   * stripped both the nav and the SETTINGS door - the trap above, arriving on
   * the one device the recovery screen was written for, in the state it was
   * written for. Two expressions cannot disagree if there is only one.
   */
  onboarding: boolean;
}): React.JSX.Element {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const characters = useApp((s) => s.characters);
  const activeId = useApp((s) => s.activeId);
  const select = useApp((s) => s.select);
  const layers = useApp((s) => s.layers);
  const active = useActive();
  const index = useApp((s) => s.index);
  const prefs = useApp((s) => s.prefs);
  // One band answer for the whole file, from the one place that defines the
  // bands: phone is below 720, desktop is 1180 and up, tablet is what is left.
  const layout = useLayout();
  const phone = layout === 'phone';
  const desktop = layout === 'desktop';

  const hasManual = layers.some((l) => l.priority > 0);
  /*
   * The same filter the tab bar applies, for the same reason and by the same
   * rule: this nav is the desktop's only navigation, so an entry pointing at a
   * screen the shell substitutes away would be a button that appears to do
   * nothing at all. Filtering only the phone's bar would have left exactly that
   * on every laptop.
   */
  const screens = SCREENS.filter((s) => allowedScreen(prefs, s.id) === s.id);

  // Both classes, when there are two: a multiclassed character is two classes
  // and the line that says who they are should say so.
  const klass =
    active === null
      ? ''
      : [active.classRef, active.multiclassRef]
          .map((r) => (r === null || r === '' ? undefined : index.classes.get(r)?.name))
          .filter(Boolean)
          .join(' / ');

  return (
    <header
      className="spread"
      style={{
        height: 52,
        flex: 'none',
        alignItems: 'center',
        /*
         * Four longhands rather than a shorthand and an override. See "The
         * display cutout" above: the two horizontal ones are new and each
         * resolves to the bare 20 on every device without a cutout, and
         * `paddingTop` changes only its spelling - `calc(0px + env(...))`
         * computes the same pixels a bare `env()` did and is the first form of
         * it jsdom keeps. Longhands because a `padding` shorthand carrying an
         * `env()` is dropped whole by that parser, which would take the two
         * ordinary 20s down with it in every test.
         *
         * The two horizontal values come from `gutter.ts` rather than being
         * written out here, and the seven shell-chrome blocks inside `<main>` take
         * their margins from the same file. They are one gutter and they had
         * drifted 59px apart under a cutout; a shared constant is the only
         * version of "identical" that cannot be broken by a typo.
         */
        paddingTop: 'calc(0px + env(safe-area-inset-top))',
        paddingRight: GUTTER_RIGHT,
        paddingBottom: 0,
        paddingLeft: GUTTER_LEFT,
        boxSizing: 'content-box',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--panel)',
      }}
    >
      <div className="row" style={{ gap: 22, minWidth: 0 }}>
        <AppMark />
        {!phone && !onboarding && (
          <nav className="row" style={{ gap: 4 }}>
            {screens.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScreen(s.id)}
                aria-current={screen === s.id ? 'page' : undefined}
                style={{
                  padding: '7px 16px',
                  minHeight: 'var(--control)',
                  borderRadius: 'var(--r2)',
                  background: screen === s.id ? 'var(--raised)' : 'transparent',
                  font: `${screen === s.id ? 700 : 600} 12px/1 var(--sans)`,
                  letterSpacing: '0.09em',
                  color: screen === s.id ? 'var(--text)' : 'var(--dim)',
                  textTransform: 'uppercase',
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="row" style={{ gap: 14, flex: 'none' }}>
        {/*
         * `desktop`, not `!phone`, and this is the line that gives the nav its
         * pixels back.
         *
         * Arithmetic, measured rather than estimated. The bar's content box is
         * `width - 40` - and, since the cutout section above, `width - 40 -
         * insetLeft - insetRight`, which is the same number on every device
         * that has no cutout and on both orientations of every iPad. Every
         * figure below is at zero insets, which is the band this paragraph is
         * about: 720-1179 is reached by tablets in portrait and by phones in
         * landscape, and it is only the second of those that has an inset to
         * pay - and it pays it on both sides at once, so the box loses 2x, not
         * 1x. The landscape case is worked through in the table at the foot of
         * the cutout section: its worst line keeps 37.8px of slack at 852x393
         * and 27.8 at 812x375 with 44 per side, while 812 with 59 per side is
         * the one pair in the table that goes negative.
         *
         * The left group's contents are a constant 330 (app mark
         * 20.8 + gap 22 + nav 287.2), the gap between the groups is 8, and the
         * right group is 485.7 with a ten-character name and 545.6 with
         * "Bartholomew Ashworth". At 720 that line wants 823.7 of 680, so it is
         * over-subscribed by 143.7 and the left group - the only one that may
         * shrink - is allotted 186 for 330 of content. These four children and
         * four of the row's 14px gaps are 301.5 of that, measured: dropping them
         * below 1180 leaves a right group of 184.2 with a ten-character name,
         * 244.1 with "Bartholomew Ashworth", and 318.4 at the 220px name cap
         * where it stops growing. So the worst line the band can ask for is
         * 330 + 8 + 318.4 = 656.4 against 680 at the narrowest tablet width -
         * 23.6px of slack by content width, 23.8 measured between the two
         * painted boxes, and 47.6 at 744. The over-subscription is not
         * reduced, it is gone, at every width in the band and at any name.
         *
         * Ergonomics. The nav sits in a 52px bar at the very top of the glass:
         * y4-48, which on an iPad mini in portrait is ~1085px above the bottom
         * bezel and outside every thumb arc there is. That is the right home for
         * navigation you reach for deliberately and the wrong one for anything
         * mid-roll - but a target you have to reach for AND cannot hit is the
         * worst of both, and that is what GM was. All four buttons are already
         * 44px tall (`minHeight: var(--control)`, which tokens.css resolves to
         * --tap = 44 below 1180 and on any coarse pointer) and 53.8 to 79.9 wide
         * - GM, the narrowest, clears the 44px floor in both axes - so nothing
         * here needs to grow. It needs to stop being painted over.
         *
         * What is given up: a tablet no longer sees at a glance whether the
         * Core Rulebook import landed. The phone band has never shown it,
         * Settings > Rulebook prints the same total, and the alternative was
         * shrinking or wrapping a nav that is 44px on purpose.
         */}
        {desktop && (
          <>
            <span className="t-meta">{hasManual ? 'SRD + CORE RULEBOOK' : 'SRD ONLY · NO ART'}</span>
            <span style={{ color: 'var(--line)' }}>|</span>
            <span className="t-meta">
              LOCAL · {characters.length} CHARACTER{characters.length === 1 ? '' : 'S'}
            </span>
            <span style={{ color: 'var(--line)' }}>|</span>
          </>
        )}
        {/*
         * Who you are, beside the door to Settings.
         *
         * It belongs in the top bar precisely because it is read and never
         * touched: the top corner of a phone is the hardest place to reach
         * one-handed, which makes it the right home for a label and the wrong
         * one for a control - and it costs the Play screen, where every pixel
         * is contested, nothing at all.
         *
         * With one character this is a name, which is new: the picker below
         * only rendered from two characters up, so a player with a single
         * character - the ordinary case - had their own name nowhere in the
         * chrome. With several it is the picker, in the same place, because
         * "which character" and "who is this" are the same question asked once.
         *
         * It moved here from the left row because that row was losing the width
         * contest - and moving it did not settle the contest, it changed who
         * lost. This paragraph used to end "so this control was being painted
         * over from the tablet band up", in the past tense, over a header where
         * the same thing was still happening to the nav: the row wants 330 and
         * was allotted 234 at 768, and what the right group was painted over was
         * BUILD and GM. The move made the right group 485.7px wide, which is the
         * other half of why. The readout leaving the tablet band above is what
         * actually settles it; this control stays here, where it is read.
         *
         * The cap and the ellipsis are what stop a long name doing the same
         * thing to the Settings button, and the phone cap is viewport-relative
         * because that button is now about 11px wider than MENU was. The row
         * costs cap + 14 + 16 (the compatibility mark) + 14 + the button, out
         * of viewport - 40 of padding, less 27 for the app mark and 8 for the
         * gap between the two groups. At 393 that leaves 274 for the cap and
         * the button together: 42vw is 165 there and the button is 55, so the
         * pair spends 220 and 54 is left over. A fixed 168 fitted at 393 too -
         * but at 320 the budget is 201 and 168 + 44 was already 11px past it
         * before this change, with the door as the thing being pushed out.
         * 42vw is 134 at that width, so the pair now spends 189 and fits.
         *
         * That budget is written at zero insets and this is the one band where
         * that matters, because the caps here are `min(168px, 42vw)` -
         * viewport-relative, where the box is not. Paying an inset takes width
         * off the box and nothing off the cap, so the whole difference comes
         * off the left group, which is the only one that may shrink, and the
         * app mark is what yields. Measured, cap-binding name: at 320x568 with
         * 59 on each side the left group collapses to width 0 at [79, 79] with
         * a scrollWidth of 21, so the 20.8px mark paints [79, 99.8] while the
         * right group begins at 87 - 12.8px of the mark under the name - and
         * SETTINGS lands at [265.4, 319.8], entirely inside a right strip that
         * starts at 261. At 360x740 with 44 the same collapse happens and
         * 5.6px of SETTINGS is under the strip. Zero-inset controls at both
         * widths show none of it: the left group is [20, 40.8], the right
         * group starts at 67.2 at 320, and there is 18.4px of slack.
         *
         * No device does that today, and this is documented rather than
         * guarded on purpose. The one sub-720 viewport that really does carry
         * a cutout is a 6.1" iPhone with Display Zoom on, held in landscape -
         * 693x320, which is where `TabBar.tsx`'s two horizontal insets stop
         * being hypothetical - and this bar is comfortable there: measured
         * with 59 on each side, padding 79/79, the nav not drawn, the left
         * group the mark alone at [79, 99.8], the right group 266.4 at the
         * cap, so the line wants 295.2 of a 535px content box and keeps
         * 239.8px of slack. If a narrower cutout device ever appears, the
         * guard is to subtract the inset from the cap in the same `calc()`
         * this file already uses on the padding.
         */}
        {active !== null && (
          /*
           * Two lines rather than two columns. The header is 52px tall and the
           * phone is 393 wide: the name, the class, the level, the
           * compatibility mark and SETTINGS do not fit on one line beside each
           * other, and stacking costs no width at all. Right-aligned because
           * this sits against the right edge, so the eye finds the same margin
           * every time.
           */
          <div className="stack" style={{ minWidth: 0, alignItems: 'flex-end', gap: 2 }}>
            {characters.length > 1 ? (
              <select
                aria-label="Active character"
                value={activeId ?? ''}
                onChange={(e) => select(e.target.value)}
                style={{
                  maxWidth: phone ? 'min(150px, 38vw)' : 200,
                  minHeight: 0,
                  padding: '2px 6px',
                  font: '700 13px/1 var(--sans)',
                }}
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Unnamed'}
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  maxWidth: phone ? 'min(168px, 42vw)' : 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  font: '700 13px/1 var(--sans)',
                  color: 'var(--text)',
                }}
                title={active.name || 'Unnamed'}
              >
                {active.name || 'Unnamed'}
              </span>
            )}
            <span
              className="t-meta"
              style={{
                maxWidth: phone ? 'min(168px, 42vw)' : 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {(klass === '' ? '—' : klass).toUpperCase()} · LV{active.level}
            </span>
          </div>
        )}
        <CompatibleIcon size={18} />
        {/*
         * The word on this button is where it goes, and nothing else.
         *
         * It read `theme === 'light' ? 'LIGHT' : 'MENU'`, which is a sentence
         * the code behind it could not back up: this control has never
         * toggled the theme, it has only ever called setScreen('settings').
         * So on a light theme the door to export, import, backup, persistent
         * storage, print and About was labelled with the name of a setting it
         * does not change - and `system` on a light OS said MENU, so the word
         * was not even a reliable readout of the thing it appeared to report.
         * The aria-label already said "Settings", which is exactly why this
         * survived: every automated check and every screen reader got the
         * right word and only the eye got the wrong one.
         *
         * There is no aria-label now. The accessible name is the visible text,
         * so the two have nothing to drift apart from.
         *
         * Ergonomics. Below 720px the nav above is not rendered and TabBar
         * carries play/cards/build and, while the GM section is switched on,
         * gm - never settings, whatever the preferences say - so this is the
         * only permanent route to Settings on a phone. It is also the reason
         * the GM filter above may never touch this button: switching a section
         * off must not be able to take the door to Settings with it, which is
         * the screen you switch it back on from. BackupBanner's BACK UP chip is
         * the
         * other one, and it needs a character and five days without a backup
         * before it exists at all. The top-right corner is the worst place on
         * a phone for a thumb, and that is the right trade for this control:
         * it is tapped rarely, never mid-roll, and wanting it to be awkward to
         * hit by accident is the same instinct as wanting it to be findable
         * when someone is worried about losing a character. Findable means
         * legible, which is what the word buys. `--control` resolves to --tap,
         * 44px, at every width below 1180 and on any coarse pointer, so the
         * box is 44x44 against a 10px label; SETTINGS only widens it, to about
         * 55px (eight characters of 10px IBM Plex Mono at 0.6em advance, plus
         * 0.08em of tracking).
         *
         * The theme control stays in Settings > Display, and that is not a
         * regression because it was never here. It is a three-way choice -
         * Dark, Light, System - and a header toggle cannot express the third,
         * which is the one that follows the device's own schedule.
         *
         * The one state it is not drawn in is the first run, and the reason is
         * argued on the `onboarding` prop at the top of this file: the rule
         * above is about a preference removing its own remedy, and three taps
         * that end by writing `onboarded` is not that.
         */}
        {!onboarding && (
          <button
            type="button"
            onClick={() => setScreen('settings')}
            className="t-meta"
            style={{
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
              color: screen === 'settings' ? 'var(--text)' : 'var(--dim)',
              letterSpacing: '0.08em',
            }}
          >
            SETTINGS
          </button>
        )}
      </div>
    </header>
  );
}
