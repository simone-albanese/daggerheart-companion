/**
 * ADD: the sheet that finally lets this build write a session row.
 *
 * Until now the list could read a row, draw it, reorder it and delete it, and
 * could not make one. Only a countdown could be started, and only from the
 * Fear board - so the "compose the night" screen could not be composed. This
 * is the missing half.
 *
 * ## Two steps, and the first one is generated
 *
 * The four choices are `SESSION_ITEM_KINDS.map(...)`, in the record's own
 * order, rather than four buttons typed out here. A kind added to that list
 * appears in this menu unbuilt and obviously broken instead of silently
 * missing - which is the failure mode this repo has shipped four times, and the
 * one the `unreadable` arm one level down exists to make visible.
 *
 * **`SESSION_ITEM_KINDS` is not `SessionItem['kind']`, and the gap is on
 * purpose.** It has never held `unreadable`, which is a reading rather than a
 * thing a GM adds; since campaign schema 2 it also does not hold `url` or
 * `note`, which are readable, writable and exportable from today and get their
 * forms in the two lanes that build their screens. Widening the list before
 * then would put two buttons on this sheet that mint nothing, which is worse
 * than a button that is not there yet. `tests/gm/session.test.ts` pins the gap
 * so it stays a decision rather than becoming an oversight.
 *
 * ## What each form can honestly promise
 *
 * A **scene** records an environment. It does not put that environment on the
 * board: the board holds one environment per campaign and it is the *table*,
 * not the plan, so the row carries PUT THIS ON THE BOARD once it exists.
 *
 * An **encounter** can take the roster that is on the board right now, which
 * is how a GM who has just built a fight keeps it for later. It never takes
 * the combatants: those are the live fight, no action in `gmStore` sets a
 * combatant list wholesale, and a row that arrived carrying one would show a
 * number nothing could ever change again.
 *
 * A **link** points at something already inside this app - an adversary, an
 * environment, a card, a rule. Still never a URL, and that is now a fact about
 * this row rather than about the session list: campaign schema 2 added a `url`
 * row beside it, which is a different kind with its own reader and its own six
 * mitigations in `shared/externalLink.ts`. The claim underneath both is
 * unchanged - the app still makes exactly one kind of network request and it is
 * same-origin, because a `url` row is a string this app never fetches. Today it
 * is a string and nothing more: `UrlArm` in `SessionBody.tsx` draws the address
 * as text and builds no anchor, and `externalLinkAttrs` - the only sanctioned
 * way to build one - has no production caller yet. The lane that adds the
 * anchor adds a tap that hands the address to the browser, which is the
 * browser's navigation and still not a request this app makes.
 * `LINK_KINDS` in `shared/campaigns.ts` says which half moved.
 *
 * A **countdown** goes through `addCountdown` rather than through a factory,
 * because the row and the countdown inside it deliberately share one id and
 * that id is minted in the store. It is the only one of the four that refuses
 * an empty name, and the reason is on screen beside the field: the primary
 * countdown's name is what the top bar prints and what its `−` button is
 * called, so a nameless one produces a control a screen reader announces as
 * "Advance  by one".
 *
 * ## Where the row goes, said out loud
 *
 * Every one of the four appends. On a night with twelve rows the new one is
 * off the bottom of the screen, and a sheet that closed with no word about it
 * would look like nothing happened - so the button says where the row lands
 * and the line under it says how to move it.
 *
 * ## Ergonomics, 393x852
 *
 * The sheet's inner column is **363px**, not the "365" that `393 - 28 of padding`
 * gives: this sheet draws inside `GmSheet`'s panel - `Gm.tsx` mounts all four
 * sheets there - which is border-box with a 1px border (`GmSheet.tsx`). 363
 * is measured in Chrome at 393x852 and recorded in `ShowSheet.tsx`, the sibling
 * sheet in the same panel at the same `padding: 14`. The four choices are
 * full-width and `minHeight: 56` rather than 44: this is the most-used
 * sheet on the screen, it opens directly above the thumb that pressed ADD, and
 * 56 is what lets the second tap land without the eye leaving the bar. Inside
 * a form every input, select and button is at least 44, the stepper's two
 * squares are `var(--control)`, and BACK is a 44px row of its own at the top
 * where it cannot be hit while reaching for the submit at the bottom.
 */
import { useState } from 'react';
import {
  SESSION_ITEM_KINDS,
  LINK_KINDS,
  type LinkKind,
  type SessionItemKind,
} from '../../../shared/campaigns.ts';
import type { Ref } from '../../../shared/types.ts';
import type { CountdownKind } from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { Stepper } from './Encounter.tsx';
import { useGm } from './gmStore.ts';
import { LINK_KIND_LABEL, SESSION_KIND_LABEL, newEncounter, newLink, newScene } from './session.ts';

