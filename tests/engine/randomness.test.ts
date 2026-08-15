/**
 * Is the die fair?
 *
 * Every other test in this suite feeds the engine fixed dice, which is the only
 * way to test a rule - and it means nothing at all here ever exercises the
 * generator itself. So this file does, against the production RNG, with no
 * seed: if `cryptoRng` were ever swapped for `Math.random()` and a modulo, or
 * the rejection loop were "simplified" away, the numbers below would move and
 * nothing else in the project would notice.
 *
 * Thresholds are chi-square quantiles at roughly p = 0.99999, so a passing
 * build fails this by chance about once in a hundred thousand runs. That is
 * deliberately far looser than the usual 0.05: a flaky test that cries wolf
 * gets deleted, and then nobody is checking the dice at all.
 */
import { describe, expect, it } from 'vitest';
import { cryptoRng, rollDamage, rollDuality } from '../../src/engine/dice.ts';

const chiSquare = (counts: readonly number[]): number => {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return counts.reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
};

/** Chi-square upper bounds at ~p=0.99999, by degrees of freedom. */
const BOUND: Record<number, number> = { 3: 25, 5: 30, 7: 35, 9: 39, 11: 45, 19: 58, 99: 168, 143: 222 };

describe('cryptoRng', () => {
  it('is uniform across every die the game uses', () => {
    for (const sides of [4, 6, 8, 10, 12, 20] as const) {
      const rolls = 20_000 * sides;
      const counts = new Array<number>(sides).fill(0);
      for (let i = 0; i < rolls; i++) counts[cryptoRng(sides) - 1]! += 1;

      const df = sides - 1;
      expect(chiSquare(counts), `d${sides} is not uniform`).toBeLessThan(BOUND[df]!);
    }
  });

  it('never returns a face the die does not have', () => {
    // The rejection loop is the whole reason this holds. A plain
    // `value % sides` would still stay in range but would favour the low
    // faces, because 2^32 is not a multiple of 12 - the bias is small, real,
    // and invisible without a test like the one above.
    for (const sides of [4, 6, 8, 10, 12, 20, 100] as const) {
      for (let i = 0; i < 20_000; i++) {
        const v = cryptoRng(sides);
        expect(Number.isInteger(v) && v >= 1 && v <= sides, `d${sides} gave ${v}`).toBe(true);
      }
    }
  });
});

describe('the Duality Roll, statistically', () => {
  const N = 200_000;

  it('criticals, Hope and Fear land where two d12s put them', () => {
    let critical = 0;
    let withHope = 0;
    const totals = new Map<number, number>();

    for (let i = 0; i < N; i++) {
      const r = rollDuality({ modifier: 0, difficulty: null });
      if (r.critical) critical += 1;
      else if (r.withHope) withHope += 1;
      totals.set(r.total, (totals.get(r.total) ?? 0) + 1);
    }

    // Matching dice: 12 of the 144 pairs. Hope higher: 66 of 144.
    expect(Math.abs(critical / N - 12 / 144), 'critical rate').toBeLessThan(0.005);
    expect(Math.abs(withHope / N - 66 / 144), 'with-Hope rate').toBeLessThan(0.006);

    // The 2d12 triangle: P(total = t) = (12 - |t - 13|) / 144.
    for (let t = 2; t <= 24; t++) {
      const theory = (12 - Math.abs(t - 13)) / 144;
      const seen = (totals.get(t) ?? 0) / N;
      expect(Math.abs(seen - theory) / theory, `total ${t}`).toBeLessThan(0.06);
    }
  });

  it('does not let the Hope die predict the Fear die', () => {
    const joint = Array.from({ length: 12 }, () => new Array<number>(12).fill(0));
    for (let i = 0; i < N; i++) {
      const r = rollDuality({ modifier: 0, difficulty: null });
      joint[r.hope - 1]![r.fear - 1]! += 1;
    }
    expect(chiSquare(joint.flat()), 'the two dice are correlated').toBeLessThan(BOUND[143]!);
  });
});

describe('damage dice', () => {
  it('average out where the arithmetic says they should', () => {
    // 3d8+4: mean 3 * 4.5 + 4 = 17.5. Five sigma over 100k rolls is ~0.06.
    const N = 100_000;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += rollDamage({ count: 3, sides: 8, modifier: 4 }).total;
    expect(Math.abs(sum / N - 17.5)).toBeLessThan(0.1);
  });

  it('adds exactly the maximum of the dice on a critical, never more', () => {
    for (let i = 0; i < 5_000; i++) {
      const r = rollDamage({ count: 2, sides: 8, modifier: 1 }, { critical: true });
      expect(r.criticalBonus).toBe(16);
      expect(r.total).toBe(r.dice.reduce((a, b) => a + b, 0) + 1 + 16);
      expect(r.total).toBeGreaterThanOrEqual(2 + 1 + 16);
      expect(r.total).toBeLessThanOrEqual(16 + 1 + 16);
    }
  });
});
