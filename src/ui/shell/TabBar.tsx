/**
 * Phone navigation. Four destinations, each with a distinct silhouette rather
 * than a generic icon set, so the tab you want is findable by shape at the
 * bottom of a dim room.
 *
 * Three of them when the GM section is switched off, and the grid is written
 * from the surviving tabs rather than fixed at four so the row redistributes
 * instead of leaving a gap where the hexagon was. On a 393px phone that is
 * 98px per tab at four and 131px at three - both far above the 44px floor, and
 * every button keeps its 60px height, so the change is a wider target and
 * never a smaller one. What must not survive is the tab itself: a destination
 * the shell will not draw is a door to an empty room, and `allowedScreen` in
 * `prefs.ts` is the other half of the same rule.
 *
 * ## Why the columns say `minmax(0, 1fr)` and not `1fr`
 *
 * `1fr` is shorthand for `minmax(auto, 1fr)`, so each column's *minimum* is its
 * content's min-content size, not zero. A label that outgrew its share would
 * therefore widen the bar past the viewport instead of shrinking - the same
 * trap `.app` was actually caught in, one file over, where an `auto` grid
 * column sized to an over-wide header laid `main` out 27.5px wider than a 744px
 * window and clipped 45 elements on every screen at once.
 *
 * Here it is a guarantee and not a repair, and the numbers say which: measured
 * in Chrome, the four columns resolve to 80px at 320, 93.8 at 375, 98.3 at 393
 * and 179.8 at 719, against per-tab min-contents of 28 (PLAY), 35 (CARDS), 35
 * (BUILD) and 17 (GM) - a 17px glyph over 10px IBM Plex Mono. The widest
 * minimum is 35, so the auto minimum could not be reached above a 140px
 * viewport and nothing moves today. What changes is the failure mode: a longer
 * word, a translation or a fifth destination can now only make a tab narrower,
 * where before it could push the bar off the glass. Every button keeps its 60px
 * height either way - well above the 44px floor, because this bar is the one
 * control strip that lives inside the thumb arc - and at 320, 375, 393 and 719
 * every tab returns itself from its own centre.
 *
 * ## The horizontal insets, which are 0px in the common case and not always
 *
 * The app has paid `env(safe-area-inset-bottom)` and `-top` since it was
 * written and had never once paid `-left` or `-right`: zero hits for either
 * across the whole of `src/`. On a notched iPhone in landscape that is exactly
 * where the cutout is - on both long edges at once, because iOS insets both so
 * that a 180-degree rotation does not reflow the layout - and `Header.tsx`
 * really was losing 39 of the 54.4px of SETTINGS to it. This bar was named in
 * the same finding, and it is a different case from the header's.
 *
 * Measured through the audit rig at 852x393 - an iPhone 14/15 in landscape -
 * `document.querySelector('main > nav')` comes back **null**. `App.tsx` draws
 * this bar only while `phone` is true, `useLayout.ts` puts phone below 720, and
 * every notched iPhone *at its native resolution* is wider than that in
 * landscape: 812 on a 12/13 mini, 852, 932 on a Pro Max.
 *
 * "At its native resolution" is the clause this paragraph used to be missing,
 * and it is why these two declarations are a live repair and not only a
 * guarantee. iOS Display Zoom - Settings > Display & Brightness > View >
 * Larger Text - drops a 6.1" iPhone to a 320x693 CSS-pixel viewport. Held
 * sideways that is 693x320, which is under 720, so `useMedia(PHONE_QUERY)`
 * matches, `useIsPhone()` is true and `App.tsx` draws this bar - on a device
 * that still has its cutout down a side edge. Measured at 693x320 with 59
 * injected on each side: this element's padding-left and padding-right read
 * back `59px`, the four columns are 143.8x60 spanning [59, 634], clear of both
 * strips, and the header above is inset to 79/79 with 239.8px of slack.
 * Nothing is lost and the four labels come out from under the cutout. That is
 * a configuration a person reaches from Settings, not a hypothetical.
 *
 * In portrait iOS reports no horizontal inset, and this rig cannot be the
 * evidence for that. `insetPatch` in `audit-harness/run.mjs` substitutes each
 * side with the value the case file gave it, so `sa-play-393x852-portrait`,
 * which declares `left: 0, right: 0`, reads `0px` back whatever the code says.
 * This docblock used to quote that reading as a measurement and it was
 * circular. What the rig does establish is the negative - `main > nav` is null
 * at 852x393 - and, when it is *given* an inset, the geometry above.
 *
 * So the honest status is neither of the two this file used to print. Not "a
 * guarantee and not a repair", and not "they cost 0px on every device that
 * draws this bar": 0px on every iPhone at its native resolution, non-zero and
 * load-bearing on a zoomed 6.1" iPhone in landscape, and whatever a foldable
 * or an Android in split screen reports.
 *
 * They go on the `<nav>` itself and not on an ancestor because padding sits
 * inside the background box: `var(--panel)` keeps painting to the physical edge
 * while the four buttons move in, which is what a bar under a cutout is meant
 * to look like. The same padding on `.app` or on `<main>` would move the
 * background with the buttons and leave a strip of `--app` down the glass.
 *
 * ERGONOMICS. This is the one control strip in the app deliberately inside the
 * thumb arc, so what matters is that the cost lands on the grid and not on the
 * height - and it does, because this padding is horizontal. In the
 * configuration where the insets are live, 693x320 in landscape, both thumbs
 * are on the short edges and each rests against a strip; the four columns go
 * from 173.3 to 143.8 (both measured), which is 3.3x the 44px floor, and every
 * button keeps its 60px height. Nothing moves out of either arc: the row is
 * the last thing in the window and the tabs still span [59, 634] of 693.
 * Read-versus-touch is unchanged because every item here is touched - a glyph
 * and its label are one target. What the tabs gain is the part that matters at
 * a table: a label under a cutout is a destination you cannot read in a dim
 * room, which is the whole argument for the four silhouettes above. If a
 * portrait device ever reported one, the same arithmetic holds at 393 - four
 * columns 98.3 -> 68.8 and three 131 -> 91.7, all four measured with 59 on
 * each side - still 1.6x and 2.1x the floor.
 */
