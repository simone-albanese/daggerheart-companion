import { describe, expect, it } from 'vitest';
import { BASE_HOPE } from '@engine/character.ts';
import {
  addScar,
  avoidDeath,
  clearAllMarks,
  clearMarks,
  riskItAll,
  scarCost,
  splitClear,
} from '@engine/death.ts';
import type { Rng } from '@engine/dice.ts';
import { makeCharacter, refusingRng, scriptedRng } from '../fixtures/factories.ts';

/** Feeds the engine exactly the faces a table would have rolled, in order. */
const scripted = (...faces: number[]): Rng => {
  let i = 0;
  return () => faces[i++] ?? 1;
};

describe('Avoid Death', () => {
  it('scars at or below the level and not above it', () => {
    const c = makeCharacter({ level: 4 });
    expect(avoidDeath(c, scripted(3)).scar).toBe(true);
    expect(avoidDeath(c, scripted(4)).scar).toBe(true);
    expect(avoidDeath(c, scripted(5)).scar).toBe(false);
  });

  it('reports the die and the level it was read against', () => {
    const roll = avoidDeath(makeCharacter({ level: 7 }), scripted(6));
    expect(roll).toEqual({ hopeDie: 6, level: 7, scar: true });
  });

  it('reads the Hope Die, never the Fear Die', () => {
    // rollDuality draws Hope first, then Fear; a death move reads only the first.
    expect(avoidDeath(makeCharacter({ level: 1 }), scripted(9, 1)).hopeDie).toBe(9);
  });
});

describe('the cost of a scar', () => {
  it('crosses out one Hope slot', () => {
    expect(scarCost(makeCharacter()).hopeSlots).toBe(BASE_HOPE - 1);
    expect(scarCost(makeCharacter({ scars: ['a', 'b'] })).hopeSlots).toBe(BASE_HOPE - 3);
  });

  it('clamps the Hope still available to the slots that are left', () => {
    const c = makeCharacter({ scars: ['a', 'b', 'c', 'd'], hope: { marked: 2, max: 2 } });
    expect(scarCost(c)).toEqual({ hopeSlots: 1, hopeAvailable: 1, journeyEnds: false });
  });

  it('ends the journey when the last slot goes', () => {
    const c = makeCharacter({ scars: Array.from({ length: BASE_HOPE - 1 }, (_, i) => `${i}`) });
    expect(scarCost(c).journeyEnds).toBe(true);
  });

  it('names an unnamed scar rather than storing an empty string', () => {
    expect(addScar(makeCharacter(), '   ').scars).toEqual(['Unnamed scar']);
    expect(addScar(makeCharacter(), ' Frostbite ').scars).toEqual(['Frostbite']);
  });
});

describe('Risk It All', () => {
  it('stays up and clears the Hope Die when Hope is higher', () => {
    expect(riskItAll(scripted(9, 4))).toEqual({ hope: 9, fear: 4, result: 'stay', clear: 9 });
  });

  it('dies when Fear is higher', () => {
    expect(riskItAll(scripted(4, 9))).toEqual({ hope: 4, fear: 9, result: 'die', clear: 0 });
  });

  it('treats matching dice as their own outcome, not as a critical success', () => {
    expect(riskItAll(scripted(6, 6))).toEqual({ hope: 6, fear: 6, result: 'clear-all', clear: 0 });
  });
});

describe('dividing the Hope Die', () => {
  const c = makeCharacter({ hp: { marked: 6, max: 6 }, stress: { marked: 2, max: 6 } });

  it('never clears more than the die', () => {
    expect(splitClear(c, 5, { hp: 5, stress: 5 })).toEqual({ hp: 5, stress: 0 });
    expect(splitClear(c, 5, { hp: 3, stress: 5 })).toEqual({ hp: 3, stress: 2 });
  });

  it('never clears a box that was not marked', () => {
    expect(splitClear(c, 9, { hp: 9, stress: 9 })).toEqual({ hp: 6, stress: 2 });
  });

  it('refuses negative shares', () => {
    expect(splitClear(c, 4, { hp: -3, stress: -1 })).toEqual({ hp: 0, stress: 0 });
  });

  it('applies a split without going below zero', () => {
    expect(clearMarks(c, 4, 1).hp.marked).toBe(2);
    expect(clearMarks(c, 4, 1).stress.marked).toBe(1);
    expect(clearMarks(c, 99, 99).hp.marked).toBe(0);
  });

  it('clears both tracks entirely on matching dice', () => {
    const out = clearAllMarks(c);
    expect([out.hp.marked, out.stress.marked]).toEqual([0, 0]);
    expect([out.hp.max, out.stress.max]).toEqual([6, 6]);
  });
});

