// @vitest-environment jsdom
/**
 * The party board, and the two things a GM can do to somebody else's sheet.
 *
 * The board offers nine actions. Seven of them were reached by something:
 * IMPORT A FILE and SCAN A CODE through `gmScreen.test.tsx`, the empty board's
 * two offers with them, the message's dismiss, the row's own disclosure, and
 * the four tracks through `gmStore.test.ts`'s `markPartyTracks`. Two were
 * reached by nothing at all, in this suite or any other:
 *
 *   BACK TO WHAT ARRIVED   `resetPartyTracks`
 *   REMOVE FROM THE BOARD  `removePartyMember`
 *
 * They are the two that undo, which is the half of a control that gets written
 * once and then never exercised again - and they are the two that act on data
 * that does not belong to the person pressing them. `removePartyMember` in
 * particular is the only path by which one player's sheet leaves this device
 * *while the campaign stays* - which is not the same claim as the one this
 * docblock used to make, and the difference matters. `party` is a field of the
 * campaign record, so `removeCampaign` from MENU takes every sheet on that
 * board with it, and "Erase everything" in Settings empties the store wholesale.
 * Both are reachable, both are deliberate, and neither is this control. What is
 * particular to this one is that another player's
 * character sheet leaves this device.
 *
 * The banner is here for the same reason. A board that holds whole copies of
 * other people's characters and does not say so is not made honest by a
 * docblock, and the sentence that was there instead - "EVERY NUMBER IS AS
 * IMPORTED" - was disproved by the drawer one tap below it.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character, CompanionState } from '../../shared/types.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { newCompanion } from '../../src/engine/companion.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { PartyBoard } from '../../src/ui/gm/PartyBoard.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index, playedCharacter } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({ hydrated: true, party: [] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** A sheet with a name of its own, so two rows can be told apart. */
const sheet = (id: string, name: string): Character => ({ ...playedCharacter(), id, name });

const board = (phone = false): void => {
  act(() => root.render(createElement(PartyBoard, { phone })));
};
const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim() === label);
  if (found === undefined) {
    throw new Error(`no button reads "${label}"; there are: ${buttons().map((b) => (b.textContent ?? '').trim()).join(' | ')}`);
  }
  return found;
};
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
/** The row header is the only `aria-expanded` on the board. */
const openRow = (nth = 0): void => {
  click([...container.querySelectorAll('button[aria-expanded]')][nth]!);
};
const put = (...sheets: Character[]): void => {
  act(() => {
    useGm.getState().importParty(sheets, 'file');
  });
};
const mark = (id: string, patch: Record<string, number>): void => {
  act(() => {
    useGm.getState().markPartyTracks(id, patch);
  });
};
const party = () => useGm.getState().party;

describe('the banner: what the board is holding', () => {
  it('says whose sheets these are, in the same words at both widths', () => {
    put(sheet('pc-1', 'Ilya'));
    board(true);
    const onPhone = text();
    act(() => root.unmount());
    root = createRoot(container);
    board(false);

    for (const rendered of [onPhone, text()]) {
      expect(rendered).toContain('WHOLE COPIES OF OTHER PEOPLE’S SHEETS');
      expect(rendered).toContain('THEY STAY ON THIS DEVICE UNTIL YOU REMOVE THEM');
    }
  });

  it('does not tell the board that every number is as imported, because the drawer disproves it', () => {
    // The row's own stamp is the honest version of this claim and it is per
    // row, which is the only place it can be true: one marked track and this
    // row is the GM's count while the next one is still the file's.
    put(sheet('pc-1', 'Ilya'), sheet('pc-2', 'Brann'));
    mark('pc-1', { stress: 1 });
    board(true);

    expect(text()).not.toContain('EVERY NUMBER IS AS IMPORTED');
    expect(text()).toContain('YOUR COUNT');
    expect(text()).toContain('AS IMPORTED ·');
  });
});

