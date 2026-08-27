/**
 * The net, measured end to end: the import leg reading what the backup leg
 * wrote.
 *
 * Two lanes built the two halves of this and neither one can test it.
 * `campaignBackup.test.ts` checks that a file *was written* and that a frozen
 * fixture still opens; `campaignImport.test.ts` builds its own `.dhcampaign`
 * with `serializeCampaign` and decides what becomes of it. So both are green on
 * a day when the bytes `runBackup` actually puts in the folder cannot be taken
 * back in - the file name, the envelope, the reader, the add-only store and the
 * read-back verify are five separate things and no test in this repo had ever
 * run all five in one line.
 *
 * That line is the whole claim of the backup regime. A dated `.dhcampaign` in
 * the user's folder is worth exactly what it can be restored to, and until this
 * file "restorable" was an argument rather than a measurement.
 *
 * ## What is real here and what is faked
 *
 * Faked: the folder handle (a `Map`, the way `backup.test.ts` fakes it, because
 * the File System Access API is not in Node) and the character library.
 *
 * Real, and deliberately so, because each one has been the half that breaks:
 *
 *   - the campaign source seam. Nothing injects `liveCampaigns`. The snapshot
 *     is published through `publishCampaignSource`, exactly as `gmStore` does,
 *     so `runBackup` reaches it through its own default. The last block goes
 *     further and uses the real `gmStore`.
 *   - the bytes. Nothing here calls `serializeCampaign` to build a file to
 *     import. Every import in this file reads a string taken back out of the
 *     folder the backup wrote into, by the name `campaignBackupFileName` gave
 *     it.
 *   - the store on the receiving device. `add` and `read` are the real
 *     `addCampaign` and `getCampaign` over `fake-indexeddb`, so the record
 *     crosses a structured clone and comes back through `readCampaignRecord` a
 *     second time - which is what `applyCampaignImport`'s verify compares
 *     against, and what a `Map` cannot make happen.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  newCampaign,
  type Campaign,
  type SessionItem,
} from '../../shared/campaigns.ts';
import type { NoteDoc } from '../../shared/richText.ts';
import type { Character, PartyMember, SceneCombatant } from '../../shared/types.ts';
import { newCharacter } from '../../src/engine/character.ts';
import {
  applyCampaignImport,
  previewCampaignImport,
  type CampaignImportOutcome,
  type CampaignImportPreview,
} from '../../src/store/campaignImport.ts';
import { stable } from '../../src/store/campaignMigration.ts';
import { parseCampaignFile } from '../../src/transfer/campaignFile.ts';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import type { BackupDeps } from '../../src/store/backup.ts';

type Backup = typeof import('../../src/store/backup.ts');
type Campaigns = typeof import('../../src/store/campaigns.ts');
type Source = typeof import('../../src/store/campaignSource.ts');
type Db = typeof import('../../src/store/db.ts');
type Gm = typeof import('../../src/ui/gm/gmStore.ts');

const NOW = new Date('2026-08-27T21:00:00.000Z');

// ---------------------------------------------------------------------------
// A device
// ---------------------------------------------------------------------------

/**
 * A `localStorage`, because the node environment has none and `backup.ts`
 * keeps its whole record - the per-campaign checksums included - in one.
 */
function installStorage(): void {
  const keys = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return keys.size;
    },
    key: (i: number) => [...keys.keys()][i] ?? null,
    getItem: (k: string) => keys.get(k) ?? null,
    setItem: (k: string, v: string) => void keys.set(k, v),
    removeItem: (k: string) => void keys.delete(k),
    clear: () => void keys.clear(),
  } as unknown as Storage;
}

interface Device {
  backup: Backup;
  campaigns: Campaigns;
  source: Source;
  db: Db;
}

/**
 * A phone with nothing on it: its own IndexedDB, its own localStorage, and its
 * own copy of every module that caches either.
 *
 * `db.ts` pins its connection in a module variable and `backup.ts` pins the
 * folder handle in another, so a second device is a `vi.resetModules()` and not
 * only a fresh `IDBFactory`. That is what makes "a device that does not have
 * this campaign" a real statement below rather than a cleared `Map`.
 */
