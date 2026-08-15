/**
 * The receiver has no way to ask for a frame again: it either survives what the
 * camera happens to catch, in whatever order, or the transfer is a coin toss.
 * So most of this file is about disorder - duplicates, interleaving, and two
 * people sending at once.
 */
import { describe, expect, it } from 'vitest';
import {
  FRAME_HEADER_BYTES,
  FRAME_MAGIC,
  FrameCollector,
  MAX_CHUNK_BYTES,
  MAX_FRAMES,
  characterFromPayload,
  chunkPayload,
  crc32,
  framesForCharacter,
  framesNeeded,
  packFrame,
  toFrameBytes,
  unpackFrame,
} from '../../src/transfer/frames.ts';
import { encodeCharacter } from '../../src/transfer/codec.ts';
import { normalizeHandles, testRegistry, wizard } from './fixtures.ts';

const payloadOf = (length: number, seed = 1): Uint8Array =>
  Uint8Array.from({ length }, (_u, i) => (i * 31 + seed * 17) % 256);

const shuffled = <T>(items: T[], seed = 7): T[] => {
  const out = [...items];
  let n = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    n = (n * 1103515245 + 12345) % 2147483648;
    const j = n % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

describe('the header', () => {
  it('is eleven bytes, big-endian, in the documented order', () => {
    const chunk = Uint8Array.from([9, 9, 9]);
    const packed = packFrame({ transferId: 0x0102, index: 2, total: 5, crc32: 0x0a0b0c0d, chunk });

    expect(packed).toHaveLength(FRAME_HEADER_BYTES + 3);
    expect(String.fromCharCode(...packed.slice(0, 3))).toBe(FRAME_MAGIC);
    expect([...packed.slice(3, 11)]).toEqual([0x01, 0x02, 2, 5, 0x0a, 0x0b, 0x0c, 0x0d]);
    expect([...packed.slice(11)]).toEqual([9, 9, 9]);
    expect(unpackFrame(packed)).toEqual({
      transferId: 0x0102,
      index: 2,
      total: 5,
      crc32: 0x0a0b0c0d,
      chunk,
    });
  });

  it('ignores anything that is not one of ours', () => {
    expect(unpackFrame(new TextEncoder().encode('WIFI:S:cafe;;'))).toBeNull();
    expect(unpackFrame(new Uint8Array(4))).toBeNull();
    const truncated = packFrame({ transferId: 1, index: 0, total: 1, crc32: 0, chunk: new Uint8Array() });
    expect(unpackFrame(truncated.slice(0, 7))).toBeNull();
  });

  it('is the same wire format qr.ts speaks', async () => {
    // qr.ts re-exports these, but a re-export is only a promise until something
    // checks it: this is the test that two implementations can never drift.
    const qr = await import('../../src/transfer/qr.ts');
    const frame = { transferId: 0xbeef, index: 1, total: 3, crc32: 0x00ff80c0, chunk: payloadOf(12) };
    expect(qr.packFrame(frame)).toEqual(packFrame(frame));
    expect(qr.unpackFrame(packFrame(frame))).toEqual(unpackFrame(qr.packFrame(frame)));
    expect(qr.MAX_CHUNK_BYTES).toBe(MAX_CHUNK_BYTES);
    expect(qr.FRAME_HEADER_BYTES).toBe(FRAME_HEADER_BYTES);
  });
});

describe('cutting', () => {
  it('never exceeds the chunk limit and repeats one crc across the set', () => {
    const payload = payloadOf(1000);
    const frames = chunkPayload(payload, 0x1234);

    expect(frames).toHaveLength(framesNeeded(payload.length));
    expect(frames).toHaveLength(6);
    for (const [i, frame] of frames.entries()) {
      expect(frame.chunk.length).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
      expect(frame.index).toBe(i);
      expect(frame.total).toBe(6);
      expect(frame.transferId).toBe(0x1234);
      expect(frame.crc32).toBe(crc32(payload));
    }
    expect(frames.reduce((n, f) => n + f.chunk.length, 0)).toBe(payload.length);
  });

  it('always sends at least one frame, even for nothing', () => {
    expect(chunkPayload(new Uint8Array())).toHaveLength(1);
  });

  it('refuses a payload no frame index can address', () => {
    const huge = new Uint8Array(MAX_CHUNK_BYTES * MAX_FRAMES + 1);
    expect(() => chunkPayload(huge)).toThrow(/Send the file instead/);
  });

  it('draws a different transferId each time', () => {
    const ids = new Set(Array.from({ length: 40 }, () => chunkPayload(payloadOf(10))[0]!.transferId));
    expect(ids.size).toBeGreaterThan(30);
  });
});

describe('reassembling', () => {
  it('accepts frames in any order', () => {
    const payload = payloadOf(700);
    const frames = toFrameBytes(payload, 0x2222);
    const collector = new FrameCollector();

    let done: Uint8Array | null = null;
    for (const frame of shuffled(frames)) {
      const result = collector.accept(frame);
      if (result.status === 'complete') done = result.payload;
    }
    expect(done).toEqual(payload);
  });

  it('shrugs off the same frame arriving twenty times', () => {
    const payload = payloadOf(400);
    const frames = toFrameBytes(payload, 0x3333);
    const collector = new FrameCollector();

    expect(collector.accept(frames[0]!).status).toBe('partial');
    for (let i = 0; i < 20; i += 1) {
      expect(collector.accept(frames[0]!).status).toBe('duplicate');
    }
    expect(collector.current()?.received).toBe(1);
    expect(collector.accept(frames[1]!).status).toBe('partial');
    const last = collector.accept(frames[2]!);
    expect(last.status).toBe('complete');
    if (last.status === 'complete') expect(last.payload).toEqual(payload);
  });

  it('counts the way the screen reads it', () => {
    const frames = toFrameBytes(payloadOf(1000), 0x4444);
    const collector = new FrameCollector();
    for (const i of [3, 0, 5, 2]) collector.accept(frames[i]!);

    const progress = collector.current()!;
    expect(progress.label).toBe('4 of 6 received');
    expect(progress.received).toBe(4);
    expect(progress.total).toBe(6);
    expect(progress.missing).toEqual([2, 5]); // 1-based: frames 2 and 5
    expect(progress.complete).toBe(false);
  });

  it('keeps two people sending at once apart', () => {
    const one = payloadOf(500, 1);
    const two = payloadOf(320, 2);
    const framesOne = toFrameBytes(one, 0x0111);
    const framesTwo = toFrameBytes(two, 0x0222);
    const collector = new FrameCollector();

    // The camera sees them interleaved, as it would across a table.
    const seen: Uint8Array[] = [];
    for (let i = 0; i < Math.max(framesOne.length, framesTwo.length); i += 1) {
      if (framesTwo[i] !== undefined) seen.push(framesTwo[i]!);
      if (framesOne[i] !== undefined) seen.push(framesOne[i]!);
    }

    const completed = new Map<number, Uint8Array>();
    for (const frame of seen) {
      const result = collector.accept(frame);
      if (result.status === 'complete') completed.set(result.transferId, result.payload);
    }

    expect(completed.get(0x0111)).toEqual(one);
    expect(completed.get(0x0222)).toEqual(two);
    expect(collector.progress()).toHaveLength(2);
  });

  it('separates two transfers that drew the same id', () => {
    const one = payloadOf(300, 3);
    const two = payloadOf(300, 4);
    const framesOne = toFrameBytes(one, 0x5555);
    const framesTwo = toFrameBytes(two, 0x5555);
    const collector = new FrameCollector();

    expect(collector.accept(framesOne[0]!).status).toBe('partial');
    const clash = collector.accept(framesTwo[0]!);
    expect(clash.status).toBe('partial');
    if (clash.status === 'partial') expect(clash.mixed).toBe(true);

    const finishOne = collector.accept(framesOne[1]!);
    const finishTwo = collector.accept(framesTwo[1]!);
    expect(finishOne.status).toBe('complete');
    expect(finishTwo.status).toBe('complete');
    if (finishOne.status === 'complete') expect(finishOne.payload).toEqual(one);
    if (finishTwo.status === 'complete') expect(finishTwo.payload).toEqual(two);
  });

  it('rejects a set that does not add up, rather than handing over a wrong character', () => {
    const payload = payloadOf(400);
    const frames = chunkPayload(payload, 0x6666);
    // One chunk misread by the scanner, or lifted from another transfer.
    frames[1] = { ...frames[1]!, chunk: payloadOf(frames[1]!.chunk.length, 99) };
    const collector = new FrameCollector();

    collector.accept(packFrame(frames[0]!));
    collector.accept(packFrame(frames[2]!));
    const last = collector.accept(packFrame(frames[1]!));

    expect(last.status).toBe('corrupt');
    if (last.status === 'corrupt') {
      expect(last.reason).toMatch(/two different transfers/);
      expect(last.transferId).toBe(0x6666);
    }
    // And the ruined set is dropped, so the next scan starts clean.
    expect(collector.progress()).toHaveLength(0);
  });

  it('ignores what is not a transfer at all', () => {
    const collector = new FrameCollector();
    const result = collector.accept(new TextEncoder().encode('https://daggerheart.com'));
    expect(result.status).toBe('ignored');
    expect(collector.progress()).toHaveLength(0);
  });

  it('forgets a transfer on request', () => {
    const frames = toFrameBytes(payloadOf(400), 0x7777);
    const collector = new FrameCollector();
    collector.accept(frames[0]!);
    expect(collector.progress()).toHaveLength(1);
    collector.forget(0x7777);
    expect(collector.current()).toBeNull();
  });
});

describe('a character, end to end', () => {
  it('goes out as frames and comes back as the same sheet', async () => {
    const original = wizard();
    const frames = await framesForCharacter(original, testRegistry);
    expect(frames.length).toBeLessThanOrEqual(2);

    const collector = new FrameCollector();
    let payload: Uint8Array | null = null;
    for (const frame of shuffled(frames.map(packFrame), 11)) {
      const result = collector.accept(frame);
      if (result.status === 'complete') payload = result.payload;
    }
    expect(payload).not.toBeNull();
    expect(payload).toEqual(await encodeCharacter(original, testRegistry));

    const { character, warnings } = await characterFromPayload(payload!, testRegistry);
    expect(warnings).toEqual([]);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(original));
  });
});
