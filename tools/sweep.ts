/**
 * Given a diff, list the places in the tree that talk about what it changed.
 *
 *   npx tsx tools/sweep.ts <base>..<head>            # a range
 *   npx tsx tools/sweep.ts                           # working tree against HEAD
 *   npx tsx tools/sweep.ts <base>..<head> --at <ref> # search the tree AS OF <ref>
 *   npx tsx tools/sweep.ts --json                    # the same result as data
 *
 *   --at <ref>          search that tree instead of the working copy
 *   --max-places <n>    lines the report may print, best first (default 150)
 *   --max-claims <n>    claims the report may print (default 150)
 *   --max-hits <n>      lines printed under one claim (default 8)
 *   --common <n>        a term mentioned in more than this many places in the
 *                       tree's prose is a word, not a pointer: dropped, and
 *                       said out loud (default 6)
 *   --code              also search code, not only prose
 *   --json              the same selection as the report, as data
 *
 * ## What this is for
 *
 * The commonest defect in this repository is prose that a change somewhere else
 * made false. A lane corrects a sentence in the file it is editing and leaves
 * three other files quoting the old one. It was the largest single category of
 * the 48 findings an adversarial reviewer raised against five lanes on the
 * evening of 2026-08-18, and the top entry in the catalogue of the earlier wave
 * that failed six lanes of fourteen. Once, the surviving copy was a sentence
 * *on screen*, telling a user about a bug that no longer existed.
 *
 * Today that is caught at review time, by an expensive reader re-reading the
 * whole tree afterwards. This moves it to the front: before the commit, from
 * the diff alone.
 *
 * ## WHAT THIS TOOL DOES NOT DO, AND CANNOT
 *
 * **It produces candidates. It never judges.** Nothing it prints is a finding.
 * It does not know whether any line it shows you is true, false, stale, or
 * exactly right; it has not read the code, it cannot evaluate a sentence, and
 * it has no model of what your change meant. Every line it prints is one
 * assertion and one only: *this place in the tree mentions something your diff
 * touched, so go and look at it yourself.* The judging is yours and stays
 * yours.
 *
 * That fence is the whole design, not modesty. A tool that says "this sentence
 * is false" will be wrong often enough to be ignored inside a week, and an
 * ignored check is worse than no check, because it looks like coverage. A tool
 * that overclaims would also be the exact defect class this one exists to
 * catch, which would be funny in the worst way.
 *
 * Concretely, it will not find:
 *
 * - prose falsified by something the diff did not mention by name - a sentence
 *   about "the fifth arm" when the diff added a fifth arm without ever writing
 *   the word;
 * - a docblock that contradicts the code *in its own file* with no shared token
 *   to key on - it never reads the code, it matches text;
 * - a test whose name promises more than its body asserts;
 * - anything at all inside the diff's own changed lines: those are excluded on
 *   purpose, because the lane already knows about them. A false sentence you
 *   wrote in this commit is invisible here, and so is every line of a file
 *   this commit creates.
 *
 * ## MEASURED RECALL, AND WHAT IT COST
 *
 * Calibrated against that corpus of 48, replayed on each of the five lane
 * branches: the diff is `<base>..<the lane's last commit before its repairs>`
 * and the tree searched is `--at <base>`. Both halves of that matter. The
 * branch *tips* carry the repair round, which deleted every stale sentence the
 * review named, so a diff against a tip hides the entire corpus; and searching
 * today's tree finds nothing at all and would flatter the tool enormously.
 * `<base>` is the honest tree, and it is exactly the tree a lane is looking at
 * when it starts.
 *
 * **18 of the 48 are out of scope by construction** and are classified out
 * rather than quietly dropped from the denominator: a test that cannot fail
 * (2), a mutation kill count (1), an ergonomics judgement (1), a forbidden-area
 * declaration (1), a test name that promises more than its body asserts (3),
 * and a false sentence the diff itself wrote (8). Two more are out for the
 * uncomfortable reason: their file does not exist in the base tree at all,
 * because the diff creates it. Every line of a new file is a changed line, so
 * this tool is blind to both by the same rule that keeps it from reading a
 * lane its own edit back.
 *
 * That leaves **30 in scope**. At the default caps it surfaces **14 of them:
 * 47%.** Lift the place budget entirely and it is 16 of 30, 53%. Turn
 * `--common` off as well and it is 29 of 30 - which is the useful thing to know
 * about the misses, and the uncomfortable one: they are nearly all *found* and
 * then *suppressed*, not missed. Of the 16 it does not print by default, 13 are
 * lost to `--common 6` (the term is mentioned in more than six places in this
 * tree's prose, so it is treated as a word rather than a pointer), 2 are lost
 * to the 150-place budget, and exactly 1 is never matched at all:
 * `Conditions.tsx:256` says "in a row the four number cells hold open at 64",
 * and the only thing it shares with that diff is the number 64.
 *
 * So the caps are the tool's honesty and also its ceiling. That is a real trade
 * and it is stated here rather than tuned away: a report of 5,000 lines
 * containing 97% of the answer is not a check, it is the tree. If a diff is
 * small, or the stakes are high, `--common 100 --max-places 1500` is the
 * measured trade in the other direction: 23 of 30, 77%, for about ten times
 * the reading.
 *
 * These figures are one corpus of 48, from one evening, on one repository.
 * They are not a guarantee, they do not transfer, and they will drift as the
 * tree does. Treat 47% as "about half": the review that reads the whole tree is
 * still the thing that catches the rest, and this is what it should no longer
 * have to spend its attention on.
 *
 * ## Signal
 *
 * A tool that returns 3000 hits is a tool nobody runs. Three things buy the
 * signal back, and every one of them was ablated against the corpus rather
 * than argued for:
 *
 * 1. **A term that only left the diff.** A number the diff *deleted*, still
 *    written down somewhere else, is the defect itself; a number the diff
 *    merely contains is a coincidence. Removing it: 14 of 30 down to 10.
 * 2. **Rarity.** A term mentioned twice in the tree is a pointer; a term
 *    mentioned forty times is a word. `--common` drops the words and `1/n`
 *    orders the rest. Removing it: 14 down to 13, and 10 down to 5 once the
 *    departure boost is gone too - it is the floor under that boost.
 * 3. **Prose first.** The defect is prose, so comments, string literals and
 *    `.md` are searched and code is not, unless `--code` says otherwise. This
 *    is what makes broad extraction affordable: `localStorage` has hundreds of
 *    mentions in this tree and four of them are sentences.
 *
 * The fourth idea, the persuasive one, was measured and is not here: ranking on
 * how many of the diff's things a line names at once made recall *worse*, 14
 * down to 12. See `placeScore` for why, and for what that number is still used
 * for.
 *
 * The budget is counted in *places* rather than claims, because places are what
 * a person reads, and every suppression prints its own number. A silent cap
 * reads as "covered everything" when it did not, which is the same lie this
 * tool exists to prevent.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// The diff
// ---------------------------------------------------------------------------

export interface ChangedLine {
  /** Path in the head tree for `+`, in the base tree for `-`. */
  readonly path: string;
  /** Line number in whichever tree the line lives in. */
  readonly line: number;
  readonly text: string;
  readonly side: '+' | '-';
}

