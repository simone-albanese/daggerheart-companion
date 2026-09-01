// @vitest-environment jsdom
/**
 * The domain chip strip on the card browser.
 *
 * Two properties, and they are separate on purpose because they fail
 * separately: WHICH domains get a chip, and in WHAT ORDER the chips come.
 *
 * The first is the one the SRD 2.0 work broke. `DOMAINS` gained `dread` while
 * the app still ships `data/srd-1.0.json`, and the strip mapped the constant -
 * so the shipped build drew a Dread chip whose only possible outcome was "No
 * cards match those filters." (Measured in Chrome on the running app at
 * 1440x900: the readout goes `42 OF 189` to `0 OF 189`.) The list has to come
 * from the dataset, exactly as `allLevels` and `allRecalls` already do.
 *
 * The second is what stops the fix from being made the obvious wrong way.
 * `dataset.domains` is the BOOK's order - SRD 2.0 prints Codex at folio 7 - and
 * the grid under this strip sorts its rows alphabetically, so mapping the
 * dataset raw would put the chips in one order over cards in another.
 *
 * jsdom computes no layout, so nothing here measures a pixel. The geometry
 * argument - 929.65px of chips at ten domains against 853.29 at nine, and what
 * every alternative to it costs - was measured in Chrome and is written down
 * over `domainsOnOffer` in `Cards.tsx`.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DOMAINS, DOMAINS_FOR_DISPLAY, type Character, type Dataset } from '@shared/types.ts';
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

/** Wide enough that the filters are not behind the compact door. */
const viewport = { w: 1440, h: 900 };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) => {
    const w = /max-width:\s*(\d+)px/.exec(query);
    const h = /max-height:\s*(\d+)px/.exec(query);
    return {
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

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const label = (b: Element): string => (b.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Seeds the store and renders the browser over whatever dataset is given. */
function browse(ds: Dataset = dataset): Character {
  const character = playedCharacter();
  useApp.setState({
    ready: true,
    storageError: null,
    dataset: ds,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  act(() => root.render(createElement(Cards, { stats: playedStats(character) })));
  return character;
}

/** The chips of the domain rail: its own row, less the two scope chips. */
const stripChips = (): string[] => {
  const mine = buttons().find((b) => label(b) === 'My domains');
  expect(mine, 'no "My domains" chip: the strip is not on the screen').toBeDefined();
  const row = mine!.parentElement as HTMLElement;
  return [...row.children].map((el) => label(el)).slice(2);
};

describe('the domain chip strip', () => {
  it('offers a chip for every domain the dataset prints, and for no other', () => {
    browse();
    const printed = dataset.domains.map((d) => d.id);
    /*
     * TEN now, and `dread` among them: this is the switch arriving. The check
     * this lane shipped said nine and refused `dread`, because SRD 1.0 printed
     * nine domains while `DOMAINS_FOR_DISPLAY` carried ten - the mismatch that
     * put a dead chip on the shipped build. SRD 2.0 opens the tenth, so the
     * strip and the constant now agree and the chip is live: 210 cards behind
     * it, and the geometry the lane measured (929.65px of chips against
     * 853.29) is what the app draws.
     */
    expect(printed.length, 'this fixture is meant to be the shipped ten-domain SRD').toBe(10);
    expect(printed, 'the shipped book opens dread, so the chip is not dead any more').toContain(
      'dread',
    );
    expect(stripChips().length, 'the strip is not one chip per domain in the dataset').toBe(
      printed.length,
    );
    for (const id of printed) {
      expect(stripChips(), `no chip for ${id}, which this dataset prints`).toContain(id);
    }
    for (const id of DOMAINS) {
      if (printed.includes(id)) continue;
      expect(
        stripChips(),
        `a chip for ${id}, which this dataset does not print: its only outcome is the empty state`,
      ).not.toContain(id);
    }
  });

  it('follows the book back down when a domain leaves the dataset', () => {
    /*
     * The same property, from the other side. This used to ADD SRD 2.0's tenth
     * domain to a nine-domain fixture and watch the strip grow; the shipped
     * book now prints all ten, so there is nothing left to add and the check
     * would have been asserting against a duplicate. Taking one away asks the
     * identical question - does the strip read the DATASET or the constant -
     * and it is the direction that still has an answer.
     */
    const withoutDread: Dataset = {
      ...dataset,
      domains: dataset.domains.filter((d) => d.id !== 'dread'),
    };
    browse(withoutDread);
    expect(stripChips(), 'the strip kept a chip the dataset stopped printing').not.toContain(
      'dread',
    );
    expect(stripChips().length, 'the strip is not nine chips over a nine-domain dataset').toBe(9);
    expect(DOMAINS, 'the constant still carries it, which is what makes this a test').toContain(
      'dread',
    );
  });

  it('orders the chips the way the grid under them is ordered, not the way the book prints them', () => {
    // `dataset.domains` in the order SRD 2.0's folios run, which is not
    // alphabetical: codex is at index 7 there. The chips must not follow it.
    const bookOrder: Dataset = {
      ...dataset,
      domains: [...dataset.domains].sort((a, b) => b.id.localeCompare(a.id)),
    };
    browse(bookOrder);
    const chips = stripChips();
    const wanted = DOMAINS_FOR_DISPLAY.filter((d) => chips.includes(d));
    expect(chips, 'the chips came out in the dataset order, not in display order').toEqual([
      ...wanted,
    ]);
    expect(
      [...chips].sort((a, b) => a.localeCompare(b)),
      'display order is meant to be the alphabetical one the card grid sorts by',
    ).toEqual(chips);
  });

  it('keeps the two scope chips ahead of the domains, at the tap-target floor', () => {
    browse();
    const mine = buttons().find((b) => label(b) === 'My domains')!;
    const row = mine.parentElement as HTMLElement;
    const kids = [...row.children] as HTMLElement[];
    expect(kids.map(label).slice(0, 2), 'the scope chips are not the head of the strip').toEqual([
      'My domains',
      'All',
    ]);
    for (const chip of kids) {
      expect(chip.style.minHeight, `${label(chip)} does not state the height floor`).toBe(
        'var(--control)',
      );
      expect(chip.style.minWidth, `${label(chip)} does not state the width floor`).toBe(
        'var(--control)',
      );
    }
  });

  it('never scrolls its chips off its own right edge', () => {
    browse();
    const row = buttons().find((b) => label(b) === 'My domains')!.parentElement as HTMLElement;
    expect(row.style.flexWrap, 'the strip stopped wrapping').toBe('wrap');
    expect(row.style.overflowX, 'the strip took a horizontal scroll back').toBe('');
    expect(row.style.scrollbarWidth, 'the strip hides a scrollbar again').toBe('');
  });
});
