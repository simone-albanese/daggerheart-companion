/**
 * The Transformations chapter, and the difference between "this book has none"
 * and "I did not find the one that is there".
 *
 * SRD 1.0 has no such chapter, so `parseTransformations` must return `[]` for
 * it - and must do so for a reason that keeps working. A `try/catch` around the
 * whole parser returns `[]` for SRD 1.0 and goes on returning `[]` after the
 * parser breaks on a book that DOES print the chapter, which is the shape of
 * every silent defect this repository has paid for. So the synthetic half of
 * this file is mostly about that one distinction, and it is written against
 * hand-built pages so it runs in CI, where the manuals do not exist.
 *
 * The book-gated half asserts CONTENT, not that a result exists: the six names,
 * the twelve features, the thirty-six prompts, the folio each card is printed
 * on, and the two places where the shared line-joiner used to delete an em dash
 * out of the middle of a sentence a player reads.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { parseTransformations } from '../../shared/parsers/transformations.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

// ---------------------------------------------------------------------------
// Hand-built pages
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

/** A line built from runs, so a bold prefix can be set independently. */
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

/** A card name: 12pt Eveleth, bold - the face the six card banners use. */
const cardName = (text: string): Line =>
  runLine([run(text, { family: 'EvelethCleanThin', size: 12, bold: true })]);

/** A chapter or section head: Eveleth, NOT bold. */
const head = (text: string, size: number): Line =>
  runLine([run(text, { family: 'EvelethCleanRegular', size })]);

/** A bold sans banner, the face `TRANSFORMATION FEATURES` is set in. */
const banner = (text: string): Line =>
  runLine([run(text, { family: 'QuestaSans', size: 11.3, bold: true })]);

/** `Name: rest of the sentence`, with the name bold as the book sets it. */
const named = (name: string, rest: string): Line =>
  runLine([run(`${name}:`, { family: 'QuestaSans', bold: true }), ...rest.split(' ').map((w) => run(w))]);

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

/** One complete card, in the book's own order. */
const card = (name: string, prose: string[], features: Array<[string, string]>, questions: string[]): Line[] => [
  cardName(name),
  ...prose.map(body),
  banner('TRANSFORMATION FEATURES'),
  ...features.map(([n, t]) => named(n, t)),
  banner('TRANSFORMATION QUESTIONS'),
  ...questions.map((q) => body(`• ${q}`)),
];

/** The shape of SRD 2.0: a contents page, a shared folio 42, cards, then 46. */
const book = (cards: Line[][]): BookPage[] => [
  contents([
    ['Communities', 38],
    ['Transformations', 42],
    ['CORE MECHANICS', 46],
  ]),
  page(42, [
    cardName('WILDBORNE'),
    body('Being part of a wildborne community means you lived deep within the forest.'),
    banner('COMMUNITY FEATURE'),
    body('Lightfoot: Your movement is naturally silent.'),
    head('TRANSFORMATIONS', 17.3),
    body('Transformations represent a fundamental shift in your character.'),
    head('GRANTING TRANSFORMATIONS', 12),
    body('GMs should discuss transformations with their players.'),
  ]),
  ...cards.map((lines, i) => page(43 + i, lines)),
  page(46, [
    head('CORE MECHANICS', 28),
    cardName('PRINCIPLES'),
    body('• Be a fan of your character and their journey.'),
  ]),
];

const DEMIGOD = card(
  'DEMIGOD',
  ['Demigods are mortal creatures whose veins flow with the blood of the gods.'],
  [
    ['Gifted', 'You gain a +1 bonus to action, reaction, and damage rolls.'],
    ['Weight of Divinity', 'When you fail a roll, you must mark a Stress or the GM gains a Fear.'],
  ],
  ['Who bestowed demigod status upon you?', 'In what way did your divinity initially manifest?'],
);

// ---------------------------------------------------------------------------
// A book that does not print the chapter
// ---------------------------------------------------------------------------

describe('a book with no Transformations chapter', () => {
  it('returns an empty array rather than throwing, because that is the answer', () => {
    const pages = [contents([['Communities', 32], ['CORE MECHANICS', 35]]), page(32, [cardName('HIGHBORNE')])];
    expect(parseTransformations(pages)).toEqual([]);
  });

  it('refuses when the contents omits the chapter but the pages print a card', () => {
    /*
     * THE WHOLE LANE IN MINIATURE. A `try { ... } catch { return [] }` passes
     * the test above and fails this one silently: it would report "this book
     * has no transformations" about a book with six of them. The parser asks
     * the pages before believing the contents, and `TRANSFORMATION FEATURES`
     * is the banner no card is printed without.
     */
    const pages = [
      contents([['Communities', 32], ['CORE MECHANICS', 46]]),
      page(43, DEMIGOD),
    ];
    expect(() => parseTransformations(pages)).toThrow(/contents has no "Transformations" entry/);
    expect(() => parseTransformations(pages)).toThrow(/folios 43/);
  });
});

// ---------------------------------------------------------------------------
// The cut at both ends
// ---------------------------------------------------------------------------

