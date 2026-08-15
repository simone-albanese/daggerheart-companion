/**
 * Animated QR transfer.
 *
 * The sender paints a loop of QR codes and the receiver just watches. There is
 * no handshake and no ordering requirement, which is what makes it work across
 * a table: the phone holding the camera never has to talk back, so there is no
 * pairing, no channel, and nothing to go wrong between two devices that have
 * never met.
 *
 * Screen-to-camera is a hostile channel - reflections, moire between the two
 * pixel grids, autofocus hunting at close range - so everything here trades
 * payload density for legibility: error correction M instead of L, a quiet zone
 * wider than the spec's minimum, integer module scaling so no module lands on a
 * fractional pixel, and a single QR version for the whole set so the camera is
 * not refocusing between frames.
 *
 * The eleven-byte frame header, the crc32 and the reassembly live in
 * `frames.ts`; this module re-exports them so there is one implementation of
 * the wire format and one place to change it. What is here is pixels: modules,
 * layout, the sender's loop and the receiver's camera.
 */
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
import {
  FRAME_HEADER_BYTES,
  FRAME_MAGIC,
  MAX_CHUNK_BYTES,
  MAX_FRAMES,
  packFrame,
  unpackFrame,
  type TransferFrame,
} from './frames.ts';

export const EC_LEVEL = 'M';
export const MAX_QR_VERSION = 12;
/** Modules per side at version 12. */
export const MAX_QR_MODULES = 65;

export const FRAME_RATE = 5;
/** Past this many frames the loop is long enough that the file is the better offer. */
export const FILE_PREFERRED_ABOVE = 15;

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

// The wire format - header, checksum, cutting, reassembly - belongs to
// `frames.ts`. Re-exported here so a QR screen has one import, and so there is
// only ever one implementation of the eleven bytes.
export { FRAME_HEADER_BYTES, FRAME_MAGIC, MAX_CHUNK_BYTES, MAX_FRAMES, packFrame, unpackFrame };
export type { TransferFrame };

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/**
 * Byte-mode data capacity at error correction M, versions 1 to 12 (ISO/IEC
 * 18004 table 7). The list stops at 12 on purpose: anything that does not fit
 * a 65x65 code is not something we are willing to ask a camera to read. A test
 * checks these numbers against qrcode-generator so they cannot drift.
 */
const BYTE_CAPACITY_M = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287] as const;

/** Modules per side for a QR version. */
export const qrModulesForVersion = (version: number): number => 17 + 4 * version;

export function qrVersionForBytes(byteLength: number): number {
  for (let version = 1; version <= BYTE_CAPACITY_M.length; version += 1) {
    if (byteLength <= BYTE_CAPACITY_M[version - 1]!) return version;
  }
  throw new Error(
    `${byteLength} bytes will not fit a QR version ${MAX_QR_VERSION} at error correction ${EC_LEVEL} (max ${BYTE_CAPACITY_M[BYTE_CAPACITY_M.length - 1]!})`,
  );
}

/** Row-major module grid. Plain data so it can be compared, cached and tested. */
export interface QrMatrix {
  /** Modules per side, `17 + 4 * version`. */
  size: number;
  version: number;
  /** `size * size` entries, 1 where the module is dark. */
  modules: Uint8Array;
}

export const isDark = (matrix: QrMatrix, row: number, col: number): boolean =>
  matrix.modules[row * matrix.size + col] === 1;

/**
 * qrcode-generator takes a string, and its default `stringToBytes` masks each
 * char code with 0xff. A string whose code points are all below 256 therefore
 * survives byte mode unchanged - that is the only reason we go through latin-1
 * instead of handing over the bytes.
 */
function toLatin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]!);
  return out;
}

