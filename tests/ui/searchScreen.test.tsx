// @vitest-environment jsdom
/**
 * The search screen: that it reads the whole book, and offers nobody else's
 * questions.
 *
 * `tests/gm/ruleSearch.test.tsx` is thousands of lines about this same search,
 * and none of it covers this screen. That is not an oversight to be fixed by
 * pointing it at a second host: everything it pins - the 44px floors, the
 * field being last in the DOM, the landing-and-marking, the live count - is
 * asserted about `ShowSheet`'s bottom-anchored sheet geometry, and a
 * full-height screen is a different surface with different ergonomics.
 *
 * ## What this file is now, and what it was
 *
 * It was mostly about a scope. The screen opened narrowed to the open
 * character's own cards, features and gear, and one tap widened it; half the
 * assertions here were about what that scope kept out. **The owner removed
 * it,** so those are gone rather than adapted - a test kept alive past its
 * feature is how a repository ends up asserting something nobody ships.
 *
 * What survives is the property the removal was *for*, and it is asserted from
 * the other side: a word that lives anywhere in the book is reachable from
 * this screen, whoever is holding it, and an empty result means the book does
 * not carry the word.
 *
 * Nothing below carries the expected answer as a literal. Every query is
 * chosen by asking the shipped dataset for a word that satisfies the property
 * under test, and the assertions read what arrived on the glass and count it.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Search } from '../../src/ui/search/Search.tsx';
import { srdIndex } from '../../src/ui/shared/srdIndex.ts';
import { ASK_CATALOGUE } from '../../src/ui/shared/askCatalogue.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/**
 * A phone-shaped `matchMedia`, because `RuleSearchField` asks `useIsPhone`
 * whether to autofocus and jsdom ships no implementation at all.
 */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse|pointer:\s*coarse/.test(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) ||
        (min !== null && width >= Number(min[1])) ||
        (coarse && width < 1180),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const character = playedCharacter();
const records = srdIndex(dataset).filter((r) => r.kind !== 'rules');

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  setViewport(393);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Seed the store the way a booted app holds it. `withCharacter` is the fork. */
function seed(withCharacter: boolean): void {
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: withCharacter ? [character] : [],
    activeId: withCharacter ? character.id : null,
    log: [],
    openCard: null,
    prefs: { ...DEFAULT_PREFS },
  });
}

function mount(withCharacter = true): void {
  seed(withCharacter);
  act(() => root.render(createElement(Search)));
}

const field = (): HTMLInputElement => {
  const el = container.querySelector('input');
  if (el === null) throw new Error('the search screen drew no field');
  return el;
};

function type(text: string): void {
  act(() => {
    const input = field();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const recordNames = (): string[] =>
  [...container.querySelectorAll('section[data-kind] > button[aria-expanded]')].map((b) =>
    (b.querySelector('span.t-label')?.textContent ?? '').trim(),
  );

const sectionRows = (): Element[] => [
  ...container.querySelectorAll('section:not([data-ask]):not([data-kind]) > button[aria-expanded]'),
];

const askRows = (): Element[] => [...container.querySelectorAll('section[data-ask]')];

const spoken = (): string =>
  (container.querySelector('span.sr-only[role="status"]')?.textContent ?? '').trim();

const bodyText = (): string => (container.textContent ?? '').replace(/\s+/g, ' ');

describe('the search is global', () => {
  it('offers no control that would narrow it, with a character open or without', () => {
    /*
     * Asserted as an absence, and asserted twice, because the scope this
     * replaced was drawn *only* when a character was open. A test that looked
     * at the no-character case alone would have passed against the old screen
     * too and proved nothing about its removal.
     */
    for (const withCharacter of [true, false]) {
      mount(withCharacter);
      expect(
        container.querySelectorAll('[role="group"]'),
        `a grouped control survived with character=${String(withCharacter)}`,
      ).toHaveLength(0);
      expect(bodyText().toUpperCase()).not.toContain('WHAT I CARRY');
      expect(bodyText().toUpperCase()).not.toContain('THE WHOLE BOOK');
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('reaches a record no character in the fixture carries', () => {
    /*
     * An adversary, because no player sheet in this app can hold one - which
     * is exactly what the old narrow scope kept out. The word is taken from
     * the shipped dataset rather than remembered.
     */
    const stranger = records.find(
      (r) => r.kind === 'adversary' && r.name.split(/\s+/).at(-1)!.length > 5,
    )!;
    const word = stranger.name.split(/\s+/).at(-1)!.toLowerCase();

    mount();
    type(word);
    expect(
      recordNames().some((n) => n.toLowerCase().includes(word)),
      `${word} is an adversary and the search did not reach it`,
    ).toBe(true);
  });

  it('reaches the rules sections too, which a narrowed scope never did', () => {
    const section = dataset.rules.find((s) => s.title.split(/\s+/).length === 1)!;
    mount();
    type(section.title.toLowerCase());
    expect(sectionRows().length, `no section answered ${section.title}`).toBeGreaterThan(0);
  });

  it('says the book when it finds nothing, because the book is what it read', () => {
    mount();
    type('velocipede');
    expect(bodyText()).toContain('Nothing in this dataset carries that');
    const said = spoken().toLowerCase();
    expect(said, 'the live sentence stopped counting sections').toContain('section');
    // The wordings the scope needed are gone with it, and must not come back
    // by accident: this screen never speaks about one sheet.
    expect(said).not.toContain('carrying');
  });

  it('counts the whole index in the field, not the sections alone', () => {
    // The placeholder used to say `69 rules sections` on a field that has
    // driven the 780 records since the index landed. Here it is the index's
    // own length, so a homebrew layer moves it.
    mount();
    expect(field().getAttribute('placeholder')).toBe(
      `Search ${String(srdIndex(dataset).length)} entries in the book`,
    );
  });
});

describe('the questions are the GM’s, and this screen does not offer them', () => {
  /*
   * Ten of the twelve catalogue entries are written in the GM's voice - "What
   * do I do?", "How do I run a chase?" - about players in the third person.
   * They belong to the sheet the GM is working on. The query is taken from a
   * real entry so the band would certainly have drawn had it been offered.
   */
  const entry = ASK_CATALOGUE[0]!;
  const word = entry.ask
    .split(/\s+/)
    .find((w) => w.length > 5)!
    .toLowerCase()
    .replace(/\W/g, '');

  it('draws no QUESTIONS band', () => {
    mount();
    type(word);
    expect(askRows(), 'the GM’s questions were offered to a player').toHaveLength(0);
    expect(bodyText()).not.toContain('QUESTIONS');
  });
});

describe('the controls sit where a thumb is', () => {
  it('puts the field after the results in the DOM, and on the 44px floor', () => {
    mount();
    type('a');
    const input = field();
    expect(input.style.minHeight, 'the field is under the tap floor').toBe('44px');

    const scroll = container.querySelector('.scroll');
    expect(scroll, 'the results have no scrolling ancestor to land in').not.toBeNull();
    expect(
      scroll!.contains(input),
      'the field scrolls away with the results it is answering',
    ).toBe(false);
    expect(
      scroll!.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the field is drawn before the results',
    ).toBeTruthy();
  });

  it('ends its own scroll with the licence notice', () => {
    // `attribution.test.tsx` sweeps this for every surface; asserted here too
    // because the notice is the one thing on this screen that is not optional.
    mount();
    const scroll = container.querySelector('.scroll')!;
    expect((scroll.lastElementChild?.textContent ?? '').length).toBeGreaterThan(0);
    expect(bodyText()).toContain('Daggerheart');
  });
});
