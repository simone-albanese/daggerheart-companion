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
 * `searchRules` at the foot of the file is the one selector that names no
 * section at all: what it matches on is the phrase the GM typed, which is not
 * this repository's text either. It returns a line of the book verbatim, and
 * that is the same promise the rest of the file makes, arrived at from the
 * other direction.
 *
 * ## A layer can replace any of this
 *
 * `rules` is in `dataset.ts`'s mergeable `COLLECTIONS`, so a homebrew layer can
 * rewrite a section outright. Every selector that names its own section returns
 * a named empty value on a miss - the `NO_RULES` pattern `Conditions.tsx` uses
 * - so a missing section draws a blank panel instead of throwing. `ruleSection`
 * is the one exception and answers **null**, because its section was named by a
 * person rather than by this file: the row that asked for it says the link is
 * unresolved and prints the ref, which is more use than an empty panel where a
 * rule the GM saved should be. No row count is asserted anywhere in `src`; the
 * counts belong in the tests, against the shipped file.
 */
import { TRAITS, type Ref, type RulesSection, type Tier, type Trait } from '../../../shared/types.ts';
import {
  paragraphs,
  ruleBlocks,
  ruleBullets,
  ruleList,
  ruleTables,
  type RuleBullet,
  type RuleTable,
} from './ruleText.ts';

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

// ---------------------------------------------------------------------------
// Range and distance - and the one figure on this screen the SRD does not give
// ---------------------------------------------------------------------------

/**
 * The international foot, exactly. 0.3048 metres, by definition since 1959.
 *
 * This is the only number in this file that did not come out of the dataset,
 * and it is not a rule - it is a unit conversion, the same kind of arithmetic
 * `Architecture.md` 3.1 already lets the app do on the rules' behalf.
 */
export const METRES_PER_FOOT = 0.3048;

/**
 * Feet to metres, rounded to the nearest half metre below ten and the nearest
 * whole metre from ten up.
 *
 * The SRD's distances are approximations - it writes "about 5-10 feet away" -
 * so printing 9.144 would claim a precision the source does not have, and
 * printing 9 for everything would lose the difference between the two shortest
 * ranges. Half metres where the numbers are small, whole ones where they are
 * not.
 *
 *   5 -> 1.5   10 -> 3   30 -> 9   100 -> 30   300 -> 91
 *
 * Continuous across the change of rounding: 32 feet is 9.75 m, which rounds up
 * to 10, and 33 feet is 10.06 m, which rounds down to 10. No gap and no jump.
 */
export function metresFromFeet(feet: number): number {
  const metres = feet * METRES_PER_FOOT;
  return metres < 10 ? Math.round(metres * 2) / 2 : Math.round(metres);
}

/**
 * `[5, 10]` -> `'1.5-3 m'`, and `[10, 10]` -> `'3 m'`.
 *
 * Two ends that round to the same figure are printed once. "3-3 m" is not a
 * range, it is a rounding artefact wearing a dash.
 */
export function metreRange(feet: [number, number]): string {
  const low = metresFromFeet(feet[0]);
  const high = metresFromFeet(feet[1]);
  return low === high ? `${String(low)} m` : `${String(low)}-${String(high)} m`;
}

export interface RangeEntry {
  /** The bullet's own label - the range's name, as the dataset writes it. */
  label: string;
  /** The rest of the bullet, verbatim. */
  text: string;
  /**
   * The two figures in the bullet, when it carries a distance in feet.
   *
   * Null for a bullet with no such figure, and that is load-bearing: two of
   * the six ranges the SRD lists carry no number at all, and a default here
   * would be the app inventing a distance the book declined to give.
   */
  feet: [number, number] | null;
  /** This app's conversion of `feet`. Null exactly when `feet` is. */
  metres: string | null;
}

export type RangePart =
  | { kind: 'text'; text: string }
  | { kind: 'entries'; entries: RangeEntry[] };

export interface RangeGuidance {
  title: string;
  /** Everything before the first `## ` subhead, in the book's order. */
  opening: RangePart[];
  /** Each subhead after it, with its own body. */
  sections: Array<{ heading: string; parts: RangePart[] }>;
  page: number | null;
}

