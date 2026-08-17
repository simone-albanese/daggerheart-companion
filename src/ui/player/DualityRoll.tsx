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
  /** Ask the roll surface to swap both faces for the keypad. */
  onEdit: () => void;
  size: number;
  editable: boolean;
}

/**
 * The keypad a physical die is typed into. It takes the whole face row, and
 * that is the fix rather than the styling.
 *
 * IT USED TO TAKE ONE FACE, AND ONE FACE IS NOT WIDE ENOUGH TO HOLD IT. The
 * twelve keys are `repeat(4, 1fr)` with `gap: 3`, `padding: 6` and a 1.5px
 * border that lays out as 1 at dpr 1, so a key is `(G - 23) / 4` for a grid of
 * outer width G, and they carry `minHeight: var(--control)` and no `minWidth`
 * at all - the width simply falls out of whatever box they are in.
 *
 * Inside one die face, G was half the row: on a phone the column is the
 * viewport less 24 of padding, the face row gaps by 8, so G = (vw - 32) / 2 and
 * a key is **(vw - 78) / 8** - 30.3px at 320, 35.3 at 360, **37.1 at 375**,
 * 39.4 at 393, and still under 44 all the way to 429px of viewport. On the
 * cockpit the die face is narrower still: the middle grid track is 428, less
 * the panel's border and padding is 402, less the 132px trait box and two 12px
 * gaps leaves 246 for two faces, so G is 123 and a key is **24px wide**, which
 * is what the audit measured in Chrome at 1440x900 (grid 119x122, four 24px
 * columns). My reconstruction from the declared track gives 24.75 if the
 * border lays out at its declared 1.5 and 25.0 if it rounds to 1, and I could
 * not close the last pixel against the measured 24; the measurement is the one
 * used here and all three numbers say the same thing. 24 is under this
 * project's 34px fine-pointer floor, under its 44px
 * coarse one, and under WCAG's 24 by a hair - on the control a player uses to
 * type the number they just rolled on a real die.
 *
 * NO COLUMN COUNT FIXES THE COCKPIT, WHICH IS WHY THE WIDTH HAD TO MOVE. Four
 * 34px keys need 4 * 34 + 9 of gaps + 12 of padding + 2 of border = 159px of
 * grid, and the cockpit die face is 123. Three need 122, which is inside 123
 * by one pixel and is not a margin. `repeat(auto-fit, minmax(var(--control),
 * 1fr))` is the CSS-native form of that arithmetic and it lands on three 34.33
 * columns for a mouse - a third of a pixel of slack over the floor - and on
 * TWO for a touchscreen laptop, where `(pointer: coarse)` takes `--control` to
 * 44: six rows of keys, 293px replacing a 62px row. The audit proposed a
 * `--die-keys` token switched at 437px instead, which fixes the phone and
 * leaves the cockpit at 24. Taking the whole face row fixes both: the keypad
 * is `flex: 1` where the two faces were, so G is 299 at 375 and 206 on the
 * cockpit, and a key is **69px** and **45.75px**. Above 44 at every width in
 * the audit sweep, 320 included, where it is 55.25 - so it needs no breakpoint
 * of its own, which `useLayout.ts` forbids a component to invent, and no new
 * token in a stylesheet.
 *
 * IT COSTS NO HEIGHT. The grid is still three rows of `var(--control)` with two
 * 3px gaps, 12 of padding and 2 of border: 152 on a phone and 122 on the
 * cockpit, exactly what it measured before. It replaced a 62px face row then
 * and it replaces a 62px face row now.
 *
 * AND IT HAS A WAY OUT, WHICH IS BACKLOG P3-12. The grid replaced the die
 * button while it was open, so there was nothing left to tap again: no cancel,
 * no backdrop, no Escape, and the only exit was committing a face - typing a
 * number you did not roll to get out of a keypad you opened by accident. The
 * die's own label is that exit now. It is a full-height 44px column at the head
 * of the row, so it costs no height at all, and it does the second job the
 * one-face keypad did for free: saying which die you are typing.
 *
 * ERGONOMICS. TARGET SIZE is the whole charge and it moves from 24x34 and
 * 37.1x44 to 45.75x34 and 69x44, clear of both floors in both directions, with
 * the 3px gutter left alone - it is a gutter between 45-to-69px targets now
 * rather than between 24px ones, and widening it would come straight back out
 * of the keys. THUMB ARC: on a phone this row sits directly above ROLL, the
 * band the file's own docblock calls the best on the screen, and the keys are
 * where they already were; what moved is the exit, to the LEFT edge, away from
 * where a right thumb rests. That is deliberate and it is the same argument
 * MODS is placed on - except inverted, because here the resting corner is a
 * digit and a digit is the consequential press. READ VERSUS TOUCH: the label
 * you read to know which die this is now sits at the start of the row rather
 * than being the thing that vanished, and the twelve things you touch follow
 * it left to right, top to bottom.
 */
