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
 * **And it is a WARLOCK's sheet that starts with three.** The first version of
 * this file asserted `newCharacter().favor` was three and shipped, so a Bard, a
 * Guardian and a Druid were all born holding a resource only one class has -
 * a defect an assertion written from the seed rather than from the rules could
 * not see. What replaces it is a set: one sheet per class, all thirteen named,
 * so a fourteenth class arriving in a dataset fails here rather than quietly
 * joining whichever side the loop happened to default to.
 *
 * What is NOT here: the row under Vitals, the Patron Die in `dicePools`, and
 * the offer on the Duality Roll. This lane carries the field and the format so
 * that the work which draws them does not have to bump a schema to get a
 * number stored.
 */
import { describe, expect, it } from 'vitest';
import { MAX_FAVOR, SCHEMA_VERSION } from '../shared/types.ts';
import { MIGRATIONS, migrateCharacterRecord } from '../shared/migrations.ts';
import { COUNTER_CEILINGS, grantsFavor, indexDataset, newCharacter } from '../src/engine/character.ts';
import { hasDataset, loadDataset } from '../tools/sampleCharacters.ts';
import { feature, makeClass, makeDataset } from './fixtures/factories.ts';
import { parseCharacterFile } from '../src/transfer/fileIo.ts';
import { CODEC_VERSION, decodeCharacter, encodeCharacter } from '../src/transfer/codec.ts';
import { normalizeHandles, testRegistry, wizard } from './transfer/fixtures.ts';

// ---------------------------------------------------------------------------
// The two seeds
// ---------------------------------------------------------------------------

/**
 * A class that grants Favor and one that does not, with the ids swapped round.
 *
 * `warlockish` is not called `warlock` and `plain` IS reachable by a ref a
 * hand-written check would trust, so a `classRef === 'warlock'` seeded here
 * would get both of them wrong at once. That is the point of the pair: the
 * question is answered by the dataset, and these two prove it by disagreeing
 * with their own ids.
 */
const WARLOCKISH = makeClass({
  id: 'warlockish',
  name: 'Occultist',
  classFeatures: [
    { name: "Patron's Pact", text: 'Before an action roll you can spend a Favor.' },
    { name: 'Favor', text: 'You start with 3 Favor.' },
  ],
});
const PLAIN = makeClass({ id: 'plain', name: 'Plain', classFeatures: [feature('Rally')] });
const LAYER = indexDataset(makeDataset({ classes: [WARLOCKISH, PLAIN] }));

/** A brand-new sheet for a class that grants Favor, with no SRD file needed. */
const newWarlock = () => newCharacter({ classRef: 'warlockish' }, LAYER);

describe('which class the three belong to, asked of the dataset', () => {
  const seededBy = (...classFeatures: { name: string; text: string }[]): number =>
    newCharacter(
      { classRef: 'probe' },
      indexDataset(makeDataset({ classes: [makeClass({ id: 'probe', classFeatures })] })),
    ).favor.marked;

  it('follows the class feature and not the ref, in both directions', () => {
    /*
     * A layer that renames the Warlock keeps the track, and a layer that puts
     * the id `warlock` on something with no Favor feature does not get one.
     * Both halves matter: the first is what `hasBeastform` was written this way
     * for, and the second is what stops a ref check from being "close enough".
     */
    expect(grantsFavor(WARLOCKISH)).toBe(true);
    expect(newWarlock().favor.marked).toBe(3);
    const impostor = makeClass({ id: 'warlock', name: 'Warlock', classFeatures: [feature('Rally')] });
    expect(grantsFavor(impostor)).toBe(false);
    expect(newCharacter({ classRef: 'warlock' }, indexDataset(makeDataset({ classes: [impostor] }))).favor.marked).toBe(0);
  });

  it('reads the feature NAME, so a sentence that merely uses the word grants nothing', () => {
    /*
     * The Warlock's OTHER feature, Patron's Pact, says *"spend a Favor"* in its
     * text. Matching on text would therefore be satisfied by any homebrew
     * feature that used the English word in a sentence, and a false positive
     * here puts a resource on a sheet that should not have one - which is the
     * exact defect this predicate was written to end. A false negative costs
     * one tap.
     */
    expect(seededBy({ name: 'Wildtouch', text: 'You curry favor with the local spirits.' })).toBe(0);
    expect(seededBy({ name: 'Favor', text: 'A feature whose text says nothing.' })).toBe(3);
  });

  it('holds the word boundary, because the stances chapter really does print "Favored"', () => {
    // `/\bfavor\b/i` and not `/favor/i`. Tier 1 of the Martial Stances is
    // "Favored, Invigorating, Quick, Reliable" - see `shared/parsers/stances.ts`
    // - so a class feature borrowing that word must not seed a Warlock's track.
    for (const name of ['Favored', 'Favoritism', 'Disfavor', 'Favours']) {
      expect(seededBy({ name, text: 'A feature.' }), name).toBe(0);
    }
    // And the rename it IS meant to survive.
    expect(seededBy({ name: "Patron's Favor", text: 'A feature.' })).toBe(3);
  });

  it('says no when there is no class at all, rather than throwing', () => {
    expect(grantsFavor(undefined)).toBe(false);
    expect(grantsFavor(PLAIN)).toBe(false);
  });
});

