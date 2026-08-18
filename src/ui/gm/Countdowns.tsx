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
 * ## The shelf makes clocks; it still never moves one
 *
 * A template is a countdown the GM set up once — a name, a kind, a starting
 * number — and drops on the table as many times as the evening needs. Its home,
 * and why it is not a field on the campaign record, is argued at length in
 * `countdownTemplates.ts`. What matters on this screen is that dropping one
 * creates a clock and nothing else: it does not advance one, it does not pin
 * one, and it does not touch a clock dropped from the same template ten minutes
 * ago. The paragraph at the top of this file is untouched by it.
 *
 * Two gestures, two sizes, on purpose. Both are on a full-width row, so both
 * are inside the arc of the thumb already holding the phone; what separates
 * them is how much of that row each one gets. DROP takes all of it but the
 * corner, because dropping is what the shelf is for and it is aimed at while
 * somebody is talking. The ✕ that forgets a template is the corner, because a
 * mis-tap on DROP costs one tap to undo — the new row's own ✕ — and a mis-tap
 * on forget costs the GM something they typed. It sits at the trailing edge
 * because that is where every other destructive control on this screen already
 * sits, and a delete that moves is worse than a delete that is reachable.
 *
 * Both declare their height inline: jsdom reads inline styles only, so a floor
 * set in a class is a floor no test can see. DROP is `--tap`, a flat 44px on
 * every pointer; the ✕ is `--control`, which `tokens.css` drops to 34px only on
 * a window at least 1180px wide with a fine pointer, and holds at the 44px
 * floor everywhere a thumb can reach the glass — width as well as height, since
 * a 34px-wide target under a thumb is under the floor however tall it is.
 *
 * That last clause is the project's floor and not this control's taste, and two
 * ✕s older than this shelf do not meet it: `CountdownRow`'s delete lower down
 * in this file, and the one that takes an adversary out of the scene in
 * `Scene.tsx`, both write `width: 34` as a literal beside a `--control` height,
 * so on a phone both are 34px wide under a thumb. Said out loud here rather
 * than left for the next reader to notice that the sentence above condemns the
 * neighbours. Not changed with them, and deliberately: widening a *destructive*
 * target that sits beside RESET is an ergonomic decision of its own, this lane
 * measured nothing in a browser, and the literal is an idiom shared by two
 * files rather than one slip in this one.
 *
 * Where it goes, and the gesture that is *not* on it. The shelf shares a column
 * with NEW COUNTDOWN and sits above it — on a phone that column is under the
 * running clocks, on a wide window it is the rail beside them. Either way the
 * clocks keep the top, and that is the ergonomic decision rather than an
 * accident of the grid: ±1 on a running clock is the gesture of the scene and
 * must not move, while dropping a template happens between scenes, when a
 * scroll costs nothing. The shelf draws nothing at all until there is something
 * on it — an empty shelf would be a permanent panel teaching a feature by
 * taking height away from the clocks, and KEEP AS TEMPLATE is on the form
 * below, where the teaching belongs.
 *
 * What moves when the shelf grows, which is the part of that decision the
 * paragraph above does not cover. The shelf is NEW COUNTDOWN's previous sibling
 * in one stack, so the first successful KEEP inserts an entire panel — its own
 * padding, a label row, one template row — above the form, and every KEEP after
 * that inserts another row. The form therefore moves down at the instant KEEP
 * is pressed, and the two controls that move are ADD and KEEP itself: the two
 * things the thumb is already on. Nothing else moves. The clocks are the stack
 * above this one on a phone and the other grid column on a wide window, so the
 * ±1 the paragraph above protects is not affected by this at all.
 *
 * It is left that way, and the reason is where the mis-tap lands rather than
 * whether there is one. KEEP goes inert the moment the triple is on the shelf,
 * so a second press at the coordinates KEEP just vacated cannot keep twice;
 * what it can land on is the row that shift brings down to it, which is Starts
 * at and ADD. A countdown nobody asked for costs one tap on the new clock's own
 * ✕ to undo — which is the same line this file already draws between DROP and
 * forget, and the shift puts nothing that costs the GM something they typed
 * under the thumb: both ✕s are outside the form and neither one moves into it.
 * Reversing the order would buy the stillness back and charge a scroll past the
 * whole form for every drop, and the drop is the one-tap gesture aimed at while
 * somebody is still talking.
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
import { useCountdownTemplates, type CountdownTemplate } from './countdownTemplates.ts';
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
        <div className="stack" style={{ gap: 10, minWidth: 0 }}>
          <TemplateShelf />
          <NewCountdown />
        </div>
      </div>
    </div>
  );
}

/**
 * The shelf, and nothing where the shelf would be when it is empty.
 *
 * `null` rather than an empty-state panel: this screen already spends a panel
 * on "No countdowns", and a second one saying "no templates either" would take
 * height from the clocks to teach a feature the form below teaches by having a
 * button on it.
 */