async function device(): Promise<Device> {
  globalThis.indexedDB = new IDBFactory();
  installStorage();
  vi.resetModules();
  return {
    backup: await import('../../src/store/backup.ts'),
    campaigns: await import('../../src/store/campaigns.ts'),
    source: await import('../../src/store/campaignSource.ts'),
    db: await import('../../src/store/db.ts'),
  };
}

/**
 * The deps the app hands `runBackup`, minus the one this file is about.
 *
 * `liveCampaigns` is **not** here. It is the seam under test: the campaigns
 * come from `publishCampaignSource`, through `currentCampaigns`, through
 * `backup.ts`'s own default - which is the path the running app takes and the
 * one a mutation would break.
 */
function backupDeps(prefs: { value: Prefs }): Partial<BackupDeps> {
  return {
    listCharacters: () => Promise.resolve([]),
    readPrefs: () => prefs.value,
    writePrefs: (patch) => {
      prefs.value = { ...prefs.value, ...patch };
    },
    now: () => NOW,
  };
}

/**
 * A folder handle that keeps what was written, keyed on the file name.
 *
 * `backup.test.ts` explains why the key matters: a fake that puts every write
 * under one key cannot tell two files apart, and this file writes one per
 * campaign.
 */
function fakeFolder(): Map<string, string> {
  const files = new Map<string, string>();
  const handle = {
    name: 'Daggerheart',
    getFileHandle: (name: string) =>
      Promise.resolve({
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              files.set(name, text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
        getFile: () => Promise.resolve({ text: () => Promise.resolve(files.get(name) ?? '') }),
      }),
  };
  vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));
  return files;
}

// ---------------------------------------------------------------------------
// The campaign that gets backed up
// ---------------------------------------------------------------------------

const prose = (text: string): NoteDoc => [
  { type: 'paragraph', align: 'start', spans: [{ text, bold: false, italic: false }] },
];

const combatant = (id: string): SceneCombatant => ({
  id,
  adversaryRef: 'jagged-knife-bandit',
  name: 'Jagged Knife Bandit',
  hp: { max: 4, marked: 3 },
  stress: { max: 3, marked: 1 },
  thresholds: [4, 8],
  difficulty: 10,
  spotlighted: false,
  notes: '',
});

const scene = (id: string, name: string, order: number): SessionItem => ({
  id,
  kind: 'scene',
  name,
  order,
  collapsed: false,
  environmentRef: 'raging-river',
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  combatants: [combatant('jagged-knife-bandit-0')],
});

/**
 * One whole sheet, stamped once.
 *
 * `newCharacter` reads the wall clock, so a factory that called it twice would
 * hand back two sheets a millisecond apart - and the assertion this exists for
 * is that the sheet which comes off the disk is byte-identical to the one that
 * went into the file.
 */
const SHEET: Character = {
  ...newCharacter({ name: 'Ilya of the Ninth' }),
  id: 'pc-1',
  level: 3,
  createdAt: '2026-07-04T18:02:00.000Z',
  updatedAt: '2026-07-04T18:02:00.000Z',
};

const SECOND_SHEET: Character = {
  ...newCharacter({ name: 'Bramble Vantry' }),
  id: 'pc-2',
  level: 3,
  createdAt: '2026-07-04T18:03:00.000Z',
  updatedAt: '2026-07-11T22:15:00.000Z',
};

const member = (sheet: Character, tracks: PartyMember['tracks']): PartyMember => ({
  id: sheet.id,
  sheet,
  importedAt: '2026-07-04T18:02:00.000Z',
  source: 'file',
  tracks,
  markedAt: '2026-07-04T21:40:00.000Z',
});

/**
 * A campaign an evening of play produces, with something in every id space.
 *
 * Not the nine-field party stub the frozen schema fixtures carry:
 * `readPartyMember` refuses that, and a round trip whose party is dropped on
 * the way in proves nothing about the sheets, which are the part of a campaign
 * that cannot be typed again from memory.
 */
