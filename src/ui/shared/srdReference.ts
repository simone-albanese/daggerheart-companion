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
 * section at all: what it matches on is every word the GM typed, found
 * together in one line of the book, which is not this repository's text
 * either. It returns that line verbatim, and that is the same promise the rest
 * of the file makes, arrived at from the other direction. (This said *the
 * phrase the GM typed* until the section headed **Every word, in one line,
 * read with the title** was written into this same file, and the sweep that
 * re-took the figures below did not look at the top of its own file.)
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
import { slugify } from '../../../shared/slugify.ts';
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
 * sixty-four bullet paragraphs in the shipped file are already pure, so
 * neither test costs the dataset a thing today. Both are here for the layer
 * that is not this file. (It read "seventy" while the dataset carried
 * seventy-five sections, and was right then; folios 12 and 18 added four more
 * pure bullet paragraphs - beastform options, the companion's STEP 3, taking
 * damage as Stress, and levelling up - and the spelled-out number escaped the
 * sweep that moved the digits. `srdReference.test.ts` pins the figure now, and
 * it earned that on the first dataset change after it was written: dropping the
 * Witherwild frame took the count 74 -> 64, and the test went red on purpose
 * instead of the sentence ageing in silence a second time.)
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
 * dataset is not in. Every shipped section that carries a list or a table
 * printed its bullets with a literal `- ` in front of every line and its tables
 * as raw pipes. How many that is, is counted in `tests/ui/srdReference.test.ts`
 * and nowhere else: this sentence used to quote the figure and outlived it.
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

/** One of the eight boxes on the Ranger Companion sheet. */
export interface CompanionUpgrade {
  /**
   * Slug of the option's name, and the value persisted in `companion.upgrades`.
   *
   * `slugify` of the book's own name, which is what the hand-written list this
   * replaced already used - `light-in-the-dark`, `creature-comfort` - so every
   * sheet already saved, and every one already on a QR, marks the same boxes it
   * did before. A different derivation here silently unmarks them.
   */
  id: string;
  name: string;
  text: string;
}

/**
 * The eight level-up options for a companion, from folio 18.
 *
 * These were eight string literals in `src/engine/companion.ts` until the rules
 * stream reached the folio they are printed on. Licensed text typed into `src/`
 * is the thing this file exists to stop: the app stamps `SRD 1.0 · P.18` beside
 * what it draws, and that stamp is only honest about text it read out of
 * `data/srd-1.0.json`. It also means a layer that rewrites the sheet is now
 * obeyed rather than ignored.
 *
 * BEASTBOUND'S EXPERT TRAINING AND ADVANCED TRAINING
 * --------------------------------------------------
 * They are the two SRD features that change how many of these a player may
 * mark: the specialization's Expert Training reads "Choose an additional
 * level-up option for your companion" and the mastery's Advanced Training
 * "Choose two additional level-up options for your companion".
 *
 * They were once filed beside School of Knowledge's extra domain card, as the
 * other subclass "that changes a count the app enforces". That is wrong, and
 * the difference matters enough to keep written down rather than leave for
 * somebody to rediscover: they are not a domain-card grant.
 * `src/ui/build/cardAllowance.ts` counts cards a character draws from their
 * domains; these count boxes on the companion sheet, which is a different
 * sheet, a different resource and a different eight-item list. The table there
 * is keyed by subclass and tier and would happily hold a row for Beastbound,
 * and every reader of it would then hand a Ranger a domain card the SRD never
 * gave them. `tests/ui/cardAllowance.test.ts` holds the two mechanisms apart.
 *
 * Empty when the dataset has no such section, which the sheet says out loud
 * rather than drawing zero boxes as though the player had marked none.
 */
