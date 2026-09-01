/**
 * The header got wider, and this is the file that proves the three promises it
 * made while doing so.
 *
 *   1. A build that shipped BEFORE format 9 refuses these payloads by name and
 *      imports nothing. Proved by running the shipped 8-era gate - written out
 *      here, byte for byte, not imported - over bytes this build writes.
 *   2. Formats 1, 2, 4 and 8 stay readable, because the hand-off this vector
 *      exists for has the OLD phone as the sender. Proved on committed bytes
 *      the previous build wrote, not on bytes re-encoded here.
 *   3. One version, one header width: neither gate accepts the other's numbers,
 *      and every single-bit flip of the twelve-bit version field is refused.
 *
 * `src/transfer/codec.ts` argues all of this above `CODEC_VERSION`; this is
 * where the argument is made to go red.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CODEC_VERSION,
  CodecError,
  NARROW_CODEC_VERSIONS,
  WIDE_CODEC_VERSIONS,
  decodeCharacter,
  encodeCharacter,
} from '../src/transfer/codec.ts';
import { normalizeHandles, testRegistry, wizard } from './transfer/fixtures.ts';

const committed = (name: string): Uint8Array =>
  Uint8Array.from(
    Buffer.from(
      readFileSync(fileURLToPath(new URL(`./fixtures/codec/${name}`, import.meta.url)), 'utf8').trim(),
      'base64',
    ),
  );

// ---------------------------------------------------------------------------
// The build that shipped before this one
// ---------------------------------------------------------------------------

/**
 * `decodeCharacter`'s version gate exactly as it shipped at format 8.
 *
 * Copied rather than imported, and that is the whole method: importing the
 * current gate would prove that the current gate refuses format 9, which is not
 * the question. The question is what a phone in somebody's pocket does, and the
 * only honest way to ask it is to write down what that phone runs. Three lines,
 * from the commit before this one:
 *
 *   - the version is `payload[0] & 0x0f`, a nibble, with no notion of an escape;
 *   - readable is the literal `[1, 2, 4, 8]`;
 *   - the check is a THROW, and it happens before the checksum and before a
 *     single field of the body is read.
 *
 * It returns the sentence rather than throwing so the test can look at it.
 */
const EIGHT_ERA_READS = [1, 2, 4, 8];
function eightEraGate(payload: Uint8Array): { threw: true; message: string } | { threw: false } {
  if (payload.length < 2) return { threw: true, message: 'That is not a character transfer: it is empty.' };
  const version = payload[0]! & 0x0f;
  if (!EIGHT_ERA_READS.includes(version)) {
    return {
      threw: true,
      message:
        `This transfer says it is format ${version}, and this app reads ${EIGHT_ERA_READS.join(' and ')}. ` +
        'Either it came from a different version of the app, or it is damaged. Nothing has been imported.',
    };
  }
  return { threw: false };
}

