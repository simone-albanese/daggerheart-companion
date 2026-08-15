/**
 * The wake lock is the one seam here with real state: a sentinel the browser
 * hands out, takes back on its own whenever the document hides, and never
 * restores. Everything that can go wrong with it goes wrong at a table, hours
 * in, where nobody will report it as anything but "the screen keeps dimming" -
 * or worse, "the battery died".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWakeLock } from '../../src/pwa/register.ts';

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, fn: () => void) => void;
  dispatchRelease: () => void;
}

function stubEnvironment(options: { supported?: boolean; latency?: () => Promise<void> } = {}) {
  const { supported = true, latency } = options;
  const sentinels: FakeSentinel[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const state = { visibility: 'visible' as DocumentVisibilityState };

  const make = (): FakeSentinel => {
    const handlers: Array<() => void> = [];
    const sentinel: FakeSentinel = {
      released: false,
      release: async () => {
        sentinel.released = true;
        sentinel.dispatchRelease();
      },
      addEventListener: (_type, fn) => handlers.push(fn),
      dispatchRelease: () => handlers.splice(0).forEach((fn) => fn()),
    };
    sentinels.push(sentinel);
    return sentinel;
  };

  vi.stubGlobal('navigator', {
    ...(supported ? { wakeLock: { request: async () => (await latency?.(), make()) } } : {}),
  });
  vi.stubGlobal('document', {
    get visibilityState() {
      return state.visibility;
    },
    addEventListener: (type: string, fn: () => void) => {
      const bucket = listeners.get(type) ?? [];
      bucket.push(fn);
      listeners.set(type, bucket);
    },
  });

  return {
    sentinels,
    held: () => sentinels.filter((s) => !s.released),
    hide: () => {
      state.visibility = 'hidden';
      // The browser drops the lock itself, then tells the page.
      sentinels.filter((s) => !s.released).forEach((s) => void s.release());
      listeners.get('visibilitychange')?.forEach((fn) => fn());
    },
    show: () => {
      state.visibility = 'visible';
      listeners.get('visibilitychange')?.forEach((fn) => fn());
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('createWakeLock', () => {
  it('holds exactly one lock however often it is asked', async () => {
    const env = stubEnvironment();
    const lock = createWakeLock();

    await Promise.all([lock.request(), lock.request(), lock.request()]);

    expect(env.sentinels).toHaveLength(1);
    expect(lock.held()).toBe(true);
  });

  it('releases every lock it took, including one requested concurrently', async () => {
    // Two acquisitions overlapping in flight is the ordinary case, not an
    // exotic one: the UI requests on session start and the platform fires a
    // visibilitychange while that request is still unresolved.
    const blocked: Array<() => void> = [];
    const env = stubEnvironment({ latency: () => new Promise<void>((r) => blocked.push(r)) });
    const lock = createWakeLock();

    const first = lock.request();
    const second = lock.request();
    blocked.splice(0).forEach((resume) => resume());
    await Promise.all([first, second]);
    await lock.release();

    expect(env.held(), 'a lock nobody holds a handle to keeps the screen awake forever').toEqual([]);
    expect(lock.held()).toBe(false);
  });

  it('re-takes the lock the browser dropped when the document comes back', async () => {
    const env = stubEnvironment();
    const lock = createWakeLock();
    await lock.request();

    env.hide();
    expect(lock.held()).toBe(false);

    env.show();
    await vi.waitFor(() => expect(lock.held()).toBe(true));
    expect(env.held()).toHaveLength(1);
  });

  it('stays released after release(), across a hide and a show', async () => {
    const env = stubEnvironment();
    const lock = createWakeLock();
    await lock.request();
    await lock.release();

    env.hide();
    env.show();
    await Promise.resolve();

    expect(lock.held()).toBe(false);
    expect(env.held()).toEqual([]);
  });

  it('drops the lock on dispose and does not take another', async () => {
    const env = stubEnvironment();
    const lock = createWakeLock();
    await lock.request();

    lock.dispose();
    await vi.waitFor(() => expect(env.held()).toEqual([]));

    env.hide();
    env.show();
    await Promise.resolve();
    expect(env.held()).toEqual([]);
  });

  it('is inert where the API does not exist', async () => {
    stubEnvironment({ supported: false });
    const lock = createWakeLock();

    await expect(lock.request()).resolves.toBeUndefined();
    expect(lock.held()).toBe(false);
    await expect(lock.release()).resolves.toBeUndefined();
    expect(() => lock.dispose()).not.toThrow();
  });
});
