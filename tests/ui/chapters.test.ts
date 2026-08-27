/**
 * The chapter table: that it is the book's, and that it stays the book's.
 *
 * `SECTION_CHAPTER` is a hand-written table keyed by dataset ref, like
 * `SECTION_MOMENTS` - but the two are guarded differently, and the difference
 * is the whole reason this file is not a copy of `moments.test.ts`.
 *
 * A moment is this app's judgement, so its guard has to read the ballot that
 * ratified it: there is nothing to re-derive from. **A chapter is a fact about
 * the book**, and it can be re-derived, so this file does. The book sets its
 * chapter openers at 28pt and there are exactly seven such lines in the whole
 * PDF; a section's chapter is the last opener at or before its `sourcePage`.
 * `computed` below applies that rule to the shipped dataset and compares the
 * result to the shipped table, section by section.
 *
 * That is the assertion that matters, and it is the one that would have caught
 * this table's first draft - a six-way split that made subheads
 * (`ADVERSARIES AND ENVIRONMENTS`, `ADDITIONAL GM GUIDANCE`, both 20pt) into
 * chapters, put `gold` in an "Equipment" chapter the book does not have, and
 * named the first chapter after `the-basics`, one of its own rows. Every one of
 * those fails `recomputes the book's own grouping` on its first run.
 *
 * ## There is no exclusion list, and there must never be one
 *
 * `moments.test.ts` owns `MOMENTLESS` because eight sections belong to no
 * moment. **Zero sections belong to no chapter**, because every page of the
 * book is inside one, so the partition below has no escape hatch. If somebody
 * ever needs to add one, the table has stopped being the book's and the fix is
 * the table, not the guard.
 *
 * ## The licence guard
 *
 * Five of the SRD's headings are typed into `src/ui/shared/chapters.ts`. The
 * rule this repository actually holds is `srdIndex.ts`'s - *a label is never in
 * the haystack* - and `no chapter label is searchable` is what keeps these five
 * inside it. `no SRD prose is typed into the screens that draw the index` is
 * the same constraint stated as a property rather than as an intention: it
 * reads the source files and fails the first time anybody pastes a sentence of
 * the book into one. `tests/ui/licences.test.tsx` already reads `src/` from a
 * test, so the shape is one this suite has.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseDataset } from '../../src/store/dataset.ts';
import {
  CHAPTER_LABELS,
  SECTION_CHAPTER,
  SRD_CHAPTERS,
  sectionsInChapter,
  type SrdChapter,
} from '../../src/ui/shared/chapters.ts';
import { srdIndex } from '../../src/ui/shared/srdIndex.ts';
import type { RulesSection } from '../../shared/types.ts';

const sections = baseDataset.rules;

/**
 * The folio each chapter opens on - the 28pt heading's own page.
 *
 * **Here and not in `src/`**, which is where `moments.test.ts` keeps `MOMENTLESS`
 * and `dicePools.test.ts` keeps `NOT_A_POOL`, for the same reason: nothing in
 * the running app reads these, and an export with no caller is a feature that
 * ships switched off - `tests/harness/orphans.test.ts` fails on exactly that.
 * It is also what makes the recomputation below a second opinion rather than
 * the table agreeing with the constant it was generated from.
 *
 * Five integers and no words of the book's, so it is an address in `at.part`'s
 * sense: an address may be written down when it is checked against the dataset
 * every run, and this one is - by the very test it feeds.
 */
const CHAPTER_OPENS: Record<SrdChapter, number> = {
  introduction: 3,
  'character-creation': 4,
  'core-materials': 7,
  'core-mechanics': 35,
  'running-an-adventure': 63,
};

/** The book's rule, applied rather than transcribed. */
const computed = (page: number | undefined): SrdChapter => {
  let chapter: SrdChapter = SRD_CHAPTERS[0];
  for (const candidate of SRD_CHAPTERS) {
    if ((page ?? 0) >= CHAPTER_OPENS[candidate]) chapter = candidate;
  }
  return chapter;
};

/** What the derivation recorded. Kept as a literal because it IS the spec. */
const SHAPE: Record<SrdChapter, number> = {
  introduction: 4,
  'character-creation': 1,
  'core-materials': 5,
  'core-mechanics': 24,
  'running-an-adventure': 35,
};

