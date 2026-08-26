/**
 * One block of a rules section, drawn the way the book wrote it.
 *
 * It lived in `gm/ReferenceTables.tsx`, and it is here because it stopped being
 * the GM's. `RuleSearch` has always called this "this app's single drawing of a
 * section somebody chose" - the GM chapter's five folds use it, the adversary
 * Experiences put their lead block through it, the costs topic draws its whole
 * section through it, and so does the ADD -> LINK -> Rule row - and part 2.2 of
 * the SRD plan adds a sixth caller that is not a GM screen at all.
 *
 * **The move is what makes that caller possible, and the plan did not know it.**
 * §2.2 says `RuleSearch.tsx` moves to `src/ui/shared/`, full stop. It cannot:
 * nothing in `shared/` imports from `gm/` - that was true of every file in the
 * directory before this one - and `RuleSearch` imports `BlockView` out of
 * `ReferenceTables.tsx`, which imports `gmStore`. Moving the search without
 * this would have inverted the layering, or dragged a 1,275-line file and the
 * GM store into `shared/` behind it.
 *
 * What comes across is only what has no store: `BlockView`, the target types it
 * takes, and the one predicate that reads them. `ReferenceTables` keeps
 * everything that reads `useGm` and imports this back.
 */
import { Fragment } from 'react';
import type { SectionBlock } from './srdReference.ts';
import { RuleTableView } from './RuleTableView.tsx';

/**
 * Which node of a block a caller wants its ref put on.
 *
 * `{ kind: 'block' }` is the whole block, which is what a subhead hit wants and
 * what this drew for everybody before there was anywhere finer to ask for.
 * `{ kind: 'part' }` is one paragraph, or one list whole; `{ kind: 'item' }` is
 * one bullet inside one list.
 *
 * **By the indices `block.parts` is walked with, never by the string drawn
 * there, and the book is the reason.** `making-gm-moves` writes the same four
 * lines twice inside its `CHOOSING GM MOVES` block: `An adversary attacks`,
 * `The PC marks a Stress`, `You introduce a new threat` and `You raise the
 * stakes of the conflict` are bullets 3 to 6 of part 1, where the SRD flattens
 * them under the Success-with-Fear bullet, and bullets 0 to 3 of part 3, where
 * it lists them again under the Failure-with-Hope paragraph. The book repeats
 * the four consequences for two different roll outcomes; that is not the
 * flattening, and a parser that nested would still emit the string twice inside
 * the one `## `. A target that named the string would match both `<li>`s, hand
 * the caller's ref to two nodes, and make a caller that scrolls scroll twice.
 * `ruleSearch.test.tsx` reads both occurrences out of the dataset before it
 * asserts the one node, so that case cannot quietly go vacuous.
 *
 * A target this block cannot honour falls back to the block rather than
 * dropping the ref: a part index it does not carry, a `part` naming its table,
 * an `item` naming a paragraph or an index past the end of a list. The block is
 * the honest answer there - it is where this landed for everyone before - and
 * for the table it is the only one there is, since the cells are
 * `RuleTableView`'s and a table hit has no line to land on anyway (`quoteFrom`
 * gives it a null line, so `landingIn` never asks for one).
 */
export type BlockTarget =
  | { kind: 'block' }
  | { kind: 'part'; part: number }
  | { kind: 'item'; part: number; item: number };

/**
 * A place inside a block and the ref that wants to be there.
 *
 * One prop carrying both, rather than a target beside a ref, because the two
 * halves are only ever useful together: a ref with nowhere to go and a place
 * with nothing to put there are both states this cannot be asked for.
 */
export interface BlockLanding {
  at: BlockTarget;
  ref: (node: HTMLElement | null) => void;
}

/** Is `at` a place this block actually draws, or does it fall back to the top? */
function landsInside(block: SectionBlock, at: BlockTarget): boolean {
  if (at.kind === 'block') return false;
  const part = block.parts[at.part];
  if (part === undefined) return false;
  if (at.kind === 'part') return part.kind !== 'table';
  return part.kind === 'list' && at.item < part.items.length;
}

