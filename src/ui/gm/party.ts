/**
 * The party board's data, apart from its screen.
 *
 * A PC on this board is a *sighting*, not a subscription. Nothing in this app
 * can learn what happened to that character after the file was handed over, so
 * only two facts are worth keeping: the sheet exactly as it arrived, and the
 * moment it did. Every number the board prints is derived from the first and
 * dated by the second.
 *
 * The sheet is stored whole rather than as a ref, because a player character is
 * not dataset content - there is nothing to look it up in. It is already refs
 * and values by the time it reaches us, which is the same reason a `.dhchar`
 * survives a dataset update: the rules it depends on are resolved at read time,
 * here, against whatever dataset this GM has.
 */
import type {
  Character,
  PartyMember,
  PartySource,
  PartyTracks,
} from '../../../shared/types.ts';
import type { DatasetIndex } from '../../engine/character.ts';

/*
 * `PartySource`, `PartyTracks` and `PartyMember` are declared in
 * `shared/types.ts` now: a campaign record stores the whole board, so they are
 * persisted shapes and belong beside `Character`. Re-exported here because
 * every screen that draws a row imports them from this module.
 */
export type { PartyMember, PartySource, PartyTracks } from '../../../shared/types.ts';

export interface PartyImport {
  party: PartyMember[];
  outcome: 'added' | 'updated';
}

export const tracksFromSheet = (sheet: Character): PartyTracks => ({
  hp: sheet.hp.marked,
  stress: sheet.stress.marked,
  hope: sheet.hope.marked,
  armor: sheet.armorSlots.marked,
});

/**
 * Put a sheet on the board, or refresh the one already there.
 *
 * A re-import replaces the row in place, tracks included. That is the whole
 * point of the gesture: the file the player just handed over is the one moment
 * the board's numbers are true, and keeping a GM's older tally on top of a
 * newer sheet would leave two different answers on one row with no way to tell
 * which is which. The screen says out loud that this happened.
 */
export function upsertMember(
  party: readonly PartyMember[],
  sheet: Character,
  source: PartySource,
  at: string,
  newId: () => string = () => crypto.randomUUID(),
): PartyImport {
  // A hand-written file can reach us without an id; the board still needs a
  // handle, and one invented here is stored so the next import can match it.
  const id = sheet.id === '' ? newId() : sheet.id;
  const stored = sheet.id === '' ? { ...sheet, id } : sheet;
  const member: PartyMember = {
    id,
    sheet: stored,
    importedAt: at,
    source,
    tracks: tracksFromSheet(stored),
    markedAt: null,
  };
  const index = party.findIndex((m) => m.id === id);
  return index === -1
    ? { party: [...party, member], outcome: 'added' }
    : { party: party.map((m, i) => (i === index ? member : m)), outcome: 'updated' };
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago, said the way a GM would say it out loud.
 *
 * Relative while it is still this campaign's memory, absolute once counting
 * days stops meaning anything. A clock that has gone backwards - a device that
 * corrected its time, a file written on a machine set wrong - reads as just
 * now rather than as a negative age.
 *
 * Sentence case, because it has to sit inside a sentence. The meta rows that
 * want it shouting uppercase the whole line themselves.
 */
export function describeAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return 'at an unknown time';

  const elapsed = now.getTime() - ms;
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) {
    const n = Math.floor(elapsed / MINUTE);
    return `${n} min ago`;
  }
  if (elapsed < DAY) {
    const n = Math.floor(elapsed / HOUR);
    return `${n} hr ago`;
  }
  if (elapsed < 7 * DAY) {
    const n = Math.floor(elapsed / DAY);
    return `${n} day${n === 1 ? '' : 's'} ago`;
  }
  const stamp = `${then.getDate()} ${MONTHS[then.getMonth()]!}`;
  return then.getFullYear() === now.getFullYear() ? stamp : `${stamp} ${then.getFullYear()}`;
}

/**
 * What this dataset cannot resolve about a sheet built somewhere else.
 *
 * Both gaps change a number the GM reads out loud: without the class there is
 * no starting Evasion, and without the armor the thresholds fall back to the
 * unarmored ladder. A manual override on the sheet settles the question by
 * itself, so it closes the gap - the value is then a fact the file carries
 * rather than something we look up.
 */
export interface SheetGaps {
  evasion: boolean;
  thresholds: boolean;
}

export function findGaps(sheet: Character, index: DatasetIndex): SheetGaps {
  return {
    evasion: sheet.evasionOverride === null && !index.classes.has(sheet.classRef),
    thresholds:
      sheet.thresholdOverride === null &&
      sheet.activeArmor !== null &&
      !index.armors.has(sheet.activeArmor),
  };
}
