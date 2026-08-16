/**
 * Attack, then damage — the link the app never had.
 *
 * `rollDamage` has been correct and tested since the first commit and has
 * never had a caller outside its own tests, so no screen in this app has ever
 * rolled damage. The critical that the Duality Roll works out was discarded a
 * line after it was computed, which is exactly the join the SRD rule is about:
 * *"On a successful attack, roll damage"*, and *"a critical success would deal
 * 2d8+1+16"*.
 *
 * Most of what is below guards the three-valued `succeeded`. The engine
 * returns `null` when the GM has not shared the Difficulty, on purpose and
 * with a comment saying why, and the obvious `if (result.succeeded)` reads
 * that null as a miss. That single character of sloppiness would mean every
 * table that keeps its Difficulties hidden — which the SRD explicitly allows —
 * could never roll damage at all, and it would look like a design decision
 * rather than a bug. So the null case is tested first and hardest.
 *
 * The other trap is the critical bonus. It is the maximum of the dice you
 * actually roll, and the dice you actually roll are the weapon's count times
 * Proficiency. A d8+1 weapon at Proficiency 3 is 3d8+1 and the critical adds
 * 24, not 8. Printing the unscaled number would be wrong in a way that reads
 * as perfectly plausible at the table, which is the worst kind.
 */
import { describe, expect, it } from 'vitest';
import { rollDamage, seededRng, type DamageDice } from '../../src/engine/dice.ts';
import {
  damageOffer,
  isRollableDamage,
  sourceFromWeapon,
  sourceName,
  unarmedSource,
  type ArmedAttack,
  type AttackSource,
} from '../../src/ui/player/attack.ts';
import { makeStats, makeWeapon } from '../fixtures/factories.ts';

const weaponSource = (damage: string, proficiency: number): AttackSource => {
  const source = sourceFromWeapon(
    makeWeapon({ damage, name: 'Longsword' }),
    makeStats({ proficiency }),
  );
  if (source === null) throw new Error(`weapon damage did not parse: ${damage}`);
  return source;
};

const attack = (over: Partial<ArmedAttack> = {}): ArmedAttack => ({
  source: weaponSource('d10+3', 3),
  critical: false,
  succeeded: true,
  outcome: 'success-hope',
  reaction: false,
  proficiency: 3,
  ...over,
});

describe('what the attack carries', () => {
  it('scales the die count by Proficiency and leaves the modifier alone', () => {
    // The SRD's own worked example, in the rule text: "a PC with Proficiency 2
    // and wielding a weapon with a damage rating of d8+2 deals damage equal to
    // 2d8+2".
    const source = weaponSource('d8+2', 2);
    expect(source.damage).toEqual({ count: 2, sides: 8, modifier: 2 });
  });

  it('keeps the modifier on a weapon written with spaces', () => {
    // Why this goes through weaponDamage and not the regex Play.tsx used: that
    // one matched `^(\d*)d` and would have dropped nothing here, but the
    // comment at sheetModel.ts:249 is about exactly this shape.
    const source = weaponSource('d10 + 2', 3);
    expect(source.damage).toEqual({ count: 3, sides: 10, modifier: 2 });
  });

  it('refuses a weapon whose damage will not parse rather than guessing', () => {
    expect(sourceFromWeapon(makeWeapon({ damage: 'special' }), makeStats({ proficiency: 2 }))).toBeNull();
  });

  it('gives unarmed attacks [Proficiency]d4', () => {
    // "Successful unarmed attacks inflict [Proficiency]d4 damage."
    expect(unarmedSource(makeStats({ proficiency: 4 })).damage).toEqual({
      count: 4,
      sides: 4,
      modifier: 0,
    });
    expect(sourceName(unarmedSource(makeStats({ proficiency: 1 })))).toBe('Unarmed');
  });
});

describe('when damage is offered', () => {
  it('offers it on a plain success', () => {
    const offer = damageOffer(attack({ succeeded: true }));
    expect(offer.show).toBe(true);
    expect(offer.tone).toBe('hit');
    expect(offer.label).toContain('3d10+3');
  });

  it('still offers it when the GM kept the Difficulty to themselves', () => {
    /*
     * The case a truthiness check silently drops. `succeeded` is null, not
     * false: nothing has missed, the verdict simply has not been given. The
     * offer must appear and must not claim a hit.
     */
    const offer = damageOffer(attack({ succeeded: null, outcome: 'undecided-hope' }));
    expect(offer.show).toBe(true);
    expect(offer.tone).toBe('unknown');
    expect(offer.label).toMatch(/if it hit/i);
    expect(offer.detail).toMatch(/gm says/i);
    // And it must not assert the verdict it does not have. `hit` is the tone
    // that means "this landed"; this one is conditional and says so.
    expect(offer.tone).not.toBe('hit');
    expect(offer.label).toMatch(/^IF IT HIT/);
  });

  it('says a miss out loud instead of rendering nothing', () => {
    const offer = damageOffer(attack({ succeeded: false, outcome: 'failure-fear' }));
    expect(offer.show).toBe(false);
    expect(offer.tone).toBe('miss');
    // A blank where a button was is an absence the screen does not admit to.
    expect(offer.label).toMatch(/missed/i);
  });

  it('never offers damage for a reaction roll, critical or not', () => {
    // An attack roll is "an action roll intended to inflict harm"; a reaction
    // roll is not one. Without this gate a critical reaction would offer
    // critical damage and "a reaction roll pays nothing" at the same time.
    for (const succeeded of [true, false, null]) {
      for (const critical of [true, false]) {
        const offer = damageOffer(attack({ reaction: true, succeeded, critical }));
        expect(offer.show).toBe(false);
        expect(offer.tone).toBe('reaction');
      }
    }
  });
});

describe('the critical', () => {
  it('adds the maximum of the dice actually rolled, not of the printed weapon', () => {
    // d10+3 at Proficiency 3 is 3d10+3, so the critical adds 30. Reading the
    // bonus off the unscaled weapon would say 10 - a wrong number that looks
    // completely reasonable.
    const offer = damageOffer(attack({ critical: true }));
    expect(offer.label).toContain('3d10+3');
    expect(offer.label).toContain('+30');
    expect(offer.label).not.toContain('+10');
  });

  it('matches the SRD example when the engine rolls it', () => {
    // "if an attack would normally deal 2d8+1 damage, a critical success would
    // deal 2d8+1+16."
    const dice: DamageDice = { count: 2, sides: 8, modifier: 1 };
    const rolled = rollDamage(dice, { critical: true, fixed: [3, 5] }, seededRng(1));
    expect(rolled.criticalBonus).toBe(16);
    expect(rolled.total).toBe(3 + 5 + 1 + 16);
  });

  it('offers on a critical even with no Difficulty, because the engine says it succeeded', () => {
    // dice.ts: `succeeded = critical ? true : difficulty === null ? null : ...`
    // A critical always hits, so it always offers.
    const offer = damageOffer(attack({ critical: true, succeeded: true, outcome: 'critical' }));
    expect(offer.show).toBe(true);
    expect(offer.tone).toBe('hit');
  });
});

describe('rollable damage', () => {
  it('accepts a real pool and refuses a degenerate one', () => {
    expect(isRollableDamage({ count: 3, sides: 10, modifier: 3 })).toBe(true);
    expect(isRollableDamage({ count: 0, sides: 10, modifier: 0 })).toBe(false);
    expect(isRollableDamage({ count: 2, sides: 1, modifier: 0 })).toBe(false);
    expect(isRollableDamage({ count: 2, sides: 8, modifier: Number.NaN })).toBe(false);
  });
});
