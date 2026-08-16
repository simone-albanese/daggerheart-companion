/**
 * The pinned top of the GM screen: what has to be true no matter which row is
 * open, and nothing else.
 *
 * Four things earn a permanent place. The campaign's name, so a GM with two
 * tables can see which one they are in. The **Fear pool**, spent from every
 * corner of this app. The **primary countdown**, which is the one the record
 * lets a GM pin precisely because they are watching it all evening. And the
 * live scene, but only while there is one - a chip that appears when adversaries
 * are on the board and is not there when they are not.
 *
 * ## What is read and what is touched
 *
 * Read: the campaign name (text, not a target - the MENU button that will make
 * it one arrives with the bottom bar) and the countdown's value. Touched: Fear
 * `−` and `+` at 44 x 44, the Fear readout at 58 x 44 - the one deliberate
 * crossing, because setting the pool outright belongs to the board and the
 * number the eye is already on is the honest door to it - the countdown's `−`
 * and `+` at 44 x 44, and the two consultation chips.
 *
 * ## The phone, in numbers (393 x 852)
 *
 * Column 393 − 24 of page padding = 369. Two rows plus a conditional third:
 *
 *   row A  44px  the campaign name, read, ellipsised, with the two consultation
 *                chips beside it: BESTIARY ~68 and PARTY ~50 with their padding,
 *                plus two 8px gaps = 134, leaving 235 for the name
 *   row B  44px  the live-scene chip when there is one, then Fear:
 *                label 30 + `−` 44 + readout 58 + `+` 44 + three 8px gaps = 200,
 *                which leaves 161 for the chip and its gap. It needs ~90.
 *   row C  44px  the primary countdown, when one is pinned: `−` 44 + value 62 +
 *                `+` 44 + 3 gaps = 174, and the name takes the remaining 187,
 *                ellipsised, with the whole of it on `title`.
 *
 * With 6 + 6 + 8 of padding and gap that is 108px pinned, 158 with a countdown.
 * The pips are **off** at this width: twelve diamonds are 210 of the 369, and
 * the GM this screen was described by was explicit that they are not what gets
 * read.
 *
 * ## Wider
 *
 * At 720-1179 the pips come back (the block is ~370px of a 704px column) and
 * the countdown keeps its own row. At 1180+ everything is one 44px row: name,
 * chips, scene, countdown and Fear, in a 1140px column.
 *
 * ## The two consultation chips are temporary, and this is the note that says so
 *
 * BESTIARY and PARTY belong behind SHOW in the bottom bar, which is where the
 * wireframe puts them and where the backlog's "SHOW forks in two" decides they
 * go. They are here because until that bar exists there is no other route to
 * them, and quietly dropping two working tools while rebuilding the screen
 * around them would be a regression dressed as a refactor. When `GmBar` lands,
 * they leave this file.
 */
import type { Layout } from '../shared/useLayout.ts';
import type { Countdown } from '../../engine/encounter.ts';
import { primaryCountdownOf } from '../../../shared/campaigns.ts';
import { FearBar } from './FearPool.tsx';
import { useGm, type GmRegion } from './gmStore.ts';

export function GmTopBar({
  layout,
  onOpenTool,
}: {
  layout: Layout;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const phone = layout === 'phone';
  const oneRow = layout === 'desktop';
  const campaigns = useGm((s) => s.campaigns);
  const activeId = useGm((s) => s.activeCampaignId);
  const combatants = useGm((s) => s.combatants);
  const session = useGm((s) => s.session);

  const active = campaigns.find((c) => c.id === activeId);
  const name = (active?.name ?? '').trim();
  const countdown = primaryCountdownOf(session);

  const consult = (
    <>
      <Chip onClick={() => onOpenTool('bestiary')}>BESTIARY</Chip>
      <Chip onClick={() => onOpenTool('party')}>PARTY</Chip>
    </>
  );

  const scene = combatants.length > 0 && (
    <Chip onClick={() => onOpenTool('scene')} tone="var(--hope)">
      SCENE · {combatants.length}
    </Chip>
  );

  const fear = <FearBar pips={!phone} onOpenBoard={() => onOpenTool('countdowns')} />;

  const title = (
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
          {consult}
          {scene}
          {countdown !== null && <PrimaryCountdown countdown={countdown} />}
          {fear}
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            {title}
            {consult}
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
