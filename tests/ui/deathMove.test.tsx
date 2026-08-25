// @vitest-environment jsdom
/**
 * The death move's dice, and who is allowed to roll them.
 *
 * `DeathMove.tsx` called `avoidDeath` and `riskItAll` with their defaulted
 * `cryptoRng` and read no preference at all, so a table that had switched the
 * roller off in Settings - or answered "Real dice, and the app stays out of
 * it" in Onboarding - still got a button that rolled a d12 for the one roll in
 * this game that cannot be taken back. The engine had no `fixed` either, so
 * there was nowhere to put the face of a die the table HAD rolled.
 *
 * Two things every case here is about. A result must never contain a number
 * the player did not enter, which is why the typed paths are handed an `Rng`
 * that throws and why `crypto.getRandomValues` is watched as well - a call site
 * that forgot to pass that `Rng` would still be rolling, quietly, through the
 * default. And a player must never be unable to record what their own die
 * showed, which is why the fields exist at all.
 *
 * AND THE SECOND DEATH MOVE OF THE EVENING, which is where the state is. There
 * is one way out of a chosen option short of closing the dialog, and everything
 * that option produced has to go through it.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@shared/types.ts';
import { DeathMoveOffer } from '../../src/ui/player/DeathMove.tsx';
import { rollAffordance } from '../../src/ui/shared/rollAffordance.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
/** Every call the app made to the real source of randomness, while mounted. */
let rolled: ReturnType<typeof vi.spyOn> | null;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: /min-width/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  rolled = vi.spyOn(globalThis.crypto, 'getRandomValues');
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  rolled = null;
});

