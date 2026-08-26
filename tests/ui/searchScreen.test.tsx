// @vitest-environment jsdom
/**
 * The search screen: the door, and the scope that is the point of it.
 *
 * `tests/gm/ruleSearch.test.tsx` is 2452 lines about this same search, and
 * none of it covers this screen. That is not an oversight to be fixed by
 * pointing it at a second host: everything it pins - the 44px floors, the
 * field being last in the DOM, the landing-and-marking, the live count - is
 * asserted about `ShowSheet`'s bottom-anchored sheet geometry, and a
 * full-height screen is a different surface with different ergonomics. What
 * this file adds is what is *new* here, which is the scope.
 *
 * ## Nothing below carries the expected answer as a literal
 *
 * The rule this repo keeps re-learning is that a test which spells out the
 * answer confirms whatever the code does next. So every expectation here is
 * computed from the shipped dataset and the fixture character at run time, and
 * the assertions read what arrived on the glass and count it. The queries are
 * *chosen* by asking the dataset for a word that satisfies the property under
 * test - a name no player carries, a name this player does carry - rather than
 * typed in from memory. A dataset regeneration that moved every id would
 * change which words these tests use and not what they prove.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { holdingsOf } from '../../src/engine/holdings.ts';
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
const stats = deriveStats(character, dataset, index);
const held = holdingsOf(character, stats);
const records = srdIndex(dataset).filter((r) => r.kind !== 'rules');
/** The records this character actually carries, as the screen computes them. */
const carried = records.filter((r) => held.has(r.id));

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

/** The scope chips, as the words on them and whether each is pressed. */
const chips = (): Array<{ label: string; on: boolean }> =>
  [...container.querySelectorAll('[role="group"][aria-label="How much to search"] button')].map(
    (b) => ({
      label: (b.textContent ?? '').trim(),
      on: b.getAttribute('aria-pressed') === 'true',
    }),
  );

