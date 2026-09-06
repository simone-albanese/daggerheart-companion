/**
 * Build: where a character is made, changed and levelled.
 *
 * Two flows share this screen because they are the same job at two moments -
 * deciding what a character is. Creation is a wizard, because its steps depend
 * on each other. Everything afterwards is a sheet, because it does not.
 *
 * The screen owns no rules. Creation reads the dataset, levelling reads
 * engine/levelUp.ts, and the arithmetic on both comes from engine/character.ts.
 *
 * ## The height budget for a level-up, which this file never had one of
 *
 * Play.tsx counts its column and this did not, so nobody noticed that a
 * landscape phone was reading the level-up through a porthole. Exactly one
 * child of this screen scrolls - the sheet's column or `LevelUp`'s - and
 * every other band is `flex: none` and comes off it.
 *
 * The bands during a level-up: shell header 53, `LevelUp`'s own Cancel/Apply
 * nav 69 on a phone and 73 above 720px, `TabBar` 61 below 720px and nothing
 * above it. The mode header was a fourth, 69 on a phone and 75 above 720px,
 * and it is the one this file stopped drawing here. Measured in Chrome,
 * fixture `played`, the advancement column before and after:
 *
 *                fixed        the column        with the backup nag up
 *   568x320     252 -> 183     68 ->  137        34 ->  71
 *   640x360     252 -> 183    108 ->  177        42 -> 111
 *   667x375     252 -> 183    123 ->  192        57 -> 126
 *   852x393     201 -> 126    192 ->  267       126 -> 201
 *   932x430     201 -> 126    229 ->  304       163 -> 238
 *   375x667     252 -> 183    415 ->  484       349 -> 418
 *   393x852     252 -> 183    600 ->  669       534 -> 603
 *
 * against a flow 1938px long at 667x375 and 2083 at 393x852. Portrait gains
 * the same 69 as landscape, so no viewport pays for this one.
 *
 * The nag is another 58 + 8 of margin and it is up from three days after a
 * backup - an ordinary state, not an edge one. At 568x320 it used to take the
 * column to 34, which is the scroll's own 14 + 20 of padding around a content
 * box of nothing: `min-height: 0` on a `border-box` element still cannot go
 * below its own padding, so the column stopped giving, `LevelUp`'s nav
 * overflowed by 32px, and Cancel was drawn with 21px of its 48 behind the tab
 * bar. That was the audit's only overlap on this screen and it is gone with
 * the 69px, at 0 overlaps measured.
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
      {/*
        The mode header belongs to the sheet, and only to the sheet.

        It is `flex: none`, so every pixel of it is taken off the one child
        below that scrolls, and during a level-up it holds nothing that flow
        needs: `LevelUp` pins its own Cancel next to Apply, and `onDone` is
        what both the mode switch and that Cancel call. Drawn anyway it cost
        the advancement column 69px on a phone and 75px in the tablet band -
        see the budget in this file's docblock for what that was out of.

        And it is not only pixels. The character switcher is in this band, and
        `LevelUp` holds its `picks` in component state while reading the active
        character out of the store, so a tap on another name mid-plan leaves
        the plan standing and `update()` - which writes to whatever is active
        when it runs - would apply it to the character that was tapped. There
        is no way to reach that from here any more.
      */}
      {mode === 'sheet' && (
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
                        font: '600 0.8125rem/1 var(--sans)',
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
      )}

      {mode === 'sheet' ? (
        <Edit stats={stats} onLevelUp={() => setMode('level')} />
      ) : (
        <LevelUp stats={stats} onDone={() => setMode('sheet')} />
      )}
    </div>
  );
}
