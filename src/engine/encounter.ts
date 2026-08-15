/**
 * The GM's encounter budget.
 *
 * Start with (3 x PCs) + 2 Battle Points, apply the adjustments, then spend.
 * All five adjustments from the SRD are here, including the two that are easy
 * to forget: the damage-bump discount and the no-heavies rebate.
 */
import type { Adversary, AdversaryRole, Tier } from '../../shared/types.ts';

export const ROLE_COST: Record<AdversaryRole, number> = {
  Minion: 1, // per group of Minions equal to the party size
  Social: 1,
  Support: 1,
  Horde: 2,
  Ranged: 2,
  Skulk: 2,
  Standard: 2,
  Leader: 3,
  Bruiser: 4,
  Solo: 5,
};

export interface EncounterAdjustments {
  /** -1 for an easier or shorter fight. */
  easier: boolean;
  /** +2 for a harder or longer fight. */
  harder: boolean;
  /** -2 if you add +1d4 (or a static +2) to all adversaries' damage rolls. */
  damageBump: boolean;
}

export const NO_ADJUSTMENTS: EncounterAdjustments = {
  easier: false,
  harder: false,
  damageBump: false,
};

export interface EncounterEntry {
  adversary: Adversary;
  /** For Minions this is the number of *groups*, each the size of the party. */
  count: number;
}

export interface AdjustmentLine {
  label: string;
  points: number;
  /** Automatic adjustments are derived from the roster, not chosen. */
  automatic: boolean;
  active: boolean;
}

export interface EncounterBudget {
  partySize: number;
  base: number;
  adjustments: AdjustmentLine[];
  budget: number;
  spent: number;
  remaining: number;
  /** Cost breakdown per entry, in roster order. */
  costs: number[];
}

const HEAVY_ROLES = new Set<AdversaryRole>(['Bruiser', 'Horde', 'Leader', 'Solo']);

export function entryCost(entry: EncounterEntry): number {
  return ROLE_COST[entry.adversary.role] * Math.max(1, entry.count);
}

export function computeBudget(
  partySize: number,
  partyTier: Tier,
  roster: EncounterEntry[],
  adjustments: EncounterAdjustments = NO_ADJUSTMENTS,
): EncounterBudget {
  const base = 3 * Math.max(1, partySize) + 2;

  const soloCount = roster
    .filter((e) => e.adversary.role === 'Solo')
    .reduce((n, e) => n + Math.max(1, e.count), 0);
  const hasLowerTier = roster.some((e) => e.adversary.tier < partyTier);
  const hasHeavy = roster.some((e) => HEAVY_ROLES.has(e.adversary.role));

  const lines: AdjustmentLine[] = [
    { label: 'Easier or shorter fight', points: -1, automatic: false, active: adjustments.easier },
    {
      label: '2 or more Solo adversaries',
      points: -2,
      automatic: true,
      active: soloCount >= 2,
    },
    {
      label: '+1d4 (or +2) to all adversary damage rolls',
      points: -2,
      automatic: false,
      active: adjustments.damageBump,
    },
    {
      label: 'An adversary from a lower tier',
      points: 1,
      automatic: true,
      active: hasLowerTier,
    },
    {
      label: 'No Bruisers, Hordes, Leaders or Solos',
      points: 1,
      automatic: true,
      active: roster.length > 0 && !hasHeavy,
    },
    { label: 'Harder or longer fight', points: 2, automatic: false, active: adjustments.harder },
  ];

  const budget = lines.reduce((n, l) => n + (l.active ? l.points : 0), base);
  const costs = roster.map(entryCost);
  const spent = costs.reduce((a, b) => a + b, 0);

  return { partySize, base, adjustments: lines, budget, spent, remaining: budget - spent, costs };
}

/** Adversary benchmark stats per tier, for improvising or re-tiering. */
export const TIER_BENCHMARKS: Record<
  Tier,
  { attack: number; damage: string; difficulty: number; thresholds: [number, number] }
> = {
  1: { attack: 1, damage: '1d6+2 to 1d12+4', difficulty: 11, thresholds: [7, 12] },
  2: { attack: 2, damage: '2d6+3 to 2d12+4', difficulty: 14, thresholds: [10, 20] },
  3: { attack: 3, damage: '3d8+3 to 3d12+5', difficulty: 17, thresholds: [20, 32] },
  4: { attack: 4, damage: '4d8+10 to 4d12+15', difficulty: 20, thresholds: [25, 45] },
};

// ---------------------------------------------------------------------------
// Live scene state
// ---------------------------------------------------------------------------

export const MAX_FEAR = 12;

export type CountdownKind = 'standard' | 'dynamic' | 'loop' | 'long-term';

export interface Countdown {
  id: string;
  name: string;
  kind: CountdownKind;
  start: number;
  value: number;
  notes: string;
}

/** Countdowns advance by hand: the app never infers when a trigger fired. */
export function tickCountdown(c: Countdown, delta: number): Countdown {
  const next = c.value + delta;
  if (c.kind === 'loop') {
    // A loop countdown resets to its starting value when it runs out.
    if (next <= 0) return { ...c, value: c.start };
    return { ...c, value: Math.min(c.start, next) };
  }
  return { ...c, value: Math.max(0, Math.min(c.start, next)) };
}

export interface SceneCombatant {
  id: string;
  adversaryRef: string;
  name: string;
  hp: { marked: number; max: number };
  stress: { marked: number; max: number };
  thresholds: [number, number] | null;
  difficulty: number;
  spotlighted: boolean;
  /** Minions in this group still standing. */
  minionsRemaining?: number;
  notes: string;
}

export function makeCombatant(a: Adversary, index: number, partySize: number): SceneCombatant {
  return {
    id: `${a.id}-${index}`,
    adversaryRef: a.id,
    name: a.name,
    hp: { marked: 0, max: a.hp },
    stress: { marked: 0, max: a.stress },
    thresholds: a.thresholds,
    difficulty: a.difficulty,
    spotlighted: false,
    ...(a.role === 'Minion' ? { minionsRemaining: partySize } : {}),
    notes: '',
  };
}
