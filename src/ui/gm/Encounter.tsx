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
import type { Adversary, Tier } from '../../../shared/types.ts';
import {
  computeBudget,
  ROLE_COST,
  type EncounterAdjustments,
  type EncounterEntry,
} from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { AdversaryRow, FilterBar, NO_FILTER, useFiltered, type Filter } from './AdversaryList.tsx';
import { useGm } from './gmStore.ts';

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
            trailing={<AddButton adversary={a} inRoster={roster.find((r) => r.ref === a.id)?.count ?? 0} />}
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

function AddButton({
  adversary,
  inRoster,
}: {
  adversary: Adversary;
  inRoster: number;
}): React.JSX.Element {
  const cost = ROLE_COST[adversary.role];
  return (
    <button
      type="button"
      onClick={() => useGm.getState().addToRoster(adversary.id)}
      aria-label={`Add ${adversary.name} for ${cost} battle point${cost === 1 ? '' : 's'}`}
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
        style={{ fontSize: 9.5, color: inRoster > 0 ? 'var(--hope)' : 'var(--dim)' }}
      >
        {inRoster > 0 ? `IN ×${inRoster}` : 'PTS'}
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
  return (
    <section className="panel stack" style={{ flex: 'none', padding: 12, gap: 11 }}>
      <div className="spread">
        <span className="t-label">Party</span>
        <span className="t-meta" style={{ color: 'var(--muted)' }}>
          (3 × {partySize}) + 2 = {base} BASE
        </span>
      </div>
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
              className="t-dense"
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
      <span className="t-meta" style={{ color: 'var(--dim)', lineHeight: 1.5 }}>
        {adjustments.damageBump
          ? 'ALL ADVERSARIES DEAL +1d4 (OR +2) DAMAGE THIS FIGHT'
          : 'ROUND CIRCLES ARE DERIVED FROM THE ROSTER AND CANNOT BE TOGGLED'}
      </span>
    </section>
  );
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

  const send = (): void => {
    for (const e of entries) spawn(e.adversary, partySize, e.count);
    setRegion('scene');
  };

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
        <div className="panel t-dense" style={{ padding: 14, color: 'var(--dim)' }}>
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
        <button type="button" className="btn btn-primary" onClick={send} style={{ marginTop: 2 }}>
          SEND {entries.reduce((n, e) => n + e.count, 0)} TO THE SCENE
        </button>
      )}
    </section>
  );
}
