/**
 * The campaigns store: the same discipline `readLibrary` gives characters,
 * applied to the records that hold other people's characters.
 *
 * `db.ts` explains why the object store is separate. This module is the only
 * thing that reads and writes it, and it is deliberately shaped like the
 * character half of `db.ts` rather than like something new, because the two
 * failures it has to survive are the ones that file already learned:
 *
 *   - a record from a build that is newer than this one is *quarantined*, not
 *     rendered and not written over. This app makes two builds coexist on one
 *     device on purpose - `UpdateBanner` offers the waiting worker instead of
 *     swapping the bundle mid-session - so without this the old bundle reads a
 *     newer campaign, renders it as its own shape and writes it straight back.
 *     With whole character sheets inside it, that is not one lost fight.
 *
 *   - a record that is damaged is named rather than counted. `readLibrary`
 *     does this and says why: "some characters could not be read" is the
 *     sentence that makes a person open every sheet looking for the missing
 *     one. A campaign is worse, because the GM cannot open every sheet - they
 *     are not theirs.
 *
 * What is deliberately *not* here is a second copy of the schema policy.
 * `readCampaignRecord` in `shared/campaigns.ts` is the reader, the same way
 * `readCharacterRecord` is used on both the file path and the database path;
 * this module is transactions and quarantine around it.
 */
import {
  CAMPAIGN_SCHEMA_VERSION,
  readCampaignRecord,
  type Campaign,
} from '../../shared/campaigns.ts';
import { versionOf } from '../../shared/migrations.ts';
import { db, hold, StaleBuildError, type QuarantinedRecord } from './db.ts';

export interface CampaignLibrary {
  campaigns: Campaign[];
  /** Left on the disk untouched, and named to the GM. */
  quarantined: QuarantinedRecord[];
  /** Records that came back different - converted, or repaired. Write these. */
  repaired: Campaign[];
  /** One line per repair, ready to render. Never a reason to hide a campaign. */
  warnings: string[];
}

/**
 * Read every campaign, and refuse to misread any of it.
 *
 * Newest first, by `updatedAt`, which is the order a GM with three tables
 * wants: the one played last week is the one being opened tonight. The sort is
 * written plainly because `readCampaignRecord` has already made every
 * `updatedAt` a string, which is the whole point of putting every record
 * through the reader first. `listCharacters` used to be a `getAll` and a bare
 * sort over raw records, and the sort was where it fell over: one record
 * without the field made `localeCompare` throw and took the entire library
 * with it, surfacing as a banner saying everything was probably fine.
 */
export async function readCampaigns(): Promise<CampaignLibrary> {
  const all = await (await db()).getAll('campaigns');

  const campaigns: Campaign[] = [];
  const quarantined: QuarantinedRecord[] = [];
  const repaired: Campaign[] = [];
  const warnings: string[] = [];

  for (const record of all) {
    const raw = record as unknown as Record<string, unknown>;
    const id = typeof raw['id'] === 'string' ? raw['id'] : '(no id)';
    const name = typeof raw['name'] === 'string' ? raw['name'] : null;
    const stamped = typeof raw['schemaVersion'] === 'number' ? raw['schemaVersion'] : null;
    try {
      const { campaign, warnings: repairs } = readCampaignRecord(raw);
      campaigns.push(campaign);

      for (const line of repairs) {
        const said = `"${campaign.name || 'A campaign'}": ${line}.`;
        if (!warnings.includes(said)) warnings.push(said);
      }

      /*
       * Write back only what actually changed shape.
       *
       * Same reasoning as `readLibrary`: a conversion is real work that must
       * not be repeated on every launch, and a record already at this schema
       * and already whole is left alone rather than churned. The third clause
       * is the subtle one - the reader invents an `updatedAt` for a record
       * without one, so leaving it unwritten would mean a *different* invented
       * time on every launch, and a campaign that always looks like the most
       * recently played one.
       */
      const versionMoved = stamped !== CAMPAIGN_SCHEMA_VERSION;
      const identityInvented =
        typeof raw['updatedAt'] !== 'string' || typeof raw['createdAt'] !== 'string';
      if (versionMoved || repairs.length > 0 || identityInvented) repaired.push(campaign);
    } catch (error) {
      quarantined.push({
        id,
        name,
        schemaVersion: stamped,
        reason:
          error instanceof Error && error.message !== ''
            ? `That campaign ${error.message}`
            : 'That campaign could not be read by this version of the app, and has been left untouched.',
      });
    }
  }

  campaigns.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { campaigns, quarantined, repaired, warnings };
}

