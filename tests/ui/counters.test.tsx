// @vitest-environment jsdom
/**
 * Counters as numbers, which is now the only way the player's own sheet draws
 * them.
 *
 * A pip row is five taps from 2 to 7, on five 24px-wide neighbouring targets,
 * and the SRD hands Stress out in lumps - "mark 3 Stress" is three taps and
 * three chances to write a number nobody meant. So the number itself is a
 * control: tap it, type it, done. That is the behaviour under test here, along
 * with the two things that would quietly ruin it - a stepper below the touch
 * floor, and a value target sitting close enough to `+` that a thumb on its
 * way there opens a keyboard instead.
 *
 * THE SCOPE IS TESTED TOO, AND IT HAS REVERSED. This file used to say "numbers
 * are for the Play screen on a phone or a tablet, and the desktop cockpit keeps
 * its pips", and it asserted exactly that. Decision 7 takes the pips off the
 * player's own sheet on **every** layout: the cockpit's four `<Track>` rows
 * were 29 targets 32px tall - two under `--pip-h` on a mouse-only desktop and
 * twelve under it on any machine with a coarse pointer, which is every
 * touchscreen laptop and every iPad in a keyboard case - and the preference
 * could never reach them anyway. Pips survive where you read somebody else's state
 * rather than mark your own - the party board, the live scene and the
 * companion - and none of those is mounted here.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Counter } from '../../src/ui/shared/Counter.tsx';
import { Vitals } from '../../src/ui/player/Vitals.tsx';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { DEFAULT_PREFS, loadPrefs } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';
import { NARROW, PHONE, px as resolve } from './tokens.ts';

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
 * A finger going down on a control, and coming off it again.
 *
 * `MouseEvent` and not `PointerEvent`: jsdom ships no `PointerEvent`
 * constructor, and React's delegated listener keys off the event's TYPE rather
 * than its interface, so a mouse event named `pointerdown` reaches
 * `onPointerDown` exactly as the real one does. The two halves are separate
 * because the interesting state is BETWEEN them - a stepper is pressed while
 * the finger is on it, and this suite is the only place that can look.
 */
const pointerDown = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  });
};
const pointerUp = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
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

/**
 * A number an inline style declares, in px, at the narrowest glass this app is
 * drawn on.
 *
 * NARROW and not PHONE, and that is the whole argument of the floor sweep
 * below. `--counter-cell` is 90 on the owner's phone, 56 below 390, and
 * `--counter-num` steps with it, so a sweep that asked the 393px phone would be
 * reading the generous half of both tokens and calling the floor safe on the
 * strength of it. 320 is where a floor breaks if it is going to. (48 and 44
 * stood here; they are the two-line row's cell, which only the cockpit draws.)
 *
 * The numbers come out of `tokens.css` through `tokens.ts`. The line that used
 * to sit here - `if (value === 'var(--tap)') return 44` - was a copy of the
 * stylesheet kept by hand, and the day the stylesheet moved it would have gone
 * on returning 44 and passing this sweep for a target that no longer had it.
 */
