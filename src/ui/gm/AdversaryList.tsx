/**
 * One filtered list of 129 adversaries, used twice: as the bestiary's index and
 * as the encounter builder's picker. The only difference between the two is
 * what sits on the right of a row, so that is the only thing the caller passes.
 *
 * Tier is chips because there are four of them and a GM switches tier
 * constantly; role is a select because eleven chips is a scroll, and a scroll
 * you have to aim at is worse than a menu you can hit.
 */
import { useMemo } from 'react';
import {
  ADVERSARY_ROLES,
  type Adversary,
  type AdversaryRole,
  type Tier,
} from '../../../shared/types.ts';

export interface Filter {
  text: string;
  tier: Tier | 'all';
  role: AdversaryRole | 'all';
}

export const NO_FILTER: Filter = { text: '', tier: 'all', role: 'all' };

const TIERS: Array<Tier | 'all'> = ['all', 1, 2, 3, 4];

export function useFiltered(list: Adversary[], filter: Filter): Adversary[] {
  return useMemo(() => {
    const needle = filter.text.trim().toLowerCase();
    return list.filter((a) => {
      if (filter.tier !== 'all' && a.tier !== filter.tier) return false;
      if (filter.role !== 'all' && a.role !== filter.role) return false;
      if (needle === '') return true;
      // Search the text a GM would remember: name, motives, feature names.
      return (
        a.name.toLowerCase().includes(needle) ||
        a.description.toLowerCase().includes(needle) ||
        a.motives.some((m) => m.toLowerCase().includes(needle)) ||
        a.features.some((f) => f.name.toLowerCase().includes(needle))
      );
    });
  }, [list, filter.text, filter.tier, filter.role]);
}

export function FilterBar({
  value,
  onChange,
  shown,
  total,
  placeholder,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  shown: number;
  total: number;
  placeholder?: string;
}): React.JSX.Element {
  // The count comes from the dataset that is actually loaded; a layer on top of
  // the SRD changes it, and a placeholder that says 129 anyway is a small lie.
  const hint = placeholder ?? `Search ${total} adversaries`;
  return (
    <div className="stack" style={{ gap: 8, flex: 'none' }}>
      <input
        type="search"
        value={value.text}
        aria-label="Filter adversaries by text"
        placeholder={hint}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1 var(--sans)' }}
      />
      <div className="row" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 4, flex: 'none' }}>
          {TIERS.map((t) => {
            const on = value.tier === t;
            return (
              <button
                key={String(t)}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => onChange({ ...value, tier: t })}
                style={{
                  minHeight: 'var(--control)',
                  minWidth: 'var(--control)',
                  background: on ? 'var(--text)' : 'var(--raised)',
                  color: on ? 'var(--app)' : 'var(--muted)',
                  fontWeight: on ? 700 : 600,
                }}
              >
                {t === 'all' ? 'ALL' : `T${t}`}
              </button>
            );
          })}
        </div>
        <select
          aria-label="Filter adversaries by role"
          value={value.role}
          onChange={(e) => onChange({ ...value, role: e.target.value as Filter['role'] })}
          style={{ flex: 1, minWidth: 0, minHeight: 'var(--control)', padding: '4px 8px', font: '600 12px/1 var(--sans)' }}
        >
          <option value="all">Every role</option>
          {ADVERSARY_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="t-meta" style={{ color: 'var(--dim)' }}>
        {shown} OF {total} SHOWN
      </div>
    </div>
  );
}

/**
 * A row is a label button plus an optional action beside it - never an action
 * nested inside the label, because a button inside a button is a coin toss for
 * both a screen reader and a thumb.
 */
export function AdversaryRow({
  adversary,
  selected = false,
  onSelect,
  trailing,
}: {
  adversary: Adversary;
  selected?: boolean;
  onSelect: () => void;
  trailing?: React.ReactNode;
}): React.JSX.Element {
  const a = adversary;
  return (
    <li
      className="row"
      style={{
        gap: 6,
        borderRadius: 'var(--r3)',
        background: selected ? 'var(--raised)' : 'var(--panel)',
        border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
        borderLeft: `3px solid ${selected ? 'var(--hope)' : 'transparent'}`,
        paddingRight: trailing === undefined ? 0 : 6,
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="stack"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          justifyContent: 'center',
          gap: 4,
          padding: '6px 10px',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            font: '700 14px/1.15 var(--sans)',
            color: selected ? 'var(--text)' : 'var(--text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {a.name}
        </span>
        <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
          T{a.tier} · {a.role.toUpperCase()} · DIF {a.difficulty} · HP {a.hp}
        </span>
      </button>
      {trailing}
    </li>
  );
}
