/**
 * U+25E6, the second bullet, on a runner with no PDF.
 *
 * SRD 1.0 opens every list with U+2022. SRD 2.0 keeps U+2022 for the question
 * lists and opens the option list inside a feature or a card with U+25E6, a
 * hollow ring: 172 line-initial rings across the book, none at all in SRD 1.0.
 *
 * Nothing threw. An unrecognised bullet neither starts a list item nor breaks a
 * paragraph, so the list simply stopped being a list - 41 records shipped with
 * their options run together or blown apart, in two parsers, and every gate in
 * the repository stayed green. That is the exact failure this project keeps
 * paying for: wrong output, exit 0.
 *
 * Both folds are guarded today, and until this file both guards were guarded
 * only by `audit-core.test.ts`, whose five tests read the PDF and therefore
 * skip on every CI run. Measured with `Manuali/` moved aside: reverting either
 * fold leaves `npx vitest run tests/tools` at "127 passed | 68 skipped".
 *
 * The two parsers fail in OPPOSITE directions, which is why both are here:
 *
 *   classes.ts      the ring lines fold INTO the sentence above them, because
 *                   the leading between two bullets is under the paragraph
 *                   threshold. One run-on line.
 *   domainCards.ts  the ring lines break AWAY into paragraphs of their own,
 *                   because the leading between two bullets is over that
 *                   parser's threshold and only a recognised bullet suppresses
 *                   the break. Blank lines and a stray glyph.
 *
 * Neither is an error, and neither looks like one in a diff of counts.
 */
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { parseClasses } from '../../shared/parsers/classes.ts';
import { parseDomainCards } from '../../shared/parsers/domainCards.ts';

/** The book's own glyph, by codepoint, so no editor can normalise it away. */
const RING = '◦';
const DOT = '•';

let y = 0;

interface Bit {
  text: string;
  family?: string;
  size?: number;
  bold?: boolean;
  x?: number;
}

/** One line, optionally built from several runs so a bold lead-in is readable. */
const line = (...bits: Bit[]): Line => {
  y += 12;
  let x = bits[0]?.x ?? 60;
  const runs: TextRun[] = bits.map((b) => {
    const family = b.family ?? 'QuestaSans-Light';
    const size = b.size ?? 9.3;
    const w = b.text.length * 4;
    const run: TextRun = {
      x, y, w, h: 10, text: b.text, family, size, bold: b.bold ?? false, italic: false,
    };
    x += w + 4;
    return run;
  });
  const text = runs.map((r) => r.text).join(runs.length > 1 ? ' ' : '');
  return {
    text,
    x: runs[0]!.x,
    y,
    w: x - runs[0]!.x,
    size: Math.max(...runs.map((r) => r.size)),
    family: runs[0]!.family,
    bold: runs.every((r) => r.bold),
    italic: false,
    column: 0,
    runs,
  };
};

const page = (folio: number, lines: Line[]): BookPage => ({
  index: folio, folio, pdfPage: folio, side: 'single', width: 612, height: 792,
  columns: 1, lines, runs: lines.flatMap((l) => l.runs),
});

const entry = (title: string, folio: number): Line => {
  const l = line({ text: `${title} . . . ${folio}` });
  l.runs = [
    { ...l.runs[0]!, text: title },
    { ...l.runs[0]!, text: '. . .' },
    { ...l.runs[0]!, text: String(folio) },
  ];
  return l;
};

const contents = (...entries: Array<[string, number]>): BookPage =>
  page(1, [
    line({ text: 'CONTENTS', family: 'EvelethCleanRegular', size: 17 }),
    ...entries.map(([t, f]) => entry(t, f)),
  ]);

// ---------------------------------------------------------------------------
// classes.ts - where the ring folds a list into the sentence above it
// ---------------------------------------------------------------------------

/** An Eveleth display line: a class title or a subclass banner. */
const display = (text: string): Line => line({ text, family: 'EvelethCleanRegular', size: 14 });
/** A bold sans heading above 10.5pt: the section labels inside a class. */
const sectionHeading = (text: string): Line =>
  line({ text, family: 'QuestaSans-Medium', size: 11.3, bold: true });
/** A named feature: a bold lead-in ending in a colon, then ordinary body. */
const feature = (label: string, rest: string): Line =>
  line({ text: label, family: 'QuestaSans-Medium', bold: true }, { text: rest });
const body = (text: string): Line => line({ text });

/**
 * The option list the ring opens, verbatim in shape from SRD 2.0's class
 * chapter ("◦ Fire: When an adversary within Melee range deals damage to
 * you...").
 */
const RING_OPTIONS = [
  `${RING} Fire: Deal 1d6 magic damage to the adversary.`,
  `${RING} Earth: Gain a +1 bonus to your Armor Score.`,
];

const subclass = (name: string, trait: string): Line[] => [
  display(name),
  sectionHeading('SPELLCAST TRAIT'),
  body(trait),
  sectionHeading('FOUNDATION FEATURES'),
  feature('Elemental Attunement:', 'Once per rest, choose one of the following:'),
  ...RING_OPTIONS.map(body),
  sectionHeading('SPECIALIZATION FEATURES'),
  feature('Deeper Attunement:', 'The bonus above increases by one.'),
  sectionHeading('MASTERY FEATURES'),
  feature('Perfect Attunement:', 'You may choose both options at once.'),
];

