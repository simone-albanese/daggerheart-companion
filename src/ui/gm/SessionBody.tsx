/**
 * What is inside a session row when the GM opens it.
 *
 * Five arms, one per kind of row, and the fifth is the reason this file is
 * written the way it is. `readSessionItem` keeps an item it cannot read rather
 * than dropping it from a list whose length the GM knows by heart, and keeps a
 * link whose target this build has no screen for. That decision only pays off
 * if both of them can be *drawn*, so both are drawn here: the unreadable row
 * shows its own bytes, and a link this dataset cannot resolve says so and shows
 * the ref, instead of rendering nothing and looking like a bug.
 *
 * ## The plan is not the table, and the row says so
 *
 * A campaign has one live board: one roster, one combatant list, one active
 * environment (`GmBoard`). A session row carries its *own* roster, adjustments,
 * combatants and environment ref, and nothing in the store copies one into the
 * other. So opening the encounter builder from row 3 shows the same board as
 * row 5, and that is not a bug to hide behind a sentence - it is two different
 * things with the same shape.
 *
 * The rows therefore carry the crossing explicitly, in both directions, built
 * only out of actions the store already has: PUT THIS ON THE BOARD and KEEP
 * WHAT IS ON THE BOARD. What has no verb is stated as a fact with no control:
 * a row's stored `combatants` cannot be put back, because no action in
 * `gmStore` sets the combatant list wholesale, and inventing a button that
 * silently dropped them would be exactly the kind of quiet wrongness the
 * founding rule is about.
 *
 * ## A card is drawn here, not in the reader
 *
 * A link row to a domain card renders `DomainCardView` in the row. The obvious
 * alternative - a button calling `setOpenCard`, which is how every other screen
 * reads a card - would put `CardReader` on top of the `GmSheet` this row can be
 * inside, and `useDialog` registers one unconditional window keydown listener
 * per dialog with no topmost check: one Escape would close both, and every Tab
 * would be fought over by two traps. The card is content here rather than an
 * overlay, so the question does not arise.
 *
 * ## Targets
 *
 * Every control in this file declares 44 or `var(--tap)` inline. The widest
 * thing any arm draws is full-width; the one piece of foreign text on the
 * screen - the unreadable row's raw JSON, one unbroken line as
 * `JSON.stringify` produced it - is wrapped and given its own horizontal
 * scroller, because a `<pre>` of it at 393px is the one element that could make
 * the whole page scroll sideways.
 */
import type { EncounterAdjustments, Ref } from '../../../shared/types.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';
import type { GmRegion } from './gmStore.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { paragraphs, ruleBlocks } from '../shared/ruleText.ts';
import { AdversaryBlock, EnvironmentBlock } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';
import { COUNTDOWN_KIND_COLOR, LINK_KIND_LABEL, sessionName } from './session.ts';

/** The engine's own words for the three switches a GM flips, shortened. */
const ADJUSTMENT_LABEL: Record<keyof EncounterAdjustments, string> = {
  easier: 'EASIER OR SHORTER FIGHT',
  damageBump: '+1D4 (OR +2) TO ALL ADVERSARY DAMAGE',
  harder: 'HARDER OR LONGER FIGHT',
};

const ADJUSTMENT_KEYS: Array<keyof EncounterAdjustments> = ['easier', 'damageBump', 'harder'];

const NOT_HERE = 'NOT IN THIS DATASET';

/** One verb, at the size a thumb finds without looking. */
function Verb({
  onClick,
  children,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn'}
      onClick={onClick}
      disabled={disabled}
      style={{ flex: 'none', minHeight: 'var(--tap)' }}
    >
      {children}
    </button>
  );
}

const Fact = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
    {children}
  </p>
);

