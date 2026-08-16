import { describe, expect, it } from 'vitest';
import {
  SEVERITY_HP,
  applyDamage,
  hasFallen,
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
