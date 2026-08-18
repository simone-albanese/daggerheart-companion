/**
 * A pipe table out of the dataset, drawn without knowing what is in it.
 *
 * Every other table in this app has a shape of its own, because the screen
 * drawing it knows what that table is for: `BenchmarkGrid` pivots on tier,
 * `CountdownChart` puts a button on the cells that carry a number, the
 * Difficulty ladder turns six tables on their side. This one is the drawing for
 * a table nobody chose in advance - the twelve the SRD ships, reached through
 * the `ADD -> LINK -> Rule` door that offers all 75 sections - so it may not
 * assume a column count, a heading, or a meaning.
 *
 * Nothing here is a target. A table you arrived at from a session row is
 * something you read, and the app has nothing to do with a price in Handfuls.
 *
 * ## Two shapes, decided by the table's own width
 *
 * **One value column** - the Average Costs table on p.69 and the objectives
 * roll on p.112 - is drawn as a two-column grid, header row included, because
 * that is what it is and it fits. At 393px the session row's column is
 * 393 - 24 of the region's padding - 4 of the row's own = 365px, so two
 * `minmax(0, 1fr)` columns at a 10px gap are 177 each. The widest first cell in
 * the shipped dataset is 42 characters at `.t-read` (13px/1.45, about 6.3px a
 * character), which is two lines inside 177; a row is about 38px and the
 * twelve-row table roughly 470, inside a region that already scrolls.
 *
 * **More than one** - up to five columns, with cells up to 176 characters -
 * becomes one panel a row: the first cell as its title, every other cell under
 * the header that names it. Five columns in 365px would be 73px each, which is
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
