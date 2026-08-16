/**
 * The defect class this project keeps shipping: code that exists, typechecks,
 * has passing tests, and is never reached.
 *
 * Four of them have now reached users. The service worker was never
 * registered, so the entire offline story shipped switched off behind eight
 * green tests. The wake lock was never taken, behind a setting that defaults to
 * on and promises the screen will stay lit. Four navigation icons were never
 * painted. Character creation discarded both Experiences two lines below a
 * screen that promised it would keep them.
 *
 * Every unit test passed the whole time, because every unit worked. What none
 * of them could see is that nothing called them.
 *
 * `tests/pwa/wiring.test.ts` already contained the general form of the check
 * and pointed it at exactly one file, `src/pwa/register.ts`. Pointed at the
 * whole tree it names 43 symbols on the first run - which is not a
 * catastrophe, it is an inventory: most of them are a feature this repo has
 * decided to build before wiring, and BACKLOG.md tracks each one. So the
 * allowlist below is not a suppression list. It is that inventory, in the
 * source, with the item that will delete each line written beside it, and the
 * second test here fails if an entry outlives its reason.
 *
 * That is the property worth having. Wire `takeRest` to a screen and this file
 * fails until somebody deletes the line that said it was not wired - so the
 * inventory cannot rot into a list of names nobody has read since 2026.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { declarations, orphanExports, references, stripComments } from './reachability.ts';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) ? [path] : [];
  });
}

const tree = (): Map<string, string> => {
  const modules = new Map<string, string>();
  for (const path of sourceFiles(SRC)) {
    modules.set(relative(SRC, path).split(sep).join('/'), readFileSync(path, 'utf8'));
  }
  return modules;
};

/**
 * Shipped switched off, on purpose, with the reason and the way out.
 *
 * One line each. If the reason names a backlog item, wiring that item deletes
 * the line; if it does not, the line is a decision this project has made out
 * loud rather than by omission.
 */
const DELIBERATE: Record<string, string> = {
  // --- Features built before they were wired. Each is a backlog item, and
  //     wiring it deletes the line.
  'transfer/codec.ts::resolvePlaceholders': 'P1-6: the repair Transfer.tsx already promises on screen.',
  'transfer/codec.ts::characterRefs': 'P1-6: reached only by missingSlugs, which is itself unwired.',
  'transfer/codec.ts::missingSlugs': 'P1-6: the "will this fit in a QR" pre-flight nothing runs.',
  'engine/encounter.ts::TIER_BENCHMARKS': 'P1-5: a GM feature with no screen. Wire it or say so.',
  'engine/loadout.ts::reorderLoadout': 'P1-5: nothing can reorder a loadout; there is no control.',

  // --- Consumed outside the shipped bundle. Not dead, just not the app's.
  'store/state.ts::flushPending':
    'Awaited by the store tests. Inside the app `flush` is reached by the debounce, by pagehide and by remove(); runBackup reads the store rather than the disk, so it needs no flush of its own.',
  'engine/dice.ts::seededRng': 'Injected by tests and tools/simulate.ts; the app must use the real RNG.',
  'transfer/registry.ts::bandFor': 'tools/buildRegistry.ts builds registry.json; the app only reads it.',
  'transfer/registry.ts::REGISTRY_VERSION': 'Written by tools/buildRegistry.ts, checked by createRegistry on load.',
  'import/pdfRuns.ts::pageText': 'A probe for the parser tests; the importer reads positioned runs.',
  'transfer/codec.ts::isDeflated': 'Diagnostics: it tells a test which branch the encoder took.',
  'transfer/qr.ts::qrModulesForVersion': 'Arithmetic the QR tests assert against directly.',
  'transfer/frames.ts::MAX_PAYLOAD_BYTES': 'The derived ceiling; the offer-a-file threshold is FILE_PREFERRED_ABOVE.',

  // --- Two implementations, and the app takes the other one. Worth knowing:
  //     the tests here are exercising a path the app does not take.
  'transfer/frames.ts::FrameCollector': 'The QR screen reassembles through createAccumulator instead.',
  'transfer/frames.ts::toFrameBytes': 'Same: the send path packs frames itself.',
  'transfer/fileIo.ts::parseCharacterFile': 'Every UI path calls parseTransferFile, which handles both shapes.',
  'transfer/fileIo.ts::parseBackupFile': 'Same.',

  // --- P4 dead weight. Delete or adopt; either is a decision, silence is not.
  'engine/dice.ts::outcomeLabel': 'P4: both roll surfaces build their own verdict text.',
  'engine/dice.ts::outcomeDetail': 'P4: same.',
  'engine/levelUp.ts::levelsInTier': 'P4: no caller.',
  'engine/levelUp.ts::tierFor': 'P4: an alias of tierOf that nothing uses.',
  'store/db.ts::getCharacter': 'P4: the store holds every character in memory already.',
  'transfer/fileIo.ts::exportBackup': 'P4: Settings writes the library through saveTextFile directly.',
  'transfer/fileIo.ts::readFile': 'P4: no caller.',
};

