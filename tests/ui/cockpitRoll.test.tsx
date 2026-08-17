// @vitest-environment jsdom
/**
 * The cockpit's roll panel: what it holds, and whether a pointer can reach it.
 *
 * The defect this file exists for is P2-1 arriving on the desktop. The panel is
 * `flex: 1, minHeight: 0` inside a middle grid column that does not scroll, and
 * it used to declare `overflow: hidden` on top of that - so when the column ran
 * short the panel's children laid out to their declared heights and the ones at
 * the bottom were simply not painted. Measured in Chrome at 1180x695 with the
 * backup banner up and the last Hit Point marked, both default states of a
 * fresh install: panel 197 tall, scrollHeight 277, ROLL's 54px box at y 677.9
 * against a bottom edge at 674, painted 0.0px, and `main` and `.app` both with
 * `scrollHeight === clientHeight` so no wheel or drag reached it. `focus()`
 * did. That is the same failure `playSheet.test.tsx` pins for the tablet band,
 * one breakpoint higher up.
 *
 * jsdom lays nothing out, so nothing here measures. What it can do is the two
 * things that decide the defect: read the *declared* heights the panel asks for
 * and sum them the way `the budget the pin came off for` does, and walk the
 * ancestors of ROLL asking which of them clips. A panel that asks for more than
 * it is given is fine; a panel that asks for more than it is given AND clips is
 * the defect.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { DualityRoll } from '../../src/ui/player/DualityRoll.tsx';
import { Play } from '../../src/ui/player/Play.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const SOURCE = join(process.cwd(), 'src/ui/player/DualityRoll.tsx');

let container: HTMLDivElement;
let root: Root;

/** Answer media queries as a window of this width would. Copied in shape from
 *  `playSheet.test.tsx`, which is the file that established the idiom: the
 *  cockpit only exists at 1180 and up, so a test of it has to say so. */
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

