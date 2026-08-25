import { describe, expect, it } from 'vitest';
import {
  DOWNTIME_MOVES,
  FEAR_DIE,
  fearFromRest,
  movesFor,
  mustTakeLongRest,
  takeRest,
  type DowntimeChoice,
} from '@engine/rest.ts';
import type { Character } from '@shared/types.ts';
import { companionIsAway, newCompanion } from '@engine/companion.ts';
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

  /*
   * The formula came out of `takeRest` so the GM's side could read it: their
   * rest control has a party size and a die and no `Character` at all, so it
   * cannot call `takeRest` and would otherwise have written the sentence out a
   * second time.
   *
   * Every face against every party size a table plausibly has, rather than a
   * sample, because the whole content of this function is which of two branches
   * adds the second number.
   */
  it('is the same formula over every face and every party size', () => {
    for (const roll of [1, 2, 3, 4]) {
      for (const size of [1, 2, 3, 4, 5, 6]) {
        expect(fearFromRest('short', roll, size)).toBe(roll);
        expect(fearFromRest('long', roll, size)).toBe(roll + size);
      }
    }
  });

  /*
   * The one that actually bites. Two copies of a formula written from the same
   * sentence agree by accident, and go on agreeing until somebody edits one of
   * them - at which point every test written against either copy still passes.
   * This is red the day the arithmetic goes back inside `takeRest`.
   */
  it('cannot drift from the copy inside takeRest', () => {
    for (const kind of ['short', 'long'] as const) {
      for (const roll of [1, 2, 3, 4]) {
        for (const size of [1, 4, 6]) {
          const out = takeRest(hurt(), stats, kind, [], { fixedFear: roll, partySize: size }, refusingRng);
          expect(out.gmFear).toBe(fearFromRest(kind, roll, size));
        }
      }
    }
  });

  it('is rolled on the die both surfaces name', () => {
    // A `4` typed into the GM's face picker beside the `rng(4)` here would be
    // two copies of one number, which is what the constant is for.
    expect(FEAR_DIE).toBe(4);
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

/**
 * The number `mustTakeLongRest` reads, and who writes it.
 *
 * It is written here rather than by a caller because the read is here: a screen
 * that forgot to increment would leave the refusal permanently unreachable,
 * which is the state this field was added out of.
 */
describe('counting the rests', () => {
  const at = (n: number) => makeCharacter({ consecutiveShortRests: n });

  it('counts a short rest and clears the count on a long one', () => {
    expect(rest([], 'short', at(0)).character.consecutiveShortRests).toBe(1);
    expect(rest([], 'short', at(2)).character.consecutiveShortRests).toBe(3);
    expect(rest([], 'long', at(3)).character.consecutiveShortRests).toBe(0);
    // A long rest clears it even when there was nothing to clear.
    expect(rest([], 'long', at(0)).character.consecutiveShortRests).toBe(0);
  });

  it('counts the rest once, whatever happened inside it', () => {
    // No moves, two moves, and two moves from the wrong rest that were refused
    // outright: one rest is one rest. Counting inside the choices loop would
    // give 0, 2 and 2.
    expect(rest([], 'short', at(0)).character.consecutiveShortRests).toBe(1);
    expect(
      rest([{ move: 'clear-stress', fixedRoll: 1 }, { move: 'repair-armor', fixedRoll: 1 }], 'short', at(0))
        .character.consecutiveShortRests,
    ).toBe(1);

    const refused = rest(
      [{ move: 'tend-to-all-wounds' }, { move: 'clear-all-stress' }],
      'short',
      at(0),
    );
    expect(refused.log.every((line) => line.includes('not applied'))).toBe(true);
    expect(refused.character.consecutiveShortRests).toBe(1);
  });

  it('reports the count and does not police it', () => {
    // Refusing is a sentence on a screen, and this file has no screen. A short
    // rest asked for at 3 is applied in full and comes back at 4, so the caller
    // is told what happened rather than being quietly given nothing.
    const spent = at(3);
    expect(mustTakeLongRest(spent.consecutiveShortRests)).toBe(true);

    const out = takeRest(
      { ...spent, stress: { marked: 5, max: 6 } },
      stats,
      'short',
      [{ move: 'clear-stress', fixedRoll: 4 }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.stress.marked).toBe(0);
    expect(out.log[0]).toContain('cleared 5 Stress');
    expect(out.character.consecutiveShortRests).toBe(4);
    expect(mustTakeLongRest(out.character.consecutiveShortRests)).toBe(true);
  });
});

describe('the rest itself', () => {
  it('leaves the character it was given untouched', () => {
    const c = makeCharacter({
      hp: { marked: 5, max: 6 },
      stress: { marked: 5, max: 6 },
      consecutiveShortRests: 2,
    });
    rest([{ move: 'clear-stress', fixedRoll: 4 }], 'short', c);
    expect(c.stress.marked).toBe(5);
    // The rest count is the one field `takeRest` writes without a move having
    // asked it to, so it is the one most likely to be written in place.
    expect(c.consecutiveShortRests).toBe(2);
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

/**
 * The Beastbound's other creature, which a rest never touched.
 *
 * *"When you choose a downtime move that clears Stress on yourself, your
 * companion clears an equal number of Stress"*, and *"they remain unavailable
 * until the start of your next long rest, where they return with 1 Stress
 * cleared."* Neither sentence was anywhere in `src/`, so a Ranger who rested
 * came back to an animal carrying every mark it had taken.
 */
describe('a rest, for the companion too', () => {
  const withCompanion = (marked: number, max = 3, over: Partial<Character> = {}) =>
    makeCharacter({
      hp: { marked: 5, max: 6 },
      stress: { marked: 5, max: 6 },
      armorSlots: { marked: 3, max: 4 },
      hope: { marked: 1, max: 6 },
      companion: { ...newCompanion('Ashfoot', 'A grey wolf'), stress: { marked, max } },
      ...over,
    });

  it('clears their Stress alongside yours, by the number you cleared', () => {
    // d4 of 2 plus tier 2 is 4, and the character had 5 marked, so 4 came off
    // both tracks.
    //
    // 3 of 4 and not 3 of 3: at 3 of 3 this companion is already OUT OF THE
    // SCENE, and asserting that a short rest empties their track is asserting
    // the one thing the rule below forbids. That is what this test used to do.
    const out = takeRest(
      withCompanion(3, 4),
      stats,
      'short',
      [{ move: 'clear-stress', fixedRoll: 2 }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.stress.marked).toBe(1);
    expect(out.character.companion?.stress.marked).toBe(0);
    expect(out.log.join('\n')).toContain('Ashfoot: cleared 3 Stress alongside you');
  });

  it('leaves a companion who is out of the scene out of it', () => {
    /*
     * *"They remain unavailable until the start of your next long rest."*
     *
     * The app printed that sentence on the companion panel and then took it
     * back on the next short rest: `clear-stress` cleared the animal's track
     * with no guard, `companionIsAway` is purely derived, so any clear at all
     * ended the away state - the attack came back, the banner vanished, the
     * GM's board un-greyed. A rule the app states and then breaks is worse
     * than a rule it never states.
     *
     * The character still clears their own. Only the animal is left alone.
     */
    const out = takeRest(
      withCompanion(3),
      stats,
      'short',
      [{ move: 'clear-stress', fixedRoll: 2 }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.stress.marked).toBe(1);
    expect(out.character.companion?.stress.marked).toBe(3);
    expect(companionIsAway(out.character.companion!)).toBe(true);
    expect(out.log.join('\n')).not.toContain('alongside you');
    expect(out.log.join('\n')).toContain('Ashfoot: out of the scene until your next long rest');
  });

  it('still clears them on a long rest, because the return runs first', () => {
    /*
     * The guard above must not reach the long rest, and it does not: the
     * return at the top of `takeRest` puts them back with 1 Stress cleared
     * BEFORE any move resolves, so by the time the move's own clear arrives
     * they are in the scene and it lands on them like any other.
     *
     * 3 of 3 marked, away. The return takes them to 2, then Clear All Stress
     * clears the character's 5 and an equal number off the animal - which is
     * more than they have left, so the track empties.
     */
    const out = takeRest(
      withCompanion(3),
      stats,
      'long',
      [{ move: 'clear-all-stress' }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.companion?.stress.marked).toBe(0);
    expect(companionIsAway(out.character.companion!)).toBe(false);
    expect(out.log.join('\n')).toContain('returns to the scene with 1 Stress cleared');
    expect(out.log.join('\n')).toContain('alongside you');
  });

  it('never clears them more than the character actually cleared', () => {
    // The character has 1 Stress marked and rolls plenty. They clear 1, so the
    // companion clears 1 - not the 4 the move produced. The reading is written
    // out over `clearCompanionStress`.
    //
    // 3 of 4, so the animal is in the scene: at 3 of 3 they are out of it and
    // clear nothing at all, which is a different rule and is tested above.
    const out = takeRest(
      withCompanion(3, 4, { stress: { marked: 1, max: 6 } }),
      stats,
      'short',
      [{ move: 'clear-stress', fixedRoll: 2 }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.stress.marked).toBe(0);
    expect(out.character.companion?.stress.marked).toBe(2);
  });

  it('clears them on the long rest’s move as well', () => {
    const out = takeRest(
      withCompanion(2),
      stats,
      'long',
      [{ move: 'clear-all-stress' }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.stress.marked).toBe(0);
    expect(out.character.companion?.stress.marked).toBe(0);
  });

  it('brings an absent companion back at the start of a long rest', () => {
    const out = takeRest(
      withCompanion(3),
      stats,
      'long',
      [{ move: 'tend-to-all-wounds' }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.companion?.stress.marked).toBe(2);
    expect(out.log[0]).toBe('Ashfoot: returns to the scene with 1 Stress cleared');
  });

  it('brings them back BEFORE the moves, so the move’s clear lands on them too', () => {
    /*
     * The order is the rule, not tidiness, and this is the case that can tell.
     *
     * The character has ONE Stress marked, so Clear All Stress clears one, and
     * the companion therefore clears one. Return first and the companion goes
     * 3 -> 2 -> 1. Return afterwards and they go 3 -> 2, and then are no longer
     * away so nothing brings them back at all: they walk into the next scene on
     * their last Stress.
     *
     * The obvious version of this test - a healthy character clearing five -
     * lands on 0 either way and proves nothing. It was written that way first.
     */
    const out = takeRest(
      withCompanion(3, 3, { stress: { marked: 1, max: 6 } }),
      stats,
      'long',
      [{ move: 'clear-all-stress' }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.companion?.stress.marked).toBe(1);
  });

  it('does not bring anyone back on a short rest', () => {
    const out = takeRest(
      withCompanion(3),
      stats,
      'short',
      [{ move: 'tend-to-wounds', fixedRoll: 1 }],
      { fixedFear: 1 },
      refusingRng,
    );
    expect(out.character.companion?.stress.marked).toBe(3);
    expect(out.log.join('\n')).not.toContain('returns to the scene');
  });

  it('says nothing about a companion on a sheet that has none', () => {
    const out = rest([{ move: 'clear-stress', fixedRoll: 2 }]);
    expect(out.log.join('\n')).not.toContain('alongside you');
  });
});