const played = (patch: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign('The Sablewood Winter', '2026-02-01T19:30:00.000Z', 'c-1'),
  updatedAt: '2026-08-27T20:40:00.000Z',
  fear: 7,
  session: [
    scene('s1', 'The frozen ford', 0),
    {
      id: 'i1',
      kind: 'countdown',
      name: 'The ford thaws',
      order: 1,
      collapsed: false,
      primary: false,
      sceneId: 's1',
      countdown: {
        id: 'cd-1',
        name: 'The ford thaws',
        kind: 'standard',
        start: 6,
        value: 4,
        notes: '',
        activation: '',
        advancement: '',
        effect: '',
        owner: '',
        beats: [],
      },
    },
    { id: 'n1', kind: 'note', name: 'What Hessa wants', order: 2, collapsed: false, note: prose('A crossing, paid back.') },
    scene('s2', 'The long hall', 3),
  ],
  archive: [
    {
      id: 'sitting-1',
      name: 'The first night out',
      closedAt: '2026-07-04T23:10:00.000Z',
      items: [scene('s1', 'The frozen ford', 0)],
      account: prose('They never went north.'),
    },
    {
      id: 'sitting-2',
      name: 'The night of the thaw',
      closedAt: '2026-08-11T23:40:00.000Z',
      items: [],
      account: prose('Hessa took the boat out and did not come back.'),
    },
  ],
  register: [
    {
      id: 'reg-1',
      kind: 'person',
      name: 'Old Hessa, the ferrywoman',
      createdAt: '2026-07-04T19:00:00.000Z',
      updatedAt: '2026-07-04T19:00:00.000Z',
      body: prose('Owes the party a crossing.'),
    },
    {
      id: 'reg-2',
      kind: 'place',
      name: 'The frozen ford',
      createdAt: '2026-07-04T19:05:00.000Z',
      updatedAt: '2026-08-11T23:00:00.000Z',
      body: prose('Passable until the thaw.'),
    },
  ],
  party: [
    member(SHEET, { hp: 2, stress: 4, hope: 3, armor: 1 }),
    member(SECOND_SHEET, { hp: 0, stress: 1, hope: 5, armor: 0 }),
  ],
  board: {
    ...newCampaign('x', '2026-02-01T19:30:00.000Z', 'x').board,
    combatants: [combatant('acid-burrower-0')],
    environmentRef: 'raging-river',
    liveScene: 's2',
  },
  ...patch,
});

// ---------------------------------------------------------------------------
// The two legs
// ---------------------------------------------------------------------------

/**
 * Run the backup leg and hand back the folder it wrote into.
 *
 * `chooseBackupFolder` first, because a run with no folder writes no campaign
 * file at all - `noFolderNotice` - and that run is a different test.
 */
async function runBackupLeg(
  d: Device,
  campaigns: Campaign[],
): Promise<{ files: Map<string, string>; outcome: Awaited<ReturnType<Backup['runBackup']>> }> {
  const files = fakeFolder();
  const prefs = { value: { ...DEFAULT_PREFS } };
  const deps = backupDeps(prefs);
  d.source.publishCampaignSource(() => ({ campaigns, quarantined: [] }));
  await d.backup.chooseBackupFolder(deps);
  const outcome = await d.backup.runBackup('manual', {}, deps);
  return { files, outcome };
}

interface TakenIn {
  preview: CampaignImportPreview;
  outcome: CampaignImportOutcome;
}

/** The import leg, over the receiving device's real campaigns store. */
async function takeIn(d: Device, text: string, minted: { n: number }): Promise<TakenIn> {
  const here = await d.campaigns.readCampaigns();
  const preview = previewCampaignImport(parseCampaignFile(text), {
    campaigns: here.campaigns,
    quarantined: here.quarantined,
  });
  const outcome = await applyCampaignImport(preview, {
    add: (c) => d.campaigns.addCampaign(c),
    read: (id) => d.campaigns.getCampaign(id),
    newId: () => {
      minted.n += 1;
      return `minted-${String(minted.n)}`;
    },
    now: () => '2026-08-27T21:05:00.000Z',
  });
  return { preview, outcome };
}

