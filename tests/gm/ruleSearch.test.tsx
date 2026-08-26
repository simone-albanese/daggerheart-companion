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
 *
 * **The search asks for words, and the words have to be in one line.** That
 * replaced a search for one phrase, and the assertion that pinned the phrase
 * carried a written reason rather than a preference. The reason is answered
 * where it stood - see *asks for every word, in one line* below - and not
 * deleted: it named two real failures of an AND over a whole section, and this
 * file now holds a test for each of them.
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
import {
  ruleSection,
  ruleTerms,
  searchRules,
  type RuleHit,
  type SectionView,
} from '../../src/ui/shared/srdReference.ts';
import { landingIn, preview, RuleSearchResults } from '../../src/ui/gm/RuleSearch.tsx';
import {
  searchSrd,
  SRD_KIND_LABELS,
  SRD_KINDS,
  srdIndex,
} from '../../src/ui/shared/srdIndex.ts';
import { loadAsk, MOMENTS, searchAsk } from '../../src/ui/gm/ask.ts';
import { ASK_CATALOGUE } from '../../src/ui/gm/askCatalogue.ts';
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
  /*
   * The question catalogue arrives through a dynamic `import()`, and this is
   * where it is made to arrive - once, before anything renders.
   *
   * Without this line the chunk never lands inside a synchronous test at all:
   * a microtask cannot run while a test body is still on the stack, so every
   * assertion below would be written against a surface with no QUESTIONS band
   * on it and would pass whether the band worked or not. That is the exact
   * failure this file's own `groupHeaders` docblock warns about one bad helper
   * further down - a check quietly answering the question it was not asked.
   * `loadAsk` memoises, so this is one import for the file and the module's
   * synchronous peek is warm for every case in it.
   */
  await loadAsk();
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
    combatants: [], liveScene: null,
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

/**
 * The book beyond the rules, as the screen builds it: the whole index with the
 * 69 sections taken out, because those are searched by `searchRules` and drawn
 * with a landing this list has no equivalent of.
 *
 * Built here from the same dataset the screen is handed, so a count derived
 * from it is a claim about what the *screen reports*, which is what the live
 * line and the band headers are for. Where a test needs to know what the search
 * actually found - which record, under which band - it reads that off the glass
 * instead; see `recordNames`.
 */
const beyondRules = srdIndex(dataset).filter((record) => record.kind !== 'rules');

/** The bands the rest of the book draws for a query, as their headers read. */
const kindBands = (query: string): string[] => {
  const found = searchSrd(beyondRules, query);
  return SRD_KINDS.filter((kind) => found.some((hit) => hit.kind === kind)).map(
    (kind) => `${SRD_KIND_LABELS[kind]} · ${String(found.filter((h) => h.kind === kind).length)}`,
  );
};

/**
 * The elements a run asks to be brought into view, in the order it asked.
 *
 * jsdom ships no `scrollIntoView`, so the stub goes on and comes off through
 * the descriptor: deleting on the wrong branch would either strip a real one
 * or leave this one standing over every test after it.
 */
function landings(run: (asked: Element[]) => void): void {
  const asked: Element[] = [];
  const proto = Element.prototype as unknown as { scrollIntoView?: unknown };
  const was = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
  proto.scrollIntoView = function scrollIntoView(this: Element): void {
    asked.push(this);
  };
  try {
    run(asked);
  } finally {
    if (was === undefined) delete proto.scrollIntoView;
    else Object.defineProperty(proto, 'scrollIntoView', was);
  }
}

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

/**
 * Every *section* hit header on screen, in the order the list draws them.
 *
 * `section:not([data-ask])`, because a question row is a `<section>` with a
 * `button[aria-expanded]` in it too and it is not a hit: it carries no book
 * title, so `hitTitles` would read a blank out of it, and every `toEqual` over
 * hits in this file would start counting rows the SRD did not produce. The
 * attribute is on the row for this reason and no other - it is the seam
 * between the app's own words and the book's.
 *
 * **`:not([data-kind])` is the same seam a second time, and it had to be added
 * rather than assumed.** The search now covers the 780 records the rules
 * sections' own search cannot reach, and a record row is a third `<section>` of
 * this shape - so without it `hitTitles()` answered `countdown` with
 * thirty-three rows where `searchRules` found seven, and every `toEqual` in
 * this file comparing hits against `searchRules` would have been comparing two
 * different lists. That is the failure the `data-ask` paragraph above calls the
 * worse of the two: it looks like proof.
 */
const hits = (): HTMLButtonElement[] => [
  ...dialog().querySelectorAll<HTMLButtonElement>(
    'section:not([data-ask]):not([data-kind]) > button[aria-expanded]',
  ),
];

const hitTitles = (): string[] =>
  hits().map((b) => (b.querySelector('span > span')?.textContent ?? '').trim());

/** Every record row on screen - the book beyond the rules - in list order. */
const recordRows = (): HTMLButtonElement[] => [
  ...dialog().querySelectorAll<HTMLButtonElement>('section[data-kind] > button[aria-expanded]'),
];

const recordNames = (): string[] =>
  recordRows().map((b) => (b.querySelector('span > span')?.textContent ?? '').trim());

/** Every question row on screen, in the order the band draws them. */
const askRows = (): HTMLButtonElement[] => [
  ...dialog().querySelectorAll<HTMLButtonElement>('section[data-ask] > button[aria-expanded]'),
];

/** The questions a query finds, as the header over them reads. */
const askBand = (query: string): string[] => {
  const found = searchAsk(ASK_CATALOGUE, query);
  return found.length === 0 ? [] : [`QUESTIONS · ${String(found.length)}`];
};

/**
 * What a band header can say, so this helper cannot miss one.
 *
 * It filtered on `IN THE ` and that was fine while there were two bands. The
 * third is `IN A HEADING`, and a prefix filter went on reporting two headers
 * over a three-band list - a helper quietly answering the question the
 * assertion below was written to ask. Named labels, matched from the front so
 * the ` · n` count can still be read off the end.
 *
 * `QUESTIONS` is in the list for exactly that reason. It is the band that is
 * not the book's, it is drawn above all the others, and a helper that did not
 * name it would leave every `toEqual` below asserting the old surface over a
 * new one and passing - which is the worse of the two failures, because it
 * looks like proof.
 */
const BAND_LABELS = [
  'QUESTIONS',
  'IN THE TITLE',
  'IN A HEADING',
  'IN THE TEXT',
  'NO SECTION CARRIES ALL OF THOSE WORDS · THESE CARRY SOME',
  // The book beyond the rules, banded by kind. Taken from the source of the
  // labels rather than typed out again here: a kind added to the dataset and
  // drawn on the glass must not be a band this helper cannot see, which is the
  // whole reason the paragraph above names QUESTIONS.
  ...Object.values(SRD_KIND_LABELS),
];

const groupHeaders = (): string[] =>
  [...scroller().querySelectorAll('span.t-meta')]
    .map((s) => (s.textContent ?? '').trim())
    .filter((t) => BAND_LABELS.some((label) => t.startsWith(label)));

/**
 * Natural GM phrasings, and the section each is asking for.
 *
 * Written as a GM says them rather than as the book writes them - which is the
 * whole point: every one of these is a phrase that appears nowhere in the
 * shipped dataset, and the assertions below check that first rather than
 * assuming it. These are the query, not the SRD's wording, so they are the one
 * kind of string this file is allowed to type out.
 */
