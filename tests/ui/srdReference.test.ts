/**
 * The selectors the GM reference is built on, against the shipped dataset.
 *
 * These assertions are the licence check as much as the parsing check. The app
 * stamps `SRD 1.0 · P.73` beside the table it draws, and that stamp is only
 * honest if what is on the screen is byte-for-byte what is in
 * `data/srd-1.0.json`. So the values are pinned here, in the tests, where
 * pinning them costs nothing - and nowhere in `src`, where pinning them would
 * be transcribing the book into the repository.
 *
 * It also pins what the repository got wrong when it tried. `TIER_BENCHMARKS`
 * in `engine/encounter.ts` was this same table typed by hand, and it had
 * already dropped the `+` from `+1` and split `Major 7/Severe 12` into two
 * numbers - two silent deformations of licensed text under an SRD stamp,
 * discovered only by reading the shipped file beside it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset, RulesSection } from '@shared/types.ts';
import {
  adversaryBenchmarks,
  adversaryExperiences,
  countdownAdvancement,
  difficultyBenchmarks,
  environmentBenchmarks,
  fearGuidance,
  gmMoves,
  goldAndLoot,
  feetRange,
  metreRange,
  metresFromFeet,
  playerExperiences,
  rangeDistances,
  rangeReference,
  ruleSection,
  type BlockPart,
  type FearScene,
  type RangeEntry,
} from '../../src/ui/shared/srdReference.ts';
import type { RuleTable } from '../../src/ui/shared/ruleText.ts';

const dataset = srd as unknown as Dataset;
const rules = dataset.rules;

describe('adversaryBenchmarks', () => {
  it('gives one column a tier, in the table’s own order', () => {
    const table = adversaryBenchmarks(rules);
    expect(table.columns.map((c) => c.header)).toEqual([
      'Tier 1',
      'Tier 2',
      'Tier 3',
      'Tier 4',
    ]);
    expect(table.columns.map((c) => c.tier)).toEqual([1, 2, 3, 4]);
    expect(table.title).toBe('Adversary Stat Block Benchmarks');
    expect(table.page).toBe(73);
  });

  it('keeps every one of the sixteen cells exactly as the SRD writes it', () => {
    const table = adversaryBenchmarks(rules);
    const cells = (header: string): Array<[string, string]> =>
      table.columns.find((c) => c.header === header)!.stats.map((s) => [s.statistic, s.value]);

    // The `+` survives, and the thresholds stay one string. Source these from
    // a typed constant instead - the way `engine/encounter.ts` did - and both
    // of these fail on the first row and the last.
    expect(cells('Tier 1')).toEqual([
      ['Attack Modifier', '+1'],
      ['Damage Dice', '1d6+2 to 1d12+4'],
      ['Difficulty', '11'],
      ['Damage Thresholds', 'Major 7/Severe 12'],
    ]);
    expect(cells('Tier 4')).toEqual([
      ['Attack Modifier', '+4'],
      ['Damage Dice', '4d8+10 to 4d12+15'],
      ['Difficulty', '20'],
      ['Damage Thresholds', 'Major 25/Severe 45'],
    ]);
  });

  it('answers with nothing rather than a table of its own when the section is gone', () => {
    // A rules layer can replace any section outright. The screen must go blank
    // rather than fall back on numbers the app is carrying itself - a built-in
    // table drawn under an SRD stamp is the exact defect this whole file
    // exists to prevent.
    expect(adversaryBenchmarks([])).toEqual({ title: '', columns: [], page: null });
  });

  it('leaves the tier null when a column heading carries no number', () => {
    // The tier is only used to mark the campaign's own column. A renamed
    // heading must lose the marking, never move it onto the wrong column.
    const table = adversaryBenchmarks([
      {
        id: 'adversary-stat-block-benchmarks',
        title: 'Benchmarks',
        body: '| Statistic | Weak | Tier 2 |\n| --- | --- | --- |\n| Difficulty | 9 | 14 |',
      } as RulesSection,
    ]);
    expect(table.columns.map((c) => c.tier)).toEqual([null, 2]);
    expect(table.columns[0]!.stats).toEqual([{ statistic: 'Difficulty', value: '9' }]);
  });
});

describe('environmentBenchmarks', () => {
  /*
   * The section opens with two paragraphs and only then reaches its table, so
   * this is also the case that pins the walk: a selector reading
   * `ruleTables(body)[0]` would work by luck, one reading the first *block*
   * with a table in it works because the prose block has none - and it is the
   * block's `## ` subhead that names the table on screen.
   */
  it('reads the table thirty pages away, under its own subhead', () => {
    const table = environmentBenchmarks(rules);
    expect(table.title).toBe('BENCHMARK STATISTICS FOR ENVIRONMENTS BY TIER');
    expect(table.page).toBe(102);
    expect(table.columns.map((c) => c.tier)).toEqual([1, 2, 3, 4]);
    // Two statistics, not the adversary table's four - and the selector reads
    // the shape rather than assuming it.
    expect(table.columns[2]!.stats).toEqual([
      { statistic: 'Damage Dice', value: '3d8+3 to 3d10+1' },
      { statistic: 'Difficulty', value: '17' },
    ]);
  });
});

