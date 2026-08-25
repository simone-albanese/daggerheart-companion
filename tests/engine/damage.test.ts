import { describe, expect, it } from 'vitest';
import {
  SEVERITY_HP,
  applyDamage,
  combatantHit,
  hasFallen,
  hasFallenAt,
  isVulnerableFromStress,
  markDamage,
  markStress,
  severityFor,
  type Severity,
} from '@engine/damage.ts';
import { makeCharacter, makeStats } from '../fixtures/factories.ts';

const stats = makeStats({ thresholds: [7, 12] }); // Major 7, Severe 12, Massive 24

describe('severityFor at the boundaries', () => {
  it.each([
    [-4, 'none'],
    [0, 'none'],
    [1, 'minor'],
    [6, 'minor'],
    [7, 'major'],
    [11, 'major'],
    [12, 'severe'],
    [23, 'severe'],
    [24, 'severe'],
    [99, 'severe'],
  ] as Array<[number, Severity]>)('reads %i as %s', (amount, severity) => {
    expect(severityFor(amount, stats.thresholds)).toBe(severity);
  });

  it('only reaches Massive when the table turned the optional rule on', () => {
    expect(severityFor(24, stats.thresholds, false)).toBe('severe');
    expect(severityFor(24, stats.thresholds, true)).toBe('massive');
    expect(severityFor(23, stats.thresholds, true)).toBe('severe');
  });

  it('maps each severity to the HP the sheet marks', () => {
    expect(SEVERITY_HP).toEqual({ none: 0, minor: 1, major: 2, severe: 3, massive: 4 });
  });

  it('reads an unarmored level 1 character, whose thresholds are 1 and 2', () => {
    const low = makeStats({ thresholds: [1, 2] });
    expect(severityFor(1, low.thresholds)).toBe('major');
    expect(severityFor(2, low.thresholds)).toBe('severe');
  });
});

describe('applyDamage', () => {
  it('marks HP by the ladder', () => {
    expect(applyDamage(6, stats, 0).hp).toBe(1);
    expect(applyDamage(7, stats, 0).hp).toBe(2);
    expect(applyDamage(12, stats, 0).hp).toBe(3);
    expect(applyDamage(24, stats, 0, { massiveDamageRule: true }).hp).toBe(4);
  });

  it('reports the incoming and effective amounts separately', () => {
    const out = applyDamage(10, stats, 0, { reduction: 4 });
    expect(out.incoming).toBe(10);
    expect(out.effective).toBe(6);
  });

  it('applies flat reduction before the thresholds are read', () => {
    // 12 is Severe, but reduced by 1 it lands under it.
    expect(applyDamage(12, stats, 0, { reduction: 1 }).severity).toBe('major');
    expect(applyDamage(12, stats, 0).severity).toBe('severe');
  });

  it('takes reduction all the way to nothing', () => {
    const out = applyDamage(5, stats, 0, { reduction: 9 });
    expect(out.effective).toBe(0);
    expect(out.severity).toBe('none');
    expect(out.hp).toBe(0);
  });
});

