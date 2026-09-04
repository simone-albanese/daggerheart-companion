/**
 * A feature's text, with its bullets drawn as bullets.
 *
 * Nineteen class and subclass features in the shipped SRD 2 (counted on
 * `data/srd-2.0.json`: every `classFeatures`, `hopeFeature` and subclass
 * feature whose text carries a `\n- ` line) list their benefits as `- ` lines -
 * Guardian's Unstoppable, Rogue's Sneak Attack, the Ranger's Focus. The card
 * browser's `CardText` turns the same shape into `•` with a hanging indent;
 * Play's feature fold and the wizard's feature block printed the text under
 * `white-space: pre-line`, so the same book drew real bullets on one screen and
 * raw hyphens on the next.
 *
 * This is NOT `CardText`, because a feature is not a card. `CardText` splits on
 * blank lines, bolds a `Name:` head and gathers a paragraph's bullets after its
 * prose; a feature has no blank lines, its bullets sit between sentences
 * (Unstoppable's `Tip:` follows its list), and reordering them would put the
 * tip before the benefits it is a tip about. So this walks the lines in the
 * order the book prints them and changes only how a `- ` line is drawn.
 */
import type React from 'react';

export function FeatureText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text.split('\n').map((line, i) =>
        line.startsWith('- ') ? (
          <span
            key={i}
            style={{ display: 'block', marginTop: '0.35em', paddingLeft: '1em', textIndent: '-1em' }}
          >
            {'• '}
            {line.slice(2)}
          </span>
        ) : (
          <span key={i} style={{ display: 'block', marginTop: i === 0 ? 0 : '0.35em' }}>
            {line}
          </span>
        ),
      )}
    </>
  );
}
