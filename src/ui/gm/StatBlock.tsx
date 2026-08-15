/**
 * Stat blocks, sized for the distance they are actually read from.
 *
 * A GM reads this mid-scene, across a table, over the top of a screen. So the
 * order is not the order the book prints: the attack line, the thresholds and
 * the feature *names* come first and are large, and the prose sits under them
 * at reading size. Nothing here is interactive - the numbers are facts, and
 * what a feature does is applied by the GM, not by the app.
 */
import { useState } from 'react';
import type { Adversary, Environment, Feature } from '../../../shared/types.ts';

/** `phy`, `direct mag`, `phy/mag` - all of them, without a lookup table. */
export function damageLabel(type: string): string {
  return type.replace(/phy/g, 'physical').replace(/mag/g, 'magic').toUpperCase();
}

export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: '9px 10px 10px',
        borderRadius: 'var(--r3)',
        background: 'var(--app)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <div className="t-meta" style={{ letterSpacing: '0.1em' }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          font: '800 22px/1 var(--sans)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  Action: 'var(--damage)',
  Reaction: 'var(--stress)',
  Passive: 'var(--muted)',
};

export function FeatureList({ features }: { features: Feature[] }): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 12 }}>
      {features.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          style={{
            borderLeft: `3px solid ${KIND_COLOR[f.kind ?? 'Passive'] ?? 'var(--muted)'}`,
            paddingLeft: 11,
          }}
        >
          <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ font: '800 16px/1.15 var(--sans)', letterSpacing: '-0.01em' }}>
              {f.name}
            </span>
            {f.kind !== undefined && (
              <span className="chip" style={{ color: KIND_COLOR[f.kind] }}>
                {f.kind.toUpperCase()}
              </span>
            )}
          </div>
          <p className="t-body" style={{ margin: '5px 0 0', whiteSpace: 'pre-line' }}>
            {f.text}
          </p>
        </div>
      ))}
      {features.length === 0 && (
        <span className="t-dense" style={{ color: 'var(--dim)' }}>
          No features.
        </span>
      )}
    </div>
  );
}

