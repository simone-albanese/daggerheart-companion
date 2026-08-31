/**
 * A domain card whose title does not fit on one line.
 *
 * The appendix parser took the title to be the single line above the
 * `Level N ...` / `Recall Cost: N` pair. SRD 2.0 sets narrower columns and
 * `SUMMON HORROR` breaks over two, which would not have crashed: it would have
 * produced a card named `HORROR`, slugged `horror`, on a record the search
 * indexes and every saved loadout refers to by that slug.
 *
 * Built from synthetic pages rather than from either book, so it runs where the
 * PDFs do not exist - which is CI, and CI is where a regression would otherwise
 * arrive unannounced.
 */
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { parseDomainCards } from '../../shared/parsers/domainCards.ts';

let y = 0;
const at = (text: string, family: string, size: number, bold: boolean): Line => {
  y += 12;
  const run: TextRun = { x: 40, y, w: 200, h: 10, text, family, size, bold, italic: false };
  return { text, x: 40, y, w: 200, size, family, bold, italic: false, column: 0, runs: [run] };
};
const banner = (t: string): Line => at(t, 'EvelethCleanRegular', 14, true);
const title = (t: string): Line => at(t, 'QuestaSans-Medium', 11, true);
const body = (t: string): Line => at(t, 'QuestaSans-Light', 9, false);

const book = (lines: Line[]): BookPage[] => [
  // A contents page, because the parser now asks the book where its appendix is.
  {
    index: 0, folio: 2, pdfPage: 1, side: 'single', width: 612, height: 792, columns: 1,
    lines: [at('CONTENTS', 'QuestaSans-Light', 9, false), at('Domain Card Reference 9', 'QuestaSans-Light', 9, false)],
    runs: [],
  },
  { index: 1, folio: 9, pdfPage: 2, side: 'single', width: 612, height: 792, columns: 1, lines, runs: [] },
];

const card = (titleLines: string[], level: string): Line[] => [
  ...titleLines.map(title),
  body(level),
  body('Recall Cost: 2'),
  body('Some rules text that the card needs in order to exist at all.'),
];

describe('a card title that breaks over two lines', () => {
  it('keeps the whole name, instead of the last line of it', () => {
    const cards = parseDomainCards(
      book([
        banner('ARCANA DOMAIN'),
        ...card(['SUMMON', 'HORROR'], 'Level 4 Arcana Spell'),
      ]),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]!.name).toBe('Summon Horror');
    // The half that matters beyond the display name: everything downstream
    // refers to this card by slug.
    expect(cards[0]!.id).toBe('summon-horror');
  });

  it('still reads a one-line title exactly as before', () => {
    const cards = parseDomainCards(
      book([banner('ARCANA DOMAIN'), ...card(['RUNE WARD'], 'Level 1 Arcana Spell')]),
    );
    expect(cards[0]!.name).toBe('Rune Ward');
    expect(cards[0]!.id).toBe('rune-ward');
  });

  it('accounts for every title-face line, so none is quietly swallowed', () => {
    /*
     * The guarantee the count check exists for. A title-face line that belongs
     * to no card means a card was lost into the one above it, and the old check
     * caught that by assuming one line per title - which is what a two-line
     * title broke. Counting ownership instead keeps the guarantee.
     */
    expect(() =>
      parseDomainCards(
        book([
          banner('ARCANA DOMAIN'),
          ...card(['RUNE WARD'], 'Level 1 Arcana Spell'),
          title('ORPHANED TITLE'),
          body('with no level line under it at all'),
        ]),
      ),
    ).toThrow(/title lines but/);
  });
});
