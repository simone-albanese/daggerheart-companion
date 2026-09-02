/**
 * A Favor instead of the Hope, offered after the roll that earned it.
 *
 * The Warlock's Favor feature: *"Additionally, when you succeed on an action
 * roll with Hope, you can choose to gain a Favor instead of a Hope."* Every
 * other clause of that feature is somebody else's - the three you start with is
 * `newCharacter`'s, the ceiling of six is `MAX_FAVOR`'s, the downtime tribute
 * is not a roll at all - and this is the clause that happens on the Duality
 * Roll, which is why it is drawn here and nowhere else.
 *
 * IT OFFERS AND DOES NOT APPLY, which on this one is a sentence with teeth
 * rather than a house style. `DualityRoll`'s `resolve` has always applied the
 * roll's Hope the instant it resolves - "proposed by applying them, because
 * they are unambiguous" - so by the time anybody can be asked, the Hope is
 * already marked on the sheet. The choice is therefore an EXCHANGE and not a
 * gift: accepting adds the Favor **and takes that Hope back off the track**. A
 * player who ended a roll holding both would have been paid twice for one
 * success, which is the defect this file is mostly written against.
 *
 * AND IT TAKES BACK ONLY WHAT ARRIVED. `resolve` marks the Hope through
 * `Math.min(c.hope.max, …)`, so a player already at their Hope maximum gained
 * nothing to give back - the point was clamped away before it landed. Taking a
 * Hope off that sheet would be the same defect in a mirror: a Warlock who ends
 * the exchange one Hope down and one Favor up has PAID for something the rules
 * hand over free. So the roll records what it actually paid the track -
 * `Rolled.hopeGained`, 0 or 1 - and this row gives back exactly that. It is
 * also the case where the offer is worth the most, so it is not hidden: it says
 * so instead, in the detail line.
 *
 * Both halves were driven in the running app, not only asserted in jsdom. From
 * 5 of 6 Hope: the roll marked the sixth, the row read *"Instead of the Hope
 * this roll gave you"*, and taking it left HOPE at 5 of 6 and FAVOR at 4. From
 * 6 of 6: the roll's Hope was clamped away, the row read *"Your Hope was
 * already full, so this one costs you nothing"*, and taking it left HOPE at 6
 * of 6 and FAVOR one higher. The second is the one that silently costs a player
 * a Hope if this is written as an unconditional `- 1`.
 *
 * WHY IT IS ITS OWN FILE. The same two reasons `DamageRoll.tsx` gives, and the
 * first one is nearly word for word: this row asks `favorOffer` for the verdict
 * and never reads `result.succeeded` itself, because that field has three
 * values and the third is `null` - returned on purpose when the GM has not
 * shared the Difficulty. An `if (result.succeeded)` here reads that null as a
 * failure and silently takes the whole feature away from every table that keeps
 * its Difficulties hidden. The second is mechanical:
 * `tests/ui/rollAffordance.test.ts` reads `DualityRoll.tsx` as text and counts
 * `<Die`, `editable={canType}` and `disabled={!canRoll}` in it, and a control
 * written inside that file has to be written around those counts.
 *
 * THE RULE IS EXPORTED FROM HERE RATHER THAN FROM A MODULE OF ITS OWN.
 * `damageOffer` lives in `attack.ts` because two files ask it - `DamageRoll`
 * and `Play` - and a verdict two surfaces could answer differently is the thing
 * that module exists to prevent. `favorOffer` has exactly one caller in the app,
 * one function below its own declaration. What matters is that the verdict is a
 * named pure function a test can drive without mounting anything, and that is
 * true of it here.
 */
import { useEffect, useRef, useState } from 'react';
import type { Counter } from '../../../shared/types.ts';
import { drawsFavor } from '../../engine/character.ts';
import type { DualityResult } from '../../engine/dice.ts';
import { useActive, useApp } from '../../store/state.ts';

/**
 * What this roll lets a Warlock do about their Hope, in words.
 *
 * `show` is whether there is a CONTROL, exactly as `DamageOffer` uses it; a
 * `null` return is the row not existing at all. Two channels because there are
 * genuinely three answers - press this, read this, nothing here - and the
 * middle one is the one a screen must not turn into a blank.
 */
export interface FavorOffer {
  /** Whether there is something to press. */
  show: boolean;
  kind: 'take' | 'unknown' | 'failed' | 'full';
  label: string;
  detail: string;
}