describe('fearGuidance', () => {
  const guidance = (): ReturnType<typeof fearGuidance> => fearGuidance(rules);
  const scenes = (): FearScene[] => {
    const part = guidance().parts.find((p) => p.kind === 'scenes');
    if (part?.kind !== 'scenes') throw new Error('no scene table in using-fear');
    return part.scenes;
  };
  const lists = (): string[][] =>
    guidance().parts.flatMap((p) => (p.kind === 'list' ? [p.items] : []));

  it('gives the five scene types in the SRD’s order, with the SRD’s numbers', () => {
    expect(scenes().map((s) => s.scene)).toEqual([
      'Incidental',
      'Minor',
      'Standard',
      'Major',
      'Climactic',
    ]);
    // BACKLOG.md says an incidental scene is worth `1-2`. The shipped dataset
    // says `0-1 Fear`, and a builder copying the backlog would have printed
    // the backlog's number under an `SRD 1.0` stamp.
    expect(scenes()[0]).toMatchObject({ scene: 'Incidental', spend: '0-1 Fear' });
    expect(scenes().map((s) => s.spend)).toEqual([
      '0-1 Fear',
      '1-3 Fear',
      '2-4 Fear',
      '4-8 Fear',
      '6-12 Fear',
    ]);
  });

  it('keeps the examples cell whole, which is the half a GM actually reads', () => {
    expect(scenes()[4]!.examples).toContain('villain of a story arc');
    expect(scenes()[0]!.examples.length).toBeGreaterThan(100);
  });

  it('keeps each list under the sentence the book put above it', () => {
    // Three lists ship: what to spend a Fear on, what to do with a large pool,
    // and what a Fear move is made of. Picking one out by position would drop
    // the other two - which is the whole reason `parts` is a sequence.
    expect(lists()).toHaveLength(3);
    expect(lists()[0]).toHaveLength(5);
    expect(lists()[0]![0]).toBe('Interrupt the players to steal the spotlight and make a move');
    expect(lists()[0]!.join(' ')).not.toContain('Spending Fast');
    expect(lists()[1]![0]).toContain('Spending Fast');

    // Every list is immediately preceded by its own lead paragraph, and every
    // lead ends in the colon that introduces it.
    const parts = guidance().parts;
    for (const [i, part] of parts.entries()) {
      if (part.kind !== 'list') continue;
      const before = parts[i - 1];
      expect(before?.kind, `list ${String(i)} has no lead`).toBe('text');
      expect(before?.kind === 'text' ? before.text : '').toMatch(/:$/);
    }
  });

  it('keeps the pool’s own four rules as prose, not as a list', () => {
    const first = guidance().parts[0];
    expect(first?.kind).toBe('text');
    expect(first?.kind === 'text' ? first.text : '').toContain('1 Fear per PC');
    expect(guidance().title).toBe('Using Fear');
    expect(guidance().page).toBe(65);
  });

  it('answers with nothing when the section is gone', () => {
    expect(fearGuidance([])).toEqual({ title: '', parts: [], page: null });
  });

  it('keeps a lead run together with its bullets as the prose it is', () => {
    // A layer that writes the lead and the bullets as one paragraph must not
    // have its first line vanish. Drop the "every line is a bullet" condition
    // and `Spend a Fear to:` is silently gone from the screen.
    const guide = fearGuidance([
      {
        id: 'using-fear',
        title: 'Using Fear',
        body: 'Spend a Fear to:\n- Interrupt the players\n- Make an additional GM move',
      } as RulesSection,
    ]);
    expect(guide.parts).toEqual([
      {
        kind: 'text',
        text: 'Spend a Fear to:\n- Interrupt the players\n- Make an additional GM move',
      },
    ]);
  });
});