/** A sheet with its last Hit Point marked, which is what owes a death move. */
function seed(digitalDice: boolean, manualDice: boolean): Character {
  const base = playedCharacter();
  const character = { ...base, hp: { ...base.hp, marked: base.hp.max } };
  act(() => {
    useApp.setState({
      ready: true,
      storageError: null,
      dataset,
      index,
      characters: [character],
      activeId: character.id,
      prefs: { ...DEFAULT_PREFS, digitalDice, manualDice },
      log: [],
      openCard: null,
    });
  });
  return character;
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const byText = (label: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim() === label);

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

const HOPE = 'The face your HOPE DIE showed';
const FEAR = 'The face your FEAR DIE showed';

/** Open the dialog and choose one of the three options by its SRD label. */
function opened(option: 'Avoid Death' | 'Risk It All' | 'Blaze of Glory'): void {
  click(pressed('Last Hit Point markedDEATH MOVE →'));
  const found = buttons().find((b) => (b.textContent ?? '').startsWith(option));
  expect(found, `no ${option} option in the dialog`).toBeDefined();
  click(found!);
}

const mount = (): void => {
  act(() => root.render(createElement(DeathMoveOffer)));
};

describe('with the roller on, which is the default', () => {
  it('offers the roll and asks for nothing', () => {
    seed(true, false);
    mount();
    opened('Avoid Death');
    expect(byText('Roll the Hope Die')).toBeDefined();
    expect(fields(), 'a field to type into with typed dice off').toEqual([]);
    click(pressed('Roll the Hope Die'));
    expect(text()).toContain('HOPE DIE');
    expect(rolled?.mock.calls.length, 'the app was asked to roll and did not').toBeGreaterThan(0);
  });
});

describe('with the roller off and typed dice on', () => {
  it('takes the Hope Die the table rolled, and rolls nothing itself', () => {
    seed(false, true);
    mount();
    opened('Avoid Death');
    expect(byText('Roll the Hope Die'), 'a roller on a device that was told not to').toBeUndefined();

    // One field, because one die is read: `AvoidDeathRoll` carries no Fear Die.
    expect(fields().map((f) => f.getAttribute('aria-label'))).toEqual([HOPE]);
    expect(pressed('Still to type: HOPE DIE').disabled).toBe(true);

    type(field(HOPE), '9');
    click(pressed('Record 9'));
    // Level 3 fixture: a 9 is above it, so no scar and no Hope slot at risk.
    expect(text()).toContain('9 is above your level. No scar.');
    expect(rolled?.mock.calls, 'the app rolled a die of its own').toEqual([]);
  });

  it('refuses a face a d12 cannot show', () => {
    seed(false, true);
    mount();
    opened('Avoid Death');
    type(field(HOPE), '13');
    expect(pressed('Still to type: HOPE DIE').disabled).toBe(true);
    type(field(HOPE), '12');
    expect(pressed('Record 12').disabled).toBe(false);
  });

  it('takes both faces of a Risk It All, and neither on its own', () => {
    seed(false, true);
    mount();
    opened('Risk It All');
    expect(fields().map((f) => f.getAttribute('aria-label'))).toEqual([HOPE, FEAR]);

    type(field(HOPE), '9');
    // Which die is higher IS the outcome, so half a 2d12 resolves nothing -
    // and recording it would leave the other die to `rollDuality`'s rng.
    expect(pressed('Still to type: FEAR DIE').disabled).toBe(true);

    type(field(FEAR), '4');
    click(pressed('Record 9 and 4'));
    expect(text()).toContain('The Hope Die is higher');
    expect(text()).toContain('clears 9');
    expect(rolled?.mock.calls, 'the app rolled a die of its own').toEqual([]);
  });

  it('starts the second death move of the evening from blank', () => {
    seed(false, true);
    mount();
    opened('Avoid Death');
    type(field(HOPE), '9');
    click(pressed('Record 9'));
    expect(text()).toContain('9 is above your level');

    // BACK is the only way out of an option short of closing the dialog, so a
    // face left standing there is a face the next move opens holding - with a
    // live record button, on the roll that crosses out a Hope slot.
    click(pressed('BACK'));
    opened('Risk It All');
    expect(field(HOPE).value, 'the Hope Die typed for Avoid Death came through').toBe('');
    expect(field(FEAR).value).toBe('');
    expect(pressed('Still to type: HOPE DIE · FEAR DIE').disabled).toBe(true);

    // And the same option twice in a row, which is the other way back in.
    click(pressed('BACK'));
    opened('Avoid Death');
    expect(field(HOPE).value).toBe('');
    expect(text(), 'the first move’s result is still on the screen').not.toContain(
      'is above your level',
    );
  });
});

describe('with both switches off', () => {
  it('says which switch is missing rather than greying out a roll', () => {
    seed(false, false);
    mount();
    opened('Avoid Death');
    expect(byText('Roll the Hope Die')).toBeUndefined();
    expect(fields()).toEqual([]);
    // The affordance's own two lines, the same ones the roll control shows.
    expect(text()).toContain('NO DICE TURNED ON');
    expect(text()).toContain('TURN ON DIGITAL OR TYPED DICE IN SETTINGS');
  });

  it('refuses the dice and not the move', () => {
    seed(false, false);
    mount();
    // Blaze of Glory rolls nothing at all, so nothing about it is the dice
    // switches' business and it still works end to end.
    opened('Blaze of Glory');
    click(pressed('Note it in the log'));
    expect(useApp.getState().log[0]!.label).toBe('Blaze of Glory');

    // And the two that do roll still carry the SRD's own text, so the option
    // can be read and taken at the table with the app standing aside.
    click(pressed('BACK'));
    opened('Risk It All');
    expect(text()).toContain('Risk It All');
    expect(text().length, 'the option was emptied rather than refused').toBeGreaterThan(200);
  });
});

describe('with both switches on', () => {
  it('offers both roads at once', () => {
    seed(true, true);
    mount();
    opened('Risk It All');
    expect(byText('Roll the Duality Dice')).toBeDefined();
    expect(fields().map((f) => f.getAttribute('aria-label'))).toEqual([HOPE, FEAR]);

    type(field(HOPE), '5');
    type(field(FEAR), '5');
    click(pressed('Record 5 and 5'));
    // Matching dice are their own outcome here, not the critical success the
    // same pair would be on an action roll.
    expect(text()).toContain('Matching results');
    expect(rolled?.mock.calls, 'the app rolled beside faces the table typed').toEqual([]);
  });
});

/**
 * WHICH ROADS ARE OPEN, AND WHAT HAPPENS TO THE OTHER ONE ONCE ONE IS TAKEN.
 *
 * Every case above opens a fresh dialog and looks at it once, so the only rule
 * they hold is what the switches draw on arrival. That left the whole of "both
 * roads at once" undefended on the surface that shipped it right: narrow the
 * roll button to a panel with nothing typed in it - the reading where the
 * first typed face takes the roller away - and the entire suite stayed green.
 *
 * So `rollAffordance` is read here rather than restated, the pair is asserted
 * together because closing either road is the same bug from a different side,
 * and each combination that can be typed into is looked at again afterwards.
 */
describe('which roads are open is the two switches’ answer, and stays it', () => {
  const roads = (): { roll: boolean; fields: string[] } => ({
    roll: byText('Roll the Duality Dice') !== undefined,
    fields: fields().map((f) => f.getAttribute('aria-label') ?? '?'),
  });

  it.each([
    [true, false],
    [false, true],
    [false, false],
    [true, true],
  ])('is the same before and after a face is typed, at %s and %s', (digital, manual) => {
    const want = rollAffordance(digital, manual);
    seed(digital, manual);
    mount();
    opened('Risk It All');

    const open = { roll: want.canRoll, fields: want.canType ? [HOPE, FEAR] : [] };
    expect(roads(), 'the dialog drew a road the switches did not open').toEqual(open);

    if (!want.canType) return;
    type(field(HOPE), '5');
    expect(roads(), 'one typed face changed which roads are open').toEqual(open);
    type(field(FEAR), '5');
    expect(roads(), 'a full set of typed faces changed which roads are open').toEqual(open);
  });

  it('rolls its own die when the roll road is taken past a face already typed', () => {
    seed(true, true);
    mount();
    opened('Avoid Death');
    // A press is one source for every die in the move. If the roll button read
    // the field beside it, `avoidDeath` would short-circuit on the typed Hope
    // Die and never reach for one - so the count of real draws is what says
    // which road this press went down, whatever the die then lands on.
    type(field(HOPE), '1');
    const before = rolled?.mock.calls.length ?? 0;
    click(pressed('Roll the Hope Die'));
    expect(
      (rolled?.mock.calls.length ?? 0) - before,
      'the roll button resolved out of the field instead of a die',
    ).toBeGreaterThan(0);
    expect(text()).toContain('HOPE DIE');
  });
});
