// @vitest-environment jsdom
/**
 * What a device with nothing on it is asked, and what each answer writes.
 *
 * Every test here boots the real `App` against an empty database and an empty
 * localStorage, which is the one state this surface exists in and the one no
 * other file in the suite mounts on purpose. Before this, that state produced
 * the character wizard's first step - nine class cards, shown to a GM, to a
 * player whose character was already finished on another phone, and to somebody
 * who had not yet said which of those they were.
 *
 * The three things asserted, in the order they matter:
 *
 *   1. the question is there and the class picker is not, which is the item;
 *   2. two questions for a player and three for a GM, with the write each route
 *      makes and the screen it hands over to;
 *   3. it runs once - and "once" is a property of two different launches, so it
 *      is asserted by booting twice against the same storage rather than by
 *      reading a boolean.
 *
 * What is deliberately not here is anything about height. jsdom has no layout
 * engine, so an assertion about a thumb arc or a scroll window could not fail
 * for the right reason on any code; those numbers are measured in Chrome and
 * recorded in the commit. The one geometric thing this file does check is the
 * declared touch floor, which is an inline style and therefore real here.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS, loadPrefs, savePrefs } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { App } from '../../src/ui/shell/App.tsx';
import { playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

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

async function settle(until: () => boolean = () => true, turns = 120): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (until()) return;
  }
}

const text = (): string => container.textContent ?? '';

/**
 * Boot the shell the way a launch does, reading the preferences off the disk.
 *
 * The store is module state shared by every test in this file, so a second boot
 * has to put it back to its pre-`init` shape first - and deliberately *not* put
 * the preferences back, because "the same device, launched again" is exactly
 * what the once-only assertions are about.
 */
