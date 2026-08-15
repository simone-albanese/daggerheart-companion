import { describe, expect, it } from 'vitest';
import {
  ART_PACK_MIME,
  ART_PACK_WARNING,
  ArtPackError,
  artPackFilename,
  buildArtPack,
  readArtPack,
  type ArtPackInput,
} from '../../src/import/artPack.ts';

/** Stand-ins for WebP payloads: the container never looks inside them. */
const bytes = (...values: number[]): Blob => new Blob([new Uint8Array(values)]);

const sample = (): ArtPackInput[] => [
  { slug: 'rune-ward', blob: bytes(1, 2, 3, 4), width: 600, height: 405 },
  { slug: 'monetts-cloak', blob: bytes(9), width: 512, height: 600 },
  { slug: 'natures-tongue', blob: bytes(7, 7, 7), width: 600, height: 466 },
];

const read = async (blob: Blob): Promise<number[]> =>
  [...new Uint8Array(await blob.arrayBuffer())];

describe('buildArtPack', () => {
  it('refuses without an acknowledgement, so the warning cannot be skipped', () => {
    expect(() => buildArtPack(sample(), { acknowledged: false })).toThrow(ArtPackError);
    expect(ART_PACK_WARNING).toMatch(/your own devices/i);
  });

  it('refuses an empty pack and duplicate slugs', () => {
    expect(() => buildArtPack([], { acknowledged: true })).toThrow(/empty/i);
    const twice = [...sample(), sample()[0]!];
    expect(() => buildArtPack(twice, { acknowledged: true })).toThrow(/Duplicate slug/);
  });

  it('refuses a size that cannot be stored', () => {
    const bad = [{ slug: 'x', blob: bytes(1), width: 0, height: 10 }];
    expect(() => buildArtPack(bad, { acknowledged: true })).toThrow(/impossible size/);
  });
});

describe('art pack round trip', () => {
  it('gives back every image, byte for byte, with its dimensions', async () => {
    const items = sample();
    const pack = buildArtPack(items, { acknowledged: true });
    expect(pack.type).toBe(ART_PACK_MIME);

    const entries = await readArtPack(pack);
    expect(entries.map((x) => x.slug)).toEqual(items.map((i) => i.slug));
    for (const [i, entry] of entries.entries()) {
      const original = items[i]!;
      expect(entry.width).toBe(original.width);
      expect(entry.height).toBe(original.height);
      expect(entry.byteLength).toBe(original.blob.size);
      expect(entry.blob.type).toBe('image/webp');
      expect(await read(entry.blob)).toEqual(await read(original.blob));
    }
  });

  it('survives a non-ASCII slug, whose bytes outnumber its characters', async () => {
    // `slugify` yields ASCII, so this is defence rather than a live case - but
    // the index is length-prefixed in *bytes* and every offset after it is
    // wrong if anything ever measures the string instead. Two characters that
    // cost three bytes each are enough to catch that.
    const slug = 'kātari-☠';
    expect(new TextEncoder().encode(slug).length).toBeGreaterThan(slug.length);

    const items = [
      { slug, blob: bytes(3, 4, 5), width: 8, height: 8 },
      { slug: 'plain', blob: bytes(6), width: 8, height: 8 },
    ];
    const entries = await readArtPack(buildArtPack(items, { acknowledged: true }));
    expect(entries.map((e) => e.slug)).toEqual([slug, 'plain']);
    // The second image would be read from the wrong offset if the first slug's
    // length had been miscounted, and would still be one byte long.
    expect(await read(entries[0]!.blob)).toEqual([3, 4, 5]);
    expect(await read(entries[1]!.blob)).toEqual([6]);
  });

  it('is exactly header plus index plus payload, with nothing left over', async () => {
    const items = sample();
    const pack = buildArtPack(items, { acknowledged: true });
    const payload = items.reduce((n, i) => n + i.blob.size, 0);
    const index = items.reduce((n, i) => n + 2 + i.slug.length + 2 + 2 + 4, 0);
    expect(pack.size).toBe(14 + index + payload);
  });

  it('scales to a per-domain pack without reading the images', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      slug: `arcana-card-${i}`,
      blob: new Blob([new Uint8Array(1024).fill(i)]),
      width: 600,
      height: 400,
    }));
    const entries = await readArtPack(buildArtPack(items, { acknowledged: true }));
    expect(entries).toHaveLength(21);
    expect(await read(entries[20]!.blob)).toEqual([...new Uint8Array(1024).fill(20)]);
  });
});

describe('readArtPack rejects a damaged pack', () => {
  const good = (): Blob => buildArtPack(sample(), { acknowledged: true });

  it('rejects a file that is not a pack', async () => {
    await expect(readArtPack(new Blob([new Uint8Array(64)]))).rejects.toThrow(/signature/);
    await expect(readArtPack(new Blob([new Uint8Array(3)]))).rejects.toThrow(/too short/);
  });

  it('rejects a future format rather than guessing at it', async () => {
    const raw = new Uint8Array(await good().arrayBuffer());
    raw[5] = 2;
    await expect(readArtPack(new Blob([raw]))).rejects.toThrow(/newer version/);
  });

  it('rejects a truncated download', async () => {
    const pack = good();
    await expect(readArtPack(pack.slice(0, pack.size - 2))).rejects.toThrow(/truncated/);
  });

  it('rejects trailing rubbish appended to the file', async () => {
    const pack = good();
    await expect(readArtPack(new Blob([pack, new Uint8Array(16)]))).rejects.toThrow(/mismatch/);
  });

  it('rejects an index that claims more entries than it holds', async () => {
    const raw = new Uint8Array(await good().arrayBuffer());
    new DataView(raw.buffer).setUint32(6, 99, true);
    await expect(readArtPack(new Blob([raw]))).rejects.toThrow(/index ends mid-entry/);
  });
});

describe('artPackFilename', () => {
  it('names a whole pack and a per-domain pack', () => {
    expect(artPackFilename('all')).toBe('daggerheart-all.dhart');
    expect(artPackFilename('arcana')).toBe('daggerheart-arcana.dhart');
  });
});
