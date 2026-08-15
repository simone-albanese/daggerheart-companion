/**
 * Gold.
 *
 * Ten handfuls to a bag, ten bags to a chest, and never more than one chest.
 * The carry is not quite a base-10 number: gaining a tenth handful marks a bag
 * and *erases* the handfuls, so the sheet only ever shows 0-9 in the lower
 * denominations. The optional coin rule adds one more digit below.
 */
import type { Gold } from '../../shared/types.ts';

export const PER_STEP = 10;
export const MAX_CHESTS = 1;

export interface GoldWithCoins extends Gold {
  /** Optional rule: 10 coins to a handful. Undefined when the table is not using it. */
  coins?: number;
}

export const ZERO_GOLD: Gold = { handfuls: 0, bags: 0, chests: 0 };

/** Total value expressed in handfuls, for comparisons and prices. */
export const inHandfuls = (g: Gold): number =>
  g.handfuls + g.bags * PER_STEP + g.chests * PER_STEP * PER_STEP;

export interface GoldChange {
  gold: Gold;
  /** True when the purse was already full and the gain had nowhere to go. */
  overflowed: boolean;
  /** True when a spend could not be covered. */
  insufficient: boolean;
}

/** The largest purse the sheet can hold: one chest, nine bags, nine handfuls. */
const CAP = (MAX_CHESTS + 1) * PER_STEP * PER_STEP - 1;

/**
 * Carry a purse back into range.
 *
 * Works from the total rather than digit by digit, because a per-digit carry
 * gets `Math.floor` and `%` wrong for negatives and hands back an impossible
 * purse - `{ handfuls: -3, bags: -1 }` - with nothing flagged.
 */
function normalize(handfuls: number, bags: number, chests: number): GoldChange {
  const total = handfuls + bags * PER_STEP + chests * PER_STEP * PER_STEP;

  // A loss bigger than the purse. Say so rather than inventing a negative digit.
  if (total < 0) return { gold: { ...ZERO_GOLD }, overflowed: false, insufficient: true };

  // The purse is full: keep it at the cap rather than inventing storage.
  const overflowed = total > CAP;
  const held = overflowed ? CAP : total;

  return {
    gold: {
      handfuls: held % PER_STEP,
      bags: Math.floor(held / PER_STEP) % PER_STEP,
      chests: Math.floor(held / (PER_STEP * PER_STEP)),
    },
    overflowed,
    insufficient: false,
  };
}

/**
 * Add gold.
 *
 * A negative amount is not a gain: it is reported and the purse is left alone,
 * rather than clamped to zero - silently treating "lose 8 handfuls" as "gain
 * nothing" hides the caller's mistake behind a purse that looks correct.
 * Removing gold is `spend`, which knows how to break a bag.
 */
export function gain(g: Gold, amount: Partial<Gold>): GoldChange {
  const h = amount.handfuls ?? 0;
  const b = amount.bags ?? 0;
  const c = amount.chests ?? 0;
  if (h < 0 || b < 0 || c < 0) return { gold: g, overflowed: false, insufficient: true };
  return normalize(g.handfuls + h, g.bags + b, g.chests + c);
}

export function spend(g: Gold, amount: Partial<Gold>): GoldChange {
  const have = inHandfuls(g);
  const cost = inHandfuls({
    handfuls: amount.handfuls ?? 0,
    bags: amount.bags ?? 0,
    chests: amount.chests ?? 0,
  });
  if (cost > have) return { gold: g, overflowed: false, insufficient: true };

  // Back through the same carry a gain uses, so a purse that arrived over the
  // cap - from an old save or a hand edit - comes back in range and flagged
  // rather than as an impossible "40 bags".
  return normalize(have - cost, 0, 0);
}

export const formatGold = (g: Gold): string => {
  const parts: string[] = [];
  if (g.chests > 0) parts.push(`${g.chests} chest${g.chests === 1 ? '' : 's'}`);
  if (g.bags > 0) parts.push(`${g.bags} bag${g.bags === 1 ? '' : 's'}`);
  if (g.handfuls > 0) parts.push(`${g.handfuls} handful${g.handfuls === 1 ? '' : 's'}`);
  return parts.length > 0 ? parts.join(' · ') : 'no gold';
};
