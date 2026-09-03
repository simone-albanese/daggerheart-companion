/**
 * Active conditions.
 *
 * The app has always shown the *text* of Hidden, Restrained and Vulnerable and
 * tracked none of them, while 65 of the 264 adversaries can leave a PC
 * Vulnerable and 46 can Restrain one. This is the strip that remembers.
 *
 * (Those two read `26 of the 129` and `17`. The measurement did not change and
 * the shipped book did: the count is the word `Vulnerable`, then `Restrained`,
 * matched against each adversary record whole, and run against `srd-1.0.json`
 * it still returns 26 and 17. It is a proxy - a record can name a condition
 * without being able to inflict it - but it is the proxy that reproduces the
 * old pair digit for digit, so what stands here is the old measurement re-run
 * rather than a new one substituted for it.)
 *
 * It remembers and nothing else. A chip is the token the player would push
 * across the table, and the rules beside it are the SRD's own words, quoted
 * from the dataset, because applying them is the player's job.
 *
 * The two free-text chips are the load-bearing part: every class but the
 * Sorcerer carries a persistent named state - Cloaked, Focus, No Mercy, Strange
 * Patterns - and domain cards create lasting ones too. A label the player types
 * is not the app executing card text. It is a sticky note.
 *
 * (`43 of the 189 domain cards` stood in that sentence. The 189 is SRD 1.0's
 * deck and the book ships 210, so the figure is stale on its denominator alone;
 * the 43 is worse than stale, because no reading of the deck reproduces it -
 * the nearest, every card whose text contains "until", returns 39 there and 42
 * here. It was a hand tally, and a hand tally nobody can re-run is not a
 * measurement. Retired rather than restated: the chips are justified by cards
 * creating lasting states at all, which is not in doubt, and inventing a
 * replacement number would be repeating exactly the mistake that put 189 in a
 * sentence about a 210-card book. The class half is recounted in
 * `conditionsStore.ts`, which owns `MAX_NAMED`.)
 */
