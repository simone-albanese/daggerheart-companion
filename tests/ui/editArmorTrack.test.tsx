// @vitest-environment jsdom
/**
 * The Armor track follows the off-hand.
 *
 * `deriveStats` prices a shield's Armor Score bonus (Tower Shield, Barrier: +2,
 * folio 66) and the Build header reads that number live. The Play screen's
 * ARMOR counter and the damage calculator do not: they read the STORED
 * `armorSlots.max`, which only `syncCounters` rewrites. The Edit sheet ran it
 * after an armor pick and never after a weapon pick, so a character who took
 * a Tower Shield from the sheet had a header saying ARMOR SCORE 5 and a track
 * that still stopped at 3 - and one who put it down kept two phantom slots.
 *
 * Mounted against the real SRD, because the modifier register is keyed on the
 * shipped weapon ids and a synthetic shield would exercise nothing.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { deriveStats, syncCounters } from '@engine/character.ts';
import { useApp } from '../../src/store/state.ts';
import { Edit } from '../../src/ui/build/Edit.tsx';
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
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
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
});

const stored = (): Character => useApp.getState().characters[0]!;
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const press = (label: string, b: HTMLButtonElement | undefined): void => {
  expect(b, `no ${label} on the sheet`).toBeDefined();
  expect(b!.disabled, `${label} is on the page but refuses the press`).toBe(false);
  act(() => b!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

/** The slot's own button - the one that opens the picker - by its label. */
function slot(label: string): HTMLButtonElement | undefined {
  const heading = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  return heading?.parentElement?.querySelector('button') ?? undefined;
}

/** The picker row for a weapon, by its name - not a chip and not a slot. */
const row = (name: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim().startsWith(name));

/** A synced level 3 sheet with nothing in the off-hand. */
function mount(over: Partial<Character> = {}): Character {
  const bare = { ...playedCharacter(), activeSecondaryWeapon: null, ...over };
  const character = syncCounters(bare, deriveStats(bare, dataset, index));
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  act(() => {
    root.render(
      createElement(Edit, { stats: deriveStats(character, dataset, index), onLevelUp: () => {} }),
    );
  });
  return character;
}

describe('the Armor track after a weapon pick on the sheet', () => {
  it('starts in step: the fixture is synced', () => {
    const c = mount();
    expect(c.armorSlots.max).toBe(deriveStats(c, dataset, index).armorScore);
  });

  it('grows by the shield the moment a Tower Shield is equipped (B5-1, folio 66)', () => {
    const before = mount();
    press('the Secondary weapon slot', slot('Secondary weapon'));
    press('the Tower Shield row', row('Tower Shield'));

    const after = stored();
    expect(after.activeSecondaryWeapon).toBe('tower-shield');
    const derived = deriveStats(after, dataset, index).armorScore;
    expect(derived, 'the register no longer prices Barrier').toBe(before.armorSlots.max + 2);
    expect(
      after.armorSlots.max,
      'the Build header reads the shield and the Play track does not',
    ).toBe(derived);
  });

  it('shrinks again when the shield is put down from the slot', () => {
    mount();
    press('the Secondary weapon slot', slot('Secondary weapon'));
    press('the Tower Shield row', row('Tower Shield'));
    const armed = stored();
    expect(armed.armorSlots.max).toBe(deriveStats(armed, dataset, index).armorScore);

    press(
      'the off-hand ✕',
      buttons().find((b) => b.getAttribute('aria-label') === 'Clear Secondary weapon'),
    );
    const bare = stored();
    expect(bare.activeSecondaryWeapon).toBeNull();
    expect(
      bare.armorSlots.max,
      'two phantom armor slots survive the shield being put down',
    ).toBe(deriveStats(bare, dataset, index).armorScore);
  });

  it('follows a primary weapon pick too, because a Labrys Axe is Protective', () => {
    // Level 5: the axe is tier 3, and the picker refuses it below that.
    const before = mount({ level: 5 });
    press('the Primary weapon slot', slot('Primary weapon'));
    press('the Labrys Axe row', row('Labrys Axe'));

    const after = stored();
    expect(after.activePrimaryWeapon).toBe('labrys-axe');
    expect(deriveStats(after, dataset, index).armorScore).toBe(before.armorSlots.max + 1);
    expect(after.armorSlots.max).toBe(deriveStats(after, dataset, index).armorScore);
  });
});
