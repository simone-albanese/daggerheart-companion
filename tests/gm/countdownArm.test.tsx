// @vitest-environment jsdom
/**
 * The advancement chart, on the session row of the clock it is about.
 *
 * `PROGETTO-GM` §6 step 1 puts the SRD's dynamic-countdown chart on the surface
 * a GM opens *because* they are thinking about that clock. The drawing is
 * `CountdownChart`, which was already shipped and already held on the two doors
 * it had: `tests/gm/reference.test.tsx` covers the countdowns board's fold and
 * the read-only copy on the reference topic, including the six cells the SRD
 * gives a number for and the four it does not.
 *
 * So this file is not a second copy of that coverage. It holds the three things
 * a third door can get wrong on its own:
 *
 *   - **which countdowns are offered it.** The board gives a standard, loop or
 *     long-term row no fold at all, and two surfaces disagreeing about which
 *     kinds the rule covers would be the app disagreeing with itself;
 *   - **which countdown a cell moves, and which way.** The cells act through
 *     `advanceCountdown`, the same action this arm's `−` calls, and the arm's
 *     own comment is explicit that `−` advances toward zero. A cell that
 *     renders and moves the wrong clock, or the right clock the wrong way,
 *     looks exactly like a cell that works;
 *   - **that the four cells with no number are still print.** They are printed
 *     and deliberately not buttons, and a surface that reused the chart by
 *     rebuilding it is exactly where that would stop being true.
 *
 * Every assertion about movement reads `useGm`, not the drawing.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Countdown } from '../../shared/types.ts';
import type { SessionItem } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { NO_CLOCK_PROSE } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** Answer media queries as a 393px phone would. */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse|pointer:\s*coarse/.test(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) ||
        (min !== null && width >= Number(min[1])) ||
        (coarse && width < 1180),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  // The store starts reading the disk the moment it is imported. A test that
  // renders against `hydrated: false` draws "Reading this device" and passes
  // for the wrong reason.
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
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
  useGm.setState({
    hydrated: true,
    session: [],
    countdowns: [],
    combatants: [],
    environmentRef: null,
    roster: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * The one button whose accessible name is this. Throws on none and on two,
 * because every control on this screen is drawn once per row and a test that
 * silently took row 1's button while meaning row 2's would pass for the wrong
 * reason - which is the whole subject of `moves the clock the cell belongs to`.
 */
const named = (label: string): HTMLButtonElement => {
  const found = buttons().filter(
    (b) => (b.getAttribute('aria-label') ?? (b.textContent ?? '').trim()) === label,
  );
  if (found.length !== 1) throw new Error(`${String(found.length)} controls answer to “${label}”`);
  return found[0]!;
};

/** Every ADVANCE BY A ROLL header on the screen, in document order. */
const folds = (): HTMLButtonElement[] =>
  buttons().filter((b) => (b.textContent ?? '').trim().startsWith('ADVANCE BY A ROLL'));

const clock = (
  id: string,
  name: string,
  kind: Countdown['kind'],
  value: number,
): SessionItem => ({
  id,
  kind: 'countdown',
  name,
  order: 0,
  // Open, because the arm is what this file is about; the row's own disclosure
  // is `SessionRow`'s and `sessionList.test.tsx` holds it.
  collapsed: false,
  primary: false,
  sceneId: null,
  countdown: { id, name, kind, start: 6, value, notes: '', ...NO_CLOCK_PROSE },
});

const seed = (items: SessionItem[]): void => {
  useGm.setState({ session: items, countdowns: countdownsOf(items) });
  render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
};

const valueOf = (id: string): number => useGm.getState().countdowns.find((c) => c.id === id)!.value;

// ---------------------------------------------------------------------------

describe('which countdowns are offered the chart', () => {
  it('offers it on a dynamic clock and on no other kind', () => {
    // The board's answer, and it has to be the same one. `Countdowns.tsx` says
    // it out loud: the chart is the rule for dynamic countdowns, and offering
    // it anywhere else would be the row claiming a rule that is not about it.
    const kinds: Array<Countdown['kind']> = ['standard', 'dynamic', 'loop', 'long-term'];
    const offered = kinds.filter((kind) => {
      seed([clock('c1', 'The ritual', kind, 4)]);
      const has = folds().length === 1;
      act(() => root.unmount());
      root = createRoot(container);
      return has;
    });
    expect(offered).toEqual(['dynamic']);
  });

  it('starts shut, below a −/+ row that keeps its place and its floor', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    const fold = folds()[0]!;
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(fold.style.minHeight).toBe('var(--tap)');

    const minus = named('Advance The ritual by one');
    expect(minus.style.minHeight).toBe('44px');
    expect(
      minus.compareDocumentPosition(fold) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the chart landed above the one-tap gesture',
    ).toBeTruthy();
  });

  it('reads ADVANCE BY A ROLL on the glass, with the SRD stamp after it', () => {
    /*
     * The header's own words, held on their own. Nothing else in this suite
     * held them: the `SRD 1.0` stamp could be deleted from the summary and all
     * 136 files stayed green, because every other assertion on this header
     * reads either the `sr-only` row name beside it or the ADVANCE BY A ROLL
     * prefix `folds()` matches on. The mutant that removed the whole summary
     * line removed both halves at once and looked like it proved both.
     */
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    const glass = folds()[0]!.cloneNode(true) as HTMLElement;
    for (const hidden of [...glass.querySelectorAll('.sr-only')]) hidden.remove();
    const words = [...glass.querySelectorAll('span')]
      .map((el) => (el.textContent ?? '').trim())
      .filter((word) => word !== '');
    // In order, because `Fold` draws the label first and the summary last with
    // a growing spacer between them: the stamp is the right-hand end of the
    // header row, not a second word beside the verb.
    expect(words).toEqual(['ADVANCE BY A ROLL', 'SRD 1.0']);
  });

  it('leaves the two verbs below the chart rather than above it', () => {
    // Stated because it is the price: PIN and OPEN FEAR AND COUNTDOWNS sit one
    // shut fold lower on a dynamic row. They are the controls that leave this
    // row; the chart belongs with the number it changes.
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    const pin = named('PIN IT TO THE TOP BAR — The ritual');
    expect(
      folds()[0]!.compareDocumentPosition(pin) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('what the chart draws once it is open', () => {
  it('is the SRD’s own table, with the page it was read from', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    expect(text()).toContain('DYNAMIC COUNTDOWN ADVANCEMENT');
    expect(text()).toContain('SRD 1.0 · P.69');
    // The sentence that tells a progress countdown from a consequence one. The
    // persisted kind has only `dynamic` in it, so the GM reads the distinction
    // and presses the column they mean.
    expect(text()).toContain('Progress countdowns');
    expect(text()).toContain('Consequence countdowns');
  });

  it('puts a button on the six cells the SRD gives a number for, and on those only', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    const cells = buttons()
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((label) => label.startsWith('The ritual: '));
    expect(cells).toEqual([
      'The ritual: Failure with Fear, Consequence Advancement — advance by 3',
      'The ritual: Failure with Hope, Consequence Advancement — advance by 2',
      'The ritual: Success with Fear, Progress Advancement — advance by 1',
      'The ritual: Success with Fear, Consequence Advancement — advance by 1',
      'The ritual: Success with Hope, Progress Advancement — advance by 2',
      'The ritual: Critical Success, Progress Advancement — advance by 3',
    ]);
  });

  it('prints the four cells that give no number and puts no target on them', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    // A control that performs no change is the app claiming something it will
    // not do. Asserted by element rather than by counting buttons, because a
    // `No advancement` button would also be a button nobody named.
    const cells = [...container.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim() === 'No advancement',
    );
    expect(cells).toHaveLength(4);
    expect(cells.map((el) => el.tagName)).toEqual(['SPAN', 'SPAN', 'SPAN', 'SPAN']);
  });

  it('declares the touch floor on every one of the six cells', () => {
    /*
     * This used to be named for a hole in `sessionList.test.tsx` - that its
     * whole-screen sweep runs with every row open and this fold shut, so the
     * cells were never in the DOM when the floor was checked. That was true of
     * the sweep as it stood, and the same commit that wrote the sentence
     * closed it: the sweep clicks the folds open before it counts and asserts
     * the six cells it opened. The name outlived its own reason by a few
     * hundred lines of one diff.
     *
     * Kept, because the two hold the rule from different ends. Over there it
     * is screen-wide, read off every target `Gm` draws, and it reaches these
     * cells only for as long as that fixture keeps seeding a dynamic session
     * row and clicking its fold open. Here it is this door's own six cells on
     * `SessionList` with one clock, which is the charter this file states at
     * the top - and it is the assertion that stays red if the fixture over
     * there changes shape.
     */
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    const cells = buttons().filter((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('The ritual: '),
    );
    // The population before the violators. Filtering down to the cells that
    // are too short and asserting that list is empty passes just as happily
    // over no cells at all - which is exactly what a mutant that deletes the
    // chart leaves behind, and it is the reason this test used to be the one
    // green sibling in a red file.
    expect(cells, 'the chart drew no cell for the floor to hold').toHaveLength(6);
    const short = cells
      .filter((b) => b.style.minHeight !== 'var(--tap)')
      .map((b) => b.getAttribute('aria-label'));
    expect(short, 'these cells declare no 44px floor').toEqual([]);
  });
});

describe('what a cell moves', () => {
  it('advances this countdown toward zero by what the cell says', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    expect(valueOf('c1')).toBe(4);
    click(named('The ritual: Failure with Fear, Consequence Advancement — advance by 3'));
    // 4 − 3. `+3` goes the wrong way and clamps at `start`, giving 6; the `−`
    // beside it gives 3. Only the cell's own delta, in the direction the arm's
    // own comment fixes, gives 1.
    expect(valueOf('c1')).toBe(1);
  });

  it('moves once per press, not once per render', () => {
    seed([clock('c1', 'The ritual', 'dynamic', 4)]);
    click(folds()[0]!);
    click(named('The ritual: Success with Fear, Progress Advancement — advance by 1'));
    expect(valueOf('c1')).toBe(3);
  });

  it('moves the clock the cell belongs to, and leaves the other one alone', () => {
    // Two dynamic rows open at once is the ordinary case on a planned night,
    // and the defect this catches - a chart acting on the first countdown in
    // the store rather than on its own - draws identically.
    seed([
      clock('c1', 'The ritual', 'dynamic', 4),
      { ...clock('c2', 'The tide', 'dynamic', 5), order: 1 },
    ]);
    expect(folds()).toHaveLength(2);
    for (const fold of folds()) click(fold);
    click(named('The tide: Failure with Fear, Consequence Advancement — advance by 3'));
    expect(valueOf('c2')).toBe(2);
    expect(valueOf('c1'), 'the other clock moved too').toBe(4);
  });

  it('names the row on the fold, so two open clocks are not one word twice', () => {
    // `Fold` names its button with the words it draws, and both of these draw
    // ADVANCE BY A ROLL. `SessionBody` puts the row's name in the summary's
    // `sr-only` span, which is the same idiom `Verb` and the roster disclosure
    // use for the same reason: a screen whose whole point is an ordered list of
    // similar rows cannot hand the rotor two identical buttons.
    seed([
      clock('c1', 'The ritual', 'dynamic', 4),
      { ...clock('c2', 'The tide', 'dynamic', 5), order: 1 },
    ]);
    const names = folds().map((b) => (b.textContent ?? '').trim());
    expect(new Set(names).size, 'the two folds answer to the same name').toBe(2);
    expect(names[0]).toContain('The ritual');
    expect(names[1]).toContain('The tide');
    // And the name is for the rotor, not for the glass.
    const hidden = folds()[0]!.querySelector('.sr-only');
    expect(hidden?.textContent).toBe(' — The ritual');
  });
});
