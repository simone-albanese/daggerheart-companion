/**
 * Preferences live in localStorage: they are small, synchronous, and losing
 * them costs nothing. Everything that would hurt to lose is in IndexedDB.
 */
import type { Screen } from './state.ts';

export interface Prefs {
  theme: 'dark' | 'light' | 'system';
  /** Turn the digital roller off for tables that only use physical dice. */
  digitalDice: boolean;
  /**
   * Let the Hope and Fear faces be typed into.
   *
   * Off by default, and that is the point. The faces used to be inputs
   * unconditionally, which spent the best band on the phone - directly above
   * ROLL, directly under the thumb - on two controls that showed an em dash
   * until somebody tapped them, and put a one-tap edit of a resolved roll
   * where a thumb rests. A table rolling real dice turns this on and gets the
   * faces back; everyone else gets the height, and the roll they just made
   * cannot be changed by brushing it.
   */
  manualDice: boolean;
  /** The optional Massive Damage rule (twice Severe marks 4 HP). */
  massiveDamageRule: boolean;
  /** Colour-blind safe mode also shapes the domain marks. Shapes are always on. */
  shapeCoding: boolean;
  /**
   * How the four resource counters are drawn on the Play screen.
   *
   * Numbers by default. A pip row is the better readout - it shows the size of
   * the track and how much of it is gone in one glance - and it is the worse
   * *control*, because moving from 2 to 7 is five separate taps at the touch
   * floor and any one of them landing wrong is a wrong number on the sheet.
   * The numeric row keeps a stepper for the one-at-a-time case and puts the
   * whole value one tap from being typed.
   *
   * Scoped to the Play screen on phone and tablet. The desktop cockpit keeps
   * pips because it has the room and a precise pointer; the GM's party board
   * and the companion panel keep them because there you are reading somebody
   * else's state rather than marking your own.
   */
  counterStyle: 'numbers' | 'pips';
  wakeLock: boolean;
  reduceMotion: boolean;
  lastScreen: Screen;
  lastCharacterId?: string;
  /** ISO date of the last successful export. Drives the backup nag. */
  lastBackupAt?: string;
  /** Directory handle name, when the File System Access API is available. */
  backupTarget?: string;
  /** Suppresses the "cards have no art" offer once it has been seen. */
  seenArtOffer: boolean;
  gmPartySize: number;
  /**
   * Which collapsible sections of the Play screen are open, per character.
   *
   * Keyed `<characterId>:<sectionId>`, and here rather than on the character
   * for three reasons. A disclosure is a fact about a screen on this device,
   * not about the person: it must not ride out in a `.dhchar`, where it would
   * arrive as a difference between two copies of the same character and cost
   * an import conflict. It must not bump `SCHEMA_VERSION`, which is what
   * Architecture.md 6.1 would require of a new field on the record. And a
   * character write is debounced to IndexedDB and stamps `updatedAt`, so
   * opening a section would make the sheet look edited to every merge decision
   * downstream - which is a lie about the character in service of a chevron.
   *
   * Per character all the same, because which sections are worth their height
   * is a property of the sheet: a Druid wants Beastform open, a level 1 with
   * two cards does not want a vault, and the whole point of the disclosures is
   * that the sheet fits once you have said which parts of it you use. Entries
   * are dropped when their character is deleted.
   */
  playSections: Record<string, boolean>;
}

const KEY = 'dhc.prefs.v1';

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  digitalDice: true,
  manualDice: false,
  massiveDamageRule: false,
  shapeCoding: true,
  counterStyle: 'numbers',
  wakeLock: true,
  reduceMotion: false,
  lastScreen: 'play',
  seenArtOffer: false,
  gmPartySize: 4,
  playSections: {},
};

export function loadPrefs(): Prefs {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode, quota, or a browser that refuses. Not worth surfacing.
  }
}

/** Days since the last export, or null if there has never been one. */
export function daysSinceBackup(prefs: Prefs): number | null {
  if (prefs.lastBackupAt === undefined) return null;
  const then = Date.parse(prefs.lastBackupAt);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}
