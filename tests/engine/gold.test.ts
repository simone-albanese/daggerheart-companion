import { describe, expect, it } from 'vitest';
import type { Gold } from '@shared/types.ts';
import { MAX_CHESTS, PER_STEP, ZERO_GOLD, formatGold, gain, inHandfuls, spend } from '@engine/gold.ts';

const g = (handfuls = 0, bags = 0, chests = 0): Gold => ({ handfuls, bags, chests });

describe('inHandfuls', () => {
  it('counts the whole purse in the smallest denomination', () => {
    expect(inHandfuls(ZERO_GOLD)).toBe(0);
    expect(inHandfuls(g(3))).toBe(3);
    expect(inHandfuls(g(0, 1))).toBe(10);
    expect(inHandfuls(g(0, 0, 1))).toBe(100);
    expect(inHandfuls(g(9, 9, 1))).toBe(199);
  });

  it('agrees with the ten-to-one steps', () => {
    expect(PER_STEP).toBe(10);
    expect(inHandfuls(g(0, PER_STEP))).toBe(inHandfuls(g(0, 0, 1)));
  });
});

describe('the carry', () => {
  it('turns a tenth handful into a bag and erases the handfuls', () => {
    expect(gain(g(9), { handfuls: 1 }).gold).toEqual(g(0, 1));
  });

  it('does not carry at nine', () => {
    expect(gain(g(8), { handfuls: 1 }).gold).toEqual(g(9));
  });

  it('turns a tenth bag into a chest and erases the bags', () => {
    expect(gain(g(0, 9), { bags: 1 }).gold).toEqual(g(0, 0, 1));
  });

  it('does not carry at nine bags', () => {
    expect(gain(g(0, 8), { bags: 1 }).gold).toEqual(g(0, 9));
  });

  it('carries twice in one gain', () => {
    expect(gain(g(9, 9), { handfuls: 1 }).gold).toEqual(g(0, 0, 1));
  });

  it('carries a large windfall in one go', () => {
    expect(gain(ZERO_GOLD, { handfuls: 47 }).gold).toEqual(g(7, 4));
    expect(gain(g(5, 5), { handfuls: 55 }).gold).toEqual(g(0, 1, 1));
  });

  it('flags nothing while the purse still fits', () => {
    const r = gain(g(1, 1), { bags: 2 });
    expect(r.overflowed).toBe(false);
    expect(r.insufficient).toBe(false);
  });

  it('keeps every digit in 0..9 and the chest at the cap', () => {
    for (let h = 0; h <= 9; h++) {
      for (let b = 0; b <= 9; b++) {
        for (let c = 0; c <= MAX_CHESTS; c++) {
          const r = gain(g(h, b, c), { handfuls: 1 });
          expect(r.gold.handfuls).toBeLessThan(PER_STEP);
          expect(r.gold.bags).toBeLessThan(PER_STEP);
          expect(r.gold.chests).toBeLessThanOrEqual(MAX_CHESTS);
          if (!r.overflowed) expect(inHandfuls(r.gold)).toBe(inHandfuls(g(h, b, c)) + 1);
        }
      }
    }
  });
});

describe('the one-chest cap', () => {
  it('holds at a full purse and says so', () => {
    const r = gain(g(9, 9, 1), { handfuls: 1 });
    expect(r.overflowed).toBe(true);
    expect(r.gold).toEqual(g(9, 9, 1));
  });

  it('flags any gain that would buy a second chest', () => {
    const r = gain(g(0, 0, 1), { chests: 1 });
    expect(r.overflowed).toBe(true);
    expect(r.gold).toEqual(g(9, 9, MAX_CHESTS));
  });

  it('allows exactly one chest', () => {
    const r = gain(g(0, 9, 0), { bags: 1 });
    expect(r.overflowed).toBe(false);
    expect(r.gold.chests).toBe(MAX_CHESTS);
  });
});

