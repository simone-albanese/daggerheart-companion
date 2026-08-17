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
 * THE SHAPE, AND WHAT IT COST TO GET IT. This used to be one full-width row -
 * LABEL and the value on the left where they are read, the two steppers pinned
 * to the right edge where they are touched, and the whole flexible middle of a
 * 369px row between them, which measured about 105px on a 393px phone. Four of
 * those rows are 4x44 plus three 6px gaps: **194px**, a quarter of the usable
 * column on the owner's phone, spent on four numbers.
 *
 * They are a 2x2 grid now, which is **94px** - two rows and one gap - and the
 * hundred pixels that buys is what puts the rest of the sheet on the glass. The
 * price is paid here, in this file, and it is the cushion. Measured in Chrome
 * with the shipped fonts, at the two widths that matter:
 *
 *   viewport 393  ->  column 369  ->  cell 181.5  ->  value target 85.5 wide
 *   viewport 375  ->  column 351  ->  cell 172.5  ->  value target 76.5 wide
 *   viewport 360  ->  column 336  ->  cell 165    ->  value target 69   wide
 *   viewport 344  ->  column 320  ->  cell 157    ->  value target 61   wide
 *   viewport 320  ->  column 296  ->  cell 145    ->  value target 49   wide
 *
 * with two 44x44 steppers and a 4px gutter either side of them. So the value
 * target no longer stands 105px clear of `−`; it stands 4px clear of it. That
 * is stated rather than softened, and it is survivable for one reason: the two
 * mistakes it makes possible are both recoverable and neither is silent. A
 * thumb aimed at `−` that lands on the value opens numeric entry, which writes
 * nothing and closes on one tap; a thumb aimed at `−` that lands on `+` writes
 * +1 into a number that is 20px tall and directly above it. Neither is the
 * failure the old cushion was defending against - a keyboard opening under a
 * finger that was travelling somewhere else and had no way back.
 *
 * WHAT FITS, AND HOW IT IS KNOWN. The widest thing this cell ever draws is the
 * value line at two digits over two digits, and it is `--counter-num` that
 * decides how wide that is: measured in Chrome with the `wizard10` fixture at
 * full Hit Points, `11 / 11` is **60.61px at 22, 58.09 at 20 and 55.59 at 18**.
 * The label line is `13px` of silhouette, a 4px gap and `STRESS` at `.t-label`
 * with the tracking this file sets, which is **57.81px**. The target the grid
 * hands the value is 85.5 at 393, 76.5 at 375, 69 at 360, 61 at 344 and 49 at
 * 320, less 10px of padding and 2px of border - so the number has 73.5 of room
 * at 393 against 60.61 of ink, and 64.5 at 375 against 55.59, because the token
 * steps down to 18 below 380. It is `nowrap` and `overflow: hidden` on purpose:
 * where the room does run out - the label at 360, both lines at 344 and below -
 * the tail clips inside a target that keeps its declared size, and the cell does
 * not wrap onto a second line and take the whole budget with it.
 *
 * The silhouettes come from `Track` rather than being redrawn here. Four cells
 * of digits look more alike than four rows of pips do, so the shape that lets a
 * thumb find Stress without looking matters more in this mode, not less - and
 * in a grid it is doing a second job, because the four cells no longer read
 * top-to-bottom in one column.
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

/**
 * The gutter between the value target and the first stepper, and between the
 * steppers themselves.
 *
 * Four rather than six, and the two pixels are not cosmetic: they are the
 * difference between 64.5px of room for the value line and 60.5px, against
 * 59.5px of ink. Six left one pixel of slack at 375 and one pixel is not a
 * margin, it is a coincidence.
 */
const GUTTER = 4;

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
    /*
     * Entry, in a cell 172.5px wide.
     *
     * Four things want to be here and three of them fit: the field, the
     * ceiling, SET and ×. The silhouette is the one that goes, because the
     * ceiling is the one that cannot. `clamp` turns a typed 15 into a 12
     * without saying so, and a limit the player can read before they commit is
     * the difference between that being a guard rail and being the app quietly
     * writing a different number - which is the one thing this project does
     * not do. Which track this is stays said twice: by the field's own
     * accessible name, and by the three sibling cells that did not change.
     *
     * SET and × carry `padding: 0 6px` rather than `.btn`'s `0 14px` so that
     * `min-width: 44` is what decides their width. At the default padding SET
     * measured 52 and took eight pixels off the field.
     */
    return (
      <div className="row" style={{ gap: GUTTER, minHeight: TAP }}>
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
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: TAP,
            padding: '0 4px',
            textAlign: 'center',
          }}
        />
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          / {max}
        </span>
        <button
          type="button"
          className="btn btn-primary"
          aria-label={`Set ${label}`}
          onClick={commit}
          style={{ flex: 'none', minWidth: TAP, minHeight: TAP, padding: '0 6px' }}
        >
          SET
        </button>
        <button
          type="button"
          className="btn"
          aria-label={`Leave ${label} at ${String(value)}`}
          onClick={() => setTyping(null)}
          style={{ flex: 'none', minWidth: TAP, minHeight: TAP, padding: '0 6px' }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: GUTTER, minHeight: TAP }}>
      {/*
       * The value, and the target that types it.
       *
       * Two lines, because two lines is what fits: the silhouette and the
       * label above, the number below at 20px where it is the thing being
       * read. It is the only item in the cell that grows, so every pixel the
       * grid hands this cell over the 88 the steppers take lands on the target
       * you read rather than on empty space.
       *
       * `min-width: 44` rather than 0: it is a target, and a target's declared
       * floor is what `keeps every target at the touch floor in both
       * directions` reads. Nothing ever drives it there - the narrowest cell
       * gives it 76.5 - but a floor that is only true by arithmetic somewhere
       * else is not a floor.
       */}
      <button
        type="button"
        onClick={() => setTyping(String(value))}
        aria-label={`${label} ${String(value)} of ${String(max)} - tap to type a value`}
        style={{
          flex: '1 1 auto',
          minWidth: TAP,
          minHeight: TAP,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          borderRadius: 'var(--r3)',
          border: '1px solid var(--line-soft)',
          background: 'var(--app)',
          textAlign: 'left',
          padding: '0 5px',
          overflow: 'hidden',
        }}
      >
        <span className="row" style={{ gap: 4, minWidth: 0 }}>
          {mark}
          <span
            className="t-label"
            style={{
              flex: 'none',
              color: labelColor ?? 'var(--text)',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span
            style={{
              // `--counter-num`, not a literal: this size is decided by how wide
              // the grid track is, and the token is where that arithmetic and
              // its one breakpoint live. 22px at 380 and up, 18 below.
              font: '800 var(--counter-num)/1 var(--sans)',
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
        </span>
      </button>

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
