/**
 * The stylesheets, checked.
 *
 * CSS is the one part of this app that neither `tsc` nor any other test looks
 * at, and it fails quietly: a stray `}` does not throw, it makes the browser
 * discard the rule that follows. That is not hypothetical - it happened here.
 * An edit left an orphaned block and one unbalanced brace, the `.chip` rule
 * after it was swallowed, and every chip in the app silently inherited 16px
 * Archivo instead of the chip's own small mono (9.5px at the time; 10-11px
 * in rem now). Nothing failed. It just looked wrong, and only on screen.
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
      '.t-read',
      '.t-hint',
      '.t-card',
      '.t-vital',
    ]) {
      expect(all, `${rule} is gone`).toMatch(new RegExp(`^\\s*\\${rule}[\\s,{]`, 'm'));
    }
  });

  it('keeps the chip a mono label rather than body text, sized by the pointer token', () => {
    const base = readFileSync(join(DIR, 'base.css'), 'utf8');
    const chip = /^\.chip\s*\{([^}]*)\}/m.exec(strip(base))?.[1] ?? '';
    expect(chip, 'the chip lost its font').toMatch(
      /font:\s*\d+\s+var\(--chip-size\)\s*\/\s*1\s+var\(--mono\)/,
    );
    // 10px on a fine-pointer desktop and 11 wherever any pointer is coarse:
    // a chip is glanced in the thumb arc, so the 44px target is the ergonomic
    // term and the word only has to be legible at arm's length.
    const tokens = readFileSync(join(DIR, 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--chip-size:\s*0\.625rem/);
    expect(tokens).toMatch(/@media[^{]*any-pointer:\s*coarse[\s\S]*?--chip-size:\s*0\.6875rem/);
    // And a chip that carries a name - an Experience, a tag, a weapon - reads
    // at 12px, because a name is read rather than recognised.
    expect(base).toMatch(/^\.chip-name\s*\{[^}]*font-size:\s*0\.75rem/m);
  });

  /*
   * The readability ramp, pinned as floors rather than as numbers.
   *
   * Measured before the ramp on the audit rig: 85.9% of visible characters
   * under 12px and 71% of all characters in the 11.5px `.t-dense` role. The
   * person this is for wears reading glasses and holds the phone at 35-45 cm,
   * so the floors are: nothing that is read is under 13px, nothing that is
   * prose is under 15px, and every text role is in rem so the OS text-size
   * setting reaches it. Glanced numbers (`.t-num`, `.t-roll`, the counter)
   * stay px on purpose - their cells are measured in px.
   */
  it('declares every text role in rem, with prose at 15px or more and hints at 13', () => {
    const tokens = readFileSync(join(DIR, 'tokens.css'), 'utf8');
    const base = readFileSync(join(DIR, 'base.css'), 'utf8');
    const css = strip(tokens);
    const role = (name: string): string => new RegExp(`^\\.${name}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? '';
    const rem = (value: string | undefined): number => Number(value ?? '0') * 16;

    // The rem hook: 100%, so the browser's own text size is the root.
    expect(strip(base)).toMatch(/^html\s*\{[^}]*font-size:\s*100%/m);

    // Reading text: 16px/1.5 on a phone, 15px/1.5 from 720 - and both in rem.
    expect(tokens).toMatch(/--read-size:\s*1rem/);
    expect(tokens).toMatch(/--read-lh:\s*1\.5\b/);
    expect(tokens).toMatch(/@media[^{]*min-width:\s*720px[\s\S]*?--read-size:\s*0\.9375rem/);
    expect(role('t-read')).toMatch(/font:\s*400\s+var\(--read-size\)\s*\/\s*var\(--read-lh\)\s+var\(--sans\)/);
    expect(role('t-read')).toContain('color: var(--text-2)');
    expect(role('t-read')).toMatch(/hyphens:\s*auto/);
    expect(role('t-read')).toMatch(/text-wrap:\s*pretty/);

    // Long prose: 17px/1.55 on a phone, 16px/1.5 from 720, capped at 62ch.
    expect(tokens).toMatch(/--body-size:\s*1\.0625rem/);
    expect(tokens).toMatch(/@media[^{]*min-width:\s*720px[\s\S]*?--body-size:\s*1rem/);
    expect(role('t-body')).toMatch(/font:\s*400\s+var\(--body-size\)\s*\/\s*var\(--body-lh\)/);
    expect(role('t-body')).toMatch(/max-width:\s*62ch/);
    expect(role('t-body')).toMatch(/hyphens:\s*auto/);
    // Higher ink on dark, lower on light. (The dark value lives in the roles'
    // own `:root` block at the foot of the file, not in the palette block
    // `DARK` parses, so it is read from the text.)
    expect(tokens).toMatch(/--body-ink:\s*var\(--text-2\)/);
    expect(LIGHT_CHOSEN['--body-ink']).toBe('var(--text-3)');

    // Hints: 13px, the bottom of the prose ramp.
    const hint = /font:\s*400\s+([\d.]+)rem\s*\/\s*1\.4/.exec(role('t-hint'));
    expect(hint, '.t-hint is not a rem size').not.toBeNull();
    expect(rem(hint?.[1])).toBeGreaterThanOrEqual(13);

    // Meta and labels: 12px meta on a phone or under a finger, 11 on a desk;
    // 11px labels at 600 and caps everywhere. Both wrap, so neither is at 1.
    expect(tokens).toMatch(/--meta-size:\s*0\.6875rem/);
    expect(tokens).toMatch(/@media[^{]*(max-width:\s*719px|any-pointer:\s*coarse)[\s\S]*?--meta-size:\s*0\.75rem/);
    expect(role('t-meta')).toMatch(/font:\s*500\s+var\(--meta-size\)\s*\/\s*1\.25/);
    const label = /font:\s*600\s+([\d.]+)rem\s*\/\s*1\.2/.exec(role('t-label'));
    expect(label, '.t-label is not a rem size').not.toBeNull();
    expect(rem(label?.[1])).toBe(11);

    // Controls: 14px.
    // The rule with the font in it, not the shared transition list that also
    // ends in `.btn {`.
    const btn = /^\.btn\s*\{([^}]*font:[^}]*)\}/m.exec(strip(base))?.[1] ?? '';
    expect(btn).toMatch(/font:\s*600\s+0\.875rem\s*\/\s*1/);

    // And the glance size is gone: nothing reads at 11.5px any more.
    expect(css).not.toMatch(/^\s*\.t-dense\b/m);
    expect(css).not.toMatch(/11\.5px/);
  });

  it('lets the shell grid be narrower than its widest child, in both halves', () => {
    /*
     * Two declarations, and neither is any use without the other.
     *
     * `.app` declared rows and no columns, so it had one implicit `auto`
     * column, and an `auto` track's base size is the largest min-content
     * contribution of its items with nothing clamping it to the container. One
     * over-wide header therefore laid `main` out wider than the window on every
     * screen at once - measured in Chrome at 771.5px inside a 744px viewport,
     * and 846 inside 720 at the header's 220px name cap - and `.app`'s own
     * `overflow: hidden` then cut the excess with nothing able to scroll it
     * back. `minmax(0, 1fr)` is the clamp. `min-width: 0` on the children is
     * the other half: a grid item keeps `min-width: auto`, whose content-based
     * minimum overflows the clamped track anyway and is cut just the same.
     *
     * jsdom computes no layout, so this asserts the two declarations and not
     * their effect; the effect is the Chrome harness's half, and it is 45
     * clipped elements at 744 and 67 at 720 going to zero.
     */
    const css = strip(readFileSync(join(DIR, 'base.css'), 'utf8'));

    const app = /^\.app\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(app, 'the shell grid is missing').not.toBe('');
    expect(app, 'the shell grid column is sized to its widest child again').toMatch(
      /grid-template-columns:\s*minmax\(\s*0\s*,\s*1fr\s*\)/,
    );

    const children = /^\.app\s*>\s*\*\s*\{([^}]*)\}/m.exec(css)?.[1] ?? '';
    expect(children, 'the shell grid items are back on min-width: auto').toMatch(/min-width:\s*0/);
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

// ---------------------------------------------------------------------------
// The palettes
// ---------------------------------------------------------------------------

const tokensCss = readFileSync(join(DIR, 'tokens.css'), 'utf8');

/**
 * The custom properties declared in one block.
 *
 * None of the three palette blocks contains a nested rule, so the first `}`
 * really is the end of it - checked by the brace test above, which is what
 * makes this parse safe to rely on.
 */
/*
 * Comments only. `strip` above also blanks quoted strings so that a brace
 * inside one cannot be miscounted, which is right for balancing and wrong
 * here: it turns `[data-theme='light']` into `[data-theme='']` and every
 * selector below stops matching.
 */
const withoutComments = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');

const block = (selector: string): Record<string, string> => {
  const at = withoutComments.indexOf(selector);
  expect(at, `${selector} is not in tokens.css`).toBeGreaterThanOrEqual(0);
  const body = withoutComments.slice(at + selector.length);
  const end = body.indexOf('}');
  const out: Record<string, string> = {};
  for (const [, name, value] of body.slice(0, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[name!] = value!.trim();
  }
  return out;
};

const DARK = block(':root {');
const LIGHT_CHOSEN = block(":root[data-theme='light'] {");
const LIGHT_SYSTEM = block(":root[data-theme='system'] {");

describe('the two light palettes', () => {
  /*
   * There are two of them and both are live: `App.tsx` writes `prefs.theme`
   * onto the root, and 'system' is a legal value, so a user who never touched
   * the theme setting is served by the media block while a user who chose
   * Light is served by the attribute block. They are the same 23 declarations
   * written out twice, and a media query cannot be folded into a selector
   * list, so they stay duplicated until this project is willing to require
   * `light-dark()` - which is newer than anything else this tree uses, and not
   * worth a browser floor for a colour refactor.
   *
   * What that leaves is the real hazard: an edit to one and not the other,
   * which nobody would see, because seeing it means having the theme set the
   * other way. So they are pinned to each other.
   */
  it('declare exactly the same tokens', () => {
    expect(Object.keys(LIGHT_SYSTEM).sort()).toEqual(Object.keys(LIGHT_CHOSEN).sort());
  });

  it('declare exactly the same values', () => {
    expect(LIGHT_SYSTEM).toEqual(LIGHT_CHOSEN);
  });

  it('override every colour the dark palette sets', () => {
    // A colour left out of the light blocks silently keeps its dark value,
    // which is how a dark-only token ends up unreadable on paper-white.
    const colours = Object.entries(DARK)
      .filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v))
      .map(([k]) => k);
    expect(colours.length).toBeGreaterThan(10);
    for (const name of colours) {
      expect(LIGHT_CHOSEN, `${name} has no light value`).toHaveProperty(name);
    }
  });
});

// WCAG relative luminance, straight from the spec.
const luminance = (hex: string): number => {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('contrast, computed from the tokens themselves', () => {
  /*
   * Six pairs were below AA when this was measured, and `--dim` alone carries
   * 44 of the 61 small-caps labels in the app - the 10px word naming every
   * control on a screen used in a dim room. Numbers in a table go stale the
   * moment somebody nudges a hex value, so this computes them instead.
   *
   * The floors are the ones WCAG actually sets, and the distinction matters:
   * 4.5 is for text, 3.0 is for a boundary or a shape that carries meaning.
   * An unmarked pip is the second kind - it is not read, it is counted.
   */
  const SURFACES = ['--app', '--panel', '--raised'] as const;

  const palettes: Array<[string, Record<string, string>]> = [
    ['dark', DARK],
    ['light', LIGHT_CHOSEN],
  ];

  it.each(palettes)('%s: every text token clears 4.5:1 on every surface', (_name, palette) => {
    const failures: string[] = [];
    for (const token of ['--text', '--text-2', '--text-3', '--muted', '--dim']) {
      for (const surface of SURFACES) {
        const ratio = contrast(palette[token]!, palette[surface]!);
        if (ratio < 4.5) failures.push(`${token} on ${surface} = ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(palettes)('%s: the boundary token clears 3:1 on every surface', (_name, palette) => {
    const failures: string[] = [];
    for (const surface of SURFACES) {
      const ratio = contrast(palette['--edge']!, palette[surface]!);
      if (ratio < 3) failures.push(`--edge on ${surface} = ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });

  it.each(palettes)('%s: a marked pip is 3:1 against the panel it sits on', (_name, palette) => {
    // These are shapes, not text: the question is whether you can see how many
    // are filled from across a table, not whether you can read them.
    const failures: string[] = [];
    for (const token of ['--damage', '--stress', '--hope', '--armor']) {
      const ratio = contrast(palette[token]!, palette['--panel']!);
      if (ratio < 3) failures.push(`${token} on --panel = ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });

  /*
   * Domain colour used as text. The washes and marks keep the hue; the head
   * wordmark, the reader's meta line and the LV chip take the `-ink` variant,
   * which is the same colour wherever that already clears AA and a lifted one
   * where it does not - Midnight (4.40:1) and Dread (2.29:1) on the dark panel.
   */
  it.each(palettes)('%s: every domain ink clears 4.5:1 on the panel and on the chip ground', (_name, palette) => {
    const resolve = (value: string): string => {
      const ref = /^var\((--[\w-]+)\)$/.exec(value);
      return ref ? palette[ref[1]!]! : value;
    };
    const failures: string[] = [];
    for (const domain of ['arcana', 'blade', 'bone', 'codex', 'grace', 'midnight', 'sage', 'splendor', 'valor', 'dread']) {
      const ink = palette[`--${domain}-ink`];
      expect(ink, `--${domain}-ink is not declared`).toBeDefined();
      for (const surface of ['--panel', '--raised'] as const) {
        const ratio = contrast(resolve(ink!), palette[surface]!);
        if (ratio < 4.5) failures.push(`--${domain}-ink on ${surface} = ${ratio.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('light: the semantic inks a chip draws clear 4.5:1 on the chip ground', () => {
    // A chip's ink sits on `--raised`, not on the white panel, and six of
    // these were 3.23:1 to 4.38:1 there before the ramp.
    const failures: string[] = [];
    for (const token of ['--stress', '--codex', '--valor', '--splendor', '--bone', '--sage']) {
      const ratio = contrast(LIGHT_CHOSEN[token]!, LIGHT_CHOSEN['--raised']!);
      if (ratio < 4.5) failures.push(`${token} on --raised = ${ratio.toFixed(2)}`);
    }
    expect(failures).toEqual([]);
  });

  it('light --hope is readable on its own wash, which is where the verdict prints it', () => {
    // The phone's verdict line is --hope over --hope-wash over --panel, and
    // that composite was 3.17:1 - a heading nobody could read in daylight.
    const wash = /--hope-wash:\s*rgb\(([\d\s]+)\/\s*([\d.]+)\)/.exec(
      Object.entries(LIGHT_CHOSEN).map(([k, v]) => `${k}: ${v}`).join('\n'),
    );
    expect(wash, 'the light hope wash is not an rgb() with an alpha').not.toBeNull();
    const [r, g, b] = wash![1]!.trim().split(/\s+/).map(Number);
    const alpha = Number(wash![2]);
    const panel = LIGHT_CHOSEN['--panel']!.replace('#', '');
    const composite =
      '#' +
      [r!, g!, b!]
        .map((channel, i) => {
          const under = Number.parseInt(panel.slice(i * 2, i * 2 + 2), 16);
          return Math.round(channel * alpha + under * (1 - alpha))
            .toString(16)
            .padStart(2, '0');
        })
        .join('');
    expect(contrast(LIGHT_CHOSEN['--hope']!, composite)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the pip tokens', () => {
  it('size for any coarse pointer, not just the primary one', () => {
    // An iPad in a keyboard case reports `pointer: fine` and still has a
    // finger attached to it.
    expect(tokensCss).toMatch(/@media[^{]*any-pointer:\s*coarse[\s\S]*?--pip-h:\s*var\(--tap\)/);
  });

  /*
   * INVERTED ON 2026-08-26, AND THE OLD ASSERTION IS QUOTED RATHER THAN
   * DELETED.
   *
   * This used to be `does not drag --control along with them`, and it forbade
   * exactly what the line below now requires. Its ground was real when written:
   * "`--control` gates every chip in the app including the ones inside the
   * desktop cockpit's roll panel, which clips its own overflow - so widening
   * --control to `any-pointer` would crush that panel from the inside." That
   * panel scrolls now, so the ground went; the guard did not, and for a whole
   * wave it was pinning a reason that had expired.
   *
   * It is quoted because that is the failure worth remembering. A guard states
   * a reason at the moment it is written and never again, so a guard whose
   * reason has expired reads exactly like a live one - and this one was
   * cross-referenced from `tokens.css`, which is what made it look checked.
   *
   * What replaces it is not nothing. The honest test for "a thumb may land
   * here" is whether the machine has *a* coarse pointer at all, and both
   * tokens now answer that question - so the thing to hold is that they answer
   * it *together*. A future change that narrows one of them back to `pointer`
   * puts an iPad in a keyboard case, or any touchscreen laptop, back under this
   * project's own 44px floor on eleven controls, the four screen tabs among
   * them. `DECISIONI-2026-08-25.md` section 12 is where the owner took it.
   */
  it('take --control with them, because the same finger reaches both', () => {
    const anyPointerBlocks = tokensCss.match(/@media[^{]*any-pointer:\s*coarse[^{]*\{[\s\S]*?\n\}/g) ?? [];
    expect(anyPointerBlocks.length).toBeGreaterThan(0);
    expect(
      anyPointerBlocks.some((rule) => /--control:\s*var\(--tap\)/.test(rule)),
      '`--control` no longer sizes for any coarse pointer. A touchscreen laptop reports ' +
        '`pointer: fine` with a finger on the glass, and this is the query that catches it - ' +
        'narrowing it back to `pointer` puts every chip in the app 10px under the 44px floor ' +
        'on those machines.',
    ).toBe(true);
    expect(
      /@media[^{]*[^-]pointer:\s*coarse[\s\S]{0,60}?--control:/.test(tokensCss),
      '`--control` is sized by a bare `pointer: coarse` query again, which is the narrower ' +
        'question the owner overturned on 2026-08-26.',
    ).toBe(false);
  });

  it('never lets a pip go below the WCAG target floor', () => {
    expect(tokensCss).toMatch(/--pip-min:\s*24px/);
  });

  /*
   * `--counter-num` is the third token in this family and it answers a third
   * question: not "is a finger involved" but "how wide is the grid track this
   * number is drawn in". It is here because the trap is the same one - a token
   * that gets dragged into a query it does not belong in - and because the
   * whole reason the size is a token at all is that `Counter` sets its font
   * inline, which no stylesheet rule can override.
   */
  it('steps the whole counter cell by width, twice, and never by pointer', () => {
    expect(tokensCss, '--counter-num is not defined at all').toMatch(/--counter-num:\s*18px/);
    const rootBlock = /:root\s*\{[\s\S]*?\n\}/.exec(tokensCss)?.[0] ?? '';
    expect(rootBlock, 'the base size is not on :root, so a width nobody anticipated gets nothing').
      toMatch(/--counter-num:\s*18px/);
    /*
     * AND THE OTHER TWO TERMS OF THE CELL ARE ON :root WITH IT, WHICH IS THE
     * REFLOW'S ADDITION. `--counter-cell` is the cell's height and the
     * stepper's, `--counter-max` is the size of the `/ 11` beside the value,
     * and all three are one measurement: 26 needs 4px more cell to sit in and
     * the maximum is half of what the value says. A base that is not the small
     * size would hand a width nobody anticipated the size that clips.
     */
    expect(rootBlock, 'the counter cell height is not a token at all').toMatch(
      /--counter-cell:\s*56px/,
    );
    expect(rootBlock, 'the counter maximum is not a token at all').toMatch(
      /--counter-max:\s*10px/,
    );

    const widthSteps = tokensCss.match(/@media[^{]*min-width:[^{]*\{[\s\S]*?\n\}/g) ?? [];
    const raising = widthSteps.filter((rule) => /--counter-num:/.test(rule));
    expect(
      raising.length,
      'the counter number is stepped by some number of width queries other than three. ' +
        'Three is the whole design: 18 below 380, 22 at 380, 38 at 390 where the card gives ' +
        'the maximum its own line and width stops being the ceiling, and 26 again at 1180 ' +
        'where the cockpit keeps its own compact cell.',
    ).toBe(3);
    expect(raising[0]).toMatch(/min-width:\s*380px/);
    expect(raising[0]).toMatch(/--counter-num:\s*22px/);
    expect(raising[1]).toMatch(/min-width:\s*390px/);
    expect(raising[1]).toMatch(/--counter-num:\s*38px/);
    expect(raising[2]).toMatch(/min-width:\s*1180px/);
    expect(raising[2]).toMatch(/--counter-num:\s*26px/);
    /*
     * The three raises are in ONE query and it is the same one, because the
     * number and the box that holds it are a single decision. Split them and
     * the card draws its seven terms with the narrow padding and gap around the
     * wide number: 3 + 13 + 2 + 38 + 2 + 10 + 3 is 71 of content, 73 with the
     * border, inside a 56px cell - seventeen pixels of overflow on each of the
     * four counters. Splitting them is how that ships. (`a 26px number
     * in a 44px cell`, `an 11px maximum` and `68.94 of ink into 65.5 of room`
     * stood here. They are the two-line ROW, which only the cockpit draws now,
     * and `--counter-max` never reaches 11 on a phone - the assertion twelve
     * lines below is that it does not step at all.)
     */
    expect(
      raising[1],
      'the cell height stopped stepping with the number it exists to hold',
    ).toMatch(/--counter-cell:\s*90px/);
    /*
     * And the padding and the gap step with it, because the cell's height is
     * the sum of all seven terms: 7 + 13 + 6 + 38 + 6 + 10 + 7 = 87 inside 88
     * of inner. A number that stepped without them would overflow its own cell.
     * (`7 + 11 + ... = 85` stood here, and in `tokens.css` and `Counter.tsx`
     * until this pass: the first line is the 13px silhouette and not the 11px
     * name inside it, and 85 is a sum no card has ever drawn.)
     */
    expect(raising[1], 'the card padding stopped stepping with the number').toMatch(
      /--counter-pad:\s*7px/,
    );
    expect(raising[1], 'the gap between the card lines stopped stepping').toMatch(
      /--counter-gap:\s*6px/,
    );
    /*
     * `--counter-max` deliberately does NOT step. It rode beside the value at
     * 11 and it sits under it now, subordinate to a 38px number, where
     * `.t-meta`'s 10 is the right size - and taking it out of the step is what
     * freed the width that let the number go from 26 to 38.
     */
    expect(
      raising[1],
      'the maximum started stepping again. On its own line it is subordinate to the number, ' +
        'and it was its old place beside the value that capped the number at 26.',
    ).not.toMatch(/--counter-max:/);

    /*
     * And not in either pointer query. A mouse-only 1280px desktop draws this
     * number in a 198px cell and wants the large size exactly as much as a
     * phone does; a coarse pointer on a 320px phone wants the small one. Size
     * is not the question those queries answer.
     */
    const pointerBlocks = tokensCss.match(/@media[^{]*pointer:\s*coarse[^{]*\{[\s\S]*?\n\}/g) ?? [];
    expect(pointerBlocks.length).toBeGreaterThan(0);
    for (const rule of pointerBlocks) {
      expect(rule).not.toMatch(/--counter-num:/);
      expect(rule).not.toMatch(/--counter-cell:/);
      expect(rule).not.toMatch(/--counter-max:/);
    }
  });

  /**
   * AND NOTHING OVERRULES IT. The two assertions above prove the token adapts
   * and that `--control` does not follow it. Neither proves that anything
   * *reads* it, and for the whole life of the token nothing did: `Track`
   * defaults `rowHeight` to `var(--pip-h)`, and every caller passed a literal
   * straight past that default.
   *
   * What that cost, measured in Chrome. The desktop cockpit passed `phone ? 44
   * : 32` and drew 29 targets 32px tall - HP 32x32 x11, Stress 40.2x32 x9,
   * Hope 56.8x32 x4, Armor 25.6x32 x5 - at 1180x820, 1280x800, 1440x900 and
   * 1440x695. The party board passed `phone ? 44 : 34` off a `layout ===
   * 'phone'` test that is only true below 720px, so the entire 720-1179 band
   * drew 34px pips with no pointer condition anywhere in the decision: measured
   * at 820x1180 with an ordinary mouse and no touch emulation, `--pip-h` had
   * already resolved to 44px and every pip was 34. The live scene passed
   * `phone ? 44 : 38`, the companion `phone ? 46 : 40`.
   *
   * This is a source-text assertion for the reason `backupSeam.test.ts` gives
   * about its own: the defect is not in what the component does, it is in what
   * its callers hand it. A jsdom mount cannot catch it either way - it computes
   * no layout and resolves none of these media queries - so the only place this
   * can fail is here.
   *
   * The prop stays on `Track`. A future surface with a real reason can take it
   * and take this failure with it, which makes it a decision rather than a
   * habit.
   */
  it('is what every caller reads, rather than a number each caller decides', () => {
    const stripJs = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(dir, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [join(dir, entry.name)]
            : [],
      );

    const offenders: string[] = [];
    for (const path of walk('src')) {
      // Where the prop is declared and defaulted is not a call site.
      if (path.endsWith('ui/shared/Track.tsx')) continue;
      for (const hit of stripJs(readFileSync(path, 'utf8')).matchAll(/rowHeight=\{([^}]*)\}/g)) {
        const value = (hit[1] ?? '').trim();
        if (!value.includes('--pip-h')) offenders.push(`${path}: rowHeight={${value}}`);
      }
    }

    expect(
      offenders,
      'a caller is deciding how tall a pip is with a number:\n' +
        offenders.map((o) => `  ${o}`).join('\n') +
        '\n\nDelete the prop and let `Track` read `--pip-h`. An inline height beats the ' +
        'token, so a machine whose token has already resolved to 44 draws whatever the ' +
        'caller guessed - which is how the party board drew 34px pips on a plain mouse ' +
        'tablet at 820x1180 and the desktop cockpit drew 32px ones.',
    ).toEqual([]);
  });
});

describe('form controls on a touch screen', () => {
  /**
   * iOS Safari zooms the page when a focused control's text is under 16px, and
   * it does not zoom back out. Reported from a phone: typing a damage number
   * magnified the sheet mid-scene. Ten controls in this app set a smaller size
   * inline, so the floor has to be able to beat an inline `font:` shorthand.
   *
   * The alternative fix - `maximum-scale=1` on the viewport meta - would take
   * pinch-zoom away from everyone permanently to correct a text size we
   * control, so the test also refuses that.
   */
  const base = readFileSync(join(DIR, 'base.css'), 'utf8');
  const html = readFileSync('index.html', 'utf8');

  it('floors form-control text at 16px wherever any pointer is coarse', () => {
    // `any-pointer`, not `pointer`: an iPad in a keyboard case reports a fine
    // primary pointer and still zooms when a finger focuses a field.
    const rule = /@media\s*\(any-pointer:\s*coarse\)\s*\{[\s\S]*?font-size:\s*max\(16px[^;]*\)\s*!important/;
    expect(base).toMatch(rule);
    expect(base).not.toMatch(/@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?font-size:\s*max\(16px/);
  });

  it('does not buy that by disabling pinch-zoom', () => {
    const viewport = /<meta[^>]*name="viewport"[^>]*content="([^"]*)"/s.exec(html)?.[1] ?? '';
    expect(viewport, 'no viewport meta found').not.toBe('');
    expect(viewport).not.toMatch(/maximum-scale/);
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
  });
});
