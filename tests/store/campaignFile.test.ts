/**
 * The fourth file format in this app, and the rule it must not break.
 *
 * P0-6 gave the QR codec a checksum of its own and, more to the point, put the
 * check *inside the decoder*, so no receive surface could forget it. A fourth
 * format that carried a checksum nobody verified, or verified in one caller
 * and not another, would undo that on the day it shipped.
 *
 * So the questions here are: is there exactly one way in, does it verify
 * before it returns anything, and does it refuse a file that carries no
 * checksum at all - because a check you can remove by deleting a line is a
 * check a receive surface can forget.
 *
 * And one more, from the other direction: `backup.ts` says an unverified
 * backup is not a backup. A file offered to a GM is one they will reach for on
 * the day the device is gone, so the export reads back what it is about to
 * write before it hands it over.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_SCHEMA_VERSION,
  newCampaign,
  OLDEST_READABLE_CAMPAIGN,
  type Campaign,
} from '../../shared/campaigns.ts';
import { checkReadable, SchemaError } from '../../shared/migrations.ts';
import {
  CAMPAIGN_EXTENSION,
  campaignChecksum,
  campaignFileName,
  exportCampaign,
  parseCampaignFile,
  serializeCampaign,
} from '../../src/transfer/campaignFile.ts';
import * as fileIo from '../../src/transfer/fileIo.ts';

const at = new Date('2026-08-16T10:00:00.000Z');

const campaign = (): Campaign => ({
  ...newCampaign('The Sablewood Winter', '2026-02-01T19:30:00.000Z', 'c-1'),
  fear: 7,
  session: [
    {
      id: 'i1',
      kind: 'countdown',
      name: 'The ice gives way',
      order: 0,
      collapsed: false,
      primary: true,
      countdown: {
        id: 'i1',
        name: 'The ice gives way',
        kind: 'standard',
        start: 6,
        value: 4,
        notes: '',
      },
    },
    {
      id: 'i2',
      kind: 'link',
      name: 'How falling works',
      order: 1,
      collapsed: true,
      target: { kind: 'rule', ref: 'falling-and-collision' },
    },
  ],
});

/** Take a written file apart, change one thing, and put it back together. */
const tamper = (text: string, f: (v: Record<string, unknown>) => void): string => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  f(parsed);
  return JSON.stringify(parsed, null, 2);
};

describe('the envelope, which is the one `fileIo` already uses', () => {
  it('names the format, the app and when it left', () => {
    const file = JSON.parse(serializeCampaign(campaign(), at)) as Record<string, unknown>;
    expect(file['format']).toBe('dhcampaign');
    expect(file['app']).toBe(fileIo.APP_VERSION);
    expect(file['exportedAt']).toBe('2026-08-16T10:00:00.000Z');
  });

  it('stamps the campaign schema, not the character one', () => {
    // Getting this wrong would make every campaign file unreadable the first
    // time `SCHEMA_VERSION` moves for a reason that has nothing to do with it.
    const file = JSON.parse(serializeCampaign(campaign(), at)) as Record<string, unknown>;
    expect(file['schemaVersion']).toBe(CAMPAIGN_SCHEMA_VERSION);
  });

  it('names the file after the campaign', () => {
    expect(campaignFileName(campaign())).toBe(`the-sablewood-winter${CAMPAIGN_EXTENSION}`);
  });

  it('falls back to a name rather than an empty one', () => {
    expect(campaignFileName({ ...campaign(), name: '   ' })).toBe(`campaign${CAMPAIGN_EXTENSION}`);
  });

  it('is readable JSON a person could open in an editor', () => {
    expect(serializeCampaign(campaign(), at)).toContain('\n  "format": "dhcampaign"');
  });
});

describe('the round trip', () => {
  it('brings the campaign back whole', () => {
    const before = campaign();
    const { campaign: after, warnings } = parseCampaignFile(serializeCampaign(before, at));
    expect(warnings).toEqual([]);
    expect(after).toEqual(before);
  });

  it('brings the envelope’s own facts back too', () => {
    const file = parseCampaignFile(serializeCampaign(campaign(), at));
    expect(file.app).toBe(fileIo.APP_VERSION);
    expect(file.exportedAt).toBe('2026-08-16T10:00:00.000Z');
  });
});

