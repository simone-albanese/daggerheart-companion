/**
 * Which chapter of the book each rules section is printed in.
 *
 * ## A second membership of the same sixty-nine
 *
 * `moments.ts` maps the sections onto *when a GM reaches for them*. This maps
 * them onto *where the book put them*, which is a different question with a
 * different answer, and neither reorders nor renames anything. Both are
 * arrived at through the same row and the same `BlockView` the search already
 * uses.
 *
 * The two differ in one way worth stating before anyone copies the wrong half
 * of `moments.ts` into here: **a moment is this app's judgement, a chapter is
 * the book's fact.** That changes which arguments transfer and which do not,
 * and the section below says exactly which.
 *
 * ## Where the five came from, and it is measured rather than read
 *
 * The book sets chapter openers at **28pt**, and there are exactly seven lines
 * at that size in the whole PDF. Run against `Manuali/Daggerheart-SRD-9-09-25.pdf`
 * through `tools/pdfText.ts` + `shared/textLayout.ts`, the complete list is:
 *
 * | folio | heading |
 * |---|---|
 * | 2 | CONTENTS |
 * | 3 | INTRODUCTION |
 * | 4 | CHARACTER CREATION |
 * | 7 | CORE MATERIALS |
 * | 35 | CORE MECHANICS |
 * | 63 | RUNNING AN ADVENTURE |
 * | 119 | APPENDIX |
 *
 * Nothing else in the book is set above 20pt. `CONTENTS` and `APPENDIX` hold
 * no rules section, so the five below are every chapter the sixty-nine fall
 * into, and a section's chapter is the last opener at or before its
 * `sourcePage`. The table is generated from that rule and then frozen here;
 * `tests/ui/chapters.test.ts` recomputes it on every run, so the derivation is
 * a live assertion rather than a story about how the file was made.
 *
 * ## Why the parser's own `drop` markers are NOT the boundary set
 *
 * The obvious shortcut - `shared/parsers/rules.ts` already drops some headings,
 * so keep them - is wrong in both directions, and cost a first derivation of
 * this table its six-way split:
 *
 * - `{ start: 'ADVERSARIES AND ENVIRONMENTS', drop: true }` and
 *   `ADDITIONAL GM GUIDANCE` are **20pt**, the same rank as `GM GUIDANCE`,
 *   `EQUIPMENT` and `FLOW OF THE GAME`. They are subheads inside RUNNING AN
 *   ADVENTURE, not chapters. Treating them as chapters splits that chapter
 *   three ways.
 * - `TIER 1`, `ADVERSARIES BY TIER` and `The Witherwild` are stat-block gates
 *   with no rank at all.
 * - Three real openers are not drops. `INTRODUCTION` and `CHARACTER CREATION`
 *   are kept as sections, and `CORE MATERIALS` never reaches `SPECS` because
 *   folios 7-11 and 13-17 are outside `RANGES`.
 *
 * The parser matches heading *text*; chapters are a matter of heading *rank*.
 * So a hand-authored table is required, and the guard that keeps it honest is
 * the recomputation, not the manifest.
 *
 * ## Why it is a table here and not a field on the dataset
 *
 * Three homes were possible. **`moments.ts`'s first argument does not transfer
 * and it would be dishonest to reuse it**: it says a parser could never produce
 * the value, which is true of a moment and false of a chapter - the chapter is
 * in the PDF and `SPECS` is already a hand-written heading manifest that could
 * carry it. The field is refused on three other grounds instead:
 *
 * - **The gate that would check it does not run.** `ci.yml` gates the
 *   `build:srd` re-derivation on `steps.srd.outputs.present`, which probes for
 *   the SRD PDF; `.gitignore` ignores `*.pdf` and `Manuali`, so no runner ever
 *   has it and that step is skipped on every run, green ones included. A
 *   dataset field is verified on one laptop or nowhere. A table in `src/` is
 *   verified by `vitest run`, which CI does run on every push.
 * - **A layer cannot answer it, and a field would make it try.** A homebrew
 *   layer may add a rules section; the book's table of contents cannot say
 *   which chapter that section is printed in, because it is not printed in the
 *   book at all. A field forces every layer author to invent one, and forces
 *   the default-supplying readers to invent one for them. A table keyed by
 *   `Ref` simply does not name it, and the index then leaves a layer's section
 *   out of the chapter breakdown - which is the truth.
 * - **Blast radius against readership.** It would change `shared/types.ts`,
 *   `shared/parsers/rules.ts`, `data/srd-1.0.json` and the byte-for-byte
 *   re-derivation, to add a grouping exactly one screen reads.
 *
 * **`data/chapters.json`** is refused for `moments.ts`'s own reason, unchanged:
 * that directory holds generated files behind a gate that regenerates them and
 * diffs the result, so a hand-written file there sits in a gate that cannot
 * regenerate it and passes for ever whatever it says. Here it is worse, because
 * by the point above that gate is skipped in CI anyway - a file inside a gate
 * that can neither check it nor run.
 *
 * ## Five of the book's headings are typed in `src/`, and a guard keeps that inside the rule
 *
 * `srdIndex.ts` states the rule this repository actually holds: *a label is
 * never in the haystack*, and no preview line may quote one. It governs the
 * search corpus and the quotable text, not every string under `src/`. The app
 * already addresses the book by its own words here - `stamp()` prints
 * `SRD 1.0 · P.35`, `SRD_KIND_LABELS` prints the book's names for its
 * collections, and `moments.ts` is keyed on the book's own slugs.
 *
 * Four of the five headings below are **already** typed in this repository, as
 * `start:` strings in `shared/parsers/rules.ts`, beside all sixty-nine section
 * titles it also types by hand. This module adds exactly one heading the repo
 * did not already carry - `CORE MATERIALS`, fourteen characters. Five headings,
 * seventy-eight characters, **zero sentences**, against the 100,165 characters
 * of section prose that live only in `data/`.
 *
 * The `AskEntry.at.part` precedent is the real objection and it is answered
 * rather than waved: `at.part` is an integer because *there was an integer to
 * be had* - the part exists inside the section and can be addressed by
 * position. There is no chapter number to point at, because the dataset carries
 * no chapter at all. That left three options and two die on the evidence:
 *
 * - **Name a chapter after its first section.** Right for three of five and
 *   wrong for two - CORE MATERIALS would be called "Beastform Options" and
 *   CORE MECHANICS "Flow of the Game". A rule right three times in five is not
 *   a rule.
 * - **Invent this app's own name for each chapter.** Worse on the licence's own
 *   terms: the app renaming the book, printed on a surface where every row
 *   beside it carries an `SRD 1.0 · P.n` stamp the reader can check. A false
 *   claim about the source is a worse failure than a true one.
 * - **Type the book's heading.** Taken, and held by
 *   `tests/ui/chapters.test.ts`, which asserts that no value of
 *   `CHAPTER_LABELS` occurs in any `srdIndex` haystack. Five strings enter
 *   `src/`; not one can be searched and not one can be quoted back to a reader
 *   as the book's own words.
 *
 * ## Two counts a reader will take for bugs, and they are the book's
 *
 * - **CHARACTER CREATION opens onto a single row - and that row is the longest
 *   section in the SRD.** `character-creation` is 10,879 characters, 10.9% of
 *   the whole corpus. Its body runs folios 4-6; everything else on those folios
 *   is the ten creation steps, which this app models as the Build wizard rather
 *   than as prose. A count is not a weight, and this is the row that proves it.
 * - **RUNNING AN ADVENTURE is 35 rows against CORE MECHANICS' 24, but only
 *   41.3% of the prose against 38.0%.** The two big chapters are near-equal by
 *   weight. The 35 is the book's shape, not a lopsidedness the index introduced.
 *
 * ## One hazard, and it is in the DOM rather than in the data
 *
 * Three chapter slugs - `introduction`, `character-creation`,
 * `running-an-adventure` - are **also section ids**, and `Ref` is `string`, so
 * TypeScript will not keep the two namespaces apart. Nothing breaks as data:
 * `SECTION_CHAPTER['introduction'] === 'introduction'` is correct, and says the
 * Introduction section is printed in the Introduction chapter. It is dangerous
 * on the glass: a chapter row and the `introduction` section row inside it must
 * never share a DOM id, or a test can count one as the other and call it proof.
 * Whoever draws these namespaces the row ids.
 */