/**
 * The verdict, from the roll and the track and nothing else.
 *
 * ## The gate is `effects.hope`, and it is one field on purpose
 *
 * The row speaks exactly when a Hope arrived, which is `result.effects.hope`
 * and is not four separate questions. Asked that way it excludes, for free and
 * without a second rule to keep in step:
 *
 *   - **a reaction roll**, where `dice.ts` zeroes every effect - *"they don't
 *     generate Hope or Fear… If you critically succeed on a reaction roll, you
 *     don't clear a Stress or gain a Hope"* - so there is no Hope to trade and
 *     no sentence to say about one;
 *   - **every roll with Fear**, success or failure, for the same reason.
 *
 * Re-deriving that from `withHope && !reaction` would be a second copy of the
 * engine's own rule, in the file least likely to be updated when it moves.
 *
 * ## A critical IS a success with Hope, and that was read rather than assumed
 *
 * This is the case that looks obvious and is not, so it is settled from the
 * book: the action-roll rules print *"Critical Success: … You automatically
 * succeed with a bonus, gain a Hope, and clear a Stress"* and then, as its own
 * line, *"Note: A Critical Success counts as a roll 'with Hope.'"* Both halves
 * of *"succeed on an action roll with Hope"* hold. `rollDuality` agrees in
 * three places - `succeeded` is forced true, `withHope` is `critical || hope >
 * fear`, and `effects.hope` is 1 - so nothing here has to special-case the
 * outcome label being `critical` rather than `success-hope`. The Stress the
 * critical clears is not part of the exchange and is not touched.
 *
 * Driven in Chrome as well as asserted: a Warlock rolled 8/8, the bar read
 * `Critical Success · Gain a Hope and clear a Stress · 17`, the row offered
 * `TAKE A FAVOR` with no caveat - a critical forces `succeeded` true even with
 * no Difficulty shared - and taking it moved Favor 3 to 4 while Stress stayed
 * on the 2 of 6 the critical had just cleared it to.
 *
 * ## The ordering of the two refusals
 *
 * The failure is checked before the ceiling because it is about THIS ROLL and
 * the ceiling is about the sheet: a Warlock holding six who also failed is
 * better told the thing that will be different next time. Both are statements
 * rather than dead controls, on `DamageRoll`'s rule that "a button still
 * carrying the word DAMAGE with `disabled` on it says the app could roll this
 * and won't".
 *
 * ## Why the full track explains itself instead of vanishing
 *
 * Six is the most a Warlock can hold, so a seventh is not a thing the app can
 * offer. It could simply draw nothing - and that is the wrong half of this
 * project's own rule, because by then the player has learned that this row
 * appears on every success with Hope, and its absence reads as the app having
 * lost the feature rather than as the rules having a ceiling. The sentence also
 * carries the only action available: spend one. It costs the column two lines
 * and no target, which is `Refusal`'s trade next door - measured at 41px in
 * Chrome at 393 against the 44 a control would have to clear, and 31 when the
 * detail fits one line.
 *
 * The failure branch is the same trade made on a commoner roll - a failure with
 * Hope is one of the five outcomes the rules name, not an edge - and it is paid
 * anyway, for the reason it is the roll where the offer is most expected: a Hope
 * DID arrive, and the only thing keeping the trade off the screen is one word of
 * the feature's own wording. Silence there is the app appearing to have dropped
 * the feature on a whole outcome.
 *
 * @param hopeGained what this roll actually put on the Hope track, 0 or 1 -
 *   NOT what it granted. See the file docblock: the two differ exactly when the
 *   player was already at their Hope maximum, and that is the case the wording
 *   has to get right rather than the case it can round off.
 */
export function favorOffer(
  result: DualityResult,
  favor: Counter,
  hopeGained: number,
): FavorOffer | null {
  if (result.effects.hope <= 0) return null;

  if (result.succeeded === false) {
    return {
      show: false,
      kind: 'failed',
      label: 'NO FAVOR · THE ROLL FAILED',
      detail: 'A Favor replaces the Hope from a success, so this one stays a Hope.',
    };
  }

  if (favor.marked >= favor.max) {
    return {
      show: false,
      kind: 'full',
      label: `FAVOR FULL · ${favor.marked} OF ${favor.max}`,
      detail: `${favor.max} is the most you can hold, so keep the Hope and spend a Favor first.`,
    };
  }

  /*
   * What the trade costs, said as a fact about this sheet rather than as a
   * rule. It is the second sentence in both live branches, so the player reads
   * the same clause whether or not the GM has shared the Difficulty.
   */
  const cost =
    hopeGained > 0
      ? 'Instead of the Hope this roll gave you.'
      : 'Your Hope was already full, so this one costs you nothing.';
  const held = `You hold ${favor.marked} of ${favor.max}.`;

  if (result.succeeded === null) {
    return {
      show: true,
      kind: 'unknown',
      label: 'TAKE A FAVOR IF YOU SUCCEEDED',
      detail: `The GM says whether you did. ${cost} ${held}`,
    };
  }

  return { show: true, kind: 'take', label: 'TAKE A FAVOR', detail: `${cost} ${held}` };
}

