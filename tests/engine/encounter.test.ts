import { describe, expect, it } from 'vitest';
import type { AdversaryRole, Tier } from '@shared/types.ts';
import {
  MAX_FEAR,
  NO_ADJUSTMENTS,
  ROLE_COST,
  computeBudget,
  entryCost,
  makeCombatant,
  tickCountdown,
  type Countdown,
  type EncounterEntry,
} from '@engine/encounter.ts';
import { adversaryOfRole, makeAdversary } from '../fixtures/factories.ts';
import { NO_CLOCK_PROSE } from '../fixtures/factories.ts';

const entry = (role: AdversaryRole, count = 1, tier: Tier = 2): EncounterEntry => ({
  adversary: adversaryOfRole(role, tier),
  count,
});

const lineFor = (label: RegExp, budget: ReturnType<typeof computeBudget>) =>
  budget.adjustments.find((l) => label.test(l.label))!;

describe('the base budget', () => {
  it.each([
    [1, 5],
    [2, 8],
    [3, 11],
    [4, 14],
    [5, 17],
    [6, 20],
  ])('gives %i PCs %i Battle Points', (partySize, base) => {
    const b = computeBudget(partySize, 2, []);
    expect(b.base).toBe(base);
    expect(b.budget).toBe(base);
    expect(b.partySize).toBe(partySize);
  });

  it('never goes below a party of one', () => {
    expect(computeBudget(0, 2, []).base).toBe(5);
  });
});

describe('the five adjustments', () => {
  const roster = [entry('Standard'), entry('Solo')];

  it('takes one point off for an easier or shorter fight', () => {
    const b = computeBudget(4, 2, roster, { ...NO_ADJUSTMENTS, easier: true });
    expect(lineFor(/Easier/, b)).toMatchObject({ points: -1, active: true, automatic: false });
    expect(b.budget).toBe(14 - 1);
  });

  it('adds two for a harder or longer fight', () => {
    const b = computeBudget(4, 2, roster, { ...NO_ADJUSTMENTS, harder: true });
    expect(lineFor(/Harder/, b)).toMatchObject({ points: 2, active: true });
    expect(b.budget).toBe(14 + 2);
  });

  it('takes two off for bumping every adversary damage roll', () => {
    const b = computeBudget(4, 2, roster, { ...NO_ADJUSTMENTS, damageBump: true });
    // Matched on the name of the switch, not on `/\+1d4/`, which is what this
    // read until the label stopped transcribing the rule. See the label's own
    // comment: an engine that computes points has no rules layer to read, so it
    // cannot keep a quotation in step with the two screens that do.
    expect(lineFor(/extra damage/, b)).toMatchObject({ points: -2, active: true, automatic: false });
    expect(b.budget).toBe(14 - 2);
  });

  it('quotes no rule in any adjustment label, so none of them can drift', () => {
    // The guard on the paragraph above. A label carrying dice is a fourth
    // transcription of a sentence `damageBumpRule` exists to own, and the first
    // pass at this left one in - which put a stale quotation eleven lines above
    // a live one on the same screen.
    const b = computeBudget(4, 2, roster, { ...NO_ADJUSTMENTS, damageBump: true });
    for (const line of b.adjustments) {
      expect(line.label, `"${line.label}" transcribes a rule`).not.toMatch(/\dd\d|\+\d/);
    }
  });

  it('takes two off automatically for two or more Solos', () => {
    const one = computeBudget(4, 2, [entry('Solo'), entry('Standard')]);
    expect(lineFor(/Solo adversaries/, one).active).toBe(false);
    expect(one.budget).toBe(14);

    const two = computeBudget(4, 2, [entry('Solo'), entry('Solo')]);
    expect(lineFor(/Solo adversaries/, two)).toMatchObject({ active: true, automatic: true });
    expect(two.budget).toBe(14 - 2);
  });

  it('counts two Solos bought as one entry of two', () => {
    const b = computeBudget(4, 2, [entry('Solo', 2)]);
    expect(lineFor(/Solo adversaries/, b).active).toBe(true);
  });

  it('adds one automatically for an adversary from a lower tier', () => {
    const same = computeBudget(4, 2, [entry('Bruiser', 1, 2)]);
    expect(lineFor(/lower tier/, same).active).toBe(false);

    const lower = computeBudget(4, 2, [entry('Bruiser', 1, 1)]);
    expect(lineFor(/lower tier/, lower)).toMatchObject({ active: true, automatic: true, points: 1 });
    expect(lower.budget).toBe(15);
  });

  it('does not pay for an adversary from a higher tier', () => {
    expect(lineFor(/lower tier/, computeBudget(4, 2, [entry('Bruiser', 1, 4)])).active).toBe(false);
  });

  it('adds one automatically when nothing heavy is on the table', () => {
    const light = computeBudget(4, 2, [entry('Standard'), entry('Ranged'), entry('Minion')]);
    expect(lineFor(/No Bruisers/, light)).toMatchObject({ active: true, automatic: true, points: 1 });
    expect(light.budget).toBe(15);
  });

  it.each(['Bruiser', 'Horde', 'Leader', 'Solo'] as AdversaryRole[])(
    'withdraws the rebate once a %s joins',
    (role) => {
      const b = computeBudget(4, 2, [entry('Standard'), entry(role)]);
      expect(lineFor(/No Bruisers/, b).active).toBe(false);
    },
  );

  it('gives no rebate for an empty roster', () => {
    const b = computeBudget(4, 2, []);
    expect(lineFor(/No Bruisers/, b).active).toBe(false);
    expect(b.budget).toBe(14);
  });

  it('stacks every adjustment at once', () => {
    const b = computeBudget(
      4,
      3,
      [entry('Solo', 2, 2), entry('Standard', 1, 3)],
      { easier: true, harder: true, damageBump: true },
    );
    // 14 - 1 (easier) - 2 (two Solos) - 2 (damage bump) + 1 (lower tier) + 2 (harder)
    expect(b.budget).toBe(12);
    expect(b.adjustments.filter((l) => l.active)).toHaveLength(5);
  });

  it('lists every adjustment whether it applies or not, so the GM can see them', () => {
    const b = computeBudget(4, 2, []);
    expect(b.adjustments).toHaveLength(6);
    expect(b.adjustments.filter((l) => l.automatic)).toHaveLength(3);
  });
});

