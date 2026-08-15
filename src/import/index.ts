/**
 * The importer's public surface: what the UI is allowed to know about.
 *
 * Two things live here and nothing else. First, whether this device may even
 * offer the import - the answer on a phone is no, and the reason has to be a
 * sentence a person can act on rather than a greyed-out button. Second, the
 * protocol: a request in, a stream of progress events out, the pdf.js side
 * safely behind a Worker boundary so nothing in this module drags a megabyte
 * of PDF machinery into the app shell.
 *
 * No UI, no React, no strings beyond the one refusal that has nowhere else to
 * live.
 */
import type { Layer } from '../../shared/types.ts';
import type { DetectedSource } from './detectSource.ts';
import type { Entry, Pairing, ReconcileReport } from './reconcile.ts';
import type { Section } from './sections.ts';

export type { DetectedSource, SourceKind } from './detectSource.ts';
export type { Entry, Pairing, ReconcileReport, Suggestion, UnreadSection } from './reconcile.ts';
export { contributedFields, reconcile, rekey } from './reconcile.ts';
export type { Section } from './sections.ts';
export type { ArtPackInput } from './artPack.ts';
export {
  ART_PACK_EXTENSION,
  ART_PACK_MIME,
  ART_PACK_WARNING,
  ArtPackError,
  artPackFilename,
  buildArtPack,
  readArtPack,
} from './artPack.ts';
export { storeArtPackImages } from './art.ts';

// ---------------------------------------------------------------------------
// Can this device do it at all?
// ---------------------------------------------------------------------------

export interface ImportCapability {
  supported: boolean;
  /** One line for the disabled control. Empty when supported. */
  reason: string;
}

const MOBILE_REASON =
  'Importing the Core Rulebook rasterises a 319 MB PDF and needs more memory than a ' +
  'phone or tablet will give it. Import it on a computer, then bring the artwork here ' +
  'as a .dhart art pack - the pack needs no PDF and no parsing.';

const MISSING_REASON =
  'This browser is missing the offscreen canvas and WebP encoding the importer needs. ' +
  'Import the Core Rulebook in a current desktop browser, then bring the artwork here ' +
  'as a .dhart art pack.';

/**
 * Whether the Core Rulebook import may be offered here.
 *
 * Deliberately conservative, and deliberately not a user-agent sniff: a device
 * counts as mobile when it reports itself as one, or when the only pointer it
 * has is a finger. Being wrong in the strict direction costs a desktop user
 * one line of explanation; being wrong the other way costs a phone user a
 * crashed tab in the middle of a 397-page render.
 */
export function importCapability(): ImportCapability {
  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
    deviceMemory?: number;
  };

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return { supported: false, reason: MISSING_REASON };
  }
  if (typeof OffscreenCanvas.prototype.convertToBlob !== 'function') {
    return { supported: false, reason: MISSING_REASON };
  }
  if (nav.userAgentData?.mobile === true) return { supported: false, reason: MOBILE_REASON };
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    if (!matchMedia('(any-pointer: fine)').matches) {
      return { supported: false, reason: MOBILE_REASON };
    }
  }
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory < 4) {
    return { supported: false, reason: MOBILE_REASON };
  }
  return { supported: true, reason: '' };
}

// ---------------------------------------------------------------------------
// Worker protocol
// ---------------------------------------------------------------------------

export interface ImportRequest {
  type: 'import';
  file: File;
  /**
   * The SRD side, by collection. Pass the *whole* entities, not just their id
   * and name: matching only needs those two, but the worker also compares
   * every other field so that the manual can add to one and never shorten it
   * (see `contributedFields`). Passed in rather than imported so the worker
   * bundle stays free of the 341 KB dataset the app already holds in memory.
   */
  base: Record<string, Entry[]>;
  /** Pairings the user confirmed on a previous pass. */
  pairings?: Pairing[];
}

export type ImportPhase =
  | 'opening'
  | 'identifying'
  | 'reading'
  | 'parsing'
  | 'art'
  | 'saving';

export interface ImportResult {
  layer: Layer;
  report: ReconcileReport;
  sections: Section[];
  art: {
    stored: number;
    /** Slugs with a picture but no entity in the dataset to hang it on. */
    orphans: string[];
    skipped: Array<{ number: number; name: string; reason: string }>;
  };
  /** What identification was based on. For a support log, not the user. */
  evidence: string[];
  elapsedMs: number;
}

export type ImportEvent =
  | { type: 'progress'; phase: ImportPhase; detail: string; done: number; total: number }
  | { type: 'refused'; source: DetectedSource }
  | { type: 'done'; result: ImportResult }
  | { type: 'failed'; message: string };

export interface ImportRun {
  /** Every event until `done`, `refused` or `failed`, then the stream ends. */
  events: AsyncIterable<ImportEvent>;
  /** Stop the worker. The stream ends with a `failed` event. */
  cancel(): void;
}

/**
 * Start an import.
 *
 * The `File` is transferred by reference, never read into memory here: the
 * worker asks the browser for byte ranges as pdf.js needs them, so a 319 MB
 * book costs a few megabytes of resident memory rather than 319.
 */
export function importCoreRulebook(
  file: File,
  base: Record<string, Entry[]>,
  pairings: Pairing[] = [],
): ImportRun {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'core-rulebook-import',
  });

  const queue: ImportEvent[] = [];
  let notify: (() => void) | null = null;
  let finished = false;

  const push = (event: ImportEvent): void => {
    if (finished) return; // The stream ends on its first terminal event.
    queue.push(event);
    if (event.type !== 'progress') finished = true;
    notify?.();
    notify = null;
  };

  worker.addEventListener('message', (e: MessageEvent<ImportEvent>) => {
    push(e.data);
    if (e.data.type !== 'progress') worker.terminate();
  });
  worker.addEventListener('error', (e) => {
    push({ type: 'failed', message: e.message || 'The import worker stopped unexpectedly.' });
    worker.terminate();
  });
  // A result that will not structured-clone arrives here and nowhere else. Left
  // unhandled it is not an error but a silence: the worker has said its last
  // word and the stream would wait for it forever.
  worker.addEventListener('messageerror', () => {
    push({ type: 'failed', message: 'The import worker sent a result this browser could not read.' });
    worker.terminate();
  });

  const request: ImportRequest = { type: 'import', file, base, pairings };
  worker.postMessage(request);

  async function* events(): AsyncIterable<ImportEvent> {
    try {
      for (;;) {
        while (queue.length > 0) yield queue.shift()!;
        if (finished) return;
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
      }
    } finally {
      // Reached on `break`, on a thrown consumer, and on an unmount that drops
      // the loop - all of which otherwise leave a worker rasterising a 319 MB
      // file with no one left to tell.
      finished = true;
      worker.terminate();
    }
  }

  return {
    events: events(),
    cancel(): void {
      // Ordered so the event is queued before `finished` closes the gate.
      push({ type: 'failed', message: 'Import cancelled.' });
      worker.terminate();
    },
  };
}
