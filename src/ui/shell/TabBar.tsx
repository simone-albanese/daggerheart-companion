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
 * ## The horizontal insets, which here are a guarantee and not a repair either
 *
 * The app has paid `env(safe-area-inset-bottom)` and `-top` since it was
 * written and had never once paid `-left` or `-right`: zero hits for either
 * across the whole of `src/`. On a notched iPhone in landscape that is exactly
 * where the cutout is, and `Header.tsx` really was losing 39 of the 54.4px of
 * SETTINGS to it. This bar was named in the same finding, and the measurement
 * refuses that half of it.
 *
 * Measured through the audit rig at 852x393 - an iPhone 14/15 in landscape -
 * `document.querySelector('main > nav')` comes back **null**. `App.tsx` draws
 * this bar only while `phone` is true, `useLayout.ts` puts phone below 720, and
 * every notched iPhone in landscape is wider than that: 812 on a 12/13 mini,
 * 852, 932 on a Pro Max. So the band that draws this bar and the band that has
 * a horizontal inset do not meet on any iPhone - and in the orientation this
 * bar *is* drawn in, iOS reports both sides as 0 anyway: at 393x852 with a 59px
 * inset injected the rig reads this element's padding-left and padding-right
 * back as `0px`, while its padding-bottom is the 34px it has always paid.
 *
 * The two declarations below are therefore worth what `minmax(0, 1fr)` above is
 * worth, and for the same reason: they are what this bar does if the band ever
 * moves - a window under 720px wide on a device that reports a side cutout, a
 * foldable, an Android in split screen - rather than a repair to anything that
 * can be measured today. They cost 0px on every device that draws this bar, and
 * that is the honest claim rather than a larger one.
 *
 * They go on the `<nav>` itself and not on an ancestor because padding sits
 * inside the background box: `var(--panel)` keeps painting to the physical edge
 * while the four buttons move in, which is what a bar under a cutout is meant
 * to look like. The same padding on `.app` or on `<main>` would move the
 * background with the buttons and leave a strip of `--app` down the glass.
 *
 * ERGONOMICS. This is the one control strip in the app deliberately inside the
 * thumb arc, and in the orientation it is drawn in both insets are 0, so the
 * arc is untouched and no tab moves by a pixel today. If a device ever did
 * report one, the cost lands on the grid rather than on the height: at 393 the
 * four columns are 98.3 each, and a 59px inset would take them to 83.5 - or
 * 131 to 111.3 with the GM section off - both still far above the 44px floor,
 * with the 60px height untouched because this padding is horizontal. What the
 * tabs would gain is the part that matters at a table: a label under a cutout
 * is a destination you cannot read in a dim room, which is the whole argument
 * for the four silhouettes above.
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
         * reason. See "The horizontal insets" above for why these are a
         * guarantee rather than a repair: measured at 852x393 this bar is not
         * rendered at all, and at 393x852 both of these resolve to 0px.
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
