/**
 * Fear and countdowns.
 *
 * Every countdown here moves because a hand moved it. The app has no idea
 * whether the roll that just happened was the one that mattered, whether the
 * scene changed, or whether the party spent the night at an inn - and guessing
 * wrong is worse than not guessing, because a countdown that ticks on its own
 * is one you stop trusting. So: plus and minus, and nothing else.
 *
 * ## Plus and minus is still the whole story
 *
 * A dynamic countdown now carries a shut fold with the SRD's advancement chart
 * in it, and six of its ten advancement cells are buttons. That does not weaken
 * the paragraph above; it is that paragraph applied. The rule says a dynamic
 * countdown moves by up to three *depending on the outcome of an action roll*,
 * and the app still does not know the outcome - so it prints the five outcomes
 * and the GM presses the one that happened. Architecture 3.2's *proposta, mai
 * automatismo*: the proposal is drawn, the decision is a thumb, and nothing
 * moves that a hand did not move. The four cells the SRD gives no number for
 * are printed and are not buttons.
 *
 * ## The four hints below are the app's own words, and stay that way
 *
 * `KINDS` describes what each kind of countdown *is for*, in a sentence short
 * enough to sit under a `<select>`. Three of the four paraphrase something the
 * `countdowns` section says at length, and the temptation is to quote the SRD
 * instead. Two reasons not to. The sentences do not fit - "Standard countdowns
 * advance every time a player makes an action roll" is 61 characters and, worse,
 * it is a rule this app deliberately does not execute, so printing it as the
 * description of a control that will not execute it would be the screen
 * promising an automation on the very screen whose first paragraph refuses one.
 * And correcting one of the four while leaving three is arbitrary. The SRD's own
 * wording is where the SRD's own wording belongs: in the reference, quoted with
 * its page number, one tap away in both directions.
 */
import { useState } from 'react';
import { type Countdown, type CountdownKind } from '../../engine/encounter.ts';
import { Fold } from '../shared/Fold.tsx';
import { Stepper } from './Encounter.tsx';
import { FearBoard } from './FearPool.tsx';
import { useGm } from './gmStore.ts';
import { CountdownChart } from './ReferenceTables.tsx';
// One map, two screens. A session row draws a countdown now as well as this
// board does, and two copies of "dynamic is orange" is how one of them goes
// green.
import { COUNTDOWN_KIND_COLOR } from './session.ts';

const KINDS: Array<{ id: CountdownKind; label: string; hint: string }> = [
  { id: 'standard', label: 'Standard', hint: 'Advances when the fiction says it does.' },
  { id: 'dynamic', label: 'Dynamic', hint: 'Advances by the outcome of a roll — you decide by how much.' },
  { id: 'loop', label: 'Loop', hint: 'Returns to its starting value the moment it runs out.' },
  { id: 'long-term', label: 'Long-term', hint: 'Advances across downtime and between sessions.' },
];

export function Countdowns({ phone }: { phone: boolean }): React.JSX.Element {
  const countdowns = useGm((s) => s.countdowns);

  return (
    <div
      className="scroll stack"
      style={{ flex: 1, minHeight: 0, gap: 14, padding: phone ? '10px 12px 16px' : '14px 20px 18px' }}
    >
      <FearBoard phone={phone} />

      <div
        style={{
          flex: 'none',
          display: 'grid',
          gridTemplateColumns: phone ? '1fr' : '1fr minmax(280px, 340px)',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div className="stack" style={{ gap: 10, minWidth: 0 }}>
          <div className="spread">
            <span className="t-label">Countdowns</span>
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              {countdowns.length} RUNNING
            </span>
          </div>
          {countdowns.length === 0 ? (
            <div className="panel stack" style={{ flex: 'none', padding: 16, gap: 9 }}>
              <span className="t-vital" style={{ color: 'var(--muted)' }}>
                No countdowns
              </span>
              <p className="t-body" style={{ margin: 0, maxWidth: 480 }}>
                Nothing here ever advances by itself. The app does not know when a trigger fired,
                whether a roll counted toward the clock, or whether the party rested — you do. That
                is deliberate: a countdown that moves on its own is one you have to check.
              </p>
              <p className="t-body" style={{ margin: 0, maxWidth: 480, color: 'var(--muted)' }}>
                Name one, give it a starting value, and move it by hand.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: 10,
              }}
            >
              {countdowns.map((c) => (
                <CountdownRow key={c.id} countdown={c} />
              ))}
            </div>
          )}
        </div>
        <NewCountdown />
      </div>
    </div>
  );
}

