/**
 * The SRD's own tables and sections, drawn.
 *
 * The reference region composes these, so do the two controls that get a table
 * folded in beside them, and so do the hits SHOW's rule search opens and the
 * `LINK -> Rule` row of a GM session, both through `BlockView` at the foot of
 * this file. That row is why `BlockView` exists: it printed its own bullets
 * and tables out of `paragraphs()` until the pipes showed up on screen.
 *
 * **It is not one drawing of each, and this header used to claim it was.** The
 * `ADD -> LINK -> Rule` door offers all sixty-nine sections, so a GM can link
 * `countdowns`, `using-fear`, `difficulty-benchmarks`,
 * `adversary-stat-block-benchmarks` or `adapting-environments` and get the
 * generic `RuleTableView`, while the reference region draws those same tables
 * with the bespoke renderers below - `CountdownChart` even puts a button on its
 * numbered cells, and the ladder pivots. Ten SRD tables therefore have two
 * drawings in this app. `RuleTableView`'s own header says so; this one now says
 * it too, because the pair going out of step is a real hazard and pretending
 * there is no pair is how it would happen unnoticed.
 *
 * The eleventh table is deliberately not an eleventh pair.
 * `giving-out-gold-equipment-and-loot` carries the Average Costs table and is
 * reachable three ways - the `LINK -> Rule` row, SHOW's rule search, and the
 * costs topic `GoldAndLoot` adds below - and all three end in the same
 * `BlockView` and so in the same `RuleTableView`. Three doors, one drawing,
 * nothing to keep in step.
 * That is what a bespoke renderer has to earn, and a price list has nothing for
 * one to do.
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
import { Fragment, useMemo, useState } from 'react';
import { useApp } from '../../store/state.ts';
import type { Countdown } from '../../engine/encounter.ts';
import { TRAITS, TRAIT_LABELS, type Tier, type Trait } from '../../../shared/types.ts';
import { Fold } from '../shared/Fold.tsx';
import {
  adversaryBenchmarks,
  adversaryExperiences,
  countdownAdvancement,
  difficultyBenchmarks,
  environmentBenchmarks,
  fearGuidance,
  gmMoves,
  goldAndLoot,
  rangeReference,
  type BenchmarkTable,
  type RangePart,
  type SectionBlock,
} from '../shared/srdReference.ts';
import { RuleTableView } from '../shared/RuleTableView.tsx';
import { useGm } from './gmStore.ts';

/**
 * What to give a creature you are inventing, and the room it is standing in.
 *
 * Zero controls, on purpose. A benchmark is a number you copy onto a piece of
 * paper; there is nothing here for the app to do with it, and a button that
 * only looked actionable would be worse than no button.
 *
 * The one thing the app adds is the marking on the campaign's own tier, and the
 * closing note that says the marking is the app's and not the book's. Both are
 * conditional on a column having actually been marked: `benchmarkTable` reads
 * the tier off the column header and will not guess, so a rules layer whose
 * headers carry no number leaves nothing outlined - and a note explaining a
 * mark that is not on the screen is the same defect as any other sentence the
 * code cannot honour.
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
 * **Flagged, not fixed: that 369 is short by 2, and so is every other 369 in
 * this file that means this region** - the `369, four of 168.5` in the
 * paragraph above, and the ergonomics paragraphs of `RangeReference`,
 * `DifficultyLadder` (twice: its column, and the `302 in a 369px column` of the
 * trait chips), `GmMoves` and `AdversaryExperiences`. Named by symbol rather than by line, because the
 * four line numbers that stood here were the pre-edit ones: the insertion that
 * carried them pushed every one of them twelve lines down, and any later edit
 * to this file would do it again. The
 * premise above, "the panel is the window's width", is the thing that is
 * wrong: `GmSheet`'s panel is `width: 100%` and border-box with a 1px border
 * (`GmSheet.tsx`), so at 393 its content box is 391.00 and this column is
 * **367.00**, measured in Chrome - see `Reference.tsx`, where the same
 * omission turned a three-row topic strip into a two-row one. Nothing derived
 * from 369 below has been re-measured and none of it is re-derived here;
 * measure before writing a replacement down. (The folded copies - the chart
 * under a countdown's row, the guide under the Fear board - sit in a different
 * container again, and this note says nothing about those.)
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
  // The closing note is about a column that is outlined and chipped PARTY
  // TIER. A layer can rewrite either section, and `benchmarkTable` refuses to
  // read a tier out of a header with no number in it - so there may be no
  // marked column anywhere on the screen, and then the note is a sentence
  // about a marking the GM cannot see.
  const marked = drawn.some((table) =>
    table.columns.some((column) => column.tier !== null && column.tier === partyTier),
  );

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
      {marked && (
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          The marked column is the tier this campaign is set to. That is this app noting where you
          already are — the tables are the SRD&rsquo;s, unchanged, all four tiers of them.
        </p>
      )}
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
 *
 * `besidePool` is which of the two doors this came through, and the only thing
 * it changes is the empty state. The consolation for a dataset with no Fear
 * section - *the pool above still works* - is true under the Fear board's
 * twelve targets and false on the reference screen, which carries no pool at
 * all. Same rule as `CountdownChart`'s `countdown`: a component drawn in two
 * places may not describe the one it is not in.
 */