/**
 * One `## ` block of any rules section: its subhead, its prose, its bullets and
 * its tables.
 *
 * The GM chapter above draws with this, so do the adversary Experiences and the
 * costs topic above it, and outside this file so do the `LINK -> Rule` row of a
 * GM session and SHOW's rule search (`RuleSearch.tsx`) - those last two are the
 * reason it is exported rather than private to this file. That row printed a
 * section through `paragraphs()` alone until now, so
 * every bullet it drew carried a literal `- ` and every table came out as raw
 * pipes. A second renderer beside this one would have been a second thing to
 * keep in step, and the pipes are what that costs.
 *
 * **The two things a caller may ask of the inside of a block are both
 * optional.** Pass neither and what is drawn is what was drawn before, node for
 * node: the four callers that have no reason to point inside a block - the GM
 * chapter's folds, the adversary Experiences' lead, the costs topic, and the
 * `LINK -> Rule` row - pass nothing and did not change a line. Three of the
 * four are asserted from the outside rather than from this signature, in
 * `reference.test.tsx`: they bring nothing into view and they light no word.
 * The fourth, the session's `LINK -> Rule` row, is asserted the same way in
 * `tests/ui/sessionRule.test.tsx`, on two sections chosen to be complementary -
 * one all subheads and bullets, one carrying the table - so all three places
 * this file writes a string of its own are covered.
 *
 * `land` carries a place and the caller's ref, never a scroll: this file has no
 * opinion about what the ref is for, and the one caller that has one keeps it.
 *
 * `mark` is the same bargain about text. It is handed each string this block
 * draws in its own words - the subhead, a paragraph, a bullet - and gives back
 * whatever the caller wants drawn in its place, which for SHOW's rule search is
 * that string split around the GM's words. This file is not told the query and
 * does not own the marking: a component passed in would have to come from
 * `RuleSearch.tsx`, which already imports `BlockView` from here, and the import
 * back would be a cycle. A function has no such direction.
 *
 * The three text call sites are all of them, and the cells of a table are
 * deliberately not a fourth: they belong to `RuleTableView`, and a table hit
 * has no line to land on in the first place - `quoteFrom` skips pipe rows, so
 * its `line` is null and `landingIn` never points inside one.
 */
export function BlockView({
  block,
  land = null,
  mark,
}: {
  block: SectionBlock;
  land?: BlockLanding | null;
  mark?: (text: string) => React.ReactNode;
}): React.JSX.Element {
  const at = land === null ? null : land.at;
  const ref = land === null ? undefined : land.ref;
  const ink = mark ?? ((text: string): React.ReactNode => text);
  // The ref sits on the block itself unless the target names a node inside it
  // that this block really draws, which is what keeps every unhonourable
  // target - and every caller that asked for nothing - on the old behaviour.
  const onRoot = at !== null && !landsInside(block, at);
  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }} ref={onRoot ? ref : undefined}>
      {block.heading !== null && (
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {ink(block.heading)}
        </span>
      )}
      {block.parts.map((part, i) => {
        // The index is the key because the book's order is the identity here:
        // two paragraphs of a rules body may legitimately be equal strings.
        const key = `${part.kind}-${String(i)}`;
        const onPart = at !== null && at.kind === 'part' && at.part === i;
        if (part.kind === 'text') {
          return (
            <p
              key={key}
              className="t-read"
              style={{ margin: 0, maxWidth: '62ch' }}
              ref={onPart ? ref : undefined}
            >
              {ink(part.text)}
            </p>
          );
        }
        if (part.kind === 'table') return <RuleTableView key={key} table={part.table} />;
        return (
          <ul
            key={key}
            className="stack"
            style={{ flex: 'none', gap: 5, margin: 0, paddingLeft: 18 }}
            ref={onPart ? ref : undefined}
          >
            {part.items.map((item, j) => (
              <li
                key={item}
                className="t-read"
                style={{ maxWidth: '62ch' }}
                ref={
                  at !== null && at.kind === 'item' && at.part === i && at.item === j
                    ? ref
                    : undefined
                }
              >
                {ink(item)}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