const NO_RANGES: RangeGuidance = { title: '', opening: [], sections: [], page: null };

/**
 * A distance in feet, read out of a bullet that happens to carry one.
 *
 * Matched on the shape of the figure - numbers and the unit - and not on the
 * sentence around it. The SRD writes "about 5-10 feet away"; keying on the word
 * "about" would put the book's phrasing in this file, and a layer that dropped
 * it would silently lose every metric figure on the screen.
 *
 * **A span or a single figure.** All five shipped distances are spans, but the
 * screen's legend promises metres wherever a range line gives a distance in
 * feet, and a layer that writes "about 30 feet" has given one. A span is tried
 * first and wins outright: run the single-figure pattern over "20 - 40 feet"
 * and it matches the 40, which would print the top of the range as though it
 * were the whole of it.
 *
 * The first figure in the bullet wins. No bullet in the shipped section carries
 * two, and one that did would be a sentence about two different distances -
 * which is a thing to print whole, not to summarise into one conversion.
 */
function rangeEntry(bullet: { label: string; text: string }): RangeEntry {
  const span = /(\d+)\s*-\s*(\d+)\s+feet/i.exec(bullet.text);
  const single = span === null ? /(\d+)\s+feet/i.exec(bullet.text) : null;
  const feet: [number, number] | null =
    span !== null
      ? [Number(span[1]), Number(span[2])]
      : single === null
        ? null
        : [Number(single[1]), Number(single[1])];
  return {
    label: bullet.label,
    text: bullet.text,
    feet,
    metres: feet === null ? null : metreRange(feet),
  };
}

/**
 * A block's paragraphs, each one either a labelled list or the prose it is.
 *
 * The same "every line is a bullet" test `fearGuidance` uses, and for the same
 * reason: a lead sentence and its bullets are separate paragraphs here, and a
 * layer that runs them together must be drawn as prose rather than have its
 * first line silently vanish.
 */
function rangeParts(text: string): RangePart[] {
  return paragraphs(text).map((para) => {
    const bullets = ruleBullets(para);
    const lines = para.split('\n').filter((line) => line.trim() !== '');
    return bullets.length > 0 && bullets.length === lines.length
      ? { kind: 'entries', entries: bullets.map(rangeEntry) }
      : { kind: 'text', text: para };
  });
}

/**
 * `rules['maps-range-and-movement']`, p.40 - what Close and Far actually mean,
 * on a map and off one.
 *
 * The section is returned whole and in the book's order, because it is one
 * argument: the ranges, then how a range is measured, then the grid rule for a
 * table that wants squares, then moving, area of effect and cover. Nothing here
 * picks a paragraph out by position.
 *
 * The one thing this adds is `metres`, on every bullet that carries a figure in
 * feet. The SRD prints no metric column - it is not there to read - so the
 * number is the app's arithmetic and every screen that draws it says so on the
 * same line as the figure.
 */
export function rangeReference(rules: RulesSection[]): RangeGuidance {
  const section = rules.find((r) => r.id === 'maps-range-and-movement');
  if (section === undefined) return NO_RANGES;

  const blocks = ruleBlocks(section.body);
  const opening = blocks.find((b) => b.heading === null);
  return {
    title: section.title,
    opening: opening === undefined ? [] : rangeParts(opening.text),
    sections: blocks.flatMap((b) =>
      b.heading === null ? [] : [{ heading: b.heading, parts: rangeParts(b.text) }],
    ),
    page: section.sourcePage ?? null,
  };
}

/**
 * `[30, 100]` -> `'30-100 ft'`, and `[30, 30]` -> `'30 ft'`.
 *
 * `metreRange`'s twin for the unit the book is actually written in, and its
 * rule about a collapsed span is the same one: two ends that print the same
 * figure are printed once, because "30-30 ft" is not a range.
 *
 * Nothing here is arithmetic. Both figures are the SRD's own, lifted whole out
 * of the sentence that carries them, which is what lets a screen print this
 * beside an `SRD 1.0` stamp with no legend at all - unlike `metreRange`, whose
 * output is this app talking and has to say so on the same line as the number.
 */
