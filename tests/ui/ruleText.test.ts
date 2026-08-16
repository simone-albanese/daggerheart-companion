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
  paragraphs,
  ruleBlocks,
  ruleBullets,
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
});