describe('countdownAdvancement', () => {
  const chart = (): ReturnType<typeof countdownAdvancement> => countdownAdvancement(rules);

  it('gives the five roll results in the SRD’s order, under the SRD’s columns', () => {
    expect(chart().rows.map((r) => r.roll)).toEqual([
      'Failure with Fear',
      'Failure with Hope',
      'Success with Fear',
      'Success with Hope',
      'Critical Success',
    ]);
    expect(chart().columns).toEqual(['Progress Advancement', 'Consequence Advancement']);
    expect(chart().title).toBe('DYNAMIC COUNTDOWN ADVANCEMENT');
    expect(chart().page).toBe(69);
  });

  it('reads a number only where the SRD prints one, and the columns are not swapped', () => {
    const rows = chart().rows;
    // Failure with Fear: nothing on a progress countdown, three on a
    // consequence one. Swap the two columns and this pair inverts.
    expect(rows[0]!.cells.map((c) => c.ticks)).toEqual([null, 3]);
    expect(rows[0]!.cells[0]!.text).toBe('No advancement');
    expect(rows[4]!.cells.map((c) => c.ticks)).toEqual([3, null]);
    // Six of the ten advancement cells carry a number; four say nothing.
    const cells = rows.flatMap((r) => r.cells);
    expect(cells).toHaveLength(10);
    expect(cells.filter((c) => c.ticks !== null)).toHaveLength(6);
  });

  it('carries the sentence that tells a progress countdown from a consequence one', () => {
    // The app has no such distinction on the record, so the GM has to be able
    // to read it. Take the section's first paragraph instead of the last one
    // before the chart and neither name is on the screen.
    expect(chart().lead).toContain('Progress countdowns');
    expect(chart().lead).toContain('Consequence countdowns');
  });

  it('answers with nothing when the section is gone', () => {
    expect(countdownAdvancement([])).toEqual({
      title: '',
      lead: '',
      columns: [],
      rows: [],
      page: null,
    });
  });
});

describe('metresFromFeet', () => {
  it('gives the SRD’s own five figures the metres they come to', () => {
    // 0.3048 exactly. Use 0.3 and 300 feet comes out at 90 instead of 91.
    expect(metresFromFeet(5)).toBe(1.5);
    expect(metresFromFeet(10)).toBe(3);
    expect(metresFromFeet(30)).toBe(9);
    expect(metresFromFeet(100)).toBe(30);
    expect(metresFromFeet(300)).toBe(91);
  });

  it('keeps half metres while they still say something, and drops them after', () => {
    // Round to whole metres everywhere and the two shortest ranges collapse
    // into each other: 5 feet and 10 feet would both read 2 m and 3 m.
    expect(metresFromFeet(5)).toBe(1.5);
    // Continuous across the change of rounding: no gap and no jump at ten.
    expect(metresFromFeet(32)).toBe(10);
    expect(metresFromFeet(33)).toBe(10);
  });
});

describe('metreRange', () => {
  it('prints the two ends, and one end when they round together', () => {
    expect(metreRange([5, 10])).toBe('1.5-3 m');
    expect(metreRange([30, 100])).toBe('9-30 m');
    // "3-3 m" is not a range, it is a rounding artefact wearing a dash.
    expect(metreRange([10, 10])).toBe('3 m');
  });
});

describe('feetRange', () => {
  it('prints the two ends, and one end when they are the same', () => {
    expect(feetRange([30, 100])).toBe('30-100 ft');
    expect(feetRange([5, 10])).toBe('5-10 ft');
    // Same rule as `metreRange`: "30-30 ft" is not a range.
    expect(feetRange([30, 30])).toBe('30 ft');
  });
});

