/**
 * The four tracks plus the incoming-damage calculator - and, under them, the
 * one or two a CLASS grants.
 *
 * "Someone hit you for 14 - how many HP is that?" is the question the sheet has
 * to answer instantly, because the alternative is three people doing mental
 * arithmetic while the scene waits. Type the number and the app reads the
 * ladder, shows what marking an Armor Slot would save, and applies it on
 * confirm. It proposes; the player commits.
 */
import { useState } from 'react';
import { applyDamage, markDamage, SEVERITY_LABEL } from '../../engine/damage.ts';
import type { DerivedStats } from '../../engine/character.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Counter } from '../shared/Counter.tsx';
import { ClassTracks } from './ClassTracks.tsx';
import { CompanionPanel, useHasCompanion, WhoSwitch, type Who } from './Companion.tsx';
import type { Arming } from './attack.ts';
import { ActiveConditions } from './Conditions.tsx';
import { DeathMoveOffer } from './DeathMove.tsx';

interface Props {
  stats: DerivedStats;
  layout: 'desktop' | 'phone';
  /**
   * Render the conditions strip and the death-move offer alongside the tracks.
   *
   * The phone says no and places them itself: the counters are the second thing
   * on the sheet and the conditions strip is set once a scene rather than once
   * a turn, so it sits far below them; the death-move offer leads the whole
   * column, because when it appears it is the most important thing on the
   * screen and nothing on Play is pinned any more.
   */
  showState?: boolean;
  /**
   * Drop the `.panel` box around the four tracks. Phone only.
   *
   * Not "draw less": the same children in the same order, without the border,
   * the background and the 8px of padding - 18px of the column, spent on a box
   * around four silhouettes that are already distinguishable from each other by
   * shape. The rows keep their own 6px gap, because that gap is the spacing
   * between the counters and not the padding of the panel; letting the parent
   * column's gap take over would make the four tracks four siblings of the
   * defence band rather than one object.
   *
   * A `part` prop used to live here, splitting this component in two so the
   * phone could pin the tracks and leave the calculator in the scroll. It was
   * already dead when it was deleted: nothing in `src/` had passed it since the
   * phone stopped mounting this twice, and now nothing on Play is pinned at
   * all.
   */
  bare?: boolean;
  /**
   * The roll's arming, forwarded to the companion panel and used nowhere else
   * here.
   *
   * A companion's attack is declared from the companion's own panel rather than
   * from `Equipped`, and that is the point of threading it this far: the player
   * switched to COMPANION because they are operating the animal, and sending
   * them to another section to arm its bite would split one action across two
   * places.
   *
   * Optional because the tests mount this component and `CompanionPanel` on
   * their own, and for no better reason than that. Every place in `src/` that
   * draws it - both of them, in `Play.tsx` - passes it. The first version of
   * this note claimed the GM's board and the print preview mount it without a
   * roll; neither mounts it at all.
   */
  arming?: Arming;
}

