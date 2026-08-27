// @vitest-environment jsdom
/**
 * What the app offers a person whose screen will not render.
 *
 * `ScreenBoundary` is the last thing between a thrown error and a white page,
 * and its only control was "Try again" — which re-renders the identical
 * children from the identical state. A screen that throws because of the record
 * it is holding throws again, immediately, every time, and the button that
 * promised a way out is the thing keeping the user in the loop. Nothing else on
 * the fallback pointed anywhere.
 *
 * So the property here is: after a retry has been disproven, the screen leads
 * with the export instead, because a character that cannot be reached through a
 * broken screen can still be written to a file and opened somewhere else.
 *
 * A note on the console. Making a boundary catch is noisy by construction —
 * React logs the error it caught and `componentDidCatch` logs its own line —
 * so this file collects `console.error` and asserts on what was collected.
 * `screens.test.tsx` requires that collection to be empty, which is right for a
 * mount that is meant to succeed and impossible for one that is meant to fail.
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as backup from '../../src/store/backup.ts';
import { appBackupDeps } from '../../src/store/backupDeps.ts';
import { APP_VERSION } from '../../src/transfer/fileIo.ts';
import { ScreenBoundary } from '../../src/ui/shell/ScreenBoundary.tsx';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let logged: string[];

/** Flipped by the tests: the screen is broken, or it is not. */
let broken = true;

/** `tick` exists so a re-render of an unchanged tree still runs this function. */
function Boom({ tick }: { tick: number }): ReactElement {
  if (broken) throw new Error('the record could not be read');
  return createElement('p', null, `the screen, render ${String(tick)}`);
}

const screen = (tick = 0): ReactElement =>
  createElement(ScreenBoundary, {
    name: 'Play',
    children: createElement(Boom, { tick }),
  });

/**
 * The same boundary with nothing drawn around it.
 *
 * `App` passes `alone` for the first run and for nothing else. It is not a
 * style flag: while the questions are up the header draws no nav and no
 * SETTINGS door and the tab bar is suppressed, and all three read `onboarding`
 * from the store rather than from this boundary - so when the flow throws they
 * stay gone, and every control that could get somebody out went down with the
 * subtree.
 */
const aloneScreen = (tick = 0): ReactElement =>
  createElement(ScreenBoundary, {
    name: 'Onboarding',
    alone: true,
    children: createElement(Boom, { tick }),
  });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  broken = true;
  logged = [];
  const record = (...args: unknown[]): void => {
    logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
  };
  vi.spyOn(console, 'error').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * jsdom has no `navigator.clipboard` at all, and the user agent is part of the
 * report, so both are stubbed together and named so an assertion can find them.
 */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  vi.stubGlobal('navigator', { userAgent: 'TestBrowser/1.0', clipboard: { writeText } });
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const button = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').includes(text));
const shown = (): string => container.textContent ?? '';

function press(text: string): void {
  const found = button(text);
  expect(found, `nothing on the fallback reads "${text}"`).toBeDefined();
  act(() => {
    found?.click();
  });
}

