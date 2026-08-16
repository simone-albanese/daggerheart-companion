/**
 * Reading a character that an older build wrote.
 *
 * This app has no server and no second copy. Its whole durability story is
 * "IndexedDB can be evicted, so keep exported files" - and the day
 * `SCHEMA_VERSION` becomes 4, every `.dhchar` and `.dhbackup` on a disk, in a
 * Drive folder, or in the daily backup folder becomes unreadable by the only
 * app that can read it. It fails at the worst possible moment, too, because
 * you reach for the backup precisely *when* IndexedDB was evicted, by which
 * point no old build is left on the device to open it with.
 *
 * The refusal it replaces said *"There is no converter for that version yet,
 * so it has not been imported - nothing has been changed or lost."* True of
 * the file and false of the user's situation.
 *
 * ## The rule
 *
 * **No schema ships without its converter.** A bump to `SCHEMA_VERSION` is
 * incomplete until this file carries a migration keyed on the version being
 * left, and `tests/store/migrations.test.ts` carries a committed fixture
 * written by the build that is being superseded. Both are enforced: the test
 * fails on a bump with either missing, and it fails today if you bump the
 * constant and change nothing else.
 *
 * ## The shape
 *
 * A chain, not a jump table. Each migration converts *from* one version to
 * exactly that version plus one, so a record from three schemas ago walks
 * forward one step at a time and nobody ever has to write an N-to-current
 * converter. The cost of a bump stays one function forever.
 *
 * Migrations take a plain record rather than a `Character`. A v2 record is not
 * a `Character` - that is the entire reason it needs converting - and typing
 * it as one would let a converter read a field the old build never wrote and
 * get `undefined` with the compiler's blessing.
 *
 * This is about *characters*. The dataset carries a `schemaVersion` too, and
 * it does not need converting: it ships inside the bundle, so it is always the
 * one this build expects.
 */
import { SCHEMA_VERSION } from './types.ts';

export interface Migration {
  /** The version this reads. It produces `from + 1`, always. */
  from: number;
  /** What changed, in one line. This is the changelog. */
  note: string;
  apply: (record: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * The lowest version any released build ever wrote.
 *
 * Three, and not one, because schema 1 and schema 2 never existed outside
 * development: `shared/types.ts` has read `SCHEMA_VERSION = 3` since the first
 * commit of this repository (`8c83f78`), so no file and no database record
 * numbered 1 or 2 has ever left a machine. Writing converters for them would
 * be inventing a history to be compatible with.
 *
 * So `MIGRATIONS` is empty today, and that is the correct content rather than
 * an omission. What matters is that the machinery, the policy and the test are
 * in place *before* the first bump, because after it they are too late.
 */
export const OLDEST_READABLE = 3;

export const MIGRATIONS: readonly Migration[] = [];

export class SchemaError extends Error {
  readonly version: number;

  constructor(message: string, version: number) {
    super(message);
    this.name = 'SchemaError';
    this.version = version;
  }
}

/**
 * The version stamped on a record, or the current one when there is none.
 *
 * A missing version is read as current rather than as ancient. Everything that
 * writes one has written one since the first commit, so the only records
 * without one are hand-edited files - and `readCharacter` already accepts a
 * bare character object on purpose, for somebody who pulled the `character`
 * field out of a file in a text editor.
 *
 * `current` is a parameter rather than `SCHEMA_VERSION` inline because there is
 * now a second numbering to police: campaigns are their own store with their
 * own version and their own chain (`shared/campaigns.ts`). The policy in
 * Architecture 6.1 is one policy, so it gets one implementation with the
 * numbers passed in, rather than a second copy that can drift from this one.
 */
export function versionOf(
  record: Record<string, unknown>,
  current: number = SCHEMA_VERSION,
): number {
  const raw = record['schemaVersion'];
  if (raw === undefined || raw === null) return current;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new SchemaError('has a schema version that is not a whole number.', NaN);
  }
  return raw;
}

/**
 * The two ends this build cannot reach, and the sentences that say which.
 *
 * Separate from the walk because the envelope of a `.dhbackup` carries its own
 * version and has no record to convert: it needs the refusal without the
 * conversion. The remedies are opposite, which is why there are two sentences
 * and not one - a version from the future means update the app, and a version
 * below the oldest means the file predates anything this app has ever written.
 */
export function checkReadable(
  version: number,
  current: number = SCHEMA_VERSION,
  oldest: number = OLDEST_READABLE,
): void {
  if (version > current) {
    throw new SchemaError(
      `was written by a newer version of the app (schema ${version}; this app reads ${current}). Update the app, then open it again - it has not been changed.`,
      version,
    );
  }
  if (version < oldest) {
    throw new SchemaError(
      `uses schema ${version}, which no released version of this app has ever written (the oldest is ${oldest}). It has not been imported and nothing has been changed.`,
      version,
    );
  }
}

export interface MigrationResult {
  record: Record<string, unknown>;
  /** The version it arrived as. Equal to `SCHEMA_VERSION` when nothing ran. */
  from: number;
  /** One line per converter that ran, for the user-facing warning. */
  applied: string[];
}

/**
 * Steps between two versions that no migration covers.
 *
 * Separate and exported so the chain can be checked against a version this
 * build is not yet at. That is the only way to prove the policy has teeth
 * before the bump that would test it for real: ask what would be missing if
 * `SCHEMA_VERSION` were one higher, and the answer today is "the converter
 * leaving 3".
 */
export function missingConverters(
  from: number,
  to: number,
  migrations: readonly Migration[] = MIGRATIONS,
): number[] {
  const gaps: number[] = [];
  for (let v = from; v < to; v += 1) {
    if (!migrations.some((m) => m.from === v)) gaps.push(v);
  }
  return gaps;
}

/** Walk one record from `from` to `to`. Pure, and blind to which build it is in. */
export function applyChain(
  record: Record<string, unknown>,
  from: number,
  to: number,
  migrations: readonly Migration[] = MIGRATIONS,
): { record: Record<string, unknown>; applied: string[] } {
  let current = record;
  const applied: string[] = [];
  for (let v = from; v < to; v += 1) {
    const migration = migrations.find((m) => m.from === v);
    if (migration === undefined) {
      // Thrown rather than skipped: handing back a half-converted record is the
      // failure this whole file exists to prevent.
      throw new SchemaError(
        `uses schema ${from}, and this build has no converter for schema ${v}. That is a bug in the app, not a problem with the file.`,
        from,
      );
    }
    current = migration.apply(current);
    applied.push(migration.note);
  }
  return { record: current, applied };
}

/**
 * Walk a record forward to this build's schema.
 *
 * Throws when it cannot: a version from the future is unreadable by
 * definition, and a version below `OLDEST_READABLE` is one no converter was
 * ever written for. Both messages say which case it is, because the remedies
 * are opposite - one means update the app, the other means the file is older
 * than anything this app has ever been able to read.
 */
export function migrateCharacterRecord(record: Record<string, unknown>): MigrationResult {
  const from = versionOf(record);
  checkReadable(from);
  const { record: converted, applied } = applyChain(record, from, SCHEMA_VERSION);
  return { record: { ...converted, schemaVersion: SCHEMA_VERSION }, from, applied };
}

/** Every version this build can read, oldest first. */
export const readableVersions = (
  oldest: number = OLDEST_READABLE,
  current: number = SCHEMA_VERSION,
): number[] => Array.from({ length: current - oldest + 1 }, (_, i) => oldest + i);
