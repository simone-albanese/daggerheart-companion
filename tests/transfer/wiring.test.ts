/**
 * The option a receive surface can forget.
 *
 * `createAccumulator`'s `verify` is optional, and `qr.ts` reads
 * `if (options.verify !== undefined && options.verify(payload) !== frame.crc32)`.
 * Leave it out and a set of frames whose chunk was misread completes anyway,
 * silently, and hands the payload on as a character. Both surfaces this app
 * ships pass it — the sweep in `adversarial.test.ts` measures that this caught
 * every single-bit corruption — so the defect here is not in what the code
 * does. It is in what a third surface would inherit by writing one line fewer
 * than the other two, with nothing anywhere to tell anyone.
 *
 * The codec carries its own checksum now, so a forgotten `verify` is no longer
 * the difference between a wrong character and a refusal. It is still the
 * difference between "that code was misread, hold the camera on it again" —
 * which is what a person at a table can act on — and a failure surfacing from
 * one layer further down, so it stays required.
 *
 * Source text rather than behaviour, for the reason `tests/pwa/wiring.test.ts`
 * gives: the defect is not in what a function does, it is in whether the app
 * hands it what it needs.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

interface Opener {
  file: string;
  source: string;
}

/**
 * Whole files rather than argument lists. Both call sites hand the scanner a
 * multi-line object literal full of arrow functions, so anything that tries to
 * read "the arguments" out of the source is a brace matcher waiting to be
 * wrong. A file that opens a camera and never names `verify` is the thing worth
 * failing on, and finding that needs no parsing.
 */
function filesThatOpenATransfer(): Opener[] {
  const out: Opener[] = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join('/');
    if (file === 'transfer/qr.ts') continue; // where both are defined
    const source = stripComments(readFileSync(path, 'utf8'));
    if (/\bcreateQrScanner\s*\(|\bcreateAccumulator\s*\(/.test(source)) {
      out.push({ file, source });
    }
  }
  return out;
}

describe('every camera that receives a transfer checks what it reassembled', () => {
  it('names a checksum wherever it opens one', () => {
    const openers = filesThatOpenATransfer();
    expect(
      openers.length,
      'nothing in src opens a transfer, so this guard is guarding nothing',
    ).toBeGreaterThan(0);
    for (const opener of openers) {
      expect(
        opener.source,
        `${opener.file} opens a QR transfer without passing \`verify\`, so a misread chunk completes it silently and is handed on as a character`,
      ).toMatch(/verify:\s*crc32/);
    }
  });
});