function NewCountdown(): React.JSX.Element {
  const add = useGm((s) => s.addCountdown);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CountdownKind>('standard');
  const [start, setStart] = useState(4);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') return;
    add(trimmed, kind, start);
    setName('');
    setStart(4);
  };

  return (
    <form className="panel stack" onSubmit={submit} style={{ padding: 12, gap: 11 }}>
      <span className="t-label">New countdown</span>
      <input
        value={name}
        aria-label="Countdown name"
        placeholder="The ritual completes"
        onChange={(e) => setName(e.target.value)}
        style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1 var(--sans)' }}
      />
      <div className="stack" style={{ gap: 5 }}>
        <label className="t-meta" htmlFor="cd-kind">
          KIND
        </label>
        <select
          id="cd-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as CountdownKind)}
          style={{ minHeight: 44, padding: '4px 10px', font: '600 13px/1 var(--sans)' }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <span className="t-dense" style={{ color: 'var(--dim)' }}>
          {KINDS.find((k) => k.id === kind)?.hint}
        </span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <Stepper label="Starts at" value={start} onChange={setStart} min={1} />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={name.trim() === ''}
          style={{ flex: 1, alignSelf: 'flex-end' }}
        >
          ADD
        </button>
      </div>
    </form>
  );
}

function CountdownRow({ countdown }: { countdown: Countdown }): React.JSX.Element {
  const advance = useGm((s) => s.advanceCountdown);
  const reset = useGm((s) => s.resetCountdown);
  const remove = useGm((s) => s.removeCountdown);
  const c = countdown;
  const spent = c.value === 0;
  const color = COUNTDOWN_KIND_COLOR[c.kind];

  return (
    <article
      className="panel stack"
      style={{
        flex: 'none',
        padding: 11,
        gap: 10,
        borderLeft: `3px solid ${spent ? 'var(--damage)' : color}`,
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <span style={{ font: '700 15px/1.2 var(--sans)' }}>{c.name}</span>
          <span className="row" style={{ gap: 7 }}>
            <span className="chip" style={{ color }}>
              {c.kind.toUpperCase()}
            </span>
            <span className="t-meta">STARTED AT {c.start}</span>
            {spent && (
              <span className="t-meta" style={{ color: 'var(--damage)', fontWeight: 600 }}>
                SPENT — IT HAPPENS NOW
              </span>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={() => reset(c.id)}
          className="t-meta"
          style={{ flex: 'none', minHeight: 'var(--control)', padding: '0 8px', letterSpacing: '0.1em' }}
        >
          RESET
        </button>
        <button
          type="button"
          onClick={() => remove(c.id)}
          aria-label={`Delete the countdown ${c.name}`}
          className="t-meta"
          style={{ flex: 'none', width: 34, minHeight: 'var(--control)', color: 'var(--dim)' }}
        >
          ✕
        </button>
      </div>

      <div className="row" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={() => advance(c.id, -1)}
          aria-label={`Advance ${c.name} by one`}
          className="btn"
          style={{ flex: 'none', width: 52, minHeight: 48, font: '700 21px/1 var(--sans)' }}
        >
          −
        </button>
        <span
          aria-live="polite"
          style={{
            flex: 'none',
            minWidth: 62,
            textAlign: 'center',
            font: '800 34px/1 var(--sans)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: spent ? 'var(--damage)' : 'var(--text)',
          }}
        >
          {c.value}
        </span>
        <button
          type="button"
          onClick={() => advance(c.id, 1)}
          aria-label={`Move ${c.name} back by one`}
          className="btn"
          style={{ flex: 'none', width: 52, minHeight: 48, font: '700 21px/1 var(--sans)' }}
        >
          +
        </button>
        <div className="row" aria-hidden="true" style={{ gap: 3, flex: 1, minWidth: 0 }}>
          {Array.from({ length: c.start }, (_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 22,
                height: 14,
                borderRadius: 'var(--r1)',
                background: i < c.value ? color : 'transparent',
                border: `1.5px solid ${i < c.value ? color : 'var(--empty)'}`,
              }}
            />
          ))}
        </div>
      </div>

      {/*
        Only on a dynamic countdown, and only below the −/value/+ row, which
        keeps its exact position and its exact 48px. A standard countdown gets
        no fold at all: the chart is the rule for dynamic ones, and offering it
        anywhere else would be the row claiming a rule that is not about it.
      */}
      {c.kind === 'dynamic' && (
        <Fold label="ADVANCE BY A ROLL" summary="SRD 1.0">
          <CountdownChart countdown={c} />
        </Fold>
      )}
    </article>
  );
}
