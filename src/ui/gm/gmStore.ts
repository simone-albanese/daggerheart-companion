/**
 * The GM's own state, and its own persistence.
 *
 * A scene is not a character. It has no transfer codec, no registry of stable
 * ids, and losing it costs one fight rather than one campaign - so it lives in
 * localStorage, written synchronously on every change, and never touches the
 * character store. The one thing that must survive is the obvious one: a GM
 * who reloads mid-fight keeps the fight.
 *
 * The roster stores refs, never copies of adversaries, for the same reason the
 * character format does: reimporting the dataset must not rewrite saved state.
 *
 * The party board is the one thing here that holds whole records, because a
 * player character is not dataset content and there is nothing to point a ref
 * at. It is still the GM's own notebook: importing a PC onto the board never
 * touches the character store, and this file never imports it.
 */
import { create } from 'zustand';
import type { Adversary, Character, Ref, Tier } from '../../../shared/types.ts';
import {
  MAX_FEAR,
  makeCombatant,
  NO_ADJUSTMENTS,
  tickCountdown,
  type Countdown,
  type CountdownKind,
  type EncounterAdjustments,
  type SceneCombatant,
} from '../../engine/encounter.ts';
import {
  tracksFromSheet,
  upsertMember,
  type PartyMember,
  type PartySource,
  type PartyTracks,
} from './party.ts';

export type GmRegion = 'encounter' | 'scene' | 'party' | 'bestiary' | 'countdowns';

export interface RosterEntry {
  ref: Ref;
  /** For Minions this counts *groups*, each the size of the party. */
  count: number;
}

/** Which sheets landed on the board, and which ones were already on it. */
export interface PartyImportSummary {
  added: string[];
  updated: string[];
}

export interface GmState {
  region: GmRegion;
  partyTier: Tier;
  roster: RosterEntry[];
  adjustments: EncounterAdjustments;
  combatants: SceneCombatant[];
  environmentRef: Ref | null;
  fear: number;
  countdowns: Countdown[];
  party: PartyMember[];

  setRegion: (region: GmRegion) => void;
  setPartyTier: (tier: Tier) => void;

  addToRoster: (ref: Ref) => void;
  setRosterCount: (ref: Ref, count: number) => void;
  clearRoster: () => void;
  toggleAdjustment: (key: keyof EncounterAdjustments) => void;

  /** Put `times` copies of an adversary into the live scene. */
  spawn: (adversary: Adversary, partySize: number, times?: number) => void;
  patchCombatant: (id: string, patch: Partial<SceneCombatant>) => void;
  removeCombatant: (id: string) => void;
  clearScene: () => void;

  setEnvironment: (ref: Ref | null) => void;

  setFear: (value: number) => void;
  nudgeFear: (delta: number) => void;

  addCountdown: (name: string, kind: CountdownKind, start: number) => void;
  advanceCountdown: (id: string, delta: number) => void;
  resetCountdown: (id: string) => void;
  removeCountdown: (id: string) => void;

  /** Put sheets on the party board. Never writes to the character store. */
  importParty: (sheets: Character[], source: PartySource) => PartyImportSummary;
  markPartyTracks: (id: string, patch: Partial<PartyTracks>) => void;
  /** Put a row's tracks back to the numbers that arrived with the sheet. */
  resetPartyTracks: (id: string) => void;
  removePartyMember: (id: string) => void;
}

const KEY = 'dhc.gm.v1';

/** Everything above the actions - the part that is written to disk. */
type Persisted = Pick<
  GmState,
  | 'region'
  | 'partyTier'
  | 'roster'
  | 'adjustments'
  | 'combatants'
  | 'environmentRef'
  | 'fear'
  | 'countdowns'
  | 'party'
>;

const EMPTY: Persisted = {
  region: 'encounter',
  partyTier: 1,
  roster: [],
  adjustments: NO_ADJUSTMENTS,
  combatants: [],
  environmentRef: null,
  fear: 0,
  countdowns: [],
  party: [],
};

function load(): Persisted {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return EMPTY;
    const stored = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...EMPTY,
      ...stored,
      // A hand-edited or half-written record must not brick the screen.
      fear: clampFear(Number(stored.fear ?? 0)),
      roster: Array.isArray(stored.roster) ? stored.roster : [],
      combatants: Array.isArray(stored.combatants) ? stored.combatants : [],
      countdowns: Array.isArray(stored.countdowns) ? stored.countdowns : [],
      party: Array.isArray(stored.party) ? stored.party.flatMap(readMember) : [],
    };
  } catch {
    return EMPTY;
  }
}

