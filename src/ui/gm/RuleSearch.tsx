/**
 * The rules, searched: a field at the foot of SHOW and the hits above it.
 *
 * ## What this is not
 *
 * It is not a second reference screen, and the shape it takes is the argument.
 * `Reference.tsx` is eight chosen subjects with a renderer apiece - the
 * Difficulty ladder pivots, the countdown chart puts a button on its cells
 * when there is a countdown for a button to move. Those are the questions a GM
 * knows they have. This is the other kind: a phrase off a page, half
 * remembered, wanted now. It covers every section `dataset.rules` carries -
 * sixty-nine in the shipped SRD - and draws every one of them through
 * `BlockView`, which is already this app's single drawing of a section
 * somebody chose: the GM chapter's five folds use it, the adversary
 * Experiences put their lead block through it, the costs topic beside them
 * draws its whole section through it, and so does the `ADD -> LINK -> Rule`
 * row. So there is no second renderer here to fall out of step with the first,
 * and nothing about a section is decided twice.
 *
 * A hit opens **in place**, and only one at a time. Sending the GM to another
 * screen to read the answer would be the second reference screen; opening every
 * hit at once would bury the list under the first section's bullets. One open
 * hit keeps the list, the answer and the field all on the same surface.
 *
 * That single-open rule is the whole reason `Hit` below is not `Fold`. Its
 * header is otherwise `Fold`'s header, deliberately - same `t-label` title in
 * `--text-2`, same `t-meta` page stamp in `--muted`, same `aria-expanded`
 * button, same `gap: open ? 8 : 0` - but `Fold` owns its open state privately,
 * so a list of them can only ever be all-shut or however many the GM has left
 * open. It also has one line in its header, and a hit's header has three.
 *
 * The stamp was `--dim` here while this sentence claimed it was `Fold`'s, which
 * is a shade darker than `Fold.tsx` draws its summary and so a shade darker
 * than the five GM-chapter folds this file names as its precedent - the same
 * `SRD 1.0 - P.n` string, one step back from it, on the same screen. The
 * sentence is the one that was right: it is `--muted` now, and `t-meta` at
 * `--dim` is left to the two labels that are not `Fold`'s - the group headers
 * and the table note - which have no counterpart there to disagree with.
 *
 * ## The organised half of the request: two groups, not a ranking
 *
 * `searchRules` returns title matches before body matches. That order is
 * invisible in a flat list, so the list is drawn as the two groups the order
 * already is: **IN THE TITLE**, then **IN THE TEXT**, each with its own count.
 * A GM who typed `countdown` sees at a glance that one section of the shipped
 * SRD is *about* countdowns and six merely mention them, which is the
 * distinction they were going to make by reading the titles anyway.
 *
 * It is two groups rather than a relevance score for the reason `searchRules`
 * gives: weighting the SRD's sections would be the app deciding which rule the
 * GM meant. A group header is the data's own split, printed.
 *
 * ## Where the query landed, marked
 *
 * The matched characters are drawn in `--text` at weight 700 inside a `<mark>`
 * whose background is explicitly cleared. A GM scanning fifteen previews in a
 * dim room needs to find their own words in each line without reading it, and a
 * yellow block - the UA default - is a lamp in that room. Nothing is reworded,
 * nothing is reordered, and the marked run is the line's own characters in the
 * line's own case: `preview` splits, it never rewrites.
 *
 * The title is marked through the same call. For a text hit the title cannot
 * contain the query - a title that contained it would have made it a title hit
 * - so the mark is empty there and the title draws plain, with no branch.
 *
 * ## Ergonomics: the field is the last element in the sheet
 *
 * SHOW opens from the bottom bar, so its sheet is anchored to the bottom of the
 * window - `GmSheet` puts `justifyContent: flex-end` on the scrim for a phone -
 * and it grows *upwards* as its content grows, to the `maxHeight: 85%` that
 * file declares. Put the field first and it is at the top of the sheet: the
 * furthest point from the thumb that just pressed SHOW, and worse, a point that
 * **moves further away with every result that appears**, because the sheet
 * grows up from under it. Put it last and it sits on the bottom edge, where the
 * thumb already is, and it does not move at all while the hits fill in above.
 * Nothing under the thumb changes position while the GM types.
 *
 * Measured in Chrome at 393 x 852 with a coarse pointer, not derived: the
 * sheet's inner column is 363px, the field row is 44px tall and sits on the
 * sheet's bottom edge with 14px of padding under it, and a group header is
 * 10px. A shut hit is 44px whenever what it carries fits inside that floor,
 * which is every title-only hit, every table hit, and every preview that comes
 * to a single line; 56.7 at two preview lines and 72.6 at three. The tallest
 * measured was 82.6, and it was not a preview that did it: a title long enough
 * to wrap in a 363px column puts 10px on the header before the three lines
 * under it.
 *
 * **That measurement's subject no longer exists.** It was `The Witherwild:
 * Campaign Mechanics`, and the frame was dropped from the dataset by the
 * decision of 2026-08-23. The mechanism outlives the example - titles that wrap
 * a 363px column are still in there, and the longest is now `Giving Out Gold,
 * Equipment, and Loot` at 36 characters against that one's 34 - but 82.6 is not
 * re-measured here and must not be read as current. It belongs to the single
 * Chrome pass that owes six surfaces at once.
 *
 * Empty, the sheet is 308.2px - a little over a third of the window. Typing
 * fills it upward: `countdown` finds seven sections and takes it to 632.4px,
 * and `adversary` finds twenty and pins it against the cap. (`countdown` is
 * still seven after the Witherwild removal and `adversary` was twenty-two
 * before it; both counts re-run against the shipped dataset rather than
 * assumed. It still pins without a fresh measurement, and that is arithmetic
 * on numbers already taken rather than a new one: twenty shut hits at the 44px
 * floor is 880px against a cap of 717.4.) That cap
 * measures **717.4px**, not the 724.2 that 85% of 852 would be, because
 * `GmSheet` pays 8px of padding above the panel and a percentage `max-height`
 * resolves against the flex container's content box - 85% of 844. Nine of those
 * twenty hits are fully on screen before the first scroll. All of that is
 * this machine's Chrome at a 393px viewport, not a phone's.
 *
 * A phone keyboard rises from that same bottom edge, and its height - and what
 * a browser does to a `position: fixed` scrim when it appears - is a device
 * behaviour this lane had no phone to measure. So nothing here is arithmetic on
 * it. What the layout guarantees without measuring the keyboard is the ordering:
 * the field is the element nearest the keyboard, the hits read upward from it
 * nearest-first, and a field at the top would put its first result behind the
 * keyboard on any phone where the two together are taller than the sheet.
 *
 * It does not autofocus on a phone, for the reason `GearPicker`'s search box
 * gives: the keyboard would take the sheet before the GM has seen what is in
 * it. On a pointer device it focuses, because there the keyboard costs nothing.
 *
 * ## Targets
 *
 * The field, CLEAR and every hit header declare their height **inline** as the
 * number 44, not as `var(--tap)`: jsdom reads only inline styles and does not
 * resolve custom properties, so a floor written as a token is a claim no test
 * in this repo can check. A hit's header is the full width of the column and
 * carries the title and the page stamp on one line, the matched line under it
 * and, where there is one, the table note under that: one target, read down,
 * pressed anywhere.
 *
 * CLEAR is drawn rather than left to `type="search"`, whose own clear button
 * is the user agent's to draw or not and which this lane had no phone to check.
 * The sheet's promise - that emptying the field brings the two doors straight
 * back - is not a promise to leave to a UA, and one certain tap beats twenty
 * backspaces. It appears with the first character: measured,
 * CLEAR is 58 x 44 and the row's gap is 8, so the field goes from 363px to
 * 297px the moment a character lands. That reflow happens once, while the GM is
 * looking at the keyboard rather than at the field, and the alternative is a
 * permanent 66px hole or a greyed control, both of which `ShowSheet`'s own
 * docblock argues against.
 *
 * ## The preview is windowed, and says where it cut
 *
 * 294 of the 969 non-empty body lines in the shipped SRD are longer than the
 * 150 characters this window keeps, and the longest is 780. A list of fifteen
 * of those is a list nobody scans. `preview` below takes a window around the
 * match rather than the first N characters, so the words the GM typed are always
 * inside it, and marks each cut end with an ellipsis. Nothing is reworded and
 * nothing is summarised; the whole line is one tap away, and the tap draws the
 * section it came from.
 */