describe('rangeDistances', () => {
  it('answers with the SRD’s own figure for the name a weapon wears', () => {
    /*
     * The player sheet prints a weapon's range as a bare word and had nothing
     * to say what the word meant. These are the five names `shared/types.ts`
     * calls `Range`, and every one of them has to resolve or a weapon carrying
     * it loses its distance silently.
     */
    const found = rangeDistances(rules);
    expect([...found.keys()]).toEqual([
      'melee',
      'very close',
      'close',
      'far',
      'very far',
      'out of range',
    ]);
    expect(found.get('far')!.feet).toEqual([30, 100]);
    expect(found.get('very far')!.feet).toEqual([100, 300]);
    expect(found.get('close')!.feet).toEqual([10, 30]);
    expect(found.get('very close')!.feet).toEqual([5, 10]);
  });

  it('carries the two the book gives no figure for, rather than dropping them', () => {
    // Present with a null figure, not absent: "the book declines to say" and
    // "this dataset has no range section" are different answers and the caller
    // has to be able to tell them apart.
    const found = rangeDistances(rules);
    expect(found.has('melee')).toBe(true);
    expect(found.get('melee')!.feet).toBeNull();
    expect(found.get('out of range')!.feet).toBeNull();
    expect(rangeDistances([]).size, 'a dataset with no range section invented one').toBe(0);
  });

  it('reads only the list of ranges, not every bullet in the section', () => {
    /*
     * The folds after the opening block are about measuring, moving, area of
     * effect and cover, and a labelled bullet in one of those is not a
     * definition of a range. The shipped section cannot show this - none of its
     * `## ` blocks carries a bullet `ruleBullets` will read - so the section is
     * built by hand here, which is the same thing `fearGuidance`'s tests do and
     * the reason these selectors take `RulesSection[]` rather than the store.
     */
    const layered: RulesSection[] = [
      {
        id: 'maps-range-and-movement',
        title: 'Maps, Range, and Movement',
        body: [
          '- Close: about 10-30 feet away.',
          '',
          '## Cover',
          '',
          '- Cover: about 3 feet of stone between you and it.',
        ].join('\n'),
        sourcePage: 40,
      },
    ];
    const found = rangeDistances(layered);
    expect([...found.keys()], 'a bullet from outside the range list got in').toEqual(['close']);
    expect(found.get('close')!.feet).toEqual([10, 30]);

    // And the shipped section is the six the book lists, nothing else.
    expect([...rangeDistances(rules).keys()]).toHaveLength(6);
  });
});

describe('rangeReference', () => {
  const guide = (): ReturnType<typeof rangeReference> => rangeReference(rules);
  const ranges = (): RangeEntry[] => {
    const part = guide().opening.find((p) => p.kind === 'entries');
    if (part?.kind !== 'entries') throw new Error('no range list in maps-range-and-movement');
    return part.entries;
  };

  it('gives the six ranges in the SRD’s order, under the SRD’s own names', () => {
    expect(ranges().map((e) => e.label)).toEqual([
      'Melee',
      'Very Close',
      'Close',
      'Far',
      'Very Far',
      'Out of Range',
    ]);
    expect(guide().title).toBe('Maps, Range, and Movement');
    expect(guide().page).toBe(40);
  });

  it('converts every figure the SRD prints, and invents none where it prints nothing', () => {
    // Melee is "up to a few feet away" and Out of Range is "beyond a
    // character's Very Far range". Neither carries a number, so neither gets
    // one - a default here would be the app inventing a distance the book
    // declined to give.
    expect(ranges().map((e) => e.feet)).toEqual([
      null,
      [5, 10],
      [10, 30],
      [30, 100],
      [100, 300],
      null,
    ]);
    expect(ranges().map((e) => e.metres)).toEqual([
      null,
      '1.5-3 m',
      '3-9 m',
      '9-30 m',
      '30-91 m',
      null,
    ]);
  });

  it('keeps each bullet whole, because the movement rule is inside it', () => {
    // The half a GM needs is not the distance, it is the sentence after it:
    // Close range can be crossed as part of an action, Far cannot.
    expect(ranges()[3]!.text).toContain('must make an Agility Roll');
    expect(ranges()[0]!.text).toBe('Close enough to touch, up to a few feet away.');
  });

  it('carries the premise the conversion rests on, in the SRD’s words', () => {
    const first = guide().opening[0];
    expect(first?.kind).toBe('text');
    expect(first?.kind === 'text' ? first.text : '').toContain(
      '1 inch of map represents about 5 feet',
    );
  });

  it('keeps every subhead after the ranges, which had no home in the app at all', () => {
    expect(guide().sections.map((s) => s.heading)).toEqual([
      'Optional Rule: Defined Ranges',
      'MOVEMENT UNDER PRESSURE',
      'AREA OF EFFECT',
      'LINE OF SIGHT & COVER',
    ]);
    // The grid rule is a labelled list of its own, and it carries no feet, so
    // the app adds nothing to it.
    const squares = guide().sections[0]!.parts.find((p) => p.kind === 'entries');
    expect(squares?.kind === 'entries' ? squares.entries.map((e) => e.text) : []).toEqual([
      '1 square',
      '3 squares',
      '6 squares',
      '12 squares',
      '13+ squares',
      'Off the battlemap',
    ]);
    expect(
      squares?.kind === 'entries' ? squares.entries.every((e) => e.metres === null) : false,
    ).toBe(true);
  });

  it('reads the figure off the shape of it, not off the sentence around it', () => {
    // The SRD writes "about 5-10 feet away". Key on the word "about" and a
    // layer that drops it loses every metric figure on the screen.
    const guide2 = rangeReference([
      {
        id: 'maps-range-and-movement',
        title: 'Ranges',
        body: '- Nearby: roughly 20 - 40 feet from you.',
      } as RulesSection,
    ]);
    const part = guide2.opening[0];
    expect(part?.kind === 'entries' ? part.entries[0] : null).toEqual({
      label: 'Nearby',
      text: 'roughly 20 - 40 feet from you.',
      feet: [20, 40],
      metres: '6-12 m',
    });
  });

  it('reads a lone figure as well as a span, because a line may print either', () => {
    // The screen's legend says every range line that gives a distance in feet
    // gets metres. A layer that writes one figure instead of two is still a
    // line that gave a distance, and the promise has to hold for it.
    const guide2 = rangeReference([
      {
        id: 'maps-range-and-movement',
        title: 'Ranges',
        body: '- Nearby: about 30 feet from you.',
      } as RulesSection,
    ]);
    const part = guide2.opening[0];
    expect(part?.kind === 'entries' ? part.entries[0] : null).toEqual({
      label: 'Nearby',
      text: 'about 30 feet from you.',
      feet: [30, 30],
      // `metreRange` collapses two equal ends: "9-9 m" is a rounding artefact
      // wearing a dash, not a range.
      metres: '9 m',
    });
  });

  it('answers with nothing when the section is gone', () => {
    expect(rangeReference([])).toEqual({ title: '', opening: [], sections: [], page: null });
  });
});

