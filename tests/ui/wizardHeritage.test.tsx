// @vitest-environment jsdom
/**
 * Ancestry and community, which carry the same clip on longer text - and Mixed
 * Ancestry, which carried no text at all.
 *
 * The owner's decision named the class. The same control clipped three pickers
 * and blanked a fourth, and the two the decision did not name are the worse
 * pair: measured in Chrome at 375x667 before this change, an ancestry card hid
 * 111-285px and a community card 158-253px, against 95-158px on a class card -
 * longer text under a *tighter* clamp, two lines rather than three, across
 * eighteen cards and nine instead of nine. The SRD's own figures say the same
 * thing: 509-1243 characters per ancestry against 518-763 per class.
 *
 * Mixed Ancestry was not clipped, it was empty. The two mixed grids pass no
 * `body`, so one tap on the Segmented control took a player from two clipped
 * lines to zero words about either lineage. That is the surface this file
 * spends most of its assertions on, because it is the one nothing in the app
 * ever said out loud.
 *
 * These steps are not exported, so the wizard is driven to them the way a
 * person gets there - pick a class, Next, pick a subclass, Next - which also
 * means the assertions are about the real screen rather than a component
 * mounted with hand-made props. jsdom applies no CSS and computes no layout:
 * what the reader draws was measured in Chrome and written into the commit.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { Wizard } from '../../src/ui/build/Wizard.tsx';
import { dataset, index } from './fixture.ts';

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
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, dataset, index, characters: [], activeId: null });
  act(() => {
    root.render(createElement(Wizard, {}));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';
const heading = (): string => container.querySelector('h2')?.textContent ?? '';

/** Every reader on screen, in document order. */
const readers = (): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'),
];

/** The card a reader belongs to: the wrapper holding both of its targets. */
const cardOf = (reader: HTMLButtonElement): HTMLElement => {
  const card = reader.parentElement?.parentElement;
  if (card === null || card === undefined) throw new Error('the reader is not inside a card');
  return card;
};

const chooserIn = (card: HTMLElement): HTMLButtonElement => {
  const found = card.querySelector<HTMLButtonElement>('button[aria-pressed]');
  if (found === null) throw new Error('this card has nothing to choose with');
  return found;
};

const clickSaying = (label: string): void => {
  const found = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (found === undefined) throw new Error(`nothing on this screen is labelled "${label}"`);
  if (found.disabled) throw new Error(`"${label}" is refusing on this step`);
  act(() => found.click());
};

/** Pick the first thing offered on the step being stood on. */
const chooseFirst = (): void => {
  const found = container.querySelector<HTMLButtonElement>(
    'button[aria-pressed]:not([role="group"] button)',
  );
  if (found === null) throw new Error('this step offers nothing to choose');
  act(() => found.click());
};

/** Class, Next, subclass, Next - which is how a person reaches Ancestry. */
const toAncestry = (): void => {
  chooseFirst();
  clickSaying('Next');
  chooseFirst();
  clickSaying('Next');
};

const toCommunity = (): void => {
  toAncestry();
  act(() => chooserIn(cardOf(readers()[0]!)).click());
  clickSaying('Next');
};

