/**
 * The rules the GM looks up by hand, selected out of the shipped dataset.
 *
 * Split from `ruleText.ts` on purpose. That file is the *reader* - which shape
 * a body arrived in - and this one is the *selector*: which section, which
 * table inside it, and what shape the screen wants it in. Neither imports
 * React and neither imports the store; both take `RulesSection[]` the way
 * `traitVerbs` already does, so a test can hand them a section it built by hand
 * and see the same code the screen runs.
 *
 * ## The rule this file exists to keep
 *
 * Every string these functions return came out of `data/srd-1.0.json` at
 * runtime. Not one rules sentence, table heading, row name or column name is
 * typed into this repository. `Manuali/` is gitignored precisely because that
 * wording belongs to Darrington Press, and an app that stamps `SRD 1.0 · P.73`
 * over text it typed itself is claiming a provenance it does not have - which
 * is the same defect as a screen reporting a save that never reached the disk,
 * pointed at a licence instead of at a disk.
 *
 * So the selectors below match on **section id** and on the SRD's own `## `
 * subheads, never on a row label, and they pivot tables by position within the
 * table they found. What they hand back is the dataset's wording, verbatim,
 * with its page number attached so the screen can say where it came from.
 *
 * ## A layer can replace any of this
 *
 * `rules` is in `dataset.ts`'s mergeable `COLLECTIONS`, so a homebrew layer can
 * rewrite a section outright. Every function here returns a named empty value
 * on a miss - the `NO_RULES` pattern `Conditions.tsx` uses - so a missing
 * section draws a blank panel instead of throwing. No row count is asserted
 * anywhere in `src`; the counts belong in the tests, against the shipped file.
 */
import type { RulesSection, Tier } from '../../../shared/types.ts';
import { paragraphs, ruleBlocks, ruleList, ruleTables } from './ruleText.ts';

// ---------------------------------------------------------------------------
// Benchmarks by tier
// ---------------------------------------------------------------------------

export interface BenchmarkColumn {
  /** The column's header cell, verbatim - `Tier 1`. */
  header: string;
  /**
   * The tier read out of that header, or null when there is no number in it.
   *
   * Null rather than a guess: the only thing the app does with this is mark the
   * column matching the campaign's party tier, and a layer that renames the
   * column should lose the marking rather than have it land on the wrong one.
   */
  tier: Tier | null;
  stats: Array<{ statistic: string; value: string }>;
}

export interface BenchmarkTable {
  /** The SRD's own heading: its `## ` subhead, or the section title. */
  title: string;
  columns: BenchmarkColumn[];
  page: number | null;
}

const NO_BENCHMARKS: BenchmarkTable = { title: '', columns: [], page: null };

/**
 * The first pipe table in a section, pivoted into one column per tier.
 *
 * "First" and not "the one whose header cell says X" for the reason in the
 * header: naming the column would mean typing it here. Both sections this is
 * pointed at carry exactly one table, and a layer that adds a second beside it
 * changes what the screen draws - which is what a layer is for.
 *
 * The row order is the table's own, so `Attack Modifier` keeps its `+` and
 * `Major 7/Severe 12` stays one string. `engine/encounter.ts` held a second
 * copy of this same table as typed numbers and had already lost both.
 */
function benchmarkTable(rules: RulesSection[], id: string): BenchmarkTable {
  const section = rules.find((r) => r.id === id);
  if (section === undefined) return NO_BENCHMARKS;

  for (const block of ruleBlocks(section.body)) {
    const table = ruleTables(block.text)[0];
    if (table === undefined) continue;
    const columns = table.header.slice(1).map((header, i) => {
      const digits = /\d+/.exec(header);
      const n = digits === null ? 0 : Number(digits[0]);
      return {
        header,
        tier: n >= 1 && n <= 4 ? (n as Tier) : null,
        stats: table.rows.flatMap((row) => {
          const statistic = row[0];
          const value = row[i + 1];
          // A ragged row - fewer cells than the header - loses the cells it
          // does not have rather than printing an empty one under a heading.
          return statistic === undefined || value === undefined ? [] : [{ statistic, value }];
        }),
      };
    });
    return { title: block.heading ?? section.title, columns, page: section.sourcePage ?? null };
  }
  return NO_BENCHMARKS;
}

/**
 * `rules['adversary-stat-block-benchmarks']`, p.73 - what to give an adversary
 * you are inventing at the table, or re-tiering one you are not.
 */
export function adversaryBenchmarks(rules: RulesSection[]): BenchmarkTable {
  return benchmarkTable(rules, 'adversary-stat-block-benchmarks');
}

/**
 * `rules['adapting-environments']`, p.102. The same question for the room the
 * fight is in, and the SRD keeps it in a different chapter thirty pages away -
 * which is exactly the kind of hand-search a reference screen is for.
 */
export function environmentBenchmarks(rules: RulesSection[]): BenchmarkTable {
  return benchmarkTable(rules, 'adapting-environments');
}

// ---------------------------------------------------------------------------
// Fear
// ---------------------------------------------------------------------------

export interface FearScene {
  scene: string;
  examples: string;
  /** `0-1 Fear` for an incidental scene. The dataset's figure, not the backlog's. */
  spend: string;
}

