/**
 * The Duality Roll.
 *
 * The roll control and the result readout are the same object: nothing appears,
 * nothing moves, the background simply becomes the verdict. That is what lets
 * you read the outcome from across a table without hunting for where the
 * answer went.
 *
 * Two ways in, and only one of them is on by default. Tap ROLL and the app
 * rolls. A table that rolls real dice turns on "Type your own dice" in
 * settings, and then every die of the roll can be tapped and typed into - the
 * app still resolves the outcome, the Hope/Fear economy and the critical.
 *
 * EVERY die, which it did not use to mean. The two faces were typed and the
 * advantage d6 and the bonus dice were rolled by `cryptoRng` underneath them,
 * and the sum was presented as the player's roll - the app inventing a number
 * at a table that had switched it off. The armed dice have slots of their own
 * now, `ExtraSlot` carries the argument, and a roll with a die still blank does
 * not resolve at all rather than resolving on a number nobody rolled.
 *
 * Typing used to be unconditional, and it cost more than it looked. The two
 * faces hold the best band on a phone, directly above ROLL and directly under
 * the thumb, and with the roller on they spend it showing two em dashes until
 * somebody taps one. Worse, a resolved roll stayed one tap from being
 * rewritten by a thumb resting where thumbs rest. Off by default the faces
 * only report, and the band they were holding goes to the things a player
 * actually reaches for mid-scene.
 *
 * The two switches are independent, so both can be off. That state is real and
 * is not prevented: the control says which switch is missing rather than
 * sitting there greyed out with the word ROLL still on it.
 *
 * Before the dice comes the declaration, and the SRD is strict about the order:
 * "Unless an action, ability, or feature specifically allows for it, a player
 * must declare the use of any Experiences, extra dice, or other modifiers
 * before they roll." So the control row arms them, and everything armed is
 * disarmed again the instant the roll resolves - an Experience left standing
 * would inflate the next roll by two and say nothing about it.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Experience, Trait } from '../../../shared/types.ts';
import { TRAIT_LABELS } from '../../../shared/types.ts';
import { rollModifier, type DerivedStats } from '../../engine/character.ts';
import {
  OUTCOME_LABEL,
  outcomeDetail,
  rollDuality,
  type DualityResult,
} from '../../engine/dice.ts';
import { useActive, useApp } from '../../store/state.ts';
import { rollAffordance, type RollAffordance } from '../shared/rollAffordance.ts';
import { experiencesFor, type ArmedAttack, type AttackSource } from './attack.ts';
import { DamageRow } from './DamageRoll.tsx';
import { FavorRow } from './FavorRow.tsx';
import { DIE_SIZES, MAX_HELD, useHeldDice, useHeldFor, type HeldDie } from './heldDice.ts';

export type RollTrait = Trait | 'spellcast';

export interface RollState {
  result: DualityResult | null;
  trait: RollTrait;
}

const verdictBackground = (r: DualityResult | null): string => {
  if (r === null) return 'var(--app)';
  if (r.critical) return 'var(--crit-wash)';
  return r.withHope ? 'var(--hope-wash)' : 'var(--fear-wash)';
};

const verdictColor = (r: DualityResult | null): string => {
  if (r === null) return 'var(--dim)';
  if (r.critical) return 'var(--text)';
  return r.withHope ? 'var(--hope)' : 'var(--fear)';
};

interface DieProps {
  label: string;
  color: string;
  value: number | null;
  /** Ask the roll surface to swap both faces for the keypad. */
  onEdit: () => void;
  size: number;
  editable: boolean;
}

/**
 * The keypad a physical die is typed into. It takes the whole face row, and
 * that is the fix rather than the styling.
 *
 * IT USED TO TAKE ONE FACE, AND ONE FACE IS NOT WIDE ENOUGH TO HOLD IT. The
 * twelve keys are `repeat(4, 1fr)` with `gap: 3`, `padding: 6` and a 1.5px
 * border that lays out as 1 at dpr 1, so a key is `(G - 23) / 4` for a grid of
 * outer width G, and they carry `minHeight: var(--control)` and no `minWidth`
 * at all - the width simply falls out of whatever box they are in.
 *
 * Inside one die face, G was half the row: on a phone the column is the
 * viewport less 24 of padding, the face row gaps by 8, so G = (vw - 32) / 2 and
 * a key is **(vw - 78) / 8** - 30.3px at 320, 35.3 at 360, **37.1 at 375**,
 * 39.4 at 393, and still under 44 all the way to 429px of viewport. On the
 * cockpit the die face is narrower still: the middle grid track is 428, less
 * the panel's border and padding is 402, less the 132px trait box and two 12px
 * gaps leaves 246 for two faces, so G is 123 and a key is **24px wide**, which
 * is what the audit measured in Chrome at 1440x900 (grid 119x122, four 24px
 * columns). My reconstruction from the declared track gives 24.75 if the
 * border lays out at its declared 1.5 and 25.0 if it rounds to 1, and I could
 * not close the last pixel against the measured 24; the measurement is the one
 * used here and all three numbers say the same thing. 24 is under this
 * project's 34px fine-pointer floor, under its 44px
 * coarse one, and under WCAG's 24 by a hair - on the control a player uses to
 * type the number they just rolled on a real die.
 *
 * NO COLUMN COUNT FIXES THE COCKPIT, WHICH IS WHY THE WIDTH HAD TO MOVE. Four
 * 34px keys need 4 * 34 + 9 of gaps + 12 of padding + 2 of border = 159px of
 * grid, and the cockpit die face is 123. Three need 122, which is inside 123
 * by one pixel and is not a margin. `repeat(auto-fit, minmax(var(--control),
 * 1fr))` is the CSS-native form of that arithmetic and it lands on three 34.33
 * columns - a third of a pixel of slack over the fine floor, and 9.67 under the
 * coarse one, on every machine that draws this layout. An earlier revision said
 * it landed on two for a touchscreen laptop "where `(pointer: coarse)` takes
 * `--control` to 44", and that is not what tokens.css does: see the ERGONOMICS
 * paragraph below. The audit proposed a `--die-keys` token switched at 437px
 * instead, which fixes the phone and leaves the cockpit at 24. Taking the whole
 * face row fixes both: the keypad is `flex: 1` where the two faces were, so G
 * is 299 at 375 and 206 on the cockpit - measured 206 in Chrome - and a key is
 * **69px** and **45.75px** wide, measured 45.8. Above 44 in width at every
 * width in the audit sweep, 320 included, where it is 55.25 - so it needs no
 * breakpoint of its own, which `useLayout.ts` forbids a component to invent,
 * and no new token in a stylesheet.
 *
 * THE COCKPIT'S 402 HAS A SCROLLBAR TERM IN IT, WHICH THIS ARITHMETIC USED TO
 * OMIT. The panel scrolls, and this keypad is the state that guarantees it
 * overflows - so on a platform that draws a classic bar rather than an overlay
 * one, the panel's content box is narrower than 402 and every number above
 * comes down with it. The panel reserves that gutter with `scrollbar-gutter:
 * stable` so it is one width per platform instead of one per scroll state, and
 * `.scroll` bounds the bar at 8px: worst case 394 of content, 198 of grid -
 * the 206 measured above, less that 8 - and a key of (198 - 23) / 4 = **43.75**
 * - a quarter-pixel under the 44px coarse
 * floor and 9.75 over the 34px fine one. macOS draws overlay bars, so the
 * gutter is 0 there and the number stays 45.75; measured with a Chrome launched
 * without `--hide-scrollbars`, this panel's whole gutter is its 2px border.
 *
 * IT COSTS NO HEIGHT THAT IT DID NOT ALREADY COST. The grid is still three rows
 * of `var(--control)` with two 3px gaps, 12 of padding and 2 of border: 152 on
 * a phone and 122 on the cockpit, exactly what it measured before this widened
 * it. What it replaces is the dice row, which is 76 on the cockpit and not the
 * 62 of `Die`'s `minHeight` - see the roll panel's budget table - so opening
 * the keypad costs the panel 46px there. Measured at 1280x800 with five
 * Experiences: 474 of panel client, 474 of scrollHeight closed and 494 open,
 * ROLL painted 54 of 54 in both.
 *
 * AND IT HAS A WAY OUT, WHICH IS BACKLOG P3-12. The grid replaced the die
 * button while it was open, so there was nothing left to tap again: no cancel,
 * no backdrop, no Escape, and the only exit was committing a face - typing a
 * number you did not roll to get out of a keypad you opened by accident. The
 * die's own label is that exit now. It is a full-height 44px column at the head
 * of the row, so it costs no height at all, and it does the second job the
 * one-face keypad did for free: saying which die you are typing.
 *
 * FOR THE KEYBOARD TOO, WHICH THE FIRST VERSION OF THAT EXIT WAS NOT. Opening
 * this unmounts the die face that had focus, so focus fell to `<body>`:
 * measured, `document.activeElement` is BODY the instant the grid appears, and
 * the exit is then the 53rd focusable on the cockpit with key "1" the 54th of
 * 81 - fifty tabs to reach a control the player had just opened. Escape worked
 * and left focus on `<body>` as well, so the way out fired into nothing. The
 * exit takes focus on mount now, and `DualityRoll` puts focus back on the die
 * face when the keypad closes, however it closed. That is `useDialog`'s
 * pattern minus the Tab trap: this is not an overlay, nothing behind it is
 * inert, and tabbing straight out of it is allowed.
 *
 * ERGONOMICS. TARGET SIZE is the whole charge and it moves from 24x34 on the
 * cockpit and 37.1x44 on a phone to 45.75x34 and 69x44 - measured 45.8x34 in
 * Chrome at 1280x800 and 1440x900 alike. WHICH FLOOR EACH OF THOSE CLEARS,
 * SINCE AN EARLIER REVISION SAID "both floors in both directions" AND THAT IS
 * NOT TRUE OF THE HEIGHT ON THE COCKPIT. `--control` is 44 below 1180 and 34 at
 * 1180 and up, because tokens.css:203-207 is `(max-width: 1179px), (pointer:
 * coarse)` and `pointer` describes only the PRIMARY pointer - a touchscreen
 * laptop and an iPad in a keyboard case both answer `pointer: fine`, which
 * tokens.css:129-132 states outright and which is the entire reason `--pip-h`
 * has an `any-pointer: coarse` query of its own. Measured with the rig's
 * `hybrid` profile at 1280x800 and 1440x900: `--control` 34px, `--pip-h` 44px.
 * So a phone key is 69x44 and clears both floors; a cockpit key is 45.8x34,
 * which clears the 34px fine floor in both directions and is 10px under this
 * project's 44px coarse floor in height for a finger on a touchscreen laptop.
 * That is `--control`'s query and not this grid - every chip on this panel has
 * it - and it is written up in the lane's doc-deltas file. The 3px gutter is
 * left alone: it is a gutter between 45-to-69px targets now rather than between
 * 24px ones, and widening it would come straight back out of the keys.
 * THUMB ARC: on a phone this row sits directly above ROLL, the
 * band the file's own docblock calls the best on the screen, and the keys are
 * where they already were; what moved is the exit, to the LEFT edge, away from
 * where a right thumb rests. That is deliberate and it is the same argument
 * MODS is placed on - except inverted, because here the resting corner is a
 * digit and a digit is the consequential press. READ VERSUS TOUCH: the label
 * you read to know which die this is now sits at the start of the row rather
 * than being the thing that vanished, and the twelve things you touch follow
 * it left to right, top to bottom.
 *
 * AND THE OTHER DIE IS READ BACK HERE, BECAUSE TAKING THE WHOLE ROW TOOK IT
 * OFF THE SCREEN. When this replaced one face the other stayed beside it,
 * showing the number already typed into it; taking both means that number has
 * nowhere else to be. Nothing else prints it: `rollLine`'s raw-dice branch is
 * gated on `!canType`, and the cockpit's trait box prints `result?.total ?? '—'`
 * - an em dash until BOTH faces are in, which is exactly the state this is. The
 * comment that used to sit over the cockpit's face row called that box "the one
 * number you want in front of you while you type the two that make it"; it
 * reads `—` in the only state where it would be wanted. Concretely, at 393x852
 * with typed dice on and the digital roller off: tap HOPE, press 5, tap FEAR,
 * and the 5 was nowhere on the glass.
 *
 * It goes under the exit rather than beside the grid. A readout beside the grid
 * would take about 50 of the cockpit's 206 and put a key at (148 - 23) / 4 =
 * 31.25, under the 34px fine floor - undoing the change this component exists
 * for. The exit column is `var(--tap)` wide by 122 on the cockpit and 152 on a
 * phone and it holds one 10px label over a 15px glyph, so a 30px readout under
 * it costs the exit height it has to spare. Measured with a HOPE of 7 typed and
 * the FEAR keypad open: the exit is 44x88 at 1280x800 and 44x118 at 393x852,
 * the grid is still 206 and 317 wide, and the keys are still 45.8x34 and
 * 73.5x44 - so the readout costs the twelve targets nothing at all. It is drawn
 * only when the other die HAS a value, so a keypad opened first shows the same
 * column it always did.
 */