describe('a build that shipped before the header got wider', () => {
  it('refuses what this build writes, by name, before it reads a field', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);

    const verdict = eightEraGate(payload);
    expect(verdict.threw, 'the 8-era gate let a format-9 payload through').toBe(true);
    if (!verdict.threw) return;

    // By NAME, and the name it gives is 15 - the escape nibble, not the
    // version. That is the one thing the widening cost, and it is written down
    // rather than discovered: 15 is what that build read, so the sentence is
    // true, and the half that matters is the refusal.
    expect(verdict.message).toMatch(/says it is format 15, and this app reads 1 and 2 and 4 and 8/);
    expect(verdict.message).toMatch(/Nothing has been imported/);
    expect(verdict.message).toMatch(/Either it came from a different version of the app, or it is damaged/);

    // And the refusal is total rather than partial. The gate runs before the
    // checksum and before `readBody`, so there is no half-imported sheet - the
    // exact failure the Dread-domain defect is on record for.
    expect(verdict.message).not.toMatch(/update/i);
  });

  it('is not a gate that refuses everything, which is what makes the refusal mean something', () => {
    // TEETH. The same three lines accept the formats that build could read, so
    // the refusal above is about format 9 and not about the function.
    for (const name of ['wizard.codec2.b64', 'wizard.codec8.b64']) {
      expect(eightEraGate(committed(name)).threw, name).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// The old phone is the sender
// ---------------------------------------------------------------------------

describe('the formats this build still reads', () => {
  /**
   * The bytes the build before this one wrote, committed and never regenerated.
   *
   * `wizard.codec8.b64` was produced by `encodeCharacter(wizard(), testRegistry)`
   * at commit cc88c0d, where `CODEC_VERSION` was 8, and copied out. Re-encoding
   * it here would prove only that this build can read its own output, which is
   * not the question a compatibility claim asks.
   */
  it('decodes a format-8 QR written by the previous build, field for field', async () => {
    const bytes = committed('wizard.codec8.b64');
    expect(bytes[0]! & 0x0f, 'the committed bytes are format 8').toBe(8);
    const { character, warnings } = await decodeCharacter(bytes, testRegistry);
    expect(warnings).toEqual([]);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(wizard()));
  });

  it('decodes the loaded sheet too, which is the one with a companion and a history', async () => {
    const bytes = committed('loadedWizard.codec8.b64');
    expect(bytes[0]! & 0x0f).toBe(8);
    const { character } = await decodeCharacter(bytes, testRegistry);
    expect(character.name).toBe('Kaelith');
    expect(character.levelUpHistory.length).toBeGreaterThan(0);
    expect(character.companion).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// One version, one header width
// ---------------------------------------------------------------------------

describe('the wide header', () => {
  it('writes the escape in the nibble and the version in the byte behind it', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);
    expect(payload[0]! & 0x0f).toBe(0x0f);
    expect(payload[1]).toBe(CODEC_VERSION);
    expect(WIDE_CODEC_VERSIONS as readonly number[]).toContain(CODEC_VERSION);
    // Control: it round-trips, so what follows is about damage and not about
    // a decoder that cannot read the header at all.
    const { character } = await decodeCharacter(payload, testRegistry);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(wizard()));
  });

  it('refuses a nibble that names a wide format, and a wide byte that names a narrow one', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);

    // A NARROW header saying 9. The version number is readable; the width is
    // not the one that number names, and `BODY_AT` maps a version to exactly
    // one layout - so this is a refusal and not a body read one byte early.
    const narrowNine = payload.slice();
    narrowNine[0] = (narrowNine[0]! & 0xf0) | CODEC_VERSION;
    await expect(decodeCharacter(narrowNine, testRegistry)).rejects.toThrow(
      new RegExp(`says it is format ${CODEC_VERSION}, and this app reads`),
    );

    // A WIDE header saying 8. Same rule, mirrored, and this is the one a single
    // flip of the version byte can actually produce: 9 ^ 1 is 8.
    for (const narrow of NARROW_CODEC_VERSIONS) {
      const wideNarrow = payload.slice();
      wideNarrow[1] = narrow;
      await expect(decodeCharacter(wideNarrow, testRegistry), `wide ${narrow}`).rejects.toThrow(
        new RegExp(`says it is format ${narrow}, and this app reads`),
      );
    }
  });

  it('refuses every single-bit flip of the version byte, by name and not as damage', async () => {
    /*
     * The eight bits the nibble-shaped property never covered.
     *
     * Every legal wide version has an even number of set bits, so one flip
     * always makes it odd and always leaves the set. The distinction the
     * assertion makes is between the VERSION gate and the checksum: both would
     * refuse these bytes, and only one of them tells the reader which format it
     * thought it was holding. Reading the checksum first would report every
     * unknown format as corruption, which is the thing this gate's order exists
     * to prevent.
     */
    const payload = await encodeCharacter(wizard(), testRegistry);
    for (let bit = 0; bit < 8; bit += 1) {
      const bad = payload.slice();
      bad[1] = bad[1]! ^ (1 << bit);
      expect(bad[1], `bit ${bit} must actually differ`).not.toBe(payload[1]);
      await expect(decodeCharacter(bad, testRegistry), `version bit ${bit}`).rejects.toThrow(
        /says it is format \d+, and this app reads/,
      );
      await expect(decodeCharacter(bad, testRegistry), `version bit ${bit}`).rejects.toBeInstanceOf(
        CodecError,
      );
    }
    // Control: the byte put back decodes into the same sheet, so what was
    // refused is the corruption and not the format.
    const { character } = await decodeCharacter(payload.slice(), testRegistry);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(wizard()));
  });

  it('refuses a wide header with nothing behind it', async () => {
    // The escape says "read byte 1", and a two-byte payload has one. The
    // emptiness check is what makes `payload[1]` safe to reach for; this is
    // what says the next read is guarded too.
    await expect(decodeCharacter(new Uint8Array([0x0f, CODEC_VERSION]), testRegistry)).rejects.toThrow(
      /ended early/,
    );
    await expect(decodeCharacter(new Uint8Array([0x0f]), testRegistry)).rejects.toThrow(/empty/);
  });
});
