/**
 * Can this build still read what an older build wrote?
 *
 * The answer used to be "there is nothing older", which is exactly why this
 * file was written before it was needed: `SCHEMA_VERSION` read 3 from the first
 * commit until P1-7 moved it to 4, so the bump was the first time any of this
 * ran against files that are already on people's disks, in an app they reached
 * for *because* IndexedDB was evicted.
 *
 * The policy, enforced rather than described:
 *
 *   - the converter chain must have no gap between the oldest readable
 *     version and this build's;
 *   - a committed fixture must exist for every readable version, written by
 *     the build that shipped it and never regenerated;
 *   - every fixture must still parse into a character at the current schema.
 *
 * That is what the bump to 4 cost, and it cost it on the day: the converter
 * leaving 3, and `v4.dhchar`/`v4.dhbackup` beside the schema-3 pair. The
 * schema-3 pair is evidence, not a fixture to be refreshed - regenerating it
 * from this build would prove only that the current code can read its own
 * output, which is not the question.
 *
 * The chain-walking itself is still checked against synthetic migrations
 * rather than the real list: one real converter is not enough steps to walk.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../shared/types.ts';
import {
  applyChain,
  MIGRATIONS,
  migrateCharacterRecord,
  missingConverters,
  OLDEST_READABLE,
  readableVersions,
  SchemaError,
  versionOf,
  type Migration,
} from '../../shared/migrations.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { parseTransferFile } from '../../src/transfer/fileIo.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));

const rawFixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as Record<string, unknown>;

describe('the policy: no schema ships without its converter', () => {
  it('has a converter for every step from the oldest readable version to this one', () => {
    const gaps = missingConverters(OLDEST_READABLE, SCHEMA_VERSION);
    expect(
      gaps,
      `schema ${gaps.join(', ')} can be read by no converter in shared/migrations.ts. ` +
        'Every file and every database record at those versions is unreadable by this build.',
    ).toEqual([]);
  });

  it('carries no converter for a version this build has not left yet', () => {
    const ahead = MIGRATIONS.filter((m) => m.from >= SCHEMA_VERSION).map((m) => m.from);
    expect(ahead, `migrations that convert away from the current schema: ${ahead.join(', ')}`).toEqual([]);
  });

  it('carries no two converters for the same version', () => {
    const froms = MIGRATIONS.map((m) => m.from);
    expect(froms).toEqual([...new Set(froms)]);
  });

  it('gives every converter a line of changelog', () => {
    for (const m of MIGRATIONS) expect(m.note.trim().length, `schema ${m.from}`).toBeGreaterThan(0);
  });

  it('would fail on a bump that shipped without its converter', () => {
    // The teeth, without touching the constant: ask what the step out of this
    // version would need, and confirm it is not already there. If this ever
    // comes back empty, the check above has become vacuous - it would be
    // passing because the range is empty rather than because it is covered.
    expect(missingConverters(SCHEMA_VERSION, SCHEMA_VERSION + 1)).toEqual([SCHEMA_VERSION]);
  });
});

describe('the committed fixtures', () => {
  const files = readdirSync(FIXTURES);

  it('has one character file per readable version', () => {
    const expected = readableVersions().map((v) => `v${v}.dhchar`);
    const missing = expected.filter((name) => !files.includes(name));
    expect(
      missing,
      `no committed fixture for: ${missing.join(', ')}. A converter with no file written by ` +
        'the build it converts from is a converter nobody has ever run against real output.',
    ).toEqual([]);
  });

  it('has one backup file per readable version, because the two paths differ', () => {
    const expected = readableVersions().map((v) => `v${v}.dhbackup`);
    const missing = expected.filter((name) => !files.includes(name));
    expect(missing, `no committed backup fixture for: ${missing.join(', ')}`).toEqual([]);
  });

  for (const version of readableVersions()) {
    it(`still opens the schema ${version} character file`, () => {
      const file = parseTransferFile(readFileSync(join(FIXTURES, `v${version}.dhchar`), 'utf8'));
      expect(file.kind).toBe('character');
      const character = file.characters[0]!;
      expect(character.schemaVersion).toBe(SCHEMA_VERSION);
      // Not just "it parsed": the fields a player would notice are gone if a
      // converter dropped them.
      expect(character.name).not.toBe('');
      expect(character.level).toBeGreaterThan(0);
      expect(character.loadout.length).toBeGreaterThan(0);
      expect(character.experiences.length).toBeGreaterThan(0);
      expect(character.hp.max).toBeGreaterThan(0);
    });

    it(`still opens the schema ${version} backup file`, () => {
      const file = parseTransferFile(readFileSync(join(FIXTURES, `v${version}.dhbackup`), 'utf8'));
      expect(file.kind).toBe('backup');
      expect(file.characters.length).toBeGreaterThan(0);
      for (const c of file.characters) expect(c.schemaVersion).toBe(SCHEMA_VERSION);
    });
  }

  /**
   * The first real converter, run against the bytes of the build it converts
   * from - and run on the raw record rather than through `parseTransferFile`.
   *
   * `readCharacterRecord` spreads whatever the converter returns over
   * `newCharacter()`, which now seeds `consecutiveShortRests: 0` itself. So the
   * file path would report a 0 with `MIGRATIONS` empty, with the converter
   * gutted, or with the chain working - it cannot tell those apart, and a test
   * that cannot tell them apart is not evidence that anything converted.
   */
  it('gives a schema 3 record the rest count it never had', () => {
    const record = rawFixture('v3.dhchar')['character'] as Record<string, unknown>;
    expect(record['consecutiveShortRests'], 'the v3 fixture must not carry the field').toBe(
      undefined,
    );

    const migrated = migrateCharacterRecord(record);

    expect(migrated.from).toBe(3);
    // Both steps, in order: a schema-3 record walks the whole chain forward one
    // version at a time, which is the property that keeps the cost of a bump at
    // one function rather than one function per version behind.
    expect(migrated.applied).toEqual([
      'a count of consecutive short rests was added, starting at zero',
      'a companion records whether their damage is physical or magic, starting physical',
      'the dataset grew a transformations collection and four widened fields; no schema-5 character field changed',
      'a character can hold one transformation card, starting with none',
    ]);
    expect(migrated.record['consecutiveShortRests']).toBe(0);
    expect(migrated.record['schemaVersion']).toBe(SCHEMA_VERSION);
    // Converting is not rewriting: everything the schema-3 build wrote is still
    // there afterwards, byte for byte.
    expect(migrated.record['name']).toBe('Fixture');
    expect(migrated.record['scars']).toEqual(['A ledger of names']);
  });

  /**
   * The second converter, which the committed fixtures cannot reach.
   *
   * Neither `v3.dhchar` nor `v4.dhchar` carries a companion - they are a Bard -
   * so the branch that matters runs against records built here. That is worth
   * saying out loud rather than leaving the coverage to look complete: the
   * fixtures prove the chain walks, and these prove what its second step does.
   */
  it('gives a schema 4 companion the damage type they were already dealing', () => {
    const record = {
      schemaVersion: 4,
      name: 'Ranger',
      companion: { name: 'Ash', damage: 'd6', range: 'Close' },
    };
    const migrated = migrateCharacterRecord(record);
    expect(migrated.record['companion']).toEqual({
      name: 'Ash',
      damage: 'd6',
      range: 'Close',
      damageType: 'phy',
    });
  });

  /**
   * The `v5` fixture's companion, which nothing read.
   *
   * It carries `damageType: "mag"` and the only thing that ever touched it was
   * the generic loop above, which checks name, level, loadout, Experiences and
   * HP and never goes inside `companion`. Deleting the key from both `v5` files
   * left the whole suite green, so the field the whole 4->5 step exists for was
   * committed as decoration.
   *
   * A note on what this fixture is, because it is not quite what `v3` and `v4`
   * are. Those are the output of the build they are named for. `v5` is the
   * output of THIS build fed `v4.dhchar` - which is a Troubadour Bard, so the
   * conversion could only ever produce a Bard with no companion, and no real
   * export could add one either: `hasCompanionFeature` wants Beastbound. The
   * animal was put in by hand so the step's own field would be represented at
   * all. That is a reasonable thing to have done and an unreasonable thing to
   * leave unsaid, since a reader would otherwise take it for a build's output.
   */
  it('reads the v5 fixture’s companion, magic damage and all', () => {
    for (const name of ['v5.dhchar', 'v5.dhbackup']) {
      const raw = rawFixture(name);
      const records = (raw['characters'] ?? [raw['character']]) as Array<Record<string, unknown>>;
      const stored = records[0]?.['companion'] as Record<string, unknown> | null | undefined;
      expect(stored?.['damageType'], `${name} carries no companion damage type`).toBe('mag');

      const file = parseTransferFile(readFileSync(join(FIXTURES, name), 'utf8'));
      const companion = file.characters[0]?.companion;
      expect(companion?.name, name).toBe('Ash');
      // The point of the whole step: a choice the player made survives the
      // round trip through a file, rather than arriving as the default the
      // converter seeds.
      expect(companion?.damageType, name).toBe('mag');
    }
  });

  it('does not hand an animal to a character who has none', () => {
    const record = { schemaVersion: 4, name: 'Wizard', companion: null };
    expect(migrateCharacterRecord(record).record['companion']).toBeNull();
  });

  it('leaves a sheet that never mentioned a companion alone', () => {
    const record = { schemaVersion: 4, name: 'Wizard' };
    expect(migrateCharacterRecord(record).record['companion']).toBeUndefined();
  });

  it('keeps the fixture at the version its name claims', () => {
    // A fixture silently rewritten by a later build is worse than none: it
    // would prove the current code can read its own output, which is not the
    // question.
    for (const version of readableVersions()) {
      for (const ext of ['dhchar', 'dhbackup']) {
        const raw = JSON.parse(readFileSync(join(FIXTURES, `v${version}.${ext}`), 'utf8')) as {
          schemaVersion: number;
        };
        expect(raw.schemaVersion, `v${version}.${ext}`).toBe(version);
      }
    }
  });
});

