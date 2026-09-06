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
 *
 * AND THE DICE ARE NOT THIS FILE'S TO ROLL EITHER. Both rolling options called
 * into `engine/death.ts` with its defaulted `cryptoRng` and read no preference
 * at all, so a table that had turned the roller off in Settings - or answered
 * "Real dice, and the app stays out of it" in Onboarding - still got a button
 * that rolled a d12 for the one roll in this game you cannot take back. The
 * engine had no door: `avoidDeath` and `riskItAll` took an `Rng` and had no
 * `fixed` at all, so there was nowhere to put a face even if this file had
 * wanted to. Both take one now, in `engine/dice.ts`'s own shape, and both roads
 * here are `rollAffordance`'s to open: `canRoll` draws the roll button,
 * `canType` draws the faces, both on draws both, and neither draws the sentence
 * naming the switch.
 *
 * TWO RULES PULL AGAINST EACH OTHER ON THIS SCREEN AND THIS IS HOW THEY WERE
 * SETTLED. A player must never be shown a death result composed of a number
 * they did not enter, and must never be unable to record the number their own
 * die showed. They meet on the Fear Die of Avoid Death, which `rollDuality`
 * rolls and `AvoidDeathRoll` throws away: recording it would be asking for a
 * die nobody rolled, and rolling it would be the app touching dice at a table
 * that told it not to. The engine short-circuits it - see `avoidDeath` - so
 * neither happens: one typed number is the whole roll, and this file hands the
 * typed paths an `Rng` that throws to prove it.
 *
 * WHAT IS REFUSED IS THE ROLL, NOT THE MOVE. With both switches off the three
 * options are still listed, still carry the SRD's text, and Blaze of Glory -
 * which rolls nothing - still works end to end. Only the two dice are missing,
 * and the line says which switch would bring them back.
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
import type { Rng } from '../../engine/dice.ts';
import { hasFallen } from '../../engine/damage.ts';
import { normalizeActive, useActive, useApp } from '../../store/state.ts';
import { useDialog } from '../shared/useDialog.ts';
import { MAX_NAMED, useConditions, useConditionsFor } from './conditionsStore.ts';
// The same helper the roll control computes for itself and the damage row is
// handed, read here rather than reasoned out again from the two switches it is
// made of. It left `DualityRoll.tsx` for `shared/` when the GM's rest control
// became a fourth surface that has to ask the same question.
import { rollAffordance, type RollAffordance } from '../shared/rollAffordance.ts';
import { paragraphs, ruleBullets } from '../shared/ruleText.ts';
import { srdStamp } from '../../store/dataset.ts';

const ORDER: DeathMoveId[] = ['blaze', 'avoid', 'risk'];

/** A d12, which is what both of these moves are made of. */
const D12 = 12;

/**
 * The `Rng` a typed death move is handed, which must never be consulted.
 *
 * It throws rather than returning a number, because what it guards is silent:
 * `avoidDeath` short-circuits on a typed Hope Die and `riskItAll` needs both
 * faces before `rollDuality` stops reaching for a die, so an edit that drops a
 * field from either call - or a control that lets a blank through - would go
 * back to rolling a d12 for a table that switched the roller off, and nothing
 * on the screen would say so. `Rest.tsx` guards its preview the same way and
 * for the same reason. Nothing can reach it as written: every typed path is
 * behind a control that is disabled until every face it needs is a face.
 */
const neverRolls: Rng = () => {
  throw new Error('a typed death move must not roll dice');
};

