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
import { NO_CLOCK_PROSE } from '../fixtures/factories.ts';

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
      sceneId: null,
      countdown: {
        id: 'i1',
        name: 'The ice gives way',
        kind: 'standard',
        start: 6,
        value: 4,
        notes: '',
        ...NO_CLOCK_PROSE,
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

  it('carries the fight on its row and the scene a clock belongs to, out and back', () => {
    /*
     * The assertion `CAMPAIGN_SCHEMA_VERSION` 4 and 5 both exist for.
     *
     * Neither field costs the transfer layer a line - `serializeCampaign` is
     * `JSON.stringify` of the whole record - and that is exactly why it is
     * worth pinning here rather than assuming. The reader rebuilds `board` and
     * every row field by field and drops what it does not name, so a bump that
     * added the fields to the type and forgot one seat in `readCampaignRecord`
     * would typecheck, run, and lose the pointer on the first save and load.
     *
     * The scene row carries a fight with a mark on it, because a fight that
     * came back empty would pass a test that only looked at the pointer. At
     * schema 4 that fight was on the board and this row was the one it had come
     * from; at 5 the row is where it lives and `openScene` only says which row
     * the runner has open. What the file has to carry is the same either way,
     * which is why the test survived the change with one field renamed.
     */
    const before: Campaign = {
      ...campaign(),
      session: [
        ...campaign().session,
        {
          id: 's1',
          kind: 'scene',
          name: 'The frozen ford',
          order: 2,
          collapsed: true,
          environmentRef: 'raging-river',
          roster: [],
          adjustments: { easier: false, harder: false, damageBump: false },
          combatants: [
            {
              id: 'jagged-knife-bandit-0',
              adversaryRef: 'jagged-knife-bandit',
              name: 'Jagged Knife Bandit',
              hp: { max: 4, marked: 3 },
              stress: { max: 3, marked: 1 },
              thresholds: [4, 8],
              difficulty: 10,
              spotlighted: false,
              notes: '',
            },
          ],
        },
        {
          id: 'i3',
          kind: 'countdown',
          name: 'The ford thaws',
          order: 3,
          collapsed: true,
          primary: false,
          sceneId: 's1',
          countdown: {
            id: 'i3',
            name: 'The ford thaws',
            kind: 'standard',
            start: 6,
            value: 5,
            notes: '',
            ...NO_CLOCK_PROSE,
          },
        },
      ],
      board: { ...campaign().board, openScene: 's1' },
    };

    const { campaign: after, warnings } = parseCampaignFile(serializeCampaign(before, at));

    expect(warnings).toEqual([]);
    expect(after).toEqual(before);
    expect(after.board.openScene).toBe('s1');

    const thaw = after.session.find((i) => i.id === 'i3');
    expect(thaw?.kind === 'countdown' && thaw.sceneId).toBe('s1');

    const ford = after.session.find((i) => i.id === 's1');
    expect(ford?.kind === 'scene' && ford.combatants[0]?.hp.marked).toBe(3);

    // The pinned clock is untouched by a scope on another row.
    const ice = after.session.find((i) => i.id === 'i1');
    expect(ice?.kind === 'countdown' && ice.sceneId).toBe(null);
    expect(ice?.kind === 'countdown' && ice.primary).toBe(true);
  });

  it('carries two scene rows each holding its own fight, and which of them is open', () => {
    /*
     * The state schema 5 exists to make expressible, taken out to a file and
     * back. Two fights standing at once was not a thing a schema-4 record could
     * say: one board held the fight, `runScene` emptied a row to take one and
     * filled it again to put one down, so the second fight only ever existed as
     * a row nobody was playing.
     *
     * Both rows hold a body with the SAME id, which is the property that makes
     * the file interesting rather than the pointer. `makeCombatant` numbers
     * from 0 in every fight it builds, so `acid-burrower-0` in the ford and
     * `acid-burrower-0` in the camp are two different adversaries with two
     * different marks - and a reader that keyed a body by its id alone, or a
     * writer that pooled the two lists, would bring back one of them twice.
     */
    const at2 = (id: string, marked: number, notes: string) => ({
      id: 'acid-burrower-0',
      adversaryRef: 'acid-burrower',
      name: 'Acid Burrower',
      hp: { max: 8, marked },
      stress: { max: 3, marked: 0 },
      thresholds: [8, 15] as [number, number],
      difficulty: 14,
      spotlighted: false,
      notes: `${id}: ${notes}`,
    });
    const row = (id: string, name: string, marked: number, notes: string) => ({
      id,
      kind: 'scene' as const,
      name,
      order: 2,
      collapsed: false,
      environmentRef: null,
      roster: [],
      adjustments: { easier: false, harder: false, damageBump: false },
      combatants: [at2(id, marked, notes)],
    });

    const before: Campaign = {
      ...campaign(),
      session: [
        ...campaign().session,
        row('s1', 'The frozen ford', 3, 'on the far bank'),
        { ...row('s2', 'The bandit camp', 1, 'still burrowed'), order: 3 },
      ],
      board: { ...campaign().board, openScene: 's2' },
    };

    const { campaign: after, warnings } = parseCampaignFile(serializeCampaign(before, at));

    expect(warnings).toEqual([]);
    expect(after).toEqual(before);
    expect(after.board.openScene).toBe('s2');

    const fights = after.session.flatMap((i) => (i.kind === 'scene' ? [i.combatants] : []));
    expect(fights.map((f) => f[0]?.hp.marked)).toEqual([3, 1]);
    expect(fights.map((f) => f[0]?.notes)).toEqual(['s1: on the far bank', 's2: still burrowed']);
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

  it('takes a v1 file at this build, and walks the record forward', () => {
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

    // The one warning is the frozen fixture's party stub, which `readPartyMember`
    // refuses because the board could not have drawn it. Nothing about the
    // envelope, the checksum or the session list needed saying.
    expect(warnings.filter((w) => !w.includes('not a whole character'))).toEqual([]);
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
    // And the party row is gone with it: this file's party is a nine-field
    // stand-in, so what survives the trip is the campaign around it.
    expect(back.party).toEqual([]);
    expect(warnings.join(' ')).toContain('Ilya of the Ninth');
  });

  it('hands a file this build writes to a v1-only build as a refusal, not as damage', () => {
    /*
     * The upper edge, and the whole reason the number has moved every time it
     * has moved. Four times, counted rather than carried: `CAMPAIGN_MIGRATIONS`
     * holds one entry per move and its `from` values are 1, 2, 3 and 4.
     *
     * A build that predates `url` and `note` must refuse this file rather than
     * read it: its `readSessionItem` would wrap both new rows as `unreadable`
     * and its `gmStore` would write that reading back 400ms later, destroying
     * two rows the GM can still see on the newer device.
     *
     * Schema 3 widened what is at stake without changing the argument. A build
     * that predates it drops a `scene` row's roster and combatants, every
     * countdown's triad, owner and beats, and the whole `archive` and
     * `register` - and then writes that reading back. The refusal below is the
     * only thing between a GM and losing a season of notes to a device that has
     * not updated. Schema 4 added the two pointers to that list.
     *
     * Schema 5 is the first one where the older build does not have to drop
     * anything to do the damage. `board.combatants` and `board.liveScene` are
     * GONE, so a schema-4 reader finds neither, supplies `[]` and `null`, and
     * draws a screen that looks fine - and then its `runScene` empties a scene
     * row onto a board no schema-5 reader will ever look at again. This refusal
     * is what stops that file being opened at all.
     *
     * `CAMPAIGN_SCHEMA_VERSION` is a module constant and this suite cannot
     * lower it, so the guard is called with the old build's numbers - which is
     * exactly the call `parseCampaignFile` makes, with `current` and `oldest`
     * as they read in a build that had never left schema 1. The file itself is
     * the real one this build writes.
     */
    const written = JSON.parse(serializeCampaign(campaign(), at)) as { schemaVersion: number };
    expect(written.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);

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

/**
 * The reader's own refusals, and the envelope's own stamp.
 *
 * Two things the import path needed from this file and did not have. The first
 * is a vocabulary: `readCampaignRecord` throws `CampaignReadError` and a second
 * `SchemaError` of its own, and both used to escape as themselves past callers
 * that had enumerated `ImportError` and nothing else - so a file with a payload
 * that was not a record arrived on a screen as a stack trace or as silence. The
 * second is a number: which schema the file was *written* at, which the record
 * can no longer answer once the reader has restamped it.
 *
 * Every payload below is checksum-correct on purpose. A file that fails the
 * checksum is refused before the reader is ever called, and proves nothing
 * about what the reader does with what it is given.
 */
describe('the refusals that come from inside the record', () => {
  const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));

  /** A well-formed envelope round a payload the type system would not allow. */
  const envelope = (payload: unknown, schemaVersion = CAMPAIGN_SCHEMA_VERSION): string =>
    JSON.stringify({
      format: 'dhcampaign',
      schemaVersion,
      app: fileIo.APP_VERSION,
      exportedAt: at.toISOString(),
      checksum: campaignChecksum(payload as Campaign),
      campaign: payload,
    });

  it('says a payload that is not a record is not one, in the format’s own voice', () => {
    const file = envelope('a campaign, honestly');
    expect(() => parseCampaignFile(file)).toThrow(fileIo.ImportError);
    expect(() => parseCampaignFile(file)).toThrow(/is not a campaign record at all/);
  });

  it('says a payload with no id has nothing to write back to', () => {
    const { id: _dropped, ...idless } = campaign();
    const file = envelope(idless);
    expect(() => parseCampaignFile(file)).toThrow(fileIo.ImportError);
    expect(() => parseCampaignFile(file)).toThrow(/has no id/);
  });

  it('refuses a payload stamped ahead of its own envelope as an import failure, not a raw one', () => {
    /*
     * A file can carry one version on the envelope and another on the record -
     * hand-edited, or written by something that assembled the two halves
     * separately - so the envelope check cannot stand in for the reader's.
     * `SchemaError` reaching a receive surface is the defect: it is the parent
     * class of the one refusal that carries its own remedy, and a caller that
     * catches `ImportError` would print nothing at all.
     */
    const ahead = { ...campaign(), schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1 };
    const file = envelope(ahead);

    expect(() => parseCampaignFile(file)).toThrow(fileIo.ImportError);
    expect(() => parseCampaignFile(file)).toThrow(/newer version of the app/);
    // The window's other edge, for the same reason: below the oldest readable
    // record, from inside the payload.
    const behind = envelope({ ...campaign(), schemaVersion: OLDEST_READABLE_CAMPAIGN - 1 });
    expect(() => parseCampaignFile(behind)).toThrow(fileIo.ImportError);
  });

  it('carries the envelope’s stamp out, not the record’s restamped one', () => {
    /*
     * Kills reading `schemaVersion` off the record. The reader has already
     * moved that field to this build's number by the time anyone can ask, so a
     * preview built on it would say "no conversion" about every file ever
     * written, including the one below, which walked the whole chain.
     */
    const v1 = parseCampaignFile(readFileSync(join(FIXTURES, 'v1.dhcampaign'), 'utf8'));
    expect(v1.schemaVersion).toBe(1);
    expect(v1.campaign.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);

    const ours = parseCampaignFile(serializeCampaign(campaign(), at));
    expect(ours.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(ours.schemaVersion).toBe(ours.campaign.schemaVersion);
  });
});