const landed = (outcome: CampaignImportOutcome): Extract<CampaignImportOutcome, { kind: 'landed' }> => {
  if (outcome.kind !== 'landed') {
    throw new Error(
      `the import did not land: ${outcome.kind} — ${'message' in outcome ? outcome.message : ''}`,
    );
  }
  return outcome;
};

/** The raw record as the object store holds it, past every reader. */
const rawRecord = async (d: Device, id: string): Promise<unknown> =>
  (await d.db.db()).get('campaigns', id);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('a file the automatic backup wrote, taken back in', () => {
  let source: Device;
  let target: Device;
  let files: Map<string, string>;
  let text: string;
  let fileName: string;
  const table = played();

  beforeEach(async () => {
    source = await device();
    ({ files } = await runBackupLeg(source, [table]));
    fileName = source.backup.campaignBackupFileName(table, NOW);
    text = files.get(fileName) ?? '';
    // A second device, with nothing on it. Its own IndexedDB and its own copy
    // of every module that caches a connection.
    target = await device();
  });

  it('writes exactly one file, under the name the backup leg mints for it', () => {
    expect([...files.keys()]).toEqual([fileName]);
    expect(fileName).toBe('daggerheart-the-sablewood-winter-c424f6be-2026-08-27.dhcampaign');
    expect(text).not.toBe('');
  });

  it('opens on the other device without a single repair warning', async () => {
    const { preview } = await takeIn(target, text, { n: 0 });
    /*
     * The one assertion the whole design turns on, and the one that would be
     * tempting to soften. A round trip through this app's own backup is the
     * app reading a record it wrote seconds earlier: every sentence in
     * `readCampaignRecord`'s `warn` is about somebody else's bytes or an older
     * build's, and one of them appearing here would mean the writer and the
     * reader disagree about this app's own format.
     */
    expect(preview.warnings).toEqual([]);
    expect(preview.converted).toBe(false);
  });

  it('gives back the campaign that was backed up, field for field', async () => {
    const { preview, outcome } = await takeIn(target, text, { n: 0 });
    const out = landed(outcome);
    const back = out.campaign;

    expect(out.asCopy).toBe(false);
    expect(out.renamedFrom).toBeNull();
    expect(out.warnings).toEqual([]);

    expect(back.id).toBe(table.id);
    expect(back.name).toBe(table.name);
    expect(back.fear).toBe(7);
    expect(back.createdAt).toBe(table.createdAt);
    expect(back.updatedAt).toBe(table.updatedAt);

    // The session list, in order, ids and kinds. Order is the part
    // `readCampaignRecord` renumbers, so it is asserted rather than assumed.
    expect(back.session.map((i) => [i.id, i.kind, i.order])).toEqual([
      ['s1', 'scene', 0],
      ['i1', 'countdown', 1],
      ['n1', 'note', 2],
      ['s2', 'scene', 3],
    ]);

    // The two pointers into that list. `campaignImport.ts` prohibits a blanket
    // remap precisely because these two name a row id.
    const countdownRow = back.session[1]!;
    expect(countdownRow.kind === 'countdown' ? countdownRow.sceneId : null).toBe('s1');
    expect(countdownRow.kind === 'countdown' ? countdownRow.countdown.value : null).toBe(4);
    expect(back.board.liveScene).toBe('s2');
    expect(back.board.combatants.map((c) => c.id)).toEqual(['acid-burrower-0']);
    expect(back.board.environmentRef).toBe('raging-river');

    expect(back.archive.map((a) => a.id)).toEqual(['sitting-1', 'sitting-2']);
    expect(back.archive[0]!.items.map((i) => i.id)).toEqual(['s1']);
    expect(back.register).toEqual(table.register);

    expect(preview.counts).toEqual({ session: 4, archive: 2, register: 2, party: 2 });
  });

  it('gives back every party sheet whole, with the handover date and the marks on it', async () => {
    /*
     * The one most likely to be broken, and the one the two lanes could not
     * reach between them: a party row carries a whole `Character`, which is
     * walked by `migrateCharacterRecord` *inside* `readCampaignRecord`, and a
     * row it cannot read is dropped with a warning rather than repaired. Every
     * committed schema fixture in this repo carries a nine-field stub there, so
     * no test in the tree has ever put a real sheet through a real file.
     */
    const back = landed((await takeIn(target, text, { n: 0 })).outcome).campaign;

    expect(back.party).toHaveLength(2);
    expect(back.party.map((p) => p.id)).toEqual(['pc-1', 'pc-2']);
    for (const [i, was] of table.party.entries()) {
      const now = back.party[i]!;
      expect(now.importedAt).toBe(was.importedAt);
      expect(now.source).toBe(was.source);
      expect(now.markedAt).toBe(was.markedAt);
      expect(now.tracks).toEqual(was.tracks);
      // The sheet itself, byte for byte - not a blank one with the right name.
      expect(stable(now.sheet)).toBe(stable(was.sheet));
    }
    expect(back.party[0]!.sheet.name).toBe('Ilya of the Ninth');
    expect(back.party[0]!.tracks).toEqual({ hp: 2, stress: 4, hope: 3, armor: 1 });
  });

  it('lands a record on the disk that is the record that was backed up', async () => {
    /*
     * Not the outcome's copy: what is actually in the object store, read back
     * through `getCampaign` - which runs `readCampaignRecord` a second time,
     * on the far side of a structured clone. `applyCampaignImport` compares
     * exactly this and reports `not-verified` when it disagrees, so `landed`
     * above is already half of the claim; this says which record it is.
     */
    landed((await takeIn(target, text, { n: 0 })).outcome);
    const onDisk = await target.campaigns.getCampaign(table.id);
    expect(onDisk).not.toBeNull();
    expect(stable(onDisk)).toBe(stable(table));
    expect((await target.campaigns.readCampaigns()).campaigns.map((c) => c.id)).toEqual(['c-1']);
  });
});

