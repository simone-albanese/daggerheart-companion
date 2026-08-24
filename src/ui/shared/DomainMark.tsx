/**
 * The nine domain marks.
 *
 * Each domain gets a colour *and* a silhouette. The shape alone identifies the
 * domain, so colour is reinforcement and never the carrier - which is what
 * makes the loadout readable to a colour-blind player and, just as usefully,
 * at a glance across a table in bad light.
 */
import type { CSSProperties } from 'react';
import type { DomainId } from '../../../shared/types.ts';

interface Mark {
  label: string;
  clip: string;
  radius: string;
}

export const DOMAIN_MARKS: Record<DomainId, Mark> = {
  arcana: { label: 'Arcana', clip: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', radius: '0' },
  blade: { label: 'Blade', clip: 'polygon(50% 0,100% 100%,0 100%)', radius: '0' },
  bone: { label: 'Bone', clip: 'none', radius: '2px' },
  codex: {
    label: 'Codex',
    clip: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
    radius: '0',
  },
  grace: { label: 'Grace', clip: 'none', radius: '50%' },
  midnight: { label: 'Midnight', clip: 'polygon(0 0,100% 0,50% 100%)', radius: '0' },
  sage: { label: 'Sage', clip: 'none', radius: '0 62% 0 62%' },
  splendor: {
    label: 'Splendor',
    clip: 'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)',
    radius: '0',
  },
  valor: { label: 'Valor', clip: 'polygon(0 0,100% 0,100% 62%,50% 100%,0 62%)', radius: '0' },
};

export const domainColor = (domain: DomainId): string => `var(--${domain})`;

interface Props {
  domain: DomainId;
  size?: number;
  /** Off only in settings, to demonstrate why the shapes are there. */
  shapes?: boolean;
  color?: string;
  opacity?: number;
  style?: CSSProperties;
}

export function DomainMark({
  domain,
  size = 16,
  shapes = true,
  color,
  opacity,
  style,
}: Props): React.JSX.Element {
  const mark = DOMAIN_MARKS[domain];
  return (
    <span
      role="img"
      aria-label={mark.label}
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'block',
        background: color ?? domainColor(domain),
        clipPath: shapes ? mark.clip : 'none',
        borderRadius: shapes ? mark.radius : '3px',
        opacity,
        ...style,
      }}
    />
  );
}

/** The Hope/Fear diamond pair used as the app's mark. */
export function AppMark({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <span className="row" style={{ gap: 0 }} aria-label="Duality Companion" role="img">
      <span
        style={{
          width: size,
          height: size,
          background: 'var(--hope)',
          clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
        }}
      />
      <span
        style={{
          width: size,
          height: size,
          background: 'var(--fear)',
          clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
          marginLeft: -(size * 0.7),
          mixBlendMode: 'screen',
        }}
      />
    </span>
  );
}
