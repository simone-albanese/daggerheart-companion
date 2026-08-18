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
 * vault rows at 52), a slot's clear control 44x44, the party toggle 44, COMMIT
 * 56x369 because it is the only irreversible thing here, and the swap chips
 * 44x84. Nothing declares a width or a minWidth above 84px, so the column is
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
 * READ VERSUS TOUCH. Touched: three controls before a kind is chosen, up to
 * eighteen after. Read and never touched: the SRD's own move text, at
 * `t-read` - 13px/1.45, the size that exists in this stylesheet for prose
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
}

interface View {
  moves: MoveView[];
  /** The rest as it stands, against the character as it stands. */
  total: Bracket;
  /** The engine's lines for whatever picked moves it does not apply. */
  notes: string[];
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
    notes: picks
      .map((id) => moves.find((m) => m.id === id))
      .filter((m): m is DowntimeMove => m !== undefined && !m.mechanical)
      .map((m) => run([m.id], 1).log[0] ?? ''),
    moves: moves.map((move) => ({
      move,
      bracket: bracket(before, [...before, move.id]),
      note: move.mechanical ? null : (run([move.id], 1).log[0] ?? null),
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
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [kind, setKind] = useState<RestKind | null>(null);
  const [picks, setPicks] = useState<DowntimeMoveId[]>([]);
  const [withParty, setWithParty] = useState(false);
  const [swaps, setSwaps] = useState<Swap[]>([]);

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
        : buildView(staged, stats, kind, picks, withParty, partySize),
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
  const preparing = picks.some((id) => PREPARE.includes(id));

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

  const chooseKind = (next: RestKind): void => {
    if (next === kind) return;
    // The lists are different and `takeRest` refuses a move from the other one
    // out loud. Carrying picks across would leave two slots holding moves that
    // are not on the screen, a preview bracketing to zero, and a commit that
    // writes "is not a long rest move - not applied" into an entry labelled
    // Long rest.
    setKind(next);
    setPicks([]);
    setWithParty(false);
  };

  const pick = (id: DowntimeMoveId): void => {
    setPicks((current) => (current.length < 2 ? [...current, id] : [current[0]!, id]));
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

  const commit = (): void => {
    if (kind === null) return;
    const choices: DowntimeChoice[] = picks.map((move) => ({ move, withParty }));
    // Against the staged sheet, so the one press applies the rest and the card
    // moves that are free *because of* it, in one write and one entry.
    const outcome = takeRest(staged, stats, kind, choices, { partySize }, rng);
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
    setKind(null);
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
        font: '700 13px/1 var(--sans)',
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
            <span className="t-label">If it was interrupted</span>
            {quoted(interruptedRestRule(rules)!)}
            {/* Pointing at the short rest is only honest while the short rest
                is drawn, and at three in a row the `!longDue &&` on the SHORT
                REST button in the "Which rest" group above has deliberately
                taken it away. The two conditions are independent, so the
                sentence reads the same flag the control does rather than
                assuming it. */}
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {longDue
                ? 'THE APP CANNOT TELL · WITH A LONG REST DUE THE SHORT ONE IS NOT ON THIS SCREEN'
                : 'THE APP CANNOT TELL · THE SHORT REST ABOVE APPLIES EXACTLY THAT'}
            </span>
          </div>
        )}

        {kind !== null && view !== null && (
          <>
            <div className="stack" style={{ flex: 'none', gap: 6 }}>
              {view.moves.map(({ move, bracket, note }) => {
                const chosen = picks.filter((id) => id === move.id).length;
                const slotSaid =
                  picks.length < 2
                    ? `as your ${picks.length === 0 ? 'first' : 'second'} move`
                    : `as your second move, replacing ${nameOf(picks[1]!)}`;
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
                        font: '600 12px/1.15 var(--sans)',
                        color: 'var(--text-2)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nameOf(held)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicks((current) => current.filter((_, i) => i !== slot))}
                      aria-label={`Take ${nameOf(held)} out of move ${slot + 1}`}
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
                <span className="t-label">Cards move free during this rest</span>
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

            {/* Last on the surface, because it is the only thing here that
                writes: the moves above it and the card moves above it are both
                proposals until this is pressed, and a control that applied half
                of what is drawn over it would be the worse of the two. */}
            <div
              className="stack"
              style={{ flex: 'none', gap: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}
            >
              <button
                type="button"
                onClick={commit}
                className="btn btn-primary"
                style={{ flex: 'none', minHeight: 56, width: '100%' }}
              >
                TAKE THE {kind === 'short' ? 'SHORT' : 'LONG'} REST
              </button>
            </div>
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
            font: '600 13px/1.15 var(--sans)',
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
