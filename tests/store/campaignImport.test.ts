/**
 * What becomes of a campaign that arrived from a file, decided without a disk.
 *
 * `campaignImport.ts` takes its four capabilities as an argument, so everything
 * below runs against a `Map` and a counter. That is not only speed: the
 * question this module answers is *which outcome happens*, and a fake store can
 * be made to answer `'taken'`, to reject with a quota error, or to hand back a
 * record that differs by one field - three things IndexedDB will not do on
 * demand. The transaction itself is measured next door, in
 * `campaignDb.test.ts`.
 *
 * The mutation each block is here to kill is named in it. The one that matters
 * most is the first: `add` -> `put` typechecks, passes every test that only
 * counts campaigns, and destroys a season.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { newCharacter } from '../../src/engine/character.ts';
import {
  CAMPAIGN_SCHEMA_VERSION,
  newCampaign,
  type Campaign,
  type SessionItem,
} from '../../shared/campaigns.ts';
import type { NoteDoc } from '../../shared/richText.ts';
import type { Character, PartyMember, SceneCombatant } from '../../shared/types.ts';
import {
  applyCampaignImport,
  previewCampaignImport,
  type CampaignImportDeps,
  type CampaignImportPreview,
} from '../../src/store/campaignImport.ts';
import { stable } from '../../src/store/campaignMigration.ts';
import {
  campaignChecksum,
  parseCampaignFile,
  serializeCampaign,
  type ImportedCampaign,
} from '../../src/transfer/campaignFile.ts';
import { ImportError } from '../../src/transfer/fileIo.ts';

const FIXTURES = fileURLToPath(new URL('../fixtures/schema', import.meta.url));
const EXPORTED_AT = new Date('2026-08-16T10:00:00.000Z');

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

const scene = (order: number): SessionItem => ({
  id: 's1',
  kind: 'scene',
  name: 'The frozen ford',
  order,
  collapsed: true,
  environmentRef: 'raging-river',
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  combatants: [combatant('jagged-knife-bandit-0')],
});

/**
 * One whole sheet, stamped once.
 *
 * `newCharacter` stamps `createdAt`/`updatedAt` from the wall clock, so a
 * factory that called it twice would hand back two sheets differing by a
 * millisecond - and half the assertions below are about two records being
 * byte-identical.
 */
const SHEET: Character = {
  ...newCharacter({ name: 'Ilya of the Ninth' }),
  id: 'pc-1',
  createdAt: '2026-07-04T18:02:00.000Z',
  updatedAt: '2026-07-04T18:02:00.000Z',
};

const member = (): PartyMember => ({
  id: 'pc-1',
  sheet: SHEET,
  importedAt: '2026-07-04T18:02:00.000Z',
  source: 'file',
  tracks: { hp: 2, stress: 4, hope: 3, armor: 1 },
  markedAt: '2026-07-04T21:40:00.000Z',
});

/**
 * A campaign with something in every id space the record has.
 *
 * Built rather than taken from a fixture because the point of it is the id
 * spaces, and the committed fixtures are frozen against schema drift rather
 * than against this: `v4.campaign.json`'s party row is a nine-field stub the
 * reader drops, which is exactly the row an id test must not be asserting
 * about. The archive deliberately repeats the live scene's row id.
 */
const full = (patch: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign('The Sablewood Winter', '2026-02-01T19:30:00.000Z', 'c-1'),
  fear: 7,
  session: [
    scene(0),
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
  ],
  archive: [
    {
      id: 'sitting-1',
      name: 'The first night out',
      closedAt: '2026-07-04T23:10:00.000Z',
      items: [scene(0)],
      account: prose('They never went north.'),
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
  ],
  party: [member()],
  board: {
    ...newCampaign('x', '2026-02-01T19:30:00.000Z', 'x').board,
    combatants: [combatant('acid-burrower-0')],
    environmentRef: 'raging-river',
    liveScene: 's1',
  },
  ...patch,
});

