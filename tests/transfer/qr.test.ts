import { describe, expect, it, vi } from 'vitest';
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';

import { crc32 } from '../../src/transfer/crc32.ts';
import {
  DEFAULT_QUIET_ZONE,
  FILE_PREFERRED_ABOVE,
  FRAME_HEADER_BYTES,
  MAX_CHUNK_BYTES,
  MAX_FRAMES,
  MAX_QR_MODULES,
  MAX_QR_VERSION,
  candidateBytes,
  createAccumulator,
  createFrameCycler,
  createQrScanner,
  describeTransfer,
  encodeByteFrames,
  encodeBytes,
  encodeFrames,
  frameFromRawValue,
  layoutMatrix,
  matrixToRgba,
  packFrame,
  qrModulesForVersion,
  qrVersionForBytes,
  unpackFrame,
  type QrLayout,
  type QrMatrix,
  type TransferFrame,
  type Timer,
} from '../../src/transfer/qr.ts';

// renderMatrix hands its pixels to the canvas as an ImageData. The node
// environment has no such constructor, and nothing here inspects the result.
class StubImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number,
  ) {}
}
(globalThis as { ImageData?: unknown }).ImageData ??= StubImageData;

const chunkFor = (index: number): Uint8Array => new Uint8Array([index, index + 100]);

const joined = (chunks: Uint8Array[]): Uint8Array =>
  Uint8Array.from(chunks.flatMap((c) => [...c]));

/**
 * A frame whose declared checksum is the real one for the set it belongs to.
 *
 * It used to be a fixed `0xdead_beef`, which was harmless while the accumulator
 * only checked the payload if the caller asked it to. It always checks now, so
 * a fixture that lies about its own checksum is a fixture that can never
 * complete - and the tests below are about completing.
 */
const frame = (index: number, total: number, over: Partial<TransferFrame> = {}): TransferFrame => ({
  transferId: 0x1234,
  index,
  total,
  crc32: crc32(joined(Array.from({ length: total }, (_, i) => chunkFor(i)))),
  chunk: chunkFor(index),
  ...over,
});

const bytes = (n: number): Uint8Array =>
  Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);

describe('frame header', () => {
  it('round-trips every field', () => {
    const original = frame(3, 7, {
      transferId: 0xfeed,
      crc32: 0x89ab_cdef,
      chunk: bytes(MAX_CHUNK_BYTES),
    });
    const unpacked = unpackFrame(packFrame(original));
    expect(unpacked).toEqual(original);
  });

  it('is eleven bytes of "DH1" header, big-endian', () => {
    const packed = packFrame(frame(0, 1, { transferId: 0x0102, crc32: 0x0a0b_0c0d, chunk: new Uint8Array() }));
    expect(packed).toHaveLength(FRAME_HEADER_BYTES);
    expect([...packed]).toEqual([0x44, 0x48, 0x31, 0x01, 0x02, 0, 1, 0x0a, 0x0b, 0x0c, 0x0d]);
  });

  it('refuses a chunk past the limit that keeps a frame at version 12', () => {
    expect(() => packFrame(frame(0, 1, { chunk: bytes(MAX_CHUNK_BYTES + 1) }))).toThrow(/181 bytes/);
  });

  it('refuses out-of-range field values', () => {
    expect(() => packFrame(frame(2, 2))).toThrow(/out of range/);
    expect(() => packFrame(frame(0, 0))).toThrow(/at least 1/);
    expect(() => packFrame(frame(0, 1, { transferId: 0x1_0000 }))).toThrow(/transferId/);
    expect(() => packFrame(frame(0, 1, { crc32: -1 }))).toThrow(/crc32/);
  });

  it('returns null for anything that is not one of our frames', () => {
    expect(unpackFrame(new Uint8Array())).toBeNull();
    expect(unpackFrame(new TextEncoder().encode('WIFI:S:cafe;;'))).toBeNull();
    expect(unpackFrame(packFrame(frame(0, 1)).slice(0, 5))).toBeNull();

    const wrongMagic = packFrame(frame(0, 1));
    wrongMagic[2] = 0x32; // "DH2"
    expect(unpackFrame(wrongMagic)).toBeNull();

    const badIndex = packFrame(frame(1, 2));
    badIndex[6] = 1; // total 1, index 1
    expect(unpackFrame(badIndex)).toBeNull();

    const overlong = new Uint8Array(FRAME_HEADER_BYTES + MAX_CHUNK_BYTES + 1);
    overlong.set(packFrame(frame(0, 1, { chunk: new Uint8Array() })));
    expect(unpackFrame(overlong)).toBeNull();
  });

  it('reads a frame that sits inside a larger buffer', () => {
    // jsQR hands back a plain array we copy; a subarray view must still parse.
    const packed = packFrame(frame(2, 4));
    const padded = new Uint8Array(packed.length + 8);
    padded.set(packed, 8);
    expect(unpackFrame(padded.subarray(8))).toEqual(frame(2, 4));
  });
});

