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
 * The choices are `SESSION_ITEM_KINDS.map(...)`, in the record's own order,
 * rather than a button per kind typed out here, and the count in the back
 * button's label is read off the same list rather than spelled into it. A kind
 * added to that list cannot be silently missing from this menu, which is the
 * failure mode this repo has shipped four times - built, tested, unreachable -
 * and the one the `unreadable` arm one level down exists to make visible.
 *
 * It cannot be half-added either. `ADD_FORMS` below is
 * `Record<SessionItemKind, …>`, so the same addition that puts a button here
 * is the one `tsc` refuses until the button has a form and a sentence behind
 * it: the menu and the forms are one list, checked by the compiler, not two
 * that can drift.
 *
 * **`SESSION_ITEM_KINDS` is not `SessionItem['kind']`, and the gap is on
 * purpose.** It has never held `unreadable`, which is a reading rather than a
 * thing a GM adds, and that is the whole of the gap now.
 *
 * It used to be wider, and the reason it closed is worth keeping: from campaign
 * schema 2 the list was also short of every kind whose form had not been built,
 * because widening it first would have put a button on this sheet that minted
 * nothing - worse than a button that is not there yet. `url` and `note` were
 * the two, and they joined on 19 August 2026 in the same change that gave them
 * forms, which is exactly the order that rule asked for. **The rule is not
 * spent**: the next kind to reach the record without a screen waits here the
 * same way. `tests/gm/session.test.ts` pins the gap - the menu is exactly the
 * kinds with a form, and `unreadable` is never one of them - so it stays a
 * decision rather than becoming an oversight.
 *
 * ## The two seats that were held apart here, and what they were for
 *
 * The web link's form and the note's form were planned as two separate lanes,
 * and all three places either of them had to touch - a factory in the import
 * below, a row in `ADD_FORMS`, and a form at the foot of the file - carried a
 * marked seat for each, several lines apart, because a pair of insertions at
 * one point is a merge conflict and a pair at two points is a merge. In the
 * end one change made both, so the shape was never tested by the thing it was
 * built for. The seats are gone now that they are filled; the ordering they
 * imposed is why `url` sits beside `link` and `note` sits at the end, which is
 * worth knowing before somebody sorts this list.
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
 * is a string and nothing more: `UrlArm` in `UrlArm.tsx` draws the address
 * as text and builds no anchor, and `externalLinkAttrs` - the only sanctioned
 * way to build one - has no production caller yet. The lane that adds the
 * anchor adds a tap that hands the address to the browser, which is the
 * browser's navigation and still not a request this app makes.
 * `LINK_KINDS` in `shared/campaigns.ts` says which half moved.
 *
 * A **countdown** goes through `addCountdown` rather than through a factory,
 * because the row and the countdown inside it deliberately share one id and
 * that id is minted in the store. It is the only kind ADD offers that refuses
 * an empty name, and the reason is on screen beside the field: the primary
 * countdown's name is what the top bar prints and what its `−` button is
 * called, so a nameless one produces a control a screen reader announces as
 * "Advance  by one".
 *
 * ## Where the row goes, said out loud
 *
 * Every one of them appends. On a night with twelve rows the new one is
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
 * sheet in the same panel at the same `padding: 14`. The choices are
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
import { displayUrl, readExternalUrl } from '../../../shared/externalLink.ts';
import { MAX_NOTE_CHARS } from '../../../shared/richText.ts';
import type { Ref } from '../../../shared/types.ts';
import type { CountdownKind } from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { Stepper } from './Encounter.tsx';
import { useGm } from './gmStore.ts';
import {
  LINK_KIND_LABEL,
  SESSION_KIND_LABEL,
  newLink,
  newUrl,
  newScene,
  //
  newNote,
  plannedAdversaries,
} from './session.ts';

/** A choice on the first screen: what it mints, and what it says it is. */
interface AddChoice {
  form: (props: { onDone: () => void }) => React.JSX.Element;
  /** The line under the label. Never a rule; what the row is for. */
  what: string;
}

