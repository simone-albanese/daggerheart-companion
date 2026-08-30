/**
 * Moving the GM out of localStorage, once, without ever losing the move.
 *
 * The old store is a single key, `dhc.gm.v1`, holding the whole of the GM's
 * state as one JSON string and rewritten synchronously on every change. What
 * is inside it is not small and not replaceable: the live fight, the Fear
 * pool, every countdown, and whole copies of the players' character sheets.
 *
 * This runs once per device. It reads that key, turns it into the first
 * campaign, writes it to IndexedDB, **reads it back and compares it**, and
 * only then removes the key.
 *
 * ## Why the read-back is not belt and braces
 *
 * `src/store/backup.ts` opens with "never claim a backup happened" and P0-5
 * is the same sentence in the other direction: an unverified backup is not a
 * backup. A migration that deletes its source is a backup with the original
 * thrown away, so it is the same rule with the stakes turned up - a resolved
 * `put` is not a record on the disk. Quota can bite between the write and the
 * commit; a transaction can abort; a private window can accept writes and keep
 * none of them. Every one of those returns a promise that resolves.
 *
 * So the order is write, read back, compare in full, and only then delete. If
 * any step disagrees, the localStorage key is left exactly where it is and the
 * app tries again next launch. Running twice costs nothing, because the
 * campaign is written under a stable id and the second write overwrites the
 * first rather than making a second campaign.
 *
 * ## And when it cannot be read at all
 *
 * The key is renamed rather than deleted, and the sentence names it. This is
 * `readLibrary`'s rule for characters and it is here for the same reason:
 * "some GM data could not be read" is the sentence that makes a person go
 * looking through a database inspector for something that may not be there.
 * `dhc.gm.v1.unreadable` is a name, in a place they can find it, and nothing
 * has been thrown away.
 */
import { readCampaignRecord, type Campaign } from '../../shared/campaigns.ts';
import { getCampaign, putCampaign } from './campaigns.ts';

/** The key `src/ui/gm/gmStore.ts` wrote to before campaigns existed. */
const LEGACY_GM_KEY = 'dhc.gm.v1';

/** Where an unreadable one is kept, rather than deleted. */
const LEGACY_GM_QUARANTINE_KEY = 'dhc.gm.v1.unreadable';

/**
 * A stable id, so a retry rewrites rather than duplicates.
 *
 * The failure this closes is specific: write succeeds, verification fails, the
 * key is correctly left alone - and on the next launch a random id would make
 * a *second* campaign holding the same fight. A GM would find two identical
 * tables and no way to know which one the app is going to use.
 */
const LEGACY_CAMPAIGN_ID = 'campaign-from-gm-v1';

