// @vitest-environment jsdom
/**
 * Does the settings screen tell the truth about working offline?
 *
 * The README's headline claim is *offline*. Until this row, the only place the
 * app ever mentioned a service worker was a `console.warn` in `App.tsx` and
 * some prose in comments: a registration that failed on an insecure context, or
 * in a Firefox private window, or on a chunk that 404'd against a half-published
 * deploy, produced one line in a console nobody has open and no other trace
 * anywhere. The app went on looking installed. Somebody walks into a basement
 * believing the sheet will open, and it does not.
 *
 * So the assertions here are about words on a screen rather than about the
 * probe - `tests/pwa/offlineStatus.test.ts` owns the probe. What matters here
 * is that each of the four answers reaches the user as a different sentence
 * with a different remedy, and that the row is not a snapshot taken once at
 * mount and then left to go stale.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

const SHELL = new URL('index.html', location.href).href;
const ASSET = new URL('assets/index-1a2b.js', location.href).href;

/** Cache Storage holding exactly these caches. */
function cacheStorage(contents: Record<string, string[]>): CacheStorage {
  const cache = (urls: string[]) => ({
    keys: async () => urls.map((url) => ({ url })),
    match: async (request: string) => (urls.includes(request) ? {} : undefined),
  });
  return {
    keys: async () => Object.keys(contents),
    open: async (name: string) => cache(contents[name] ?? []),
  } as unknown as CacheStorage;
}

/**
 * A `navigator.serviceWorker` that can change its mind.
 *
 * An `EventTarget` and not an object literal with stub listeners, because the
 * point of one test below is that the screen re-reads when `controllerchange`
 * fires - which is the ordinary first visit, where the worker activates and
 * claims the page a beat after it loaded.
 */
class FakeContainer extends EventTarget {
  controller: object | null = null;
  registration: { active: object } | undefined = undefined;
  async getRegistration(): Promise<{ active: object } | undefined> {
    return this.registration;
  }
}

function installContainer(container_: FakeContainer | undefined): void {
  if (container_ === undefined) {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    return;
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container_,
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollIntoView = (): void => {};
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);

  const character = playedCharacter();
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    screen: 'settings',
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  installContainer(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function render(element: React.ReactElement): Promise<void> {
  await act(async () => {
    root.render(element);
  });
  await settle();
}

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * The settings row with this label, chip and sentence together.
 *
 * By structure rather than by the words in it: the chip words are the thing
 * under test, and a helper that searched for "READY" could not fail on a row
 * that had stopped saying anything at all.
 */
function row(label: string): HTMLElement {
  const heading = [...container.querySelectorAll('div')].find(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim() === label,
  );
  const field = heading?.parentElement?.parentElement?.parentElement;
  if (field == null) throw new Error(`no settings row labelled "${label}" on the page`);
  return field;
}

const chip = (label: string): string =>
  (row(label).querySelector('.chip')?.textContent ?? '').trim();

const sentence = (label: string): string => row(label).textContent ?? '';

describe('the offline row on the settings screen', () => {
  it('says READY, with the number of files, when the app really is cached', async () => {
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));

    await render(<Settings />);

    expect(chip('Offline')).toBe('READY');
    expect(sentence('Offline')).toContain('2 files');
    expect(sentence('Offline')).toContain('opens with no connection');
  });

  it('says NOT CACHED, and what to do, when the worker is there and the cache is not', async () => {
    // The state `sw.js` warns about at length: the browser reclaimed Cache
    // Storage, or someone cleared site data, and the registration survived. The
    // app looks installed and would open to a blank screen.
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({}));

    await render(<Settings />);

    expect(chip('Offline')).toBe('NOT CACHED');
    expect(sentence('Offline')).toContain('blank screen');
    expect(sentence('Offline')).toContain('Open it once with a connection');
  });

  it('says NO WORKER when nothing is serving the page', async () => {
    installContainer(undefined);
    vi.stubGlobal('caches', cacheStorage({}));

    await render(<Settings />);

    expect(chip('Offline')).toBe('NO WORKER');
    expect(sentence('Offline')).toContain('every load needs the network');
  });

  it('says UNKNOWN rather than claiming a no when the browser will not answer', async () => {
    // Firefox in a private window rejects Cache Storage outright. "Not ready"
    // there would be the app asserting something it does not know, which is the
    // same defect as the silence it replaces, pointed the other way.
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
      open: async () => ({ keys: async () => [], match: async () => undefined }),
    });

    await render(<Settings />);

    expect(chip('Offline')).toBe('UNKNOWN');
    expect(sentence('Offline')).toContain('not the same as a no');
  });

  it('keeps the three states apart rather than collapsing them into ready or not', async () => {
    // The whole reason this is not a boolean. Two devices, both "not ready",
    // and the sentence each one needs to read is different.
    const words: string[] = [];
    const situations: Array<Record<string, string[]>> = [
      {},
      { 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] },
    ];
    for (const contents of situations) {
      const worker = new FakeContainer();
      worker.controller = {};
      installContainer(worker);
      vi.stubGlobal('caches', cacheStorage(contents));
      await render(<Settings />);
      words.push(chip('Offline'));
      await act(async () => root.unmount());
      container.remove();
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
    }
    installContainer(undefined);
    await render(<Settings />);
    words.push(chip('Offline'));

    expect(new Set(words).size, `three situations, ${words.join(' / ')}`).toBe(3);
  });

  it('re-reads when a worker takes charge, instead of leaving a stale no on screen', async () => {
    // The ordinary first visit: `sw.js` calls `clients.claim()` on activate, so
    // the page acquires a controller a beat after it loaded. A row read once at
    // mount would sit on NO WORKER for the rest of the session, which is a
    // false statement about an app that is now perfectly offline-ready.
    const worker = new FakeContainer();
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({}));

    await render(<Settings />);
    expect(chip('Offline')).toBe('NO WORKER');

    worker.controller = {};
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));
    await act(async () => {
      worker.dispatchEvent(new Event('controllerchange'));
    });
    await settle();

    expect(chip('Offline')).toBe('READY');
  });

  it('re-reads on demand, for the person who has just gone and found a connection', async () => {
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({}));

    await render(<Settings />);
    expect(chip('Offline')).toBe('NOT CACHED');

    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));
    const button = [...row('Offline').querySelectorAll('button')].find(
      (el) => (el.textContent ?? '').trim() === 'Check again',
    );
    expect(button, 'the offline row offers no way to ask again').toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();

    expect(chip('Offline')).toBe('READY');
  });

  it('reads the sentence out with the control, the way every other row does', async () => {
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));

    await render(<Settings />);

    const button = [...row('Offline').querySelectorAll('button')][0]!;
    const described = button.getAttribute('aria-describedby');
    expect(described, '"Check again" announces itself with no sentence at all').not.toBeNull();
    expect(document.getElementById(described!)?.textContent).toContain('2 files');
  });

  it('gives the state in a word, not only in a colour', async () => {
    // Colour is never the only carrier of meaning in this app, and a chip that
    // was green or red and blank would fail that on the one row whose entire
    // job is to be read at a glance before someone leaves the house.
    const worker = new FakeContainer();
    worker.controller = {};
    installContainer(worker);
    vi.stubGlobal('caches', cacheStorage({}));

    await render(<Settings />);

    expect(chip('Offline').length).toBeGreaterThan(3);
  });
});