const PHRASINGS: ReadonlyArray<{ q: string; want: string }> = [
  { q: 'falling damage', want: 'optional-gm-mechanics' },
  { q: 'line of sight cover', want: 'maps-range-and-movement' },
  { q: 'underwater fighting', want: 'optional-gm-mechanics' },
  { q: 'restrained condition', want: 'conditions' },
  { q: 'multi target attack', want: 'attacking' },
  { q: 'direct damage immunity', want: 'attacking' },
  { q: 'long rest downtime', want: 'downtime' },
  { q: 'soft move hard move', want: 'making-gm-moves' },
  { q: 'death move options', want: 'death' },
  { q: 'gold handfuls bags', want: 'gold' },
  { q: 'battle points encounter', want: 'building-balanced-encounters' },
  { q: 'environment impulses', want: 'using-environments' },
];

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

  it('asks for every word, in one line, rather than for the phrase whole', () => {
    /*
     * This assertion used to read `expect(searchRules(rules, 'close very'))
     * .toEqual([])`, and what stood beside it was not a preference. It was
     * this: an AND over separate terms "would also answer with every section
     * that says 'close' in one paragraph and 'very' in another, and would then
     * owe a preview line that does not exist."
     *
     * **That objection was real, and it was measured.** Over thirty natural GM
     * phrasings, an AND asked of a whole *section* returns eighty-two hits
     * against the phrase search's twenty, and seventeen of the sixty-two it
     * adds have their words in different paragraphs of the section - seventeen
     * rows in a list, each owing a line it cannot show. Nothing about that has
     * been decided away, and the next test holds it in place against the
     * shipped dataset.
     *
     * What makes it not apply is the **scope**. The matcher does not ask
     * whether the section carries both words. It asks whether **one body line,
     * read together with the section's own title, carries both - and whether
     * that line carries at least one of them itself**. Measured against the
     * same thirty queries it returns sixty-five - the eighty-two less exactly
     * those seventeen - and of the forty-five hits it adds, *none* has its
     * words in different paragraphs and *none* is unable to quote its line.
     *
     * So `close very` is `very close` now, because word order was never
     * evidence of anything, and both are the same three lines that carry the
     * two words side by side.
     */
    const together = searchRules(rules, 'very close');
    expect(together.map((h) => h.id)).toEqual([
      'maps-range-and-movement',
      'optional-gm-mechanics',
      'example-adversary-features',
    ]);
    const reversed = searchRules(rules, 'close very');
    expect(reversed.map((h) => h.id)).toEqual(together.map((h) => h.id));
    // And every one of them can show the line it is claiming, whole.
    for (const hit of reversed) {
      expect(hit.line!.toLowerCase()).toContain('very');
      expect(hit.line!.toLowerCase()).toContain('close');
    }
  });

  it('refuses the section that says one word here and the other four lines down', () => {
    /*
     * The other half of the sentence above, against the dataset rather than
     * against a fixture. `Rulings Over Rules` really does carry `close` and
     * `very` - in different paragraphs, with nothing between them that says
     * both. An AND over the section returns it (six sections for `very close`
     * instead of three) and then has to pick a preview line; whichever line it
     * picks, one of the two words the GM typed is not in it. That is the hit
     * the line scope refuses, and this is it, by name.
     */
    const body = rules.find((r) => r.id === 'rulings-over-rules')!.body.toLowerCase();
    expect(body).toContain('close');
    expect(body).toContain('very');
    expect(body.split('\n').some((l) => l.includes('close') && l.includes('very'))).toBe(false);
    expect(searchRules(rules, 'very close').map((h) => h.id)).not.toContain('rulings-over-rules');
  });

  it('reaches the section a GM meant, where a whole-phrase search reached nothing', () => {
    /*
     * Twenty of thirty natural phrasings returned a blank screen before, and a
     * blank screen reads as *the SRD does not cover this*. It does: `falling
     * damage` was blank while the book carried a subhead reading FALLING AND
     * COLLISION DAMAGE.
     *
     * The first assertion is the one that keeps this test honest. It checks
     * that the phrase really is absent from the dataset, so this cannot quietly
     * become a test that a substring search would also pass.
     */
    for (const { q, want } of PHRASINGS) {
      const whole = rules.some((r) => `${r.title}\n${r.body}`.toLowerCase().includes(q));
      expect(whole, `"${q}" is in the dataset as a phrase; pick another`).toBe(false);
      expect(searchRules(rules, q).map((h) => h.id), q).toContain(want);
    }
  });

  it('never returns a hit whose words are not answered by one line and its header', () => {
    /*
     * The property the whole change rests on, asserted over every hit of every
     * phrasing rather than over the ones that were convenient: a hit either
     * names the words in its title, or holds them in a table, or has **a line
     * that carries at least one of them and, with the header above it, all of
     * them**. There is no fourth case, and if there were it would be the hit
     * that owes a preview line it does not have.
     */
    for (const { q } of PHRASINGS) {
      const terms = ruleTerms(q);
      for (const hit of searchRules(rules, q)) {
        if (hit.where === 'title' || hit.where === 'table') {
          expect(hit.line, `${q} / ${hit.id}`).toBeNull();
          continue;
        }
        expect(hit.line, `${q} / ${hit.id}`).not.toBeNull();
        const line = hit.line!.toLowerCase();
        expect(terms.some((t) => line.includes(t)), `${q} / ${hit.id}: line carries none`).toBe(
          true,
        );
        const onGlass = `${line}\n${hit.title.toLowerCase()}`;
        expect(terms.every((t) => onGlass.includes(t)), `${q} / ${hit.id}: not all`).toBe(true);
      }
    }
  });

  it('bands a subhead with the titles, because a subhead is a name too', () => {
    // `Conditions` answers `restrained condition` from its own RESTRAINED
    // subhead: the line carries `restrained`, the header carries `condition`,
    // and they are three lines apart inside one tap target rather than eight
    // paragraphs apart.
    const hitsFor = searchRules(rules, 'restrained condition');
    expect(hitsFor.map((h) => h.id)).toEqual(['conditions']);
    expect(hitsFor[0]!.where).toBe('heading');
    expect(hitsFor[0]!.line!.toLowerCase()).toContain('restrained');
    expect(hitsFor[0]!.line!.toLowerCase()).not.toContain('condition');
    expect(hitsFor[0]!.title.toLowerCase()).toContain('condition');
  });

  it('cannot answer out of the header alone, because a named section never gets that far', () => {
    /*
     * The rule this lane was given had a third clause: *and the line carries at
     * least one term itself*, so that a section whose header supplies all of
     * them cannot answer from a sentence that supplies none. Written as a guard
     * it never fired - probed over 40,000 queries built from the SRD's own
     * vocabulary, it changed no answer - and the reason is structural. A
     * section whose title carries every word is a **title hit** and returns
     * before the body is scanned at all, so every section that reaches the scan
     * is missing a word from its title, and any line satisfying the AND has to
     * carry that word itself.
     *
     * The property is asserted above, over every hit of every phrasing. This is
     * the branch that makes it true, asserted where it lives: if the title band
     * ever stopped returning early, the property would go with it and nothing
     * else in this file would notice.
     */
    const named = searchRules(rules, 'conditions');
    expect(named[0]!.id).toBe('conditions');
    expect(named[0]!.where).toBe('title');
    expect(named[0]!.line).toBeNull();
    // Once, not twice: the section is named for the word and its body is full
    // of it, and none of that body is quoted back.
    expect(named.filter((h) => h.id === 'conditions')).toHaveLength(1);
  });

  it('falls back to some of the words only when nothing carries them all', () => {
    /*
     * Two of the thirty phrasings fail on an inflection rather than on
     * vocabulary - the book writes `Setting Difficulty Values` and `clear
     * Stress` - and for those the AND is empty. An empty screen would say the
     * book is silent, so the search answers with the sections carrying some of
     * the words and the screen labels the list as exactly that.
     *
     * The flag is all-or-nothing on purpose: the fallback is the whole answer
     * or none of it, which is what lets one header stand over the list instead
     * of a badge on every row.
     */
    const some = searchRules(rules, 'setting difficulty');
    expect(some.length).toBeGreaterThan(10);
    expect(some.every((h) => h.partial)).toBe(true);
    expect(some.map((h) => h.id)).toContain('difficulty-benchmarks');
    // And it does not fire while the AND has anything at all.
    const solid = searchRules(rules, 'falling damage');
    expect(solid).not.toEqual([]);
    expect(solid.some((h) => h.partial)).toBe(false);
  });

  it('answers a query that is nothing but stopwords with its words, not with everything', () => {
    /*
     * `the` is a word of this book as well as a word of English, so a query of
     * nothing but stopwords keeps the words it was given rather than being
     * answered with silence. The trap is the other direction: `terms.every()`
     * over an empty list is vacuously true, so dropping every word would make
     * every section a *title* hit - all sixty-nine of them, on the first
     * keystroke, which is the same defect the empty guard exists to stop
     * arriving by a different road.
     */
    expect(ruleTerms('the of')).toEqual(['the', 'of']);
    const hitsFor = searchRules(rules, 'the of');
    expect(hitsFor).not.toEqual([]);
    expect(hitsFor.length).toBeLessThan(rules.length);
    expect(hitsFor.filter((h) => h.where === 'title')).toHaveLength(1);
    expect(hitsFor.every((h) => h.partial)).toBe(false);
  });

  it('collapses the spaces the GM typed and not the ones the book did not type', () => {
    // A person typing a phrase into a field on a phone puts two spaces in it.
    // The book has none: not one of the shipped bodies carries a double space,
    // which is why the scan never rewrites 100,165 characters to find out.
    // (122,437 stood here, and it counted the Witherwild frame this dataset no
    // longer carries - `srdReference.ts` re-took it against the file that
    // ships and this line was left behind in the same commit.)
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
    // 255 of the 869 non-empty body lines are longer than the 150 characters
    // this keeps, counting a line the way the book writes it. Counted the way
    // `preview` is actually handed them it is 227 of 769: `quoteFrom` takes the
    // `## ` and `- ` off the front, and it skips a pipe row outright rather
    // than stripping it, so the book's hundred table rows are not in the
    // population at all. The bullet below is one of the long ones, and it is
    // the line the search hands the screen for `very close`. (It read 294 of
    // 969 while the dataset still carried the Witherwild frame, then 253 in a
    // unit that stripped the markup but kept the pipe rows - which is neither
    // the book's unit nor `preview`'s.)
    const hit = searchRules(rules, 'very close').find((h) => h.id === 'maps-range-and-movement')!;
    expect(hit.line!.length).toBeGreaterThan(150);
    const found = preview(hit.line!, 'very close');
    expect(found.match).toBe('Very Close');
    expect(found.after.endsWith('…')).toBe(true);
    expect(hit.line).toContain(found.after.replace(/…$/, ''));
  });
});

// ---------------------------------------------------------------------------

/**
 * Every body line the shipped SRD has, with a query built out of its own words.
 *
 * Three per line: the first content word with the last, which is the widest
 * spread that line can produce; the same pair with a word from the middle
 * between them, which is the case that puts two gaps in one preview; and a
 * later word with the last, which starts the window part-way into the line.
 * Words of four letters or more only - a two-letter term matches so often that
 * every line becomes the same test.
 *
 * This exists because the ceiling below is a claim about *the book*, not about
 * thirty queries. The failure it replaced only ever showed itself on a line
 * whose words sit at its two ends, and no query anybody had typed by hand went
 * near the one line in the file that is long enough to make it hurt.
 */