import type { Ref, RulesSection } from '../../../shared/types.ts';

/** The five chapters of the book that hold rules sections, in book order. */
export const SRD_CHAPTERS = [
  'introduction',
  'character-creation',
  'core-materials',
  'core-mechanics',
  'running-an-adventure',
] as const;
export type SrdChapter = (typeof SRD_CHAPTERS)[number];

/**
 * What each chapter is called on the glass - the book's own heading, in the
 * case the book sets it.
 *
 * These are the only five strings of the SRD's this module contains, and the
 * guard in `tests/ui/chapters.test.ts` is what keeps them furniture: none may
 * appear in any record's haystack, so none can be searched and none can be
 * quoted back as the book's own words. See the header for the whole argument.
 */
export const CHAPTER_LABELS: Record<SrdChapter, string> = {
  introduction: 'INTRODUCTION',
  'character-creation': 'CHARACTER CREATION',
  'core-materials': 'CORE MATERIALS',
  'core-mechanics': 'CORE MECHANICS',
  'running-an-adventure': 'RUNNING AN ADVENTURE',
};

/**
 * The folio each chapter opens on - the 28pt heading's own page.
 *
 * Exported because the guard recomputes the whole table from it: a section's
 * chapter is the last opener at or before its `sourcePage`. That recomputation
 * is what makes the table below checked rather than merely written down, and it
 * is the assertion that fails the day `sourcePage` moves or somebody splits a
 * chapter on a subhead. It is five integers and no words of the book's, so it
 * is an address in `at.part`'s sense.
 */
