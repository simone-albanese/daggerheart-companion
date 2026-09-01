/**
 * Where the Beastform section is, on a book that does not index it.
 *
 * `beastforms.ts` used to carry `FOLIO_FROM = 12` / `FOLIO_TO = 15`. Those are
 * right for SRD 1.0 and point into the Guardian on SRD 2.0, where the same
 * cards are printed on folios 15-18. Every other parser now takes its range
 * from the contents page - but BEASTFORM OPTIONS has no contents entry in
 * either book, so this one takes it from an anchor printed on the page.
 *
 * The load-bearing test is the last one: the anchor resolves to 12-15 on SRD 1,
 * which is exactly what the two deleted constants said, and to 15-18 on SRD 2,
 * where the 22 records it yields are equal field for field to SRD 1's apart
 * from `sourcePage`. A method that cannot recover the answer already known is
 * not one to trust on the book nobody has parsed yet.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import type { Beastform } from '../../shared/types.ts';
import { beastformSection, parseBeastforms } from '../../shared/parsers/beastforms.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

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
/** A feature opens with its name in bold italic, closed by a colon. */
const feature = (name: string, rest: string): Line =>
  mk(`${name}: ${rest}`, BODY, 9.3, [run(`${name}:`, BODY, true, true), run(rest, BODY, false, false)]);

const page = (folio: number, lines: Line[]): BookPage => ({
  index: folio, folio, pdfPage: folio, side: 'single', width: 612, height: 792,
  columns: 2, lines, runs: lines.flatMap((l) => l.runs),
});

/** A contents page the parser can find `Classes` and its successor in. */
const contents = (classes: number, ancestries: number): BookPage =>
  page(2, [
    mk('CONTENTS', DISPLAY, 17),
    mk(`Classes ${classes}`, BODY, 9, [run('Classes', BODY, false, false), run(String(classes), BODY, false, false)]),
    mk(`Ancestries ${ancestries}`, BODY, 9, [run('Ancestries', BODY, false, false), run(String(ancestries), BODY, false, false)]),
  ]);

/** One complete card, the shape both books print. */
const card = (name: string): Line[] => [
  cardTitle(name),
  body('(Fox, Mouse, Weasel, etc.)'),
  body('Agility +1 | Evasion +2'),
  body('Melee Agility d4 phy'),
  body('Gain advantage on: sneak'),
  feature('Agile', 'Your movement is silent.'),
];

