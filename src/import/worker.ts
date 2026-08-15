/**
 * The Core Rulebook importer, off the main thread.
 *
 * STREAMING, NOT LOADING
 * ----------------------
 * The book is 319 MB. `file.arrayBuffer()` would put all of it in memory
 * before pdf.js had parsed a single object, and on a laptop with other tabs
 * open that is the whole failure mode this feature has to avoid. So the file
 * is handed to pdf.js as a range transport over the `File` itself: pdf.js asks
 * for the byte ranges it needs, the browser reads them off disk, and nothing
 * bigger than a page ever exists at once. Extracting all 397 pages of text
 * this way takes a few seconds and a few megabytes.
 *
 * pdf.js NORMALLY SPAWNS ITS OWN WORKER
 * -------------------------------------
 * We are already in one. Rather than nest workers - support for which varies,
 * and which would need a second bundle URL to be resolvable at runtime - the
 * pdf.js worker module is imported directly and registered as
 * `globalThis.pdfjsWorker`, which is pdf.js's own supported way of saying "run
 * the worker half here". Everything still happens off the main thread, which
 * is the part that matters.
 *
 * ORDER OF WORK
 * -------------
 * Identify, then read, then parse, then art, then save. Identification comes
 * first because refusing an unknown PDF has to be instant, and because it is
 * what decides whether the text can be trusted at all. Saving comes last
 * except for the art, which is written sheet by sheet: an import interrupted
 * three quarters of the way through has three quarters of the pictures, and
 * re-running simply overwrites them.
 */
import { getDocument, PDFDataRangeTransport } from 'pdfjs-dist';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
import type { Layer } from '../../shared/types.ts';
import { putLayer, putOverlays, removeLayer, type ContentOverlay } from '../store/db.ts';
import { detectSource, type SourceProbe } from './detectSource.ts';
import { findCardSheets, importCardArt } from './art.ts';
import { extractPages, FontFamilies, isTextItem, type PdfDocument } from './pdfRuns.ts';
import { parseSections } from './sections.ts';
import { contributedFields, reconcile, rekey, uncheckable } from './reconcile.ts';
import type { ImportEvent, ImportPhase, ImportRequest, ImportResult } from './index.ts';

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = { WorkerMessageHandler };

/** 128 KB. Big enough that a page rarely needs two round trips to the disk. */
const RANGE_CHUNK = 1 << 17;
/** Pages sampled for the identification probe, spread through the file. */
const PROBE_SAMPLES = 10;

const post = (event: ImportEvent): void => {
  (self as unknown as { postMessage(e: ImportEvent): void }).postMessage(event);
};

const progress = (phase: ImportPhase, detail: string, done = 0, total = 0): void =>
  post({ type: 'progress', phase, detail, done, total });

/**
 * pdf.js reading straight out of the user's file.
 *
 * `requestDataRange` is fire-and-forget by design, so a read that fails has no
 * caller to reject: the error is reported here and the import is left to be
 * torn down by the main thread. That happens when the file goes away
 * mid-import - an unplugged drive, a file deleted in another window.
 */
class FileRangeTransport extends PDFDataRangeTransport {
  constructor(
    private readonly file: Blob,
    initial: Uint8Array,
    private readonly onReadError: (err: unknown) => void,
  ) {
    super(file.size, initial, false, '');
  }

  override requestDataRange(begin: number, end: number): void {
    this.file
      .slice(begin, end)
      .arrayBuffer()
      .then((buf) => this.onDataRange(begin, new Uint8Array(buf)))
      .catch(this.onReadError);
  }

  override abort(): void {
    /* Nothing to unwind: a slice read cannot be cancelled usefully. */
  }
}

/** Text from pages spread through the book, for identification. */
async function probeText(doc: PdfDocument, samples: number): Promise<string> {
  const step = Math.max(1, Math.floor(doc.numPages / samples));
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages && parts.length < samples; n += step) {
    const page = await doc.getPage(n);
    try {
      const content = await page.getTextContent();
      parts.push(
        content.items
          .filter(isTextItem)
          .map((i) => i.str)
          .join(' '),
      );
    } finally {
      page.cleanup();
    }
  }
  return parts.join('\n');
}

