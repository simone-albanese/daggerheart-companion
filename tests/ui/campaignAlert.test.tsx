// @vitest-environment jsdom
/**
 * A campaign that will not reach the disk, said somewhere the GM can still see
 * it after they leave the GM screen.
 *
 * `gmStore` has set `writeError` since it was written. Two surfaces drew it -
 * the strip under `GmTopBar` and the panel inside SAVE - and both are inside
 * the GM section, so the sentence lasted exactly as long as the GM stayed on
 * that screen. MENU → PLAY to read a player's sheet, or Cards because somebody
 * asked what a card does, and the warning left with the screen while the tab
 * went on being the only place the evening existed.
 *
 * So the store publishes into `ui/shell/campaignAlert.ts` and `App.tsx` draws
 * `CampaignNotSaved` from it, in the slot the character store's `UnsavedWork`
 * already uses. What this file asks is the four things that can go wrong with
 * that:
 *
 *   - the sentence reaches the shell at all, and is the store's own words;
 *   - it survives a change of screen, in both directions;
 *   - it is not drawn twice while the GM screen is the one on show;
 *   - the two retry kinds stay distinct, because `'read'` cannot be helped by
 *     a flush and `'write'` cannot be helped by a second read.
 *
 * Every case here boots the real `App`, because the defect was entirely about
 * which component is mounted when. Rendering `CampaignNotSaved` on its own
 * would pass with `App.tsx` never mentioning it.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/store/db.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp, type Screen } from '../../src/store/state.ts';
import { flushGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { App } from '../../src/ui/shell/App.tsx';
import { publishCampaignAlert, useCampaignAlert } from '../../src/ui/shell/campaignAlert.ts';
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
  // The GM chunk arrives through `lazy()`, and `settle` below turns empty
  // macrotasks fast enough to finish before Vite has transformed it. Importing
  // it here puts it in the module cache, so the wait is real. Same reason
  // `gmShell.test.tsx` does it.
  await import('../../src/ui/gm/Gm.tsx');
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
  // The store's own failure, and the shell's copy of it. Clearing the first
  // publishes null into the second whenever it was set; the explicit call is
  // for the case where a test seeded the slot and not the store.
  useGm.setState({ writeError: null, writeRetry: null });
  publishCampaignAlert(null);
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
const main = (): HTMLElement => container.querySelector('main')!;

/**
 * The blocks the shell itself draws, which are the direct children of `<main>`.
 *
 * The GM screen's own strip is inside the screen - `main > div.stack > div` -
 * so this separates "the shell is saying it" from "the GM screen is saying it"
 * without either of them needing a test id.
 */
const shellAlerts = (): HTMLElement[] => [
  ...main().querySelectorAll<HTMLElement>(':scope > [role="alert"]'),
];

/** Every alert on the page that is not inside a dialog. */
const alerts = (): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>('[role="alert"]')].filter(
    (el) => el.closest('[role="dialog"]') === null,
  );

const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === label);

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** The heading only the shell's copy carries. */
const SHELL_HEADING = 'THE GM TOOLS CANNOT USE THIS DEVICE’S STORAGE';

/** A board write that threw, in the store's own words. */
const FAILED =
  'This device is out of space, so the campaign could not be written. What is on this screen is only in this tab, so closing it now loses it.';

async function boot(): Promise<void> {
  await db.putCharacter(playedCharacter());
  await act(async () => {
    root.render(createElement(App));
  });
  await settle(() => useApp.getState().ready);
}

/** Boot, then switch screens the way a person does. */
async function on(screen: Screen, ready: () => boolean = () => true): Promise<void> {
  await boot();
  await act(async () => {
    useApp.getState().setScreen(screen);
  });
  await settle(ready);
}

const onGm = (): Promise<void> => on('gm', () => text().includes('Nothing planned yet'));

/** Put a failure on the store, the way every path in `gmStore` does. */
function fail(message: string, retry: 'write' | 'read' | null): void {
  act(() => {
    useGm.setState({ writeError: message, writeRetry: retry });
  });
}

// ---------------------------------------------------------------------------

