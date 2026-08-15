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
import { makeCharacter } from '../fixtures/factories.ts';

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
