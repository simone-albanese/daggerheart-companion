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
  /**
   * The committed dataset this book is the source of, or `null` for a book that
   * has no committed dataset at all.
   *
   * It is a property of the BOOK because it was a constant in
   * `tools/build-srd.ts` - `const OUT = 'data/srd-1.0.json'` - which `--pdf`
   * did not touch. Once the parsers learned to read SRD 2.0, running the build
   * against it would have written SRD 2.0's dataset over SRD 1.0's file: the
   * very artifact whose byte-identity is the only proof that reading a second
   * book changed nothing about the first.
   *
   * ## Why BOTH books have one now, and why that is not the old footgun
   *
   * The footgun was one path for two books. It is gone because each book names
   * its OWN file: `--pdf <SRD 2>` writes `data/srd-2.0.json` and can no longer
   * reach `data/srd-1.0.json`, whatever order the flags are in.
   *
   * The field used to carry a second meaning - "the revision the app ships" -
   * and the two came apart the moment SRD 2.0 became the shipped one. Nulling
   * SRD 1.0 here to say "not shipped" would have taken its dataset out of the
   * only gate that can check it: MEASURED, with SRD 1.0 nulled,
   * `npm run build:srd -- --check --pdf Manuali/Daggerheart-SRD-9-09-25.pdf`
   * prints "srd-1.0-2025-09-09 is not the committed revision, so there is
   * nothing to compare against" and exits 0 without reading a byte of
   * `data/srd-1.0.json`. That file is the only evidence the 1.0 parse still
   * works, and an unverifiable artifact is not evidence. So `shipped` below
   * carries the other half, and this one keeps meaning exactly what it says.
   */
  datasetPath: string | null;
  /**
   * The revision the APP ships: the dataset `src/store/dataset.ts` imports and
   * every screen draws. Exactly one book carries it - `SRD` below throws if
   * that stops being true, because "which book is this app" cannot have two
   * answers or none.
   *
   * Separate from `datasetPath` because a book can have a committed dataset and
   * not be shipped, which is precisely SRD 1.0's state after the switch: built,
   * committed, checked by CI, drawn by nothing.
   */
  shipped: boolean;
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
    /*
     * Still built, still committed, still checked - and no longer drawn.
     *
     * `data/srd-1.0.json` stays in the tree because it is the only artifact
     * that can fail when the 1.0 parse breaks. Twelve parsers now read two
     * books each off one set of range-finding rules; a change made for 2.0 that
     * quietly mangles 1.0 has nothing else to trip over. Keeping the FILE
     * without keeping the `datasetPath` would have kept a fossil instead of a
     * gate - see the field's docblock.
     *
     * It is not dead weight the app carries: `src/store/dataset.ts` imports
     * `data/srd-2.0.json` and nothing imports this one outside `tools/` and
     * `tests/`, so it is not in the bundle. Measured, not assumed - see the
     * bundle figures in `tests/tools/switch.test.ts`.
     */
    datasetPath: 'data/srd-1.0.json',
    shipped: false,
  },
  {
    /*
     * SRD 2.0. Known, read end to end, and THE SHIPPED DATASET.
     *
     * The sentence that stood here said "pointing the build here today
     * produces wrong output, not an error", because the parsers were keyed to
     * the 1.0 geometry - 67 spreads of 1224x792 against this book's 224 single
     * 612x792 pages. That is no longer true: every parser now takes its range
     * from the book's own contents page or from a banner the page prints, and
     * this revision parses to 15 populated collections.
     *
     * The sentence after it said what kept the book out of `data/`:
     * `datasetPath: null`, "a decision with a diff, not a flag". This is that
     * diff. `data/srd-2.0.json` is named for the book it holds, because a file
     * called `srd-1.0.json` carrying 2.0 content is the class of lie three
     * waves have been spent removing.
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
    datasetPath: 'data/srd-2.0.json',
    shipped: true,
  },
];

/**
 * The revision the app ships, found by asking the books rather than by index.
 *
 * `BOOKS[0]!` used to be the whole of it, which made "which book is shipped"
 * a property of ARRAY ORDER: adding a revision at the top, or reordering the
 * list into publication order, would have moved the shipped dataset with no
 * line of the change saying so. The throws are not defensive noise - each is a
 * state this file can reach by editing one word of `BOOKS`.
 */
export const SRD: Book & { datasetPath: string } = (() => {
  const shipped = BOOKS.filter((b) => b.shipped);
  if (shipped.length !== 1) {
    throw new Error(
      `Exactly one book in BOOKS must be \`shipped\`; ${String(shipped.length)} are. ` +
        `See tools/loadSrd.ts.`,
    );
  }
  const book = shipped[0]!;
  const { datasetPath } = book;
  if (datasetPath === null) {
    throw new Error(
      `${book.revision} is marked shipped and has no datasetPath. ` +
        `The app imports a committed dataset; a shipped book must have one.`,
    );
  }
  return { ...book, datasetPath };
})();

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
  /** The book's `datasetPath`; `null` for a book with no committed dataset. */
  datasetPath: string | null;
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

  /*
   * Normalise the decorative digit glyphs before anything reads the text, and
   * take the invisible characters off in the same pass.
   *
   * ONE place, because there is no one downstream place. `normalizeText` in
   * `shared/parsers/util.ts` is not on every paragraph's path: `joinLines` is a
   * second builder, and `classes.ts` carries a third `join` of its own that
   * handles dashes differently on purpose. Stripping in `normalizeText` left
   * the Warlock's class feature on SRD 2.0 folio 26 reading "a supernatural
   * entity<U+00AD>-such as a god"; stripping in `joinLines` too still left it,
   * because that paragraph goes through neither. A character that is invisible
   * on the page has no business surviving extraction, so it comes off here,
   * where the text stream is already being repaired.
   *
   * What this is NOT worth: several documents in this repository call U+00AD
   * and U+200B "the characters that actually break a name comparison". Measured
   * on both books, they break nothing - SRD 2.0 holds one and four of them in
   * 224 pages, none inside any parsed name, and folding them into an 849-name
   * census buys zero extra hits. The character that buys hits is U+2011. This
   * is a text repair worth three visible defects, not a matching fix.
   *
   * A no-op on SRD 1.0, which contains neither, so `data/srd-1.0.json` is
   * byte-identical across this change.
   */
  const INVISIBLE = /[\u00AD\u200B]/g;
  const clean = (t: string): string => remapGlyphs(t.replace(INVISIBLE, '')).text;
  const unknown = new Set<string>();
  for (const page of pages) {
    for (const line of page.lines) {
      const res = remapGlyphs(line.text.replace(INVISIBLE, ''));
      line.text = res.text;
      res.unknown.forEach((u) => unknown.add(u));
      for (const run of line.runs) run.text = clean(run.text);
    }
    for (const run of page.runs) run.text = clean(run.text);
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
    // An unrecognised book has no committed dataset by construction, so the
    // write path refuses it for the same reason it refuses SRD 2.0.
    datasetPath: book?.datasetPath ?? null,
    raw,
    pages,
    unknownGlyphs: [...unknown].sort(),
  };
}