import { allowedScreen } from '../../store/prefs.ts';
import { useApp, type Screen } from '../../store/state.ts';

const TABS: Array<{ id: Screen; label: string; mark: React.CSSProperties }> = [
  {
    id: 'play',
    label: 'Play',
    mark: { width: 17, height: 17, clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' },
  },
  { id: 'cards', label: 'Cards', mark: { width: 17, height: 14, borderRadius: 2 } },
  {
    id: 'build',
    label: 'Build',
    mark: { width: 17, height: 15, clipPath: 'polygon(50% 0,100% 100%,0 100%)' },
  },
  {
    id: 'gm',
    label: 'GM',
    mark: {
      width: 17,
      height: 17,
      clipPath: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
    },
  },
];

export function TabBar(): React.JSX.Element {
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const prefs = useApp((s) => s.prefs);

  // Asked as "would the shell draw this?" rather than as "is the GM section
  // on?", so the bar cannot offer a destination the shell substitutes away -
  // this one today, and whatever becomes conditional next.
  const tabs = TABS.filter((tab) => allowedScreen(prefs, tab.id) === tab.id);

  return (
    <nav
      style={{
        flex: 'none',
        display: 'grid',
        gridTemplateColumns: `repeat(${String(tabs.length)}, minmax(0, 1fr))`,
        borderTop: '1px solid var(--line-soft)',
        background: 'var(--panel)',
        /*
         * The home-indicator inset, paid here because on a phone outside the GM
         * section this bar is the last thing in the window. Exactly one thing
         * per screen pays it: paid twice it leaves 34px of empty panel between
         * two bars, paid never it puts the labels under the indicator.
         *
         * `calc(0px + …)` rather than the bare `env(…)` this used to be, and
         * the zero is load-bearing in the *test* rather than in the layout.
         * jsdom's CSS parser drops a bare `env()` on the floor, so the
         * declaration read back as `''` and no assertion on it could ever fail
         * - which meant the one property this is easy to get wrong was the one
         * property nothing checked. Inside `calc()` it survives the parser and
         * `attribution.test.tsx` can count the payers on each screen. The
         * browser computes the same pixels either way.
         */
        paddingBottom: 'calc(0px + env(safe-area-inset-bottom))',
        /*
         * The display cutout, in the same spelling and for the same parser
         * reason. See "The horizontal insets" above: measured at 852x393 this
         * bar is not rendered at all, so on an iPhone at its native
         * resolution these cost nothing - but at 693x320, a 6.1" iPhone with
         * Display Zoom on and held sideways, it *is* rendered, and there these
         * two are what keeps PLAY and GM out from under the cutout.
         */
        paddingLeft: 'calc(0px + env(safe-area-inset-left))',
        paddingRight: 'calc(0px + env(safe-area-inset-right))',
      }}
    >
      {tabs.map((tab) => {
        const active = screen === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScreen(tab.id)}
            aria-current={active ? 'page' : undefined}
            className="stack"
            style={{
              minHeight: 60,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              paddingTop: 4,
            }}
          >
            <span
              style={{
                ...tab.mark,
                /*
                 * `backgroundColor`, never `background`, and that is the whole
                 * bug this line used to have.
                 *
                 * The style object set `background` (a shorthand) and then
                 * `backgroundColor: undefined` for every tab except Cards.
                 * React applies the properties in key order and an `undefined`
                 * longhand is a *removal* - so it deleted the background-color
                 * that the shorthand had just set, and all four glyphs painted
                 * transparent. Cards was the only one anybody could see, and
                 * only because it draws a border as well. Four navigation
                 * icons were invisible from the first commit and nothing
                 * failed, because nothing throws when a shape is the same
                 * colour as the panel behind it.
                 *
                 * The inactive colour is --edge: a glyph is a shape rather
                 * than a label, so it needs the 3:1 a meaningful graphic
                 * needs, where --dim is tuned for 10px text.
                 */
                backgroundColor:
                  tab.id === 'cards'
                    ? 'transparent'
                    : active
                      ? 'var(--hope)'
                      : 'var(--edge)',
                border:
                  tab.id === 'cards'
                    ? `1.5px solid ${active ? 'var(--hope)' : 'var(--edge)'}`
                    : undefined,
              }}
            />
            <span
              className="t-meta"
              style={{
                letterSpacing: '0.1em',
                fontWeight: active ? 700 : 600,
                color: active ? 'var(--text)' : 'var(--dim)',
              }}
            >
              {tab.label.toUpperCase()}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
