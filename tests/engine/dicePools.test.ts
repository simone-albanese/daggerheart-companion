/**
 * The dice-pool register against the book, both ways, plus the numbers it feeds.
 *
 * Same contract as `modifiers.test.ts` beside it and for the same reason:
 * `src/engine/dicePools.ts` is a hand-typed reading of four features, and a
 * hand can be wrong. So this walks the SHIPPED DATASET forward - every key in
 * the register still naming a feature that exists, with that exact name - and
 * backward - every sentence in the book that talks about a pool of dice having
 * an entry, or a written reason for not having one.
 *
 * THE SHIPPED DATASET, and this file used to say `data/srd-1.0.json` in three
 * places. It has never read that file: it reads `baseDataset`, which imports
 * `data/srd-2.0.json`. The difference is not bookkeeping. Nine classes ship in
 * SRD 1.0 and thirteen in SRD 2.0, and the Warlock - the whole of the Patron
 * Die, four of the exclusions below, and the only priced pool in the register -
 * is in the second book and not the first. A reader taking the old sentence at
 * its word would conclude that `warlock:Patron’s Pact` is checked against a
 * file that has never heard of it, which is exactly backwards.
 *
 * The backward direction is the one that matters. The app shipped for months
 * with a generic tray and no idea that a Rally Die grows at level 5, that a
 * Wordsmith's grows again, or that a Seraph is given one per point of Spellcast
 * trait - and nothing anywhere would have told anyone, because there was no
 * register for the book to be compared against.
 */
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { deriveStats, indexDataset, newCharacter } from '../../src/engine/character.ts';
import { POOL_REGISTER, poolsFor, rollPool, isFace } from '../../src/engine/dicePools.ts';
import { seededRng } from '../../src/engine/dice.ts';
import type { Character, LevelUpChoice } from '../../shared/types.ts';

const dataset = baseDataset;
const index = indexDataset(dataset);

/** Every `<ref>:<feature name>` the dataset actually offers. */
function everyFeatureKey(): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of dataset.classes) {
    out.set(`${k.id}:${k.hopeFeature.name}`, k.hopeFeature.text);
    for (const f of k.classFeatures) out.set(`${k.id}:${f.name}`, f.text);
  }
  for (const s of dataset.subclasses) {
    for (const key of ['foundationFeatures', 'specializationFeatures', 'masteryFeatures'] as const) {
      for (const f of s[key]) out.set(`${s.id}:${f.name}`, f.text);
    }
  }
  return out;
}

/**
 * A pool of dice, as the book names one.
 *
 * `Patron` is here because the register now opens one, and adding it found four
 * subclass features that nothing had ever read - see `NOT_A_POOL`. That is the
 * backward direction earning its keep on the day it was widened: the pattern is
 * only worth as much as the names in it, and a name is added when a pool is.
 */
const POOL_WORDS = /\b(Rally|Prayer|Slayer|Patron) (Die|Dice)\b/;

/**
 * Sentences that name a pool and open or change none, with why.
 *
 * Kept as prose rather than as a silent filter: each of these was read and
 * judged, and a new one arriving in a Core Rulebook layer has to be read and
 * judged too rather than swept up by a pattern.
 */
