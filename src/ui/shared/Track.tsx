/**
 * The four resource tracks.
 *
 * Each has its own silhouette - HP a bar, Stress a slash, Hope a diamond,
 * Armor a shield - so a thumb reaching for a track without looking cannot mark
 * the wrong one. That is the whole reason the shapes differ; it is not
 * decoration.
 *
 * Tap marks or unmarks the pip you touched. Press and hold clears the track,
 * because "I took a long rest" should not be six taps.
 *
 * The hold gesture lives on the pip row and nowhere else. It used to sit on
 * the root, which also wraps the header - and the header is where the phone
 * keeps the damage input and the severity chips. A 480ms press to put a caret
 * in that field zeroed the track underneath it, and iOS's own long-press
 * threshold is ~500ms, so an ordinary tap by anyone with a tremor or with
 * Touch Accommodations turned on landed inside the window. The chips were
 * worse than the field: the click still fired afterwards, so a slow press on
 * "SEVERE - 3 HP" left 3 marked instead of 8, which reads as a real number
 * rather than as an obvious wipe.
 *
 * One pip is one `<button>`, so `max` is a DOM budget as well as a number.
 * `MAX_PIPS` below is where that budget stops, and a track over it is drawn
 * short, said out loud and made inert rather than quietly truncated.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type TrackKind = 'hp' | 'stress' | 'hope' | 'armor';

export interface Shape {
  clip?: string;
  radius?: string;
  transform?: string;
  color: string;
  /** Height of the drawn mark inside its touch row, in px. */
  markHeight: number;
}

/**
 * The four silhouettes, exported because the numeric counter row draws them
 * too.
 *
 * The shapes are the reason a thumb reaching for a track without looking
 * cannot mark the wrong one, and that argument does not stop applying when the
 * pips are replaced by a number - it applies harder, because four rows of
 * digits look more alike than four rows of pips do. One table, so the two
 * readouts cannot drift into disagreeing about which shape Stress has.
 */
export const TRACK_SHAPES: Record<TrackKind, Shape> = {
  hp: { radius: '5px', color: 'var(--damage)', markHeight: 38 },
  stress: { radius: '3px', transform: 'skewX(-14deg)', color: 'var(--stress)', markHeight: 30 },
  hope: {
    clip: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
    color: 'var(--hope)',
    markHeight: 34,
  },
  armor: {
    clip: 'polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)',
    color: 'var(--armor)',
    markHeight: 34,
  },
};

const HOLD_MS = 480;

/**
 * The most pips this component will draw, whatever it is asked for.
 *
 * A number, not a guard against a specific attack: `max` arrives from a stored
 * character, and one point of it is one `<button>`, so `hp.max = 2^20` is a
 * million DOM nodes and a tab that never comes back - on a device whose only
 * copy of those characters is inside it. The codec and the store both refuse
 * such a sheet now, and this is still worth having, because neither of them can
 * reach a record that was already in IndexedDB before they existed: nothing
 * re-imports what is already on the disk. A component that cannot be made to
 * hang is the only guarantee that survives its own callers.
 *
 * Forty, from the geometry rather than from taste, and stated as a ceiling
 * rather than as a description of any surface. `--pip-min` is 24px and
 * `--pip-gap` is 5px, so a column costs 29px; ten columns is about 290px of
 * row, which is roughly what the narrowest phone this has to draw on has left
 * after its frame. A wrapped row then costs `--pip-h` plus the gap, 44 + 5,
 * wherever a finger can reach the glass. Four rows is 4x44 + 3x5 = 191px: a
 * third of a 568px viewport, spent on one track, on a screen that already
 * scrolls. Past four rows a track has stopped being a shape the eye takes in
 * and become a grid you count. Ten columns by four rows is forty, which is
 * 3.3x the largest track the rules can produce and 3.3x the largest in the
 * shipped dataset - a 12 HP adversary - so nothing legitimate comes near it.
 *
 * This paragraph used to finish "- twelve on a 393px phone, which is why a
 * full HP track is one line there and two on the small one", and no caller has
 * ever drawn the full-bleed 296px row that sentence assumed. The gutter took
 * 52px off it before decision 7 deleted the gutter, and the three surviving
 * callers frame their rows harder still: measured on the party board at
 * 820x1180, an eleven-box HP track is 11 x 28.9 + 10 x 5 = 368px inside a
 * two-column drawer. The ceiling is the claim; the phone arithmetic was not.
 */
const MAX_PIPS = 40;

