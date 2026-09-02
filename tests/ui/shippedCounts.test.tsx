// @vitest-environment jsdom
/**
 * Do the figures the app quotes about itself come from the book it ships?
 *
 * They did not. `App.tsx`'s welcome panel - the first prose anybody reads, on
 * the screen whose entire claim is *"Nothing to download"* - said **189 domain
 * cards, 129 adversaries, nine classes**. Those are `srd-1.0.json`'s arrays.
 * `src/store/dataset.ts` imports `srd-2.0.json`, which carries 210, 264 and 13,
 * so the sentence understated the bestiary by 135 - more than half of it - and
 * the app spent four months disparaging itself in its own welcome. The
 * onboarding flow said `NEXT: THE NINE CLASSES` twice, in front of a picker
 * already drawing thirteen.
 *
 * Nothing could ever have gone red on that. A typed-in number is not wrong in a
 * way a compiler or a render test can see; it is wrong only against a file
 * nobody was comparing it to. So this file compares it to that file, and asks
 * two different questions rather than one:
 *
 *   1. **is the number right** - the rendered sentence names exactly what the
 *      shipped book counts. This goes red the day the dataset changes under a
 *      hardcoded figure, which is the failure that actually happened;
 *   2. **is the number derived** - no source line in either surface writes any
 *      of the three as a literal. This goes red the day somebody "fixes" the
 *      first question by typing `210` in, which would be the same defect
 *      reintroduced with a fresh expiry date rather than a repair.
 *
 * Question 2 is the load-bearing one and it is why this file exists at all.
 * Question 1 alone is satisfied by a correct literal.
 *
 * ## Which book, read off the import
 *
 * The counts are taken from whatever path `dataset.ts` imports rather than from
 * `srd-2.0.json` by name, because a test pinned to `2.0` is a test that goes
 * stale on precisely the event it exists to catch. It is read with `readFileSync`
 * and counted here rather than imported through `SHIPPED_COUNTS`: a test that
 * asks the module under test for the expected value cannot fail.
 *
 * ## Comments are stripped before question 2
 *
 * This project records what a wrong number used to say, next to the code that
 * used to say it - `App.tsx` and `Onboarding.tsx` both now carry the SRD 1.0
 * figures in prose, deliberately. A guard that could not tell a chronicle from
 * a literal would forbid the one habit that makes this class of defect legible.
 * Block comments go first, then whole-line `//` comments; a mid-line `//` is
 * left alone so that a `https://` inside a string cannot swallow the rest of the
 * line. Neither file contains `/*` inside a string literal, which is the case
 * that would fool the first pass, and both are checked for it below.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { App } from '../../src/ui/shell/App.tsx';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const DATASET_MODULE = resolve(process.cwd(), 'src/store/dataset.ts');
const APP = resolve(process.cwd(), 'src/ui/shell/App.tsx');
const ONBOARDING = resolve(process.cwd(), 'src/ui/onboarding/Onboarding.tsx');

const read = (path: string): string => readFileSync(path, 'utf8');

/** The book `dataset.ts` actually imports, counted here. */
function shippedBook(): { path: string; domainCards: number; adversaries: number; classes: number } {
  const source = read(DATASET_MODULE);
  const found = /^import\s+srd\s+from\s+'([^']+)';/m.exec(source);
  expect(
    found,
    "src/store/dataset.ts no longer opens with `import srd from '...json'`, so this file " +
      'cannot tell which book the app ships and every count below would be measuring the ' +
      'wrong file rather than failing',
  ).not.toBeNull();
  const path = resolve(dirname(DATASET_MODULE), found![1]!);
  const book = JSON.parse(read(path)) as {
    domainCards: unknown[];
    adversaries: unknown[];
    classes: unknown[];
  };
  return {
    path,
    domainCards: book.domainCards.length,
    adversaries: book.adversaries.length,
    classes: book.classes.length,
  };
}

