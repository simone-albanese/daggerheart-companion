/**
 * The dice a character's own features give them, on the screen where they are
 * spent.
 *
 * WHAT THIS IS FOR. The app already had a tray - pick a size, hold a die, arm
 * it into a Duality Roll - and for a die somebody hands you that is the right
 * shape and it is unchanged. What it could not do is hold a POOL: how many a
 * Seraph is given (their Spellcast trait, in d4s), how big a Bard's die has
 * grown (d6, d8 from level 5, d10 for a Wordsmith with `Epic Poetry`), how many
 * a Slayer may bank (their Proficiency) - or a die's FACE, which is the one
 * Prayer Dice cannot do without: they are rolled at the start of the session
 * and sit on the sheet showing what they came up, and you spend a die whose
 * number you already know.
 *
 * AND ONE OF THEM IS BOUGHT RATHER THAN HELD. A Warlock spends a Favor to roll
 * their Patron Die into an action roll, so there is no pool to keep and nothing
 * to put a face on: the die is paid for and goes into the roll's tray, where
 * every other loose die in this app already lives. That is `PaidDie` below, a
 * second shape rather than three more conditions on the first, and `cost` on
 * the pool is what picks between them. The payment and the die are one call -
 * `heldDice.ts::buy` - so this screen cannot spend a Favor and fail to hand
 * over the die, or hand one over for nothing.
 *
 * BOTH ROADS TO A FACE, because a table that rolls physical dice is not a table
 * that wants the app to roll for them. Every die can be rolled by the app or
 * typed in by hand, and the numeric entry is the same gesture `Counter` uses
 * for typing a track: tap the number, type it, SET.
 *
 * AND WHICH OF THE TWO ROADS IS OPEN IS NOT THIS FILE'S TO DECIDE. It offered
 * both unconditionally, `cryptoRng` and all, while the preference that chooses
 * between them was being set two screens away: Settings has a switch each and a
 * branch for the case where both are off, and Onboarding's third answer -
 * "Real dice, and the app stays out of it" - writes exactly that. A table that
 * had said the app stays out of it still got a **Roll it** button here, and a
 * die it rolled for them. So both call sites read `rollAffordance` now, which
 * is the one place this app answers "what may this surface offer": the roller
 * is `canRoll`'s, the numeric entry is `canType`'s, and with neither switched
 * on the sheet keeps the pool and its dice and says which switch is missing
 * rather than inventing a face. Taking the button away must not take the pool
 * away - a pool that arrives rolled hands out its blank dice instead, and a
 * player who rolled on the table types what they showed.
 *
 * AND IT ASKS WHO BEFORE IT WRITES ANYTHING. Prayer Dice are spent "to aid
 * yourself **or an ally within Far range**", so "gain Hope equal to the result"
 * is only sometimes about the sheet this device is holding. An app that
 * silently added the Hope to the character in front of it would be writing the
 * wrong sheet every time the die was for somebody else, and nothing on screen
 * would have said so. So a pool the rules let you aim asks first, and when the
 * answer is the ally it applies NOTHING and just shows the number to read out.
 * `engine/dicePools.ts` carries that distinction as `beneficiary`.
 *
 * NOTHING HERE DECIDES A RULE. The sizes, the counts and the caps come out of
 * `poolsFor`; what a spent die may be used for is the SRD's own sentences,
 * rendered; and the only two the app offers to apply are the two that are
 * unambiguous arithmetic on a track it owns - "gain Hope equal to the result"
 * and "clear a number of Stress equal to the result".
 */
