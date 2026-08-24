/**
 * A pipe table out of the dataset, drawn without knowing what is in it.
 *
 * Every other table in this app has a shape of its own, because the screen
 * drawing it knows what that table is for: `BenchmarkGrid` pivots on tier,
 * `CountdownChart` puts a button on the cells that carry a number, the
 * Difficulty ladder turns six tables on their side. This one is the drawing for
 * a table nobody chose in advance - the twelve the SRD ships, reached through
 * the `ADD -> LINK -> Rule` door that offers all 80 sections - so it may not
 * assume a column count, a heading, or a meaning.
 *
 * Nothing here is a target. A table you arrived at from a session row is
 * something you read, and the app has nothing to do with a price in Handfuls.
 *
 * ## Two shapes, decided by the table's own width
 *
 * **One value column** - the Average Costs table on p.69 and the objectives
 * roll on p.112 - is drawn as a two-column grid, header row included, because
 * that is what it is and it fits.
 *
 * **The width this used to name was wrong, and the route it was named for still
 * has none.** It read "393 - 24 of the region's padding - 4 of the row's own =
 * 365px", which omits the row itself: `SessionRow` draws a `.panel` with
 * `padding: 4px 6px`, a 3px `borderLeft` and the class's own 1px border, under a
 * global `box-sizing: border-box`. `SessionRow.tsx`'s first bullet - "the whole
 * header is the target" - puts that panel's content box at 353 on a 393px
 * phone, measured in Chrome, and a table reached from a session row sits inside
 * the open block below that again.
 *
 * The subtraction that arithmetic got *right* is the one every caller pays.
 * There are two call sites in the tree - the one in `StepExperiences`
 * (`Wizard.tsx`), which draws a `kind === 'table'` part of a step's lead, and
 * the one inside `BlockView` (`ReferenceTables.tsx`) - and the second is not a
 * separate path:
 * `BlockView` is what `SessionBody.tsx` calls for exactly the session row
 * above, what `RuleSearch.tsx` calls for every hit SHOW's rule search opens -
 * `searchRules` indexes table bodies, so a search for `Handful` lands in this
 * view - and what the reference region reaches through `GmMoves`,
 * `AdversaryExperiences` and `GoldAndLoot`, all three in `ReferenceTables.tsx`.
 * The last of those puts that table on the reference screen: it was already
 * reachable from a session row's `LINK -> Rule` and from SHOW's rule search,
 * and the costs topic is the third door onto the same drawing. (Every pointer in this
 * docblock names a symbol, a heading or a declaration rather than a line. The
 * four line numbers that once stood in `ReferenceTables.tsx` were invalidated by
 * the very edit that carried them; the `Wizard.tsx:1584` that stood here went
 * stale the same way, five lines, in a commit about something else.)
 * What those reference-region routes and the wizard escape is the `.panel`, not
 * the region padding: the reference scroller declares
 * `padding: phone ? '10px 12px 16px'` (`Reference.tsx`) and the wizard's
 * `'14px 12px 20px'` (`Wizard.tsx`) - 12px each side either way, the same
 * 24 - so they draw this view in the 369px column `TierBenchmarks`'s docblock
 * in `ReferenceTables.tsx` already names, not across the whole 393. **That 369
 * is itself 2px too generous wherever it means the reference region**:
 * `GmSheet`'s panel is border-box with a 1px border (`GmSheet.tsx`), so the
 * measured column at 393 is 367.00 - see `Reference.tsx`. Every figure below that starts from 369
 * inherits it. One of them has since been measured rather than derived:
 * `GoldAndLoot` (`ReferenceTables.tsx`) records this same grid resolving to
 * `178.5px 178.5px` at the 10px gap in Chrome, which is the 367.00 column
 * halved. The 369s below are left standing and flagged rather than corrected,
 * exactly as `ReferenceTables.tsx` leaves its own - 369 outside the panel and
 * 367.00 inside it are both right, and a sweep that "corrects" the wrong one
 * is the failure this repo has already paid for once. The number still missing
 * is the one
 * under a session row's panel and inside its open block; deriving that on paper
 * would be the same mistake once more, and this repo takes its measurements from
 * a browser. **Measure it before you write one down.**
 *
 * The conclusion does not depend on that figure, which is why the shapes are
 * safe meanwhile: two `minmax(0, 1fr)` columns at a 10px gap are 179.5 each at
 * 369 and 171.5 at the panel's 353, narrower again inside the open block. The
 * widest first cell in the shipped dataset is 42 characters at `.t-read`
 * (13px/1.45, about 6.3px a character) = 265px, which is two lines in any column
 * down to 133. That is one cell, not every cell: `GoldAndLoot`
 * (`ReferenceTables.tsx`) measured this same grid in Chrome at 393 x 852 - the
 * Average Costs table, whose `Meals for a party of adventurers per night` is the
 * 42 above - and found only five of its twelve left cells on two lines, a
 * one-line `.t-read` cell 18.84 tall against a two-line 37.69, and the whole
 * twelve-row table 390.34. This paragraph used to end "a row is about 38px and
 * the twelve-row table roughly 470", which charges every row the two-line
 * height and so runs some 80px over the browser's own figure for the very table
 * it names. Either way it sits inside a region that already scrolls.
 *
 * **More than one** - up to five columns, with cells up to 176 characters -
 * becomes one panel a row: the first cell as its title, every other cell under
 * the header that names it. Five columns across that column would be 70px each
 * at 353 and 74 at 369, which is
 * about eleven characters a line; that is the same measurement that made
 * `FearGuide` and `DifficultyLadder` stacked panels rather than grids, and it
 * is why neither shape here can push a phone sideways.
 *
 * Every header cell is printed exactly once in both shapes - across the top in
 * the grid; in the panels, the first above them all and the rest each beside
 * their own cell - so nothing the book wrote is dropped, and no label is
 * invented for a column that has none.
 */
import { Fragment } from 'react';
import type { RuleTable } from './ruleText.ts';

export function RuleTableView({ table }: { table: RuleTable }): React.JSX.Element {
  const [first = '', ...columns] = table.header;

  if (columns.length === 1) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '5px 10px',
          alignItems: 'baseline',
        }}
      >
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {first}
        </span>
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {columns[0]}
        </span>
        {table.rows.map((row, i) => (
          // The row's position is its identity: two rows of a rules table may
          // legitimately read the same, and no row in a book ever moves.
          <Fragment key={i}>
            <span className="t-read">{row[0] ?? ''}</span>
            <span className="t-read" style={{ color: 'var(--text-2)' }}>
              {row[1] ?? ''}
            </span>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      {first !== '' && (
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {first}
        </span>
      )}
      {table.rows.map((row, i) => (
        <article
          key={i}
          className="panel stack"
          style={{ flex: 'none', gap: 5, padding: 10, minWidth: 0 }}
        >
          <span style={{ font: '700 14px/1.25 var(--sans)' }}>{row[0] ?? ''}</span>
          {row.slice(1).map((cell, c) => (
            <div key={c} className="stack" style={{ flex: 'none', gap: 2 }}>
              {columns[c] !== undefined && (
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  {columns[c]}
                </span>
              )}
              <span className="t-dense" style={{ color: 'var(--text-3)' }}>
                {cell}
              </span>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}