export function feetRange(feet: [number, number]): string {
  return feet[0] === feet[1]
    ? `${String(feet[0])} ft`
    : `${String(feet[0])}-${String(feet[1])} ft`;
}

/**
 * What a reach is, keyed by the name a weapon wears - CLOSE, FAR, VERY FAR.
 *
 * `rangeReference` returns the whole section for a screen that is reading it.
 * This is for a screen that is not: the player sheet prints a weapon's range as
 * a word and nothing on it ever said what the word means, so a table that had
 * not memorised p.40 had a reach it could not act on. One lookup, off the same
 * bullets `RangeReference` draws, so a rules layer that redefines Far moves
 * both at once.
 *
 * KEYED CASE-INSENSITIVELY, because the two sides of the lookup come from
 * different files: the range on a weapon is `shared/types.ts`'s `Range` and the
 * key is a bullet label parsed out of `rules['maps-range-and-movement']`. They
 * agree exactly in the shipped SRD - Melee, Very Close, Close, Far, Very Far -
 * and a layer that writes one of them in a different case is a layer whose
 * ranges would otherwise silently lose their distances.
 *
 * ONLY THE OPENING BLOCK. The list of ranges is the section's lead; the folds
 * after it are about measuring, moving and cover, and a bullet in one of those
 * that happened to carry a figure in feet is not a definition of a range. The
 * first bullet for a label wins for the same reason.
 *
 * A range the book gives no figure for is present with `feet: null` rather than
 * absent - Melee is one, and so is Out of Range - because "the book declines to
 * say" and "this dataset has no range section at all" are different answers and
 * a caller has to be able to tell them apart.
 */
