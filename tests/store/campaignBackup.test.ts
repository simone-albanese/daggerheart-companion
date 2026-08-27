/**
 * The bytes a backup leaves behind, and whether a later build can still read
 * them.
 *
 * A `.dhbackup` is only worth writing if it can be restored, and a
 * `.dhcampaign` written by tonight's build has to be restorable by next year's.
 * Nothing else in this repo asserts that end of it for a campaign: the schema
 * tests walk *records* forward through `CAMPAIGN_MIGRATIONS`, and the file
 * tests check the envelope, but the backup regime writes a whole file per
 * campaign per play night and the question it must answer is the one asked on
 * the day the device is gone.
 *
 * ## The frozen fixture, and the discipline around it
 *
 * `tests/fixtures/schema/v4.dhcampaign` was written once, by the build that
 * shipped campaign schema 4, and is **never regenerated**. That is the rule
 * `shared/migrations.ts` states and `v1.dhcampaign` already follows: a fixture
 * a later build rewrites proves only that the later build agrees with itself.
 * Its payload is the committed `v4.campaign.json` with a whole schema-3
 * character in the party row, because the character chain runs *inside*
 * `readCampaignRecord` and a nine-field stub would be dropped before it could
 * prove anything.
 *
 * So it goes green today at 4 and it stays green at 5 without being edited -
 * or it goes red, which is precisely what a bump shipping without its `from: 4`
 * converter should do to a backup that is on a GM's disk already.
 *
 * No assertion here names a campaign schema number. Every one is written
 * against `CAMPAIGN_SCHEMA_VERSION`, so the bump moves them rather than
 * breaking them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_SCHEMA_VERSION,
  newCampaign,
  type Campaign,
} from '../../shared/campaigns.ts';
import { SCHEMA_VERSION } from '../../shared/types.ts';
import { campaignBackupFileName } from '../../src/store/backup.ts';
import {
  CAMPAIGN_FORMAT,
  campaignChecksum,
  parseCampaignFile,
} from '../../src/transfer/campaignFile.ts';
import { crc32 } from '../../src/transfer/crc32.ts';
import { ImportError } from '../../src/transfer/fileIo.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));

const frozen = (): string => readFileSync(join(FIXTURES, 'v4.dhcampaign'), 'utf8');

/** The payload exactly as the frozen file carries it, before the reader sees it. */
const frozenPayload = (): Record<string, unknown> =>
  (JSON.parse(frozen()) as { campaign: Record<string, unknown> }).campaign;

/**
 * An envelope built by hand, because `serializeCampaign` always stamps the
 * current schema and the interesting files are the ones that do not.
 */
const envelope = (payload: unknown, schemaVersion: number): string =>
  `${JSON.stringify(
    {
      format: CAMPAIGN_FORMAT,
      schemaVersion,
      app: '0.6.0',
      exportedAt: '2026-08-15T20:00:00.000Z',
      checksum: crc32(new TextEncoder().encode(JSON.stringify(payload))),
      campaign: payload,
    },
    null,
    2,
  )}\n`;

const table = (name: string, id: string): Campaign =>
  newCampaign(name, '2026-08-10T18:00:00.000Z', id);

