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
import type { DerivedStats } from '../../src/engine/character.ts';
import { formatDamage, rollDamage, seededRng, type DamageDice } from '../../src/engine/dice.ts';
import {
  damageArithmetic,
  damageLogEntry,
  damageOffer,
  damageTypeOf,
  isRollableDamage,
  sourceFromWeapon,
  sourceName,
  spellcastDamage,
  spellcastSource,
  unarmedSource,
  type ArmedAttack,
  type AttackSource,
} from '../../src/ui/player/attack.ts';
import { makeStats, makeWeapon, traits } from '../fixtures/factories.ts';

const weaponSource = (damage: string, proficiency: number): AttackSource => {
  const source = sourceFromWeapon(
    makeWeapon({ damage, name: 'Longsword' }),
    makeStats({ proficiency }),
  );
  if (source === null) throw new Error(`weapon damage did not parse: ${damage}`);
  return source;
};

/**
 * A caster whose Spellcast trait is Knowledge, at whatever value is asked for.
 *
 * Proficiency is 4 and never equal to the trait, on purpose: the mistake this
 * whole group is written against is scaling spell damage by Proficiency the way
 * a weapon is scaled, and two numbers that happen to match would hide it.
 */
const spellStats = (knowledge: number): DerivedStats =>
  makeStats({ spellcastTrait: 'knowledge', traits: traits({ knowledge }), proficiency: 4 });

const spellSource = (knowledge: number, sides: number, modifier: number): AttackSource | null =>
  spellcastSource(spellStats(knowledge), sides, modifier);

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
    // note in sheetModel.ts::describeWeapon is about exactly this shape.
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

/**
 * Spell damage, which is counted by a different rule from every other attack.
 *
 * *"Any time an effect says to deal damage using your Spellcast trait, you roll
 * a number of dice equal to your Spellcast trait."* Not Proficiency - which is
 * the whole trap, because every other pool on this screen is Proficiency and
 * the two numbers are usually close enough that a wrong one reads as plausible.
 * And *"Note: If your Spellcast trait is +0 or lower, you don't roll anything"*,
 * which is a refusal the app has to be able to make rather than a zero it
 * quietly rolls.
 */
describe('how many dice a spell rolls', () => {
  it('has nothing to say about a character with no Spellcast trait', () => {
    // Most Warriors, Rogues and Guardians. Null and not a zero-dice refusal:
    // there is no rule being refused, there is simply no spellcasting here.
    expect(spellcastDamage(makeStats({ proficiency: 2 }))).toBeNull();
  });

  it('rolls a number of dice equal to the trait, not to Proficiency', () => {
    expect(spellcastDamage(spellStats(3))).toEqual({
      rollable: true,
      trait: 'knowledge',
      count: 3,
    });
    // Proficiency is 4 on these stats. If it were the multiplier this would be
    // four dice, which at 4d8 against 3d8 is about four points a hit.
    expect(spellSource(3, 8, 3)?.damage).toEqual({ count: 3, sides: 8, modifier: 3 });
  });

  it('builds the SRD’s own worked spell, d8+3 using your Spellcast trait', () => {
    // preservation-blast is the one shipped card that pairs the phrase with a
    // formula: "deal d8+3 magic damage using your Spellcast trait". At +3 that
    // is 3d8+3, and the +3 stays a flat +3 rather than being multiplied too.
    const source = spellSource(3, 8, 3);
    expect(source?.kind).toBe('spellcast');
    expect(formatDamage(source!.damage)).toBe('3d8+3');
    expect(sourceName(source!)).toBe('Spellcast');
  });

  it('refuses at +0 and below, and says which trait is at +0', () => {
    expect(spellcastDamage(spellStats(0))).toEqual({
      rollable: false,
      trait: 'knowledge',
      value: 0,
    });
    expect(spellcastDamage(spellStats(-1))).toEqual({
      rollable: false,
      trait: 'knowledge',
      value: -1,
    });
  });

  it('never builds the pool it would then have to refuse', () => {
    // A `count: 0` pool travels perfectly happily into rollDamage and comes
    // back out as a total of +3 with no dice under it. The pool is not built.
    expect(spellSource(0, 8, 3)).toBeNull();
    expect(spellSource(-1, 8, 3)).toBeNull();
    expect(isRollableDamage({ count: 0, sides: 8, modifier: 3 })).toBe(false);
  });

  it('follows the trait a Beastform is wearing, like the attack roll does', () => {
    // `spellcastDamage` reads stats.traits, which is where a Beastform's
    // raised trait lands. `rollModifier` reads the same place for the attack
    // roll, so a sheet whose spell attack and spell damage disagreed about the
    // trait would be this app contradicting itself mid-roll.
    expect(spellcastDamage(spellStats(5))).toEqual({ rollable: true, trait: 'knowledge', count: 5 });
  });
});

