// @vitest-environment jsdom
/**
 * Martial Stances: a chapter nothing read, and the sheet the app promised.
 *
 * SRD 2.0 folio 13 prints sixteen martial stances over four tiers, and until
 * this lane nothing in the pipeline touched that page - it sat inside the
 * parsed `Classes` range (folios 8-32) and was the only folio in the span
 * yielding zero records. Meanwhile the Brawler's Martial Artist foundation
 * feature, which the app draws verbatim from the shipped dataset, says *"Take
 * the Martial Stances sheet and choose two martial stances from Tier 1."*
 *
 * This file proves the eight claims the lane makes.
 *
 *   1. the PARSER selects by the banner the page prints, cuts at BOTH ends, and
 *      answers `[]` for a book without the chapter *for a reason that keeps
 *      working*;
 *   2. the DATASET carries sixteen, four per tier, off folio 13;
 *   3. the REGISTRY gives them a band of their own and moved no id;
 *   4. a CHARACTER can know them and hold Focus, with the converter the repo's
 *      policy requires;
 *   5. it TRAVELS - `CODEC_VERSION` 8 - and an older payload still decodes;
 *   6. it is SHOWN, NEVER APPLIED - derived stats are equal with and without;
 *   7. it is FINDABLE in the SRD search;
 *   8. it is REACHABLE from the sheet, with no new nav entry.
 *
 * ## The measurements this file is built on
 *
 * `npx tsx` over `shared/parsers/*` and `tools/loadSrd.ts` against
 * `Manuali/DH_SRD_2_2026_08_25.pdf` and `Manuali/Daggerheart-SRD-9-09-25.pdf`,
 * 2026-09-01:
 *
 *   contents entries naming "Martial Stances"   SRD 2.0: 0 of 44.  SRD 1.0: 0 of 38.
 *   display lines folding to MARTIAL STANCES    SRD 2.0: folio 13.  SRD 1.0: none.
 *   bold-sans STANCE FEATURES banners           SRD 2.0: folio 13.  SRD 1.0: none.
 *   bold-sans `TIER n` heads in Classes         SRD 2.0: 4, all f13. SRD 1.0: none.
 *   stance slugs colliding with any other id    both books: 0 of 16.
 *
 * The last line is why the exact-lookup checks below are written the way they
 * are: there is nothing to collide TODAY, and `transformations` learned what a
 * collection on the bare name costs on the day a printing introduced one.
 */
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../shared/textLayout.ts';
import { parseStances } from '../shared/parsers/stances.ts';
import { MIGRATIONS, migrateCharacterRecord } from '../shared/migrations.ts';
import {
  MAX_FOCUS,
  SCHEMA_VERSION,
  type Character,
  type Dataset,
  type Stance,
} from '../shared/types.ts';
import { COUNTER_CEILINGS, deriveStats, indexDataset, newCharacter } from '../src/engine/character.ts';
import { characterRefs } from '../src/engine/holdings.ts';
import { baseDataset } from '../src/store/dataset.ts';
import {
  CODEC_VERSION,
  READABLE_CODEC_VERSIONS,
  decodeCharacter,
  encodeCharacter,
  missingSlugs,
  resolvePlaceholders,
} from '../src/transfer/codec.ts';
import {
  BANDED_COLLECTIONS,
  BANDS,
  REGISTRY_VERSION,
  bandFor,
  createRegistry,
  registry,
  registryKey,
  unresolvedRef,
  type Registry,
} from '../src/transfer/registry.ts';
import { SRD_KINDS, SRD_KIND_LABELS, searchSrd, srdIndex } from '../src/ui/shared/srdIndex.ts';
import { REVISION_COUNTS, validate } from '../tools/validate.ts';
import { BOOKS, loadSrd } from '../tools/loadSrd.ts';
import { useApp } from '../src/store/state.ts';
import { Edit } from '../src/ui/build/Edit.tsx';
import { makeDataset } from './fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// ---------------------------------------------------------------------------
// Hand-built pages, so the parser itself runs in CI where no manual exists
// ---------------------------------------------------------------------------

interface Face {
  family?: string;
  size?: number;
  bold?: boolean;
}

const run = (text: string, face: Face = {}): TextRun => ({
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  text,
  family: face.family ?? 'QuestaSans-Light',
  size: face.size ?? 9.3,
  bold: face.bold ?? false,
  italic: false,
});

const runLine = (runs: TextRun[]): Line => ({
  text: runs.map((r) => r.text).join(' '),
  x: 0,
  y: 0,
  w: 400,
  size: Math.max(...runs.map((r) => r.size)),
  family: runs[0]!.family,
  bold: runs.every((r) => r.bold),
  italic: false,
  column: 0,
  runs,
});

const body = (text: string): Line => runLine([run(text)]);

/** A chapter head: `12.0 EvelethCleanRegular`, the face folio 13 sets. */
const chapterHead = (text: string): Line =>
  runLine([run(text, { family: 'EvelethCleanRegular', size: 12 })]);

/** A class name: `12.0 EvelethCleanThin` bold, the face folio 14 sets DRUID in. */
const className = (text: string): Line =>
  runLine([run(text, { family: 'EvelethCleanThin', size: 12, bold: true })]);

/** A bold sans banner, the face `STANCE FEATURES` is set in. */
const banner = (text: string): Line =>
  runLine([run(text, { family: 'QuestaSans', size: 11.3, bold: true })]);

/** A tier head, `10.0 QuestaSans-Medium` bold. */
const tierHead = (n: number): Line =>
  runLine([run(`TIER ${n}`, { family: 'QuestaSans-Medium', size: 10, bold: true })]);

/** `Name: rest`, with the name bold and the body light, as fifteen of sixteen are. */
const named = (name: string, rest: string): Line =>
  runLine([
    run(`${name}:`, { family: 'QuestaSans', bold: true }),
    ...rest.split(' ').map((w) => run(w)),
  ]);

/**
 * `Name: bold phrase` then light, which is how the book sets `Honed`.
 *
 * The one entry in sixteen whose opening bold run does not end at the colon.
 */
const namedBoldThrough = (name: string, boldRest: string, rest: string): Line =>
  runLine([
    run(`${name}:`, { family: 'QuestaSans', bold: true }),
    ...boldRest.split(' ').map((w) => run(w, { family: 'QuestaSans', bold: true })),
    ...rest.split(' ').map((w) => run(w)),
  ]);