import { useMemo, useState } from 'react';
import { cryptoRng } from '../../engine/dice.ts';
import {
  isFace,
  poolsFor,
  rollPool,
  type DicePool,
  type Spend,
} from '../../engine/dicePools.ts';
import type { DerivedStats } from '../../engine/character.ts';
import type { Character } from '../../../shared/types.ts';
import { useActive, useApp } from '../../store/state.ts';
import { MAX_HELD, useHeldDice, useHeldFor } from './heldDice.ts';
// The same helper the Duality Roll and the damage row read, and for the same
// reason: three surfaces deciding for themselves what the two dice switches
// mean is three answers that can disagree about what this build can do.
import { rollAffordance, type RollAffordance } from '../shared/rollAffordance.ts';
import { usePool, usePools, type PoolDie } from './poolStore.ts';

/** The pools this character has, or an empty list. Safe with no character. */
export function usePoolsFor(stats: DerivedStats): DicePool[] {
  const character = useActive();
  const index = useApp((s) => s.index);
  return useMemo(
    () => (character === null ? [] : poolsFor(character, index, stats)),
    [character, index, stats],
  );
}

/** The touch floor, declared rather than inherited. */
const TAP = 44;

// ---------------------------------------------------------------------------

/**
 * One die, as a target.
 *
 * A face when it has one and its size when it does not, so the row reads as
 * "three d4s showing 3, 1 and 4" or "two blank d6s" without a legend. Tapping
 * it opens what you can do with it; there is no second gesture, because the
 * tray's press-and-hold discard would be the wrong verb here - a die in a pool
 * is spent or cleared at the end of a session, never thrown away mid-scene.
 */
function DieFace({
  die,
  pool,
  onOpen,
}: {
  die: PoolDie;
  pool: DicePool;
  onOpen: () => void;
}): React.JSX.Element {
  const rolled = die.face !== null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        rolled
          ? `${pool.name} showing ${String(die.face)} - tap to spend it or change it`
          : `An unrolled d${String(pool.sides)} of your ${pool.name} - tap to roll it or type it`
      }
      style={{
        flex: 'none',
        minWidth: TAP,
        minHeight: TAP,
        padding: '0 8px',
        borderRadius: 'var(--r3)',
        border: `1px solid ${rolled ? 'var(--hope)' : 'var(--line)'}`,
        background: rolled ? 'var(--hope-wash)' : 'transparent',
        color: rolled ? 'var(--text)' : 'var(--muted)',
        font: rolled ? '800 20px/1 var(--sans)' : '600 12px/1 var(--sans)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rolled ? die.face : `d${pool.sides}`}
    </button>
  );
}

/**
 * What you may do with one die, and the only place this component writes a
 * track.
 *
 * The order is deliberate: WHO first when the rules let you aim, because it
 * decides whether anything may be written at all; then the number; then the
 * uses, with the applicable one as a button and the rest as the book's own
 * words. `SPESO` removes the die whether or not anything was applied, because
 * the die is gone either way and the app must not make "I did it by hand" a
 * state it cannot express.
 *
 * The two ways to a face are the affordance's to offer, not this sheet's. Only
 * the face is gated: who the die is for, what it may be spent on, and taking it
 * out of the pool are all things a player does with a die they already have,
 * and none of them is a roll.
 */
