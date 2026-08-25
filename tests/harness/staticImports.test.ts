/**
 * What does a screen drag in before anybody asks it to?
 *
 * `tests/harness/orphans.test.ts` asks whether the app reaches a symbol at all.
 * This asks the opposite question about a module: which modules does a screen
 * pull in *statically*, and therefore into the same chunk, and therefore down
 * the wire the moment that screen is opened.
 *
 * The defect this exists for is a whole class and it has exactly one symptom in
 * the source: an `import … from` at the top of a file, which is indistinguish-
 * able from a cheap one. `PartyBoard.tsx` carried
 * `import { createQrScanner } from '../../transfer/qr.ts'`, which is jsQR plus
 * `qrcode-generator` plus the frame and payload codecs behind them - see
 * `PartyScanner.tsx` for the measured size, which is written down once because
 * a number in two files is a number that disagrees with itself - as a static
 * dependency of the GM screen, for a camera
 * that is behind a deliberate tap and that most GMs never open.
 *
 * ## Why this reads source and not `dist/`
 *
 * Because the built bundle was already fine, and that is the trap. Rollup gave
 * `qr` a chunk of its own anyway - Settings reaches it through a second path,
 * so it was a shared chunk rather than an inlined one - which meant a reader
 * measuring `dist/assets` concluded the property held. It did not hold; it
 * happened. Delete Settings' path to the scanner tomorrow and the same source
 * inlines 71 KB into `Gm-*.js` with nothing in this suite noticing.
 *
 * A test on `dist/` also cannot run: nothing in this suite builds, and a test
 * that needs `vite build` first is a test that is green because it was skipped.
 * The source is the thing an author changes, so the source is where the
 * property is asserted.
 *
 * ## The analysis is tested before it is believed
 *
 * Same rule `reachability.ts` states for itself: a graph walker that quietly
 * answers "no, that is not in there" for everything is the same failure as the
 * code it is looking for. So there are two positive assertions here - one over
 * a hand-written pair of modules with a known answer, one over the real module
 * that legitimately does import the decoder - and they are the reason the
 * negative ones mean anything.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stripComments } from './reachability.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

/** A path as this file talks about them: `ui/gm/PartyBoard.tsx`, posix, from `src/`. */
type Mod = string;

/**
 * Every specifier this module imports, split by how it imports them.
 *
 * `from '…'` catches `import x from`, `import { x } from`, `export … from` and
 * the multi-line forms of all three, which is what `Transfer.tsx` and half of
 * `transfer/` are written in. `import('…')` is matched first and its specifier
 * removed, so a dynamic import can never be counted as a static one - and a
 * dynamic import has no `from` in it anyway, which is the second reason this
 * split is exact rather than approximate.
 *
 * Comments are stripped before either runs, for the reason every other reader
 * in this directory strips them: the docblock above this very sentence names
 * `transfer/qr.ts`, and a mention is not an import.
 */
export function specifiers(source: string): { static_: string[]; dynamic: string[] } {
  const text = stripComments(source);
  const dynamic: string[] = [];
  const withoutDynamic = text.replace(
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    (_whole, spec: string) => {
      dynamic.push(spec);
      return 'import(0)';
    },
  );

  const static_: string[] = [];
  for (const match of withoutDynamic.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    static_.push(match[1]!);
  }
  // `import './x.css'` names no binding and still pulls the module in.
  for (const match of withoutDynamic.matchAll(/^[ \t]*import\s*['"]([^'"]+)['"]\s*;?[ \t]*$/gm)) {
    static_.push(match[1]!);
  }
  return { static_, dynamic };
}

/**
 * Turn a specifier into a module of this tree, or into null.
 *
 * Null is a package (`react`, `jsqr`) or a path outside `src/` - `@shared`,
 * `@data`, `../../shared/types.ts`. Those are not what this file is about and
 * counting them would mean teaching it every alias in `vite.config.ts` for no
 * question it answers. `@engine` is the one alias that lands inside `src/`, so
 * it is resolved: a path to the QR stack through it would otherwise be a hole.
 */
function resolve(from: Mod, spec: string): Mod | null {
  const path = spec.startsWith('@engine/')
    ? join(SRC, 'engine', spec.slice('@engine/'.length))
    : spec.startsWith('.')
      ? normalize(join(SRC, dirname(from), spec))
      : null;
  if (path === null) return null;
  const rel = relative(SRC, path).split(sep).join('/');
  return rel.startsWith('..') ? null : rel;
}

const source = (mod: Mod): string => readFileSync(join(SRC, mod), 'utf8');

/**
 * Every module in `src/` a chunk rooted at `entry` would have to contain.
 *
 * Static edges only, transitively. A dynamic `import()` is a chunk boundary, so
 * the walk stops there - which is the whole point: this counts what arrives
 * *with* the screen, not what the screen can go and get later.
 */
