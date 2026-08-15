/**
 * pdf.js -> `TextRun` adapter, so the runtime importer can feed the same
 * `textLayout.ts` and `parsers/` the build pipeline uses.
 *
 * WHY pdf.js IS SAFE HERE AND NOT ON THE SRD
 * ------------------------------------------
 * `tools/pdfText.ts` refuses pdf.js because the SRD's subset fonts carry no
 * usable ToUnicode map and every card level arrives as a C0 control character.
 * The Core Rulebook is a different file: Quartz re-embeds the fonts with
 * correct unicode maps, so pdf.js reads it exactly. That is a claim about one
 * file, not about pdf.js, so `detectSource.ts` re-checks it on the user's copy
 * before anything downstream trusts the text.
 *
 * THE TWO COORDINATE SYSTEMS
 * --------------------------
 * `TextRun` is poppler-shaped: an axis-aligned box with y growing *downward*
 * from the top of the page. pdf.js gives a text matrix in PDF user space, y
 * growing *upward*, whose origin is the baseline start of the run - not a box
 * at all. The box is reconstructed from the font's ascent and descent and then
 * mapped through the viewport, which is what flips y. Corners are transformed
 * individually rather than the origin alone, so rotated text still yields a
 * correct bounding box instead of a plausible-looking wrong one.
 *
 * FONT FAMILIES COST AN OPERATOR LIST
 * -----------------------------------
 * `getTextContent` reports a font as `g_d0_f7` with a CSS fallback family of
 * `sans-serif`; the real name (`VKAOSH+QuestaSans-Light`) only reaches the main
 * thread when a page's operator list is built. The parsers key on that name -
 * `isDisplay` is `family.startsWith('Eveleth')` - so it has to be recovered.
 * Font ids are per-document, so a page only pays for the operator list if it
 * introduces a face nothing has named yet: 93 of the Core Rulebook's 397 pages,
 * not 397.
 */
import type { TextRun } from '../../shared/textLayout.ts';

/** The pdf.js surface this module uses. Structural, so tests need no PDF. */
export interface PdfTextItem {
  str: string;
  /** [a, b, c, d, e, f] - (e, f) is the baseline origin in PDF user space. */
  transform: number[];
  /** Advance width, already in device units. */
  width: number;
  height: number;
  fontName: string;
}

export interface PdfTextStyle {
  ascent: number;
  descent: number;
}

export interface PdfTextContent {
  items: Array<PdfTextItem | { type: string }>;
  styles: Record<string, PdfTextStyle | undefined>;
}

export interface PdfViewport {
  width: number;
  height: number;
  convertToViewportPoint(x: number, y: number): number[];
}

export interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  getTextContent(): Promise<PdfTextContent>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  commonObjs: { has(id: string): boolean; get(id: string): { name?: string } | null };
  cleanup(): void;
}

export interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

/** A page of positioned words, the shape `layoutPages` consumes. */
export interface RawPage {
  number: number;
  width: number;
  height: number;
  runs: TextRun[];
}

/**
 * Fonts with no ascent/descent in their descriptor. Chosen to match the metrics
 * of the book's text faces closely enough that a run's box still lands on the
 * right line; `bandsOf` groups by mid-height, so a small error is absorbed.
 */
const FALLBACK_ASCENT = 0.9;
const FALLBACK_DESCENT = -0.25;

/**
 * Weight and slope live in the family name here - unlike poppler, pdf.js
 * exposes no per-run styling. `-Medium` counts as bold because the SRD's
 * `isBoldSans` was calibrated against poppler, which reports QuestaSans-Medium
 * as bold.
 */
const BOLD_RE = /-\s*(?:Bold|Semi ?Bold|Extra ?Bold|Ultra ?Bold|Medium|Black|Heavy)/i;
const ITALIC_RE = /Italic|Oblique/i;

/** `VKAOSH+QuestaSans-Light` -> `QuestaSans-Light`. */
export const stripSubsetPrefix = (name: string): string => name.replace(/^[A-Z]{6}\+/, '');

export const isTextItem = (item: PdfTextItem | { type: string }): item is PdfTextItem =>
  typeof (item as PdfTextItem).str === 'string';

