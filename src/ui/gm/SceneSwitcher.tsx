/**
 * The strip of scenes a GM is flipping between, in the runner's title row.
 *
 * ## Why it is here and not anywhere else
 *
 * The title row of `GmSheet` is already 44px tall - the 44x44 close button
 * sizes it, `.row` declares no min-height and no wrap, and the `.t-label` this
 * replaces is already `flex: 1, minWidth: 0`. So chips at `minHeight: 44` are a
 * drop-in into a slot that already shrinks: **0.00px of vertical cost**, and
 * they cannot push the ✕ out or wrap onto a second line.
 *
 * Row B of `GmTopBar` was measured and rejected. `.row` has no `flex-wrap`,
 * `Chip` is `flex: 'none'`, and the only compressible element in that row is
 * `FearBar`'s root - which is `justifyContent: 'flex-end'` with fixed children,
 * so three or four chips do not wrap and do not scroll: they squeeze the Fear
 * box under its own content, and the overflow leaves by the START edge. The
 * `−` and part of the readout slide under the chips and off a 393px phone,
 * while every runtime assertion about Fear stays green, because they assert
 * presence and not position.
 *
 * ## The horizontal budget, at 393x852
 *
 *     391.00  panel content (393 − 2 border; box-sizing is global)
 *   −  20.00  title row padding, '0 6px 0 14px'
 *   −   0.00  the ESC keycap: `display: none` outside (hover:hover) and
 *             (pointer:fine), so on coarse it is not a flex item and costs not
 *             even its gap
 *   −  44.00  the ✕
 *   −  12.00  one gap
 *   = 315.00  for the strip
 *
 * The cap is adaptive rather than fixed, and the floor is 74: at four scenes
 * every chip is still ≥44 in both axes, which is the only number that must not
 * bend.
 *
 * **MEASURED IN CHROME**, 393x852, insets 47/34, pointer coarse, four live
 * scenes, against a `dist` built from this branch and a control `dist` built
 * from `main`:
 *
 * - the strip is **315.00**, exactly what the subtraction above predicts;
 * - **7.00px per character**, three independent exact fits - `DUNGEON` 7 chars
 *   at 69.00, `FOREST` 6 at 62.00, `GATE` 4 at 48.00, each of them `chars * 7 +
 *   20` to the hundredth. The 7.0 was DERIVED from `SessionRow`'s footer before
 *   this; it is measured now, here, on this chip;
 * - so the seven-character cap at four scenes is real: 74.00 holds 7 characters
 *   at 69.00 and an eighth would need 76.00;
 * - every chip 44.00 tall, the narrowest 48.00 wide, `docOverflowX` 0.00;
 * - at four scenes the strip does not even scroll - 271.00 used of 315.00.
 *
 * **The vertical cost is 0.00px, and that is measured rather than argued.**
 * Against the control build the title row is 45.00 -> 45.00, the scroller
 * 385.00 -> 385.00 and the panel 432.00 -> 432.00; the ✕ is 44x44 with its
 * right edge at 386.00 and its top at 326.00 in both.
 *
 * One correction to the plan that predicted this work: it derived the scroller
 * as 451.00 with a pinned countdown and 501.00 without, and marked both
 * "(derivata)". Measured on the rig's campaign it is **385.00**. Nothing here
 * rests on that number - the delta is what this file had to prove, and the
 * delta is zero - but the two derived figures should not be quoted as if they
 * had been in a browser. Past four the strip scrolls horizontally - **zero vertical pixels** -
 * because wrapping to a second line would cost the scroller 44px and reflow
 * content under a thumb at the worst possible moment. What five simultaneous
 * fights on a 393px phone cost, and why that stopped being a rare state, is
 * the last section of this docblock.
 *
 * ## What the strip holds, and why it holds it unaided now
 *
 * The membership rule is `liveScenes`, and it got simpler underneath this file
 * without a line here changing. A row is on the strip because it holds a fight
 * or because it is the one the runner has open. Until campaign schema 5 the row
 * being fought in held `combatants: []` - the fight was on the board - so the
 * row a GM was actually playing reached the strip only through the second
 * clause, and the first clause was about rows that had been deliberately
 * parked. Now a row that has been fought in and left keeps its own fight, so it
 * satisfies the first clause on its own merits and the second one covers only
 * an open row with nothing in it yet. The header's first sentence - the scenes
 * a GM is flipping between - is delivered by the filter rather than by the
 * pointer propping it up.
 *
 * ## The order is `order`, never recency
 *
 * A strip that re-sorts itself under a thumb is the one thing muscle memory
 * cannot use. `liveScenes` filters and preserves list order, and the plan
 * cannot be dragged while this is on the glass - `Gm.tsx` marks the session
 * list `inert` whenever a tool is open.
 *
 * ## The current chip is a `<span>`, not a disabled button
 *
 * `Countdowns.tsx` argues that "a button that can be pressed and does nothing
 * is the worse of the two lies", and inside the runner the current scene has no
 * action at all - so it is a label and is drawn as one. A disabled button with
 * `aria-current` was the alternative and is worse: some screen readers do not
 * announce `aria-current` on a disabled control, and none of them decline to
 * announce text.
 *
 * The full name is in the accessible name as TEXT, never in a `title`: a
 * `title` is a mouse affordance on a device with no mouse.
 *
 * ## No confirmation, and no arming
 *
 * The flip destroys nothing - and the reason is stronger than it was. It used
 * to be that the parking storage put back what the swap took away, so nothing
 * was lost on the round trip. Now nothing is taken away in the first place:
 * `showScene` writes one string, `openScene`, and no fight moves, so there is
 * no round trip to be made whole. A confirmation would double the cost of the
 * one gesture this file is for, to protect against a write that does not
 * happen.
 *
 * ## What it does NOT fix
 *
 * Two scenes with no name both draw `SCENE`, and at four chips `The Dungeon`
 * and `The Dungeon Below` both truncate to seven characters. The full name is
 * in the accessible name and in the runner, but on the glass they are
 * identical. There is no answer to that at 74.25px of width, and this file does
 * not pretend to have one.
 *
 * ## The strip grows by default now, and that is the standing risk
 *
 * "A GM with five simultaneous fights on a 393px phone has a problem design
 * cannot solve" stood in the budget section above, and it was written when
 * carrying a fight was the result of a deliberate park. It is the resting
 * state of a played scene now: a scene fought in and left keeps its
 * adversaries and therefore keeps its chip, so five chips is what four hours
 * of play produces rather than a pathology. No geometry changes for it - the
 * 44px floor holds, the cap still bottoms out at 74, and past four the strip
 * scrolls horizontally for zero vertical pixels - but the seven-character
 * truncation bites at four and above far more often, and the paragraph above
 * is what it costs when it does. The
 * only pruning gesture is `CLEAR THIS FIGHT` on the row itself. Flagged rather
 * than fixed, because a cap that hid a scene the GM is in the middle of would
 * be the worse of the two.
 */
