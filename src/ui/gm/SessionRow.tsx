/**
 * One row of the night.
 *
 * A *tendina*, the same idea `Disclosure` already carries for the character
 * sheet, with the three rules that made that one honest applied here:
 *
 *   - **the whole header is the target**, not a chevron. 44px tall and 303 of
 *     the 353px the panel has on a 393px phone - the remaining 44 + 6 are the
 *     drag handle beside it - which is still the largest target on this screen
 *     and the only one that can be hit without looking down. (**303 and 353,
 *     not the 307 and 357 that stood here.** Both were arithmetic that spent
 *     the panel's 12px of padding and forgot its border: `.panel` is a 1px box
 *     and this row overrides the left edge to a 3px stripe, so 369 less 4 less
 *     12 is 353. Measured in Chrome at 393px, against this file's declared
 *     padding and gap.);
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
 * followed by half a `ROW_STEP` of accurate travel for every place moved is a
 * gesture a shaking hand, a trackpad user and anybody driving this from a
 * keyboard cannot perform; two buttons in the row they already have open cost
 * 88px of a footer that had room. (The step is named rather than costed here on
 * purpose: it stood at "60px of accurate travel" while `ROW_STEP` was 62, and
 * a pitch this sentence copies is a pitch this sentence can get wrong again.)
 *
 * ## Deleting
 *
 * Two taps, never one, and the second one names what is being lost. The
 * `unreadable` arm gets its own words because it is the only row in the app
 * whose contents exist nowhere else: the record kept it precisely so it would
 * survive a build that could not read it, and the GM staring at it is the only
 * person who can decide it is no longer wanted.
 *
 * ## Renaming
 *
 * The name was the one thing on this row nothing could change. `AddSheet`
 * types it once and every row minted by a countdown or by an unreadable record
 * never had one at all, so a night's list filled up with rows called "Scene",
 * "Scene" and "Scene" and there was no way back to them.
 *
 * RENAME is a verb in the open row's footer, and the field it arms *replaces*
 * that footer rather than appearing above it. Three reasons, and the first is
 * the only one that would matter on its own:
 *
 *   - the field lands where the thumb already is. The list is a scroller and
 *     an open encounter row draws a roster, three adjustment chips, a rule
 *     quoted out of the dataset and four verbs, so the header is routinely
 *     scrolled off the top while the footer is under the finger. A field
 *     beside the name - which is where the name is, and where a rename
 *     obviously belongs - would open where that person is not looking;
 *   - it costs no height. The footer is one 44px line and every control the
 *     field draws declares `var(--tap)`, and with no `judge` there is no
 *     refusal region under it - so arming the rename moves nothing above or
 *     below it;
 *   - DELETE leaves the screen while a name is being typed. The two would live
 *     in the same 44px band, and the one destructive control on this row is
 *     worth taking out from under a thumb that is aiming at SAVE.
 *
 * RENAME is first in the footer rather than last, which is the least reachable
 * end of a right-aligned row: appending it would have put a benign verb where
 * a thumb has learned to find DELETE. Measured in Chrome at 393px, with the
 * shipped IBM Plex Mono and this file's declared padding and gap, the four
 * verbs are 62 + 69 + 83 + 62 and lay out on one 44px line inside the 349px
 * this footer has - 393 less the list's 12px page padding either side, less
 * the panel's 3px stripe and 1px border and 6px padding either side, less the
 * open block's 2px either side.
 *
 * **The whole footer empties while DELETE is armed, and that is the
 * measurement's doing.** "TAP AGAIN TO DELETE" is 153px where DELETE is 62,
 * and RENAME beside it made the row 391 against 349 - the armed button dropped
 * to a second line 52px lower, out from under the finger that has four seconds
 * to press it again. So RENAME was not drawn while `armed`.
 *
 * Decision 18 added a fourth wording. A scene row holding a fight arms to
 * "TAP AGAIN TO DELETE THE FIGHT" - 29 characters, and at the 7.0px per
 * character this file's own two measured points give (DELETE 62 at 6, TAP
 * AGAIN TO DELETE 153 at 19), that is 223px. With MOVE UP and MOVE DOWN it is
 * 69 + 83 + 223 = 375 of 349, so arming the row would wrap it: the same defect,
 * one wording later.
 *
 * **The 223 is no longer derived: it was measured, and it is 223.00.** Chrome,
 * `pointer: coarse`, insets 47/34, a scene row holding twelve adversaries,
 * armed by tapping DELETE - `AUDIT_ORIGIN=http://localhost:5207 node run.mjs
 * cases-row.json`, ids `foot-393x852` and `foot-375x667`. The plain footer is
 * 62.00 / 69.00 / 83.00 / 62.00 on one 44.00px line, and the armed one is a
 * single 223.00 x 44.00 button, on one line in a 349.00 footer at 393x852 and
 * in a 331.00 one at 375x667. The slope-and-intercept the two points give -
 * 7.0px a character over 20px of padding - lands on the pixel, so it may be
 * used for a fifth wording; the emptying rule above is what it is checked
 * against.
 *
 * So MOVE UP and MOVE DOWN leave while armed too, unconditionally, beside
 * RENAME. The armed footer becomes the single button in every case - 223 fits,
 * today's 153 fits, and the unreadable row's "TAP AGAIN TO DELETE THE ONLY
 * COPY" at 251px stops wrapping, which it has done since it was written. The
 * rule is unconditional so that the shape of this footer never depends on
 * state the GM is not looking at, which is the objection `Scene.tsx` raises
 * against a control whose tap count varies.
 *
 * No rule is passed to the field. A night is *expected* to hold rows with no
 * name and rows with the same name - `judgeName`'s sentences are about a
 * `<select>` of characters, not about a list a GM ordered by hand - so
 * `NameField` is given no `judge` and refuses nothing. `sessionTitle` decides
 * what an empty name reads as, so the kind word is what the field shows as its
 * placeholder - and what the cancel target names, on a row that has none.
 *
 * ## The numbers are on the type row, not on the name
 *
 * `describeItem`'s line used to be a third column, capped at 130px, and the
 * name took whatever was left of the header. Measured at 393px with that
 * column at its cap, the name had **145px**; without it the name and the type
 * row have the header's whole **283px**. So a name was ellipsised to make room
 * for "4/6", and the number sat against the name as though it were part of it.
 *
 * It is on the second line now, opposite the kind word, and the name has the
 * header to itself. Both halves of that line are `t-meta`: the kind word says
 * what sort of row this is, the summary says what is in it, and neither is a
 * name. This is decision 6 of `docs/handoff/DECISIONI-2026-08-18.md` - numbers
 * on the type row, not on the name - and it costs no height, because the
 * header was already two lines tall.
 */