export function staticGraph(entry: Mod, read: (mod: Mod) => string = source): Set<Mod> {
  const seen = new Set<Mod>([entry]);
  const queue: Mod[] = [entry];
  while (queue.length > 0) {
    const mod = queue.pop()!;
    for (const spec of specifiers(read(mod)).static_) {
      const next = resolve(mod, spec);
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  seen.delete(entry);
  return seen;
}

describe('the walker itself', () => {
  const modules = new Map<Mod, string>([
    [
      'a.tsx',
      `import { cheap } from './b.ts';
       const Heavy = lazy(async () => (await import('./c.ts')).Heavy);
       export const A = () => cheap(Heavy);`,
    ],
    ['b.ts', `export const cheap = (x: unknown): unknown => x;`],
    ['c.ts', `import 'jsqr'; export const Heavy = 1;`],
  ]);
  const read = (mod: Mod): string => modules.get(mod)!;

  it('follows a static import', () => {
    expect([...staticGraph('a.tsx', read)]).toEqual(['b.ts']);
  });

  it('stops at a dynamic one, which is what a chunk boundary is', () => {
    expect(staticGraph('a.tsx', read).has('c.ts')).toBe(false);
  });

  it('does not read a comment as an import', () => {
    const commented = new Map(modules).set(
      'a.tsx',
      `/* This module used to import { x } from './c.ts' and does not. */
       // import { y } from './c.ts';
       import { cheap } from './b.ts';`,
    );
    expect(staticGraph('a.tsx', (mod) => commented.get(mod)!).has('c.ts')).toBe(false);
  });
});

describe('the GM screen does not carry the QR decoder', () => {
  const gm = staticGraph('ui/gm/Gm.tsx');

  /*
   * The non-vacuity control, and it is the reason the two assertions below
   * are worth reading. `PartyScanner.tsx` is the module that legitimately owns
   * the decoder - it is what the lazy boundary points at - so the walker
   * finding `transfer/qr.ts` from there proves it can find it at all.
   *
   * This one passes before and after the split, deliberately.
   */
  it('finds the decoder where the decoder actually lives', () => {
    const scanner = staticGraph('ui/gm/PartyScanner.tsx');
    expect(scanner).toContain('transfer/qr.ts');
    expect(scanner).toContain('transfer/frames.ts');
  });

  it('reaches the party board itself, so the graph is the real one', () => {
    expect(gm).toContain('ui/gm/PartyBoard.tsx');
    expect(gm).toContain('transfer/fileIo.ts');
  });

  it('never pulls jsQR in with the screen', () => {
    expect([...gm].filter((m) => m === 'transfer/qr.ts')).toEqual([]);
  });

  it('nor the frame codec that only the camera needs', () => {
    expect([...gm].filter((m) => m === 'transfer/frames.ts')).toEqual([]);
  });

  /*
   * The entry chunk. This has been true the whole time - `App.tsx` splits Gm
   * and Settings out with `lazy()` and says why - and it is asserted here
   * because it is the property the other three exist to protect, and because
   * an untested claim about the first paint is how the party board's own
   * static import went unnoticed for as long as it did.
   *
   * Control: passes before and after.
   *
   * `transfer/fileIo.ts` and `transfer/pasteboard.ts` *are* in there and are
   * meant to be - the shell's own import doors call them and they carry no
   * decoder. The claim is about the QR stack, so the assertion names it.
   */
  it('and neither does the chunk that draws the first frame', () => {
    const entry = staticGraph('main.tsx');
    expect([...entry].filter((m) => m === 'transfer/qr.ts' || m === 'transfer/frames.ts')).toEqual(
      [],
    );
  });
});

/**
 * The other direction the same edge would go, and the reason `rollAffordance`
 * moved instead of being imported across.
 *
 * The GM's rest control has to ask what the two dice switches leave the table
 * able to do before it rolls 1d4 Fear, and `rollAffordance` is the one place
 * this app answers that. It was declared in `player/DualityRoll.tsx`, which is
 * 3403 lines of roll cockpit; one `import` of it from `src/ui/gm/` would put
 * all of that in the GM screen's chunk for twenty lines of branching. So the
 * helper moved to `ui/shared/rollAffordance.ts`, which both sides reach without
 * either one dragging the other in.
 *
 * The move is a courtesy that one line undoes, which is what this is for. It is
 * the whole directory rather than that one module, because the defect is not
 * "somebody imported the cockpit" - it is that `src/ui/gm/` has never had a
 * reason to reach into `src/ui/player/` and the first one will arrive looking
 * cheap.
 *
 * The non-vacuity control is the block above: the same walker finds
 * `transfer/qr.ts` from `ui/gm/PartyScanner.tsx` and `ui/gm/PartyBoard.tsx`
 * from `ui/gm/Gm.tsx`, so an empty answer here is an answer and not a silence.
 */
describe('the GM screen does not carry the player screen', () => {
  it('reaches no module under `ui/player/`', () => {
    const inside = [...staticGraph('ui/gm/Gm.tsx')].filter((m) => m.startsWith('ui/player/'));
    expect(
      inside,
      'the GM screen now statically imports these player modules:\n' +
        inside.map((m) => `  ${m}`).join('\n') +
        '\n\nIf what was wanted is a helper both sides read, move it to `ui/shared/` the way ' +
        '`rollAffordance` was moved. An import from here pulls the whole player module - and ' +
        'everything it imports - into the chunk that draws the GM screen.',
    ).toEqual([]);
  });
});