function SpendSheet({
  pool,
  die,
  characterId,
  affordance,
  onClose,
}: {
  pool: DicePool;
  die: PoolDie;
  characterId: string;
  affordance: RollAffordance;
  onClose: () => void;
}): React.JSX.Element {
  const setFace = usePools((s) => s.face);
  const spend = usePools((s) => s.spend);
  const update = useApp((s) => s.update);
  const [who, setWho] = useState<'self' | 'ally' | null>(
    pool.beneficiary === 'self' ? 'self' : null,
  );
  const [typing, setTyping] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const face = die.face;

  const apply = (kind: Spend['apply'], value: number): void => {
    if (kind === 'hope') {
      update((c) => ({
        ...c,
        // Hope is stored as AVAILABLE, unlike every other track. `Vitals` and
        // `syncCounters` both say so; writing it as "marked" here would spend
        // the Hope this die was meant to give.
        hope: { ...c.hope, marked: Math.min(c.hope.max, c.hope.marked + value) },
      }));
      setDone(`+${String(value)} Hope`);
    }
    if (kind === 'stress') {
      update((c) => ({
        ...c,
        stress: { ...c.stress, marked: Math.max(0, c.stress.marked - value) },
      }));
      setDone(`${String(value)} Stress cleared`);
    }
  };

  return (
    <div
      className="panel stack"
      style={{ flex: 'none', gap: 8, padding: '10px 11px', borderColor: 'var(--hope)' }}
    >
      <div className="spread">
        <span className="t-label">
          {face === null ? `An unrolled d${pool.sides}` : `${pool.name} · ${face}`}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="chip"
          style={{ flex: 'none', minWidth: TAP, minHeight: 'var(--control)', background: 'transparent', color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>

      {/* No face yet: the two ways to get one, which is the whole of what the
          owner asked for - «o inserendo i risultati o facendo tirare i dadi
          all'app». Which of the two is here is the switches' answer: it is one
          button for the two tables that picked one road, both for the table
          that wants both, and the line below instead of a control for the table
          that told the app to stay out of it. Each is `flex: '1 1 auto'`, so
          one of them fills the sheet rather than sitting half-width beside a
          gap where the other used to be. */}
      {face === null && typing === null && !affordance.canRoll && !affordance.canType && (
        <span className="t-hint" style={{ color: 'var(--text-2)' }}>
          Digital and typed dice are both off, so this one is yours to roll —
          Settings turns one on. The die keeps its place in the pool either way.
        </span>
      )}
      {face === null && typing === null && (affordance.canRoll || affordance.canType) && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {affordance.canRoll && (
            <button
              type="button"
              className="btn"
              style={{ flex: '1 1 auto', minHeight: TAP }}
              onClick={() => setFace(characterId, pool.id, die.id, cryptoRng(pool.sides))}
            >
              Roll it
            </button>
          )}
          {affordance.canType && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ flex: '1 1 auto', minHeight: TAP }}
              onClick={() => setTyping('')}
            >
              Type what you rolled
            </button>
          )}
        </div>
      )}

      {typing !== null && (
        <div className="row" style={{ gap: 6 }}>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={typing}
            min={1}
            max={pool.sides}
            placeholder={`1–${pool.sides}`}
            aria-label={`The face your d${String(pool.sides)} showed`}
            onChange={(e) => setTyping(e.target.value)}
            style={{ flex: 1, minWidth: 0, minHeight: TAP, textAlign: 'center' }}
          />
          <button
            type="button"
            className="btn"
            style={{ flex: 'none', minHeight: TAP, minWidth: 64 }}
            disabled={!isFace(pool, Number(typing))}
            onClick={() => {
              const n = Number(typing);
              if (!isFace(pool, n)) return;
              setFace(characterId, pool.id, die.id, n);
              setTyping(null);
            }}
          >
            SET
          </button>
        </div>
      )}

      {/* Who it is for, when the rules let you aim it. Asked BEFORE anything
          can be applied, and the ally branch applies nothing at all. */}
      {face !== null && pool.beneficiary === 'either' && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            WHO IS IT FOR?
          </span>
          <div className="row" style={{ gap: 6 }}>
            {(['self', 'ally'] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={who === w}
                className="chip"
                onClick={() => setWho(w)}
                style={{
                  flex: '1 1 auto',
                  minHeight: TAP,
                  background: who === w ? 'var(--hope)' : 'var(--raised)',
                  color: who === w ? 'var(--app)' : 'var(--muted)',
                }}
              >
                {w === 'self' ? 'Me' : 'An ally'}
              </button>
            ))}
          </div>
        </div>
      )}

      {face !== null && who === 'ally' && (
        <div className="t-hint" style={{ color: 'var(--text-2)' }}>
          Nothing is written here — their sheet is on their device. Read them the{' '}
          <strong>{face}</strong>, then mark the die spent.
        </div>
      )}

      {face !== null && who === 'self' && (
        <div className="stack" style={{ gap: 6 }}>
          {pool.spends.map((s) =>
            s.apply === null ? (
              <span key={s.text} className="t-read" style={{ color: 'var(--text-2)' }}>
                {s.text}
              </span>
            ) : (
              <button
                key={s.text}
                type="button"
                className="btn"
                style={{ minHeight: TAP, textAlign: 'left' }}
                onClick={() => apply(s.apply, face)}
              >
                {s.apply === 'hope' ? `Gain ${face} Hope` : `Clear ${face} Stress`}
              </button>
            ),
          )}
        </div>
      )}

      {done !== null && (
        <span className="t-meta" style={{ color: 'var(--hope)' }}>
          {done.toUpperCase()}
        </span>
      )}

      <button
        type="button"
        className="btn btn-ghost"
        style={{ minHeight: TAP }}
        onClick={() => {
          spend(characterId, pool.id, die.id);
          onClose();
        }}
      >
        Spent — take it out of the pool
      </button>
    </div>
  );
}

