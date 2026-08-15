/**
 * Card illustrations, out of the book's printable card sheets and into the
 * `art` store.
 *
 * WHY THE CARD SHEETS AND NOT THE CHAPTERS
 * ----------------------------------------
 * The Core Rulebook ends with thirty pages of press-ready cards - nine to a
 * page, 270 in all: every domain card, every subclass card, every ancestry and
 * community. They are the only part of the book with a rigid grid, and each
 * card carries its own name and the publisher's card number in the footer. So
 * the art is located geometrically, not by understanding the chapter layouts,
 * and a card either yields a clean rectangle or is reported as skipped. There
 * is no middle state where a card quietly gets its neighbour's picture.
 *
 * HOW A CARD'S RECTANGLE IS FOUND
 * -------------------------------
 * The `DH Core 082/270` credit is the anchor: nine of them per sheet, in a
 * regular grid, which gives the column pitch and the row pitch without
 * assuming either. The credit is *not* centred in its card, though, so it is
 * only used to assign runs and images to a cell; the card's true horizontal
 * centre comes from the text block inside it, which is set with equal margins.
 * The illustration is then the union of the image XObjects that start at the
 * top of the cell - the card frame and the domain emblem sit lower and are
 * excluded by that alone, which matters because the same frame is sometimes
 * embedded as a distinct XObject per card and so cannot be recognised by being
 * drawn more than once.
 *
 * WHY 600 PX AND WHY NOT UPSCALE
 * ------------------------------
 * 600 px on the long edge is what an art pack budget of ~20 MB for 270 cards
 * allows, and it is more than any card slot on screen needs. A card's
 * illustration is about 200 pt wide, so the sheet is rasterised at 3x to clear
 * 600 px, and a crop that still lands short is left short: a blurry upscale
 * would cost bytes and add nothing.
 */
import type { TextRun } from '../../shared/textLayout.ts';
import { slugify } from '../../shared/slugify.ts';
import { putArt, type ArtRecord } from '../store/db.ts';
import type { PdfDocument, PdfPage, PdfViewport, RawPage } from './pdfRuns.ts';
import { FontFamilies, runsFromTextContent } from './pdfRuns.ts';

/** Axis-aligned box in page points, y growing downward. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImagePaint {
  /** pdf.js object id. The same asset can appear under several ids. */
  id: string;
  rect: Rect;
}

export interface CardCell {
  /** The publisher's own card number, from `DH Core 082/270`. */
  number: number;
  total: number;
  /** Name as printed, e.g. `Rune ward`. Empty when it could not be read. */
  name: string;
  /** `slugify(name)`, the join key into the dataset. Empty if no name. */
  slug: string;
  cell: Rect;
  /** Null when no image on the sheet belongs to this card. */
  art: Rect | null;
}

export const LONG_EDGE = 600;
export const RENDER_SCALE = 3;
export const WEBP_QUALITY = 0.82;

/** `DH Core 082/270 |` */
const CREDIT_RE = /DH\s*Core\s*(\d+)\s*\/\s*(\d+)/i;
/** The card's kind, set in the same face as its name. Never the name itself. */
const CARD_TYPE_RE = /^(?:ability|spell|grimoire)$/i;
/** The book's display face. Card names are the only body use of it. */
const isDisplay = (r: TextRun): boolean => r.family.startsWith('Eveleth');
/**
 * Sheets carry a rotated tab up the outer margin (`DOMAIN LEVEL 1`), set in
 * the same face at a larger size than the card names. A rotated run is taller
 * than it is wide, which is enough to tell them apart without a rotation flag.
 */
const isHorizontal = (r: TextRun): boolean => r.w >= r.h;

/** Images narrower than this fraction of a card are frame parts, not art. */
const ART_MIN_WIDTH_FRAC = 0.7;
/** Art layers share a top edge to within about a point; the frame is far below. */
const ART_TOP_TOLERANCE = 15;
/**
 * How far down the card an illustration is allowed to reach.
 *
 * A domain card's picture stops where its text panel starts, about 55% down,
 * and the image boxes say so exactly. Ancestry and community cards are
 * different: the portrait bleeds the full height of the card with the text set
 * over it, and no image boundary marks where the picture stops being a
 * picture. The cap is what keeps those from arriving as a card-shaped slab of
 * rules text, and it costs the domain cards nothing.
 */