describe('BACK TO WHAT ARRIVED', () => {
  it('puts the file’s numbers back and stops calling them the GM’s', () => {
    const arrived = sheet('pc-1', 'Ilya');
    put(arrived);
    mark('pc-1', { hp: arrived.hp.marked + 3, stress: 0 });
    board();
    openRow();
    expect(text()).toContain('YOUR COUNT');

    click(named('BACK TO WHAT ARRIVED'));

    expect(party()[0]!.tracks).toEqual({
      hp: arrived.hp.marked,
      stress: arrived.stress.marked,
      hope: arrived.hope.marked,
      armor: arrived.armorSlots.marked,
    });
    expect(party()[0]!.markedAt).toBeNull();
    expect(text()).toContain('AS IMPORTED');
    expect(text()).not.toContain('YOUR COUNT');
  });

  it('is not offered on a row nobody has marked, because it would do nothing', () => {
    put(sheet('pc-1', 'Ilya'));
    board();
    openRow();
    expect(named('BACK TO WHAT ARRIVED').disabled).toBe(true);

    mark('pc-1', { hp: 1 });
    expect(named('BACK TO WHAT ARRIVED').disabled).toBe(false);
  });
});

describe('REMOVE FROM THE BOARD', () => {
  it('takes the sheet off the board without touching the campaign', () => {
    put(sheet('pc-1', 'Ilya'));
    board();
    openRow();

    click(named('REMOVE FROM THE BOARD'));

    expect(party()).toEqual([]);
    expect(text()).toContain('Nobody on the board');
  });

  it('takes the row it is in and not the board', () => {
    // The mutation this is really about: `party: []` instead of a filter
    // passes the test above and empties a table mid-session.
    put(sheet('pc-1', 'Ilya'), sheet('pc-2', 'Brann'));
    mark('pc-2', { hp: 5 });
    board();
    openRow(0);

    click(named('REMOVE FROM THE BOARD'));

    expect(party().map((m) => m.sheet.name)).toEqual(['Brann']);
    expect(party()[0]!.tracks.hp).toBe(5);
    expect(party()[0]!.markedAt).not.toBeNull();
  });

  it('declares the touch floor on both of the drawer’s buttons, inline', () => {
    // House rule, and jsdom only ever sees the inline style: a height that
    // arrives from `.btn` or from a stretched parent measures 0 here. Both of
    // these sit at the foot of a scrolling drawer, under a thumb.
    put(sheet('pc-1', 'Ilya'));
    board(true);
    openRow();
    for (const label of ['BACK TO WHAT ARRIVED', 'REMOVE FROM THE BOARD']) {
      expect(named(label).style.minHeight).toBe('var(--control)');
    }
  });
});

/**
 * The second creature, which this board could not see.
 *
 * A Beastbound Ranger is two things to target and the board drew one of them.
 * The data was here all along - `party.ts` keeps the sheet whole, so
 * `sheet.companion` arrived with everything else and was simply never drawn.
 *
 * Evasion leads, because that is the number an attack is rolled against and it
 * is not the Ranger's.
 */
