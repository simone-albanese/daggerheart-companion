/**
 * Where the adversaries stop and the environments start.
 *
 * The adversaries have no contents entry of their own - they share
 * "Adversaries and Environments" with the environments - so their range cannot
 * come from `contents.ts` alone, and the four folio numbers the parser used to
 * carry are right for SRD 1.0 only. Everything asserted here is about the CUT:
 * that the chapter's own headings find it, that a stat block sharing a page
 * with `USING ENVIRONMENTS` survives it, and that nothing on the far side of
 * it is read as an adversary.
 *
 * The synthetic half runs in CI, on a four-page book built here that carries
 * every shape measured in the real ones. The two book-gated halves cannot: the
 * manuals are the owner's and are not in the repository.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BookPage, Line, TextRun } from '../../shared/textLayout.ts';
import { parseAdversaries } from '../../shared/parsers/adversaries.ts';
import { BOOKS, loadSrd } from '../../tools/loadSrd.ts';

// ---------------------------------------------------------------------------
// A four-page book, in the shapes both real ones print
// ---------------------------------------------------------------------------

interface LineSpec {
  text: string;
  family?: string;
  size?: number;
  x?: number;
}

let y = 0;

const line = ({ text, family = 'QuestaSans-Light', size = 8, x = 60 }: LineSpec): Line => {
  y += 10;
  const run: TextRun = { x, y, w: text.length * 4, h: size, text, family, size, bold: false, italic: false };
  return {
    text,
    x,
    y,
    w: run.w,
    size,
    family,
    bold: false,
    italic: /Italic/.test(family),
    column: 0,
    runs: [run],
  };
};

/** A 12pt Eveleth display heading - a block name, or a section banner. */
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

