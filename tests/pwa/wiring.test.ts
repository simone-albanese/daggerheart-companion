/**
 * Is the PWA actually plugged in?
 *
 * `registerServiceWorker` was written, documented, and covered by eight passing
 * tests in `registerServiceWorker.test.ts` - and never called by the app. The
 * whole offline story shipped dead: `public/sw.js` was four hundred lines the
 * browser never read, the CI guard on the `__BUILD__` placeholder guarded a
 * file nobody installed, and the deploy step that stamps the commit into it
 * stamped a worker that no client would ever register. The same was true of
 * `createWakeLock`, while a setting that defaults to ON promised the screen
 * would stay lit at the table.
 *
 * Every unit test passed the entire time, because every unit worked. What none
 * of them could see is that nothing called them. That is the failure mode this
 * file exists for, and the reason it asserts on source text rather than
 * behaviour: the defect is not in what a function does, it is in whether the
 * app reaches it at all.
 *
 * The last test is the general one and the point of the file. It does not name
 * the seams; it derives them, so a seam added next year and forgotten is caught
 * by a test written today.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));
const REGISTER = join(SRC, 'pwa/register.ts');

/** Comments mention these names too, and a mention is not a call. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

const read = (path: string): string => stripComments(readFileSync(path, 'utf8'));

describe('the PWA seams are wired into the app', () => {
  const app = read(join(SRC, 'ui/shell/App.tsx'));

  // `\b` and not a bare substring: `MUTATED_registerServiceWorker(` contains
  // the name and calls something else entirely, and a first draft of this file
  // accepted it.
  it('registers the service worker, without which nothing works offline', () => {
    expect(app).toMatch(/\bregisterServiceWorker\s*\(/);
  });

  it('offers the waiting worker to the user instead of swapping the bundle underneath them', () => {
    // The registration must pass `onUpdateReady`. A registration without it
    // installs updates that then wait forever, unannounced, and the app stays
    // on the old bundle until something else happens to reload it.
    expect(app).toMatch(/onUpdateReady/);
  });

  it('takes the wake lock, because the setting that promises it is on by default', () => {
    const defaults = read(join(SRC, 'store/prefs.ts'));
    expect(defaults).toMatch(/wakeLock:\s*true/);
    expect(app).toMatch(/\bcreateWakeLock\s*\(/);
  });

  it('drives the wake lock from the preference rather than holding it unconditionally', () => {
    expect(app).toMatch(/prefs\.wakeLock/);
  });

  it('every exported seam in pwa/register.ts is called by some screen', () => {
    // Exported *functions* only: the interfaces and type aliases beside them
    // are shapes, and a shape has no call site to look for.
    const exported = [...read(REGISTER).matchAll(/^export function (\w+)/gm)].map((m) => m[1]!);
    expect(exported.length).toBeGreaterThan(0);

    const callers = sourceFiles(SRC)
      .filter((path) => path !== REGISTER)
      .map(read);

    const orphans = exported.filter(
      (name) => !callers.some((source) => new RegExp(`\\b${name}\\s*\\(`).test(source)),
    );

    expect(
      orphans,
      `pwa/register.ts exports these, and no screen ever calls them: ${orphans.join(', ')}. ` +
        'An exported seam with no caller is a feature that ships switched off, and every unit ' +
        'test it has will keep passing while it does.',
    ).toEqual([]);
  });
});