import { useMemo, useState } from 'react';
import { isVulnerableFromStress } from '../../engine/damage.ts';
import { useActive, useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';
import {
  isEmpty,
  MAX_LABEL,
  MAX_NAMED,
  STANDARD,
  useConditions,
  useConditionsFor,
  type Conditions,
  type Standard,
} from './conditionsStore.ts';
import { blockNamed, paragraphs, ruleBlocks } from '../shared/ruleText.ts';
import { SRD_LABEL } from '../../store/dataset.ts';

const LABEL: Record<Standard, string> = {
  hidden: 'HIDDEN',
  restrained: 'RESTRAINED',
  vulnerable: 'VULNERABLE',
};

/**
 * The same three names as a screen reader should hear them.
 *
 * `LABEL` is the chip face and it is upper case because every label on this
 * sheet is. An accessible name is read aloud, and some screen readers spell
 * upper-case words out letter by letter, so the one place the names are spoken
 * rather than drawn gets its own map instead of a `toLowerCase()` on the other.
 */
const SPOKEN: Record<Standard, string> = {
  hidden: 'Hidden',
  restrained: 'Restrained',
  vulnerable: 'Vulnerable',
};

/**
 * Everything that is true of this character right now, in the order the strip
 * draws it: the three SRD conditions, then the states the player named.
 *
 * One function, because three surfaces have to agree about it - the strip only
 * exists on the phone while this is non-empty, the control in the defence band
 * counts it, and the control's accessible name reads it out. Two of those are
 * the founding rule ("nothing is drawn to say nothing" must never become
 * "nothing is drawn to say something"), so a second copy of this predicate is
 * how the two would eventually disagree.
 *
 * The derived Vulnerable is in the list. It is true of you whoever set it, and
 * the reason it is dashed rather than filled on the chip - you cannot put it
 * down - is not a reason to leave it unsaid.
 */
function activeConditions(
  conditions: Conditions,
  derived: boolean,
): { face: string; spoken: string }[] {
  return [
    ...STANDARD.filter((key) => conditions[key] || (key === 'vulnerable' && derived)).map(
      (key) => ({ face: LABEL[key], spoken: SPOKEN[key] }),
    ),
    ...conditions.named
      .filter((n) => n.on)
      .map((n) => ({ face: n.label.toUpperCase(), spoken: n.label })),
  ];
}

/**
 * Everything one CLEAR ALL destroys - which is not the same list as the strip.
 *
 * Two differences, and both of them are the reason this is its own function
 * rather than a reuse of `activeConditions` above.
 *
 * A NAMED STATE THAT IS SWITCHED OFF IS STILL DESTROYED. `clear` writes
 * `NO_CONDITIONS`, whose `named` is `[]`, so the label a player typed goes with
 * the chip whether or not the chip was lit. `activeConditions` filters on
 * `n.on`, because it is answering "what is true of this character"; the
 * confirmation is answering "what will not exist afterwards", and a player who
 * typed "Strange Patterns" and toggled it off for a scene has that string
 * deleted by a control whose sentence never mentioned it.
 *
 * THE DERIVED VULNERABLE IS NOT DESTROYED AND MUST NOT BE LISTED. It is
 * computed from a full Stress track, not stored here, so it is on the sheet
 * again the instant this dialog closes. `activeConditions` includes it, and
 * correctly - it is true of you. Listing it here would be the app saying it
 * removed something it cannot remove.
 *
 * The spoken forms, not `LABEL`: this list is read aloud by `role="alert"` and
 * printed as prose, and the upper-case faces exist for the chips.
 */
function clearedByClearAll(conditions: Conditions): string[] {
  return [
    ...STANDARD.filter((key) => conditions[key]).map((key) => SPOKEN[key]),
    ...conditions.named.map((n) => n.label),
  ];
}

/**
 * "A", "A and B", "A, B and C".
 *
 * A sentence rather than a comma list, because this one is spoken: an alert
 * that reads "Hidden comma Restrained comma No Mercy" is a data structure being
 * read out, and the thing it is warning about is worth a sentence.
 */
function inWords(items: string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/** One hue each, but never the only carrier: the chip is also filled or not. */
const TINT: Record<Standard, string> = {
  hidden: 'var(--midnight)',
  restrained: 'var(--armor)',
  vulnerable: 'var(--damage)',
};

interface ConditionRules {
  intro: string;
  /** The first paragraph of each subhead - the rule itself, nothing else. */
  rule: Record<Standard, string>;
  /** Everything the section says beyond those three rules. */
  general: string[];
  temporary: { heading: string; text: string } | null;
}

const NO_RULES: ConditionRules = {
  intro: '',
  rule: { hidden: '', restrained: '', vulnerable: '' },
  general: [],
  temporary: null,
};

function useConditionRules(): ConditionRules {
  const dataset = useApp((s) => s.dataset);
  return useMemo(() => {
    const section = dataset.rules.find((r) => r.id === 'conditions');
    if (!section) return NO_RULES;
    const blocks = ruleBlocks(section.body);

    const rule = { ...NO_RULES.rule };
    const general: string[] = [];
    for (const key of STANDARD) {
      const block = blockNamed(blocks, LABEL[key]);
      if (!block) continue;
      const parts = paragraphs(block.text);
      rule[key] = parts[0] ?? '';
      // The section's closing remarks sit under the last subhead rather than
      // on their own; they belong to conditions at large, not to Vulnerable.
      general.push(...parts.slice(1));
    }

    const temporary = blocks.find((b) => b.heading?.startsWith('TEMPORARY') === true);
    return {
      intro: paragraphs(blocks.find((b) => b.heading === null)?.text ?? '')[0] ?? '',
      rule,
      general,
      temporary: temporary ? { heading: temporary.heading!, text: temporary.text } : null,
    };
  }, [dataset]);
}

// ---------------------------------------------------------------------------
// The strip
// ---------------------------------------------------------------------------

type Tone = 'off' | 'on' | 'derived' | 'named';

function Chip({
  label,
  tone,
  tint,
  title,
  ariaLabel,
  onClick,
  wide = false,
}: {
  label: string;
  tone: Tone;
  tint?: string;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  wide?: boolean;
}): React.JSX.Element {
  const style =
    tone === 'on'
      ? { background: tint, color: 'var(--app)', border: '1px solid transparent', fontWeight: 700 }
      : tone === 'derived'
        ? {
            background: `color-mix(in srgb, ${tint} 16%, transparent)`,
            color: tint,
            border: `1px dashed ${tint}`,
            fontWeight: 700,
          }
        : tone === 'named'
          ? { background: 'var(--raised)', color: 'var(--text)', border: '1px solid var(--text-3)' }
          : { background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' };

  return (
    <button
      type="button"
      className="chip"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={tone !== 'off'}
      style={{
        flex: 'none',
        minHeight: 'var(--control)',
        minWidth: wide ? undefined : 'var(--control)',
        padding: '0 10px',
        borderRadius: 'var(--r3)',
        maxWidth: 168,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
    >
      {label}
    </button>
  );
}

/**
 * The strip - permanently on the desktop, and on the phone only while
 * something is actually on.
 *
 * WHAT THE PHONE DOES NOW, AND WHY THE FOLD WENT. The strip is eight chips
 * that scroll sideways, low in the column between the rest and the lineage,
 * and on an ordinary evening every one of them is grey: 44px plus the column's
 * 8px gap spent saying you are not Hidden, not Restrained and not Vulnerable.
 * P5-6 put that behind a `Disclosure` and costed the fold at −52. It was worth
 * nothing: a shut fold is a 44px header plus the same 8px gap, 52 for 52, and
 * `Conditions · NONE` is still a row spent saying nothing is happening.
 *
 * The shape that does remove the 52 is decision 6's - the one the modifier row
 * got - and it needs two things at once. Nothing is drawn here while nothing is
 * on, and the permanent door lives somewhere that costs the column no height:
 * `ConditionsControl`, 44x44. That door was at the end of the identity's class
 * row until the reflow deleted the identity block; it is at the head of the
 * defence band's fifth cell now, beside the incoming-damage field, in a row the
 * four number cells hold open at 56 - `Defenses` draws them at `4px 6px` on a
 * phone, so 4 + 10 + 4 + 32 + 4 + 2, and the 64 this said is the cockpit's
 * band, which draws neither this control nor the field. Both homes cost the
 * same thing, which is nothing, and the reason is the same: a 44px control
 * inside a band that is taller than it for another reason.
 *
 * NOTHING IS DRAWN TO SAY NOTHING; SOMETHING IS ALWAYS DRAWN TO SAY SOMETHING.
 * The moment any condition is on - including the Vulnerable that full Stress
 * derives, which is true of you whoever set it - this strip appears in the slot
 * it always had, naming every one of them, and `ConditionsControl` fills in and
 * counts them at the top of the sheet where it cannot be scrolled off. A
 * condition is a state the GM inflicted on you, so the one arrangement this may
 * never produce is a sheet that is silent about one.
 *
 * `+ NAME` IS NOT DRAWN ON THE PHONE, and that is the same rule again. The
 * control in the defence band is a door into `ConditionsDialog` that is on the
 * glass in every state, so the chip at the end of this strip would be a second
 * door to the same dialog, present only in the state where you least need it.
 *
 * DESKTOP KEEPS BOTH IN ONE ROW. `Vitals` mounts this with no props in the
 * cockpit's middle column, where the strip is permanent and the `+ NAME` chip
 * is the door. "And there is room for both" stood here and was measurably
 * false: with the two named conditions `MAX_NAMED` allows, the row held 593px
 * in 428 and the door was laid out 120.8px past the right edge, painting
 * nothing. The door is outside the scrollport now - see the note on the strip
 * itself - so what runs out of room is the chips, which scroll. The
 * alternative that was considered and rejected - putting the strip inside
 * `DualityRoll`'s `ControlRow` - would have given the cockpit two
 * `role="group" aria-label="Active conditions"` groups and two doors into the
 * same dialog.
 */
export function ActiveConditions({
  onlyWhenOn = false,
}: {
  /**
   * Draw nothing while nothing is on, and leave the door to `ConditionsDialog`
   * to `ConditionsControl`. Phone only - see the docblock above for why the two
   * halves of this flag are one decision and not two.
   */
  onlyWhenOn?: boolean;
} = {}): React.JSX.Element | null {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const toggle = useConditions((s) => s.toggle);
  const toggleNamed = useConditions((s) => s.toggleNamed);
  const rules = useConditionRules();
  const [open, setOpen] = useState(false);

  if (!character) return null;

  const derived = isVulnerableFromStress(character);
  const on = activeConditions(conditions, derived);

  // The whole of the 52px. Nothing is drawn to say nothing.
  if (onlyWhenOn && on.length === 0) return null;

  const strip = (
    /*
     * THE DOOR IS OUTSIDE THE SCROLLER, and that is this row's whole shape.
     *
     * The strip used to be one horizontally-scrolling row with the chips and
     * the `+ NAME` door in it together. Measured in Chrome at 1180x820,
     * 1280x800 and 1440x900 - identical, because the middle track is capped at
     * 428 - with three standard conditions on and two named ones of 20
     * characters: the row held 593px in 428, the second named chip painted
     * 31.6 of its 147.4, and the door was laid out at **x 922.8 against a right
     * edge of 802 - 120.8px past it, painting nothing at all**, with
     * `scrollbarWidth: 'none'` so no affordance said the row scrolled.
     * `elementFromPoint` at its centre returned the loadout column. Two named
     * conditions is the cap `MAX_NAMED` sets, so that is not a corner: it is
     * the full state this strip is designed for. And on the cockpit this door
     * is the *only* way into `ConditionsDialog` - `Identity` is mounted there
     * with no props on purpose - so being able to name a state depended on
     * having room for the chips you had already named.
     *
     * So the group keeps both, and only the chips scroll. The door is a
     * `flex: none` sibling of the scrollport rather than a child of it, which
     * is the arrangement `position: sticky` would have approximated at the cost
     * of painting over the last chip. It costs the chips 49px of scrollport -
     * they scroll, which is what they are for - and it costs the column nothing:
     * the outer row is the height of one 34px chip either way. Measured after,
     * in the same state: the door is 44.2px wide, paints all of it, and sits
     * hard against the strip's right edge at x 757.8 of 802.
     *
     * WHAT THIS DOES NOT FIX, said plainly. The chips themselves still scroll
     * under `scrollbarWidth: 'none'`, and in that same full state the scrollport
     * is 379 holding 544, so the second named chip paints 0 until you drag it
     * into view - 369 holding 544 on a 393px phone, where it is the same. It is
     * the shape of the defect above, one step down: the strip is not silent
     * about a condition, but it can be silent about *which* one. Closing it
     * means wrapping onto a second 34px row, which costs the phone's Play
     * budget in a state that is already 19px over, so it is a decision for
     * whoever owns that budget rather than a line to slip in here.
     */
    <div
      className="row"
      role="group"
      aria-label="Active conditions"
      style={{ flex: 'none', gap: 5 }}
    >
      <div
        className="row"
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          gap: 5,
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
      >
        {STANDARD.map((key) => {
          const manual = conditions[key];
          /*
           * Vulnerable is the one condition the app can derive - every Stress
           * box marked - and the derived chip is drawn dashed rather than
           * filled because you cannot put it down: it goes when the Stress
           * does. The filled chip is the one a card or an adversary inflicted,
           * and that one is yours to clear, so tapping through the dashed
           * state to the filled one is how you say "keep it after the Stress".
           */
          const auto = key === 'vulnerable' && derived;
          const tone: Tone = manual ? 'on' : auto ? 'derived' : 'off';
          const suffix = auto ? ' · STRESS' : '';
          return (
            <Chip
              key={key}
              label={LABEL[key] + suffix}
              tone={tone}
              tint={TINT[key]}
              wide
              title={rules.rule[key]}
              ariaLabel={
                auto && !manual
                  ? `Vulnerable, from every Stress box being marked. ${rules.rule[key]}`
                  : `${LABEL[key]}. ${rules.rule[key]}`
              }
              onClick={() => toggle(character.id, key)}
            />
          );
        })}

        {conditions.named.map((n) => (
          <Chip
            key={n.id}
            label={n.label.toUpperCase()}
            tone={n.on ? 'named' : 'off'}
            wide
            title={`${n.label} — your own note. The app tracks the chip and nothing else.`}
            ariaLabel={`${n.label}, a state you named`}
            onClick={() => toggleNamed(character.id, n.id)}
          />
        ))}
      </div>

      {!onlyWhenOn && (
        <button
          type="button"
          className="chip"
          onClick={() => setOpen(true)}
          title="Condition rules, and states you name yourself"
          aria-label="Condition rules, and states you name yourself"
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            minWidth: 'var(--control)',
            padding: '0 10px',
            borderRadius: 'var(--r3)',
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--muted)',
            letterSpacing: '0.18em',
          }}
        >
          {conditions.named.length < MAX_NAMED ? '+ NAME' : '...'}
        </button>
      )}
    </div>
  );

  if (onlyWhenOn) return strip;

  return (
    <>
      {strip}
      {open && <ConditionsDialog rules={rules} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * The permanent door into the conditions, and the reason the strip is allowed
 * to disappear.
 *
 * WHY IT IS HERE AND NOT ANYWHERE ELSE. Nothing may be drawn to say nothing, so
 * the strip only exists while something is on - and a section that is not always
 * there cannot be the way in. The way in has to be permanent and it has to cost
 * the column no height. It lived at the end of the identity's class row, held
 * open at 44 by RENAME, until the reflow deleted RENAME and then the whole
 * identity block; the band that offers the same deal now is the defence band's
 * fifth cell, which the four number cells hold open at 56 for their own reasons
 * - `4px 6px` of padding round a 32px number, so 4 + 10 + 4 + 32 + 4 + 2, and
 * the 64 that stood here is the cockpit's band, where this control is not drawn.
 *
 * THE WIDTH IS WHAT THAT COSTS, AND IT IS MEASURED RATHER THAN ASSUMED. The four
 * number cells come to 210.47 at their content width - 6px of side padding
 * round a 32px number, and the same 3dff11f that made the fifth track `auto`
 * made the middle three `minmax(min-content, 1fr)`, so at 393 they are drawn
 * wider than that and share the band's slack; 210.47 is the floor this sum
 * needs, not the width anything is painted at. Four 6px gaps are 24, so the
 * four of them and their gaps are 234.47 at that floor. The
 * fifth track was `1fr` and therefore the whole remainder of the column until
 * 3dff11f made it `auto`; it is exactly the pair now - this control at 44, a 6px
 * gutter and `--damage-w` - and it measures **114** from viewport 390 up, where
 * the field is 64, and **94** below it, where the field is 44, at 393, 744 and
 * 1179 alike, because an `auto` track does not grow with the column. They stand
 * side by side down to viewport 348 and the field wraps under this one below
 * that - measured 56 at 348x800 and 94 at 347x800 - and nothing is ever clipped
 * or painted over. What paid for the fit is the caption: the word `TOOK` used to
 * be where this control is, and the field's visible identity is now its `14`
 * placeholder and its position beside the thresholds it is read against.
 *
 * The `--control` token, not a literal 44: it resolves to 44 at every width
 * below 1180 with a coarse primary pointer, which is every width this sheet is
 * played at.
 *
 * WHERE IT SITS IN THE CELL, WHICH IS BEFORE THE FIELD. Both are at the top of
 * the screen - measured at 393x852, this control's box centre is 727.9px from a
 * bottom-right pivot at (373, 812) and the field's is 723.4, and the reach table
 * in `IncomingDamage`'s docblock in `Vitals.tsx` is the one place those live and
 * carries the other three viewports - so both are more than twice the ~330px
 * sweep `Play.tsx` argues for, neither is reachable without shuffling the grip,
 * and the arc does not decide this. (734.5 and 729.0 stood here: they are the
 * `flex-start` column of that table, one commit long, and the band's template
 * has since taken the flexibility out of this track.)
 *
 * What decides it is which of the two a stray tap is cheaper on. This opens a
 * modal that CLOSE dismisses; the field opens a numeric keypad over the sheet
 * mid-scene. The door is therefore the one that takes the first position in the
 * cell, where a thumb travelling in from the PROF cell arrives before it can
 * reach the field.
 *
 * (This paragraph used to give a second reason - that the field is the cell's
 * subject, so "the newcomer goes outside it rather than between the ladder and
 * the box you type a hit into". `Vitals.tsx` moved the pair to `flex-start` and
 * then the band's template made the fifth track `auto`, and between them that
 * sentence stopped being true: the track is exactly the pair, so there is no
 * slack left in the cell for anything to be outside of. Measured in Chrome at
 * 393, this control occupies x267-311, across the 6px grid gap from the PROF
 * cell, and the field x317-381 against the band's right edge, so the door is
 * *exactly* between the ladder and the box. It had a reading under the old
 * `flex-end`, where there were 40.53px of slack between PROF and the door at
 * 393 and 826.53 at 1179; it has none now. DOM order is `{door}{field}` and `justify-content`
 * never reordered it, so the *decision* is unchanged - only the argument that
 * was offered for it, which the code now disproves.)
 *
 * WHAT IT SAYS, WHICH IS NEVER "NOTHING IS WRONG" WHEN SOMETHING IS. With
 * nothing on it is a hollow 44x44 reading `— COND`. With anything on it fills
 * in, the count replaces the dash, and its accessible name reads every one of
 * them out - so a listening player gets `Conditions: Restrained, Vulnerable`
 * from the top of the sheet without scrolling to the strip. A sighted player
 * gets the count here and the names in the strip, which is some 600px down the
 * column and below the fold at both reference widths. That is the honest
 * residual of this arrangement and it is not a regression: the shut fold header
 * this replaces named them in the same slot and was equally below the fold at
 * 375x667. What is new is that the count is never off the glass.
 *
 * PHONE ONLY. `Defenses` draws it behind a prop that `PlayDesktop` does not
 * pass, because the cockpit already has a permanent strip with its own door and
 * a second one would be two doors into one dialog.
 */
export function ConditionsControl(): React.JSX.Element | null {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const rules = useConditionRules();
  const [open, setOpen] = useState(false);

  if (!character) return null;

  const on = activeConditions(conditions, isVulnerableFromStress(character));
  const lit = on.length > 0;
  const named = on.map((c) => c.spoken).join(', ');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={lit ? `Conditions: ${named}` : 'Conditions: none'}
        title={
          lit ? `Conditions: ${named}` : 'Conditions, and states you name yourself'
        }
        className="stack"
        style={{
          flex: 'none',
          width: 44,
          minWidth: 44,
          minHeight: 'var(--control)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          borderRadius: 'var(--r3)',
          background: lit ? 'var(--raised)' : 'transparent',
          border: `1px solid ${lit ? 'var(--line)' : 'var(--line-soft)'}`,
        }}
      >
        {/* Two carriers, never one: the count changes and so does the ink, so
            this reads as "on" without relying on colour alone. */}
        <span
          aria-hidden="true"
          className="t-meta"
          style={{ color: lit ? 'var(--damage)' : 'var(--muted)', fontWeight: lit ? 700 : 500 }}
        >
          {lit ? String(on.length) : '—'}
        </span>
        <span
          aria-hidden="true"
          className="t-meta"
          style={{ color: lit ? 'var(--text)' : 'var(--muted)' }}
        >
          COND
        </span>
      </button>

      {open && <ConditionsDialog rules={rules} onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The expanded view
// ---------------------------------------------------------------------------

/**
 * The expanded view, and the one control on it that destroys something.
 *
 * ## THE DEFECT THIS FOOTER IS SHAPED AROUND
 *
 * `86f4a0e` took a `mask-image` off the Play phone column. That mask had been
 * clipping the paint *and the hit-testing* of every `position: fixed` dialog
 * mounted in that column, this one included, and removing it was right. What it
 * also did was make this footer reachable for the first time - in the worst
 * place on the glass. Measured in Chrome at 393x852 with the `played` fixture
 * and three conditions on:
 *
 *   the panel runs y12-840 and the shell's tab bar runs y791-852, so the panel
 *   covers 49 of the tab bar's 61px and the four tab centres at y822 hit-test
 *   into this footer. PLAY (x49.2) lands on CLOSE. CARDS (x147.5) and BUILD
 *   (x245.7) land on the footer's own background and do nothing. GM (x344)
 *   landed on CLEAR ALL, at x283.6-364, y781-825.
 *
 * At 375x667 the same thing one row up: tab centres at y637, GM at x328.2, and
 * CLEAR ALL at x265.6-346, y596-640. At 640x360 landscape it does not happen at
 * all - the panel is 480 wide and centred, so CLEAR ALL sits at x462.6-543
 * while the BUILD centre is x400 and the GM centre is x560, which is 17px past
 * the panel's right edge and therefore a tap on the backdrop, which closes.
 *
 * So on both phones, the gesture this app's users have the most muscle memory
 * for - reaching for a tab at the bottom of the screen - wiped every marker on
 * the sheet on one tap, with no confirmation, no undo and no log line. That the
 * modal covers the shell is correct and deliberate; the defect is a one-tap
 * destructive control sitting where a finger goes by accident.
 *
 * ## WHY ARMING IS NOT ENOUGH ON ITS OWN, AND WHAT MAKES IT ENOUGH
 *
 * The obvious fix - first tap arms, second tap commits, the shape `RecallButton`
 * in `Play.tsx` already uses - does not close this on its own, and the numbers
 * above say why: **the second tap is the same accident as the first.** A player
 * reaching for GM cannot see the tab bar, because this panel is drawn over it.
 * They reach again, at the same coordinates, and an arm-in-place would commit.
 *
 * So the two controls trade places instead. While it is armed, the chip in the
 * bottom-right - the one the GM centre lands on - is **KEEP THEM**, and the
 * commit is a new full-width button *above* the row, clear of the tab band
 * entirely. Both labels are nine characters of `.chip`'s 9.5px mono and not one
 * declaration on that button changes between the two faces, so the cancel
 * occupies the destroyer's footprint to the pixel: 80.4x44 at x283.6-364 at
 * 393x852 and 80.4x44 at x265.6-346 at 375x667, both unmoved from the CLEAR ALL
 * they replace and from the resting state. The repeat of the mis-reach
 * therefore puts the conditions *down* instead of destroying them.
 *
 * Where the commit is instead, measured armed in Chrome:
 *
 *   393x852   335x44 at x29-364, y725-769
 *   375x667   317x44 at x29-346, y540-584
 *   640x360   446x44 at x97-543, y233-277
 *
 * The relationship is the same at all three because the footer is anchored to
 * the bottom of the panel: 14px of padding, the 44px row, a 12px gap. So the
 * commit's lower edge is always 22px above the top of the tab-bar band and its
 * centre 75px above the tab centres, and **it does not move when the sentence
 * above it gets longer** - the widest list this dialog can hold (three standard
 * conditions and two labels at `MAX_LABEL`) takes the sentence from two lines
 * to four and the footer from 166.7 to 198.4px, and the commit stays at y725-769
 * at 393x852 to the pixel. A growing label pushing a target somewhere unexpected
 * is this project's most-repeated defect; here the growth has nowhere to go but
 * into the scroll above, which is what a scroll is for. It stays scrollable in
 * the worst case at every width - 590.6px of scroll at 393x852, 405.6 at
 * 375x667, 98.6 at 640x360 against 781 of content.
 *
 * The commit is also much bigger than what it replaces: 335x44 at 393x852
 * against the 80.4x44 chip, four times the area. `Play.tsx`'s rule for this
 * screen is "a much bigger target or a second tap"; this is the first control
 * here that needed both.
 *
 * ## NOTHING IS DRAWN TO SAY NOTHING, HERE TOO
 *
 * With nothing to clear there is no CLEAR ALL. `isEmpty` is the store's own
 * predicate for "this row holds nothing" - the one `prune` drops rows on - and
 * it is exactly the set `clear` would destroy, so the chip is drawn when and
 * only when a tap on it would take something away. That is the same rule
 * `ActiveConditions` above is built on, and it matters most here: the door into
 * this dialog is permanent, so the state it is most often opened in is the empty
 * one, and in that state the GM centre now lands on an inert footer.
 *
 * ## WHAT WAS WEIGHED AND NOT TAKEN
 *
 * *Move CLEAR ALL out of the row it shares with CLOSE.* There is nowhere to
 * move it to. Four tabs across 393px is a 98px pitch and the footer's content
 * column is 335px wide - 393 less the 12px either side of the overlay's
 * `padding: 'max(12px, env(safe-area-inset-top)) 12px ...'`, less the 1px
 * either side of the dialog's `border: '1px solid var(--line)'`, less the 16px
 * either side of the footer's own `padding: '10px 16px 14px'` - so any control
 * wide enough to read contains a tab centre; the only axis with room is the
 * vertical one, which is the axis this fix uses. (**335, not the 337 that
 * stood here**, and this file already had the answer: the armed commit is
 * recorded under `Where the commit is instead, measured armed in Chrome` as
 * `335x44 at x29-364`, and 364 - 29 is 335. The 337 counted the dialog's
 * `border: 1px solid` as nothing; only the 4px `borderTop` beside it is
 * vertical-only.)
 *
 * Each of the three terms taken off the 393 is named by its declaration rather
 * than by a line, and that is a correction rather than a style: a line number
 * into a file still being edited is wrong by the time it is read, and the three
 * this paragraph could have carried would all have landed on the wrong
 * declaration by the end of the same sitting. Nothing in git shows that, which
 * is the point - the damage lands inside one commit and leaves no trace to
 * check. `gmGeometryProse.test.ts` holds the column against
 * those three declarations and against the measured rect above, so moving any
 * of them turns this sentence red.
 *
 * *Make it undoable instead of confirmable.* Nothing in this app has an undo -
 * `merge.ts`, `ImportConflicts.tsx` and `Edit.tsx` all say so in as many words -
 * so the first one would be a new app-wide affordance introduced on a control
 * whose own store says the state "is set and cleared a dozen times a session".
 * That is a large decision and this is not the place to take it.
 *
 * *Give the footer a bottom inset so it clears the tab-bar band.* Rejected, and
 * it is worth saying why out loud: the tab bar is **not visible** under this
 * panel. A player reaching for GM is reaching from memory at something they
 * cannot see, so moving our controls out of the band leaves the reach landing on
 * the backdrop - which closes the dialog - and leaves the next control to be put
 * near the bottom of a modal to rediscover the whole defect.
 *
 * *A timer that disarms.* Not taken. It is a state change the user did not make,
 * so to be honest it would have to be announced, and a live region firing on a
 * timer while somebody is reading the sentence is worse than what it prevents.
 * The thing a timer is for - a primed control left under a thumb - is already
 * gone here, because what is left under the thumb is the cancel. The armed state
 * is put down by KEEP THEM, by any change to the list it was armed against, and
 * by the dialog closing, which unmounts this component.
 */
function ConditionsDialog({
  rules,
  onClose,
}: {
  rules: ConditionRules;
  onClose: () => void;
}): React.JSX.Element {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const toggle = useConditions((s) => s.toggle);
  const addNamed = useConditions((s) => s.addNamed);
  const renameNamed = useConditions((s) => s.renameNamed);
  const removeNamed = useConditions((s) => s.removeNamed);
  const clear = useConditions((s) => s.clear);
  const [draft, setDraft] = useState('');
  /** Waiting for the deliberate second tap. See the docblock above. */
  const [armed, setArmed] = useState(false);
  const dialog = useDialog('Conditions', onClose);

  if (!character) return <div />;
  const derived = isVulnerableFromStress(character);

  const going = clearedByClearAll(conditions);
  const nothingToClear = isEmpty(conditions);
  /*
   * Armed is a fact about a list, so it does not outlive the list. Every
   * mutation below puts it down as well - what was armed was a confirmation of
   * those names, and the names have changed.
   */
  const primed = armed && !nothingToClear;
  /*
   * The one thing CLEAR ALL cannot take, when it is standing. `clear` writes
   * `NO_CONDITIONS`; a Vulnerable derived from a full Stress track is not in
   * that record and is drawn again on the next render. Saying so is the
   * difference between a confirmation and a claim.
   */
  const stressKeepsVulnerable = derived && !conditions.vulnerable;

  return (
    <div
      {...dialog}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderTop: '4px solid var(--line)',
          overflow: 'hidden',
        }}
      >
        <div className="spread" style={{ flex: 'none', alignItems: 'center', padding: '14px 16px 10px' }}>
          <span className="t-label">Conditions</span>
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            {SRD_LABEL}
          </span>
        </div>

        <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 12, padding: '0 16px 12px' }}>
          {rules.intro !== '' && (
            <p className="t-read" style={{ margin: 0, color: 'var(--muted)' }}>
              {rules.intro}
            </p>
          )}

          {STANDARD.map((key) => {
            const manual = conditions[key];
            const auto = key === 'vulnerable' && derived;
            const on = manual || auto;
            return (
              <div
                key={key}
                className="stack"
                style={{
                  flex: 'none',
                  gap: 8,
                  padding: '10px 11px',
                  borderRadius: 'var(--r3)',
                  background: 'var(--app)',
                  border: `1px ${auto && !manual ? 'dashed' : 'solid'} ${on ? TINT[key] : 'var(--line-soft)'}`,
                }}
              >
                <div className="spread" style={{ alignItems: 'center' }}>
                  <span style={{ font: '700 14px/1.1 var(--sans)', color: on ? TINT[key] : 'var(--text-2)' }}>
                    {LABEL[key]}
                  </span>
                  {/*
                   * The one control on this card, and the axis it never
                   * declared a floor on.
                   *
                   * `minHeight: var(--control)` was here and `min-width` was
                   * not, so the width was the label plus this button's
                   * `padding: '0 12px'` and nothing else (`base.css:42-50`
                   * zeroes a button's border). `.chip` sets IBM Plex Mono at
                   * 9.5px with `letter-spacing: 0.06em`, and the shipped
                   * `plexmono-600-latin.woff2` is a 600/1000 advance on every
                   * glyph, so a character is 9.5 x 0.6 + 9.5 x 0.06 = 6.27px.
                   * `SET` is three of them: 3 x 6.27 + 24 = **42.81px**, on a
                   * 44px floor. `ACTIVE` is six and measures 61.62, so it was
                   * only ever the off state that was under - which is the state
                   * the control spends almost all of its life in, and the state
                   * you are aiming at when you set a condition mid-scene.
                   *
                   * It clears WCAG 2.5.8's 24px with room to spare. The floor
                   * it breaks is `--control` / `--tap`, this project's own,
                   * which resolves to 44 at every width under 1180 and under
                   * any coarse pointer. `Chip` at the top of this same file
                   * has carried `minWidth: 'var(--control)'` all along; this is
                   * that line, in the one place it was missing.
                   *
                   * ERGONOMICS. **Target size:** 42.81 -> 44 is 1.19px, and it
                   * is taken from slack, not from a neighbour. The row is
                   * `.spread`, so the name sits hard left and this sits hard
                   * right; at 393x852 the card's content box is 311px (369 of
                   * dialog - its outer width, not a panel's content box, and
                   * itself the 393 less the 12px either side of the overlay's
                   * `padding: 'max(12px, env(safe-area-inset-top)) 12px ...'`
                   * - less the 1px either side of the dialog's `border: '1px
                   * solid var(--line)'`, less the 16px either side of the
                   * scroll's `padding: '0 16px 12px'`, less the 11px either
                   * side of the card's own `padding: '10px 11px'`, less the 1px
                   * either side of the card's own `border`), the widest name
                   * `VULNERABLE` is 96.88px at 700/14 Archivo, and
                   * 96.88 + 8 + 44 = 148.88 leaves 162px unspent. At 320 the
                   * same sum is 148.88 in a 238px box. Nothing reflows and no
                   * card grows a pixel.
                   * **Thumb arc:** these three cards are the top of a scrolling
                   * dialog that fills the glass, so SET travels with the
                   * scroll; what does not travel is the pair below it, and this
                   * is why the 1.19px matters more than it sounds - a target
                   * that is 42.81 wide and 44 tall has a 1.19px lip on the axis
                   * a thumb arriving from the left overshoots along.
                   * **Read versus touch:** the name is read first and is to the
                   * left of the control, the rule text is read second and is
                   * below both, and the `ALREADY ACTIVE` line - the one thing
                   * that says the tap will not do what it looks like it does -
                   * sits between the control and the rule rather than after it.
                   */}
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={manual}
                    onClick={() => {
                      setArmed(false);
                      toggle(character.id, key);
                    }}
                    style={{
                      flex: 'none',
                      minHeight: 'var(--control)',
                      minWidth: 'var(--control)',
                      padding: '0 12px',
                      borderRadius: 'var(--r3)',
                      background: manual ? TINT[key] : 'var(--raised)',
                      color: manual ? 'var(--app)' : 'var(--muted)',
                      fontWeight: manual ? 700 : 600,
                    }}
                  >
                    {manual ? 'ACTIVE' : 'SET'}
                  </button>
                </div>
                {auto && (
                  <span className="t-meta" style={{ color: TINT[key] }}>
                    ALREADY ACTIVE — EVERY STRESS BOX IS MARKED
                  </span>
                )}
                <p className="t-read" style={{ margin: 0 }}>
                  {rules.rule[key]}
                </p>
              </div>
            );
          })}

          {rules.general.map((p) => (
            <p key={p.slice(0, 24)} className="t-read" style={{ margin: 0, color: 'var(--muted)' }}>
              {p}
            </p>
          ))}

          <div style={{ height: 1, background: 'var(--line-soft)' }} />

          <div className="stack" style={{ flex: 'none', gap: 8 }}>
            <span className="t-label">Your own states</span>
            {rules.temporary !== null && (
              <p className="t-read" style={{ margin: 0, color: 'var(--muted)' }}>
                {paragraphs(rules.temporary.text)[0]}
              </p>
            )}
            <p className="t-hint" style={{ margin: 0, color: 'var(--dim)' }}>
              Cloaked, Focus, No Mercy, a card that lasts until your next rest — type the name and
              the app will hold on to it. It tracks the chip; it never applies the effect.
            </p>

            {conditions.named.map((n) => (
              <div key={n.id} className="row" style={{ gap: 8 }}>
                <input
                  value={n.label}
                  maxLength={MAX_LABEL}
                  aria-label="Name of this state"
                  onChange={(e) => renameNamed(character.id, n.id, e.target.value)}
                  style={{ flex: 1, minWidth: 0, minHeight: 'var(--tap)' }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setArmed(false);
                    removeNamed(character.id, n.id);
                  }}
                  style={{ flex: 'none', minWidth: 'var(--tap)' }}
                >
                  Remove
                </button>
              </div>
            ))}

            {conditions.named.length < MAX_NAMED && (
              <div className="row" style={{ gap: 8 }}>
                <input
                  value={draft}
                  maxLength={MAX_LABEL}
                  placeholder="Cloaked"
                  aria-label="Name a new state"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    setArmed(false);
                    addNamed(character.id, draft);
                    setDraft('');
                  }}
                  style={{ flex: 1, minWidth: 0, minHeight: 'var(--tap)' }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={draft.trim() === ''}
                  onClick={() => {
                    setArmed(false);
                    addNamed(character.id, draft);
                    setDraft('');
                  }}
                  style={{ flex: 'none' }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="stack"
          style={{
            flex: 'none',
            padding: '10px 16px 14px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          {/*
            Mounted empty and filled on arming, never mounted with its sentence
            already in it: a live region has to exist before its contents change
            for the change to be spoken. `RenameField.tsx` carries the same note
            over the same pattern, and `StepIdentity` was the first to use it.

            `role="alert"` rather than `status` because this interrupts on
            purpose. This is a `role="dialog"` with `aria-modal`, so a
            screen-reader user gets no colour change and no glance at a chip
            turning red; without this, arming would be silent to them and the
            second tap would be the first thing they heard about.

            It says both button names because it is the whole announcement: what
            goes, that nothing brings it back, and the two ways out.
          */}
          <p
            role="alert"
            className="t-hint"
            style={{ margin: 0, color: 'var(--text-2)' }}
          >
            {primed
              ? `CLEAR THEM removes ${inWords(going)}, and there is no undo.` +
                (stressKeepsVulnerable
                  ? ' The Vulnerable your full Stress derives stays, because that one is not stored here.'
                  : '') +
                ' KEEP THEM leaves them alone.'
              : ''}
          </p>

          {/*
            The commit, and the whole point of it is where it is NOT. 335x44 at
            x29-364, y725-769 at 393x852 - its lower edge 22px above the top of
            the tab bar at y791 and its centre 75px above the tab centres at
            y822, so no reach for a tab arrives here. It is also four times the
            area of the chip it replaces, which is the other half of
            `Play.tsx`'s rule for this screen rather than an alternative to it.

            `Confirm: clear ...` is `RecallButton`'s wording for the same state
            one file over, and the names are in it because `CLEAR THEM` on its
            own tells a listening player nothing about what is about to go.
          */}
          {primed && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setArmed(false);
                clear(character.id);
              }}
              aria-label={`Confirm: clear ${inWords(going)}`}
              style={{
                marginTop: 10,
                minHeight: 'var(--tap)',
                borderColor: 'var(--damage)',
                color: 'var(--damage)',
                fontWeight: 800,
              }}
            >
              CLEAR THEM
            </button>
          )}

          <div
            className="spread"
            style={{ flex: 'none', alignItems: 'center', marginTop: primed ? 12 : 0 }}
          >
            <button
              type="button"
              className="t-meta"
              onClick={onClose}
              style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', padding: '0 12px', marginLeft: -12 }}
            >
              CLOSE
            </button>
            {/*
              Nothing here while there is nothing to clear, and the cancel -
              never the commit - while there is and it is armed. Both faces are
              nine characters of `.chip`'s 9.5px mono, so the box does not move
              or resize between them: 80.4x44 at both phone widths, which is
              what makes the repeat of the mis-reach land on KEEP THEM. Not one
              declaration below changed when this was armed, for the same
              reason - a border added on one face only would have made the two
              boxes 82.4 and 80.4, and the whole guarantee is that they are the
              same box. Colour is not carrying the state either: the face reads
              a different word, a sentence appears above it and so does a
              button that was not there.

              Upper case on the face and sentence case in the name, the same
              split `SPOKEN` at the top of this file exists for: some screen
              readers spell an upper-case word out letter by letter.
            */}
            {!nothingToClear && (
              <button
                type="button"
                className="chip"
                onClick={() => setArmed(!primed)}
                aria-label={primed ? 'Keep them' : 'Clear all conditions'}
                style={{
                  flex: 'none',
                  minHeight: 'var(--control)',
                  padding: '0 12px',
                  borderRadius: 'var(--r3)',
                  background: 'var(--raised)',
                  color: primed ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                {primed ? 'KEEP THEM' : 'CLEAR ALL'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