describe('what a roster costs', () => {
  it('prices each role', () => {
    expect(ROLE_COST).toEqual({
      Minion: 1,
      Social: 1,
      Support: 1,
      Horde: 2,
      Ranged: 2,
      Skulk: 2,
      Standard: 2,
      Leader: 3,
      Bruiser: 4,
      Solo: 5,
    });
  });

  it.each(Object.keys(ROLE_COST) as AdversaryRole[])('charges the listed cost for a %s', (role) => {
    expect(entryCost(entry(role))).toBe(ROLE_COST[role]);
  });

  it('multiplies by the count', () => {
    expect(entryCost(entry('Standard', 3))).toBe(6);
    expect(entryCost(entry('Solo', 2))).toBe(10);
  });

  it('charges a Minion group - not a Minion - one point', () => {
    // A group is as many Minions as there are PCs, so three groups cost three.
    expect(entryCost(entry('Minion', 3))).toBe(3);
  });

  it('treats a count of zero as one', () => {
    expect(entryCost(entry('Standard', 0))).toBe(2);
  });

  it('adds the roster up and reports what is left', () => {
    const roster = [entry('Solo'), entry('Standard', 2), entry('Minion', 2)];
    const b = computeBudget(4, 2, roster);
    expect(b.costs).toEqual([5, 4, 2]);
    expect(b.spent).toBe(11);
    expect(b.budget).toBe(14);
    expect(b.remaining).toBe(3);
  });

  it('goes negative when the GM overspends', () => {
    const b = computeBudget(2, 2, [entry('Solo'), entry('Bruiser')]);
    expect(b.spent).toBe(9);
    expect(b.remaining).toBe(8 - 9);
  });
});

describe('countdowns', () => {
  const cd = (over: Partial<Countdown> = {}): Countdown => ({
    id: 'c1',
    name: 'The ritual',
    kind: 'standard',
    start: 4,
    value: 4,
    notes: '',
    ...NO_CLOCK_PROSE,
    ...over,
  });

  it('ticks down and stops at zero', () => {
    expect(tickCountdown(cd(), -1).value).toBe(3);
    expect(tickCountdown(cd({ value: 1 }), -1).value).toBe(0);
    expect(tickCountdown(cd({ value: 1 }), -9).value).toBe(0);
  });

  it('ticks up but never past its starting value', () => {
    expect(tickCountdown(cd({ value: 1 }), 2).value).toBe(3);
    expect(tickCountdown(cd({ value: 3 }), 5).value).toBe(4);
  });

  it('wraps a loop countdown back to its start when it runs out', () => {
    const loop = cd({ kind: 'loop', start: 3, value: 1 });
    expect(tickCountdown(loop, -1).value).toBe(3);
    expect(tickCountdown(loop, -5).value).toBe(3);
    expect(tickCountdown(cd({ kind: 'loop', start: 3, value: 3 }), -1).value).toBe(2);
  });

  it('caps a loop countdown at its start like any other', () => {
    expect(tickCountdown(cd({ kind: 'loop', start: 3, value: 2 }), 4).value).toBe(3);
  });

  it('treats dynamic and long-term countdowns like standard ones', () => {
    for (const kind of ['dynamic', 'long-term'] as const) {
      expect(tickCountdown(cd({ kind, value: 1 }), -3).value).toBe(0);
    }
  });

  it('keeps everything else about the countdown', () => {
    const next = tickCountdown(cd({ notes: 'GM only' }), -1);
    expect(next).toMatchObject({ id: 'c1', name: 'The ritual', notes: 'GM only', start: 4 });
  });
});

