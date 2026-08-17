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
 * bottom bar below it do not move. On a 393x852 phone the pinned chrome is the
 * shell header (52 + 47 of safe area = 99), the top bar (two 44px rows inside
 * 20 of padding and gap = 108) and `GmBar` (60 + 34 of home-indicator inset =
 * 94): 852 − 301 = 551px of list. A shut row is 44px of header inside 8px of
 * panel padding and the list gap is 8, so the step is 60px: nine rows on
 * screen, eight with a primary countdown pinned above. That is a night's plan.
 *
 * ## The licence notice is the last thing in this scroll, and that is the point
 *
 * It used to be a pinned strip above the tab bar on every screen but Play.
 * Verbatim it is 342 characters - six lines and ~111px on a 393px column - and
 * pinned here it would be 17% of the 653px that is not shell header, sitting
 * between the plan and the two verbs a GM presses all evening. What it must not
 * be is the thing that *leaves*: the DPCGL asks for the notice to be displayed,
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
