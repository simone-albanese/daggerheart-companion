/**
 * The one chapter three parsers share, and the cuts that divide it.
 *
 * "Adversaries and Environments" is a single contents entry that three files
 * read: `adversaries.ts` takes a LINE range that ends at `USING ENVIRONMENTS`,
 * `rules.ts` takes a FOLIO range from that banner to `ENVIRONMENT STAT BLOCKS
 * BY TIER`, and `environments.ts` takes a FOLIO range from the folio carrying
 * that second banner to the end of the chapter. Measured, the three tile the
 * chapter with no gap and no overlap. Nothing asserted it.
 *
 * Nothing could, in CI: every assertion about this chapter in the tree runs
 * against a PDF that `.gitignore` keeps out of the repository, so the whole of
 * `environments.test.ts` and `rules.test.ts` skips on a stock runner. Measured
 * on this tree with `Manuali/` moved aside: `npx vitest run tests/tools` is
 * "127 passed | 68 skipped (195)", and four files go dark entirely -
 * `rules.test.ts` 7/7, `environments.test.ts` 6/6, `loot.test.ts` 10/10,
 * `audit-core.test.ts` 5/5.
 *
 * ## What this file can prove, and what it cannot
 *
 * Two of the three parsers run here on a synthetic chapter built in the shapes
 * both books print. `parseRules` does not, and that is a limit rather than an
 * omission: it requires all eight islands, every one of the ~75 sequential
 * section headings in `SPECS`, every entry of `TABLES` found exactly once and
 * every `SPLIT_ABOVE` anchor printed. A synthetic book satisfying that would be
 * a copy of the manifest, and a test that asserts the manifest against itself
 * proves nothing.
 *
 * So the rules island is tested from the OUTSIDE, twice, and both halves are
 * real:
 *
 *  - the hole. Two sentinel words are printed in the chapter between the two
 *    banners - one under `USING ENVIRONMENTS`, one under `ADAPTING
 *    ENVIRONMENTS` on the folio the index heading shares. Neither may appear
 *    in anything `parseAdversaries` or `parseEnvironments` returns. That is
 *    exactly the statement "the middle third belongs to neither neighbour",
 *    and it is what a wrong cut at either end breaks.
 *  - the anchors. The three files must go on naming the same two boundary
 *    strings. `USING ENVIRONMENTS` renamed in one file and not the others is a
 *    change no other check in CI can see.
 *
 * ## The shapes here are the books', not inventions
 *
 * Every geometry below was read off the two PDFs with a probe, not reasoned
 * about:
 *
 *  - 13 lines open with U+2022 above the `ADVERSARIES BY TIER` heading, inside
 *    the chapter, in BOTH books (SRD 1.0 folio 71, SRD 2.0 folio 93): the
 *    "Bruisers / Hordes / Leaders / Minions..." role list of the chapter's own
 *    introduction. They are why `splitChapter` cuts the roster's HEAD as well
 *    as its tail, and until this file nothing tested that cut - the synthetic
 *    book in `adversaries.test.ts` prints no bullet above the heading.
 *  - SRD 2.0 folio 158 carries two stat blocks ABOVE `USING ENVIRONMENTS`;
 *    SRD 1.0 gives that banner the top of folio 102.
 *  - the folio carrying `ENVIRONMENT STAT BLOCKS BY TIER` carries 30 lines of
 *    `ADAPTING ENVIRONMENTS` prose and a benchmark table above it in SRD 2.0
 *    (folio 159) and nothing above it in SRD 1.0 (folio 103). The 30 lines are
 *    the rules island's, and `environments.ts` must leave them alone.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { parseAdversaries } from '../../shared/parsers/adversaries.ts';
import { parseEnvironments } from '../../shared/parsers/environments.ts';

// ---------------------------------------------------------------------------
// One synthetic chapter, in the shapes the two books print
// ---------------------------------------------------------------------------

interface LineSpec {
  text: string;
  family?: string;
  size?: number;
  x?: number;
}

let y = 0;

const line = ({ text, family = 'QuestaSans-Light', size = 9.3, x = 60 }: LineSpec): Line => {
  y += 12;
  const run: TextRun = {
    x, y, w: text.length * 4, h: size, text, family, size, bold: false, italic: false,
  };
  return {
    text, x, y, w: run.w, size, family,
    bold: false,
    italic: /Italic/.test(family),
    column: 0,
    runs: [run],
  };
};

/**
 * A section heading: Eveleth THIN. `isBanner` in `environments.ts` is
 * `isDisplay && !/Thin/`, so the face is what keeps `ADAPTING ENVIRONMENTS`
 * and the index heading from opening a stat block. Both books set them thin.
 */
