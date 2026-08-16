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
  const active = useActive();
  const index = useApp((s) => s.index);
  const phone = useIsPhone();

  const hasManual = layers.some((l) => l.priority > 0);

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
         * It moved here from the left row, which also helps: that row wanted
         * 480px and was allotted 338 at 768px, so this control was being
         * painted over from the tablet band up.
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
         * carries only play/cards/build/gm, so this is the only permanent
         * route to Settings on a phone - BackupBanner's BACK UP chip is the
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
