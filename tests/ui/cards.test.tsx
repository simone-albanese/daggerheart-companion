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

/**
 * P3-11. The card's only action was `className="t-meta"` with no background,
 * no border and `var(--muted)`, beside a readout at the other end of the same
 * row that was also `t-meta`, in `var(--dim)`. Two small grey capitals read as
 * a matched pair of labels rather than as a control and a number - and the
 * pair was RECALL and RECALL 2, the same word for an action and for its price.
 */
describe('the action on a card', () => {
  it('is drawn as a control, not as a second label', () => {
    const c = seed();
    browse(c);
    const card = index.cards.get(c.vault[0]!)!;
    const action = buttons().find(
      (b) => (b.getAttribute('aria-label') ?? '') === `Recall ${card.name} for ${card.recallCost} Stress`,
    );
    expect(action, 'no recall control on the card').toBeDefined();
    expect(action!.style.background, 'the action has no fill').not.toBe('');
    expect(action!.style.border, 'the action has no border').not.toBe('');
    expect(action!.style.minHeight).toBe('var(--control)');
  });

  it('does not print RECALL twice in one row, once as a verb and once as a price', () => {
    const c = seed();
    browse(c);
    const footers = [...container.querySelectorAll('.spread')]
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t.includes('RECALL'));
    for (const footer of footers) {
      expect(
        footer.match(/RECALL/g)?.length ?? 0,
        `"${footer}" says RECALL twice, and only one of them is the action`,
      ).toBeLessThan(2);
    }
    expect(container.textContent ?? '').toContain('COST');
  });

  it('does not call a free recall a downtime, in the middle of a scene', () => {
    /*
     * The log line used to read "Free during downtime" for any recall that
     * cost nothing, and this screen has no downtime in it: 31 of the 189 SRD
     * cards have a Recall Cost of 0, so a third of a vault wrote a sentence
     * about a rest that had not happened. Both surfaces now go through
     * `useRecall`, which says which of the two zeroes this was.
     */
    // In the character's own domains, because the browser opens on "mine".
    const domains = playedStats().domains;
    const free = dataset.domainCards.find(
      (k) => k.recallCost === 0 && domains.includes(k.domain),
    );
    expect(free, 'the fixture has no card in its domains with a Recall Cost of 0').toBeDefined();
    const c = seed({ vault: [free!.id] });
    browse(c);
    click(
      buttons().find(
        (b) => (b.getAttribute('aria-label') ?? '') === `Recall ${free!.name} for 0 Stress`,
      )!,
    );
    expect(useApp.getState().characters[0]!.loadout).toContain(free!.id);
    expect(useApp.getState().log[0]!.detail).toBe('This card costs nothing to recall');
  });

  it('says why instead of offering a dash, when there is nothing to offer', () => {
    // The browser opens on "my domains", so the cards a level 3 character
    // cannot take are the ones above their cap - reason already in hand.
    const c = seed();
    browse(c);
    expect(container.textContent ?? '', 'no card explains why it is out of reach').toMatch(
      /your cap in \w+ is \d/,
    );
    // and there is no disabled control pretending to be an action.
    const dead = buttons().filter((b) => b.disabled || (b.textContent ?? '').trim() === '—');
    expect(
      dead.map((b) => b.outerHTML.slice(0, 80)),
      'a control that looks live and does nothing is still on the card',
    ).toEqual([]);
  });
});

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
    expect(container.textContent ?? '').toContain('NO STRESS');
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

/**
 * The browser's own box, which it did not have.
 *
 * jsdom computes no layout, so nothing here measures anything: the numbers in
 * the source comment come from Chrome at 640x360 and belong to the harness.
 * What this file can prove is the declaration that decides the outcome - the
 * root's `overflow`, which was absent, so a grid laid outside the root's
 * padding box was painted over the tab bar instead of clipped.
 */
describe('the card browser draws inside its own box', () => {
  it('clips whatever it lays outside itself, instead of painting it over the tab bar', () => {
    const c = seed();
    browse(c);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.overflow, 'the browser root declares no overflow').toBe('hidden');
  });
});