describe('sizing', () => {
  it('agrees with qrcode-generator about byte capacity at level M', () => {
    // Guards the hard-coded ISO capacity table against a library change: at the
    // byte count our table calls the last that fits a version, the library must
    // agree, and one byte more must not.
    const fits = (version: number, byteLength: number): boolean => {
      try {
        const code = qrcode(version as Parameters<typeof qrcode>[0], 'M');
        code.addData('x'.repeat(byteLength), 'Byte');
        code.make();
        return true;
      } catch {
        return false;
      }
    };

    for (let version = 1; version <= MAX_QR_VERSION; version += 1) {
      let capacity = 0;
      for (let n = 1; n <= 400; n += 1) {
        let claimed: number;
        try {
          claimed = qrVersionForBytes(n);
        } catch {
          break;
        }
        if (claimed === version) capacity = n;
      }
      expect(capacity, `version ${version} has some capacity`).toBeGreaterThan(0);
      expect(fits(version, capacity), `version ${version} holds ${capacity} bytes`).toBe(true);
      expect(fits(version, capacity + 1), `version ${version} overflows at ${capacity + 1}`).toBe(false);
    }
  });

  it('maps a version to its module count', () => {
    expect(qrModulesForVersion(1)).toBe(21);
    expect(qrModulesForVersion(MAX_QR_VERSION)).toBe(MAX_QR_MODULES);
  });

  it('keeps every legal frame at version 12 or below', () => {
    for (let chunk = 0; chunk <= MAX_CHUNK_BYTES; chunk += 1) {
      const version = qrVersionForBytes(FRAME_HEADER_BYTES + chunk);
      expect(version, `chunk of ${chunk} bytes`).toBeLessThanOrEqual(MAX_QR_VERSION);
    }
  });

  it('puts a full 180-byte chunk at version 10, with headroom to spare', () => {
    expect(qrVersionForBytes(FRAME_HEADER_BYTES + MAX_CHUNK_BYTES)).toBe(10);
  });

  it('fails loudly rather than silently reaching for a bigger code', () => {
    expect(() => qrVersionForBytes(288)).toThrow(/will not fit/);
  });
});

describe('encoding', () => {
  it('encodes a maximum frame inside the 65-module ceiling', () => {
    const matrix = encodeBytes(packFrame(frame(0, 1, { chunk: bytes(MAX_CHUNK_BYTES) })));
    expect(matrix.version).toBeLessThanOrEqual(MAX_QR_VERSION);
    expect(matrix.size).toBeLessThanOrEqual(MAX_QR_MODULES);
    expect(matrix.size).toBe(qrModulesForVersion(matrix.version));
    expect(matrix.modules).toHaveLength(matrix.size * matrix.size);
    // Top-left finder pattern: dark corner, light ring.
    expect(matrix.modules[0]).toBe(1);
    expect(matrix.modules[1 * matrix.size + 1]).toBe(0);
  });

  it('gives every frame in a set the same version', () => {
    const frames = [bytes(191), bytes(191), bytes(12)];
    const matrices = encodeByteFrames(frames);
    expect(matrices).toHaveLength(3);
    expect(new Set(matrices.map((m) => m.size)).size).toBe(1);
    expect(matrices[0]!.version).toBe(qrVersionForBytes(191));
  });

  it('refuses an empty set and a set past the u8 index', () => {
    expect(() => encodeByteFrames([])).toThrow(/empty/);
    expect(() => encodeByteFrames(Array.from({ length: MAX_FRAMES + 1 }, () => bytes(4)))).toThrow(
      /send the file/,
    );
  });

  it('survives a full trip through the decoder, byte for byte', () => {
    // The whole point of the latin-1 detour: binary payloads must come back
    // unchanged, not UTF-8 mangled.
    const original = frame(2, 5, { transferId: 0xbeef, crc32: 0x00ff_80c0, chunk: bytes(MAX_CHUNK_BYTES) });
    const matrix = encodeBytes(packFrame(original));
    const layout = pixelLayout(matrix, 5, DEFAULT_QUIET_ZONE);
    const bitmap = matrixToRgba(matrix, layout);

    const read = jsQR(bitmap.data, bitmap.width, bitmap.height, { inversionAttempts: 'dontInvert' });
    expect(read).not.toBeNull();
    expect(unpackFrame(Uint8Array.from(read!.binaryData))).toEqual(original);
  });

  it('round-trips a set through encodeFrames', () => {
    const set = [frame(0, 2, { chunk: bytes(180) }), frame(1, 2, { chunk: bytes(40) })];
    const matrices = encodeFrames(set);
    for (const [i, matrix] of matrices.entries()) {
      const bitmap = matrixToRgba(matrix, pixelLayout(matrix, 5, DEFAULT_QUIET_ZONE));
      const read = jsQR(bitmap.data, bitmap.width, bitmap.height, { inversionAttempts: 'dontInvert' });
      expect(unpackFrame(Uint8Array.from(read!.binaryData))).toEqual(set[i]);
    }
  });
});

