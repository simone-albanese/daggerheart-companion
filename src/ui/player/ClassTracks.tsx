/**
 * Focus and Favor: the two tracks a CLASS gives you, on the screen they are
 * spent on.
 *
 * The four tracks above this one belong to every character in the game. These
 * two do not. Focus is the Martial Artist's - folio 13, *"take the Martial
 * Stances sheet"* - and Favor is the Warlock's: *"You start with 3 Favor... The
 * maximum Favor you can hold at one time is 6."* Both are already stored,
 * migrated, capped and carried on the wire; what was missing was a way to spend
 * one without leaving the screen you are rolling on. Until this file the Focus
 * track could only be moved from **Build**, and the Favor track could not be
 * moved at all.
 *
 * ## A row of its own, and not a fifth and sixth card in the grid above
 *
 * The owner's decision, with the arithmetic that made it: the four counters are
 * a 2x2 grid of `minmax(0, 1fr)` tracks whose items have a min-content of
 * 44 + 44 of steppers, so six cards in that grid is one wrap and the four that
 * were already there get squeezed by it. A row of its own costs the four
 * nothing - measured, the grid above is 369x186 at 393 with this row drawn and
 * 369x186 without it, at the same x and the same y.
 *
 * ## WHO GETS DRAWN ONE, and why it is asked of the sheet rather than assumed
 *
 * A Bard shown two tracks they can never spend is noise on the one screen that
 * cannot afford any, so the row is conditional and both halves are conditional
 * separately: `drawsFocus` and `drawsFavor` in `src/engine/character.ts`, which
 * ask the subclass list and the dataset rather than comparing a ref against a
 * string written here. Neither predicate is new logic - `drawsFavor` calls
 * `grantsFavor`, which the character seed has used since the field existed, and
 * `drawsFocus` reads the same subclass slug the Build screen's stance section
 * reads. With neither, this component renders nothing at all: no element, no
 * gap, no pixel of column - and that is the common case rather than the corner
 * one. Counted over `data/srd-2.0.json` rather than assumed: **one class of
 * thirteen** grants Favor and **one subclass of twenty-six** grants Focus, and
 * `data/srd-1.0.json` has neither - it ships nine classes with no Warlock among
 * them and prints no stances chapter at all, so on that book this row never
 * draws for anybody who did not arrive carrying a number.
 *
 * ## ERGONOMICS
 *
 * Measured in Chrome at 393x852, dpr 3, `pointer: coarse`, with the shipped
 * fonts, on a level-5 Warlock who multiclassed into Brawler and took Martial
 * Artist - so both tracks are drawn, which is the widest and the tallest this
 * row ever is. The same sheet is measured at 320, 344, 360, 375, 744 and in the
 * cockpit, and the numbers below are all from that rig rather than from this
 * file's arithmetic.
 *
 * **TARGET SIZE.** Each strip is `[-][FOCUS 2/6][+]`, and the two glyphs are
 * `Counter`'s own `Step` rather than a third stepper written here: 44 wide,
 * `flex: none`, the ring that outlives the finger, and the rule that a disabled
 * stepper does not light. Measured, every one of the four buttons is **44x44**
 * at 320, 344, 360, 375, 393, 744 and at 1180 alike - the floor in both
 * directions at every width this app is measured at, with nothing under it.
 *
 * **READ VERSUS TOUCH.** The label is read once - it says which of two numbers
 * this is - and the value is read every time the row is used, so the label is
 * 11px above a 16px tabular figure rather than beside it. Stacking is what buys
 * the width, and this is the measurement that decided the shape: the label is
 * **37.41** wide and the value **28.81**, so side by side they want 72.2px plus
 * a gutter, and the readout has **55** at viewport 320. The label would have
 * ellipsized on the commonest small Android there is. Stacked, the widest line
 * is the label's own 37.41 against a readout that is 91.5 wide at 393, 82.5 at
 * 375, 75 at 360, 67 at 344 and 55 at 320 - clear at all of them.
 *
 * It is deliberately NOT the 38px number the cards above carry. Those are read
 * under pressure while somebody is telling you a damage total; these run 0 to 6
 * and are subordinate to them, which the size says without a word.
 *
 * **AND IT HOLDS ITS SHAPE TO THE SAME FLOOR THE GRID ABOVE DECLARES.** The
 * readout declares `minWidth: 44`, so the two-track row's floor is where a
 * strip is 134: measured, viewport **298** puts the readout at exactly 44 with
 * both steppers still 44 wide and on the glass, and at **297** the readout
 * holds its 44 and the strip overflows its own track by half a pixel instead -
 * the same floor, in the same words, that the 2x2 grid above this row records
 * for itself. `overflowX` on the document is 0 at both.
 *
 * **THE STRIP IS 46 TALL AND THAT IS THE WHOLE OF WHAT IT COSTS** - 44 of
 * target and its own 1px border top and bottom. Not the 90px `Counter` card,
 * though reusing it whole would have been the cheaper thing to write: two cards
 * plus a gap are 96px of a column that already overflows its 672px of glass by
 * 136, and every one of those pixels comes off the index of folds below ROLL.
 * With this panel's 6px gap the row costs **52**.
 *
 * **THUMB ARC, and the number moves in the player's favour.** Measured on this
 * sheet at 393x852, at the top of the scroll: ROLL sits at 341 to 397px above
 * the bottom bezel with the row absent and at **289 to 345** with it drawn -
 * the 52 this row costs, spent downward. Against the 95th-percentile
 * right-thumb sweep of about 330px from the bottom-right pivot that `Play.tsx`
 * argues from, ROLL's near edge crosses INTO the arc on this sheet for the
 * first time.
 *
 * The row's own two strips do not, and that is the cost of "under Vitals"
 * rather than "under ROLL": they sit at **417 to 463px** above the bezel, 72px
 * of column above ROLL, outside the sweep. It is stated rather than hidden. The
 * screen scrolls - the old "nothing scrolls here" rule is gone, and it was
 * overruled for starving this very column - so the gesture that brings ROLL
 * under the thumb brings this row with it, and the two stay 72px apart however
 * far it is scrolled.
 *
 * **IT DOES NOT REFLOW BETWEEN ITS STATES, WHICH IS THE ONE THING A CONTROL
 * THIS CLOSE TO A ROLL MUST NOT DO.** Seventeen pixels of a label that grew
 * once reflowed a strip between two taps elsewhere in this app, and reordering
 * did not fix it - the sentence had to be given a line of its own. Nothing here
 * can grow: the value is `n/6` in a tabular mono face, so it is three glyphs at
 * 0 and three at 6; the ends of the range disable a stepper rather than
 * removing it, which is opacity and not layout; and the label is a constant.
 * Measured in all three states - `2/6 · 3/6`, `0/6 · 0/6`, `6/6 · 6/6` - the
 * strips are 181.5x46 at x12 and x199.5, y389; the readouts 91.5x34 at y395;
 * the labels 37.41x11 at x84.05 and x271.55; the values 28.81x16 at y411; and
 * all four buttons 44x44 at y390. Every one of those figures is identical to
 * the hundredth of a pixel across the three, and the only thing that changes is
 * which stepper is disabled. Driven through the app rather than reasoned about:
 * tapping `FAVOR plus one` moved 3/6 to 4/6, and `FOCUS minus one` twice moved
 * 2/6 to 0/6 and disarmed the minus, with every box above unmoved.
 *
 * **THE READOUT IS 34 AND NOT 30, AND THAT IS A REPAIR RATHER THAN A CHOICE.**
 * As first shipped it was 30 - the label's 11, the 3px gap and the value's 16,
 * which is exactly the sum - and it clipped: `clientH 30` against `scrollH 32`,
 * two `unscrollable` boxes on every viewport the rig measures, desktop
 * included. The cause is not the gap and not the strip: it is that `.t-num`
 * sets its line box to the font size while IBM Plex Mono's content area is
 * 1.25em, so at 16px the text occupies 20px in a 16px box and hangs 2px past
 * each end - 0.21px of it the tail of the `/`, the rest the face's own descent.
 * The clip was given that 2px as padding instead, which is the change the
 * `TrackStrip` readout carries the arithmetic for.
 *
 * It cost nothing that had been measured, and that was checked rather than
 * assumed. Before -> after, at the three viewports the composition scored:
 *
 *   393x852    unscrollable 2 -> 0    readout 91.5x30 -> 91.5x34
 *   320x568    unscrollable 2 -> 0    readout   55x30 ->   55x34
 *   1180x820   unscrollable 2 -> 0    readout  108x30 ->  108x34
 *
 * The readout is centred in the strip, so its top rose the 2px the padding
 * added back - 397 to 395 at 393 - and every figure inside it stayed put: the
 * label 37.41x11 at the same y, the value 28.81x16 at the same y, all four
 * steppers 44x44, the strips 181.5x46 / 145x46 / 198x46 unchanged, `clipped`
 * and `smallTargets` still 0 and `overflowX` still 0. The only number in this
 * file that moved is the readout's own height.
 *
 * ## THE COCKPIT PAYS FOR THIS ROW OUT OF THE ROLL PANEL, AND AT ONE VIEWPORT
 * ## IT PAYS THE LAST OF WHAT IT HAD
 *
 * Drawn here rather than in `Play.tsx` means the desktop gets it from the same
 * line, and in the cockpit the arithmetic is `Vitals`'s own: the middle column
 * is a `flex: none` counters panel over a `flex: 1, minHeight: 0` roll panel,
 * so every pixel this row takes is a pixel `DualityRoll` loses. Measured with
 * the same sheet, before and after: the counters panel goes **428x211 ->
 * 428x267** (46 and the panel's 10px gap) and the roll panel **428x404 ->
 * 428x348** at 1180x820.
 *
 * What that does to ROLL, measured at four laptop viewports:
 *
 *   1180x820   painted 54 of 54  ->  54 of 54   (unchanged)
 *   1280x800   painted 54 of 54  ->  54 of 54   (unchanged)
 *   1366x768   painted 54 of 54  ->  40.1 of 54
 *   1180x695   painted 26.1 of 54 -> 0 of 54
 *
 * The last line is the one to read twice, and it is not hidden behind an
 * average. At 1180x695 this sheet's ROLL was ALREADY cut to 26.1 of 54 before
 * this row existed - that panel was already scrolling by 86px - and this row
 * takes the remaining 26. It is a SCROLL and not an unreachable control, which
 * is the distinction `Vitals` draws and which is measured rather than assumed:
 * the rig's finder reports `reachable: true`, `hardClips: []`, `neededScroll:
 * true`, because the panel is `.scroll` and now carries `scroll-fade` to say
 * there is more under it.
 *
 * It was still worth the pixels, and the alternative was worse. Gating this row
 * on the phone would leave a desktop Warlock with no way to spend Favor
 * ANYWHERE in the app - it is drawn on no other screen - which is a control
 * that does not exist against a control that has to be scrolled to. And there
 * is no cheaper shape available: at 1180x695 the roll panel had 26.1px of slack
 * and the smallest honest strip is a 44px target, so nothing that could be
 * drawn there would have kept ROLL painted.
 *
 * ## WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not roll the Patron Die, it does not offer a Favor in place of a Hope
 * on a successful roll, and it does not ration the once-per-rest recharge the
 * dataset carries under the `focus` rule. Those are three rules with three
 * decisions in them and they belong to the surfaces that own the roll and the
 * rest. This is a track and two buttons: the player decides, the app counts.
 *
 * The Focus stepper on **Build** stays where it is, and the doubling is
 * deliberate rather than an oversight: Build is where a stance is learned and
 * Play is where its cost is paid. There is one number in the store behind both
 * controls, so there is nothing for them to disagree about.
 */
