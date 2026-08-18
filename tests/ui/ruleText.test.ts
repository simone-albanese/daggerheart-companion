/**
 * The conditions strip and the death move both quote the SRD instead of
 * restating it, so the shape of those two sections is load-bearing: if a
 * future revision drops a `## ` subhead or reflows the bullets, the screens go
 * quiet rather than wrong, and quiet is hard to notice. These tests fail
 * loudly instead.
 */
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';
import { TRAITS } from '@shared/types.ts';
import {
  blockNamed,
  damageBumpRule,
  interruptedRestRule,
  longRestRule,
  paragraphs,
  ruleBlocks,
  ruleBullets,
  ruleList,
  ruleTables,
  spellcastZeroNote,
  traitVerbs,
} from '../../src/ui/shared/ruleText.ts';

const dataset = srd as unknown as Dataset;
const section = (id: string): string => {
  const found = dataset.rules.find((r) => r.id === id);
  if (!found) throw new Error(`no rules section "${id}"`);
  return found.body;
};

describe('ruleBlocks', () => {
  it('keeps the text before the first subhead under a null heading', () => {
    const blocks = ruleBlocks('Intro line.\n\n## ONE\n\nFirst.\n\n## TWO\n\nSecond.');
    expect(blocks.map((b) => b.heading)).toEqual([null, 'ONE', 'TWO']);
    expect(blocks[0]!.text).toBe('Intro line.');
    expect(blocks[2]!.text).toBe('Second.');
  });

  it('finds a block by name, case-insensitively', () => {
    const blocks = ruleBlocks('## HIDDEN\n\nOut of sight.');
    expect(blockNamed(blocks, 'hidden')?.text).toBe('Out of sight.');
    expect(blockNamed(blocks, 'restrained')).toBeNull();
  });
});

/*
 * The tables, which the reader could not see for a year.
 *
 * Twelve of them ship, across seven sections, and every one of them arrived at
 * a screen as a single blob of pipes and dashes inside `paragraphs()`. The
 * defect that hid was not a crash: it was the GM reference having nothing to
 * draw, and a second copy of one of these tables typed into `engine/encounter`
 * to fill the gap.
 */
describe('ruleTables', () => {
  it('splits a body into one table per run of pipe lines', () => {
    const tables = ruleTables(
      'Lead.\n\n| A | B |\n| --- | --- |\n| one | two |\n\nMiddle.\n\n| C |\n| --- |\n| three |\n',
    );
    expect(tables).toHaveLength(2);
    expect(tables[0]!.header).toEqual(['A', 'B']);
    expect(tables[1]!.header).toEqual(['C']);
  });

  it('drops the all-dashes separator wherever it appears, not only after the header', () => {
    // The mutation: delete the all-dashes filter and `rows[0]` comes back as
    // ['---', '---'], which a screen would then print as a row of dashes under
    // the heading the GM came to read.
    const table = ruleTables('| A | B |\n| --- | --- |\n| one | two |\n| --- | --- |\n| three | four |')[0]!;
    expect(table.rows).toEqual([
      ['one', 'two'],
      ['three', 'four'],
    ]);
  });

  it('trims every cell, so a padded emitter needs no second guess', () => {
    const table = ruleTables('|   A   |  B |\n| --- | --- |\n|  one |   two  |')[0]!;
    expect(table.header).toEqual(['A', 'B']);
    expect(table.rows[0]).toEqual(['one', 'two']);
  });

  it('ends a table at a blank line, so the paragraph after it is not a row', () => {
    const tables = ruleTables('| A |\n| --- |\n| one |\n\nA sentence that follows the table.');
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rows).toEqual([['one']]);
  });

  it('returns nothing for prose with no pipes at all', () => {
    expect(ruleTables('Just a paragraph.\n\nAnd another one.')).toEqual([]);
  });

  it('is not fooled by a line that only starts with a pipe', () => {
    expect(ruleTables('| this is prose that happens to open with a bar')).toEqual([]);
  });
});

