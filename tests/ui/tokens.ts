/**
 * What a token is worth, read out of `tokens.css` rather than remembered.
 *
 * WHY THIS EXISTS, AND IT IS THE TOUCH FLOOR. Two sweeps in this suite are the
 * only thing standing between the app and a control under 44px: `counters`'s
 * «keeps every target at the touch floor in both directions» and `playSheet`'s
 * «has no target under the touch floor». jsdom measures nothing, so both read
 * the length a component *declares* on its inline style - which works exactly
 * as long as that length is a number. The moment a component declares
 * `var(--counter-cell)` instead of `44px`, `Number.parseFloat` returns NaN,
 * both sweeps score the target 0, and the assertion that a target is at least
 * 44 tall starts failing for the one reason it was never meant to catch.
 *
 * Both files answered that with a hand-written line - `if (value ===
 * 'var(--tap)') return 44` - and that is the shape of the failure this module
 * removes. A map maintained beside the stylesheet drifts from it silently: the
 * day `--control` moves, the map keeps returning the old number and the sweep
 * keeps passing, which is worse than no sweep because it reads like one. So the
 * numbers come from the file, and a token this module cannot resolve is an
 * error rather than a zero.
 *
 * WHAT IT DOES NOT DO. It is not a CSS engine and must not become one. It reads
 * custom properties off `:root`, applies the `@media` blocks that a stated
 * device satisfies, and follows `var()` one token to the next. That is the
 * whole of what `tokens.css` does with the tokens the sweeps care about. An
 * `@media` feature it has not been taught THROWS by name, so the next feature
 * added to that file fails here loudly instead of being quietly ignored - which
 * would resolve a token to its base value and, again, pass a sweep for the
 * wrong reason.
 */
import { readFileSync } from 'node:fs';

/**
 * The two axes `tokens.css` actually branches on.
 *
 * Width and pointer, and no more, because those are the only features its
 * `@media` blocks name. `prefers-color-scheme` is in the file too and is
 * answered as dark - the app is `color-scheme: dark` and declares no length
 * behind that query, so it cannot move a floor.
 */
export interface Device {
  /** Viewport width in CSS px. */
  glass: number;
  /** Whether the primary pointer is coarse - `pointer` and `any-pointer` both. */
  coarse: boolean;
}

/**
 * The owner's phone: an iPhone 16 Pro, in a Safari tab or installed.
 *
 * 393 is above `--counter-num`'s 390 step, so this is the device where the
 * counter cell is 90 and not 56, and it is the width `playSheet`'s sweeps name
 * in their own describe.
 */
export const PHONE: Device = { glass: 393, coarse: true };

/**
 * The narrowest glass this app is drawn on, which is where a floor breaks.
 *
 * 320 is the bottom row of `--counter-num`'s own table and the width
 * `Counter`'s docblock argues its base size against. A target that clears 44
 * here clears it everywhere, so this - not `PHONE` - is the device a floor
 * sweep asks about. `--counter-cell` is 56 here and 90 on the phone, and the
 * floor is neither: the card's steppers declare their own 44, because a height
 * that comes from a stretch is one no sweep can read.
 */
export const NARROW: Device = { glass: 320, coarse: true };

const CSS = readFileSync('src/ui/tokens.css', 'utf8');

/** Comments hold example values and unbalanced braces alike. */
const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The index of the `}` closing the `{` at `open`. */
function matching(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('tokens.css has an unclosed block - see `stylesheets.test`');
}

interface Block {
  /** The `@media` condition guarding it, or null at the top level. */
  cond: string | null;
  decls: string;
}

/** Every `:root` block in source order, each with the query that guards it. */
function rootBlocks(css: string, cond: string | null = null): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    const close = matching(css, open);
    const body = css.slice(open + 1, close);
    if (head.startsWith('@media')) {
      out.push(...rootBlocks(body, head.slice('@media'.length).trim()));
    } else if (head === ':root') {
      out.push({ cond, decls: body });
    }
    i = close + 1;
  }
  return out;
}

/** One `(feature: value)`, against the device. */
function feature(raw: string, device: Device): boolean {
  const m = /\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)/.exec(raw);
  if (m === null) throw new Error(`tokens.ts cannot read the media term \`${raw.trim()}\``);
  // Both groups are inside the alternation-free pattern above, so a match has
  // both. `noUncheckedIndexedAccess` cannot know that.
  const name = m[1]!;
  const value = m[2]!;
  switch (name) {
    case 'min-width':
      return device.glass >= Number.parseFloat(value);
    case 'max-width':
      return device.glass <= Number.parseFloat(value);
    // `pointer` describes the primary pointer and `any-pointer` any of them.
    // Nothing in this suite draws a device with two, so they answer alike.
    case 'pointer':
    case 'any-pointer':
      return value === (device.coarse ? 'coarse' : 'fine');
    case 'prefers-color-scheme':
      return value === 'dark';
    default:
      throw new Error(
        `tokens.ts does not know the media feature \`${name}\`. It was added to tokens.css ` +
          'without being taught here, and every token behind it is resolving to its base ' +
          'value - which is how a touch-floor sweep passes for the wrong reason.',
      );
  }
}

/** A comma is OR and `and` is AND, which is the whole of the grammar in use. */
const matches = (cond: string, device: Device): boolean =>
  cond.split(',').some((term) => term.split(/\band\b/).every((f) => feature(f, device)));

const cache = new Map<string, Map<string, string>>();

/** Every custom property on `:root`, as the device resolves it. */
export function tokens(device: Device): Map<string, string> {
  const key = `${String(device.glass)}/${String(device.coarse)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const out = new Map<string, string>();
  for (const block of rootBlocks(strip(CSS))) {
    if (block.cond !== null && !matches(block.cond, device)) continue;
    for (const m of block.decls.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out.set(m[1]!, m[2]!.trim());
    }
  }
  cache.set(key, out);
  return out;
}

function chase(value: string, table: Map<string, string>, depth: number): number {
  if (depth > 8) throw new Error(`\`${value}\` chases var() through more than eight tokens`);
  const v = value.trim();
  if (v === '') return 0;
  const m = /^var\(\s*(--[\w-]+)\s*\)$/.exec(v);
  if (m !== null) {
    const named = m[1]!;
    const seen = table.get(named);
    if (seen === undefined) {
      throw new Error(
        `\`${named}\` is declared nowhere on :root in tokens.css, so nothing can say how big ` +
          'the target using it is. A sweep that scored it 0 or skipped it would be lying.',
      );
    }
    return chase(seen, table, depth + 1);
  }
  /*
   * `rem`, at the browser's default root. The readability ramp declares every
   * text role in rem so the OS text-size setting reaches it, and `html` is
   * `font-size: 100%` in `base.css` - so at the default setting 1rem is 16px,
   * and that is the one root this suite measures at. A sweep that needs a
   * larger root is a Chrome question, not a jsdom one.
   */
  const rem = /^(\d+(?:\.\d+)?)rem$/.exec(v);
  if (rem !== null) return Number.parseFloat(rem[1]!) * 16;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A length an inline style declares, in px, as `device` resolves it.
 *
 * Anything that is not a number and not a bare `var()` - `calc()`, `env()`, a
 * keyword, the empty string - is 0, which is what both sweeps already assumed
 * and is safe for them: 0 fails a floor and passes a ceiling.
 */
export const px = (declared: string, device: Device): number =>
  chase(declared, tokens(device), 0);