interface FavorRowProps {
  /** The roll this is about, or null when there is no verdict on the glass. */
  result: DualityResult | null;
  /** What the roll put on the Hope track: `Rolled.hopeGained`, 0 or 1. */
  hopeGained: number;
  layout: 'desktop' | 'phone';
}

/**
 * Something to say where a control would be.
 *
 * `DamageRoll.tsx`'s `Refusal` in shape and in argument - two lines of text, no
 * target, 31px instead of 52 - copied rather than imported for the reason
 * `ExtraSlot` copies `FaceSlot`: that component is not exported, and lifting it
 * into `ui/shared/` would mean rewriting a docblock about misses and reaction
 * rolls to be about neither. What is copied is the thing a table learns, which
 * is that a statement in this position is never a thing you can press.
 */
function Statement({ label, detail }: { label: string; detail: string }): React.JSX.Element {
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

/**
 * The row itself.
 *
 * ## Who sees it
 *
 * `drawsFavor`, which asks the dataset for a class feature named `~favor` and
 * asks it of both the class and the multiclass, and says yes as well to a sheet
 * already holding Favor under a class this build cannot name. Not
 * `classRef === 'warlock'`, for the reasons written over `grantsFavor`; not
 * `favor.max > 0`, because every one of the thirteen classes carries the track
 * and that test would answer yes for all of them. IT IS THE SAME PREDICATE THE
 * ROW UNDER VITALS DRAWS ITSELF WITH, and that is not a coincidence left to
 * drift: this screen and that one shipped from separate branches each holding
 * its own copy of the question, and the survivor is the permissive one so that
 * no sheet is ever drawn a track it is then refused the use of. A Bard is never
 * offered this, on any roll, at any
 * table.
 *
 * ## Once per roll, and the way that is guaranteed
 *
 * Two locks, and the outer one is structural. `DualityRoll` keys this on the
 * roll - `favor-${rollId}`, prefixed because the damage row beside it is keyed
 * on the same counter and two siblings may not share a key - so every resolve
 * mounts a fresh row, there is no state to reset, and there is nowhere for the
 * previous roll's answer to survive. `taken` is the inner lock, and the moment it is set the
 * button is REPLACED by the record of what happened rather than being disabled
 * beside it - so the second tap has nothing to land on. A flag alone would have
 * been a guard somebody can delete; a control that is not on the screen is not
 * a control that can be pressed twice.
 *
 * The record moves focus onto itself, which is the other half of removing a
 * control somebody has just used. `DualityRoll`'s keypad effect argues this at
 * length for its own case - "the exit button, or the key you pressed, is
 * unmounted by its own click, and without this focus falls to `<body>`" - and a
 * keyboard user who takes a Favor is in exactly that position. `tabIndex={-1}`
 * makes the record focusable programmatically and leaves it out of the tab
 * order, so Tab carries on from where the button was.
 *
 * ## Ergonomics
 *
 * TARGET SIZE: `minHeight: var(--tap)` and the full width of the column, so the
 * control is 44 tall - this project's coarse floor exactly, and the smallest of
 * the three controls in this block against `DamageRow`'s 52 and ROLL's 56. That
 * ordering is deliberate and is read by size alone: ROLL is the turn, the damage
 * is the number the table is waiting for, and this is a bookkeeping choice.
 *
 * MEASURED IN CHROME rather than derived, on a Warlock driven through the real
 * app at two widths. At **393x852** the row is **369x44**, laid out 6px under a
 * ROLL bar that measured 317x56 - the floor binds, because the worst label
 * (`TAKE A FAVOR IF YOU SUCCEEDED`, the one carrying both sentences) takes one
 * 15px line and two 10px lines, so 15 + 4 + 20 = 39 of content in 44. At
 * **320x568** it is **296x66**: the label wraps to two lines and the detail to
 * three, 30 + 4 + 30 = 64, and the box GROWS past its floor to hold them with
 * `document.scrollWidth === clientWidth` throughout. That growth is the whole
 * reason this is `minHeight` and not `height`; at 320 a fixed 44 would have
 * sawn 22px off the sentence that says what the trade costs.
 *
 * The two statements measured **369x41** at 393 - their details wrap to two
 * lines - and the record **369x31**, its one line fitting. So what the column
 * pays is 50 for the control, 47 for a statement and 37 for the record, each
 * including the stack's 6px gap.
 *
 * THUMB ARC: it sits between ROLL and the damage row, and not below both.
 * `DamageRow` holds the bottom edge because "when it exists it is the thing you
 * are about to press"; the band directly above it is still an easy reach and is
 * deliberately not the resting point, because a stray tap here SPENDS
 * something - it moves a Hope off the track - and this file's own rule is that
 * the resting point gets the harmless control. It is a single tap and not the
 * two `DamageRow` uses for a re-roll, because nothing here destroys a number
 * the table has already read aloud: the counters it moves are both on the
 * screen and both editable on the sheet above.
 *
 * READ VERSUS TOUCH: what is read is the second line - the cost of the trade
 * and the count, which is the only place in this build that prints how much
 * Favor you hold - and what is touched is the whole 44px box. After the tap
 * there is nothing to touch at all and the row is only read.
 */
export function FavorRow({ result, hopeGained, layout }: FavorRowProps): React.JSX.Element | null {
  const character = useActive();
  const index = useApp((s) => s.index);
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const [taken, setTaken] = useState(false);
  const record = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (taken) record.current?.focus();
  }, [taken]);

  if (result === null || character === null) return null;
  if (!drawsFavor(character, index)) return null;

  const favor = character.favor;

  if (taken) {
    return (
      <div
        ref={record}
        tabIndex={-1}
        className="stack"
        style={{
          flex: 'none',
          gap: 5,
          // `Statement`'s box plus a rule down the left, so the record is not
          // mistaken for one of the two refusals - which are the same two lines
          // in the same position. `--dread` is the Warlock's own domain colour
          // and the only thing in the palette that belongs to this class and to
          // nothing else on this screen.
          //
          // IT IS 2px OF RULE AND NEVER A LETTER OF TEXT, and the reason is that
          // the token is not the same colour in the two themes. Computed off
          // `tokens.css`'s own hex values: #6a4a7c on `--raised` #232733 is
          // 2.05:1 and #5a3a6c on the light `--raised` #ebe8e1 is 7.61:1, so a
          // label in it would be comfortably readable for half the users and
          // illegible for the other half - the worst kind of colour choice,
          // because the author sees whichever half they develop in. A border has
          // no contrast floor to clear. The two lines of text keep `Statement`'s
          // own colours, which are the ones `Refusal` already uses here.
          padding: '4px 2px 2px 8px',
          borderLeft: '2px solid var(--dread)',
        }}
      >
        <span className="t-meta" style={{ color: 'var(--text)', fontWeight: 700 }}>
          {`FAVOR TAKEN · ${favor.marked} OF ${favor.max}`}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {hopeGained > 0
            ? 'The Hope this roll gave you went back.'
            : 'Your Hope was already full, so nothing went back.'}
        </span>
      </div>
    );
  }

  const offer = favorOffer(result, favor, hopeGained);
  if (offer === null) return null;
  if (!offer.show) return <Statement label={offer.label} detail={offer.detail} />;

  /*
   * The exchange, in one write.
   *
   * Both counters move in a single `update`, because they are one decision and
   * a sheet that had the Favor but not the Hope back - or the reverse, if the
   * second write threw - is a sheet nobody chose. `Math.max` and `Math.min` are
   * belt to `boundCounters`' braces, and `favor.max` is what the store and the
   * codec both clamp to.
   *
   * IT IS NOT THE ONLY DOOR ONTO THIS COUNTER, and the draft of this note that
   * shipped on its own branch said it was. The row under Vitals steps the same
   * field both ways and `DicePools` decrements it to buy a Patron Die: three
   * writers, each its own clamp, all of them `useApp.update` on `favor.marked`
   * and all of them bounded by the same `favor.max`. Whether that should become
   * one `spendFavor`/`gainFavor` pair in the engine is open and not settled -
   * this write is the only one of the three that moves TWO counters at once, so
   * it would not fit such a pair without the Hope going through it too.
   */
  const take = (): void => {
    setTaken(true);
    update((c) => ({
      ...c,
      hope: { ...c.hope, marked: Math.max(0, c.hope.marked - hopeGained) },
      favor: { ...c.favor, marked: Math.min(c.favor.max, c.favor.marked + 1) },
    }));
    pushLog({
      kind: 'note',
      label: 'Took a Favor',
      detail:
        hopeGained > 0
          ? 'Instead of the Hope from this roll'
          : 'The Hope was already at its maximum',
    });
  };

  const phone = layout === 'phone';
  return (
    <button
      type="button"
      onClick={take}
      aria-label={`${offer.label}. ${offer.detail}`}
      style={{
        flex: 'none',
        minHeight: 'var(--tap)',
        width: '100%',
        borderRadius: phone ? 'var(--r5)' : 'var(--r4)',
        background: 'var(--raised)',
        border: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: phone ? '0 14px' : '0 12px',
        textAlign: 'left',
      }}
    >
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <span style={{ font: `900 ${phone ? 15 : 13}px/1 var(--sans)`, color: 'var(--text)' }}>
          {offer.label}
        </span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          {offer.detail}
        </span>
      </span>
    </button>
  );
}
