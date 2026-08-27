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
import { srdIndex, SRD_KIND_LABELS, SRD_KINDS } from '../../src/ui/shared/srdIndex.ts';
import { indexDataset } from '@engine/character.ts';
import {
  CHAPTER_LABELS,
  SECTION_CHAPTER,
  SRD_CHAPTERS,
  sectionsInChapter,
} from '../../src/ui/shared/chapters.ts';
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

/**
 * Mount over a dataset whose rules have been thinned, to reach a state the
 * shipped data cannot.
 *
 * `chapters.test.ts` asserts that no chapter is empty, and it is right to: every
 * page of the book is inside one. So the branch where a browse comes back with
 * nothing is unreachable on what ships — which is *why* it has to be closed in
 * the code rather than trusted not to run, and why proving it closed takes a
 * dataset built for the purpose. This is the shape `moments.test.ts` uses when
 * it builds a catalogue in which two filters disagree.
 */
function mountWithout(chapter: (typeof SRD_CHAPTERS)[number]): void {
  seed(true);
  const thinned = {
    ...dataset,
    rules: dataset.rules.filter((s) => SECTION_CHAPTER[s.id] !== chapter),
  };
  useApp.setState({ dataset: thinned, index: indexDataset(thinned) });
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

/** The fourteen blocks of the index, as controls. */
const kindBlocks = (): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('[data-index="kinds"] > button'),
];

/** The five chapter rows, found on the namespaced id and never on their text. */
const chapterRows = (): HTMLButtonElement[] => [
  ...container.querySelectorAll<HTMLButtonElement>('button[id^="chapter-"]'),
];

const labelOf = (b: Element): string => (b.querySelector('span.t-label')?.textContent ?? '').trim();