describe('where the three Favor come from, and where they do not', () => {
  it.skipIf(!hasDataset())(
    'gives a brand-new Warlock three and every other class none, one sheet per class',
    () => {
      const dataset = loadDataset();
      const ix = indexDataset(dataset);
      const held = Object.fromEntries(
        dataset.classes.map((k) => [k.id, newCharacter({ classRef: k.id }, ix).favor.marked]),
      );
      /*
       * Written out as a SET and not as a loop with a `k.id === 'warlock'`
       * branch in it, for the reason the Hit Point seeds next door are written
       * out: a branch inside the assertion agrees with whatever the code under
       * test decided, and this is the assertion the previous version of this
       * file got wrong. Twelve zeroes have to be typed for a fourteenth class
       * to be able to fail here.
       */
      expect(held).toEqual({
        assassin: 0,
        bard: 0,
        brawler: 0,
        druid: 0,
        guardian: 0,
        ranger: 0,
        rogue: 0,
        seraph: 0,
        sorcerer: 0,
        warlock: 3,
        warrior: 0,
        witch: 0,
        wizard: 0,
      });
      // Teeth on the shape of that object, so a dataset that lost twelve
      // classes could not pass it by having nothing left to disagree.
      expect(Object.keys(held)).toHaveLength(13);
      expect(Object.values(held).filter((n) => n === 3)).toHaveLength(1);

      // The TRACK is on all thirteen even though the Favor is on one - the
      // argument is on `Character.favor`, and it is what lets
      // `readCharacterRecord` tell "has no Favor" from "lost its Favor".
      for (const k of dataset.classes) {
        expect([k.id, newCharacter({ classRef: k.id }, ix).favor.max]).toEqual([k.id, MAX_FAVOR]);
      }
    },
  );

  it('gives a Warlock none when there is no index to look the class up in', () => {
    /*
     * The accepted degradation, said out loud rather than left to be met. The
     * index is optional and `hp` already falls back the same way - six for a
     * class that starts on five - so this is that limit and not a new one.
     * Every path that PERSISTS a character passes an index; the callers that
     * do not are preview sheets that read `deriveStats` and are discarded.
     */
    expect(newCharacter({ classRef: 'warlock' }).favor).toEqual({ marked: 0, max: MAX_FAVOR });
    expect(newCharacter().favor).toEqual({ marked: 0, max: MAX_FAVOR });
  });

  it('does not read the multiclass, because a level-5 pact is not a beginning', () => {
    /*
     * `hasBeastform` DOES read `multiclassRef`, and this deliberately does not.
     * The two ask different questions: that one asks what a character can do
     * now, this one asks what a sheet is created holding. Multiclassing happens
     * at level 5, to somebody already playing - which is the case the 8 -> 9
     * converter seeds ZERO for, on the argument on `SCHEMA_VERSION`.
     */
    const c = newCharacter({ classRef: 'plain', multiclassRef: 'warlockish', level: 5 }, LAYER);
    expect(c.favor).toEqual({ marked: 0, max: MAX_FAVOR });
    // Control: the same class in the FIRST slot does grant it, so the zero
    // above is about which slot was read and not about the fixture.
    expect(newWarlock().favor.marked).toBe(3);
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
    // Against a NEW WARLOCK'S sheet, which is the only sheet that seeds three.
    // This used to read `newCharacter()`, and that comparison stopped having
    // teeth the moment a classless blank sheet started at zero as well.
    expect(character.favor).not.toEqual(newWarlock().favor);
  });
});

// ---------------------------------------------------------------------------
// The four guard lists
// ---------------------------------------------------------------------------

/**
 * THE COMPARISON, WHICH IS THE ONLY WAY TO KNOW A LIST IS COMPLETE.
 *
 * Three waves in a row have shipped a new `Character` field that skipped a
 * guard its siblings have: `transformationRef` was not in `checkShapes`,
 * `focus` was not read through `readCounter` and not clamped by
 * `boundCounters`, and `favor` was measured with the same hole before this
 * commit - `{ favor: 'not a counter' }` accepted, and the string stored in a
 * field typed `Counter`.
 *
 * So the test is not "is `favor` guarded", which any assertion can be written
 * to say yes to. It is **does `favor` answer the identical abuse the identical
 * way `hp` does**, run side by side, one loop, no per-track branches. A hole in
 * any list shows up as a disagreement rather than as a missing assertion
 * somebody has to notice is missing.
 *
 * The four doors, and where each is proved:
 *
 *   1. `readCounter` inside `readCharacterRecord` .... here
 *   2. the keys of `checkShapes` ..................... here, and the answer is
 *      that no character-level Counter is in it - see the block below
 *   3. `boundCounters` in `src/store/state.ts` ....... `tests/store/import.test.ts`
 *      ("holds the Favor ceiling on the way in"), which is where the fake
 *      IndexedDB harness lives
 *   4. the codec ..................................... the wire block above
 */
