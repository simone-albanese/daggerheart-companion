// @vitest-environment jsdom
/**
 * The rest surface, which is the first caller `src/engine/rest.ts` has ever had.
 *
 * The engine was 226 lines with 28 passing tests and no screen, which is the
 * defect class this repository keeps finding: every unit worked and nothing
 * called them. So these tests are about the two things a *screen* can get
 * wrong that a unit test cannot see.
 *
 * The first is that `takeRest` rolls dice. A surface that previews a rest by
 * calling it with the real RNG spends the player's dice to draw itself, and a
 * roll that happens because you opened a screen is a roll you cannot refuse.
 * Every test here that does not commit mounts with `refusingRng`, so any path
 * that reaches for a die throws rather than quietly returning a number.
 *
 * The second is that the numbers on the screen have to be the numbers that get
 * written. Hence the scripted RNG: the commit tests assert the marks, the log
 * strings and the sides the engine asked for, so a screen that recomputed the
 * arithmetic beside the engine instead of through it would disagree here.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@shared/types.ts';
import type { Rng } from '../../src/engine/dice.ts';
import { Play } from '../../src/ui/player/Play.tsx';
import { Rest } from '../../src/ui/player/Rest.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { refusingRng, scriptedRng } from '../fixtures/factories.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/**
 * Everything React complained about while a test was running.
 *
 * `screens.test.tsx` already treats a console warning as a failure, and says
 * why: React reports a duplicate key, a nested `<button>` and a state update
 * outside `act()` by writing to the console and rendering anyway, which is the
 * shape of every defect this app has shipped. That sweep mounts each component
 * once and never touches it, and everything this surface draws below the kind
 * switch is built out of what has been *picked* - so the keys that can collide
 * do not exist until something has been clicked twice. Hence the same rule
 * again here, around every interaction in the file rather than around a mount.
 */
let complaints: string[];

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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
  complaints = [];
  const record = (...args: unknown[]): void => {
    complaints.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  };
  vi.spyOn(console, 'error').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  const seen = [...complaints];
  vi.restoreAllMocks();
  expect(seen, 'React complained while this test ran').toEqual([]);
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

function seed(patch: Partial<Character> = {}): Character {
  const character = { ...playedCharacter(), ...patch };
  // Inside `act`, because several tests re-seed with a tree already mounted and
  // the store is what that tree renders from: a bare `setState` there updates
  // React from outside the test's control and React says so on the console.
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
}

/**
 * The surface on its own, with dice that refuse to be rolled.
 *
 * `Play.tsx` hands it `cryptoRng`; a test that wants to know what was written
 * has to hand it a script, which is why the component takes the RNG as a prop
 * rather than defaulting to the real one inside `takeRest`.
 */
const mount = (c: Character, rng: Rng = refusingRng): void => {
  render(createElement(Rest, { stats: playedStats(c), rng }));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** A control by its accessible name, which is what a person hears. */
function named(name: string): HTMLButtonElement {
  const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '') === name);
  if (found === undefined) {
    throw new Error(
      `no control called "${name}". Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim())
        .join(' | ')}`,
    );
  }
  return found;
}

const maybe = (name: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.getAttribute('aria-label') ?? '') === name);

/**
 * A move row, by the sentence its name opens with.
 *
 * The name ends with the row's own bracket - ": 3–5 HP", ": NOTHING" - because
 * `aria-label` replaces the contents and a name that stopped at the slot would
 * leave the number unannounced. That tail is a different string on every pick,
 * so the lookup keys on the head; the tail is asserted wherever it is the
 * subject, and swept over the whole surface in "announces every number it
 * shows on a control".
 */
const moveRow = (move: string, slot = 'first'): HTMLButtonElement | undefined =>
  buttons().find((b) =>
    (b.getAttribute('aria-label') ?? '').startsWith(`Choose ${move} as your ${slot} move`),
  );

function pickable(move: string, slot = 'first'): HTMLButtonElement {
  const found = moveRow(move, slot);
  if (found === undefined) {
    throw new Error(
      `no row for "${move}" in the ${slot} slot. Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim())
        .join(' | ')}`,
    );
  }
  return found;
}

const byText = (label: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim() === label);

/** The same lookup, for the cases that mean to press it: it says what is there. */
function pressed(label: string): HTMLButtonElement {
  const found = byText(label);
  if (found === undefined) {
    throw new Error(
      `no control reading "${label}". Here: ${buttons()
        .map((b) => (b.textContent ?? '').trim())
        .join(' | ')}`,
    );
  }
  return found;
}

const header = (): HTMLButtonElement => {
  const found = buttons().find((b) => b.getAttribute('aria-expanded') !== null);
  if (found === undefined) throw new Error('the rest fold has no header');
  return found;
};

/** Open the fold and choose a kind, which is what draws the whole surface. */
function open(kind?: 'short' | 'long'): void {
  click(header());
  if (kind !== undefined) click(named(`Take a ${kind} rest`));
}

/** A sheet with something on every track for a move to clear. */
const hurt = (patch: Partial<Character> = {}): Character =>
  seed({
    hp: { marked: 5, max: 6 },
    stress: { marked: 4, max: 6 },
    armorSlots: { marked: 2, max: 3 },
    ...patch,
  });

/** The sentence the app has to quote, read out of the dataset a second way. */
function srdSentence(needle: string): string {
  const body = dataset.rules.find((r) => r.id === 'downtime')?.body ?? '';
  const found = new RegExp(`[^.]*${needle}[^.]*\\.`).exec(body);
  expect(found, `the shipped downtime rule no longer says "${needle}"`).not.toBeNull();
  return found![0].trim();
}

