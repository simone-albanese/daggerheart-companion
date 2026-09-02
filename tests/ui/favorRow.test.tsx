// @vitest-environment jsdom
/**
 * A Favor instead of the Hope: the rule, the row, and the exchange.
 *
 * Five defect classes, and every one of them was reachable by a plausible
 * one-line implementation of this feature:
 *
 *   1. **The offer on a sheet that has no Favor.** A Bard offered a Warlock's
 *      class feature. The predicate is `drawsFavor`, asked of the dataset, so
 *      the fixtures here are the real Bard and the real Warlock rather than a
 *      `classRef` string.
 *   2. **The offer on the wrong roll.** `succeeded` has THREE values and the
 *      third is `null` - the engine returns it when the GM has not shared the
 *      Difficulty - so an `if (result.succeeded)` silently removes the feature
 *      from every table that keeps its Difficulties hidden, and an
 *      `if (result.withHope)` hands it out on failures and reaction rolls. Both
 *      are one character of sloppiness that looks like a decision.
 *   3. **The critical.** *"A Critical Success counts as a roll 'with Hope'"* -
 *      the SRD prints it as its own line - and this engine gives the outcome its
 *      own label, `critical`, not `success-hope`. A row that matched on the
 *      label would drop the best roll in the game. The results here are built by
 *      `rollDuality` from fixed faces rather than by hand, so the outcome, the
 *      three verdict fields and `effects.hope` are the engine's own and not this
 *      file's opinion of them.
 *   4. **Two things for one success.** `resolve` marks the Hope the instant a
 *      roll lands, so accepting has to take it back; a player holding both was
 *      paid twice. And its mirror, which is the one nothing else in this repo
 *      would have caught: the Hope is marked through `Math.min(c.hope.max, …)`,
 *      so at a full Hope track nothing arrived and nothing may be taken back.
 *   5. **Twice.** Two taps must not be two Favor.
 *
 * `tests/favor.test.tsx` owns the field, the two seeds, the ceiling and the
 * wire, and `drawsFavor` itself; none of that is restated here.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAVOR, type Character } from '../../shared/types.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { rollDuality, type DualityResult } from '../../src/engine/dice.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { DualityRoll } from '../../src/ui/player/DualityRoll.tsx';
import { FavorRow, favorOffer } from '../../src/ui/player/FavorRow.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// ---------------------------------------------------------------------------
// Rolls, made by the engine
// ---------------------------------------------------------------------------

/**
 * A real `DualityResult`, from fixed faces.
 *
 * Hand-built result objects are the reason class 3 above is a class: an object
 * literal with `critical: true` and `outcome: 'critical'` on it agrees with
 * whatever this file believes, and the question is what `rollDuality` believes.
 * Difficulty 5 against a pair summing to at least 8 is a success; 30 is a
 * failure; `null` is the GM not saying.
 */
const roll = (
  hope: number,
  fear: number,
  difficulty: number | null,
  extra: { reaction?: boolean } = {},
): DualityResult =>
  rollDuality({ modifier: 0, difficulty, fixed: { hope, fear }, ...extra });

const SUCCESS_HOPE = roll(10, 3, 5);
const FAILURE_HOPE = roll(5, 2, 30);
const SUCCESS_FEAR = roll(3, 10, 5);
const FAILURE_FEAR = roll(2, 5, 30);
const UNDECIDED_HOPE = roll(10, 3, null);
const UNDECIDED_FEAR = roll(3, 10, null);
const CRITICAL = roll(7, 7, 5);
const REACTION_HOPE = roll(10, 3, 5, { reaction: true });

const FULL = { marked: 6, max: MAX_FAVOR };
const SOME = { marked: 3, max: MAX_FAVOR };