describe('the checksum, which no way in can skip', () => {
  it('refuses a file whose contents were changed under it', () => {
    const damaged = tamper(serializeCampaign(campaign(), at), (file) => {
      (file['campaign'] as Record<string, unknown>)['fear'] = 1;
    });
    expect(() => parseCampaignFile(damaged)).toThrow(/damaged.*checksum/s);
    expect(() => parseCampaignFile(damaged)).toThrow(/nothing has been imported/);
  });

  it('notices a change deep inside the session list, not just at the top', () => {
    const damaged = tamper(serializeCampaign(campaign(), at), (file) => {
      const session = (file['campaign'] as { session: { countdown?: { value: number } }[] })
        .session;
      session[0]!.countdown!.value = 1;
    });
    expect(() => parseCampaignFile(damaged)).toThrow(/damaged/);
  });

  it('refuses a file that carries no checksum at all', () => {
    // A check you can remove by deleting a line is a check a receive surface
    // can forget, which is the exact thing P0-6 closed.
    const stripped = tamper(serializeCampaign(campaign(), at), (file) => {
      delete file['checksum'];
    });
    expect(() => parseCampaignFile(stripped)).toThrow(/carries no checksum/);
  });

  it('survives having its whitespace reformatted, which is not damage', () => {
    const reflowed = JSON.stringify(JSON.parse(serializeCampaign(campaign(), at)));
    expect(parseCampaignFile(reflowed).campaign.fear).toBe(7);
  });

  it('is one function, used by both ends', () => {
    const c = campaign();
    const file = JSON.parse(serializeCampaign(c, at)) as { checksum: number };
    expect(file.checksum).toBe(campaignChecksum(c));
  });
});

describe('the refusals that are not corruption', () => {
  it('says which format a file actually is', () => {
    expect(() => parseCampaignFile(JSON.stringify({ format: 'dhchar' }))).toThrow(
      /"dhchar" file, not a Daggerheart campaign/,
    );
  });

  it('says a file with no format field is not one of ours', () => {
    expect(() => parseCampaignFile(JSON.stringify({ campaign: {} }))).toThrow(/no "format" field/);
  });

  it('says a file that is not JSON is not JSON', () => {
    expect(() => parseCampaignFile('{ nope')).toThrow(/not valid JSON/);
  });

  it('reads the version before the checksum, so a future file is not called damaged', () => {
    // Order matters. Checking the checksum first would report every format
    // this build does not know as corruption and send the user hunting for a
    // bad disk instead of an app update.
    const ahead = tamper(serializeCampaign(campaign(), at), (file) => {
      file['schemaVersion'] = CAMPAIGN_SCHEMA_VERSION + 1;
      file['checksum'] = 0;
    });
    expect(() => parseCampaignFile(ahead)).toThrow(/newer version of the app/);
    expect(() => parseCampaignFile(ahead)).not.toThrow(/damaged/);
  });
});

describe('writing it out', () => {
  it('goes through the same saveTextFile every other export uses', async () => {
    const spy = vi.spyOn(fileIo, 'saveTextFile').mockResolvedValue({
      ok: true,
      route: 'download',
      fileName: 'x',
      cancelled: false,
      reason: null,
    });

    await exportCampaign(campaign(), { at });

    expect(spy).toHaveBeenCalledOnce();
    const [fileName, text] = spy.mock.calls[0]!;
    expect(fileName).toBe(`the-sablewood-winter${CAMPAIGN_EXTENSION}`);
    expect(parseCampaignFile(text).campaign.name).toBe('The Sablewood Winter');
    spy.mockRestore();
  });

  it('does not offer a file it could not read back', async () => {
    // `backup.ts`: an unverified backup is not a backup. A `.dhcampaign` this
    // app cannot open is worse than being told the export did not work.
    const save = vi.spyOn(fileIo, 'saveTextFile');
    // A campaign with no id: the reader refuses it, because a record with no
    // handle cannot be written back without inventing one.
    const broken = { ...campaign(), id: '' };

    const result = await exportCampaign(broken, { at });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/could not be read back/);
    expect(save).not.toHaveBeenCalled();
    save.mockRestore();
  });
});