const page = (folio: number, lines: Line[]): BookPage => ({
  index: folio,
  folio,
  pdfPage: folio,
  side: 'single',
  width: 612,
  height: 792,
  columns: 2,
  lines,
  runs: lines.flatMap((l) => l.runs),
});

const contents = (entries: Array<[string, number]>): BookPage =>
  page(2, [body('CONTENTS'), ...entries.map(([title, folio]) => body(`${title} ....... ${folio}`))]);

/** The four stances of one tier, as the book sets them. */
const TIER_1: Line[] = [
  tierHead(1),
  named('Favored', 'Gain a bonus to damage rolls equal to a trait of'),
  body('your choice.'),
  named('Invigorating', 'On a successful attack, roll a d4. On a result'),
  body('of 4, gain a Focus.'),
  named('Quick', 'When you make an attack, you can spend a Focus or'),
  body('mark a Stress to target another creature within range with'),
  body('that attack.'),
  named('Reliable', 'Gain a +1 bonus to your attack rolls.'),
];

const TIER_4: Line[] = [
  tierHead(4),
  named('Crushing', 'When you deal Severe damage, you can spend a'),
  body('Hope to force the target to mark an additional Hit Point.'),
  named('Exacting', 'When you roll a 1 on a damage die, you can treat'),
  body('it as the highest value on the die instead.'),
  namedBoldThrough('Honed', 'Spend a Focus', 'before you make an attack roll to'),
  body('gain a +1 bonus to your Proficiency for that attack.'),
  named('Isolating', 'Gain advantage on attack rolls when there are'),
  body('no other creatures within Very Close range of you or your'),
  body('target.'),
];

/** Folio 13 as the book sets it: the head, the rules prose, then the list. */
const FOLIO_13: Line[] = [
  chapterHead('MARTIAL STANCES'),
  body('When you choose the Martial Artist subclass, take the Martial'),
  body('Stances sheet to track which stances your character knows.'),
  banner('STANCES'),
  body('Stances are special body positionings that enable Martial'),
  banner('FOCUS'),
  body('You can hold a maximum of 6 Focus.'),
  banner('SHIFTING INTO STANCES'),
  body('You can spend a Focus to shift into a martial stance.'),
  banner('DROPPING OUT OF STANCES'),
  body('You drop out of your active stance at the end of the scene.'),
  banner('STANCE FEATURES'),
  body('The following section lists all martial stances by tier.'),
  ...TIER_1,
  ...TIER_4,
];

/**
 * A book shaped like SRD 2.0's Classes chapter: the Brawler's subclasses on
 * folio 12, this chapter on 13, the next class on 14.
 *
 * Folio 12 carries `Stance Fighter:` on purpose. It is a bold name ending in a
 * colon, exactly what `nameOf` matches, so a parser that did not cut its head
 * would emit it as a stance without complaining.
 */
const BOOK = (stances: Line[] = FOLIO_13): BookPage[] => [
  contents([
    ['Domains', 7],
    ['Classes', 8],
    ['Ancestries', 32],
  ]),
  page(12, [
    className('MARTIAL ARTIST'),
    banner('FOUNDATION FEATURE'),
    named('Stance Fighter', 'You can channel your inner resolve to shift'),
    body('into martial stances that grant you special benefits in combat.'),
  ]),
  page(13, stances),
  page(14, [
    className('DRUID'),
    body('Becoming a druid is more than an occupation.'),
    banner('CLASS FEATURES'),
    named('Beastform', 'Mark a Stress to magically transform into a creature.'),
  ]),
];

// ---------------------------------------------------------------------------
// 1. The parser
// ---------------------------------------------------------------------------

describe('selecting a chapter the contents page does not name', () => {
  it('reads sixteen stances off the page that prints the banner', () => {
    const out = parseStances(BOOK());
    expect(out.map((s) => s.name)).toEqual([
      'Favored',
      'Invigorating',
      'Quick',
      'Reliable',
      'Crushing',
      'Exacting',
      'Honed',
      'Isolating',
    ]);
    expect(out.every((s) => s.sourcePage === 13)).toBe(true);
  });

  it('answers [] for a book that prints no such chapter, rather than throwing', () => {
    const pages = [contents([['Classes', 8], ['Ancestries', 27]]), page(13, [className('DRUID')])];
    expect(parseStances(pages)).toEqual([]);
  });

  /**
   * THE WHOLE LANE IN MINIATURE, and the reason there is no `catch` in the
   * parser.
   *
   * A `try { ... } catch { return [] }` passes the check above and fails this
   * one silently: it would report "this book has no stances" about a book with
   * sixteen. The parser asks the rest of the pages before believing the
   * Classes range, and `STANCE FEATURES` is the banner the list is never
   * printed without.
   */
  it('refuses when the head is missing but some page prints a STANCE FEATURES banner', () => {
    const pages = [
      contents([['Classes', 8], ['Ancestries', 27]]),
      page(40, [banner('STANCE FEATURES'), ...TIER_1]),
    ];
    expect(() => parseStances(pages)).toThrow(/STANCE FEATURES banner/);
    expect(() => parseStances(pages)).toThrow(/folios 40/);
  });

  it('refuses when the head is printed outside the chapter it looked in', () => {
    const pages = [
      contents([['Classes', 8], ['Ancestries', 27]]),
      page(60, [chapterHead('MARTIAL STANCES'), ...TIER_1]),
    ];
    expect(() => parseStances(pages)).toThrow(/printed outside Classes/);
    expect(() => parseStances(pages)).toThrow(/folios 60/);
  });
});

