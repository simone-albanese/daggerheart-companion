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
 *
 * TWO OF THE THREE PICKERS CAN ROLL. Weapons and armor carry a tier - all 204
 * and all 34 of them - so both take an `Rng` and put a RANDOM button in the
 * count row, which draws from the rows the filters left standing. Loot and
 * consumables carry no tier at all, so `ItemPicker` takes no dice and offers
 * no such button: a "randomise by tier" control over 120 items with no tier
 * would be a filter the dataset cannot honour, which on this screen is the
 * same defect as implying an absence that is not real. The counts and the
 * distribution are in `src/engine/randomGear.ts`; the placement, its cost and
 * its ergonomics are on `RandomButton` below.
 *
 * WHERE A THING CAME FROM IS ON THE ROW, AND ON ONE MORE CONTROL. A book may
 * fence its content two ways at once - which product carries it, and which
 * optional subsystem it belongs to - and SRD 2.0 does both. Every row prints
 * whichever of the two it has, in the book's own words, on a line of its own
 * (`PickerRow`'s `stamp`); the module axis also gets a two-state `Seg`
 * (`ModuleFilter`), and the product axis deliberately does not, because
 * `DECISIONI-SRD-2` §4 gives that one to Settings. Neither draws anything on
 * `data/srd-1.0.json`, which fences nothing: the 204 weapons, 34 armors and
 * 120 items above carry no `set` and no `module`, so this file is unchanged to
 * the pixel on the book it ships.
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
  type Weapon,
  type WeaponTrait,
  damageKindShort,
} from '../../../shared/types.ts';
import { deriveStats, weaponDamage, type DerivedStats } from '../../engine/character.ts';
import type { Rng } from '../../engine/dice.ts';
import { randomGear, tiersIn } from '../../engine/randomGear.ts';
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
  moduleSplit,
  originStamp,
  tierPhrase,
  weaponQuery,
  weaponQueryChanged,
  type ArmorQuery,
  type ItemQuery,
  type ModuleChoice,
  type WeaponQuery,
} from './gear.ts';

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
    `${damage} ${damageKindShort(w.damageType)}`,
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
 *    with no visible way to empty the filters. The weapon and armor pickers
 *    put RANDOM here too, for the same reason and at no cost to the 63px - the
 *    arithmetic for that is on `RandomButton`, which also says which quantity
 *    would have to move before this number stops being true.
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
 * (The armor filter block is **158, not 108, below viewport 392**, since its
 * rail was given `wrap` - see the note on `ChipRow`, which derives that
 * threshold and re-measures it. Re-measured over the same six: list 208, 307,
 * 542, 823 and 140/140, whole rows 2, 3, 5, 8 and 1/1. The only entry of these
 * six that moves is 375x667, four whole rows to three; 320x568 held two either
 * way, and both landscape widths are untouched because the rail fits on one line
 * inside a 634px content box there. `ChipRow` states the cost over a wider set
 * that includes 360x800, where a second row is lost - "of these six" is doing
 * real work in that sentence and is not a hedge.)
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

