/**
 * Smoke tests against the real books, when they happen to be on this machine.
 *
 * No PDF is committed and none ever will be, so these skip themselves unless
 * something is sitting in `Manuali/`. What they are here to prove is the one
 * claim the whole importer rests on and that no synthetic fixture can: pdf.js
 * reads the Core Rulebook correctly, and does *not* read the SRD - which is
 * why the build pipeline uses poppler, and why `detectSource` probes the text
 * instead of trusting the metadata.
 */
import { existsSync, readdirSync } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { detectSource, type SourceProbe } from '../../src/import/detectSource.ts';
import { imagePaints, isCardSheet, locateCards } from '../../src/import/art.ts';
import {
  FontFamilies,
  isTextItem,
  runsFromTextContent,
  type PdfDocument,
  type PdfPage,
  type RawPage,
} from '../../src/import/pdfRuns.ts';
import { runningHead } from '../../src/import/sections.ts';

// pdf.js builds a DOMMatrix while its canvas module initialises. Nothing here
// rasterises anything, so an empty stand-in is enough to let it load in Node.
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= class {};

const UNREADABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uE000-\uF8FF]/;
const BROKEN_LIGATURES = /\b(?:diculty|benets|modier|nesse|specic|reect)\b/i;

const MANUALI = fileURLToPath(new URL('../../Manuali', import.meta.url));
const pdfs = existsSync(MANUALI)
  ? readdirSync(MANUALI)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => `${MANUALI}/${f}`)
  : [];

interface Opened {
  path: string;
  doc: PdfDocument & { getMetadata(): Promise<{ info: Record<string, unknown> }> };
  probe: SourceProbe;
}

/**
 * Open a PDF the way the worker does: by byte range, never as one buffer. A
 * 319 MB `readFile` here would be the very thing the importer exists to avoid.
 */
async function openByRange(path: string): Promise<Opened['doc']> {
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument(params: unknown): { promise: Promise<unknown> };
    PDFDataRangeTransport: new (
      length: number,
      initial: Uint8Array,
      done: boolean,
      name: string,
    ) => { onDataRange(begin: number, chunk: Uint8Array): void };
  };

  const size = (await stat(path)).size;
  const handle = await open(path, 'r');
  const head = Buffer.alloc(Math.min(1 << 16, size));
  await handle.read(head, 0, head.length, 0);

  class FileRange extends pdfjs.PDFDataRangeTransport {
    requestDataRange(begin: number, end: number): void {
      const length = end - begin;
      const buf = Buffer.alloc(length);
      void handle
        .read(buf, 0, length, begin)
        .then(() => this.onDataRange(begin, new Uint8Array(buf)));
    }
    abort(): void {}
  }

  return (await pdfjs.getDocument({
    range: new FileRange(size, new Uint8Array(head), false, ''),
    rangeChunkSize: 1 << 17,
    disableAutoFetch: true,
    disableStream: true,
  }).promise) as Opened['doc'];
}

async function probeOf(doc: Opened['doc'], samples = 10): Promise<SourceProbe> {
  const first = await doc.getPage(1);
  const view = first.getViewport({ scale: 1 });
  first.cleanup();

  const step = Math.max(1, Math.floor(doc.numPages / samples));
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages && parts.length < samples; n += step) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .filter(isTextItem)
        .map((i) => i.str)
        .join(' '),
    );
    page.cleanup();
  }

  const { info } = await doc.getMetadata();
  return {
    info,
    numPages: doc.numPages,
    pageWidth: view.width,
    pageHeight: view.height,
    sampleText: parts.join('\n'),
  };
}

async function rawPage(doc: PdfDocument, n: number, families: FontFamilies): Promise<RawPage> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  await families.learn(page, content);
  const runs = runsFromTextContent(content, viewport, families);
  page.cleanup();
  return { number: n, width: viewport.width, height: viewport.height, runs };
}

