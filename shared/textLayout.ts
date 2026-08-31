/**
 * De-columnisation: turn positioned words into a correctly ordered line
 * stream, one entry per printed book page.
 *
 * Written to be shared by the build pipeline (SRD) and the runtime Core
 * Rulebook importer, which is why it imports nothing Node-specific.
 *
 * The importer has been removed, so today every consumer - `tools/loadSrd.ts`,
 * `tools/dumpLayout.ts` and `shared/parsers/*` - runs under Node at build time,
 * and nothing in `src/` reaches this file at all. The constraint is therefore
 * no longer load-bearing; it is left standing rather than relaxed, because
 * relaxing it is a decision about where this module lives (it and the parsers
 * under it are now build-time code sitting in `shared/`), and that is a
 * separate question from removing an importer.
 *
 * THE THREE THINGS THAT MAKE THIS NON-TRIVIAL
 * -------------------------------------------
 * 1. The SRD is imposed as **spreads**: every PDF page after the cover is
 *    1224x792pt, two letter pages side by side. Read naively you interleave
 *    two unrelated book pages. Nothing in the file announces this; only the
 *    aspect ratio gives it away.
 * 2. Each book page is then set in two columns, so a spread carries four
 *    columns and a top-to-bottom read shreds every card and stat block.
 * 3. Column structure changes *within* a page. Folio 56 sets two columns of
 *    prose above full-width armor tables; folio 103 sets a four-column
 *    contents list above two-column stat blocks. Projecting such a page onto
 *    one axis finds no gutter at all, because some other band bridges it.
 *
 * The answer to (3) is a recursive XY-cut. At each step the block is split by
 * whichever whitespace is genuinely there, and the pieces are emitted in
 * reading order. The cut order matters and is not arbitrary:
 *
 *   1. large full-width horizontal gaps  - real layout breaks (banner, table)
 *   2. a full-height vertical gutter     - a genuine multi-column region
 *   3. small full-width horizontal gaps  - paragraph breaks inside one column
 *
 * Horizontal before vertical, because cutting vertically first would slice a
 * full-width banner in half. Vertical before *small* horizontal, because that
 * is what stops a two-column region whose columns happen to break at the same
 * height from being interleaved: if a real gutter exists it is taken first,
 * and step 3 then only ever runs on something already known to be one column.
 */
import type { TextRun } from '../tools/pdfText.ts';

export type { TextRun };

/** One visual line of text, with its dominant typographic signals. */
export interface Line {
  text: string;
  x: number;
  y: number;
  w: number;
  /** Largest point size on the line - what makes a heading a heading. */
  size: number;
  /** Family of the run carrying the most characters. */
  family: string;
  /** True when every run on the line is bold. */
  bold: boolean;
  italic: boolean;
  /** Index of the column this line sits in, within its region of the page. */
  column: number;
  runs: TextRun[];
}

export interface BookPage {
  /** 0-based position in whole-document reading order. */
  index: number;
  /** Printed folio, when a page number could be read from the running foot. */
  folio: number | null;
  /** 1-based PDF page this came from. */
  pdfPage: number;
  side: 'left' | 'right' | 'single';
  width: number;
  height: number;
  /** Widest column count found anywhere on the page. */
  columns: number;
  lines: Line[];
  /** Every word on the page, unordered. Table parsers need raw geometry. */
  runs: TextRun[];
}

export interface LayoutOptions {
  /** Aspect ratio above which a page is treated as a two-up spread. */
  spreadAspect?: number;
  /** Minimum gutter width, in points, for a vertical cut. */
  minGutter?: number;
  /** Minimum gutter width as a fraction of the block being cut. */
  minGutterFrac?: number;
  /** Large horizontal gap, in median line heights. */
  bigGapFactor?: number;
  /** Small horizontal gap, in median line heights. */
  smallGapFactor?: number;
  /** Vertical tolerance for "same line", as a fraction of run height. */
  lineTolFrac?: number;
  /** Bottom band treated as running foot, as a fraction of page height. */
  footerFrac?: number;
  /** A block with fewer bands than this is never cut vertically. */
  minBandsForGutter?: number;
}

