// @vitest-environment jsdom
/**
 * What a stored preferences record means, now that there is a field it cannot
 * possibly contain - and where the app opens once it has been read.
 *
 * `onboarded` gates the first-run questions, and the interesting device is not
 * the new one - it is the one that has been playing since before the field
 * existed. Its record has every other key and not this one, and read naively
 * against a `false` default it becomes a device that gets asked who it is on an
 * upgrade. That is the case this file exists for: a mounted shell can say "the
 * question is on screen", and only arithmetic can say "and it is not on screen
 * for the person who has been using the app for two years", which is the state
 * nobody would think to open the app to check.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  allowedScreen,
  DEFAULT_PREFS,
  loadPrefs,
  openingScreen,
  savePrefs,
  type Prefs,
} from '../../src/store/prefs.ts';
import type { Screen } from '../../src/store/state.ts';

const KEY = 'dhc.prefs.v1';

/*
 * A localStorage of our own, which every jsdom file in this suite has to do.
 * Node 22 declares a global `localStorage` that reads back as `undefined`
 * unless the process was started with `--localstorage-file`, and it shadows the
 * one jsdom installs - so the property `prefs.ts` guards on with `typeof` is
 * present-but-undefined here rather than either of the two states it expects.
 */
class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

beforeAll(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('a stored record from before the questions existed', () => {
  it('is read as already onboarded, so an upgrade never asks who you are', () => {
    // Every key this build has except the new one - which is every record on
    // every device that has ever run a previous build, because `setScreen`
    // writes this key in the first minute anybody spends in the app.
    const { onboarded: _dropped, ...before } = DEFAULT_PREFS;
    localStorage.setItem(KEY, JSON.stringify({ ...before, lastScreen: 'cards' }));

    expect(
      loadPrefs().onboarded,
      'a device that has been used for two years is about to be asked whether it ' +
        'is a player or a GM, on an upgrade, which is when nobody is looking',
    ).toBe(true);
    // And nothing else about the record is reinterpreted on the way past.
    expect(loadPrefs().lastScreen).toBe('cards');
  });

  it('leaves a brand-new device unanswered', () => {
    expect(
      loadPrefs().onboarded,
      'no record at all is a device nobody has used, and it is the one device the ' +
        'questions exist for',
    ).toBe(false);
  });

  it('honours a record that owns the key, in both directions', () => {
    savePrefs({ ...DEFAULT_PREFS, onboarded: false });
    expect(
      loadPrefs().onboarded,
      'the upgrade rule is overriding a stored answer instead of filling in a ' +
        'missing one, so a run that was interrupted can never be finished',
    ).toBe(false);

    savePrefs({ ...DEFAULT_PREFS, onboarded: true });
    expect(loadPrefs().onboarded).toBe(true);
  });

  it('falls back to the defaults when the record is not JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe('where the app opens', () => {
  const gm = (over: Partial<Prefs> = {}): Prefs => ({
    ...DEFAULT_PREFS,
    lastScreen: 'gm',
    gmSection: true,
    ...over,
  });

  /*
   * The rule the onboarding step had to change, and the two either side of it
   * that it must not have traded away.
   *
   * A GM who answers "I run the game" is sent to the GM screen, and before this
   * that answer survived exactly one launch: `openingScreen` returned 'build'
   * for every empty library, so the second launch put the wizard in front of
   * somebody who had already said they were not making a character. The
   * empty-library rule was written about Play - "a Play screen with no
   * character is a screen with nothing on it" - and that argument was never
   * true of the GM screen, which needs no character and is fully usable without
   * one.
   */
  it('opens on the GM screen when that is where the last session ended', () => {
    expect(
      openingScreen(gm(), 0),
      'the GM branch of onboarding survives exactly one launch: the next one ' +
        'sends a GM with no characters back to the character wizard',
    ).toBe('gm');
  });

  it('still sends an empty library to Build for every other screen', () => {
    expect(openingScreen(DEFAULT_PREFS, 0)).toBe('build');
    expect(openingScreen({ ...DEFAULT_PREFS, lastScreen: 'cards' }, 0)).toBe('build');
    expect(openingScreen({ ...DEFAULT_PREFS, lastScreen: 'settings' }, 0)).toBe('build');
  });

  it('still refuses a stored GM screen the preferences have switched off', () => {
    expect(
      openingScreen(gm({ gmSection: false }), 0),
      '`allowedScreen` was traded away for the GM branch, so the app opens on a ' +
        'screen with no tab and no way back to one',
    ).toBe('build');
    expect(openingScreen(gm({ gmSection: false }), 2)).toBe('play');
  });

  it('leaves a library with characters in it exactly as it was', () => {
    expect(openingScreen(gm(), 2)).toBe('gm');
    expect(openingScreen({ ...DEFAULT_PREFS, lastScreen: 'cards' }, 2)).toBe('cards');
    expect(openingScreen(DEFAULT_PREFS, 2)).toBe('play');
  });

  /*
   * A stored screen that is not one of the five, which `Screen` cannot prevent.
   *
   * `loadPrefs` JSON-parses whatever is on the disk and spreads it over the
   * defaults; nothing looks at `lastScreen`. So the type is a promise about
   * code, not about storage, and the value can be anything - a hand-edited
   * record, a corrupted one, or a downgrade after a future build has added a
   * sixth screen and written its name here.
   */
  it('refuses a stored screen the shell has no branch for', () => {
    const nowhere = { ...DEFAULT_PREFS, lastScreen: 'sixth' as Screen };
    expect(
      allowedScreen(nowhere, nowhere.lastScreen),
      'the shell is about to draw a header, a tab bar and nothing in between',
    ).toBe('play');
    expect(openingScreen(nowhere, 2)).toBe('play');
    // And an empty library still lands on Build, as it does for the other four.
    expect(openingScreen(nowhere, 0)).toBe('build');
  });
});
