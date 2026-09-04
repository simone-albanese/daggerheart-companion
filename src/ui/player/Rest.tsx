/**
 * Rest and downtime: propose, then apply.
 *
 * `src/engine/rest.ts` has been complete and tested since it was written and
 * had no caller, so the arithmetic the SRD leaves to the table - 1d4+Tier onto
 * three different tracks, twice, plus the GM's Fear - was being done by hand
 * while the scene waited. This is the screen it never had.
 *
 * Three rules decide the shape, and each one rules out an obvious design.
 *
 * NOTHING ROLLS BECAUSE A SCREEN WAS OPENED. `takeRest` rolls dice, and a roll
 * that happens because you looked at something is a roll you cannot refuse. So
 * the preview calls the very same function with every `fixedRoll` pinned to 1
 * and then to 4, and `fixedFear: 0` - which brackets the real result without a
 * die - and hands it an `Rng` that throws. There is exactly one implementation
 * of the arithmetic on this surface, and the thing that previews the rest is
 * the thing that will apply it.
 *
 * AND NOTHING ROLLS FOR A TABLE THAT SWITCHED THE ROLLER OFF, WHICH IS THE
 * SAME RULE ONE STEP FURTHER ON. The preview was careful and the commit was
 * not: `Play.tsx` handed this `cryptoRng`, the commit called `takeRest` with
 * it, and no preference was read anywhere on the path - so a table that had
 * answered "Real dice, and the app stays out of it" in Onboarding, or turned
 * both switches off in Settings, still had 1d4s rolled for it the moment it
 * pressed COMMIT. `rollAffordance` is the one place this app answers what a
 * surface may offer and it is read here now, the way the roll control it
 * belongs to reads it (`DualityRoll.tsx:83`, `:926`) and the damage row is
 * handed it (`DamageRoll.tsx:288`): the roller is `canRoll`'s, the typed faces
 * are `canType`'s, and with neither on the rest is refused in a sentence.
 *
 * HOW MANY NUMBERS THAT ASKS FOR, WHICH IS THE QUESTION THAT DECIDES WHETHER
 * IT IS REASONABLE. `takeRest` reads one `fixedRoll` per choice and one
 * `fixedFear`, and `choices.slice(0, 2)` caps the choices at two - but only
 * three of the nine downtime moves ever reach `roll()` (`rest.ts:239`, `:247`,
 * `:256`), and all three are short-rest moves. Not one of the five long-rest
 * ones does. A LONG REST THEREFORE ASKS FOR EXACTLY ONE NUMBER whatever is
 * picked - the GM's Fear die - and a short rest for one, two or three: one per
 * Tend to Wounds, Clear Stress or Repair Armor chosen, plus the Fear. Three is
 * the worst case on this surface, and it is three d4s at a table that has just
 * rolled three d4s. Which of the moves costs a die is not a list kept here -
 * see `dieAsked` - so nobody is handed a blank for a die they did not roll.
 *
 * WITH BOTH SWITCHES ON, BOTH ROADS ARE OPEN AT ONCE. That is the meaning
 * `Onboarding.tsx:43-45` records for the fourth combination and this file does
 * not get to hold a different one - "ROLL *and* typable faces: a table that
 * rolls physically and digitally in the same session". What the old rule - the
 * first typed face turns the roller off - was buying is still real: a rest that
 * rolled some of its dice and took the others typed would write
 * "GM gains 3 Fear" into the log with nothing saying whether the 3 came off the
 * table or out of this device. What answers it is the two controls, not the
 * removal of one - each press is a single source for every die in the rest, so
 * a mixed rest is not reachable by pressing anything. The panel's press is held
 * back, in this file's own voice, until each face is a face a die of that size
 * can show; the roller's press is never held back, because it needs nothing
 * typed. `DeathMove.tsx` draws the same four states from the same helper.
 *
 * A ROW SAYS WHAT TAPPING IT WILL DO, NOT WHAT THE MOVE DOES IN GENERAL. Each
 * row's bracket is the difference between the rest as it stands and the rest
 * with that move appended, so picking Tend to Wounds twice shows the second one
 * clearing whatever the first one left - which is nothing, and it says so. A
 * row computed against the untouched character would have both rows promising
 * five Hit Points and the panel below them promising five in total.
 *
 * THE REFUSAL IS A SENTENCE, NOT A DISABLED BUTTON. `takeRest` counts short
 * rests and deliberately does not police them, because refusing is something
 * somebody reads. At three in a row the SHORT control is not drawn greyed out -
 * a dead control with the word SHORT still on it says the app could do this and
 * will not - it is replaced by the SRD's own sentence and the count this sheet
 * actually holds. Every other line that names that control reads the same flag
 * it does: the interrupted-rest panel is drawn on `kind`, which is independent
 * of the count, so at three in a row it says the short rest is off the screen
 * rather than sending the reader up to a button that is not there.
 *
 * THE FREE SWAP IS PART OF THE REST, SO IT WAITS FOR THE REST. Cards move
 * between loadout and vault at no cost *because* a rest is happening, and until
 * COMMIT no rest is happening. So a tap stages a `Swap` and `applySwaps` builds
 * the sheet the rest is proposed against; the rows, the counts and the gate are
 * all read back off that sheet, and one press applies the moves and the card
 * moves together and writes them into one log entry. Applied on the tap
 * instead, the price was taken for a downtime that had not occurred and might
 * never - and worse, it was only available then: COMMIT clears `kind`, which
 * takes the section off the screen, so the free swap existed exactly while no
 * rest did.
 *
 * Every ref the sheet holds gets a row there, including the ones this build
 * cannot read. A loadout ghost gets the same TO VAULT the readable rows get,
 * because it fills a slot the gate is counting and moving it out is the only
 * way a full loadout recalls anything; a vault ghost gets a row with no
 * control, because nothing here knows what it is. A section that drew three of
 * five cards and pointed at another fold would be the P1-6 defect on a new
 * surface - and that pointer was false anyway at 1180px and up, where the
 * loadout is a bare column in the cockpit and there is no fold to open.
 *
 * Two things this file deliberately does not do. It never sets
 * `aria-expanded` on anything but the fold header `Disclosure` draws for it:
 * `playSheet.test.tsx` sweeps every button carrying that attribute anywhere on
 * Play and demands the 44px floor of all of them, and `width: 100%` of the ones
 * a `<section>` owns. There are exactly two in-row exceptions on this screen -
 * the trait row's verbs control at 44x44 and MODS at 44x56 - and both are named
 * in that test rather than exempted from it. A third use of the attribute here
 * would be a fourth answer to a question two files have already settled between
 * them. And it never
 * counts to five: the swap goes through `canAddToLoadout` and `recallCard` with
 * `{ downtime: true }`, which is the flag `loadout.ts` has carried since it was
 * written and this is its first caller, so MAX_LOADOUT stays enforced in one
 * place and the vault charges Recall Cost during a scene and nothing during a
 * rest out of one function rather than out of two screens that agree today.
 *
 * THE TYPED PANEL'S ARITHMETIC, over its own declarations and this docblock's
 * own column figure. It is a `.panel` - 1px border, base.css:233-237 - with
 * `padding: '10px 11px'` and `gap: 6`, one `t-label` at 11px/1.2 since the
 * readability ramp - a 13.2px line box, from 10 - one row per die at
 * `var(--tap)` = 44, and its own press at the declared 56. So it is 2 + 20 +
 * 13.2 + n * (6 + 44) + 6 + 56 = 147.2px for one die, 197.2 for two and 247.2
 * for three, plus the 8px the column gaps it by: 155.2, 205.2, 255.2 (144, 194,
 * 244 and 152, 202, 252 at the 10px/1 label before the ramp). Every long rest that types pays the first
 * of those and only a short rest with two rolling moves pays the last. With
 * typed dice off it costs nothing, because it is not drawn - and with the
 * roller on as well it is drawn above the rolling press rather than instead of
 * it, so the fourth combination pays 68 more than the third (12 of pad and
 * rule, 56 of button). A face nothing can show adds 6 and a `t-read` paragraph
 * at 16px/1.5 on a phone = 24 a line (13px/1.45 = 18.85 before the readability
 * ramp), whose line count is not stated here because the
 * width it wraps at is `Disclosure`'s inner width and this file does not
 * declare it. Across the row, the name takes 369 - 2 of border - 22 of
 * padding - 8 of gap - the field's declared 72 = 265px, and it is one line
 * with an ellipsis rather than a wrap, so a long move name cannot push the
 * field it belongs to onto a second row. The field itself is 72x44: over the
 * 44px floor in both directions, and centred text because what goes in it is
 * one digit. The refusal that replaces the rolling press is a `t-label` at 10,
 * a `t-read` paragraph, and a `t-meta` at 10, gapped by 6; its line count is
 * unstated for the same reason.
 *
 * ERGONOMICS, at 393x852 (column 369px), 375x667 (351px), 744 and 1024 (both
 * the one-column sheet), and 1180+ (the cockpit's first column, 300-336px).
 * Closed it is one `Disclosure` header - 44px at `var(--tap)` - plus the
 * column's 8px gap: 52px, and all of it below ROLL, which is where the fold
 * index sits now that nothing on Play is pinned. Open on the played
 * fixture (three cards in the loadout, three in the vault) it is about 990px
 * for a short rest and about 1,185 for a long one, which carries five moves
 * and the interrupted-rest rule; the party toggle adds 52 when a Prepare is
 * picked, the refusal panel 114 when one is due, and the swap section grows
 * 50px a card. The single largest item is the move list at 369/463px, because
 * every move carries the SRD's own text under it - four to five lines for
 * Prepare - and that text is what the choice is made out of.
 *
 * Every target is at or above the 44px floor: the header 44x369, the two kind
 * buttons 44x180.5, a move row 46 (the family `LoadoutRows` uses at 46 and the
 * vault rows at 52), a slot's clear control 44x44, the party toggle 44, either
 * press that takes the rest 56x369 - the rolling one and the typed panel's -
 * because taking the rest is the only irreversible thing here whichever road it
 * goes down, and the swap chips 44x84. Nothing declares a width or a minWidth above 84px, so the column is
 * never forced wider than the phone by construction rather than by
 * measurement.
 *
 * THUMB ARC. The whole column scrolls, and since the reflow paired this fold
 * with `Cards` it is the second of the two paired rows rather than the fifth
 * fold down: measured in Chrome, `played` fixture, every fold shut, this
 * header spans **y505-549** at 393x852 and y437-481 at 375x667, on the glass
 * without scrolling at both. (It said y=804, below a glass that ends at 791,
 * which was true of the six-row index the pairing replaced.) A right thumb
 * rests around y=560..730, so a shut header now sits just above the near edge
 * of that band and is reached rather than scrolled to. The kind switch is at
 * the top of the fold, so opening it puts the switch about where the header
 * was and the rest of the surface below, and it is chosen with the eyes. COMMIT is last on the surface - it applies everything drawn above it,
 * including the swaps, so it cannot sit in the middle of what it applies - and
 * on the played fixture that is some 1,100px of content later, three deliberate
 * scrolls rather than two; above it sit a 12px pad and a 1px rule, so a thumb
 * overshooting the last swap row lands on the divider. And COMMIT does not
 * exist until a rest kind has been chosen, so the first tap on this surface can
 * never be the last one.
 *
 * The typed panel sits between the swap rows and the rolling press, which is
 * the only place it can be: it is filled in immediately before its own press,
 * and above the swaps it would be up to 50px a card away from the button it
 * fills in. That puts it in the same three-scrolls-down band rather than under
 * a resting thumb, which is right for a field somebody is looking at while they
 * type into it - and the press it feeds is inside it, directly under the last
 * field, so a thumb that overshoots the fields lands on the control those
 * fields are for rather than on the one that would roll instead of reading
 * them. `DeathMove.tsx` puts its roll button above its panel and this puts it
 * below, and that is the one place the two surfaces are drawn differently: the
 * rule here is that the control which applies the swaps drawn above it comes
 * last, and the dialog has no swaps.
 *
 * READ VERSUS TOUCH. Touched: three controls before a kind is chosen, up to
 * eighteen after, plus one to three fields and the press they fill in when the
 * table types its own dice - and with both switches on, one more press than
 * with either alone, which is what a surface that offers two roads costs. Read and never touched: the SRD's own move text, at
 * `t-read` - 16px/1.5 on a phone and 15px/1.5 from 720 since the readability
 * ramp, the size that exists in this stylesheet for prose
 * somebody is reading in order to decide something, which is exactly the job
 * here - the two quoted rules, and the brackets, which are `t-num` with
 * tabular figures so "3-5" does not reflow as the picks change. The preview is
 * the reason this surface exists and it is read rather than pressed: the app
 * must not make somebody tap to find out what a move will do.
 *
 * Which is a rule about hearing as much as about seeing, and `aria-label`
 * replaces an element's contents rather than adding to them. So every number
 * this surface draws inside a control is repeated at the end of that control's
 * name - "Choose Repair All Armor as your first move: 2 ARMOR" - and every
 * control's visible label is contained in its name, which is WCAG 2.5.3 and is
 * what lets somebody say "tap Prepare with the party" to a device. Both are
 * swept in `rest.test.tsx`, over the whole open surface, rather than asserted
 * control by control.
 */
