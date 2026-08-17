/**
 * Picking gear out of 204 weapons, 34 armors and 120 items.
 *
 * The card browser already answered this question for 189 domain cards, so
 * this is that screen again rather than a second idea of what a filter looks
 * like: a search box, segmented controls, chip rows where empty means "any", a
 * count of what survived, and a CLEAR FILTERS that only exists once something
 * is filtered. Every filter crosses every other.
 *
 * It opens as a dialog because the alternative is a picker nested inside the
 * wizard's own scrolling panel - filters that scroll away from the list they
 * filter, inside a page that also scrolls. As a dialog it owns the viewport and
 * decides for itself what gives when there is not enough of it; `PickerDialog`
 * below is where that decision is written down, with the measurements.
 *
 * What a character cannot use yet is shown, dimmed, with the level it arrives
 * at. Hiding it would answer "what can I use" by pretending the rest of the
 * book does not exist, and a player deciding what to save for needs to see the
 * tier 3 weapon they are saving for.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import {
  RANGES,
  TRAITS,
  TRAIT_LABELS,
  type Armor,
  type Character,
  type Item,
  type Range,
  type Ref,
  type Tier,
  type Weapon,
  type WeaponTrait,
} from '../../../shared/types.ts';
import { deriveStats, weaponDamage, type DerivedStats } from '../../engine/character.ts';
import { useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import {
  armorQuery,
  armorQueryChanged,
  filterArmors,
  filterItems,
  filterWeapons,
  itemQuery,
  itemQueryChanged,
  weaponQuery,
  weaponQueryChanged,
  type ArmorQuery,
  type ItemQuery,
  type WeaponQuery,
} from './gear.ts';

const TIERS: Tier[] = [1, 2, 3, 4];
const BURDENS = [1, 2] as const;
const WEAPON_TRAITS: WeaponTrait[] = [...TRAITS, 'spellcast'];

const toggled = <T,>(set: ReadonlySet<T>, v: T): ReadonlySet<T> => {
  const next = new Set(set);
  if (!next.delete(v)) next.add(v);
  return next;
};

/** A weapon may roll with Spellcast rather than a named trait. */
export const weaponTraitLabel = (t: WeaponTrait): string =>
  t === 'spellcast' ? 'SPELLCAST' : TRAIT_LABELS[t].toUpperCase();

/**
 * A weapon's line of numbers, with the damage the player will actually roll.
 *
 * The book prints `d8+3`; at Proficiency 3 you roll `3d8+3`. Printing the
 * book's version on a sheet that knows the Proficiency would make the player
 * do the app's arithmetic, so the engine is asked and its answer is what shows.
 */
export function weaponSummary(w: Weapon, stats: DerivedStats): string {
  const damage = weaponDamage(w, stats)?.spec ?? w.damage;
  return [
    `${damage} ${w.damageType === 'mag' ? 'MAG' : 'PHY'}`,
    w.range.toUpperCase(),
    weaponTraitLabel(w.trait),
    w.burden === 2 ? 'TWO-HANDED' : 'ONE-HANDED',
  ].join(' · ');
}

export const armorSummary = (a: Armor, thresholds: [number, number], score: number): string =>
  `${thresholds[0]}/${thresholds[1]} THRESHOLDS · SCORE ${score}`;

// ---------------------------------------------------------------------------
// The dialog and its furniture
// ---------------------------------------------------------------------------

/**
 * The list's floor, in pixels, and where the number comes from.
 *
 * Measured in Chrome at the narrowest viewport this app is held to, 320x568:
 * the tallest first row any of the three pickers draws is armor's, at 85px
 * (weapons are 82). A scrollport exactly one row tall reads as "that is all
 * there is", so the floor is one whole row, the column's 8px gap, and 25px of
 * the row after it - 118px of content box, plus the list's own 10+12 of
 * padding. Below this the list stops being a list.
 */
const LIST_FLOOR = 140;

