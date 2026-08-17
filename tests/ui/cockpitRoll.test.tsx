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
import { DualityRoll, ExperienceRow } from '../../src/ui/player/DualityRoll.tsx';
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
  const LINE = 11.5 * 1.15; // the declared `600 11.5px/1.15 var(--mono)`
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

  it('costs the chip 5.7px, and only when the third line is used', () => {
    // Two lines sit inside the touch floor; three step past it by 5.7. That is
    // the whole price. `box-sizing: border-box` is what makes the padding part
    // of the 44 rather than on top of it - and the border with it, which is why
    // `BOX` is 10 and not 8. Measured 49.7 in Chrome on the cockpit chip at its
    // 124px `maxWidth`, and 44 on the chips whose names fit two lines.
    expect(2 * LINE + BOX).toBeCloseTo(36.45, 2);
    expect(2 * LINE + BOX).toBeLessThan(FLOOR);
    expect(3 * LINE + BOX).toBeCloseTo(49.675, 3);
    expect(3 * LINE + BOX - FLOOR).toBeCloseTo(5.675, 3);

    // And the terms of that arithmetic are still declared on the chip - the
    // border included, so the term cannot go missing again.
    const chip = panel().querySelector<HTMLElement>('button[aria-label^="Utilize "]');
    expect(chip).not.toBeNull();
    expect(chip!.style.font).toBe('600 11.5px/1.15 var(--mono)');
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

    click(exit!);
    expect(grid(), 'the cancel did not shut the keypad').toBeNull();
    // And nothing was written: the face is still empty.
    expect(face('HOPE').getAttribute('aria-label')).not.toContain(': ');
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

  it('writes the face it was opened on, and only when a key is pressed', () => {
    panel(typed);
    click(face('HOPE'));
    click([...grid()!.querySelectorAll('button')][6]!); // the seventh key: 7
    expect(grid(), 'committing a face left the keypad open').toBeNull();
    expect(face('HOPE').getAttribute('aria-label')).toContain(': 7');
    expect(face('FEAR').getAttribute('aria-label')).not.toContain(': ');
  });
});
