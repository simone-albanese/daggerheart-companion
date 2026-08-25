/**
 * The party row a campaign cannot draw, and what the reader does with it.
 *
 * A campaign record holds whole copies of other people's character sheets, and
 * for three schema versions `readPartyMember` handed whatever it found straight
 * to `src/ui/gm/` behind a cast. Opening a campaign whose party row carried the
 * nine-field stub in `tests/fixtures/schema/v2.campaign.json` took the entire GM
 * screen down on first render - `Cannot read properties of undefined (reading
 * 'filter')`, which is `levelUpHistory.filter` inside `deriveStats`, called once
 * per row by the board.
 *
 * The migration chain is not a check and never was: handed a record already
 * stamped at the current character schema it returns it untouched, so a stub
 * that says schema 5 walks through it with nothing having looked at it.
 * `boardShortfall` is the thing that looks.
 *
 * This file asks three questions of that guard, and the third is the one that
 * stops it being satisfied by refusing everything.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  boardShortfall,
  CAMPAIGN_SCHEMA_VERSION,
  primaryCountdownOf,
  readCampaignRecord,
} from '../../shared/campaigns.ts';
import { deriveStats, indexDataset, newCharacter } from '../../src/engine/character.ts';
import type { Character } from '../../shared/types.ts';
import { makeClass, makeDataset, makeSubclass } from '../fixtures/factories.ts';

const v2 = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../fixtures/schema/v2.campaign.json', import.meta.url)), 'utf8'),
  ) as Record<string, unknown>;

/** A whole character, under a party row, in a campaign that has nothing else. */
const withSheet = (sheet: Record<string, unknown>): Record<string, unknown> => ({
  id: 'campaign-1',
  schemaVersion: CAMPAIGN_SCHEMA_VERSION,
  name: 'A Campaign',
  party: [{ id: 'p1', sheet, source: 'file', tracks: { hp: 1, stress: 2, hope: 3, armor: 0 } }],
});

const whole = (): Record<string, unknown> => ({
  ...(newCharacter({ name: 'Ilya of the Ninth' }) as unknown as Record<string, unknown>),
  id: 'ilya',
});

describe('a party sheet the board could not have drawn', () => {
  it('drops its row rather than handing it to the GM screen', () => {
    const { campaign } = readCampaignRecord(v2());
    expect(campaign.party).toEqual([]);
  });

  it('says which character it was and what to do about it', () => {
    const { warnings } = readCampaignRecord(v2());
    const said = warnings.join(' ');

    // The three things a GM can act on: who, what is wrong, and the way back.
    expect(said).toContain('Ilya of the Ninth');
    expect(said).toMatch(/not a whole character/);
    expect(said).toMatch(/Import that character again/);
    // Named, not merely counted - the first missing field is in the sentence.
    expect(said).toContain('classRef');
  });

  it('leaves the rest of the campaign exactly where it was', () => {
    /*
     * The clause the reader's own docblock calls its contract: it warns and
     * never refuses a campaign. One row is gone; nothing else in the record
     * notices. These are the fields the v2 conversion is pinned on in
     * `tests/store/campaignSchema.test.ts`, asked again on the far side of the
     * new refusal so that a guard which took the campaign down with the row
     * fails here.
     */
    const { campaign } = readCampaignRecord(v2());
    expect(campaign.schemaVersion).toBe(CAMPAIGN_SCHEMA_VERSION);
    expect(campaign.name).toBe('The Sablewood Winter');
    expect(campaign.fear).toBe(7);
    expect(campaign.session).toHaveLength(7);
    expect(campaign.session.map((i) => i.kind)).toEqual([
      'scene',
      'encounter',
      'countdown',
      'link',
      'link',
      'url',
      'note',
    ]);
    expect(primaryCountdownOf(campaign.session)?.value).toBe(4);
    expect(campaign.board.environmentRef).toBe('raging-river');
  });
});

