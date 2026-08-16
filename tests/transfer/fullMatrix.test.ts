/**
 * The transfer layer over every character the game can make.
 *
 * `matrix.test.ts` proves the codec, the file and the frames on a ninety-three
 * row cross-section - every class at every level, plus three sheets no class
 * produces on its own. This file proves the same things on 3240: all eighteen
 * subclasses crossed with all eighteen ancestries at all ten levels, every one
 * of them started blank at level 1 and walked up through `validatePlan` and
 * `applyLevelUp` one level at a time, the way somebody actually plays.
 *
 * Why the whole space and not a cross-section. A transfer is the one moment a
 * character sheet exists in exactly one place and is about to exist in another,
 * and when a field does not survive the trip there is no copy left to notice it
 * went. A codec branch that drops the companion's range, or the second ancestry
 * of a mixed sheet, or the note somebody wrote about the ring their mother left
 * them, does not show up in an aggregate: it is one Beastbound Ranger, one
 * player, one evening, and silence. Ninety-three sheets reach nine classes.
 * These 3240 reach every subclass, every ancestry, every weapon, every armor
 * and every domain card the SRD holds - the only population over which "nothing
 * is lost" means what it sounds like it means.
 *
 * When something does not survive, the failure says which field. "Not equal"
 * over a whole character is not a bug report: `notes` going missing and
 * `companion.experiences[0].bonus` going missing are different losses with
 * different causes and different fixes. So every comparison here is a
 * path-by-path diff and every failure message names the paths.
 *
 * The sizes and the frame counts are printed, not only bounded. Architecture
 * 5.3 says a transfer past about fifteen QR frames should be offered as a file
 * instead, and the question that line was drawn against - does a real character
 * ever get there? - is answered below in numbers, over the whole population
 * rather than over a guess.
 *
 * Nothing is sampled and nothing is capped. Every one of the 3240 is encoded,
 * decoded, re-encoded, written to a `.dhchar`, included in one `.dhbackup`,
 * chunked into frames, shuffled with duplicates and reassembled. The measured
 * cost of that is printed with the results.
 *
 * What this file deliberately does NOT cover, because the full matrix cannot
 * reach it: degraded import. Every row here is a sheet somebody played into
 * existence out of this build's own dataset, so none of them arrives carrying a
 * reference this build cannot name, and the `?id` parking path is proved in
 * `matrix.test.ts` on the two rows built to need it. That is a gap in this
 * file, not a gap in the suite, and it is written down rather than rounded up.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Character } from '../../shared/types.ts';
import {
  characterRefs,
  decodeCharacter,
  encodeCharacter,
  isDeflated,
  missingSlugs,
} from '../../src/transfer/codec.ts';
import {
  FrameCollector,
  MAX_CHUNK_BYTES,
  framesNeeded,
  toFrameBytes,
} from '../../src/transfer/frames.ts';
import {
  parseBackupFile,
  parseCharacterFile,
  serializeBackup,
  serializeCharacter,
} from '../../src/transfer/fileIo.ts';
import {
  FULL_MATRIX_SIZE,
  fullMatrix,
  hasDataset,
  loadDataset,
} from '../../tools/sampleCharacters.ts';
import {
  bytesOf,
  freeTextBytes,
  normalizeHandles,
  percentile,
  shuffled,
  testRegistry,
} from './fixtures.ts';

/** The date every file in this run is stamped with, so sizes are comparable. */
const AT = new Date('2026-08-15T21:30:00.000Z');

/**
 * How many encodes are in flight at once. `encodeCharacter` builds a
 * `CompressionStream` per call, and firing all 3240 at once costs the better
 * part of a gigabyte of resident memory to finish no sooner. Every row is still
 * encoded - they simply do not all start in the same tick.
 */
const BATCH = 200;

/** The architecture's "offer the file instead" line, in frames and in bytes. */
const FILE_INSTEAD_ABOVE = 15;

interface Row {
  label: string;
  original: Character;
  payload: Uint8Array;
  /** What came back out of the payload. Decoded once, read by many tests. */
  decoded: Character;
  warnings: string[];
  unresolved: number[];
  frames: number;
}

let rows: Row[] = [];
let buildMs = 0;
let encodeMs = 0;
let decodeMs = 0;

// ---------------------------------------------------------------------------
// Saying what went wrong
// ---------------------------------------------------------------------------

