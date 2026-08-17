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
 * Read one campaign back out, through the same reader.
 *
 * `getCharacter` has no caller and sits in the orphan allowlist because the
 * app holds every character in memory anyway. This one does have a caller and
 * a job: it is how the localStorage migration proves the campaign it just
 * wrote is really on the disk before it deletes the source.
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

export async function deleteCampaign(id: string): Promise<void> {
  await (await db()).delete('campaigns', id);
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
