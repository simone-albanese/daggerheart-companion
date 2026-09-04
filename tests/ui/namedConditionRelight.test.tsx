// @vitest-environment jsdom
/**
 * A named state switched off on the phone can be switched back on.
 *
 * On the phone `Play` mounts the strip with `onlyWhenOn`, so it is drawn only
 * while something is on, and the chip in that strip was the ONLY control in
 * `src/` that called `toggleNamed`. Tap a lit "Cloaked" chip once and three
 * things happened at the same time: the state went `on: false`, the strip
 * returned null, and the door in the defence band read `Conditions: none`. The
 * dialog behind that door then listed the state by name and offered it an
 * input and REMOVE - and nothing that lit it again. The one route back was
 * REMOVE and re-type, which loses the label the player typed.
 *
 * `conditionsStore.ts` treats a named state toggled off for a scene as ordinary
 * use, and the dialog's own CLEAR ALL sentence names such a state as something
 * it destroys. A state the store keeps and the sheet cannot re-light is a
 * state stranded.
 *
 * The desktop was never affected: the cockpit's strip is permanent and an off
 * chip stays tappable there. jsdom computes no layout, so nothing here says
 * where the strip is; what it proves is that the dialog every layout can reach
 * carries the control, and that the phone's strip comes back once it is used.
 *
 * Every assertion under "in the dialog" fails on the pre-fix component: there
 * was no control naming the state other than REMOVE.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { useApp } from '../../src/store/state.ts';
import { ActiveConditions, ConditionsControl } from '../../src/ui/player/Conditions.tsx';
import {
  NO_CONDITIONS,
  useConditions,
  type Conditions,
} from '../../src/ui/player/conditionsStore.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let character: Character;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useConditions.setState({ byCharacter: {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The phone's two halves: the strip that hides, and the door that does not. */
function mountPhone(conditions: Partial<Conditions>): void {
  character = playedCharacter();
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  useConditions.setState({
    byCharacter: { [character.id]: { ...NO_CONDITIONS, ...conditions } },
  });
  act(() => {
    root.render(
      <>
        <ConditionsControl />
        <ActiveConditions onlyWhenOn />
      </>,
    );
  });
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const buttons = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('button')];

const name = (el: Element): string =>
  el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();

function byLabelStartingWith(prefix: string, within: ParentNode = container): HTMLElement {
  const found = [...within.querySelectorAll<HTMLElement>('button')].find((b) =>
    name(b).startsWith(prefix),
  );
  if (found === undefined) {
    throw new Error(
      `no control whose name starts with "${prefix}". On screen: ${buttons().map(name).join(' | ')}`,
    );
  }
  return found;
}

const dialog = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="dialog"]');
  if (el === null) throw new Error('nothing on screen carries role="dialog"');
  return el;
};

const strip = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[role="group"][aria-label="Active conditions"]');

const stored = (): Conditions => useConditions.getState().byCharacter[character.id] ?? NO_CONDITIONS;

const CLOAKED_OFF: Partial<Conditions> = { named: [{ id: 'n1', label: 'Cloaked', on: false }] };

describe('a named state switched off on the phone', () => {
  it('is drawn nowhere outside the dialog, which is the state this file is about', () => {
    mountPhone(CLOAKED_OFF);
    expect(strip()).toBeNull();
    expect(name(byLabelStartingWith('Conditions'))).toBe('Conditions: none');
  });

  describe('in the dialog', () => {
    it('has a control of its own that says it is off', () => {
      mountPhone(CLOAKED_OFF);
      click(byLabelStartingWith('Conditions'));
      const chip = byLabelStartingWith('Cloaked', dialog());
      expect(chip.getAttribute('aria-pressed')).toBe('false');
      // The control is the toggle, not REMOVE wearing the state's name.
      expect((chip.textContent ?? '').trim()).not.toBe('Remove');
    });

    it('switches back on with one tap, keeping the label the player typed', () => {
      mountPhone(CLOAKED_OFF);
      click(byLabelStartingWith('Conditions'));
      click(byLabelStartingWith('Cloaked', dialog()));
      expect(stored().named).toEqual([{ id: 'n1', label: 'Cloaked', on: true }]);
      expect(byLabelStartingWith('Cloaked', dialog()).getAttribute('aria-pressed')).toBe('true');
    });

    it('switches off again from the same control', () => {
      mountPhone({ named: [{ id: 'n1', label: 'Cloaked', on: true }] });
      click(byLabelStartingWith('Conditions'));
      click(byLabelStartingWith('Cloaked', dialog()));
      expect(stored().named[0]?.on).toBe(false);
    });

    it('keeps the input and REMOVE the row already had', () => {
      mountPhone(CLOAKED_OFF);
      click(byLabelStartingWith('Conditions'));
      const input = dialog().querySelector<HTMLInputElement>('input[aria-label="Name of this state"]');
      expect(input?.value).toBe('Cloaked');
      expect(buttons().some((b) => (b.textContent ?? '').trim() === 'Remove')).toBe(true);
    });
  });

  it('brings the strip and the door back once it is on again', () => {
    mountPhone(CLOAKED_OFF);
    click(byLabelStartingWith('Conditions'));
    click(byLabelStartingWith('Cloaked', dialog()));
    click(byLabelStartingWith('CLOSE', dialog()));
    expect(strip()).not.toBeNull();
    expect(name(byLabelStartingWith('Conditions'))).toBe('Conditions: Cloaked');
  });
});