describe('armor slots', () => {
  it('steps the severity down one per slot marked', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 1 });
    expect(out.rawSeverity).toBe('severe');
    expect(out.severity).toBe('major');
    expect(out.hp).toBe(2);
    expect(out.armorSlotsUsed).toBe(1);
  });

  it('takes a Minor hit to nothing', () => {
    const out = applyDamage(3, stats, 1, { armorSlots: 1 });
    expect(out.rawSeverity).toBe('minor');
    expect(out.severity).toBe('none');
    expect(out.hp).toBe(0);
  });

  it('never spends more slots than the ladder has rungs', () => {
    // The cap is lifted out of the way on purpose: with it in force this row
    // would come out at 1 either way, and would stop proving the rung limit
    // it was written for.
    const out = applyDamage(3, stats, 5, { armorSlots: 4, armorSlotCap: 4 });
    expect(out.armorSlotsUsed).toBe(1);
    expect(out.severity).toBe('none');
  });

  it('never spends more slots than the character has', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 3, armorSlotCap: 3 });
    expect(out.armorSlotsUsed).toBe(3);
    expect(applyDamage(12, stats, 1, { armorSlots: 3, armorSlotCap: 3 }).armorSlotsUsed).toBe(1);
    expect(applyDamage(12, stats, 1, { armorSlots: 3, armorSlotCap: 3 }).severity).toBe('major');
  });

  it('spends nothing on a hit that already did nothing', () => {
    const out = applyDamage(0, stats, 3, { armorSlots: 2 });
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('none');
    expect(out.furtherReductionPossible).toBe(false);
  });

  it('spends nothing unless the player asked', () => {
    const out = applyDamage(12, stats, 3);
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('severe');
    expect(out.furtherReductionPossible).toBe(true);
  });

  it('says when no further reduction is possible', () => {
    // Once because the ladder ran out, once because the track did.
    const ladderSpent = applyDamage(12, stats, 3, { armorSlots: 3, armorSlotCap: 3 });
    expect(ladderSpent.severity).toBe('none');
    expect(ladderSpent.furtherReductionPossible).toBe(false);
    expect(applyDamage(12, stats, 1, { armorSlots: 1 }).furtherReductionPossible).toBe(false);
  });

  it('explains itself', () => {
    const out = applyDamage(14, stats, 2, { reduction: 1, armorSlots: 1 });
    expect(out.explanation).toContain('14 incoming');
    expect(out.explanation).toContain('-1 reduced');
    expect(out.explanation).toContain('7/12');
    expect(out.explanation).toContain('Major');
  });
});

/**
 * One incoming damage spends one Armor Slot.
 *
 * The calculator used to allow three, which walked a Severe hit all the way to
 * nothing for the price of a track a long rest refills - three times what the
 * game allows, on the control a player reaches for at the worst moment of a
 * fight. The cap is enforced here rather than in the screen so the next
 * surface that spends armor cannot re-invent it.
 *
 * The cap is a parameter with a default of one, not a hard-coded one, because
 * the shipped dataset really does raise it: `brace` (Bone 3) and
 * `forest-sprites` (Sage 8) each grant an additional slot, the Stalwart's Iron
 * Will grants one against physical damage, and `i-am-your-shield` (Valor 1)
 * lets a character taking a hit for an ally mark any number at all.
 */
describe('one Armor Slot per incoming damage', () => {
  it('spends one however many the caller asks for and the character has', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 3 });
    expect(out.rawSeverity).toBe('severe');
    expect(out.armorSlotsUsed).toBe(1);
    expect(out.severity).toBe('major');
    expect(out.hp).toBe(2);
  });

  it('holds at the top of the ladder too, where three slots used to erase a Massive hit', () => {
    const out = applyDamage(24, stats, 4, { armorSlots: 4, massiveDamageRule: true });
    expect(out.rawSeverity).toBe('massive');
    expect(out.armorSlotsUsed).toBe(1);
    expect(out.severity).toBe('severe');
    expect(out.hp).toBe(3);
  });

  it('reports the ask beside the spend, so a refusal is legible', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 3 });
    expect(out.armorSlotsRequested).toBe(3);
    expect(out.armorSlotsUsed).toBe(1);
    expect(out.armorSlotCap).toBe(1);
    expect(out.armorSlotsSpendable).toBe(1);
  });

  it('never says in the log that it spent what it refused to spend', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 3 });
    expect(out.explanation).toContain('-1 armor');
    expect(out.explanation).not.toContain('-3 armor');
    expect(out.explanation).toContain('Major');
  });

  it('says the spend is finished as soon as the one slot is gone', () => {
    const out = applyDamage(12, stats, 5, { armorSlots: 1 });
    expect(out.furtherReductionPossible).toBe(false);
    expect(applyDamage(12, stats, 5).furtherReductionPossible).toBe(true);
  });
});

/**
 * "unless an ability or domain card says otherwise" - the parenthesis in the
 * rule, wired rather than paraphrased.
 */