export function SessionBody({
  item,
  phone,
  onOpenTool,
}: {
  item: SessionItem;
  phone: boolean;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  switch (item.kind) {
    case 'scene':
      return <SceneArm item={item} onOpenTool={onOpenTool} />;
    case 'encounter':
      return <EncounterArm item={item} onOpenTool={onOpenTool} />;
    case 'link':
      return <LinkArm item={item} phone={phone} />;
    case 'countdown':
      return <CountdownArm item={item} onOpenTool={onOpenTool} />;
    case 'unreadable':
      return <UnreadableArm item={item} />;
  }
}

// ---------------------------------------------------------------------------

function SceneArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'scene' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const environments = useApp((s) => s.dataset.environments);
  const patch = useGm((s) => s.patchSessionItem);
  const live = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);

  const known = environments.some((e) => e.id === item.environmentRef);
  const onBoard = item.environmentRef !== null && item.environmentRef === live;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="stack" style={{ gap: 5 }}>
        <span className="t-meta">ENVIRONMENT</span>
        <select
          value={item.environmentRef ?? ''}
          onChange={(e) => patch(item.id, { environmentRef: e.target.value || null })}
          style={{ minHeight: 'var(--tap)', font: '600 13px/1 var(--sans)' }}
        >
          <option value="">No environment</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
          {/*
            A ref this dataset does not carry is still the plan. Offering it as
            an option is what stops the select from silently reading as "No
            environment" and writing that back on the first change.
          */}
          {item.environmentRef !== null && !known && (
            <option value={item.environmentRef}>{item.environmentRef} — {NOT_HERE}</option>
          )}
        </select>
      </label>

      <Fact>
        This is the plan. The scene runner shows whatever environment is on the
        board right now, which is one per campaign — {onBoard ? 'and it is this one.' : 'and it is not this one.'}
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb
          onClick={() => setEnvironment(item.environmentRef)}
          disabled={onBoard || item.environmentRef === null}
        >
          PUT THIS ON THE BOARD
        </Verb>
        <Verb onClick={() => patch(item.id, { environmentRef: live })} disabled={item.environmentRef === live}>
          KEEP WHAT IS ON THE BOARD
        </Verb>
        <Verb onClick={() => onOpenTool('scene')} primary>
          OPEN THE SCENE
        </Verb>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EncounterArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'encounter' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const adversaries = useApp((s) => s.dataset.adversaries);
  const patch = useGm((s) => s.patchSessionItem);
  const boardRoster = useGm((s) => s.roster);
  const boardAdjustments = useGm((s) => s.adjustments);
  const addToRoster = useGm((s) => s.addToRoster);
  const setRosterCount = useGm((s) => s.setRosterCount);
  const clearRoster = useGm((s) => s.clearRoster);
  const toggleAdjustment = useGm((s) => s.toggleAdjustment);

  const byId = new Map(adversaries.map((a) => [a.id, a]));
  const chosen = ADJUSTMENT_KEYS.filter((key) => item.adjustments[key]);

  /*
   * Built out of the four actions that already exist, in the order they have
   * to run: `setRosterCount` only ever *updates* an entry, so a ref that is
   * not on the board yet has to be added before its count means anything.
   * Every call is a separate commit and the store's 400 ms debounce collapses
   * the lot into one write.
   */
  const putOnBoard = (): void => {
    clearRoster();
    for (const entry of item.roster) {
      addToRoster(entry.ref);
      setRosterCount(entry.ref, entry.count);
    }
    for (const key of ADJUSTMENT_KEYS) {
      if (item.adjustments[key] !== boardAdjustments[key]) toggleAdjustment(key);
    }
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <span className="t-meta">ROSTER</span>
      {item.roster.length === 0 ? (
        <Fact>Nothing planned yet.</Fact>
      ) : (
        <ul className="stack" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
          {item.roster.map((entry) => {
            const adversary = byId.get(entry.ref);
            return (
              <li key={entry.ref} className="spread" style={{ gap: 10 }}>
                <span
                  className="t-dense"
                  style={{ color: adversary === undefined ? 'var(--dim)' : 'var(--text-2)' }}
                >
                  {adversary?.name ?? entry.ref}
                </span>
                <span className="t-meta" style={{ flex: 'none' }}>
                  {adversary === undefined ? NOT_HERE : `×${String(entry.count)}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {chosen.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {chosen.map((key) => (
            <span key={key} className="chip">
              {ADJUSTMENT_LABEL[key]}
            </span>
          ))}
        </div>
      )}

      {/*
        A fact, with no control beside it, because there is no action in the
        store that puts a combatant list back. Saying "3 adversaries mid-fight"
        beside a button that dropped them silently is the failure this app is
        written not to have.
      */}
      {item.combatants.length > 0 && (
        <Fact>
          This row was saved with {item.combatants.length} adversar
          {item.combatants.length === 1 ? 'y' : 'ies'} already in the fight, with their marks. This
          build can put the plan back on the board but not the fight, so those are kept on the row
          and nothing here touches them.
        </Fact>
      )}

      <Fact>
        The encounter builder works on the campaign’s one board, not on this row.
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb onClick={putOnBoard} disabled={item.roster.length === 0}>
          PUT THIS ROSTER ON THE BOARD
        </Verb>
        <Verb
          onClick={() => patch(item.id, { roster: boardRoster, adjustments: boardAdjustments })}
          disabled={boardRoster.length === 0}
        >
          KEEP THE BOARD’S ROSTER HERE
        </Verb>
        <Verb onClick={() => onOpenTool('encounter')} primary>
          OPEN THE BUILDER
        </Verb>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LinkArm({
  item,
  phone,
}: {
  item: Extract<SessionItem, { kind: 'link' }>;
  phone: boolean;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const live = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);
  const target = item.target;

  if (target.kind === 'unknown') {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <Fact>
          This row points at {target.named.trim() === '' ? 'something' : `a “${target.named}”`}, which
          is not a kind of thing this version of the app knows how to show. It has been kept exactly
          as it was saved; a later version may recognise it.
        </Fact>
        <RawRef refId={target.ref} />
      </div>
    );
  }

  if (target.kind === 'rule') {
    const section = dataset.rules.find((r) => r.id === target.ref);
    if (section === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
    return (
      <div className="stack" style={{ gap: 8 }}>
        <span style={{ font: '700 16px/1.2 var(--sans)' }}>{section.title}</span>
        {ruleBlocks(section.body).map((block, i) => (
          <div key={`${block.heading ?? ''}-${i}`} className="stack" style={{ gap: 5 }}>
            {block.heading !== null && <span className="t-label">{block.heading}</span>}
            {paragraphs(block.text).map((p, j) => (
              <p key={j} className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (target.kind === 'adversary') {
    // Out of the adversary list rather than out of `byRef`, which holds every
    // kind of record under one key space: reading an adversary out of it is an
    // unchecked assertion, and `Scene.tsx` says so in the same words.
    const adversary = dataset.adversaries.find((a) => a.id === target.ref);
    if (adversary === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
    return <AdversaryBlock adversary={adversary} />;
  }

  if (target.kind === 'environment') {
    const environment = dataset.environments.find((e) => e.id === target.ref);
    if (environment === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
    const active = live === environment.id;
    return (
      <EnvironmentBlock
        environment={environment}
        active={active}
        onToggle={() => setEnvironment(active ? null : environment.id)}
      />
    );
  }

  const card = index.cards.get(target.ref);
  if (card === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
  return (
    <div style={{ maxWidth: phone ? undefined : 420 }}>
      <DomainCardView card={card} shapes={shapes} variant="reading" height={200} />
    </div>
  );
}

/** A ref this build cannot follow, printed rather than hidden. */
function Unresolved({
  kind,
  refId,
}: {
  kind: Exclude<LinkTarget['kind'], 'unknown'>;
  refId: Ref;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Fact>
        This {LINK_KIND_LABEL[kind].toLowerCase()} is not in the dataset this device has loaded, so
        there is nothing to show. The link is kept: load the layer it came from and it resolves
        again.
      </Fact>
      <RawRef refId={refId} />
    </div>
  );
}

const RawRef = ({ refId }: { refId: Ref }): React.JSX.Element => (
  <code
    className="t-meta"
    style={{
      display: 'block',
      padding: '6px 8px',
      borderRadius: 'var(--r2)',
      background: 'var(--app)',
      color: 'var(--dim)',
      overflowX: 'auto',
      overflowWrap: 'anywhere',
    }}
  >
    {refId === '' ? '(no ref)' : refId}
  </code>
);

// ---------------------------------------------------------------------------

function CountdownArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'countdown' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const advance = useGm((s) => s.advanceCountdown);
  const reset = useGm((s) => s.resetCountdown);
  const setPrimary = useGm((s) => s.setPrimaryCountdown);
  const c = item.countdown;
  const spent = c.value === 0;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="chip" style={{ color: COUNTDOWN_KIND_COLOR[c.kind] }}>
          {c.kind.toUpperCase()}
        </span>
        <span className="t-meta">STARTED AT {c.start}</span>
        {spent && (
          <span className="t-meta" style={{ color: 'var(--damage)', fontWeight: 600 }}>
            SPENT — IT HAPPENS NOW
          </span>
        )}
      </div>

      {/*
        The same polarity as the countdowns board, and the same two names for
        it: `−` advances the countdown toward zero. A row that ran the other
        way from the board it mirrors would be the app disagreeing with itself
        about which direction time goes.
      */}
      <div className="row" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={() => advance(c.id, -1)}
          aria-label={`Advance ${c.name} by one`}
          className="btn"
          style={{ flex: 'none', width: 52, minHeight: 44, font: '700 21px/1 var(--sans)' }}
        >
          −
        </button>
        <span
          style={{
            flex: 'none',
            minWidth: 62,
            textAlign: 'center',
            font: '800 30px/1 var(--sans)',
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
          style={{ flex: 'none', width: 52, minHeight: 44, font: '700 21px/1 var(--sans)' }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => reset(c.id)}
          className="t-meta"
          style={{ flex: 'none', minHeight: 44, padding: '0 10px', letterSpacing: '0.1em' }}
        >
          RESET
        </button>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-pressed={item.primary}
          onClick={() => setPrimary(item.primary ? null : item.id)}
          className="btn"
          style={{
            flex: 'none',
            minHeight: 'var(--tap)',
            background: item.primary ? 'var(--hope)' : 'var(--raised)',
            color: item.primary ? 'var(--app)' : 'var(--text)',
            borderColor: item.primary ? 'transparent' : 'var(--line)',
          }}
        >
          {item.primary ? 'PINNED TO THE TOP BAR' : 'PIN IT TO THE TOP BAR'}
        </button>
        <Verb onClick={() => onOpenTool('countdowns')}>OPEN FEAR AND COUNTDOWNS</Verb>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function UnreadableArm({
  item,
}: {
  item: Extract<SessionItem, { kind: 'unreadable' }>;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Fact>
        This row was saved by a version of the app that knew something this one does not:{' '}
        {item.why === '' ? 'it does not say what kind of item it is' : item.why}. It has not been
        changed and it has not been deleted — it is shown here exactly as it was stored, so nothing
        is lost by opening this campaign in this build.
      </Fact>
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        WHAT IS ON THE DISK, FOR {sessionName(item).toUpperCase()}
      </span>
      {/*
        `raw` is `JSON.stringify(v)`: one unbroken line, and the only text on
        this screen that nothing in this app chose the width of. Wrapped and
        given its own scroller so it cannot make the page itself scroll
        sideways on a 393px phone.
      */}
      <pre
        className="t-meta"
        style={{
          margin: 0,
          padding: '8px 10px',
          borderRadius: 'var(--r2)',
          background: 'var(--app)',
          color: 'var(--muted)',
          maxHeight: 200,
          overflowX: 'auto',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {item.raw}
      </pre>
    </div>
  );
}
