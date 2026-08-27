/**
 * The membership: that it says what was ratified, and that it stays true.
 *
 * `SECTION_MOMENTS` is a hand-written table keyed by dataset ref, which is the
 * one kind of data this repo cannot generate and cannot check by re-deriving:
 * a moment is this app's judgement about when a GM reaches for a page, and the
 * SRD does not contain it. So the guard has to come from two directions at
 * once, and this file is both.
 *
 * **Against the decision.** The owner ratified all sixty-nine rows on
 * 26 August, line by line, including the seven that declared themselves
 * contested. That ratification lives in
 * `docs/handoff/BALLOT-MOMENTI-2026-08-26.json`, and the first test below
 * compares the shipped table against it pair for pair. A transcription slip -
 * a section given a moment it was not given, or one dropped - fails here and
 * names the section. Nothing in this file retypes the answer: the answer is
 * read from the document that carries it.
 *
 * **Against the dataset.** A ref is a string, and a string cannot know that the
 * section it names has been renamed out from under it. The three tests after
 * that are the shape `dicePools.test.ts` and `modifiers.test.ts` already use
 * for the same problem: everything mapped must resolve, everything shipped
 * must be accounted for, and nothing may be excused that no longer exists.
 *
 * ## The exclusion list is here, and that is the point of it
 *
 * `MOMENTLESS` is not exported from `src/`. Eight sections belong to no moment
 * and the list of them is what this guard is allowed to skip, so it belongs to
 * the guard - the same place `dicePools.test.ts` keeps `NOT_A_POOL`. Kept in
 * `src/` it would be an export with no caller, which this repo treats as a
 * feature shipped switched off.
 *
 * It is a list and not a seventh moment, and that was decided by measurement:
 * `ShowSheet`'s chip grid is `repeat(3, 1fr)`, so a seventh chip makes it three
 * rows and costs 52px in a column that fits by 0.3px.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import { MOMENTS, searchAsk, type AskEntry, type Moment } from '../../src/ui/shared/ask.ts';
import { ASK_CATALOGUE } from '../../src/ui/shared/askCatalogue.ts';
import { SECTION_MOMENTS, sectionsIn } from '../../src/ui/shared/moments.ts';

/**
 * The eight sections that belong to no moment, with the property that puts
 * them here rather than the argument for each - the argument is the ballot's,
 * and it stays in the ballot.
 *
 * None of them is read at the table while people wait. Every one is either the
 * document talking about itself, or something done before play starts.
 */
const MOMENTLESS: readonly string[] = [
  'introduction', // the document describing itself
  'ranger-companion', // a sheet built before play
  'multiclassing', // a choice taken at a level-up
  'running-an-adventure', // a campaign, not a beat
  'gm-guidance', // how to be a GM at all
  'additional-gm-guidance', // the same, one page further
  'preparing-combat-encounters', // preparation, done away from the table
  'campaign-frames', // the shape of a whole campaign
];

interface BallotRow {
  id: string;
  moments: Moment[];
}

const ballot = JSON.parse(
  readFileSync(new URL('../../docs/handoff/BALLOT-MOMENTI-2026-08-26.json', import.meta.url), 'utf8'),
) as BallotRow[];

const sections = baseDataset.rules;
const ids = new Set(sections.map((section) => section.id));

describe('the shipped membership says what was ratified', () => {
  it('carries every pair the ballot carries, and no others', () => {
    const want = Object.fromEntries(
      ballot.filter((row) => row.moments.length > 0).map((row) => [row.id, [...row.moments].sort()]),
    );
    const got = Object.fromEntries(
      Object.entries(SECTION_MOMENTS).map(([id, ms]) => [id, [...ms].sort()]),
    );
    expect(got).toEqual(want);
  });

  it('leaves out exactly the sections the ballot left out', () => {
    const ballotOrphans = ballot.filter((row) => row.moments.length === 0).map((row) => row.id);
    expect([...MOMENTLESS].sort()).toEqual([...ballotOrphans].sort());
  });

  it('is the shape the ratification recorded', () => {
    /*
     * The three counts the owner's decision states, checked against the
     * shipped table rather than against the ballot - so this fails if the
     * table drifts even where the document does not. They are the
     * specification, which is the one thing a test may carry as a literal.
     */
    const memberships = Object.values(SECTION_MOMENTS).reduce((n, ms) => n + ms.length, 0);
    expect(Object.keys(SECTION_MOMENTS), 'sections with at least one moment').toHaveLength(61);
    expect(memberships, 'memberships in total').toBe(94);
    expect(MOMENTLESS, 'sections with none').toHaveLength(8);

    const arity = Object.values(SECTION_MOMENTS).map((ms) => ms.length);
    expect(arity.filter((n) => n === 1), 'one moment').toHaveLength(30);
    expect(arity.filter((n) => n === 2), 'two moments').toHaveLength(29);
    expect(arity.filter((n) => n === 3), 'three moments').toHaveLength(2);
  });
});

