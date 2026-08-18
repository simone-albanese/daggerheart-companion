/**
 * `tools/sweep.ts` hands a lane a list of places in the tree that mention what
 * its diff changed. This file holds it to what it says it does, and - because
 * the tool's one rule is that it produces candidates and never findings - to
 * what it says it does *not* do.
 *
 * ## Why this is a fixture tree and not the repository
 *
 * The tool was tuned against a corpus of 48 real review findings, replayed on
 * five branches with `--at <base>`, and the recall it achieved there is written
 * in its own header. That measurement is not repeated here, on purpose. It
 * would couple this suite to a scratch file outside the repository and to five
 * branches that will be deleted, and it would go red for reasons that have
 * nothing to do with the tool - somebody correcting one of those sentences on
 * `main` would fail the build.
 *
 * So every case below is a hand-built diff over a hand-built tree with a known
 * answer, and every extraction class is asserted by a case that goes red when
 * that class is removed. The kill counts are in the commit message.
 *
 * ## The two properties worth having
 *
 * 1. **It finds the copy.** A number, a name or a sentence the diff moved,
 *    still standing somewhere else, comes back as a candidate.
 * 2. **It never says it covered more than it did.** Every cap prints its own
 *    suppressed count, and `selectForReport` is the single place both the text
 *    report and `--json` get their answer from, so the two cannot disagree.
 *    A silent cap reads as "covered everything" when it did not, which is the
 *    same lie the tool exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPS,
  codeOf,
  extractClaims,
  formatReport,
  parseUnifiedDiff,
  proseOf,
  proseSpans,
  searchable,
  selectForReport,
  sweep,
  type FileDiff,
  type TreeFile,
} from '../../tools/sweep.ts';

/** A unified diff, written the way `git diff -U0` writes one. */
const diffOf = (...body: string[]): FileDiff[] => parseUnifiedDiff(body.join('\n'));

const file = (path: string, ...lines: string[]): TreeFile => ({ path, text: lines.join('\n') });

/** Where every hit landed, as `path:line`, in the order the report would print. */
const places = (result: ReturnType<typeof sweep>): string[] =>
  result.groups.flatMap((g) => g.hits.map((h) => `${h.path}:${h.line}`));

describe('reading a diff', () => {
  it('numbers an added line in the head and a removed line in the base', () => {
    const [only] = diffOf(
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -40,1 +90,1 @@',
      '-const step = 60;',
      '+const step = 62;',
    );
    expect(only?.changed).toEqual([
      { path: 'src/a.ts', line: 40, text: 'const step = 60;', side: '-' },
      { path: 'src/a.ts', line: 90, text: 'const step = 62;', side: '+' },
    ]);
  });

  it('keeps both names of a renamed file, so neither tree loses it', () => {
    const [only] = diffOf(
      'diff --git a/src/old.ts b/src/new.ts',
      '--- a/src/old.ts',
      '+++ b/src/new.ts',
      '@@ -1,0 +1,1 @@',
      '+export const NAME = 1;',
    );
    expect(only?.oldPath).toBe('src/old.ts');
    expect(only?.path).toBe('src/new.ts');
  });

  it('counts context lines on both sides, so the second hunk is not off by one', () => {
    const [only] = diffOf(
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -10,3 +10,3 @@',
      ' unchanged',
      ' unchanged',
      '+added',
    );
    expect(only?.changed[0]?.line).toBe(12);
  });
});

describe('finding the prose in a line', () => {
  const spans = (line: string, path = 'a.ts', inBlock = false): string[] =>
    proseSpans(line, { inBlock }, path).map((s) => line.slice(s.start, s.end));

  it('takes a line comment and leaves the code beside it', () => {
    expect(spans('const step = 62; // the step is 60px')).toEqual([' the step is 60px']);
  });

  it('does not read a URL inside a string as the start of a comment', () => {
    expect(spans('const home = "https://example.test/x";')).toEqual([
      'https://example.test/x',
    ]);
  });

  it('reads a docblock continuation line even with no `/**` above it', () => {
    // The reason this rule exists: `git diff -U0` hands the tool the middle of
    // a paragraph with the line that opened the block nowhere in the hunk.
    expect(spans(' * the step is 60px')).toEqual([' the step is 60px']);
  });

  it('carries an unclosed block comment into the next line', () => {
    const state = { inBlock: false };
    proseSpans('/* opened here', state, 'a.ts');
    expect(state.inBlock).toBe(true);
    expect(proseOf('still prose', state, 'a.ts')).toBe('still prose');
  });

  it('treats a whole markdown line as prose and a blank one as nothing', () => {
    expect(spans('the step is 60px', 'HANDOFF.md')).toEqual(['the step is 60px']);
    expect(spans('   ', 'HANDOFF.md')).toEqual([]);
  });

  it('blanks the prose out of a line to leave the code', () => {
    const code = codeOf('const step = 62; // the step is 60px', { inBlock: false }, 'a.ts');
    expect(code).toContain('const step = 62;');
    expect(code).not.toContain('60px');
  });
});