describe('where it sits on the Play screen', () => {
  /*
   * Replaces `is in the part that scrolls, and never in the pinned block`,
   * which asserted the phone root had two children and that the rest was in the
   * first of them. There is one child region now - nothing on Play is pinned -
   * so the claim becomes the one it was standing in for: a rest is
   * between-scenes work, so it is a fold, below the dice and above the two
   * sections read once a session.
   */
  it('is a fold in the one column, below ROLL and above the lineage', () => {
    const c = seed();
    render(createElement(Play, { stats: playedStats(c) }));
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.style.overflowY, 'the sheet is not the one scrolling column').toBe('auto');

    const all = [...container.querySelectorAll('button')];
    const rest = all.find((b) => (b.textContent ?? '').startsWith('Rest & downtime'));
    expect(rest, 'there is no rest fold on the phone sheet').toBeDefined();
    expect(rootEl.contains(rest!), 'the rest fold is outside the column').toBe(true);

    const roll = all.find((b) => b.style.minHeight === '56px' && (b.textContent ?? '').length > 4);
    expect(roll, 'there is no roll control to place it against').toBeDefined();
    const lineage = all.find((b) => (b.textContent ?? '').startsWith('Lineage, domains & features'));
    expect(lineage, 'there is no lineage fold to place it against').toBeDefined();

    // Node.DOCUMENT_POSITION_FOLLOWING, spelled as its bit.
    expect(
      (roll!.compareDocumentPosition(rest!) & 4) !== 0,
      'the rest is above ROLL, among the things you declare before the dice',
    ).toBe(true);
    expect(
      (rest!.compareDocumentPosition(lineage!) & 4) !== 0,
      'the lineage is no longer last',
    ).toBe(true);
  });

  it('costs one row closed, and says on that row what it is holding', () => {
    mount(seed());
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(header().style.minHeight).toBe('var(--tap)');
    expect(header().style.width).toBe('100%');
    // A rest is between-scenes work, so nothing of it is drawn until asked for.
    expect(text(), 'the closed fold drew its contents').not.toContain('SHORT REST');
  });

  it('says what it has counted, and never what it has not', () => {
    mount(seed());
    // Not READY and not 0: a sheet that arrived by QR has a zero the app
    // inferred rather than a zero it watched.
    expect(header().textContent).toContain('NONE COUNTED');

    mount(seed({ consecutiveShortRests: 2 }));
    expect(header().textContent).toContain('2 SHORT IN A ROW');

    mount(seed({ consecutiveShortRests: 3 }));
    expect(header().textContent).toContain('LONG REST DUE');
  });

  it('uses aria-expanded for the fold and for nothing else', () => {
    // `playSheet.test.tsx` sweeps every button on Play carrying this attribute
    // and demands the Disclosure header's own geometry from it, so a second use
    // here would fail a test that names a rule about a different file.
    mount(hurt());
    open('long');
    click(pickable('Prepare'));
    expect(container.querySelectorAll('[aria-expanded]')).toHaveLength(1);
  });
});

describe('the preview', () => {
  it('rolls nothing because a screen was opened', () => {
    const c = hurt();
    mount(c);
    open('short');
    click(pickable('Tend to Wounds'));
    click(pickable('Clear Stress', 'second'));

    // Not one mark moved, and nothing was written down. `refusingRng` throws if
    // anything reached for a die, so this also fails loudly rather than quietly
    // if a `fixedRoll` is ever dropped from the preview.
    expect(useApp.getState().characters[0]).toStrictEqual(c);
    expect(useApp.getState().log).toEqual([]);
  });

  it('shows what each move will clear before anything is committed', () => {
    mount(hurt());
    open('short');
    // 1d4 + tier 2 against five marked Hit Points and four marked Stress, and
    // the clamp is the engine's rather than one this screen applies afterwards.
    expect(pickable('Tend to Wounds').textContent).toContain('3–5 HP');
    expect(pickable('Clear Stress').textContent).toContain('3–4 STRESS');
    expect(pickable('Repair Armor').textContent).toContain('2 ARMOR');
    // Drawn and announced. `aria-label` replaces the contents of the button,
    // so the bracket has to be in the name as well as in the row.
    expect(pickable('Tend to Wounds').getAttribute('aria-label')).toBe(
      'Choose Tend to Wounds as your first move: 3–5 HP',
    );

    click(pickable('Tend to Wounds'));
    click(pickable('Clear Stress', 'second'));
    expect(text()).toContain('Will clear');
    expect(text()).toContain('HP 3–5 of 5');
    expect(text()).toContain('STRESS 3–4 of 4');
  });

  it('says what a second copy of a move would really do', () => {
    // The same move may be taken twice, and the second one only gets what the
    // first one left. Bracketed against the untouched character both rows would
    // read 3-5, over a panel promising five in total.
    mount(hurt());
    open('short');
    click(pickable('Tend to Wounds'));
    expect(text(), 'the first copy takes the whole bracket').toContain('HP 3–5 of 5');
    expect(pickable('Tend to Wounds', 'second').textContent).toContain('0–2 HP');

    click(pickable('Tend to Wounds', 'second'));
    // Five marked, cleared twice: 3 then 2 at the bottom of the die and 5 then
    // 0 at the top, so the rest clears five either way and the panel says so.
    expect(text()).toContain('HP 5 of 5');
  });

  it('says NOTHING rather than a number a move cannot deliver', () => {
    mount(seed({ hp: { marked: 0, max: 6 }, stress: { marked: 4, max: 6 } }));
    open('short');
    expect(pickable('Tend to Wounds').textContent).toContain('NOTHING');
    expect(pickable('Clear Stress').textContent).toContain('3–4 STRESS');
  });

  it('does not pretend to know the Fear', () => {
    mount(hurt());
    open('short');
    const line = (): string =>
      [...container.querySelectorAll('.spread')]
        .map((el) => el.textContent ?? '')
        .find((t) => t.startsWith('GM gains')) ?? '';
    // The die, never a number: the app has not rolled it yet.
    expect(line()).toBe('GM gains1D4 FEAR');

    click(named('Take a long rest'));
    expect(line()).toBe('GM gains1D4 + 4 FEAR');
    // And the 4 is named as an assumption rather than folded into the sum.
    expect(text()).toContain('THE + 4 IS THE PARTY SIZE SET ON THIS DEVICE');
  });

  it('names the move the engine will not apply instead of costing it', () => {
    mount(hurt());
    open('long');
    const project = pickable('Work on a Project');
    expect(project.textContent).toContain('WITH THE GM');
    click(project);
    // The engine's own line, so the panel cannot describe it differently from
    // the log entry the commit will write.
    expect(text()).toContain('WORK ON A PROJECT: ADVANCE THE PROJECT COUNTDOWN WITH THE GM');
  });

  it('draws the same note twice when the same move is picked twice', () => {
    // The SRD lets a character take one move twice, and "Work on a Project" is
    // the only move the engine does not apply, so it is the only pair that
    // produces two identical lines. `takeRest` will write both of them into the
    // log, so the panel that says what the commit will do has to show both.
    mount(hurt());
    open('long');
    click(pickable('Work on a Project'));
    click(pickable('Work on a Project', 'second'));

    const note = 'WORK ON A PROJECT: ADVANCE THE PROJECT COUNTDOWN WITH THE GM';
    const drawn = [...container.querySelectorAll('span')].filter(
      (el) => (el.textContent ?? '') === note,
    );
    expect(drawn, 'two moves, two lines').toHaveLength(2);
    // And the file-wide console sweep in `afterEach` is the other half of this:
    // keyed by the sentence, these two are one key and React says so.
  });

  it('drops the picks when the rest kind changes', () => {
    // The two lists are different and `takeRest` refuses a move from the wrong
    // one out loud. Carried across, the slots would hold moves that are not on
    // the screen and the commit would write "is not a long rest move" into an
    // entry labelled Long rest.
    mount(hurt());
    open('short');
    click(pickable('Tend to Wounds'));
    click(pickable('Clear Stress', 'second'));
    expect(text()).toContain('Will clear');

    click(named('Take a long rest'));
    expect(text()).toContain('NO MOVES CHOSEN');
    expect(text()).not.toContain('Will clear');
    expect(maybe('Take Tend to Wounds out of move 1')).toBeUndefined();
  });
});

