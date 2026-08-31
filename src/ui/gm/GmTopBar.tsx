/**
 * The pinned top of the GM screen: what has to be true no matter which row is
 * open, and nothing else.
 *
 * Four things earn a permanent place. The campaign's name, so a GM with two
 * tables can see which one they are in. The **Fear pool**, spent from every
 * corner of this app. The **primary countdown**, which is the one the record
 * lets a GM pin precisely because they are watching it all evening. And the
 * open scene, but only while there is one - a chip that appears when the row
 * the runner is showing has adversaries in it, and is not there when it has
 * none or when nothing is open. What that narrowness costs is argued beside
 * the chip itself.
 *
 * ## MENU, and why the whole row is the button
 *
 * The campaign name used to be a label. It is the visible half of the MENU
 * button now - the way out of the GM section, and the campaign list - and the
 * *whole row* is the target rather than the word MENU beside it. That is the
 * lesson `Disclosure` already learned on the character sheet: a 44px word next
 * to 300px of dead text teaches the hand to aim, and the hand is holding a
 * phone in the other one. 369 x 44 is the largest target on this screen and it
 * is at the top of it deliberately, because leaving the section and switching
 * table are the rare gestures; ADD and SHOW are the continuous ones and they
 * have the bottom.
 *
 * Its accessible name is its visible text - the word MENU and the campaign's
 * name, no `aria-label` - so WCAG 2.5.3 holds by construction rather than by a
 * string somebody has to remember to keep in step.
 *
 * ## What is read and what is touched
 *
 * Read: the countdown's value, and the campaign's name *as text inside* the
 * MENU button rather than as a target of its own. Touched: MENU at 369 x 44,
 * Fear `−` and `+` at 44 x 44, the Fear readout at 58 x 44 - the one deliberate
 * crossing, because setting the pool outright belongs to the board and the
 * number the eye is already on is the honest door to it - and the countdown's
 * `−` and `+` at 44 x 44.
 *
 * ## The phone, in numbers (393 x 852)
 *
 * Column 393 − 24 of page padding = 369. Two rows plus a conditional third:
 *
 *   row A  44px  MENU, the whole width: the word at ~44 with its letterspacing
 *                and 8 of gap, and the campaign name ellipsised in the
 *                remaining 317 with the whole of it on `title`
 *   row B  44px  the live-scene chip when there is one, then Fear:
 *                label 30 + `−` 44 + readout 58 + `+` 44 + three 8px gaps = 200,
 *                which leaves 161 for the chip and its gap. It needs ~90.
 *   row C  44px  the primary countdown, when one is pinned: `−` 44 + value 62 +
 *                `+` 44 + 3 gaps = 174, and the name takes the remaining 187,
 *                ellipsised, with the whole of it on `title`.
 *
 * With 6 + 6 + 8 of padding and gap, and this bar's own 1px `border-bottom`,
 * that is **109.00** pinned and **159.00** with a countdown - both measured
 * in Chrome at 393x852 with a 47px top inset, and both corroborated from the
 * other side: `SessionList.tsx` measures the scroll region starting at 209.00
 * without the countdown and 259.00 with it, and this bar is the only thing
 * between them and the 100.00 shell header. The 108 and 158 that stood here
 * dropped the
 * hairline, and they were not alone in it: `SessionList.tsx` had the same
 * omission three more times over, and its scroll section is where the whole
 * pattern is written down.
 * The pips are **off** at this width: twelve diamonds are 210 of the 369, and
 * the GM this screen was described by was explicit that they are not what gets
 * read.
 *
 * ## Wider
 *
 * At 720-1179 the pips come back (the block is ~370px of a 704px column) and
 * the countdown keeps its own row. At 1180+ everything is one 44px row: name,
 * scene, countdown and Fear, in a 1140px column.
 *
 * ## The two consultation chips have left, on schedule
 *
 * BESTIARY and PARTY were chips here while `GmBar` did not exist, because
 * without the bar there was no route to either and quietly dropping two working
 * tools while rebuilding the screen around them would have been a regression
 * dressed as a refactor. SHOW is that route now, which is where the wireframe
 * put them and where the decision recorded as "SHOW forks in two" sent them.
 * That phrasing is kept as the name of the decision and is no longer a
 * description of the sheet: SHOW has three doors since the merchant, and
 * `showDoors.ts` is where the list lives. Keeping either chip here as well
 * would be a second door nobody chose to build - and 134px of row A that
 * the campaign name wants.
 */
import type { Layout } from '../shared/useLayout.ts';
import type { Countdown } from '../../engine/encounter.ts';
import { primaryCountdownOf } from '../../../shared/campaigns.ts';
import { FearBar } from './FearPool.tsx';
import { openCombatants, useGm, type GmRegion } from './gmStore.ts';

