/**
 * Rests and downtime moves.
 *
 * Each PC makes up to two downtime moves per rest, and may pick the same move
 * twice. The moves that clear a track are pure arithmetic, so the app rolls
 * and applies them; "Work on a Project" is narrative, so it only nudges a
 * countdown the GM already made.
 *
 * A rest is not only the character's. A Beastbound Ranger's companion clears
 * Stress alongside them - folio 18 - and until that was written here, a Ranger
 * who rested in this app came back with a companion still carrying every mark
 * they had taken.
 */
import type { Character } from '../../shared/types.ts';
import type { DerivedStats } from './character.ts';
import { clearCompanionStress, companionIsAway } from './companion.ts';
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
 * The die the Fear is rolled on. Named because two surfaces now roll it.
 *
 * The GM's own rest control draws a d4 face picker for a table that types its
 * dice, and a `4` written into that picker beside the `rng(4)` here is two
 * copies of one number - the shape this file's own docblocks name twice as
 * something this repository has been bitten by.
 */
export const FEAR_DIE = 4;

/**
 * The Fear a rest hands the GM, out of the rest that produced it.
 *
 * *"On a short rest, the GM gains 1d4 Fear. On a long rest, they gain Fear
 * equal to 1d4 + the number of PCs"* - `downtime`, p.41. The formula was one
 * line inside `takeRest` while the player's rest screen was the only thing that
 * could produce it. The GM's side has a rest control now, and it cannot call
 * `takeRest`: that wants a `Character` and a `DerivedStats`, and the GM has
 * neither - they have a party size and a die.
 *
 * So the formula comes out, `takeRest` calls it, and both sides read the one
 * definition. `tests/engine/rest.test.ts` asserts that they agree on the same
 * inputs, which is the half that matters: two copies written from the same
 * sentence agree by accident until the day one of them is edited.
 *
 * `partySize` is a count the table declares, never `party.length` - the board
 * is not a roster and `partySize.ts` argues that at length. This takes the
 * number it is given and does no counting of its own.
 */
export const fearFromRest = (rest: RestKind, roll: number, partySize: number): number =>
  rest === 'short' ? roll : roll + partySize;

/**
 * The Beastbound's other creature, on the two moves that clear Stress.
 *
 * *"When you choose a downtime move that clears Stress on yourself, your
 * companion clears an equal number of Stress."* This is the join, and it is
 * here rather than in `engine/companion.ts` only because the log line is the
 * rest's: `clearCompanionStress` owns the rule and this owns the sentence the
 * player reads afterwards.
 *
 * The companion is named in that line when they have a name, because "your
 * companion cleared 2 Stress" is a line about somebody the player calls
 * Ashfoot.
 *
 * AN ANIMAL WHO HAS LEFT THE SCENE IS NOT CLEARED, AND THAT IS A DELIBERATE
 * DEVIATION RATHER THAN THE RULE ABOVE BEING APPLIED CARELESSLY.
 *
 * Folio 18 says two things and this is where they meet. The sentence quoted
 * above carries no exception; three paragraphs earlier the same folio says
 * *"when they mark their last Stress, they drop out of the scene... They
 * remain unavailable until the start of your next long rest, WHERE THEY RETURN
 * WITH 1 STRESS CLEARED."* Both cannot hold on a short rest: without this
 * guard, a Clear Stress cleared the animal's whole track, `companionIsAway` is
 * purely derived, and so they walked back into the scene - the attack armable
 * again, the panel's own banner reading BACK AT YOUR NEXT LONG REST gone, the
 * GM's board un-greyed. The app printed a promise and took it back on the next
 * rest.
 *
 * The later sentence wins because it is the more specific one and because it
 * states its own return mechanism: if a short rest could bring them back, "they
 * return with 1 Stress cleared" would almost never happen. The cost is that
 * "an equal number" has an exception the book does not write, which is why it
 * is written here.
 *
 * THE FAITHFUL VERSION OF THIS COSTS A SCHEMA. Both sentences hold together
 * only if availability stops being derived from the Stress track - an explicit
 * `away` on `CompanionState`, which is `SCHEMA_VERSION` and a codec decision,
 * and which would falsify `companion.ts`'s "there is no second way to be out of
 * the scene". That is a bigger change than this defect is worth on its own; it
 * belongs to whichever step moves the character schema next.
 *
 * It does not reach a LONG rest. The return at the top of `takeRest` runs
 * before any move resolves, so by the time a long rest's clear arrives the
 * companion is back in the scene and it lands on them like any other.
 */