const heading = (text: string, x = 60): Line =>
  line({ text, family: 'EvelethCleanThin', size: 12, x });

/** A stat-block banner or tier banner: Eveleth REGULAR, 12pt. */
const display = (text: string, x = 60): Line =>
  line({ text, family: 'EvelethCleanRegular', size: 12, x });

const page = (folio: number, lines: Line[]): BookPage => ({
  index: folio,
  folio,
  pdfPage: folio,
  side: 'single',
  width: 612,
  height: 792,
  columns: 1,
  lines,
  runs: lines.flatMap((l) => l.runs),
});

/** A contents line: title, leaders and folio, rebuilt from the runs. */
const entry = (title: string, folio: number): Line => {
  const l = line({ text: `${title} . . . ${folio}`, size: 9.3 });
  l.runs = [
    { ...l.runs[0]!, text: title },
    { ...l.runs[0]!, text: '. . .' },
    { ...l.runs[0]!, text: String(folio) },
  ];
  return l;
};

/**
 * The two words that must land nowhere.
 *
 * `PREAMBLE_SENTINEL` is printed under `USING ENVIRONMENTS`, on the folio the
 * last adversary stat block shares. `ADAPTING_SENTINEL` is printed under
 * `ADAPTING ENVIRONMENTS`, on the folio the environments index heading shares.
 * Between them they cover both ends of the middle third.
 */
const PREAMBLE_SENTINEL = 'WEATHERVANE';
const ADAPTING_SENTINEL = 'MILLSTONE';

/** The four roles the chapter's introduction bullets, above its roster heading. */
const ROLE_BULLETS = [
  '• Bruisers: tough; deliver powerful attacks.',
  '• Hordes: groups of identical creatures acting together as one.',
  '• Leaders: command and summon other adversaries.',
  '• Minions: easily dispatched but dangerous in numbers.',
];

const statBlock = (name: string, role: string, x = 60): Line[] => [
  display(name, x),
  line({ text: `Tier 1 ${role}`, family: 'QuestaSlab', size: 9.3, x }),
  line({ text: 'A thing that fights.', family: 'QuestaSans-LightItalic', x }),
  line({ text: 'Motives & Tactics: Fight, flee', x }),
  line({ text: 'Difficulty: 14 | Thresholds: 8/15 | HP: 8 | Stress: 3', family: 'QuestaSans', x: x + 6 }),
  line({ text: 'ATK: +3 | Claws: Very Close | 1d12+2 phy', x: x + 6 }),
  line({ text: 'FEATURES', family: 'QuestaSans', size: 10, x }),
  line({ text: 'Lunge - Action: It lunges.', x }),
];

const environmentBlock = (name: string, type: string, difficulty: string): Line[] => [
  display(name),
  line({ text: `Tier 1 ${type}`, family: 'QuestaSlab', size: 9.3 }),
  line({ text: 'Somewhere the party would rather not linger.' }),
  line({ text: 'Impulses: Welcome, gossip' }),
  line({ text: `Difficulty: ${difficulty}` }),
  line({ text: 'Potential Adversaries: Bandits, Guards' }),
  line({ text: 'FEATURES', family: 'QuestaSans', size: 10 }),
  line({ text: 'Sit a Spell - Action: Someone offers a rumour.' }),
];

/**
 * The chapter, folio by folio.
 *
 * `aboveIndexHeading` is the one variable: what is printed on the environments'
 * first folio ABOVE its index heading. The book prints rules prose there;
 * passing stat-block lines instead is how the no-overlap guard is exercised.
 */