/** One pool: its numbers, its dice, and what the book says about it. */
function PoolBlock({
  pool,
  characterId,
  affordance,
}: {
  pool: DicePool;
  characterId: string;
  affordance: RollAffordance;
}): React.JSX.Element {
  const dice = usePool(characterId, pool.id);
  const setPool = usePools((s) => s.set);
  const bank = usePools((s) => s.bank);
  const clear = usePools((s) => s.clear);
  const [open, setOpen] = useState<string | null>(null);

  const openDie = dice.find((d) => d.id === open) ?? null;
  const banked = pool.granted === null;

  /** The start-of-session roll, for a pool whose dice arrive already rolled. */
  const rollAll = (): void => {
    const count = Math.min(pool.granted ?? 0, pool.cap);
    const faces = rollPool(pool, count, cryptoRng);
    setPool(
      characterId,
      pool.id,
      faces.map((face) => ({ id: crypto.randomUUID(), face })),
    );
  };

  /** Hand out the blank dice a spend-rolled pool starts a session with. */
  const seed = (): void => {
    const count = Math.min(pool.granted ?? 0, pool.cap);
    setPool(
      characterId,
      pool.id,
      Array.from({ length: count }, () => ({ id: crypto.randomUUID(), face: null })),
    );
  };

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread">
        <span style={{ font: '700 14px/1.2 var(--sans)' }}>{pool.name}</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          d{pool.sides} · {dice.length}
          {pool.granted !== null ? ` / ${String(Math.min(pool.granted, pool.cap))}` : ` / ${String(pool.cap)}`}
        </span>
      </div>
      <span className="t-meta" style={{ color: 'var(--dim)', letterSpacing: '0.05em' }}>
        {pool.source.toUpperCase()}
        {pool.dropLowest && ' · ROLLS ONE EXTRA AND DROPS THE LOWEST'}
      </span>

      {dice.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {dice.map((d) => (
            <DieFace key={d.id} die={d} pool={pool} onOpen={() => setOpen(d.id)} />
          ))}
        </div>
      )}

      {openDie !== null && (
        <SpendSheet
          pool={pool}
          die={openDie}
          characterId={characterId}
          affordance={affordance}
          onClose={() => setOpen(null)}
        />
      )}

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {/* A pool whose dice arrive rolled gets one button that rolls the lot,
            because that is literally what the feature says to do at the start
            of a session. One that arrives blank gets its dice handed out.

            WITH THE ROLLER OFF IT GETS THE SECOND BUTTON RATHER THAN NEITHER.
            "At the start of each session, roll your Prayer Dice" is still what
            the feature says; what changes is who rolls them, and a table
            rolling their own needs the dice on the sheet to type the faces
            onto. So the pool is handed out blank and each die is typed - which
            is the gesture that pool already has, since a spend-rolled pool
            arrives blank for everybody. `dropLowest` needs no special case: the
            player rolls the extra die and drops the lowest on the table, and
            what they type in is the set they kept, which is `count`.

            AND ALL THREE OF THEM ARE `dice.length === 0`, WHICH TWO OF THEM
            WERE NOT. `rollAll` and `seed` both call `setPool` with a freshly
            built array, so either one pressed a second time replaces the pool
            outright - and the second press is not hypothetical, because the
            button stayed on the screen after the pool had been handed out, in a
            row directly under the dice it had just made. Driven with a Divine
            Wielder's Prayer Dice - `rolledAt: 'grant'`, two d4 - and the roller
            off: hand out, type 3 and 4 onto the two dice, press the button
            again, and both faces are gone with nothing said. The spend-rolled
            sibling had the guard from the start; the way back to a fresh pool
            is `Clear the pool`, which is drawn exactly when there is a pool to
            clear, so nothing is lost by taking the second press away. */}
        {!banked && pool.rolledAt === 'grant' && affordance.canRoll && dice.length === 0 && (
          <button
            type="button"
            className="btn"
            style={{ flex: '1 1 auto', minHeight: TAP }}
            disabled={pool.cap === 0}
            onClick={rollAll}
          >
            Roll {Math.min(pool.granted ?? 0, pool.cap)} d{pool.sides}
          </button>
        )}
        {!banked && pool.rolledAt === 'grant' && !affordance.canRoll && dice.length === 0 && (
          <button
            type="button"
            className="btn"
            style={{ flex: '1 1 auto', minHeight: TAP }}
            disabled={pool.cap === 0}
            onClick={seed}
          >
            Take your {pool.name}
          </button>
        )}
        {!banked && pool.rolledAt === 'spend' && dice.length === 0 && (
          <button
            type="button"
            className="btn"
            style={{ flex: '1 1 auto', minHeight: TAP }}
            disabled={pool.cap === 0}
            onClick={seed}
          >
            Take your {pool.name}
          </button>
        )}
        {banked && (
          <button
            type="button"
            className="btn"
            style={{ flex: '1 1 auto', minHeight: TAP }}
            disabled={dice.length >= pool.cap}
            onClick={() => bank(characterId, pool.id, pool.cap)}
            aria-label={`Bank a d${String(pool.sides)} in your ${pool.name}`}
          >
            + Bank a d{pool.sides}
          </button>
        )}
        {dice.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ flex: '1 1 auto', minHeight: TAP }}
            onClick={() => clear(characterId, pool.id)}
          >
            Clear the pool
          </button>
        )}
      </div>

      {pool.cap === 0 && (
        <span className="t-hint" style={{ color: 'var(--dim)' }}>
          This pool is empty by the numbers on this sheet — a Spellcast trait of
          zero or lower grants no dice, and a subclass this build cannot read
          has no Spellcast trait at all.
        </span>
      )}

      {/* The feature, verbatim, under the thing it governs. The pool does four
          of the things this paragraph describes and the player does the rest,
          so the paragraph has to be here rather than a fold away. */}
      <span className="t-read" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
        {pool.rule}
      </span>
    </div>
  );
}

