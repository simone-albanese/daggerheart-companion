/**
 * Active conditions, per character, in localStorage.
 *
 * A condition is a marker, not a fact about the character. It lasts a scene,
 * it is set and cleared a dozen times a session, and losing it costs one fight
 * rather than one campaign - so it stays out of the character record, out of
 * the transfer codec and out of the QR, and lives here beside the GM's own
 * scene state, written synchronously on every change.
 *
 * Keyed by character id, because two people sharing a device are two rows.
 */
import { create } from 'zustand';

export type Standard = 'hidden' | 'restrained' | 'vulnerable';

export const STANDARD: Standard[] = ['hidden', 'restrained', 'vulnerable'];

/**
 * Two, and not more. Every class but the Sorcerer carries one persistent named
 * state at a time - Cloaked, Focus, No Mercy, Marked for Death, Hex - and a
 * strip that can grow without limit stops being glanceable, which is the only
 * thing it is for.
 *
 * "Eight of the nine" stood here, and the nine was SRD 1.0's class list. The
 * count itself was never the argument - `MAX_NAMED` follows from *one at a
 * time*, not from how many classes have one - but a denominator that is four
 * short of the shipped book is the kind of stale figure a reader trusts. The
 * partition behind it survives the change and is what is written now: read the
 * `classFeatures` of all thirteen and exactly one class, the Sorcerer, ends a
 * feature with nothing left standing on the sheet. Twelve today, eight of nine
 * then, and the same one left out both times.
 */
export const MAX_NAMED = 2;

export const MAX_LABEL = 22;

export interface NamedState {
  id: string;
  label: string;
  on: boolean;
}

export interface Conditions {
  hidden: boolean;
  restrained: boolean;
  /** Set by hand, on top of the Vulnerable that full Stress already derives. */
  vulnerable: boolean;
  named: NamedState[];
}

export const NO_CONDITIONS: Conditions = {
  hidden: false,
  restrained: false,
  vulnerable: false,
  named: [],
};

export const isEmpty = (c: Conditions): boolean =>
  !c.hidden && !c.restrained && !c.vulnerable && c.named.length === 0;

interface ConditionsState {
  byCharacter: Record<string, Conditions>;
  toggle: (characterId: string, which: Standard) => void;
  addNamed: (characterId: string, label: string) => void;
  renameNamed: (characterId: string, namedId: string, label: string) => void;
  toggleNamed: (characterId: string, namedId: string) => void;
  removeNamed: (characterId: string, namedId: string) => void;
  clear: (characterId: string) => void;
}

const KEY = 'dhc.conditions.v1';

/** A hand-edited or half-written record must not brick the Play screen. */
function sanitize(value: unknown): Conditions {
  const raw = (value ?? {}) as Partial<Conditions>;
  const named = Array.isArray(raw.named) ? raw.named : [];
  return {
    hidden: raw.hidden === true,
    restrained: raw.restrained === true,
    vulnerable: raw.vulnerable === true,
    named: named
      .filter((n): n is NamedState => typeof n === 'object' && n !== null)
      .slice(0, MAX_NAMED)
      .map((n, i) => ({
        id: typeof n.id === 'string' && n.id !== '' ? n.id : `named-${i}`,
        label: String(n.label ?? '').slice(0, MAX_LABEL),
        on: n.on !== false,
      }))
      .filter((n) => n.label.trim() !== ''),
  };
}

function load(): Record<string, Conditions> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return {};
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Conditions> = {};
    for (const [id, value] of Object.entries(stored ?? {})) out[id] = sanitize(value);
    return out;
  } catch {
    return {};
  }
}

/**
 * Dropping the empty rows on the way out is what keeps this bounded: a
 * character deleted six months ago leaves nothing behind, because clearing
 * their last chip already removed the row.
 */
export function prune(all: Record<string, Conditions>): Record<string, Conditions> {
  const out: Record<string, Conditions> = {};
  for (const [id, c] of Object.entries(all)) if (!isEmpty(c)) out[id] = c;
  return out;
}

function save(all: Record<string, Conditions>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prune(all)));
  } catch {
    // Private mode or quota. The chips stay live in memory either way.
  }
}

export const useConditions = create<ConditionsState>((set, get) => {
  /** Every mutation goes through here, so nothing can forget to persist. */
  const commit = (characterId: string, mutate: (c: Conditions) => Conditions): void => {
    const byCharacter = {
      ...get().byCharacter,
      [characterId]: mutate(get().byCharacter[characterId] ?? NO_CONDITIONS),
    };
    set({ byCharacter });
    save(byCharacter);
  };

  return {
    byCharacter: load(),

    toggle: (characterId, which) =>
      commit(characterId, (c) => ({ ...c, [which]: !c[which] })),

    addNamed(characterId, label) {
      const text = label.trim().slice(0, MAX_LABEL);
      if (text === '') return;
      commit(characterId, (c) =>
        c.named.length >= MAX_NAMED
          ? c
          : { ...c, named: [...c.named, { id: crypto.randomUUID(), label: text, on: true }] },
      );
    },

    renameNamed(characterId, namedId, label) {
      const text = label.slice(0, MAX_LABEL);
      commit(characterId, (c) => ({
        ...c,
        named: c.named.map((n) => (n.id === namedId ? { ...n, label: text } : n)),
      }));
    },

    toggleNamed: (characterId, namedId) =>
      commit(characterId, (c) => ({
        ...c,
        named: c.named.map((n) => (n.id === namedId ? { ...n, on: !n.on } : n)),
      })),

    removeNamed: (characterId, namedId) =>
      commit(characterId, (c) => ({ ...c, named: c.named.filter((n) => n.id !== namedId) })),

    /*
     * The one destructive call in this store, and the only one no other call
     * can walk back: every other mutation here is its own inverse, and this
     * one throws away a set of markers and two strings the player typed.
     * There is no undo anywhere in this app, so the confirmation is the whole
     * of the protection and it lives on the surface - `ConditionsDialog` arms
     * on the first tap and commits on a second one somewhere else, for reasons
     * that are about where the dialog is drawn and are written down there.
     * Nothing else calls this.
     */
    clear: (characterId) => commit(characterId, () => NO_CONDITIONS),
  };
});

/** The conditions of one character. Never null - an unknown id is simply empty. */
export const useConditionsFor = (characterId: string | null): Conditions =>
  useConditions((s) => (characterId === null ? NO_CONDITIONS : s.byCharacter[characterId]) ?? NO_CONDITIONS);
