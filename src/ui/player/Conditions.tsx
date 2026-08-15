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
import { useEffect, useMemo, useState } from 'react';
import { isVulnerableFromStress } from '../../engine/damage.ts';
import { useActive, useApp } from '../../store/state.ts';
import {
  MAX_LABEL,
  MAX_NAMED,
  STANDARD,
  useConditions,
  useConditionsFor,
  type Standard,
} from './conditionsStore.ts';
import { blockNamed, paragraphs, ruleBlocks } from './ruleText.ts';

const LABEL: Record<Standard, string> = {
  hidden: 'HIDDEN',
  restrained: 'RESTRAINED',
  vulnerable: 'VULNERABLE',
};

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

export function ActiveConditions(): React.JSX.Element | null {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const toggle = useConditions((s) => s.toggle);
  const toggleNamed = useConditions((s) => s.toggleNamed);
  const rules = useConditionRules();
  const [open, setOpen] = useState(false);

  if (!character) return null;

  const derived = isVulnerableFromStress(character);

  return (
    <>
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
      </div>

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!character) return <div />;
  const derived = isVulnerableFromStress(character);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conditions"
      onClick={onClose}
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