describe('layout', () => {
  it('uses a whole number of pixels per module', () => {
    const matrix: QrMatrix = { size: 57, version: 10, modules: new Uint8Array(57 * 57) };
    const layout = layoutMatrix(matrix, { cssSize: 400, devicePixelRatio: 2, quietZone: 6 });
    const total = 57 + 12;
    expect(layout.modulePixels).toBe(Math.floor(800 / total));
    expect(Number.isInteger(layout.modulePixels)).toBe(true);
    expect(layout.pixelSize).toBe(total * layout.modulePixels);
    expect(layout.cssSize).toBe(layout.pixelSize / 2);
  });

  it('never collapses a module below one pixel', () => {
    const matrix: QrMatrix = { size: 65, version: 12, modules: new Uint8Array(65 * 65) };
    expect(layoutMatrix(matrix, { cssSize: 10, devicePixelRatio: 1 }).modulePixels).toBe(1);
  });

  it('rejects a fractional quiet zone', () => {
    const matrix: QrMatrix = { size: 21, version: 1, modules: new Uint8Array(21 * 21) };
    expect(() => layoutMatrix(matrix, { quietZone: 4.5 })).toThrow(/whole number/);
  });

  it('paints the quiet zone white and the dark modules black', () => {
    const matrix: QrMatrix = { size: 2, version: 1, modules: Uint8Array.from([1, 0, 0, 1]) };
    const layout: QrLayout = { pixelSize: 4 * 1, modulePixels: 1, quietZone: 1, cssSize: 4 };
    const { data, width } = matrixToRgba(matrix, layout);
    const at = (x: number, y: number): number => data[(y * width + x) * 4]!;
    expect(at(0, 0)).toBe(255); // quiet zone
    expect(at(1, 1)).toBe(0); // module (0,0) is dark
    expect(at(2, 1)).toBe(255);
    expect(at(2, 2)).toBe(0); // module (1,1) is dark
  });
});

describe('transfer advice', () => {
  it('recommends the file above about fifteen frames', () => {
    expect(describeTransfer(FILE_PREFERRED_ABOVE).preferFile).toBe(false);
    expect(describeTransfer(FILE_PREFERRED_ABOVE + 1).preferFile).toBe(true);
    expect(describeTransfer(20).message).toMatch(/file is faster/);
  });

  it('reports the loop time at five frames a second', () => {
    expect(describeTransfer(6).cycleSeconds).toBe(1.2);
    expect(describeTransfer(1).message).toBe('One code. Hold the other camera on it.');
  });

  it('refuses a nonsense frame count', () => {
    expect(() => describeTransfer(0)).toThrow(/positive integer/);
  });
});

