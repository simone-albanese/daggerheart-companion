/**
 * Which of the six moments each rules section belongs to.
 *
 * ## Membership, not a move
 *
 * Nothing here reorders or renames anything. A section belongs to one or more
 * moments and stays exactly where the SRD put it: this is a second way to
 * arrive at the same sixty-nine sections, drawn through the same row and the
 * same `BlockView` the search already uses.
 *
 * ## Why it is a table here and not a field on the dataset
 *
 * A moment is this app's judgement about when a GM reaches for a page, and the
 * SRD does not contain it. Three homes were possible and two are closed by
 * evidence rather than by taste:
 *
 * - **On `RulesSection`.** `shared/parsers/rules.ts` emits exactly four keys
 *   from the PDF, so the field would be `undefined` on all sixty-nine the
 *   first time anybody regenerated the dataset, and `build:srd`'s byte-for-byte
 *   re-derivation would then demand a value no parser can produce.
 * - **`data/moments.json`.** That directory holds generated files behind a CI
 *   gate that regenerates them and diffs the result. A hand-written file inside
 *   it would sit in a gate that cannot regenerate it and would pass for ever
 *   whatever it said - a permanent false green, which is worse than no gate.
 * - **A table in `src/`,** which is what this is, and what `dicePools.ts` and
 *   `modifiers.ts` already are: a hand-written record keyed by dataset ref,
 *   guarded by a test that walks it against the shipped data.
 *
 * It is static rather than behind the `import()` that hides the question
 * catalogue, and the reason is where it is drawn: the moments are on the
 * *empty* field, so a map that arrived a beat late would be a control missing
 * from the first frame rather than a band arriving late into a list. 2.7 kB of
 * repeated slugs against a GM chunk measured in the hundreds is noise.
 *
 * ## Where the judgement came from
 *
 * `docs/handoff/BALLOT-MOMENTI-2026-08-26.json` holds the ballot and the
 * reasoning for all sixty-nine rows, ratified line by line by the owner on
 * 26 August - including the seven that declared themselves contested. **Only
 * the id-to-moments pairs are transcribed here.** The `why` and the `note` stay
 * in the document: they are the argument for the decision and not the decision,
 * and a bundle is not where an argument belongs.
 *
 * The shape of the answer, which is why this is a list and not a field:
 * **94 memberships over 61 sections** - 30 sections with one moment, 29 with
 * two, 2 with three - and **8 with none**. `AskEntry.moment` is singular
 * because a question is asked at one moment; a section is read at several.
 */
import type { Ref, RulesSection } from '../../../shared/types.ts';
import type { Moment } from './ask.ts';

