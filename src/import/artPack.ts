/**
 * The `.dhart` art pack: the card illustrations, indexed by slug, and nothing
 * else.
 *
 * Extracting art needs a desktop, a 319 MB PDF and a lot of memory. Using art
 * needs none of that, and the phone is where the app is actually played. So
 * the desktop writes one file and the phone reads it - the same reasoning that
 * gives characters a `.dhchar` file.
 *
 * The container is deliberately dull: a fixed header, a length-prefixed index,
 * then the WebP bytes back to back in index order. That shape is what makes
 * the read cheap on a phone. The header and the index are a few kilobytes; the
 * images are never decoded, never copied and never held in memory, because
 * `Blob.slice` hands out a view of the file that goes straight into IndexedDB.
 * Reading a 20 MB pack costs about as much memory as reading its index.
 *
 * There is no text in the file beyond the slugs, and no rules content of any
 * kind. It is illustrations from a book the user bought, for the devices that
 * user owns - see `ART_PACK_WARNING`, which the creation flow must show.
 */

export const ART_PACK_EXTENSION = '.dhart';
export const ART_PACK_MIME = 'application/x-daggerheart-art';

/**
 * Shown before a pack is written, every time. `buildArtPack` refuses without
 * an explicit acknowledgement so this cannot quietly fall out of the UI.
 */
export const ART_PACK_WARNING =
  'This pack contains illustrations from the Daggerheart Core Rulebook. It is for ' +
  'your own devices, so you can use the art you paid for on a phone or tablet ' +
  'without carrying the PDF around. Sharing it is redistributing the book, so ' +
  'please do not - point people at daggerheart.com instead.';

const MAGIC = [0x44, 0x48, 0x41, 0x52, 0x54] as const; // "DHART"
const VERSION = 1;
const HEADER_BYTES = 14; // magic 5, version 1, count 4, indexLen 4

/** One image on its way into a pack. */
export interface ArtPackInput {
  /** Dataset slug this illustrates, e.g. `rune-ward`. */
  slug: string;
  blob: Blob;
  width: number;
  height: number;
}

/** One image read back out of a pack. `blob` is a view, not a copy. */
export interface ArtPackEntry {
  slug: string;
  width: number;
  height: number;
  byteLength: number;
  blob: Blob;
}

export class ArtPackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtPackError';
  }
}

const utf8 = new TextEncoder();

/**
 * Write a pack.
 *
 * The image bytes are handed to the `Blob` constructor untouched, so a
 * 20 MB pack is assembled without ever holding 20 MB of pixels.
 */
export function buildArtPack(
  items: readonly ArtPackInput[],
  options: { acknowledged: boolean },
): Blob {
  if (!options.acknowledged) {
    throw new ArtPackError(
      'Refusing to build an art pack that the user has not been warned about. ' +
        'Show ART_PACK_WARNING and pass { acknowledged: true }.',
    );
  }
  if (items.length === 0) throw new ArtPackError('Refusing to build an empty art pack.');

  const seen = new Set<string>();
  const slugs: Uint8Array[] = [];
  let indexLen = 0;
  for (const item of items) {
    if (!item.slug) throw new ArtPackError('Art pack entry with no slug.');
    if (seen.has(item.slug)) throw new ArtPackError(`Duplicate slug in art pack: ${item.slug}`);
    seen.add(item.slug);
    if (item.width <= 0 || item.height <= 0 || item.width > 0xffff || item.height > 0xffff) {
      throw new ArtPackError(`Art pack entry ${item.slug} has an impossible size.`);
    }
    const slug = utf8.encode(item.slug);
    if (slug.length > 0xffff) throw new ArtPackError(`Slug too long: ${item.slug}`);
    slugs.push(slug);
    indexLen += 2 + slug.length + 2 + 2 + 4;
  }

  const head = new Uint8Array(HEADER_BYTES + indexLen);
  const view = new DataView(head.buffer);
  head.set(MAGIC, 0);
  head[5] = VERSION;
  view.setUint32(6, items.length, true);
  view.setUint32(10, indexLen, true);

  let at = HEADER_BYTES;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const slug = slugs[i]!;
    view.setUint16(at, slug.length, true);
    at += 2;
    head.set(slug, at);
    at += slug.length;
    view.setUint16(at, item.width, true);
    at += 2;
    view.setUint16(at, item.height, true);
    at += 2;
    view.setUint32(at, item.blob.size, true);
    at += 4;
  }

  return new Blob([head, ...items.map((i) => i.blob)], { type: ART_PACK_MIME });
}

/**
 * Read a pack's index and hand back a `Blob` per image.
 *
 * Only the header and the index are read; the images stay in the file. Every
 * length is checked against the file's real size, so a truncated or mangled
 * pack is rejected outright rather than half-imported.
 */
export async function readArtPack(pack: Blob): Promise<ArtPackEntry[]> {
  if (pack.size < HEADER_BYTES) throw new ArtPackError('Not an art pack: the file is too short.');

  const header = new DataView(await pack.slice(0, HEADER_BYTES).arrayBuffer());
  for (let i = 0; i < MAGIC.length; i += 1) {
    if (header.getUint8(i) !== MAGIC[i]) {
      throw new ArtPackError('Not an art pack: wrong file signature.');
    }
  }
  const version = header.getUint8(5);
  if (version !== VERSION) {
    throw new ArtPackError(
      `This art pack was written by a newer version of the app (format ${version}).`,
    );
  }
  const count = header.getUint32(6, true);
  const indexLen = header.getUint32(10, true);
  if (HEADER_BYTES + indexLen > pack.size) throw new ArtPackError('Art pack index is truncated.');

  const index = new DataView(await pack.slice(HEADER_BYTES, HEADER_BYTES + indexLen).arrayBuffer());
  const decoder = new TextDecoder('utf-8', { fatal: true });

  const entries: ArtPackEntry[] = [];
  let at = 0;
  let offset = HEADER_BYTES + indexLen;
  for (let i = 0; i < count; i += 1) {
    if (at + 2 > indexLen) throw new ArtPackError('Art pack index ends mid-entry.');
    const slugLen = index.getUint16(at, true);
    at += 2;
    if (at + slugLen + 8 > indexLen) throw new ArtPackError('Art pack index ends mid-entry.');
    let slug: string;
    try {
      slug = decoder.decode(new Uint8Array(index.buffer, index.byteOffset + at, slugLen));
    } catch {
      throw new ArtPackError('Art pack index is not valid UTF-8.');
    }
    at += slugLen;
    const width = index.getUint16(at, true);
    at += 2;
    const height = index.getUint16(at, true);
    at += 2;
    const byteLength = index.getUint32(at, true);
    at += 4;

    if (offset + byteLength > pack.size) {
      throw new ArtPackError(`Art pack is truncated: ${slug} runs past the end of the file.`);
    }
    entries.push({
      slug,
      width,
      height,
      byteLength,
      blob: pack.slice(offset, offset + byteLength, 'image/webp'),
    });
    offset += byteLength;
  }

  if (at !== indexLen) throw new ArtPackError('Art pack index has trailing bytes.');
  if (offset !== pack.size) {
    throw new ArtPackError(
      `Art pack size mismatch: images account for ${offset} of ${pack.size} bytes.`,
    );
  }
  return entries;
}

/** `daggerheart-arcana.dhart`. `scope` is a domain id, or `all`. */
export const artPackFilename = (scope: string): string =>
  `daggerheart-${scope}${ART_PACK_EXTENSION}`;
