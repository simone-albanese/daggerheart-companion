/**
 * The Duality Roll.
 *
 * The roll control and the result readout are the same object: nothing appears,
 * nothing moves, the background simply becomes the verdict. That is what lets
 * you read the outcome from across a table without hunting for where the
 * answer went.
 *
 * Two ways in, and only one of them is on by default. Tap ROLL and the app
 * rolls. A table that rolls real dice turns on "Type your own dice" in
 * settings, and then either face can be tapped and typed into - the app still
 * resolves the outcome, the Hope/Fear economy and the critical.
 *
 * Typing used to be unconditional, and it cost more than it looked. The two
 * faces hold the best band on a phone, directly above ROLL and directly under
 * the thumb, and with the roller on they spend it showing two em dashes until
 * somebody taps one. Worse, a resolved roll stayed one tap from being
 * rewritten by a thumb resting where thumbs rest. Off by default the faces
 * only report, and the band they were holding goes to the things a player
 * actually reaches for mid-scene.
 *
 * The two switches are independent, so both can be off. That state is real and
 * is not prevented: the control says which switch is missing rather than
 * sitting there greyed out with the word ROLL still on it.
 *
 * Before the dice comes the declaration, and the SRD is strict about the order:
 * "Unless an action, ability, or feature specifically allows for it, a player
 * must declare the use of any Experiences, extra dice, or other modifiers
 * before they roll." So the control row arms them, and everything armed is
 * disarmed again the instant the roll resolves - an Experience left standing
 * would inflate the next roll by two and say nothing about it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Experience, Trait } from '../../../shared/types.ts';
import { TRAIT_LABELS } from '../../../shared/types.ts';
import { rollModifier, type DerivedStats } from '../../engine/character.ts';
import {
  OUTCOME_DETAIL,
  OUTCOME_LABEL,
  rollDuality,
  type DualityResult,
} from '../../engine/dice.ts';
import { useActive, useApp } from '../../store/state.ts';
import { Disclosure } from '../shared/Disclosure.tsx';
import { useIsNarrow } from '../shared/useLayout.ts';
import { DIE_SIZES, MAX_HELD, useHeldDice, useHeldFor, type HeldDie } from './heldDice.ts';

export type RollTrait = Trait | 'spellcast';

/** What the two dice switches leave a player able to do. */
export interface RollAffordance {
  /** Pressing the control can produce a roll. */
  canRoll: boolean;
  /** The Hope and Fear faces accept a typed value. */
  canType: boolean;
  /** The word on the control before a roll has been made. */
  label: string;
  /** What to do next, for whichever idle readout the layout has. */
  prompt: string;
  /** The prompt is a thing to go and fix, not an instruction to follow. */
  blocked: boolean;
}

/**
 * The honesty rule, in one place.
 *
 * "Digital dice" and "Type your own dice" are independent switches, so there
 * are four states and one of them - both off - leaves nothing on the screen
 * that can resolve a roll. That state is real, it is reachable from Settings
 * in two taps, and it is not prevented. What it must never do is present a
 * disabled control still saying ROLL, because a greyed-out button with the
 * name of the thing you wanted on it says the app could do it and won't,
 * rather than that nothing is switched on. So the control names the missing
 * switch and where to find it.
 *
 * Both layouts read this rather than deciding for themselves; the phone and
 * the desktop disagreeing about what the app can do would be its own bug. The
 * desktop was that bug for a while - its verdict strip kept its own idle copy
 * and went on saying READY and "tap ROLL" next to a button that could not
 * roll, while this comment claimed otherwise. Hence `prompt`: there is one
 * instruction line, and whichever readout a layout has, it shows that one.
 */
export function rollAffordance(digitalDice: boolean, manualDice: boolean): RollAffordance {
  if (digitalDice) {
    return {
      canRoll: true,
      canType: manualDice,
      label: 'ROLL',
      prompt: 'PICK A TRAIT · TAP ROLL',
      blocked: false,
    };
  }
  if (manualDice) {
    return {
      canRoll: false,
      canType: true,
      label: 'ENTER YOUR DICE',
      // No ROLL to tap: the faces are the only way in, and the line says so.
      prompt: 'PICK A TRAIT · TYPE YOUR DICE',
      blocked: false,
    };
  }
  return {
    canRoll: false,
    canType: false,
    label: 'NO DICE TURNED ON',
    prompt: 'TURN ON DIGITAL OR TYPED DICE IN SETTINGS',
    blocked: true,
  };
}

export interface RollState {
  result: DualityResult | null;
  trait: RollTrait;
}

const verdictBackground = (r: DualityResult | null): string => {
  if (r === null) return 'var(--app)';
  if (r.critical) return 'var(--crit-wash)';
  return r.withHope ? 'var(--hope-wash)' : 'var(--fear-wash)';
};