describe('ruleList', () => {
  it('returns the text of a bare bullet without its dash', () => {
    expect(ruleList('- Interrupt the players\n- Make an additional GM move')).toEqual([
      'Interrupt the players',
      'Make an additional GM move',
    ]);
  });

  it('reads a labelled bullet whole, where `ruleBullets` would split it', () => {
    // Both readers see this line; they answer different questions about it.
    expect(ruleList('- Spending Fast: Spend Fear before the players react')).toEqual([
      'Spending Fast: Spend Fear before the players react',
    ]);
    expect(ruleBullets('- Spending Fast: Spend Fear before the players react')).toEqual([
      { label: 'Spending Fast', text: 'Spend Fear before the players react' },
    ]);
  });

  it('answers nothing for prose, which is what tells a list from a paragraph', () => {
    expect(ruleList('Spend a Fear to:')).toEqual([]);
    expect(ruleList('An em-dash — is not a bullet.')).toEqual([]);
  });
});

describe('ruleBullets', () => {
  it('splits `- Label: text` and leaves ordinary lines alone', () => {
    const out = ruleBullets('Lead in:\n\n- One: first thing.\n- Two: second thing.\n\nTail.');
    expect(out).toEqual([
      { label: 'One', text: 'first thing.' },
      { label: 'Two', text: 'second thing.' },
    ]);
  });

  it('ignores a bullet whose colon is a sentence in, not a label', () => {
    const longish = `- ${'x'.repeat(60)}: not a label.`;
    expect(ruleBullets(longish)).toEqual([]);
  });
});

/*
 * The verbs under the traits.
 *
 * They are what tells a player who has not read the book which of the six
 * numbers a thing they want to do is rolled against, and they are in the
 * shipped SRD - so the app reads them rather than carrying licensed text of
 * its own. The parse is the load-bearing part: a revision that reflows this
 * one bullet list would take the verbs off six tiles silently, which is
 * exactly the kind of quiet absence this project keeps shipping.
 */
describe('traitVerbs', () => {
  it('reads the bullet the SRD actually writes, trailing "etc." and all', () => {
    const out = traitVerbs([
      {
        id: 'character-creation',
        title: 'Character Creation',
        body: '- Agility (Use it to Sprint, Leap, Maneuver,etc.) A high Agility means...',
      },
    ]);
    expect(out.agility).toEqual(['Sprint', 'Leap', 'Maneuver']);
  });

  it('answers nothing rather than guessing when the section is absent', () => {
    expect(traitVerbs([])).toEqual({});
    expect(
      traitVerbs([{ id: 'character-creation', title: 'x', body: 'No bullets here.' }]),
    ).toEqual({});
  });

  it('ignores a bullet that is not one of the six traits', () => {
    const out = traitVerbs([
      {
        id: 'character-creation',
        title: 'x',
        body: '- Charisma (Use it to Emote, Wink, etc.) not a Daggerheart trait',
      },
    ]);
    expect(out).toEqual({});
  });

  it('finds three verbs for every trait in the shipped dataset', () => {
    const out = traitVerbs(dataset.rules);
    for (const trait of TRAITS) {
      expect(out[trait], `no verbs for ${trait}`).toBeDefined();
      expect(out[trait], `${trait} has ${String(out[trait]?.length)} verbs`).toHaveLength(3);
    }
    // Spot-checked against the book, and deliberately its spelling rather
    // than ours: the app quotes the SRD instead of re-wording it.
    expect(out.agility).toEqual(['Sprint', 'Leap', 'Maneuver']);
    expect(out.knowledge).toEqual(['Recall', 'Analyze', 'Comprehend']);
  });
});