/**
 * A pool you buy from one die at a time, drawn as the purchase it is.
 *
 * THE WARLOCK'S PATRON DIE IS NOT THE OTHER THREE, and giving it a `PoolBlock`
 * with three extra conditions on it would have been the wrong economy. There is
 * nothing to hand out at the start of a session, nothing to bank, nothing to
 * clear at the end and no die sitting on the sheet with a face on it: *"you can
 * spend a Favor to call upon their aid, rolling your Patron Die and adding its
 * result to the total"* is one Favor, one die, at the moment of one roll. So
 * `poolStore` never sees it. It goes into the roll's own tray, which is where
 * "adding its result to the total" happens on this app - and it gets there
 * through `heldDice.ts::buy`, which takes the charge as an argument so that the
 * payment and the die cannot come apart. That docblock is the argument; this
 * one is what the player sees.
 *
 * ## The die lands in the tray, and the screen says exactly that
 *
 * It does not land ARMED. `DualityRoll` keeps its own `armedDice` list, every
 * held die starts off it, and the player taps the chip to put it in the roll.
 * A Patron Die is a held die like the rest once it has been paid for, so it
 * takes the same tap - and the confirmation line says so rather than claiming a
 * total this component cannot see. Wording it "in your next roll" would have
 * been a claim the roll panel disproves one tap later.
 *
 * ## Nothing here is gated on the two dice switches, and that is deliberate
 *
 * Buying a die is not rolling one. `PoolBlock` above reads `rollAffordance`
 * because it puts FACES on dice; this block puts a die in a tray, which is what
 * the tray's own `+ DIE` control does for every table, roller on or off. A
 * table rolling real dice spends the Favor, picks up their own d6 and types the
 * face into the roll panel, which is a road that already exists.
 *
 * ## Ergonomics: one target, and it keeps its place when it is refused
 *
 * One touch target in the whole block, at the 44px floor `TAP` declares and
 * full width like every other control in this fold; everything else is read.
 * With no Favor the button is DISABLED AND STAYS PUT, with the reason under it,
 * rather than being taken away - which is the opposite of what
 * `rollAffordance` argues for the roller, and the difference is what the player
 * can do about it. A greyed ROLL says the app could roll and won't, and the
 * remedy is two screens away in Settings; a greyed **Spend a Favor** says
 * exactly what is true, that the app would call the patron and there is nothing
 * to pay with, and the remedy is on the sheet within the hour. A control that
 * vanished at zero would move the whole block every time a Favor was spent, on
 * a fold the player is reaching past to get to the roll.
 *
 * ## Two guards behind one disabled attribute, and neither is dead code
 *
 * `disabled` is the affordance; `spendAFavor`'s check on the track and `buy`'s
 * check on the room are the invariants. The same shape is already in this file
 * - `SET` is `disabled={!isFace(...)}` AND its handler opens with `if
 * (!isFace(pool, n)) return;`. The two layers answer different questions: what
 * a player may reach for, and what may be written. A screen with only the first
 * is one refactor away from spending a Favor nothing checked for.
 *
 * The honest cost: with the control shut at zero, no test can drive a click
 * into the refusing branch, because the DOM does not dispatch a click on a
 * disabled button. `setBought` sits behind `buy`'s return value for the same
 * reason - a confirmation must never outlive a purchase that did not happen -
 * and that branch is unreachable from this screen today as well. Both are
 * proved at the store instead, in `tests/ui/heldDice.test.ts`, where a refusal
 * is a first-class case rather than a state an affordance is preventing.
 */