describe('the way out of a screen that will not render', () => {
  it('holds the export back until retrying has been tried, then leads with it', () => {
    act(() => {
      root.render(screen());
    });

    // It caught it, and it said so where the only reporter is.
    expect(logged.join(' '), 'the boundary reported nothing').toContain('[Play]');
    expect(shown()).toContain('Play could not open');

    // First failure: a retry is a reasonable thing to offer, and the only
    // thing offered. Suggesting an export to somebody whose screen has
    // flickered once would be crying wolf.
    expect(button('Save a copy of everything'), 'offered the export before a retry').toBeUndefined();
    expect(button('Try again')).toBeDefined();

    press('Try again');

    // Second failure, from the same render of the same state. Now the retry is
    // not a remedy, it is the loop, and the fallback has to say so and point
    // somewhere else.
    expect(shown(), 'the fallback never admitted the retry had failed').toMatch(/same failure/i);
    expect(
      button('Save a copy of everything'),
      'a second identical failure still offered nothing but a third identical attempt',
    ).toBeDefined();
    // Still there, demoted: some failures really are passing ones.
    expect(button('Try again')).toBeDefined();
  });

  it('writes the file itself rather than pointing at a screen that may also be broken', async () => {
    const run = vi.spyOn(backup, 'runBackup').mockResolvedValue({
      ok: true,
      wrote: true,
      route: 'download',
      fileName: 'daggerheart-2026-08-16.json',
      characters: 2,
      campaigns: 0,
      campaignNames: [],
      notReadable: [],
      notice: null,
      reason: null,
      at: '2026-08-16T10:00:00.000Z',
    });

    act(() => {
      root.render(screen());
    });
    press('Try again');
    press('Save a copy of everything');
    await act(async () => {
      await Promise.resolve();
    });

    // The store's copy, not the disk's: on a device where writes are failing,
    // the disk is precisely where the work is not.
    expect(run.mock.calls[0]).toEqual(['manual', { interactive: true }, appBackupDeps]);
    expect(shown(), 'the export said nothing about what it had done').toContain(
      'daggerheart-2026-08-16.json',
    );
    expect(shown()).toContain('2 characters');
  });

  /**
   * A run that succeeded and still left something out says so here too.
   *
   * `notice` is a true sentence about a run that did *not* fail: campaigns a
   * device with no folder cannot take, and records a newer build wrote. That
   * run stamps the clock and clears `lastError`, so the panel afterwards reads
   * "Last backup: Today" with no detail at all - `notice` is the only thing
   * between the GM and a complete-looking backup that is missing every campaign
   * they have. Both mocks above hardcode it to null, which is why deleting the
   * field at all four render sites was silent under the whole suite.
   */
  it('says what the export left out, on a run that otherwise succeeded', async () => {
    vi.spyOn(backup, 'runBackup').mockResolvedValue({
      ok: true,
      wrote: true,
      route: 'download',
      fileName: 'daggerheart-backup-2026-08-27.dhbackup',
      characters: 3,
      campaigns: 0,
      campaignNames: [],
      notReadable: [],
      notice:
        'Campaign files can only be written into a folder, and this browser has none, so ' +
        '"The Sablewood Winter", "Bones of the Reach" are not in this backup. SAVE A COPY ' +
        'in the GM section writes one campaign to a file by hand.',
      reason: null,
      at: '2026-08-27T10:00:00.000Z',
    });

    act(() => {
      root.render(screen());
    });
    press('Try again');
    press('Save a copy of everything');
    await act(async () => {
      await Promise.resolve();
    });

    expect(shown()).toContain('Saved daggerheart-backup-2026-08-27.dhbackup');
    expect(
      shown(),
      'the screen said a backup was saved and never said the two campaigns are not in it',
    ).toContain('are not in this backup');
    expect(shown()).toContain('The Sablewood Winter');

    /*
     * And it is set as prose. `.t-meta` is 10px mono at line-height 1 with no
     * width at all - right for the 53 characters this line used to carry, and
     * for these 400-odd it is ten line boxes of 13px glyphs stepping 10px, so
     * every line overlaps the one above it by three pixels; on a desktop it is
     * one unbroken 1232px run. `.t-dense` is what the `retried` paragraph above
     * already uses for the same kind of sentence.
     */
    const line = container.querySelector('[role="status"]');
    expect(line?.textContent).toContain('are not in this backup');
    expect(
      line?.className,
      'a 400-character sentence in the 10px/1 mono metadata role overlaps its own lines',
    ).not.toContain('t-meta');
    expect(line?.className).toContain('t-dense');
    expect((line as HTMLElement | null)?.style.maxWidth).toBe('420px');
  });

  it('repeats what the export said when the export did nothing', async () => {
    vi.spyOn(backup, 'runBackup').mockResolvedValue({
      ok: true,
      wrote: false,
      route: 'none',
      fileName: null,
      characters: 0,
      campaigns: 0,
      campaignNames: [],
      notReadable: [],
      notice: null,
      reason: 'There is nothing to back up yet.',
      at: null,
    });

    act(() => {
      root.render(screen());
    });
    press('Try again');
    press('Save a copy of everything');
    await act(async () => {
      await Promise.resolve();
    });

    expect(shown(), 'a backup that wrote nothing was reported as a saved file').toContain(
      'There is nothing to back up yet.',
    );
    expect(shown()).not.toMatch(/Saved /);
  });

  it('gives a screen that recovered its first attempt back', () => {
    act(() => {
      root.render(screen(0));
    });
    // The retry works this time, and the screen comes back.
    broken = false;
    press('Try again');
    expect(shown()).toContain('the screen, render 0');

    // Some time later, something else in the same screen throws. That is a
    // first failure, not a third: offering the export straight away would be
    // reporting a loop that has not happened.
    broken = true;
    act(() => {
      root.render(screen(1));
    });
    expect(shown()).toContain('Play could not open');
    expect(
      button('Save a copy of everything'),
      'a screen that had already recovered was treated as still looping',
    ).toBeUndefined();

    // And it earns the offer the same way as the first time.
    press('Try again');
    expect(button('Save a copy of everything')).toBeDefined();
  });
});

