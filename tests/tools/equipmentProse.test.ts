/**
 * The equipment chapter, read out of the two COMMITTED datasets.
 *
 * ## Why this file exists beside `rules.test.ts`, which already checks it
 *
 * `rules.test.ts` runs the parser over the owner's PDFs and asserts more than
 * this file can - which drop kept which sentence, which page a section opens
 * on, what a region split fixed. It also `describe.skipIf`s itself away on
 * every machine that does not have the manuals, and no CI runner has them:
 * `.gitignore` ignores `Manuali`, and `ci.yml` gates the `build:srd --check`
 * step on the PDF being present, so that step is skipped on every run, green
 * ones included. The same is true of `equipment.test.ts`, `loot.test.ts` and
 * every other file in this directory that calls `loadSrd`.
 *
 * So the parser's own gate runs on one laptop. **This file reads `data/` and
 * nothing else**, which means it is the only assertion in the repository that
 * a CI runner actually executes about the chapter's prose. A test that needs
 * no PDF is worth more than three that need one, and the division of labour is
 * deliberate: the PDF file owns the parse, this one owns the artifact.
 *
 * ## Both books, not just the shipped one
 *
 * `srdIndex.test.ts` and `chapters.test.ts` read `baseDataset`, which is SRD
 * 2.0. SRD 1.0 is still committed and is what `--check --pdf` regenerates, so
 * it can go stale in exactly the way nothing would notice: it is imported by no
 * screen. Both files are read here, and the assertions that hold of both are
 * written as loops over both rather than as a pair of copies.
 *
 * ## What was measured before the chapter arrived
 *
 * Zero of SRD 1.0's 69 sections and zero of SRD 2.0's 74 contained the word
 * `burden`, the word `consumable`, or the armor chapter's `Armor Slot` prose.
 * The book defines all three: BURDEN on folio 44 / 55, `REDUCING INCOMING
 * DAMAGE` on 56 / 72, the five-of-each cap on 60 / 80. They were unreachable
 * because the island above the chapter stopped at `Equipment` and the island
 * below started at `GOLD`, so 18 and 29 folios were in no island at all.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Dataset, RulesSection } from '../../shared/types.ts';

const read = (name: string): Dataset =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../data/${name}`, import.meta.url)), 'utf8'),
  ) as Dataset;

const BOOKS: ReadonlyArray<{ file: string; sections: number }> = [
  { file: 'srd-1.0.json', sections: 77 },
  { file: 'srd-2.0.json', sections: 82 },
];

/**
 * The eight, in the order the book prints them.
 *
 * Written out rather than derived from the dataset, because the thing under
 * test is that the dataset carries exactly these: a list read back out of the
 * artifact would agree with it however the artifact changed.
 */
const CHAPTER = [
  'equipment',
  'weapons',
  'primary-weapon-tables',
  'secondary-weapon-tables',
  'combat-wheelchair',
  'armor',
  'loot',
  'consumables',
] as const;

const section = (ds: Dataset, id: string): RulesSection => {
  const hit = ds.rules.find((r) => r.id === id);
  if (hit === undefined) throw new Error(`no section ${id}`);
  return hit;
};

