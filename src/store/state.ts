/**
 * Application state.
 *
 * One store, because the app is one cockpit: the Play screen, the card
 * browser and the GM tools all read the same character and the same dataset.
 * Writes go to IndexedDB on a short debounce - a tap on a counter must feel
 * instant, and a lost 400ms of typing is not worth a synchronous write.
 */
import { create } from 'zustand';
import type { Character, Counter, Dataset, DomainCard, Layer } from '../../shared/types.ts';
import {
  COUNTER_CEILINGS,
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

/**
 * Work that is on screen and not on the disk.
 *
 * Every mark, every point of Hope and every level-up is applied to the store
 * first and written on a 400 ms debounce, which is what makes a counter feel
 * instant. The cost of that is a window in which the two can disagree, and
 * until this existed the app never noticed: `flush` awaited its writes with no
 * catch, so a rejected `putCharacter` became an unhandled rejection that no
 * error boundary can see - `ScreenBoundary` is a render-phase boundary - while
 * the sheet kept showing every change as applied. Three hours later the tab
 * closes and the evening is gone.
 */
export interface WriteFailure {
  /** English, ready to render. */
  message: string;
  /** How many characters are unwritten right now. */
  count: number;
  kind: 'quota' | 'stale' | 'other';
}

interface AppState {
  ready: boolean;
  /** Set when storage would not answer. The app still runs, read-only. */
  storageError: string | null;
  /**
   * Set while a character on screen has failed to reach the disk.
   *
   * Deliberately not folded into `storageError`: that banner tells the user
   * nothing has been written in the meantime and it is safe to reload, which
   * is the opposite of the truth here.
   */
  writeError: WriteFailure | null;
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
 * Ask the browser to keep this origin's storage.
 *
 * Timing is the whole trick. Chrome decides silently from engagement signals,
 * so asking before the user has done anything is a guaranteed no; asking once
 * there is something to lose is when it says yes. Safari refuses until the app
 * is installed, which is why Settings keeps an explanation and a second ask
 * rather than treating one answer as final.
 *
 * `create()` used to be the only caller, gated on the library having been
 * empty - so a library that arrived by import was never asked about, and
 * because it was no longer empty, a later `create()` never asked either. The
 * import path is the one where the user has the most at stake.
 */
function askForPersistence(): void {
  void db.requestPersistence().catch(() => {
    // A browser that will not even answer is one the export protects.
  });
}

/**
 * Persist on a debounce, and always flush before the page can go away.
 * `pagehide` is the only lifecycle event iOS Safari reliably delivers.
 */
const pending = new Map<string, Character>();
/** Ids whose last write attempt failed and which are still not on the disk. */
const failing = new Set<string>();
/**
 * Ids being deleted right now. Nothing may write them back.
 *
 * `pending.delete(id)` on its own was not enough: a batch already in flight has
 * taken its copy out of `pending` before `remove` runs, so its `put` could
 * still land after the `delete` - and the retry below would then put it back a
 * second time. This is what both of those check.
 */
const removed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** The first error of the most recent failing batch, for the sentence. */
let lastCause: unknown = null;

/**
 * One batch at a time, in order.
 *
 * `flush` used to clear `pending` synchronously and then await the writes, so a
 * second `flush` while the first was in flight saw an empty map and resolved
 * *immediately* - before the first one's writes had landed. Anything awaiting a
 * flush to mean "the disk has it" was being told yes too early. Chaining every
 * batch onto one queue is what makes that promise true, and it is what lets
 * `remove` put a delete strictly behind the write it is racing.
 */
let queue: Promise<void> = Promise.resolve();

function flush(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  queue = queue.then(writeBatch, writeBatch);
  return queue;
}

async function writeBatch(): Promise<void> {
  const batch = [...pending.values()].filter((c) => !removed.has(c.id));
  pending.clear();
  if (batch.length === 0) return;

  /*
   * Each write is caught on its own, so one refusal cannot take the rest of
   * the batch with it, and the batch is not lost on the way past the failure:
   * the old code cleared `pending` before the await, so a rejection threw away
   * the only record that those changes still needed writing.
   */
  const failures: Character[] = [];
  await Promise.all(
    batch.map(async (c) => {
      try {
        await db.putCharacter(c);
        failing.delete(c.id);
      } catch (error) {
        failures.push(c);
        lastCause = error;
      }
    }),
  );

  for (const c of failures) {
    failing.add(c.id);
    // Never over a newer edit the user made while the write was in flight, and
    // never over a character they deleted in that window.
    if (!removed.has(c.id) && !pending.has(c.id)) pending.set(c.id, c);
  }

  publishWriteError();
}

/**
 * Say what is unwritten, or take the sentence away.
 *
 * Only when *nothing* is outstanding, which is stricter than "this batch
 * succeeded": a successful write of one character while another is still
 * failing would otherwise clear a warning that is still true.
 */
function publishWriteError(): void {
  if (failing.size === 0) lastCause = null;
  const next = failing.size === 0 ? null : describeWriteFailure(lastCause, failing.size);
  if (next !== null || useApp.getState().writeError !== null) {
    useApp.setState({ writeError: next });
  }
}

/**
 * An error and whatever it wraps.
 *
 * A refused IndexedDB write does not always arrive as the browser's own error:
 * a transaction that aborts carries the request's error underneath. Anything
 * this cannot see, the sentence below does not claim.
 */
function chain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== null && current !== undefined; depth += 1) {
    seen.push(current);
    current = current instanceof Error ? current.cause : null;
  }
  return seen;
}

