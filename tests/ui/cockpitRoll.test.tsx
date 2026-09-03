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
import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import {
  DualityRoll,
  ExperienceRow,
  type RollTrait,
} from '../../src/ui/player/DualityRoll.tsx';
import { DIE_SIZES, MAX_HELD, useHeldDice } from '../../src/ui/player/heldDice.ts';
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
function panel(prefs: Partial<typeof DEFAULT_PREFS> = {}): HTMLElement {
  const character = seed();
  useApp.setState({ prefs: { ...DEFAULT_PREFS, ...prefs } });
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

  it('carries the app scroll treatment, and the fade only when there is more', () => {
    /*
     * For one commit this was the only scroller in the app with none of the
     * app's scroll treatment on it: no `.scroll`, so no coloured thumb, no
     * `scrollbar-width: thin`, and `overscroll-behavior: auto`. On macOS, which
     * is where this repository is measured, no bar is painted at rest either -
     * the panel's whole gutter is offsetWidth 428 less clientWidth 426, i.e.
     * the border. So the fold had no affordance at all until after you had
     * scrolled.
     */
    const root_ = panel();
    expect(root_.className, 'the panel scrolls with none of the app treatment').toContain(
      'scroll',
    );
    /*
     * And the fade is conditional, which is the whole difference between this
     * and the unconditional `.scroll-fade` that cost `Play`'s column four
     * dialogs their CLOSE button. jsdom lays nothing out, so nothing overflows,
     * so the mark must be absent here.
     */
    expect(
      root_.className.split(' '),
      'the fade is unconditional, so a panel that fits wears one too',
    ).not.toContain('scroll-fade');
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
 * The measured counterpart of the state that forced the scroll, in Chrome at
 * 1180x695 with the backup banner up and the last Hit Point marked: 197 of
 * panel holding a scrollHeight of 277.
 *
 * THE TABLE BELOW IS THE SHIPPED PANEL, NOT THAT ONE, and two of the terms it
 * used to carry were wrong in opposite directions by about 14px each, so the
 * sum came out right and neither error showed. The control row is not 44 - it
 * wraps, and measures 155.3 at five Experiences. The dice row is not `Die`'s
 * `minHeight: 62` - on the cockpit `Die` is drawn `size={46}`, so its own
 * content is 76 and the 62 never binds here at all. Both are pinned against
 * Chrome now rather than against an assumption.
 */
describe('what the panel asks its column for', () => {
  const PADDING = 24; // 12 top + 12 bottom, declared on the panel
  const GAP = 10; // declared on the panel, four times over five children
  const STACK: Array<[string, number, 'declared' | 'css' | 'measured']> = [
    // `ControlRow` wraps. 44 is the single-row height it had while it scrolled
    // sideways and hid five of thirteen controls; 155.3 is what three wrapped
    // rows measure at the five Experiences of `wizard10`, and 94 is the two
    // rows the `played` fixture's two Experiences pack into.
    ['the control row', 155.3, 'measured'],
    // NOT `Die`'s `minHeight: 62`, which binds on the phone and never here:
    // `size={46}` here, so 10 of `t-meta` label + 46 of number + 18 of padding
    // + 2 of border = 76, and the trait box beside it matches.
    ['the dice row', 76, 'measured'],
    // 10 + 10 of padding around a `clamp(16px,1.6vw,22px)/1` line, which is
    // 18.88px at a 1180px window and 20.48px at 1280. Idle; after a roll the
    // detail span wraps and it measures 57.8 to 64.
    ['the verdict strip', 38.9, 'css'],
    ['ROLL', 54, 'declared'],
    // `RecentLog`'s floor: 15 of RECENT label and gap, plus one 23px entry.
    ['the log', 38, 'declared'],
  ];

  it('adds up to 426.2, and puts the two terms below ROLL below the fold', () => {
    const sum = STACK.reduce((n, [, h]) => n + h, 0) + PADDING + GAP * (STACK.length - 1);
    expect(sum).toBeCloseTo(426.2, 1);
    // Measured idle at 1180x695: this panel is 369 tall with a scrollHeight of
    // 426. What is over the 369 is the log and part of its gap - ROLL is
    // painted 54 of 54 - which is the whole point of the draw order.
    const roll = STACK.findIndex(([name]) => name === 'ROLL');
    const throughRoll =
      STACK.slice(0, roll + 1).reduce((n, [, h]) => n + h, 0) + 12 + GAP * roll;
    expect(throughRoll).toBeCloseTo(366.2, 1);
    expect(throughRoll, 'ROLL no longer ends inside a 369px panel').toBeLessThan(369);
  });

  it('still declares the terms of that sum it can be asked for', () => {
    const root_ = panel();
    expect(root_.style.padding).toBe('12px');
    expect(root_.style.gap).toBe('10px');

    const die = [...root_.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.style.minHeight === '62px',
    );
    expect(die, 'the dice faces no longer declare 62px').toBeDefined();
    // And the 62 is not the dice row's height on this layout: `size` is what
    // decides it, and 46 of number over a 10px label inside 18 of padding and
    // 2 of border is 76.
    const number = [...die!.querySelectorAll<HTMLElement>('span')].find((s) =>
      s.style.font.includes('46px'),
    );
    expect(number, 'the cockpit die no longer draws its number at 46px').toBeDefined();
    expect(die!.style.padding).toBe('9px 10px');
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
    /*
     * And it gives back down to a floor, not to nothing. With `minHeight: 0`
     * this box measured 0 tall at 1180x695, 1280x800 and 1366x768 with three
     * rolls made, and its content did not join the panel's overflow either -
     * the log's own box is `.scroll`, so its 69px sat behind a scroll of its
     * own inside a 0px box. 38 is the RECENT label and its gap (15) plus one
     * 23px entry, and it puts the log back in the panel's scrollHeight.
     */
    expect(
      (flexible[0] as HTMLElement).style.minHeight,
      'the log can be squeezed to nothing again',
    ).toBe('38px');
  });
});

/**
 * THE MODIFIER SHELF, WHICH USED TO SHOW FOUR AND A HALF OF THIRTEEN CONTROLS.
 *
 * `overflowX: 'auto'` with `scrollbarWidth: 'none'` in a 303px row holding
 * 1058px of content, byte-identical at 1180, 1280, 1440 and 2560 because the
 * middle grid track is capped at 428. Measured painted widths against that
 * shelf: REACTION 62.2 of 62.2, the three advantage chips whole, the first
 * Experience 108.8 of 124, and then four Experience chips, `+ DIE`, DIFF and
 * SPELLCAST at 0.0px each. DIFF is the one that mattered most: `armedMods`
 * renders only in the phone branch, so on the cockpit the difficulty control
 * was not named anywhere else before a roll.
 *
 * The shelf is 402 now, not 303: the `Duality Roll` title that took 93 of it
 * is gone, and 402 is the middle track's 428 less the panel's 2 of border and
 * 24 of padding. `ControlRow` is the wrapping row itself rather than one of two
 * children of a `.spread`, which is why `shelf()` below reads the panel's first
 * child directly.
 *
 * jsdom does not wrap and does not measure, so these are declaration reads.
 * What they can prove is that the row is allowed to wrap, that nothing in this
 * file suppresses a scrollbar any more, and that every control the shelf holds
 * is in the DOM at a declared floor.
 */
describe('the cockpit modifier shelf', () => {
  const shelf = (): HTMLElement => {
    const row = panel().firstElementChild as HTMLElement | null;
    if (row === null || !row.className.includes('row')) {
      throw new Error('the panel does not open with the control row');
    }
    return row;
  };

  it('spends none of its width on a title', () => {
    // The title was `!narrow`, i.e. the cockpit only - the one surface that
    // could not afford it. Nothing on this row is a static label any more.
    const row = shelf();
    expect(row.textContent, 'the cockpit shelf still spends 93px on a word').not.toContain(
      'Duality Roll',
    );
    expect(row.textContent).not.toContain('Reaction Roll');
    expect(row.style.flexWrap).toBe('wrap');
  });

  it('wraps instead of scrolling sideways, on the cockpit as well as the phone', () => {
    const row = shelf();
    expect(row.style.flexWrap, 'the cockpit shelf still scrolls sideways').toBe('wrap');
    expect(row.style.overflowX, 'the shelf is still a horizontal scroll container').toBe('');
    // `overflow-y: hidden` beside an `overflow-x: visible` computes the x axis
    // back to `auto`, so leaving it would put the scroller back by the side
    // door.
    expect(row.style.overflowY).toBe('');
    expect(row.style.scrollbarWidth, 'the shelf still hides its own scrollbar').toBe('');
  });

  it('leaves no scroller in this file that suppresses its own bar', () => {
    const source = readFileSync(SOURCE, 'utf8');
    // A declaration, not a mention: the docblocks argue about `scrollbarWidth`
    // on purpose, and a test that forbade the word would forbid the argument.
    expect(source).not.toMatch(/^\s*scrollbarWidth:/m);
    // And no prop deciding it per layout: one caller, one behaviour.
    expect(source).not.toMatch(/wrap=\{layout/);
    expect(source).not.toMatch(/flexWrap: wrap \?/);
  });

  it('has DIFF on the cockpit, where nothing else names it before a roll', () => {
    const row = shelf();
    const diff = row.querySelector<HTMLInputElement>('input[type="number"]');
    expect(diff, 'the cockpit has no difficulty control at all').not.toBeNull();
    expect(row.textContent).toContain('DIFF');
    expect(diff!.style.minHeight, 'DIFF is under the control floor').toBe('var(--control)');
  });

  it('holds every declared control at a floor, not four and a half of them', () => {
    const row = shelf();
    const targets = buttons(row);
    // REACTION, DIS, —, ADV, two Experience chips, `+ DIE`, and SPELLCAST when
    // the character has a Spellcast trait. The fixture is a level-3 character
    // with two Experiences and no held dice.
    const names = targets.map((b) => (b.textContent ?? '').trim());
    for (const want of ['REACTION', 'ADV', 'DIS', '+ DIE']) {
      expect(names.some((n) => n.includes(want)), `${want} is not in the shelf`).toBe(true);
    }
    for (const b of targets) {
      const floor = b.style.minHeight;
      expect(
        floor === 'var(--control)' || floor === 'var(--tap)',
        `${(b.textContent ?? '?').trim()} declares no floor at all`,
      ).toBe(true);
    }
  });

  it('costs the panel 50px at two Experiences and 111 at five', () => {
    /*
     * Greedy flex packing into the 402px shelf with a 6px gap, from the widths
     * measured in Chrome: REACTION 62.2, DIS/—/ADV 34 each, an Experience chip
     * at its 124px `maxWidth`, `+ DIE` 45.4, DIFF 88.4, SPELLCAST 68.4. The
     * unnamed second Experience of the repo fixture measures 99.3.
     *
     * Row heights: every control but the Experience chips is
     * `minHeight: var(--control)`, 34 on a mouse and on a touchscreen laptop
     * alike - `--control`'s query is `(pointer: coarse)`, which a touchscreen
     * laptop does not match, measured 34px on the rig's `hybrid` profile. An
     * `ExperienceChip` is `minHeight: var(--tap)` = 44, and 49.7 when its name
     * takes the third line the clamp allows. The row gap is the shelf's own 6.
     */
    const GAP = 6;
    const rows = (widths: number[], shelfWidth: number): number[][] => {
      const out: number[][] = [];
      let line: number[] = [];
      let used = 0;
      for (const w of widths) {
        const next = line.length === 0 ? w : used + GAP + w;
        if (line.length > 0 && next > shelfWidth) {
          out.push(line);
          line = [w];
          used = w;
        } else {
          line.push(w);
          used = next;
        }
      }
      out.push(line);
      return out;
    };
    const SHELF = 402;
    const CHIP = 124; // a chip whose name fits two lines
    const LONG = 124.001; // the same width, but a name that takes the third
    const UNNAMED = 99.3;
    const height = (line: number[]): number => {
      if (line.some((w) => w === LONG)) return 49.7;
      return line.some((w) => w === CHIP || w === UNNAMED) ? 44 : 34;
    };
    const cost = (widths: number[]): number => {
      const packed = rows(widths, SHELF);
      const tall = packed.reduce((n, line) => n + height(line), 0) + GAP * (packed.length - 1);
      // Against the single 44px row it replaces.
      return tall - 44;
    };

    const base = [62.2, 34, 34, 34];
    const tail = [45.4, 88.4, 68.4];
    // `played`: two rows of 44. Measured 94 of shelf in Chrome at 1280x800.
    expect(cost([...base, CHIP, UNNAMED, ...tail])).toBeCloseTo(50, 1);
    // `wizard10`: three rows, the first two carrying one long name each.
    // Measured 155.3 of shelf at 1180, 1280, 1366 and 1440 alike.
    expect(cost([...base, LONG, LONG, CHIP, CHIP, CHIP, ...tail])).toBeCloseTo(111.4, 1);
    // And what the title cost: the same five Experiences packed into 302.8
    // measured 229.7, so dropping it is worth 74.4 of panel height.
    expect(155.4 - 229.7).toBeCloseTo(-74.3, 1);
  });
});

/**
 * THE EXPERIENCE CHIP'S LABEL, WHICH IS THE WHOLE CONTENT OF THE CONTROL.
 *
 * One declaration - `WebkitLineClamp` on the label span - covers the cockpit's
 * inline chips and the phone's `ExperienceRow` alike, and at 2 it clipped a
 * whole line on both. Measured in Chrome: on the cockpit at the chip's 124px
 * `maxWidth` the span is 77.8 wide with clientHeight 26 against a scrollHeight
 * of 40, for "SILVER-TONGUED DIPLOMAT", "Read every book in the tower" and
 * "Talked my way past a magistrate" alike; on the phone at 375x1000 with five
 * Experiences the chip is 172.5 with a 126.3px span and the same 26/40. The
 * crossing on the phone is exactly 381px of viewport.
 *
 * Two lanes proposed incompatible fixes. This settles it at three lines rather
 * than a wider cockpit chip; the docblock over the span carries the argument
 * and the numbers below carry the arithmetic.
 *
 * The shipped chip measures 49.7 when a name takes the third line and 44 when
 * it does not. The 47.675 an earlier revision of this file asserted left out
 * the chip's own 1px border, which is declared unconditionally - `transparent`
 * when unarmed - and lays out either way under a global `box-sizing:
 * border-box`.
 */
describe('an Experience is legible on the chip that spends it', () => {
  const LINE = 12 * 1.15; // the declared `600 0.75rem/1.15 var(--mono)`, at the 16px root
  // The chip's own box around the text: paddingTop 4 + paddingBottom 4, plus
  // the 1px + 1px of the border it declares unconditionally (`transparent`
  // when unarmed, and a transparent border is still laid out). `box-sizing:
  // border-box` is global, so all of it comes out of the 44.
  const BOX = 4 + 4 + 1 + 1;
  const FLOOR = 44; // `minHeight: var(--tap)`

  const labels = (el: ParentNode): HTMLElement[] =>
    [...el.querySelectorAll<HTMLElement>('button[aria-label^="Utilize "] span')].filter(
      (s) => s.style.display === '-webkit-box',
    );

  it('gives the label three lines on the cockpit', () => {
    const found = labels(panel());
    expect(found.length, 'the cockpit draws no Experience chips at all').toBeGreaterThan(0);
    for (const span of found) {
      expect(span.style.webkitLineClamp, 'the cockpit chip still clips a line').toBe('3');
      expect(span.style.whiteSpace, '`.chip`s nowrap is back and the clamp does nothing').toBe(
        'normal',
      );
    }
  });

  it('gives the label three lines on the phone, from the same declaration', () => {
    const character = seed();
    render(
      createElement(ExperienceRow, {
        experiences: character.experiences,
        armedExperiences: [],
        hopeAvailable: 3,
        toggleExperience: () => undefined,
      }),
    );
    const found = labels(container);
    expect(found.length).toBe(character.experiences.length);
    for (const span of found) {
      expect(span.style.webkitLineClamp).toBe('3');
    }

    // One declaration and not two: the two surfaces disagreeing about how much
    // of a name is readable is the defect this settles.
    const source = readFileSync(SOURCE, 'utf8');
    expect(source.match(/WebkitLineClamp/g) ?? []).toHaveLength(1);
  });

  it('costs the chip 7.4px, and only when the third line is used', () => {
    // Two lines sit inside the touch floor; three step past it by 7.4. That is
    // the whole price. `box-sizing: border-box` is what makes the padding part
    // of the 44 rather than on top of it - and the border with it, which is why
    // `BOX` is 10 and not 8. At the 11.5px the chip was before the readability
    // ramp the sums were 36.45 and 49.675, and Chrome measured 49.7 on the
    // cockpit chip at its 124px `maxWidth` and 44 on the chips whose names fit
    // two lines; at `.chip-name`'s 12px they are 37.6 and 51.4 by the same
    // declarations.
    expect(2 * LINE + BOX).toBeCloseTo(37.6, 2);
    expect(2 * LINE + BOX).toBeLessThan(FLOOR);
    expect(3 * LINE + BOX).toBeCloseTo(51.4, 3);
    expect(3 * LINE + BOX - FLOOR).toBeCloseTo(7.4, 3);

    // And the terms of that arithmetic are still declared on the chip - the
    // border included, so the term cannot go missing again.
    const chip = panel().querySelector<HTMLElement>('button[aria-label^="Utilize "]');
    expect(chip).not.toBeNull();
    expect(chip!.style.font).toBe('600 0.75rem/1.15 var(--mono)');
    expect(chip!.style.minHeight).toBe('var(--tap)');
    expect(chip!.style.paddingTop).toBe('4px');
    expect(chip!.style.paddingBottom).toBe('4px');
    expect(chip!.style.border, 'the chip lost the border its height is costed with').toMatch(
      /^1px solid /,
    );
  });

  it('refuses the 168px chip, because it packs two to a row where 124 packs three', () => {
    /*
     * The rejected proposal, kept as a number rather than as prose. The shelf
     * is 402 since the `Duality Roll` title went, so 168 is no longer a chip
     * that cannot pack at all - it is a chip that packs two to a row where 124
     * packs three, which at five Experiences is four rows instead of three.
     */
    expect(168 * 3 + 12, 'three 168px chips would fit after all').toBeGreaterThan(402);
    expect(168 * 2 + 6).toBeLessThan(402);
    expect(124 * 3 + 12, 'the shipped chip no longer packs three to a row').toBeLessThan(402);
    // 44 + 44 + 44 + 34 and three 6px gaps, against the 155.3 the shipped chip
    // measures: +28.7 for the wider chip against +11.3 for the third line.
    expect(44 * 3 + 34 + 6 * 3).toBeCloseTo(184, 1);
    expect(184 - 155.3).toBeCloseTo(28.7, 1);
    const chip = panel().querySelector<HTMLElement>('button[aria-label^="Utilize "]');
    expect(chip!.style.maxWidth, 'the cockpit chip was widened after all').toBe('124px');
  });
});

/**
 * THE KEYPAD A PHYSICAL DIE IS TYPED INTO, AND THE WAY OUT OF IT.
 *
 * The twelve keys are `repeat(4, 1fr)` with `gap: 3`, `padding: 6` and a 1.5px
 * border that lays out as 1 at dpr 1, so a key is `(G - 23) / 4` for a grid of
 * outer width G. They carry `minHeight: var(--control)` and no `minWidth`, so
 * the width falls out of whatever box holds them - and the box used to be one
 * die face. On a phone that made a key `(vw - 78) / 8`: 37.1px at 375 and under
 * 44 all the way to 429px of viewport. On the cockpit the die face is about
 * 123px wide and the audit measured 24px keys in Chrome at 1440x900 (grid
 * 119x122, four 24px columns) - under this project's 34px fine-pointer floor,
 * under its 44px coarse one, and under WCAG's 24 as well.
 *
 * The grid also replaced the die button while it was open, so there was no
 * cancel, no backdrop, no Escape and no second tap: the only exit was
 * committing a face. That is BACKLOG P3-12, written down and unticked.
 *
 * jsdom lays nothing out, so the widths below are arithmetic over declared
 * terms and the rest are declaration and behaviour reads.
 */
describe('typing a physical die', () => {
  const typed = { manualDice: true, digitalDice: true };
  const KEYS = 12;
  const COLUMNS = 4;
  /** Grid outer width -> key width, from the declared padding, gap and border. */
  const key = (outer: number): number =>
    (outer - 2 - 12 - 3 * (COLUMNS - 1)) / COLUMNS;

  const face = (name: 'HOPE' | 'FEAR'): HTMLButtonElement => {
    const found = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${name} die`),
    );
    if (found === undefined) throw new Error(`no ${name} face`);
    return found;
  };
  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  const grid = (): HTMLElement | null =>
    container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]');

  it('opens the keypad over both faces, not inside one of them', () => {
    panel(typed);
    expect(grid(), 'the keypad is open before anything was tapped').toBeNull();

    click(face('HOPE'));
    const open = grid();
    expect(open, 'tapping a face opened no keypad').not.toBeNull();
    // Both faces are gone, which is what makes the grid the width of the pair.
    expect(
      buttons().filter((b) => /^(HOPE|FEAR) die/.test(b.getAttribute('aria-label') ?? '')),
      'a die face is still drawn beside the keypad, so it kept half the row',
    ).toHaveLength(0);
    // jsdom expands the `1` shorthand; the point is a zero basis that grows.
    expect(open!.style.flex, 'the keypad does not take the row it was given').toBe('1 1 0%');
    expect([...open!.querySelectorAll('button')]).toHaveLength(KEYS);
  });

  it('puts every key over the floor at every width in the sweep', () => {
    /*
     * The keypad is `flex: 1` where the two faces were, less the 44px exit
     * column and the 8px gap that separates it.
     *
     * Phone: the column is the viewport less 24 of padding.
     * Cockpit: the middle grid track is 428, less the panel's 2 of border and
     * 24 of padding is 402, less the 132px trait box and one 12px gap.
     */
    const EXIT = 44 + 8;
    const phone = (vw: number): number => key(vw - 24 - EXIT);
    for (const [vw, want] of [
      [320, 55.25],
      [360, 65.25],
      [375, 69],
      [393, 73.5],
    ] as Array<[number, number]>) {
      expect(phone(vw), `a key at ${vw}px`).toBeCloseTo(want, 2);
      expect(phone(vw), `a key at ${vw}px is under the 44px coarse floor`).toBeGreaterThanOrEqual(
        44,
      );
    }

    const cockpit = key(402 - 132 - 12 - EXIT);
    expect(cockpit).toBeCloseTo(45.75, 2);
    // Measured 45.8 in Chrome at 1280x800 and 1440x900, on a fine pointer and
    // on the rig's `hybrid` profile alike.
    //
    // WIDTH ONLY. The height is `minHeight: var(--control)`, and `--control`'s
    // query is `(max-width: 1179px), (pointer: coarse)` - `pointer` is the
    // PRIMARY pointer, so a touchscreen laptop at 1180 and up answers `fine`
    // and gets 34, measured 34px on the `hybrid` profile. The cockpit key is
    // therefore 45.8x34: clear of this project's 34px fine floor in both
    // directions, and 10px under its 44px coarse floor in height for a finger.
    // The phone key is 69x44 and clears both, because below 1180 the same query
    // is true on width alone.
    expect(cockpit).toBeGreaterThanOrEqual(34);
    expect(cockpit, 'the cockpit key clears the coarse floor in width').toBeGreaterThan(44);

    /*
     * AND THE 402 HAS A SCROLLBAR TERM IN IT. The panel scrolls and an open
     * keypad is the state that guarantees it overflows, so on a platform that
     * draws a classic bar rather than an overlay one the content box is
     * narrower. The panel reserves it with `scrollbar-gutter: stable` so it is
     * one width per platform rather than one per scroll state, and `.scroll`
     * bounds the bar at 8px (`scrollbar-width: thin` and an 8px
     * `::-webkit-scrollbar`). macOS draws overlay bars, so the gutter is 0
     * there and no measurement in this pass could see this - the rig also
     * launches Chrome with `--hide-scrollbars`.
     */
    const BAR = 8;
    const withBar = key(402 - BAR - 132 - 12 - EXIT);
    expect(withBar).toBeCloseTo(43.75, 2);
    expect(withBar, 'a reserved 8px bar takes the key under the fine floor').toBeGreaterThan(
      34,
    );
    const root_ = panel(typed);
    expect(
      root_.style.scrollbarGutter,
      'the gutter is unreserved, so the keys move when the keypad opens',
    ).toBe('stable');

    // And what it used to be, from the same function: one face is half the
    // pair, so the phone key was `(vw - 78) / 8` and the cockpit key ~24.
    expect(key((375 - 24 - 8) / 2)).toBeCloseTo(37.125, 3);
    expect(key((402 - 132 - 24) / 2)).toBeCloseTo(25, 2);
  });

  it('still declares the terms that arithmetic is derived from', () => {
    panel(typed);
    click(face('FEAR'));
    const open = grid()!;
    expect(open.style.gridTemplateColumns).toBe('repeat(4, 1fr)');
    expect(open.style.gap).toBe('3px');
    expect(open.style.padding).toBe('6px');
    for (const k of [...open.querySelectorAll<HTMLElement>('button')]) {
      expect(k.style.minHeight, `key ${k.textContent ?? '?'} lost its floor`).toBe(
        'var(--control)',
      );
    }
  });

  it('has a way out that is not typing a number you did not roll', () => {
    panel(typed);
    click(face('HOPE'));
    const exit = buttons().find(
      (b) => b.getAttribute('aria-label') === 'Stop typing the HOPE die',
    );
    expect(exit, 'the keypad still has no cancel: BACKLOG P3-12').toBeDefined();
    // It is the die's own label, so it says which die is being typed as well as
    // how to stop - and it is a 44px column, so it costs the row no height.
    expect(exit!.textContent).toContain('HOPE');
    expect(exit!.style.width).toBe('var(--tap)');
    expect(exit!.getAttribute('aria-keyshortcuts')).toBe('Escape');

    // And it is where the keyboard already is. Opening the keypad unmounts the
    // die face that had focus, so focus fell to `<body>` - measured - and the
    // exit was the 53rd focusable on the cockpit, key "1" the 54th of 81.
    expect(document.activeElement, 'the keypad opens with focus on nothing').toBe(exit);

    click(exit!);
    expect(grid(), 'the cancel did not shut the keypad').toBeNull();
    // And nothing was written: the face is still empty.
    expect(face('HOPE').getAttribute('aria-label')).not.toContain(': ');
    // And focus is back on the face that opened it, not on `<body>`: closing
    // unmounts the exit the same way opening unmounted the face.
    expect(document.activeElement, 'the way out fires the keyboard into nothing').toBe(
      face('HOPE'),
    );
  });

  it('gives focus back on Escape and on a committed face alike', () => {
    panel(typed);
    click(face('FEAR'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(grid()).toBeNull();
    expect(document.activeElement, 'Escape left focus on the body').toBe(face('FEAR'));

    click(face('HOPE'));
    click([...grid()!.querySelectorAll('button')][6]!); // the seventh key: 7
    expect(document.activeElement, 'committing a face left focus on the body').toBe(
      face('HOPE'),
    );
  });

  it('closes on Escape, and commits nothing when it does', () => {
    panel(typed);
    click(face('FEAR'));
    expect(grid()).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(grid(), 'Escape does nothing, which is half of P3-12').toBeNull();
    expect(face('FEAR').getAttribute('aria-label')).not.toContain(': ');
  });

  it('leaves Escape to whatever is on top of it', () => {
    /*
     * `useDialog` registers its own unconditional window keydown per dialog and
     * does not `stopPropagation`, so without a topmost check one Escape closes
     * the dialog AND this keypad underneath it - and the player comes back to a
     * roll surface that silently reverted. Reproduced in Chrome at 1440x900
     * with a loadout card opened over the keypad. `SessionBody` and `Gm` both
     * name this shape as a defect and restructure around it.
     */
    panel(typed);
    click(face('HOPE'));
    expect(grid()).not.toBeNull();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(grid(), 'one Escape closed a dialog and the keypad under it').not.toBeNull();

    // And once the dialog is gone the key is this keypad's again.
    dialog.remove();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(grid(), 'the guard swallowed the key for good').toBeNull();
  });

  it('keeps the other die readable while this one is typed', () => {
    /*
     * Taking the whole face row took the sibling face with it, and nothing else
     * prints the number already in it: `rollLine`'s raw-dice branch is gated on
     * `!canType`, and the cockpit trait box prints `result?.total ?? '—'`,
     * which is an em dash until both faces are in. So a HOPE of 7 typed a
     * moment earlier was nowhere on the glass while FEAR was entered.
     */
    panel(typed);
    click(face('HOPE'));
    click([...grid()!.querySelectorAll('button')][6]!); // 7
    click(face('FEAR'));

    const open = grid()!;
    const column = open.parentElement!;
    expect(column.textContent, 'the HOPE already typed is nowhere on the keypad').toContain(
      'HOPE',
    );
    expect(column.textContent).toContain('7');

  });

  it('draws no sibling readout when there is nothing to keep', () => {
    // A keypad opened first shows the same exit column it always did.
    panel(typed);
    click(face('FEAR'));
    const column = grid()!.parentElement!;
    expect(column.textContent, 'an empty sibling is drawn as a readout anyway').not.toContain(
      'HOPE',
    );
  });

  it('writes the face it was opened on, and only when a key is pressed', () => {
    panel(typed);
    click(face('HOPE'));
    click([...grid()!.querySelectorAll('button')][6]!); // the seventh key: 7
    expect(grid(), 'committing a face left the keypad open').toBeNull();
    expect(face('HOPE').getAttribute('aria-label')).toContain(': 7');
    expect(face('FEAR').getAttribute('aria-label')).not.toContain(': ');
  });
});

/**
 * WHAT THE "THERE IS MORE BELOW" FADE COSTS THE PANEL TO KEEP TRUE.
 *
 * `useMoreBelow` re-reads on every commit deliberately: a child growing - the
 * damage row appearing, the keypad opening, a name wrapping - is not observable
 * any other way. That part is right and is not what this describes.
 *
 * What it dragged with it was the wiring. Reading and wiring were one
 * `useLayoutEffect` with no dependency list, so every commit of `DualityRoll`
 * removed the `scroll` listener, added an identical one back, disconnected the
 * `ResizeObserver` and constructed a new one. `DualityRoll` commits on every die
 * tap, every armed modifier, every trait change and several times per roll, and
 * none of those can change whether there is content below the fold. A fresh
 * `observe()` also schedules a callback for the element's initial size, so each
 * of those commits queued an extra read after paint and then replaced the
 * observer that would have delivered it.
 *
 * Measured here against the pre-fix hook: a bare mount built 2 observers and
 * added 2 listeners, and four ordinary taps took that to 6 and 6, with 5
 * disconnects. After the split it is 1 and 1 for the life of the panel.
 *
 * jsdom has no `ResizeObserver`, which is what the hook's own guard is for, so
 * the counting one below is the only way this cost is visible to the suite at
 * all. The two cases are the two halves that have to stay true together: the
 * wiring is built once, and it still works afterwards.
 */
describe('the fade watches the panel without rebuilding the watch', () => {
  const typed = { manualDice: true, digitalDice: true };

  class CountingObserver {
    static built = 0;
    static callbacks: (() => void)[] = [];
    static observed = 0;
    static disconnected = 0;
    constructor(callback: () => void) {
      CountingObserver.built += 1;
      CountingObserver.callbacks.push(callback);
    }
    observe(): void {
      CountingObserver.observed += 1;
    }
    unobserve(): void {}
    disconnect(): void {
      CountingObserver.disconnected += 1;
    }
  }

  let scrollAdds = 0;
  let scrollRemoves = 0;
  const realAdd = HTMLElement.prototype.addEventListener;
  const realRemove = HTMLElement.prototype.removeEventListener;

  beforeEach(() => {
    CountingObserver.built = 0;
    CountingObserver.callbacks = [];
    CountingObserver.observed = 0;
    CountingObserver.disconnected = 0;
    scrollAdds = 0;
    scrollRemoves = 0;
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = CountingObserver;
    HTMLElement.prototype.addEventListener = function (
      this: HTMLElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'scroll') scrollAdds += 1;
      return (realAdd as unknown as (...a: unknown[]) => void).call(this, type, ...rest);
    } as typeof realAdd;
    HTMLElement.prototype.removeEventListener = function (
      this: HTMLElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === 'scroll') scrollRemoves += 1;
      return (realRemove as unknown as (...a: unknown[]) => void).call(this, type, ...rest);
    } as typeof realRemove;
  });

  afterEach(() => {
    HTMLElement.prototype.addEventListener = realAdd;
    HTMLElement.prototype.removeEventListener = realRemove;
    delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
  });

  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  const face = (name: 'HOPE' | 'FEAR'): HTMLButtonElement => {
    const found = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${name} die`),
    );
    if (found === undefined) throw new Error(`no ${name} face`);
    return found;
  };
  const keypad = (): HTMLElement | null =>
    container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]');

  it('builds the listener and the observer once, not once per tap', () => {
    const box = panel(typed);
    expect(CountingObserver.built, 'a bare mount already built more than one').toBe(1);
    expect(scrollAdds, 'a bare mount already added more than one').toBe(1);

    // Four real interactions, each of which commits `DualityRoll`: open the
    // keypad on one face, type a 7 into it, open it on the other, type a 3.
    click(face('HOPE'));
    click([...keypad()!.querySelectorAll('button')][6]!);
    click(face('FEAR'));
    click([...keypad()!.querySelectorAll('button')][2]!);
    expect(face('HOPE').getAttribute('aria-label'), 'the taps did not land').toContain(': 7');

    expect(
      CountingObserver.built,
      'every commit of the roll panel throws away its ResizeObserver and builds ' +
        'another - and a fresh observe() queues a callback the next commit then ' +
        'discards, so the cost is paid on every die tap and every roll frame',
    ).toBe(1);
    expect(
      scrollAdds,
      'the scroll listener is torn off and put back on every commit of the panel',
    ).toBe(1);
    expect(CountingObserver.disconnected, 'the one observer was disconnected while live').toBe(0);
    expect(scrollRemoves).toBe(0);
    // Still the same box, so none of the above is explained by a remount.
    expect(container.firstElementChild).toBe(box);
  });

  it('still puts the fade on when the box says there is more, after all of that', () => {
    const box = panel(typed);
    click(face('HOPE'));
    click([...keypad()!.querySelectorAll('button')][6]!);

    // jsdom lays nothing out, so the box is told what it would have measured.
    Object.defineProperty(box, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(box, 'clientHeight', { value: 400, configurable: true });

    // Through the listener that was wired before those two taps, which is the
    // half a rebuilt-every-commit effect could hide: it works either way.
    act(() => {
      box.dispatchEvent(new Event('scroll'));
    });
    expect(
      box.className.split(' '),
      'the panel has 500px below the fold and wears no "more below" mark',
    ).toContain('scroll-fade');

    // And through the observer's own callback, which is the half that a
    // disconnected-and-replaced observer would have dropped.
    Object.defineProperty(box, 'scrollHeight', { value: 400, configurable: true });
    act(() => {
      for (const callback of CountingObserver.callbacks) callback();
    });
    expect(
      box.className.split(' '),
      'the panel fits and still wears the fade, which is the unconditional ' +
        '`.scroll-fade` this hook was written to replace',
    ).not.toContain('scroll-fade');
  });
});

/**
 * THE DICE THE APP ROLLED FOR A TABLE THAT HAD TURNED IT OFF.
 *
 * `rollDuality` honours `fixed` for four things - hope, fear, the advantage d6
 * and every bonus die - and this surface only ever handed it two. `resolve`'s
 * parameter was `(fixed?: { hope: number; fear: number })`, so
 * `input.fixed?.advantage ?? rng(6)` and `input.fixed?.bonus?.[i] ?? rng(sides)`
 * both fell through to `cryptoRng`, and a player who had typed their two faces
 * was shown a total containing 2 to 12 points the app had made up. Nothing on
 * the screen said which points those were: the log line prints the bonus dice,
 * and the log is not drawn on a phone at all.
 *
 * WHAT THESE ASSERT IS THE NUMBER THE SURFACE PRINTS, not the argument handed to
 * the engine. The trait box's 46px total is the readout the table acts on, and
 * an app-rolled die is visible there as arithmetic that does not add up - so the
 * assertion is `hope + fear + advantage + bonus + the modifier the bar itself
 * declares`, which no rng can satisfy twice.
 */
describe('a typed roll is typed all the way down', () => {
  const typed = { manualDice: true, digitalDice: false };

  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  /** The panel, with `sides` worth of dice already in this character's tray. */
  function typedPanel(sides: number[] = []): HTMLElement {
    const character = seed();
    act(() => useHeldDice.setState({ byCharacter: {} }));
    for (const n of sides) {
      act(() => useHeldDice.getState().add(character.id, n as (typeof DIE_SIZES)[number]));
    }
    useApp.setState({ prefs: { ...DEFAULT_PREFS, ...typed } });
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

  const byText = (word: string): HTMLButtonElement => {
    const found = buttons().find((b) => (b.textContent ?? '').trim() === word);
    if (found === undefined) throw new Error(`no control reading "${word}"`);
    return found;
  };
  const byLabelStart = (prefix: string): HTMLButtonElement => {
    const found = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(prefix),
    );
    if (found === undefined) throw new Error(`no control named "${prefix}..."`);
    return found;
  };
  /** One armed die's slot, by the key it carries for the focus walk. */
  const slot = (key: string): HTMLButtonElement | null =>
    container.querySelector<HTMLButtonElement>(`button[data-die^="${key}"]`);
  /**
   * The total the cockpit prints in 46px: the number the table reads.
   *
   * Found through the trait box - the 132px column beside the faces - and not
   * by the 46px type alone, because `Die` draws its own number at `size={46}`
   * on this layout and the first match was the HOPE face.
   */
  const total = (): string => {
    const box = container.querySelector<HTMLElement>('div[style*="width: 132px"]');
    const spans = [...(box?.querySelectorAll<HTMLElement>('span') ?? [])];
    return spans[spans.length - 1]?.textContent?.trim() ?? '';
  };
  /** The instruction line the verdict strip carries. */
  const strip = (): string =>
    (container.querySelector('.spread')?.textContent ?? '').toUpperCase();
  /** The modifier the bar declares for itself, so nothing here restates it. */
  const modifier = (): number => {
    const found = /2d12 ([+−])(\d+)/.exec(container.textContent ?? '');
    if (found === null) throw new Error('the bar stopped declaring its own modifier');
    return (found[1] === '+' ? 1 : -1) * Number(found[2]);
  };

  /** Type `value` into one of the two big faces. */
  const typeFace = (name: 'HOPE' | 'FEAR', value: number): void => {
    click(byLabelStart(`${name} die`));
    const grid = container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]')!;
    click([...grid.querySelectorAll('button')][value - 1]!);
  };
  /** Type `value` into one of the armed dice. */
  const typeExtra = (key: string, value: number): void => {
    click(slot(key)!);
    const grid = container.querySelector<HTMLElement>('div[role="group"]')!;
    click([...grid.querySelectorAll('button')][value - 1]!);
  };

  it('offers a slot for every die that is in the total, and only those', () => {
    typedPanel([6]);
    // Nothing armed: the pair is the whole roll, and the row costs nothing.
    expect(slot('advantage'), 'a die nobody armed was asked for').toBeNull();
    expect(slot('bonus'), 'a die nobody armed was asked for').toBeNull();

    click(byText('ADV'));
    expect(slot('advantage'), 'the advantage d6 has nowhere to be typed').not.toBeNull();
    expect(slot('bonus')).toBeNull();

    click(byLabelStart('d6 held die'));
    expect(slot('bonus'), 'the held die has nowhere to be typed').not.toBeNull();

    // And they go away with the thing that armed them: ADV against DIS cancels
    // in `advantageSign`, so a die that is not in the total must not be asked
    // for. `—` is the middle chip of the advantage group.
    click(byText('—'));
    expect(slot('advantage'), 'a cancelled advantage die was still asked for').toBeNull();
  });

  it('never rolls the advantage die or the bonus die for a player typing dice', () => {
    typedPanel([6]);
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    const mod = modifier();

    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    /*
     * THE REFUSAL, WHICH IS THE HALF THAT MAKES THIS HONEST. Two dice are still
     * blank, so there is no total to print - and the app must not fill either
     * one in to make one. Before this, both faces landing WAS the roll, and the
     * two dice below were rolled with `cryptoRng` at that instant.
     */
    expect(total(), 'the roll resolved with two dice still blank').toBe('—');
    expect(strip(), 'nothing on screen says which die it is waiting for').toContain(
      'STILL TO TYPE',
    );
    expect(strip()).toContain('ADV');

    typeExtra('advantage', 3);
    expect(total(), 'the roll resolved with the bonus die still blank').toBe('—');
    expect(strip()).toContain('+D6');

    typeExtra('bonus', 4);
    // 5 + 8 + 3 + 4, plus the modifier the bar declares. An app-rolled d6 in
    // either of the last two places lands here as a number that does not add up.
    expect(total(), 'the total is not the sum of the dice the player typed').toBe(
      String(5 + 8 + 3 + 4 + mod),
    );
  });

  /*
   * ONE GUARD PER DIE, AND EACH PROVED WITHOUT THE OTHER STANDING BEHIND IT.
   * The test above arms both, so either guard alone holds the roll back and a
   * deleted one is invisible - which is what happened: deleting the advantage
   * check left that test green, because the bonus die was still blank. Two
   * cases and two mounts, since one `it` reusing the tree carries the first
   * half's typed faces and its armed advantage into the second.
   */
  it('refuses on the advantage die alone', () => {
    typedPanel();
    click(byText('ADV'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(total(), 'the advantage d6 was rolled by the app and added').toBe('—');
    expect(strip()).toContain('STILL TO TYPE');
    expect(strip()).toContain('ADV');
    typeExtra('advantage', 3);
    expect(total(), 'the advantage die landed and the roll did not').toBe(
      String(5 + 8 + 3 + modifier()),
    );
  });

  it('refuses on a bonus die alone', () => {
    typedPanel([6]);
    click(byLabelStart('d6 held die'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(total(), 'the held die was rolled by the app and added').toBe('—');
    expect(strip()).toContain('+D6');
    typeExtra('bonus', 4);
    expect(total(), 'the bonus die landed and the roll did not').toBe(
      String(5 + 8 + 4 + modifier()),
    );
  });

  it('gives the same total every time, which is what "nothing was rolled" means', () => {
    /*
     * The arithmetic above can be satisfied by a lucky `cryptoRng` once - 1 in
     * 36 for the two dice together. Ten identical rolls cannot: a d6 and a d6
     * that the app were rolling would have to come up 3 and 4 ten times over.
     */
    const totals = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      typedPanel([6]);
      click(byText('ADV'));
      click(byLabelStart('d6 held die'));
      typeFace('HOPE', 5);
      typeFace('FEAR', 8);
      typeExtra('advantage', 3);
      typeExtra('bonus', 4);
      totals.add(total());
      act(() => root.unmount());
      container.remove();
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    }
    expect([...totals], 'the total moved between two identical typed rolls').toHaveLength(1);
  });

  it('shows what the app rolled in those same slots when the app did the rolling', () => {
    /*
     * The other direction, and the reason the slots are a readout as well as an
     * input: with the roller on, a player who taps ROLL gets the app's dice
     * mirrored back into the same boxes. `DamageRow` states the rule - a row of
     * dice a player has read aloud is never sitting beside a total that does
     * not come from it.
     *
     * This asserted the advantage slot alone, and passed for a reason that was
     * not the one written on it: `advantage` is not cleared by a roll, so that
     * slot was still being built from the live declaration. The bonus slot was
     * not - `resolve` empties `armedDice` in the same body that writes the
     * faces - so the d6 whose face was in the total had no slot at all by the
     * next render, and the sentence "a digital roll mirrors its dice back into
     * the same slots" was false for every die it was written about. The row is
     * frozen into `manual.resolved` now; the case below asserts the d6.
     */
    const character = seed();
    act(() => useHeldDice.setState({ byCharacter: {} }));
    act(() => useHeldDice.getState().add(character.id, 6));
    useApp.setState({ prefs: { ...DEFAULT_PREFS, manualDice: true, digitalDice: true } });
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
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    click(rollButton()!);

    const advantage = slot('advantage')!.getAttribute('aria-label') ?? '';
    expect(advantage, 'the app rolled an advantage die and showed nobody').toMatch(
      /ADV d6: [1-6] /,
    );
    const shown = Number(/ADV d6: (\d+) /.exec(advantage)![1]);
    expect(container.textContent, 'the total came from dice that are not on screen').toContain(
      total(),
    );
    expect(shown).toBeGreaterThanOrEqual(1);
    expect(shown).toBeLessThanOrEqual(6);
  });

  it('declares the floors the slot row and its keys are read at', () => {
    /*
     * jsdom lays nothing out, so these are the declarations the arithmetic in
     * `ExtraSlot`'s and `ExtraKeypad`'s docblocks is over. A key is
     * `(G - 26) / 5` for a grid of outer width G - 2 of border at dpr 1, 12 of
     * padding and four 3px gutters - so 54.0 at a 320px viewport, 68.6 at 393
     * and 75.2 on the cockpit's 402px panel, 73.6 with the 8px bar `.scroll`
     * bounds and `scrollbar-gutter: stable` reserves.
     */
    typedPanel([6]);
    click(byText('ADV'));
    const box = slot('advantage')!;
    expect(box.style.minHeight, 'the slot went under the touch floor').toBe('var(--tap)');
    expect(box.style.minWidth).toBe('var(--tap)');
    expect(box.style.flex, 'the slot shrinks past its floor instead of wrapping').toBe(
      '1 1 44px',
    );

    click(box);
    const grid = container.querySelector<HTMLElement>('div[role="group"]')!;
    expect(grid.style.gridTemplateColumns).toBe('repeat(5, 1fr)');
    expect(grid.style.gap).toBe('3px');
    expect(grid.style.padding).toBe('6px');
    const keys = [...grid.querySelectorAll<HTMLElement>('button')];
    expect(keys, 'a d6 no longer draws six faces').toHaveLength(6);
    for (const k of keys) expect(k.style.minHeight).toBe('var(--control)');

    const key = (outer: number): number => (outer - 2 - 12 - 3 * 4) / 5;
    expect(key(320 - 24)).toBeCloseTo(54.0, 1);
    expect(key(393 - 24)).toBeCloseTo(68.6, 1);
    expect(key(402)).toBeCloseTo(75.2, 1);
    expect(key(402 - 8), 'a reserved 8px bar takes the key under the coarse floor').toBeCloseTo(
      73.6,
      1,
    );
    for (const outer of [320 - 24, 393 - 24, 402, 402 - 8]) {
      expect(key(outer), `a key at ${outer}px of grid`).toBeGreaterThanOrEqual(44);
    }

    /*
     * AND HOW TALL THE GRID IS, WHICH IS THE HALF THAT WENT STALE. The docblock
     * derives `rows * var(--control) + (rows - 1) * 3 + 14` against the
     * `repeat(5, 1fr)` asserted above, and then called the d10 and the d12
     * "both three rows". `ceil(10 / 5)` is 2, so the d10 cost the 152/122 of the
     * worst case in prose while costing the 105/85 of the d6 it was being
     * contrasted with. Counted off `DIE_SIZES` here rather than off an example.
     */
    const gridRows = (sides: number): number => Math.ceil(sides / 5);
    const gridTall = (sides: number, control: number): number =>
      gridRows(sides) * control + (gridRows(sides) - 1) * 3 + 14;
    expect(DIE_SIZES.map(gridRows), 'the tray sizes stopped being 4, 6, 8, 10, 12').toEqual([
      1, 2, 2, 2, 3,
    ]);
    // 44 is `--control` below 1180 or on a coarse pointer, 34 on the cockpit.
    expect([gridTall(6, 44), gridTall(6, 34)]).toEqual([105, 85]);
    expect(
      [gridTall(10, 44), gridTall(10, 34)],
      'a d10 is two rows, which is the d6’s cost and not the d12’s',
    ).toEqual([105, 85]);
    expect(
      [gridTall(12, 44), gridTall(12, 34)],
      'the d12 is the only three-row grid this row can draw',
    ).toEqual([152, 122]);
    expect(
      DIE_SIZES.filter((n) => gridRows(n) === 3),
      'more than one size reaches three rows, so the worst case is no longer the d12 alone',
    ).toEqual([12]);
  });

  it('leaves the slots standing while one of them is being typed', () => {
    /*
     * `DieKeypad` takes the whole face row and carries a readback column for
     * the sibling it displaced, because taking the row took the number just
     * typed off the glass. There can be thirteen dice here - one advantage die
     * and `MAX_HELD` - and no column holds thirteen numbers, so this grid opens
     * UNDER its row instead. Everything already typed stays where it was.
     */
    typedPanel([6]);
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    typeExtra('advantage', 2);
    click(slot('bonus')!);

    expect(container.querySelector('div[role="group"]'), 'no keypad opened').not.toBeNull();
    expect(
      slot('advantage')?.getAttribute('aria-label'),
      'the advantage die already typed went off the screen',
    ).toContain(': 2');
    // And the open slot is the way out: a second tap on it, no cancel invented.
    expect(slot('bonus')?.getAttribute('aria-expanded')).toBe('true');
    click(slot('bonus')!);
    expect(container.querySelector('div[role="group"]'), 'the slot did not shut it').toBeNull();
  });

  it('draws no slot at all when typing is switched off', () => {
    /*
     * `canType` is the gate, not a fourth notion of what mode this is in. With
     * the roller on and typing off the app rolls these dice, which is what that
     * table asked for, and the row costs the panel nothing.
     */
    const character = seed();
    act(() => useHeldDice.setState({ byCharacter: {} }));
    act(() => useHeldDice.getState().add(character.id, 6));
    useApp.setState({ prefs: { ...DEFAULT_PREFS } });
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
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    expect(slot('advantage'), 'a slot was drawn for a build that does not type').toBeNull();
    expect(slot('bonus')).toBeNull();
    expect(container.textContent).not.toContain('STILL TO TYPE');
  });
});

/**
 * ONE ROLL'S FACES, AND ONLY THAT ROLL'S - WHICH IS THE SECOND ROLL OF A
 * SESSION, AND EVERY ROLL AFTER IT.
 *
 * The block above pins the FIRST roll of a fresh panel, and every one of its
 * cases starts from one. That is the hole this block exists for: `manual` kept
 * the faces of the roll before, keyed by tray id, and `resolve` cleared only
 * the declaration - so the app went on being honest exactly once. Re-arm the
 * same d6 and its slot arrived holding the previous roll's face and a roll made
 * of it resolved on a number nobody had rolled for it; type one face after an
 * app-made roll and the app's advantage die went straight into the player's
 * total, which is the original defect verbatim, one roll later.
 *
 * THE CONTRACT EVERY CASE HERE IS AN INSTANCE OF: a total the surface presents
 * is composed only of faces entered for that roll - every one of them, and
 * nothing else. `Manual`'s docblock is where the lifecycle that holds it is
 * argued; these drive it.
 */
describe('the roll after the roll', () => {
  const TYPED = { manualDice: true, digitalDice: false };
  const BOTH = { manualDice: true, digitalDice: true };

  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  /** The panel, at a layout, with `sides` worth of dice in this character's tray. */
  function mount(
    prefs: Partial<typeof DEFAULT_PREFS>,
    sides: number[] = [],
    layout: 'phone' | 'desktop' = 'desktop',
    patch: Partial<ReturnType<typeof playedCharacter>> = {},
    /* Declared before the roll, which is where the SRD puts it and where
       `Play` owns it: this component only ever reads the prop. */
    armedExperiences: string[] = [],
  ): void {
    const character = seed(patch);
    act(() => useHeldDice.setState({ byCharacter: {} }));
    for (const n of sides) {
      act(() => useHeldDice.getState().add(character.id, n as (typeof DIE_SIZES)[number]));
    }
    useApp.setState({ prefs: { ...DEFAULT_PREFS, ...prefs } });
    render(
      createElement(DualityRoll, {
        stats: playedStats(character),
        trait: 'agility',
        onTraitChange: () => undefined,
        source: null,
        layout,
        armedExperiences,
        onArmedExperiencesChange: () => undefined,
      }),
    );
  }

  const byText = (word: string): HTMLButtonElement => {
    const found = buttons().find((b) => (b.textContent ?? '').trim() === word);
    if (found === undefined) throw new Error(`no control reading "${word}"`);
    return found;
  };
  const byLabelStart = (prefix: string): HTMLButtonElement => {
    const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(prefix));
    if (found === undefined) throw new Error(`no control named "${prefix}..."`);
    return found;
  };
  const slot = (key: string): HTMLButtonElement | null =>
    container.querySelector<HTMLButtonElement>(`button[data-die^="${key}"]`);
  const label = (key: string): string => slot(key)?.getAttribute('aria-label') ?? '';
  /** The total the cockpit prints beside the faces: the number the table reads. */
  const total = (): string => {
    const box = container.querySelector<HTMLElement>('div[style*="width: 132px"]');
    const spans = [...(box?.querySelectorAll<HTMLElement>('span') ?? [])];
    return spans[spans.length - 1]?.textContent?.trim() ?? '';
  };
  const strip = (): string =>
    (container.querySelector('.spread')?.textContent ?? '').toUpperCase();
  const modifier = (): number => {
    const found = /2d12 ([+−])(\d+)/.exec(container.textContent ?? '');
    if (found === null) throw new Error('the bar stopped declaring its own modifier');
    return (found[1] === '+' ? 1 : -1) * Number(found[2]);
  };
  /** The same modifier in the shape the log prints it, so nothing here restates it. */
  const modSign = (): string => `${modifier() >= 0 ? '+' : '−'}${String(Math.abs(modifier()))}`;
  const faceGrid = (): HTMLElement =>
    container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]')!;
  const typeFace = (name: 'HOPE' | 'FEAR', value: number): void => {
    click(byLabelStart(`${name} die`));
    click([...faceGrid().querySelectorAll('button')][value - 1]!);
  };
  const typeExtra = (key: string, value: number): void => {
    click(slot(key)!);
    const grid = container.querySelector<HTMLElement>('div[role="group"]')!;
    click([...grid.querySelectorAll('button')][value - 1]!);
  };

  it('hands a re-armed die back blank, and says so before it resolves anything', () => {
    /*
     * `manual.bonus` is keyed by tray id and the tray id outlives the roll. So:
     * arm a d6, type the roll, roll it. `resolve` disarms the die and the face
     * stayed. Arm the same die for the next roll and its slot came back reading
     * 4 - a face from a roll that was over - and because `extraDice` read that
     * 4 as entered, `untyped` had nothing outstanding in it and the next HOPE
     * resolved the whole roll on it.
     */
    mount(TYPED, [6]);
    click(byLabelStart('d6 held die'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    typeExtra('bonus', 4);
    const first = total();
    expect(first, 'the first roll is the one that already worked').toBe(
      String(5 + 8 + 4 + modifier()),
    );

    click(byLabelStart('d6 held die'));
    expect(
      label('bonus'),
      'the die came back to the next roll holding the last roll’s face',
    ).toContain('not entered');

    typeFace('HOPE', 6);
    expect(
      total(),
      'the last roll’s total was still on the glass beside the new roll’s faces',
    ).toBe('—');
    expect(strip(), 'nothing said the new roll was still waiting for anything').toContain(
      'STILL TO TYPE',
    );
    expect(strip(), 'the die it is waiting for is not named').toContain('+D6');
    expect(strip()).toContain('FEAR');
  });

  it('asks for the advantage die again on the second roll, having asked once', () => {
    /*
     * The same leak with no re-arming in it, because the advantage sign is
     * deliberately NOT cleared by a roll - it is what the table declared, not
     * who rolled. So the sign stood, the slot stood, `manual.advantage` stood,
     * and roll two resolved the instant its HOPE landed: 1 + 8 + roll one's 3.
     */
    mount(TYPED);
    click(byText('ADV'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    typeExtra('advantage', 3);
    const first = total();
    expect(first).toBe(String(5 + 8 + 3 + modifier()));

    typeFace('HOPE', 1);
    expect(
      total(),
      'the first roll’s total was still standing over the second roll’s HOPE',
    ).toBe('—');
    expect(strip()).toContain('STILL TO TYPE');
    expect(strip(), 'the advantage die was never asked for a second time').toContain('ADV');
    expect(label('advantage')).toContain('not entered');

    typeFace('FEAR', 8);
    typeExtra('advantage', 2);
    expect(total(), 'the second roll is not the sum of its own faces').toBe(
      String(1 + 8 + 2 + modifier()),
    );
  });

  it('keeps the dice the app rolled out of the total the table typed', () => {
    /*
     * BOTH SWITCHES ON, which `rollAffordance` supports and Settings offers.
     * Arm ADV, tap ROLL - the app rolls the advantage d6 - then type the two
     * faces off the table's own dice. `resolve` had written the app's die into
     * the same `manual` the typed path reads, so the total the surface printed
     * contained a number the app invented at a table holding real dice, unnamed
     * and unasked for. That is the defect this whole file was rewritten for.
     */
    mount(BOTH);
    click(byText('ADV'));
    click(rollButton()!);
    expect(label('advantage'), 'the app rolled no advantage die').toMatch(/ADV d6: [1-6] /);

    typeFace('HOPE', 5);
    expect(
      label('advantage'),
      'the app’s advantage die was still standing in the typed roll',
    ).toContain('not entered');
    expect(strip()).toContain('STILL TO TYPE');
    expect(strip()).toContain('ADV');

    typeFace('FEAR', 8);
    typeExtra('advantage', 3);
    expect(total(), 'the typed total is not the sum of the typed faces').toBe(
      String(5 + 8 + 3 + modifier()),
    );
  });

  it('never drops a die out of a total without saying so first', () => {
    /*
     * The correcting tap, and why it is gone rather than fixed. `resolve` ends
     * with `setArmedDice([])`, so the loop that rebuilt `bonus` from the armed
     * dice ran over an empty list: correcting HOPE from 5 to 6 re-resolved with
     * `bonus: []` and the total fell from 18 to 15. Raising a face by one took
     * three points out, the bonus slot was already unmounted so it could not be
     * put back, and nothing on the screen said the d6 had left.
     *
     * A correcting tap and the first face of the next roll are the same
     * gesture, so the panel cannot tell them apart and no longer guesses: the
     * face starts a new roll, and every die that roll wants is named before any
     * total moves.
     */
    mount(TYPED, [6]);
    click(byLabelStart('d6 held die'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    typeExtra('bonus', 4);
    const first = total();
    expect(first).toBe(String(5 + 8 + 4 + modifier()));

    typeFace('HOPE', 6);
    expect(total(), 'a total stood beside a roll that was not complete').toBe('—');
    expect(strip()).toContain('STILL TO TYPE');
    expect(strip()).toContain('FEAR');
    expect(
      strip(),
      'the spent d6 was still being counted into the roll after it',
    ).not.toContain('+D6');

    typeFace('FEAR', 8);
    expect(total(), 'the second roll counted a die nobody armed for it').toBe(
      String(6 + 8 + modifier()),
    );
  });

  it('mirrors every die of an app roll back into its own slot, the d6 included', () => {
    /*
     * D2: the commit said a digital roll mirrors its dice back into the same
     * slots, and `resolve` cleared `armedDice` in the same body that wrote the
     * faces - so `armedHeld` was empty on the next render and the bonus slot
     * was `null`. The mirrored face was unobservable until the die was re-armed,
     * at which point it was the first case in this block.
     */
    mount(BOTH, [6]);
    click(byLabelStart('d6 held die'));
    click(rollButton()!);
    expect(
      slot('bonus'),
      'the die whose face is in the total has no slot on the screen',
    ).not.toBeNull();
    expect(label('bonus')).toMatch(/\+D6 d6: [1-6] /);
    expect(
      slot('bonus')?.disabled,
      'a finished roll offered one of its dice for editing',
    ).toBe(true);
    expect(label('bonus'), 'the slot does not say what it is').toContain(
      'the roll it was typed for is done',
    );
  });

  it('takes the advantage die away with the sign that armed it', () => {
    /*
     * The advantage sign has the other two shapes of the same rule on it. ADV,
     * DIS and neither are three different rolls - `advantageSign` cancels one
     * against the other - so changing it mid-declaration drops the face typed
     * under the old one, and changing it over a finished roll starts a new one
     * rather than leaving that roll's frozen ADV slot standing for a sign that
     * is no longer armed.
     *
     * And re-pressing the sign already armed is not a change: it must not throw
     * away what the player has typed so far, which is what a bare setter would
     * have done once this hung a clear off it.
     */
    mount(TYPED);
    click(byText('ADV'));
    typeExtra('advantage', 3);
    typeFace('HOPE', 5);
    click(byText('ADV'));
    expect(
      label('advantage'),
      'pressing the armed sign again threw the roll away',
    ).toContain(': 3');
    expect(byLabelStart('HOPE die').getAttribute('aria-label')).toContain(': 5');

    click(byText('DIS'));
    expect(label('advantage'), 'the slot kept the sign it was typed under').toContain('DIS');
    expect(
      label('advantage'),
      'a d6 typed under ADV was counted as the DIS die',
    ).toContain('not entered');

    // And over a finished roll the sign starts a new one outright.
    typeExtra('advantage', 2);
    typeFace('FEAR', 8);
    expect(total()).toBe(String(5 - 2 + 8 + modifier()));
    click(byText('—'));
    expect(
      slot('advantage'),
      'the finished roll’s advantage slot outlived the sign that armed it',
    ).toBeNull();
    expect(byLabelStart('HOPE die').getAttribute('aria-label')).not.toContain(':');
  });

  it('gives the keyboard somewhere to come back to when the slot is spent', () => {
    /*
     * The keypad takes focus on open because the tap that opened it unmounts
     * the button that had it, and `DualityRoll` puts focus back when it closes.
     * An extra die's slot is `disabled` the moment its roll resolves, and a
     * disabled button cannot take focus - so committing the LAST face of a roll
     * from a slot dropped the keyboard onto `<body>`, which is exactly the bug
     * that effect was written for, on the one gesture that reaches it.
     */
    mount(TYPED);
    click(byText('ADV'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    // The advantage die is the last one outstanding, so this face resolves it.
    typeExtra('advantage', 3);
    expect(total()).toBe(String(5 + 8 + 3 + modifier()));
    expect(slot('advantage')?.disabled, 'the spent slot is still a way in').toBe(true);
    expect(
      document.activeElement?.getAttribute('aria-label') ?? '',
      'the keyboard came out of the keypad onto nothing',
    ).toMatch(/^HOPE die/);
  });

  it('takes a face away with the die it was typed for', () => {
    /*
     * Within one declaration this time, and no roll in sight: a face lives
     * exactly as long as the die it was typed for stays armed. Without that
     * the id-keyed map is a second way back to a stale face - disarm the d6,
     * arm it again, and the 4 is waiting.
     */
    mount(TYPED, [6]);
    click(byLabelStart('d6 held die'));
    typeExtra('bonus', 4);
    expect(label('bonus')).toContain(': 4');

    click(byLabelStart('d6 held die'));
    expect(slot('bonus'), 'a disarmed die kept a slot').toBeNull();
    click(byLabelStart('d6 held die'));
    expect(label('bonus'), 'the face outlived the arming that asked for it').toContain(
      'not entered',
    );
  });

  it('offers the finished roll’s numbers to nothing, keypad included', () => {
    /*
     * The keypad is the other place the last roll could be handed to the next
     * one. Opening HOPE over a resolved panel used to arrive with the old HOPE
     * as the selected key and the old FEAR in the readback column beside it -
     * an arithmetic the panel is about to throw away the moment a key lands.
     */
    mount(TYPED);
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(total()).toBe(String(5 + 8 + modifier()));

    click(byLabelStart('HOPE die'));
    const lit = [...faceGrid().querySelectorAll<HTMLElement>('button')].filter(
      (b) => b.style.background !== 'var(--raised)',
    );
    expect(lit, 'the keypad came up holding the last roll’s face').toHaveLength(0);
    // The whole keypad row, which is the exit column and the readback beside it
    // - the idiom `draws no sibling readout when there is nothing to keep` uses.
    const row = faceGrid().parentElement!;
    expect(
      row.textContent,
      'the readback column offered the last roll’s FEAR to this one',
    ).not.toContain('FEAR');
  });


  /*
   * THE OTHER HALF OF THE LIFECYCLE, WHICH ROUND 2 LEFT OUT.
   *
   * `Manual` says a roll is `{ hope, fear, the advantage die if a sign is
   * armed, one face per armed die }`, and three events change what is in that
   * list: `armAdvantage`, `toggleDie` and the press-and-hold that discards a
   * die out of the tray. Round 2 taught all three to INVALIDATE a roll and
   * taught only `setDie` to ask whether one is now COMPLETE - so a roll that
   * had every face it needed could be left standing with no total, no log line
   * and a bar telling the player to type dice they had already typed. The only
   * way forward was to retype one of them.
   *
   * These are one case per event that can complete a roll without a face being
   * typed. `setDie`'s own case is every other test in this file.
   */
  it('finishes the roll when the last die outstanding is dropped, not typed', () => {
    /*
     * ADV armed, both faces typed, the d6 outstanding - then `—`. The roll no
     * longer contains an advantage die, so it is complete: HOPE 5 + FEAR 8 +
     * the modifier the bar declares. Observed before this landed: TOTAL `—`,
     * no log entry, and the bar back on its idle prompt over two typed faces.
     */
    mount(TYPED);
    click(byText('ADV'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(strip(), 'the advantage die is what it is waiting for').toContain(
      'STILL TO TYPE: ADV',
    );
    expect(total()).toBe('—');

    click(byText('—'));
    expect(total(), 'the roll had every face it needed and was left with no total').toBe(
      String(5 + 8 + modifier()),
    );
    expect(strip(), 'the bar was still asking for dice that had been typed').not.toContain(
      'STILL TO TYPE',
    );
    expect(
      useApp.getState().log.map((e) => e.detail),
      'a roll resolved onto the glass without reaching the log',
    ).toEqual([`5 / 8 ${modSign()} = ${String(5 + 8 + modifier())}`]);
  });

  it('finishes the roll when the die it was waiting for is disarmed', () => {
    mount(TYPED, [6]);
    click(byLabelStart('d6 held die'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(strip()).toContain('STILL TO TYPE: +D6');
    expect(total()).toBe('—');

    click(byLabelStart('d6 held die'));
    expect(total(), 'disarming the last outstanding die stranded a complete roll').toBe(
      String(5 + 8 + modifier()),
    );
    expect(slot('bonus'), 'a die nobody rolled kept a slot in the record').toBeNull();
  });

  it('finishes the roll when the die it was waiting for is discarded', () => {
    /*
     * The same change to what the roll requires, arriving from the tray rather
     * than from the slot row: press and hold takes the die out of `held`, which
     * is one of the two lists `armedHeld` is derived from. `HOLD_MS` is 480.
     */
    vi.useFakeTimers();
    try {
      mount(TYPED, [6]);
      const chip = byLabelStart('d6 held die');
      click(chip);
      typeFace('HOPE', 5);
      typeFace('FEAR', 8);
      expect(strip()).toContain('STILL TO TYPE: +D6');

      act(() => {
        chip.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(
        buttons().filter((b) => (b.getAttribute('aria-label') ?? '').includes('held die')),
        'the hold did not discard the die',
      ).toHaveLength(0);
      expect(total(), 'discarding the last outstanding die stranded a complete roll').toBe(
        String(5 + 8 + modifier()),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  /*
   * AND THE INVARIANT THE THREE OF THEM SHARE, WHICH IS THE ONE THIS SURFACE IS
   * READ BY: `result` is non-null exactly when `manual.resolved` is.
   *
   * `resolve` cleared nothing about `result`, so a panel that went back to
   * being open kept the previous roll's total standing in the largest type on
   * the screen - 46px here, 30px on the phone - beside a row of dice it was not
   * made of. Worst case is both switches on: the app rolls, you type your own
   * two faces, and the glass reads your HOPE, your FEAR, an advantage die
   * marked `not entered` and a TOTAL containing none of them, under the words
   * ROLLED WITH HOPE and its wash.
   *
   * Observable as: a total is on the glass only while the row beside it is a
   * spent record, and a row with any slot still open has no total beside it.
   */
  it('takes the total off the glass with the row that made it', () => {
    mount(BOTH, [6]);
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    click(rollButton()!);
    const app = total();
    expect(app, 'the app rolled nothing to go stale').not.toBe('—');
    expect(slot('advantage')?.disabled, 'the row beside a total is not a record').toBe(true);
    expect(slot('bonus')?.disabled).toBe(true);

    typeFace('HOPE', 5);
    expect(
      total(),
      'the app’s total was still on the glass beside the table’s own first die',
    ).toBe('—');
    typeFace('FEAR', 8);
    expect(total()).toBe('—');
    expect(slot('advantage')?.disabled, 'the open row was still marked spent').toBe(false);
    expect(strip()).toContain('STILL TO TYPE: ADV');

    typeExtra('advantage', 3);
    expect(total(), 'the typed roll is not the sum of its own faces').toBe(
      String(5 + 8 + 3 + modifier()),
    );
    expect(slot('advantage')?.disabled).toBe(true);
  });

  it('has no state that shows a verdict and an outstanding die at once', () => {
    /*
     * The corollary, and the reason `rollLine`'s docblock no longer argues that
     * `stillToType` has to beat a standing verdict. `stillToType` is drawn only
     * when a die is outstanding, which means `manual.resolved` is null, which
     * now means `result` is null too - so the two cannot be on the bar together
     * and the `??` wins over the idle arithmetic and the declaration only.
     *
     * Driven rather than argued: every state below is one the panel can be put
     * into with a verdict standing a moment earlier.
     */
    mount(BOTH, [6]);
    const verdictAndOutstanding = (): boolean =>
      !strip().startsWith('READY') && strip().includes('STILL TO TYPE');

    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    click(rollButton()!);
    expect(strip(), 'the app roll left no verdict to contradict').not.toContain('READY');
    expect(verdictAndOutstanding()).toBe(false);

    // Typing over the record, arming a die over it, and changing the sign over
    // it: the three ways back into an open roll.
    typeFace('HOPE', 5);
    expect(verdictAndOutstanding()).toBe(false);
    click(byLabelStart('d6 held die'));
    expect(verdictAndOutstanding()).toBe(false);
    click(byText('DIS'));
    expect(verdictAndOutstanding()).toBe(false);
  });

  it('shuts an open extra keypad when the app rolls', () => {
    /*
     * `ExtraSlot`'s `done` says a spent slot "is the record of it rather than a
     * way into it ... and it does not open: a keypad here would be an offer to
     * edit one die of a finished roll". The slot went `disabled` on ROLL and
     * the grid did not, because the grid is drawn from `typing` - so the offer
     * stood over a row that had just frozen, and pressing a key in it ran
     * `setDie` over a resolved panel: the face landed on a die no longer armed,
     * no slot came back for it, and the record of the roll that had just been
     * made was wiped off the glass.
     */
    mount(BOTH, [6]);
    click(byText('ADV'));
    click(byLabelStart('d6 held die'));
    click(slot('bonus')!);
    expect(
      container.querySelector('div[role="group"]'),
      'the slot stopped opening a keypad at all',
    ).not.toBeNull();

    click(rollButton()!);
    expect(
      container.querySelector('div[role="group"]'),
      'a finished roll was still offering one of its dice for editing',
    ).toBeNull();
    expect(slot('bonus')?.disabled).toBe(true);
  });

  /*
   * THE LOG LINE IS A SUM WITH AN `=` ON THE END OF IT, AND A TABLE THAT READS
   * IT AT ALL READS IT BY DOING THAT SUM.
   *
   * So the standard is not "does it name the interesting dice" but "does it
   * close". It did not: the advantage/disadvantage die was never in `parts`
   * while `rollDuality` puts `advantageDie * advantageSign` into the total, so
   * a typed 5/8 with +1 and an ADV 3 printed `5 / 8 +1 = 17` against named
   * addends summing to 14, and with a DIS 6 it printed `5 / 8 +1 = 8`, wrong by
   * 6 on its own face - under a comment claiming a table "can see every number
   * that went into the total".
   *
   * `addendsClose` sums the line rather than matching it, so this pins the
   * property and not one string. `(−1 Hope)` is deliberately not an addend and
   * the parse excludes it by the bracket it is inside.
   */
  const detail = (): string => {
    const entries = useApp.getState().log;
    return entries[0]?.detail ?? '';
  };
  /** The named addends of a log line, summed, and the total it claims. */
  const addendsClose = (line: string): { sum: number; claimed: number } => {
    const [left, right] = line.split(' = ');
    const pair = /^(\d+) \/ (\d+)/.exec(left ?? '');
    if (pair === null) throw new Error(`no Hope/Fear pair in "${line}"`);
    let sum = Number(pair[1]) + Number(pair[2]);
    for (const m of (left ?? '').matchAll(/(?<=^|\s)([+−])(\d+)(?=\s|$)/g)) {
      sum += (m[1] === '+' ? 1 : -1) * Number(m[2]);
    }
    return { sum, claimed: Number(/^\d+/.exec(right ?? '')?.[0]) };
  };

  it('prints a log line whose own named addends add up to its total', () => {
    mount(TYPED, [8]);
    click(byText('ADV'));
    click(byLabelStart('d8 held die'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    typeExtra('bonus', 4);
    typeExtra('advantage', 3);
    expect(total()).toBe(String(5 + 8 + 4 + 3 + modifier()));
    expect(detail(), 'the advantage die is not named in the line it is inside').toContain(
      '(ADV d6)',
    );
    const { sum, claimed } = addendsClose(detail());
    expect(sum, `the log line does not add up: ${detail()}`).toBe(claimed);
    expect(claimed).toBe(5 + 8 + 4 + 3 + modifier());
  });

  it('subtracts the disadvantage die in the line as well as in the total', () => {
    mount(TYPED);
    click(byText('DIS'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    typeExtra('advantage', 6);
    expect(total()).toBe(String(5 + 8 - 6 + modifier()));
    expect(detail()).toContain('(DIS d6)');
    const { sum, claimed } = addendsClose(detail());
    expect(sum, `the log line does not add up: ${detail()}`).toBe(claimed);
    expect(claimed).toBe(5 + 8 - 6 + modifier());
  });

  it('signs an Experience that takes points off, rather than printing +−2', () => {
    /*
     * The second half of the same rule, found by asking what the line does with
     * every other addend. An Experience carries whatever modifier was typed into
     * it - `armSummary` signs it, so the surface already admits negative ones -
     * and `+${bonus} exp` printed `+-2 exp`.
     */
    mount(
      TYPED,
      [],
      'desktop',
      { experiences: [{ id: 'exp-1', name: 'Owes the wrong people', bonus: -2 }] },
      ['exp-1'],
    );
    typeFace('HOPE', 5);
    typeFace('FEAR', 8);
    expect(detail(), 'a negative Experience printed its sign twice').not.toContain('+−2');
    expect(detail()).toContain('−2 exp');
    const { sum, claimed } = addendsClose(detail());
    expect(sum, `the log line does not add up: ${detail()}`).toBe(claimed);
    expect(claimed).toBe(5 + 8 - 2 + modifier());
  });


  it('costs the phone column 50px for one row of slots, and 100 at its worst', () => {
    /*
     * THE BAND `playSheet.test.tsx` CANNOT SEE, COUNTED WHERE ITS PARTS ARE
     * DECLARED. That file's budget sums the phone column with nothing armed and
     * typing off, and lists what it therefore cannot see; this row is a new
     * permanent band above ROLL in a state it lists, so the bullet is arithmetic
     * over these four declarations rather than a number somebody wrote down.
     *
     * `MAX_HELD` is 12 and the advantage die makes thirteen, which is the most
     * this row can ever hold. It wraps rather than shrinking - a slot is
     * `1 1 44px` - so the worst case is two rows at both reference widths.
     */
    mount(TYPED, [], 'phone');
    click(byLabelStart('Modifiers for this roll'));
    click(byText('ADV'));
    const box = slot('advantage')!;
    const row = box.parentElement!;
    const wrapper = row.parentElement!;
    const column = wrapper.parentElement!;
    expect(box.style.minHeight, 'a slot went under the touch floor').toBe('var(--tap)');
    expect(box.style.flex, 'a slot shrinks past its floor instead of wrapping').toBe('1 1 44px');
    expect(row.style.flexWrap).toBe('wrap');
    expect(row.style.gap, 'the gap between two wrapped rows of slots').toBe('6px');
    expect(column.style.gap, 'the gap this band pays into the phone column').toBe('6px');

    // `--tap` is 44 everywhere a finger might land; `tokens.css` declares it.
    const TAP = 44;
    const GAP = 6;
    expect(TAP + GAP, 'one row of slots above ROLL').toBe(50);
    /*
     * How many fit on one line: `n` slots at their 44px basis with `n - 1` gaps
     * is `50n - 6`, against 369px of column at 393 and 351 at 375 - which is
     * `the width this sheet is laid out for`'s `glass - 24`. Seven at either,
     * so the eighth wraps, which is what `ExtraSlot`'s `8 * 44 + 7 * 6 = 394 is
     * over the 369 that column has` says.
     */
    const fit = (col: number): number => Math.floor((col + GAP) / (TAP + GAP));
    expect([fit(369), fit(351)], 'the row stopped wrapping at the eighth slot').toEqual([7, 7]);
    expect(8 * TAP + 7 * GAP, 'the eight that do not fit').toBe(394);
    const most = 1 + MAX_HELD;
    expect(most).toBe(13);
    const rows = (col: number): number => Math.ceil(most / fit(col));
    expect([rows(369), rows(351)]).toEqual([2, 2]);
    expect(
      rows(351) * TAP + (rows(351) - 1) * GAP + GAP,
      'the worst case this band can cost the column above ROLL',
    ).toBe(100);
    // And it fits under the 221px of margin that budget asserts for 375x667,
    // together with the two bullets it cannot be armed without: 68 + 50 + 100.
    expect(68 + 50 + 100).toBeLessThan(221);
  });

  it('says what the phone bar is waiting for, in the phone bar', () => {
    /*
     * B2. `stillToType` takes the second line in BOTH branches and only the
     * cockpit's was pinned - every case above reads `.spread`, which the phone
     * does not draw. Deleting `stillToType ??` from `rollLine` left 135 files
     * and 3324 tests green. This case renders the phone and reads the line
     * `rollLine` feeds: the 0.75rem/1.25 span inside ROLL (12px/15px at the
     * 16px root).
     */
    mount(TYPED, [], 'phone');
    const line = (): string =>
      container.querySelector('span[style*="line-height: 1.25"]')?.textContent ?? '';
    expect(line(), 'the idle bar is already saying it').not.toContain('STILL TO TYPE');

    typeFace('HOPE', 5);
    expect(
      line(),
      'the phone bar never says which die the roll is waiting for',
    ).toContain('STILL TO TYPE: FEAR');
  });
});

/**
 * WHAT A CHANGE TO THE DECLARATION DOES TO THE ROLL ALREADY ON THE GLASS - IN
 * EACH OF THE FOUR CONFIGURATIONS SETTINGS OFFERS, RATHER THAN IN THE TWO
 * SOMEBODY TYPES IN.
 *
 * Round 3 bought the rule that a stale total never stands beside a fresh row,
 * by clearing `result` in `redeclare`. Every case it was driven in had typing
 * ON - `TYPED` or `BOTH` above - and the fix was written on an invariant with
 * no configuration in it, so it applied where nobody types as well.
 *
 * At `{digitalDice: true, manualDice: false}`, which is the default install:
 * ROLL, then arm ADV or a held die for the NEXT roll, and the verdict word, the
 * outcome line, the two raw faces and the total all left the screen at the
 * touch of a control that made no roll. On a phone that bar is the only record
 * of the roll anywhere - no log surface, and with typing off no face row -
 * so arming a die for the next roll erased the last one.
 *
 * The rule and the regression are both real, so the invariant has two clauses
 * and each names the configurations it governs. `result` is non-null exactly
 * when `manual.resolved` is, in all four; WHICH EVENTS may make them null again
 * is `canType`'s answer, and only `canType`'s.
 */
describe('the roll after the roll, in every configuration', () => {
  const COMBOS = [
    // The default install, and the one the regression lives in.
    { digitalDice: true, manualDice: false },
    { digitalDice: true, manualDice: true },
    { digitalDice: false, manualDice: true },
    // Reachable in two taps from either of the above, and it keeps a roll made
    // before the switches went off.
    { digitalDice: false, manualDice: false },
  ] as const;
  const name = (p: (typeof COMBOS)[number]): string =>
    `roller ${p.digitalDice ? 'on' : 'off'}, typing ${p.manualDice ? 'on' : 'off'}`;

  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  const byText = (word: string): HTMLButtonElement => {
    const found = buttons().find((b) => (b.textContent ?? '').trim() === word);
    if (found === undefined) throw new Error(`no control reading "${word}"`);
    return found;
  };
  const byLabelStart = (prefix: string): HTMLButtonElement => {
    const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(prefix));
    if (found === undefined) throw new Error(`no control named "${prefix}..."`);
    return found;
  };
  /** The 132px trait box: the trait's own name, then the 46px total under it. */
  const box = (): HTMLElement | null =>
    container.querySelector<HTMLElement>('div[style*="width: 132px"]');
  const total = (): string => {
    const spans = [...(box()?.querySelectorAll<HTMLElement>('span') ?? [])];
    return spans[spans.length - 1]?.textContent?.trim() ?? '';
  };
  /** The trait printed directly above that total - the name of an addend. */
  const traitShown = (): string => box()?.querySelector('span')?.textContent?.trim() ?? '';
  /** The verdict word alone, without the line beside it. */
  const word = (): string =>
    (container.querySelector('.spread span')?.textContent ?? '').trim().toUpperCase();
  const strip = (): string =>
    (container.querySelector('.spread')?.textContent ?? '').toUpperCase();
  /** A face's whole accessible name, which carries the number it is showing. */
  const face = (which: 'HOPE' | 'FEAR'): string =>
    byLabelStart(`${which} die`).getAttribute('aria-label') ?? '';
  /**
   * That number, or null for the em dash. Read out of the name rather than off
   * the 46px span, because with typing on the name carries an invitation to tap
   * after it and a test that anchored on the digits saw only the readout.
   */
  const faceValue = (which: 'HOPE' | 'FEAR'): number | null => {
    const found = /die: (\d+)/.exec(face(which));
    return found === null ? null : Number(found[1]);
  };
  const modifier = (): number => {
    const found = /2d12 ([+−])(\d+)/.exec(container.textContent ?? '');
    if (found === null) throw new Error('the bar stopped declaring its own modifier');
    return (found[1] === '+' ? 1 : -1) * Number(found[2]);
  };

  /** A parent that owns the trait, which is where `Play` owns it. */
  function Harness(): ReactElement {
    const character = useApp.getState().characters[0]!;
    const [trait, setTrait] = useState<RollTrait>('agility');
    return createElement(DualityRoll, {
      stats: playedStats(character),
      trait,
      onTraitChange: setTrait,
      source: null,
      layout: 'desktop',
      armedExperiences: [],
      onArmedExperiencesChange: () => undefined,
    });
  }

  function mountAt(prefs: Partial<typeof DEFAULT_PREFS>, sides: number[] = []): void {
    const character = seed();
    act(() => useHeldDice.setState({ byCharacter: {} }));
    for (const n of sides) {
      act(() => useHeldDice.getState().add(character.id, n as (typeof DIE_SIZES)[number]));
    }
    useApp.setState({ prefs: { ...DEFAULT_PREFS, ...prefs } });
    render(createElement(Harness));
  }

  const typeFace = (which: 'HOPE' | 'FEAR', value: number): void => {
    click(byLabelStart(`${which} die`));
    const grid = container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]')!;
    click([...grid.querySelectorAll('button')][value - 1]!);
  };

  /**
   * Put a roll on the glass under `prefs`, however that configuration makes
   * one - and for the configuration that cannot make one at all, however it
   * arrives there. With both switches off nothing on this surface rolls or
   * types, but Settings is two taps from either switch, so a sheet in that
   * state holding the last roll it made is ordinary rather than exotic.
   */
  function mountUnder(prefs: (typeof COMBOS)[number], sides: number[] = []): void {
    mountAt(
      prefs.digitalDice || prefs.manualDice ? prefs : { digitalDice: true, manualDice: false },
      sides,
    );
  }
  function makeRoll(prefs: (typeof COMBOS)[number]): void {
    if (prefs.digitalDice) {
      click(rollButton()!);
      return;
    }
    if (prefs.manualDice) {
      typeFace('HOPE', 5);
      typeFace('FEAR', 8);
      return;
    }
    click(rollButton()!);
    act(() => useApp.setState({ prefs: { ...DEFAULT_PREFS, ...prefs } }));
  }
  function rollUnder(prefs: (typeof COMBOS)[number], sides: number[] = []): void {
    mountUnder(prefs, sides);
    makeRoll(prefs);
  }

  for (const prefs of COMBOS) {
    it(`${name(prefs)}: arming a die for the next roll ${
      prefs.manualDice ? 'reopens this one' : 'leaves this one on the glass'
    }`, () => {
      rollUnder(prefs, [6]);
      const made = { total: total(), word: word(), hope: face('HOPE'), fear: face('FEAR') };
      expect(made.total, 'nothing was rolled to be kept or lost').not.toBe('—');
      expect(faceValue('HOPE'), 'the roll left no face on the glass').not.toBeNull();

      // The declaration for the NEXT roll: the sign, and then a held die.
      click(byText('ADV'));
      if (prefs.manualDice) {
        /*
         * The round-3 clause. The faces are inputs here, so the panel has gone
         * back to being an open roll and a total made of a row that is no
         * longer on the screen would be the defect that clause exists for.
         */
        expect(total(), 'a stale total stood beside a reopened roll').toBe('—');
        expect(faceValue('HOPE'), 'a face of the old roll stayed in an input').toBeNull();
      } else {
        /*
         * The regression. Nothing here types anything, so there is no
         * half-assembled roll for this total to be inconsistent with - and with
         * the roller on and typing off this readout is the whole record of the
         * roll. Arming ADV is a statement about the next roll, which the bar
         * already labels `NEXT:`.
         */
        expect(total(), 'arming a die for the next roll erased the last one').toBe(made.total);
        expect(word(), 'the verdict went with a control that made no roll').toBe(made.word);
        expect(face('HOPE')).toBe(made.hope);
        expect(face('FEAR')).toBe(made.fear);
      }

      click(byLabelStart('d6 held die'));
      if (prefs.manualDice) expect(total()).toBe('—');
      else expect(total()).toBe(made.total);
    });

    it(`${name(prefs)}: the trait the total was made with stays on the box`, () => {
      /*
       * The trait modifier is an addend of the total - `rollDuality` adds
       * `modifier.value` - and the cockpit prints its NAME on the line directly
       * above the 46px total, in the same 132px box. Frozen row, live label: the
       * box read `AGILITY / 10` for a 10 that a different trait produced, and
       * HOPE + FEAR + the modifier the bar was declaring no longer came to the
       * number between them.
       *
       * SPELLCAST is the one trait control this component owns, so the gesture
       * is inside the surface under test rather than mimed by a prop.
       */
      mountUnder(prefs);
      /*
       * Read BEFORE the roll: the idle box names the trait about to be rolled,
       * and that is the label the total has to keep. Reading it afterwards
       * proves nothing - a freeze that captured the empty string would agree
       * with itself, and did: that mutant lived through the first version of
       * this case.
       */
      const declared = traitShown();
      expect(declared, 'the idle box stopped naming the trait it is about to roll').not.toBe('');

      makeRoll(prefs);
      const made = { total: total(), trait: traitShown(), modifier: modifier() };
      expect(made.total).not.toBe('—');
      expect(made.trait, 'the roll froze something other than the trait it was made with').toBe(
        declared,
      );
      const hope = faceValue('HOPE')!;
      const fear = faceValue('FEAR')!;
      expect(hope + fear + made.modifier, 'the panel did not add up before the change').toBe(
        Number(made.total),
      );

      click(byText('SPELLCAST'));
      expect(
        modifier(),
        'the fixture stopped changing the modifier, so this case proves nothing',
      ).not.toBe(made.modifier);
      expect(traitShown(), 'the box relabelled a total the new trait did not make').toBe(
        made.trait,
      );
      expect(total(), 'the total moved with a trait it was not made from').toBe(made.total);
      expect(
        hope + fear + made.modifier,
        'the three figures the panel shows at once stopped adding up',
      ).toBe(Number(total()));
    });
  }

  it('follows the trait while there is no total to be wrong about', () => {
    /*
     * The other half of the freeze, and it is on the same expression. With no
     * roll on the glass the box is a statement about the roll being declared,
     * so it has to follow the trait picker - a box frozen in both directions
     * would name a trait nobody is rolling. The freeze applies exactly when
     * there is a total for a live label to contradict.
     */
    mountAt({ digitalDice: true, manualDice: false });
    expect(total(), 'something was already on the glass').toBe('—');
    const before = traitShown();
    click(byText('SPELLCAST'));
    expect(traitShown(), 'the box stopped naming the trait it is about to roll').not.toBe(
      before,
    );
  });

  it('the phone bar keeps the whole roll where nobody types', () => {
    /*
     * The reported state, on the layout it costs the most: at 393x852 with the
     * roller on and typing off the ROLL bar is the only record of the roll
     * anywhere on the sheet. There is no log surface on a phone and no face row
     * with typing off, so the word, the two raw dice, the outcome line and the
     * 30px total are all it has.
     */
    const character = seed();
    act(() => useHeldDice.setState({ byCharacter: {} }));
    act(() => useHeldDice.getState().add(character.id, 6));
    useApp.setState({ prefs: { ...DEFAULT_PREFS, digitalDice: true, manualDice: false } });
    render(
      createElement(DualityRoll, {
        stats: playedStats(character),
        trait: 'agility',
        onTraitChange: () => undefined,
        source: null,
        layout: 'phone',
        armedExperiences: [],
        onArmedExperiencesChange: () => undefined,
      }),
    );
    const bar = (): HTMLButtonElement =>
      buttons().find((b) => b.style.minHeight === '56px')!;
    click(bar());
    const rolled = bar().textContent ?? '';
    expect(rolled, 'the phone bar reported no roll to keep').toMatch(/Rolled with (Hope|Fear)|Critical/);
    expect(rolled).toMatch(/\d+ \/ \d+ · /);

    click(byText('MODS'));
    click(byText('ADV'));
    expect(bar().textContent, 'the only record of the roll left with the ARMED tap').toBe(
      rolled,
    );
  });

  it('draws the longest instruction line the surface can be made to draw', () => {
    /*
     * `rollLine`'s docblock derives the bar's height from this line's worst
     * case, and the worst case it derived - fifteen items at 116 characters -
     * is a state the code cannot reach. `untyped` can hold fifteen; the LINE is
     * `started ? stillToTypeLine(untyped) : null`, and `started` needs a face
     * ENTERED, so one of the fifteen is always filled and the line names at
     * most fourteen. That is R-D's own failure mode - arguing from a state the
     * code cannot reach - in the paragraph written to replace one that had it.
     *
     * Driven rather than counted: twelve d12 in the tray, ADV armed, all twelve
     * armed, and then the ADVANTAGE die typed - the one gesture that turns
     * `started` on while giving up the shortest label of the fifteen.
     */
    mountAt({ digitalDice: false, manualDice: true }, Array.from({ length: MAX_HELD }, () => 12));
    click(byText('ADV'));
    for (const chip of buttons().filter((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('d12 held die'),
    )) {
      click(chip);
    }
    expect(
      container.querySelectorAll('button[data-die]'),
      'the row stopped offering a slot per armed die',
    ).toHaveLength(1 + MAX_HELD);

    click(container.querySelector('button[data-die="advantage"]')!);
    const grid = container.querySelector<HTMLElement>('div[role="group"]')!;
    click([...grid.querySelectorAll('button')][2]!);

    const line = strip().slice(word().length);
    expect(line.startsWith('STILL TO TYPE: '), strip()).toBe(true);
    expect(line, 'the line named a die that had just been typed').not.toContain('ADV');
    expect(line, 'the worst case the bar can actually be made to draw').toHaveLength(110);
  });
});
