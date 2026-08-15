/**
 * The stylesheets, checked.
 *
 * CSS is the one part of this app that neither `tsc` nor any other test looks
 * at, and it fails quietly: a stray `}` does not throw, it makes the browser
 * discard the rule that follows. That is not hypothetical - it happened here.
 * An edit left an orphaned block and one unbalanced brace, the `.chip` rule
 * after it was swallowed, and every chip in the app silently inherited 16px
 * Archivo instead of 9.5px mono. Nothing failed. It just looked wrong, and
 * only on screen.
 *
 * So: balance, and the presence of the rules other files depend on by name.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = 'src/ui';
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.css'))
  .map((f) => join(DIR, f));

/** Strip comments and strings so their braces cannot be miscounted. */
const strip = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");

describe('stylesheets', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s has balanced braces', (file) => {
    const css = strip(readFileSync(file, 'utf8'));
    let depth = 0;
    let line = 1;
    const stray: number[] = [];
    for (const ch of css) {
      if (ch === '\n') line += 1;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth < 0) {
          stray.push(line);
          depth = 0;
        }
      }
    }
    expect(stray, `stray closing brace(s) at line ${stray.join(', ')}`).toEqual([]);
    expect(depth, 'unclosed block').toBe(0);
  });

  it.each(files)('%s never nests a bare rule inside another', (file) => {
    // A selector at depth 1 that is not inside an at-rule is the shape the
    // swallowed-rule bug took: `.chip { ... .chip { ... } }`.
    const css = strip(readFileSync(file, 'utf8'));
    const stack: string[] = [];
    let buffer = '';
    const offenders: string[] = [];
    for (const ch of css) {
      if (ch === '{') {
        const head = buffer.trim().split('\n').pop()?.trim() ?? '';
        if (stack.length > 0 && !stack[stack.length - 1]!.startsWith('@')) offenders.push(head);
        stack.push(head);
        buffer = '';
      } else if (ch === '}') {
        stack.pop();
        buffer = '';
      } else {
        buffer += ch;
      }
    }
    expect(offenders, `nested rule(s): ${offenders.join(' | ')}`).toEqual([]);
  });

  it('still defines the classes the components ask for by name', () => {
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    // Every one of these is referenced from a className somewhere; losing one
    // is invisible until someone looks at the screen.
    for (const rule of [
      '.chip',
      '.btn',
      '.btn-primary',
      '.panel',
      '.scroll',
      '.scroll-fade',
      '.row',
      '.spread',
      '.stack',
      '.t-label',
      '.t-meta',
      '.t-body',
      '.t-dense',
      '.t-card',
      '.t-vital',
    ]) {
      expect(all, `${rule} is gone`).toMatch(new RegExp(`^\\s*\\${rule}[\\s,{]`, 'm'));
    }
  });

  it('keeps the chip a mono label rather than body text', () => {
    const base = readFileSync(join(DIR, 'base.css'), 'utf8');
    const chip = /^\.chip\s*\{([^}]*)\}/m.exec(strip(base))?.[1] ?? '';
    expect(chip, 'the chip lost its font').toMatch(/font:\s*\d+\s+9\.5px\/1\s+var\(--mono\)/);
  });

  it('defines both touch tokens, with --control never above the floor', () => {
    const tokens = readFileSync(join(DIR, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--tap:\s*44px/);
    expect(tokens).toMatch(/--control:\s*\d+px/);
    const desktop = Number(/--control:\s*(\d+)px/.exec(tokens)?.[1] ?? '0');
    expect(desktop).toBeGreaterThan(0);
    expect(desktop).toBeLessThanOrEqual(44);
    // And it must rise to the floor wherever a finger is involved.
    expect(tokens).toMatch(/@media[^{]*pointer:\s*coarse[\s\S]*?--control:\s*var\(--tap\)/);
  });
});
