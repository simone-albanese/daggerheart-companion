/**
 * The readability ramp's guard over the inline sizes.
 *
 * `tokens.css` declares every text role in rem so the OS text-size setting
 * reaches it, and `stylesheets.test.ts` holds those roles. But 165 `font:`
 * shorthands and 30 `fontSize` literals live in components, where no
 * stylesheet rule can see them, and a px there is a size the setting never
 * reaches. Measured before the ramp on the audit rig: 85.9% of visible
 * characters under 12px and 332 text nodes under 10 across the 48 cases, 81
 * of them distinct by text and path. So the rule this file
 * holds is the one the ramp was built on: nothing in `src/ui` that is READ or
 * a LABEL sets a px size under 14. Glanced numbers and controls whose cells
 * are measured in px stay px on purpose, and each one is on the list below
 * with its reason - "the guard is a list", and a new px site has to argue its
 * way onto it rather than slip past a threshold.
 *
 * Print (`src/ui/print`) is a different medium with its own ramp and is out of
 * this file's scope.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const UI = join(ROOT, 'src', 'ui');

/** Every component file under src/ui, print excepted. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'print' ? [] : walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/**
 * The px sites that stay, and why. Matched on the file and a fragment of the
 * line, so a second px on the same line is a new finding.
 */
const KEPT: ReadonlyArray<{ file: string; line: string; why: string }> = [
  {
    file: 'shared/Counter.tsx',
    line: 'fontSize: 11,',
    why: "the counter's label line: a term of a cell whose height is summed in px in tokens.css",
  },
  {
    file: 'shared/DomainCardView.tsx',
    line: "font: '800 13px/1 var(--sans)'",
    why: 'the recall cost: a glanced number in a footer strip whose height is max(34px, --control)',
  },
];

interface Site {
  file: string;
  line: number;
  text: string;
  px: number;
}

/** A px size under 14 set inline: in a `font:` shorthand or a `fontSize:`. */
function smallPxSites(): Site[] {
  const out: Site[] = [];
  for (const path of walk(UI)) {
    const file = relative(UI, path);
    readFileSync(path, 'utf8')
      .split('\n')
      .forEach((text, i) => {
        // Prose is not a declaration: a docblock quoting `500 10px/1` is history.
        if (/^\s*(\*|\/\/|\/\*)/.test(text)) return;
        const sizes: number[] = [];
        for (const m of text.matchAll(/font:\s*[`'][^'`]*?(?:^|\s|`|')(\d+(?:\.\d+)?)px\s*\//g)) {
          sizes.push(Number(m[1]));
        }
        for (const m of text.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)\b(?!\s*[*+])/g)) {
          sizes.push(Number(m[1]));
        }
        for (const px of sizes) if (px < 14) out.push({ file, line: i + 1, text: text.trim(), px });
      });
  }
  return out;
}

describe('the inline sizes under the readability ramp', () => {
  it('sets no px size under 14 in src/ui except the glanced numbers on the list', () => {
    const found = smallPxSites().filter(
      (s) => !KEPT.some((k) => k.file === s.file && s.text.includes(k.line)),
    );
    expect(
      found.map((s) => `${s.file}:${String(s.line)} ${String(s.px)}px  ${s.text.slice(0, 90)}`),
      'a component sets a px size under 14px inline. A label or a read line goes to rem ' +
        '(13 is 0.8125rem, 12 is 0.75rem, 11 is 0.6875rem, 10 is 0.625rem) so the OS text ' +
        'size reaches it; a glanced number in a px-measured cell goes on KEPT with its reason.',
    ).toEqual([]);
  });

  it('keeps the list honest: every kept site is still there', () => {
    for (const k of KEPT) {
      const src = readFileSync(join(UI, k.file), 'utf8');
      expect(src.includes(k.line), `${k.file} no longer carries \`${k.line}\` - drop it from KEPT`).toBe(true);
    }
  });

  it('sets no rem size under 10px either, which is where the old ramp bottomed out', () => {
    const tiny: string[] = [];
    for (const path of walk(UI)) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((text, i) => {
          if (/^\s*(\*|\/\/|\/\*)/.test(text)) return;
          for (const m of text.matchAll(/(\d*\.?\d+)rem/g)) {
            if (Number(m[1]) * 16 < 10) tiny.push(`${relative(UI, path)}:${String(i + 1)} ${m[0]}`);
          }
        });
    }
    expect(tiny, 'a rem size resolves under 10px at the 16px root').toEqual([]);
  });
});
