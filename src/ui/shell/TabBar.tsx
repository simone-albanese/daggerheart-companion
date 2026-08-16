/**
 * Phone navigation. Four destinations, each with a distinct silhouette rather
 * than a generic icon set, so the tab you want is findable by shape at the
 * bottom of a dim room.
 */
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

  return (
    <nav
      style={{
        flex: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '1px solid var(--line-soft)',
        background: 'var(--panel)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
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
