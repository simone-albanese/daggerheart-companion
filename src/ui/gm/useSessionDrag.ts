/**
 * Reordering the night, with a thumb and with a keyboard.
 *
 * *"Sarebbe fighissimo se tu potessi fare oui, oui, e te li metti dove vuoi."*
 * This is the gesture that makes the session list a plan rather than a log: an
 * order the GM decided beforehand is worth nothing if changing it on the fly
 * means deleting a row and building it again.
 *
 * ## The three numbers, and why they are those numbers
 *
 * **250 ms to lift.** It is iOS's own drag latency, and it is below the ~500 ms
 * at which Safari offers a text-selection callout - so the row lifts before the
 * browser decides the GM is trying to select something. Anything shorter and
 * the first pixel of a scroll becomes a reorder.
 *
 * **8 px of slop.** Below the lift, a move further than this is a *scroll*, and
 * the gesture is abandoned outright rather than waiting to see. The list under
 * the same thumb has to stay scrollable, which is the whole reason
 * `touch-action: none` goes on the handle alone - 44px of a 369px column, about
 * 12% - and not on the row.
 *
 * **62 px a step, and it is not a fallback.** `rowStep` defaults to `ROW_STEP`
 * and `SessionList.tsx` passes no override, so this number is what every drag
 * divides by in every browser - nothing here measures a row, and the sentence
 * that called it "a fallback as much as a constant" was describing a
 * measurement this hook has never taken.
 *
 * It is the shut row plus the list gap, and both are declared: `.panel`'s two
 * borders, `SessionRow`'s two 4px paddings and its header's 44px floor make a
 * **54.00** card, and the `<ol>` sets `gap: 8`. Measured in Chrome at 393x852
 * with the rig in `AUDIT-HANDOFF.md`, four shut rows sit at 222 / 284 / 346 /
 * 408, which is 62.00 between them, and `SessionList.tsx` states the same 54.00
 * and 62.00 from the same declarations.
 *
 * It stood at **60** until that measurement, because 8px of panel padding was
 * counted and 2px of panel border was not - the same missing hairline that this
 * corner has now been corrected for in four files. 60 was never felt: to be one
 * place out, `steps` has to round 62n/60 past n + 0.5, which first happens at
 * n = 15, and this region holds eight to ten shut rows. It is corrected because
 * a constant two pixels off the pitch it is named after is a claim the code
 * contradicts, not because a GM could see it.
 *
 * One number cannot be the pitch of an *open* list, and it does not pretend to
 * be: opening the first scene row measures it at 384.72, so the row below it
 * moves 392.72. The drag is a shut-list gesture - it is how a plan written in
 * advance gets reordered - and 62.00 is the shut list's pitch.
 *
 * ## Why window listeners and not `setPointerCapture`
 *
 * Capture is the tidier API and it strands the gesture: a browser that drops
 * capture mid-drag - and iOS drops it for a system gesture, the notification
 * shade, an incoming call - leaves the row lifted with no event ever arriving
 * to put it down. `pointercancel` on `window` is the event that actually fires
 * there, and it is handled here, which is the difference between a row that
 * comes back and a screen that has to be reloaded.
 *
 * ## Rounding, stated as arithmetic rather than as a feeling
 *
 * The target is absolute - the index the row started at plus the number of
 * steps travelled - so a drag is idempotent and a mid-gesture reorder cannot
 * compound. `steps` rounds symmetrically: half a step is a step, in both
 * directions. Plain `Math.round` is not symmetric here, because `Math.round(-0.5)`
 * is `-0` and `Math.round(0.5)` is `1`, which would make dragging up feel
 * stickier than dragging down by exactly one row height's worth of travel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionItem } from '../../../shared/campaigns.ts';
// The same name the row's own controls announce, and the same promise that it
// is never empty. A second copy of "an unnamed scene is called Scene" is how
// the handle ends up saying something the DELETE button beside it does not.
import { sessionName } from './session.ts';

export interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  'aria-keyshortcuts': string;
  /**
   * Three declarations, and each one is load-bearing on iOS. `touchAction`
   * stops the browser claiming this square for a scroll; `WebkitTouchCallout`
   * stops the long press offering a callout over the row being lifted -
   * `touch-action` alone does not - and `userSelect` stops it selecting the
   * text underneath instead.
   */
  style: React.CSSProperties;
}

export interface SessionDrag {
  /** The id of the row currently lifted, or null. */
  lifted: string | null;
  handleProps: (item: SessionItem, index: number) => DragHandleProps;
}

export const LIFT_MS = 250;
export const SLOP_PX = 8;
/**
 * The shut row (54.00) plus the list gap (8), which is the pitch measured
 * between shut rows at 393x852. Nothing measures it at runtime: this is the
 * step, not a fallback for one. See the docblock above.
 */
export const ROW_STEP = 62;

export const KEY_SHORTCUTS = 'ArrowUp ArrowDown Home End';