/**
 * Write a campaign, unless what is already there was written by a newer build.
 *
 * One extra read per write, exactly as `putCharacter` pays it, and for a
 * stronger reason: `readCampaigns` already keeps such a record out of the
 * store, so reaching this branch means something else has gone wrong - and a
 * campaign carries copies of sheets that belong to other people, who are not
 * in the room to notice.
 *
 * **The import path may not reach this function, and that is a rule and not an
 * omission.** A campaign arriving from a file comes in through `addCampaign`
 * below. The difference is not caution, it is which outcomes exist: `put`
 * writes over whatever holds that key, and a `.dhcampaign` carrying an id this
 * device already has is the ordinary case rather than the exotic one -
 * `campaignMigration.ts` mints every upgraded device's first campaign under one
 * fixed string, so two GMs who both came off the localStorage build collide on
 * it by construction, on the first table either of them ever had. Through
 * `put`, that GM loses a season to a file they were told was a copy; through
 * `add`, the arrival lands beside it and MENU's REMOVE takes either one away.
 * The guard here does not help: it refuses a record from a *newer build*, and
 * the record being destroyed in that story was written by this one.
 */
export async function putCampaign(campaign: Campaign): Promise<void> {
  const database = await db();
  const tx = hold(database.transaction('campaigns', 'readwrite'));
  const existing = (await tx.store.get(campaign.id)) as unknown as
    | Record<string, unknown>
    | undefined;

  if (existing !== undefined) {
    let stored: number;
    try {
      stored = versionOf(existing, CAMPAIGN_SCHEMA_VERSION);
    } catch {
      // A stored version this build cannot even parse is not one to write over.
      stored = Number.POSITIVE_INFINITY;
    }
    if (stored > CAMPAIGN_SCHEMA_VERSION) {
      // Let the transaction close rather than aborting it: nothing has been
      // written, and `tx.abort()` would reject `tx.done` into nobody's hands.
      await tx.done;
      throw new StaleBuildError(
        `"${campaign.name || 'This campaign'}" was last saved by a newer version of the app (campaign schema ${String(stored)}), so this one has not written over it. Close every tab of this app and open it again to load the newer version.`,
      );
    }
  }

  await tx.store.put(campaign);
  await tx.done;
}

/**
 * Write a campaign only if that id is free, and say which happened.
 *
 * `put` is what the import must not reach, and this is why it is a separate
 * function rather than a flag on that one: an occupied key is answered by
 * IndexedDB *inside* the transaction, atomically, so there is no read-then-write
 * window for a second tab to drive through. It also refuses a record a newer
 * build wrote - which `readCampaigns` above hides from every list and which
 * `putCampaign` can only answer with a throw - because `add` sees raw keys and
 * does not care whether this build could read what is there.
 *
 * **The error is named by `.name`, not by `instanceof DOMException`.** Not
 * because a test shim lacks the class: `fake-indexeddb` throws the platform
 * `DOMException` today and `instanceof` is true against it. It is because
 * `.name` is the only check that survives both realms. A rejection carrying a
 * constructor from another global - a worker, an iframe, a test double - fails
 * `instanceof` while still reading `'ConstraintError'`, and the two ways that
 * fails are an import announced as a duplicate or a duplicate announced as a
 * crash. A check that is true today by coincidence is a check that goes quietly
 * false.
 *
 * **Both absorptions of `tx.done` are deliberate.** Each one is independently
 * enough to stop the `AbortError` that a refused `add` rolls the transaction
 * back with from surfacing as an unhandled rejection - measured, not assumed -
 * and the naive body with neither leaks exactly one. `hold()` covers the caller
 * that never enters the catch; the `await` inside it is what makes the rollback
 * *finish* before `'taken'` is returned, so a caller that reads the store on the
 * next line is not racing it. The occupant is byte-identical afterwards.
 */