/** Every id in the record, by the space it lives in. */
const idsOf = (c: Campaign): Record<string, unknown> => ({
  rows: c.session.map((i) => i.id),
  countdowns: c.session.flatMap((i) => (i.kind === 'countdown' ? [i.countdown.id] : [])),
  rowCombatants: c.session.flatMap((i) => (i.kind === 'scene' ? i.combatants.map((x) => x.id) : [])),
  archive: c.archive.map((a) => a.id),
  archiveItems: c.archive.flatMap((a) => a.items.map((i) => i.id)),
  register: c.register.map((r) => r.id),
  boardCombatants: c.board.combatants.map((x) => x.id),
  party: c.party.map((p) => p.id),
  liveScene: c.board.liveScene,
  scopedTo: c.session.flatMap((i) => (i.kind === 'countdown' ? [i.sceneId] : [])),
});

/** A `.dhcampaign` this build would have written, read back through the door. */
const fileOf = (c: Campaign): ImportedCampaign =>
  parseCampaignFile(serializeCampaign(c, EXPORTED_AT));

/** An envelope round a payload the type system would not have allowed. */
const envelope = (payload: unknown, schemaVersion = CAMPAIGN_SCHEMA_VERSION): string =>
  JSON.stringify({
    format: 'dhcampaign',
    schemaVersion,
    app: '0.6.0',
    exportedAt: EXPORTED_AT.toISOString(),
    checksum: campaignChecksum(payload as Campaign),
    campaign: payload,
  });

interface Fake {
  /** The disk. Raw, because a record another build wrote is not a `Campaign`. */
  records: Map<string, unknown>;
  deps: CampaignImportDeps;
  /** What `add` was handed, in order, whatever it answered. */
  offered: Campaign[];
}

/**
 * A store that behaves the way `addCampaign` does, and nothing more.
 *
 * `add` checks the key and sets it in one synchronous stretch, which is what
 * makes the concurrency case below deterministic rather than lucky: it is the
 * same atomicity IndexedDB gives inside a transaction. `read` hands back a
 * clone, because the whole point of the read-back is that what returns from a
 * store is a different object than what went in.
 */
function fakeStore(seed: Record<string, unknown> = {}, over: Partial<CampaignImportDeps> = {}): Fake {
  const records = new Map<string, unknown>(Object.entries(seed));
  const offered: Campaign[] = [];
  let minted = 0;
  const deps: CampaignImportDeps = {
    add: (c) => {
      offered.push(c);
      if (records.has(c.id)) return Promise.resolve('taken');
      records.set(c.id, structuredClone(c));
      return Promise.resolve('added');
    },
    read: (id) => {
      const found = records.get(id);
      return Promise.resolve(found === undefined ? null : (structuredClone(found) as Campaign));
    },
    newId: () => {
      minted += 1;
      return `minted-${String(minted)}`;
    },
    now: () => '2026-08-27T12:00:00.000Z',
    ...over,
  };
  return { records, deps, offered };
}

const landed = (
  outcome: Awaited<ReturnType<typeof applyCampaignImport>>,
): Extract<typeof outcome, { kind: 'landed' }> => {
  if (outcome.kind !== 'landed') {
    throw new Error(`the import did not land: ${outcome.kind} — ${outcome.message}`);
  }
  return outcome;
};

const here = (campaigns: Campaign[] = [], quarantined: { id: string }[] = []): {
  campaigns: readonly Campaign[];
  quarantined: readonly { id: string }[];
} => ({ campaigns, quarantined });

const run = async (
  file: ImportedCampaign,
  store: Fake,
  where = here(),
): Promise<{ preview: CampaignImportPreview; outcome: Awaited<ReturnType<typeof applyCampaignImport>> }> => {
  const preview = previewCampaignImport(file, where);
  return { preview, outcome: await applyCampaignImport(preview, store.deps) };
};