function alsoTheCompanion(c: Character, amount: number, log: string[]): Character {
  const companion = c.companion;
  if (companion !== null && companionIsAway(companion)) {
    const name = companion.name === '' ? 'Your companion' : companion.name;
    log.push(`${name}: out of the scene until your next long rest`);
    return c;
  }
  const { character, cleared } = clearCompanionStress(c, amount);
  if (cleared === 0) return character;
  const name = c.companion?.name ?? '';
  log.push(
    `${name === '' ? 'Your companion' : name}: cleared ${cleared} Stress alongside you`,
  );
  return character;
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

  /*
   * The companion comes back first.
   *
   * *"They remain unavailable until the start of your next long rest, where
   * they return with 1 Stress cleared."* At the START, and the order is the
   * rule rather than tidiness: a long rest that also clears Stress finds a
   * companion who is already back, so the move's own clear lands on them too
   * instead of being spent putting them on their feet.
   */
  if (rest === 'long' && next.companion !== null && companionIsAway(next.companion)) {
    const back = clearCompanionStress(next, 1);
    if (back.cleared > 0) {
      const name = next.companion.name;
      log.push(
        `${name === '' ? 'Your companion' : name}: returns to the scene with 1 Stress cleared`,
      );
      next = back.character;
    }
  }

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
        next = alsoTheCompanion(next, cleared, log);
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
        const cleared = next.stress.marked;
        log.push(`Clear All Stress: cleared ${cleared} Stress`);
        next = { ...next, stress: { ...next.stress, marked: 0 } };
        next = alsoTheCompanion(next, cleared, log);
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

  const fearRoll = options.fixedFear ?? rng(FEAR_DIE);
  const gmFear = fearFromRest(rest, fearRoll, options.partySize ?? 1);

  /*
   * The rest counts itself, here, rather than on whatever screen called it.
   *
   * `mustTakeLongRest` reads this number eight lines below, in this same file.
   * Writing it anywhere else would put the read and the write on opposite sides
   * of a module boundary - two routes to one number, which this repository has
   * already been bitten by twice (`sheetModel.ts::describeWeapon`, `loadout.ts`'s hpCost) -
   * and a screen that forgot to increment would leave the refusal permanently
   * unreachable, which is the exact bug this field was added to fix.
   *
   * Once per rest, not once per move: it is keyed off `rest`, outside the
   * choices loop, so a rest with no moves and a rest with two both count one,
   * and a rest whose moves were all refused counts one too - the moves were
   * refused, the rest still happened.
   *
   * And it counts rather than polices. A short rest asked for at 3 is applied
   * and comes back at 4. Refusing is a sentence somebody reads, and this file
   * has no screen to put a sentence on; silently declining to clear a track
   * here would be the app doing nothing and saying nothing.
   */
  const consecutiveShortRests = rest === 'short' ? c.consecutiveShortRests + 1 : 0;

  return {
    character: { ...next, consecutiveShortRests, updatedAt: new Date().toISOString() },
    log,
    gmFear,
  };
}

/**
 * Three short rests in a row force a long rest. Tracked as a count because the
 * app has no idea what happened at the table between sessions.
 *
 * The number is the one `takeRest` writes onto the character it returns, and it
 * is persisted on the record (`Character.consecutiveShortRests`, schema 4). It
 * used to be neither: the count existed only as this parameter, so every caller
 * would have had to invent it, and inventing it is how a refusal ends up
 * answering about rests that never happened.
 *
 * A count that arrived by QR is zero, because the wire does not carry it. So
 * `false` from this function means "this sheet has not counted three", never
 * "this table has not taken three", and whatever draws the refusal owes the
 * reader that difference.
 */
export const mustTakeLongRest = (consecutiveShortRests: number): boolean =>
  consecutiveShortRests >= 3;