describe('the membership stays true to the dataset', () => {
  it('names only sections the dataset has', () => {
    const strangers = Object.keys(SECTION_MOMENTS).filter((id) => !ids.has(id));
    expect(strangers, 'these are mapped to a moment and are not in the dataset').toEqual([]);
  });

  it('leaves no section unaccounted for', () => {
    /*
     * The direction that makes the exclusion list load-bearing. Without it a
     * section added to the SRD would simply never appear under any chip, and
     * nothing would say so: it would look like a section nobody had written a
     * moment for, which is indistinguishable from one nobody noticed.
     */
    const excused = new Set(MOMENTLESS);
    const unaccounted = sections
      .map((section) => section.id)
      .filter((id) => SECTION_MOMENTS[id] === undefined && !excused.has(id));
    expect(
      unaccounted,
      'these ship in the dataset, belong to no moment, and are not on the exclusion list',
    ).toEqual([]);
  });

  it('excuses nothing that has gone', () => {
    const stale = MOMENTLESS.filter((id) => !ids.has(id));
    expect(stale, 'these are excused from having a moment and no longer exist').toEqual([]);
  });

  it('names only moments that exist', () => {
    const known = new Set(MOMENTS.map((moment) => moment.id));
    const unknown = Object.entries(SECTION_MOMENTS).flatMap(([id, ms]) =>
      ms.filter((m) => !known.has(m)).map((m) => `${id}:${m}`),
    );
    expect(unknown).toEqual([]);
  });

  it('accounts for all sixty-nine, and the count is what the exclusion list rests on', () => {
    expect(sections, 'the shipped rules sections').toHaveLength(69);
    expect(Object.keys(SECTION_MOMENTS).length + MOMENTLESS.length).toBe(sections.length);
  });
});

describe('the membership agrees with the other judgement of the same sections', () => {
  it('never points a question at a section with no moment', () => {
    /*
     * The catalogue and the ballot are two judgements about the same
     * sixty-nine sections, made months apart. A question filed under DAMAGE
     * whose section belongs to no moment would mean one of the two is wrong,
     * and the chip would draw the question over a section the same chip
     * refuses to list.
     */
    const excused = new Set(MOMENTLESS);
    const contradictions = ASK_CATALOGUE.filter((entry) => excused.has(entry.at.section)).map(
      (entry) => `${entry.id} -> ${entry.at.section}`,
    );
    expect(contradictions).toEqual([]);
  });

  it('gives every question’s own moment to the section it points at', () => {
    const wrong = ASK_CATALOGUE.filter((entry) => entry.moment !== null)
      .filter((entry) => !(SECTION_MOMENTS[entry.at.section] ?? []).includes(entry.moment!))
      .map((entry) => `${entry.id} is ${String(entry.moment)} but ${entry.at.section} is not`);
    expect(wrong).toEqual([]);
  });
});

describe('sectionsIn', () => {
  it('returns the dataset’s order and never a ranking', () => {
    for (const moment of MOMENTS) {
      const got = sectionsIn(sections, moment.id).map((section) => section.id);
      const order = sections
        .map((section) => section.id)
        .filter((id) => (SECTION_MOMENTS[id] ?? []).includes(moment.id));
      expect(got, moment.label).toEqual(order);
    }
  });

  it('gives every moment members, so no chip answers with nothing', () => {
    for (const moment of MOMENTS) {
      expect(sectionsIn(sections, moment.id).length, moment.label).toBeGreaterThan(0);
    }
  });

  it('follows a layer that rewrote a section rather than holding a copy', () => {
    // The membership is keyed on the id, so a layer that changes a section's
    // words changes what this returns without touching the table.
    const [first] = sectionsIn(sections, MOMENTS[0]!.id);
    const rewritten = sections.map((section) =>
      section.id === first!.id ? { ...section, title: 'A layer wrote this' } : section,
    );
    expect(sectionsIn(rewritten, MOMENTS[0]!.id)[0]?.title).toBe('A layer wrote this');
  });
});

describe('a moment filters the questions by the field, not by the words on the chip', () => {
  /*
   * On the shipped catalogue the two agree exactly - pressing DAMAGE returns
   * precisely the entries filed under `damage` - and that agreement is a
   * coincidence rather than a mechanism. `searchAsk` puts the moment's *label*
   * into its haystack, so it matches an entry whose own words happen to
   * contain another moment's label, and it stops matching one whose label is
   * reworded. `ask.ts` says out loud that a label may be reworded without
   * touching the entries.
   *
   * Because they agree today, no assertion against the real catalogue can tell
   * the two apart - a mutant that swapped the filter back for `searchAsk`
   * survived every test in this suite. So the claim is proved where it can be:
   * on a catalogue built to make them differ.
   */
  const entry = (id: string, ask: string, also: string[], moment: Moment | null): AskEntry => ({
    id,
    ask,
    also,
    at: { section: 'attacking', heading: null, part: null },
    moment,
  });

  it('does not take an entry whose own words carry another moment’s label', () => {
    const catalogue: readonly AskEntry[] = [
      entry('q-real', 'What happens when they take a hit?', [], 'damage'),
      // Filed under a different moment, but its own words name DAMAGE.
      entry('q-impostor', 'How do I describe damage to a room?', ['damage'], 'this-place'),
    ];
    const label = MOMENTS.find((m) => m.id === 'damage')!.label.toLowerCase();

    const byLabel = searchAsk(catalogue, label).map((e) => e.id);
    const byField = catalogue.filter((e) => e.moment === 'damage').map((e) => e.id);

    expect(byLabel, 'the label match should have taken the impostor').toEqual([
      'q-real',
      'q-impostor',
    ]);
    expect(byField, 'the field match takes only what is filed under the moment').toEqual([
      'q-real',
    ]);
    expect(byField).not.toEqual(byLabel);
  });

  it('still takes an entry after its moment’s label is reworded', () => {
    const catalogue: readonly AskEntry[] = [entry('q-real', 'What now?', [], 'damage')];
    // The label is what `searchAsk` matches on, so a query that is no longer
    // the label finds nothing - while the field is unmoved.
    expect(searchAsk(catalogue, 'harm taken').map((e) => e.id)).toEqual([]);
    expect(catalogue.filter((e) => e.moment === 'damage').map((e) => e.id)).toEqual(['q-real']);
  });
});