describe('features that raise the cap', () => {
  it('spends two for Brace, Iron Will and a Forest Sprite', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 2, armorSlotCap: 2 });
    expect(out.armorSlotCap).toBe(2);
    expect(out.armorSlotsUsed).toBe(2);
    expect(out.severity).toBe('minor');
    expect(out.hp).toBe(1);
  });

  it('spends any number for I Am Your Shield', () => {
    const out = applyDamage(24, stats, 4, {
      armorSlots: 4,
      armorSlotCap: Number.POSITIVE_INFINITY,
      massiveDamageRule: true,
    });
    expect(out.armorSlotCap).toBe(Number.POSITIVE_INFINITY);
    expect(out.armorSlotsUsed).toBe(4);
    expect(out.severity).toBe('none');
    expect(out.hp).toBe(0);
  });

  it('still stops at the track and at the ladder, however high the cap goes', () => {
    const short = applyDamage(12, stats, 1, {
      armorSlots: 9,
      armorSlotCap: Number.POSITIVE_INFINITY,
    });
    expect(short.armorSlotsSpendable).toBe(1);
    expect(short.armorSlotsUsed).toBe(1);

    const minor = applyDamage(3, stats, 9, { armorSlots: 9, armorSlotCap: 9 });
    expect(minor.armorSlotsSpendable).toBe(1);
    expect(minor.severity).toBe('none');
  });

  it('takes a cap of zero from a feature that forbids armor outright', () => {
    // Frenzy: "While Frenzied, you can't use Armor Slots."
    const out = applyDamage(12, stats, 3, { armorSlots: 1, armorSlotCap: 0 });
    expect(out.armorSlotsSpendable).toBe(0);
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('severe');
    expect(out.furtherReductionPossible).toBe(false);
  });
});

/**
 * `armorSlotsSpendable` is the number an armor control is built from, and the
 * reason a screen cannot ask for more than the engine allows: a control that
 * cycles up to it can only ever ask for something the engine will honour.
 */
describe('the ceiling a screen builds its control from', () => {
  it('is the cap, the track and the ladder, whichever runs out first', () => {
    expect(applyDamage(12, stats, 3).armorSlotsSpendable).toBe(1); // the cap
    expect(applyDamage(12, stats, 0, { armorSlotCap: 3 }).armorSlotsSpendable).toBe(0); // the track
    expect(applyDamage(3, stats, 9, { armorSlotCap: 9 }).armorSlotsSpendable).toBe(1); // the ladder
  });

  it('is zero for a hit no armor can touch', () => {
    expect(applyDamage(0, stats, 3).armorSlotsSpendable).toBe(0);
    expect(applyDamage(12, stats, 3, { direct: true }).armorSlotsSpendable).toBe(0);
  });
});

/**
 * Slot counts arrive from text inputs, stored sheets and features' arithmetic,
 * and the type system stops caring at the door. A NaN that reached the clamp
 * used to walk off the end of the ladder.
 */
describe('a slot count that is not a count of slots', () => {
  it('does not hand back an undefined severity for a NaN request', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: Number.NaN });
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('severe');
    expect(out.hp).toBe(3);
  });

  it('rounds a fraction down and floors a negative at nothing', () => {
    expect(applyDamage(12, stats, 3, { armorSlots: 1.9 }).armorSlotsUsed).toBe(1);
    expect(applyDamage(12, stats, 3, { armorSlots: -2 }).armorSlotsUsed).toBe(0);
  });

  it('falls back to a cap of one when the cap itself is junk', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 3, armorSlotCap: Number.NaN });
    expect(out.armorSlotCap).toBe(1);
    expect(out.armorSlotsUsed).toBe(1);
  });

  it('treats a track it cannot read as no slots at all, and says so', () => {
    const out = applyDamage(12, stats, Number.NaN, { armorSlots: 1 });
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('severe');
    // The ceiling has to say zero as well, or a control built from it would
    // offer a slot the engine has already decided does not exist.
    expect(out.armorSlotsSpendable).toBe(0);
    expect(out.furtherReductionPossible).toBe(false);
  });
});