function everyLineProbed(): Array<{ id: string; line: string; query: string }> {
  const out: Array<{ id: string; line: string; query: string }> = [];
  for (const section of rules) {
    for (const raw of section.body.split('\n')) {
      const line = raw.trim().replace(/^#+\s+/, '').replace(/^-\s+/, '');
      if (line === '' || line.startsWith('|')) continue;
      const words = [...new Set(line.toLowerCase().match(/[a-z]{4,}/g) ?? [])];
      if (words.length < 2) continue;
      const first = words[0]!;
      const last = words[words.length - 1]!;
      for (const query of [
        `${first} ${last}`,
        `${first} ${words[Math.floor(words.length / 2)]!} ${last}`,
        `${words[Math.floor(words.length / 3)]!} ${last}`,
      ]) {
        if (ruleTerms(query).length > 0) out.push({ id: section.id, line, query });
      }
    }
  }
  return out;
}

/**
 * How much of a preview is the book's characters rather than the GM's words.
 *
 * The runs are merged the way the screen merges them - two marked words with
 * nothing but a space between them are drawn inside one `<mark>`, so that space
 * is part of the answer and not part of the quotation. The ellipses come out
 * too: an ellipsis is `preview` speaking, not the SRD.
 *
 * Written out here rather than imported, deliberately. This is the property the
 * ceiling *is*, and a test that measured it with the same helper the code
 * measures it with would agree with a bug in that helper.
 */
function bookIn(drawn: string, query: string): number {
  const low = drawn.toLowerCase();
  const found: Array<[number, number]> = [];
  for (const term of ruleTerms(query)) {
    for (let at = low.indexOf(term); at !== -1; at = low.indexOf(term, at + term.length)) {
      found.push([at, at + term.length]);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const runs: Array<[number, number]> = [];
  for (const [start, end] of found) {
    const last = runs.at(-1);
    if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
    else if (last !== undefined && drawn.slice(last[1], start).trim() === '') last[1] = end;
    else runs.push([start, end]);
  }
  let marked = 0;
  for (const [start, end] of runs) marked += end - start;
  return drawn.replaceAll('…', '').length - marked;
}

const drawnBy = (line: string, query: string): string => {
  const found = preview(line, query);
  return found.before + found.match + found.after;
};

describe('which line a hit quotes', () => {
  it('quotes the subhead that names the rule, not the paragraph that reached it first', () => {
    /*
     * `quoteFrom` took the first body line satisfying the AND and had no
     * preference for a `## ` subhead, so a section whose prose matched before
     * its subhead did was banded IN THE TEXT and previewed the wrong paragraph
     * - on exactly the queries that name a rule the way the book names it.
     *
     * Three of the thirty-query set's forty-two text-band hits were doing this.
     * The worst is here: `multi target attack` quoted `Attacking`'s
     * 355-character RESISTANCE, IMMUNITY, AND DIRECT DAMAGE paragraph, with
     * `multi` marked inside the word *multiple*, while `## MULTI-TARGET ATTACK
     * ROLLS` sat further down the same section and was never shown.
     */
    const cases: Array<[string, string, string]> = [
      ['multi target attack', 'attacking', 'MULTI-TARGET ATTACK ROLLS'],
      ['adversary attack roll', 'adversary-action-rolls', 'ADVERSARY ATTACKS'],
      ['fear feature adversary', 'example-adversary-features', 'FEAR FEATURES'],
    ];
    for (const [query, id, subhead] of cases) {
      const hit = searchRules(rules, query).find((h) => h.id === id)!;
      expect(hit.where, query).toBe('heading');
      expect(hit.line, query).toBe(subhead);

      // And it is a preference rather than an accident of ordering: the
      // paragraph that used to win still satisfies the AND, and still comes
      // first in the section's own body.
      const section = rules.find((r) => r.id === id)!;
      const title = section.title.toLowerCase();
      const satisfying = section.body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('|'))
        .filter((l) => ruleTerms(query).every((t) => l.toLowerCase().includes(t) || title.includes(t)));
      expect(satisfying.length, query).toBeGreaterThan(1);
      expect(/^#+\s/.test(satisfying[0]!), query).toBe(false);
      expect(satisfying.some((l) => l.replace(/^#+\s+/, '') === subhead), query).toBe(true);
    }
  });

  it('quotes the line that spells the word as a word over the one that buries it', () => {
    /*
     * The other half of the preference, and it is tested apart from the subhead
     * half on purpose: on all three cases above the subhead is *also* the
     * whole-word match, so either preference alone would have picked it and
     * neither test would notice the other going missing.
     *
     * Here nothing is a subhead. `The Basics` opens with a line ending "2-5
     * players.", where the GM's `player` is only ever inside *players*; the
     * line under it names "the Player Characters" and spells the word as a
     * word. Both satisfy the AND, the buried one comes first, and the spelled
     * one is what the hit quotes.
     */
    const hit = searchRules(rules, 'daggerheart player').find((h) => h.id === 'the-basics')!;
    expect(hit.where).toBe('text');
    expect(hit.line).toContain('Player Characters');

    const lines = rules
      .find((r) => r.id === 'the-basics')!
      .body.split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '');
    const satisfying = lines.filter((l) =>
      ruleTerms('daggerheart player').every((t) => l.toLowerCase().includes(t)),
    );
    // The first one carries `player` only inside `players`, and it is not the
    // one shown.
    expect(satisfying[0]).not.toBe(hit.line);
    expect(/\bplayer\b/i.test(satisfying[0]!)).toBe(false);
    expect(/\bPlayer\b/.test(hit.line!)).toBe(true);
    expect(lines.indexOf(satisfying[0]!)).toBeLessThan(lines.indexOf(hit.line!));
  });

  it('changes which line a section shows and never which sections answer', () => {
    // The preference is about the preview, not about membership. Across the
    // whole shipped file, asking for a section's own words returns the same
    // sections whichever line ends up being quoted - so a subhead that wins the
    // tie can never add a hit or lose one.
    for (const query of ['multi target attack', 'adversary attack roll', 'fear feature adversary', 'fear']) {
      const hits = searchRules(rules, query);
      for (const hit of hits) {
        const section = rules.find((r) => r.id === hit.id)!;
        const haystack = `${section.title}\n${section.body}`.toLowerCase();
        for (const term of ruleTerms(query)) expect(haystack, `${query} / ${hit.id}`).toContain(term);
      }
      // No duplicates, and every hit is a section of the dataset.
      expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length);
    }
    expect(searchRules(rules, 'fear')).toHaveLength(19);
  });
});

// ---------------------------------------------------------------------------

describe('the ceiling on a shut preview', () => {
  it('does not hand a GM the longest line in the book for a hit they have not opened', () => {
    /*
     * The window widened to hold every mark and stopped there, which is not a
     * ceiling: its width was whatever the book's spacing said. A line whose
     * words sit at its two ends came back **whole**, and the SRD has a
     * 745-character one - `Avoid Death:` in `Death`. A verifier measured that
     * preview in Chrome at 363px and it was 199.5px tall: 4.5 times the 44px
     * tap floor, about 31.5% of a results viewport of roughly 634px, for a hit
     * nobody had opened. That figure is theirs; nothing here re-takes it, and
     * what this test can hold is the characters rather than the pixels.
     */
    const longest = rules
      .flatMap((r) => r.body.split('\n').map((l) => l.trim().replace(/^#+\s+/, '').replace(/^-\s+/, '')))
      .reduce((a, b) => (b.length > a.length ? b : a));
    expect(longest.length).toBe(745);
    expect(longest.startsWith('Avoid Death:')).toBe(true);

    const drawn = drawnBy(longest, 'avoid death scar');
    // It used to be 642 characters of this one line. It is a fraction of that
    // now, and every word the GM typed is still in it.
    expect(drawn.length).toBeLessThan(250);
    expect(bookIn(drawn, 'avoid death scar')).toBeLessThanOrEqual(150);
    for (const term of ruleTerms('avoid death scar')) expect(drawn.toLowerCase(), term).toContain(term);
    // The cut is in the middle and it says so, rather than being a silent join.
    expect(drawn).toContain('…');
    expect(drawn.startsWith('Avoid Death:')).toBe(true);
  });

  it('keeps every word marked and stays under the ceiling, on every line the book has', () => {
    /*
     * The whole rule, over the whole file. `preview` may cut the book down to
     * `BEFORE + AFTER` characters and no further; what it may never do is drop
     * one of the GM's words off the end of the preview, because a preview
     * missing a word the line carries is the search claiming a match it will
     * not show.
     */
    const probes = everyLineProbed();
    expect(probes.length).toBeGreaterThan(2000);
    let widest = 0;
    let mostBook = 0;
    for (const { line, query, id } of probes) {
      const drawn = drawnBy(line, query);
      widest = Math.max(widest, drawn.length);
      const book = bookIn(drawn, query);
      mostBook = Math.max(mostBook, book);
      expect(book, `${query} @ ${id}`).toBeLessThanOrEqual(150);
      for (const term of ruleTerms(query)) {
        if (line.toLowerCase().includes(term)) {
          expect(drawn.toLowerCase(), `${term} :: ${query} @ ${id}`).toContain(term);
        }
      }
    }
    // Measured, not assumed: these are what the shipped file comes to, and the
    // window before the ceiling drew 745 characters at its widest.
    expect(widest).toBeLessThanOrEqual(200);
    expect(mostBook).toBeLessThanOrEqual(150);
  });

  it('leaves a preview the ceiling does not bind exactly as long as it was', () => {
    // The ceiling is a bound, not a rewrite. One mark spends 34 characters in
    // front and 116 behind and has no gap in the middle to pay for, so the
    // ordinary preview - which is most of them - comes back untouched, and the
    // whole line still comes back whole when the whole line is inside budget.
    expect(drawnBy('Very Close: 3 squares', 'very close')).toBe('Very Close: 3 squares');

    const short = `Marked: ${'x'.repeat(100)}`;
    expect(drawnBy(short, 'marked')).toBe(short);

    const long = `${'alpha '.repeat(40)}NEEDLE${' omega'.repeat(40)}`;
    const found = preview(long, 'needle');
    expect(found.before.startsWith('…')).toBe(true);
    expect(found.after.endsWith('…')).toBe(true);
    expect(found.match).toBe('NEEDLE');
    // One mark, so the tail is the full 116 and nothing in the middle is cut.
    expect(found.after.replace(/…$/, '')).not.toContain('…');
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
    // Named rather than described: a door carries its label alone since the
    // sentences moved beside the Settings switches on 2026-08-25.
    const doorText = (): string => dialog().textContent ?? '';
    expect(doorText()).toContain('BESTIARY');
    expect(doorText()).toContain('THE PARTY BOARD');
    expect(doorText()).toContain('THE MERCHANT');

    type('fear');
    expect(doorText()).not.toContain('BESTIARY');
    expect(doorText()).not.toContain('THE PARTY BOARD');
    expect(doorText()).not.toContain('THE MERCHANT');

    type('');
    expect(doorText()).toContain('BESTIARY');
    expect(doorText()).toContain('THE PARTY BOARD');
    expect(doorText()).toContain('THE MERCHANT');
  });

  it('is still there when only one of SHOW’s doors is switched on', () => {
    // The search rides on SHOW rather than being a door of its own, so it must
    // not depend on any door being drawn.
    useApp.setState({
      prefs: { ...DEFAULT_PREFS, gmBestiary: false, gmMerchant: false },
    });
    openShow();
    expect(dialog().textContent).toContain('THE PARTY BOARD');
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
      // The rest of the book stands under the sections, banded by kind. The
      // words `countdown` reaches out there are in domain cards and adversary
      // features, and they are twenty-six rows the GM could not see at all
      // before this: the section bands above are unchanged, and what used to be
      // the whole answer is now the top of it.
      ...kindBands('countdown'),
    ]);
    // The header order is the list order: the named ones are drawn first, and
    // the sections come before the rest of the book.
    expect(hitTitles()).toEqual(found.map((h) => h.title));
    expect(recordNames()).toEqual(searchSrd(beyondRules, 'countdown').map((h) => h.name));
  });

  it('draws only the group it has, and says how many sections in one live line', () => {
    openShow();
    type('pitfalls');
    expect(groupHeaders()).toEqual(['IN THE TITLE · 1']);
    // No card, no adversary and no weapon carries the word, so the sentence is
    // the one it always was: the third clause is appended only when there is
    // something out there to append.
    expect(searchSrd(beyondRules, 'pitfalls')).toEqual([]);
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      '1 section matches',
    );

    type('fear');
    // Three bands of the book's, not two: `fear` reaches `Pitfalls to Avoid`
    // through its HOARDING FEAR subhead, and a subhead gets its own header.
    // Three sections in that band rather than the one this asserted while
    // `quoteFrom` took the first satisfying line it met: `Using Adversaries`
    // and `Example Adversary Features` each open with prose carrying the word
    // and each own a FEAR FEATURE(S) subhead further down, and the subhead is
    // the one that names the rule. The nineteen hits are the same nineteen
    // sections either way - what moved is which line three of them quote, and
    // so which band they stand in.
    //
    // And one band of the app's own, above all three. `fear` finds exactly one
    // question - the one indexed under `success with fear` - which is asserted
    // here rather than derived, because a helper that computed it from the same
    // matcher the screen used would agree with the screen whatever either did.
    expect(searchAsk(ASK_CATALOGUE, 'fear').map((entry) => entry.id)).toEqual([
      'q-blank-consequence',
    ]);
    // Four of the book's and the app's, and then one per kind out in the rest
    // of the book. The four are what this test was written about and they are
    // unchanged; the rest are counted rather than named so that a kind entering
    // or leaving the dataset moves this number instead of breaking the claim.
    expect(groupHeaders()).toHaveLength(4 + kindBands('fear').length);
    expect(groupHeaders()[0]).toBe('QUESTIONS · 1');
    expect(groupHeaders()[2]).toBe('IN A HEADING · 3');
    // The live line names both, questions first, in the order the glass draws
    // them. `spoken` is what a GM who cannot see the bands is given instead of
    // them, so a question above the list that it did not mention would put the
    // catalogue behind the whole result for exactly one reader.
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      `1 question and ${String(searchRules(rules, 'fear').length)} sections match; ` +
        `${String(searchSrd(beyondRules, 'fear').length)} elsewhere in the book`,
    );
  });

  it('marks the GM’s words inside the line, spelled the way the book spells them', () => {
    openShow();
    type('very close');
    const marks = [...dialog().querySelectorAll('mark')];
    expect(marks).not.toEqual([]);
    /*
     * This read `for (const m of marks) expect(m.textContent).toBe('Very
     * Close')`, and it was right while the search matched one phrase and drew
     * one run. It cannot be right now and should not be: `very close` is two
     * words, and the range bullet says `Close enough to see fine details`
     * eleven characters after it - one of the GM's words, on its own, in the
     * same line. Marking it is the feature.
     *
     * What was actually being asserted survives whole, in two halves. Every
     * marked run is **the book's characters** - it is a slice of the shipped
     * dataset, in the dataset's case, never the lower-case string that was
     * typed - and every marked run is **one of the words the GM typed**,
     * never a word the screen chose.
     */
    const terms = ruleTerms('very close');
    for (const m of marks) {
      const text = m.textContent ?? '';
      expect(text).not.toBe('');
      expect(rules.some((r) => `${r.title}\n${r.body}`.includes(text)), text).toBe(true);
      expect(text.toLowerCase().split(' ').every((w) => terms.includes(w)), text).toBe(true);
    }
    // Two words the book wrote side by side are still one run: `Very Close` is
    // the name of a range, and a mark that split it would put a hole in it.
    expect(marks.map((m) => m.textContent)).toContain('Very Close');
    // And the second word on its own, further along the same line, is marked
    // too - which is the whole of what changed.
    expect(marks.map((m) => m.textContent)).toContain('Close');
    // And not a lamp in a dim room: the highlight is weight and ink, no block.
    expect(marks[0]!.style.background).toBe('transparent');
    expect(marks[0]!.style.fontWeight).toBe('700');
  });

  it('marks every word on a line, not just the first one it finds', () => {
    // `falling damage` lands on the subhead FALLING AND COLLISION DAMAGE, and
    // the GM's two words are at its two ends: one run is not enough.
    //
    // This read "fifty-five of the sixty-one preview lines this search produces
    // over thirty phrasings need two marks or more". Both figures came off a
    // thirty-query set that is nowhere in this repository, so neither could be
    // re-derived from anything a reader can open, and `RuleSearch.tsx`
    // withdrew them rather than mint a replacement. This assertion is what the
    // sentence was standing in for anyway, and unlike the sentence it goes red
    // when the dataset moves.
    openShow();
    type('falling damage');
    const line = hits()[0]!.querySelector('span.t-dense')!;
    const marks = [...line.querySelectorAll('mark')].map((m) => m.textContent);
    expect(marks).toEqual(['FALLING', 'DAMAGE']);
    // Nothing between them was reworded or dropped: the line comes back whole.
    expect(line.textContent).toBe(searchRules(rules, 'falling damage')[0]!.line);
  });

  it('marks in the header and in the line when the words are split between them', () => {
    openShow();
    type('restrained condition');
    const header = hits()[0]!;
    expect(header.querySelector('span.t-label > mark')?.textContent).toBe('Condition');
    expect(header.querySelector('span.t-dense > mark')?.textContent).toBe('RESTRAINED');
    // One tap target, both words on it. Nothing has to confess a split that
    // the GM is not going to see as one.
    expect(header.style.minHeight).toBe('44px');
  });

  it('marks every word a far-apart line carries without previewing the whole line', () => {
    /*
     * This asserted the same property on `multi target attack` against
     * `Attacking`, and both halves of that example have since moved.
     *
     * The line moved first. That hit quoted a 355-character paragraph about
     * resistance and immunity, with `multi` marked inside the word *multiple*,
     * while the section's own `## MULTI-TARGET ATTACK ROLLS` subhead - the
     * answer - was eight lines further down and never shown. `quoteFrom` now
     * prefers the subhead, so `Attacking` is a nineteen-character heading hit
     * and no longer a line with anything far apart on it.
     *
     * Then the window moved. It used to widen to hold every mark and stop
     * there, which had no ceiling in it: the widest preview the thirty-query
     * set drew was 407 characters, and a line whose words sit at its two ends
     * came back whole - all 745 characters of `Avoid Death:` in `Death`, for a
     * hit the GM had not opened.
     *
     * So the property is asserted where it still lives, and it is now two
     * properties rather than one. `spending fear` answers with `Tag Team Rolls`
     * on a 473-character line whose first and last marks are 322 apart: every
     * word the line carries is marked, and the preview is 157 characters rather
     * than 473, because the book between the marks is what gets cut and never a
     * mark.
     */
    openShow();
    type('spending fear');
    const hit = searchRules(rules, 'spending fear').find((h) => h.id === 'tag-team-rolls')!;
    const terms = ruleTerms('spending fear');
    const low = hit.line!.toLowerCase();
    const spots = terms.filter((t) => low.includes(t)).flatMap((t) => [low.indexOf(t), low.indexOf(t) + t.length]);
    expect(Math.max(...spots) - Math.min(...spots)).toBeGreaterThan(150);
    expect(hit.line!.length).toBeGreaterThan(400);

    const line = hits()[hitTitles().indexOf('Tag Team Rolls')]!.querySelector('span.t-dense')!;
    const marked = [...line.querySelectorAll('mark')].map((m) => (m.textContent ?? '').toLowerCase());
    // Every word, still. This is the half that must never be traded away.
    for (const t of terms) if (low.includes(t)) expect(marked, t).toContain(t);
    // And the ceiling: a shut hit does not get to quote four hundred characters
    // of the book at a GM who has not asked it to.
    expect((line.textContent ?? '').length).toBeLessThan(hit.line!.length / 2);
    expect(line.textContent).toContain('…');
  });

  it('says over the list when it could only find some of the words', () => {
    openShow();
    type('setting difficulty');
    const some = searchRules(rules, 'setting difficulty');
    expect(groupHeaders()).toEqual([
      `NO SECTION CARRIES ALL OF THOSE WORDS · THESE CARRY SOME · ${String(some.length)}`,
    ]);
    // One header, standing in for the three - not a fourth band under them.
    expect(hits()).toHaveLength(some.length);

    // And it is gone the moment the AND has anything to say - over the
    // sections. The kind bands below it are the records that carry both words
    // outright, and they are not part of what the SOME header stands in for:
    // that header speaks about sections, and it is drawn instead of the three
    // section bands rather than instead of the list.
    type('falling damage');
    expect(groupHeaders()).toEqual(['IN A HEADING · 1', ...kindBands('falling damage')]);
  });

  it('marks the title of a section that is named for the phrase', () => {
    openShow();
    type('pitfalls');
    const mark = dialog().querySelector('mark');
    expect(mark?.textContent).toBe('Pitfalls');
    expect(mark?.closest('span')?.className).toBe('t-label');
  });

  it('lands the GM on the subhead the heading band promised, not the top of the section', () => {
    /*
     * The band said IN A HEADING and printed `SOFT AND HARD MOVES`. Opening it
     * drew *Making GM Moves* from its first block, which put that subhead most
     * of a screen below where the GM landed - the right section and then a
     * scroll hunt for the thing the row had already quoted at them.
     *
     * jsdom has no layout and no `scrollIntoView`, so what is checkable here is
     * which element the component asks to bring into view. That is the whole of
     * the decision this file makes; where a real browser then puts it is the
     * browser's.
     */
    const asked: Element[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown };
    // Restored from the descriptor rather than by deleting: jsdom ships no
    // `scrollIntoView`, so deleting on the wrong branch would either strip a
    // real one or leave this stub standing for every test after it.
    const was = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
    proto.scrollIntoView = function scrollIntoView(this: Element): void {
      asked.push(this);
    };
    try {
      openShow();
      type('soft move hard move');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      // The row is quoting the subhead, which is what makes landing elsewhere a
      // broken promise rather than a preference.
      expect(hits()[at]!.querySelector('span.t-dense')!.textContent).toBe('SOFT AND HARD MOVES');

      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      // And it is the block that carries the subhead, not the section's first.
      expect(asked[0]!.textContent!.startsWith('SOFT AND HARD MOVES')).toBe(true);
      const blocks = ruleSection(rules, 'making-gm-moves')!.blocks;
      expect(blocks.findIndex((b) => b.heading === 'SOFT AND HARD MOVES')).toBeGreaterThan(0);

      // A title hit promised the section, so the section's top is the answer
      // and nothing is scrolled.
      asked.length = 0;
      type('countdown');
      expect(hits()[0]!.getAttribute('aria-expanded')).toBe('false');
      click(hits()[0]!);
      expect(searchRules(rules, 'countdown')[0]!.line).toBeNull();
      expect(asked).toEqual([]);
    } finally {
      if (was === undefined) delete proto.scrollIntoView;
      else Object.defineProperty(proto, 'scrollIntoView', was);
    }
  });

  it('lands on the subhead itself, not on an earlier block that quotes it', () => {
    /*
     * The landing above matched a heading *or* a block whose prose contained
     * it, and `making-gm-moves` is a section that does both: its QUICK
     * REFERENCE block writes `the "Example GM Moves" list` in a sentence, and
     * two blocks further down `## Example GM Moves` is the list itself. So the
     * band that had named a subhead landed the GM on the block that only
     * mentioned it - the defect the landing exists to fix, back again inside
     * the fix.
     *
     * Both halves of that are asserted from the dataset rather than assumed,
     * so this goes red if the SRD stops quoting its own subhead as well as if
     * the lookup starts searching prose for a heading again.
     */
    const blocks = ruleSection(rules, 'making-gm-moves')!.blocks;
    const owner = blocks.findIndex((b) => b.heading === 'Example GM Moves');
    const quoter = blocks.findIndex((b) =>
      b.parts.some((p) => p.kind === 'text' && p.text.includes('Example GM Moves')),
    );
    expect(quoter).toBeGreaterThanOrEqual(0);
    expect(quoter).toBeLessThan(owner);

    landings((asked) => {
      openShow();
      type('example moves');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      const hit = searchRules(rules, 'example moves').find((h) => h.id === 'making-gm-moves')!;
      // The band promised a subhead, which is what makes landing elsewhere a
      // broken promise rather than a preference.
      expect(hit.where).toBe('heading');
      expect(hit.line).toBe('Example GM Moves');

      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.textContent!.startsWith('Example GM Moves')).toBe(true);
      // Not the block that merely says the words.
      expect(asked[0]!.textContent).not.toContain('QUICK REFERENCE');
    });
  });

  it('lands a text hit on the paragraph that carries the quoted line', () => {
    /*
     * The band said IN THE TEXT and quoted a line out of the middle of the
     * section. `hope-and-fear` draws three blocks and the line is in the
     * second, so landing on the first would be the top of the section again -
     * and landing on the second is the top of a block whose prose runs on past
     * the line the row quoted. The `<p>` is the answer to both.
     *
     * The line is in a prose part and in nothing else - asserted here, so a
     * survivor of the prose lookup cannot be a bullet quietly covering for it.
     */
    const hit = searchRules(rules, 'spending fear').find((h) => h.id === 'hope-and-fear')!;
    expect(hit.where).toBe('text');
    const blocks = ruleSection(rules, 'hope-and-fear')!.blocks;
    expect(blocks.length).toBeGreaterThan(1);
    const inProse = blocks.findIndex((b) =>
      b.parts.some((p) => p.kind === 'text' && p.text.includes(hit.line!)),
    );
    expect(inProse).toBeGreaterThan(0);
    expect(
      blocks.some((b) => b.parts.some((p) => p.kind === 'list' && p.items.includes(hit.line!))),
    ).toBe(false);
    expect(blocks.some((b) => b.heading === hit.line)).toBe(false);
    // Not the block's first part either, so the block's top and the line are
    // two different places and this test can tell them apart.
    const part = blocks[inProse]!.parts.findIndex(
      (p) => p.kind === 'text' && p.text === hit.line,
    );
    expect(part).toBeGreaterThan(0);

    landings((asked) => {
      openShow();
      type('spending fear');
      const at = hitTitles().indexOf('Hope & Fear');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.tagName).toBe('P');
      expect(asked[0]!.textContent).toBe(hit.line);
      // And inside the block the old landing reached, not somewhere else: the
      // unit got finer, the block did not move.
      expect(asked[0]!.closest('div.stack')!.textContent!.startsWith(blocks[inProse]!.heading!))
        .toBe(true);
    });
  });

  it('lands a text hit on the bullet that is the quoted line', () => {
    /*
     * The other arm, and the one the prose arm cannot cover for: the line
     * `making-gm-moves` quotes for `golden opportunity` is a bullet, it is a
     * bullet in exactly one block, and it appears in no paragraph of the
     * section at all - so if this lands anywhere it landed through the list
     * lookup.
     */
    const hit = searchRules(rules, 'golden opportunity').find((h) => h.id === 'making-gm-moves')!;
    expect(hit.where).toBe('text');
    const blocks = ruleSection(rules, 'making-gm-moves')!.blocks;
    const inList = blocks.findIndex((b) =>
      b.parts.some((p) => p.kind === 'list' && p.items.includes(hit.line!)),
    );
    expect(inList).toBeGreaterThan(0);
    expect(
      blocks.some((b) => b.parts.some((p) => p.kind === 'text' && p.text.includes(hit.line!))),
    ).toBe(false);
    expect(blocks.some((b) => b.heading === hit.line)).toBe(false);

    landings((asked) => {
      openShow();
      type('golden opportunity');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.tagName).toBe('LI');
      expect(asked[0]!.textContent).toBe(hit.line);
      expect(asked[0]!.closest('div.stack')!.textContent!.startsWith(blocks[inList]!.heading!))
        .toBe(true);
    });
  });

  it('asks for one node when the same bullet is in the landing block twice', () => {
    /*
     * The measurement that decides the shape of the prop, and the only test
     * that can tell the two shapes apart.
     *
     * `making-gm-moves` writes the same four lines twice inside `CHOOSING GM
     * MOVES`: flattened under the Success-with-Fear bullet, and again as a list
     * of their own under the Failure-with-Hope paragraph. The book is repeating
     * four consequences for two roll outcomes, so a parser that nested would
     * still emit the string twice inside the one `## `. A `land` prop that
     * named the *string* would hand the ref to both `<li>`s and ask for two
     * scrolls; one that names the part and item indices asks for one.
     *
     * Both occurrences are read out of the dataset first, so this cannot pass
     * vacuously if the SRD stops repeating itself.
     */
    const hit = searchRules(rules, 'adversary attacks').find((h) => h.id === 'making-gm-moves')!;
    expect(hit.line).toBe('An adversary attacks');
    const blocks = ruleSection(rules, 'making-gm-moves')!.blocks;
    const landing = landingIn(ruleSection(rules, 'making-gm-moves')!, hit)!;
    const carriers = blocks[landing.block]!.parts.flatMap((p, i) =>
      p.kind === 'list' && p.items.includes(hit.line!) ? [i] : [],
    );
    expect(carriers).toHaveLength(2);
    // The first in document order, which is the one `quoteFrom` read.
    const twin = blocks[landing.block]!.parts[carriers[0]!]!;
    expect(landing.at).toEqual({
      kind: 'item',
      part: carriers[0],
      item: twin.kind === 'list' ? twin.items.indexOf(hit.line!) : -1,
    });

    landings((asked) => {
      openShow();
      type('adversary attacks');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      const twins = [...dialog().querySelectorAll('li')].filter(
        (n) => n.textContent === hit.line,
      );
      expect(twins).toHaveLength(2);
      expect(asked).toHaveLength(1);
      expect(asked[0]).toBe(twins[0]);
    });
  });

  it('lands on the GM’s own line inside a section the SRD draws as one block', () => {
    /*
     * The limit that was, written down as a test rather than as a sentence. A
     * section with no `## ` in it is one block, so its landing block is the
     * block the section already opened with, and the GM used to arrive at the
     * top of their section rather than on their line. Reaching the line meant
     * changing `BlockView`, and `BlockView` now takes an optional place to put
     * the caller's ref, so it is reached.
     *
     * The counts stay so they go red on a dataset change instead of ageing
     * quietly in a docblock, which is how this file lost figures before.
     */
    const single = rules.filter((r) => ruleSection(rules, r.id)!.blocks.length === 1);
    expect(rules).toHaveLength(69);
    expect(single).toHaveLength(34);
    // Not vacuous the other way either: most sections do have subheads to land
    // on, which is what makes the landing worth having at all.
    expect(rules.length - single.length).toBe(35);

    const section = single.find((r) => r.id === 'stress')!;
    const hit = searchRules(rules, 'stress mark clear').find((h) => h.id === section.id)!;
    expect(hit.line).not.toBeNull();
    // One block, so the block was the only place there was to land.
    const blocks = ruleSection(rules, section.id)!.blocks;
    expect(blocks).toHaveLength(1);
    // And the whole of what the old defect measured: the line is not the first
    // thing that block draws, so the block's top and the line are apart.
    expect(blocks[0]!.parts.findIndex((p) => p.kind === 'text' && p.text === hit.line))
      .toBeGreaterThan(0);

    landings((asked) => {
      openShow();
      type('stress mark clear');
      const at = hitTitles().indexOf(section.title);
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      // The GM's own paragraph, not the section it is in.
      expect(asked[0]!.tagName).toBe('P');
      expect(asked[0]!.textContent).toBe(hit.line);
      // The block is still drawn whole around it - nothing was hidden to get
      // here - and the line still sits some way into it.
      const drawn = asked[0]!.closest('div.stack')!.textContent!;
      expect(drawn.indexOf(hit.line!)).toBeGreaterThan(0);
    });
  });

  it('follows the quoted line when a keystroke moves it inside the same block', () => {
    /*
     * The cost of landing on the part instead of on the block, pinned rather
     * than left to be discovered.
     *
     * A hit stays open while the GM keeps typing: `openId` is state and is not
     * cleared on a new query, and `Hit` is keyed on `hit.id`. So a keystroke
     * that makes `quoteFrom` quote a different line of the *same* block used to
     * change nothing at all - one landing block, one node, the ref never moved.
     * It now moves the GM's reading position onto the newly quoted line.
     *
     * `stress` is one block of four paragraphs. `stress mark` quotes its first
     * and `stress mark clear` quotes its second, so the two queries differ by a
     * word the GM would type and by nothing else. Both are read out of the
     * dataset here rather than assumed.
     */
    const section = ruleSection(rules, 'stress')!;
    expect(section.blocks).toHaveLength(1);
    const first = searchRules(rules, 'stress mark').find((h) => h.id === 'stress')!;
    const then = searchRules(rules, 'stress mark clear').find((h) => h.id === 'stress')!;
    expect(first.line).not.toBe(then.line);
    expect(landingIn(section, first)!.block).toBe(landingIn(section, then)!.block);

    landings((asked) => {
      openShow();
      type('stress mark');
      const at = hitTitles().indexOf('Stress');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.textContent).toBe(first.line);

      // The GM types one more word. The hit is the same hit and stays open.
      type('stress mark clear');
      expect(hits()[hitTitles().indexOf('Stress')]!.getAttribute('aria-expanded')).toBe('true');
      expect(asked).toHaveLength(2);
      expect(asked[1]!.textContent).toBe(then.line);
    });
  });

  it('lights the GM’s words in the section that opens, not only in the preview', () => {
    /*
     * The debt the docblock declared and did not pay: the GM's words were
     * marked in the preview line and nowhere in the body that opened, so the
     * line they were carried to arrived with no word on it lit.
     *
     * `spending fear` lands on a paragraph of `hope-and-fear` that carries
     * `spending` and leaves `fear` to the title, so the mark expected here is
     * one word, in the book's own spelling of it.
     */
    const hit = searchRules(rules, 'spending fear').find((h) => h.id === 'hope-and-fear')!;
    expect(hit.line).toContain('spending');
    expect(hit.line!.toLowerCase()).not.toContain('fear');

    landings((asked) => {
      openShow();
      type('spending fear');
      const at = hitTitles().indexOf('Hope & Fear');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      const landed = asked[0]!;
      expect(landed.tagName).toBe('P');
      expect([...landed.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['spending']);
      // A mark is a split and never a rewrite: the paragraph still reads,
      // character for character, the line the row quoted.
      expect(landed.textContent).toBe(hit.line);
    });
  });

  it('lights the subhead it lands on, in the book’s case and not the typed one', () => {
    /*
     * The other text call site inside a block, and the one the heading band
     * lands on. The GM typed three lower-case words; what is lit is the book's
     * capitals, and `SOFT AND HARD MOVES` comes back as one run for `soft` and
     * a second for `hard` and `move` together, because the book wrote those two
     * with nothing but a space between them.
     */
    landings((asked) => {
      openShow();
      type('soft move hard move');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      const label = asked[0]!.querySelector('span.t-label')!;
      expect(label.textContent).toBe('SOFT AND HARD MOVES');
      expect([...label.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
        'SOFT',
        'HARD MOVE',
      ]);
    });
  });

  it('lights the block it landed on and no other block of the same section', () => {
    /*
     * The owner's decision of 2026-08-25 §8, pinned. Lighting every occurrence
     * in the open section makes the mark noise instead of a direction, and
     * `making-gm-moves` is the case that shows it: every one of its blocks
     * carries `move`, so a section-wide walk would light all of them and the
     * one the GM was carried to would stop standing out.
     *
     * The block-by-block check is read out of the dataset first, so this cannot
     * pass because the section quietly stopped repeating the word.
     */
    const blocks = ruleSection(rules, 'making-gm-moves')!.blocks;
    expect(blocks.length).toBeGreaterThan(1);
    for (const block of blocks) {
      const whole = [
        block.heading ?? '',
        ...block.parts.map((p) =>
          p.kind === 'text' ? p.text : p.kind === 'list' ? p.items.join(' ') : '',
        ),
      ].join(' ');
      expect(whole.toLowerCase()).toContain('move');
    }

    landings((asked) => {
      openShow();
      type('soft move hard move');
      const at = hitTitles().indexOf('Making GM Moves');
      expect(at).toBeGreaterThanOrEqual(0);
      const header = hits()[at]!;
      click(header);
      const opened = header.closest('section')!;
      const inBody = [...opened.querySelectorAll('mark')].filter((m) => !header.contains(m));
      expect(inBody).not.toEqual([]);
      for (const m of inBody) expect(asked[0]!.contains(m), m.textContent ?? '').toBe(true);
    });
  });

  it('leaves the cells of a table unlit, because they are not this file’s to split', () => {
    /*
     * The one text on an open section that does not go through the mark walk.
     * `RuleTableView` draws a cell, and a table hit has no line to land on at
     * all - `quoteFrom` skips pipe rows, so `hit.line` is null and there is
     * nothing inside one to point at.
     *
     * `equipment prices` lands on the paragraph above the Average Costs table
     * and takes `equipment` from the section's title, which four of that
     * table's own cells also carry. Those four are what makes this test say
     * something.
     */
    const table = ruleSection(rules, 'giving-out-gold-equipment-and-loot')!.blocks[0]!.parts.find(
      (p) => p.kind === 'table',
    )!;
    const cells =
      table.kind === 'table'
        ? [...table.table.header, ...table.table.rows.flat()].filter((c) =>
            c.toLowerCase().includes('equipment'),
          )
        : [];
    expect(cells.length).toBeGreaterThan(0);

    landings((asked) => {
      openShow();
      type('equipment prices');
      const at = hitTitles().indexOf('Giving Out Gold, Equipment, and Loot');
      expect(at).toBeGreaterThanOrEqual(0);
      click(hits()[at]!);
      expect(asked[0]!.tagName).toBe('P');
      expect([...asked[0]!.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['prices']);
      // The cells are drawn - the table is on screen - and not one of them is
      // lit. `span.t-read` is `RuleTableView`'s cell; `p.t-read` is the prose.
      const opened = hits()[at]!.closest('section')!;
      expect(opened.querySelectorAll('span.t-read').length).toBeGreaterThan(0);
      expect(opened.querySelectorAll('span.t-read mark')).toHaveLength(0);
    });
  });

  it('lights the whole of a section the SRD draws as one block, which is what §8 leaves', () => {
    /*
     * The residual of the owner's decision of 2026-08-25 §8, pinned rather than
     * left in a docblock to age. §8 lights the landing block and not the open
     * section; where the SRD draws a section as one block those are the same
     * thing, and `using-fear` is the widest of the 34 - one block of twelve
     * parts, ten of which carry a word of `spend a fear`.
     *
     * The query `fear` on its own is *not* this case, which is worth having
     * here because it is the query §8 names: it names the section, so it is a
     * title hit, and a title hit has no landing and lights nothing.
     *
     * Red if somebody narrows the mark from the landing block to the landing
     * part - a decision §8 did not take, and one that would have to gate `ink`
     * at all three of `BlockView`'s text call sites. Both a paragraph and a
     * bullet away from the landing are checked, so narrowing one of the three
     * and not the others cannot slip through either.
     */
    const section = ruleSection(rules, 'using-fear')!;
    expect(section.blocks).toHaveLength(1);
    expect(section.blocks[0]!.parts).toHaveLength(12);
    expect(searchRules(rules, 'fear').find((h) => h.id === 'using-fear')!.line).toBeNull();

    landings((asked) => {
      openShow();
      type('spend a fear');
      const at = hitTitles().indexOf('Using Fear');
      expect(at).toBeGreaterThanOrEqual(0);
      const header = hits()[at]!;
      click(header);
      expect(asked[0]!.tagName).toBe('P');
      expect(asked[0]!.querySelectorAll('mark').length).toBeGreaterThan(0);
      // And so is the rest of the block, because here the block is the section:
      // another paragraph the GM did not land on, and a bullet as well.
      const opened = header.closest('section')!;
      const lit = (selector: string): Element[] =>
        [...opened.querySelectorAll(selector)].filter((n) => n.querySelector('mark') !== null);
      expect(lit('p.t-read').filter((n) => n !== asked[0]).length).toBeGreaterThan(0);
      expect(lit('li.t-read').length).toBeGreaterThan(0);
      expect(lit('p.t-read')).toContain(asked[0]);
    });
  });

  it('finds a landing of its own for every line the search can quote', () => {
    /*
     * The agreement between `quoteFrom` - which decides which line the GM is
     * shown - and `landingIn` - which decides where that line is drawn - over
     * the whole book rather than over the four queries named above.
     *
     * The population is the one `quoteFrom` itself works in: every non-empty
     * body line that is not a pipe row, with the SRD's own `## ` and `- ` taken
     * off the front, which is the line a hit would carry verbatim.
     *
     * The totals are asserted so a dataset change goes red here instead of
     * quietly ageing a sentence somewhere. The one that matters most is the
     * zero: not one line in the shipped SRD needs the `includes` fallback, so
     * every prose part is exactly one line of the book and nothing had to be
     * split to land on one. The day a layer or a folio writes a paragraph
     * across two lines, that zero moves and the fallback stops being theory.
     */
    let headings = 0;
    let body = 0;
    let fallback = 0;
    for (const section of rules) {
      const view = ruleSection(rules, section.id)!;
      for (const raw of section.body.split('\n')) {
        const text = raw.trim();
        if (text === '' || text.startsWith('|')) continue;
        const line = text.replace(/^#+\s+/, '').replace(/^-\s+/, '');
        if (line === '') continue;
        const heading = /^#+\s/.test(text);
        const hit: RuleHit = {
          id: section.id,
          title: section.title,
          page: null,
          where: heading ? 'heading' : 'text',
          line,
          partial: false,
        };
        const landing = landingIn(view, hit);
        expect(landing, `${section.id} :: ${line}`).not.toBeNull();
        const block = view.blocks[landing!.block]!;
        const at = landing!.at;
        if (heading) {
          headings += 1;
          expect(at.kind, `${section.id} :: ${line}`).toBe('block');
          expect(block.heading).toBe(line);
          continue;
        }
        body += 1;
        expect(at.kind, `${section.id} :: ${line}`).not.toBe('block');
        const part = block.parts[at.kind === 'block' ? 0 : at.part]!;
        if (at.kind === 'item') {
          expect(part.kind).toBe('list');
          expect(part.kind === 'list' ? part.items[at.item] : null).toBe(line);
        } else {
          expect(part.kind).toBe('text');
          // Exact, not merely containing: the fallback is counted rather than
          // forbidden, so a homebrew layer would move a number instead of
          // failing an assertion nobody could read.
          if (part.kind === 'text' && part.text !== line) fallback += 1;
        }
      }
    }
    expect(headings).toBe(156);
    expect(body).toBe(613);
    expect(headings + body).toBe(769);
    expect(fallback).toBe(0);
  });

  it('prefers the paragraph that is the line over one that merely contains it', () => {
    /*
     * The only two properties of `landingIn` the shipped SRD cannot show,
     * because the shipped SRD has neither shape in it: every prose part it
     * carries is exactly one line of the book, which is what the count above
     * asserts. `dataset.ts` resolves layers and `rules` is overridable, so both
     * shapes are a homebrew layer away, and this is the section such a layer
     * would produce - written here rather than taken from the data, because
     * inventing SRD text into `data/` is the one thing this repo forbids.
     *
     * First: equality beats containment, wherever each sits. A paragraph higher
     * up the section that quotes the line inside a longer sentence must not
     * take the landing off the paragraph that *is* the line - which is the same
     * defect, one level down, that `where` fixed for subheads.
     *
     * Second: when nothing is equal, the landing is the **paragraph that
     * carries** the line and not the line. That is the owner's answer of
     * 2026-08-25 §7: better than the block it used to be, and it leaves a
     * per-line node additive rather than needed.
     */
    const line = 'Mark a Stress to hold the door.';
    const layered: SectionView = {
      id: 'homebrew',
      title: 'Homebrew',
      page: null,
      blocks: [
        {
          heading: null,
          parts: [
            { kind: 'text', text: `The GM may say: ${line} That is the whole of it.` },
            { kind: 'text', text: line },
          ],
        },
      ],
    };
    const hit: RuleHit = {
      id: 'homebrew',
      title: 'Homebrew',
      page: null,
      where: 'text',
      line,
      partial: false,
    };
    expect(landingIn(layered, hit)).toEqual({ block: 0, at: { kind: 'part', part: 1 } });

    // And with the equal paragraph gone, the one that contains it: a layer that
    // ran two lines of the book into one paragraph lands on that paragraph.
    const runOn: SectionView = {
      ...layered,
      blocks: [
        {
          heading: null,
          parts: [
            { kind: 'text', text: 'Something else entirely.' },
            { kind: 'text', text: `Hold fast.\n${line}` },
          ],
        },
      ],
    };
    expect(landingIn(runOn, hit)).toEqual({ block: 0, at: { kind: 'part', part: 1 } });
  });

  it('can find the block for every subhead the shipped SRD carries', () => {
    /*
     * The landing above is an equality between two strings produced by two
     * different files: `quoteFrom` hands the screen a heading with
     * `text.replace(/^#+\s+/, '')`, and `ruleBlocks` captures the same line
     * with `/^##\s+(.+)$/`. They agree today. This is the test that goes red on
     * the day one of them starts trimming differently, and it asks it of every
     * subhead in the book rather than of the two the docblock names.
     */
    let subheads = 0;
    for (const section of rules) {
      const blocks = ruleSection(rules, section.id)!.blocks;
      for (const raw of section.body.split('\n')) {
        const found = /^##\s+(.+)$/.exec(raw.trim());
        if (found === null) continue;
        subheads += 1;
        const heading = found[1]!.trim();
        expect(
          blocks.some((b) => b.heading === heading),
          `${section.id} :: ${heading}`,
        ).toBe(true);
        // And the string the search would hand the screen for a hit on that
        // line is character-for-character the one the block carries.
        expect(raw.trim().replace(/^#+\s+/, '').replace(/^-\s+/, '')).toBe(heading);
      }
    }
    // Not a vacuous pass: the book really does carry subheads.
    expect(subheads).toBeGreaterThan(100);
  });

  it('gives the title mark a plate, because its face has no weight left to give', () => {
    /*
     * `.t-label` is `600 10px var(--mono)` and `--mono` is IBM Plex Mono, which
     * this app ships as 400, 500 and 600 - three `@font-face` rules in
     * `tokens.css` and no 700. So the 700 the mark asks for cannot arrive, and
     * `--text-2` -> `--text` is a 1.38:1 step of ink against the 1.83:1 the
     * preview line gets from `--muted`. Both of the channels that work on the
     * preview are spent on the title, so the title gets the third one.
     *
     * The preview keeps its cleared background, and that is half the property:
     * this is not "marks get plates", it is "the run whose face cannot get
     * heavier gets a plate".
     */
    openShow();
    type('restrained condition');
    const header = hits()[0]!;
    const title = header.querySelector('span.t-label > mark')!;
    const line = header.querySelector('span.t-dense > mark')!;
    expect(title.textContent).toBe('Condition');
    expect(line.textContent).toBe('RESTRAINED');

    expect((title as HTMLElement).style.background).toBe('var(--line)');
    expect((line as HTMLElement).style.background).toBe('transparent');
    // The ink is the same on both, and it is the top of the palette - which is
    // why the plate had to be the thing that moved.
    expect((title as HTMLElement).style.color).toBe('var(--text)');
    expect((line as HTMLElement).style.color).toBe('var(--text)');
    // No padding on the plate: it would shift a monospaced label off its grid.
    expect((title as HTMLElement).style.padding).toBe('');
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
    // And nothing out in the other 780 either, which is now the second half of
    // what the sentence claims. The silence is only honest while both are empty:
    // the paragraph says *nothing in this dataset*, and a card carrying the word
    // under a paragraph saying no such thing exists would be the app
    // contradicting itself on one surface.
    expect(recordRows()).toEqual([]);
    expect(groupHeaders()).toEqual([]);
    expect(dialog().textContent).toContain('Nothing in this dataset carries that');
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
    expect(live?.textContent).toBe(
      `1 question and ${String(searchRules(rules, 'fear').length)} sections match; ` +
        `${String(searchSrd(beyondRules, 'fear').length)} elsewhere in the book`,
    );

    type('kobolds riding a velocipede');
    expect(dialog().querySelector('.sr-only[role="status"]')).toBe(live);
    expect(live?.textContent).toBe('No section matches');
    expect(dialog().textContent).toContain('Nothing in this dataset carries that');
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
    expect(container.textContent).toContain('Nothing in this dataset carries that');

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

// ---------------------------------------------------------------------------

/**
 * The question catalogue, on the surface it was built for.
 *
 * `tests/gm/ask.test.ts` asks whether the twelve entries still point at
 * anything. This asks the other half: whether a GM ever sees them, which is the
 * defect class this repo keeps shipping - twelve entries, a matcher, six chips,
 * every unit test green, and nothing on the glass.
 */
describe('the questions above the sections', () => {
  it('draws the app’s own band above every band of the book’s', () => {
    openShow();
    type('damage');
    // Two questions, both filed under the DAMAGE moment: `searchAsk` indexes an
    // entry under its moment's label as well as its own words, which is what
    // makes a chip find its own questions rather than whatever the book calls
    // them.
    expect(searchAsk(ASK_CATALOGUE, 'damage').map((entry) => entry.id)).toEqual([
      'q-surrender',
      'q-death-move-refused',
    ]);
    expect(groupHeaders()[0]).toBe('QUESTIONS · 2');
    expect(groupHeaders().length).toBeGreaterThan(1);
    expect(askRows().map((b) => b.querySelector('span.t-read')?.textContent)).toEqual(
      searchAsk(ASK_CATALOGUE, 'damage').map((entry) => entry.ask),
    );
    // Above, in the DOM and therefore up the glass from the thumb: the whole
    // point of a fourth band is that it is read before the nineteen.
    expect(
      askRows()[0]!.compareDocumentPosition(hits()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it('answers a phrase this book does not carry with a question instead of silence', () => {
    /*
     * The case the catalogue exists for, and it is measured rather than
     * assumed: `surrender` is in none of the sixty-nine sections, so the search
     * alone answers a real table question with a correct and useless silence.
     */
    openShow();
    type('surrender');
    expect(searchRules(rules, 'surrender')).toEqual([]);
    expect(hits()).toEqual([]);
    expect(groupHeaders()).toEqual(['QUESTIONS · 1']);
    expect(dialog().textContent).toContain('wants to surrender');
    // And the silence is gone, because its second clause would now be false of
    // the surface it is printed on. The wording is read off the same constant
    // the two tests above assert positively: a `not.toContain` left pointing at
    // a string the screen no longer prints is a test that passes whatever the
    // screen says, which is how this one survived the sentence being rewritten.
    expect(searchSrd(beyondRules, 'surrender')).toEqual([]);
    expect(dialog().textContent).not.toContain('Nothing in this dataset carries that');
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      '1 question and no section matches',
    );
  });

  it('says nothing at all about questions when it has none', () => {
    // §4 forbids the other apology: a query that finds sections and no question
    // prints no empty band and no "I have nothing for that" row.
    openShow();
    type('countdown');
    expect(searchAsk(ASK_CATALOGUE, 'countdown')).toEqual([]);
    expect(askRows()).toEqual([]);
    expect(groupHeaders().some((header) => header.startsWith('QUESTIONS'))).toBe(false);
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      `${String(searchRules(rules, 'countdown').length)} sections match; ` +
        `${String(searchSrd(beyondRules, 'countdown').length)} elsewhere in the book`,
    );
  });

  it('opens a question on the block its pointer names, under the book’s own address', () => {
    landings((asked) => {
      openShow();
      type('chase');
      expect(askRows()).toHaveLength(1);
      // Shut, the row already carries the provenance: title, subhead, stamp -
      // all three out of the dataset, none of them typed into the catalogue.
      const row = askRows()[0]!;
      expect(row.textContent).toContain('Countdowns · DYNAMIC COUNTDOWN ADVANCEMENT');
      expect(row.textContent).toContain('SRD 1.0 · P.69');

      click(row);
      expect(asked).toHaveLength(1);
      expect(asked[0]!.textContent!.startsWith('DYNAMIC COUNTDOWN ADVANCEMENT')).toBe(true);
      // Not the top of the section: the block it lands on is not the first.
      const blocks = ruleSection(rules, 'countdowns')!.blocks;
      expect(
        blocks.findIndex((block) => block.heading === 'DYNAMIC COUNTDOWN ADVANCEMENT'),
      ).toBeGreaterThan(0);
      // The section is drawn whole around it rather than the block alone - a
      // rule read with its neighbours cut away is how a GM rules on half a
      // sentence.
      const opened = row.closest('section')!;
      expect(opened.textContent).toContain(blocks[0]!.parts[0]!.kind === 'text' ? blocks[0]!.parts[0]!.text : '');
    });
  });

  it('keeps one thing open across both kinds of row', () => {
    openShow();
    type('damage');
    click(hits()[0]!);
    expect(hits()[0]!.getAttribute('aria-expanded')).toBe('true');
    click(askRows()[0]!);
    expect(askRows()[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(hits()[0]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('draws the whole section, and says so, when the subhead has gone', () => {
    // The runtime half of the rot ladder. A homebrew layer can rewrite a body,
    // and a renamed subhead must never be matched loosely onto the nearest one
    // still standing: a wrong subhead looks like an answer, and the top of a
    // section visibly is the top.
    openShow();
    act(() => {
      useApp.setState({
        dataset: {
          ...dataset,
          rules: dataset.rules.map((r) =>
            r.id === 'countdowns' ? { ...r, body: r.body.replace('## DYNAMIC COUNTDOWN', '## HOW A CLOCK') } : r,
          ),
        },
      });
    });
    type('chase');
    click(askRows()[0]!);
    expect(dialog().textContent).toContain('no longer carries that subhead');
    expect(dialog().textContent).toContain('HOW A CLOCK');
  });

  it('turns a dead pointer into a live search when the section has gone', () => {
    /*
     * `RECUPERO-JOURNAL-2026-08-24.md`'s design, both halves: the `Unresolved`
     * shape `SessionBody` uses for a link this device cannot resolve, plus a
     * control that puts the question's own index word in the field so the GM
     * ends up searching rather than staring at a note.
     */
    openShow();
    act(() => {
      useApp.setState({
        dataset: { ...dataset, rules: dataset.rules.filter((r) => r.id !== 'countdowns') },
      });
    });
    type('chase');
    expect(askRows()).toHaveLength(1);
    // The row still says where it was pointing, by its raw ref, because that
    // is the one honest thing left to print.
    expect(askRows()[0]!.textContent).toContain('countdowns');
    click(askRows()[0]!);
    expect(dialog().textContent).toContain('no longer carries that section');

    click(named('SEARCH “chase” INSTEAD'));
    expect(field().value).toBe('chase');
  });
});

// ---------------------------------------------------------------------------

describe('the moment chips, on the empty field', () => {
  const chipGroup = (): HTMLElement | null => dialog().querySelector('[role="group"]');
  const doors = (): HTMLButtonElement[] => [
    ...scroller().querySelectorAll<HTMLButtonElement>('button.panel'),
  ];

  it('draws all six above the doors, in one scroll', () => {
    // The owner's decision of 2026-08-25 §6: both, not one or the other. The
    // panel scrolls, so a grid above the doors pushes them down rather than off
    // - and how far down is the Chrome measurement `ShowSheet.tsx` says it is
    // still waiting for.
    openShow();
    const chips = [...chipGroup()!.querySelectorAll('button')];
    expect(chips.map((b) => (b.textContent ?? '').trim())).toEqual(
      MOMENTS.map((moment) => moment.label),
    );
    expect(doors()).toHaveLength(3);
    expect(
      chipGroup()!.compareDocumentPosition(doors()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(scroller().contains(chipGroup())).toBe(true);
    // The floor, inline, where jsdom can read it. A chip is not two columns
    // because 53.8px would not hold `BETWEEN SCENES`; it is 44 tall because
    // everything on this screen is.
    for (const chip of chips) expect(chip.style.minHeight).toBe('44px');
  });

  it('fills the field, and every one of the six finds its own questions', () => {
    for (const moment of MOMENTS) {
      openShow();
      click(named(moment.label));
      expect(field().value).toBe(moment.label.toLowerCase());
      // A chip that drew an empty band would be a control that answers
      // nothing, which is worse than no chip.
      expect(askRows().length, moment.label).toBeGreaterThan(0);
      expect(groupHeaders()[0], moment.label).toBe(
        `QUESTIONS · ${String(searchAsk(ASK_CATALOGUE, moment.label.toLowerCase()).length)}`,
      );
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it('goes with the doors while a question is being typed, and comes back', () => {
    openShow();
    expect(chipGroup()).not.toBeNull();
    type('fear');
    expect(chipGroup()).toBeNull();
    expect(doors()).toEqual([]);
    type('');
    expect(chipGroup()).not.toBeNull();
    expect(doors()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------

/**
 * The book beyond the rules, on the glass.
 *
 * Everything here is read off the screen and checked against the dataset, never
 * against a name typed beside the assertion: the record a query is expected to
 * find is looked up in `dataset` first, and the row is then asked to be the one
 * the book says it is.
 */
describe('the rest of the book, under the sections', () => {
  it('finds an adversary the rules search answers with silence, and bands it by kind', () => {
    const burrower = dataset.adversaries.find((a) => a.name === 'Acid Burrower')!;
    expect(burrower).toBeDefined();
    // The silence this part exists to end: the section search carries none of
    // those words, so before this the whole surface said nothing.
    expect(searchRules(rules, burrower.name)).toEqual([]);

    openShow();
    type(burrower.name);
    expect(hits()).toEqual([]);
    expect(groupHeaders()).toEqual([`${SRD_KIND_LABELS.adversary} · 1`]);
    expect(recordNames()).toEqual([burrower.name]);
    // Stamped with the book's own folio, in the same ink a section hit uses.
    expect(recordRows()[0]!.querySelector('span.t-meta')?.textContent).toBe(
      `SRD 1.0 · P.${String(burrower.sourcePage)}`,
    );
  });

  it('opens a record in place and draws its own words under the app’s labels', () => {
    const burrower = dataset.adversaries.find((a) => a.name === 'Acid Burrower')!;
    openShow();
    type(burrower.name);
    const row = recordRows()[0]!;
    expect(row.getAttribute('aria-expanded')).toBe('false');

    click(row);
    expect(recordRows()[0]!.getAttribute('aria-expanded')).toBe('true');
    const open = recordRows()[0]!.parentElement!;
    // The record's own text, verbatim out of the dataset, and the app's label
    // over it. Neither is typed here: both are read from the record the search
    // says the row is.
    expect(open.textContent).toContain(burrower.description);
    expect(open.textContent).toContain(burrower.motives[0]);
    for (const f of burrower.features) expect(open.textContent).toContain(f.text);
    // The labels are read off the glass rather than out of the whole string:
    // `HP` and `Stress` are words of the SRD's own feature text on this very
    // adversary - "they must mark an additional HP" - so a `not.toContain` over
    // `textContent` would have been asserting about the book while claiming to
    // assert about the app. A field label is a `span.t-meta` that is a direct
    // child of a field's own `div`; the page stamp is the one inside the
    // button's `span.row`, and this selector cannot reach it.
    const labels = [...open.querySelectorAll('div > span.t-meta')].map((n) => n.textContent);
    expect(labels).toContain('MOTIVES');
    expect(labels).toContain('FEATURES');
    // And no number the app would have had to label: a tier and an HP are drawn
    // by the screens that draw stat blocks, and this list is not one of them.
    for (const banned of ['TIER', 'HP', 'STRESS', 'DIFFICULTY', 'THRESHOLDS']) {
      expect(labels, banned).not.toContain(banned);
    }
  });

  it('lights the GM’s words inside the record it opened, as it does in a section', () => {
    // A word carried by an adversary's own text rather than by its name, so the
    // marking has something in the body to find.
    const beast = dataset.adversaries.find((a) =>
      a.features.some((f) => f.text.toLowerCase().includes('countdown')),
    )!;
    expect(beast).toBeDefined();

    openShow();
    type('countdown');
    const at = recordNames().indexOf(beast.name);
    expect(at).toBeGreaterThan(-1);
    click(recordRows()[at]!);
    const open = recordRows()[at]!.parentElement!;
    const marks = [...open.querySelectorAll('mark')].map((m) => (m.textContent ?? '').toLowerCase());
    expect(marks).toContain('countdown');
  });

  it('keeps one row open across the sections and the rest of the book alike', () => {
    openShow();
    type('countdown');
    // A section and a record both matched, which is what makes the shared open
    // state worth asserting: two lists, one open row.
    expect(hits().length).toBeGreaterThan(0);
    expect(recordRows().length).toBeGreaterThan(0);

    click(hits()[0]!);
    expect(hits()[0]!.getAttribute('aria-expanded')).toBe('true');

    click(recordRows()[0]!);
    expect(recordRows()[0]!.getAttribute('aria-expanded')).toBe('true');
    // The section shut when the record opened. Opening every hit at once is the
    // thing this surface has refused since it was built, and a second list must
    // not be a second exception to it.
    expect(hits()[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(
      [...hits(), ...recordRows()].filter((b) => b.getAttribute('aria-expanded') === 'true'),
    ).toHaveLength(1);
  });

  it('keeps the sections’ apology about sections when a record carried every word', () => {
    /*
     * The one interaction between the two searches, and the reason the SOME
     * header did not have to be rewritten. `searchRules` widens to OR when no
     * section carries every word and labels that list NO SECTION CARRIES ALL OF
     * THOSE WORDS; `searchSrd` does not widen, so a record under it carries all
     * of them outright. Both statements are true at once *because the header
     * says section* - and if records had been folded into the three section
     * bands instead of getting their own, that header would have been standing
     * over rows that contradict it.
     */
    const query = 'clearing stress';
    const some = searchRules(rules, query);
    expect(some.length).toBeGreaterThan(0);
    expect(some.every((h) => h.partial)).toBe(true);
    const exact = searchSrd(beyondRules, query);
    expect(exact.length).toBeGreaterThan(0);

    openShow();
    type(query);
    expect(groupHeaders()).toEqual([
      `NO SECTION CARRIES ALL OF THOSE WORDS · THESE CARRY SOME · ${String(some.length)}`,
      ...kindBands(query),
    ]);
    // And the live line does not call the record hits sections either.
    expect(dialog().querySelector('.sr-only[role="status"]')?.textContent).toBe(
      `${String(some.length)} sections match; ${String(exact.length)} elsewhere in the book`,
    );
  });

  it('gives a section name and a record name one scale, above the label scale', () => {
    /*
     * The owner's readability constraint, landed on the one surface where a
     * person scans thirty names for the one they meant. `t-label` ships 10px
     * with `0.16em` of tracking, which is right for a word standing *over*
     * something and wrong for the thing being read.
     *
     * Both lists are asserted together and against each other, because the
     * failure worth catching is not the number: it is the two drifting apart.
     * A person reading this list cannot tell which of the two searches produced
     * a row, and must not be able to.
     */
    openShow();
    type('countdown');
    const nameOf = (b: HTMLButtonElement): HTMLElement =>
      b.querySelector<HTMLElement>('span.t-label')!;
    const section = nameOf(hits()[0]!);
    const record = nameOf(recordRows()[0]!);

    expect(section.style.fontSize).toBe('12px');
    expect(record.style.fontSize).toBe(section.style.fontSize);
    expect(record.style.letterSpacing).toBe(section.style.letterSpacing);
    expect(record.style.lineHeight).toBe(section.style.lineHeight);
    // The tracking comes down as the size goes up; the docblock beside
    // `ROW_NAME` carries what that bought, measured in a browser.
    expect(section.style.letterSpacing).toBe('0.1em');
  });

  it('draws the sections first and the rest of the book after them', () => {
    openShow();
    type('countdown');
    // Up the glass from the thumb, in the DOM order a screen reader walks: the
    // sections the surface was built around, then the kinds.
    expect(
      hits()[0]!.compareDocumentPosition(recordRows()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });
});