describe('a party sheet the board can draw', () => {
  it('comes through the reader untouched', () => {
    const sheet = whole();
    const { campaign, warnings } = readCampaignRecord(withSheet(sheet));

    expect(warnings).toEqual([]);
    expect(campaign.party).toHaveLength(1);
    expect(campaign.party[0]!.sheet).toEqual(sheet);
    expect(campaign.party[0]!.tracks.stress).toBe(2);
  });

  it('is what a blank character already is, which is what stops this list drifting', () => {
    /*
     * The compiler cannot hold `BOARD_FIELDS` to `Character`: the list lives in
     * `shared/`, `newCharacter` lives in `src/engine/`, and `shared/` may not
     * import from `src/` because `tools/` uses it too. This assertion is the
     * substitute. Rename a field in `shared/types.ts` and update `newCharacter`
     * without updating the list and this goes red here, rather than silently
     * refusing every party row in the world.
     */
    expect(boardShortfall(newCharacter({ name: 'Anyone' }) as unknown as Record<string, unknown>)).toEqual([]);
  });

  it('checks the fields the GM screen reads, written out here and not asked of the guard', () => {
    /*
     * THE MASKING THIS LIST EXISTS TO STOP, AND IT WAS MEASURED RATHER THAN
     * IMAGINED. Every other assertion in this file asks `boardShortfall` which
     * fields it checks and then checks those, so a field quietly dropped from
     * the guard leaves the question as well as the answer. Loosening the
     * `levelUpHistory` predicate to one that answers true - the exact field the
     * crash was - left the whole suite green.
     *
     * So the set is written out by hand, from the consumers: everything
     * `deriveStats` and `collectModifiers` name on a character, everything
     * `findGaps` reads, and everything the `src/ui/gm/` components read
     * themselves. Adding a field the guard checks that no GM screen reads fails
     * here too, which is the other half of the promise - a row is not refused
     * for a field nobody looks at.
     */
    expect(boardShortfall({})).toEqual([
      'id',
      'name',
      'level',
      'classRef',
      'traits',
      'hp',
      'stress',
      'hope',
      'armorSlots',
      'evasionOverride',
      'thresholdOverride',
      'communityRef',
      'multiclassRef',
      'multiclassDomain',
      'activePrimaryWeapon',
      'activeSecondaryWeapon',
      'activeArmor',
      'subclassRefs',
      'ancestryRefs',
      'inventory',
      'experiences',
      'levelUpHistory',
      'scars',
      'beastform',
      'companion',
    ]);
  });

  it('refuses a sheet whole but for the field the crash was', () => {
    // The reproduction, one field wide. `deriveStats` calls
    // `c.levelUpHistory.filter` before it reads anything else, which is the
    // `Cannot read properties of undefined (reading 'filter')` a GM saw.
    const sheet = whole();
    delete sheet['levelUpHistory'];
    const { campaign, warnings } = readCampaignRecord(withSheet(sheet));
    expect(campaign.party).toEqual([]);
    expect(warnings.join(' ')).toContain('levelUpHistory');
  });

  it('refuses each field the board reads, one at a time, and names it', () => {
    /*
     * The guard is a list, so the risk is a member of it that does nothing -
     * a predicate that answers true for an absent field. Every key is deleted
     * in turn from a sheet that is otherwise whole, and the row has to go.
     */
    const keys = boardShortfall({});
    expect(keys.length).toBeGreaterThan(20);

    // `name` is the one field the guard never gets to see: a sheet without a
    // string name is refused two clauses earlier, by the arm that has been
    // there since `gmStore.load()`, and it says its own sentence.
    const noName = whole();
    delete noName['name'];
    expect(readCampaignRecord(withSheet(noName)).warnings.join(' ')).toMatch(/no character sheet/);

    for (const key of keys.filter((k) => k !== 'name')) {
      const sheet = whole();
      delete sheet[key];
      const { campaign, warnings } = readCampaignRecord(withSheet(sheet));
      expect(campaign.party, `a sheet with no "${key}" was put on the board`).toEqual([]);
      expect(warnings.join(' '), `"${key}" was refused without being named`).toContain(key);
    }
  });

  it('refuses half an animal, which is the shape CompanionLine calls methods on', () => {
    // `companion.name.toUpperCase()` and `companion.stress.marked` are both in
    // `PartyBoard`, and `companion: {}` satisfies a bare object check.
    const sheet = whole();
    sheet['companion'] = { name: 'Ashfoot' };
    const { campaign, warnings } = readCampaignRecord(withSheet(sheet));
    expect(campaign.party).toEqual([]);
    expect(warnings.join(' ')).toContain('companion');
  });
});

