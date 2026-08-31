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
      /*
       * NAMED, NOT QUOTED, and that is the whole of it.
       *
       * This read `'+1d4 (or +2) to all adversary damage rolls'` - a third
       * hand-typed copy of a sentence the SRD writes as "+1d4 (or a **static**
       * +2)", and one this module cannot keep in step because it has no rules
       * layer to read. When the two screens started quoting `damageBumpRule`
       * this line went from *drifted but consistent* to a flat contradiction:
       * the toggle said one version and the note eleven lines under it said
       * another, and a homebrew layer widened the gap to `+2d6 (or a static
       * +7)` against `+1d4 (or +2)`.
       *
       * An engine that computes points has no business transcribing prose. The
       * label names the switch; the screens quote the book.
       */
      label: 'Adversaries deal extra damage',
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
    /*
     * COPIED, and the copy is the whole of this line.
     *
     * `a` is the dataset's own adversary record - one object per adversary for
     * the whole device, shared by every campaign, every spawn and every scene
     * on it. This read `a.thresholds`, and `thresholds` is a mutable tuple, so
     * every combatant ever built from one adversary held a live handle on the
     * one array the bestiary draws from: two Acid Burrowers on the same board,
     * and every Burrower any campaign on this device spawns after them, all
     * pointing at it. A single `c.thresholds[0] = ...` anywhere would have
     * edited the book, for every campaign on the device, in a place no reader
     * would look.
     *
     * Nothing writes through that handle today, and nothing else was ever
     * standing behind that fact. There WAS one other deep copier: the schema-4
     * `runScene` copied `hp`, `stress` and `thresholds` on its way between the
     * board and a scene row - but it defined that copier inside itself and ran
     * it at its own two crossings, park and resume, so a GM who spawned a
     * Burrower and marked it never crossed it. That was the argument for
     * defending the alias HERE rather than there, and campaign schema 5 has
     * settled it: the fight lives on the scene row it is fought in, `runScene`
     * and its two crossings are deleted, and `spawn` pushes what this function
     * returns straight into a row's own list. There is now no copier anywhere
     * on the path. The defence belongs where the alias is made, and it is the
     * only one left.
     *
     * `Array.isArray`, not `=== null`, and the gap between the two is a crash.
     * Absent thresholds are real: counted in `data/srd-1.0.json`, 16 of the 129
     * adversaries have none, and they are exactly its 16 Minions - all 20 Solos
     * carry a tuple, which is the half `Adversary.thresholds` got wrong and
     * this comment copied forward before it was measured. But `null` is only
     * one of the two ways the field goes missing. An adversary that exists only
     * in an imported manual is assembled from the fields that manual
     * contributed, `contributedFields` contributes no null, and the merge
     * starts a record the SRD has never heard of from `{ id, provenance }`: a
     * manual Minion whose stat line said `None` arrives here with no
     * `thresholds` key at all. `undefined === null` is false, spreading
     * `undefined` throws, and a test for one exact absence is the wrong shape
     * of guard for a value that has two. Asking what the value IS answers both,
     * and it also settles the read in `Scene.tsx` that draws the threshold row
     * behind `!== null` and would have indexed `undefined` one screen later.
     * `keeps a null threshold null` and `spawns an adversary whose thresholds
     * key is missing entirely` are the two cases holding this branch down.
     */
    thresholds: Array.isArray(a.thresholds) ? [...a.thresholds] : null,
    difficulty: a.difficulty,
    spotlighted: false,
    ...(a.role === 'Minion' ? { minionsRemaining: partySize } : {}),
    notes: '',
  };
}
