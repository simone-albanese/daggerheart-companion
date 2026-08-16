/**
 * The GM's encounter budget.
 *
 * Start with (3 x PCs) + 2 Battle Points, apply the adjustments, then spend.
 * All five adjustments from the SRD are here, including the two that are easy
 * to forget: the damage-bump discount and the no-heavies rebate.
 */
import type {
  Adversary,
  AdversaryRole,
  Countdown,
  EncounterAdjustments,
  SceneCombatant,
  Tier,
} from '../../shared/types.ts';

/*
 * The shapes moved, the names did not.
 *
 * `Countdown`, `CountdownKind`, `SceneCombatant` and `EncounterAdjustments`
 * are now declared in `shared/types.ts`, because a campaign record stores all
 * four of them verbatim in IndexedDB and a persisted shape belongs beside
 * `Character` rather than inside the module that happens to do arithmetic on
 * it. Re-exported here so every import in the tree keeps reading the same.
 */
export type {
  Countdown,
  CountdownKind,
  EncounterAdjustments,
  SceneCombatant,
} from '../../shared/types.ts';

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

/*
 * `TIER_BENCHMARKS` was here, and is deleted rather than wired.
 *
 * It was `rules['adversary-stat-block-benchmarks']` typed into a `.ts` file -
 * the same sixteen cells that ship inside `data/srd-1.0.json`, transcribed. It
 * had already lost two of them on the way in: `thresholds: [7, 12]` re-worded
 * the SRD's `Major 7/Severe 12` and `attack: 1` dropped its `+`. A screen built
 * on it would have carried an `SRD 1.0 · P.73` stamp over text that was not the
 * dataset's, and the stamp would have become false outright the first time a
 * rules layer overrode that section.
 *
 * `src/ui/shared/srdReference.ts` reads the table itself now, and
 * `tests/ui/srdReference.test.ts` pins all sixteen values against the shipped
 * file - coverage the deleted test never had, because it only ever asked the
 * constant about its own shape.
 */

// ---------------------------------------------------------------------------
// Live scene state
// ---------------------------------------------------------------------------

/** Moved beside the shapes it bounds; the campaign reader clamps `fear` too. */
export { MAX_FEAR } from '../../shared/types.ts';

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
