/**
 * One place that turns the SRD PDF into `BookPage[]`, with the expensive
 * poppler passes cached on disk so parser development is a fast loop.
 *
 * The cache lives in `tools/.cache/` and is gitignored. Delete it to force a
 * re-extraction; it is keyed by the PDF's SHA-256 so a different revision can
 * never be served from a stale cache.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  parseBboxXml,
  parsePdfToHtmlXml,
  joinFonts,
  PopplerMissingError,
  type RawPage,
} from './pdfText.ts';
import { layoutPages, type BookPage } from '../shared/textLayout.ts';
import { remapGlyphs } from './glyphs.ts';

const execFileAsync = promisify(execFile);
const CACHE_DIR = 'tools/.cache';

export interface Book {
  /** Locked: a file whose hash is not here stops the build and gets reviewed. */
  sha256: string;
  revision: string;
  /** How the dataset names this source on screen. */
  label: string;
  /** The revision's own date. Used so the dataset is byte-stable per source. */
  sourceDate: string;
  /** Where the file can be fetched if it is not already on disk. */
  url: string | null;
  /** Searched in order. The first path that exists wins. */
  localPaths: readonly string[];
}

/**
 * Every SRD revision this build knows how to name.
 *
 * A list rather than one constant, and the reason is a defect this replaced
 * rather than tidiness. `loadSrd` returned `revision` and `sourceDate` from the
 * single constant WHATEVER FILE IT HAD READ, so `allowUnknownRevision` - the
 * escape hatch for looking at a different revision - produced a `LoadedSrd`
 * that named the wrong book. Those two fields flow straight into
 * `Dataset.revision` and into the layer the dataset ships, so a build run that
 * way emits a dataset that says it is SRD 1.0 and is not. Nothing downstream
 * can tell; the whole point of pinning a hash is defeated by the one path that
 * skips it.
 *
 * The lock is unchanged: an unrecognised hash still stops the build. What is
 * new is that a RECOGNISED one now brings its own identity, and an unrecognised
 * one that is waved through gets a name that says it is unrecognised.
 */
export const BOOKS: readonly Book[] = [
  {
    sha256: '39c5981ebfc85db071e5fdcebfda3add6c5eaf3d078fb1fd0b3790c912338687',
    revision: 'srd-1.0-2025-09-09',
    label: 'SRD 1.0',
    sourceDate: '2025-09-09T00:00:00.000Z',
    url: 'https://www.daggerheart.com/wp-content/uploads/2025/09/Daggerheart-SRD-9-09-25.pdf',
    localPaths: ['Manuali/Daggerheart-SRD-9-09-25.pdf', 'tools/.cache/Daggerheart-SRD-9-09-25.pdf'],
  },
  {
    /*
     * SRD 2.0. Known, and NOT yet the default: the parsers are keyed to the
     * 1.0 geometry - 67 spreads of 1224x792 against this book's 224 single
     * 612x792 pages - so pointing the build here today produces wrong output,
     * not an error. Listing it is what lets the geometry be measured against
     * the real file without the escape hatch that used to lie about the name.
     *
     * `sourceDate` is the date the file is published under, which is how the
     * revision is identified; the PDF's own CreationDate is 2026-08-21. They
     * disagree, the name is the one people use, and the field only has to be
     * stable per source.
     */
    sha256: '55d8b92b7e58aa1da99a4a59aa77352483ef4fbda71baddb9af9bfc1f333bd2a',
    revision: 'srd-2.0-2026-08-25',
    label: 'SRD 2.0',
    sourceDate: '2026-08-25T00:00:00.000Z',
    url: null,
    localPaths: ['Manuali/DH_SRD_2_2026_08_25.pdf', 'tools/.cache/DH_SRD_2_2026_08_25.pdf'],
  },
];

/** The revision the committed dataset is built from. */
export const SRD: Book = BOOKS[0]!;

export const bookBySha = (sha256: string): Book | undefined =>
  BOOKS.find((b) => b.sha256 === sha256);

