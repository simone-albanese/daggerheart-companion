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
import { serializeCharacter } from '../../src/transfer/fileIo.ts';
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

/*
 * Back is navigational, not destructive - it leaves the answers standing so
 * that walking past a question you do not want to change keeps it. What it must
 * not leave standing is an answer to a question the run has since stopped
 * asking, because then the flow writes a preference no card on screen names.
 */
describe('what Back leaves behind', () => {
  /** Answer the whole GM branch, then walk back to the first question. */
  async function theGmBranchThenBackToTheTop(): Promise<void> {
    await boot();
    await press('The GM');
    await press('The app rolls for me');
    await press('Six or more');
    await settle(() => text().includes('Your table is ready'));
    await press('Back');
    await press('Back');
    await press('Back');
    await settle(() => text().includes('Who are you at this table?'));
  }

  it('does not write a party size to a run that never asked for one', async () => {
    await theGmBranchThenBackToTheTop();
    await press("I'll make a character now");
    await press('The app rolls for me');
    await settle(() => text().includes('Ready when you are'));

    expect(
      text(),
      'the card names a party size on a route that does not ask about one',
    ).not.toContain('PLAYERS');

    await press('Create a character');
    await settle(() => loadPrefs().onboarded);

    expect(
      loadPrefs().gmPartySize,
      'the run wrote a fourth preference under a card that lists three, which is ' +
        'the app doing something it has just finished saying it would not',
    ).toBe(DEFAULT_PREFS.gmPartySize);
  });

  it('writes one answer on the import route, which is what the card says', async () => {
    await import('../../src/ui/onboarding/ImportDoors.tsx');
    await theGmBranchThenBackToTheTop();
    await press('on another device');
    await settle(() => text().includes('Choose a file'));
    expect(text()).toContain('ONE QUESTION, ANSWERED');

    await act(async () => {
      await useApp.getState().importCharacters([playedCharacter()], { warnings: [] });
    });
    await settle(() => loadPrefs().onboarded);

    const prefs = loadPrefs();
    expect(prefs.gmSection, 'the one answer this route does give').toBe(false);
    expect(
      prefs.gmPartySize,
      'four questions were answered and four preferences written, on the screen ' +
        'that says "Nothing else to ask"',
    ).toBe(DEFAULT_PREFS.gmPartySize);
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

/**
 * The one-question route, and the three doors behind the question.
 *
 * Every assertion here is about the same property from a different side: the app
 * must never claim something happened that did not. A door that cannot open has
 * to say why, in the words the layer underneath it already wrote - and a door
 * that opens has to say which character arrived rather than counting one.
 */
describe('one question for somebody who already has a character', () => {
  const anyGlobal = globalThis as unknown as Record<string, unknown>;

  /** The File System Access API, answering with `text` - or `null` to cancel. */
  function stubFilePicker(text: string | null): void {
    anyGlobal['showOpenFilePicker'] = async (): Promise<unknown[]> =>
      text === null
        ? []
        : [{ getFile: async () => ({ name: 'ilya.dhchar', text: async () => text }) }];
  }

  function stubClipboard(read: () => Promise<string>): void {
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: read },
      configurable: true,
    });
  }

  /** A camera that answers the way a real one refuses: by `name`. */
  function stubCamera(name: string): void {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () => Promise.reject(Object.assign(new Error('no'), { name })),
      },
      configurable: true,
    });
  }

  afterEach(() => {
    delete anyGlobal['showOpenFilePicker'];
  });

  /** Open the import route and wait for the lazy chunk behind it. */
  async function toTheDoors(): Promise<void> {
    await import('../../src/ui/onboarding/ImportDoors.tsx');
    await boot();
    await press('on another device');
    await settle(() => text().includes('Choose a file'));
  }

  const doors = (): HTMLButtonElement[] => [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[role="group"][aria-label="Three ways in"] > button',
    ),
  ];

  it('asks nothing further, and opens exactly three doors', async () => {
    await toTheDoors();

    expect(
      text(),
      'somebody whose character is already made is being asked how their table ' +
        'rolls, which is a question their sheet has already answered',
    ).not.toContain('How does your table roll?');
    expect(text()).not.toContain('How many players at your table?');

    const names = doors().map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim());
    expect(names, 'the one question did not open onto three doors').toHaveLength(3);
    expect(names.join(' | ')).toMatch(/Choose a file/);
    expect(names.join(' | ')).toMatch(/Open the camera/);
    expect(names.join(' | ')).toMatch(/Paste what you copied/);
    for (const door of doors()) {
      expect(
        Number.parseInt(door.style.minHeight, 10),
        'a door is under the 44px floor on the most consequential screen in the app',
      ).toBeGreaterThanOrEqual(44);
    }
  });

  it('puts the question back when Back is pressed, so a wrong door is not final', async () => {
    await toTheDoors();
    await press('Back');

    expect(
      text(),
      'the import route is a one-way door: somebody who tapped the wrong answer ' +
        'on the first screen they ever saw cannot get back to the other three',
    ).toContain('Who are you at this table?');
    expect(text()).toContain("I'll make a character now");
  });

  /*
   * Backing out and answering differently, which is the state a route flag can
   * be stale in. It had no symptom one move after Back and a bad one two moves
   * after: the three doors standing where the GM's summary belongs.
   */
  it('does not leave the doors standing behind a different answer', async () => {
    await toTheDoors();
    await press('Back');
    await press('The GM');
    await press('The app rolls for me');
    await press('Four');

    expect(
      text(),
      'the flow remembered a route that was backed out of, so a GM who changed ' +
        'their mind is looking at three import doors',
    ).toContain('Your table is ready');
    expect(text()).not.toContain('Choose a file');
  });

  it('says what is wrong with a file it cannot read', async () => {
    stubFilePicker('this is not a character');
    await toTheDoors();
    await press('Choose a file');
    await settle(() => container.querySelector('[role="alert"]') !== null);

    const alert = container.querySelector('[role="alert"]');
    expect(
      alert,
      'a file that will not parse was swallowed, so the screen looks exactly the ' +
        'same as it did before the tap',
    ).not.toBeNull();
    expect((alert?.textContent ?? '').length, 'the refusal is empty').toBeGreaterThan(10);
    expect(useApp.getState().characters).toHaveLength(0);
  });

  it('says nothing at all when the picker is closed without a choice', async () => {
    stubFilePicker(null);
    await toTheDoors();
    await press('Choose a file');
    await settle();

    expect(
      container.querySelector('[role="alert"]'),
      'closing a file picker is not an error, and reporting one is the app ' +
        'inventing a failure the person committed on purpose',
    ).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('takes a character from a file, records the run and opens the sheet', async () => {
    const arriving = playedCharacter();
    stubFilePicker(serializeCharacter(arriving));
    await toTheDoors();
    await press('Choose a file');
    await settle(() => useApp.getState().characters.length > 0);

    expect(useApp.getState().characters).toHaveLength(1);
    const prefs = loadPrefs();
    expect(prefs.onboarded, 'the import route never recorded that the run happened').toBe(true);
    expect(prefs.gmSection, 'the one answer this route gives was not written').toBe(false);
    // Untouched: this route asks one question, so the other two keep the
    // defaults rather than being decided by silence.
    expect(prefs.digitalDice).toBe(DEFAULT_PREFS.digitalDice);
    expect(prefs.manualDice).toBe(DEFAULT_PREFS.manualDice);
    await settle(() => useApp.getState().screen === 'play');
    expect(useApp.getState().screen).toBe('play');
    // The doors are gone, which is all this line ever checked. It used to be
    // introduced as "Named, not counted: `describeImport` says which character
    // arrived", and that is not what is asserted and not what happens: the
    // status paragraph is written and then unmounted in the same tick by the
    // hand-off, because a character arriving takes the whole flow down. The
    // sheet the person is now looking at is the confirmation on this route -
    // `describeImport`'s sentence is read on the Settings route, and here only
    // when nothing arrived.
    expect(text()).not.toContain('Choose a file');
  });

  /*
   * The one asymmetry in the Skip button, which had no test and survived being
   * mutated away in both directions.
   *
   * It stays live in front of the three doors and goes dead on the summary. On
   * the summary there is nothing left to skip - it is the end of every route.
   * In front of the doors there is: somebody who tapped "my character is on
   * another device", found the other phone was in another room, and would now
   * like to be let into the app. That is the escape hatch on the branch a
   * first-time user is most likely to take by mistake, and nothing in the suite
   * could tell whether it was there.
   */
  it('leaves Skip live in front of the doors and kills it on the summary', async () => {
    await toTheDoors();

    const atTheDoors = buttons().find((b) => (b.textContent ?? '').includes('Skip these'));
    expect(
      atTheDoors?.disabled,
      'somebody who opened the import doors by mistake, with the other phone in ' +
        'another room, has no way into the app at all',
    ).toBe(false);

    await press('Skip these');
    await settle(() => text().includes('None — skipped'));
    expect(text()).toContain('None — skipped');

    const onTheSummary = buttons().find((b) => (b.textContent ?? '').includes('Skip these'));
    expect(
      onTheSummary?.disabled,
      'Skip is live on the summary, which is the end of every route - there is ' +
        'nothing left for it to skip',
    ).toBe(true);
  });

  /*
   * The hand-off belongs to the arrival, not to the door that reported it.
   *
   * The camera door reported nothing: `<Receiver/>` was mounted with no props
   * and completes its own import, so a character that arrived by QR was written
   * to the store while `onboarded` stayed false, the route's one answer was
   * dropped, and the person was thrown onto the nine class cards mid-scan.
   *
   * Driven by the line `Receiver` itself runs when a code finishes decoding
   * (`importCharacters`, Transfer.tsx) rather than by a fake scanner, and that
   * is the point of the test rather than a shortcut around it: the fix is that
   * the flow watches the library, so what has to be asserted is that *a
   * character arriving* hands off - whichever door, existing or not yet
   * written, put it there.
   */
  it('hands off when a character arrives at the camera door, which reports nothing', async () => {
    stubCamera('NotFoundError');
    await toTheDoors();
    await press('Open the camera');
    await settle(() => text().includes('No camera was found'));

    await act(async () => {
      await useApp.getState().importCharacters([playedCharacter()], { warnings: [] });
    });
    await settle(() => useApp.getState().screen === 'play');

    const prefs = loadPrefs();
    expect(
      prefs.onboarded,
      'a character arrived by a door that calls nothing back, so the run was never ' +
        'recorded - and this device will re-ask an established user who they are the ' +
        'first time their library is empty',
    ).toBe(true);
    expect(
      prefs.gmSection,
      'the one answer this route gives was dropped on the floor by the camera door',
    ).toBe(false);
    expect(
      useApp.getState().screen,
      'somebody who just scanned their own character was handed the nine class cards',
    ).toBe('play');
  });

  it('says what is wrong with what is on the clipboard, rather than nothing', async () => {
    stubClipboard(async () => 'a shopping list');
    await toTheDoors();
    await press('Paste what you copied');
    await settle(() => container.querySelector('[role="alert"]') !== null);

    // Whichever of the two refusals `pasteLibrary` reaches - the parser's own
    // sentence for something that is not JSON, or its fallback for JSON that is
    // not a character - it has to name the problem rather than shrug.
    expect(container.querySelector('[role="alert"]')?.textContent ?? '').toMatch(
      /not valid JSON|not a Daggerheart character/,
    );
    expect(useApp.getState().characters).toHaveLength(0);
  });

  it('says the clipboard could not be read when the browser refuses', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    await toTheDoors();
    await press('Paste what you copied');
    await settle(() => container.querySelector('[role="alert"]') !== null);

    expect(container.querySelector('[role="alert"]')?.textContent ?? '').toMatch(
      /clipboard could not be read/,
    );
  });

  /*
   * The camera door is the one that can be dead, because it depends on hardware
   * and on a permission. It is not: it opens onto whichever sentence
   * `cameraError` writes, which is the same sentence the transfer screen in
   * Settings has always shown.
   */
  it('is not a dead button on a device with no camera', async () => {
    stubCamera('NotFoundError');
    await toTheDoors();
    await press('Open the camera');
    await settle(() => text().includes('No camera was found'));

    expect(
      text(),
      'the camera door opened onto a black rectangle and said nothing, on a ' +
        'device that has no camera to open',
    ).toContain('No camera was found on this device. Import the file instead.');
  });

  it('says the permission was refused, and offers the door that does not need one', async () => {
    stubCamera('NotAllowedError');
    await toTheDoors();
    await press('Open the camera');
    await settle(() => text().includes('Camera access was denied'));

    expect(text()).toContain('Camera access was denied. Allow the camera, or import the file instead.');
    // And the other two doors are still on screen to take instead.
    expect(doors()).toHaveLength(3);
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

  /*
   * And the way out of that alert has to be a way out.
   *
   * The chip called `setScreen('settings')` while `<Onboarding/>` was drawn
   * instead of all five screens, so it changed a value in the store and nothing
   * else: a person was told their characters were gone, offered the one route
   * back to them, and tapped a control that did nothing. "The app may never
   * claim something happened that did not happen" is the rule this file is
   * mostly about, and a dead chip is the same failure wearing a different coat.
   */
  it('opens the backup screen when the restore chip is taken from under the questions', async () => {
    // The chunk first: Settings is `lazy()`, and this asserts what is drawn.
    await import('../../src/ui/settings/Settings.tsx');
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
    expect(text()).toContain('Who are you at this table?');

    await press('RESTORE FROM A BACKUP');
    await settle(() => text().includes('Characters and backup'));

    expect(
      text(),
      'the one route back to the characters this alert has just reported missing ' +
        'is a chip that changes a value in the store and draws nothing',
    ).toContain('Characters and backup');
    expect(useApp.getState().screen).toBe('settings');
    // And not stranded there: the questions are down, so the header carries its
    // nav and its door again rather than leaving Settings with no way out.
    expect(text()).not.toContain('Who are you at this table?');
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'SETTINGS')).toBe(true);
    // Nothing was answered, so nothing was written: the questions are still
    // owed on the next launch.
    expect(loadPrefs().onboarded, 'a run nobody answered was recorded as done').toBe(false);
  });

  /*
   * The installed iOS app, which is the one device where an empty library is
   * not a new user.
   *
   * A Home Screen app on Apple's platforms is a separate storage container from
   * Safari, so the most committed user - the one who built a character and then
   * installed, because they liked it - opens the installed app and finds it
   * empty. `needsPasteboardBridge()` is what recognises that state, and the
   * shell has always let it outrank the questions.
   *
   * What no test in this suite could see is that the *header* did not: it read
   * `needsOnboarding` without the bridge term, so on exactly this device the
   * shell drew the five screens while the bar above them stripped its nav and
   * the door to Settings. On an installed iPad that is no navigation at all,
   * and `Recovery` - the one route back to characters stranded in Safari - sits
   * behind Play. jsdom's user agent is not iOS, which is how the two
   * expressions drifted with the whole suite green.
   */
  const realUserAgent = navigator.userAgent;

  function installedOnIos(): void {
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    const byWidth = window.matchMedia;
    window.matchMedia = ((query: string) =>
      query.includes('display-mode: standalone')
        ? ({
            matches: true,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
            onchange: null,
          } as unknown as MediaQueryList)
        : byWidth(query)) as typeof window.matchMedia;
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: realUserAgent,
      configurable: true,
    });
  });

  it('leaves an installed iPad every way out it had, rather than asking who it belongs to', async () => {
    setViewport(1024);
    installedOnIos();
    await boot();

    expect(
      text(),
      'an installed iPad whose Safari storage did not follow it was asked whether ' +
        'it is a player or a GM, instead of being told where its characters went',
    ).not.toContain('Who are you at this table?');
    // The tablet band draws no `TabBar`, so the header's nav and its SETTINGS
    // button are the whole of the navigation this device has.
    expect(
      [...container.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
      'the header drew no nav at a width where the tab bar is not drawn either, ' +
        'which leaves an installed iPad with no way off the screen it opened on',
    ).not.toEqual([]);
    expect(
      buttons().some((b) => (b.textContent ?? '').trim() === 'SETTINGS'),
      'the door to Settings - and with it file import and restore-from-backup - ' +
        'was taken away from the device the recovery screen was written for',
    ).toBe(true);
  });

  it('keeps the phone SETTINGS door on the same device', async () => {
    installedOnIos();
    await boot();

    expect(text()).not.toContain('Who are you at this table?');
    expect(
      buttons().some((b) => (b.textContent ?? '').trim() === 'SETTINGS'),
      'the only permanent route to Settings on a phone was removed while the ' +
        'shell was drawing the ordinary screens',
    ).toBe(true);
  });
});