/**
 * A segmented control, and the axis it never declared a floor on.
 *
 * `minHeight: var(--control)` was here from the start and `min-width` was not,
 * so the width came from `.chip`'s label alone. IBM Plex Mono is a 600/1000
 * advance at every weight this app ships (checked in the shipped
 * `plexmono-600-latin.woff2`: `unitsPerEm` 1000, every glyph 600), so at
 * `.chip`'s 9.5px with `letter-spacing: 0.06em` a character is
 * 9.5 x 0.6 + 9.5 x 0.06 = **6.27px**. With the `padding: '0 10px'` this button
 * used to carry and no border (`base.css:42-50` zeroes it), `All` and `Any` are
 * three characters: 3 x 6.27 + 20 = **38.81px**, against a floor of 44.
 *
 * `--tap` is not what was missing. `--control` already resolves to
 * `var(--tap)` = 44 at every width below 1180 and under any coarse pointer
 * (`tokens.css`), which is every viewport this dialog is measured at; the
 * height was 44 all along. `Chips` directly below has carried both
 * declarations from the beginning and measures 44x44, which is what makes this
 * an omission rather than a decision. It clears WCAG 2.5.8's 24px easily; the
 * floor it breaks is the one this project wrote for itself.
 *
 * THE FLOOR IS PAID FOR OUT OF THE PADDING, AND THAT IS THE WHOLE POINT.
 * `min-width: 44` alone widens every group by 5.19px, because only the
 * three-character labels move and every group has exactly one of them: Reach
 * 108.70 -> 113.89, Slot 187.14 -> 192.33, Category 168.34 -> 173.53, measured
 * in Chrome with the shipped fonts. Those 15.57px land on the two neighbours
 * that had no room for them, and both costs were real:
 *
 *   - the weapons `Seg` row (`flexWrap: 'wrap'`, gap 6) puts Reach + Slot on
 *     line 1, so line 1 went 301.84 -> 312.22 and the row flipped from two
 *     lines to three across an **11px interval, windows 348 to 358** - band 2's
 *     content box is the window less 20 of overlay padding, 2 of panel border
 *     and 24 of band padding, so 302 at 348 and 312 at 358. Measured on both
 *     sides: at 356 the head goes 318 -> 372 and the weapon list 332 -> 278.
 *     The four spot checks that were here (320, 375, 393, 660) step straight
 *     over it, and 356 is a width `Play.tsx`'s own sweep names. At 360 - the
 *     commonest Android there has ever been - it left 1.78px of margin where
 *     there had been 12.16, which is thinner than this arithmetic can promise.
 *   - the armor `ChipRow` is the one rail that holds a `Seg`; see the note on
 *     `ChipRow` above for what 5.19px more did to the TIER `4` chip there.
 *
 * So the width comes out of `padding: '0 6px'`, which is `.chip`'s own
 * horizontal padding in `base.css:359` rather than this file's 10px override of
 * it. `All` and `Any` are 30.81 natural and the `min-width` still lifts them to
 * a true 44x44; `Loot` joins them at 37.08 natural; only the long labels lose
 * width, and they had 8px to lose. Measured: Reach **105.89**, Slot **176.33**,
 * Category **158.17**, line 1 of the wrap row **288.22** - 13.62px *narrower*
 * than before this lane touched the file. The weapons row therefore flips to
 * three lines at 334 and holds two from **335** up, against 348 before and 359
 * with the floor unpaid-for; nothing in the supported range gains a line, and
 * 360 has 25.78px of margin instead of 12.16. Every head height in
 * `PickerDialog`'s table is byte-identical before and after, re-measured at all
 * six: 226/318/318/318/51/33 of content 372/318/318/318/264/264.
 *
 * A FOURTH GROUP JOINS THIS ROW ON A BOOK WITH OPTIONAL MODULES, and the
 * arithmetic above survives it. `ModuleFilter`'s `All`/`Base` is 94.00px, both
 * labels under the natural width and both lifted to a true 44 by the same
 * `min-width`; measured against the SRD 2.0 dataset at 320x568, 360x800,
 * 375x667, 393x852, 744x1133, 852x393 and 667x375, it lands on the SAME
 * wrapped line as Category at all seven and this row's height does not move -
 * 156 / 102 / 102 / 102 / 48 / 48 / 48 with it and without it. Line 1 is
 * untouched, so the 334/335 flip below is untouched too.
 *
 * ERGONOMICS. **Thumb arc:** band 2 begins at y74 on a 393x852 phone (10 of
 * overlay padding, 1 of border, 54 of the name-and-✕ band, 9 of band padding)
 * and the `Seg` row sits about 50px below that, so these controls live in the
 * top fifth of the glass - the far end of a one-handed sweep, and correctly so.
 * They are set at most once per visit; the list under them and Done at y788-832
 * are what the thumb comes back to, and neither moves. **Target size:** 38.81
 * -> 44 on both axes clears this repo's coarse-pointer floor exactly, and no
 * neighbour pays: the wrap row is 13.62px narrower than it was, and the armor
 * rail 2.80px narrower, so the two controls nearest this one both end up with
 * *more* glass than before, not less. What the label loses is clear space: 10px
 * either side becomes 6, and between two adjacent labels 22px becomes 14 once
 * the group's own 2px gap is counted. The target is the button box and not the
 * ink, so it is still 44 whatever the label does, and the two labels that were
 * under the floor are the two that do not move at all. **Read versus touch:**
 * the search box is read first and is above; these three groups are read left
 * to right in the order a player asks the question - can I use it, which hand,
 * which kind - and the count that answers them is `CountRow`, pinned below the
 * filters and above the list where it cannot scroll away from either.
 */
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
            // The floor is a floor on both axes. See the note above this
            // component for the 38.81px and what closing it costs.
            minWidth: 'var(--control)',
            padding: '0 6px',
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
}): React.JSX.Element | null {
  /*
   * A LABEL WITH NOTHING AFTER IT IS WORSE THAN NO ROW.
   *
   * Every other chip row on this screen draws from a module constant and is
   * never empty. TIER is derived - `tiersIn(weapons)` - and returns `[]` on a
   * device where the dataset has not been built, a state this same file writes
   * explicit copy for three times over. Before this guard that state drew a
   * bare "TIER" with no chips beside HANDS, TRAIT and RANGE rows that had
   * populated, which reads as a filter that lost its options rather than as a
   * catalogue that has not arrived.
   */
  if (values.length === 0) return null;
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

/**
 * A rail of chips, and the one caller that may not be a rail.
 *
 * The default is a horizontal scroller with the scrollbar hidden, which is a
 * deliberate trade for the weapons picker's three long rows: TRAIT is 510px of
 * content against 347 at 393, and no wrap makes that fit in fewer than two
 * lines, so it is swiped. That is this file's oldest open cost and it is not
 * addressed here.
 *
 * `wrap` exists for the armor picker, whose rail is the *only* one that holds a
 * `Seg` - the control this lane raised to the 44px floor. Measured in Chrome
 * with the shipped fonts: that rail's content is 345.30px against a content box
 * of `viewport - 46` - the overlay's 2x10, the panel's 2x1 border and band 2's
 * 2x12 padding - so it fits on one line while `viewport >= 391.3`, which in
 * whole CSS pixels is **392 and above**. Measured: the rail is 48px tall at 392
 * and 98px at 391. Below that the last TIER chip would otherwise be cut by the
 * scrollport - 27.70px of a 44px target on glass at 375, 12.70 at 360, 0.00 at
 * 320, each of them `44 - (345.30 - (viewport - 46))` - and a hidden scrollbar
 * is not a cue that anything is there to reach. Wrapping puts every chip on the
 * glass at every supported width.
 *
 * (This used to say 393. The threshold is one pixel lower than the nearest
 * viewport in the sweep, which is exactly the kind of number a sweep cannot see:
 * 392 and 393 both fit, and the sweep only had 393.)
 *
 * What it costs, measured over `PickerDialog`'s own six plus 360x800: band 2
 * goes 108 -> 158 at 320x568, 360x800 and 375x667, and is unchanged at 393x852,
 * 744x1133 and both landscape widths. That comes off the list, and over this set
 * it costs a row in **two** places, not one:
 *
 *   - 375x667, list 357 -> 307, four whole rows to three;
 *   - 360x800, list 490 -> 440, five whole rows to four.
 *
 * 320x568 goes 258 -> 208 and holds two rows either way; 393x852 (542, five) and
 * 744x1133 (823, eight) do not move at all; 852x393 and 667x375 are already at
 * `LIST_FLOOR` and do not move either. Rows draw 63.6-85.4 with an 8px gap, so a
 * 50px band is worth about one of them and which viewports round the wrong way
 * is not derivable - it is measured, per viewport, and both of the two are.
 *
 * (This used to say "in exactly one place - 375x667". True over `PickerDialog`'s
 * six, which is the set that docblock states and where it is still correct;
 * false over this one, which adds the 360 width and is the set stated in the
 * sentence above. Two rows of armor at two viewports is the price of a TIER
 * filter chip that is 0.00px wide on glass at 320, and the band that pays it
 * scrolls with a scrollbar you can see.)
 *
 * ON A BOOK WITH OPTIONAL MODULES THIS RAIL IS 445.30, NOT 345.30, and every
 * number in the paragraphs above is about `data/srd-1.0.json`, where it is
 * still exactly right. `ModuleFilter` adds a second `Seg` to this one rail
 * when the collection has module content, which SRD 1.0's does not and SRD
 * 2.0's does. Re-measured there: the rail is one line only at 744x1133,
 * 852x393 and 667x375; at 393x852 it wraps where it used to fit, band 2 goes
 * 108 -> 158 and the list 542 -> 492, five whole rows to four. At 320x568,
 * 360x800 and 375x667 it was already two lines and does not grow at all,
 * because the added group shares the line Reach is on and the chips keep
 * theirs. The 391.3px
 * threshold derived above is the threshold for the SRD 1.0 rail; the SRD 2.0
 * rail has its own, and it is not restated here because nothing in this file
 * depends on it.
 *
 * ERGONOMICS, at 375x667 - the shortest viewport this project measures, and the
 * one that pays. **Thumb arc:** taking the same right-thumb pivot the rest of
 * this pass uses, viewport - 20 by height - 40, so (355, 627). The TIER `4`
 * chip's box was x324.30-368.30, y125-169, clipped by the scrollport at x352,
 * so the part of it on glass was centred (338.15, 147): a reach of **480.3px**,
 * and only after a leftward drag of the rail with the same thumb, on a rail
 * that draws no scrollbar to say it moves. Wrapped it is x23-67, y179-223,
 * centre (45, 201), a reach of **526.9px** - 46.6px further out, and one
 * gesture instead of two. That is the trade, and it is worth taking: the drag
 * was undiscoverable, the tap is not. **Target size:** the chip is 44x44
 * declared and 44.00 painted at all six viewports; it was 37.70 at 393, 19.70
 * at 375 and 0.00 at 320 before this lane's floor commit and 27.70 / 12.70 /
 * 0.00 after that commit's width was handed back. Nothing else in the dialog
 * changes size, and Done keeps its y because band 5 is `flex: none` against the
 * bottom. **Read versus touch:** the rail reads left to right - can I use it,
 * then which tier - and a wrapped flex line continues where the one above it
 * stopped, so the order is the order. The list, which is the thing being
 * compared and the thing the thumb returns to, stays between the count and
 * Done, 50px shorter - the height of the second flex line, which is what band 2
 * gained and band 4 gave up. (54 here was a third wrong number in this
 * docblock; the rail goes 48 -> 98 and the list 357 -> 307, both measured.)
 */
const ChipRow = ({
  children,
  wrap = false,
}: {
  children: React.ReactNode;
  wrap?: boolean;
}): React.JSX.Element => (
  <div
    className="row"
    style={
      wrap
        ? { gap: 6, flexWrap: 'wrap' }
        : { gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }
    }
  >
    {children}
  </div>
);

/**
 * The optional-module filter: two states, and the control it is not.
 *
 * SRD 2.0 prints three optional-equipment chapters, and their contents reach
 * the pickers in the same collections as everything else: 76 of the 391
 * weapons and 16 of the 85 sets of armor. At tier 1 - where a new character
 * shops - that is 31 of 71 primary weapons, 12 of 25 secondaries and 7 of 15
 * sets of armor, so a table running none of the three was reading a list that
 * is nearly half somebody else's subsystem, with nothing on any row saying so.
 *
 * ## What this draws, and what it costs, measured
 *
 * A `Seg` of `All` / `Base`, 94.00 CSS pixels wide, added to a filter row that
 * already wraps. Rendered against the SRD 2.0 dataset in Chrome at seven
 * viewports and measured on both sides, the weapons picker's filter column is
 * **byte-identical with it and without it** - 364 / 310 / 310 / 310 / 256 /
 * 256 / 256 at 320x568, 360x800, 375x667, 393x852, 744x1133, 852x393 and
 * 667x375 - because at every one of the seven the group lands on the same flex
 * line as Category, which had room for it. The list keeps its rows: 1, 2, 1,
 * 2, 7, 1, 1 with the control and without it.
 *
 * The armor picker pays, once. Its filters are a single `ChipRow wrap` - the
 * rail `ChipRow`'s own note derives the 391.3px threshold for - so 94px takes
 * it from 345.30 to 445.30 against a 347px content box, and it wraps a second
 * line at 393x852 where it used to fit on one: band 2 goes 108 -> 158, the
 * list 542 -> 492, and whole rows five -> four. At 320x568, 360x800 and
 * 375x667 that rail is already two lines and the cost is ZERO - the control
 * shares Reach's line and the chips keep theirs - and at 744x1133, 852x393 and
 * 667x375 it is zero as well. **One row of armor at one viewport is the whole
 * price of this lane's controls.** (Both numbers hold only with the group
 * placed beside Reach; put after the TIER chips it is 4px worse at four
 * viewports, for the reason written at that call site.)
 *
 * ## The control this is NOT, and the numbers that ruled it out
 *
 * A chip row - `MODULE  BASE RULES · EVERYDAY HERO STARTING EQUIPMENT ·
 * WESTERN CAMPAIGNS · MONSTER HUNTING CAMPAIGNS`, this file's usual "empty
 * means any" - is strictly more expressive, and it was built and measured
 * rather than argued away. Its four chips are 74.70, 212.64, 118.59 and
 * 168.75px and they wrap to four lines at 320, three at 360 and 375, two at
 * 393 and 744. That is +202 / +152 / +152 / +102 / +102 on the filter column,
 * and it comes out of the list: whole rows fall to 1, 1, 1, 1, 6, 1, 1 on
 * weapons and 1, 2, 1, 4, 8, 1, 1 on armor - a row lost at three of seven
 * viewports on one picker and four of seven on the other, with 360x800 and
 * 393x852 dropping to a single weapon on glass. A screen whose only job is
 * comparing gear may not show one row of it.
 *
 * (Not a horizontally scrolled rail either, which would be 44px flat. Its
 * content is 638.28px against a 274px box at 320, so `MONSTER HUNTING
 * CAMPAIGNS` would be 0.00px on glass behind a hidden scrollbar - the exact
 * defect `ChipRow`'s note says it gave the armor TIER chips `wrap` to end.)
 *
 * What two states cannot say is *base plus exactly one module*. That is handed
 * to the search box, which has no pixels to pay: `gear.ts` folds the module
 * titles into the labels it reads, so "western" answers with those 20 weapons
 * and "monster hunting" with those 24. See `ModuleChoice` in `gear.ts` for the
 * full table, kept there so that reversing this is a re-measurement rather
 * than an opinion.
 *
 * ## Ergonomics
 *
 * **Thumb arc.** It joins the `Seg` row rather than opening a row of its own,
 * which puts it in the top fifth of the glass with Reach, Slot and Category -
 * the far end of a one-handed sweep, and correctly so: like them it is set at
 * most once per visit, and unlike them it is really a property of the table
 * rather than of this pick. The list beneath it and Done at the bottom are
 * what the thumb returns to, and neither moves. **Target size.** 44x44 per
 * button on both axes, from the floor `Seg` states inline; `All` and `Base`
 * are three and four characters, so both are under the natural width and both
 * are lifted to a true 44 by the `min-width`, exactly as `All` and `Any` are
 * in the two groups beside it. **Read versus touch.** The control is the touch
 * half and answers one question - are we playing with the optional chapters.
 * The read half is the row's own provenance stamp, which names the chapter in
 * the book's words, so the player can tell *which* module a thing came from
 * without the control having to spell four chapter titles across the glass.
 *
 * ## It draws nothing on the book this app ships
 *
 * `moduleSplit` is false for every collection in `data/srd-1.0.json`, so this
 * returns `null` there and the pickers are unchanged to the pixel. The guard
 * is on the data and not on a revision string: a control whose second state
 * would empty the list, or would change nothing, is not drawn.
 */
function ModuleFilter({
  rows,
  value,
  onChange,
}: {
  /** The whole collection, not the filtered rows: the control must not vanish
   *  because the current filters happen to have removed all the module gear. */
  rows: ReadonlyArray<{ module?: string }>;
  value: ModuleChoice;
  onChange: (v: ModuleChoice) => void;
}): React.JSX.Element | null {
  if (!moduleSplit(rows)) return null;
  return (
    <Seg
      label="Rules"
      value={value}
      onChange={onChange}
      options={[
        ['all', 'All'],
        ['base', 'Base'],
      ]}
    />
  );
}

/**
 * Let the dice choose, out of exactly the rows on screen.
 *
 * ## Why it is here and not in the filter head
 *
 * Band 2 is the band that gives: at 320x568 it draws 226px of a 372px column,
 * and at 852x393 and 667x375 it draws 51 and 33 of 264 - so a control put at
 * the bottom of the filters would be off the glass on a landscape phone and
 * reachable only by scrolling a band with no scrollbar. That is the same
 * argument `PickerDialog` already makes for pinning the count and CLEAR
 * FILTERS in band 3, and it applies here for the same reason: a verb you have
 * to go looking for is a verb that does not exist.
 *
 * Band 3 also happens to be where this control's *subject* is written down.
 * The randomiser draws from the rows the filters left standing, and the row it
 * sits in says how many those are - `12 OF 204`, an arm's length to its left.
 * "RANDOM" beside "12 OF 204" reads as "one of these twelve", which is exactly
 * what it does, and it needs no second copy of the tier that the lit TIER
 * chips are already showing. The screen reader, which gets no adjacency, gets
 * the whole sentence in `aria-label` - see `tierPhrase` in `gear.ts`.
 *
 * ## What it costs the band, which is nothing
 *
 * Band 3's height is `minHeight: var(--control)` on the spread inside it, plus
 * 8 + 10 of padding and 1 of border: 63px, the number `PickerDialog`'s table
 * states. The count text is `.t-meta`, `font: 500 10px/1 var(--mono)` with
 * `letter-spacing: 0.06em`, and IBM Plex Mono is a 600/1000 advance at every
 * weight this app ships - the claim `Seg` above makes and checks against the
 * shipped `plexmono-600-latin.woff2`; `.t-meta` draws from the 500 file beside
 * it, and the family is monospaced across weights by construction. So a
 * character is 10 x 0.6 + 10 x 0.06 = **6.6px** and a wrapped line is 10px
 * tall. The band therefore only grows once the count needs a **fifth** line,
 * and it does not come close: at 320 the band's content box is 320 - 20 of
 * overlay padding - 2 of border - 24 of band padding = **274px**; the two
 * buttons take 93.51 + 6 + 49.62 = 149.13 with a filter set, plus the spread's
 * own `--s3` gap of 8; and the longest count this dialog draws -
 * `204 OF 204 · DAMAGE AT PROFICIENCY 3`, 36 characters, 237.6px - wraps into
 * the remaining 116.87px in three lines of 10px. 30px against a 44px floor.
 * (`RANDOM` is 6 characters of `.chip`'s 9.5px/0.06em, which this file derives
 * at 6.27px each, plus its own 6px of padding either side: **49.62px**, so the
 * 44px `min-width` does not bind and the 44px `min-height` does. `.chip` also
 * carries `white-space: nowrap`, so neither button wraps into a second line
 * and takes the band with it.)
 *
 * This is arithmetic from numbers already in this file, not a fresh Chrome
 * measurement, and it is written as arithmetic on purpose: it says which
 * quantity has to move before the 63px in `PickerDialog`'s table stops being
 * true, which a re-measured 63 would not.
 *
 * ## Ergonomics
 *
 * **Thumb arc.** Band 3 sits directly above the list, so on a 393x852 phone it
 * is around the vertical middle of the glass - further from a right thumb's
 * pivot than Done at y788-832, nearer than the chips at the top of band 2, and
 * pinned so it is in the same place on every viewport rather than wherever a
 * scroll left it. **Target size.** 44x49.62 at every coarse pointer and every
 * width under 1180 (`--control` resolves to `--tap`), declared inline on both
 * axes because jsdom reads only inline styles and a height off a class
 * measures 0 in a test. **Read versus touch.** RANDOM is pinned to the right
 * edge and CLEAR FILTERS appears to its *left* when a filter is set, so the
 * randomiser never moves under a thumb that is already reaching for it; the
 * conditional button is the one that shifts, and it shifts a control the
 * player only wants after they have looked at the row.
 *
 * ## Disabled rather than absent
 *
 * With no rows there is nothing to draw and the button says so by going dim,
 * rather than vanishing. A control that disappears when the list empties takes
 * itself away at the exact moment the player is looking at "No weapons match
 * those filters" and deciding what to do next, and moves CLEAR FILTERS
 * sideways while they aim at it.
 */
function RandomButton({
  label,
  disabled,
  onClick,
}: {
  /** The whole sentence, for a screen reader. The glass gets one word. */
  label: string;
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        minHeight: 'var(--control)',
        minWidth: 'var(--control)',
        color: 'var(--text)',
        opacity: disabled ? 0.4 : 1,
        flex: 'none',
      }}
    >
      RANDOM
    </button>
  );
}

