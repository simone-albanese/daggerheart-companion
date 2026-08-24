// @vitest-environment jsdom
/**
 * Rules search inside SHOW: what it finds, how it says it, and where it sits.
 *
 * Three properties are worth more than the rest here.
 *
 * **The words are the book's.** Every string this surface prints - a title, a
 * previewed line, the marked run inside it - is a slice of `dataset.rules`
 * taken at render time. So the assertions below are written against the shipped
 * `data/srd-1.0.json` rather than against a fixture invented here: a synthetic
 * section would let a search that quietly rewrote what it found pass, and
 * rewriting the SRD is the one thing this repo forbids outright.
 *
 * **The door exists.** Every test that renders the sheet goes in through the
 * bottom bar's SHOW verb, the way a GM does. The defect class this repo keeps
 * shipping is code that works and is never reached, and a search field behind
 * no button would be the purest example. Exactly one test below mounts the
 * results on their own, and it says in its own body why: through the sheet, the
 * results follow a homebrew layer whether or not they subscribe to the store,
 * because `ShowSheet` subscribes for the placeholder's count and re-renders
 * them either way. Alone, they have to follow it themselves.
 *
 * **The floor is inline.** jsdom reads only inline styles and does not resolve
 * custom properties, so `minHeight: 'var(--tap)'` measures as the literal
 * string and proves nothing. The 44s asserted here are the numbers the source
 * writes out, which is the only form of the rule a test can check.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { searchRules } from '../../src/ui/shared/srdReference.ts';
import { preview, RuleSearchResults } from '../../src/ui/gm/RuleSearch.tsx';
import { Fold } from '../../src/ui/shared/Fold.tsx';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let baseCampaigns: Campaign[] = [];
let baseActiveId: string | null = null;
let container: HTMLDivElement;
let root: Root;

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

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
  baseCampaigns = useGm.getState().campaigns;
  baseActiveId = useGm.getState().activeCampaignId;
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({
    hydrated: true,
    session: [],
    countdowns: [],
    combatants: [],
    roster: [],
    environmentRef: null,
    fear: 0,
    region: 'encounter',
    writeError: null,
    replacedOnLoad: false,
    campaigns: baseCampaigns,
    activeCampaignId: baseActiveId,
    notices: [],
    quarantined: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const rules = dataset.rules;

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const named = (label: string): HTMLButtonElement => {
  const found = buttons().find(
    (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label,
  );
  if (found === undefined) {
    throw new Error(
      `no control called "${label}". Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
};

const dialog = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="dialog"]');
  if (el === null) throw new Error('no dialog is open');
  return el;
};

const field = (): HTMLInputElement => {
  const el = dialog().querySelector<HTMLInputElement>('input[type="search"]');
  if (el === null) throw new Error('the SHOW sheet has no search field');
  return el;
};

/** The row the field and its CLEAR share - the sheet's bottom element. */
const fieldRow = (): HTMLElement => field().parentElement!;

const scroller = (): HTMLElement => dialog().querySelector<HTMLElement>('.scroll')!;

/** SHOW, the way a GM reaches it: the bar's own verb. */
const openShow = (): void => {
  act(() => root.render(createElement(Gm)));
  click(named('SHOW'));
};

