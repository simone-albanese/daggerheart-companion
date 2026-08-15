/**
 * The framing layer: one payload becomes a set of QR-sized frames, and a set of
 * frames becomes one payload again.
 *
 *   "DH1" | transferId u16 | index u8 | total u8 | crc32 of the whole payload u32 | chunk
 *      3         2             1          1                 4                       <=180
 *
 * `codec.ts` owns the bytes and `qr.ts` owns the pixels; neither carries a
 * checksum, because the checksum belongs to the thing that was cut up. So the
 * wire format lives here, together with the cutting (Architecture 5.2, 5.3).
 *
 * There is no handshake. The sender loops its frames at 5 fps and the receiver
 * keeps the camera pointed until it has them all, so the collector has to
 * survive frames in any order, the same frame arriving twenty times, and two
 * people at one table sending two different characters at once.
 *
 * Two header fields do all of that work: `transferId` separates concurrent
 * senders, and the payload `crc32` - carried in every frame and re-checked
 * against the joined result - catches the case where they collide anyway, or
 * where a chunk was misread. A set whose crc does not match is thrown away and
 * reported, never handed on as a character.
 *
 * `qr.ts` keeps a second accumulator for the camera: it locks onto one transfer
 * and refuses the rest, which is the right behaviour for a person holding a
 * phone at a table. `FrameCollector` here is the general one - several
 * transfers at once, crc verified on completion - and owns the header, which
 * `qr.ts` re-exports rather than implementing twice.
 */
import type { Character } from '../../shared/types.ts';
import { decodeCharacter, encodeCharacter, type DecodeResult } from './codec.ts';
import { registry as committedRegistry, type Registry } from './registry.ts';

export const FRAME_MAGIC = 'DH1';
export const FRAME_HEADER_BYTES = 11;
/** Architecture 5.3. Leaves real headroom below the version-12 ceiling. */
export const MAX_CHUNK_BYTES = 180;
/** `total` is a u8, so a payload past this has to travel as a file. */
export const MAX_FRAMES = 255;
export const MAX_PAYLOAD_BYTES = MAX_CHUNK_BYTES * MAX_FRAMES;

/** `"DH1" | transferId u16 | index u8 | total u8 | crc32 u32 | chunk` */
export interface TransferFrame {
  /** Random per transfer: tells two people sending at the same table apart. */
  transferId: number;
  /** 0-based. */
  index: number;
  total: number;
  /** Over the whole reassembled payload, not this chunk. Rejects mixtures. */
  crc32: number;
  chunk: Uint8Array;
}

// ---------------------------------------------------------------------------
// crc32
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** IEEE 802.3 - the one every other tool means by "crc32". */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// The header
// ---------------------------------------------------------------------------

function assertU(value: number, bits: number, name: string): void {
  const max = 2 ** bits - 1;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${name} must be an integer in 0..${max}, got ${value}`);
  }
}

export function packFrame(frame: TransferFrame): Uint8Array {
  assertU(frame.transferId, 16, 'transferId');
  assertU(frame.index, 8, 'index');
  assertU(frame.total, 8, 'total');
  assertU(frame.crc32, 32, 'crc32');
  if (frame.total < 1) throw new Error('total must be at least 1');
  if (frame.index >= frame.total) {
    throw new Error(`frame index ${frame.index} is out of range for a set of ${frame.total}`);
  }
  if (frame.chunk.length > MAX_CHUNK_BYTES) {
    throw new Error(
      `chunk of ${frame.chunk.length} bytes exceeds the ${MAX_CHUNK_BYTES}-byte limit that keeps a frame readable at arm's length`,
    );
  }

  const bytes = new Uint8Array(FRAME_HEADER_BYTES + frame.chunk.length);
  for (let i = 0; i < FRAME_MAGIC.length; i += 1) bytes[i] = FRAME_MAGIC.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  view.setUint16(3, frame.transferId, false);
  view.setUint8(5, frame.index);
  view.setUint8(6, frame.total);
  view.setUint32(7, frame.crc32, false);
  bytes.set(frame.chunk, FRAME_HEADER_BYTES);
  return bytes;
}

/**
 * Returns null rather than throwing: at ten scans a second the camera will read
 * plenty of QR codes that are not ours - a menu, someone's wifi card - and none
 * of them are an error worth showing.
 */
export function unpackFrame(bytes: Uint8Array): TransferFrame | null {
  if (bytes.length < FRAME_HEADER_BYTES) return null;
  for (let i = 0; i < FRAME_MAGIC.length; i += 1) {
    if (bytes[i] !== FRAME_MAGIC.charCodeAt(i)) return null;
  }
  if (bytes.length - FRAME_HEADER_BYTES > MAX_CHUNK_BYTES) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = view.getUint8(6);
  const index = view.getUint8(5);
  if (total < 1 || index >= total) return null;

  return {
    transferId: view.getUint16(3, false),
    index,
    total,
    crc32: view.getUint32(7, false),
    chunk: bytes.slice(FRAME_HEADER_BYTES),
  };
}

// ---------------------------------------------------------------------------
// Cutting
// ---------------------------------------------------------------------------

export const framesNeeded = (payloadLength: number): number =>
  Math.max(1, Math.ceil(payloadLength / MAX_CHUNK_BYTES));

/** Random per transfer, so two people sending at one table stay separable. */
const newTransferId = (): number => {
  const buf = new Uint8Array(2);
  crypto.getRandomValues(buf);
  return (buf[0]! << 8) | buf[1]!;
};