describe('direct damage', () => {
  it('ignores armor entirely', () => {
    const out = applyDamage(12, stats, 3, { armorSlots: 2, direct: true });
    expect(out.armorSlotsUsed).toBe(0);
    expect(out.severity).toBe('severe');
    expect(out.hp).toBe(3);
    expect(out.furtherReductionPossible).toBe(false);
  });

  it('still respects flat reduction', () => {
    expect(applyDamage(12, stats, 3, { direct: true, reduction: 6 }).severity).toBe('minor');
  });
});

describe('markDamage', () => {
  it('marks HP and the armor slots that were spent', () => {
    const c = makeCharacter({
      hp: { marked: 1, max: 6 },
      armorSlots: { marked: 0, max: 3 },
    });
    const next = markDamage(c, applyDamage(12, stats, 3, { armorSlots: 1 }));
    expect(next.hp.marked).toBe(3);
    expect(next.armorSlots.marked).toBe(1);
  });

  it('never marks past the maxima', () => {
    const c = makeCharacter({
      hp: { marked: 5, max: 6 },
      armorSlots: { marked: 2, max: 3 },
    });
    const next = markDamage(c, applyDamage(12, stats, 1, { armorSlots: 1 }));
    expect(next.hp.marked).toBe(6);
    expect(next.armorSlots.marked).toBe(3);
  });

  it('leaves the original character untouched', () => {
    const c = makeCharacter({ hp: { marked: 0, max: 6 } });
    markDamage(c, applyDamage(7, stats, 0));
    expect(c.hp.marked).toBe(0);
  });

  it('marks one slot for a hit that asked for three', () => {
    const c = makeCharacter({
      hp: { marked: 0, max: 6 },
      armorSlots: { marked: 0, max: 3 },
    });
    const next = markDamage(c, applyDamage(12, stats, 3, { armorSlots: 3 }));
    expect(next.armorSlots.marked).toBe(1);
    expect(next.hp.marked).toBe(2);
  });

  it('refuses an outcome that spends more than the cap it declares', () => {
    // Nothing in the type system says `applyDamage` is the only thing allowed
    // to build one of these, so the cap rides on the outcome and is checked
    // again here. An object literal is exactly how a screen would get around
    // an engine answer it found inconvenient.
    const c = makeCharacter({
      hp: { marked: 0, max: 6 },
      armorSlots: { marked: 0, max: 3 },
    });
    const forged = { ...applyDamage(12, stats, 3, { armorSlots: 1 }), armorSlotsUsed: 3 };
    expect(markDamage(c, forged).armorSlots.marked).toBe(1);

    // And a cap that really was raised is still honoured.
    const braced = { ...applyDamage(12, stats, 3, { armorSlots: 2, armorSlotCap: 2 }) };
    expect(markDamage(c, braced).armorSlots.marked).toBe(2);
  });
});

describe('markStress', () => {
  it('marks one Stress by default', () => {
    const c = makeCharacter({ stress: { marked: 0, max: 6 } });
    const r = markStress(c);
    expect(r.stressMarked).toBe(1);
    expect(r.hpMarked).toBe(0);
    expect(r.character.stress.marked).toBe(1);
  });

  it('converts to HP once every Stress slot is full', () => {
    const c = makeCharacter({
      stress: { marked: 6, max: 6 },
      hp: { marked: 0, max: 6 },
    });
    const r = markStress(c, 2);
    expect(r.stressMarked).toBe(0);
    expect(r.hpMarked).toBe(2);
    expect(r.character.hp.marked).toBe(2);
    expect(r.character.stress.marked).toBe(6);
  });

  it('fills the Stress track first and spills the rest into HP', () => {
    const c = makeCharacter({
      stress: { marked: 5, max: 6 },
      hp: { marked: 0, max: 6 },
    });
    const r = markStress(c, 3);
    expect(r.stressMarked).toBe(1);
    expect(r.hpMarked).toBe(2);
    expect(r.character.stress.marked).toBe(6);
    expect(r.character.hp.marked).toBe(2);
  });

  it('stops at the last Hit Point rather than going past it', () => {
    const c = makeCharacter({
      stress: { marked: 6, max: 6 },
      hp: { marked: 5, max: 6 },
    });
    const r = markStress(c, 4);
    expect(r.hpMarked).toBe(1);
    expect(r.character.hp.marked).toBe(6);
  });

  it('does nothing for an amount of zero', () => {
    const c = makeCharacter({ stress: { marked: 2, max: 6 } });
    const r = markStress(c, 0);
    expect(r.stressMarked).toBe(0);
    expect(r.character.stress.marked).toBe(2);
  });
});

