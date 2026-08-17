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
import { Track } from '../shared/Track.tsx';
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

/**
 * Put the four phone counters two across, or leave them alone.
 *
 * A plain function rather than a component: it takes the children the branch
 * below has already built and decides whether they are a grid, which is one
 * decision and not a second surface. Lowercase for the same reason
 * `usePlaySection` is - `screens.test.tsx` demands a mount fixture for every
 * PascalCase export under `src/ui`, and this is not something you can mount.
 *
 * The 6px gap is the one the four stacked rows already used between them, kept
 * in both axes so the block still reads as one object with its own rhythm
 * rather than as four siblings of the defence band above it.
 */
function arrange(grid: boolean, cells: React.JSX.Element[]): React.JSX.Element {
  if (!grid) return <>{cells}</>;
  return (
    <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
      {cells}
    </div>
  );
}

export function Vitals({
  stats,
  layout,
  showState = true,
  bare = false,
}: Props): React.JSX.Element | null {
  const character = useActive();
  const update = useApp((s) => s.update);
  const counterStyle = useApp((s) => s.prefs.counterStyle);
  const hasCompanion = useHasCompanion();
  const [who, setWho] = useState<Who>('you');

  if (!character) return null;

  const phone = layout === 'phone';
  // 46px on a phone is the thumb target from the design. On desktop the mouse
  // is precise and the vertical budget is not: a 1440x695 laptop viewport is
  // the real constraint, not the 900px mock.
  const rowHeight = phone ? 44 : 32;

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
      {phone ? (
        /*
         * NUMBERS GO TWO ACROSS; PIPS STAY ONE TO A ROW. The two modes want
         * opposite things from the width and this is the one place that can
         * give them different answers.
         *
         * As numbers, a counter is a value target and two 44x44 steppers, and
         * the widest thing it ever draws is `12 / 12` at 59.5px - so half a
         * column is 22px more than it needs, and four of them stacked cost
         * **194px** (4x44 plus three 6px gaps) of a 730px screen. Two across is
         * **94px**, and the hundred pixels that frees is most of what puts the
         * rest of the sheet on the glass. `Counter`'s own docblock carries what
         * that costs inside the cell, which is the gap between the value target
         * and the steppers, measured.
         *
         * As pips it is the other way round and this grid would be a defect. A
         * 12-box Hit Point track is twelve targets that may not go below
         * WCAG's 24px, plus a header; in a 172px cell it wraps onto three or
         * four rows and the four tracks come out taller than the four rows they
         * replaced. Hope and Armor already learned this the expensive way -
         * they used to share a row with Armor in a fixed 132px column, which
         * measured 18px a pip at armour score 6 on a real 393px phone, and
         * thirteen of the thirty-four SRD armours score 6 or more. So pips keep
         * the full width, and `counterStyle: 'pips'` keeps costing this column
         * what it has always cost it.
         */
        <>
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
             * them; Hope and Armor beneath.
             */
            arrange(
              counterStyle === 'numbers',
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
                return counterStyle === 'numbers' ? (
                  <Counter
                    key={kind}
                    kind={kind}
                    label={label}
                    labelColor={kind === 'hope' ? 'var(--hope)' : undefined}
                    value={counter.marked}
                    max={counter.max}
                    onChange={write}
                  />
                ) : (
                  <Track
                    key={kind}
                    kind={kind}
                    label={label}
                    labelColor={kind === 'hope' ? 'var(--hope)' : undefined}
                    value={counter.marked}
                    max={counter.max}
                    clearTo={kind === 'hope' ? counter.max : 0}
                    onChange={write}
                    readout={`${counter.marked}/${counter.max}`}
                    headerLayout="gutter"
                    rowHeight={rowHeight}
                  />
                );
              }),
            )
          }
        </>
      ) : (
        <>
          <Track
            kind="hp"
            label="HP"
            value={character.hp.marked}
            max={character.hp.max}
            onChange={(v) => update((c) => ({ ...c, hp: { ...c.hp, marked: v } }))}
            readout={`${character.hp.marked} / ${character.hp.max} MARKED`}
            rowHeight={rowHeight}
            compact
          />
          <Track
            kind="stress"
            label="STRESS"
            value={character.stress.marked}
            max={character.stress.max}
            onChange={(v) => update((c) => ({ ...c, stress: { ...c.stress, marked: v } }))}
            readout={`${character.stress.marked} / ${character.stress.max} MARKED`}
            rowHeight={rowHeight}
            compact
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 148px', gap: 12 }}>
            <Track
              kind="hope"
              label="HOPE"
              labelColor="var(--hope)"
              value={character.hope.marked}
              max={character.hope.max}
              clearTo={character.hope.max}
              onChange={(v) => update((c) => ({ ...c, hope: { ...c.hope, marked: v } }))}
              readout={`${character.hope.marked} / ${character.hope.max} AVAILABLE`}
              rowHeight={rowHeight}
              compact
            />
            <Track
              kind="armor"
              label="ARMOR"
              value={character.armorSlots.marked}
              max={character.armorSlots.max}
              onChange={(v) => update((c) => ({ ...c, armorSlots: { ...c.armorSlots, marked: v } }))}
              readout={`${character.armorSlots.marked} / ${character.armorSlots.max} USED`}
              rowHeight={rowHeight}
              compact
            />
          </div>
        </>
      )}

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
 * is 8 + 10 label + 4 + 26 number + 8 + 2 border = 58px tall. This is a `TOOK`
 * label beside a 44px field, vertically centred: 44px in a row whose height is
 * already 58. The band does not grow, the counters lose 50, and the whole move
 * is a saving of exactly the row it used to be. Measured in Chrome at both
 * widths, with the shipped fonts, in `Defenses`'s own note.
 *
 * WHAT APPEARS WHILE YOU ARE TYPING, AND WHY IT IS A SECOND ROW. `ARM` and the
 * commit chip need about 170px between them and the widest this cell ever gets
 * is 114.92 at 393. So the verdict spans the band underneath, and the band is
 * 108 instead of 58 for exactly as long as there is an unconfirmed number in
 * the box. That is the one state on this screen that moves what is below it,
 * and it is the state where what is below it is not what you are looking at:
 * the field, the ladder and the button you are about to press are all above
 * the line that grew.
 */
export function IncomingDamage({
  stats,
  layout,
}: {
  stats: DerivedStats;
  /** `band` is a pair of grid children for `Defenses`; `desktop` is one row. */
  layout: 'band' | 'desktop';
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
              flex: 'none',
              width: 58,
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
     */
    if (ladderUnknown) return null;
    return (
      <>
        <div className="row" style={{ gap: 6, justifyContent: 'flex-end', minWidth: 0 }}>
          <span className="t-label" style={{ flex: 'none', letterSpacing: '0.08em' }}>
            TOOK
          </span>
          {field}
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
