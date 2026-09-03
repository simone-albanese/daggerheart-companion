/**
 * The encounter builder.
 *
 * All of the arithmetic is `computeBudget`; this screen only shows it. The one
 * thing worth designing is the difference between the two kinds of adjustment:
 * three you choose, three the roster decides for you. Making a derived
 * adjustment look tappable would be a lie, so the automatic ones are stated,
 * not offered.
 */
import { useState } from 'react';
import type { Adversary, Environment, Ref, Tier } from '../../../shared/types.ts';
import {
  computeBudget,
  ROLE_COST,
  type EncounterAdjustments,
  type EncounterEntry,
} from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { damageBumpRule } from '../shared/ruleText.ts';
import { AdversaryRow, FilterBar, NO_FILTER, useFiltered, type Filter } from './AdversaryList.tsx';
import { openEnvironment, useGm } from './gmStore.ts';
import { partySizeNote } from './partySize.ts';

/**
 * The three adjustments a GM chooses, in the order `computeBudget` emits its
 * non-automatic lines. The engine owns the labels and the points; this owns
 * only which switch each line flips.
 */
const CHOSEN_KEYS: Array<keyof EncounterAdjustments> = ['easier', 'damageBump', 'harder'];

export function Encounter({ phone }: { phone: boolean }): React.JSX.Element {
  const adversaries = useApp((s) => s.dataset.adversaries);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const roster = useGm((s) => s.roster);
  const partyTier = useGm((s) => s.partyTier);
  const adjustments = useGm((s) => s.adjustments);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);

  const byId = new Map(adversaries.map((a) => [a.id, a]));
  const entries: EncounterEntry[] = [];
  // A saved roster outlives the dataset it was picked from. Dropping the refs
  // the current dataset cannot resolve would quietly lower the spend, so they
  // are kept and shown as unresolved instead.
  const missing: string[] = [];
  for (const r of roster) {
    const adversary = byId.get(r.ref);
    if (adversary === undefined) missing.push(r.ref);
    else entries.push({ adversary, count: r.count });
  }

  const budget = computeBudget(partySize, partyTier, entries, adjustments);
  const shown = useFiltered(adversaries, filter);

  // On a phone the whole region is one scroll; on a desktop the two columns
  // scroll independently, so the budget never leaves the screen while you pick.
  const picker = (
    // On a phone this column is inside a scroller sized by the viewport, so a
    // shrinkable item collapses to nothing and spills over the region's own
    // padding. It only ever shrinks where its parent has a definite height.
    <div className="stack" style={{ gap: 10, minHeight: 'var(--control)', flex: phone ? 'none' : 1 }}>
      <FilterBar
        value={filter}
        onChange={setFilter}
        shown={shown.length}
        total={adversaries.length}
      />
      <ul
        className={phone ? 'stack' : 'scroll stack'}
        style={{ gap: 6, flex: phone ? 'none' : 1, minHeight: 0, margin: 0, padding: 0, listStyle: 'none' }}
      >
        {shown.map((a) => (
          <AdversaryRow
            key={a.id}
            adversary={a}
            onSelect={() => useGm.getState().addToRoster(a.id)}
            trailing={
              <AddButton
                adversary={a}
                inRoster={roster.find((r) => r.ref === a.id)?.count ?? 0}
                partySize={partySize}
              />
            }
          />
        ))}
      </ul>
    </div>
  );

  const build = (
    <div
      className={phone ? 'stack' : 'stack scroll'}
      style={{ gap: 14, flex: phone ? 'none' : undefined, minHeight: 0, paddingRight: phone ? 0 : 4 }}
    >
      <Party partySize={partySize} partyTier={partyTier} base={budget.base} />
      <Budget budget={budget} />
      <Adjustments lines={budget.adjustments} adjustments={adjustments} />
      <Roster entries={entries} costs={budget.costs} partySize={partySize} missing={missing} />
    </div>
  );

  if (phone) {
    return (
      <div className="stack scroll" style={{ flex: 1, minHeight: 0, gap: 14, padding: '12px 12px 16px' }}>
        {build}
        <div className="t-label" style={{ flex: 'none' }}>
          Add adversaries
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(340px, 1fr) minmax(300px, 400px)',
        gap: 18,
        padding: '14px 20px 18px',
      }}
    >
      {build}
      <div className="stack" style={{ minHeight: 0, gap: 10 }}>
        <div className="t-label">Add adversaries</div>
        {picker}
      </div>
    </div>
  );
}

