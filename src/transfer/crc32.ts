/**
 * CRC-32, on its own, because two layers need the same polynomial.
 *
 * It lived in `frames.ts` while the frame header was the only thing that
 * carried a checksum. The codec carries one now too, and `frames.ts` imports
 * `codec.ts`, so leaving it there would have made the reverse import a cycle.
 * One implementation, in the module that has no opinions about either format.
 *
 * CRC-32 rather than a hash: it is the right tool for accidental corruption,
 * which is all either layer claims to catch. It detects every single-bit error
 * — `x^k` is never divisible by the generator polynomial — every burst up to 32
 * bits, and any odd number of flipped bits. It is not a signature and neither
 * layer says it is: anyone who can rewrite the bytes can rewrite the checksum
 * with them.
 */

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
