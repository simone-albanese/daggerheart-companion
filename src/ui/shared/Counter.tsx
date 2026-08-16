/**
 * A resource track as a number, with a stepper and a way in for the keyboard.
 *
 * The pip row is a better *readout* than this: it says how big the track is
 * and how much of it is gone in one glance, without reading anything. It is a
 * worse *control*. Going from 2 marked Stress to 7 is five separate taps on
 * five different 24px-wide targets, any one of which landing on its neighbour
 * writes a number the player did not mean, and the SRD hands out Stress in
 * lumps - a card that says "mark 3 Stress" is three taps and three chances to
 * be wrong. That is the one job a stepper is worse at too, so the number
 * itself is the third control: tap it and type 7.
 *
 * The order across the row is deliberate. LABEL and the value are on the left,
 * where they are *read*; the two stepper buttons are pinned to the right edge,
 * where they are *touched*, with the whole flexible middle of the row between
 * them and the value. Inside the Play panel on a 393px phone that gap measures
 * about 105px, and about 88px on a 375px one, which is what stops a thumb
 * travelling to `+` from opening a keyboard on the way - the failure mode a
 * full-width number target would have.
 *
 * The silhouettes come from `Track` rather than being redrawn here. Four rows
 * of digits look more alike than four rows of pips do, so the shape that lets
 * a thumb find Stress without looking matters more in this mode, not less.
 */
import { useEffect, useRef, useState } from 'react';
import { TRACK_SHAPES, type TrackKind } from './Track.tsx';

interface Props {
  kind: TrackKind;
  label: string;
  /** Filled units. For Hope this is *available*; for the rest it is *marked*. */
  value: number;
  max: number;
  onChange: (value: number) => void;
  labelColor?: string;
}

/** The touch floor. Both steppers and the value target are all at least this. */
const TAP = 44;

export function Counter({
  kind,
  label,
  value,
  max,
  onChange,
  labelColor,
}: Props): React.JSX.Element {
  const shape = TRACK_SHAPES[kind];
  const [typing, setTyping] = useState<string | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typing !== null) field.current?.focus();
  }, [typing]);

  const clamp = (n: number): number => Math.max(0, Math.min(max, n));

  const commit = (): void => {
    if (typing === null) return;
    const n = Number(typing);
    // An empty box or a typo is a cancel, not a zero. Zero is a real value on
    // every one of these tracks and the player has a keypad to say it with.
    if (typing.trim() !== '' && Number.isFinite(n)) onChange(clamp(Math.round(n)));
    setTyping(null);
  };

  const mark = (
    <span
      aria-hidden="true"
      style={{
        flex: 'none',
        width: 13,
        height: 13,
        background: shape.color,
        borderRadius: shape.radius,
        clipPath: shape.clip,
        transform: shape.transform,
      }}
    />
  );

  if (typing !== null) {
    return (
      <div className="row" style={{ gap: 6, minHeight: TAP }}>
        {mark}
        <span
          className="t-label"
          style={{ flex: 'none', color: labelColor ?? 'var(--text)', letterSpacing: '0.08em' }}
        >
          {label}
        </span>
        <input
          ref={field}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={typing}
          aria-label={`${label}, 0 to ${String(max)}`}
          onChange={(e) => setTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setTyping(null);
          }}
          style={{ flex: 1, minWidth: 0, minHeight: TAP, textAlign: 'center' }}
        />
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          / {max}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          aria-label={`Set ${label}`}
          onClick={commit}
          style={{ flex: 'none', minWidth: TAP, minHeight: TAP, padding: '0 10px' }}
        >
          SET
        </button>
        <button
          type="button"
          className="btn"
          aria-label={`Leave ${label} at ${String(value)}`}
          onClick={() => setTyping(null)}
          style={{ flex: 'none', minWidth: TAP, minHeight: TAP, padding: '0 10px' }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 6, minHeight: TAP }}>
      {mark}
      <span
        className="t-label"
        style={{ flex: 'none', color: labelColor ?? 'var(--text)', letterSpacing: '0.08em' }}
      >
        {label}
      </span>

      {/*
       * The value, and the target that types it.
       *
       * Left-aligned and hugging the label, because it is the thing being read
       * and a number that moves with the width of the row is a number you have
       * to find. Everything after it is a spacer, so the distance between this
       * and the minus button is the whole flexible middle of the row.
       */}
      <button
        type="button"
        onClick={() => setTyping(String(value))}
        aria-label={`${label} ${String(value)} of ${String(max)} - tap to type a value`}
        style={{
          flex: 'none',
          minWidth: 76,
          minHeight: TAP,
          borderRadius: 'var(--r3)',
          border: '1px solid var(--line-soft)',
          background: 'var(--app)',
          textAlign: 'left',
          padding: '0 10px',
        }}
      >
        <span
          style={{
            font: '800 20px/1 var(--sans)',
            color: shape.color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {' '}
          / {max}
        </span>
      </button>

      <span style={{ flexGrow: 1, flexBasis: 0, minWidth: 12 }} />

      <Step
        label={`${label} minus one`}
        glyph="−"
        disabled={value <= 0}
        onPress={() => onChange(clamp(value - 1))}
      />
      <Step
        label={`${label} plus one`}
        glyph="+"
        disabled={value >= max}
        onPress={() => onChange(clamp(value + 1))}
      />
    </div>
  );
}

/**
 * One stepper button.
 *
 * Square at the touch floor in both directions - a 44px-tall button 22px wide
 * is not a 44px target, and these two sit next to each other, which is the
 * arrangement where a near miss lands on the opposite control rather than on
 * nothing.
 */
function Step({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      style={{
        flex: 'none',
        width: TAP,
        height: TAP,
        borderRadius: 'var(--r3)',
        background: 'var(--raised)',
        color: 'var(--text)',
        font: '700 20px/1 var(--sans)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {glyph}
    </button>
  );
}
