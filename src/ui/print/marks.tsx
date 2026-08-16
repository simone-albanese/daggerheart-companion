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
 * How far in from the cell edge a strike has to start to stay inside the shape.
 *
 * One number per silhouette rather than one for all four, because the shapes do
 * not fill their cells equally. A cross drawn at 2 sits inside the HP square
 * and outside the Hope diamond, whose top-left edge is the line x+y=5.7 - it
 * came out looking like a second diamond laid over the first rather than a slot
 * crossed out, which is the one thing this mark has to say.
 */
const CROSS_INSET: Record<TrackKind, number> = { hp: 2, stress: 2.2, hope: 3.2, armor: 2.6 };

/** The two lines that strike a slot out, inscribed in this kind's silhouette. */
function cross(kind: TrackKind): React.JSX.Element {
  const a = CROSS_INSET[kind];
  const b = 10 - a;
  return <path d={`M${a} ${a} L${b} ${b} M${b} ${a} L${a} ${b}`} />;
}

/**
 * A row of empty boxes: the slots you have, the slots you could still earn, and
 * the slots you have lost.
 *
 * Empty is the point: a printed sheet is played with a pencil, so what it owes
 * the player is somewhere to make a mark, not a picture of the marks they had
 * when they pressed print. One `<svg>` holds the whole row rather than one per
 * box - a level 10 character prints 40 of these.
 *
 * `growth` draws boxes past the current maximum as broken outlines, which is
 * the one idea worth taking off the official sheet: it is the only way a
 * printed track can say "six now, twelve at most" without printing a sentence.
 * The dash is 1.2 units on, 1.1 off in a 10-unit cell - roughly 0.4mm of ink to
 * 0.37mm of gap at the default 3.4mm box - which reads as broken at arm's
 * length and still survives a 300dpi laser, where anything finer fills in.
 *
 * `crossed` strikes slots out, for the Hope diamonds a scar has taken.
 */
export function TickRow({
  kind,
  count,
  growth = 0,
  crossed = 0,
  size = 3.4,
  gap = 1.1,
}: {
  kind: TrackKind;
  count: number;
  /** Boxes past the maximum, drawn dashed. */
  growth?: number;
  /** Boxes struck through, drawn after the solid ones. */
  crossed?: number;
  /** Box side, in millimetres. Sized for a pencil, not a finger. */
  size?: number;
  gap?: number;
}): React.JSX.Element | null {
  const solid = Math.max(0, count);
  const total = solid + Math.max(0, crossed) + Math.max(0, growth);
  if (total <= 0) return null;
  const pitch = size + gap;
  const step = 10 + (gap / size) * 10;
  return (
    <svg
      width={`${total * pitch - gap}mm`}
      height={`${size}mm`}
      viewBox={`0 0 ${total * 10 + (total - 1) * ((gap / size) * 10)} 10`}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) => {
        const struck = i >= solid && i < solid + crossed;
        const dashed = i >= solid + crossed;
        return (
          <g
            key={i}
            transform={`translate(${i * step} 0)`}
            {...(dashed ? { strokeDasharray: '1.2 1.1' } : {})}
          >
            {TRACK_PATH[kind]}
            {struck && cross(kind)}
          </g>
        );
      })}
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