describe('which of the two damage types', () => {
  it('reads a weapon rather than assuming weapons are physical', () => {
    // "Unless stated otherwise, mundane weapons and unarmed attacks deal
    // physical damage, and spells deal magic damage." 70 of the 204 shipped
    // weapons state otherwise, so the weapon is asked.
    expect(damageTypeOf(weaponSource('d10+3', 3))).toBe('phy');
    const magic = sourceFromWeapon(
      makeWeapon({ damage: 'd8', damageType: 'mag', name: 'Hand Runes' }),
      makeStats({ proficiency: 2 }),
    );
    expect(damageTypeOf(magic!)).toBe('mag');
  });

  it('gives a spell the other half of the same sentence', () => {
    // A spell rolled as physical would be reduced by the wrong resistances at
    // the table and would print PHY in the log beside a card that says
    // otherwise. The weapon branch is a lookup; this one is the SRD's default
    // for spells and there is nothing on the variant to look up.
    expect(damageTypeOf(spellSource(3, 8, 3)!)).toBe('mag');
  });

  it('gives an unarmed attack and a companion the default', () => {
    expect(damageTypeOf(unarmedSource(makeStats({ proficiency: 2 })))).toBe('phy');
    // The companion variant carries no damageType of its own. A total function
    // over the union has to answer for it, and the answer is the SRD's default
    // rather than a crash on a shape the type system already allows.
    expect(
      damageTypeOf({ kind: 'companion', name: 'Wolf', damage: { count: 1, sides: 6, modifier: 0 } }),
    ).toBe('phy');
  });
});

/**
 * The damage roll as it reaches the log, where the honesty rule is at its
 * narrowest: a line reading "Longsword · 21 PHY" says damage was dealt, and
 * `succeeded === null` means nobody has said the attack hit.
 */
describe('the line the damage roll writes', () => {
  const rolled = (dice: DamageDice, critical: boolean, faces: number[]): ReturnType<typeof rollDamage> =>
    rollDamage(dice, { critical, fixed: faces }, seededRng(7));

  it('prints every number that went into the total, and reaches it', () => {
    const result = rolled({ count: 3, sides: 10, modifier: 3 }, false, [7, 2, 9]);
    expect(damageArithmetic(result)).toBe('7 + 2 + 9 +3 = 21');

    const entry = damageLogEntry(attack(), result);
    expect(entry.kind).toBe('damage');
    expect(entry.total).toBe(21);
    expect(entry.label).toBe('21 PHY');
    expect(entry.detail).toBe('Longsword 3d10+3 · 7 + 2 + 9 +3 = 21');
  });

  it('says IF IT HIT when the GM has not given the verdict', () => {
    const result = rolled({ count: 3, sides: 10, modifier: 3 }, false, [7, 2, 9]);
    const entry = damageLogEntry(attack({ succeeded: null, outcome: 'undecided-hope' }), result);
    expect(entry.label).toBe('IF IT HIT · 21 PHY');
    // The bare form is the one that claims a hit, so it must not be the one
    // that gets written when no hit has been declared.
    expect(entry.label).not.toBe('21 PHY');
  });

  it('says CRITICAL, and counts the bonus in the sum it prints', () => {
    const result = rolled({ count: 3, sides: 10, modifier: 3 }, true, [7, 2, 9]);
    const entry = damageLogEntry(attack({ critical: true, outcome: 'critical' }), result);
    expect(entry.total).toBe(51);
    expect(entry.label).toBe('CRITICAL · 51 PHY');
    // Without the crit term the detail reads "7 + 2 + 9 +3 = 51", which is
    // arithmetic that does not reach its own answer.
    expect(entry.detail).toContain('+30 crit');
    expect(entry.detail).toContain('= 51');
  });

  it('carries the attack’s outcome, so the log colours the two lines alike', () => {
    const result = rolled({ count: 3, sides: 10, modifier: 3 }, true, [7, 2, 9]);
    expect(damageLogEntry(attack({ critical: true, outcome: 'critical' }), result).outcome).toBe(
      'critical',
    );
  });

  it('drops a modifier of zero rather than printing +0', () => {
    const result = rolled({ count: 2, sides: 4, modifier: 0 }, false, [3, 1]);
    expect(damageArithmetic(result)).toBe('3 + 1 = 4');
  });
});