export function GmTopBar({
  layout,
  onOpenMenu,
  onOpenTool,
}: {
  layout: Layout;
  /** MENU is the only sheet reached from up here. The bar opens the rest. */
  onOpenMenu: () => void;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const phone = layout === 'phone';
  const oneRow = layout === 'desktop';
  const campaigns = useGm((s) => s.campaigns);
  const activeId = useGm((s) => s.activeCampaignId);
  const combatants = useGm(openCombatants);
  const session = useGm((s) => s.session);

  const active = campaigns.find((c) => c.id === activeId);
  const name = (active?.name ?? '').trim();
  const countdown = primaryCountdownOf(session);

  /*
   * IT COUNTS THE OPEN SCENE, AND NOT A TOTAL ACROSS SCENES.
   *
   * Every scene row can hold its own fight at the same time now, so a total
   * across scenes is available for the first time and is deliberately not what
   * this says. The chip is a door
   * to ONE runner, and a number that does not match what opening it shows is
   * worse than a number narrower than the truth: a GM who reads SCENE · 9 and
   * taps into a table of three has been lied to by the only control that could
   * have told them where the other six were.
   *
   * NAMED COST, so it is a decision and not a discovery: a GM who closes the
   * runner while three rows hold fights sees no chip at all until one of them
   * is open again. That is accepted because the plan list underneath now shows
   * all three, each with its own count in its shut summary - which is exactly
   * what it could not do while the fight was on the board and the plan had one
   * number to share between every row.
   */
  const scene = combatants.length > 0 && (
    <Chip onClick={() => onOpenTool('scene')} tone="var(--hope)">
      SCENE · {combatants.length}
    </Chip>
  );

  const fear = <FearBar pips={!phone} onOpenBoard={() => onOpenTool('countdowns')} />;

  const title = (
    <button
      type="button"
      onClick={onOpenMenu}
      aria-haspopup="dialog"
      className="row"
      style={{ flex: 1, minWidth: 0, minHeight: 44, gap: 8, padding: '0 4px', textAlign: 'left' }}
    >
      <span
        className="t-meta"
        style={{ flex: 'none', letterSpacing: '0.12em', color: 'var(--muted)' }}
      >
        MENU
      </span>
      <span
        className="t-label"
        title={name === '' ? undefined : name}
        style={{
          flex: 1,
          minWidth: 0,
          color: name === '' ? 'var(--dim)' : 'var(--text-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name === '' ? 'Unnamed campaign' : name}
      </span>
    </button>
  );

  return (
    <div
      className="stack"
      style={{
        flex: 'none',
        gap: 6,
        padding: phone ? '6px 12px 8px' : '8px 20px',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--panel)',
      }}
    >
      {oneRow ? (
        <div className="row" style={{ gap: 14 }}>
          {title}
          {scene}
          {countdown !== null && <PrimaryCountdown countdown={countdown} />}
          {fear}
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            {title}
            {!phone && scene}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {phone && scene}
            {fear}
          </div>
          {countdown !== null && <PrimaryCountdown countdown={countdown} />}
        </>
      )}
    </div>
  );
}

/** A 44px-tall chip. `.chip` alone is 17px of type and not a target. */
function Chip({
  onClick,
  children,
  tone,
}: {
  onClick: () => void;
  children: React.ReactNode;
  tone?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="t-meta"
      onClick={onClick}
      style={{
        flex: 'none',
        minHeight: 44,
        padding: '0 10px',
        borderRadius: 'var(--r2)',
        letterSpacing: '0.1em',
        color: tone ?? 'var(--muted)',
        background: 'var(--raised)',
      }}
    >
      {children}
    </button>
  );
}

/**
 * The pinned countdown, with the countdowns board's polarity and its two
 * names: `−` advances toward zero, `+` puts it back. Read through
 * `primaryCountdownOf(session)` rather than through `countdowns[0]`, because
 * the flag is on the row and the pinned one is very often not the first.
 */
function PrimaryCountdown({ countdown }: { countdown: Countdown }): React.JSX.Element {
  const advance = useGm((s) => s.advanceCountdown);
  const spent = countdown.value === 0;

  return (
    <div className="row" style={{ gap: 8, flex: 1, minWidth: 0 }}>
      <span
        className="stack"
        style={{ flex: 1, minWidth: 0, gap: 1, alignItems: 'flex-start' }}
      >
        <span
          title={countdown.name}
          style={{
            font: '700 14px/1.15 var(--sans)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {countdown.name}
        </span>
        <span className="t-meta" style={{ color: spent ? 'var(--damage)' : 'var(--dim)' }}>
          {spent ? 'SPENT — IT HAPPENS NOW' : `OF ${countdown.start}`}
        </span>
      </span>
      <button
        type="button"
        onClick={() => advance(countdown.id, -1)}
        aria-label={`Advance ${countdown.name} by one`}
        className="btn"
        style={{ flex: 'none', width: 44, minHeight: 44, font: '700 19px/1 var(--sans)' }}
      >
        −
      </button>
      <span
        style={{
          flex: 'none',
          minWidth: 62,
          textAlign: 'center',
          font: '800 24px/1 var(--sans)',
          fontVariantNumeric: 'tabular-nums',
          color: spent ? 'var(--damage)' : 'var(--text)',
        }}
      >
        {countdown.value}
      </span>
      <button
        type="button"
        onClick={() => advance(countdown.id, 1)}
        aria-label={`Move ${countdown.name} back by one`}
        className="btn"
        style={{ flex: 'none', width: 44, minHeight: 44, font: '700 19px/1 var(--sans)' }}
      >
        +
      </button>
    </div>
  );
}
