/**
 * What makes an overlay a dialog rather than a picture of one.
 *
 * Six overlays in this app carried `role="dialog"` and `aria-modal="true"` and
 * did none of the three things those two attributes promise. `aria-modal` tells
 * a screen reader "nothing outside this node exists"; the browser was never
 * told, so Tab walked straight out of the panel and off down the page
 * underneath - through the tab bar, the header, and every control on the screen
 * the overlay was drawn over. Opening one left focus on the button behind it,
 * so the first Tab went to whatever followed that button rather than into the
 * thing that had just appeared, and closing one dropped focus to the top of the
 * document. On a phone with a Bluetooth keyboard, or with VoiceOver, that is a
 * dialog you can read and cannot reach: the sentence the markup says is not
 * true of the code behind it.
 *
 * The six, all routed through here:
 *   shared/DomainCardView.tsx  CardReader
 *   build/GearPicker.tsx       PickerDialog  (weapons, armor, items)
 *   player/Companion.tsx       CompanionSheet
 *   player/Conditions.tsx      ConditionsDialog
 *   player/DeathMove.tsx       DeathMoveDialog
 *   player/Beastform.tsx       Picker
 *
 * Where the focus lands, and why it is the dialog and not its first control.
 * The APG allows either. Here the first focusable in DOM order is the way out
 * in two of the six - the reader's only button is CLOSE, and the gear picker
 * leads with a 44 x 44 "✕" in the top-right - so focusing it would announce
 * "Close, button" as the panel opens and hand a screen-reader user the exit
 * before a word of the content. The other four lead with a Stress-cost chip, a
 * condition toggle, a death-move option or the companion's name field, which is
 * no better: each of them starts the reading part-way down. So focus goes to
 * the dialog element itself, which announces the dialog's name and its role and
 * leaves Tab to walk the panel from the top in the order it is drawn.
 *
 * This costs zero pixels. Nothing here moves, resizes or adds a control: every
 * target keeps the size it had, the 44px floor is untouched, and on a 390px
 * phone - which has no Tab key and no Escape key - the whole change is
 * invisible. It is for the keyboard and the screen reader, which is exactly the
 * user the six overlays were leaving standing on the page underneath.
 *
 * Escape lives here now rather than in six copies of the same effect. It is the
 * same handler on the same target (`window`, keydown) that each dialog already
 * had, so the behaviour is unchanged; what is gone is the fifth and sixth copy
 * of it, and the chance that the seventh dialog gets the trap and forgets the
 * key or the other way round.
 *
 * ## `modal: false`, and why it is not a hole in the paragraph above
 *
 * The argument at the top of this file is not "every dialog should trap". It is
 * that `aria-modal="true"` is a SENTENCE - *nothing outside this node exists* -
 * and that a node saying it while Tab walks out is a lie. There are two ways to
 * stop telling that lie, and this hook shipped with one of them. The other is
 * the one the GM screen needs.
 *
 * `GmSheet` draws a tool over the session list while `GmTopBar` and `GmBar`
 * stay on the glass either side of it, because the Fear pool is spent from
 * inside every tool and the owner's second recorded decision for that screen is
 * that the night is a sheet rather than a modal. Under a trap those bars were
 * covered and keyboard-unreachable; under `aria-modal="true"` they were also
 * *announced as not existing*, which is the same false sentence pointing the
 * other way. So the third argument to this hook turns both halves off together,
 * and they are one argument rather than two on purpose: a caller that could
 * keep the claim and drop the trap would be able to rebuild the exact defect
 * the six overlays were repaired for.
 *
 * It is written `aria-modal="false"` rather than left off. Absence is the ARIA
 * default and would be correct, but absence is also what a dialog that simply
 * forgot the attribute looks like - and forgetting is the failure this file
 * exists because of. `false` is a decision on the page, greppable, and a test
 * can tell it from an omission.
 *
 * Escape and the focus return stay in both modes. Neither is a claim about what
 * else exists: one is the way out, and the other is where the hand was.
 *
 * ## What widening the attribute took away, and what holds it now
 *
 * `DialogProps['aria-modal']` was the literal `true`. That literal was doing
 * real work: it was the ONLY thing in the repo holding the six overlays above
 * to `aria-modal="true"`, and widening it to `boolean` so this hook could serve
 * the GM sheet deleted a guard without replacing it. Nothing went red. A build
 * that shipped `aria-modal="false"` on all seven while six of them trapped Tab
 * would have been green, and that is the same lie as the one at the top of this
 * file, told the other way.
 *
 * So it is carried twice, and the two halves guard different things.
 *
 * The TYPE guards the call sites: `DialogProps` is generic in the flag, the
 * default overload returns `DialogProps<true>` and the `{ modal: false }`
 * overload returns `DialogProps<false>`. The parameter is the thing that
 * varies; the attribute follows it, so no caller can hand this hook a `boolean`
 * decided at runtime and no caller can spread a dialog whose claim is unknown.
 * What the type cannot do is watch the line below that builds the object - the
 * implementation is compatible with `boolean` by construction.
 *
 * The TEST guards that line: `tests/ui/dialogs.test.tsx` asks each of the six,
 * through the component a person actually opens, for `aria-modal="true"`, in
 * the same `describe` that proves the trap those two words are a claim about.
 * That is the assertion that goes red if this returns `false` for everyone, and
 * it is deliberately in the file that enumerates the six rather than in a
 * second list of them.
 */