describe('committing', () => {
  it('writes the numbers the scripted dice give, and only those', () => {
    const c = hurt();
    const rng = scriptedRng(3, 4, 2);
    mount(c, rng);
    open('short');
    click(pickable('Tend to Wounds'));
    click(pickable('Clear Stress', 'second'));
    click(byText('TAKE THE SHORT REST')!);

    const after = useApp.getState().characters[0]!;
    expect(after.hp.marked, 'd4 3 + tier 2 clears the five marked').toBe(0);
    expect(after.stress.marked, 'd4 4 + tier 2 clears the four marked').toBe(0);
    // Two moves and the GM's Fear, in that order, and nothing else asked for a
    // die. An `rng` the component never passed on would leave this empty.
    expect(rng.calls).toEqual([4, 4, 4]);
  });

  it("writes the 'rest' log entry nothing has ever written", () => {
    const c = hurt();
    mount(c, scriptedRng(3, 4, 2));
    open('short');
    click(pickable('Tend to Wounds'));
    click(pickable('Clear Stress', 'second'));
    click(byText('TAKE THE SHORT REST')!);

    const entry = useApp.getState().log[0]!;
    expect(entry.kind).toBe('rest');
    expect(entry.label).toBe('Short rest');
    // The engine's own strings, verbatim, so the log cannot report a move that
    // was not made or a number that was not rolled.
    expect(entry.detail).toContain('Tend to Wounds: cleared 5 HP (d4 3 + tier 2)');
    expect(entry.detail).toContain('Clear Stress: cleared 4 Stress (d4 4 + tier 2)');
    expect(entry.detail).toContain('GM gains 2 Fear');
  });

  it('is offered with no moves at all, and still costs the GM their Fear', () => {
    const c = hurt();
    mount(c, scriptedRng(2));
    open('short');
    expect(text()).toContain('NO MOVES CHOSEN');
    click(byText('TAKE THE SHORT REST')!);

    const after = useApp.getState().characters[0]!;
    expect(after.hp.marked, 'a rest with no moves clears nothing').toBe(5);
    expect(after.consecutiveShortRests, 'a rest with no moves is still a rest').toBe(1);
    expect(useApp.getState().log[0]!.detail).toBe('GM gains 2 Fear');
  });

  it('counts the rest on the sheet, and clears the count on a long one', () => {
    mount(hurt(), scriptedRng(2));
    open('short');
    click(byText('TAKE THE SHORT REST')!);
    expect(useApp.getState().characters[0]!.consecutiveShortRests).toBe(1);

    mount(hurt({ consecutiveShortRests: 3 }), scriptedRng(2));
    open('long');
    click(byText('TAKE THE LONG REST')!);
    expect(useApp.getState().characters[0]!.consecutiveShortRests).toBe(0);
  });

  it('says the rule at the moment it becomes true, and not before', () => {
    mount(hurt({ consecutiveShortRests: 1 }), scriptedRng(2));
    open('short');
    click(byText('TAKE THE SHORT REST')!);
    expect(useApp.getState().log[0]!.detail).not.toContain('three short rests in a row');

    mount(hurt({ consecutiveShortRests: 2 }), scriptedRng(2));
    open('short');
    click(byText('TAKE THE SHORT REST')!);
    expect(useApp.getState().log[0]!.detail).toContain(srdSentence('three short rests in a row'));
  });

  it('puts the surface away once the rest has happened', () => {
    mount(hurt(), scriptedRng(3, 2));
    open('short');
    click(pickable('Tend to Wounds'));
    click(byText('TAKE THE SHORT REST')!);
    // A fold still showing a rest that has already been taken is a fold
    // offering to take it again.
    expect(byText('TAKE THE SHORT REST')).toBeUndefined();
    expect(moveRow('Tend to Wounds')).toBeUndefined();
  });
});