function CountRow({
  showing,
  total,
  note,
  filtered,
  onClear,
  random,
}: {
  showing: number;
  total: number;
  note?: string;
  filtered: boolean;
  onClear: () => void;
  /**
   * The randomiser, where the list has a tier to randomise by.
   *
   * Absent for loot and consumables, and absent by omission rather than by a
   * flag this row could get wrong: `ItemPicker` has no dice to pass in, because
   * not one of the 60 loot entries or 60 consumables in `data/srd-1.0.json`
   * carries a tier. See `randomGear.ts` for the counts.
   */
  random?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="spread" style={{ alignItems: 'center', minHeight: 'var(--control)' }}>
      <span className="t-meta" style={{ color: 'var(--muted)' }}>
        {showing} OF {total}
        {note !== undefined && <span style={{ color: 'var(--dim)' }}> · {note}</span>}
      </span>
      <div className="row" style={{ gap: 6, flex: 'none' }}>
        {filtered && (
          <button
            type="button"
            className="chip"
            onClick={onClear}
            // 13 characters at `.chip`'s 6.27px each plus its own 4px/6px
            // padding is 93.51px, so this one was never near the floor and this
            // declaration changes not a pixel of it. It is here because "every
            // button in this dialog states the floor on both axes" is a rule a
            // later reader can check, and "this label happens to be long enough"
            // is not - the same reason `Cards.tsx` declares it on its own CLEAR
            // FILTERS.
            style={{
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
              color: 'var(--text)',
              flex: 'none',
            }}
          >
            CLEAR FILTERS
          </button>
        )}
        {random}
      </div>
    </div>
  );
}

