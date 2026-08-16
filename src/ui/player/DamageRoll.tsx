/**
 * The damage roll, offered after the attack roll that earned it.
 *
 * *"On a successful attack, roll damage."* The engine has been able to do this
 * correctly since the first commit and `rollDamage` has never had a caller
 * outside its own tests, so no screen in this app has ever rolled damage. This
 * is the caller.
 *
 * It is its own file for two reasons, and both are load-bearing.
 *
 * The first is that this row asks `damageOffer` for the verdict and never reads
 * `attack.succeeded` itself. That is not fastidiousness: `succeeded` has three
 * values, and the third is `null`, which the engine returns on purpose when the
 * GM has not shared the Difficulty. An `if (attack.succeeded)` here reads that
 * null as a miss and silently removes the whole feature from every table that
 * keeps its Difficulties hidden - one character of sloppiness that looks like a
 * design decision rather than a bug. Written inside `DualityRoll` the temptation
 * is right there, next to a `DualityResult` that has the field on it.
 *
 * The second is mechanical. `tests/ui/rollAffordance.test.ts` reads
 * `DualityRoll.tsx` as text and asserts exactly four `<Die`, exactly two
 * `editable={canType}` and exactly two `disabled={!canRoll}`. Those counts are
 * how that file proves neither layout has gone back to deciding for itself what
 * the dice switches allow. A damage control living in that file would push
 * every one of those numbers up and the proof would have to be loosened.
 *
 * It offers and never applies. There is no adversary on this screen, so
 * "applying" damage could only mean printing a total and writing a log line;
 * the number reaches the GM by being read aloud. So this imports neither
 * `update` nor `engine/damage.ts`, and the character record is untouched by
 * every path through it.
 */
import { useState } from 'react';
import { formatDamage, rollDamage, type DamageResult } from '../../engine/dice.ts';
import { useApp } from '../../store/state.ts';
import {
  damageArithmetic,
  damageLogEntry,
  damageOffer,
  isRollableDamage,
  type ArmedAttack,
} from './attack.ts';
import type { RollAffordance } from './DualityRoll.tsx';

interface DamageRowProps {
  /**
   * The attack this damage would follow, snapshotted at the instant it
   * resolved. Null before any roll, and for a bare trait roll - a persuasion
   * check, a saving throw - which carries no source and is offered no damage.
   */
  attack: ArmedAttack | null;
  /** The one dice decision both halves of a roll read, so they cannot disagree. */
  affordance: RollAffordance;
  layout: 'desktop' | 'phone';
}

/**
 * Something to say where a control would be.
 *
 * A miss, a reaction roll and an unrollable pool all draw text and no target.
 * That is the point rather than an omission: a blank where a button was is an
 * absence the screen never admits to, and a button still carrying the word
 * DAMAGE with `disabled` on it says the app could roll this and won't. Nothing
 * to press means nothing that has to clear the 44px floor, so these two lines
 * cost 31px instead of 52.
 */
/**
 * One damage die, as a slot you type into.
 *
 * `Die`'s idiom, parameterised. `Die` itself cannot be reused: its grid is
 * hardcoded to twelve faces because a Duality die is always a d12, and this one
 * has to draw four, six, eight, ten, twelve or twenty. It also lives in a file
 * whose `<Die` occurrences are counted by `rollAffordance.test.ts`, so calling
 * it from here would move a number that is load-bearing somewhere else.
 *
 * The parity that is kept is the one that matters at the table: a slot opens
 * into a grid of faces and closes by picking one, exactly as the Hope and Fear
 * dice do, so a table entering physical dice learns one gesture and not two.
 * The parity that is kept and is not ideal is that there is no way out of an
 * accidentally opened grid except picking a value - which is `Die`'s behaviour
 * too, and inventing a cancel here and not there would be worse than the
 * shortcoming. It is written down in BACKLOG.md rather than diverging quietly.
 */