const press = (b: Element): void => {
  act(() => {
    b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** Press the block whose label is the kind's own. Never a positional index. */
const pressKind = (kind: (typeof SRD_KINDS)[number]): void => {
  const b = kindBlocks().find((x) => labelOf(x) === SRD_KIND_LABELS[kind]);
  if (b === undefined) throw new Error(`no block for ${kind}`);
  press(b);
};

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

/**
 * The index on the empty field.
 *
 * Every count below is asked of the shipped dataset first and then read off the
 * glass. Nothing here carries an expected number as a literal, which is the
 * rule this file already states about its queries - a test that filtered by the
 * answer it then asserted would confirm whatever the code did next.
 */
describe('the empty field is an index of what the app ships', () => {
  it('draws one block per kind, in the dataset’s order, each with its own count', () => {
    mount();
    const blocks = kindBlocks();
    expect(blocks).toHaveLength(SRD_KINDS.length);
    expect(blocks.map(labelOf)).toEqual(SRD_KINDS.map((k) => SRD_KIND_LABELS[k]));

    const built = srdIndex(dataset);
    for (const kind of SRD_KINDS) {
      const block = blocks.find((b) => labelOf(b) === SRD_KIND_LABELS[kind])!;
      const expected = built.filter((r) => r.kind === kind).length;
      expect(block.textContent, SRD_KIND_LABELS[kind]).toContain(String(expected));
    }
  });

  it('puts every block on the 44px floor', () => {
    mount();
    for (const b of kindBlocks()) expect(b.style.minHeight, labelOf(b)).toBe('44px');
  });

  it('opens RULES onto the book’s five chapters and nothing else', () => {
    mount();
    pressKind('rules');
    const rows = chapterRows();
    expect(rows.map(labelOf)).toEqual(SRD_CHAPTERS.map((c) => CHAPTER_LABELS[c]));
    for (const [i, chapter] of SRD_CHAPTERS.entries()) {
      const expected = sectionsInChapter(dataset.rules, chapter).length;
      expect(rows[i]!.textContent, CHAPTER_LABELS[chapter]).toContain(String(expected));
      expect(rows[i]!.style.minHeight).toBe('44px');
    }
  });

  /**
   * The defect that was drawn, looked at, and only then found.
   *
   * `RuleSearchResults` heads every list with a band. Under a chapter row the
   * band restated the row two lines above it, word for word and count for
   * count; under a kind block the sticky control does the same job. So both
   * pass `banded={false}`, and this asserts the words appear **once** — a
   * mutant that ignored the prop survived every other test in this file.
   */
  it('names a browse once, not twice', () => {
    /*
     * Targets the band itself rather than counting the words on the screen.
     * A plain count would be wrong in both directions: the label legitimately
     * appears on the control the reader pressed and again in the `sr-only` live
     * region, and neither is the duplicate. What must not exist is a second
     * `LABEL · n` in the results under a header that already says it.
     */
    const bandsReading = (text: string): Element[] =>
      [...container.querySelectorAll('span.t-meta')].filter(
        (el) => (el.textContent ?? '').trim() === text,
      );

    mount();
    pressKind('rules');
    const row = chapterRows().find((b) => b.id === 'chapter-core-mechanics')!;
    press(row);
    const inChapter = sectionsInChapter(dataset.rules, 'core-mechanics').length;
    expect(
      bandsReading(`${CHAPTER_LABELS['core-mechanics']} · ${String(inChapter)}`),
      'the row is the header; the list must not add a second',
    ).toHaveLength(0);

    mount();
    pressKind('environment');
    const environments = srdIndex(dataset).filter((r) => r.kind === 'environment').length;
    expect(
      bandsReading(`${SRD_KIND_LABELS.environment} · ${String(environments)}`),
      'the sticky control is the header',
    ).toHaveLength(0);
  });

  it('opens a chapter onto its own sections, in the dataset’s order', () => {
    mount();
    pressKind('rules');
    const chapter = 'introduction';
    const row = chapterRows().find((b) => b.id === `chapter-${chapter}`)!;
    press(row);
    const expected = sectionsInChapter(dataset.rules, chapter).map((s) => s.title.toUpperCase());
    expect(sectionRows().map((b) => labelOf(b).toUpperCase())).toEqual(expected);
  });

  /**
   * The guard for the namespace collision. `introduction` is a chapter slug AND
   * a section id, because `Ref` is `string` and TypeScript keeps neither apart.
   * Without the prefix a test could count the chapter row as its own section
   * row and call that proof.
   */
  it('keeps a chapter row distinguishable from the section of the same name', () => {
    mount();
    pressKind('rules');
    const row = chapterRows().find((b) => b.id === 'chapter-introduction');
    expect(row, 'the chapter row is found on its namespaced id').toBeDefined();
    press(row!);
    // The section called `introduction` is inside it, and is not this control.
    expect(sectionRows().some((b) => b === row)).toBe(false);
    expect(sectionRows().length).toBe(sectionsInChapter(dataset.rules, 'introduction').length);
  });

  it('opens a kind onto its records, under a sticky row that shuts it again', () => {
    mount();
    pressKind('environment');
    const built = srdIndex(dataset).filter((r) => r.kind === 'environment');
    expect(recordNames()).toHaveLength(built.length);

    const sticky = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.style.position === 'sticky',
    );
    expect(sticky, 'a browse of 204 rows needs the way out to travel with it').toBeDefined();
    expect(sticky!.style.minHeight).toBe('44px');
    expect(sticky!.textContent).toContain(String(built.length));
    press(sticky!);
    expect(recordNames(), 'the sticky row shuts the block').toHaveLength(0);
    expect(kindBlocks()).toHaveLength(SRD_KINDS.length);
  });

  it('lights one block at a time, at both ranks', () => {
    mount();
    pressKind('adversary');
    expect(kindBlocks().filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    pressKind('rules');
    expect(kindBlocks().filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    const rows = chapterRows();
    press(rows[0]!);
    press(rows[3]!);
    expect(chapterRows().filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
  });

  /**
   * The exclusivity, in both directions. It is the owner's decision of 27 August
   * held from the other side: a surface that was half a browse and half a search
   * is exactly the ambiguity the scope chips were removed for.
   */
  it('puts the index away when a word is typed, and brings it back when it is cleared', () => {
    mount();
    pressKind('adversary');
    expect(kindBlocks()).toHaveLength(SRD_KINDS.length);
    type('a');
    expect(kindBlocks(), 'typing clears the index').toHaveLength(0);
    type('');
    expect(kindBlocks(), 'clearing the field brings it back').toHaveLength(SRD_KINDS.length);
    expect(
      kindBlocks().filter((b) => b.getAttribute('aria-expanded') === 'true'),
      'and it comes back with nothing lit',
    ).toHaveLength(0);
  });

  /**
   * The regression this change most easily causes, and it is silent.
   *
   * `RuleSearchResults` used to guard the honest-silence paragraph on
   * `moment === null`. A browse would otherwise print "it asks for every word
   * you typed, and not one of those words is in the book" over a list assembled
   * without a query. Nothing throws; only the sentence is wrong.
   */
  it('never says a word was typed when none was, at any rank', () => {
    mount();
    const silence = 'it asks for every word you typed';
    for (const kind of ['environment', 'rules'] as const) {
      pressKind(kind);
      expect(bodyText(), kind).not.toContain(silence);
    }
    press(chapterRows()[0]!);
    expect(bodyText(), 'a chapter').not.toContain(silence);
  });

  /**
   * The case the test above cannot reach, and the one the guard is actually for.
   *
   * A browse whose list is non-empty never meets the honest-silence paragraph:
   * its condition already requires all three lists to be empty. So swapping the
   * guard back from `!browsing` to `moment === null` passes every assertion
   * above — it survived exactly that mutation, which is how this test came to
   * exist. What the guard protects is a browse that comes back with **nothing**,
   * where the app would otherwise print "it asks for every word you typed, and
   * not one of those words is in the book" over a list nobody typed for.
   *
   * Nothing throws when it is wrong. Only the sentence is false, which is why it
   * needs a test rather than a reader.
   */
  it('says nothing about typed words when a browse comes back empty', () => {
    mountWithout('introduction');
    pressKind('rules');
    const row = chapterRows().find((b) => b.id === 'chapter-introduction')!;
    expect(row.textContent, 'the row is drawn, and says it holds none').toContain('0');
    press(row);
    expect(sectionRows(), 'nothing to draw').toHaveLength(0);
    expect(bodyText()).not.toContain('it asks for every word you typed');
    expect(bodyText()).not.toContain('Nothing in this dataset carries that');
    // And the spoken line is still true rather than silent.
    expect(spoken()).toBe('0 sections belong to INTRODUCTION');
  });

  it('speaks what the list is of, with the right noun for each rank', () => {
    mount();
    pressKind('environment');
    const environments = srdIndex(dataset).filter((r) => r.kind === 'environment').length;
    expect(spoken()).toBe(`${String(environments)} entries are filed under ENVIRONMENTS`);

    pressKind('rules');
    press(chapterRows().find((b) => b.id === 'chapter-core-mechanics')!);
    const inChapter = sectionsInChapter(dataset.rules, 'core-mechanics').length;
    expect(spoken()).toBe(`${String(inChapter)} sections belong to CORE MECHANICS`);
  });

  /** A layer's section is searchable, and in no chapter. The cost of the table. */
  it('leaves a section the book never printed out of the chapter breakdown', () => {
    mount();
    pressKind('rules');
    const total = SRD_CHAPTERS.reduce(
      (n, c) => n + sectionsInChapter(dataset.rules, c).length,
      0,
    );
    expect(total).toBe(dataset.rules.filter((s) => SECTION_CHAPTER[s.id] !== undefined).length);
  });
});