describe('difficultyBenchmarks', () => {
  const guide = (): ReturnType<typeof difficultyBenchmarks> => difficultyBenchmarks(rules);

  it('gives all six traits their own table, keyed on the SRD’s subhead', () => {
    // All six tables begin `| Roll |`, so a lookup by first header cell would
    // return Agility six times over. The key has to be the `## ` above it.
    expect(Object.keys(guide().ladder).sort()).toEqual([
      'agility',
      'finesse',
      'instinct',
      'knowledge',
      'presence',
      'strength',
    ]);
    expect(guide().title).toBe('Difficulty Benchmarks');
    expect(guide().page).toBe(66);
  });

  it('reads the verbs off the table’s own header, and one cell per verb', () => {
    const agility = guide().ladder.agility!;
    expect(agility.verbs).toEqual(['Sprint', 'Leap', 'Maneuver']);
    expect(agility.rows.map((r) => r.roll)).toEqual(['5', '10', '15', '20', '25', '30']);
    // `cells` excludes the roll value, so `cells[i]` is always the example
    // under `verbs[i]`. Push the roll in here and the two arrays differ by
    // one, and every sentence on screen sits under the heading beside the one
    // it belongs to.
    expect(agility.rows[0]!.cells).toHaveLength(agility.verbs.length);
    expect(agility.rows[0]!.cells[1]).toBe(
      'Make a running jump of half your height (about 3 feet for a human).',
    );
    expect(agility.rows[0]!.cells[2]).toBe('Walk slowly across a narrow beam.');
  });

  it('follows a layer that renames a verb, because the column heads it', () => {
    // `TRAIT_VERBS` in shared/types.ts is a second copy of these same eighteen
    // words. Read them from there and this case fails while the shipped one
    // above still passes - which is exactly the drift it exists to catch.
    const renamed = difficultyBenchmarks([
      {
        id: 'difficulty-benchmarks',
        title: 'Benchmarks',
        body: '## Agility\n\n| Roll | Dash | Vault | Weave |\n| --- | --- | --- | --- |\n| 5 | a | b | c |',
      } as RulesSection,
    ]);
    expect(renamed.ladder.agility?.verbs).toEqual(['Dash', 'Vault', 'Weave']);
    expect(renamed.ladder.agility?.rows[0]!.cells).toEqual(['a', 'b', 'c']);
  });

  it('carries the two sentences that say who sets a Difficulty at all', () => {
    // The first is what the six read-only DIF displays in this app are already
    // showing; the second is the only case this ladder covers.
    expect(guide().lead).toHaveLength(2);
    expect(guide().lead[0]).toContain('equal to the adversary');
    expect(guide().lead[1]).toContain('without a specified Difficulty');
  });

  it('skips a subhead that names no trait this app knows', () => {
    const odd = difficultyBenchmarks([
      {
        id: 'difficulty-benchmarks',
        title: 'Benchmarks',
        body: '## Vibes\n\n| Roll | Emote |\n| --- | --- |\n| 5 | a |',
      } as RulesSection,
    ]);
    expect(odd.ladder).toEqual({});
  });

  it('answers with nothing when the section is gone', () => {
    expect(difficultyBenchmarks([])).toEqual({ title: '', lead: [], ladder: {}, page: null });
  });
});