describe('the fixtures are what they are named, according to the engine', () => {
  it('is the engine that says a critical succeeded with Hope, not this file', () => {
    /*
     * The dataset prints it twice over: *"Critical Success: … You automatically
     * succeed with a bonus, gain a Hope, and clear a Stress"* and then *"Note: A
     * Critical Success counts as a roll 'with Hope.'"* Both halves of *"succeed
     * on an action roll with Hope"* therefore hold, and `favorOffer` is entitled
     * to read them off the result. This is that entitlement, asserted.
     */
    expect(CRITICAL.outcome, 'a critical is NOT labelled success-hope').toBe('critical');
    expect([CRITICAL.succeeded, CRITICAL.withHope, CRITICAL.effects.hope]).toEqual([true, true, 1]);
    // The three others whose verdict the row turns on, so a change in the engine
    // fails here rather than silently changing what is offered.
    expect([SUCCESS_HOPE.succeeded, SUCCESS_HOPE.effects.hope]).toEqual([true, 1]);
    expect([FAILURE_HOPE.succeeded, FAILURE_HOPE.effects.hope]).toEqual([false, 1]);
    expect([UNDECIDED_HOPE.succeeded, UNDECIDED_HOPE.effects.hope]).toEqual([null, 1]);
    // And the three that grant no Hope at all, which is the row's whole gate.
    for (const [name, r] of [
      ['success with Fear', SUCCESS_FEAR],
      ['failure with Fear', FAILURE_FEAR],
      ['undecided with Fear', UNDECIDED_FEAR],
      ['a reaction roll', REACTION_HOPE],
    ] as const) {
      expect(r.effects.hope, name).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

describe('favorOffer: which rolls it speaks on', () => {
  it('says nothing at all where no Hope arrived', () => {
    /*
     * The gate is `effects.hope`, one field, which is what makes the reaction
     * roll and the three Fear rolls free rather than four more rules to keep in
     * step. A reaction roll grants no Hope by the SRD's own sentence, so there
     * is nothing to trade and nothing to explain about one.
     */
    for (const [name, r] of [
      ['success with Fear', SUCCESS_FEAR],
      ['failure with Fear', FAILURE_FEAR],
      ['undecided with Fear', UNDECIDED_FEAR],
      ['a reaction roll with Hope', REACTION_HOPE],
    ] as const) {
      expect(favorOffer(r, SOME, 1), name).toBeNull();
    }
  });

  it('offers the trade on a success with Hope, and on a critical', () => {
    for (const [name, r] of [
      ['success with Hope', SUCCESS_HOPE],
      ['critical', CRITICAL],
    ] as const) {
      const offer = favorOffer(r, SOME, 1);
      expect([name, offer?.show, offer?.kind]).toEqual([name, true, 'take']);
      expect(offer?.label).toBe('TAKE A FAVOR');
    }
  });

  it('offers it with the caveat when the GM has not shared the Difficulty', () => {
    /*
     * `succeeded === null` read as a failure is defect class 2, and it removes
     * the feature from a whole style of table without erroring anywhere. The
     * precedent is `damageOffer`, which draws `IF IT HIT` on the same value for
     * the same reason; the app proposes and the table decides.
     */
    const offer = favorOffer(UNDECIDED_HOPE, SOME, 1);
    expect([offer?.show, offer?.kind]).toEqual([true, 'unknown']);
    expect(offer?.label).toBe('TAKE A FAVOR IF YOU SUCCEEDED');
    expect(offer?.detail).toContain('The GM says whether you did.');
  });

  it('refuses a failure with Hope, in words, with nothing to press', () => {
    // The Hope DID arrive, which is exactly why this one gets a sentence rather
    // than silence: it is the roll on which a player has most reason to expect
    // the offer, and the feature's own wording is what excludes it.
    const offer = favorOffer(FAILURE_HOPE, SOME, 1);
    expect([offer?.show, offer?.kind]).toEqual([false, 'failed']);
    expect(offer?.detail).toContain('replaces the Hope from a success');
  });

  it('explains a full track instead of vanishing off the screen', () => {
    const offer = favorOffer(SUCCESS_HOPE, FULL, 1);
    expect([offer?.show, offer?.kind]).toEqual([false, 'full']);
    expect(offer?.label).toBe('FAVOR FULL · 6 OF 6');
    // One below the ceiling is still an offer, so the bound is where the rules
    // put it and not one short of it.
    expect(favorOffer(SUCCESS_HOPE, { marked: 5, max: MAX_FAVOR }, 1)?.show).toBe(true);
  });

  it('checks the roll before the sheet, so a failure says the thing that will change', () => {
    // Both refusals apply at once here. The failure is about THIS roll and the
    // ceiling is about the sheet, and the roll is the half that is different
    // next time.
    expect(favorOffer(FAILURE_HOPE, FULL, 1)?.kind).toBe('failed');
  });

  it('says what the trade actually costs, which is not always a Hope', () => {
    /*
     * Defect class 4's mirror. `resolve` marks the Hope through
     * `Math.min(c.hope.max, …)`, so at a full track the point never landed -
     * and a row that says "instead of the Hope this roll gave you" there is
     * describing a Hope the sheet never got. This is the case the offer is
     * worth the most in, so the wording is the thing that has to be right.
     */
    expect(favorOffer(SUCCESS_HOPE, SOME, 1)?.detail).toContain(
      'Instead of the Hope this roll gave you.',
    );
    expect(favorOffer(SUCCESS_HOPE, SOME, 0)?.detail).toContain(
      'Your Hope was already full, so this one costs you nothing.',
    );
    // And the count is on both, because this row is the only place in the build
    // that prints how much Favor a Warlock is holding.
    for (const gained of [0, 1]) {
      expect(favorOffer(SUCCESS_HOPE, SOME, gained)?.detail, `gained ${gained}`).toContain(
        'You hold 3 of 6.',
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const warlock = (patch: Partial<Character> = {}): Character => {
  const klass = dataset.classes.find((k) => k.id === 'warlock')!;
  const subclass = dataset.subclasses.find((s) => s.classRef === klass.id)!;
  const base: Character = {
    ...playedCharacter(),
    classRef: klass.id,
    subclassRefs: [subclass.id],
    favor: { marked: 3, max: MAX_FAVOR },
  };
  return { ...base, ...patch };
};

const seed = (character: Character): Character => {
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
};

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
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const text = (): string => container.textContent ?? '';
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
/** The sheet as the store holds it now, which is what the exchange writes to. */
const sheet = (): Character => useApp.getState().characters[0]!;

const row = (character: Character, result: DualityResult | null, hopeGained = 1): void => {
  seed(character);
  render(createElement(FavorRow, { result, hopeGained, layout: 'phone' }));
};

describe('who is offered a Favor', () => {
  it('offers it to a Warlock', () => {
    row(warlock(), SUCCESS_HOPE);
    expect(buttons()).toHaveLength(1);
    expect(text()).toContain('TAKE A FAVOR');
  });

  it('never offers it to a Bard, on the roll that would have earned one', () => {
    /*
     * The control, and the reason the fixture is the real Bard: `playedCharacter`
     * is one, it carries a Favor TRACK like all thirteen classes do, and the
     * only thing that separates the two sheets is a class feature in the
     * dataset. A `favor.max > 0` predicate would answer yes for both.
     */
    const bard = playedCharacter();
    expect(bard.favor, 'the Bard has the track, which is the point').toEqual({
      marked: 0,
      max: MAX_FAVOR,
    });
    row(bard, SUCCESS_HOPE);
    expect(container.children).toHaveLength(0);
  });

  it('offers it to a character who multiclassed into the Warlock', () => {
    // `drawsFavor`'s multiclass arm, on the screen. The app already prints "Favor"
    // among this sheet's features - see `characterFeatures` - so a row that
    // refused here would contradict the sheet above it.
    row({ ...playedCharacter(), multiclassRef: 'warlock', level: 5 }, SUCCESS_HOPE);
    expect(text()).toContain('TAKE A FAVOR');
  });

  it('draws nothing at all before a roll', () => {
    row(warlock(), null);
    expect(container.children).toHaveLength(0);
  });

  it('draws a statement and no target where the trade is refused', () => {
    for (const [name, result, holding] of [
      ['a failure with Hope', FAILURE_HOPE, 3],
      ['a full track', SUCCESS_HOPE, 6],
    ] as const) {
      row(warlock({ favor: { marked: holding, max: MAX_FAVOR } }), result);
      expect(buttons(), name).toHaveLength(0);
      expect(container.children.length, name).toBe(1);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });
});

describe('the exchange', () => {
  it('adds the Favor and takes the Hope back, in one write', () => {
    const before = seed(warlock({ hope: { marked: 4, max: 6 } }));
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 1, layout: 'phone' }));
    click(buttons()[0]!);
    expect([sheet().favor.marked, sheet().hope.marked]).toEqual([4, 3]);
    // Nothing else on the sheet moved, and the Stress a critical would clear is
    // not part of this trade.
    expect(sheet().stress).toEqual(before.stress);
  });

  it('takes back nothing when the roll gave nothing, which is at a full Hope track', () => {
    /*
     * THE HALF THAT COSTS A PLAYER A HOPE IF IT IS WRONG. `resolve` clamps, so
     * a sheet already at its Hope maximum gained no point from the roll -
     * `hopeGained` is 0 - and subtracting one here would take a Hope the roll
     * never gave. The rules hand the Favor over free in that case; this asserts
     * the app does too.
     */
    seed(warlock({ hope: { marked: 6, max: 6 } }));
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 0, layout: 'phone' }));
    click(buttons()[0]!);
    expect([sheet().favor.marked, sheet().hope.marked]).toEqual([4, 6]);
  });

  it('writes a log line naming which of the two it was', () => {
    seed(warlock());
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 1, layout: 'phone' }));
    click(buttons()[0]!);
    const entry = useApp.getState().log[0];
    expect([entry?.kind, entry?.label]).toEqual(['note', 'Took a Favor']);
    expect(entry?.detail).toBe('Instead of the Hope from this roll');
  });

  it('cannot be taken twice, because there is nothing left to press', () => {
    /*
     * Defect class 5, and the guard is structural rather than a flag: the
     * control is REPLACED by the record of what happened. A `disabled` button
     * would leave a target that says the app could do this and won't, and a
     * bare boolean would be a line somebody can delete without a test noticing.
     */
    seed(warlock());
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 1, layout: 'phone' }));
    click(buttons()[0]!);
    expect(buttons(), 'the offer is still on the screen after being taken').toHaveLength(0);
    expect(text()).toContain('FAVOR TAKEN · 4 OF 6');
    expect(sheet().favor.marked).toBe(4);
  });

  it('leaves the record where the keyboard can find it', () => {
    // The button the user just pressed is unmounted by its own click, which is
    // the state `DualityRoll`'s keypad effect exists for: without this, focus
    // falls to `<body>`. The record takes it instead, out of the tab order.
    seed(warlock());
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 1, layout: 'phone' }));
    click(buttons()[0]!);
    const record = container.firstElementChild as HTMLElement;
    expect(record.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(record);
  });

  it('never lets a seventh Favor onto the sheet', () => {
    // Belt to `boundCounters`' braces. The offer is refused at the ceiling, so
    // this drives the write directly: five, then the trade, is six and stops.
    seed(warlock({ favor: { marked: 5, max: MAX_FAVOR } }));
    render(createElement(FavorRow, { result: SUCCESS_HOPE, hopeGained: 1, layout: 'phone' }));
    click(buttons()[0]!);
    expect(sheet().favor).toEqual({ marked: 6, max: MAX_FAVOR });
  });
});

