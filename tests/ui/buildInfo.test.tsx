// @vitest-environment jsdom
/**
 * Can a user tell us which build they are on, and can that answer be wrong?
 *
 * The app printed no version and no build id anywhere, which in a PWA is worse
 * than it sounds: this one installs a service worker, keeps a bundle in Cache
 * Storage until the user accepts an update, and can sit on a home screen for
 * months without touching the network. "It does not do that on mine" is not a
 * conversation anyone can have when neither side can name the bytes.
 *
 * The trap is the fix rather than the bug. A version string that can disagree
 * with the bundle it is printed in turns a report nobody can act on into one
 * acted on wrongly, so nothing here is typed by hand: the version is read out
 * of `package.json` at compile time and the build id out of `GITHUB_SHA` -
 * which is the same variable `.github/workflows/deploy.yml` stamps over
 * `__BUILD__` in `dist/sw.js`. Two readings of one value.
 *
 * These tests hold both halves: that the numbers reach the screen, and that the
 * one pipeline that produces them is still the only one.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { APP_VERSION, BUILD_ID, shortBuildId } from '../../src/buildInfo.ts';
import { useApp } from '../../src/store/state.ts';
import { About } from '../../src/ui/settings/About.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
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
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, dataset, index, characters: [], activeId: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';

async function renderAbout(): Promise<void> {
  await act(async () => {
    root.render(<About />);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('what the About screen says about this build', () => {
  it('prints the version from package.json, not a literal somebody typed', async () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    expect(
      APP_VERSION,
      'the compiled version is not the one package.json declares, so the two can drift',
    ).toBe(pkg.version);

    await renderAbout();
    expect(text(), 'the About screen carries no app version').toContain(`v${pkg.version}`);
  });

  it('prints a build id, and the same one the deploy stamps into the worker', async () => {
    // The invariant, stated so it holds in both places this runs: locally there
    // is no GITHUB_SHA and exactly one build, so `dev` is the honest answer -
    // an invented hash would be the failure this whole seam exists to avoid.
    expect(BUILD_ID).toBe(process.env['GITHUB_SHA'] ?? 'dev');
    expect(BUILD_ID.length).toBeGreaterThan(0);

    await renderAbout();
    expect(text(), 'the About screen carries no build id').toContain(
      `build ${shortBuildId()}`,
    );
  });

  it('keeps the full commit reachable even though it prints seven characters', async () => {
    await renderAbout();
    const line = [...container.querySelectorAll('code')].find((el) =>
      (el.textContent ?? '').includes('build '),
    );
    expect(line, 'there is no build line on the About screen').toBeDefined();
    expect(
      line!.getAttribute('title'),
      'the shortened id is all there is, and seven characters is a convention rather than a guarantee',
    ).toBe(`build ${BUILD_ID}`);
  });

  it('prints the SRD revision beside it, since that is the other thing a report needs', async () => {
    await renderAbout();
    expect(text()).toContain(`SRD ${dataset.revision}`);
  });
});

describe('where those two numbers come from', () => {
  const viteConfig = read('vite.config.ts');
  const buildInfo = read('src/buildInfo.ts');
  const deploy = read('.github/workflows/deploy.yml');
  const sw = read('public/sw.js');

  it('reads the version out of package.json at build time', () => {
    expect(
      viteConfig,
      'vite.config.ts no longer derives the version from package.json, so a second ' +
        'source of truth has appeared',
    ).toMatch(/__APP_VERSION__:\s*JSON\.stringify\(pkg\.version\)/);
    expect(viteConfig).toMatch(/package\.json/);
  });

  it('takes the build id from the same variable the worker is stamped with', () => {
    // The whole point. `sw.js` carries a `__BUILD__` placeholder, the deploy
    // seds GITHUB_SHA over it, and the bundle is compiled with the same
    // variable - so the worker and the About screen cannot name different
    // builds. Anything that introduces a second source here breaks that.
    expect(viteConfig).toMatch(/__BUILD_ID__:\s*JSON\.stringify\(buildId\)/);
    expect(viteConfig).toMatch(/process\.env\.GITHUB_SHA/);
    expect(sw, 'the worker no longer carries the placeholder the deploy stamps').toMatch(
      /__BUILD__/,
    );
    expect(deploy).toMatch(/sed -i "s\|__BUILD__\|\$\{GITHUB_SHA\}\|" dist\/sw\.js/);
  });

  it('makes the deploy prove the id reached the bundle, rather than trusting the config', () => {
    // `define` is a textual substitution: a `buildInfo.ts` that stopped being
    // imported, or an env that never reached `vite build`, would leave the
    // About screen quietly saying `dev` in production with nothing failing.
    expect(
      deploy,
      'nothing checks that the built bundle carries the build id, so the About screen ' +
        'can report a different build from the one it is running in',
    ).toMatch(/grep -rqF "\$\{GITHUB_SHA\}" dist\/assets/);
  });

  it('does not fabricate an id when there is no deploy to take one from', () => {
    expect(viteConfig).toMatch(/process\.env\.GITHUB_SHA \?\? 'dev'/);
    expect(buildInfo).toMatch(/declare const __BUILD_ID__/);
  });
});