export function FearGuide({ besidePool }: { besidePool: boolean }): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const fear = useMemo(() => fearGuidance(dataset.rules), [dataset]);

  if (fear.parts.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no Fear section, so there is nothing to quote.
        {besidePool && ' The pool above still works; it is the guidance that is missing.'}
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

// ---------------------------------------------------------------------------

/**
 * The dynamic-countdown chart, as five rows the GM can press.
 *
 * ## The app never decides that a trigger fired
 *
 * `Countdowns.tsx` opens with the rule: nothing here advances by itself,
 * because the app has no idea whether the roll that just happened was the one
 * that mattered. That rule is not weakened by this chart - it is the reason the
 * chart is shaped this way. The SRD says a dynamic countdown moves by up to
 * three depending on the outcome of an action roll; the app cannot know the
 * outcome, so it prints the five outcomes and the GM presses the one that
 * happened. Architecture 3.2's *proposta, mai automatismo*: the proposal is on
 * the screen, the decision is a thumb.
 *
 * ## Six buttons, not ten
 *
 * Six of the ten advancement cells the SRD prints carry a number. The four that
 * read `No advancement` are drawn as the SRD's words in `--dim` and are **not
 * buttons** - a control that performs no change is the app claiming something
 * it will not do. Which cells are pressable is read off the cell text by
 * `countdownAdvancement`, so a layer that rewrites the chart changes the
 * buttons with it.
 *
 * Both columns are offered and neither is chosen for the GM. The persisted
 * `CountdownKind` has only `'dynamic'` in it - there is no progress/consequence
 * distinction on the record - and adding one is a campaign-schema change under
 * Architecture 6.1 for a distinction the SRD's own sentence above the chart
 * already makes in words. The app does not know which kind a row is, and saying
 * so is cheaper and more honest than a migration.
 *
 * `countdown === null` is the reference screen's read-only copy: no cell is a
 * button there, because there is no countdown for one to act on - and the
 * empty state below drops its second sentence there for the same reason, since
 * the −/+ it names belongs to the row this is folded into and is not on the
 * reference screen at all.
 *
 * ## Ergonomics
 *
 * Inside a `CountdownRow` article at 393px the column is 393 - 24 of region
 * padding - 22 of article padding = 347px. The grid is
 * `minmax(0, 1.15fr)` then one `minmax(0, 1fr)` a column, at 4px gaps, so with
 * the shipped two-column chart that is 124 / 108 / 108. `Failure with Fear` is
 * 17 characters at `.t-meta` - 10px mono at 0.06em, about 6.6px a character -
 * so 112px inside 124, and it wraps rather than clips if a layer writes longer.
 * `Tick down 3` at `.t-num` is 86px inside 108 less 12 of padding.
 *
 * Every button declares `minHeight: var(--tap)`. Five rows plus a header is
 * 20 + 5x44 + 4x4 = 256px, which is why it lives behind a fold that starts
 * shut on a row that is already inside a scroller.
 */
export function CountdownChart({ countdown }: { countdown: Countdown | null }): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const advance = useGm((s) => s.advanceCountdown);
  const chart = useMemo(() => countdownAdvancement(dataset.rules), [dataset]);

  if (chart.rows.length === 0) {
    // The second sentence is about the row this is folded into, so it is only
    // true where there is a row. On the reference screen `countdown` is null,
    // there is no −/+ anywhere on the page, and sending the GM to one would be
    // the app describing a control it is not drawing.
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no advancement chart, so there is nothing to offer.
        {countdown !== null && ' Move the countdown by hand with the − and + above.'}
      </p>
    );
  }

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {chart.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{chart.page === null ? '' : ` · P.${String(chart.page)}`}
        </span>
      </div>
      {chart.lead !== '' && (
        <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
          {chart.lead}
        </p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(0, 1.15fr) repeat(${String(chart.columns.length)}, minmax(0, 1fr))`,
          gap: 4,
          alignItems: 'stretch',
        }}
      >
        <span className="t-meta" style={{ color: 'var(--dim)' }} />
        {chart.columns.map((column) => (
          <span key={column} className="t-meta" style={{ color: 'var(--dim)' }}>
            {column}
          </span>
        ))}

        {chart.rows.map((row) => (
          <Fragment key={row.roll}>
            <span className="t-meta" style={{ alignSelf: 'center', color: 'var(--text-2)' }}>
              {row.roll}
            </span>
            {row.cells.map((cell, i) => {
              const column = chart.columns[i] ?? '';
              // A cell with no number in it is the SRD saying nothing happens.
              // Printed, never pressed.
              if (cell.ticks === null || countdown === null) {
                return (
                  <span
                    key={column}
                    className={cell.ticks === null ? 't-meta' : 't-num'}
                    style={{
                      alignSelf: 'center',
                      color: cell.ticks === null ? 'var(--dim)' : 'var(--text-2)',
                    }}
                  >
                    {cell.text}
                  </span>
                );
              }
              const ticks = cell.ticks;
              return (
                <button
                  key={column}
                  type="button"
                  onClick={() => advance(countdown.id, -ticks)}
                  aria-label={`${countdown.name}: ${row.roll}, ${column} — advance by ${String(ticks)}`}
                  className="btn t-num"
                  style={{ minHeight: 'var(--tap)', padding: '0 6px' }}
                >
                  {cell.text}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * What Close and Far are in feet, and what this app makes of that in metres.
 *
 * ## The metres are the app talking, and the screen says so twice
 *
 * `data/srd-1.0.json` carries no metric column; the book is written in feet and
 * inches. So every metric figure here is arithmetic this app did - feet times
 * 0.3048 - and it is drawn in `--dim` on its own line, prefixed `≈`, with the
 * words COMPUTED BY THIS APP in the same element as the number, under a legend
 * that states the multiplication and the rounding in full. A metric figure
 * printed bare beside an `SRD 1.0 · P.40` stamp would be the app quoting itself
 * as the book, which is the licence-shaped version of the rule this project
 * keeps everywhere else.
 *
 * A bullet the SRD gives no figure for gets no figure here. Two of the six
 * ranges are like that, and a default would be the app inventing a distance the
 * book deliberately left to the fiction.
 *
 * ## And the legend says only what the code does
 *
 * The conversion is performed on the **range lines**, which are labelled
 * bullets drawn as cards with a line of their own for the ≈ figure.
 * `rangeEntry` reads a span or a single figure out of one; prose is quoted and
 * left alone. That is not an oversight and the legend states it: the section
 * opens with the SRD's map-scale premise, *"1 inch of map represents about 5
 * feet of fictional space"*, and converting the 5 inside it would mean either
 * rewriting a sentence this whole module exists never to rewrite, or hanging an
 * app-authored line off a paragraph where nothing says which of its figures the
 * line converted. A legend that promised every figure in feet and delivered the
 * bullets is the same defect as a save that reports a write it did not make.
 *
 * ## Six cards, then four folds
 *
 * The GM who opens this wants the six ranges; the rest of the section - the
 * grid rule, moving under pressure, area of effect, cover - is what they read
 * once. So the opening block is drawn out and every `## ` subhead after it
 * becomes a shut `Fold` labelled with the SRD's own heading, which takes the
 * topic from about 2,600px to about 1,250 and puts four 44px targets where
 * three screens of prose were.
 *
 * ## Ergonomics, 393 x 852
 *
 * The column is 393 - 24 of region padding = 369px, and inside a card's 10px
 * padding 349. The longest bullet in the shipped section is 258 characters at
 * `.t-read` - 13px/1.45, about 6.3px a character - so 56 to a line, five lines,
 * 94px; with the label row and the metric line a card is about 150px and the
 * six come to 940. `≈ 1.5-3 m · COMPUTED BY THIS APP` is 32 characters at
 * `.t-meta` (10px mono at 0.06em, about 6.6px each) = 211px, one line inside
 * 349 at every width this app draws.
 *
 * Nothing in the six cards is a target. A range is a fact you read; there is
 * nothing for the app to do with it, and this component draws no button of its
 * own beyond the fold headers, which are 44px and full width.
 */
export function RangeReference(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const ranges = useMemo(() => rangeReference(dataset.rules), [dataset]);

  if (ranges.opening.length === 0 && ranges.sections.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no range section, so there is nothing to quote and nothing to convert.
      </p>
    );
  }

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {ranges.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{ranges.page === null ? '' : ` · P.${String(ranges.page)}`}
        </span>
      </div>

      {/*
        Above the text it qualifies, and named for what it is. The rest of this
        screen is the SRD; this paragraph and the ≈ lines below are not.
      */}
      <div className="panel stack" style={{ flex: 'none', gap: 6, padding: 10 }}>
        <span className="t-label" style={{ color: 'var(--hope)' }}>
          THE METRES ARE THIS APP&rsquo;S ARITHMETIC
        </span>
        <span className="t-dense" style={{ color: 'var(--text-3)' }}>
          The rules are written in feet and carry no metric figure at all. Where one of the range
          lines below gives a distance in feet, this app multiplies it by 0.3048 — the
          international foot — and rounds to the nearest half metre below ten and the nearest whole
          metre above. Where a line gives none, neither does this. Figures inside the prose around
          them are left exactly as the book wrote them: this app quotes a rules sentence, it does
          not annotate one.
        </span>
      </div>

      <RangeParts parts={ranges.opening} />

      {ranges.sections.map((section) => (
        <Fold key={section.heading} label={section.heading}>
          <RangeParts parts={section.parts} />
        </Fold>
      ))}
    </>
  );
}

/** A block of the range section: its prose and its labelled bullets, in order. */
function RangeParts({ parts }: { parts: RangePart[] }): React.JSX.Element {
  return (
    <>
      {parts.map((part, i) => {
        // The index is the key because the book's order is the identity: two
        // paragraphs of a rules body may legitimately be equal strings.
        const key = `${part.kind}-${String(i)}`;
        if (part.kind === 'text') {
          return (
            <p key={key} className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
              {part.text}
            </p>
          );
        }
        return (
          <div key={key} className="stack" style={{ flex: 'none', gap: 6 }}>
            {part.entries.map((entry) => (
              <article
                key={entry.label}
                className="panel stack"
                style={{ flex: 'none', gap: 5, padding: 10, minWidth: 0 }}
              >
                <span style={{ font: '700 14px/1.2 var(--sans)' }}>{entry.label}</span>
                <span className="t-read" style={{ maxWidth: '62ch' }}>
                  {entry.text}
                </span>
                {entry.metres !== null && (
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    ≈ {entry.metres} · COMPUTED BY THIS APP
                  </span>
                )}
              </article>
            ))}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * How hard is it? - the SRD's own worked example at each of the six numbers.
 *
 * ## Why there are no adjectives on this screen
 *
 * The printed GM screen labels its ladder with five adjectives running from
 * easiest to hardest. None of them is in `data/srd-1.0.json`, so this app does
 * not have them to print. What the SRD does have is better: eighteen verbs, six
 * numbers, and a concrete sentence in all hundred and eight cells. A GM setting
 * a Difficulty gets "walk slowly across a narrow beam" instead of a word they
 * have to interpret, and the app quotes rather than invents.
 *
 * ## Not a `<table>`
 *
 * Six tables of three columns, each cell a whole sentence, is 6,465 characters
 * of prose. Any grid of it scrolls a 393px phone sideways whatever the column
 * widths are. So the table is turned on its side: pick a trait, pick a verb or
 * take all three, and read six stacked panels down the column.
 *
 * The default is every verb, because the question a GM arrives with is usually
 * "how hard is walking a beam" - a scan, not a lookup. The verb filter is for
 * the GM who already knows which of the three they want. There is deliberately
 * no picker for the roll value: that is the number you came here to find, and a
 * control that made you guess it first would be the screen asking the question.
 *
 * ## Ergonomics, 393 x 852
 *
 * The column is 369px, 349 inside a panel. A trait chip is three characters at
 * `.t-label` (10px mono at 0.16em, about 7.6px a character) plus 24 of padding
 * = about 47, so `minWidth: var(--tap)` is a floor these clear rather than the
 * width they take; six of them at 4px gaps are 6x47 + 5x4 = 302 in a 369px
 * column: one row, no wrap.
 * The verb row is ALL plus three chips read off the table's own header; the
 * widest set in the shipped dataset is Knowledge - RECALL 70, ANALYZE 77,
 * COMPREHEND 100 by the same arithmetic - so 47 + 70 + 77 + 100 + 3x4 = 306,
 * one row again. Both rows wrap rather than scroll if a layer writes longer
 * verbs.
 *
 * A cell is about 69 characters at `.t-read` (13px/1.45, about 6.3px each), so
 * 55 to a line, two lines, 38px; with its verb label a block is 51px and a roll
 * panel with all three is about 190. Six of them is 1,150px, two flicks in a
 * region that already scrolls - and 470px, one screen, with a single verb
 * selected.
 *
 * Every chip declares `minHeight: var(--tap)` and carries `aria-pressed` and a
 * full-word `aria-label`, because AGI is a name for eyes and not for ears.
 */
export function DifficultyLadder(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const guide = useMemo(() => difficultyBenchmarks(dataset.rules), [dataset]);
  const traits = TRAITS.filter((t) => guide.ladder[t] !== undefined);
  const [wanted, setWanted] = useState<Trait | null>(null);
  const [verb, setVerb] = useState<string | null>(null);

  if (traits.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no Difficulty benchmarks. The number is still yours to set — the
        worked examples are what is missing.
      </p>
    );
  }

  // A layer can drop a trait, and a selection made before it did must not leave
  // the screen blank with three chips still on it.
  const trait = wanted !== null && traits.includes(wanted) ? wanted : traits[0]!;
  const ladder = guide.ladder[trait]!;
  const shown = verb !== null && ladder.verbs.includes(verb) ? verb : null;
  const columns = ladder.verbs.map((name, i) => ({ name, i })).filter((c) => shown === null || c.name === shown);

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {guide.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{guide.page === null ? '' : ` · P.${String(guide.page)}`}
        </span>
      </div>

      {guide.lead.map((para) => (
        <p key={para} className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
          {para}
        </p>
      ))}

      <div role="group" aria-label="Which trait" className="row" style={{ flex: 'none', gap: 4, flexWrap: 'wrap' }}>
        {traits.map((t) => (
          <Chip
            key={t}
            label={TRAIT_LABELS[t]}
            on={t === trait}
            onPress={() => {
              setWanted(t);
              // A verb belongs to one trait's table. Carrying the choice across
              // would filter the new table by a column it does not have.
              setVerb(null);
            }}
          >
            {TRAIT_LABELS[t].slice(0, 3)}
          </Chip>
        ))}
      </div>

      <div role="group" aria-label="Which kind of roll" className="row" style={{ flex: 'none', gap: 4, flexWrap: 'wrap' }}>
        <Chip label={`Every kind of ${TRAIT_LABELS[trait]} roll`} on={shown === null} onPress={() => setVerb(null)}>
          ALL
        </Chip>
        {ladder.verbs.map((name) => (
          <Chip key={name} label={name} on={shown === name} onPress={() => setVerb(name)}>
            {name}
          </Chip>
        ))}
      </div>

      {ladder.rows.map((row) => (
        <article
          key={row.roll}
          className="panel stack"
          style={{ flex: 'none', gap: 8, padding: 10, minWidth: 0 }}
        >
          <span className="t-num" style={{ fontSize: 18, color: 'var(--hope)' }}>
            {row.roll}
          </span>
          {columns.map((column) => (
            <span key={column.name} className="stack" style={{ gap: 3, minWidth: 0 }}>
              <span className="t-meta">{column.name}</span>
              <span className="t-read" style={{ maxWidth: '62ch' }}>
                {row.cells[column.i] ?? ''}
              </span>
            </span>
          ))}
        </article>
      ))}
    </>
  );
}

/**
 * One chip of a filter row.
 *
 * `label` is the accessible name and the visible text is whatever the caller
 * draws - AGI on screen and "Agility" to a screen reader, because the three
 * letters are a name for eyes only.
 */
function Chip({
  label,
  on,
  onPress,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      aria-pressed={on}
      className="t-label"
      style={{
        flex: 'none',
        minHeight: 'var(--tap)',
        minWidth: 'var(--tap)',
        padding: '0 12px',
        borderRadius: 'var(--r3)',
        border: `1px solid ${on ? 'var(--text-3)' : 'var(--line)'}`,
        color: on ? 'var(--text)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

/**
 * The GM chapter: principles, practices, how a move is made, and the pitfalls.
 *
 * Five sections, five shut folds, each labelled with the SRD's own title and
 * summarised with its own page - because they are on four different pages and a
 * single stamp for the topic would print one of them over the other four.
 *
 * Every section is drawn whole. These are lists of one-line instructions, and a
 * screen that showed three principles out of the seven `rules['gm-principles']`
 * carries would be choosing which principles a GM gets; the fold costs a tap
 * and keeps all of them. `pitfalls-to-avoid` writes five of its six subheads in
 * capitals and one in mixed case,
 * which is exactly why nothing here matches a heading - the app never gets to
 * decide which of the SRD's warnings is worth reading.
 *
 * ## Ergonomics, 393 x 852
 *
 * Shut, the topic is five 44px headers and four 8px gaps = 252px: one screen,
 * and the choice of which chapter to read is made without scrolling. Open, the
 * longest is `making-gm-moves` at 3,736 characters - about 1,900px at
 * `.t-read` in a 369px column - so opening all five at once would be 3,600px,
 * and shut-by-default is what keeps that behind a deliberate tap rather than in
 * front of a thumb.
 *
 * Each fold header is the full width of the column and 44px tall, which makes
 * it the largest target on the screen and the only one that can be hit without
 * looking. Nothing inside a fold is a target at all: a principle is a sentence
 * you read.
 */
export function GmMoves(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const sections = useMemo(() => gmMoves(dataset.rules), [dataset]);

  if (sections.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries none of the GM chapter. The tools still work; it is the advice that is
        missing.
      </p>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <Fold
          key={section.id}
          label={section.title}
          summary={`SRD 1.0${section.page === null ? '' : ` · P.${String(section.page)}`}`}
        >
          {section.blocks.map((block, i) => (
            <BlockView key={`${block.heading ?? ''}-${String(i)}`} block={block} />
          ))}
        </Fold>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * The eighteen Experiences the SRD offers a GM inventing an adversary.
 *
 * This is the GM's half of a list the app already half-had: the player-facing
 * examples live in character creation, and these - Ambusher, Hunt from Above,
 * Keen Senses - are for the creature on the other side of the table. Nothing in
 * the app had ever drawn them.
 *
 * Read as chips because that is what they are: eighteen single words a GM scans
 * and picks one from. They are **not** buttons. There is nothing for a tap to
 * do - an adversary's Experience is written on its stat block, and this app
 * does not let you edit one - and a chip that looked pressable would be
 * promising an edit that does not exist.
 *
 * ## Ergonomics, 393 x 852
 *
 * Chips wrap in a 369px column at `.t-dense` (11.5px, about 5.5px a character)
 * with 8px of padding either side: the longest, `Magical Knowledge`, is 17
 * characters = 110px, and the median is about 60. Eighteen of them come to
 * roughly four rows of 28px plus 6px gaps = 130px, so the whole topic including
 * its lead is under 300 and needs no fold.
 */
export function AdversaryExperiences(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const examples = useMemo(() => adversaryExperiences(dataset.rules), [dataset]);

  if (examples.items.length === 0) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no adversary Experiences to suggest.
      </p>
    );
  }

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {examples.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{examples.page === null ? '' : ` · P.${String(examples.page)}`}
        </span>
      </div>
      {examples.lead !== null && <BlockView block={examples.lead} />}
      <div className="row" style={{ flex: 'none', gap: 6, flexWrap: 'wrap' }}>
        {examples.items.map((item) => (
          <span
            key={item}
            className="t-dense"
            style={{
              flex: 'none',
              padding: '5px 8px',
              borderRadius: 'var(--r3)',
              border: '1px solid var(--line)',
              color: 'var(--text-2)',
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * What a night at an inn costs, and the SRD's own permission to change it.
 *
 * The Average Costs table is the reason this topic exists - it is the one
 * lookup on this screen that stops play mid-sentence, because a player has
 * just asked what a horse costs - but the table alone would be a lie by
 * omission. The SRD prints it under a paragraph that tells the GM to adjust
 * every entry to their campaign, and a screen showing twelve prices with that
 * sentence stripped off would be presenting a suggestion as a price list. So
 * the section is drawn whole, through the same `BlockView` the GM chapter and
 * the `LINK -> Rule` row already draw a chosen section with, and its one pipe
 * table lands in `RuleTableView`'s two-column shape - the `Expense | Cost` pair
 * that view's own docblock already names as its narrow case.
 *
 * Nothing here is a target, and that is not an omission either. The app does
 * carry a purse - `engine/gold.ts` holds `gain`, `spend` and `MAX_CHESTS`, and
 * `GoldEditor` on BUILD is three steppers over it - but it is a *character's*,
 * and this screen reads no character and has no write path to one, so a tap on
 * `1 Handful` would have nothing to spend it from. There are no inventory
 * prices and no shop anywhere in the app either. The GM reads the number and
 * says it out loud.
 *
 * ## Ergonomics, 393 x 852
 *
 * `RuleTableView` splits the region's column into two `minmax(0, 1fr)` cells at
 * a 10px gap. The widest first cell the shipped table carries is
 * `Meals for a party of adventurers per night` at 42 characters, which is the
 * 42 that view's docblock costs its two-line case on - so five of the twelve
 * left cells run to two lines, that Meals row and the four
 * `Tier N equipment (weapons, armor)` rows, and the right column stays on one
 * throughout. Measured in Chrome at 393 x 852, device-scale-factor 1, on this
 * branch's own build: the grid resolves to `178.5px 178.5px` at the 10px
 * column gap, a one-line `.t-read` cell is 18.84 tall and a two-line one
 * 37.69, and the whole grid is 390.34.
 * Nothing declares a width, so a rules layer that writes a longer expense wraps
 * instead of pushing the phone sideways.
 */
export function GoldAndLoot(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const section = useMemo(() => goldAndLoot(dataset.rules), [dataset]);

  if (section === null) {
    return (
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        This dataset carries no costs for gold, equipment or loot. What to charge was always
        yours to set; what is missing is the SRD&rsquo;s starting point for it.
      </p>
    );
  }

  return (
    <>
      <div className="spread">
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {section.title}
        </span>
        <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
          SRD 1.0{section.page === null ? '' : ` · P.${String(section.page)}`}
        </span>
      </div>
      {section.blocks.map((block, i) => (
        <BlockView key={`${block.heading ?? ''}-${String(i)}`} block={block} />
      ))}
    </>
  );
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
 * pipes; 42 of the 80 shipped sections are one of those two shapes. A second
 * renderer beside this one would have been a second thing to keep in step, and
 * the pipes are what that costs.
 */
export function BlockView({ block }: { block: SectionBlock }): React.JSX.Element {
  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      {block.heading !== null && (
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {block.heading}
        </span>
      )}
      {block.parts.map((part, i) => {
        // The index is the key because the book's order is the identity here:
        // two paragraphs of a rules body may legitimately be equal strings.
        const key = `${part.kind}-${String(i)}`;
        if (part.kind === 'text') {
          return (
            <p key={key} className="t-read" style={{ margin: 0, maxWidth: '62ch' }}>
              {part.text}
            </p>
          );
        }
        if (part.kind === 'table') return <RuleTableView key={key} table={part.table} />;
        return (
          <ul key={key} className="stack" style={{ flex: 'none', gap: 5, margin: 0, paddingLeft: 18 }}>
            {part.items.map((item) => (
              <li key={item} className="t-read" style={{ maxWidth: '62ch' }}>
                {item}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
