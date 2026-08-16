// @vitest-environment jsdom
/**
 * Does the app know whether it is actually offline-ready?
 *
 * It did not. A failed registration became `console.warn('[pwa] service
 * worker', error)` and nothing else; a grep across `src/ui` for serviceWorker,
 * controller, precache or offline returned prose in comments and no code. The
 * README's headline claim is *offline*, and the one situation the claim exists
 * for - a basement, no signal, a sheet that has to open - was the one situation
 * nothing in the app had ever checked.
 *
 * The states here are not decoration. `sw.js` says at length above
 * `ensurePrecached` that an activated worker sitting on an empty cache is a
 * real and silent condition: a browser reclaims Cache Storage under pressure,
 * and clearing site data takes the caches while leaving the registration
 * behind. That device has a worker and no app, and it is a different problem
 * with a different remedy from a device that has no worker at all. Collapsing
 * them into one "not ready" is how this app got into this section of the
 * backlog, so each state is asserted separately below.
 *
 * The counts are read from Cache Storage directly rather than asked of the
 * worker. Cache Storage is per-origin, so the page can open the very caches the
 * worker filled - and `public/sw.js` has exactly one message handler, taking
 * `skip-waiting` and `warm-importer`, which never replies to anything.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readOfflineStatus } from '../../src/pwa/register.ts';

/** Where `sw.js` stores the entry document: `index.html` under the deploy base. */
const SHELL = new URL('index.html', location.href).href;
const ASSET = new URL('assets/index-1a2b.js', location.href).href;

/**
 * A Cache Storage holding exactly these caches.
 *
 * `match` answers on the href alone, which is all the probe asks of it, and
 * `keys` returns request-shaped objects because that is what the real API
 * returns and counting them is the point.
 */
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

/** A `navigator.serviceWorker` in the state a browser would have it in. */
function serviceWorker(state: {
  controller?: unknown;
  registration?: { active: unknown } | undefined;
}): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: state.controller ?? null,
      getRegistration: async () => state.registration,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

/** A browser that has never heard of service workers, or an insecure context. */
function noServiceWorkerApi(): void {
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

afterEach(() => {
  noServiceWorkerApi();
  vi.unstubAllGlobals();
});

describe('reading offline readiness off the caches the worker filled', () => {
  it('says READY when a worker is in charge and the app is in the cache', async () => {
    serviceWorker({ controller: {} });
    vi.stubGlobal(
      'caches',
      cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }),
    );

    expect(await readOfflineStatus()).toEqual({ state: 'ready', controlled: true, files: 2 });
  });

  it('separates a worker with an empty cache from no worker at all', async () => {
    // The state `sw.js` warns about: the registration outlived the caches, so
    // the app still looks installed and opens to a white screen offline. The
    // remedy is one load with a connection, which is not the remedy for a
    // device that has no worker - hence two states and not one.
    serviceWorker({ controller: {} });
    vi.stubGlobal('caches', cacheStorage({}));

    expect(await readOfflineStatus()).toEqual({ state: 'empty', controlled: true, files: 0 });
  });

  it('will not call a cached document with no bundle behind it READY', async () => {
    // The half-filled precache: `index.html` is there and every chunk it names
    // is gone. Testing only for the document would report this as ready, and
    // it is a blank page with a spinner that never resolves.
    serviceWorker({ controller: {} });
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [] }));

    const status = await readOfflineStatus();
    expect(status.state).toBe('empty');
    expect(status.files).toBe(1);
  });

  it('will not call a cached bundle with no document READY either', async () => {
    serviceWorker({ controller: {} });
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [], 'dhc-assets-v1': [ASSET] }));

    expect((await readOfflineStatus()).state).toBe('empty');
  });

  it('says NO WORKER when nothing is registered, cached files or not', async () => {
    // Caches left behind by a registration that is gone. There are files on the
    // device and nothing that will ever serve them, so the honest answer is the
    // same as for an empty device - with the count, because it is true and it
    // explains where the space went.
    serviceWorker({ controller: null, registration: undefined });
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));

    expect(await readOfflineStatus()).toEqual({ state: 'none', controlled: false, files: 2 });
  });

  it('says NO WORKER when the browser has no service workers at all', async () => {
    noServiceWorkerApi();
    vi.stubGlobal('caches', cacheStorage({}));

    // Not unknown: an insecure context or a browser without the API is a
    // definite no, now and for every later load.
    expect(await readOfflineStatus()).toEqual({ state: 'none', controlled: false, files: null });
  });

  it('counts a worker that is installed but not controlling this page as ready', async () => {
    // A hard reload bypasses the worker for that one load. The app is still
    // offline-capable, and reporting NO WORKER here would be the screen
    // claiming something untrue about the next load.
    serviceWorker({ controller: null, registration: { active: {} } });
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL], 'dhc-assets-v1': [ASSET] }));

    expect(await readOfflineStatus()).toEqual({ state: 'ready', controlled: false, files: 2 });
  });

  it('ignores another app sharing the origin', async () => {
    // Every project of the same account shares an origin on github.io, and
    // `sw.js` prunes on the same `dhc-` prefix for the same reason.
    serviceWorker({ controller: {} });
    vi.stubGlobal(
      'caches',
      cacheStorage({
        'someone-elses-v3': [new URL('other.js', location.href).href],
        'dhc-shell-v1': [SHELL],
        'dhc-assets-v1': [ASSET],
      }),
    );

    expect((await readOfflineStatus()).files).toBe(2);
  });

  it('keeps reading after a VERSION bump renames both caches', async () => {
    // The names carry a hand-bumped version. Pinning to `dhc-shell-v1` would
    // report an empty precache with total confidence the day it moves.
    serviceWorker({ controller: {} });
    vi.stubGlobal(
      'caches',
      cacheStorage({ 'dhc-shell-v9': [SHELL], 'dhc-assets-v9': [ASSET] }),
    );

    expect((await readOfflineStatus()).state).toBe('ready');
  });

  // -------------------------------------------------------------------------
  // Unknown has to be reachable, and has to be its own answer

  it('says UNKNOWN rather than no when the browser never answers', async () => {
    serviceWorker({ controller: {} });
    vi.stubGlobal('caches', {
      keys: () => new Promise<string[]>(() => {}), // Never settles.
      open: async () => ({ keys: async () => [], match: async () => undefined }),
    });

    const status = await readOfflineStatus(20);
    expect(status).toEqual({ state: 'unknown', controlled: true, files: null });
  });

  it('says UNKNOWN when cache storage refuses the question', async () => {
    // Firefox in a private window rejects the whole of Cache Storage.
    serviceWorker({ controller: {} });
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
      open: async () => ({ keys: async () => [], match: async () => undefined }),
    });

    expect((await readOfflineStatus(20)).state).toBe('unknown');
  });

  it('says UNKNOWN when the registration lookup hangs', async () => {
    serviceWorker({ controller: null });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        getRegistration: () => new Promise(() => {}),
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    vi.stubGlobal('caches', cacheStorage({ 'dhc-shell-v1': [SHELL] }));

    expect((await readOfflineStatus(20)).state).toBe('unknown');
  });

  it('never rejects, whatever the browser does', async () => {
    // A settings row whose probe throws is a row that says nothing at all,
    // which is the silence this whole change exists to end.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        get controller() {
          throw new Error('the browser is having a bad day');
        },
      },
    });

    await expect(readOfflineStatus(20)).resolves.toEqual({
      state: 'unknown',
      controlled: false,
      files: null,
    });
  });
});