describe('the refusal, at three short rests in a row', () => {
  it('says the rule instead of greying out a control', () => {
    mount(hurt({ consecutiveShortRests: 3 }));
    click(header());

    expect(text()).toContain(srdSentence('three short rests in a row'));
    expect(text()).toContain('THIS SHEET HAS COUNTED 3 SHORT RESTS IN A ROW');
    // The count is what this device watched, and a sheet handed over by QR
    // arrives having watched nothing.
    expect(text()).toContain('A SHEET THAT ARRIVED BY QR ARRIVES AT ZERO');
  });

  it('takes the short rest off the screen rather than disabling it', () => {
    mount(hurt({ consecutiveShortRests: 3 }));
    // With a kind chosen, so the swap section - where a disabled control is
    // legitimate - is drawn and this assertion is about the switch itself.
    open('long');
    expect(maybe('Take a short rest')).toBeUndefined();
    expect(maybe('Take a long rest')).toBeDefined();

    const group = container.querySelector('[role="group"][aria-label="Which rest"]')!;
    expect(
      [...group.querySelectorAll('button')].filter((b) => b.disabled),
      'a dead control with the word SHORT still on it says the app could and will not',
    ).toEqual([]);

    // And nothing left on the screen sends the reader to it. This is the same
    // render the interrupted-rest panel is drawn into, and that panel used to
    // finish "THE SHORT REST ABOVE APPLIES EXACTLY THAT" over a switch holding
    // one button.
    expect(
      text(),
      'a sentence pointing at the control this state has just removed',
    ).not.toContain('THE SHORT REST ABOVE');
  });
});

describe('the interrupted long rest', () => {
  it('quotes the rule rather than inventing a control for it', () => {
    mount(hurt());
    open('long');
    expect(text()).toContain(srdSentence('long rest is interrupted'));
    // Nothing here claims to know: the app cannot see the table, and the route
    // out is the short rest already on the screen - which has to *be* on the
    // screen for the sentence beside it to be true.
    expect(text()).toContain('THE APP CANNOT TELL');
    expect(text()).toContain('THE SHORT REST ABOVE APPLIES EXACTLY THAT');
    expect(maybe('Take a short rest'), 'the sentence names a control that is not drawn').toBeDefined();
    expect(
      buttons().filter((b) => /interrupt/i.test(b.getAttribute('aria-label') ?? '')),
      'a control claiming to model an interruption the app cannot observe',
    ).toEqual([]);
  });

  it('stops pointing at the short rest in the one state that has removed it', () => {
    // Three in a row is where this panel is most likely to be read: the long
    // rest is the only kind on offer, so it is the only kind that can be
    // interrupted, and the control the panel used to name is gone.
    mount(hurt({ consecutiveShortRests: 3 }));
    open('long');
    expect(text(), 'the rule itself is still the reader’s').toContain(
      srdSentence('long rest is interrupted'),
    );
    expect(maybe('Take a short rest')).toBeUndefined();
    expect(text()).not.toContain('THE SHORT REST ABOVE');
    expect(text()).toContain('WITH A LONG REST DUE THE SHORT ONE IS NOT ON THIS SCREEN');
  });
});

