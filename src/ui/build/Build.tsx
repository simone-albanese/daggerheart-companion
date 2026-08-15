/**
 * Build: where a character is made, changed and levelled.
 *
 * Two flows share this screen because they are the same job at two moments -
 * deciding what a character is. Creation is a wizard, because its steps depend
 * on each other. Everything afterwards is a sheet, because it does not.
 *
 * The screen owns no rules. Creation reads the dataset, levelling reads
 * engine/levelUp.ts, and the arithmetic on both comes from engine/character.ts.
 */
import { useEffect, useState } from 'react';
import { useActive, useApp, useStats } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { Edit } from './Edit.tsx';
import { LevelUp } from './LevelUp.tsx';
import { Segmented } from './parts.tsx';
import { Wizard } from './Wizard.tsx';

type Mode = 'sheet' | 'level' | 'create';

export function Build(): React.JSX.Element {
  const characters = useApp((s) => s.characters);
  const activeId = useApp((s) => s.activeId);
  const select = useApp((s) => s.select);
  const index = useApp((s) => s.index);
  const character = useActive();
  const stats = useStats();
  const phone = useIsPhone();

  const [mode, setMode] = useState<Mode>('sheet');

  // With nothing on the device there is only one thing to do here.
  const empty = characters.length === 0 || character === null || stats === null;
  useEffect(() => {
    if (empty) setMode('create');
  }, [empty]);

  if (mode === 'create' || empty) {
    return (
      <Wizard
        onCancel={empty ? undefined : () => setMode('sheet')}
        onCreated={() => setMode('sheet')}
      />
    );
  }

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <header
        className="stack"
        style={{
          flex: 'none',
          gap: 10,
          padding: phone ? '9px 12px' : '12px 20px',
          background: 'var(--panel)',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1, maxWidth: 320 }}>
            <Segmented
              label="Build mode"
              value={mode}
              onChange={(m) => setMode(m)}
              options={[
                ['sheet', 'Sheet'],
                ['level', 'Level up'],
              ]}
            />
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setMode('create')}
            style={{ flex: 'none', minHeight: 'var(--tap)' }}
          >
            {phone ? 'New' : 'New character'}
          </button>
        </div>

        {characters.length > 1 && (
          <div
            className="row"
            role="group"
            aria-label="Characters on this device"
            style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}
          >
            {characters.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  aria-pressed={active}
                  className="stack"
                  style={{
                    flex: 'none',
                    gap: 4,
                    minHeight: 44,
                    padding: '5px 11px',
                    textAlign: 'left',
                    borderRadius: 'var(--r2)',
                    background: active ? 'var(--raised)' : 'transparent',
                    border: `1px solid ${active ? 'var(--line)' : 'var(--line-soft)'}`,
                  }}
                >
                  <span
                    style={{
                      font: '600 13px/1 var(--sans)',
                      color: active ? 'var(--text)' : 'var(--muted)',
                    }}
                  >
                    {c.name || 'Unnamed'}
                  </span>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    {(index.classes.get(c.classRef)?.name ?? '—').toUpperCase()} · LV{c.level}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {mode === 'sheet' ? (
        <Edit stats={stats} onLevelUp={() => setMode('level')} />
      ) : (
        <LevelUp stats={stats} onDone={() => setMode('sheet')} />
      )}
    </div>
  );
}
