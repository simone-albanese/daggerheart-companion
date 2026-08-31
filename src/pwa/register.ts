/**
 * The three browser seams a PWA needs, each wrapped so the UI can call it
 * without asking whether it exists: the worker, the install prompt, the wake
 * lock. All three are missing on some platform the app has to run on - the
 * install prompt on every iOS browser, the wake lock on Safari before 16.4 -
 * so each one degrades to an inert handle rather than to a thrown error.
 *
 * Nothing here reads or writes app state, and nothing here retries. The UI owns
 * the timing: when to offer the update, when to offer the install, when a
 * session starts and ends.
 */

/** Vite writes the deploy base here; the worker must be registered from it so
 *  its scope covers the app and nothing above it. */
const BASE = import.meta.env.BASE_URL;

// Workers need a secure context, which localhost counts as. Firefox in a
// private window has `serviceWorker` on the navigator and refuses to register.
const supportsServiceWorker = (): boolean =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof self !== 'undefined' &&
  self.isSecureContext;

export interface ServiceWorkerHandle {
  /** Ask the browser to re-check sw.js now, e.g. when the app regains focus. */
  check(): Promise<void>;
  /** Drop the listeners. The worker keeps running; this is not an unregister. */
  dispose(): void;
}

export interface RegisterOptions {
  /**
   * A new worker has installed and is waiting. Call `apply` to activate it and
   * reload; the UI decides when, because mid-combat is the wrong moment to
   * swap the bundle. Not called for the first install - there is nothing to
   * update from, and the page is already running the code it will keep.
   */
  onUpdateReady?: (apply: () => void) => void;
  /** Registration failed. Offline still works if a worker is already installed. */
  onError?: (error: unknown) => void;
}

export function registerServiceWorker(options: RegisterOptions = {}): ServiceWorkerHandle {
  const inert: ServiceWorkerHandle = { check: async () => {}, dispose: () => {} };
  if (!supportsServiceWorker()) return inert;

  // Tell the worker a page has loaded, so it can notice a Cache Storage the
  // browser reclaimed while it was activated and rebuild it - see the `hello`
  // handler in `sw.js` for why nothing else is in a position to. This is the
  // same postMessage the removed `warmImporterCache` made; what it asked for
  // afterwards was the importer's pdf.js chunk, and only that part is gone.
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage({ type: 'hello' }))
    .catch(() => {
      // No worker, or the browser refused it. Nothing here is load-bearing for
      // a page that is already on screen.
    });

  const abort = new AbortController();
  const { signal } = abort;

  // Activating the waiting worker changes the controller, which is the cue to
  // reload. Only reload when we asked for it: `clients.claim()` fires the same
  // event on a first install, and reloading there would be a visible flinch.
  let applying = false;
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (applying) location.reload();
    },
    { signal },
  );

  const offer = (worker: ServiceWorker): void => {
    options.onUpdateReady?.(() => {
      applying = true;
      worker.postMessage({ type: 'skip-waiting' });
    });
  };

  const watch = (reg: ServiceWorkerRegistration): void => {
    // Already waiting when the page loaded: an update installed during a
    // previous visit that was never taken.
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);

    reg.addEventListener(
      'updatefound',
      () => {
        const installing = reg.installing;
        if (!installing) return;
        let installed = false;
        installing.addEventListener(
          'statechange',
          () => {
            if (installing.state === 'installed') {
              installed = true;
              if (navigator.serviceWorker.controller) offer(installing);
            } else if (installing.state === 'redundant' && !installed) {
              // The install threw: a chunk that 404s against a half-published
              // deploy is the likely cause. The previous worker stays in
              // charge, so the app is still offline-capable - on the old
              // bundle, indefinitely, and nothing else would ever say so.
              // (A worker that did install and is later superseded by a newer
              // one goes redundant too; that one is routine, hence the flag.)
              options.onError?.(new Error('service worker install failed'));
            }
          },
          { signal },
        );
      },
      { signal },
    );
  };

  const ready = navigator.serviceWorker
    // `updateViaCache: 'none'` keeps sw.js itself out of the HTTP cache. A
    // worker served from a stale cache is an update that never arrives.
    .register(`${BASE}sw.js`, { scope: BASE, type: 'classic', updateViaCache: 'none' })
    .then((reg) => {
      if (signal.aborted) return null;
      watch(reg);
      return reg;
    })
    .catch((error: unknown) => {
      options.onError?.(error);
      return null;
    });

  return {
    // Registration takes a moment, and the first `check()` tends to arrive the
    // instant the app regains focus. Waiting for it costs nothing; skipping it
    // would drop the one check the user actually waited for.
    check: async () => {
      try {
        await (await ready)?.update();
      } catch (error) {
        options.onError?.(error);
      }
    },
    dispose: () => abort.abort(),
  };
}

// ---------------------------------------------------------------------------
// Is this device actually offline-ready?