describe('the eighteen ancestry cards', () => {
  beforeEach(toAncestry);

  it('arrives on the step this file is about', () => {
    expect(heading()).toContain('Ancestry');
  });

  it('gives every lineage a reader of its own, shut, named and stamped', () => {
    expect(readers()).toHaveLength(dataset.ancestries.length);
    for (const r of readers()) expect(r.getAttribute('aria-expanded')).toBe('false');
    for (const a of dataset.ancestries) {
      expect(text()).toContain(`About ${a.name}`);
      expect(text()).toContain(`SRD 1.0 · P.${String(a.sourcePage)}`);
    }
  });

  it('holds all eighteen descriptions back until one is asked for', () => {
    for (const a of dataset.ancestries) expect(text()).not.toContain(a.description.slice(-60));
  });

  it('opens one whole, in place, without choosing it', () => {
    const reader = readers()[0]!;
    const card = cardOf(reader);
    const chooser = chooserIn(card);
    const name = (reader.textContent ?? '').replace('About ', '').split('SRD')[0]?.trim();
    const ancestry = dataset.ancestries.find((a) => a.name === name);
    expect(ancestry).toBeDefined();

    act(() => reader.click());
    expect(reader.getAttribute('aria-expanded')).toBe('true');
    expect(card.querySelector('.t-read')?.textContent).toBe(ancestry?.description);
    expect(chooser.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(heading()).toContain('Ancestry');
  });
});

describe('Mixed Ancestry, which showed no words at all', () => {
  beforeEach(() => {
    toAncestry();
    clickSaying('Mixed Ancestry');
  });

  it('is the mode it says it is', () => {
    expect(text()).toContain('FIRST FEATURE FROM');
    expect(text()).toContain('SECOND FEATURE FROM');
  });

  it('gives both columns the reader the single-ancestry list has', () => {
    // Two grids of eighteen. Each card is its own decision - one lineage for
    // the first feature, one for the second - so each carries its own evidence
    // rather than sending the player back to the other mode to find it.
    expect(readers()).toHaveLength(dataset.ancestries.length * 2);
    for (const r of readers()) expect(r.getAttribute('aria-expanded')).toBe('false');
  });

  it('reads the same lineage from either column, and reads it whole', () => {
    const all = readers();
    const first = all[0]!;
    const second = all[dataset.ancestries.length]!;
    expect(first.textContent).toBe(second.textContent);

    act(() => first.click());
    expect(cardOf(first).querySelector('.t-read')).not.toBeNull();
    // Opening one column's card leaves the other column's shut: they are
    // separate decisions with separate state, not one control drawn twice.
    expect(second.getAttribute('aria-expanded')).toBe('false');

    act(() => second.click());
    expect(cardOf(second).querySelector('.t-read')?.textContent).toBe(
      cardOf(first).querySelector('.t-read')?.textContent,
    );
  });

  it('switching modes does not lose the words in either direction', () => {
    clickSaying('One ancestry');
    expect(readers()).toHaveLength(dataset.ancestries.length);
    clickSaying('Mixed Ancestry');
    expect(readers()).toHaveLength(dataset.ancestries.length * 2);
  });
});

describe('the nine community cards', () => {
  beforeEach(toCommunity);

  it('arrives on the step this file is about', () => {
    expect(heading()).toContain('Community');
  });

  it('gives every community a reader of its own, shut, named and stamped', () => {
    expect(readers()).toHaveLength(dataset.communities.length);
    for (const r of readers()) expect(r.getAttribute('aria-expanded')).toBe('false');
    for (const c of dataset.communities) {
      expect(text()).toContain(`About ${c.name}`);
      expect(text()).toContain(`SRD 1.0 · P.${String(c.sourcePage)}`);
    }
  });

  it('holds all nine descriptions back until one is asked for', () => {
    for (const c of dataset.communities) expect(text()).not.toContain(c.description.slice(-60));
  });

  it('opens one whole, in place, without choosing it', () => {
    const reader = readers()[0]!;
    const card = cardOf(reader);
    const name = (reader.textContent ?? '').replace('About ', '').split('SRD')[0]?.trim();
    const community = dataset.communities.find((c) => c.name === name);
    expect(community).toBeDefined();

    act(() => reader.click());
    expect(card.querySelector('.t-read')?.textContent).toBe(community?.description);
    expect(chooserIn(card).getAttribute('aria-pressed')).toBe('false');
    expect(heading()).toContain('Community');
  });
});

describe('the clamp, across the whole wizard', () => {
  it('is gone from every call site in this file, and only this file', () => {
    // Scoped to Wizard.tsx on purpose: `Choice` keeps the `clamp` prop and
    // `LevelUp.tsx` still passes it twice, so a repo-wide assertion would be a
    // false alarm about a screen this decision never covered. `body` stays too
    // - the potion cards pass it with no clamp and are two sentences long.
    const source = readFileSync('src/ui/build/Wizard.tsx', 'utf8');
    expect(source).not.toMatch(/clamp=\{\d+\}/);
    expect(readFileSync('src/ui/build/LevelUp.tsx', 'utf8')).toMatch(/clamp=\{\d+\}/);
  });
});