describe('the adjectives that are not in the SRD', () => {
  const SRC = join(process.cwd(), 'src');
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(entry) ? [path] : [];
    });

  it('has neither Very Easy nor Very Hard anywhere in the shipped dataset', () => {
    // This is why the sweep below exists. BACKLOG.md asks for a ladder labelled
    // Very Easy to Very Hard; those labels are on the printed GM screen and
    // occur zero times in the file this app ships, so shipping them would mean
    // typing licensed wording into the repository.
    const body = JSON.stringify(srd);
    expect(body).not.toContain('Very Easy');
    expect(body).not.toContain('Very Hard');
  });

  it('and neither of them is typed into src either', () => {
    // A guard, not a proof: it is green on the pre-change tree by construction.
    // It is here so the next builder who reaches for the adjectives finds it,
    // and the sentence above it, instead of shipping them.
    const guilty = sourceFiles(SRC)
      .filter((path) => /Very Easy|Very Hard/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(
      guilty,
      'these type a Difficulty label the shipped SRD does not contain:\n' +
        guilty.map((f) => `  ${f}`).join('\n'),
    ).toEqual([]);
  });
});

/**
 * The pipeline every surface that prints a whole section goes through.
 *
 * The counts here are the ones the source's own docblocks quote - 38 sections
 * of 75, 34 lists, 7 tables, 3 with both, 12 tables in all - so a dataset that
 * changes underneath them turns a comment that is now false into a red test
 * rather than into a sentence nobody re-read.
 */
describe('ruleSection', () => {
  const parts = (id: string): BlockPart[] =>
    (ruleSection(rules, id)?.blocks ?? []).flatMap((b) => b.parts);
  const tables = (id: string): RuleTable[] =>
    parts(id).flatMap((p) => (p.kind === 'table' ? [p.table] : []));

  it('reads the Average Costs table as a table, not twelve lines of pipes', () => {
    // `HANDOFF-2026-08-18.md` item 10 - not `BACKLOG.md`, which names no item 10
    // and no Average Costs table - and the one a person reported. `Cost` is a second column
    // rather than four characters of markup in the middle of a sentence.
    const table = tables('giving-out-gold-equipment-and-loot')[0]!;
    expect(table.header).toEqual(['Expense', 'Cost']);
    expect(table.rows).toHaveLength(12);
    expect(table.rows[0]).toEqual(['Meals for a party of adventurers per night', '1 Handful']);
    expect(table.rows[11]).toEqual(['Tier 4 equipment (weapons, armor)', '1-2 Chests']);
  });

  it('reads a bullet list as a list, with the dash off the front', () => {
    const list = parts('making-gm-moves').flatMap((p) => (p.kind === 'list' ? p.items : []));
    expect(list).toContain('Roll with Fear');
    expect(list.filter((item) => item.startsWith('-'))).toEqual([]);
  });

  it('leaves a section that is only prose as prose', () => {
    expect(parts('the-golden-rule').map((p) => p.kind)).toEqual(['text']);
  });

  it('finds every list and every table the shipped dataset carries', () => {
    const shapes = rules.map((rule) => {
      const kinds = new Set((ruleSection(rules, rule.id)?.blocks ?? []).flatMap((b) => b.parts.map((p) => p.kind)));
      return { list: kinds.has('list'), table: kinds.has('table') };
    });
    expect(shapes.filter((s) => s.list).length).toBe(34);
    expect(shapes.filter((s) => s.table).length).toBe(7);
    expect(shapes.filter((s) => s.list && s.table).length).toBe(3);
    expect(shapes.filter((s) => s.list || s.table).length).toBe(38);
    expect(rules.flatMap((rule) => tables(rule.id))).toHaveLength(12);
  });

  it('answers null for a section this dataset does not carry', () => {
    expect(ruleSection(rules, 'no-such-rule')).toBeNull();
  });
});