/**
 * One line of a picker. Out of reach is dimmed and says so, never hidden.
 *
 * ## The stamp, and the two places it could have gone
 *
 * `stamp` is where the row came from - `CORE SET`, `WESTERN CAMPAIGNS` - and
 * it is empty on every record of `data/srd-1.0.json`, so this row is
 * unchanged, to the pixel, on the book this app ships.
 *
 * On SRD 2.0 it is what makes two rows that would otherwise read the same
 * distinguishable. The book prints two loot tables and two consumable tables,
 * one per product, each numbered 1..60, so `Item.roll` is no longer unique in
 * its collection: all 120 loot rolls and all 120 consumable rolls collide.
 * Rendered at 393x852 on the SRD 2.0 dataset, the first two rows of the item
 * picker were **Acidpaste, `CONSUMABLE · ROLL 36`** and **Arcticite Shard,
 * `CONSUMABLE · ROLL 36`** - adjacent, on one screen, identical. That was the
 * defect, and it was looked at rather than reasoned about.
 *
 * The alternative was appending it to `meta`, and that is a real alternative
 * rather than a straw one: it is a string this file already builds and it
 * needs no element. Both were built and measured in Chrome on the SRD 2.0
 * dataset at three viewports, on the height of the first stamped row of each
 * picker against the same row unstamped:
 *
 *   picker    viewport    own line    appended to meta
 *   weapons   320x568      +20.0            +18.2
 *   weapons   393x852       +1.8             +0.0
 *   weapons   744x1133     +20.0             +0.0
 *   armor     320x568      +20.0            +36.4
 *   armor     393x852      +20.0            +18.2
 *   armor     744x1133     +20.0             +0.0
 *
 * And on whole rows of the list, over those three viewports and all three
 * pickers: the own-line version costs one row twice - armor at 744x1133, nine
 * to eight, and loot at 744x1133, seven to six - and the appended version
 * costs none. **On pixels alone the appended version wins**, and that is
 * stated first because it is the honest half of the trade.
 *
 * It is a line of its own anyway, for two reasons, one seen and one arithmetic.
 *
 * SEEN: rendered side by side at 393x852 and looked at, the appended version
 * reads `2d8+1 MAG · MELEE · STRENGTH · ONE-HANDED · MONSTER HUNTING
 * CAMPAIGNS` - the chapter title in `.t-num`'s `600 13px` mono, the same ink,
 * size and separator as the four axes before it. A player scanning that row
 * has been told the weapon has a fifth stat. Provenance is not a stat, and
 * this is the file that refuses to imply things about the armoury.
 *
 * ARITHMETIC: the own line costs a flat +20.0 on every stamped row of every
 * picker at every viewport measured. The appended one costs 0.0, 18.2 or 36.4
 * depending on where the meta happened to wrap, which depends on the item's
 * name, its damage string and the width - so the row height stops being a
 * property of the design and becomes a property of the dataset. `LIST_FLOOR`
 * and every whole-row count in this file are built on knowing what a row is.
 *
 * `.t-meta` is `500 10px/1` against `.t-num`'s `600 13px/1`, so the widest
 * stamp in the book, `EVERYDAY HERO STARTING EQUIPMENT`, is 211.2px on its own
 * line against a row text box of 252px at 320 - the narrowest viewport this app
 * is held to, 320 less the overlay's 2x10, the panel's 2 of border, the list's
 * 2x12 and the row's 2x11. It fits on one line at every supported width, which
 * is what makes the +20.0 flat.
 *
 * It sits under the numbers and above the feature text because that is the
 * order the question is asked in - what is it, what does it do, whose rules is
 * it from, what does it say - and because putting it last would seat it beside
 * `reason`, the one line on this row that is a warning.
 */