async function run(request: ImportRequest): Promise<void> {
  const started = Date.now();
  progress('opening', 'Opening the file');

  const head = new Uint8Array(await request.file.slice(0, RANGE_CHUNK).arrayBuffer());
  const transport = new FileRangeTransport(request.file, head, (err) => {
    post({
      type: 'failed',
      message: `The file could not be read to the end (${
        err instanceof Error ? err.message : String(err)
      }). Nothing was imported.`,
    });
  });

  const task = getDocument({
    range: transport,
    rangeChunkSize: RANGE_CHUNK,
    // Force pure range reads: without these pdf.js also streams the whole file
    // in the background, which is the memory we are avoiding.
    disableAutoFetch: true,
    disableStream: true,
  });
  type OpenDocument = PdfDocument & {
    getMetadata(): Promise<{ info: Record<string, unknown> }>;
    destroy(): Promise<void>;
  };
  let doc: OpenDocument;
  try {
    doc = (await task.promise) as unknown as OpenDocument;
  } catch (err) {
    // A document that never opened still leaves pdf.js holding the transport
    // and its worker port; only the loading task can let go of them.
    await task.destroy();
    throw err;
  }

  try {
    progress('identifying', 'Checking which book this is');
    const first = await doc.getPage(1);
    const view = first.getViewport({ scale: 1 });
    first.cleanup();
    const { info } = await doc.getMetadata();
    const probe: SourceProbe = {
      info,
      numPages: doc.numPages,
      pageWidth: view.width,
      pageHeight: view.height,
      sampleText: await probeText(doc, PROBE_SAMPLES),
    };
    const source = detectSource(probe);
    if (source.refusal !== null || source.layerId === null) {
      post({ type: 'refused', source });
      return;
    }

    const layer: Layer = {
      id: source.layerId,
      label: source.label,
      priority: 1,
      importedAt: new Date().toISOString(),
    };

    // A re-import replaces the previous one wholesale rather than merging into
    // it, so an entry that stopped being read does not linger from last time.
    // It has to happen before the art is written, because clearing the layer
    // clears the layer's art too - which means an import that fails halfway
    // leaves the previous one gone and has to be run again. That is the price
    // of not accumulating stale overlays, and it costs a minute, not a
    // character: nothing under `characters` is touched by any of this.
    await removeLayer(layer.id);

    const families = new FontFamilies();
    const raw = await extractPages(doc, families, (done, total) => {
      progress('reading', `Reading page ${done} of ${total}`, done, total);
    });

    progress('parsing', 'Reading the sections');
    const baseCounts = Object.fromEntries(
      Object.entries(request.base).map(([kind, entries]) => [kind, entries.length]),
    );
    const parsed = parseSections(raw, baseCounts, (section) =>
      progress('parsing', `Reading ${section}`),
    );

    for (const kind of uncheckable(parsed.imported, request.base)) {
      delete parsed.imported[kind];
      parsed.unread.push({
        section: kind,
        kind,
        reason:
          'the app did not offer its own copy of this collection to compare against, ' +
          'so the manual could not be checked for completeness and was left out',
      });
    }

    const sheets = findCardSheets(raw);
    const art = await importCardArt(doc, sheets, layer.id, (p) => {
      progress(
        'art',
        `Card art: sheet ${p.sheetIndex} of ${p.sheets}, ${p.stored} pictures`,
        p.sheetIndex,
        p.sheets,
      );
    });

    progress('saving', 'Writing the layer');
    const report = reconcile({
      base: request.base,
      imported: parsed.imported,
      unread: parsed.unread,
      pairings: request.pairings ?? [],
    });

    const overlays: ContentOverlay[] = [];
    for (const kindReport of report.kinds) {
      const baseById = new Map(
        (request.base[kindReport.kind] ?? []).map((e) => [e.id, e]),
      );
      const entries = rekey(parsed.imported[kindReport.kind] ?? [], kindReport);
      for (const entity of entries) {
        const fields = contributedFields(entity, baseById.get(entity.id));
        if (Object.keys(fields).length === 0) continue;
        overlays.push({
          key: `${layer.id}:${entity.id}`,
          layerId: layer.id,
          entityId: entity.id,
          kind: kindReport.kind,
          fields,
        });
      }
    }
    if (overlays.length > 0) await putOverlays(overlays);
    await putLayer(layer);

    // Art is keyed by the dataset slug, so an entity's own id is its art key
    // and no overlay is needed to say so. A picture whose slug matches nothing
    // is worth reporting, though: it is either new content or a bad read.
    const known = new Set(
      Object.values(request.base).flatMap((entries) => entries.map((e) => e.id)),
    );
    const result: ImportResult = {
      layer,
      report,
      sections: parsed.sections,
      art: {
        stored: art.slugs.length,
        orphans: art.slugs.filter((slug) => !known.has(slug)),
        skipped: art.skipped,
      },
      evidence: source.evidence,
      elapsedMs: Date.now() - started,
    };
    post({ type: 'done', result });
  } finally {
    await doc.destroy();
  }
}

self.addEventListener('message', (event: MessageEvent<ImportRequest>) => {
  if (event.data?.type !== 'import') return;
  run(event.data).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    post({
      type: 'failed',
      message: err instanceof Error ? err.message : String(err),
    });
  });
});