function save(state: Persisted): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        region: state.region,
        partyTier: state.partyTier,
        roster: state.roster,
        adjustments: state.adjustments,
        combatants: state.combatants,
        environmentRef: state.environmentRef,
        fear: state.fear,
        countdowns: state.countdowns,
        party: state.party,
      } satisfies Persisted),
    );
  } catch {
    // Private mode or quota. The scene stays live in memory either way.
  }
}

function clampFear(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_FEAR, Math.round(n))) : 0;
}

/**
 * A board row, or nothing. A row without a sheet has no numbers to derive and
 * would take the whole screen down on first render, which is a high price for
 * one half-written record; missing tracks are merely re-read from the sheet.
 */
function readMember(value: unknown): PartyMember[] {
  const m = value as PartyMember | null;
  if (m === null || typeof m !== 'object') return [];
  if (typeof m.id !== 'string' || typeof m.sheet?.name !== 'string') return [];
  return [{ ...m, tracks: m.tracks ?? tracksFromSheet(m.sheet) }];
}

export const useGm = create<GmState>((set, get) => {
  /** Every mutation goes through here, so nothing can forget to persist. */
  const commit = (patch: Partial<Persisted>): void => {
    set(patch);
    save(get());
  };

  return {
    ...load(),

    setRegion: (region) => commit({ region }),
    setPartyTier: (partyTier) => commit({ partyTier }),

    addToRoster(ref) {
      const roster = get().roster;
      const existing = roster.find((e) => e.ref === ref);
      commit({
        roster: existing
          ? roster.map((e) => (e.ref === ref ? { ...e, count: e.count + 1 } : e))
          : [...roster, { ref, count: 1 }],
      });
    },

    setRosterCount(ref, count) {
      commit({
        roster:
          count <= 0
            ? get().roster.filter((e) => e.ref !== ref)
            : get().roster.map((e) => (e.ref === ref ? { ...e, count } : e)),
      });
    },

    clearRoster: () => commit({ roster: [] }),

    toggleAdjustment(key) {
      const adjustments = get().adjustments;
      commit({ adjustments: { ...adjustments, [key]: !adjustments[key] } });
    },

    spawn(adversary, partySize, times = 1) {
      const combatants = [...get().combatants];
      // makeCombatant derives the id from an index; find free ones so a second
      // Acid Burrower cannot collide with the first.
      let index = 0;
      for (let n = 0; n < times; n += 1) {
        while (combatants.some((c) => c.id === `${adversary.id}-${index}`)) index += 1;
        combatants.push(makeCombatant(adversary, index, partySize));
        index += 1;
      }
      commit({ combatants });
    },

    patchCombatant(id, patch) {
      commit({
        combatants: get().combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      });
    },

    removeCombatant: (id) => commit({ combatants: get().combatants.filter((c) => c.id !== id) }),
    clearScene: () => commit({ combatants: [] }),
    setEnvironment: (environmentRef) => commit({ environmentRef }),

    setFear: (value) => commit({ fear: clampFear(value) }),
    nudgeFear: (delta) => commit({ fear: clampFear(get().fear + delta) }),

    addCountdown(name, kind, start) {
      const value = Math.max(1, Math.round(start));
      commit({
        countdowns: [
          ...get().countdowns,
          { id: crypto.randomUUID(), name, kind, start: value, value, notes: '' },
        ],
      });
    },

    advanceCountdown(id, delta) {
      commit({
        countdowns: get().countdowns.map((c) => (c.id === id ? tickCountdown(c, delta) : c)),
      });
    },

    resetCountdown(id) {
      commit({
        countdowns: get().countdowns.map((c) => (c.id === id ? { ...c, value: c.start } : c)),
      });
    },

    removeCountdown: (id) => commit({ countdowns: get().countdowns.filter((c) => c.id !== id) }),

    importParty(sheets, source) {
      const at = new Date().toISOString();
      const summary: PartyImportSummary = { added: [], updated: [] };
      let party = get().party;
      for (const sheet of sheets) {
        const result = upsertMember(party, sheet, source, at);
        party = result.party;
        summary[result.outcome].push(sheet.name || 'Unnamed');
      }
      commit({ party });
      return summary;
    },

    markPartyTracks(id, patch) {
      const at = new Date().toISOString();
      commit({
        party: get().party.map((m) =>
          // `markedAt` is what lets the board stop calling these numbers the
          // player's, so it is stamped by the same write that changes them.
          m.id === id ? { ...m, tracks: { ...m.tracks, ...patch }, markedAt: at } : m,
        ),
      });
    },

    resetPartyTracks(id) {
      commit({
        party: get().party.map((m) =>
          m.id === id ? { ...m, tracks: tracksFromSheet(m.sheet), markedAt: null } : m,
        ),
      });
    },

    removePartyMember: (id) => commit({ party: get().party.filter((m) => m.id !== id) }),
  };
});