/**
 * Every kind ADD can mint, one row each, in the order the menu draws them.
 *
 * This replaced a lookup of sentences beside four `kind === '…' && <Form/>`
 * lines. The form and the sentence are one row now for the ordinary reason -
 * two tables keyed the same way are two tables that can disagree - and for a
 * scheduling one: adding a kind is adding a row here, so two lanes adding two
 * kinds add two rows rather than editing one line each other way.
 *
 * `Record<SessionItemKind, AddChoice>` is the whole check. `SessionItemKind` is
 * `SESSION_ITEM_KINDS[number]`, so a kind in the menu with no row here does not
 * compile, and a row here for a kind not in the menu does not compile either -
 * the second list cannot drift from the first because it is not a second list.
 * `tests/gm/session.test.ts` asserts it again at runtime, in order, because a
 * cast gets past the type and not past that - which is why this is exported
 * into a test rather than kept private to the sheet.
 */
export const ADD_FORMS: Record<SessionItemKind, AddChoice> = {
  scene: {
    form: SceneForm,
    what: 'A beat of tonight — a place, and the fight in it if there is one. It remembers an environment, carries a roster you can put back on the board, and opens the scene runner.',
  },
  link: {
    form: LinkForm,
    what: 'Something already inside this app you will want open — an adversary, an environment, a card, or a rule.',
  },
  url: {
    form: UrlForm,
    what: 'A page outside this app. The row stores the address and opens it in a new tab; nothing here ever opens on its own.',
  },
  countdown: {
    form: CountdownForm,
    what: 'A clock nothing advances but your hand. It can be pinned to the top bar all evening.',
  },
  note: {
    form: NoteForm,
    what: 'Something you wrote for tonight. It travels with the campaign when you export it.',
  },
};

/** The four countdown kinds, in the words the countdowns board uses. */
const COUNTDOWN_KINDS: Array<{ id: CountdownKind; label: string }> = [
  { id: 'standard', label: 'Standard — advances when the fiction says it does' },
  { id: 'dynamic', label: 'Dynamic — advances by the outcome of a roll' },
  { id: 'loop', label: 'Loop — returns to its start the moment it runs out' },
  { id: 'long-term', label: 'Long-term — advances when the party rests, not when a roll lands' },
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
              {ADD_FORMS[id].what}
            </span>
          </button>
        ))}
      </div>
    );
  }

  const Chosen = ADD_FORMS[kind].form;

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
        {/*
          The count is read off the list, so it cannot say FOUR beside five
          buttons - it is the same defect as a stale docblock, on glass. It is
          a digit rather than the word this label used to spell, because
          spelling it needs a second table of number words, and a second table
          keyed by a length is the exact thing the rest of this file just
          stopped doing. The register is already here: the scene form below
          says CARRY THE 12 INTO THIS SCENE.

          That citation used to read "the encounter form two screens down says
          TAKE THE 3 ON THE BOARD NOW", and it was wrong twice: the string is
          this file's own scene form, not another screen's, and the encounter
          form says SEND n TO THE SCENE. Both halves are corrected here rather
          than dropped, because a docblock that cites a sibling by quoting it
          is exactly how the quote outlives the sibling.
        */}
        {`← THE ${String(SESSION_ITEM_KINDS.length)} KINDS`}
      </button>

      <Chosen onDone={onClose} />

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

/**
 * One form, since `CAMPAIGN_SCHEMA_VERSION` 3.
 *
 * It used to be two, and the pair is what decision 1 closed: a scene and the
 * fight in it were two rows whose relationship was *adjacency*, which a drag
 * destroyed silently. The roster control below is `EncounterForm`'s, moved
 * rather than rebuilt, and it keeps that form's own sentence about why a new
 * row never carries a half-finished fight.
 */
function SceneForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const environments = useApp((s) => s.dataset.environments);
  const index = useApp((s) => s.index);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const add = useGm((s) => s.addSessionItem);
  const roster = useGm((s) => s.roster);
  const adjustments = useGm((s) => s.adjustments);
  const [name, setName] = useState('');
  const [environmentRef, setEnvironmentRef] = useState('');
  const [carryRoster, setCarryRoster] = useState(false);
  /*
    Adversaries, not the sum of the counts - the same correction `SEND n TO THE
    SCENE` took in this commit, and for the same reason. A Minion entry at 3 is
    three groups the size of the party, so this button offered to carry "3"
    into a row that would open with twelve in it, and the row's own shut line
    has read `12 PLANNED` about that roster all along.
  */
  const planned = plannedAdversaries(roster, index, partySize);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        add(
          carryRoster
            ? newScene(name, environmentRef === '' ? null : environmentRef, { roster, adjustments })
            : newScene(name, environmentRef === '' ? null : environmentRef),
        );
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
      <button
        type="button"
        aria-pressed={carryRoster}
        disabled={planned === 0}
        onClick={() => setCarryRoster(!carryRoster)}
        className="btn"
        style={{
          flex: 'none',
          minHeight: 'var(--tap)',
          opacity: planned === 0 ? 0.5 : 1,
          background: carryRoster ? 'var(--hope)' : 'var(--raised)',
          color: carryRoster ? 'var(--app)' : 'var(--text)',
          borderColor: carryRoster ? 'transparent' : 'var(--line)',
        }}
      >
        {planned === 0
          ? 'THERE IS NO ROSTER TO CARRY'
          : `CARRY THE ${String(planned)} INTO THIS SCENE`}
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

/**
 * A web link row.
 *
 * The address is read on every keystroke rather than on submit, because the
 * reason a URL is refused is the one thing this form has to say before the GM
 * presses anything - `readExternalUrl` returns the sentence, and it is printed
 * where it was typed. SUBMIT is disabled while it is refused, so the sheet
 * cannot mint the empty-href row that `UrlArm` has a warning for; that state
 * exists for records this build did not write.
 */
function UrlForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const add = useGm((s) => s.addSessionItem);
  const [name, setName] = useState('');
  const [raw, setRaw] = useState('');
  const read = readExternalUrl(raw);
  const refused = raw.trim() !== '' && read.href === '';

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (read.href === '') return;
        add(newUrl(name, raw));
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
      <Field label="ADDRESS">
        <input
          value={raw}
          inputMode="url"
          placeholder="https://…"
          onChange={(e) => setRaw(e.target.value)}
          style={INPUT}
        />
      </Field>
      {refused && (
        <p className="t-dense" role="status" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          Not stored: {read.why}.
        </p>
      )}
      {read.href !== '' && (
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', overflowWrap: 'anywhere' }}>
          Goes to {displayUrl(read.href, 2048)}
        </p>
      )}
      <Submit disabled={read.href === ''} />
    </Form>
  );
}

/**
 * A note row.
 *
 * A textarea and not an editor. The stored format carries bold, italics,
 * bullets and a centred heading, and `NoteArm` draws all four - but nothing in
 * this build *types* them, so this mints paragraphs through
 * `noteFromPlainText` and says so rather than offering controls that would
 * mint a shape it cannot then edit. A note that arrives with emphasis from an
 * imported campaign keeps it; this form does not strip it, because it never
 * touches an existing note.
 */
function NoteForm({ onDone }: { onDone: () => void }): React.JSX.Element {
  const add = useGm((s) => s.addSessionItem);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const over = text.length > MAX_NOTE_CHARS;

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (over) return;
        add(newNote(name, text));
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
      <Field label="NOTE">
        <textarea
          value={text}
          rows={6}
          placeholder="One paragraph per line."
          onChange={(e) => setText(e.target.value)}
          style={{ ...INPUT, minHeight: 120, resize: 'vertical' }}
        />
      </Field>
      {over && (
        <p className="t-dense" role="status" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          That is {String(text.length)} characters, and a note holds at most {String(MAX_NOTE_CHARS)}.
        </p>
      )}
      <Submit disabled={over} />
    </Form>
  );
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
// Item 12's `UrlForm` goes here, under a rule of its own like the four around
// it, beside the in-app link it is the outward half of.
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

// ---------------------------------------------------------------------------
// Item 14's `NoteForm` goes here, at the end - a long way below the other seat
// rather than beside it, for the reason the header gives.
// ---------------------------------------------------------------------------
