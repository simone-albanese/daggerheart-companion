// @vitest-environment jsdom
/**
 * The wizard's Experience step, after the paragraph somebody typed out of the
 * book was deleted from it.
 *
 * Two defects were in that paragraph and only one of them was about licensing.
 * It listed five example names out of the seventy-nine the SRD prints - a
 * transcription, in a `.tsx` file, of text that was already sitting in
 * `data/srd-1.0.json`. And it restated the rule about what an Experience may
 * not be *in the app's own words*, which is how a house rule gets written by
 * accident: the SRD's caution names two examples of "too broad" and two of
 * "game-breaking", and the paraphrase kept one of the four.
 *
 * So this asserts what is on the screen, not what the selector returns -
 * `srdReference.test.ts` has the selector. What matters here is that the SRD's
 * sentence reaches the glass, that the seventy-nine names are behind a fold
 * that starts shut, and that the fields the player types into did not move.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { emptyDraft } from '../../src/ui/build/creation.ts';
import { StepExperiences } from '../../src/ui/build/Wizard.tsx';
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
    root.render(
      createElement(StepExperiences, { draft: emptyDraft(), set: () => undefined }),
    );
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const fold = (): HTMLButtonElement => {
  const found = buttons().find((b) => b.getAttribute('aria-expanded') !== null);
  if (found === undefined) throw new Error('the Experience step has no examples fold');
  return found;
};

describe('what the step says an Experience is', () => {
  it('quotes the SRD instead of restating it', () => {
    expect(text()).toContain('a word or phrase used to encapsulate');
    expect(text()).toContain('two Experiences at character creation, each with a +2 modifier');
  });

  it('carries the caution whole, with all four of its worked examples', () => {
    // The paraphrase this replaced kept "Lucky" and dropped the other three,
    // so a player reading it learned the rule from one example out of four.
    expect(text()).toContain('"Lucky" and "Highly Skilled" are too broad');
    expect(text()).toContain('"Supersonic Flight" and "Invulnerable"');
  });
});

describe('the examples, behind a fold', () => {
  it('names the list and its page open and shut alike', () => {
    expect(fold().textContent).toContain('EXAMPLE EXPERIENCES');
    expect(fold().textContent).toContain('SRD 1.0 · P.4');
    act(() => fold().click());
    expect(fold().textContent).toContain('SRD 1.0 · P.4');
  });

  it('starts shut, and not one of the seventy-nine names is on the page until it opens', () => {
    expect(fold().getAttribute('aria-expanded')).toBe('false');
    // Probed on `textContent` and with names that are in no placeholder:
    // `ExperienceEditor`'s two fields carry `e.g. Fallen Monarch` and
    // `e.g. Never Again` as attributes, which are not content and stay.
    expect(text()).not.toContain('Stubborn to a Fault');
    expect(text()).not.toContain('Photographic Memory');

    act(() => fold().click());
    expect(fold().getAttribute('aria-expanded')).toBe('true');
    expect(text()).toContain('Stubborn to a Fault');
    expect(text()).toContain('Photographic Memory');
    for (const group of ['Backgrounds', 'Characteristics', 'Specialties', 'Skills', 'Phrases']) {
      expect(text(), group).toContain(group);
    }
  });

  it('is a 44px full-width header, and it is below the two fields', () => {
    const header = fold();
    expect(header.style.minHeight).toBe('var(--tap)');
    expect(header.style.width).toBe('100%');
    // Opening it must not push the inputs down under a thumb that is on them.
    const last = [...container.querySelectorAll('input')].pop()!;
    expect(last.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('the editor underneath is untouched', () => {
  it('still draws two rows, locked at +2', () => {
    const fields = [...container.querySelectorAll('input')];
    expect(fields.length).toBeGreaterThanOrEqual(2);
    expect(text()).toContain('+2');
  });

  it('keeps the two placeholders, which are the shape of an answer and not content', () => {
    const placeholders = [...container.querySelectorAll('input')].map((el) =>
      el.getAttribute('placeholder'),
    );
    expect(placeholders).toContain('e.g. Fallen Monarch');
    expect(placeholders).toContain('e.g. Never Again');
  });
});

describe('the hand-typed list is gone from the repository', () => {
  it('leaves no example name behind in Wizard.tsx', () => {
    // The same shape of guard `attribution.test.tsx` keeps over the licence
    // notice. This one fails on the pre-change tree: `Master of Disguise` was
    // on line 1307.
    const source = readFileSync(join(process.cwd(), 'src/ui/build/Wizard.tsx'), 'utf8');
    for (const name of ['Master of Disguise', 'Stubborn to a Fault', 'Deadly Aim']) {
      expect(source, `${name} is still typed into Wizard.tsx`).not.toContain(name);
    }
  });
});
