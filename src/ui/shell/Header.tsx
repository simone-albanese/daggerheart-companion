/**
 * The header states three things and then gets out of the way: which character,
 * which screen, and what this device actually holds. That last one matters -
 * "SRD ONLY · NO ART" is how you know at a glance whether the manual import
 * landed, without opening settings.
 */
import { useActive, useApp } from '../../store/state.ts';
import { AppMark } from '../shared/DomainMark.tsx';
import { CompatibleIcon } from '../shared/CompatibleMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
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
  const theme = useApp((s) => s.prefs.theme);
  const active = useActive();
  const phone = useIsPhone();

  const hasManual = layers.some((l) => l.priority > 0);

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
        {!phone && (
          <nav className="row" style={{ gap: 4 }}>
            {SCREENS.map((s) => (
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
        {!phone && (
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
         * Who you are, beside the menu.
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
         * It moved here from the left row, which also helps: that row wanted
         * 480px and was allotted 338 at 768px, so this control was being
         * painted over from the tablet band up. The cap and the ellipsis are
         * what stop a long name doing the same thing to MENU.
         */}
        {characters.length > 1 ? (
          <select
            aria-label="Active character"
            value={activeId ?? ''}
            onChange={(e) => select(e.target.value)}
            style={{
              maxWidth: phone ? 128 : 180,
              minHeight: 'var(--control)',
              padding: '4px 8px',
              font: '600 12px/1 var(--sans)',
            }}
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Unnamed'}
              </option>
            ))}
          </select>
        ) : (
          active !== null && (
            <span
              style={{
                maxWidth: phone ? 132 : 200,
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
          )
        )}
        <CompatibleIcon size={18} />
        <button
          type="button"
          onClick={() => setScreen('settings')}
          aria-label="Settings"
          className="t-meta"
          style={{
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            color: screen === 'settings' ? 'var(--text)' : 'var(--dim)',
            letterSpacing: '0.08em',
          }}
        >
          {theme === 'light' ? 'LIGHT' : 'MENU'}
        </button>
      </div>
    </header>
  );
}