const book = (aboveIndexHeading: Line[] = []): BookPage[] => {
  y = 0;
  return [
    page(1, [
      line({ text: 'CONTENTS', family: 'EvelethCleanRegular', size: 17 }),
      entry('Adversaries and Environments', 2),
      entry('Additional GM Guidance', 8),
    ]),
    // The chapter opener. Its own introduction bullets sit ABOVE the roster
    // heading; the roster's own bullets sit below it.
    page(2, [
      heading('USING ADVERSARIES'),
      line({ text: 'Adversaries come in the following roles:' }),
      ...ROLE_BULLETS.map((text) => line({ text })),
      line({ text: 'ADVERSARY STAT BLOCK BENCHMARKS', family: 'QuestaSans', size: 11.3 }),
      heading('ADVERSARIES BY TIER'),
      line({ text: 'TIER 1 (LEVEL 1)', family: 'QuestaSans', size: 11.3, x: 70 }),
      line({ text: '• Acid Burrower' }),
      line({ text: '• Zombie Legion' }),
    ]),
    page(3, [
      display('TIER 1 ADVERSARIES (LEVEL 1)', 50),
      ...statBlock('ACID BURROWER', 'Solo'),
    ]),
    // SRD 2.0 folio 158: the last stat block, then the banner, then the rules
    // that belong to neither this parser nor the environments one.
    page(4, [
      ...statBlock('ZOMBIE LEGION', 'Horde (5/HP)'),
      heading('USING ENVIRONMENTS'),
      line({ text: 'An environment is a challenge the party moves through.' }),
      line({ text: `Point the ${PREAMBLE_SENTINEL} at the storm and read the rules aloud.` }),
    ]),
    // SRD 2.0 folio 159: more rules prose, then the index heading and the
    // index itself. Nothing on this folio is set in a banner face.
    page(5, [
      ...aboveIndexHeading,
      heading('ADAPTING ENVIRONMENTS'),
      line({ text: 'Sometimes an environment is at the wrong tier for your party.' }),
      line({ text: `Grind it on the ${ADAPTING_SENTINEL} until the numbers fit.` }),
      heading('ENVIRONMENT STAT BLOCKS BY TIER'),
      line({ text: '• Local Tavern (Social)' }),
      line({ text: '• Raging River (Traversal)' }),
    ]),
    page(6, [
      display('TIER 1 ENVIRONMENTS (LEVELS 1)', 50),
      ...environmentBlock('LOCAL TAVERN', 'Social', '12'),
      ...environmentBlock('RAGING RIVER', 'Traversal', '15'),
    ]),
    // The chapter's far end, which `sectionRange` overlaps by one folio.
    page(8, [
      heading('ADDITIONAL GM GUIDANCE'),
      line({ text: 'Guidance that belongs to the next chapter entirely.' }),
    ]),
  ];
};

/** Every line of the fixture, so a sentinel cannot pass by not being printed. */
const printed = (pages: BookPage[]): string =>
  pages.flatMap((p) => p.lines.map((l) => l.text)).join('\n');

// ---------------------------------------------------------------------------
// The roster's HEAD cut
// ---------------------------------------------------------------------------

describe('the roster, cut at its head as well as its tail', () => {
  it('prints bullets above the roster heading, as both books do', () => {
    // The guard against a vacuous test below: if the fixture stopped carrying
    // the chapter introduction's own bullets, everything after this would pass
    // for the wrong reason.
    const chapter = book().filter((p) => p.folio === 2)[0]!;
    const at = chapter.lines.findIndex((l) => l.text === 'ADVERSARIES BY TIER');
    expect(chapter.lines.slice(0, at).filter((l) => l.text.startsWith('•'))).toHaveLength(
      ROLE_BULLETS.length,
    );
  });

  it('takes none of them for a rostered adversary', () => {
    /*
     * `splitChapter` slices `rosterAt + 1`, not `0`. Reading from 0 hands
     * `parseRoster` "• Bruisers: ..." before any `TIER n (LEVEL...)` heading
     * has been seen, which is the throw that stands in for the silent version:
     * a book whose introduction bulleted UNDER a tier heading would have
     * enrolled four roles as adversaries and then failed the far-side check
     * with four names no stat block answers.
     */
    const out = parseAdversaries(book());
    expect(out.map((a) => a.name)).toEqual(['Acid Burrower', 'Zombie Legion']);
    for (const role of ['Bruisers', 'Hordes', 'Leaders', 'Minions']) {
      expect(out.map((a) => a.name)).not.toContain(role);
    }
  });
});

// ---------------------------------------------------------------------------
// The three ranges, tiling one chapter
// ---------------------------------------------------------------------------