/**
 * The 46px cell at the end of a picker row: what one tap costs, and what is
 * already in the roster.
 *
 * IT SAID `IN ×3` ABOUT TWELVE RATS. For a Minion `count` is *groups*, each the
 * size of the party - `EncounterEntry.count` says so and `ROLE_COST` prices it
 * that way, "per group of Minions equal to the party size" - so `×3` beside a
 * Minion read as three where twelve had been paid for. The `Roster` panel this
 * picker feeds has spelled it out - "3 GROUPS OF 4" - since the first commit,
 * and `ecf8017` brought the open session row into line with it. This cell
 * called itself the last surface still printing the group count where a body
 * count is read, AND IT WAS NOT: `SEND n TO THE SCENE` below and the scene
 * builder's `TAKE THE n` both outlived it, summing `count` raw, and both are
 * corrected in the commit that is correcting this sentence. What is true of
 * this cell is the narrower thing - it is the one that cannot say the words:
 * at `.t-meta` 9.5px in the shipped IBM Plex Mono 500, measured in Chrome with
 * a `Range`, "3 GROUPS OF 4" is 81.52px and this cell's content box is 44px -
 * 46px less its two 1px borders.
 *
 * So it says the same two numbers in the same order, compressed to fit: `3×4`
 * is three groups of four, which is the panel's sentence with the words taken
 * out rather than a second way of counting. Measured, same rig: `IN 3×4` is
 * 37.63px, exactly the width of the `IN ×12` this cell already draws, and seven
 * glyphs - `IN 12×8`, twelve groups at the largest party the stepper allows -
 * is 43.89px, inside 44. Eight spill, at 50.16px, and the string that needs
 * eight is a hundred groups: 100 battle points against a budget of 26, and
 * `IN ×1000` is the same 50.16px this cell could already be pushed to.
 *
 * The `aria-label` says it in full, because a 46px cell is the one place the
 * compression could be read as the whole fact. It named a cost and never said
 * that one tap adds a whole group; a listener got the least of anybody.
 */
function AddButton({
  adversary,
  inRoster,
  partySize,
}: {
  adversary: Adversary;
  inRoster: number;
  /** Read from `prefs.gmPartySize`: how many adversaries one Minion group is. */
  partySize: number;
}): React.JSX.Element {
  const cost = ROLE_COST[adversary.role];
  const minion = adversary.role === 'Minion';
  const points = `${String(cost)} battle point${cost === 1 ? '' : 's'}`;
  return (
    <button
      type="button"
      onClick={() => useGm.getState().addToRoster(adversary.id)}
      aria-label={
        minion
          ? `Add a group of ${String(partySize)} ${adversary.name} for ${points}`
          : `Add ${adversary.name} for ${points}`
      }
      className="stack"
      style={{
        flex: 'none',
        width: 46,
        minHeight: 46,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        borderRadius: 'var(--r2)',
        background: inRoster > 0 ? 'var(--raised)' : 'transparent',
        border: '1px solid var(--line-soft)',
      }}
    >
      <span style={{ font: '800 15px/1 var(--sans)', color: 'var(--text)' }}>+{cost}</span>
      <span
        className="t-meta"
        style={{
          fontSize: '0.625rem',
          color: inRoster > 0 ? 'var(--hope)' : 'var(--dim)',
          // One line or nothing. Wrapped, it would push the picker row taller
          // than the 46px cell for one adversary out of 129.
          whiteSpace: 'nowrap',
        }}
      >
        {inRoster === 0
          ? 'PTS'
          : minion
            ? `IN ${String(inRoster)}×${String(partySize)}`
            : `IN ×${String(inRoster)}`}
      </span>
    </button>
  );
}