describe('the free swap', () => {
  it('moves a card in when the rest happens, and not on the tap that asks', () => {
    const base = playedCharacter();
    const c = seed({ stress: { marked: 0, max: base.stress.max } });
    const card = index.cards.get(c.vault[0]!)!;
    expect(card.recallCost, 'the fixture card is free anyway').toBeGreaterThan(0);

    mount(c, scriptedRng(2));
    open('short');
    click(named(`Recall ${card.name} free during this rest`));

    /*
     * Nothing yet. The card is free *because* a rest is happening, and no rest
     * has happened: the price would have been taken for a downtime that had not
     * occurred and, if the player walked away here, never would.
     */
    const staged = useApp.getState().characters[0]!;
    expect(staged.loadout, 'the card moved before the rest it is free during').not.toContain(
      card.id,
    );
    expect(staged.vault).toContain(card.id);
    expect(useApp.getState().log, 'a free recall logged before the rest').toEqual([]);
    // The proposal is on the screen, though: the row has changed sides, so the
    // one press left is the one that writes.
    expect(text()).toContain('1 CARD WILL MOVE WITH THIS REST');
    expect(maybe(`Move ${card.name} to vault, free during this rest`)).toBeDefined();

    click(byText('TAKE THE SHORT REST')!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).toContain(card.id);
    expect(after.vault).not.toContain(card.id);
    expect(after.stress.marked, 'the rest charged the scene price').toBe(0);
    expect(after.consecutiveShortRests, 'the rest that made it free').toBe(1);
    // One event, one entry: the card moved as part of this rest, so it is in
    // the entry that records the rest rather than in a note beside it.
    const entry = useApp.getState().log[0]!;
    expect(useApp.getState().log).toHaveLength(1);
    expect(entry.kind).toBe('rest');
    expect(entry.detail).toContain(`Recalled ${card.name}, free during this rest`);
  });

  it('leaves the sheet alone when the rest is never taken', () => {
    const c = seed();
    const out = index.cards.get(c.loadout[0]!)!;
    const back = index.cards.get(c.vault[0]!)!;
    mount(c);
    open('short');
    click(named(`Move ${out.name} to vault, free during this rest`));
    click(named(`Recall ${back.name} free during this rest`));
    expect(text()).toContain('2 CARDS WILL MOVE WITH THIS REST');

    // Walking away is the case the old shape got wrong: two cards had already
    // moved at the vault's rest price with no rest anywhere on the record.
    expect(useApp.getState().characters[0]).toStrictEqual(c);
    expect(useApp.getState().log).toEqual([]);
  });

  it('sends a card out to the vault, which was always free', () => {
    const c = seed();
    const card = index.cards.get(c.loadout[0]!)!;
    mount(c, scriptedRng(2));
    open('short');
    click(named(`Move ${card.name} to vault, free during this rest`));
    expect(useApp.getState().characters[0]!.loadout, 'moved before the rest').toContain(card.id);

    click(byText('TAKE THE SHORT REST')!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).not.toContain(card.id);
    expect(after.vault).toContain(card.id);
    expect(useApp.getState().log[0]!.detail).toContain(`Moved ${card.name} to the vault`);
  });

  it('nets a card sent out and brought back rather than reporting two moves', () => {
    const c = seed();
    const card = index.cards.get(c.loadout[0]!)!;
    mount(c, scriptedRng(2));
    open('short');
    click(named(`Move ${card.name} to vault, free during this rest`));
    click(named(`Recall ${card.name} free during this rest`));
    // Nothing will move, so the panel says nothing and the log says nothing:
    // the entry describes the sheet before and after, not the taps between.
    expect(text()).not.toContain('WILL MOVE WITH THIS REST');

    click(byText('TAKE THE SHORT REST')!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).toContain(card.id);
    expect(useApp.getState().log[0]!.detail).not.toContain(card.name);
  });

  it('re-gates a recall against the rest as proposed, not the sheet as it stands', () => {
    // Five held, so every vault row is refused. Sending one out frees the slot
    // in the rest being proposed - and the cap that says so is the engine's, on
    // the staged sheet, rather than a second count kept by this screen.
    const base = playedCharacter();
    const c = seed({
      loadout: [...base.loadout, ...base.vault.slice(0, 2)],
      vault: base.vault.slice(2),
    });
    const wanted = index.cards.get(c.vault[0]!)!;
    const spare = index.cards.get(c.loadout[0]!)!;
    mount(c, scriptedRng(2));
    open('short');
    expect(maybe(`Recall ${wanted.name} free during this rest`)).toBeUndefined();

    click(named(`Move ${spare.name} to vault, free during this rest`));
    expect(text()).toContain('4 / 5 HELD');
    click(named(`Recall ${wanted.name} free during this rest`));
    expect(text()).toContain('5 / 5 HELD');

    click(byText('TAKE THE SHORT REST')!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout, 'the swap the screen promised').toContain(wanted.id);
    expect(after.loadout).not.toContain(spare.id);
    expect(after.loadout, 'the cap the engine enforces').toHaveLength(5);
  });

  it('refuses with the cap everybody else uses, in words', () => {
    const base = playedCharacter();
    const c = seed({
      loadout: [...base.loadout, ...base.vault.slice(0, 2)],
      vault: base.vault.slice(2),
    });
    const card = index.cards.get(c.vault[0]!)!;
    mount(c);
    open('short');

    const chip = named(`${card.name} cannot be recalled: Loadout is full (5) - move a card to the vault first`);
    expect(chip.disabled).toBe(true);
    // The reason where the price would be, not a title attribute and not 55%
    // opacity: a touchscreen has no hover. Same words the Vault fold produces,
    // because it is the same function.
    expect(chip.textContent).toContain('FULL');
    expect(chip.style.opacity).toBe('');
  });

  it('draws the loadout card it cannot read, and can move it out of the way', () => {
    const base = playedCharacter();
    seed({ loadout: [...base.loadout, 'card-from-a-newer-bundle'] });
    mount(useApp.getState().characters[0]!, scriptedRng(2));
    open('short');
    expect(text(), 'the count the gate uses').toContain('4 / 5 HELD');
    // The ref itself, because it is the only thing anybody has to go on, and a
    // row rather than a count: it fills a slot, and moving it out is the only
    // way a full loadout recalls anything.
    expect(text()).toContain('card-from-a-newer-bundle');
    expect(text()).toContain('NOT IN BUILD');
    // And no cross-reference. At 1180px and up the loadout is a bare column in
    // the cockpit, not a Disclosure, so "MOVE THEM IN THE LOADOUT FOLD" named a
    // control that does not exist on that screen.
    expect(text(), 'a fold that is not on every layout').not.toContain('LOADOUT FOLD');

    click(named('Move the unreadable card card-from-a-newer-bundle to vault, freeing its slot'));
    expect(text()).toContain('3 / 5 HELD');
    click(byText('TAKE THE SHORT REST')!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).not.toContain('card-from-a-newer-bundle');
    expect(after.vault).toContain('card-from-a-newer-bundle');
    expect(useApp.getState().log[0]!.detail).toContain(
      'Moved card-from-a-newer-bundle to the vault',
    );
  });

  it('draws the vault card it cannot read rather than quietly holding fewer', () => {
    // The sheet arrived from a newer bundle, which P0-7 already treats as real.
    // `resolveCards` is a filter, so these vanished from this list while the
    // Vault fold went on showing five - the same defect as the loadout half,
    // on the side that had no rows to notice it.
    const base = playedCharacter();
    seed({ vault: [...base.vault, 'ghost-vault-ref-a', 'ghost-vault-ref-b'] });
    mount(useApp.getState().characters[0]!);
    open('short');
    expect(text()).toContain('ghost-vault-ref-a');
    expect(text()).toContain('ghost-vault-ref-b');
    // A readout, not a dead control: nothing here knows what the card is, so
    // there is nothing to press and no refusal to explain.
    expect(
      buttons().filter((b) => (b.getAttribute('aria-label') ?? '').includes('ghost-vault-ref')),
      'a control offering to do something with a card this build cannot read',
    ).toEqual([]);
  });

  it('never says there is nothing to move over cards it is holding', () => {
    // Every held card unreadable: the old empty line was gated on the resolved
    // lists, so it printed "This sheet is holding no cards this build can read,
    // so there is nothing to move" directly under a line telling the reader to
    // go and move them.
    seed({ loadout: ['card-from-a-newer-bundle'], vault: [] });
    mount(useApp.getState().characters[0]!);
    open('short');
    expect(text()).toContain('card-from-a-newer-bundle');
    expect(text(), 'two sentences on one screen denying each other').not.toContain(
      'nothing to move',
    );
  });

  it('says there is nothing to move only when the sheet is holding nothing', () => {
    seed({ loadout: [], vault: [] });
    mount(useApp.getState().characters[0]!);
    open('short');
    expect(text()).toContain('This sheet is holding no cards, so there is nothing to move.');
  });
});

