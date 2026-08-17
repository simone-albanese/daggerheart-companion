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
 * They are a 2x2 grid now, which is **102px** on the owner's phone and 94 below
 * viewport 390 - two `--counter-cell` rows and one gap - and the
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
 * value line at two digits over two digits, and it is `--counter-num` and
 * `--counter-max` that decide how wide that is: measured in Chrome with the
 * `wizard10` fixture at full Hit Points, `11 / 11` is **68.94px at 26 over an
 * 11px maximum**, 60.61 at 22 over 10, 58.09 at 20 and 55.59 at 18.
 * The label line is `13px` of silhouette, a 4px gap and `STRESS` at `.t-label`
 * with the tracking this file sets, which is **57.81px**. The target the grid
 * hands the value is 85.5 at 393, 76.5 at 375, 69 at 360, 61 at 344 and 49 at
 * 320 - unchanged by the reflow, because the steppers grew in height and not in
 * width - less 10px of padding and 2px of border. So the number has 73.5 of
 * room at 393 against 68.94 of ink, 4.56 of slack; 72 at 390 against the same,
 * 3.06; and 64.5 at 375 against 55.59, because both tokens step down below
 * 390. It is `nowrap` and `overflow: hidden` on purpose:
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

/** The touch floor. Nothing in this file is ever declared under it. */
const TAP = 44;

/**
 * The height of a counter cell and the side of a stepper - a token, not a
 * number, for the same reason `--counter-num` is one.
 *
 * `--counter-cell` is the cell's HEIGHT: 44 - the floor, which is what shipped
 * - and **48 from viewport 390 up**, where `--counter-num` steps to 26. The
 * four pixels are bought rather than taken. The value in this cell is the
 * number the screen exists for during a fight and it was 22px: BELOW the 30px
 * roll total and two pixels above the `+` you press to change it. At 26 the
 * cell's content is a 13px label row, a 2px gap and a 26px line - 41 - which is
 * 1px inside a 44px cell's 42 of inner and 5px inside a 48's 46. One pixel is a
 * coincidence, not a margin, which is the standard `tokens.css` already holds
 * `--counter-num`'s own step to.
 *
 * HEIGHT AND NOT WIDTH, WHICH IS MEASURED AND IS THE OPPOSITE OF WHAT THE PLAN
 * FOR THIS PASS ASSUMED. Growing the steppers to 48 square takes 8px out of the
 * value target beside them, and that is exactly the room the raise needs:
 * measured with the `wizard10` fixture at full Hit Points, `11 / 11` at 26 over
 * 11 is **68.94px** of ink against **73.5** of room with 44px-wide steppers and
 * **65.5** with 48px ones - so the wider stepper clips the number the wider
 * stepper was supposed to be paying for. The steppers are 44x48: taller, not
 * wider, at the floor in both directions, +9% of area on the eight most-pressed
 * controls on the sheet, and the four value targets go 85.5x44 -> 85.5x48.
 *
 * AND BELOW 390 NOTHING MOVES AT ALL. At 360 the value target is 69 wide, 57 of
 * room, and the same three raises would put 58.91 of ink into it and clip a
 * number a player reads. So the cell is 44 there, the maximum 10 and the number
 * 18, exactly as it shipped - and the arithmetic that decides it lives in
 * `tokens.css` beside `--control` and `--pip-h` rather than in a breakpoint
 * this file invented.
 *
 * The eight pixels the block costs at 393 are exactly what the defence band
 * above it returned in the same pass, so the counters grow UPWARD into them and
 * their lower edge does not move. That is deliberate: everything below this
 * block is either read (the traits) or aimed at blind (ROLL).
 *
 * The entry row uses it too, so a cell being typed into is the same height as
 * the three beside it and the grid does not jump under the finger that opened
 * it.
 */
const CELL = 'var(--counter-cell)';