import { useMemo, useState } from 'react';
import type { Character, Ref } from '../../../shared/types.ts';
import type { DatasetIndex, DerivedStats } from '../../engine/character.ts';
import type { Rng } from '../../engine/dice.ts';
import {
  canAddToLoadout,
  missingCardRefs,
  recallCard,
  resolveCards,
  vaultCard,
} from '../../engine/loadout.ts';
import {
  movesFor,
  mustTakeLongRest,
  takeRest,
  type DowntimeChoice,
  type DowntimeMove,
  type DowntimeMoveId,
  type RestKind,
} from '../../engine/rest.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Disclosure } from '../shared/Disclosure.tsx';
// The one place this app answers "what may this surface offer", read here
// rather than reasoned out again: a surface deciding for itself what the two
// dice switches mean is another answer that can disagree with the roll
// control's, which is where a player learnt them.
import { rollAffordance } from '../shared/rollAffordance.ts';
import { shortReason } from './recall.ts';
import { interruptedRestRule, longRestRule } from '../shared/ruleText.ts';

interface Props {
  stats: DerivedStats;
  /**
   * The dice.
   *
   * Passed in at the call site rather than defaulted, so that the one place a
   * rest can roll is visible from `Play.tsx` without opening this file - and so
   * a test can hand it a scripted one and assert that the numbers on the screen
   * are the numbers the script produced. The preview never sees it.
   *
   * NOR DOES THE TYPED COMMIT, WHICH IS WHY THE PROP DID NOT HAVE TO CHANGE.
   * With the roller off every die goes in as a `fixedRoll` or a `fixedFear`,
   * both of which `takeRest` reads with `??` before it reaches for the `Rng` -
   * so this is passed and never consulted, and a test proving it can simply
   * hand over `refusingRng` and press COMMIT.
   */
  rng: Rng;
  /**
   * Draw the fold header as two lines, because it is sharing a row.
   *
   * Forwarded straight to `Disclosure` and nothing else in this file reads it.
   * The phone pairs this section with `Cards`, and the pairing lives in
   * `Play.tsx` where the column's arithmetic is - so what arrives here is the
   * answer, not the question.
   */
  stacked?: boolean;
}

