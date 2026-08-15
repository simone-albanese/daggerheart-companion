import { describe, expect, it } from 'vitest';
import {
  DOWNTIME_MOVES,
  movesFor,
  mustTakeLongRest,
  takeRest,
  type DowntimeChoice,
} from '@engine/rest.ts';
import { makeCharacter, makeStats, refusingRng, scriptedRng } from '../fixtures/factories.ts';

const stats = makeStats({ tier: 2 });

const hurt = () =>
  makeCharacter({
    hp: { marked: 5, max: 6 },
    stress: { marked: 5, max: 6 },
    armorSlots: { marked: 3, max: 4 },
    hope: { marked: 1, max: 6 },
  });

const rest = (
  choices: DowntimeChoice[],
  kind: 'short' | 'long' = 'short',
  c = hurt(),
  options = { fixedFear: 1 },
) => takeRest(c, stats, kind, choices, options, refusingRng);

describe('the move list', () => {
  it('splits into short and long rest moves', () => {
    expect(movesFor('short').map((m) => m.id)).toEqual([
      'tend-to-wounds',
      'clear-stress',
      'repair-armor',
      'prepare',
    ]);
    expect(movesFor('long').map((m) => m.id)).toEqual([
      'tend-to-all-wounds',
      'clear-all-stress',
      'repair-all-armor',
      'prepare-long',
      'work-on-a-project',
    ]);
    expect(movesFor('short').length + movesFor('long').length).toBe(DOWNTIME_MOVES.length);
  });

  it('marks Work on a Project as the one move the app does not apply', () => {
    expect(DOWNTIME_MOVES.filter((m) => !m.mechanical).map((m) => m.id)).toEqual([
      'work-on-a-project',
    ]);
  });
});

describe('short rest moves', () => {
  it('Tend to Wounds clears 1d4 + Tier Hit Points', () => {
    const c = makeCharacter({ hp: { marked: 6, max: 6 } });
    const out = rest([{ move: 'tend-to-wounds', fixedRoll: 3 }], 'short', c);
    expect(out.character.hp.marked).toBe(6 - (3 + 2));
    expect(out.log[0]).toContain('cleared 5 HP');
  });

  it('Clear Stress clears 1d4 + Tier Stress', () => {
    const out = rest([{ move: 'clear-stress', fixedRoll: 2 }]);
    expect(out.character.stress.marked).toBe(5 - (2 + 2));
  });

  it('Repair Armor clears 1d4 + Tier Armor Slots', () => {
    const out = rest([{ move: 'repair-armor', fixedRoll: 1 }]);
    expect(out.character.armorSlots.marked).toBe(0);
  });

  it('Prepare grants a Hope, or two with the party', () => {
    expect(rest([{ move: 'prepare' }]).character.hope.marked).toBe(2);
    expect(rest([{ move: 'prepare', withParty: true }]).character.hope.marked).toBe(3);
  });

  it('never clears past zero', () => {
    const c = makeCharacter({
      hp: { marked: 1, max: 6 },
      stress: { marked: 0, max: 6 },
      armorSlots: { marked: 1, max: 4 },
    });
    const out = rest(
      [
        { move: 'tend-to-wounds', fixedRoll: 4 },
        { move: 'clear-stress', fixedRoll: 4 },
      ],
      'short',
      c,
    );
    expect(out.character.hp.marked).toBe(0);
    expect(out.character.stress.marked).toBe(0);
    expect(out.log[0]).toContain('cleared 1 HP');
    expect(out.log[1]).toContain('cleared 0 Stress');
  });

  it('never gains Hope past the maximum', () => {
    const c = makeCharacter({ hope: { marked: 5, max: 6 } });
    const out = rest([{ move: 'prepare', withParty: true }], 'short', c);
    expect(out.character.hope.marked).toBe(6);
    expect(out.log[0]).toContain('gained 1 Hope');
  });
});

describe('long rest moves', () => {
  it('Tend to All Wounds clears the whole Hit Point track', () => {
    const out = rest([{ move: 'tend-to-all-wounds' }], 'long');
    expect(out.character.hp.marked).toBe(0);
    expect(out.log[0]).toContain('cleared 5 HP');
  });

  it('Clear All Stress and Repair All Armor clear their tracks', () => {
    const out = rest([{ move: 'clear-all-stress' }, { move: 'repair-all-armor' }], 'long');
    expect(out.character.stress.marked).toBe(0);
    expect(out.character.armorSlots.marked).toBe(0);
  });

  it('Prepare grants the same Hope on the long rest', () => {
    expect(rest([{ move: 'prepare-long' }], 'long').character.hope.marked).toBe(2);
    expect(rest([{ move: 'prepare-long', withParty: true }], 'long').character.hope.marked).toBe(3);
  });

  it('Work on a Project touches nothing and leaves a line for the GM', () => {
    const c = hurt();
    const out = rest([{ move: 'work-on-a-project' }], 'long', c);
    expect(out.character.hp).toEqual(c.hp);
    expect(out.character.stress).toEqual(c.stress);
    expect(out.log[0]).toMatch(/countdown/);
  });
});

