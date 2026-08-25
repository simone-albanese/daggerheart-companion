// @vitest-environment jsdom
/**
 * A typed face that is not a face, on the roll that cannot be taken back.
 *
 * `deathMove.test.tsx` covers who is allowed to roll and what is recorded. This
 * covers the state between the two: a field that has been typed into and holds
 * something no d12 shows.
 *
 * Two mutants are the reason it exists, and they are two rather than one on
 * purpose - the same line carries both bounds, and a case that went red for
 * either would credit the wrong half. `isFace` (`DeathMove.tsx:92`) reads
 * `Number(value) >= 1 && Number(value) <= D12`, and the whole suite stayed
 * green with the lower bound moved to `>= 0`: a 0 is not a face any die in this
 * game can show, and it would have gone into `avoidDeath` as the die the player
 * rolled. So one case types a 0 and one types a 13, and neither can die of the
 * other's mutant.
 *
 * And a third thing, which is what a player actually sees. A blank field
 * explains itself; a field holding 13 does not, because something has been
 * typed and the app has silently declined it. The sentence is asserted with
 * its numbers here rather than by its shape.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '@shared/types.ts';
import { DeathMoveOffer } from '../../src/ui/player/DeathMove.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
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

describe('a face no d12 can show', () => {
  it('refuses a 0 at the bottom of the die', () => {
    seed(false, true);
    mount();
    opened('Avoid Death');
    type(field(HOPE), '0');
    // A die that showed 0 is not a die anybody rolled, and `avoidDeath` would
    // take the 0 and compare it against a level.
    expect(byText('Record 0'), 'a d12 does not show 0').toBeUndefined();
    expect(pressed('Still to type: HOPE DIE').disabled).toBe(true);
    expect(text()).toContain('A d12 shows 1 to 12, and your HOPE DIE says 0.');
    expect(text()).toContain('Correct it and the roll is yours to record.');

    type(field(HOPE), '1');
    expect(text(), 'the sentence outlived the number it was about').not.toContain(
      'A d12 shows 1 to 12',
    );
    expect(pressed('Record 1').disabled).toBe(false);
  });

  it('refuses a 13 at the top of it, and says what the die can show', () => {
    seed(false, true);
    mount();
    opened('Avoid Death');
    type(field(HOPE), '13');
    expect(byText('Record 13')).toBeUndefined();
    expect(pressed('Still to type: HOPE DIE').disabled).toBe(true);
    expect(text()).toContain('A d12 shows 1 to 12, and your HOPE DIE says 13.');

    type(field(HOPE), '12');
    expect(pressed('Record 12').disabled).toBe(false);
  });

  it('says nothing at all about a field nobody has typed into', () => {
    seed(false, true);
    mount();
    opened('Risk It All');
    // Two blank fields explain themselves: the button says which dice it is
    // waiting for, and a sentence about a number that is not there would be
    // the app answering a question nobody asked.
    expect(pressed('Still to type: HOPE DIE · FEAR DIE').disabled).toBe(true);
    expect(text()).not.toContain('A d12 shows 1 to 12');
  });
});