const show = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  const text = JSON.stringify(value) ?? String(value);
  // Truncation is announced with the real length, so a long value can never be
  // mistaken for a short one that happens to end in an ellipsis.
  return text.length > 80 ? `${text.slice(0, 80)}... (${text.length} chars in all)` : text;
};

/**
 * Every path at which two sheets disagree, with both values.
 *
 * This is the difference between a test that says a transfer is broken and a
 * test that says what it broke. A player whose companion came back without its
 * range needs `companion.range: sent "Close", got back ""`, not `toStrictEqual`
 * printing two hundred lines of a character that is mostly identical.
 */
function differences(was: unknown, now: unknown, at = ''): string[] {
  const here = at === '' ? '(the whole sheet)' : at;
  const structured = (v: unknown): boolean => typeof v === 'object' && v !== null;

  if (!structured(was) || !structured(now)) {
    return Object.is(was, now) ? [] : [`${here}: sent ${show(was)}, got back ${show(now)}`];
  }
  if (Array.isArray(was) !== Array.isArray(now)) {
    return [`${here}: sent ${show(was)}, got back ${show(now)}`];
  }

  const out: string[] = [];
  if (Array.isArray(was) && Array.isArray(now)) {
    if (was.length !== now.length) {
      out.push(`${here}: sent ${was.length} entries, got back ${now.length}`);
    }
    for (let i = 0; i < Math.max(was.length, now.length); i += 1) {
      out.push(...differences(was[i], now[i], `${at}[${i}]`));
    }
    return out;
  }

  const before = was as Record<string, unknown>;
  const after = now as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    const path = at === '' ? key : `${at}.${key}`;
    // A key that is absent and a key holding undefined are different states,
    // and the inventory note relies on the difference.
    if (key in before && !(key in after)) {
      out.push(`${path}: the key is gone (it held ${show(before[key])})`);
      continue;
    }
    if (!(key in before) && key in after) {
      out.push(`${path}: a key the sheet never had, holding ${show(after[key])}`);
      continue;
    }
    out.push(...differences(before[key], after[key], path));
  }
  return out;
}

/** One sheet's differences, bounded and said so rather than trailing off. */
function report(label: string, diffs: readonly string[]): string {
  const shown = diffs.slice(0, 8).map((d) => `\n      ${d}`).join('');
  const rest =
    diffs.length > 8 ? `\n      ...and ${diffs.length - 8} more differences on this sheet` : '';
  return `${label}${shown}${rest}`;
}

/**
 * Fail with the first ten offenders in the diff, and say out loud how many
 * there were in total, so a run that loses a field on a thousand sheets can
 * never read as a run that lost it on ten.
 */
function nothingLost(failures: readonly string[]): void {
  if (failures.length > 10) {
    console.log(
      `  ${failures.length} of ${rows.length} characters failed; the diff shows the first 10`,
    );
  }
  expect(failures.slice(0, 10)).toEqual([]);
  expect(failures.length).toBe(0);
}

// ---------------------------------------------------------------------------
// Bytes, frames and arithmetic
// ---------------------------------------------------------------------------

async function inBatches<T, U>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<U>,
): Promise<U[]> {
  const out: U[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map((item) => work(item)))));
  }
  return out;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const firstDifferingByte = (a: Uint8Array, b: Uint8Array): number => {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) if (a[i] !== b[i]) return i;
  return shared;
};

// ---------------------------------------------------------------------------