/**
 * The four honest answers to "will this app open with the radio off".
 *
 *   ready    A worker is in charge and the app's files are in the cache.
 *   empty    A worker is in charge and the files are not. A browser reclaims
 *            Cache Storage under pressure and clearing site data takes the
 *            caches while leaving the registration, so this is a real state and
 *            not a transient one - `sw.js` calls it out at length above
 *            `ensurePrecached`. Offline, right now, this opens to nothing.
 *   none     No worker. Every load needs the network, whatever the README says.
 *   unknown  The browser did not answer. Not a no - see `readOfflineStatus`.
 *
 * `empty` is why this is not a boolean. The two failures have different causes
 * and different remedies - one needs a worker installed, the other needs one
 * load with a connection so the cache refills - and a screen that collapsed
 * them into "not ready" would be telling a user to do the wrong thing half the
 * time.
 */
export type OfflineState = 'ready' | 'empty' | 'none' | 'unknown';

export interface OfflineStatus {
  state: OfflineState;
  /**
   * A worker is controlling this very page, rather than merely being installed.
   * False with `state: 'ready'` is the hard-reload case: Shift-reload bypasses
   * the worker for that one load, and the app is still offline-capable.
   */
  controlled: boolean;
  /** Entries across the app's caches; null when nothing could be read. */
  files: number | null;
}

/**
 * The prefix `sw.js` gives both of its caches, copied here rather than shared,
 * because `public/sw.js` is not a module and nothing can import from it.
 *
 * The prefix and not the two full names on purpose: the names carry a VERSION
 * that gets bumped by hand when the shape of the caches changes, and a settings
 * screen that went on reading `dhc-shell-v1` after that bump would report an
 * empty precache with total confidence. `sw.js` sweeps on the same prefix, for
 * the same reason - it is the stable half of the name.
 */
const CACHE_PREFIX = 'dhc-';

/** Long enough that a busy Cache Storage is not called a failure, short enough
 *  that a settings row does not sit on "checking" while someone waits. */
const PROBE_TIMEOUT_MS = 3000;

/**
 * What the worker has, read from the page.
 *
 * Cache Storage is per-origin, not per-client: the caches the worker filled are
 * the same objects this page can open, so the counts need no protocol and no
 * round trip through the worker. Which is just as well - `sw.js` has exactly
 * one message handler, it takes `skip-waiting` and `hello`, and it never
 * replies to anything.
 *
 * Two things are read, and both are needed: the entry document, which is what a
 * navigation offline resolves to, and a count of the hashed files behind it. A
 * document with no bundle in the assets cache is not an app - it is a blank
 * page and a script tag pointing at a 404 - so the document alone is not the
 * test.
 *
 * `entry` and not `document`, because a local named `document` would shadow the
 * DOM's for the length of the function.
 */
async function readPrecache(): Promise<{ entry: boolean; shell: number; assets: number }> {
  const storage: CacheStorage | undefined = globalThis.caches;
  if (storage === undefined) throw new Error('this browser exposes no cache storage');

  // The same href `sw.js` stores the document under: its `ROOT` is the
  // directory it was registered from, which is BASE.
  const entryHref = new URL('index.html', new URL(BASE, location.href)).href;
  let entry = false;
  let shell = 0;
  let assets = 0;

  for (const name of await storage.keys()) {
    if (!name.startsWith(CACHE_PREFIX)) continue; // A sibling app on the same origin.
    const cache = await storage.open(name);
    const count = (await cache.keys()).length;
    if (name.startsWith(`${CACHE_PREFIX}assets-`)) assets += count;
    else shell += count;
    if (!entry && (await cache.match(entryHref)) !== undefined) entry = true;
  }
  return { entry, shell, assets };
}

/** Resolve to `undefined` when the work rejects, or does not finish in time. */
function within<T>(work: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    const settle = (value: T | undefined): void => {
      clearTimeout(timer);
      resolve(value);
    };
    void work.then(settle, () => settle(undefined));
  });
}

/**
 * Whether this device can open the app offline, in the terms above.
 *
 * `unknown` is a state and not an error swallowed into a no. Every step here is
 * a promise the browser may simply never settle - `getRegistration` on a worker
 * that is mid-install, `caches.keys()` behind a precache fill that is writing a
 * megabyte at the time - and Firefox in a private window rejects the whole of
 * Cache Storage outright. Reporting any of those as "not offline-ready" would
 * be the app claiming to know something it does not, which is the same defect
 * as claiming to be ready when it is not, pointed the other way.
 *
 * Never rejects. A settings row that throws is a row that says nothing at all.
 */
export async function readOfflineStatus(
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<OfflineStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    // No worker is possible here, now or later: an insecure context, or a
    // browser without the API. That is a definite no rather than an unknown.
    return { state: 'none', controlled: false, files: null };
  }
  let controlled = false;
  try {
    controlled = navigator.serviceWorker.controller !== null;
  } catch {
    // The one read here that is synchronous, and so the one `within` below
    // cannot turn into an answer. A browser that throws looking at its own
    // controller has told us nothing, which is what `unknown` is for.
    return { state: 'unknown', controlled: false, files: null };
  }

  const probe = (async (): Promise<OfflineStatus> => {
    // Only ask when the cheap answer was no. A controlled page has a worker by
    // definition, and `getRegistration` is the call most likely to hang.
    const installed =
      controlled || (await navigator.serviceWorker.getRegistration())?.active != null;
    const { entry, shell, assets } = await readPrecache();
    const files = shell + assets;
    if (!installed) return { state: 'none', controlled, files };
    return { state: entry && assets > 0 ? 'ready' : 'empty', controlled, files };
  })();

  return (await within(probe, timeoutMs)) ?? { state: 'unknown', controlled, files: null };
}