export function findSrdPdf(): string | null {
  return SRD.localPaths.find((p) => existsSync(p)) ?? null;
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

async function poppler(bin: string, args: string[]): Promise<string> {
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

async function cachedRun(key: string, bin: string, args: string[]): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = `${CACHE_DIR}/${key}`;
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const out = await poppler(bin, args);
  writeFileSync(file, out);
  return out;
}

export interface LoadOptions {
  /** Skip the SHA-256 gate. Only for exploring a different revision by hand. */
  allowUnknownRevision?: boolean;
  pdfPath?: string;
}

export interface LoadedSrd {
  pdfPath: string;
  sha256: string;
  revision: string;
  /** How the dataset should name this source on screen. */
  label: string;
  sourceDate: string;
  raw: RawPage[];
  pages: BookPage[];
  /** PUA codepoints that survived the remap. Non-empty means: stop. */
  unknownGlyphs: string[];
}

/** Extract, de-columnise and PUA-normalise the SRD. */
export async function loadSrd(options: LoadOptions = {}): Promise<LoadedSrd> {
  const pdfPath = options.pdfPath ?? findSrdPdf();
  if (!pdfPath) {
    throw new Error(
      `SRD PDF not found. Looked in:\n` +
        SRD.localPaths.map((p) => `  ${p}`).join('\n') +
        `\nDownload it from ${SRD.url} (it is deliberately not committed).`,
    );
  }

  const sha256 = sha256File(pdfPath);
  const book = bookBySha(sha256);
  if (book === undefined && !options.allowUnknownRevision) {
    throw new Error(
      `Unrecognised SRD revision: ${pdfPath}\n` +
        `  actual ${sha256}\n` +
        `Known revisions:\n` +
        BOOKS.map((b) => `  ${b.revision}  ${b.sha256}`).join('\n') +
        `\nA new SRD revision may have corrected game mechanics. Review the diff,\n` +
        `re-check tools/glyphs.ts against the new display font, then add the\n` +
        `revision to BOOKS in tools/loadSrd.ts.`,
    );
  }

  const key = sha256.slice(0, 16);
  const [bboxXml, fontXml] = await Promise.all([
    cachedRun(`${key}.bbox.xml`, 'pdftotext', ['-bbox-layout', pdfPath, '-']),
    cachedRun(`${key}.font.xml`, 'pdftohtml', ['-xml', '-i', '-nodrm', '-stdout', pdfPath]),
  ]);

  const bboxPages = parseBboxXml(bboxXml);
  const fontPages = new Map(parsePdfToHtmlXml(fontXml).map((p) => [p.number, p]));
  const raw: RawPage[] = bboxPages.map((p) => ({
    number: p.number,
    width: p.width,
    height: p.height,
    runs: joinFonts(p, fontPages.get(p.number)),
  }));

  const pages = layoutPages(raw);

  // Normalise the decorative digit glyphs before anything reads the text.
  const unknown = new Set<string>();
  for (const page of pages) {
    for (const line of page.lines) {
      const res = remapGlyphs(line.text);
      line.text = res.text;
      res.unknown.forEach((u) => unknown.add(u));
      for (const run of line.runs) run.text = remapGlyphs(run.text).text;
    }
    for (const run of page.runs) run.text = remapGlyphs(run.text).text;
  }

  return {
    pdfPath,
    sha256,
    /*
     * From the file, never from a constant. An unrecognised revision that was
     * waved through says so in its own name rather than borrowing SRD 1.0's:
     * this value becomes `Dataset.revision` and the label the dataset ships, so
     * a wrong one is a dataset that misnames its own source.
     */
    revision: book?.revision ?? `unknown-${sha256.slice(0, 12)}`,
    label: book?.label ?? `Unrecognised (${sha256.slice(0, 12)})`,
    sourceDate: book?.sourceDate ?? '1970-01-01T00:00:00.000Z',
    raw,
    pages,
    unknownGlyphs: [...unknown].sort(),
  };
}