export interface FileDiff {
  /** Head path; equals `oldPath` unless the file was renamed. */
  readonly path: string;
  readonly oldPath: string;
  readonly changed: ChangedLine[];
}

/**
 * Enough of `git diff` to answer "which lines moved, and where were they".
 * Deliberately tolerant: an unparseable hunk header costs that hunk, not the
 * run.
 */
export function parseUnifiedDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileDiff | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (const raw of text.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
      current = { path: m?.[2] ?? '', oldPath: m?.[1] ?? '', changed: [] };
      files.push(current);
      continue;
    }
    if (current === null) continue;
    if (raw.startsWith('--- ')) {
      const p = raw.slice(4);
      if (p !== '/dev/null') current = { ...current, oldPath: p.replace(/^a\//, '') };
      files[files.length - 1] = current;
      continue;
    }
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4);
      if (p !== '/dev/null') current = { ...current, path: p.replace(/^b\//, '') };
      files[files.length - 1] = current;
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      current.changed.push({ path: current.path, line: newNo, text: raw.slice(1), side: '+' });
      newNo += 1;
      continue;
    }
    if (raw.startsWith('-') && !raw.startsWith('---')) {
      current.changed.push({ path: current.oldPath, line: oldNo, text: raw.slice(1), side: '-' });
      oldNo += 1;
      continue;
    }
    if (raw.startsWith(' ')) {
      oldNo += 1;
      newNo += 1;
    }
  }
  return files.filter((f) => f.changed.length > 0);
}

// ---------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------

export type ProseKind = 'markdown' | 'comment' | 'string';

export interface Span {
  readonly start: number;
  readonly end: number;
  readonly kind: ProseKind;
}

const MARKDOWN = /\.(?:md|markdown|txt)$/i;

/**
 * The prose in one line: comments, string literals, and the whole of a
 * markdown line. A scanner rather than a regex because `//` inside a string is
 * not a comment and `"` inside a comment is not a string, and both shapes are
 * everywhere in this tree.
 *
 * `state.inBlock` carries `/* … *\/` across lines and must be threaded through
 * a file in order. An unterminated quote is treated as ending at the newline:
 * a template literal spanning lines gives up its tail, which costs a few
 * candidates and never invents one.
 */
export function proseSpans(line: string, state: { inBlock: boolean }, path: string): Span[] {
  if (MARKDOWN.test(path)) return line.trim() === '' ? [] : [{ start: 0, end: line.length, kind: 'markdown' }];
  const spans: Span[] = [];
  let i = 0;
  // A line that begins with `*` is a docblock continuation, and this repository
  // writes almost all of its prose that way. Recognising it on its own shape
  // matters because a diff is not contiguous: with `-U0` the `/**` that opened
  // the block is usually not in the hunk, so a stateful scanner alone reads
  // half the argued paragraphs in this tree as code and loses them.
  if (!state.inBlock && /^\s*\*(?!\/)/.test(line)) {
    const star = line.indexOf('*');
    return [{ start: star + 1, end: line.length, kind: 'comment' }];
  }
  if (state.inBlock) {
    const close = line.indexOf('*/');
    if (close < 0) return [{ start: 0, end: line.length, kind: 'comment' }];
    state.inBlock = false;
    spans.push({ start: 0, end: close, kind: 'comment' });
    i = close + 2;
  }
  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '/' && next === '/') {
      spans.push({ start: i + 2, end: line.length, kind: 'comment' });
      return spans;
    }
    if (ch === '/' && next === '*') {
      const close = line.indexOf('*/', i + 2);
      if (close < 0) {
        state.inBlock = true;
        spans.push({ start: i + 2, end: line.length, kind: 'comment' });
        return spans;
      }
      spans.push({ start: i + 2, end: close, kind: 'comment' });
      i = close + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      if (j < line.length) spans.push({ start: i + 1, end: j, kind: 'string' });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return spans;
}

/** The code of a line, with every comment and string literal blanked out. */
export function codeOf(line: string, state: { inBlock: boolean }, path: string): string {
  const spans = proseSpans(line, { ...state }, path);
  let out = line;
  for (const span of spans) {
    out = out.slice(0, span.start) + ' '.repeat(span.end - span.start) + out.slice(span.end);
  }
  return out;
}

/** The prose of a line, joined, with the code between the spans thrown away. */
export function proseOf(line: string, state: { inBlock: boolean }, path: string): string {
  return proseSpans(line, state, path)
    .map((s) => line.slice(s.start, s.end))
    .join(' ');
}