const classChapter = (): BookPage[] => {
  y = 0;
  return [
    contents(['Classes', 2], ['Domains', 4]),
    page(2, [
      display('BARD'),
      body('Bards are the most charismatic people in all the realms.'),
      body('DOMAINS - Codex & Grace'),
      body('STARTING EVASION - 10'),
      body('STARTING HIT POINTS - 5'),
      body('CLASS ITEMS - A romance novel or a lute'),
      sectionHeading('BARD’S HOPE FEATURE'),
      feature('Make a Scene:', 'Spend 3 Hope to temporarily Distract a target.'),
      sectionHeading('CLASS FEATURES'),
      feature('Rally:', 'Once per session, describe how you rally the party.'),
      display('BARD SUBCLASSES'),
      body('Choose either the Troubadour or the Wordsmith subclass.'),
      ...subclass('TROUBADOUR', 'Presence'),
      ...subclass('WORDSMITH', 'Presence'),
      // The class's closing questions sit at the foot of the second subclass,
      // and they are set with U+2022 in BOTH books.
      sectionHeading('BACKGROUND QUESTIONS'),
      body(`${DOT} Who from your community taught you to perform?`),
      sectionHeading('CONNECTIONS'),
      body(`${DOT} What made you realise we were going to be friends?`),
    ]),
  ];
};

describe('a class feature whose options the book opens with a ring', () => {
  it('prints the ring, so the assertion below cannot pass by its absence', () => {
    const printed = classChapter().flatMap((p) => p.lines.map((l) => l.text)).join('\n');
    expect(printed.split(RING)).toHaveLength(RING_OPTIONS.length * 2 + 1);
  });

  it('makes each ring line its own `- ` item, exactly as U+2022 would', () => {
    /*
     * The failure this replaces: with the ring unknown, neither branch of
     * `bodyText` fires - the line is not a bullet, and bullet-to-bullet leading
     * is below `PARAGRAPH_LEADING` - so all three lines join into one running
     * sentence. Seventeen SRD 2.0 class and subclass features shipped that way,
     * and no count changed.
     */
    const { subclasses } = parseClasses(classChapter());
    const foundation = subclasses[0]!.foundationFeatures[0]!;
    expect(foundation.name).toBe('Elemental Attunement');
    expect(foundation.text).toBe(
      [
        'Once per rest, choose one of the following:',
        '- Fire: Deal 1d6 magic damage to the adversary.',
        '- Earth: Gain a +1 bonus to your Armor Score.',
      ].join('\n'),
    );
    expect(foundation.text).not.toContain(RING);
  });

  it('leaves no ring anywhere in a class or subclass record', () => {
    const { classes, subclasses } = parseClasses(classChapter());
    expect(JSON.stringify([...classes, ...subclasses])).not.toContain(RING);
  });

  it('still reads a U+2022 list, which both books set for the questions', () => {
    const { classes } = parseClasses(classChapter());
    expect(classes[0]!.backgroundQuestions).toEqual([
      'Who from your community taught you to perform?',
    ]);
    expect(classes[0]!.connectionQuestions).toEqual([
      'What made you realise we were going to be friends?',
    ]);
  });
});

// ---------------------------------------------------------------------------
// domainCards.ts - where the ring blows the same list apart instead
// ---------------------------------------------------------------------------

const cardTitle = (text: string): Line =>
  line({ text, family: 'QuestaSans-Medium', size: 11, bold: true });

const cardPages = (): BookPage[] => {
  y = 0;
  return [
    contents(['Domain Card Reference', 3]),
    page(3, [
      line({ text: 'ARCANA DOMAIN', family: 'EvelethCleanRegular', size: 14, bold: true }),
      cardTitle('RUNE WARD'),
      body('Level 1 Arcana Spell'),
      body('Recall Cost: 0'),
      body('While Rune Ward is active, you gain the following benefits:'),
      body(`${RING} +1 bonus to your Spellcast Rolls.`),
      body(`${RING} Once per rest, reroll a damage die.`),
    ]),
  ];
};

describe('a domain card whose options the book opens with a ring', () => {
  it('prints the ring, so the assertion below cannot pass by its absence', () => {
    const printed = cardPages().flatMap((p) => p.lines.map((l) => l.text)).join('\n');
    expect(printed.split(RING)).toHaveLength(3);
  });

  it('keeps the options in one paragraph as `- ` items, not as three paragraphs', () => {
    /*
     * The other direction of the same bug. Here the ring lines sit 12pt apart,
     * over this parser's 11.5pt `PARAGRAPH_GAP`, and only a RECOGNISED bullet
     * suppresses the break - so an unknown one turned every option into its own
     * paragraph. All twenty-four SRD 2.0 cards with options shipped
     * "...benefits:\n\n◦ +1 bonus...\n\n◦ Once per rest..." where SRD 1.0 ships
     * "...benefits:\n- +1 bonus...". The two books disagreed about the shape of
     * the same card, and nothing threw.
     */
    const cards = parseDomainCards(cardPages());
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text).toBe(
      [
        'While Rune Ward is active, you gain the following benefits:',
        '- +1 bonus to your Spellcast Rolls.',
        '- Once per rest, reroll a damage die.',
      ].join('\n'),
    );
    expect(cards[0]!.text).not.toContain('\n\n');
    expect(cards[0]!.text).not.toContain(RING);
  });
});
