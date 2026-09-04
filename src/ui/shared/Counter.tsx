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
 * They are a 2x2 grid of cards now - **186px** on the owner's phone and **118**
 * below viewport 390, two `--counter-cell` rows and one 6px gap - so the shape
 * itself gives back eight of the 194 and then spends 92 of them on the number.
 * The saving that puts the rest of the sheet on the glass is the four folds
 * paired two-up in `Play.tsx`; what this file buys is the readout. Measured in
 * Chrome, `wizard10` at full Hit Points, at every width the rig drives:
 *
 *   viewport 393  ->  column 369  ->  cell 181.5x90  ->  value target 91.5 wide
 *   viewport 375  ->  column 351  ->  cell 172.5x56  ->  value target 82.5 wide
 *   viewport 360  ->  column 336  ->  cell 165x56    ->  value target 75   wide
 *   viewport 320  ->  column 296  ->  cell 145x56    ->  value target 55   wide
 *
 * with two 44px-wide steppers stretched to the card's full height at its two
 * edges, its own 1px border, and NO gutter anywhere inside it - the value
 * target is `cell - 90` at all four. So the value target no longer stands 105px
 * clear of `−`; it shares an edge with it. That is stated rather than softened,
 * and it is survivable for two reasons. The
 * first has always been here: the two mistakes it makes possible are both
 * recoverable and neither is silent. A thumb aimed at `−` that lands on the
 * value opens numeric entry, which writes nothing and closes on one tap; a
 * thumb aimed at `−` that lands on `+` writes +1 into a number that is 20px
 * tall and directly above it. Neither is the failure the old cushion was
 * defending against - a keyboard opening under a finger that was travelling
 * somewhere else and had no way back.
 *
 * THE SECOND IS THE RING, and it is what the owner chose instead of buying the
 * cushion back. Cropping the steppers was the other option on the table and it
 * was refused: nothing in this file goes under the floor to make room. So the
 * pressed stepper draws a 2px outline two pixels INSIDE its own border box -
 * `outlineOffset: -2px`, which is the reason the change costs no hit area and
 * no layout - and a thumb that landed in a cell with no cushion left in it is
 * told by the control which control it hit, rather than having to work it out
 * from which way a digit went. See `Step` below for the offset's sign, the
 * token, and why nothing about it moves.
 *
 * WHAT FITS, AND HOW IT IS KNOWN. In the card the value is TWO lines - the
 * number, and the maximum under it - so what has to fit the width is one of
 * them at a time, and that is the whole of why the number could go to 38.
 * Measured in Chrome with the `wizard10` fixture at full Hit Points, which is
 * the widest state either line reaches: from 390 up `11` is **47.64px** at 38
 * and `/ 11` under it is **26.41** at `--counter-max`'s 10; below 380 the
 * number is 18 and 22.58 wide, and the maximum is the same 26.41 because it
 * does not step - so on a narrow phone the widest line in the cell is the
 * maximum. The target the grid hands the value is 91.5 at 393, 82.5 at 375, 75
 * at 360 and 55 at 320, less 9px of padding either side. So the widest line has
 * 73.5 of room at 393 against 47.64 of ink, 72 at 390 against the same, and 57
 * at 360 and 37 at 320 against 26.41. (`68.94 at 26 over an 11px maximum` was
 * the two-line row's worst line. Nothing draws that row any more - see the head
 * of this file - and the cockpit's own card is measured beside it.) It is
 * `nowrap` and `overflow: hidden` on purpose:
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
 * How long the cell answers a press for, in ms - the number's bump and the
 * stepper's ring alike.
 *
 * One constant and not two literals, because they are one gesture. A tap on `+`
 * lights the ring on the button and steps the number above it, and if the two
 * settled at different moments the cell would answer twice for one press. When
 * this moves it moves for both.
 *
 * It is a DWELL and not a duration of motion, which is why it is a number here
 * rather than a token beside `--motion`. Nothing travels for these 130ms: the
 * ring is on or off and the number is bumped or settled. `--motion` governs how
 * the number *gets* to its bumped size, and `base.css` zeroes that for both
 * reduced-motion switches - which makes the bump instant, not absent, and
 * leaves this dwell exactly as long as it was. A player who asked for less
 * movement still gets told which button they hit.
 */
const ANSWER = 130;

/**
 * The height of a counter cell and the height a stepper stretches to inside it
 * - a token, not a number, for the same reason `--counter-num` is one.
 *
 * `--counter-cell` is the cell's HEIGHT: **56**, and **90 from viewport 390
 * up**, where `--counter-num` steps to 38. Both are the card's three lines and
 * nothing else. Measured in Chrome, `wizard10` at full Hit Points: at 393 the
 * card is 7 of padding, a 13px first line, a 6px gap, the 38px number, another
 * 6, the 10px maximum and 7 - 87 of content, 89 with its 1px border top and
 * bottom, in a cell that declares 90. At 360 the same seven terms with the
 * narrow values are 51, 53 with the border, in 56.
 *
 * AND **62 FROM 1180**, WHICH IS THE COCKPIT DRAWING THE SAME CARD AT DESK
 * SIZE. The seven terms again with the cockpit's values: 3 of padding, a 13px
 * first line, a 2px gap, the 26px number, another 2, the 10px maximum and 3 -
 * 59 of content, 61 with the border, in a cell that declares 62. The phone's
 * cell is 181.5x90 at 393, with 91.5 for the value. The cockpit's is 198x62,
 * with 108.
 *
 * IT WAS 44, THEN 48, AND BOTH OF THOSE WERE THE TWO-LINE ROW - a 13px label
 * row, a 2px gap and the value on one line beside its maximum, with both
 * steppers pinned after it. NOTHING DRAWS IT NOW. It was the cockpit's shape
 * until the owner asked for the two layouts to agree and named what they were
 * rejecting - «non con più e meno affianco alla statistica» - so the branch is
 * deleted rather than left behind a prop, and `tokens.css` carries the whole of
 * the difference between a thumb's card and a mouse's.
 *
 * THE STEPPERS TAKE THE HEIGHT AND NOT THE WIDTH, WHICH IS MEASURED AND IS THE
 * OPPOSITE OF WHAT THE PLAN FOR THIS PASS ASSUMED. Width is the axis the number
 * is fighting for: measured, `11` at 38 is 47.64 of the 73.5 the value target
 * has at 393, and every pixel of stepper width is one the line loses twice
 * over. So the steppers are 44 wide at every width and as tall as the card -
 * **44x88** at 393 and 44x54 below 390, both measured inside the card's border
 * - which is the largest they have ever been and costs the number nothing.
 *
 * AND BELOW 390 THE CARD IS THE SAME SHAPE, SMALLER. At 360 the value target is
 * 75 wide with 57 of room, the number is 18 and 22.58 of ink and the maximum
 * 26.41, so nothing clips. The arithmetic that decides all of it lives in
 * `tokens.css` beside `--control` and `--pip-h` rather than in a breakpoint
 * this file invented.
 *
 * WHAT THE BLOCK COSTS THE COLUMN IS 92 PIXELS AND EVERYTHING BELOW IT MOVES
 * DOWN. Two 44px rows and a 6px gap were 94; two 90px cards and the same gap
 * are 186. The eight pixels the 48px cell cost were the ones the defence band
 * had just returned, and while that was the whole of it this block grew upward
 * and its lower edge stayed put - which is what stood here. It is not the whole
 * of it any more: `Play.tsx`'s budget pays for the other 84 out of the four
 * folds paired two-up, and ROLL is 86px CLOSER to the thumb than before the
 * reflow rather than 24 further from it.
 *
 * The entry row uses it too, so a cell being typed into is the same height as
 * the three beside it and the grid does not jump under the finger that opened
 * it.
 */
const CELL = 'var(--counter-cell)';

/**
 * The gutter between the value target and the first stepper, and between the
 * steppers themselves - in the two shapes that still have one.
 *
 * Four rather than six, and the two pixels are not cosmetic: they are the
 * difference between 64.5px of room for the value line and 60.5px. When that
 * was decided the number was a flat 20px and the widest line was 59.5, so six
 * left one pixel of slack, and one pixel is not a margin.
 *
 * THE CARD HAS NO GUTTER AT ALL, so on a phone this survives in exactly one
 * place: the numeric entry row, where a field, a ceiling, SET and `×` are four
 * boxes that do need holding apart. The cockpit's two-line row is the other,
 * and there the four is what stands the value target 4px clear of `−` in a
 * 198px cell. Inside the card the border is the boundary and a gutter would
 * draw a second one - see the row's own `gap` below.
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

  /*
   * The number answers a press, briefly.
   *
   * Marking a track is the commonest thing anybody does on this screen and it
   * used to happen in silence: the digit changed and nothing said the tap had
   * landed. On a phone at a table that is the difference between pressing once
   * and pressing twice. So the value takes a short step up and settles back.
   *
   * A TRANSITION AND NOT A KEYFRAME, which is the whole reason this is three
   * lines rather than one. `base.css` zeroes `--motion` for both ways a player
   * can ask for less movement - the OS's `prefers-reduced-motion` and this
   * app's own switch through `[data-reduce-motion]` - but its blanket
   * `animation: none` only covers the OS one. A transition driven by `--motion`
   * is off for both, and off means instant rather than absent: the number still
   * changes, it simply does not travel.
   *
   * It watches `value` rather than the two buttons, so typing a number into the
   * cell answers the same way pressing plus does, and a value that changes
   * because a rest healed it does too.
   */
  const [bumped, setBumped] = useState(false);
  const settled = useRef(true);
  useEffect(() => {
    // Not on mount: a sheet opening is not a press, and four counters flinching
    // as the screen arrives would be motion nobody asked for.
    if (settled.current) {
      settled.current = false;
      return undefined;
    }
    setBumped(true);
    const t = setTimeout(() => setBumped(false), ANSWER);
    return () => clearTimeout(t);
  }, [value]);
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
    <div
      className="row"
      style={{
        minWidth: 0,
        minHeight: CELL,
        // Nothing between the three parts when they are one card: the border is
        // the boundary and a gutter inside it would draw a second one.
        gap: 0,
        border: '1px solid var(--line-soft)',
        background: 'var(--app)',
        borderRadius: 'var(--r3)',
        // The steppers reach the card's edge and stop at its radius.
        overflow: 'hidden',
      }}
    >
      {/*
       * Minus leads the card, so the pair reads low to high across it and the
       * two glyphs sit at the two edges a thumb reaches without aiming - which
       * is also the whole of what the owner asked for when they said the two
       * layouts had to agree and named what they were rejecting: «non con più e
       * meno affianco alla statistica». The rejected shape put both glyphs
       * after the value; there is no branch that draws it any more.
       */}
      <Step
        label={`${label} minus one`}
        glyph="−"
        disabled={value <= 0}
        onPress={() => onChange(clamp(value - 1))}
      />
      {/*
       * The value, and the target that types it.
       *
       * Three lines on the phone and two in the cockpit, and both are what
       * fits rather than what was wanted. The silhouette and the name lead,
       * then the number, and on the phone the maximum drops onto a third line -
       * which is the only reason the number is 38 rather than 26, because
       * `11 / 11` on one line measures 68.92 of the 74 this target has and the
       * ceiling was WIDTH. It is the only item in the cell that grows, so every
       * pixel the grid hands this cell over the 88 the steppers take lands on
       * the target you read rather than on empty space.
       *
       * `min-width: 44` rather than 0: it is a target, and a target's declared
       * floor is what `keeps every target at the touch floor in both
       * directions` reads. It stopped being decorative when the grid's tracks
       * were floored at 0 - the cell is 145 at viewport 320, which leaves this
       * **55**, and at viewport **298** it leaves exactly the 44 declared here.
       * Measured at both, and at 297, where the value target holds its 44 and
       * the card overflows its track by half a pixel instead. That is the floor
       * of the whole 2x2 shape and it is below every phone that ships. (310 and
       * 49 were this sentence's numbers while the two 4px gutters were still in
       * the cell; the card took them out and moved the floor twelve pixels
       * down.)
       */}
      <button
        type="button"
        onClick={() => setTyping(String(value))}
        aria-label={`${label} ${String(value)} of ${String(max)} - tap to type a value`}
        style={{
          flex: '1 1 auto',
          minWidth: TAP,
          // Inside the card the ROW carries the height and this carries only
          // its own floor. Declaring the cell here as well made the row
          // `CELL + 2` - its minimum plus its border - so the block drew two
          // pixels taller than the token said at every width.
          minHeight: TAP,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          overflow: 'hidden',
          // The card carries the boundary; this is the middle of it.
          border: 'none',
          background: 'transparent',
          borderRadius: 0,
          // Padding on every side and equal, where the retired two-line shape
          // had '0 5px'. Nothing above or below is what put the number against
          // the edge of its own target.
          padding: 'var(--counter-pad) 9px',
          gap: 'var(--counter-gap)',
          alignItems: 'stretch',
          textAlign: 'center',
        }}
      >
        <span
          className="row"
          style={{ gap: 4, minWidth: 0, width: '100%', justifyContent: 'center' }}
        >
          {mark}
          <span
            className="t-label"
            style={{
              // `0 1 auto` rather than `none`: `STRESS` is 53px of the 65.5 a
              // padded line has on the phone, so the name is the half that can
              // lose a letter if a future label is longer.
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: labelColor ?? 'var(--text)',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              // 11, not `.t-label`'s own size: this line is subordinate to the
              // number under it rather than heading it, at both sizes the card
              // is drawn at - 38 on the phone and 26 in the cockpit. And a px
              // 11 at line-height 1 rather than the class's rem and 1.2,
              // because this cell is measured in px term by term in
              // `tokens.css` - the 13px first line is the mark's silhouette,
              // and a 13.2px label box would move every sum there by 0.2.
              fontSize: 11,
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        </span>
        <span
          style={{
            whiteSpace: 'nowrap',
            // The maximum drops under the value, and that is what let the
            // number go to 38 on the phone: on one line `11 / 11` is 68.92 of
            // 74, so width and not height was the ceiling. Stacked, the widest
            // line is `11` at 47.64.
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            lineHeight: 1,
            gap: 'var(--counter-gap)',
          }}
        >
          <span
            style={{
              // `--counter-num`, not a literal: this size is decided by how wide
              // the grid track is, and the token is where that arithmetic and
              // its three breakpoints live. 38px from 390 up, 22 from 380, 18
              // below that, and 26 again in the cockpit from 1180.
              font: '800 var(--counter-num)/1 var(--sans)',
              color: shape.color,
              fontVariantNumeric: 'tabular-nums',
              // `inline-block` because a transform does not apply to a
              // non-replaced inline box, and in the two-line shape this span is
              // exactly that.
              display: 'inline-block',
              transform: bumped ? 'scale(1.14)' : 'scale(1)',
              transition: 'transform var(--motion) ease-out',
            }}
          >
            {value}
          </span>
          {/*
           * The maximum, at `--counter-max`, 10px at every width - its own value,
           * not `.t-meta`'s, which is 12 since the readability ramp - and the
           * one token here that does NOT step.
           *
           * Nobody reads a marked count on its own: `3` means nothing and
           * `3 / 6` means everything, so this half of the value is read exactly
           * as often as the other half. It was raised to 11 from 390 up for one
           * commit, beside a 26px value; on a line of its own under a 38px one
           * it is subordinate rather than paired, and not stepping is what let
           * the number take the width instead. Measured, `/ 11` is 26.41 wide at
           * 10 - which is the widest line the card draws below 380, where the
           * number itself is only 22.58.
           */}
          <span
            className="t-meta"
            style={{
              fontSize: 'var(--counter-max)',
              // `.t-meta` is 1.25 since the readability ramp; this line is a
              // term of the cell's px height and keeps the 10px box it was
              // measured at.
              lineHeight: 1,
              color: 'var(--dim)',
              display: 'block',
            }}
          >
            {' '}
            / {max}
          </span>
        </span>
      </button>

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
 * 44 WIDE BY THE CARD'S OWN HEIGHT since the reflow, and the asymmetry is the
 * point: the cell grew to carry a 38px number and the stepper takes that height
 * for free. Measured inside the card's border, it is **44x88** at 393 and 44x54
 * below viewport 390, against the 44x44 it shipped at - which is twice the area
 * on the eight most-pressed targets on the sheet for nothing extra. It does NOT
 * take the matching width. A 48px-wide stepper would read tidier and would cost
 * 8px of the value target beside it, and width is the axis the number is
 * fighting for: `11` at 38 measures 47.64 of the 73.5 that target has at 393,
 * and `/ 11` under it 26.41 of the 57 it has at 360. Tidy loses to measured
 * here. (44x48 and "+9% of area" were true of the 48px cell, for one commit.)
 *
 * The glyph stays at 20. It is a pure target: a finger aims at the button, not
 * at a minus sign.
 *
 * ## The ring, and why it is drawn two pixels INSIDE the button
 *
 * The card leaves NOTHING between the value target and `−` - they share an
 * edge - where the full-width row this replaced left about 105 and the
 * cockpit's row still leaves the 4px gutter. The obvious answer was to buy that
 * cushion back by cropping the steppers; the owner said no to the crop and yes
 * to the ring, and the two halves of that decision are the same sentence: a
 * target this project already declares at the floor does not get smaller, so
 * the fix has to be something that says *which button you hit* without taking a
 * pixel off any of them. The card only made that argument harder to refuse.
 *
 * An `outline` is what says it. It is not in flow and not in the box model, so
 * it changes no layout and no hit area whatever its offset, and
 * `outlineOffset: -2px` puts it inside the border box rather than outside it.
 * Two reasons for the negative, and the second is the load-bearing one:
 *
 *  1. Outward, the ring is drawn on whatever is beside the button rather than
 *     on the button. Inside the card the gap is 0, so a ring at +2 lies across
 *     the value target; outside it the gutter is 4, so it covers half the only
 *     air there is between this control and the next. Either way it stops being
 *     a statement about the thing that was pressed, which is its whole job.
 *  2. In the card the row is `overflow: hidden` so the steppers stop at its
 *     radius, and a ring outside the border box is exactly the part that clip
 *     eats. Inside it, it is drawn whole.
 *
 * `--edge` for the colour, which is the token for a boundary that has to be
 * *seen* as opposed to sensed, and is documented as clearing 3:1 on both of the
 * grounds this button draws over - `--app` inside the card, `--raised` outside
 * it.
 *
 * IT IS DECLARED ONLY WHILE THE PRESS IS ANSWERING, and that is not laziness.
 * An inline `outline` beats `base.css`'s `button:focus-visible` rule, which no
 * stylesheet can win back, so a ring declared at rest - transparent, waiting to
 * be transitioned - would silently delete the keyboard focus ring from the
 * eight most-pressed buttons on the sheet permanently. A fade is not worth
 * that, so there is no transition and no keyframe: the ring is on or it is
 * absent. What is left is a keyboard press swapping one ring for the other for
 * `ANSWER` and then getting its focus ring back, which is a control answering a
 * press rather than a control losing its focus - and the two are told apart on
 * sight anyway, at +2 in `--hope` against -2 in `--edge`.
 *
 * AND IT OUTLASTS THE FINGER, by `ANSWER`. A 44px button under a thumb is a
 * 44px button nobody can see, so a ring that died on `pointerup` would be a
 * ring that was never once looked at on the device this cell was reshaped for.
 * It lights on the way down and settles the same moment the number above it
 * does.
 *
 * EXPORTED, because a second surface presses it. `ClassTracks` on the Play
 * screen draws a 44px strip for Focus and Favor rather than a 90px card, and
 * the two glyphs on it have to be this button and not a third one: the 44px
 * floor, the `flex: none` that a 0.5px overflow at 360 once ate, the ring that
 * outlives the finger, and the rule that a disabled stepper does not light are
 * every one of them measurements, and a copy of a measurement is a copy that
 * will be measured once and then drift. `src/ui/build/parts.tsx` already has a
 * `Stepper` of its own with a different shape and a different floor; this
 * export exists so that there is not a third.
 */
export function Step({
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
  const [ringed, setRinged] = useState(false);
  const settling = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A press that outlives its own cell - the row is unmounted by a rest, or by
  // the value target opening numeric entry - must not set state afterwards.
  useEffect(() => () => clearTimeout(settling.current), []);

  /** On, and staying on for as long as the finger is down. */
  const light = (): void => {
    // A disabled stepper is not pressed. Browsers suppress its events; jsdom
    // and a synthetic dispatch do not, and a ring on a button at the end of its
    // track would be the app saying a tap landed when it wrote nothing.
    if (disabled) return;
    clearTimeout(settling.current);
    setRinged(true);
  };

  /** Off, one `ANSWER` after the finger lifts or slides away. */
  const settle = (): void => {
    clearTimeout(settling.current);
    settling.current = setTimeout(() => setRinged(false), ANSWER);
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // Pointer events and not `:active`. The ring has to be an inline
      // declaration - that is the only kind this project can measure, and the
      // only kind that survives beside the inline width and height above - and
      // a pseudo-class cannot produce one. `pointerleave` is in the list so a
      // thumb that slides off mid-press takes the ring with it: that gesture
      // writes nothing, so it must not look like it wrote something.
      onPointerDown={light}
      onPointerUp={settle}
      onPointerCancel={settle}
      onPointerLeave={settle}
      onClick={() => {
        // The keyboard reaches `onClick` without ever touching the three above,
        // so the ring is lit here too, for the whole `ANSWER` after the press
        // rather than the tail of it.
        light();
        settle();
        onPress();
      }}
      style={{
        // `flex: none` is load-bearing and not tidiness: without it these two
        // are shrinkable, and at 360 the STRESS cell's flex line is 0.5px over
        // its 165px track, so both steppers measured 43.75 - under the declared
        // floor, on the commonest Android viewport there has ever been. The
        // harness caught it; it is here so nothing takes it out again.
        flex: 'none',
        // Width is the FLOOR and height is the cell, and the asymmetry is
        // measured rather than tidy. Four pixels of stepper width is eight
        // pixels out of the value target beside them, and that target is where
        // `11` at 38 draws 47.64 of 73.5 at 393. So the steppers grow on the
        // axis the cell has spare and not on the one the number is fighting
        // for: 44 wide by the card's height - measured 44x88 at 393, 44x54
        // below 390 - is over the floor in both directions, which is the
        // property this button exists to hold.
        width: TAP,
        // The card is the box. These two are the regions of it you press, so
        // they stretch to its full height, and they carry no fill or radius of
        // their own - two rounded rectangles inside a third would be three
        // boundaries saying one thing.
        //
        // `minHeight` AS WELL AS `alignSelf`, and it is not belt and braces. A
        // stretched height is computed by the parent, which means it is a
        // height no test can read: `playSheet`'s sweep over every target on the
        // sheet scored these eight 0 and reported them as under the floor. The
        // floor is declared here, where it is the button's own promise, and the
        // stretch is what makes it taller than its promise.
        height: 'auto',
        minHeight: TAP,
        alignSelf: 'stretch',
        background: 'transparent',
        borderRadius: 0,
        color: 'var(--text)',
        font: '700 20px/1 var(--sans)',
        opacity: disabled ? 0.35 : 1,
        /*
         * The ring. Longhands and not the `outline` shorthand: jsdom serialises
         * a shorthand back on its own terms and a test that has to read this
         * would be reading the serialiser rather than the declaration.
         *
         * `outlineOffset` is the whole of the decision. Positive, it grows past
         * the border box and lies across whatever is beside it - inside the card
         * that is the value target itself, because the row's `gap` is 0 there
         * and only the two shapes that kept a gutter have 4px to grow into - and
         * the card's `overflow: hidden` clips the part that escapes. Negative,
         * it is drawn inside a button whose declared `width: 44` above has not
         * moved by a pixel, nor has the height that button promises: `height:
         * var(--counter-cell)` in the two-line row, and `minHeight: 44` under an
         * `alignSelf: 'stretch'` that takes it to the card's own
         * `--counter-cell`. An outline never took part in layout either way -
         * this offset is about what is SEEN, not about the target.
         */
        ...(ringed
          ? {
              outlineWidth: '2px',
              outlineStyle: 'solid',
              outlineColor: 'var(--edge)',
              outlineOffset: '-2px',
            }
          : null),
      }}
    >
      {glyph}
    </button>
  );
}