const TOKEN = /--[a-zA-Z][\w-]*|[A-Za-z_$][A-Za-z0-9_$]*|\d+(?:\.\d+)?/g;

export function tokensOf(text: string): string[] {
  return (text.match(TOKEN) ?? []).map((t) => t.toLowerCase());
}

/** Lower-cased, whitespace-collapsed, comment and markdown leaders removed. */
export function normalizeProse(text: string): string {
  return text
    .replace(/[`*_#>|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * The sentences most easily falsified by an *addition* somewhere else, which is
 * why they are almost never in the file being edited. A hit on one of these is
 * worth two of anything else.
 */
const ABSOLUTE =
  /\b(?:exactly (?:one|two|three|four|five|six|seven|eight|nine|ten)|the only|only one|the sole|the one thing|there is no|there are no|nothing (?:in|else|here)|no other|never|always|every one of|all (?:three|four|five|six|seven|eight|nine|ten|of them))\b/i;

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export type ClaimKind =
  | 'measure'
  | 'number'
  | 'number-word'
  | 'counted-noun'
  | 'identifier'
  | 'quoted-symbol'
  | 'custom-property'
  | 'test-name'
  | 'phrase';

export interface Claim {
  readonly kind: ClaimKind;
  /** What is looked for. A token for most kinds, a normalized phrase for `phrase`. */
  readonly term: string;
  /** How to say it in the report. */
  readonly label: string;
  /** `path:line +` - where in the diff it came from. */
  readonly origin: string;
  /**
   * The term appears on the diff's removed lines and on none of its added
   * ones: a value or a wording that *went away*. Prose elsewhere still saying
   * it is the defect this tool exists for, so these rank first. A term the
   * diff both removed and added has not changed and carries much less.
   */
  gone: boolean;
}

/**
 * A tie-breaker, and *only* a tie-breaker.
 *
 * The intuition that a whole phrase found elsewhere beats a bare number was
 * worth testing and did not survive the test: ranked on the corpus, kind
 * weighting made recall worse, because the bare numbers are what the stale
 * paragraphs actually repeat. What ranks is in `placeScore` below - how rare
 * the term is, and how many of the diff's things one line names at once. Kind
 * decides the wording of the label and settles ties, nothing more.
 */
const KIND_WEIGHT: Record<ClaimKind, number> = {
  phrase: 10,
  'counted-noun': 7,
  'quoted-symbol': 6,
  'custom-property': 5,
  'test-name': 5,
  measure: 4,
  identifier: 3,
  number: 2,
  'number-word': 1.5,
};

const NUMBER_WORDS = [
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'dozen',
];
const NUMBER_WORD = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\b\\s+([a-z][a-z-]{2,})`, 'gi');

/**
 * Identifiers this tree writes constantly. Searching for them returns the tree.
 * This is a shortlist on purpose: `--common` is the real filter, and a
 * hand-maintained stopword list is a thing that rots.
 */
const STOP = new Set([
  'const',
  'let',
  'function',
  'return',
  'import',
  'export',
  'from',
  'type',
  'interface',
  'class',
  'this',
  'true',
  'false',
  'null',
  'undefined',
  'string',
  'number',
  'boolean',
  'void',
  'await',
  'async',
  'expect',
  'describe',
  'test',
  'react',
  'props',
  'children',
  'style',
  'width',
  'height',
  'value',
  'label',
  'index',
  'length',
  'error',
  'result',
  'window',
  'document',
  'console',
  'default',
]);

/**
 * A declaration, anchored at the start of its line. Unanchored, `\bclass\s+`
 * and `\btype\s+` fire on ordinary English inside a comment the block-state
 * scanner did not catch - "a type the parser recognises" declares `the`, and
 * `the` then reports the whole tree.
 */
const DECLARATION =
  /^\s*(?:export\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm;
const TEST_NAME = /\b(?:it|test|describe)(?:\.\w+)?\(\s*(['"`])([^'"`]{8,})\1/g;
const CUSTOM_PROP = /--[a-z][a-z0-9-]{2,}/g;
const BACKTICKED = /`([A-Za-z_$][\w$]{3,}(?:\.[A-Za-z_$][\w$]*)?)`/g;
const UNITED = /\b(\d+(?:\.\d+)?)\s*(px|ms|rem|em|vh|vw|pt|%|s)\b/g;
const NUMERIC = /\b(\d{2,}(?:\.\d+)?|\d+\.\d+)\b/g;
const DECIMAL = /\b\d+\.\d+\b/g;
const WORD_ID = /\b([A-Za-z_$][\w$]{3,})\b/g;

/**
 * A window of prose long enough to be somebody else's copy of it.
 *
 * Five words at every offset, not a longer window at a stride. The corpus is
 * why: `Conditions.tsx` says "the four number cells hold open at 64" and the
 * sentence the lane was editing said "the four number cells *already* hold
 * open" - one word apart and half a window out of phase. A seven-word window
 * on a stride of four found neither of them. Five words at stride one finds
 * "four number cells hold open" in both.
 */
const PHRASE_WORDS = 5;
const PHRASES_PER_LINE = 60;

function phrasesOf(prose: string): string[] {
  const words = normalizeProse(prose).split(' ').filter((w) => /[a-z0-9]/.test(w));
  if (words.length < PHRASE_WORDS) return [];
  const out: string[] = [];
  for (let i = 0; i + PHRASE_WORDS <= words.length && out.length < PHRASES_PER_LINE; i += 1) {
    const window = words.slice(i, i + PHRASE_WORDS);
    // All-stopword windows ("of the same thing as") match everywhere and mean
    // nothing. Two substantial words is the cheapest test that works.
    if (window.filter((w) => w.length >= 4).length < 2) continue;
    out.push(window.join(' '));
  }
  return out;
}

/**
 * What a diff is claiming, in the shapes that actually bit: numbers with a unit
 * or a noun beside them, number words, identifiers added or renamed, custom
 * properties, test names, and whole phrases of prose.
 *
 * Both sides of the diff are mined. A sentence you *deleted* may survive
 * verbatim in three other files; a sentence you *added* may already have a twin
 * that says something else.
 */
export function extractClaims(files: readonly FileDiff[]): Claim[] {
  const claims = new Map<string, Claim>();
  const arrived = new Set<string>();
  const departed = new Set<string>();
  let side: '+' | '-' = '+';
  const add = (kind: ClaimKind, term: string, label: string, origin: string): void => {
    if (term.length === 0) return;
    const key = `${kind}\u0000${term}`;
    (side === '-' ? departed : arrived).add(key);
    if (!claims.has(key)) claims.set(key, { kind, term, label, origin, gone: false });
  };

  for (const file of files) {
    // Block-comment state is per file per side, and hunks are not contiguous,
    // so this is an approximation: a `/*` opened outside the hunk is not seen.
    // It costs prose, never invents it.
    const state = { '+': { inBlock: false }, '-': { inBlock: false } };
    for (const change of file.changed) {
      const origin = `${change.path}:${change.line} ${change.side}`;
      side = change.side;
      // `proseOf` advances the block-comment state; the code view must not, so
      // it takes a copy. Order matters here and only here.
      const code = codeOf(change.text, state[change.side], change.path);
      const prose = proseOf(change.text, state[change.side], change.path);
      const raw = change.text;

      for (const m of raw.matchAll(CUSTOM_PROP)) {
        add('custom-property', m[0].toLowerCase(), `custom property \`${m[0]}\``, origin);
      }
      for (const m of code.matchAll(DECLARATION)) {
        const name = m[1] ?? '';
        if (name !== '' && !STOP.has(name.toLowerCase())) {
          add('identifier', name.toLowerCase(), `declaration \`${name}\``, origin);
        }
      }
      for (const m of raw.matchAll(TEST_NAME)) {
        const name = m[2] ?? '';
        for (const phrase of phrasesOf(name)) {
          add('test-name', phrase, `test name "${name.slice(0, 60)}"`, origin);
        }
      }
      for (const m of raw.matchAll(UNITED)) {
        const [, digits, unit] = m;
        if (digits !== undefined) {
          add('measure', digits, `the number ${digits} (written \`${digits}${unit ?? ''}\`)`, origin);
        }
      }
      // A decimal in code is a measurement somebody wrote down: `734.5` is a
      // reach, `62.6` is a step. Whole numbers in code are mostly indices and
      // are left to the prose classes, where they have a noun beside them.
      for (const m of code.matchAll(DECIMAL)) {
        if (m[0] !== undefined) add('measure', m[0], `the measurement ${m[0]}`, origin);
      }

      if (prose === '') continue;

      for (const m of prose.matchAll(BACKTICKED)) {
        const name = m[1] ?? '';
        const head = name.split('.')[0] ?? '';
        if (head !== '' && !STOP.has(head.toLowerCase())) {
          add('quoted-symbol', head.toLowerCase(), `\`${name}\` named in prose`, origin);
        }
      }
      for (const m of prose.matchAll(NUMERIC)) {
        const digits = m[1];
        if (digits !== undefined) add('number', digits, `the number ${digits}`, origin);
      }
      for (const m of prose.matchAll(NUMBER_WORD)) {
        const word = (m[1] ?? '').toLowerCase();
        const noun = (m[2] ?? '').toLowerCase();
        if (word === '') continue;
        add('number-word', word, `the word "${word}"`, origin);
        add('counted-noun', `${word} ${noun}`, `the count "${word} ${noun}"`, origin);
      }
      for (const m of prose.matchAll(WORD_ID)) {
        const name = m[1] ?? '';
        // Only names that look like code. Ordinary English is the phrase
        // class's job, not the identifier class's.
        // Mixed case or an underscore. `THAT` and `WHICH` are shouted English,
        // not identifiers, and this tree shouts a lot.
        const looksLikeCode = /_|\$/.test(name) || (/[a-z]/.test(name) && /[A-Z]/.test(name.slice(1)));
        if (name !== '' && looksLikeCode && !STOP.has(name.toLowerCase())) {
          add('identifier', name.toLowerCase(), `\`${name}\` named in prose`, origin);
        }
      }
      for (const phrase of phrasesOf(prose)) {
        add('phrase', phrase, `phrase "${phrase.slice(0, 70)}"`, origin);
      }
    }
  }
  for (const [key, claim] of claims) claim.gone = departed.has(key) && !arrived.has(key);
  return [...claims.values()];
}

// ---------------------------------------------------------------------------
// The search
// ---------------------------------------------------------------------------

export interface TreeFile {
  readonly path: string;
  readonly text: string;
}

export interface Hit {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly kind: ProseKind | 'code';
  /** The line reads as an exact-count or uniqueness claim. */
  readonly absolute: boolean;
  /**
   * How many distinct things this diff changed are named on this one line.
   * A sentence repeating four of your numbers is a copy of the paragraph you
   * just rewrote; a sentence repeating one of them is a coincidence most of
   * the time. This is the single strongest signal the tool has.
   */
  multiplicity: number;
}

export interface ClaimGroup {
  readonly claim: Claim;
  readonly hits: Hit[];
  readonly score: number;
  /**
   * The term was over `--common`, and only the hits that also name something
   * else this diff changed were kept. Say so: the rest are not covered.
   */
  readonly narrowed: boolean;
}

export interface SweepResult {
  readonly groups: ClaimGroup[];
  /** Terms dropped for having more prose hits than `--common`, with the count. */
  readonly tooCommon: Array<{ readonly label: string; readonly hits: number }>;
  readonly claimsExtracted: number;
  readonly filesSearched: number;
  /** Hits thrown away because they sit on a line this diff changed. */
  readonly selfHits: number;
}

export interface SweepOptions {
  readonly common?: number;
  readonly includeCode?: boolean;
  /** Which side of the diff the searched tree is. See `TreeSide`. */
  readonly side?: TreeSide;
}

const DEFAULTS = { common: 6, includeCode: false, side: 'unknown' as TreeSide };

/**
 * How much is printed. Not `SweepOptions`: `sweep()` computes and returns
 * everything it found, and these two only decide how much of it reaches a
 * screen. The recall figure in the header is measured with these values,
 * because they are what a lane actually reads.
 */
const REPORT_DEFAULTS = { maxClaims: 40, maxHits: 8 };

/**
 * How worth reading one line is. Every term here was ablated against the corpus
 * in this configuration, and the numbers are what the run returned, not what
 * the design expected:
 *
 * - **a term that only left the diff** - a value the diff *deleted*, still
 *   written down elsewhere, is the defect itself, where a value the diff merely
 *   contains is a coincidence. Removing the boost: 14 of 30 down to 10.
 * - **rarity** - a term mentioned twice in the tree is a pointer, a term
 *   mentioned forty times is a word, so `1/mentions`. Worth 1 on its own here
 *   because `--common` has already thrown the words away; worth 5 with the
 *   departure boost also gone, so it is the floor under it rather than a
 *   duplicate of it.
 * - **where the words are** - markdown and comments over string literals over
 *   code, doubled for a line making an exact-count claim, because those are the
 *   sentences an addition falsifies.
 *
 * And one term that is deliberately NOT here. Multiplicity - how many separate
 * things the diff changed one line names at once - is the most persuasive
 * signal in this whole tool and ranking on it made recall *worse*: 14 of 30
 * became 12. A paragraph naming six of your numbers is usually the paragraph
 * you are already rewriting, and it crowds out the single sentence in a file
 * you have not opened, which is the one this exists to find. So multiplicity is
 * measured, printed beside every line, and used to rescue a term `--common`
 * would otherwise drop - and it earns no place in the ordering.
 */
function placeScore(hit: Hit, rarest: number): number {
  const base = hit.kind === 'code' ? 0.5 : hit.kind === 'string' ? 2 : 3;
  return (hit.absolute ? base * 2 : base) * rarest;
}

/** A common term is kept only where the line also names something else. */
const NARROW_AT = 3;

/**
 * How much more a term that only *left* the diff is worth. Measured, not
 * chosen: on the corpus this is the difference between finding the stale copy
 * of a number and finding every file that happens to contain it.
 */
const GONE_BOOST = 20;

/**
 * Which tree is being searched, and therefore which of the diff's two sets of
 * line numbers mean anything in it.
 *
 * This is not a detail. A `+` line number is a position in the head tree and a
 * `-` line number is a position in the base tree, and they are wildly different
 * once a file has grown by two hundred lines. Excluding both sets from one tree
 * blanks out hundreds of untouched lines that happen to sit where the *other*
 * tree's edits landed - which is how the first version of this tool scored 0 on
 * the corpus while finding everything: it found the sentences and then threw
 * them away as its own.
 */
export type TreeSide = 'head' | 'base' | 'unknown';

/**
 * The exclusion that keeps the report about the rest of the tree.
 *
 * A line is excluded when the diff changed that position in that file *on the
 * side being searched*, or when its text is exactly a line the diff added or
 * removed in that same file. The second half is what catches a `-` line still
 * standing in the base tree at a position the hunk headers no longer describe.
 * It can over-exclude - an untouched line whose text is character-identical to
 * a changed one, in the same file, is dropped - and that is the trade this
 * makes knowingly: a candidate lost is cheaper than the lane's own edit read
 * back to it as news.
 */
function exclusions(
  files: readonly FileDiff[],
  side: TreeSide,
): Map<string, { lines: Set<number>; texts: Set<string> }> {
  const map = new Map<string, { lines: Set<number>; texts: Set<string> }>();
  for (const file of files) {
    for (const path of new Set([file.path, file.oldPath])) {
      if (!map.has(path)) map.set(path, { lines: new Set(), texts: new Set() });
    }
    for (const change of file.changed) {
      const counts =
        side === 'unknown' || (side === 'head' ? change.side === '+' : change.side === '-');
      for (const path of [file.path, file.oldPath]) {
        const entry = map.get(path);
        if (entry === undefined) continue;
        if (counts && path === change.path) entry.lines.add(change.line);
        const trimmed = change.text.trim();
        if (trimmed.length >= 4) entry.texts.add(trimmed);
      }
    }
  }
  return map;
}

export function sweep(
  diff: readonly FileDiff[],
  tree: readonly TreeFile[],
  options: SweepOptions = {},
): SweepResult {
  const opts = { ...DEFAULTS, ...options };
  const claims = extractClaims(diff);
  const skip = exclusions(diff, opts.side);

  const byToken = new Map<string, Claim[]>();
  const phrases: Claim[] = [];
  for (const claim of claims) {
    if (claim.kind === 'phrase' || claim.kind === 'test-name' || claim.kind === 'counted-noun') {
      phrases.push(claim);
      continue;
    }
    const list = byToken.get(claim.term);
    if (list === undefined) byToken.set(claim.term, [claim]);
    else list.push(claim);
  }

  // Phrases are anchored on their rarest word, so a phrase costs one `includes`
  // on the few lines that could possibly contain it rather than one per line.
  const frequency = new Map<string, number>();
  for (const file of tree) {
    const state = { inBlock: false };
    for (const raw of file.text.split('\n')) {
      const spans = proseSpans(raw, state, file.path);
      const text = opts.includeCode ? raw : spans.map((s) => raw.slice(s.start, s.end)).join(' ');
      for (const token of new Set(tokensOf(text))) {
        frequency.set(token, (frequency.get(token) ?? 0) + 1);
      }
    }
  }
  const byAnchor = new Map<string, Claim[]>();
  for (const claim of phrases) {
    const words = tokensOf(claim.term).filter((w) => w.length >= 3);
    if (words.length === 0) continue;
    let anchor = words[0] ?? '';
    for (const w of words) if ((frequency.get(w) ?? 0) < (frequency.get(anchor) ?? 0)) anchor = w;
    const list = byAnchor.get(anchor);
    if (list === undefined) byAnchor.set(anchor, [claim]);
    else list.push(claim);
  }

  const found = new Map<Claim, Hit[]>();
  let selfHits = 0;
  const record = (claim: Claim, hit: Hit, excluded: boolean): void => {
    if (excluded) {
      selfHits += 1;
      return;
    }
    const list = found.get(claim);
    if (list === undefined) found.set(claim, [hit]);
    else list.push(hit);
  };

  for (const file of tree) {
    const state = { inBlock: false };
    const skipHere = skip.get(file.path);
    const lines = file.text.split('\n');
    for (let n = 0; n < lines.length; n += 1) {
      const raw = lines[n] ?? '';
      const spans = proseSpans(raw, state, file.path);
      const prose = spans.map((s) => raw.slice(s.start, s.end)).join(' ');
      const searched = opts.includeCode ? raw : prose;
      if (searched.trim() === '') continue;
      const kind: Hit['kind'] =
        prose.trim() === '' ? 'code' : (spans[0]?.kind ?? 'code');
      const hit: Hit = {
        path: file.path,
        line: n + 1,
        text: raw.trim(),
        kind,
        absolute: ABSOLUTE.test(prose),
        multiplicity: 0,
      };
      const excluded =
        skipHere !== undefined &&
        (skipHere.lines.has(n + 1) || skipHere.texts.has(raw.trim()));

      const tokens = new Set(tokensOf(searched));
      for (const token of tokens) {
        for (const claim of byToken.get(token) ?? []) record(claim, hit, excluded);
      }
      const normalized = normalizeProse(searched);
      const already = new Set<string>();
      for (const token of tokens) {
        for (const claim of byAnchor.get(token) ?? []) {
          if (already.has(claim.term)) continue;
          if (normalized.includes(claim.term)) {
            already.add(claim.term);
            record(claim, hit, excluded);
          }
        }
      }
    }
  }

  // One `Hit` object per line is shared by every claim that matched it, so the
  // count of claims per line can be totalled afterwards and read back by all of
  // them. Overlapping phrase windows would inflate it - "four number cells hold
  // open" and "number cells hold open at" are one sentence, not two - so they
  // are counted once per claim kind, by term stem.
  const perLine = new Map<Hit, Set<string>>();
  for (const [claim, hits] of found) {
    for (const hit of hits) {
      const set = perLine.get(hit) ?? new Set<string>();
      set.add(claim.kind === 'phrase' ? 'phrase' : `${claim.kind} ${claim.term}`);
      perLine.set(hit, set);
    }
  }
  for (const [hit, set] of perLine) hit.multiplicity = set.size;

  const surviving: Array<{ claim: Claim; hits: Hit[]; narrowed: boolean }> = [];
  const tooCommon: Array<{ label: string; hits: number }> = [];
  for (const [claim, hits] of found) {
    let kept = hits;
    let narrowed = false;
    if (kept.length > opts.common) {
      // Not simply dropped. `64` is mentioned six hundred times in this tree
      // and a few of those mentions are the paragraph that also repeats four
      // other numbers this diff moved. Keep those, say the term was narrowed,
      // and let the rest go.
      kept = hits.filter((h) => h.multiplicity >= NARROW_AT);
      narrowed = true;
      if (kept.length === 0 || kept.length > opts.common) {
        tooCommon.push({ label: claim.label, hits: hits.length });
        continue;
      }
    }
    surviving.push({ claim, hits: kept, narrowed });
  }

  // Rarity is a property of the surviving term, so it can only be settled once
  // every term's hits are known; a line's score is then the best any of the
  // terms naming it can manage.
  const rarityOf = new Map<Claim, number>();
  for (const { claim, hits } of surviving) {
    rarityOf.set(claim, (claim.gone ? GONE_BOOST : 1) / hits.length);
  }
  const bestFor = new Map<Hit, number>();
  for (const { claim, hits } of surviving) {
    const rarest = rarityOf.get(claim) ?? 0;
    for (const hit of hits) {
      const score = placeScore(hit, rarest);
      if (score > (bestFor.get(hit) ?? 0)) bestFor.set(hit, score);
    }
  }

  const groups: ClaimGroup[] = surviving.map(({ claim, hits, narrowed }) => {
    hits.sort(
      (a, b) =>
        (bestFor.get(b) ?? 0) - (bestFor.get(a) ?? 0) ||
        a.path.localeCompare(b.path) ||
        a.line - b.line,
    );
    const best = hits[0];
    return {
      claim,
      hits,
      narrowed,
      score: best === undefined ? 0 : (bestFor.get(best) ?? 0),
    };
  });
  groups.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_WEIGHT[b.claim.kind] - KIND_WEIGHT[a.claim.kind] ||
      a.claim.term.localeCompare(b.claim.term),
  );
  tooCommon.sort((a, b) => b.hits - a.hits);

  return {
    groups,
    tooCommon,
    claimsExtracted: claims.length,
    filesSearched: tree.length,
    selfHits,
  };
}

// ---------------------------------------------------------------------------
// Reading a tree
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  '.tools',
  'Manuali',
  '.claude',
  '.git',
  'coverage',
]);
const SEARCHABLE = /\.(?:ts|tsx|js|jsx|mjs|cjs|css|md|markdown|txt|html|json|yml|yaml|sh)$/i;
/**
 * Generated or vendored bulk. In this tree exactly one searchable file is over
 * it - `data/srd-1.0.json`, 578 KB of SRD text nobody hand-writes - and the
 * report names every file it skipped for this reason rather than leaving the
 * reader to assume the whole tree was read.
 */
const TOO_BIG = 400_000;

export function searchable(path: string): boolean {
  if (!SEARCHABLE.test(path)) return false;
  return !path.split('/').some((part) => EXCLUDED_DIRS.has(part));
}

export interface TreeRead {
  readonly files: TreeFile[];
  /** Searchable files skipped for being bigger than `TOO_BIG`, counted so the
   * report can say so rather than quietly leaving them out. */
  readonly skipped: string[];
}

function readWorkingTree(root: string): TreeRead {
  const out: TreeFile[] = [];
  const skipped: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue; // a dangling symlink, of which this repo has several by design
      }
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      const path = relative(root, full).split(sep).join('/');
      if (!searchable(path)) continue;
      if (stat.size > TOO_BIG) {
        skipped.push(path);
        continue;
      }
      out.push({ path, text: readFileSync(full, 'utf8') });
    }
  };
  walk(root);
  return { files: out, skipped };
}