function FaceSlot({
  index,
  count,
  value,
  onOpen,
}: {
  index: number;
  count: number;
  value: number | null;
  onOpen: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Damage die ${index + 1} of ${count}${value === null ? ', not entered' : `, showing ${value}`}`}
      style={{
        // Grows to fill the row, never below the touch floor: two slots on a
        // 369px column are 182 wide each and eight are 44, which is the point
        // at which they wrap rather than shrink.
        flex: '1 1 44px',
        minWidth: 'var(--tap)',
        minHeight: 'var(--tap)',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        border: `1px solid ${value === null ? 'var(--line-soft)' : 'var(--damage)'}`,
        font: '800 15px/1 var(--sans)',
        color: value === null ? 'var(--dim)' : 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value ?? '—'}
    </button>
  );
}

function Refusal({ label, detail }: { label: string; detail: string }): React.JSX.Element {
  return (
    <div className="stack" style={{ flex: 'none', gap: 5, padding: '4px 2px 2px' }}>
      <span className="t-meta" style={{ color: 'var(--muted)', fontWeight: 700 }}>
        {label}
      </span>
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        {detail}
      </span>
    </div>
  );
}

export function DamageRow({ attack, affordance, layout }: DamageRowProps): React.JSX.Element | null {
  const pushLog = useApp((s) => s.pushLog);
  const [result, setResult] = useState<DamageResult | null>(null);
  /*
   * The second tap, and why a re-roll needs one.
   *
   * This control is the last thing in the phone's pinned block, hard against
   * the bottom edge - the easiest point on the glass to reach, which is right
   * for the tap that rolls and wrong for every tap after it. There is no log
   * surface on a phone at all (`RecentLog` renders only in the desktop branch),
   * so a stray thumb would replace the number the player just read to the GM
   * with a different one and leave no record on screen that it had. The Vault's
   * recall already solves this shape: the first tap arms, the button says what
   * the second one will replace, and the second one does it.
   */
  const [confirming, setConfirming] = useState(false);
  /*
   * The faces, for a table rolling real dice, and which slot is open.
   *
   * Sized off the pool at render rather than in an effect: the pool is a
   * property of the attack this row was keyed on, so there is nothing to
   * synchronise, and an effect that resized an array would be a second place
   * for the count to live.
   */
  const [faces, setFaces] = useState<(number | null)[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  if (attack === null) return null;

  const offer = damageOffer(attack);
  const pool = attack.source.damage;
  const spec = formatDamage(pool);

  // A miss and a reaction roll, in words. `damageOffer` owns both rules and the
  // ordering between them; this only draws the answer.
  if (!offer.show) return <Refusal label={offer.label} detail={offer.detail} />;

  /*
   * A pool the engine cannot roll. `parseDamage`'s regex is unanchored, so a
   * homebrew weapon written `d0` parses to a one-die, zero-sided pool that
   * `rollDamage` would happily "roll" into a column of zeroes. It is refused
   * here rather than rolled, and it says which part of it is impossible.
   */
  if (!isRollableDamage(pool)) {
    return (
      <Refusal
        label={`NO DAMAGE · ${spec}`}
        detail="That is not a pool of dice: it needs at least one die of at least two faces."
      />
    );
  }

  /*
   * Neither switch is on, so nothing here can take a damage roll at all.
   *
   * It still says what to roll, which is the whole of what it knows, and it
   * names the way out the way the ROLL bar does rather than presenting the
   * offer as a control - a button promising a roll this build cannot make is
   * the exact failure `rollAffordance`'s docblock is written against.
   */
  if (!affordance.canRoll && !affordance.canType) {
    return (
      <Refusal
        label={offer.label}
        detail="Digital and typed dice are both off, so this one is yours to roll — Settings turns one on."
      />
    );
  }

  /*
   * One roll, however it was made.
   *
   * Both routes end here so that there is exactly one place a damage total is
   * recorded: the log line and the number on the control cannot disagree,
   * because they are written by the same three lines. The faces are mirrored
   * back out of the result the way `resolve` mirrors Hope and Fear onto the
   * Duality dice - after a digital roll the slots show what was actually
   * rolled, so a row of dice a player has just read aloud is never sitting
   * beside a total that does not come from it.
   */
  const record = (rolled: DamageResult): void => {
    setResult(rolled);
    setFaces(rolled.dice);
    setConfirming(false);
    pushLog(damageLogEntry(attack, rolled));
  };

  const roll = (): void => {
    if (result !== null && !confirming) {
      setConfirming(true);
      return;
    }
    // `attack.critical` and not a recomputation from the faces. The critical
    // the player saw is the critical that pays; working it out a second time
    // here is how the two come to disagree.
    record(rollDamage(pool, { critical: attack.critical }));
  };

  const slots = Array.from({ length: pool.count }, (_, i) => faces[i] ?? null);

  /*
   * A face picked by hand, and what happens when the last one lands.
   *
   * `setDie`'s rule exactly: the roll resolves the moment every die has a
   * value, because a table that has typed all three dice has finished rolling
   * and asking them to confirm it would be a tap that means nothing. The
   * engine still does one hundred percent of the arithmetic - the faces go in
   * as `fixed` rather than being summed here - so there is no second route to
   * a damage total.
   *
   * It resolves again if a face is corrected after the fact, which is the
   * Duality dice's behaviour too. That is deliberate and it is not the stray
   * tap the confirm below guards against: this is a 44px target, two taps deep,
   * on a die a player is looking at.
   */
  const setFace = (index: number, value: number): void => {
    const next = slots.map((face, i) => (i === index ? value : face));
    setFaces(next);
    setEditing(null);
    const filled = next.filter((face): face is number => face !== null);
    if (filled.length === next.length) {
      record(rollDamage(pool, { critical: attack.critical, fixed: filled }));
    }
  };

  const phone = layout === 'phone';
  const verdict = attack.critical ? 'CRITICAL · ' : attack.succeeded === null ? 'IF IT HIT · ' : '';
  /*
   * A build that cannot roll says so on the control, rather than saying ROLL
   * DAMAGE in grey.
   *
   * `affordance.label` is the same word the Duality bar wears in this state -
   * ENTER YOUR DICE - because there is one instruction on this screen and both
   * halves of a roll have to give it. Taking `offer.label` here instead would
   * put a disabled button carrying the name of the thing it will not do at the
   * bottom of the block, which is the whole failure `rollAffordance` exists for.
   */
  const headline =
    result === null
      ? affordance.canRoll
        ? offer.label
        : affordance.label
      : confirming
        ? `ROLL AGAIN? · ${spec}`
        : `${verdict}DAMAGE · ${spec}`;
  const detail =
    result === null
      ? affordance.canRoll
        ? offer.detail
        : // The pool and the verdict, without the verb: `offer.label` carries
          // ROLL DAMAGE, and putting that under a disabled control is the same
          // sentence the headline above is refusing to say.
          `${verdict}${spec} · TYPE EACH DIE ABOVE`
      : confirming
        ? `TAP AGAIN TO REPLACE ${result.total}`
        : damageArithmetic(result);
  /*
   * The accessible name forks on `canRoll` first, and it has to.
   *
   * `disabled={!affordance.canRoll}` is on this control for the whole
   * typed-dice-only build, and the name used to fork on `result` first - so the
   * moment the last die landed it fell through to "Tap to roll it again." on a
   * button that is dead. The visible text was right the whole time (`DAMAGE ·
   * 2d8+2`, `6 + 7 +2 = 15`), which is what made it the worst version of this
   * bug: the only user who was given the instruction was the one who could not
   * see that there was nothing to press.
   *
   * What that build can actually do is what it is now told: correct a face
   * above, and `setFace` resolves the pool again. `confirming` is only on the
   * rollable side because only `roll` can set it, and only a live control can
   * call `roll`.
   */
  const name = affordance.canRoll
    ? result === null
      ? `Roll ${spec} damage${attack.critical ? ', with the critical bonus' : ''}${
          attack.succeeded === null ? ', if the attack hit' : ''
        }`
      : confirming
        ? `Roll ${spec} again, replacing ${result.total}`
        : `${result.total} damage. Tap to roll it again.`
    : result === null
      ? `Enter each of the ${spec} dice above`
      : `${result.total} damage, off the dice above. Change one to work it out again.`;

  const button = (
    <button
      type="button"
      onClick={roll}
      disabled={!affordance.canRoll}
      aria-label={name}
      style={{
        flex: 'none',
        // 52 and not 66: ROLL stays the tallest control in the block, so the
        // hierarchy reads by size alone, and 52 still clears the floor by 8.
        minHeight: phone ? 52 : 44,
        width: '100%',
        borderRadius: phone ? 'var(--r5)' : 'var(--r4)',
        background: confirming ? 'var(--fear-wash)' : 'var(--raised)',
        border: `1px solid ${result === null && !confirming ? 'var(--line)' : 'var(--damage)'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: phone ? '0 14px' : '0 12px',
      }}
    >
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4, textAlign: 'left' }}>
        <span style={{ font: `900 ${phone ? 15 : 13}px/1 var(--sans)`, color: 'var(--text)' }}>
          {headline}
        </span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {detail}
        </span>
      </span>
      {/* The number read across the table. 26px against ROLL's 30, because the
          Duality total is still the louder of the two: this one is the answer
          to a question the GM asked, not the verdict of the turn. */}
      <span
        style={{
          flex: 'none',
          font: `800 ${phone ? 26 : 22}px/1 var(--sans)`,
          color: 'var(--damage)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {result?.total ?? '—'}
      </span>
    </button>
  );

  // The common case, and the default install: the roller is on, typing is off,
  // and this row is one control. Nothing is wrapped around it that does not
  // have to be.
  if (!affordance.canType) return button;

  return (
    <div className="stack" style={{ flex: 'none', gap: 6 }}>
      {editing === null ? (
        /*
         * The dice, above the button.
         *
         * Above, because the button stays the last thing in the block and
         * therefore the lowest point on the glass: the slots are filled while
         * looking at them, and the control that ends the turn is the one that
         * wants the easiest reach.
         */
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {slots.map((face, i) => (
            <FaceSlot
              key={i}
              index={i}
              count={slots.length}
              value={face}
              onOpen={() => setEditing(i)}
            />
          ))}
        </div>
      ) : (
        /*
         * The faces of one die, in `Die`'s own grid at five across instead of
         * four - twenty of them is four rows this way and five the other, and
         * four rows is 197px of a phone's pinned block rather than 244.
         */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 3,
            padding: 6,
            borderRadius: 'var(--r4)',
            background: 'var(--app)',
            border: '1.5px solid var(--damage)',
          }}
        >
          {Array.from({ length: pool.sides }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFace(editing, n)}
              style={{
                minHeight: 'var(--control)',
                borderRadius: 'var(--r1)',
                background: n === slots[editing] ? 'var(--damage)' : 'var(--raised)',
                color: n === slots[editing] ? 'var(--app)' : 'var(--text)',
                font: '600 12px/1 var(--mono)',
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      {button}
    </div>
  );
}