const press = (label: string): void => {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
  ].find((b) => (b.textContent ?? '').trim() === label);
  if (button === undefined) throw new Error(`no chip called ${label}`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** Rows for records, which carry their kind on the section. */
const recordNames = (): string[] =>
  [...container.querySelectorAll('section[data-kind] > button[aria-expanded]')].map((b) =>
    (b.querySelector('span.t-label')?.textContent ?? '').trim(),
  );

/** Rows for rules sections, which are the ones with neither marker. */
const sectionRows = (): Element[] => [
  ...container.querySelectorAll(
    'section:not([data-ask]):not([data-kind]) > button[aria-expanded]',
  ),
];

const askRows = (): Element[] => [...container.querySelectorAll('section[data-ask]')];

/** The one sentence on this surface that speaks. */
const spoken = (): string =>
  (container.querySelector('span.sr-only[role="status"]')?.textContent ?? '').trim();

const bodyText = (): string => (container.textContent ?? '').replace(/\s+/g, ' ');

describe('the scope this screen opens on', () => {
  it('starts narrowed to the character, and says so on the chip that is pressed', () => {
    mount();
    const drawn = chips();
    expect(drawn, 'the scope control was not drawn with a character open').toHaveLength(2);
    const pressed = drawn.filter((c) => c.on);
    expect(pressed, 'exactly one scope is current').toHaveLength(1);
    // The word is read off the glass rather than asserted as a string: what
    // this pins is that the pressed one is the narrow one, whatever it says.
    expect(pressed[0]!.label).toBe(chips()[0]!.label);
    expect(drawn[0]!.on, 'the screen did not open narrowed').toBe(true);
  });

  it('opens on the whole book with no character, and draws no scope control at all', () => {
    mount(false);
    expect(chips(), 'a control offering to narrow to nobody').toHaveLength(0);

    // And it is the wide scope, not an empty one: a rules section is reachable,
    // which the narrow scope never allows.
    const section = dataset.rules[0]!;
    type(section.title.split(/\s+/)[0]!.toLowerCase());
    expect(
      sectionRows().length + recordNames().length,
      'the no-character screen found nothing at all',
    ).toBeGreaterThan(0);
  });
});

describe('what the narrow scope keeps out, and lets in', () => {
  /*
   * The query is chosen by asking the dataset for a record whose name is one
   * distinctive word that this character does NOT hold and no other record
   * shares - an adversary, because no player sheet in this app can carry one.
   * Picking it here rather than typing a remembered name is what keeps this
   * test about the scope instead of about the bestiary.
   */
  const stranger = records.find((r) => {
    if (r.kind !== 'adversary' || held.has(r.id)) return false;
    const word = r.name.split(/\s+/).at(-1)!.toLowerCase();
    return word.length > 5 && !carried.some((c) => c.name.toLowerCase().includes(word));
  })!;
  const strangerWord = stranger.name.split(/\s+/).at(-1)!.toLowerCase();

  it('finds nothing a player does not carry, and the same word wide finds it', () => {
    mount();
    type(strangerWord);
    expect(
      recordNames(),
      `${strangerWord} is an adversary; no character carries one`,
    ).toHaveLength(0);

    press(chips()[1]!.label);
    const wide = recordNames();
    expect(wide.length, 'widening found nothing, so the narrowing proved nothing').toBeGreaterThan(
      0,
    );
    expect(
      wide.some((n) => n.toLowerCase().includes(strangerWord)),
      'the widened list does not contain the thing that was hidden',
    ).toBe(true);
  });

  it('finds what this character does carry, narrowed', () => {
    // Something in the loadout, resolved through the same walk the screen uses.
    const mine = carried.find((r) => r.kind === 'domainCard' && r.name.split(/\s+/).length <= 3)!;
    const word = mine.name.split(/\s+/)[0]!.toLowerCase();

    mount();
    type(word);
    expect(
      recordNames().some((n) => n === mine.name),
      `${mine.name} is in this character's own cards and the narrow scope missed it`,
    ).toBe(true);
  });

  it('never offers a rules section while narrowed, because nobody holds one', () => {
    // A word from a section title, which the wide scope certainly answers.
    const section = dataset.rules.find((s) => s.title.split(/\s+/).length === 1)!;
    const word = section.title.toLowerCase();

    mount();
    type(word);
    expect(sectionRows(), 'a section arrived in a scope narrowed to a person').toHaveLength(0);

    press(chips()[1]!.label);
    expect(
      sectionRows().length,
      'the wide scope did not answer with a section either, so this proves nothing',
    ).toBeGreaterThan(0);
  });
});

describe('what the screen says about what it looked in', () => {
  it('never claims the book when it only read one sheet', () => {
    mount();
    const stranger = records.find((r) => r.kind === 'adversary' && !held.has(r.id))!;
    type(stranger.name.split(/\s+/).at(-1)!.toLowerCase());

    const said = spoken().toLowerCase();
    expect(said, 'the live sentence said nothing').not.toBe('');
    expect(
      said.includes('in the book'),
      `the narrowed screen told a player the book does not carry it: "${spoken()}"`,
    ).toBe(false);
    expect(
      said.includes('section'),
      `the narrowed screen counted sections it never searched: "${spoken()}"`,
    ).toBe(false);
    expect(said).toContain('carrying');
  });

  it('says the empty answer is about the sheet, and names the way out of it', () => {
    mount();
    const stranger = records.find((r) => r.kind === 'adversary' && !held.has(r.id))!;
    type(stranger.name.split(/\s+/).at(-1)!.toLowerCase());

    const text = bodyText();
    expect(
      text.includes('not the whole book'),
      'the empty state did not say which shelf it read',
    ).toBe(true);
    // The widening is named, and the control it names is on the glass.
    const widen = chips()[1]!.label;
    expect(text.toUpperCase()).toContain(widen);
  });

  it('goes back to the book’s own words when widened', () => {
    mount();
    press(chips()[1]!.label);
    const nowhere = 'velocipede';
    type(nowhere);
    const said = spoken().toLowerCase();
    expect(said, 'the wide scope stopped counting sections').toContain('section');
    expect(bodyText()).toContain('Nothing in this dataset carries that');
  });
});

describe('the questions are the GM’s, and this screen does not offer them', () => {
  /*
   * Ten of the twelve catalogue entries are written in the GM's voice - "What
   * do I do?", "How do I run a chase?" - about players in the third person.
   * They belong to the sheet the GM is working on, and this screen is the
   * player's. The query is taken from a real entry so the band would certainly
   * have drawn had it been offered.
   */
  const entry = ASK_CATALOGUE[0]!;
  const word = entry.ask.split(/\s+/).find((w) => w.length > 5)!.toLowerCase().replace(/\W/g, '');

  it('draws no QUESTIONS band at either width', () => {
    mount();
    type(word);
    expect(askRows(), 'the GM’s questions were offered to a player, narrowed').toHaveLength(0);
    expect(bodyText()).not.toContain('QUESTIONS');

    press(chips()[1]!.label);
    expect(askRows(), 'the GM’s questions were offered to a player, widened').toHaveLength(0);
    expect(bodyText()).not.toContain('QUESTIONS');
  });
});

describe('the controls sit where a thumb is', () => {
  it('puts the field after the results in the DOM, and on the 44px floor', () => {
    mount();
    type('a');
    const input = field();
    expect(input.style.minHeight, 'the field is under the tap floor').toBe('44px');

    // The scroll holds the answers; the field is outside it and after it, so a
    // list that grows cannot push the field away from the thumb.
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

  it('keeps both scope chips on the tap floor', () => {
    mount();
    for (const button of container.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label="How much to search"] button',
    )) {
      expect(button.style.minHeight, `${button.textContent} is under the tap floor`).toBe('44px');
    }
  });
});
