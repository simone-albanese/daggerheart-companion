/**
 * The desktop-only gate (Architecture 1.4).
 *
 * Worth its own test because it is the one part of the importer whose failure
 * is silent in the direction that matters: a phone let through does not show an
 * error, it rasterises a 397-page book until the tab is killed. So the checks
 * are asserted individually rather than through one happy path, and every
 * refusal is asserted to name the art pack, which is the only thing a phone
 * owner can actually do about it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importCapability } from '../../src/import/index.ts';

class FakeOffscreenCanvas {
  convertToBlob(): Promise<Blob> {
    return Promise.resolve(new Blob());
  }
}

/** A capable desktop: worker, offscreen canvas, a mouse, enough memory. */
function desktop(over: {
  worker?: unknown;
  canvas?: unknown;
  mobile?: boolean;
  coarse?: boolean;
  fine?: boolean;
  memory?: number;
} = {}): void {
  vi.stubGlobal('Worker', 'worker' in over ? over.worker : class {});
  vi.stubGlobal('OffscreenCanvas', 'canvas' in over ? over.canvas : FakeOffscreenCanvas);
  vi.stubGlobal('navigator', {
    userAgentData: { mobile: over.mobile ?? false },
    deviceMemory: over.memory ?? 8,
  });
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('any-pointer')
      ? { matches: over.fine ?? true }
      : { matches: over.coarse ?? false },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('importCapability', () => {
  it('allows a desktop with everything it needs', () => {
    desktop();
    expect(importCapability()).toEqual({ supported: true, reason: '' });
  });

  it('refuses a device that says it is mobile', () => {
    desktop({ mobile: true });
    const found = importCapability();
    expect(found.supported).toBe(false);
    expect(found.reason).toMatch(/\.dhart art pack/);
  });

  it('refuses a touch-only device even when it reports no user-agent hint', () => {
    desktop({ mobile: undefined, coarse: true, fine: false });
    expect(importCapability().supported).toBe(false);
  });

  it('allows a touchscreen laptop, which has a finger and a trackpad', () => {
    desktop({ coarse: true, fine: true });
    expect(importCapability().supported).toBe(true);
  });

  it('refuses a device with less memory than the render needs', () => {
    desktop({ memory: 2 });
    expect(importCapability().supported).toBe(false);
    // 4 GB is the bar, not a range: the check must not read 4 as "small".
    desktop({ memory: 4 });
    expect(importCapability().supported).toBe(true);
  });

  it('refuses a browser with no worker or no offscreen canvas', () => {
    desktop({ worker: undefined });
    expect(importCapability().supported).toBe(false);

    desktop({ canvas: undefined });
    expect(importCapability().supported).toBe(false);
  });

  it('refuses a browser whose offscreen canvas cannot encode at all', () => {
    // Older Safari: the class exists, `convertToBlob` does not. Without this
    // the import runs for a minute and dies on the first crop.
    desktop({ canvas: class {} });
    const found = importCapability();
    expect(found.supported).toBe(false);
    expect(found.reason).toMatch(/art pack/);
  });

  it('always says what to do instead, never just no', () => {
    for (const broken of [{ mobile: true }, { memory: 1 }, { canvas: class {} }]) {
      desktop(broken);
      expect(importCapability().reason).toMatch(/art pack/);
    }
  });
});
