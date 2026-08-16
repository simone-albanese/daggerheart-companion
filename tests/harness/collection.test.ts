/**
 * Does the runner actually run the tests that are on disk?
 *
 * `vitest.config.ts` included `tests/**\/*.test.ts` and no `.tsx` pattern. No
 * `.test.tsx` file existed, so nothing was being skipped - but the first real
 * component test in this repo wants to be `tests/ui/screens.test.tsx`, and that
 * file would have been collected by nothing, reported by nothing, and exited
 * green. A harness that silently ignores a whole extension is worse than no
 * harness: it answers "all tests pass" to a question it never asked.
 *
 * So this file checks the collector rather than any behaviour, and it checks it
 * the general way: every test file present on disk must be matched by some
 * include pattern. Add `tests/engine/foo.test.tsx` tomorrow and it is either
 * collected or this fails.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../../vitest.config.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The subset of glob syntax the include patterns actually use. Hand-rolled
 * rather than pulled from a transitive dependency: the patterns are three lines
 * long and a matcher this test does not own is a matcher this test cannot
 * explain.
 */
function globToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i]!;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        // `**/` crosses directory boundaries, including zero of them.
        if (pattern[i + 2] === '/') {
          out += '(?:[^/]+/)*';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (c === '{') {
      const end = pattern.indexOf('}', i);
      out += `(?:${pattern.slice(i + 1, end).split(',').join('|')})`;
      i = end;
    } else if ('.+^$()[]|\\?'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

const include = ((config as { test?: { include?: string[] } }).test?.include ?? []).map((p) => ({
  pattern: p,
  match: globToRegExp(p),
}));

const collected = (path: string): boolean => include.some((i) => i.match.test(path));

function testFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return testFiles(path);
    return /\.test\.tsx?$/.test(entry) ? [relative(ROOT, path).split(sep).join('/')] : [];
  });
}

describe('the glob matcher this file leans on', () => {
  it('matches what the real patterns mean', () => {
    const m = globToRegExp('tests/**/*.test.{ts,tsx}');
    expect(m.test('tests/ui/screens.test.tsx')).toBe(true);
    expect(m.test('tests/ui/deep/nested/screens.test.ts')).toBe(true);
    expect(m.test('tests/screens.test.ts')).toBe(true);
    expect(m.test('tests/ui/screens.tsx')).toBe(false);
    expect(m.test('src/ui/screens.test.ts')).toBe(false);
  });
});

describe('what the runner collects', () => {
  it('has include patterns to read', () => {
    expect(include.length).toBeGreaterThan(0);
  });

  it('collects .tsx test files, so a component test cannot ship as a file nothing runs', () => {
    expect(
      collected('tests/ui/screens.test.tsx'),
      `none of ${include.map((i) => i.pattern).join(', ')} matches a .test.tsx file, so writing ` +
        'one would add a green file that never executes a single assertion.',
    ).toBe(true);
  });

  it('collects every test file that exists on disk', () => {
    const found = ['tests', 'src', 'shared'].flatMap((d) => testFiles(join(ROOT, d)));
    expect(found.length).toBeGreaterThan(40);

    const ignored = found.filter((path) => !collected(path));
    expect(
      ignored,
      `these test files exist and no include pattern reaches them: ${ignored.join(', ')}`,
    ).toEqual([]);
  });
});
