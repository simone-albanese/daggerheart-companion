/**
 * Which exported symbols has the shipped app no path to?
 *
 * This is the analysis behind `orphans.test.ts`. It is a separate module for
 * one reason: the analysis itself has to be tested. A reachability check that
 * quietly answers "everything is reachable" is the same failure as the code it
 * is looking for, so `orphans.test.ts` runs it over hand-written modules whose
 * answers are known before it runs it over `src/`.
 *
 * It reads source text rather than a module graph on purpose. The defect class
 * is not in what a function does - every one of these has passing unit tests -
 * it is whether anything calls it. That is a question about call sites, and
 * call sites are what this counts.
 *
 * Two decisions carried over verbatim from `tests/pwa/wiring.test.ts`, both
 * paid for once already:
 *
 *   - comments are stripped first, because a mention is not a call, and half
 *     of these names appear in a docblock explaining what they are for;
 *   - references match on a word boundary, because
 *     `MUTATED_registerServiceWorker(` contains `registerServiceWorker` and an
 *     earlier draft accepted it as a caller.
 *
 * Imports are stripped too, which the original did not need: it only looked for
 * calls, and `import { f } from …` is not one. This looks for bare references
 * as well - a data constant has no call site, and a React component is reached
 * as `<Component />` - so an import line would otherwise count as a use and
 * every symbol in the tree would look alive.
 */

export interface Symbol_ {
  /** Path as given in the input map. */
  file: string;
  name: string;
  exported: boolean;
  /** Types have no runtime existence, so they cannot "ship switched off". */
  type: boolean;
}

/** Comments mention these names too, and a mention is not a call. */
export const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** `import { f } from './x.ts'` names `f` without using it. */
export const stripImports = (source: string): string =>
  source
    .replace(/^\s*import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?$/gm, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?$/gm, '');

const DECL =
  /^(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|enum|type|interface)\s+(\w+)/;

interface Declaration extends Symbol_ {
  body: string;
}

/**
 * Split a module into its top-level declarations plus the code between them.
 *
 * Everything in this tree is prettier-formatted and declared at column zero, so
 * "a declaration starts where an unindented declaration keyword appears and
 * ends where the next one does" is exact here rather than approximate. The
 * loose remainder matters: `state.ts` registers its `pagehide` listener in bare
 * module-level code, and that is a real call site.
 */
export function declarations(file: string, source: string): {
  decls: Declaration[];
  loose: string;
} {
  const decls: Declaration[] = [];
  const loose: string[] = [];
  let current: { name: string; exported: boolean; type: boolean; lines: string[] } | null = null;

  for (const line of source.split('\n')) {
    const match = /^\s/.test(line) ? null : DECL.exec(line);
    if (match !== null) {
      if (current !== null) decls.push({ file, ...current, body: current.lines.join('\n') });
      current = {
        name: match[1]!,
        exported: line.startsWith('export'),
        type: /^(?:export\s+)?(?:type|interface)\s/.test(line),
        lines: [line],
      };
    } else if (current !== null) {
      current.lines.push(line);
    } else {
      loose.push(line);
    }
  }
  if (current !== null) decls.push({ file, ...current, body: current.lines.join('\n') });

  return { decls, loose: loose.join('\n') };
}

/**
 * Does this text reach that name?
 *
 * A word boundary, not a substring: `MUTATED_registerServiceWorker(` is not a
 * call to `registerServiceWorker`, and neither is `myTakeRest`.
 */
export const references = (text: string, name: string): boolean =>
  new RegExp(`\\b${name}\\b`).test(text);

/**
 * Every exported symbol with no path to it from anywhere else in the tree.
 *
 * A symbol is reached when another module names it, or when module-level code
 * in its own file names it, or - transitively - when something already reached
 * names it. That last clause is what stops a live module from hiding a dead
 * cluster inside itself. The case it was written for: `backup.ts` had a
 * `restoreFromText` called only by a `restoreFromPicker` that nothing called,
 * in a module whose other exports are used every day.
 */
export function orphanExports(modules: Map<string, string>): Symbol_[] {
  const parsed = new Map<string, { decls: Declaration[]; loose: string }>();
  for (const [file, source] of modules) {
    parsed.set(file, declarations(file, stripImports(stripComments(source))));
  }

  const id = (file: string, name: string): string => `${file}::${name}`;
  const reached = new Set<string>();
  const queue: Array<[string, string]> = [];

  const mark = (file: string, name: string): void => {
    if (reached.has(id(file, name))) return;
    reached.add(id(file, name));
    queue.push([file, name]);
  };

  for (const [file, { decls, loose }] of parsed) {
    for (const decl of decls) {
      const fromOwnModule = references(loose, decl.name);
      const fromElsewhere = [...parsed].some(
        ([other, mod]) =>
          other !== file &&
          (references(mod.loose, decl.name) || mod.decls.some((d) => references(d.body, decl.name))),
      );
      if (fromOwnModule || fromElsewhere) mark(file, decl.name);
    }
  }

  while (queue.length > 0) {
    const [file, name] = queue.pop()!;
    const decls = parsed.get(file)?.decls ?? [];
    const self = decls.find((d) => d.name === name);
    if (self === undefined) continue;
    for (const decl of decls) {
      if (decl.name !== name && references(self.body, decl.name)) mark(file, decl.name);
    }
  }

  const orphans: Symbol_[] = [];
  for (const [file, { decls }] of parsed) {
    for (const decl of decls) {
      if (!decl.exported || decl.type) continue;
      if (!reached.has(id(file, decl.name))) {
        orphans.push({ file, name: decl.name, exported: true, type: false });
      }
    }
  }
  return orphans.sort((a, b) => `${a.file}${a.name}`.localeCompare(`${b.file}${b.name}`));
}
