/**
 * The rest, from the GM's side of the table.
 *
 * `downtime` p.41: *"On a short rest, the GM gains 1d4 Fear. On a long rest,
 * they gain Fear equal to 1d4 + the number of PCs, and they can advance a
 * long-term countdown of their choice."* Both halves of that sentence are the
 * GM's, and until now neither of them arrived here. `Rest.tsx` on the player's
 * side computes the number and writes it into a log line - *"GM gains 3 Fear"* -
 * on a screen the GM is very likely not holding.
 *
 * ## Why it is in this tool rather than anywhere else
 *
 * This tool is already called "Fear and countdowns", and the two things a rest
 * produces are a Fear pool and a long-term clock. Putting the rest here costs
 * no new `GmRegion`, no new `GmSheetId`, no new dialog and no field on the
 * campaign record; it also survives a layout change, because the panel moves
 * with the region that owns it. THE NIGHT - where the owner's decision of
 * 2026-08-23 puts a session bar - is not built, so it is not a place yet.
 *
 * ## No bridge to the player's rest, and that is a decision
 *
 * The party board says in its own prose that there is no sync and there will
 * not be one. `Rest.tsx` and this panel therefore never meet unless both
 * screens are on the same phone, so this does not call `takeRest` and does not
 * try to notice that a player took one. What it shares with `Rest.tsx` is the
 * arithmetic, and only the arithmetic: `fearFromRest` and `FEAR_DIE` were taken
 * out of `engine/rest.ts` for exactly this, so the two surfaces cannot come to
 * different numbers from the same faces.
 *
 * ## The die is the table's to roll, or not
 *
 * A d4 is a die. `rollAffordance` is the one place this app answers what a
 * surface may offer, and `Rest.tsx` already routes THIS SAME 1d4 through it -
 * roll it when the roller is on, take a typed face when it is not, and refuse
 * in a sentence when neither switch is on. A second surface rolling the same
 * die a different way would be the contradiction, not the consistency. The
 * refusal is a sentence and never a greyed-out button with the word ROLL still
 * on it, for the reason `rollAffordance`'s own docblock gives.
 *
 * ## Proposal, never automation
 *
 * The rule the top of `Countdowns.tsx` states, applied. Choosing a rest writes
 * nothing. Rolling or typing a face writes nothing. APPLY writes the Fear;
 * tapping a clock advances that clock. There is no effect at mount and no
 * `useEffect` here that writes at all, because a panel that moved the pool on
 * being scrolled to would be the thing that whole file refuses.
 *
 * The clamp is on screen for the same reason. `nudgeFear` runs through
 * `clampFear`, which stops at `MAX_FEAR`; a readout promising +7 on a pool of
 * 10 would be lying in the top third of the scale, where it matters most. So
 * when the roll would overflow, the panel says what will actually land.
 *
 * `gmPartySize` comes from the preference and never from `party.length` - the
 * board is a board and not a roster, and `partySize.ts` argues that at length.
 *
 * ## Ergonomics
 *
 * The panel lives inside a container that already scrolls, so its growth costs
 * a scroll rather than a clipped control. Every button that writes is a flat
 * 44px declared inline - a floor set in a class is a floor no test can read -
 * and the typed face field is `--control`, because it is read as much as it is
 * pressed. The order down the panel is the order a GM works in: pick the rest,
 * read what the book says it costs, get a number, apply it. The clocks are
 * last, nearest the thumb, because they are the only gesture that happens
 * after all the reading is done.
 */
import { useState } from 'react';
import { cryptoRng } from '../../engine/dice.ts';
import { MAX_FEAR } from '../../engine/encounter.ts';
import { FEAR_DIE, fearFromRest, type RestKind } from '../../engine/rest.ts';
import { useApp } from '../../store/state.ts';
import { rollAffordance } from '../shared/rollAffordance.ts';
import { longRestFearRule, shortRestFearRule } from '../shared/ruleText.ts';
import { useGm } from './gmStore.ts';

/** A face a table typed, once it is a face this die has. */
const isFace = (value: string): boolean => {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= FEAR_DIE;
};

