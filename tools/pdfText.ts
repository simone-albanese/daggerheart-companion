/**
 * Build-time PDF text extraction, via poppler.
 *
 * WHY POPPLER AND NOT pdf.js
 * --------------------------
 * The SRD's embedded fonts are subsetted with a custom encoding and no usable
 * ToUnicode map for part of their glyph set. pdf.js hands those back as C0
 * control characters, so "Level 5 Arcana Spell / Recall Cost: 2" arrives as
 * "Level \x1C Arcana Spell / Recall Cost: \x12" - every card level and recall
 * cost in the book, silently destroyed. Poppler resolves the same glyphs from
 * the font's built-in encoding. pdf.js stays in `src/import/`, where the
 * Core Rulebook (produced by Quartz, with proper unicode maps) is handled.
 *
 * WHY TWO POPPLER INVOCATIONS
 * ---------------------------
 * Neither poppler front-end alone is sufficient:
 *
 *   `pdftotext -bbox-layout`  correct text, word boxes, no font information
 *   `pdftohtml -xml`          font family / size / weight, but it inserts
 *                             spurious spaces around ligature glyphs:
 *                             "Difficulty" -> "Diffi culty", "profit" ->
 *                             "profi t", "Staff:" -> "Staff :"
 *
 * The ligature damage is not cosmetic - `Difficulty:` is the key the adversary
 * stat-block parser matches on. So words and their text come from
 * `-bbox-layout`, and each word is enriched with the typographic attributes of
 * whichever `pdftohtml` run covers it. Coordinates are normalised to PDF
 * points (pdftohtml renders at 150dpi, i.e. 1.5x points).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** A single word, positioned in PDF points with y growing downward. */
export interface TextRun {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** Font family with the subset prefix stripped, e.g. `QuestaSans-Light`. */
  family: string;
  /** Nominal point size as reported by poppler (150dpi units / 1.5). */
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface RawPage {
  /** 1-based index into the PDF, not the printed folio. */
  number: number;
  width: number;
  height: number;
  runs: TextRun[];
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

interface BboxWord {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}
interface BboxPage {
  number: number;
  width: number;
  height: number;
  words: BboxWord[];
}

/** Parse `pdftotext -bbox-layout` output. Text is authoritative here. */
export function parseBboxXml(xml: string): BboxPage[] {
  const pages: BboxPage[] = [];
  const pageRe = /<page\s+width="([\d.]+)"\s+height="([\d.]+)"\s*>([\s\S]*?)<\/page>/g;
  const wordRe =
    /<word\s+xMin="([-\d.]+)"\s+yMin="([-\d.]+)"\s+xMax="([-\d.]+)"\s+yMax="([-\d.]+)"\s*>([\s\S]*?)<\/word>/g;
  let n = 0;
  for (const pm of xml.matchAll(pageRe)) {
    n += 1;
    const words: BboxWord[] = [];
    for (const wm of (pm[3] ?? '').matchAll(wordRe)) {
      const text = unescapeXml(wm[5] ?? '');
      if (text.trim().length === 0) continue;
      const x0 = Number(wm[1]);
      const y0 = Number(wm[2]);
      const x1 = Number(wm[3]);
      const y1 = Number(wm[4]);
      words.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, text });
    }
    pages.push({ number: n, width: Number(pm[1]), height: Number(pm[2]), words });
  }
  return pages;
}

interface FontRun {
  x: number;
  y: number;
  w: number;
  h: number;
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
}
interface FontPage {
  number: number;
  width: number;
  height: number;
  runs: FontRun[];
}

/**
 * Parse `pdftohtml -xml`. Only the typographic attributes are used; the text
 * is discarded because of the ligature spacing bug described above.
 */
export function parsePdfToHtmlXml(xml: string): FontPage[] {
  // fontspec ids are declared once and referenced by every later page.
  const fonts = new Map<string, { size: number; family: string }>();
  for (const m of xml.matchAll(/<fontspec\s+id="(\d+)"\s+size="(-?[\d.]+)"\s+family="([^"]*)"/g)) {
    fonts.set(m[1]!, {
      size: Math.abs(Number(m[2])),
      family: (m[3] ?? '').split('+').pop() ?? '',
    });
  }

  const pages: FontPage[] = [];
  const pageRe =
    /<page\s+number="(\d+)"[^>]*?height="([\d.]+)"\s+width="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g;
  const textRe =
    /<text\s+top="(-?[\d.]+)"\s+left="(-?[\d.]+)"\s+width="(-?[\d.]+)"\s+height="(-?[\d.]+)"\s+font="(\d+)"\s*>([\s\S]*?)<\/text>/g;

  for (const pm of xml.matchAll(pageRe)) {
    const runs: FontRun[] = [];
    for (const tm of (pm[4] ?? '').matchAll(textRe)) {
      const inner = tm[6] ?? '';
      if (unescapeXml(inner.replace(/<[^>]*>/g, '')).trim().length === 0) continue;
      const font = fonts.get(tm[5]!) ?? { size: 0, family: 'unknown' };
      runs.push({
        y: Number(tm[1]),
        x: Number(tm[2]),
        w: Number(tm[3]),
        h: Number(tm[4]),
        family: font.family,
        size: font.size,
        // The SRD marks the regular cut of QuestaSans with an inline <b>; the
        // family name carries the weight for the other faces.
        bold: /<b>/.test(inner) || /-(Bold|Medium|Semibold|Black)\b/i.test(font.family),
        italic: /<i>/.test(inner) || /Italic/i.test(font.family),
      });
    }
    pages.push({
      number: Number(pm[1]),
      height: Number(pm[2]),
      width: Number(pm[3]),
      runs,
    });
  }
  return pages;
}

