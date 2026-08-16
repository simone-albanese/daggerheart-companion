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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

export type TrackKind = 'hp' | 'stress' | 'hope' | 'armor';

interface Shape {
  clip?: string;
  radius?: string;
  transform?: string;
  color: string;
  /** Height of the drawn mark inside its touch row, in px. */
  markHeight: number;
}

const SHAPES: Record<TrackKind, Shape> = {
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
   * It used to default to a bare 44 and Vitals passed `phone ? 44 : 32` from a
   * viewport-width test, which is why every iPad drew 32px pips while the
   * token sitting next to it had already resolved to 44. A token a component
   * reads beats a number a component decides.
   */
  rowHeight?: number | string;
  gap?: number;
  labelColor?: string;
  compact?: boolean;
  /**
   * Where the label and the readout sit.
   *
   * 'stacked' is the original - a header row above the pips, which is what the
   * GM's party board, the scene panel and the companion want, and where
   * `headerExtra` docks. 'gutter' puts them in a fixed cell to the left of the
   * pip row instead: it spends width, which a full-bleed phone track has, to
   * save 16px of height, which it does not.
   *
   * In both shapes the label sits outside the element carrying the hold
   * handlers, and that is not a style choice. The root used to wrap the header,
   * and a 480ms press to put a caret in the damage field zeroed the track
   * underneath it.
   */
  headerLayout?: 'stacked' | 'gutter';
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
  headerLayout = 'stacked',
  pending = 0,
}: Props): React.JSX.Element {
  const shape = SHAPES[kind];
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

  const pips = Array.from({ length: max }, (_, i) => i);
  const markHeight = compact ? Math.round(shape.markHeight * 0.72) : shape.markHeight;

  const gutter = headerLayout === 'gutter';

  const pipRow = (
    <div
      role="group"
      aria-label={`${label}: ${value} of ${max}`}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
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
            const outer: CSSProperties = {
              position: 'relative',
              display: 'block',
              width: '100%',
              height: markHeight,
              background: clipped ? (on && !proposed ? shape.color : rim) : 'transparent',
              border: clipped ? undefined : `1.5px solid ${on && !proposed ? shape.color : rim}`,
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
                aria-disabled={proposed || undefined}
                onClick={() => {
                  // Tapping the last filled pip clears it; tapping any other
                  // fills up to it. One gesture covers both directions.
                  if (held.current) return;
                  // A proposed pip is a readout. Giving that Hope back means
                  // disarming the Experience that claimed it.
                  if (proposed) return;
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
                  {clipped && (on ? proposed : true) && (
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
    </div>
  );

  /*
   * The gutter spends width to buy height.
   *
   * Stacked costs a 14px label line plus 6px of margin above every track. On a
   * phone with four of them that is 80px, which is two whole loadout rows, and
   * width is the thing a full-bleed phone track has spare. The label cell is
   * the touch floor wide so the numbers have room to be read at a glance from
   * the same left edge every time - a readout that moves with the label's
   * length is a readout you have to hunt for.
   */
  if (gutter) {
    return (
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <div
          className="stack"
          style={{
            flex: 'none',
            width: 44,
            justifyContent: 'center',
            gap: 1,
            minHeight: rowHeight,
          }}
        >
          <span
            className="t-label"
            style={{ color: labelColor ?? 'var(--text)', letterSpacing: '0.08em' }}
          >
            {label}
          </span>
          {readout !== undefined && (
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {readout}
            </span>
          )}
        </div>
        {pipRow}
        {headerExtra !== undefined && <span style={{ flex: 'none' }}>{headerExtra}</span>}
      </div>
    );
  }

  // Unchanged from before the gutter existed, deliberately: the GM's party
  // board, the scene panel and the companion all render this shape, and none
  // of them is part of this reorganisation.
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