/** Type into the field the way React hears it. */
const type = (text: string): void => {
  const input = field();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** Every hit header on screen, in the order the list draws them. */
const hits = (): HTMLButtonElement[] => [
  ...dialog().querySelectorAll<HTMLButtonElement>('section > button[aria-expanded]'),
];

const hitTitles = (): string[] =>
  hits().map((b) => (b.querySelector('span > span')?.textContent ?? '').trim());

const groupHeaders = (): string[] =>
  [...scroller().querySelectorAll('span.t-meta')]
    .map((s) => (s.textContent ?? '').trim())
    .filter((t) => t.startsWith('IN THE '));

// ---------------------------------------------------------------------------

describe('searchRules, over the shipped SRD', () => {
  it('answers an empty query with nothing rather than with everything', () => {
    // `''` is a substring of every string alive. Without the guard this is not
    // an empty result, it is all sixty-nine sections - which is what a GM
    // would see the instant the sheet opened.
    expect(searchRules(rules, '')).toEqual([]);
    expect(searchRules(rules, '   ')).toEqual([]);
    expect(rules.length).toBeGreaterThan(50);
  });

  it('puts every section named for the phrase above every section that only mentions it', () => {
    const hitsFor = searchRules(rules, 'countdown');
    const kinds = hitsFor.map((h) => h.where);
    expect(kinds.filter((k) => k === 'title')).not.toEqual([]);
    expect(kinds.filter((k) => k !== 'title')).not.toEqual([]);
    expect(kinds.lastIndexOf('title')).toBeLessThan(
      kinds.findIndex((k) => k !== 'title'),
    );
    // And the split is the dataset's own, not a list typed here: the section
    // called Countdowns is the one at the top.
    expect(hitsFor[0]!.id).toBe('countdowns');
    expect(hitsFor[0]!.line).toBeNull();
  });

  it('matches the phrase whole, not its words in any order', () => {
    // `very close` is a range in this book. A GM half-remembering it types the
    // two words together; an AND over separate terms would also answer with
    // every section that says "close" in one paragraph and "very" in another,
    // and would then owe a preview line that does not exist.
    const together = searchRules(rules, 'very close');
    expect(together.map((h) => h.id)).toEqual([
      'maps-range-and-movement',
      'optional-gm-mechanics',
      'example-adversary-features',
    ]);
    expect(searchRules(rules, 'close very')).toEqual([]);
  });

  it('collapses the spaces the GM typed and not the ones the book did not type', () => {
    // A person typing a phrase into a field on a phone puts two spaces in it.
    // The book has none: not one of the shipped bodies carries a double space,
    // which is why the scan never rewrites 122,437 characters to find out.
    expect(searchRules(rules, '  very   close  ')).toEqual(searchRules(rules, 'very close'));
    expect(rules.some((r) => / {2,}/.test(r.body))).toBe(false);
  });

  it('quotes a whole line of the section, with the SRD’s own list markup off it', () => {
    const hit = searchRules(rules, 'very close').find((h) => h.id === 'example-adversary-features');
    expect(hit?.where).toBe('text');
    const body = rules.find((r) => r.id === 'example-adversary-features')!.body;
    const lines = body.split('\n').map((l) => l.trim().replace(/^#+\s+/, '').replace(/^-\s+/, ''));
    // Not "contains the query" - that a slice would satisfy. A line, entire.
    expect(lines).toContain(hit!.line);
    expect(hit!.line!.toLowerCase()).toContain('very close');
  });

  it('says a match is in a table rather than quoting a row out of one', () => {
    // `Major 7/Severe 12` is in the shipped file exactly once, inside the
    // benchmark table's Damage Thresholds row. That row is four tiers wide and
    // means nothing without the header above it, so the hit carries no line.
    const hitsFor = searchRules(rules, 'Major 7/Severe 12');
    expect(hitsFor.map((h) => h.id)).toEqual(['adversary-stat-block-benchmarks']);
    expect(hitsFor[0]!.where).toBe('table');
    expect(hitsFor[0]!.line).toBeNull();
  });

  it('carries each section’s own page rather than one stamp for the search', () => {
    for (const hit of searchRules(rules, 'fear')) {
      const section = rules.find((r) => r.id === hit.id)!;
      expect(hit.page).toBe(section.sourcePage ?? null);
      expect(hit.title).toBe(section.title);
    }
  });
});

// ---------------------------------------------------------------------------

describe('preview', () => {
  it('gives back a short line whole, split at the match in the book’s own case', () => {
    const found = preview('Very Close: 3 squares', 'very close');
    expect(found.before).toBe('');
    expect(found.match).toBe('Very Close');
    expect(found.after).toBe(': 3 squares');
    expect(found.before + found.match + found.after).toBe('Very Close: 3 squares');
  });

  it('leaves a line the query is not in alone, and marks nothing', () => {
    const found = preview('Downtime', 'countdown');
    expect(found).toEqual({ before: 'Downtime', match: '', after: '' });
  });

  it('windows a long line around the match and marks each end it cut', () => {
    const line = `${'alpha '.repeat(40)}NEEDLE${' omega'.repeat(40)}`;
    const found = preview(line, 'needle');
    expect(found.match).toBe('NEEDLE');
    expect(found.before.startsWith('…')).toBe(true);
    expect(found.after.endsWith('…')).toBe(true);
    // The window is a window, not a summary: what is left is still the line.
    const kept = (found.before + found.match + found.after).replaceAll('…', '');
    expect(line).toContain(kept);
    expect(kept.length).toBeLessThan(line.length);
  });

  it('does not open with an ellipsis when it did not cut the front', () => {
    const line = `NEEDLE${' omega'.repeat(40)}`;
    const found = preview(line, 'needle');
    expect(found.before).toBe('');
    expect(found.after.endsWith('…')).toBe(true);
  });

  it('windows the longest lines the shipped SRD actually has', () => {
    // 294 of the 969 non-empty body lines are longer than the 150 characters
    // this keeps. The bullet below is one of them, and it is the line the
    // search hands the screen for `very close`.
    const hit = searchRules(rules, 'very close').find((h) => h.id === 'maps-range-and-movement')!;
    expect(hit.line!.length).toBeGreaterThan(150);
    const found = preview(hit.line!, 'very close');
    expect(found.match).toBe('Very Close');
    expect(found.after.endsWith('…')).toBe(true);
    expect(hit.line).toContain(found.after.replace(/…$/, ''));
  });
});

// ---------------------------------------------------------------------------

describe('the field, at the foot of SHOW', () => {
  it('is on the sheet the bar opens, named and counted from the dataset', () => {
    // Where it sits relative to the doors is the next test's property, not
    // this one's: this is the field's name and the count in its placeholder,
    // and the count is `rules.length` rather than a number typed here.
    openShow();
    expect(field().getAttribute('aria-label')).toBe('Search the rules by title and text');
    expect(field().getAttribute('placeholder')).toBe(`Search ${String(rules.length)} rules sections`);
  });

  it('is the last thing in the sheet, so nothing under the thumb moves as hits arrive', () => {
    /*
     * The sheet is bottom-anchored and grows upward. A field at the top would
     * be dragged further from the thumb by every result that appeared; the last
     * element does not move at all. This is the property, stated as the DOM
     * order that produces it: the scroller that holds the doors or the hits
     * comes first, and the last control in the whole dialog is in the field's
     * own row.
     */
    openShow();
    const before = [...dialog().querySelectorAll('button, input')];
    expect(fieldRow().contains(before.at(-1)!)).toBe(true);
    expect(
      scroller().compareDocumentPosition(field()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);

    type('fear');
    const after = [...dialog().querySelectorAll('button, input')];
    expect(after.length).toBeGreaterThan(before.length);
    expect(fieldRow().contains(after.at(-1)!)).toBe(true);
  });

  it('declares its 44px floor and CLEAR’s inline, where a test can read them', () => {
    openShow();
    expect(field().style.minHeight).toBe('44px');
    type('fear');
    const clear = named('Clear the search');
    expect(clear.style.minHeight).toBe('44px');
    expect(clear.style.minWidth).toBe('44px');
    for (const hit of hits()) expect(hit.style.minHeight).toBe('44px');
  });

  it('offers CLEAR only once there is something to clear, and empties the field with it', () => {
    openShow();
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Clear the search')).toBe(false);

    type('fear');
    expect(hits()).not.toEqual([]);
    click(named('Clear the search'));

    expect(field().value).toBe('');
    expect(hits()).toEqual([]);
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Clear the search')).toBe(false);
  });

  it('takes all three doors away while a question is being asked, and gives them back', () => {
    // A GM typing has asked something the doors do not answer, and a phone with
    // a keyboard up has no room to keep offering them. Nothing is dismissed:
    // emptying the field brings them straight back. Every door is named: this
    // named two while the sheet held three, so the merchant could have stayed
    // drawn beside the hits and nothing here would have gone red.
    openShow();
    const doorText = (): string => dialog().textContent ?? '';
    expect(doorText()).toContain('without adding any of them');
    expect(doorText()).toContain('Nothing here ever writes to their characters');
    expect(doorText()).toContain('never spends anybody’s gold');

    type('fear');
    expect(doorText()).not.toContain('without adding any of them');
    expect(doorText()).not.toContain('Nothing here ever writes to their characters');
    expect(doorText()).not.toContain('never spends anybody’s gold');

    type('');
    expect(doorText()).toContain('without adding any of them');
    expect(doorText()).toContain('Nothing here ever writes to their characters');
    expect(doorText()).toContain('never spends anybody’s gold');
  });

  it('is still there when only one of SHOW’s doors is switched on', () => {
    // The search rides on SHOW rather than being a door of its own, so it must
    // not depend on any door being drawn.
    useApp.setState({
      prefs: { ...DEFAULT_PREFS, gmBestiary: false, gmMerchant: false },
    });
    openShow();
    expect(dialog().textContent).toContain('Nothing here ever writes to their characters');
    type('pitfalls');
    expect(hitTitles()).toEqual(['Pitfalls to Avoid']);
    // And the name the sheet is announced under says so. `Gm.tsx` narrows this
    // label to whichever doors survive; the field survives all of them, so it
    // is in the name here too.
    expect(dialog().getAttribute('aria-label')).toBe('The party board and rules search');
  });

  it('is named in the sheet a screen reader hears, not only drawn in it', () => {
    /*
     * The dialog's accessible name is the only description of this sheet a GM
     * who cannot see it gets before they start reading it, and it used to name
     * two doors while the sheet held two doors and a search over every section
     * the dataset carries. A name that undersells its own surface is the same
     * defect as a docblock that oversells one.
     */
    openShow();
    expect(dialog().getAttribute('aria-label')).toBe(
      'The bestiary, the party board, the merchant and rules search',
    );
    expect(field().getAttribute('aria-label')).toBe('Search the rules by title and text');
  });
});

// ---------------------------------------------------------------------------

describe('the results', () => {
  it('groups what is named for the phrase apart from what merely mentions it', () => {
    openShow();
    type('countdown');
    const found = searchRules(rules, 'countdown');
    const titled = found.filter((h) => h.where === 'title').length;
    expect(groupHeaders()).toEqual([
      `IN THE TITLE · ${String(titled)}`,
      `IN THE TEXT · ${String(found.length - titled)}`,
    ]);
    // The header order is the list order: the named ones are drawn first.
    expect(hitTitles()).toEqual(found.map((h) => h.title));
  });

  it('draws only the group it has, and says how many sections in one live line', () => {
    openShow();
    type('pitfalls');
    expect(groupHeaders()).toEqual(['IN THE TITLE · 1']);
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      '1 section matches',
    );

    type('fear');
    expect(groupHeaders()).toHaveLength(2);
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      `${String(searchRules(rules, 'fear').length)} sections match`,
    );
  });

  it('marks the GM’s words inside the line, spelled the way the book spells them', () => {
    openShow();
    type('very close');
    const marks = [...dialog().querySelectorAll('mark')];
    expect(marks).not.toEqual([]);
    // Typed lower case, drawn as the SRD writes it. A mark that echoed the
    // query back would be the screen quoting the GM instead of the book.
    for (const m of marks) expect(m.textContent).toBe('Very Close');
    // And not a lamp in a dim room: the highlight is weight and ink, no block.
    expect(marks[0]!.style.background).toBe('transparent');
    expect(marks[0]!.style.fontWeight).toBe('700');
  });

  it('marks the title of a section that is named for the phrase', () => {
    openShow();
    type('pitfalls');
    const mark = dialog().querySelector('mark');
    expect(mark?.textContent).toBe('Pitfalls');
    expect(mark?.closest('span')?.className).toBe('t-label');
  });

  it('opens one hit at a time, in place, and draws the section it came from', () => {
    openShow();
    type('countdown');
    const first = hits()[0]!;
    click(first);
    expect(hits().filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    // Drawn through `BlockView`, so the section arrives as prose and bullets
    // rather than as one string with `- ` in the middle of it.
    const openSection = rules.find((r) => r.id === 'countdowns')!;
    const firstLine = openSection.body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('#') && !l.startsWith('|'))!
      .replace(/^-\s+/, '');
    expect(dialog().textContent).toContain(firstLine);

    click(hits()[3]!);
    const open = hits().filter((b) => b.getAttribute('aria-expanded') === 'true');
    expect(open).toHaveLength(1);
    expect(open[0]).toBe(hits()[3]);
  });

  it('says so, in its own words, when the dataset carries no such phrase', () => {
    openShow();
    type('kobolds riding a velocipede');
    expect(hits()).toEqual([]);
    expect(groupHeaders()).toEqual([]);
    expect(dialog().textContent).toContain('No rule in this dataset carries that');
  });

  it('says the empty answer in the live line that was counting the hits', () => {
    /*
     * The live region used to sit inside the branch that draws the groups, so
     * the one result a GM reaches by typing one word too many was the one
     * result nothing spoke: twenty sections became a sentence only an eye
     * could read. It is ahead of the branch now, so this is a text change
     * inside an element that was already on the page - which is the identity
     * the second assertion is checking, not just the wording.
     */
    openShow();
    type('fear');
    const live = dialog().querySelector('.sr-only[role="status"]');
    expect(live?.textContent).toBe(`${String(searchRules(rules, 'fear').length)} sections match`);

    type('kobolds riding a velocipede');
    expect(dialog().querySelector('.sr-only[role="status"]')).toBe(live);
    expect(live?.textContent).toBe('No section matches');
    expect(dialog().textContent).toContain('No rule in this dataset carries that');
  });

  it('stamps the page in the same ink every other Fold header in the app uses', () => {
    /*
     * A hit's header is `Fold`'s header with the private open state taken out
     * of it, and it prints the same `SRD 1.0 · P.n` stamp the five GM-chapter
     * folds print through `Fold` itself. So the value is read off `Fold` here
     * rather than named twice: the claim in the docblock is *sameness*, and a
     * test that only asserted a token would still pass while the two drifted.
     */
    openShow();
    type('pitfalls');
    const stamp = hits()[0]?.querySelector<HTMLElement>('span.row > span.t-meta');
    expect(stamp?.textContent).toContain('SRD 1.0');

    const aside = document.createElement('div');
    document.body.append(aside);
    const asideRoot = createRoot(aside);
    act(() =>
      asideRoot.render(
        createElement(Fold, { label: 'A section', summary: 'SRD 1.0 · P.1', children: null }),
      ),
    );
    const summary = aside.querySelector<HTMLElement>('span.t-meta');
    expect(summary?.textContent).toBe('SRD 1.0 · P.1');
    expect(stamp?.style.color).toBe(summary?.style.color);
    expect(stamp?.style.color).toBe('var(--muted)');
    act(() => asideRoot.unmount());
    aside.remove();
  });

  it('follows a layer that lands while a hit is already open', () => {
    // The narrow case the section's `useMemo` deps exist for: the GM has a
    // section open, a homebrew layer arrives, and what is on the glass is the
    // body the layer replaced rather than the body it wrote.
    openShow();
    type('pitfalls');
    click(hits()[0]!);
    expect(dialog().textContent).not.toContain('Do not talk over the quiet player.');

    act(() => {
      useApp.setState({
        dataset: {
          ...dataset,
          rules: dataset.rules.map((r) =>
            r.id === 'pitfalls-to-avoid'
              ? { ...r, body: 'Do not talk over the quiet player.' }
              : r,
          ),
        },
      });
    });

    expect(hits()[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(dialog().textContent).toContain('Do not talk over the quiet player.');
  });

  it('subscribes to the dataset on its own, not through whatever mounted it', () => {
    /*
     * Mounted alone, deliberately. Inside the sheet this property is invisible:
     * `ShowSheet` reads `dataset.rules` for its placeholder's count, so it
     * re-renders the results on any layer whether they subscribe or not, and a
     * `useApp.getState()` read here would pass every test above. Take the sheet
     * away and only a real subscription answers.
     */
    act(() => root.render(createElement(RuleSearchResults, { query: 'velocipede' })));
    expect(container.textContent).toContain('No rule in this dataset carries that');

    act(() => {
      useApp.setState({
        dataset: {
          ...dataset,
          rules: dataset.rules.map((r) =>
            r.id === 'countdowns' ? { ...r, body: `${r.body}\nA velocipede is Close range.` } : r,
          ),
        },
      });
    });

    expect(container.textContent).toContain('Countdowns');
    expect(container.textContent).toContain('IN THE TEXT · 1');
  });

  it('reads the dataset rather than a copy, so a layer changes what is found', () => {
    /*
     * `rules` is mergeable: a homebrew layer really can rewrite a section's
     * body, and the search must follow it with nothing to rebuild - which is
     * the whole reason there is no index behind this.
     */
    openShow();
    type('velocipede');
    expect(hits()).toEqual([]);

    act(() => {
      useApp.setState({
        dataset: {
          ...dataset,
          rules: dataset.rules.map((r) =>
            r.id === 'countdowns' ? { ...r, body: `${r.body}\nA velocipede is Close range.` } : r,
          ),
        },
      });
    });

    expect(hitTitles()).toEqual(['Countdowns']);
    expect(dialog().textContent).toContain('A velocipede is Close range.');
  });
});