describe.skipIf(!hasDataset())('the transfer layer over every character the game can make', () => {
  beforeAll(async () => {
    const builtAt = Date.now();
    const matrix = fullMatrix(loadDataset());
    buildMs = Date.now() - builtAt;

    // Encoded and decoded exactly once here and shared by every test below.
    // 3240 climbs plus 3240 round trips is the cost of this file, and paying it
    // per test would be paying it six times over.
    const encodedAt = Date.now();
    const payloads = await inBatches(matrix, BATCH, (row) =>
      encodeCharacter(row.character, testRegistry),
    );
    encodeMs = Date.now() - encodedAt;

    const decodedAt = Date.now();
    const results = await inBatches(payloads, BATCH, (payload) =>
      decodeCharacter(payload, testRegistry),
    );
    decodeMs = Date.now() - decodedAt;

    rows = matrix.map((row, i) => ({
      label: row.label,
      original: row.character,
      payload: payloads[i]!,
      decoded: results[i]!.character,
      warnings: results[i]!.warnings,
      unresolved: results[i]!.unresolved,
      frames: framesNeeded(payloads[i]!.length),
    }));
    // Vitest's default hook timeout is 10 s and the config only raises
    // `testTimeout`, so the hook that carries the whole cost states its own.
  }, 300_000);

  // -------------------------------------------------------------------------

  describe('the matrix itself', () => {
    it('is every sheet the game can make, and this build can name all of them', () => {
      expect(rows.length).toBe(FULL_MATRIX_SIZE);

      const unsendable: string[] = [];
      let references = 0;
      for (const row of rows) {
        references += characterRefs(row.original).length;
        const missing = missingSlugs(row.original, testRegistry);
        if (missing.length > 0) {
          unsendable.push(`${row.label}: data/registry.json has no id for ${missing.join(', ')}`);
        }
        // Every row is a sheet somebody played into existence out of this
        // build's own dataset, so a decode that warns about anything, or parks
        // anything, is a decode that lost something.
        if (row.warnings.length > 0) {
          unsendable.push(`${row.label}: decoded with warnings ${row.warnings.join(' | ')}`);
        }
        if (row.unresolved.length > 0) {
          unsendable.push(`${row.label}: decoded with parked ids ${row.unresolved.join(', ')}`);
        }
      }
      nothingLost(unsendable);
      expect(references).toBeGreaterThan(FULL_MATRIX_SIZE * 5);

      console.log(
        [
          '',
          `  ${rows.length} characters, ${references} references between them`,
          `    built in ${buildMs} ms, encoded in ${encodeMs} ms, decoded in ${decodeMs} ms` +
            ` (${BATCH} at a time)`,
        ].join('\n'),
      );
    });

    /**
     * Every claim in this file rests on `differences` finding what went
     * missing. A diff that quietly returned nothing would turn all six of the
     * comparisons below into tests that pass because they assert nothing, and
     * they would go on passing while the codec dropped the companion. So it is
     * pointed at a real sheet from the matrix with four known injuries - a
     * rewritten field, a shortened list, a changed value nested two deep, and
     * an inventory note whose key was removed rather than emptied - and it has
     * to name those four and invent no others.
     */
    it('would name the field, if a field ever did go missing', () => {
      const hurt = rows.find(
        (r) =>
          r.original.companion !== null &&
          r.original.scars.length > 0 &&
          r.original.inventory.some((e) => e.note !== undefined),
      );
      expect(hurt, 'no sheet in the matrix has a companion, a scar and an annotated item').toBeDefined();

      const was = hurt!.original;
      const companion = was.companion!;
      const noteAt = was.inventory.findIndex((e) => e.note !== undefined);
      const lastScar = was.scars.length - 1;
      const otherRange = companion.range === 'Far' ? 'Close' : 'Far';

      const damaged: Character = {
        ...was,
        notes: `${was.notes} and one word more`,
        scars: was.scars.slice(0, lastScar),
        companion: { ...companion, range: otherRange },
        // Not `note: ''` - an emptied note and a removed one are two different
        // states on the wire, and the diff has to tell them apart.
        inventory: was.inventory.map((e, i) =>
          i === noteAt ? { ref: e.ref, name: e.name, quantity: e.quantity } : e,
        ),
      };

      const found = differences(was, damaged);
      const pathOf = (d: string): string => d.slice(0, d.indexOf(':'));
      expect(found.map(pathOf).sort()).toEqual(
        ['companion.range', `inventory[${noteAt}].note`, 'notes', 'scars', `scars[${lastScar}]`].sort(),
      );

      // ...and each one reads as a sentence somebody can act on.
      expect(found).toContain(
        `companion.range: sent "${companion.range}", got back "${otherRange}"`,
      );
      expect(found).toContain(
        `inventory[${noteAt}].note: the key is gone ` +
          `(it held ${JSON.stringify(was.inventory[noteAt]!.note)})`,
      );
      expect(found).toContain(`scars: sent ${was.scars.length} entries, got back ${lastScar}`);
      expect(found).toContain(
        `scars[${lastScar}]: sent ${JSON.stringify(was.scars[lastScar])}, got back undefined`,
      );

      // And it says nothing whatever about a sheet that arrived intact.
      expect(differences(was, { ...was, inventory: [...was.inventory] })).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------

  describe('the binary codec', () => {
    /**
     * The whole object graph, not a list of fields somebody remembered to
     * check. Two documented losses are normalised out on both sides first, and
     * nothing else may go missing: Experience ids, which are local handles the
     * wire deliberately does not carry - normalising them to positions is also
     * the check that the level-up records still point at the right Experience -
     * and `consecutiveShortRests`, which stays off the wire because carrying it
     * would cost a new format number (see the header of `src/transfer/codec.ts`)
     * and is zeroed on both sides rather than compared.
     */
    it('returns every one of the 3240 characters unchanged, and names the field if not', () => {
      const lost: string[] = [];
      for (const row of rows) {
        const diffs = differences(normalizeHandles(row.original), normalizeHandles(row.decoded));
        if (diffs.length > 0) lost.push(report(row.label, diffs));
      }
      nothingLost(lost);
    });

    /**
     * Stronger than a deep-equal, and the property that matters for a sheet
     * that hops from an old phone to a new one to a friend's tablet: what came
     * back re-encodes to the very bytes that were sent, so nothing erodes by a
     * byte per hop. A sheet that decodes correctly but re-encodes differently
     * is a sheet that survives one transfer and not two.
     */
    it('re-encodes to the same bytes, so a sheet can hop devices forever', async () => {
      const again = await inBatches(rows, BATCH, (row) =>
        encodeCharacter(row.decoded, testRegistry),
      );

      const drifted: string[] = [];
      for (const [i, row] of rows.entries()) {
        const bytes = again[i]!;
        if (sameBytes(bytes, row.payload)) continue;
        const diffs = differences(normalizeHandles(row.original), normalizeHandles(row.decoded));
        drifted.push(
          report(
            `${row.label}: sent ${row.payload.length} bytes, re-encoded to ${bytes.length}` +
              `, first difference at byte ${firstDifferingByte(row.payload, bytes)}`,
            diffs.length > 0
              ? diffs
              : ['every field came back intact, so the drift is in the encoding, not the sheet'],
          ),
        );
      }
      nothingLost(drifted);
    });
  });

  // -------------------------------------------------------------------------

  describe('the .dhchar and .dhbackup files', () => {
    /**
     * The file carries slugs rather than registry ids, so unlike the QR it
     * needs no registry at all and cannot be defeated by a device holding older
     * content. It is also the only vector that keeps the Experience ids, which
     * is why this comparison is made against the sheet itself with nothing
     * normalised away.
     */
    it('round-trips every one of the 3240 characters, ids and all', () => {
      const lost: string[] = [];
      for (const row of rows) {
        const back = parseCharacterFile(serializeCharacter(row.original, AT));
        const diffs = differences(row.original, back);
        if (diffs.length > 0) lost.push(report(row.label, diffs));
      }
      nothingLost(lost);
    });

    it('round-trips a whole library of 3240 characters in one backup', () => {
      const characters = rows.map((r) => r.original);
      const text = serializeBackup(characters, AT);
      const back = parseBackupFile(text);

      expect(back.length).toBe(characters.length);
      // Compared row by row rather than as one array: a `toStrictEqual` over
      // 3240 characters produces a diff nobody can read, and "which sheet" is
      // the first thing anybody fixing this would need to know.
      const lost: string[] = [];
      for (const [i, character] of characters.entries()) {
        const diffs = differences(character, back[i]!);
        if (diffs.length > 0) lost.push(report(rows[i]!.label, diffs));
      }
      nothingLost(lost);

      console.log(
        `  .dhbackup of ${characters.length} characters: ` +
          `${(bytesOf(text) / 1048576).toFixed(1)} MiB, ` +
          `${Math.round(bytesOf(text) / characters.length)} bytes a sheet`,
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('the QR frames', () => {
    it('reassembles every character from frames delivered shuffled, with duplicates', async () => {
      const broken: string[] = [];
      const reassembled: Array<{ row: Row; payload: Uint8Array }> = [];

      for (const row of rows) {
        const frames = toFrameBytes(row.payload, 0x4242);
        // What a camera at five frames a second actually hands the collector:
        // the same codes over and over, in whatever order the sender's loop
        // happened to be in when the phone was pointed at it.
        const seen = shuffled(
          [...frames, ...frames, frames[0]!, frames.at(-1)!],
          row.frames * 7 + 3,
        );

        const collector = new FrameCollector();
        const completed: Uint8Array[] = [];
        for (const frame of seen) {
          const result = collector.accept(frame);
          if (result.status === 'complete') completed.push(result.payload);
        }

        if (completed.length !== 1) {
          broken.push(
            `${row.label}: ${completed.length} completions from ${seen.length} frames delivered` +
              ` (${frames.length} distinct)`,
          );
          continue;
        }
        if (!sameBytes(completed[0]!, row.payload)) {
          broken.push(
            `${row.label}: reassembled ${completed[0]!.length} bytes, sent ${row.payload.length}` +
              `, first difference at byte ${firstDifferingByte(row.payload, completed[0]!)}`,
          );
          continue;
        }
        reassembled.push({ row, payload: completed[0]! });
      }
      nothingLost(broken);
      expect(reassembled.length).toBe(rows.length);

      // Byte-equal is not the promise a player cares about. Decode what came
      // off the camera and check it is their character.
      const rebuilt = await inBatches(reassembled, BATCH, (entry) =>
        decodeCharacter(entry.payload, testRegistry),
      );
      const lost: string[] = [];
      for (const [i, result] of rebuilt.entries()) {
        const row = reassembled[i]!.row;
        const diffs = differences(normalizeHandles(row.original), normalizeHandles(result.character));
        if (diffs.length > 0) lost.push(report(row.label, diffs));
      }
      nothingLost(lost);
    });

    /**
     * Two sheets sent across one table, both drawing the same transfer id. The
     * id alone cannot separate them; the crc32 of the whole payload, which
     * every frame carries, is what keys them into two sets. The sibling file
     * proves this on one pair. Here every real payload in the game takes a turn
     * as the intruder, because the failure it guards against is not a transfer
     * that breaks - it is a transfer that quietly completes as the wrong person.
     */
    it('never lets a frame from another character complete the wrong one', () => {
      const wrong: string[] = [];
      let identicalPayloads = 0;
      let pairsTried = 0;

      for (const [i, mineRow] of rows.entries()) {
        const theirsRow = rows[(i + 1) % rows.length]!;
        if (sameBytes(mineRow.payload, theirsRow.payload)) {
          identicalPayloads += 1;
          continue;
        }
        pairsTried += 1;

        const collector = new FrameCollector();
        const mine = toFrameBytes(mineRow.payload, 0x0888);
        const theirs = toFrameBytes(theirsRow.payload, 0x0888);
        const results = [...mine.slice(0, -1), theirs[0]!].map((f) => collector.accept(f));

        if (results.some((r) => r.status === 'complete')) {
          wrong.push(`${mineRow.label} was completed by a frame from ${theirsRow.label}`);
        } else if (collector.progress().length !== 2) {
          wrong.push(
            `${mineRow.label} + ${theirsRow.label}: the collector holds ` +
              `${collector.progress().length} sets, expected 2`,
          );
        }
      }
      nothingLost(wrong);

      if (identicalPayloads > 0) {
        console.log(
          `  ${identicalPayloads} pairs skipped: two sheets that encode to the same bytes are` +
            ` one sheet, and there is no wrong character to complete`,
        );
      }
      expect(pairsTried + identicalPayloads).toBe(rows.length);
      expect(pairsTried).toBeGreaterThan(rows.length - 10);
    });
  });

  // -------------------------------------------------------------------------

  describe('the distribution, printed rather than only bounded', () => {
    it('reports what a real sheet costs on the wire, and what the largest spent it on', async () => {
      const sizes = rows.map((r) => r.payload.length).sort((a, b) => a - b);
      const largest = rows.reduce((a, b) => (b.payload.length > a.payload.length ? b : a));
      const smallest = rows.reduce((a, b) => (b.payload.length < a.payload.length ? b : a));
      const deflated = rows.filter((r) => isDeflated(r.payload)).length;

      const raw = await encodeCharacter(largest.original, testRegistry, { compress: false });
      const anonymous = await encodeCharacter(largest.original, testRegistry, { identity: false });
      const refs = characterRefs(largest.original).length;
      const text = freeTextBytes(largest.original);
      const asJson = bytesOf(JSON.stringify(largest.original));

      console.log(
        [
          '',
          `  encoded size over ${rows.length} characters`,
          `    min    ${percentile(sizes, 0)} bytes  (${smallest.label})`,
          `    median ${percentile(sizes, 0.5)} bytes`,
          `    p95    ${percentile(sizes, 0.95)} bytes`,
          `    max    ${percentile(sizes, 1)} bytes  (${largest.label})`,
          `    deflated: ${deflated} of ${rows.length}`,
          '',
          '  why that one is the largest sheet in the game',
          `    ${largest.payload.length} bytes on the wire, ${raw.length} before deflate`,
          `    ${text} of those bytes are text its player typed`,
          `    ${refs} references at 2 bytes each, ` +
            `${largest.original.levelUpHistory.length} level-up records`,
          `    ${largest.payload.length - anonymous.length} bytes are the id and the timestamps`,
          `    the same sheet as JSON with slugs: ${asJson} bytes`,
        ].join('\n'),
      );

      // Free text is the only part of a sheet that can grow without bound, and
      // on the biggest character in the game it is already most of the payload.
      // That is the number to watch: references and history are bounded by the
      // rules, and a level 10 sheet cannot acquire an eleventh level of them.
      expect(text).toBeGreaterThan(largest.payload.length / 3);
      expect(largest.payload.length).toBeLessThan(FILE_INSTEAD_ABOVE * MAX_CHUNK_BYTES);
    });

    /**
     * The question this file exists to answer.
     *
     * Architecture 5.3 draws the line at about fifteen frames: past that, a
     * transfer should be offered as a file rather than as a camera pointed at a
     * screen for half a minute. Whether any character actually reaches that
     * line is not something to reason about - it is something to measure over
     * every character the game can make.
     */
    it('answers whether a real character ever needs more than fifteen frames', () => {
      const counts = rows.map((r) => r.frames).sort((x, y) => x - y);
      const histogram = new Map<number, number>();
      for (const n of counts) histogram.set(n, (histogram.get(n) ?? 0) + 1);
      // Ties on the frame count are broken by the byte count, so "the worst
      // case" names the sheet that is actually closest to needing another
      // frame rather than whichever one the reduce happened to reach first.
      const worst = rows.reduce((a, b) =>
        b.frames > a.frames || (b.frames === a.frames && b.payload.length > a.payload.length)
          ? b
          : a,
      );
      const overTheLine = rows.filter((r) => r.frames > FILE_INSTEAD_ABOVE);

      // A bucket holding 1500 sheets would print a 1500-character bar, so the
      // bar is scaled and the scale is stated next to it.
      const biggestBucket = Math.max(...histogram.values());
      const perBlock = Math.max(1, Math.ceil(biggestBucket / 40));
      const lineFor = ([n, many]: [number, number]): string =>
        `    ${String(n).padStart(2)} frame${n === 1 ? ' ' : 's'}  ` +
        `${'█'.repeat(Math.max(1, Math.round(many / perBlock)))} ${many}`;

      console.log(
        [
          '',
          `  frames per character, over ${rows.length} characters ` +
            `(${MAX_CHUNK_BYTES} bytes a frame, one █ is about ${perBlock})`,
          ...[...histogram.entries()].sort((x, y) => x[0] - y[0]).map(lineFor),
          `    median ${percentile(counts, 0.5)} · p95 ${percentile(counts, 0.95)} · ` +
            `worst ${worst.frames}`,
          `    worst case: ${worst.label} (${worst.payload.length} bytes)`,
          '',
          `  does a real character ever need more than ${FILE_INSTEAD_ABOVE} frames?`,
          `    NO - ${overTheLine.length} of ${rows.length} characters are over the line.`,
          `    The wordiest sheet the game can make needs ${worst.frames} frames of the ` +
            `${FILE_INSTEAD_ABOVE} available, at ${worst.payload.length} bytes;`,
          `    it would have to carry ` +
            `${(((FILE_INSTEAD_ABOVE * MAX_CHUNK_BYTES) / worst.payload.length) * 100 - 100).toFixed(0)}%` +
            ` more than it does to reach the file-instead line.`,
          `    So the QR stays the everyday vector and the file stays the fallback,`,
          `    and the fallback is proved anyway, on these same ${rows.length} sheets, above.`,
        ].join('\n'),
      );

      expect(overTheLine.map((r) => r.label)).toEqual([]);
      expect(worst.frames).toBeLessThanOrEqual(FILE_INSTEAD_ABOVE);
    });

    it('is under half the same sheet as JSON, which is what the registry buys', () => {
      const fat: string[] = [];
      let worstRatio = 0;
      let worstLabel = '';
      for (const row of rows) {
        const asJson = bytesOf(JSON.stringify(row.original));
        const ratio = row.payload.length / asJson;
        if (ratio > worstRatio) {
          worstRatio = ratio;
          worstLabel = row.label;
        }
        if (ratio >= 0.5) {
          fat.push(`${row.label}: ${row.payload.length} bytes against ${asJson} of JSON`);
        }
      }
      nothingLost(fat);
      console.log(
        `  the least compressible sheet is ${(worstRatio * 100).toFixed(0)}% of its own JSON` +
          ` (${worstLabel})`,
      );
    });
  });
});
