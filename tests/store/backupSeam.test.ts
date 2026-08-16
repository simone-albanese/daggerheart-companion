/**
 * Which library and which preferences each backup entry point reads.
 *
 * That is a correctness question, not a style one, and both directions of it
 * have already gone wrong.
 *
 * Take the defaults from a screen and `runBackup` stamps `lastBackupAt`
 * straight into localStorage, while `state.setPrefs` merges every later patch
 * onto the store's copy - which never received the stamp - and writes the whole
 * key back. Every `setScreen` calls `setPrefs`, so the manual backup that did
 * run lost its own stamp on the next tab tap, and the phone banner that only
 * appears from five days could never appear at all.
 *
 * Take the *store's* list in `integrityCheck` and the opposite happens: that
 * call can no longer throw, so on the one launch where the database would not
 * open - `init` sets `ready` with an empty library and a rendered banner, not a
 * rejection - the seven-day check would report every character as gone, and
 * then overwrite the only record of what used to be here with nothing.
 *
 * Asserted on source text rather than behaviour, for the reason
 * `tests/pwa/wiring.test.ts` gives: the defect is not in what a function does,
 * it is in which one the app hands it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const read = (path: string): string => stripComments(readFileSync(path, 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Every call to `name(` in `src`, with its argument text, outside comments. */
function callsTo(name: string): Array<{ file: string; args: string }> {
  const found: Array<{ file: string; args: string }> = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join('/');
    // Where these are defined, and the module that defines the deps, are not
    // call sites.
    if (file === 'store/backup.ts' || file === 'store/backupDeps.ts') continue;
    for (const call of read(path).matchAll(new RegExp(String.raw`\b${name}\(([^)]*)\)`, 'g'))) {
      found.push({ file, args: call[1] ?? '' });
    }
  }
  return found;
}

describe('what each backup entry point is allowed to read', () => {
  // Everything that writes a preference, or exports what the user can see.
  for (const name of [
    'runBackup',
    'backupStatus',
    'chooseBackupFolder',
    'forgetBackupFolder',
    'installBackupHooks',
  ]) {
    it(`${name} is never called with the localStorage-only defaults`, () => {
      const sites = callsTo(name);
      expect(
        sites.length,
        `nothing in src calls ${name}, so this guard is guarding nothing`,
      ).toBeGreaterThan(0);
      for (const site of sites) {
        expect(
          site.args,
          `${site.file}: ${name}(${site.args}) takes the defaults, which write straight to localStorage — the next setPrefs then writes the whole key back from a copy that never got the change`,
        ).toMatch(/appBackupDeps/);
      }
    });
  }

  for (const name of ['integrityCheck', 'noteSession']) {
    it(`${name} still reads the disk, because that is the only evidence it has`, () => {
      for (const site of callsTo(name)) {
        expect(
          site.args,
          `${site.file}: ${name}(${site.args}) reads the store, which can never throw — so a launch where the database would not open gets reported as characters having vanished`,
        ).not.toMatch(/appBackupDeps/);
      }
    });
  }
});

describe('the automatic backup is reached at all', () => {
  // `installBackupHooks`, `backupAtSessionEnd`, `noteSession` and
  // `integrityCheck` had no caller anywhere in `src`, and Rollup tree-shook the
  // whole regime out: `page-hide` and `knownCharacterIds` appeared in no file
  // under `dist/assets`. The settings screen said a copy was written at the end
  // of every session the entire time.
  const app = read(join(SRC, 'ui/shell/App.tsx'));

  it('installs the hooks the settings screen says are running', () => {
    expect(app).toMatch(/\binstallBackupHooks\s*\(/);
  });

  it('runs the seven-day check the architecture describes', () => {
    expect(app).toMatch(/\bintegrityCheck\s*\(/);
  });
});
