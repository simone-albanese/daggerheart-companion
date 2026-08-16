/**
 * The SRD's own tables, drawn.
 *
 * One drawing of each table in the app: the reference region composes these,
 * and so do the two controls that get a table folded in beside them. A table
 * rendered twice is a table that goes out of step once.
 *
 * Each renderer reads the dataset itself through a narrow `useApp` selector
 * inside a `useMemo` keyed on the whole `dataset` object, the way
 * `Conditions.tsx` does - so a homebrew layer that rewrites a rules section
 * changes what is on screen, and nothing here holds a copy of anything.
 *
 * ## The provenance stamp sits on the table, never on the screen
 *
 * `SRD 1.0 · P.73` is drawn beside the table it belongs to and is read from
 * that section's own `sourcePage`. The improvise topic composes two tables
 * thirty pages apart - adversaries on 73, environments on 102 - so a single
 * stamp at the top of the topic would print one page number over text that is
 * not on it. That is the licence version of the rule this app keeps everywhere
 * else: the screen does not get to claim something that is not so.
 */
import { useMemo } from 'react';
import { useApp } from '../../store/state.ts';
import type { Tier } from '../../../shared/types.ts';
import {
  adversaryBenchmarks,
  environmentBenchmarks,
  fearGuidance,
  type BenchmarkTable,
} from '../shared/srdReference.ts';
import { useGm } from './gmStore.ts';

/**
 * What to give a creature you are inventing, and the room it is standing in.
 *
 * Zero controls, on purpose. A benchmark is a number you copy onto a piece of
 * paper; there is nothing here for the app to do with it, and a button that
 * only looked actionable would be worse than no button.
 *
 * ## Ergonomics, 393 x 852
 *
 * Inside `GmSheet size="full"` the panel is the window's width, so the column
 * is 393 - 24 of this region's padding = 369px. The grid is
 * `repeat(auto-fit, minmax(150px, 1fr))` at 10px gap: two columns of 179.5 at
 * 369, four of 168.5 in a 704px tablet column, four of about 257 at the 1100px
 * sheet maximum. Nothing declares a width, so no layer can push the page
 * sideways.
 *
 * The widest cell in the shipped table is `4d8+10 to 4d12+15` - 17 characters
 * at `.t-num`, which is 13px mono at roughly 7.8px a character, so 133px
 * inside 159.5 of card. `Major 25/Severe 45` is 18 and comes to 140. Both fit
 * on one line at the narrowest width, and both wrap rather than clip if a
 * layer writes something longer.
 */
export function TierBenchmarks(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const partyTier = useGm((s) => s.partyTier);
  const tables = useMemo(
    () => [adversaryBenchmarks(dataset.rules), environmentBenchmarks(dataset.rules)],
    [dataset],
  );
  const drawn = tables.filter((table) => table.columns.length > 0);

  if (drawn.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no benchmark tables. They come from the rules sections the SRD keeps
        them in, so a rules layer that replaced those sections replaced these too.
      </p>
    );
  }

  return (
    <>
      {drawn.map((table) => (
        <BenchmarkGrid key={table.title} table={table} partyTier={partyTier} />
      ))}
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        The marked column is the tier this campaign is set to. That is this app noting where you
        already are — the tables are the SRD&rsquo;s, unchanged, all four tiers of them.
      </p>
    </>
  );
}

/**
 * One table, one card a tier.
 *
 * The party's own tier is drawn first and outlined rather than merely
 * highlighted, because the GM reaching for this has one column in mind and
 * three that are context. Its order is otherwise the table's own.
 */