describe('two moves per rest', () => {
  it('applies at most two, in order', () => {
    const out = rest([
      { move: 'clear-stress', fixedRoll: 1 },
      { move: 'repair-armor', fixedRoll: 1 },
      { move: 'tend-to-wounds', fixedRoll: 4 },
    ]);
    expect(out.log).toHaveLength(2);
    expect(out.character.stress.marked).toBe(2);
    expect(out.character.armorSlots.marked).toBe(0);
    expect(out.character.hp.marked).toBe(5); // the third move never happened
  });

  it('lets the same move be taken twice', () => {
    const out = rest([
      { move: 'clear-stress', fixedRoll: 1 },
      { move: 'clear-stress', fixedRoll: 1 },
    ]);
    // 3 cleared, then the last 2.
    expect(out.character.stress.marked).toBe(0);
    expect(out.log).toEqual([
      'Clear Stress: cleared 3 Stress (d4 1 + tier 2)',
      'Clear Stress: cleared 2 Stress (d4 1 + tier 2)',
    ]);
  });

  it('applies none when none were chosen', () => {
    const c = hurt();
    const out = rest([], 'short', c);
    expect(out.log).toEqual([]);
    expect(out.character.hp).toEqual(c.hp);
  });
});

describe('the dice a rest rolls', () => {
  it('rolls a d4 per move that needs one, and one for the GM', () => {
    const rng = scriptedRng(2, 3, 4);
    const out = takeRest(
      hurt(),
      stats,
      'short',
      [{ move: 'clear-stress' }, { move: 'repair-armor' }],
      {},
      rng,
    );
    expect(rng.calls).toEqual([4, 4, 4]);
    expect(out.character.stress.marked).toBe(5 - (2 + 2));
    expect(out.character.armorSlots.marked).toBe(0);
    expect(out.gmFear).toBe(4);
  });

  it('rolls nothing for a move that was given a fixed die', () => {
    const rng = scriptedRng(3);
    const out = takeRest(hurt(), stats, 'short', [{ move: 'clear-stress', fixedRoll: 1 }], {}, rng);
    expect(rng.calls).toEqual([4]); // only the GM's Fear
    expect(out.gmFear).toBe(3);
  });

  it('rolls nothing at all when the table supplies every die', () => {
    const out = takeRest(
      hurt(),
      stats,
      'long',
      [{ move: 'clear-all-stress' }],
      { fixedFear: 2, partySize: 3 },
      refusingRng,
    );
    expect(out.gmFear).toBe(5);
  });
});

describe('the Fear the GM gains', () => {
  it('is 1d4 on a short rest', () => {
    for (const roll of [1, 2, 3, 4]) {
      const out = takeRest(hurt(), stats, 'short', [], { fixedFear: roll, partySize: 4 }, refusingRng);
      expect(out.gmFear).toBe(roll);
    }
  });

  it('is 1d4 plus the party size on a long rest', () => {
    for (const size of [1, 3, 5]) {
      const out = takeRest(hurt(), stats, 'long', [], { fixedFear: 2, partySize: size }, refusingRng);
      expect(out.gmFear).toBe(2 + size);
    }
  });

  it('assumes a party of one when nobody said', () => {
    expect(takeRest(hurt(), stats, 'long', [], { fixedFear: 2 }, refusingRng).gmFear).toBe(3);
  });
});

describe('mustTakeLongRest', () => {
  it('turns true on the third short rest in a row', () => {
    expect(mustTakeLongRest(0)).toBe(false);
    expect(mustTakeLongRest(2)).toBe(false);
    expect(mustTakeLongRest(3)).toBe(true);
    expect(mustTakeLongRest(4)).toBe(true);
  });
});

describe('the rest itself', () => {
  it('leaves the character it was given untouched', () => {
    const c = hurt();
    rest([{ move: 'clear-stress', fixedRoll: 4 }], 'short', c);
    expect(c.stress.marked).toBe(5);
  });

  it('stamps updatedAt', () => {
    const out = rest([{ move: 'prepare' }]);
    expect(Number.isNaN(Date.parse(out.character.updatedAt))).toBe(false);
  });
});

describe('a move from the other rest', () => {
  it('refuses a long-rest move on a short rest instead of clearing the whole track', () => {
    const c = makeCharacter({ hp: { marked: 6, max: 6 }, stress: { marked: 6, max: 6 } });
    const out = rest([{ move: 'tend-to-all-wounds' }, { move: 'clear-all-stress' }], 'short', c);
    expect(out.character.hp.marked).toBe(6);
    expect(out.character.stress.marked).toBe(6);
    expect(out.log).toEqual([
      'Tend to All Wounds is not a short rest move - not applied',
      'Clear All Stress is not a short rest move - not applied',
    ]);
  });

  it('refuses a short-rest move on a long rest', () => {
    const out = rest([{ move: 'clear-stress', fixedRoll: 4 }], 'long');
    expect(out.character.stress.marked).toBe(5);
    expect(out.log[0]).toMatch(/not a long rest move/);
  });

  it('still gives the GM their Fear for a rest whose moves were all refused', () => {
    const out = rest([{ move: 'clear-all-stress' }], 'short');
    expect(out.gmFear).toBe(1);
  });

  it('accepts every move the rest actually offers', () => {
    // Ties DOWNTIME_MOVES to takeRest: anything movesFor() hands the UI must
    // be a move takeRest will apply, or the two lists have drifted apart.
    for (const kind of ['short', 'long'] as const) {
      for (const move of movesFor(kind)) {
        const out = rest([{ move: move.id, fixedRoll: 1 }], kind);
        expect(out.log[0], `${move.id} on a ${kind} rest`).not.toMatch(/not applied/);
      }
    }
  });
});