describe('the two downtime sentences the rest surface quotes', () => {
  const rules = (body: string) => [{ id: 'downtime', title: 'Downtime', body }];

  it('takes the sentence and not the paragraph around it', () => {
    const out = longRestRule(
      rules(
        'Between conflicts, the party can take a rest.\n\n' +
          'When the party rests, they must choose. If a party takes three short rests in a row, their next rest must be a long rest.\n\n' +
          'A short rest lasts about an hour.',
      ),
    );
    expect(out).toBe(
      'If a party takes three short rests in a row, their next rest must be a long rest.',
    );
  });

  it('answers nothing rather than guessing when the section is gone or reworded', () => {
    // A rules layer that dropped the section leaves the refusal with the count
    // alone, which is the only thing the app can honestly say by itself.
    expect(longRestRule([])).toBeNull();
    expect(interruptedRestRule([])).toBeNull();
    expect(longRestRule(rules('Rest as you like, as often as you like.'))).toBeNull();
  });

  it('finds both of them in the shipped dataset, verbatim', () => {
    const long = longRestRule(dataset.rules);
    expect(long, 'the SRD no longer carries the three-short-rests rule').not.toBeNull();
    expect(section('downtime')).toContain(long!);
    expect(long).toMatch(/three short rests in a row/);

    const interrupted = interruptedRestRule(dataset.rules);
    expect(interrupted, 'the SRD no longer carries the interrupted-rest rule').not.toBeNull();
    expect(section('downtime')).toContain(interrupted!);
    // The long one, not the short one: they are adjacent sentences in the same
    // paragraph and the short one comes first.
    expect(interrupted).toContain('only gain the benefits of a short rest');
  });
});

describe('the SRD sections the player screens quote', () => {
  it('has all three standard conditions, each with its rule', () => {
    const blocks = ruleBlocks(section('conditions'));
    for (const name of ['HIDDEN', 'RESTRAINED', 'VULNERABLE']) {
      const rule = paragraphs(blockNamed(blocks, name)?.text ?? '')[0] ?? '';
      expect(rule.length).toBeGreaterThan(20);
    }
    expect(paragraphs(blockNamed(blocks, 'VULNERABLE')!.text)[0]).toContain('advantage');
  });

  it('has the three death moves as bullets', () => {
    const bullets = ruleBullets(section('death'));
    expect(bullets.map((b) => b.label)).toEqual(['Blaze of Glory', 'Avoid Death', 'Risk It All']);
    expect(bullets[1]!.text).toContain('scar');
    expect(bullets[2]!.text).toContain('Duality Dice');
  });

  it('has the lead and the tail the death dialog shows around them', () => {
    const prose = paragraphs(section('death')).filter((p) => !p.startsWith('-'));
    expect(prose[0]).toContain('last Hit Point');
    expect(prose[prose.length - 1]).toContain('new character');
  });

  /*
   * The whole universe of tables the app can draw from.
   *
   * Pinned as a census rather than as a spot check: a revision that moves a
   * table into a different section, or drops one, must fail here loudly rather
   * than leave one reference panel quietly empty.
   */
  it('ships twelve tables, across seven sections and no others', () => {
    const withTables = dataset.rules
      .map((r) => ({ id: r.id, count: ruleTables(r.body).length }))
      .filter((r) => r.count > 0);

    expect(withTables.map((r) => r.id)).toEqual([
      'using-fear',
      'difficulty-benchmarks',
      'countdowns',
      'giving-out-gold-equipment-and-loot',
      'adversary-stat-block-benchmarks',
      'adapting-environments',
      'engaging-your-players',
    ]);
    expect(withTables.reduce((n, r) => n + r.count, 0)).toBe(12);
  });

  it('reads the adversary benchmark table with its signs and its slashes intact', () => {
    const table = ruleTables(section('adversary-stat-block-benchmarks'))[0]!;
    expect(table.header).toEqual([
      'Adversary Statistic',
      'Tier 1',
      'Tier 2',
      'Tier 3',
      'Tier 4',
    ]);
    // The two the engine's typed copy had already lost: the `+` on the attack
    // modifier, and the thresholds as one string rather than two numbers.
    expect(table.rows[0]).toEqual(['Attack Modifier', '+1', '+2', '+3', '+4']);
    expect(table.rows[3]![4]).toBe('Major 25/Severe 45');
  });
});

/**
 * The sentence the Spellcast panel refuses with.
 *
 * A refusal is where an app is most tempted to invent a rule, so this one is
 * lifted rather than written. What these really pin is that it is *lifted*: a
 * hardcoded string in `ruleText.ts` would satisfy every assertion about the
 * shipped dataset and would still be the app presenting its own words as the
 * book's, which is the one thing this module exists to prevent.
 */