// ---------------------------------------------------------------------------
// Through the roll surface, which is where `hopeGained` comes from
// ---------------------------------------------------------------------------

/**
 * The panel with typed dice on, so a roll is a pair of numbers and not a
 * gamble. `digitalDice` off is what makes ROLL refuse and the faces the only
 * way in; `cockpitRoll.test.tsx` established the idiom.
 */
function typedPanel(character: Character, layout: 'desktop' | 'phone' = 'phone'): void {
  seed(character);
  useApp.setState({ prefs: { ...DEFAULT_PREFS, digitalDice: false, manualDice: true } });
  render(
    createElement(DualityRoll, {
      stats: deriveStats(character, dataset, index),
      trait: 'agility',
      onTraitChange: () => undefined,
      source: null,
      layout,
      armedExperiences: [],
      onArmedExperiencesChange: () => undefined,
    }),
  );
}

const typeFace = (name: 'HOPE' | 'FEAR', value: number): void => {
  click(
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${name} die`))!,
  );
  const grid = container.querySelector<HTMLElement>('div[style*="repeat(4, 1fr)"]')!;
  click([...grid.querySelectorAll('button')][value - 1]!);
};

const favorButton = (): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').includes('TAKE A FAVOR'));

describe('the roll surface hands the row what the roll actually paid', () => {
  it('offers the trade after a success with Hope, and nets one Favor for one Hope', () => {
    /*
     * The whole loop, end to end. A pair of 10 and 3 with no Difficulty is a
     * roll with Hope, so `resolve` marks the Hope on the sheet before anybody
     * is asked - which is why the assertion is on the NET, four to four, and
     * not on the Favor alone.
     */
    typedPanel(warlock({ hope: { marked: 4, max: 6 } }));
    typeFace('HOPE', 10);
    typeFace('FEAR', 3);
    expect(sheet().hope.marked, 'the roll marks the Hope on its own').toBe(5);

    click(favorButton()!);
    expect([sheet().favor.marked, sheet().hope.marked]).toEqual([4, 4]);
  });

  it('gives back nothing when the Hope was already full, on the live surface', () => {
    /*
     * `hopeGained` is computed inside `resolve`'s own updater, against the
     * record it is writing, and this is the case that proves it is not simply
     * `effects.hope`: the result grants one, the track cannot take it, and the
     * trade must not invent a Hope to remove.
     */
    typedPanel(warlock({ hope: { marked: 6, max: 6 } }));
    typeFace('HOPE', 10);
    typeFace('FEAR', 3);
    expect(sheet().hope.marked, 'the ceiling held').toBe(6);

    click(favorButton()!);
    expect([sheet().favor.marked, sheet().hope.marked]).toEqual([4, 6]);
  });

  it('gives the next roll its own offer, and does not carry the last one over', () => {
    // The row is keyed on the roll, the way the damage row is. Taking one
    // Favor must not leave the record standing over the roll after it, and it
    // must not leave the offer standing either.
    typedPanel(warlock());
    typeFace('HOPE', 10);
    typeFace('FEAR', 3);
    click(favorButton()!);
    expect(text()).toContain('FAVOR TAKEN');

    typeFace('HOPE', 9);
    typeFace('FEAR', 2);
    expect(text(), 'last roll’s answer survived into this one').not.toContain('FAVOR TAKEN');
    expect(favorButton(), 'the second roll was offered nothing').toBeDefined();
    click(favorButton()!);
    expect(sheet().favor.marked, 'two rolls, two Favor').toBe(5);
  });

  it('does the same on the cockpit, which is a second call site', () => {
    /*
     * BOTH LAYOUTS, BECAUSE THE ROW IS DRAWN TWICE AND THE TWO LINES CAN DRIFT.
     * The phone case above is not this one: the desktop branch is a `return`
     * past it with its own `<FavorRow>`, and the first version of that line
     * carried `key={rollId}` - the same key the damage row beside it carries,
     * in the same children list. React warns about the duplicate and reconciles
     * the two against each other, and the measured symptom was two offers on
     * the glass at once and a `taken` that never stuck. It was caught on the
     * phone and would not have been caught here.
     */
    typedPanel(warlock({ hope: { marked: 4, max: 6 } }), 'desktop');
    typeFace('HOPE', 10);
    typeFace('FEAR', 3);
    expect(buttons().filter((b) => (b.textContent ?? '').includes('TAKE A FAVOR'))).toHaveLength(1);

    click(favorButton()!);
    expect(text()).toContain('FAVOR TAKEN · 4 OF 6');
    expect([sheet().favor.marked, sheet().hope.marked]).toEqual([4, 4]);
  });

  it('offers a Bard nothing on the same two faces', () => {
    typedPanel(playedCharacter());
    typeFace('HOPE', 10);
    typeFace('FEAR', 3);
    expect(text(), 'the roll did not resolve').toContain('Rolled with Hope');
    expect(favorButton()).toBeUndefined();
    expect(text()).not.toContain('FAVOR');
  });
});