describe('gmMoves', () => {
  const sections = (): ReturnType<typeof gmMoves> => gmMoves(rules);
  const byId = (id: string): ReturnType<typeof gmMoves>[number] =>
    sections().find((s) => s.id === id)!;

  it('gathers all five sections of the GM chapter, in this app’s order', () => {
    // The fifth is `gm-moves-and-adversary-actions` on p.37, which restates
    // when to make a move inside the combat chapter and adds the Fear Feature
    // note. It had no home anywhere in this app.
    expect(sections().map((s) => s.id)).toEqual([
      'gm-principles',
      'gm-practices',
      'making-gm-moves',
      'gm-moves-and-adversary-actions',
      'pitfalls-to-avoid',
    ]);
    expect(sections().map((s) => s.title)).toEqual([
      'GM Principles',
      'GM Practices',
      'Making GM Moves',
      'GM Moves and Adversary Actions',
      'Pitfalls to Avoid',
    ]);
    expect(sections().map((s) => s.page)).toEqual([63, 63, 64, 37, 64]);
  });

  it('keeps the pitfall the SRD wrote in mixed case beside five in capitals', () => {
    const headings = byId('pitfalls-to-avoid').blocks.map((b) => b.heading);
    // Match headings as all-caps and exactly this one goes missing, which is
    // the app quietly deciding one of the SRD's six warnings is not worth
    // reading.
    expect(headings).toEqual([
      'UNDERMINING THE HEROES',
      'ALWAYS TELLING THE PLAYERS WHAT TO ROLL',
      'LETTING SCENES DRAG',
      'SINGULAR SOLUTIONS',
      'Overplanning',
      'HOARDING FEAR',
    ]);
  });

  it('keeps a bullet list as a list and the sentence above it as prose', () => {
    const when = byId('making-gm-moves').blocks.find((b) => b.heading === 'WHEN TO MAKE A MOVE')!;
    expect(when.parts.map((p) => p.kind)).toEqual(['text', 'text', 'list']);
    const list = when.parts[2];
    expect(list?.kind === 'list' ? list.items : []).toEqual([
      'Roll with Fear',
      'Fail an action roll',
      'Do something that has unavoidable consequences',
      'Give you a "golden opportunity" (an opening that demands an immediate response)',
      'Look to you for what happens next',
    ]);
  });

  it('draws whatever came before the first subhead rather than dropping it', () => {
    const first = byId('making-gm-moves').blocks[0]!;
    expect(first.heading).toBeNull();
    expect(first.parts[0]?.kind === 'text' ? first.parts[0].text : '').toContain(
      'GM moves that change the story',
    );
  });

  it('skips a section the dataset does not carry rather than drawing it empty', () => {
    expect(gmMoves([])).toEqual([]);
  });
});

describe('adversaryExperiences', () => {
  const examples = (): ReturnType<typeof adversaryExperiences> => adversaryExperiences(rules);

  it('finds the list without knowing what its heading is called', () => {
    // The heading carries a trailing colon here and does not in
    // `character-creation`, so a lookup by name would have to know both
    // spellings - and knowing them means typing them into src.
    expect(examples().title).toBe('EXAMPLE EXPERIENCES:');
    expect(examples().page).toBe(71);
    expect(examples().items).toHaveLength(18);
    expect(examples().items[0]).toBe('Acrobatics');
    expect(examples().items[17]).toBe('Tracker');
  });

  it('carries the rule above it, without which the list has no stated effect', () => {
    const lead = examples().lead!;
    expect(lead.heading).toBe('EXPERIENCE (OPTIONAL)');
    expect(lead.parts[0]?.kind === 'text' ? lead.parts[0].text : '').toContain('spend a Fear');
  });

  it('answers with nothing when the section is gone', () => {
    expect(adversaryExperiences([])).toEqual({ title: '', lead: null, items: [], page: null });
  });
});