/** `version` omitted means the smallest that fits. */
export function encodeBytes(bytes: Uint8Array, version?: number): QrMatrix {
  const chosen = version ?? qrVersionForBytes(bytes.length);
  if (chosen < 1 || chosen > MAX_QR_VERSION) {
    throw new Error(`QR version ${chosen} is outside 1..${MAX_QR_VERSION}`);
  }

  const code = qrcode(chosen as Parameters<typeof qrcode>[0], EC_LEVEL);
  code.addData(toLatin1(bytes), 'Byte');
  code.make();

  const size = code.getModuleCount();
  // The capacity table said this would fit; if the library disagrees, the table
  // is wrong and every transfer after this one is suspect.
  if (size > MAX_QR_MODULES) {
    throw new Error(`encoded ${bytes.length} bytes to a ${size}x${size} code, past the ${MAX_QR_MODULES}-module limit`);
  }

  const modules = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      modules[row * size + col] = code.isDark(row, col) ? 1 : 0;
    }
  }
  return { size, version: (size - 17) / 4, modules };
}

/**
 * One version for the whole set, sized to the largest frame. The last chunk is
 * usually short and would otherwise encode smaller; a code that changes size
 * five times a second makes the receiver's autofocus hunt.
 */
export function encodeByteFrames(frames: readonly Uint8Array[]): QrMatrix[] {
  if (frames.length === 0) throw new Error('nothing to encode: the frame set is empty');
  if (frames.length > MAX_FRAMES) {
    throw new Error(`${frames.length} frames exceeds the ${MAX_FRAMES} a u8 index can address - send the file`);
  }
  const version = frames.reduce((max, f) => Math.max(max, qrVersionForBytes(f.length)), 1);
  return frames.map((f) => encodeBytes(f, version));
}

export const encodeFrames = (frames: readonly TransferFrame[]): QrMatrix[] =>
  encodeByteFrames(frames.map(packFrame));

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** The spec's minimum is 4. A camera pointed at a lit screen wants more. */
export const DEFAULT_QUIET_ZONE = 6;

export interface RenderOptions {
  quietZone?: number;
  /** Target width in CSS pixels. Falls back to the canvas's own client width, then 320. */
  cssSize?: number;
  devicePixelRatio?: number;
}

export interface QrLayout {
  /** Side of the bitmap in device pixels. */
  pixelSize: number;
  /** Device pixels per module. Always a whole number. */
  modulePixels: number;
  quietZone: number;
  /** Side in CSS pixels, for the element's style. */
  cssSize: number;
}

/**
 * Scaling rounds *down* to a whole number of pixels per module. A fractional
 * scale makes some modules a pixel wider than their neighbours, and that
 * unevenness is exactly what a decoder gets wrong at the edge of focus.
 */
export function layoutMatrix(matrix: QrMatrix, options: RenderOptions = {}): QrLayout {
  const quietZone = options.quietZone ?? DEFAULT_QUIET_ZONE;
  if (!Number.isInteger(quietZone) || quietZone < 0) {
    throw new Error(`quiet zone must be a whole number of modules, got ${quietZone}`);
  }
  const total = matrix.size + quietZone * 2;
  const dpr = options.devicePixelRatio ?? globalThis.devicePixelRatio ?? 1;
  const target = options.cssSize ?? 320;
  const modulePixels = Math.max(1, Math.floor((target * dpr) / total));
  const pixelSize = total * modulePixels;
  return { pixelSize, modulePixels, quietZone, cssSize: pixelSize / dpr };
}

export interface RgbaBitmap {
  /** Pinned to a plain ArrayBuffer so it can go straight into an ImageData. */
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/**
 * Always black on white. Tinting a QR to match a dark theme either kills the
 * contrast or inverts the code, and an inverted code is one most scanners -
 * jsQR included, unless told to look - simply will not see.
 */
export function matrixToRgba(matrix: QrMatrix, layout: QrLayout): RgbaBitmap {
  const { pixelSize, modulePixels, quietZone } = layout;
  const data = new Uint8ClampedArray(pixelSize * pixelSize * 4).fill(255);

  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row * matrix.size + col] !== 1) continue;
      const top = (row + quietZone) * modulePixels;
      const left = (col + quietZone) * modulePixels;
      for (let y = top; y < top + modulePixels; y += 1) {
        const rowStart = (y * pixelSize + left) * 4;
        for (let i = 0; i < modulePixels * 4; i += 4) {
          data[rowStart + i] = 0;
          data[rowStart + i + 1] = 0;
          data[rowStart + i + 2] = 0;
        }
      }
    }
  }
  return { data, width: pixelSize, height: pixelSize };
}