describe('a campaign that did not reach the disk, off the GM screen', () => {
  it('is on the shell, in the store’s own words', async () => {
    /*
     * The whole defect. The GM is on Play - looking at a player's sheet, or at
     * their own character - while the campaign they spent three hours on is in
     * one tab and nowhere else. Before this the store knew and nothing on the
     * page said so.
     */
    await on('play');
    fail(FAILED, 'write');

    const block = shellAlerts();
    expect(block, 'the campaign failure is nowhere on the shell').toHaveLength(1);
    expect(block[0]!.textContent ?? '').toContain('closing it now loses it');
    expect(block[0]!.textContent ?? '').toContain(SHELL_HEADING);
  });

  it('names the campaign when the failure is about one that is not open', async () => {
    /*
     * `writeAside` is the one write whose subject is not on the screen, so its
     * sentence names the campaign - "what is on this screen is only in this
     * tab" would be false there and would point the GM at the wrong board. The
     * shell must carry that sentence through rather than summarise it, which is
     * the one edit that could put the wrong table's name in front of them.
     */
    await on('cards');
    fail(
      '"The Hollow" could not be written to this device\'s storage. It is not the campaign open ' +
        'here, so nothing on this screen shows it: the change is only in this tab.',
      'write',
    );

    expect(shellAlerts()[0]!.textContent ?? '').toContain('"The Hollow"');
    expect(text()).toContain('not the campaign open here');
  });

  it('is still there after the GM leaves the screen it happened on', async () => {
    /*
     * The failure happens on the GM screen, where that screen's own strip says
     * so. The GM then taps MENU → PLAY. Before this the sentence went with the
     * screen; the tab was still the only copy of the evening.
     */
    await onGm();
    fail(FAILED, 'write');
    expect(shellAlerts(), 'the shell drew it while the GM screen was up').toHaveLength(0);

    await act(async () => {
      useApp.getState().setScreen('play');
    });
    await settle(() => shellAlerts().length > 0, 20);

    expect(shellAlerts(), 'the sentence left with the GM screen').toHaveLength(1);
    expect(text()).toContain('closing it now loses it');
  });

  it('goes when the GM comes back, leaving the screen’s own strip alone', async () => {
    // The other direction of the same rule, and the reason it is a condition
    // rather than a mount-once: coming back must take the shell's copy down.
    await on('play');
    fail(FAILED, 'write');
    expect(shellAlerts()).toHaveLength(1);

    await act(async () => {
      useApp.getState().setScreen('gm');
    });
    await settle(() => text().includes('Nothing planned yet'), 60);

    expect(shellAlerts(), 'the shell kept its copy over the GM screen').toHaveLength(0);
    expect(alerts(), 'the GM screen stopped saying it').toHaveLength(1);
  });

  it('is not said twice while the GM screen is the one on show', async () => {
    /*
     * Two blocks carrying one store field, forty pixels apart - one above the
     * pinned top bar and one below it - is the app raising its voice rather
     * than saying anything new. The GM screen's strip is argued for where it is
     * drawn; this one exists for the screens that have none.
     */
    await onGm();
    fail(FAILED, 'write');

    expect(alerts(), 'the failure is on the GM screen twice').toHaveLength(1);
    expect(text(), 'the shell heading is up on the screen that already says it').not.toContain(
      SHELL_HEADING,
    );
  });

  it('says nothing at all while the disk is behaving', async () => {
    // CONTROL. It passes against the pre-fix code as well; it is here because
    // an alert that is always up is the same defect as one that never is.
    await on('play');
    expect(alerts()).toHaveLength(0);
    expect(text()).not.toContain(SHELL_HEADING);
  });

  it('leaves when the store stops failing', async () => {
    await on('play');
    fail(FAILED, 'write');
    expect(shellAlerts()).toHaveLength(1);

    act(() => {
      useGm.setState({ writeError: null, writeRetry: null });
    });
    expect(useCampaignAlert.getState().alert, 'the slot kept a failure that is over').toBeNull();
    expect(shellAlerts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('the retry, from the shell', () => {
  it('flushes the board on a ’write’ failure, and keeps what is on screen', async () => {
    /*
     * `'write'` means there is something in memory that is not on the disk, so
     * the remedy is another flush - and the flush has to be of the *live*
     * board. A retry that read the disk again would clear the sentence just as
     * convincingly and would take the change that failed with it, which is why
     * `fear` and `replacedOnLoad` are asserted here and not just `writeError`.
     */
    await on('play');
    act(() => {
      useGm.getState().setFear(3);
    });
    fail(FAILED, 'write');

    const chip = button('TRY AGAIN');
    expect(chip, 'no retry was offered for a failure a flush can fix').toBeDefined();
    click(chip!);
    await settle(() => useGm.getState().writeError === null, 12);

    expect(useGm.getState().writeError, 'the retry wrote nothing').toBeNull();
    expect(shellAlerts()).toHaveLength(0);
    expect(useGm.getState().fear, 'the retry threw away the change that failed').toBe(3);
    expect(
      useGm.getState().replacedOnLoad,
      'the retry re-read the disk over the live board instead of writing it',
    ).toBe(false);
  });

  it('reads the disk again on a ’read’ failure, which no flush can help', async () => {
    /*
     * The other kind, and the one that proves they are not interchangeable.
     * After a failed read there is no campaign and `activeCampaignId` is null,
     * so `writeActive` returns at `base === undefined` on every flush, for the
     * life of the tab: a retry wired to `flushGm` is a button that flashes and
     * does nothing. `retryGm` drops the hydration memo and reads again, and the
     * campaign list arriving is what says it did.
     */
    await on('play');
    act(() => {
      useGm.setState({ campaigns: [], activeCampaignId: null });
    });
    fail(
      'This device’s storage could not be read (the database is closed), so nothing on this ' +
        'screen is being saved.',
      'read',
    );

    click(button('TRY AGAIN')!);
    await settle(() => useGm.getState().campaigns.length > 0, 40);

    expect(
      useGm.getState().campaigns.length,
      'the retry never read the disk, so a flush is all it did',
    ).toBeGreaterThan(0);
    expect(useGm.getState().writeError).toBeNull();
    expect(shellAlerts()).toHaveLength(0);
  });

  it('offers no retry where a retry can do nothing, and says what does', async () => {
    /*
     * A delete that threw. Nothing in the store can retry it: `flushGm` writes
     * the open campaign, which is not what failed and - when the doomed
     * campaign is the open one - is the opposite of what was asked for. The
     * store's sentence names the control that does help, and `writeRetry` is
     * null so that no surface draws a button over it.
     */
    await on('play');
    fail(
      'That campaign could not be deleted (The database is closed). It is still on this device ' +
        'and still in the list, and nothing else has changed — REMOVE tries again.',
      null,
    );

    expect(shellAlerts()).toHaveLength(1);
    expect(text()).toContain('REMOVE tries again');
    expect(button('TRY AGAIN'), 'a retry was offered for a failure it cannot fix').toBeUndefined();
  });

  it('says a retry did not land, instead of flashing and leaving the same block', async () => {
    /*
     * On success the block goes, which is visible. On failure it used to settle
     * back into exactly the state it was in, so a retry that failed and a
     * button that was never wired looked identical. The retry is made to fail
     * by pointing the store at a campaign that is not in the list, which is one
     * of the shapes the real failure has.
     */
    await on('play');
    act(() => {
      useGm.getState().setFear(3);
    });
    act(() => {
      useGm.setState({ writeError: FAILED, writeRetry: 'write', activeCampaignId: 'nobody' });
    });

    click(button('TRY AGAIN')!);
    await settle(() => text().includes('THAT TRY DID NOT LAND EITHER'), 12);

    expect(useGm.getState().writeError).not.toBeNull();
    expect(text()).toContain('THAT TRY DID NOT LAND EITHER');
  });

  it('stands on the project’s touch floor, declared inline', async () => {
    // jsdom reads only inline styles, so a floor arriving from a class or from
    // `align-self: stretch` measures 0 here. `--control` is `var(--tap)` = 44
    // under `(max-width: 1179px), (pointer: coarse)` and 34 above it.
    await on('play');
    fail(FAILED, 'write');
    const chip = button('TRY AGAIN')!;
    expect(chip.style.minHeight).toBe('var(--control)');
    expect(chip.style.minWidth).toBe('var(--control)');
  });
});

// ---------------------------------------------------------------------------

describe('what the storage alert is allowed to promise', () => {
  it('stops inviting a reload while a campaign is unwritten', async () => {
    /*
     * "; nothing has been written in the meantime" is an invitation to reload,
     * and it is only true while every write has landed. It was read off the
     * character store alone, so a GM whose campaign had not reached the disk
     * was offered the one action that throws the evening away - and offered it
     * on a screen where the campaign failure is not even drawn, because the GM
     * screen draws its own.
     */
    await onGm();
    act(() => {
      useApp.setState({ storageError: 'The database would not open' });
    });
    expect(text(), 'the clause was not there to begin with').toContain(
      'nothing has been written in the meantime',
    );

    fail(FAILED, 'write');
    expect(text()).not.toContain('nothing has been written in the meantime');
    expect(text(), 'the storage alert stopped offering the reload at all').toContain('RELOAD');
  });
});

// ---------------------------------------------------------------------------

describe('what the shell is allowed to import', () => {
  it('never reaches the GM store from the shell', () => {
    /*
     * CONTROL, and the reason `campaignAlert.ts` exists rather than a field on
     * `useApp` that `App.tsx` fills from `gmStore`. The last line of `gmStore`
     * starts reading IndexedDB - deliberately, so the GM chunk arriving is the
     * hydration starting - and it is pulled in by `lazy()` exactly when the GM
     * screen is opened. A static import here would put the GM chunk, the
     * bestiary and a campaign read into the first paint of a player who never
     * opens GM at all.
     *
     * It passes against the pre-fix code too, which is the point: this is the
     * shape the fix was not allowed to take.
     */
    for (const file of [
      'src/ui/shell/App.tsx',
      'src/ui/shell/CampaignNotSaved.tsx',
      'src/ui/shell/campaignAlert.ts',
    ]) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(
        source.match(/^import .*from '.*gm\/.*'/gm),
        `${file} imports the GM chunk, which starts a campaign read for everyone`,
      ).toBeNull();
    }
  });
});
