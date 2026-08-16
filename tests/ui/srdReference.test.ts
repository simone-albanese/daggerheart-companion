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
  environmentBenchmarks,
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