export function AdversaryBlock({
  adversary,
  action,
}: {
  adversary: Adversary;
  /** Whatever the host screen wants to offer, beside the name. */
  action?: React.ReactNode;
}): React.JSX.Element {
  const a = adversary;
  return (
    <article className="stack" style={{ gap: 14 }}>
      <header>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
          <h2 className="t-card" style={{ margin: 0 }}>
            {a.name}
          </h2>
          {action}
        </div>
        <div className="row" style={{ gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
          <span className="chip">TIER {a.tier}</span>
          <span className="chip" style={{ color: 'var(--text-2)' }}>
            {a.role.toUpperCase()}
          </span>
          {a.sourcePage !== undefined && <span className="t-meta">P.{a.sourcePage}</span>}
        </div>
        <p className="t-body" style={{ margin: '9px 0 0' }}>
          {a.description}
        </p>
        {a.motives.length > 0 && (
          <div className="t-meta" style={{ marginTop: 7, lineHeight: 1.5 }}>
            MOTIVES &amp; TACTICS · {a.motives.join(', ').toUpperCase()}
          </div>
        )}
      </header>

      {/* The line the GM needs every single turn. */}
      <div
        className="row"
        style={{
          gap: 12,
          flexWrap: 'wrap',
          padding: '11px 13px',
          borderRadius: 'var(--r3)',
          background: 'var(--app)',
          borderLeft: '3px solid var(--damage)',
        }}
      >
        <span
          style={{
            font: '800 26px/1 var(--sans)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {signed(a.attackBonus)}
        </span>
        <span className="stack" style={{ gap: 4, minWidth: 0 }}>
          <span style={{ font: '700 15px/1.1 var(--sans)' }}>{a.attack.name}</span>
          <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
            {a.attack.range.toUpperCase()} · {damageLabel(a.attack.damageType)}
          </span>
        </span>
        <span
          className="t-num"
          style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--damage)' }}
        >
          {a.attack.damage}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 8,
        }}
      >
        <Stat label="DIFFICULTY" value={String(a.difficulty)} />
        <Stat
          label="MAJOR"
          value={a.thresholds ? String(a.thresholds[0]) : '—'}
          color={a.thresholds ? undefined : 'var(--dim)'}
        />
        <Stat
          label="SEVERE"
          value={a.thresholds ? String(a.thresholds[1]) : '—'}
          color={a.thresholds ? undefined : 'var(--dim)'}
        />
        <Stat label="HP" value={String(a.hp)} color="var(--damage)" />
        <Stat label="STRESS" value={String(a.stress)} color="var(--stress)" />
      </div>
      {a.thresholds === null && (
        <span className="t-meta" style={{ color: 'var(--dim)', marginTop: -8 }}>
          NO DAMAGE THRESHOLDS — ANY DAMAGE DEFEATS THIS ADVERSARY
        </span>
      )}

      {a.experiences.length > 0 && (
        <div>
          <div className="t-label" style={{ marginBottom: 6 }}>
            Experience
          </div>
          <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
            {a.experiences.map((x) => (
              <span key={x.name} className="chip" style={{ color: 'var(--text-2)', fontSize: 11 }}>
                {x.name} {signed(x.bonus)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="t-label" style={{ marginBottom: 9 }}>
          Features
        </div>
        <FeatureList features={a.features} />
      </div>
    </article>
  );
}

/**
 * The active environment, alongside the adversaries rather than instead of
 * them. Collapsed it is one line; open it is the whole feature list, because
 * "Barbed Vines" is a thing you read out loud, not a thing you remember.
 */
export function EnvironmentBand({
  environment,
}: {
  environment: Environment;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="panel stack"
      style={{ flex: 'none', borderLeft: '3px solid var(--sage)', overflow: 'hidden' }}
    >
      <button
        type="button"
        className="row"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ gap: 9, minHeight: 46, padding: '0 12px', textAlign: 'left', flexWrap: 'wrap' }}
      >
        <span className="t-label" style={{ color: 'var(--sage)', flex: 'none' }}>
          Environment
        </span>
        <span style={{ font: '700 14px/1.15 var(--sans)', flex: 1, minWidth: 0 }}>
          {environment.name}
        </span>
        <span className="t-meta" style={{ flex: 'none' }}>
          T{environment.tier} · {environment.type.toUpperCase()}
          {environment.difficulty > 0 && ` · DIF ${environment.difficulty}`}
        </span>
        <span className="chip" style={{ flex: 'none', color: 'var(--text-2)' }}>
          {open ? 'HIDE' : `${environment.features.length} FEATURES`}
        </span>
      </button>
      {open && (
        <div style={{ padding: '2px 12px 13px' }}>
          <FeatureList features={environment.features} />
        </div>
      )}
    </section>
  );
}

export function EnvironmentBlock({
  environment,
  active,
  onToggle,
}: {
  environment: Environment;
  active: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const e = environment;
  return (
    <article className="stack" style={{ gap: 14 }}>
      <header>
        <div className="spread" style={{ alignItems: 'flex-start', gap: 12 }}>
          <h2 className="t-card" style={{ margin: 0 }}>
            {e.name}
          </h2>
          <button
            type="button"
            className="btn"
            onClick={onToggle}
            aria-pressed={active}
            style={{
              flex: 'none',
              background: active ? 'var(--hope)' : 'var(--raised)',
              color: active ? 'var(--app)' : 'var(--text)',
              borderColor: active ? 'transparent' : 'var(--line)',
            }}
          >
            {active ? 'ACTIVE — CLEAR' : 'SET ACTIVE'}
          </button>
        </div>
        <div className="row" style={{ gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
          <span className="chip">TIER {e.tier}</span>
          <span className="chip" style={{ color: 'var(--text-2)' }}>
            {e.type.toUpperCase()}
          </span>
        </div>
        <p className="t-body" style={{ margin: '9px 0 0' }}>
          {e.description}
        </p>
        <div className="t-meta" style={{ marginTop: 7, lineHeight: 1.5 }}>
          IMPULSES · {e.impulses.toUpperCase()}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 8 }}>
        {/* Event environments print no Difficulty; say so rather than show a 0. */}
        <Stat
          label="DIFFICULTY"
          value={e.difficulty > 0 ? String(e.difficulty) : '—'}
          color={e.difficulty > 0 ? undefined : 'var(--dim)'}
        />
      </div>

      {e.potentialAdversaries.length > 0 && (
        <div>
          <div className="t-label" style={{ marginBottom: 6 }}>
            Potential adversaries
          </div>
          <ul className="t-body" style={{ margin: 0, paddingLeft: 18 }}>
            {e.potentialAdversaries.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="t-label" style={{ marginBottom: 9 }}>
          Features
        </div>
        <FeatureList features={e.features} />
      </div>
    </article>
  );
}
