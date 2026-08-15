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
import {
  blockNamed,
  paragraphs,
  ruleBlocks,
  ruleBullets,
} from '../../src/ui/player/ruleText.ts';

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