import { liveScenes } from '../../../shared/campaigns.ts';
import { sessionName } from './session.ts';
import { useGm } from './gmStore.ts';

/** What the strip has to divide, measured above. */
const STRIP = 315;
/** The floor. Below this a chip stops being a 44px target in both axes. */
const MIN_CHIP = 74;
/** `.row`'s gap between chips. */
const GAP = 6;

/**
 * The word the title row keeps when there is nothing to flip between.
 *
 * It is drawn HERE rather than left to `GmSheet`'s `{title ?? label}`, and that
 * is a repair rather than a preference. `Gm.tsx` passes
 * `title={tool === 'scene' ? <SceneSwitcher /> : undefined}` - an element,
 * always, for the runner - so `??` tests the element and never its output. A
 * strip that rendered `null` left the row with no title at all: on a campaign
 * with no scene open the runner's header was a bare `ESC ✕`, which is the state
 * a GM reaches by opening the tool at all before a fight exists. The comment in
 * `Gm.tsx` promised the opposite and could not deliver it, because there is no
 * value a component can return that makes `??` fall through.
 */
export function SceneSwitcher({ label }: { label: string }): React.JSX.Element {
  const session = useGm((s) => s.session);
  const openScene = useGm((s) => s.openScene);
  const showScene = useGm((s) => s.showScene);

  const live = liveScenes(session, openScene);
  // Nothing to flip between: the title row keeps the word it has always had.
  if (live.length === 0) {
    return (
      <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>
        {label}
      </span>
    );
  }

  const cap = Math.max(MIN_CHIP, Math.floor((STRIP - GAP * (live.length - 1)) / live.length));

  return (
    <div
      className="row"
      style={{ flex: 1, minWidth: 0, gap: GAP, overflowX: 'auto' }}
    >
      {live.map((item) => {
        const name = sessionName(item).toUpperCase();
        const current = item.id === openScene;
        /*
         * Not `GmTopBar`'s `Chip`: that one is `flex: 'none'` with no
         * `overflow` and no `textOverflow`, so it does not truncate - it grows,
         * and four of them would push the ✕ off the row.
         */
        const shape = {
          flex: 'none' as const,
          minHeight: 44,
          maxWidth: cap,
          padding: '0 10px',
          borderRadius: 'var(--r2)',
          font: '500 0.75rem/1 var(--mono)',
          letterSpacing: '0.1em',
          overflow: 'hidden' as const,
          textOverflow: 'ellipsis' as const,
          whiteSpace: 'nowrap' as const,
        };

        return current ? (
          <span
            key={item.id}
            aria-current="true"
            style={{
              ...shape,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--hope)',
              color: 'var(--app)',
            }}
          >
            {name}
          </span>
        ) : (
          <button
            key={item.id}
            type="button"
            onClick={() => showScene(item.id)}
            /*
             * The full name, as text. A truncated chip is still announced
             * whole.
             *
             * `Open`, not `Run`. "Run" named a mode a scene was put INTO -
             * one at a time, the others parked out of it - and there is no
             * such mode any more: every scene on this strip is holding its own
             * fight the whole time, and the tap only changes which one is
             * drawn. A verb that promised to start something would be
             * promising the one thing this control has stopped doing.
             */
            aria-label={`Open ${sessionName(item)}`}
            style={{ ...shape, background: 'var(--raised)', color: 'var(--muted)' }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
