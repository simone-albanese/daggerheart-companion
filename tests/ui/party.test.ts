import { describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import type { DatasetIndex } from '@engine/character.ts';
import {
  describeAge,
  findGaps,
  tracksFromSheet,
  upsertMember,
  type PartyMember,
} from '../../src/ui/gm/party.ts';
import { makeCharacter } from '../fixtures/factories.ts';

const AT = '2026-08-15T10:00:00.000Z';
const LATER = '2026-08-15T18:00:00.000Z';

const sheet = (p: Partial<Character> = {}): Character =>
  makeCharacter({
    id: 'kaelith',
    name: 'Kaelith',
    hp: { marked: 2, max: 6 },
    stress: { marked: 1, max: 6 },
    hope: { marked: 4, max: 6 },
    armorSlots: { marked: 1, max: 3 },
    ...p,
  });

const board = (...members: PartyMember[]): PartyMember[] => members;

describe('putting a character on the board', () => {
  it('adds a sheet it has never seen', () => {
    const result = upsertMember(board(), sheet(), 'file', AT);
    expect(result.outcome).toBe('added');
    expect(result.party).toHaveLength(1);
    expect(result.party[0]!.id).toBe('kaelith');
    expect(result.party[0]!.importedAt).toBe(AT);
    expect(result.party[0]!.source).toBe('file');
  });

  it('starts the tracks at the numbers the sheet arrived with', () => {
    const { party } = upsertMember(board(), sheet(), 'file', AT);
    expect(party[0]!.tracks).toEqual({ hp: 2, stress: 1, hope: 4, armor: 1 });
    // Nothing has been marked here yet, which is what lets the board say so.
    expect(party[0]!.markedAt).toBeNull();
  });

  it('keeps two different characters apart', () => {
    const first = upsertMember(board(), sheet(), 'file', AT);
    const second = upsertMember(first.party, sheet({ id: 'brann', name: 'Brann' }), 'code', AT);
    expect(second.outcome).toBe('added');
    expect(second.party.map((m) => m.id)).toEqual(['kaelith', 'brann']);
  });

  it('invents an id for a sheet that has none, and stores it on the sheet', () => {
    const { party } = upsertMember(board(), sheet({ id: '' }), 'file', AT, () => 'invented');
    expect(party[0]!.id).toBe('invented');
    expect(party[0]!.sheet.id).toBe('invented');
  });
});

describe('importing the same character twice', () => {
  const withMarks = (): PartyMember[] => {
    const { party } = upsertMember(board(), sheet(), 'file', AT);
    return party.map((m) => ({ ...m, tracks: { ...m.tracks, hp: 5 }, markedAt: AT }));
  };

  it('replaces the row in place rather than adding a second one', () => {
    const result = upsertMember(withMarks(), sheet({ level: 3 }), 'code', LATER);
    expect(result.outcome).toBe('updated');
    expect(result.party).toHaveLength(1);
    expect(result.party[0]!.sheet.level).toBe(3);
  });

  it('holds its position when other characters are on the board', () => {
    const one = upsertMember(board(), sheet(), 'file', AT);
    const two = upsertMember(one.party, sheet({ id: 'brann', name: 'Brann' }), 'file', AT);
    const again = upsertMember(two.party, sheet(), 'file', LATER);
    expect(again.party.map((m) => m.id)).toEqual(['kaelith', 'brann']);
  });

  it('re-dates the row and takes the tracks from the sheet that just arrived', () => {
    const result = upsertMember(withMarks(), sheet({ hp: { marked: 1, max: 6 } }), 'file', LATER);
    expect(result.party[0]!.importedAt).toBe(LATER);
    expect(result.party[0]!.tracks.hp).toBe(1);
    expect(result.party[0]!.markedAt).toBeNull();
  });
});

describe('reading the tracks off a sheet', () => {
  it('takes marked for HP, Stress and Armor and available for Hope', () => {
    expect(tracksFromSheet(sheet())).toEqual({ hp: 2, stress: 1, hope: 4, armor: 1 });
  });
});

describe('how long ago that was', () => {
  const now = new Date(2026, 7, 15, 18, 0, 0);
  const ago = (ms: number): string => describeAge(new Date(now.getTime() - ms).toISOString(), now);

  it('says just now for the first minute', () => {
    expect(ago(0)).toBe('just now');
    expect(ago(59_000)).toBe('just now');
  });

  it('counts minutes, then hours, then days', () => {
    expect(ago(60_000)).toBe('1 min ago');
    expect(ago(59 * 60_000)).toBe('59 min ago');
    expect(ago(60 * 60_000)).toBe('1 hr ago');
    expect(ago(23 * 3_600_000)).toBe('23 hr ago');
    expect(ago(24 * 3_600_000)).toBe('1 day ago');
    expect(ago(6 * 24 * 3_600_000)).toBe('6 days ago');
  });

  it('gives a date once counting days stops meaning anything', () => {
    expect(describeAge(new Date(2026, 6, 4, 21, 0).toISOString(), now)).toBe('4 Jul');
    expect(describeAge(new Date(2025, 11, 31, 21, 0).toISOString(), now)).toBe('31 Dec 2025');
  });

  it('reads a clock that has gone backwards as just now, never as a negative age', () => {
    expect(describeAge(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe('just now');
  });

  it('says so rather than printing Invalid Date', () => {
    expect(describeAge('not a date', now)).toBe('at an unknown time');
  });
});

describe('what this dataset cannot resolve', () => {
  const index = (classes: string[], armors: string[]): DatasetIndex =>
    ({
      classes: new Map(classes.map((id) => [id, {}])),
      armors: new Map(armors.map((id) => [id, {}])),
    }) as unknown as DatasetIndex;

  it('flags an Evasion with no class behind it', () => {
    const gaps = findGaps(sheet({ classRef: 'wizard' }), index([], []));
    expect(gaps.evasion).toBe(true);
  });

  it('does not flag an Evasion the sheet states outright', () => {
    const gaps = findGaps(sheet({ classRef: 'wizard', evasionOverride: 13 }), index([], []));
    expect(gaps.evasion).toBe(false);
  });

  it('flags thresholds whose armor is missing, because they fall back to unarmored', () => {
    const gaps = findGaps(
      sheet({ classRef: 'wizard', activeArmor: 'gambeson' }),
      index(['wizard'], []),
    );
    expect(gaps.thresholds).toBe(true);
  });

  it('leaves an unarmored sheet alone: there is nothing to look up', () => {
    const gaps = findGaps(sheet({ classRef: 'wizard', activeArmor: null }), index(['wizard'], []));
    expect(gaps.thresholds).toBe(false);
  });

  it('is quiet when the dataset has both', () => {
    const gaps = findGaps(
      sheet({ classRef: 'wizard', activeArmor: 'gambeson' }),
      index(['wizard'], ['gambeson']),
    );
    expect(gaps).toEqual({ evasion: false, thresholds: false });
  });
});