const NOT_A_POOL: Record<string, string> = {
  'troubadour:Maestro':
    '"When you give a Rally Die to an ally, they can gain a Hope or clear a Stress." It changes what the ALLY gets, and the ally is on their own device - so it changes no number on this sheet.',
  'call-of-the-slayer:Weapon Specialist':
    '"once per long rest when you roll your Slayer Dice, reroll any 1s." A reroll the player takes, once per rest, on dice they are already holding: neither the size, the count nor the cap moves, and a once-per-rest allowance is not a fact this sheet stores.',
  'call-of-the-slayer:Martial Preparation':
    'It grants the party a downtime move and mentions the pool only in passing; the dice it hands out are the GM-facing side of a rest.',
  /*
   * THE FOUR WARLOCK SUBCLASS FEATURES, and they are one judgement made four
   * times rather than four judgements. Every one of them spends Favor to roll
   * Patron Dice - `Patron's Pact`'s dice, at `Patron's Pact`'s size - for an
   * effect that is NOT the action-roll bonus the register opens. None of them
   * changes the size, none grants a count this sheet can hold, and none caps
   * anything, which is the whole of what a register entry or an `UPGRADES`
   * entry can say. So each is listed with its own sentence, because a pattern
   * that swept all four up would sweep up the fifth one a printing adds.
   *
   * What the app does for them is what it does for every other feature: it
   * prints the text on the sheet, out of `characterFeatures`. Two of them roll
   * into a DAMAGE roll rather than an action roll, which is a different surface
   * (`ui/player/DamageRoll.tsx`) and a different lane.
   */
  'pact-of-the-endless:Deathless Embrace':
    '"Once per rest, spend any number of Favor to roll an equal number of Patron Dice. For each result of 4 or higher, clear a Hit Point." A once-per-rest USE of the die at a count the player chooses, and its result clears Hit Points rather than joining a roll. The die is the same d6/d8 `Patron’s Pact` opens; nothing here is a second pool.',
  'pact-of-the-wrathful:Patron’s Fury':
    '"you also roll a number of Patron Dice equal to your tier and add their total to the damage dealt." A scene-long effect on DAMAGE rolls, bought with one Favor rather than one per die. The size is still `Patron’s Pact`’s, and the surface is the damage row, not the action roll this register arms.',
  'pact-of-the-wrathful:Deadly Vengeance':
    '"When you mark any number of Hit Points from an attack, you can spend a Favor to roll an equal number of Patron Dice." A reaction, at a count set by the damage just taken, whose result marks an adversary’s Hit Points. It changes nothing about the pool.',
  'pact-of-the-wrathful:Otherworldly Ire':
    '"Once per rest when you take damage, you can spend any number of Favor to roll that many Patron Dice and target a number of creatures within Close range equal to the highest result." A reaction that reads the highest face to pick targets - GM-facing arithmetic on creatures this build does not hold. It changes nothing about the pool.',
};

