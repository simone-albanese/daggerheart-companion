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

/*
 * The viewport the stub answers for. It used to be a regex that said yes to
 * `max-width: 719px` and `max-width: 1179px` and no to everything else, which
 * was enough while width was the only axis anything asked about. `useIsShort`
 * asks about height, and a stub that silently answers "no" to a query the
 * component branches on is a test suite that only ever sees one branch.
 */
const viewport = { w: 375, h: 667 };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  viewport.w = 375;
  viewport.h = 667;
  window.matchMedia = ((query: string) => {
    const w = /max-width:\s*(\d+)px/.exec(query);
    const h = /max-height:\s*(\d+)px/.exec(query);
    return {
      // A query about neither axis - `prefers-reduced-motion`, say - is not
      // this stub's business and is answered no rather than accidentally yes.
      matches:
        (w !== null || h !== null) &&
        (w === null || viewport.w <= Number(w[1])) &&
        (h === null || viewport.h <= Number(h[1])),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
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

  /*
   * The filters used to be a `flex: none` sibling of the grid, and the pixels
   * they took came off the grid at every scroll position rather than only at
   * the first: 278 of a 438px column at 320x568, 226 of a 230px one at
   * 640x360. Inside the scroll they are the grid's first row.
   *
   * jsdom has no layout engine, so none of those numbers is reachable here.
   * What is reachable is the tree they follow from: which element the filters
   * are inside, and whether they span the grid instead of taking one 150px
   * cell of it.
   */
  it('scrolls its filters with the cards they filter, instead of standing on them', () => {
    const c = seed();
    browse(c);
    const scroll = container.querySelector('.scroll');
    expect(scroll, 'the browser has no scroll region').not.toBeNull();
    const searchBox = container.querySelector('input[type="search"]');
    expect(searchBox, 'the browser has no search field').not.toBeNull();
    expect(
      searchBox!.closest('.scroll'),
      'the filters are outside the scroll region, so they cost the grid their height at every scroll position',
    ).toBe(scroll);
  });

  it('spans the filter row across the grid rather than dropping it in one cell', () => {
    const c = seed();
    browse(c);
    const scroll = container.querySelector('.scroll')!;
    const first = scroll.firstElementChild as HTMLElement;
    expect(first.contains(container.querySelector('input[type="search"]'))).toBe(true);
    expect(first.style.gridColumn, 'the filter row takes one card-sized cell').toBe('1 / -1');
  });

  it('leaves the root one child, so nothing else can be laid beside the scroll', () => {
    const c = seed();
    browse(c);
    const root = container.firstElementChild!;
    expect([...root.children].map((el) => el.className)).toEqual(['scroll']);
  });
});

/**
 * The filter block's two arrangements.
 *
 * Four rows of filters is 278px on a portrait phone, 226 at 640x360, 170 where
 * the first row fits on one line - out of a column that is 438 at 320x568, 230
 * at 640x360 and 306 at 852x393. Compact is search, a door and the readout:
 * 62px shut. jsdom has no layout engine, so none of those numbers is measured
 * here; what is measured is which controls are in the tree, which rows wrap
 * instead of scrolling sideways, and what the door says while it is shut.
 */
describe('the filters, on a screen that cannot afford four rows of them', () => {
  const named = (name: string): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.textContent ?? '').trim().startsWith(name));

  // `NumberFilter` renders a fragment and `FilterChip` is itself `.row chip`,
  // so the row a chip sits in is its parent and not its nearest `.row`.
  const rowOf = (label: string): HTMLElement => {
    const chip = buttons().find(
      (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label,
    );
    expect(chip, `no chip named "${label}"`).toBeDefined();
    return chip!.parentElement as HTMLElement;
  };

  it('folds the level, recall, domain and type filters behind one door on a phone', () => {
    const c = seed();
    browse(c);
    const door = named('FILTERS');
    expect(door, 'no FILTERS control on a phone').toBeDefined();
    expect(door!.getAttribute('aria-expanded')).toBe('false');
    expect(
      buttons().map((b) => b.getAttribute('aria-label') ?? ''),
      'a folded filter is still drawn while the door is shut',
    ).not.toContain('LV 3');
    // The search box is not behind the door: it is the head row.
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
  });

  it('opens onto every chip at once, with nothing left to scroll sideways for', () => {
    const c = seed();
    browse(c);
    click(named('FILTERS')!);
    const labels = buttons().map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels, 'the level filters are still not reachable').toContain('LV 3');
    expect(labels, 'the recall filters are still not reachable').toContain('RECALL 1');
    for (const row of [rowOf('LV 3'), rowOf('RECALL 1'), rowOf('My domains')]) {
      expect(row.style.flexWrap, 'a filter row still scrolls sideways instead of wrapping').toBe(
        'wrap',
      );
      expect(row.style.overflowX, 'a filter row keeps a hidden horizontal scroll').toBe('');
      expect(row.style.scrollbarWidth, 'a filter row still suppresses its scrollbar').toBe('');
    }
  });

  it('says how many filters are set while they are out of sight', () => {
    const c = seed();
    browse(c);
    click(named('FILTERS')!);
    click(buttons().find((b) => b.getAttribute('aria-label') === 'LV 3')!);
    click(named('FILTERS')!);
    const door = named('FILTERS')!;
    expect(door.getAttribute('aria-expanded')).toBe('false');
    expect(door.textContent, 'a shut door does not say a filter is on').toContain('1');
    expect(container.textContent ?? '').toContain('CLEAR FILTERS');
  });

  /*
   * Both sides of the band in one case, because only one of them can fail on
   * the pre-fix code: before the door existed there was no door to look for at
   * 1440x900 either, so the desktop half proves nothing on its own. It is here
   * as the boundary - a fold is the answer to a short column, not to a wide
   * screen with 813px of one - and it is asserted beside the half that does
   * fail, rather than in a case of its own that could never go red.
   */
  it('is short, not narrow: 852x393 is a tablet by width and still cannot afford them', () => {
    viewport.w = 1440;
    viewport.h = 900;
    const c = seed();
    browse(c);
    expect(named('FILTERS'), 'a desktop has to open a fold to reach a filter').toBeUndefined();
    const labels = buttons().map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels).toContain('LV 3');
    expect(labels).toContain('RECALL 1');

    act(() => root.unmount());
    root = createRoot(container);
    // 852x393 is in the tablet band by width and has 306px of column under the
    // header: 170px of filters is 56% of it.
    viewport.w = 852;
    viewport.h = 393;
    browse(c);
    expect(named('FILTERS'), 'a 393px-tall window still draws the full band').toBeDefined();
  });
});