/**
 * The campaign schema the blob below is SHAPED like, and it is not this build's.
 *
 * `dhc.gm.v1` was written by a build whose fight lived in one list on the GM
 * screen, and the literal below still copies that list into `board.combatants`
 * and names `liveScene` beside it. That is a schema-4 board by construction,
 * and it does not become a schema-5 board by being stamped as one.
 *
 * Stamping it `CAMPAIGN_SCHEMA_VERSION` is not a cosmetic lie, it is the one
 * silent way this file can still lose everything it exists to save.
 * `readCampaignRecord` reads the stamp, `applyChain` walks 5 to 5, no converter
 * runs, and the schema-5 board reader - which names its own keys, and
 * `combatants` is not one of them - drops the fight on the floor. Then the
 * verified write agrees with itself, because it compares what was BUILT against
 * what came BACK and never against what the blob HELD, and the localStorage key
 * is deleted. Every HP and Stress mark on the table gone, and the only copy
 * already thrown away.
 *
 * So the number stays where the shape is, and the chain does the moving: the
 * `from: 4` entry in `shared/campaigns.ts` lands that fight on a scene row and
 * points `openScene` at it. No mint is written here. A second one would be a
 * second answer to "where does a board's fight go", and one fight with two
 * homes is the defect schema 5 exists to delete - rebuilding it in the rescue
 * path would be a poor place to start.
 *
 * It does not move with `CAMPAIGN_SCHEMA_VERSION`, and a bump that drags it
 * along has broken this. The bytes sitting in a GM's localStorage do not change
 * because this app did; a future schema adds a converter, not a restamp. The
 * day this literal stops being a schema-4 board is the day this number moves,
 * and there is no other.
 *
 * ## What the suite holds, and what it does not
 *
 * Measured, not assumed - and stated as a difference, because a total is a
 * fact about the day it was written. What a mutant is worth here is the
 * failure it ADDS to `npx vitest run tests/store/`, compared name for name;
 * the number that run prints is not evidence of anything, and this paragraph
 * has already carried one that a later commit in its own wave made false.
 *
 * Mutating this to 5 adds exactly one failure, and it is the right one:
 * `campaignMigration.test.ts`'s *brings across every part of it, not just the
 * Fear*, which is the loss above caught the moment it happens. Mutating it to
 * 3 adds none, because the `from: 3` entry is a pure copy and 3 -> 4 -> 5
 * lands the fight in the same place 4 -> 5 does.
 *
 * So what the tests pin is the boundary - this number is BELOW
 * `CAMPAIGN_SCHEMA_VERSION`, so the chain always runs - and not the digit. The
 * digit is 4 because that is the shape: `board.liveScene` is a schema-4 field
 * and the literal below writes one. Stamping 3 would be a harmless lie today
 * and a live one the day the `from: 3` entry stops being a copy, and no test
 * would be there to say so.
 */
const LEGACY_BLOB_SCHEMA = 4;

/**
 * What a GM's first table is called, until they rename it.
 *
 * Shared with the fresh-install path rather than written twice: a device with
 * nothing to migrate still needs one campaign to exist, and the two arriving
 * at different names would be a difference with no meaning behind it.
 *
 * The *first*, and only the first. `createCampaign` runs this through
 * `freeName`, so the second campaign made from MENU is "My campaign (2)" - two
 * rows reading the same thing is a list a GM cannot pick a table out of.
 */
export const FIRST_CAMPAIGN_NAME = 'My campaign';

/**
 * Is there a GM's table on this device that the `campaigns` store cannot see?
 *
 * For the one caller that has to describe what it is about to destroy. `reset()`
 * sweeps every `dhc.` key, so both of the keys above go with it - the live
 * fight, the Fear pool, every countdown and the copies of the players' sheets
 * in one, and a deliberately-kept unreadable table in the other. Neither is in
 * the `campaigns` object store, so `countCampaigns()` returns a number that is
 * *correct about the store* and wrong about the destruction.
 *
 * That gap is not hypothetical and it is not rare. The move out of localStorage
 * runs from `hydrateGm()`, which fires at module load of the GM chunk, and
 * `App.tsx` imports that chunk lazily - so every upgraded install that has not
 * opened the GM screen since is sitting in exactly this state.
 *
 * A boolean and not a count, deliberately. `dhc.gm.v1` is one key holding one
 * table, but saying "1 campaign" would be a second specific claim about a blob
 * this function has not parsed and, in the quarantine case, one that is known
 * not to parse. The caller drops to naming campaigns without counting them,
 * which is true in every state - the same choice, for the same reason, that its
 * storage-refused branch already makes.
 */
export function hasUncountedLegacyCampaign(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return (
      localStorage.getItem(LEGACY_GM_KEY) !== null ||
      localStorage.getItem(LEGACY_GM_QUARANTINE_KEY) !== null
    );
  } catch {
    // Storage refused the read. Returning `true` would be as much of an
    // invention as returning a zero; the caller's own catch already covers a
    // storage that will not answer.
    return false;
  }
}

