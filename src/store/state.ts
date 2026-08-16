/**
 * Application state.
 *
 * One store, because the app is one cockpit: the Play screen, the card
 * browser and the GM tools all read the same character and the same dataset.
 * Writes go to IndexedDB on a short debounce - a tap on a counter must feel
 * instant, and a lost 400ms of typing is not worth a synchronous write.
 */
import { create } from 'zustand';
import type { Character, Dataset, DomainCard, Layer } from '../../shared/types.ts';
import {
  deriveStats,
  indexDataset,
  newCharacter,
  syncCounters,
  type DatasetIndex,
  type DerivedStats,
} from '../engine/character.ts';
import type { DualityResult } from '../engine/dice.ts';
import * as db from './db.ts';
import { baseDataset, loadDataset, SRD_LAYER } from './dataset.ts';
import { decideImport, duplicateFor, type ImportChoice, type MergeMode } from './merge.ts';
import { loadPrefs, savePrefs, type Prefs } from './prefs.ts';

export type Screen = 'play' | 'cards' | 'build' | 'gm' | 'settings';

/** An arriving character the app refused to write over, and what is here now. */
export interface ImportConflict {
  incoming: Character;
  local: Character;
}

export interface ImportReport {
  imported: Character[];
  replaced: Character[];
  /** Nothing was written for these. Each one is a question for the user. */
  conflicts: ImportConflict[];
  /** Whatever the file or codec layer wanted to say, carried through. */
  warnings: string[];
}

export interface LogEntry {
  id: string;
  at: string;
  kind: 'duality' | 'damage' | 'incoming' | 'rest' | 'note';
  label: string;
  detail: string;
  outcome?: DualityResult['outcome'];
  total?: number;
}

interface AppState {
  ready: boolean;
  /** Set when storage would not answer. The app still runs, read-only. */
  storageError: string | null;
  /**
   * Records on this device that this build must not touch, and why.
   *
   * Almost always empty. It fills when a newer build has written a character
   * and the user is back on an older bundle - which this app makes possible on
   * purpose, because `UpdateBanner` offers the waiting worker rather than
   * swapping the bundle out from under a session.
   */
  quarantined: db.QuarantinedRecord[];
  dataset: Dataset;
  index: DatasetIndex;
  layers: Layer[];

  characters: Character[];
  activeId: string | null;
  screen: Screen;
  prefs: Prefs;

  /** Session-only. The log is deliberately not persisted. */
  log: LogEntry[];
  /** Card opened in the reader overlay. */
  openCard: DomainCard | null;

  init: () => Promise<void>;
  setScreen: (screen: Screen) => void;
  setPrefs: (patch: Partial<Prefs>) => void;

  select: (id: string | null) => void;
  create: (partial?: Partial<Character>) => Promise<Character>;
  update: (mutate: (c: Character) => Character) => void;
  remove: (id: string) => Promise<void>;
  importCharacters: (incoming: Character[], options?: { mode?: MergeMode; warnings?: string[] }) => Promise<ImportReport>;
  resolveImport: (conflict: ImportConflict, choice: ImportChoice) => Promise<Character | null>;

  pushLog: (entry: Omit<LogEntry, 'id' | 'at'>) => void;
  clearLog: () => void;
  setOpenCard: (card: DomainCard | null) => void;
  reloadDataset: () => Promise<void>;
}

const LOG_LIMIT = 60;

/**
 * Persist on a debounce, and always flush before the page can go away.
 * `pagehide` is the only lifecycle event iOS Safari reliably delivers.
 */
const pending = new Map<string, Character>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const batch = [...pending.values()];
  pending.clear();
  await Promise.all(batch.map((c) => db.putCharacter(c)));
}