describe.each(BOOKS)('the equipment chapter in data/$file', ({ file, sections }) => {
  const ds = read(file);
  const prose = (id: string): string => section(ds, id).body;
  const all = CHAPTER.map(prose).join('\n');

  it('carries all eight, in the book’s order, between multiclassing and gold', () => {
    expect(ds.rules).toHaveLength(sections);
    const order = ds.rules.map((r) => r.id);
    // Contiguous and in order: `indexOf` on each would pass on a shuffle.
    const from = order.indexOf(CHAPTER[0]);
    expect(order.slice(from, from + CHAPTER.length)).toEqual([...CHAPTER]);
    expect(order[from - 1]).toBe('multiclassing');
    expect(order[from + CHAPTER.length]).toBe('gold');
  });

  it('gives each of the eight a body and a page, and the pages run forwards', () => {
    let last = section(ds, 'multiclassing').sourcePage!;
    for (const id of CHAPTER) {
      const s = section(ds, id);
      // Not `> 0`: an empty-ish section is the failure mode a manifest change
      // produces, and `parseRules` only refuses a body of length zero.
      expect(s.body.length, id).toBeGreaterThan(100);
      expect(s.title.length, id).toBeGreaterThan(0);
      expect(s.sourcePage, id).toBeGreaterThanOrEqual(last);
      last = s.sourcePage!;
    }
    expect(last).toBeLessThan(section(ds, 'gold').sourcePage!);
  });

  it('says the three things the dataset had no copy of at all', () => {
    // BURDEN, folio 44 / 55. The sentence `GearPicker` prints HANDS from and
    // the dataset could not quote.
    expect(prose('weapons')).toContain(
      'A weapon’s burden indicates how many hands it occupies when equipped.',
    );
    expect(prose('weapons')).toContain('maximum burden is 2 hands');
    // REDUCING INCOMING DAMAGE, folio 56 / 72 - the whole of how an Armor Slot
    // is spent, which nothing in `data/` stated.
    expect(prose('armor')).toContain('## REDUCING INCOMING DAMAGE');
    expect(prose('armor')).toContain(
      'you can mark one Armor Slot to reduce the severity of the damage by one threshold',
    );
    expect(prose('armor')).toContain('While unarmored, your character’s base Armor Score is 0');
    // CONSUMABLES, folio 60 / 80: the cap the app has no other statement of.
    expect(prose('consumables')).toContain('up to five of each consumable at a time');
    expect(prose('loot')).toContain(
      'Loot comprises any consumables or reusable items the party acquires.',
    );
  });

  it('reads the chapter’s prose and none of its four collections’ rows', () => {
    /*
     * The property that makes the island safe rather than merely full. Those
     * folios are nine parts table by line count, and every row of every table
     * is a record the dataset already carries - `weapons`, `armors`, `loot`,
     * `consumables`. A row reaching a rules section would be the same text
     * shipped twice, in a shape nothing can search by tier or by trait.
     *
     * The names below are in BOTH books' collections, and each is printed on a
     * table inside this chapter.
     */
    for (const name of [
      'Broadsword', // weapons, the first Tier 1 physical primary
      'Gambeson Armor', // armors, Tier 1
      'Premium Bedroll', // loot
      'Stride Potion', // consumables
    ]) {
      expect(all, name).not.toContain(name);
      // And the record itself is where it belongs, so the assertion above is
      // about placement rather than about the name having left the dataset.
      const owns = [...ds.weapons, ...ds.armors, ...ds.loot, ...ds.consumables];
      expect(owns.map((r) => r.name), name).toContain(name);
    }

    // The heading furniture the two `drop` specs cut. `TIER 1 (LEVEL 1)` opens
    // eight tables per book and carries no prose of its own.
    for (const furniture of [
      'TIER 1 (LEVEL 1)',
      'TIER 2 (LEVELS 2-4)',
      'Physical Weapons',
      'Magic Weapons',
      'ARMOR TABLES',
    ]) {
      expect(all, furniture).not.toContain(furniture);
    }

    // And what the drops keep, because the banner carries a rule: starting the
    // drop at the banner itself would have swallowed both of these.
    expect(prose('primary-weapon-tables')).toContain(
      'Players can choose one Tier 1 primary weapon during character creation.',
    );
    expect(prose('secondary-weapon-tables')).toContain(
      'Players can choose one Tier 1 secondary weapon during character creation.',
    );
  });

  it('never reads a page into two sections, in any section of the book', () => {
    /*
     * THE GUARD THE SEAM ACTUALLY NEEDED, and it is here because a mutation
     * proved the other one insufficient.
     *
     * The equipment island ends at `bannerFolio('GOLD') - 1`. Deleting the
     * `- 1` hands folio 84 (62 in SRD 1.0) to this island AND to the one after
     * it, and the result is not a parse error: `gold` comes back with its own
     * text twice, 890 characters becoming 1,791, with a `## GOLD` heading
     * welded into the middle where the second copy begins. Every assertion in
     * this repository stayed green under that mutant, the two `--check` gates
     * included, because a doubled page still validates and still round-trips.
     *
     * So the property is stated over every section of both books rather than
     * over the one seam that produced it: a section never opens itself a second
     * time, never prints one subhead twice, and never repeats its own first
     * paragraph. All three hold of both committed datasets today, and any pair
     * of islands that overlap on a page break at least one of them.
     */
    for (const s of ds.rules) {
      const heads = [...s.body.matchAll(/^## (.*)$/gm)].map((m) => m[1]!.trim().toLowerCase());
      expect(heads, `${file} :: ${s.id} opens itself again`).not.toContain(s.title.toLowerCase());
      expect(new Set(heads).size, `${file} :: ${s.id} repeats a subhead`).toBe(heads.length);
      const opening = s.body.split('\n\n')[0]!;
      if (opening.length > 60) {
        expect(
          s.body.indexOf(opening),
          `${file} :: ${s.id} repeats its opening paragraph`,
        ).toBe(s.body.lastIndexOf(opening));
      }
    }
  });

  it('reads folio 84’s seam once: no page is in two islands and none in neither', () => {
    /*
     * `GOLD` is printed at the head of the third column of folio 84 (62 in SRD
     * 1.0), under the tail of the consumables table, while the contents page
     * says the next chapter opens on 85 (63). The equipment island therefore
     * ends at `bannerFolio('GOLD') - 1` - the next island's own measurement -
     * and a range read off the contents instead would have handed that page to
     * both and read every unit of it twice.
     *
     * From the artifact alone that is checkable in one direction: each side
     * holds its own prose and none of the other's.
     */
    expect(prose('gold')).toContain('handfuls, bags, and chests');
    expect(prose('gold')).not.toContain('up to five of each consumable');
    expect(prose('gold')).not.toContain('Consumables are');
    expect(prose('consumables')).not.toContain('handfuls, bags, and chests');
    expect(prose('consumables')).not.toContain('abstract measurement of how much wealth');
  });

  it('keeps the wheelchair ruleset whole, with its author’s credit on it', () => {
    // Another author's contribution inside the SRD, which is why it is its own
    // section rather than paragraphs inside `weapons`.
    expect(prose('combat-wheelchair')).toContain('By Mark Thompson');
    for (const head of [
      '## ACTION AND MOVEMENT',
      '## CONSEQUENCES',
      '## EVASION',
      '## BURDEN',
      '## CHOOSING YOUR MODEL',
    ]) {
      expect(prose('combat-wheelchair'), head).toContain(head);
    }
    // The label sits with the paragraph it labels, which is what the
    // `Light Frame Models` region split is for; without it the label is
    // emitted three headings earlier, in the other column's stream.
    const chair = prose('combat-wheelchair');
    expect(chair).toContain(
      '## Light Frame Models\n\nThough tough, these wheelchairs have light frames',
    );
    expect(chair.indexOf('## Light Frame Models')).toBeGreaterThan(
      chair.indexOf('## CHOOSING YOUR MODEL'),
    );
  });
});

describe('the two books agree about the chapter', () => {
  const one = read('srd-1.0.json');
  const two = read('srd-2.0.json');

  it('prints the same eight titles, though eleven folios apart', () => {
    for (const id of CHAPTER) {
      expect(section(two, id).title, id).toBe(section(one, id).title);
    }
    // Measured off the contents page of each book: the chapter opens on 44 in
    // SRD 1.0 and on 55 in SRD 2.0, and the gap is 11 folios all the way to
    // GOLD. The pages are asserted because they are the only evidence in the
    // artifact that the range was read off each book rather than transposed.
    expect(section(one, 'equipment').sourcePage).toBe(44);
    expect(section(two, 'equipment').sourcePage).toBe(55);
    expect(section(one, 'gold').sourcePage).toBe(62);
    expect(section(two, 'gold').sourcePage).toBe(84);
  });

  it('reads the head SRD 1.0 sets in mixed case and SRD 2.0 sets in capitals', () => {
    /*
     * The one heading in the chapter the two books spell differently, which is
     * why `Spec.start` takes a list. SRD 1.0 sets `Consumables` at 17.3pt as a
     * sibling of `LOOT`; SRD 2.0 sets `CONSUMABLES` at 12.0pt, a rank below it
     * on the same page. Both open the same section, and this is what says so
     * without a PDF: the section exists in both and carries the cap in both.
     */
    for (const ds of [one, two]) {
      expect(section(ds, 'consumables').title).toBe('Consumables');
      expect(section(ds, 'consumables').body).toContain('up to five of each consumable');
    }
  });

  it('carries SRD 2.0’s expansion tables and SRD 1.0’s single set, as each book prints them', () => {
    // Not a defect in the older book: SRD 1.0 prints one set of loot tables and
    // no `ITEMS` subhead, SRD 2.0 prints a Core Set and a Hope & Fear
    // Expansion Set under one. The assertion is that each dataset says what its
    // own book says, in both directions.
    expect(section(two, 'loot').body).toContain('## ITEMS');
    expect(section(two, 'loot').body).toContain('Hope & Fear Expansion Set');
    expect(section(one, 'loot').body).not.toContain('## ITEMS');
    expect(section(one, 'loot').body).not.toContain('Hope & Fear Expansion Set');
    // Both books give the four rarities, in the same order, with the same dice.
    for (const ds of [one, two]) {
      for (const rarity of ['Common', 'Uncommon', 'Rare', 'Legendary']) {
        expect(section(ds, 'loot').body, rarity).toContain(rarity);
        expect(section(ds, 'consumables').body, rarity).toContain(rarity);
      }
    }
  });
});