/**
 * THE OTHER HALF OF THE GUARD: how deep each predicate goes.
 *
 * The first version of this file asked twenty-five questions and every one of
 * them deleted a field. That is one severity, and a guard has two: a predicate
 * that answers true for an absent field is caught by the loop above, and a
 * predicate that answers true for a field of the WRONG SHAPE was caught by
 * nothing at all. A verifier walked straight through the first version of
 * `boardShortfall` with `levelUpHistory: [null]` - a list, so `Array.isArray`
 * said yes - and took the board down with the original crash.
 *
 * So the shapes are written out here by hand, the way the field list above is,
 * and for the same reason: asking the guard which shapes it stops is asking the
 * question and the answer at once.
 *
 * Each row of `FATAL` was MEASURED, not argued: `proves` is the consumer that
 * throws on it, and the last describe in this file hands the shape to that
 * consumer and requires it to throw. When a consumer is made total, its row
 * goes red here and the predicate above it can be loosened - which is the only
 * honest reason to loosen it.
 */
const ds = makeDataset({
  classes: [makeClass({ startingEvasion: 11, startingHitPoints: 5, domains: ['blade', 'valor'] })],
  subclasses: [makeSubclass({ id: 'caster', name: 'Caster', spellcastTrait: 'presence' })],
});
const ix = indexDataset(ds);

/** A whole sheet whose subclass resolves, so `collectModifiers` runs its arm. */
const played = (): Record<string, unknown> => ({
  ...whole(),
  classRef: 'test-class',
  subclassRefs: ['caster'],
});

const FATAL: Array<{ field: string; value: unknown; why: string }> = [
  {
    field: 'levelUpHistory',
    value: [null],
    why: "`advancementCount` reads `a.kind` off every element - the original crash, one element deep",
  },
  {
    field: 'levelUpHistory',
    value: [{ level: 2, slot: 0, kind: 'subclass' }],
    why: "`collectModifiers` reads `h.detail['subclassRef']` once the subclass resolves",
  },
  {
    field: 'levelUpHistory',
    value: [{ level: 2, slot: 0, kind: 'subclass', detail: null }],
    why: 'the same read, with `detail` present and null',
  },
  {
    field: 'inventory',
    value: [null],
    why: '`collectModifiers` reads `entry.ref` off every carried entry',
  },
  {
    field: 'experiences',
    value: [null],
    why: "the drawer's `Experiences` reads `.name` off every one - the read no deletion test could reach, because the loop never opened the drawer",
  },
];

/**
 * And the shapes that must KEEP their row.
 *
 * Refusing costs a GM a whole row and names a player to go and ask, so a guard
 * that refuses more than it must is not the safe direction - it is the other
 * way to lose a board. Every shape here was measured harmless at the same time
 * the fatal ones were measured fatal.
 */
const TOLERATED: Array<{ field: string; value: unknown; why: string }> = [
  { field: 'scars', value: [null, {}], why: '`deriveStats` only ever takes `.length`' },
  { field: 'subclassRefs', value: [{}], why: 'handed to `Map.get`, which is total for any key' },
  { field: 'ancestryRefs', value: [null], why: 'the same, plus an `!== undefined` in `collectModifiers`' },
  { field: 'inventory', value: [{}], why: 'an entry with no `ref` reads as free text, and draws' },
  { field: 'experiences', value: [{}], why: 'a nameless Experience prints "Unnamed", which is a board you can read and disbelieve' },
];

