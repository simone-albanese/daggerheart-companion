// @vitest-environment jsdom
/**
 * Where the press-and-hold gesture is allowed to live.
 *
 * Press and hold clears a track, which is the right gesture for "I took a long
 * rest" and the wrong one to have anywhere near a text field. The four pointer
 * handlers used to sit on the Track root, and the root wraps the header as
 * well as the pips - so on a phone, where Vitals docks the damage input and
 * the severity chips into the HP header, a 480ms press to position the caret
 * zeroed the track under it. iOS's own long-press threshold is around 500ms
 * and HOLD_MS is 480, so this was not an exotic gesture: a tremor, or Touch
 * Accommodations' hold delay, puts ordinary taps inside the window. The chips
 * were the worse half, because their click still fired after the wipe - a slow
 * press on "SEVERE - 3 HP" left 3 marked rather than 8, a number that looks
 * like a real reading instead of an obvious loss.
 *
 * This is the one test in the repo that needs a browser, and it needs one for
 * a reason the source cannot answer: which element an event handler is bound
 * to is a question about event propagation, and a string-matched assertion
 * that the JSX moved would have passed just as happily if the handlers had
 * been put back on an ancestor of both. So jsdom renders the real component
 * and real events are dispatched at the two places a thumb actually lands.
 *
 * The header is given the shape Vitals gives it - a live input plus a chip
 * that writes on click - so the assertion is the one that matters at the
 * table: after a long press on the header, the track still reads what the
 * player left it at, and the chip's own number is what lands.
 */
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from '../../src/ui/shared/Track.tsx';

/** Longer than HOLD_MS (480), short enough to stay an obvious press. */
const PAST_HOLD = 600;

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

/**
 * A press that outlasts the hold threshold, then lifts.
 *
 * jsdom has no PointerEvent, and React delegates `pointerdown` to the root
 * container, so a bubbling Event of the right type is what actually reaches
 * the handler - the same path a real press takes.
 */
const pressAndHold = (target: Element): void => {
  act(() => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });
  act(() => {
    vi.advanceTimersByTime(PAST_HOLD);
  });
  act(() => {
    target.dispatchEvent(new Event('pointerup', { bubbles: true }));
  });
};

const pipRow = (): HTMLElement => {
  const row = container.querySelector('[role="group"]');
  if (!(row instanceof HTMLElement)) throw new Error('no pip row rendered');
  return row;
};

const pip = (i: number): HTMLElement => {
  const found = pipRow().querySelectorAll('button')[i];
  if (!(found instanceof HTMLElement)) throw new Error(`no pip ${i} rendered`);
  return found;
};

describe('press and hold', () => {
  it('clears the track from the pip row', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'hp',
        label: 'HP',
        value: 5,
        max: 8,
        onChange,
      }),
    );

    pressAndHold(pip(2));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clears to full for Hope, which counts down rather than up', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'hope',
        label: 'HOPE',
        value: 1,
        max: 6,
        clearTo: 6,
        onChange,
      }),
    );

    pressAndHold(pip(0));

    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('does not fire from the damage field docked in the header', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'hp',
        label: 'HP',
        value: 5,
        max: 8,
        onChange,
        headerExtra: createElement('input', {
          'aria-label': 'Damage taken',
          defaultValue: '',
        }),
      }),
    );

    const field = container.querySelector('input');
    if (field === null) throw new Error('no header field rendered');
    pressAndHold(field);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a severity chip in the header free to apply its own number', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'hp',
        label: 'HP',
        value: 0,
        max: 8,
        onChange,
        headerExtra: createElement(
          'button',
          { type: 'button', onClick: () => onChange(3) },
          'SEVERE · 3 HP',
        ),
      }),
    );

    const chip = container.querySelector('button');
    if (chip === null) throw new Error('no header chip rendered');
    pressAndHold(chip);
    act(() => {
      chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Not 0-then-3, and not 3-after-a-wipe. Just the chip's own number.
    expect(onChange.mock.calls).toEqual([[3]]);
  });

  it('does not fire from the readout or the label either', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'stress',
        label: 'STRESS',
        value: 4,
        max: 6,
        onChange,
        readout: '4 / 6 MARKED',
      }),
    );

    const header = container.querySelector('.spread');
    if (!(header instanceof HTMLElement)) throw new Error('no header rendered');
    pressAndHold(header);

    expect(onChange).not.toHaveBeenCalled();
  });
});
