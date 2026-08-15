/**
 * The header states three things and then gets out of the way: which character,
 * which screen, and what this device actually holds. That last one matters -
 * "SRD ONLY · NO ART" is how you know at a glance whether the manual import
 * landed, without opening settings.
 */
import { useApp } from '../../store/state.ts';
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
        {characters.length > 1 && (
          <select
            aria-label="Active character"
            value={activeId ?? ''}
            onChange={(e) => select(e.target.value)}
            style={{ minHeight: 'var(--control)', padding: '4px 8px', font: '600 12px/1 var(--sans)' }}
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Unnamed'}
              </option>
            ))}
          </select>
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