interface Props {
  kind: TrackKind;
  /** Filled pips. For Hope this is *available*; for the rest it is *marked*. */
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Value a long press jumps to. Hope clears to full, the rest to empty. */
  clearTo?: number;
  label: string;
  /** Right-hand readout, e.g. "3 / 7 MARKED". */
  readout?: string;
  /** Extra control docked in the header row, to the right of the readout. */
  headerExtra?: React.ReactNode;
  /**
   * Row height. Defaults to `--pip-h`, which is the touch floor wherever the
   * machine has a coarse pointer at all and 34 on a mouse-only desktop.
   *
   * It used to default to a bare 44, and every caller passed a literal past it
   * from a viewport-width test - which is how a machine whose token had already
   * resolved to 44 drew 32px pips anyway. A token a component reads beats a
   * number a component decides. `Vitals` was the caller that sentence was
   * written about and it is gone: decision 7 took the pip tracks off the
   * player's own sheet entirely. The three that remain - the GM's party board,
   * the live scene and the companion panel - are the surfaces where you read
   * somebody else's state rather than mark your own, and they still pass
   * numbers of their own.
   */
  rowHeight?: number | string;
  gap?: number;
  labelColor?: string;
  compact?: boolean;
  /**
   * How many of the filled pips are *proposed* rather than spent.
   *
   * Drawn hollow, in the track's own colour: the shape is still there, the
   * fill is not yet. Hope uses it for the Experiences armed on a roll that has
   * not happened - the SRD makes you declare them before you roll, so the
   * player needs to see the debit before committing to it, and seeing it as
   * already-spent would be the sheet reporting a payment it has not made.
   *
   * It is a readout and never a control: `onChange` is not called for a
   * pending pip, because the way to give that Hope back is to disarm the
   * Experience that claimed it, not to poke the track.
   */
  pending?: number;
}

