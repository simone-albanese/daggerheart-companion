/**
 * The apostrophe a keyboard types is not the one the book prints.
 *
 * The shipped SRD 2.0 sets every apostrophe-bearing name but one with U+2019,
 * the typographic ’: `Soldier’s Pike`, `Nature’s Tongue`, `Patron’s Pact` -
 * sixty top-level records - and 60 of its 82 rules sections carry ’ in their
 * body. The one exception is `Keeper's Staff`, ASCII, and five rules bodies
 * spell theirs ASCII too. An Android or desktop keyboard types `'`; iOS with
 * smart punctuation types `’`. Before this fold each population found only its
 * own half of the book: `soldier's pike` returned nothing about a weapon the
 * app ships, and `keeper’s staff` returned nothing about the other one.
 *
 * The name is not the defect, exactly as `hyphenSearch.test.ts` argues for
 * U+2011: the book prints ’ and rewriting it would be the app inventing a
 * spelling. The comparison was the defect - `foldQuery` folded hyphens and
 * `searchRules` folded nothing at all - and it is folded on both sides now,
 * needle and haystack, in both searches.
 *
 * Against the SHIPPED dataset, not a fixture, because the point is that a
 * player can find a card they own by typing its name.
 */
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { foldQuery, searchSrd, srdIndex } from '../../src/ui/shared/srdIndex.ts';
import { searchRules } from '../../src/ui/shared/srdReference.ts';

const index = srdIndex(baseDataset);

const CURLY = /[‘’ʼ]/;

/** Every record in the index whose printed name carries a curly apostrophe. */
const curly = index.filter((r) => CURLY.test(r.name));

describe('a name printed with the typographic apostrophe', () => {
  it('there are many, and one ASCII exception, or this file tests nothing', () => {
    expect(curly.length).toBeGreaterThanOrEqual(50);
    const ascii = index.filter((r) => r.name.includes("'"));
    expect(ascii.map((r) => r.name)).toEqual(["Keeper's Staff"]);
  });

  it('is found by the straight apostrophe an Android or desktop keyboard types', () => {
    const missed: string[] = [];
    for (const record of curly) {
      const typed = record.name.replace(/[‘’ʼ]/g, "'");
      const hits = searchSrd(index, typed);
      if (!hits.some((h) => h.id === record.id && h.kind === record.kind)) {
        missed.push(`${record.name} (typed "${typed}")`);
      }
    }
    expect(missed, `unfindable by the apostrophe on a phone keyboard:\n  ${missed.join('\n  ')}`).toEqual([]);
  });

  it('is still found by its own printed name', () => {
    for (const record of curly.slice(0, 5)) {
      expect(searchSrd(index, record.name).some((h) => h.id === record.id), record.name).toBe(true);
    }
  });

  it('and the ASCII exception is found by the curly one iOS types', () => {
    const hits = searchSrd(index, 'keeper’s staff');
    expect(hits.some((h) => h.name === "Keeper's Staff")).toBe(true);
  });

  it('folds the three curly forms to the straight one and nothing else', () => {
    expect(foldQuery('Keeper’s')).toBe("keeper's");
    expect(foldQuery('Keeper‘s')).toBe("keeper's");
    expect(foldQuery('Keeperʼs')).toBe("keeper's");
    expect(foldQuery('  Rune   Ward ')).toBe('rune ward');
  });

  it('never folds two different names into one', () => {
    // The fold must not make the search answer with the wrong record. Weapons
    // and armor repeat a name across tiers on purpose, so the invariant is not
    // "every folded name is unique" but "folding merges nothing": as many
    // distinct folded names as distinct printed ones, in every collection.
    for (const [name, list] of Object.entries(baseDataset)) {
      if (!Array.isArray(list)) continue;
      const printed = new Set(list.map((r) => String((r as { name?: unknown }).name ?? '')));
      const folded = new Set([...printed].map(foldQuery));
      expect(folded.size, `${name}: the fold merged two names`).toBe(printed.size);
    }
  });
});

describe('a body printed with the typographic apostrophe', () => {
  it('reaches a record whose name does not carry the word', () => {
    // `ally’s` is body text on six records and a name on none.
    const straight = searchSrd(index, "ally's");
    const typographic = searchSrd(index, 'ally’s');
    expect(straight.length).toBeGreaterThan(0);
    expect(straight.map((h) => `${h.kind}:${h.id}`)).toEqual(
      typographic.map((h) => `${h.kind}:${h.id}`),
    );
    // And the line it quotes is a real line, not a lost one: the body passed
    // the folded reject, so the quote must be found by the same fold.
    for (const hit of straight) expect(hit.line, `${hit.name} quotes nothing`).not.toBeNull();
  });
});

describe('the rules search', () => {
  it('answers the straight apostrophe with the sections the curly one finds', () => {
    // 60 of 82 sections spell it ’ and five spell it ASCII, so the union is
    // what a GM typing either should get - and the same union for both.
    for (const word of ['gm', 'player', 'character']) {
      const straight = searchRules(baseDataset.rules, `${word}'s`);
      const typographic = searchRules(baseDataset.rules, `${word}’s`);
      expect(straight.length, `${word}'s found nothing`).toBeGreaterThan(0);
      expect(straight.map((h) => h.id)).toEqual(typographic.map((h) => h.id));
      expect(straight.some((h) => h.partial)).toBe(false);
    }
  });

  it('carries the fold into the quoted line, so a hit is never a section with no quote', () => {
    for (const hit of searchRules(baseDataset.rules, "gm's")) {
      expect(hit.where === 'title' || hit.line !== null, `${hit.title} quotes nothing`).toBe(true);
    }
  });
});