export function Vitals({
  stats,
  layout,
  showState = true,
  bare = false,
  arming,
}: Props): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const hasCompanion = useHasCompanion();
  const [who, setWho] = useState<Who>('you');

  if (!character) return null;

  const phone = layout === 'phone';

  const panelClass = bare ? 'stack' : 'panel stack';
  const panel = {
    flex: 'none' as const,
    padding: bare ? 0 : phone ? 8 : 12,
    gap: phone ? 6 : 10,
  };

  // A companion is a second creature, not a second screen: it takes over this
  // panel - same space, same thumb arc - behind one segmented control.
  /*
   * Both rows sit outside the panel because they belong to the character
   * rather than to the tracks: the companion switch swaps what this panel is
   * about, and a player who is Restrained - or whose last Hit Point is marked -
   * must not lose that the moment they look at their wolf.
   */
  const state = showState ? (
    <>
      <ActiveConditions />
      <DeathMoveOffer />
    </>
  ) : null;

  /*
   * The companion switch belongs to the counters.
   *
   * It used to be gated on `part`, because the phone mounted this component
   * twice and the switch rendered inside both - so a Ranger with a wolf got two
   * of them on one screen, each with its own idea of who was being looked at.
   * There is one mount now, so the gate is the companion and nothing else.
   */
  const companionSwitch = hasCompanion;

  if (companionSwitch && who === 'companion') {
    return (
      <>
        {state}
        <div className={panelClass} style={panel}>
          <WhoSwitch who={who} setWho={setWho} compact={!phone} />
          <CompanionPanel stats={stats} layout={layout} arming={arming} />
        </div>
      </>
    );
  }

  return (
    <>
    {state}
    <div className={panelClass} style={panel}>
      {companionSwitch && <WhoSwitch who={who} setWho={setWho} compact={!phone} />}
      {/*
       * THE FOUR COUNTERS ARE A 2x2 GRID, AND BOTH LAYOUTS DRAW THE SAME ONE.
       *
       * This used to be a fork inside a fork. `counterStyle` chose numbers or
       * pips here on the phone, and the cockpit below was hard-wired to four
       * `<Track>` rows the preference never reached at all. Decision 7 deletes
       * every branch of both: the pip tracks leave the player's own sheet on
       * every layout and survive only where you are reading somebody else's
       * state rather than marking your own - the GM's party board, the live
       * scene and the companion panel.
       *
       * WHY, IN TARGETS. A pip is a target, and the height it was drawn at came
       * from a literal here - `phone ? 44 : 32` - which beat `--pip-h`, the
       * token that resolves to the 44px floor on any machine with a coarse
       * pointer at all. Measured in Chrome at 1180x820, 1280x800, 1440x900 and
       * 1440x695, the cockpit's four tracks were 29 targets 32px tall: HP 32x32
       * x11, Stress 40.2x32 x9, Hope 56.8x32 x4, Armor 25.6x32 x5. Which floor
       * they missed depends on the machine, and both readings are worth having:
       * on a mouse-only desktop `--pip-h` is 34 and 32 was two under it - which
       * is what the shipped audit's `android-play-pips-1280x800` counts as 30
       * sub-floor targets at a tap floor of 34 - and on any machine with a
       * coarse pointer the token is 44 and 32 was twelve under. The phone's own
       * pips cases in that audit run 16 to 20 sub-44 targets between 320 and
       * 448px wide, 11 at 540 and 0 from 640 up, where a full-bleed row is wide
       * enough that every pip clears the floor on width too. This block now
       * draws twelve targets - a value and two steppers per cell - and every
       * one of them is 44x44 or larger, in both directions, for the first time.
       *
       * THE PHONE'S BLOCK IS 186, AND IT IS THE ONE THING THIS REFLOW BUYS
       * RATHER THAN SELLS. Numbers were already the default: 2x44 plus one 6px
       * gap was **94px**, against 194 for four full-width rows. The cell is
       * `--counter-cell` now - 90 from viewport 390 up, 56 below - so this
       * block is **186** on the owner's phone and **118** on a 360px Android,
       * and what the 92 buys is a 38px value where it was 22, on its own line,
       * with the maximum under it. Everything below this block moves down by
       * that much, and `Play.tsx`'s budget pays for it out of the four folds it
       * pairs two-up. (It was 102 and 94 for one commit, when the cell was 48
       * and the eight pixels were exactly what the defence band above had just
       * returned; that is where "the block grows upward and its lower edge does
       * not move" came from, and the card ended it.) What is deleted is the
       * reachable 194px shape, which was the single dearest state the Play
       * budget could not see. A cell is (glass - 24 - 6) / 2 - 181.5 at 393 and
       * 172.5 at 375 - of which 88 is the two steppers and 2 the card's own
       * border, with no gutter inside it at all, so the value target is 91.5
       * and 82.5 wide. `Counter`'s own docblock carries what the narrow one
       * costs.
       *
       * THE COCKPIT IS REDRAWN, AND IT IS THE ONE PLACE PIXELS MOVE. The block
       * was 428x245: `.panel` border 2, padding 12 twice, three 48px track rows
       * (a 10px `.t-label`, its 6px margin, a 32px pip row), three 10px panel
       * gaps, and 45 for the damage box below (1px hairline, 10px of padding,
       * `--control` at 34). It is **428x211** - 2 + 24 + 62 + 6 + 62 + 10 + 45 -
       * so **34px go back** to `DualityRoll`, the only other child of that
       * column, which is `flex: 1, minHeight: 0, overflow: hidden` and is the
       * panel this repo has already measured crushed to 45px at 744x1133.
       *
       * (It was 428x183 and 62px back for one pass, while the cockpit still
       * drew the two-line row in a 48px cell. The card takes 28 of those 62
       * and the reason is the next paragraph.)
       *
       * ONE SHAPE NOW, AND THE 28 IS WHAT IT COST. The owner asked for the two
       * layouts to agree - «va uniformato con lo stile del mobile per coerenza»
       * - and named the thing they were rejecting: «non con più e meno affianco
       * alla statistica», which is exactly what the two-line row was. So there
       * is no `tall` prop and no second branch in `Counter`; what is left of the
       * difference lives entirely in `tokens.css`, which steps `--counter-cell`
       * to 62 and `--counter-num` to 26 at 1180.
       *
       * THE PHONE'S OWN 90 WAS THE OTHER OPTION AND IT WAS REFUSED, WITH THE
       * ARITHMETIC. At `--counter-cell: 90` the block is 186 against 102 and the
       * panel 428x267, so **84** come out of `DualityRoll` rather than 28.
       * Against the panel clients recorded at `DualityRoll.tsx:2100` that puts
       * ROLL at painted 0 of 54 at 1180x695 and 1366x768 in both banner states,
       * and at 1280x800 with the backup banner up - a default state of a fresh
       * install. It is a scroll rather than P2-1's unreachable ROLL, because the
       * panel is `.scroll` now. What refuses the 90 is therefore not the scroll
       * but what the 84 would buy: the owner asked for the mobile STYLE, and the
       * style is the shape - the card, the steppers at the outer edges, the
       * number on a line of its own - not the height a thumb at arm's length
       * needs and a mouse at desk distance does not. A height nobody at desk
       * distance asked for buys nothing, so no price for it is cheap. That is
       * still the answer, and it is the answer for all thirteen classes.
       *
       * THAT SCROLL HAS SINCE BEEN SPENT AS BUDGET - ONCE, DELIBERATELY - AND
       * THIS PARAGRAPH USED TO DENY IT COULD BE. It read *"that scroll was
       * argued as the floor beneath a fit, not as budget"*, and the sentence
       * stopped being true the day `ClassTracks` shipped: the owner spent
       * exactly this scroll on the Focus/Favor row that draws below the grid.
       * The bill is **56px** of the middle column - a 46px strip and this
       * panel's 10px gap - and every one of them comes out of `DualityRoll`,
       * which goes 428x404 -> 428x348 while this panel goes 428x211 -> 428x267.
       * Measured at 1180x695 with the dice fold open and a roll on the glass,
       * ROLL goes from painted **54 of 54** - whole, in that state, before the
       * row existed - to **7.3 of 54**, and reaching it is a scroll:
       * `reachable: true`, `hardClips: []`. That is a state and not a verdict on
       * the viewport; `ClassTracks`'s own four-viewport table measures the same
       * 1180x695 idle, where the panel was already scrolling and the reading is
       * 26.1 -> 0.
       *
       * AND THE TWO COST THE PANEL THE SAME 56, WHICH IS WHY THE PRICE CANNOT BE
       * WHAT SEPARATES THEM. The 90px cell would make this panel
       * 2 + 24 + 90 + 6 + 90 + 10 + 45 = **428x267**; the 62px cell with the
       * tracks row under it makes it 211 + 46 + 10 = **428x267**. Identical, to
       * the pixel, and `DualityRoll` loses the identical pixels either way. (The
       * **84** above is the same option measured from the other end - against
       * the 102 the pre-card 48px cell made, which is the baseline ONE SHAPE NOW
       * quotes its 28 against.) So the ledger that decided this is the other
       * side of it, and it has two entries.
       *
       * WHAT THE 56 BUYS, AND WHO IS BILLED. The row is the only way to spend
       * Favor on the desktop - it is drawn on no other screen - so refusing it
       * is a control that does not exist, set against a control that has to be
       * scrolled to. And it is charged to the sheets that were given the
       * feature: **2 classes of 13** grant it - Warlock by a class feature and
       * Brawler on one of its two subclasses - and the other eleven never see
       * the row or pay a pixel for it unless a player multiclassed into one of
       * the two, which is the sheet asking for the track by name. The 90px cell
       * has neither entry - it buys no capability at all, and it bills every
       * sheet in the app for a height that answers a thumb this layout does not
       * have.
       *
       * SO, FOR THE NEXT THING THAT WANTS HEIGHT HERE, IN BOTH DIRECTIONS. The
       * roll panel's scroll is spendable and has been spent, so it is not a
       * floor that may never be touched; it is also not a pool, and what bought
       * those 56 was a capability available nowhere else, paid for by the two
       * classes that receive it. Height for its own sake stays refused at every
       * viewport and for every class.
       *
       * WHAT A COCKPIT CELL IS. The middle column is `minmax(360px, 428px)` and
       * takes its 428 at every width the cockpit is drawn at: 1180 less 40 of
       * root padding and 36 of gaps is 1104, less column one's 336, leaves 340
       * for the `1fr`. Inner width is 428 - 2 - 24 = 402, so a cell is
       * (402 - 6) / 2 = **198** and the value target is 198 - 44 - 44 - 2 =
       * **108x62** - the card deleted the two 4px gutters and put its own 1px
       * border in their place, so the number gained six pixels of width in the
       * same cell. Less `padding: var(--counter-pad) 9px` that is 90px of room,
       * the same 90 the two-line row had, against a widest stacked line of `11`
       * at `--counter-num`'s 26. The three lines are 3 + 13 + 2 + 26 + 2 + 10 + 3
       * = 59, 61 with the border, in the 62 the token declares. (`65.63` for
       * `11 / 11` on one line was the retired row's measurement at 1280x800 with
       * the `wizard10` fixture; stacked, the widest line is shorter and the
       * height is what is tight instead.) The steppers stay at `Counter`'s 44 of
       * width rather than following `--control` down to 34, for the reason
       * `tokens.css` gives beside `--pip-h`: a touchscreen laptop at 1180px and
       * up reports `pointer: fine` with a finger on the glass.
       *
       * READ VERSUS TOUCH, AND WHAT THE COCKPIT LOSES. The readout stops being
       * a 32px silhouette read as a shape and becomes two digits at 800
       * `--counter-num` Archivo - 26px here, because `tokens.css` sets the
       * token back to 26 at 1180 after the phone's steps at 380 and 390, which
       * a cockpit width also answers and which would otherwise draw it at 38 -
       * with the 13px mark still saying which track it is. Three
       * things go with the pips and none of them is hidden: a pip row sets any
       * value in one click where a number is one `+` per point or three
       * gestures; the press-and-hold that cleared a track has no `Counter`
       * equivalent; and the words MARKED, AVAILABLE and USED survive only
       * inside `Counter`'s accessible name. All three were already lost on the
       * phone when numbers became the default, so this makes the cockpit match
       * rather than inventing a third compromise.
       *
       * The height argument that used to sit on the deleted `rowHeight` line is
       * still the constraint and is kept here: on a desktop the mouse is
       * precise and the vertical budget is not - a 1440x695 laptop viewport is
       * the real one, not the 900px mock - which is why this block giving 34px
       * back matters more than the two it costs the panel's width. (**70** stood
       * here for the height this block gave back before the card: the paragraph
       * that derives it came down to 62 and then to 34 and this line was left
       * behind, so it is the derivation above and not this number that was ever
       * checked.)
       */}
      {/*
       * `minmax(0, 1fr)` AND NOT `1fr`, WHICH IS TWO WORDS AND A DEFECT.
       *
       * A bare `1fr` is `minmax(auto, 1fr)`, and the `auto` minimum is the grid
       * item's own min-content - which for a `Counter` card is 44 + 44 of
       * steppers, 2 of border and the value button's own min-content, and that
       * last term is the label line: measured in Chrome, `STRESS` behind its
       * 13px silhouette makes the right-hand track 165.81 and `3 / 11` makes
       * the left one 153.56. (Those two were measured before the card took the
       * two 4px gutters out; what they bound is unchanged, and the floor below
       * is re-measured.) So the
       * grid's minimum was **325.37 whatever the viewport was**, and its right
       * edge sat at a constant x = 337.37 while the column's clip edge came in
       * behind it: 17.4px of the 44px `+` on STRESS and ARMOR was off the glass
       * at 320, and `overflowX: 'hidden'` on the column means no gesture of any
       * kind brings it back - on the screen whose whole job is marking damage.
       * A tenth marked Hit Point widens the HP track 12.5px and moves the first
       * crossing from viewport 337.4 up to 349.9, which drags a 344px Z Fold
       * cover screen into it.
       *
       * Both halves are needed and neither is enough. `minmax(0, 1fr)` floors
       * the *track*; `minWidth: 0` on `Counter`'s own root floors the *item*,
       * which otherwise keeps its automatic minimum and overflows the track it
       * was given. With both, the shortfall lands on the value button - which
       * already declares `minWidth: 44` and `overflow: hidden` for exactly this
       * - so what is lost is the tail of a label inside a target that keeps its
       * size, and never a target. Re-measured through the rig against the card:
       * the grid's right edge is the column's at every width, the two steppers
       * stay 44 wide and on the glass down to viewport **298**, and the value
       * target is 75 wide at 360 and 55 at 320. (310, 69 and 49 were the
       * gutters' arithmetic; the card deleted them and moved the floor twelve
       * pixels down.)
       */}
      <div
        style={{
          flex: 'none',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 6,
        }}
      >
        {
          /*
           * Sheet order, not frequency order.
           *
           * These used to run Armor, HP, Stress, Hope, argued from how often
           * the game makes you touch each one, with Hope last so its pips sat
           * against the Experience chips that spend them. Both halves of that
           * argument have expired: nothing on Play is pinned, so "nearest the
           * thumb" is not a position this band has to allocate, and the chips
           * are now several hundred pixels below, beside ROLL.
           *
           * What is left is the paper sheet, where Hit Points and Stress sit
           * directly under the damage thresholds and Hope follows them. Armor
           * Slots come last here because they are the one counter that is not
           * yours but your armour's, and the Active Armor row that says where
           * they came from is the very next section on the screen.
           *
           * In a 2x2 grid that order is read across and then down - HP and
           * Stress on the top row, under the thresholds that are read against
           * them; Hope and Armor beneath. The cockpit used to read it top to
           * bottom with Hope and Armor sharing a `1fr 148px` row; it reads the
           * same four in the same order now, in the same shape as the phone.
           */
          (['hp', 'stress', 'hope', 'armor'] as const).map((kind) => {
            const counter =
              kind === 'hp'
                ? character.hp
                : kind === 'stress'
                  ? character.stress
                  : kind === 'hope'
                    ? character.hope
                    : character.armorSlots;
            const label = kind === 'armor' ? 'ARMOR' : kind.toUpperCase();
            const write = (v: number): void =>
              update((c) => {
                const key = kind === 'armor' ? 'armorSlots' : kind;
                return { ...c, [key]: { ...c[key], marked: v } };
              });
            return (
              <Counter
                key={kind}
                kind={kind}
                label={label}
                labelColor={kind === 'hope' ? 'var(--hope)' : undefined}
                value={counter.marked}
                max={counter.max}
                onChange={write}
              />
            );
          })
        }
      </div>

      {/*
       * Focus and Favor, in a row of their own under the four.
       *
       * UNDER, and not two more cards in the grid above: those tracks are
       * `minmax(0, 1fr)` over items whose min-content is 44 + 44 of steppers,
       * so a fifth and sixth card is one wrap and the four that were already
       * there pay for it in width. A row of its own costs them nothing -
       * measured at 393, the grid is 369x186 at the same x and y whether this
       * draws or not.
       *
       * HERE AND NOT IN `Play.tsx`, which is one insertion instead of two: the
       * cockpit and the phone both mount this component, so both get the row
       * from one line, and the companion branch above returns before it - a
       * wolf has no patron.
       *
       * It renders NOTHING for a sheet with neither track - which is eleven of
       * the thirteen classes this dataset ships outright, plus every Brawler who
       * did not take the Martial Artist subclass, and all nine of the older
       * one's - so this line costs the general sheet no pixel and no gap.
       * What it costs a sheet that HAS one is 52px of column on the phone (a
       * 46px strip and this panel's 6px gap) and 56 in the cockpit (the same
       * strip and its 10), and in the cockpit those 56 come out of
       * `DualityRoll` below: measured, the panel goes 428x211 -> 428x267 and
       * the roll panel 428x404 -> 428x348, which is a `.scroll` and was 404 of
       * a fit rather than a floor. That is not free - at 1180x695 it takes
       * ROLL from painted 26.1 of 54 to 0, reachable by scrolling that panel -
       * and `ClassTracks`'s own docblock carries that reading in full, with the
       * thumb-arc numbers and the two-state proof.
       */}
      <ClassTracks />

      {/*
       * The calculator, on the layout that still keeps it here.
       *
       * On a phone it has moved into the defence band, beside the two
       * thresholds it is read against - see `IncomingDamage` below. On the
       * desktop the cockpit's middle column has the room and the band is in a
       * different column entirely, so it stays where it was, unchanged, under
       * the same hairline.
       */}
      {!phone && <IncomingDamage stats={stats} layout="desktop" />}

    </div>
    </>
  );
}

