/**
 * How much of SRD 1.0 is still printed in SRD 2.0, measured rather than argued.
 *
 * The decisions document claims "839 of 849 names refound, the absences being
 * the 9 weapons plus two rules sections that were renamed". This pins the
 * measurement that claim rests on, because two of its three parts are wrong and
 * the wrongness is only visible with the numbers in front of you:
 *
 * - 839 of 849 is EXACTLY right, and reproduced here.
 * - The absences are 8 weapons and 2 rules titles, not 9 and 2. Nine plus two
 *   is eleven, and 849 - 11 is 838.
 * - Neither "renamed" rules section was renamed by the book. Both titles are
 *   editorial, minted in `shared/parsers/rules.ts`, and the control test below
 *   is what proves it: they are missing from SRD 1's OWN text too. A name that
 *   its own book does not print cannot have been renamed by the other one.
 *
 * The control is the load-bearing idea here. Searching a book for 849 strings
 * always returns some number; only running the same search against the book the
 * strings came from tells you which misses are the book's and which are the
 * harness's. SRD 1 scores 847, so exactly 2 of SRD 2's 10 misses are ours.
 */
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BookPage } from '../../shared/textLayout.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

/** Every collection whose records carry a name the book is expected to print. */
const COLLECTIONS = [
  'domains', 'domainCards', 'classes', 'subclasses', 'beastforms', 'ancestries', 'communities',
  'weapons', 'armors', 'loot', 'consumables', 'adversaries', 'environments', 'rules',
] as const;

/*
 * The folds, one per constant, so that removing any single one is a mutation
 * that removes exactly one behaviour.
 *
 * FOLD_DASH is the only one that buys anything on this comparison: SRD 2 sets
 * the appendix's `X-Touched` card titles with U+2011 NON-BREAKING HYPHEN, and
 * the dataset holds ASCII. STRIP_INVIS buys nothing at all - SRD 2 contains
 * exactly one U+00AD and four U+200B in 224 pages, and none of the five falls
 * inside a name - but it is kept because its cost is nil and its absence would
 * be a silent trap the day a name does straddle one.
 */
const FOLD_INVIS = /[­​‌‍⁠﻿]/g;
const FOLD_QUOTE = /[‘’ʼʹ`´]/g;
const FOLD_DASH = /[‐‑‒–—−⁃]/g;

const norm = (s: string): string =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(FOLD_INVIS, '')
    .replace(FOLD_QUOTE, "'")
    .replace(FOLD_DASH, '-')
    .replace(/[\s ]+/g, ' ')
    .trim();

/**
 * Both text streams, because the tables are only in one of them.
 *
 * `page.lines` is de-columnised prose; a weapon table read that way interleaves
 * the cells of neighbouring columns, so "Improved Halberd" is never adjacent
 * text on any line. `page.runs` keeps the extractor's order, in which the row
 * reads straight through - "improved halberd strength very close d10+5 phy".
 * Measured: lines alone refind 815 of 849 in SRD 2 and only 758 in SRD 1;
 * adding the runs takes those to 839 and 847.
 */
const haystack = (pages: BookPage[]): string => {
  const parts: string[] = [];
  for (const p of pages) parts.push(p.lines.map((l) => l.text).join('\n'));
  for (const p of pages) parts.push(p.runs.map((r) => r.text).join(' '));
  return parts.join('\n');
};

interface Named { coll: string; name: string }

const namesOf = (): Named[] => {
  const ds = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as
    Record<string, { name?: string; title?: string }[]>;
  const out: Named[] = [];
  for (const c of COLLECTIONS) {
    for (const r of ds[c]!) out.push({ coll: c, name: (r.name ?? r.title)! });
  }
  return out;
};

const missesIn = (hay: string, names: Named[], f: (s: string) => string = norm): string[] => {
  const H = f(hay);
  return names.filter((n) => !H.includes(f(n.name))).map((n) => `${n.coll}/${n.name}`);
};

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));

describe('the SRD 1 name list', () => {
  it('is 849 records and 849 distinct names', () => {
    const names = namesOf();
    expect(names.length).toBe(849);
    expect(new Set(names.map((n) => n.name)).size).toBe(849);
    // 780 is the figure an earlier document used; it is this one minus `rules`.
    expect(names.filter((n) => n.coll !== 'rules').length).toBe(780);
  });
});

describe.skipIf(!(have(0) && have(1)))('SRD 1 names, looked for in both books', () => {
  let one: BookPage[] = [];
  let two: BookPage[] = [];
  let names: Named[] = [];

  beforeAll(async () => {
    names = namesOf();
    one = (await loadSrd({ pdfPath: BOOKS[0]!.localPaths.find(existsSync)! })).pages;
    two = (await loadSrd({ pdfPath: BOOKS[1]!.localPaths.find(existsSync)! })).pages;
  });

  it('CONTROL: SRD 1 refinds 847 of its own 849, and the 2 it misses are titles the parser invented', () => {
    const misses = missesIn(haystack(one), names);
    expect(misses).toEqual([
      'rules/Companion: Taking Damage as Stress',
      'rules/Making GM Moves',
    ]);
    expect(names.length - misses.length).toBe(847);
  });

  it('refinds 839 of 849 in SRD 2, missing 8 weapons and the same 2 invented titles', () => {
    const misses = missesIn(haystack(two), names);
    expect(misses).toEqual([
      'weapons/Axe of Fortunis',
      'weapons/Blessed Anlace',
      'weapons/Ghostblade',
      'weapons/Runes of Ruination',
      'weapons/Widogast Pendant',
      'weapons/Firestaff',
      'weapons/Mage Orb',
      'weapons/Ilmari’s Rifle',
      'rules/Companion: Taking Damage as Stress',
      'rules/Making GM Moves',
    ]);
    expect(names.length - misses.length).toBe(839);
    expect(misses.filter((m) => m.startsWith('weapons/')).length).toBe(8);
  });

  it('the dash fold is what buys the last nine, and they are all X-Touched cards', () => {
    /* `norm` with the FOLD_DASH step and nothing else removed. */
    const noDash = (s: string): string =>
      s
        .normalize('NFKC')
        .toLowerCase()
        .replace(FOLD_INVIS, '')
        .replace(FOLD_QUOTE, "'")
        .replace(/[\s ]+/g, ' ')
        .trim();
    const before = missesIn(haystack(two), names, noDash);
    const after = missesIn(haystack(two), names);
    expect(names.length - before.length).toBe(830);
    expect(before.filter((m) => !after.includes(m)).sort()).toEqual([
      'domainCards/Arcana-Touched',
      'domainCards/Blade-Touched',
      'domainCards/Bone-Touched',
      'domainCards/Codex-Touched',
      'domainCards/Grace-Touched',
      'domainCards/Midnight-Touched',
      'domainCards/Sage-Touched',
      'domainCards/Splendor-Touched',
      'domainCards/Valor-Touched',
    ]);
  });

  it('the runs stream is load-bearing: the lines alone lose 24 weapons in SRD 2 and 89 in SRD 1', () => {
    const linesOnly = (pages: BookPage[]): string =>
      pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n');
    expect(names.length - missesIn(linesOnly(two), names).length).toBe(815);
    expect(names.length - missesIn(linesOnly(one), names).length).toBe(758);
  });
});
