// @vitest-environment jsdom
/**
 * Opening a class description, on the screen it opens on.
 *
 * The decision this is built to was "the class description opens in place in
 * the wizard", and three words in that sentence are assertions: *opens* (there
 * is a control, and it starts shut), *in place* (same screen, same step, no
 * dialog, nothing above it moves), and *the description* (all of it, including
 * the end of the sentence the three-line clamp used to eat).
 *
 * jsdom applies no CSS, so the whole description was already in `textContent`
 * before this change - the clamp was a `-webkit-line-clamp` over complete
 * markup. That is exactly why presence of the text cannot be the claim here.
 * What carries it is the second control: pre-fix there is no button labelled
 * "About Wizard" anywhere on this screen, so every lookup below throws.
 *
 * jsdom also computes no layout, so nothing here measures. The two targets'
 * sizes are declarations - `var(--tap)` and `width: 100%` - and what they draw
 * was measured in Chrome and written into the commit message.
 */
import 'fake-indexeddb/auto';
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

const klass = dataset.classes.find((c) => c.id === 'wizard');
if (klass === undefined) throw new Error('the shipped SRD has no Wizard class');

const text = (): string => container.textContent ?? '';

/** The reader on one class's card, by the name the header gives it. */
const readerFor = (name: string): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-expanded') !== null && (b.textContent ?? '').includes(`About ${name}`),
  );
  if (found === undefined) throw new Error(`no class card on this screen offers to read about ${name}`);
  return found;
};

/** The card that reader belongs to: the wrapper holding both of its targets. */
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

describe('the description a class card is chosen on', () => {
  it('starts shut, with the end of the paragraph nowhere on the page', () => {
    const reader = readerFor(klass.name);
    expect(reader.getAttribute('aria-expanded')).toBe('false');
    // The last 60 characters: the end of the sentence the clamp used to cut.
    expect(text()).not.toContain(klass.description.slice(-60));
  });

  it('opens in place, whole, at reading size', () => {
    const reader = readerFor(klass.name);
    act(() => reader.click());

    expect(reader.getAttribute('aria-expanded')).toBe('true');
    expect(text()).toContain(klass.description.slice(-60));
    expect(text()).toContain(klass.description.slice(0, 60));

    // `.t-dense` is 11.5px and tokens.css calls it a glance size, in an
    // explicit contrast with `.t-read` - "prose someone is reading in order to
    // decide something". Choosing a class is that job.
    const prose = cardOf(reader).querySelector('.t-read');
    expect(prose?.textContent).toBe(klass.description);
  });

  it('is not a dialog and is not another screen', () => {
    const reader = readerFor(klass.name);
    act(() => reader.click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    // Still step 1 of the wizard, still the class step, still refusing Next
    // for the same reason: opening a description decided nothing.
    expect(container.querySelector('h2')?.textContent).toContain('Name & class');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Choose a class.');
  });

  it('is a second target beside the choice and never inside it', () => {
    // `Choice`'s root is a `<button>`, so a reader nested in it would be a
    // button inside a button - invalid HTML this repo has already shipped
    // twice. Siblings also mean a tap can only ever mean one of the two.
    const reader = readerFor(klass.name);
    const card = cardOf(reader);
    const chooser = chooserIn(card);

    expect(chooser.contains(reader)).toBe(false);
    expect(reader.contains(chooser)).toBe(false);
    expect(card.querySelectorAll('button')).toHaveLength(2);

    // Both are declared at the touch floor and the full width of the column.
    // jsdom computes no layout; these are the declarations, and what they draw
    // was measured in Chrome.
    expect(chooser.style.minHeight).toBe('var(--tap)');
    expect(chooser.style.width).toBe('100%');
    expect(reader.style.minHeight).toBe('var(--tap)');
    expect(reader.style.width).toBe('100%');
  });

  it('reads without choosing, and chooses without shutting', () => {
    const reader = readerFor(klass.name);
    const chooser = chooserIn(cardOf(reader));

    act(() => reader.click());
    expect(reader.getAttribute('aria-expanded')).toBe('true');
    expect(chooser.getAttribute('aria-pressed')).toBe('false');

    act(() => chooser.click());
    expect(chooser.getAttribute('aria-pressed')).toBe('true');
    // The fold is a sibling with its own state, so picking the class does not
    // take the paragraph away from the person who was still reading it.
    expect(readerFor(klass.name).getAttribute('aria-expanded')).toBe('true');
  });

  it('opens one card without opening the other eight', () => {
    act(() => readerFor(klass.name).click());
    const open = [...container.querySelectorAll('button[aria-expanded="true"]')];
    expect(open).toHaveLength(1);
    for (const c of dataset.classes) {
      if (c.id === klass.id) continue;
      expect(text()).not.toContain(c.description.slice(-60));
    }
  });
});
