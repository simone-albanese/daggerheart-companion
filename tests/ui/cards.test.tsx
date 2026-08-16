// @vitest-environment jsdom
/**
 * The card browser, which is the other place a card can be recalled from.
 *
 * Whatever the Play screen does about a recall that would be paid in Hit
 * Points, this screen has to do too: two surfaces disagreeing about what a tap
 * costs is worse than either of them being wrong on its own, because the
 * player learns one of them and uses the other.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { Cards } from '../../src/ui/player/Cards.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) =>
    ({
      matches: /max-width:\s*(719|1179)px/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
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
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

function seed(patch: Partial<Character> = {}): Character {
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

const browse = (c: Character): void => {
  render(createElement(Cards, { stats: playedStats(c) }));
};

describe('a recall from the card browser that would cost Hit Points', () => {
  function onTheEdge(): Character {
    const base = playedCharacter();
    return seed({
      stress: { marked: base.stress.max, max: base.stress.max },
      hp: { marked: base.hp.max - 1, max: base.hp.max },
    });
  }

  it('warns in the footer instead of in the log afterwards', () => {
    const c = onTheEdge();
    browse(c);
    const card = index.cards.get(c.vault[0]!)!;
    const action = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Recall ${card.name} - no Stress left`),
    );
    expect(action, `nothing warns about the HP cost of recalling ${card.name}`).toBeDefined();
    expect(container.textContent ?? '').toContain('NO STRESS LEFT');
  });

  it('needs a second, informed tap', () => {
    const c = onTheEdge();
    browse(c);
    const card = index.cards.get(c.vault[0]!)!;
    const find = (prefix: string): HTMLButtonElement => {
      const found = buttons().find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(prefix),
      );
      expect(found, `no control whose name starts "${prefix}"`).toBeDefined();
      return found!;
    };

    const before = useApp.getState().characters[0]!;
    click(find(`Recall ${card.name} - no Stress left`));
    expect(useApp.getState().characters[0]!.hp.marked, 'one tap spent a Hit Point').toBe(
      before.hp.marked,
    );

    const armed = find(`Confirm: recall ${card.name}`);
    expect(armed.textContent).toContain('MARK 1 HP?');

    click(armed);
    expect(useApp.getState().characters[0]!.loadout).toContain(card.id);
    expect(useApp.getState().characters[0]!.hp.marked).toBe(before.hp.marked + 1);
  });

  it('leaves a recall the Stress can pay for as one tap', () => {
    const c = seed();
    browse(c);
    const card = index.cards.get(c.vault[0]!)!;
    const armed = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Recall ${card.name} - no Stress left`),
    );
    expect(armed, 'an affordable recall was flagged as costing HP').toBeUndefined();
  });
});
