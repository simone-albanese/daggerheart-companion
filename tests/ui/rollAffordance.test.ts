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
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rollAffordance } from '../../src/ui/player/DualityRoll.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';

const SOURCE = 'src/ui/player/DualityRoll.tsx';
const SETTINGS = 'src/ui/settings/Settings.tsx';

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

  it('gates every die face on the affordance, not on a switch', () => {
    // Four faces: two on the phone, two on the desktop. Each must be gated,
    // and gated on the same thing - a bare `editable` is how they were all
    // unconditionally editable in the first place.
    const gated = source.match(/editable=\{canType\}/g) ?? [];
    expect(gated).toHaveLength(4);
    expect(source).not.toMatch(/\n\s*editable\s*\n/);
    expect(source).not.toMatch(/\seditable\s*\/>/);
  });

  it('gates both roll buttons on the affordance', () => {
    const guarded = source.match(/disabled=\{!canRoll\}/g) ?? [];
    expect(guarded).toHaveLength(2);
    // The old gate read the pref directly in two places, which is how the two
    // layouts could have drifted apart.
    expect(source).not.toMatch(/disabled=\{!digitalDice\}/);
  });

  it('leaves no layout deciding the wording for itself', () => {
    expect(source).not.toMatch(/'DIGITAL DICE OFF'/);
    // Every literal the control can show comes out of rollAffordance, so it is
    // declared exactly once each.
    for (const label of ['ROLL', 'ENTER YOUR DICE', 'NO DICE TURNED ON']) {
      const declarations = source.match(new RegExp(`label: '${label}'`, 'g')) ?? [];
      expect(declarations).toHaveLength(1);
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
    const prompts = source.match(/'PICK A TRAIT · TAP ROLL'/g) ?? [];
    expect(prompts).toHaveLength(1);
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