describe('accumulator', () => {
  it('starts out waiting', () => {
    const acc = createAccumulator();
    expect(acc.progress).toMatchObject({ received: 0, total: null, complete: false, label: 'Waiting for a code' });
  });

  it('accepts frames in any order and completes on the last one', () => {
    const acc = createAccumulator();
    const order = [2, 0, 1];
    const chunks = [0, 1, 2].map((i) => Uint8Array.from([i * 10, i * 10 + 1]));
    const sum = crc32(joined(chunks));
    let completed = null;
    for (const index of order) {
      const result = acc.accept(frame(index, 3, { chunk: chunks[index], crc32: sum }));
      expect(result.outcome).toBe('added');
      completed ??= result.completed;
    }
    expect(acc.progress.complete).toBe(true);
    expect(acc.completed).not.toBeNull();
    // Reassembled by index, not by arrival.
    expect([...acc.completed!.payload]).toEqual([0, 1, 10, 11, 20, 21]);
    expect(acc.completed!.frames).toBe(3);
    expect(acc.completed!.transferId).toBe(0x1234);
  });

  it('reports progress the way the UI shows it', () => {
    const acc = createAccumulator();
    for (const index of [5, 0, 3, 1]) acc.accept(frame(index, 6));
    expect(acc.progress.label).toBe('4 of 6 received');
    expect(acc.progress.missing).toEqual([2, 4]);
  });

  it('signals completion exactly once', () => {
    const acc = createAccumulator();
    const completions = [
      acc.accept(frame(0, 2)),
      acc.accept(frame(1, 2)),
      acc.accept(frame(0, 2)),
      acc.accept(frame(1, 2)),
    ];
    expect(completions.map((c) => c.completed !== null)).toEqual([false, true, false, false]);
    expect(completions[2]!.outcome).toBe('duplicate');
  });

  it('counts a repeated frame once', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 4));
    const again = acc.accept(frame(0, 4));
    expect(again.outcome).toBe('duplicate');
    expect(again.reason).toBeNull();
    expect(acc.progress.received).toBe(1);
  });

  it('rejects a second transfer at the same table', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 3));
    const other = acc.accept(frame(1, 3, { transferId: 0x9999 }));
    expect(other).toMatchObject({ outcome: 'rejected', reason: 'other-transfer' });
    expect(acc.progress.received).toBe(1);
    expect(acc.progress.transferId).toBe(0x1234);
  });

  it('rejects a frame from a different payload', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 3));
    expect(acc.accept(frame(1, 3, { crc32: 1 })).reason).toBe('crc-mismatch');
    expect(acc.accept(frame(1, 4)).reason).toBe('total-mismatch');
    expect(acc.progress.received).toBe(1);
  });

  it('rejects an impossible index', () => {
    const acc = createAccumulator();
    expect(acc.accept(frame(3, 3)).reason).toBe('index-out-of-range');
    expect(acc.accept(frame(0, 0)).reason).toBe('index-out-of-range');
    expect(acc.progress.total).toBeNull();
  });

  it('rejects two different bodies for one index', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 2, { chunk: Uint8Array.from([1, 2]) }));
    const conflict = acc.accept(frame(0, 2, { chunk: Uint8Array.from([9, 9]) }));
    expect(conflict).toMatchObject({ outcome: 'rejected', reason: 'conflicting-chunk' });
  });

  /**
   * Nobody has to ask for this, and that is the point.
   *
   * `verify` used to be an option, and both surfaces that ship passed it - so
   * nothing was ever wrong. What was wrong is that a third receive surface
   * would have inherited nothing by writing one line fewer than the other two,
   * and no test anywhere would have noticed.
   */
  it('checks what it reassembled without being asked to', () => {
    const acc = createAccumulator();
    // Every frame agrees on a checksum, and every frame is wrong about it - so
    // the frame-header comparison passes and only the payload check can refuse.
    const lying = { crc32: 0xdead_beef };
    acc.accept(frame(0, 2, lying));
    const failed = acc.accept(frame(1, 2, lying));
    expect(failed).toMatchObject({ outcome: 'rejected', reason: 'checksum-failed', completed: null });
    expect(acc.completed).toBeNull();
    // Starting over, rather than keeping frames that would fail the same way
    // forever: the user just points the camera back at the loop.
    expect(acc.progress.label).toBe('Waiting for a code');
  });

  it('completes a set whose checksum is the truth, so it is not refusing everything', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 2));
    const done = acc.accept(frame(1, 2));
    expect(done.completed).not.toBeNull();
    expect([...done.completed!.payload]).toEqual([0, 100, 1, 101]);
  });

  it('forgets everything on reset', () => {
    const acc = createAccumulator();
    acc.accept(frame(0, 2));
    acc.reset();
    expect(acc.progress.received).toBe(0);
    expect(acc.accept(frame(0, 3, { transferId: 0x4321 })).outcome).toBe('added');
  });
});