describe('what a diff claims', () => {
  const termsOf = (kind: string, ...body: string[]): string[] =>
    extractClaims(diffOf('diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -1,1 +1,1 @@', ...body))
      .filter((c) => c.kind === kind)
      .map((c) => c.term);

  it('takes a number that carries a unit, wherever it sits', () => {
    expect(termsOf('measure', '+  height: 62px,')).toContain('62');
  });

  it('takes a decimal out of code, because a decimal is a measurement', () => {
    expect(termsOf('measure', '+  const reach = 734.5;')).toContain('734.5');
  });

  it('takes a two-digit number out of prose but not a single digit', () => {
    // Two digits, because `64` and `44` are the numbers this tree argues about
    // and a bare `4` is an index. The floor is where the corpus put it.
    const terms = termsOf('number', '+ * the band is 64 tall and 4 of that is padding');
    expect(terms).toContain('64');
    expect(terms).not.toContain('4');
  });

  it('takes a number word and the noun it counts', () => {
    expect(termsOf('number-word', '+ * the same shim seven other test files install')).toContain(
      'seven',
    );
    expect(termsOf('counted-noun', '+ * the same shim seven other test files install')).toContain(
      'seven other',
    );
  });

  it('takes a declared name, and a name prose puts in backticks', () => {
    expect(termsOf('identifier', '+export const CODEC_VERSION = 2;')).toContain('codec_version');
    expect(termsOf('quoted-symbol', '+ * `plainTextOf` is the summary line')).toContain(
      'plaintextof',
    );
  });

  it('does not mistake a shouted English word in prose for an identifier', () => {
    expect(termsOf('identifier', '+ * THAT is WHICH and nothing else')).toEqual([]);
  });

  it('takes a custom property and a test name', () => {
    expect(termsOf('custom-property', '+  width: var(--counter-cell);')).toContain(
      '--counter-cell',
    );
    expect(termsOf('test-name', "+  it('drops SHOW when both halves are off', () => {")).toContain(
      'drops show when both halves',
    );
  });

  it('takes overlapping windows of a sentence, so a copy one word apart still matches', () => {
    const phrases = termsOf('phrase', '+ * the four number cells already hold open at 64');
    expect(phrases).toContain('four number cells already hold');
    expect(phrases).toContain('number cells already hold open');
  });

  it('marks a term that only left the diff, and not one that stayed', () => {
    const claims = extractClaims(
      diffOf(
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -1,2 +1,2 @@',
        '- * the panel is 357 wide, measured at 393',
        '+ * the panel is 353 wide, measured at 393',
      ),
    );
    const gone = (term: string): boolean =>
      claims.find((c) => c.term === term && c.kind === 'number')?.gone ?? false;
    expect(gone('357')).toBe(true);
    expect(gone('393')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The whole thing, over a tree small enough to hold in one's head
// ---------------------------------------------------------------------------

const RENAMED_DIFF = diffOf(
  'diff --git a/src/panel.ts b/src/panel.ts',
  '--- a/src/panel.ts',
  '+++ b/src/panel.ts',
  '@@ -8,1 +8,1 @@',
  '- * the panel has 357 of content on a 393px phone',
  '+ * the panel has 353 of content on a 393px phone',
);

const TREE: TreeFile[] = [
  file(
    'src/panel.ts',
    'export const PANEL = 1;',
    '/**',
    ' * A docblock nowhere near the hunk.',
    ' */',
    '',
    '',
    '',
    ' * the panel has 353 of content on a 393px phone',
  ),
  file(
    'src/table.ts',
    '/**',
    ' * `panel.ts:8` measures the panel at 357 and the true box is under that.',
    ' */',
    'export const TABLE = 2;',
  ),
  file('HANDOFF.md', '# notes', 'The panel is 357 wide. There is exactly one measurement here.'),
  file('src/quiet.ts', 'const width = 357;'),
];

describe('sweeping a tree', () => {
  const run = (options = {}): ReturnType<typeof sweep> =>
    sweep(RENAMED_DIFF, TREE, { side: 'base', ...options });

  it('finds the number the diff replaced, still standing in two other files', () => {
    const found = places(run());
    expect(found).toContain('src/table.ts:2');
    expect(found).toContain('HANDOFF.md:2');
  });

  it('leaves the code alone until it is asked, and then finds it', () => {
    expect(places(run())).not.toContain('src/quiet.ts:1');
    expect(places(run({ includeCode: true }))).toContain('src/quiet.ts:1');
  });

  it('marks the line that makes an exact-count claim', () => {
    const hit = run()
      .groups.flatMap((g) => g.hits)
      .find((h) => h.path === 'HANDOFF.md');
    expect(hit?.absolute).toBe(true);
  });

  it('counts how many of the diff’s things one line names', () => {
    // `src/panel.ts:8` names both 353 and 393; `HANDOFF.md:2` names only 357.
    const byPlace = new Map(
      run().groups.flatMap((g) => g.hits.map((h) => [`${h.path}:${h.line}`, h.multiplicity])),
    );
    expect(byPlace.get('HANDOFF.md:2')).toBe(1);
    expect(byPlace.get('src/table.ts:2')).toBe(1);
  });

  it('does not read the diff’s own edit back to the lane as news', () => {
    // The `+` line stands at src/panel.ts:8 in the head tree. Searched as a
    // head, it is the lane's own sentence and must not be reported.
    const asHead = sweep(RENAMED_DIFF, TREE, { side: 'head' });
    expect(places(asHead)).not.toContain('src/panel.ts:8');
    expect(asHead.selfHits).toBeGreaterThan(0);
  });

  it('does not blank a base line at the position of a head-side edit', () => {
    // A `+` line number is a position in the head tree. Applied to a base tree
    // it hides an untouched line for no reason, which is how a version of this
    // tool once found every stale sentence and then threw them all away.
    const shifted = diffOf(
      'diff --git a/src/table.ts b/src/table.ts',
      '--- a/src/table.ts',
      '+++ b/src/table.ts',
      '@@ -40,0 +2,1 @@',
      '+ * a brand new sentence about the 357 nobody has read',
    );
    expect(places(sweep(shifted, TREE, { side: 'base' }))).toContain('src/table.ts:2');
    expect(places(sweep(shifted, TREE, { side: 'head' }))).not.toContain('src/table.ts:2');
  });

  it('drops a term the tree mentions everywhere, and says so out loud', () => {
    const noisy = Array.from({ length: 12 }, (_, i) =>
      file(`docs/n${i}.md`, 'the panel is 357 wide'),
    );
    const result = sweep(RENAMED_DIFF, [...TREE, ...noisy], { side: 'base', common: 6 });
    expect(result.tooCommon.some((t) => t.label.includes('357'))).toBe(true);
    expect(places(result)).not.toContain('docs/n0.md:1');
  });

  it('keeps a common term where the line also names something else it changed', () => {
    const noisy = Array.from({ length: 12 }, (_, i) =>
      file(`docs/n${i}.md`, 'the panel is 357 wide'),
    );
    const cluster = file('docs/cluster.md', 'the panel is 357 of content on a 393px phone');
    const result = sweep(RENAMED_DIFF, [...TREE, ...noisy, cluster], { side: 'base', common: 6 });
    const narrowed = result.groups.find((g) => g.narrowed);
    expect(narrowed?.hits.map((h) => h.path)).toContain('docs/cluster.md');
  });

  it('does not report a removed line still standing where its numbers no longer point', () => {
    // A hunk header is only right about the tree it was cut against. Point
    // `--at` at some third commit and the position is wrong while the sentence
    // is still there - so the only thing keeping the lane's own deleted line
    // out of its own report is that the text matches. This is that case: the
    // diff says line 3, the tree has it at line 5.
    const drift = diffOf(
      'diff --git a/src/drift.ts b/src/drift.ts',
      '--- a/src/drift.ts',
      '+++ b/src/drift.ts',
      '@@ -3,1 +3,1 @@',
      '- * the drift panel has 357 of content on a 393px phone',
      '+ * the drift panel has 353 of content on a 393px phone',
    );
    const tree = [
      file(
        'src/drift.ts',
        'const a = 1;',
        'const b = 2;',
        'const c = 3;',
        'const d = 4;',
        ' * the drift panel has 357 of content on a 393px phone',
      ),
      file('docs/elsewhere.md', 'and elsewhere, the drift panel is 357 wide'),
    ];
    const found = places(sweep(drift, tree, { side: 'unknown' }));
    expect(found).not.toContain('src/drift.ts:5');
    expect(found).toContain('docs/elsewhere.md:1');
  });

  it('ranks a value the diff took away above one it left alone', () => {
    // `357` left this diff; `393` is still there in both versions. A sentence
    // repeating the departed number is the defect; one repeating the surviving
    // number is a coincidence.
    const both = [
      file('docs/gone.md', 'somewhere else, the panel is still 357 wide'),
      file('docs/stayed.md', 'somewhere else, the phone is still 393 across'),
    ];
    const ranked = places(sweep(RENAMED_DIFF, both, { side: 'base' }));
    expect(ranked.indexOf('docs/gone.md:1')).toBeLessThan(ranked.indexOf('docs/stayed.md:1'));
  });

  it('says nothing about a diff that mentions nothing the tree does', () => {
    const unrelated = diffOf(
      'diff --git a/src/zzz.ts b/src/zzz.ts',
      '--- a/src/zzz.ts',
      '+++ b/src/zzz.ts',
      '@@ -1,0 +1,1 @@',
      '+ * a sentence about kobolds riding a velocipede at 9910 apiece',
    );
    expect(sweep(unrelated, TREE, { side: 'base' }).groups).toEqual([]);
  });
});

describe('which files are searched at all', () => {
  it('reads markdown, because most of the stale prose in this tree is markdown', () => {
    expect(searchable('Architecture.md')).toBe(true);
    expect(searchable('docs/handoff/DECISIONI.md')).toBe(true);
  });

  it('never reads the four directories that are symlinks or build output', () => {
    for (const path of [
      'node_modules/react/index.js',
      'dist/assets/Gm-1.js',
      '.tools/x.ts',
      'Manuali/srd.pdf',
      '.claude/worktrees/x/src/a.ts',
    ]) {
      expect(searchable(path)).toBe(false);
    }
  });
});

describe('what the report admits to', () => {
  const many: TreeFile[] = Array.from({ length: 40 }, (_, i) =>
    file(`docs/m${i}.md`, `the panel is 357 wide, note ${i + 20}`),
  );
  const result = (): ReturnType<typeof sweep> =>
    sweep(RENAMED_DIFF, [...TREE, ...many], { side: 'base', common: 500 });

  it('counts every place it did not print, rather than trailing off', () => {
    const selection = selectForReport(result(), { maxPlaces: 3, maxClaims: 99, maxHits: 99 });
    expect(selection.placesShown).toBe(3);
    expect(selection.placesHidden).toBeGreaterThan(0);
    const text = formatReport(result(), 'in the test', { maxPlaces: 3, maxClaims: 99, maxHits: 99 });
    expect(text).toContain(`${selection.placesHidden} further place(s)`);
    expect(text).toContain('THIS REPORT IS NOT COMPLETE');
  });

  it('spends its budget on lines, not on claims that repeat a line', () => {
    const selection = selectForReport(result(), { maxPlaces: 5, maxClaims: 99, maxHits: 99 });
    const printed = selection.shown.flatMap((s) => s.hits.map((h) => `${h.path}:${h.line}`));
    expect(printed.length).toBe(5);
  });

  it('prints a line once however many of the diff’s things it names', () => {
    // `docs/both.md:1` answers to 357 and to 393. It is one line to go and
    // look at, and it must cost the budget once and be printed once.
    const both = sweep(RENAMED_DIFF, [file('docs/both.md', 'the panel is 357 of 393')], {
      side: 'base',
    });
    const selection = selectForReport(both, { maxPlaces: 99, maxClaims: 99, maxHits: 99 });
    const printed = selection.shown.flatMap((s) => s.hits.map((h) => `${h.path}:${h.line}`));
    expect(printed).toEqual(['docs/both.md:1']);
    expect(selection.claimsRedundant).toBeGreaterThan(0);
  });

  it('names the files it did not search at all', () => {
    const text = formatReport(result(), 'in the test', CAPS, ['data/srd-1.0.json']);
    expect(text).toContain('data/srd-1.0.json');
    expect(text).toContain('NOT searched');
  });

  it('says candidates, and never says finding', () => {
    const text = formatReport(result(), 'in the test', CAPS);
    expect(text).toContain('CANDIDATES, NOT FINDINGS');
    expect(text).not.toMatch(/\bis (?:wrong|false|stale)\b/);
  });

  it('does not report an empty run as a clean bill of health', () => {
    const empty = sweep(
      diffOf(
        'diff --git a/src/zzz.ts b/src/zzz.ts',
        '--- a/src/zzz.ts',
        '+++ b/src/zzz.ts',
        '@@ -1,0 +1,1 @@',
        '+ * kobolds riding a velocipede at 9910 apiece',
      ),
      TREE,
      { side: 'base' },
    );
    expect(formatReport(empty, 'in the test', CAPS)).toContain('not a clean bill of health');
  });
});
