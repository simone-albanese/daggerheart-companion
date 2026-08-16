/**
 * One row of the night.
 *
 * A *tendina*, the same idea `Disclosure` already carries for the character
 * sheet, with the three rules that made that one honest applied here:
 *
 *   - **the whole header is the target**, not a chevron. 44px tall and 307 of
 *     the 357px the panel has on a 393px phone - the remaining 44 + 6 are the
 *     drag handle beside it - which is still the largest target on this screen
 *     and the only one that can be hit without looking down;
 *   - **the header says what is inside it while it is shut.** `describeItem`
 *     answers for every arm, including the two that exist because this app
 *     refuses to drop what it cannot read, so a shut row never costs a tap to
 *     find out what it is;
 *   - **the open state is remembered.** Unlike `Disclosure`, which keeps it in
 *     `prefs` under the character's id, this one lives on the record itself:
 *     `SessionItem.collapsed` is a stored field, the GM arranges the list once,
 *     and it is the arrangement they come back to on the other device the
 *     campaign is opened on.
 *
 * Two notes on that last point, both worth knowing before touching this file.
 * Toggling a row writes the campaign - through `commit`, so on the 400 ms
 * debounce rather than per tap. And `readSessionItem` defaults `collapsed` to
 * `false`, so a record written without the field arrives with every row open;
 * that is the store's decision and this file does not second-guess it.
 *
 * ## Moving
 *
 * Two ways, and the second one is not a fallback. The handle at the right edge
 * carries the pointer gesture (`useSessionDrag`), and the open row's footer
 * carries MOVE UP and MOVE DOWN as plain 44px buttons. A hold of 250 ms
 * followed by 60px of accurate travel is a gesture a shaking hand, a trackpad
 * user and anybody driving this from a keyboard cannot perform; two buttons in
 * the row they already have open cost 88px of a footer that had room.
 *
 * ## Deleting
 *
 * Two taps, never one, and the second one names what is being lost. The
 * `unreadable` arm gets its own words because it is the only row in the app
 * whose contents exist nowhere else: the record kept it precisely so it would
 * survive a build that could not read it, and the GM staring at it is the only
 * person who can decide it is no longer wanted.
 */
import { useEffect, useState } from 'react';
import type { SessionItem } from '../../../shared/campaigns.ts';
import { useApp } from '../../store/state.ts';
import { SessionBody } from './SessionBody.tsx';
import { useGm, type GmRegion } from './gmStore.ts';
import type { DragHandleProps } from './useSessionDrag.ts';
import { describeItem, SESSION_KIND_COLOR, SESSION_KIND_LABEL, sessionName, sessionTitle } from './session.ts';

