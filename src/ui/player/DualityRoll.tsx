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
  OUTCOME_LABEL,
  outcomeDetail,
  rollDuality,
  type DualityResult,
} from '../../engine/dice.ts';
import { useActive, useApp } from '../../store/state.ts';
import { useIsNarrow } from '../shared/useLayout.ts';
import type { ArmedAttack, AttackSource } from './attack.ts';
import { DamageRow } from './DamageRoll.tsx';
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
  /**
   * What the next attack is made with, re-derived by `Play` on every render.
   *
   * It is snapshotted into an `ArmedAttack` at the instant a roll resolves and
   * never read again by the damage row, so putting the weapon down after the
   * roll cannot change the dice that roll earned. Null for a bare trait roll,
   * and then the roll simply offers no damage.
   */
  source: AttackSource | null;
  layout: 'desktop' | 'phone';
  /**
   * The Experiences declared for the next roll, owned by `Play`.
   *
   * They used to live in this component's own `useState`, and they cannot stay
   * there: Giorgio's order puts the Experiences behind a fold *below* ROLL,
   * between the weapons and the inventory, and that fold is rendered by
   * `PlayPhone` - several hundred pixels of document above the component that
   * knows which chips are armed.
   *
   * Moving them up also puts the clearing rule in one place. `Play` already
   * clears the armed attack and the spell modifier on a character switch, in
   * one `[characterId]` effect; the Experiences were being cleared by a second
   * effect in this file, on the same key, which is how the two could ever have
   * disagreed about whose declaration the arriving sheet was holding.
   */
  armedExperiences: string[];
  onArmedExperiencesChange: (ids: string[]) => void;
}

/** A stable empty list, so a character without Experiences is not a new array. */
const NO_EXPERIENCES: Experience[] = [];