export const CHAPTER_OPENS: Record<SrdChapter, number> = {
  introduction: 3,
  'character-creation': 4,
  'core-materials': 7,
  'core-mechanics': 35,
  'running-an-adventure': 63,
};

/**
 * All sixty-nine, and every one of them in exactly one chapter.
 *
 * **There is no exclusion list and none is possible**, which is the difference
 * from `SECTION_MOMENTS`. Eight sections belong to no moment, because a moment
 * is a judgement and some pages are not read at the table. Zero sections belong
 * to no chapter, because every page of the book is inside one. So this guard
 * has no escape hatch to keep honest - and the day somebody adds one is the day
 * this table has stopped being the book's.
 */
export const SECTION_CHAPTER: Readonly<Record<Ref, SrdChapter>> = {
  // INTRODUCTION — folio 3
  introduction: 'introduction',
  'the-basics': 'introduction',
  'the-golden-rule': 'introduction',
  'rulings-over-rules': 'introduction',

  // CHARACTER CREATION — folio 4
  'character-creation': 'character-creation',

  // CORE MATERIALS — folio 7
  'beastform-options': 'core-materials',
  'ranger-companion': 'core-materials',
  'working-with-your-companion': 'core-materials',
  'companion-taking-damage': 'core-materials',
  'leveling-up-your-companion': 'core-materials',

  // CORE MECHANICS — folio 35
  'flow-of-the-game': 'core-mechanics',
  'player-principles-and-best-practices': 'core-mechanics',
  'core-gameplay-loop': 'core-mechanics',
  'the-spotlight': 'core-mechanics',
  'turn-order-and-action-economy': 'core-mechanics',
  'making-moves-and-taking-action': 'core-mechanics',
  'gm-moves-and-adversary-actions': 'core-mechanics',
  'adversary-actions': 'core-mechanics',
  'special-rolls': 'core-mechanics',
  'group-action-rolls': 'core-mechanics',
  'tag-team-rolls': 'core-mechanics',
  'advantage-and-disadvantage': 'core-mechanics',
  'hope-and-fear': 'core-mechanics',
  combat: 'core-mechanics',
  stress: 'core-mechanics',
  attacking: 'core-mechanics',
  'maps-range-and-movement': 'core-mechanics',
  conditions: 'core-mechanics',
  downtime: 'core-mechanics',
  death: 'core-mechanics',
  'additional-rules': 'core-mechanics',
  'leveling-up': 'core-mechanics',
  multiclassing: 'core-mechanics',
  // Folio 62. `GOLD` is 20pt, a sibling of `EQUIPMENT` on folio 44, and the
  // next 28pt opener is RUNNING AN ADVENTURE on folio 63 - so there is no
  // Equipment chapter to put it in. Equipment is itself only a subhead of CORE
  // MECHANICS, which is why `RANGES` skips folios 44-61: those are the weapon,
  // armor, loot and consumable tables the dataset models as collections, and
  // they have their own four blocks in the index.
  gold: 'core-mechanics',

  // RUNNING AN ADVENTURE — folio 63
  'running-an-adventure': 'running-an-adventure',
  'gm-guidance': 'running-an-adventure',
  'gm-principles': 'running-an-adventure',
  'gm-practices': 'running-an-adventure',
  'pitfalls-to-avoid': 'running-an-adventure',
  'core-gm-mechanics': 'running-an-adventure',
  'guidance-on-action-rolls': 'running-an-adventure',
  'making-gm-moves': 'running-an-adventure',
  'using-fear': 'running-an-adventure',
  'difficulty-benchmarks': 'running-an-adventure',
  'giving-advantage-and-disadvantage': 'running-an-adventure',
  'adversary-action-rolls': 'running-an-adventure',
  countdowns: 'running-an-adventure',
  'giving-out-gold-equipment-and-loot': 'running-an-adventure',
  'running-gm-npcs': 'running-an-adventure',
  'npc-feature-examples': 'running-an-adventure',
  'optional-gm-mechanics': 'running-an-adventure',
  'using-adversaries': 'running-an-adventure',
  'example-adversary-features': 'running-an-adventure',
  'building-balanced-encounters': 'running-an-adventure',
  'adversary-stat-block-benchmarks': 'running-an-adventure',
  // Folio 102, and 14pt - two ranks below a chapter, and between the RUNNING AN
  // ADVENTURE opener on 63 and the APPENDIX on 119. The environment *records*
  // are their own block in the index; these two are the prose about running
  // them, and the book prints it here.
  'using-environments': 'running-an-adventure',
  'adapting-environments': 'running-an-adventure',
  'additional-gm-guidance': 'running-an-adventure',
  'story-beats': 'running-an-adventure',
  'preparing-combat-encounters': 'running-an-adventure',
  'battles-and-narrative': 'running-an-adventure',
  'session-rewards': 'running-an-adventure',
  'crafting-scenes': 'running-an-adventure',
  'engaging-your-players': 'running-an-adventure',
  'phased-battles': 'running-an-adventure',
  'using-downtime': 'running-an-adventure',
  'projects-during-downtime': 'running-an-adventure',
  'extended-downtime': 'running-an-adventure',
  'campaign-frames': 'running-an-adventure',
};

/**
 * The sections of one chapter, in the dataset's own order.
 *
 * The dataset's order and never a ranking, for the reason `sectionsIn` gives
 * about its own list and `searchRules` about its results: this surface does not
 * decide which section the GM meant. It takes `rules` rather than reading a
 * store so that a homebrew layer which rewrites a section is followed here too.
 *
 * What a layer cannot do is *join* a chapter, and that is deliberate rather
 * than a gap: a chapter is where the book printed a page, and a section the
 * book never printed is in none of them. Such a section is still searched, and
 * still found by name and by its words - it is only absent from the chapter
 * breakdown, which is the honest place for it to be absent from.
 */
export function sectionsInChapter(
  rules: readonly RulesSection[],
  chapter: SrdChapter,
): readonly RulesSection[] {
  return rules.filter((section) => SECTION_CHAPTER[section.id] === chapter);
}
