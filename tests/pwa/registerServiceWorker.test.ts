/**
 * The update seam. Its whole job is to fire exactly once, at the right moment,
 * on a page that has been open for hours - so the cases worth pinning down are
 * the ones where it must stay quiet: a first install, and a controller change
 * nobody asked for. Reloading the page under a player mid-combat is the failure
 * mode this module exists to avoid.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../../src/pwa/register.ts';

type Handler = (event?: unknown) => void;

function emitter() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    addEventListener(type: string, fn: Handler, options?: { signal?: AbortSignal }) {
      const bucket = handlers.get(type) ?? new Set<Handler>();
      bucket.add(fn);
      handlers.set(type, bucket);
      options?.signal?.addEventListener('abort', () => bucket.delete(fn));
    },
    emit(type: string) {
      [...(handlers.get(type) ?? [])].forEach((fn) => fn());
    },
    count: (type: string) => handlers.get(type)?.size ?? 0,
  };
}

function stubEnvironment(options: { controller?: boolean; failRegister?: boolean } = {}) {
  const container = emitter();
  const registration = emitter();
  const worker = emitter();
  const posted: unknown[] = [];
  // Kept apart from `posted` on purpose. `posted` is the update seam's channel
  // and the tests below assert it holds exactly one message; the hello goes to
  // a different worker for a different reason, and folding the two together
  // would cost those assertions their exactness.
  const greetings: unknown[] = [];
  const state = { worker: 'installing' as ServiceWorkerState };
  const reg = {
    ...registration,
    installing: { ...worker, postMessage: (m: unknown) => posted.push(m), get state() { return state.worker; } },
    // The worker already running. `ready` resolves to the registration in every
    // browser that has service workers at all, and the module posts its `hello`
    // through it - so a fixture without one is not a stricter environment, it is
    // an impossible one, and it was failing every test in this file on a
    // `.then` of undefined rather than on anything the module got wrong.
    active: { postMessage: (m: unknown) => greetings.push(m) },
    waiting: null,
    update: vi.fn(async () => {}),
  };
  const reloads = { count: 0 };

  vi.stubGlobal('self', { isSecureContext: true });
  vi.stubGlobal('location', { reload: () => (reloads.count += 1) });
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ...container,
      controller: options.controller === false ? null : {},
      ready: Promise.resolve(reg),
      register: vi.fn(async () => {
        if (options.failRegister) throw new Error('registration refused');
        return reg;
      }),
    },
  });

  return {
    reg,
    posted,
    greetings,
    reloads,
    container,
    /** The browser's sequence: a worker appears, installs, then waits. */
    deploy: (finalState: ServiceWorkerState = 'installed') => {
      registration.emit('updatefound');
      state.worker = finalState;
      worker.emit('statechange');
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('saying hello, which is what rebuilds a reclaimed precache', () => {
  /*
   * The worker can only check its own caches when something wakes it, and a
   * browser that reclaims Cache Storage does not install a new worker
   * afterwards - so `activate`, the only other caller of `ensurePrecached`, is
   * never coming round again. The page that has just loaded is not controlled
   * by it either, so its navigation did not reach the worker.
   *
   * This post is therefore the whole of the fix for a production case where an
   * activated worker sat on an empty `dhc-shell-v1`, one flight from a white
   * screen. It used to ride on `warm-importer`, posted only by a desktop that
   * had decided it could run the Core Rulebook importer; the importer is gone
   * and this is not, which is the point of asserting it here rather than
   * leaving it to be deleted as importer leftovers next time someone greps.
   */
  it('posts hello to the active worker as soon as the registration is ready', async () => {
    const env = stubEnvironment();
    const handle = registerServiceWorker();
    await handle.check();
    await Promise.resolve();

    expect(env.greetings).toEqual([{ type: 'hello' }]);
    handle.dispose();
  });

  it('does not post it where there are no service workers at all', async () => {
    vi.stubGlobal('self', { isSecureContext: true });
    vi.stubGlobal('navigator', {});
    expect(() => registerServiceWorker()).not.toThrow();
  });
});

describe('registerServiceWorker', () => {
  it('offers the update once a new worker is installed behind a live controller', async () => {
    const env = stubEnvironment();
    const offered: Array<() => void> = [];
    const handle = registerServiceWorker({ onUpdateReady: (apply) => offered.push(apply) });
    await handle.check();

    env.deploy();
    expect(offered).toHaveLength(1);

    offered[0]!();
    expect(env.posted).toEqual([{ type: 'skip-waiting' }]);
    expect(env.reloads.count, 'the reload waits for the worker to actually take over').toBe(0);

    env.container.emit('controllerchange');
    expect(env.reloads.count).toBe(1);
  });

  it('stays quiet on a first install, and on a controller change nobody asked for', async () => {
    const env = stubEnvironment({ controller: false });
    const offered: Array<() => void> = [];
    const handle = registerServiceWorker({ onUpdateReady: (apply) => offered.push(apply) });
    await handle.check();

    env.deploy();
    expect(offered).toEqual([]);

    // `clients.claim()` fires this on the very first install.
    env.container.emit('controllerchange');
    expect(env.reloads.count).toBe(0);
  });

  it('reports an install that failed rather than waiting forever for an update', async () => {
    const env = stubEnvironment();
    const errors: unknown[] = [];
    const handle = registerServiceWorker({ onError: (error) => errors.push(error) });
    await handle.check();

    env.deploy('redundant');
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain('install failed');
  });

  it('checks through the registration once it exists', async () => {
    const env = stubEnvironment();
    const handle = registerServiceWorker();

    // No await between register() and check(): the registration promise has
    // not settled yet, which is exactly when the app regains focus.
    await handle.check();
    expect(env.reg.update).toHaveBeenCalledTimes(1);
  });

  it('reports a registration that was refused', async () => {
    stubEnvironment({ failRegister: true });
    const errors: unknown[] = [];
    const handle = registerServiceWorker({ onError: (error) => errors.push(error) });

    await handle.check();
    expect(errors).toHaveLength(1);
  });

  it('drops its listeners on dispose', async () => {
    const env = stubEnvironment();
    const offered: Array<() => void> = [];
    const handle = registerServiceWorker({ onUpdateReady: (apply) => offered.push(apply) });
    await handle.check();

    handle.dispose();
    env.deploy();
    env.container.emit('controllerchange');

    expect(offered).toEqual([]);
    expect(env.reloads.count).toBe(0);
  });

  it('is inert where service workers are not available', async () => {
    vi.stubGlobal('self', { isSecureContext: true });
    vi.stubGlobal('navigator', {});
    const handle = registerServiceWorker();

    await expect(handle.check()).resolves.toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
  });
});
