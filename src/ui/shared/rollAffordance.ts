/**
 * What the two dice switches leave a player able to do - and now what any
 * surface may offer, not only a player's.
 *
 * This function and its result type were declared in `player/DualityRoll.tsx`
 * for as long as only the Play screen asked the question. The GM side asks it
 * now: the rest control gains the GM 1d4 Fear, and a table that has turned the
 * roller off must not have that die rolled for them on a second screen after
 * the first one refused. So the answer moved to where both sides can reach it.
 *
 * It moved rather than being imported across, and the difference is a chunk.
 * Nothing under `src/ui/gm/` imports anything under `src/ui/player/`, and an
 * import of `DualityRoll.tsx` - 3403 lines, the whole cockpit - would pull that
 * module into the GM screen's chunk for twenty lines of branching.
 * `tests/harness/staticImports.test.ts` asserts the property so the next author
 * cannot undo the move with one line.
 *
 * No re-export was left behind in `DualityRoll.tsx`. A second door to the same
 * symbol is how one surface ends up reading a copy of this decision instead of
 * this decision.
 */

/** What the two dice switches leave a player able to do. */
export interface RollAffordance {
  /** Pressing the control can produce a roll. */
  canRoll: boolean;
  /** The Hope and Fear faces accept a typed value. */
  canType: boolean;
  /** The word on the control before a roll has been made. */
  label: string;
  /** What to do next, for whichever idle readout the layout has. */
  prompt: string;
  /** The prompt is a thing to go and fix, not an instruction to follow. */
  blocked: boolean;
}

/**
 * The honesty rule, in one place.
 *
 * "Digital dice" and "Type your own dice" are independent switches, so there
 * are four states and one of them - both off - leaves nothing on the screen
 * that can resolve a roll. That state is real, it is reachable from Settings
 * in two taps, and it is not prevented. What it must never do is present a
 * disabled control still saying ROLL, because a greyed-out button with the
 * name of the thing you wanted on it says the app could do it and won't,
 * rather than that nothing is switched on. So the control names the missing
 * switch and where to find it.
 *
 * Both layouts read this rather than deciding for themselves; the phone and
 * the desktop disagreeing about what the app can do would be its own bug. The
 * desktop was that bug for a while - its verdict strip kept its own idle copy
 * and went on saying READY and "tap ROLL" next to a button that could not
 * roll, while this comment claimed otherwise. Hence `prompt`: there is one
 * instruction line, and whichever readout a layout has, it shows that one.
 */
export function rollAffordance(digitalDice: boolean, manualDice: boolean): RollAffordance {
  if (digitalDice) {
    return {
      canRoll: true,
      canType: manualDice,
      label: 'ROLL',
      prompt: 'PICK A TRAIT · TAP ROLL',
      blocked: false,
    };
  }
  if (manualDice) {
    return {
      canRoll: false,
      canType: true,
      label: 'ENTER YOUR DICE',
      // No ROLL to tap: the faces are the only way in, and the line says so.
      prompt: 'PICK A TRAIT · TYPE YOUR DICE',
      blocked: false,
    };
  }
  return {
    canRoll: false,
    canType: false,
    label: 'NO DICE TURNED ON',
    prompt: 'TURN ON DIGITAL OR TYPED DICE IN SETTINGS',
    blocked: true,
  };
}