describe('the pool register against the book', () => {
  it('names only features the dataset still has, spelt the same way', () => {
    const known = everyFeatureKey();
    const missing = [
      ...Object.keys(POOL_REGISTER.pools),
      ...Object.keys(POOL_REGISTER.upgrades),
    ].filter((key) => !known.has(key));
    expect(
      missing,
      'the register opens or changes a pool from a feature that is not in ' +
        `the shipped dataset under that name any more:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('leaves no pool in the book unregistered and unexplained', () => {
    const known = everyFeatureKey();
    const registered = new Set([
      ...Object.keys(POOL_REGISTER.pools),
      ...Object.keys(POOL_REGISTER.upgrades),
    ]);
    const unexplained: string[] = [];
    for (const [key, text] of known) {
      if (!POOL_WORDS.test(text) && !POOL_WORDS.test(key)) continue;
      if (registered.has(key) || key in NOT_A_POOL) continue;
      unexplained.push(`${key}\n      "${text.replace(/\s+/g, ' ').slice(0, 160)}"`);
    }
    expect(
      unexplained,
      'the book talks about a pool of dice that nothing opens, changes or excuses. Add it to ' +
        'src/engine/dicePools.ts, or add it to NOT_A_POOL above with the reason:\n\n    ' +
        unexplained.join('\n    '),
    ).toEqual([]);
  });

  it('can see, with that pattern, every pool it has already registered', () => {
    /*
     * The backward direction is only worth the names in `POOL_WORDS`, and
     * nothing made the pattern grow when the register did. Narrowing it back to
     * `(Rally|Prayer|Slayer)` broke no test at all until this one existed: the
     * four Warlock exclusions still named real features, the forward direction
     * still matched, and the whole Patron family simply stopped being looked
     * for - which is the failure mode the backward direction exists to prevent,
     * reintroduced one word at a time.
     *
     * So: whatever a pool is opened from, the pattern has to be able to find
     * that feature. Same test the loop above applies, run over the register.
     */
    const known = everyFeatureKey();
    const invisible = Object.keys(POOL_REGISTER.pools).filter((key) => {
      const text = known.get(key) ?? '';
      return !POOL_WORDS.test(text) && !POOL_WORDS.test(key);
    });
    expect(
      invisible,
      'POOL_WORDS cannot see these registered pools, so nothing would report a ' +
        `sibling feature of theirs going unread:\n  ${invisible.join('\n  ')}`,
    ).toEqual([]);
  });

  it('carries no exclusion that has outlived its sentence', () => {
    const known = everyFeatureKey();
    const stale = Object.keys(NOT_A_POOL).filter((k) => !known.has(k));
    expect(stale, `these exclusions name nothing:\n  ${stale.join('\n  ')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

const sheet = (p: Partial<Character> = {}): Character => newCharacter(p, index);
const pools = (p: Partial<Character>): ReturnType<typeof poolsFor> => {
  const c = sheet(p);
  return poolsFor(c, index, deriveStats(c, dataset, index));
};
const card = (subclassRef: string, which: string, level = 5): LevelUpChoice => ({
  level,
  slot: 0,
  kind: 'subclass',
  detail: { subclassRef, card: which },
});

describe('what a sheet is actually given', () => {
  it('gives most characters nothing at all, which is what keeps the fold free', () => {
    expect(pools({ classRef: 'ranger', level: 5 })).toEqual([]);
    expect(pools({ classRef: 'wizard', level: 10 })).toEqual([]);
    expect(pools({})).toEqual([]);
  });

  it('grows a Rally Die at level 5 and again for a Wordsmith who took the card', () => {
    const sizeAt = (level: number, subclass?: string, taken?: LevelUpChoice[]): number =>
      pools({
        classRef: 'bard',
        level,
        subclassRefs: subclass === undefined ? [] : [subclass],
        levelUpHistory: taken ?? [],
      })[0]!.sides;

    expect(sizeAt(1), 'a Rally Die starts as a d6').toBe(6);
    expect(sizeAt(4)).toBe(6);
    expect(sizeAt(5), '"At level 5, your Rally Die increases to a d8"').toBe(8);
    expect(sizeAt(10)).toBe(8);
    // "Your Rally Die increases to a d10" is a MASTERY card, so a Wordsmith who
    // never spent those slots is still on a d8.
    expect(sizeAt(10, 'wordsmith'), 'the mastery card was never taken').toBe(8);
    expect(
      sizeAt(10, 'wordsmith', [card('wordsmith', 'mastery', 8)]),
      'Wordsmith · Epic Poetry',
    ).toBe(10);
    // And the card belongs to that subclass: a Troubadour holding a mastery
    // card of their own does not get somebody else's die.
    expect(sizeAt(10, 'troubadour', [card('troubadour', 'mastery', 8)])).toBe(8);
  });

  it('gives a Seraph one d4 per point of Spellcast trait, and none below one', () => {
    /*
     * READ OFF THE SUBCLASS, NOT ASSUMED. The Divine Wielder's Spellcast trait
     * is STRENGTH - a seraph is a holy warrior, not a charmer - and the first
     * version of this test set Presence and watched the pool come back empty.
     * That is the assumption the engine avoids by reading `stats.spellcastTrait`
     * instead of naming a trait, so the test reads it the same way.
     */
    const seraph = (value: number): ReturnType<typeof poolsFor>[number] => {
      const trait = dataset.subclasses.find((x) => x.id === 'divine-wielder')!.spellcastTrait!;
      return pools({
        classRef: 'seraph',
        subclassRefs: ['divine-wielder'],
        level: 1,
        traits: {
          agility: 0,
          strength: 0,
          finesse: 0,
          instinct: 0,
          presence: 0,
          knowledge: 0,
          [trait]: value,
        },
      }).find((p) => p.id === 'prayer')!;
    };

    // The Divine Wielder's Spellcast trait is the one the subclass names; the
    // count follows whatever that trait is worth on this sheet.
    const three = seraph(3);
    expect(three.sides).toBe(4);
    expect(three.granted).toBe(3);
    expect(three.cap).toBe(3);
    expect(three.rolledAt, 'Prayer Dice are rolled when they are granted').toBe('grant');
    expect(seraph(0).granted, 'a Spellcast trait of zero grants no dice').toBe(0);
    expect(seraph(-1).granted, 'a negative trait is not a negative pool').toBe(0);
  });

  it('lets the app roll an extra Prayer Die only for a Divine Wielder who took Devout', () => {
    const at = (history: LevelUpChoice[]): boolean =>
      pools({
        classRef: 'seraph',
        subclassRefs: ['divine-wielder'],
        level: 5,
        levelUpHistory: history,
      }).find((p) => p.id === 'prayer')!.dropLowest;
    expect(at([]), 'the specialization card was never taken').toBe(false);
    expect(at([card('divine-wielder', 'specialization')]), 'Divine Wielder · Devout').toBe(true);
  });

  it('caps Slayer Dice at Proficiency and pays a Hope per die at the end', () => {
    const slayer = (level: number): ReturnType<typeof poolsFor>[number] =>
      pools({ classRef: 'warrior', subclassRefs: ['call-of-the-slayer'], level }).find(
        (p) => p.id === 'slayer',
      )!;
    // Proficiency is 1 at level 1 and rises at 2, 5 and 8.
    expect(slayer(1).cap).toBe(1);
    expect(slayer(5).cap).toBe(3);
    expect(slayer(8).cap).toBe(4);
    expect(slayer(1).granted, 'Slayer Dice are banked, not handed out').toBeNull();
    expect(slayer(1).clearGrantsHope, '"gain a Hope per die cleared"').toBe(true);
    expect(slayer(1).rolledAt, 'a Slayer Die is rolled when it is spent').toBe('spend');
  });

  it('marks the one pool the rules let you aim at somebody else', () => {
    const prayer = pools({
      classRef: 'seraph',
      subclassRefs: ['divine-wielder'],
      level: 1,
      traits: { agility: 0, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    })[0]!;
    /*
     * "You can spend any number of Prayer Dice to aid yourself OR AN ALLY within
     * Far range." This flag is what stops the screen writing Hope onto the
     * character in front of it when the die was for somebody else's sheet.
     */
    expect(prayer.beneficiary).toBe('either');
    expect(pools({ classRef: 'bard', level: 1 })[0]!.beneficiary, 'a Rally Die is yours').toBe(
      'self',
    );
    expect(
      pools({ classRef: 'warrior', subclassRefs: ['call-of-the-slayer'], level: 1 })[0]!
        .beneficiary,
      'a Slayer Die is added to a roll you are making',
    ).toBe('self');
  });

  it('carries the feature that granted it, verbatim, so the screen can print it', () => {
    const rally = pools({ classRef: 'bard', level: 1 })[0]!;
    expect(rally.rule).toBe(dataset.classes.find((k) => k.id === 'bard')!.classFeatures.find((f) => f.name === 'Rally')!.text);
    expect(rally.source).toBe('Bard');
  });

  it('gives a Warlock a Patron Die that costs a Favor, and grows at 5 like a Rally Die', () => {
    const patron = (level: number): ReturnType<typeof poolsFor>[number] =>
      pools({ classRef: 'warlock', level }).find((p) => p.id === 'patron')!;

    // "Your Patron Die starts at a d6 and increases to a d8 at level 5." The
    // same sentence-inside-a-feature the Rally Die's d8 is written in, which is
    // why `growsTo` is on the spec now instead of an `id === 'rally'` branch.
    expect(patron(1).sides, 'a Patron Die starts as a d6').toBe(6);
    expect(patron(4).sides).toBe(6);
    expect(patron(5).sides, '"increases to a d8 at level 5"').toBe(8);
    expect(patron(10).sides).toBe(8);

    /*
     * THE PRICE IS THE POINT. Every other pool in the register is `null` here,
     * and a screen reading `cost` is what stops a Patron Die being armed for
     * nothing. `heldDice.ts::arm` is where the charge and the die are made one
     * call; this field is how a surface knows there is a charge at all.
     */
    expect(patron(1).cost).toBe('favor');
    expect(pools({ classRef: 'bard', level: 1 })[0]!.cost, 'a Rally Die is free').toBeNull();

    // Bought one at a time, never handed over and never banked - and capped by
    // the Favor ceiling, because that is the most you can have paid for.
    expect(patron(1).granted).toBeNull();
    expect(patron(1).cap).toBe(6);
    expect(patron(1).beneficiary, 'the die joins a roll you are making').toBe('self');
    expect(patron(1).rolledAt).toBe('spend');
    expect(patron(1).clearGrantsHope).toBe(false);
    expect(patron(1).source).toBe('Warlock');
  });

  it('gives the Patron Die to nobody else, including the other twelve classes', () => {
    /*
     * Asked of every class in the book rather than of a couple by hand. The
     * register is keyed on `warlock:Patron’s Pact` - a name with a U+2019 in it
     * - and the failure this guards is not "some other class got one" so much
     * as the whole entry silently naming nothing: a straight apostrophe typed
     * here matches no feature, `poolsFor` finds no spec, and the Warlock gets
     * NOTHING while every assertion about the other twelve still passes.
     */
    const withPatron = dataset.classes
      .filter((k) => pools({ classRef: k.id, level: 10 }).some((p) => p.id === 'patron'))
      .map((k) => k.id);
    expect(withPatron, 'the Patron Die is the Warlock’s and only the Warlock’s').toEqual([
      'warlock',
    ]);
  });

  it('carries the Patron Die through a multiclass, and the Favor seed does not', () => {
    /*
     * The two halves of the Warlock disagree on purpose, and this is the test
     * that says so out loud. `characterFeatures` grants a multiclass's CLASS
     * features, so a Ranger who multiclassed into Warlock holds `Patron’s Pact`
     * and has a Patron Die - the same rule that gives a multiclassed Bard a
     * Rally Die two tests below. But `newCharacter` seeds three Favor only for
     * a first class (`src/engine/character.ts`, on the word "start"), so this
     * sheet arrives with a die it cannot yet pay for.
     *
     * That is not a contradiction to be smoothed over: the screen's control is
     * gated on the Favor track, so a Ranger/Warlock sees the die, is told there
     * is no Favor to spend, and gains Favor by showing tribute like anybody
     * else. Smoothing it here would mean either withholding a feature the book
     * grants or seeding a resource `character.ts` argues at length against.
     */
    const multi = pools({ classRef: 'ranger', multiclassRef: 'warlock', level: 5 });
    const patron = multi.find((p) => p.id === 'patron');
    expect(patron, 'a multiclass grants the second class`s class feature').toBeDefined();
    expect(patron!.source).toBe('Warlock · Multiclass');
    expect(patron!.sides, 'level 5 is the multiclass level and the d8 level').toBe(8);
    expect(
      sheet({ classRef: 'ranger', multiclassRef: 'warlock', level: 5 }).favor.marked,
      'the multiclass seeded Favor, which `newCharacter` argues it must not',
    ).toBe(0);
  });

  it('follows the multiclass rule, because it reads the same collector the sheet does', () => {
    // Multiclassing grants the second class's class feature, and Rally is one.
    const multi = pools({
      classRef: 'wizard',
      multiclassRef: 'bard',
      level: 10,
    });
    expect(multi.map((p) => p.id), 'a multiclassed Bard has no Rally Die').toEqual(['rally']);
    expect(multi[0]!.source).toBe('Bard · Multiclass');
  });
});

describe('rolling a pool', () => {
  it('rolls one die per die asked for', () => {
    const pool = pools({ classRef: 'bard', level: 1 })[0]!;
    const faces = rollPool(pool, 3, seededRng(7));
    expect(faces).toHaveLength(3);
    for (const f of faces) expect(isFace(pool, f)).toBe(true);
    expect(rollPool(pool, 0, seededRng(7)), 'asking for none rolled something').toEqual([]);
  });

  it('rolls one extra and drops the lowest when the subclass says to', () => {
    const devout = pools({
      classRef: 'seraph',
      subclassRefs: ['divine-wielder'],
      level: 5,
      levelUpHistory: [card('divine-wielder', 'specialization')],
      traits: { agility: 0, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    }).find((p) => p.id === 'prayer')!;
    expect(devout.dropLowest).toBe(true);

    /*
     * Asked of a seeded sequence rather than of one roll, because "it dropped
     * the lowest" is only checkable against what was rolled. The same seed with
     * the flag off gives the full four; with it on, the result is those four
     * minus their minimum, and one shorter.
     */
    const withFlag = rollPool(devout, 3, seededRng(11));
    const withoutFlag = rollPool({ ...devout, dropLowest: false }, 4, seededRng(11));
    expect(withFlag).toHaveLength(3);
    expect(withoutFlag).toHaveLength(4);
    const dropped = [...withoutFlag];
    dropped.splice(dropped.indexOf(Math.min(...withoutFlag)), 1);
    expect(withFlag, 'the extra die was rolled but the lowest was not the one dropped').toEqual(
      dropped,
    );
  });

  it('refuses a face that is not on the die, for a table typing its own rolls', () => {
    const prayer = pools({
      classRef: 'seraph',
      subclassRefs: ['divine-wielder'],
      level: 1,
      traits: { agility: 0, strength: 2, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    })[0]!;
    expect(prayer.sides).toBe(4);
    for (const good of [1, 2, 3, 4]) expect(isFace(prayer, good)).toBe(true);
    for (const bad of [0, -1, 5, 12, 1.5, Number.NaN]) expect(isFace(prayer, bad)).toBe(false);
  });
});
