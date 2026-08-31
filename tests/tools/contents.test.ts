/**
 * Reading the book's own table of contents.
 *
 * Every other parser selects its material by a folio written into its source -
 * `const FROM = 27` for ancestries, `APPENDIX_FROM = 119` for the domain-card
 * reference. Those are correct for ONE book. SRD 2.0 reflows 135 printed pages
 * into 224, and the failure is not always loud: `parseDomainCards` throws on an
 * adversary where the appendix should be, but a range that lands on plausible
 * material would parse the wrong pages in silence.
 *
 * The load-bearing test here is the last one, and it is the reason to trust any
 * of this: the ranges this derives from SRD 1's contents page REPRODUCE the
 * hardcoded constants exactly. A method that cannot recover the answer already
 * known is not one to point at the book nobody has parsed yet.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { folioOf, parseContents, rangeBetween } from '../../shared/parsers/contents.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

const run = (text: string): TextRun => ({
  x: 0, y: 0, w: 10, h: 10, text, family: 'QuestaSans-Light', size: 9, bold: false, italic: false,
});
const line = (...texts: string[]): Line => ({
  text: texts.join(' '), x: 0, y: 0, w: 400, size: 9, family: 'QuestaSans-Light',
  bold: false, italic: false, column: 0, runs: texts.map(run),
});
const page = (lines: Line[]): BookPage[] => [{
  index: 1, folio: 2, pdfPage: 2, side: 'single', width: 612, height: 792, columns: 2, lines, runs: lines.flatMap((l) => l.runs),
}];

describe('reading a contents page', () => {
  it('takes the folio from the line, however the extractor broke it into runs', () => {
    /*
     * Both real shapes, measured. SRD 1 gives every leader dot its own run and
     * fuses the last one to the digit; SRD 2 can put title, leaders and folio
     * in a single run. Reading "the last run is the folio" - which is what this
     * did first - lost two entries per book on the second shape.
     */
    const entries = parseContents(
      page([
        line('CONTENTS'),
        line('Classes', '.', '.', '.', '.8'),
        line('INTRODUCTION.................................................3'),
        line('Loot', '&', 'Items.......................', '75'),
      ]),
    );
    expect(entries).toEqual([
      { title: 'Classes', folio: 8 },
      { title: 'INTRODUCTION', folio: 3 },
      { title: 'Loot & Items', folio: 75 },
    ]);
  });

  it('ignores a line that does not end in a folio', () => {
    const entries = parseContents(page([line('CONTENTS'), line('Daggerheart SRD'), line('Classes', '.8')]));
    expect(entries).toEqual([{ title: 'Classes', folio: 8 }]);
  });

  it('refuses a book with no contents page rather than guessing one', () => {
    expect(() => parseContents(page([line('Classes', '.8')]))).toThrow(/no contents page/);
  });

  it('names what it has when asked for a section it has not', () => {
    // The message is the remedy: SRD 1 prints "Loot" and SRD 2 prints
    // "Loot & Items", and a caller meeting that has to see both to fix it.
    const entries = parseContents(page([line('CONTENTS'), line('Loot & Items', '75')]));
    expect(() => folioOf(entries, 'Loot')).toThrow(/contents has no entry "Loot"/);
    expect(() => folioOf(entries, 'Loot')).toThrow(/Loot & Items 75/);
  });

  it('refuses a range whose ends are in the wrong order', () => {
    const entries = parseContents(page([line('CONTENTS'), line('Later', '90'), line('Earlier', '10')]));
    expect(() => rangeBetween(entries, ['Later'], ['Earlier'])).toThrow(/does not follow/);
  });
});

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));

describe.skipIf(!have(0))('against SRD 1, whose answer is already known', () => {
  it('reproduces every hardcoded folio range in the parsers', async () => {
    /*
     * THE test. Each pair is what a parser's `FROM`/`TO` constants say today,
     * and the ranges are derived from the book instead. `loot.ts` runs to the
     * next top-level chapter rather than to the next entry, because it covers
     * Loot and Consumables together - which is exactly why `rangeBetween` takes
     * both ends by name instead of inferring the end from indentation.
     */
    const { pages } = await loadSrd({ pdfPath: BOOKS[0]!.localPaths.find(existsSync)! });
    const toc = parseContents(pages);
    const cases: [string, string, string, number, number][] = [
      ['classes.ts', 'Classes', 'Ancestries', 8, 26],
      ['ancestries.ts', 'Ancestries', 'Communities', 27, 31],
      ['communities.ts', 'Communities', 'CORE MECHANICS', 32, 34],
      ['loot.ts', 'Loot', 'RUNNING AN ADVENTURE', 58, 62],
    ];
    for (const [who, from, before, wantFrom, wantTo] of cases) {
      expect(rangeBetween(toc, [from], [before]), who).toEqual({ from: wantFrom, to: wantTo });
    }
    expect(folioOf(toc, 'APPENDIX'), 'domainCards.ts APPENDIX_FROM').toBe(119);
  }, 120_000);
});

describe.skipIf(!have(1))('against SRD 2, which nothing has parsed yet', () => {
  it('reads the chapters the wave has to reach', async () => {
    const { pages } = await loadSrd({ pdfPath: BOOKS[1]!.localPaths.find(existsSync)! });
    const toc = parseContents(pages);
    // Measured, and every one of them is a folio no constant in the tree names.
    expect(folioOf(toc, 'Classes')).toBe(8);
    expect(folioOf(toc, 'Ancestries')).toBe(32);
    expect(folioOf(toc, 'Communities')).toBe(38);
    expect(folioOf(toc, 'Transformations')).toBe(42);
    expect(folioOf(toc, 'APPENDIX')).toBe(206);
    // The rename the alias table exists for: SRD 1 prints `Loot`.
    expect(folioOf(toc, 'Loot & Items')).toBe(75);
    expect(() => folioOf(toc, 'Loot')).toThrow(/no entry/);
  }, 120_000);
});
