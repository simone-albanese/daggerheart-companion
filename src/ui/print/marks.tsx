/**
 * The sheet's shapes, drawn for paper.
 *
 * On screen a mark is a `<span>` with a background colour and a `clip-path`.
 * Neither survives printing: a browser drops background colours by default, so
 * a clipped background prints as nothing at all. These are SVG instead, where
 * fill and stroke are content and always come out.
 *
 * The silhouettes are not redrawn here. `DOMAIN_MARKS` already states each
 * domain's polygon, so the polygon is converted; two sources of truth for
 * nine shapes is exactly how a shape and its colour drift apart.
 */
import { DOMAIN_MARKS } from '../shared/DomainMark.tsx';
import type { DomainId } from '../../../shared/types.ts';
import type { TrackKind } from '../shared/Track.tsx';

/**
 * `polygon(50% 0,100% 50%,...)` -> `50,0 100,50 ...` in a 100x100 viewBox.
 *
 * Every coordinate in DOMAIN_MARKS is a percentage or a bare zero, so
 * `parseFloat` reads both and the numbers are already the viewBox units.
 */
function polygonPoints(clip: string): string | null {
  const inner = /^polygon\(([^)]*)\)$/.exec(clip)?.[1];
  if (inner === undefined) return null;
  return inner
    .split(',')
    .map((pair) =>
      pair
        .trim()
        .split(/\s+/)
        .map((n) => parseFloat(n))
        .join(','),
    )
    .join(' ');
}

/** "Arcana", not "arcana". The mark table already carries the proper name. */
export const domainLabel = (domain: DomainId): string => DOMAIN_MARKS[domain].label;

/**
 * A domain's silhouette, filled.
 *
 * Filled rather than outlined because at 3mm an outline is a smudge, and this
 * shape is the thing a colour-blind reader - or anyone holding a photocopy -
 * identifies the domain by. The card also prints its domain in words, so the
 * shape is reinforcement rather than the only carrier either way.
 */
export function PrintDomainMark({
  domain,
  size = 2.9,
}: {
  domain: DomainId;
  /** Millimetres. */
  size?: number;
}): React.JSX.Element {
  const mark = DOMAIN_MARKS[domain];
  const points = polygonPoints(mark.clip);
  return (
    <svg
      className="dhc-mark"
      width={`${size}mm`}
      height={`${size}mm`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={mark.label}
    >
      {points !== null ? <polygon points={points} fill="currentColor" /> : rounded(domain)}
    </svg>
  );
}

/**
 * The marks CSS draws with a border-radius rather than a clip-path.
 *
 * A radius has no polygon to convert, so those three are stated once here.
 * Anything else falls back to the square the radius is applied to, which is
 * still a mark and still labelled - never an empty box.
 */
function rounded(domain: DomainId): React.JSX.Element {
  if (domain === 'grace') return <circle cx="50" cy="50" r="50" fill="currentColor" />;
  if (domain === 'sage') {
    return <path d="M0 0 H38 A62 62 0 0 1 100 62 V100 H62 A62 62 0 0 1 0 38 Z" fill="currentColor" />;
  }
  return <rect x="0" y="0" width="100" height="100" rx="12" fill="currentColor" />;
}

/**
 * The four track silhouettes, as outlines.
 *
 * Same shape language as the screen - HP a bar, Stress a slash, Hope a
 * diamond, Armor a shield - so a player who knows the sheet knows the
 * printout. Outlined, because these are the boxes a pencil goes inside.
 */
const TRACK_PATH: Record<TrackKind, React.JSX.Element> = {
  hp: <rect x="0.9" y="0.9" width="8.2" height="8.2" rx="1.8" />,
  stress: <polygon points="2.2,0.9 9.1,0.9 7.8,9.1 0.9,9.1" />,
  hope: <polygon points="5,0.7 9.3,5 5,9.3 0.7,5" />,
  armor: <polygon points="0.9,0.9 9.1,0.9 9.1,6.1 5,9.2 0.9,6.1" />,
};

/**
 * A row of empty boxes.
 *
 * Empty is the point: a printed sheet is played with a pencil, so what it owes
 * the player is somewhere to make a mark, not a picture of the marks they had
 * when they pressed print. One `<svg>` holds the whole row rather than one per
 * box - a level 10 character prints 40 of these.
 */
export function TickRow({
  kind,
  count,
  size = 3.4,
  gap = 1.1,
}: {
  kind: TrackKind;
  count: number;
  /** Box side, in millimetres. Sized for a pencil, not a finger. */
  size?: number;
  gap?: number;
}): React.JSX.Element | null {
  if (count <= 0) return null;
  const pitch = size + gap;
  return (
    <svg
      width={`${count * pitch - gap}mm`}
      height={`${size}mm`}
      viewBox={`0 0 ${count * 10 + (count - 1) * ((gap / size) * 10)} 10`}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(${i * (10 + (gap / size) * 10)} 0)`}>
          {TRACK_PATH[kind]}
        </g>
      ))}
    </svg>
  );
}

/** Gold is counted, not tracked, so its boxes are plain circles. */
export function CoinRow({
  count,
  size = 3,
  gap = 1,
}: {
  count: number;
  size?: number;
  gap?: number;
}): React.JSX.Element | null {
  if (count <= 0) return null;
  const step = 10 + (gap / size) * 10;
  return (
    <svg
      width={`${count * (size + gap) - gap}mm`}
      height={`${size}mm`}
      viewBox={`0 0 ${count * step - (step - 10)} 10`}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={i * step + 5} cy="5" r="4.2" />
      ))}
    </svg>
  );
}
