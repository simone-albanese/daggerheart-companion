/**
 * The night, in the order the GM put it in. This is the GM screen now.
 *
 * ## Why it is one column at every width
 *
 * The list is an *order*. Two columns would let the eye read row 4 before row 3
 * on a tablet and after it on a phone, which is the one property this screen
 * exists to carry. So it stays a single column and is capped at 820px - this
 * repo's own reading maximum, about 64 characters at `.t-body` - and centres in
 * anything wider. That is the load-bearing layout decision here, and it is why
 * a desktop window does not get "more of the plan", it gets more of each row.
 *
 * ## Three states, and the third one is the point
 *
 * `useGm` starts as `EMPTY_LIVE` with `hydrated: false` and fills in
 * asynchronously. A list that drew its empty state from that first paint would
 * be telling the GM that tonight is empty *before the database has answered* -
 * a sentence the app cannot yet know is true, about the one screen whose whole
 * content is a campaign that is still being read. So there is a third state
 * between "nothing planned" and the rows, and it says which one it is.
 *
 * ## Scroll
 *
 * This is the scrolling part of the GM screen; the top bar above it and the
 * bottom bar below it do not move. Every figure below was measured in Chrome
 * at 393x852 over a 24-row six-kind fixture, and each carries the safe area it
 * was measured under, because all of them move with it.
 *
 * **With a 47px top inset and a 34px bottom one**, the pinned chrome is the
 * shell header at 100.00 (`padding: 47px 20px 0` over a 52px row, plus a 1px
 * `border-bottom`), `GmTopBar` at 109.00 (two 44px rows inside `padding: 6px
 * 12px 8px` and a 6px gap, plus a 1px `border-bottom`) and `GmBar` at 95.00
 * (60px of buttons over `padding: 0 0 34px`, plus a 1px `border-top`): 304.00
 * of chrome, and 852 − 304 = **548.00 of list**, region 209.00 to 757.00. A
 * shut row is **54.00** - a 44px header inside 4px of panel padding top and
 * bottom, plus `.panel`'s 1px border on each edge - and with the list's 8px
 * gap the **step is 62.00**, taken as one row's top to the next rather than
 * added up. Card height and step were single-valued across all 24 rows.
 *
 * The four numbers that stood here - 99, 108, 94 and 60 - were each short by
 * the same thing, and the pattern is worth more than the four corrections: a
 * 1px rule nobody counted. `base.css` gives `.panel` a 1px border and a
 * session row overrides only the left edge to a 3px stripe, so the horizontal
 * borders stay 1px each; and every one of the three pinned pieces carries a
 * hairline of its own. `SessionRow.tsx` is the one place in this corner that
 * did count it - its "303 and 353, not 307 and 357" note is this same border,
 * caught along the other axis.
 *
 * ### What fits, and what "fits" is doing in that sentence
 *
 * At `scrollTop` 0 with those insets the first row's top is 219.00 and row *i*
 * ends at 273 + 62*i*. **Eight rows are whole on the glass** - the eighth ends
 * at 707.00 - and the ninth is cut by the fold at 757.00, with 42.00 of its
 * 54.00 drawn. What the fold takes is that row's bottom padding and its bottom
 * border. What it does not take is its text: the name and the type row were
 * both wholly visible when this was measured, so the ninth row is entirely
 * legible while it is not entirely drawn. (Where those two baselines fall
 * inside the 42.00 was not measured and no figure for it is given here.)
 * Eight or nine is therefore a question about what "on
 * screen" means, and the pixels do not settle it; they are written out here so
 * the next reader can settle it for whatever they were counting.
 *
 * With a primary countdown pinned `GmTopBar` is 159.00, the region is 259.00
 * to 757.00, and the eighth row ends at exactly 757.00 - flush, nothing to
 * spare, no ninth row begun. That is eight for a reason worth stating, because
 * it is not nine minus one: the unpinned case had exactly 50px of slack under
 * its eighth row, and row C with its gap costs exactly 50.
 *
 * In bare Chrome with no inset at all the region is 162.00 to 791.00: **ten**
 * shut rows whole, nine with a countdown pinned. Any figure here without one
 * of those two conditions on it is not a figure about this screen.
 *
 * Two numbers in this docblock were measured by nobody and are not vouched for
 * by the pass that produced the rest: the 820px reading maximum above, and the
 * licence notice's ~111px below. They stand as they were written. If either
 * starts carrying weight, measure it.
 *
 * ## The licence notice is the last thing in this scroll, and that is the point
 *
 * It used to be a pinned strip above the tab bar on every screen but Play.
 * Verbatim it is 342 characters - six lines and ~111px on a 393px column, an
 * estimate nobody has measured - and pinned here it would take that band out
 * of what is left below the shell header (393x852, 47px top inset), which is
 * 852 less the measured 100.00 of header: 752, arithmetic over a measurement
 * rather than a measurement, and written here as such. It would sit between
 * the plan and the two verbs a GM presses all evening. The share that stood
 * here, "17% of the 653px that is not shell header", was wrong in both
 * halves: 653 does not follow even from the 99 it was reasoning from, and the
 * band under a correctly counted header is 752. Neither the 111 nor the
 * percentage it feeds has been measured; both want the rig before either is
 * quoted again. What the notice must not be is the thing
 * that *leaves*: the DPCGL asks for the notice to be displayed,
 * `Architecture.md` says twice that it is always visible in the footer, and a
 * layout budget is not a reason to drop a licence obligation.
 *
 * So it goes into the scroll. It is drawn here rather than by `Gm.tsx` because
 * "inside the scroll" is the whole of the decision, and this component is the
 * scroll.
 *
 * This screen got that first and got it half right. `marginTop: 'auto'` put the
 * notice at the foot of the *region* rather than after the content, so a list
 * shorter than the glass - which is every list at the top of an evening - paid
 * the same band as the fixed strip it was supposed to be an improvement on.
 * That is the screen in the owner's screenshot, and P5-6 is the answer: no
 * `auto`, on any screen, and the other four join this one inside their own
 * scroll instead of the other way round.
 */