export async function addCampaign(campaign: Campaign): Promise<'added' | 'taken'> {
  const database = await db();
  const tx = hold(database.transaction('campaigns', 'readwrite'));
  try {
    await tx.store.add(campaign);
  } catch (error) {
    await tx.done.catch(() => {});
    if ((error as { name?: string }).name === 'ConstraintError') return 'taken';
    throw error;
  }
  await tx.done;
  return 'added';
}

/**
 * Read one campaign back out, through the same reader.
 *
 * `getCharacter` has no caller and sits in the orphan allowlist because the
 * app holds every character in memory anyway. This one does have a caller and
 * a job: it is how the localStorage migration proves the campaign it just
 * wrote is really on the disk before it deletes the source.
 *
 * The import path is the second caller, and it is there for the same reason:
 * `applyCampaignImport` reads back what `addCampaign` answered `'added'` for and
 * compares it before the screen says a word. Through the reader rather than a
 * raw `get`, on purpose - what is being checked is that the record on the disk
 * reads back as the record that was decided on, and every other path in this
 * app asks that same question of the same reader.
 */
export async function getCampaign(id: string): Promise<Campaign | null> {
  const record = await (await db()).get('campaigns', id);
  if (record === undefined) return null;
  try {
    return readCampaignRecord(record as unknown as Record<string, unknown>).campaign;
  } catch {
    return null;
  }
}

/**
 * Delete a campaign, unless what is there was written by a newer build.
 *
 * The same guard `putCampaign` carries, and it was missing here - an asymmetry
 * with a sharp edge on it. `putCampaign` refuses to *overwrite* a record from a
 * newer build because a campaign holds copies of sheets belonging to people who
 * are not in the room; a delete does not overwrite that record, it destroys it,
 * which is strictly worse than the case the guard was written for.
 *
 * Nothing in the UI can reach this today: `readCampaigns` keeps such a record
 * out of the list (:96-105), so MENU cannot offer REMOVE on one. That is an
 * argument for the guard, not against it. The one path that *must* still take
 * these records is `clearAll`, which erases the object store wholesale in
 * `db.ts` and does not come through here - see `countCampaigns`, whose whole
 * job is to count the records `clearAll` will destroy including this kind.
 */
export async function deleteCampaign(id: string): Promise<void> {
  const database = await db();
  const tx = hold(database.transaction('campaigns', 'readwrite'));
  const existing = (await tx.store.get(id)) as unknown as Record<string, unknown> | undefined;

  if (existing !== undefined) {
    let stored: number;
    try {
      stored = versionOf(existing, CAMPAIGN_SCHEMA_VERSION);
    } catch {
      // A stored version this build cannot even parse is not one to destroy.
      stored = Number.POSITIVE_INFINITY;
    }
    if (stored > CAMPAIGN_SCHEMA_VERSION) {
      // Let the transaction close rather than aborting it, as `putCampaign`
      // does: nothing has been deleted, and `tx.abort()` would reject `tx.done`
      // into nobody's hands.
      await tx.done;
      const name = typeof existing['name'] === 'string' ? existing['name'] : '';
      throw new StaleBuildError(
        `"${name || 'This campaign'}" was last saved by a newer version of the app (campaign schema ${String(stored)}), so this one has not deleted it. Close every tab of this app and open it again to load the newer version.`,
      );
    }
  }

  await tx.store.delete(id);
  await tx.done;
}

/**
 * How many campaign records are on this device, readable or not.
 *
 * `readCampaigns().campaigns.length` is the wrong number for the one caller
 * this has. That array deliberately holds back a record a newer build wrote
 * (:96-105), and `clearAll` deletes that record all the same - so a
 * confirmation counting only the readable ones would undercount what the
 * button is about to destroy, which is the same failure as not counting them
 * at all. The caller is a sentence a person reads before erasing everything;
 * the number in it has to be the number of records that go.
 *
 * A `count` request rather than a `getAll().length` because a campaign carries
 * whole copies of other people's sheets (`shared/campaigns.ts`), and
 * deserialising all of them to produce one integer for one sentence is work
 * nobody asked for.
 */
export async function countCampaigns(): Promise<number> {
  return (await db()).count('campaigns');
}