export function Track({
  kind,
  value,
  max,
  onChange,
  clearTo = 0,
  label,
  readout,
  headerExtra,
  rowHeight = 'var(--pip-h)',
  gap = 5,
  labelColor,
  compact = false,
  pending = 0,
}: Props): React.JSX.Element {
  const shape = TRACK_SHAPES[kind];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const [holding, setHolding] = useState(false);

  const cancelHold = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  const startHold = useCallback(() => {
    held.current = false;
    setHolding(true);
    timer.current = setTimeout(() => {
      held.current = true;
      setHolding(false);
      onChange(clearTo);
      navigator.vibrate?.(12);
    }, HOLD_MS);
  }, [clearTo, onChange]);

  /*
   * Over the ceiling the row is drawn and inert, and it says so.
   *
   * Drawing forty of a million and leaving them live would be worse than the
   * hang it replaces. `onChange(i + 1)` on the fortieth pip writes 40 over a
   * value of 1048576, and the press-and-hold on the row writes `clearTo` over
   * it - so an ordinary tap, on a control that looks like every other track in
   * the app, would silently throw the number away and the sheet would then
   * report the result as the player's own. The pips stay visible because the
   * state is still worth reading; they stop answering because there is no
   * gesture here whose effect could be described honestly.
   *
   * This is the same distinction the component already draws for `pending`: a
   * shape that is a readout and never a control.
   */
  const overflowing = max > MAX_PIPS;
  const pips = Array.from({ length: Math.min(max, MAX_PIPS) }, (_, i) => i);
  const markHeight = compact ? Math.round(shape.markHeight * 0.72) : shape.markHeight;

  const pipRow = (
    <div
      role="group"
      aria-label={
        overflowing
          ? `${label}: ${value} of ${max}, too many to draw - showing the first ${MAX_PIPS}, and this track cannot be marked here`
          : `${label}: ${value} of ${max}`
      }
      onPointerDown={overflowing ? undefined : startHold}
      onPointerUp={overflowing ? undefined : cancelHold}
      onPointerLeave={overflowing ? undefined : cancelHold}
      onPointerCancel={overflowing ? undefined : cancelHold}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        // Wrapping is the floor mechanism. A track too wide for its row sheds
        // a column and takes a second line rather than shrinking its pips
        // under `--pip-min` - in the shipped dataset that is HP at max 12 and
        // nothing else, but it is what stops a future 16-pip track from
        // becoming untappable instead of merely tall.
        flexWrap: 'wrap',
        gap,
        opacity: holding ? 0.75 : 1,
      }}
    >
        {max === 0 ? (
          <div
            className="t-meta"
            style={{
              height: rowHeight,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--dim)',
            }}
          >
            NONE
          </div>
        ) : (
          pips.map((i) => {
            const on = i < value;
            // The last `pending` of the filled pips are the proposed ones.
            const proposed = on && i >= value - pending;
            /*
             * A clip-path cuts the border away with the shape, so an outlined
             * empty pip becomes a few invisible slivers - which is how Hope and
             * Armor vanished entirely. Shapes that are clipped therefore draw
             * their rim as a second, larger span *behind* the fill rather than
             * as a border: an outer silhouette in the edge colour with an inner
             * one inset on top of it. That is this comment's old conclusion
             * carried through - the empty pip keeps exactly the mass it always
             * had and gains a rim you can actually see, which matters because
             * the rim is the only thing saying how big the track is.
             */
            const clipped = shape.clip !== undefined;
            const rim = proposed ? shape.color : 'var(--edge)';
            const fill = proposed ? 'transparent' : on ? shape.color : 'var(--empty)';
            const filled = on && !proposed;
            const outer: CSSProperties = {
              position: 'relative',
              display: 'block',
              width: '100%',
              height: markHeight,
              // Clipped shapes carry their rim as the outer fill with the
              // interior drawn on top; unclipped ones can just take a border,
              // and a filled one is filled either way. Losing that last clause
              // is how HP and Stress briefly became outlines.
              background: filled ? shape.color : clipped ? rim : 'transparent',
              border: clipped ? undefined : `1.5px solid ${filled ? shape.color : rim}`,
              borderRadius: shape.radius,
              clipPath: shape.clip,
              transform: shape.transform,
            };
            return (
              <button
                key={i}
                type="button"
                aria-label={`${label} ${i + 1}${proposed ? ', armed for this roll' : ''}`}
                aria-pressed={on}
                aria-disabled={proposed || overflowing || undefined}
                onClick={() => {
                  // Tapping the last filled pip clears it; tapping any other
                  // fills up to it. One gesture covers both directions.
                  if (held.current) return;
                  // A proposed pip is a readout. Giving that Hope back means
                  // disarming the Experience that claimed it.
                  if (proposed) return;
                  // So is every pip on a track too big to draw: forty of them
                  // cannot say what a value of a million is, and writing 40
                  // over it would be this component inventing the answer.
                  if (overflowing) return;
                  onChange(i + 1 === value ? i : i + 1);
                }}
                style={{
                  // Grow to share the row, but never below the target floor:
                  // a track that would push its pips under it wraps instead.
                  flex: '1 1 var(--pip-min)',
                  minWidth: 'var(--pip-min)',
                  height: rowHeight,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={outer}>
                  {clipped && !filled && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 1.5,
                        display: 'block',
                        background: proposed ? 'var(--panel)' : fill,
                        clipPath: shape.clip,
                      }}
                    />
                  )}
                </span>
              </button>
            );
          })
        )}
        {overflowing && (
          /*
           * The sentence, not a shorter track.
           *
           * It sits inside the pip row, so it lands where the pips would have
           * been - the eye and the thumb are already there, and nothing below
           * it moves by more than this line. It is read rather than touched,
           * so the 44px floor does not apply to it and it takes `.t-hint`,
           * 13px on 1.4 since the readability ramp, which is the size every
           * other explanatory line in the app is. The forty pips above keep their full `--pip-h` height
           * and `--pip-min` width: nothing on this row is a target below the
           * floor, because nothing on it is a target at all.
           */
          <p className="t-hint" style={{ flexBasis: '100%', margin: 0, color: 'var(--dim)' }}>
            {`This track says it has ${max} boxes, which is more than can be drawn. ` +
              `The first ${MAX_PIPS} are shown and cannot be marked here. Nothing has been changed.`}
          </p>
        )}
    </div>
  );

  /*
   * The one header this component has, now that the gutter is gone.
   *
   * There were two. 'gutter' put the label and the readout in a fixed 44px cell
   * to the left of the pips - spending width, which a full-bleed phone track
   * had, to save the 16px of height that a stacked header costs, which it did
   * not. `Vitals` was its only caller in `src/`, and decision 7 deleted the
   * caller, so the branch went with it rather than sitting here as a shape
   * nothing draws. The GM's party board, the live scene and the companion all
   * render this one and always have.
   *
   * The label sits outside the element carrying the hold handlers, and that is
   * not a style choice: the root used to wrap the header, and a 480ms press to
   * put a caret in the damage field zeroed the track underneath it.
   */
  return (
    <div>
      <div className="spread" style={{ marginBottom: 6, padding: '0 2px' }}>
        <span
          className="t-label"
          style={{ color: labelColor ?? 'var(--text)', letterSpacing: '0.16em' }}
        >
          {label}
        </span>
        <span className="row" style={{ gap: 8, flex: 'none' }}>
          {readout !== undefined && (
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {readout}
            </span>
          )}
          {headerExtra}
        </span>
      </div>
      {pipRow}
    </div>
  );
}
