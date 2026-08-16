// @vitest-environment jsdom
/**
 * Counters as numbers, and the preference that chooses them.
 *
 * A pip row is five taps from 2 to 7, on five 24px-wide neighbouring targets,
 * and the SRD hands Stress out in lumps - "mark 3 Stress" is three taps and
 * three chances to write a number nobody meant. So the number itself is a
 * control: tap it, type it, done. That is the behaviour under test here, along
 * with the two things that would quietly ruin it - a stepper below the touch
 * floor, and a value target sitting close enough to `+` that a thumb on its
 * way there opens a keyboard instead.
 *
 * The scope of the preference is tested too, because it is the part that is
 * easiest to get subtly wrong: numbers are for the Play screen on a phone or a
 * tablet, and the desktop cockpit keeps its pips.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Counter } from '../../src/ui/shared/Counter.tsx';
import { Vitals } from '../../src/ui/player/Vitals.tsx';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

/**
 * Let the effects a mount started finish before the test ends.
 *
 * Settings asks the backup folder for its health in an effect, and that
 * promise resolving after the environment has been torn down is an unhandled
 * rejection with no test attached to it.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named = (name: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '') === name);
  if (found === undefined) {
    throw new Error(
      `no control called "${name}". Controls here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
};
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * Type into a controlled input the way a keyboard does.
 *
 * React tracks the last value it wrote on the DOM node itself, so assigning
 * `field.value` and firing `input` looks to React like no change at all and
 * `onChange` never runs. Going through the prototype's setter is what a real
 * keystroke does and what makes the tracker notice.
 */