/**
 * Five bands, and the order in which they give.
 *
 * ## What was wrong
 *
 * The panel was three bands - a filter head, the list, a footer - and both the
 * head and the footer were `flex: none`. The head is the expensive one: at 320
 * CSS pixels of width the three `Seg` groups wrap onto three lines and the
 * whole block measures **489px**, against the 546px a 320x568 phone leaves
 * inside the overlay's 10px padding. 489 + 63 of footer is 552, so the list -
 * the one child that could give, with `flex: 1; min-height: 0` - was squeezed
 * to its own 22px of padding and **0px of content**, and the remaining 28px
 * went under the panel's `overflow: hidden`. Measured, at HEAD, with the
 * fixture equipped: list clientHeight 22 against a scrollHeight of 20534, and
 * Unequip and Done drawn at y532-576 against a clip edge of 557 - 19px of each
 * 44px button cut, 25px left. A landscape phone was worse: at 852x393 and
 * 667x375 the footer is drawn at y424-468 against a clip edge of 382 and 371,
 * so **both verbs were 0px on glass** and `elementFromPoint` at their centres
 * returned nothing at all. This is the screen where a player equips a weapon,
 * and it could show no weapons and had no visible Done.
 *
 * The armor picker failed the same way one viewport later, and silently: its
 * head is 225px, so nothing was ever cut, but at 852x393 and 667x375 the list
 * came out 83px and 65px against 85px rows - **no whole row of armor on the
 * screen at all**, on the screen whose only job is comparing armor.
 *
 * It is worth saying what this is *not*, because two other defects in this
 * pass were: it is not a scroll container starved by an ancestor with no
 * `min-height: 0`. The list already carried `min-height: 0`, and `.stack`
 * carries it too. The ancestor that would not give is the filter head itself,
 * at `flex: none`.
 *
 * The panel's own height was a second, separate bug, found by measuring the
 * first fix rather than by reading it. `max-height: 100%` on a flex column
 * leaves its main size *indefinite*, and the flex algorithm then resolves the
 * bands against the container's max-content - which here is the list's 15818px
 * of weapons - and Chrome does not re-run the resolution against the clamped
 * height. The filter band's flex base size came out **22px around 264px of
 * content** at 744x1133, where 847px was free. `height: 100%` makes the main
 * size definite and is the whole of that fix: the same measurement then reads
 * 264 of 264.
 *
 * ## What gives now, in order
 *
 * 1. **the name and the way out** - `flex: none`, 54px. The ✕ is the only
 *    control that is on glass at every viewport this app is measured at
 *    (y21-65, uncut, all six), and it stays that way: it may not be a thing
 *    you have to scroll a band to find.
 * 2. **the filters** - `flex: 0 1 auto` on a `scroll` band wrapping the column.
 *    The only child of the five with a non-zero shrink factor against a
 *    non-zero base, so the flex algorithm takes every missing pixel out of
 *    here; what does not fit is scrolled rather than subtracted from the list.
 * 3. **the count** - `flex: none`, 63px, pinned *below* the filters and above
 *    the list. It costs 63px that band 2 would otherwise have, and it is worth
 *    them: it is the only feedback that a filter did anything, and CLEAR
 *    FILTERS is the way back out of an over-filtered list. Scrolled away above
 *    "No weapons match those filters", it strands the player on an empty list
 *    with no visible way to empty the filters.
 * 4. **the list** - `flex: 1` with a `LIST_FLOOR` min-height, so it grows into
 *    whatever is spare and never falls under one row.
 * 5. **Unequip and Done** - `flex: none`, 63px, and now always inside the clip.
 *
 * ## The geometry, measured in Chrome on both sides of the change
 *
 * Available height is the window less the overlay's 2x10 and the panel's 2x1.
 * Bands 1, 3 and 5 are fixed at 54 + 63 + 63 = 180, so the list takes what is
 * left down to `LIST_FLOOR` and band 2 takes what is left after that. Weapons,
 * fixture `played`, one tap on the equipped primary slot:
 *
 * | viewport | avail | head/filters before → after | list before → after  | Done       |
 * |----------|-------|-----------------------------|----------------------|------------|
 * | 320x568  |  546  | 489 → 226 of 372            | 22/0px → 140, 1 row  | cut 19 → 0 |
 * | 375x667  |  645  | 435 → 435 (318 of 318)      | 147 → 147, 1 row     | uncut both |
 * | 393x852  |  830  | 435 → 435 (318 of 318)      | 332 → 332, 3 rows    | uncut both |
 * | 744x1133 | 1111  | 381 → 381 (264 of 264)      | 667 → 667, 8 rows    | uncut both |
 * | 852x393  |  371  | 381 →  51 of 264            | 22/0px → 140, 1 row  | cut 86 → 0 |
 * | 667x375  |  353  | 381 →  33 of 264            | 22/0px → 140, 1 row  | cut 104 → 0 |
 *
 * Armor over the same six: its filter block is 108 where the weapons' is 264
 * to 372, so at 320x568, 375x667, 393x852 and 744x1133 nothing shrinks and the
 * picker is pixel-identical before and after - list 258, 357, 542, 823, and 2,
 * 4, 5 and 8 whole rows. The two landscape widths trade, and it is a trade
 * rather than a saving: band 2 goes from all 108 on glass to 51 and 33 and
 * scrolls the rest, and the list goes from 83px and 65px - **zero whole rows**
 * against 85px rows - to 140 and one. Comparing armor is the only thing this
 * dialog is for, so a filter that costs a flick beats a comparison that has
 * nothing to compare.
 *
 * So the viewports that were already right are unchanged to the pixel, and the
 * ones that were broken are the only ones that move.
 *
 * **Targets.** Every control keeps the size it had. Unequip and Done measure
 * 44x133 at 320 wide, 44x306.5 at 667 and 44x313 at 744, and both are now
 * wholly inside the clip at all six - which is the change: at 852x393 and
 * 667x375 they were 0px on glass, and `elementFromPoint` at their own centres
 * returned nothing. The ✕ stays 44x44 and uncut at all six, before and after.
 * Rows keep `min-height: var(--tap)` and draw at 64-85.
 *
 * **Thumb arc.** Done's box lands y504-548 of 568, y788-832 of 852 and
 * y329-373 of 393 - its centre 42px above the bottom of the window on every
 * phone here, because the footer sits 10px off the window edge plus the
 * safe-area inset. That is the nearest part of a right thumb's sweep and it is
 * the verb used on every visit. The filters, used once per visit, are the band
 * that travels away from the thumb; the list sits between the two.
 *
 * **What this does not fix, said plainly.**
 *
 * - Below a **342px** window (180 of fixed bands + 140 of floor + 20 of overlay
 *   padding + 2 of border) the fixed bands and the floor exceed the panel and
 *   `overflow: hidden` cuts again. 667x375 is the shortest viewport this
 *   project measures and clears it by 33px - which is exactly the height band 2
 *   has there.
 * - At 667x375 band 2 is 33px and shows the top 25px of a 44px search box. The
 *   whole filter block is one flick away inside its own scrollport, but it is
 *   not on glass, and that is the price of keeping a real list at that height.
 * - At 375x667 the weapon list is 147px and shows **one** row of 167. That is
 *   unchanged, not fixed: the head fits there, so nothing shrinks. Capping band
 *   2 at 40% of the panel would buy a second row (258 filters, 207 list) at the
 *   cost of 8px at 320x568 and a fraction nothing derives - weighed and
 *   declined, and written down so the next reader knows which it was.
 *
 * `.scroll-fade` is deliberately not used on band 2. `base.css` says the class
 * may only wrap a region with nothing `position: fixed` inside it and names
 * `DomainCardView` as its one caller; a second caller would make that sentence
 * false, and it is not this file's to rewrite.
 */
