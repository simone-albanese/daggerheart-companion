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
import {
  CAMPAIGN_SCHEMA_VERSION,
  readCampaignRecord,
  type Campaign,
} from '../../shared/campaigns.ts';
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
 */
function stable(value: unknown): string {
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
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
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