describe('cutting the chapter at both of its ends', () => {
  /**
   * `sectionRange('Classes')` returns folios 8-32 and both ends carry other
   * chapters. Trimming one end only takes one of them, which is the exact bug
   * that made `communities.ts` read the ancestry Simiah as a community.
   */
  it('drops the subclass feature above it and the class printed after it', () => {
    const out = parseStances(BOOK());
    // `Stance Fighter` is on folio 12 and is a bold name ending in a colon.
    expect(out.map((s) => s.name)).not.toContain('Stance Fighter');
    // `Beastform` is on folio 14 and is the same shape.
    expect(out.map((s) => s.name)).not.toContain('Beastform');
  });

  it('reads to the end of the range when no class follows the chapter', () => {
    const pages = BOOK().filter((p) => p.folio !== 14);
    expect(parseStances(pages)).toHaveLength(8);
  });

  /**
   * The "no tail" sentinel, which two obvious values get wrong.
   *
   * `sliceSection` cuts at the first line whose folded text equals the tail
   * title, and `contents.ts`'s `key` collapses whitespace and trims - so `''`
   * and `' '` both fold to `''` and so does a blank line. Measured on
   * `sliceSection` directly: with either of those as the tail, `['a', ' ', 'b']`
   * comes back as `['a']`; with U+0000 it comes back whole.
   *
   * A blank line inside the chapter would therefore silently end it. This is
   * that shape, with the blank line where the last tier's wrap would be.
   */
  it('is not ended by a blank line when there is no class after it', () => {
    const pages = BOOK().filter((p) => p.folio !== 14);
    const stances = pages.find((p) => p.folio === 13)!;
    stances.lines.splice(stances.lines.length - 3, 0, body('   '));
    expect(parseStances(pages).map((s) => s.name)).toContain('Isolating');
  });

  /**
   * The half of the cut that is NOT load-bearing on this book, pinned anyway.
   *
   * Measured by deleting each cut and running every gate: without the TAIL cut
   * the build dies on `duplicate stance id`, and without the HEAD cut every
   * gate stays green - because `bannerAt` also drops everything above
   * `STANCE FEATURES`, and this book prints that banner once.
   *
   * So the head cut is the parser declining to depend on that. A page earlier
   * in `Classes` printing the same banner would hand `findIndex` the wrong one,
   * and the chapter read would be that page's. This is the shape that tells the
   * two apart.
   */
  it('reads the chapter under the head, not an earlier page that prints the same banner', () => {
    const pages = BOOK();
    pages.splice(2, 0, page(11, [banner('STANCE FEATURES'), tierHead(1), named('Impostor', 'Not a stance at all.')]));
    const out = parseStances(pages);
    expect(out.map((s) => s.name)).not.toContain('Impostor');
    expect(out).toHaveLength(8);
  });
});

describe('a stance name the book bolds straight through', () => {
  /**
   * `Honed: Spend a Focus before you make an attack roll...`
   *
   * The book bolds the mechanical phrase with no light run between it and the
   * colon, so the line's opening bold run is `Honed: Spend a Focus`.
   * `transformations.ts`'s rule - "a bold run that ENDS in a colon" - reads
   * that as a continuation and welds the stance onto `Exacting`. Measured: the
   * first run of this parser produced fifteen stances and tier 4 had three.
   */
  it('opens a stance, and keeps the bolded words in its text', () => {
    const honed = parseStances(BOOK()).find((s) => s.name === 'Honed');
    expect(honed, 'the bolded phrase swallowed the stance').toBeDefined();
    expect(honed!.text).toBe(
      'Spend a Focus before you make an attack roll to gain a +1 bonus to your Proficiency for that attack.',
    );
    // And it did not steal the entry above it.
    const exacting = parseStances(BOOK()).find((s) => s.name === 'Exacting')!;
    expect(exacting.text).toBe(
      'When you roll a 1 on a damage die, you can treat it as the highest value on the die instead.',
    );
  });
});

describe('the tier heads', () => {
  it('files each stance under the tier the book prints it beneath', () => {
    const out = parseStances(BOOK());
    expect(out.filter((s) => s.tier === 1).map((s) => s.name)).toEqual([
      'Favored',
      'Invigorating',
      'Quick',
      'Reliable',
    ]);
    expect(out.filter((s) => s.tier === 4).map((s) => s.name)).toEqual([
      'Crushing',
      'Exacting',
      'Honed',
      'Isolating',
    ]);
  });

  it('refuses a tier printed twice, because that is two chapters welded together', () => {
    const pages = BOOK([...FOLIO_13, ...TIER_1]);
    expect(() => parseStances(pages)).toThrow(/prints TIER 1 twice/);
  });

  it('does not take a display tier head for one, the way SRD 1.0 sets them', () => {
    /*
     * SRD 1.0's beastform chapter sets `TIER 2` in `11.3 EvelethCleanThin`, and
     * SRD 2.0 reprints those cards on folios 15-18 - inside this parser's own
     * search range. A parser reading tier heads by size alone would open a
     * stance block on every one of them.
     *
     * Two independent mechanisms refuse it, and the assertion below is what
     * they agree on. `tierOf` wants bold SANS, so a display line is not a tier
     * head; and the tail cut ends the chapter at the first display line after
     * the head, so the beastform material is not in the slice at all. Measured
     * on the real book, folio 13 carries exactly ONE display line - the chapter
     * head - so neither mechanism has anything to cut short.
     */
    const displayTier = runLine([run('TIER 2', { family: 'EvelethCleanThin', size: 11.3 })]);
    const pages = BOOK([
      chapterHead('MARTIAL STANCES'),
      banner('STANCE FEATURES'),
      ...TIER_1,
      displayTier,
      named('Legendary Beast', 'An upgraded template with no statistics of its own.'),
    ]);
    const out = parseStances(pages);
    expect(out.map((s) => s.tier)).toEqual([1, 1, 1, 1]);
    expect(out.map((s) => s.name)).not.toContain('Legendary Beast');
  });

  it('wants the tier head BOLD, and a light line that reads TIER 2 is not one', () => {
    /*
     * THE HALF THE TEST ABOVE CANNOT REACH, and it took an outside mutation to
     * see it. `tierOf`'s `isBoldSans` guard can be deleted OUTRIGHT - not
     * merely widened to accept display - and every gate stays green: 186 files
     * / 4615 tests, `stances 16`, both books matching. Measured, twice.
     *
     * The reason the display case cannot reach it is structural, and it is why
     * the test above proves the tail cut rather than the guard: the tail is
     * `all.slice(headAt + 1).find(isDisplay)`, so the FIRST display line after
     * the head ends the chapter. A display line can therefore never sit inside
     * the slice, and `tierOf` never sees one.
     *
     * What CAN sit inside the slice is a light line - body text, which is most
     * of the chapter. So that is what this feeds it. `TIER 2` in the running
     * face, between two tier-1 stances: with the guard it is prose and is
     * swallowed by `Favored`; without it, `Reliable` silently becomes tier 2,
     * and a Martial Artist choosing "two stances from Tier 1" would be offered
     * one the book files a tier higher.
     */
    const pages = BOOK([
      chapterHead('MARTIAL STANCES'),
      banner('STANCE FEATURES'),
      tierHead(1),
      named('Favored', 'Gain a bonus to damage rolls equal to a trait of'),
      body('your choice.'),
      body('TIER 2'),
      named('Reliable', 'Gain a +1 bonus to your attack rolls.'),
    ]);
    const out = parseStances(pages);
    expect(out.map((s) => s.name)).toEqual(['Favored', 'Reliable']);
    expect(out.map((s) => s.tier)).toEqual([1, 1]);
  });
});