describe('spellcastZeroNote', () => {
  it('finds the SRD’s own sentence about a Spellcast trait of +0', () => {
    const note = spellcastZeroNote(dataset.rules);
    expect(note).not.toBeNull();
    expect(note).toMatch(/\+0 or lower/);
    expect(note).toMatch(/roll/i);
  });

  it('drops the leading Note:, because the row prints a sentence', () => {
    // The shipped line is "Note: If your Spellcast trait is +0 or lower, you
    // don't roll anything." An annotation annotates a paragraph, and that
    // paragraph is not on the Play screen - so what is left is the sentence.
    expect(spellcastZeroNote(dataset.rules)).toMatch(/^If your Spellcast trait/);
    expect(spellcastZeroNote(dataset.rules)).not.toMatch(/^Note:/i);
  });

  it('is null when no rules layer carries the sentence at all', () => {
    // And then the screen says it in the app's own words, unquoted. Returning
    // a hardcoded sentence here instead would put quotation marks around
    // something no book ever printed.
    expect(spellcastZeroNote([])).toBeNull();
    expect(
      spellcastZeroNote([
        { id: 'attacking', title: 'Attacking', body: 'On a successful attack, roll damage.' },
      ]),
    ).toBeNull();
  });

  it('follows the sentence rather than the section it is filed under', () => {
    // Pinned to the `attacking` id this would go quiet the moment a homebrew
    // layer reorganised its sections, and going quiet is exactly how a
    // rules-quoting surface fails without anybody noticing.
    expect(
      spellcastZeroNote([
        {
          id: 'house-rules',
          title: 'House rules',
          body: 'Some preamble.\n\nNote: If your Spellcast trait is +0 or lower, you roll one die anyway.',
        },
      ]),
    ).toBe('If your Spellcast trait is +0 or lower, you roll one die anyway.');
  });
});

/*
 * The one rule three files had each typed out for themselves.
 *
 * `engine/encounter.ts` prices the adjustment, `Encounter.tsx` said what it did
 * under the toggles, `SessionBody.tsx` printed it on a chip - and the three
 * transcriptions had already drifted apart from the book and from each other
 * (`+1d4 (or +2)` against the SRD's `+1d4 (or a static +2)`). This is the read
 * that replaces the chip's copy, so the screen a GM reads at the table quotes
 * the dataset rather than the repository.
 */
describe('damageBumpRule', () => {
  it('finds the SRD’s own words for the bump, without the budget half', () => {
    const bump = damageBumpRule(dataset.rules);
    expect(bump, 'the SRD no longer carries the damage-bump line').not.toBeNull();
    expect(section('building-balanced-encounters')).toContain(bump!);
    // What the dice do, from the `+` onwards. The `-2` in front of it is the
    // builder's business and `computeBudget` already owns that number; a row
    // that is not the builder would be printing a cost with no budget beside it.
    expect(bump).toMatch(/^\+1d4\b/);
    expect(bump).not.toMatch(/^-|if you add/i);
    expect(bump).toMatch(/damage rolls$/);
  });

  it('is null when no loaded layer carries the line', () => {
    // And then the row says only that the bump is on. Returning a sentence
    // from this file instead would put the app's arithmetic in quotation marks.
    expect(damageBumpRule([])).toBeNull();
    expect(
      damageBumpRule([
        {
          id: 'building-balanced-encounters',
          title: 'Encounters',
          body: '- +2 for a harder fight',
        },
      ]),
    ).toBeNull();
  });

  it('follows the line rather than the section it is filed under', () => {
    // Same argument as `spellcastZeroNote`: a layer that reorganises its
    // sections must not leave the row silently quoting nothing.
    expect(
      damageBumpRule([
        {
          id: 'house-rules',
          title: 'House rules',
          body: 'Preamble.\n\n- -3 if you add +2d6 (or a static +7) to all adversaries’ damage rolls',
        },
      ]),
    ).toBe('+2d6 (or a static +7) to all adversaries’ damage rolls');
  });
});
