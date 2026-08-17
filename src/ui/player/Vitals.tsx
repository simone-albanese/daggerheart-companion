/**
 * The four tracks plus the incoming-damage calculator.
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
import { CompanionPanel, useHasCompanion, WhoSwitch, type Who } from './Companion.tsx';
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
}

export function Vitals({
  stats,
  layout,
  showState = true,
  bare = false,
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
          <CompanionPanel stats={stats} layout={layout} />
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
       * THE PHONE DOES NOT MOVE A PIXEL. Numbers were already the default:
       * 2x44 plus one 6px gap is **94px**, against 194 for four full-width
       * rows, and that hundred is most of what puts the rest of the sheet on
       * the glass. What is deleted is the reachable 194px shape, which was the
       * single dearest state the Play budget could not see. A cell is
       * (glass - 24 - 6) / 2 - 181.5 at 393 and 172.5 at 375 - of which 88 is
       * the two steppers and 8 the gutters, so the value target is 85.5 and
       * 76.5 wide. `Counter`'s own docblock carries what the narrow one costs.
       *
       * THE COCKPIT IS REDRAWN, AND IT IS THE ONE PLACE PIXELS MOVE. The block
       * was 428x245: `.panel` border 2, padding 12 twice, three 48px track rows
       * (a 10px `.t-label`, its 6px margin, a 32px pip row), three 10px panel
       * gaps, and 45 for the damage box below (1px hairline, 10px of padding,
       * `--control` at 34). It is **428x175** now - 2 + 24 + 44 + 6 + 44 + 10 +
       * 45 - so **70px go back** to `DualityRoll`, the only other child of that
       * column, which is `flex: 1, minHeight: 0, overflow: hidden` and is the
       * panel this repo has already measured crushed to 45px at 744x1133.
       *
       * WHAT A COCKPIT CELL IS. The middle column is `minmax(360px, 428px)` and
       * takes its 428 at every width the cockpit is drawn at: 1180 less 40 of
       * root padding and 36 of gaps is 1104, less column one's 336, leaves 340
       * for the `1fr`. Inner width is 428 - 2 - 24 = 402, so a cell is
       * (402 - 6) / 2 = **198** and the value target is 198 - 44 - 44 - 4 - 4 =
       * **102x44**. Less `padding: 0 5px` and 2px of border that is 90px of
       * room for the 59.5px value line, against the phone's five at 375. The
       * steppers stay at `Counter`'s hard-coded 44 rather than following
       * `--control` down to 34, for the reason `tokens.css` gives beside
       * `--pip-h`: a touchscreen laptop at 1180px and up reports `pointer:
       * fine` with a finger on the glass.
       *
       * READ VERSUS TOUCH, AND WHAT THE COCKPIT LOSES. The readout stops being
       * a 32px silhouette read as a shape and becomes two digits at 800 20px
       * Archivo, with the 13px mark still saying which track it is. Three
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
       * the real one, not the 900px mock - which is why this block giving 70px
       * back matters more than the two it costs the panel's width.
       */}
      {/*
       * `minmax(0, 1fr)` AND NOT `1fr`, WHICH IS TWO WORDS AND A DEFECT.
       *
       * A bare `1fr` is `minmax(auto, 1fr)`, and the `auto` minimum is the grid
       * item's own min-content - which for a `Counter` row is 44 + 4 + 44 + 4 +
       * the value button's own min-content, and that last term is the label
       * line: measured in Chrome, `STRESS` behind its 13px silhouette makes the
       * right-hand track 165.81 and `3 / 11` makes the left one 153.56. So the
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
       * size, and never a target. Measured after: the grid's right edge is the
       * column's at every width, the two steppers stay 44x44 and on the glass
       * down to viewport 310, and the value target is 69 wide at 360, 61 at 344
       * and 49 at 320.
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
 * The ladder is two 26px numbers in the defence band, second on the sheet,
 * where "threshold bene in vista" put them. So the box goes there: the number
 * you were just told and the two numbers you read it against are now one
 * glance, and the restatement is deleted rather than duplicated.
 *
 * IT COSTS THE COLUMN NOTHING, WHICH IS THE PART WORTH CHECKING. A defence cell
 * is 8 + 10 label + 4 + 32 number + 8 + 2 border = 64px tall. This is a 44px
 * field, vertically centred: 44px in a row whose height is already 64. The band
 * does not grow for it, the counters lose 50, and the whole move is a saving of
 * exactly the row it used to be. Measured in Chrome at both widths, with the shipped
 * fonts, in `Defenses`'s own note.
 *
 * `door` IS THE CONDITIONS, AND IT TOOK THE CAPTION'S PLACE RATHER THAN A CELL
 * OF ITS OWN. Decision 3 of the reflow needs a permanent 44x44 way into
 * `ConditionsDialog` somewhere that costs the column no height, and the identity
 * class row that used to hold it is being deleted. A sixth grid track does not
 * fit - measured, the four auto cells are 229.63 wide and four 6px gaps are 24,
 * so a fifth cell of 44 + 6 + 44 and a sixth of 44 needs 391.63 of column
 * against 369 at 393px - so the door goes *inside* the fifth cell, and what it
 * replaces is the visible word `TOOK`.
 *
 * WHICH IS A REAL LOSS AND IS THE ONLY ONE. The field's visible identity is now
 * its `14` placeholder and its position beside the thresholds; its accessible
 * name is unchanged at "Incoming damage", so a listening player loses nothing.
 * The alternative was keeping a 27.2px caption and giving up the door, and the
 * door is a control while the caption is a label for a control that already has
 * a name.
 *
 * AND THE CELL WRAPS RATHER THAN OVERFLOWING, WHICH IS WHAT MAKES IT SAFE AT
 * 320. Both children are `flex: none` at 44 in a `1fr` track whose width is
 * `column - 242.47` once the number is 32px and the cells are padded at 6:
 * 126.53 at 393, 108.53 at 375, 101.53 at 360, 85.53 at 344, 61.53 at 320. The
 * pair needs 94, so from viewport 353 up they sit side by side and the band is
 * 64; below that the field wraps under the door and the band is 94 for the width
 * of one Android. Without `flexWrap` the row's `justifyContent: flex-end` and
 * `minWidth: 0` sent the shortfall *leftwards*, out of the cell, across the grid
 * gap and onto the Proficiency number a player reads under pressure - measured
 * at 27.2px of overlap at 320 and 2.8px at 360 before this commit.
 *
 * WHAT APPEARS WHILE YOU ARE TYPING, AND WHY IT IS A SECOND ROW. `ARM` and the
 * commit chip need about 170px between them and the widest this cell ever gets
 * is 126.53 at 393. So the verdict spans the band underneath, and the band is
 * 120 instead of 64 for exactly as long as there is an unconfirmed number in
 * the box. That is the one state on this screen that moves what is below it,
 * and it is the state where what is below it is not what you are looking at:
 * the field, the ladder and the button you are about to press are all above
 * the line that grew.
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
              // 44, not the 58 it was: the touch floor in both directions, and
              // `base.css` forces `max(16px, 1rem)` on any coarse pointer, so
              // three digits at 16px IBM Plex Mono are 28.8 plus 8 of padding
              // and 2 of border - 38.8 inside 44. The 14px it gives back is
              // most of what lets the door stand beside it at 360.
              flex: 'none',
              width: 44,
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

  const armor = available > 0 && (
    <button
      type="button"
      className="chip"
      /*
       * The band spells the name out because the band has no room to write it.
       * `ARM` and `−1` are the whole visible label there, and neither is a
       * sentence. The desktop keeps `USE ARMOR` as both, because it always has
       * and the cockpit is not what this pass is changing.
       */
      aria-label={
        layout === 'desktop'
          ? undefined
          : useArmor > 0
            ? `Marking ${String(useArmor)} Armor Slots against this hit - tap to change`
            : 'Mark an Armor Slot against this hit'
      }
      onClick={() => setUseArmor((n) => (n + 1 > available || n >= 3 ? 0 : n + 1))}
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
         * `flexWrap` is load-bearing, not tidying. Both children are 44 and
         * `flex: none` inside a `1fr` track that is 61.53 wide at 320: without
         * a wrap, `justifyContent: flex-end` and `minWidth: 0` push the
         * shortfall out of the cell to the *left*, over the grid gap and onto
         * the PROF panel. With it, the field drops under the door and the band
         * is 94 instead of 64 below viewport 353.
         */}
        <div
          className="row"
          style={{ gap: 6, justifyContent: 'flex-end', minWidth: 0, flexWrap: 'wrap' }}
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
