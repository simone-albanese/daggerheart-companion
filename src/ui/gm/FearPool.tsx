/**
 * The Fear pool.
 *
 * It sits in the GM bar and stays there whichever region is open, because Fear
 * is spent from every one of them: to spotlight in the scene, to trigger a
 * feature you are reading in the bestiary. Two views of one number - the bar,
 * which is where you add and spend one at a time, and the board, where you can
 * set the pool outright when someone says "you had seven".
 */
import { MAX_FEAR } from '../../engine/encounter.ts';
import { useGm } from './gmStore.ts';

const DIAMOND = 'polygon(50% 0,100% 50%,50% 100%,0 50%)';

export function FearBar(): React.JSX.Element {
  const fear = useGm((s) => s.fear);
  const nudge = useGm((s) => s.nudgeFear);

  return (
    <div className="row" style={{ gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
      <span className="t-label" style={{ color: 'var(--fear)', flex: 'none' }}>
        Fear
      </span>
      <div
        className="row"
        aria-hidden="true"
        style={{ gap: 3, flex: 1, minWidth: 'var(--control)', maxWidth: 210 }}
      >
        {Array.from({ length: MAX_FEAR }, (_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              maxWidth: 15,
              height: 15,
              clipPath: DIAMOND,
              background: i < fear ? 'var(--fear)' : 'var(--empty)',
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={fear === 0}
        aria-label="Spend a Fear"
        style={{ flex: 'none', width: 44, height: 44, font: '700 19px/1 var(--sans)', opacity: fear === 0 ? 0.35 : 1 }}
      >
        −
      </button>
      <span
        aria-live="polite"
        aria-label={`${fear} of ${MAX_FEAR} Fear`}
        style={{
          flex: 'none',
          minWidth: 58,
          textAlign: 'center',
          font: '800 24px/1 var(--sans)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: fear === 0 ? 'var(--dim)' : 'var(--fear)',
        }}
      >
        {fear}
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          /{MAX_FEAR}
        </span>
      </span>
      <button
        type="button"
        onClick={() => nudge(1)}
        disabled={fear === MAX_FEAR}
        aria-label="Gain a Fear"
        style={{
          flex: 'none',
          width: 44,
          height: 44,
          font: '700 19px/1 var(--sans)',
          opacity: fear === MAX_FEAR ? 0.35 : 1,
        }}
      >
        +
      </button>
    </div>
  );
}

/** The board: twelve targets big enough to hit without looking down. */
export function FearBoard({ phone }: { phone: boolean }): React.JSX.Element {
  const fear = useGm((s) => s.fear);
  const setFear = useGm((s) => s.setFear);

  return (
    <section className="panel stack" style={{ flex: 'none', padding: 14, gap: 12 }}>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--fear)' }}>
          Fear pool
        </span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          MAXIMUM {MAX_FEAR} · TAP TO SET
        </span>
      </div>
      {/* Twelve in a row across a phone is a 21px target. Two rows of six is
          the same pool at 50-odd px, and 6 + 6 still reads as one twelve. */}
      <div className={phone ? 'stack' : 'row'} style={{ gap: phone ? 10 : 14 }}>
        <span
          className="t-roll"
          style={{ flex: 'none', color: fear === 0 ? 'var(--dim)' : 'var(--fear)' }}
        >
          {fear}
        </span>
        {/* Square targets: a diamond stretched to fill a wide row stops
            reading as a diamond and starts reading as a dash. */}
        <div
          role="group"
          aria-label={`Fear: ${fear} of ${MAX_FEAR}`}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${phone ? 6 : MAX_FEAR}, minmax(0, 1fr))`,
            gap: 4,
            flex: 1,
            minWidth: 'var(--control)',
            maxWidth: phone ? undefined : 620,
          }}
        >
          {Array.from({ length: MAX_FEAR }, (_, i) => {
            const on = i < fear;
            return (
              <button
                key={i}
                type="button"
                aria-label={`Fear ${i + 1}`}
                aria-pressed={on}
                // Same gesture as every track in the app: tapping the last
                // filled pip clears it, tapping any other fills up to it.
                onClick={() => setFear(i + 1 === fear ? i : i + 1)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Filled either way: a clip-path has no outline of its own,
                    so an empty diamond drawn with a border is four dashes. */}
                <span
                  style={{
                    width: '100%',
                    maxWidth: 36,
                    aspectRatio: '1',
                    clipPath: DIAMOND,
                    background: on ? 'var(--fear)' : 'var(--empty)',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