export type LegacyOutcome =
  | 'nothing-to-do'
  | 'migrated'
  | 'unreadable'
  | 'not-verified';

export interface LegacyMigrationResult {
  outcome: LegacyOutcome;
  campaign: Campaign | null;
  /** English, ready to render, or null when there is nothing worth saying. */
  message: string | null;
  /** Repairs the reader made on the way through. Named, never counted. */
  warnings: string[];
}

/** The pieces this needs from the platform, so a test can supply its own. */
export interface LegacyDeps {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  now: () => string;
  write: (c: Campaign) => Promise<void>;
  read: (id: string) => Promise<Campaign | null>;
}

const platformStorage = (): LegacyDeps['storage'] => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some browsers throw on the *property access* when storage is blocked.
    return null;
  }
};

const defaults = (): LegacyDeps => ({
  storage: platformStorage(),
  now: () => new Date().toISOString(),
  write: putCampaign,
  read: getCampaign,
});

/**
 * Every value in a record, in an order that does not depend on how it was
 * built. Used to compare what was written with what came back.
 *
 * `JSON.stringify` on its own would compare key *order* as well as content,
 * and a record that has been through a structured clone is not obliged to keep
 * it - so the comparison would fail on two identical campaigns and the
 * migration would refuse to finish for the rest of that device's life.
 *
 * Exported for the import path, which asks the same question of the same store
 * one door along. Two implementations of "did what came back match what went
 * in" would be two answers to the question the whole verified-write standard
 * rests on, and the paragraph above - the one that explains why key order is
 * not content - would then exist in only one of the two places.
 */
export function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
}

/**
 * The old blob, as a campaign.
 *
 * Nothing is interpreted here beyond moving fields into their new places -
 * `readCampaignRecord` does every repair and every refusal, exactly as it does
 * for a record that arrives from the database. Writing a second, softer reader
 * for this path is how the two would come to disagree about what a countdown
 * is.
 *
 * The countdowns become session items, because that is where a campaign keeps
 * them. None of them is marked primary: the old store had no such idea, and
 * choosing one on the GM's behalf would be the app deciding which clock they
 * are watching.
 *
 * What comes out of here is a schema-4 record and says so - see
 * `LEGACY_BLOB_SCHEMA`. The fight is left in `board.combatants` on purpose, and
 * the chain inside `readCampaignRecord` is what moves it onto a scene row. That
 * is the same road every `.dhcampaign` and every stored record takes, which is
 * the whole point: one converter, proved once against frozen bytes, rather than
 * a rescue written twice and read once.
 */
function campaignFromLegacy(
  legacy: Record<string, unknown>,
  at: string,
  id: string = LEGACY_CAMPAIGN_ID,
): Record<string, unknown> {
  const countdowns = Array.isArray(legacy['countdowns']) ? legacy['countdowns'] : [];
  const session = countdowns.map((countdown, index) => {
    const c = (countdown ?? {}) as Record<string, unknown>;
    return {
      id: typeof c['id'] === 'string' ? c['id'] : `countdown-${String(index)}`,
      kind: 'countdown',
      name: typeof c['name'] === 'string' ? c['name'] : '',
      order: index,
      collapsed: false,
      primary: false,
      countdown: c,
    };
  });

  return {
    id,
    schemaVersion: LEGACY_BLOB_SCHEMA,
    name: FIRST_CAMPAIGN_NAME,
    createdAt: at,
    updatedAt: at,
    fear: legacy['fear'],
    session,
    party: legacy['party'],
    board: {
      region: legacy['region'],
      partyTier: legacy['partyTier'],
      roster: legacy['roster'],
      adjustments: legacy['adjustments'],
      combatants: legacy['combatants'],
      environmentRef: legacy['environmentRef'],
      // Null, and named rather than omitted. `dhc.gm.v1` was written before
      // campaigns existed at all, so there is no row its board could name -
      // which is what sends a blob that HAS a fight down the converter's third
      // branch, onto a row minted for it. A blob whose list is empty takes the
      // first branch instead, where this same null is simply renamed.
      //
      // Named because this literal is a whole schema-4 board or it is nothing,
      // and NOT because the compiler insists: this function returns
      // `Record<string, unknown>` and its board has never been checked against
      // `GmBoard`. Nothing holds this line either - deleting it adds no failure
      // to `npx vitest run tests/store/`, because the converter reads a missing
      // `liveScene` and a null one the same way, so no test of behaviour could
      // separate them. It is here for the reader, and it is the reader who has
      // to keep it.
      liveScene: null,
    },
  };
}

