/**
 * The card browser: 189 cards, and the only screen where scrolling is the
 * point. So everything on it is inside one scroll, filters included: they are
 * the grid's first row and they scroll away with the cards they filter.
 *
 * The line above used to read "Filters sit above the grid and never move; the
 * grid scrolls under them", and that promise had a price nobody had counted.
 * The block is 278px on any portrait phone, 226 at 640x360, 170 where its
 * first row fits on one line; the column it is spent from is H-130 on a phone
 * and H-87 on a tablet. At 320x568 that is 278 of 438 and the grid gets 148px
 * of a 268px card; at 640x360 it is 226 of 230 and the grid gets a 0px content
 * box laid inside the tab bar. The scroll region is the whole column now.
 *
 * And on anything narrow or short the block itself is two rows rather than
 * four - search, a door and the readout, 62px - with the type, owned, level
 * and recall filters behind the door and wrapped, so none of them is hidden
 * off the right edge of a rail any more. The full four-row band is what a
 * window with 720px of width and more than 520px of height still gets.
 *
 * Cards you cannot take are shown, not hidden, with the reason attached. A
 * player planning three levels ahead needs to see the level 7 card that is
 * out of reach, and "why can't I take this" is a question the sheet should
 * answer without anyone opening the book.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { foldQuery } from '../shared/srdIndex.ts';
import { DOMAINS_FOR_DISPLAY, type DomainCardType, type DomainId } from '../../../shared/types.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { canAddToLoadout, cardAvailability, releaseCard, vaultCard } from '../../engine/loadout.ts';
import { useActive, useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { DomainMark } from '../shared/DomainMark.tsx';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { useIsPhone, useIsShort } from '../shared/useLayout.ts';
import { useRecall } from './recall.ts';

type Owned = 'all' | 'owned' | 'available';

export function Cards({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const update = useApp((s) => s.update);
  const recall = useRecall();
  const phone = useIsPhone();
  const short = useIsShort();
  // Narrow *or* short: see the table above the controls. A rotated phone is in
  // the tablet band by width and still has only 306px of column to spend.
  const compact = phone || short;

  const [domain, setDomain] = useState<DomainId | 'mine' | 'all'>('mine');
  const [type, setType] = useState<DomainCardType | 'all'>('all');
  const [owned, setOwned] = useState<Owned>('all');
  // Multi-select, and empty means "any" - so a search for "everything I could
  // recall for one Stress at level 3 or below" is three taps, not a mode.
  const [levels, setLevels] = useState<ReadonlySet<number>>(new Set());
  const [recalls, setRecalls] = useState<ReadonlySet<number>>(new Set());
  const [query, setQuery] = useState('');
  const search = foldQuery(useDeferredValue(query));
  /*
   * The card whose recall is waiting for a second tap, because it would be
   * paid in Hit Points rather than in Stress. One at a time: two primed
   * controls in a grid of 189 is worse than none.
   */
  const [armed, setArmed] = useState<string | null>(null);
  /*
   * The card whose ✕ has been pressed once.
   *
   * A second state and not a mode on `armed`, because the two prime different
   * things: `armed` is "this recall will cost Hit Points, press again", and
   * this is "this card will stop being yours, press again". A card can be a
   * candidate for neither, either or - if they shared a slot - the wrong one.
   * They are cleared against each other where they are set, so only one prompt
   * is ever live.
   */
  const [releasing, setReleasing] = useState<string | null>(null);
  /*
   * Whether the four folded filters are open, in the compact arrangement only.
   * Deliberately not remembered: it is a state of one visit to this screen,
   * not of the character, and `prefs.playSections` is keyed per character for
   * a reason the card browser does not share.
   */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggle = (set: ReadonlySet<number>, n: number): ReadonlySet<number> => {
    const next = new Set(set);
    if (!next.delete(n)) next.add(n);
    return next;
  };

  /*
   * The domains THIS dataset prints, in the order a person should meet them.
   *
   * Same rule as `allLevels` and `allRecalls` below, and it was the one list on
   * this screen that did not follow it: the strip mapped `DOMAINS_FOR_DISPLAY`,
   * which is what the *code* can represent. `DOMAINS` gained `dread` for SRD
   * 2.0 while the app still ships `data/srd-1.0.json`, whose `domains` array is
   * the nine - so the shipped build drew a tenth chip over a dataset with no
   * Dread card behind it. Measured in Chrome on the running app at 1440x900:
   * the readout goes `42 OF 189` -> `0 OF 189` and the grid becomes the single
   * line "No cards match those filters." A filter whose only possible outcome
   * is the empty state is a control that lies about what is in the book.
   *
   * Intersected in `DOMAINS_FOR_DISPLAY`'s order rather than mapped from
   * `dataset.domains` directly, because those are two different orders and only
   * one of them belongs on a screen. `dataset.domains` is the book's order -
   * SRD 2.0 prints Codex at folio 7, so `codex` sits at index 7 there - while
   * the grid under this strip sorts its rows by `domain.localeCompare`. Mapping
   * the dataset raw would have put the chips in one order over cards in
   * another. Nothing here sorts `DOMAINS`, whose own order is the wire format.
   *
   * THE GEOMETRY IS DELIBERATELY UNCHANGED, and the numbers are why. Measured
   * in Chrome on this screen, filters open, with `--control` at 44: the strip's
   * twelve chips are 929.65px of content at ten domains and 853.29px at nine,
   * so the tenth costs **76.36px** (926.46 / 850.10 above 1179px, where
   * `--control` is 34). Swept from 320 to 1440 in 2px steps at both 852 and
   * 360 tall, that 76.36px forces one extra wrapped line - 50px of block - in
   * exactly three width bands, 336-354, 466-506 and 894-968, and in none of the
   * others. Across seventeen viewports it changes the number of whole cards on
   * the glass at scroll 0 at exactly one - 480x800, where nine domains show two
   * and ten show none - and nothing lands in 466-506 in this project's own
   * sweep, whose widths are 320, 360, 375, 390, 393, 430, 640, 852, 744, 768,
   * 820, 1024, 1180 and 1440.
   *
   * Five ways of buying that 50px back were rendered and measured, at content
   * width / smallest chip on a phone / whole cards at 480x800: 6px of chip
   * padding 841.65 / 44x44 / 2; the domain mark dropped 759.65 / 44x44 / 2;
   * three-letter labels 772.80 / 44x44 / 2; `gap: 4` 907.65 / 44x44 / 0; the
   * two non-domain chips lifted out 788.95 / 64.09x44 / 2. None of them touches
   * the tap target on a phone - every chip states `minWidth: var(--control)`,
   * so a shorter label buys width and never shrinks the target - so every one
   * of them is paid for out of what is READ. `dread` and `bone` become `dre`
   * and `bon`; the mark is the only place the shape and the name are printed
   * together outside the Settings legend; 6px padding takes the desktop `All`
   * from 40.81 to 34. And horizontal scroll, the sixth, is the defect this row
   * was rewritten to remove: measured at 393x852 it puts all twelve on one line
   * and hands seven of them - codex, dread, grace, midnight, sage, splendor,
   * valor - to `elementFromPoint` as unreachable, with no cut chip at the fold.
   * Two cards at one synthetic width is not worth any of that.
   */
  /*
   * `DOMAINS_FOR_DISPLAY` and never `DOMAINS`, and the difference lands the day
   * SRD 2.0 ships. `DOMAINS`' array order is a WIRE FORMAT - `codec.ts` writes
   * `DOMAINS.indexOf(d) + 1` as a u8 - so `dread` is APPENDED at index 9 rather
   * than sorted into place, and reading the wire order onto the screen puts it
   * last under an otherwise alphabetical grid. Swapping the two here leaves
   * every test green, which is why this sentence is here.
   */
  const domainsOnOffer = useMemo(
    () => DOMAINS_FOR_DISPLAY.filter((d) => dataset.domains.some((entry) => entry.id === d)),
    [dataset.domains],
  );

  // Whatever the dataset actually holds, not 1-10 and 0-5 by assumption.
  const { allLevels, allRecalls } = useMemo(() => {
    const l = new Set<number>();
    const r = new Set<number>();
    for (const c of dataset.domainCards) {
      l.add(c.level);
      r.add(c.recallCost);
    }
    return {
      allLevels: [...l].sort((a, b) => a - b),
      allRecalls: [...r].sort((a, b) => a - b),
    };
  }, [dataset.domainCards]);

  const filtered =
    domain !== 'mine' || type !== 'all' || owned !== 'all' || levels.size > 0 || recalls.size > 0 || search !== '';
  /*
   * How many of the filters behind the compact door are set. The search box is
   * not one of them: it is in the head row, where you can see what you typed.
   * This is the number the door prints, so a shut fold can never be the reason
   * a player cannot find a card they own.
   */
  const folded =
    (domain === 'mine' ? 0 : 1) +
    (type === 'all' ? 0 : 1) +
    (owned === 'all' ? 0 : 1) +
    (levels.size > 0 ? 1 : 0) +
    (recalls.size > 0 ? 1 : 0);
  const clearAll = (): void => {
    setDomain('mine');
    setType('all');
    setOwned('all');
    setLevels(new Set());
    setRecalls(new Set());
    setQuery('');
  };

  const rows = useMemo(() => {
    if (!character) return [];
    return cardAvailability(character, stats, dataset.domainCards)
      .filter((row) => {
        if (domain === 'mine') {
          if (!stats.domains.includes(row.card.domain)) return false;
        } else if (domain !== 'all' && row.card.domain !== domain) return false;
        if (type !== 'all' && row.card.type !== type) return false;
        if (levels.size > 0 && !levels.has(row.card.level)) return false;
        if (recalls.size > 0 && !recalls.has(row.card.recallCost)) return false;
        if (owned === 'owned' && !row.owned) return false;
        if (owned === 'available' && (row.owned || !row.eligible)) return false;
        if (search !== '') {
          // `foldQuery` on both sides, for the same reason the SRD search does
          // it: ten of this book's card names carry U+2011, and the hyphen a
          // phone keyboard types is U+002D.
          const hay = foldQuery(`${row.card.name} ${row.card.text} ${row.card.domain}`);
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          a.card.level - b.card.level ||
          a.card.domain.localeCompare(b.card.domain) ||
          a.card.name.localeCompare(b.card.name),
      );
  }, [character, dataset.domainCards, domain, levels, owned, recalls, search, stats, type]);

  if (!character) return null;

  const acquire = (cardId: string): void => {
    const card = dataset.domainCards.find((c) => c.id === cardId);
    if (!card) return;
    // Any other action on any card answers a live ✕ prompt with "no". A primed
    // control that survives an unrelated tap is a control that fires later, on
    // a screen the player has stopped reading.
    setReleasing(null);
    if (character.loadout.includes(cardId)) {
      update((c) => vaultCard(c, cardId));
      return;
    }
    if (character.vault.includes(cardId)) {
      const check = canAddToLoadout(character, card);
      if (!check.allowed) return;
      /*
       * P1-2. `canAddToLoadout` has always answered `affordable`, and until now
       * nothing read it: with the Stress track full, `markStress` marks Hit
       * Points instead, so a tap on RECALL at 6/6 Stress and 5/6 HP took the
       * sixth Hit Point and offered a death move. It is still allowed - whether
       * a recall is a "move" under the Stress rule is a table ruling, and the
       * Recall Cost text is not in the shipped rules layer, so the app cannot
       * cite the rule it would be enforcing - but it costs a second, informed
       * tap, and the button says the number of Hit Points before the first one.
       */
      if (!check.affordable && armed !== cardId) {
        setArmed(cardId);
        return;
      }
      setArmed(null);
      /*
       * Through the same function the vault's own control goes through.
       *
       * These lines used to be written out here as well, and the copy had
       * drifted: it said "Free during downtime" for any recall that cost
       * nothing, which for the 31 SRD cards whose Recall Cost is 0 meant the
       * log claiming a downtime in the middle of a scene. Two surfaces
       * disagreeing about what a tap costs is the thing this file's own header
       * is about, and the log line is part of the cost.
       */
      recall(card);
      return;
    }
    // Acquiring a card the character does not own yet goes to the vault:
    // getting it into the loadout is a separate, costed decision.
    update((c) => ({ ...c, vault: [...c.vault, cardId] }));
  };

  /**
   * Give a card back, on the second press.
   *
   * ## Why it arms at all, when nothing else in this footer does
   *
   * Because it is the only control here that REDUCES what the character owns.
   * TAKE adds, RECALL and IN LOADOUT move a card between two lists you already
   * hold; every one of them is undone by one more tap on the same row. This is
   * not: once a card is off both lists the row's footer becomes TAKE if the
   * card is still eligible - and the reason text with no control at all if it
   * is not. A card out of a domain the character has lost, or above their
   * current cap, cannot be taken back from this screen. That is the case the
   * arming is for, and it is exactly the case a player cannot see coming.
   *
   * ## Why the prompt is not on the button that is about to act
   *
   * `armed` puts its question ON the control - the label becomes MARK 2 HP? -
   * and it can, because that control is `flex: none` at the LEFT edge of a
   * `space-between` strip: its own left edge cannot move. The ✕ is at the right
   * edge, so a question written into the ✕ would widen it and slide it left
   * between the two presses. The second press would land where the first one
   * did and hit something else.
   *
   * So the ✕ never changes size. It changes colour, and the question is written
   * in the readout - to its left on a desk, under it on a phone, where the
   * strip is two rows since the readability ramp - the one place in this strip
   * whose width is already free to move, because `space-between` pins the last child to the
   * padding edge and absorbs every width change in the gaps before it. Measured
   * the other way round on the Play screen's own arming strip: 17px of extra
   * label there reflowed the two touch targets apart between the presses.
   */
  const release = (cardId: string): void => {
    if (releasing !== cardId) {
      setReleasing(cardId);
      setArmed(null);
      return;
    }
    setReleasing(null);
    update((c) => releaseCard(c, cardId));
  };

  /*
   * `overflow: hidden` is the one declaration this box has never carried, and
   * without it the browser painted over the tab bar.
   *
   * Measured at 640x360. `.app` is `100svh` with `grid-template-rows: auto 1fr`
   * and `overflow: hidden`, so the header takes 53 and `<main>` 307; the tab
   * bar is `flex: none`, 60px of button plus a 1px top border, laid y299..360.
   * That leaves this root 246px at y53..299 and a content box of 230 at
   * y61..291. The filter block was a `flex: none` sibling of the grid and 226px
   * tall at this width, so the grid was offered 4px of free space - and under
   * the global `box-sizing: border-box` (base.css:10-14) a `flex: 1;
   * min-height: 0` box cannot floor below its own `padding-bottom`, so the grid
   * was laid at y299..311: clientHeight 12, content box **0px**, and every one
   * of those 12 pixels inside the nav. `DomainCardView`'s root is
   * `position: relative` and the nav declares no `position`, so the tiles
   * painted in the positioned layer above a static bar and took the hit-testing
   * with them: `document.elementFromPoint(111, 303)` returned a card's overlay
   * button rather than PLAY, and the same for CARDS, BUILD and GM.
   *
   * The filters have since moved inside the scroll, so the grid fills this box
   * exactly and there is nothing left to overhang. The clip stays anyway, and
   * it is a guard rather than a fix now: `<main>` clips at a box that contains
   * the tab bar, this root is the last ancestor between the two, and the next
   * thing anybody adds here would be painting over four 160x61 targets at the
   * bottom edge of a two-handed grip, on the only route off this screen.
   *
   * No `gap`: there is one child.
   */
  const rootStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    padding: phone ? '8px 12px' : '14px 20px 20px',
    overflow: 'hidden',
  };

  /*
   * The six controls, written once and arranged twice.
   *
   * `compact` is the arrangement, and the two rows below are the whole of it:
   * search plus a door, then the readout. 44 + 8 + 10 = **62px** shut, or 96
   * once something is filtered and CLEAR FILTERS holds the readout row open at
   * `--control`. The other arrangement is the four rows this screen has always
   * drawn, which measure 278 on a portrait phone, 226 at 640x360 and 568x320,
   * and 170 where the first row fits on one line.
   *
   * What that is worth, as the card area visible without scrolling - the
   * scrollport less the block and the grid's 12px gap, against a tile 268px
   * tall on a phone and 310 on a tablet, which is what the tile was when this
   * was measured (it is 308 and 320 since the readability ramp - see the note
   * by `height` on the card below - so the right-hand column overstates by
   * about 15% on a phone and 3% above, and is not re-derived here):
   *
   *   window     port   was ->  now    of a card
   *   320x568     438   148 ->  364    55% -> 136%
   *   360x640     510   220 ->  436    82% -> 163%
   *   375x667     537   247 ->  463    92% -> 173%
   *   393x852     722   432 ->  648   161% -> 242%
   *   568x320     190     0 ->  116     0% ->  43%
   *   640x360     230     0 ->  156     0% ->  58%
   *   667x375     245    63 ->  171    24% ->  64%
   *   852x393     306   124 ->  232    40% ->  75%
   *
   * The two landscape windows are the reason `compact` is not simply `phone`.
   * 852x393 is in the tablet band by width and has 306px of column; at 170 the
   * filters were 56% of it. `useIsShort()` is 520px and under, which separates
   * every rotated phone in the sweep (320..448 tall) from every portrait one
   * (568 and up) and from 1180x695.
   *
   * The cost is one tap to reach the type, owned, level and recall filters,
   * and it buys back more than it spends even measured only in reach: those
   * chips were behind a horizontal scroll with `scrollbar-width: none`, so at
   * 393 the whole RECALL group sat 447px off the right edge of a 369px rail
   * with nothing on screen saying so, and 7 of 9 domains with it. Wrapped
   * inside the fold they are all on the glass. And the state is never silent:
   * the door reads FILTERS 2 with the count in bold, the readout beside it
   * says how many of 189 survived, and CLEAR FILTERS is drawn the moment
   * anything is set.
   */
  const searchField = (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search 189 cards"
      aria-label="Search cards"
      style={{ flex: '1 1 200px', minHeight: 'var(--control)', maxWidth: 320 }}
    />
  );
  const ownedFilter = (
    <Segmented
      value={owned}
      onChange={setOwned}
      options={[
        ['all', 'All'],
        ['owned', 'Owned'],
        ['available', 'Can take'],
      ]}
    />
  );
  const typeFilter = (
    <Segmented
      value={type}
      onChange={setType}
      options={[
        ['all', 'Any'],
        ['Ability', 'Ability'],
        ['Spell', 'Spell'],
        ['Grimoire', 'Grimoire'],
      ]}
    />
  );
  const domainFilter = (
    <>
      <FilterChip active={domain === 'mine'} onClick={() => setDomain('mine')}>
        My domains
      </FilterChip>
      <FilterChip active={domain === 'all'} onClick={() => setDomain('all')}>
        All
      </FilterChip>
      {domainsOnOffer.map((d) => (
        <FilterChip key={d} active={domain === d} onClick={() => setDomain(d)}>
          <DomainMark domain={d} size={11} shapes={shapes} />
          <span style={{ textTransform: 'capitalize' }}>{d}</span>
        </FilterChip>
      ))}
    </>
  );
  const levelFilter = (
    <NumberFilter
      label="LV"
      values={allLevels}
      selected={levels}
      onToggle={(n) => setLevels(toggle(levels, n))}
    />
  );
  const recallFilter = (
    <NumberFilter
      label="RECALL"
      values={allRecalls}
      selected={recalls}
      onToggle={(n) => setRecalls(toggle(recalls, n))}
    />
  );

  return (
    <div className="stack" style={rootStyle}>
      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${phone ? 150 : 210}px, 1fr))`,
          gap: 12,
          alignContent: 'start',
          paddingBottom: 12,
        }}
      >
        {/*
          The filters are the grid's first row, not a block above it.

          They used to be a `flex: none` stack outside this scroll, and the
          price of "they never move" was never counted: the block is 278px on
          every portrait phone - 320, 360, 375 and 393 all wrap its first row
          to three lines - 226 at 640x360 and 568x320, and 170 wherever that
          row fits on one. The column it is spent out of is only H-130 on a
          phone (header 53, tab bar 61, 16 of root padding) and H-87 on a
          tablet, so it took 278 of 438 at 320x568, 278 of 722 at 393x852, 170
          of 306 at 852x393 - and 226 of 230 at 640x360, where the grid then
          floored at its own 12px of padding and was laid inside the tab bar.

          As a row of the grid it costs the same pixels at scroll 0 and none
          at any other scroll position, so the scrollport is the whole column:
          148 -> 438 at 320x568, 220 -> 510 at 360x640, 247 -> 537 at 375x667,
          432 -> 722 at 393x852, 124 -> 306 at 852x393, and 12 -> 230 at
          640x360, which is the first card pixel that window has ever drawn.
          Nothing is lost on the way: the visible card area at scroll 0 is
          port - block - gap, which is exactly the number the old fixed block
          left, so this is a gain at every scroll position and a loss at none.

          What it costs is the promise: scroll past the first screen and the
          filters are gone until you scroll back. That is the right way round
          for this screen - they are out of reach only when there are enough
          results to scroll, which is exactly when nobody is reading them, and
          a filtered-to-nothing grid still shows them above its own empty
          state. `gridColumn: '1 / -1'` for the same reason the notice and
          the empty state carry it: a 150px cell is not a filter bar.
        */}
        {/*
          Compact: search, the door to the rest, and the readout. 44 + 8 + 10 =
          62px, against the 278 the four rows cost on the same phone.

          Wide: the four rows as they were, because a 1046px column can afford
          170 of them and a mouse should not have to open a fold to reach a
          control there is room for.

          Nothing in either arrangement scrolls sideways: every row wraps, so
          every domain chip, all ten levels and all six recall costs are on the
          glass at once, which is the first time any of them has been. "Eleven
          domain chips" stood here and is now a number the dataset owns - two
          scope chips plus one per domain in `dataset.domains`, so eleven on
          SRD 1.0 and twelve on SRD 2.0; see `domainsOnOffer` for what that
          costs in pixels, which is 76.36 and no card on any real viewport.
          Both rails used to be `overflowX: 'auto', scrollbarWidth: 'none'`,
          and their content is a constant 853px and 816px against a port of the
          viewport less 24 on a phone and less 40 at 720 and up. Measured: at
          393 that hid 484 and 447 - the whole RECALL group, its divider, its
          label and all six cost buttons, plus 7 of the 9 domains - and left no
          cut chip at either fold to say so; at 744 it still hid 149 and 112.
          Wrapping costs the wide band 100px at 744x1133, of a 1046px port, and
          nothing at all at 890 and above, where the rails already fitted.

          Its own `display: flex` rather than `className="stack"`, which is the
          same declaration less one property - and that property is
          `min-height: 0`, which on a *grid* item is not the harmless line it
          is on a flex one. It sets the item's automatic minimum size to zero,
          so the auto row's base size is zero, and a row grows from its base
          size towards its growth limit only out of the grid's free space - of
          which a grid of 189 cards in a 438px port has none. Measured in
          Chrome at 320x568 with `.stack` on this div: row 1 was **0px**, this
          element's own `getBoundingClientRect().height` was 0, and its 62px of
          controls were painted straight over the first card, which began at
          y73 instead of y135. Nothing in the suite could see it - jsdom
          computes no layout - and nothing on the glass said it either, because
          the controls still drew, just on top of a card. Without `.stack` the
          row is 62px and the first card begins at 61 + 62 + 12 = 135.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: '1 / -1' }}>
          {compact ? (
            <>
              <div className="row" style={{ gap: 8 }}>
                {searchField}
                <button
                  type="button"
                  className="row chip"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  style={{
                    flex: 'none',
                    gap: 6,
                    minHeight: 'var(--control)',
                    minWidth: 'var(--control)',
                    padding: '0 10px',
                    background: folded > 0 ? 'var(--raised)' : 'transparent',
                    border: `1px solid ${folded > 0 ? 'var(--line)' : 'var(--line-soft)'}`,
                    color: 'var(--text)',
                  }}
                >
                  {/* The same rotated triangle `Disclosure` draws, for the
                      same reason: the arrow glyphs in the two families this
                      app ships sit on different baselines. */}
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 8,
                      height: 8,
                      background: 'var(--muted)',
                      clipPath: filtersOpen
                        ? 'polygon(0 25%,100% 25%,50% 100%)'
                        : 'polygon(25% 0,100% 50%,25% 100%)',
                    }}
                  />
                  FILTERS
                  {folded > 0 && (
                    <>
                      <span style={{ fontWeight: 700 }}>{folded}</span>
                      <span className="sr-only"> set</span>
                    </>
                  )}
                </button>
              </div>
              {filtersOpen && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {ownedFilter}
                    {typeFilter}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {domainFilter}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {levelFilter}
                  </div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {recallFilter}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                {searchField}
                {ownedFilter}
                {typeFilter}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {domainFilter}
              </div>

              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {levelFilter}
                <span style={{ width: 1, height: 22, background: 'var(--line)', flex: 'none' }} />
                {recallFilter}
              </div>
            </>
          )}

          <div className="spread" style={{ alignItems: 'center' }}>
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              {rows.length} OF {dataset.domainCards.length}
            </span>
            {filtered && (
              <button
                type="button"
                className="chip"
                onClick={clearAll}
                // 14 characters, so ~108px wide and never near the floor -
                // declared anyway, because "every button in this block states
                // the floor on both axes" is a rule a later reader can check
                // and "this one happens to be long enough" is not.
                style={{
                  minHeight: 'var(--control)',
                  minWidth: 'var(--control)',
                  color: 'var(--text)',
                }}
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        </div>
        {rows.map((row) => {
          // The Hit Points a recall would cost, if it would cost any. Only a
          // card in the vault can be recalled, so only that one is costed.
          const swap =
            row.owned && !row.inLoadout ? canAddToLoadout(character, row.card) : null;
          const needsHp = swap !== null && swap.allowed && !swap.affordable;
          const primed = armed === row.card.id;
          const primedRelease = releasing === row.card.id;
          // The three parts of an eligible card's footer, built once so the
          // one-row strip and the phone's two-row one draw the same controls
          // with the same labels.
          const action = (
            <CardAction
              tone={primed ? 'warn' : row.inLoadout ? 'held' : 'go'}
              onClick={() => acquire(row.card.id)}
              label={
                primed
                  ? `Confirm: recall ${row.card.name} and mark ${String(swap?.hpCost ?? 0)} HP`
                  : needsHp
                    ? `Recall ${row.card.name} - no Stress left, so it would mark ${String(swap?.hpCost ?? 0)} HP`
                    : row.inLoadout
                      ? `Move ${row.card.name} to the vault`
                      : row.owned
                        ? `Recall ${row.card.name} for ${row.card.recallCost} Stress`
                        : `Take ${row.card.name} into the vault`
              }
            >
              {primed
                ? `MARK ${String(swap?.hpCost ?? 0)} HP?`
                : row.inLoadout
                  ? 'IN LOADOUT'
                  : row.owned
                    ? 'RECALL'
                    : 'TAKE'}
            </CardAction>
          );
          const readout = (
            <span
              className="t-meta"
              style={{
                flex: 'none',
                color: primedRelease
                  ? 'var(--damage)'
                  : needsHp
                    ? 'var(--damage)'
                    : 'var(--dim)',
                textAlign: 'right',
              }}
            >
              {primedRelease
                ? 'PRESS ✕ AGAIN'
                : needsHp
                  ? `${String(swap?.hpCost ?? 0)} HP — NO STRESS`
                  : `COST ${row.card.recallCost}`}
            </span>
          );
          /*
           * The way back out, and the only control on this card that reduces
           * what the character owns.
           *
           * Last child of a `space-between` strip on purpose: that pins it to
           * the padding edge, so the readout beside it can change from "COST
           * 2" to "PRESS ✕ AGAIN" without moving the target the second press
           * has to hit. Its own width never changes - one glyph, both states -
           * and the arming shows as colour plus that readout, which is text a
           * screen reader gets through the label below rather than through a
           * colour it cannot see. On a phone the strip is two rows and the
           * readout is the second, so there the ✕ shares its row with the verb
           * alone and the readout changes width under it, not beside it - the
           * same edge, the same pin.
           *
           * `minWidth: var(--control)` on `CardAction`, and the strip's own
           * floor is `max(34px, var(--control))` - both resolve to 34 on a
           * mouse and to `--tap` (44) under `any-pointer: coarse` or at 1179px
           * and below. So it is a 44 x 44 target wherever there is a finger,
           * the same floor as the TEXT button on every card row in
           * `LevelUp.tsx`, and it sits in the same band as the action it
           * undoes rather than in a menu two taps away.
           *
           * Only for a card the character owns. On an unowned card there is
           * nothing to give back, and a ✕ that does nothing beside a TAKE that
           * does something is a control a player has to learn by pressing.
           */
          const cross = (
            <CardAction
              tone={primedRelease ? 'warn' : 'held'}
              onClick={() => release(row.card.id)}
              label={
                primedRelease
                  ? `Confirm: give ${row.card.name} back, so it is no longer yours`
                  : `Give ${row.card.name} back - it stops being one of your cards`
              }
            >
              <span aria-hidden="true">✕</span>
            </CardAction>
          );
          return (
            <DomainCardView
              key={row.card.id}
              card={row.card}
              shapes={shapes}
              onOpen={() => setOpenCard(row.card)}
              /*
               * 308 and 320, and the text box is what the tile has left after
               * its borders, the head, the chip row, the name and the footer.
               *
               * Before the readability ramp the tile was 268 and 310 and the
               * rules text was `.t-dense`, 11.5px/1.38 - a 15.87px line - so
               * the box, 81.25 on a phone and 109.95 on a desk by declaration
               * (the 110 the `--control` note in `tokens.css` measured), held
               * five and six whole lines. `.t-read` is 16px/1.5 on a phone, a
               * 24px line, and 15px/1.5 from 720, 22.5: the same boxes held
               * three and four. The desk tile gained ten for five lines: the
               * rig reads its box at 120.84 at 1280x800, 8.34 over the 112.5
               * five lines need. A tablet's footer is the 44 floor and not 34,
               * plus the hairline the floor no longer swallows, so its box is
               * 114.25 at 768x1024 and holds the same five with 1.75 spare.
               * (An earlier revision of this comment set the old line at
               * 18.85 from a 13px/1.45 that was never this tile's role, and so
               * said the old boxes held four and five.)
               *
               * The phone tile is 308 and not the 286 that gave 99.25 and
               * four whole lines on its own, because the phone footer below is
               * two rows since the readability ramp - 44 of controls, a 2px
               * gap, a 15px readout and 4 under it, 66 with the hairline,
               * against the 44 it was - and the 22 is paid here so the box
               * keeps its 99.25 and its four lines: measured 99.25 at
               * 393x852, 3.25 over the 96 four lines need. The table in the
               * docblock above is still against 268 and 310.
               */
              height={phone ? 308 : 320}
              headHeight={phone ? 78 : 96}
              dimmed={!row.eligible && !row.owned}
              footer={
                /*
                 * P3-11. There is no action here, so there is no control: the
                 * footer is the reason, full width. It used to be a disabled
                 * button reading '—' with the reason in the other corner - a
                 * control that looks live, does nothing, and says nothing,
                 * beside the sentence that was the answer all along.
                 */
                !row.eligible && !row.owned ? (
                  <span
                    className="t-meta"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      color: 'var(--dim)',
                      lineHeight: 1.25,
                      overflow: 'hidden',
                    }}
                  >
                    {row.reason}
                  </span>
                ) : phone ? (
                  /*
                   * TWO ROWS ON A PHONE, since the readability ramp: the
                   * controls on the first, the readout under them.
                   *
                   * The strip is one row everywhere else and was one row here
                   * too, and a 178.5px tile at 393 - 154.5 inside the footer's
                   * 11px of padding either side - never had the room for all
                   * three of its parts even at the old sizes: on main, at the
                   * 9.5px chip and the 10px readout, the rig reads the ✕
                   * painted 24.28 of 44 on an IN LOADOUT tile. At `.chip`'s
                   * 11px on a coarse pointer IN LOADOUT is 96.81 wide and the
                   * ✕ is its 44, which with the 8px gap is 156.8 before the
                   * readout is drawn at all - so the readout had 0 of the
                   * 46.09 that COST 2 takes at `.t-meta`'s 12, and the ✕ was
                   * painted 7.59. No arrangement of one row holds a ten-letter
                   * verb, a price and a 44px target in 154.5 at sizes a
                   * reader at 40cm can read, so the row is two.
                   *
                   * The ✕ keeps the right edge, in a `space-between` row with
                   * the verb; the readout goes under it, right-aligned, so
                   * PRESS ✕ AGAIN sits under the ✕ it names. Where even the
                   * verb and the ✕ do not share a line - a root at 125% puts
                   * IN LOADOUT at 115.5 and the pair at 167.5 - the row wraps
                   * and the ✕ takes a line of its own at the same edge, with
                   * `marginLeft: auto` on its wrapper, rather than losing 13px
                   * of the one target on this card that gives a card away.
                   *
                   * What it costs: 44 of controls, a 2px gap, the readout's
                   * 15px line and 4 under it, 66 with the footer's hairline
                   * against the 44 the one-row strip is - 22 more, paid by the
                   * tile's `height` above so the rules text keeps its four
                   * whole lines.
                   */
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2, paddingBottom: 4 }}>
                    <div
                      className="spread"
                      style={{ alignItems: 'center', flexWrap: 'wrap', minHeight: 'var(--control)' }}
                    >
                      {action}
                      {row.owned && (
                        <span style={{ display: 'flex', marginLeft: 'auto' }}>{cross}</span>
                      )}
                    </div>
                    {readout}
                  </div>
                ) : (
                  <>
                    {action}
                    {readout}
                    {row.owned && cross}
                  </>
                )
              }
            />
          );
        })}
        {rows.length === 0 && (
          <p className="t-body" style={{ gridColumn: '1 / -1', color: 'var(--dim)' }}>
            {dataset.domainCards.length === 0
              ? 'The dataset has not been built yet. Run `npm run build:srd`.'
              : 'No cards match those filters.'}
          </p>
        )}
        {/*
          The notice, at the end of the browser rather than pinned above the tab
          bar - which is where it was, and where it cost this screen at least
          the 126.16px the notice measures on a 369px column at 393x852, a
          pinned one painting a panel and its own horizontal padding on top of
          that, whether or not anybody was reading it. ("~111px" stood here; it
          was the estimate, and it was short by the border it forgot to add.
          `LicenceFooter.tsx` carries the measurement.) Here it is 189 cards
          down, or one filter away.

          `gridColumn: '1 / -1'` because this scroll region is the card grid
          itself: without it the footer takes one 150px cell and sets the
          342-character notice in a column narrower than a card. The empty state
          above it spans the row for the same reason.
        */}
        <div style={{ gridColumn: '1 / -1' }}>
          <LicenceFooter />
        </div>
      </div>
    </div>
  );
}


/**
 * The card's one action, shaped like a control.
 *
 * P3-11. It used to be `className="t-meta"` with no background, no border and
 * `var(--muted)` - beside a readout at the other end of the same row that was
 * also `t-meta`, in `var(--dim)`. Two small grey capitals eleven characters
 * apart read as a matched pair of labels, not as a button and a number, and
 * the pair was RECALL and RECALL 2: the same word for the action and for its
 * price. The number now says COST; this says what it does and looks like
 * something that does it.
 *
 * `stopPropagation`, because the card behind it opens the reader on a tap and
 * a footer press must not do both.
 */
function CardAction({
  tone,
  label,
  onClick,
  children,
}: {
  /** `go` takes or recalls, `held` is already in the loadout, `warn` costs HP. */
  tone: 'go' | 'held' | 'warn';
  /** The accessible name, which says which card as well as which verb. */
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const ink =
    tone === 'warn' ? 'var(--damage)' : tone === 'held' ? 'var(--hope)' : 'var(--text)';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="chip"
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        /*
         * A floor, not a width. Every label this renders - IN LOADOUT, RECALL,
         * TAKE, MARK 2 HP? - is far wider than it and is unmoved; the one child
         * it binds is the ✕, which is a single glyph and would otherwise be a
         * 29px target inside a 44px strip. `--control` is the token that
         * already answers "how wide is a control here" for every chip on this
         * screen, and it resolves to `--tap` under `any-pointer: coarse` and at
         * 1179px and below - so the mouse layout is unchanged to the pixel and
         * every touchscreen gets 44.
         */
        minWidth: 'var(--control)',
        padding: '0 10px',
        background: tone === 'warn' ? 'var(--fear-wash)' : 'var(--raised)',
        border: `1px solid ${tone === 'go' ? 'var(--line)' : ink}`,
        color: ink,
        fontWeight: 700,
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </button>
  );
}

/**
 * A row of numbers that filter by OR, and by AND against every other filter.
 *
 * Nothing selected means "any", which is why there is no explicit All chip:
 * an empty selection already says it, and a chip that only ever undoes other
 * chips is a control you have to learn.
 */
function NumberFilter({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: readonly number[];
  selected: ReadonlySet<number>;
  onToggle: (n: number) => void;
}): React.JSX.Element {
  return (
    <>
      <span className="t-meta" style={{ flex: 'none', alignSelf: 'center', color: 'var(--dim)' }}>
        {label}
      </span>
      {values.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onToggle(n)}
          aria-pressed={selected.has(n)}
          aria-label={`${label} ${n}`}
          className="chip"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: selected.has(n) ? 'var(--hope)' : 'var(--raised)',
            color: selected.has(n) ? 'var(--app)' : 'var(--muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {n}
        </button>
      ))}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="row chip"
      style={{
        minHeight: 'var(--control)',
        // See the note over `Segmented`. `All` is 40.81px wide here - the same
        // 38.81 plus this chip's two 1px borders - and was the third of the
        // three controls on this screen under the floor on one axis.
        minWidth: 'var(--control)',
        flex: 'none',
        gap: 6,
        padding: '0 10px',
        background: active ? 'var(--raised)' : 'transparent',
        border: `1px solid ${active ? 'var(--line)' : 'transparent'}`,
        color: active ? 'var(--text)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}): React.JSX.Element {
  return (
    <div
      className="row"
      style={{ gap: 2, padding: 2, borderRadius: 'var(--r3)', background: 'var(--panel)' }}
    >
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className="chip"
          style={{
            minHeight: 'var(--control)',
            /*
             * The floor is a floor on both axes, and this button only ever
             * declared one of them.
             *
             * `--tap` is not what it was missing: `--control` already resolves
             * to `var(--tap)` = 44 at every width below 1180 and wherever the
             * PRIMARY pointer is coarse - `tokens.css`'s `@media (max-width:
             * 1179px), (pointer: coarse)` block - and the height was 44
             * everywhere it mattered. (`tokens.css:174-178` stood here and is
             * five lines of hit-point cell arithmetic; and "any coarse pointer"
             * was the wrong query - `any-pointer` is what `--pip-h` answers,
             * and that distinction is the whole of its docblock.) The width
             * came from `.chip`'s `padding: 4px 6px` around the label, and IBM Plex Mono at
             * the 9.5px `.chip` had when this was measured (11 on a phone since
             * the readability ramp) with 0.06em tracking is 6.27px a character - so `All` and `Any`
             * were 3 x 6.27 + 20 = **38.81px**, measured 38.8x44 at 320x568,
             * 375x667, 393x852 and 744x1133 with a computed `min-width: auto`.
             * They clear WCAG 2.5.8's 24px and not this project's 44.
             *
             * `NumberFilter` above has carried both declarations all along and
             * is 44x44; this is that line, in the two places it was missing.
             * It costs 5.19px each and no height at all: the first filter row
             * is 618.7px of content at 720px and up, and 629.1 still fits the
             * 704 an iPad mini gives it, so the wide band stays 170.
             *
             * RE-MEASURED AT 320, WHERE THE WORRY WAS THAT A ROW WOULD WRAP:
             * it does not, and it cannot anywhere. 320 draws the *compact*
             * arrangement - `compact` is true for every width at or below 719
             * - so the 278px four-row block this file's header describes does
             * not exist at that width any more; what draws is the 62px head
             * plus, once the door is opened, a fold whose first row is these
             * two `Segmented` groups wrapping inside 296px of content
             * (320 less the phone root's 2x12). Owned is 173.51px after the
             * change and Type is 239.4, and 173.51 + 8 + 239.4 = 420.91
             * against 296 - so that row was already two lines before the
             * change, at 410.53, and is two lines after it. The domain row
             * repacks identically: `All` at 40.81 and at 44 both leave line 1
             * as `My domains · All · Arcana · Blade` at 290.48 and 293.67 of
             * 296. Nothing gains a line at 320.
             *
             * And nothing gains one at any other width either, which is worth
             * writing down as an interval rather than as four spot checks. The
             * compact fold flips from one line to two somewhere in
             * 410.53 < content <= 420.91, i.e. a phone 435 to 444 CSS pixels
             * wide; the wide row 1 flips in 618.53 < content <= 628.91, i.e. a
             * window 659 to 668 wide - and that window is below 720, so it
             * never gets the wide arrangement in the first place. The two
             * bands where the 5.19px could have cost a line are a width no
             * phone in the sweep has and a width the wide arrangement is never
             * drawn at.
             */
            minWidth: 'var(--control)',
            padding: '0 10px',
            background: value === v ? 'var(--raised)' : 'transparent',
            color: value === v ? 'var(--text)' : 'var(--muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
