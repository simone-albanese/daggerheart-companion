import { describe, expect, it } from 'vitest';
import {
  applyProficiency,
  diceOf,
  cryptoRng,
  formatDamage,
  highestDamage,
  OUTCOME_DETAIL,
  OUTCOME_LABEL,
  outcomeDetail,
  parseDamage,
  rollDamage,
  rollDuality,
  seededRng,
  type DualityInput,
  type RollOutcome,
} from '@engine/dice.ts';
import { refusingRng, scriptedRng } from '../fixtures/factories.ts';

const draw = (rng: (sides: number) => number, n: number, sides = 12): number[] =>
  Array.from({ length: n }, () => rng(sides));

describe('seededRng', () => {
  it('replays the same sequence for the same seed', () => {
    expect(draw(seededRng(20250909), 50)).toEqual(draw(seededRng(20250909), 50));
  });

  it('gives different sequences for different seeds', () => {
    expect(draw(seededRng(1), 50)).not.toEqual(draw(seededRng(2), 50));
  });

  it('stays inside [1, sides] for every die the app rolls', () => {
    const rng = seededRng(7);
    for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
      for (let i = 0; i < 2000; i++) {
        const v = rng(sides);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(sides);
      }
    }
  });

  it('reaches every face of a d12', () => {
    const rng = seededRng(99);
    const seen = new Set(draw(rng, 5000));
    expect(seen.size).toBe(12);
  });

  it('is not degenerate for seed 0', () => {
    // xorshift is stuck at zero forever if its state ever reaches zero, which
    // would turn every roll into a 1 - and every duality roll into a critical.
    const seen = new Set(draw(seededRng(0), 500));
    expect(seen.size).toBe(12);
    expect(draw(seededRng(0), 20)).toEqual(draw(seededRng(0), 20));
  });

  it('does not share state between two generators of the same seed', () => {
    const a = seededRng(5);
    const b = seededRng(5);
    a(12);
    a(12);
    expect(b(12)).toBe(seededRng(5)(12));
  });
});