function Party({
  partySize,
  partyTier,
  base,
}: {
  partySize: number;
  partyTier: Tier;
  base: number;
}): React.JSX.Element {
  const setPrefs = useApp((s) => s.setPrefs);
  const setPartyTier = useGm((s) => s.setPartyTier);
  // The board is read here and never written from here: the stepper below sets
  // the preference and nothing sets the preference from the board. See
  // `partySize.ts` for why that is a decision and not a missing wire.
  const onTheBoard = useGm((s) => s.party).length;
  const disagreement = partySizeNote(partySize, onTheBoard);
  return (
    <section className="panel stack" style={{ flex: 'none', padding: 12, gap: 11 }}>
      <div className="spread">
        <span className="t-label">Party</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          (3 × {partySize}) + 2 = {base} BASE
        </span>
      </div>
      {/*
        Between the base and the stepper that moves it, because that is the
        order the eye already runs in on this panel: the number, then what the
        number is, then the control. Read and never touched, so it costs the
        thumb nothing and the panel 21px - a 10px line box, since `.t-meta` is
        `10px/1` (`tokens.css:565-566`) and nothing below steps it, plus the
        `gap: 11` this `.panel stack` charges every item it holds. Arithmetic
        over those two declarations, not a measurement. And it is only ever
        there on a disagreement, so it is a line that means something every
        time it appears.
      */}
      {disagreement !== null && (
        <span className="t-meta" style={{ color: 'var(--dim)', letterSpacing: '0.08em' }}>
          {disagreement}
        </span>
      )}
      <div className="row" style={{ gap: 10 }}>
        <Stepper
          label="PCs"
          value={partySize}
          onChange={(n) => setPrefs({ gmPartySize: Math.max(1, Math.min(8, n)) })}
        />
        <div className="stack" style={{ gap: 6, flex: 'none' }}>
          <span className="t-meta">PARTY TIER</span>
          <div className="row" style={{ gap: 4 }}>
            {([1, 2, 3, 4] as Tier[]).map((t) => {
              const on = partyTier === t;
              return (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setPartyTier(t)}
                  style={{
                    width: 44,
                    minHeight: 'var(--control)',
                    background: on ? 'var(--text)' : 'var(--raised)',
                    color: on ? 'var(--app)' : 'var(--muted)',
                    fontWeight: on ? 700 : 600,
                  }}
                >
                  T{t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  suffix?: string;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 6, flex: 'none' }}>
      <span className="t-meta">{label.toUpperCase()}</span>
      <div className="row" style={{ gap: 0, borderRadius: 'var(--r2)', background: 'var(--raised)' }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          style={{
            width: 'var(--control)',
            height: 'var(--control)',
            opacity: value <= min ? 0.35 : 1,
            font: '700 17px/1 var(--sans)',
          }}
        >
          −
        </button>
        <span
          aria-live="polite"
          style={{
            minWidth: 'var(--control)',
            textAlign: 'center',
            font: '800 17px/1 var(--sans)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
          {suffix}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          style={{ width: 'var(--control)', height: 'var(--control)', font: '700 17px/1 var(--sans)' }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Budget({ budget }: { budget: ReturnType<typeof computeBudget> }): React.JSX.Element {
  const over = budget.remaining < 0;
  return (
    <section
      className="panel"
      style={{
        flex: 'none',
        padding: 12,
        borderLeft: `3px solid ${over ? 'var(--damage)' : 'var(--ok)'}`,
      }}
    >
      <div className="spread">
        <span className="t-label">Battle points</span>
        <span
          className="t-meta"
          style={{ color: over ? 'var(--damage)' : 'var(--ok)', fontWeight: 600 }}
        >
          {over ? `OVER BY ${Math.abs(budget.remaining)}` : 'WITHIN BUDGET'}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: 10,
          // Three numbers read as one fact; spread across a wide column they
          // stop being comparable.
          maxWidth: 540,
        }}
      >
        {[
          { label: 'BUDGET', value: budget.budget, color: undefined },
          { label: 'SPENT', value: budget.spent, color: undefined },
          {
            label: over ? 'OVER' : 'REMAINING',
            value: Math.abs(budget.remaining),
            color: over ? 'var(--damage)' : 'var(--ok)',
          },
        ].map((cell) => (
          <div
            key={cell.label}
            style={{
              padding: '9px 10px 10px',
              borderRadius: 'var(--r3)',
              background: 'var(--app)',
              border: `1px solid ${cell.color === undefined ? 'var(--line-soft)' : cell.color}`,
            }}
          >
            <div className="t-meta" style={{ letterSpacing: '0.1em', color: cell.color }}>
              {cell.label}
            </div>
            <div
              style={{
                marginTop: 6,
                font: '800 28px/1 var(--sans)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
                color: cell.color ?? 'var(--text)',
              }}
            >
              {over && cell.label === 'OVER' ? '−' : ''}
              {cell.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Adjustments({
  lines,
  adjustments,
}: {
  lines: ReturnType<typeof computeBudget>['adjustments'];
  adjustments: EncounterAdjustments;
}): React.JSX.Element {
  const toggle = useGm((s) => s.toggleAdjustment);
  const bump = damageBumpRule(useApp((s) => s.dataset.rules));
  let chosenIndex = -1;

  // The only handle the engine gives us is the order of its non-automatic
  // lines. If that ever stops matching CHOSEN_KEYS the honest failure is a
  // blank screen with the reason on it, not a toggle that quietly does nothing.
  const chosen = lines.filter((l) => !l.automatic).length;
  if (chosen !== CHOSEN_KEYS.length) {
    throw new Error(
      `computeBudget emitted ${chosen} chosen adjustments; this screen knows ${CHOSEN_KEYS.length}`,
    );
  }

  return (
    <section className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread">
        <span className="t-label">Adjustments</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          DERIVED ONES FOLLOW THE ROSTER
        </span>
      </div>
      {lines.map((line) => {
        if (!line.automatic) chosenIndex += 1;
        const key = line.automatic ? null : CHOSEN_KEYS[chosenIndex];
        const points = `${line.points > 0 ? '+' : '−'}${Math.abs(line.points)}`;
        const body = (
          <>
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 15,
                height: 15,
                borderRadius: line.automatic ? '50%' : 'var(--r1)',
                border: `1.5px solid ${line.active ? 'var(--hope)' : 'var(--empty)'}`,
                background: line.active ? 'var(--hope)' : 'transparent',
              }}
            />
            <span
              className="t-hint"
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                color: line.active ? 'var(--text-2)' : 'var(--muted)',
              }}
            >
              {line.label}
            </span>
            <span
              className="t-num"
              style={{ flex: 'none', color: line.active ? 'var(--text)' : 'var(--dim)' }}
            >
              {points}
            </span>
            <span
              className="chip"
              style={{
                flex: 'none',
                background: 'transparent',
                color: line.automatic ? 'var(--fear)' : 'var(--dim)',
                padding: '4px 0',
                minWidth: 52,
                textAlign: 'right',
              }}
            >
              {line.automatic ? 'DERIVED' : line.active ? 'ON' : 'OFF'}
            </span>
          </>
        );

        const style = {
          gap: 10,
          minHeight: 44,
          padding: '0 11px',
          borderRadius: 'var(--r3)',
          background: 'var(--panel)',
          border: `1px solid ${line.active ? 'var(--line)' : 'var(--line-soft)'}`,
        };

        return line.automatic || key === undefined ? (
          <div key={line.label} className="row" style={{ ...style, opacity: line.active ? 1 : 0.62 }}>
            {body}
          </div>
        ) : (
          <button
            key={line.label}
            type="button"
            className="row"
            aria-pressed={line.active}
            onClick={() => key !== null && toggle(key)}
            style={{ ...style, width: '100%' }}
          >
            {body}
          </button>
        );
      })}
      {/*
        The dice come out of the dataset, not out of this file. This line used
        to read "+1d4 (OR +2)", which is a rule transcribed by hand and had
        already lost the SRD's own "or a *static* +2" - and the session row that
        plans the same fight had a third transcription of it. `damageBumpRule`
        is the one read all of them share now, so a rules layer that changes the
        bump changes every screen that says it, and none of them can drift from
        another. A sentence, so `.t-hint` in sentence case rather than a caps
        meta line; the words are the book's.
      */}
      <span className="t-hint" style={{ color: 'var(--dim)' }}>
        {adjustments.damageBump
          ? bump === null
            ? 'The damage bump is on; no rules layer here says what it adds'
            : `This fight: ${bump}`
          : 'Round circles are derived from the roster and cannot be toggled'}
      </span>
    </section>
  );
}

/**
 * Where the fight this button opens will actually be.
 *
 * `send` below spawns into the OPEN scene row when there is one and mints a
 * row when there is not, so there are two places this roster can land and the
 * sentence names whichever one it is. Nothing on this screen ever said so, and
 * a GM sending eight adversaries had no way to know which terrain they were
 * sending them into short of opening another tool.
 *
 * ## The sentence is exact now, and it was only ever approximate before
 *
 * It used to read the board's `environmentRef` and say CARRIED OVER, and it
 * had only one destination to describe, because the fight itself was on the
 * board and the board had one place. That sentence was true by luck: the fight
 * did open in whatever terrain the board happened to be standing in, and that
 * was usually the last scene's, which is precisely why nothing on this screen
 * could promise it. A fight lives on the row it is fought in now, so an open
 * row draws ITS OWN environment (`openEnvironment`, which refuses to fall back
 * to the board for exactly this reason), and only the minting case still
 * carries the builder's place across - because that is what `openNewScene`
 * seeds the new row with.
 *
 * **THE OPEN QUESTION THIS DOCBLOCK NAMED IS HALF ANSWERED.** It asked whether
 * an encounter and a scene are the same record, "in which case the question
 * dissolves". They are not the same record and the `encounter` kind can no
 * longer be minted, but the half that mattered here has dissolved anyway: a
 * scene row holds a roster, a fight and a place, so the destination has an
 * environment of its own and this screen no longer has to borrow one to
 * describe it. What is still open is the narrower half - whether the BUILDER
 * ought to pick an environment of its own for the row it mints, rather than
 * taking the board's.
 *
 * Four states and all four are honest. A resolved environment is named, and
 * the clause after it says whose place it is. No environment is said as an
 * absence rather than left blank, because a blank beside a SEND reads as
 * "nothing to say" and this has something to say. A ref this dataset cannot
 * resolve prints the ref and `NOT IN THIS DATASET`, the same words the
 * unresolved roster row above uses and for the same reason: the record still
 * carries it, the fight still opens with it, and inventing a name for a record
 * this build cannot read would be the one dishonest option. That last state
 * does not split by destination, because the defect it reports is the same one
 * either way.
 *
 * One of the two strings added here is shorter than the one it stands in for
 * and one is longer, and the sentence that said "neither is longer" had the
 * second comparison backwards. Counted with `len()`, not read off: `THE OPEN
 * SCENE'S OWN PLACE` is 26 against `CARRIED OVER, NOT PICKED HERE`'s 29, so
 * the whose-clause got shorter; but `THE OPEN SCENE HAS NO ENVIRONMENT` is 33
 * against `NO ENVIRONMENT ON THE BOARD`'s 27, which takes the whole
 * no-environment line from 58 characters to 64.
 *
 * So the wrap tolerance for that one branch has not been measured, and the old
 * conclusion that it "cannot have got worse" is withdrawn rather than patched.
 * What bounds it is that 64 is not the longest line this function puts on the
 * glass: the longest environment name in the shipped dataset is `Burning Heart
 * of the Woods` at 26, which makes `OPENS IN BURNING HEART OF THE WOODS ·
 * CARRIED OVER, NOT PICKED HERE` 67 characters, and this commit does not
 * touch that branch. So the new line sits three inside an envelope the span
 * already carried. Both figures are `len()` over the literals and over
 * `max(e['name'] for e in data/srd-1.0.json environments)`; neither is a
 * rendered width, and the day this span's wrap actually matters it wants a
 * measurement in Chrome rather than a longer arithmetic.
 */
function opensIn(environment: Environment | undefined, ref: Ref | null, minting: boolean): string {
  const whose = minting ? 'CARRIED OVER, NOT PICKED HERE' : "THE OPEN SCENE'S OWN PLACE";
  if (environment !== undefined) return `OPENS IN ${environment.name.toUpperCase()} · ${whose}`;
  if (ref === null)
    return minting
      ? 'NO ENVIRONMENT ON THE BOARD · THIS FIGHT OPENS WITHOUT ONE'
      : 'THE OPEN SCENE HAS NO ENVIRONMENT · THIS FIGHT OPENS WITHOUT ONE';
  return `OPENS IN ${ref} · NOT IN THIS DATASET`;
}

function Roster({
  entries,
  costs,
  partySize,
  missing,
}: {
  entries: EncounterEntry[];
  costs: number[];
  partySize: number;
  missing: string[];
}): React.JSX.Element {
  const setRosterCount = useGm((s) => s.setRosterCount);
  const clearRoster = useGm((s) => s.clearRoster);
  const spawn = useGm((s) => s.spawn);
  const setRegion = useGm((s) => s.setRegion);
  const environments = useApp((s) => s.dataset.environments);
  const environmentRef = useGm((s) => s.environmentRef);
  const openScene = useGm((s) => s.openScene);
  const openNewScene = useGm((s) => s.openNewScene);
  /*
   * Value-typed, so this subscription is cheap: `openEnvironment` returns a
   * `Ref | null` and zustand compares the result by identity, so an HP mark on
   * the open row rewrites `session` and this selector still returns the same
   * string. The builder does not repaint while the GM plays.
   */
  const openRef = useGm(openEnvironment);

  /*
   * One row, named once, so the label and the tap cannot disagree.
   *
   * `openNewScene` is called inside `send` rather than beside it: reading it
   * here would mint a scene row on every render of this panel. The mint and
   * the spawns land in that order and every spawn names the same id, so a
   * roster of eight arrives in one row rather than eight.
   *
   * `setRegion('scene')` last, and it is not `onOpenTool`: this screen IS a
   * region of the sheet, so the move is a region change. `showScene` is not
   * called at all - `openNewScene` already points the runner at what it minted,
   * and when a row was already open this button was never asked to change
   * which one it is.
   */
  const send = (): void => {
    const sceneId = openScene ?? openNewScene();
    for (const e of entries) spawn(sceneId, e.adversary, partySize, e.count);
    setRegion('scene');
  };

  /*
   * The place the sentence below names: the OPEN ROW's when a row is open,
   * because that is the row the adversaries are about to stand in, and the
   * BOARD's when none is, because that is what `openNewScene` seeds the row it
   * mints with. Two sources, one for each destination `send` has.
   */
  const ref = openScene === null ? environmentRef : openRef;
  const opens = opensIn(
    environments.find((e) => e.id === ref),
    ref,
    openScene === null,
  );

  return (
    <section className="stack" style={{ flex: 'none', gap: 8 }}>
      <div className="spread">
        <span className="t-label">Roster</span>
        {(entries.length > 0 || missing.length > 0) && (
          <button
            type="button"
            className="t-meta"
            onClick={clearRoster}
            style={{ letterSpacing: '0.1em', minHeight: 44, padding: '0 var(--s3)', marginRight: -8 }}
          >
            CLEAR
          </button>
        )}
      </div>

      {missing.map((ref) => (
        <div
          key={ref}
          className="row"
          style={{
            gap: 8,
            padding: '7px 8px 7px 11px',
            borderRadius: 'var(--r3)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            borderLeft: '3px solid var(--damage)',
          }}
        >
          <span className="stack" style={{ flex: 1, minWidth: 'var(--control)', gap: 4 }}>
            <span style={{ font: '700 14px/1.15 var(--sans)', color: 'var(--muted)' }}>{ref}</span>
            <span className="t-meta" style={{ color: 'var(--damage)', letterSpacing: '0.08em' }}>
              NOT IN THIS DATASET · COSTS NOTHING AND CANNOT BE SENT
            </span>
          </span>
          <button
            type="button"
            aria-label={`Drop ${ref} from the roster`}
            onClick={() => setRosterCount(ref, 0)}
            style={{ flex: 'none', width: 44, minHeight: 44, color: 'var(--dim)' }}
          >
            ✕
          </button>
        </div>
      ))}

      {entries.length === 0 && missing.length === 0 && (
        <div className="panel t-hint" style={{ padding: 14, color: 'var(--dim)' }}>
          Nothing picked yet. Every adversary you add spends its role cost — a group of Minions the
          size of the party costs 1, a Solo costs 5.
        </div>
      )}

      {entries.map((e, i) => {
        const minion = e.adversary.role === 'Minion';
        return (
          <div
            key={e.adversary.id}
            className="row"
            style={{
              gap: 8,
              padding: '7px 8px 7px 11px',
              borderRadius: 'var(--r3)',
              background: 'var(--panel)',
              border: '1px solid var(--line-soft)',
            }}
          >
            <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <span
                style={{
                  font: '700 14px/1.15 var(--sans)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.adversary.name}
              </span>
              <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
                T{e.adversary.tier} · {e.adversary.role.toUpperCase()} ·{' '}
                {minion ? `${e.count} GROUP${e.count === 1 ? '' : 'S'} OF ${partySize}` : `×${e.count}`}
              </span>
            </span>
            <span className="t-num" style={{ flex: 'none', color: 'var(--text-2)' }}>
              {costs[i]} PT{costs[i] === 1 ? '' : 'S'}
            </span>
            <span className="row" style={{ gap: 0, flex: 'none' }}>
              <button
                type="button"
                aria-label={`One fewer ${e.adversary.name}`}
                onClick={() => setRosterCount(e.adversary.id, e.count - 1)}
                style={{ width: 40, height: 44, font: '700 17px/1 var(--sans)', color: 'var(--muted)' }}
              >
                −
              </button>
              <button
                type="button"
                aria-label={`One more ${e.adversary.name}`}
                onClick={() => setRosterCount(e.adversary.id, e.count + 1)}
                style={{ width: 40, height: 44, font: '700 17px/1 var(--sans)', color: 'var(--muted)' }}
              >
                +
              </button>
            </span>
          </div>
        );
      })}

      {entries.length > 0 && (
        <>
          {/*
            THIS NUMBER COUNTS CARDS, AND IT IS RIGHT. Left as the raw sum of
            `count` on purpose, and the note is here because the alternative
            was tried and reverted in the same afternoon.

            The handoff that opened this lane read "the button says 3 and
            twelve arrive", and set out to make it say 12. Twelve *rats*
            arrive; three *cards* do. `makeCombatant` gives a Minion
            `minionsRemaining: partySize` (`encounter.ts:193`) and `Scene.tsx`
            draws that as a MINIONS − 4 + stepper, so one card is one group.
            `send` above calls `spawn` once per `count`, which is once per
            card. A button reading SEND 12 would put three cards on the table
            and leave a GM hunting for nine that were never coming - the same
            defect in the louder direction, and visible in the second after
            the tap rather than two screens away.

            So the rule this file states for `AddButton` - a bare number is
            read as bodies - is the one thing here still unsatisfied, and it
            is unsatisfied cheaply: the panel directly above prints "3 GROUPS
            OF 4" for the entry, so the structure is on the glass a few pixels
            up, and the three cards that arrive each say MINIONS 4 out loud.

            WHETHER THE BUTTON SHOULD SPELL THE GROUPS ITSELF WAS THE OWNER'S
            QUESTION, AND IT IS ANSWERED: IT STAYS A BARE NUMBER. Not for want
            of room, and not because the neighbour is enough - because no noun
            is true of every roster. `SEND n` counts cards, and a card is a
            group only when the adversary is a Minion: the roster row above
            prints `N GROUPS OF 4` for a Minion and `×N` for everything else,
            which is the same fact from the other side. Two Minion groups and
            one Solo are three cards of which two are groups, so SEND 3 GROUPS
            would be false about the Solo - and a label that is false on a
            mixed roster is worse than a number that is bare on every one.
            SEND 3 CARDS names this app's furniture rather than the fiction,
            and the thing that arrives in the scene is an adversary.

            The `AddButton` rule is not being broken here, which is the part
            worth saying out loud: that rule is about a number that counts
            bodies, and this number does not count bodies. What it counts has
            no single word, so it is left to the panel above, which has the
            room to spell the structure out per entry and does.

            It is NOT the same number as the scene builder's CARRY THE n. That
            one predicts a row whose shut line reads `12 PLANNED`, so it counts
            rats; this one predicts cards. Two buttons, two actions, two units
            - which is why `plannedAdversaries` is not called here.
          */}
          <button type="button" className="btn btn-primary" onClick={send} style={{ marginTop: 2 }}>
            SEND {entries.reduce((n, e) => n + e.count, 0)}{' '}
            {openScene === null ? 'TO A NEW SCENE' : 'TO THE SCENE'}
          </button>
          {/*
            Under the button rather than beside it: at 393 this section is one
            column, and a name of any length beside a full-width primary control
            has nowhere to go. `lineHeight` because `.t-meta` ships at `10px/1`
            and this sentence wraps - the same correction the adjustments note
            above makes, for the same reason.
          */}
          <span
            className="t-meta"
            style={{ color: 'var(--dim)', letterSpacing: '0.08em', lineHeight: 1.5 }}
          >
            {opens}
          </span>
        </>
      )}
    </section>
  );
}