function PickerRow({
  title,
  badge,
  badgeTone,
  meta,
  stamp,
  body,
  reason,
  selected,
  onClick,
}: {
  title: string;
  badge: string;
  badgeTone?: string;
  meta: string;
  /** Which product and which module this came from. Empty when the book did not say. */
  stamp?: string;
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
        {stamp !== undefined && stamp !== '' && (
          <span className="t-meta" style={{ color: 'var(--dim)', lineHeight: 1.4 }}>
            {stamp.toUpperCase()}
          </span>
        )}
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
  rng,
  onPick,
  onClose,
}: {
  slot: Weapon['slot'];
  value: Ref | null;
  sheet: Character;
  stats: DerivedStats;
  /**
   * The dice the RANDOM button rolls.
   *
   * Passed in at the call site rather than defaulted, the way `Rest` takes its
   * own - so the two places this app can equip a weapon by chance are visible
   * from `Edit.tsx` and `Wizard.tsx` without opening this file, and so a test
   * can hand it a seeded one and assert that the sword it got is the sword the
   * seed names.
   */
  rng: Rng;
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

  // The chips the armoury has, not the chips this file remembers it having.
  // A TIER 4 chip over a dataset with no tier 4 weapon in it is the same lie
  // as a list with a weapon missing from it, one indirection earlier.
  const tiers = useMemo(() => tiersIn(weapons), [weapons]);

  // Exactly what is on screen, so the count beside the button is the size of
  // the draw. Out-of-reach weapons are in it because they are in the list:
  // this dialog shows them dimmed on purpose, and a randomiser that silently
  // skipped them would be the hiding this file refuses to do everywhere else.
  const pickRandom = (): void => {
    const chosen = randomGear(
      rows.map((r) => r.item),
      q.tiers,
      rng,
    );
    if (chosen !== null) onPick(chosen.id);
  };

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
            {/* Measured to land on the same wrapped line as Category at all
                seven viewports, so this row's height does not move. */}
            <ModuleFilter
              rows={weapons}
              value={q.modules}
              onChange={(modules) => patch({ modules })}
            />
          </div>
          <ChipRow>
            <Chips
              label="TIER"
              values={tiers}
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
          random={
            <RandomButton
              label={`Equip a random weapon of ${tierPhrase(q.tiers)}, from the ${String(rows.length)} showing`}
              disabled={rows.length === 0}
              onClick={pickRandom}
            />
          }
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
          stamp={originStamp(item)}
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
  rng,
  onPick,
  onClose,
}: {
  value: Ref | null;
  sheet: Character;
  /** The dice the RANDOM button rolls. See the note on `WeaponPicker`. */
  rng: Rng;
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

  const pickRandom = (): void => {
    const chosen = randomGear(
      rows.map((r) => r.item),
      q.tiers,
      rng,
    );
    if (chosen !== null) onPick(chosen.id);
  };

  /** The tiers the armory has. See the note in `WeaponPicker`. */
  const tiers = useMemo(() => tiersIn(armors), [armors]);

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
          <ChipRow wrap>
            <Seg
              label="Reach"
              value={q.reach}
              onChange={(reach) => patch({ reach })}
              options={[
                ['all', 'All'],
                ['usable', 'Can use'],
              ]}
            />
            {/* Beside Reach and BEFORE the divider, not after the TIER chips.
                The divider is what separates the segmented controls from the
                chips on this rail, and a `Seg` on the far side of it reads as
                part of TIER. It was measured both ways expecting no
                difference, and there is one: a wrapped line is as tall as its
                tallest child, and a `Seg` is 48px against a chip's 44. Placed
                last it lands on line 2 among the chips and makes that line 48
                too - 48 + 6 + 48 - where beside Reach both controls share line
                1 and line 2 is chips alone at 44. Measured on the SRD 2.0
                dataset: the filter column is 150 rather than 154 at 320x568,
                360x800, 375x667 and 393x852, the armor list 4px longer at each,
                and `Rules` is on the first line at all seven viewports instead
                of the second at four of them. See `ModuleFilter`. */}
            <ModuleFilter
              rows={armors}
              value={q.modules}
              onChange={(modules) => patch({ modules })}
            />
            <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
            <Chips
              label="TIER"
              values={tiers}
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
          random={
            <RandomButton
              label={`Wear a random set of armor of ${tierPhrase(q.tiers)}, from the ${String(rows.length)} showing`}
              disabled={rows.length === 0}
              onClick={pickRandom}
            />
          }
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
            stamp={originStamp(item)}
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
            stamp={originStamp(item)}
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
 *
 * ## Three states, and the third one used to be drawn as the first
 *
 * Empty, filled, and *holding a ref this build cannot name* - and until the
 * `unresolved` prop below there were two. The caller resolved the ref, got
 * `undefined`, passed `title={undefined?.name ?? null}`, and this slot drew its
 * `empty` string: `Search 391 weapons`, on a sheet whose
 * `activePrimaryWeapon` was still set. That is not a cosmetic gap. It told the
 * player the slot was empty when it was not, it hid the ref - the only thing
 * anybody has to go on when a newer bundle would resolve it - and because the
 * ✕ is gated on `title !== null` it also withheld the ONE control that clears
 * the stored ref, so the state could not be got out of except by equipping
 * something else over the top of it. Measured on the screen in
 * `tests/ui/weapons-vanish.test.tsx`.
 *
 * `unresolved` is a `{ banner, ref }` object and not two props, so a caller
 * cannot pass half of it: a banner with no ref names nothing, and a ref with no
 * banner is a slug on its own.
 */
export function GearSlot({
  label,
  title,
  meta,
  note,
  empty,
  unresolved = null,
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
  /**
   * The slot holds a ref this dataset does not print, with the words to say so
   * - `WEAPON NOT IN THIS BUILD`, the same form the Play sheet uses for an
   * armor and a domain card. Null when the slot is genuinely empty, which is a
   * different fact and must not read as this one.
   */
  unresolved?: { banner: string; ref: Ref } | null;
  disabled?: boolean;
  onOpen: () => void;
  onClear?: () => void;
}): React.JSX.Element {
  // A slot cannot be both, and if a caller ever contrives it the name it
  // resolved wins: something the player can read beats a slug.
  const lost = title === null ? unresolved : null;
  /*
   * The three sides that are not the spine.
   *
   * Dashed for the unreadable slot, against the solid line the other two
   * states carry: the shape is the signal and the colour on the spine only
   * agrees with it, never carries it alone - `shapeCoding` is the standing
   * proof in this codebase that colour on its own is not accepted.
   *
   * Per side, rather than the `border` shorthand this used to be. A shorthand
   * carrying a `var()` is dropped outright by jsdom's CSS parser - measured:
   * the button came back with no `border` property at all - so the dash would
   * have been real in Chrome and invisible to every test that looks at the
   * element. `border-left` survives, which is why the spine always did.
   */
  const side =
    lost !== null
      ? '1px dashed var(--edge)'
      : `1px solid ${title === null ? 'var(--line-soft)' : 'var(--line)'}`;
  /*
   * The note, ready to be spoken.
   *
   * It is the only part of this slot that changes without anybody touching the
   * slot: a two-handed weapon arriving in the OTHER hand rewrites this line,
   * and so does a level-up. `Wizard.tsx` already draws its blocking reason as
   * `role="status"` for exactly that, in both of the two places it appears -
   * once in the phone nav and once beside the desktop buttons - and this one
   * was a bare `<span>`, so a screen reader was told nothing at all.
   *
   * Mounted whether or not there is anything in it, because a live region has
   * to exist before its contents change for the change to be spoken;
   * `NameRefusal` writes that rule down and this follows it, including the
   * trick that makes it free. The stack below carries no `gap` - an empty
   * region under one would cost every slot on both screens 6px permanently -
   * so the two gaps are margins on the elements that want them, and the note's
   * is zero until it has something to say.
   */
  const said = (note ?? '').toUpperCase();
  return (
    <div className="stack">
      <span className="t-label">{label}</span>
      <div className="row" style={{ gap: 8, alignItems: 'stretch', marginTop: 6 }}>
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
            borderTop: side,
            borderRight: side,
            borderBottom: side,
            borderLeft: `3px solid ${
              lost !== null ? 'var(--damage)' : title === null ? 'transparent' : 'var(--hope)'
            }`,
            opacity: disabled ? 0.42 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
            {lost !== null ? (
              <span className="t-meta" style={{ color: 'var(--damage)', letterSpacing: '0.08em' }}>
                {lost.banner}
              </span>
            ) : (
              <span
                style={{
                  font: '700 14px/1.2 var(--sans)',
                  color: title === null ? 'var(--muted)' : 'var(--text)',
                }}
              >
                {title ?? empty}
              </span>
            )}
            {/* The ref itself, because it is the whole of what is knowable
                here: it is what the device this sheet came from resolved, and
                what a later bundle may resolve again. */}
            {lost !== null && (
              <span className="t-meta" style={{ color: 'var(--dim)', overflowWrap: 'anywhere' }}>
                {lost.ref}
              </span>
            )}
            {title !== null && meta !== undefined && (
              <span className="t-num" style={{ color: 'var(--text-2)' }}>
                {meta}
              </span>
            )}
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            {lost !== null ? 'REPLACE' : title === null ? 'CHOOSE' : 'CHANGE'}
          </span>
        </button>
        {/* And the ✕ is offered, which is the half of this the player cannot do
            without: the slot holds a ref, so there is something to clear, and
            gating the control on a name the build cannot read meant the only
            way out of the state was to equip something over the top of it. */}
        {onClear !== undefined && (title !== null || lost !== null) && (
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
      <span
        className="t-meta"
        role="status"
        style={{ color: 'var(--stress)', marginTop: said === '' ? 0 : 6 }}
      >
        {said}
      </span>
    </div>
  );
}