describe('the whole open surface', () => {
  it('holds every target at the touch floor', () => {
    const px = (value: string): number => {
      if (value === 'var(--tap)' || value === 'var(--control)') return 44;
      if (value === '') return 0;
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };
    mount(hurt());
    // A long rest, with Prepare picked so the party toggle is drawn too: this
    // exists because `playSheet.test.tsx`'s global sweep cannot see any of it -
    // its `openEverything()` opens folds and never chooses a rest kind.
    open('long');
    click(pickable('Prepare'));

    const targets = buttons().map((b) => ({
      name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 30),
      h: Math.max(px(b.style.height), px(b.style.minHeight)),
    }));
    expect(targets.length, 'the open surface drew almost nothing').toBeGreaterThan(10);
    expect(
      targets.filter((t) => t.h < 44).map((t) => `${t.name} (${String(t.h)}px)`),
      'these declare less than the 44px floor',
    ).toEqual([]);
  });

  it('never declares itself wider than the phone column', () => {
    mount(hurt());
    open('long');
    const px = (value: string): number => {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };
    const wide = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => px(el.style.width) > 369 || px(el.style.minWidth) > 369)
      .map((el) => `${el.tagName} ${el.style.width}/${el.style.minWidth}`);
    expect(wide, 'these are wider than the 369px column at 393px').toEqual([]);
  });

  /**
   * Everything a control shows, and the name that control is announced by.
   *
   * `aria-label` replaces the contents rather than adding to them, so a label
   * written as a sentence about the action hides whatever else is inside the
   * button. Both sweeps below are about that one fact, from the two directions
   * it bites from: what the control shows and does not say, and what the
   * control says and does not show.
   */
  const faces = (b: HTMLButtonElement): { name: string; shown: string[] } => ({
    name: b.getAttribute('aria-label') ?? (b.textContent ?? ''),
    // Direct children only: the row's own faces, not a concatenation of them.
    shown:
      b.childElementCount === 0
        ? [(b.textContent ?? '').trim()]
        : [...b.children].map((el) => (el.textContent ?? '').trim()),
  });

  /** A long rest with a Prepare picked draws every kind of control here. */
  const wholeSurface = (): void => {
    mount(hurt());
    open('long');
    click(pickable('Prepare'));
    expect(buttons().length, 'the open surface drew almost nothing').toBeGreaterThan(10);
  };

  it('announces every number it shows on a control', () => {
    wholeSurface();
    const silent: string[] = [];
    for (const b of buttons()) {
      const { name, shown } = faces(b);
      for (const face of shown) {
        if (!/\d/.test(face)) continue;
        if (!name.toLowerCase().includes(face.toLowerCase())) silent.push(`"${face}" not in "${name}"`);
      }
    }
    // A sighted player reads "3–5 HP" off the row before choosing it. With the
    // bracket outside the name, a screen reader hears the same sentence on a
    // hurt sheet as on an untouched one, and the only other place the numbers
    // appear is the panel that is filled in after a move has been picked.
    expect(silent, 'a number on the screen that nobody is told about').toEqual([]);
  });

  it('says on a control the words written on it, so a voice can ask for it', () => {
    wholeSurface();
    const unaskable: string[] = [];
    for (const b of buttons()) {
      const { name, shown } = faces(b);
      // The label is the first face carrying letters; "×" is a target, not a
      // word, and its name is the sentence.
      const label = shown.find((face) => /[a-z]/i.test(face));
      if (label === undefined) continue;
      if (!name.toLowerCase().includes(label.toLowerCase())) unaskable.push(`"${label}" not in "${name}"`);
    }
    // WCAG 2.5.3. Speech-to-control resolves against the accessible name, so a
    // control whose name does not contain its own visible words cannot be
    // asked for by the words on it.
    expect(unaskable, 'these cannot be reached by saying what is on them').toEqual([]);
  });
});

/**
 * The dice this rest rolls, and who rolls them.
 *
 * The surface was careful in exactly one direction. The preview has handed
 * `takeRest` an `Rng` that throws since this file was written, so nothing rolls
 * because a screen was opened - and then the commit called the same function
 * with `Play.tsx`'s `cryptoRng` and read no preference at all, so a table that
 * had switched the roller off got its 1d4s rolled for it the moment it pressed
 * COMMIT. Everything below is that one path.
 */