const px = (value: string): number => resolve(value, NARROW);

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
    // measured reason: `Counter`'s docblock has the ink against the room at
    // every width, and six left one pixel at 375 when the number was a flat 20.
    // Since `--counter-num` the four is load-bearing at 360 and below instead.
    expect(row.style.gap, 'the cell gutter moved and the fit was computed on 4').toBe('4px');

    const grows = kids.filter((el) => el.style.flex.startsWith('1 1'));
    expect(
      grows.map((el) => el.getAttribute('aria-label')),
      'something other than the value grows, so the spare width is not going to the readout',
    ).toEqual(['HP 2 of 6 - tap to type a value']);
  });

  /*
   * The number's size is a token, not a literal, and that is decision 4 of the
   * reflow. What decides it is how wide the grid track is - measured in Chrome,
   * the card's value target is 91.5 at 393, 82.5 at 375 and 75 at 360 - and a
   * component cannot ask a grid track its width at style time, so the
   * arithmetic and its three breakpoints live in `tokens.css` where `--control`
   * and `--pip-h` already are. `stylesheets.test` holds the token's own
   * contract; this holds that the cell reads it. (85.5, 76.5 and 69 were the
   * same three targets with the two 4px gutters the card deleted, and "its one
   * breakpoint" was true before 390 and 1180 were added.)
   */
  it('draws the value at --counter-num rather than at a size of its own', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    const target = container.querySelector<HTMLButtonElement>('button')!;
    const value = [...target.querySelectorAll('span')].find((el) =>
      (el.getAttribute('style') ?? '').includes('var(--sans)'),
    );
    expect(
      value?.style.font,
      'the counter number is back to a literal size, so the 360px cell clips the tail of ' +
        '`/ 11` and no stylesheet can say otherwise - an inline font is not overridable',
    ).toBe('800 var(--counter-num)/1 var(--sans)');
    /*
     * And the target it sits in steps WITH the number, which is the half of
     * this decision that is not ink. It used to be a flat 44 and the line here
     * said «this decision is ink only»; that stopped being true at 26, where a
     * 13px label row, a 2px gap and a 26px line come to 41 against a 44px
     * cell's 42 of inner - one pixel, which `tokens.css` calls a coincidence
     * rather than a margin. So the height is the token too, and the two ends
     * of it are read out of the stylesheet rather than repeated here.
     */
    expect(
      target.style.minHeight,
      'the value target is back to a literal height, so it cannot step with the number it holds',
    ).toBe('var(--counter-cell)');
    expect(
      resolve(target.style.minHeight, NARROW),
      'the narrow cell moved. It is 56 and not 44 because the card draws three ' +
        'lines at every width - 3 + 11 + 2 + 22 + 2 + 10 + 3 - and 56 is that sum plus its ' +
        'border. The touch floor is what the button declares, not what the card is.',
    ).toBe(56);
    expect(
      resolve(target.style.minHeight, PHONE),
      'the cell stopped growing for the 38px number and the three lines around it',
    ).toBe(90);
    // Width did not move, and that is deliberate: see `Step`.
    expect(target.style.minWidth).toBe('44px');
  });

  /*
   * The width the cell has to live in, stated where a change to the grid would
   * fail rather than in a comment. jsdom measures nothing, so these are the
   * declared terms: the column is the glass less this screen's 12px of padding
   * either side, the grid is two columns with one 6px gap, and inside the card
   * the steppers are two 44s with the card's own border either side and no
   * gutter at all.
   */
  /*
   * THE NARROW END OF THAT SAME TABLE, WHICH NOTHING STATED UNTIL NOW.
   *
   * `1fr` is `minmax(auto, 1fr)`, so each track's floor was the `Counter` row's
   * own min-content - 165.81 for the STRESS cell, measured in Chrome - and the
   * grid's minimum was a viewport-independent 325.37 with its right edge pinned
   * at x = 337.37. Below that width the column's `overflow-x: hidden` simply cut
   * the `+` on STRESS and ARMOR: 17.4px of a 44px target off the glass at 320,
   * unreachable by any gesture. Floored at 0 in both places - the track here and
   * the item in `Counter` - the cell takes what the column gives it and the
   * value button absorbs the shortfall behind its own `overflow: hidden`.
   *
   * The second half is arithmetic over declared terms and cannot fail on its
   * own; it is here, in the same `it` as the two style assertions that do fail
   * pre-fix, because it is the number that says where the shape stops: 298.
   * (310 stood here, and it was the floor while the card still carried two 4px
   * gutters and this sum still left its 1px border out - see the `it`'s own
   * note on the terms it reads off the DOM.)
   */
  it('lets the cell shrink to the column, down to the 298px where the steppers stop fitting', () => {
    seed();
    render(
      createElement(Vitals, { stats: playedStats(), layout: 'phone', showState: false, bare: true }),
    );
    const cell = named('HP plus one').parentElement as HTMLElement;
    const grid = cell.parentElement as HTMLElement;
    expect(
      grid.style.gridTemplateColumns,
      'the tracks are back to a bare 1fr, whose automatic minimum is the cell\'s min-content - ' +
        'so the grid is 325.37 wide at every viewport and the STRESS and ARMOR steppers are ' +
        'cut off the glass below 337',
    ).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    expect(
      cell.style.minWidth,
      'the Counter row keeps its automatic minimum, so it overflows the track it was given ' +
        'and flooring the track achieved nothing',
    ).toBe('0px');

    /*
     * Every term off the DOM except the column's own padding, so that the card
     * losing its border or a stepper changing width moves this rather than
     * leaving it true of a shape nothing draws. It was `- 2 * 4` for the two
     * gutters the card deleted, which put the floor at 310 and the value target
     * at 49 where Chrome measures 55.
     */
    const stepper = named('HP plus one');
    const cardBorder = Number.parseFloat(cell.style.border);
    const stepW = Number.parseFloat(stepper.style.width);
    const gutter = Number.parseFloat(cell.style.gap);
    expect([cardBorder, stepW, gutter], 'the card\'s own terms moved').toEqual([1, 44, 0]);
    const width = (glass: number): number => (glass - 24 - Number.parseFloat(grid.style.gap)) / 2;
    const forTheValue = (glass: number): number =>
      width(glass) - stepW * 2 - 2 * gutter - 2 * cardBorder;
    expect(forTheValue(360)).toBe(75);
    expect(forTheValue(344)).toBe(67);
    expect(forTheValue(320)).toBe(55);
    expect(
      forTheValue(298),
      'the floor of this shape moved. At 298 the value target is exactly the 44 it declares ' +
        'as its own minWidth - measured in Chrome at 298x568, and at 297 the card is half a ' +
        'pixel wider than its track - and below it the two steppers start being pushed out ' +
        'of the cell again, which is the failure this fix exists to close',
    ).toBe(44);
  });

  it('leaves 102px for the value in the two-line row, and 91.5 in the card', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} />);
    const row = container.firstElementChild as HTMLElement;
    const gutter = Number.parseFloat(row.style.gap);
    // 44 WIDE and `--counter-cell` tall. The width is the floor and it is what
    // the arithmetic below stands on; the height is the cell, because the
    // stepper takes the room the 26px number bought for nothing. A stepper
    // that grew in width as well would take 8px out of the value target and
    // clip the very number it was widened for - see `Counter`'s note on `Step`.
    const steppers = [...row.children].filter(
      (el) =>
        (el as HTMLElement).style.width === '44px' &&
        (el as HTMLElement).style.height === 'var(--counter-cell)',
    );
    expect(steppers, 'the cell no longer holds two steppers at the 44px width floor').toHaveLength(
      2,
    );

    /*
     * THE CELL THIS SHAPE IS DRAWN IN IS THE COCKPIT'S, WHICH IS WHY THE
     * ARITHMETIC BELOW IS 198 AND NOT A PHONE'S 181.5.
     *
     * `Vitals` passes `tall` for the phone and not for the desktop, so the row
     * with gutters in it - the one this `it` renders - is only ever drawn in a
     * 198px cockpit cell: 428 of panel less 2 of border and 24 of padding is
     * 402, less the grid's 6px gap, halved. Measured in Chrome at 1280x800 the
     * value target is 102x48 there. (This test computed 85.5 and 76.5 from a
     * 393 and a 375 phone column, which is a width this shape has not been
     * drawn at since the card - and its name promised the 76.5.)
     */
    const forTheValue = (cell: number): number => cell - 44 * 2 - 2 * gutter;
    expect(forTheValue(198), 'the cockpit cell stopped leaving 102 for the value').toBe(102);

    // And the card, which is what a phone draws: the same cell arithmetic, with
    // the two gutters gone and the card's own border in their place.
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} tall />);
    const card = container.firstElementChild as HTMLElement;
    const border = Number.parseFloat(card.style.border);
    expect([Number.parseFloat(card.style.gap), border], 'the card grew a gutter').toEqual([0, 1]);
    const phoneCell = (glass: number): number => (glass - 24 - 6) / 2;
    expect(phoneCell(393)).toBe(181.5);
    expect(phoneCell(375)).toBe(172.5);
    const inTheCard = (glass: number): number => phoneCell(glass) - 44 * 2 - 2 * border;
    expect(
      [inTheCard(393), inTheCard(375)],
      'the card no longer leaves the 91.5 and 82.5 measured in Chrome at 393x852 and 375x667',
    ).toEqual([91.5, 82.5]);
  });
});