export function rangeDistances(rules: RulesSection[]): Map<string, RangeEntry> {
  const out = new Map<string, RangeEntry>();
  for (const part of rangeReference(rules).opening) {
    if (part.kind !== 'entries') continue;
    for (const entry of part.entries) {
      const key = entry.label.toLowerCase();
      if (!out.has(key)) out.set(key, entry);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export interface LadderRow {
  /** The row's first cell - the roll value the rest of the row is an example of. */
  roll: string;
  /**
   * One cell per verb, in the table's order, **not counting `roll`**.
   *
   * So `cells[i]` is the example under `verbs[i]` and the two arrays are always
   * the same length. Putting the roll value in here instead would make them
   * differ by one and the screen would print every sentence under the heading
   * beside the one it belongs to - which is the failure worth naming, because
   * it looks perfectly plausible on screen.
   */
  cells: string[];
}

export interface TraitLadder {
  /** The table's own header cells after `Roll`. Never a constant in this repo. */
  verbs: string[];
  rows: LadderRow[];
}

export interface DifficultyGuidance {
  title: string;
  /** The paragraphs before the first trait, which say who sets a Difficulty. */
  lead: string[];
  ladder: Partial<Record<Trait, TraitLadder>>;
  page: number | null;
}

const NO_DIFFICULTY: DifficultyGuidance = { title: '', lead: [], ladder: {}, page: null };

/**
 * `rules['difficulty-benchmarks']`, p.66 - six tables of worked examples, one
 * per trait, at 5, 10, 15, 20, 25 and 30.
 *
 * ## No adjectives
 *
 * The printed GM screen labels its Difficulty ladder with five adjectives
 * running from easiest to hardest. Not one of them occurs in
 * `data/srd-1.0.json`, so they are not this app's to print - and they are not
 * even written here in a comment, because `tests/ui/srdReference.test.ts`
 * sweeps `src/` for them and a comment is how a string gets copied into code.
 *
 * The SRD gives something better anyway: for each of the eighteen verbs it
 * prints a concrete sentence at every one of the six numbers, so a GM setting a
 * Difficulty reads "walk slowly across a narrow beam" rather than an adjective
 * somebody has to interpret.
 *
 * ## Keyed on the subhead, not on the first header cell
 *
 * All six tables begin `| Roll |`, so a lookup by header cell would return
 * Agility six times over. The key is the `## ` subhead above each table,
 * matched case-insensitively against the app's own six trait ids - `TRAITS` is
 * this app's vocabulary and predates the dataset, so matching on it is not the
 * same act as typing a rules sentence. A subhead that names nothing the app
 * knows is skipped rather than guessed at.
 *
 * The verbs come off the table's own header row for the same reason
 * `traitVerbs` reads them out of `character-creation`: `TRAIT_VERBS` in
 * `shared/types.ts` is a second copy of the same eighteen words, and a layer
 * that renames a verb has to rename the column it heads.
 */
export function difficultyBenchmarks(rules: RulesSection[]): DifficultyGuidance {
  const section = rules.find((r) => r.id === 'difficulty-benchmarks');
  if (section === undefined) return NO_DIFFICULTY;

  const ladder: Partial<Record<Trait, TraitLadder>> = {};
  let lead: string[] = [];
  for (const block of ruleBlocks(section.body)) {
    if (block.heading === null) {
      lead = paragraphs(block.text);
      continue;
    }
    const heading = block.heading.trim().toLowerCase();
    const trait = TRAITS.find((t) => t === heading);
    const table = ruleTables(block.text)[0];
    if (trait === undefined || table === undefined) continue;
    ladder[trait] = {
      verbs: table.header.slice(1),
      rows: table.rows.flatMap((row) => {
        const roll = row[0];
        return roll === undefined ? [] : [{ roll, cells: row.slice(1) }];
      }),
    };
  }
  return { title: section.title, lead, ladder, page: section.sourcePage ?? null };
}

// ---------------------------------------------------------------------------
// Any rules section - and the GM chapter and the Experiences, read through it
// ---------------------------------------------------------------------------

export type BlockPart =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; table: RuleTable };

/**
 * A body's paragraphs, each one a pipe table, a bare bullet list, or the prose
 * it is.
 *
 * The "every line is a bullet" test is the same one `fearGuidance` makes, and
 * for the same reason: a lead sentence and the bullets under it are separate
 * paragraphs in this dataset, and a layer that runs them together must be drawn
 * as the prose it now is rather than have its first line silently vanish. The
 * table test is that same test on the other shape - every line both begins and
 * ends with a pipe - so a lead sentence run into the top of a table is prose by
 * the same rule, rather than a table that has quietly eaten a sentence.
 *
 * Measured against `data/srd-1.0.json`: all twelve table paragraphs and all
 * seventy bullet paragraphs in the shipped file are already pure, so neither
 * test costs the dataset a thing today. Both are here for the layer that is not
 * this file.
 *
 * The SRD's own emitted markdown has no nesting - `making-gm-moves` writes a
 * lead bullet and its four sub-bullets at the same depth - so this flattens
 * nothing that was not already flat.
 */
function blockParts(text: string): BlockPart[] {
  return paragraphs(text).map((para) => {
    const lines = para.split('\n').filter((line) => line.trim() !== '');
    const pipes = lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 1 && trimmed.startsWith('|') && trimmed.endsWith('|');
    }).length;
    const table = ruleTables(para)[0];
    if (table !== undefined && pipes === lines.length) return { kind: 'table', table };
    const items = ruleList(para);
    return items.length > 0 && items.length === lines.length
      ? { kind: 'list', items }
      : { kind: 'text', text: para };
  });
}

export interface SectionBlock {
  /** The `## ` subhead, or null for whatever came before the first one. */
  heading: string | null;
  parts: BlockPart[];
}

export interface SectionView {
  id: string;
  title: string;
  page: number | null;
  blocks: SectionBlock[];
}

/**
 * One rules section, whole, in the shapes the book wrote it in. Null when the
 * dataset does not carry it.
 *
 * This is the rule-text pipeline in a single call, and it is what every surface
 * that prints a section somebody chose has to go through: the reference
 * region's GM chapter above, and the `ADD -> LINK -> Rule` row of a GM session.
 *
 * That row used to call `paragraphs()` by itself, which is the one shape the
 * dataset is not in. 38 of the 75 shipped sections carry a list or a table - 34
 * lists, 7 tables, 3 of them both - so 38 of the 75 rules a GM can put on a
 * session printed their bullets with a literal `- ` in front of every line and
 * their tables as raw pipes.
 */