function DieKeypad({
  label,
  color,
  value,
  onSet,
  onCancel,
  otherLabel,
  otherColor,
  otherValue,
}: {
  label: string;
  color: string;
  value: number | null;
  onSet: (value: number) => void;
  onCancel: () => void;
  otherLabel: string;
  otherColor: string;
  otherValue: number | null;
}): React.JSX.Element {
  /*
   * The keyboard's way IN, beside the pointer's.
   *
   * Opening this unmounts the die face that had focus, and focus falls to
   * `<body>` - measured, `document.activeElement` is BODY the instant the grid
   * appears. For a keyboard that is worse than the missing cancel this control
   * exists to be: the exit is the 53rd focusable on the cockpit and key "1" the
   * 54th of 81, so a keypad the player just opened was fifty-odd tabs away.
   *
   * The exit takes focus instead, so the way out is where the keyboard already
   * is and the twelve keys are one Tab further on. This is `useDialog`'s
   * pattern minus the Tab trap, which is exactly what the docblock over the
   * Escape listener says this surface cannot use: it is not an overlay, nothing
   * behind it is inert, and tabbing out of it is allowed.
   */
  const exit = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    exit.current?.focus();
  }, []);

  return (
    <div className="row" style={{ flex: 1, minWidth: 0, gap: 8, alignItems: 'stretch' }}>
      <div
        className="stack"
        style={{ flex: 'none', width: 'var(--tap)', minWidth: 'var(--tap)', gap: 4 }}
      >
      <button
        ref={exit}
        type="button"
        onClick={onCancel}
        aria-keyshortcuts="Escape"
        aria-label={`Stop typing the ${label} die`}
        title="Back to the dice"
        style={{
          flex: 1,
          width: 'var(--tap)',
          minWidth: 'var(--tap)',
          background: 'var(--app)',
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--r4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span className="t-meta" style={{ color, letterSpacing: '0.14em' }}>
          {label}
        </span>
        <span aria-hidden="true" style={{ font: '600 15px/1 var(--sans)', color }}>
          ×
        </span>
      </button>
      {otherValue !== null && (
        <div
          style={{
            flex: 'none',
            background: 'var(--raised)',
            borderRadius: 'var(--r3)',
            padding: '3px 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <span className="t-meta" style={{ color: otherColor, letterSpacing: '0.1em' }}>
            {otherLabel}
          </span>
          <span className="t-num" style={{ color: 'var(--text)' }}>
            {otherValue}
          </span>
        </div>
      )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--app)',
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--r4)',
          padding: 6,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 3,
          alignContent: 'center',
        }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onSet(n)}
            style={{
              minHeight: 'var(--control)',
              borderRadius: 'var(--r1)',
              background: n === value ? color : 'var(--raised)',
              color: n === value ? 'var(--app)' : 'var(--text)',
              font: '600 12px/1 var(--mono)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A die face. It reports what the die showed, and when `editable` it is also
 * the way into the keypad, so physical dice have somewhere to go.
 *
 * Not editable is the default state of the app, and then this is a readout and
 * says so: no pointer cursor, and an accessible name without the invitation to
 * tap. A control that looks pressable and does nothing is worse than a label.
 *
 * The keypad used to live in here, in a `useState` of its own, and returned in
 * place of this button. It is `DieKeypad` now and the roll surface owns which
 * die is being typed, because a keypad that fits inside one face is a keypad
 * with 24px keys on the cockpit - the arithmetic is over `DieKeypad`.
 */
function Die({ label, color, value, onEdit, size, editable }: DieProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => editable && onEdit()}
      aria-label={`${label} die${value === null ? '' : `: ${value}`}${editable ? ' - tap to enter a physical roll' : ''}`}
      style={{
        flex: 1,
        background: 'var(--app)',
        border: `1.5px solid ${color}`,
        borderRadius: 'var(--r4)',
        padding: '9px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 62,
        cursor: editable ? 'pointer' : 'default',
      }}
    >
      <span className="t-meta" style={{ color, letterSpacing: '0.14em' }}>
        {label}
      </span>
      <span
        style={{
          font: `800 ${size}px/1 var(--sans)`,
          textAlign: 'right',
          color: value === null ? 'var(--dim)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value ?? '—'}
      </span>
    </button>
  );
}

/**
 * Which die a typed face belongs to. Hope and Fear are the pair `Die` draws;
 * the rest are one advantage d6 and one entry per held die armed into the
 * roll, keyed by the tray id so arming and disarming cannot shuffle the faces
 * already typed onto the dice beside them.
 */
type TypedKey = 'hope' | 'fear' | 'advantage' | `bonus:${string}`;

/** One die on the roll that is neither Hope nor Fear, as the slot row draws it. */
interface ExtraDie {
  key: TypedKey;
  /** ADV, DIS or +D6: the same word the control that armed it wears. */
  label: string;
  sides: number;
  color: string;
  value: number | null;
}

/**
 * The extra-dice row of one roll, built in one place because it is built at two
 * moments: from the live declaration while a roll is being assembled, and from
 * the declaration a roll HAD at the instant it resolved - which `resolve` then
 * freezes, because it clears that declaration in the same breath.
 *
 * The labels and the colours are the ones the controls that armed them wear:
 * ADV is `--ok` and DIS is `--damage` in the advantage group, a held die is
 * `+d6` on its chip. Two identical d6 slots are otherwise indistinguishable,
 * and typing the Rally die into the advantage slot is a wrong total that
 * nothing on the screen would contradict.
 */
function extraSlots(
  sign: 0 | 1 | -1,
  dice: readonly HeldDie[],
  faces: { advantage: number | null; bonus: Record<string, number> },
): ExtraDie[] {
  return [
    ...(sign === 0
      ? []
      : [
          {
            key: 'advantage' as const,
            label: sign === 1 ? 'ADV' : 'DIS',
            sides: 6,
            color: sign === 1 ? 'var(--ok)' : 'var(--damage)',
            value: faces.advantage,
          },
        ]),
    ...dice.map((d) => ({
      key: `bonus:${d.id}` as const,
      label: `+D${String(d.sides)}`,
      sides: d.sides,
      color: 'var(--text)',
      value: faces.bonus[d.id] ?? null,
    })),
  ];
}

/**
 * The instruction line, from the dice a roll is still waiting for.
 *
 * Exported and pure so its worst case can be counted rather than asserted: it
 * names EVERY outstanding die, and `rollAffordance.test.ts` builds the longest
 * one the surface can be MADE to draw out of `MAX_HELD`, the tray's own sizes
 * and the `started` gate that decides whether the line is drawn at all. The
 * docblock over `rollLine` derives what that line costs the phone bar, and a
 * derivation nothing drives is how that docblock came to claim 38 characters
 * for a line that reaches 110 - and then, correcting itself, 116 for a line the
 * code cannot reach.
 */
export function stillToTypeLine(outstanding: readonly string[]): string | null {
  return outstanding.length === 0 ? null : `STILL TO TYPE: ${outstanding.join(' · ')}`;
}

/**
 * THE FACES OF ONE ROLL, AND WHETHER THAT ROLL IS OVER.
 *
 * THE CONTRACT, WHICH IS THE WHOLE OF THIS TYPE: a total the surface presents
 * is composed only of faces entered for that roll - every one of them, and
 * nothing else.
 *
 * Holding that took a second field, because the first version held the faces
 * and nothing about which roll they belonged to. `resolve` clears the
 * declaration - the SRD makes you declare before you roll, so an Experience or
 * a Rally die left standing would inflate the next roll silently - and the
 * faces stayed behind it with no owner. Re-arm the same tray die and its slot
 * arrived holding the previous roll's face, and a roll made of it resolved on a
 * number rolled for a different roll; type one face after an app-made roll and
 * the app's advantage die went into the player's total, which is the defect
 * this whole file was rewritten for, one roll later.
 *
 * So `resolved` is the owner. Null while a roll is being assembled: the live
 * declaration says what the roll is made of, and a face may be typed into it.
 * Non-null once it has resolved: it is the row that roll was made of, frozen at
 * that instant so the dice behind the total stay on the glass after the
 * declaration that named them is gone - and the panel is now a RECORD. The next
 * face typed starts a new roll from `BLANK` rather than being added to it, and
 * `stillToType` names every die that roll now wants, including the ones showing
 * a number a moment ago.
 *
 * WHAT ELSE CLEARS IT, WHERE ANYBODY CAN TYPE: arming or disarming a held die,
 * and changing the advantage sign. Both change what the roll is made of, which
 * makes it a different roll - and while one is still being assembled, disarming
 * a die takes its face with it, so a face lives exactly as long as the die it
 * was typed for stays armed. A character switch clears it too, in the effect
 * that clears the rest of the declaration.
 *
 * WITH TYPING OFF, NONE OF THAT IS TRUE AND NONE OF IT IS NEEDED. `resolve` is
 * then the only writer: no face is an input, `extraDice` is empty, and every
 * field here is a readout of the last roll the app made. A declaration changed
 * afterwards is a statement about the NEXT roll and leaves this alone -
 * `redeclare` returns before it touches anything. See the two clauses on
 * `redeclare`.
 *
 * NOTHING ELSE MAY WRITE IT. In particular the correcting tap is gone: an
 * edited face used to re-resolve against whatever else was left in here, which
 * is indistinguishable from the second roll of a session and was being used as
 * both.
 */
interface Manual {
  hope: number | null;
  fear: number | null;
  advantage: number | null;
  /** Keyed by tray id and never by position: see `TypedKey`. */
  bonus: Record<string, number>;
  /** The row this roll resolved with, or null while it is still open. */
  resolved: ExtraDie[] | null;
}

/** A panel with no roll in it. Spread, never mutated. */
const BLANK: Manual = { hope: null, fear: null, advantage: null, bonus: {}, resolved: null };

/**
 * A ROLL THAT HAS BEEN MADE, AND EVERY PART OF ITS TOTAL THE PANEL GOES ON
 * PRINTING.
 *
 * `Manual.resolved` freezes the ROW, on `DamageRow`'s rule that "a row of dice
 * a player has just read aloud is never sitting beside a total that does not
 * come from it". The dice are not the whole of a total. `rollDuality` adds the
 * trait modifier to them, and the cockpit prints that modifier's NAME in the
 * same 132px box as the total, on the line directly above it - so a frozen
 * total beside a live label read `AGILITY / 10` for a 10 that a different
 * trait produced, and the three figures that box and its neighbours show at
 * once (HOPE 1, FEAR 8, TOTAL 10) stopped adding up on their own faces. The
 * row was bought and the addend beside it was not.
 *
 * THE CHOICE WAS TO FREEZE THE LABEL OR TO DROP THE TOTAL when the trait
 * moves, and dropping it is this round's other defect in a second costume:
 * with the roller on and typing off, that total is the only record of the roll
 * anywhere on the screen. So the label is frozen WITH the result, in one state
 * rather than two that can disagree - which is the argument `Manual` makes for
 * itself one paragraph up.
 *
 * WHAT IS DELIBERATELY NOT IN HERE. `modSign` on the ROLL control is the
 * arithmetic of the NEXT roll and has to stay live; the Difficulty is not an
 * addend of the total at all; and the Experiences are cleared by the roll that
 * spent them, so anything armed after it is drawn under `NEXT:` already.
 *
 * `hopeGained` IS IN HERE AND IS NOT AN ADDEND OF ANYTHING. It is the one fact
 * about a roll that cannot be recovered from its `DualityResult`, because the
 * clamp that produces it does not live in the engine: `resolve` marks the Hope
 * through `Math.min(c.hope.max, …)`, so a player already at their maximum has
 * `effects.hope` of 1 and a track that did not move. `FavorRow` trades that
 * Hope back, and asked afterwards the question has no answer - a sheet sitting
 * at 6 of 6 cannot say whether this roll took it there or found it there. So it
 * is recorded at the instant it is applied, and frozen with the result for the
 * same reason `traitLabel` is: it belongs to THIS roll and to no later one.
 */
interface Rolled {
  result: DualityResult;
  /** The trait this total was made with, in the words the panel prints. */
  traitLabel: string;
  /** What this roll actually put on the Hope track: 0 or 1, after the ceiling. */
  hopeGained: number;
}

/**
 * THE DICE THE APP USED TO ROLL FOR A TABLE THAT HAD SAID IT DOES NOT WANT
 * THAT.
 *
 * `rollDuality` takes `fixed` for four things - hope, fear, the advantage d6
 * and every bonus die - and this surface only ever handed it two. So a player
 * who types their own dice typed a Hope and a Fear, and the app rolled the
 * advantage die and the Rally die with `cryptoRng`, added them, and printed the
 * sum as the number the player had just rolled. On a roll with ADV and a d6
 * armed that is 2 to 12 of a total the app invented at a table that switched
 * the roller off. It is the failure this file's `rollAffordance` docblock is
 * written against, one indirection further in: not a control claiming a
 * capability it lacks, but a control quietly using one it was told not to.
 *
 * SO EVERY DIE THAT COUNTS GETS A TARGET, AND NOTHING RESOLVES UNTIL THEY ALL
 * HAVE A FACE. The refusal is the honest half: the roll is held back rather
 * than a blank filled in, and the bar says which die it is still waiting for.
 * Nobody is made to type a die they do not have either - a slot exists only for
 * a die the player armed themselves, so the row is empty on the ordinary roll
 * and never asks for a d6 nobody picked up.
 *
 * WHY A SLOT AND NOT ANOTHER `Die`. `Die` is 62px tall at `size={26}` and is
 * half of a two-up row; four of them would be two more 62px bands on a phone,
 * for dice that are armed on maybe one roll in five. This is `FaceSlot`'s
 * idiom from `DamageRoll.tsx` instead - one `var(--tap)` box, a label and a
 * number - and it is a copy rather than an import because that component is not
 * exported and that file is not this lane's to change. What is copied is the
 * gesture, which is the part the table learns: a slot opens a grid of faces,
 * and picking one closes it.
 *
 * ERGONOMICS. TARGET SIZE: `flex: '1 1 44px'` with `minWidth`/`minHeight` of
 * `var(--tap)` declared inline, so a slot is never under 44 in either direction
 * on any layout - two on a 393px phone are (369 - 6) / 2 = 181.5 wide, four are
 * 87.75, and the row wraps at eight rather than shrinking a ninth, because
 * 8 * 44 + 7 * 6 = 394 is over the 369 that column has. The cockpit's 402 holds
 * those same eight. THUMB ARC: this row goes ABOVE the Hope and Fear faces,
 * which keeps the two big faces and ROLL in the band directly under the thumb
 * that this file's own docblock calls the best on the screen. It is also the
 * reading order the ARMED strip sets up: the strip names ADV and +D6, and the
 * dice for exactly those things are the next thing down. READ VERSUS TOUCH: the
 * label is read - it is the only thing telling two identical d6 slots apart -
 * and the number beside it is read back afterwards; what is touched is the
 * whole 44px box.
 */
function ExtraSlot({
  die,
  done,
  open,
  onToggle,
}: {
  die: ExtraDie;
  /**
   * The roll these dice were typed for has resolved, so the slot is the record
   * of it rather than a way into it - see `Manual`. It says so in its own name
   * and it does not open: a keypad here would be an offer to edit one die of a
   * finished roll, and committing a face is what starts the next one.
   *
   * `disabled` is only half of that, and it was the only half for a while. The
   * grid is drawn from `typing`, not from the slot, so a keypad already open
   * when the app rolled stayed open over the frozen row - the exact offer this
   * paragraph says cannot be made. `resolve` shuts it; the note there says what
   * pressing a key in it did.
   */
  done: boolean;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-die={die.key}
      {...(done ? {} : { 'aria-expanded': open })}
      disabled={done}
      aria-label={`${die.label} d${die.sides}${
        die.value === null ? ', not entered' : `: ${die.value}`
      } - ${
        done
          ? 'the roll it was typed for is done'
          : `tap to ${open ? 'stop typing it' : 'enter what it showed'}`
      }`}
      onClick={onToggle}
      style={{
        // `1 1 44px`, so a slot grows into the row it is given and wraps to a
        // second row rather than going under the floor. `FaceSlot`'s number.
        flex: '1 1 44px',
        minWidth: 'var(--tap)',
        minHeight: 'var(--tap)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '0 10px',
        borderRadius: 'var(--r3)',
        background: open ? 'var(--raised)' : 'var(--app)',
        border: `1px solid ${die.value === null ? 'var(--line-soft)' : die.color}`,
      }}
    >
      <span className="t-meta" style={{ color: die.color, letterSpacing: '0.14em' }}>
        {die.label}
      </span>
      <span
        style={{
          font: '800 15px/1 var(--sans)',
          color: die.value === null ? 'var(--dim)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {die.value ?? '—'}
      </span>
    </button>
  );
}

/**
 * The faces of one armed die, under the slot it was opened from.
 *
 * FIVE COLUMNS, WHICH IS `FaceKeypad`'S NUMBER AND NOT `DieKeypad`'S FOUR. A
 * Duality die is always a d12; this one draws the advantage d6 or one of the
 * tray's own sizes, which `DIE_SIZES` fixes at d4, d6, d8, d10 and d12 - so
 * twelve keys are three rows at five across against three rows at four. A key
 * is `(G - 26) / 5` for a grid of outer width G - 2 of border at dpr 1, 12 of
 * padding and four 3px gutters - and G here is the whole row, because there is
 * no exit column taking `var(--tap)` and a gap out of it first. So a key is
 * **54.0** at a 320px viewport, **68.6** at 393, and **75.2** on the cockpit's
 * 402px panel - 73.6 with the 8px bar that `.scroll` bounds and
 * `scrollbar-gutter: stable` reserves. Over the 44px coarse floor in width at
 * every width this app draws for, and the height is `minHeight: var(--control)`,
 * which is 44 below 1180 and 34 on a fine-pointer cockpit, exactly as it is for
 * the other two keypads on this screen.
 *
 * IT OPENS UNDER ITS SLOT RATHER THAN OVER IT, WHICH IS THE ONE PLACE THIS
 * DIVERGES FROM THE OTHER TWO. `DieKeypad` takes the whole face row and has a
 * readback column bolted to it for the sibling face it displaced - its docblock
 * argues that at length, because taking the row took the number you had just
 * typed off the glass. Here there can be up to thirteen dice - one advantage
 * die and `MAX_HELD` - so a displaced row is up to thirteen numbers with
 * nowhere to go, and no column holds that.
 * Leaving the slots standing solves it outright: everything already typed stays
 * exactly where it was, the open slot is the way out - it is `aria-expanded`
 * and a second tap closes it - and focus never leaves the document, because
 * nothing is unmounted.
 *
 * WHAT IT COSTS, AND WHO PAYS. Rows are `ceil(sides / 5)` against the five
 * columns declared below, so the grid is `rows * var(--control) + (rows - 1) * 3
 * + 14` of padding and border. Over `DIE_SIZES` and the advantage d6 that is
 * one row for the d4, two for the d6, d8 and d10, and three for the d12 alone -
 * so **105** on a phone and **85** on the cockpit for everything up to the d10,
 * and **152** and **122** for the d12. This paragraph called the d10 and the
 * d12 "both three rows" and put the d10 in the worst case with it; `ceil(10 / 5)`
 * is 2, so a d10 costs exactly what the d6 it was being contrasted with costs.
 * The two three-row numbers are the ones `DieKeypad`'s docblock derives for its
 * own three rows, which is the cross-check that this arithmetic is the house
 * one, and `declares the floors the slot row and its keys are read at` counts
 * the rows off `DIE_SIZES` so this cannot go stale again.
 *
 * That is real height on a 393x852 phone and it is paid by the scroll: the Play
 * screen scrolls deliberately, and it is paid only while a keypad is open, by a
 * player who is looking at the thing they are typing into and is not reaching
 * for ROLL - which comes back up the moment the last face lands, because the
 * last face resolves the roll and shuts the grid.
 */
function ExtraKeypad({
  die,
  onSet,
}: {
  die: ExtraDie;
  onSet: (value: number) => void;
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={`The faces of the ${die.label} d${die.sides}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 3,
        padding: 6,
        borderRadius: 'var(--r4)',
        background: 'var(--app)',
        border: `1.5px solid ${die.color}`,
      }}
    >
      {Array.from({ length: die.sides }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSet(n)}
          style={{
            minHeight: 'var(--control)',
            borderRadius: 'var(--r1)',
            background: n === die.value ? die.color : 'var(--raised)',
            color: n === die.value ? 'var(--app)' : 'var(--text)',
            font: '600 12px/1 var(--mono)',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

interface Props {
  stats: DerivedStats;
  trait: RollTrait;
  onTraitChange: (trait: RollTrait) => void;
  /**
   * What the next attack is made with, re-derived by `Play` on every render.
   *
   * It is snapshotted into an `ArmedAttack` at the instant a roll resolves and
   * never read again by the damage row, so putting the weapon down after the
   * roll cannot change the dice that roll earned. Null for a bare trait roll,
   * and then the roll simply offers no damage.
   */
  source: AttackSource | null;
  layout: 'desktop' | 'phone';
  /**
   * The Experiences declared for the next roll, owned by `Play`.
   *
   * They used to live in this component's own `useState`, and they cannot stay
   * there: Giorgio's order puts the Experiences behind a fold *below* ROLL,
   * between the weapons and the inventory, and that fold is rendered by
   * `PlayPhone` - several hundred pixels of document above the component that
   * knows which chips are armed.
   *
   * Moving them up also puts the clearing rule in one place. `Play` already
   * clears the armed attack and the spell modifier on a character switch, in
   * one `[characterId]` effect; the Experiences were being cleared by a second
   * effect in this file, on the same key, which is how the two could ever have
   * disagreed about whose declaration the arriving sheet was holding.
   */
  armedExperiences: string[];
  onArmedExperiencesChange: (ids: string[]) => void;
}

/**
 * Whether a scrolling box still has content under its bottom edge.
 *
 * `.scroll-fade` is this app's "there is more below" mark, and base.css's own
 * docblock says the sentence it used to carry - "disappears once you reach the
 * end" - was never true anywhere it was declared, because it was declared
 * unconditionally. This is what makes it true: the class goes on only while
 * something is actually below the fold, so reaching the end takes the fade with
 * it and a panel that fits never wears one.
 *
 * IT RE-READS ON EVERY COMMIT, deliberately, and that half has not changed.
 * What moves this answer is the box's own scrollTop (the listener), the box's
 * own size (the observer) and its children's heights - the damage row
 * appearing, the keypad opening, a name wrapping to a third line - and the last
 * of those is not observable without watching every descendant. A layout effect
 * with no dependency list runs after each commit and sees all three, before the
 * browser paints.
 *
 * ## What re-reading on every commit must not drag with it
 *
 * It used to be one effect, so the reading and the wiring shared the empty
 * dependency list and every commit of `DualityRoll` tore the `scroll` listener
 * off, put an identical one back, disconnected the `ResizeObserver` and
 * constructed a fresh one. `DualityRoll` commits on every die tap, every armed
 * modifier, every trait change and every roll - and, since the roll animation
 * ticks state, several times per roll - so the panel was paying a listener
 * swap and an observer allocation for interactions that cannot possibly change
 * whether there is content below the fold.
 *
 * Worse than the allocation: `observe()` schedules a callback for the initial
 * size of every newly observed element, so each of those commits also queued an
 * extra `read` to run after paint. The one useful `ResizeObserver` was being
 * replaced by a new one before it had reported anything.
 *
 * So the two are split. The read keeps the empty dependency list, because that
 * is the only way to see a child's height change. The wiring is keyed on the
 * element and runs once per element - which is all it ever needed: an observer
 * survives every resize of the box it watches, that being the entire point of
 * it, and a `scroll` listener survives every scroll of it. Neither has to be
 * rebuilt to keep working.
 *
 * Keyed on the element, and that is why the hook hands back a callback ref
 * rather than a ref object. This panel is the cockpit and tablet layout only -
 * the phone column returns a different tree with no scroller in it - so the
 * element genuinely comes and goes as a window crosses the breakpoint, and a
 * mutable ref would have left the effect wired to a box that had been unmounted.
 * A callback ref into state re-runs the wiring when the node actually changes
 * and never otherwise.
 *
 * The `ResizeObserver` guard is for jsdom, which has no such constructor.
 */
function useMoreBelow<T extends HTMLElement>(): [(node: T | null) => void, boolean] {
  const [box, setBox] = useState<T | null>(null);
  const [more, setMore] = useState(false);

  const read = useCallback((): void => {
    if (box === null) {
      setMore(false);
      return;
    }
    setMore(box.scrollHeight - box.clientHeight - box.scrollTop > 1);
  }, [box]);

  // Every commit, because a child growing is not observable any other way.
  // This allocates nothing and `setMore` bails out on an unchanged value.
  useLayoutEffect(read);

  // Once per element. `read` changes only with `box`, so this list is `[box]`
  // spelled honestly.
  useLayoutEffect(() => {
    if (box === null) return undefined;
    box.addEventListener('scroll', read, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    observer?.observe(box);
    return () => {
      box.removeEventListener('scroll', read);
      observer?.disconnect();
    };
  }, [box, read]);

  return [setBox, more];
}

export function DualityRoll({
  stats,
  trait,
  onTraitChange,
  source,
  layout,
  armedExperiences,
  onArmedExperiencesChange,
}: Props): React.JSX.Element {
  const character = useActive();
  const pushLog = useApp((s) => s.pushLog);
  const update = useApp((s) => s.update);
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);
  /*
   * What the two switches leave this surface able to do, read once and read
   * here - above every piece of state, because `redeclare` is one of the
   * things that has to ask.
   *
   * It used to be derived three hundred lines down, beside the first thing
   * that drew something with it, and that was fine while the only questions
   * were what to draw. It is not a drawing question any more: whether a
   * change to the declaration REOPENS a roll or leaves a record standing is
   * `canType`'s answer, and `redeclare` is above every layout.
   */
  const affordance = rollAffordance(digitalDice, manualDice);
  const { canRoll, canType } = affordance;
  const idleLabel = affordance.label;

  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [advantage, setAdvantage] = useState<0 | 1 | -1>(0);
  const [reaction, setReaction] = useState(false);
  /*
   * The roll that has been made, or none - and `result` as every reader of it
   * has always spelled it. One state and not two: see `Rolled`.
   */
  const [roll, setRoll] = useState<Rolled | null>(null);
  const result = roll?.result ?? null;
  /*
   * Every die of this roll that a player can type, in one state, with the
   * contract and the lifecycle written on `Manual` itself.
   *
   * It was `{ hope, fear }`, which is exactly as far as the typed roll went:
   * the advantage d6 and the bonus dice were rolled by the app underneath a
   * total the player was told was theirs. The bonus faces are keyed by tray id
   * rather than by position, because the armed set is a filter over a tray that
   * the same control row can add to and discard from mid-declaration - by
   * index, discarding the first of two held dice would slide the second one's
   * typed face onto a die it was never rolled for.
   *
   * One object and not four `useState`s, so there is one place that clears it
   * and one place that fills it. Four of those could disagree, and this is the
   * state the screen presents as what the physical dice showed.
   */
  const [manual, setManual] = useState<Manual>(BLANK);
  /*
   * Which die is being typed, and why it is not `Die`'s own state.
   *
   * The keypad needs the whole face row to hold twelve targets at the floor -
   * inside one face it was 24px wide on the cockpit, and the arithmetic is
   * over `DieKeypad`. A component that replaces both of its siblings cannot be
   * one of them, so the surface that draws the row owns the answer to "which
   * die is being typed" and both layouts read it.
   *
   * It answers for the armed dice too, and that is deliberate: one open keypad
   * at a time on this surface, whichever row it belongs to, so Escape and the
   * character-switch reset have one thing to shut rather than two that can be
   * open at once over different halves of the same roll.
   */
  const [typing, setTyping] = useState<TypedKey | null>(null);
  /* The cockpit panel's fold, and whether it has anything under it. Declared
     here rather than in the desktop branch because that branch is a `return`
     past a phone one, and a hook cannot live behind a `return`. */
  const [panelRef, panelHasMore] = useMoreBelow<HTMLDivElement>();

  /*
   * The keyboard's way out, beside the pointer's.
   *
   * `DomainCardView` already argues that the three ways out of an overlay are
   * not equal and that Escape is the keyboard's; this is not an overlay and
   * cannot use `useDialog`, which traps Tab and moves focus, but the key is
   * free and its absence was half of BACKLOG P3-12. It is a window listener
   * rather than an `onKeyDown` on the grid because the tap that opens the
   * keypad unmounts the button that had focus, so there is nothing inside it
   * for a bubbling handler to catch until something is tabbed to.
   *
   * AND IT CHECKS WHAT IS ON TOP OF IT, WHICH IS THE PART THIS CODEBASE HAS
   * NAMED TWICE. `useDialog` registers its own unconditional window keydown per
   * dialog and does not `stopPropagation`, so two of these fire on one key:
   * `SessionBody` says "one Escape would close both, and every Tab would be
   * fought over by two traps" and draws a card inline rather than as an overlay
   * because of it, and `Gm` restructures its `sheet`/`tool` state for the same
   * reason. This listener was the first non-dialog member of that set.
   * Reproduced in Chrome at 1440x900: open the keypad on the HOPE face, open
   * the `Book of Ava` loadout card over it, press Escape once - the card closed
   * AND the keypad closed, so the player came back to a roll surface that had
   * silently reverted. `CardReader` mounts above `Play`, so this component and
   * its listener stay mounted underneath.
   *
   * The guard is the topmost check the rest of the app does not have: if
   * anything in the document is a `role="dialog"`, that surface owns the key
   * and this one does nothing. That is one query against a document that has at
   * most a handful of them, run only while the keypad is open. A `capture`
   * listener plus `stopPropagation` would be the other shape and it is worse -
   * it would make this the surface that wins over a dialog, which is exactly
   * backwards.
   */
  useEffect(() => {
    if (typing === null) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]') !== null) return;
      setTyping(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [typing]);
  /*
   * And the way back to where you were, when the keypad closes.
   *
   * `DieKeypad` takes focus on open because the tap that opens it unmounts the
   * button that had it. Closing does the same thing in reverse: the exit
   * button, or the key you pressed, is unmounted by its own click, and without
   * this focus falls to `<body>` again - so Escape worked and then fired the
   * keyboard into nothing, which is `useDialog`'s "back to the control that
   * opened it" left undone. `wasTyping` is a ref rather than state because it
   * exists only to be read once in the effect that follows the change, and it
   * starts null so a fresh mount focuses nothing.
   */
  const wasTyping = useRef<TypedKey | null>(null);
  useEffect(() => {
    if (typing !== null) {
      wasTyping.current = typing;
      return;
    }
    const which = wasTyping.current;
    if (which === null) return;
    wasTyping.current = null;
    /*
     * Two selectors, because there are two kinds of target and only one of
     * them is unmounted by opening its keypad. A `Die` is found by the
     * accessible name it has always had; an `ExtraSlot` carries `data-die`,
     * because its name holds the face it is showing and the word for the state
     * it is in, and neither of those is a stable prefix to match on.
     */
    const back = document.querySelector<HTMLButtonElement>(
      which === 'hope' || which === 'fear'
        ? `button[aria-label^="${which === 'hope' ? 'HOPE' : 'FEAR'} die"]`
        : `button[data-die="${which}"]`,
    );
    /*
     * AND SOMEWHERE TO GO WHEN THAT SLOT NO LONGER TAKES FOCUS. The face that
     * completes a roll resolves it, and an extra die's slot is `disabled` from
     * that instant - it is the record of a finished roll, not a way into one -
     * so the keyboard came back out of the keypad onto `<body>`, which is the
     * whole failure this effect exists for. The two faces are where the next
     * roll is typed, so the HOPE face takes it; with typing off there is no
     * face to take it and nothing here matches, which is the state that has no
     * keypad to come back from either.
     */
    if (back !== null && !back.disabled) {
      back.focus();
      return;
    }
    document.querySelector<HTMLElement>('button[aria-label^="HOPE die"]')?.focus();
  }, [typing]);
  const [armedDice, setArmedDice] = useState<string[]>([]);
  /*
   * Whether the modifier controls are showing, on a phone.
   *
   * Deliberately local, and deliberately not a `usePlaySection` remembered per
   * character the way the folds on the sheet are. Those record an arrangement
   * - which parts of your sheet you use - and survive the app being closed.
   * This is a drawer you open mid-turn to declare a Difficulty and shut again;
   * a version of it that came back open next session would be spending the
   * band decision 6 just took back.
   */
  const [modifiersOpen, setModifiersOpen] = useState(false);
  /*
   * The attack the damage row is answering, and which roll it came from.
   *
   * The snapshot is taken whole from the `DualityResult` that produced it and
   * never recomputed, because the critical the player saw is the critical that
   * has to pay. `rollId` exists so the row is keyed on the roll: the row keeps
   * a rolled total in its own state, and without a remount the next attack
   * would arrive under last turn's number - on a phone, where there is no log
   * on screen to contradict it.
   */
  const [attack, setAttack] = useState<ArmedAttack | null>(null);
  const [rollId, setRollId] = useState(0);

  const characterId = character?.id ?? null;
  const held = useHeldFor(characterId);
  const addDie = useHeldDice((s) => s.add);
  const discardDie = useHeldDice((s) => s.discard);

  /*
   * Swapping character mid-session must not carry someone else's declaration
   * into the next roll - nor someone else's roll onto this sheet.
   *
   * `App` renders `<Play />` unkeyed and `Play` renders this component unkeyed
   * inside it, so the header's character picker swaps `useActive()` underneath
   * a component that keeps all of the above in its own state. Nothing here is
   * remounted, so nothing is cleared unless it is cleared here.
   */
  useEffect(() => {
    // Not the Experiences: `Play` owns those now and clears them in the effect
    // that already clears the declaration and the spell modifier, on this same
    // key. Two effects clearing one list is two rules that can disagree.
    setArmedDice([]);
    // And nobody else's attack either: a damage offer left standing across a
    // character switch would be this sheet being offered that sheet's sword.
    setAttack(null);
    /*
     * The verdict is the other half of the same rule, and it is the visible
     * half. `result` is the whole readout - the outcome word, the two faces,
     * and the total in 30px at the right of the roll control, which is the
     * biggest number the roll surface prints. Left standing, the arriving
     * player looks at their own sheet and reads SUCCESS WITH FEAR and a 20 that
     * belongs to the person who handed them the phone, with nothing on the
     * screen saying whose it was. `manual` goes with it: with typed dice on the
     * two faces are the readout as well as the input, so leaving them would
     * both show the previous roll and let one edited face re-resolve against
     * the other one's stale number.
     *
     * The advantage, the reaction switch and the Difficulty deliberately stay.
     * They are not a claim about who rolled: they are what the *table* has
     * declared. What used to make that safe was a closed modifier row printing
     * them whether they were armed or not, and P5-5's decision 6 deleted that
     * row rather than go on spending a band on the word NONE. It is the ARMED
     * strip that carries them onto the arriving sheet now - drawn exactly when
     * there is something to name - and the docblock on `armedMods` is where
     * that is argued.
     */
    setRoll(null);
    setManual(BLANK);
    // And the keypad shuts with them. It is opened on a face, the face it was
    // opened on has just been cleared, and a keypad standing over an arriving
    // sheet is this component's oldest bug in its newest control.
    setTyping(null);
  }, [characterId]);

  /*
   * Whose Experiences this roll spends Hope on.
   *
   * The companion's when the companion is what is armed - "spend a Hope to add
   * an applicable Companion Experience to the roll" - and the character's
   * otherwise. Derived through the shared rule rather than restated, because
   * the row that draws the chips is in `Play` and this is what pays for them.
   */
  const experiences = experiencesFor(character, source);
  // Filtering the ids through the character and the tray rather than trusting
  // them: an Experience deleted in Build, or a die discarded from the tray,
  // must not keep paying out here.
  const armedList = useMemo(
    () => experiences.filter((e) => armedExperiences.includes(e.id)),
    [experiences, armedExperiences],
  );
  /*
   * The armed dice themselves and then their sizes, rather than the sizes
   * alone. `rollDuality` only ever needed the sizes, and that is all this used
   * to derive - but a typed roll has to put a face back on the die it was
   * typed for, and a `number[]` of sides has nothing to key that on. The tray
   * ids come from here.
   */
  const armedHeld = useMemo(
    () => held.filter((d) => armedDice.includes(d.id)),
    [held, armedDice],
  );
  const bonusDice = useMemo(() => armedHeld.map((d) => d.sides), [armedHeld]);
  const experienceBonus = armedList.reduce((sum, e) => sum + e.bonus, 0);
  /*
   * One Hope per Experience.
   *
   * SRD, Hope & Fear: "Utilize an Experience - When you Utilize an Experience
   * on a relevant roll, add its modifier to the result. You can spend multiple
   * Hope to utilize multiple Experiences." Nothing caps the count, so neither
   * does this; what caps it is the Hope on the sheet.
   */
  const hopeCost = armedList.length;
  const hopeAvailable = character?.hope.marked ?? 0;

  const modifier = useMemo(
    () => (character ? rollModifier(character, stats, trait) : { value: 0, label: '', trait: null }),
    [character, stats, trait],
  );

  /*
   * The trait in words, and the modifier in the sign the bar prints - declared
   * here rather than beside the boxes that draw them, because `resolve` needs
   * the label at the instant it freezes a total.
   */
  const modSign = `${modifier.value >= 0 ? '+' : '−'}${Math.abs(modifier.value)}`;
  const traitLabel =
    trait === 'spellcast'
      ? stats.spellcastTrait
        ? `SPELLCAST · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()}`
        : 'SPELLCAST'
      : TRAIT_LABELS[trait].toUpperCase();

  /*
   * A roll made of dice the player read off the table, in the engine's own
   * shape.
   *
   * Every field `rollDuality` honours is here, which is the whole of the fix:
   * the parameter used to be `{ hope, fear }`, so `input.fixed?.advantage` and
   * `input.fixed?.bonus?.[i]` fell through to `rng` on a roll the app had been
   * told it may not make. `bonus` is positional because the engine's is - it
   * maps over `bonusDice` by index - so the array is built from `armedHeld` in
   * that same order and nowhere else.
   *
   * AND THE DECLARATION IS A PARAMETER, NOT A CLOSURE, FOR THE ONE GESTURE THAT
   * CHANGES IT AND RESOLVES IN THE SAME BREATH. Dropping ADV, disarming a die
   * or discarding one can complete a roll - the die it was waiting for stops
   * being part of the roll - and at that instant `advantage` and `armedHeld`
   * still hold the declaration the player has just left. Resolving off them
   * would roll the die that was dropped. `decl` defaults to the closure, which
   * is what ROLL and a typed face both want, and the three events that move it
   * pass what they moved it to. See `redeclare`.
   */
  const resolve = useCallback(
    (
      fixed?: { hope: number; fear: number; advantage?: number; bonus: number[] },
      decl: { sign: 0 | 1 | -1; dice: readonly HeldDie[] } = {
        sign: advantage,
        dice: armedHeld,
      },
    ) => {
      const sides = decl.dice.map((d) => d.sides);
      const r = rollDuality({
        modifier: modifier.value,
        difficulty,
        advantage: decl.sign === 1,
        disadvantage: decl.sign === -1,
        reaction,
        experienceBonus,
        bonusDice: sides,
        ...(fixed ? { fixed } : {}),
      });
      /*
       * The roll's Hope and Stress consequences are proposed by applying them,
       * because they are unambiguous; the GM's Fear is theirs to track.
       *
       * IT RUNS BEFORE THE FREEZE NOW, AND THAT IS WHAT `hopeGained` COSTS. It
       * used to sit two hundred lines down, after the log line, which was fine
       * while the write was the end of the story. It is not: `Math.min` means
       * the Hope this roll GRANTS and the Hope it PAYS can differ by one, only
       * `c` knows which, and `Rolled` has to carry the answer - see its
       * docblock, and `FavorRow`, which trades that Hope back and would
       * otherwise take a point off a track this roll never moved. Reading `c`
       * inside the updater rather than the closure's `character` is the same
       * choice the body already made: `update` calls the mutator once,
       * synchronously, against the record it is about to write.
       */
      let hopeGained = 0;
      if (character) {
        update((c) => {
          // An Experience is declared before the roll, so its Hope comes out of
          // what you had - never out of the Hope this roll is about to pay.
          const paid = Math.max(0, c.hope.marked - hopeCost);
          let hope = paid;
          let stress = c.stress.marked;
          if (r.effects.hope > 0) hope = Math.min(c.hope.max, paid + r.effects.hope);
          if (r.effects.stress < 0) stress = Math.max(0, stress + r.effects.stress);
          hopeGained = hope - paid;
          return { ...c, hope: { ...c.hope, marked: hope }, stress: { ...c.stress, marked: stress } };
        });
      }

      // The trait goes into the total and is frozen with it: see `Rolled`.
      setRoll({ result: r, traitLabel, hopeGained });
      /*
       * AND THE KEYPAD SHUTS, WHICHEVER ONE IS OPEN.
       *
       * `ExtraSlot`'s `done` says a spent slot "is the record of it rather than
       * a way into it ... and it does not open: a keypad here would be an offer
       * to edit one die of a finished roll". The slot itself is `disabled` from
       * this instant, but the grid is drawn from `typing`, not from the slot -
       * so pressing ROLL with an extra keypad standing left exactly that offer
       * on the screen, over a row that had just frozen. Pressing a key in it
       * ran `setDie` over a resolved panel, which starts a new roll: the face
       * landed on a die no longer armed, no slot came back for it, and the
       * record of the roll that had just been made was wiped off the glass.
       *
       * It belongs here rather than at the ROLL button because `resolve` is
       * what makes the panel a record, and it has three call sites.
       */
      setTyping(null);
      /*
       * The whole roll on the glass, and not just the two faces - AND THE ROW
       * IT WAS MADE OF, FROZEN WITH THEM.
       *
       * The slots are the readout as well as the input, so a roll leaves what
       * every one of its dice showed standing beside its total: the rule
       * `DamageRow` states as "a row of dice a player has just read aloud is
       * never sitting beside a total that does not come from it". The freeze is
       * what makes that true rather than nearly true. `setArmedDice([])` is
       * three lines below, in this same body, so by the next render there is no
       * armed die left for a live row to be built from - a d6 whose 4 is in the
       * total had its slot unmounted at the instant the total appeared, and the
       * only way back to that 4 was to re-arm the die, which handed it to the
       * NEXT roll. `resolved` holds the row instead.
       *
       * And it is what says the panel is now a record. Every face here was
       * entered for THIS roll, by the player or by `rollDuality`; the next face
       * typed starts a new one from `BLANK`, so neither an app-rolled advantage
       * die nor a face from the roll before it can reach a later total.
       *
       * THE OTHER HALF OF THAT RULE IS `redeclare`'S - where anybody can type,
       * which is the qualification that half needs and did not have - because
       * this function only ever sets the pair - it never unsets it. `DamageRow`'s
       * rule is symmetrical: a row of dice is never sitting beside a total that
       * does not come from it, which forbids a stale ROW under a fresh total AND
       * a stale TOTAL beside a fresh row. Freezing the row buys the first. The
       * total is 46px here and 30px on the phone, the largest type on either
       * layout, and it stood over the next roll's faces until whatever reopens
       * the panel started clearing it too.
       */
      const faces = {
        advantage: r.advantageDie,
        bonus: Object.fromEntries(
          decl.dice.flatMap((d, i) => {
            const face = r.bonusDice[i];
            return face === undefined ? [] : [[d.id, face] as const];
          }),
        ),
      };
      setManual({
        hope: r.hope,
        fear: r.fear,
        ...faces,
        resolved: extraSlots(decl.sign, decl.dice, faces),
      });
      // Declared for this roll and this roll only.
      onArmedExperiencesChange([]);
      setArmedDice([]);

      /*
       * Carry the attack across to the damage roll, which is the link the SRD
       * rule is about and the one this app has never had. Every field is copied
       * off the result that produced it - `succeeded` whole, all three of its
       * values - so nothing downstream has to work out a verdict a second time.
       * A roll made with nothing declared clears it rather than leaving the
       * previous weapon's offer standing under a persuasion check.
       */
      setRollId((n) => n + 1);
      setAttack(
        source === null
          ? null
          : {
              source,
              critical: r.critical,
              succeeded: r.succeeded,
              outcome: r.outcome,
              reaction: r.reaction,
              proficiency: stats.proficiency,
            },
      );

      /*
       * EVERY ADDEND OF THE TOTAL, SIGNED, SO THE LINE THE TABLE CHECKS ADDS UP.
       *
       * This list is a sum with an `=` on the end of it, and a table that reads
       * the log at all reads it by doing that sum. So the standard it is held to
       * is not "does it mention the interesting dice" but "does it close".
       *
       * It did not. The advantage/disadvantage die was never in here, while
       * `rollDuality` puts `advantageDie * advantageSign` into the total - so a
       * typed 5/8 with +1 and an ADV 3 printed `5 / 8 +1 = 17` against named
       * addends summing to 14, and with a DIS 6 it printed `5 / 8 +1 = 8`,
       * wrong by 6 on its own face. That is worse than an omission, because the
       * omission is invisible and the arithmetic error is not.
       *
       * `signed` is here for the same reason and catches the second case: an
       * Experience may carry a negative modifier - `armSummary` signs it, so
       * the surface already admits they exist - and `+${bonus} exp` printed
       * `+-2 exp`. Every term now wears its own sign, in the engine's own order:
       * the pair, the trait modifier, the Experiences, the advantage die, then
       * each held die.
       */
      const signed = (n: number): string => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
      const parts = [`${r.hope} / ${r.fear}`, signed(modifier.value)];
      if (hopeCost > 0) parts.push(`${signed(r.experienceBonus)} exp (−${hopeCost} Hope)`);
      if (r.advantageDie !== null) {
        parts.push(
          `${signed(r.advantageDie * r.advantageSign)} (${r.advantageSign === 1 ? 'ADV' : 'DIS'} d6)`,
        );
      }
      // Each held die prints what it rolled, so a table checking the app
      // against its own dice can see every number that went into the total.
      r.bonusDice.forEach((value, i) => parts.push(`${signed(value)} (d${sides[i]})`));
      pushLog({
        kind: 'duality',
        label: OUTCOME_LABEL[r.outcome],
        detail: `${parts.join(' ')} = ${r.total}${difficulty === null ? '' : ` vs ${difficulty}`}`,
        outcome: r.outcome,
        total: r.total,
      });
    },
    [
      // The two the default `decl` is read from, and nothing else derived from
      // them: the sides the engine rolls and the row the faces are written back
      // onto both come off `decl.dice` inside the body now, so a caller that
      // passes its own declaration is not silently resolving against this one.
      advantage,
      armedHeld,
      character,
      difficulty,
      experienceBonus,
      hopeCost,
      modifier.value,
      // Frozen into `Rolled` at the instant the total is made, so a trait
      // changed afterwards relabels the next roll and not this one.
      traitLabel,
      // In the array for the reason the two below are: this is a prop now, and
      // a callback left out of it runs the first render's closure. `Play`
      // passes the `useState` setter itself, so the identity is stable and
      // naming it here costs nothing.
      onArmedExperiencesChange,
      pushLog,
      reaction,
      // Without these two the snapshot is taken from the first render's
      // closure: arm a weapon, roll, and the source is still null, so the
      // offer never appears and nothing anywhere says why. There is no eslint
      // in this repo to catch a stale dependency, so it is written down here.
      source,
      stats.proficiency,
      update,
    ],
  );

  /*
   * The dice this roll is made of that the player has to supply, and whether
   * they have supplied all of them.
   *
   * Null until the last one lands, and that is the refusal: with a die still
   * blank there is no honest total to present, so the roll does not resolve and
   * `stillToType` below says which die it is waiting for. The alternative was
   * to roll the blank one and mark the number as the app's, and that is worse
   * on the surface this is - a total read across a table is read as a total,
   * whatever a 10px label beside it says.
   *
   * The advantage die is only asked for when a sign is armed, because that is
   * the only time `rollDuality` rolls one: `advantageSign` cancels ADV against
   * DIS, and a die that is not in the total must not hold the roll up.
   *
   * THE SIGN AND THE DICE ARE ARGUMENTS FOR THE SAME REASON THEY ARE ARGUMENTS
   * TO `resolve`: the question "is this roll complete" is asked about a
   * declaration, and three of the four events that ask it are the events that
   * just changed one. Read off the closure they would be asked about the
   * declaration the player has left behind.
   */
  const typedRoll = (
    m: Manual,
    sign: 0 | 1 | -1,
    dice: readonly HeldDie[],
  ): { hope: number; fear: number; advantage?: number; bonus: number[] } | null => {
    if (m.hope === null || m.fear === null) return null;
    let advantageFace: number | undefined;
    if (sign !== 0) {
      if (m.advantage === null) return null;
      advantageFace = m.advantage;
    }
    const bonus: number[] = [];
    for (const d of dice) {
      const face = m.bonus[d.id];
      if (face === undefined) return null;
      bonus.push(face);
    }
    return { hope: m.hope, fear: m.fear, ...(advantageFace === undefined ? {} : { advantage: advantageFace }), bonus };
  };

  /*
   * THE ONE ROUTE FROM A CHANGE IN THE DECLARATION TO WHAT IS ON THE GLASS.
   *
   * Round 2 gave `Manual` a lifecycle - one roll's faces, plus `resolved`
   * saying which roll and whether it is over - and then taught it to three
   * different handlers, each of which knew a different amount about it. Three
   * events INVALIDATE a roll (`setDie` on a resolved panel, `toggleDie`,
   * `armAdvantage`) and only `setDie` ever asked whether the roll it left
   * behind is now COMPLETE. That asymmetry is a defect in both directions and
   * this function is both halves of it, so there is nowhere left to put one.
   *
   * COMPLETION. What a roll requires is `{ hope, fear, the advantage die if a
   * sign is armed, one face per armed die }` - so dropping ADV, disarming a die
   * or discarding one can complete a roll without a face being typed. Reproduced
   * before this landed: type HOPE 5 and FEAR 8 with ADV armed, then press `—`.
   * The roll is complete, and the panel showed TOTAL `—`, no log entry, and a
   * bar reading `PICK A TRAIT · TYPE YOUR DICE` at a player who had just typed
   * their dice - with no way forward but to retype one of them.
   *
   * INVALIDATION, AND IT IS ONLY INVALIDATION WHERE THERE IS SOMETHING TO
   * INVALIDATE. `resolve` clears nothing about `result`, so a panel that went
   * back to being open kept the previous roll's total standing in the largest
   * type on the screen - 46px in the cockpit, 30px on the phone - beside the
   * new roll's faces. Worst case, both switches on: the app rolls 26, you type
   * HOPE 5 and FEAR 8, and the glass reads 5, 8, ADV `not entered` and TOTAL
   * 26, a number containing none of the four figures on the panel, under the
   * words ROLLED WITH HOPE and its wash. `resolve`'s own docblock forbids that
   * in as many words - "a row of dice a player has just read aloud is never
   * sitting beside a total that does not come from it" - so the total goes when
   * the row does.
   *
   * THAT IS A RULE ABOUT A ROLL BEING ASSEMBLED, AND IT WAS APPLIED WHERE NO
   * ROLL IS EVER ASSEMBLED. `canType` is `manualDice`, which is OFF on a
   * default install - and with it off nothing on this surface types anything:
   * `manual` is written by `resolve` alone, no face is an input, `extraDice` is
   * empty and `stillToType` is null. There is no half-assembled roll for a
   * stale total to be inconsistent with. What arming ADV or a held die means
   * there is only "the NEXT roll will have this in it", which the bar already
   * says in as many words - it labels the declaration `NEXT:` for exactly this
   * state - and clearing the pair took the verdict, the outcome line, the two
   * raw faces and the total off the glass at the touch of a control that made
   * no roll. Driven at `{digitalDice:true, manualDice:false}`, phone: after
   * ROLL the bar reads `Rolled with Fear`, `9 / 10 · The GM gains a Fear · the
   * GM sets the Difficulty`, `20`; open MODS, tap ADV, and it reads `ROLL`,
   * `2d12 +1 · AGILITY`, `—`. On a phone that bar is the only record of the
   * roll anywhere on the screen: there is no log surface and, with typing off,
   * no face row either. So with typing off this function does nothing at all.
   *
   * WHAT IT BUYS IS ONE INVARIANT IN TWO CLAUSES, AND IT IS THE ONE THE ROLL
   * SURFACE IS READ BY.
   *
   * **`result` is non-null exactly when `manual.resolved` is** - in all four
   * preference combinations. Every writer of either is here, in `resolve`, or
   * in the `[characterId]` effect; `resolve` and the effect set them together,
   * and this function either clears both or touches neither.
   *
   * **WHICH EVENTS MAY MAKE THEM NULL DEPENDS ON `canType`, AND ON NOTHING
   * ELSE.** With typing ON (`manualDice`), every change to the declaration
   * reopens the roll and clears the pair, because the faces are inputs and the
   * next one typed starts a new roll. With typing OFF the panel is a RECORD and
   * only a new roll or a character switch clears it. The single-clause version
   * of this sentence is what hid the paragraph above: it is true of the two
   * configurations somebody types in, and it over-applies to the two nobody
   * types in.
   *
   * So a total on the glass always has the row that made it beside it, a row
   * with a die still outstanding never has a total beside it at all, and a
   * table that only reads this surface keeps its last roll until it makes
   * another one.
   *
   * The attack is deliberately NOT cleared with the verdict. It is damage the
   * roll earned and has not been rolled yet; starting to type the next Duality
   * roll is not a reason to take it away.
   */
  const redeclare = (next: Manual, sign: 0 | 1 | -1, dice: readonly HeldDie[]): void => {
    /*
     * Nothing on this surface can type a die, so nothing here is a roll being
     * assembled and there is nothing to invalidate: the declaration the caller
     * has already moved is the whole of what changed. Leaving `manual` alone as
     * well as `result` is what keeps the invariant above a biconditional in
     * this configuration rather than a pair that has come apart - and it is
     * what makes turning `manualDice` on mid-session show the frozen record of
     * the last roll rather than an empty live row beside its total.
     */
    if (!canType) return;
    setManual(next);
    setRoll(null);
    const typed = typedRoll(next, sign, dice);
    // `resolve` writes both of them back, after these two and in the same
    // batch, so the roll it makes is what the render ends on.
    if (typed !== null) resolve(typed, { sign, dice });
  };

  const setDie = (which: TypedKey) => (value: number) => {
    /*
     * A RESOLVED PANEL IS A RECORD, SO THE FIRST FACE TYPED AFTER ONE STARTS
     * OVER. This is the whole of the second-roll rule and it is one line.
     *
     * It used to add to whatever was standing, and that is the same gesture as
     * correcting a mistyped face - the app cannot tell them apart, and it was
     * being used as both. So the second roll of a session resolved against the
     * first one's advantage die the instant its HOPE landed, with `stillToType`
     * naming nothing, because nothing was outstanding: roll one had filled it
     * in. The same door let an app-rolled die into a typed total.
     *
     * The price is the correcting tap, and it is paid openly rather than
     * silently: everything the new roll wants is named on the bar, including
     * the faces that were showing a number a moment ago. `Manual`'s docblock is
     * where that trade is argued.
     */
    const base = manual.resolved === null ? manual : BLANK;
    const next: Manual =
      which === 'hope' || which === 'fear' || which === 'advantage'
        ? { ...base, [which]: value }
        : { ...base, bonus: { ...base.bonus, [which.slice('bonus:'.length)]: value } };
    // Committing a face shuts the keypad, which is what it always did - it is
    // just no longer the ONLY thing that shuts it. See `DieKeypad`.
    setTyping(null);
    // The declaration is untouched by typing a face, so this is the one caller
    // of `redeclare` that hands it the closure's own sign and dice.
    redeclare(next, advantage, armedHeld);
  };

  /*
   * Arming a die, and the face that goes with it.
   *
   * `setArmedDice` alone was the whole of this, and it left `manual.bonus`
   * keyed by a tray id that outlives every roll: disarm a d6 whose 4 you have
   * typed and re-arm it, and the slot came back reading 4 - for a die nobody
   * had rolled since. So a face lives exactly as long as the die it was typed
   * for stays armed, and touching the declaration of a roll that has already
   * resolved starts a new one rather than editing the record of the old.
   */
  const armDice = (ids: string[], dropped: string): void => {
    setArmedDice(ids);
    // `held` is this render's tray, which still holds a die being discarded -
    // so the new row is filtered out of it by the new id list rather than read
    // off a store that has not re-rendered yet.
    const base = manual.resolved === null ? manual : BLANK;
    const bonus = { ...base.bonus };
    delete bonus[dropped];
    redeclare(
      { ...base, bonus },
      advantage,
      held.filter((d) => ids.includes(d.id)),
    );
  };

  const toggleDie = (id: string): void => {
    armDice(armedDice.includes(id) ? armedDice.filter((x) => x !== id) : [...armedDice, id], id);
  };

  /*
   * And discarding an armed die is disarming it, plus the tray.
   *
   * Press-and-hold on a chip takes the die out of `held` entirely, and `held`
   * is one of the two lists `armedHeld` is derived from - so this changes what
   * the roll requires exactly as `toggleDie` does, silently and from a control
   * on the other side of the row. It goes through the same route: the face
   * leaves with the die, and if that die was the last one outstanding the roll
   * completes rather than being stranded.
   */
  const dropDie = (id: string): void => {
    if (characterId === null) return;
    discardDie(characterId, id);
    if (armedDice.includes(id)) armDice(armedDice.filter((x) => x !== id), id);
  };

  /*
   * The advantage sign, and the same rule for the one die it arms.
   *
   * ADV, DIS and neither are three different rolls - `advantageSign` cancels
   * ADV against DIS, and a d6 typed under one sign is not the d6 the other
   * wants - so changing it drops the face. Unlike the held dice this is NOT
   * cleared when a roll resolves, which is what made it the leak: the sign
   * stood, the slot stood, and roll two's HOPE resolved against roll one's
   * advantage die without ever asking for a new one.
   */
  const armAdvantage = (sign: 0 | 1 | -1): void => {
    if (sign === advantage) return;
    setAdvantage(sign);
    const base = manual.resolved === null ? manual : BLANK;
    redeclare({ ...base, advantage: null }, sign, armedHeld);
  };

  /*
   * What is armed, in words, on the ROLL bar - and the Experiences by name.
   *
   * This is the whole warrant for the Experiences being behind a fold at all.
   * `PlayPhone` argues the move on the sentence "whatever is armed is spelled
   * out in full on the ROLL bar itself - so a declaration is never behind a
   * tap even when the fold is", and the chips themselves are several hundred
   * pixels of document below ROLL. If this line is not on the bar, the fold
   * was not safe to make.
   *
   * The chips are compact by necessity and a long phrase runs to two lines on
   * them; this is the one place the full name is spelled out, at the moment it
   * matters, which is when you are about to spend a Hope on it. It costs no
   * height either way: it replaces the readout that would otherwise be there.
   */
  const armSummary = [
    ...armedList.map(
      (e) =>
        `${(e.name.trim() === '' ? 'Unnamed' : e.name).toUpperCase()} ${e.bonus >= 0 ? '+' : '−'}${String(Math.abs(e.bonus))}`,
    ),
    ...(hopeCost > 0 ? [`${hopeCost} HOPE`] : []),
    ...bonusDice.map((sides) => `+D${sides}`),
  ].join(' · ');

  /*
   * The dice this roll has beyond the pair, offered for typing - and only when
   * typing is what the switches turned on.
   *
   * `canType` is the gate here for the reason it is the gate on the faces: the
   * answer to "what may this surface offer" is `rollAffordance`'s and nothing
   * else's, and a fourth notion of what mode we are in is how the phone and the
   * cockpit came to disagree the first time. With typing off this list is
   * empty, no row is drawn, and the app rolls these dice the way it always did
   * - which is what a table with the roller on asked it to do.
   *
   * TWO SOURCES, AND WHICH ONE IS AUTHORITATIVE IS `manual.resolved`'S ANSWER.
   * While a roll is being assembled the live declaration is the roll, so the
   * row is built from it. Once one has resolved, the row it resolved with is
   * frozen in `manual.resolved` and that is what is drawn - because `resolve`
   * clears the declaration, so a live row would have nothing in it and the dice
   * behind the total would leave the screen at the moment the total arrived.
   * `extraSlots` builds both, so the two cannot drift apart.
   */
  const rolled = manual.resolved !== null;
  const extraDice: ExtraDie[] = !canType
    ? []
    : (manual.resolved ?? extraSlots(advantage, armedHeld, manual));

  /*
   * What the roll is still waiting for, in the one line both layouts print.
   *
   * This is the visible half of the refusal. Without it the typed roll simply
   * does not resolve when a die is blank, and a surface that does nothing when
   * you press it is the same silence the app was already being blamed for -
   * only quieter. It names every outstanding die, Hope and Fear included: it
   * used to be that typing one face and not the other left nothing on the
   * screen saying why no verdict had appeared either.
   *
   * It is drawn only once the player has typed SOMETHING. A fresh sheet with
   * two blank faces is not waiting for anything, it is idle, and the idle line
   * is the arithmetic of the next roll.
   */
  const untyped = [
    ...(canType && manual.hope === null ? ['HOPE'] : []),
    ...(canType && manual.fear === null ? ['FEAR'] : []),
    ...extraDice.filter((d) => d.value === null).map((d) => d.label),
  ];
  const started =
    canType &&
    (manual.hope !== null || manual.fear !== null || extraDice.some((d) => d.value !== null));
  const stillToType = started ? stillToTypeLine(untyped) : null;
  // The phone's second line normally carries the arithmetic of the next roll.
  // When there is nothing to roll with, the arithmetic is beside the point.
  const idleDetail = affordance.blocked ? affordance.prompt : `2d12 ${modSign} · ${traitLabel}`;

  /*
   * The declaration, labelled when there is a verdict standing beside it.
   *
   * Both roll surfaces put `armSummary` on the same line that reports the last
   * roll, and neither of them said which roll it belonged to. With a verdict
   * standing the bar reads `SUCCESS WITH HOPE ... RAN WITH THE WOLVES +2 ...
   * 18`, and an 18 with a +2 printed next to it is an 18 that counted the +2 -
   * this project's founding rule failing in the other direction, the app
   * claiming a modifier applied to a roll that was declared after it. The
   * Experiences are cleared *by* a roll, so the only way to reach this state is
   * to arm one for the next roll, which is exactly when the label is needed.
   *
   * One expression, read by both layouts, because a phone and a desktop
   * disagreeing about what the roll surface says would be its own bug - the
   * argument `rollAffordance` is already written on.
   */
  const declaration = result === null ? armSummary : `NEXT: ${armSummary}`;

  /*
   * The phone bar's second line, in every state - including with a verdict
   * standing.
   *
   * This used to be `result === null ? armSummary : the verdict detail`, and
   * that made `PlayPhone`'s sentence false the moment a roll had resolved.
   * Roll once, open the Experiences fold, arm one, shut the fold: the roll
   * surface read the previous verdict and nothing else. The next roll was
   * silently two points high and a Hope down, and the only statement left on
   * the screen was the shut fold's own header - which at 375x667 is below the
   * fold. The ARMED strip did not cover it either: that strip is a door into
   * the modifier row, and on a phone the Experiences are deliberately not in
   * the modifier row, so naming them on a control that opens it would be an
   * offer the tap cannot keep.
   *
   * WHAT GIVES WAY IS THE OUTCOME DETAIL, AND ONLY IT. The two raw dice stay:
   * with typed dice off this line is the only place on a phone they are
   * printed - there is no log surface here - and a table checking the app
   * against its own dice needs them. What the detail says instead is the
   * consequence, and the consequence has already been applied to the Hope and
   * Stress counters higher up the same column; the outcome itself is still in
   * 17px directly above. One tap disarms the Experience and it comes back.
   *
   * AND IT COSTS THE COLUMN NOTHING, WHICH IS THE POINT. This line already
   * exists in every state, so an armed Experience adds no height at all -
   * unlike an armed modifier, which draws the ARMED strip and is the +50 that
   * `the budget the pin came off for` lists as a state it cannot see. What it
   * can do is wrap, so: at 393px ROLL is 317 wide, less 28 of padding, less 12
   * of gap and about 33 for a two-digit total in 30px, leaves the text stack
   * 244px - measured, the line's own box is **245 wide at 393 and 227 at 375**.
   *
   * THIS LINE IS 12px NOW, AND THE ARITHMETIC MOVED WITH IT. It is the entire
   * statement of what the next roll will be and it was the smallest type on the
   * sheet, so the reflow raises it - `12px/15px` at the declaration below, the
   * size and the leading together, because `.t-meta` is `500 10px/1` and a size
   * raised without its leading clips its own ink. At 0.06em that is about 7.9px
   * a character, so **30 characters to a line** at 393px and 28 at 375px, where
   * 10px gave 36 and 34.
   *
   * The ordinary armed-and-resolved state, typed dice off, is what this
   * paragraph is written on and it is measured rather than constructed: driven
   * in Chrome at 393x852 - arm `Ran with the wolves`, shut the fold, roll - the
   * bar reads `11 / 2 · NEXT: RAN WITH THE WOLVES +2 · 1 HOPE`, 45 characters,
   * **two lines**, a 237.4x20 meta box at 10px. At 12px those two lines are 30,
   * so the content is **17 + 4 + 30 = 51px** where it was 41.
   *
   * WHICH IS WHY THE BUTTON BELOW DECLARES `minHeight: 56` AND NOT A HEIGHT.
   * 51 of content plus the 1px border top and bottom is 53, and 56 holds it
   * with 3 to spare; **44 would clip this line by 9px** inside the one control
   * on this screen a thumb aims at without looking, which is the failure this
   * whole file is written against. And a third line - two Experiences and a
   * held die, 63 characters, which was two lines at 10px - is 17 + 4 + 45 = 66,
   * so the bar grows to hold it instead of sawing it off. Measured after the
   * change: idle 56, armed-and-resolved 56, three lines 71.
   */
  /*
   * AND `stillToType` TAKES THIS LINE WHEN THERE IS A DIE OUTSTANDING, IN BOTH
   * BRANCHES - the phone's `rollLine` here and the cockpit strip's own `??`,
   * both pinned, because a green suite with this `??` deleted was how the phone
   * branch turned out to be unpinned.
   *
   * WHAT IT WINS OVER IS THE IDLE ARITHMETIC AND THE DECLARATION, AND THAT IS
   * THE WHOLE LIST. Both are statements about the roll being assembled - `2d12
   * +1 · AGILITY`, or `+D6 · RAN WITH THE WOLVES +2` - and while a die is
   * outstanding the thing the player has to act on is the die, not the sum it
   * will go into.
   *
   * IT CANNOT WIN OVER A STANDING VERDICT, BECAUSE THE TWO CANNOT BE ON THE BAR
   * TOGETHER. `stillToType` is drawn only where `started` is, which is only
   * where `canType` is - and that is the half of the four configurations in
   * which `redeclare` clears `result` and `manual.resolved` together. So a die
   * outstanding means `manual.resolved` is null means `result` is null, and the
   * `result !== null` branch below is unreachable from here. In the other half
   * nothing is ever outstanding, because nothing is ever typed. This paragraph used to argue the opposite and name the state it
   * won in: "arming a held die after a roll leaves a resolved verdict on the bar
   * and a blank d6 in the row above it". It never did. `toggleDie` blanks every
   * face over a resolved panel, so `started` is false in exactly that state and
   * `stillToType` is null; the verdict now goes with the faces. The state does
   * not exist, so neither does the argument, and `the roll after the roll` has a
   * case that drives every way back into an open roll and asserts it.
   *
   * WHAT IT COSTS, COUNTED OFF THE CONSTANTS RATHER THAN OFF ONE EXAMPLE. This
   * docblock used to call `STILL TO TYPE: HOPE · FEAR · ADV · +D6` - 38
   * characters - "the longest of these on a phone" and conclude that the line
   * costs the bar no height. The first half is an ordinary case, not the
   * longest: `untyped` names HOPE, FEAR and ONE LABEL PER ARMED DIE, and the
   * armed set is capped by `MAX_HELD`, not by two.
   *
   * The pool it is drawn from is arithmetic over three declared things -
   * `MAX_HELD` is 12 (`heldDice.ts`), the tray's sizes are `DIE_SIZES`, whose
   * widest label is the four characters of `+D12`, and `stillToTypeLine` joins
   * with ` · ` under a 15-character prefix. Fifteen items could be outstanding:
   * HOPE 4, FEAR 4, ADV 3, twelve at 4.
   *
   * AND FIFTEEN IS THE CASE THE CODE CANNOT REACH, WHICH IS THE FAILURE THIS
   * PARAGRAPH WAS WRITTEN TO REPLACE, COMMITTED AGAIN ONE VERSION LATER. It
   * counted the pool and called it the line, and the line has a fourth
   * constraint the pool does not: `started`. `stillToType` is `started ?
   * stillToTypeLine(untyped) : null`, and `started` is true only once a face
   * has been ENTERED - `manual.hope !== null || manual.fear !== null ||
   * extraDice.some((d) => d.value !== null)`. A fresh sheet is idle, not
   * waiting. So at least one of the fifteen is always filled, and a filled die
   * is not in `untyped`: the line names AT MOST FOURTEEN.
   *
   * Fourteen of those fifteen, choosing which to give up to lose the least: the
   * shortest, which is ADV at 3 - and it costs its separator with it, so 116
   * less 6. Fourteen items: HOPE 4, FEAR 4, twelve at 4 = 56, plus thirteen
   * separators at 3 = 39, plus the prefix = **110 characters**. Reachable, and
   * driven rather than derived: twelve d12 in the tray, ADV armed, all twelve
   * armed, type the advantage die - which is the one gesture that turns
   * `started` on without shortening the list by more than 6 - and the cockpit
   * strip draws exactly that string. Every other choice is shorter: giving up
   * HOPE or FEAR instead costs 7, and dropping the sign entirely costs the ADV
   * slot AND leaves a bonus die to be typed, at 103.
   * `rollAffordance.test.ts` builds the 110 from those same constants and
   * `the roll after the roll` drives the surface to it.
   *
   * At the 30 characters a line this docblock derives for 393px that is four
   * lines, and at the 28 for 375px it is four as well (110/28 = 3.93) - so the
   * content is 17 + 4 + 60 = 81 at both, and the bar is **83 tall at 393 and 83
   * at 375** against the 56 it declares. So it DOES cost height, and the cost is
   * paid by the same two properties the three-line case is paid by: `minHeight`
   * rather than `height`, so the bar grows to hold the line instead of sawing it
   * off, and a Play screen that scrolls. Nothing here is measured - jsdom lays
   * nothing out and the 30 and 28 come from the 245px and 227px boxes measured
   * in Chrome for the paragraph above, in the session it names.
   */
  const rollLine =
    stillToType ??
    (result === null
      ? armSummary === ''
        ? idleDetail
        : declaration
      : `${canType ? '' : `${result.hope} / ${result.fear} · `}${
          armSummary === '' ? outcomeDetail(result) : declaration
        }`);

  /*
   * Everything the modifier row is holding, in words.
   *
   * This is the price of not drawing the row, and it is not optional. The
   * advantage and the reaction switch are *not* cleared when a roll resolves -
   * only the Experiences and the held dice are - so a DIS armed three rolls
   * ago is still armed, and a modifier the player cannot see is exactly the
   * failure this project's rules are written against. Empty, this list is why
   * there is no row at all; non-empty, it is the row.
   */
  const armedMods = [
    reaction ? 'REACTION' : null,
    advantage === 1 ? 'ADV' : advantage === -1 ? 'DIS' : null,
    difficulty === null ? null : `DIFF ${String(difficulty)}`,
    ...bonusDice.map((sides) => `+D${String(sides)}`),
    trait === 'spellcast' ? 'SPELLCAST' : null,
  ].filter((x): x is string => x !== null);

  /*
   * One toggle, used by both surfaces that arm an Experience: the chips in the
   * cockpit's control row and the fold below ROLL on a phone. It reads the
   * current list off the prop rather than out of an updater callback, because
   * the list lives in `Play` now and this component only ever sees the value
   * it was rendered with.
   */
  const toggleExperience = (id: string): void => {
    onArmedExperiencesChange(
      armedExperiences.includes(id)
        ? armedExperiences.filter((x) => x !== id)
        : [...armedExperiences, id],
    );
  };

  /*
   * The keypad, or nothing - one element read by both layouts, for the reason
   * `control` is one element read by both layouts. The switches can be turned
   * off while it is open, and then it is nothing: `canType` is the gate on
   * every way in, so it has to be the gate on the way already taken.
   */
  const typingDie = canType ? typing : null;
  const typingFace = typingDie === 'hope' || typingDie === 'fear' ? typingDie : null;
  const keypad =
    typingFace === null ? null : (
      <DieKeypad
        label={typingFace === 'hope' ? 'HOPE' : 'FEAR'}
        color={typingFace === 'hope' ? 'var(--hope)' : 'var(--fear)'}
        /* Blank over a resolved panel, both of them: the key that lands here
           starts a new roll, so offering the last roll's HOPE as the selected
           key and its FEAR in the readback column would be the panel promising
           an arithmetic it is about to throw away. */
        value={rolled ? null : manual[typingFace]}
        onSet={setDie(typingFace)}
        onCancel={() => setTyping(null)}
        otherLabel={typingFace === 'hope' ? 'FEAR' : 'HOPE'}
        otherColor={typingFace === 'hope' ? 'var(--fear)' : 'var(--hope)'}
        otherValue={rolled ? null : manual[typingFace === 'hope' ? 'fear' : 'hope']}
      />
    );

  /*
   * The armed dice, as a row of slots with at most one grid open under it -
   * one element read by both layouts, for the reason `keypad` and `control`
   * are. A phone and a cockpit disagreeing about which dice a roll is made of
   * would be a worse version of the bug `rollAffordance` exists for.
   *
   * `flex: 'none'` on the wrapper is load-bearing on the cockpit: that panel's
   * one `flex: 1` child is the log, which is what makes the log the first thing
   * to give height up and the last thing the fold takes, and a second flexible
   * child would take that back out of it.
   */
  const openExtra = extraDice.find((d) => d.key === typingDie) ?? null;
  const extras =
    extraDice.length === 0 ? null : (
      <div className="stack" style={{ flex: 'none', gap: 6 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {extraDice.map((d) => (
            <ExtraSlot
              key={d.key}
              die={d}
              done={rolled}
              open={d.key === typingDie}
              onToggle={() => setTyping(d.key === typingDie ? null : d.key)}
            />
          ))}
        </div>
        {openExtra !== null && <ExtraKeypad die={openExtra} onSet={setDie(openExtra.key)} />}
      </div>
    );

  const control = (
    <ControlRow
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      advantage={advantage}
      setAdvantage={armAdvantage}
      onTraitChange={onTraitChange}
      trait={trait}
      stats={stats}
      reaction={reaction}
      setReaction={setReaction}
      experiences={experiences}
      inlineExperiences={layout !== 'phone'}
      armedExperiences={armedExperiences}
      toggleExperience={toggleExperience}
      hopeCost={hopeCost}
      hopeAvailable={hopeAvailable}
      held={held}
      armedDice={armedDice}
      toggleDie={toggleDie}
      addDie={(sides) => characterId !== null && addDie(characterId, sides)}
      discardDie={dropDie}
    />
  );

  if (layout === 'phone') {
    return (
      /*
       * `flex: none`, and it is load-bearing rather than tidy.
       *
       * The phone column is `display: flex; flex-direction: column; flex: 1;
       * min-height: 0; overflow-y: auto`. In that box a child keeps the default
       * `flex-shrink: 1`, so when the sheet is taller than the glass the
       * browser shrinks whatever *can* shrink before it lets anything scroll -
       * and every other section of this column declares `flex: none`, so this
       * one was the only thing it could take it out of. Rendered at 393x852
       * this surface measured 33px tall holding a 66px ROLL, which overflowed
       * onto the fold header below it: two 44px targets stacked on the same
       * band, and a column whose `scrollHeight` equalled its `clientHeight`, so
       * the sheet did not scroll at all - it crushed the one control the whole
       * unpinning was argued from. Every height `playSheet.test.tsx` sums is a
       * declared height, and this is the property that makes the declared
       * heights the drawn ones.
       */
      <div className="stack" style={{ flex: 'none', gap: 6 }}>
        {/*
         * The modifier row, which is not drawn when it has nothing to say.
         *
         * Giorgio asked twice for this row to be removed. P5-1 refused with an
         * argument that still holds - 38 adversaries and 9 environments call
         * for a reaction roll, the SRD makes you declare every modifier before
         * the dice, and an app you cannot roll with advantage in is wrong at
         * the table - and then shipped the wrong answer to it: a permanent
         * 44px band reading `▶ MODIFIERS … NONE`, which is the band Giorgio
         * wanted back, spent on announcing that nothing is happening.
         *
         * So neither answer. Nothing is drawn here at all while nothing is
         * armed; the controls are one tap away on MODS, at the right end of
         * the roll row, where they cost no height because MODS declares the
         * same 56px floor ROLL does and the row stretches both to whatever ROLL
         * draws. And the moment anything is armed - ADV, DIS, REACTION, a
         * Difficulty, a held die, SPELLCAST - this strip appears and names it,
         * because `advantage` and `reaction` are deliberately not cleared when
         * a roll resolves, so a DIS armed three rolls ago is still armed and a
         * modifier the player cannot see is this project's founding rule
         * failing on a number.
         *
         * Open, the row wraps rather than scrolling sideways: ten controls in
         * about 480px of content showed four of themselves at 393px, and a
         * chip you had armed could be off the side by the time you reached
         * ROLL. That is no longer a phone rule. The cockpit was the same
         * sentence with worse numbers - thirteen controls in 1058px of content
         * showing four and a half of themselves in 303 - so `ControlRow` wraps
         * everywhere now and the prop that used to make this the exception is
         * gone. Its docblock carries the arithmetic.
         */}
        {modifiersOpen && control}
        {!modifiersOpen && armedMods.length > 0 && (
          <button
            type="button"
            aria-expanded={false}
            aria-label={`Modifiers armed: ${armedMods.join(', ')} - open the modifier row`}
            onClick={() => setModifiersOpen(true)}
            className="row"
            style={{
              flex: 'none',
              minHeight: 'var(--tap)',
              width: '100%',
              gap: 8,
              borderRadius: 'var(--r3)',
              background: 'var(--raised)',
              padding: '0 10px',
              textAlign: 'left',
            }}
          >
            <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
              ARMED
            </span>
            <span
              className="t-meta"
              style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontWeight: 700 }}
            >
              {armedMods.join(' · ')}
            </span>
          </button>
        )}
        {/*
         * The armed dice, above the pair and below the strip that named them.
         *
         * It goes here rather than under the faces because the two faces and
         * ROLL are the band this file spends its argument on: they stay
         * adjacent and stay lowest, and the row that appears when you arm a d6
         * pushes the ARMED strip up instead of pushing ROLL down. It is also
         * the order the strip sets up - `ADV · +D6` in words, then the dice for
         * exactly those - and the order the SRD asks for, since everything on
         * this row was declared before the dice.
         *
         * It costs the column 50px when there is one die to type (44 and the
         * stack's 6px gap) and nothing at all otherwise, which is every roll
         * nobody armed anything for.
         */}
        {extras}
        {/*
         * The faces only take a row when they are inputs.
         *
         * Measured on a real phone, this pair held 62px of the best band on
         * the screen - directly above ROLL, directly under the thumb - to
         * display two em dashes, because with the digital roller on nothing
         * ever typed into them. What they carry that the verdict bar does not
         * is the two raw numbers, and those go into the bar's own second line
         * instead. When typing is switched on they come back full size, since
         * a table entering real dice needs a target rather than a readout.
         */}
        {canType && (
          <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
            {keypad ?? (
              <>
                <Die
                  label="HOPE"
                  color="var(--hope)"
                  value={manual.hope}
                  onEdit={() => setTyping('hope')}
                  size={26}
                  editable
                />
                <Die
                  label="FEAR"
                  color="var(--fear)"
                  value={manual.fear}
                  onEdit={() => setTyping('fear')}
                  size={26}
                  editable
                />
              </>
            )}
          </div>
        )}
        {/*
         * ROLL and the door to the modifiers, on one row.
         *
         * MODS is at the RIGHT end and that is not arbitrary: the bottom-right
         * is where an idle thumb rests, so the control a resting thumb fires
         * by accident has to be the harmless one. A stray tap on MODS opens a
         * row - visible, reversible, costs nothing. A stray tap on ROLL spends
         * Hope, writes a log line and produces a number the table will act on.
         * So the resting point gets the cheap control and the 317px body of
         * ROLL gets the deliberate reach.
         *
         * NEITHER OF THEM FIXES A HEIGHT ANY MORE, AND THAT IS THE REFLOW.
         * ROLL used to declare `height: 66` - a hard number, not content-driven
         * - around 31px of ink in the idle state: 17.5px of nothing above the
         * word and 17.5 below, the largest single block of dead space on the
         * phone sheet and the first thing the owner pointed at. It is
         * `minHeight: 56` now, which is the floor its own content sets:
         * `rollLine` is 12px/15px and the ordinary armed-and-resolved state is
         * two of those lines, so 17 + 4 + 30 + 2 = 53 of box in 56. Ten pixels
         * back, and not the twenty-two a 44px floor would have given, because
         * 44 clips that second line by 9 - see `rollLine`'s own note above,
         * where the state is measured rather than reasoned.
         *
         * `minHeight` and not `height` for both, so a three-line state grows
         * the bar instead of sawing the statement of the next roll in half.
         * MODS follows ROLL rather than leading it: the row is
         * `alignItems: 'stretch'`, so whatever ROLL draws, MODS draws, and the
         * 44px width is what keeps it a target.
         */}
        <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
          <button
            type="button"
            onClick={() => canRoll && resolve()}
            disabled={!canRoll}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 56,
              borderRadius: 'var(--r5)',
              background: verdictBackground(result),
              border: `1px solid ${result === null ? 'var(--line-soft)' : verdictColor(result)}`,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 12,
            }}
          >
            <span className="stack" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ font: '900 17px/1 var(--sans)', color: verdictColor(result) }}>
                {result === null ? idleLabel : OUTCOME_LABEL[result.outcome]}
              </span>
              <span
                className="t-meta"
                style={{
                  marginTop: 4,
                  // 12 and not `.t-meta`'s 10, with the leading declared beside
                  // it: this is the whole statement of what the next roll will
                  // be and it was the smallest type on the sheet. `.t-meta` is
                  // `500 10px/1`, so raising the size alone leaves a 12px glyph
                  // in a 10px line box and clips its own ink; `15px` is the
                  // leading that holds it, and it is what makes two lines 30
                  // rather than 20. Size and leading only - the family, the
                  // weight and the 0.06em tracking stay the class's.
                  fontSize: 12,
                  lineHeight: '15px',
                  color: verdictColor(result),
                  opacity: 0.75,
                }}
              >
                {rollLine}
              </span>
            </span>
            <span
              style={{
                font: '800 30px/1 var(--sans)',
                color: verdictColor(result),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {result?.total ?? '—'}
            </span>
          </button>
          <button
            type="button"
            aria-expanded={modifiersOpen}
            /* The name carries what is armed, because with the row shut there
               would otherwise be nothing a listening user could hear it from.
               It deliberately does not begin "Roll": `DamageRow`'s control is
               named "Roll 2d10+3 …" and a test looking for one would find the
               other. */
            aria-label={
              armedMods.length === 0
                ? 'Modifiers for this roll'
                : `Modifiers for this roll: ${armedMods.join(', ')}`
            }
            onClick={() => setModifiersOpen(!modifiersOpen)}
            className="stack"
            style={{
              flex: 'none',
              width: 44,
              minWidth: 44,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 'var(--r5)',
              background: armedMods.length > 0 ? 'var(--raised)' : 'transparent',
              border: `1px solid ${armedMods.length > 0 ? 'var(--line)' : 'var(--line-soft)'}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                background: armedMods.length > 0 ? 'var(--text)' : 'var(--muted)',
                clipPath: modifiersOpen
                  ? 'polygon(0 75%,100% 75%,50% 0)'
                  : 'polygon(0 25%,100% 25%,50% 100%)',
              }}
            />
            <span
              aria-hidden="true"
              className="t-meta"
              style={{ color: armedMods.length > 0 ? 'var(--text)' : 'var(--muted)' }}
            >
              MODS
            </span>
          </button>
        </div>
        {/*
         * The Hope this roll just paid, offered back as a Favor - below ROLL
         * for the reason the damage row is below ROLL, and above the damage row
         * for a reason of its own.
         *
         * Everything above ROLL in this stack is declared BEFORE the dice; both
         * of the rows here come after them, so both are below it. Between the
         * two, the damage row keeps the bottom edge: it is the number the table
         * is waiting on, and this is a bookkeeping choice that can be made at
         * any point before the next roll. It is also the one of the two that
         * SPENDS something - it moves a Hope off the track - and this file's
         * own rule is that the resting point of an idle thumb gets the harmless
         * control.
         *
         * Measured in Chrome at 393x852, driving a Warlock through the real
         * app: the row is 369x44 laid out 6px under a 317x56 ROLL, so it costs
         * the column 50; a statement measured 41 and costs 47; the record
         * measured 31 and costs 37. At 320x568 the control grows to 66 rather
         * than clipping its second sentence, which is what `minHeight` buys and
         * what `FavorRow`'s own ergonomics note carries the arithmetic for. It
         * costs nothing at all on every roll a Bard makes, on every roll with
         * Fear and on every reaction roll - see `favorOffer`, which is the gate,
         * and which was driven too: 25 rolls on a Bard, 13 of them with Hope
         * and one a critical, and the word FAVOR never reached the screen.
         */}
        <FavorRow
          /* `favor-` and not the bare `rollId` the damage row uses: these two
             are siblings in one children list, so an identical key on both is a
             duplicate key - React warns and reconciles them against each other,
             and the row measurably stopped keeping its own `taken` state. */
          key={`favor-${String(rollId)}`}
          result={result}
          hopeGained={roll?.hopeGained ?? 0}
          layout="phone"
        />
        {/*
         * Last, and therefore hard against the bottom edge of the glass.
         *
         * It gets the easiest point in the thumb arc, because when both rows
         * exist it is the one the table is waiting on; the Duality bar moves up
         * by 58px to make room and is still well inside it. It also must stay
         * below ROLL rather than above it, because everything above ROLL in
         * this stack is something you declare *before* the dice, and both this
         * and the Favor row above it come after them.
         */}
        <DamageRow key={rollId} attack={attack} affordance={affordance} layout="phone" />
      </div>
    );
  }

  /*
   * The cockpit's roll panel, which scrolls - and that is the fix, not a
   * concession.
   *
   * IT USED TO BE `overflow: 'hidden'`, AND THAT COST THE SCREEN ROLL.
   * Measured in Chrome at 1180x695 with the backup banner up and the last Hit
   * Point marked, this panel was 197 tall holding a scrollHeight of 277, and
   * ROLL's 54px box was laid out at y 677.9 against a panel bottom edge at y
   * 674: painted 0.0px. Both of those conditions are default states of a fresh
   * install rather than contrivances, and 695 is this repository's own stated
   * constraint - `Vitals` says "a 1440x695 laptop viewport is the real
   * constraint, not the 900px mock". The same clip took `DamageRow`'s
   * `IF IT HIT · 4d8+6` to 15 of its declared 44 at 1280x800.
   *
   * WHAT IT HOLDS NOW, TERM BY TERM. Every term is declared in this file or in
   * a stylesheet this file names, so the sum reads off the source; the version
   * of this table that argued for the scroll got two of them wrong and the
   * errors cancelled, which is why the terms carry their derivations now.
   *
   *   24    this panel's own `padding: 12`, top and bottom.
   *   155.3 the control row at five Experiences. NOT 44: `ControlRow` wraps,
   *         and its docblock packs the rows. 44 is the one-row height it had
   *         while it scrolled sideways and hid five of thirteen controls.
   *   76    the dice row. NOT `Die`'s `minHeight: 62`, which never binds on
   *         this layout: `Die` is drawn `size={46}` here, so its own content is
   *         10 of `t-meta` label + 46 of number + 18 of padding + 2 of border =
   *         76. The 62 binds on the phone, where `size={26}` makes it 56.
   *   38.9  the verdict strip idle: 20 of padding around a
   *         `clamp(16px,1.6vw,22px)/1` line, 18.88px at a 1180px window.
   *         Measured 38.9 at 1180 and 40.5 at 1280. After a roll the second
   *         span wraps and it measures 57.8 to 64 - content, not declaration.
   *   54    ROLL's own declared height, and it is `flex: none`.
   *   38    `RecentLog`'s floor - 15 of RECENT label and gap, plus one 23px
   *         entry. It was `minHeight: 0` and measured 0, which is why the log
   *         has a docblock of its own now.
   *   40    four 10px gaps.
   *
   * 426.2, against a scrollHeight of 426 measured idle at 1180x695. ROLL is
   * painted 54 of 54 in that state, because the two terms that come after it
   * are the two the panel can afford to put below the fold.
   *
   * AND NOTHING ABOVE COULD GIVE THE HEIGHT BACK, which is what made it a
   * reachability defect rather than an ugly one. Measured at 1180x695, `main`
   * and `.app` both have `scrollHeight === clientHeight`, and the middle grid
   * column is `overflowY: visible`, so there was no wheel, no drag and no tap
   * anywhere on the glass that reached ROLL. `roll.focus()` did: it sets this
   * element's `scrollTop` to 80 and brings the button back to y 597.9. Laid
   * out, invisible, still keyboard-reachable - P2-1's exact signature, on the
   * desktop, in the one control the screen exists for.
   *
   * `overflowY: 'auto'` AND NOT A SHORTER PANEL. The other three answers were
   * available and all of them are worse. Dropping the dice faces takes the two
   * raw numbers off the cockpit, where they are the readout and not an input.
   * Pinning ROLL to the bottom of the panel breaks this screen's standing rule
   * that nothing on Play is out of the flow, and would park a 54px button over
   * the log. Moving the scroll up to the middle grid column would take `Vitals`
   * with it, and the counters are the thing you have to be able to see *while*
   * you roll. Scrolling the panel itself is the reflow this project already
   * decided it prefers to a clip.
   *
   * `overflowX` STAYS `hidden`, ON PURPOSE. `overflow-x: visible` beside a
   * scrolling y-axis computes to `auto`, and the panel does have content that
   * can exceed 404px of inner width: ROLL's second line is `.t-num` (13px
   * mono) with no `min-width: 0`, so an Experience named as one unbroken word
   * of ~34 characters is about 280px that cannot wrap. That already overflowed
   * and was already clipped; making it a horizontal scrollbar instead would be
   * a new defect shipped inside a fix.
   *
   * AND IT SAYS SO, WHICH IS THE PART THAT WAS MISSING. This is the only
   * scroll on the cockpit's middle column - the modifier shelf above used to be
   * a second one, at `overflowX: 'auto'` with `scrollbarWidth: 'none'`, and it
   * wraps instead - so it is the one scroll a player has to notice, and for one
   * commit it was the only scroller in the app that carried none of the app's
   * scroll treatment. It was a bare inline `overflowY: 'auto'`: no `.scroll`,
   * so no coloured thumb, no `scrollbar-width: thin` and `overscroll-behavior:
   * auto`; and on macOS, which is the platform this repository is developed and
   * measured on, no bar is painted at rest at all. Measured with a Chrome
   * launched without `--hide-scrollbars`: this panel's gutter is offsetWidth
   * 428 less clientWidth 426, which is the border and nothing else. The
   * paragraph that used to sit here said the platform's bar "announces itself";
   * it announces itself after you have already scrolled.
   *
   * SO `.scroll` FOR THE TREATMENT AND `.scroll-fade` FOR THE EDGE.
   * `className="panel stack scroll"` buys the app's own thumb and
   * `overscroll-behavior: contain`, so a wheel that runs out here stops instead
   * of scrolling the page behind it. The inline `overflowY: 'auto'` stays
   * beside it rather than being left to the class: it is the declaration this
   * file's docblocks and `cockpitRoll.test.tsx`'s ancestor walk both read, and
   * a scroll that only exists in a stylesheet is a scroll that can be deleted
   * by a stylesheet. The fade is conditional on `useMoreBelow`, which is what
   * makes it honest - base.css's own docblock says "a hard edge reads as 'that
   * is all there is'", and an unconditional mask says the opposite lie at the
   * bottom of a panel that fits. Its one stated precondition is no
   * `position: fixed` descendant, because a mask clips its whole painted
   * subtree; there is none in this subtree - no `useDialog`, and no fixed
   * positioning in this file or in `DamageRoll.tsx`.
   *
   * ERGONOMICS. The cockpit is 1180px and up, so 393x852 and its thumb arc are
   * not the reference here - `PlayPhone` is what a phone gets. What does reach
   * this panel with a finger is a touchscreen laptop, AND IT DOES NOT GET 44px
   * CHIPS, WHICH AN EARLIER REVISION OF THIS PARAGRAPH SAID IT DID.
   * tokens.css:203-207 is `(max-width: 1179px), (pointer: coarse)`, and
   * `pointer` describes the primary pointer only: a touchscreen laptop answers
   * `pointer: fine` while a finger reaches the glass, which tokens.css:129-132
   * says in as many words and which is why `--pip-h` gets its own
   * `any-pointer: coarse` query. Measured with the rig's `hybrid` profile at
   * 1280x800 and 1440x900: `--control` 34px, `--pip-h` 44px. So on the machine
   * this paragraph is written about, every chip in the control row and every
   * key in the die keypad is 34 tall - 10px under this project's coarse floor -
   * while ROLL is 54 by its own declaration and the Experience chips are 44 by
   * theirs. That is a defect of `--control`'s query, it is written up in the
   * lane's doc-deltas file, and the reason tokens.css:122-127 gives for not
   * widening the query is that THIS PANEL is `overflow: hidden` and would crush
   * its own contents - which stopped being true four lines below this comment.
   * TARGET SIZE was never the charge for the scroll itself: 0px and 15px are
   * what a clip leaves, and no floor survives that - not this project's 44/34
   * and not WCAG's 24 either. READ VERSUS TOUCH is what the scroll has to keep,
   * and it does, because the order in this column is already right: what you
   * declare (the control row) is read first, what reports (the faces and the
   * verdict strip) sits above what you press, ROLL and the damage row come
   * after them, and `RecentLog` - the only thing here you merely read back -
   * comes last and is the one `flex: 1` child, so it is the first to give
   * height up and the last thing the fold takes. AN EARLIER REVISION OF THIS
   * PARAGRAPH SAID "the panel only scrolls once the log is at zero", AND THAT
   * WAS A FLOOR THE LOG DID NOT HAVE. It went to zero and its content went with
   * it: a zero-height child adds nothing to this panel's scrollHeight, and the
   * log's own box is `.scroll`, so its 69px of entries were not in this panel's
   * overflow to be scrolled to. `RecentLog` declares a 38px floor now and the
   * sentence is true as written. What a player scrolls to is therefore always
   * the bottom of the column - the thing they were about to press, and then the
   * one thing here they only read - never a readout they have to hunt back up
   * for.
   *
   * IT COSTS NO HEIGHT AND A RESERVED WIDTH. `overflowY: 'auto'` adds no layout
   * height. It does take width on any platform that draws a classic scrollbar
   * rather than an overlay one, and every width term in this file - the shelf's
   * 402, `DieKeypad`'s 45.75 key - derives from a content box that a bar
   * narrows. That is not visible from here: macOS uses overlay scrollbars, so
   * measured with a Chrome launched without `--hide-scrollbars` this panel's
   * whole gutter is offsetWidth 428 less clientWidth 426, the border and
   * nothing else, and the rig this lane measures on launches Chrome WITH
   * `--hide-scrollbars` (cdp.mjs), so no measurement in this pass could have
   * seen it either.
   *
   * SO THE GUTTER IS RESERVED RATHER THAN LEFT TO APPEAR. `scrollbarGutter:
   * 'stable'` reserves it whether or not the panel is currently overflowing,
   * which does two things. It makes the width one number per platform instead
   * of two: without it, opening the keypad - which always makes this panel
   * overflow - would narrow every key by about two pixels on Windows AT THE
   * MOMENT the keypad appears, and the twelve targets would move under a
   * pointer already travelling towards one. And it bounds the arithmetic: the
   * bar is 8px, not the platform's ~15, because `.scroll` declares
   * `scrollbar-width: thin` and an 8px `::-webkit-scrollbar`. Worst case is
   * therefore a 394px content box, which takes `DieKeypad`'s key from 45.75 to
   * 43.75 - a quarter-pixel under this project's 44px coarse floor in width and
   * 9.75 over its 34px fine one. On an overlay platform the gutter is 0 and
   * nothing changes.
   */
  return (
    <div
      ref={panelRef}
      className={`panel stack scroll${panelHasMore ? ' scroll-fade' : ''}`}
      style={{
        flex: 1,
        minHeight: 0,
        padding: 12,
        gap: 10,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarGutter: 'stable',
      }}
    >
      {control}

      {/* The armed dice, between what declared them and the pair they are added
          to - the phone's order, on the layout that has the room for it. It is
          drawn only when something is armed AND typing is on, so the panel's
          idle budget is the same five children and the same 426.2 it has always
          been; what it adds when it appears comes out of the panel's scroll,
          which is the term that exists to absorb exactly this. */}
      {extras}

      <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
        {/* The keypad takes the two faces' share of the row and leaves the
            trait box standing. An earlier version of this comment called that
            box "where the total is printed - the one number you want in front
            of you while you type the two that make it", and it prints
            `result?.total ?? '—'`: an em dash until both faces are in, which is
            every moment this keypad is open. What the box keeps is the trait
            you are rolling, which is worth keeping; the number already typed
            into the other die is carried by the keypad's own exit column. */}
        {keypad ?? (
          <>
            <Die label="HOPE" color="var(--hope)" value={manual.hope} onEdit={() => setTyping('hope')} size={46} editable={canType} />
            <Die label="FEAR" color="var(--fear)" value={manual.fear} onEdit={() => setTyping('fear')} size={46} editable={canType} />
          </>
        )}
        <div
          style={{
            width: 132,
            background: 'var(--app)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--r4)',
            padding: '9px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* The trait the total was made with, and not the one armed for the
              next roll: this box prints an addend's NAME directly above the
              46px total, so a live label here is the panel contradicting its
              own arithmetic. `Rolled` carries the freeze; `traitLabel` is what
              it says while there is no total to be wrong about. */}
          <span className="t-meta" style={{ letterSpacing: '0.14em' }}>
            {roll?.traitLabel ?? traitLabel}
          </span>
          <span
            style={{
              font: '800 46px/1 var(--sans)',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {result?.total ?? '—'}
          </span>
        </div>
      </div>

      <div
        className="spread"
        style={{
          borderRadius: 'var(--r3)',
          padding: '10px 14px',
          background: verdictBackground(result),
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            font: '900 clamp(16px,1.6vw,22px)/1 var(--sans)',
            color: verdictColor(result),
          }}
        >
          {result === null
            ? affordance.blocked
              ? affordance.label
              : 'READY'
            : OUTCOME_LABEL[result.outcome].toUpperCase()}
        </span>
        <span className="t-meta" style={{ color: verdictColor(result), opacity: 0.8 }}>
          {/* `stillToType` first here for the reason it is first on the phone
              bar: one instruction line on this screen, and whichever readout a
              layout has, it shows that one. The desktop strip keeping its own
              copy of the idle wording is the bug `rollAffordance`'s docblock
              records; keeping its own answer to "why has nothing resolved"
              would be the same bug on a newer state. */}
          {stillToType ??
            (armSummary !== ''
              ? declaration
              : result === null
                ? affordance.prompt
                : outcomeDetail(result).toUpperCase())}
        </span>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={() => canRoll && resolve()}
        disabled={!canRoll}
        style={{
          height: 54,
          flex: 'none',
          borderRadius: 'var(--r4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <span style={{ font: '900 19px/1 var(--sans)', letterSpacing: '0.06em' }}>
          {idleLabel}
        </span>
        <span className="t-num" style={{ color: 'var(--app)', opacity: 0.55 }}>
          2d12 {modSign}
          {armSummary === '' ? '' : ` · ${armSummary}`}
        </span>
      </button>

      {/*
       * Between ROLL and the log, and never after it.
       *
       * The reason used to be that `RecentLog` is this panel's only `flex: 1`
       * child, so a row placed here takes its height out of the log, which can
       * spare it - and that was only true while the log had height to give.
       * Measured in Chrome at 1180x695 with the backup banner up and the last
       * Hit Point marked, the log was 0px tall *before* this row was drawn, so
       * the 44 this row asks for came off the bottom of the column instead, and
       * at 1280x800 in the same state it took this row's own button to 15 of
       * 44. The log has a 38px floor now, so what this row takes comes out of
       * the log's *growth* first and out of the panel's scroll after that -
       * never out of the log's floor, which is the point of a floor.
       *
       * The placement is right for a reason that does not depend on any of
       * that: the things a player presses stay adjacent and stay last. ROLL,
       * the Favor offer and the damage offer are one scroll apart at worst
       * instead of one scroll apart with a readout in the gap - which is why
       * the Favor row goes between them rather than after the log. The two
       * post-roll rows are in the phone's order, and the argument for that
       * order is written over the phone's copy of them.
       *
       * The panel's idle budget above is untouched by it, which is why that
       * table still sums to 426.2 over the children it names: `FavorRow` is
       * `result === null` on an idle panel and draws nothing at all. What it
       * asks for once a roll has landed comes out of the same scroll the armed
       * dice come out of, which is the term that exists to absorb exactly this.
       */}
      <FavorRow
        // Prefixed for the reason the phone's copy is prefixed: one children
        // list, two rows, and a shared key is a duplicate key.
        key={`favor-${String(rollId)}`}
        result={result}
        hopeGained={roll?.hopeGained ?? 0}
        layout="desktop"
      />
      <DamageRow key={rollId} attack={attack} affordance={affordance} layout="desktop" />

      <RecentLog />
    </div>
  );
}

/**
 * One Experience, as a control you can hit.
 *
 * SRD, character creation: "An Experience is a word or phrase used to
 * encapsulate a specific set of skills, personality traits, or aptitudes your
 * character has acquired... When your PC makes a move, they can spend a Hope
 * to add a relevant Experience's modifier to an action or reaction roll."
 *
 * Whether an Experience is *relevant* is a table conversation, so every one is
 * offered on every roll and the app only counts the Hope.
 *
 * An unaffordable one is not greyed to 45% and left to be guessed at. That
 * measured 1.72:1, which reads as absent rather than as disabled, and it hid
 * the one fact the player needs - which is why it cannot be used. It says so
 * in place of its bonus instead.
 */
function ExperienceChip({
  experience,
  armed,
  affordable,
  onToggle,
  basis,
}: {
  experience: Experience;
  armed: boolean;
  affordable: boolean;
  onToggle: () => void;
  /** Flex basis when the chip is laid out in a row of equals. Unset hugs. */
  basis?: string;
}): React.JSX.Element {
  const sign = experience.bonus >= 0 ? '+' : '−';
  // A character always has two Experiences from creation; naming them is a
  // thing the SRD expects some players to leave for play. An unnamed one is
  // still armable and still costs a Hope, so it needs a word on it rather
  // than an empty chip.
  const name = experience.name.trim() === '' ? 'Unnamed' : experience.name;

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={armed}
      aria-label={`Utilize ${name}, ${sign}${Math.abs(experience.bonus)}, for one Hope${affordable ? '' : ' - not enough Hope'}`}
      aria-disabled={affordable ? undefined : true}
      disabled={!affordable}
      onClick={onToggle}
      title={affordable ? `${name} · spends 1 Hope` : `${name} · not enough Hope`}
      style={{
        flex: basis === undefined ? 'none' : `1 1 ${basis}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: basis === undefined ? 124 : undefined,
        minWidth: 0,
        minHeight: 'var(--tap)',
        paddingTop: 4,
        paddingBottom: 4,
        /*
         * Larger than `.chip`'s 9.5px, because this is not a shelf label being
         * scanned past: it is a phrase the player wrote, read across a table
         * in a dim room at the moment they decide to spend a Hope on it. The
         * row is 44px for the touch floor rather than for the text, so at one
         * or two lines the bigger type costs no height at all - 13.225px of
         * line-height twice over, plus 4 + 4 of padding, is 34.45 inside a 44.
         * At three it costs 3.7, and the clamp below argues why that is the
         * right trade.
         */
        font: '600 11.5px/1.15 var(--mono)',
        background: armed ? 'var(--hope-wash)' : 'var(--raised)',
        border: `1px solid ${armed ? 'var(--hope)' : 'transparent'}`,
        // The border and the filled pip carry the Hope; the name stays at full
        // text contrast, which amber on its own wash is not.
        color: armed ? 'var(--text)' : 'var(--muted)',
      }}
    >
      <HopePip on={armed} />
      {/*
       * Wrapping, not an ellipsis - and three lines, not two.
       *
       * "SILVER-TONGUED DIPLOMAT" truncated to "SILVER-TONG…" on a phone, and
       * the full name lived only in the title attribute and the accessible
       * name - neither of which a thumb can reach. An Experience is a phrase
       * the player wrote themselves; being unable to read it back on the one
       * screen that spends it is a poor trade for a tidier chip.
       *
       * TWO LINES WAS THE SAME DEFECT ONE STEP FURTHER ALONG. The clamp came in
       * with the docblock that claims the fix, and on both narrow surfaces it
       * went on hiding a whole line. `line-height: 1.15` on `11.5px` is
       * 13.225px, so two lines clip at 26.45 and three want 39.675 - the 14px
       * of hidden text the audit measured, in Chrome, twice: on the cockpit
       * chip at its 124px `maxWidth` (span 77.8 wide, clientHeight 26,
       * scrollHeight 40) for "SILVER-TONGUED DIPLOMAT", "Read every book in
       * the tower" and "Talked my way past a magistrate" alike, and on the
       * phone at 375x1000 for a character with five Experiences, where
       * `ExperienceRow` goes two across and the chip is 172.5 with a 126.3px
       * span. The crossing on the phone is exactly 381px of viewport.
       *
       * WHAT THREE COSTS: 5.7px, ONCE PER WRAPPED ROW THAT HOLDS ONE. 39.675 of
       * text, plus this chip's own 4 + 4 of padding, plus the 1 + 1 of the
       * border it declares two properties above - always 1px, `transparent`
       * when unarmed but laid out either way - is 49.675 against a
       * `minHeight: var(--tap)` of 44, with `box-sizing: border-box` set
       * globally by base.css. Measured 49.7 in Chrome on the cockpit chip at
       * its 124px `maxWidth`. So a chip that needs the third line goes 44 ->
       * 49.7 and one that does not is unchanged at 44 - two lines are 26.45 + 8
       * + 2 = 36.45, comfortably inside the floor. An earlier revision of this
       * paragraph left the border out and said 47.675 and +3.7.
       *
       * "ONCE" IS PER ROW AND NOT PER CHIP, because the shelf wraps: a flex
       * line is as tall as its tallest item, so one long name in a row of three
       * costs that row 5.7 and the other two chips ride along. Measured with
       * `wizard10`'s five Experiences, whose two long names land on separate
       * rows: the shelf is 155.3 where three rows of 44 and two 6px gaps would
       * be 144. Both surfaces can carry it - the phone column scrolls, and the
       * cockpit's roll panel scrolls too now.
       *
       * WHY NOT THE OTHER PROPOSAL, WHICH WAS TO WIDEN THE COCKPIT CHIP FROM
       * 124 TO 168. It loses on two counts and both are numbers. It does not
       * touch the phone, where the same declaration hides the same 14px on a
       * 172.5px chip - one line of code covers both surfaces and one of the two
       * fixes only covers one of them. And it costs the cockpit far more than
       * this does: the shelf is 402px wide, so at 168 it packs two chips to a
       * row where 124 packs three. Packed the way `ControlRow`'s docblock packs
       * them, five 168px chips take four rows - 44 + 44 + 44 + 34 and three 6px
       * gaps, 184 - against the measured 155.3 the 124px chips take. That is
       * +28.7 for the wider chip against +11.3 for the third line, on the same
       * shelf, for the same five names. Its stated premise, that the roll panel
       * is `overflow: hidden` and has no
       * spare height, was true when it was written and is no longer; the
       * arithmetic would have decided it either way.
       *
       * ERGONOMICS. TARGET SIZE moves the right way and only the right way:
       * 44 -> 49.7 on the chips that need the third line, above this project's
       * 44px coarse floor and its 34px fine one in both states, with the width
       * untouched at 172.5 on a two-across phone and at most 124 on the
       * cockpit - width was never the charge here. THUMB ARC is the question of
       * whether 5.7px moves a neighbour under a thumb that was aiming at this
       * chip, and it does not: `ExperienceRow` gaps its rows by 6, so a row
       * that grows by 5.7 still ends short of where the next row's targets
       * begin, and everything below simply shifts down inside a column that
       * scrolls. READ VERSUS TOUCH is the whole reason for the change. The
       * name is the entire content of this control - there is no other text to
       * an Experience - so a chip whose third line is clipped is a target you
       * are asked to press without being allowed to finish reading it, at the
       * exact moment you decide to spend a Hope on it.
       *
       * THREE AND NOT UNBOUNDED. The clamp is still a clamp, because the name
       * is text a player typed and nothing stops it being sixty characters -
       * six lines and an 87px chip on the primary roll surface. Three clears
       * every string in the audit's bisect, the longest of which is the 31
       * characters of "Talked my way past a magistrate", and past it the full
       * name is still spelled out on the ROLL bar the moment the chip is armed,
       * which is `armSummary`'s whole job.
       */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'left',
          // `.chip` sets `white-space: nowrap`, which cancels wrapping
          // outright - the line clamp below does nothing without this.
          whiteSpace: 'normal',
          lineHeight: 1.15,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 3,
        }}
      >
        {name.toUpperCase()}
      </span>
      <span style={{ flex: 'none', fontWeight: 700 }}>
        {affordable ? `${sign}${Math.abs(experience.bonus)}` : 'NO HOPE'}
      </span>
    </button>
  );
}

/**
 * Every Experience at once, wrapping, each one a full-height target.
 *
 * They used to live in the control row, which scrolled sideways, behind
 * REACTION and the advantage group - so on a 393px phone the second one was
 * already off screen, and the file's own comment admitted that a chip you had
 * armed could be out of sight by the time you reached ROLL. Declaring a
 * modifier you cannot see is not a declaration. (That row wraps now, on every
 * layout, and `ControlRow`'s docblock carries the cockpit numbers that forced
 * it. The Experiences still get a row of their own on a phone, because
 * `ControlRow` is behind MODS there and a declaration behind a tap is not a
 * declaration in front of you.)
 *
 * Two across is deliberate. It is the count a character starts with, it keeps
 * each chip wide enough for a real phrase rather than an ellipsis, and it puts
 * the whole set inside the thumb arc directly above ROLL - which is also the
 * order the rules ask for, since Experiences are declared before the dice.
 *
 * Exported because `Play` renders it too: Giorgio's fold order puts the
 * Experiences behind their own tendina under ROLL, and the ids it reads are
 * owned by `Play` for exactly that reason.
 */
export function ExperienceRow({
  experiences,
  armedExperiences,
  hopeAvailable,
  toggleExperience,
}: {
  experiences: Experience[];
  armedExperiences: string[];
  /** Hope on the sheet. What the armed chips will cost is worked out here. */
  hopeAvailable: number;
  toggleExperience: (id: string) => void;
}): React.JSX.Element | null {
  if (experiences.length === 0) return null;
  /*
   * The cost is derived here rather than taken as a prop, and that is the
   * difference between one number and two that can disagree. `DualityRoll`
   * works the same total out for `resolve`, off the same two lists; this
   * component's only caller is `Play`, several hundred pixels of document
   * away, and a `hopeCost` handed across that distance is a number waiting to
   * be computed from a stale list.
   *
   * One Hope per Experience. SRD, Hope & Fear: "You can spend multiple Hope to
   * utilize multiple Experiences." Nothing caps the count, so neither does
   * this; what caps it is the Hope on the sheet.
   */
  const hopeCost = experiences.filter((e) => armedExperiences.includes(e.id)).length;

  /*
   * How many to a row, and why it changes.
   *
   * An Experience is a phrase the player wrote themselves - "Silver-Tongued
   * Diplomat", "Ledgers and Ledger Lines" - and there is no other text to it:
   * the name *is* the Experience. So a chip that renders it as
   * "SILVER-TONG..." has thrown away the whole content of the thing, and the
   * full name lived only in a title attribute and an accessible name, neither
   * of which a thumb can reach.
   *
   * One to a row is therefore the default. Full width is about 350px, which
   * holds any phrase anyone actually writes, and up to three rows costs 144px
   * of a block that can afford it. Three is also not an arbitrary cutoff: the
   * SRD grants a new Experience at levels 2, 5 and 8 on top of the two from
   * creation, so a character carries two or three of them for the first four
   * levels and most tables never leave that range.
   *
   * From four it goes two across, because five full-width rows would be 244px
   * and would not fit a 375px phone at all. At two across a chip is 172.5px at
   * 375 and 175 at 380 - measured, and the docblock's old estimate of "about
   * 175px" was right - which leaves the label span 126.3 and takes it to
   * roughly 16 characters a line. That is short of the longest names, so the
   * label wraps rather than truncating; it wraps to THREE lines and not two,
   * because at two this row hid a whole 14px line of every name past about 33
   * characters, and the crossing was measured at exactly 381px of viewport.
   * Past three the ROLL bar is what spells out in full whatever is armed.
   */
  const perRow = experiences.length > 3 ? 2 : 1;
  const basis = `calc(${(100 / perRow).toFixed(3)}% - ${String((6 * (perRow - 1)) / perRow)}px)`;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {experiences.map((experience) => (
        <ExperienceChip
          key={experience.id}
          experience={experience}
          basis={basis}
          armed={armedExperiences.includes(experience.id)}
          affordable={armedExperiences.includes(experience.id) || hopeCost < hopeAvailable}
          onToggle={() => toggleExperience(experience.id)}
        />
      ))}
    </div>
  );
}

interface ControlProps {
  difficulty: number | null;
  setDifficulty: (n: number | null) => void;
  advantage: 0 | 1 | -1;
  setAdvantage: (a: 0 | 1 | -1) => void;
  trait: RollTrait;
  onTraitChange: (t: RollTrait) => void;
  stats: DerivedStats;
  reaction: boolean;
  setReaction: (v: boolean) => void;
  experiences: Experience[];
  /** False when the layout gives the Experiences a row of their own. */
  inlineExperiences: boolean;
  armedExperiences: string[];
  toggleExperience: (id: string) => void;
  /** Hope the armed Experiences will cost, and Hope there is to pay with. */
  hopeCost: number;
  hopeAvailable: number;
  held: HeldDie[];
  armedDice: string[];
  toggleDie: (id: string) => void;
  addDie: (sides: (typeof DIE_SIZES)[number]) => void;
  discardDie: (id: string) => void;
}

const HOLD_MS = 480;

/** The Hope pip, in the same silhouette the Hope track uses. */
function HopePip({ on }: { on: boolean }): React.JSX.Element {
  return (
    <span
      style={{
        flex: 'none',
        width: 7,
        height: 7,
        clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
        background: on ? 'var(--hope)' : 'var(--empty)',
      }}
    />
  );
}

/**
 * A die in the tray. Tap arms it for the next roll, press and hold discards it
 * - the gesture the tracks already use for "clear this".
 *
 * Rolling does not discard it. Whether a die is spent by being used is feature
 * text: a Rally Die is gone, an Unstoppable Die stays for as long as you are
 * Unstoppable, and the app has no business guessing which one this is.
 */
function HeldDieChip({
  die,
  armed,
  onToggle,
  onDiscard,
}: {
  die: HeldDie;
  armed: boolean;
  onToggle: () => void;
  onDiscard: () => void;
}): React.JSX.Element {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discarded = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={armed}
      aria-label={`d${die.sides} held die - tap to add it to the next roll, hold to discard it`}
      title="Tap to add it to the next roll · hold to discard"
      onPointerDown={() => {
        discarded.current = false;
        timer.current = setTimeout(() => {
          discarded.current = true;
          onDiscard();
          navigator.vibrate?.(12);
        }, HOLD_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => {
        if (!discarded.current) onToggle();
      }}
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        minWidth: 'var(--control)',
        background: armed ? 'var(--text)' : 'var(--raised)',
        color: armed ? 'var(--app)' : 'var(--muted)',
        fontWeight: armed ? 700 : 600,
      }}
    >
      {armed ? '+' : ''}d{die.sides}
    </button>
  );
}

/**
 * Everything you declare before you roll. It wraps. It does not scroll.
 *
 * IT USED TO SCROLL SIDEWAYS ON THE COCKPIT, AND THAT HID FIVE OF THIRTEEN
 * CONTROLS. The row was `overflowX: 'auto'` with `scrollbarWidth: 'none'`, so
 * nothing on the glass said it scrolled and a mouse had no bar to drag. The
 * shelf's width reconstructs from the source: the middle grid track is capped
 * at `minmax(360px, 428px)` in `PlayDesktop`, less the roll panel's own 2 of
 * border and 24 of padding is 402 - measured 402, and the 404 this docblock
 * used to say was that arithmetic with the border left out - less the 93px
 * `Duality Roll` title this row used to draw when `!narrow` and less
 * `.spread`'s gap left 302.8. On a platform that draws a classic scrollbar
 * rather than an overlay one the panel reserves 8px of that 402 for the bar -
 * `scrollbar-gutter: stable` beside `.scroll`'s `scrollbar-width: thin` - so
 * the shelf is 394 there and every packing below shifts by one chip's slack.
 * macOS draws overlay bars and the rig hides them, so 402 is what is measured.
 * What it holds
 * reconstructs too, at the five Experiences an SRD character carries from
 * level 8: REACTION 62.2, DIS/—/ADV at 34 each, five chips at their 124px
 * `maxWidth`, `+ DIE` 45.4, DIFF 88.4, SPELLCAST 68.4, and twelve 6px gaps -
 * 1058.4, against 1058 measured in Chrome. It is byte-identical at 1180,
 * 1280, 1440 and 2560, because the track never widens: a bigger monitor
 * bought nothing at all.
 *
 * Painted, per control, against that 303: REACTION 62.2 of 62.2, the three
 * advantage chips whole, the first Experience 108.8 of 124, and then zero.
 * Four Experience chips, `+ DIE`, DIFF and SPELLCAST all painted 0.0px.
 * SPELLCAST is at least named elsewhere - the trait box beside the dice reads
 * `SPELLCAST · KNOWLEDGE` - but DIFF is named nowhere else before a roll:
 * `armedMods` is rendered only in the phone branch. On the cockpit the
 * difficulty control was not small, it was absent.
 *
 * SO THE SAME ANSWER THE PHONE ALREADY HAD. This file's own comment above the
 * phone's `{modifiersOpen && control}` argued it in as many words - "ten
 * controls in about 480px of content showed four of themselves at 393px, and a
 * chip you had armed could be off the side by the time you reached ROLL" - and
 * the cockpit is the same sentence with worse numbers: thirteen controls in
 * 1058px of content showing four and a half of themselves in 303. Declaring a
 * modifier you cannot see is not a declaration, and the SRD requires the
 * declaration before the dice.
 *
 * AND THE TITLE WENT, BECAUSE THE WRAP COST HAD TO COME DOWN. `Duality Roll`
 * was 93 of the 402 the panel has, a quarter of the shelf, and its own comment
 * called it "a desktop luxury" while arguing that REACTION carries the state it
 * named - which it does: REACTION is the first control on the row, it is
 * `aria-pressed`, and it turns `--fear` when a reaction roll is armed. An
 * earlier revision of this docblock wrote that down as "one thing not done".
 * It is done, it is worth 74.4px of shelf, and the reason it stopped being a
 * matter of taste is in the measurements below.
 *
 * WHAT IT COSTS, MEASURED AND NOT ESTIMATED. Flex wrap packs greedily into 402
 * with a 6px gap, and `ExperienceChip` is the only thing here that is not
 * `var(--control)` tall: it is `minHeight: var(--tap)`, and 44 becomes 49.7
 * when a name takes the third line the clamp now allows (1 of border + 4 + 3 *
 * 13.225 + 4, `box-sizing: border-box`).
 *
 *   Two Experiences, the `played` fixture at level 3. Row 1 is REACTION +
 *   DIS/—/ADV + the first chip (312.2 of 402); row 2 is the second chip, `+
 *   DIE`, DIFF and SPELLCAST (319.5). Both names fit two lines, so 44 + 6 + 44
 *   = **94**, against the 44 of the single row it replaces: **+50**.
 *
 *   Five Experiences, `wizard10`, which is what an SRD character carries from
 *   level 8. Row 1 REACTION + DIS/—/ADV + one chip (312.2), row 2 three chips
 *   (384), row 3 the last chip + `+ DIE` + DIFF + SPELLCAST (344.2). Rows 1 and
 *   2 each hold one of the two long names, so 49.7 + 49.7 + 44 + two 6px row
 *   gaps = 155.4. Measured 155.3. **+111.3**.
 *
 * At the 302.8 the title left, the same five Experiences packed into five rows
 * and measured 229.7 - +185.7, not the +180 an earlier revision derived, and
 * the difference is exactly the third line the chip commit added. That was
 * enough to push ROLL below the panel's fold at 1280x800, which is the reason
 * the title is gone rather than deferred.
 *
 * WHERE ROLL IS NOW, at five Experiences, `wizard10`, campaign on, measured in
 * Chrome. With the backup banner up - a default state of a fresh install, and
 * the state this file's other docblocks measure in: 1280x800 panel 418 client /
 * 418 scroll, ROLL painted 54 of 54; 1366x768 386/413, painted 49; 1180x695
 * 313/407, painted 0 and one scroll away. With the banner dismissed: 1280x800
 * 474/474 painted 54, 1366x768 442/442 painted 54, 1440x900 574/574 painted 54,
 * 1180x695 369/407 painted 37.9. Before the wrap and before the title went, the
 * same five Experiences took ROLL to 29.9 of 54 at 1280x800; before the panel
 * was allowed to scroll at all it was 0.0 of 54 at 1180x695 with no wheel, drag
 * or tap that reached it. A 695px-tall window with a banner on it is still a
 * scroll, and that is what the fade and the bar on the panel are for.
 *
 * ERGONOMICS. TARGET SIZE, and the pointer facts an earlier revision of this
 * paragraph got wrong. tokens.css:203-207 is `(max-width: 1179px), (pointer:
 * coarse)`, and `pointer` describes the *primary* pointer - so on the cockpit,
 * which is 1180 and up, `--control` is 34 for a mouse AND for the touchscreen
 * laptop this paragraph used to claim got 44. Measured with the rig's `hybrid`
 * profile (`pointer: fine` with `any-pointer: coarse`) at 1280x800 and
 * 1440x900: `--control` 34px, `--pip-h` 44px. tokens.css:129-132 says so in as
 * many words. So the shelf is REACTION 62.2x34, DIS/—/ADV 34x34, `+ DIE`
 * 45.4x34, DIFF 88.4x34, SPELLCAST 68.4x34, and the Experience chips 124x44 or
 * 124x49.7 - clear of this project's 34px fine floor and, for the chips, of its
 * 44px coarse one, but 10px under that coarse floor for a finger on a
 * touchscreen laptop. That is a live defect of `--control`'s query and not of
 * this row; it is written up in the lane's doc-deltas file, and the reason
 * tokens.css:122-127 gives for not widening the query - that this panel is
 * `overflow: hidden` and would crush its own contents - died when the panel was
 * allowed to scroll.
 *
 * THUMB ARC does not apply on its own terms here and the honest substitute is
 * reach: this row is at the top of the middle column, the far end of a reach
 * across a keyboard, and it is the only thing on this screen you touch *before*
 * the dice - so paying for it in reach and getting ROLL, which you touch every
 * turn, at the near end is the right way round. READ VERSUS TOUCH is what the
 * extra rows buy. This row is the declaration: everything in it is read before
 * it is touched and touched before ROLL is, and wrapping takes it from eight of
 * thirteen controls painted to thirteen. A declaration you cannot see is not a
 * declaration, and the SRD requires it before the dice.
 */
function ControlRow({
  difficulty,
  setDifficulty,
  advantage,
  setAdvantage,
  stats,
  trait,
  onTraitChange,
  reaction,
  setReaction,
  experiences,
  inlineExperiences,
  armedExperiences,
  toggleExperience,
  hopeCost,
  hopeAvailable,
  held,
  armedDice,
  toggleDie,
  addDie,
  discardDie,
}: ControlProps): React.JSX.Element {
  const [picking, setPicking] = useState(false);

  // The picker takes over the whole row, the way `DieKeypad` takes over the
  // whole face row to be typed into - both for the same reason, which is that
  // a control with eight or twelve targets in it needs the width. A popover
  // would either be clipped by the panel or open off the side of a row this
  // narrow.
  if (picking) {
    return (
      <div className="row" style={{ gap: 4 }}>
        <span className="t-label" style={{ flex: 'none' }}>
          Hold a die
        </span>
        {DIE_SIZES.map((sides) => (
          <button
            key={sides}
            type="button"
            className="chip"
            onClick={() => {
              addDie(sides);
              setPicking(false);
            }}
            style={{
              flex: '1 0 auto',
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
              background: 'var(--raised)',
              color: 'var(--text)',
            }}
          >
            d{sides}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-label="Cancel"
          onClick={() => setPicking(false)}
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            color: 'var(--muted)',
            background: 'transparent',
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    /*
      `flexWrap: 'wrap'` unconditionally, and no overflow of any kind.
      This used to be `wrap ? … : …` on a prop the phone passed true and the
      cockpit passed false, and the false branch was `overflowX: 'auto'` with
      `scrollbarWidth: 'none'` - a 303px shelf holding 1058px that announced
      nothing and gave a mouse no bar. The ternaries are gone rather than
      pinned to `true`, because a dead branch that says "this can scroll
      sideways" is the same defect as a docblock that says it. `overflowY`
      went with them: `overflow-y: hidden` beside an `overflow-x: visible`
      computes the x axis back to `auto`, so the phone's wrapped row has
      quietly been a horizontal scroll container this whole time.

      THIS ROW IS THE WHOLE COMPONENT NOW. It used to be the second child of a
      `.spread`, beside a `Duality Roll` title drawn when `!narrow` - that is,
      on the cockpit only, which is the one surface that could not afford it.
      The title and its wrapper went together: a flex container with a single
      `flex: 1` child is that child with extra steps.
    */
    <div className="row" style={{ minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
      {/* A reaction roll resolves the same way and pays nothing: no Hope, no
          Fear, and no cleared Stress on a critical. 38 adversaries and 9
          environments call for one, so this is a switch, not a footnote, and
          it leads the row because on a phone it is also the only thing
          saying which kind of roll this is. It still takes Experiences - the
          SRD spends Hope on "an action or reaction roll" - and what it
          refuses is an ally's Help. */}
      <button
        type="button"
        onClick={() => setReaction(!reaction)}
        aria-pressed={reaction}
        className="chip"
        title="A reaction roll grants no Hope and no Fear, and no ally can Help"
        style={{
          flex: 'none',
          minHeight: 'var(--control)',
          background: reaction ? 'var(--fear)' : 'var(--raised)',
          color: reaction ? 'var(--app)' : 'var(--muted)',
        }}
      >
        REACTION
      </button>

      {/* Advantage next, because at 393px only the first few controls are on
          screen and this is the one every roll touches. */}
      {([-1, 0, 1] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => setAdvantage(a)}
          className="chip"
          aria-pressed={advantage === a}
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: advantage === a ? 'var(--raised)' : 'transparent',
            border: `1px solid ${advantage === a ? 'var(--line)' : 'transparent'}`,
            color: a === 1 ? 'var(--ok)' : a === -1 ? 'var(--damage)' : 'var(--muted)',
          }}
        >
          {a === 1 ? 'ADV' : a === -1 ? 'DIS' : '—'}
        </button>
      ))}

      {inlineExperiences &&
        experiences.map((experience) => (
          <ExperienceChip
            key={experience.id}
            experience={experience}
            armed={armedExperiences.includes(experience.id)}
            affordable={armedExperiences.includes(experience.id) || hopeCost < hopeAvailable}
            onToggle={() => toggleExperience(experience.id)}
          />
        ))}

      {held.map((die) => (
        <HeldDieChip
          key={die.id}
          die={die}
          armed={armedDice.includes(die.id)}
          onToggle={() => toggleDie(die.id)}
          onDiscard={() => discardDie(die.id)}
        />
      ))}
      <button
        type="button"
        className="chip"
        onClick={() => setPicking(true)}
        disabled={held.length >= MAX_HELD}
        aria-label="Hold a die for later rolls"
        title="A Rally, Prayer or Slayer Die, or the d6 from Help an Ally"
        style={{
          flex: 'none',
          minHeight: 'var(--control)',
          minWidth: 'var(--control)',
          background: 'transparent',
          border: '1px dashed var(--line)',
          color: 'var(--muted)',
          opacity: held.length >= MAX_HELD ? 0.4 : 1,
        }}
      >
        + DIE
      </button>

      <label className="row" style={{ flex: 'none', gap: 4 }}>
        <span className="t-meta">DIFF</span>
        <input
          type="number"
          inputMode="numeric"
          value={difficulty ?? ''}
          placeholder="—"
          onChange={(e) => setDifficulty(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            width: 58,
            minHeight: 'var(--control)',
            padding: '4px 6px',
            textAlign: 'center',
            font: '600 13px/1 var(--mono)',
          }}
        />
      </label>

      {stats.spellcastTrait !== null && (
        <button
          type="button"
          onClick={() => onTraitChange(trait === 'spellcast' ? stats.spellcastTrait! : 'spellcast')}
          className="chip"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            background: trait === 'spellcast' ? 'var(--hope)' : 'var(--raised)',
            color: trait === 'spellcast' ? 'var(--app)' : 'var(--muted)',
          }}
        >
          SPELLCAST
        </button>
      )}
    </div>
  );
}

/**
 * What you rolled, on the cockpit only - this is the app's one log surface.
 *
 * IT HAD NO FLOOR, AND THAT COST IT EVERYTHING. This is the roll panel's only
 * `flex: 1` child, so it absorbs whatever the panel is short of, and with
 * `minHeight: 0` "whatever" had no bottom: measured in Chrome with `wizard10`
 * and three rolls made, this box was 0 tall at 1180x695, 1280x800 and 1366x768
 * alike, and its three 23px entries were painted 0.0px each.
 *
 * MAKING THE PANEL SCROLL DID NOT SAVE IT, which is the part worth writing
 * down. A zero-height child contributes nothing to its parent's scrollHeight,
 * and this box's own content lives behind `.scroll` - `overflow-y: auto` - so
 * it does not join the panel's overflow either: the panel's scrollHeight was
 * 485 against 418 of client with a 69px log that was in neither number. Laid
 * out, invisible, and not reachable by any scroll on the screen. That is P2-1's
 * signature, in a control that had been fully painted the week before.
 *
 * SO A FLOOR, AND IT IS 38. `minHeight: 0` becomes 38 = the 15 the RECENT label
 * and its 5px gap measure, plus one 23px entry. Two things follow. The panel's
 * scrollHeight grows by 38, so the log is *in* the panel's overflow and one
 * scroll reaches it, instead of being squeezed out of the sum entirely. And 38
 * is a floor rather than a size: `flex: 1` still grows this box into whatever
 * the panel has spare, which measured 63.7 at 1280x800, 125 with the two
 * Experiences of the `played` fixture, and 160.7 at 1440x900.
 *
 * ONE ENTRY AND NOT THREE. Three would be 84 and would cost the panel another
 * 46px of scroll at every window, and this is the one thing in the panel that
 * is read back rather than acted on - it comes after ROLL and after the damage
 * offer in draw order for exactly that reason. What the floor has to buy is
 * that the log is *there* and says what your last roll was; the rest of it is
 * behind this box's own scroll, which is where the other eleven entries have
 * always been.
 */
function RecentLog(): React.JSX.Element {
  const log = useApp((s) => s.log);
  return (
    <div className="stack" style={{ flex: 1, minHeight: 38, gap: 5 }}>
      <span className="t-meta" style={{ letterSpacing: '0.14em', color: 'var(--muted)' }}>
        RECENT
      </span>
      <div className="scroll stack" style={{ flex: 1, minHeight: 0 }}>
        {log.slice(0, 12).map((entry) => (
          <div
            key={entry.id}
            className="spread"
            style={{
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              {entry.detail}
            </span>
            <span
              className="t-meta"
              style={{
                color:
                  entry.outcome === undefined
                    ? 'var(--muted)'
                    : entry.outcome.endsWith('hope') || entry.outcome === 'critical'
                      ? 'var(--hope)'
                      : 'var(--fear)',
                textAlign: 'right',
              }}
            >
              {entry.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
