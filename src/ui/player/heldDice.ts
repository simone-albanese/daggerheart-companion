/**
 * The dice a player is holding, and nothing at all about where they came from.
 *
 * A Rally Die, a Prayer Die, a Slayer Die, an Unstoppable Die, the d6 an ally
 * hands you for Help an Ally: a dozen features grant a die, in sizes and
 * numbers that depend on subclass, on level, and on what happened this scene.
 * Knowing which feature gives which die is reading the feature text, which the
 * app shows and the player applies - so this is a tray, not an inventory. The
 * player puts a die in when they are given one and takes it out when it is
 * spent, and the app only ever rolls what is in the tray.
 *
 * It is session state, not character state, which is why it lives here in
 * localStorage beside the GM's scene rather than in the character record: it
 * has no transfer codec, it does not travel with an export, and losing it costs
 * one scene rather than one campaign. Keyed by character id all the same -
 * two characters on one device do not share a Rally Die.
 */
import { create } from 'zustand';
import { DIE_SIZES, type DieSize } from '../../engine/dice.ts';

// Re-exported rather than redeclared: the tray offers exactly the sizes the
// rules use, and `engine/dice.ts` is where that list lives now.
export { DIE_SIZES, type DieSize };

export interface HeldDie {
  id: string;
  sides: DieSize;
}

/**
 * A ceiling, because the tray shares one scrolling row with every other roll
 * control. No feature in the SRD hands out anything close to this many at once.
 */
export const MAX_HELD = 12;

interface HeldDiceState {
  byCharacter: Record<string, HeldDie[]>;
  add: (characterId: string, sides: DieSize) => void;
  discard: (characterId: string, id: string) => void;
  clear: (characterId: string) => void;
}

const KEY = 'dhc.dice.v1';

/** One frozen empty array: a fresh `[]` per read would spin the subscription. */
const NONE: HeldDie[] = [];

const isSize = (n: unknown): n is DieSize => (DIE_SIZES as readonly unknown[]).includes(n);

function load(): Record<string, HeldDie[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, HeldDie[]> = {};
    for (const [id, dice] of Object.entries(stored)) {
      if (!Array.isArray(dice)) continue;
      // A hand-edited or half-written record must not put a d7 in the pool.
      const clean = (dice as HeldDie[])
        .filter((d) => d !== null && typeof d?.id === 'string' && isSize(d.sides))
        .slice(0, MAX_HELD)
        .map((d) => ({ id: d.id, sides: d.sides }));
      if (clean.length > 0) out[id] = clean;
    }
    return out;
  } catch {
    return {};
  }
}

function save(byCharacter: Record<string, HeldDie[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(byCharacter));
  } catch {
    // Private mode or quota. The tray stays live in memory either way.
  }
}

export const useHeldDice = create<HeldDiceState>((set, get) => {
  /** Every mutation goes through here, so nothing can forget to persist. */
  const commit = (byCharacter: Record<string, HeldDie[]>): void => {
    set({ byCharacter });
    save(byCharacter);
  };

  return {
    byCharacter: load(),

    add(characterId, sides) {
      const held = get().byCharacter[characterId] ?? NONE;
      if (held.length >= MAX_HELD) return;
      commit({
        ...get().byCharacter,
        [characterId]: [...held, { id: crypto.randomUUID(), sides }],
      });
    },

    discard(characterId, id) {
      const held = get().byCharacter[characterId] ?? NONE;
      commit({ ...get().byCharacter, [characterId]: held.filter((d) => d.id !== id) });
    },

    clear(characterId) {
      const { [characterId]: _gone, ...rest } = get().byCharacter;
      commit(rest);
    },
  };
});

/** The tray for one character, or an empty one when there is no character. */
export const useHeldFor = (characterId: string | null): HeldDie[] =>
  useHeldDice((s) => (characterId === null ? NONE : (s.byCharacter[characterId] ?? NONE)));