/** A face a d12 can show. The surface validates; the engine takes the number. */
const isFace = (value: string): boolean =>
  /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= D12;

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
          <span className="t-hint" style={{ color: 'var(--damage)', fontWeight: 600 }}>
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
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);
  const affordance = rollAffordance(digitalDice, manualDice);

  const [phase, setPhase] = useState<Phase>('choose');
  const [avoid, setAvoid] = useState<AvoidDeathRoll | null>(null);
  const [risk, setRisk] = useState<RiskItAllRoll | null>(null);
  const [split, setSplit] = useState({ hp: 0, stress: 0 });
  const [scarNote, setScarNote] = useState('');
  /**
   * The faces the table rolled, as typed.
   *
   * Here rather than inside `Avoid` and `Risk` because `back()` is the one
   * place this dialog admits that a move has been abandoned, and everything a
   * move produced is let go of there together. Both options draw on the same
   * pair because both roll d12s; what stops one move reading the other's face
   * is that leaving a move clears them, not that they are kept apart.
   */
  const [typed, setTyped] = useState({ hope: '', fear: '' });
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
    /*
     * AND THE FACES, WHICH IS THE HALF A FIRST VERSION WOULD LEAVE OUT. This is
     * the only way out of a move short of closing the dialog, so a face left
     * standing here is a face the NEXT death move starts holding: type 9 into
     * Avoid Death, come back, and Risk It All opens with a 9 already in it and
     * a record button already live, on the one roll in this game that cannot be
     * taken back. Nothing else on this screen survives `back()` either.
     */
    setTyped({ hope: '', fear: '' });
  };

  /** What a Risk It All result does to this dialog, however it was arrived at. */
  const land = (result: RiskItAllRoll): void => {
    setRisk(result);
    // Hit Points first by default: it is the track that is full.
    setSplit(splitClear(character, result.clear, { hp: result.clear, stress: result.clear }));
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
            {srdStamp(rules.page)}
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
                    <span className="t-read">{option.text}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {chosen !== null && (
                <div className="stack" style={{ flex: 'none', gap: 8 }}>
                  <span style={{ font: '800 18px/1.1 var(--sans)' }}>{chosen.label}</span>
                  <p className="t-read" style={{ margin: 0 }}>
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
                  affordance={affordance}
                  typed={typed}
                  setTyped={setTyped}
                  onRoll={() => setAvoid(avoidDeath(character))}
                  /* One number is the whole roll here, so `neverRolls` is not
                     a precaution about the Fear Die - the engine does not draw
                     one when the Hope Die is given. It is the proof. */
                  onRecord={() =>
                    setAvoid(avoidDeath(character, neverRolls, { hope: Number(typed.hope) }))
                  }
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
                  affordance={affordance}
                  typed={typed}
                  setTyped={setTyped}
                  onRoll={() => {
                    land(riskItAll());
                  }}
                  /* Both faces or neither: `rollDuality` honours `fixed` one
                     field at a time, so a Hope Die on its own would leave the
                     Fear Die on the rng - and `neverRolls` would say so out
                     loud rather than a d12 appearing beside a typed one. */
                  onRecord={() => {
                    land(riskItAll(neverRolls, { hope: Number(typed.hope), fear: Number(typed.fear) }));
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
      className="t-hint"
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
      <p className="t-hint" style={{ margin: 0, color: 'var(--muted)' }}>
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
      <p className="t-hint" style={{ margin: 0, color: 'var(--dim)' }}>
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


/**
 * The two roads to a face, and the state where there is neither.
 *
 * One component for both moves, because a death move that offered typing on
 * one option and not the other would be this app disagreeing with itself about
 * what the switches mean - and because the interesting case is the one nobody
 * draws twice by hand: both switches off, where there is no control at all and
 * a sentence has to say which switch is missing.
 *
 * The record button is `disabled` until every face it needs is a face, and
 * that is not the greyed-out ROLL `rollAffordance`'s docblock forbids: this one
 * is waiting for a number the player is in the middle of typing, not standing
 * in for a capability the build does not have. It is `DicePools`' SET, in the
 * one dialog where getting it wrong crosses out a Hope slot. It says what it is
 * waiting for rather than only refusing, so the words on it change from
 * "Still to type: FEAR DIE" to "Record 9 and 4" - which is also what makes it
 * askable by voice, since its name is its contents.
 *
 * ERGONOMICS, over this file's own declarations at 393x852. The dialog is
 * `maxWidth: 520` inside 12px of overlay padding, so the box is 369 wide on
 * that phone, and its scrolling body pads 18 a side: 333. This panel takes
 * `padding: '12px 13px'` and a 1px border off that, leaving 305 across, so a
 * row is a 213px name, an 8px gap and the field's declared 84 - and 84x44
 * clears the 44px floor in both directions - the failure `DieKeypad`'s
 * docblock records for its own cockpit keys was width, at 24px, and nothing
 * here is narrow for the same reason: one field, not a twelve-key grid. Height is 2 of border, 24 of padding, a
 * 13.2px `t-label` line box (11px/1.2 since the readability ramp; 10px/1 before
 * it), then 8 + 44 per die and 8 + 44 for the button at `.btn`'s `min-height:
 * var(--tap)`: 143.2px for Avoid Death's one die and 195.2 for Risk It All's
 * two (140 and 192 at the 10px label), inside a body that already scrolls. A
 * face no d12 can show adds 8 and a `t-hint` paragraph at 13px/1.4 = 18.2 a
 * line (`t-dense` at 11.5px/1.38 = 15.87 before the ramp), wrapping at the 305 across
 * computed above; its line count is not stated here, because what it prints
 * depends on how long the number in the field is. TARGET SIZE is 84x44 for a field and full-width x44 for
 * both buttons. THUMB ARC: the fields sit above the button that consumes them
 * and below the SRD text that the choice is made out of, which is the order
 * the reading happens in; the consequential press - the one that crosses out a
 * Hope slot - is not here at all but two steps further down, behind the panel
 * that spells out what it costs. READ VERSUS TOUCH: read are the option's own
 * words and the refusal; touched are one or two fields and one button.
 */
function RollOrType({
  affordance,
  action,
  faces,
  onRoll,
  onRecord,
}: {
  affordance: RollAffordance;
  /** The words on the roll control, which name the dice it would roll. */
  action: string;
  faces: { key: string; label: string; value: string; set: (value: string) => void }[];
  onRoll: () => void;
  onRecord: () => void;
}): React.JSX.Element {
  const missing = faces.filter((f) => !isFace(f.value));
  /** Typed but impossible: a 13, or a 0, which no d12 shows. */
  const impossible = missing.filter((f) => f.value.trim() !== '');
  return (
    <div className="stack" style={{ flex: 'none', gap: 10 }}>
      {affordance.canRoll && (
        <button type="button" className="btn btn-primary" onClick={onRoll} style={{ flex: 'none' }}>
          {action}
        </button>
      )}

      {affordance.canType && (
        <div
          className="stack"
          style={{
            flex: 'none',
            gap: 8,
            padding: '12px 13px',
            borderRadius: 'var(--r3)',
            background: 'var(--app)',
            border: '1px solid var(--line-soft)',
          }}
        >
          <span className="t-hint" style={{ fontWeight: 600 }}>Type what you rolled</span>
          {faces.map((f) => (
            <div key={f.key} className="spread" style={{ flex: 'none', alignItems: 'center', gap: 8 }}>
              <span className="t-meta" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>
                {f.label} · D{D12}
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={f.value}
                min={1}
                max={D12}
                placeholder={`1–${String(D12)}`}
                aria-label={`The face your ${f.label} showed`}
                onChange={(e) => f.set(e.target.value)}
                style={{ flex: 'none', width: 84, minHeight: 'var(--tap)', textAlign: 'center' }}
              />
            </div>
          ))}
          {/* A NUMBER NO DIE CAN SHOW, SAID OUT LOUD. A 13 - or a 0, which
              nothing shows - holds the button back exactly as an empty field
              does, and an empty field is self-explanatory where this is not:
              something has been typed and the app has silently declined it.
              So the sentence names the range, what the field says now, and the
              one thing that clears it. `Rest.tsx` draws the same sentence over
              the same state, because they had the same gap. */}
          {impossible.length > 0 && (
            <p className="t-hint" style={{ margin: 0, color: 'var(--text-2)' }}>
              {impossible
                .map(
                  (f) =>
                    `A d${String(D12)} shows 1 to ${String(D12)}, and your ${f.label} says ${f.value.trim()}.`,
                )
                .join(' ')}{' '}
              Correct it and the roll is yours to record.
            </p>
          )}
          <button
            type="button"
            className="btn"
            disabled={missing.length > 0}
            onClick={onRecord}
            style={{ flex: 'none' }}
          >
            {missing.length > 0
              ? `Still to type: ${missing.map((f) => f.label).join(' · ')}`
              : `Record ${faces.map((f) => f.value).join(' and ')}`}
          </button>
        </div>
      )}

      {affordance.blocked && (
        <div className="stack" style={{ flex: 'none', gap: 8 }}>
          <span className="t-label" style={{ color: 'var(--damage)' }}>
            {affordance.label}
          </span>
          <p className="t-hint" style={{ margin: 0, color: 'var(--text-2)' }}>
            This device has been told not to roll dice and not to take yours, so there is
            nothing here that can make this roll. The move is still yours to take at the
            table; only the app is standing aside.
          </p>
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            {affordance.prompt}
          </span>
        </div>
      )}
    </div>
  );
}

function Avoid({
  roll,
  note,
  setNote,
  applied,
  affordance,
  typed,
  setTyped,
  onRoll,
  onRecord,
  onScar,
}: {
  roll: AvoidDeathRoll | null;
  note: string;
  setNote: (v: string) => void;
  applied: string | null;
  affordance: RollAffordance;
  typed: { hope: string; fear: string };
  setTyped: (next: { hope: string; fear: string }) => void;
  onRoll: () => void;
  onRecord: () => void;
  onScar: () => void;
}): React.JSX.Element {
  const character = useActive();
  const conditions = useConditionsFor(character?.id ?? null);
  const addNamed = useConditions((s) => s.addNamed);
  if (!character) return <div />;

  if (roll === null) {
    /* One face, because one die is read: `AvoidDeathRoll` carries the Hope Die,
       the level and the verdict, and no Fear Die reaches the screen or the log.
       Asking for a second number would be asking for a die the table did not
       roll for this. */
    return (
      <RollOrType
        affordance={affordance}
        action="Roll the Hope Die"
        faces={[
          {
            key: 'hope',
            label: 'HOPE DIE',
            value: typed.hope,
            set: (value) => setTyped({ ...typed, hope: value }),
          },
        ]}
        onRoll={onRoll}
        onRecord={onRecord}
      />
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
          <span className="t-read" style={{ color: 'var(--text-2)' }}>
            A Hope slot is crossed out for good. Hope slots {cost.hopeSlots + 1} → {cost.hopeSlots};
            you would have {cost.hopeAvailable} Hope available.
          </span>
          {cost.journeyEnds && (
            <span style={{ font: '700 0.8125rem/1.4 var(--sans)', color: 'var(--damage)' }}>
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
  affordance,
  typed,
  setTyped,
  onRoll,
  onRecord,
  onClear,
  onDie,
  tail,
}: {
  roll: RiskItAllRoll | null;
  split: { hp: number; stress: number };
  setSplit: (want: { hp: number; stress: number }) => void;
  applied: string | null;
  affordance: RollAffordance;
  typed: { hope: string; fear: string };
  setTyped: (next: { hope: string; fear: string }) => void;
  onRoll: () => void;
  onRecord: () => void;
  onClear: () => void;
  onDie: () => void;
  tail: string;
}): React.JSX.Element {
  const character = useActive();
  if (!character) return <div />;

  if (roll === null) {
    /* Both faces, because which one is higher IS the outcome: a Hope Die alone
       cannot say whether the character stays up, and matching dice - their own
       result here, not a critical - need both to match. */
    return (
      <RollOrType
        affordance={affordance}
        action="Roll the Duality Dice"
        faces={[
          {
            key: 'hope',
            label: 'HOPE DIE',
            value: typed.hope,
            set: (value) => setTyped({ ...typed, hope: value }),
          },
          {
            key: 'fear',
            label: 'FEAR DIE',
            value: typed.fear,
            set: (value) => setTyped({ ...typed, fear: value }),
          },
        ]}
        onRoll={onRoll}
        onRecord={onRecord}
      />
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
          <p className="t-hint" style={{ margin: 0, color: 'var(--dim)' }}>
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
