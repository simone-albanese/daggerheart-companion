/**
 * The transfer layer over the whole game, not over one wizard.
 *
 * `codec.test.ts` proves the format on the sheet the architecture measured.
 * This file proves it on ninety-three: every class at every level, walked up
 * through the real level-up path by `tools/sampleCharacters.ts`, wearing the
 * fields a fixture forgets - a companion, a Beastform, scars, trait marks,
 * inventory notes, connections, parked references, and free text in scripts
 * that are not ASCII.
 *
 * The stakes are why the whole matrix is worth the seconds it costs: this is
 * the code that carries somebody's months of play from their old phone to
 * their new one, and a field that survives a wizard but not a Beastbound
 * Ranger is a field that will be lost by exactly one person, silently, with no
 * copy left anywhere.
 *
 * The size and frame-count numbers are printed rather than only bounded. The
 * architecture says a transfer past about fifteen frames should be offered as
 * a file instead, and the only way to know whether a real character gets near
 * that line is to measure every real character.
 *
 * `fullMatrix.test.ts` runs the same sweep over all 3240 - every subclass at
 * every ancestry at every level - and is where the fifteen-frame question is
 * answered over the whole population. This file keeps the three sheets that
 * matrix cannot produce, and with them the degraded-import and reserved-id
 * paths: a blank sheet, a sheet somebody writes a journal on, and a sheet that
 * arrived from a device holding content this build has never heard of.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, Ref } from '../../shared/types.ts';
import {
  characterRefs,
  decodeCharacter,
  encodeCharacter,
  isDeflated,
  missingSlugs,
  resolvePlaceholders,
} from '../../src/transfer/codec.ts';
import {
  FrameCollector,
  MAX_CHUNK_BYTES,
  chunkPayload,
  framesNeeded,
  packFrame,
  toFrameBytes,
} from '../../src/transfer/frames.ts';
import {
  parseBackupFile,
  parseCharacterFile,
  serializeBackup,
  serializeCharacter,
} from '../../src/transfer/fileIo.ts';
import {
  RESERVED_MIN,
  bandFor,
  bandOf,
  isUnresolvedRef,
  unresolvedIdOf,
  unresolvedRef,
  type Band,
} from '../../src/transfer/registry.ts';
import { hasDataset, loadDataset, sampleMatrix, type Sample } from '../../tools/sampleCharacters.ts';
import {
  bytesOf,
  freeTextBytes,
  normalizeHandles,
  percentile,
  registryWithout,
  shuffled,
  testRegistry,
} from './fixtures.ts';

/** The dataset is the SRD build; without it there is no matrix to speak of. */
const MATRIX: Sample[] = hasDataset() ? sampleMatrix(loadDataset()) : [];

interface Row {
  label: string;
  original: Character;
  payload: Uint8Array;
  /** What came back out of the payload. Decoded once, read by many tests. */
  decoded: Character;
  frames: number;
}

let rows: Row[] = [];

const nonAscii = (s: string): boolean => /[^\u0000-\u007f]/.test(s);