describe('a party sheet whose fields are the wrong shape', () => {
  it.each(FATAL)('refuses $field as $value, because $why', ({ field, value }) => {
    const sheet = played();
    sheet[field] = value;
    const { campaign, warnings } = readCampaignRecord(withSheet(sheet));

    expect(campaign.party).toEqual([]);
    expect(warnings.join(' ')).toContain(field);
  });

  it.each(TOLERATED)('keeps the row when $field is $value, because $why', ({ field, value }) => {
    const sheet = played();
    sheet[field] = value;
    const { campaign, warnings } = readCampaignRecord(withSheet(sheet));

    expect(warnings, `"${field}" was refused for a shape measured harmless`).toEqual([]);
    expect(campaign.party).toHaveLength(1);
  });

  it('refuses a wrong-shaped value for every field it checks, not just an absent one', () => {
    /*
     * The sweep the first version did not have. `false` is a value no field on
     * a character can legally hold - not a number, not a string, not a record,
     * not a list, not null - so a predicate that lets it through is a predicate
     * that is not looking at the value at all.
     */
    for (const key of boardShortfall({}).filter((k) => k !== 'name')) {
      const sheet = played();
      sheet[key] = false;
      const { campaign, warnings } = readCampaignRecord(withSheet(sheet));
      expect(campaign.party, `a sheet whose "${key}" was \`false\` was put on the board`).toEqual([]);
      expect(warnings.join(' '), `"${key}" was refused without being named`).toContain(key);
    }
  });

  it('reads the six traits by name, and not the object that holds them', () => {
    // `deriveStats` reads every trait by name and adds it to a number. An
    // object that is a record and holds none of them is the shape that gets
    // through a bare `isRecord`, and NaN is what a GM would have read.
    for (const traits of [{}, { agility: 1 }, { agility: '1', strength: 1, finesse: 1, instinct: 1, presence: 1, knowledge: 1 }]) {
      const sheet = played();
      sheet['traits'] = traits;
      expect(readCampaignRecord(withSheet(sheet)).campaign.party, `traits ${JSON.stringify(traits)} drew a row`).toEqual([]);
    }
  });

  it('reads a track as two numbers, and not as an object with a shape', () => {
    // The four counters are printed as `marked`/`max` by the row itself.
    for (const track of [{}, { marked: 1 }, { max: 6 }, { marked: '1', max: 6 }]) {
      const sheet = played();
      sheet['hp'] = track;
      expect(readCampaignRecord(withSheet(sheet)).campaign.party, `hp ${JSON.stringify(track)} drew a row`).toEqual([]);
    }
  });
});

/**
 * The measurement the depths above are copied from.
 *
 * A guard is deep enough when it stops what the consumers cannot survive, so
 * the consumers are asked directly. This is the test that stops the table
 * turning into folklore: if `advancementCount` is one day written to skip a
 * hole, its row here goes red, and the predicate that refuses a GM's row for it
 * can be loosened on evidence rather than on a feeling.
 *
 * `experiences` is absent from this list and cannot be added to it: its crash
 * is in the drawer, not the engine. It is measured in `tests/gm/partyBoard.test.tsx`,
 * which mounts the component and opens the row.
 */
describe('the shapes the consumers themselves cannot survive', () => {
  const poisoned = (field: string, value: unknown): Character =>
    ({ ...played(), [field]: value }) as unknown as Character;

  it.each(FATAL.filter((f) => f.field !== 'experiences'))(
    '$field as $value takes deriveStats down',
    ({ field, value }) => {
      expect(() => deriveStats(poisoned(field, value), ds, ix)).toThrow();
    },
  );

  it.each(TOLERATED.filter((t) => t.field !== 'experiences'))(
    '$field as $value does not, which is why the guard lets it past',
    ({ field, value }) => {
      expect(() => deriveStats(poisoned(field, value), ds, ix)).not.toThrow();
    },
  );

  it('draws its numbers from a sheet that is whole, so the two above mean something', () => {
    expect(deriveStats(played() as unknown as Character, ds, ix).evasion).toBeGreaterThan(0);
  });
});