/**
 * "Someone hit you for fourteen - how many Hit Points is that?"
 *
 * A number in, a verdict and a commit out. It proposes; the player commits. It
 * is the one thing on the player's screen that writes Hit Points without being
 * a track you tapped, which is why it lives in one component with one copy of
 * the arithmetic rather than in two layouts that each work it out.
 *
 * WHY IT IS NOT IN THE COUNTERS ANY MORE. On a phone it was a 44px row plus a
 * 6px gap under the four tracks, and the thing it printed beside itself when
 * idle was `8/16` in 10px grey - the damage ladder, restated in the smallest
 * type on the screen, because the box needed the ladder and could not see it.
 * The ladder is two 32px numbers in the defence band, first on the sheet since
 * the identity block left it, where "threshold bene in vista" put them. So the
 * box goes there: the number you were just told and the two numbers you read it
 * against are now one glance, and the restatement is deleted rather than
 * duplicated.
 *
 * "One glance" is a distance, and it has been three different ones. Under
 * `flex-end` it was `viewport - 249.27` from SEVERE's right edge to the
 * field's left - 143.73 at 393, 494.73 at 744, 929.73 at 1179 - so it was fixed
 * at no width at all. `flex-start` made it 103.20 everywhere from 353 up, and
 * that lasted until the band closed its own hole: with the three readout tracks
 * flexible and this one `auto`, the slack is inside the readouts instead.
 * Measured now, SEVERE's cell edge to the field: **118.47 at 393**, 119.12 at
 * 375, 112.8 at 360, 235.47 at 744, 380.45 at 1179. On a phone that is one
 * glance and the sentence holds; on a tablet it is a third of what `flex-end`
 * left and it is not fixed. The paragraph below headed WHERE THE BOX SITS has
 * the derivation, what one word changed, and what the template changed back.
 *
 * IT COSTS THE COLUMN NOTHING, WHICH IS THE PART WORTH CHECKING. This is drawn
 * on a phone only - `Play.tsx` passes `damage` and `tight` in the same tag and
 * the cockpit's `<Defenses>` has neither - so the row it rides in is the tight
 * one: 4 + 10 label + 4 + 32 number + 4 + 2 border = **56px** tall, and the 64
 * this said is what the cockpit's 8s make. This is a 44px field, vertically
 * centred: 44 in a row whose height is already 56, six real pixels of clearance
 * top and bottom. The band does not grow for it, the counters lose 50, and the
 * whole move is a saving of exactly the row it used to be. Measured in Chrome at
 * both widths, with the shipped fonts, in `Defenses`'s own note.
 *
 * `door` IS THE CONDITIONS, AND IT TOOK THE CAPTION'S PLACE RATHER THAN A CELL
 * OF ITS OWN. Decision 3 of the reflow needs a permanent 44x44 way into
 * `ConditionsDialog` somewhere that costs the column no height, and the identity
 * class row that used to hold it is being deleted. A sixth grid track does not
 * fit - measured, the four number cells come to 210.47 at their content width
 * and four 6px gaps are 24, so a fifth cell of 44 + 6 + `--damage-w` is 94
 * below viewport 390 and 114 from 390 up, and a sixth of 44 behind a fifth 6px
 * gap takes 398.47 of column against 369 at 393px and 378.47 against 336 at
 * 360 - so the door goes *inside* the fifth cell, and what it replaces is the
 * visible word `TOOK`.
 *
 * CONTENT WIDTH IS THE RIGHT FIGURE FOR THAT SUM AND IS NOT WHAT THE FOUR ARE
 * DRAWN AT. Under `auto repeat(3, minmax(min-content, 1fr)) auto` only
 * EVASION's track is `auto`; the middle three are flexible and take a share of
 * whatever the band has over 210.47, so at 393 they are painted wider than
 * their contents - which is exactly why PROF's digits land 80 to 348px from
 * the field in the table below rather than at one fixed offset. 210.47 is the
 * floor, and the sixth track does not fit even against the floor.
 * (`229.63` and `391.63`
 * stood here, and `Defenses`'s own width budget in `Play.tsx` and
 * `playSheet.test.tsx`'s «the width this sheet is laid out for» have carried
 * 210.47 and 398.47 since the padding came down to 6. `the four **auto** cells`
 * stood here too; it was true of `auto auto auto auto 1fr`, and 3dff11f closed
 * the band's hole by making the middle three flexible and the fifth `auto`, so
 * it has been true of EVASION alone since.)
 *
 * WHICH IS A REAL LOSS AND IS THE ONLY ONE. The field's visible identity is now
 * its `14` placeholder and its position beside the thresholds; its accessible
 * name is unchanged at "Incoming damage", so a listening player loses nothing.
 * The alternative was keeping a 27.2px caption and giving up the door, and the
 * door is a control while the caption is a label for a control that already has
 * a name.
 *
 * AND THE CELL WRAPS RATHER THAN OVERFLOWING, WHICH IS WHAT MAKES IT SAFE AT
 * 320. Both children are `flex: none` - 44 for the door, `--damage-w` for the
 * field - in a track that is `auto` since the band closed its hole, so it is
 * exactly the pair and nothing else. Measured in Chrome, `played` fixture:
 * **114** from viewport 390 up, where the field is 64, and **94** below it,
 * where the field is 44 - at 393, 744, 852 and 1179 alike, because an `auto`
 * track does not grow with the column. At 320 the row has 66.38 to give it, so
 * the field wraps under the door and the band is 94 tall instead of 56. Without
 * `flexWrap` the row's `justifyContent` and `minWidth: 0` sent the shortfall
 * *leftwards*, out of the cell, across the grid gap and onto the Proficiency
 * number a player reads under pressure - measured at 27.2px of overlap at 320
 * and 2.8px at 360 before the commit that added the wrap.
 *
 * (`a `1fr` track whose width is `column - 234.47`: 134.53 at 393, 116.53 at
 * 375, 101.53 at 360, 85.53 at 344, 61.53 at 320` stood here, and every number
 * of it went when the fifth track became `auto`. The paragraph before it had
 * already been corrected once, from a `242.47` that disagreed with three of its
 * own five entries. A constant carried in two files is a constant that will
 * disagree with itself; this one now lives where it is drawn.)
 *
 * WHERE THE BOX SITS INSIDE THE BAND, AND THE ANSWER MOVED AGAIN WITH THE
 * TEMPLATE. The pair inside this cell was `justifyContent: 'flex-end'` in a
 * `1fr` track that took the whole remainder of the column, so it was pinned to
 * the far right edge: `PlayPhone` is not phone-only - `Play.tsx` returns it for
 * `layout !== 'desktop'`, which is every viewport up to 1179 - and the column
 * has no `maxWidth`, so at 744 the box sat half a screen from the numbers it is
 * read against. `flex-start` here fixed that by holding the pair against the
 * left of its own track, and while the track was the flexible one that put the
 * box 103.20px past the PROF cell at every width from 353 up.
 *
 * THAT IS NO LONGER WHAT HAPPENS, AND IT IS NOT THIS FILE THAT CHANGED. The
 * band is `auto repeat(3, minmax(min-content, 1fr)) auto` now, so the flexible
 * tracks are the three readouts and this one is its own content. `flex-start`
 * still holds the pair at the left of a track that is exactly 114 wide, and the
 * slack went to MAJOR, SEVERE and PROF, whose numbers are drawn at the LEFT of
 * their own stretched cells. Measured, `played` fixture, from the right edge of
 * PROF's digits to the left edge of the field:
 *
 *   viewport 360   80.37     viewport 744    203.05
 *   viewport 375   86.70     viewport 852    239.05
 *   viewport 393   86.05     viewport 1179   348.05
 *
 * So the phone is where the fix intended and the tablet is not: 348 of dead
 * space at 1179 against the 826.53 the flex-end shape had, and against the
 * 103.20 this paragraph promised at every width. It is a third of the old
 * defect rather than the end of it, and it is recorded here rather than fixed
 * here, because the pixels are now in `Defenses`' template in `Play.tsx` and
 * moving them moves four numbers to place one box - which is the trade the
 * paragraph above refused. Nothing on a phone moved: at 393 it is 86.05.
 *
 * ERGONOMICS. Derived at four viewports rather than one, because the geometry
 * of this move is not the same in portrait as it is on a rotated phone, and the
 * paragraph that only did 393x852 read the tablet case backwards.
 *
 * The reference sweep this project uses is a 95th-percentile right thumb of
 * about **330px** from the bottom-right pivot - `Play.tsx`'s ROLL note is where
 * that number is argued - and the pivot is taken at `(viewport - 20, height -
 * 40)`. The pair was at door x246.47-290.47, field x296.47-340.47 at **every**
 * width from 353 up, because it sat at the left of the flexible track; before
 * that it was door `viewport-106` to `viewport-62`. Neither is where it is. The
 * fifth track is `auto` since the band closed its hole, so the pair sits at the
 * right-hand end of a band whose three middle tracks now take the slack:
 * measured in Chrome, door x267 at 393, x618 at 744, x726 at 852 and x1052.98
 * at 1179, all y67-111. Reach from those rects, pivot as above:
 *
 *                        door before -> flex-start -> NOW    field now
 *   393x852, one hand     729.8 ->  734.5 ->  727.9          723.4
 *   852x393, two hands    275.5 ->  365.5 ->  277.0          265.1
 *   780x360, two hands    243.6 ->  342.0 ->  245.8          232.2
 *   744x1133, two hands  1010.0 -> 1038.2 -> 1007.5         1004.3
 *
 * The two-handed rows are the *nearest* thumb of the two. The middle column is
 * the shape this paragraph was written about and it lasted one commit: the band
 * template took the flexibility out of this track, and every landscape and
 * tablet number went back to within 2.3px of where flex-end had it.
 *
 * **Thumb arc:** in portrait nothing happens - 1.9px on the door and 3.7 on the
 * field against the shape before either change, and the band is 2.2x outside
 * the sweep in all three because this row is the first thing in the column. The
 * landscape cost this paragraph recorded as "the price of the whole change" is
 * not being paid any more: at 852x393 the nearest thumb has the door at 277.0
 * where flex-start put it at 365.5, back inside the 330 sweep it had been
 * pushed 35px outside of. The tablet is the same story - 1007.5 against
 * 1038.2 - and both are three times the sweep either way, so the honest reading
 * there is still that it is a reading change and not a reach change.
 *
 * WHICH MEANS THE ARGUMENT BELOW IS NOW ABOUT A LAYOUT THIS FILE NO LONGER
 * DECIDES. `flex-start` still holds the pair at the left of its own track and
 * is still right; what it no longer does is move the box away from the far edge
 * of the band, because the box's track is exactly the box. Read the paragraph
 * below as the record of why the word is there, not as a claim about where the
 * field is drawn at 744.
 *
 * The trade was taken because the other side of it was 499.53px at 852 and
 * 826.53px at 1179 of dead space between the last number read and the box the
 * answer goes in - it is 239.05 and 348.05 now, measured, because the band's
 * template took most of that space back into the three readout cells - and
 * because both controls here are deliberate rather than habitual - the field opens a numeric keypad over the sheet, the door opens a
 * dismissable modal. Neither is the verb a thumb comes back to; that is ROLL,
 * at the bottom, and it does not move. Capping the column, which is the other
 * proposal on the table, does not recover any of the landscape reach: under
 * `flex-start` the pair sits against the PROF cell whatever the column's width
 * is, so a cap only shortens the dead space to the *right* of the field.
 *
 * **Target size:** the door is 44x44 at every width; the field is 44x44 below
 * viewport 390 and **64x44** from 390 up, where `--damage-w` takes width the
 * band's closed hole freed. The row they ride in is **56** on a phone since the
 * readout cells' padding came down to 4, and 64 in the cockpit. Nothing shrinks
 * and nothing wraps that did not wrap before: the wrap threshold is the pair's
 * own width against its track and `justify-content` does not enter it. (This
 * said "44x44 field, in a 64px row, at every width" for two commits after both
 * halves of it moved.) **Read versus touch:** the band reads left to right -
 * Evasion, then the two thresholds, then Proficiency - and the box is the one
 * thing in it you touch. Putting it immediately after the numbers is that order
 * without a hole in it; pinning it right put up to 826.53px of nothing between
 * the last number read and the field the answer is typed into, and the band's
 * own template has since put 348.05 of it back at 1179 - see the table above,
 * which is the one place that number lives.
 *
 * WHAT APPEARS WHILE YOU ARE TYPING, AND WHY IT IS A SECOND ROW. `ARM` and the
 * commit chip need about 170px between them and this cell is 114 wide at 393 -
 * it was 126.53 when it was the flexible track, and it has been smaller than
 * that pair at every width it has ever had. So the verdict spans the band
 * underneath, and the band grows by the height of that second row for exactly
 * as long as there is an unconfirmed number in the box. That is the one state
 * on this screen that moves what is below it, and it is the state where what is
 * below it is not what you are looking at: the field, the ladder and the button
 * you are about to press are all above the line that grew.
 *
 * (This said "the band is 120 instead of 64". Both terms have moved - the
 * phone's band is 56 - and the typed state is the one thing in this docblock
 * the rig has not driven, so it is left unnumbered rather than re-derived on
 * paper. Somebody with the harness open should type into the box at 393x852 and
 * write down what the band measures.)
 */