export function companionUpgrades(rules: RulesSection[]): CompanionUpgrade[] {
  const section = ruleSection(rules, 'leveling-up-your-companion');
  if (section === null) return [];
  return section.blocks
    .flatMap((block) => block.parts)
    .flatMap((part) => (part.kind === 'list' ? part.items : []))
    .flatMap((item) => {
      // "Name: text". An item the book sets without one is not an option, and
      // is dropped rather than shown as a box with no name on it.
      const at = item.indexOf(': ');
      if (at <= 0) return [];
      const name = item.slice(0, at);
      return [{ id: slugify(name), name, text: item.slice(at + 2) }];
    });
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
 * Four values now, and all four are read. `RuleSearch.tsx` draws its results as
 * the bands this order already is - IN THE TITLE, IN A HEADING, IN THE TEXT -
 * because "the words you typed are the name of this rule", "they are the name
 * of a part of it" and "they are somewhere in the middle of it" are three
 * different answers to a GM scanning a list, and the order this function
 * returns them in is invisible until it is labelled.
 *
 * `heading` arrived with the multi-term matcher below, and it is not
 * decoration. This book keeps its own answers under `## ` subheads - **156 of
 * them, across 36 of its 69 sections** - and a matcher that reads a body line
 * together with its section's title lands on those subheads constantly, because
 * a subhead is where the SRD writes the words a GM half-remembers: it is the
 * subhead, not the section title, that says FALLING AND COLLISION DAMAGE. A subhead names a rule the way a title does, so it
 * is banded beside the titles rather than left among the paragraphs. It costs a
 * third group header on a sheet that had two, and `RuleSearch.tsx` carries what
 * that is worth in pixels.
 *
 * `table` is the fourth because a hit that occurs only inside a pipe table has
 * no line worth quoting. `adversary-stat-block-benchmarks` holds its Severe
 * thresholds in a row that begins `| Damage Thresholds | Major 7/Severe 12 |`
 * and runs on through three more tiers; a preview showing one row of that,
 * stripped of the header that says which tier each cell belongs to, is worse
 * than saying the match is in this section's table and letting the tap draw the
 * table whole.
 */
export type RuleMatchKind = 'title' | 'heading' | 'text' | 'table';

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
  /**
   * True when this hit carries only *some* of the words the GM typed - the
   * fallback at the foot of `searchRules`, which fires only when nothing in the
   * dataset carries them all. Every hit in a result has the same value: the
   * fallback is the whole answer or none of it, which is what lets the screen
   * print one header over the list instead of a badge on each row.
   */
  partial: boolean;
}

/**
 * The words a GM puts in to make a sentence, and this search takes out.
 *
 * `how do I set the difficulty` is five words of grammar and one question.
 * Requiring `do` of a section requires nothing of it, and requiring it of the
 * same *line* as `difficulty` throws away the answer. So these go before the
 * AND runs.
 *
 * This is a closed list typed into this repository, which everywhere else in
 * this file is the forbidden move. It is allowed here for the reason the file's
 * header gives: these words are used only to **discard** part of what the GM
 * typed. Not one of them reaches the screen, and no string this search returns
 * is chosen by them - a section still has to carry the words that are left, in
 * its own spelling, before anything of the book's is quoted.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'were',
  'be', 'been', 'do', 'does', 'did', 'how', 'what', 'when', 'where', 'why', 'which', 'who',
  'my', 'me', 'i', 'it', 'its', 'with', 'at', 'by', 'from', 'as', 'that', 'this', 'these',
  'those', 'you', 'your', 'they', 'their', 'can', 'could', 'should', 'would', 'if', 'but',
  'not', 'no', 'so', 'up', 'out', 'get', 'got',
]);

/**
 * The query as the set of words a section will have to carry, lower-cased.
 *
 * Deduplicated, because `soft move hard move` asks for `move` once however many
 * times it was typed, and a term listed twice would be marked twice in the same
 * characters.
 *
 * **A query that is nothing but stopwords keeps its words.** `the` is a word of
 * the book as well as a word of English, and answering it with silence would be
 * the search saying "this dataset does not carry that" about a string on every
 * page of it. What it must not do is answer with *everything*: `terms.every()`
 * over an empty list is vacuously true, so an empty term list would make every
 * section a title hit - the same defect as an unguarded empty query, arriving
 * by a different road. Falling back to the words as typed closes both: `the`
 * searches for `the`, which is what it looks like it does.
 */
export function ruleTerms(query: string): string[] {
  const words = query.trim().replace(/\s+/g, ' ').toLowerCase().split(' ').filter((w) => w !== '');
  let kept = words.filter((w) => !STOPWORDS.has(w));
  if (kept.length === 0) kept = words;
  return [...new Set(kept)];
}

/** The line a section can show for a hit, or null when it has none worth showing. */
interface Quote {
  line: string | null;
  where: RuleMatchKind;
}