import { useMemo, useState } from 'react';
import type { RulesSection } from '../../../shared/types.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { ruleSection, searchRules, type RuleHit } from '../shared/srdReference.ts';
import { BlockView } from './ReferenceTables.tsx';

/** How much of a long line to keep on either side of the match. */
const BEFORE = 34;
const AFTER = 116;

/**
 * A line split into what comes before the query, the query as the line spells
 * it, and what comes after.
 *
 * `match` is a slice of the line rather than the typed query, so the case is
 * the book's: type `very close` and what is marked is `Very Close`. It is `''`
 * when the line does not carry the query at all, which is the honest answer for
 * a title on a hit that matched in the body.
 */
export interface RulePreview {
  before: string;
  match: string;
  after: string;
}

/**
 * A long line, cut down to a window that contains the match, and split at it.
 *
 * Each cut lands on the nearest space between it and the match, where there is
 * one, so the preview does not begin or end mid-word; where there is not - a
 * 34-character run with no space in it - it cuts where it has to. An ellipsis marks each end that was cut, and only an end that was
 * cut - a line that fits comes back whole, character for character, which is
 * what lets the stamp beside it stay honest.
 */
export function preview(line: string, query: string): RulePreview {
  const needle = query.trim().replace(/\s+/g, ' ').toLowerCase();
  const at = needle === '' ? -1 : line.toLowerCase().indexOf(needle);
  if (at === -1) return { before: line, match: '', after: '' };

  if (line.length <= BEFORE + needle.length + AFTER) {
    return {
      before: line.slice(0, at),
      match: line.slice(at, at + needle.length),
      after: line.slice(at + needle.length),
    };
  }

  let start = Math.max(0, at - BEFORE);
  if (start > 0) {
    const space = line.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  let end = Math.min(line.length, at + needle.length + AFTER);
  if (end < line.length) {
    const space = line.lastIndexOf(' ', end);
    if (space > at + needle.length) end = space;
  }
  return {
    before: `${start > 0 ? '…' : ''}${line.slice(start, at)}`,
    match: line.slice(at, at + needle.length),
    after: `${line.slice(at + needle.length, end)}${end < line.length ? '…' : ''}`,
  };
}

const stamp = (page: number | null): string => `SRD 1.0${page === null ? '' : ` · P.${String(page)}`}`;

/** A previewed line with the query's characters lifted out of it. */
function Marked({ found }: { found: RulePreview }): React.JSX.Element {
  return (
    <>
      {found.before}
      {found.match !== '' && (
        <mark style={{ background: 'transparent', color: 'var(--text)', fontWeight: 700 }}>
          {found.match}
        </mark>
      )}
      {found.after}
    </>
  );
}

/**
 * The field, and the one control that empties it.
 *
 * Owned by the caller, because the caller decides what the rest of its sheet
 * does while a query is being typed.
 */
export function RuleSearchField({
  value,
  onChange,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  total: number;
}): React.JSX.Element {
  const phone = useIsPhone();
  return (
    <div className="row" style={{ flex: 'none', gap: 8 }}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The count is the dataset's, not a number typed here: a homebrew layer
        // that adds sections is searched too, and a placeholder that said 75
        // anyway would be the screen guessing at what it holds.
        placeholder={`Search ${String(total)} rules sections`}
        aria-label="Search the rules by title and text"
        enterKeyHint="search"
        autoFocus={!phone}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          padding: '8px 11px',
          font: '600 14px/1 var(--sans)',
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="t-label"
          onClick={() => onChange('')}
          aria-label="Clear the search"
          style={{ flex: 'none', minHeight: 44, minWidth: 44, padding: '0 10px', color: 'var(--muted)' }}
        >
          CLEAR
        </button>
      )}
    </div>
  );
}