import { drawsFavor, drawsFocus } from '../../engine/character.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Step } from '../shared/Counter.tsx';
import type { Character } from '../../../shared/types.ts';

/** The touch floor, and the strip's height. `Counter.tsx` declares the same. */
const TAP = 44;

/**
 * One track, drawn as a strip.
 *
 * The card above this row puts its two glyphs at its two outer edges and its
 * value between them, because the owner asked for the two layouts to agree and
 * named what they were rejecting - «non con più e meno affianco alla
 * statistica». This is that shape at a quarter of the height: same border, same
 * radius, same `overflow: hidden` so the steppers stop at the corner, same
 * order low to high across the strip.
 */
function TrackStrip({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <div
      className="row"
      role="group"
      aria-label={label}
      style={{
        // `minWidth: 0` for the reason the grid below gives: the track is
        // floored at 0 and the ITEM has to be floored too, or it keeps its
        // automatic minimum and overflows the track it was handed.
        minWidth: 0,
        // No gap. The border is the boundary and the steppers reach it; a
        // gutter here would draw a second one, which is `Counter`'s own note.
        gap: 0,
        minHeight: TAP,
        border: '1px solid var(--line)',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        overflow: 'hidden',
      }}
    >
      <Step
        label={`${label} minus one`}
        glyph="−"
        disabled={value <= 0}
        onPress={() => onChange(Math.max(0, value - 1))}
      />
      {/*
       * The readout. A span and not a button, which is the one place this strip
       * is deliberately poorer than the card above it: `Counter`'s value opens
       * numeric entry, and a track that runs 0 to 6 is at most six taps from
       * anywhere, so a keypad would be a second way to do a thing one thumb
       * already does. `minWidth: TAP` all the same - it is what stands between
       * the two steppers at 320, where the strip has 57px for it.
       */}
      <span
        style={{
          flex: '1 1 auto',
          minWidth: TAP,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          overflow: 'hidden',
          /*
           * 2px top and bottom is the room the CLIP needs, and it is the mono
           * face's own descent rather than a nudge.
           *
           * Both children set their line box to their font size - `.t-label` is
           * `10px/1` and `.t-num` is `13px/1`, and a unitless 1 re-resolves
           * against the size declared here. IBM Plex Mono's content area is not
           * 1em: measured off the loaded face, at 16px its ascent is 16 and its
           * descent 4, so the text occupies 20px inside a 16px box. Half-leading
           * is `(16 - 20) / 2`, so the value hangs 2px past its box at each end,
           * and the label - 11 + 3 at 11px - hangs 1.5.
           *
           * With `0 6px` those 2px landed outside a box that clips, which the
           * rig read as `clientH 30` against `scrollH 32` on all three viewports
           * it measures, desktop included, and 0.21px of which was the tail of
           * the `/` glyph rather than empty metrics. Padding is the honest half
           * of that pair: the type keeps the tight line the whole app sets, and
           * the box that hides things is made as tall as what it holds.
           *
           * It costs nothing that was measured. The readout grows 30 -> 34, it
           * is centred in a 44px strip by `.row`, so its top moves up exactly
           * the 2px the padding adds back: the label stays 37.41x11 and the
           * value 28.81x16 at the same y they were measured at, the strip stays
           * 181.5x46 at 393, and 46 is still the whole of what the row costs.
           */
          padding: '2px 6px',
        }}
      >
        <span
          className="t-label"
          style={{
            // `0 1 auto` and not `none`, the way the card's label is declared:
            // if a longer name ever arrives, the name is the half that loses a
            // letter and the number is the half that does not.
            flex: '0 1 auto',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.08em',
            fontSize: 11,
            color: 'var(--text)',
          }}
        >
          {label}
        </span>
        {/*
         * `aria-live`, because the two glyphs beside this are the only things a
         * screen reader is told about otherwise, and "Focus plus one" pressed
         * four times has to say where it got to. Polite: this is never the most
         * important thing happening on the screen.
         */}
        <span className="t-num" aria-live="polite" style={{ fontSize: 16 }}>
          {`${String(value)}/${String(max)}`}
        </span>
      </span>
      <Step
        label={`${label} plus one`}
        glyph="+"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </div>
  );
}