/**
 * The `Rng` the preview is given, which must never be consulted.
 *
 * It throws rather than returning a number, because the failure it guards
 * against is silent: `takeRest` reads `choice.fixedRoll ?? rng(4)` and
 * `options.fixedFear ?? rng(4)`, so an edit that drops a `fixedRoll` - or
 * rewrites either `??` into a `||`, where `fixedFear: 0` stops suppressing the
 * die - turns a render into a live roll and nothing anywhere would say so.
 * With this, that edit fails loudly, during the render, in this file.
 */
const neverRolls: Rng = () => {
  throw new Error('the rest preview must not roll dice');
};

/** The two moves that gain Hope, by id: both are named "Prepare". */
const PREPARE: DowntimeMoveId[] = ['prepare', 'prepare-long'];

/**
 * A chosen move and the face typed for it, which are one value on purpose.
 *
 * The sibling defect on the Duality Roll was a face outliving the die it was
 * typed for: the faces were kept in their own map, the dice were re-armed
 * between rolls, and a roll resolved on a number entered for a different one.
 * Here the two cannot come apart, because taking a move out of a slot is
 * `filter` over this list and replacing one is a new object in it - so the face
 * goes with the move by construction rather than by remembering to clear it.
 */
interface Pick {
  move: DowntimeMoveId;
  /** What the table's die showed, as typed. Empty until it has been. */
  face: string;
}

interface Delta {
  hp: number;
  stress: number;
  armor: number;
  hope: number;
}

/** What a rest will do, at the bottom and the top of the 1d4. */
interface Bracket {
  low: Delta;
  high: Delta;
  /** Fear with the die suppressed: 0 on a short rest, the party on a long one. */
  fearFlat: number;
}

interface MoveView {
  move: DowntimeMove;
  /** What tapping this row would do, on top of what is already chosen. */
  bracket: Bracket;
  /** The engine's own line, for the one move the engine does not apply. */
  note: string | null;
  /** The die this move costs, in sides, or null when it costs none. */
  die: number | null;
}

interface View {
  moves: MoveView[];
  /** The rest as it stands, against the character as it stands. */
  total: Bracket;
  /** The engine's lines for whatever picked moves it does not apply. */
  notes: string[];
  /** The GM's Fear die, in sides. Every rest owes one. */
  fearDie: number | null;
}

/**
 * Which die the engine will roll for this, in sides - asked of the engine.
 *
 * A surface that types the dice has to know which dice there are, and there is
 * no honest way to know it from here: `movesFor` says what the moves are and
 * `mechanical` says whether the app applies one, but neither says whether a d4
 * is involved. Six of the nine roll nothing at all. `DOWNTIME_MOVES`
 * (`rest.ts:41-106`) holds nine - four short (`:45`, `:52`, `:59`, `:66`) and
 * five long (`:73`, `:80`, `:87`, `:94`, `:101`) - and `roll()` is reached at
 * three places in `takeRest`'s `switch` (`:239`, `:247`, `:256`), all three of
 * them short-rest moves. The other six get there four different ways, which is
 * the point: three long ones clear a whole track (`:266`, `:271`, `:278`),
 * both Prepares gain a flat Hope (`:283-284`), and Work on a Project is
 * `mechanical: false` and only writes a line (`:293`). A list of the three
 * that do roll, kept in this file, would be a second opinion about that
 * `switch`, which is exactly the shape of bug this repository keeps finding.
 *
 * So the engine is asked, with an `Rng` that records the sides it was called
 * for and hands back a 1. Nothing is kept but the number of sides: the outcome
 * is dropped on the floor, and the 1 never reaches a screen or a sheet. That
 * is also why it may return null - a move that consults no die never calls it -
 * and why nobody is ever asked to type a die they did not roll.
 */
function dieAsked(
  c: Character,
  stats: DerivedStats,
  kind: RestKind,
  choices: DowntimeChoice[],
  options: { partySize?: number; fixedFear?: number },
): number | null {
  const asked: number[] = [];
  takeRest(c, stats, kind, choices, options, (sides) => {
    asked.push(sides);
    return 1;
  });
  return asked[0] ?? null;
}

const cleared = (from: Character, to: Character): Delta => ({
  hp: from.hp.marked - to.hp.marked,
  stress: from.stress.marked - to.stress.marked,
  armor: from.armorSlots.marked - to.armorSlots.marked,
  hope: to.hope.marked - from.hope.marked,
});

const empty = (d: Delta): boolean => d.hp === 0 && d.stress === 0 && d.armor === 0 && d.hope === 0;

/**
 * Every number on this surface, out of the function that will apply them.
 *
 * Pure, and pure on purpose: it takes the character and gives back numbers, so
 * the component has no arithmetic in it to drift from the engine's. About
 * thirty `takeRest` calls on a long rest, every one of them with each 1d4
 * pinned to 1 and then to 4 and `fixedFear: 0`, and every one of them handed
 * an `Rng` that throws. They are cheap - a handful of object spreads each -
 * and the alternative is a second implementation of the arithmetic on the one
 * surface whose job is to say what the first one will do.
 *
 * The two ends are ordered with min and max rather than assumed to arrive in
 * order, because a second copy of a move does *more* when the first copy rolled
 * *less*: Tend to Wounds twice against five marked Hit Points clears 3 then 2
 * at the bottom of the die and 5 then 0 at the top, so the second row's own
 * bracket runs 0 to 2 and would print backwards if the two ends were simply
 * taken as low and high.
 */