/**
 * The gutter between the value target and the first stepper, and between the
 * steppers themselves.
 *
 * Four rather than six, and the two pixels are not cosmetic: they are the
 * difference between 64.5px of room for the value line at 375 and 60.5px. When
 * that was decided the number was a flat 20px and the widest line was 59.5, so
 * six left one pixel of slack and one pixel is not a margin, it is a
 * coincidence. Since `--counter-num` the line at 375 is 55.59 and the slack is
 * 8.91, so the four is no longer load-bearing *there* - it is load-bearing at
 * 360 and below, where the target is 69 wide and then 61 and then 49, and every
 * gutter pixel is one the label loses.
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
      // `minWidth: 0` for the same reason the readout row below carries it: a
      // grid item's automatic minimum is its min-content, and this row's is a
      // 44px field plus `/ 12` plus two 44px buttons. See `Vitals`'s note.
      <div className="row" style={{ gap: GUTTER, minWidth: 0, minHeight: CELL }}>
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
            minHeight: CELL,
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
          style={{ flex: 'none', minWidth: TAP, minHeight: CELL, padding: '0 6px' }}
        >
          SET
        </button>
        <button
          type="button"
          className="btn"
          aria-label={`Leave ${label} at ${String(value)}`}
          onClick={() => setTyping(null)}
          style={{ flex: 'none', minWidth: TAP, minHeight: CELL, padding: '0 6px' }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    /*
     * `minWidth: 0`, and it is the half of the narrow-width fix that lives here.
     *
     * This row is a grid item in `Vitals`'s 2x2, and a grid item's automatic
     * minimum is its min-content: 44 + 4 + 44 + 4 plus the value button's own
     * label line, which measures 165.81 for STRESS. Floored at 0 the row takes
     * the track it is given and the shortfall lands on the value button, which
     * is `flex: '1 1 auto'` with `minWidth: 44` and `overflow: hidden` and is
     * the one thing in the cell designed to absorb it. `Vitals` has to declare
     * `minmax(0, 1fr)` as well; neither alone does anything.
     */
    <div className="row" style={{ gap: GUTTER, minWidth: 0, minHeight: CELL }}>
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
       * directions` reads. It stopped being decorative when the grid's tracks
       * were floored at 0 - the cell is 145 at viewport 320, which leaves this
       * 49, and at viewport 310 it leaves exactly the 44 declared here. That is
       * the floor of the whole 2x2 shape and it is below every phone that
       * ships.
       */}
      <button
        type="button"
        onClick={() => setTyping(String(value))}
        aria-label={`${label} ${String(value)} of ${String(max)} - tap to type a value`}
        style={{
          flex: '1 1 auto',
          minWidth: TAP,
          minHeight: CELL,
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
              // its two breakpoints live. 26px at 390 and up, 22 at 380, 18
              // below.
              font: '800 var(--counter-num)/1 var(--sans)',
              color: shape.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </span>
          {/*
           * The maximum, at `--counter-max`: 11 from 390 up, `.t-meta`'s 10
           * below.
           *
           * Nobody reads a marked count on its own: `3` means nothing and
           * `3 / 6` means everything, so this half of the value is read exactly
           * as often as the other half and was drawn at the smallest size on
           * the sheet. It grows with the number rather than being left behind
           * by it - and it steps with the number, because the 3.32px it adds is
           * 3.32px the narrow cell does not have.
           */}
          <span className="t-meta" style={{ fontSize: 'var(--counter-max)', color: 'var(--dim)' }}>
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
 * At or above the touch floor in both directions - a 44px-tall button 22px wide
 * is not a 44px target, and these two sit next to each other, which is the
 * arrangement where a near miss lands on the opposite control rather than on
 * nothing.
 *
 * 44x48 since the reflow, and the asymmetry is the point: the cell grew taller
 * to carry a 26px number and the stepper takes that height for free, +9% of
 * area on the eight most-pressed targets on the sheet for nothing extra. It
 * does NOT take the matching width. 48 square would read tidier and would cost
 * 8px of the value target beside it - 73.5 of room falling to 65.5 against
 * 68.94 of measured ink - so the button would clip the number it was widened to
 * serve. Tidy loses to measured here.
 *
 * The glyph stays at 20. It is a pure target: a finger aims at the button, not
 * at a minus sign.
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
        // `flex: none` is load-bearing and not tidiness: without it these two
        // are shrinkable, and at 360 the STRESS cell's flex line is 0.5px over
        // its 165px track, so both steppers measured 43.75 - under the declared
        // floor, on the commonest Android viewport there has ever been. The
        // harness caught it; it is here so nothing takes it out again.
        flex: 'none',
        // Width is the FLOOR and height is the cell, and the asymmetry is
        // measured rather than tidy. Four pixels of stepper width is eight
        // pixels out of the value target beside them, and at 393 that is the
        // difference between 73.5px of room for `11 / 11` at 26 over 11 - which
        // measures 68.94 - and 65.5, which clips its tail. So the steppers grow
        // on the axis the cell has spare and not on the one the number is
        // fighting for: 44x48 is still square-enough at the floor in both
        // directions, which is the property this button exists to hold.
        width: TAP,
        height: CELL,
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
