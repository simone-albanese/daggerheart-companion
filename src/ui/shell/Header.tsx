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
 */
import { allowedScreen, needsOnboarding } from '../../store/prefs.ts';
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

  /*
   * While the first-run questions are up, this bar carries the mark and nothing
   * else - no nav, and no door to Settings either.
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
   */
  const onboarding = needsOnboarding(prefs, characters.length);

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
        padding: '0 20px',
        paddingTop: 'env(safe-area-inset-top)',
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
         * `width - 40`. The left group's contents are a constant 330 (app mark
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
         *
         * The one state it is not drawn in is the first run, and the reason is
         * argued where `onboarding` is computed at the top of this file: the
         * rule above is about a preference removing its own remedy, and three
         * taps that end by writing `onboarded` is not that.
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