/** The ref this row is tested without: one it uses in more than one place. */
function refToHide(c: Character): Ref | null {
  const refs = characterRefs(c).filter((r) => !isUnresolvedRef(r));
  const counts = new Map<Ref, number>();
  for (const ref of refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
  return [...counts].find(([, n]) => n > 1)?.[0] ?? refs[0] ?? null;
}

describe.skipIf(!hasDataset())('the transfer matrix', () => {
  beforeAll(async () => {
    rows = await Promise.all(
      MATRIX.map(async (sample) => {
        const payload = await encodeCharacter(sample.character, testRegistry);
        const { character } = await decodeCharacter(payload, testRegistry);
        return {
          label: sample.label,
          original: sample.character,
          payload,
          decoded: character,
          frames: framesNeeded(payload.length),
        };
      }),
    );
  });

  // -------------------------------------------------------------------------

  describe('the matrix itself', () => {
    it('is a cross-section of the game and not ninety copies of one wizard', () => {
      const chars = MATRIX.map((s) => s.character);
      const classes = new Set(chars.map((c) => c.classRef).filter((r) => r !== ''));
      const levels = new Set(chars.map((c) => c.level));
      const kinds = new Set(chars.flatMap((c) => c.levelUpHistory.map((h) => h.kind)));

      expect(classes.size).toBe(9);
      expect([...levels].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      // Every advancement the rules offer is somewhere in the history, so the
      // level-up records are round-tripped in every shape the codec has a
      // branch for - including the two that cost both picks.
      expect([...kinds].sort()).toEqual([
        'domainCard',
        'evasion',
        'experience',
        'hitPoint',
        'multiclass',
        'proficiency',
        'stress',
        'subclass',
        'trait',
      ]);

      const some = (predicate: (c: Character) => boolean): number => chars.filter(predicate).length;
      expect(some((c) => c.companion !== null)).toBeGreaterThan(3);
      expect(some((c) => c.beastform !== null)).toBeGreaterThan(3);
      expect(some((c) => c.scars.length > 0)).toBeGreaterThan(20);
      expect(some((c) => Object.keys(c.traitMarks).length > 0)).toBeGreaterThan(20);
      expect(some((c) => c.multiclassRef !== null)).toBeGreaterThan(3);
      expect(some((c) => c.connections.length > 0)).toBeGreaterThan(20);
      expect(some((c) => c.evasionOverride !== null)).toBeGreaterThan(3);
      expect(some((c) => c.thresholdOverride !== null)).toBeGreaterThan(3);
      expect(some((c) => (c.unresolvedRefs ?? []).length > 0)).toBeGreaterThan(0);
      // An absent note, an empty note and a written note are three states.
      expect(some((c) => c.inventory.some((e) => e.note === undefined))).toBeGreaterThan(3);
      expect(some((c) => c.inventory.some((e) => e.note === ''))).toBeGreaterThan(3);
      expect(some((c) => c.inventory.some((e) => (e.note ?? '') !== ''))).toBeGreaterThan(3);
      expect(some((c) => nonAscii(c.name))).toBeGreaterThan(3);
      expect(some((c) => nonAscii(c.notes) || c.connections.some(nonAscii))).toBeGreaterThan(3);
    });

    it('is made of characters this build can actually send', () => {
      for (const { label, character } of MATRIX) {
        expect(missingSlugs(character, testRegistry), label).toEqual([]);
      }
    });
  });

  // -------------------------------------------------------------------------

  describe('the binary codec', () => {
    it('returns every character in the matrix unchanged', () => {
      for (const row of rows) {
        expect(normalizeHandles(row.decoded), row.label).toStrictEqual(
          normalizeHandles(row.original),
        );
      }
    });

    /**
     * Stronger than a deep-equal, and the property that matters for a sheet
     * that hops from an old phone to a new one to a friend's tablet: what came
     * back re-encodes to the very bytes that were sent, so nothing erodes by a
     * byte per hop.
     */
    it('re-encodes to the same bytes, so a sheet can hop devices forever', async () => {
      for (const row of rows) {
        const again = await encodeCharacter(row.decoded, testRegistry);
        expect(again, row.label).toEqual(row.payload);
      }
    });

    it('keeps the fields a round trip usually drops, field by field', () => {
      for (const row of rows) {
        const { original: was, decoded: now, label } = row;
        expect(now.levelUpHistory.length, label).toBe(was.levelUpHistory.length);
        for (const [i, choice] of was.levelUpHistory.entries()) {
          const back = now.levelUpHistory[i]!;
          expect({ ...back, detail: null }, `${label} #${i}`).toStrictEqual({
            ...choice,
            detail: null,
          });
          // Experience ids are the one documented loss; every other key of a
          // level-up record, including the ones the compact form has to escape
          // to JSON, comes back exactly.
          const keys = (d: Record<string, unknown>): string[] => Object.keys(d).sort();
          expect(keys(back.detail), `${label} #${i}`).toEqual(keys(choice.detail));
          for (const key of keys(choice.detail)) {
            if (key === 'experiences') continue;
            expect(back.detail[key], `${label} #${i} ${key}`).toStrictEqual(choice.detail[key]);
          }
        }
        expect(now.traitMarks, label).toStrictEqual(was.traitMarks);
        expect(now.scars, label).toStrictEqual(was.scars);
        expect(now.connections, label).toStrictEqual(was.connections);
        expect(now.notes, label).toBe(was.notes);
        expect(now.beastform, label).toStrictEqual(was.beastform);
        expect(now.inventory, label).toStrictEqual(was.inventory);
        expect(now.gold, label).toStrictEqual(was.gold);
        expect(now.unresolvedRefs, label).toStrictEqual(was.unresolvedRefs);
        expect(
          now.companion === null ? null : { ...now.companion, experiences: null },
          label,
        ).toStrictEqual(was.companion === null ? null : { ...was.companion, experiences: null });
        expect(
          now.companion?.experiences.map((e) => [e.name, e.bonus]),
          label,
        ).toStrictEqual(was.companion?.experiences.map((e) => [e.name, e.bonus]));
        expect(
          now.experiences.map((e) => [e.name, e.bonus]),
          label,
        ).toStrictEqual(was.experiences.map((e) => [e.name, e.bonus]));
      }
    });

    it('keeps text that is not ASCII, codepoint for codepoint', () => {
      let checked = 0;
      for (const { original: was, decoded: now, label } of rows) {
        const pairs: Array<[string, string]> = [
          [was.name, now.name],
          [was.pronouns, now.pronouns],
          [was.notes, now.notes],
          ...was.connections.map((s, i): [string, string] => [s, now.connections[i]!]),
          ...was.scars.map((s, i): [string, string] => [s, now.scars[i]!]),
          ...was.inventory.map((e, i): [string, string] => [e.note ?? '', now.inventory[i]!.note ?? '']),
        ];
        for (const [before, after] of pairs) {
          if (!nonAscii(before)) continue;
          checked += 1;
          expect([...after], label).toEqual([...before]);
        }
      }
      expect(checked).toBeGreaterThan(50);
    });

    /**
     * Where the two vectors stop agreeing.
     *
     * Nothing in the matrix reaches either of these - neither is typeable, and
     * the app writes both timestamps itself - but "loses nothing" is a claim
     * that should name its own edges rather than have somebody find them.
     * Both are properties of the binary body; the `.dhchar` carries JSON and
     * has neither, which is exactly why it is the vector that has to work.
     */
    it('cannot carry an unpaired surrogate, and the file can', async () => {
      const c = MATRIX[1]!.character;
      const broken = { ...c, notes: `before \uD83D after` };
      const back = (
        await decodeCharacter(await encodeCharacter(broken, testRegistry), testRegistry)
      ).character;

      // UTF-8 has no encoding for half a surrogate pair, so it comes back as
      // the replacement character. The file keeps it, because JSON escapes it.
      expect(back.notes).toBe('before � after');
      expect(parseCharacterFile(serializeCharacter(broken)).notes).toBe(broken.notes);
    });

    it('reads an empty timestamp as "now", the one value it substitutes', async () => {
      const c = MATRIX[1]!.character;
      const undated = { ...c, updatedAt: '' };
      const back = (
        await decodeCharacter(await encodeCharacter(undated, testRegistry), testRegistry)
      ).character;

      expect(back.createdAt).toBe(c.createdAt);
      expect(Date.parse(back.updatedAt)).toBeGreaterThan(Date.parse(c.updatedAt));
    });
  });

  // -------------------------------------------------------------------------

  describe('the .dhchar and .dhbackup files', () => {
    const at = new Date('2026-08-15T21:30:00.000Z');

    it('round-trips every character in the matrix, ids and all', () => {
      for (const { label, character } of MATRIX) {
        expect(parseCharacterFile(serializeCharacter(character, at)), label).toStrictEqual(
          character,
        );
      }
    });

    it('round-trips the whole library in one backup', () => {
      const characters = MATRIX.map((s) => s.character);
      const text = serializeBackup(characters, at);
      expect(parseBackupFile(text)).toStrictEqual(characters);
      console.log(
        `  .dhbackup of ${characters.length} characters: ${(bytesOf(text) / 1024).toFixed(0)} KiB`,
      );
    });

    /**
     * The file is the vector that has to work: it carries slugs, so unlike the
     * QR it needs no registry at all and cannot be defeated by a device with
     * older content.
     */
    it('needs no registry, so nothing about it can be unresolvable', () => {
      const parked = MATRIX.filter((s) => (s.character.unresolvedRefs ?? []).length > 0);
      expect(parked.length).toBeGreaterThan(0);
      for (const { label, character } of parked) {
        const back = parseCharacterFile(serializeCharacter(character, at));
        expect(back.unresolvedRefs, label).toStrictEqual(character.unresolvedRefs);
        expect(back.loadout, label).toStrictEqual(character.loadout);
      }
    });
  });

  // -------------------------------------------------------------------------

  describe('frames', () => {
    it('reassembles every character from frames delivered shuffled, with duplicates', () => {
      for (const row of rows) {
        const frames = toFrameBytes(row.payload, 0x4242);
        // What a camera at 5 fps actually hands the collector: the same codes
        // over and over, in whatever order the sender's loop happened to be in.
        const seen = shuffled([...frames, ...frames, frames[0]!, frames.at(-1)!], row.frames * 7 + 3);

        const collector = new FrameCollector();
        const completed: Uint8Array[] = [];
        for (const frame of seen) {
          const result = collector.accept(frame);
          if (result.status === 'complete') completed.push(result.payload);
        }
        expect(completed.length, row.label).toBe(1);
        expect(completed[0], row.label).toEqual(row.payload);
      }
    });

    it('rejects a chunk lifted from another transfer, however well it is dressed', async () => {
      // Two sheets sent at one table that drew the same transferId, the same
      // frame count and - the case the id alone cannot catch - are quoted with
      // the same crc. Only the checksum over the joined payload finds this.
      const pair = rows.filter((r) => r.frames >= 2);
      expect(pair.length).toBeGreaterThan(1);
      const [a, b] = [pair[0]!, pair[1]!];

      const mine = chunkPayload(a.payload, 0x0777);
      const theirs = chunkPayload(b.payload, 0x0777);
      const forged = { ...mine[0]!, chunk: theirs[0]!.chunk };
      expect(forged.chunk).not.toEqual(mine[0]!.chunk);

      const collector = new FrameCollector();
      let last = collector.accept(packFrame(forged));
      for (const frame of mine.slice(1)) last = collector.accept(packFrame(frame));

      expect(last.status).toBe('corrupt');
      if (last.status === 'corrupt') expect(last.reason).toMatch(/two different transfers/);
      // And the ruined set is gone, so the next scan starts from nothing.
      expect(collector.progress()).toHaveLength(0);
    });

    it('never lets a frame from a different character complete the wrong one', () => {
      const pair = rows.filter((r) => r.frames >= 2);
      const [a, b] = [pair[0]!, pair[1]!];

      // Same transferId, different payload: the crc in the header keys them
      // into two sets, so the intruder cannot finish somebody else's sheet.
      const collector = new FrameCollector();
      const mine = toFrameBytes(a.payload, 0x0888);
      const theirs = toFrameBytes(b.payload, 0x0888);
      const results = [...mine.slice(0, -1), theirs[0]!].map((f) => collector.accept(f));
      expect(results.some((r) => r.status === 'complete')).toBe(false);
      expect(collector.progress().length).toBe(2);
    });

    it('reports the frame-count distribution, and how far the matrix is from fifteen', () => {
      const counts = rows.map((r) => r.frames).sort((x, y) => x - y);
      const histogram = new Map<number, number>();
      for (const n of counts) histogram.set(n, (histogram.get(n) ?? 0) + 1);
      const worst = rows.reduce((a, b) => (b.frames > a.frames ? b : a));

      console.log(
        [
          '',
          `  frames per character, over ${rows.length} characters (${MAX_CHUNK_BYTES} bytes a frame)`,
          ...[...histogram.entries()]
            .sort((x, y) => x[0] - y[0])
            .map(([n, many]) => `    ${String(n).padStart(2)} frame${n === 1 ? ' ' : 's'}  ${'█'.repeat(many)} ${many}`),
          `    median ${percentile(counts, 0.5)} · p95 ${percentile(counts, 0.95)} · worst ${worst.frames}`,
          `    worst case: ${worst.label} (${worst.payload.length} bytes)`,
          `    the architecture's "offer the file instead" line is ~15 frames, i.e. ` +
            `${15 * MAX_CHUNK_BYTES} bytes`,
        ].join('\n'),
      );

      // Every character the game can produce - level 10, multiclassed, a
      // companion, a journal in the notes - is comfortably under the line, so
      // the QR stays the everyday vector and the file stays the fallback.
      expect(worst.frames).toBeLessThanOrEqual(15);
      expect(worst.frames).toBeLessThan(10);
    });
  });

  // -------------------------------------------------------------------------

  describe('size', () => {
    it('reports the distribution, and what the largest sheet spent its bytes on', async () => {
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
          `  why "${largest.label}" is the largest`,
          `    ${largest.payload.length} bytes on the wire, ${raw.length} before deflate`,
          `    ${text} of those bytes are text its player typed`,
          `    ${refs} references at 2 bytes each, ${largest.original.levelUpHistory.length} level-up records`,
          `    ${largest.payload.length - anonymous.length} bytes are the id and timestamps`,
          `    the same sheet as JSON with slugs: ${asJson} bytes`,
        ].join('\n'),
      );

      // Free text is the only part of a sheet that can grow without bound, and
      // on the biggest character in the game it is already most of the payload.
      // That is the number to watch: refs and history are bounded by the rules.
      expect(text).toBeGreaterThan(largest.payload.length / 3);
      expect(percentile(sizes, 0.5)).toBeLessThan(MAX_CHUNK_BYTES * 3);
    });

    it('is a third of the same sheet as JSON, which is the point of the registry', () => {
      for (const row of rows) {
        if (row.original.classRef === '') continue; // the blank sheet is all header
        const asJson = bytesOf(JSON.stringify(row.original));
        expect(row.payload.length, row.label).toBeLessThan(asJson / 2);
      }
    });
  });

  // -------------------------------------------------------------------------

  describe('degraded import', () => {
    /**
     * The everyday version of this: two players at a table, one updated the
     * app last week and one did not. Architecture 5.3 is absolute about it -
     * a reference this device cannot name is parked, never dropped, and the
     * sheet is whole again the moment the missing content turns up.
     *
     * Half of that is shipped and half of it is this file's own arrangement.
     * The parking is real: the codec does it on every decode. The healing is
     * not - `resolvePlaceholders` is called below by hand, because nothing in
     * `src/` calls it, so no sheet on a real device has ever been made whole
     * this way. BACKLOG P1-6 is the item, and the warning the decoder prints
     * to the player now says so rather than promising the repair.
     */
    it('parks an id this build does not know and loses nothing else, for every character', async () => {
      let tested = 0;
      for (const row of rows) {
        const slug = refToHide(row.original);
        if (slug === null) {
          expect(characterRefs(row.original), row.label).toEqual([]);
          continue;
        }
        tested += 1;
        const id = testRegistry.idOf(slug)!;
        const older = registryWithout(slug);

        // Anything the sheet already carried as a parked id is still parked, so
        // the expectation is "one more than it arrived with", not "exactly one".
        const alreadyParked = characterRefs(row.original)
          .filter(isUnresolvedRef)
          .map((r) => unresolvedIdOf(r)!);
        const expected = [...new Set([id, ...alreadyParked])].sort((x, y) => x - y);

        const { character, unresolved, warnings } = await decodeCharacter(row.payload, older);
        expect(unresolved, row.label).toEqual(expected);
        expect(warnings, row.label).toHaveLength(1);
        expect(character.unresolvedRefs, row.label).toContain(id);

        // The unknown card is still on the sheet, in its own place, under an id
        // no slug can collide with.
        const before = characterRefs(row.original).filter((r) => r === slug).length;
        const after = characterRefs(character).filter((r) => r === unresolvedRef(id)).length;
        expect(after, `${row.label}: ${slug}`).toBe(before);

        // ...and when the content arrives, the sheet is the one that was sent.
        const { character: healed, resolved } = resolvePlaceholders(character, testRegistry);
        expect(resolved, row.label).toEqual([id]);
        expect(normalizeHandles(healed), row.label).toStrictEqual(normalizeHandles(row.original));
      }
      expect(tested).toBeGreaterThan(80);
    });

    it('forwards a reserved id untouched, because no build can ever name one', async () => {
      const parked = rows.filter((r) => (r.original.unresolvedRefs ?? []).length > 0);
      expect(parked.length).toBeGreaterThan(0);
      for (const row of parked) {
        const { character, unresolved } = await decodeCharacter(row.payload, testRegistry);
        for (const id of row.original.unresolvedRefs ?? []) {
          expect(id, row.label).toBeGreaterThanOrEqual(RESERVED_MIN);
          expect(character.unresolvedRefs, row.label).toContain(id);
          expect(unresolved, row.label).toContain(id);
        }
        // A device that cannot name them still passes them on intact.
        const again = await encodeCharacter(character, testRegistry);
        expect(again, row.label).toEqual(row.payload);
      }
    });
  });

  // -------------------------------------------------------------------------

  describe('the registry, over everything the matrix references', () => {
    it('has an id for every reference, and every id is in its own band', () => {
      const bandOfKind = (kind: Parameters<typeof bandFor>[0]): Band => bandFor(kind);
      const checks: Array<{ refs: Ref[]; band: Band; what: string }> = [];

      for (const { label, character: c } of MATRIX) {
        const add = (refs: Array<Ref | null>, band: Band, what: string): void => {
          checks.push({
            refs: refs.filter((r): r is Ref => typeof r === 'string' && r !== ''),
            band,
            what: `${label}: ${what}`,
          });
        };
        add([c.classRef, c.multiclassRef], bandOfKind('classes'), 'class');
        add(c.subclassRefs, bandOfKind('subclasses'), 'subclass');
        add(c.ancestryRefs, bandOfKind('ancestries'), 'ancestry');
        add([c.communityRef], bandOfKind('communities'), 'community');
        add([...c.loadout, ...c.vault], bandOfKind('domainCards'), 'domain card');
        add([c.activePrimaryWeapon, c.activeSecondaryWeapon], bandOfKind('weapons'), 'weapon');
        add([c.activeArmor], bandOfKind('armors'), 'armor');
        add(c.inventory.map((e) => e.ref), bandOfKind('loot'), 'inventory');
        add([c.beastform?.ref ?? null], bandOfKind('beastforms'), 'beastform');
      }

      let counted = 0;
      for (const { refs, band, what } of checks) {
        for (const ref of refs) {
          if (isUnresolvedRef(ref)) continue; // checked below: those are ids, not slugs
          counted += 1;
          const id = testRegistry.idOf(ref);
          expect(id, `${what} "${ref}" has no id in data/registry.json`).not.toBeNull();
          expect(id!, `${what} "${ref}" holds ${id}, outside the ${band.name} band`).toBeGreaterThanOrEqual(band.min);
          expect(id!, `${what} "${ref}" holds ${id}, outside the ${band.name} band`).toBeLessThanOrEqual(band.max);
          expect(id!, `${what} "${ref}" is at or above the reserved ${RESERVED_MIN}`).toBeLessThan(
            RESERVED_MIN,
          );
          expect(bandOf(id!), `${what} "${ref}"`).not.toBeNull();
        }
      }
      console.log(`  ${counted} references across ${MATRIX.length} characters, all in band`);
      expect(counted).toBeGreaterThan(500);
    });

    it('only ever parks an id no build of this app could have named', () => {
      const parked = MATRIX.flatMap(({ label, character }) => [
        ...characterRefs(character).filter(isUnresolvedRef).map((r) => ({ label, id: unresolvedIdOf(r)! })),
        ...(character.unresolvedRefs ?? []).map((id) => ({ label, id })),
      ]);
      expect(parked.length).toBeGreaterThan(0);
      for (const { label, id } of parked) {
        // Either user content, which is reserved forever, or content this build
        // has not got. Never a slug we simply forgot to give an id.
        expect(id >= RESERVED_MIN || testRegistry.slugOf(id) === null, `${label}: ${id}`).toBe(true);
      }
    });
  });
});