function PaidDie({
  pool,
  character,
}: {
  pool: DicePool;
  character: Character;
}): React.JSX.Element {
  const buy = useHeldDice((s) => s.buy);
  const update = useApp((s) => s.update);
  const held = useHeldFor(character.id);
  /**
   * The Favor left at the moment of the last purchase, or null before one.
   *
   * A NUMBER AND NOT A BOOLEAN, because a confirmation is a report of an event
   * and has to be frozen at it. Rendered from the live track, the line kept
   * updating: buy at three, the sheet says `2 FAVOR LEFT`, then a downtime
   * tribute puts the track back to five and the same sentence now reads `TAKEN
   * ... 5 FAVOR LEFT` about a purchase that left two. Nothing in this branch
   * raises Favor yet - the track's own controls are another lane's - which is
   * exactly why it is worth fixing before that lane lands rather than after.
   */
  const [leftAfterBuying, setLeftAfterBuying] = useState<number | null>(null);

  const favor = character.favor.marked;
  const full = held.length >= MAX_HELD;

  /*
   * Read from the store and not from the prop this component rendered with.
   * The prop is a snapshot, and the charge has to be decided against the sheet
   * as it is when the button is pressed - `buy` calls this back synchronously,
   * so "how much Favor is there" and "take one" have to be the same read.
   */
  const spendAFavor = (): boolean => {
    const live = useApp.getState().characters.find((c) => c.id === character.id);
    if (live === undefined || live.favor.marked <= 0) return false;
    update((c) => ({ ...c, favor: { ...c.favor, marked: Math.max(0, c.favor.marked - 1) } }));
    return true;
  };

  return (
    <div className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread">
        <span style={{ font: '700 14px/1.2 var(--sans)' }}>{pool.name}</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          d{pool.sides} · 1 FAVOR
        </span>
      </div>
      <span className="t-meta" style={{ color: 'var(--dim)', letterSpacing: '0.05em' }}>
        {pool.source.toUpperCase()}
      </span>

      <button
        type="button"
        className="btn"
        style={{ flex: '1 1 auto', minHeight: TAP }}
        disabled={favor <= 0 || full}
        aria-label={`Spend a Favor to call on your patron and take a d${String(pool.sides)}. You hold ${String(favor)} Favor.`}
        onClick={() => {
          if (!buy(character.id, pool.sides, spendAFavor)) return;
          // Read after the charge, not before: this is what the purchase left.
          const live = useApp.getState().characters.find((c) => c.id === character.id);
          setLeftAfterBuying(live?.favor.marked ?? 0);
        }}
      >
        Spend a Favor · take a d{pool.sides}
      </button>

      {/* WHAT JUST HAPPENED, THEN WHY IT CANNOT HAPPEN AGAIN, in that order.
          Written the other way round first, and it was wrong on the screen:
          spending the last Favor put "No Favor to spend" BETWEEN the button and
          the confirmation of the tap that had just emptied the track, so the
          answer to the gesture was two paragraphs below the gesture with an
          unrelated refusal in the gap. Measured in Chrome at 393px wide - the
          block is 190px at rest, 218px with the confirmation, 274px with both. */}
      {leftAfterBuying !== null && (
        <span className="t-meta" style={{ color: 'var(--hope)' }}>
          TAKEN · A D{pool.sides} IS IN YOUR ROLL&apos;S DICE TRAY · TAP IT THERE TO
          ADD IT TO THE ROLL · {leftAfterBuying} FAVOR LEFT
        </span>
      )}
      {favor <= 0 && (
        <span className="t-hint" style={{ color: 'var(--dim)' }}>
          No Favor to spend, so there is nothing to call on. Show tribute to
          your patron with a downtime move to gain Favor equal to your Spellcast
          trait, or take one instead of a Hope when you succeed with Hope.
        </span>
      )}
      {favor > 0 && full && (
        <span className="t-hint" style={{ color: 'var(--dim)' }}>
          The roll is already holding {MAX_HELD} dice. Take one out down there
          first — a Favor spent on a die with nowhere to go is a Favor gone.
        </span>
      )}

      {/* The feature, verbatim, for the same reason `PoolBlock` prints one: the
          app does one of the things this paragraph describes and the player
          does the rest, including the part about the patron's sphere of
          influence, which is a conversation and not a control. */}
      <span className="t-read" style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>
        {pool.rule}
      </span>
    </div>
  );
}

