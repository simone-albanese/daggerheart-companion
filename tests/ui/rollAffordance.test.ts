/**
 * What the two dice switches leave a player able to do.
 *
 * There used to be one switch. Its hint said that turning digital dice off
 * made the Hope and Fear faces into inputs, and that was never true: the faces
 * were always inputs, and the switch only greyed out ROLL. So the screen was
 * describing a behaviour it did not have, which is the one thing this app has
 * decided it will not do.
 *
 * Now there are two independent switches, which makes four states rather than
 * two - and the fourth is the interesting one. With both off there is nothing
 * to press and nothing to type into. That state is reachable in two taps from
 * Settings and is deliberately not prevented, so what matters is that the
 * control says which switch is missing instead of sitting there disabled with
 * the word ROLL still on it. A greyed-out button labelled with the thing you
 * wanted says "the app could do this and won't"; the truth is "nothing is
 * turned on", and those are different sentences.
 *
 * `rollAffordance` is a pure function for the same reason `review` in
 * creation.ts is: the phone and the desktop both read it, and two layouts
 * disagreeing about what the app can do would be its own bug. The last block
 * checks that neither layout has quietly gone back to deciding for itself.
 *
 * It is a pure function in `src/ui/shared/rollAffordance.ts` now. It was
 * declared in `DualityRoll.tsx` while only the Play screen asked the question;
 * the GM's rest control gains 1d4 Fear and has to ask it too, and reaching into
 * a 3403-line cockpit from `src/ui/gm/` would have put the cockpit in the GM
 * screen's chunk. So the last block reads two files rather than one, and says
 * for each literal both where it is and where it is not.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stillToTypeLine } from '../../src/ui/player/DualityRoll.tsx';
import { rollAffordance } from '../../src/ui/shared/rollAffordance.ts';
import { DIE_SIZES, MAX_HELD } from '../../src/ui/player/heldDice.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';

const SOURCE = 'src/ui/player/DualityRoll.tsx';
const AFFORDANCE = 'src/ui/shared/rollAffordance.ts';
const SETTINGS = 'src/ui/settings/Settings.tsx';
const POOLS = 'src/ui/player/DicePools.tsx';

describe('the dice switches', () => {
  it('ships with the roller on and typing off', () => {
    // The default is the whole point of the change: the faces hold the best
    // band on a phone, and with the roller on they are a readout.
    expect(DEFAULT_PREFS.digitalDice).toBe(true);
    expect(DEFAULT_PREFS.manualDice).toBe(false);

    const out = rollAffordance(DEFAULT_PREFS.digitalDice, DEFAULT_PREFS.manualDice);
    expect(out.canRoll).toBe(true);
    expect(out.canType).toBe(false);
    expect(out.label).toBe('ROLL');
  });

  it('lets a table roll real dice and type them in, roller and all', () => {
    const out = rollAffordance(true, true);
    expect(out.canRoll).toBe(true);
    expect(out.canType).toBe(true);
    // The roller is still there, so the word on the button is still ROLL.
    expect(out.label).toBe('ROLL');
  });

  it('makes the faces the only way in when the roller is off', () => {
    const out = rollAffordance(false, true);
    expect(out.canRoll).toBe(false);
    expect(out.canType).toBe(true);
    expect(out.label).toBe('ENTER YOUR DICE');
    // There is no ROLL to tap in this state, so the instruction must not say
    // to tap one.
    expect(out.prompt).not.toMatch(/tap roll/i);
    expect(out.blocked).toBe(false);
  });

  it('names the missing switch when neither is on', () => {
    const out = rollAffordance(false, false);
    expect(out.canRoll).toBe(false);
    expect(out.canType).toBe(false);
    // Not "ROLL", which would be the button claiming a capability it lacks.
    expect(out.label).not.toBe('ROLL');
    expect(out.label).toBe('NO DICE TURNED ON');
    // And it says where to fix it, because a dead end with no exit is not an
    // honest state either.
    expect(out.prompt).toMatch(/settings/i);
    expect(out.blocked).toBe(true);
  });

  it('never tells anyone to tap a button that cannot roll', () => {
    // The property that the desktop strip broke: the instruction may only
    // mention ROLL in the one state where pressing ROLL does something.
    for (const digital of [true, false]) {
      for (const manual of [true, false]) {
        const out = rollAffordance(digital, manual);
        if (/tap roll/i.test(out.prompt)) expect(out.canRoll).toBe(true);
        if (out.blocked) expect(out.canRoll || out.canType).toBe(false);
      }
    }
  });

  it('never offers typing that the switch did not ask for', () => {
    // The property, over all four states rather than the four cases above:
    // canType is exactly manualDice, and canRoll is exactly digitalDice.
    for (const digital of [true, false]) {
      for (const manual of [true, false]) {
        const out = rollAffordance(digital, manual);
        expect(out.canType).toBe(manual);
        expect(out.canRoll).toBe(digital);
        expect(out.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('both layouts read the one decision', () => {
  const source = readFileSync(SOURCE, 'utf8');
  const affordance = readFileSync(AFFORDANCE, 'utf8');

  it('gates every die face on the affordance, not on a switch', () => {
    /*
     * Four faces: two on the phone, two on the desktop. They are gated two
     * different ways and both are legitimate, so the assertion is about the
     * invariant rather than about the spelling of it.
     *
     * Desktop keeps its faces on screen always - they are the result readout
     * there - and passes `editable={canType}`. The phone renders the pair only
     * when typing is on at all, because with the roller on they were holding
     * 62px of the thumb arc to show two em dashes; with the row conditional,
     * the faces inside it are unconditionally editable *because* they only
     * exist when they are.
     *
     * What must never come back is a face that is editable with neither gate,
     * which is how all four were editable to begin with.
     */
    const faces = source.match(/<Die\b/g) ?? [];
    expect(faces).toHaveLength(4);

    const byProp = source.match(/editable=\{canType\}/g) ?? [];
    expect(byProp).toHaveLength(2);

    // The conditional block, from `{canType && (` to the brace that closes it.
    const at = source.indexOf('{canType && (');
    expect(at, 'the phone no longer gates its die row on canType').toBeGreaterThan(0);
    let depth = 0;
    let i = at;
    do {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    } while (i < source.length && depth > 0);
    const guarded = source.slice(at, i);
    expect(guarded.match(/<Die\b/g) ?? []).toHaveLength(2);

    // Every face is accounted for by one gate or the other, and none by
    // neither: two by prop, two by the guard.
    expect(byProp.length + (guarded.match(/<Die\b/g) ?? []).length).toBe(faces.length);
  });

  it('gates the armed dice on the affordance too, not on a fourth notion of mode', () => {
    /*
     * The faces were gated and the dice the faces are added to were not. A
     * player typing their own Hope and Fear had the advantage d6 and every
     * bonus die rolled for them by `cryptoRng` and added to the total they were
     * shown - the app inventing a number at a table that had switched it off.
     * Those dice have slots now, and the gate on them has to be this same
     * helper: a surface that decides for itself what mode it is in is how the
     * phone and the desktop came to disagree the first time.
     */
    expect(source, 'the armed dice are offered whatever the switches say').toMatch(
      /const extraDice: ExtraDie\[\] = !canType/,
    );

    // Every slot and every grid comes from that one list, so there is no second
    // way onto the screen that the gate above does not cover.
    const slots = source.match(/<ExtraSlot\b/g) ?? [];
    const pads = source.match(/<ExtraKeypad\b/g) ?? [];
    expect(slots).toHaveLength(1);
    expect(pads).toHaveLength(1);
    expect(source).toMatch(/extraDice\.map\(\(d\) => \(/);

    // And both layouts draw that one element. A phone that could type its
    // Rally die and a cockpit that could not - or the reverse - is the same
    // bug this helper exists for, on a newer control.
    const drawn = source.match(/^\s*\{extras\}$/gm) ?? [];
    expect(drawn, 'one of the two layouts stopped drawing the armed dice').toHaveLength(2);

    // And what the engine is handed carries all four of the things it honours.
    // The old signature was `(fixed?: { hope: number; fear: number })`, which is
    // the whole defect: the other two fell through to `rng`.
    expect(source, 'the typed roll cannot supply the dice the engine asks for').toMatch(
      /fixed\?: \{ hope: number; fear: number; advantage\?: number; bonus: number\[\] \}/,
    );
  });

  it('gates both roll buttons on the affordance', () => {
    const guarded = source.match(/disabled=\{!canRoll\}/g) ?? [];
    expect(guarded).toHaveLength(2);
    // The old gate read the pref directly in two places, which is how the two
    // layouts could have drifted apart.
    expect(source).not.toMatch(/disabled=\{!digitalDice\}/);
  });

  /*
   * The counts moved with the function and the property did not.
   *
   * `rollAffordance` used to be declared in `DualityRoll.tsx`, so "declared
   * exactly once" and "declared exactly once *in this file*" were the same
   * sentence and this block read only the one file. The GM's rest control now
   * asks the same question, and a `src/ui/gm/` module importing a 3403-line
   * cockpit to ask it would put the cockpit in the GM chunk - so the helper
   * lives in `src/ui/shared/` and the two halves of the sentence came apart.
   *
   * Both halves are asserted, because either one alone is passable by the
   * defect this exists for. One declaration in the helper is not enough: a
   * layout can still keep a copy of the word beside it. Zero in the cockpit is
   * not enough either: that is also what a file with no control in it looks
   * like, and the helper could have lost the literal entirely.
   */
  it('leaves no layout deciding the wording for itself', () => {
    expect(source).not.toMatch(/'DIGITAL DICE OFF'/);
    // Every literal the control can show comes out of rollAffordance, so it is
    // declared exactly once each - there, and nowhere a layout can reach it.
    for (const label of ['ROLL', 'ENTER YOUR DICE', 'NO DICE TURNED ON']) {
      const pattern = new RegExp(`label: '${label}'`, 'g');
      expect(affordance.match(pattern) ?? [], `${label} is no longer declared once in ${AFFORDANCE}`).toHaveLength(1);
      expect(
        source.match(pattern) ?? [],
        `${SOURCE} declares ${label} again. The word on the control is the helper's to choose.`,
      ).toHaveLength(0);
    }
  });

  it('leaves the desktop verdict strip no idle copy of its own', () => {
    /*
     * This is the one that was actually broken. The phone button was routed
     * through the affordance and the desktop strip was not, so from 720px up
     * the app kept saying READY and "tap ROLL" beside a disabled button - and
     * the comment on rollAffordance claimed both layouts read it. A hardcoded
     * instruction anywhere in this file is how that happens again.
     */
    expect(source).not.toMatch(/\? 'PICK A TRAIT · TAP ROLL'/);
    // Same split as the labels above: the one copy is the helper's, and the
    // cockpit holds none of its own.
    expect(affordance.match(/'PICK A TRAIT · TAP ROLL'/g) ?? []).toHaveLength(1);
    expect(source.match(/'PICK A TRAIT · TAP ROLL'/g) ?? []).toHaveLength(0);
    expect(source).toMatch(/affordance\.prompt/);
    // READY is a claim too: it must not be printed when nothing is switched on.
    expect(source).toMatch(/affordance\.blocked/);
  });
});