function readTreeAt(root: string, ref: string): TreeRead {
  const listing = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', ref], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split('\0')
    .filter((p) => p !== '' && searchable(p));

  const batch = execFileSync('git', ['cat-file', '--batch'], {
    cwd: root,
    input: listing.map((p) => `${ref}:${p}`).join('\n') + '\n',
    maxBuffer: 512 * 1024 * 1024,
  });

  const out: TreeFile[] = [];
  const skipped: string[] = [];
  let at = 0;
  for (const path of listing) {
    const nl = batch.indexOf(0x0a, at);
    if (nl < 0) break;
    const header = batch.toString('utf8', at, nl).split(' ');
    if (header[1] === 'missing') {
      at = nl + 1;
      continue;
    }
    const size = Number(header[2]);
    const start = nl + 1;
    if (size <= TOO_BIG) out.push({ path, text: batch.toString('utf8', start, start + size) });
    else skipped.push(path);
    at = start + size + 1;
  }
  return { files: out, skipped };
}

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

function sameCommit(root: string, a: string, b: string): boolean {
  try {
    const one = execFileSync('git', ['rev-parse', `${a}^{commit}`], { cwd: root }).toString().trim();
    const two = execFileSync('git', ['rev-parse', `${b}^{commit}`], { cwd: root }).toString().trim();
    return one === two;
  } catch {
    return false;
  }
}