describe('scene combatants', () => {
  it('copies the stat block into a fresh, unmarked combatant', () => {
    const a = makeAdversary({ hp: 7, stress: 4, difficulty: 16, thresholds: [9, 18] });
    const c = makeCombatant(a, 0, 4);
    expect(c).toMatchObject({
      id: 'test-adversary-0',
      adversaryRef: 'test-adversary',
      hp: { marked: 0, max: 7 },
      stress: { marked: 0, max: 4 },
      difficulty: 16,
      thresholds: [9, 18],
      spotlighted: false,
    });
    expect(c.minionsRemaining).toBeUndefined();
  });

  it('gives a Minion group as many Minions as there are PCs', () => {
    expect(makeCombatant(adversaryOfRole('Minion'), 2, 5).minionsRemaining).toBe(5);
  });

  it('gives each copy its own id', () => {
    const a = makeAdversary();
    expect(makeCombatant(a, 0, 4).id).not.toBe(makeCombatant(a, 1, 4).id);
  });

  it('keeps a null threshold null - some adversaries have none', () => {
    // Also the guard on the copy below: an unconditional spread of the tuple
    // reads `[...null]` for a Minion, and this is the case that goes red.
    expect(makeCombatant(makeAdversary({ thresholds: null }), 0, 4).thresholds).toBeNull();
  });

  /*
   * The stat block is copied, not lent.
   *
   * `a` is the dataset's own record - one object per adversary for the whole
   * device - and `thresholds` is the only mutable field `makeCombatant` takes
   * off it. Handing it through by reference gave every combatant ever spawned
   * from one adversary a handle on the array the bestiary draws from, and the
   * only thing standing between that and an edited book was `runScene`'s
   * `copy()`, which is being deleted with `runScene`.
   */
  it('hands out a thresholds tuple of its own, never the dataset array', () => {
    const a = makeAdversary({ thresholds: [9, 18] });
    const c = makeCombatant(a, 0, 4);
    expect(c.thresholds).toEqual([9, 18]);
    expect(c.thresholds).not.toBe(a.thresholds);
  });

  it('cannot rewrite the bestiary through a combatant it spawned', () => {
    const a = makeAdversary({ thresholds: [9, 18] });
    const c = makeCombatant(a, 0, 4);
    c.thresholds![0] = 99;
    expect(a.thresholds).toEqual([9, 18]);
  });

  it('gives two combatants from one adversary a tuple each', () => {
    // Two Acid Burrowers on one board. Marking the second must leave the first
    // where the GM last read it.
    const a = makeAdversary({ thresholds: [9, 18] });
    const first = makeCombatant(a, 0, 4);
    const second = makeCombatant(a, 1, 4);
    expect(first.thresholds).not.toBe(second.thresholds);
    second.thresholds![1] = 99;
    expect(first.thresholds).toEqual([9, 18]);
    expect(a.thresholds).toEqual([9, 18]);
  });
});

describe('GM reference values', () => {
  it('caps Fear at 12', () => {
    expect(MAX_FEAR).toBe(12);
  });

  /*
   * `has a benchmark row per tier` was here, over `TIER_BENCHMARKS`, and both
   * are gone. The coverage did not go with them - it improved. That case asked
   * the constant three questions about its own shape (four keys, `attack ===
   * tier`, ascending thresholds) and never once compared a value to the SRD,
   * which is precisely the drift it was nominally guarding against: the
   * constant had already re-worded `Major 7/Severe 12` into `[7, 12]` and
   * dropped the `+` from `+1`, and every one of those three questions still
   * passed. `tests/ui/srdReference.test.ts` now pins all sixteen cells against
   * the shipped `data/srd-1.0.json`, sign and slash included.
   */
});