/** Half a step is a step, upwards as well as downwards. */
const steps = (dy: number, step: number): number => {
  const raw = dy / step;
  return Math.sign(raw) * Math.round(Math.abs(raw));
};

const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));

interface Gesture {
  id: string;
  name: string;
  /** Frozen at pointerdown: `move` reorders the list under the hook. */
  from: number;
  at: number;
  total: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  lifted: boolean;
}

export function useSessionDrag({
  items,
  move,
  announce,
  liftMs = LIFT_MS,
  slopPx = SLOP_PX,
  rowStep = ROW_STEP,
}: {
  items: readonly SessionItem[];
  move: (id: string, toIndex: number) => void;
  announce: (message: string) => void;
  liftMs?: number;
  slopPx?: number;
  rowStep?: number;
}): SessionDrag {
  const [lifted, setLifted] = useState<string | null>(null);

  // Read through refs, not captured: both are a new function on every render of
  // the list, and the window listeners below are installed once per gesture.
  const moveRef = useRef(move);
  moveRef.current = move;
  const announceRef = useRef(announce);
  announceRef.current = announce;

  const gesture = useRef<Gesture | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const end = useCallback(() => {
    const g = gesture.current;
    if (g?.timer !== null && g?.timer !== undefined) clearTimeout(g.timer);
    gesture.current = null;
    detach.current?.();
    detach.current = null;
    setLifted(null);
  }, []);

  // A gesture that outlives its component would keep listening on `window`.
  useEffect(() => () => end(), [end]);

  const onPointerDown = useCallback(
    (item: SessionItem, index: number, e: React.PointerEvent<HTMLElement>): void => {
      // Secondary buttons are a context menu, not a drag.
      if (e.button !== 0) return;
      end();

      const g: Gesture = {
        id: item.id,
        name: sessionName(item),
        from: index,
        at: index,
        total: items.length,
        startY: e.clientY,
        timer: null,
        lifted: false,
      };
      gesture.current = g;

      g.timer = setTimeout(() => {
        g.timer = null;
        g.lifted = true;
        setLifted(g.id);
        announceRef.current(`Lifted ${g.name}. Position ${String(g.at + 1)} of ${String(g.total)}.`);
      }, liftMs);

      const onMove = (ev: PointerEvent): void => {
        const dy = ev.clientY - g.startY;
        if (!g.lifted) {
          // Still deciding. Past the slop before the hold completes, this was a
          // scroll, and the list has to keep scrolling under the same thumb.
          if (Math.abs(dy) > slopPx) end();
          return;
        }
        const target = clamp(g.from + steps(dy, rowStep), g.total - 1);
        if (target === g.at) return;
        g.at = target;
        moveRef.current(g.id, target);
        announceRef.current(`${g.name}, position ${String(target + 1)} of ${String(g.total)}.`);
      };

      const onUp = (): void => {
        const wasLifted = g.lifted;
        const at = g.at;
        if (wasLifted) {
          announceRef.current(`Dropped ${g.name} at position ${String(at + 1)} of ${String(g.total)}.`);
        } else if (gesture.current === g) {
          // A tap on the handle did nothing, so say what it is for. A target
          // that is silent when pressed reads as broken.
          announceRef.current(
            `Press and hold to move ${g.name}, or press the up and down arrow keys.`,
          );
        }
        end();
      };

      const onCancel = (): void => {
        // iOS fires this with no `pointerup` to follow. Whatever moved has
        // moved; what must not happen is the row staying lifted forever.
        if (g.lifted) {
          announceRef.current(
            `Move interrupted. ${g.name} is at position ${String(g.at + 1)} of ${String(g.total)}.`,
          );
        }
        end();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      detach.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };
    },
    [end, items.length, liftMs, rowStep, slopPx],
  );

  const onKeyDown = useCallback(
    (item: SessionItem, index: number, e: React.KeyboardEvent<HTMLElement>): void => {
      const total = items.length;
      const last = total - 1;
      const name = sessionName(item);

      const go = (to: number, edge: string): void => {
        e.preventDefault();
        if (to === index) {
          announceRef.current(edge);
          return;
        }
        moveRef.current(item.id, to);
        announceRef.current(`${name}, position ${String(to + 1)} of ${String(total)}.`);
      };

      switch (e.key) {
        case 'ArrowUp':
          go(Math.max(0, index - 1), `${name} is already first.`);
          return;
        case 'ArrowDown':
          go(Math.min(last, index + 1), `${name} is already last.`);
          return;
        case 'Home':
          go(0, `${name} is already first.`);
          return;
        case 'End':
          go(last, `${name} is already last.`);
          return;
        default:
      }
    },
    [items.length],
  );

  const handleProps = useCallback(
    (item: SessionItem, index: number): DragHandleProps => ({
      onPointerDown: (e) => onPointerDown(item, index, e),
      onKeyDown: (e) => onKeyDown(item, index, e),
      'aria-keyshortcuts': KEY_SHORTCUTS,
      style: { touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' },
    }),
    [onKeyDown, onPointerDown],
  );

  return { lifted, handleProps };
}
