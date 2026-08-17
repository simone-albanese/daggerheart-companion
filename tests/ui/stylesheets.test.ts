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

  it('does not drag --control along with them', () => {
    /*
     * The trap this token exists to avoid. `--control` gates every chip in the
     * app including the ones inside the desktop cockpit's roll panel, which
     * clips its own overflow - so widening --control to `any-pointer` would
     * crush that panel from the inside, which is the very failure the tablet
     * band already has.
     */
    const anyPointerBlocks = tokensCss.match(/@media[^{]*any-pointer:\s*coarse[^{]*\{[\s\S]*?\n\}/g) ?? [];
    expect(anyPointerBlocks.length).toBeGreaterThan(0);
    for (const rule of anyPointerBlocks) expect(rule).not.toMatch(/--control:/);
  });

  it('never lets a pip go below the WCAG target floor', () => {
    expect(tokensCss).toMatch(/--pip-min:\s*24px/);
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

  it('floors form-control text at 16px where the pointer is coarse', () => {
    const rule = /@media\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?font-size:\s*max\(16px[^;]*\)\s*!important/;
    expect(base).toMatch(rule);
  });

  it('does not buy that by disabling pinch-zoom', () => {
    const viewport = /<meta[^>]*name="viewport"[^>]*content="([^"]*)"/s.exec(html)?.[1] ?? '';
    expect(viewport, 'no viewport meta found').not.toBe('');
    expect(viewport).not.toMatch(/maximum-scale/);
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
  });
});