describe('frame cycler', () => {
  it('loops indefinitely at five frames a second', () => {
    const canvas = fakeCanvas();
    const timer = manualTimer();
    const seen: number[] = [];
    const cycler = createFrameCycler(canvas.element, threeMatrices(), {
      timer: timer.schedule,
      onFrame: (i) => seen.push(i),
      cssSize: 200,
      devicePixelRatio: 1,
    });

    cycler.start();
    expect(seen).toEqual([0]);
    expect(timer.lastDelay).toBe(200);
    timer.fire();
    timer.fire();
    timer.fire();
    timer.fire();
    expect(seen).toEqual([0, 1, 2, 0, 1]);
    expect(cycler.index).toBe(1);
    expect(cycler.running).toBe(true);
  });

  it('does not stack two loops when started twice', () => {
    const canvas = fakeCanvas();
    const timer = manualTimer();
    const cycler = createFrameCycler(canvas.element, threeMatrices(), { timer: timer.schedule });
    cycler.start();
    cycler.start();
    expect(timer.pending).toBe(1);
    cycler.stop();
    expect(timer.pending).toBe(0);
    expect(cycler.running).toBe(false);
  });

  it('draws a single frame once and schedules nothing', () => {
    const canvas = fakeCanvas();
    const timer = manualTimer();
    const cycler = createFrameCycler(canvas.element, threeMatrices().slice(0, 1), { timer: timer.schedule });
    cycler.start();
    expect(canvas.puts).toBe(1);
    expect(timer.pending).toBe(0);
    // The typical character is one frame, so this is the common case, not the
    // corner one: a cycler showing a code must not report itself as stopped.
    expect(cycler.running).toBe(true);
    cycler.start();
    expect(canvas.puts, 'and starting again does not redraw').toBe(1);
    cycler.stop(); // still safe with nothing scheduled
    expect(cycler.running).toBe(false);
  });

  it('refuses an empty set', () => {
    expect(() => createFrameCycler(fakeCanvas().element, [], {})).toThrow(/empty/);
  });
});

describe('barcode-detector byte recovery', () => {
  it('recovers bytes a detector handed back as latin-1', () => {
    const original = frame(1, 3, { chunk: bytes(60) });
    const packed = packFrame(original);
    const raw = String.fromCharCode(...packed);
    expect(frameFromRawValue(raw)).toEqual(original);
  });

  it('recovers bytes a detector handed back UTF-8 decoded', () => {
    // An ASCII chunk survives a UTF-8 decode, so re-encoding gets it back.
    const original = frame(0, 2, { crc32: 0x4142_4344, chunk: new TextEncoder().encode('notes') });
    const raw = new TextDecoder().decode(packFrame(original));
    expect(frameFromRawValue(raw)).toEqual(original);
  });

  it('refuses a UTF-8 reading that lost bytes on the way in', () => {
    // The dangerous case, because it parses. Our header is ASCII and survives
    // any decode, so a chunk that came back as U+FFFD still passes unpackFrame
    // and lands in the accumulator as a byte sequence the sender never sent.
    const original = frame(0, 2, {
      transferId: 0x1234,
      crc32: 0x0a0b_0c0d, // every header byte below 0x80, so only the chunk is hurt
      chunk: Uint8Array.from([0xff, 0x41]),
    });
    const mangled = new TextDecoder().decode(packFrame(original));
    expect(mangled).toContain('�');
    expect(frameFromRawValue(mangled)).toBeNull();
  });

  it('does not invent bytes for a lone surrogate', () => {
    // TextEncoder turns an unpaired surrogate into EF BF BD: three bytes that
    // were never in the code.
    expect(candidateBytes('DH1\ud800')).toEqual([]);
  });

  it('gives up on a string that is not one of our frames', () => {
    expect(frameFromRawValue('https://example.invalid')).toBeNull();
    expect(frameFromRawValue('')).toBeNull();
  });

  it('offers the latin-1 reading first and does not repeat itself', () => {
    expect(candidateBytes('AB')).toHaveLength(1); // both readings identical
    expect([...candidateBytes('ÿ')[0]!]).toEqual([0xff]);
    expect(candidateBytes('€')).toHaveLength(1); // no latin-1 reading possible
  });
});

