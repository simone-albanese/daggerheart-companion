/**
 * The bestiary: 129 adversaries and 19 environments.
 *
 * This is the screen a GM reads *during* a scene, so the list scrolls inside
 * its own region and the stat block never moves out from under a finger. On a
 * phone the block takes the whole region rather than sharing it - half a stat
 * block at 9px is not a compromise, it is unreadable.
 *
 * The active environment rides along above the adversary you are reading,
 * because "does the terrain do anything here?" is asked at exactly that moment.
 */
import { useMemo, useState } from 'react';
import type { Environment, Ref, Tier } from '../../../shared/types.ts';
import { useApp } from '../../store/state.ts';
import { AdversaryRow, FilterBar, NO_FILTER, useFiltered, type Filter } from './AdversaryList.tsx';
import { AdversaryBlock, EnvironmentBand, EnvironmentBlock } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';

type Tab = 'adversaries' | 'environments';

export function Bestiary({ phone }: { phone: boolean }): React.JSX.Element {
  const adversaries = useApp((s) => s.dataset.adversaries);
  const environments = useApp((s) => s.dataset.environments);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const environmentRef = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);
  const spawn = useGm((s) => s.spawn);
  const setRegion = useGm((s) => s.setRegion);

  const [tab, setTab] = useState<Tab>('adversaries');
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [envQuery, setEnvQuery] = useState('');
  const [envTier, setEnvTier] = useState<Tier | 'all'>('all');
  const [pickedAdversary, setPickedAdversary] = useState<Ref | null>(null);
  const [pickedEnvironment, setPickedEnvironment] = useState<Ref | null>(null);

  const shownAdversaries = useFiltered(adversaries, filter);
  const shownEnvironments = useMemo(() => {
    const needle = envQuery.trim().toLowerCase();
    return environments.filter(
      (e) =>
        (envTier === 'all' || e.tier === envTier) &&
        (needle === '' ||
          e.name.toLowerCase().includes(needle) ||
          e.description.toLowerCase().includes(needle) ||
          e.impulses.toLowerCase().includes(needle) ||
          e.features.some((f) => f.name.toLowerCase().includes(needle))),
    );
  }, [environments, envQuery, envTier]);

  const adversary = adversaries.find((a) => a.id === pickedAdversary);
  const environment = environments.find((e) => e.id === pickedEnvironment);
  const active = environments.find((e) => e.id === environmentRef);
  const selection = tab === 'adversaries' ? adversary : environment;

  const list = (
    <div className="stack" style={{ gap: 10, minHeight: 0 }}>
      <div className="row" style={{ gap: 4, flex: 'none' }}>
        {(
          [
            ['adversaries', `ADVERSARIES ${adversaries.length}`],
            ['environments', `ENVIRONMENTS ${environments.length}`],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={on}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                minHeight: 'var(--control)',
                background: on ? 'var(--raised)' : 'transparent',
                border: `1px solid ${on ? 'var(--line)' : 'var(--line-soft)'}`,
                color: on ? 'var(--text)' : 'var(--dim)',
                fontWeight: on ? 700 : 600,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'adversaries' ? (
        <FilterBar
          value={filter}
          onChange={setFilter}
          shown={shownAdversaries.length}
          total={adversaries.length}
        />
      ) : (
        <div className="stack" style={{ gap: 8, flex: 'none' }}>
          <input
            type="search"
            value={envQuery}
            aria-label="Filter environments by text"
            placeholder="Search environments"
            onChange={(e) => setEnvQuery(e.target.value)}
            style={{ minHeight: 44, padding: '8px 11px', font: '600 14px/1 var(--sans)' }}
          />
          <div className="row" style={{ gap: 4 }}>
            {(['all', 1, 2, 3, 4] as Array<Tier | 'all'>).map((t) => {
              const on = envTier === t;
              return (
                <button
                  key={String(t)}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => setEnvTier(t)}
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
          <div className="t-meta" style={{ color: 'var(--dim)' }}>
            {shownEnvironments.length} OF {environments.length} SHOWN
          </div>
        </div>
      )}

      <ul
        className="scroll stack"
        style={{ gap: 6, flex: 1, minHeight: 0, margin: 0, padding: 0, listStyle: 'none' }}
      >
        {tab === 'adversaries'
          ? shownAdversaries.map((a) => (
              <AdversaryRow
                key={a.id}
                adversary={a}
                selected={a.id === pickedAdversary}
                onSelect={() => setPickedAdversary(a.id)}
              />
            ))
          : shownEnvironments.map((e) => (
              <EnvironmentRow
                key={e.id}
                environment={e}
                selected={e.id === pickedEnvironment}
                isActive={e.id === environmentRef}
                onSelect={() => setPickedEnvironment(e.id)}
              />
            ))}
        {(tab === 'adversaries' ? shownAdversaries : shownEnvironments).length === 0 && (
          <li className="t-dense" style={{ color: 'var(--dim)', padding: '10px 2px' }}>
            Nothing matches that filter.
          </li>
        )}
      </ul>
    </div>
  );

  const detail =
    selection === undefined ? (
      <div className="stack" style={{ gap: 12 }}>
        {active !== undefined && <EnvironmentBand environment={active} />}
        <div className="panel stack" style={{ padding: 16, gap: 9 }}>
          <span className="t-card" style={{ color: 'var(--muted)' }}>
            Pick something to read
          </span>
          <p className="t-body" style={{ margin: 0, maxWidth: 440 }}>
            The full stat block opens here: the attack line, the thresholds and the feature names
            first, at a size you can read without leaning in. Set an environment active and it rides
            along above whatever you are reading.
          </p>
        </div>
      </div>
    ) : (
      <div className="stack" style={{ gap: 12 }}>
        {tab === 'adversaries' && adversary !== undefined && (
          <>
            {active !== undefined && <EnvironmentBand environment={active} />}
            <AdversaryBlock
              adversary={adversary}
              action={
                <span className="stack" style={{ flex: 'none', alignItems: 'flex-end', gap: 5 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      spawn(adversary, partySize);
                      setRegion('scene');
                    }}
                  >
                    ADD TO THE SCENE
                  </button>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    {adversary.role === 'Minion'
                      ? `ONE GROUP OF ${partySize}`
                      : 'ONE ADVERSARY, FULL HP'}
                  </span>
                </span>
              }
            />
          </>
        )}
        {tab === 'environments' && environment !== undefined && (
          <EnvironmentBlock
            environment={environment}
            active={environment.id === environmentRef}
            onToggle={() =>
              setEnvironment(environment.id === environmentRef ? null : environment.id)
            }
          />
        )}
      </div>
    );

  if (phone) {
    const open = tab === 'adversaries' ? pickedAdversary !== null : pickedEnvironment !== null;
    if (open && selection !== undefined) {
      return (
        <div className="stack" style={{ flex: 1, minHeight: 0, padding: '10px 12px 0' }}>
          <button
            type="button"
            className="row"
            onClick={() =>
              tab === 'adversaries' ? setPickedAdversary(null) : setPickedEnvironment(null)
            }
            style={{ gap: 8, minHeight: 44, flex: 'none' }}
          >
            <span className="t-meta" style={{ letterSpacing: '0.12em' }}>
              ← BACK TO THE LIST
            </span>
          </button>
          <div className="scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 16 }}>
            {detail}
          </div>
        </div>
      );
    }
    return (
      <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: '10px 12px 0' }}>
        {list}
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 360px) 1fr',
        gap: 18,
        padding: '14px 20px 0',
      }}
    >
      {list}
      {/* Capped measure: feature text is prose, and prose at 1100px is not read. */}
      <div className="scroll" style={{ minHeight: 0, paddingRight: 6, paddingBottom: 18 }}>
        <div style={{ maxWidth: 780 }}>{detail}</div>
      </div>
    </div>
  );
}