/**
 * The section, drawn only for a character who has a pool at all.
 *
 * Returning null rather than an empty heading is what keeps this free for the
 * great majority of sheets: `PlayPhone`'s column has thirteen pixels of slack
 * at 375x667 and a fold costs fifty-two, so a Ranger must not be charged for a
 * Seraph's dice. `playSheet.test.tsx` asserts both halves.
 */
export function DicePools({ stats }: { stats: DerivedStats }): React.JSX.Element | null {
  const character = useActive();
  const pools = usePoolsFor(stats);
  const clearAll = usePools((s) => s.clearAll);
  const update = useApp((s) => s.update);
  const byCharacter = usePools((s) => s.byCharacter);
  /*
   * Read once here and handed down, rather than subscribed to in each of the
   * two components that need it. Every pool on the sheet is answering the same
   * two switches, and a `PoolBlock` that read them for itself would be a second
   * place this decision is made - which is the shape of the defect this is
   * fixing, not a smaller version of the fix.
   */
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);
  const affordance = rollAffordance(digitalDice, manualDice);
  const [ended, setEnded] = useState<number | null>(null);
  if (character === null || pools.length === 0) return null;

  /*
   * What ending the session is worth, counted before it happens so the button
   * can say it. Only a pool whose feature pays for the clear contributes, and
   * only the dice actually on it right now.
   */
  const owed = pools
    .filter((p) => p.clearGrantsHope)
    .reduce((n, p) => n + (byCharacter[character.id]?.[p.id]?.length ?? 0), 0);

  return (
    <div className="stack" style={{ flex: 'none', gap: 14 }}>
      {/* Two shapes, on `cost`. A pool you are given is held in `poolStore`
          and spent out of it; a pool you buy from has nothing to hold, so it
          draws a purchase instead. `PaidDie` says why that is a second
          component rather than three more conditions inside the first. */}
      {pools.map((pool) =>
        pool.cost === null ? (
          <PoolBlock
            key={pool.id}
            pool={pool}
            characterId={character.id}
            affordance={affordance}
          />
        ) : (
          /*
           * KEYED ON THE CHARACTER AS WELL AS THE POOL. `PaidDie` holds the
           * last purchase in component state, and switching the active sheet
           * re-renders this list with the same `patron` key - so React kept the
           * instance and one Warlock's `TAKEN · 2 FAVOR LEFT` carried over onto
           * the next Warlock's sheet, about a die that character never bought.
           * A composite key makes the two sheets two components.
           */
          <PaidDie key={`${character.id}:${pool.id}`} pool={pool} character={character} />
        ),
      )}
      {/*
       * END OF SESSION, WHICH EVERY ONE OF THE THREE FEATURES ASKS FOR AND
       * NOTHING IN THIS APP HAS EVER DONE. "At the end of each session, clear
       * all unspent Rally Dice." "At the end of each session, clear all unspent
       * Prayer Dice." The Slayer's says it and then PAYS for it: "clear any
       * unspent Slayer Dice on this card and gain a Hope per die cleared".
       *
       * That last clause is applied, and it is applied rather than described
       * for the same reason `Gain N Hope` is a button above: it is unambiguous
       * arithmetic, on a track this device owns, for the character in front of
       * it. The button says how much before it is pressed, because a control
       * that silently moves Hope is the thing this app spends its docblocks
       * refusing to be.
       *
       * DRAWN ONLY WHEN SOMETHING IS ACTUALLY HELD BETWEEN SESSIONS, which
       * matters from the moment a pool arrived that holds nothing. A Warlock's
       * only pool is the Patron Die: it puts nothing in `poolStore`, so
       * `clearAll` empties an entry that was never written, `owed` is zero, and
       * the control would sit on their sheet all season doing nothing and
       * saying it had. A button that reports CLEARED after clearing nothing is
       * a worse lie than a missing button, and the sentence it comes from -
       * "At the end of each session, clear all unspent Rally Dice" - is not
       * written about this die anywhere in the book.
       */}
      {pools.some((p) => p.cost === null) && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ flex: 'none', minHeight: TAP }}
          onClick={() => {
            if (owed > 0) {
              update((c) => ({
                ...c,
                hope: { ...c.hope, marked: Math.min(c.hope.max, c.hope.marked + owed) },
              }));
            }
            clearAll(character.id);
            setEnded(owed);
          }}
        >
          End of session — clear every pool{owed > 0 ? ` (+${String(owed)} Hope)` : ''}
        </button>
      )}
      {ended !== null && (
        <span className="t-meta" style={{ color: 'var(--hope)' }}>
          {ended > 0 ? `CLEARED · +${String(ended)} HOPE` : 'CLEARED'}
        </span>
      )}
    </div>
  );
}