describe('scanner camera lifecycle', () => {
  it('releases every track on stop', async () => {
    const camera = fakeCamera();
    const scanner = createQrScanner({
      video: fakeVideo(),
      openCamera: camera.open,
      timer: manualTimer().schedule,
    });
    await scanner.start();
    expect(camera.stopped()).toBe(0);
    scanner.stop();
    expect(camera.stopped()).toBe(2);
    expect(scanner.running).toBe(false);
    scanner.stop(); // idempotent
    expect(camera.stopped()).toBe(2);
  });

  it('releases a stream that arrives after stop was called', async () => {
    // The leak: the user backs out of the screen while the permission prompt is
    // still up, and nothing is left holding a reference to the stream.
    const camera = fakeCamera();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const scanner = createQrScanner({
      video: fakeVideo(),
      openCamera: async () => {
        await gate;
        return camera.open();
      },
      timer: manualTimer().schedule,
    });

    const started = scanner.start();
    scanner.stop();
    release();
    await started;
    expect(camera.stopped()).toBe(2);
  });

  it('turns a denied camera into something worth showing a user', async () => {
    const onError = vi.fn();
    const scanner = createQrScanner({
      video: fakeVideo(),
      onError,
      openCamera: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })),
    });
    await expect(scanner.start()).rejects.toThrow(/Camera access was denied/);
    expect(onError).toHaveBeenCalledOnce();
    expect(scanner.running).toBe(false);
  });

  it('falls back to jsQR when no BarcodeDetector exists', async () => {
    const scanner = createQrScanner({
      video: fakeVideo(),
      openCamera: fakeCamera().open,
      timer: manualTimer().schedule,
    });
    expect(scanner.decoder).toBeNull();
    await scanner.start();
    expect(scanner.decoder).toBe('jsqr');
    scanner.stop();
  });

  it('releases a stream orphaned by a stop the user immediately undid', async () => {
    // Backing out of the screen and coming straight back: the first permission
    // prompt is still in flight, and when it resolves the scanner has moved on.
    // Nothing else holds that stream, so if this start does not release it, the
    // camera stays lit until the tab dies.
    const first = fakeCamera();
    const second = fakeCamera();
    let admitFirst!: () => void;
    const prompt = new Promise<void>((resolve) => {
      admitFirst = resolve;
    });
    let opens = 0;
    const scanner = createQrScanner({
      video: fakeVideo(),
      timer: manualTimer().schedule,
      openCamera: async () => {
        opens += 1;
        if (opens === 1) {
          await prompt;
          return first.open();
        }
        return second.open();
      },
    });

    const backedOut = scanner.start();
    scanner.stop();
    const cameBack = scanner.start();
    admitFirst();
    await backedOut;
    await cameBack;

    expect(first.stopped(), 'the orphaned stream').toBe(2);
    expect(second.stopped(), 'the live stream is untouched').toBe(0);
    expect(scanner.running).toBe(true);
    scanner.stop();
    expect(second.stopped()).toBe(2);
  });

  it('keeps one scan loop when a stop lands mid-read', async () => {
    // Two loops would double the scan rate and neither would ever be cancelled.
    let finishRead!: () => void;
    const read = new Promise<void>((resolve) => {
      finishRead = resolve;
    });
    class SlowDetector {
      static getSupportedFormats(): Promise<string[]> {
        return Promise.resolve(['qr_code']);
      }
      async detect(): Promise<{ rawValue: string }[]> {
        await read;
        return [];
      }
    }
    const slot = globalThis as { BarcodeDetector?: unknown };
    slot.BarcodeDetector = SlowDetector;
    try {
      const timer = manualTimer();
      const scanner = createQrScanner({
        video: fakeVideo(true),
        timer: timer.schedule,
        openCamera: fakeCamera().open,
      });
      await scanner.start();
      timer.fire(); // the read starts and blocks
      await settle();
      expect(timer.pending, 'nothing is scheduled while a read is in flight').toBe(0);

      scanner.stop();
      await scanner.start();
      expect(timer.pending).toBe(1);

      finishRead();
      await settle();
      expect(timer.pending, 'the abandoned read does not schedule a second loop').toBe(1);
      scanner.stop();
    } finally {
      delete slot.BarcodeDetector;
    }
  });

  it('stops itself and hands over the payload when the set completes', async () => {
    // The declared checksum has to be the payload's real one: the accumulator
    // checks it on completion now, without being asked to.
    const chunks = [Uint8Array.from([7, 8]), Uint8Array.from([9])];
    const sum = crc32(joined(chunks));
    const set = [
      frame(0, 2, { chunk: chunks[0], crc32: sum }),
      frame(1, 2, { chunk: chunks[1], crc32: sum }),
    ];
    const camera = fakeCamera();
    const timer = manualTimer();
    const onComplete = vi.fn();
    await withBarcodeDetector([asRawValue(set[0]!), asRawValue(set[1]!)], async () => {
      const scanner = createQrScanner({
        video: fakeVideo(true),
        timer: timer.schedule,
        openCamera: camera.open,
        onComplete,
      });
      await scanner.start();
      timer.fire();
      await settle();
      expect(scanner.progress.label).toBe('1 of 2 received');

      timer.fire();
      await settle();
      expect(onComplete).toHaveBeenCalledOnce();
      expect([...onComplete.mock.calls[0]![0].payload]).toEqual([7, 8, 9]);
      // The camera has nothing left to find, and a scanner left running while
      // the UI navigates away is how a track gets orphaned.
      expect(camera.stopped()).toBe(2);
      expect(scanner.running).toBe(false);
      expect(timer.pending).toBe(0);
    });
  });

  it('demotes a detector whose strings are not our bytes', async () => {
    const timer = manualTimer();
    const onError = vi.fn();
    await withBarcodeDetector(['https://example.invalid/menu'], async () => {
      const scanner = createQrScanner({
        video: fakeVideo(true),
        timer: timer.schedule,
        openCamera: fakeCamera().open,
        onError,
      });
      await scanner.start();
      expect(scanner.decoder).toBe('barcode-detector');
      // Somebody else's QR code is not an error, so it takes a few before we
      // conclude the detector cannot give us bytes rather than that we are
      // pointed at the wrong thing.
      for (let i = 0; i < 4; i += 1) {
        timer.fire();
        await settle();
        expect(scanner.decoder, `after ${i + 1} unusable reads`).toBe('barcode-detector');
      }
      timer.fire();
      await settle();
      expect(scanner.decoder).toBe('jsqr');
      expect(onError, 'a foreign QR code is not worth showing anyone').not.toHaveBeenCalled();
      scanner.stop();
    });
  });

  it('demotes a detector that throws, without telling the user', async () => {
    const timer = manualTimer();
    const onError = vi.fn();
    await withBarcodeDetector([new Error('detect failed')], async () => {
      const scanner = createQrScanner({
        video: fakeVideo(true),
        timer: timer.schedule,
        openCamera: fakeCamera().open,
        onError,
      });
      await scanner.start();
      timer.fire();
      await settle();
      // It would throw on every frame from here to the end of the transfer.
      expect(scanner.decoder).toBe('jsqr');
      expect(onError).not.toHaveBeenCalled();
      scanner.stop();
    });
  });

  it('gives the camera back when the preview cannot be read at all', async () => {
    // No document and no OffscreenCanvas here, so the jsQR path cannot get a
    // 2d context - the same shape as the failure that never fixes itself.
    const camera = fakeCamera();
    const timer = manualTimer();
    const onError = vi.fn();
    const scanner = createQrScanner({
      video: fakeVideo(true),
      timer: timer.schedule,
      openCamera: camera.open,
      onError,
    });
    await scanner.start();
    for (let i = 0; i < 6; i += 1) {
      timer.fire();
      await settle();
    }
    expect(scanner.running, 'a loop that cannot read must not hold the camera').toBe(false);
    expect(camera.stopped()).toBe(2);
    expect(onError.mock.calls.length, 'reported, not repeated ten times a second').toBeLessThanOrEqual(2);
    expect(timer.pending).toBe(0);
  });

  it('stays quiet when the user backs out mid-open', async () => {
    // stop() aborts play() and rejects getUserMedia. That is the user's doing,
    // not a camera fault, and start() must not reject in their face for it.
    let admit!: () => void;
    const prompt = new Promise<void>((resolve) => {
      admit = resolve;
    });
    const onError = vi.fn();
    const scanner = createQrScanner({
      video: fakeVideo(),
      timer: manualTimer().schedule,
      onError,
      openCamera: async () => {
        await prompt;
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    });
    const started = scanner.start();
    scanner.stop();
    admit();
    await expect(started).resolves.toBeUndefined();
    expect(onError).not.toHaveBeenCalled();
  });
});