/** MOVE UP / MOVE DOWN: the keyboard's two moves, as targets. */
function Move({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="t-meta"
      style={{
        flex: 'none',
        minHeight: 44,
        padding: '0 10px',
        letterSpacing: '0.1em',
        color: 'var(--dim)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}

/**
 * What the delete control says, in both states.
 *
 * The armed wording for an `unreadable` row is not decoration. Every other row
 * in this list can be rebuilt from the dataset; that one holds bytes that exist
 * nowhere else in the app, kept on purpose by `readSessionItem` so a build that
 * cannot read them still cannot lose them. Deleting it is the one destruction
 * on this screen that nothing can undo, and the button has to say so.
 */
const armedLabel = (item: SessionItem, armed: boolean): string =>
  !armed
    ? 'DELETE'
    : item.kind === 'unreadable'
      ? 'TAP AGAIN TO DELETE THE ONLY COPY'
      : 'TAP AGAIN TO DELETE';

export function SessionRow({
  item,
  position,
  total,
  phone,
  handle,
  lifted,
  onOpenTool,
}: {
  item: SessionItem;
  /** 1-based, because it is spoken: "Reorder Scene one, 1 of 4". */
  position: number;
  total: number;
  phone: boolean;
  handle: DragHandleProps;
  lifted: boolean;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const patch = useGm((s) => s.patchSessionItem);
  const remove = useGm((s) => s.removeSessionItem);
  const move = useGm((s) => s.moveSessionItem);
  const [armed, setArmed] = useState(false);

  // The same four seconds `Scene.tsx` gives its END SCENE: long enough to be a
  // second deliberate tap, short enough that a row left armed in a pocket is
  // not one thumb away from gone.
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const open = !item.collapsed;
  const title = sessionTitle(item);
  const summary = describeItem(item, dataset, index);

  return (
    <li
      className="panel stack"
      style={{
        flex: 'none',
        listStyle: 'none',
        borderLeft: `3px solid ${SESSION_KIND_COLOR[item.kind]}`,
        padding: '4px 6px',
        gap: open ? 8 : 0,
        // A lifted row has to be visibly the one moving, and it is the only
        // thing on this screen that ever leaves the flat surface.
        borderColor: lifted ? 'var(--hope)' : undefined,
        boxShadow: lifted ? '0 6px 18px rgb(0 0 0 / 0.35)' : undefined,
      }}
    >
      <div className="row" style={{ flex: 'none', gap: 6 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => patch(item.id, { collapsed: open })}
        className="row"
        style={{ flex: 1, minWidth: 0, minHeight: 44, gap: 8, padding: '0 2px', textAlign: 'left' }}
      >
        {/*
         * A rotated triangle rather than a glyph from the font, for the reason
         * `Disclosure` gives: the arrow characters sit on different baselines
         * in the two families this app ships, and a marker that jumps three
         * pixels when a row opens reads as the row moving.
         */}
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 8,
            height: 8,
            background: SESSION_KIND_COLOR[item.kind],
            clipPath: open ? 'polygon(0 25%,100% 25%,50% 100%)' : 'polygon(25% 0,100% 50%,25% 100%)',
          }}
        />
        <span
          className="stack"
          style={{ flex: 1, minWidth: 0, gap: 2, alignItems: 'flex-start' }}
        >
          <span
            title={title.text}
            style={{
              font: '700 15px/1.2 var(--sans)',
              // An invented name is drawn as what it is - the kind word
              // standing in for a name the GM never gave - and never written
              // back onto the record.
              color: title.invented ? 'var(--dim)' : 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {title.text}
          </span>
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            {SESSION_KIND_LABEL[item.kind].toUpperCase()}
          </span>
        </span>
        {/*
          Reserved 130px of the 357px panel width, ellipsised, with the whole
          string on `title`. It has to be one line: a summary that wraps grows
          the 44px header, and the header's height is the thing that makes nine
          rows fit on a phone.
        */}
        <span
          className="t-meta"
          title={summary}
          style={{
            flex: 'none',
            maxWidth: 130,
            color: 'var(--muted)',
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </span>
      </button>

      {/*
        The handle is at the right edge of every row - x 313-357 on a 393px
        phone - which is the easiest horizontal reach for a right thumb across
        the whole column, and where iOS has put this control since it invented
        it. It is a sibling of the disclosure and not inside it, because a
        button may not contain a button; the header keeps 307 of the 357.

        `touch-action: none` is on this square alone, 12% of the row's width,
        so the other 88% still scrolls the list under the same thumb.
      */}
      <button
        type="button"
        {...handle}
        aria-label={`Reorder ${sessionName(item)}, ${position} of ${total}`}
        style={{
          ...handle.style,
          flex: 'none',
          width: 44,
          height: 44,
          display: 'grid',
          placeItems: 'center',
          gap: 3,
          borderRadius: 'var(--r2)',
          background: lifted ? 'var(--raised)' : 'transparent',
        }}
      >
        {/* Three bars, drawn rather than typed: the glyphs that mean "grab" sit
            on different baselines in the two families this app ships. */}
        <span aria-hidden="true" style={{ display: 'grid', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 15, height: 2, background: 'var(--dim)' }} />
          ))}
        </span>
      </button>
      </div>

      {open && (
        <div className="stack" style={{ gap: 10, padding: '2px 2px 8px' }}>
          <SessionBody item={item} phone={phone} onOpenTool={onOpenTool} />
          <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/*
              The same two moves as the handle, without a pointer and without a
              hold. An open row is where a GM is already looking when they
              decide it belongs earlier, and a 44px button is a target a shaking
              hand can hit where a 250ms hold plus 60px of travel is not.
            */}
            <Move
              onClick={() => move(item.id, position - 2)}
              disabled={position === 1}
              label={`MOVE UP — ${sessionName(item)}`}
            >
              MOVE UP
            </Move>
            <Move
              onClick={() => move(item.id, position)}
              disabled={position === total}
              label={`MOVE DOWN — ${sessionName(item)}`}
            >
              MOVE DOWN
            </Move>
            <button
              type="button"
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                remove(item.id);
              }}
              className="t-meta"
              // The name says which row, because a list of identical "DELETE"
              // buttons is a list a screen reader cannot tell apart - and it
              // begins with the words on the button, so the two agree (WCAG
              // 2.5.3), including in the armed state where the words change.
              aria-label={`${armedLabel(item, armed)} — ${sessionName(item)}`}
              style={{
                flex: 'none',
                minHeight: 44,
                padding: '0 10px',
                letterSpacing: '0.1em',
                color: armed ? 'var(--damage)' : 'var(--dim)',
                fontWeight: armed ? 600 : undefined,
              }}
            >
              {armedLabel(item, armed)}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