describe('goldAndLoot', () => {
  const section = (): NonNullable<ReturnType<typeof goldAndLoot>> => goldAndLoot(rules)!;

  it('reads the whole section, with the Average Costs table inside it', () => {
    expect(section().id).toBe('giving-out-gold-equipment-and-loot');
    expect(section().title).toBe('Giving Out Gold, Equipment, and Loot');
    expect(section().page).toBe(69);
    // The SRD writes this section with no `## ` subhead at all, so it is one
    // block: four paragraphs of prose and the table, in the book's order.
    expect(section().blocks).toHaveLength(1);
    expect(section().blocks[0]!.heading).toBeNull();
    expect(section().blocks[0]!.parts.map((p) => p.kind)).toEqual([
      'text',
      'text',
      'text',
      'text',
      'table',
    ]);
  });

  /*
   * The values, pinned here and nowhere in `src`. The app stamps SRD 1.0 · P.69
   * beside this table, and that stamp is only honest if what reaches the glass
   * is byte-for-byte the shipped file - which is the same reason no SRD row
   * string reaches a shipped one. `1-5 Handfuls` and `1-2 Chests` are typed
   * only in assertions like this one; `1 Handful` and
   * `Meals for a party of adventurers per night` only in those and in
   * `GoldAndLoot`'s docblock, which quotes them rather than drawing them. The
   * bare denominations are a different matter and never were the licence line:
   * `Handfuls`, `Bags` and `Chests` are this app's own purse vocabulary, typed
   * in `GoldEditor` (`ui/build/parts.tsx`), the print sheet and
   * `engine/gold.ts` since long before this table had a screen.
   */
  it('keeps the twelve prices as the book wrote them, ranges included', () => {
    const table = section().blocks[0]!.parts.find((p) => p.kind === 'table')!;
    expect(table.table.header).toEqual(['Expense', 'Cost']);
    // All twelve, not the ends and a count. The name of this case claims every
    // price, so every price is here: with rows 0, 8 and 11 pinned and the rest
    // left to `toHaveLength(12)`, editing `3 Handfuls` to `900 Chests` in
    // `data/srd-1.0.json` left the whole suite green.
    expect(table.table.rows).toEqual([
      ['Meals for a party of adventurers per night', '1 Handful'],
      ['Standard inn room per night', '1 Handful'],
      ['Luxury inn room per night', '1 Bag'],
      ['Carriage ride', '2 Handfuls'],
      ['Mount (horse, mule, etc.)', '3 Bags'],
      ['Specialized tools', '3 Handfuls'],
      ['Fine clothing', '3 Handfuls'],
      ['Luxury clothing', '1 Bag'],
      ['Tier 1 equipment (weapons, armor)', '1-5 Handfuls'],
      ['Tier 2 equipment (weapons, armor)', '1-2 Bags'],
      ['Tier 3 equipment (weapons, armor)', '5-10 Bags'],
      ['Tier 4 equipment (weapons, armor)', '1-2 Chests'],
    ]);
  });

  it('carries the sentence that makes the table a suggestion rather than a price list', () => {
    const lead = section().blocks[0]!.parts[3]!;
    expect(lead.kind === 'text' ? lead.text : '').toContain(
      'adjusting the entries in the Average Costs table',
    );
  });

  it('answers null when the dataset does not carry the section', () => {
    expect(goldAndLoot([])).toBeNull();
  });
});

describe('playerExperiences', () => {
  const guide = (): ReturnType<typeof playerExperiences> => playerExperiences(rules);

  it('finds the five groups without knowing what the heading above them says', () => {
    // Bullet-only is not enough on its own here: step 4 is a bare bullet list
    // too. Every bullet carrying a `Label:` picks this block out of eleven.
    expect(guide().groups.map((g) => g.label)).toEqual([
      'Backgrounds',
      'Characteristics',
      'Specialties',
      'Skills',
      'Phrases',
    ]);
    expect(guide().title).toBe('EXAMPLE EXPERIENCES');
    expect(guide().page).toBe(4);
  });

  it('carries seventy-nine names, where the wizard had five typed by hand', () => {
    const names = guide()
      .groups.flatMap((g) => g.text.split(',').map((n) => n.trim()))
      .filter((n) => n !== '');
    expect(names).toHaveLength(79);
    expect(names).toContain('Fallen Monarch');
    expect(names).toContain('Stubborn to a Fault');
    expect(names).toContain('Photographic Memory');
  });

  it('carries step 7’s rule, including the caution the wizard was paraphrasing', () => {
    const lead = guide().lead!;
    expect(lead.heading).toBe('STEP 7 Create Your Experiences.');
    const flat = lead.parts
      .flatMap((p) => {
        if (p.kind === 'text') return [p.text];
        if (p.kind === 'list') return p.items;
        return [p.table.header, ...p.table.rows].map((row) => row.join(' '));
      })
      .join('\n');
    expect(flat).toContain('a word or phrase used to encapsulate');
    expect(flat).toContain('two Experiences at character creation, each with a +2 modifier');
    // The rule with its own worked examples in it. The wizard used to restate
    // this in the app's words, which is how a house rule gets written.
    expect(flat).toContain('"Lucky" and "Highly Skilled" are too broad');
  });

  it('answers with nothing when the section is gone', () => {
    expect(playerExperiences([])).toEqual({ lead: null, title: '', groups: [], page: null });
  });
});