// ---------------------------------------------------------------------------
// Which surfaces get them
// ---------------------------------------------------------------------------

function seed(): void {
  const character = playedCharacter();
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
}

/** Pip rows announce themselves; the numeric row has no group at all. */
const pipGroups = (): number => container.querySelectorAll('[role="group"]').length;
const stepperCount = (): number =>
  buttons().filter((b) => (b.getAttribute('aria-label') ?? '').endsWith('plus one')).length;

/*
 * WHAT THIS DESCRIBE USED TO SAY, QUOTED BECAUSE IT WAS TRUE AND DELIBERATE.
 *
 * It held three assertions about scope: numbers are the default, the phone
 * gets pips back «when the preference says so», and the cockpit «leaves the
 * desktop cockpit on pips whatever the preference says». The first two named a
 * preference that no longer exists and are gone; the third is inverted below,
 * with its old title kept in this comment so the reversal is a decision on the
 * record rather than a test that quietly disappeared.
 *
 * The reason is measured twice. Pips were the single dearest state the Play
 * budget could not see (+100 on a 730px column), and on the cockpit they drew
 * 29 targets 32px tall - from a literal `phone ? 44 : 32` in `Vitals` that beat
 * `--pip-h`, the token that had already resolved to 44 on every machine with a
 * coarse pointer and to 34 on a mouse-only one. Two pixels under on a plain
 * desktop, twelve under on a touchscreen laptop.
 */