export function IncomingDamage({
  stats,
  layout,
  door,
}: {
  stats: DerivedStats;
  /** `band` is a pair of grid children for `Defenses`; `desktop` is one row. */
  layout: 'band' | 'desktop';
  /**
   * A 44x44 control to put at the head of the band's fifth cell. Band only.
   *
   * A `ReactNode` rather than a boolean because this component has no business
   * knowing what the conditions are: `Defenses` owns the decision that the
   * phone gets a door and the cockpit does not, and this owns the cell the door
   * has to fit in. It is also why the `ladderUnknown` return below is not a
   * bare `null` any more - with the door in here, returning nothing would leave
   * a sheet whose armor this build cannot read with no way into the conditions
   * at all.
   */
  door?: React.ReactNode;
}): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const massiveDamageRule = useApp((s) => s.prefs.massiveDamageRule);
  const [incoming, setIncoming] = useState('');
  const [useArmor, setUseArmor] = useState(0);

  if (!character) return null;

  const amount = Number(incoming);
  const available = character.armorSlots.max - character.armorSlots.marked;

  /*
   * The one question this panel cannot answer.
   *
   * Every verdict below is read off the damage thresholds, and the thresholds
   * are the armor's. When the sheet names armor this build does not have -
   * a `.dhchar` from a device with a homebrew layer, a QR from a newer bundle -
   * `deriveStats` says so with `unresolvedArmor` and falls back to the
   * unarmored ladder, which is a floor and not this character's numbers. Every
   * threshold real armor prints is higher, so answering from it would call a
   * Minor hit Major and have the player mark HP they did not take. So the
   * calculator stops asking for a number it cannot read: the tracks above are
   * still there to be marked by hand, which is what the table does anyway when
   * the app is not sure. A manual threshold override settles the thresholds by
   * itself - they are then a fact the sheet carries rather than a lookup - so
   * it puts the calculator back in business.
   */
  const ladderUnknown = stats.unresolvedArmor !== null && character.thresholdOverride === null;

  const preview =
    !ladderUnknown && incoming !== '' && Number.isFinite(amount)
      ? applyDamage(amount, stats, available, { armorSlots: useArmor, massiveDamageRule })
      : null;

  const commit = (): void => {
    if (!preview) return;
    update((c) => markDamage(c, preview));
    pushLog({
      kind: 'incoming',
      label: `${SEVERITY_LABEL[preview.severity]} · ${preview.hp} HP`,
      detail: preview.explanation,
    });
    setIncoming('');
    setUseArmor(0);
  };

  const field = (
    <input
      type="number"
      inputMode="numeric"
      value={incoming}
      placeholder={layout === 'band' ? '14' : 'damage'}
      aria-label="Incoming damage"
      onChange={(e) => {
        setIncoming(e.target.value);
        setUseArmor(0);
      }}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      style={
        layout === 'band'
          ? {
              // `--damage-w`: 44 at the touch floor below viewport 390, and 64
              // from 390 up, where the twenty over the floor are the band's own
              // spare width rather than anything taken from a neighbour. The
              // row is `auto repeat(3, minmax(min-content, 1fr)) auto`: EVASION
              // keeps its content width because its label is the longest of
              // the four, the other three
              // share what is left equally, and this cell is exactly the door
              // plus this field - so nothing is left over to sit as a hole at
              // the right-hand end, which is what it used to do at 45.4px wide.
              //
              // It was 44 - the floor in both directions - and before that 58.
              // `base.css` forces `max(16px, 1rem)` on any coarse pointer, so
              // three digits at 16px IBM Plex Mono are 28.8 plus 8 of padding
              // and 2 of border: 38.8, which fitted 44 and is not why 44 was
              // chosen. It was chosen because the door had to stand beside it
              // at 360, and it still does - measured at 360x800 the fifth cell
              // is 94 of a 336px row, exactly the door, the 6px gutter and this
              // field, and the three shared tracks are 50.78, 54.81 and 50.8.
              flex: 'none',
              width: 'var(--damage-w)',
              minHeight: 'var(--control)',
              padding: '2px 4px',
              textAlign: 'center',
              font: '600 12px/1 var(--mono)',
            }
          : {
              width: 84,
              minHeight: 'var(--control)',
              padding: '6px 8px',
              font: '600 15px/1 var(--mono)',
            }
      }
    />
  );

  /*
   * HOW HIGH THIS CHIP MAY COUNT, AND WHY THE NUMBER IS NOT ITS OWN.
   *
   * It used to cycle 0-1-2-3, stopping at `available` or at a literal 3, and
   * the engine has never spent more than one slot on one incoming damage. So a
   * player who tapped to `-3` read `-3` on the chip, read a verdict two rungs
   * lower than the one they were about to get, and marked one slot when they
   * committed - the screen offering a number the engine would refuse, on the
   * control that is reached for at the worst moment of a fight.
   *
   * The ceiling is `armorSlotsSpendable` off the outcome and nothing else,
   * which is what `damage.ts` asks every armor control to be built from: it is
   * already the cap in force, the slots left on the track and the rungs the
   * ladder can still fall, whichever runs out first. Reading it here means a
   * raised cap - Brace, Iron Will, I Am Your Shield - reaches this chip the day
   * the engine is told about it, with no second ceiling to remember.
   *
   * It is also why the chip is drawn from `spendable` and not from `available`:
   * armor the ladder gives nowhere to spend - a hit already at `none` - is not
   * an offer, and a chip that will not move when tapped is the same lie in a
   * quieter voice. `preview` is null only where nothing draws this anyway; both
   * layouts put it inside their `preview !== null` branch.
   */
  /*
   * TWO THINGS A TEST CANNOT SHOW YOU HERE, so they are written down instead.
   *
   * **No test in `tests/ui/` can tell this ceiling from a literal `1`.** Not
   * because the ceiling is one - it is `armorSlotsSpendable` off the outcome and
   * `damage.ts:58` requires exactly that - but because nothing in `src/` passes
   * `armorSlotCap`, so no reachable state makes `spendable` anything but the
   * default of 1. Mutating the cycle below to `n + 1 > 1` leaves this file's
   * tests green, and that is a gap in what can be proven from the UI rather than
   * a defect in what ships. The engine side *is* pinned, at caps of 2, 3 and 4
   * (`tests/engine/damage.test.ts`). What would make the UI side reachable is
   * the exception the rule itself names - *"unless an ability or domain card
   * says otherwise"* - which is unbuilt. Build that, and this becomes testable
   * here; until then, do not "simplify" the expression to the number it happens
   * to equal.
   *
   * **A stranded `useArmor` is possible and is harmless.** Marking armor pips
   * down to zero while a damage number is typed makes `spendable` 0, which
   * unmounts the chip and leaves `useArmor` at 1 with no control to clear it.
   * Nothing wrong reaches the screen: `applyDamage` clamps `used` to
   * `min(requested, 0)` and the verdict returns to the unreduced rung, and the
   * field's own `onChange` resets it. Recorded so the next reader does not spend
   * an afternoon proving it is a bug.
   */
  const spendable = preview?.armorSlotsSpendable ?? 0;

  const armor = spendable > 0 && (
    <button
      type="button"
      className="chip"
      /*
       * The band spells the name out because the band has no room to write it.
       * `ARM` and `−1` are the whole visible label there, and neither is a
       * sentence. The desktop keeps `USE ARMOR` as both, because it always has
       * and the cockpit is not what this pass is changing.
       *
       * The count carries its own plural and the verb is the one the tap really
       * does. It said "Marking 1 Armor Slots ... tap to change" - a plural for
       * a number that is one, and a choice for a chip whose only other state,
       * at a cap of one, is off.
       */
      aria-label={
        layout === 'desktop'
          ? undefined
          : useArmor > 0
            ? `Marking ${String(useArmor)} Armor Slot${useArmor === 1 ? '' : 's'} against ` +
              `this hit - tap to ${spendable > useArmor ? 'change' : 'clear'}`
            : 'Mark an Armor Slot against this hit'
      }
      onClick={() => setUseArmor((n) => (n + 1 > spendable ? 0 : n + 1))}
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        background: useArmor > 0 ? 'var(--armor)' : 'var(--raised)',
        color: useArmor > 0 ? 'var(--app)' : 'var(--muted)',
      }}
    >
      {useArmor > 0 ? `−${useArmor}${layout === 'band' ? '' : ' ARMOR'}` : layout === 'band' ? 'ARM' : 'USE ARMOR'}
    </button>
  );

  if (layout === 'band') {
    /*
     * The band says the armor is unreadable in the cells where MAJOR and
     * SEVERE would be, so there is nothing for this to add and no number it
     * could take. It used to say `ARMOR NOT IN THIS BUILD · MARK HP BY HAND`
     * a second time, one row below the first; on a phone that is 44px spent
     * repeating the sentence directly above it.
     *
     * The door is the exception, and it is why this is not `return null` any
     * more: it is the phone's only permanent way into `ConditionsDialog`, and
     * a sheet whose armor this build cannot read is not a sheet that stops
     * being able to be Restrained.
     */
    if (ladderUnknown && door === undefined) return null;
    return (
      <>
        {/*
         * Three declarations, and each one answers a different question. See
         * the docblock above for the arithmetic behind all three.
         *
         * `flexStart` puts the door and the field against the left of their
         * own track. It was `flex-end` in a track that took the whole remainder
         * of the column - 920.53px wide at 1179 - which is what put the box the
         * whole width of a tablet away from the ladder it is documented to be
         * read beside. The track is `auto` now and measures 114 at 393 and at
         * 1179 alike, so this declaration decides nothing at the right-hand end
         * any more; it decides where the pair sits after a wrap.
         *
         * `flexWrap` is load-bearing and stays: both children are `flex: none`
         * - 44 for the door, `--damage-w` for the field - inside a track that
         * measures 66.38 at 320, so without a wrap the 27.62px that do not fit
         * leave the cell, to the left over the PROF panel under the old
         * `flex-end` and to the right under the column's `overflowX: 'hidden'`
         * now. Either way one of two 44px targets is damaged. With the wrap the
         * field drops under the door and the band is 94 instead of 56: measured
         * at 348x800 it is 56 and at 347x800 it is 94, so the crossing is 348
         * and not the 353 this said while the fifth track was the flexible one.
         *
         * `minWidth: 0` also stays, and it is doing less than it looks. It is
         * what lets this grid item fall under its own min-content; with the
         * wrap in place that min-content is one 44px item rather than the whole
         * pair, and measured the track is 46 wide at 298 and 45.5 at 297 - it
         * goes under 44 a pixel or two below that, well outside the supported
         * range. It is a floor against the next child added here, not a live
         * declaration.
         */}
        <div
          className="row"
          style={{ gap: 6, justifyContent: 'flex-start', minWidth: 0, flexWrap: 'wrap' }}
        >
          {door}
          {!ladderUnknown && field}
        </div>
        {preview !== null && (
          <div className="row" style={{ gridColumn: '1 / -1', gap: 6 }}>
            {armor}
            <button
              type="button"
              className="chip"
              onClick={commit}
              style={{
                flex: 1,
                minHeight: 'var(--control)',
                background: 'var(--text)',
                color: 'var(--app)',
                fontWeight: 700,
              }}
            >
              {SEVERITY_LABEL[preview.severity].toUpperCase()} · {preview.hp} HP
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="row"
      style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}
    >
      {ladderUnknown ? (
        <span className="t-meta" style={{ color: 'var(--damage)', flex: 1, minWidth: 0 }}>
          ARMOR NOT IN THIS BUILD · MARK HP BY HAND
        </span>
      ) : (
        <>
          <span className="t-meta" style={{ flex: 'none' }}>
            TOOK
          </span>
          {field}
          {preview === null ? (
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {stats.thresholds[0]} MAJOR · {stats.thresholds[1]} SEVERE
            </span>
          ) : (
            <>
              <span
                className="row"
                style={{ gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-start' }}
              >
                <span
                  style={{
                    font: '800 15px/1 var(--sans)',
                    color: preview.hp >= 3 ? 'var(--damage)' : 'var(--text)',
                  }}
                >
                  {SEVERITY_LABEL[preview.severity]}
                </span>
                <span className="t-meta" style={{ color: 'var(--muted)' }}>
                  {preview.hp} HP
                </span>
                {armor}
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={commit}
                style={{ minHeight: 'var(--control)' }}
              >
                MARK
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