/**
 * The report a person on a phone can actually send back.
 *
 * `componentDidCatch` is handed `info.componentStack` and used to throw it at
 * `console.error` and nowhere else, so the fallback could not have shown where
 * the failure was even if it had wanted to. The two console calls in this
 * app's entire `src` are the only reporters it has, and reaching a console on
 * iOS needs a Mac and a cable.
 */
describe('what the person holding the phone can send back', () => {
  it('shows where it happened, not only what it said', () => {
    act(() => {
      root.render(screen());
    });

    expect(shown(), 'the message never reached the screen').toContain(
      'the record could not be read',
    );
    expect(
      container.querySelector('pre')?.textContent ?? '',
      'the component stack went to the console and nowhere a user can see',
    ).toContain('Boom');
  });

  it('puts the whole report on the pasteboard, version and browser included', async () => {
    let written = '';
    stubClipboard(async (text) => {
      written = text;
    });

    act(() => {
      root.render(screen());
    });
    press('Copy the error report');
    await act(async () => {
      await Promise.resolve();
    });

    // Which screen, which build, which browser, what broke and where. Those
    // are the questions a report always raises and none of them can be
    // answered from a retyped sentence.
    expect(written).toContain('Play could not open');
    expect(written, 'no version, so nobody can tell which build this was').toContain(APP_VERSION);
    expect(written).toContain('the record could not be read');
    expect(written, 'the component stack was left out of the report').toContain('Boom');
    expect(written, 'no browser, so nobody can reproduce it').toContain('TestBrowser/1.0');
    // Not a backup: this is going to somebody else.
    expect(written).not.toContain('schemaVersion');

    expect(shown(), 'the copy happened silently').toMatch(/Copied/);
  });

  it('does not claim a copy the browser refused', async () => {
    stubClipboard(async () => {
      throw new Error('Write permission denied.');
    });

    act(() => {
      root.render(screen());
    });
    press('Copy the error report');
    await act(async () => {
      await Promise.resolve();
    });

    expect(shown(), 'a refused clipboard was reported as a copy').not.toMatch(/^Copied/m);
    expect(shown()).toMatch(/would not give this page the clipboard/);
    // And it says what to do instead, because the details are on the screen.
    expect(shown()).toMatch(/photograph/i);
  });

  it('does not promise a way out it cannot see, on the one screen that has none', () => {
    /*
     * "Everything else still works" is true of the five screens, which keep a
     * header nav and a tab bar above and below this fallback. It is false of
     * the first run, and measured false: at 320, 393, 744 and 1280 the whole
     * document holds three buttons and all of them are this fallback's own.
     *
     * The house rule is that the app may never claim something happened that
     * did not happen, and the first launch of a new install is the worst place
     * in the app to break it - it is the only screen a person has seen.
     */
    act(() => {
      root.render(aloneScreen());
    });

    expect(
      shown(),
      'the fallback told a stranded first-run user that everything else still works',
    ).not.toMatch(/Everything else still works/);
    expect(shown()).toMatch(/Nothing has been saved yet/);
    // And it says what the one live control will do, rather than leaving the
    // person to guess: `Try again` remounts the flow, whose step and answers
    // are local state, so it starts from the first question.
    expect(shown()).toMatch(/Try again starts the questions over/);
  });

  it('still tells the five screens the true thing, which is the useful one', () => {
    // The guard must not cost the ordinary case its sentence: a Play screen
    // that throws really does leave a working shell around it, and saying so
    // is the difference between a broken screen and a broken app.
    act(() => {
      root.render(screen());
    });

    expect(shown()).toMatch(/Everything else still works/);
    expect(shown()).toMatch(/your characters live in this device/);
    expect(shown()).not.toMatch(/Nothing has been saved yet/);
  });
});
