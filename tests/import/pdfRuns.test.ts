import { describe, expect, it } from 'vitest';
import {
  runsFromTextContent,
  stripSubsetPrefix,
  type PdfTextContent,
  type PdfViewport,
} from '../../src/import/pdfRuns.ts';

const PAGE_HEIGHT = 792;

/** A scale-1, unrotated viewport: the only thing it does is flip y. */
const viewport: PdfViewport = {
  width: 612,
  height: PAGE_HEIGHT,
  convertToViewportPoint: (x, y) => [x, PAGE_HEIGHT - y],
};

const families = { get: (id: string) => id };

const ASCENT = 0.9;
const DESCENT = -0.25;

const content = (
  items: Array<{ str: string; x: number; y: number; width: number; size: number; font?: string }>,
  transform?: (i: { x: number; y: number; size: number }) => number[],
): PdfTextContent => ({
  items: items.map((i) => ({
    str: i.str,
    transform: transform ? transform(i) : [i.size, 0, 0, i.size, i.x, i.y],
    width: i.width,
    height: i.size,
    fontName: i.font ?? 'QuestaSans-Light',
  })),
  styles: {
    'QuestaSans-Light': { ascent: ASCENT, descent: DESCENT },
    'QuestaSans-Bold': { ascent: ASCENT, descent: DESCENT },
    'QuestaSlab-LightItalic': { ascent: ASCENT, descent: DESCENT },
    EvelethCleanRegular: { ascent: ASCENT, descent: DESCENT },
    Unmeasured: { ascent: 0, descent: 0 },
  },
});

describe('stripSubsetPrefix', () => {
  it('drops the six-letter subset tag and nothing else', () => {
    expect(stripSubsetPrefix('VKAOSH+QuestaSans-Light')).toBe('QuestaSans-Light');
    expect(stripSubsetPrefix('QuestaSans-Light')).toBe('QuestaSans-Light');
    expect(stripSubsetPrefix('Foo+Bar')).toBe('Foo+Bar');
  });
});

describe('runsFromTextContent', () => {
  it('turns a baseline origin into a top-left box with y growing downward', () => {
    const [run] = runsFromTextContent(
      content([{ str: 'Difficulty', x: 100, y: 700, width: 50, size: 10 }]),
      viewport,
      families,
    );
    expect(run).toBeDefined();
    // Baseline at PDF y=700 on a 792pt page is 92pt from the top; the box
    // starts one ascent above that and is ascent+descent tall.
    expect(run!.x).toBeCloseTo(100, 6);
    expect(run!.y).toBeCloseTo(PAGE_HEIGHT - 700 - ASCENT * 10, 6);
    expect(run!.w).toBeCloseTo(50, 6);
    expect(run!.h).toBeCloseTo((ASCENT - DESCENT) * 10, 6);
    expect(run!.size).toBeCloseTo(10, 6);
    expect(run!.text).toBe('Difficulty');
  });

  it('puts a lower line further down the page, not further up', () => {
    const runs = runsFromTextContent(
      content([
        { str: 'first', x: 50, y: 700, width: 30, size: 10 },
        { str: 'second', x: 50, y: 688, width: 30, size: 10 },
      ]),
      viewport,
      families,
    );
    expect(runs[1]!.y).toBeGreaterThan(runs[0]!.y);
  });

  it('bounds rotated text instead of pretending it is horizontal', () => {
    // A 90-degree run: the advance direction is up the page.
    const rotated = runsFromTextContent(
      content([{ str: 'DOMAIN LEVEL 1', x: 580, y: 400, width: 100, size: 12 }], (i) => [
        0,
        i.size,
        -i.size,
        0,
        i.x,
        i.y,
      ]),
      viewport,
      families,
    );
    const [run] = rotated;
    expect(run!.h).toBeCloseTo(100, 6);
    expect(run!.w).toBeCloseTo((ASCENT - DESCENT) * 12, 6);
    expect(run!.h).toBeGreaterThan(run!.w);
  });

  it('drops blank items but keeps the space they take up', () => {
    const runs = runsFromTextContent(
      content([
        { str: 'Make a', x: 100, y: 700, width: 20, size: 7 },
        { str: ' ', x: 120, y: 700, width: 2, size: 7 },
        { str: 'Spellcast Roll', x: 122, y: 700, width: 44, size: 7 },
      ]),
      viewport,
      families,
    );
    expect(runs.map((r) => r.text)).toEqual(['Make a', 'Spellcast Roll']);
    // The dropped space survives as the gap the line assembler measures.
    expect(runs[1]!.x - (runs[0]!.x + runs[0]!.w)).toBeCloseTo(2, 6);
  });

  it('reads weight and slope out of the family, the way the parsers expect', () => {
    const runs = runsFromTextContent(
      content([
        { str: 'a', x: 0, y: 700, width: 5, size: 8, font: 'QuestaSans-Light' },
        { str: 'b', x: 10, y: 700, width: 5, size: 8, font: 'QuestaSans-Bold' },
        { str: 'c', x: 20, y: 700, width: 5, size: 8, font: 'QuestaSlab-LightItalic' },
        { str: 'd', x: 30, y: 700, width: 5, size: 8, font: 'EvelethCleanRegular' },
      ]),
      viewport,
      families,
    );
    expect(runs.map((r) => [r.bold, r.italic])).toEqual([
      [false, false],
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(runs[3]!.family.startsWith('Eveleth')).toBe(true);
  });

  it('falls back to sane metrics when the font declares none', () => {
    const [run] = runsFromTextContent(
      content([{ str: 'x', x: 0, y: 700, width: 5, size: 10, font: 'Unmeasured' }]),
      viewport,
      families,
    );
    expect(run!.h).toBeGreaterThan(0);
    expect(Number.isFinite(run!.y)).toBe(true);
  });

  it('skips a degenerate run rather than emitting a zero-size box', () => {
    const runs = runsFromTextContent(
      content([{ str: 'x', x: 0, y: 700, width: 5, size: 0 }]),
      viewport,
      families,
    );
    expect(runs).toEqual([]);
  });
});