/**
 * The best body line that satisfies `wanted`, with the SRD's markup off it.
 *
 * **Best, not first, and the difference is three hits out of sixty-five.** A
 * `## ` subhead that satisfies the words is preferred over a paragraph that
 * does, wherever in the section it sits, and a line that spells one of those
 * words as a whole word is preferred over one that only carries it inside a
 * longer word. Taking the first satisfying line instead put
 * `multi target attack` on `Attacking`'s 355-character RESISTANCE, IMMUNITY,
 * AND DIRECT DAMAGE paragraph - banded IN THE TEXT, marking `multi` inside the
 * word *multiple* - while `## MULTI-TARGET ATTACK ROLLS`, eight lines further
 * down and the actual answer, was never shown. The other two are
 * `adversary attack roll` on `Adversary Action Rolls`, which owns
 * `## ADVERSARY ATTACKS`, and `fear feature adversary` on
 * `Example Adversary Features`, which owns `## FEAR FEATURES`.
 *
 * These are exactly the queries that name a rule the way the book names it, so
 * this is not a tie-break at the margin: it is the case the multi-term matcher
 * was built for. The preference costs the early return - a subhead can be
 * anywhere in the section, so a hit that lands on a paragraph reads the rest of
 * the body looking for one - and stops on the first subhead that is also a
 * whole-word match, which is the best rank there is.
 *
 * Whole-word is a *preference* and never a filter. The AND that decides whether
 * this section is a hit at all is `wanted`, unchanged and substring-based:
 * `condition` still finds `Conditions`, because the SRD's own inflections are
 * how a GM finds the book. `sharp` only breaks the tie between two lines that
 * both already satisfy it.
 *
 * A pipe row is remembered and skipped: a prose line further down the same
 * section is a better preview than any cell, and a section whose only match is
 * in a table still has to appear in the list.
 */