/**
 * Drawn with putImageData rather than filled rectangles: it ignores the canvas
 * transform and any smoothing, so what lands on the glass is exactly the grid
 * computed above.
 */
export function renderMatrix(
  canvas: HTMLCanvasElement,
  matrix: QrMatrix,
  options: RenderOptions = {},
): QrLayout {
  const layout = layoutMatrix(matrix, {
    ...options,
    cssSize: options.cssSize ?? (canvas.clientWidth > 0 ? canvas.clientWidth : undefined),
  });
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('canvas 2d context unavailable');

  if (canvas.width !== layout.pixelSize) canvas.width = layout.pixelSize;
  if (canvas.height !== layout.pixelSize) canvas.height = layout.pixelSize;
  canvas.style.width = `${layout.cssSize}px`;
  canvas.style.height = `${layout.cssSize}px`;

  const bitmap = matrixToRgba(matrix, layout);
  ctx.putImageData(new ImageData(bitmap.data, bitmap.width, bitmap.height), 0, 0);
  return layout;
}

// ---------------------------------------------------------------------------
// The sender's loop
// ---------------------------------------------------------------------------

/** Schedules `fn` and returns its canceller. Injected so the cycler is testable. */
export type Timer = (fn: () => void, ms: number) => () => void;

const defaultTimer: Timer = (fn, ms) => {
  const handle = setTimeout(fn, ms);
  return () => clearTimeout(handle);
};

export interface CyclerOptions extends RenderOptions {
  fps?: number;
  timer?: Timer;
  onFrame?: (index: number) => void;
}

export interface FrameCycler {
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Index of the frame currently on the glass. */
  readonly index: number;
}

/**
 * Loops the frames indefinitely at 5 fps. There is no end and no "done": the
 * receiver decides when it has everything, and the sender has no way to know.
 */
export function createFrameCycler(
  canvas: HTMLCanvasElement,
  matrices: readonly QrMatrix[],
  options: CyclerOptions = {},
): FrameCycler {
  if (matrices.length === 0) throw new Error('nothing to display: the frame set is empty');
  const fps = options.fps ?? FRAME_RATE;
  if (fps <= 0) throw new Error(`fps must be positive, got ${fps}`);
  const period = 1000 / fps;
  const timer = options.timer ?? defaultTimer;

  let index = 0;
  let cancel: (() => void) | null = null;
  // Tracked separately from `cancel` because a one-frame set schedules nothing
  // and would otherwise report itself as stopped while its code is on screen -
  // and one frame is the common case, not the corner one.
  let started = false;

  const draw = (): void => {
    renderMatrix(canvas, matrices[index]!, options);
    options.onFrame?.(index);
  };

  const tick = (): void => {
    index = (index + 1) % matrices.length;
    draw();
    cancel = timer(tick, period);
  };

  return {
    start(): void {
      if (started) return; // Starting twice would stack two loops.
      started = true;
      draw();
      // A single frame is a still picture; scheduling it would only redraw the
      // same pixels five times a second and cost the sender battery.
      if (matrices.length > 1) cancel = timer(tick, period);
    },
    stop(): void {
      started = false;
      cancel?.();
      cancel = null;
    },
    get running(): boolean {
      return started;
    },
    get index(): number {
      return index;
    },
  };
}

export interface TransferAdvice {
  frames: number;
  /** One full loop at `FRAME_RATE`. */
  cycleSeconds: number;
  /** The UI should offer the file instead. */
  preferFile: boolean;
  message: string;
}