import { useEffect, useRef } from 'react';

/**
 * Where a Tab can land. `[tabindex]:not([tabindex="-1"])` is what picks up the
 * app's own roving-tabindex controls; the dialog element carries -1 itself and
 * is deliberately not in this list, so once focus has left the container it
 * cycles through the controls rather than back through the box around them.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Spread onto the overlay element - the one that is `inset: 0` over whatever it
 * is drawn against. Six of the seven call sites make that `position: fixed`
 * against the window; `GmSheet` makes it `position: absolute` against the band
 * between the GM screen's two bars, which is the whole of how those bars stay
 * on the glass.
 */
export interface DialogProps<Modal extends boolean = boolean> {
  ref: React.RefObject<HTMLDivElement | null>;
  role: 'dialog';
  /**
   * True exactly where Tab is actually trapped, and generic so that the two
   * cannot come apart at a call site: pass nothing and this is `true`, pass
   * `{ modal: false }` and it is `false`. See `modal` below, and the section
   * on it above for what the type does and does not hold.
   */
  'aria-modal': Modal;
  'aria-label': string;
  /** So the container can hold focus. It is not a stop on the Tab cycle. */
  tabIndex: number;
  /**
   * A tap on the backdrop. Every panel inside stops the click itself.
   *
   * Whether there IS a backdrop to tap is the overlay's business, not this
   * hook's, and one of the seven leaves none: a `full` `GmSheet` on a phone
   * pads nothing and fills its stage, so this handler is live and unreachable
   * there. That file states it and takes the consequence.
   */
  onClick: () => void;
}

/**
 * The six. `aria-modal="true"` and the Tab trap, which is what those two words
 * promise, and the two are one decision rather than two.
 */
export function useDialog(
  label: string,
  onClose: () => void,
  options?: { modal?: true },
): DialogProps<true>;
/**
 * The GM sheet. Neither the claim nor the trap, given up together, because live
 * controls sit outside this one on purpose. `GmSheet.tsx` argues it.
 */
export function useDialog(
  label: string,
  onClose: () => void,
  options: { modal: false },
): DialogProps<false>;
export function useDialog(
  label: string,
  onClose: () => void,
  options?: {
    /**
     * Whether this overlay owns the document: `aria-modal="true"` and the Tab
     * trap, together. Default `true`, which is the six overlays this hook was
     * written for and every call site that passes nothing. It is a literal at
     * every call site and the overloads above keep it one - a flag computed at
     * runtime would be a dialog whose claim nobody can read off the source.
     */
    modal?: boolean;
  },
): DialogProps<boolean> {
  const modal = options?.modal ?? true;
  const ref = useRef<HTMLDivElement>(null);

  // Read through a ref, not captured. Every call site passes an inline
  // `() => setOpen(false)`, so `onClose` is a new function on every render of
  // the parent - as a dependency it would re-run the effect below on every
  // store change, which for an Escape listener was harmless and for a focus
  // move is not: focus would jump back to the panel mid-edit each time.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  // Through a ref for the same reason `onClose` is, and not because any caller
  // changes it: the effect below is deliberately `[]`, so a value it reads has
  // to be a value that cannot go stale in it. Every call site passes a literal.
  const trapping = useRef(modal);
  useEffect(() => {
    trapping.current = modal;
  }, [modal]);

  // Taken on the first render rather than in the effect, and this has to be:
  // the gear picker's search box carries `autoFocus`, React applies that during
  // the commit, and by the time an effect runs the element that opened the
  // dialog is no longer what `document.activeElement` says. Lazy ref
  // initialisation, which is the one write-during-render React sanctions.
  const opener = useRef<Element | null>(null);
  opener.current ??= document.activeElement;

  useEffect(() => {
    const opened = opener.current;
    // Not unconditional, for the same `autoFocus`: where a dialog has already
    // put focus on the control it wants, taking it back to the container would
    // undo a deliberate choice - the picker focuses its search box on a desktop
    // and never on a phone, and that decision is the picker's to make.
    const root = ref.current;
    if (root !== null && !root.contains(document.activeElement)) root.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close.current();
        return;
      }
      const box = ref.current;
      if (e.key !== 'Tab' || box === null || !trapping.current) return;

      const stops = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const last = stops.length - 1;
      // -1 is either the container itself, holding focus from the open, or
      // something outside the dialog entirely. Both want the near edge.
      const wrap = e.shiftKey
        ? at <= 0
          ? stops[last]
          : undefined
        : at === -1 || at === last
          ? stops[0]
          : undefined;
      if (wrap === undefined && at !== -1) return; // mid-list: the browser is right
      e.preventDefault();
      (wrap ?? box).focus();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // Back to the control that opened it - unless that control is gone,
      // which happens when the dialog is what removed it.
      if (opened instanceof HTMLElement && document.contains(opened)) opened.focus();
    };
  }, []);

  return {
    ref,
    role: 'dialog',
    'aria-modal': modal,
    'aria-label': label,
    tabIndex: -1,
    onClick: () => close.current(),
  };
}