describe('the same file taken in twice, on a device that already has it', () => {
  it('lands beside the first copy, under a new id and a minted name, and does not touch it', async () => {
    const table = played();
    const source = await device();
    const { files } = await runBackupLeg(source, [table]);
    const text = files.get(source.backup.campaignBackupFileName(table, NOW)) ?? '';

    const target = await device();
    const minted = { n: 0 };
    const first = landed((await takeIn(target, text, minted)).outcome);
    const before = stable(await rawRecord(target, table.id));

    const { preview, outcome } = await takeIn(target, text, minted);
    const second = landed(outcome);

    expect(preview.localSameId?.id).toBe(table.id);
    expect(second.asCopy).toBe(true);
    expect(second.campaign.id).toBe('minted-1');
    expect(second.campaign.id).not.toBe(first.campaign.id);
    expect(second.renamedFrom).toBe('The Sablewood Winter');
    expect(second.campaign.name).not.toBe(table.name);
    expect(second.campaign.name).toMatch(/imported/);
    // `updatedAt` is deliberately left as the file carried it; `createdAt` is
    // now, because this record really was made on this device just now.
    expect(second.campaign.updatedAt).toBe(table.updatedAt);
    expect(second.campaign.createdAt).toBe('2026-08-27T21:05:00.000Z');

    // The copy that was already here: byte-identical, past every reader.
    expect(stable(await rawRecord(target, table.id))).toBe(before);
    const here = (await target.campaigns.readCampaigns()).campaigns;
    expect(here.map((c) => c.id).sort()).toEqual(['c-1', 'minted-1']);
    expect(stable(here.find((c) => c.id === table.id))).toBe(stable(table));
  });
});