const opened: Opened[] = [];
const kindIs = (kind: string) => (): boolean =>
  opened.some((o) => detectSource(o.probe).kind === kind);

describe.skipIf(pdfs.length === 0)('the real PDFs in Manuali/', () => {
  beforeAll(async () => {
    for (const path of pdfs) {
      const doc = await openByRange(path);
      opened.push({ path, doc, probe: await probeOf(doc) });
    }
  }, 120_000);

  const core = (): Opened => {
    const found = opened.find((o) => detectSource(o.probe).kind === 'core-rulebook');
    if (!found) throw new Error('no Core Rulebook in Manuali/');
    return found;
  };

  it('reaches a verdict on every PDF present', () => {
    for (const o of opened) {
      expect(['core-rulebook', 'srd', 'unknown']).toContain(detectSource(o.probe).kind);
    }
  });

  it('refuses the SRD, and shows why pdf.js may not be used on it', (ctx) => {
    if (!kindIs('srd')()) return ctx.skip();
    const srd = opened.find((o) => detectSource(o.probe).kind === 'srd')!;
    const source = detectSource(srd.probe);
    expect(source.layerId).toBeNull();
    expect(source.refusal).toMatch(/already built into this app/i);

    // The claim in tools/pdfText.ts, checked rather than trusted: pdf.js hands
    // back C0 control characters for this file's subset fonts.
    expect(srd.probe.sampleText).toMatch(UNREADABLE);
  });

  it('accepts the Core Rulebook and finds its text intact', (ctx) => {
    if (!kindIs('core-rulebook')()) return ctx.skip();
    const source = detectSource(core().probe);
    expect(source.refusal).toBeNull();
    expect(source.layerId).toMatch(/^core-\d{4}-\d{2}-\d{2}$/);

    const text = core().probe.sampleText;
    expect(text.length).toBeGreaterThan(5_000);
    expect(text).not.toMatch(UNREADABLE);
    expect(text).not.toMatch(BROKEN_LIGATURES);
  });

  it(
    'reads a card sheet: nine cards, each with a name and a picture',
    async (ctx) => {
      if (!kindIs('core-rulebook')()) return ctx.skip();
      const { doc } = core();
      const families = new FontFamilies();

      let sheet: RawPage | null = null;
      for (let n = doc.numPages; n > doc.numPages - 6 && sheet === null; n -= 1) {
        const raw = await rawPage(doc, n, families);
        if (isCardSheet(raw.runs)) sheet = raw;
      }
      expect(sheet).not.toBeNull();

      const page = await doc.getPage(sheet!.number);
      const cards = locateCards(
        sheet!.runs,
        await imagePaints(page as PdfPage, page.getViewport({ scale: 1 })),
        sheet!,
      );
      page.cleanup();

      expect(cards).toHaveLength(9);
      expect(cards.every((c) => c.slug.length > 0)).toBe(true);
      expect(cards.every((c) => c.art !== null)).toBe(true);
      expect(cards.every((c) => c.total === cards[0]!.total)).toBe(true);
      for (const card of cards) {
        // A picture spans the card, and never fills it.
        expect(card.art!.w / card.cell.w).toBeGreaterThan(0.8);
        expect(card.art!.h / card.cell.h).toBeLessThanOrEqual(0.66);
      }
    },
    60_000,
  );

  it(
    'reads the running heads that section discovery depends on',
    async (ctx) => {
      if (!kindIs('core-rulebook')()) return ctx.skip();
      const { doc } = core();
      const families = new FontFamilies();
      const heads: string[] = [];
      for (let n = 12; n <= 40; n += 4) {
        const head = runningHead(await rawPage(doc, n, families));
        if (head) heads.push(head);
      }
      expect(heads.length).toBeGreaterThan(3);
      expect(heads.every((h) => /^(Introduction|Chapter \d+: |Appendix: )/.test(h))).toBe(true);
      expect(heads.some((h) => /^Chapter \d+: /.test(h))).toBe(true);
    },
    60_000,
  );
});