// --- helpers ---------------------------------------------------------------

function pixelLayout(matrix: QrMatrix, modulePixels: number, quietZone: number): QrLayout {
  const pixelSize = (matrix.size + quietZone * 2) * modulePixels;
  return { pixelSize, modulePixels, quietZone, cssSize: pixelSize };
}

function threeMatrices(): QrMatrix[] {
  return encodeByteFrames([bytes(20), bytes(20), bytes(20)]);
}

/** Enough of a canvas for renderMatrix; the node environment has neither. */
function fakeCanvas(): { element: HTMLCanvasElement; puts: number } {
  const state = { puts: 0 };
  const element = {
    width: 0,
    height: 0,
    clientWidth: 0,
    style: {} as CSSStyleDeclaration,
    getContext: () => ({
      putImageData: () => {
        state.puts += 1;
      },
    }),
  };
  return {
    element: element as unknown as HTMLCanvasElement,
    get puts() {
      return state.puts;
    },
  };
}

/** `live` gives it the readyState and dimensions a tick needs to read a frame. */
function fakeVideo(live = false): HTMLVideoElement {
  return {
    srcObject: null,
    readyState: live ? 4 : 0,
    videoWidth: live ? 640 : 0,
    videoHeight: live ? 480 : 0,
    muted: false,
    playsInline: false,
    play: () => Promise.resolve(),
    pause: () => undefined,
  } as unknown as HTMLVideoElement;
}

