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
 * a row's stored `combatants` cannot be put back with their marks, because no
 * action in `gmStore` sets the combatant list wholesale, and inventing a button
 * that silently dropped them would be exactly the kind of quiet wrongness the
 * founding rule is about.
 *
 * ## OPEN THE FIGHT is a third direction, and it crosses nothing
 *
 * An encounter row could be planned and never fought. The only route from a
 * configured row to the table was PUT THIS ROSTER ON THE BOARD, then OPEN THE
 * BUILDER, then SEND n TO THE SCENE - three taps through a screen the GM had
 * already finished with, which is why the playtest GM's note about it reads
 * "otherwise you effectively cannot use it".
 *
 * OPEN THE FIGHT is that route in one tap, and it is deliberately *not* built
 * on top of PUT THIS ROSTER ON THE BOARD. It calls `spawn` for the row's own
 * entries and opens the scene; the board's roster and the board's adjustments
 * are left exactly as they were. Folding the board write into it would have
 * meant one button quietly overwriting a roster the GM was in the middle of
 * building, which is the same defect as a button that silently drops a saved
 * fight - and the row says out loud that it does not do it.
 *
 * ## A card is drawn here, not in the reader - and so is a stat block
 *
 * A link row to a domain card renders `DomainCardView` in the row. The obvious
 * alternative - a button calling `setOpenCard`, which is how every other screen
 * reads a card - would put `CardReader` on top of the `GmSheet` this row can be
 * inside, and `useDialog` registers one unconditional window keydown listener
 * per dialog with no topmost check: one Escape would close both, and every Tab
 * would be fought over by two traps. The card is content here rather than an
 * overlay, so the question does not arise.
 *
 * The same argument decides the encounter row's roster preview. Each resolved
 * entry is a disclosure that draws `AdversaryBlock` under itself, rather than a
 * button that opens the bestiary or a second dialog over this one. It is
 * `AdversaryBlock` with no `action`, which renders no button, no input and no
 * select at all: reading a sheet from the plan cannot change the plan, and that
 * is a property of the component rather than a promise this file makes.
 *
 * ## A rule is drawn by the reference screen's own renderer
 *
 * **This moved the prose from 14.5px to 13px and that was not announced.** The
 * old arm drew the body at `t-body` (`400 14.5px/1.5`); `BlockView` draws it at
 * `t-read` (`var(--read-size)`, 13px/1.45), and the contrast rises with it. It
 * is kept, for one reason: this is the same SRD text the reference region
 * draws, and two surfaces showing the same paragraph at two sizes is a worse
 * defect than either size. But the reflow spent a commit *raising* the smallest
 * type on the sheet, so this is a step the other way on one surface and it
 * belongs on the list of things to look at on glass rather than in a diff.
 *
 * A link row to a rules section goes through `ruleSection` and `BlockView`, the
 * pipeline `Reference.tsx` reads the GM chapter with. This arm used to walk the
 * body itself with `paragraphs()`, which is the one shape the dataset is not
 * in: 38 of the 75 sections the ADD sheet offers carry a bullet list or a pipe
 * table, so 38 of them printed a literal `- ` down the left of every list and
 * every table as raw pipes. The renderer is shared rather than copied, and the
 * `SRD 1.0 · P.n` stamp comes with it - the licence rule in `ReferenceTables`
 * is that the stamp sits on the text it belongs to, and the SRD's tables are
 * now drawn here too.
 *
 * ## Targets
 *
 * Every control in this file declares 44 or `var(--tap)` inline. The widest
 * thing any arm draws is full-width; the one piece of foreign text on the
 * screen - the unreadable row's raw JSON, one unbroken line as
 * `JSON.stringify` produced it - is wrapped and given its own horizontal
 * scroller, because a `<pre>` of it at 393px is the one element that could make
 * the whole page scroll sideways. The SRD tables that arrive with a rule link
 * are the other candidate and are not one: `RuleTableView` declares no width at
 * all, and its two shapes hold across every candidate width for this row - see
 * `RuleTableView`, which says why the 365 that used to stand here was wrong and
 * why this row is the one route to that view whose width nobody has measured in
 * a browser yet.
 */
import { useState } from 'react';
import type { EncounterAdjustments, Ref } from '../../../shared/types.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';
import type { GmRegion } from './gmStore.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { damageBumpRule, paragraphs, ruleBlocks } from '../shared/ruleText.ts';
import { ruleSection } from '../shared/srdReference.ts';
import { BlockView } from './ReferenceTables.tsx';
import { AdversaryBlock, EnvironmentBlock } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';
import { COUNTDOWN_KIND_COLOR, LINK_KIND_LABEL, sessionName } from './session.ts';