const book = (): BookPage[] => {
  y = 0;
  return [
    page(1, [
      line({ text: 'CONTENTS', family: 'EvelethCleanRegular', size: 17 }),
      entry('Adversaries and Environments', 2),
      entry('Additional GM Guidance', 6),
    ]),
    page(2, [
      line({ text: 'ADVERSARY STAT BLOCK BENCHMARKS', family: 'QuestaSans', size: 11.3 }),
      line({ text: 'ADVERSARIES BY TIER', family: 'EvelethCleanThin', size: 12 }),
      line({ text: 'This section contains the following stat blocks:', size: 9.3 }),
      line({ text: 'TIER 1 (LEVEL 1)', family: 'QuestaSans', size: 11.3, x: 70 }),
      line({ text: '• Acid Burrower', size: 9.3 }),
      // The benchmark table's right-hand columns are emitted after the roster
      // heading in SRD 2.0, indented far past the bullets. Neither the plain
      // QuestaSans cell nor the 8pt one may be taken for a wrapped entry.
      line({ text: 'Tier 3', family: 'QuestaSans', size: 8, x: 120 }),
      line({ text: 'Major 20/Severe 32', size: 8, x: 120 }),
      line({ text: '• Fallen Warlord: Undefeated', size: 9.3 }),
      line({ text: 'Champion', size: 9.3, x: 69 }),
      line({ text: '• Will-o’-the-Wisps', size: 9.3 }),
    ]),
    page(3, [
      display('TIER 1 ADVERSARIES (LEVEL 1)', 50),
      display('ACID BURROWER'),
      line({ text: 'Tier 1 Solo', family: 'QuestaSlab', size: 9.3 }),
      line({ text: 'A horse-sized insect.', family: 'QuestaSans-LightItalic' }),
      line({ text: 'Motives & Tactics: Burrow, feed' }),
      line({ text: 'Difficulty: 14 | Thresholds: 8/15 | HP: 8 | Stress: 3', family: 'QuestaSans', x: 66 }),
      line({ text: 'ATK: +3 | Claws: Very Close | 1d12+2 phy', x: 66 }),
      line({ text: 'Experience: Tremor Sense +2', family: 'QuestaSans', x: 66 }),
      line({ text: 'FEATURES', family: 'QuestaSans', size: 10 }),
      line({ text: 'Earth Eruption - Action: It erupts.' }),
      line({ text: 'Metamorphosis - Evolution: It gains the following features:' }),
      // Indented: a sub-feature of the Evolution above, not a feature of the
      // block. The 6pt hanging indent is what SRD 2.0 prints.
      line({ text: 'Wrathful - Passive: It gains a +2 bonus.', x: 66 }),
    ]),
    page(4, [
      display('WILL-O’-THE-WISPS'),
      line({ text: 'Tier 1 Horde (8/HP)', family: 'QuestaSlab', size: 9.3 }),
      line({ text: 'Lazily floating orbs.', family: 'QuestaSans-LightItalic' }),
      line({ text: 'Motives & Tactics: Disorient, lead astray' }),
      line({ text: 'Difficulty: 9 | Thresholds: 5/9 | HP: 4 | Stress: None', family: 'QuestaSans', x: 66 }),
      line({ text: 'ATK: -3 | Flash: Close | 1d4+2 mag', x: 66 }),
      line({ text: 'FEATURES', family: 'QuestaSans', size: 10 }),
      line({ text: 'Kaleidoscopic - Passive: They dazzle.' }),
      display('FALLEN WARLORD:', 300),
      display('UNDEFEATED CHAMPION', 300),
      line({ text: 'Tier 1 Leader', family: 'QuestaSlab', size: 9.3, x: 300 }),
      line({ text: 'That which only the feared fear.', family: 'QuestaSans-LightItalic', x: 300 }),
      line({ text: 'Motives & Tactics: Conquer, punish', x: 300 }),
      line({ text: 'Difficulty: 18 | Thresholds: 35/58 | HP: 11 | Stress: 5', family: 'QuestaSans', x: 306 }),
      line({ text: 'ATK: +8 | Sword: Very Close | 4d12+13 phy', x: 306 }),
      line({ text: 'FEATURES', family: 'QuestaSans', size: 10, x: 300 }),
      line({ text: 'Momentum - Reaction: You gain a Fear.', x: 300 }),
      // Everything below is the environments half of the same chapter.
      display('USING ENVIRONMENTS', 50),
      display('LOCAL TAVERN', 50),
      line({ text: 'Tier 1 Social', family: 'QuestaSlab', size: 9.3, x: 50 }),
      line({ text: 'Impulses: Welcome, gossip', x: 50 }),
    ]),
  ];
};

