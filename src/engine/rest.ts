/**
 * Rests and downtime moves.
 *
 * Each PC makes up to two downtime moves per rest, and may pick the same move
 * twice. The moves that clear a track are pure arithmetic, so the app rolls
 * and applies them; "Work on a Project" is narrative, so it only nudges a
 * countdown the GM already made.
 */
import type { Character } from '../../shared/types.ts';
import type { DerivedStats } from './character.ts';
import { cryptoRng, type Rng } from './dice.ts';

export type RestKind = 'short' | 'long';

export type DowntimeMoveId =
  | 'tend-to-wounds'
  | 'clear-stress'
  | 'repair-armor'
  | 'prepare'
  | 'tend-to-all-wounds'
  | 'clear-all-stress'
  | 'repair-all-armor'
  | 'prepare-long'
  | 'work-on-a-project';

export interface DowntimeMove {
  id: DowntimeMoveId;
  name: string;
  rest: RestKind;
  text: string;
  /** Whether the app can apply the effect, or only show it. */
  mechanical: boolean;
}

export const DOWNTIME_MOVES: DowntimeMove[] = [
  {
    id: 'tend-to-wounds',
    name: 'Tend to Wounds',
    rest: 'short',
    text: 'Clear 1d4+Tier Hit Points for yourself or an ally.',
    mechanical: true,
  },
  {
    id: 'clear-stress',
    name: 'Clear Stress',
    rest: 'short',
    text: 'Clear 1d4+Tier Stress.',
    mechanical: true,
  },
  {
    id: 'repair-armor',
    name: 'Repair Armor',
    rest: 'short',
    text: "Clear 1d4+Tier Armor Slots from your or an ally's armor.",
    mechanical: true,
  },
  {
    id: 'prepare',
    name: 'Prepare',
    rest: 'short',
    text: 'Describe how you prepare yourself for the path ahead, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.',
    mechanical: true,
  },
  {
    id: 'tend-to-all-wounds',
    name: 'Tend to All Wounds',
    rest: 'long',
    text: 'Clear all Hit Points for yourself or an ally.',
    mechanical: true,
  },
  {
    id: 'clear-all-stress',
    name: 'Clear All Stress',
    rest: 'long',
    text: 'Clear all Stress.',
    mechanical: true,
  },
  {
    id: 'repair-all-armor',
    name: 'Repair All Armor',
    rest: 'long',
    text: "Clear all Armor Slots from your or an ally's armor.",
    mechanical: true,
  },
  {
    id: 'prepare-long',
    name: 'Prepare',
    rest: 'long',
    text: "Describe how you prepare for the next day's adventure, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.",
    mechanical: true,
  },
  {
    id: 'work-on-a-project',
    name: 'Work on a Project',
    rest: 'long',
    text: 'With GM approval, pursue a long-term project. Assign it a countdown the first time, then advance it automatically or with an action roll (GM’s choice).',
    mechanical: false,
  },
];

export const movesFor = (rest: RestKind): DowntimeMove[] =>
  DOWNTIME_MOVES.filter((m) => m.rest === rest);

const MOVES_BY_ID = new Map(DOWNTIME_MOVES.map((m) => [m.id, m] as const));

export interface DowntimeChoice {
  move: DowntimeMoveId;
  /** Prepare with company grants 2 Hope instead of 1. */
  withParty?: boolean;
  /** Fixed 1d4, for a table rolling physical dice. */
  fixedRoll?: number;
}

export interface RestOutcome {
  character: Character;
  /** One human-readable line per applied move, for the log. */
  log: string[];
  /** Fear the GM gains: 1d4 on a short rest, 1d4 + PCs on a long rest. */
  gmFear: number;
}

/**
 * Apply a rest.
 *
 * `choices` is at most two moves. Card swaps between loadout and vault are
 * free during a rest, but that is a loadout operation and lives there.
 */
export function takeRest(
  c: Character,
  stats: DerivedStats,
  rest: RestKind,
  choices: DowntimeChoice[],
  options: { partySize?: number; fixedFear?: number } = {},
  rng: Rng = cryptoRng,
): RestOutcome {
  let next = { ...c };
  const log: string[] = [];

  for (const choice of choices.slice(0, 2)) {
    // The SRD prints a separate list of moves per rest, and the long-rest ones
    // clear a whole track. Applying "Clear All Stress" on a short rest would
    // quietly hand out the wrong rest's benefit, so it is refused and said out
    // loud - the caller is expected to be offering `movesFor(rest)`.
    const move = MOVES_BY_ID.get(choice.move);
    if (move === undefined || move.rest !== rest) {
      log.push(`${move?.name ?? choice.move} is not a ${rest} rest move - not applied`);
      continue;
    }

    const roll = () => choice.fixedRoll ?? rng(4);
    switch (choice.move) {
      case 'tend-to-wounds': {
        const die = roll();
        const amount = die + stats.tier;
        const cleared = Math.min(amount, next.hp.marked);
        next = { ...next, hp: { ...next.hp, marked: next.hp.marked - cleared } };
        log.push(`Tend to Wounds: cleared ${cleared} HP (d4 ${die} + tier ${stats.tier})`);
        break;
      }
      case 'clear-stress': {
        const die = roll();
        const amount = die + stats.tier;
        const cleared = Math.min(amount, next.stress.marked);
        next = { ...next, stress: { ...next.stress, marked: next.stress.marked - cleared } };
        log.push(`Clear Stress: cleared ${cleared} Stress (d4 ${die} + tier ${stats.tier})`);
        break;
      }
      case 'repair-armor': {
        const die = roll();
        const amount = die + stats.tier;
        const cleared = Math.min(amount, next.armorSlots.marked);
        next = {
          ...next,
          armorSlots: { ...next.armorSlots, marked: next.armorSlots.marked - cleared },
        };
        log.push(`Repair Armor: cleared ${cleared} Armor Slots (d4 ${die} + tier ${stats.tier})`);
        break;
      }
      case 'tend-to-all-wounds': {
        log.push(`Tend to All Wounds: cleared ${next.hp.marked} HP`);
        next = { ...next, hp: { ...next.hp, marked: 0 } };
        break;
      }
      case 'clear-all-stress': {
        log.push(`Clear All Stress: cleared ${next.stress.marked} Stress`);
        next = { ...next, stress: { ...next.stress, marked: 0 } };
        break;
      }
      case 'repair-all-armor': {
        log.push(`Repair All Armor: cleared ${next.armorSlots.marked} Armor Slots`);
        next = { ...next, armorSlots: { ...next.armorSlots, marked: 0 } };
        break;
      }
      case 'prepare':
      case 'prepare-long': {
        const gained = choice.withParty === true ? 2 : 1;
        const actual = Math.min(gained, next.hope.max - next.hope.marked);
        next = { ...next, hope: { ...next.hope, marked: next.hope.marked + actual } };
        log.push(
          `Prepare${choice.withParty === true ? ' with the party' : ''}: gained ${actual} Hope`,
        );
        break;
      }
      case 'work-on-a-project': {
        log.push('Work on a Project: advance the project countdown with the GM');
        break;
      }
    }
  }

  const fearRoll = options.fixedFear ?? rng(4);
  const gmFear = rest === 'short' ? fearRoll : fearRoll + (options.partySize ?? 1);

  return {
    character: { ...next, updatedAt: new Date().toISOString() },
    log,
    gmFear,
  };
}

/**
 * Three short rests in a row force a long rest. Tracked as a count because the
 * app has no idea what happened at the table between sessions.
 */
export const mustTakeLongRest = (consecutiveShortRests: number): boolean =>
  consecutiveShortRests >= 3;