/**
 * The name of each switch a GM flips, shortened - and no dice.
 *
 * Two of these are the engine's own words for a choice. The third used to be
 * `+1D4 (OR +2) TO ALL ADVERSARY DAMAGE`, which is not the name of a switch: it
 * is a rule, transcribed by hand, in a file that is not allowed to hold one.
 * The chip names the switch now and the rule is quoted underneath from whatever
 * rules layer is loaded - see `damageBumpRule` - so the dice are said once, in
 * the book's words, and a layer that changes them changes what this row says.
 */
const ADJUSTMENT_LABEL: Record<keyof EncounterAdjustments, string> = {
  easier: 'EASIER OR SHORTER FIGHT',
  damageBump: 'ADVERSARY DAMAGE BUMP',
  harder: 'HARDER OR LONGER FIGHT',
};

const ADJUSTMENT_KEYS: Array<keyof EncounterAdjustments> = ['easier', 'damageBump', 'harder'];

const NOT_HERE = 'NOT IN THIS DATASET';

/**
 * One verb, at the size a thumb finds without looking, named after its row.
 *
 * `row` is not decoration. `SessionRow` already argues this for DELETE, MOVE UP
 * and the drag handle - "a list of identical DELETE buttons is a list a screen
 * reader cannot tell apart" - and the arms make the same list one level down: a
 * planned night with three scenes in it draws OPEN THE SCENE three times, and a
 * VoiceOver user pulling up the rotor's button list hears the same three words
 * with nothing to choose between them, on the one screen whose whole point is
 * an ordered list of similar rows.
 *
 * The label comes first and the row's name after it, so the accessible name
 * still begins with the visible words (WCAG 2.5.3) - and `label` is a string
 * rather than children precisely so the two cannot drift apart.
 */
