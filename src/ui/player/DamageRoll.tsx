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
   * The roller is off, so this die is not the app's to roll.
   *
   * It still says what to roll, which is the whole of what it knows. What it
   * must not do is present the offer as a control - the label would be a button
   * promising a roll that this build cannot make, which is the exact failure
   * `rollAffordance`'s docblock is written against.
   */
  if (!affordance.canRoll) {
    return (
      <Refusal
        label={offer.label}
        detail="Digital dice are off, so this one is yours to roll."
      />
    );
  }

  const roll = (): void => {
    if (result !== null && !confirming) {
      setConfirming(true);
      return;
    }
    // `attack.critical` and not a recomputation from the faces. The critical
    // the player saw is the critical that pays; working it out a second time
    // here is how the two come to disagree.
    const rolled = rollDamage(pool, { critical: attack.critical });
    setResult(rolled);
    setConfirming(false);
    pushLog(damageLogEntry(attack, rolled));
  };

  const phone = layout === 'phone';
  const verdict = attack.critical ? 'CRITICAL · ' : attack.succeeded === null ? 'IF IT HIT · ' : '';
  const headline =
    result === null ? offer.label : confirming ? `ROLL AGAIN? · ${spec}` : `${verdict}DAMAGE · ${spec}`;
  const detail =
    result === null
      ? offer.detail
      : confirming
        ? `TAP AGAIN TO REPLACE ${result.total}`
        : damageArithmetic(result);
  const name =
    result === null
      ? `Roll ${spec} damage${attack.critical ? ', with the critical bonus' : ''}${
          attack.succeeded === null ? ', if the attack hit' : ''
        }`
      : confirming
        ? `Roll ${spec} again, replacing ${result.total}`
        : `${result.total} damage. Tap to roll it again.`;

  return (
    <button
      type="button"
      onClick={roll}
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
}