export interface Caps {
  /** Distinct lines the report is allowed to print. The reading budget. */
  readonly maxPlaces: number;
  readonly maxClaims: number;
  readonly maxHits: number;
}

export const CAPS: Caps = { maxPlaces: 150, maxClaims: 150, maxHits: 8 };

export interface Selection {
  readonly shown: Array<{ readonly group: ClaimGroup; readonly hits: Hit[] }>;
  readonly placesShown: number;
  readonly placesHidden: number;
  readonly claimsHidden: number;
  /** Claims skipped because every line they name was already printed above. */
  readonly claimsRedundant: number;
}

/**
 * What the report prints, decided once and shared by the text and the JSON so
 * they cannot answer "what did sweep cover" two different ways.
 *
 * The budget is counted in *places*, not claims, because places are what a
 * person reads. Two claims pointing at the same line are one line to go and
 * look at, so the second one prints nothing and is counted as redundant rather
 * than spending the budget twice.
 */
export function selectForReport(result: SweepResult, caps: Caps): Selection {
  const seen = new Set<string>();
  const shown: Array<{ group: ClaimGroup; hits: Hit[] }> = [];
  let redundant = 0;
  let stopped = 0;
  for (const group of result.groups) {
    if (seen.size >= caps.maxPlaces || shown.length >= caps.maxClaims) {
      stopped += 1;
      continue;
    }
    // The budget is spent line by line, so the last claim printed shows only
    // as many lines as are left rather than overrunning by a whole claim.
    const room = Math.min(caps.maxHits, caps.maxPlaces - seen.size);
    const fresh = group.hits.filter((h) => !seen.has(`${h.path}:${h.line}`)).slice(0, room);
    if (fresh.length === 0) {
      redundant += 1;
      continue;
    }
    for (const h of fresh) seen.add(`${h.path}:${h.line}`);
    shown.push({ group, hits: fresh });
  }
  const everywhere = new Set<string>();
  for (const group of result.groups) {
    for (const h of group.hits) everywhere.add(`${h.path}:${h.line}`);
  }
  return {
    shown,
    placesShown: seen.size,
    placesHidden: everywhere.size - seen.size,
    claimsHidden: stopped,
    claimsRedundant: redundant,
  };
}