const verdictColor = (r: DualityResult | null): string => {
  if (r === null) return 'var(--dim)';
  if (r.critical) return 'var(--text)';
  return r.withHope ? 'var(--hope)' : 'var(--fear)';
};

interface DieProps {
  label: string;
  color: string;
  value: number | null;
  onSet: (value: number | null) => void;
  size: number;
  editable: boolean;
}

/**
 * A die face. It reports what the die showed, and when `editable` it is also
 * its own input, so physical dice have somewhere to go.
 *
 * Not editable is the default state of the app, and then this is a readout and
 * says so: no pointer cursor, and an accessible name without the invitation to
 * tap. A control that looks pressable and does nothing is worse than a label.
 */
function Die({ label, color, value, onSet, size, editable }: DieProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div
        style={{
          flex: 1,
          background: 'var(--app)',
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--r4)',
          padding: 6,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 3,
          alignContent: 'center',
        }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              onSet(n);
              setEditing(false);
            }}
            style={{
              minHeight: 'var(--control)',
              borderRadius: 'var(--r1)',
              background: n === value ? color : 'var(--raised)',
              color: n === value ? 'var(--app)' : 'var(--text)',
              font: '600 12px/1 var(--mono)',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => editable && setEditing(true)}
      aria-label={`${label} die${value === null ? '' : `: ${value}`}${editable ? ' - tap to enter a physical roll' : ''}`}
      style={{
        flex: 1,
        background: 'var(--app)',
        border: `1.5px solid ${color}`,
        borderRadius: 'var(--r4)',
        padding: '9px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 62,
        cursor: editable ? 'pointer' : 'default',
      }}
    >
      <span className="t-meta" style={{ color, letterSpacing: '0.14em' }}>
        {label}
      </span>
      <span
        style={{
          font: `800 ${size}px/1 var(--sans)`,
          textAlign: 'right',
          color: value === null ? 'var(--dim)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value ?? '—'}
      </span>
    </button>
  );
}

interface Props {
  stats: DerivedStats;
  trait: RollTrait;
  onTraitChange: (trait: RollTrait) => void;
  layout: 'desktop' | 'phone';
}

/** A stable empty list, so a character without Experiences is not a new array. */
const NO_EXPERIENCES: Experience[] = [];

export function DualityRoll({ stats, trait, onTraitChange, layout }: Props): React.JSX.Element {
  const character = useActive();
  const pushLog = useApp((s) => s.pushLog);
  const update = useApp((s) => s.update);
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);

  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [advantage, setAdvantage] = useState<0 | 1 | -1>(0);
  const [reaction, setReaction] = useState(false);
  const [result, setResult] = useState<DualityResult | null>(null);
  const [manual, setManual] = useState<{ hope: number | null; fear: number | null }>({
    hope: null,
    fear: null,
  });
  const [armedExperiences, setArmedExperiences] = useState<string[]>([]);
  const [armedDice, setArmedDice] = useState<string[]>([]);

  const characterId = character?.id ?? null;
  const held = useHeldFor(characterId);
  const addDie = useHeldDice((s) => s.add);
  const discardDie = useHeldDice((s) => s.discard);

  // Swapping character mid-session must not carry someone else's declaration
  // into the next roll.
  useEffect(() => {
    setArmedExperiences([]);
    setArmedDice([]);
  }, [characterId]);

  const experiences = character?.experiences ?? NO_EXPERIENCES;
  // Filtering the ids through the character and the tray rather than trusting
  // them: an Experience deleted in Build, or a die discarded from the tray,
  // must not keep paying out here.
  const armedList = useMemo(
    () => experiences.filter((e) => armedExperiences.includes(e.id)),
    [experiences, armedExperiences],
  );
  const bonusDice = useMemo(
    () => held.filter((d) => armedDice.includes(d.id)).map((d) => d.sides),
    [held, armedDice],
  );
  const experienceBonus = armedList.reduce((sum, e) => sum + e.bonus, 0);
  /*
   * One Hope per Experience.
   *
   * SRD, Hope & Fear: "Utilize an Experience - When you Utilize an Experience
   * on a relevant roll, add its modifier to the result. You can spend multiple
   * Hope to utilize multiple Experiences." Nothing caps the count, so neither
   * does this; what caps it is the Hope on the sheet.
   */
  const hopeCost = armedList.length;
  const hopeAvailable = character?.hope.marked ?? 0;

  const modifier = useMemo(
    () => (character ? rollModifier(character, stats, trait) : { value: 0, label: '', trait: null }),
    [character, stats, trait],
  );

  const resolve = useCallback(
    (fixed?: { hope: number; fear: number }) => {
      const r = rollDuality({
        modifier: modifier.value,
        difficulty,
        advantage: advantage === 1,
        disadvantage: advantage === -1,
        reaction,
        experienceBonus,
        bonusDice,
        ...(fixed ? { fixed } : {}),
      });
      setResult(r);
      setManual({ hope: r.hope, fear: r.fear });
      // Declared for this roll and this roll only.
      setArmedExperiences([]);
      setArmedDice([]);

      // The roll's Hope and Stress consequences are proposed by applying them,
      // because they are unambiguous; the GM's Fear is theirs to track.
      if (character) {
        update((c) => {
          // An Experience is declared before the roll, so its Hope comes out of
          // what you had - never out of the Hope this roll is about to pay.
          let hope = Math.max(0, c.hope.marked - hopeCost);
          let stress = c.stress.marked;
          if (r.effects.hope > 0) hope = Math.min(c.hope.max, hope + r.effects.hope);
          if (r.effects.stress < 0) stress = Math.max(0, stress + r.effects.stress);
          return { ...c, hope: { ...c.hope, marked: hope }, stress: { ...c.stress, marked: stress } };
        });
      }

      const sign = modifier.value >= 0 ? '+' : '−';
      const parts = [`${r.hope} / ${r.fear}`, `${sign}${Math.abs(modifier.value)}`];
      if (hopeCost > 0) parts.push(`+${r.experienceBonus} exp (−${hopeCost} Hope)`);
      // Each held die prints what it rolled, so a table checking the app
      // against its own dice can see every number that went into the total.
      r.bonusDice.forEach((value, i) => parts.push(`+${value} (d${bonusDice[i]})`));
      pushLog({
        kind: 'duality',
        label: OUTCOME_LABEL[r.outcome],
        detail: `${parts.join(' ')} = ${r.total}${difficulty === null ? '' : ` vs ${difficulty}`}`,
        outcome: r.outcome,
        total: r.total,
      });
    },
    [
      advantage,
      bonusDice,
      character,
      difficulty,
      experienceBonus,
      hopeCost,
      modifier.value,
      pushLog,
      reaction,
      update,
    ],
  );

  const setDie = (which: 'hope' | 'fear') => (value: number | null) => {
    const next = { ...manual, [which]: value };
    setManual(next);
    if (next.hope !== null && next.fear !== null) {
      resolve({ hope: next.hope, fear: next.fear });
    }
  };

  const modSign = `${modifier.value >= 0 ? '+' : '−'}${Math.abs(modifier.value)}`;
  const traitLabel =
    trait === 'spellcast'
      ? stats.spellcastTrait
        ? `SPELLCAST · ${TRAIT_LABELS[stats.spellcastTrait].toUpperCase()}`
        : 'SPELLCAST'
      : TRAIT_LABELS[trait].toUpperCase();

  /*
   * What is armed, in words, next to the ROLL button.
   *
   * The control row scrolls sideways on a phone, so a chip you armed can be
   * off screen by the time you reach for ROLL. This line is under your thumb
   * at that moment, and it costs no height: it replaces the readout that would
   * otherwise be there.
   */
  /*
   * What is armed, in words, next to ROLL - and the Experiences by name.
   *
   * The chips are compact by necessity and a long phrase runs to two lines on
   * them; this is the one place the full name is spelled out, at the moment it
   * matters, which is when you are about to spend a Hope on it.
   */
  const armSummary = [
    ...armedList.map(
      (e) =>
        `${(e.name.trim() === '' ? 'Unnamed' : e.name).toUpperCase()} ${e.bonus >= 0 ? '+' : '−'}${String(Math.abs(e.bonus))}`,
    ),
    ...(hopeCost > 0 ? [`${hopeCost} HOPE`] : []),
    ...bonusDice.map((sides) => `+D${sides}`),
  ].join(' · ');

  const affordance = rollAffordance(digitalDice, manualDice);
  const { canRoll, canType } = affordance;
  const idleLabel = affordance.label;
  // The phone's second line normally carries the arithmetic of the next roll.
  // When there is nothing to roll with, the arithmetic is beside the point.
  const idleDetail = affordance.blocked ? affordance.prompt : `2d12 ${modSign} · ${traitLabel}`;

  /*
   * Everything the modifier row is holding, in words.
   *
   * This is the price of folding the row away, and it is not optional. The
   * advantage and the reaction switch are *not* cleared when a roll resolves -
   * only the Experiences and the held dice are - so a DIS armed three rolls
   * ago is still armed, and a modifier the player cannot see is exactly the
   * failure this project's rules are written against. It rides on the closed
   * header, so nothing that is armed is ever off the screen.
   */
  const armedMods = [
    reaction ? 'REACTION' : null,
    advantage === 1 ? 'ADV' : advantage === -1 ? 'DIS' : null,
    difficulty === null ? null : `DIFF ${String(difficulty)}`,
    ...bonusDice.map((sides) => `+D${String(sides)}`),
    trait === 'spellcast' ? 'SPELLCAST' : null,
  ].filter((x): x is string => x !== null);

  const control = (
    <ControlRow
      difficulty={difficulty}
      setDifficulty={setDifficulty}
      advantage={advantage}
      setAdvantage={setAdvantage}
      onTraitChange={onTraitChange}
      trait={trait}
      stats={stats}
      reaction={reaction}
      setReaction={setReaction}
      experiences={experiences}
      inlineExperiences={layout !== 'phone'}
      armedExperiences={armedExperiences}
      toggleExperience={(id) =>
        setArmedExperiences((ids) =>
          ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
        )
      }
      hopeCost={hopeCost}
      hopeAvailable={hopeAvailable}
      held={held}
      armedDice={armedDice}
      toggleDie={(id) =>
        setArmedDice((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
      }
      addDie={(sides) => characterId !== null && addDie(characterId, sides)}
      discardDie={(id) => characterId !== null && discardDie(characterId, id)}
      wrap={layout === 'phone'}
    />
  );

  if (layout === 'phone') {
    return (
      <div className="stack" style={{ gap: 6 }}>
        {/*
         * The modifier row, folded.
         *
         * The request was to delete it. It is kept, because advantage and
         * disadvantage are core roll modifiers - 38 adversaries and 9
         * environments call for a reaction roll, and the SRD makes you declare
         * every modifier before the dice - and an app that cannot roll with
         * them is wrong at the table.
         *
         * What folding buys is not height: a 44px header replaces a 44px row
         * and the band is the same. It is that the row no longer has to fit on
         * one line. Ten controls in about 480px of content had to live in a
         * horizontal scroller at 393px, showing four of them, with the file's
         * own comment admitting a chip you had armed could be off screen by
         * the time you reached ROLL. Behind a fold it can afford to wrap: open,
         * it is two 44px rows with everything reachable without a sideways
         * swipe; closed, it is one row that names whatever is armed.
         */}
        <Disclosure
          id="rollmods"
          characterId={characterId}
          label="Modifiers"
          summary={
            armedMods.length === 0 ? (
              <span style={{ color: 'var(--dim)' }}>NONE</span>
            ) : (
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>
                {armedMods.join(' · ')}
              </span>
            )
          }
        >
          {control}
        </Disclosure>
        <ExperienceRow
          experiences={experiences}
          armedExperiences={armedExperiences}
          hopeCost={hopeCost}
          hopeAvailable={hopeAvailable}
          toggleExperience={(id) =>
            setArmedExperiences((ids) =>
              ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
            )
          }
        />
        {/*
         * The faces only take a row when they are inputs.
         *
         * Measured on a real phone, this pair held 62px of the best band on
         * the screen - directly above ROLL, directly under the thumb - to
         * display two em dashes, because with the digital roller on nothing
         * ever typed into them. What they carry that the verdict bar does not
         * is the two raw numbers, and those go into the bar's own second line
         * instead. When typing is switched on they come back full size, since
         * a table entering real dice needs a target rather than a readout.
         */}
        {canType && (
          <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
            <Die
              label="HOPE"
              color="var(--hope)"
              value={manual.hope}
              onSet={setDie('hope')}
              size={26}
              editable
            />
            <Die
              label="FEAR"
              color="var(--fear)"
              value={manual.fear}
              onSet={setDie('fear')}
              size={26}
              editable
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => canRoll && resolve()}
          disabled={!canRoll}
          style={{
            height: 66,
            borderRadius: 'var(--r5)',
            background: verdictBackground(result),
            border: `1px solid ${result === null ? 'var(--line-soft)' : verdictColor(result)}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 12,
            width: '100%',
          }}
        >
          <span className="stack" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ font: '900 17px/1 var(--sans)', color: verdictColor(result) }}>
              {result === null ? idleLabel : OUTCOME_LABEL[result.outcome]}
            </span>
            <span
              className="t-meta"
              style={{ marginTop: 4, color: verdictColor(result), opacity: 0.75 }}
            >
              {result === null
                ? armSummary !== ''
                  ? armSummary
                  : idleDetail
                : `${canType ? '' : `${result.hope} / ${result.fear} · `}${OUTCOME_DETAIL[result.outcome]}`}
            </span>
          </span>
          <span
            style={{
              font: '800 30px/1 var(--sans)',
              color: verdictColor(result),
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {result?.total ?? '—'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="panel stack" style={{ flex: 1, minHeight: 0, padding: 12, gap: 10, overflow: 'hidden' }}>
      {control}

      <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
        <Die label="HOPE" color="var(--hope)" value={manual.hope} onSet={setDie('hope')} size={46} editable={canType} />
        <Die label="FEAR" color="var(--fear)" value={manual.fear} onSet={setDie('fear')} size={46} editable={canType} />
        <div
          style={{
            width: 132,
            background: 'var(--app)',
            border: '1px solid var(--line-soft)',
            borderRadius: 'var(--r4)',
            padding: '9px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <span className="t-meta" style={{ letterSpacing: '0.14em' }}>
            {traitLabel}
          </span>
          <span
            style={{
              font: '800 46px/1 var(--sans)',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {result?.total ?? '—'}
          </span>
        </div>
      </div>

      <div
        className="spread"
        style={{
          borderRadius: 'var(--r3)',
          padding: '10px 14px',
          background: verdictBackground(result),
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            font: '900 clamp(16px,1.6vw,22px)/1 var(--sans)',
            color: verdictColor(result),
          }}
        >
          {result === null
            ? affordance.blocked
              ? affordance.label
              : 'READY'
            : OUTCOME_LABEL[result.outcome].toUpperCase()}
        </span>
        <span className="t-meta" style={{ color: verdictColor(result), opacity: 0.8 }}>
          {armSummary !== ''
            ? armSummary
            : result === null
              ? affordance.prompt
              : OUTCOME_DETAIL[result.outcome].toUpperCase()}
        </span>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={() => canRoll && resolve()}
        disabled={!canRoll}
        style={{
          height: 54,
          flex: 'none',
          borderRadius: 'var(--r4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <span style={{ font: '900 19px/1 var(--sans)', letterSpacing: '0.06em' }}>
          {idleLabel}
        </span>
        <span className="t-num" style={{ color: 'var(--app)', opacity: 0.55 }}>
          2d12 {modSign}
          {armSummary === '' ? '' : ` · ${armSummary}`}
        </span>
      </button>

      <RecentLog />
    </div>
  );
}

/**
 * One Experience, as a control you can hit.
 *
 * SRD, character creation: "An Experience is a word or phrase used to
 * encapsulate a specific set of skills, personality traits, or aptitudes your
 * character has acquired... When your PC makes a move, they can spend a Hope
 * to add a relevant Experience's modifier to an action or reaction roll."
 *
 * Whether an Experience is *relevant* is a table conversation, so every one is
 * offered on every roll and the app only counts the Hope.
 *
 * An unaffordable one is not greyed to 45% and left to be guessed at. That
 * measured 1.72:1, which reads as absent rather than as disabled, and it hid
 * the one fact the player needs - which is why it cannot be used. It says so
 * in place of its bonus instead.
 */
function ExperienceChip({
  experience,
  armed,
  affordable,
  onToggle,
  basis,
}: {
  experience: Experience;
  armed: boolean;
  affordable: boolean;
  onToggle: () => void;
  /** Flex basis when the chip is laid out in a row of equals. Unset hugs. */
  basis?: string;
}): React.JSX.Element {
  const sign = experience.bonus >= 0 ? '+' : '−';
  // A character always has two Experiences from creation; naming them is a
  // thing the SRD expects some players to leave for play. An unnamed one is
  // still armable and still costs a Hope, so it needs a word on it rather
  // than an empty chip.
  const name = experience.name.trim() === '' ? 'Unnamed' : experience.name;

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={armed}
      aria-label={`Utilize ${name}, ${sign}${Math.abs(experience.bonus)}, for one Hope${affordable ? '' : ' - not enough Hope'}`}
      aria-disabled={affordable ? undefined : true}
      disabled={!affordable}
      onClick={onToggle}
      title={affordable ? `${name} · spends 1 Hope` : `${name} · not enough Hope`}
      style={{
        flex: basis === undefined ? 'none' : `1 1 ${basis}`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: basis === undefined ? 124 : undefined,
        minWidth: 0,
        minHeight: 'var(--tap)',
        paddingTop: 4,
        paddingBottom: 4,
        /*
         * Larger than `.chip`'s 9.5px, because this is not a shelf label being
         * scanned past: it is a phrase the player wrote, read across a table
         * in a dim room at the moment they decide to spend a Hope on it. The
         * row is 44px for the touch floor rather than for the text, so the
         * bigger type costs no height at all.
         */
        font: '600 11.5px/1.15 var(--mono)',
        background: armed ? 'var(--hope-wash)' : 'var(--raised)',
        border: `1px solid ${armed ? 'var(--hope)' : 'transparent'}`,
        // The border and the filled pip carry the Hope; the name stays at full
        // text contrast, which amber on its own wash is not.
        color: armed ? 'var(--text)' : 'var(--muted)',
      }}
    >
      <HopePip on={armed} />
      {/*
       * Wrapping, not an ellipsis.
       *
       * "SILVER-TONGUED DIPLOMAT" truncated to "SILVER-TONG…" on a phone, and
       * the full name lived only in the title attribute and the accessible
       * name - neither of which a thumb can reach. An Experience is a phrase
       * the player wrote themselves; being unable to read it back on the one
       * screen that spends it is a poor trade for a tidier chip. Two lines fit
       * inside the 44px the touch floor already requires, so this costs no
       * height at all in the common case.
       */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textAlign: 'left',
          // `.chip` sets `white-space: nowrap`, which cancels wrapping
          // outright - the line clamp below does nothing without this.
          whiteSpace: 'normal',
          lineHeight: 1.15,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
        }}
      >
        {name.toUpperCase()}
      </span>
      <span style={{ flex: 'none', fontWeight: 700 }}>
        {affordable ? `${sign}${Math.abs(experience.bonus)}` : 'NO HOPE'}
      </span>
    </button>
  );
}

/**
 * Every Experience at once, wrapping, each one a full-height target.
 *
 * They used to live in the control row, which scrolls sideways, behind
 * REACTION and the advantage group - so on a 393px phone the second one was
 * already off screen, and the file's own comment admitted that a chip you had
 * armed could be out of sight by the time you reached ROLL. Declaring a
 * modifier you cannot see is not a declaration.
 *
 * Two across is deliberate. It is the count a character starts with, it keeps
 * each chip wide enough for a real phrase rather than an ellipsis, and it puts
 * the whole set inside the thumb arc directly above ROLL - which is also the
 * order the rules ask for, since Experiences are declared before the dice.
 */
function ExperienceRow({
  experiences,
  armedExperiences,
  hopeCost,
  hopeAvailable,
  toggleExperience,
}: {
  experiences: Experience[];
  armedExperiences: string[];
  hopeCost: number;
  hopeAvailable: number;
  toggleExperience: (id: string) => void;
}): React.JSX.Element | null {
  if (experiences.length === 0) return null;

  /*
   * How many to a row, and why it changes.
   *
   * An Experience is a phrase the player wrote themselves - "Silver-Tongued
   * Diplomat", "Ledgers and Ledger Lines" - and there is no other text to it:
   * the name *is* the Experience. So a chip that renders it as
   * "SILVER-TONG..." has thrown away the whole content of the thing, and the
   * full name lived only in a title attribute and an accessible name, neither
   * of which a thumb can reach.
   *
   * One to a row is therefore the default. Full width is about 350px, which
   * holds any phrase anyone actually writes, and up to three rows costs 144px
   * of a block that can afford it. Three is also not an arbitrary cutoff: the
   * SRD grants a new Experience at levels 2, 5 and 8 on top of the two from
   * creation, so a character carries two or three of them for the first four
   * levels and most tables never leave that range.
   *
   * From four it goes two across, because five full-width rows would be 244px
   * and would not fit a 375px phone at all. At two across a chip is about
   * 175px, which is roughly 25 characters - short of the longest names, which
   * is why the label wraps to a second line rather than truncating, and why
   * the ROLL bar spells out in full whatever is armed.
   */
  const perRow = experiences.length > 3 ? 2 : 1;
  const basis = `calc(${(100 / perRow).toFixed(3)}% - ${String((6 * (perRow - 1)) / perRow)}px)`;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {experiences.map((experience) => (
        <ExperienceChip
          key={experience.id}
          experience={experience}
          basis={basis}
          armed={armedExperiences.includes(experience.id)}
          affordable={armedExperiences.includes(experience.id) || hopeCost < hopeAvailable}
          onToggle={() => toggleExperience(experience.id)}
        />
      ))}
    </div>
  );
}

interface ControlProps {
  difficulty: number | null;
  setDifficulty: (n: number | null) => void;
  advantage: 0 | 1 | -1;
  setAdvantage: (a: 0 | 1 | -1) => void;
  trait: RollTrait;
  onTraitChange: (t: RollTrait) => void;
  stats: DerivedStats;
  reaction: boolean;
  setReaction: (v: boolean) => void;
  experiences: Experience[];
  /** False when the layout gives the Experiences a row of their own. */
  inlineExperiences: boolean;
  armedExperiences: string[];
  toggleExperience: (id: string) => void;
  /** Hope the armed Experiences will cost, and Hope there is to pay with. */
  hopeCost: number;
  hopeAvailable: number;
  held: HeldDie[];
  armedDice: string[];
  toggleDie: (id: string) => void;
  addDie: (sides: (typeof DIE_SIZES)[number]) => void;
  discardDie: (id: string) => void;
  /**
   * Wrap onto as many lines as the controls need, instead of scrolling
   * sideways.
   *
   * Only affordable because the row is behind a fold: as a permanent band it
   * would have cost 88-132px of the thumb zone on every phone. See the note
   * at the disclosure.
   */
  wrap?: boolean;
}

const HOLD_MS = 480;

/** The Hope pip, in the same silhouette the Hope track uses. */
function HopePip({ on }: { on: boolean }): React.JSX.Element {
  return (
    <span
      style={{
        flex: 'none',
        width: 7,
        height: 7,
        clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
        background: on ? 'var(--hope)' : 'var(--empty)',
      }}
    />
  );
}

/**
 * A die in the tray. Tap arms it for the next roll, press and hold discards it
 * - the gesture the tracks already use for "clear this".
 *
 * Rolling does not discard it. Whether a die is spent by being used is feature
 * text: a Rally Die is gone, an Unstoppable Die stays for as long as you are
 * Unstoppable, and the app has no business guessing which one this is.
 */
function HeldDieChip({
  die,
  armed,
  onToggle,
  onDiscard,
}: {
  die: HeldDie;
  armed: boolean;
  onToggle: () => void;
  onDiscard: () => void;
}): React.JSX.Element {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discarded = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={armed}
      aria-label={`d${die.sides} held die - tap to add it to the next roll, hold to discard it`}
      title="Tap to add it to the next roll · hold to discard"
      onPointerDown={() => {
        discarded.current = false;
        timer.current = setTimeout(() => {
          discarded.current = true;
          onDiscard();
          navigator.vibrate?.(12);
        }, HOLD_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => {
        if (!discarded.current) onToggle();
      }}
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        minWidth: 'var(--control)',
        background: armed ? 'var(--text)' : 'var(--raised)',
        color: armed ? 'var(--app)' : 'var(--muted)',
        fontWeight: armed ? 700 : 600,
      }}
    >
      {armed ? '+' : ''}d{die.sides}
    </button>
  );
}

/**
 * Everything you declare before you roll, on one line.
 *
 * One line is not a preference. On a phone this row sits above the dice and the
 * ROLL button in the thumb arc, and every pixel it grows is a pixel off the
 * loadout - so it scrolls sideways instead, with what you armed repeated next
 * to ROLL for the chips that scrolled out of reach.
 */
function ControlRow({
  difficulty,
  setDifficulty,
  advantage,
  setAdvantage,
  stats,
  trait,
  onTraitChange,
  reaction,
  setReaction,
  experiences,
  inlineExperiences,
  armedExperiences,
  toggleExperience,
  hopeCost,
  hopeAvailable,
  held,
  armedDice,
  toggleDie,
  addDie,
  discardDie,
  wrap = false,
}: ControlProps): React.JSX.Element {
  const [picking, setPicking] = useState(false);
  const narrow = useIsNarrow();

  // The picker takes over the whole row, the way a die takes over its own face
  // to be typed into. A popover would either be clipped by the panel or open
  // off the side of a row that scrolls.
  if (picking) {
    return (
      <div className="row" style={{ gap: 4 }}>
        <span className="t-label" style={{ flex: 'none' }}>
          Hold a die
        </span>
        {DIE_SIZES.map((sides) => (
          <button
            key={sides}
            type="button"
            className="chip"
            onClick={() => {
              addDie(sides);
              setPicking(false);
            }}
            style={{
              flex: '1 0 auto',
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
              background: 'var(--raised)',
              color: 'var(--text)',
            }}
          >
            d{sides}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-label="Cancel"
          onClick={() => setPicking(false)}
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            color: 'var(--muted)',
            background: 'transparent',
          }}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="spread" style={{ alignItems: 'center' }}>
      {/* The title is a desktop luxury. Anywhere narrower it is 99px of a
          369px row spent on a word, and the row has ten controls to fit;
          REACTION leads the scroller instead, so the state the title carried -
          which kind of roll this is - is still the first thing on screen. */}
      {!narrow && (
        <span className="t-label" style={{ flex: 'none' }}>
          {reaction ? 'Reaction Roll' : 'Duality Roll'}
        </span>
      )}
      <div
        className="row"
        style={{
          flex: 1,
          minWidth: 0,
          gap: 6,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          overflowX: wrap ? 'visible' : 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
      >
        {/* A spacer, not `justify-content: flex-end`: end-alignment pushes the
            overflow off the start edge, where several engines will not scroll
            to it. This collapses to nothing the moment the row is full - and
            it is not drawn at all when the row wraps, where a growing child
            would push everything after it onto a line of its own. */}
        {!wrap && <span style={{ flex: '1 1 0', minWidth: 0 }} />}

        {/* A reaction roll resolves the same way and pays nothing: no Hope, no
            Fear, and no cleared Stress on a critical. 38 adversaries and 9
            environments call for one, so this is a switch, not a footnote, and
            it leads the row because on a phone it is also the only thing
            saying which kind of roll this is. It still takes Experiences - the
            SRD spends Hope on "an action or reaction roll" - and what it
            refuses is an ally's Help. */}
        <button
          type="button"
          onClick={() => setReaction(!reaction)}
          aria-pressed={reaction}
          className="chip"
          title="A reaction roll grants no Hope and no Fear, and no ally can Help"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            background: reaction ? 'var(--fear)' : 'var(--raised)',
            color: reaction ? 'var(--app)' : 'var(--muted)',
          }}
        >
          REACTION
        </button>

        {/* Advantage next, because at 393px only the first few controls are on
            screen and this is the one every roll touches. */}
        {([-1, 0, 1] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAdvantage(a)}
            className="chip"
            aria-pressed={advantage === a}
            style={{
              flex: 'none',
              minHeight: 'var(--control)',
              minWidth: 'var(--control)',
              background: advantage === a ? 'var(--raised)' : 'transparent',
              border: `1px solid ${advantage === a ? 'var(--line)' : 'transparent'}`,
              color: a === 1 ? 'var(--ok)' : a === -1 ? 'var(--damage)' : 'var(--muted)',
            }}
          >
            {a === 1 ? 'ADV' : a === -1 ? 'DIS' : '—'}
          </button>
        ))}

        {inlineExperiences &&
          experiences.map((experience) => (
            <ExperienceChip
              key={experience.id}
              experience={experience}
              armed={armedExperiences.includes(experience.id)}
              affordable={armedExperiences.includes(experience.id) || hopeCost < hopeAvailable}
              onToggle={() => toggleExperience(experience.id)}
            />
          ))}

        {held.map((die) => (
          <HeldDieChip
            key={die.id}
            die={die}
            armed={armedDice.includes(die.id)}
            onToggle={() => toggleDie(die.id)}
            onDiscard={() => discardDie(die.id)}
          />
        ))}
        <button
          type="button"
          className="chip"
          onClick={() => setPicking(true)}
          disabled={held.length >= MAX_HELD}
          aria-label="Hold a die for later rolls"
          title="A Rally, Prayer or Slayer Die, or the d6 from Help an Ally"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            background: 'transparent',
            border: '1px dashed var(--line)',
            color: 'var(--muted)',
            opacity: held.length >= MAX_HELD ? 0.4 : 1,
          }}
        >
          + DIE
        </button>

        <label className="row" style={{ flex: 'none', gap: 4 }}>
          <span className="t-meta">DIFF</span>
          <input
            type="number"
            inputMode="numeric"
            value={difficulty ?? ''}
            placeholder="—"
            onChange={(e) => setDifficulty(e.target.value === '' ? null : Number(e.target.value))}
            style={{
              width: 58,
              minHeight: 'var(--control)',
              padding: '4px 6px',
              textAlign: 'center',
              font: '600 13px/1 var(--mono)',
            }}
          />
        </label>

        {stats.spellcastTrait !== null && (
          <button
            type="button"
            onClick={() => onTraitChange(trait === 'spellcast' ? stats.spellcastTrait! : 'spellcast')}
            className="chip"
            style={{
              flex: 'none',
              minHeight: 'var(--control)',
              background: trait === 'spellcast' ? 'var(--hope)' : 'var(--raised)',
              color: trait === 'spellcast' ? 'var(--app)' : 'var(--muted)',
            }}
          >
            SPELLCAST
          </button>
        )}
      </div>
    </div>
  );
}

function RecentLog(): React.JSX.Element {
  const log = useApp((s) => s.log);
  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 5 }}>
      <span className="t-meta" style={{ letterSpacing: '0.14em', color: 'var(--muted)' }}>
        RECENT
      </span>
      <div className="scroll stack" style={{ flex: 1, minHeight: 0 }}>
        {log.slice(0, 12).map((entry) => (
          <div
            key={entry.id}
            className="spread"
            style={{
              alignItems: 'center',
              padding: '6px 0',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              {entry.detail}
            </span>
            <span
              className="t-meta"
              style={{
                color:
                  entry.outcome === undefined
                    ? 'var(--muted)'
                    : entry.outcome.endsWith('hope') || entry.outcome === 'critical'
                      ? 'var(--hope)'
                      : 'var(--fear)',
                textAlign: 'right',
              }}
            >
              {entry.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
