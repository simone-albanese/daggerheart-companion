/**
 * The GM screen.
 *
 * These are personal tools. There is no session, no network, no player sheet on
 * the other side of a wire - a GM opens this the way they open a notebook, and
 * the only thing it owes them is that the notebook is still open where they
 * left it after the browser dies mid-fight.
 *
 * Five regions and one thing that never leaves: the Fear pool. Fear is spent
 * from every region, so it lives in the bar rather than in a region of its own,
 * and the region body below it is the only part that changes.
 */
import { useIsPhone } from '../shared/useLayout.ts';
import { Bestiary } from './Bestiary.tsx';
import { Countdowns } from './Countdowns.tsx';
import { Encounter } from './Encounter.tsx';
import { FearBar } from './FearPool.tsx';
import { useGm, type GmRegion } from './gmStore.ts';
import { PartyBoard } from './PartyBoard.tsx';
import { Scene } from './Scene.tsx';

// The phone labels are shortened, never renamed: "Build" already means the
// character builder in this app, so the encounter builder stays "Encounter".
//
// Party sits next to Scene because they are read in the same breath: what is
// attacking, and what it is attacking.
const REGIONS: Array<{ id: GmRegion; label: string; short: string }> = [
  { id: 'encounter', label: 'Encounter', short: 'ENCOUNTER' },
  { id: 'scene', label: 'Scene', short: 'SCENE' },
  { id: 'party', label: 'Party', short: 'PARTY' },
  { id: 'bestiary', label: 'Bestiary', short: 'BESTIARY' },
  { id: 'countdowns', label: 'Fear & countdowns', short: 'COUNTDOWNS' },
];

export function Gm(): React.JSX.Element {
  const phone = useIsPhone();
  const region = useGm((s) => s.region);
  const setRegion = useGm((s) => s.setRegion);
  const combatants = useGm((s) => s.combatants);
  const countdowns = useGm((s) => s.countdowns);

  const badge: Partial<Record<GmRegion, number>> = {
    scene: combatants.length,
    countdowns: countdowns.length,
  };

  /*
   * On a phone the strip scrolls sideways instead of dividing the width evenly.
   * Five equal shares of 369px is 70px each, and COUNTDOWNS alone is 78px with
   * its padding - so equal shares clip the longest label, and a badge on top of
   * it clips two. Content-sized tabs in a scroller is the same idiom Play uses
   * for its trait chips, and it costs no height.
   */
  const tabs = (
    <nav
      className="row"
      aria-label="GM tools"
      style={{
        gap: 4,
        flex: phone ? 'none' : 1,
        minWidth: 0,
        overflowX: phone ? 'auto' : undefined,
        scrollbarWidth: phone ? 'none' : undefined,
      }}
    >
      {REGIONS.map((r) => {
        const on = region === r.id;
        const count = badge[r.id] ?? 0;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => setRegion(r.id)}
            aria-current={on ? 'page' : undefined}
            className="row"
            style={{
              flex: 'none',
              minWidth: 0,
              justifyContent: 'center',
              gap: 6,
              minHeight: 44,
              padding: phone ? '0 9px' : '0 14px',
              borderRadius: 'var(--r2)',
              background: on ? 'var(--raised)' : 'transparent',
              border: `1px solid ${on ? 'var(--line)' : 'transparent'}`,
            }}
          >
            <span
              className="t-meta"
              style={{
                letterSpacing: '0.1em',
                fontWeight: on ? 700 : 600,
                color: on ? 'var(--text)' : 'var(--dim)',
              }}
            >
              {phone ? r.short : r.label.toUpperCase()}
            </span>
            {count > 0 && (
              <span
                className="t-meta"
                style={{
                  flex: 'none',
                  minWidth: 'var(--control)',
                  height: 17,
                  borderRadius: 9,
                  display: 'grid',
                  placeItems: 'center',
                  background: on ? 'var(--hope)' : 'var(--line)',
                  color: on ? 'var(--app)' : 'var(--muted)',
                  fontSize: 9.5,
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div
        className="stack"
        style={{
          flex: 'none',
          gap: 6,
          padding: phone ? '6px 12px 8px' : '8px 20px',
          borderBottom: '1px solid var(--line-soft)',
          background: 'var(--panel)',
        }}
      >
        {phone ? (
          <>
            <div className="row">
              <FearBar />
            </div>
            {tabs}
          </>
        ) : (
          <div className="row" style={{ gap: 18 }}>
            {tabs}
            <FearBar />
          </div>
        )}
      </div>

      {region === 'encounter' && <Encounter phone={phone} />}
      {region === 'scene' && <Scene phone={phone} />}
      {region === 'party' && <PartyBoard phone={phone} />}
      {region === 'bestiary' && <Bestiary phone={phone} />}
      {region === 'countdowns' && <Countdowns phone={phone} />}
    </div>
  );
}