describe('cutting a chapter that shares both of its end pages', () => {
  it('drops the community printed above the banner and the chapter printed after it', () => {
    /*
     * `sectionRange` returns folios 42-46 and INCLUDES 46 on purpose. Folio 42
     * carries WILDBORNE, the last community, above this chapter's banner, and
     * folio 46 opens CORE MECHANICS with PRINCIPLES set in exactly the face and
     * size a card name uses. Trimming one end only takes one of them.
     */
    const out = parseTransformations(book([DEMIGOD]));
    expect(out.map((t) => t.name)).toEqual(['Demigod']);
  });

  it('leaves the chapter prose and GRANTING TRANSFORMATIONS off every card', () => {
    // Both are set in Eveleth Regular, not the bold Thin the card names use.
    const out = parseTransformations(book([DEMIGOD]));
    expect(out[0]!.description).not.toMatch(/GMs should discuss/i);
    expect(out[0]!.description).not.toMatch(/fundamental shift/i);
    expect(out[0]!.name).toBe('Demigod');
  });

  it('refuses a block that carries two cards rather than shipping one', () => {
    // A missed banner welds the next card on, and two FEATURES banners in one
    // block is what that looks like from inside.
    const welded = [...DEMIGOD, ...DEMIGOD.slice(1)];
    expect(() => parseTransformations(book([welded]))).toThrow(/expected 1 TRANSFORMATION FEATURES/);
  });
});

// ---------------------------------------------------------------------------
// Where a feature starts
// ---------------------------------------------------------------------------

describe('splitting the features', () => {
  it('opens a feature at a bold name ending in a colon', () => {
    const out = parseTransformations(book([DEMIGOD]));
    expect(out[0]!.features).toEqual([
      { name: 'Gifted', text: 'You gain a +1 bonus to action, reaction, and damage rolls.' },
      {
        name: 'Weight of Divinity',
        text: 'When you fail a roll, you must mark a Stress or the GM gains a Fear.',
      },
    ]);
  });

  it('does not open one at a bold run that is not a name', () => {
    /*
     * Measured on the page: the book bolds its mechanical nouns inside a
     * sentence, and two of those bold runs OPEN a line - `mark a Stress` on
     * folio 45 and `mark 2 Stress` on folio 43. Bold alone would cut a feature
     * in half there; the colon is what says "this is a name".
     */
    const werewolf = card(
      'WEREWOLF',
      ['Werewolves are creatures who transform into large supernatural wolves.'],
      [],
      ['Who cursed you to become a werewolf?'],
    );
    const at = werewolf.findIndex((l) => l.text === 'TRANSFORMATION FEATURES') + 1;
    werewolf.splice(
      at,
      0,
      named('Wolf Form', 'When you mark 1 or more Hit Points, you can'),
      runLine([
        run('mark', { family: 'QuestaSans', bold: true }),
        run('a', { family: 'QuestaSans', bold: true }),
        run('Stress', { family: 'QuestaSans', bold: true }),
        run('to'),
        run('enter'),
        run('your'),
        run('Wolf'),
        run('Form.'),
      ]),
    );
    const out = parseTransformations(book([werewolf]));
    expect(out[0]!.features).toHaveLength(1);
    expect(out[0]!.features[0]!.text).toBe(
      'When you mark 1 or more Hit Points, you can mark a Stress to enter your Wolf Form.',
    );
  });
});

// ---------------------------------------------------------------------------
// The dash the shared joiner deletes
// ---------------------------------------------------------------------------

describe('a line that ends in a hyphen or a dash', () => {
  it('keeps the dash and closes the two halves up', () => {
    /*
     * `joinLines` in shared/parsers/util.ts treats U+002D and U+2010..U+2015
     * alike: a line ending in one, followed by a line starting lowercase, loses
     * the character and the two halves are welded into a word. The book is set
     * with hyphenation OFF, so the character is always real and deleting it is
     * always wrong - it fires 15 times in SRD 2.0 and 11 in SRD 1.0, and twice
     * on these four folios: `incorporealwhich` and `galapatheir`, both in card
     * prose a player reads.
     */
    const ghost = card(
      'GHOST',
      ['When a ghost becomes incorporeal—', 'which can occur at will, they might appear semitranslucent.'],
      [['Ephemeral', 'Your body wavers in and out of being corporeal.']],
      ['How did you die?'],
    );
    const out = parseTransformations(book([ghost]));
    expect(out[0]!.description).toBe(
      'When a ghost becomes incorporeal—which can occur at will, they might appear semitranslucent.',
    );
  });

  it('keeps a hyphen too, which is where the shared joiner is wrong every time', () => {
    /*
     * `joinLines` returns `onceliving` here. Every line-final hyphen measured in
     * either book breaks inside a real compound - `one-shot`, `two-handed`,
     * `piston-driven`, `long-dead`, `2-foot-deep`, `pre-scripting`,
     * `time-sensitive`, `long-term`, `tech-based`, `one-for-one` - so there is
     * no case where deleting it is right. `shared/parsers/adversaries.ts` found
     * the same thing and shadows `joinLines` with the same fix.
     */
    const ghost = card(
      'GHOST',
      ['A ghost is one of the once-', 'living who are bound to the Mortal Realm.'],
      [['Ephemeral', 'Your body wavers in and out of being corporeal.']],
      ['How did you die?'],
    );
    expect(parseTransformations(book([ghost]))[0]!.description).toBe(
      'A ghost is one of the once-living who are bound to the Mortal Realm.',
    );
  });
});