function schedule(c: Character): void {
  pending.set(c.id, c);
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flush();
  }, 400);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  storageError: null,
  quarantined: [],
  dataset: baseDataset,
  index: indexDataset(baseDataset),
  layers: [SRD_LAYER],
  characters: [],
  activeId: null,
  screen: 'play',
  prefs: loadPrefs(),
  log: [],
  openCard: null,

  async init() {
    const prefs = loadPrefs();

    /*
     * Storage can refuse to answer, and IndexedDB's way of refusing is to
     * never settle: an upgrade blocked by another tab, a private window that
     * denies the database, an iOS eviction caught mid-flight. Awaiting that
     * forever leaves the app on its loading mark with nothing to read and
     * nothing to press - which looks exactly like a crash and is worse,
     * because the user has no idea their characters are fine.
     *
     * So the wait is bounded, and a failure is a state the app can render.
     * The dataset ships in the bundle, so everything except *your* characters
     * still works.
     */
    const withDeadline = <T,>(work: Promise<T>, what: string): Promise<T> =>
      Promise.race([
        work,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${what} did not respond`)), 8_000),
        ),
      ]);

    let characters: Character[] = [];
    let quarantined: db.QuarantinedRecord[] = [];
    let storageError: string | null = null;
    try {
      const library = await withDeadline(db.readLibrary(), 'This browser’s storage');
      characters = library.characters;
      quarantined = library.quarantined;

      /*
       * Persist what a converter changed, once, here.
       *
       * Leaving it in memory would mean converting the same record on every
       * launch and, worse, exporting a file that still carries the old shape -
       * so the backup a user keeps would stay unreadable-in-the-old-way
       * forever. Writing it back is the point at which the conversion becomes
       * real. It is deliberately not awaited into the boot: a slow write must
       * not delay the first paint, and the debounce would have written it
       * anyway on the next edit.
       */
      for (const c of library.migrated) {
        void db.putCharacter(c).catch(() => {
          // The in-memory copy is already converted, so this is a retry at
          // worst. A failure here is the same failure P0-3 is about.
        });
      }
    } catch (error) {
      /*
       * A stale build meeting a newer database is not the same failure as a
       * database that will not answer, and the generic banner's advice -
       * close the other tabs and reload - cannot work for it, because the
       * stale bundle reloads into the same wall.
       */
      storageError =
        error instanceof Error ? error.message : 'This browser’s storage could not be read';
    }

    let resolved;
    try {
      resolved = await withDeadline(loadDataset(), 'The dataset');
    } catch {
      // The SRD is compiled into the bundle; only the optional layers are lost.
      resolved = { dataset: baseDataset, index: indexDataset(baseDataset), layers: [SRD_LAYER] };
    }

    set({
      ready: true,
      storageError,
      quarantined,
      dataset: resolved.dataset,
      index: resolved.index,
      layers: resolved.layers,
      characters,
      activeId: characters.find((c) => c.id === prefs.lastCharacterId)?.id ?? characters[0]?.id ?? null,
      prefs,
      screen: characters.length === 0 ? 'build' : prefs.lastScreen,
    });
  },

  setScreen(screen) {
    set({ screen });
    get().setPrefs({ lastScreen: screen });
  },

  setPrefs(patch) {
    const prefs = { ...get().prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },

  select(id) {
    set({ activeId: id });
    get().setPrefs({ lastCharacterId: id ?? undefined });
  },

  async create(partial) {
    const first = get().characters.length === 0;
    const c = newCharacter(partial);
    await db.putCharacter(c);
    set((s) => ({ characters: [c, ...s.characters], activeId: c.id }));
    get().setPrefs({ lastCharacterId: c.id });

    // Ask for persistent storage the moment there is something to lose.
    //
    // Timing is the whole trick. Chrome decides silently from engagement
    // signals, so asking before the user has done anything is a guaranteed
    // no; asking once they have built a character is when it says yes.
    // Safari refuses until the app is installed, which is why the settings
    // screen keeps an explanation and a second ask rather than treating this
    // one answer as final.
    if (first) {
      void db.requestPersistence().catch(() => {
        // A browser that will not even answer is one the export protects.
      });
    }
    return c;
  },

  update(mutate) {
    const { activeId, characters } = get();
    if (activeId === null) return;
    const current = characters.find((c) => c.id === activeId);
    if (!current) return;
    const next = { ...mutate(current), updatedAt: new Date().toISOString() };
    schedule(next);
    set({ characters: characters.map((c) => (c.id === next.id ? next : c)) });
  },

  async remove(id) {
    await db.deleteCharacter(id);
    set((s) => {
      const characters = s.characters.filter((c) => c.id !== id);
      return {
        characters,
        activeId: s.activeId === id ? (characters[0]?.id ?? null) : s.activeId,
      };
    });
  },

  /**
   * Take in characters from a file, a QR, or the clipboard.
   *
   * Two things happen here that used to happen nowhere. The counters are
   * synced against this build's derived maxima, which every other write path
   * has always done through `normalizeActive` and this one skipped - so a
   * sheet arriving from a newer device could carry an `hp.max` the engine
   * disagrees with, and `validatePlan` would read the stored one. And a
   * character already on this device with a *newer* edit is not written over:
   * it comes back as a conflict, with nothing written, for the user to decide.
   */
  async importCharacters(incoming, options = {}) {
    const { dataset, index } = get();
    const mode = options.mode ?? 'merge';

    const report: ImportReport = {
      imported: [],
      replaced: [],
      conflicts: [],
      warnings: [...(options.warnings ?? [])],
    };

    for (const raw of incoming) {
      const character = normalizeIncoming(raw, dataset, index);
      const local = get().characters.find((x) => x.id === character.id);
      const decision = decideImport(character, local, mode);

      if (decision === 'keep-local') {
        report.conflicts.push({ incoming: character, local: local! });
        continue;
      }

      await db.putCharacter(character);
      set((s) => ({
        characters: [character, ...s.characters.filter((x) => x.id !== character.id)],
        activeId: character.id,
      }));
      (decision === 'import' ? report.imported : report.replaced).push(character);
    }

    return report;
  },

  async resolveImport(conflict, choice) {
    if (choice === 'keep-mine') return null;

    const { dataset, index, characters } = get();
    const character =
      choice === 'keep-both'
        ? normalizeIncoming(duplicateFor(conflict.incoming, characters), dataset, index)
        : conflict.incoming;

    await db.putCharacter(character);
    set((s) => ({
      characters: [character, ...s.characters.filter((x) => x.id !== character.id)],
      activeId: character.id,
    }));
    return character;
  },

  pushLog(entry) {
    set((s) => ({
      log: [
        { ...entry, id: crypto.randomUUID(), at: new Date().toISOString() },
        ...s.log,
      ].slice(0, LOG_LIMIT),
    }));
  },

  clearLog() {
    set({ log: [] });
  },

  setOpenCard(card) {
    set({ openCard: card });
  },

  async reloadDataset() {
    const resolved = await loadDataset();
    set({ dataset: resolved.dataset, index: resolved.index, layers: resolved.layers });
  },
}));

export const flushPending = flush;

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const useActive = (): Character | null => {
  const id = useApp((s) => s.activeId);
  const characters = useApp((s) => s.characters);
  return characters.find((c) => c.id === id) ?? null;
};

/** Derived stats for the active character, or null when there is none. */
export const useStats = (): DerivedStats | null => {
  const character = useActive();
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  return character ? deriveStats(character, dataset, index) : null;
};

/**
 * Bring an arriving character into agreement with this build's arithmetic.
 *
 * Every other write path goes through `normalizeActive`; the import path never
 * did, which is P0-7. What it does *not* do is the interesting half: when this
 * build cannot resolve the character's class or their armour, the maxima
 * `deriveStats` would produce are fallbacks - `startingHitPoints ?? 6` for a
 * missing class, and no armour slots at all for a missing armour - and
 * clamping against a fallback would throw away the numbers the sheet arrived
 * with. A ref this build cannot name today may well resolve after the next
 * update, so the record is left exactly as it came instead.
 */
function normalizeIncoming(c: Character, dataset: Dataset, index: DatasetIndex): Character {
  const classKnown = index.classes.has(c.classRef);
  const armorKnown = c.activeArmor === null || index.armors.has(c.activeArmor);
  if (!classKnown || !armorKnown) return c;
  return syncCounters(c, deriveStats(c, dataset, index));
}

/** Re-clamp the counters after a change to a maximum, then persist. */
export function normalizeActive(): void {
  const { dataset, index } = useApp.getState();
  useApp.getState().update((c) => syncCounters(c, deriveStats(c, dataset, index)));
}