/**
 * The `.dhcampaign` version window: which files this build takes, and which
 * files it hands to a build that is not this one.
 *
 * There is no separate number for the file. `parseCampaignFile` calls
 * `checkReadable(version, CAMPAIGN_SCHEMA_VERSION, OLDEST_READABLE_CAMPAIGN)`,
 * so the window is the record schema's window and moves with it - which is the
 * right shape, because a `.dhcampaign` is a campaign record in an envelope and
 * two numbers that had to be kept in step would eventually not be.
 *
 * The bump to 2 moved that window, and moving a window has two edges. Both are
 * asserted here against a real file rather than argued.
 */
describe('the version window the bump moved', () => {
  const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));

  it('takes a v1 file at this v2 build, and walks the record forward', () => {
    /*
     * The lower edge. `tests/fixtures/schema/v1.dhcampaign` is a real envelope
     * round the frozen v1 record, checksum and all, committed rather than built
     * here - a file generated by the code under test proves only that this
     * build can read its own output.
     *
     * Note what the checksum does *not* have to survive: it is verified against
     * the payload as it arrived, before the chain runs, so a migration that
     * changes a field cannot make an honest old file look damaged.
     */
    const text = readFileSync(join(FIXTURES, 'v1.dhcampaign'), 'utf8');
    expect((JSON.parse(text) as { schemaVersion: number }).schemaVersion).toBe(1);

    const { campaign: back, warnings, app } = parseCampaignFile(text);

    expect(warnings).toEqual([]);
    expect(back.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(app).toBe('0.2.0');
    // Whole, not merely parsed: the things a GM would notice missing.
    expect(back.name).toBe('The Sablewood Winter');
    expect(back.fear).toBe(7);
    expect(back.session.map((i) => i.kind)).toEqual([
      'scene',
      'encounter',
      'countdown',
      'link',
      'link',
    ]);
    expect(back.party[0]!.sheet.name).toBe('Ilya of the Ninth');
  });

  it('hands a v2 file to a v1-only build as a refusal, not as damage', () => {
    /*
     * The upper edge, and the whole reason the number moved.
     *
     * A build that predates `url` and `note` must refuse this file rather than
     * read it: its `readSessionItem` would wrap both new rows as `unreadable`
     * and its `gmStore` would write that reading back 400ms later, destroying
     * two rows the GM can still see on the newer device.
     *
     * `CAMPAIGN_SCHEMA_VERSION` is a module constant and this suite cannot
     * lower it, so the guard is called with the old build's numbers - which is
     * exactly the call `parseCampaignFile` makes, with `current` and `oldest`
     * as they read in a build that had never left schema 1. The file itself is
     * the real one this build writes.
     */
    const written = JSON.parse(serializeCampaign(campaign(), at)) as { schemaVersion: number };
    expect(written.schemaVersion).toBe(2);

    // What a v1-only build does with it.
    expect(() => checkReadable(written.schemaVersion, 1, 1)).toThrow(SchemaError);
    expect(() => checkReadable(written.schemaVersion, 1, 1)).toThrow(
      /newer version of the app.*Update the app.*it has not been changed/s,
    );
    // And what it does with a file of its own, so the refusal is about the
    // version rather than about the guard refusing everything.
    expect(() => checkReadable(1, 1, 1)).not.toThrow();
  });

  it('takes its own file at its own version, which is the third edge', () => {
    // The control. A window that refused both ends would pass both assertions
    // above and take nothing at all.
    expect(parseCampaignFile(serializeCampaign(campaign(), at)).campaign.fear).toBe(7);
    expect(
      OLDEST_READABLE_CAMPAIGN,
      'a v1 file on somebody’s disk stops being readable the moment this rises',
    ).toBe(1);
  });
});
