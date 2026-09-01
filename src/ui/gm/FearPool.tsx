/**
 * The Fear pool.
 *
 * It sits in the GM bar and stays there whichever region is open, because Fear
 * is spent from every one of them: to spotlight in the scene, to trigger a
 * feature you are reading in the bestiary. Two views of one number - the bar,
 * which is where you add and spend one at a time, and the board, where you can
 * set the pool outright when someone says "you had seven".
 *
 * ## That paragraph was false in half, and this is what made it true again
 *
 * *"It sits in the GM bar"* never stopped being true - `GmTopBar` mounts
 * `FearBar` unconditionally. *"and stays there whichever region is open"* was
 * false from the commit that turned the five regions into tools drawn over a
 * session list - *"Make the GM screen the night the GM planned, not five menus
 * to navigate between"* - which landed the day after this paragraph was
 * written, and the clause after it named the two regions where the control was
 * gone. ("was false for over a year" stood here. Nothing in this repository has
 * been anything for over a year: `git log --reverse` puts its first commit nine
 * days before the repair. A duration was never what the sentence needed, so it
 * names the commit instead - that is checkable, and it does not age.) Every GM tool mounted as a `position: fixed; inset: 0`
 * overlay with `useDialog`'s Tab trap on it, so with the live scene open this
 * bar was under an opaque panel and, for a keyboard, outside the only focus
 * scope on the screen. The bestiary was the same. So was every other tool, and
 * so were all four bottom sheets, which capped at 85% of the window and cut
 * this row in half from below.
 *
 * The sentence was written before the tools became dialogs and was not moved
 * when they did, which is how a docblock comes to state the opposite of the
 * build it is standing in. What repaired it is `Gm.tsx`'s stage and
 * `GmSheet.tsx`'s absolute overlay inside it: a tool now fills the band between
 * the two bars rather than the window, so this row is on the glass and in the
 * tab order with any of the twelve open. `GmSheet.tsx` carries what that cost.
 *
 * **`tests/gm/fearOnTheGlass.test.tsx` is the test that would have caught it**,
 * and it is written against the property rather than the pixel: for all twelve
 * mount sites it asserts these controls are present, are not inside the open
 * dialog, are not inside anything `inert` or `aria-hidden`, can take focus, and
 * are not pulled back by a Tab handler. Presence alone would have stayed green
 * through the whole of the defect - the controls were always in the document.
 *
 * One tool always had a Fear control of its own and still does: `Countdowns`
 * renders `FearBoard` below, so the pool is settable from inside it. That is
 * the board, not this bar - the two `−`/`+` buttons here were absent from all
 * twelve, `countdowns` included - so it is an exception to "every tool covers
 * the pool" and never was one to "every tool covers this bar".
 */
import { MAX_FEAR } from '../../engine/encounter.ts';
import { Fold } from '../shared/Fold.tsx';
import { useGm } from './gmStore.ts';
import { FearGuide } from './ReferenceTables.tsx';
import { SRD_LABEL } from '../../store/dataset.ts';

const DIAMOND = 'polygon(50% 0,100% 50%,50% 100%,0 50%)';

/**
 * Fear as `− N +`.
 *
 * Both props default to what this bar has always done, so a call site that
 * passes neither is the component that existed before them.
 *
 * `pips` is off on a phone. Twelve diamonds are 210px of the 369px column, and
 * the GM who described this screen was explicit that the tokens are not what
 * they read - *"alla fine non serve vedere i token"* - so on the one width
 * where the room is contested they lose it and the number keeps it.
 *
 * `onOpenBoard` turns the readout into a control. It is the one place on this
 * bar where something read constantly is also touched, and it is deliberate:
 * setting the pool outright ("you had seven") is the board's job, and the
 * number the eye is already on is the honest door to it. 58 x 44 clears the
 * floor. `aria-live` comes **off** when it does, because a focusable readout
 * that re-announces on every `+1` talks over the thumb that is pressing it -
 * the two `−`/`+` buttons already name what they did.
 */
export function FearBar({
  pips = true,
  onOpenBoard,
}: {
  pips?: boolean;
  onOpenBoard?: () => void;
} = {}): React.JSX.Element {
  const fear = useGm((s) => s.fear);
  const nudge = useGm((s) => s.nudgeFear);

  const readout = (
    <>
      {fear}
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        /{MAX_FEAR}
      </span>
    </>
  );
  const readoutStyle: React.CSSProperties = {
    flex: 'none',
    minWidth: 58,
    textAlign: 'center',
    font: '800 24px/1 var(--sans)',
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
    color: fear === 0 ? 'var(--dim)' : 'var(--fear)',
  };

  return (
    <div className="row" style={{ gap: 8, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
      <span className="t-label" style={{ color: 'var(--fear)', flex: 'none' }}>
        Fear
      </span>
      {pips && (
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
      )}
      <button
        type="button"
        onClick={() => nudge(-1)}
        disabled={fear === 0}
        aria-label="Spend a Fear"
        style={{ flex: 'none', width: 44, height: 44, font: '700 19px/1 var(--sans)', opacity: fear === 0 ? 0.35 : 1 }}
      >
        −
      </button>
      {onOpenBoard === undefined ? (
        <span aria-live="polite" aria-label={`${fear} of ${MAX_FEAR} Fear`} style={readoutStyle}>
          {readout}
        </span>
      ) : (
        <button
          type="button"
          onClick={onOpenBoard}
          aria-label={`${fear} of ${MAX_FEAR} Fear — open Fear and countdowns`}
          style={{ ...readoutStyle, minHeight: 44 }}
        >
          {readout}
        </button>
      )}
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

/**
 * The board: twelve targets big enough to hit without looking down, and the
 * only sentence in the app that says what to spend them on.
 *
 * The counter has had a maximum on it since the GM screen was built and has
 * never said what a scene is worth. `Spend a Fear to:` and the Fear-per-scene
 * table are both in the shipped SRD, and both are now one tap below the pips -
 * behind a `Fold` that is **shut on mount** and placed **under** the twelve
 * targets, so the gesture the GM makes forty times an evening keeps its exact
 * position and its exact 52px. Open, it is about 800px inside `Countdowns`,
 * whose root is already a scroller.
 *
 * The same `FearGuide` draws the reference screen's FEAR topic. One drawing,
 * two doors - a table rendered twice is a table that goes out of step once.
 */
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

      <Fold label="WHAT TO SPEND IT ON" summary={SRD_LABEL}>
        <FearGuide besidePool />
      </Fold>
    </section>
  );
}