describe('a campaign already on this device is never written over', () => {
  it('lands beside it even when the file says it is newer', async () => {
    /*
     * Kills `add` -> `put`. Everything about this case invites the overwrite:
     * the ids are equal, the file is newer by five months, and `readCampaigns`
     * sorts on exactly the field that says so. None of it is consulted.
     */
    const mine: Campaign = {
      ...full({ name: 'Winter (Ana’s table)' }),
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const arriving = fileOf({ ...full(), updatedAt: '2026-08-01T00:00:00.000Z' });
    const store = fakeStore({ [mine.id]: mine });
    const before = stable(mine);

    const { outcome } = await run(arriving, store, here([mine]));
    const out = landed(outcome);

    expect(store.records.size).toBe(2);
    expect(stable(store.records.get(mine.id)), 'the local record moved').toBe(before);
    expect(out.campaign.id).not.toBe(mine.id);
    expect(out.asCopy).toBe(true);
  });

  it('does not consult the clock at all: an older file lands beside a newer record too', async () => {
    // The control for the case above. A `put` guarded by "only if newer" would
    // pass that test and fail this one, which is the whole difference between
    // an add-only path and a careful overwrite.
    const mine = { ...full(), updatedAt: '2026-08-01T00:00:00.000Z' };
    const arriving = fileOf({ ...full(), updatedAt: '2026-01-01T00:00:00.000Z' });
    const store = fakeStore({ [mine.id]: mine });

    const out = landed((await run(arriving, store, here([mine]))).outcome);

    expect(store.records.size).toBe(2);
    expect(out.campaign.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('lands beside a record a newer build wrote, and leaves it exactly as it is', async () => {
    /*
     * Kills the deletion of the `'taken'` branch. This record is invisible to
     * `readCampaigns` - it is quarantined, so `state.campaigns` cannot see it -
     * and `add` refuses it anyway, because `add` sees raw keys and does not
     * care whether this build could read what is there.
     */
    const ahead = {
      id: 'c-1',
      schemaVersion: CAMPAIGN_SCHEMA_VERSION + 1,
      name: 'Written by a newer build',
      fear: 99,
    };
    const store = fakeStore({ 'c-1': ahead });

    const { preview, outcome } = await run(fileOf(full()), store, here([], [{ id: 'c-1' }]));
    const out = landed(outcome);

    expect(preview.quarantinedSameId).toBe(true);
    expect(preview.localSameId).toBeNull();
    expect(store.offered[0]?.id, 'the file’s own id was never offered').toBe('c-1');
    expect(out.asCopy).toBe(true);
    expect(out.campaign.id).toBe('minted-1');
    expect(store.records.get('c-1')).toEqual(ahead);
  });
});

describe('the id spaces that are not the key', () => {
  it('keeps every internal id byte-identical, on the path that mints a new key', async () => {
    // Kills a blanket remap. The copy path is where one would be tempting -
    // the campaign id has just been replaced, so renumbering everything under
    // it looks consistent - and it is the path that must not do it.
    const arriving = fileOf(full());
    const store = fakeStore({ 'c-1': { ...full(), name: 'Something else' } });

    const out = landed((await run(arriving, store, here([full()]))).outcome);
    const stored = store.records.get(out.campaign.id) as Campaign;

    expect(out.campaign.id).not.toBe('c-1');
    expect(idsOf(stored)).toEqual(idsOf(arriving.campaign));
    // Named one by one as well, so a failure says which space moved.
    expect(stored.archive[0]?.items[0]?.id, 'the archive shares live row ids on purpose').toBe(
      's1',
    );
    expect(stored.party[0]?.id, 'a party id is the character’s own id').toBe('pc-1');
    /*
     * And the two fields the copy path is allowed to move, moved: this record
     * really was created on this device just now, and `updatedAt` is left
     * exactly as the file carried it - `duplicateFor`'s reasoning one record
     * class up. Rewriting it would make the arriving copy look newer than the
     * one it was judged against, and `readCampaigns` sorts the list on it.
     */
    expect(stored.createdAt).toBe('2026-08-27T12:00:00.000Z');
    expect(stored.updatedAt).toBe(arriving.campaign.updatedAt);
  });

  it('keeps the two pointers standing, and the reader reports no repair', async () => {
    /*
     * The load-bearing assertion of the whole id decision. `readCampaignRecord`
     * repairs a countdown whose `sceneId` names no row, and detaches a
     * `board.liveScene` that names no row - each with a warning. A remap that
     * renumbered rows before the pointers would surface here as two sentences
     * telling the GM their parked fight and their scene clock are gone.
     */
    const arriving = fileOf(full());
    const store = fakeStore();

    const { preview, outcome } = await run(arriving, store, here());
    const stored = store.records.get(landed(outcome).campaign.id) as Campaign;
    const said = preview.warnings.join(' ');

    expect(preview.warnings).toEqual([]);
    expect(said).not.toMatch(/belonged to a scene this campaign no longer has/);
    expect(said).not.toMatch(/live scene|no longer has that scene/i);
    expect(stored.board.liveScene).toBe('s1');
    const clock = stored.session.find((i) => i.id === 'i1');
    expect(clock?.kind === 'countdown' && clock.sceneId).toBe('s1');
    /*
     * Nothing at all is rewritten on this path, `createdAt` included: a restore
     * that does not give back what was backed up is worse than any collision.
     * This is the assertion that says so about every field at once.
     */
    expect(stable(stored)).toBe(stable(arriving.campaign));
  });

  it('never reaches the characters store, so a party row arrives exactly as it was', async () => {
    /*
     * §1b as a measurement. There is a character on this device with the same
     * id as the party row and a different name, and there is no way to hand it
     * to the import: `CampaignImportDeps` has no character accessor. The row
     * is therefore not refreshed, which is the rule - a refresh would claim the
     * GM had been handed a newer sheet they were never handed, and would put an
     * invented date on a row the board prints ages against.
     */
    const mine = { ...newCharacter({ name: 'Ilya, two levels later' }), id: 'pc-1', level: 6 };
    const arriving = fileOf(full());
    const store = fakeStore();

    const out = landed((await run(arriving, store, here())).outcome);
    const row = (store.records.get(out.campaign.id) as Campaign).party[0]!;

    expect(row).toEqual(member());
    expect(row.sheet.name).not.toBe(mine.name);
    expect(row.importedAt).toBe('2026-07-04T18:02:00.000Z');
    expect(row.markedAt).toBe('2026-07-04T21:40:00.000Z');
    expect(row.tracks).toEqual({ hp: 2, stress: 4, hope: 3, armor: 1 });
  });
});

describe('the import cannot reach the characters store, in the source as well as the type', () => {
  /*
   * The same shape `backupSeam.test.ts` uses, and for the same reason: the
   * defect would not be in what a function does, it would be in which one this
   * module is able to call at all. A spy cannot assert this - there is no
   * function to spy on - so the assertion is about the import list.
   */
  const source = readFileSync(
    fileURLToPath(new URL('../../src/store/campaignImport.ts', import.meta.url)),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  const imports = [...source.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)].map((m) => m[1] ?? '');

  it('imports nothing from the half of the store the characters live in', () => {
    expect(imports.length, 'the import list could not be read at all').toBeGreaterThan(0);
    expect(imports).not.toContain('./db.ts');
    expect(imports).not.toContain('./state.ts');
    expect(imports.join(' ')).not.toMatch(/characters|db\.ts|state\.ts/);
  });

  it('names no character verb anywhere in its body', () => {
    expect(source).not.toMatch(/putCharacter|importCharacters|listCharacters/);
  });
});

describe('the read-back, which is what makes a write a claim', () => {
  it('catches a record that came back with one field changed', async () => {
    /*
     * Kills dropping the `stable()` compare, and kills a count-based or
     * checksum-shaped compare - the record below has the same number of rows,
     * the same ids and the same name, and differs by one integer on one clock.
     */
    const arriving = fileOf(full());
    const store = fakeStore(
      {},
      {
        read: (id) => {
          const stored = structuredClone(full({ id })) as Campaign;
          const row = stored.session.find((i) => i.kind === 'countdown');
          if (row?.kind === 'countdown') row.countdown.value = 1;
          return Promise.resolve(stored);
        },
      },
    );

    /*
     * Watched rather than merely passed: every property this module reads on
     * its deps is recorded, so "there is no delete to call" is measured instead
     * of asserted about a type. A record that came back different is left where
     * it is and named - this app does not delete what it could not read,
     * `deleteCampaign` can itself throw, and a disagreement is far more likely
     * a reader disagreement than a corrupt write.
     */
    const reached: string[] = [];
    const watched = new Proxy(store.deps, {
      get: (target, key) => {
        reached.push(String(key));
        return Reflect.get(target, key) as unknown;
      },
    });
    const outcome = await applyCampaignImport(previewCampaignImport(arriving, here()), watched);

    expect(outcome.kind).toBe('not-verified');
    expect(outcome.kind === 'not-verified' && outcome.message).toBe(
      'did not come back the same when it was read again',
    );
    expect(outcome.kind === 'not-verified' && outcome.campaign.id).toBe('c-1');
    expect(store.records.has('c-1')).toBe(true);
    expect([...new Set(reached)].sort()).toEqual(['add', 'read']);
  });

  it('says something different when nothing came back at all', async () => {
    // Two sentences rather than one, because "the record is not there" and
    // "the record is not what I wrote" send the GM to different places.
    const store = fakeStore({}, { read: () => Promise.resolve(null) });
    const { outcome } = await run(fileOf(full()), store, here());

    expect(outcome.kind).toBe('not-verified');
    expect(outcome.kind === 'not-verified' && outcome.message).toBe(
      'could not be read back afterwards',
    );
  });

  it('will not vouch for a write whose read-back threw', async () => {
    /*
     * The record is on the disk - `add` said so, inside the transaction - and
     * what is missing is the proof, so this collapses into the same sentence as
     * a read that came back empty rather than into a third one. What it must
     * not do is call the write landed: a `deps.read` that rejects is exactly
     * the state where a device is failing under the GM's hands, and "it is on
     * this device and open" is the one thing that cannot be said about it.
     */
    const store = fakeStore({}, { read: () => Promise.reject(new Error('the disk went away')) });
    const { outcome } = await run(fileOf(full()), store, here());

    expect(outcome.kind).toBe('not-verified');
    expect(outcome.kind === 'not-verified' && outcome.message).toBe(
      'could not be read back afterwards',
    );
    expect(store.records.has('c-1'), 'and it is left where it is').toBe(true);
  });

  it('does not call a write unverified for a key-order difference', async () => {
    // The control, and the reason `stable()` is the comparison rather than
    // `JSON.stringify`: a structured clone is not obliged to preserve key
    // order, and a compare that failed on it would refuse every import.
    const store = fakeStore(
      {},
      {
        read: (id) => {
          const stored = full({ id });
          const shuffled = Object.fromEntries(Object.entries(stored).reverse());
          return Promise.resolve(shuffled as unknown as Campaign);
        },
      },
    );

    expect((await run(fileOf(full()), store, here())).outcome.kind).toBe('landed');
  });
});

describe('the name, which is minted rather than refused', () => {
  it('counts up, and says what it came in as', async () => {
    const mine = full({ id: 'other', name: 'The Sablewood Winter' });
    const store = fakeStore({ other: mine });

    const first = await run(fileOf(full()), store, here([mine]));
    expect(first.preview.mintedName).toBe('The Sablewood Winter (imported)');
    const one = landed(first.outcome);
    expect(one.campaign.name).toBe('The Sablewood Winter (imported)');
    expect(one.renamedFrom).toBe('The Sablewood Winter');
    // The id was free, so nothing was copied - only the name had to move.
    expect(one.asCopy).toBe(false);

    const second = await run(
      fileOf(full({ id: 'c-2' })),
      store,
      here([mine, one.campaign]),
    );
    expect(landed(second.outcome).campaign.name).toBe('The Sablewood Winter (imported 2)');
  });

  it('leaves the name alone when nothing here answers to it', async () => {
    const store = fakeStore();
    const { preview, outcome } = await run(fileOf(full()), store, here());
    expect(preview.mintedName).toBeNull();
    expect(landed(outcome).renamedFrom).toBeNull();
    expect(landed(outcome).campaign.name).toBe('The Sablewood Winter');
  });

  it('mints anyway when the id turns out to be taken and the preview saw no collision', async () => {
    /*
     * The race: another tab landed a campaign between the preview and the
     * write. The preview promised "under a new name" and an apply that did not
     * deliver one would make the preview a lie - and two rows a GM cannot tell
     * apart is the failure `names.ts` exists to stop, race or no race.
     */
    const store = fakeStore({ 'c-1': full({ name: 'Arrived a second ago' }) });
    const { preview, outcome } = await run(fileOf(full()), store, here());

    expect(preview.mintedName, 'the preview saw an empty device').toBeNull();
    expect(landed(outcome).campaign.name).toBe('The Sablewood Winter (imported)');
    expect(landed(outcome).renamedFrom).toBe('The Sablewood Winter');
  });
});

describe('two GMs off the localStorage build, colliding by construction', () => {
  it('takes both sides of `campaign-from-gm-v1` and keeps them apart', async () => {
    /*
     * `campaignMigration.ts` mints every upgraded device's first campaign under
     * one fixed id and one shared name, so this is not the exotic case - it is
     * the first table either GM ever had. Any shortcut that read id equality as
     * identity would drop one of these two whole campaigns.
     */
    const LEGACY = 'campaign-from-gm-v1';
    const mine = full({ id: LEGACY, name: 'My campaign', updatedAt: '2026-04-02T19:05:00.000Z' });
    const theirs = full({
      id: LEGACY,
      name: 'My campaign',
      updatedAt: '2026-03-12T21:40:00.000Z',
      fear: 3,
    });
    const store = fakeStore({ [LEGACY]: mine });

    const { preview, outcome } = await run(fileOf(theirs), store, here([mine]));

    // Both sides are on the preview, because only the GM can tell whether
    // these are one table or two.
    expect(preview.localSameId?.name).toBe('My campaign');
    expect(preview.localSameId?.updatedAt).toBe('2026-04-02T19:05:00.000Z');
    expect(preview.incoming.updatedAt).toBe('2026-03-12T21:40:00.000Z');
    expect(preview.counts).toEqual({ session: 2, archive: 1, register: 1, party: 1 });
    /*
     * And the name is minted *because* of the record that shares the id, which
     * is why `nameHolder` is asked with no `except`. Every other door in this
     * app passes the record being renamed, so a rename does not collide with
     * itself; here there is no such record - add-only always creates a second
     * row, so the campaign holding the arriving id is exactly the one that must
     * be collided against. It is about to be sitting next to it in MENU.
     */
    expect(preview.mintedName).toBe('My campaign (imported)');

    const out = landed(outcome);
    expect(store.records.size).toBe(2);
    expect(out.campaign.name).toBe('My campaign (imported)');
    expect((store.records.get(LEGACY) as Campaign).fear).toBe(7);
    expect((store.records.get(out.campaign.id) as Campaign).fear).toBe(3);
  });
});

describe('what happens when the write does not', () => {
  it('names the quota rather than an apology, and writes nothing', async () => {
    const store = fakeStore(
      {},
      {
        add: () =>
          Promise.reject(
            Object.assign(new Error('The quota has been exceeded.'), {
              name: 'QuotaExceededError',
            }),
          ),
      },
    );
    const arriving = fileOf(full());
    const asRead = stable(arriving.campaign);

    const { preview, outcome } = await run(arriving, store, here());

    expect(outcome.kind).toBe('write-failed');
    expect(outcome.kind === 'write-failed' && outcome.message).toContain('QuotaExceededError');
    expect(outcome.kind === 'write-failed' && outcome.message).toContain(
      'The quota has been exceeded.',
    );
    expect(store.records.size).toBe(0);
    // And the record the preview is holding is untouched, so OPEN A CAMPAIGN
    // FILE tries again from the same place rather than from something this
    // attempt edited on the way past.
    expect(stable(preview.incoming)).toBe(asRead);
  });

  it('gives up after three ids rather than looping', async () => {
    // Case D. Not reachable in practice, and specified so that it is not
    // discovered by somebody reading a loop with no ceiling in it.
    const add = vi.fn((_c: Campaign): Promise<'taken'> => Promise.resolve('taken'));
    const store = fakeStore({}, { add });
    const { outcome } = await run(fileOf(full()), store, here());

    expect(outcome.kind).toBe('write-failed');
    expect(add).toHaveBeenCalledTimes(3);
    expect(add.mock.calls.map(([c]) => c.id)).toEqual(['c-1', 'minted-1', 'minted-2']);
  });

  it('turns a misbehaving dep into an outcome instead of a rejection', async () => {
    // The screen on the other side has three sentences and no fourth. A
    // rejection escaping into it is a spinner that never stops over a write
    // that may well have landed.
    const store = fakeStore({}, { add: () => Promise.reject(new Error('the disk went away')) });
    const { outcome } = await run(fileOf(full()), store, here());
    expect(outcome.kind).toBe('write-failed');
    expect(outcome.kind === 'write-failed' && outcome.message).toBe('the disk went away');
  });
});

describe('two tabs importing the same file at the same moment', () => {
  it('makes two whole campaigns and destroys neither', async () => {
    /*
     * Both previews are taken before either write, which is the actual race:
     * two tabs, one file, one device. `add` decides it inside the transaction,
     * so one of them is told the key is taken and mints - and the GM ends up
     * with a duplicate they can see and remove, rather than one campaign
     * written over the other.
     */
    const store = fakeStore();
    const arriving = fileOf(full());
    const one = previewCampaignImport(arriving, here());
    const two = previewCampaignImport(arriving, here());

    const [a, b] = await Promise.all([
      applyCampaignImport(one, store.deps),
      applyCampaignImport(two, store.deps),
    ]);

    const first = landed(a);
    const second = landed(b);
    expect(store.records.size).toBe(2);
    expect(first.campaign.id).not.toBe(second.campaign.id);
    expect([first.campaign.name, second.campaign.name].sort()).toEqual([
      'The Sablewood Winter',
      'The Sablewood Winter (imported)',
    ]);
    for (const out of [first, second]) {
      const stored = store.records.get(out.campaign.id) as Campaign;
      expect(stored.session).toHaveLength(2);
      expect(stored.party).toHaveLength(1);
      expect(stored.fear).toBe(7);
    }
  });
});

describe('a file this build cannot read never reaches the store', () => {
  it('refuses a campaign written by a newer version, and offers the remedy', async () => {
    const store = fakeStore();
    const add = vi.spyOn(store.deps, 'add');
    const ahead = envelope(full(), CAMPAIGN_SCHEMA_VERSION + 1);

    expect(() => parseCampaignFile(ahead)).toThrow(ImportError);
    expect(() => parseCampaignFile(ahead)).toThrow(/newer version of the app.*Update the app/s);
    expect(add).not.toHaveBeenCalled();
    expect(store.records.size).toBe(0);
  });
});

describe('a frozen v1 file, all the way onto the disk', () => {
  it('walks the whole path and arrives at this build’s schema', async () => {
    /*
     * The one test here that starts from a real file somebody exported. Green
     * today at the current campaign schema and green at the next one without an
     * edit, because nothing in it names a version by number: it asserts against
     * `CAMPAIGN_SCHEMA_VERSION`, and the day that moves this walks a converter
     * that did not exist when it was written.
     */
    const file = parseCampaignFile(readFileSync(join(FIXTURES, 'v1.dhcampaign'), 'utf8'));
    const store = fakeStore();

    const { preview, outcome } = await run(file, store, here());
    const stored = store.records.get(landed(outcome).campaign.id) as Campaign;

    expect(preview.schemaVersion).toBe(1);
    expect(preview.converted).toBe(true);
    expect(stored.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(stored.session.map((i) => i.kind)).toEqual([
      'scene',
      'encounter',
      'countdown',
      'link',
      'link',
    ]);
    expect(stored.fear).toBe(7);
    expect(stored.board.environmentRef).toBe('raging-river');
    // The reader dropped this file's party stub on the way through, and said
    // so. The sentence is the GM's only notice that a player's sheet is not on
    // the board, so it survives onto the outcome rather than stopping at the
    // preview.
    expect(landed(outcome).warnings).toEqual(preview.warnings);
    expect(preview.warnings.join(' ')).toContain('Ilya of the Ninth');
  });

  it('says nothing about a conversion when there was none', async () => {
    // The control for `converted`, which is the only thing on the preview that
    // is about the envelope rather than about the record.
    const { preview } = await run(fileOf(full()), fakeStore(), here());
    expect(preview.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(preview.converted).toBe(false);
  });
});

describe('what the preview says, and what it never decides', () => {
  it('counts the four lists and names the oldest sheet in the party', async () => {
    const older: PartyMember = { ...member(), id: 'pc-2', importedAt: '2026-01-02T00:00:00.000Z' };
    const file = fileOf(full({ party: [member(), { ...older, sheet: { ...older.sheet, id: 'pc-2' } }] }));

    const preview = previewCampaignImport(file, here());

    expect(preview.counts).toEqual({ session: 2, archive: 1, register: 1, party: 2 });
    expect(preview.oldestPartyImportedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('carries the file’s own warnings, in order and uncounted', async () => {
    const file = parseCampaignFile(readFileSync(join(FIXTURES, 'v1.dhcampaign'), 'utf8'));
    expect(previewCampaignImport(file, here()).warnings).toEqual(file.warnings);
  });
});
