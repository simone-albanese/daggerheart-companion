/**
 * The negative space: what this app does when the input is wrong.
 *
 * Every other suite here proves the app does the right thing when it is handed
 * the right thing. This one hands it the wrong thing on purpose - a payload
 * with a bit knocked out of it, a level-up plan belonging to somebody else's
 * character, a tier 4 sword on a level 1 sheet, a Hope count below zero, a
 * reference to a card that was never printed - and proves the refusal happens,
 * at a named layer, in the words a player would actually be shown.
 *
 * WHY IT MATTERS. This app has no server and no second copy. The sheet on the
 * phone is the sheet. So the failure that costs somebody their character is
 * never a crash: a crash is loud, and the file is still on disk afterwards. It
 * is the quiet one. A QR misread by a single bit that decodes into a
 * *plausible* character with a different weapon in it. A plan that walks a
 * level 2 rogue to level 9 because nothing tied the plan to the sheet it was
 * written for. A negative counter that survives one export vector and not the
 * other, so which button the player pressed decides what their sheet says.
 * Nobody notices any of those until the session where it matters.
 *
 * EVERY TEST HERE CARRIES ITS CONTROL. Watching a guard say no proves nothing
 * on its own - a function that refuses everything would pass. So each test also
 * offers the same input with the one offending field repaired, and requires it
 * to be accepted. That is what ties the refusal to the guard rather than to the
 * shape of the input.
 *
 * AND WHERE THERE IS NO GUARD, IT SAYS SO. Ten places in here do not check what
 * a reader would assume they check. Each asserts the real current behaviour and
 * carries a comment beginning UNGUARDED, naming the input that gets through and
 * the layer that does catch it, if any. Seven are marked `UNGUARDED (finding)`:
 * gaps nobody chose, written down rather than papered over. The other three say
 * `by design` and give the reason - a GM is allowed to hand out gear above the
 * party's tier, `affordable` is advice rather than a refusal, and a damage
 * threshold has no maximum. The distinction is the point: a gap that was argued
 * for and a gap nobody noticed should not read the same way.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Character, DomainCard, Tier } from '../shared/types.ts';
import {
  MAX_ARMOR_SCORE,
  MAX_HP,
  MAX_LEVEL,
  MAX_LOADOUT,
  MAX_STRESS,
  deriveStats,
  indexDataset,
  newCharacter,
  syncCounters,
  tierOf,
} from '../src/engine/character.ts';
import {
  applyLevelUp,
  tierAchievementFor,
  validatePlan,
  type LevelUpPlan,
} from '../src/engine/levelUp.ts';
import {
  canAddToLoadout,
  cardAvailability,
  missingCardRefs,
  recallCard,
  resolveCards,
} from '../src/engine/loadout.ts';
import {
  CodecError,
  UnknownSlugError,
  characterRefs,
  decodeCharacter,
  encodeCharacter,
  missingSlugs,
  resolvePlaceholders,
} from '../src/transfer/codec.ts';
import {
  FrameCollector,
  MAX_CHUNK_BYTES,
  chunkPayload,
  crc32,
  framesNeeded,
  packFrame,
  toFrameBytes,
  unpackFrame,
  type TransferFrame,
} from '../src/transfer/frames.ts';
import { parseCharacterFile, serializeCharacter } from '../src/transfer/fileIo.ts';
import {
  armorQuery,
  filterArmors,
  filterWeapons,
  tierLevel,
  tierNote,
  weaponQuery,
} from '../src/ui/build/gear.ts';
import { hasDataset, loadDataset, sampleMatrix, type Sample } from '../tools/sampleCharacters.ts';
import {
  advancement,
  makeArmor,
  makeCard,
  makeCharacter,
  makeClass,
  makeDataset,
  makeSubclass,
} from './fixtures/factories.ts';
import { normalizeHandles, registryWithout, testRegistry, wizard } from './transfer/fixtures.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The sheet with the local handles the codec deliberately reassigns removed. */
const shape = (c: Character): string => JSON.stringify(normalizeHandles(c));

type PlanPick = LevelUpPlan['picks'][number];

const takes = (
  optionId: string,
  optionTier: Tier,
  detail: Record<string, unknown> = {},
): PlanPick => ({ optionId, optionTier, detail });

/**
 * A plan shaped exactly as the level-up screen shapes one, so that when a test
 * breaks a single field it is the only thing wrong with it. The tier and the
 * achievement are read off the destination level, which is what the screen does.
 */
const planTo = (
  toLevel: number,
  picks: PlanPick[],
  newCardRef: string | null = 'a-card-taken-at-step-four',
): LevelUpPlan => ({
  fromLevel: toLevel - 1,
  toLevel,
  tier: tierOf(toLevel),
  achievement: tierAchievementFor(toLevel),
  picks,
  newCardRef,
});

/** A deterministic generator, so "random noise" is the same noise tomorrow. */
const noise = (seed: number, length: number): Uint8Array => {
  const out = new Uint8Array(length);
  let n = seed >>> 0;
  for (let i = 0; i < length; i += 1) {
    n = (n * 1664525 + 1013904223) >>> 0;
    out[i] = (n >>> 16) & 0xff;
  }
  return out;
};