describe('the stamp on the shipped dataset', () => {
  /**
   * The coupling a bump can break in silence.
   *
   * `Dataset.schemaVersion` is typed `typeof SCHEMA_VERSION`, but the shipped
   * dataset reaches the app through `srd as unknown as Dataset`
   * (`src/store/dataset.ts`), so the cast believes whatever number is in the
   * JSON. Move the constant and leave `data/srd-1.0.json` behind and there is
   * no compile error and no other failing test - just a type asserting one
   * value over another, and `About.tsx` printing "schema 3" under a build at 4
   * on the one screen a user opens to find out what they are running.
   */
  it('is the schema this build actually is', () => {
    expect(baseDataset.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('walking a record forward', () => {
  const chain: Migration[] = [
    { from: 1, note: 'split name into name and pronouns', apply: (r) => ({ ...r, a: true }) },
    { from: 2, note: 'gold became three denominations', apply: (r) => ({ ...r, b: true }) },
    { from: 3, note: 'scars moved off the death move', apply: (r) => ({ ...r, c: true }) },
  ];

  it('applies every step in order and reports what it did', () => {
    const { record, applied } = applyChain({ schemaVersion: 1 }, 1, 4, chain);
    expect(record).toEqual({ schemaVersion: 1, a: true, b: true, c: true });
    expect(applied).toEqual([
      'split name into name and pronouns',
      'gold became three denominations',
      'scars moved off the death move',
    ]);
  });

  it('starts from the version the record actually is, not from the oldest', () => {
    const { record, applied } = applyChain({ schemaVersion: 3 }, 3, 4, chain);
    expect(record).toEqual({ schemaVersion: 3, c: true });
    expect(applied).toHaveLength(1);
  });

  it('does nothing at all when the record is already current', () => {
    const { record, applied } = applyChain({ untouched: 1 }, 4, 4, chain);
    expect(record).toEqual({ untouched: 1 });
    expect(applied).toEqual([]);
  });

  it('refuses to hand back a half-converted record when a step is missing', () => {
    const holed = chain.filter((m) => m.from !== 2);
    expect(() => applyChain({ schemaVersion: 1 }, 1, 4, holed)).toThrow(SchemaError);
    expect(() => applyChain({ schemaVersion: 1 }, 1, 4, holed)).toThrow(
      /no converter for schema 2.*bug in the app/s,
    );
  });

  it('names the gaps rather than only the first one', () => {
    expect(missingConverters(1, 4, [chain[1]!])).toEqual([1, 3]);
  });
});

describe('what version a record claims', () => {
  it('reads the stamp', () => {
    expect(versionOf({ schemaVersion: 3 })).toBe(3);
  });

  it('reads a record with no stamp as current, the way a hand-edited file arrives', () => {
    expect(versionOf({ name: 'no header' })).toBe(SCHEMA_VERSION);
    expect(versionOf({ schemaVersion: null })).toBe(SCHEMA_VERSION);
  });

  it('refuses a version that is not a whole number', () => {
    expect(() => versionOf({ schemaVersion: '3' })).toThrow(SchemaError);
    expect(() => versionOf({ schemaVersion: 3.5 })).toThrow(/not a whole number/);
  });
});

describe('the two refusals that remain', () => {
  it('will not guess at a record from the future, and says to update the app', () => {
    expect(() => migrateCharacterRecord({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      /newer version of the app.*Update the app/s,
    );
    // The word that matters: nothing was written.
    expect(() => migrateCharacterRecord({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(
      /has not been changed/,
    );
  });

  it('will not invent a converter for a version no build ever wrote', () => {
    expect(() => migrateCharacterRecord({ schemaVersion: OLDEST_READABLE - 1 })).toThrow(
      /no released version of this app has ever written/,
    );
  });

  it('carries the version on the error, so a caller can say which record', () => {
    try {
      migrateCharacterRecord({ schemaVersion: SCHEMA_VERSION + 7 });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      expect((error as SchemaError).version).toBe(SCHEMA_VERSION + 7);
    }
  });

  it('passes a current record through untouched, and stamps it', () => {
    const { record, from, applied } = migrateCharacterRecord({ schemaVersion: SCHEMA_VERSION, x: 1 });
    expect(record).toEqual({ schemaVersion: SCHEMA_VERSION, x: 1 });
    expect(from).toBe(SCHEMA_VERSION);
    expect(applied).toEqual([]);
  });
});
