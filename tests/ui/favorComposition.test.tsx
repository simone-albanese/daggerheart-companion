// @vitest-environment jsdom
/**
 * The three Favor surfaces on ONE sheet, which is a case no branch could mount.
 *
 * Three lanes built the Favor feature in three worktrees: the row under Vitals
 * that draws the track, the offer on the Duality Roll that adds to it, and the
 * Patron Die on the Play sheet that spends it. Each was green on its own branch
 * and each measured a screen the other two were not on. This file is the only
 * place where the sheet the book actually describes exists - a level-5 Warlock
 * who multiclassed into Brawler and took Martial Artist, so that two tracks,
 * the priced die and the offer are all live at once.
 *
 * Two things it is here to hold, and both are properties of the COMPOSITION and
 * of nothing that was merged into it:
 *
 *  1. ONE QUESTION ABOUT WHO. `drawsFavor` is asked by the row and by the
 *     offer. It arrived twice - the branches wrote `drawsFavor` and
 *     `holdsFavor`, the same two-class `some(grantsFavor)` under two names,
 *     differing only in whether a sheet already holding Favor counted - and git
 *     merged their bodies into one function while conflicting on the docblock,
 *     which is the only reason anybody looked. The stranger case below is what
 *     keeps them from drifting apart again: it is the one input the two names
 *     disagreed on, so a screen that goes back to asking its own question
 *     reddens here rather than silently refusing a sheet the other screen draws.
 *
 *  2. ONE COUNTER, THREE DOORS. `favor.marked` is written by three components
 *     through three `useApp.update` calls, each with its own clamp. Nothing on
 *     any branch could drive more than one of them, so nothing proved they
 *     agree. The walk below spends and gains through all three in sequence
 *     against a single store and reads the count back after each.
 *
 * The ceiling is asserted against `MAX_FAVOR` and never against a literal six,
 * so that moving the constant moves the readout, the refusal and the pool cap
 * together or fails here.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_FAVOR, MAX_FOCUS, type Character } from '../../shared/types.ts';
import { STANCE_SUBCLASS, deriveStats, drawsFavor, drawsFocus } from '../../src/engine/character.ts';
import { POOL_REGISTER, poolsFor } from '../../src/engine/dicePools.ts';
import { rollDuality, type DualityResult } from '../../src/engine/dice.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { ClassTracks } from '../../src/ui/player/ClassTracks.tsx';
import { DicePools } from '../../src/ui/player/DicePools.tsx';
import { FavorRow } from '../../src/ui/player/FavorRow.tsx';
import { useHeldDice } from '../../src/ui/player/heldDice.ts';
import { usePools } from '../../src/ui/player/poolStore.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** A success with Hope at difficulty 5, which is what opens the offer. */
const SUCCESS_HOPE: DualityResult = rollDuality({
  modifier: 0,
  difficulty: 5,
  fixed: { hope: 10, fear: 3 },
});

/**
 * The sheet the brief calls the true worst case.
 *
 * Level 5 for the Patron Die's d8; `warlock` for Favor and `Patron's Pact`;
 * `brawler` in the multiclass slot with `STANCE_SUBCLASS` pushed onto
 * `subclassRefs`, which is what `applyLevelUp`'s `multiclass` case does and
 * what `drawsFocus` reads. Three Favor and two Focus so that every stepper on
 * the row is armed in both directions at the start of a walk.
 */
const worstCase = (patch: Partial<Character> = {}): Character => {
  const warlockSub = dataset.subclasses.find((s) => s.classRef === 'warlock')!;
  return {
    ...playedCharacter(),
    classRef: 'warlock',
    multiclassRef: 'brawler',
    subclassRefs: [warlockSub.id, STANCE_SUBCLASS],
    level: 5,
    favor: { marked: 3, max: MAX_FAVOR },
    focus: { marked: 2, max: MAX_FOCUS },
    ...patch,
  };
};

let container: HTMLDivElement;
let root: Root;