export function formatReport(
  result: SweepResult,
  where: string,
  caps: Caps,
  skippedForSize: readonly string[] = [],
): string {
  const out: string[] = [];
  const selection = selectForReport(result, caps);
  const everywhere = selection.placesShown + selection.placesHidden;

  out.push(
    `sweep: ${result.claimsExtracted} claims from the diff, ` +
      `${result.groups.length} of them mentioned elsewhere, ` +
      `in ${everywhere} places, searching ${result.filesSearched} files ${where}.`,
  );
  out.push('');
  out.push('CANDIDATES, NOT FINDINGS. Nothing below is claimed to be wrong. Each line');
  out.push('says only: this place mentions something your diff touched. Go and look.');
  out.push('');

  selection.shown.forEach(({ group, hits }, i) => {
    out.push(`${String(i + 1).padStart(3)}. ${group.claim.label}  — from ${group.claim.origin}`);
    if (group.narrowed) {
      out.push(
        '     (a common term, narrowed to the lines that also name something else' +
          ' this diff changed - its other mentions are NOT covered)',
      );
    }
    for (const hit of hits) {
      const mark =
        (hit.absolute ? ' [exact-count claim]' : '') +
        (hit.multiplicity > 1 ? ` [${hit.multiplicity} things from this diff]` : '');
      const text = hit.text.length > 110 ? `${hit.text.slice(0, 107)}...` : hit.text;
      out.push(`     ${hit.path}:${hit.line}${mark}`);
      out.push(`       ${text}`);
    }
    if (group.hits.length > hits.length) {
      out.push(
        `     …and ${group.hits.length - hits.length} more line(s) for this claim, not shown.`,
      );
    }
    out.push('');
  });

  if (selection.placesHidden > 0 || selection.claimsHidden > 0) {
    out.push(
      `${selection.placesHidden} further place(s) and ${selection.claimsHidden} further ` +
        `claim(s) are NOT shown (--max-places ${caps.maxPlaces}, --max-claims ${caps.maxClaims}). ` +
        `THIS REPORT IS NOT COMPLETE.`,
    );
  }
  if (selection.claimsRedundant > 0) {
    out.push(
      `${selection.claimsRedundant} claim(s) pointed only at lines already listed above.`,
    );
  }
  if (result.tooCommon.length > 0) {
    const worst = result.tooCommon.slice(0, 8).map((t) => `${t.label} (${t.hits})`);
    out.push(
      `${result.tooCommon.length} term(s) dropped as too common to be signal (--common): ` +
        `${worst.join(', ')}${result.tooCommon.length > 8 ? ', …' : ''}.`,
    );
  }
  if (skippedForSize.length > 0) {
    out.push(
      `${skippedForSize.length} file(s) were NOT searched, being over the size ceiling: ` +
        `${skippedForSize.join(', ')}.`,
    );
  }
  out.push(`${result.selfHits} hit(s) on lines this diff itself changed were excluded.`);
  if (selection.shown.length === 0) {
    out.push('');
    out.push('Nothing mentioned elsewhere. That is not a clean bill of health: see the');
    out.push('header of tools/sweep.ts for the four things this tool cannot see.');
  }
  return out.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (name: string): boolean => args.includes(name);
  const number = (name: string, fallback: number): number => {
    const raw = flag(name);
    const n = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const root = execFileSync('git', ['rev-parse', '--show-toplevel']).toString('utf8').trim();
  const range = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--at');

  const diffArgs = ['diff', '--no-ext-diff', '--no-color', '-U0'];
  let base: string | undefined;
  if (range !== undefined) {
    const [from, to] = range.split('..');
    if (from === undefined || from === '') {
      console.error(`sweep: "${range}" has no base. Write it as <base>..<head>.`);
      process.exitCode = 1;
      return;
    }
    base = from;
    diffArgs.push(from, to === undefined || to === '' ? 'HEAD' : to);
  } else {
    base = 'HEAD';
    diffArgs.push('HEAD');
  }
  const diffText = execFileSync('git', diffArgs, { cwd: root, maxBuffer: 256 * 1024 * 1024 }).toString(
    'utf8',
  );
  const diff = parseUnifiedDiff(diffText);
  if (diff.length === 0) {
    console.log('sweep: that diff is empty, so there is nothing to sweep for.');
    return;
  }

  const at = flag('--at');
  const { files: tree, skipped } = at === undefined ? readWorkingTree(root) : readTreeAt(root, at);
  // Which tree is this? No `--at` means the working copy, which is the head.
  // `--at` pointing at the diff's own base means the base. Anything else - a
  // third commit - and neither set of line numbers can be trusted, so both are
  // excluded and some candidates are lost. Say which, rather than guess.
  const side: TreeSide =
    at === undefined
      ? 'head'
      : base !== undefined && sameCommit(root, at, base)
        ? 'base'
        : 'unknown';
  const result = sweep(diff, tree, {
    common: number('--common', DEFAULTS.common),
    includeCode: has('--code'),
    side,
  });

  const caps: Caps = {
    maxPlaces: number('--max-places', CAPS.maxPlaces),
    maxClaims: number('--max-claims', CAPS.maxClaims),
    maxHits: number('--max-hits', CAPS.maxHits),
  };

  if (has('--json')) {
    // Deliberately the same caps as the text report. An uncapped `--json`
    // beside a capped report would give two different answers to "what does
    // sweep cover", and the machine-readable one is the one a calibration
    // reads - so it is the one that must not flatter the tool. Raise the caps
    // explicitly to see everything; the suppressed counts are here either way.
    const selection = selectForReport(result, caps);
    console.log(
      JSON.stringify(
        {
          claimsExtracted: result.claimsExtracted,
          filesSearched: result.filesSearched,
          filesSkipped: skipped,
          selfHits: result.selfHits,
          caps,
          placesShown: selection.placesShown,
          placesHidden: selection.placesHidden,
          claimsHidden: selection.claimsHidden,
          claimsRedundant: selection.claimsRedundant,
          tooCommon: result.tooCommon,
          groups: selection.shown.map(({ group: g, hits }) => ({
            kind: g.claim.kind,
            term: g.claim.term,
            label: g.claim.label,
            origin: g.claim.origin,
            score: Number(g.score.toFixed(4)),
            narrowed: g.narrowed,
            hitsHidden: g.hits.length - hits.length,
            hits: hits.map((h) => ({
              path: h.path,
              line: h.line,
              kind: h.kind,
              absolute: h.absolute,
              multiplicity: h.multiplicity,
            })),
          })),
        },
        null,
        1,
      ),
    );
    return;
  }

  console.log(
    formatReport(result, at === undefined ? 'in the working tree' : `as of ${at}`, caps, skipped),
  );
}

// Only when run as a script: the tests import the pieces above.
const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) main();