function buildView(
  c: Character,
  stats: DerivedStats,
  kind: RestKind,
  picks: DowntimeMoveId[],
  withParty: boolean,
  partySize: number,
): View {
  const run = (ids: DowntimeMoveId[], roll: number) => {
    const choices: DowntimeChoice[] = ids.map((move) => ({ move, withParty, fixedRoll: roll }));
    return takeRest(c, stats, kind, choices, { fixedFear: 0, partySize }, neverRolls);
  };
  const bracket = (before: DowntimeMoveId[], ids: DowntimeMoveId[]): Bracket => {
    const at = (roll: number): Delta =>
      cleared(run(before, roll).character, run(ids, roll).character);
    const one = at(1);
    const four = at(4);
    return {
      low: {
        hp: Math.min(one.hp, four.hp),
        stress: Math.min(one.stress, four.stress),
        armor: Math.min(one.armor, four.armor),
        hope: Math.min(one.hope, four.hope),
      },
      high: {
        hp: Math.max(one.hp, four.hp),
        stress: Math.max(one.stress, four.stress),
        armor: Math.max(one.armor, four.armor),
        hope: Math.max(one.hope, four.hope),
      },
      fearFlat: run([], 1).gmFear,
    };
  };

  /*
   * The moves that would already have happened by the time this one does.
   *
   * With a slot free that is every pick; with both slots full a row replaces
   * the second, so only the first still precedes it. A row bracketed against
   * the untouched character instead would have two copies of Tend to Wounds
   * both promising five Hit Points, over a panel promising five in total.
   */
  const before = picks.length < 2 ? picks : picks.slice(0, 1);
  const moves = movesFor(kind);

  return {
    total: bracket([], picks),
    // Every rest owes the GM a die and no choice suppresses it, so this is
    // asked with no moves at all and with the fear left to the engine.
    fearDie: dieAsked(c, stats, kind, [], { partySize }),
    notes: picks
      .map((id) => moves.find((m) => m.id === id))
      .filter((m): m is DowntimeMove => m !== undefined && !m.mechanical)
      .map((m) => run([m.id], 1).log[0] ?? ''),
    moves: moves.map((move) => ({
      move,
      bracket: bracket(before, [...before, move.id]),
      note: move.mechanical ? null : (run([move.id], 1).log[0] ?? null),
      // The Fear die is suppressed here so that the only call this can record
      // is the move's own.
      die: dieAsked(c, stats, kind, [{ move: move.id }], { fixedFear: 0, partySize }),
    })),
  };
}

const range = (low: number, high: number): string =>
  low === high ? String(low) : `${String(low)}–${String(high)}`;

/** A row's own answer: what this tap will clear or gain, in one line. */
function rowText(b: Bracket): string {
  const parts: string[] = [];
  if (b.high.hp > 0) parts.push(`${range(b.low.hp, b.high.hp)} HP`);
  if (b.high.stress > 0) parts.push(`${range(b.low.stress, b.high.stress)} STRESS`);
  if (b.high.armor > 0) parts.push(`${range(b.low.armor, b.high.armor)} ARMOR`);
  if (b.high.hope > 0) parts.push(`+${range(b.low.hope, b.high.hope)} HOPE`);
  return parts.join(' · ');
}

/** A card this rest will move, and which way it will go. */
interface Swap {
  ref: Ref;
  to: 'vault' | 'loadout';
}

/**
 * The sheet as the rest would leave it, before the rest has been taken.
 *
 * Proposed rather than applied, for the same reason the moves are: the free
 * price is the rest's price. A tap that moved the card immediately spent a
 * downtime that had not happened - and could not be made to happen, because
 * COMMIT clears `kind` and takes the whole section off the screen, so the free
 * swap was reachable exactly while no rest existed and gone the moment one did.
 *
 * Everything the section draws is resolved from what this returns, so a staged
 * swap that the engine will not perform is a swap the screen does not show
 * either: `recallCard` returns the sheet untouched when `canAddToLoadout`
 * refuses, and the rows, the counts and the gate are all read back off the
 * result. The screen and the commit run the same reduction over the same list.
 */
const applySwaps = (c: Character, swaps: Swap[], index: DatasetIndex): Character =>
  swaps.reduce((sheet, swap) => {
    if (swap.to === 'vault') return vaultCard(sheet, swap.ref);
    const card = index.cards.get(swap.ref);
    return card === undefined ? sheet : recallCard(sheet, card, { downtime: true }).character;
  }, c);