/**
 * Attach font attributes from `fontPage` to each word of `bboxPage`.
 *
 * A word is matched to the run whose (scaled) box contains its centre. Words
 * that fall in a gap - poppler's two front-ends disagree slightly on trailing
 * punctuation - inherit from the nearest run on the same line, then from the
 * page's most common body font as a last resort.
 */
export function joinFonts(bbox: BboxPage, font: FontPage | undefined): TextRun[] {
  const scale = font && bbox.width > 0 ? font.width / bbox.width : 1;
  const runs = (font?.runs ?? []).map((r) => ({
    ...r,
    x: r.x / scale,
    y: r.y / scale,
    w: r.w / scale,
    h: r.h / scale,
    size: r.size / scale,
  }));

  // Most common family/size on the page, for words no run covers.
  const tally = new Map<string, { n: number; r: (typeof runs)[number] }>();
  for (const r of runs) {
    const k = `${r.family}|${r.size}|${r.bold}|${r.italic}`;
    const hit = tally.get(k);
    if (hit) hit.n += r.w;
    else tally.set(k, { n: r.w, r });
  }
  const fallback = [...tally.values()].sort((a, b) => b.n - a.n)[0]?.r;

  const byY = [...runs].sort((a, b) => a.y - b.y);

  return bbox.words.map((word) => {
    const cx = word.x + word.w / 2;
    const cy = word.y + word.h / 2;
    let best: (typeof runs)[number] | undefined;
    let bestScore = Infinity;
    for (const r of byY) {
      if (r.y - word.h > cy) break; // runs are y-sorted; nothing below can win
      const inY = cy >= r.y - 1 && cy <= r.y + r.h + 1;
      if (!inY) continue;
      if (cx >= r.x - 1 && cx <= r.x + r.w + 1) {
        best = r;
        bestScore = 0;
        break;
      }
      const dx = cx < r.x ? r.x - cx : cx - (r.x + r.w);
      if (dx < bestScore) {
        bestScore = dx;
        best = r;
      }
    }
    const src = bestScore <= 24 ? best : (best ?? fallback);
    return {
      x: word.x,
      y: word.y,
      w: word.w,
      h: word.h,
      text: word.text,
      family: src?.family ?? 'unknown',
      size: src?.size ?? word.h,
      bold: src?.bold ?? false,
      italic: src?.italic ?? false,
    };
  });
}

export class PopplerMissingError extends Error {
  constructor(bin: string) {
    super(
      `${bin} (poppler-utils) was not found on PATH.\n` +
        '  macOS:  brew install poppler\n' +
        '  Debian: apt-get install -y poppler-utils\n' +
        'The build refuses to fall back to pdf.js: on the SRD it silently\n' +
        'corrupts every card level and recall cost. See tools/pdfText.ts.',
    );
    this.name = 'PopplerMissingError';
  }
}

async function run(bin: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(bin, args, {
      maxBuffer: 1024 * 1024 * 1024,
      encoding: 'utf8',
    });
    return stdout;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new PopplerMissingError(bin);
    throw err;
  }
}

/** Extract every page of `pdfPath` as positioned, font-tagged words. */
export async function extractPages(pdfPath: string): Promise<RawPage[]> {
  const [bboxXml, fontXml] = await Promise.all([
    run('pdftotext', ['-bbox-layout', pdfPath, '-']),
    run('pdftohtml', ['-xml', '-i', '-nodrm', '-stdout', pdfPath]),
  ]);

  const bboxPages = parseBboxXml(bboxXml);
  const fontPages = parsePdfToHtmlXml(fontXml);
  if (bboxPages.length === 0) throw new Error(`pdftotext produced no pages for ${pdfPath}`);

  const fontByNumber = new Map(fontPages.map((p) => [p.number, p]));
  return bboxPages.map((p) => ({
    number: p.number,
    width: p.width,
    height: p.height,
    runs: joinFonts(p, fontByNumber.get(p.number)),
  }));
}
