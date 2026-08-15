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

export const SRD = {
  /** Where the file can be fetched if it is not already on disk. */
  url: 'https://www.daggerheart.com/wp-content/uploads/2025/09/Daggerheart-SRD-9-09-25.pdf',
  /** Locked: a new revision changes this and the build must stop and be reviewed. */
  sha256: '39c5981ebfc85db071e5fdcebfda3add6c5eaf3d078fb1fd0b3790c912338687',
  revision: 'srd-1.0-2025-09-09',
  /** The revision's own date. Used so the dataset is byte-stable per source. */
  sourceDate: '2025-09-09T00:00:00.000Z',
  /** Searched in order. The first path that exists wins. */
  localPaths: [
    'Manuali/Daggerheart-SRD-9-09-25.pdf',
    'tools/.cache/Daggerheart-SRD-9-09-25.pdf',
  ],
} as const;

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
  if (sha256 !== SRD.sha256 && !options.allowUnknownRevision) {
    throw new Error(
      `SRD checksum mismatch for ${pdfPath}\n` +
        `  expected ${SRD.sha256}\n` +
        `  actual   ${sha256}\n` +
        `A new SRD revision may have corrected game mechanics. Review the diff,\n` +
        `re-check tools/glyphs.ts against the new display font, then update\n` +
        `SRD.sha256 and SRD.revision in tools/loadSrd.ts.`,
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
    revision: SRD.revision,
    sourceDate: SRD.sourceDate,
    raw,
    pages,
    unknownGlyphs: [...unknown].sort(),
  };
}
