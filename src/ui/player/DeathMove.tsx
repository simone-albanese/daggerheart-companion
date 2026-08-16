/**
 * The death move.
 *
 * The whole model was already here and unused: `scars` rides the transfer
 * codec, `maxHope` is `BASE_HOPE - scars.length`, and `hasFallen` was called
 * only from tests. So the sheet could tell you your last Hit Point was marked
 * and said nothing at all.
 *
 * It is a door, not an interruption. Nothing opens by itself: a scene where
 * the table is still talking is not a scene the app should take over, and the
 * one screen that can permanently cross out a Hope slot is the last one that
 * should appear under a thumb already moving. Inside, every step proposes and
 * waits - the dice roll on a tap, the consequence is spelled out in full, and
 * the character is only changed by a button that says what it will change.
 *
 * The three options and their exact wording come from the dataset, not from
 * memory.
 */
import { useMemo, useState } from 'react';
import {
  addScar,
  avoidDeath,
  clearAllMarks,
  clearMarks,
  riskItAll,
  scarCost,
  splitClear,
  type AvoidDeathRoll,
  type DeathMoveId,
  type RiskItAllRoll,
} from '../../engine/death.ts';
import { hasFallen } from '../../engine/damage.ts';
import { normalizeActive, useActive, useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';
import { MAX_NAMED, useConditions, useConditionsFor } from './conditionsStore.ts';
import { paragraphs, ruleBullets } from '../shared/ruleText.ts';

const ORDER: DeathMoveId[] = ['blaze', 'avoid', 'risk'];

const MATCHES: Record<DeathMoveId, string> = {
  blaze: 'blaze',
  avoid: 'avoid',
  risk: 'risk',
};

interface DeathRules {
  lead: string;
  tail: string;
  option: Record<DeathMoveId, { label: string; text: string } | null>;
  page: number | null;
}

function useDeathRules(): DeathRules {
  const dataset = useApp((s) => s.dataset);
  return useMemo(() => {
    const empty: DeathRules = {
      lead: '',
      tail: '',
      option: { blaze: null, avoid: null, risk: null },
      page: null,
    };
    const section = dataset.rules.find((r) => r.id === 'death');
    if (!section) return empty;

    const prose = paragraphs(section.body).filter((p) => !p.startsWith('-'));
    const bullets = ruleBullets(section.body);
    const option = { ...empty.option };
    for (const id of ORDER) {
      option[id] = bullets.find((b) => b.label.toLowerCase().startsWith(MATCHES[id])) ?? null;
    }
    return {
      lead: prose[0] ?? '',
      tail: prose[prose.length - 1] ?? '',
      option,
      page: section.sourcePage ?? null,
    };
  }, [dataset]);
}

// ---------------------------------------------------------------------------
// The offer
// ---------------------------------------------------------------------------

export function DeathMoveOffer(): React.JSX.Element | null {
  const character = useActive();
  const [open, setOpen] = useState(false);

  const fallen = character !== null && hasFallen(character);
  // The dialog outlives the offer on purpose: Risk It All can clear the Hit
  // Point that put it on screen, and a confirmation must not vanish with it.
  if (!fallen && !open) return null;

  return (
    <>
      {fallen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="spread"
          style={{
            flex: 'none',
            alignItems: 'center',
            minHeight: 'var(--control)',
            padding: '0 12px',
            borderRadius: 'var(--r3)',
            background: 'color-mix(in srgb, var(--damage) 12%, transparent)',
            border: '1px solid var(--damage)',
            textAlign: 'left',
          }}
        >
          <span className="t-label" style={{ color: 'var(--damage)' }}>
            Last Hit Point marked
          </span>
          <span className="t-meta" style={{ color: 'var(--damage)', flex: 'none' }}>
            DEATH MOVE →
          </span>
        </button>
      )}
      {open && <DeathMoveDialog onClose={() => setOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

type Phase = 'choose' | DeathMoveId;

function DeathMoveDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const character = useActive();
  const update = useApp((s) => s.update);
  const pushLog = useApp((s) => s.pushLog);
  const rules = useDeathRules();

  const [phase, setPhase] = useState<Phase>('choose');
  const [avoid, setAvoid] = useState<AvoidDeathRoll | null>(null);
  const [risk, setRisk] = useState<RiskItAllRoll | null>(null);
  const [split, setSplit] = useState({ hp: 0, stress: 0 });
  const [scarNote, setScarNote] = useState('');
  /** Set once something has actually been written to the character. */
  const [applied, setApplied] = useState<string | null>(null);
  const dialog = useDialog('Death move', onClose);

  if (!character) return <div />;

  const back = (): void => {
    setPhase('choose');
    setAvoid(null);
    setRisk(null);
    setApplied(null);
    setScarNote('');
  };

  const chosen = phase === 'choose' ? null : rules.option[phase];

  return (
    <div
      {...dialog}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.9)',
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
          maxWidth: 520,
          maxHeight: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderTop: '4px solid var(--fear)',
          overflow: 'hidden',
        }}
      >
        <div className="spread" style={{ flex: 'none', alignItems: 'center', padding: '16px 18px 12px' }}>
          <span className="t-vital">Death Move</span>
          <span className="t-meta" style={{ color: 'var(--dim)', flex: 'none' }}>
            SRD 1.0{rules.page === null ? '' : ` · P.${rules.page}`}
          </span>
        </div>

        <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 14, padding: '0 18px 14px' }}>
          {phase === 'choose' ? (
            <>
              <p className="t-body" style={{ margin: 0 }}>
                {rules.lead}
              </p>
              {ORDER.map((id) => {
                const option = rules.option[id];
                if (!option) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPhase(id)}
                    className="stack"
                    style={{
                      flex: 'none',
                      gap: 8,
                      minHeight: 'var(--tap)',
                      padding: '12px 13px',
                      borderRadius: 'var(--r3)',
                      background: 'var(--app)',
                      border: '1px solid var(--line-soft)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ font: '800 16px/1.1 var(--sans)' }}>{option.label}</span>
                    <span className="t-dense">{option.text}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {chosen !== null && (
                <div className="stack" style={{ flex: 'none', gap: 8 }}>
                  <span style={{ font: '800 18px/1.1 var(--sans)' }}>{chosen.label}</span>
                  <p className="t-dense" style={{ margin: 0 }}>
                    {chosen.text}
                  </p>
                </div>
              )}

              {phase === 'blaze' && (
                <Blaze
                  tail={rules.tail}
                  applied={applied}
                  onLog={() => {
                    pushLog({
                      kind: 'note',
                      label: 'Blaze of Glory',
                      detail: 'One final action, automatically a critical success',
                    });
                    setApplied('Logged. Nothing on the sheet changed.');
                  }}
                />
              )}

              {phase === 'avoid' && (
                <Avoid
                  roll={avoid}
                  note={scarNote}
                  setNote={setScarNote}
                  applied={applied}
                  onRoll={() => setAvoid(avoidDeath(character))}
                  onScar={() => {
                    const cost = scarCost(character);
                    update((c) => addScar(c, scarNote));
                    // The maximum is `deriveStats`' to decide, so the counters
                    // are re-synced rather than clamped by hand here.
                    normalizeActive();
                    pushLog({
                      kind: 'note',
                      label: 'Scar',
                      detail: `${scarNote.trim() === '' ? 'Unnamed scar' : scarNote.trim()} · Hope slots ${cost.hopeSlots}`,
                    });
                    setApplied(
                      cost.journeyEnds
                        ? 'The last Hope slot is crossed out. This character’s journey ends.'
                        : `A Hope slot is crossed out. ${cost.hopeSlots} left.`,
                    );
                  }}
                />
              )}

              {phase === 'risk' && (
                <Risk
                  roll={risk}
                  split={split}
                  setSplit={(want) =>
                    setSplit(risk === null ? want : splitClear(character, risk.clear, want))
                  }
                  applied={applied}
                  onRoll={() => {
                    const result = riskItAll();
                    setRisk(result);
                    // Hit Points first by default: it is the track that is full.
                    setSplit(
                      splitClear(character, result.clear, { hp: result.clear, stress: result.clear }),
                    );
                  }}
                  onClear={() => {
                    if (risk === null) return;
                    if (risk.result === 'clear-all') {
                      const { hp, stress } = character;
                      update(clearAllMarks);
                      pushLog({
                        kind: 'note',
                        label: 'Risk It All — matching dice',
                        detail: `Cleared ${hp.marked} HP and ${stress.marked} Stress`,
                      });
                      setApplied('All Hit Points and Stress cleared.');
                      return;
                    }
                    update((c) => clearMarks(c, split.hp, split.stress));
                    pushLog({
                      kind: 'note',
                      label: 'Risk It All — Hope Die higher',
                      detail: `Cleared ${split.hp} HP and ${split.stress} Stress`,
                    });
                    setApplied(`Cleared ${split.hp} HP and ${split.stress} Stress.`);
                  }}
                  onDie={() => {
                    pushLog({
                      kind: 'note',
                      label: 'Risk It All — Fear Die higher',
                      detail: 'The character crosses through the veil of death',
                    });
                    setApplied('Logged. Nothing on the sheet changed.');
                  }}
                  tail={rules.tail}
                />
              )}
            </>
          )}
        </div>

        <div
          className="spread"
          style={{
            flex: 'none',
            alignItems: 'center',
            padding: '10px 18px 14px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <button
            type="button"
            className="t-meta"
            onClick={phase === 'choose' ? onClose : back}
            style={{ minHeight: 'var(--tap)', minWidth: 'var(--tap)', padding: '0 12px', marginLeft: -12 }}
          >
            {phase === 'choose' ? 'CLOSE' : 'BACK'}
          </button>
          {phase !== 'choose' && (
            <button type="button" className="btn" onClick={onClose} style={{ flex: 'none' }}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The three options
// ---------------------------------------------------------------------------

/** The confirmation line, once something has been written. */
function Applied({ text }: { text: string }): React.JSX.Element {
  return (
    <p
      role="status"
      className="t-dense"
      style={{
        margin: 0,
        padding: '10px 11px',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        border: '1px solid var(--line)',
        color: 'var(--text-2)',
      }}
    >
      {text}
    </p>
  );
}

function Blaze({
  tail,
  applied,
  onLog,
}: {
  tail: string;
  applied: string | null;
  onLog: () => void;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ flex: 'none', gap: 12 }}>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)' }}>
        There is no arithmetic here. Take the action; it critically succeeds. The sheet is not
        changed by this screen.
      </p>
      {applied === null ? (
        <button type="button" className="btn" onClick={onLog}>
          Note it in the log
        </button>
      ) : (
        <Applied text={applied} />
      )}
      <p className="t-dense" style={{ margin: 0, color: 'var(--dim)' }}>
        {tail}
      </p>
    </div>
  );
}

function Die({ value, label, color }: { value: number; label: string; color: string }): React.JSX.Element {
  return (
    <span className="stack" style={{ flex: 'none', gap: 5, alignItems: 'center' }}>
      <span style={{ font: '900 34px/1 var(--sans)', color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span className="t-meta" style={{ color: 'var(--muted)', letterSpacing: '0.12em' }}>
        {label}
      </span>
    </span>
  );
}

function Avoid({
  roll,
  note,
  setNote,
  applied,
  onRoll,
  onScar,
}: {
  roll: AvoidDeathRoll | null;
  note: string;
  setNote: (v: string) => void;
  applied: string | null;
  onRoll: () => void;
  onScar: () => void;
}): React.JSX.Element {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const addNamed = useConditions((s) => s.addNamed);
  if (!character) return <div />;

  if (roll === null) {
    return (
      <button type="button" className="btn btn-primary" onClick={onRoll} style={{ flex: 'none' }}>
        Roll the Hope Die
      </button>
    );
  }

  const cost = scarCost(character);
  const canName = conditions.named.length < MAX_NAMED;

  return (
    <div className="stack" style={{ flex: 'none', gap: 14 }}>
      <div className="row" style={{ gap: 22, justifyContent: 'center' }}>
        <Die value={roll.hopeDie} label="HOPE DIE" color="var(--hope)" />
        <Die value={roll.level} label="YOUR LEVEL" color="var(--text-2)" />
      </div>

      <p className="t-body" style={{ margin: 0, textAlign: 'center' }}>
        {roll.scar
          ? `${roll.hopeDie} is at or below your level. Your character gains a scar.`
          : `${roll.hopeDie} is above your level. No scar.`}
      </p>

      {roll.scar && applied === null && (
        <div
          className="stack"
          style={{
            flex: 'none',
            gap: 10,
            padding: '12px 13px',
            borderRadius: 'var(--r3)',
            background: 'color-mix(in srgb, var(--damage) 10%, transparent)',
            border: '1px solid var(--damage)',
          }}
        >
          <span className="t-label" style={{ color: 'var(--damage)' }}>
            What this costs, permanently
          </span>
          <span className="t-dense" style={{ color: 'var(--text-2)' }}>
            A Hope slot is crossed out for good. Hope slots {cost.hopeSlots + 1} → {cost.hopeSlots};
            you would have {cost.hopeAvailable} Hope available.
          </span>
          {cost.journeyEnds && (
            <span style={{ font: '700 13px/1.4 var(--sans)', color: 'var(--damage)' }}>
              This is the last slot. Your character’s journey ends.
            </span>
          )}
          <input
            value={note}
            placeholder="Name the scar (optional)"
            aria-label="Name the scar"
            maxLength={60}
            onChange={(e) => setNote(e.target.value)}
            style={{ minHeight: 'var(--tap)' }}
          />
          <button
            type="button"
            className="btn"
            onClick={onScar}
            style={{
              background: 'var(--damage)',
              color: 'var(--app)',
              borderColor: 'transparent',
              fontWeight: 800,
            }}
          >
            Cross out a Hope slot
          </button>
        </div>
      )}

      {applied !== null && <Applied text={applied} />}

      {canName && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => addNamed(character.id, 'Unconscious')}
          style={{ flex: 'none' }}
        >
          Add “Unconscious” to your states
        </button>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  marked,
  onChange,
}: {
  label: string;
  value: number;
  marked: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <div className="spread" style={{ alignItems: 'center' }}>
      <span className="stack" style={{ gap: 4 }}>
        <span className="t-label" style={{ color: 'var(--text-2)' }}>
          {label}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {marked} MARKED
        </span>
      </span>
      <span className="row" style={{ gap: 8, flex: 'none' }}>
        <button
          type="button"
          className="btn"
          aria-label={`One less ${label}`}
          disabled={value === 0}
          onClick={() => onChange(value - 1)}
          style={{ minWidth: 'var(--tap)', padding: 0 }}
        >
          −
        </button>
        <span
          style={{
            font: '800 20px/1 var(--sans)',
            minWidth: 26,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <button
          type="button"
          className="btn"
          aria-label={`One more ${label}`}
          onClick={() => onChange(value + 1)}
          style={{ minWidth: 'var(--tap)', padding: 0 }}
        >
          +
        </button>
      </span>
    </div>
  );
}

function Risk({
  roll,
  split,
  setSplit,
  applied,
  onRoll,
  onClear,
  onDie,
  tail,
}: {
  roll: RiskItAllRoll | null;
  split: { hp: number; stress: number };
  setSplit: (want: { hp: number; stress: number }) => void;
  applied: string | null;
  onRoll: () => void;
  onClear: () => void;
  onDie: () => void;
  tail: string;
}): React.JSX.Element {
  const character = useActive();
  if (!character) return <div />;

  if (roll === null) {
    return (
      <button type="button" className="btn btn-primary" onClick={onRoll} style={{ flex: 'none' }}>
        Roll the Duality Dice
      </button>
    );
  }

  const spent = split.hp + split.stress;

  return (
    <div className="stack" style={{ flex: 'none', gap: 14 }}>
      <div className="row" style={{ gap: 22, justifyContent: 'center' }}>
        <Die value={roll.hope} label="HOPE" color="var(--hope)" />
        <Die value={roll.fear} label="FEAR" color="var(--fear)" />
      </div>

      {roll.result === 'die' && (
        <>
          <p className="t-body" style={{ margin: 0, textAlign: 'center' }}>
            The Fear Die is higher. Your character crosses through the veil of death.
          </p>
          {applied === null ? (
            <button type="button" className="btn" onClick={onDie}>
              Note it in the log
            </button>
          ) : (
            <Applied text={applied} />
          )}
          <p className="t-dense" style={{ margin: 0, color: 'var(--dim)' }}>
            {tail}
          </p>
        </>
      )}

      {roll.result === 'clear-all' && (
        <>
          <p className="t-body" style={{ margin: 0, textAlign: 'center' }}>
            Matching results. Your character stays up and clears all Hit Points and Stress.
          </p>
          {applied === null ? (
            <button type="button" className="btn btn-primary" onClick={onClear}>
              Clear {character.hp.marked} HP and {character.stress.marked} Stress
            </button>
          ) : (
            <Applied text={applied} />
          )}
        </>
      )}

      {roll.result === 'stay' && (
        <>
          <p className="t-body" style={{ margin: 0, textAlign: 'center' }}>
            The Hope Die is higher. Your character stays on their feet and clears {roll.clear},
            divided between Hit Points and Stress however you prefer.
          </p>
          {/* The split disappears once it is spent: leaving two steppers on
              screen beside "cleared 4 HP" reads as four more still to give. */}
          {applied === null ? (
            <>
              <div
                className="stack"
                style={{
                  flex: 'none',
                  gap: 12,
                  padding: '12px 13px',
                  borderRadius: 'var(--r3)',
                  background: 'var(--app)',
                  border: '1px solid var(--line-soft)',
                }}
              >
                <Stepper
                  label="HIT POINTS"
                  value={split.hp}
                  marked={character.hp.marked}
                  onChange={(hp) => setSplit({ hp, stress: split.stress })}
                />
                <Stepper
                  label="STRESS"
                  value={split.stress}
                  marked={character.stress.marked}
                  onChange={(stress) => setSplit({ hp: split.hp, stress })}
                />
                <span className="t-meta" style={{ color: 'var(--dim)' }}>
                  {roll.clear - spent} OF {roll.clear} STILL UNSPENT
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={spent === 0}
                onClick={onClear}
              >
                Clear {split.hp} HP and {split.stress} Stress
              </button>
            </>
          ) : (
            <Applied text={applied} />
          )}
        </>
      )}
    </div>
  );
}