/** Source with its prose removed - see the header. */
function code(path: string): string {
  const source = read(path);
  expect(
    /(['"`])[^'"`\n]*\/\*/.test(source),
    `${path} now has a "/*" inside a string literal, which the comment stripper below ` +
      'would treat as the start of a comment and swallow real code with',
  ).toBe(false);
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^[ \t]*\/\/.*$/gm, ' ')
      // A number a JSX or template hole holds is a number typed into the
      // sentence, and it must not hide behind the braces. `{' '}` goes too: it
      // is the spacer JSX needs between an expression and the text on the next
      // line, and it would otherwise stand between a rewired `210` and the
      // `domain cards` that proves what the 210 is counting.
      .replace(/\{\s*(['"])\s*\1\s*\}/g, ' ')
      .replace(/\$?\{\s*String\(\s*(\d+)\s*\)\s*\}/g, '$1')
      .replace(/\$?\{\s*(\d+)\s*\}/g, '$1')
      .replace(/\s+/g, ' ')
  );
}

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) || (min !== null && width >= Number(min[1])),
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

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  await db.clearAll();
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
  useApp.setState({
    ready: false,
    storageError: null,
    writeError: null,
    quarantined: [],
    characters: [],
    activeId: null,
    screen: 'play',
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Turn the loop until something is true, and say what never arrived. */
async function settle(until: () => boolean = () => true, turns = 400): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    if (until()) return;
  }
  throw new Error(
    `settle() gave up after ${String(turns)} turns: whatever is asserted next will report ` +
      'something misleading about a tree that never finished rendering.',
  );
}

const text = (): string => container.textContent ?? '';

async function boot(): Promise<void> {
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
}

/** Click the one button whose text contains `match`. */
async function press(match: string): Promise<void> {
  const found = [...container.querySelectorAll('button')].filter((b) =>
    (b.textContent ?? '').includes(match),
  );
  expect(
    found.map((b) => (b.textContent ?? '').trim()),
    `expected exactly one button containing "${match}"`,
  ).toHaveLength(1);
  await act(async () => {
    found[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

describe('the numbers the app quotes about itself', () => {
  it('welcomes a new library with the counts the shipped book actually has', async () => {
    const book = shippedBook();

    await boot();
    // Past the first run: `EmptyState` is what somebody who answered the
    // questions and then has no character sees, and it is the panel that
    // carries the sentence. The questions are asserted further down.
    await act(async () => {
      useApp.getState().setPrefs({ onboarded: true });
    });
    await act(async () => {
      useApp.getState().setScreen('play');
    });
    await settle(() => text().includes('No character yet'));

    expect(
      text(),
      `the welcome panel does not name ${String(book.domainCards)} domain cards, which is ` +
        `what ${book.path} holds`,
    ).toContain(`${String(book.domainCards)} domain cards`);
    expect(
      text(),
      `the welcome panel does not name ${String(book.adversaries)} adversaries. This is the ` +
        'exact failure the file was written for: it said 129 while the shipped book had 264',
    ).toContain(`${String(book.adversaries)} adversaries`);
    expect(text()).toContain(`${String(book.classes)} classes`);
    // The whole sentence, because three separate `toContain`s pass on three
    // numbers that have drifted apart on the page - JSX drops the whitespace
    // between an expression and the text after it, so "210domain cards" is a
    // rendering these assertions would each survive.
    expect(
      text(),
      'the three counts are on the page but the sentence around them is not the one written',
    ).toContain(
      `Every rule, card and adversary from the SRD is already here — ${String(book.domainCards)} ` +
        `domain cards, ${String(book.adversaries)} adversaries, ${String(book.classes)} classes. ` +
        'Nothing to download.',
    );
  });

  it('offers the class picker by the number of classes the book has', async () => {
    const book = shippedBook();

    await boot();
    expect(text(), 'a brand-new device no longer opens on the first question').toContain(
      'Who are you at this table?',
    );
    expect(
      text(),
      'the answer that leads to the wizard promises a different number of classes from the ' +
        'one the wizard will draw',
    ).toContain(`NEXT: THE ${String(book.classes)} CLASSES`);

    await press('Skip these');
    expect(
      text(),
      'the summary card promises a different number of classes from the one the wizard draws',
    ).toContain(`the ${String(book.classes)} classes, each one readable in full`);
  });

  it('counts the three off the shipped arrays rather than declaring them', () => {
    // The surfaces below all read `SHIPPED_COUNTS`, so a literal typed HERE
    // would satisfy every other assertion in this file: the render would agree
    // with the guard, and both would agree with a number nobody had recounted.
    // This is the one place the derivation itself is pinned.
    const source = read(DATASET_MODULE);
    for (const field of ['domainCards', 'adversaries', 'classes'] as const) {
      expect(
        new RegExp(String.raw`${field}:\s*baseDataset\.${field}\.length`).test(source),
        `SHIPPED_COUNTS.${field} is no longer baseDataset.${field}.length. Every other check ` +
          'in this file reads the value through it, so a number written here is a number ' +
          'nothing can disagree with.',
      ).toBe(true);
    }
  });

  it('writes none of the three as a literal, in either surface', () => {
    const book = shippedBook();
    const surfaces: Array<[string, string]> = [
      ['src/ui/shell/App.tsx', code(APP)],
      ['src/ui/onboarding/Onboarding.tsx', code(ONBOARDING)],
    ];
    // A spelled-out number counts: `nine classes` is how the defect was
    // written, and a repair that reads `thirteen classes` ages identically.
    const written = String.raw`\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen`;
    const banned: Array<[string, RegExp]> = [
      ['domain cards', new RegExp(String.raw`(${written})\s+domain cards`, 'i')],
      ['adversaries', new RegExp(String.raw`(${written})\s+adversaries`, 'i')],
      ['classes', new RegExp(String.raw`(${written})\s+classes`, 'i')],
    ];

    for (const [name, source] of surfaces) {
      for (const [what, pattern] of banned) {
        const hit = pattern.exec(source);
        expect(
          hit?.[0] ?? null,
          `${name} counts ${what} with a typed-in number. That is how this sentence came to ` +
            `say "189 domain cards, 129 adversaries, nine classes" about a book with ` +
            `${String(book.domainCards)}, ${String(book.adversaries)} and ` +
            `${String(book.classes)}: nothing goes red when a literal stops matching a JSON ` +
            'file. Read it off SHIPPED_COUNTS in src/store/dataset.ts instead.',
        ).toBeNull();
      }
    }
  });
});