export function describeTransfer(frameCount: number): TransferAdvice {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error(`frame count must be a positive integer, got ${frameCount}`);
  }
  const cycleSeconds = Math.round((frameCount / FRAME_RATE) * 10) / 10;
  const preferFile = frameCount > FILE_PREFERRED_ABOVE;
  const message = preferFile
    ? `${frameCount} codes, ${cycleSeconds} s per loop. Sending the file is faster and more reliable.`
    : frameCount === 1
      ? 'One code. Hold the other camera on it.'
      : `${frameCount} codes, ${cycleSeconds} s per loop. Hold the other camera steady for one full loop.`;
  return { frames: frameCount, cycleSeconds, preferFile, message };
}

// ---------------------------------------------------------------------------
// Screen brightness
// ---------------------------------------------------------------------------

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

interface BrightnessBridge {
  setBrightness(value: number): unknown;
}

export interface ScreenBoost {
  /** The screen was held awake. */
  wakeLock: boolean;
  /** The backlight was actually raised. */
  brightness: boolean;
  /** Nothing worked: the UI should ask the user to turn brightness up by hand. */
  manual: boolean;
  release(): Promise<void>;
}

/**
 * No web standard exposes the backlight, so on a plain browser the honest
 * outcome is a wake lock plus a `manual` flag - and the wake lock is the half
 * that matters most anyway, since the usual failure is the screen dimming
 * itself halfway through the loop. The brightness bridge only ever fires
 * inside a native wrapper that injects one.
 *
 * Never throws. A device that refuses all of this still transfers fine, just
 * with a bit more squinting. Callers should show the `manual` flag rather than
 * assume the name of this function was honoured: on most browsers the
 * brightness half is simply unavailable.
 */
export async function requestMaxBrightness(): Promise<ScreenBoost> {
  let sentinel: WakeLockSentinelLike | null = null;
  let brightness = false;

  const wakeLock = (globalThis.navigator as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } } | undefined)
    ?.wakeLock;
  const request = async (): Promise<void> => {
    try {
      sentinel = (await wakeLock?.request('screen')) ?? null;
    } catch {
      sentinel = null;
    }
  };
  await request();

  // A wake lock is dropped when the tab hides and is never restored on its own.
  // Only worth listening for where there is a lock to restore: on a browser
  // without the API this would be a listener that can never do anything, kept
  // alive by a caller who has been told (via `manual`) that nothing was taken.
  const onVisible = (): void => {
    if (globalThis.document?.visibilityState === 'visible' && sentinel?.released !== false) {
      void request();
    }
  };
  if (wakeLock !== undefined) globalThis.document?.addEventListener('visibilitychange', onVisible);

  const bridge = (globalThis as { ScreenBrightness?: BrightnessBridge }).ScreenBrightness;
  if (typeof bridge?.setBrightness === 'function') {
    try {
      await bridge.setBrightness(1);
      brightness = true;
    } catch {
      brightness = false;
    }
  }

  return {
    wakeLock: sentinel !== null,
    brightness,
    manual: sentinel === null && !brightness,
    async release(): Promise<void> {
      globalThis.document?.removeEventListener('visibilitychange', onVisible);
      try {
        await sentinel?.release();
      } catch {
        // The sentinel was already gone. Nothing to undo.
      }
      sentinel = null;
    },
  };
}

// ---------------------------------------------------------------------------
// The receiver's accumulator
// ---------------------------------------------------------------------------

export interface TransferProgress {
  transferId: number | null;
  received: number;
  total: number | null;
  /** Indices still outstanding, ascending. */
  missing: number[];
  complete: boolean;
  /** Ready to show: "4 of 6 received". */
  label: string;
}

export interface CompletedTransfer {
  transferId: number;
  /** As declared by the sender. Verifying it against `payload` belongs to frames.ts. */
  crc32: number;
  payload: Uint8Array;
  frames: number;
}