describe('the four guard lists, walked with the abuse hp gets', () => {
  const fileWith = (patch: Record<string, unknown>): string =>
    JSON.stringify({
      format: 'dhchar',
      schemaVersion: SCHEMA_VERSION,
      app: '0.6.0',
      exportedAt: '2026-09-01T12:00:00.000Z',
      character: { ...newCharacter({ name: 'Probe' }), ...patch },
    });

  /** The verdict on one file, reduced to something two tracks can be compared on. */
  const verdict = (patch: Record<string, unknown>): string => {
    try {
      parseCharacterFile(fileWith(patch));
      return 'accepted';
    } catch (error) {
      return (error as Error).message.replace(/\bHP\b|\bFavor\b/, 'THE');
    }
  };

  const ABUSE: ReadonlyArray<readonly [string, unknown]> = [
    ['a string where a track belongs', 'not a counter'],
    ['half a track', { marked: 3 }],
    ['a track with no marked count', { max: 6 }],
    ['null', null],
    ['a number', 42],
    ['a list', []],
  ];

  it('answers a damaged Favor track exactly as it answers a damaged HP one', () => {
    for (const [label, value] of ABUSE) {
      const hp = verdict({ hp: value });
      const favor = verdict({ favor: value });
      expect(favor, label).toBe(hp);
      // Teeth: the shared answer has to be a refusal. Two tracks that both
      // accepted everything would satisfy the equality above.
      expect(hp, label).not.toBe('accepted');
    }
  });

  it('names the track it refused, so the two are not merely equally rude', () => {
    expect(verdict({ hp: 'not a counter' })).toMatch(/no readable THE track/);
    expect(() => parseCharacterFile(fileWith({ favor: 'not a counter' }))).toThrow(
      /no readable Favor track/,
    );
    expect(() => parseCharacterFile(fileWith({ hp: 'not a counter' }))).toThrow(
      /no readable HP track/,
    );
  });

  it('keeps `checkShapes` out of it, which is why the sentences match', () => {
    /*
     * Door 2, and the answer is a deliberate absence rather than a forgotten
     * line. `checkShapes` runs BEFORE the counters are read, so a `favor` entry
     * there would refuse `{ favor: 'not a counter' }` with "has a damaged
     * favor field" while `hp` still answered "has no readable HP track" - the
     * two tracks would stop agreeing, and the test above would go red for a
     * guard that had just been ADDED.
     *
     * This is measured against the four tracks that were here first: none of
     * `hp`, `stress`, `hope` or `armorSlots` produces a `checkShapes` sentence
     * either, so `favor` is in the same list as its siblings by being out of
     * this one.
     */
    for (const track of ['hp', 'stress', 'hope', 'armorSlots', 'focus', 'favor']) {
      expect(verdict({ [track]: 'not a counter' }), track).not.toMatch(/damaged "/);
    }
    // Control: a field that IS in `checkShapes` still answers with its sentence,
    // so the assertion above is about these tracks and not about the guard
    // having been emptied.
    expect(verdict({ inventory: 42 })).toMatch(/damaged "inventory" field/);
  });

  it('lets an absent track be terse, which is where it follows focus and not hp', () => {
    // The one place the two deliberately differ, stated rather than left to be
    // discovered by whoever reads the loop above and wonders why `undefined` is
    // not in the abuse list. `hp` is required; `favor` and `focus` fall back to
    // the blank sheet, because `checkShapes`'s rule is that anything absent is
    // just terse.
    expect(verdict({ hp: undefined })).not.toBe('accepted');
    expect(verdict({ favor: undefined })).toBe('accepted');
    /*
     * And the blank sheet it falls back to is EMPTY, which is the third thing
     * the seed's condition changed. `readCharacterRecord` builds its base with
     * `newCharacter()` - no index, so no class - so a schema-9 file that
     * arrives with no Favor key used to open on three and now opens on none.
     * Asserted as the literal rather than as `newCharacter().favor`, because
     * that spelling would agree with the seed whatever the seed became, and it
     * is precisely the shape of assertion that let three reach every sheet.
     *
     * Zero here is the same answer the 8 -> 9 converter and the format-8
     * decoder give: a file with no Favor track was written by something that
     * never had one. Three doors, one answer.
     */
    expect(parseCharacterFile(fileWith({ favor: undefined })).favor).toEqual({
      marked: 0,
      max: MAX_FAVOR,
    });
    expect(newWarlock().favor.marked, 'and three is still reachable').toBe(3);
  });
});