describe('the dice this rest rolls, and who rolls them', () => {
  /** Which dice switches this device has on. Call after `seed`, which resets them. */
  function dice(digital: boolean, manual: boolean): void {
    act(() => {
      useApp.setState((s) => ({ prefs: { ...s.prefs, digitalDice: digital, manualDice: manual } }));
    });
  }

  /**
   * A keystroke, through the prototype's setter.
   *
   * React installs its own `value` setter on the element and watches the
   * original for changes; assigning `field.value` goes through React's and the
   * tracker never notices, so `onChange` never runs.
   */
  function type(field: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const fields = (): HTMLInputElement[] => [
    ...container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
  ];

  function field(name: string): HTMLInputElement {
    const found = fields().find((f) => (f.getAttribute('aria-label') ?? '') === name);
    if (found === undefined) {
      throw new Error(
        `no field called "${name}". Here: ${fields()
          .map((f) => f.getAttribute('aria-label') ?? '?')
          .join(' | ')}`,
      );
    }
    return found;
  }

  const asked = (): string[] => fields().map((f) => f.getAttribute('aria-label') ?? '?');

  const FEAR = 'The face the d4 showed for the GM\u2019s Fear';
  const TEND = 'The face the d4 showed for Tend to Wounds, move 1';

  it('asks for one number per die the engine will roll, and for no others', () => {
    mount(hurt());
    dice(false, true);
    open('short');
    // Every rest owes the GM a die, so one field before a move is chosen.
    expect(asked()).toEqual([FEAR]);

    click(pickable('Tend to Wounds'));
    expect(asked()).toEqual([TEND, FEAR]);

    click(pickable('Repair Armor', 'second'));
    // Three is the worst case this surface has: `choices.slice(0, 2)` caps the
    // moves at two and each of these two costs a 1d4.
    expect(asked()).toEqual([
      TEND,
      'The face the d4 showed for Repair Armor, move 2',
      FEAR,
    ]);
  });

  it('never asks for a die the engine will not roll', () => {
    mount(hurt());
    dice(false, true);
    open('long');
    click(pickable('Tend to All Wounds'));
    click(pickable('Prepare', 'second'));
    // Not one of the five long-rest moves reaches `roll()`: three of them clear
    // a whole track, Prepare gains a flat Hope, and Work on a Project is not
    // applied at all. So the longest, most-picked rest in the game asks for
    // exactly one number, and it is the GM's.
    expect(asked()).toEqual([FEAR]);
  });

  it('writes the numbers the table typed, and consults no rng at all', () => {
    // `refusingRng` throws, so this fails loudly if any die is reached for.
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    click(pickable('Tend to Wounds'));
    type(field(TEND), '3');
    type(field(FEAR), '2');
    // The press names the numbers it is about to use, the way `DeathMove`'s
    // record button does: what it writes is readable before it is pressed.
    click(pressed('TAKE THE SHORT REST WITH 3 AND 2'));

    const after = useApp.getState().characters[0]!;
    expect(after.hp.marked, 'd4 3 + tier 2 clears the five marked').toBe(0);
    const detail = useApp.getState().log[0]!.detail;
    expect(detail).toContain('Tend to Wounds: cleared 5 HP (d4 3 + tier 2)');
    expect(detail).toContain('GM gains 2 Fear');
  });

  it('holds the rest back until every die has a face, and names the ones missing', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    click(pickable('Tend to Wounds'));
    // The press names what it is waiting for rather than standing there
    // greyed out with TAKE THE SHORT REST still on it - and it names every die
    // still missing rather than only the first, because a rest can want three
    // and "one more to go" three times is not an answer.
    expect(byText('TAKE THE SHORT REST'), 'a live press over blank fields').toBeUndefined();
    expect(pressed('STILL TO TYPE: TEND TO WOUNDS, MOVE 1 · THE GM’S FEAR').disabled).toBe(true);

    type(field(TEND), '3');
    expect(text(), 'a die already typed is still being asked for').not.toContain(
      'STILL TO TYPE: TEND TO WOUNDS',
    );
    expect(pressed('STILL TO TYPE: THE GM’S FEAR').disabled).toBe(true);

    type(field(FEAR), '4');
    expect(text()).not.toContain('STILL TO TYPE');
    expect(pressed('TAKE THE SHORT REST WITH 3 AND 4').disabled).toBe(false);
  });

  /*
   * THE TWO BOUNDS OF A FACE, WHICH ARE TWO CASES ON PURPOSE. `isFace` reads
   * `Number(value) >= 1 && Number(value) <= sides` on one line, and the whole
   * suite stayed green with the lower half moved to `>= 0`. A case that typed 5
   * would have gone red for a mutant on the upper half and credited the line;
   * these two cannot die of each other's mutant.
   */
  it('refuses a face above the die, and says what the die can show', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    type(field(FEAR), '5');
    // A d4 showing a 5 is a typo, and taking it would put a 5 in the log under
    // the words "d4". The rest stays held back - and now says why, because a
    // blank field explains itself and a refused one does not.
    expect(byText('TAKE THE SHORT REST WITH 5')).toBeUndefined();
    expect(pressed('STILL TO TYPE: THE GM’S FEAR').disabled).toBe(true);
    expect(text()).toContain('A d4 shows 1 to 4, and the GM’s Fear says 5.');
    expect(text()).toContain('Correct it and the rest is yours to take.');

    type(field(FEAR), '4');
    expect(text(), 'the sentence outlived the number it was about').not.toContain(
      'A d4 shows 1 to 4',
    );
    expect(pressed('TAKE THE SHORT REST WITH 4').disabled).toBe(false);
  });

  it('refuses a 0, which is a face no die in this game shows', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    type(field(FEAR), '0');
    // `takeRest` would take the 0 through `fixedFear` and write "GM gains 0
    // Fear" over a die that was never rolled.
    expect(byText('TAKE THE SHORT REST WITH 0')).toBeUndefined();
    expect(pressed('STILL TO TYPE: THE GM’S FEAR').disabled).toBe(true);
    expect(text()).toContain('A d4 shows 1 to 4, and the GM’s Fear says 0.');

    type(field(FEAR), '1');
    expect(pressed('TAKE THE SHORT REST WITH 1').disabled).toBe(false);
  });

  it('says nothing at all about a field nobody has typed into', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    // A blank field is self-explanatory: the press says which die it is waiting
    // for, and a sentence about a number that is not there would be the app
    // answering a question nobody asked.
    expect(text()).not.toContain('A d4 shows 1 to 4');
    expect(pressed('STILL TO TYPE: THE GM’S FEAR').disabled).toBe(true);
  });

  it('starts the second rest of the evening from blank', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    click(pickable('Tend to Wounds'));
    type(field(TEND), '3');
    type(field(FEAR), '2');
    click(pressed('TAKE THE SHORT REST WITH 3 AND 2'));
    expect(useApp.getState().log).toHaveLength(1);

    // THE SECOND REST, WHICH IS WHERE THE STATE LIVES. The moves go with
    // `setPicks([])`; the GM's die is the rest's own and nothing else clears
    // it, so left standing it would arrive filled in, with nothing outstanding
    // to say it was typed for a rest that has already been taken.
    // Not `open()`: the commit clears `kind` and leaves the fold itself open,
    // so clicking the header here would shut the surface rather than reopen it.
    click(named('Take a short rest'));
    expect(field(FEAR).value, 'the last rest\u2019s Fear die is still in the field').toBe('');
    expect(
      byText('TAKE THE SHORT REST WITH 2'),
      'a rest ready to commit on a stale face',
    ).toBeUndefined();
    expect(pressed('STILL TO TYPE: THE GM’S FEAR').disabled).toBe(true);

    type(field(FEAR), '1');
    click(pressed('TAKE THE SHORT REST WITH 1'));
    expect(useApp.getState().log[0]!.detail).toContain('GM gains 1 Fear');
  });

  it('takes a face away with the move it was typed for', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    click(pickable('Tend to Wounds'));
    type(field(TEND), '4');

    click(named('Take Tend to Wounds out of move 1'));
    click(pickable('Clear Stress'));
    expect(
      field('The face the d4 showed for Clear Stress, move 1').value,
      'a face typed for a move that is no longer chosen',
    ).toBe('');

    // And the same on the replacement path, which is a different branch of
    // `pick`: with both slots full, a third choice replaces the second.
    click(pickable('Repair Armor', 'second'));
    type(field('The face the d4 showed for Repair Armor, move 2'), '2');
    click(pickable('Tend to Wounds', 'second'));
    expect(field('The face the d4 showed for Tend to Wounds, move 2').value).toBe('');
  });

  it('forgets a typed face when the rest kind changes under it', () => {
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    type(field(FEAR), '3');
    click(named('Take a long rest'));
    expect(field(FEAR).value, "the short rest's Fear die carried into the long one").toBe('');
  });

  /*
   * THE FOURTH COMBINATION, WHICH IS BOTH ROADS AT ONCE.
   *
   * `Onboarding.tsx:43-45` records what both switches on means - "ROLL *and*
   * typable faces: a table that rolls physically and digitally in the same
   * session" - and this surface used to answer it differently, turning the
   * roller off the moment one character landed in one field. Three cases,
   * because there are three things to keep apart: that neither road closes the
   * other, and what each of the two presses writes.
   */
  it('with both switches on, offers both roads and keeps offering them', () => {
    mount(hurt(), scriptedRng(2));
    dice(true, true);
    open('short');
    expect(asked()).toEqual([FEAR]);
    expect(byText('TAKE THE SHORT REST'), 'the roller was not offered').toBeDefined();

    type(field(FEAR), '4');
    // The road that used to close here. A typed face is an offer taken up, not
    // a preference changed under the player.
    expect(
      byText('TAKE THE SHORT REST'),
      'the roller went away because a face was typed',
    ).toBeDefined();
    expect(pressed('TAKE THE SHORT REST WITH 4').disabled).toBe(false);
  });

  it('takes the typed faces when the typed press is the one taken', () => {
    const rng = scriptedRng(2);
    mount(hurt(), rng);
    dice(true, true);
    open('short');
    type(field(FEAR), '4');
    click(pressed('TAKE THE SHORT REST WITH 4'));
    // The typed 4, not the scripted 2. One press is one source for every die in
    // the rest, so no log line can mix the table's numbers with this device's.
    expect(useApp.getState().log[0]!.detail).toContain('GM gains 4 Fear');
    expect(rng.calls, 'the app rolled beside the face the table typed').toEqual([]);
  });

  it('rolls when the rolling press is the one taken, and says so on the button', () => {
    const rng = scriptedRng(2);
    mount(hurt(), rng);
    dice(true, true);
    open('short');
    // The two presses are told apart by their words: this one does not name a
    // number, because it does not have one until it rolls.
    click(pressed('TAKE THE SHORT REST'));
    expect(useApp.getState().log[0]!.detail).toContain('GM gains 2 Fear');
    expect(rng.calls, 'the rolling press did not roll').toEqual([4]);
  });

  /*
   * The two halves of "both switches off" are two cases on purpose. They share
   * a state and nothing else: one is about a field that must not be offered,
   * the other about a control that must not be drawn, and a single case
   * asserting both would go red for either mutant and credit the wrong half.
   */
  it('offers no field to type into when typed dice are off', () => {
    mount(hurt(), refusingRng);
    dice(false, false);
    open('short');
    expect(fields(), 'a field to type into with typed dice switched off').toEqual([]);
  });

  it('replaces the commit with the affordance\u2019s own sentence when both are off', () => {
    mount(hurt(), refusingRng);
    dice(false, false);
    open('short');
    expect(byText('TAKE THE SHORT REST')).toBeUndefined();
    // The affordance's own two lines, so a player who has read them under ROLL
    // does not have to learn a second phrasing here.
    expect(text()).toContain('NO DICE TURNED ON');
    expect(text()).toContain('TURN ON DIGITAL OR TYPED DICE IN SETTINGS');
    expect(useApp.getState().characters[0]!.hp.marked, 'a mark moved anyway').toBe(5);
  });

  it('keeps the whole rest on the screen while it refuses the dice', () => {
    mount(hurt(), refusingRng);
    dice(false, false);
    open('short');
    // Taking the roller away must not take the rest away: the moves, their
    // brackets and the free card swap are all still chosen when the switch
    // comes back, and the preview never needed a die in the first place.
    expect(moveRow('Tend to Wounds')).toBeDefined();
    click(pickable('Tend to Wounds'));
    expect(text()).toContain('Will clear');
    expect(maybe('Take Tend to Wounds out of move 1')).toBeDefined();
    expect(text()).toContain('Cards move free during this rest');
  });

  it('holds every target at the touch floor with the typed panel drawn', () => {
    const px = (value: string): number => {
      if (value === 'var(--tap)' || value === 'var(--control)') return 44;
      if (value === '') return 0;
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };
    mount(hurt(), refusingRng);
    dice(false, true);
    open('short');
    click(pickable('Tend to Wounds'));
    click(pickable('Repair Armor', 'second'));
    // Three fields, which is the most this surface ever asks for.
    expect(fields()).toHaveLength(3);
    const short = fields()
      .filter((f) => Math.max(px(f.style.height), px(f.style.minHeight)) < 44)
      .map((f) => f.getAttribute('aria-label') ?? '?');
    expect(short, 'these fields declare less than the 44px floor').toEqual([]);
    const wide = fields()
      .filter((f) => px(f.style.width) > 369)
      .map((f) => f.getAttribute('aria-label') ?? '?');
    expect(wide, 'these are wider than the 369px column at 393px').toEqual([]);
  });
});
