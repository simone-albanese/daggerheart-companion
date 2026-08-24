/**
 * The app mark, rendered to the files a manifest needs.
 *
 * The mark is the two diamonds from the header: Hope warm on the left, Fear
 * violet on the right, overlapping at the centre. Where they cross, the fill is
 * the *screen* blend of the two - the two lights added rather than averaged,
 * which is what light on a dark ground actually does. Both diamonds and their
 * intersection are exact rhombi, so the overlap is a third polygon with closed
 * form geometry rather than a blend mode: the SVG stays four flat shapes and
 * the rasteriser below stays a point-in-polygon test.
 *
 * Everything is emitted from these constants, so the SVG and the PNGs can never
 * drift apart, and re-running the script is a no-op in git.
 *
 *   npm run build:icons
 *
 * There is no image library in the dependency tree and there should not be one
 * for four icons, so the PNG encoder is here: a truecolour, no-alpha, single
 * IDAT file with every scanline unfiltered. node:zlib does the only hard part.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = '#14161C';
const HOPE = '#FFD98E';
const FEAR = '#A97BF2';

/** screen(HOPE, FEAR): 255 - (255-a)(255-b)/255, per channel. */
const OVERLAP = '#FFEBF9';

// The design grid. A 512 box, both diamonds on the horizontal midline, pushed
// apart by OFFSET so the intersection is half as wide as one diamond.
const GRID = 512;
const CENTRE = GRID / 2;
const HALF_W = 136;
const HALF_H = 190;
const OFFSET = 68;

/**
 * Maskable icons are cropped to a circle of 80% of the box, so the mark is sized
 * to sit inside it exactly: the widest points land 204px from the centre and the
 * top and bottom vertices land 201.8px away, both inside the 204.8px radius.
 * The plain icons get the same mark 10% larger, which is the padding an icon
 * that is *not* about to be cropped wants.
 */
const MASKABLE_SCALE = 1;
const PLAIN_SCALE = 1.1;

interface Rhombus {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
}

function mark(scale: number): Rhombus[] {
  const rx = HALF_W * scale;
  const ry = HALF_H * scale;
  const off = OFFSET * scale;
  return [
    { cx: CENTRE - off, cy: CENTRE, rx, ry, fill: HOPE },
    { cx: CENTRE + off, cy: CENTRE, rx, ry, fill: FEAR },
    // Intersection of two rhombi offset along x by 2*off.
    { cx: CENTRE, cy: CENTRE, rx: rx - off, ry: ry * (1 - off / rx), fill: OVERLAP },
  ];
}

const round = (n: number): string => String(Math.round(n * 100) / 100);

function svg(scale: number): string {
  const paths = mark(scale)
    .map(
      (d) =>
        `  <path fill="${d.fill}" d="M${round(d.cx - d.rx)} ${round(d.cy)}` +
        `L${round(d.cx)} ${round(d.cy - d.ry)}` +
        `L${round(d.cx + d.rx)} ${round(d.cy)}` +
        `L${round(d.cx)} ${round(d.cy + d.ry)}Z"/>`,
    )
    .join('\n');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" ` +
    `width="${GRID}" height="${GRID}" role="img" aria-label="Duality Companion">\n` +
    `  <rect width="${GRID}" height="${GRID}" fill="${BG}"/>\n${paths}\n</svg>\n`
  );
}

// ---------------------------------------------------------------------------
// Rasteriser

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

const inside = (d: Rhombus, x: number, y: number): boolean =>
  Math.abs(x - d.cx) / d.rx + Math.abs(y - d.cy) / d.ry <= 1;

/** 4x4 supersampling. The edges are all diagonal, so this is where the mark
 *  stops looking hand-cut at 192px. */
const SUB = 4;

function raster(size: number, scale: number): Buffer {
  const [hope, fear, overlap] = mark(scale) as [Rhombus, Rhombus, Rhombus];
  const bg = rgb(BG);
  const fills: Rgb[] = [rgb(hope.fill), rgb(fear.fill), rgb(overlap.fill)];
  const unit = GRID / size;
  const rows = Buffer.alloc(size * (1 + size * 3));

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    rows[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SUB; sy++) {
        const py = (y + (sy + 0.5) / SUB) * unit;
        for (let sx = 0; sx < SUB; sx++) {
          const px = (x + (sx + 0.5) / SUB) * unit;
          const inHope = inside(hope, px, py);
          const inFear = inside(fear, px, py);
          const c = inHope && inFear ? fills[2]! : inHope ? fills[0]! : inFear ? fills[1]! : bg;
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SUB * SUB;
      const at = row + 1 + x * 3;
      rows[at] = Math.round(r / n);
      rows[at + 1] = Math.round(g / n);
      rows[at + 2] = Math.round(b / n);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// PNG container

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size: number, scale: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour, no alpha - the ground is opaque
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raster(size, scale), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------

const files: [string, Buffer | string][] = [
  ['icon.svg', svg(PLAIN_SCALE)],
  ['icon-192.png', png(192, PLAIN_SCALE)],
  ['icon-512.png', png(512, PLAIN_SCALE)],
  ['icon-maskable-512.png', png(512, MASKABLE_SCALE)],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, body] of files) {
  const path = join(OUT_DIR, name);
  writeFileSync(path, body);
  console.log(`${path}  ${typeof body === 'string' ? Buffer.byteLength(body) : body.length} bytes`);
}