function quoteFrom(
  body: string,
  wanted: (line: string) => boolean,
  sharp: (line: string) => boolean,
): Quote | null {
  let inTable = false;
  let best: Quote | null = null;
  let bestRank = 4;
  for (const raw of body.split('\n')) {
    const text = raw.trim();
    if (text === '' || !wanted(text)) continue;
    if (text.startsWith('|')) {
      inTable = true;
      continue;
    }
    const line = text.replace(/^#+\s+/, '').replace(/^-\s+/, '');
    if (line === '') continue;
    const heading = /^#+\s/.test(text);
    const rank = (heading ? 0 : 2) + (sharp(text) ? 0 : 1);
    if (rank >= bestRank) continue;
    best = { line, where: heading ? 'heading' : 'text' };
    bestRank = rank;
    if (rank === 0) break;
  }
  if (best !== null) return best;
  return inTable ? { line: null, where: 'table' } : null;
}

/** Is `term` in `low` (already lowercased) as a word rather than inside one? */
function wholeWordIn(low: string, term: string): boolean {
  const wordish = (c: string | undefined): boolean =>
    c !== undefined && ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'));
  for (let at = low.indexOf(term); at !== -1; at = low.indexOf(term, at + 1)) {
    if (!wordish(low[at - 1]) && !wordish(low[at + term.length])) return true;
  }
  return false;
}

/**
 * Every section that carries every word of `query`, titles first - or, when no
 * section carries them all, the sections that carry some.
 *
 * ## There is no index, and that is a measurement rather than an opinion
 *
 * Measured on this machine against the shipped `data/srd-1.0.json`, on the Node
 * major `.nvmrc` names, 3000 iterations a query after 500 of warm-up, worst of
 * six queries: **0.244 ms** for the whole of what this function does, and the
 * worst of the six is now the query that matches nothing, because a query that
 * matches nothing still has to be rejected once per word. The phrase search
 * this replaced measures **0.145 ms** in the same process on the same run - it
 * recorded 0.172 ms in this docblock when it was taken on its own day, which is
 * the size of the noise between two runs on one machine and the reason a single
 * figure from either is not worth arguing with. The dataset under both is
 * **sixty-nine** sections - **107,884** bytes of JSON, **35,936** of it gzipped
 * at zlib's default level - inside a chunk `index.html` already preloads, the
 * Witherwild frame having been dropped.
 *
 * The multi-term matcher is the slower of the two and it is worth saying where
 * the time went, because it is not the AND. It is the **line split**: the cheap
 * reject now runs once per term, so more sections survive it than survived a
 * whole-phrase reject, and every survivor pays to split its body into lines.
 * That is the cost of the property this function exists for - a hit has to
 * prove a *single line* carries the words, and a line is the only unit that can
 * prove it. What that buys is still not a cost a keystroke can feel: 0.244 ms
 * is one part in sixty-eight of a 16.7 ms frame, and a phone's engine is slower
 * than this machine's by a single-digit factor, which at five times slower
 * still leaves the whole scan inside a thirteenth of the frame it was typed
 * into.
 *
 * So: no index, no precomputation, no worker, and no debounce. Each of those
 * would be a structure to keep in step with the dataset, bought with time
 * nobody was going to spend. A homebrew layer that rewrites `rules` is
 * searchable the instant it loads, because there is nothing to rebuild.
 *
 * The measurement did rule one thing out, and the numbers in it were stale
 * enough to be worth re-taking: they counted the Witherwild frame this dataset
 * no longer carries. **Collapsing the body's whitespace before matching costs
 * 2.14 ms** - nine times the whole scan - because it allocates a rewritten copy
 * of all **100,165** body characters on every keystroke, and it buys nothing:
 * not one of the **869** non-empty body lines in the shipped file carries two
 * spaces in a row, a tab, a carriage return or trailing space, and the
 * paragraphs are one line each, hard-wrapped nowhere. (It read 1.05 ms over
 * 122,437 characters and 969 lines before the frame was dropped. The
 * conclusion did not need re-taking; the three numbers did.) The query is
 * collapsed, because a person types the double space; the book is not, because
 * it does not contain one.
 *
 * ## Every word, in one line, read with the title
 *
 * This used to match one substring, and the sentence that defended it said an
 * AND over separate terms "would also answer with every section that says
 * 'close' in one paragraph and 'very' in another, and would then owe a preview
 * line that does not exist". **That objection was measured and it was correct.**
 * Over thirty natural GM phrasings, an AND asked of a whole *section* returns
 * **eighty-two** hits where the phrase search returned twenty, and
 * **seventeen** of the sixty-two it adds have their words in different
 * paragraphs: seventeen sections in a list, each owing a preview line that does
 * not exist. It is overturned by answering it, not by outvoting it.
 *
 * The rule is: a section matches when **one body line, read together with the
 * section's own title, carries every term**. Scoping to the line is what
 * removes those seventeen, and it removes nothing else - the line-scoped AND
 * returns **sixty-five** against the section-wide eighty-two, and eighty-two
 * less sixty-five is the seventeen. Of the forty-five hits it adds to the
 * phrase search's twenty, **not one** has its words in different paragraphs and
 * **not one** is unable to quote the line it is claiming.
 *
 * The rule as it was handed to this lane had a third clause - *and the line
 * carries at least one term itself* - to throw out the hit whose whole
 * evidence is the header. **Written as a guard it can never fire, and that is
 * structural rather than lucky.** A section whose title carries every term is
 * a title hit and returns above, before a line is ever read; so every section
 * that reaches this scan is missing at least one term from its title, and a
 * line that satisfies the AND has to supply that term out of its own
 * characters. The guarantee is the branch, not a second copy of the branch.
 * Probed as well as argued: over 40,000 one-, two- and three-word queries
 * drawn from the SRD's own 2,242-word vocabulary, the clause changed the
 * answer to none of them. It is gone, the property it protected is asserted
 * directly in `ruleSearch.test.tsx`, and a guard no test could ever kill is
 * exactly what `orphans.test.ts` exists to keep out of this tree.
 *
 * Reading the line *with the title* is what a GM already sees. Of the
 * sixty-one preview lines this returns over that query set, fifty carry every
 * word in the line itself; the other eleven split between the header and the
 * line, and on the glass those two are three lines apart inside one 44px tap
 * target. Nothing has to confess that the words are in different places,
 * because they are not in different places - they are both in the thing the GM
 * is looking at.
 *
 * What that bought, against the thirty: **twenty of them returned nothing**
 * before and two do now, and the section the query was asking for is found in
 * **twenty-eight** of thirty where nine were found before. `falling damage`
 * returned a blank screen while the SRD carried a subhead reading FALLING AND
 * COLLISION DAMAGE, and a blank screen reads as *the book does not cover this*.
 *
 * ## The order is the dataset's, split three ways
 *
 * Titles, then headings, then bodies, each in the order the dataset carries
 * them. The split is not a relevance score - this file does not rank rules, and
 * inventing weights would be the app deciding which of the SRD's sections a GM
 * meant. It is the distinction the data itself makes: a section whose *name* is
 * what you typed is a section you asked for by name, and a subhead is a name
 * too.
 *
 * ## When nothing carries them all
 *
 * The AND answers two of those thirty queries with nothing, and neither fails
 * on vocabulary. Both fail on an inflection: the book writes *sets* where the
 * GM typed *setting*, and *clear* where they typed *clearing*, and every other
 * word of both queries is on the page. Nothing here stems a word - a stemmer is
 * a table of English this repository would have to keep, and it would be
 * guessing at the SRD's vocabulary rather than reading it - so on an empty AND
 * the search falls back to OR, every section carrying at least one word, and
 * the screen labels that list with a header saying exactly that.
 *
 * **The fallback is weak, and the code should say so rather than the release
 * notes.** Those two queries return eighteen and sixteen sections, un-ranked,
 * and the section the GM wanted is eighth of the eighteen and sixth of the
 * sixteen. It beats a blank screen and it is not an answer. It is not ranked because ranking here would
 * be this file guessing, which is the thing it refuses to do everywhere else;
 * the honest fix is a stemmer or the SRD's own vocabulary, and neither is a
 * line of code.
 */
export function searchRules(rules: RulesSection[], query: string): RuleHit[] {
  const needle = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (needle === '') return [];
  const terms = ruleTerms(needle);

  const titles: RuleHit[] = [];
  const headings: RuleHit[] = [];
  const bodies: RuleHit[] = [];

  for (const section of rules) {
    const page = section.sourcePage ?? null;
    const title = section.title.toLowerCase();
    const seen = { id: section.id, title: section.title, page, partial: false };

    if (terms.every((t) => title.includes(t))) {
      titles.push({ ...seen, where: 'title', line: null });
      continue;
    }
    // The cheap reject, once per term. Most sections lose here on any real
    // query and never pay for the line split below.
    const body = section.body.toLowerCase();
    if (!terms.every((t) => body.includes(t) || title.includes(t))) continue;

    // Every word, in this line or in the header three lines above it on the
    // glass. This is the AND, and the scope of it is what makes it safe. The
    // second predicate decides nothing about membership - it only says which of
    // two satisfying lines is the better one to show, and the title side of it
    // stays a substring on purpose, because marking `Condition` inside
    // `Conditions` in the header is the behaviour that pairs the two words up.
    const quote = quoteFrom(
      section.body,
      (text) => {
        const low = text.toLowerCase();
        return terms.every((t) => low.includes(t) || title.includes(t));
      },
      (text) => {
        const low = text.toLowerCase();
        return terms.every((t) => wholeWordIn(low, t) || title.includes(t));
      },
    );
    if (quote === null) continue;
    if (quote.where === 'heading') {
      headings.push({ ...seen, ...quote });
      continue;
    }
    bodies.push({ ...seen, ...quote });
  }

  const all = [...titles, ...headings, ...bodies];
  // One word that is nowhere is a miss, not a search worth running twice.
  if (all.length === 0 && terms.length > 1) return someOf(rules, terms);
  return all;
}

/**
 * The fallback: every section carrying at least one of the words.
 *
 * In the dataset's order, unranked, and marked `partial` so the screen can put
 * one header over the whole list. Sorting these by how many words each carries
 * is the obvious next move and it is the move this file does not make: the
 * count of matched words is not a measure of which rule a GM meant, and a list
 * ordered by it would look like it was.
 */
function someOf(rules: RulesSection[], terms: string[]): RuleHit[] {
  const out: RuleHit[] = [];
  for (const section of rules) {
    const title = section.title.toLowerCase();
    const carries = (text: string): boolean => {
      const low = text.toLowerCase();
      return terms.some((t) => low.includes(t));
    };
    if (!carries(section.title) && !carries(section.body)) continue;
    const sharply = (text: string): boolean => {
      const low = text.toLowerCase();
      return terms.some((t) => wholeWordIn(low, t));
    };
    const quote = quoteFrom(section.body, carries, sharply) ?? { line: null, where: 'title' as const };
    out.push({
      id: section.id,
      title: section.title,
      page: section.sourcePage ?? null,
      partial: true,
      ...quote,
    });
  }
  return out;
}
