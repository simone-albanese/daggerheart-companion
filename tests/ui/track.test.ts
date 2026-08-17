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

  /*
   * DELETED WITH THE BRANCH IT TESTED: «does not fire from the label in the
   * gutter layout either». It passed `headerLayout: 'gutter'`, and its own
   * comment gave its reason - "the gutter moves the label from above the pips
   * to beside them, which is a new chance to make the original mistake: put the
   * label inside the element carrying the handlers and a press on the word
   * STRESS wipes the track. Same assertion as the header, different
   * arrangement."
   *
   * There is one arrangement now. `Vitals` was the gutter's only caller in
   * `src/` and decision 7 deleted it, so the branch went too. The claim itself
   * loses nothing: the test directly below makes it over the stacked header,
   * which is the one the party board, the live scene and the companion draw.
   */
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

/**
 * A track whose maximum is not a maximum.
 *
 * One point of `max` is one `<button>`. The codec refuses a payload declaring
 * `hp.max = 2^20` and the store clamps one on the way in, and neither of them
 * can reach a record that was already in IndexedDB before they existed -
 * nothing re-imports what is already on the disk. So the component has to be
 * the thing that cannot be made to hang, and it has to say what it did:
 * drawing forty of a million in silence is the sheet reporting a number that
 * is not the one it holds.
 *
 * The interaction half is the part worth testing hardest. Forty live pips over
 * a value of 1048576 is *worse* than the hang, because a tap on the last one
 * calls `onChange(40)` and the sheet then reports 40 as the player's own
 * reading - an ordinary gesture on a control that looks like every other track
 * in the app, silently throwing the number away.
 */
describe('a track too big to draw', () => {
  const ENORMOUS = 1_048_576;
  /** The cap in `Track.tsx`: ten columns on the narrowest phone, four rows. */
  const CAP = 40;

  const huge = (onChange = vi.fn()): ReturnType<typeof vi.fn> => {
    render(
      createElement(Track, {
        kind: 'hp',
        label: 'HP',
        value: 3,
        max: ENORMOUS,
        onChange,
      }),
    );
    return onChange;
  };

  it('draws forty pips rather than one per point', () => {
    huge();
    expect(pipRow().querySelectorAll('button')).toHaveLength(CAP);
  });

  it('says on screen that it drew fewer, and names the number it was given', () => {
    huge();
    const text = container.textContent ?? '';
    expect(text).toContain(String(ENORMOUS));
    expect(text).toContain(String(CAP));
    expect(text).toMatch(/nothing has been changed/i);
  });

  it('does not answer a tap, so no gesture can write 40 over a million', () => {
    const onChange = huge();
    pip(CAP - 1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    pip(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not answer a press and hold either, which would clear it to nothing', () => {
    const onChange = huge();
    pressAndHold(pip(2));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('tells a screen reader the same thing it tells everyone else', () => {
    huge();
    const label = pipRow().getAttribute('aria-label') ?? '';
    expect(label).toContain(String(ENORMOUS));
    expect(label).toMatch(/too many to draw/i);
    expect(pip(0).getAttribute('aria-disabled')).toBe('true');
  });

  it('is an ordinary track at the cap itself, sentence and all left off', () => {
    // The bound has to bite above the cap and not at it, or every assertion
    // above would pass on a component that had simply stopped working.
    const onChange = vi.fn();
    render(
      createElement(Track, { kind: 'hp', label: 'HP', value: 3, max: CAP, onChange }),
    );

    expect(pipRow().querySelectorAll('button')).toHaveLength(CAP);
    expect(container.textContent ?? '').not.toMatch(/more than can be drawn/i);
    pip(9).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('leaves a real character’s twelve-box track completely alone', () => {
    const onChange = vi.fn();
    render(createElement(Track, { kind: 'hp', label: 'HP', value: 5, max: 12, onChange }));

    expect(pipRow().querySelectorAll('button')).toHaveLength(12);
    expect(pipRow().getAttribute('aria-label')).toBe('HP: 5 of 12');
    pressAndHold(pip(3));
    expect(onChange).toHaveBeenCalledWith(0);
  });
});

describe('proposed pips', () => {
  /**
   * Hope armed for a roll that has not happened.
   *
   * The SRD makes a player declare Experiences before rolling, so the two Hope
   * an armed pair will cost has to be visible at the moment of committing -
   * and drawing it as already spent would be the sheet reporting a payment it
   * has not made. Hollow says "claimed, not gone".
   */
  it('are a readout and not a control', () => {
    const onChange = vi.fn();
    render(
      createElement(Track, {
        kind: 'hope',
        label: 'HOPE',
        value: 4,
        max: 6,
        clearTo: 6,
        pending: 2,
        onChange,
      }),
    );

    // Pips 3 and 4 (0-indexed 2 and 3) are the proposed ones.
    pip(2).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    pip(3).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).not.toHaveBeenCalled();

    // A committed pip below them still answers, so the track is not inert.
    pip(0).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('say so to a screen reader', () => {
    render(
      createElement(Track, {
        kind: 'hope',
        label: 'HOPE',
        value: 4,
        max: 6,
        pending: 2,
        onChange: vi.fn(),
      }),
    );

    expect(pip(3).getAttribute('aria-label')).toMatch(/armed for this roll/i);
    expect(pip(0).getAttribute('aria-label')).not.toMatch(/armed/i);
  });

  it('do not exist unless somebody asks for them', () => {
    render(
      createElement(Track, {
        kind: 'hope',
        label: 'HOPE',
        value: 4,
        max: 6,
        onChange: vi.fn(),
      }),
    );
    for (const i of [0, 1, 2, 3]) {
      expect(pip(i).getAttribute('aria-label')).not.toMatch(/armed/i);
    }
  });
});
