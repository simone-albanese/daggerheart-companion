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
// Add to Home Screen

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Ask the service worker to cache the Core Rulebook importer.
 *
 * The importer's worker is pdf.js - more than half of everything this app
 * ships - and it is deliberately left out of the install-time precache,
 * because on a phone the importer is disabled and those bytes could never be
 * used. A device that can run it says so here, once, and gets it in the
 * background so the feature still works offline.
 */
export function warmImporterCache(): void {
  navigator.serviceWorker?.ready
    .then((reg) => reg.active?.postMessage({ type: 'warm-importer' }))
    .catch(() => {
      // No worker, or the browser refused it. The importer still works; it
      // just fetches its chunk the first time someone opens it.
    });
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