describe('where the numbers are allowed to be', () => {
  it('draws them on the phone Play screen', () => {
    seed();
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

  it('draws them in the desktop cockpit too, where the pips used to be', () => {
    seed();
    render(createElement(Vitals, { stats: playedStats(), layout: 'desktop', showState: false }));
    expect(stepperCount(), 'the cockpit did not grow the four steppers').toBe(4);
    expect(
      pipGroups(),
      'the cockpit is still drawing pip rows - 29 targets 32px tall, and the one surface ' +
        'the deleted preference could never reach',
    ).toBe(0);
  });

  /*
   * The order is the paper sheet's, and it is worth pinning: it was changed
   * from a frequency argument whose two premises - the counters are pinned
   * under the thumb, and the Experience chips are next to Hope - both stopped
   * being true when the Play screen became the character sheet.
   */
  /*
   * REPLACES «can be changed from Settings, and changing it writes the
   * preference», which was the only test in the suite that resolved the switch
   * by its accessible name, and which is now the assertion turned round.
   *
   * That test's own comment gave the reason it existed: "a preference nothing
   * can reach is the same defect as a feature nothing calls". The same sentence
   * is why the switch had to go rather than be left standing - after decision 7
   * it was a control whose two options draw the identical screen, sitting under
   * a hint that promised pips on three surfaces it does not govern.
   */
  it('is not a switch in Settings any more, because it is not a choice any more', async () => {
    seed();
    render(createElement(Settings));
    await settle();
    expect(
      container.querySelector('[role="group"][aria-label="Counters"]'),
      'Settings still draws the Counters switch. Both of its options now render the same ' +
        'four numeric cells, so it is a control that claims to change something and does ' +
        'not - which is the one thing this app does not do.',
    ).toBeNull();
  });

  /*
   * THE INSTALL THAT ALREADY SAID `pips`, WHICH IS THE ONLY WAY THIS CHANGE
   * COULD HURT ANYONE.
   *
   * `Prefs` is localStorage-only, so there is no schema version to move and no
   * converter was written. What has to hold instead is the read path: a record
   * carrying the deleted key must not throw, must not resurrect the branch, and
   * must not cost the *other* preferences in the same record - which is the
   * half that would fail in silence, because a user whose theme quietly reset
   * has nothing to read about it. `loadPrefs` spreads the parsed JSON over
   * `DEFAULT_PREFS`, so the orphan is kept verbatim and read by nobody.
   */
  it('ignores a stored counterStyle without dropping the record around it', () => {
    /*
     * A `localStorage` of this file's own, the way `heldDice.test.ts` and
     * `gmStore.test.ts` already do it: neither the node environment nor this
     * repo's jsdom hands one over.
     */
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    });
    localStorage.setItem(
      'dhc.prefs.v1',
      JSON.stringify({ counterStyle: 'pips', theme: 'light', gmPartySize: 6 }),
    );
    const stored = loadPrefs();
    expect(stored.theme, 'a record with an unknown key lost the preferences beside it').toBe(
      'light',
    );
    expect(stored.gmPartySize).toBe(6);
    expect(
      Object.keys(stored),
      'the orphan key was converted away. It is deliberately left where it is: prefs are ' +
        'localStorage-only, so a migration for one dead string would be a schema cost ' +
        'arriving by the back door.',
    ).toContain('counterStyle');

    const character = playedCharacter();
    useApp.setState({
      ready: true,
      storageError: null,
      dataset,
      index,
      characters: [character],
      activeId: character.id,
      prefs: stored,
      log: [],
      openCard: null,
    });
    render(
      createElement(Vitals, { stats: playedStats(), layout: 'phone', showState: false, bare: true }),
    );
    expect(stepperCount(), 'a stored "pips" still reaches a branch').toBe(4);
    expect(pipGroups(), 'a stored "pips" still draws pip rows').toBe(0);
    vi.unstubAllGlobals();
  });

  /*
   * The hundred pixels the whole reflow is paid for with.
   *
   * Four stacked rows are 4x44 + 3x6 = 194; two across are two cells and one
   * 6px gap - **186** on the owner's phone, where the card draws a 38px number
   * with its name above and its maximum below, and 118 below viewport 390 where
   * the number is 22. The
   * second half of this test used to be the pip mode, which had to stay one to
   * a row - a 12-box Hit Point track in a 172px cell wraps onto three rows at
   * WCAG's 24px floor and the four tracks come out *taller* than the four they
   * replaced. That mode is gone from this component, so what stands in its
   * place is the cockpit, which is now the same grid rather than a second
   * arrangement that has to be argued separately.
   */
  it('puts the numbers two across, on the phone and in the cockpit alike', () => {
    seed();
    render(
      createElement(Vitals, { stats: playedStats(), layout: 'phone', showState: false, bare: true }),
    );
    const cell = named('HP plus one').parentElement!;
    const grid = cell.parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns, 'the four counters are not two across').toBe(
      'minmax(0, 1fr) minmax(0, 1fr)',
    );
    expect(grid.style.gap, 'the counters lost the 6px rhythm the four rows had').toBe('6px');
    expect(grid.children, 'the grid holds something other than the four counters').toHaveLength(4);
    for (const c of [...grid.children] as HTMLElement[]) {
      expect(px(c.style.minHeight), 'a counter cell is below the touch floor').toBeGreaterThanOrEqual(
        44,
      );
      expect(
        resolve(c.style.minHeight, PHONE),
        'a counter cell stopped growing for the 38px number',
      ).toBe(90);
    }
    // Two cells and one 6px gap, against the 4x44 + three 6px gaps it replaced.
    expect(2 * resolve('var(--counter-cell)', PHONE) + 6).toBe(186);
    expect(2 * resolve('var(--counter-cell)', NARROW) + 6).toBe(118);

    /*
     * The cockpit, where this is a redraw rather than a no-op. It was three
     * 48px track rows - a 10px `.t-label`, its 6px margin, a 32px pip row -
     * inside a 428x245 panel; it is 102px of grid inside a 428x183 one, and 62
     * of the original 70 still go to `DualityRoll` below it. The eight that
     * stayed behind are the step to a 48px cell, which the cockpit still takes.
     *
     * It does NOT take the phone's 90px card. `tokens.css` puts
     * `--counter-cell` and `--counter-num` back to 48 and 26 at 1180, and
     * `Vitals` passes `tall` only for the phone, so the two shapes are one
     * decision expressed twice rather than a media query fighting a prop.
     * A cockpit cell is (402 - 6) / 2 = 198 wide, so the value target is
     * 102x48 against the phone's 91.5x90 at 393.
     */
    seed();
    render(createElement(Vitals, { stats: playedStats(), layout: 'desktop', showState: false }));
    const deskGrid = named('HP plus one').parentElement!.parentElement as HTMLElement;
    expect(
      deskGrid.style.gridTemplateColumns,
      'the cockpit counters are not the phone\'s 2x2 grid',
    ).toBe('minmax(0, 1fr) minmax(0, 1fr)');
    expect(deskGrid.style.gap, 'the cockpit grid does not carry the counters\' 6px gap').toBe(
      '6px',
    );
    expect(deskGrid.children, 'the cockpit grid holds something other than four cells').toHaveLength(
      4,
    );
    for (const c of [...deskGrid.children] as HTMLElement[]) {
      // The cockpit is drawn at 1180 and up, so it answers `--counter-cell`'s
      // 390 step as well and its cells are 48. That is what the token being a
      // width query buys over a phone branch: one arithmetic, both layouts.
      expect(
        // 48 and not the phone's 90: the cockpit takes `--counter-cell` back at
        // 1180, because its track is 198 wide, it has a mouse, and it hands
        // what it saves to `DualityRoll` under it.
        resolve(c.style.minHeight, { glass: 1280, coarse: false }),
        'the cockpit followed the phone up instead of keeping its own cell',
      ).toBe(48);
    }
  });

  /*
   * The one thing that would take the saving back without failing anything
   * else: a value line that wraps. The card is `--counter-cell` tall by
   * declaration - 90 on the owner's phone, 56 below 390 - and its three lines
   * are MEASURED against that rather than derived. Every box a bounding rect in
   * Chrome, `wizard10` at full Hit Points: 7 + 13 + 6 + 38 + 6 + 10 + 7 is 87
   * of content inside 88 of inner at 393, and 3 + 13 + 2 + 18 + 2 + 10 + 3 is
   * 51 inside 54 at 360. (`7 + 11 + ...` and `3 + 11 + 2 + 22 + ...` stood here
   * and in `tokens.css`: the first line is the 13px silhouette, not the 11px
   * name inside it, and below 380 the number is 18.) A FOURTH line fits in
   * neither, and four cells each one line taller is the saving back.
   */
  /*
   * THE CARD, WHICH IS THE SAME PIXELS DRAWN AS ONE OBJECT.
   *
   * The phone used to draw three boxes per track - a bordered value with two
   * bordered buttons beside it - and the owner's word for the result was that
   * the plus and minus sat outside the block rather than belonging to it. The
   * border, the fill and the radius move to the ROW; minus goes to its left
   * edge and plus to its right; the two 4px gutters between the old boxes
   * disappear, which is 6px of width the number did not have and 8px off the
   * row's own minimum.
   *
   * It costs no height. What is asserted here is the part that would rot: three
   * boundaries where there should be one, or a value target that keeps its box
   * and draws a second rectangle inside the card.
   */
  it('draws the phone track as one card, with the steppers at its edges', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} tall />);
    const row = container.firstElementChild as HTMLElement;

    expect(row.style.border, 'the card lost the boundary the three boxes gave up').toBe(
      '1px solid var(--line-soft)',
    );
    expect(row.style.background, 'the card is not filled, so it is a line and not an object').toBe(
      'var(--app)',
    );
    expect(
      row.style.gap,
      'there is a gutter inside the card again, which draws a second boundary where the ' +
        'border already drew one - and takes 8px off the width the number was given',
    ).toBe('0px');

    const value = named('HP 2 of 6 - tap to type a value');
    // `borderStyle` and not `border`: jsdom serialises the `none` shorthand
    // back as `medium`, which says nothing about whether a line is drawn.
    expect(
      [value.style.borderStyle, value.style.background],
      'the value target kept a box of its own, so the card contains a second rectangle',
    ).toEqual(['none', 'transparent']);

    // Minus leads, so the pair reads low to high across the card and the two
    // glyphs sit at the two edges a thumb reaches without aiming.
    expect(
      [...row.children].map((el) => el.getAttribute('aria-label')),
      'the card is not [minus][value][plus]',
    ).toEqual(['HP minus one', 'HP 2 of 6 - tap to type a value', 'HP plus one']);

    for (const step of [named('HP minus one'), named('HP plus one')]) {
      expect(step.style.alignSelf, 'a stepper stopped filling the card it lives in').toBe('stretch');
      expect(
        step.style.background,
        'a stepper drew its own fill inside the card, which is two boundaries saying one thing',
      ).toBe('transparent');
      /*
       * AND IT STILL DECLARES ITS OWN FLOOR. A stretched height is computed by
       * the parent, so it is a height no test can read: `playSheet`'s sweep
       * over every target scored these 0 and called them under the floor. The
       * promise is declared here; the stretch only ever makes it taller.
       */
      expect(px(step.style.minHeight), 'a stepper stopped promising the touch floor').toBe(44);
      expect(step.style.width).toBe('44px');
    }
  });

  /*
   * THE RING, AND THE HALF OF DECISION 27 THAT SAYS WHAT NOT TO DO.
   *
   * The card leaves NOTHING between the value target and `−` - they share an
   * edge - where the full-width row left about 105 and the cockpit's row still
   * leaves 4. There were two ways out: crop the steppers to buy the cushion
   * back, or tell the player which button they hit. The owner refused the crop
   * and took the ring, so this test has to pin BOTH halves - the ring is
   * declared, and not one target got smaller to make room for it.
   *
   * `outlineOffset` is the whole decision in one property. An outline is not in
   * the box model, so it never moved a hit area whatever its sign; the sign is
   * about what is drawn. Positive, the ring grows out of the button and lies
   * across whatever is beside it - the value target itself inside the card, the
   * 4px gutter outside it - and the card's `overflow: hidden` clips the part
   * that escapes. Negative, it is drawn whole and entirely inside a button that
   * is still 44 wide and `--counter-cell` tall. Take the property out or turn
   * it positive and this test goes red.
   */
  it('rings the stepper under the finger, two pixels inside it, and takes no hit area', () => {
    render(<Counter kind="hp" label="HP" value={2} max={6} onChange={() => {}} tall />);
    const minus = named('HP minus one');
    const plus = named('HP plus one');
    // What the button promises before anything is pressed. Whatever the ring
    // does, these two numbers are what it may not touch.
    const floor = { width: plus.style.width, minHeight: plus.style.minHeight };

    /*
     * AT REST THERE IS NO INLINE OUTLINE AT ALL, and that is not tidiness. An
     * inline declaration beats `base.css`'s `button:focus-visible`, which no
     * stylesheet rule can win back, so a ring parked here transparent - waiting
     * to be faded in - would delete the keyboard focus ring from the eight
     * most-pressed buttons on the sheet for good.
     */
    expect(
      plus.style.outlineStyle,
      'the stepper declares an outline at rest, which overrides `button:focus-visible` in ' +
        'base.css and leaves these eight buttons with no keyboard focus ring',
    ).toBe('');

    pointerDown(plus);

    expect(
      [
        plus.style.outlineWidth,
        plus.style.outlineStyle,
        plus.style.outlineColor,
        plus.style.outlineOffset,
      ],
      'the pressed stepper draws no ring, so a thumb that landed on the wrong one of two ' +
        'buttons 4px apart is told nothing',
    ).toEqual(['2px', 'solid', 'var(--edge)', '-2px']);
    /*
     * Said twice and on purpose: the string above pins the decision, and the
     * sign below pins the REASON for it. A ring at a positive offset is drawn
     * outside the border box - into the neighbour's gutter, and into the part
     * the card's `overflow: hidden` cuts off.
     */
    expect(
      Number.parseFloat(plus.style.outlineOffset),
      'the ring is offset outward. At a positive offset it is drawn in the 4px gutter `−` is ' +
        'on the other side of, and the card clips whatever leaves the row',
    ).toBeLessThan(0);

    // Nobody pressed minus, so nothing about minus changed.
    expect(minus.style.outlineStyle, 'both steppers ring, so the ring names neither').toBe('');

    /*
     * AND NOT A PIXEL. This is the half of the decision that said no. The
     * declared floor is read again with the ring lit, and it is the same
     * string it was before the press and still at or above 44 at the narrowest
     * glass the app is drawn on.
     */
    expect(
      { width: plus.style.width, minHeight: plus.style.minHeight },
      'the ring moved the stepper. The decision was no to the crop and yes to the ring, so ' +
        'the target this draws on is the target it had',
    ).toEqual(floor);
    expect(plus.style.width).toBe('44px');
    expect(px(plus.style.minHeight), 'the ringed stepper is under the touch floor').toBe(44);

    /*
     * NOT A KEYFRAME, for the reason the number's bump is not one either:
     * `base.css` zeroes `--motion` for the OS preference and for this app's own
     * switch, but its blanket `animation: none` only covers the OS one. There
     * is no transition here at all - see `Step` - so the ring is instant, which
     * is what both switches would have made it anyway.
     */
    expect(
      plus.style.animation,
      'the ring became a keyframe animation, which `[data-reduce-motion]` cannot turn off',
    ).toBe('');
    expect(
      plus.style.transition === '' || plus.style.transition.includes('var(--motion)'),
      'the ring transitions on a duration of its own, so the app own reduced-motion switch ' +
        'does not reach it',
    ).toBe(true);

    // The finger comes off. The ring outlives it by `ANSWER` - a 44px button
    // under a thumb is a 44px button nobody can see - so it is still lit here.
    pointerUp(plus);
    expect(
      plus.style.outlineOffset,
      'the ring died with the press, so on the phone it was drawn only while a thumb was on ' +
        'top of it',
    ).toBe('-2px');
  });

  /*
   * THE PRESS ANSWERS, WHICH IS THE ONE THING MARKING A TRACK NEVER DID.
   *
   * A tap changed the digit and said nothing else, and on a phone at a table
   * that is the difference between pressing once and pressing twice. The value
   * takes a short step up and settles.
   *
   * A TRANSITION AND NOT A KEYFRAME, and this is the assertion that keeps it
   * one. `base.css` zeroes `--motion` for both ways a player can ask for less
   * movement - the OS's `prefers-reduced-motion` and this app's own switch
   * through `[data-reduce-motion]` - but its blanket `animation: none` only
   * covers the OS one. An animation here would keep moving for anybody who
   * turned the app's switch off.
   */
  it('answers a press with a transition, so both reduced-motion switches reach it', () => {
    render(<Counter kind="stress" label="STRESS" value={3} max={6} onChange={() => {}} tall />);
    const value = named('STRESS 3 of 6 - tap to type a value');
    const digits = [...value.querySelectorAll('span')].find((s) =>
      (s.getAttribute('style') ?? '').includes('var(--sans)'),
    )!;

    expect(
      digits.style.transition,
      'the number no longer transitions, so a press is silent again - or it animates, which ' +
        'the app own reduced-motion switch cannot turn off',
    ).toBe('transform var(--motion) ease-out');
    expect(
      digits.style.animation,
      'the bump became a keyframe animation. `[data-reduce-motion]` only zeroes `--motion`, ' +
        'so a player who asked this app for less movement would still get this.',
    ).toBe('');
    // A transform does not apply to a non-replaced inline box, and in the
    // two-line shape this span is exactly that.
    expect(digits.style.display, 'the number went back to being an inline box').toBe(
      'inline-block',
    );
    expect(digits.style.transform, 'the number is bumped at rest').toBe('scale(1)');
  });

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
    seed();
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