function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** A number an inline style declares, in px. `var(--tap)` is 44 everywhere. */
function px(value: string): number {
  if (value === 'var(--tap)') return 44;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

describe('a counter drawn as a number', () => {
  it('sets the value in one gesture instead of five taps', () => {
    let value = 2;
    render(
      <Counter
        kind="stress"
        label="STRESS"
        value={value}
        max={6}
        onChange={(v) => {
          value = v;
        }}
      />,
    );

    click(named('STRESS 2 of 6 - tap to type a value'));
    const field = container.querySelector('input');
    expect(field, 'tapping the value did not open a numeric entry').not.toBeNull();
    expect(field!.getAttribute('inputmode')).toBe('numeric');

    type(field!, '5');
    click(named('Set STRESS'));

    expect(value).toBe(5);
    expect(container.querySelector('input'), 'the entry stayed open after SET').toBeNull();
  });

  it('will not type a value off the end of the track', () => {
    let value = 2;
    render(
      <Counter
        kind="hp"
        label="HP"
        value={value}
        max={6}
        onChange={(v) => {
          value = v;
        }}
      />,
    );
    click(named('HP 2 of 6 - tap to type a value'));
    type(container.querySelector('input')!, '99');
    click(named('Set HP'));
    expect(value).toBe(6);
  });

  it('treats an emptied box as a cancel, because zero is a real value', () => {
    let calls = 0;
    render(
      <Counter
        kind="hope"
        label="HOPE"
        value={4}
        max={6}
        onChange={() => {
          calls += 1;
        }}
      />,
    );
    click(named('HOPE 4 of 6 - tap to type a value'));
    type(container.querySelector('input')!, '');
    click(named('Set HOPE'));
    expect(calls, 'an empty box wrote a value').toBe(0);
  });

  it('steps by one, and stops at both ends', () => {
    const seen: number[] = [];
    render(
      <Counter kind="armor" label="ARMOR" value={0} max={3} onChange={(v) => seen.push(v)} />,
    );
    expect(named('ARMOR minus one').disabled, 'minus was live at zero').toBe(true);
    click(named('ARMOR plus one'));
    expect(seen).toEqual([1]);

    render(<Counter kind="armor" label="ARMOR" value={3} max={3} onChange={(v) => seen.push(v)} />);
    expect(named('ARMOR plus one').disabled, 'plus was live at the maximum').toBe(true);
  });

  it('keeps every target at the touch floor in both directions', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    for (const b of buttons()) {
      const s = b.style;
      const height = Math.max(px(s.height), px(s.minHeight));
      const width = Math.max(px(s.width), px(s.minWidth));
      const name = b.getAttribute('aria-label') ?? b.textContent ?? '?';
      expect(height, `${name} is ${String(height)}px tall`).toBeGreaterThanOrEqual(44);
      expect(width, `${name} is ${String(width)}px wide`).toBeGreaterThanOrEqual(44);
    }
  });

  /*
   * The one arrangement question a screenshot would answer and jsdom cannot:
   * how far apart the value target and the stepper are. The row is a flex row,
   * so the answer is structural rather than numeric - there is a growing
   * spacer between them, and it is the only thing in the row that grows, so
   * every pixel the row has spare goes into that gap. Inside the Play panel
   * that is about 105px on a 393px phone and about 88px on a 375px one.
   */
  it('puts the whole slack of the row between the value and the steppers', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    const row = container.firstElementChild!;
    const kids = [...row.children] as HTMLElement[];
    const value = kids.findIndex((el) => (el.getAttribute('aria-label') ?? '').startsWith('HP 2'));
    const minus = kids.findIndex((el) => el.getAttribute('aria-label') === 'HP minus one');
    expect(value).toBeGreaterThanOrEqual(0);
    expect(minus).toBeGreaterThan(value);

    const grows = (el: HTMLElement): boolean => el.style.flexGrow === '1';
    const between = kids.slice(value + 1, minus);
    const growing = between.filter(grows);
    expect(growing.length, 'nothing between the value and the stepper grows').toBe(1);

    const otherGrowers = kids.filter((el) => grows(el) && !between.includes(el));
    expect(
      otherGrowers.map((el) => el.getAttribute('aria-label') ?? el.textContent),
      'something else in the row grows, so the gap is not the whole slack',
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Which surfaces get them
// ---------------------------------------------------------------------------

function seed(counterStyle: 'numbers' | 'pips'): void {
  const character = playedCharacter();
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS, counterStyle },
    log: [],
    openCard: null,
  });
}

/** Pip rows announce themselves; the numeric row has no group at all. */
const pipGroups = (): number => container.querySelectorAll('[role="group"]').length;
const stepperCount = (): number =>
  buttons().filter((b) => (b.getAttribute('aria-label') ?? '').endsWith('plus one')).length;

describe('where the numbers are allowed to be', () => {
  it('is the default, so a new install gets them', () => {
    expect(DEFAULT_PREFS.counterStyle).toBe('numbers');
  });

  it('draws them on the phone Play screen', () => {
    seed('numbers');
    render(
      createElement(Vitals, {
        stats: playedStats(),
        layout: 'phone',
        showState: false,
        part: 'tracks',
      }),
    );
    expect(stepperCount(), 'four counters, four plus buttons').toBe(4);
    expect(pipGroups(), 'a pip row was drawn as well').toBe(0);
  });

  it('gives the phone its pips back when the preference says so', () => {
    seed('pips');
    render(
      createElement(Vitals, {
        stats: playedStats(),
        layout: 'phone',
        showState: false,
        part: 'tracks',
      }),
    );
    expect(stepperCount()).toBe(0);
    expect(pipGroups(), 'four tracks, four pip rows').toBe(4);
  });

  it('leaves the desktop cockpit on pips whatever the preference says', () => {
    seed('numbers');
    render(createElement(Vitals, { stats: playedStats(), layout: 'desktop', showState: false }));
    expect(stepperCount(), 'the desktop layout grew steppers').toBe(0);
    expect(pipGroups()).toBe(4);
  });

  /*
   * The order is the paper sheet's, and it is worth pinning: it was changed
   * from a frequency argument whose two premises - the counters are pinned
   * under the thumb, and the Experience chips are next to Hope - both stopped
   * being true when the Play screen became the character sheet.
   */
  /*
   * A preference nothing can reach is the same defect as a feature nothing
   * calls: it ships switched off behind a passing test. Settings is edited by
   * another lane, so this asks the smallest question that would notice the row
   * going missing rather than pinning anything about the section around it.
   */
  it('can be changed from Settings, and changing it writes the preference', async () => {
    seed('numbers');
    render(createElement(Settings));
    await settle();
    const row = container.querySelector('[role="group"][aria-label="Counters"]');
    expect(row, 'Settings has no Counters row').not.toBeNull();
    const pips = [...row!.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Pips',
    );
    expect(pips, 'the Counters row offers no way to pick pips').toBeDefined();
    click(pips!);
    expect(useApp.getState().prefs.counterStyle).toBe('pips');
  });

  it('runs HP, Stress, Hope, Armor, the way the printed sheet does', () => {
    seed('numbers');
    render(
      createElement(Vitals, {
        stats: playedStats(),
        layout: 'phone',
        showState: false,
        part: 'tracks',
      }),
    );
    const order = buttons()
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((l) => l.endsWith('plus one'))
      .map((l) => l.replace(' plus one', ''));
    expect(order).toEqual(['HP', 'STRESS', 'HOPE', 'ARMOR']);
  });
});
