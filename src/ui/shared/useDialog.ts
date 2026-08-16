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

/** Spread onto the overlay element - the one that is `position: fixed; inset: 0`. */
export interface DialogProps {
  ref: React.RefObject<HTMLDivElement | null>;
  role: 'dialog';
  'aria-modal': true;
  'aria-label': string;
  /** So the container can hold focus. It is not a stop on the Tab cycle. */
  tabIndex: number;
  /** A tap on the backdrop. Every panel inside stops the click itself. */
  onClick: () => void;
}

export function useDialog(label: string, onClose: () => void): DialogProps {
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
      if (e.key !== 'Tab' || box === null) return;

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
    'aria-modal': true,
    'aria-label': label,
    tabIndex: -1,
    onClick: () => close.current(),
  };
}