import { memo, useEffect, useState } from 'react';
import type { SessionItem } from '../../../shared/campaigns.ts';
import { useApp } from '../../store/state.ts';
import { NameField } from '../shared/RenameField.tsx';
import { SessionBody } from './SessionBody.tsx';
import { useGm, type GmRegion } from './gmStore.ts';
import type { DragHandleProps } from './useSessionDrag.ts';
import { describeItem, SESSION_KIND_COLOR, SESSION_KIND_LABEL, sessionName, sessionTitle } from './session.ts';

/**
 * The footer's plain verbs: RENAME, MOVE UP, MOVE DOWN.
 *
 * DELETE is not one of them and is written out below, because its words and
 * its colour both change when it is armed and a shared component that took
 * those as props would be this one plus an `if`.
 */
function RowVerb({
  onClick,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  /** Only the two moves can be unavailable; RENAME never is. */
  disabled?: boolean;
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
    : item.kind === 'scene' && item.combatants.length > 0
      ? 'TAP AGAIN TO DELETE THE FIGHT'
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
  // The same number `SessionBody`'s encounter arm and the builder expand a
  // Minion entry with, so a shut row and the row it opens into cannot disagree
  // about how many adversaries the plan holds.
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const patch = useGm((s) => s.patchSessionItem);
  const remove = useGm((s) => s.removeSessionItem);
  const move = useGm((s) => s.moveSessionItem);
  /*
   * ONE STRING, never the list it was read out of.
   *
   * This used to be `useGm((s) => s.session)`, passed whole to `describeItem`
   * so that a scoped countdown's shut row could name its scene. That made
   * every row of the plan a subscriber to the whole session array, which is
   * the one subscription that cannot be memoised away: `React.memo` compares
   * props, and a store read is not a prop. So a change to any row - and, once
   * a fight lives on a scene row, a single HP mark - woke every row in the
   * list.
   *
   * A selector that returns a string or `null` is compared by value, so this
   * row now wakes for a change to the name of the scene ITS OWN clock belongs
   * to, and for nothing else. The `find` still runs on every store change; it
   * is a scan, not a render, and it is skipped entirely on the six arms that
   * have no scope to resolve.
   *
   * `sessionName` and not `row.name`: a scene with no name is called `Scene`
   * everywhere else in this app, and a clock belonging to one has to say the
   * same word its owner's own header says.
   */
  const ownerName = useGm((s) => {
    if (item.kind !== 'countdown' || item.sceneId === null) return null;
    const owner = s.session.find((i) => i.kind === 'scene' && i.id === item.sceneId);
    return owner === undefined ? null : sessionName(owner);
  });
  /*
   * Read here and nowhere else in this file, for the shut header's summary.
   * Until this list read the pointer, two scene rows with a fight between them
   * said the same thing.
   *
   * It is the pointer and not a fight: the fight lives on the row, so every row
   * can say how many bodies it holds without asking anything outside itself,
   * and the one thing it still cannot work out alone is whether it is the row
   * on the glass. That is the whole of what this subscription buys - and it
   * yields a string, so this is not what wakes a row when a mark lands on some
   * other one.
   */
  const openScene = useGm((s) => s.openScene);
  const [armed, setArmed] = useState(false);
  const [renaming, setRenaming] = useState(false);

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
  const summary = describeItem(item, dataset, index, partySize, ownerName, openScene);
  const row = sessionName(item);

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
        onClick={() => {
          // Shutting the row abandons a rename in progress rather than hiding
          // it: `armed` clears itself after four seconds and this does not, so
          // without this a row shut mid-rename would reopen, days later on
          // another device's copy of the arrangement, with a field over its
          // footer and nothing to say why.
          setRenaming(false);
          patch(item.id, { collapsed: open });
        }}
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
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {/*
            The whole header, minus the marker and the handle. It used to be
            whatever the summary's reserved 130px left over - 145px of the
            header's 283, measured - which ellipsised the one string on this
            row a GM chose themselves in order to make room for "4/6".
          */}
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
          {/*
            The type row: what sort of row this is on the left, what is inside
            it on the right. The summary takes the width the kind word leaves
            and ellipsises into it, with the whole string on `title`. It stays
            one line because the height of a shut row has to be a constant, and
            a summary somebody typed is not.

            Measured in Chrome at 393x852, one line: this inner `span.stack`
            is 30.00 tall - name 18.00, 2px gap, type row 10.00 - inside a
            44.00 button whose `min-height: 44px` is what sets that 44. So the
            text does not set this row's height; the floor does, with 14.00 to
            spare above the text.

            The wrapped case was measured too, in the same run, by lifting
            `whiteSpace` off this span and giving it strings that wrap. The
            14.00 absorbs exactly one extra line and no more: at two lines the
            stack is 40.00 and neither the button nor the card moves (44.00 and
            54.00); at three the stack is 50.00, the button 50.00, the card
            60.00, and the list's step goes with them. So what this comment
            used to say - that a summary that wrapped would grow the 44px
            header - is not what the browser does. One wrap is free.

            The argument that actually carries `whiteSpace: nowrap` never
            needed that claim, or the row count it was propping up: a summary
            is a string a GM typed and has no length limit, so a header whose
            height follows it is not a constant. The list below steps by a
            fixed amount per shut row, and a row that is 54.00 or 60.00
            depending on what was typed into it is not a step at all.

            What the step buys is in `SessionList.tsx`: eight shut rows whole
            on a 393x852 phone with a 47/34 safe area, a ninth cut by the fold
            but still legible, ten in bare Chrome with no inset. The "nine
            rows" that stood here was arithmetic that never counted `.panel`'s
            horizontal borders - the same 1px that file's own "303 and 353"
            note caught along the other axis. Change that sentence and this one
            together; they are one claim said twice.
          */}
          <span className="row" style={{ alignSelf: 'stretch', gap: 8, justifyContent: 'space-between' }}>
            <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
              {SESSION_KIND_LABEL[item.kind].toUpperCase()}
            </span>
            <span
              className="t-meta"
              title={summary}
              style={{
                flex: 1,
                minWidth: 0,
                color: 'var(--muted)',
                textAlign: 'right',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {summary}
            </span>
          </span>
        </span>
      </button>

      {/*
        The handle is at the right edge of every row - **x330-374 on the glass
        of a 393px phone** - which is the easiest horizontal reach for a right
        thumb across the whole column, and where iOS has put this control since
        it invented it. It is a sibling of the disclosure and not inside it,
        because a button may not contain a button; of the panel's 353px content
        box the header keeps 303, the gap takes 6, and these last 44 are the
        handle.

        (**x330-374, not the x309-353 that stood here.** 309-353 was measured
        from the left of the panel's content box, and every other `x` range in
        this repo is measured from the left of the glass: `Conditions.tsx`'s
        `landed on CLEAR ALL, at x283.6-364`, `GearPicker.tsx`'s
        `chip's box was x324.30-368.30`, `Vitals.tsx`'s `door x267 at 393`.
        Mixing the two frames is the defect `playSheet.test.tsx` names in as
        many words, in the numbered item that opens «a right edge of 364.61 in
        a 369px column»: "364.61 is an offset from the left of the glass and
        369 is a width". The panel's content box starts 21px in - the 12px
        either side of the list scroller's phone padding in `SessionList.tsx`,
        this row's own `borderLeft: 3px solid` stripe and the 6px either side
        of its `padding: '4px 6px'` - so 21 + 309 = 330 and 21 + 353 = 374.
        The sentence beside it keeps the panel frame because it names the
        frame.

        Named by declaration and by quoted fragment rather than by line, because
        four of those five files belong to other passes and a line number in one
        of them is stale as soon as anybody inserts above it. The 21 is held in
        `gmGeometryProse.test.ts` against the three declarations that make it.)

        `touch-action: none` is on this square alone, 12% of the row's width,
        so the other 88% still scrolls the list under the same thumb.
      */}
      <button
        type="button"
        {...handle}
        aria-label={`Reorder ${row}, ${position} of ${total}`}
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
          {renaming ? (
            /*
              In the footer's place, not above it: see the docblock. The field
              is mounted fresh each time RENAME is tapped, so its draft starts
              at the stored name every time rather than at whatever was
              abandoned last.

              No `judge`, and the kind word for `emptyReads`, because that is
              what `sessionTitle` already draws for a row with no name - so
              clearing the field shows the row's own placeholder before
              anything is written, and SAVE stores `''` rather than the word.
            */
            <NameField
              value={item.name}
              fieldLabel={`New name for ${row}`}
              emptyReads={SESSION_KIND_LABEL[item.kind]}
              subject={row}
              /*
                A countdown row carries the name twice and both copies are
                drawn. `addCountdown` writes one string into `item.name` and
                into `item.countdown.name` - the row's header reads the first,
                `countdownsOf` hands the second to the countdowns board, to
                `SessionBody`'s own two buttons and to the pinned line in
                `GmTopBar` - so a rename that moved only one of them would
                leave the same countdown called two things on three screens.
                This is the only place either can now change, and it changes
                both. `commit` rederives `countdowns` from `session`, so the
                board updates with the row.
              */
              onCommit={(name) =>
                patch(
                  item.id,
                  item.kind === 'countdown'
                    ? { name, countdown: { ...item.countdown, name } }
                    : { name },
                )
              }
              onDone={() => setRenaming(false)}
            />
          ) : (
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {/*
                First, which is the far end of a right-aligned row: appending it
                would have put a benign verb where a thumb has learned to find
                DELETE. And gone while DELETE is armed, because the four verbs
                fit on one line at 393px only until DELETE grows to "TAP AGAIN
                TO DELETE" - see the docblock, which has both measurements.
              */}
              {!armed && (
                <RowVerb onClick={() => setRenaming(true)} label={`RENAME — ${row}`}>
                  RENAME
                </RowVerb>
              )}
              {/*
                The same two moves as the handle, without a pointer and without a
                hold. An open row is where a GM is already looking when they
                decide it belongs earlier, and a 44px button is a target a shaking
                hand can hit where a 250ms hold plus half a `ROW_STEP` of travel
                per place is not.
              */}
              {!armed && (
                <>
                  <RowVerb
                    onClick={() => move(item.id, position - 2)}
                    disabled={position === 1}
                    label={`MOVE UP — ${row}`}
                  >
                    MOVE UP
                  </RowVerb>
                  <RowVerb
                    onClick={() => move(item.id, position)}
                    disabled={position === total}
                    label={`MOVE DOWN — ${row}`}
                  >
                    MOVE DOWN
                  </RowVerb>
                </>
              )}
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
                aria-label={`${armedLabel(item, armed)} — ${row}`}
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
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The row as the plan list mounts it, and the reason this file has two exports
 * for one component.
 *
 * `SessionList` renders this and never `SessionRow` directly. The property it
 * buys - *a change to one row does not repaint the others* - is a property of
 * the LIST and not of a row, which is also why the memo is applied here at the
 * seam rather than folded into the declaration above.
 *
 * It has to be a second name rather than `export const SessionRow =
 * memo(...)`, and the reason is worth writing down because it will catch the
 * next person too. `tests/ui/screens.test.tsx` finds every component in
 * `src/ui` by scanning the source with two regexes - one for `export
 * function`/`export class`, one for `export const Name = (` - and mounts each
 * one it finds from a fixture registry, so that no component ships on a render
 * path no test has executed. `export const Name = memo(` matches neither.
 * `SessionRow` would vanish from that scan and take its own fixture down with
 * it, as a fixture for a component that no longer exists. Checked, not
 * assumed: both patterns were run over both spellings. So the declaration
 * above stays a plain `export function`, mounted by that harness exactly as it
 * is today, and the memoised seat is this - which the scan does not see
 * either, and does not need to, because mounting the list mounts it.
 *
 * ## What makes it bite, prop by prop
 *
 * A memo whose props are rebuilt on every render is a memo that never skips a
 * render, and it passes every check that only asks whether `memo` was called.
 * So all seven were audited, and one of them was exactly that defect:
 *
 *   - `item` - the row's own object out of `session`. `patchSessionItem`
 *     rebuilds the one row it is given and passes the rest through its `.map`
 *     untouched, so a row nobody edited keeps its identity. Not every writer
 *     does, and must not: `moveSessionItem` and `removeSessionItem` restamp
 *     `order` on all of them, because every row's place changed. This is the
 *     prop the whole memo turns on;
 *   - `position`, `total`, `phone`, `lifted` - a number, a number, a boolean
 *     and a boolean, compared by value;
 *   - `onOpenTool` - `Gm.tsx`'s `openTool`, `useCallback`'d on `[setRegion]`,
 *     and a zustand action's identity never changes. Stable;
 *   - `handle` - **was a fresh object literal on every render of the list.**
 *     `SessionList` called `drag.handleProps(item, i)` inline, and that call
 *     builds a new object with two new closures in it every time, so a shallow
 *     comparison could never find two of them equal and this memo would have
 *     skipped precisely nothing. `SessionList.tsx` now hands over the same
 *     object for as long as its inputs are the same object; the argument for
 *     how is there, beside the cache that does it.
 *
 * None of that gates a STORE read. Every row subscribes to `openScene`, so the
 * pointer moving still wakes all of them - correctly, since each of them is
 * drawing whether it is the one on the table. What the memo removes is the
 * repaint that carries no news.
 *
 * `tests/gm/sessionList.test.tsx` holds it by counting renders, not by asking
 * whether `memo` was called.
 */
export const MemoSessionRow = memo(SessionRow);