const ART_MAX_HEIGHT_FRAC = 0.65;

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Cluster values that are within `tol` of each other, returning the centres. */
function clusters(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let group: number[] = [];
  for (const v of sorted) {
    if (group.length > 0 && v - group[group.length - 1]! > tol) {
      out.push(median(group));
      group = [];
    }
    group.push(v);
  }
  if (group.length > 0) out.push(median(group));
  return out;
}

const pitchOf = (centres: number[], fallback: number): number =>
  centres.length < 2
    ? fallback
    : median(centres.slice(1).map((v, i) => v - centres[i]!));

const overlapsX = (r: Rect, x0: number, x1: number): boolean => {
  const mid = r.x + r.w / 2;
  return mid >= x0 && mid < x1;
};

/**
 * Find every card on one sheet.
 *
 * Pure geometry: give it the page's runs and its painted image boxes and it
 * answers with cells. That is what makes the fiddly part testable without a
 * PDF, a canvas or a browser.
 */
export function locateCards(
  runs: readonly TextRun[],
  images: readonly ImagePaint[],
  page: { width: number; height: number },
): CardCell[] {
  const credits = runs
    .map((r) => ({ run: r, m: CREDIT_RE.exec(r.text) }))
    .filter((c): c is { run: TextRun; m: RegExpExecArray } => c.m !== null);
  if (credits.length === 0) return [];

  const colCentres = clusters(credits.map((c) => c.run.x + c.run.w / 2), 20);
  const rowCentres = clusters(credits.map((c) => c.run.y), 6);
  const colPitch = pitchOf(colCentres, page.width / Math.max(1, colCentres.length));
  const rowPitch = pitchOf(rowCentres, page.height / Math.max(1, rowCentres.length));

  const cards: CardCell[] = [];
  for (const { run, m } of credits) {
    const creditMid = run.x + run.w / 2;
    const coarseX0 = creditMid - colPitch / 2;
    const coarseX1 = creditMid + colPitch / 2;
    const coarseY1 = run.y + run.h;
    const coarseY0 = coarseY1 - rowPitch;

    const mine = runs.filter(
      (r) =>
        isHorizontal(r) &&
        r.x + r.w / 2 >= coarseX0 &&
        r.x + r.w / 2 < coarseX1 &&
        r.y + r.h / 2 >= coarseY0 &&
        r.y + r.h / 2 <= coarseY1,
    );

    // The card is set with equal side margins, so its text block is centred in
    // it even though the credit line is not.
    const centre =
      mine.length > 0
        ? (Math.min(...mine.map((r) => r.x)) + Math.max(...mine.map((r) => r.x + r.w))) / 2
        : creditMid;
    const cellX = centre - colPitch / 2;

    const candidates = images.filter(
      (img) =>
        img.rect.w >= colPitch * ART_MIN_WIDTH_FRAC &&
        overlapsX(img.rect, coarseX0, coarseX1) &&
        img.rect.y + img.rect.h / 2 >= coarseY0 &&
        img.rect.y + img.rect.h / 2 < coarseY1,
    );

    let art: Rect | null = null;
    let cellY = coarseY0;
    if (candidates.length > 0) {
      const highest = Math.min(...candidates.map((c) => c.rect.y));
      const layers = candidates.filter((c) => c.rect.y <= highest + ART_TOP_TOLERANCE);
      // The illustration is flush with the top of the card, so it also fixes
      // the cell's top edge - more precisely than the credit ever could. Art
      // is printed with bleed, so it can start above the trimmed page.
      cellY = Math.max(0, highest);
      const left = Math.max(cellX, 0, Math.min(...layers.map((c) => c.rect.x)));
      const right = Math.min(
        cellX + colPitch,
        page.width,
        Math.max(...layers.map((c) => c.rect.x + c.rect.w)),
      );
      const bottom = Math.min(
        Math.max(...layers.map((c) => c.rect.y + c.rect.h)),
        cellY + rowPitch * ART_MAX_HEIGHT_FRAC,
        page.height,
      );
      if (right > left && bottom > cellY) {
        art = { x: left, y: cellY, w: right - left, h: bottom - cellY };
      }
    }

    const named = mine.filter(
      (r) => isDisplay(r) && !/^\d+$/.test(r.text.trim()) && !CARD_TYPE_RE.test(r.text.trim()),
    );
    let name = '';
    if (named.length > 0) {
      const biggest = Math.max(...named.map((r) => r.size));
      name = named
        .filter((r) => r.size >= biggest - 0.01)
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((r) => r.text.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    cards.push({
      number: Number(m[1]),
      total: Number(m[2]),
      name,
      slug: slugify(name),
      cell: { x: cellX, y: cellY, w: colPitch, h: rowPitch },
      art,
    });
  }

  return cards.sort((a, b) => a.number - b.number);
}

// ---------------------------------------------------------------------------
// pdf.js side
// ---------------------------------------------------------------------------

interface RenderablePage extends PdfPage {
  render(params: {
    canvasContext: unknown;
    canvas: unknown;
    viewport: PdfViewport;
  }): { promise: Promise<void>; cancel?: () => void };
}

const matmul = (a: readonly number[], b: readonly number[]): number[] => [
  a[0]! * b[0]! + a[1]! * b[2]!,
  a[0]! * b[1]! + a[1]! * b[3]!,
  a[2]! * b[0]! + a[3]! * b[2]!,
  a[2]! * b[1]! + a[3]! * b[3]!,
  a[4]! * b[0]! + a[5]! * b[2]! + b[4]!,
  a[4]! * b[1]! + a[5]! * b[3]! + b[5]!,
];

/**
 * Where every image on the page is painted, in the same coordinates as the
 * runs.
 *
 * pdf.js reports images as a paint op plus whatever the current transform
 * happens to be, so the graphics state has to be replayed. An image occupies
 * the unit square under that matrix, and the matrix is not always a plain
 * scale: the book mirrors illustrations by negating the horizontal term, so
 * all four corners are mapped and compared rather than two being added.
 */
export async function imagePaints(page: PdfPage, viewport: PdfViewport): Promise<ImagePaint[]> {
  // Imported here rather than at the top of the file: pdf.js touches DOMMatrix
  // while it initialises, which keeps the whole module out of a plain Node
  // test run - and `locateCards`, the part most worth testing, needs no
  // browser at all. The module is loaded once and cached by the runtime.
  const { OPS } = await import('pdfjs-dist');
  const ops = await page.getOperatorList();
  const paints: ImagePaint[] = [];
  const stack: number[][] = [];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) {
      stack.push([...ctm]);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
    } else if (fn === OPS.transform) {
      ctm = matmul(ops.argsArray[i] as number[], ctm);
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintImageMaskXObject) {
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = ctm;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [u, v] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        const [x = 0, y = 0] = viewport.convertToViewportPoint(
          a * u + c * v + e,
          b * u + d * v + f,
        );
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      paints.push({
        id: String((ops.argsArray[i] as unknown[])[0]),
        rect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      });
    }
  }
  return paints;
}

