/**
 * The anchor `beastformSection` looks for and no test asked it to find.
 *
 * Every parser in this directory now takes its range from something the book
 * prints rather than from a folio constant, and each of those lookups ends in a
 * throw: a parser that cannot find its anchor must say so, because the
 * alternative is a range that lands on plausible material and a dataset that is
 * quietly the wrong size.
 *
 * Counted on this tree rather than assumed, and the count is not the one the
 * handoff carries. `beastformSection` has FOUR such throws, not three:
 *
 *   1. no "BEASTFORM OPTIONS" banner in the Classes chapter   held
 *   2. no TIER banner in the Beastform section                NOTHING HELD IT
 *   3. unexpected banner between the anchor and its first tier held
 *   4. the Beastform section has no closing banner            held
 *
 * Held, there, means `tests/tools/beastforms.test.ts` builds a synthetic book
 * that reaches the throw - 1, 3 and 4 each have one. The second has none, in a
 * file whose other five cases are hermetic, which is how a gap this narrow
 * survives: the shape that reaches it is a section that opens and closes
 * normally and simply never says TIER.
 *
 * `readBands` in `equipment.ts` has two anchor throws and BOTH are already
 * held hermetically - "stops the build when the header row changed shape" and
 * "refuses a range that is prose all the way down". Verified by mutation, not
 * by reading: deleting either throw turns exactly that test red with the
 * manuals hidden. Nothing was added for them.
 *
 * This file is hermetic: it builds pages, never a PDF.
 */
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { beastformSection, parseBeastforms } from '../../shared/parsers/beastforms.ts';

const DISPLAY = 'EvelethCleanRegular';
const TITLE = 'QuestaSans';
const BODY = 'QuestaSans-Light';

const run = (text: string, family: string, bold: boolean, italic: boolean): TextRun => ({
  x: 0, y: 0, w: 10, h: 10, text, family, size: 9, bold, italic,
});

const mk = (text: string, family: string, size: number, runs?: TextRun[]): Line => ({
  text, x: 0, y: 0, w: 400, size, family,
  bold: family === TITLE, italic: false, column: 0,
  runs: runs ?? [run(text, family, family === TITLE, false)],
});

const display = (text: string): Line => mk(text, DISPLAY, 12);
const cardTitle = (text: string): Line => mk(text, TITLE, 11.3);
const body = (text: string): Line => mk(text, BODY, 9.3);
const feature = (name: string, rest: string): Line =>
  mk(`${name}: ${rest}`, BODY, 9.3, [
    run(`${name}:`, BODY, true, true),
    run(rest, BODY, false, false),
  ]);

const page = (folio: number, lines: Line[]): BookPage => ({
  index: folio, folio, pdfPage: folio, side: 'single', width: 612, height: 792,
  columns: 2, lines, runs: lines.flatMap((l) => l.runs),
});

const contents = (): BookPage =>
  page(2, [
    mk('CONTENTS', DISPLAY, 17),
    mk('Classes 8', BODY, 9, [
      run('Classes', BODY, false, false),
      run('8', BODY, false, false),
    ]),
    mk('Ancestries 32', BODY, 9, [
      run('Ancestries', BODY, false, false),
      run('32', BODY, false, false),
    ]),
  ]);

const card = (name: string): Line[] => [
  cardTitle(name),
  body('(Fox, Mouse, Weasel, etc.)'),
  body('Agility +1 | Evasion +2'),
  body('Melee Agility d4 phy'),
  body('Gain advantage on: sneak'),
  feature('Agile', 'Your movement is silent.'),
];

describe('the tier banner that opens the Beastform cards', () => {
  it('is found when the book prints it, so the refusal below is about its absence', () => {
    // The control. Same section, same closing banner, one extra line.
    const pages = [
      contents(),
      page(15, [
        display('BEASTFORM OPTIONS'),
        body('When you take this feature, choose a form from the list.'),
        display('TIER 1'),
        ...card('AGILE SCOUT'),
      ]),
      page(19, [display('GUARDIAN')]),
    ];
    expect(beastformSection(pages)).toMatchObject({ from: 15, to: 15 });
    expect(parseBeastforms(pages).map((b) => b.name)).toEqual(['Agile Scout']);
  });

  it('refuses a section that never says TIER, instead of reading from the banner', () => {
    /*
     * The shape: the anchor is printed, a closing banner is printed, and
     * between them the book sets prose and something card-shaped but no tier
     * heading. `start` is then -1, and every quiet way of handling that -
     * falling back to the anchor, to zero, to `banner + 1` - hands the section
     * a run of lines that begins with prose and yields cards with no tier.
     *
     * The throw is the whole behaviour: it is a range that could not be
     * resolved saying so, rather than a range that resolved to the wrong thing.
     */
    const pages = [
      contents(),
      page(15, [
        display('BEASTFORM OPTIONS'),
        body('When you take this feature, choose a form from the list.'),
        ...card('AGILE SCOUT'),
      ]),
      page(19, [display('GUARDIAN')]),
    ];
    expect(() => beastformSection(pages)).toThrow(/no TIER banner in the Beastform section/);
    expect(() => parseBeastforms(pages)).toThrow(/no TIER banner in the Beastform section/);
  });
});