/** LEB128, the same encoding `codec.ts` writes, for hand-crafting a payload. */
const varint = (value: number): number[] => {
  const out: number[] = [];
  let v = value;
  while (v >= 0x80) {
    out.push((v % 0x80) + 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
  return out;
};

// ===========================================================================
// 1. A TRANSFER THAT ARRIVED DAMAGED
// ===========================================================================

/**
 * `sampleMatrix` is the ninety-three-sheet cross-section the transfer tests
 * already use. Corruption is swept over a spread of it rather than over one
 * wizard, because a format's weak spot is a *field*, and a field only exists on
 * the sheets that have it.
 */
const MATRIX: Sample[] = hasDataset() ? sampleMatrix(loadDataset()) : [];

describe.skipIf(!hasDataset())('a transfer that arrived damaged', () => {
  interface Row {
    label: string;
    original: Character;
    payload: Uint8Array;
    /** What the untouched payload gave back. */
    decoded: Character;
    /**
     * `shape(decoded)`, for comparing thousands of damaged decodes cheaply. It
     * is taken from the DECODED sheet rather than the original because the
     * decoder rebuilds `traits` and every `detail` in its own canonical key
     * order - identical characters, different JSON text.
     */
    baseline: string;
    /** The decoded sheet's fields, for naming which of them a flip changed. */
    fields: Record<string, unknown>;
  }

  let spread: Row[] = [];
  let unswept = 0;

  beforeAll(async () => {
    // Every seventh row, plus the last two, which are the hand-made specials:
    // the campaign journal and the sheet carrying parked references.
    const chosen = MATRIX.filter((_s, i) => i % 7 === 0 || i >= MATRIX.length - 2);
    unswept = MATRIX.length - chosen.length;
    spread = await Promise.all(
      chosen.map(async (sample) => {
        const payload = await encodeCharacter(sample.character, testRegistry);
        const { character } = await decodeCharacter(payload, testRegistry);
        return {
          label: sample.label,
          original: sample.character,
          payload,
          decoded: character,
          baseline: shape(character),
          fields: normalizeHandles(character) as Record<string, unknown>,
        };
      }),
    );
  });

  it('gives back exactly the character it was given, before anything is broken', () => {
    // The control the whole section rests on. If an untouched payload did not
    // round-trip, every "the damaged one was refused" below would prove nothing.
    for (const row of spread) {
      expect(normalizeHandles(row.decoded), row.label).toEqual(normalizeHandles(row.original));
    }
    console.log(
      `corruption is swept over ${spread.length} of the matrix's ${MATRIX.length} sheets, ` +
        `${unswept} rows are NOT swept. Swept: ${spread
          .map((r) => r.label.split(' · ')[0])
          .join(', ')}`,
    );
    expect(spread.length).toBeGreaterThan(10);
  });

  it('refuses a payload whose version nibble was flipped, and names the version it read', async () => {
    const row = spread[0]!;
    // The low nibble of byte 0 is the format version; any of its four bits
    // becomes a version this build does not read.
    for (const bit of [0, 1, 2, 3]) {
      const bad = row.payload.slice();
      bad[0] = bad[0]! ^ (1 << bit);
      expect(bad[0], `bit ${bit} must actually differ`).not.toBe(row.payload[0]);
      await expect(decodeCharacter(bad, testRegistry)).rejects.toThrow(
        /written by a different version of the app \(format \d+, this app reads 1\)/,
      );
    }
    // Control: the same byte put back decodes into the same character.
    expect(shape((await decodeCharacter(row.payload.slice(), testRegistry)).character)).toBe(
      row.baseline,
    );
  });

  it('refuses a payload whose deflate flag was flipped, on every sheet in the spread', async () => {
    // Bit 7 says "the body is deflated". Clearing it hands raw deflate output to
    // the field reader, which is not text, not a ref list and not a length.
    for (const row of spread) {
      const bad = row.payload.slice();
      bad[0] = bad[0]! ^ 0x80;
      await expect(decodeCharacter(bad, testRegistry), row.label).rejects.toBeInstanceOf(CodecError);
    }
  });

  it('never reads three of the eight header bits, so a flip in them is invisible', async () => {
    // UNGUARDED (finding, benign). Bits 4, 5 and 6 of the header byte are
    // neither the version nibble nor the deflate flag, and `decodeCharacter`
    // never looks at them: `header & VERSION_MASK` and `header & DEFLATED_BIT`
    // are the only two reads. Corruption there is undetected - and also inert,
    // because the character that comes back is identical in every field.
    // Recorded so nobody assumes the whole header is checked.
    const row = spread[0]!;
    for (const bit of [4, 5, 6]) {
      const bad = row.payload.slice();
      bad[0] = bad[0]! ^ (1 << bit);
      const { character } = await decodeCharacter(bad, testRegistry);
      expect(shape(character), `header bit ${bit}`).toBe(row.baseline);
    }
    // Teeth: the same trick on a bit that IS read is rejected outright, so the
    // three passes above are about those bits and not about a lenient decoder.
    const versionBit = row.payload.slice();
    versionBit[0] = versionBit[0]! ^ 0x01;
    await expect(decodeCharacter(versionBit, testRegistry)).rejects.toBeInstanceOf(CodecError);
  });

  it('catches two damaged payloads in three by itself, and the frame checksum catches the third', async () => {
    // THE MEASUREMENT THIS FILE EXISTS FOR.
    //
    // A deflated body carries no checksum: raw deflate has none, and the codec
    // adds none. What rejects a damaged payload is the structure - a varint that
    // runs off the end, text that is not UTF-8, a count that does not add up,
    // bytes left over at the end. That catches most corruption and cannot catch
    // all of it: a flip that lands inside a number keeps every length intact and
    // decodes into a sheet with a different card, a different scar, a different
    // level-up record, and no complaint.
    //
    // What closes the gap is one layer up: `crc32`, carried in every QR frame
    // over the whole payload and re-checked on reassembly. Every production
    // route into `decodeCharacter` arrives through `FrameCollector`
    // (src/ui/settings/Transfer.tsx:301, src/ui/gm/PartyBoard.tsx:642), so the
    // app is safe - but it is safe *because of the frame checksum*, and anyone
    // feeding a payload in from somewhere else inherits nothing.
    let detected = 0;
    let acceptedIdentical = 0;
    let acceptedDifferent = 0;
    let notACodecError = 0;
    let crcMissed = 0;
    const changedFields = new Map<string, number>();
    const examples: string[] = [];

    for (const row of spread) {
      for (let at = 0; at < row.payload.length; at += 1) {
        const bad = row.payload.slice();
        bad[at] = bad[at]! ^ 0x01;
        // The frame layer's verdict on the very same corruption, for comparison.
        if (crc32(bad) === crc32(row.payload)) crcMissed += 1;
        try {
          const { character } = await decodeCharacter(bad, testRegistry);
          const got = normalizeHandles(character) as Record<string, unknown>;
          const changed = Object.keys(row.fields).filter(
            (k) => JSON.stringify(row.fields[k]) !== JSON.stringify(got[k]),
          );
          if (changed.length === 0) {
            acceptedIdentical += 1;
          } else {
            acceptedDifferent += 1;
            for (const k of changed) changedFields.set(k, (changedFields.get(k) ?? 0) + 1);
            if (examples.length < 5) {
              examples.push(`${row.label.split(' · ')[0]} byte ${at} → ${changed.join(', ')}`);
            }
          }
        } catch (error) {
          detected += 1;
          if (!(error instanceof CodecError)) notACodecError += 1;
        }
      }
    }

    const total = detected + acceptedIdentical + acceptedDifferent;
    console.log(
      `single-bit corruption, one flip per byte, over ${spread.length} sheets: ${total} flips\n` +
        `  rejected by the codec ......... ${detected} (${((detected / total) * 100).toFixed(1)}%)\n` +
        `  accepted, sheet unchanged ..... ${acceptedIdentical}\n` +
        `  ACCEPTED, SHEET DIFFERENT ..... ${acceptedDifferent} (${((acceptedDifferent / total) * 100).toFixed(1)}%)\n` +
        `  missed by the frame crc32 ..... ${crcMissed}\n` +
        `  fields the accepted ones altered: ${[...changedFields]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => `${k} ${n}`)
          .join(', ')}\n` +
        `  first five of ${acceptedDifferent}: ${examples.join(' | ')}`,
    );

    // Damage is reported in the codec's own vocabulary, never as a stray
    // TypeError from inside a reader. (One shape of corruption escapes this and
    // is proved separately, two tests below.)
    expect(notACodecError).toBe(0);
    // Some corruption gets past the codec. This is the finding, and the
    // assertion is deliberately written so that an integrity check added inside
    // the codec turns this red and forces the comment above to be rewritten.
    expect(acceptedDifferent).toBeGreaterThan(0);
    // And this is why that is survivable today: the checksum the QR vector
    // actually uses caught every single one of them.
    expect(crcMissed).toBe(0);
    // Teeth for that zero: an untouched payload's crc matches itself, so
    // `crcMissed === 0` is a claim about the corruptions rather than a claim
    // that crc32 returns something constant.
    for (const row of spread) expect(crc32(row.payload.slice())).toBe(crc32(row.payload));
  });

  it('refuses a payload that stops early, at every length it could stop at', async () => {
    let refused = 0;
    let accepted = 0;
    for (const row of spread) {
      for (let keep = 1; keep < row.payload.length; keep += 1) {
        try {
          await decodeCharacter(row.payload.subarray(0, keep), testRegistry);
          accepted += 1;
        } catch {
          refused += 1;
        }
      }
    }
    console.log(`truncation: ${refused} of ${refused + accepted} prefixes refused`);
    expect(accepted).toBe(0);
    expect(refused).toBeGreaterThan(1000);
    // Control: one byte further on - the whole payload - is accepted, so the
    // refusals are about the missing bytes and not about the sheets.
    for (const row of spread) {
      expect(shape((await decodeCharacter(row.payload, testRegistry)).character)).toBe(row.baseline);
    }
  });
});

describe('a payload that is not a payload at all', () => {
  it('refuses an empty transfer before it looks at anything else', async () => {
    for (const bytes of [new Uint8Array(0), new Uint8Array([1]), new Uint8Array([0x81])]) {
      await expect(decodeCharacter(bytes, testRegistry)).rejects.toThrow(
        'That is not a character transfer: it is empty.',
      );
    }
  });

  it('refuses a payload that is a header and a shrug', async () => {
    // Two bytes is long enough to get past the emptiness check: version 1,
    // undeflated, and a body holding a single zero, which says "no id" and then
    // stops with the name still to come.
    await expect(decodeCharacter(new Uint8Array([1, 0]), testRegistry)).rejects.toThrow(
      'The transfer ended early - it is incomplete or damaged.',
    );
  });

  it('refuses a body whose text length was tampered with, in either direction', async () => {
    // Written without deflate and without identity so the layout is legible:
    // byte 0 is the header, byte 1 says "no id", byte 2 is the varint length of
    // the name, and the name follows.
    const sheet = wizard();
    const payload = await encodeCharacter(sheet, testRegistry, {
      compress: false,
      identity: false,
    });
    // Teeth: prove byte 2 is the name's length before tampering with it, or this
    // would be flipping a byte at random and calling it a length prefix.
    expect(payload[2]).toBe(sheet.name.length);
    expect(new TextDecoder().decode(payload.subarray(3, 3 + sheet.name.length))).toBe(sheet.name);
    // Control: untouched, the name reads back.
    expect((await decodeCharacter(payload, testRegistry)).character.name).toBe(sheet.name);

    for (const delta of [-1, 1, 5, 40]) {
      const bad = payload.slice();
      bad[2] = bad[2]! + delta;
      await expect(
        decodeCharacter(bad, testRegistry),
        `name length ${delta > 0 ? '+' : ''}${delta}`,
      ).rejects.toBeInstanceOf(CodecError);
    }
  });

  it('lets a corrupted timestamp out as a RangeError instead of a damaged transfer', async () => {
    // UNGUARDED (finding). `readWhen` does `new Date(ms).toISOString()` on a
    // varint straight off the wire (src/transfer/codec.ts:285). Past the
    // 8.64e15 ms that a Date can hold, `toISOString` throws `RangeError:
    // Invalid time value`, which is not a `CodecError` - so a caller that
    // catches CodecError to say "this transfer is damaged" will instead see an
    // unhandled error. It is rare (3 escapes in 19,960 single-bit flips
    // measured across the spread) and it is real.
    const crafted = new Uint8Array([
      1, // version 1, undeflated
      1, // the id is a UUID
      ...new Array<number>(16).fill(0xab),
      1, // createdAt is epoch milliseconds
      ...varint(1e16), // more milliseconds than a Date can hold
    ]);
    const escaped = await decodeCharacter(crafted, testRegistry).catch((e: unknown) => e);
    expect(escaped).toBeInstanceOf(RangeError);
    expect(escaped).not.toBeInstanceOf(CodecError);
    expect((escaped as RangeError).message).toBe('Invalid time value');

    // TEETH: the identical payload with a plausible timestamp gets all the way
    // to the next field and fails there in the codec's own words, so the
    // RangeError above is caused by the number and not by the crafted shape.
    const plausible = new Uint8Array([
      1,
      1,
      ...new Array<number>(16).fill(0xab),
      1,
      ...varint(1_771_096_000_000),
    ]);
    await expect(decodeCharacter(plausible, testRegistry)).rejects.toBeInstanceOf(CodecError);
  });

  it('never reads a character out of bytes that are simply noise', async () => {
    // Every one of these carries a valid version byte, so the cheap check at the
    // top cannot be what refuses them. The structure has to.
    let accepted = 0;
    const attempts = 400;
    for (let i = 0; i < attempts; i += 1) {
      const bytes = noise(i + 1, 2 + (i % 300));
      bytes[0] = 1;
      try {
        await decodeCharacter(bytes, testRegistry);
        accepted += 1;
      } catch {
        /* refused, which is the point */
      }
    }
    console.log(`${attempts} noise payloads with a valid version byte: ${accepted} accepted`);
    expect(accepted).toBe(0);
  });
});

// ===========================================================================
// 2. A SET OF QR FRAMES THAT IS NOT THE ONE THAT WAS SENT
// ===========================================================================

describe('a set of QR frames that is not the one that was sent', () => {
  /** 700 bytes is four frames, three of them full: enough to swap and splice. */
  const payload = noise(0x5eed, 700);
  const TRANSFER = 0x4242;

  it('reassembles the clean set, which is the control for everything below', () => {
    expect(framesNeeded(payload.length)).toBe(4);
    const collector = new FrameCollector();
    const results = toFrameBytes(payload, TRANSFER).map((b) => collector.accept(b));
    expect(results.map((r) => r.status)).toEqual(['partial', 'partial', 'partial', 'complete']);
    const last = results[3]!;
    if (last.status !== 'complete') throw new Error('the control set must complete');
    expect([...last.payload]).toEqual([...payload]);
  });

  it('throws away a set whose chunk was misread rather than handing it on', () => {
    const all = toFrameBytes(payload, TRANSFER).map((b) => b.slice());
    const target = all[2]!;
    const before = target[20]!;
    target[20] = before ^ 0x01;
    expect(target[20]).not.toBe(before);

    const collector = new FrameCollector();
    const results = all.map((b) => collector.accept(b));
    expect(results.map((r) => r.status)).toEqual(['partial', 'partial', 'partial', 'corrupt']);
    const last = results[3]!;
    if (last.status !== 'corrupt') throw new Error('unreachable');
    expect(last.reason).toMatch(/two different transfers/);
    // The set is dropped, not left half-built for the next frame to finish.
    expect(collector.progress()).toEqual([]);
  });

  it('never completes when one frame carries somebody else’s checksum', () => {
    const all = toFrameBytes(payload, TRANSFER).map((b) => b.slice());
    // Byte 7 is the first byte of the payload crc32 in the header.
    all[0]![7] = all[0]![7]! ^ 0x01;
    const collector = new FrameCollector();
    expect(all.map((b) => collector.accept(b).status)).toEqual([
      'partial',
      'partial',
      'partial',
      'partial',
    ]);
    // Two sets, because a group is keyed by transferId AND crc AND total.
    expect(collector.progress().map((p) => p.received).sort()).toEqual([1, 3]);
    expect(collector.progress().some((p) => p.complete)).toBe(false);
  });

  it('never completes when one frame carries somebody else’s transfer id', () => {
    const all = toFrameBytes(payload, TRANSFER).map((b) => b.slice());
    all[0]![3] = all[0]![3]! ^ 0x01;
    const collector = new FrameCollector();
    expect(all.map((b) => collector.accept(b).status)).toEqual([
      'partial',
      'partial',
      'partial',
      'partial',
    ]);
    expect(new Set(collector.progress().map((p) => p.transferId)).size).toBe(2);
    expect(collector.progress().map((p) => p.received).sort()).toEqual([1, 3]);
  });

  it('refuses a set whose frames were relabelled into each other’s places', () => {
    // The count is right, the checksum in every header is right, and every byte
    // of every chunk is right - and it is still not the payload that was sent,
    // because two chunks are in the wrong order. Only the crc over the joined
    // result can see that.
    const frames: TransferFrame[] = chunkPayload(payload, TRANSFER).map((f) => ({ ...f }));
    frames[0]!.index = 1;
    frames[1]!.index = 0;
    const collector = new FrameCollector();
    const results = frames.map((f) => collector.accept(packFrame(f)));
    expect(results.map((r) => r.status)).toEqual(['partial', 'partial', 'partial', 'corrupt']);
  });

  it('ignores a code that is not ours instead of calling it damage', () => {
    const one = toFrameBytes(payload, TRANSFER)[0]!.slice();
    expect(unpackFrame(one)).not.toBeNull();
    one[0] = 'X'.charCodeAt(0);
    expect(unpackFrame(one)).toBeNull();
    const result = new FrameCollector().accept(one);
    if (result.status !== 'ignored') throw new Error('a foreign code must be ignored');
    expect(result.reason).toBe('Not a Daggerheart transfer code.');
  });

  it('ignores a frame claiming to be the two hundredth of four', () => {
    const one = toFrameBytes(payload, TRANSFER)[0]!.slice();
    one[5] = 200;
    expect(one[6]).toBe(4);
    expect(unpackFrame(one)).toBeNull();
  });

  it('refuses to pack a frame whose header cannot hold what it was given', () => {
    const chunk = new Uint8Array([1, 2, 3]);
    const refusals: Array<[TransferFrame, RegExp]> = [
      [
        { transferId: 1, index: 3, total: 3, crc32: 0, chunk },
        /index 3 is out of range for a set of 3/,
      ],
      [{ transferId: 1, index: 0, total: 0, crc32: 0, chunk }, /total must be at least 1/],
      [
        { transferId: 70_000, index: 0, total: 1, crc32: 0, chunk },
        /transferId must be an integer in 0\.\.65535/,
      ],
      [
        { transferId: 1, index: 0, total: 1, crc32: 2 ** 32, chunk },
        /crc32 must be an integer in 0\.\.4294967295/,
      ],
      [
        { transferId: 1, index: 0, total: 1, crc32: 0, chunk: new Uint8Array(MAX_CHUNK_BYTES + 1) },
        /exceeds the 180-byte limit/,
      ],
    ];
    for (const [frame, message] of refusals) expect(() => packFrame(frame)).toThrow(message);
    // Control: every field in range packs, and unpacks to what went in.
    const good: TransferFrame = { transferId: 1, index: 0, total: 1, crc32: 7, chunk };
    expect(unpackFrame(packFrame(good))).toEqual(good);
  });
});

describe.skipIf(!hasDataset())('a real character carried over damaged frames', () => {
  it('refuses the set with one byte wrong and accepts the same set with it right', async () => {
    const sheet = MATRIX[MATRIX.length - 2]!.character;
    const payload = await encodeCharacter(sheet, testRegistry);
    const clean = toFrameBytes(payload, 0x0d11);
    expect(clean.length).toBeGreaterThan(1);

    // Control first: the clean set really does carry this character.
    const good = new FrameCollector();
    const finished = clean.map((b) => good.accept(b)).at(-1)!;
    if (finished.status !== 'complete') throw new Error('the clean set must complete');
    const { character } = await decodeCharacter(finished.payload, testRegistry);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(sheet));

    // One byte of one chunk, and the whole set is refused.
    const damaged = clean.map((b) => b.slice());
    damaged[0]![15] = damaged[0]![15]! ^ 0x40;
    const bad = new FrameCollector();
    expect(damaged.map((b) => bad.accept(b)).at(-1)!.status).toBe('corrupt');
    expect(bad.progress()).toEqual([]);
  });
});

// ===========================================================================
// 3. A LEVEL-UP PLAN THAT BELONGS TO SOMEBODY ELSE
// ===========================================================================

describe('a level-up plan that does not belong to this character', () => {
  const rogue = (patch: Partial<Character> = {}): Character => makeCharacter({ level: 2, ...patch });

  it('refuses a level 9 plan handed to a level 2 character, and says which levels disagree', () => {
    const plan = planTo(9, [
      takes('traits', 4, { traits: ['agility', 'strength'] }),
      takes('hit-point', 4),
    ]);
    const refused = validatePlan(rogue(), plan);
    expect(refused.ok).toBe(false);
    expect(refused.errors).toEqual(['This plan starts at level 8, but the character is level 2.']);

    // TEETH. The identical plan, offered to the character it was written for, is
    // accepted. So the refusal is caused by `plan.fromLevel !== c.level` and by
    // nothing else about the plan - which is the guard being proved. Delete that
    // one line from validatePlan and this test goes green with a level 2 rogue
    // standing at level 9.
    const accepted = validatePlan(rogue({ level: 8 }), plan);
    expect(accepted.errors).toEqual([]);
    expect(accepted.ok).toBe(true);
  });

  it('refuses three advancements at a level that grants two', () => {
    expect(
      validatePlan(
        rogue(),
        planTo(3, [
          takes('traits', 2, { traits: ['agility', 'strength'] }),
          takes('hit-point', 2),
          takes('stress', 2),
        ]),
      ).errors,
    ).toEqual(['That is more than two advancements.']);

    // A black-box option costs both picks, so pairing one with anything is three.
    expect(
      validatePlan(
        makeCharacter({ level: 5 }),
        planTo(6, [takes('proficiency', 3), takes('hit-point', 3)]),
      ).errors,
    ).toEqual(['That is more than two advancements.']);

    // And one pick alone is named as a shortfall rather than as a total.
    expect(validatePlan(rogue(), planTo(3, [takes('hit-point', 2)])).errors).toEqual([
      'Choose 1 more advancement.',
    ]);

    // Control: exactly two is accepted, and a black-box option alone is two.
    expect(validatePlan(rogue(), planTo(3, [takes('hit-point', 2), takes('stress', 2)])).ok).toBe(
      true,
    );
    expect(validatePlan(makeCharacter({ level: 5 }), planTo(6, [takes('proficiency', 3)])).ok).toBe(
      true,
    );
  });

  it('refuses a second helping of an advancement with one slot, and names the option', () => {
    expect(validatePlan(rogue(), planTo(3, [takes('evasion', 2), takes('evasion', 2)])).errors).toEqual(
      ['"Permanently gain a +1 bonus to your Evasion" has no unmarked slots left at tier 2.'],
    );

    // Once in this plan and once at an earlier level is refused too, so the
    // count is history plus plan rather than plan alone.
    const spent = rogue({ levelUpHistory: [advancement('evasion', 'evasion', 2, 2)] });
    expect(validatePlan(spent, planTo(3, [takes('evasion', 2), takes('stress', 2)])).errors).toEqual([
      '"Permanently gain a +1 bonus to your Evasion" has no unmarked slots left at tier 2.',
    ]);

    // Control: an option with three slots takes two of them in one plan without
    // a word, so the refusal above is the slot count and not the repetition.
    expect(
      validatePlan(
        rogue(),
        planTo(3, [
          takes('traits', 2, { traits: ['agility', 'strength'] }),
          takes('traits', 2, { traits: ['finesse', 'instinct'] }),
        ]),
      ).errors,
    ).toEqual([]);
  });

  it('refuses to raise a trait that is already marked this tier', () => {
    const marked = rogue({ traitMarks: { agility: 1 } });
    expect(
      validatePlan(marked, planTo(3, [takes('traits', 2, { traits: ['agility', 'strength'] })]))
        .errors,
    ).toContain('agility is already marked this tier.');
    // The same offence inside a single pick, which is where a two-trait choice
    // could quietly become a two-point one.
    expect(
      validatePlan(rogue(), planTo(3, [takes('traits', 2, { traits: ['agility', 'agility'] })]))
        .errors,
    ).toContain('Choose two different traits.');
    expect(
      validatePlan(rogue(), planTo(3, [takes('traits', 2, { traits: ['agility'] })])).errors,
    ).toContain('Choose exactly two traits to increase.');
    // Control: an unmarked pair on the very same sheet is accepted.
    expect(
      validatePlan(
        marked,
        planTo(3, [takes('traits', 2, { traits: ['finesse', 'instinct'] }), takes('stress', 2)]),
      ).errors,
    ).toEqual([]);
  });

  it('refuses an advancement this tier has not unlocked, and still counts the pick unspent', () => {
    // "Take an upgraded subclass card" arrives at tier 3. Asked for at tier 2 it
    // resolves to nothing, so it is refused twice: once by name, and once as a
    // level that has spent only one of its two picks. Asserting the whole array
    // rather than its length is the point - a reader expecting one error here
    // would be wrong, and would write a test that passed for the wrong reason.
    expect(
      validatePlan(
        rogue(),
        planTo(3, [takes('subclass', 2, { subclassRef: 'test-subclass' }), takes('hit-point', 2)]),
      ).errors,
    ).toEqual(['"subclass" is not available at tier 2.', 'Choose 1 more advancement.']);

    // An id that was never an advancement at all is refused the same way.
    expect(
      validatePlan(rogue(), planTo(3, [takes('teleport-to-level-10', 2), takes('hit-point', 2)]))
        .errors,
    ).toEqual(['"teleport-to-level-10" is not available at tier 2.', 'Choose 1 more advancement.']);

    // Control: swap the unavailable option for one this tier does have and the
    // same plan is accepted, so the refusal is availability and not shape.
    expect(validatePlan(rogue(), planTo(3, [takes('stress', 2), takes('hit-point', 2)])).ok).toBe(
      true,
    );
  });

  it('refuses a tier 4 slot to a character standing in tier 2', () => {
    // Every tier keeps its own pool of slots for the same option id, which is
    // what makes `traits@4` a different thing from `traits@2` - and a thing a
    // tier 2 character cannot reach into.
    expect(
      validatePlan(rogue(), planTo(3, [takes('traits', 4, { traits: ['agility', 'strength'] })]))
        .errors,
    ).toEqual(['"traits" is not available at tier 2.', 'Choose 2 more advancements.']);
  });

  it('refuses to pass level 10', () => {
    expect(
      validatePlan(
        makeCharacter({ level: MAX_LEVEL }),
        planTo(MAX_LEVEL + 1, [
          takes('traits', 4, { traits: ['agility', 'strength'] }),
          takes('hit-point', 4),
        ]),
      ).errors,
    ).toEqual(['Level 10 is the maximum.']);

    // Control: the last legal level up, one step earlier, is accepted.
    expect(
      validatePlan(
        makeCharacter({ level: MAX_LEVEL - 1 }),
        planTo(MAX_LEVEL, [
          takes('traits', 4, { traits: ['agility', 'strength'] }),
          takes('hit-point', 4),
        ]),
      ).ok,
    ).toBe(true);
  });

  it('refuses a plan whose tier disagrees with its own level', () => {
    const forged: LevelUpPlan = {
      ...planTo(3, [takes('hit-point', 2), takes('stress', 2)]),
      tier: 3,
    };
    expect(validatePlan(rogue(), forged).errors).toContain('Level 3 is tier 2, not tier 3.');
  });

  it('will not let a forged tier achievement clear the trait marks it is hiding behind', () => {
    // The achievement decides whether the marks are wiped before the picks are
    // read, so a plan at level 3 that claims level 5's achievement could take the
    // same two traits a second time. `validatePlan` reads the achievement off
    // the level rather than out of the plan, so both halves are caught: the lie,
    // and the trait it was told for.
    const marked = makeCharacter({ level: 2, traitMarks: { agility: 1 } });
    const forged: LevelUpPlan = {
      ...planTo(3, [takes('traits', 2, { traits: ['agility', 'strength'] }), takes('stress', 2)]),
      achievement: tierAchievementFor(5),
    };
    expect(validatePlan(marked, forged).errors).toEqual([
      'Level 3 has no tier achievement.',
      'agility is already marked this tier.',
    ]);

    // The other direction: a level that really does grant one, dropped.
    const dropped: LevelUpPlan = {
      ...planTo(5, [takes('hit-point', 3), takes('stress', 3)]),
      achievement: null,
    };
    expect(validatePlan(makeCharacter({ level: 4 }), dropped).errors).toEqual([
      "Level 5's tier achievement is missing from this plan.",
    ]);

    // TEETH: at the level that really clears the marks, the same marked trait is
    // allowed. So the refusal above is the forgery, not a blanket ban on agility.
    expect(
      validatePlan(
        makeCharacter({ level: 4, traitMarks: { agility: 1 } }),
        planTo(5, [takes('traits', 3, { traits: ['agility', 'strength'] }), takes('stress', 3)]),
      ).errors,
    ).toEqual([]);
  });

  it('refuses to multiclass twice, or without the three choices multiclassing needs', () => {
    const level4 = makeCharacter({ level: 4 });
    const full = { classRef: 'other-class', domain: 'blade', subclassRef: 'other-subclass' };

    expect(
      validatePlan(
        makeCharacter({ level: 4, multiclassRef: 'bard' }),
        planTo(5, [takes('multiclass', 3, full)]),
      ).errors,
    ).toEqual(['You have already multiclassed.']);

    expect(validatePlan(level4, planTo(5, [takes('multiclass', 3)])).errors).toEqual([
      'Choose the class to multiclass into.',
      'Choose which of its domains you gain access to.',
      'Choose a foundation card from one of its subclasses.',
    ]);

    // Taking the upgraded subclass card in a tier crosses out that tier's
    // multiclass option, and the sheet remembers which tier it was taken in.
    const tookSubclass = makeCharacter({
      level: 4,
      levelUpHistory: [advancement('subclass', 'subclass', 3, 4, { subclassRef: 'x' })],
    });
    expect(validatePlan(tookSubclass, planTo(5, [takes('multiclass', 3, full)])).errors).toEqual([
      "The upgraded subclass advancement at tier 3 crossed out that tier's multiclass option.",
    ]);

    // Control: an unmulticlassed character with all three choices is accepted.
    expect(validatePlan(level4, planTo(5, [takes('multiclass', 3, full)])).ok).toBe(true);
  });

  it('does not check the domain card at all - that guard lives in the picker', () => {
    // UNGUARDED (finding). `validatePlan` never looks at `plan.newCardRef`, and
    // never looks at a domain-card advancement's `cardRef`. A plan handing a
    // two-domain class a card from a third domain, and a level 10 card to a
    // level 3 character, is `ok: true` with no warnings, and `applyLevelUp` puts
    // both in the vault.
    //
    // What stops it in the app is the picker: `CardPicker` in
    // src/ui/build/LevelUp.tsx lists only cards satisfying
    // `stats.domains.includes(c.domain) && c.level <= stats.cardLevelCap(...)`,
    // the same rule `cardAvailability` states. So the rule is enforced where the
    // choice is offered and not where the plan is checked, and anything that
    // builds a plan by another route inherits no check at all.
    const dataset = makeDataset({
      classes: [makeClass({ id: 'test-class', domains: ['blade', 'valor'] })],
      domainCards: [
        makeCard({ id: 'off-domain', domain: 'codex', level: 1 }),
        makeCard({ id: 'too-high', domain: 'blade', level: 10 }),
      ],
    });
    const index = indexDataset(dataset);
    const student = makeCharacter({ level: 2 });
    const plan = planTo(
      3,
      [takes('domain-card', 2, { cardRef: 'off-domain' }), takes('hit-point', 2)],
      'too-high',
    );

    const verdict = validatePlan(student, plan);
    expect(verdict.errors).toEqual([]);
    expect(verdict.warnings).toEqual([]);
    expect(verdict.ok).toBe(true);

    const after = applyLevelUp(student, plan);
    expect(after.vault).toEqual(['off-domain', 'too-high']);

    // TEETH for the finding: the layer that does know says both are illegal, in
    // the words the card browser prints beside them. If `validatePlan` ever
    // grows the check, `verdict.ok` above turns red and this comment is rewritten.
    const rows = cardAvailability(after, deriveStats(after, dataset, index), dataset.domainCards);
    expect(rows.map((r) => [r.card.id, r.eligible, r.reason])).toEqual([
      ['off-domain', false, 'Not one of your domains'],
      ['too-high', false, 'Level 10 - your cap in blade is 3'],
    ]);
    // Both are owned, which is the harm: they are on the sheet, and only a
    // dimmed line in the browser says they should not be.
    expect(rows.every((r) => r.owned)).toBe(true);
  });

  it('cannot push the loadout past five, because a level-up only ever writes to the vault', () => {
    const cards = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const full = makeCharacter({ level: 2, loadout: cards, vault: [] });
    const after = applyLevelUp(
      full,
      planTo(3, [takes('domain-card', 2, { cardRef: 'c6' }), takes('hit-point', 2)], 'c7'),
    );
    expect(after.loadout).toEqual(cards);
    expect(after.loadout.length).toBe(MAX_LOADOUT);
    expect(after.vault).toEqual(['c6', 'c7']);
  });

  it('is the only thing standing between a forged plan and the sheet', () => {
    // `applyLevelUp` documents that it assumes a validated plan, and it means
    // it: no bounds check, no re-validation, no throw. That is the contract, not
    // a bug - but a suite that never demonstrated it would leave a reader
    // believing the engine refuses whatever the validator refuses.
    const veteran = makeCharacter({ level: MAX_LEVEL, multiclassRef: 'bard' });
    const forged = planTo(MAX_LEVEL + 1, [
      takes('multiclass', 4, { classRef: 'druid', domain: 'sage', subclassRef: 'warden' }),
    ]);
    const verdict = validatePlan(veteran, forged);
    expect(verdict.errors).toEqual(['Level 10 is the maximum.', 'You have already multiclassed.']);

    const applied = applyLevelUp(veteran, forged);
    expect(applied.level).toBe(MAX_LEVEL + 1);
    expect(applied.multiclassRef).toBe('druid');
    // The caller is the guard, and src/ui/build/LevelUp.tsx:154 is where it
    // stands: `if (!validation.ok) return;` before applyLevelUp is ever reached.
  });
});

// ===========================================================================
// 4. A SIXTH CARD ASKED INTO A FIVE-CARD LOADOUT
// ===========================================================================

describe('a sixth card asked into a five-card loadout', () => {
  const card = (id: string, recallCost = 1): DomainCard => makeCard({ id, recallCost });
  const five = ['c1', 'c2', 'c3', 'c4', 'c5'];

  it('is refused by name, in the sentence the player is shown', () => {
    const sheet = makeCharacter({ loadout: five, vault: ['c6'] });
    const check = canAddToLoadout(sheet, card('c6'));
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('Loadout is full (5) - move a card to the vault first');
    expect(check.stressCost).toBe(0);

    // Control: move one card out and the same sixth card is allowed, at its
    // Recall Cost - so the refusal is the limit and not the card.
    const room = makeCharacter({ loadout: five.slice(0, 4), vault: ['c6'] });
    const allowed = canAddToLoadout(room, card('c6', 2));
    expect(allowed.allowed).toBe(true);
    expect(allowed.reason).toBeNull();
    expect(allowed.stressCost).toBe(2);
  });

  it('is refused silently by recallCard, which is why the reason has to be asked for first', () => {
    const sheet = makeCharacter({ loadout: five, vault: ['c6'] });
    const result = recallCard(sheet, card('c6'));
    // The very same object comes back: no copy, no change, and no reason at all.
    expect(result.character).toBe(sheet);
    expect(result.stressMarked).toBe(0);
    expect(result.hpMarked).toBe(0);
    expect(result.character.loadout.length).toBe(MAX_LOADOUT);
  });

  it('refuses a card that is not in the vault, so a Stress can never buy a new one', () => {
    const sheet = makeCharacter({ loadout: [], vault: [] });
    expect(canAddToLoadout(sheet, card('anything-in-the-book')).reason).toBe('Not in your vault');
    expect(recallCard(sheet, card('anything-in-the-book')).character).toBe(sheet);
    // Control: put the same card in the vault and the same call is allowed.
    expect(canAddToLoadout(makeCharacter({ vault: ['x'] }), card('x')).allowed).toBe(true);
  });

  it('lets an unaffordable recall through, and charges the shortfall in Hit Points', () => {
    // UNGUARDED, and deliberately so: `affordable` is advice, not a refusal. The
    // app proposes a cost and the player confirms it. Asserted here because a
    // reader who saw `affordable: false` would reasonably assume it blocked, and
    // because the price of being wrong is three Hit Points nobody agreed to.
    const spent = makeCharacter({
      vault: ['expensive'],
      stress: { marked: 6, max: 6 },
      hp: { marked: 0, max: 6 },
    });
    const check = canAddToLoadout(spent, card('expensive', 3));
    expect(check.affordable).toBe(false);
    expect(check.allowed).toBe(true);

    const paid = recallCard(spent, card('expensive', 3));
    expect(paid.character.loadout).toEqual(['expensive']);
    expect(paid.stressMarked).toBe(0);
    expect(paid.hpMarked).toBe(3);
    expect(paid.character.hp.marked).toBe(3);
  });
});

// ===========================================================================
// 5. GEAR A LEVEL HAS NOT REACHED
// ===========================================================================

describe.skipIf(!hasDataset())('gear a level has not reached', () => {
  const dataset = hasDataset() ? loadDataset() : makeDataset();

  it('says exactly why each tier is out of reach, and stops saying it at the unlocking level', () => {
    expect(tierNote(1, 1)).toBeNull();
    expect(tierNote(2, 1)).toBe('Tier 2 — usable from level 2');
    expect(tierNote(3, 1)).toBe('Tier 3 — usable from level 5');
    expect(tierNote(4, 1)).toBe('Tier 4 — usable from level 8');

    // The boundary from both sides, for every tier: silent at the first level of
    // the tier, speaking at the level below it.
    for (const tier of [2, 3, 4] as Tier[]) {
      const at = tierLevel(tier);
      expect(tierNote(tier, at), `tier ${tier} at level ${at}`).toBeNull();
      expect(tierNote(tier, at - 1), `tier ${tier} at level ${at - 1}`).toBe(
        `Tier ${tier} — usable from level ${at}`,
      );
    }
    expect([tierLevel(1), tierLevel(2), tierLevel(3), tierLevel(4)]).toEqual([1, 2, 5, 8]);
  });

  it('marks a tier 4 weapon and a tier 4 armor on a level 1 sheet rather than hiding them', () => {
    const weapons = filterWeapons(dataset.weapons, weaponQuery(), 1);
    const armors = filterArmors(dataset.armors, armorQuery(), 1);
    expect(weapons.length).toBe(dataset.weapons.length);
    expect(armors.length).toBe(dataset.armors.length);

    const farWeapons = weapons.filter((r) => r.item.tier === 4);
    const farArmors = armors.filter((r) => r.item.tier === 4);
    expect(farWeapons.length).toBe(56);
    expect(farArmors.length).toBe(10);
    for (const r of [...farWeapons, ...farArmors]) {
      expect(r.eligible, r.item.name).toBe(false);
      expect(r.reason, r.item.name).toBe('Tier 4 — usable from level 8');
    }

    // Control: the same lists at level 8 have nothing out of reach, so the
    // reason is the level and not the row.
    expect(filterWeapons(dataset.weapons, weaponQuery(), 8).every((r) => r.eligible)).toBe(true);
    expect(filterArmors(dataset.armors, armorQuery(), 8).every((r) => r.eligible)).toBe(true);
  });

  it('hides out of reach gear only when asked to, and the count says how much it hid', () => {
    const usable = (level: number): number =>
      filterWeapons(dataset.weapons, { ...weaponQuery(), reach: 'usable' }, level).length;
    const counts = [1, 2, 5, 8].map((level) => [level, usable(level)] as const);
    // The four levels where the tier line actually moves. The full table - all
    // ten levels, weapons and armors both - is asserted and printed once, by
    // `tests/ui/gear.test.ts`; printing it here too would read as two
    // independent measurements of the catalogue when it is one.
    expect(counts).toEqual([
      [1, 35],
      [2, 91],
      [5, 148],
      [8, 204],
    ]);
    expect(filterArmors(dataset.armors, { ...armorQuery(), reach: 'usable' }, 1).length).toBe(4);
    // Nothing was lost, only hidden: what 'usable' drops at level 1 is exactly
    // what 'all' marks as out of reach there.
    const all = filterWeapons(dataset.weapons, weaponQuery(), 1);
    expect(all.filter((r) => r.eligible).length).toBe(35);
    expect(all.length - 35).toBe(dataset.weapons.length - usable(1));
  });

  it('still equips the tier 4 armor, and gives a level 1 sheet every number printed on it', () => {
    // UNGUARDED, and stated as policy at the top of src/ui/build/gear.ts: "A GM
    // who hands a level 2 party a tier 4 sword has not broken a rule this app is
    // entitled to enforce." So the picker dims the row, prints the reason, and
    // fires `onPick` anyway - there is no `disabled` on that button - and the
    // engine then applies the armor in full. The guard is a sentence, not a lock.
    const armor = [...dataset.armors]
      .filter((a) => a.tier === 4)
      .sort((a, b) => b.baseScore - a.baseScore)[0]!;
    const index = indexDataset(dataset);
    const novice = newCharacter({
      classRef: dataset.classes[0]!.id,
      level: 1,
      activeArmor: armor.id,
    });
    const stats = deriveStats(novice, dataset, index);

    expect(stats.thresholds).toEqual([armor.baseThresholds[0] + 1, armor.baseThresholds[1] + 1]);
    expect(stats.armorScore).toBe(Math.min(MAX_ARMOR_SCORE, armor.baseScore));
    expect(syncCounters(novice, stats).armorSlots).toEqual({ marked: 0, max: stats.armorScore });
    // The one thing standing between the player and a surprise is the line the
    // slot prints behind the picker.
    expect(tierNote(armor.tier, novice.level)).toBe('Tier 4 — usable from level 8');

    // Control: unequip it and the same level 1 sheet is back to [level, 2 x level].
    const bare = deriveStats({ ...novice, activeArmor: null }, dataset, index);
    expect(bare.thresholds).toEqual([1, 2]);
    expect(bare.armorScore).toBe(0);
  });
});

// ===========================================================================
// 6. NUMBERS PAST THE ENDS OF THEIR TRACKS
// ===========================================================================

describe('numbers past the ends of their tracks', () => {
  const dataset = makeDataset({
    classes: [makeClass({ startingHitPoints: 6, startingEvasion: 10 })],
    subclasses: [makeSubclass()],
    armors: [makeArmor({ id: 'reasonable-armor' }), makeArmor({ id: 'absurd-armor', baseScore: 40 })],
  });
  const index = indexDataset(dataset);
  const many = (kind: 'hitPoint' | 'stress', n: number): Character['levelUpHistory'] =>
    Array.from({ length: n }, (_u, i) =>
      advancement(kind, kind === 'hitPoint' ? 'hit-point' : 'stress', 2, 2 + (i % 3)),
    );

  it('CLAMPS Hit Points and Stress at twelve, however many advancements bought them', () => {
    const greedy = makeCharacter({
      levelUpHistory: [...many('hitPoint', 20), ...many('stress', 20)],
    });
    const stats = deriveStats(greedy, dataset, index);
    expect(stats.maxHp).toBe(MAX_HP);
    expect(stats.maxStress).toBe(MAX_STRESS);
    // Control: one advancement each raises them by exactly one, so the twelve
    // above is a ceiling and not a constant.
    const modest = makeCharacter({ levelUpHistory: [...many('hitPoint', 1), ...many('stress', 1)] });
    const small = deriveStats(modest, dataset, index);
    expect([small.maxHp, small.maxStress]).toEqual([7, 7]);
  });

  it('REWRITES a hand-set maximum rather than believing it, at the next syncCounters', () => {
    // A file, a bad merge or a text editor can put anything in `hp.max`. The
    // stored number is never trusted: it is replaced by the derived one, and
    // `marked` is pulled down with it.
    const inflated = makeCharacter({ hp: { marked: 99, max: 99 }, stress: { marked: 50, max: 50 } });
    const stats = deriveStats(inflated, dataset, index);
    expect(syncCounters(inflated, stats).hp).toEqual({ marked: 6, max: 6 });
    expect(syncCounters(inflated, stats).stress).toEqual({ marked: 6, max: 6 });
    // Control: a count already inside the range passes through untouched.
    expect(syncCounters(makeCharacter({ hp: { marked: 2, max: 6 } }), stats).hp).toEqual({
      marked: 2,
      max: 6,
    });
  });

  it('CLAMPS armor score at twelve, and does NOT clamp the thresholds beside it', () => {
    const absurd = makeCharacter({ activeArmor: 'absurd-armor', level: 1 });
    const stats = deriveStats(absurd, dataset, index);
    expect(stats.armorScore).toBe(MAX_ARMOR_SCORE);
    // UNGUARDED, by design: there is no MAX_THRESHOLD, because a threshold is
    // whatever the armor prints plus the level. Written down so the asymmetry
    // with the score beside it reads as a decision rather than an oversight.
    expect(stats.thresholds).toEqual([6, 12]);
    expect(stats.massiveThreshold).toBe(24);
    // Control: an armor inside the range keeps its own score.
    expect(
      deriveStats(makeCharacter({ activeArmor: 'reasonable-armor' }), dataset, index).armorScore,
    ).toBe(4);
  });

  it('does NOT clamp a Hope count below zero, by any path it can take', () => {
    // UNGUARDED (finding). `syncCounters` clamps every track downward against
    // its maximum - `Math.min(marked, max)` - and nothing clamps upward from
    // zero. A sheet carrying `hope.marked: -3` keeps it, renders a negative
    // Hope, and answers "can I afford this" with no forever. The same hole is in
    // hp.marked and stress.marked.
    const underwater = makeCharacter({
      hope: { marked: -3, max: 6 },
      hp: { marked: -2, max: 6 },
      stress: { marked: -1, max: 6 },
    });
    const synced = syncCounters(underwater, deriveStats(underwater, dataset, index));
    expect(synced.hope.marked).toBe(-3);
    expect(synced.hp.marked).toBe(-2);
    expect(synced.stress.marked).toBe(-1);
    // TEETH: the same call pulls an over-maximum count down, so it is clamping.
    // It just only clamps one end.
    const overflowing = makeCharacter({ hope: { marked: 99, max: 6 } });
    expect(syncCounters(overflowing, deriveStats(overflowing, dataset, index)).hope.marked).toBe(6);
  });

  it('FLOORS max Hope at zero when the scars outnumber the slots', () => {
    const ruined = makeCharacter({ scars: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    const stats = deriveStats(ruined, dataset, index);
    expect(stats.maxHope).toBe(0);
    expect(syncCounters(ruined, stats).hope).toEqual({ marked: 0, max: 0 });
    // Control: every scar before the seventh costs exactly one slot, so the zero
    // is a floor rather than a collapse.
    expect(
      [0, 1, 2, 3, 4, 5, 6].map((n) => {
        const scarred = makeCharacter({ scars: Array.from({ length: n }, (_u, i) => `scar ${i}`) });
        return deriveStats(scarred, dataset, index).maxHope;
      }),
    ).toEqual([6, 5, 4, 3, 2, 1, 0]);
  });

  it('refuses to PLAN past level 10 and then computes a level 11 sheet without a murmur', () => {
    // UNGUARDED (finding). `MAX_LEVEL` is enforced in exactly one place -
    // `validatePlan` - and `deriveStats` will happily describe a level 11, a
    // level 0 or a level -5 character, thresholds and all. Nothing between them
    // checks, so any future route to `level` that is not the level-up screen
    // inherits no bound at all.
    const impossible = [11, 0, -5].map((level) => {
      const stats = deriveStats(makeCharacter({ level }), dataset, index);
      return { level, tier: stats.tier, thresholds: stats.thresholds, proficiency: stats.proficiency };
    });
    expect(impossible).toEqual([
      { level: 11, tier: 4, thresholds: [11, 22], proficiency: 4 },
      { level: 0, tier: 1, thresholds: [0, 0], proficiency: 1 },
      { level: -5, tier: 1, thresholds: [-5, -10], proficiency: 1 },
    ]);
    // TEETH: the one guard that does exist refuses, so the numbers above are a
    // gap between two layers rather than a rule nobody ever wrote down.
    expect(
      validatePlan(
        makeCharacter({ level: MAX_LEVEL }),
        planTo(MAX_LEVEL + 1, [takes('hit-point', 4), takes('stress', 4)]),
      ).errors,
    ).toEqual(['Level 10 is the maximum.']);
  });
});

describe('a counter below zero, over each of the two export vectors', () => {
  it('is zeroed by the QR codec and kept by the file, which do not agree', async () => {
    // UNGUARDED (finding). `writeCounter` does `Math.max(0, Math.trunc(...))`,
    // so a negative count is silently normalised on the way into a QR, while
    // `.dhchar` is plain JSON and keeps it. The codec's stated contract is that
    // everything except Experience ids round-trips exactly; this is a second,
    // undocumented exception. It only bites a sheet already holding an
    // impossible number - but which button the player pressed then decides what
    // their sheet says afterwards.
    const underwater = wizard({ hope: { marked: -3, max: 6 }, hp: { marked: -2, max: 7 } });

    const { character } = await decodeCharacter(
      await encodeCharacter(underwater, testRegistry),
      testRegistry,
    );
    expect(character.hope).toEqual({ marked: 0, max: 6 });
    expect(character.hp).toEqual({ marked: 0, max: 7 });

    const fromFile = parseCharacterFile(serializeCharacter(underwater));
    expect(fromFile.hope).toEqual({ marked: -3, max: 6 });
    expect(fromFile.hp).toEqual({ marked: -2, max: 7 });

    // TEETH: a sheet whose counts are in range comes back identical over both
    // vectors, so the divergence above is caused by the sign and nothing else.
    const ordinary = wizard();
    const back = await decodeCharacter(await encodeCharacter(ordinary, testRegistry), testRegistry);
    expect(back.character.hope).toEqual(ordinary.hope);
    expect(back.character.hp).toEqual(ordinary.hp);
    expect(parseCharacterFile(serializeCharacter(ordinary)).hope).toEqual(ordinary.hope);
  });
});

// ===========================================================================
// 7. A SHEET POINTING AT CONTENT THAT IS NOT THERE
// ===========================================================================

describe('a sheet pointing at content that is not there', () => {
  /** A sheet naming a class and a card that no dataset and no registry holds. */
  const stranger = (): Character =>
    wizard({
      classRef: 'sorcerer-of-the-void',
      loadout: ['a-card-that-was-never-printed'],
      vault: [],
      levelUpHistory: [],
      name: 'Vesper',
      notes: 'The tower burned in the spring.',
    });

  it('refuses to send it as a QR, and names every reference it could not put on the wire', async () => {
    const sheet = stranger();
    expect(missingSlugs(sheet, testRegistry)).toEqual([
      'a-card-that-was-never-printed',
      'sorcerer-of-the-void',
    ]);
    const error = await encodeCharacter(sheet, testRegistry).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnknownSlugError);
    expect((error as UnknownSlugError).slugs).toEqual([
      'a-card-that-was-never-printed',
      'sorcerer-of-the-void',
    ]);
    // The refusal points at the vector that would have worked.
    expect((error as UnknownSlugError).message).toContain('Export a .dhchar file instead');

    // Control: repair only those two references and the very same sheet goes on
    // the wire and comes back, so the refusal is about them and not the sheet.
    const repaired = wizard({ ...sheet, classRef: 'wizard', loadout: ['teleport'], vault: [] });
    expect(missingSlugs(repaired, testRegistry)).toEqual([]);
    const back = await decodeCharacter(
      await encodeCharacter(repaired, testRegistry),
      testRegistry,
    );
    expect(back.character.classRef).toBe('wizard');
    expect(back.character.loadout).toEqual(['teleport']);
    expect(back.character.name).toBe('Vesper');
  });

  it('keeps every other field when the class reference cannot be resolved', () => {
    const dataset = makeDataset();
    const index = indexDataset(dataset);
    const sheet = stranger();
    const stats = deriveStats(sheet, dataset, index);
    // The class is gone, so the numbers that came from it fall back - silently,
    // which is a choice worth having written down somewhere.
    expect(stats.evasion).toBe(10);
    expect(stats.maxHp).toBe(6);
    expect(stats.domains).toEqual([]);
    // Everything that did not come from the class is untouched.
    expect(stats.tier).toBe(tierOf(sheet.level));
    expect(stats.maxHope).toBe(6);
    expect(stats.thresholds).toEqual([sheet.level, sheet.level * 2]);
    // Control: a resolvable class gives its own numbers, so the values above are
    // the fallback path and not the only path.
    expect(deriveStats({ ...sheet, classRef: 'test-class' }, dataset, index).domains).toEqual([
      'blade',
      'valor',
    ]);
  });

  it('names a loadout card the dataset does not hold rather than dropping it', () => {
    const dataset = makeDataset({ domainCards: [makeCard({ id: 'known-card' })] });
    const index = indexDataset(dataset);
    const sheet = wizard({ loadout: ['known-card', 'a-card-that-was-never-printed'], vault: [] });
    expect(missingCardRefs(sheet, index)).toEqual(['a-card-that-was-never-printed']);
    // `resolveCards` drops what it cannot resolve, which is only safe because
    // `missingCardRefs` reports it alongside.
    expect(resolveCards(sheet.loadout, index).map((c) => c.id)).toEqual(['known-card']);
    // Control: a sheet the dataset covers reports nothing missing.
    expect(missingCardRefs(wizard({ loadout: ['known-card'], vault: [] }), index)).toEqual([]);
  });

  it('carries a reference of the wrong kind onto the wire, because the registry is kind-blind', () => {
    // UNGUARDED (finding, low). `missingSlugs` asks the registry whether a slug
    // has an id, not whether it is the right sort of thing. An adversary slug
    // sitting in a loadout has one - in the adversaries band, 10000 to 10999 -
    // so the "can this be a QR" check says yes and only the dataset lookup ever
    // notices. `bandOf` could tell the difference, and nothing calls it here.
    const dataset = makeDataset({ domainCards: [makeCard({ id: 'known-card' })] });
    const index = indexDataset(dataset);
    const muddled = wizard({ loadout: ['jagged-knife-lackey'], vault: [] });
    expect(testRegistry.idOf('jagged-knife-lackey') ?? 0).toBeGreaterThan(10_000);
    expect(missingSlugs(muddled, testRegistry)).toEqual([]);
    expect(characterRefs(muddled)).toContain('jagged-knife-lackey');
    // The engine is what catches it, one layer later.
    expect(missingCardRefs(muddled, index)).toEqual(['jagged-knife-lackey']);
  });

  it('keeps a dangling reference intact through the file, which is the vector that must not lose it', () => {
    const sheet = stranger();
    const back = parseCharacterFile(serializeCharacter(sheet));
    expect(back.classRef).toBe('sorcerer-of-the-void');
    expect(back.loadout).toEqual(['a-card-that-was-never-printed']);
    expect(back.name).toBe('Vesper');
    expect(back).toStrictEqual(sheet);
  });

  it('parks an id the receiving device cannot name, and gives it back when the content arrives', async () => {
    const sheet = wizard({ vault: [...wizard().vault, 'jagged-knife-lackey'] });
    const id = testRegistry.idOf('jagged-knife-lackey')!;
    const older = registryWithout('jagged-knife-lackey');

    const payload = await encodeCharacter(sheet, testRegistry);
    const { character, unresolved, warnings } = await decodeCharacter(payload, older);
    expect(unresolved).toEqual([id]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(String(id));
    // Parked inside the reference itself, never dropped, and nothing else moved.
    expect(character.vault).toContain(`?${id}`);
    expect(character.unresolvedRefs).toEqual([id]);
    expect(character.name).toBe(sheet.name);
    expect(character.classRef).toBe(sheet.classRef);
    expect(character.loadout).toEqual(sheet.loadout);

    // And when the content turns up, the id becomes a slug again and the parked
    // list is removed rather than left behind empty.
    const { character: healed, resolved } = resolvePlaceholders(character, testRegistry);
    expect(resolved).toEqual([id]);
    expect(healed.vault).toEqual(sheet.vault);
    expect('unresolvedRefs' in healed).toBe(false);

    // TEETH: with the full registry the same payload parks nothing, so the
    // parking above is caused by the missing entry and by nothing else.
    const complete = await decodeCharacter(payload, testRegistry);
    expect(complete.unresolved).toEqual([]);
    expect(complete.character.vault).toEqual(sheet.vault);
  });

  it('never resolves an id from the reserved range, whatever a registry might claim', async () => {
    // 60000 and up belongs to user content that does not exist yet. The decoder
    // parks one rather than guessing, which is what keeps a future homebrew card
    // from arriving as somebody else's SRD card.
    const parked = wizard({ vault: ['?60007'], unresolvedRefs: [60_007] });
    const payload = await encodeCharacter(parked, testRegistry);
    const { character, unresolved } = await decodeCharacter(payload, testRegistry);
    expect(character.vault).toEqual(['?60007']);
    expect(unresolved).toEqual([60_007]);
    expect(character.unresolvedRefs).toEqual([60_007]);
    // Re-encoding reproduces the same bytes, so a device in the middle of a
    // chain does not erode what it could not read.
    expect([...(await encodeCharacter(character, testRegistry))]).toEqual([...payload]);
    // Control: an ordinary id in the same slot resolves to its slug.
    const normal = wizard({ vault: ['teleport'] });
    const back = await decodeCharacter(await encodeCharacter(normal, testRegistry), testRegistry);
    expect(back.character.vault).toEqual(['teleport']);
    expect(back.unresolved).toEqual([]);
  });
});