describe('the settings screen', () => {
  const settings = readFileSync(SETTINGS, 'utf8');

  it('offers typing as its own switch', () => {
    expect(settings).toMatch(/checked=\{prefs\.manualDice\}/);
  });

  it('no longer claims the roller switch controls the faces', () => {
    // The old hint: "Off for tables that only roll physical dice. The two dice
    // on the Play screen become inputs..." - which the roller switch never did.
    expect(settings).not.toMatch(/The two dice on the Play screen become inputs/);
  });

  it('says out loud when both switches are off', () => {
    expect(settings).toMatch(/!prefs\.digitalDice && !prefs\.manualDice/);
  });
});

/**
 * THE THIRD SURFACE THAT ROLLS DICE, WHICH WAS NOT ASKING WHETHER IT MAY.
 *
 * `DicePools` had two `cryptoRng` call sites - one behind **Roll it** on a
 * blank die, one behind **Roll N dN** at the start of a session - and neither
 * read a preference. Its own comment quoted the owner on there being two roads
 * to a face, "o inserendo i risultati o facendo tirare i dadi all'app", while
 * the switch that chooses between them was being set two screens away. These
 * are source reads; `dicePools.test.tsx` drives the surface itself under each
 * of the three combinations `Onboarding` writes.
 */
describe('the dice pools read the one decision as well', () => {
  const pools = readFileSync(POOLS, 'utf8');

  it('reads the helper rather than the two switches', () => {
    expect(pools).toMatch(/rollAffordance\(digitalDice, manualDice\)/);
    // Not a second copy of the branching, which is what would drift.
    expect(pools).not.toMatch(/digitalDice \?/);
    expect(pools).not.toMatch(/prefs\.digitalDice &&/);
  });

  it('gates every roller it has, and only the rollers', () => {
    /*
     * Two `cryptoRng` call sites, two gates. The face is the only thing the
     * switches govern: who the die is for, what it is spent on and taking it
     * out of the pool are things a player does with a die they already have.
     */
    // The two CALLS, not the mentions: `cryptoRng(pool.sides)` on one die and
    // `rollPool(pool, count, cryptoRng)` on the set. The import and the prose
    // are neither of them a roll.
    const rollers = pools.match(/cryptoRng[()]/g) ?? [];
    expect(rollers, 'a roller appeared or disappeared without a gate to match').toHaveLength(
      2,
    );
    // Each gate named with the control it is on, because both call sites read
    // the same two fields and a regex that matches either one proves neither:
    // deleting the gate on **Roll it** left `canRoll && (` matching the gate on
    // the session roll, and this assertion stayed green while the surface
    // regressed.
    expect(pools, 'the die roller lost its gate').toMatch(
      /affordance\.canRoll && \([\s\S]{0,320}?Roll it/,
    );
    expect(pools, 'the numeric entry lost its gate').toMatch(
      /affordance\.canType && \([\s\S]{0,320}?Type what you rolled/,
    );
    expect(pools).toMatch(/pool\.rolledAt === 'grant' && affordance\.canRoll/);
    expect(pools).toMatch(/pool\.rolledAt === 'grant' && !affordance\.canRoll/);
  });

  it('says which switch is missing when neither is on', () => {
    // The same sentence `DamageRow` uses in this state, for the same reason: a
    // dead end with no exit is not an honest state either.
    expect(pools).toMatch(/!affordance\.canRoll && !affordance\.canType/);
    expect(pools).toMatch(/Settings turns one on/);
  });
});

/**
 * WHAT THE INSTRUCTION LINE COSTS THE PHONE BAR, COUNTED OFF THE CONSTANTS.
 *
 * `rollLine`'s docblock derives the bar's height from a characters-per-line
 * figure, and it used to close that derivation with an example it called the
 * longest: `STILL TO TYPE: HOPE · FEAR · ADV · +D6`, 38 characters, "two of the
 * 30-character lines this docblock derives", therefore "this costs the bar no
 * height". The example is real and the conclusion does not follow from it,
 * because `untyped` names HOPE, FEAR and ONE LABEL PER ARMED DIE - and the
 * armed set is capped by `MAX_HELD`, which is twelve, not by the one the
 * example happens to have.
 *
 * Corrected, and it is the same failure a second time: the replacement counted
 * `untyped` - fifteen items, 116 characters - and `untyped` is the POOL, not
 * the line. The line is `started ? stillToTypeLine(untyped) : null`, and
 * `started` is true only once a face has been ENTERED, because a sheet with
 * nothing typed on it is idle rather than waiting. So one of the fifteen is
 * always filled, a filled die is never in `untyped`, and the line names at most
 * FOURTEEN. 116 is a state the code cannot reach, argued in the paragraph
 * written to replace one that argued from a state the code could not reach.
 *
 * So the worst case is built here out of the four declared things it depends
 * on - `MAX_HELD`, the tray's own `DIE_SIZES`, the separator and prefix
 * `stillToTypeLine` writes, and the gate that decides whether the line is drawn
 * at all - rather than asserted as a number a docblock can drift away from.
 * That is why that function is exported at all. `cockpitRoll.test.tsx` drives
 * the surface to the same number, because an arithmetic nobody drives is how
 * both of the wrong ones got written.
 */
describe('the line that names the dice still outstanding', () => {
  /** The label `extraSlots` gives a held die, which is what makes it four wide. */
  const bonusLabel = (sides: number): string => `+D${String(sides)}`;
  const widest = Math.max(...DIE_SIZES);

  it('is 38 characters for the ordinary roll the docblock was written on', () => {
    expect(stillToTypeLine(['HOPE', 'FEAR', 'ADV', bonusLabel(6)])).toHaveLength(38);
  });

  it('can hold fifteen items and can never draw all fifteen', () => {
    // The pool: HOPE, FEAR, the advantage die, and one label per held die.
    const pool = [
      'HOPE',
      'FEAR',
      'ADV',
      ...Array.from({ length: MAX_HELD }, () => bonusLabel(widest)),
    ];
    expect(pool).toHaveLength(2 + 1 + MAX_HELD);
    // 15 of prefix + (4 + 4 + 3 + 12 * 4) of labels + 14 separators at 3.
    expect(stillToTypeLine(pool)).toHaveLength(
      15 + (4 + 4 + 3 + MAX_HELD * bonusLabel(widest).length) + 14 * 3,
    );
    expect(stillToTypeLine(pool)).toHaveLength(116);

    /*
     * And that is the count the docblock drew its heights from. The line is not
     * the pool: `stillToType` is `started ? stillToTypeLine(untyped) : null`,
     * and `started` needs a face entered. One of the fifteen is therefore always
     * filled, and a filled die is not in `untyped`.
     */
    const source = readFileSync(SOURCE, 'utf8');
    expect(source, 'the line is no longer gated on a face having been entered').toMatch(
      /const stillToType = started \? stillToTypeLine\(untyped\) : null;/,
    );
    expect(source, 'started stopped meaning "somebody has typed something"').toMatch(
      /const started =\n\s*canType &&\n\s*\(manual\.hope !== null \|\| manual\.fear !== null \|\| extraDice\.some\(\(d\) => d\.value !== null\)\);/,
    );
  });

  it('reaches 110 characters, which is four lines at 393px and four at 375', () => {
    const pool = [
      'HOPE',
      'FEAR',
      'ADV',
      ...Array.from({ length: MAX_HELD }, () => bonusLabel(widest)),
    ];
    /** The line with the `i`th item entered, which is the only way it is drawn. */
    const entered = (i: number): string =>
      stillToTypeLine(pool.filter((_, j) => j !== i)) ?? '';
    const lengths = pool.map((_, i) => entered(i).length);

    // Fourteen items, giving up the least: ADV is the shortest label at three,
    // and it takes its separator with it, so 116 less 6.
    expect(Math.max(...lengths), 'the longest line one entered face can leave').toBe(110);
    expect(entered(pool.indexOf('ADV'))).toHaveLength(
      15 + (4 + 4 + MAX_HELD * bonusLabel(widest).length) + 13 * 3,
    );
    // Every other choice is shorter: a four-character label costs 7, not 6.
    expect(entered(0), 'giving up HOPE instead').toHaveLength(109);
    expect(entered(pool.length - 1), 'giving up a held die instead').toHaveLength(109);
    // And with no sign armed there is no ADV to give up: fourteen in the pool,
    // thirteen in the line, all four characters wide.
    const noSign = pool.filter((x) => x !== 'ADV');
    expect(stillToTypeLine(noSign.slice(1))).toHaveLength(
      15 + (4 + MAX_HELD * bonusLabel(widest).length) + 12 * 3,
    );
    expect(stillToTypeLine(noSign.slice(1))).toHaveLength(103);

    // The 30 and the 28 are `rollLine`'s own, derived there from the 245px and
    // 227px boxes measured in Chrome; nothing is measured here. What this pins
    // is that the worst case is four lines at both reference widths rather than
    // the two the docblock's first example concluded - so the bar grows past
    // its 56, which is why it declares `minHeight` and not `height`.
    expect(Math.ceil(110 / 30)).toBe(4);
    expect(Math.ceil(110 / 28)).toBe(4);
    expect(17 + 4 + 4 * 15 + 2, 'the bar at 393px').toBe(83);
    expect(17 + 4 + 4 * 15 + 2, 'the bar at 375px').toBe(83);

    const source = readFileSync(SOURCE, 'utf8');
    expect(source, 'ROLL went back to a fixed height, which is where a line clips').toMatch(
      /minHeight: 56,/,
    );
  });

  it('says nothing at all when nothing is outstanding', () => {
    expect(stillToTypeLine([])).toBeNull();
  });
});