export function ruleSection(rules: RulesSection[], id: string): SectionView | null {
  const section = rules.find((r) => r.id === id);
  if (section === undefined) return null;
  return {
    id,
    title: section.title,
    page: section.sourcePage ?? null,
    blocks: ruleBlocks(section.body).map((block) => ({
      heading: block.heading,
      parts: blockParts(block.text),
    })),
  };
}

/**
 * The five sections of the SRD that tell a GM what to actually do, in the order
 * this app draws them.
 *
 * Principles and practices are the pair the book keeps together on p.63; then
 * the mechanism on p.64; then the shorter restatement from the combat chapter
 * on p.37, which is the one that adds the Fear Feature note and which had no
 * home anywhere in this app; then the pitfalls, last, as the SRD has them.
 *
 * A section the dataset does not carry is skipped rather than drawn empty.
 */
const MOVE_SECTIONS = [
  'gm-principles',
  'gm-practices',
  'making-gm-moves',
  'gm-moves-and-adversary-actions',
  'pitfalls-to-avoid',
];

/**
 * `rules['gm-principles']` and its four siblings, whole.
 *
 * Nothing is picked out and nothing is summarised: every one of these sections
 * is a list of one-line instructions, and a screen that showed three of them
 * would be choosing which principles a GM gets. The screens fold them instead,
 * which costs a tap and keeps all of it.
 *
 * Headings are taken as they come. `pitfalls-to-avoid` writes five of its six
 * subheads in capitals and one in mixed case, so any matching that assumed
 * either would lose exactly one pitfall - and the app never gets to decide
 * which of the SRD's warnings is worth reading.
 */
export function gmMoves(rules: RulesSection[]): SectionView[] {
  return MOVE_SECTIONS.flatMap((id) => {
    const section = ruleSection(rules, id);
    return section === null ? [] : [section];
  });
}

export interface ExperienceExamples {
  /** The list's own `## ` subhead. */
  title: string;
  /** The block immediately above it: its subhead and its paragraphs. */
  lead: SectionBlock | null;
  items: string[];
  page: number | null;
}

const NO_EXAMPLES: ExperienceExamples = { title: '', lead: null, items: [], page: null };

/**
 * `rules['using-adversaries']`, p.71 - the eighteen Experiences the SRD offers
 * a GM improvising an adversary.
 *
 * Found as **the first block in the section that is nothing but bare bullets**,
 * not by its heading. The heading carries a trailing colon here and does not in
 * `character-creation`, so a lookup by name would have to know both spellings -
 * and knowing them means typing them. The bullet-only test picks it out of
 * fourteen blocks on its own: every other list in the section sits under a
 * paragraph of prose.
 *
 * `lead` is the block above it, which is the rule about spending a Fear to use
 * one. Without it the list is eighteen words with no stated effect.
 */
export function adversaryExperiences(rules: RulesSection[]): ExperienceExamples {
  const section = rules.find((r) => r.id === 'using-adversaries');
  if (section === undefined) return NO_EXAMPLES;

  const blocks = ruleBlocks(section.body);
  for (const [i, block] of blocks.entries()) {
    const parts = blockParts(block.text);
    const only = parts.length === 1 ? parts[0] : undefined;
    if (only?.kind !== 'list') continue;
    const before = blocks[i - 1];
    return {
      title: block.heading ?? section.title,
      lead:
        before === undefined
          ? null
          : { heading: before.heading, parts: blockParts(before.text) },
      items: only.items,
      page: section.sourcePage ?? null,
    };
  }
  return NO_EXAMPLES;
}