describe('three parsers dividing one contents entry', () => {
  it('gives the adversaries every block above the environments banner and none below', () => {
    const out = parseAdversaries(book());
    expect(out.map((a) => `${a.name} @${String(a.sourcePage)}`)).toEqual([
      'Acid Burrower @3',
      // The block that shares its folio with USING ENVIRONMENTS. A folio cut
      // loses it; the line cut keeps it.
      'Zombie Legion @4',
    ]);
    expect(out.map((a) => a.name)).not.toContain('Local Tavern');
    expect(out.map((a) => a.name)).not.toContain('Raging River');
  });

  it('gives the environments every block from the index folio on, and nothing above it', () => {
    const out = parseEnvironments(book());
    expect(out.map((e) => `${e.name} @${String(e.sourcePage)}`)).toEqual([
      'Local Tavern @6',
      'Raging River @6',
    ]);
    // `ADAPTING ENVIRONMENTS` is a heading on the section's own first folio.
    // Reading it as a banner makes it a stat block with no `Tier N Type` line.
    expect(out.map((e) => e.name)).not.toContain('Adapting Environments');
  });

  it('leaves the middle third to neither of them', () => {
    /*
     * This is the tiling assertion. Everything printed between `USING
     * ENVIRONMENTS` and `ENVIRONMENT STAT BLOCKS BY TIER` is the rules island's
     * - which cannot run here - so what is provable is that its two neighbours
     * do not reach into it from either side. A tail cut that stops at a folio
     * instead of at the banner takes the first sentinel; a near end that starts
     * at the chapter instead of at the index folio takes the second.
     */
    const pages = book();
    expect(printed(pages)).toContain(PREAMBLE_SENTINEL);
    expect(printed(pages)).toContain(ADAPTING_SENTINEL);

    const adversaries = JSON.stringify(parseAdversaries(pages));
    const environments = JSON.stringify(parseEnvironments(pages));
    for (const sentinel of [PREAMBLE_SENTINEL, ADAPTING_SENTINEL]) {
      expect(adversaries).not.toContain(sentinel);
      expect(environments).not.toContain(sentinel);
    }
  });

  it('refuses a stat block printed above the index heading rather than dropping it', () => {
    /*
     * The other direction of the same boundary: if the adversaries ever ran
     * onto the environments' first folio, the lines above the index heading
     * would be silently discarded as front matter. `splitSection` reads them
     * and throws instead.
     */
    const leaked = book([
      line({ text: 'Tier 1 Social', family: 'QuestaSlab', size: 9.3 }),
      line({ text: 'Impulses: Devour, multiply' }),
    ]);
    expect(() => parseEnvironments(leaked)).toThrow(/stat-block content above a page banner/);
  });
});

// ---------------------------------------------------------------------------
// The third parser, from the outside
// ---------------------------------------------------------------------------

/** A parser's source with its comments removed, so prose cannot answer for code. */
const codeOf = (file: string): string =>
  readFileSync(new URL(`../../shared/parsers/${file}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the two banner strings the three parsers must agree on', () => {
  /*
   * `parseRules` cannot be run on a synthetic chapter - see the file docblock -
   * so the half of the boundary it owns is held here instead. What this catches
   * is the change no other gate on a stock runner can see: one of the three
   * files renaming an anchor the other two still use. Comments are stripped
   * first, because all three files discuss both strings at length in prose.
   */
  it('is named in adversaries.ts, which cuts its line stream there', () => {
    expect(codeOf('adversaries.ts')).toContain('USING ENVIRONMENTS');
  });

  it('is named in environments.ts, which takes its first folio from the index heading', () => {
    expect(codeOf('environments.ts')).toContain('ENVIRONMENT STAT BLOCKS BY TIER');
  });

  it('is named at both ends in rules.ts, which covers the gap between them', () => {
    const rules = codeOf('rules.ts');
    // The island's folios, and the two units it is trimmed to.
    expect(rules).toContain("bannerFolio(p, 'USING ENVIRONMENTS')");
    expect(rules).toContain("bannerFolio(p, 'ENVIRONMENT STAT BLOCKS BY TIER')");
    expect(rules).toContain("open: 'USING ENVIRONMENTS'");
    expect(rules).toContain("close: 'ENVIRONMENT STAT BLOCKS BY TIER'");
  });
});