// ---------------------------------------------------------------------------
// The books
// ---------------------------------------------------------------------------

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const read = async (i: number): Promise<BookPage[]> =>
  (await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages;

describe.skipIf(!have(0))('SRD 1.0, which does not print the chapter', () => {
  it('has none, and has none on the pages either', async () => {
    const pages = await read(0);
    expect(parseTransformations(pages)).toEqual([]);
    // The other half of the claim: the parser is not hiding a chapter it failed
    // to read. No page in SRD 1.0 carries the banner a card cannot omit.
    const printed = pages.filter((p) =>
      p.lines.some((l) => /^transformation features$/i.test(l.text.trim())),
    );
    expect(printed).toEqual([]);
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0 folios 42-45', () => {
  it('reads the six cards the book prints, on the folios it prints them on', async () => {
    const out = parseTransformations(await read(1));
    expect(out.map((t) => [t.id, t.name, t.sourcePage])).toEqual([
      ['demigod', 'Demigod', 43],
      ['ghost', 'Ghost', 43],
      ['reanimated', 'Reanimated', 44],
      ['shapeshifter', 'Shapeshifter', 44],
      ['vampire', 'Vampire', 45],
      ['werewolf', 'Werewolf', 45],
    ]);
  }, 120_000);

  it('gives every card two features and six questions, twelve and thirty-six in all', async () => {
    /*
     * Counted off folios 43-45 before the parser was written, and NOT asserted
     * in `shared/types.ts`: `Transformation.features` is an array rather than a
     * two-tuple because two-per-card is what THIS printing does. So the number
     * is pinned where it can be read against the page - here - rather than in
     * a shape that would make a one-feature card in SRD 3 unparseable.
     */
    const out = parseTransformations(await read(1));
    expect(out.map((t) => t.features.length)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(out.map((t) => t.questions.length)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(out.reduce((n, t) => n + t.features.length, 0)).toBe(12);
    expect(out.reduce((n, t) => n + t.questions.length, 0)).toBe(36);
  }, 120_000);

  it('reads the first card whole, against the printed page', async () => {
    const demigod = parseTransformations(await read(1)).find((t) => t.id === 'demigod');
    expect(demigod!.features).toEqual([
      { name: 'Gifted', text: 'You gain a +1 bonus to action, reaction, and damage rolls.' },
      {
        name: 'Weight of Divinity',
        text: 'When you fail a roll, you must mark a Stress or the GM gains a Fear.',
      },
    ]);
    expect(demigod!.description).toMatch(/^Demigods are mortal creatures whose veins flow with the blood of the gods\./);
    expect(demigod!.description).toMatch(/costly to live up to\.$/);
    expect(demigod!.questions[0]).toBe(
      'Your divinity has affected an aspect of your appearance. In what way do you look different from others?',
    );
    expect(demigod!.questions[5]).toBe(
      'In what way did your divinity initially manifest? Why did it surprise you?',
    );
  }, 120_000);

  it('keeps the two em dashes the shared joiner used to eat', async () => {
    const out = parseTransformations(await read(1));
    expect(out.find((t) => t.id === 'ghost')!.description).toContain('becomes incorporeal—which can occur at will');
    expect(out.find((t) => t.id === 'shapeshifter')!.description).toContain('tough galapa—their experiences');
  }, 120_000);

  it('takes no bullet but U+2022, because that is the only one on these folios', async () => {
    /*
     * SRD 2.0 opens option lists inside a card with U+25E6, which
     * `joinWithBullets` does not know and which cost 41 records in the domain
     * card appendix. 172 line-initial rings in this book; NONE on folios 42-45.
     * Checked rather than assumed, and checked here so it stays checked.
     */
    const pages = await read(1);
    const rings = pages
      .filter((p) => p.folio !== null && p.folio >= 42 && p.folio <= 45)
      .flatMap((p) => p.lines.filter((l) => l.text.trim().startsWith('◦')));
    expect(rings).toEqual([]);
    const out = parseTransformations(pages);
    for (const t of out) {
      for (const q of t.questions) expect(q.startsWith('•') || q.startsWith('◦')).toBe(false);
    }
  }, 120_000);

  it('leaves the chapter prose in rules, where it belongs, and off the cards', async () => {
    // Folio 42's GM prose - including GRANTING TRANSFORMATIONS - is not a card.
    const out = parseTransformations(await read(1));
    for (const t of out) {
      expect(t.description).not.toMatch(/GMs should discuss transformations/i);
      expect(t.description).not.toMatch(/do not count toward your loadout maximum/i);
      expect(t.name).not.toMatch(/GRANTING/i);
    }
  }, 120_000);
});