describe('conditions the sheet can read off the tracks', () => {
  it('is Vulnerable with every Stress slot marked', () => {
    expect(isVulnerableFromStress(makeCharacter({ stress: { marked: 6, max: 6 } }))).toBe(true);
    expect(isVulnerableFromStress(makeCharacter({ stress: { marked: 5, max: 6 } }))).toBe(false);
    expect(isVulnerableFromStress(makeCharacter({ stress: { marked: 0, max: 0 } }))).toBe(false);
  });

  it('has fallen with the last Hit Point marked', () => {
    expect(hasFallen(makeCharacter({ hp: { marked: 6, max: 6 } }))).toBe(true);
    expect(hasFallen(makeCharacter({ hp: { marked: 5, max: 6 } }))).toBe(false);
  });
});

/**
 * The adversary's side of the same ladder.
 *
 * `severityFor` is covered above and is not re-covered here. What is new is
 * everything around it: the branch for an adversary the SRD gives no
 * thresholds, the optional rule arriving as an argument rather than a default,
 * and the Minion divisor that turns one number into a count of bodies.
 *
 * The fixture thresholds stay [7, 12] so the boundaries line up with the block
 * at the top of this file and a reader can hold one pair of numbers in their
 * head for the whole file.
 */
describe('combatantHit', () => {
  const withThresholds = (marked = 0, max = 8): Parameters<typeof combatantHit>[1] => ({
    thresholds: [7, 12],
    hp: { marked, max },
  });

  it.each([
    [6, 'minor', 1],
    [7, 'major', 2],
    [11, 'major', 2],
    [12, 'severe', 3],
  ] as Array<[number, Severity, number]>)(
    'reads %i as %s and marks %i HP',
    (amount, severity, hp) => {
      const hit = combatantHit(amount, withThresholds(), { massiveDamageRule: false });
      expect(hit.severity).toBe(severity);
      expect(hit.hp).toBe(hp);
      expect(hit.marked).toBe(hp);
    },
  );

  it('marks nothing at all for zero, a negative, or a field that is not a number', () => {
    for (const amount of [0, -3, Number.NaN]) {
      const hit = combatantHit(amount, withThresholds(2), { massiveDamageRule: false });
      expect(hit.severity).toBe('none');
      expect(hit.hp).toBe(0);
      // The track is where it was, not where a NaN would have walked it.
      expect(hit.marked).toBe(2);
      expect(hit.minionsDefeated).toBe(0);
    }
  });

  it('never marks past the maximum', () => {
    const hit = combatantHit(12, withThresholds(7, 8), { massiveDamageRule: false });
    expect(hit.hp).toBe(3);
    expect(hit.marked).toBe(8);
    expect(hit.defeated).toBe(true);
  });

  /*
   * The no-thresholds branch. Sixteen adversaries in the shipped dataset carry
   * `thresholds: null` and every one of them is a Minion; what the book says
   * about them is that any damage defeats one, which is not a rung on the
   * ladder. So `severity` is null rather than a severity this file made up,
   * and one point of damage takes the whole track.
   */
  it('defeats an adversary with no thresholds on any damage at all, and gives it no severity', () => {
    const hit = combatantHit(1, { thresholds: null, hp: { marked: 0, max: 1 } }, {
      massiveDamageRule: false,
    });
    expect(hit.severity).toBeNull();
    expect(hit.hp).toBe(1);
    expect(hit.marked).toBe(1);
    expect(hit.defeated).toBe(true);
  });

  it('marks the whole of a longer no-threshold track from wherever it stood', () => {
    const hit = combatantHit(1, { thresholds: null, hp: { marked: 1, max: 3 } }, {
      massiveDamageRule: false,
    });
    expect(hit.hp).toBe(2);
    expect(hit.marked).toBe(3);
  });

  /*
   * The owner's decision of 2026-08-25: the optional rule follows the same
   * preference against an adversary as it does on a PC. The flag is an
   * argument here and has no default, so the day somebody writes `false` into
   * the call site instead of reading `prefs`, this is what says so.
   */
  it('reaches Massive against an adversary only when the table turned the rule on', () => {
    const off = combatantHit(24, withThresholds(), { massiveDamageRule: false });
    expect(off.severity).toBe('severe');
    expect(off.hp).toBe(3);

    const on = combatantHit(24, withThresholds(), { massiveDamageRule: true });
    expect(on.severity).toBe('massive');
    expect(on.hp).toBe(4);

    // And not one point below it, on either setting.
    expect(combatantHit(23, withThresholds(), { massiveDamageRule: true }).severity).toBe('severe');
  });

  it.each([
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 4],
  ])('defeats %i damage worth of Minions in a group of three: %i', (amount, defeated) => {
    const hit = combatantHit(amount, { thresholds: null, hp: { marked: 0, max: 1 } }, {
      massiveDamageRule: false,
      minionGroup: 3,
    });
    expect(hit.minionsDefeated).toBe(defeated);
  });

  it('never defeats more Minions than are standing', () => {
    const hit = combatantHit(
      30,
      { thresholds: null, hp: { marked: 0, max: 1 }, minionsRemaining: 4 },
      { massiveDamageRule: false, minionGroup: 3 },
    );
    expect(hit.minionsDefeated).toBe(4);
    expect(hit.minionsRemaining).toBe(0);
  });

  it('does no Minion arithmetic at all without a divisor', () => {
    for (const amount of [1, 9, 30]) {
      const hit = combatantHit(
        amount,
        { thresholds: null, hp: { marked: 0, max: 1 }, minionsRemaining: 4 },
        { massiveDamageRule: false },
      );
      expect(hit.minionsDefeated).toBe(0);
      expect(hit.minionsRemaining).toBe(4);
    }
  });

  it('leaves `minionsRemaining` undefined when nothing was counting them', () => {
    const hit = combatantHit(9, { thresholds: null, hp: { marked: 0, max: 1 } }, {
      massiveDamageRule: false,
      minionGroup: 3,
    });
    expect(hit.minionsDefeated).toBe(4);
    expect(hit.minionsRemaining).toBeUndefined();
  });
});

/**
 * One condition, two surfaces.
 *
 * `hasFallen` reads a `Character`; the GM's party board holds four plain counts
 * and a maximum derived beside them, so it cannot. The board delegating rather
 * than writing `hp >= maxHp` is the whole point, and the last case here is what
 * makes it check: the same numbers, both ways round, have to agree.
 */
describe('hasFallenAt', () => {
  it.each([
    [0, 6, false],
    [5, 6, false],
    [6, 6, true],
    [7, 6, true],
    // A track with no maximum is a sheet the dataset could not size. Treating
    // it as fallen would put a death prompt on every row of a broken import.
    [0, 0, false],
    [3, 0, false],
  ])('reads %i of %i as %s', (marked, max, fallen) => {
    expect(hasFallenAt(marked, max)).toBe(fallen);
  });

  it('is the same answer `hasFallen` gives on the same numbers', () => {
    for (const [marked, max] of [
      [0, 6],
      [5, 6],
      [6, 6],
      [0, 0],
    ] as Array<[number, number]>) {
      const c = makeCharacter({ hp: { marked, max } });
      expect(hasFallen(c)).toBe(hasFallenAt(marked, max));
    }
  });
});
