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
import { loadPrefs, savePrefs, type Prefs } from './prefs.ts';

export type Screen = 'play' | 'cards' | 'build' | 'gm' | 'settings';

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
  importCharacter: (c: Character) => Promise<void>;

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
    let storageError: string | null = null;
    try {
      characters = await withDeadline(db.listCharacters(), 'This browser’s storage');
    } catch (error) {
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
    // The index, so a sheet that names a class is stored with that class's Hit
    // Point track rather than the six the engine falls back to when it cannot
    // look one up. The wizard hands over an already-synced sheet and never
    // notices; the next caller to arrive without one would have.
    const c = newCharacter(partial, get().index);
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

  async importCharacter(c) {
    await db.putCharacter(c);
    set((s) => ({
      characters: [c, ...s.characters.filter((x) => x.id !== c.id)],
      activeId: c.id,
    }));
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

/** Re-clamp the counters after a change to a maximum, then persist. */
export function normalizeActive(): void {
  const { dataset, index } = useApp.getState();
  useApp.getState().update((c) => syncCounters(c, deriveStats(c, dataset, index)));
}
