/**
 * Which book the build thinks it is reading.
 *
 * `loadSrd` used to return `revision` and `sourceDate` from a single constant
 * whatever file it had opened, so `allowUnknownRevision` - the escape hatch for
 * looking at a different revision by hand - produced a `LoadedSrd` naming the
 * wrong book. Both fields flow into `Dataset.revision` and into the layer the
 * dataset ships, so a build run that way emits a dataset that says it is SRD
 * 1.0 and is not, on every screen that draws the source's name.
 *
 * The hash gate is unchanged and is the thing these tests protect hardest: an
 * unrecognised file still stops the build. What is new is that a recognised one
 * brings its own identity with it.
 *
 * Most of this needs no PDF, on purpose - CI has none, and a test that can only
 * run on the owner's machine is a test that does not run. The two that do need
 * the books say so and skip.
 */
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOKS, SRD, bookBySha, findSrdPdf, loadSrd, sha256File } from '../../tools/loadSrd.ts';

const haveBook = (i: number): boolean => BOOKS[i]!.localPaths.some((p) => existsSync(p));

describe('the books this build knows', () => {
  it('names each revision exactly once, by hash', () => {
    const shas = BOOKS.map((b) => b.sha256);
    expect(new Set(shas).size, 'two entries share a hash').toBe(shas.length);
    const revisions = BOOKS.map((b) => b.revision);
    expect(new Set(revisions).size, 'two entries share a revision').toBe(revisions.length);
  });

  it('builds the committed dataset from the first entry', () => {
    // `SRD` is what `findSrdPdf` searches for and what the dataset is built
    // from. Pinning it stops a later entry being prepended and silently
    // changing which book a plain `npm run build:srd` reads.
    expect(SRD).toBe(BOOKS[0]);
    expect(SRD.revision).toBe('srd-1.0-2025-09-09');
    expect(SRD.label).toBe('SRD 1.0');
  });

  it('knows SRD 2, and does not build from it', () => {
    // Listed so the geometry can be measured against the real file without the
    // escape hatch that used to lie about the name. NOT the default: the
    // parsers are still keyed to the 1.0 folios.
    const two = BOOKS.find((b) => b.revision === 'srd-2.0-2026-08-25');
    expect(two).toBeDefined();
    expect(two).not.toBe(SRD);
  });

  it('looks a book up by hash, and says nothing for one it does not know', () => {
    for (const book of BOOKS) expect(bookBySha(book.sha256)).toBe(book);
    expect(bookBySha('0'.repeat(64))).toBeUndefined();
  });

  it('gives every entry a label, because the dataset ships it', () => {
    // The layer's label used to be the literal 'SRD 1.0' beside a variable id,
    // so a second revision would have shipped a dataset labelled as the first.
    for (const book of BOOKS) expect(book.label.length, book.revision).toBeGreaterThan(0);
  });
});

describe('the hash lock', () => {
  /*
   * The safety property of this whole file, and nothing tested it: removing the
   * gate entirely used to pass the suite. It needs no PDF - `loadSrd` hashes
   * the file before it spends a second on poppler - so any file at all
   * exercises it, and that means it runs in CI, where the books do not exist.
   */
  it('refuses a file it does not recognise', async () => {
    await expect(loadSrd({ pdfPath: 'package.json' })).rejects.toThrow(
      /Unrecognised SRD revision/,
    );
  });

  it('names every revision it does know, so the reader can see what to add', async () => {
    // The message is the whole remedy: someone meeting this wall has to decide
    // whether the book is a new revision to add or the wrong file entirely, and
    // they cannot without seeing what is already known.
    let message = '';
    try {
      await loadSrd({ pdfPath: 'package.json' });
      throw new Error('the gate let it through');
    } catch (e) {
      message = (e as Error).message;
    }
    for (const book of BOOKS) {
      expect(message, book.revision).toContain(book.revision);
      expect(message, book.sha256).toContain(book.sha256);
    }
  });

  it('lets a deliberate explorer past, and does not let them be misled', async () => {
    // `allowUnknownRevision` is for looking at a revision by hand. It skips the
    // gate; it must not skip the naming, which is exactly what it used to do.
    // A file that is not a PDF gets past the hash check and dies in poppler,
    // which is far enough to prove the gate was the thing that yielded.
    await expect(
      loadSrd({ pdfPath: 'package.json', allowUnknownRevision: true }),
    ).rejects.not.toThrow(/Unrecognised SRD revision/);
  });
});

describe.skipIf(!haveBook(0))('the SRD 1 file on this machine', () => {
  it('still hashes to the pinned value', () => {
    // The lock only means something if it is checked against the real file.
    expect(sha256File(findSrdPdf()!)).toBe(SRD.sha256);
  });
});

describe.skipIf(!haveBook(1))('the SRD 2 file on this machine', () => {
  it('hashes to its pinned value and is read under its own name', async () => {
    const path = BOOKS[1]!.localPaths.find((p) => existsSync(p))!;
    expect(sha256File(path)).toBe(BOOKS[1]!.sha256);

    const loaded = await loadSrd({ pdfPath: path });
    // The defect this replaced: these three came from SRD 1's constant.
    expect(loaded.revision).toBe('srd-2.0-2026-08-25');
    expect(loaded.label).toBe('SRD 2.0');
    expect(loaded.sourceDate).toBe('2026-08-25T00:00:00.000Z');
    // And the geometry finding, asserted rather than remembered: SRD 2 is 224
    // single pages, so nothing is sliced and book pages equal PDF pages. SRD 1
    // is 67 spreads and would give 135 against 68.
    expect(loaded.pages.length).toBe(loaded.raw.length);
    // The glyph table covers it end to end. This is what a missing 7, 8 or 9
    // would have reported, and it is the gate that stops the build.
    expect(loaded.unknownGlyphs).toEqual([]);
  }, 120_000);
});
