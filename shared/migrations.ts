/**
 * Reading a character that an older build wrote.
 *
 * This app has no server and no second copy. Its whole durability story is
 * "IndexedDB can be evicted, so keep exported files" - and the day
 * `SCHEMA_VERSION` moved to 4, every `.dhchar` and `.dhbackup` on a disk, in a
 * Drive folder, or in the daily backup folder would have become unreadable by
 * the only app that can read it. It fails at the worst possible moment, too,
 * because you reach for the backup precisely *when* IndexedDB was evicted, by
 * which point no old build is left on the device to open it with. That day has
 * now happened, and the converter below is what made it a non-event.
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
import { MAX_FAVOR, MAX_FOCUS, SCHEMA_VERSION } from './types.ts';

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
 * development: `shared/types.ts` read `SCHEMA_VERSION = 3` from the first
 * commit of this repository (`8c83f78`) until P1-7 moved it to 4, so no file
 * and no database record numbered 1 or 2 has ever left a machine. Writing
 * converters for them would be inventing a history to be compatible with.
 *
 * It stays 3 across the bump. Every `.dhchar` in somebody's Drive folder is a
 * schema-3 file, and 3 is exactly the version the list below now leaves.
 */
export const OLDEST_READABLE = 3;

/**
 * The chain, one entry per version this build has left behind.
 *
 * The first entry is P1-7's, and it is the first time any of the machinery
 * above ran against a real file rather than a synthetic one. It is deliberately
 * dull: the policy is proved by a converter existing on the day of the bump,
 * committed beside `tests/fixtures/schema/v3.dhchar` - bytes written by the
 * schema-3 build, never regenerated - not by the converter being clever.
 *
 * The second is duller still, and that is the point twice over: both of them
 * seed a field with the value the older build already behaved as if it had.
 *
 * The third seeds nothing at all - the 5 -> 6 bump moved only `Dataset` - and
 * the fourth is back to the ordinary shape: one new `Character` field,
 * `transformationRef`, seeded with the value every schema-6 sheet meant.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 3,
    note: 'a count of consecutive short rests was added, starting at zero',
    /*
     * Zero, and not a guess. A schema-3 build never counted, so the app does
     * not know what the table did, and zero is the value that leaves the choice
     * with the players rather than refusing a rest nobody recorded.
     *
     * It overwrites rather than preserving a key that is already there: a
     * record stamped 3 that carries a schema-4 field is a record whose own
     * header is wrong, and believing the field over the header is how a
     * hand-edited file gets to decide what the schema means.
     */
    apply: (r) => ({ ...r, consecutiveShortRests: 0 }),
  },
  {
    from: 4,
    note: 'a companion records whether their damage is physical or magic, starting physical',
    /*
     * Physical, because that is what every schema-4 sheet already meant.
     *
     * `damageTypeOf` answered `phy` for every companion there has ever been,
     * so a schema-4 companion has been dealing physical damage at every table
     * that used this app. Seeding anything else here would be inventing a
     * choice the player never made and changing a number they had already read
     * off the screen.
     *
     * It reaches into `companion` rather than adding a top-level key, and it
     * leaves a sheet with no companion exactly as it found it - a Wizard does
     * not acquire an empty animal by being read.
     */
    apply: (r) => {
      const companion = r['companion'];
      if (companion === null || typeof companion !== 'object' || Array.isArray(companion)) {
        return r;
      }
      return { ...r, companion: { ...(companion as Record<string, unknown>), damageType: 'phy' } };
    },
  },
  {
    from: 5,
    note: 'the dataset grew a transformations collection and four widened fields; no schema-5 character field changed',
    /*
     * A copy, and the first character converter that seeds nothing.
     *
     * The 5 -> 6 bump is entirely about `Dataset`: `transformations`,
     * `DamageKind`, `Feature.kind`, `Feature.features` and `Adversary.stress`.
     * Not one of them is on `Character`, so a schema-5 sheet is already a valid
     * schema-6 sheet, field for field, and there is nothing here to repair or
     * to fill. Inventing work for this function - restamping a field, seeding a
     * default some reader already supplies - would be the kind of converter
     * that looks diligent and is the one nobody notices has gone stale.
     *
     * `{ ...r }` rather than `r` itself, for the reason `CAMPAIGN_MIGRATIONS`
     * gives at its own first entry: `migrateCharacterRecord` spreads a
     * `schemaVersion` onto whatever comes back, and returning the argument
     * would leave that spread as the only thing standing between a caller's
     * record and being restamped in place. One allocation buys a pure chain,
     * and purity is what a test can assert.
     *
     * **What the number buys, since the field list is empty.** Not the usual
     * thing. `shared/campaigns.ts` bumps so that old builds REFUSE new records,
     * because an old build would silently truncate one; here an old build would
     * read a schema-6 sheet perfectly, and the refusal it now gets is a cost
     * rather than a benefit. It is paid for the dataset half of what this
     * constant names: `Dataset.schemaVersion` is typed `typeof SCHEMA_VERSION`
     * and the shipped JSON carries the number, so a `Dataset` whose shape moved
     * under a constant that did not is an artifact stamped with a version that
     * no longer identifies it - and the only check that can see that
     * (`baseDataset.schemaVersion === SCHEMA_VERSION`) is the one that fires
     * when the constant moves and the JSON is not rebuilt. The argument in full
     * is at `SCHEMA_VERSION` in `shared/types.ts`, including the question it
     * leaves open.
     */
    apply: (r) => ({ ...r }),
  },
  {
    from: 6,
    note: 'a character can hold one transformation card, starting with none',
    /*
     * `null`, and it is the same kind of answer the `from: 3` entry gives: not
     * a guess, but the value the older build already behaved as if it had.
     *
     * A schema-6 build had no `transformationRef`, no picker on the sheet and
     * no field on the wire, so every schema-6 sheet held no transformation.
     * `null` is that fact written down.
     *
     * It overwrites rather than preserving a key that is already there, for the
     * reason the `from: 3` converter gives at length: a record stamped 6 that
     * carries a schema-7 field is a record whose own header is wrong, and
     * believing the field over the header lets a hand-edited file decide what
     * the schema means.
     *
     * **This is the first converter since the 3 -> 4 step whose refusal earns
     * its keep.** A schema-6 build reading a schema-7 sheet would not merely be
     * behind: `readCharacterRecord` spreads the file over `newCharacter()`, and
     * a blank schema-6 sheet has no `transformationRef` key, so the field would
     * be dropped on read and written back out gone. The bump is what turns
     * that silent deletion into `checkReadable`'s "was written by a newer
     * version of the app" refusal, with the file untouched.
     */
    apply: (r) => ({ ...r, transformationRef: null }),
  },
  {
    from: 7,
    note: 'a character can know martial stances and hold Focus, starting with none of either',
    /*
     * Two fields in one converter, because the 7 -> 8 bump is one fact: a
     * Martial Artist's sheet. `stanceRefs` is the marked circles and `focus` is
     * the track beside them; a sheet with one and not the other is not a state
     * any build has ever written.
     *
     * `[]` and a zeroed six-box track, and neither is a guess. A schema-7 build
     * had no stance list, no Focus track, no picker and no field on the wire,
     * so no sheet it wrote knew a stance or held a Focus - which is exactly
     * what these two values say.
     *
     * The maximum comes from `MAX_FOCUS` rather than being written as `6` here.
     * `COUNTER_CEILINGS.focus` is the same constant, and it is what refuses a
     * seventh box arriving over the wire; a converter seeding a literal beside
     * it is how the stored track and the check on it come to disagree.
     *
     * It overwrites rather than preserving keys that are already there, for the
     * reason the `from: 3` converter gives at length: a record stamped 7 that
     * carries a schema-8 field is a record whose own header is wrong.
     *
     * **The refusal earns its keep, and more than seven's did.** A schema-7
     * build reading a schema-8 sheet would drop both fields on read and write
     * them back out gone - `readCharacterRecord` spreads the file over
     * `newCharacter()`, and a blank schema-7 sheet has neither key. Seven's
     * refusal protected one ref; this one protects a list of up to eleven and
     * the Focus a player is holding mid-scene.
     */
    apply: (r) => ({ ...r, stanceRefs: [], focus: { marked: 0, max: MAX_FOCUS } }),
  },
  {
    from: 8,
    note: 'a character can hold Favor, and an existing one starts holding none',
    /*
     * **Zero, and a new WARLOCK's sheet says three. Both are right, and the
     * word the difference turns on is "start".**
     *
     * The Warlock's feature reads *"You start with 3 Favor... The maximum Favor
     * you can hold at one time is 6."* `newCharacter()` in
     * `src/engine/character.ts` seeds 3 for a class whose features grant Favor
     * and 0 for every other class, because that function is what a character
     * starts as. This converter is not: it runs on somebody who has
     * been playing, at whatever point in a session the update lands, and the
     * three Favor it would hand them is a resource nobody at that table watched
     * them earn. The two converters before this one made the same call for the
     * same reason - `stanceRefs: []` and a zeroed Focus track, not a plausible
     * one - and the owner's decision here is that this one follows them.
     *
     * The maximum comes from `MAX_FAVOR` rather than being written as `6` here.
     * `COUNTER_CEILINGS.favor` is the same constant, and it is what refuses a
     * seventh box arriving over the wire; a converter seeding a literal beside
     * it is how a stored track and the check on it come to disagree.
     *
     * It overwrites rather than preserving a key that is already there, for the
     * reason the `from: 3` converter gives at length: a record stamped 8 that
     * carries a schema-9 field is a record whose own header is wrong, and
     * believing the field over the header lets a hand-edited file decide what
     * the schema means.
     *
     * **The refusal earns its keep.** A schema-8 build reading a schema-9 sheet
     * would drop the track on read and write it back out gone -
     * `readCharacterRecord` spreads the file over `newCharacter()`, and a blank
     * schema-8 sheet has no `favor` key. What that costs a Warlock is the Favor
     * they are holding in the middle of a scene, which is exactly the loss
     * eight's refusal was worth more than seven's for.
     */
    apply: (r) => ({ ...r, favor: { marked: 0, max: MAX_FAVOR } }),
  },
];

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
 * build is not yet at. That is the only way to keep the policy's teeth between
 * bumps: ask what would be missing if `SCHEMA_VERSION` were one higher, and the
 * answer is always "the converter leaving the current version" - today the one
 * leaving 4, as it was the one leaving 3 until P1-7 wrote it.
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