/**
 * What the live line says, including when the answer is none.
 *
 * The counts are the eye's too - each group header prints its own - so this
 * says the total rather than repeating them, and it is the only sentence on
 * this surface a GM who cannot see the list gets for free.
 */
const spoken = (count: number): string => {
  if (count === 0) return 'No section matches';
  return count === 1 ? '1 section matches' : `${String(count)} sections match`;
};

/** What the two group headers say, and which hits belong under each. */
const GROUPS: ReadonlyArray<{ label: string; holds: (hit: RuleHit) => boolean }> = [
  { label: 'IN THE TITLE', holds: (hit) => hit.where === 'title' },
  { label: 'IN THE TEXT', holds: (hit) => hit.where !== 'title' },
];

/**
 * The hits, in `searchRules`' order, grouped by where they landed, one open.
 *
 * `dataset.rules` is read through a selector narrow enough to be the array
 * itself, so a layer that rewrites a rules section changes both what is found
 * and what is drawn, and nothing in this file holds a copy. It is read once
 * here and handed down rather than read again in every hit: a query that
 * matches half the SRD would otherwise open forty subscriptions to the store to
 * answer one question.
 */
export function RuleSearchResults({ query }: { query: string }): React.JSX.Element {
  const rules = useApp((s) => s.dataset.rules);
  const hits = useMemo(() => searchRules(rules, query), [rules, query]);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {/*
        The one thing on this surface that speaks when it changes, and it says
        the empty answer in the same breath as the counts. It used to sit below
        the zero-hits guard, inside the branch that draws the groups, so it was
        absent from the only result a GM reaches by typing one word too many:
        twenty sections became a sentence an eye could read and a live region
        could not, which is the silence this exists to prevent. The group
        headers below carry the same counts for an eye, and a header is not
        live.

        It is the first child of this fragment and stands ahead of the branch,
        so going from twenty matches to none changes the text of an element
        that was already on the page instead of swapping one element for
        another - the form of the change assistive tech will read. What it
        still cannot do is carry the *first* answer: nothing here is mounted
        until the field has a character in it, so the region arrives together
        with its own first content, which is the case a screen reader most
        often declines to announce. Curing that would mean a live region living
        outside these results, in a sheet that deliberately does not run the
        search - the test that mounts this component alone says why the search
        belongs to it. jsdom can prove the text and the position; it cannot
        prove the utterance, and no test in this repo claims to.
      */}
      <span className="sr-only" role="status">
        {spoken(hits.length)}
      </span>
      {hits.length === 0 && (
        <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
          No rule in this dataset carries that. The search reads every section’s title and its
          whole text, so a phrase that is not here is not in the rules the app is holding.
        </p>
      )}
      {GROUPS.map((group) => {
        const inGroup = hits.filter(group.holds);
        if (inGroup.length === 0) return null;
        return (
          <div key={group.label} className="stack" style={{ flex: 'none', gap: 10 }}>
            <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
              {group.label} · {inGroup.length}
            </span>
            {inGroup.map((hit) => (
              <Hit
                key={hit.id}
                hit={hit}
                query={query}
                rules={rules}
                open={hit.id === openId}
                onToggle={() => {
                  setOpenId(hit.id === openId ? null : hit.id);
                }}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function Hit({
  hit,
  query,
  rules,
  open,
  onToggle,
}: {
  hit: RuleHit;
  query: string;
  rules: RulesSection[];
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const section = useMemo(() => (open ? ruleSection(rules, hit.id) : null), [rules, hit.id, open]);

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="stack"
        style={{
          flex: 'none',
          minHeight: 44,
          width: '100%',
          gap: 3,
          padding: '6px 2px',
          textAlign: 'left',
          alignItems: 'flex-start',
        }}
      >
        <span className="row" style={{ width: '100%', gap: 8 }}>
          <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>
            <Marked found={preview(hit.title, query)} />
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
            {stamp(hit.page)}
          </span>
        </span>
        {hit.line !== null && (
          <span className="t-dense" style={{ color: 'var(--muted)' }}>
            <Marked found={preview(hit.line, query)} />
          </span>
        )}
        {hit.where === 'table' && (
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            Inside this section’s table.
          </span>
        )}
      </button>
      {open &&
        (section === null ? (
          // Unreachable while the hit came from the same `rules` array this
          // reads, and drawn anyway: `rules` is one prop now, but a section can
          // still go if a layer lands between the click and the render.
          <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
            This dataset no longer carries that section.
          </p>
        ) : (
          section.blocks.map((block, i) => (
            <BlockView key={`${block.heading ?? ''}-${String(i)}`} block={block} />
          ))
        ))}
    </section>
  );
}