/**
 * Installs a fake native detector for the duration of `body`. `reads` is what
 * each successive detect() call hands back: a string, or an error to throw.
 */
async function withBarcodeDetector(
  reads: (string | Error)[],
  body: () => Promise<void>,
): Promise<void> {
  let at = 0;
  class FakeDetector {
    static getSupportedFormats(): Promise<string[]> {
      return Promise.resolve(['qr_code']);
    }
    detect(): Promise<{ rawValue: string }[]> {
      const read = reads[Math.min(at, reads.length - 1)] ?? '';
      at += 1;
      if (read instanceof Error) return Promise.reject(read);
      return Promise.resolve(read === '' ? [] : [{ rawValue: read }]);
    }
  }
  const slot = globalThis as { BarcodeDetector?: unknown };
  const had = 'BarcodeDetector' in slot;
  const previous = slot.BarcodeDetector;
  slot.BarcodeDetector = FakeDetector;
  try {
    await body();
  } finally {
    if (had) slot.BarcodeDetector = previous;
    else delete slot.BarcodeDetector;
  }
}

/** Lets every queued microtask settle, so an awaited tick can finish. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

/** The latin-1 string a ZXing-backed detector hands back for these bytes. */
const asRawValue = (frame: TransferFrame): string => String.fromCharCode(...packFrame(frame));

function fakeCamera(): { open: () => Promise<MediaStream>; stopped: () => number } {
  let stopped = 0;
  const tracks = [0, 1].map(() => ({
    stop: () => {
      stopped += 1;
    },
  }));
  return {
    open: () => Promise.resolve({ getTracks: () => tracks } as unknown as MediaStream),
    stopped: () => stopped,
  };
}

function manualTimer(): { schedule: Timer; fire: () => void; pending: number; lastDelay: number } {
  const queue: (() => void)[] = [];
  let lastDelay = 0;
  const schedule: Timer = (fn, ms) => {
    lastDelay = ms;
    queue.push(fn);
    return () => {
      const at = queue.indexOf(fn);
      if (at >= 0) queue.splice(at, 1);
    };
  };
  return {
    schedule,
    fire: () => queue.shift()?.(),
    get pending() {
      return queue.length;
    },
    get lastDelay() {
      return lastDelay;
    },
  };
}