export function RestControl({ phone }: { phone: boolean }): React.JSX.Element {
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const digitalDice = useApp((s) => s.prefs.digitalDice);
  const manualDice = useApp((s) => s.prefs.manualDice);
  const rules = useApp((s) => s.dataset.rules);

  const fear = useGm((s) => s.fear);
  const nudgeFear = useGm((s) => s.nudgeFear);
  const countdowns = useGm((s) => s.countdowns);
  const advanceCountdown = useGm((s) => s.advanceCountdown);

  // Three pieces of staged state, none of them written anywhere: which rest is
  // on the table, the face it produced, and the clock this rest has already
  // moved. All three go back to nothing when the rest is put away.
  const [kind, setKind] = useState<RestKind | null>(null);
  const [face, setFace] = useState('');
  const [advanced, setAdvanced] = useState<string | null>(null);

  const affordance = rollAffordance(digitalDice, manualDice);
  const rolled = isFace(face) ? Number(face) : null;
  const gain = kind === null || rolled === null ? null : fearFromRest(kind, rolled, partySize);
  // What `clampFear` will really let through. The difference between this and
  // `gain` is the sentence the panel owes a GM at the top of the scale.
  const applied = gain === null ? null : Math.min(MAX_FEAR, fear + gain) - fear;

  const longTerm = countdowns.filter((c) => c.kind === 'long-term');

  const putAway = (): void => {
    setKind(null);
    setFace('');
    setAdvanced(null);
  };

  const stage = (next: RestKind): void => {
    setKind(next);
    setFace('');
    setAdvanced(null);
  };

  const rule = kind === 'short' ? shortRestFearRule(rules) : kind === 'long' ? longRestFearRule(rules) : null;

  return (
    <section className="panel stack" style={{ flex: 'none', padding: 14, gap: 12 }}>
      <div className="spread">
        <span className="t-label">The party rests</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          PARTY OF {partySize}
        </span>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {(['short', 'long'] as const).map((k) => (
          <button
            key={k}
            type="button"
            className="btn"
            aria-pressed={kind === k}
            onClick={() => (kind === k ? putAway() : stage(k))}
            style={{
              flex: 1,
              minWidth: 120,
              minHeight: 44,
              padding: '0 12px',
              background: kind === k ? 'var(--raised)' : undefined,
              fontWeight: kind === k ? 700 : undefined,
            }}
          >
            {k === 'short' ? 'SHORT REST' : 'LONG REST'}
          </button>
        ))}
      </div>

      {kind === null ? (
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          Nothing here notices a rest by itself. When the table takes one, say which, and the
          Fear it owes you is worked out from the book rather than from memory.
        </p>
      ) : (
        <>
          {/* The book's own sentence, not a paraphrase of it - and nothing at
              all rather than a guessed one when no loaded rules layer has it. */}
          {rule !== null && (
            <p className="t-read" style={{ margin: 0, maxWidth: '62ch' }}>
              “{rule}”
            </p>
          )}

          {affordance.blocked ? (
            <div className="stack" style={{ flex: 'none', gap: 6 }}>
              <span className="t-label" style={{ color: 'var(--damage)' }}>
                {affordance.label}
              </span>
              <p className="t-dense" style={{ margin: 0, maxWidth: '62ch' }}>
                This rest owes you a Fear die, and this device has been told not to roll one and
                not to take one.
              </p>
              <span className="t-meta" style={{ color: 'var(--dim)' }}>
                {affordance.prompt}
              </span>
            </div>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {affordance.canRoll && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFace(String(cryptoRng(FEAR_DIE)))}
                  style={{ flex: 'none', minHeight: 44, padding: '0 14px' }}
                >
                  ROLL 1D{FEAR_DIE}
                </button>
              )}
              {affordance.canType && (
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={FEAR_DIE}
                  value={face}
                  aria-label={`The d${FEAR_DIE} you rolled`}
                  placeholder={`1-${FEAR_DIE}`}
                  onChange={(e) => setFace(e.target.value)}
                  style={{
                    flex: 'none',
                    width: 84,
                    minHeight: 'var(--control)',
                    padding: '6px 8px',
                    font: '600 15px/1 var(--mono)',
                  }}
                />
              )}
              {rolled !== null && (
                <span className="t-num" style={{ fontSize: 15, color: 'var(--fear)' }}>
                  {rolled}
                </span>
              )}
            </div>
          )}

          {gain !== null && applied !== null && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="t-vital">
                +{gain} FEAR{kind === 'long' ? ` · 1D${FEAR_DIE} + ${partySize} PCS` : ''}
              </span>
              {applied < gain && (
                <span className="t-dense" style={{ color: 'var(--stress)' }}>
                  The pool stops at {MAX_FEAR}, so {applied} of those {gain} will land.
                </span>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  nudgeFear(gain);
                  putAway();
                }}
                style={{ flex: 'none', minHeight: 44, alignSelf: 'flex-start', padding: '0 16px' }}
              >
                APPLY
              </button>
            </div>
          )}

          {/* Only a long rest moves a clock, and only one of them - "a
              long-term countdown of their choice", which is what makes this a
              list of buttons rather than something the panel picks. */}
          {kind === 'long' && (
            <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line-soft)', paddingTop: 10 }}>
              <span className="t-meta">ADVANCE ONE LONG-TERM COUNTDOWN</span>
              {longTerm.length === 0 ? (
                <span className="t-dense" style={{ color: 'var(--muted)' }}>
                  No long-term countdowns are running. A rest is the moment to start one.
                </span>
              ) : (
                <div className={phone ? 'stack' : 'row'} style={{ gap: 8, flexWrap: 'wrap' }}>
                  {longTerm.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="btn"
                      disabled={advanced !== null && advanced !== c.id}
                      aria-pressed={advanced === c.id}
                      onClick={() => {
                        if (advanced !== null) return;
                        advanceCountdown(c.id, -1);
                        setAdvanced(c.id);
                      }}
                      style={{
                        flex: phone ? 'none' : 1,
                        minHeight: 44,
                        padding: '0 12px',
                        fontWeight: advanced === c.id ? 700 : undefined,
                      }}
                    >
                      {c.name} · {c.value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
