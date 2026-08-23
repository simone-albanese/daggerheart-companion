/**
 * What is actually in a character's dice pools right now.
 *
 * A SIBLING OF `heldDice.ts` AND NOT A REPLACEMENT FOR IT. That file is a tray:
 * a die somebody handed you, of a size you picked by hand, which the app rolls
 * when you arm it and knows nothing else about. This one is an inventory: it
 * knows the pool a die belongs to, and it can hold a die's FACE - because a
 * Seraph's Prayer Dice are rolled at the start of the session and sit on the
 * sheet showing what they came up, and you then spend a die whose number you
 * already know. The two coexist on purpose; `engine/dicePools.ts` says why.
 *
 * SESSION STATE, exactly like the tray, and for the same reasons: it lives in
 * localStorage rather than in the character record, it has no transfer codec,
 * it does not travel with an export, and losing it costs one scene rather than
 * one campaign. Keyed by character id, so two characters on one device do not
 * share a Prayer Die.
 *
 * A die is `{ id, face }`, and `face` is null when it has not been rolled yet.
 * That one field is the whole difference between the two kinds of pool: Rally
 * and Slayer sit at null until they are spent, Prayer is filled in the moment
 * it is granted. Both roads to a face are the player's to choose - the app
 * rolls it, or they type what their own dice showed.
 */
import { create } from 'zustand';

export interface PoolDie {
  id: string;
  /** The face it is showing, or null while it is still unrolled. */
  face: number | null;
}

/** Pools by id (`prayer`, `rally`, `slayer`), for one character. */
export type PoolsOfCharacter = Record<string, PoolDie[]>;

/**
 * A ceiling under every pool's own cap, so a corrupt record cannot put a
 * thousand dice in a row that has to be drawn. No feature in the SRD grants
 * anything close: the largest is a Seraph's Spellcast trait.
 */
export const MAX_IN_POOL = 12;

interface PoolState {
  byCharacter: Record<string, PoolsOfCharacter>;
  /** Replace a pool outright - what rolling or clearing does. */
  set: (characterId: string, pool: string, dice: PoolDie[]) => void;
  /** Add one blank die, for the pools you bank into. */
  bank: (characterId: string, pool: string, cap: number) => void;
  /** Write a face onto one die: the app's roll, or a number the player typed. */
  face: (characterId: string, pool: string, id: string, face: number | null) => void;
  /** Take one die out - it has been spent. */
  spend: (characterId: string, pool: string, id: string) => void;
  /** Empty one pool. */
  clear: (characterId: string, pool: string) => void;
  /** Empty every pool this character has: the end of a session. */
  clearAll: (characterId: string) => void;
}

const KEY = 'dhc.pools.v1';

const NONE: PoolDie[] = [];
const NO_POOLS: PoolsOfCharacter = {};

/** A face has to be a whole number on a real die, or it is not a reading. */
const cleanFace = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 12 ? v : null;

function load(): Record<string, PoolsOfCharacter> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, PoolsOfCharacter> = {};
    for (const [characterId, pools] of Object.entries(stored)) {
      if (pools === null || typeof pools !== 'object') continue;
      const kept: PoolsOfCharacter = {};
      for (const [pool, dice] of Object.entries(pools as Record<string, unknown>)) {
        if (!Array.isArray(dice)) continue;
        const clean = (dice as PoolDie[])
          .filter((d) => d !== null && typeof d?.id === 'string')
          .slice(0, MAX_IN_POOL)
          .map((d) => ({ id: d.id, face: cleanFace(d.face) }));
        if (clean.length > 0) kept[pool] = clean;
      }
      if (Object.keys(kept).length > 0) out[characterId] = kept;
    }
    return out;
  } catch {
    return {};
  }
}

function save(byCharacter: Record<string, PoolsOfCharacter>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(byCharacter));
  } catch {
    // Private mode or quota. The pools stay live in memory either way.
  }
}

export const usePools = create<PoolState>((setState, get) => {
  /** Every mutation goes through here, so nothing can forget to persist. */
  const commit = (byCharacter: Record<string, PoolsOfCharacter>): void => {
    setState({ byCharacter });
    save(byCharacter);
  };

  const write = (characterId: string, pool: string, dice: PoolDie[]): void => {
    const mine = get().byCharacter[characterId] ?? NO_POOLS;
    commit({
      ...get().byCharacter,
      [characterId]: { ...mine, [pool]: dice.slice(0, MAX_IN_POOL) },
    });
  };

  return {
    byCharacter: load(),

    set: write,

    bank(characterId, pool, cap) {
      const held = get().byCharacter[characterId]?.[pool] ?? NONE;
      if (held.length >= Math.min(cap, MAX_IN_POOL)) return;
      write(characterId, pool, [...held, { id: crypto.randomUUID(), face: null }]);
    },

    face(characterId, pool, id, face) {
      const held = get().byCharacter[characterId]?.[pool] ?? NONE;
      write(
        characterId,
        pool,
        held.map((d) => (d.id === id ? { ...d, face } : d)),
      );
    },

    spend(characterId, pool, id) {
      const held = get().byCharacter[characterId]?.[pool] ?? NONE;
      write(
        characterId,
        pool,
        held.filter((d) => d.id !== id),
      );
    },

    clear(characterId, pool) {
      write(characterId, pool, []);
    },

    clearAll(characterId) {
      const { [characterId]: _gone, ...rest } = get().byCharacter;
      commit(rest);
    },
  };
});

/** One pool for one character, or an empty one when there is neither. */
export const usePool = (characterId: string | null, pool: string): PoolDie[] =>
  usePools((s) => (characterId === null ? NONE : (s.byCharacter[characterId]?.[pool] ?? NONE)));
