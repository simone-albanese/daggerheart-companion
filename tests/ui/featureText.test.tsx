/**
 * R3-13: a feature whose text lists its benefits as `- ` lines drew raw hyphen
 * lines on Play's feature fold and the wizard's feature block, while the card
 * browser drew the same shape as bullets. `FeatureText` is the one renderer
 * both now go through, and the shipped book is what it is tested against:
 * every feature carrying a `\n- ` line must come out with a bullet and without
 * a leading hyphen, in the order the book prints its lines.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { FeatureText } from '../../src/ui/shared/FeatureText.tsx';
import { FeatureBlock } from '../../src/ui/build/parts.tsx';

const html = (text: string): string => renderToStaticMarkup(createElement(FeatureText, { text }));
const textOf = (markup: string): string => markup.replace(/<[^>]+>/g, '');

const bulleted = [
  ...baseDataset.classes.flatMap((c) => [...c.classFeatures, c.hopeFeature]),
  ...baseDataset.subclasses.flatMap((s) => [
    ...s.foundationFeatures,
    ...s.specializationFeatures,
    ...s.masteryFeatures,
  ]),
].filter((f) => f.text.includes('\n- '));

describe('FeatureText', () => {
  it('draws every bulleted feature in the shipped book with bullets, not hyphens', () => {
    // Counted on data/srd-2.0.json on 4 September 2026: nineteen features.
    expect(bulleted).toHaveLength(19);
    for (const f of bulleted) {
      const out = html(f.text);
      expect(out, f.name).toContain('• ');
      expect(textOf(out), f.name).not.toMatch(/(^|>)- /);
      expect(out, f.name).not.toContain('>- ');
    }
  });

  it('keeps the lines in the order the book prints them', () => {
    // Unstoppable's tip follows its list; a renderer that gathered the bullets
    // after the prose would put the tip before the benefits it is about.
    const unstoppable = bulleted.find((f) => f.name === 'Unstoppable');
    expect(unstoppable).toBeDefined();
    const out = textOf(html(unstoppable!.text));
    expect(out.indexOf('• You reduce the severity')).toBeGreaterThan(out.indexOf('While Unstoppable'));
    expect(out.indexOf('Tip:')).toBeGreaterThan(out.indexOf('• You can’t be Restrained'));
  });

  it('is what the wizard’s FeatureBlock draws', () => {
    const out = renderToStaticMarkup(
      createElement(FeatureBlock, { name: 'Poisoner', text: 'You know these poisons:\n- Ghost Petal: Vulnerable.' }),
    );
    expect(out).toContain('• Ghost Petal');
    expect(out).not.toContain('pre-line');
  });
});