export type RejectReason =
  | 'other-transfer'
  | 'crc-mismatch'
  | 'total-mismatch'
  | 'index-out-of-range'
  | 'conflicting-chunk'
  | 'checksum-failed';

export interface AcceptResult {
  outcome: 'added' | 'duplicate' | 'rejected';
  reason: RejectReason | null;
  progress: TransferProgress;
  /** Set only on the frame that finished the set, so completion fires once. */
  completed: CompletedTransfer | null;
}

export interface Accumulator {
  accept(frame: TransferFrame): AcceptResult;
  reset(): void;
  readonly progress: TransferProgress;
  readonly completed: CompletedTransfer | null;
}

export interface AccumulatorOptions {
  /**
   * Pass `crc32` from frames.ts to have the finished payload checked here. Left
   * out, the payload is handed over with the sender's declared checksum for the
   * caller to verify - this module deliberately does not carry a second copy of
   * that algorithm.
   */
  verify?: (payload: Uint8Array) => number;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Locks onto the first transfer it sees and rejects everything else until it is
 * reset. Two people sending at the same table is the case this exists for: the
 * alternative, silently switching to whichever code drifted into frame last,
 * loses the half-received set and tells the user nothing.
 */
export function createAccumulator(options: AccumulatorOptions = {}): Accumulator {
  let transferId: number | null = null;
  let total: number | null = null;
  let crc32: number | null = null;
  let chunks: (Uint8Array | undefined)[] = [];
  let received = 0;
  let completed: CompletedTransfer | null = null;

  const clear = (): void => {
    transferId = null;
    total = null;
    crc32 = null;
    chunks = [];
    received = 0;
    completed = null;
  };

  const snapshot = (): TransferProgress => {
    const missing: number[] = [];
    if (total !== null) {
      for (let i = 0; i < total; i += 1) if (chunks[i] === undefined) missing.push(i);
    }
    return {
      transferId,
      received,
      total,
      missing,
      complete: total !== null && received === total,
      label: total === null ? 'Waiting for a code' : `${received} of ${total} received`,
    };
  };

  const reject = (reason: RejectReason): AcceptResult => ({
    outcome: 'rejected',
    reason,
    progress: snapshot(),
    completed: null,
  });

  return {
    accept(frame: TransferFrame): AcceptResult {
      if (frame.total < 1 || frame.index >= frame.total) return reject('index-out-of-range');

      if (transferId === null) {
        transferId = frame.transferId;
        total = frame.total;
        crc32 = frame.crc32;
        chunks = new Array<Uint8Array | undefined>(frame.total);
      } else if (frame.transferId !== transferId) {
        return reject('other-transfer');
      } else if (frame.total !== total) {
        return reject('total-mismatch');
      } else if (frame.crc32 !== crc32) {
        // Same transferId, different payload checksum: the sender restarted
        // with an edited character and happened to draw the same id.
        return reject('crc-mismatch');
      }

      const existing = chunks[frame.index];
      if (existing !== undefined) {
        // QR error correction makes a silently corrupt read very unlikely, so
        // two different bodies for one index means something else is wrong.
        if (!sameBytes(existing, frame.chunk)) return reject('conflicting-chunk');
        return { outcome: 'duplicate', reason: null, progress: snapshot(), completed: null };
      }

      chunks[frame.index] = frame.chunk;
      received += 1;

      if (received < frame.total) {
        return { outcome: 'added', reason: null, progress: snapshot(), completed: null };
      }

      const payload = new Uint8Array(chunks.reduce((n, c) => n + (c?.length ?? 0), 0));
      let offset = 0;
      for (const chunk of chunks) {
        payload.set(chunk!, offset);
        offset += chunk!.length;
      }

      if (options.verify !== undefined && options.verify(payload) !== frame.crc32) {
        // Keeping the frames would fail the same way forever; start over so the
        // user can just point the camera back at the loop.
        clear();
        return reject('checksum-failed');
      }

      completed = { transferId: frame.transferId, crc32: frame.crc32, payload, frames: frame.total };
      return { outcome: 'added', reason: null, progress: snapshot(), completed };
    },
    reset: clear,
    get progress(): TransferProgress {
      return snapshot();
    },
    get completed(): CompletedTransfer | null {
      return completed;
    },
  };
}

// ---------------------------------------------------------------------------
// The receiver's camera
// ---------------------------------------------------------------------------

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (init?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

/**
 * BarcodeDetector hands back a string, not bytes, and our payload is binary.
 * ZXing-backed implementations decode byte mode as ISO-8859-1, so reading the
 * code units straight out recovers the original bytes; others hand over a UTF-8
 * decode, which re-encoding undoes *only when the bytes were valid UTF-8*. Both
 * are guesses, which is why the caller feeds each one to `unpackFrame` and keeps
 * whichever parses.
 *
 * The re-encoding is only offered when it is provably lossless. A UTF-8 decode
 * of arbitrary binary turns every invalid sequence into U+FFFD, and encoding
 * that back yields EF BF BD where a byte used to be. Our header is ASCII and
 * survives that intact, so a mangled frame still passes `unpackFrame` and a
 * corrupted chunk reaches the accumulator - silently, unless a `verify` was
 * supplied. Dropping the reading instead costs nothing: the frame is on screen
 * five times a second, and a detector that mangles one code mangles them all,
 * which is what demotes the scanner to jsQR.
 */
export function candidateBytes(rawValue: string): Uint8Array[] {
  const out: Uint8Array[] = [];
  let latin1Safe = true;
  const codes = new Uint8Array(rawValue.length);
  for (let i = 0; i < rawValue.length; i += 1) {
    const code = rawValue.charCodeAt(i);
    if (code > 0xff) {
      latin1Safe = false;
      break;
    }
    codes[i] = code;
  }
  if (latin1Safe) out.push(codes);

  const utf8 = new TextEncoder().encode(rawValue);
  const lossless =
    // U+FFFD is the decoder's record of a byte it could not keep. It round-trips
    // happily, so only its presence in the string gives the loss away.
    !rawValue.includes('�') &&
    // Catches the other direction: a lone surrogate encodes to EF BF BD, which
    // would be three bytes we invented.
    new TextDecoder().decode(utf8) === rawValue;
  if (lossless && (out.length === 0 || !sameBytes(out[0]!, utf8))) out.push(utf8);
  return out;
}

export function frameFromRawValue(rawValue: string): TransferFrame | null {
  for (const bytes of candidateBytes(rawValue)) {
    const frame = unpackFrame(bytes);
    if (frame !== null) return frame;
  }
  return null;
}

export type DecoderKind = 'barcode-detector' | 'jsqr';

export interface ScannerOptions extends AccumulatorOptions {
  /** Where the preview goes. A detached element is made if none is given. */
  video?: HTMLVideoElement;
  facingMode?: 'environment' | 'user';
  /** Longest edge of the buffer handed to jsQR. Below ~240 the modules blur together. */
  sampleSize?: number;
  scanIntervalMs?: number;
  timer?: Timer;
  /** Fires for every frame we manage to read, duplicates and rejections included. */
  onFrame?: (result: AcceptResult) => void;
  onComplete?: (transfer: CompletedTransfer) => void;
  onError?: (error: Error) => void;
  /** Injected in tests. Defaults to `navigator.mediaDevices.getUserMedia`. */
  openCamera?: () => Promise<MediaStream>;
}

export interface QrScanner {
  start(): Promise<void>;
  /** Idempotent, and safe to call before, during or after `start`. */
  stop(): void;
  reset(): void;
  readonly progress: TransferProgress;
  readonly running: boolean;
  readonly decoder: DecoderKind | null;
  readonly video: HTMLVideoElement;
}

/** Enough failed native reads to conclude its strings are not our bytes. */
const NATIVE_FIDELITY_BUDGET = 5;
/**
 * Consecutive broken scan passes before we give up and let the camera go. The
 * realistic cause is a 2d context we never get, which will not fix itself, and
 * a camera held open by a loop that cannot read it is the worst of both.
 */
const SCAN_FAILURE_BUDGET = 5;

function cameraError(cause: unknown): Error {
  const name = cause instanceof Error ? cause.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new Error('Camera access was denied. Allow the camera, or import the file instead.');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new Error('No camera was found on this device. Import the file instead.');
    case 'NotReadableError':
      return new Error('The camera is already in use by another app.');
    default:
      return new Error(
        `The camera could not be opened: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
  }
}

type Grab = (source: CanvasImageSource, width: number, height: number) => ImageData;

function createGrab(): Grab {
  // willReadFrequently matters here: this canvas is read back ten times a second.
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx === null) throw new Error('offscreen 2d context unavailable');
    return (source, width, height) => {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(source, 0, 0, width, height);
      return ctx.getImageData(0, 0, width, height);
    };
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('canvas 2d context unavailable');
  return (source, width, height) => {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(source, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  };
}

/**
 * The camera track is the thing to get right. A phone that keeps its camera
 * open after the user leaves the screen burns battery and leaves the indicator
 * light on, which reads as spyware and is a fair reading. `stop` releases every
 * track, is safe to call twice, and - the case that actually leaks - releases
 * the stream even when it arrives after `stop` was called.
 *
 * Every `stop` opens a new run, and a `start` that has been superseded releases
 * whatever it opened and touches nothing else. Without that, a user who backs
 * out of the screen and comes straight back leaves the first `getUserMedia`
 * still in flight: it resolves into a scanner that has already moved on, and
 * that first stream is then held by nothing at all.
 *
 * The UI owns the lifecycle: no global listeners are installed here, so `stop`
 * must be called on unmount.
 */
export function createQrScanner(options: ScannerOptions = {}): QrScanner {
  const video = options.video ?? document.createElement('video');
  const sampleSize = options.sampleSize ?? 480;
  const interval = options.scanIntervalMs ?? 100;
  const timer = options.timer ?? defaultTimer;
  const accumulator = createAccumulator(options);

  let stream: MediaStream | null = null;
  let decoder: DecoderKind | null = null;
  let detector: BarcodeDetectorLike | null = null;
  let nativeMisses = 0;
  let grab: Grab | null = null;
  let cancelTick: (() => void) | null = null;
  let running = false;
  let ticking = false;
  let scanFailures = 0;
  /** Bumped by every stop. Anything carrying an older number has been orphaned. */
  let run = 0;

  const releaseCamera = (): void => {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    if (video.srcObject !== null) {
      video.pause();
      video.srcObject = null;
    }
  };

  const handle = (frame: TransferFrame): void => {
    const result = accumulator.accept(frame);
    options.onFrame?.(result);
    if (result.completed !== null) {
      // Stop first: the camera has nothing left to find, and holding it open
      // while the UI navigates away is how a track gets orphaned.
      stopScanner();
      options.onComplete?.(result.completed);
    }
  };

  const readNative = async (): Promise<boolean> => {
    if (detector === null) return false;
    const found = await detector.detect(video);
    if (found.length === 0) return true;
    for (const barcode of found) {
      const frame = frameFromRawValue(barcode.rawValue);
      if (frame !== null) {
        nativeMisses = 0;
        handle(frame);
        return true;
      }
    }
    // Either these are somebody else's QR codes or this detector cannot hand
    // back our bytes. jsQR copes with both, so stop guessing which it is.
    nativeMisses += 1;
    return nativeMisses < NATIVE_FIDELITY_BUDGET;
  };

  const readJsqr = (): void => {
    grab ??= createGrab();
    const scale = Math.min(1, sampleSize / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const image = grab(video, width, height);
    // We always paint dark on light, so the inverted pass would be wasted work.
    const found = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
    if (found === null) return;
    const bytes =
      found.binaryData.length > 0 ? Uint8Array.from(found.binaryData) : null;
    const frame = bytes !== null ? unpackFrame(bytes) : frameFromRawValue(found.data);
    if (frame !== null) handle(frame);
  };

  const tick = async (): Promise<void> => {
    if (ticking) return;
    const mine = run;
    ticking = true;
    try {
      // videoWidth stays 0 until the first decoded picture arrives.
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (decoder === 'barcode-detector') {
          let stillTrusted: boolean;
          try {
            stillTrusted = await readNative();
          } catch {
            // A detector that throws on this source throws on every frame, so
            // surfacing it would be an error a second with no way to act on it.
            // jsQR reads the same picture: demote and say nothing.
            stillTrusted = false;
          }
          if (!stillTrusted) {
            decoder = 'jsqr';
            detector = null;
          }
        } else {
          readJsqr();
        }
      }
      scanFailures = 0;
    } catch (cause) {
      scanFailures += 1;
      // Only the first is worth showing: the loop repeats ten times a second.
      if (scanFailures === 1) {
        options.onError?.(cause instanceof Error ? cause : new Error(String(cause)));
      }
      if (scanFailures >= SCAN_FAILURE_BUDGET) {
        stopScanner();
        options.onError?.(
          new Error('The camera preview could not be read. Import the file instead.'),
        );
      }
    } finally {
      ticking = false;
      // A run that has been stopped and restarted already has its own loop; if
      // this one rescheduled too they would both keep going, for good.
      if (running && mine === run) cancelTick = timer(() => void tick(), interval);
    }
  };

  function stopScanner(): void {
    running = false;
    run += 1;
    cancelTick?.();
    cancelTick = null;
    releaseCamera();
  }

  return {
    async start(): Promise<void> {
      if (running) return;
      // Restarting after a finished transfer means a new character; restarting
      // after the app was backgrounded means the same one, so a half-received
      // set is kept.
      if (accumulator.completed !== null) accumulator.reset();
      running = true;
      scanFailures = 0;
      const mine = run;
      /** True once stop() - or a later start() - has left this attempt behind. */
      const orphaned = (): boolean => !running || mine !== run;

      try {
        const open =
          options.openCamera ??
          (() =>
            navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: options.facingMode ?? 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            }));
        const opened = await open();
        if (orphaned()) {
          // stop() landed while getUserMedia was in flight. Release what we
          // opened and touch nothing else - a newer run may already own the
          // video element, and this stream is held by nobody.
          for (const track of opened.getTracks()) track.stop();
          return;
        }
        stream = opened;
        video.srcObject = opened;
        video.muted = true;
        video.playsInline = true;
        await video.play();
        if (orphaned()) {
          for (const track of opened.getTracks()) track.stop();
          return;
        }
      } catch (cause) {
        // Backing out of the screen aborts play() and rejects getUserMedia.
        // That is the user's own doing, not a camera fault worth reporting.
        if (orphaned()) return;
        stopScanner();
        const error = cameraError(cause);
        options.onError?.(error);
        throw error;
      }

      const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      let native: BarcodeDetectorLike | null = null;
      if (Detector !== undefined) {
        try {
          const formats = await Detector.getSupportedFormats();
          if (formats.includes('qr_code')) native = new Detector({ formats: ['qr_code'] });
        } catch {
          native = null;
        }
      }
      if (orphaned()) return;
      if (native !== null) {
        detector = native;
        decoder = 'barcode-detector';
      }
      decoder ??= 'jsqr';
      cancelTick = timer(() => void tick(), interval);
    },
    stop: stopScanner,
    reset(): void {
      accumulator.reset();
    },
    get progress(): TransferProgress {
      return accumulator.progress;
    },
    get running(): boolean {
      return running;
    },
    get decoder(): DecoderKind | null {
      return decoder;
    },
    video,
  };
}
