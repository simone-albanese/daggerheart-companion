/**
 * The hyphen a phone keyboard cannot type.
 *
 * SRD 2.0 sets ten card names with U+2011, the NON-BREAKING hyphen: the nine
 * `*‑Touched` cards and `Battle‑Hardened`. SRD 1.0 had none, so no search
 * surface folded it, and the app answered "Nothing in this dataset carries
 * that" about ten cards it ships and draws. A space worked; the hyphen did not.
 *
 * The name is not the defect — the book prints U+2011 so the name will not
 * break across a line, and rewriting it would be this app inventing a spelling
 * the source never uses, which is the move that put two invented rules titles
 * into a previous dataset. The comparison was the defect.
 *
 * These assertions run against the SHIPPED dataset, not a fixture, because the
 * point is that a player can find a card they own.
 */
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { foldQuery, searchSrd, srdIndex } from '../../src/ui/shared/srdIndex.ts';

const index = srdIndex(baseDataset);

/** Every card name in the shipped dataset that carries a non-ASCII hyphen. */
const awkward = baseDataset.domainCards.filter((c) => /[‐-―−]/.test(c.name));

describe('a card whose printed name uses a hyphen the keyboard does not have', () => {
  it('there are some, or this whole file is testing nothing', () => {
    expect(awkward.length).toBeGreaterThanOrEqual(10);
    expect(awkward.some((c) => /touched/i.test(c.name))).toBe(true);
  });

  it('is found by the ASCII hyphen a player actually types', () => {
    const missed: string[] = [];
    for (const card of awkward) {
      const typed = card.name.replace(/[‐-―−]/g, '-');
      const hits = searchSrd(index, typed);
      if (!hits.some((h) => h.id === card.id)) missed.push(`${card.name} (typed "${typed}")`);
    }
    expect(missed, `unfindable by the hyphen on a phone keyboard:\n  ${missed.join('\n  ')}`).toEqual([]);
  });

  it('is still found by its own printed name, and by a space', () => {
    for (const card of awkward.slice(0, 3)) {
      expect(searchSrd(index, card.name).some((h) => h.id === card.id), card.name).toBe(true);
      const spaced = card.name.replace(/[‐-―−]/g, ' ');
      expect(searchSrd(index, spaced).some((h) => h.id === card.id), spaced).toBe(true);
    }
  });

  it('does not fold so far that two different cards collide', () => {
    // The fold must not make the search answer with the wrong record. Every
    // folded name in the dataset stays distinct from every other.
    const folded = baseDataset.domainCards.map((c) => foldQuery(c.name));
    expect(new Set(folded).size).toBe(folded.length);
  });

  it('leaves an ordinary query alone', () => {
    expect(foldQuery('  Rune   Ward ')).toBe('rune ward');
    expect(searchSrd(index, 'rune ward').length).toBeGreaterThan(0);
  });
});
