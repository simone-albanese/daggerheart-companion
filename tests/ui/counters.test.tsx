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
   * REPLACES «puts the whole slack of the row between the value and the
   * steppers», which is no longer true and must not be quietly dropped.
   *
   * That test pinned the full-width row: a growing spacer between the value
   * target and `−`, the only growing thing in the row, so every spare pixel of
   * a 369px row - about 105px at 393, about 88px at 375 - became the distance a
   * thumb had to miss by before it opened a keyboard. The four counters are a
   * 2x2 grid now and the cell is 172.5px at 375; 88 of it is the two steppers.
   * There is no 88px cushion to be had and pretending otherwise by keeping a
   * spacer that measures half a pixel would be the assertion lying rather than
   * the design improving.
   *
   * So this pins the arrangement that replaced it, and the arithmetic that
   * makes it the only one available. Three children, in reading order, and the
   * value is the one that grows - which is the surviving half of the old rule:
   * every pixel the grid hands this cell over the 88 the steppers take lands on
   * the target you read rather than on empty space.
   */
  it('gives the cell to the value target, with the steppers at the far edge', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    const row = container.firstElementChild as HTMLElement;
    const kids = [...row.children] as HTMLElement[];

    expect(
      kids.map((el) => el.getAttribute('aria-label')),
      'the cell is not [value][−][+] any more - the full-width row had a mark, a ' +
        'label and a growing spacer as well, and none of those fit in 172.5px',
    ).toEqual(['HP 2 of 6 - tap to type a value', 'HP minus one', 'HP plus one']);

    // The gutter is the row's own gap now, and it is 4 rather than 6 for a
    // measured reason: `Counter`'s docblock has the 59.5px of ink against the
    // 64.5px of room, and six left one pixel.
    expect(row.style.gap, 'the cell gutter moved and the fit was computed on 4').toBe('4px');

    const grows = kids.filter((el) => el.style.flex.startsWith('1 1'));
    expect(
      grows.map((el) => el.getAttribute('aria-label')),
      'something other than the value grows, so the spare width is not going to the readout',
    ).toEqual(['HP 2 of 6 - tap to type a value']);
  });

  /*
   * The width the cell has to live in, stated where a change to the grid would
   * fail rather than in a comment. jsdom measures nothing, so these are the
   * declared terms: the column is the glass less this screen's 12px of padding
   * either side, the grid is two columns with one 6px gap, and the steppers are
   * two 44s with the row's 4px gutter twice.
   */
  it('leaves 76.5px for the value at 375, which is what the readout was fitted to', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    const row = container.firstElementChild as HTMLElement;
    const gutter = Number.parseFloat(row.style.gap);
    const steppers = [...row.children].filter(
      (el) => (el as HTMLElement).style.width === '44px' && (el as HTMLElement).style.height === '44px',
    );
    expect(steppers, 'the cell no longer holds two square steppers').toHaveLength(2);

    // The column is the glass less this screen's 12px of padding either side;
    // the grid is two columns and one 6px gap.
    const cell = (glass: number): number => (glass - 24 - 6) / 2;
    expect(cell(393)).toBe(181.5);
    expect(cell(375)).toBe(172.5);

    const forTheValue = (glass: number): number => cell(glass) - 44 * 2 - 2 * gutter;
    expect(forTheValue(393)).toBe(85.5);
    expect(
      forTheValue(375),
      'the narrowest cell no longer leaves the 76.5px the 59.5px value line was measured ' +
        'against - the gutter or the steppers moved and the readout was fitted to neither',
    ).toBe(76.5);
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

/*
 * The three phone mounts below used to pass `part: 'tracks'` and now pass
 * `bare: true`, and that swap is deliberately the only edit in this file.
 *
 * `part` split this component in two so the phone could pin the tracks and
 * leave the calculator in the scroll; nothing on Play is pinned any more, so
 * the prop is gone and these mounts draw the calculator's row as well - which
 * changes neither the stepper count nor the pip-group count either of them
 * asserts. Everything else here - the HP/STRESS/HOPE/ARMOR order, numbers
 * versus pips, the desktop keeping its pips, the Settings row - is untouched,
 * and that is the evidence P5-5 moved the counters rather than rebuilding them.
 */
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
        bare: true,
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
        bare: true,
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

  /*
   * The hundred pixels the whole reflow is paid for with, and the one mode
   * that must not get them.
   *
   * Four stacked rows are 4x44 + 3x6 = 194; two across are 2x44 + 6 = 94. A
   * grid that quietly caught the pip mode as well would be a regression
   * disguised as the same saving: a 12-box Hit Point track in a 172px cell
   * wraps onto three rows at WCAG's 24px floor and the four tracks come out
   * *taller* than the four they replaced.
   */
  it('puts the numbers two across and leaves the pips one to a row', () => {
    seed('numbers');
    render(
      createElement(Vitals, { stats: playedStats(), layout: 'phone', showState: false, bare: true }),
    );
    const cell = named('HP plus one').parentElement!;
    const grid = cell.parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns, 'the four counters are not two across').toBe('1fr 1fr');
    expect(grid.style.gap, 'the counters lost the 6px rhythm the four rows had').toBe('6px');
    expect(grid.children, 'the grid holds something other than the four counters').toHaveLength(4);
    for (const c of [...grid.children] as HTMLElement[]) {
      expect(c.style.minHeight, 'a counter cell is below the touch floor').toBe('44px');
    }
    // 2x44 + one 6px gap, against the 4x44 + three 6px gaps it replaced.
    expect(2 * 44 + 6).toBe(94);

    seed('pips');
    render(
      createElement(Vitals, { stats: playedStats(), layout: 'phone', showState: false, bare: true }),
    );
    const track = container.querySelector<HTMLElement>('[role="group"]')!;
    expect(
      (track.parentElement as HTMLElement).style.gridTemplateColumns,
      'the pip tracks were put two across, where a 12-box track cannot fit',
    ).toBe('');
  });

  /*
   * The one thing that would take the saving back without failing anything
   * else: a value line that wraps. The cell is 44px tall by declaration and
   * two lines of 10 + 20 fit inside it; a third line does not, and four cells
   * each one line taller is the 100px back.
   */
  it('holds the readout on one line, whatever the font does', () => {
    render(<Counter kind="stress" label="STRESS" value={12} max={12} onChange={() => {}} />);
    const value = named('STRESS 12 of 12 - tap to type a value');
    expect(value.style.overflow, 'the value target lets its contents out of the cell').toBe(
      'hidden',
    );
    const readout = [...value.children].find((el) =>
      (el.textContent ?? '').includes('/ 12'),
    ) as HTMLElement;
    expect(readout.style.whiteSpace, 'the readout may wrap, which grows the cell past 44').toBe(
      'nowrap',
    );
  });

  it('runs HP, Stress, Hope, Armor, the way the printed sheet does', () => {
    seed('numbers');
    render(
      createElement(Vitals, {
        stats: playedStats(),
        layout: 'phone',
        showState: false,
        bare: true,
      }),
    );
    const order = buttons()
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((l) => l.endsWith('plus one'))
      .map((l) => l.replace(' plus one', ''));
    expect(order).toEqual(['HP', 'STRESS', 'HOPE', 'ARMOR']);
  });
});
