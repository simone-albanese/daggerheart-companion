/**
 * Active conditions.
 *
 * The app has always shown the *text* of Hidden, Restrained and Vulnerable and
 * tracked none of them, while 26 of the 129 adversaries can leave a PC
 * Vulnerable and 17 can Restrain one. This is the strip that remembers.
 *
 * It remembers and nothing else. A chip is the token the player would push
 * across the table, and the rules beside it are the SRD's own words, quoted
 * from the dataset, because applying them is the player's job.
 *
 * The two free-text chips are the load-bearing part: eight of the nine classes
 * carry a persistent named state - Cloaked, Focus, No Mercy, Strange Patterns -
 * and 43 of the 189 domain cards create a lasting one. A label the player types
 * is not the app executing card text. It is a sticky note.
 */
import { useMemo, useState } from 'react';
import { isVulnerableFromStress } from '../../engine/damage.ts';
import { useActive, useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';
import {
  MAX_LABEL,
  MAX_NAMED,
  STANDARD,
  useConditions,
  useConditionsFor,
  type Conditions,
  type Standard,
} from './conditionsStore.ts';
import { blockNamed, paragraphs, ruleBlocks } from '../shared/ruleText.ts';

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
 * four number cells hold open at 64. Both homes cost the same thing, which is
 * nothing, and the reason is the same: a 44px control inside a band that is
 * taller than it for another reason.
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
 * DESKTOP IS UNTOUCHED, deliberately and by default. `Vitals` mounts this with
 * no props in the cockpit's middle column, where the strip is permanent, the
 * `+ NAME` chip is the door, and there is room for both. The alternative that
 * was considered and rejected - putting the strip inside `DualityRoll`'s
 * `ControlRow` - would have given the cockpit two `role="group"
 * aria-label="Active conditions"` groups and two doors into the same dialog.
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
      <div
        className="row"
        role="group"
        aria-label="Active conditions"
        style={{
          flex: 'none',
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
 * fifth cell, which the four number cells hold open at 64 for their own reasons.
 *
 * THE WIDTH IS WHAT THAT COSTS, AND IT IS MEASURED RATHER THAN ASSUMED. The four
 * number cells are 210.47 wide at `8px 6px` of padding with the number at 32px,
 * and four 6px gaps are 24, so the fifth track is `column - 234.47`: 134.53 at
 * 393, 116.53 at 375, 101.53 at 360, 97.53 at 356, 85.53 at 344, 61.53 at 320.
 * This control at 44, a 6px gutter and the 44px damage field need 94 of that, so
 * they stand side by side from viewport 353 up and the field wraps under this
 * one below it - the band is 94 instead of 64 there, and nothing is ever clipped
 * or painted over. What paid for the fit is the caption: the word `TOOK` used to
 * be where this control is, and the field's visible identity is now its `14`
 * placeholder and its position beside the thresholds it is read against.
 *
 * The `--control` token, not a literal 44: it resolves to 44 at every width
 * below 1180 with a coarse primary pointer, which is every width this sheet is
 * played at.
 *
 * WHERE IT SITS IN THE CELL, WHICH IS BEFORE THE FIELD. Both are at the top of
 * the screen, roughly 750px from the bottom-right pivot on a 393x852 phone and
 * therefore outside any one-handed thumb sweep - neither is reachable without
 * shuffling the grip, so the arc does not decide this. Two things do. The field
 * is the cell's subject and reads right-to-left off the thresholds beside it, so
 * the newcomer goes outside it rather than between the ladder and the box you
 * type a hit into. And of the two, a stray tap here is the cheaper mistake: this
 * opens a modal that CLOSE dismisses, while the field opens a numeric keypad
 * over the sheet mid-scene.
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
  const dialog = useDialog('Conditions', onClose);

  if (!character) return <div />;
  const derived = isVulnerableFromStress(character);

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
            SRD 1.0
          </span>
        </div>

        <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 12, padding: '0 16px 12px' }}>
          {rules.intro !== '' && (
            <p className="t-dense" style={{ margin: 0, color: 'var(--muted)' }}>
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
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={manual}
                    onClick={() => toggle(character.id, key)}
                    style={{
                      flex: 'none',
                      minHeight: 'var(--control)',
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
                <p className="t-dense" style={{ margin: 0 }}>
                  {rules.rule[key]}
                </p>
              </div>
            );
          })}

          {rules.general.map((p) => (
            <p key={p.slice(0, 24)} className="t-dense" style={{ margin: 0, color: 'var(--muted)' }}>
              {p}
            </p>
          ))}

          <div style={{ height: 1, background: 'var(--line-soft)' }} />

          <div className="stack" style={{ flex: 'none', gap: 8 }}>
            <span className="t-label">Your own states</span>
            {rules.temporary !== null && (
              <p className="t-dense" style={{ margin: 0, color: 'var(--muted)' }}>
                {paragraphs(rules.temporary.text)[0]}
              </p>
            )}
            <p className="t-dense" style={{ margin: 0, color: 'var(--dim)' }}>
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
                  onClick={() => removeNamed(character.id, n.id)}
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
          className="spread"
          style={{
            flex: 'none',
            alignItems: 'center',
            padding: '10px 16px 14px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <button
            type="button"
            className="t-meta"
            onClick={onClose}
            style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', padding: '0 12px', marginLeft: -12 }}
          >
            CLOSE
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => clear(character.id)}
            style={{
              flex: 'none',
              minHeight: 'var(--control)',
              padding: '0 12px',
              borderRadius: 'var(--r3)',
              background: 'var(--raised)',
              color: 'var(--text-2)',
            }}
          >
            CLEAR ALL
          </button>
        </div>
      </div>
    </div>
  );
}