function DieKeypad({
  label,
  color,
  value,
  onSet,
  onCancel,
}: {
  label: string;
  color: string;
  value: number | null;
  onSet: (value: number) => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="row" style={{ flex: 1, minWidth: 0, gap: 8, alignItems: 'stretch' }}>
      <button
        type="button"
        onClick={onCancel}
        aria-keyshortcuts="Escape"
        aria-label={`Stop typing the ${label} die`}
        title="Back to the dice"
        style={{
          flex: 'none',
          width: 'var(--tap)',
          minWidth: 'var(--tap)',
          background: 'var(--app)',
          border: `1.5px solid ${color}`,
          borderRadius: 'var(--r4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span className="t-meta" style={{ color, letterSpacing: '0.14em' }}>
          {label}
        </span>
        <span aria-hidden="true" style={{ font: '600 15px/1 var(--sans)', color }}>
          ×
        </span>
      </button>
      <div
        style={{
          flex: 1,
          minWidth: 0,
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
            onClick={() => onSet(n)}
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
    </div>
  );
}

/**
 * A die face. It reports what the die showed, and when `editable` it is also
 * the way into the keypad, so physical dice have somewhere to go.
 *
 * Not editable is the default state of the app, and then this is a readout and
 * says so: no pointer cursor, and an accessible name without the invitation to
 * tap. A control that looks pressable and does nothing is worse than a label.
 *
 * The keypad used to live in here, in a `useState` of its own, and returned in
 * place of this button. It is `DieKeypad` now and the roll surface owns which
 * die is being typed, because a keypad that fits inside one face is a keypad
 * with 24px keys on the cockpit - the arithmetic is over `DieKeypad`.
 */
function Die({ label, color, value, onEdit, size, editable }: DieProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => editable && onEdit()}
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
  /*
   * Which face the keypad is open on, and why it is not `Die`'s own state.
   *
   * The keypad needs the whole face row to hold twelve targets at the floor -
   * inside one face it was 24px wide on the cockpit, and the arithmetic is
   * over `DieKeypad`. A component that replaces both of its siblings cannot be
   * one of them, so the surface that draws the row owns the answer to "which
   * die is being typed" and both layouts read it.
   */
  const [typing, setTyping] = useState<'hope' | 'fear' | null>(null);

  /*
   * The keyboard's way out, beside the pointer's.
   *
   * `DomainCardView` already argues that the three ways out of an overlay are
   * not equal and that Escape is the keyboard's; this is not an overlay and
   * cannot use `useDialog`, which traps Tab and moves focus, but the key is
   * free and its absence was half of BACKLOG P3-12. It is a window listener
   * rather than an `onKeyDown` on the grid because the tap that opens the
   * keypad unmounts the button that had focus, so there is nothing inside it
   * for a bubbling handler to catch until something is tabbed to.
   */
  useEffect(() => {
    if (typing === null) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setTyping(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [typing]);
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
    // And the keypad shuts with them. It is opened on a face, the face it was
    // opened on has just been cleared, and a keypad standing over an arriving
    // sheet is this component's oldest bug in its newest control.
    setTyping(null);
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
    // Committing a face shuts the keypad, which is what it always did - it is
    // just no longer the ONLY thing that shuts it. See `DieKeypad`.
    setTyping(null);
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

  /*
   * The keypad, or nothing - one element read by both layouts, for the reason
   * `control` is one element read by both layouts. The switches can be turned
   * off while it is open, and then it is nothing: `canType` is the gate on
   * every way in, so it has to be the gate on the way already taken.
   */
  const typingDie = canType ? typing : null;
  const keypad =
    typingDie === null ? null : (
      <DieKeypad
        label={typingDie === 'hope' ? 'HOPE' : 'FEAR'}
        color={typingDie === 'hope' ? 'var(--hope)' : 'var(--fear)'}
        value={manual[typingDie]}
        onSet={setDie(typingDie)}
        onCancel={() => setTyping(null)}
      />
    );

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
            {keypad ?? (
              <>
                <Die
                  label="HOPE"
                  color="var(--hope)"
                  value={manual.hope}
                  onEdit={() => setTyping('hope')}
                  size={26}
                  editable
                />
                <Die
                  label="FEAR"
                  color="var(--fear)"
                  value={manual.fear}
                  onEdit={() => setTyping('fear')}
                  size={26}
                  editable
                />
              </>
            )}
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
   * IT USED TO BE `overflow: 'hidden'`, AND THAT COST THE SCREEN ROLL.
   * Measured in Chrome at 1180x695 with the backup banner up and the last Hit
   * Point marked, this panel was 197 tall holding a scrollHeight of 277, and
   * ROLL's 54px box was laid out at y 677.9 against a panel bottom edge at y
   * 674: painted 0.0px. Both of those conditions are default states of a fresh
   * install rather than contrivances, and 695 is this repository's own stated
   * constraint - `Vitals` says "a 1440x695 laptop viewport is the real
   * constraint, not the 900px mock". The same clip took `DamageRow`'s
   * `IF IT HIT · 4d8+6` to 15 of its declared 44 at 1280x800.
   *
   * WHAT IT HOLDS NOW, TERM BY TERM. Every term is declared in this file or in
   * a stylesheet this file names, so the sum reads off the source; the version
   * of this table that argued for the scroll got two of them wrong and the
   * errors cancelled, which is why the terms carry their derivations now.
   *
   *   24    this panel's own `padding: 12`, top and bottom.
   *   155.3 the control row at five Experiences. NOT 44: `ControlRow` wraps,
   *         and its docblock packs the rows. 44 is the one-row height it had
   *         while it scrolled sideways and hid five of thirteen controls.
   *   76    the dice row. NOT `Die`'s `minHeight: 62`, which never binds on
   *         this layout: `Die` is drawn `size={46}` here, so its own content is
   *         10 of `t-meta` label + 46 of number + 18 of padding + 2 of border =
   *         76. The 62 binds on the phone, where `size={26}` makes it 56.
   *   38.9  the verdict strip idle: 20 of padding around a
   *         `clamp(16px,1.6vw,22px)/1` line, 18.88px at a 1180px window.
   *         Measured 38.9 at 1180 and 40.5 at 1280. After a roll the second
   *         span wraps and it measures 57.8 to 64 - content, not declaration.
   *   54    ROLL's own declared height, and it is `flex: none`.
   *   38    `RecentLog`'s floor - 15 of RECENT label and gap, plus one 23px
   *         entry. It was `minHeight: 0` and measured 0, which is why the log
   *         has a docblock of its own now.
   *   40    four 10px gaps.
   *
   * 426.2, against a scrollHeight of 426 measured idle at 1180x695. ROLL is
   * painted 54 of 54 in that state, because the two terms that come after it
   * are the two the panel can afford to put below the fold.
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
   * comes last and is the one `flex: 1` child, so it is the first to give
   * height up and the last thing the fold takes. AN EARLIER REVISION OF THIS
   * PARAGRAPH SAID "the panel only scrolls once the log is at zero", AND THAT
   * WAS A FLOOR THE LOG DID NOT HAVE. It went to zero and its content went with
   * it: a zero-height child adds nothing to this panel's scrollHeight, and the
   * log's own box is `.scroll`, so its 69px of entries were not in this panel's
   * overflow to be scrolled to. `RecentLog` declares a 38px floor now and the
   * sentence is true as written. What a player scrolls to is therefore always
   * the bottom of the column - the thing they were about to press, and then the
   * one thing here they only read - never a readout they have to hunt back up
   * for.
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
        {/* The keypad takes the two faces' share of the row and leaves the
            trait box, which is where the total is printed - the one number you
            want in front of you while you type the two that make it. */}
        {keypad ?? (
          <>
            <Die label="HOPE" color="var(--hope)" value={manual.hope} onEdit={() => setTyping('hope')} size={46} editable={canType} />
            <Die label="FEAR" color="var(--fear)" value={manual.fear} onEdit={() => setTyping('fear')} size={46} editable={canType} />
          </>
        )}
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
       * spare it - and that was only true while the log had height to give.
       * Measured in Chrome at 1180x695 with the backup banner up and the last
       * Hit Point marked, the log was 0px tall *before* this row was drawn, so
       * the 44 this row asks for came off the bottom of the column instead, and
       * at 1280x800 in the same state it took this row's own button to 15 of
       * 44. The log has a 38px floor now, so what this row takes comes out of
       * the log's *growth* first and out of the panel's scroll after that -
       * never out of the log's floor, which is the point of a floor.
       *
       * The placement is right for a reason that does not depend on any of
       * that: the two things a player presses stay adjacent and stay last. ROLL
       * and the damage offer are one scroll apart at worst instead of one
       * scroll apart with a readout in the gap.
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
         * row is 44px for the touch floor rather than for the text, so at one
         * or two lines the bigger type costs no height at all - 13.225px of
         * line-height twice over, plus 4 + 4 of padding, is 34.45 inside a 44.
         * At three it costs 3.7, and the clamp below argues why that is the
         * right trade.
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
       * Wrapping, not an ellipsis - and three lines, not two.
       *
       * "SILVER-TONGUED DIPLOMAT" truncated to "SILVER-TONG…" on a phone, and
       * the full name lived only in the title attribute and the accessible
       * name - neither of which a thumb can reach. An Experience is a phrase
       * the player wrote themselves; being unable to read it back on the one
       * screen that spends it is a poor trade for a tidier chip.
       *
       * TWO LINES WAS THE SAME DEFECT ONE STEP FURTHER ALONG. The clamp came in
       * with the docblock that claims the fix, and on both narrow surfaces it
       * went on hiding a whole line. `line-height: 1.15` on `11.5px` is
       * 13.225px, so two lines clip at 26.45 and three want 39.675 - the 14px
       * of hidden text the audit measured, in Chrome, twice: on the cockpit
       * chip at its 124px `maxWidth` (span 77.8 wide, clientHeight 26,
       * scrollHeight 40) for "SILVER-TONGUED DIPLOMAT", "Read every book in
       * the tower" and "Talked my way past a magistrate" alike, and on the
       * phone at 375x1000 for a character with five Experiences, where
       * `ExperienceRow` goes two across and the chip is 172.5 with a 126.3px
       * span. The crossing on the phone is exactly 381px of viewport.
       *
       * WHAT THREE COSTS: 3.7px, ONCE. 39.675 of text plus this chip's own 4 +
       * 4 of padding is 47.675 against a `minHeight: var(--tap)` of 44, and
       * `box-sizing: border-box` is set globally - so a chip that needs the
       * third line goes 44 -> 47.7 and one that does not is unchanged. Both
       * surfaces can carry it: the phone column scrolls, and the cockpit's roll
       * panel scrolls too now.
       *
       * WHY NOT THE OTHER PROPOSAL, WHICH WAS TO WIDEN THE COCKPIT CHIP FROM
       * 124 TO 168. It loses on two counts and both are numbers. It does not
       * touch the phone, where the same declaration hides the same 14px on a
       * 172.5px chip - one line of code covers both surfaces and one of the two
       * fixes only covers one of them. And it costs the cockpit far more than
       * this does: the modifier shelf is 303px wide, so at 168 two chips plus
       * their 6px gap is 342 and every Experience takes a wrapped row of its
       * own - five rows of 44 where 124px chips pack two to a row. That is
       * about +96px against +3.7. Its stated premise, that the roll panel is
       * `overflow: hidden` and has no spare height, was true when it was
       * written and is no longer; the arithmetic would have decided it either
       * way.
       *
       * ERGONOMICS. TARGET SIZE moves the right way and only the right way:
       * 44 -> 47.7 on the chips that need the third line, above this project's
       * 44px coarse floor and its 34px fine one in both states, with the width
       * untouched at 172.5 on a two-across phone and at most 124 on the
       * cockpit - width was never the charge here. THUMB ARC is the question of
       * whether 3.7px moves a neighbour under a thumb that was aiming at this
       * chip, and it does not: `ExperienceRow` gaps its rows by 6, so a row
       * that grows by 3.7 still ends short of where the next row's targets
       * begin, and everything below simply shifts down inside a column that
       * scrolls. READ VERSUS TOUCH is the whole reason for the change. The
       * name is the entire content of this control - there is no other text to
       * an Experience - so a chip whose third line is clipped is a target you
       * are asked to press without being allowed to finish reading it, at the
       * exact moment you decide to spend a Hope on it.
       *
       * THREE AND NOT UNBOUNDED. The clamp is still a clamp, because the name
       * is text a player typed and nothing stops it being sixty characters -
       * six lines and an 87px chip on the primary roll surface. Three clears
       * every string in the audit's bisect, the longest of which is the 31
       * characters of "Talked my way past a magistrate", and past it the full
       * name is still spelled out on the ROLL bar the moment the chip is armed,
       * which is `armSummary`'s whole job.
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
          WebkitLineClamp: 3,
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
 * They used to live in the control row, which scrolled sideways, behind
 * REACTION and the advantage group - so on a 393px phone the second one was
 * already off screen, and the file's own comment admitted that a chip you had
 * armed could be out of sight by the time you reached ROLL. Declaring a
 * modifier you cannot see is not a declaration. (That row wraps now, on every
 * layout, and `ControlRow`'s docblock carries the cockpit numbers that forced
 * it. The Experiences still get a row of their own on a phone, because
 * `ControlRow` is behind MODS there and a declaration behind a tap is not a
 * declaration in front of you.)
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
   * and would not fit a 375px phone at all. At two across a chip is 172.5px at
   * 375 and 175 at 380 - measured, and the docblock's old estimate of "about
   * 175px" was right - which leaves the label span 126.3 and takes it to
   * roughly 16 characters a line. That is short of the longest names, so the
   * label wraps rather than truncating; it wraps to THREE lines and not two,
   * because at two this row hid a whole 14px line of every name past about 33
   * characters, and the crossing was measured at exactly 381px of viewport.
   * Past three the ROLL bar is what spells out in full whatever is armed.
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
 * at `minmax(360px, 428px)` in `PlayDesktop`, less the roll panel's own 2 of
 * border and 24 of padding is 402 - measured 402, and the 404 this docblock
 * used to say was that arithmetic with the border left out - less the 93px
 * `Duality Roll` title this row used to draw when `!narrow` and less
 * `.spread`'s gap left 302.8. What it holds
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
 * AND THE TITLE WENT, BECAUSE THE WRAP COST HAD TO COME DOWN. `Duality Roll`
 * was 93 of the 402 the panel has, a quarter of the shelf, and its own comment
 * called it "a desktop luxury" while arguing that REACTION carries the state it
 * named - which it does: REACTION is the first control on the row, it is
 * `aria-pressed`, and it turns `--fear` when a reaction roll is armed. An
 * earlier revision of this docblock wrote that down as "one thing not done".
 * It is done, it is worth 74.4px of shelf, and the reason it stopped being a
 * matter of taste is in the measurements below.
 *
 * WHAT IT COSTS, MEASURED AND NOT ESTIMATED. Flex wrap packs greedily into 402
 * with a 6px gap, and `ExperienceChip` is the only thing here that is not
 * `var(--control)` tall: it is `minHeight: var(--tap)`, and 44 becomes 49.7
 * when a name takes the third line the clamp now allows (1 of border + 4 + 3 *
 * 13.225 + 4, `box-sizing: border-box`).
 *
 *   Two Experiences, the `played` fixture at level 3. Row 1 is REACTION +
 *   DIS/—/ADV + the first chip (312.2 of 402); row 2 is the second chip, `+
 *   DIE`, DIFF and SPELLCAST (319.5). Both names fit two lines, so 44 + 6 + 44
 *   = **94**, against the 44 of the single row it replaces: **+50**.
 *
 *   Five Experiences, `wizard10`, which is what an SRD character carries from
 *   level 8. Row 1 REACTION + DIS/—/ADV + one chip (312.2), row 2 three chips
 *   (384), row 3 the last chip + `+ DIE` + DIFF + SPELLCAST (344.2). Rows 1 and
 *   2 each hold one of the two long names, so 49.7 + 49.7 + 44 + two 6px row
 *   gaps = 155.4. Measured 155.3. **+111.3**.
 *
 * At the 302.8 the title left, the same five Experiences packed into five rows
 * and measured 229.7 - +185.7, not the +180 an earlier revision derived, and
 * the difference is exactly the third line the chip commit added. That was
 * enough to push ROLL below the panel's fold at 1280x800, which is the reason
 * the title is gone rather than deferred.
 *
 * WHERE ROLL IS NOW, at five Experiences, `wizard10`, campaign on, measured in
 * Chrome. With the backup banner up - a default state of a fresh install, and
 * the state this file's other docblocks measure in: 1280x800 panel 418 client /
 * 418 scroll, ROLL painted 54 of 54; 1366x768 386/413, painted 49; 1180x695
 * 313/407, painted 0 and one scroll away. With the banner dismissed: 1280x800
 * 474/474 painted 54, 1366x768 442/442 painted 54, 1440x900 574/574 painted 54,
 * 1180x695 369/407 painted 37.9. Before the wrap and before the title went, the
 * same five Experiences took ROLL to 29.9 of 54 at 1280x800; before the panel
 * was allowed to scroll at all it was 0.0 of 54 at 1180x695 with no wheel, drag
 * or tap that reached it. A 695px-tall window with a banner on it is still a
 * scroll, and that is what the fade and the bar on the panel are for.
 *
 * ERGONOMICS. TARGET SIZE, and the pointer facts an earlier revision of this
 * paragraph got wrong. tokens.css:203-207 is `(max-width: 1179px), (pointer:
 * coarse)`, and `pointer` describes the *primary* pointer - so on the cockpit,
 * which is 1180 and up, `--control` is 34 for a mouse AND for the touchscreen
 * laptop this paragraph used to claim got 44. Measured with the rig's `hybrid`
 * profile (`pointer: fine` with `any-pointer: coarse`) at 1280x800 and
 * 1440x900: `--control` 34px, `--pip-h` 44px. tokens.css:129-132 says so in as
 * many words. So the shelf is REACTION 62.2x34, DIS/—/ADV 34x34, `+ DIE`
 * 45.4x34, DIFF 88.4x34, SPELLCAST 68.4x34, and the Experience chips 124x44 or
 * 124x49.7 - clear of this project's 34px fine floor and, for the chips, of its
 * 44px coarse one, but 10px under that coarse floor for a finger on a
 * touchscreen laptop. That is a live defect of `--control`'s query and not of
 * this row; it is written up in the lane's doc-deltas file, and the reason
 * tokens.css:122-127 gives for not widening the query - that this panel is
 * `overflow: hidden` and would crush its own contents - died when the panel was
 * allowed to scroll.
 *
 * THUMB ARC does not apply on its own terms here and the honest substitute is
 * reach: this row is at the top of the middle column, the far end of a reach
 * across a keyboard, and it is the only thing on this screen you touch *before*
 * the dice - so paying for it in reach and getting ROLL, which you touch every
 * turn, at the near end is the right way round. READ VERSUS TOUCH is what the
 * extra rows buy. This row is the declaration: everything in it is read before
 * it is touched and touched before ROLL is, and wrapping takes it from eight of
 * thirteen controls painted to thirteen. A declaration you cannot see is not a
 * declaration, and the SRD requires it before the dice.
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

  // The picker takes over the whole row, the way `DieKeypad` takes over the
  // whole face row to be typed into - both for the same reason, which is that
  // a control with eight or twelve targets in it needs the width. A popover
  // would either be clipped by the panel or open off the side of a row this
  // narrow.
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
    /*
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

      THIS ROW IS THE WHOLE COMPONENT NOW. It used to be the second child of a
      `.spread`, beside a `Duality Roll` title drawn when `!narrow` - that is,
      on the cockpit only, which is the one surface that could not afford it.
      The title and its wrapper went together: a flex container with a single
      `flex: 1` child is that child with extra steps.
    */
    <div className="row" style={{ minWidth: 0, gap: 6, flexWrap: 'wrap' }}>
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
  );
}

/**
 * What you rolled, on the cockpit only - this is the app's one log surface.
 *
 * IT HAD NO FLOOR, AND THAT COST IT EVERYTHING. This is the roll panel's only
 * `flex: 1` child, so it absorbs whatever the panel is short of, and with
 * `minHeight: 0` "whatever" had no bottom: measured in Chrome with `wizard10`
 * and three rolls made, this box was 0 tall at 1180x695, 1280x800 and 1366x768
 * alike, and its three 23px entries were painted 0.0px each.
 *
 * MAKING THE PANEL SCROLL DID NOT SAVE IT, which is the part worth writing
 * down. A zero-height child contributes nothing to its parent's scrollHeight,
 * and this box's own content lives behind `.scroll` - `overflow-y: auto` - so
 * it does not join the panel's overflow either: the panel's scrollHeight was
 * 485 against 418 of client with a 69px log that was in neither number. Laid
 * out, invisible, and not reachable by any scroll on the screen. That is P2-1's
 * signature, in a control that had been fully painted the week before.
 *
 * SO A FLOOR, AND IT IS 38. `minHeight: 0` becomes 38 = the 15 the RECENT label
 * and its 5px gap measure, plus one 23px entry. Two things follow. The panel's
 * scrollHeight grows by 38, so the log is *in* the panel's overflow and one
 * scroll reaches it, instead of being squeezed out of the sum entirely. And 38
 * is a floor rather than a size: `flex: 1` still grows this box into whatever
 * the panel has spare, which measured 63.7 at 1280x800, 125 with the two
 * Experiences of the `played` fixture, and 160.7 at 1440x900.
 *
 * ONE ENTRY AND NOT THREE. Three would be 84 and would cost the panel another
 * 46px of scroll at every window, and this is the one thing in the panel that
 * is read back rather than acted on - it comes after ROLL and after the damage
 * offer in draw order for exactly that reason. What the floor has to buy is
 * that the log is *there* and says what your last roll was; the rest of it is
 * behind this box's own scroll, which is where the other eleven entries have
 * always been.
 */
function RecentLog(): React.JSX.Element {
  const log = useApp((s) => s.log);
  return (
    <div className="stack" style={{ flex: 1, minHeight: 38, gap: 5 }}>
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