function PickerDialog({
  label,
  count,
  head,
  children,
  onClose,
  onClear,
  clearLabel,
}: {
  label: string;
  /** The line under the filters: how many survived, and what the numbers mean. */
  count: React.ReactNode;
  head: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  /** Empties the slot. Absent where there is nothing to empty. */
  onClear?: () => void;
  clearLabel?: string;
}): React.JSX.Element {
  const dialog = useDialog(label, onClose);

  return (
    <div
      {...dialog}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 660,
          // Not `max-height`, which leaves this box's main size indefinite -
          // see the note above: the flex algorithm then resolves the bands
          // against the list's max-content (15818px of weapons) and Chrome does
          // not re-run against the clamped height, so band 2 came out 22px tall
          // around 264px of content and band 4 took the difference. Measured:
          // `100%` and nothing else takes band 2 from 22 to 264 at 744x1133.
          //
          // What `max-height` was buying - a panel that shrinks to a short
          // list - it was not delivering: a flex item with `flex-basis: 0` and
          // `grow: 1` still contributes its max-content to the container's
          // intrinsic height, so filtering 204 weapons to 5 left the panel at
          // 832 of 830 and Done at y788-832 on both sides of this change,
          // measured. The behaviour could only differ once the whole list fits,
          // and there `100%` is the one to want anyway: Done keeps its y
          // instead of walking up the glass as the count falls.
          height: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        {/* 1. The name and the way out. Never scrolls, never shrinks. */}
        <div
          className="spread"
          style={{ flex: 'none', alignItems: 'center', padding: '10px 12px 0' }}
        >
          <h3 style={{ margin: 0, font: '700 15px/1.2 var(--sans)' }}>{label}</h3>
          <button
            type="button"
            className="t-meta"
            onClick={onClose}
            aria-label="Close the picker"
            style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', flex: 'none' }}
          >
            ✕
          </button>
        </div>

        {/*
          2. The filters, and the only band that gives. `0 1 auto` against the
          `flex: none` above and below it means the flex algorithm takes every
          missing pixel out of here and nowhere else; `min-height: 0` lets it go
          under its own content, and `.scroll` carries the `overflow-y: auto`
          and `overscroll-behavior: contain` that make the rest reachable
          instead of cut.

          The scrollport and the column are two elements on purpose, and it was
          built the wrong way round first. A scroll container that is *itself*
          the flex column does not overflow: the flex algorithm shrinks its own
          children to whatever height the box ends up with, so they collapse to
          their `min-height` instead of scrolling. Measured at 320x568 with the
          band at its squeezed 226px, by collapsing this wrapper in the page:
          `scrollHeight` fell from 372 to 240 and the three chip rows - TIER and
          HANDS, TRAIT, RANGE - went from 44px each to **0**, unreachable by any
          amount of scrolling. Scrolling a block-level child instead keeps the
          column at its natural 364px and the band's flex base size honest.
        */}
        <div className="scroll" style={{ flex: '0 1 auto', minHeight: 0, padding: '8px 12px 0' }}>
          <div className="stack" style={{ gap: 8 }}>
            {head}
          </div>
        </div>

        {/* 3. What the filters did, and the way back out of them. Pinned. */}
        <div
          className="stack"
          style={{
            flex: 'none',
            padding: '8px 12px 10px',
            borderBottom: '1px solid var(--line-soft)',
          }}
        >
          {count}
        </div>

        <div
          className="scroll stack"
          style={{ flex: 1, minHeight: LIST_FLOOR, gap: 8, padding: '10px 12px 12px' }}
        >
          {children}
        </div>

        <div
          className="row"
          style={{
            flex: 'none',
            gap: 8,
            padding: '9px 12px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          {onClear !== undefined && (
            <button type="button" className="btn btn-ghost" onClick={onClear} style={{ flex: 1 }}>
              {clearLabel ?? 'Leave empty'}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}): React.JSX.Element {
  // Focus on a desktop, never on a phone: the keyboard would take half the
  // list before the player has seen it.
  const phone = useIsPhone();
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoFocus={!phone}
      style={{ width: '100%', minHeight: 'var(--tap)' }}
    />
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className="row"
      role="group"
      aria-label={label}
      style={{ gap: 2, padding: 2, borderRadius: 'var(--r3)', background: 'var(--app)', flex: 'none' }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="chip"
          style={{
            minHeight: 'var(--control)',
            padding: '0 10px',
            background: value === v ? 'var(--raised)' : 'transparent',
            color: value === v ? 'var(--text)' : 'var(--muted)',
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * A row of values that filter by OR, and by AND against every other filter.
 *
 * Nothing selected means "any", which is why there is no All chip: an empty
 * selection already says it, and a chip whose only job is to undo other chips
 * is a control you have to learn.
 */
function Chips<T extends string | number>({
  label,
  values,
  text,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly T[];
  text: (v: T) => string;
  selected: ReadonlySet<T>;
  onToggle: (v: T) => void;
}): React.JSX.Element {
  return (
    <>
      <span className="t-meta" style={{ flex: 'none', alignSelf: 'center', color: 'var(--dim)' }}>
        {label}
      </span>
      {values.map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onToggle(v)}
          aria-pressed={selected.has(v)}
          aria-label={`${label} ${text(v)}`}
          className="chip"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: selected.has(v) ? 'var(--hope)' : 'var(--raised)',
            color: selected.has(v) ? 'var(--app)' : 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {text(v)}
        </button>
      ))}
    </>
  );
}

const ChipRow = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <div className="row" style={{ gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
    {children}
  </div>
);

function CountRow({
  showing,
  total,
  note,
  filtered,
  onClear,
}: {
  showing: number;
  total: number;
  note?: string;
  filtered: boolean;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="spread" style={{ alignItems: 'center', minHeight: 'var(--control)' }}>
      <span className="t-meta" style={{ color: 'var(--muted)' }}>
        {showing} OF {total}
        {note !== undefined && <span style={{ color: 'var(--dim)' }}> · {note}</span>}
      </span>
      {filtered && (
        <button
          type="button"
          className="chip"
          onClick={onClear}
          style={{ minHeight: 'var(--control)', color: 'var(--text)', flex: 'none' }}
        >
          CLEAR FILTERS
        </button>
      )}
    </div>
  );
}

/** One line of a picker. Out of reach is dimmed and says so, never hidden. */
function PickerRow({
  title,
  badge,
  badgeTone,
  meta,
  body,
  reason,
  selected,
  onClick,
}: {
  title: string;
  badge: string;
  badgeTone?: string;
  meta: string;
  body?: string;
  reason?: string | null;
  selected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const why = reason ?? null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="stack"
      style={{
        flex: 'none',
        gap: 6,
        minHeight: 'var(--tap)',
        padding: '10px 11px',
        textAlign: 'left',
        borderRadius: 'var(--r3)',
        background: selected ? 'var(--raised)' : 'var(--app)',
        border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
        borderLeft: `3px solid ${selected ? 'var(--hope)' : 'transparent'}`,
      }}
    >
      <span className="stack" style={{ gap: 6, width: '100%', opacity: why === null ? 1 : 0.5 }}>
        <span className="spread" style={{ alignItems: 'baseline', gap: 10 }}>
          <span style={{ font: '700 14.5px/1.2 var(--sans)', minWidth: 0 }}>{title}</span>
          <span className="t-meta" style={{ flex: 'none', color: badgeTone ?? 'var(--dim)' }}>
            {badge}
          </span>
        </span>
        <span className="t-num" style={{ color: 'var(--text-2)', lineHeight: 1.4 }}>
          {meta}
        </span>
        {body !== undefined && body !== '' && (
          <span className="t-dense" style={{ whiteSpace: 'pre-line' }}>
            {body}
          </span>
        )}
      </span>
      {why !== null && (
        <span className="t-meta" style={{ color: 'var(--stress)' }}>
          {why.toUpperCase()}
        </span>
      )}
    </button>
  );
}

function Empty({ what }: { what: string }): React.JSX.Element {
  return (
    <span className="t-dense" style={{ color: 'var(--dim)' }}>
      {what}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

export function WeaponPicker({
  slot,
  value,
  sheet,
  stats,
  onPick,
  onClose,
}: {
  slot: Weapon['slot'];
  value: Ref | null;
  sheet: Character;
  stats: DerivedStats;
  onPick: (ref: Ref | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  const weapons = useApp((s) => s.dataset.weapons);
  const base = useMemo(() => weaponQuery(slot), [slot]);
  const [q, setQ] = useState<WeaponQuery>(base);
  const search = useDeferredValue(q.search);

  const patch = (p: Partial<WeaponQuery>): void => setQ((prev) => ({ ...prev, ...p }));
  const rows = useMemo(
    () => filterWeapons(weapons, { ...q, search }, sheet.level),
    [weapons, q, search, sheet.level],
  );

  const label = slot === 'primary' ? 'Primary weapon' : 'Secondary weapon';

  return (
    <PickerDialog
      label={label}
      onClose={onClose}
      onClear={value === null ? undefined : () => onPick(null)}
      clearLabel="Unequip"
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => patch({ search: v })}
            placeholder={`Search ${weapons.length} weapons and their features`}
            label="Search weapons"
          />
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <Seg
              label="Reach"
              value={q.reach}
              onChange={(reach) => patch({ reach })}
              options={[
                ['all', 'All'],
                ['usable', 'Can use'],
              ]}
            />
            <Seg
              label="Slot"
              value={q.slot}
              onChange={(v) => patch({ slot: v })}
              options={[
                ['all', 'Any'],
                ['primary', 'Primary'],
                ['secondary', 'Secondary'],
              ]}
            />
            <Seg
              label="Category"
              value={q.category}
              onChange={(category) => patch({ category })}
              options={[
                ['all', 'Any'],
                ['Physical', 'Physical'],
                ['Magic', 'Magic'],
              ]}
            />
          </div>
          <ChipRow>
            <Chips
              label="TIER"
              values={TIERS}
              text={String}
              selected={q.tiers}
              onToggle={(t) => patch({ tiers: toggled(q.tiers, t) })}
            />
            <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
            <Chips
              label="HANDS"
              values={BURDENS}
              text={(b) => (b === 2 ? '2H' : '1H')}
              selected={q.burdens}
              onToggle={(b) => patch({ burdens: toggled(q.burdens, b) })}
            />
          </ChipRow>
          <ChipRow>
            <Chips
              label="TRAIT"
              values={WEAPON_TRAITS}
              text={weaponTraitLabel}
              selected={q.traits}
              onToggle={(t) => patch({ traits: toggled(q.traits, t) })}
            />
          </ChipRow>
          <ChipRow>
            <Chips
              label="RANGE"
              values={RANGES}
              text={(r: Range) => r.toUpperCase()}
              selected={q.ranges}
              onToggle={(r) => patch({ ranges: toggled(q.ranges, r) })}
            />
          </ChipRow>
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={weapons.length}
          note={`DAMAGE AT PROFICIENCY ${stats.proficiency}`}
          filtered={weaponQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map(({ item, reason }) => (
        <PickerRow
          key={item.id}
          title={item.name}
          badge={value === item.id ? 'EQUIPPED' : `TIER ${item.tier}`}
          badgeTone={value === item.id ? 'var(--hope)' : undefined}
          meta={weaponSummary(item, stats)}
          body={item.feature}
          reason={reason}
          selected={value === item.id}
          onClick={() => onPick(item.id)}
        />
      ))}
      {rows.length === 0 && (
        <Empty
          what={
            weapons.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No weapons match those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// Armor
// ---------------------------------------------------------------------------

export function ArmorPicker({
  value,
  sheet,
  onPick,
  onClose,
}: {
  value: Ref | null;
  sheet: Character;
  onPick: (ref: Ref | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const armors = dataset.armors;
  const base = useMemo(() => armorQuery(), []);
  const [q, setQ] = useState<ArmorQuery>(base);
  const search = useDeferredValue(q.search);

  const patch = (p: Partial<ArmorQuery>): void => setQ((prev) => ({ ...prev, ...p }));
  const rows = useMemo(
    () => filterArmors(armors, { ...q, search }, sheet.level),
    [armors, q, search, sheet.level],
  );

  // What each set of armor would actually give *this* character, asked of the
  // engine rather than added up here: thresholds are the armor's base plus the
  // character's level, and that sum belongs in one place. A manual override is
  // set aside for the preview - otherwise every row would print the same
  // overridden pair and the comparison the player came for would be gone.
  const preview = useMemo(() => {
    const clean: Character = { ...sheet, thresholdOverride: null };
    const out = new Map<Ref, DerivedStats>();
    for (const a of armors) {
      out.set(a.id, deriveStats({ ...clean, activeArmor: a.id }, dataset, index));
    }
    return out;
  }, [armors, dataset, index, sheet]);

  return (
    <PickerDialog
      label="Armor"
      onClose={onClose}
      onClear={value === null ? undefined : () => onPick(null)}
      clearLabel="Unarmored"
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => patch({ search: v })}
            placeholder={`Search ${armors.length} sets of armor and their features`}
            label="Search armor"
          />
          <ChipRow>
            <Seg
              label="Reach"
              value={q.reach}
              onChange={(reach) => patch({ reach })}
              options={[
                ['all', 'All'],
                ['usable', 'Can use'],
              ]}
            />
            <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
            <Chips
              label="TIER"
              values={TIERS}
              text={String}
              selected={q.tiers}
              onToggle={(t) => patch({ tiers: toggled(q.tiers, t) })}
            />
          </ChipRow>
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={armors.length}
          note={`THRESHOLDS AT LEVEL ${sheet.level}`}
          filtered={armorQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map(({ item, reason }) => {
        const shown = preview.get(item.id);
        return (
          <PickerRow
            key={item.id}
            title={item.name}
            badge={value === item.id ? 'WORN' : `TIER ${item.tier}`}
            badgeTone={value === item.id ? 'var(--hope)' : undefined}
            meta={
              shown
                ? armorSummary(item, shown.thresholds, shown.armorScore)
                : `${item.baseThresholds[0]}/${item.baseThresholds[1]} BASE · SCORE ${item.baseScore}`
            }
            body={item.feature}
            reason={reason}
            selected={value === item.id}
            onClick={() => onPick(item.id)}
          />
        );
      })}
      {rows.length === 0 && (
        <Empty
          what={
            armors.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No armor matches those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// Loot and consumables
// ---------------------------------------------------------------------------

export function ItemPicker({
  carried,
  onAdd,
  onClose,
}: {
  /** Ref to quantity already in the inventory, so a row can say so. */
  carried: ReadonlyMap<Ref, number>;
  onAdd: (item: Item) => void;
  onClose: () => void;
}): React.JSX.Element {
  const loot = useApp((s) => s.dataset.loot);
  const consumables = useApp((s) => s.dataset.consumables);
  const items = useMemo(() => [...loot, ...consumables], [loot, consumables]);
  const base = useMemo(() => itemQuery(), []);
  const [q, setQ] = useState<ItemQuery>(base);
  const search = useDeferredValue(q.search);

  const rows = useMemo(() => filterItems(items, { ...q, search }), [items, q, search]);

  return (
    <PickerDialog
      label="Loot and consumables"
      onClose={onClose}
      head={
        <>
          <SearchBox
            value={q.search}
            onChange={(v) => setQ((prev) => ({ ...prev, search: v }))}
            placeholder={`Search ${items.length} items and what they do`}
            label="Search items"
          />
          <Seg
            label="Kind"
            value={q.kind}
            onChange={(kind) => setQ((prev) => ({ ...prev, kind }))}
            options={[
              ['all', 'All'],
              ['loot', 'Loot'],
              ['consumable', 'Consumables'],
            ]}
          />
        </>
      }
      count={
        <CountRow
          showing={rows.length}
          total={items.length}
          filtered={itemQueryChanged(q, base)}
          onClear={() => setQ(base)}
        />
      }
    >
      {rows.map((item) => {
        const have = carried.get(item.id) ?? 0;
        return (
          <PickerRow
            key={item.id}
            title={item.name}
            badge={have > 0 ? `CARRIED ×${have}` : 'ADD'}
            badgeTone={have > 0 ? 'var(--hope)' : undefined}
            meta={`${item.kind === 'loot' ? 'LOOT' : 'CONSUMABLE'}${item.roll === undefined ? '' : ` · ROLL ${item.roll}`}`}
            body={item.text}
            selected={have > 0}
            onClick={() => onAdd(item)}
          />
        );
      })}
      {rows.length === 0 && (
        <Empty
          what={
            items.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No items match those filters.'
          }
        />
      )}
    </PickerDialog>
  );
}

// ---------------------------------------------------------------------------
// The slot the picker fills
// ---------------------------------------------------------------------------

/**
 * A filled equipment slot on the form behind the dialog.
 *
 * It carries the numbers rather than only a name, because "Broadsword" alone
 * sends the player back into the picker to remember what it does.
 */
export function GearSlot({
  label,
  title,
  meta,
  note,
  empty,
  disabled = false,
  onOpen,
  onClear,
}: {
  label: string;
  /** The chosen thing, or null for an empty slot. */
  title: string | null;
  meta?: string;
  /** Out of tier, or blocked by something else on the sheet. */
  note?: string | null;
  empty: string;
  disabled?: boolean;
  onOpen: () => void;
  onClear?: () => void;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="t-label">{label}</span>
      <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          className="row"
          style={{
            flex: 1,
            minWidth: 0,
            gap: 10,
            minHeight: 'var(--tap)',
            padding: '8px 12px',
            textAlign: 'left',
            borderRadius: 'var(--r3)',
            background: title === null ? 'var(--panel)' : 'var(--raised)',
            border: `1px solid ${title === null ? 'var(--line-soft)' : 'var(--line)'}`,
            borderLeft: `3px solid ${title === null ? 'transparent' : 'var(--hope)'}`,
            opacity: disabled ? 0.42 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <span
              style={{
                font: '700 14px/1.2 var(--sans)',
                color: title === null ? 'var(--muted)' : 'var(--text)',
              }}
            >
              {title ?? empty}
            </span>
            {title !== null && meta !== undefined && (
              <span className="t-num" style={{ color: 'var(--text-2)' }}>
                {meta}
              </span>
            )}
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            {title === null ? 'CHOOSE' : 'CHANGE'}
          </span>
        </button>
        {onClear !== undefined && title !== null && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            style={{ flex: 'none', minWidth: 'var(--tap)', padding: 0 }}
          >
            ✕
          </button>
        )}
      </div>
      {(note ?? '') !== '' && (
        <span className="t-meta" style={{ color: 'var(--stress)' }}>
          {(note ?? '').toUpperCase()}
        </span>
      )}
    </div>
  );
}