describe('a backup file written by an older build', () => {
  const parsed = (): ReturnType<typeof parseCampaignFile> => parseCampaignFile(frozen());

  it('opens without complaint, and repairs nothing on the way through', () => {
    expect(() => parsed()).not.toThrow();
    // A repair warning here would mean the fixture is not a clean schema-4
    // record, and every comparison below would be measuring the repair.
    expect(parsed().warnings).toEqual([]);
    expect(parsed().app).toBe('0.6.0');
  });

  it('comes back stamped at the schema this build reads', () => {
    expect(parsed().campaign.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
  });

  /**
   * Both chains run inside the reader, and this is the second one.
   *
   * A party row carries a whole `Character`, and until schema 3 that sheet was
   * the one road into this app that never passed `migrateCharacterRecord`. The
   * fixture's sheet is stamped below the current character schema on purpose,
   * so a restore that stopped walking it would show up here rather than as a
   * board that will not draw.
   */
  it('walks the players’ sheets through the character chain as well', () => {
    const sheet = parsed().campaign.party[0]!.sheet;
    const before = (frozenPayload()['party'] as { sheet: { schemaVersion: number } }[])[0]!.sheet;

    expect(before.schemaVersion).toBeLessThan(SCHEMA_VERSION);
    expect(sheet.schemaVersion).toBe(SCHEMA_VERSION);
    // The sheet itself is the same person, not a blank one filled in: refusal,
    // not repair, is what `readPartyMember` does to a sheet it cannot read.
    expect(sheet.name).toBe('Ilya of the Ninth');
    expect(sheet.level).toBe(3);
    expect(sheet.hp).toEqual({ marked: 2, max: 5 });
    expect(sheet.traits.strength).toBe(2);
  });

  it('gives back every field the older build wrote, apart from the stamp', () => {
    const back = parsed().campaign;
    const raw = frozenPayload();

    expect({
      id: back.id,
      name: back.name,
      createdAt: back.createdAt,
      updatedAt: back.updatedAt,
      fear: back.fear,
    }).toEqual({
      id: raw['id'],
      name: raw['name'],
      createdAt: raw['createdAt'],
      updatedAt: raw['updatedAt'],
      fear: raw['fear'],
    });

    expect(back.session).toEqual(raw['session']);
    expect(back.board).toEqual(raw['board']);
    expect(back.archive).toEqual(raw['archive']);

    // The party row minus the sheet, which walked its own chain above.
    const { sheet: _walked, ...row } = back.party[0]!;
    const { sheet: _was, ...wasRow } = (raw['party'] as Record<string, unknown>[])[0]!;
    expect(row).toEqual(wasRow);
  });

  /**
   * A register entry this build has no reader for is kept, not dropped - which
   * is the difference between a restore and a lossy one. The original bytes go
   * into `raw`, so the build that does understand it can still have it.
   */
  it('keeps a register entry it cannot read rather than dropping it', () => {
    const raw = frozenPayload();
    const before = (raw['register'] as Record<string, unknown>[])[2]!;
    const after = parsed().campaign.register[2]!;

    expect(after.id).toBe(before['id']);
    expect(after.name).toBe(before['name']);
    expect(after.kind).toBe('unreadable');
    expect(after.kind === 'unreadable' ? after.raw : '').toContain(String(before['kind']));
  });
});

describe('the version window a backup has to survive', () => {
  /**
   * What this holds today, and what it holds after the next bump - they are
   * not the same thing, and saying so is the point.
   *
   * Today every campaign converter changes no field on purpose: the numbers
   * move so that *older* builds refuse a record carrying something they cannot
   * draw, not because anything in the older record is wrong. `readCampaignRecord`
   * also restamps its output unconditionally. So nothing here can observe
   * `applyChain` running - deleting the call leaves this green, which was
   * checked rather than assumed, and the chain being reached at all is held by
   * `tests/store/campaignSchema.test.ts` walking the frozen `vN.campaign.json`
   * fixtures. This file must not add to that one.
   *
   * What it holds today is the window: the schema before this one is inside it.
   * The day `CAMPAIGN_SCHEMA_VERSION` moves without its `from` converter, this
   * and the frozen file above both go red with `applyChain`'s own sentence -
   * which is exactly what should happen to a backup already on a GM's disk.
   */
  it('takes a record from the schema before this one and gives it back current', () => {
    const before = CAMPAIGN_SCHEMA_VERSION - 1;
    const payload = { ...table('The Sablewood Winter', 'winter-1'), schemaVersion: before };

    const back = parseCampaignFile(envelope(payload, before)).campaign;
    expect(back.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(back.name).toBe('The Sablewood Winter');
    expect(back.id).toBe('winter-1');
  });

  /**
   * The 4→5 bump's own message, arriving through the door the restore uses.
   *
   * Not a corruption sentence, and the remedy is in it: the file is fine, this
   * build is behind. The envelope check runs before the checksum precisely so a
   * future format is never reported as a bad disk.
   */
  it('refuses a record from a build ahead of this one, and says which', () => {
    const ahead = CAMPAIGN_SCHEMA_VERSION + 1;
    const payload = { ...table('The Sablewood Winter', 'winter-1'), schemaVersion: ahead };

    expect(() => parseCampaignFile(envelope(payload, ahead))).toThrow(ImportError);
    try {
      parseCampaignFile(envelope(payload, ahead));
      expect.unreachable('a file from a newer build was read as if this build understood it');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/newer version of the app/);
      expect(message).toMatch(/Update the app/);
      expect(message).toMatch(/it has not been changed/);
      expect(message).toContain(String(ahead));
      expect(message).toContain(String(CAMPAIGN_SCHEMA_VERSION));
    }
  });

  it('reports a file whose bytes changed as damaged rather than as a bad version', () => {
    const payload = table('The Sablewood Winter', 'winter-1');
    const text = envelope(payload, CAMPAIGN_SCHEMA_VERSION).replace(
      '"fear": 0',
      '"fear": 9',
    );

    expect(() => parseCampaignFile(text)).toThrow(/checksum does not match/);
    // And the checksum is over what the file carried, not over what the reader
    // would have made of it - so an honest old file cannot be called damaged by
    // a migration that changes a field.
    expect(campaignChecksum(payload)).toBe(
      (JSON.parse(envelope(payload, CAMPAIGN_SCHEMA_VERSION)) as { checksum: number }).checksum,
    );
  });
});

describe('the name a campaign backup file gets', () => {
  const at = new Date('2026-08-15T20:00:00.000Z');

  it('carries the campaign, the id and the day, in that order', () => {
    expect(campaignBackupFileName(table('The Sablewood Winter', 'winter-1'), at)).toBe(
      'daggerheart-the-sablewood-winter-c94c8729-2026-08-15.dhcampaign',
    );
  });

  it('says the same thing twice about the same campaign', () => {
    const winter = table('The Sablewood Winter', 'winter-1');
    expect(campaignBackupFileName(winter, at)).toBe(campaignBackupFileName({ ...winter }, at));
  });

  /**
   * `slugify` keeps `[a-z0-9]` and nothing else, so a table named in Japanese
   * slugifies to the empty string. Without the fallback the file would be
   * called `daggerheart--<hex>-<date>`; without the hex, every such table on
   * the device would be called the same thing and the folder would hold one
   * file where it should hold three.
   */
  it('still names a file for a campaign whose name has no Latin letters in it', () => {
    const one = campaignBackupFileName(table('冬の森', 'winter-1'), at);
    const two = campaignBackupFileName(table('冬の森', 'reach-1'), at);

    expect(one).toBe('daggerheart-campaign-c94c8729-2026-08-15.dhcampaign');
    expect(one).not.toBe(two);
    for (const name of [one, two]) {
      expect(name).toMatch(/^[a-z0-9-]+\.dhcampaign$/);
      expect(name).not.toContain('/');
    }
  });

  it('is a different file on a different day, so nothing overwrites yesterday', () => {
    const winter = table('The Sablewood Winter', 'winter-1');
    expect(campaignBackupFileName(winter, at)).not.toBe(
      campaignBackupFileName(winter, new Date('2026-08-16T01:00:00.000Z')),
    );
  });
});