/**
 * A printable card sheet: a page carrying a grid of card credits. Four is a
 * low bar on purpose - a sheet with a short last row still counts, and no
 * chapter page prints the credit line even once.
 */
export function isCardSheet(runs: readonly TextRun[]): boolean {
  return runs.filter((r) => CREDIT_RE.test(r.text)).length >= 4;
}

/** The sheet page numbers among pages already extracted for parsing. */
export const findCardSheets = (pages: readonly RawPage[]): number[] =>
  pages.filter((p) => isCardSheet(p.runs)).map((p) => p.number);

export interface ArtImage {
  slug: string;
  name: string;
  /** The publisher's card number, so a skip can be pointed at a card. */
  number: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface SheetResult {
  page: number;
  images: ArtImage[];
  /** Cards on this sheet that produced nothing, with the reason. */
  skipped: Array<{ number: number; name: string; reason: string }>;
}

/**
 * Rasterise one sheet and cut its cards out of it.
 *
 * One page is rendered at a time and dropped before the next, so peak memory
 * is a single 1836x2376 bitmap - about 17 MB - plus the finished WebPs, which
 * are two orders of magnitude smaller than the pixels they came from.
 */
export async function extractSheet(
  doc: PdfDocument,
  pageNumber: number,
  families: FontFamilies,
): Promise<SheetResult> {
  const page = (await doc.getPage(pageNumber)) as RenderablePage;
  const skipped: SheetResult['skipped'] = [];
  const images: ArtImage[] = [];
  let sheet: OffscreenCanvas | null = null;

  try {
    const unit = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    await families.learn(page, content);
    const runs = runsFromTextContent(content, unit, families);
    const cards = locateCards(runs, await imagePaints(page, unit), unit);
    if (cards.length === 0) return { page: pageNumber, images, skipped };

    const viewport = page.getViewport({ scale: RENDER_SCALE });
    sheet = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('This browser gave no 2d canvas context; art cannot be extracted.');
    await page.render({ canvasContext: ctx, canvas: sheet, viewport }).promise;

    for (const card of cards) {
      if (!card.slug) {
        skipped.push({ number: card.number, name: card.name, reason: 'no readable card name' });
        continue;
      }
      if (!card.art) {
        skipped.push({ number: card.number, name: card.name, reason: 'no illustration found' });
        continue;
      }
      images.push({
        slug: card.slug,
        name: card.name,
        number: card.number,
        ...(await crop(sheet, card.art)),
      });
    }
  } finally {
    // Free the sheet bitmap before the next page allocates its own - including
    // when a card threw halfway, since the thrower is usually the browser
    // refusing to encode WebP and the caller may well report and carry on.
    if (sheet) {
      sheet.width = 0;
      sheet.height = 0;
    }
    page.cleanup();
  }

  return { page: pageNumber, images, skipped };
}

async function crop(
  sheet: OffscreenCanvas,
  rect: Rect,
): Promise<{ blob: Blob; width: number; height: number }> {
  const sx = rect.x * RENDER_SCALE;
  const sy = rect.y * RENDER_SCALE;
  const sw = rect.w * RENDER_SCALE;
  const sh = rect.h * RENDER_SCALE;
  const shrink = Math.min(1, LONG_EDGE / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * shrink));
  const height = Math.max(1, Math.round(sh * shrink));