describe('a chapter the contents page does not divide', () => {
  it('reads the adversaries and stops at the environments heading', () => {
    /*
     * `LOCAL TAVERN` is a `Tier 1 Social` block on the same page as the last
     * two adversaries, and `Social` is BOTH an adversary role and an
     * environment type - so the slab line cannot tell the halves apart and the
     * heading has to. If it did not, the tavern would arrive here as an
     * adversary that no roster names, and the parse would throw.
     */
    const out = parseAdversaries(book());
    expect(out.map((a) => a.name)).toEqual([
      'Acid Burrower',
      'Will-o’-the-Wisps',
      'Fallen Warlord: Undefeated Champion',
    ]);
  });

  it('keeps the blocks printed above USING ENVIRONMENTS on its page', () => {
    // A folio-based cut has to choose between losing these two and taking the
    // environment rules in. SRD 2.0 folio 158 prints exactly this shape.
    const out = parseAdversaries(book());
    expect(out.filter((a) => a.sourcePage === 4).map((a) => a.name)).toEqual([
      'Will-o’-the-Wisps',
      'Fallen Warlord: Undefeated Champion',
    ]);
  });

  it('joins a roster entry that wraps, and ignores a table cell that does not', () => {
    // `• Fallen Warlord: Undefeated` + `Champion`, against `Tier 3` and
    // `Major 20/Severe 32` sitting at the same indent in the same slice.
    const out = parseAdversaries(book());
    expect(out.map((a) => a.id)).toContain('fallen-warlord-undefeated-champion');
  });

  it('takes the case of a name from the roster, not from titleCase', () => {
    // `WILL-O’-THE-WISPS` title-cases to `Will-O’-The-Wisps`; the book writes
    // the interior words lowercase and the roster is where it writes them.
    const out = parseAdversaries(book());
    expect(out.map((a) => a.name)).toContain('Will-o’-the-Wisps');
    expect(out.map((a) => a.name)).not.toContain('Will-O’-The-Wisps');
  });

  it('keeps an Evolution as a feature and its sub-features inside it', () => {
    const burrower = parseAdversaries(book())[0]!;
    expect(burrower.features.map((f) => `${f.name} (${String(f.kind)})`)).toEqual([
      'Earth Eruption (Action)',
      'Metamorphosis (Evolution)',
    ]);
    expect(burrower.features[1]!.text).toBe(
      'It gains the following features:\nWrathful - Passive: It gains a +2 bonus.',
    );
  });

  it('reads Stress: None as a creature with no Stress track', () => {
    const wisps = parseAdversaries(book()).find((a) => a.id === 'will-o-the-wisps')!;
    expect(wisps.stress).toBe(0);
    expect(wisps.hordeThreshold).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// The books themselves
// ---------------------------------------------------------------------------

const have = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));
const read = async (i: number) =>
  parseAdversaries((await loadSrd({ pdfPath: BOOKS[i]!.localPaths.find(existsSync)! })).pages);

describe.skipIf(!have(0))('SRD 1.0', () => {
  it('finds the same 129 blocks the folio constants used to name', async () => {
    const a = await read(0);
    expect(a).toHaveLength(129);
    expect(Math.min(...a.map((x) => x.sourcePage!))).toBe(75);
    expect(Math.max(...a.map((x) => x.sourcePage!))).toBe(101);
    // The book has no Evolution; adding the word to the heading pattern must
    // not invent one here.
    expect(a.flatMap((x) => x.features).filter((f) => String(f.kind) === 'Evolution')).toEqual([]);
  }, 120_000);
});

describe.skipIf(!have(1))('SRD 2.0', () => {
  it('reads 264 blocks, the last two above the environments heading', async () => {
    const a = await read(1);
    expect(a).toHaveLength(264);
    expect(Math.min(...a.map((x) => x.sourcePage!))).toBe(97);
    expect(a.filter((x) => x.sourcePage === 158).map((x) => x.name)).toEqual([
      'Perfected Zombie',
      'Zombie Legion',
    ]);
  }, 120_000);

  it('keeps the two names the roster spells lowercase inside a compound', async () => {
    const names = (await read(1)).map((x) => x.name);
    expect(names).toContain('Will-o’-the-Wisps');
    expect(names).toContain('Jack-o’-Lantern');
    expect(names).toContain('Fallen Warlord: Undefeated Champion');
  }, 120_000);

  it('carries six Evolutions, with their sub-features inside them', async () => {
    const a = await read(1);
    const evolutions = a.flatMap((x) => x.features).filter((f) => String(f.kind) === 'Evolution');
    expect(evolutions.map((f) => f.name).sort()).toEqual([
      // The Cephilith Titan's is printed in quotation marks; `normalizeText`
      // folds the book's curly ones, so it sorts before the letters.
      '"It’s Here…"',
      'Alpha to Omega',
      'Enraged Mountain Troll',
      'Hellwing',
      'Nest Warden',
      'Resurrection',
    ]);
    const roc = a.find((x) => x.id === 'roc')!;
    expect(roc.features.map((f) => f.name)).toEqual([
      'Relentless (3)',
      'Bird of Prey',
      'Here Comes the Boom',
      'Crushing Grasp',
      'Nest Warden',
    ]);
    expect(roc.features.at(-1)!.text).toContain('\nWrathful - Passive:');
    expect(roc.features.at(-1)!.text).toContain('\nElectrifying Aura - Passive:');
  }, 120_000);

  it('reads the one block printed with no Stress track', async () => {
    const armor = (await read(1)).find((x) => x.id === 'spellbound-armor')!;
    expect(armor.stress).toBe(0);
    expect(armor.features[0]!.name).toBe('Tireless');
  }, 120_000);
});