/**
 * `rules['giving-out-gold-equipment-and-loot']` - the Average Costs table and
 * the four paragraphs the SRD wraps it in.
 *
 * A thin call onto `ruleSection`, and thin on purpose: the section is already
 * in exactly the shape the screen wants, its one pipe table included, so a
 * selector that picked the table out of it would be a second parse of a body
 * `ruleSection` has already parsed. What this function is actually for is the
 * id. Every section id in this app is written here and nowhere else, because
 * `ReferenceTables.tsx` asking the dataset for a string it typed itself is how
 * a renderer starts carrying a copy of the book.
 *
 * The whole section, not the table alone. The twelve prices are worth nothing
 * without the sentence above them that says to adjust them to the campaign -
 * a GM who reads only the table reads it as a price list the rules impose,
 * which is the opposite of what the SRD says it is. That is the same argument
 * `gmMoves` makes about drawing a chapter whole, and `adversaryExperiences`
 * about carrying the rule above its list.
 *
 * Null when the dataset does not carry the section, so the screen can say so
 * rather than draw an empty panel.
 */
export function goldAndLoot(rules: RulesSection[]): SectionView | null {
  return ruleSection(rules, 'giving-out-gold-equipment-and-loot');
}

export interface PlayerExperiences {
  /**
   * The block above the list: what an Experience is, how many you get, and the
   * two things one may not be.
   *
   * The caution is the half that matters. It is a rule with worked examples in
   * it, and the wizard had been paraphrasing it - which is how a house rule
   * gets written by accident.
   */
  lead: SectionBlock | null;
  /** The list's own `## ` subhead. */
  title: string;
  /** `Backgrounds`, `Characteristics`, `Specialties`, `Skills`, `Phrases`. */
  groups: RuleBullet[];
  page: number | null;
}

const NO_PLAYER_EXAMPLES: PlayerExperiences = { lead: null, title: '', groups: [], page: null };

/**
 * `rules['character-creation']`, p.4 - step 7's rule, and the ninety-odd
 * examples under it.
 *
 * Found as **the first block that is nothing but labelled bullets**. The
 * bullet-only test alone is not enough here: step 4 is a bare bullet list too,
 * and this section has eleven blocks. Requiring every bullet to carry a
 * `Label:` picks this one out on its own, because the five groups are the only
 * labelled list in the section - and it does so without this file knowing that
 * the heading above it says EXAMPLE EXPERIENCES, which is the point.
 *
 * The wizard shows these. It used to show five of them, retyped out of the book
 * into a `.tsx` file, under a paraphrase of the caution beside them.
 */