/**
 * One piece of the section, in the order the SRD wrote it.
 *
 * A sequence rather than a set of named fields, and that is the whole design
 * decision here. `rules['using-fear']` is four rules about the pool, then three
 * lists each under its own lead sentence, with the scene table in the middle of
 * them. Naming the parts - `spends`, `spendLead`, `sceneLead` - means picking
 * them out by position and *dropping the rest*, and what would have been
 * dropped is two thirds of the section: how to spend a large pool, and what a
 * Fear move is made of. Keeping the order keeps all of it, and keeps every
 * bullet under the sentence the book put above it.
 */
export type FearPart =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'scenes'; scenes: FearScene[] };

export interface FearGuidance {
  /** The section's own title. */
  title: string;
  parts: FearPart[];
  page: number | null;
}

const NO_FEAR: FearGuidance = { title: '', parts: [], page: null };

/**
 * `rules['using-fear']`, p.65 - the pool's own rules, what to spend it on, and
 * how much a scene is worth.
 *
 * The scene table is the reason this exists: the app has carried a Fear counter
 * with a maximum on it since the GM screen was built and has never once said
 * what a scene should cost. Incidental is `0-1 Fear` in the shipped dataset;
 * `BACKLOG.md` says `1-2`, and a builder copying the backlog would have shipped
 * a wrong number under an `SRD 1.0` stamp. Nothing here is typed - the numbers
 * and the examples both come off the table's own rows.
 */
export function fearGuidance(rules: RulesSection[]): FearGuidance {
  const section = rules.find((r) => r.id === 'using-fear');
  if (section === undefined) return NO_FEAR;

  const parts: FearPart[] = [];
  for (const para of paragraphs(section.body)) {
    const table = ruleTables(para)[0];
    if (table !== undefined) {
      parts.push({
        kind: 'scenes',
        scenes: table.rows.flatMap((row) => {
          const [scene, examples, spend] = row;
          return scene === undefined || examples === undefined || spend === undefined
            ? []
            : [{ scene, examples, spend }];
        }),
      });
      continue;
    }
    // A paragraph is a list only when *every* line in it is a bullet. A lead
    // sentence and its bullets are separate paragraphs in this dataset, and a
    // layer that runs them together should be drawn as the prose it is rather
    // than have its first line silently vanish.
    const items = ruleList(para);
    const lines = para.split('\n').filter((line) => line.trim() !== '');
    parts.push(
      items.length > 0 && items.length === lines.length
        ? { kind: 'list', items }
        : { kind: 'text', text: para },
    );
  }
  return { title: section.title, parts, page: section.sourcePage ?? null };
}

// ---------------------------------------------------------------------------
// Dynamic countdowns
// ---------------------------------------------------------------------------

export interface AdvanceCell {
  /** The cell's own words, whatever they are. */
  text: string;
  /**
   * How far the countdown moves, or **null** when there is no number in the
   * cell at all.
   *
   * Null is what stops the app inventing a tap. Six of the ten advancement
   * cells the SRD prints say `Tick down N`; the other four say `No
   * advancement`, and a button under those words would be offering to do
   * something the rule says does not happen. Only a cell whose number was
   * actually read is offered.
   */
  ticks: number | null;
}

export interface AdvanceRow {
  /** The row's first cell - the roll result. */
  roll: string;
  /** One per column after the first, in the table's order. */
  cells: AdvanceCell[];
}

export interface CountdownGuidance {
  /** The chart's own `## ` subhead. */
  title: string;
  /**
   * The paragraph immediately above that subhead.
   *
   * It is the sentence that tells a progress countdown from a consequence one,
   * and it has to be on screen: the persisted `CountdownKind` has only
   * `'dynamic'` in it, so the app does not know which of the two columns a
   * given row is, and it does not guess. The GM reads the SRD's own
   * distinction and presses the column they mean.
   */
  lead: string;
  /** The header cells after the first: what each `cells` position is. */
  columns: string[];
  rows: AdvanceRow[];
  page: number | null;
}

const NO_COUNTDOWNS: CountdownGuidance = {
  title: '',
  lead: '',
  columns: [],
  rows: [],
  page: null,
};

/**
 * `rules['countdowns']`, p.69, the five-row roll-result chart.
 *
 * Found as *the first block in the section that carries a table*, not by its
 * heading: `## DYNAMIC COUNTDOWN ADVANCEMENT` is the SRD's wording and typing
 * it here to search for it would put it in the repository. The lead is the last
 * paragraph of the block before that one, which is where the book puts the
 * sentence introducing the chart.
 */
export function countdownAdvancement(rules: RulesSection[]): CountdownGuidance {
  const section = rules.find((r) => r.id === 'countdowns');
  if (section === undefined) return NO_COUNTDOWNS;

  const blocks = ruleBlocks(section.body);
  for (const [i, block] of blocks.entries()) {
    const table = ruleTables(block.text)[0];
    if (table === undefined) continue;
    const before = paragraphs(blocks[i - 1]?.text ?? '');
    return {
      title: block.heading ?? section.title,
      lead: before[before.length - 1] ?? '',
      columns: table.header.slice(1),
      rows: table.rows.flatMap((row) => {
        const roll = row[0];
        if (roll === undefined) return [];
        return [
          {
            roll,
            cells: row.slice(1).map((text) => {
              const digits = /\d+/.exec(text);
              return { text, ticks: digits === null ? null : Number(digits[0]) };
            }),
          },
        ];
      }),
      page: section.sourcePage ?? null,
    };
  }
  return NO_COUNTDOWNS;
}