describe('a companion on the board', () => {
  const withCompanion = (over: Partial<CompanionState> = {}): Character => ({
    ...sheet('ranger', 'Wren'),
    companion: {
      ...newCompanion('Ashfoot', 'A grey wolf'),
      evasion: 12,
      damage: 'd6+2',
      range: 'Close',
      ...over,
    },
  });

  it('draws nothing for a sheet with no companion', () => {
    /*
     * Both rows on the board at once, and exactly one companion line between
     * them.
     *
     * An absence on its own is what stood here - `not.toMatch(/STRESS \d+\/\d+/)`,
     * under a note claiming the companion line is the only thing on this board
     * that writes STRESS as `n/n`. It is not: `Pill` writes the character's own
     * the same way and only the missing space keeps the pattern off it, so the
     * assertion was one whitespace change away from passing for the wrong
     * reason - which is verbatim the flaw it was written to correct. Counting
     * the matches on a board that carries one row of each kind cannot go quiet
     * that way: a needle that stops finding the companion line fails here
     * rather than passing everywhere.
     */
    put(sheet('a', 'Marek'), withCompanion());
    board();
    expect(text().match(/ · EVASION \d+ · /g) ?? []).toHaveLength(1);
    expect(text()).toContain('ASHFOOT');
  });

  it('names them, with their own Evasion and the pool that will be rolled', () => {
    const character = withCompanion();
    put(character);
    board();
    expect(text()).toContain('ASHFOOT');
    /*
     * THEIR Evasion, with the number attached to the word.
     *
     * `expect(text()).toContain('EVASION')` was what stood here, and the row
     * above this line already prints EVASION for the Ranger: deleting the
     * companion's own figure outright left that assertion green, which is the
     * whole reason the line was added. The fixture's own Evasion is asserted
     * beside it so the two can never quietly become the same number.
     */
    const own = deriveStats(character, dataset, index).evasion;
    expect(own, 'the companion shares the Ranger’s Evasion, so this proves nothing').not.toBe(12);
    expect(text()).toContain('EVASION 12');
    // Proficiency applied, because that is the roll: their die, the Ranger's
    // Proficiency. The fixture is level 3, so Proficiency is 2.
    expect(text()).toContain('2d6+2');
    expect(text()).toContain('CLOSE');
  });

  it('says which damage type, since the sheet now records one', () => {
    put(withCompanion({ damageType: 'mag' }));
    board();
    expect(text()).toContain('MAG');
  });

  it('says physical when that is what the sheet records, and not by default', () => {
    /*
     * The direction nothing held. With only the `mag` case above and the
     * legacy row below - where the field is absent - the whole line could be
     * inverted to `damageType === undefined ? 'PHY' : 'MAG'` and this file
     * stayed 14/14 green. A companion who was *chosen* to be physical is the
     * one shape neither of those covers, and it is the commonest one there is.
     */
    put(withCompanion({ damageType: 'phy' }));
    board();
    expect(text()).toContain('PHY');
    expect(text()).not.toContain('MAG');
  });

  it('says when the animal has left the scene', () => {
    put(withCompanion({ stress: { marked: 3, max: 3 } }));
    board();
    expect(text()).toContain('OUT OF THE SCENE');
  });

  it('says nothing of the kind while they still have a slot', () => {
    put(withCompanion({ stress: { marked: 2, max: 3 } }));
    board();
    expect(text()).toContain('STRESS 2/3');
    expect(text()).not.toContain('OUT OF THE SCENE');
  });
});

/**
 * A sheet from the schema before this one, which is what a saved board holds.
 *
 * `readPartyMember` casts the stored object straight to `Character` - the
 * character migration chain never runs on a campaign's copies - so a board
 * saved before a field existed hands this screen a sheet without it. When
 * `damageType` arrived in schema 5 the board called `.toUpperCase()` on it and
 * every GM with a Beastbound Ranger already on the board lost the whole board
 * on first render, which is the exact failure `readPartyMember`'s own docblock
 * is written to prevent.
 */
describe('a party row saved by an older schema', () => {
  const legacy = (): Character => {
    const companion = { ...newCompanion('Ashfoot', 'A grey wolf') } as Record<string, unknown>;
    // Precisely what schema 4 wrote: everything else, and no damage type.
    delete companion['damageType'];
    return { ...sheet('legacy', 'Wren'), companion } as unknown as Character;
  };

  it('draws the row instead of taking the board down', () => {
    put(legacy());
    board();
    expect(text()).toContain('Wren');
    expect(text()).toContain('ASHFOOT');
  });

  it('reads the missing type as physical, the way every older sheet behaved', () => {
    put(legacy());
    board();
    expect(text()).toContain('PHY');
    expect(text()).not.toContain('MAG');
  });
});