export function playerExperiences(rules: RulesSection[]): PlayerExperiences {
  const section = rules.find((r) => r.id === 'character-creation');
  if (section === undefined) return NO_PLAYER_EXAMPLES;

  const blocks = ruleBlocks(section.body);
  for (const [i, block] of blocks.entries()) {
    const parts = blockParts(block.text);
    const only = parts.length === 1 ? parts[0] : undefined;
    if (only?.kind !== 'list') continue;
    const groups = ruleBullets(block.text);
    if (groups.length !== only.items.length) continue;
    const before = blocks[i - 1];
    return {
      lead:
        before === undefined
          ? null
          : { heading: before.heading, parts: blockParts(before.text) },
      title: block.heading ?? section.title,
      groups,
      page: section.sourcePage ?? null,
    };
  }
  return NO_PLAYER_EXAMPLES;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Where in a section the query landed.
 *
 * Three values rather than two, and all three are read. `RuleSearch.tsx` draws
 * its results as two groups - IN THE TITLE and IN THE TEXT - because "the words
 * you typed are the name of this rule" and "the words you typed are somewhere
 * in the middle of it" are different answers to a GM scanning a list, and the
 * order this function returns them in is invisible until it is labelled.
 *
 * `table` is the third because a hit that occurs only inside a pipe table has
 * no line worth quoting. `adversary-stat-block-benchmarks` holds its Severe
 * thresholds in a row that begins `| Damage Thresholds | Major 7/Severe 12 |`
 * and runs on through three more tiers; a preview showing one row of that,
 * stripped of the header that says which tier each cell belongs to, is worse
 * than saying the match is in this section's table and letting the tap draw the
 * table whole.
 */
export type RuleMatchKind = 'title' | 'text' | 'table';

export interface RuleHit {
  id: Ref;
  title: string;
  page: number | null;
  where: RuleMatchKind;
  /**
   * The body line the query landed in, verbatim and whole, with nothing but the
   * SRD's own leading `- ` or `## ` markup taken off the front. Null for a
   * `title` hit, which has no line to show, and for a `table` hit, which has no
   * line worth showing. Any shortening for a narrow column is the screen's
   * business and happens where the column's width is known.
   */
  line: string | null;
}

/**
 * Every section whose title or body carries `query`, titles first.
 *
 * ## There is no index, and that is a measurement rather than an opinion
 *
 * Measured on this machine against the shipped `data/srd-1.0.json`, on the
 * Node major `.nvmrc` names, 3000 iterations a query after 500 of warm-up,
 * worst of six queries including one that matches nothing: **0.172 ms** for the
 * whole of what this function does, **0.116 ms** for the reject pass on its own
 * and **0.0016 ms** for the titles alone. The seventy-five sections are 131,127
 * bytes of JSON, 44,888 of it gzipped at zlib's default level, inside a chunk
 * `index.html` already preloads. A phone's engine is slower than this machine's
 * by a single-digit factor, and that still leaves three orders of magnitude
 * between a keystroke and anything a person can feel.
 *
 * So: no index, no precomputation, no worker, and no debounce. Each of those
 * would be a structure to keep in step with the dataset, bought with time
 * nobody was going to spend. A homebrew layer that rewrites `rules` is
 * searchable the instant it loads, because there is nothing to rebuild.
 *
 * The measurement did rule one thing out. **Collapsing the body's whitespace
 * before matching costs 1.05 ms** - six times the whole scan - because it
 * allocates a rewritten copy of all 122,437 characters on every keystroke, and
 * it buys nothing: not one of the 969 non-empty body lines in the shipped file
 * carries two spaces in a row, a tab, a carriage return or trailing space, and
 * the paragraphs are one line each, hard-wrapped nowhere, so a phrase never
 * straddles a newline. The query is collapsed, because a person types the
 * double space; the book is not, because it does not contain one.
 *
 * ## One substring, not a set of words
 *
 * `very close` matches the bullet that says "Very Close", and does not match a
 * section that says "close" in one paragraph and "very" in another. An AND over
 * separate terms would then owe an answer to "which line is the preview, when
 * the two words are eight paragraphs apart", and there is no honest one. What a
 * GM types here is a phrase they half-remember off a page, so a phrase is what
 * is matched.
 *
 * ## The order is the dataset's, split once
 *
 * Titles first, then bodies, each in the order the dataset carries them. The
 * split is not a relevance score - this file does not rank rules, and inventing
 * weights would be the app deciding which of the SRD's sections a GM meant. It
 * is the one distinction the data itself makes: a section whose *name* is what
 * you typed is a section you asked for by name.
 */
export function searchRules(rules: RulesSection[], query: string): RuleHit[] {
  const needle = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (needle === '') return [];

  const titles: RuleHit[] = [];
  const bodies: RuleHit[] = [];

  for (const section of rules) {
    const page = section.sourcePage ?? null;
    if (section.title.toLowerCase().includes(needle)) {
      titles.push({ id: section.id, title: section.title, page, where: 'title', line: null });
      continue;
    }
    // The cheap reject. Most sections lose here on any real query and never pay
    // for the line split below.
    if (!section.body.toLowerCase().includes(needle)) continue;

    let line: string | null = null;
    let inTable = false;
    for (const raw of section.body.split('\n')) {
      const text = raw.trim();
      if (text === '' || !text.toLowerCase().includes(needle)) continue;
      // A pipe row is remembered and skipped: a prose line further down the
      // same section is a better preview than any cell, and a section whose
      // only match is in a table still has to appear in the list.
      if (text.startsWith('|')) {
        inTable = true;
        continue;
      }
      line = text.replace(/^#+\s+/, '').replace(/^-\s+/, '');
      break;
    }
    bodies.push({
      id: section.id,
      title: section.title,
      page,
      where: line === null && inTable ? 'table' : 'text',
      line,
    });
  }

  return [...titles, ...bodies];
}