// ---------------------------------------------------------------------------
// Add to Home Screen

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface InstallPromptHandle {
  /** True while the browser is holding a prompt we are allowed to show. */
  available(): boolean;
  /** Show it. One shot: the event cannot be replayed, so this consumes it. */
  show(): Promise<InstallOutcome>;
  dispose(): void;
}

/**
 * `beforeinstallprompt` is Chromium-only and fires once, unprompted, whenever
 * the browser decides the app is installable. It has to be captured and held,
 * because by the time a user reaches an "Add to Home Screen" button the event
 * is long gone.
 *
 * `onChange(false)` is the normal state everywhere else - iOS has no prompt to
 * offer and the UI should fall back to telling the user where Share > Add to
 * Home Screen lives. Which matters more than it sounds: on iOS an installed
 * app is markedly less likely to have its IndexedDB reclaimed.
 */
export function watchInstallPrompt(
  onChange: (available: boolean) => void,
): InstallPromptHandle {
  if (typeof window === 'undefined') {
    return { available: () => false, show: async () => 'unavailable', dispose: () => {} };
  }

  const abort = new AbortController();
  const { signal } = abort;
  let deferred: BeforeInstallPromptEvent | null = null;

  window.addEventListener(
    'beforeinstallprompt',
    (event) => {
      event.preventDefault();
      deferred = event as BeforeInstallPromptEvent;
      onChange(true);
    },
    { signal },
  );

  window.addEventListener(
    'appinstalled',
    () => {
      deferred = null;
      onChange(false);
    },
    { signal },
  );

  return {
    available: () => deferred !== null,
    show: async () => {
      const event = deferred;
      if (!event) return 'unavailable';
      deferred = null;
      onChange(false);
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome;
    },
    dispose: () => abort.abort(),
  };
}

// ---------------------------------------------------------------------------
// Wake lock

export interface WakeLockHandle {
  /** Hold the screen awake. Idempotent, and a no-op where unsupported. */
  request(): Promise<void>;
  /** Let the screen sleep again. */
  release(): Promise<void>;
  held(): boolean;
  dispose(): void;
}

/**
 * A screen wake lock for the length of a session: a character sheet that dims
 * every thirty seconds is unusable at a table.
 *
 * The browser drops the sentinel whenever the document stops being visible -
 * a tab switch, a lock screen, a notification shade - and never restores it, so
 * the visibility listener is not a nicety, it is the only thing that makes the
 * lock survive the first interruption.
 *
 * Failures are swallowed. The request is refused for reasons the app cannot
 * address (low battery, a hidden document, a policy) and the cost is a screen
 * that dims, which is a nuisance and not a bug.
 */
export function createWakeLock(): WakeLockHandle {
  const supported =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator && typeof document !== 'undefined';
  if (!supported) {
    return { request: async () => {}, release: async () => {}, held: () => false, dispose: () => {} };
  }

  const abort = new AbortController();
  let sentinel: WakeLockSentinel | null = null;
  let pending: Promise<void> | null = null;
  let wanted = false;

  const take = async (): Promise<void> => {
    try {
      const next = await navigator.wakeLock.request('screen');
      // The request may have been abandoned while it was in flight.
      if (!wanted || document.visibilityState !== 'visible') {
        await next.release();
        return;
      }
      sentinel = next;
      next.addEventListener('release', () => {
        if (sentinel === next) sentinel = null;
      });
    } catch {
      sentinel = null;
    }
  };

  const acquire = async (): Promise<void> => {
    if (sentinel !== null || !wanted || document.visibilityState !== 'visible') return;
    // One request in flight at a time. Two overlapping ones - and they overlap
    // readily, because a visibilitychange arrives while the session's own
    // request is still unresolved - are two sentinels from the browser, of
    // which only one can be stored. The other is a screen that never sleeps
    // again and no handle left to say so.
    pending ??= take().finally(() => {
      pending = null;
    });
    await pending;
  };

  document.addEventListener('visibilitychange', () => void acquire(), { signal: abort.signal });

  return {
    request: async () => {
      wanted = true;
      await acquire();
    },
    release: async () => {
      wanted = false;
      const current = sentinel;
      sentinel = null;
      try {
        await current?.release();
      } catch {
        // Already released, or the document went away first.
      }
    },
    held: () => sentinel !== null,
    dispose: () => {
      abort.abort();
      wanted = false;
      void sentinel?.release().catch(() => {});
      sentinel = null;
    },
  };
}