const named = (error: unknown, name: string): boolean =>
  chain(error).some((e) => e instanceof Error && e.name === name);

function describeWriteFailure(cause: unknown, count: number): WriteFailure {
  const changes = `${String(count)} change${count === 1 ? '' : 's'}`;
  // The one sentence that has to be in every version of this: what is at stake
  // is the tab, not the device.
  const onlyHere = 'What is on screen is only in this tab, so closing it now loses it.';

  // A build refusing to write over a newer record already says exactly why, in
  // its own words, and inventing a second sentence for it would be worse.
  if (named(cause, 'StaleBuildError') && cause instanceof Error) {
    return { kind: 'stale', count, message: `${cause.message} ${onlyHere}` };
  }
  if (named(cause, 'QuotaExceededError')) {
    return {
      kind: 'quota',
      count,
      message: `This device is out of space, so the last ${changes} could not be saved. ${onlyHere} Save a copy somewhere else, then free some space.`,
    };
  }
  const what = cause instanceof Error && cause.name !== '' ? ` (${cause.name})` : '';
  return {
    kind: 'other',
    count,
    message: `The last ${changes} could not be written to this device’s storage${what}. ${onlyHere} Save a copy somewhere else.`,
  };
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
  writeError: null,
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
       *
       * Through the debounce rather than a bare `void db.putCharacter(c)`,
       * which is where these used to go: a rejection there was swallowed by a
       * comment saying it was the same failure P0-3 is about. It is, so it
       * takes the same route as every other write and reaches the same
       * sentence on screen.
       */
      for (const c of library.repaired) schedule(c);
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
    if (first) askForPersistence();
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
    /*
     * Before the delete, not after: a debounced write still holding this
     * character would put it straight back a few hundred milliseconds later,
     * and the user would watch a character they deleted return.
     *
     * Dropping it from `pending` closes only the first of the two windows. The
     * second is a batch that has *already* taken its copy and is awaiting the
     * put - so the delete waits for the queue to drain, which puts it strictly
     * behind that write, and `removed` stops the retry path re-queueing it in
     * the meantime.
     */
    pending.delete(id);
    failing.delete(id);
    removed.add(id);
    publishWriteError();
    try {
      await flush();
      await db.deleteCharacter(id);
    } finally {
      // Cleared either way, or a delete that failed would block every later
      // write of that id for the life of the tab - and a re-import of the same
      // character would be silently dropped.
      removed.delete(id);
    }
    set((s) => {
      const characters = s.characters.filter((c) => c.id !== id);
      return {
        characters,
        activeId: s.activeId === id ? (characters[0]?.id ?? null) : s.activeId,
      };
    });

    /*
     * The Play screen's disclosure states are keyed by character id, and
     * nothing else would ever collect them: a library churned through import
     * and delete would leave one entry per section per character that ever
     * existed, in a localStorage blob that is read synchronously on every
     * launch. Dropped here, where the id stops meaning anything.
     */
    const prefix = `${id}:`;
    const sections = get().prefs.playSections;
    if (Object.keys(sections).some((k) => k.startsWith(prefix))) {
      get().setPrefs({
        playSections: Object.fromEntries(
          Object.entries(sections).filter(([k]) => !k.startsWith(prefix)),
        ),
      });
    }
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

      const wasEmpty = get().characters.length === 0;
      await db.putCharacter(character);
      set((s) => ({
        characters: [character, ...s.characters.filter((x) => x.id !== character.id)],
        activeId: character.id,
      }));
      // The person who has just restored a library onto a fresh origin has the
      // most at stake and was the one path that never asked.
      if (wasEmpty) askForPersistence();
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
 * update, so the record keeps the maxima it came with instead.
 *
 * Keeps them, and not whatever they say: `boundCounters` runs first and runs on
 * both branches. Its ceilings are the rules', which no dataset can move, so it
 * is not the clamp the paragraph above refuses to do - see its own note.
 */
function normalizeIncoming(c: Character, dataset: Dataset, index: DatasetIndex): Character {
  const bounded = boundCounters(c);
  const classKnown = index.classes.has(bounded.classRef);
  const armorKnown = bounded.activeArmor === null || index.armors.has(bounded.activeArmor);
  if (!classKnown || !armorKnown) return bounded;
  return syncCounters(bounded, deriveStats(bounded, dataset, index));
}

/** A whole number in `[0, ceiling]`. A NaN or an Infinity is zero, not the top. */
const inRange = (n: number, ceiling: number): number =>
  Number.isFinite(n) ? Math.min(ceiling, Math.max(0, Math.trunc(n))) : 0;

const bound = (counter: Counter, ceiling: number): Counter => {
  const max = inRange(counter.max, ceiling);
  return { marked: Math.min(inRange(counter.marked, ceiling), max), max };
};

/**
 * Hold an arriving character's counters inside the ceilings the rules set.
 *
 * This runs on *every* import, including the one `normalizeIncoming` above
 * deliberately hands back untouched, and the two are doing different jobs
 * rather than the same job twice. `syncCounters` reconciles a sheet against the
 * maxima *this build derives for it*, which is why it is skipped when a ref
 * will not resolve: a fallback of six Hit Points is a guess, and clamping a
 * real seven against a guess destroys it. `COUNTER_CEILINGS` is not a guess and
 * cannot become one - twelve Hit Points is the top of the advancement table,
 * not the top of what this device happens to know about, so no update and no
 * layer can ever make the number this throws away turn out to have been right.
 * The P0-7 rule is "do not clamp against a fallback", and this clamps against
 * nothing of the kind.
 *
 * Worth being concrete about what it is for, because "a hostile payload" is
 * easy to wave away in an app with no server. `hp.max` is not a display detail:
 * `Track.tsx` draws one DOM node per point of it. A sheet declaring 2^20 is a
 * tab that stops responding on the Play screen, on a device whose only copy of
 * those characters is in that tab's IndexedDB - and the sheet reaches the store
 * from a file as well as from a QR, so bounding the codec alone would leave the
 * `.dhchar` and `.dhbackup` paths, which never touch it, wide open.
 *
 * The companion's Stress is here for a reason of its own: `syncCounters` has
 * never touched it, so on the happy path - class resolved, armour resolved -
 * it was the one track that reached the screen with whatever number arrived.
 */
function boundCounters(c: Character): Character {
  const next: Character = {
    ...c,
    hp: bound(c.hp, COUNTER_CEILINGS.hp),
    stress: bound(c.stress, COUNTER_CEILINGS.stress),
    hope: bound(c.hope, COUNTER_CEILINGS.hope),
    armorSlots: bound(c.armorSlots, COUNTER_CEILINGS.armorSlots),
  };
  if (c.companion !== null) {
    next.companion = {
      ...c.companion,
      stress: bound(c.companion.stress, COUNTER_CEILINGS.companionStress),
    };
  }
  return next;
}

/** Re-clamp the counters after a change to a maximum, then persist. */
export function normalizeActive(): void {
  const { dataset, index } = useApp.getState();
  useApp.getState().update((c) => syncCounters(c, deriveStats(c, dataset, index)));
}