describe('the chapter table', () => {
  it('puts every shipped section in exactly one chapter, with nothing left over', () => {
    // Asked of the dataset first, never typed beside the assertion.
    expect(Object.keys(SECTION_CHAPTER)).toHaveLength(sections.length);

    const unaccounted = sections
      .filter((section) => SECTION_CHAPTER[section.id] === undefined)
      .map((section) => section.id);
    expect(unaccounted).toEqual([]);

    const shipped = new Set(sections.map((section) => section.id));
    const strangers = Object.keys(SECTION_CHAPTER).filter((ref) => !shipped.has(ref));
    expect(strangers).toEqual([]);

    const chapters = new Set<string>(SRD_CHAPTERS);
    const foreign = Object.entries(SECTION_CHAPTER).filter(([, c]) => !chapters.has(c));
    expect(foreign).toEqual([]);
  });

  /**
   * The load-bearing one. Everything else in this file could pass while the
   * table said something the book does not.
   */
  it("recomputes the book's own grouping and gets the shipped table back", () => {
    const disagreements = sections
      .filter((section) => SECTION_CHAPTER[section.id] !== computed(section.sourcePage))
      .map((section) => ({
        id: section.id,
        page: section.sourcePage,
        table: SECTION_CHAPTER[section.id],
        book: computed(section.sourcePage),
      }));
    expect(disagreements).toEqual([]);
  });

  it('holds the shape the derivation recorded, so the table cannot drift silently', () => {
    const counted = Object.fromEntries(
      SRD_CHAPTERS.map((chapter) => [chapter, sectionsInChapter(sections, chapter).length]),
    );
    expect(counted).toEqual(SHAPE);
    expect(Object.values(SHAPE).reduce((a, b) => a + b, 0)).toBe(sections.length);
  });

  it('leaves no chapter empty, so no chapter row can answer with nothing', () => {
    const empty = SRD_CHAPTERS.filter((c) => sectionsInChapter(sections, c).length === 0);
    expect(empty).toEqual([]);
  });

  it('opens the chapters in book order', () => {
    const opens = SRD_CHAPTERS.map((c) => CHAPTER_OPENS[c]);
    expect(opens).toEqual([...opens].sort((a, b) => a - b));
    expect(new Set(opens).size).toBe(opens.length);
  });
});

describe('sectionsInChapter', () => {
  it("returns the dataset's own order and never a ranking", () => {
    for (const chapter of SRD_CHAPTERS) {
      const got = sectionsInChapter(sections, chapter).map((s) => s.id);
      const expected = sections.filter((s) => SECTION_CHAPTER[s.id] === chapter).map((s) => s.id);
      expect(got).toEqual(expected);
    }
  });

  it('follows a layer that rewrote a section rather than holding a copy of its own', () => {
    const first = sectionsInChapter(sections, 'core-mechanics')[0];
    expect(first).toBeDefined();
    const layered: RulesSection[] = sections.map((s) =>
      s.id === first!.id ? { ...s, title: 'REWRITTEN BY A LAYER' } : s,
    );
    const got = sectionsInChapter(layered, 'core-mechanics')[0];
    expect(got?.title).toBe('REWRITTEN BY A LAYER');
  });

  it('leaves a section the book never printed out of every chapter, and says so by omission', () => {
    const invented: RulesSection = {
      id: 'a-homebrew-section',
      title: 'A Homebrew Section',
      body: 'Something a layer added.',
      sourcePage: 40,
    };
    const layered = [...sections, invented];
    const everywhere = SRD_CHAPTERS.flatMap((c) => sectionsInChapter(layered, c).map((s) => s.id));
    expect(everywhere).not.toContain('a-homebrew-section');
    /*
     * And it moved nothing. Compared against the count taken *before* the
     * layer rather than against `SHAPE`, so this test fails only for its own
     * reason: against the literal it also fails when somebody moves a real
     * section between chapters, which is the previous test's job and not this
     * one's. A mutant that moved `gold` used to kill this test too, which is
     * how the coupling was found.
     */
    const before = sectionsInChapter(sections, 'core-mechanics').length;
    expect(sectionsInChapter(layered, 'core-mechanics')).toHaveLength(before);
  });
});

describe('the licence rule still holds with five of the book’s headings in src/', () => {
  /**
   * The same shape, and the same limits, as `srdIndex.test.ts`'s field-label
   * guard - and it is worth saying what it does not prove.
   *
   * It asserts the label **as the app writes it**, in caps. Lower-cased it
   * would fail, and correctly: "character creation" is a phrase the book uses
   * in its own prose, and the book's words belong in the book's haystack. The
   * rule was never "these letters may not appear"; it is that a string *this
   * repository composed* may not enter the corpus, so it can neither be matched
   * nor quoted back as the book's.
   *
   * Nothing routes a chapter label into a haystack today, so this passes
   * without doing work - exactly like the field-label guard beside it. It earns
   * its place as the thing that fires the day somebody indexes the chapter
   * names to "make chapters searchable", which is the one change that would
   * turn five headings of furniture into five entries of the app's own text
   * inside the book's.
   */
  it('puts no chapter label in any record’s haystack, so none can be searched', () => {
    const index = srdIndex(baseDataset);
    const labels = Object.values(CHAPTER_LABELS);
    for (const record of index) {
      for (const label of labels) {
        expect(record.haystack, `${record.id} / ${label}`).not.toContain(label);
      }
    }
  });

  /**
   * The property form of "no SRD prose is typed into `src/`".
   *
   * Forty characters is what separates a heading from a sentence: the longest
   * label is `RUNNING AN ADVENTURE` at 20. The first person to paste a
   * paragraph of the book into one of these files fails here.
   */
  it('types no sentence of the book into the modules that draw the index', () => {
    const files = [
      'src/ui/shared/chapters.ts',
      'src/ui/search/Search.tsx',
    ];
    const bodies = baseDataset.rules.map((s) => s.body);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const literals = source.match(/'[^'\n]{40,}'|"[^"\n]{40,}"|`[^`]{40,}`/g) ?? [];
      const quoted = literals
        .map((raw) => raw.slice(1, -1))
        .filter((text) => bodies.some((body) => body.includes(text)));
      expect({ file, quoted }).toEqual({ file, quoted: [] });
    }
  });
});
