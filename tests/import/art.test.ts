import { describe, expect, it } from 'vitest';
import type { TextRun } from '../../shared/textLayout.ts';
import { isCardSheet, locateCards, type ImagePaint } from '../../src/import/art.ts';

const PAGE = { width: 400, height: 520 };
/** Credit centres 190 apart, credit baselines 250 apart: a 2x2 sheet. */
const COL_PITCH = 190;
const ROW_PITCH = 250;

const run = (
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  family = 'Overpass-Medium',
  size = h / 1.2,
): TextRun => ({ x, y, w, h, text, family, size, bold: false, italic: false });

const img = (x: number, y: number, w: number, h: number, id = `i${x}-${y}`): ImagePaint => ({
  id,
  rect: { x, y, w, h },
});

/**
 * One card: a body line that fixes the card's centre, a name and a card type in
 * the display face, a level digit, and the credit line at the foot.
 */
function card(number: number, left: number, top: number): { runs: TextRun[]; images: ImagePaint[] } {
  const bottom = top + ROW_PITCH;
  return {
    runs: [
      run('body text of the card', left + 15, bottom - 60, 160, 7),
      run('Rune ward', left + 55, bottom - 100, 60, 10, 'EvelethCleanRegular', 8),
      run('Spell', left + 75, bottom - 115, 20, 8, 'EvelethCleanRegular', 6),
      run('1', left + 20, top + 4, 6, 20, 'EvelethCleanRegular', 16),
      run(`credit`, left + 60, bottom - 18, 20, 5, 'Overpass-Italic', 4),
      run(`DH Core ${String(number).padStart(3, '0')}/270 |`, left + 85, bottom - 18, 32, 5, 'Overpass-Italic', 4),
      run('Daggerheart © Darrington Press 2025', left + 120, bottom - 18, 55, 5, 'Overpass-Italic', 4),
    ],
    images: [
      img(left + 3, top - 2, COL_PITCH, 100, `art-a-${number}`),
      img(left + 5, top, COL_PITCH - 5, 95, `art-b-${number}`),
      // The frame panel: full width, but well below the top of the card.
      img(left + 3, top + 120, COL_PITCH, 40, `frame-${number}`),
      // The domain emblem: at the very top, but far too narrow to be art.
      img(left + 15, top + 5, 30, 40, `emblem-${number}`),
    ],
  };
}

function sheet(): { runs: TextRun[]; images: ImagePaint[] } {
  const cards = [card(82, 5, 0), card(83, 195, 0), card(103, 5, 250), card(104, 195, 250)];
  return {
    runs: cards.flatMap((c) => c.runs),
    images: cards.flatMap((c) => c.images),
  };
}

describe('isCardSheet', () => {
  it('recognises a sheet and passes over an ordinary page', () => {
    expect(isCardSheet(sheet().runs)).toBe(true);
    expect(isCardSheet([run('Chapter 4: Tier 1 Adversaries', 10, 500, 120, 7)])).toBe(false);
  });
});

describe('locateCards', () => {
  it('finds every card and reads its number and name', () => {
    const cards = locateCards(sheet().runs, sheet().images, PAGE);
    expect(cards.map((c) => c.number)).toEqual([82, 83, 103, 104]);
    expect(cards.every((c) => c.total === 270)).toBe(true);
    expect(cards.every((c) => c.slug === 'rune-ward')).toBe(true);
  });

  it('centres the cell on the card, not on the off-centre credit line', () => {
    const [first] = locateCards(sheet().runs, sheet().images, PAGE);
    // The card's horizontal runs span x=20..180, so its centre is 100 and a
    // 190pt cell starts at 5. The credit line sits at 90..122, whose centre of
    // 106 would have put the cell at 11 and shaved 6pt off the illustration.
    expect(first!.cell.x).toBeCloseTo(5, 6);
    expect(first!.cell.w).toBeCloseTo(COL_PITCH, 6);
  });

  it('takes the illustration layers and leaves the frame and the emblem', () => {
    const [first] = locateCards(sheet().runs, sheet().images, PAGE);
    const art = first!.art!;
    expect(art).not.toBeNull();
    // Clipped to the page at the top, to the cell on the left, and stopping at
    // the bottom of the lowest top-aligned layer - above the frame at y=120.
    expect(art.y).toBe(0);
    expect(art.x).toBeCloseTo(8, 6);
    expect(art.y + art.h).toBeCloseTo(98, 6);
    expect(art.h).toBeLessThan(120);
  });

  it('caps a full-bleed illustration so it cannot swallow the card text', () => {
    const one = card(82, 5, 0);
    const bleeding = [img(5, 0, COL_PITCH, ROW_PITCH, 'full-bleed'), ...one.images.slice(2)];
    const cards = locateCards(
      [...one.runs, ...card(83, 195, 0).runs, ...card(103, 5, 250).runs],
      [...bleeding, ...card(83, 195, 0).images, ...card(103, 5, 250).images],
      PAGE,
    );
    const first = cards.find((c) => c.number === 82)!;
    expect(first.art!.h).toBeCloseTo(ROW_PITCH * 0.65, 6);
  });

  it('reports a card with no usable image rather than inventing a rectangle', () => {
    const one = card(82, 5, 0);
    const cards = locateCards(one.runs, [one.images[3]!], PAGE);
    expect(cards[0]!.art).toBeNull();
  });

  it('ignores the rotated tab printed up the outer margin', () => {
    const one = card(82, 5, 0);
    const tab = run('DOMAIN LEVEL 1', 170, 10, 15, 120, 'EvelethCleanRegular', 12);
    const cards = locateCards([...one.runs, tab], one.images, PAGE);
    expect(cards[0]!.slug).toBe('rune-ward');
  });

  it('joins a name that was set as more than one run', () => {
    const one = card(82, 5, 0);
    const runs = one.runs.filter((r) => r.text !== 'Rune ward');
    runs.push(
      run('Arcana', 60, 150, 30, 10, 'EvelethCleanRegular', 8),
      run('Touched', 92, 150, 34, 10, 'EvelethCleanRegular', 8),
    );
    expect(locateCards(runs, one.images, PAGE)[0]!.slug).toBe('arcana-touched');
  });

  it('answers with nothing on a page that carries no credits', () => {
    expect(locateCards([run('Adversaries', 10, 10, 60, 8)], [], PAGE)).toEqual([]);
  });
});