function EnvironmentRow({
  environment,
  selected,
  isActive,
  onSelect,
}: {
  environment: Environment;
  selected: boolean;
  isActive: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="stack"
        style={{
          width: '100%',
          minHeight: 52,
          justifyContent: 'center',
          gap: 4,
          padding: '6px 10px',
          textAlign: 'left',
          borderRadius: 'var(--r3)',
          background: selected ? 'var(--raised)' : 'var(--panel)',
          border: `1px solid ${selected ? 'var(--line)' : 'var(--line-soft)'}`,
          borderLeft: `3px solid ${isActive ? 'var(--sage)' : selected ? 'var(--hope)' : 'transparent'}`,
        }}
      >
        <span className="row" style={{ gap: 7 }}>
          <span
            style={{
              font: '700 14px/1.15 var(--sans)',
              color: selected ? 'var(--text)' : 'var(--text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {environment.name}
          </span>
          {isActive && (
            <span className="chip" style={{ color: 'var(--sage)', flex: 'none' }}>
              ACTIVE
            </span>
          )}
        </span>
        <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
          T{environment.tier} · {environment.type.toUpperCase()}
          {/* Event environments have no Difficulty of their own. */}
          {environment.difficulty > 0 && ` · DIF ${environment.difficulty}`}
        </span>
      </button>
    </li>
  );
}