describe('finding the Beastform section without a contents entry', () => {
  it('resolves the range from the anchor the book prints, not from a folio', () => {
    /*
     * The folios here are SRD 2's, and nothing in the parser names them. The
     * same fixture at 12-15 would pass identically; that is the point.
     */
    const pages = [
      contents(8, 32),
      page(15, [display('BEASTFORM OPTIONS'), body('When you use your "Beastform" feature...'), display('TIER 1'), ...card('AGILE SCOUT')]),
      page(18, [display('TIER 4'), ...card('TERRIBLE LIZARD')]),
      page(19, [display('GUARDIAN'), body("A guardian's hope feature...")]),
    ];
    expect(beastformSection(pages)).toMatchObject({ from: 15, to: 18 });
    expect(parseBeastforms(pages).map((b) => [b.name, b.tier, b.sourcePage])).toEqual([
      ['Agile Scout', 1, 15],
      ['Terrible Lizard', 4, 18],
    ]);
  });

  it('reads the anchor inside its chapter, so the same words elsewhere are not it', () => {
    // Folio 40 is past `Ancestries`, so this banner is out of the chapter.
    const pages = [
      contents(8, 32),
      page(40, [display('BEASTFORM OPTIONS'), display('TIER 1'), ...card('AGILE SCOUT'), display('GUARDIAN')]),
    ];
    expect(() => parseBeastforms(pages)).toThrow(/no "BEASTFORM OPTIONS" banner in the Classes chapter/);
  });

  it('keeps the section prose out of the cards by starting at the first tier', () => {
    // The paragraph under the banner explains the columns; it is not a card,
    // and the first `TIER n` is what says the cards have begun.
    const pages = [
      contents(8, 32),
      page(15, [display('BEASTFORM OPTIONS'), body('Beastform categories are divided by tier.'), display('TIER 1'), ...card('AGILE SCOUT')]),
      page(19, [display('GUARDIAN')]),
    ];
    expect(parseBeastforms(pages)).toHaveLength(1);
    expect(parseBeastforms(pages)[0]!.features).toEqual([
      { name: 'Agile', text: 'Your movement is silent.' },
    ]);
  });

  it('refuses a banner between the anchor and the first tier rather than skipping it', () => {
    // A sub-section this does not know about would lose every card under it,
    // and lose them silently: `start` would simply find the next TIER.
    const pages = [
      contents(8, 32),
      page(15, [display('BEASTFORM OPTIONS'), display('EVOLVED FORMS'), ...card('LEGENDARY BEAST'), display('TIER 1'), ...card('AGILE SCOUT')]),
      page(19, [display('GUARDIAN')]),
    ];
    expect(() => parseBeastforms(pages)).toThrow(/unexpected banner between "BEASTFORM OPTIONS" and its first tier/);
  });

  it('refuses to read to the end of the chapter when no banner closes the section', () => {
    const pages = [
      contents(8, 32),
      page(15, [display('BEASTFORM OPTIONS'), display('TIER 1'), ...card('AGILE SCOUT')]),
    ];
    expect(() => parseBeastforms(pages)).toThrow(/no closing banner/);
  });

  it('does not let a tier banner close the section', () => {
    // Every tier after the first is a display banner too. Cutting at the first
    // one would keep Tier 1 and drop the other three tiers.
    const pages = [
      contents(8, 32),
      page(15, [display('BEASTFORM OPTIONS'), display('TIER 1'), ...card('AGILE SCOUT'), display('TIER 2'), ...card('ARMORED SENTRY')]),
      page(19, [display('GUARDIAN')]),
    ];
    expect(parseBeastforms(pages).map((b) => b.tier)).toEqual([1, 2]);
  });
});

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const load = async (i: number): Promise<BookPage[]> =>
  (await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages;

describe.skipIf(!have(0))('against SRD 1, whose answer is already known', () => {
  it('reproduces the folio range the two deleted constants stated', async () => {
    const pages = await load(0);
    expect(beastformSection(pages)).toMatchObject({ from: 12, to: 15 });
    const out = parseBeastforms(pages);
    expect(out).toHaveLength(22);
    expect(out[0]!.name).toBe('Agile Scout');
    expect(out[21]!.name).toBe('Mythic Hybrid');
    // LEGENDARY BEAST and MYTHIC BEAST are upgrade templates, not creatures.
    expect(out.map((b) => b.name)).not.toContain('Legendary Beast');
  }, 120_000);
});

describe.skipIf(!have(1))('against SRD 2, which nothing had parsed', () => {
  it('finds the same cards four folios later, printed word for word', async () => {
    const pages = await load(1);
    expect(beastformSection(pages)).toMatchObject({ from: 15, to: 18 });
    const out = parseBeastforms(pages);
    expect(out).toHaveLength(22);
    expect(out.map((b) => b.name)).toEqual([
      'Agile Scout', 'Household Friend', 'Nimble Grazer', 'Pack Predator', 'Aquatic Scout',
      'Stalking Arachnid', 'Armored Sentry', 'Powerful Beast', 'Mighty Strider',
      'Striking Serpent', 'Pouncing Predator', 'Winged Beast', 'Great Predator',
      'Mighty Lizard', 'Great Winged Beast', 'Aquatic Predator', 'Legendary Hybrid',
      'Massive Behemoth', 'Terrible Lizard', 'Mythic Aerial Hunter', 'Epic Aquatic Beast',
      'Mythic Hybrid',
    ]);
    expect(out.map((b) => b.sourcePage)).toEqual([
      15, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18,
    ]);
  }, 120_000);

  it.skipIf(!have(0))('prints the same 22 records SRD 1 does, page number aside', async () => {
    /*
     * Measured, and the reason this lane needed no new parsing: the section is
     * identical between the books down to the book's own typo ("rough terain"),
     * and differs only in where the lines wrap - which `joinLines` undoes.
     */
    const strip = (b: Beastform): Omit<Beastform, 'sourcePage'> => {
      const { sourcePage: _drop, ...rest } = b;
      return rest;
    };
    const one = parseBeastforms(await load(0)).map(strip);
    const two = parseBeastforms(await load(1)).map(strip);
    expect(two).toEqual(one);
  }, 120_000);
});