const DEFAULTS: Required<LayoutOptions> = {
  spreadAspect: 1.1,
  minGutter: 7,
  minGutterFrac: 0.012,
  bigGapFactor: 1.8,
  smallGapFactor: 0.55,
  lineTolFrac: 0.6,
  footerFrac: 0.955,
  minBandsForGutter: 3,
};

/**
 * Horizontal gap, as a fraction of glyph height, below which two adjacent
 * words are treated as one word split by a ligature glyph rather than two
 * words separated by a space. See `assembleLines`.
 */
export const WORD_JOIN_RATIO = 0.08;

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Group runs into horizontal bands - one per visual line. */
function bandsOf(runs: TextRun[], opts: Required<LayoutOptions>): TextRun[][] {
  if (runs.length === 0) return [];
  const tol = Math.max(2, median(runs.map((r) => r.h)) * opts.lineTolFrac);
  const sorted = [...runs].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const out: TextRun[][] = [];
  let current: TextRun[] = [];
  let anchor = Number.NaN;
  for (const r of sorted) {
    // Compare mid-heights: runs of different point sizes share a baseline but
    // not a top edge, and the SRD mixes 8pt body with 12pt bold inline.
    const mid = r.y + r.h / 2;
    if (current.length === 0) {
      current.push(r);
      anchor = mid;
    } else if (Math.abs(mid - anchor) <= tol) {
      current.push(r);
    } else {
      out.push(current);
      current = [r];
      anchor = mid;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** Split at full-width horizontal whitespace of at least `minGap` points. */
function horizontalCut(
  runs: TextRun[],
  minGap: number,
  opts: Required<LayoutOptions>,
): TextRun[][] | null {
  const bands = bandsOf(runs, opts);
  if (bands.length < 2) return null;
  const groups: TextRun[][] = [];
  let current: TextRun[] = [];
  let reach = -Infinity;
  for (const band of bands) {
    const top = Math.min(...band.map((r) => r.y));
    if (current.length > 0 && top - reach >= minGap) {
      groups.push(current);
      current = [];
      reach = -Infinity;
    }
    current.push(...band);
    reach = Math.max(reach, ...band.map((r) => r.y + r.h));
  }
  if (current.length > 0) groups.push(current);
  return groups.length > 1 ? groups : null;
}

/** Split at a whitespace column that runs the full height of the block. */
function verticalCut(runs: TextRun[], opts: Required<LayoutOptions>): TextRun[][] | null {
  if (runs.length < 6) return null;
  if (bandsOf(runs, opts).length < opts.minBandsForGutter) return null;

  const x0 = Math.min(...runs.map((r) => r.x));
  const x1 = Math.max(...runs.map((r) => r.x + r.w));
  const width = x1 - x0;
  const minGap = Math.max(opts.minGutter, width * opts.minGutterFrac);
  if (width <= minGap * 2) return null;

  const bins = Math.ceil(width) + 1;
  const occupied = new Uint8Array(bins);
  for (const r of runs) {
    const a = Math.max(0, Math.floor(r.x - x0));
    const b = Math.min(bins - 1, Math.ceil(r.x + r.w - x0));
    occupied.fill(1, a, b + 1);
  }

  const cuts: number[] = [];
  let run = 0;
  for (let i = 0; i < bins; i++) {
    if (occupied[i]) {
      if (run >= minGap) cuts.push(x0 + i - run / 2);
      run = 0;
    } else {
      run++;
    }
  }
  if (cuts.length === 0) return null;

  const groups: TextRun[][] = Array.from({ length: cuts.length + 1 }, () => []);
  for (const r of runs) {
    const mid = r.x + r.w / 2;
    let i = 0;
    while (i < cuts.length && mid >= cuts[i]!) i++;
    groups[i]!.push(r);
  }
  const kept = groups.filter((g) => g.length > 0);
  return kept.length > 1 ? kept : null;
}

/** A leaf region of the XY-cut: one column's worth of runs, in order. */
interface Region {
  runs: TextRun[];
  column: number;
}

function xyCut(runs: TextRun[], opts: Required<LayoutOptions>, column: number, depth: number): Region[] {
  if (runs.length === 0) return [];
  if (depth > 12) return [{ runs, column }];

  const heights = runs.map((r) => r.h);
  const unit = median(heights) || 8;

  const big = horizontalCut(runs, unit * opts.bigGapFactor, opts);
  if (big) return big.flatMap((g) => xyCut(g, opts, column, depth + 1));

  const cols = verticalCut(runs, opts);
  if (cols) {
    return cols
      .sort((a, b) => Math.min(...a.map((r) => r.x)) - Math.min(...b.map((r) => r.x)))
      .flatMap((g, i) => xyCut(g, opts, i, depth + 1));
  }

  const small = horizontalCut(runs, unit * opts.smallGapFactor, opts);
  if (small) return small.flatMap((g) => xyCut(g, opts, column, depth + 1));

  return [{ runs, column }];
}

/** Turn a region's runs into lines, left to right within each band. */
function assembleLines(region: Region, opts: Required<LayoutOptions>): Line[] {
  return bandsOf(region.runs, opts)
    .map((band) => {
      const ordered = [...band].sort((a, b) => a.x - b.x);

      // Poppler splits a word wherever a ligature glyph sits, so "Difficulty"
      // arrives as the two words "Diffi" + "culty:". The split is invisible in
      // the text but obvious in the geometry: a spurious boundary has no
      // advance at all, while a real inter-word space is ~0.24 of the glyph
      // height. The two populations do not overlap anywhere in the SRD, so one
      // threshold repairs every case without a ligature list or a dictionary.
      let text = '';
      let prevEnd = Number.NaN;
      for (const r of ordered) {
        if (text.length > 0) {
          text += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
        }
        text += r.text;
        prevEnd = r.x + r.w;
      }

      const byFamily = new Map<string, number>();
      for (const r of ordered) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + r.text.length);
      const family = [...byFamily.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const x = Math.min(...ordered.map((r) => r.x));
      const right = Math.max(...ordered.map((r) => r.x + r.w));

      return {
        text: text.replace(/\s+/g, ' ').trim(),
        x,
        y: Math.min(...ordered.map((r) => r.y)),
        w: right - x,
        size: Math.max(...ordered.map((r) => r.size)),
        family,
        bold: ordered.every((r) => r.bold),
        italic: ordered.every((r) => r.italic),
        column: region.column,
        runs: ordered,
      };
    })
    .filter((l) => l.text.length > 0);
}

const FOLIO_RE = /^\s*(\d{1,3})\s*$/;

/**
 * Turn raw PDF pages into book pages with a correct line reading order.
 *
 * `pages` must be in PDF order. Spreads are split left-then-right.
 */
export function layoutPages(
  pages: Array<{ number: number; width: number; height: number; runs: TextRun[] }>,
  options: LayoutOptions = {},
): BookPage[] {
  const opts = { ...DEFAULTS, ...options };
  const out: BookPage[] = [];

  for (const page of pages) {
    const isSpread = page.width / page.height > opts.spreadAspect;
    const halves: Array<{ x0: number; x1: number; side: BookPage['side'] }> = isSpread
      ? [
          { x0: 0, x1: page.width / 2, side: 'left' },
          { x0: page.width / 2, x1: page.width, side: 'right' },
        ]
      : [{ x0: 0, x1: page.width, side: 'single' }];

    for (const half of halves) {
      const all = page.runs.filter((r) => {
        const mid = r.x + r.w / 2;
        return mid >= half.x0 && mid < half.x1;
      });
      if (all.length === 0) continue;

      // Pull the running foot out before layout: it sits outside the text
      // block and would otherwise anchor a phantom column.
      const footTop = page.height * opts.footerFrac;
      const foot = all.filter((r) => r.y >= footTop);
      const body = all.filter((r) => r.y < footTop);
      let folio: number | null = null;
      for (const r of foot) {
        const m = FOLIO_RE.exec(r.text);
        if (m) folio = Number(m[1]);
      }

      const regions = xyCut(body, opts, 0, 0);
      const lines = regions.flatMap((region) => assembleLines(region, opts));

      out.push({
        index: out.length,
        folio,
        pdfPage: page.number,
        side: half.side,
        width: half.x1 - half.x0,
        height: page.height,
        columns: regions.reduce((n, r) => Math.max(n, r.column + 1), 1),
        lines,
        runs: body,
      });
    }
  }
  return out;
}
