// @vitest-environment jsdom
/**
 * Reordering the session list, by thumb and by key.
 *
 * Every assertion here is about `useGm.getState().session`, never about a
 * pixel. jsdom implements no layout - `getBoundingClientRect().height` is 0 for
 * everything - which is why nothing below reads one. The hook does not read one
 * either: `SessionList` passes no `rowStep`, so `ROW_STEP` is what a drag
 * divides by in Chrome exactly as it is here, and the arithmetic below is
 * written against that constant rather than against a measurement jsdom cannot
 * give. `ROW_STEP` is 62 - the 54.00 shut card plus the list's 8px gap, and the
 * pitch measured between shut rows at 393x852. It was 60 until that
 * measurement; `tests/ui/gmGeometryProse.test.ts` is what holds it to the
 * declarations now.
 *
 * jsdom also implements no `PointerEvent`, so one is installed here. It is a
 * `MouseEvent` with a `pointerId`, which is all this hook reads.
 *
 * Fake timers go in **after** `hydrateGm()`: `gmStore` starts hydrating at
 * import and that hydration awaits `fake-indexeddb`, which schedules on the
 * very queues the fake timers replace.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionItem } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { LIFT_MS, ROW_STEP } from '../../src/ui/gm/useSessionDrag.ts';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** jsdom has no PointerEvent. This carries the two fields the hook reads. */
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(async () => {
  window.matchMedia = ((query: string) =>
    ({
      matches: /max-width/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { PointerEvent?: unknown }).PointerEvent = FakePointerEvent;
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({ hydrated: true, session: four(), countdowns: [] });
  act(() => root.render(createElement(SessionList, { phone: true, onOpenTool: () => {} })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const four = (): SessionItem[] =>
  ['a', 'b', 'c', 'd'].map((id, order) => ({
    id,
    kind: 'scene',
    name: id,
    order,
    collapsed: true,
    environmentRef: null,
  }));

const order = (): string[] => useGm.getState().session.map((i) => i.id);
const orders = (): number[] => useGm.getState().session.map((i) => i.order);

const handles = (): HTMLButtonElement[] =>
  [...container.querySelectorAll('button')].filter((b) =>
    (b.getAttribute('aria-label') ?? '').startsWith('Reorder '),
  );

const handleFor = (id: string): HTMLButtonElement => {
  const found = handles().find((b) => (b.getAttribute('aria-label') ?? '').includes(`Reorder ${id},`));
  if (found === undefined) throw new Error(`no handle for ${id}`);
  return found;
};

const said = (): string => container.querySelector('[aria-live]')?.textContent ?? '';

const down = (el: Element, clientY: number): void => {
  act(() => {
    el.dispatchEvent(new FakePointerEvent('pointerdown', { bubbles: true, clientY, button: 0 }));
  });
};
const hold = (ms = LIFT_MS): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const moveTo = (clientY: number): void => {
  act(() => {
    window.dispatchEvent(new FakePointerEvent('pointermove', { clientY }));
  });
};
const up = (): void => {
  act(() => {
    window.dispatchEvent(new FakePointerEvent('pointerup', {}));
  });
};
const key = (el: Element, k: string): void => {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  });
};

// ---------------------------------------------------------------------------

describe('the pointer gesture', () => {
  it('moves a row by as many places as the thumb travelled', () => {
    down(handleFor('a'), 100);
    hold();
    moveTo(100 + 3 * ROW_STEP + 1);
    up();
    expect(order()).toEqual(['b', 'c', 'd', 'a']);
    // `order` is re-stamped by the store, so the record does not carry the
    // holes a splice would leave.
    expect(orders()).toEqual([0, 1, 2, 3]);
  });

  it('puts the halfway point at a number rather than at a feeling', () => {
    // 29px of the 62px step is not a move; 31 is. 31 is the tie exactly, and a
    // tie goes away from zero in both directions, which is what `steps` is for -
    // `Math.round` alone would send -31 to -0 and 31 to 1.
    down(handleFor('a'), 100);
    hold();
    moveTo(129);
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    moveTo(131);
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
    up();
  });

  it('rounds the same amount of travel the same way upwards', () => {
    down(handleFor('d'), 300);
    hold();
    moveTo(271);
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    moveTo(269);
    expect(order()).toEqual(['a', 'b', 'd', 'c']);
    up();
  });

  it('lands where the thumb is, not where the thumb has been', () => {
    // The target is absolute - the index the row started at plus the steps
    // travelled - so dragging two down and one back up puts the row one down,
    // not three. A hook that counted from the row's *current* index instead
    // would compound its own moves and run away down the list.
    down(handleFor('a'), 100);
    hold();
    moveTo(221);
    expect(order()).toEqual(['b', 'c', 'a', 'd']);
    moveTo(161);
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
    up();
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
  });

  it('does nothing at all for a hold shorter than the lift', () => {
    down(handleFor('a'), 100);
    hold(LIFT_MS - 50);
    moveTo(400);
    up();
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lets a scroll that starts on the handle stay a scroll', () => {
    // The list under the same thumb has to keep scrolling. Past the slop
    // before the hold completes, the gesture is abandoned outright - so the
    // hold expiring later cannot turn a finished scroll into a drag.
    down(handleFor('a'), 100);
    moveTo(109);
    hold();
    moveTo(281);
    up();
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('teaches the gesture when the handle is only tapped', () => {
    down(handleFor('a'), 100);
    hold(LIFT_MS - 50);
    up();
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    expect(said()).toContain('Press and hold to move a');
    expect(said()).toContain('arrow keys');
  });

  it('puts a row down when the system takes the gesture away', () => {
    // iOS fires `pointercancel` with no `pointerup` to follow - a system
    // gesture, the notification shade, an incoming call. Without this the row
    // stays lifted for the life of the screen.
    down(handleFor('a'), 100);
    hold();
    moveTo(161);
    act(() => {
      window.dispatchEvent(new FakePointerEvent('pointercancel', {}));
    });
    expect(said()).toContain('Move interrupted');
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
    // And a further move, with no pointer down, moves nothing.
    moveTo(400);
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
  });

  it('says where the row is, at every stage, in one region', () => {
    down(handleFor('a'), 100);
    hold();
    expect(said()).toBe('Lifted a. Position 1 of 4.');
    moveTo(281);
    expect(said()).toBe('a, position 4 of 4.');
    up();
    expect(said()).toBe('Dropped a at position 4 of 4.');
    // Exactly one. Four regions announcing in turn is the same interruption as
    // an assertive one, by another route.
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(container.querySelector('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('the keyboard path', () => {
  it('moves a row without a pointer, and keeps the focus on the handle', () => {
    const handle = handleFor('b');
    handle.focus();
    key(handle, 'ArrowUp');
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
    // The <ol> is keyed on the item's id, so React moves the node rather than
    // rewriting four of them in place. Keyed on the index, focus would stay on
    // the same *box* while a different row moved into it - which is worse than
    // losing focus, because the next ArrowUp then moves somebody else.
    expect(document.activeElement).toBe(handle);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Reorder b, 1 of 4');
    expect(said()).toBe('b, position 1 of 4.');
  });

  it('says an edge is an edge instead of moving nothing in silence', () => {
    key(handleFor('a'), 'ArrowUp');
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
    expect(said()).toBe('a is already first.');
  });

  it('sends a row to either end', () => {
    key(handleFor('a'), 'End');
    expect(order()).toEqual(['b', 'c', 'd', 'a']);
    key(handleFor('a'), 'Home');
    expect(order()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('names its own shortcuts on the control that answers them', () => {
    const handle = handleFor('a');
    expect(handle.getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown Home End');
    expect(handle.getAttribute('aria-label')).toBe('Reorder a, 1 of 4');
    // The one square in the row the browser must not claim for a scroll.
    expect(handle.style.touchAction).toBe('none');
  });
});

describe('the buttons in an open row', () => {
  it('moves a row without a hold and without 60px of accurate travel', () => {
    act(() => {
      useGm.setState({ session: four().map((i) => ({ ...i, collapsed: false })) });
    });
    const downButton = [...container.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'MOVE DOWN — a',
    )!;
    act(() => {
      downButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(order()).toEqual(['b', 'a', 'c', 'd']);
  });

  it('offers no move at the end a row is already at', () => {
    act(() => {
      useGm.setState({ session: four().map((i) => ({ ...i, collapsed: false })) });
    });
    const byLabel = (label: string): HTMLButtonElement =>
      [...container.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === label)!;
    expect(byLabel('MOVE UP — a').disabled).toBe(true);
    expect(byLabel('MOVE DOWN — a').disabled).toBe(false);
    expect(byLabel('MOVE DOWN — d').disabled).toBe(true);
  });
});

describe('what the drag costs the disk', () => {
  it('writes the campaign once for a drag across three rows', async () => {
    // Every step calls `moveSessionItem`, which commits; the store's own 400 ms
    // debounce is what turns four commits into one `putCampaign`.
    const gmStore = await import('../../src/ui/gm/gmStore.ts');
    const db = await import('../../src/store/campaigns.ts');
    const spy = vi.spyOn(db, 'putCampaign');
    down(handleFor('a'), 100);
    hold();
    moveTo(161);
    moveTo(221);
    moveTo(281);
    up();
    expect(order()).toEqual(['b', 'c', 'd', 'a']);
    vi.useRealTimers();
    await gmStore.flushGm();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
