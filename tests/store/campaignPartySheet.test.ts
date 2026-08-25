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
import { newCharacter } from '../../src/engine/character.ts';

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