  const out = new OffscreenCanvas(width, height);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('This browser gave no 2d canvas context; art cannot be extracted.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, width, height);

  const blob = await out.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
  if (blob.type !== 'image/webp') {
    // Safari used to answer a WebP request with a PNG. A pack four times the
    // size is not a silent detail on a phone, so refuse rather than absorb it.
    throw new Error(
      `This browser cannot encode WebP (it produced ${blob.type || 'an unknown type'}). ` +
        'Import the Core Rulebook in a browser that can, or the art pack would be ' +
        'several times larger than it should be.',
    );
  }
  return { blob, width, height };
}

export interface ArtProgress {
  page: number;
  sheets: number;
  sheetIndex: number;
  stored: number;
}

export interface ArtImportResult {
  /** Slugs written to the `art` store. */
  slugs: string[];
  skipped: SheetResult['skipped'];
}

/**
 * Extract every card sheet in `pages` and write the results to the `art` store.
 *
 * Records are written per sheet rather than at the end: an import interrupted
 * halfway leaves the cards it already did, and re-running simply overwrites
 * them.
 */
export async function importCardArt(
  doc: PdfDocument,
  pages: readonly number[],
  layerId: string,
  onProgress?: (p: ArtProgress) => void,
  signal?: { aborted: boolean },
): Promise<ArtImportResult> {
  const families = new FontFamilies();
  const slugs: string[] = [];
  const taken = new Set<string>();
  const skipped: SheetResult['skipped'] = [];

  for (const [i, pageNumber] of pages.entries()) {
    if (signal?.aborted) throw new DOMException('Import cancelled', 'AbortError');
    const sheet = await extractSheet(doc, pageNumber, families);
    skipped.push(...sheet.skipped);

    const records: ArtRecord[] = [];
    for (const img of sheet.images) {
      // Each subclass prints three cards - foundation, specialization,
      // mastery - and the dataset has one entity for all three. The sheets are
      // in that order, so the first card to claim a slug is the foundation,
      // which is the one worth keeping.
      if (taken.has(img.slug)) {
        skipped.push({
          number: img.number,
          name: img.name,
          reason: `another card already claimed "${img.slug}"`,
        });
        continue;
      }
      taken.add(img.slug);
      records.push({
        key: img.slug,
        layerId,
        blob: img.blob,
        width: img.width,
        height: img.height,
      });
    }
    if (records.length > 0) await putArt(records);
    slugs.push(...records.map((r) => r.key));

    onProgress?.({ page: pageNumber, sheets: pages.length, sheetIndex: i + 1, stored: slugs.length });
  }

  return { slugs, skipped };
}

/** Store images that came out of an art pack. No PDF, no canvas, no parsing. */
export async function storeArtPackImages(
  entries: ReadonlyArray<{ slug: string; blob: Blob; width: number; height: number }>,
  layerId: string,
): Promise<number> {
  const BATCH = 24;
  let written = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await putArt(batch.map((e) => ({ key: e.slug, layerId, blob: e.blob, width: e.width, height: e.height })));
    written += batch.length;
  }
  return written;
}