/**
 * The door a table rolling its own d12s comes in by.
 *
 * `engine/dice.ts` has honoured a `fixed` per field since it was written and
 * these two had no such thing, so the surface had nowhere to put a face and
 * called them with the defaulted `cryptoRng` at every table. The shape here is
 * that file's own - `DualityInput['fixed']`, `??` per field - and these cases
 * are one field at a time on purpose: a mutant that drops one must not be able
 * to hide behind another that is still honoured in the same case.
 *
 * `advantage` and `bonus` are the other two fields of that shape and they are
 * unreachable here rather than unhandled: `DEATH_ROLL` arms neither advantage
 * nor a bonus die, so `rollDuality` rolls neither and there is no face to type.
 */
describe('typing the dice the table rolled', () => {
  it('takes a typed Hope Die for Avoid Death and consults no rng at all', () => {
    // Not "consults it less": `rollDuality` draws a Fear Die unconditionally
    // and this move throws it away, so the whole roll is the one typed number.
    // `refusingRng` throws, so a Fear Die drawn here fails this line.
    expect(avoidDeath(makeCharacter({ level: 4 }), refusingRng, { hope: 9 })).toEqual({
      hopeDie: 9,
      level: 4,
      scar: false,
    });
    expect(avoidDeath(makeCharacter({ level: 9 }), refusingRng, { hope: 9 }).scar).toBe(true);
  });

  it('falls back to the rng for an Avoid Death Hope Die that was not typed', () => {
    const rng = scriptedRng(5);
    // A `fixed` carrying only the Fear Die leaves the Hope Die on the dice,
    // which is what a per-field `??` means. One call, for a d12.
    expect(avoidDeath(makeCharacter({ level: 1 }), rng, { fear: 7 }).hopeDie).toBe(5);
    expect(rng.calls).toEqual([12]);
    expect(avoidDeath(makeCharacter({ level: 1 }), scriptedRng(5, 2)).hopeDie).toBe(5);
  });

  it('takes both faces of a Risk It All and consults no rng at all', () => {
    expect(riskItAll(refusingRng, { hope: 9, fear: 4 })).toEqual({
      hope: 9,
      fear: 4,
      result: 'stay',
      clear: 9,
    });
    expect(riskItAll(refusingRng, { hope: 4, fear: 9 }).result).toBe('die');
    expect(riskItAll(refusingRng, { hope: 6, fear: 6 }).result).toBe('clear-all');
  });

  it('rolls the half of a Risk It All that was not typed, and only that half', () => {
    // Half a 2d12 is not a roll anybody made, so the other die is still the
    // engine's - one call each way, and the typed face survives it.
    const typedFear = scriptedRng(3);
    expect(riskItAll(typedFear, { fear: 11 })).toEqual({
      hope: 3,
      fear: 11,
      result: 'die',
      clear: 0,
    });
    expect(typedFear.calls).toEqual([12]);

    const typedHope = scriptedRng(6);
    expect(riskItAll(typedHope, { hope: 6 })).toEqual({
      hope: 6,
      fear: 6,
      result: 'clear-all',
      clear: 0,
    });
    expect(typedHope.calls).toEqual([12]);
  });

  it('still rolls both dice when nothing is typed', () => {
    const rng = scriptedRng(9, 4);
    expect(riskItAll(rng)).toEqual({ hope: 9, fear: 4, result: 'stay', clear: 9 });
    expect(rng.calls).toEqual([12, 12]);
  });
});