const seed = (character: Character): Character => {
  // Inside `act` because a test below seeds a SECOND sheet while the first is
  // still mounted - swapping the character under all three surfaces at once is
  // the point of it - and a bare `setState` there is an update React warns
  // about rather than one it flushes.
  act(() => {
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
  });
  return character;
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => usePools.setState({ byCharacter: {} }));
  act(() => useHeldDice.setState({ byCharacter: {} }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};
const text = (): string => container.textContent ?? '';
const sheet = (): Character => useApp.getState().characters[0]!;
const byLabel = (needle: string): HTMLButtonElement => {
  const hit = [...container.querySelectorAll('button')].filter((b) =>
    (b.getAttribute('aria-label') ?? '').includes(needle),
  );
  expect(hit.length, `one button whose label contains ${JSON.stringify(needle)}`).toBe(1);
  return hit[0]!;
};
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** All three surfaces, mounted the way the Play screen mounts them. */
const wholeSheet = (character: Character, result: DualityResult | null): void => {
  seed(character);
  const stats = deriveStats(character, dataset, index);
  render(
    createElement(
      'div',
      null,
      createElement(ClassTracks),
      createElement(FavorRow, { result, hopeGained: 1, layout: 'phone' }),
      createElement(DicePools, { stats }),
    ),
  );
};

describe('a level-5 Warlock who is also a Martial Artist, with everything live at once', () => {
  it('draws both tracks, prices the die at a d8 and offers the trade, off one sheet', () => {
    const c = worstCase();
    // The engine's three answers, before anything is drawn.
    expect(drawsFocus(c), 'the Martial Artist arm, through the multiclass').toBe(true);
    expect(drawsFavor(c, index), 'the Warlock arm, through the class').toBe(true);
    const pools = poolsFor(c, index, deriveStats(c, dataset, index));
    const patron = pools.find((p) => p.id === 'patron');
    expect(
      [patron?.sides, patron?.cost],
      'a d8 at level 5, and the only pool in the book with a price',
    ).toEqual([8, 'favor']);

    wholeSheet(c, SUCCESS_HOPE);
    const screen = text();
    // Both tracks on the row, the offer on the roll, the priced control below.
    for (const needle of ['FOCUS', 'FAVOR', 'TAKE A FAVOR', 'Spend a Favor']) {
      expect(screen, `the composed screen shows ${needle}`).toContain(needle);
    }
    // And the die the control sells is the one the engine priced, not a d6.
    expect(byLabel('call on your patron').getAttribute('aria-label')).toContain('take a d8');
  });

  it('asks ONE question about who, so the row and the offer never disagree', () => {
    /*
     * The single input the two merged predicates answered differently: a sheet
     * carrying Favor under a class this build cannot name - an import from a
     * layer that is not installed, which `normalizeIncoming` exists for. The
     * row drew it; the strict predicate would have refused the offer on it, so
     * the player would have been shown a track and then denied the only gesture
     * that fills it. Both surfaces answer the same way here or this reddens.
     */
    const stranger = worstCase({
      classRef: 'from-a-later-book',
      multiclassRef: null,
      subclassRefs: [],
      favor: { marked: 2, max: MAX_FAVOR },
    });
    expect(drawsFavor(stranger, index)).toBe(true);
    wholeSheet(stranger, SUCCESS_HOPE);
    expect(text(), 'the row draws the track it is holding').toContain('FAVOR');
    expect(text(), 'and the roll offers to add to it').toContain('TAKE A FAVOR');

    // The other half of the same question: a sheet with neither entitlement nor
    // a mark gets neither surface, so the agreement above is not "yes to all".
    const bard = worstCase({
      classRef: 'bard',
      multiclassRef: null,
      subclassRefs: [],
      favor: { marked: 0, max: MAX_FAVOR },
      focus: { marked: 0, max: MAX_FOCUS },
    });
    expect(drawsFavor(bard, index)).toBe(false);
    wholeSheet(bard, SUCCESS_HOPE);
    expect(text()).not.toContain('FAVOR');
    expect(text()).not.toContain('TAKE A FAVOR');
  });

  it('reads ONE ceiling, and it is MAX_FAVOR rather than a six written three times', () => {
    // The row's readout, the offer's refusal and the pool's cap, all derived
    // from the constant so that moving it moves all three or fails here.
    const full = worstCase({ favor: { marked: MAX_FAVOR, max: MAX_FAVOR } });
    wholeSheet(full, SUCCESS_HOPE);
    expect(text(), 'the row prints n of max').toContain(`${String(MAX_FAVOR)}/${String(MAX_FAVOR)}`);
    expect(text(), 'the offer refuses at the ceiling').toContain(
      `FAVOR FULL · ${String(MAX_FAVOR)} OF ${String(MAX_FAVOR)}`,
    );
    expect(byLabel('FAVOR plus one').disabled, 'the seventh box is refused').toBe(true);

    const pools = poolsFor(full, index, deriveStats(full, dataset, index));
    expect(pools.find((p) => p.id === 'patron')?.cap).toBe(MAX_FAVOR);

    // The floor is the same story from the other end: at zero the row's minus
    // disarms and the Patron control shuts, and neither is a negative Favor.
    const empty = worstCase({ favor: { marked: 0, max: MAX_FAVOR } });
    wholeSheet(empty, SUCCESS_HOPE);
    expect(byLabel('FAVOR minus one').disabled).toBe(true);
    expect(byLabel('call on your patron').disabled).toBe(true);
  });

  it('moves ONE counter through three doors, and they agree on the number', () => {
    /*
     * The walk no branch could take. Each of these three gestures lives in a
     * different component, was written on a different branch, and calls
     * `useApp.update` on `favor.marked` with a clamp of its own.
     */
    const c = worstCase();
    wholeSheet(c, SUCCESS_HOPE);
    expect(sheet().favor.marked, 'the sheet as it starts').toBe(3);

    click(byLabel('TAKE A FAVOR'));
    expect(sheet().favor.marked, 'door 1: the offer on the roll adds one').toBe(4);
    expect(sheet().hope.marked, 'and the Hope it replaced went back').toBe(3);

    click(byLabel('FAVOR minus one'));
    expect(sheet().favor.marked, 'door 2: the row under Vitals spends one').toBe(3);

    click(byLabel('call on your patron'));
    expect(sheet().favor.marked, 'door 3: the Patron Die is bought with one').toBe(2);

    // The die really arrived in the tray, so the Favor bought something.
    expect(useHeldDice.getState().byCharacter[c.id]?.map((d) => d.sides)).toEqual([8]);
    // And the OTHER track never moved: three writers on one field, and none of
    // them is writing the neighbouring one.
    expect(sheet().focus.marked, 'Focus is untouched by any of the three').toBe(2);
  });
});

describe('the tray chip that lists what can be held', () => {
  it('names every pool the register ships, so a fifth one cannot go unlisted', () => {
    /*
     * `DualityRoll`'s `+ DIE` chip carries a `title` listing what may be held.
     * It read "A Rally, Prayer or Slayer Die, or the d6 from Help an Ally" while
     * a fourth pool was being registered on another branch - the branch that
     * added the Patron Die was forbidden this file, and the branch that owned
     * this file did not know the pool existed. Neither could see it; the
     * composition can. Derived from `POOL_REGISTER` rather than from a list
     * written here, so registering a fifth pool reddens this instead of quietly
     * shipping a fourth incomplete sentence.
     */
    const source = readFileSync('src/ui/player/DualityRoll.tsx', 'utf8');
    const title = /title="(A [^"]*Die[^"]*)"/.exec(source)?.[1];
    expect(title, 'the + DIE chip still carries a title listing the pools').toBeTypeOf('string');
    for (const spec of Object.values(POOL_REGISTER.pools)) {
      const word = spec.name.split(' ')[0]!;
      expect(title, `${spec.name} is named in the chip's title`).toContain(word);
    }
  });
});