async function boot(): Promise<void> {
  // A whole new root, because a launch is a mount. Rendering `App` into the
  // root that is already holding it re-renders rather than remounts, `init` is
  // in a `useEffect` with a stable dependency, and the second "launch" would
  // quietly be the first one still running.
  act(() => root.unmount());
  container.remove();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  useApp.setState({ ready: false, characters: [], activeId: null, screen: 'play' });
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
  expect(useApp.getState().ready, 'init() never answered').toBe(true);
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

/** Click the one button whose text contains `match`. */
async function press(match: string): Promise<void> {
  const found = buttons().filter((b) => (b.textContent ?? '').includes(match));
  expect(
    found.map((b) => (b.textContent ?? '').trim()),
    `expected exactly one button containing "${match}"`,
  ).toHaveLength(1);
  await act(async () => {
    found[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

/** The answer rows: the group under the question, or the summary's own list. */
const answerRows = (): HTMLButtonElement[] =>
  [...container.querySelectorAll<HTMLButtonElement>('[role="group"] > button')];

describe('the first thing a new device shows', () => {
  it('asks who is at the table, instead of showing the nine classes', async () => {
    await boot();

    expect(
      text(),
      'a brand-new device still opens on something other than the first question',
    ).toContain('Who are you at this table?');
    expect(
      text(),
      'the class picker is on screen before anybody has said whether they are ' +
        'making a character at all — which is the whole of the item',
    ).not.toContain('Name & class');
  });

  it('draws no navigation at all while it is up, and gives it back afterwards', async () => {
    await boot();

    // No tab bar: the flow's own nav is the last thing in the window and pays
    // the home-indicator inset, and a second bar would be both a second payment
    // and four destinations offered to somebody who has not chosen one.
    const navs = [...container.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label'));
    expect(navs, 'the shell drew a second bar under the first-run nav').toEqual(['Onboarding']);
    expect(
      buttons().some((b) => (b.textContent ?? '').trim() === 'SETTINGS'),
      'the door to Settings is live during a flow that is drawn instead of Settings, ' +
        'so it either does nothing or strands somebody on a screen with no way back',
    ).toBe(false);

    await press("I'll make a character now");
    await press('The app rolls for me');
    await press('Create a character');
    await settle(() => text().includes('Name & class'));

    expect(
      buttons().some((b) => (b.textContent ?? '').trim() === 'SETTINGS'),
      'the door to Settings did not come back when the questions ended',
    ).toBe(true);
    expect(
      [...container.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
    ).toContain('Wizard navigation');
  });

  it('gives every answer a target above the 44px floor', async () => {
    await boot();

    const rows = answerRows();
    expect(rows.length, 'the question drew no answers').toBeGreaterThan(2);
    for (const row of rows) {
      expect(
        Number.parseInt(row.style.minHeight, 10),
        `an answer row declares ${row.style.minHeight || 'no height'}, under the app's own ` +
          '44px floor, on the first screen anybody ever touches',
      ).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('two questions for a player', () => {
  it('says it is two questions long before either of them is answered', async () => {
    await boot();
    expect(
      text(),
      'the step counter and the rail promise a different number of questions than ' +
        'the flow asks, which is the one thing a first run can say about itself',
    ).toContain('QUESTION 1 OF 2');

    await press("I'll make a character now");
    expect(text()).toContain('QUESTION 2 OF 2');
  });

  it('asks how the table rolls and then nothing else', async () => {
    await boot();
    await press("I'll make a character now");

    expect(text()).toContain('How does your table roll?');
    expect(
      text(),
      'a player is being asked how many players are at their table, which is the ' +
        "GM's question and the difference between two questions and three",
    ).not.toContain('How many players at your table?');

    await press('The app rolls for me');
    expect(text()).toContain('QUESTIONS ANSWERED');
    expect(text()).toContain('Ready when you are');
  });

  it('writes the two answers and hands over to the wizard', async () => {
    await boot();
    await press("I'll make a character now");
    await press('The app rolls for me');
    await press('Create a character');
    await settle(() => text().includes('Name & class'));

    const prefs = loadPrefs();
    expect(prefs.onboarded, 'the flow ended without recording that it had run').toBe(true);
    expect(prefs.gmSection).toBe(false);
    expect(prefs.digitalDice).toBe(true);
    expect(prefs.manualDice).toBe(false);
    // Untouched, because it was never asked: a player's answer must not carry a
    // GM's party size in with it.
    expect(prefs.gmPartySize).toBe(DEFAULT_PREFS.gmPartySize);
    expect(useApp.getState().screen).toBe('build');
  });

  it('writes the roll bar the answer described, in each of its three states', async () => {
    for (const [answer, expected] of [
      ['The app rolls for me', { digitalDice: true, manualDice: false }],
      ['I type what they said', { digitalDice: false, manualDice: true }],
      ['the app stays out of it', { digitalDice: false, manualDice: false }],
    ] as const) {
      localStorage.clear();
      await boot();
      await press("I'll make a character now");
      await press(answer);
      await press('Create a character');

      const prefs = loadPrefs();
      expect(
        { digitalDice: prefs.digitalDice, manualDice: prefs.manualDice },
        `"${answer}" did not write the combination the row promised`,
      ).toEqual(expected);
    }
  });
});

describe('three questions for a GM', () => {
  it('asks the party size, and only of a GM', async () => {
    await boot();
    await press('The GM');
    expect(
      text(),
      'the flow got a third question longer without saying so, or did not get ' +
        'longer at all',
    ).toContain('QUESTION 2 OF 3');
    expect(text()).toContain('How does your table roll?');

    await press('The app rolls for me');
    expect(
      text(),
      'a GM was not asked how many players are at the table — the number every ' +
        'battle point in the encounter builder is computed from',
    ).toContain('How many players at your table?');
  });

  it('writes the party size and opens the table', async () => {
    await import('../../src/ui/gm/Gm.tsx');
    await boot();
    await press('The GM');
    await press('The app rolls for me');
    await press('Five');
    await press('Open the table');
    await settle(() => useApp.getState().screen === 'gm');

    const prefs = loadPrefs();
    expect(prefs.gmSection).toBe(true);
    expect(prefs.gmPartySize).toBe(5);
    expect(prefs.onboarded).toBe(true);
    expect(
      useApp.getState().screen,
      'a GM with no characters was handed the character wizard',
    ).toBe('gm');
  });

  it('is still on the GM screen the next time the app is opened', async () => {
    await import('../../src/ui/gm/Gm.tsx');
    await boot();
    await press('The GM');
    await press('The app rolls for me');
    await press('Four');
    await press('Open the table');
    await settle(() => useApp.getState().screen === 'gm');

    await boot();
    expect(
      useApp.getState().screen,
      'the GM answer survived exactly one launch, which is the app forgetting an ' +
        'answer it had just been given',
    ).toBe('gm');
    expect(text()).not.toContain('Who are you at this table?');
  });
});

describe('runs once, and is never seen again', () => {
  it('does not ask again on the next launch, with the library still empty', async () => {
    await boot();
    await press("I'll make a character now");
    await press('The app rolls for me');
    await press('Create a character');
    await settle(() => text().includes('Name & class'));

    await boot();
    expect(
      text(),
      'the first-run questions are asked again on the second launch of a device ' +
        'that answered them on the first',
    ).not.toContain('Who are you at this table?');
    expect(useApp.getState().screen).toBe('build');
  });

  it('never asks a device that already has a character on it', async () => {
    await db.putCharacter(playedCharacter());
    await boot();

    expect(
      text(),
      'somebody with a sheet on this device is being asked whether they are a ' +
        'player — a question they have already answered by doing',
    ).not.toContain('Who are you at this table?');
  });

  it('never asks a device that has been used before this build existed', async () => {
    // A record with every key of the previous build and none of this one, which
    // is every install on every device that has ever run the app.
    const { onboarded: _dropped, ...before } = DEFAULT_PREFS;
    localStorage.setItem('dhc.prefs.v1', JSON.stringify(before));
    await boot();

    expect(
      text(),
      'an upgrade asks a two-year user who they are, which is the worst possible ' +
        'false first run because it arrives when nobody is looking for it',
    ).not.toContain('Who are you at this table?');
  });
});

describe('skipping', () => {
  it('goes to the summary rather than straight past it, and keeps nothing', async () => {
    await boot();
    // The player answer, deliberately: it is the one option in the whole flow
    // whose patch differs from the shipped default, so it is the only one that
    // can tell "a skip dropped it" apart from "a skip applied it".
    await press("I'll make a character now");
    await press('Skip these');

    expect(
      text(),
      'a skip landed in the app without saying what it was about to write, which ' +
        'is the one sentence somebody who skipped has not read anywhere else',
    ).toContain('None — skipped');

    await press('Create a character');
    const prefs = loadPrefs();
    expect(prefs.onboarded, 'a skip does not count as having been asked').toBe(true);
    expect(
      { gmSection: prefs.gmSection, digitalDice: prefs.digitalDice, gmPartySize: prefs.gmPartySize },
      'a skip kept an answer that was given before it, so somebody who changed ' +
        'their mind and skipped is left half-configured by a control that says it ' +
        'is skipping',
    ).toEqual({
      gmSection: DEFAULT_PREFS.gmSection,
      digitalDice: DEFAULT_PREFS.digitalDice,
      gmPartySize: DEFAULT_PREFS.gmPartySize,
    });
  });

  it('takes the GM branch back off too, so the card is not a GM card', async () => {
    await boot();
    await press('The GM');
    await press('Skip these');

    expect(
      text(),
      'a skip after "The GM" still hands over to the GM screen, which is the one ' +
        'answer being kept out of a flow that dropped every other',
    ).toContain('Ready when you are');
    expect(text()).not.toContain('Your table is ready');

    await press('Create a character');
    expect(useApp.getState().screen).toBe('build');
  });

  it('lets Back out of the summary onto the question it came from', async () => {
    await boot();
    await press("I'll make a character now");
    await press('The app rolls for me');
    expect(text()).toContain('Ready when you are');

    await press('Back');
    expect(
      text(),
      'Back off the summary does not return to the last question, so an answer ' +
        'given by mistake on the most consequential screen in the app is final',
    ).toContain('How does your table roll?');

    await press('Back');
    expect(text()).toContain('Who are you at this table?');
  });
});

describe('what still outranks it', () => {
  it('says a library went missing rather than quietly asking who this is', async () => {
    // Nine days since the last session, which left two characters behind. This
    // launch has neither, and an empty library is also what onboarding claims.
    localStorage.setItem(
      'dhc.backup.v1',
      JSON.stringify({
        lastSeenAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
        knownCharacterIds: ['one-that-is-gone', 'and-another'],
      }),
    );
    savePrefs({ ...DEFAULT_PREFS, lastBackupAt: new Date().toISOString() });

    await boot();
    await settle(() => text().includes('SOMETHING IS MISSING'));

    expect(
      text(),
      'a device whose characters vanished between sessions was re-onboarded ' +
        'instead of told, which is the app answering a question nobody asked',
    ).toContain('SOMETHING IS MISSING');
    // Both, and in that order: the alert is above the questions in `<main>`.
    expect(text()).toContain('Who are you at this table?');
  });
});