/**
 * Do it, once.
 *
 * Returns rather than throws, in every branch. This runs during boot, and a
 * throw here would take the GM screen down over data the GM can still be shown
 * a sentence about.
 */
export async function migrateLegacyGmState(
  overrides: Partial<LegacyDeps> = {},
): Promise<LegacyMigrationResult> {
  const deps = { ...defaults(), ...overrides };
  const nothing: LegacyMigrationResult = {
    outcome: 'nothing-to-do',
    campaign: null,
    message: null,
    warnings: [],
  };

  if (deps.storage === null) return nothing;

  let raw: string | null;
  try {
    raw = deps.storage.getItem(LEGACY_GM_KEY);
  } catch {
    return nothing;
  }
  if (raw === null) return nothing;

  let built: Campaign;
  let warnings: string[];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new SyntaxError('not an object');
    }
    const read = readCampaignRecord(
      campaignFromLegacy(parsed as Record<string, unknown>, deps.now()),
    );
    built = read.campaign;
    warnings = read.warnings;
  } catch (error) {
    /*
     * Kept, renamed, and named out loud.
     *
     * Renamed rather than left in place because leaving it means trying and
     * failing on every single launch, forever, with a sentence on screen each
     * time. Renamed rather than deleted because it is the only copy of
     * something the GM may still want, and this app does not delete what it
     * could not read.
     */
    try {
      deps.storage.setItem(LEGACY_GM_QUARANTINE_KEY, raw);
      deps.storage.removeItem(LEGACY_GM_KEY);
    } catch {
      // Out of quota, or storage is read-only. Leaving both keys as they are
      // is strictly safer than half-doing this.
    }
    return {
      outcome: 'unreadable',
      campaign: null,
      message: `The GM notes saved by an earlier version of this app could not be read (${
        error instanceof Error ? error.message : String(error)
      }). Nothing has been deleted: they are still on this device under "${LEGACY_GM_QUARANTINE_KEY}".`,
      warnings: [],
    };
  }

  /*
   * Write, read back, compare, and only then delete the source.
   *
   * The comparison is over the whole record rather than a count, because a
   * count is exactly the check that would pass while a countdown's value came
   * back wrong. `stable` is used on both sides so key ordering, which a
   * structured clone need not preserve, cannot fail an identical pair.
   */
  const failed = (why: string): LegacyMigrationResult => ({
    outcome: 'not-verified',
    campaign: null,
    message: `Your GM notes could not be moved into this device's main storage (${why}). Nothing has been changed: they are still where they were, and the app will try again next time it starts.`,
    warnings,
  });

  try {
    await deps.write(built);
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }

  let readBack: Campaign | null;
  try {
    readBack = await deps.read(built.id);
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
  if (readBack === null) return failed('it could not be read back afterwards');
  if (stable(readBack) !== stable(built)) {
    return failed('what came back was not what was written');
  }

  try {
    deps.storage.removeItem(LEGACY_GM_KEY);
  } catch {
    // The campaign is written and verified, so the data is safe either way.
    // A key that will not go away means this runs again next launch and
    // overwrites the same campaign under the same id, which costs nothing.
  }

  return {
    outcome: 'migrated',
    campaign: built,
    message: null,
    warnings,
  };
}
