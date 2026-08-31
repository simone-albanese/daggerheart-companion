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
import { DOMAIN_MARKS } from '../../src/ui/shared/DomainMark.tsx';
import { DOMAINS } from '../../shared/types.ts';

let y = 0;
const at = (
  text: string,
  family: string,
  size: number,
  bold: boolean,
  fixed?: { y: number; column: number },
): Line => {
  const yy = fixed?.y ?? (y += 12);
  const column = fixed?.column ?? 0;
  const run: TextRun = { x: 40 + column * 260, y: yy, w: 200, h: 10, text, family, size, bold, italic: false };
  return { text, x: run.x, y: yy, w: 200, size, family, bold, italic: false, column, runs: [run] };
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

describe('a domain banner, which spans the page rather than a column', () => {
  /*
   * A banner claims everything BELOW IT ON THE PAGE, in both columns. The rule
   * used to be reading order - walk the de-columnised lines, remember the last
   * banner seen - which is the same answer only when no banner falls mid-page
   * with cards beside it in the other column.
   *
   * Measured on both books: SRD 1.0's appendix never separates the two, so the
   * old rule was right there by luck of layout. SRD 2.0 separates them on five
   * of ten banner pages. On folio 209 the BONE banner sits at the middle of the
   * left column while three Blade cards occupy the top of the right one, and
   * reading order hands those three to Bone.
   *
   * Laid out here the way that page is: the de-columniser emits ALL of column 0
   * and then column 1, so the right-hand card is last in reading order and
   * above the banner on the page.
   */
  const cardAt = (col: number, top: number, name: string, level: string): Line[] => [
    at(name, 'QuestaSans-Medium', 11, true, { y: top, column: col }),
    at(level, 'QuestaSans-Light', 9, false, { y: top + 13, column: col }),
    at('Recall Cost: 1', 'QuestaSans-Light', 9, false, { y: top + 24, column: col }),
    at('Rules text.', 'QuestaSans-Light', 9, false, { y: top + 35, column: col }),
  ];

  it('gives a card in the far column the banner above it, not the one before it', () => {
    const lines = [
      // column 0: the ARCANA banner, a card, then BLADE halfway down, then Blade
      at('ARCANA DOMAIN', 'EvelethCleanRegular', 12, true, { y: 20, column: 0 }),
      ...cardAt(0, 60, 'RUNE WARD', 'Level 1 Arcana Spell'),
      at('BLADE DOMAIN', 'EvelethCleanRegular', 12, true, { y: 340, column: 0 }),
      ...cardAt(0, 380, 'WHIRLWIND', 'Level 1 Blade Ability'),
      // column 1, top of the page: still Arcana, and last in reading order
      ...cardAt(1, 60, 'UNLEASH CHAOS', 'Level 1 Arcana Spell'),
    ];
    const cards = parseDomainCards(book(lines));
    const byName = new Map(cards.map((c) => [c.name, c.domain]));
    expect(byName.get('Rune Ward')).toBe('arcana');
    expect(byName.get('Whirlwind')).toBe('blade');
    // The one the old rule got wrong: last in reading order, above the banner.
    expect(byName.get('Unleash Chaos')).toBe('arcana');
  });
});

describe('the ten domain marks', () => {
  /*
   * `DomainMark.tsx` opens by claiming the shape alone identifies the domain,
   * so colour is reinforcement and never the carrier - which is what makes a
   * loadout readable to a colour-blind player. Nothing tested it. A tenth mark
   * could be added with `clip: 'none'` and the whole suite stayed green, which
   * is how a domain ends up indistinguishable from `bone`.
   */
  it('draws each domain exactly the shape that was chosen by looking at it', () => {
    /*
     * A golden pin, and deliberately so: string uniqueness is not the property
     * that matters and cannot be made into it. `clip: 'none'` with `radius: 0`
     * is a string no other mark uses AND a plain square, which is `bone` to
     * the eye - a first version of this test compared strings, passed, and let
     * exactly that through.
     *
     * Separability is a claim about what a person sees at 16px, so it was
     * settled by rendering the candidates in greyscale beside the nine and
     * looking. No unit test can redo that. What a test CAN do is make changing
     * a shape a deliberate act that fails here until someone updates it, which
     * is the point at which they should look again.
     */
    expect(Object.fromEntries(Object.entries(DOMAIN_MARKS).map(([k, m]) => [k, `${m.clip} @ ${m.radius}`])))
      .toEqual({
        arcana: 'polygon(50% 0,100% 50%,50% 100%,0 50%) @ 0',
        blade: 'polygon(50% 0,100% 100%,0 100%) @ 0',
        bone: 'none @ 2px',
        codex: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%) @ 0',
        grace: 'none @ 50%',
        midnight: 'polygon(0 0,100% 0,50% 100%) @ 0',
        sage: 'none @ 0 62% 0 62%',
        splendor: 'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%) @ 0',
        valor: 'polygon(0 0,100% 0,100% 62%,50% 100%,0 62%) @ 0',
        dread:
          'polygon(20% 0,50% 30%,80% 0,100% 20%,70% 50%,100% 80%,80% 100%,50% 70%,20% 100%,0 80%,30% 50%,0 20%) @ 0',
      });
  });

  it('leaves no two domains drawing the same silhouette', () => {
    // Weaker than the pin above and kept anyway: it is the invariant, where the
    // pin is only today's instance of it.
    const shapes = Object.entries(DOMAIN_MARKS).map(([id, m]) => [id, `${m.clip}|${m.radius}`] as const);
    const seen = new Map<string, string>();
    for (const [id, shape] of shapes) {
      expect(seen.get(shape), `${id} and ${seen.get(shape) ?? ''} draw the same shape`).toBeUndefined();
      seen.set(shape, id);
    }
    expect(seen.size).toBe(DOMAINS.length);
  });

  it('names every domain, so none can be added without a mark', () => {
    for (const id of DOMAINS) expect(DOMAIN_MARKS[id]?.label, id).toBeTruthy();
  });
});