export function Rest({ stats, rng, stacked = false }: Props): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const rules = useApp((s) => s.dataset.rules);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  /**
   * The rest being proposed: which kind it is, and the GM's die as typed.
   *
   * One value, for the reason `Pick` is one. The Fear die belongs to no move,
   * so `setPicks([])` does not take it away and something has to - and there
   * are two places that would have to remember: the commit, which ends a rest,
   * and the kind switch, which replaces one. Two clears is two chances to
   * forget, and a mutant that deletes either of them is invisible while the
   * other stands, which is exactly how a face outlives the roll it was typed
   * for. Held here, the face cannot outlive the rest it belongs to, because
   * ending a rest is `setRest(null)` and starting one is a new object.
   */
  const [rest, setRest] = useState<{ kind: RestKind; fearFace: string } | null>(null);
  const kind = rest?.kind ?? null;
  const fearFace = rest?.fearFace ?? '';
  const setFearFace = (value: string): void => {
    setRest((current) => (current === null ? current : { ...current, fearFace: value }));
  };
  const [picks, setPicks] = useState<Pick[]>([]);
  const [withParty, setWithParty] = useState(false);
  const [swaps, setSwaps] = useState<Swap[]>([]);

  const affordance = rollAffordance(digitalDice, manualDice);

  /** The sheet this rest is being proposed against: the swaps are part of it. */
  const staged = useMemo(
    () => (character === null ? null : applySwaps(character, swaps, index)),
    [character, swaps, index],
  );

  /*
   * `picks` and `withParty` are in the key, and that is not decoration: the
   * panel under the rows is built out of `takeRest(staged, …, picks)`, so a
   * key without them would leave it printing the numbers for the *previous*
   * selection - the one surface whose entire reason for existing is saying what
   * a move will clear before you commit to it, stating a clearing that will not
   * happen. `picks` is state, so its identity changes exactly when it changes.
   */
  const view = useMemo(
    () =>
      staged === null || kind === null
        ? null
        : buildView(staged, stats, kind, picks.map((p) => p.move), withParty, partySize),
    [staged, stats, kind, picks, withParty, partySize],
  );

  if (!character || staged === null) return null;

  const counted = character.consecutiveShortRests;
  const longDue = mustTakeLongRest(counted);
  const summary = longDue
    ? 'LONG REST DUE'
    : counted === 0
      ? 'NONE COUNTED'
      : `${String(counted)} SHORT IN A ROW`;

  const moves = kind === null ? [] : movesFor(kind);
  const nameOf = (id: DowntimeMoveId): string => moves.find((m) => m.id === id)?.name ?? id;
  const preparing = picks.some((p) => PREPARE.includes(p.move));

  /*
   * What the staged swaps come to, netted rather than counted.
   *
   * A card sent to the vault and recalled again is in neither list, because
   * nothing will have moved - the log and the panel both describe the sheet
   * before and the sheet after, not the taps in between.
   */
  const cardName = (ref: Ref): string => index.cards.get(ref)?.name ?? ref;
  const movingOut = character.loadout.filter((r) => !staged.loadout.includes(r));
  const movingIn = staged.loadout.filter((r) => !character.loadout.includes(r));
  const moving = movingOut.length + movingIn.length;

  /*
   * THE DICE THIS REST WILL ACTUALLY ROLL, AND WHO ROLLS THEM.
   *
   * One entry per die the engine asked for, in the order it asked: a face for
   * each chosen move that costs one, then the GM's. A move that costs no die
   * has no entry, so nobody is ever handed a blank for a die they did not roll.
   */
  const dice: {
    key: string;
    /** The move this die is for, as the panel names it. */
    name: string;
    sides: number;
    face: string;
    set: (value: string) => void;
  }[] =
    view === null
      ? []
      : [
          ...picks.flatMap((p, slot) => {
            const sides = view.moves.find((m) => m.move.id === p.move)?.die ?? null;
            if (sides === null) return [];
            return [
              {
                key: `move-${String(slot)}`,
                name: `${nameOf(p.move)}, move ${String(slot + 1)}`,
                sides,
                face: p.face,
                set: (value: string): void => {
                  setPicks((current) =>
                    current.map((q, i) => (i === slot ? { ...q, face: value } : q)),
                  );
                },
              },
            ];
          }),
          ...(view.fearDie === null
            ? []
            : [
                {
                  key: 'fear',
                  name: 'the GM\u2019s Fear',
                  sides: view.fearDie,
                  face: fearFace,
                  set: setFearFace,
                },
              ]),
        ];

  /** A face a die of this size can show. The surface validates; the engine takes. */
  const isFace = (value: string, sides: number): boolean =>
    /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= sides;

  /*
   * BOTH ROADS AT ONCE, WHICH IS WHAT THE FOURTH COMBINATION ALREADY MEANT.
   *
   * `Onboarding.tsx:43-45` is where that meaning is recorded, and it is not
   * this file's to change: "The fourth combination, both switched on, is ROLL
   * *and* typable faces: a table that rolls physically and digitally in the
   * same session, which is a real thing and a rare one." So `canRoll` draws the
   * control that rolls, `canType` draws the panel that takes faces, both on
   * draws both and neither draws the sentence - the same four states
   * `DeathMove.tsx` draws out of the same helper, and the same pair of roads
   * `DicePools.tsx:185-204` puts side by side when a pool die has no face:
   * "Roll it" beside "Type what you rolled".
   *
   * This surface used to let the first typed face turn the roller off, and the
   * honesty it was buying is real: a rest whose log line mixed a number off the
   * table with a number out of this device would leave "GM gains 3 Fear" unable
   * to say which the 3 was. Two controls buy it without taking a road away.
   * Each of them is one source for every die in the rest - the roller rolls all
   * of them, the typed control takes all of them - so a mixed rest is not
   * reachable by pressing anything, and which road this rest went down is the
   * press the player chose rather than a rule this file applied to them.
   */
  const outstanding = affordance.canType ? dice.filter((d) => !isFace(d.face, d.sides)) : [];
  /** Typed but impossible: a d4 showing 5, or a 0, which no die shows. */
  const impossible = outstanding.filter((d) => d.face.trim() !== '');
  const typedReady = affordance.canType && dice.length > 0 && outstanding.length === 0;

  const chooseKind = (next: RestKind): void => {
    if (next === kind) return;
    // The lists are different and `takeRest` refuses a move from the other one
    // out loud. Carrying picks across would leave two slots holding moves that
    // are not on the screen, a preview bracketing to zero, and a commit that
    // writes "is not a long rest move - not applied" into an entry labelled
    // Long rest.
    // A new rest, with a blank Fear die in it: the moves go with `setPicks`
    // and their faces go with them, and the GM's die goes because it is part
    // of the rest that has just been replaced.
    setRest({ kind: next, fearFace: '' });
    setPicks([]);
    setWithParty(false);
  };

  const pick = (id: DowntimeMoveId): void => {
    setPicks((current) =>
      current.length < 2
        ? [...current, { move: id, face: '' }]
        : [current[0]!, { move: id, face: '' }],
    );
  };

  /*
   * Appended, never applied. There is no cap and no de-duplication here on
   * purpose: `applySwaps` replays the list through `vaultCard` and
   * `recallCard`, so the five is enforced by `canAddToLoadout` in the one place
   * it has always been enforced, and a card sent out and recalled again ends up
   * exactly where it started rather than in a second list that has to agree.
   */
  const stage = (ref: Ref, to: 'vault' | 'loadout'): void => {
    setSwaps((current) => [...current, { ref, to }]);
  };

  /**
   * Take the rest, down one road or the other.
   *
   * `typed` is the press rather than a preference: the panel's control passes
   * true and can only be pressed when every die has a face, the rolling control
   * passes false and is only drawn when `canRoll`. It is checked again here so
   * that the guard is on the function that writes rather than on the two things
   * that call it.
   */
  const commit = (typed: boolean): void => {
    if (kind === null) return;
    if (typed ? !typedReady : !affordance.canRoll) return;
    /*
     * The typed road is the preview's road, which is the whole reason it is
     * safe: `fixedRoll` and `fixedFear` are the two doors `takeRest` has always
     * had, the preview has used both since this file was written, and nothing
     * here widens the engine to add a third. A face is attached only to a move
     * the engine said it would roll for, so a `fixedRoll` never sits on a move
     * that would ignore it and quietly look like an applied number.
     */
    const choices: DowntimeChoice[] = picks.map((p) => {
      const rolls = view?.moves.find((m) => m.move.id === p.move)?.die ?? null;
      return typed && rolls !== null
        ? { move: p.move, withParty, fixedRoll: Number(p.face) }
        : { move: p.move, withParty };
    });
    // Against the staged sheet, so the one press applies the rest and the card
    // moves that are free *because of* it, in one write and one entry.
    const outcome = takeRest(
      staged,
      stats,
      kind,
      choices,
      typed && view?.fearDie !== null ? { partySize, fixedFear: Number(fearFace) } : { partySize },
      rng,
    );
    update(() => outcome.character);
    /*
     * The `'rest'` entry `state.ts` has declared since the first commit and
     * nothing has ever written.
     *
     * The detail is the engine's own lines verbatim, including any refusal it
     * produced, so the log can never say a move was made that was not - and the
     * Fear is the number that was actually rolled, where the panel above could
     * only name the die. The rule is appended at the moment it becomes true
     * rather than on every short rest, because that is when it is news.
     *
     * The swaps are read off the difference between the sheet and the staged
     * sheet rather than off the tap history, so a card moved out and back is
     * not reported as having moved, and a swap the engine refused cannot be
     * reported at all: it is not in the difference, because it is not in the
     * sheet that was written.
     */
    const becameDue =
      mustTakeLongRest(outcome.character.consecutiveShortRests) && !mustTakeLongRest(counted);
    const detail = [
      ...outcome.log,
      ...movingOut.map((r) => `Moved ${cardName(r)} to the vault`),
      ...movingIn.map((r) => `Recalled ${cardName(r)}, free during this rest`),
      `GM gains ${String(outcome.gmFear)} Fear`,
      becameDue ? longRestRule(rules) : null,
    ]
      .filter((line): line is string => line !== null && line !== '')
      .join(' · ');
    pushLog({ kind: 'rest', label: kind === 'short' ? 'Short rest' : 'Long rest', detail });
    // AND THE SECOND REST OF THE EVENING STARTS FROM BLANK, because this takes
    // the whole rest away and the Fear die was part of it. Left behind, it
    // would arrive on the next rest already filled in, with nothing
    // outstanding to say it was typed for one that has already been taken.
    setRest(null);
    setPicks([]);
    setWithParty(false);
    setSwaps([]);
  };

  const kindButton = (which: RestKind, label: string): React.JSX.Element => (
    <button
      type="button"
      aria-pressed={kind === which}
      aria-label={`Take a ${which} rest`}
      onClick={() => chooseKind(which)}
      className="row"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 'var(--tap)',
        justifyContent: 'center',
        borderRadius: 'var(--r3)',
        background: kind === which ? 'var(--hope-wash)' : 'var(--raised)',
        border: `1px solid ${kind === which ? 'var(--hope)' : 'var(--line)'}`,
        font: '700 0.8125rem/1 var(--sans)',
        letterSpacing: '0.06em',
        color: 'var(--text)',
      }}
    >
      {label}
    </button>
  );

  const quoted = (rule: string): React.JSX.Element => (
    <p className="t-read" style={{ margin: 0 }}>
      “{rule}”
    </p>
  );

  const loadout = resolveCards(staged.loadout, index);
  const vault = resolveCards(staged.vault, index);
  /*
   * The refs this build cannot name, on both sides.
   *
   * `resolveCards` is a `.filter()`, so a card from a newer bundle or from a
   * homebrew layer that is not on this device disappears from every list drawn
   * out of it - while `canAddToLoadout` goes on counting it. P1-6 gave the
   * loadout half of Play its ghosts for exactly that reason and `Play.tsx`
   * tracks `ghostVault` beside `ghostLoadout`; this surface draws both lists,
   * so it needs both. A vault of five that draws three rows and says nothing is
   * the same defect on the quieter side.
   */
  const missing = new Set(missingCardRefs(staged, index));
  const ghostLoadout = staged.loadout.filter((r) => missing.has(r));
  const ghostVault = staged.vault.filter((r) => missing.has(r));

  return (
    <Disclosure
      id="rest"
      characterId={character.id}
      label="Rest & downtime"
      summary={summary}
      stacked={stacked}
    >
      <div className="stack" style={{ flex: 'none', gap: 8 }}>
        {longDue && (
          <div
            className="panel stack"
            style={{ flex: 'none', gap: 6, padding: '10px 11px', borderLeft: '3px solid var(--damage)' }}
          >
            <span className="t-label" style={{ color: 'var(--damage)' }}>
              A long rest is due
            </span>
            {longRestRule(rules) !== null && quoted(longRestRule(rules)!)}
            <span className="t-meta">
              THIS SHEET HAS COUNTED {counted} SHORT RESTS IN A ROW
            </span>
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              COUNTED HERE · A SHEET THAT ARRIVED BY QR ARRIVES AT ZERO
            </span>
          </div>
        )}

        <div className="row" role="group" aria-label="Which rest" style={{ flex: 'none', gap: 8 }}>
          {!longDue && kindButton('short', 'SHORT REST')}
          {kindButton('long', 'LONG REST')}
        </div>

        {kind === 'long' && interruptedRestRule(rules) !== null && (
          <div className="panel stack" style={{ flex: 'none', gap: 6, padding: '10px 11px' }}>
            <span className="t-hint" style={{ fontWeight: 600 }}>If it was interrupted</span>
            {quoted(interruptedRestRule(rules)!)}
            {/* Pointing at the short rest is only honest while the short rest
                is drawn, and at three in a row the `!longDue &&` on the SHORT
                REST button in the "Which rest" group above has deliberately
                taken it away. The two conditions are independent, so the
                sentence reads the same flag the control does rather than
                assuming it. */}
            <span className="t-hint" style={{ color: 'var(--dim)' }}>
              {longDue
                ? 'The app cannot tell · with a long rest due the short one is not on this screen'
                : 'The app cannot tell · the short rest above applies exactly that'}
            </span>
          </div>
        )}

        {kind !== null && view !== null && (
          <>
            <div className="stack" style={{ flex: 'none', gap: 6 }}>
              {view.moves.map(({ move, bracket, note }) => {
                const chosen = picks.filter((p) => p.move === move.id).length;
                const slotSaid =
                  picks.length < 2
                    ? `as your ${picks.length === 0 ? 'first' : 'second'} move`
                    : `as your second move, replacing ${nameOf(picks[1]!.move)}`;
                const answer = note !== null ? 'WITH THE GM' : (rowText(bracket) || 'NOTHING');
                return (
                  <div key={move.id} className="stack" style={{ flex: 'none', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => pick(move.id)}
                      /*
                       * The bracket is in the name, because `aria-label`
                       * replaces the contents: without it "3–5 HP" is drawn
                       * inside this button and announced nowhere, and the row
                       * a screen reader hears on a hurt sheet is identical to
                       * the row it hears on an untouched one. The number is
                       * the thing the choice is made out of - it is why this
                       * surface exists - so it belongs in the sentence, not in
                       * a `describedby` a reader can switch off.
                       */
                      aria-label={`Choose ${move.name} ${slotSaid}: ${answer}`}
                      className="row"
                      style={{
                        flex: 'none',
                        minHeight: 46,
                        gap: 8,
                        borderRadius: 'var(--r3)',
                        background: chosen > 0 ? 'var(--hope-wash)' : 'var(--app)',
                        border: '1px solid var(--line-soft)',
                        borderLeft: `3px solid ${chosen > 0 ? 'var(--hope)' : 'var(--edge)'}`,
                        padding: '0 11px',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          font: '600 14px/1.15 var(--sans)',
                          color: 'var(--text)',
                        }}
                      >
                        {move.name}
                      </span>
                      <span
                        className="t-num"
                        style={{
                          flex: 'none',
                          color: answer === 'NOTHING' || note !== null ? 'var(--dim)' : 'var(--hope)',
                        }}
                      >
                        {answer}
                      </span>
                    </button>
                    {/* The SRD's own words, outside the button so the row's
                        accessible name stays one sentence long. This is the
                        text the choice is made out of, so it is `t-read` and
                        not the glance size. */}
                    <p className="t-read" style={{ margin: 0, padding: '0 3px' }}>
                      {move.text}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="row" style={{ flex: 'none', gap: 8 }}>
              {[0, 1].map((slot) => {
                const held = picks[slot];
                if (held === undefined) {
                  return (
                    <span
                      key={slot}
                      className="row t-meta"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: 44,
                        justifyContent: 'center',
                        borderRadius: 'var(--r3)',
                        border: '1px dashed var(--line)',
                        color: 'var(--dim)',
                      }}
                    >
                      MOVE {slot + 1}
                    </span>
                  );
                }
                return (
                  <span
                    key={slot}
                    className="row"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 44,
                      gap: 4,
                      borderRadius: 'var(--r3)',
                      background: 'var(--raised)',
                      border: '1px solid var(--line)',
                      padding: '0 0 0 10px',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        font: '600 0.75rem/1.15 var(--sans)',
                        color: 'var(--text-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nameOf(held.move)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicks((current) => current.filter((_, i) => i !== slot))}
                      aria-label={`Take ${nameOf(held.move)} out of move ${slot + 1}`}
                      className="row"
                      style={{
                        flex: 'none',
                        width: 44,
                        minWidth: 44,
                        minHeight: 44,
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        font: '600 15px/1 var(--sans)',
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>

            {preparing && (
              <button
                type="button"
                aria-pressed={withParty}
                /*
                 * The name opens with the words on the face of the control.
                 * "Prepare with one or more members of your party" is the SRD's
                 * phrasing and it does not contain "PREPARE WITH THE PARTY", so
                 * a voice-control user asking for what they can see got no
                 * match: WCAG 2.5.3, and the only control on this surface that
                 * failed it.
                 */
                aria-label="Prepare with the party, for 2 Hope each"
                onClick={() => setWithParty((on) => !on)}
                className="row"
                style={{
                  flex: 'none',
                  minHeight: 'var(--tap)',
                  gap: 8,
                  borderRadius: 'var(--r3)',
                  background: withParty ? 'var(--hope-wash)' : 'var(--raised)',
                  border: `1px solid ${withParty ? 'var(--hope)' : 'var(--line)'}`,
                  padding: '0 11px',
                  textAlign: 'left',
                }}
              >
                <span className="t-meta" style={{ flex: 1, minWidth: 0, color: 'var(--text)' }}>
                  PREPARE WITH THE PARTY
                </span>
                <span className="t-meta" style={{ flex: 'none', color: 'var(--hope)' }}>
                  {withParty ? '2 HOPE EACH' : 'ALONE'}
                </span>
              </button>
            )}

            <div className="panel stack" style={{ flex: 'none', gap: 6, padding: '10px 11px' }}>
              {picks.length === 0 && (
                <span className="t-meta">NO MOVES CHOSEN · THE REST STILL HAPPENS</span>
              )}
              {!empty(view.total.high) && (
                <>
                  {(view.total.high.hp > 0 ||
                    view.total.high.stress > 0 ||
                    view.total.high.armor > 0) && (
                    <div className="spread" style={{ flex: 'none' }}>
                      <span className="t-label">Will clear</span>
                      <span className="t-num" style={{ textAlign: 'right' }}>
                        {[
                          view.total.high.hp > 0
                            ? `HP ${range(view.total.low.hp, view.total.high.hp)} of ${String(character.hp.marked)}`
                            : null,
                          view.total.high.stress > 0
                            ? `STRESS ${range(view.total.low.stress, view.total.high.stress)} of ${String(character.stress.marked)}`
                            : null,
                          view.total.high.armor > 0
                            ? `ARMOR ${range(view.total.low.armor, view.total.high.armor)} of ${String(character.armorSlots.marked)}`
                            : null,
                        ]
                          .filter((part): part is string => part !== null)
                          .join(' · ')}
                      </span>
                    </div>
                  )}
                  {view.total.high.hope > 0 && (
                    <div className="spread" style={{ flex: 'none' }}>
                      <span className="t-label">Will gain</span>
                      <span className="t-num" style={{ color: 'var(--hope)' }}>
                        HOPE +{range(view.total.low.hope, view.total.high.hope)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {picks.length > 0 && empty(view.total.high) && view.notes.length === 0 && (
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  NOTHING LEFT FOR THESE MOVES TO CLEAR
                </span>
              )}
              {/* Keyed by slot, not by the sentence. `pick` allows the same
                  move twice - the SRD says so - and "Work on a Project" is the
                  only move the engine does not apply, so two of them produce
                  two identical strings. Keyed by the string, React is handed
                  two children with one key: it says so on the console and is
                  free to drop one of the two lines the commit will write. */}
              {view.notes.map((note, slot) => (
                <span
                  key={`${String(slot)}:${note}`}
                  className="t-meta"
                  style={{ color: 'var(--dim)' }}
                >
                  {note.toUpperCase()}
                </span>
              ))}
              {/* The cards are part of what this press will do, so they are in
                  the panel that says what it will do. Netted, and named by the
                  same two lists the log entry is built from. */}
              {moving > 0 && (
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  {moving === 1 ? '1 CARD WILL MOVE' : `${String(moving)} CARDS WILL MOVE`} WITH
                  THIS REST
                </span>
              )}
              {/* The die, not a number. The app has not rolled it - the log
                  says the real one afterwards - and the flat half comes back
                  from `takeRest` with the die suppressed rather than being
                  added up a second time here. */}
              <div className="spread" style={{ flex: 'none' }}>
                <span className="t-label">GM gains</span>
                <span className="t-num">
                  1D4{view.total.fearFlat > 0 ? ` + ${String(view.total.fearFlat)}` : ''} FEAR
                </span>
              </div>
              {view.total.fearFlat > 0 && (
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  THE + {view.total.fearFlat} IS THE PARTY SIZE SET ON THIS DEVICE
                </span>
              )}
            </div>

            <div className="stack" style={{ flex: 'none', gap: 6 }}>
              <div className="spread" style={{ flex: 'none' }}>
                <span className="t-hint" style={{ fontWeight: 600 }}>Cards move free during this rest</span>
                <span className="t-meta" style={{ color: 'var(--muted)' }}>
                  {staged.loadout.length} / 5 HELD
                </span>
              </div>
              {loadout.map((card) => (
                <SwapRow
                  key={card.id}
                  name={card.name}
                  accent={`var(--${card.domain})`}
                  act={{
                    action: 'TO VAULT',
                    price: null,
                    /* "to vault", not "to the vault": the chip says TO VAULT,
                       and a name that does not contain the words on the control
                       cannot be reached by saying them. */
                    label: `Move ${card.name} to vault, free during this rest`,
                    onAct: () => stage(card.id, 'vault'),
                  }}
                />
              ))}
              {/* A slot filled by a card this build cannot read. It gets a row
                  rather than a sentence pointing at another fold: the gate is
                  already counting it, moving it out is the only way a full
                  loadout can recall anything, and "MOVE THEM IN THE LOADOUT
                  FOLD" was false at 1180px and up, where `PlayDesktop` draws the
                  loadout as a bare column with no fold to open. The move itself
                  is the same `vaultCard` call, on a raw ref. */}
              {ghostLoadout.map((refId) => (
                <SwapRow
                  key={refId}
                  name={refId}
                  accent={null}
                  act={{
                    action: 'TO VAULT',
                    price: null,
                    label: `Move the unreadable card ${refId} to vault, freeing its slot`,
                    onAct: () => stage(refId, 'vault'),
                  }}
                />
              ))}
              {vault.map((card) => {
                // Against the staged sheet: a card sent to the vault a tap ago
                // has freed its slot in the rest being proposed, and a gate
                // reading the untouched sheet would refuse the recall with
                // "Loadout is full (5)" while showing four rows above it.
                const check = canAddToLoadout(staged, card, { downtime: true });
                return (
                  <SwapRow
                    key={card.id}
                    name={card.name}
                    accent={`var(--${card.domain})`}
                    act={{
                      action: check.allowed ? 'RECALL' : shortReason(check.reason),
                      price: check.allowed ? 'FREE' : null,
                      disabled: !check.allowed,
                      label: check.allowed
                        ? `Recall ${card.name} free during this rest`
                        : `${card.name} cannot be recalled: ${check.reason ?? 'unavailable'}`,
                      onAct: () => stage(card.id, 'loadout'),
                    }}
                  />
                );
              })}
              {/* A vault ghost has nowhere to go - nothing here knows what it
                  is, so nothing here can recall it - so it is a readout and not
                  a dead control. It is drawn because the alternative is a vault
                  of five that quietly shows three. */}
              {ghostVault.map((refId) => (
                <SwapRow key={refId} name={refId} accent={null} act={null} />
              ))}
              {staged.loadout.length === 0 && staged.vault.length === 0 && (
                <p className="t-read" style={{ margin: 0 }}>
                  This sheet is holding no cards, so there is nothing to move.
                </p>
              )}
            </div>

            {/* THE FACES, AND THE PRESS THEY FILL IN, IN ONE PANEL. Last but
                one on the surface, because typing them is the last thing done
                before the press and a panel of numbers separated from the
                controls by the swap rows would be up to 50px a card away from
                the button it fills in. Drawn only when the switches allow
                typing, and only for dice the engine said it will roll. */}
            {affordance.canType && dice.length > 0 && (
              <div className="panel stack" style={{ flex: 'none', gap: 6, padding: '10px 11px' }}>
                <span className="t-hint" style={{ fontWeight: 600 }}>Type what the table rolled</span>
                {dice.map((d) => (
                  <div key={d.key} className="row" style={{ flex: 'none', gap: 8 }}>
                    <span
                      className="t-meta"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        color: 'var(--text-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.name.toUpperCase()} · D{d.sides}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.face}
                      min={1}
                      max={d.sides}
                      placeholder={`1–${String(d.sides)}`}
                      aria-label={`The face the d${String(d.sides)} showed for ${d.name}`}
                      onChange={(e) => d.set(e.target.value)}
                      style={{ flex: 'none', width: 72, minHeight: 'var(--tap)', textAlign: 'center' }}
                    />
                  </div>
                ))}

                {/* A NUMBER NO DIE CAN SHOW, SAID OUT LOUD. A field holding 5
                    for a d4 - or a 0, which nothing shows - leaves the press
                    held back exactly as an empty field does, and an empty field
                    is self-explanatory where this is not: the player has typed
                    something and the app has silently declined it. So the
                    sentence names the die, the range it has, what the field
                    currently says, and the one thing that clears it. Same
                    construction as `DeathMove.tsx`'s, which had the same gap. */}
                {impossible.length > 0 && (
                  <p className="t-read" style={{ margin: 0 }}>
                    {impossible
                      .map(
                        (d) =>
                          `A d${String(d.sides)} shows 1 to ${String(d.sides)}, and ${d.name} says ${d.face.trim()}.`,
                      )
                      .join(' ')}{' '}
                    Correct it and the rest is yours to take.
                  </p>
                )}

                {/* THE TYPED ROAD'S OWN PRESS. Held back until every die has a
                    face it could have shown, and saying which ones it is
                    waiting for rather than only refusing - a rest can want
                    three, and "one more to go" three times is not an answer.
                    This is not the greyed-out ROLL `rollAffordance`'s docblock
                    forbids and this file's own refusal rule is about: that one
                    stands in for a capability the build does not have, where
                    this is waiting for a number somebody is in the middle of
                    typing, and it says so. `DeathMove.tsx`'s record button is
                    the same control for the same reason. */}
                <button
                  type="button"
                  onClick={() => commit(true)}
                  disabled={!typedReady}
                  className="btn btn-primary"
                  style={{ flex: 'none', minHeight: 56, width: '100%' }}
                >
                  {typedReady
                    ? `TAKE THE ${kind === 'short' ? 'SHORT' : 'LONG'} REST WITH ${dice
                        .map((d) => d.face.trim())
                        .join(' AND ')}`
                    : `STILL TO TYPE: ${outstanding.map((d) => d.name.toUpperCase()).join(' · ')}`}
                </button>
              </div>
            )}

            {/* Last on the surface, because it is the one control here that
                writes without being told a number first: the moves above it and
                the card moves above it are both proposals until it is pressed,
                and a control that applied half of what is drawn over it would
                be the worse of the two. It is drawn when the roller is on, and
                the sentence takes its place when nothing is on at all - with
                typed dice alone the press that writes is the panel's, directly
                under the faces it consumes. */}
            {(affordance.canRoll || affordance.blocked) && (
              <div
                className="stack"
                style={{ flex: 'none', gap: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}
              >
                {/* AND THE REFUSAL IS A SENTENCE, WHICH IS THIS FILE'S RULE AND
                    NOT A NEW ONE. With both switches off there is nothing on the
                    device that can produce the die this rest owes the GM, and a
                    greyed-out control still saying TAKE THE SHORT REST would say
                    the app could do this and will not. So the control is replaced
                    by the affordance's own two lines - the same words the roll
                    control uses, because a player who has read them once should
                    not have to learn a second phrasing here. Nothing else on the
                    surface is taken away: the moves, the party choice and the
                    staged swaps are all still chosen when the switch comes back. */}
                {affordance.blocked ? (
                  <div className="stack" style={{ flex: 'none', gap: 6 }}>
                    <span className="t-label" style={{ color: 'var(--damage)' }}>
                      {affordance.label}
                    </span>
                    <p className="t-read" style={{ margin: 0 }}>
                      Every rest owes the GM a Fear die, and this device has been told not to
                      roll one and not to take one. The moves and the cards you have chosen
                      stay chosen.
                    </p>
                    <span className="t-meta" style={{ color: 'var(--dim)' }}>
                      {affordance.prompt}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => commit(false)}
                    className="btn btn-primary"
                    style={{ flex: 'none', minHeight: 56, width: '100%' }}
                  >
                    TAKE THE {kind === 'short' ? 'SHORT' : 'LONG'} REST
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Disclosure>
  );
}

/**
 * One card, and the one thing this surface can do to it.
 *
 * The same row twice, because the two directions are the same gesture at the
 * same price: out of the loadout is always free and into it is free during a
 * rest, so drawing them differently would suggest one of them costs something.
 * The refusal takes the shape `RecallButton` already uses - the reason printed
 * where the price would be, `disabled`, never a `title` attribute and never
 * 55% opacity - because a touchscreen has no hover and that is P3-9(a).
 *
 * A name and an accent rather than a `DomainCard`, because a ref this build
 * cannot read is still something the sheet is holding and still has to be
 * drawn. It gets the raw ref as its name - the only thing anybody has to go on
 * - a dashed edge instead of a domain stripe, and NOT IN BUILD where the colour
 * would have said which domain it is. `act` is null when there is nothing to be
 * done to it: a vault ghost cannot be recalled, because nothing here knows what
 * it is, and a row with no control is a readout rather than a dead button -
 * which is the same rule the refusal follows, for the opposite reason.
 */
function SwapRow({
  name,
  accent,
  act,
}: {
  /** The card's name, or the raw ref when this build cannot resolve it. */
  name: string;
  /** The domain stripe, or null for a ref that resolves to nothing. */
  accent: string | null;
  act: {
    action: string;
    /** The second line of the chip. Null when the first line is a refusal. */
    price: string | null;
    label: string;
    disabled?: boolean;
    onAct: () => void;
  } | null;
}): React.JSX.Element {
  const ghost = accent === null;
  return (
    <div className="row" style={{ flex: 'none', gap: 6 }}>
      <span
        className="row"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          gap: 8,
          borderRadius: 'var(--r3)',
          background: 'var(--app)',
          border: ghost ? '1px dashed var(--edge)' : '1px solid var(--line-soft)',
          borderLeft: ghost ? '1px dashed var(--edge)' : `4px solid ${accent}`,
          padding: '0 11px',
        }}
      >
        {ghost && (
          <span className="t-meta" style={{ flex: 'none', color: 'var(--damage)' }}>
            NOT IN BUILD
          </span>
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            font: '600 0.8125rem/1.15 var(--sans)',
            color: ghost ? 'var(--dim)' : 'var(--text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
      </span>
      {act !== null && (
        <button
          type="button"
          onClick={act.onAct}
          disabled={act.disabled === true}
          aria-label={act.label}
          className="stack"
          style={{
            flex: 'none',
            minWidth: 84,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            borderRadius: 'var(--r3)',
            background: act.disabled === true ? 'transparent' : 'var(--raised)',
            border: `1px solid ${act.disabled === true ? 'var(--line-soft)' : 'var(--line)'}`,
            padding: '0 8px',
          }}
        >
          <span
            className="t-meta"
            style={{
              color: act.disabled === true ? 'var(--damage)' : 'var(--text)',
              fontWeight: 700,
            }}
          >
            {act.action}
          </span>
          {act.price !== null && (
            <span className="t-meta" style={{ color: 'var(--hope)' }}>
              {act.price}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