function TemplateShelf(): React.JSX.Element | null {
  const templates = useCountdownTemplates((s) => s.templates);
  if (templates.length === 0) return null;

  return (
    <section className="panel stack" style={{ flex: 'none', padding: 12, gap: 9 }}>
      <div className="spread">
        <span className="t-label">Templates</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>{templates.length} KEPT</span>
      </div>
      <div className="stack" style={{ gap: 7 }}>
        {templates.map((t) => (
          <TemplateRow key={t.id} template={t} />
        ))}
      </div>
    </section>
  );
}

/**
 * One template: a wide DROP and a narrow forget.
 *
 * The drop calls the same `addCountdown` the ADD button below calls, so a clock
 * made from a template is a clock, with its own id and its own number, and the
 * template it came from is not recorded on it.
 *
 * It discards the id that action hands back, and so does ADD on this screen —
 * the one caller in the app that keeps it is `AddSheet.tsx`'s countdown form,
 * which needs it for `setPrimaryCountdown(id)` when its PIN switch is on.
 * Nothing here offers that switch, because a GM dropping the third clock of the
 * evening has not asked for the top bar to change. Pinning stays where it
 * already is — "PIN IT TO THE TOP BAR" on the session row itself — rather than
 * becoming a second switch on a shelf whose whole gesture is one tap.
 *
 * Heights are inline because a test can only read them there; the two tokens
 * are argued in this file's header.
 */
function TemplateRow({ template }: { template: CountdownTemplate }): React.JSX.Element {
  const add = useGm((s) => s.addCountdown);
  const forget = useCountdownTemplates((s) => s.forget);
  const t = template;
  const color = COUNTDOWN_KIND_COLOR[t.kind];

  return (
    <div className="row" style={{ gap: 7 }}>
      <button
        type="button"
        onClick={() => add(t.name, t.kind, t.start)}
        aria-label={`Drop a countdown from the template ${t.name}`}
        className="btn"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 'var(--tap)',
          justifyContent: 'flex-start',
          gap: 8,
          padding: '0 10px',
          borderLeft: `3px solid ${color}`,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
            font: '700 14px/1.2 var(--sans)',
          }}
        >
          {t.name}
        </span>
        <span className="t-meta" style={{ flex: 'none', color }}>
          {t.kind.toUpperCase()}
        </span>
        <span className="t-meta" style={{ flex: 'none' }}>FROM {t.start}</span>
      </button>
      <button
        type="button"
        onClick={() => forget(t.id)}
        aria-label={`Forget the template ${t.name}`}
        className="t-meta"
        style={{
          flex: 'none',
          width: 'var(--control)',
          minHeight: 'var(--control)',
          color: 'var(--dim)',
        }}
      >
        ✕
      </button>
    </div>
  );
}

function NewCountdown(): React.JSX.Element {
  const add = useGm((s) => s.addCountdown);
  const keep = useCountdownTemplates((s) => s.keep);
  const templates = useCountdownTemplates((s) => s.templates);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CountdownKind>('standard');
  const [start, setStart] = useState(4);
  const trimmed = name.trim();
  const kept = templates.some((t) => t.name === trimmed && t.kind === kind && t.start === start);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
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
          disabled={trimmed === ''}
          style={{ flex: 1, alignSelf: 'flex-end' }}
        >
          ADD
        </button>
      </div>
      {/*
        The three fields above *are* a template — a name, a kind and a starting
        number — so KEEP is the same form read the other way, and it clears
        nothing. A GM who wants this clock on the table tonight as well presses
        ADD next, with the fields still filled.

        The label is the receipt, and it has to be, because the shelf is not.
        The row a keep produces appears above this whole form, and on a phone
        that is above the fold this button is at the bottom of - so a shelf row
        is a confirmation the GM would have to go and look for. Saying it here
        is the same idiom the session row already uses for "PINNED TO THE TOP
        BAR" against "PIN IT TO THE TOP BAR": the control states which of the
        two states it is in rather than only what it does.

        Inert while it says KEPT, rather than enabled and quietly idempotent.
        `keep` returns the existing id for a triple that is already on the
        shelf, so a second press does nothing either way - and a button that
        can be pressed and does nothing is the worse of the two lies.

        `type="button"`, because a `<button>` inside a `<form>` submits by
        default and this one must not start a countdown.
      */}
      <button
        type="button"
        onClick={() => keep(name, kind, start)}
        disabled={trimmed === '' || kept}
        className="btn"
        style={{ minHeight: 'var(--tap)' }}
      >
        {kept ? 'KEPT AS A TEMPLATE' : 'KEEP AS TEMPLATE'}
      </button>
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