/** The 61 sections that belong somewhere, and where. */
export const SECTION_MOMENTS: Readonly<Record<Ref, readonly Moment[]>> = {
  'the-basics': ['the-dice-landed'],
  'the-golden-rule': ['before-the-roll', 'between-scenes'],
  'rulings-over-rules': ['before-the-roll', 'damage'],
  'character-creation': ['before-the-roll'],
  'beastform-options': ['my-turn', 'before-the-roll'],
  'working-with-your-companion': ['my-turn', 'before-the-roll'],
  'companion-taking-damage': ['damage', 'between-scenes'],
  'leveling-up-your-companion': ['between-scenes'],
  'flow-of-the-game': ['my-turn'],
  'player-principles-and-best-practices': ['my-turn'],
  'core-gameplay-loop': ['before-the-roll'],
  'the-spotlight': ['my-turn', 'the-dice-landed'],
  'turn-order-and-action-economy': ['my-turn'],
  'making-moves-and-taking-action': ['before-the-roll', 'the-dice-landed'],
  'gm-moves-and-adversary-actions': ['the-dice-landed', 'my-turn'],
  'adversary-actions': ['my-turn'],
  'special-rolls': ['before-the-roll', 'the-dice-landed'],
  'group-action-rolls': ['before-the-roll'],
  'tag-team-rolls': ['my-turn', 'before-the-roll'],
  'advantage-and-disadvantage': ['before-the-roll'],
  'hope-and-fear': ['the-dice-landed', 'before-the-roll'],
  'combat': ['before-the-roll', 'damage'],
  'stress': ['the-dice-landed', 'damage'],
  'attacking': ['my-turn', 'damage'],
  'maps-range-and-movement': ['this-place', 'my-turn', 'before-the-roll'],
  'conditions': ['before-the-roll', 'my-turn'],
  'downtime': ['between-scenes'],
  'death': ['damage'],
  'additional-rules': ['the-dice-landed', 'damage'],
  'leveling-up': ['between-scenes'],
  'gold': ['between-scenes'],
  'gm-principles': ['before-the-roll', 'between-scenes'],
  'gm-practices': ['the-dice-landed', 'between-scenes'],
  'pitfalls-to-avoid': ['my-turn', 'the-dice-landed'],
  'core-gm-mechanics': ['my-turn', 'damage'],
  'guidance-on-action-rolls': ['before-the-roll'],
  'making-gm-moves': ['the-dice-landed', 'my-turn'],
  'using-fear': ['the-dice-landed', 'my-turn'],
  'difficulty-benchmarks': ['before-the-roll'],
  'giving-advantage-and-disadvantage': ['before-the-roll'],
  'adversary-action-rolls': ['my-turn', 'damage'],
  'countdowns': ['the-dice-landed', 'this-place'],
  'giving-out-gold-equipment-and-loot': ['between-scenes'],
  'running-gm-npcs': ['before-the-roll', 'my-turn'],
  'npc-feature-examples': ['my-turn'],
  'optional-gm-mechanics': ['before-the-roll', 'damage', 'this-place'],
  'using-adversaries': ['my-turn'],
  'example-adversary-features': ['my-turn'],
  'building-balanced-encounters': ['damage', 'between-scenes'],
  'adversary-stat-block-benchmarks': ['before-the-roll', 'my-turn'],
  'using-environments': ['this-place'],
  'adapting-environments': ['this-place'],
  'story-beats': ['my-turn'],
  'battles-and-narrative': ['my-turn'],
  'session-rewards': ['between-scenes'],
  'crafting-scenes': ['this-place', 'between-scenes'],
  'engaging-your-players': ['my-turn'],
  'phased-battles': ['my-turn', 'this-place'],
  'using-downtime': ['between-scenes'],
  'projects-during-downtime': ['between-scenes'],
  'extended-downtime': ['between-scenes'],
};

/**
 * ## The eight that belong nowhere
 *
 * Sixty-one sections are mapped above and eight are deliberately absent. They
 * share one property, and it is the property the six moments are about:
 * **none of them is read at the table while people wait.** Every one is either
 * the document talking about itself, or something done before play starts - a
 * sheet built, a level taken, a campaign shaped, an encounter prepared.
 *
 * **The list of the eight lives in `tests/gm/moments.test.ts` and not here**,
 * which is where `dicePools.ts` keeps its own `NOT_A_POOL` and for the same
 * reason: an exclusion list is what a guard is allowed to skip, so it belongs
 * to the guard. Nothing in the running app has a use for it, and an export
 * with no caller is a feature that ships switched off.
 *
 * That guard runs in both directions, which is what makes the list
 * load-bearing rather than a hiding place: every section must be either mapped
 * here or named there, so an orphan can never be an omission nobody noticed;
 * and nothing named there may be a section the dataset no longer carries, so
 * the list cannot quietly outlive a rename.
 *
 * A seventh moment was the other way to make that guard pass, and it is
 * refused by measurement rather than by taste: `ShowSheet`'s chip grid is
 * `repeat(3, 1fr)`, so a seventh chip makes it three rows, which costs 52px in
 * a column that fits by 0.3px.
 */

/**
 * The sections of one moment, in the dataset's own order.
 *
 * The dataset's order and never a ranking, for the reason `searchRules` gives
 * about its own results: this surface does not decide which section the GM
 * meant. It takes `rules` rather than reading a store so that a homebrew layer
 * that rewrites a section is followed here too - what a layer cannot do is add
 * a moment, because a moment is this repository's judgement and not the
 * dataset's.
 */
export function sectionsIn(
  rules: readonly RulesSection[],
  moment: Moment,
): readonly RulesSection[] {
  return rules.filter((section) => SECTION_MOMENTS[section.id]?.includes(moment) === true);
}
