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
  /** Row height. 44 or more anywhere a finger goes. */
  rowHeight?: number;
  gap?: number;
  labelColor?: string;
  compact?: boolean;
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
  rowHeight = 44,
  gap = 5,
  labelColor,
  compact = false,
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
      <div
        role="group"
        aria-label={`${label}: ${value} of ${max}`}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        style={{ display: 'flex', gap, opacity: holding ? 0.75 : 1 }}
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
            // A clip-path cuts the border away with the shape, so an outlined
            // empty pip becomes a few invisible slivers - which is how Hope and
            // Armor vanished entirely. Shapes that are clipped therefore draw
            // their empty state as a solid dim fill instead, which is also the
            // only way the silhouette stays readable when the track is empty.
            const clipped = shape.clip !== undefined;
            const style: CSSProperties = {
              width: '100%',
              height: markHeight,
              background: on ? shape.color : clipped ? 'var(--empty)' : 'transparent',
              border: clipped ? undefined : `1.5px solid ${on ? shape.color : 'var(--empty)'}`,
              borderRadius: shape.radius,
              clipPath: shape.clip,
              transform: shape.transform,
            };
            return (
              <button
                key={i}
                type="button"
                aria-label={`${label} ${i + 1}`}
                aria-pressed={on}
                onClick={() => {
                  // Tapping the last filled pip clears it; tapping any other
                  // fills up to it. One gesture covers both directions.
                  if (held.current) return;
                  onChange(i + 1 === value ? i : i + 1);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: rowHeight,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <span style={style} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