describe('the reachability analysis itself', () => {
  // A check that always answers "everything is fine" is the same defect as the
  // one it hunts, so it is checked against modules whose answer is known.

  // Every fixture ends in an entry module that is bare module-level code, the
  // way `main.tsx` is: something has to be the root or nothing is reachable.

  it('finds a function nothing calls', () => {
    const orphans = orphanExports(
      new Map([
        [
          'a.ts',
          'export function used(): number {\n  return 1;\n}\nexport function dead(): number {\n  return 2;\n}\n',
        ],
        ['main.ts', 'used();\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual(['dead']);
  });

  it('does not accept a mention in a comment as a call', () => {
    const orphans = orphanExports(
      new Map([
        ['a.ts', 'export function dead(): number {\n  return 2;\n}\n'],
        ['main.ts', '// dead() is what we would call here one day\n/** see dead() */\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual(['dead']);
  });

  it('does not accept a longer name that contains this one', () => {
    const orphans = orphanExports(
      new Map([
        ['a.ts', 'export function register(): void {}\n'],
        ['main.ts', 'MUTATED_register();\nregisterSomethingElse();\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual(['register']);
  });

  it('does not accept an import as a use', () => {
    const orphans = orphanExports(
      new Map([
        ['a.ts', 'export function dead(): void {}\n'],
        ['main.ts', "import { dead } from './a.ts';\n"],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual(['dead']);
  });

  it('counts a React component rendered as JSX', () => {
    const orphans = orphanExports(
      new Map([
        ['a.tsx', 'export function Panel(): null {\n  return null;\n}\n'],
        ['b.tsx', 'export function Screen(): unknown {\n  return <Panel />;\n}\n'],
        ['main.tsx', 'render(<Screen />);\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual([]);
  });

  it('counts module-level code, which is where a listener is registered', () => {
    const orphans = orphanExports(
      new Map([
        ['a.ts', 'export function flush(): void {}\n'],
        ['main.ts', "import { flush } from './a.ts';\nwindow.addEventListener('pagehide', flush);\n"],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual([]);
  });

  it('sees through a namespace import, which is how the store reaches the database', () => {
    const orphans = orphanExports(
      new Map([
        ['db.ts', 'export async function putCharacter(): Promise<void> {}\n'],
        [
          'state.ts',
          "import * as db from './db.ts';\nexport function save(): void {\n  void db.putCharacter();\n}\n",
        ],
        ['main.ts', 'save();\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual([]);
  });

  it('finds a dead cluster hiding inside a module that is otherwise alive', () => {
    // The shape a per-module check would miss, and the shape the backup
    // module's own restore path had until it was deleted: a helper with a
    // caller, whose caller has none, in a file whose other exports are used
    // every day.
    const orphans = orphanExports(
      new Map([
        [
          'backup.ts',
          'export function alive(): number {\n  return 1;\n}\n' +
            'export function helper(): number {\n  return 2;\n}\n' +
            'export function unreachable(): number {\n  return helper();\n}\n',
        ],
        ['main.ts', 'alive();\n'],
      ]),
    );
    expect(orphans.map((o) => o.name).sort()).toEqual(['helper', 'unreachable']);
  });

  it('does not report a type, which has nothing to switch on', () => {
    const orphans = orphanExports(
      new Map([
        ['a.ts', 'export interface Shape {\n  x: number;\n}\nexport type Alias = Shape;\n'],
        ['main.ts', 'boot();\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual([]);
  });

  it('lets a value reached only through a type declaration count as reached', () => {
    // `export type BandedCollection = (typeof BANDED_COLLECTIONS)[number]` is
    // the real case: a constant whose only consumer is a type has no call site
    // by construction, and reporting it would teach the reader to ignore this.
    const orphans = orphanExports(
      new Map([
        [
          'a.ts',
          "export const BANDS = ['x'] as const;\nexport type Band = (typeof BANDS)[number];\n",
        ],
        ['main.ts', 'const b: Band = "x";\n'],
      ]),
    );
    expect(orphans.map((o) => o.name)).toEqual([]);
  });

  it('splits declarations the way the tree is actually written', () => {
    const { decls, loose } = declarations(
      'x.ts',
      'const top = 1;\nexport const arrow = (): number => {\n  return top;\n};\n' +
        'export async function later(): Promise<void> {}\nqueueMicrotask(later);\n',
    );
    expect(decls.map((d) => d.name)).toEqual(['top', 'arrow', 'later']);
    expect(decls[1]!.exported).toBe(true);
    expect(decls[0]!.exported).toBe(false);
    // Trailing module-level code belongs to the declaration above it here,
    // which costs nothing: it is still inside the module and still a call.
    expect(references(decls[2]!.body, 'later')).toBe(true);
    expect(loose).toBe('');
  });
});

describe('every exported symbol in src has a path to it', () => {
  const orphans = orphanExports(tree());
  const key = (o: { file: string; name: string }): string => `${o.file}::${o.name}`;

  it('walks the whole tree, not one file', () => {
    // The predecessor of this test was `join(SRC, 'pwa/register.ts')` and
    // nothing else. If this number collapses, the walk has broken rather than
    // the tree having become clean.
    expect(tree().size).toBeGreaterThan(80);
  });

  it('reports nothing that is not a declared, deliberate seam', () => {
    const unexplained = orphans.map(key).filter((k) => !(k in DELIBERATE));
    expect(
      unexplained,
      'these are exported, and nothing in src reaches them:\n' +
        unexplained.map((k) => `  ${k}`).join('\n') +
        '\n\nAn exported symbol with no caller is a feature that ships switched off, and ' +
        'every unit test it has will keep passing while it does. Wire it, delete it, or add ' +
        'it to DELIBERATE with the reason and the item that will remove it.',
    ).toEqual([]);
  });

  it('carries no allowlist entry that has outlived its reason', () => {
    const live = new Set(orphans.map(key));
    const stale = Object.keys(DELIBERATE).filter((k) => !live.has(k));
    expect(
      stale,
      'these are listed as deliberately unwired and are now reachable:\n' +
        stale.map((k) => `  ${k} - ${DELIBERATE[k]}`).join('\n') +
        '\n\nDelete the line. An inventory of what ships switched off is only worth having ' +
        'while every line in it is still true.',
    ).toEqual([]);
  });

  it('names a real symbol in every allowlist entry', () => {
    const modules = tree();
    const missing = Object.keys(DELIBERATE).filter((k) => {
      const [file, name] = k.split('::');
      const source = modules.get(file!);
      if (source === undefined) return true;
      return !declarations(file!, stripComments(source)).decls.some((d) => d.name === name);
    });
    expect(missing, `allowlist entries pointing at nothing: ${missing.join(', ')}`).toEqual([]);
  });
});