export function DualityRoll({
  stats,
  trait,
  onTraitChange,
  source,
  layout,
  armedExperiences,
  onArmedExperiencesChange,
}: Props): React.JSX.Element {
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
  const [armedDice, setArmedDice] = useState<string[]>([]);
  /*
   * Whether the modifier controls are showing, on a phone.
   *
   * Deliberately local, and deliberately not a `usePlaySection` remembered per
   * character the way the folds on the sheet are. Those record an arrangement
   * - which parts of your sheet you use - and survive the app being closed.
   * This is a drawer you open mid-turn to declare a Difficulty and shut again;
   * a version of it that came back open next session would be spending the
   * band decision 6 just took back.
   */
  const [modifiersOpen, setModifiersOpen] = useState(false);
  /*
   * The attack the damage row is answering, and which roll it came from.
   *
   * The snapshot is taken whole from the `DualityResult` that produced it and
   * never recomputed, because the critical the player saw is the critical that
   * has to pay. `rollId` exists so the row is keyed on the roll: the row keeps
   * a rolled total in its own state, and without a remount the next attack
   * would arrive under last turn's number - on a phone, where there is no log
   * on screen to contradict it.
   */
  const [attack, setAttack] = useState<ArmedAttack | null>(null);
  const [rollId, setRollId] = useState(0);

  const characterId = character?.id ?? null;
  const held = useHeldFor(characterId);
  const addDie = useHeldDice((s) => s.add);
  const discardDie = useHeldDice((s) => s.discard);

  /*
   * Swapping character mid-session must not carry someone else's declaration
   * into the next roll - nor someone else's roll onto this sheet.
   *
   * `App` renders `<Play />` unkeyed and `Play` renders this component unkeyed
   * inside it, so the header's character picker swaps `useActive()` underneath
   * a component that keeps all of the above in its own state. Nothing here is
   * remounted, so nothing is cleared unless it is cleared here.
   */
  useEffect(() => {
    // Not the Experiences: `Play` owns those now and clears them in the effect
    // that already clears the declaration and the spell modifier, on this same
    // key. Two effects clearing one list is two rules that can disagree.
    setArmedDice([]);
    // And nobody else's attack either: a damage offer left standing across a
    // character switch would be this sheet being offered that sheet's sword.
    setAttack(null);
    /*
     * The verdict is the other half of the same rule, and it is the visible
     * half. `result` is the whole readout - the outcome word, the two faces,
     * and the total in 30px at the right of the roll control, which is the
     * biggest number the roll surface prints. Left standing, the arriving
     * player looks at their own sheet and reads SUCCESS WITH FEAR and a 20 that
     * belongs to the person who handed them the phone, with nothing on the
     * screen saying whose it was. `manual` goes with it: with typed dice on the
     * two faces are the readout as well as the input, so leaving them would
     * both show the previous roll and let one edited face re-resolve against
     * the other one's stale number.
     *
     * The advantage, the reaction switch and the Difficulty deliberately stay.
     * They are not a claim about who rolled: they are what the *table* has
     * declared. What used to make that safe was a closed modifier row printing
     * them whether they were armed or not, and P5-5's decision 6 deleted that
     * row rather than go on spending a band on the word NONE. It is the ARMED
     * strip that carries them onto the arriving sheet now - drawn exactly when
     * there is something to name - and the docblock on `armedMods` is where
     * that is argued.
     */
    setResult(null);
    setManual({ hope: null, fear: null });
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
      onArmedExperiencesChange([]);
      setArmedDice([]);

      /*
       * Carry the attack across to the damage roll, which is the link the SRD
       * rule is about and the one this app has never had. Every field is copied
       * off the result that produced it - `succeeded` whole, all three of its
       * values - so nothing downstream has to work out a verdict a second time.
       * A roll made with nothing declared clears it rather than leaving the
       * previous weapon's offer standing under a persuasion check.
       */
      setRollId((n) => n + 1);
      setAttack(
        source === null
          ? null
          : {
              source,
              critical: r.critical,
              succeeded: r.succeeded,
              outcome: r.outcome,
              reaction: r.reaction,
              proficiency: stats.proficiency,
            },
      );

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
      // In the array for the reason the two below are: this is a prop now, and
      // a callback left out of it runs the first render's closure. `Play`
      // passes the `useState` setter itself, so the identity is stable and
      // naming it here costs nothing.
      onArmedExperiencesChange,
      pushLog,
      reaction,
      // Without these two the snapshot is taken from the first render's
      // closure: arm a weapon, roll, and the source is still null, so the
      // offer never appears and nothing anywhere says why. There is no eslint
      // in this repo to catch a stale dependency, so it is written down here.
      source,
      stats.proficiency,
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
   * What is armed, in words, on the ROLL bar - and the Experiences by name.
   *
   * This is the whole warrant for the Experiences being behind a fold at all.
   * `PlayPhone` argues the move on the sentence "whatever is armed is spelled
   * out in full on the ROLL bar itself - so a declaration is never behind a
   * tap even when the fold is", and the chips themselves are several hundred
   * pixels of document below ROLL. If this line is not on the bar, the fold
   * was not safe to make.
   *
   * The chips are compact by necessity and a long phrase runs to two lines on
   * them; this is the one place the full name is spelled out, at the moment it
   * matters, which is when you are about to spend a Hope on it. It costs no
   * height either way: it replaces the readout that would otherwise be there.
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
   * The declaration, labelled when there is a verdict standing beside it.
   *
   * Both roll surfaces put `armSummary` on the same line that reports the last
   * roll, and neither of them said which roll it belonged to. With a verdict
   * standing the bar reads `SUCCESS WITH HOPE ... RAN WITH THE WOLVES +2 ...
   * 18`, and an 18 with a +2 printed next to it is an 18 that counted the +2 -
   * this project's founding rule failing in the other direction, the app
   * claiming a modifier applied to a roll that was declared after it. The
   * Experiences are cleared *by* a roll, so the only way to reach this state is
   * to arm one for the next roll, which is exactly when the label is needed.
   *
   * One expression, read by both layouts, because a phone and a desktop
   * disagreeing about what the roll surface says would be its own bug - the
   * argument `rollAffordance` is already written on.
   */
  const declaration = result === null ? armSummary : `NEXT: ${armSummary}`;

  /*
   * The phone bar's second line, in every state - including with a verdict
   * standing.
   *
   * This used to be `result === null ? armSummary : the verdict detail`, and
   * that made `PlayPhone`'s sentence false the moment a roll had resolved.
   * Roll once, open the Experiences fold, arm one, shut the fold: the roll
   * surface read the previous verdict and nothing else. The next roll was
   * silently two points high and a Hope down, and the only statement left on
   * the screen was the shut fold's own header - which at 375x667 is below the
   * fold. The ARMED strip did not cover it either: that strip is a door into
   * the modifier row, and on a phone the Experiences are deliberately not in
   * the modifier row, so naming them on a control that opens it would be an
   * offer the tap cannot keep.
   *
   * WHAT GIVES WAY IS THE OUTCOME DETAIL, AND ONLY IT. The two raw dice stay:
   * with typed dice off this line is the only place on a phone they are
   * printed - there is no log surface here - and a table checking the app
   * against its own dice needs them. What the detail says instead is the
   * consequence, and the consequence has already been applied to the Hope and
   * Stress counters higher up the same column; the outcome itself is still in
   * 17px directly above. One tap disarms the Experience and it comes back.
   *
   * AND IT COSTS THE COLUMN NOTHING, WHICH IS THE POINT. This line already
   * exists in every state, so an armed Experience adds no height at all -
   * unlike an armed modifier, which draws the ARMED strip and is the +50 that
   * `the budget the pin came off for` lists as a state it cannot see. What it
   * can do is wrap, so: at 393px ROLL is 317 wide, less 28 of padding, less 12
   * of gap and about 33 for a two-digit total in 30px, leaves the text stack
   * 244px. `.t-meta` is 10px mono at 0.06em, about 6.6px a character, so 36
   * characters to a line - 34 at 375px. The ordinary armed state, typed dice
   * off, is `8 / 5 · NEXT: RAN WITH THE WOLVES +2 · 1 HOPE`: 45 characters,
   * two lines, and 17 + 4 + 20 = 41px inside a button that is 66 tall. Two
   * Experiences and a held die is 63 characters and still two lines. It takes
   * five lines to overflow, which is about 148 characters of names somebody
   * wrote themselves, and the idle state could already reach that.
   */
  const rollLine =
    result === null
      ? armSummary === ''
        ? idleDetail
        : declaration
      : `${canType ? '' : `${result.hope} / ${result.fear} · `}${
          armSummary === '' ? outcomeDetail(result) : declaration
        }`;

  /*
   * Everything the modifier row is holding, in words.
   *
   * This is the price of not drawing the row, and it is not optional. The
   * advantage and the reaction switch are *not* cleared when a roll resolves -
   * only the Experiences and the held dice are - so a DIS armed three rolls
   * ago is still armed, and a modifier the player cannot see is exactly the
   * failure this project's rules are written against. Empty, this list is why
   * there is no row at all; non-empty, it is the row.
   */
  const armedMods = [
    reaction ? 'REACTION' : null,
    advantage === 1 ? 'ADV' : advantage === -1 ? 'DIS' : null,
    difficulty === null ? null : `DIFF ${String(difficulty)}`,
    ...bonusDice.map((sides) => `+D${String(sides)}`),
    trait === 'spellcast' ? 'SPELLCAST' : null,
  ].filter((x): x is string => x !== null);

  /*
   * One toggle, used by both surfaces that arm an Experience: the chips in the
   * cockpit's control row and the fold below ROLL on a phone. It reads the
   * current list off the prop rather than out of an updater callback, because
   * the list lives in `Play` now and this component only ever sees the value
   * it was rendered with.
   */
  const toggleExperience = (id: string): void => {
    onArmedExperiencesChange(
      armedExperiences.includes(id)
        ? armedExperiences.filter((x) => x !== id)
        : [...armedExperiences, id],
    );
  };

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
      toggleExperience={toggleExperience}
      hopeCost={hopeCost}
      hopeAvailable={hopeAvailable}
      held={held}
      armedDice={armedDice}
      toggleDie={(id) =>
        setArmedDice((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
      }
      addDie={(sides) => characterId !== null && addDie(characterId, sides)}
      discardDie={(id) => characterId !== null && discardDie(characterId, id)}
    />
  );

  if (layout === 'phone') {
    return (
      /*
       * `flex: none`, and it is load-bearing rather than tidy.
       *
       * The phone column is `display: flex; flex-direction: column; flex: 1;
       * min-height: 0; overflow-y: auto`. In that box a child keeps the default
       * `flex-shrink: 1`, so when the sheet is taller than the glass the
       * browser shrinks whatever *can* shrink before it lets anything scroll -
       * and every other section of this column declares `flex: none`, so this
       * one was the only thing it could take it out of. Rendered at 393x852
       * this surface measured 33px tall holding a 66px ROLL, which overflowed
       * onto the fold header below it: two 44px targets stacked on the same
       * band, and a column whose `scrollHeight` equalled its `clientHeight`, so
       * the sheet did not scroll at all - it crushed the one control the whole
       * unpinning was argued from. Every height `playSheet.test.tsx` sums is a
       * declared height, and this is the property that makes the declared
       * heights the drawn ones.
       */
      <div className="stack" style={{ flex: 'none', gap: 6 }}>
        {/*
         * The modifier row, which is not drawn when it has nothing to say.
         *
         * Giorgio asked twice for this row to be removed. P5-1 refused with an
         * argument that still holds - 38 adversaries and 9 environments call
         * for a reaction roll, the SRD makes you declare every modifier before
         * the dice, and an app you cannot roll with advantage in is wrong at
         * the table - and then shipped the wrong answer to it: a permanent
         * 44px band reading `▶ MODIFIERS … NONE`, which is the band Giorgio
         * wanted back, spent on announcing that nothing is happening.
         *
         * So neither answer. Nothing is drawn here at all while nothing is
         * armed; the controls are one tap away on MODS, at the right end of
         * the roll row, where they cost no height because ROLL is already 66
         * tall. And the moment anything is armed - ADV, DIS, REACTION, a
         * Difficulty, a held die, SPELLCAST - this strip appears and names it,
         * because `advantage` and `reaction` are deliberately not cleared when
         * a roll resolves, so a DIS armed three rolls ago is still armed and a
         * modifier the player cannot see is this project's founding rule
         * failing on a number.
         *
         * Open, the row wraps rather than scrolling sideways: ten controls in
         * about 480px of content showed four of themselves at 393px, and a
         * chip you had armed could be off the side by the time you reached
         * ROLL. That is no longer a phone rule. The cockpit was the same
         * sentence with worse numbers - thirteen controls in 1058px of content
         * showing four and a half of themselves in 303 - so `ControlRow` wraps
         * everywhere now and the prop that used to make this the exception is
         * gone. Its docblock carries the arithmetic.
         */}
        {modifiersOpen && control}
        {!modifiersOpen && armedMods.length > 0 && (
          <button
            type="button"
            aria-expanded={false}
            aria-label={`Modifiers armed: ${armedMods.join(', ')} - open the modifier row`}
            onClick={() => setModifiersOpen(true)}
            className="row"
            style={{
              flex: 'none',
              minHeight: 'var(--tap)',
              width: '100%',
              gap: 8,
              borderRadius: 'var(--r3)',
              background: 'var(--raised)',
              padding: '0 10px',
              textAlign: 'left',
            }}
          >
            <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
              ARMED
            </span>
            <span
              className="t-meta"
              style={{ flex: 1, minWidth: 0, color: 'var(--text)', fontWeight: 700 }}
            >
              {armedMods.join(' · ')}
            </span>
          </button>
        )}
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
        {/*
         * ROLL and the door to the modifiers, on one row.
         *
         * MODS is at the RIGHT end and that is not arbitrary: the bottom-right
         * is where an idle thumb rests, so the control a resting thumb fires
         * by accident has to be the harmless one. A stray tap on MODS opens a
         * row - visible, reversible, costs nothing. A stray tap on ROLL spends
         * Hope, writes a log line and produces a number the table will act on.
         * So the resting point gets the cheap control and the 317px body of
         * ROLL gets the deliberate reach.
         *
         * MODS declares `minHeight: 66` and not `height: 66` on purpose: ROLL
         * is the one control on this surface that fixes its own height, and
         * `leaves every target on the roll surface at the floor after a roll`
         * is built on that being true of exactly one button.
         */}
        <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
          <button
            type="button"
            onClick={() => canRoll && resolve()}
            disabled={!canRoll}
            style={{
              flex: 1,
              minWidth: 0,
              height: 66,
              borderRadius: 'var(--r5)',
              background: verdictBackground(result),
              border: `1px solid ${result === null ? 'var(--line-soft)' : verdictColor(result)}`,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 12,
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
                {rollLine}
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
          <button
            type="button"
            aria-expanded={modifiersOpen}
            /* The name carries what is armed, because with the row shut there
               would otherwise be nothing a listening user could hear it from.
               It deliberately does not begin "Roll": `DamageRow`'s control is
               named "Roll 2d10+3 …" and a test looking for one would find the
               other. */
            aria-label={
              armedMods.length === 0
                ? 'Modifiers for this roll'
                : `Modifiers for this roll: ${armedMods.join(', ')}`
            }
            onClick={() => setModifiersOpen(!modifiersOpen)}
            className="stack"
            style={{
              flex: 'none',
              width: 44,
              minWidth: 44,
              minHeight: 66,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 'var(--r5)',
              background: armedMods.length > 0 ? 'var(--raised)' : 'transparent',
              border: `1px solid ${armedMods.length > 0 ? 'var(--line)' : 'var(--line-soft)'}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                background: armedMods.length > 0 ? 'var(--text)' : 'var(--muted)',
                clipPath: modifiersOpen
                  ? 'polygon(0 75%,100% 75%,50% 0)'
                  : 'polygon(0 25%,100% 25%,50% 100%)',
              }}
            />
            <span
              aria-hidden="true"
              className="t-meta"
              style={{ color: armedMods.length > 0 ? 'var(--text)' : 'var(--muted)' }}
            >
              MODS
            </span>
          </button>
        </div>
        {/*
         * Last, and therefore hard against the bottom edge of the glass.
         *
         * When it exists it is the only thing you are about to press, so it
         * gets the easiest point in the thumb arc; the Duality bar moves up by
         * 58px to make room and is still well inside it. It also must stay
         * below ROLL rather than above it, because everything above ROLL in
         * this stack is something you declare *before* the dice, and this is
         * the only thing here that comes after them.
         */}
        <DamageRow key={rollId} attack={attack} affordance={affordance} layout="phone" />
      </div>
    );
  }

  /*
   * The cockpit's roll panel, which scrolls - and that is the fix, not a
   * concession.
   *
   * IT USED TO BE `overflow: 'hidden'`, AND THAT COST THE SCREEN ROLL. Every
   * term of what this panel holds is declared in this file, so the sum can be
   * read off the source: 24 of padding here, 44 for the control row (its
   * tallest child is `ExperienceChip`'s `minHeight: var(--tap)`), 62 for the
   * dice faces (`Die`'s `minHeight: 62`), 38.9 for the verdict strip (20 of
   * padding around a `clamp(16px,1.6vw,22px)/1` line, which is 18.88px at a
   * 1180px window), ROLL's own declared 54, 15 for `RecentLog` at its floor -
   * the 10px RECENT label over a 5px gap and an empty box - and four 10px
   * gaps. 277.9px. Measured in Chrome at 1180x695 with the backup banner up
   * and the last Hit Point marked, this panel is 197 tall with a scrollHeight
   * of 277, and ROLL's 54px box is laid out at y 677.9 against a panel bottom
   * edge at y 674: painted 0.0px. Both of those conditions are default states
   * of a fresh install rather than contrivances, and 695 is this repository's
   * own stated constraint - `Vitals` says "a 1440x695 laptop viewport is the
   * real constraint, not the 900px mock". The same clip takes `DamageRow`'s
   * `IF IT HIT · 4d8+6` to 15 of its declared 44 at 1280x800.
   *
   * AND NOTHING ABOVE COULD GIVE THE HEIGHT BACK, which is what made it a
   * reachability defect rather than an ugly one. Measured at 1180x695, `main`
   * and `.app` both have `scrollHeight === clientHeight`, and the middle grid
   * column is `overflowY: visible`, so there was no wheel, no drag and no tap
   * anywhere on the glass that reached ROLL. `roll.focus()` did: it sets this
   * element's `scrollTop` to 80 and brings the button back to y 597.9. Laid
   * out, invisible, still keyboard-reachable - P2-1's exact signature, on the
   * desktop, in the one control the screen exists for.
   *
   * `overflowY: 'auto'` AND NOT A SHORTER PANEL. The other three answers were
   * available and all of them are worse. Dropping the dice faces takes the two
   * raw numbers off the cockpit, where they are the readout and not an input.
   * Pinning ROLL to the bottom of the panel breaks this screen's standing rule
   * that nothing on Play is out of the flow, and would park a 54px button over
   * the log. Moving the scroll up to the middle grid column would take `Vitals`
   * with it, and the counters are the thing you have to be able to see *while*
   * you roll. Scrolling the panel itself is the reflow this project already
   * decided it prefers to a clip.
   *
   * `overflowX` STAYS `hidden`, ON PURPOSE. `overflow-x: visible` beside a
   * scrolling y-axis computes to `auto`, and the panel does have content that
   * can exceed 404px of inner width: ROLL's second line is `.t-num` (13px
   * mono) with no `min-width: 0`, so an Experience named as one unbroken word
   * of ~34 characters is about 280px that cannot wrap. That already overflowed
   * and was already clipped; making it a horizontal scrollbar instead would be
   * a new defect shipped inside a fix.
   *
   * NO `scrollbarWidth` HERE. This is now the only scroll on the cockpit's
   * middle column - the modifier shelf above used to be a second one, at
   * `overflowX: 'auto'` with `scrollbarWidth: 'none'`, and it wraps instead -
   * so it is the one scroll a player has to notice. It takes the platform's
   * own bar at the platform's own width, and nothing here suppresses it.
   *
   * ERGONOMICS. The cockpit is 1180px and up, so 393x852 and its thumb arc are
   * not the reference here - `PlayPhone` is what a phone gets. What does reach
   * this panel with a finger is a touchscreen laptop, and tokens.css:203-207
   * widens `--control` to `var(--tap)` under `(pointer: coarse)` at any width,
   * so every chip in the control row above is already 44px there and ROLL is
   * 54 by declaration. TARGET SIZE was never the charge: 0px and 15px are what
   * a clip leaves, and no floor survives that - not this project's 44/34 and
   * not WCAG's 24 either. READ VERSUS TOUCH is what the scroll has to keep,
   * and it does, because the order in this column is already right: what you
   * declare (the control row) is read first, what reports (the faces and the
   * verdict strip) sits above what you press, ROLL and the damage row come
   * after them, and `RecentLog` - the only thing here you merely read back -
   * is the one `flex: 1` child, so it gives up its height first and the panel
   * only scrolls once the log is at zero. What a player scrolls to is
   * therefore always the bottom of the column and always the thing they were
   * about to press, never a readout they have to hunt back up for.
   *
   * IT COSTS NO PIXELS. `overflowY: 'auto'` adds no layout height; on a
   * platform with classic scrollbars it takes the bar's width out of the
   * panel's 404px of inner width, and only while the panel is actually
   * overflowing.
   */
  return (
    <div
      className="panel stack"
      style={{
        flex: 1,
        minHeight: 0,
        padding: 12,
        gap: 10,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
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
            ? declaration
            : result === null
              ? affordance.prompt
              : outcomeDetail(result).toUpperCase()}
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

      {/*
       * Between ROLL and the log, and never after it.
       *
       * The reason used to be that `RecentLog` is this panel's only `flex: 1`
       * child, so a row placed here takes its height out of the log, which can
       * spare it. THAT PREMISE IS FALSE IN THE STATE THAT MATTERS. Measured in
       * Chrome at 1180x695 with the backup banner up and the last Hit Point
       * marked, the log is already 0px tall *before* this row is drawn - the
       * panel is 197 tall holding 277.9 of declared content - so the 44 this
       * row asks for does not come out of the log. It comes off the bottom of
       * the column, and at 1280x800 in the same state it took this row's own
       * button to 15 of 44.
       *
       * The placement is still right, for a reason that survives the
       * measurement: the log gives way first *when it has anything to give*,
       * and past that the panel scrolls rather than clipping, so what the
       * order buys is that the two things a player presses stay adjacent and
       * stay last. ROLL and the damage offer are one scroll apart at worst
       * instead of one scroll apart with a log between them. Putting this row
       * after the log would separate them and put a readout in the gap.
       */}
      <DamageRow key={rollId} attack={attack} affordance={affordance} layout="desktop" />

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
 *
 * Exported because `Play` renders it too: Giorgio's fold order puts the
 * Experiences behind their own tendina under ROLL, and the ids it reads are
 * owned by `Play` for exactly that reason.
 */
export function ExperienceRow({
  experiences,
  armedExperiences,
  hopeAvailable,
  toggleExperience,
}: {
  experiences: Experience[];
  armedExperiences: string[];
  /** Hope on the sheet. What the armed chips will cost is worked out here. */
  hopeAvailable: number;
  toggleExperience: (id: string) => void;
}): React.JSX.Element | null {
  if (experiences.length === 0) return null;
  /*
   * The cost is derived here rather than taken as a prop, and that is the
   * difference between one number and two that can disagree. `DualityRoll`
   * works the same total out for `resolve`, off the same two lists; this
   * component's only caller is `Play`, several hundred pixels of document
   * away, and a `hopeCost` handed across that distance is a number waiting to
   * be computed from a stale list.
   *
   * One Hope per Experience. SRD, Hope & Fear: "You can spend multiple Hope to
   * utilize multiple Experiences." Nothing caps the count, so neither does
   * this; what caps it is the Hope on the sheet.
   */
  const hopeCost = experiences.filter((e) => armedExperiences.includes(e.id)).length;

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
 * Everything you declare before you roll. It wraps. It does not scroll.
 *
 * IT USED TO SCROLL SIDEWAYS ON THE COCKPIT, AND THAT HID FIVE OF THIRTEEN
 * CONTROLS. The row was `overflowX: 'auto'` with `scrollbarWidth: 'none'`, so
 * nothing on the glass said it scrolled and a mouse had no bar to drag. The
 * shelf's width reconstructs from the source: the middle grid track is capped
 * at `minmax(360px, 428px)` in `PlayDesktop`, less the roll panel's own 24 of
 * padding is 404, less the 93px `Duality Roll` title this row draws when
 * `!narrow` and less `.spread`'s 8px gap leaves 303. What it holds
 * reconstructs too, at the five Experiences an SRD character carries from
 * level 8: REACTION 62.2, DIS/—/ADV at 34 each, five chips at their 124px
 * `maxWidth`, `+ DIE` 45.4, DIFF 88.4, SPELLCAST 68.4, and twelve 6px gaps -
 * 1058.4, against 1058 measured in Chrome. It is byte-identical at 1180,
 * 1280, 1440 and 2560, because the track never widens: a bigger monitor
 * bought nothing at all.
 *
 * Painted, per control, against that 303: REACTION 62.2 of 62.2, the three
 * advantage chips whole, the first Experience 108.8 of 124, and then zero.
 * Four Experience chips, `+ DIE`, DIFF and SPELLCAST all painted 0.0px.
 * SPELLCAST is at least named elsewhere - the trait box beside the dice reads
 * `SPELLCAST · KNOWLEDGE` - but DIFF is named nowhere else before a roll:
 * `armedMods` is rendered only in the phone branch. On the cockpit the
 * difficulty control was not small, it was absent.
 *
 * SO THE SAME ANSWER THE PHONE ALREADY HAD. This file's own comment above the
 * phone's `{modifiersOpen && control}` argued it in as many words - "ten
 * controls in about 480px of content showed four of themselves at 393px, and a
 * chip you had armed could be off the side by the time you reached ROLL" - and
 * the cockpit is the same sentence with worse numbers: thirteen controls in
 * 1058px of content showing four and a half of themselves in 303. Declaring a
 * modifier you cannot see is not a declaration, and the SRD requires the
 * declaration before the dice.
 *
 * WHAT IT COSTS, DERIVED RATHER THAN ESTIMATED. Flex wrap packs greedily into
 * 303 with a 6px gap. At the two Experiences a level-3 character has: row 1
 * takes REACTION + the three advantage chips (182.2 wide, 34 tall), row 2
 * takes both chips and `+ DIE` (281 wide, 44 tall because `ExperienceChip` is
 * `minHeight: var(--tap)`), row 3 takes DIFF and SPELLCAST (162.8 wide, 34
 * tall). 34 + 44 + 34 + two 6px row gaps = 124, against 44 for the single row
 * it replaces: **+80px**. At five Experiences it is five rows -
 * 34 + 44 + 44 + 44 + 34 + four gaps = 224, so **+180px**. That is why this
 * change had to land *after* the panel was allowed to scroll and never before
 * it: on a 1180x695 window it would otherwise have taken all 80 straight off
 * ROLL, which was already painted 0.0px.
 *
 * ERGONOMICS. The cockpit is 1180px and up, so the reference is a mouse and a
 * touchscreen laptop rather than 393x852's thumb arc - but tokens.css widens
 * `--control` to `var(--tap)` under `(pointer: coarse)` at any width, so on
 * glass every chip here is 44px and on a mouse 34, which are this project's
 * two floors. Wrapping changes neither: it changes how many of them are
 * painted, from eight of thirteen to thirteen. READ VERSUS TOUCH is what the
 * extra rows are spent on, and they are spent in the right direction - this
 * row is the *declaration*, everything in it is read before it is touched and
 * touched before ROLL is, and it stays above the dice faces and above ROLL
 * where the rules order puts it. The 80-180px lands between the top of the
 * panel and ROLL, which on a short window means ROLL is now something you
 * scroll to; that is a worse reach than a 695px-tall laptop deserves and it is
 * still strictly better than a control that no pointer could reach at all.
 *
 * ONE THING NOT DONE, WITH ITS NUMBER. The `Duality Roll` title costs the
 * shelf 93 + 8 = 101 of 404, a quarter of the row, and its own comment already
 * calls it "a desktop luxury" and argues that REACTION carries the state it
 * names. Dropping it on the cockpit as well would give the shelf 404 and take
 * the wrap cost to +50 and +100 instead of +80 and +180. That is a change to
 * what the panel says, not to whether it can be reached, so it is written down
 * here rather than made here.
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
}: ControlProps): React.JSX.Element {
  const [picking, setPicking] = useState(false);
  const narrow = useIsNarrow();

  // The picker takes over the whole row, the way a die takes over its own face
  // to be typed into. A popover would either be clipped by the panel or open
  // off the side of a row this narrow.
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
      {/* The title is a desktop luxury, and now the cockpit's only one: below
          1180 it is 99px of a 369px row spent on a word, and REACTION leads
          instead, so the state the title carried - which kind of roll this is
          - is still the first thing on the row. On the cockpit it costs the
          controls 93 of the 404px the panel has, which is measured in the
          docblock above and is the next thing to reconsider here. */}
      {!narrow && (
        <span className="t-label" style={{ flex: 'none' }}>
          {reaction ? 'Reaction Roll' : 'Duality Roll'}
        </span>
      )}
      {/*
        `flexWrap: 'wrap'` unconditionally, and no overflow of any kind.
        This used to be `wrap ? … : …` on a prop the phone passed true and the
        cockpit passed false, and the false branch was `overflowX: 'auto'` with
        `scrollbarWidth: 'none'` - a 303px shelf holding 1058px that announced
        nothing and gave a mouse no bar. The ternaries are gone rather than
        pinned to `true`, because a dead branch that says "this can scroll
        sideways" is the same defect as a docblock that says it. `overflowY`
        went with them: `overflow-y: hidden` beside an `overflow-x: visible`
        computes the x axis back to `auto`, so the phone's wrapped row has
        quietly been a horizontal scroll container this whole time.
      */}
      <div className="row" style={{ flex: 1, minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
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