describe('a campaign the GM has edited and the disk has not caught up with', () => {
  /*
   * The fatal the whole seam exists for, and the only case in this file that
   * needs the real `gmStore`.
   *
   * `writeActive` updates `state.campaigns` only inside the `try` *after*
   * `putCampaign` resolves and leaves `dirty` true on a throw. So on the
   * evening writes are failing - a full disk, an older build refusing a newer
   * record, which is precisely the evening about to be lost - a flush cannot
   * make the disk fresh, and a disk-sourced backup would write the stale
   * record, verify it happily (it is a valid `.dhcampaign` of the wrong
   * record) and stamp "last backup: today" over an evening that exists
   * nowhere.
   *
   * The debounce is what makes the state reachable without breaking anything:
   * `schedule` sets `dirty` and arms a 400 ms timer. `setTimeout` is faked
   * from the moment of the edit so that timer cannot fire, and the disk is
   * asserted stale on *both* sides of the backup - a run where the flush landed
   * anyway would go red here rather than pass while proving nothing.
   */
  it('backs up the edit, not the disk, and the import gives back the edited board', async () => {
    globalThis.indexedDB = new IDBFactory();
    installStorage();
    vi.resetModules();
    /*
     * All four out of one `resetModules`, so they are the same instances.
     * `gmStore` fills the slot in `campaignSource` from its module-scope
     * epilogue and `backup.ts` reads that same slot through its own default;
     * importing them from two different module graphs would leave the seam
     * published on one side and read on the other, and this whole case would
     * pass by falling back to the disk - which is the mutant.
     */
    const campaigns = (await import('../../src/store/campaigns.ts')) as Campaigns;
    const backupModule = (await import('../../src/store/backup.ts')) as Backup;
    const gm = (await import('../../src/ui/gm/gmStore.ts')) as Gm;

    await gm.hydrateGm();
    const id = gm.useGm.getState().activeCampaignId!;

    // An evening, written to the disk the ordinary way.
    gm.useGm.getState().setFear(3);
    gm.useGm.getState().importParty([SHEET], 'file');
    gm.useGm.getState().addSessionItem(scene('s1', 'The frozen ford', 0));
    gm.useGm.getState().runScene('s1');
    await gm.flushGm();

    const flushed = await campaigns.getCampaign(id);
    expect(flushed?.fear).toBe(3);
    expect(flushed?.party).toHaveLength(1);

    // From here the disk must not move.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    // The edit nobody has written down yet.
    gm.useGm.getState().setFear(9);
    gm.useGm.getState().markPartyTracks('pc-1', { hp: 4, stress: 5 });
    gm.useGm.getState().addSessionItem({
      id: 'n1',
      kind: 'note',
      name: 'What Hessa wants',
      order: 1,
      collapsed: false,
      note: prose('A crossing, paid back.'),
    });

    const stale = await campaigns.getCampaign(id);
    expect(stale?.fear, 'the flush fired: this case is no longer about a dirty store').toBe(3);
    expect(stale?.session.map((i) => i.id)).toEqual(['s1']);

    // The backup leg, through the seam `gmStore` published at module scope.
    // Nothing about `liveCampaigns` is injected.
    const files = fakeFolder();
    const prefs = { value: { ...DEFAULT_PREFS } };
    const deps = backupDeps(prefs);
    await backupModule.chooseBackupFolder(deps);
    const outcome = await backupModule.runBackup('manual', {}, deps);

    expect(outcome.ok).toBe(true);
    expect(outcome.campaigns).toBe(1);

    // Still stale, so the file below is not the disk's by accident.
    expect((await campaigns.getCampaign(id))?.fear).toBe(3);

    const written = [...files.keys()].filter((n) => n.endsWith('.dhcampaign'));
    expect(written).toHaveLength(1);
    const text = files.get(written[0]!) ?? '';

    // The file carries the EDIT.
    const inFile = parseCampaignFile(text);
    expect(inFile.warnings).toEqual([]);
    expect(inFile.campaign.fear, 'the backup was written from the disk, not the seam').toBe(9);
    expect(inFile.campaign.session.map((i) => i.id)).toEqual(['s1', 'n1']);
    expect(inFile.campaign.party[0]!.tracks).toMatchObject({ hp: 4, stress: 5 });

    // And the import gives it back on a device that has never seen it.
    vi.useRealTimers();
    const target = await device();
    const back = landed((await takeIn(target, text, { n: 0 })).outcome).campaign;

    expect(back.fear).toBe(9);
    expect(back.id).toBe(id);
    expect(back.session.map((i) => i.id)).toEqual(['s1', 'n1']);
    expect(back.board.liveScene).toBe('s1');
    expect(back.party[0]!.tracks).toMatchObject({ hp: 4, stress: 5 });
    expect(back.party[0]!.sheet.name).toBe('Ilya of the Ninth');
    expect(stable(await target.campaigns.getCampaign(id))).toBe(stable(back));
  });
});