function Verb({
  onClick,
  label,
  row,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  row: string;
  primary?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn'}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} — ${row}`}
      style={{ flex: 'none', minHeight: 'var(--tap)' }}
    >
      {label}
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
  const row = sessionName(item);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="stack" style={{ gap: 5 }}>
        <span className="t-meta">ENVIRONMENT</span>
        <select
          value={item.environmentRef ?? ''}
          onChange={(e) => patch(item.id, { environmentRef: e.target.value || null })}
          // The visible label is one word for every scene row on the screen,
          // and a `<select>` has no text of its own to tell them apart either.
          aria-label={`ENVIRONMENT — ${row}`}
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
          label="PUT THIS ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { environmentRef: live })}
          disabled={item.environmentRef === live}
          label="KEEP WHAT IS ON THE BOARD"
          row={row}
        />
        <Verb onClick={() => onOpenTool('scene')} primary label="OPEN THE SCENE" row={row} />
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
  const rules = useApp((s) => s.dataset.rules);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const patch = useGm((s) => s.patchSessionItem);
  const boardRoster = useGm((s) => s.roster);
  const boardAdjustments = useGm((s) => s.adjustments);
  const inTheScene = useGm((s) => s.combatants.length);
  const addToRoster = useGm((s) => s.addToRoster);
  const setRosterCount = useGm((s) => s.setRosterCount);
  const clearRoster = useGm((s) => s.clearRoster);
  const toggleAdjustment = useGm((s) => s.toggleAdjustment);
  const spawn = useGm((s) => s.spawn);

  /** The ref whose stat block is open under it, or none. */
  const [preview, setPreview] = useState<Ref | null>(null);

  const byId = new Map(adversaries.map((a) => [a.id, a]));
  const chosen = ADJUSTMENT_KEYS.filter((key) => item.adjustments[key]);
  const row = sessionName(item);
  const bump = damageBumpRule(rules);

  /*
   * What OPEN THE FIGHT can actually put in the scene. A ref this dataset
   * cannot resolve has no stat block, so `spawn` has nothing to make a
   * combatant out of and the row already says so on its own line. A roster of
   * nothing but unresolved refs therefore opens nothing, and the verb is
   * disabled rather than opening an empty scene and looking like it worked.
   */
  const spawnable = item.roster.filter((entry) => byId.has(entry.ref));

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

  /*
   * The row straight to the table, without going through the builder - and
   * without going through the board either. `spawn` is the same call the
   * builder's SEND makes, with the same two arguments, so a Minion entry
   * becomes `count` groups of `partySize` here exactly as it does there.
   * `putOnBoard` is deliberately not called: see the docblock.
   */
  const openFight = (): void => {
    for (const entry of spawnable) spawn(byId.get(entry.ref)!, partySize, entry.count);
    onOpenTool('scene');
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
            /*
             * A Minion's count is groups, each the size of the party -
             * `EncounterEntry.count` says so and `ROLE_COST` prices it that
             * way. `×3` beside a Minion therefore read as three rats where the
             * budget had been spent on twelve, and the builder had said
             * "3 GROUPS OF 4" about the same number all along. Same words here,
             * so the plan and the builder cannot disagree about what is coming.
             */
            const count =
              adversary === undefined
                ? NOT_HERE
                : adversary.role === 'Minion'
                  ? `${String(entry.count)} GROUP${entry.count === 1 ? '' : 'S'} OF ${String(partySize)}`
                  : `×${String(entry.count)}`;
            const open = preview === entry.ref;

            return (
              <li key={entry.ref} className="stack" style={{ gap: 6 }}>
                {adversary === undefined ? (
                  <span className="spread" style={{ gap: 10 }}>
                    <span className="t-dense" style={{ color: 'var(--dim)' }}>
                      {entry.ref}
                    </span>
                    <span className="t-meta" style={{ flex: 'none' }}>
                      {count}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="spread"
                    aria-expanded={open}
                    // The visible words first, then the row, for the same
                    // reason `Verb` does it: a night with three encounter rows
                    // in it draws this button many times over, and the rotor's
                    // button list is where they have to be told apart.
                    aria-label={`${adversary.name} — ${count} — ${row}`}
                    onClick={() => setPreview(open ? null : entry.ref)}
                    style={{ gap: 10, width: '100%', minHeight: 'var(--tap)', textAlign: 'left' }}
                  >
                    <span className="t-dense" style={{ color: 'var(--text-2)' }}>
                      {adversary.name}
                    </span>
                    <span className="t-meta" style={{ flex: 'none' }}>
                      {count}
                    </span>
                  </button>
                )}
                {open && adversary !== undefined && (
                  <div
                    className="panel"
                    style={{ padding: 12, borderLeft: '3px solid var(--line)' }}
                  >
                    <AdversaryBlock adversary={adversary} />
                  </div>
                )}
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
        The dice the chip above used to name, said where the roster is read
        rather than only inside the builder. Nothing in the scene applies the
        bump - a combatant carries HP, Stress and thresholds, never a damage
        expression - so the GM adds it by hand, and the row is where they find
        out that they have to.
      */}
      {item.adjustments.damageBump && (
        <Fact>
          {bump === null
            ? 'This row was built with the damage bump on, and no rules layer this device has loaded carries the line that says what it adds. Nothing in the scene rolls it for you either way.'
            : `This row was built with “${bump}”. Nothing in the scene rolls that for you — it is added at the table, on every adversary attack.`}
        </Fact>
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
          {item.combatants.length === 1 ? 'y' : 'ies'} already in the fight, with their marks. No
          control here brings those marks back — OPEN THE FIGHT starts the plan again from full HP
          — so they are kept on the row and nothing here touches them.
        </Fact>
      )}

      {spawnable.length > 0 && inTheScene > 0 && (
        <Fact>
          The scene already holds {inTheScene} adversar{inTheScene === 1 ? 'y' : 'ies'}. Opening
          the fight from here adds this roster to them rather than replacing them; END SCENE, in
          the scene, is what empties it.
        </Fact>
      )}

      <Fact>
        The encounter builder works on the campaign’s one board, not on this row. OPEN THE FIGHT
        goes straight to the scene with this row’s roster and leaves the board’s roster alone.
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb
          onClick={putOnBoard}
          disabled={item.roster.length === 0}
          label="PUT THIS ROSTER ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { roster: boardRoster, adjustments: boardAdjustments })}
          disabled={boardRoster.length === 0}
          label="KEEP THE BOARD’S ROSTER HERE"
          row={row}
        />
        <Verb onClick={() => onOpenTool('encounter')} label="OPEN THE BUILDER" row={row} />
        {/*
          Last and primary, the way OPEN THE SCENE is on a scene row: the verb
          that leaves the row sits at the end of the wrapped strip, and there is
          only one of them, because two primaries in one row is none. The
          builder loses its fill to it - a GM who has finished planning wants the
          fight, and the builder is now the second choice on a configured row.
        */}
        <Verb
          onClick={openFight}
          disabled={spawnable.length === 0}
          primary
          label="OPEN THE FIGHT"
          row={row}
        />
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
    const section = ruleSection(dataset.rules, target.ref);
    if (section === null) return <Unresolved kind={target.kind} refId={target.ref} />;
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread">
          <span style={{ flex: 1, minWidth: 0, font: '700 16px/1.2 var(--sans)' }}>
            {section.title}
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            SRD 1.0{section.page === null ? '' : ` · P.${String(section.page)}`}
          </span>
        </div>
        {section.blocks.map((block, i) => (
          <BlockView key={`${block.heading ?? ''}-${String(i)}`} block={block} />
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
  const row = sessionName(item);

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
          aria-label={`RESET — ${row}`}
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
          aria-label={`${item.primary ? 'PINNED TO THE TOP BAR' : 'PIN IT TO THE TOP BAR'} — ${row}`}
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
        <Verb
          onClick={() => onOpenTool('countdowns')}
          label="OPEN FEAR AND COUNTDOWNS"
          row={row}
        />
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