/**
 * Resolves pdf.js font ids to real family names, building a page's operator
 * list only when that page introduces a face that has not been named yet.
 */
export class FontFamilies {
  private readonly byId = new Map<string, string>();

  /** How many operator lists were built. Reported in the import log. */
  operatorLists = 0;

  get(id: string): string {
    return this.byId.get(id) ?? 'unknown';
  }

  /** Name every face `content` uses, paying for an operator list at most once. */
  async learn(page: PdfPage, content: PdfTextContent): Promise<void> {
    const missing = new Set<string>();
    for (const item of content.items) {
      if (!isTextItem(item) || item.str.trim().length === 0) continue;
      if (!this.byId.has(item.fontName)) missing.add(item.fontName);
    }
    if (missing.size === 0) return;

    await page.getOperatorList();
    this.operatorLists += 1;
    for (const id of missing) {
      // A face can stay unresolved when the page draws no glyph with it; name
      // it anyway so the next page does not build another operator list.
      const name = page.commonObjs.has(id) ? (page.commonObjs.get(id)?.name ?? '') : '';
      this.byId.set(id, name ? stripSubsetPrefix(name) : 'unknown');
    }
  }
}

/** Convert one page's text content into positioned, font-tagged runs. */
export function runsFromTextContent(
  content: PdfTextContent,
  viewport: PdfViewport,
  families: Pick<FontFamilies, 'get'>,
): TextRun[] {
  const runs: TextRun[] = [];

  for (const item of content.items) {
    if (!isTextItem(item)) continue;
    if (item.str.trim().length === 0) continue;

    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = item.transform;
    // |(c, d)| is the effective point size; |(a, b)| the advance direction.
    const size = Math.hypot(c, d);
    if (!(size > 0)) continue;
    const advance = Math.hypot(a, b) || 1;

    const style = content.styles[item.fontName];
    const ascent = style && style.ascent !== 0 ? style.ascent : FALLBACK_ASCENT;
    const descent = style && style.descent !== 0 ? style.descent : FALLBACK_DESCENT;

    const ux = a / advance;
    const uy = b / advance;
    const vx = c / size;
    const vy = d / size;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const along of [0, item.width]) {
      for (const up of [descent * size, ascent * size]) {
        const [px = 0, py = 0] = viewport.convertToViewportPoint(
          e + ux * along + vx * up,
          f + uy * along + vy * up,
        );
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }

    const family = families.get(item.fontName);
    runs.push({
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      // Kept verbatim: pdf.js already resolved ligatures and normalised
      // unicode, and `assembleLines` decides spacing from the geometry.
      text: item.str,
      family,
      size,
      bold: BOLD_RE.test(family),
      italic: ITALIC_RE.test(family),
    });
  }

  return runs;
}

/** Extract one page. The page proxy is released before returning. */
export async function extractPage(
  doc: PdfDocument,
  pageNumber: number,
  families: FontFamilies,
): Promise<RawPage> {
  const page = await doc.getPage(pageNumber);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    await families.learn(page, content);
    return {
      number: pageNumber,
      width: viewport.width,
      height: viewport.height,
      runs: runsFromTextContent(content, viewport, families),
    };
  } finally {
    page.cleanup();
  }
}

/**
 * Extract every page in order.
 *
 * Pages are released as they are read, so peak memory is one page of glyphs
 * plus the accumulated runs - a few megabytes for the whole book, against the
 * 319 MB of the file itself, which never lands in memory at all.
 */
export async function extractPages(
  doc: PdfDocument,
  families: FontFamilies,
  onPage?: (done: number, total: number) => void,
  signal?: { aborted: boolean },
): Promise<RawPage[]> {
  const pages: RawPage[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
    pages.push(await extractPage(doc, n, families));
    onPage?.(n, doc.numPages);
  }
  return pages;
}

/** Plain text of a page, for probes. Reading order is not guaranteed. */
export function pageText(content: PdfTextContent): string {
  return content.items
    .filter(isTextItem)
    .map((i) => i.str)
    .join(' ');
}
