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
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset, RulesSection } from '@shared/types.ts';
import {
  adversaryBenchmarks,
  countdownAdvancement,
  environmentBenchmarks,
  fearGuidance,
  metreRange,
  metresFromFeet,
  rangeReference,
  type FearScene,
  type RangeEntry,
} from '../../src/ui/shared/srdReference.ts';

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

  it('answers with nothing when the section is gone', () => {
    expect(rangeReference([])).toEqual({ title: '', opening: [], sections: [], page: null });
  });
});
