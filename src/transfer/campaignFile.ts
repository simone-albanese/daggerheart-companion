/**
 * The `.dhcampaign` file: a GM's table, out of the app and onto a disk.
 *
 * A thin adapter over what `fileIo.ts` already does, and deliberately nothing
 * more. Same envelope - `format`, a schema version, `app`, `exportedAt` and one
 * payload field - same `saveTextFile` with its three routes, same readable
 * JSON that can be opened in a text editor when everything else has gone
 * wrong. The only thing it adds is the checksum, and that is not an addition
 * so much as a debt being paid.
 *
 * ## Why this one carries a CRC when `.dhchar` does not
 *
 * P0-6 gave the QR codec a checksum of its own and, more importantly, put the
 * check *inside the decoder* so that no receive surface could forget it. This
 * is the fourth format in the app and the rule it must not break is that one:
 * there is exactly one way in - `parseCampaignFile` - and it verifies before it
 * returns. A caller cannot opt out, because there is nothing else to call.
 *
 * The CRC covers `JSON.stringify(campaign)`, compact, which is what the writer
 * hashed and what the reader recomputes. `JSON.parse` preserves the order of
 * string keys, so a file this app wrote round-trips to the same bytes; a file
 * whose contents changed does not. What it therefore catches is a truncated
 * download, a corrupted transfer, a half-written file - the accidental damage
 * `crc32.ts` says it is for, and no more than that. It is not a signature, and
 * anyone who can rewrite the bytes can rewrite the checksum with them.
 *
 * A file with no `checksum` field at all is refused rather than waved through.
 * A check that can be removed by deleting a line is a check a receive surface
 * *can* forget, which is the exact thing P0-6 closed.
 *
 * ## What this is not
 *
 * There is no import here. Taking a campaign in raises questions this lane did
 * not settle - a campaign whose id is already on this device, and a party of
 * character sheets arriving beside a `characters` store that may hold newer
 * copies of the same people - and half of an import is worse than none.
 */
import {
  CAMPAIGN_SCHEMA_VERSION,
  OLDEST_READABLE_CAMPAIGN,
  readCampaignRecord,
  type Campaign,
} from '../../shared/campaigns.ts';
import { checkReadable, SchemaError, versionOf } from '../../shared/migrations.ts';
import { slugify } from '../../shared/slugify.ts';
import { crc32 } from './crc32.ts';
import {
  APP_VERSION,
  ImportError,
  saveTextFile,
  type SaveOptions,
  type SaveResult,
} from './fileIo.ts';

export const CAMPAIGN_FORMAT = 'dhcampaign';
export const CAMPAIGN_EXTENSION = '.dhcampaign';

export interface CampaignFile {
  format: typeof CAMPAIGN_FORMAT;
  /** The *campaign* schema. Characters have their own and it is not this. */
  schemaVersion: number;
  app: string;
  exportedAt: string;
  /** crc32 over `JSON.stringify(campaign)`. Checked on the way in, always. */
  checksum: number;
  campaign: Campaign;
}

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The one hash, used by both ends. Two copies of this would be one too many. */
export const campaignChecksum = (campaign: Campaign): number =>
  crc32(bytes(JSON.stringify(campaign)));

export const serializeCampaign = (campaign: Campaign, at: Date = new Date()): string =>
  `${JSON.stringify(
    {
      format: CAMPAIGN_FORMAT,
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      app: APP_VERSION,
      exportedAt: at.toISOString(),
      checksum: campaignChecksum(campaign),
      campaign,
    } satisfies CampaignFile,
    null,
    2,
  )}\n`;

export const campaignFileName = (c: Campaign): string =>
  `${slugify(c.name) || 'campaign'}${CAMPAIGN_EXTENSION}`;

export interface ImportedCampaign {
  campaign: Campaign;
  app: string | null;
  exportedAt: string | null;
  /** Repairs the reader made. Named, never counted. */
  warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read a `.dhcampaign`, and verify it before handing any of it back.
 *
 * Order matters and is the codec's: the version is read before the checksum,
 * because a file this build cannot read at all is not necessarily damaged, and
 * checking the checksum first would report every future format as corruption
 * and send the user looking for a bad disk.
 */
export function parseCampaignFile(text: string): ImportedCampaign {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('That file is not valid JSON, so it is not a Daggerheart campaign.');
  }
  if (!isRecord(parsed)) throw new ImportError('That file does not contain a campaign.');

  const format = parsed['format'];
  if (format !== CAMPAIGN_FORMAT) {
    throw new ImportError(
      typeof format === 'string'
        ? `That is a "${format}" file, not a Daggerheart campaign (${CAMPAIGN_EXTENSION}).`
        : `That file is not a Daggerheart campaign: it has no "format" field. Expected "${CAMPAIGN_FORMAT}".`,
    );
  }

  try {
    checkReadable(
      versionOf({ schemaVersion: parsed['schemaVersion'] }, CAMPAIGN_SCHEMA_VERSION),
      CAMPAIGN_SCHEMA_VERSION,
      OLDEST_READABLE_CAMPAIGN,
    );
  } catch (error) {
    if (error instanceof SchemaError) throw new ImportError(`That campaign file ${error.message}`);
    throw error;
  }

  const stamped = parsed['checksum'];
  if (typeof stamped !== 'number') {
    throw new ImportError(
      'That campaign file carries no checksum, so there is no way to tell whether it arrived whole. It has not been imported.',
    );
  }

  const payload = parsed['campaign'];
  const found = crc32(bytes(JSON.stringify(payload)));
  if (found !== stamped) {
    throw new ImportError(
      'That campaign file is damaged: its checksum does not match what is inside it, so nothing has been imported. If you edited it by hand, that will do this too.',
    );
  }

  const { campaign, warnings } = readCampaignRecord(payload);
  return {
    campaign,
    app: typeof parsed['app'] === 'string' ? parsed['app'] : null,
    exportedAt: typeof parsed['exportedAt'] === 'string' ? parsed['exportedAt'] : null,
    warnings,
  };
}

/**
 * Write a campaign out, having first read back what is about to be written.
 *
 * `backup.ts` learned this in P0-5 and states it as "an unverified backup is
 * not a backup". The same argument applies a step earlier here: a file offered
 * to the user is one they will reach for on the day the device is gone, and
 * handing them a `.dhcampaign` this app cannot open is worse than telling them
 * the export did not work. The parse costs one pass over a few kilobytes and
 * it exercises the checksum, the envelope and the reader in one go.
 */
export async function exportCampaign(
  campaign: Campaign,
  options: SaveOptions & { at?: Date } = {},
): Promise<SaveResult> {
  const fileName = campaignFileName(campaign);
  const text = serializeCampaign(campaign, options.at);

  try {
    const back = parseCampaignFile(text);
    if (back.campaign.id !== campaign.id) {
      throw new ImportError('it came back holding a different campaign');
    }
  } catch (error) {
    return {
      ok: false,
      route: null,
      fileName,
      cancelled: false,
      reason: `${fileName} was built but could not be read back (${
        error instanceof Error ? error.message : String(error)
      }), so it has not been saved.`,
    };
  }

  return saveTextFile(fileName, text, options);
}
