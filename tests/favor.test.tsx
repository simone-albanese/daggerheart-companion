/**
 * The Warlock's Favor track: the field, the two seeds, and the wire.
 *
 * The class feature is two sentences and they pull in different directions:
 * *"You start with 3 Favor"* and *"The maximum Favor you can hold at one time
 * is 6."* The first is about a character being MADE and the second is about one
 * being PLAYED, and this build answers them in different places on purpose -
 * `newCharacter()` seeds three, the 8 -> 9 converter seeds none. That split is
 * the owner's decision and it is the thing most likely to be "tidied" by a
 * later hand, so it is pinned from both ends.
 *
 * What is NOT here: the row under Vitals, the Patron Die in `dicePools`, and
 * the offer on the Duality Roll. This lane carries the field and the format so
 * that the work which draws them does not have to bump a schema to get a
 * number stored.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FAVOR, SCHEMA_VERSION } from '../shared/types.ts';
import { MIGRATIONS, migrateCharacterRecord } from '../shared/migrations.ts';
import { COUNTER_CEILINGS, newCharacter } from '../src/engine/character.ts';
import { CODEC_VERSION, decodeCharacter, encodeCharacter } from '../src/transfer/codec.ts';
import { normalizeHandles, testRegistry, wizard } from './transfer/fixtures.ts';

// ---------------------------------------------------------------------------
// The two seeds
// ---------------------------------------------------------------------------

describe('where the three Favor come from, and where they do not', () => {
  it('gives a brand-new character three, because that is where "you start with" points', () => {
    expect(newCharacter().favor).toEqual({ marked: 3, max: MAX_FAVOR });
  });

  it('gives an existing character none, because a migration is not a beginning', () => {
    /*
     * The half a converter cannot get back if it guesses wrong. An update lands
     * at whatever moment a player opens the app - mid-scene as easily as
     * between sessions - and three Favor handed over then is a resource nobody
     * watched them earn. Seeding zero is recoverable by one tap; seeding three
     * is a number a table has to notice before it can be taken away.
     */
    const before: Record<string, unknown> = {
      schemaVersion: 8,
      name: 'Fixture',
      focus: { marked: 2, max: 6 },
      scars: ['A ledger of names'],
    };
    const after = migrateCharacterRecord(before);
    expect(after.from).toBe(8);
    expect(after.applied).toEqual([
      'a character can hold Favor, and an existing one starts holding none',
    ]);
    expect(after.record['favor']).toEqual({ marked: 0, max: MAX_FAVOR });
    // Converting is not rewriting: nothing else on the record moved.
    expect(after.record['name']).toBe('Fixture');
    expect(after.record['focus']).toEqual({ marked: 2, max: 6 });
    expect(after.record['scars']).toEqual(['A ledger of names']);
    expect(after.record['schemaVersion']).toBe(SCHEMA_VERSION);
  });

  it('ships the converter the version policy requires, keyed on the version it leaves', () => {
    expect(SCHEMA_VERSION).toBe(9);
    expect(MIGRATIONS.map((m) => m.from)).toContain(8);
  });

  it('overwrites a schema-9 field found on a record that claims to be schema 8', () => {
    // The `from: 3` converter's rule, applied here: a record stamped 8 that
    // carries a schema-9 field is a record whose own header is wrong, and
    // believing the field over the header lets a hand-edited file decide what
    // the schema means.
    const after = migrateCharacterRecord({
      schemaVersion: 8,
      name: 'Fixture',
      favor: { marked: 6, max: 6 },
    });
    expect(after.record['favor']).toEqual({ marked: 0, max: MAX_FAVOR });
  });
});

// ---------------------------------------------------------------------------
// The ceiling
// ---------------------------------------------------------------------------

describe('the ceiling', () => {
  it('is the rules number and is read from one place', () => {
    expect(MAX_FAVOR).toBe(6);
    expect(COUNTER_CEILINGS.favor).toBe(MAX_FAVOR);
    // Six here and six for Focus is two class features agreeing, not one rule,
    // so they are two constants - and this says so rather than leaving a reader
    // to assume a shared one would have been simpler.
    expect(COUNTER_CEILINGS.focus).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

describe('the wire', () => {
  it('carries the track, and back', async () => {
    const before = wizard({ favor: { marked: 4, max: MAX_FAVOR } });
    const payload = await encodeCharacter(before, testRegistry);
    expect(payload[1], 'format 9 or later').toBe(CODEC_VERSION);
    const { character, warnings } = await decodeCharacter(payload, testRegistry);
    expect(character.favor).toEqual({ marked: 4, max: MAX_FAVOR });
    expect(warnings).toEqual([]);
    expect(normalizeHandles(character)).toEqual(normalizeHandles(before));
  });

  it('tells an empty track apart from a full one, which a dropped field could not', async () => {
    // Teeth for the round-trip above: if `writeBody` wrote nothing and
    // `readBody` seeded a constant, both of these would come back the same.
    for (const marked of [0, 1, 5, 6]) {
      const back = await decodeCharacter(
        await encodeCharacter(wizard({ favor: { marked, max: MAX_FAVOR } }), testRegistry),
        testRegistry,
      );
      expect(back.character.favor, `marked ${marked}`).toEqual({ marked, max: MAX_FAVOR });
    }
  });

  it('refuses a seventh Favor box by name rather than clamping it', async () => {
    /*
     * `readCounter` and not a bare pair of varints, which is the same choice
     * every other track on the wire gets. A silently clamped track is a
     * plausible character read out of a damaged payload, and that is the one
     * outcome the codec exists to avoid.
     *
     * The encoder seals these bytes, so what refuses them is the ceiling and
     * not the checksum sitting in front of it.
     */
    for (const [patch, sentence] of [
      [{ marked: 0, max: 7 }, /Favor track has a maximum of 7, and 6 is the most/],
      [{ marked: 1048576, max: 6 }, /Favor track has a marked count of 1048576/],
    ] as const) {
      const payload = await encodeCharacter(wizard({ favor: patch }), testRegistry);
      await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(sentence);
      await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(/nothing has been imported/i);
    }
    // Control: the ceiling itself is a legal sheet, so the bound is exactly
    // where the rules put it and not one below.
    const back = await decodeCharacter(
      await encodeCharacter(wizard({ favor: { marked: 6, max: 6 } }), testRegistry),
      testRegistry,
    );
    expect(back.character.favor).toEqual({ marked: 6, max: 6 });
  });

  it('reads an empty track out of a format-8 payload, because there was nothing there', async () => {
    /*
     * Zero and NOT the three `newCharacter` seeds, and the difference is the
     * same one the converter makes. A payload written by a build with no Favor
     * field came from a table that was holding none; three would be the decoder
     * inventing a resource for an arriving sheet.
     *
     * Asserted on bytes the previous build actually wrote - see
     * `tests/wideHeader.test.ts` for where they came from - rather than on a
     * payload this build relabelled, because a relabelled one would be a
     * format-9 body wearing a format-8 header and no build has ever written
     * that.
     */
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const bytes = Uint8Array.from(
      Buffer.from(
        readFileSync(
          fileURLToPath(new URL('./fixtures/codec/wizard.codec8.b64', import.meta.url)),
          'utf8',
        ).trim(),
        'base64',
      ),
    );
    expect(bytes[0]! & 0x0f, 'the committed bytes are format 8').toBe(8);
    const { character } = await decodeCharacter(bytes, testRegistry);
    expect(character.favor).toEqual({ marked: 0, max: MAX_FAVOR });
    expect(character.favor).not.toEqual(newCharacter().favor);
  });
});