export function ClassTracks(): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const update = useApp((s) => s.update);

  if (!character) return null;

  const write =
    (key: 'focus' | 'favor') =>
    (marked: number): void => {
      update((c: Character) => ({ ...c, [key]: { ...c[key], marked } }));
    };

  const tracks: { key: 'focus' | 'favor'; label: string }[] = [];
  if (drawsFocus(character)) tracks.push({ key: 'focus', label: 'FOCUS' });
  if (drawsFavor(character, index)) tracks.push({ key: 'favor', label: 'FAVOR' });
  // Neither track: no element, so the panel's own `gap` does not pay for a row
  // that is not there. Eleven of the thirteen shipped classes land here.
  if (tracks.length === 0) return null;

  return (
    <div
      style={{
        flex: 'none',
        display: 'grid',
        /*
         * `minmax(0, 1fr)` per track, for the two words and a defect the grid
         * above this one carries the derivation of: a bare `1fr` is
         * `minmax(auto, 1fr)`, and that automatic minimum is the item's own
         * min-content - 44 + 44 of steppers plus the readout's floor - so the
         * grid would have had a constant minimum wider than a 320px column and
         * pushed the far `+` off the glass on a screen whose overflow-x is
         * hidden. Floored here and floored on the item, the shortfall lands on
         * the readout, which declares 44 and hides what will not fit.
         *
         * As many columns as there are tracks, so one entitlement is one
         * full-width strip rather than a strip and a hole. Measured: 369x44 at
         * 393 with one track, two of 181.5x44 with both.
         */
        gridTemplateColumns: `repeat(${String(tracks.length)}, minmax(0, 1fr))`,
        gap: 6,
      }}
    >
      {tracks.map(({ key, label }) => (
        <TrackStrip
          key={key}
          label={label}
          value={character[key].marked}
          max={character[key].max}
          onChange={write(key)}
        />
      ))}
    </div>
  );
}
