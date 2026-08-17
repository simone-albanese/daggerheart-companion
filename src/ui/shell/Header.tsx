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
 * the cutout is. iOS reports it as `env(safe-area-inset-left)` or `-right`
 * depending on which way the phone was rotated, and the other side as 0.
 *
 * Measured in Chrome through the audit rig at 852x393 - an iPhone 14/15 in
 * landscape, which `useLayout.ts` names in its own comments - with the inset
 * substituted at 59px, the figure this audit measured for the *top* inset in
 * portrait on the same class of device and the same physical cutout seen
 * edge-on. The header's padding was `0 20px`, so:
 *
 *   Rotated with the cutout on the RIGHT. The strip is [793, 852]. SETTINGS is
 *     laid out at [777.6, 832], 54.4px wide, so **39.0px of it - 71.7% - is
 *     inside the cutout**, leaving 15.4px of visible, aimable glass on the only
 *     permanent door this app has to export, import, backup and print. The
 *     overlap is `inset - 20`, the padding this bar already had, so it does not
 *     change with the viewport: measured identically at 932x430.
 *   Rotated with the cutout on the LEFT. The strip is [0, 59]. The app mark is
 *     at [20, 40.8] and is **100% inside it**. PLAY, the first nav button,
 *     starts at 62.8 and clears the strip by 3.8px - so the nav was never the
 *     casualty on this side, and the audit's "the header's left group runs
 *     under the cutout" is true only of the 20.8px mark.
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
 * of the glass and draw a strip of `--app` beside it. `main` is transparent and
 * owns no content of its own, so the screens inside it are their own files'
 * half of this - the Cards filter rails are still unpaid, and are not this
 * file's to fix.
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
 * ERGONOMICS, and landscape is the case, so this reasons about landscape. At
 * 852x393 both thumbs are on the short edges and the arc each sweeps is wide
 * and shallow, anchored at its own bottom corner; the cutout eats a full-height
 * strip down exactly the edge one of those thumbs rests against. Neither thing
 * this bar holds is *in* that arc - the row is y4-48, at the top of the glass,
 * which is the right home for navigation you reach for deliberately and the
 * reason the corner was chosen for SETTINGS in the first place. So this is not
 * a reach failure, it is worse: an aimed target that is 71.7% invisible. A
 * control you must look at to hit, and cannot see, is worse than one out of
 * reach. After the fix SETTINGS is 54.4x44 of visible glass again, clearing the
 * 44px floor this repo sets (`--tap`; `--control` resolves to it at every width
 * under 1180 and on any coarse pointer) in both axes rather than in one. The
 * nav's four buttons shift inward by the inset - PLAY from 62.8 to 121.8 - and
 * that is toward the centre of the left thumb's sweep, not away from it, so
 * nothing here loses reach to buy this. Read-versus-touch is unchanged: the app
 * mark and the identity line are read, the nav and SETTINGS are touched, and
 * both classes move inward by the same amount, so what is read still sits above
 * and outside what is reached.
 *
 * What it costs in pixels: the content box loses `insetLeft + insetRight`,
 * which is 0 on every device without a cutout. On the narrowest notched phone
 * in landscape - 812x375, an iPhone 12/13 mini - it is 59 on one side, leaving
 * 713px of content box. The line wants 329.8 (left group) + 8 (gap) + 184.2
 * (right group at a ten-character name) = 522, and 656.2 at the header's own
 * 220px name cap. So 56.8px of slack survives at the cap, and the
 * over-subscription this file's first half spent its length closing cannot
 * reopen because of it.
 *
 * The viewport meta is untouched and was already right: `index.html` says
 * `width=device-width, initial-scale=1, viewport-fit=cover`, and without that
 * `viewport-fit=cover` iOS letterboxes the page and every `env()` in this repo
 * is 0. It is the precondition for all of this and nothing asserted it, so
 * `tests/ui/safeArea.test.ts` does now.
 */
import { allowedScreen } from '../../store/prefs.ts';
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

export function Header(): React.JSX.Element {
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
         */
        paddingTop: 'calc(0px + env(safe-area-inset-top))',
        paddingRight: 'calc(20px + env(safe-area-inset-right))',
        paddingBottom: 0,
        paddingLeft: 'calc(20px + env(safe-area-inset-left))',
        boxSizing: 'content-box',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--panel)',
      }}
    >
      <div className="row" style={{ gap: 22, minWidth: 0 }}>
        <AppMark />
        {!phone && (
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
         * pay. The landscape case is worked through at the foot of the cutout
         * section, and its worst line keeps 56.8px of slack.
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
         * 23.6px of slack, and 47.6 at 744. The over-subscription is not
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
         */}
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
      </div>
    </header>
  );
}