export function chunkPayload(payload: Uint8Array, transferId = newTransferId()): TransferFrame[] {
  const total = framesNeeded(payload.length);
  if (total > MAX_FRAMES) {
    throw new Error(
      `${payload.length} bytes needs ${total} codes, past the ${MAX_FRAMES} a frame index can address. Send the file instead.`,
    );
  }
  assertU(transferId, 16, 'transferId');
  const checksum = crc32(payload);
  return Array.from({ length: total }, (_unused, index) => ({
    transferId,
    index,
    total,
    crc32: checksum,
    chunk: payload.slice(index * MAX_CHUNK_BYTES, (index + 1) * MAX_CHUNK_BYTES),
  }));
}

/** The same cut, already packed: the bytes a QR - or anything else - carries. */
export const toFrameBytes = (payload: Uint8Array, transferId?: number): Uint8Array[] =>
  chunkPayload(payload, transferId).map(packFrame);

export const framesForCharacter = async (
  character: Character,
  registry: Registry = committedRegistry,
): Promise<TransferFrame[]> => chunkPayload(await encodeCharacter(character, registry));

export const characterFromPayload = (
  payload: Uint8Array,
  registry: Registry = committedRegistry,
): Promise<DecodeResult> => decodeCharacter(payload, registry);

// ---------------------------------------------------------------------------
// Reassembling
// ---------------------------------------------------------------------------

export interface TransferProgress {
  transferId: number;
  crc32: number;
  total: number;
  received: number;
  /** Frame numbers still outstanding, 1-based, ascending. */
  missing: number[];
  complete: boolean;
  /** Ready to show: "4 of 6 received". */
  label: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

export type AcceptResult =
  | { status: 'ignored'; reason: string }
  | { status: 'duplicate'; progress: TransferProgress }
  | { status: 'partial'; progress: TransferProgress; mixed: boolean }
  | { status: 'complete'; progress: TransferProgress; transferId: number; payload: Uint8Array }
  | { status: 'corrupt'; reason: string; transferId: number };

interface Group {
  transferId: number;
  crc32: number;
  total: number;
  chunks: Array<Uint8Array | undefined>;
  received: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

const groupKey = (f: TransferFrame): string => `${f.transferId}:${f.crc32}:${f.total}`;

function snapshot(g: Group): TransferProgress {
  const missing: number[] = [];
  for (let i = 0; i < g.total; i += 1) if (g.chunks[i] === undefined) missing.push(i + 1);
  return {
    transferId: g.transferId,
    crc32: g.crc32,
    total: g.total,
    received: g.received,
    missing,
    complete: g.received === g.total,
    label: `${g.received} of ${g.total} received`,
    firstSeenAt: g.firstSeenAt,
    lastSeenAt: g.lastSeenAt,
  };
}

function join(g: Group): Uint8Array {
  let length = 0;
  for (const chunk of g.chunks) length += chunk?.length ?? 0;
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of g.chunks) {
    if (chunk === undefined) continue;
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * Accumulates frames until a transfer is whole.
 *
 * Sets are keyed by transferId *and* payload crc, so two senders that happened
 * to draw the same random id show up as two sets rather than as one mangled
 * character.
 */
export class FrameCollector {
  private readonly groups = new Map<string, Group>();
  private readonly now: () => number;

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  accept(input: Uint8Array | TransferFrame): AcceptResult {
    const frame = input instanceof Uint8Array ? unpackFrame(input) : input;
    if (frame === null) return { status: 'ignored', reason: 'Not a Daggerheart transfer code.' };
    if (frame.index >= frame.total) {
      return {
        status: 'ignored',
        reason: `Frame ${frame.index + 1} is outside a set of ${frame.total}.`,
      };
    }

    const at = this.now();
    const key = groupKey(frame);
    const mixed = [...this.groups.values()].some(
      (g) =>
        g.transferId === frame.transferId && (g.crc32 !== frame.crc32 || g.total !== frame.total),
    );

    let group = this.groups.get(key);
    if (group === undefined) {
      group = {
        transferId: frame.transferId,
        crc32: frame.crc32,
        total: frame.total,
        chunks: new Array<Uint8Array | undefined>(frame.total).fill(undefined),
        received: 0,
        firstSeenAt: at,
        lastSeenAt: at,
      };
      this.groups.set(key, group);
    }
    group.lastSeenAt = at;

    if (group.chunks[frame.index] !== undefined) {
      return { status: 'duplicate', progress: snapshot(group) };
    }
    group.chunks[frame.index] = frame.chunk;
    group.received += 1;

    if (group.received < group.total) {
      return { status: 'partial', progress: snapshot(group), mixed };
    }

    const payload = join(group);
    if (crc32(payload) !== group.crc32) {
      // Frames from two transfers that agreed on id, count and declared crc, or
      // a chunk the scanner misread. Either way it is not a character.
      this.groups.delete(key);
      return {
        status: 'corrupt',
        reason:
          'Those codes did not add up to a whole character - they may be from two different transfers. Start the scan again.',
        transferId: group.transferId,
      };
    }
    return { status: 'complete', progress: snapshot(group), transferId: group.transferId, payload };
  }

  /** Live transfers, most recently seen first. The "4 of 6 received" readout. */
  progress(): TransferProgress[] {
    return [...this.groups.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt).map(snapshot);
  }

  /** The set the camera is looking at now, or null before the first frame. */
  current(): TransferProgress | null {
    return this.progress()[0] ?? null;
  }

  forget(transferId: number): void {
    for (const [key, g] of this.groups) if (g.transferId === transferId) this.groups.delete(key);
  }

  reset(): void {
    this.groups.clear();
  }
}
