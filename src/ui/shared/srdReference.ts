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
import { TRAITS, type RulesSection, type Tier, type Trait } from '../../../shared/types.ts';
import {
  paragraphs,
  ruleBlocks,
  ruleBullets,
  ruleList,
  ruleTables,
  type RuleBullet,
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
// The GM chapter, and the adversary Experiences
// ---------------------------------------------------------------------------

export type ProsePart = { kind: 'text'; text: string } | { kind: 'list'; items: string[] };

/**
 * A body's paragraphs, each one either a bare bullet list or the prose it is.
 *
 * The "every line is a bullet" test is the same one `fearGuidance` makes, and
 * for the same reason: a lead sentence and the bullets under it are separate
 * paragraphs in this dataset, and a layer that runs them together must be drawn
 * as the prose it now is rather than have its first line silently vanish.
 *
 * The SRD's own emitted markdown has no nesting - `making-gm-moves` writes a
 * lead bullet and its four sub-bullets at the same depth - so this flattens
 * nothing that was not already flat.
 */
function proseParts(text: string): ProsePart[] {
  return paragraphs(text).map((para) => {
    const items = ruleList(para);
    const lines = para.split('\n').filter((line) => line.trim() !== '');
    return items.length > 0 && items.length === lines.length
      ? { kind: 'list', items }
      : { kind: 'text', text: para };
  });
}

export interface MovesBlock {
  /** The `## ` subhead, or null for whatever came before the first one. */
  heading: string | null;
  parts: ProsePart[];
}

export interface MovesSection {
  id: string;
  title: string;
  page: number | null;
  blocks: MovesBlock[];
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
export function gmMoves(rules: RulesSection[]): MovesSection[] {
  return MOVE_SECTIONS.flatMap((id) => {
    const section = rules.find((r) => r.id === id);
    if (section === undefined) return [];
    return [
      {
        id,
        title: section.title,
        page: section.sourcePage ?? null,
        blocks: ruleBlocks(section.body).map((block) => ({
          heading: block.heading,
          parts: proseParts(block.text),
        })),
      },
    ];
  });
}

export interface ExperienceExamples {
  /** The list's own `## ` subhead. */
  title: string;
  /** The block immediately above it: its subhead and its paragraphs. */
  lead: MovesBlock | null;
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
    const parts = proseParts(block.text);
    const only = parts.length === 1 ? parts[0] : undefined;
    if (only?.kind !== 'list') continue;
    const before = blocks[i - 1];
    return {
      title: block.heading ?? section.title,
      lead:
        before === undefined
          ? null
          : { heading: before.heading, parts: proseParts(before.text) },
      items: only.items,
      page: section.sourcePage ?? null,
    };
  }
  return NO_EXAMPLES;
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
  lead: MovesBlock | null;
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
    const parts = proseParts(block.text);
    const only = parts.length === 1 ? parts[0] : undefined;
    if (only?.kind !== 'list') continue;
    const groups = ruleBullets(block.text);
    if (groups.length !== only.items.length) continue;
    const before = blocks[i - 1];
    return {
      lead:
        before === undefined
          ? null
          : { heading: before.heading, parts: proseParts(before.text) },
      title: block.heading ?? section.title,
      groups,
      page: section.sourcePage ?? null,
    };
  }
  return NO_PLAYER_EXAMPLES;
}