describe('spending', () => {
  it('takes it out of the smallest denomination first', () => {
    expect(spend(g(5, 1), { handfuls: 3 }).gold).toEqual(g(2, 1));
  });

  it('breaks a bag when the handfuls will not cover it', () => {
    expect(spend(g(0, 1), { handfuls: 1 }).gold).toEqual(g(9));
  });

  it('breaks the chest', () => {
    expect(spend(g(0, 0, 1), { bags: 1 }).gold).toEqual(g(0, 9));
    expect(spend(g(0, 0, 1), { handfuls: 1 }).gold).toEqual(g(9, 9));
  });

  it('empties the purse exactly', () => {
    const r = spend(g(9, 9, 1), { handfuls: 9, bags: 9, chests: 1 });
    expect(r.gold).toEqual(ZERO_GOLD);
    expect(r.insufficient).toBe(false);
  });

  it('refuses what it cannot cover and changes nothing', () => {
    const purse = g(2, 0, 0);
    const r = spend(purse, { handfuls: 3 });
    expect(r.insufficient).toBe(true);
    expect(r.gold).toEqual(purse);
  });

  it('refuses a bag the purse cannot break out', () => {
    const r = spend(g(9), { bags: 1 });
    expect(r.insufficient).toBe(true);
    expect(r.gold).toEqual(g(9));
  });

  it('spends nothing for free', () => {
    expect(spend(g(4, 2), {}).gold).toEqual(g(4, 2));
  });

  it('brings a purse that arrived out of range back in range', () => {
    // Nothing in the engine can build this, but an old save or a hand edit can.
    const r = spend(g(12, 3), { handfuls: 2 });
    expect(r.gold).toEqual(g(0, 4));
    expect(inHandfuls(r.gold)).toBe(40);
  });

  it('flags a purse held above the one-chest cap instead of inventing bags', () => {
    const r = spend(g(0, 0, 5), { handfuls: 1 });
    expect(r.overflowed).toBe(true);
    expect(r.gold).toEqual(g(9, 9, MAX_CHESTS));
  });

  it('keeps every digit in range whatever it is handed', () => {
    for (let held = 0; held <= 199; held += 7) {
      for (const cost of [0, 1, 10, 37, 100]) {
        const start = gain(ZERO_GOLD, { handfuls: held }).gold;
        const r = spend(start, { handfuls: cost });
        if (cost > held) {
          expect(r.insufficient).toBe(true);
          expect(r.gold).toEqual(start);
        } else {
          expect(inHandfuls(r.gold)).toBe(held - cost);
          expect(r.gold.handfuls).toBeLessThan(PER_STEP);
          expect(r.gold.bags).toBeLessThan(PER_STEP);
          expect(r.gold.chests).toBeLessThanOrEqual(MAX_CHESTS);
        }
      }
    }
  });
});

describe('formatGold', () => {
  it('reads the purse out loud', () => {
    expect(formatGold(ZERO_GOLD)).toBe('no gold');
    expect(formatGold(g(1))).toBe('1 handful');
    expect(formatGold(g(2))).toBe('2 handfuls');
    expect(formatGold(g(0, 1))).toBe('1 bag');
    expect(formatGold(g(3, 2, 1))).toBe('1 chest · 2 bags · 3 handfuls');
  });

  it('leaves out the denominations that are empty', () => {
    expect(formatGold(g(0, 5, 0))).toBe('5 bags');
  });
});

describe('a gain that is not a gain', () => {
  it('refuses a negative amount and leaves the purse alone', () => {
    const purse = g(5, 0, 0);
    for (const amount of [{ handfuls: -8 }, { bags: -1 }, { chests: -1 }, { handfuls: -1, bags: 2 }]) {
      const r = gain(purse, amount);
      expect(r.insufficient).toBe(true);
      expect(r.gold).toEqual(purse);
    }
  });

  it('never hands back a denomination outside 0..9', () => {
    // A per-digit carry gets Math.floor and % wrong for negatives: this used to
    // come back as { handfuls: -3, bags: -1, chests: -1 } with nothing flagged.
    for (const amount of [-1, -8, -47, -250]) {
      const r = gain(g(5), { handfuls: amount });
      expect(r.gold.handfuls).toBeGreaterThanOrEqual(0);
      expect(r.gold.bags).toBeGreaterThanOrEqual(0);
      expect(r.gold.chests).toBeGreaterThanOrEqual(0);
      expect(inHandfuls(r.gold)).toBe(5);
    }
  });

  it('still adds a mixed amount whose parts are all positive', () => {
    expect(gain(g(1, 1), { handfuls: 2, bags: 3 }).gold).toEqual(g(3, 4));
  });
});