// ---------------------------------------------------------------------------
// 2. The dataset the app ships
// ---------------------------------------------------------------------------

const MANUAL = (i: number): string | null =>
  BOOKS[i]!.localPaths.find((p) => existsSync(p)) ?? null;

describe('the shipped dataset', () => {
  it('carries sixteen stances, four to a tier, all off folio 13', () => {
    expect(baseDataset.stances).toHaveLength(16);
    for (const tier of [1, 2, 3, 4]) {
      expect(baseDataset.stances.filter((s) => s.tier === tier), `tier ${tier}`).toHaveLength(4);
    }
    expect(new Set(baseDataset.stances.map((s) => s.sourcePage))).toEqual(new Set([13]));
  });

  it('names the sixteen the book prints, in the book’s own order', () => {
    expect(baseDataset.stances.map((s) => s.name)).toEqual([
      'Favored',
      'Invigorating',
      'Quick',
      'Reliable',
      'Aggressive',
      'Anchored',
      'Defensive',
      'Otherworldly',
      'Grappling',
      'Scary',
      'Stable',
      'Vigilant',
      'Crushing',
      'Exacting',
      'Honed',
      'Isolating',
    ]);
  });

  it('carries the sentence the book prints, not a summary of it', () => {
    const of = (id: string): string => baseDataset.stances.find((s) => s.id === id)!.text;
    expect(of('reliable')).toBe('Gain a +1 bonus to your attack rolls.');
    expect(of('scary')).toBe('On a successful attack, the target must mark a Stress.');
    expect(of('honed')).toBe(
      'Spend a Focus before you make an attack roll to gain a +1 bonus to your Proficiency for that attack.',
    );
    // The book sets this one with U+2212; `normalizeText` folds it, the same
    // way it does for every other minus in the dataset.
    expect(of('aggressive')).toContain('Gain a -1 penalty to your Evasion.');
    expect(of('grappling')).toContain('temporarily Restrain the target');
  });

  it('counts zero for a book that has no such chapter, and that is a measurement', () => {
    expect(REVISION_COUNTS['srd-1.0-2025-09-09']?.stances).toBe(0);
    expect(REVISION_COUNTS['srd-2.0-2026-08-25']?.stances).toBe(16);
    const srd1 = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as Dataset;
    expect(srd1.stances).toEqual([]);
    expect(validate(srd1).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('fails the build when the count moves, rather than shipping the wrong number', () => {
    const short = { ...baseDataset, stances: baseDataset.stances.slice(0, 15) };
    const errors = validate(short as Dataset).filter((i) => i.where === 'stances');
    expect(errors.map((e) => e.message).join(' ')).toMatch(/expected 16/);
  });

  it('fails the build when a tier head is missed, which leaves the total right', () => {
    /*
     * The failure a count cannot see. `splitOn` welds a missed tier's stances
     * onto the tier above, so all sixteen records survive and every one is
     * well-formed; only the shape gives it away.
     */
    const welded = {
      ...baseDataset,
      stances: baseDataset.stances.map((s) => (s.tier === 3 ? { ...s, tier: 2 as const } : s)),
    };
    const errors = validate(welded as Dataset).filter((i) => i.where === 'stances');
    expect(errors.map((e) => e.message).join(' ')).toMatch(/tiers are uneven/);
  });
});

describe.skipIf(MANUAL(1) === null)('the book itself', () => {
  it('yields the same sixteen the committed dataset carries', async () => {
    const srd = await loadSrd({ pdfPath: MANUAL(1)! });
    const parsed = parseStances(srd.pages);
    expect(parsed).toEqual(baseDataset.stances);
  }, 120_000);
});

describe.skipIf(MANUAL(0) === null)('the book that has no such chapter', () => {
  it('prints neither banner anywhere, so [] is an answer and not a swallowed failure', async () => {
    const srd = await loadSrd({ pdfPath: MANUAL(0)! });
    const heads = srd.pages.filter((p) =>
      p.lines.some((l) => /^martial stances$/i.test(l.text.trim())),
    );
    const banners = srd.pages.filter((p) =>
      p.lines.some((l) => /^stance features$/i.test(l.text.trim())),
    );
    expect(heads).toEqual([]);
    expect(banners).toEqual([]);
    expect(parseStances(srd.pages)).toEqual([]);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// 3. The registry band
// ---------------------------------------------------------------------------

describe('the stances band', () => {
  it('has a thousand of its own that nothing else claims', () => {
    const band = bandFor('stances');
    expect([band.min, band.max]).toEqual([15_000, 15_999]);
    for (const other of BANDS) {
      if (other === band) continue;
      expect(other.max < band.min || other.min > band.max, `${other.name} overlaps`).toBe(true);
    }
  });

  it('mints every shipped stance inside it, and nothing else there', () => {
    const rows = [...registry.entries()].filter(([k]) => k.startsWith('stances/'));
    expect(rows).toHaveLength(16);
    for (const [key, id] of rows) {
      expect(id, key).toBeGreaterThanOrEqual(15_001);
      expect(id, key).toBeLessThanOrEqual(15_999);
    }
    for (const [key, id] of registry.entries()) {
      if (id >= 15_000 && id <= 15_999) expect(key.startsWith('stances/'), key).toBe(true);
    }
  });

  it('sorts last, where a new collection can take no bare name from an old one', () => {
    expect(BANDED_COLLECTIONS.at(-1)).toBe('stances');
  });
});

// ---------------------------------------------------------------------------
// 4. A character can hold them
// ---------------------------------------------------------------------------

const FIXTURES = 'tests/fixtures/schema';

const sheet = (p: Partial<Character> = {}): Character =>
  newCharacter({
    id: '5f7c2a10-91b4-4d3e-8c07-6a1e2f9b3d45',
    name: 'Kaelith',
    classRef: 'wizard',
    subclassRefs: ['school-of-knowledge'],
    ancestryRefs: ['elf'],
    communityRef: 'loreborne',
    level: 5,
    hp: { marked: 0, max: 7 },
    createdAt: '2026-02-14T19:05:00.000Z',
    updatedAt: '2026-08-15T21:30:00.000Z',
    ...p,
  });

describe('a character can know stances and hold Focus', () => {
  it('seeds both on a blank sheet, so an older file cannot lose them on read', () => {
    // `readCharacterRecord` spreads an imported file over `newCharacter()`, so
    // a key missing here is a field dropped out of every file that has one.
    expect(newCharacter().stanceRefs).toEqual([]);
    expect(newCharacter().focus).toEqual({ marked: 0, max: MAX_FOCUS });
  });

  it('caps Focus at the six the book prints, and says so in one place', () => {
    expect(MAX_FOCUS).toBe(6);
    expect(COUNTER_CEILINGS.focus).toBe(MAX_FOCUS);
  });

  it('ships the converter the policy requires, keyed on the version it leaves', () => {
    expect(SCHEMA_VERSION).toBe(8);
    expect(MIGRATIONS.map((m) => m.from)).toContain(7);
  });

  it('gives a schema-7 record the two fields it never had, and changes nothing else', () => {
    const before: Record<string, unknown> = {
      schemaVersion: 7,
      name: 'Fixture',
      communityRef: 'highborne',
      transformationRef: null,
      scars: ['A ledger of names'],
    };
    const after = migrateCharacterRecord(before);

    expect(after.from).toBe(7);
    expect(after.applied).toEqual([
      'a character can know martial stances and hold Focus, starting with none of either',
    ]);
    expect(after.record['stanceRefs']).toEqual([]);
    expect(after.record['focus']).toEqual({ marked: 0, max: MAX_FOCUS });
    // Converting is not rewriting.
    expect(after.record['name']).toBe('Fixture');
    expect(after.record['communityRef']).toBe('highborne');
    expect(after.record['scars']).toEqual(['A ledger of names']);
  });

  it('carries a schema-8 fixture that really holds the two new fields', () => {
    /*
     * The v5 companion was committed as decoration - the generic fixture loop
     * checks name, level, loadout, Experiences and HP and never went inside it,
     * so deleting the field left the suite green. These two are the fields the
     * 7 -> 8 step exists for, and this is what reads them.
     */
    for (const name of ['v8.dhchar', 'v8.dhbackup']) {
      const raw = JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Record<string, unknown>;
      const records = (raw['characters'] ?? [raw['character']]) as Array<Record<string, unknown>>;
      expect(raw['schemaVersion'], name).toBe(8);
      expect(records[0]?.['stanceRefs'], name).toEqual(['favored', 'reliable']);
      expect(records[0]?.['focus'], name).toEqual({ marked: 3, max: 6 });
    }
  });

  it('names the stances in the one walk that answers "what does this sheet name?"', () => {
    expect(characterRefs(sheet({ stanceRefs: ['favored', 'reliable'] }))).toContain('favored');
    expect(characterRefs(sheet({ stanceRefs: ['favored', 'reliable'] }))).toContain('reliable');
  });
});

// ---------------------------------------------------------------------------
// 5. Shown, never applied
// ---------------------------------------------------------------------------

const stance = (p: Partial<Stance> = {}): Stance => ({
  id: 'aggressive',
  name: 'Aggressive',
  tier: 2,
  text: 'Gain a -1 penalty to your Evasion. On a successful attack, roll an additional damage die.',
  sourcePage: 13,
  ...p,
});

describe('shown, never applied', () => {
  it('derives the same stats with and without every stance the book prints', () => {
    /*
     * Six of the sixteen name a number - Aggressive's -1 to Evasion, Anchored's
     * +2 to damage thresholds, Reliable's +1 to attack rolls - and every one is
     * conditional on being IN the stance, which the sheet does not say. If
     * `deriveStats` ever starts reading `stanceRefs` this goes red.
     */
    const ds = makeDataset({ stances: baseDataset.stances });
    const ix = indexDataset(ds);
    const bare = sheet({
      classRef: 'test-class',
      subclassRefs: [],
      ancestryRefs: [],
      communityRef: null,
    });
    const loaded = { ...bare, stanceRefs: baseDataset.stances.map((s) => s.id) };
    expect(JSON.stringify(deriveStats(loaded, ds, ix))).toBe(
      JSON.stringify(deriveStats(bare, ds, ix)),
    );
  });

  it('does not move a derived stat when Focus is held either', () => {
    const ds = makeDataset({ stances: [stance()] });
    const ix = indexDataset(ds);
    const bare = sheet({ classRef: 'test-class', subclassRefs: [], ancestryRefs: [], communityRef: null });
    const full = { ...bare, focus: { marked: MAX_FOCUS, max: MAX_FOCUS } };
    expect(JSON.stringify(deriveStats(full, ds, ix))).toBe(JSON.stringify(deriveStats(bare, ds, ix)));
  });
});

// ---------------------------------------------------------------------------
// 6. It travels
// ---------------------------------------------------------------------------

/** A registry with one stance row moved into another collection's key. */
function registryWith(overrides: Record<string, number>, drop: string[] = []): Registry {
  const ids: Record<string, number> = {};
  for (const [key, id] of registry.entries()) ids[key] = id;
  for (const key of drop) delete ids[key];
  for (const [key, id] of Object.entries(overrides)) ids[key] = id;
  return createRegistry({ version: REGISTRY_VERSION, ids });
}

describe('the wire', () => {
  it('writes format 8, still reads 1, 2 and 4, and skips 3, 5, 6 and 7', () => {
    expect(CODEC_VERSION).toBe(8);
    expect([...READABLE_CODEC_VERSIONS]).toEqual([1, 2, 4, 8]);
    /*
     * The arithmetic that chose 8. The version is the low nibble of byte 0, so
     * what matters is which formats a single bit flip can reach: from 5 that is
     * 4 and 1, from 6 it is 4 and 2, and 1 carries no checksum of its own.
     * `tests/adversarial.test.ts` is the file that goes red on a wrong choice.
     */
    const readable = new Set<number>(READABLE_CODEC_VERSIONS);
    for (const bit of [0, 1, 2, 3]) {
      expect(readable.has(CODEC_VERSION ^ (1 << bit)), `flipping bit ${bit}`).toBe(false);
    }
    for (const skipped of [3, 5, 6, 7]) expect(readable.has(skipped), `${skipped}`).toBe(false);
  });

  it('carries the stances and the Focus track, and back', async () => {
    const before = sheet({
      stanceRefs: ['favored', 'reliable'],
      focus: { marked: 4, max: MAX_FOCUS },
    });
    const payload = await encodeCharacter(before, registry);
    expect(payload[0]! & 0x0f).toBe(8);
    const { character, warnings } = await decodeCharacter(payload, registry);
    expect(character.stanceRefs).toEqual(['favored', 'reliable']);
    expect(character.focus).toEqual({ marked: 4, max: MAX_FOCUS });
    expect(warnings).toEqual([]);
  });

  it('keeps the order the stances were picked in', async () => {
    const before = sheet({ stanceRefs: ['reliable', 'favored', 'quick'] });
    const { character } = await decodeCharacter(await encodeCharacter(before, registry), registry);
    expect(character.stanceRefs).toEqual(['reliable', 'favored', 'quick']);
  });

  it('still decodes a format-2 QR written by the build before any of this', async () => {
    /*
     * The reason `READABLE_CODEC_VERSIONS` is a list. `wizard.codec2.b64` is
     * the bytes the format-2 build produced, committed and never regenerated -
     * the old-phone-to-new-phone hand-off this whole vector exists for.
     */
    const b64 = readFileSync('tests/fixtures/codec/wizard.codec2.b64', 'utf8').trim();
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
    expect(bytes[0]! & 0x0f).toBe(2);
    const { character } = await decodeCharacter(bytes, registry);
    // Absent before format 8, and absence means none - not a dropped field.
    expect(character.stanceRefs).toEqual([]);
    expect(character.focus).toEqual({ marked: 0, max: MAX_FOCUS });
    expect(character.name).not.toBe('');
  });

  it('is refused by name, not half-read, by a build that reads only 1, 2 and 4', async () => {
    /*
     * The refusal is the point. A schema-7 build reading these two fields off a
     * schema-8 sheet would drop both, silently - `readCharacterRecord` spreads
     * the file over a blank sheet with neither key on it.
     *
     * The old reader's set is the literal `[1, 2, 4]` this build shipped with
     * before the bump, so this states the property without needing the old
     * build: a payload this build writes is not in it.
     */
    expect([1, 2, 4]).not.toContain(CODEC_VERSION);
    const payload = await encodeCharacter(sheet({ stanceRefs: ['favored'] }), registry);
    const damaged = Uint8Array.from(payload);
    damaged[0] = (damaged[0]! & 0xf0) | 3;
    await expect(decodeCharacter(damaged, registry)).rejects.toThrow(
      /says it is format 3, and this app reads 1 and 2 and 4 and 8/,
    );
  });

  it('parks an id from the wrong collection instead of naming somebody else’s record', async () => {
    /*
     * The exact lookup, at the reading end. A stray id in the stance slot must
     * NOT come back as whatever slug it happens to name: `slugOf` would answer
     * `quick`, and a sheet that arrived naming a consumable would draw a
     * stance, with nothing anywhere saying so.
     */
    const id = registry.idIn('stances', 'quick')!;
    const receiver = registryWith({ [registryKey('consumables', 'quick')]: id }, [
      registryKey('stances', 'quick'),
    ]);
    const payload = await encodeCharacter(sheet({ stanceRefs: ['quick'] }), registry);
    const { character, unresolved, warnings } = await decodeCharacter(payload, receiver);
    expect(character.stanceRefs).toEqual([unresolvedRef(id)]);
    expect(unresolved).toContain(id);
    expect(warnings.join(' ')).not.toBe('');
    // Nothing is discarded: the id rides on to the next hop.
    expect(character.unresolvedRefs).toContain(id);
  });

  it('repairs a parked id only through the stances key, never through a bare slug', () => {
    const parked = sheet({ stanceRefs: [unresolvedRef(registry.idIn('stances', 'favored')!)] });
    expect(resolvePlaceholders(parked, registry).character.stanceRefs).toEqual(['favored']);

    // The same id, keyed as a consumable on this device: not a stance it can
    // now name, so it stays parked.
    const id = registry.idIn('stances', 'favored')!;
    const wrong = registryWith({ [registryKey('consumables', 'favored')]: id }, [
      registryKey('stances', 'favored'),
    ]);
    expect(resolvePlaceholders(parked, wrong).character.stanceRefs).toEqual([unresolvedRef(id)]);
  });

  it('tells the pre-flight the truth, asking the collection the encoder writes', async () => {
    /*
     * The exact lookup at the WRITING end. A pre-flight using `idOf` would say
     * "this fits in a QR" about a sheet `encodeCharacter` then throws on, the
     * moment a stance slug is also some other collection's.
     */
    const id = 9_500;
    const sender = registryWith({ [registryKey('consumables', 'quick')]: id }, [
      registryKey('stances', 'quick'),
    ]);
    expect(sender.idOf('quick')).toBe(id);
    expect(missingSlugs(sheet({ stanceRefs: ['quick'] }), sender)).toEqual(['quick']);
    await expect(encodeCharacter(sheet({ stanceRefs: ['quick'] }), sender)).rejects.toThrow(
      /missing from the id registry/,
    );
  });

  it('refuses a Focus track above the ceiling rather than clamping it', async () => {
    const payload = await encodeCharacter(
      sheet({ focus: { marked: 0, max: MAX_FOCUS } }),
      registry,
    );
    // Rebuilt by hand rather than mutated: the checksum has to match, so this
    // goes through the encoder with a track the type allows and the rules do not.
    const overfull = await encodeCharacter(
      { ...sheet(), focus: { marked: 0, max: MAX_FOCUS + 1 } },
      registry,
    );
    expect(payload.length).toBeGreaterThan(0);
    await expect(decodeCharacter(overfull, registry)).rejects.toThrow(
      /Focus track has a maximum of 7, and 6 is the most the rules allow/,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Findable in the search
// ---------------------------------------------------------------------------

describe('the search', () => {
  const ds = makeDataset({ stances: baseDataset.stances });
  const ix = srdIndex(ds);

  it('has a kind, a label and a place in the order', () => {
    expect(SRD_KINDS).toContain('stance');
    expect(SRD_KIND_LABELS.stance).toBe('MARTIAL STANCES');
    // `Dataset` keeps `stances` between `transformations` and `weapons`.
    expect(SRD_KINDS.indexOf('stance')).toBe(SRD_KINDS.indexOf('transformation') + 1);
    expect(SRD_KINDS.indexOf('stance')).toBe(SRD_KINDS.indexOf('weapon') - 1);
  });

  it('finds every one of the sixteen by name', () => {
    for (const s of baseDataset.stances) {
      const hits = searchSrd(ix, s.name);
      expect(hits.some((h) => h.kind === 'stance' && h.id === s.id), s.name).toBe(true);
    }
  });

  it('finds one by a word inside its rule, and quotes the line', () => {
    const hits = searchSrd(ix, 'Armor Slot to reduce damage');
    const hit = hits.find((h) => h.kind === 'stance');
    expect(hit?.id).toBe('stable');
    expect(hit?.where).toBe('text');
    expect(hit?.line).toBe('You can spend a Focus instead of an Armor Slot to reduce damage.');
  });

  it('quotes only the book, never the app furniture', () => {
    const own = new Set(baseDataset.stances.map((s) => s.text));
    for (const record of ix.filter((r) => r.kind === 'stance')) {
      for (const line of record.fields.flatMap((f) => f.lines)) {
        expect(own.has(line), `"${line}" is not one of the record's own strings`).toBe(true);
      }
      // No number is in a haystack: `TIER 2` would be the app's words.
      expect(record.haystack).not.toContain('TIER');
    }
  });

  it('stamps the folio each stance is printed on', () => {
    for (const r of ix.filter((x) => x.kind === 'stance')) expect(r.page).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// 8. The door on the sheet
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(character: Character, ds: Dataset): void {
  const ix = indexDataset(ds);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset: ds,
    index: ix,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  act(() => {
    root.render(<Edit stats={deriveStats(character, ds, ix)} onLevelUp={() => {}} />);
  });
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named2 = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim().toLowerCase().includes(text.toLowerCase()));
/**
 * A control whose whole name is its `aria-label`, which is what a ✕ is. Not
 * `named2`: the glyph is the same on every one of them, so the label is the
 * only thing that says which stance a press is about.
 */
const labelled = (label: string): HTMLButtonElement | undefined =>
  buttons().find((b) => b.getAttribute('aria-label') === label);
const press = (b: HTMLButtonElement | undefined): void => {
  expect(b, 'no such control on the sheet').toBeDefined();
  act(() => b!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};
const active = (): Character => useApp.getState().characters[0]!;

describe('adding, removing and moving Focus on the sheet', () => {
  const withStances: Dataset = makeDataset({ stances: baseDataset.stances });

  /*
   * The subclass the sheet belongs to. Every mount below carries it, because
   * without it the section is not this character's to see - which is the whole
   * of the next two checks.
   */
  const MARTIAL_ARTIST = 'martial-artist';

  it('draws no section at all on a dataset with no stances', () => {
    mount(sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST] }), makeDataset());
    expect(container.textContent).not.toContain('Martial Stances');
  });

  it('names a subclass the shipped book actually prints', () => {
    /*
     * The address `STANCE_SUBCLASS` writes down, checked against the dataset -
     * which is the condition this repo puts on writing an address in `src/` at
     * all. If a printing renames the Martial Artist, this reddens instead of
     * the section quietly never drawing again for anybody.
     */
    const sub = baseDataset.subclasses.find((x) => x.id === MARTIAL_ARTIST);
    expect(sub, `no subclass called ${MARTIAL_ARTIST} in this build`).toBeDefined();
    expect(sub!.name).toBe('Martial Artist');
    expect(sub!.classRef).toBe('brawler');
  });

  it('draws nothing at all for a character who did not take the subclass', () => {
    /*
     * THE OWNER'S DEFECT. Folio 13: "When you choose the Martial Artist
     * subclass, take the Martial Stances sheet." The gate used to be only
     * "does this book print stances", so every character on the branch got a
     * MARTIAL STANCES section and an `Add a stance` button - a wizard included.
     * That is the app promising something the book does not give them.
     */
    mount(sheet({ classRef: 'test-class', subclassRefs: ['school-of-knowledge'] }), withStances);
    expect(container.textContent).not.toContain('Martial Stances');
    expect(named2('Add a stance'), 'no way in either').toBeUndefined();
  });

  it('still shows what a non-Martial-Artist already carries, and lets them drop it', async () => {
    /*
     * The other half, and the one a hard gate would have broken. A sheet can
     * arrive carrying stances - from another device, or from a subclass chosen
     * differently - and hiding them would make them invisible AND UNDROPPABLE
     * while they went on being written to storage. So they are drawn; only the
     * picker is withheld, because seeing what you carry is not permission to
     * take more.
     *
     * THIS TEST USED TO STOP AT THE FIRST HALF, and the comment above it
     * promised the second. It did not hold. The only gesture that removed a
     * RESOLVED stance was a second tap inside the picker, and the picker is
     * exactly what this character does not get - so the sentence "hiding them
     * would make them invisible and undroppable" was describing the state the
     * code was already in for everyone it was written about. Meanwhile an
     * UNRESOLVED ref, four assertions down, had its own `Drop it` button: the
     * stance you could read was the one you could not put down.
     *
     * `GearSlot` had already learned this and written it out - "gating the
     * control on a name the build cannot read meant the only way out of the
     * state was to equip something over the top of it" - and here there was
     * nothing to equip over the top of it with.
     */
    mount(
      sheet({ classRef: 'test-class', subclassRefs: ['school-of-knowledge'], stanceRefs: ['favored'] }),
      withStances,
    );
    expect(container.textContent).toContain('Martial Stances');
    expect(container.textContent).toContain('Favored');
    expect(named2('Add a stance'), 'no picker for someone it is not for').toBeUndefined();
    expect(named2('Change stances (1)'), 'nor the other label').toBeUndefined();

    const drop = labelled('Drop Favored');
    expect(drop, 'a readable stance with no way off the sheet').toBeDefined();
    // The same 44px floor the Focus steppers and the picker rows are held to.
    expect(drop!.style.minWidth).toBe('var(--tap)');
    expect(drop!.style.minHeight).toBe('var(--tap)');

    press(drop);
    await act(async () => {
      await Promise.resolve();
    });
    expect(active().stanceRefs, 'the ✕ drew and did nothing').toEqual([]);
    expect(container.textContent, 'the section outlived what it was drawn for').not.toContain(
      'Martial Stances',
    );
  });

  it('gives a Martial Artist the same one-tap way out, beside every rule they know', async () => {
    /*
     * Not only for the gated case. The picker's second tap is two gestures deep
     * - open, then find the row again among sixteen - and it is the gesture the
     * section folds away on purpose. The ✕ sits beside the rule being read.
     */
    mount(
      sheet({
        classRef: 'test-class',
        subclassRefs: [MARTIAL_ARTIST],
        stanceRefs: ['favored', 'reliable'],
      }),
      withStances,
    );
    expect(labelled('Drop Favored'), 'no way out beside the first rule').toBeDefined();
    expect(labelled('Drop Reliable'), 'nor beside the second').toBeDefined();

    press(labelled('Drop Reliable'));
    await act(async () => {
      await Promise.resolve();
    });
    // One row, and only that row.
    expect(active().stanceRefs).toEqual(['favored']);
    expect(labelled('Drop Favored')).toBeDefined();
    expect(labelled('Drop Reliable')).toBeUndefined();
  });

  it('adds no nav entry, because the section lives on a screen that exists', () => {
    mount(sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST] }), withStances);
    expect(container.querySelector('nav')).toBeNull();
  });

  it('opens a picker of sixteen under four tier heads, every row a 44px target', () => {
    mount(sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST] }), withStances);
    press(named2('Add a stance'));
    for (const s of baseDataset.stances) expect(named2(s.name), s.name).toBeDefined();
    for (const tier of [1, 2, 3, 4]) {
      expect(container.textContent, `tier ${tier}`).toContain(`TIER ${tier}`);
    }
    // jsdom computes no layout, so this is the DECLARATION the layout engine
    // then acts on - `var(--tap)` is the 44px floor, and `Choice` sets it.
    const row = named2('Isolating')!;
    expect(row.style.minHeight).toBe('var(--tap)');
    expect(row.style.width).toBe('100%');
    expect(row.getAttribute('aria-pressed')).toBe('false');
  });

  it('dims a stance above this tier and says when it opens, without refusing it', () => {
    /*
     * Folio 13: "Mark a new stance from your tier or below each time you gain a
     * level." A level 1 character is tier 1, so `Honed` (tier 4) is not theirs
     * to mark yet - and the picker used to offer it with nothing said.
     *
     * Three separate promises here, and each is a decision:
     *   - it is SHOWN, because hiding it tells a player it does not exist;
     *   - it is DIMMED and carries the sentence, so the rule is on the glass
     *     rather than in the book they do not have open;
     *   - it is NOT DISABLED, because the tier is arithmetic and a GM who hands
     *     something over early is not a state this app may refuse to draw.
     * `GearPicker` made all three the same way for out-of-level gear.
     */
    mount(sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST], level: 1 }), withStances);
    press(named2('Add a stance'));

    const honed = named2('Honed');
    expect(honed, 'a tier 4 stance is still on the list').toBeDefined();
    expect(honed!.disabled, 'shown, not refused').toBe(false);
    expect(honed!.style.opacity, 'dimmed').toBe('0.5');
    expect(honed!.textContent).toContain('TIER 4');
    expect(honed!.textContent).toContain('MARKABLE FROM LEVEL');

    // A stance at this character's own tier carries none of it.
    const favored = named2('Favored');
    expect(favored!.style.opacity).toBe('1');
    expect(favored!.textContent).not.toContain('MARKABLE FROM LEVEL');
  });

  it('writes the refs and nothing else, and draws the rules it wrote', async () => {
    const before = sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST] });
    mount(before, withStances);
    press(named2('Add a stance'));
    press(named2('Favored'));
    // The picker stays open, because the book asks for TWO at tier 1.
    press(named2('Reliable'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(active().stanceRefs).toEqual(['favored', 'reliable']);
    // Shown, never applied: the store's own sheet has one field different.
    const after = active();
    expect({ ...after, stanceRefs: [], updatedAt: before.updatedAt }).toEqual(before);

    press(named2('Done'));
    expect(container.textContent).toContain('Gain a +1 bonus to your attack rolls.');
    expect(container.textContent).toContain('TIER 1');
  });

  it('removes one with a second tap on the row that is already on', async () => {
    mount(
      sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST], stanceRefs: ['favored'] }),
      withStances,
    );
    press(named2('Change stances'));
    expect(named2('Favored')!.getAttribute('aria-pressed')).toBe('true');
    press(named2('Favored'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(active().stanceRefs).toEqual([]);
  });

  it('moves Focus, with two 44px targets and a ceiling that holds', async () => {
    mount(sheet({ classRef: 'test-class', stanceRefs: ['favored'] }), withStances);
    const up = buttons().find((b) => b.getAttribute('aria-label') === 'Increase Focus')!;
    const down = buttons().find((b) => b.getAttribute('aria-label') === 'Decrease Focus')!;
    expect(up.style.width).toBe('var(--tap)');
    expect(up.style.minHeight).toBe('var(--tap)');
    expect(down.disabled, 'nothing to spend at zero').toBe(true);

    for (let i = 0; i < MAX_FOCUS; i += 1) press(up);
    await act(async () => {
      await Promise.resolve();
    });
    expect(active().focus).toEqual({ marked: MAX_FOCUS, max: MAX_FOCUS });
    expect(
      buttons().find((b) => b.getAttribute('aria-label') === 'Increase Focus')!.disabled,
      'the book holds you to six',
    ).toBe(true);
  });

  it('draws no Focus row for a character who knows no stance and holds none', () => {
    mount(sheet({ classRef: 'test-class', subclassRefs: [MARTIAL_ARTIST] }), withStances);
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Increase Focus')).toBe(false);
  });

  /**
   * The defect this section refuses in advance.
   *
   * A sheet that arrives by QR or file from a build with a later dataset
   * carries a ref this build cannot name. Hiding the section then leaves a
   * reference on the character with no trace of it anywhere on the glass -
   * which is exactly what a dropped weapon did until it was measured.
   */
  it('names a stance it cannot resolve, and offers the one honest thing', async () => {
    const ghost = unresolvedRef(15_999);
    mount(sheet({ classRef: 'test-class', stanceRefs: [ghost] }), makeDataset());
    expect(container.textContent).toContain('STANCE NOT IN THIS BUILD');
    expect(container.textContent).toContain(ghost);
    press(named2('Drop it'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(active().stanceRefs).toEqual([]);
  });
});
