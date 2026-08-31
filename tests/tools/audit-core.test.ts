/**
 * Two things SRD 2.0 does that parse green and read wrong.
 *
 * Both were found by printing the RECORDS rather than the counts. The counts
 * were right in each case - 13 classes, 26 subclasses, 210 domain cards, no
 * exception thrown - and the records were not.
 *
 * 1. A MULTI-COLUMN BOX INSIDE A COLUMN. `Line.column` is numbered per region,
 *    not per page, so the three sub-columns of folio 26's SPHERE OF INFLUENCE
 *    EXAMPLES box start again at 0 and collide with the page's own left column.
 *    Ordering the page by that index threaded eight one-word lines of the box
 *    through the left column: six landed inside the Warlock's description
 *    ("...in exchange for incredible Gamblers power...") and two became a
 *    fourth Sorcerer connection question, "Ambition Artists".
 *
 * 2. A SECOND BULLET GLYPH. SRD 1.0 opens every list with U+2022. SRD 2.0
 *    keeps U+2022 for question lists and opens the option lists inside a
 *    feature or a card with U+25E6, a hollow ring - 172 lines of it, none in
 *    SRD 1.0. An unrecognised bullet is not an error anywhere: in the class
 *    chapter the options folded into one running line, and in the appendix each
 *    became its own paragraph carrying the raw glyph.
 *
 * Both halves are book-gated: the manuals are the owner's and are not in the
 * repository, so these skip in CI exactly as the other parser tests do.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClasses } from '../../shared/parsers/classes.ts';
import { parseDomainCards } from '../../shared/parsers/domainCards.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';
import type { BookPage } from '../../shared/textLayout.ts';

const SRD2 = 1;
const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const pages = async (i: number): Promise<BookPage[]> =>
  (await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages;

/** U+25E6 WHITE BULLET, the glyph SRD 2.0 added. */
const RING = '◦';

describe.skipIf(!have(SRD2))('SRD 2.0 folio 26, where a box sits inside a column', () => {
  it('keeps the sphere-of-influence list out of the Warlock description', async () => {
    /*
     * The six words that leaked were Chaos, Darkness, Death, Gamblers, Honor
     * and Justice - the first sub-column of the box, whose lines claim
     * `column 0` at x=313 while the page's real left column claims it at x=57.
     * Asserting the description's exact ends is what catches that: any word
     * spliced in mid-paragraph moves neither end, so the length is asserted too.
     */
    const { classes } = parseClasses(await pages(SRD2));
    const warlock = classes.find((c) => c.id === 'warlock');
    expect(warlock).toBeDefined();
    expect(warlock!.description.startsWith('Those who’ve traded their lives—or perhaps')).toBe(true);
    expect(warlock!.description.endsWith('something else is pulling their strings.')).toBe(true);
    // Measured: 909 clean, 953 with the six words spliced in.
    expect(warlock!.description).toHaveLength(909);
  }, 120_000);

  it('gives the Sorcerer three connection questions, not four', async () => {
    // The fourth was "Ambition Artists" - the two box lines that happened to
    // sit above the WARLOCK banner, and so fell inside the previous class.
    const { classes } = parseClasses(await pages(SRD2));
    const sorcerer = classes.find((c) => c.id === 'sorcerer');
    expect(sorcerer).toBeDefined();
    expect(sorcerer!.connectionQuestions).toHaveLength(3);
    for (const q of sorcerer!.connectionQuestions) expect(q.endsWith('?')).toBe(true);
  }, 120_000);
});

describe.skipIf(!have(SRD2))("SRD 2.0's second bullet", () => {
  it('turns a feature’s ring-bulleted options into one `- ` item each', async () => {
    /*
     * Warden of the Elements' Elemental Incarnation is the widest case: four
     * options on one card. Unrecognised, they came back as a single line -
     * "...benefit:\n◦ Fire: ... ◦ Earth: ... ◦ Water: ... ◦ Air: ...".
     */
    const { subclasses } = parseClasses(await pages(SRD2));
    const warden = subclasses.find((s) => s.id === 'warden-of-the-elements');
    expect(warden).toBeDefined();
    const mastery = warden!.masteryFeatures[0];
    expect(mastery).toBeDefined();
    const items = mastery!.text.split('\n').filter((l) => l.startsWith('- '));
    expect(items.map((l) => l.slice(2, l.indexOf(':')))).toEqual(['Fire', 'Earth', 'Water', 'Air']);
  }, 120_000);

  it('leaves no ring glyph in any class, subclass or domain card text', async () => {
    const p = await pages(SRD2);
    const { classes, subclasses } = parseClasses(p);
    const texts = [
      ...classes.flatMap((c) => [c.description, c.hopeFeature.text, ...c.classFeatures.map((f) => f.text), ...c.backgroundQuestions, ...c.connectionQuestions]),
      ...subclasses.flatMap((s) => [...s.foundationFeatures, ...s.specializationFeatures, ...s.masteryFeatures].map((f) => f.text)),
      ...parseDomainCards(p).map((c) => c.text),
    ];
    expect(texts.filter((t) => t.includes(RING))).toEqual([]);
  }, 120_000);

  it('makes a card’s options `- ` items in one paragraph, as SRD 1.0 does', async () => {
    /*
     * Blade-Touched prints two options. With the ring unrecognised each was a
     * PARAGRAPH of its own carrying the glyph, so the same card had a different
     * shape in the two books - which is the thing a second source must not do.
     */
    const card = parseDomainCards(await pages(SRD2)).find((c) => c.id === 'blade-touched');
    expect(card).toBeDefined();
    expect(card!.text).toBe(
      'When 4 or more of the domain cards in your loadout are from the Blade domain, gain the following benefits:\n' +
        '- +2 bonus to your attack rolls\n' +
        '- +4 bonus to your Severe damage threshold',
    );
  }, 120_000);
});