function seed(patch: Partial<ReturnType<typeof playedCharacter>> = {}) {
  const character = { ...playedCharacter(), ...patch };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  return character;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(1280);
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

/** The panel, mounted on its own - which is how the cockpit renders it. */
function panel(): HTMLElement {
  const character = seed();
  render(
    createElement(DualityRoll, {
      stats: playedStats(character),
      trait: 'agility',
      onTraitChange: () => undefined,
      source: null,
      layout: 'desktop',
      armedExperiences: [],
      onArmedExperiencesChange: () => undefined,
    }),
  );
  return container.firstElementChild as HTMLElement;
}

const buttons = (el: ParentNode = container): HTMLButtonElement[] => [
  ...el.querySelectorAll('button'),
];

/** ROLL, by its declared 54px height rather than by its word: the word is
 *  `rollAffordance`'s to change and there are three of them. */
const rollButton = (): HTMLButtonElement | undefined =>
  buttons().find((b) => b.style.height === '54px');

describe('the cockpit roll panel can be scrolled to', () => {
  it('declares a vertical scroll instead of a vertical clip', () => {
    const root_ = panel();
    expect(root_.className).toContain('panel');
    expect(
      root_.style.overflow,
      'the panel is back to clipping both axes with the shorthand',
    ).toBe('');
    expect(root_.style.overflowY, 'the panel does not scroll, so a short window clips ROLL').toBe(
      'auto',
    );
    // The x axis stays clipped deliberately: `overflow-x: visible` beside a
    // scrolling y axis computes to `auto`, and ROLL's second line is `.t-num`
    // with no `min-width: 0`, so a one-word Experience name overflows it.
    expect(root_.style.overflowX).toBe('hidden');
  });

  it('leaves nothing between ROLL and the screen that clips it, in the cockpit', () => {
    seed();
    render(createElement(Play, { stats: playedStats() }));

    const roll = rollButton();
    expect(roll, 'there is no ROLL control on the cockpit').toBeDefined();

    const clipped: string[] = [];
    let scrolls = 0;
    for (let el = roll!.parentElement; el !== null && el !== container; el = el.parentElement) {
      const s = el.style;
      if (s.overflow === 'hidden' || s.overflowY === 'hidden') clipped.push(el.className || el.tagName);
      if (s.overflow === 'auto' || s.overflowY === 'auto') scrolls += 1;
    }
    expect(clipped, `ROLL is inside a clipped box: ${clipped.join(', ')}`).toEqual([]);
    // And it is inside one that scrolls, so a short window reflows rather than
    // silently dropping the control the screen exists for.
    expect(scrolls, 'nothing above ROLL scrolls, so a short window has nowhere to put it').toBe(1);
  });

  it('puts the damage offer inside the same scroll, not below the clip', () => {
    // The row that measured 15 of 44 at 1280x800. It is drawn only once a roll
    // has resolved with something armed, so the assertion is structural: the
    // element the row is rendered into is a child of the panel, above the log.
    const source = readFileSync(SOURCE, 'utf8');
    const desktopRow = source.indexOf('<DamageRow key={rollId} attack={attack} affordance={affordance} layout="desktop" />');
    const log = source.indexOf('<RecentLog />');
    expect(desktopRow, 'the cockpit lost its damage row').toBeGreaterThan(0);
    expect(desktopRow, 'the damage row moved below the log').toBeLessThan(log);
  });
});

/**
 * THE BUDGET THIS PANEL ASKS FOR, WHICH IS WHY IT HAD TO BE ALLOWED TO SCROLL.
 *
 * The same shape as `playSheet.test.tsx`'s `the budget the pin came off for`:
 * a literal table of declared heights in draw order, with the terms that come
 * out of a stylesheet marked, plus assertions that the DOM still declares the
 * ones it can read. jsdom measures nothing, so the table is the deliverable
 * and the reads below are the tripwire on it drifting.
 *
 * The measured counterpart, in Chrome at 1180x695 with the backup banner up and
 * the last Hit Point marked: 197 of panel holding a scrollHeight of 277.
 */
describe('what the panel asks its column for', () => {
  const PADDING = 24; // 12 top + 12 bottom, declared on the panel
  const GAP = 10; // declared on the panel, four times over five children
  const STACK: Array<[string, number, 'declared' | 'css']> = [
    // `ExperienceChip`'s `minHeight: var(--tap)` is the tallest thing in it.
    ['the control row', 44, 'css'],
    // `Die`'s `minHeight: 62`, both faces and the trait box beside them.
    ['the dice row', 62, 'declared'],
    // 10 + 10 of padding around a `clamp(16px,1.6vw,22px)/1` line, which is
    // 18.88px at a 1180px window and 20.48px at 1280.
    ['the verdict strip', 38.9, 'css'],
    ['ROLL', 54, 'declared'],
    // `RecentLog` at its floor: the 10px RECENT label, a 5px gap, an empty box.
    ['the log', 15, 'css'],
  ];

  it('adds up to 277.9, which is 80.9 more than a 1180x695 window gives it', () => {
    const sum = STACK.reduce((n, [, h]) => n + h, 0) + PADDING + GAP * (STACK.length - 1);
    expect(sum).toBeCloseTo(277.9, 1);
    // The number the harness measured, and the reason `overflow: hidden` was a
    // reachability defect rather than a tight fit: ROLL is the 54 at the bottom
    // of that sum, and 277.9 - 197 = 80.9 is more than 54.
    expect(sum - 197).toBeGreaterThan(54);
  });

  it('still declares the two terms of that sum it can be asked for', () => {
    const root_ = panel();
    expect(root_.style.padding).toBe('12px');
    expect(root_.style.gap).toBe('10px');

    const die = [...root_.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.style.minHeight === '62px',
    );
    expect(die, 'the dice faces no longer declare 62px').toBeDefined();
    expect(rollButton()?.style.height, 'ROLL no longer declares its own height').toBe('54px');
    // And ROLL is `flex: none`, so nothing above it can take the pixels back by
    // shrinking it instead of scrolling.
    // jsdom expands the `none` keyword, so the assertion is on what it means.
    expect(rollButton()?.style.flex).toBe('0 0 auto');
  });

  it('leaves the log the only child that can give height back', () => {
    const root_ = panel();
    const flexible = [...root_.children].filter(
      (el) => (el as HTMLElement).style.flex === '1' || (el as HTMLElement).style.flex === '1 1 0%',
    );
    expect(flexible).toHaveLength(1);
    expect(flexible[0]!.textContent).toContain('RECENT');
  });
});