describe('cryptoRng', () => {
  it('stays inside [1, sides]', () => {
    for (let i = 0; i < 500; i++) {
      const v = cryptoRng(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});

const fixed = (hope: number, fear: number, rest: Partial<DualityInput> = {}): DualityInput => ({
  modifier: 0,
  difficulty: null,
  ...rest,
  fixed: { hope, fear, ...rest.fixed },
});

describe('rollDuality outcomes', () => {
  const cases: Array<[RollOutcome, number, number, number]> = [
    // outcome, hope, fear, difficulty
    ['success-hope', 10, 4, 12],
    ['success-fear', 4, 10, 12],
    ['failure-hope', 6, 3, 20],
    ['failure-fear', 3, 6, 20],
    ['critical', 7, 7, 20],
  ];

  it.each(cases)('produces %s', (outcome, hope, fear, difficulty) => {
    const r = rollDuality(fixed(hope, fear, { difficulty }), refusingRng);
    expect(r.outcome).toBe(outcome);
    expect(r.total).toBe(hope + fear);
  });

  it('covers all five outcomes with the same table', () => {
    expect(new Set(cases.map((c) => c[0])).size).toBe(5);
  });

  it('treats the exact Difficulty as a success', () => {
    expect(rollDuality(fixed(6, 5, { difficulty: 11 }), refusingRng).outcome).toBe('success-hope');
    expect(rollDuality(fixed(6, 5, { difficulty: 12 }), refusingRng).outcome).toBe('failure-hope');
  });

  it('holds its invariants for every pair of d12 faces', () => {
    for (let hope = 1; hope <= 12; hope++) {
      for (let fear = 1; fear <= 12; fear++) {
        const r = rollDuality(fixed(hope, fear, { modifier: 3, difficulty: 15 }), refusingRng);
        expect(r.critical).toBe(hope === fear);
        expect(r.withHope).toBe(hope >= fear);
        expect(r.total).toBe(hope + fear + 3);
        expect(r.effects.hope).toBe(r.withHope ? 1 : 0);
        expect(r.effects.gmFear).toBe(r.withHope ? 0 : 1);
        expect(r.effects.stress).toBe(r.critical ? -1 : 0);
        expect(r.succeeded).toBe(r.critical ? true : r.total >= 15);
      }
    }
  });

  it('reports every outcome it can produce as a labelled one', () => {
    const outcomes = new Set<RollOutcome>();
    const rng = seededRng(3);
    for (let i = 0; i < 400; i++) {
      outcomes.add(rollDuality({ modifier: 0, difficulty: 13 }, rng).outcome);
    }
    expect(outcomes.size).toBe(5);
    for (const o of outcomes) {
      expect(OUTCOME_LABEL[o]).toBeTruthy();
      expect(OUTCOME_DETAIL[o]).toBeTruthy();
    }
  });
});

describe('rollDuality criticals', () => {
  it('is a critical whenever the two dice match, and counts as with Hope', () => {
    for (let face = 1; face <= 12; face++) {
      const r = rollDuality(fixed(face, face, { difficulty: 99 }), refusingRng);
      expect(r.critical).toBe(true);
      expect(r.outcome).toBe('critical');
      expect(r.withHope).toBe(true);
      expect(r.effects.gmFear).toBe(0);
    }
  });

  it('succeeds even against a Difficulty the total cannot reach', () => {
    const r = rollDuality(fixed(1, 1, { modifier: -5, difficulty: 40 }), refusingRng);
    expect(r.total).toBe(-3);
    expect(r.succeeded).toBe(true);
    expect(r.outcome).toBe('critical');
  });

  it('grants a Hope and clears a Stress', () => {
    const r = rollDuality(fixed(9, 9, { difficulty: 10 }), refusingRng);
    expect(r.effects).toEqual({ hope: 1, stress: -1, gmFear: 0 });
    expect(OUTCOME_DETAIL.critical).toMatch(/Stress/);
  });

  it('is still a critical when the GM has not shared the Difficulty', () => {
    const r = rollDuality(fixed(4, 4), refusingRng);
    expect(r.outcome).toBe('critical');
    expect(r.succeeded).toBe(true);
  });
});

describe('rollDuality without a Difficulty', () => {
  it('leaves the verdict to the GM', () => {
    // `succeeded` is the field a caller must read: with no Difficulty the app
    // knows Hope from Fear but not success from failure.
    const r = rollDuality(fixed(9, 2), refusingRng);
    expect(r.difficulty).toBeNull();
    expect(r.succeeded).toBeNull();
    expect(r.withHope).toBe(true);
    expect(r.effects).toEqual({ hope: 1, stress: 0, gmFear: 0 });
  });
});

describe('rollDuality advantage', () => {
  it('adds a d6 for advantage', () => {
    const rng = scriptedRng(5, 3, 4);
    const r = rollDuality({ modifier: 0, difficulty: null, advantage: true }, rng);
    expect(rng.calls).toEqual([12, 12, 6]);
    expect(r.advantageSign).toBe(1);
    expect(r.advantageDie).toBe(4);
    expect(r.total).toBe(5 + 3 + 4);
  });

  it('subtracts a d6 for disadvantage', () => {
    const rng = scriptedRng(5, 3, 4);
    const r = rollDuality({ modifier: 0, difficulty: null, disadvantage: true }, rng);
    expect(r.advantageSign).toBe(-1);
    expect(r.advantageDie).toBe(4);
    expect(r.total).toBe(5 + 3 - 4);
  });

  it('cancels exactly when both are present - they do not stack', () => {
    const rng = scriptedRng(5, 3);
    const r = rollDuality(
      { modifier: 0, difficulty: null, advantage: true, disadvantage: true },
      rng,
    );
    // No third call: the d6 is not rolled at all, so it cannot leak into a log.
    expect(rng.calls).toEqual([12, 12]);
    expect(r.advantageSign).toBe(0);
    expect(r.advantageDie).toBeNull();
    expect(r.total).toBe(8);
  });

  it('rolls no d6 when neither is present', () => {
    const rng = scriptedRng(5, 3);
    const r = rollDuality({ modifier: 0, difficulty: null }, rng);
    expect(rng.calls).toEqual([12, 12]);
    expect(r.advantageDie).toBeNull();
  });

  it('cancels to the same total as a plain roll', () => {
    const plain = rollDuality(fixed(5, 3, { modifier: 2 }), refusingRng);
    const both = rollDuality(
      fixed(5, 3, { modifier: 2, advantage: true, disadvantage: true }),
      refusingRng,
    );
    expect(both.total).toBe(plain.total);
  });
});

describe('rollDuality fixed dice', () => {
  it('never touches the RNG when every die is supplied', () => {
    const r = rollDuality(
      {
        modifier: 1,
        difficulty: 10,
        advantage: true,
        bonusDice: [6, 8],
        fixed: { hope: 8, fear: 2, advantage: 5, bonus: [4, 7] },
      },
      refusingRng,
    );
    expect(r.hope).toBe(8);
    expect(r.fear).toBe(2);
    expect(r.advantageDie).toBe(5);
    expect(r.bonusDice).toEqual([4, 7]);
    expect(r.total).toBe(8 + 2 + 1 + 5 + 4 + 7);
  });

  it('uses the fixed die for disadvantage too', () => {
    const r = rollDuality(
      { modifier: 0, difficulty: null, disadvantage: true, fixed: { hope: 6, fear: 6, advantage: 3 } },
      refusingRng,
    );
    expect(r.advantageDie).toBe(3);
    expect(r.total).toBe(9);
  });

  it('rolls only the dice that were not supplied', () => {
    const rng = scriptedRng(11, 6, 2);
    const r = rollDuality(
      { modifier: 0, difficulty: null, bonusDice: [6, 8], fixed: { hope: 9, bonus: [5] } },
      rng,
    );
    // fear (d12), then only the second bonus die (d8).
    expect(rng.calls).toEqual([12, 8]);
    expect(r.hope).toBe(9);
    expect(r.fear).toBe(11);
    expect(r.bonusDice).toEqual([5, 6]);
  });

  it('ignores a fixed advantage die when neither advantage nor disadvantage applies', () => {
    const r = rollDuality(fixed(4, 5, { fixed: { advantage: 6 } }), refusingRng);
    expect(r.advantageDie).toBeNull();
    expect(r.total).toBe(9);
  });
});

describe('rollDuality bonus dice and experience', () => {
  it('rolls each bonus die with its own size and adds them all - Rally, Prayer, Slayer, Patron', () => {
    // These are dice a feature adds to the total on their own; the Help an
    // Ally d6 is not one of them, see the describe below.
    const rng = scriptedRng(4, 4, 6, 8);
    const r = rollDuality({ modifier: 0, difficulty: null, bonusDice: [6, 8] }, rng);
    expect(rng.calls).toEqual([12, 12, 6, 8]);
    expect(r.bonusDice).toEqual([6, 8]);
    expect(r.total).toBe(4 + 4 + 6 + 8);
  });

  it('adds the Experience bonus the player chose to spend Hope on', () => {
    const r = rollDuality(fixed(5, 4, { modifier: 2, experienceBonus: 3, difficulty: 14 }), refusingRng);
    expect(r.experienceBonus).toBe(3);
    expect(r.total).toBe(14);
    expect(r.outcome).toBe('success-hope');
  });
});

/**
 * SRD 2 p49, Help an Ally: "If multiple advantage dice apply to the same
 * action roll due to one or more players using Help an Ally, the player making
 * the action roll adds only the highest result of all advantage dice rolled
 * (including their own) and ignores the rest." The book's own example: Anne,
 * +1 Agility, 13 with Hope (8 and 5), her advantage die a 2, Bo's a 3 and
 * Cameron's a 4 - "an 18 with Hope (13 + 1 + 4)". The engine used to add every
 * one of them and answer 23.
 */
describe('rollDuality and Help an Ally', () => {
  it('adds only the highest advantage die, the roller’s own included (p49, Anne)', () => {
    const r = rollDuality(
      {
        modifier: 1,
        difficulty: null,
        advantage: true,
        helpDice: [6, 6],
        fixed: { hope: 8, fear: 5, advantage: 2, help: [3, 4] },
      },
      refusingRng,
    );
    expect(r.advantageDie).toBe(2);
    expect(r.helpDice).toEqual([3, 4]);
    expect(r.highestAdvantage).toBe(4);
    expect(r.total).toBe(18);
  });

  it('adds only the highest Help die when the roller had no advantage of their own', () => {
    const r = rollDuality(
      { modifier: 1, difficulty: null, helpDice: [6, 6], fixed: { hope: 8, fear: 5, help: [3, 4] } },
      refusingRng,
    );
    expect(r.advantageDie).toBeNull();
    expect(r.highestAdvantage).toBe(4);
    expect(r.total).toBe(18);
  });

  it('keeps the roller’s own die when it is the highest', () => {
    const r = rollDuality(
      {
        modifier: 1,
        difficulty: null,
        advantage: true,
        helpDice: [6],
        fixed: { hope: 8, fear: 5, advantage: 6, help: [3] },
      },
      refusingRng,
    );
    expect(r.highestAdvantage).toBe(6);
    expect(r.total).toBe(20);
  });

  it('still adds a Rally die on its own beside the Help pool', () => {
    // Rally is a bonus die, not an advantage die: 13 + 1 + Rally 3 + best of
    // (2, 4).
    const r = rollDuality(
      {
        modifier: 1,
        difficulty: null,
        advantage: true,
        bonusDice: [6],
        helpDice: [6],
        fixed: { hope: 8, fear: 5, advantage: 2, bonus: [3], help: [4] },
      },
      refusingRng,
    );
    expect(r.total).toBe(21);
  });

  it('rolls a Help die the table did not type, with its own size', () => {
    const rng = scriptedRng(8, 5, 4);
    const r = rollDuality({ modifier: 1, difficulty: null, helpDice: [6] }, rng);
    expect(rng.calls).toEqual([12, 12, 6]);
    expect(r.helpDice).toEqual([4]);
    expect(r.total).toBe(18);
  });

  it('changes nothing about a roll with no Help dice', () => {
    const r = rollDuality(fixed(8, 5, { advantage: true, fixed: { advantage: 2 } }), refusingRng);
    expect(r.helpDice).toEqual([]);
    expect(r.highestAdvantage).toBe(2);
    expect(r.total).toBe(15);
    const plain = rollDuality(fixed(8, 5), refusingRng);
    expect(plain.highestAdvantage).toBeNull();
    expect(plain.total).toBe(13);
  });
});

describe('parseDamage', () => {
  it.each([
    ['d8', { count: 1, sides: 8, modifier: 0 }],
    ['2d6+3', { count: 2, sides: 6, modifier: 3 }],
    ['1d12-1', { count: 1, sides: 12, modifier: -1 }],
    ['3d8 + 4', { count: 3, sides: 8, modifier: 4 }],
    ['D10', { count: 1, sides: 10, modifier: 0 }],
    ['4d12 - 2', { count: 4, sides: 12, modifier: -2 }],
    ['d6−2', { count: 1, sides: 6, modifier: -2 }], // unicode minus from a PDF
  ])('parses %s', (spec, expected) => {
    expect(parseDamage(spec)).toEqual(expected);
  });

  it.each(['', 'garbage', 'no dice here', '12', 'd', '2x6', 'phy'])(
    'returns null for %o',
    (spec) => {
      expect(parseDamage(spec)).toBeNull();
    },
  );

  it('round-trips through formatDamage', () => {
    for (const spec of ['1d8+3', '2d6-2', '3d12']) {
      expect(formatDamage(parseDamage(spec)!)).toBe(spec);
    }
  });
});

describe('formatDamage', () => {
  it('omits a zero modifier and keeps the sign of the rest', () => {
    expect(formatDamage({ count: 2, sides: 8, modifier: 0 })).toBe('2d8');
    expect(formatDamage({ count: 2, sides: 8, modifier: 3 })).toBe('2d8+3');
    expect(formatDamage({ count: 2, sides: 8, modifier: -3 })).toBe('2d8-3');
  });
});

describe('rollDamage', () => {
  it('rolls one die per count and adds the flat modifier', () => {
    const rng = scriptedRng(3, 5);
    const r = rollDamage({ count: 2, sides: 8, modifier: 1 }, {}, rng);
    expect(rng.calls).toEqual([8, 8]);
    expect(r.dice).toEqual([3, 5]);
    expect(r.total).toBe(9);
    expect(r.critical).toBe(false);
    expect(r.criticalBonus).toBe(0);
  });

  it('adds count * sides on a critical', () => {
    const r = rollDamage({ count: 2, sides: 8, modifier: 1 }, { critical: true, fixed: [3, 5] }, refusingRng);
    expect(r.criticalBonus).toBe(16);
    expect(r.total).toBe(3 + 5 + 1 + 16);
    expect(r.critical).toBe(true);
  });

  it('does not double the flat modifier on a critical', () => {
    const plain = rollDamage({ count: 1, sides: 12, modifier: 5 }, { fixed: [1] }, refusingRng);
    const crit = rollDamage({ count: 1, sides: 12, modifier: 5 }, { critical: true, fixed: [1] }, refusingRng);
    expect(crit.total - plain.total).toBe(12);
  });

  it('takes fixed dice for the table rolling physical dice', () => {
    const r = rollDamage({ count: 3, sides: 6, modifier: 0 }, { fixed: [2, 4, 6] }, refusingRng);
    expect(r.dice).toEqual([2, 4, 6]);
    expect(r.total).toBe(12);
  });

  it('rolls only the dice the table did not supply', () => {
    const rng = scriptedRng(6, 6);
    const r = rollDamage({ count: 3, sides: 6, modifier: 0 }, { fixed: [2] }, rng);
    expect(rng.calls).toEqual([6, 6]);
    expect(r.dice).toEqual([2, 6, 6]);
  });

  it('folds an extra modifier into the total and the printed spec', () => {
    const r = rollDamage({ count: 1, sides: 6, modifier: 2 }, { extraModifier: 3, fixed: [4] }, refusingRng);
    expect(r.modifier).toBe(5);
    expect(r.total).toBe(9);
    expect(r.spec).toBe('1d6+5');
  });
});

describe('applyProficiency', () => {
  it('multiplies the die count and leaves the modifier alone', () => {
    expect(applyProficiency({ count: 1, sides: 8, modifier: 3 }, 3)).toEqual({
      count: 3,
      sides: 8,
      modifier: 3,
    });
  });

  it('multiplies a weapon that already rolls more than one die', () => {
    expect(applyProficiency({ count: 2, sides: 6, modifier: -1 }, 4).count).toBe(8);
  });

  it('is the identity at Proficiency 1', () => {
    const d = { count: 2, sides: 10, modifier: 4 };
    expect(applyProficiency(d, 1)).toEqual(d);
  });

  it('never rolls fewer than one die', () => {
    expect(applyProficiency({ count: 1, sides: 8, modifier: 0 }, 0).count).toBe(1);
    expect(applyProficiency({ count: 1, sides: 8, modifier: 0 }, -3).count).toBe(1);
  });

  it('composes with parseDamage the way a weapon roll does', () => {
    const scaled = applyProficiency(parseDamage('d10+2')!, 4);
    expect(formatDamage(scaled)).toBe('4d10+2');
  });
});

describe('an undecided roll: the GM never shared the Difficulty', () => {
  it('does not announce a success nobody has granted', () => {
    const withHope = rollDuality(fixed(9, 2), refusingRng);
    expect(withHope.succeeded).toBeNull();
    expect(withHope.outcome).toBe('undecided-hope');
    expect(OUTCOME_LABEL[withHope.outcome]).not.toMatch(/Success|Failure/);

    const withFear = rollDuality(fixed(2, 9), refusingRng);
    expect(withFear.succeeded).toBeNull();
    expect(withFear.outcome).toBe('undecided-fear');
    expect(OUTCOME_LABEL[withFear.outcome]).not.toMatch(/Success|Failure/);
  });

  it('still pays out the Hope or the Fear, which the Difficulty never gated', () => {
    expect(rollDuality(fixed(9, 2), refusingRng).effects).toEqual({ hope: 1, stress: 0, gmFear: 0 });
    expect(rollDuality(fixed(2, 9), refusingRng).effects).toEqual({ hope: 0, stress: 0, gmFear: 1 });
  });

  it('is still a critical when the dice match, because a critical always succeeds', () => {
    const r = rollDuality(fixed(7, 7), refusingRng);
    expect(r.succeeded).toBe(true);
    expect(r.outcome).toBe('critical');
  });

  it('never reports undecided once a Difficulty is supplied', () => {
    const rng = seededRng(11);
    for (let i = 0; i < 400; i++) {
      expect(rollDuality({ modifier: 0, difficulty: 13 }, rng).outcome).not.toMatch(/^undecided/);
    }
  });

  it('labels and details every outcome the engine can produce', () => {
    const seen = new Set<RollOutcome>();
    const rng = seededRng(5);
    for (const difficulty of [null, 13]) {
      for (let i = 0; i < 400; i++) seen.add(rollDuality({ modifier: 0, difficulty }, rng).outcome);
    }
    expect(seen.size).toBe(7);
    for (const o of seen) {
      expect(OUTCOME_LABEL[o]).toBeTruthy();
      expect(OUTCOME_DETAIL[o]).toBeTruthy();
    }
  });
});

describe('reaction rolls', () => {
  // The SRD, verbatim: "they don't generate Hope or Fear... If you critically
  // succeed on a reaction roll, you don't clear a Stress or gain a Hope, but
  // you do ignore any effects that would have impacted you on a success."
  const fixedDice = (hope: number, fear: number) => ({
    modifier: 0,
    difficulty: 10,
    reaction: true,
    fixed: { hope, fear },
  });

  it('pay nothing, whichever die wins', () => {
    for (const [h, f] of [[10, 2], [2, 10], [12, 1], [1, 12]] as const) {
      const r = rollDuality(fixedDice(h, f));
      expect(r.reaction).toBe(true);
      expect(r.effects, `${h}/${f}`).toEqual({ hope: 0, stress: 0, gmFear: 0 });
    }
  });

  it('pay nothing on a critical either, but still succeed', () => {
    const r = rollDuality(fixedDice(7, 7));
    expect(r.critical).toBe(true);
    expect(r.succeeded).toBe(true);
    expect(r.effects).toEqual({ hope: 0, stress: 0, gmFear: 0 });
  });

  it('still resolve success and failure normally', () => {
    expect(rollDuality(fixedDice(9, 8)).succeeded).toBe(true);
    expect(rollDuality(fixedDice(2, 3)).succeeded).toBe(false);
  });

  it('leave an ordinary action roll paying as it always did', () => {
    const action = rollDuality({ modifier: 0, difficulty: 10, fixed: { hope: 10, fear: 2 } });
    expect(action.reaction).toBe(false);
    expect(action.effects).toEqual({ hope: 1, stress: 0, gmFear: 0 });
  });

  it('never promise a Hope in the readout', () => {
    const detail = outcomeDetail(rollDuality(fixedDice(10, 2)));
    expect(detail).not.toMatch(/hope|fear/i);
  });
});

/**
 * SRD 2 p12, Brawler, "I Am the Weapon": Brawler's Strike "deals d8+d6
 * physical damage using your Proficiency (both the d8 and d6 scale off your
 * Proficiency)". The one pool in the book that rolls two kinds of die.
 * `parseDamage('d8+d6')` used to answer `1d8` and drop the d6 without a word.
 */
describe('a pool of two kinds of die (Brawler’s Strike, p12)', () => {
  it('reads d8+d6 as a d8 and also a d6, rather than as a d8', () => {
    expect(parseDamage('d8+d6')).toEqual({
      count: 1,
      sides: 8,
      modifier: 0,
      also: [{ count: 1, sides: 6 }],
    });
    expect(parseDamage('2d8+2d6+3')).toEqual({
      count: 2,
      sides: 8,
      modifier: 3,
      also: [{ count: 2, sides: 6 }],
    });
    // A die subtracted is not a pool this app knows how to roll.
    expect(parseDamage('d8-d6')).toBeNull();
    // And a one-kind pool carries no `also` at all, so nothing downstream
    // starts reading an empty list as a second kind of die.
    expect(parseDamage('d8+2')).toEqual({ count: 1, sides: 8, modifier: 2 });
  });

  it('prints and round-trips as 1d8+1d6', () => {
    expect(formatDamage(parseDamage('d8+d6')!)).toBe('1d8+1d6');
    expect(formatDamage(parseDamage('1d8+1d6+2')!)).toBe('1d8+1d6+2');
  });

  it('scales both the d8 and the d6 by Proficiency (p12)', () => {
    const scaled = applyProficiency(parseDamage('d8+d6')!, 3);
    expect(scaled).toEqual({ count: 3, sides: 8, modifier: 0, also: [{ count: 3, sides: 6 }] });
    expect(formatDamage(scaled)).toBe('3d8+3d6');
  });

  it('flattens to the d8s then the d6s, and the critical adds every one of them', () => {
    const pool = applyProficiency(parseDamage('d8+d6')!, 2);
    expect(diceOf(pool)).toEqual([8, 8, 6, 6]);
    expect(highestDamage(pool)).toBe(28);
    // A one-kind pool still answers count × sides, which is what the critical
    // added before this file knew a second kind.
    expect(highestDamage({ count: 3, sides: 10, modifier: 2 })).toBe(30);
  });

  it('rolls every die of the pool with its own size, in that order', () => {
    const pool = applyProficiency(parseDamage('d8+d6')!, 2);
    const rng = scriptedRng(7, 3, 5, 2);
    const r = rollDamage(pool, { critical: true }, rng);
    expect(rng.calls).toEqual([8, 8, 6, 6]);
    expect(r.dice).toEqual([7, 3, 5, 2]);
    expect(r.criticalBonus).toBe(28);
    expect(r.total).toBe(7 + 3 + 5 + 2 + 28);
    expect(r.spec).toBe('2d8+2d6');
  });

  it('lands a typed face on the die of the same index, d6s included', () => {
    const pool = applyProficiency(parseDamage('d8+d6')!, 1);
    const r = rollDamage(pool, { fixed: [8, 6] }, refusingRng);
    expect(r.dice).toEqual([8, 6]);
    expect(r.total).toBe(14);
  });
});
