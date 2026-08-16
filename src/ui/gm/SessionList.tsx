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
 * 20 of padding and gap = 108), `GmBar` (60), the licence notice (~111) and the
 * tab bar (60 + 34 = 94): 852 − 472 = 380px of list. A shut row is 44px of
 * header inside 8px of panel padding and the list gap is 8, so the step is
 * 60px: six rows on screen, five with a primary countdown pinned above.
 *
 * Six is a row down on what was here before `GmBar`, and it is temporary. The
 * bottom of this screen currently carries **three** bars, because the tab bar
 * is still the only way out of the GM section and the licence notice is still
 * a pinned strip. When MENU takes over the door, both of those leave: 852 − 99
 * − 108 − 94 = 551px, nine rows, with the notice moving *into* this scroll
 * where it costs a scroll position rather than content. That is the arithmetic
 * to redo then, and it is the reason the notice is the thing that pays rather
 * than the plan.
 */
import { useState } from 'react';
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
            body="The campaign is still coming off the disk. Nothing on this screen has been written yet, and nothing you do before it arrives will be lost — it is the saved campaign that wins, and you will be told."
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