const WHAT_IT_IS: Record<SessionItemKind, string> = {
  scene: 'A place tonight goes through. It remembers an environment, and opens the scene runner.',
  encounter:
    'A fight you have planned. It carries a roster you can put back on the board when you reach it.',
  link: 'Something already inside this app you will want open — an adversary, an environment, a card, or a rule.',
  countdown: 'A clock nothing advances but your hand. It can be pinned to the top bar all evening.',
};

/** The four countdown kinds, in the words the countdowns board uses. */
const COUNTDOWN_KINDS: Array<{ id: CountdownKind; label: string }> = [
  { id: 'standard', label: 'Standard — advances when the fiction says it does' },
  { id: 'dynamic', label: 'Dynamic — advances by the outcome of a roll' },
  { id: 'loop', label: 'Loop — returns to its start the moment it runs out' },
  { id: 'long-term', label: 'Long-term — advances across downtime and between sessions' },
];

export function AddSheet({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [kind, setKind] = useState<SessionItemKind | null>(null);

  if (kind === null) {
    return (
      <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: 14 }}>
        {SESSION_ITEM_KINDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            className="panel stack"
            style={{
              flex: 'none',
              minHeight: 56,
              gap: 5,
              padding: '10px 12px',
              textAlign: 'left',
              alignItems: 'flex-start',
            }}
          >
            <span className="t-label" style={{ letterSpacing: '0.1em' }}>
              {SESSION_KIND_LABEL[id].toUpperCase()}
            </span>
            <span className="t-dense" style={{ color: 'var(--muted)', maxWidth: '62ch' }}>
              {WHAT_IT_IS[id]}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 12, padding: 14 }}>
      <button
        type="button"
        onClick={() => setKind(null)}
        className="t-meta"
        style={{
          flex: 'none',
          minHeight: 44,
          alignSelf: 'flex-start',
          padding: '0 8px',
          letterSpacing: '0.1em',
          color: 'var(--muted)',
        }}
      >
        ← THE FOUR KINDS
      </button>

      {kind === 'scene' && <SceneForm onDone={onClose} />}
      {kind === 'encounter' && <EncounterForm onDone={onClose} />}
      {kind === 'link' && <LinkForm onDone={onClose} />}
      {kind === 'countdown' && <CountdownForm onDone={onClose} />}

      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        A new row goes at the end of the night. Drag it by the handle at its right edge, or open
        it and use MOVE UP, to put it where it belongs.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** A label above its control, at the one size everything in a form uses. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="stack" style={{ flex: 'none', gap: 5 }}>
      <span className="t-meta">{label}</span>
      {children}
    </label>
  );
}

const INPUT: React.CSSProperties = {
  minHeight: 44,
  padding: '8px 11px',
  font: '600 14px/1.2 var(--sans)',
};

const SELECT: React.CSSProperties = {
  minHeight: 44,
  padding: '4px 10px',
  font: '600 13px/1 var(--sans)',
};

/** The one verb every form ends with, saying where the row lands. */
function Submit({ disabled = false }: { disabled?: boolean }): React.JSX.Element {
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={disabled}
      style={{ flex: 'none', minHeight: 'var(--tap)' }}
    >
      ADD TO THE END OF THE NIGHT
    </button>
  );
}

const Form = ({
  onSubmit,
  children,
}: {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
}): React.JSX.Element => (
  <form className="stack" onSubmit={onSubmit} style={{ flex: 'none', gap: 11 }}>
    {children}
  </form>
);

// ---------------------------------------------------------------------------

function SceneForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const environments = useApp((s) => s.dataset.environments);
  const add = useGm((s) => s.addSessionItem);
  const [name, setName] = useState('');
  const [environmentRef, setEnvironmentRef] = useState('');

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        add(newScene(name, environmentRef === '' ? null : environmentRef));
        onDone();
      }}
    >
      <Field label="NAME">
        <input
          value={name}
          placeholder="The Sablewood gate"
          onChange={(e) => setName(e.target.value)}
          style={INPUT}
        />
      </Field>
      <Field label="ENVIRONMENT">
        <select
          value={environmentRef}
          onChange={(e) => setEnvironmentRef(e.target.value)}
          style={SELECT}
        >
          <option value="">No environment</option>
          {environments.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name}
            </option>
          ))}
        </select>
      </Field>
      <Submit />
    </Form>
  );
}

// ---------------------------------------------------------------------------

function EncounterForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const add = useGm((s) => s.addSessionItem);
  const roster = useGm((s) => s.roster);
  const adjustments = useGm((s) => s.adjustments);
  const [name, setName] = useState('');
  const [takeBoard, setTakeBoard] = useState(false);
  const planned = roster.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        add(
          takeBoard
            ? newEncounter(name, roster, adjustments)
            : newEncounter(name, [], { easier: false, harder: false, damageBump: false }),
        );
        onDone();
      }}
    >
      <Field label="NAME">
        <input
          value={name}
          placeholder="The ambush at the ford"
          onChange={(e) => setName(e.target.value)}
          style={INPUT}
        />
      </Field>
      <button
        type="button"
        aria-pressed={takeBoard}
        disabled={planned === 0}
        onClick={() => setTakeBoard(!takeBoard)}
        className="btn"
        style={{
          flex: 'none',
          minHeight: 'var(--tap)',
          opacity: planned === 0 ? 0.5 : 1,
          background: takeBoard ? 'var(--hope)' : 'var(--raised)',
          color: takeBoard ? 'var(--app)' : 'var(--text)',
          borderColor: takeBoard ? 'transparent' : 'var(--line)',
        }}
      >
        {planned === 0
          ? 'THE BOARD HAS NO ROSTER ON IT'
          : `TAKE THE ${String(planned)} ON THE BOARD NOW`}
      </button>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        The roster is the plan. The fight itself stays on the board — this build can put a roster
        back, and cannot put a half-finished fight back, so a new row never carries one.
      </p>
      <Submit />
    </Form>
  );
}

// ---------------------------------------------------------------------------

/** Every link kind's records, as `{ id, name }`, from the loaded dataset. */
function useLinkOptions(kind: LinkKind): Array<{ id: Ref; name: string }> {
  const dataset = useApp((s) => s.dataset);
  switch (kind) {
    case 'adversary':
      return dataset.adversaries;
    case 'environment':
      return dataset.environments;
    case 'domainCard':
      return dataset.domainCards;
    case 'rule':
      // The one kind whose records call it `title`. `linkName` has the same
      // exception for the same reason, and both are checked in session.test.
      return dataset.rules.map((rule) => ({ id: rule.id, name: rule.title }));
  }
}

function LinkForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const add = useGm((s) => s.addSessionItem);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LinkKind>('adversary');
  const [ref, setRef] = useState('');
  const options = useLinkOptions(kind);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (ref === '') return;
        add(newLink(name, { kind, ref }));
        onDone();
      }}
    >
      <Field label="NAME">
        <input
          value={name}
          placeholder="What you will call it in the list"
          onChange={(e) => setName(e.target.value)}
          style={INPUT}
        />
      </Field>
      <Field label="WHAT IT POINTS AT">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as LinkKind);
            // The old ref belongs to the old kind's list; keeping it would
            // build a link to an adversary id stored as an environment.
            setRef('');
          }}
          style={SELECT}
        >
          {LINK_KINDS.map((id) => (
            <option key={id} value={id}>
              {LINK_KIND_LABEL[id]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={LINK_KIND_LABEL[kind].toUpperCase()}>
        <select value={ref} onChange={(e) => setRef(e.target.value)} style={SELECT}>
          <option value="">Choose one</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>
      <Submit disabled={ref === ''} />
    </Form>
  );
}

// ---------------------------------------------------------------------------

function CountdownForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const addCountdown = useGm((s) => s.addCountdown);
  const setPrimary = useGm((s) => s.setPrimaryCountdown);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CountdownKind>('standard');
  const [start, setStart] = useState(4);
  const [pin, setPin] = useState(false);
  const named = name.trim() !== '';

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (!named) return;
        // The store mints the id the row and the countdown share, and hands it
        // back for exactly this: pinning is `setPrimaryCountdown(id)`, and
        // reading `session.at(-1)` instead would be this form holding an
        // opinion about how `addCountdown` appends.
        const id = addCountdown(name.trim(), kind, start);
        if (pin) setPrimary(id);
        onDone();
      }}
    >
      <Field label="NAME">
        <input
          value={name}
          placeholder="The ritual completes"
          onChange={(e) => setName(e.target.value)}
          style={INPUT}
        />
      </Field>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
        A countdown is the one row that needs a name: it is what the top bar prints when it is
        pinned, and what its − button is called out loud.
      </p>
      <Field label="KIND">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as CountdownKind)}
          style={SELECT}
        >
          {COUNTDOWN_KINDS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <Stepper label="Starts at" value={start} onChange={setStart} min={1} />
      <button
        type="button"
        aria-pressed={pin}
        onClick={() => setPin(!pin)}
        className="btn"
        style={{
          flex: 'none',
          minHeight: 'var(--tap)',
          background: pin ? 'var(--hope)' : 'var(--raised)',
          color: pin ? 'var(--app)' : 'var(--text)',
          borderColor: pin ? 'transparent' : 'var(--line)',
        }}
      >
        {pin ? 'PINNED TO THE TOP BAR' : 'PIN IT TO THE TOP BAR'}
      </button>
      <Submit disabled={!named} />
    </Form>
  );
}