function BenchmarkGrid({
  table,
  partyTier,
}: {
  table: BenchmarkTable;
  partyTier: Tier;
}): React.JSX.Element {
  // A stable sort, so the other three keep the SRD's order behind the one the
  // campaign is set to.
  const columns = [...table.columns].sort(
    (a, b) => Number(b.tier === partyTier) - Number(a.tier === partyTier),
  );

  return (
    <section className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {table.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{table.page === null ? '' : ` · P.${String(table.page)}`}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}
      >
        {columns.map((column) => {
          const marked = column.tier !== null && column.tier === partyTier;
          return (
            <div
              key={column.header}
              className="panel stack"
              style={{
                flex: 'none',
                gap: 8,
                minWidth: 0,
                padding: 10,
                borderColor: marked ? 'var(--hope)' : undefined,
              }}
            >
              <div className="row" style={{ gap: 6 }}>
                <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}>
                  {column.header}
                </span>
                {marked && (
                  <span className="chip" style={{ flex: 'none', color: 'var(--hope)' }}>
                    PARTY TIER
                  </span>
                )}
              </div>
              {column.stats.map((stat) => (
                <span key={stat.statistic} className="stack" style={{ gap: 3, minWidth: 0 }}>
                  <span className="t-meta">{stat.statistic}</span>
                  <span className="t-num" style={{ color: 'var(--text)', lineHeight: 1.25 }}>
                    {stat.value}
                  </span>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Fear: the pool's own rules, what to spend it on, and what a scene is worth.
 *
 * Drawn once and used twice - the reference's FEAR topic, and a shut fold under
 * the Fear board's twelve targets. The app has carried a Fear counter with a
 * maximum on it since the GM screen was built and has never once said what a
 * scene should cost; this is that sentence, in the SRD's own words, beside the
 * control it is about.
 *
 * The whole section is drawn, in the book's order, rather than the two parts a
 * screen might pick out. Picking would mean indexing the lists by position and
 * dropping the rest, and the rest is how to spend a large pool and what a Fear
 * move is made of - which is exactly the guidance a GM sitting on nine Fear
 * came here for.
 *
 * ## Ergonomics
 *
 * The scene table is five stacked panels, not a `<table>`: three columns of
 * which one holds a 190-character sentence would scroll a 393px phone sideways
 * whatever the column widths were. Inside the Fear board the column is
 * 393 - 24 of region padding - 28 of panel padding = 341px, so the longest
 * examples cell is four lines at `.t-dense` (11.5px, about 5.5px a character)
 * and a row is about 102px. Five rows and the prose come to roughly 800px,
 * which is why it lives behind a fold that starts shut, in a region that
 * already scrolls.
 *
 * Nothing here is a target. The Fear pool is set on the twelve buttons above
 * it; a table that offered to spend for you would be the app deciding what a
 * scene was worth.
 */
export function FearGuide(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const fear = useMemo(() => fearGuidance(dataset.rules), [dataset]);

  if (fear.parts.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no Fear section, so there is nothing to quote. The pool above still
        works; it is the guidance that is missing.
      </p>
    );
  }

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--fear)' }}>
          {fear.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{fear.page === null ? '' : ` · P.${String(fear.page)}`}
        </span>
      </div>

      {fear.parts.map((part, i) => {
        // The index is the key because the SRD's order *is* the identity here:
        // two paragraphs of a rules body may legitimately be equal strings, and
        // nothing in this list ever moves.
        const key = `${part.kind}-${String(i)}`;
        if (part.kind === 'text') {
          return (
            <p key={key} className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
              {part.text}
            </p>
          );
        }
        if (part.kind === 'list') {
          return (
            <ul key={key} className="stack" style={{ flex: 'none', gap: 6, margin: 0, paddingLeft: 18 }}>
              {part.items.map((item) => (
                <li key={item} className="t-body" style={{ maxWidth: '62ch' }}>
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div key={key} className="stack" style={{ flex: 'none', gap: 6 }}>
            {part.scenes.map((scene) => (
              <article
                key={scene.scene}
                className="panel stack"
                style={{ flex: 'none', gap: 5, padding: 10, minWidth: 0 }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, font: '700 14px/1.2 var(--sans)' }}>
                    {scene.scene}
                  </span>
                  <span className="t-num" style={{ flex: 'none', color: 'var(--fear)' }}>
                    {scene.spend}
                  </span>
                </div>
                <span className="t-dense" style={{ color: 'var(--text-3)' }}>
                  {scene.examples}
                </span>
              </article>
            ))}
          </div>
        );
      })}
    </>
  );
}
