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
  it('is in the part that scrolls, and never in the pinned block', () => {
    const c = seed();
    render(createElement(Play, { stats: playedStats(c) }));
    const rootEl = container.firstElementChild!;
    expect(rootEl.children).toHaveLength(2);
    expect(rootEl.children[0]!.textContent ?? '').toContain('Rest & downtime');
    expect(
      rootEl.children[1]!.textContent ?? '',
      'the rest is pinned under the thumb, where only the roll block belongs',
    ).not.toContain('Rest & downtime');
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
  it('moves a card in through the loadout’s own gate, at no Stress', () => {
    const base = playedCharacter();
    const c = seed({ stress: { marked: 0, max: base.stress.max } });
    const card = index.cards.get(c.vault[0]!)!;
    expect(card.recallCost, 'the fixture card is free anyway').toBeGreaterThan(0);

    mount(c);
    open('short');
    click(named(`Recall ${card.name} free during this rest`));

    const after = useApp.getState().characters[0]!;
    expect(after.loadout).toContain(card.id);
    expect(after.vault).not.toContain(card.id);
    expect(after.stress.marked, 'the rest charged the scene price').toBe(0);
    // And the log says which of the two zeroes this was.
    expect(useApp.getState().log[0]!.label).toBe(`Recalled ${card.name}`);
    expect(useApp.getState().log[0]!.detail).toBe('Free during this rest');
  });

  it('sends a card out to the vault, which was always free', () => {
    const c = seed();
    const card = index.cards.get(c.loadout[0]!)!;
    mount(c);
    open('short');
    click(named(`Move ${card.name} to vault, free during this rest`));
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).not.toContain(card.id);
    expect(after.vault).toContain(card.id);
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

  it('says how many cards it is not drawing rather than disagreeing with the gate', () => {
    const base = playedCharacter();
    seed({ loadout: [...base.loadout, 'card-from-a-newer-bundle'] });
    mount(useApp.getState().characters[0]!);
    open('short');
    expect(text()).toContain('4 / 5 HELD');
    expect(text()).toContain('1 MORE THIS BUILD CANNOT READ');
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