import { useState } from 'react';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { SessionRow } from './SessionRow.tsx';
import { useGm, type GmRegion } from './gmStore.ts';
import { useSessionDrag } from './useSessionDrag.ts';

export function SessionList({
  phone,
  onOpenTool,
}: {
  phone: boolean;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const session = useGm((s) => s.session);
  const hydrated = useGm((s) => s.hydrated);
  const moveSessionItem = useGm((s) => s.moveSessionItem);
  const [announcement, setAnnouncement] = useState('');
  const drag = useSessionDrag({
    items: session,
    move: moveSessionItem,
    announce: setAnnouncement,
  });

  return (
    <div
      className="scroll stack"
      style={{ flex: 1, minHeight: 0, padding: phone ? '10px 12px 16px' : '14px 20px 18px' }}
    >
      <div className="stack" style={{ flex: 'none', gap: 8, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
        {!hydrated ? (
          <Empty
            title="Reading this device"
            /*
             * What this said until now was "nothing you do before it arrives
             * will be lost — it is the saved campaign that wins", which is two
             * halves of a contradiction and the first half is the false one.
             * `hydrateGm` adopts the record and drops whatever was changed in
             * the meantime: a Fear tap made in this window is reverted, on
             * purpose, because the alternative is writing an empty board over
             * a real campaign. So the sentence says that, and the screen says
             * it again if it actually happens - see `Gm.tsx::ReplacedOnLoad`.
             */
            body="The campaign is still coming off the disk. Nothing on this screen has been written yet, and what is saved on this device is what wins: anything you change before it arrives is replaced by the saved campaign. If that happens, this screen says so — it is never done quietly."
          />
        ) : session.length === 0 ? (
          <Empty
            title="Nothing planned yet"
            // The sentence that used to be here said no scene, encounter or
            // link could be written by this build. ADD writes all four now, so
            // the copy points at ADD instead: an empty state that describes a
            // limitation the app has since lifted is a lie with a long life.
            body="This is the night, in the order you want to run it: scenes, encounters, countdowns and links to whatever you will want open. ADD, at the bottom of the screen, starts one — and every row can be dragged into the order you mean to run it in."
          />
        ) : (
          // Keyed on the item's id, not on its index. That is what makes the
          // focused drag handle survive its own row being moved: React moves
          // the DOM node rather than rewriting four of them, so focus - and a
          // held pointer - stay with the row they were on.
          <ol className="stack" style={{ gap: 8, margin: 0, padding: 0 }}>
            {session.map((item, i) => (
              <SessionRow
                key={item.id}
                item={item}
                position={i + 1}
                total={session.length}
                phone={phone}
                handle={drag.handleProps(item, i)}
                lifted={drag.lifted === item.id}
                onOpenTool={onOpenTool}
              />
            ))}
          </ol>
        )}
      </div>
      {/*
        One live region for the whole list, and `polite` rather than `assertive`.
        A drag across four rows produces a lift, three steps and a drop; on
        `assertive` each of the five interrupts the one before it and the GM
        hears the beginning of five sentences. `aria-atomic` makes each message
        replace the last, which is the behaviour that was wanted from
        `assertive` in the first place. It sits outside the `<ol>` so a moving
        row cannot carry it, and there is exactly one of it: four regions
        announcing in turn is the same interruption by another route.
      */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {/*
        The notice, after the last row and nowhere else.

        It used to carry `marginTop: 'auto'`, which put it at the foot of the
        *region* rather than after the content - so on a short list, which is
        every list before the GM has written the night, it floated down to sit
        above `GmBar` and looked and cost exactly like the fixed strip the other
        screens had. That is the behaviour the owner objected to. Without it the
        notice is simply the last block of the list, ~111px below whatever the
        GM last wrote, and a plan with three rows in it gets those 111px back as
        list.

        The negative side margins went with it. `LicenceFooter` no longer paints
        a panel or sets a horizontal padding of its own, so there is nothing to
        bleed to the edges: it is a hairline and some muted text, and this
        region's own gutter is the gutter it wants.

        `pinnedBelow` is the one fact this screen has to hand over: `GmBar` sits
        under this scroll at every width - it is the only bottom bar in the app
        that is not the shell's - so it is what is last in the window and it
        pays `env(safe-area-inset-bottom)`. Paid twice it would leave 34px of
        empty panel between the notice and the bar.
      */}
      <LicenceFooter pinnedBelow />
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <div className="panel stack" style={{ flex: 'none', padding: 16, gap: 9 }}>
      <span className="t-vital" style={{ color: 'var(--muted)' }}>
        {title}
      </span>
      <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
        {body}
      </p>
    </div>
  );
}
