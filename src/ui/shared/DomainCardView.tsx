/**
 * The domain card, in its three states.
 *
 * A card has two normal appearances - with the manual's illustration, and text
 * only - and both have to look deliberate. Without the manual, text-only *is*
 * the normal state, so it gets a real design of its own: an oversized domain
 * wordmark and the domain's silhouette bled off the corner, not an apologetic
 * grey box where a picture should be.
 *
 * The third state is the reader: full text, no clamping, no scrolling.
 */
import { useEffect, useState } from 'react';
import type { DomainCard } from '../../../shared/types.ts';
import { getArt } from '../../store/db.ts';
import { DOMAIN_MARKS, domainColor } from './DomainMark.tsx';

function useArt(key: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (key === undefined) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    void getArt(key).then((record) => {
      if (revoked || !record) return;
      objectUrl = URL.createObjectURL(record.blob);
      setUrl(objectUrl);
    });
    return () => {
      revoked = true;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [key]);
  return url;
}

/**
 * Card text, with its named effects set in bold.
 *
 * A Grimoire is not one feature: Book of Illiat is *Slumber*, *Arcane Barrage*
 * and *Telepathy* stacked in one card, and read as a wall of prose you cannot
 * find the one you meant mid-scene. The book sets those names apart; so does
 * this.
 *
 * The rule is the source's own: a paragraph that opens `Name: ` names an
 * effect. It holds for all 36 such paragraphs in the SRD - the 13 Grimoires,
 * Conjure Swarm's two swarms, and Wild Fortress's `Thresholds: 15/30` - and
 * matches nothing else, because ordinary card prose never opens with a short
 * capitalised clause and a colon.
 */
const NAMED_EFFECT = /^([A-Z][^:\n]{0,42}):\s+/;

export function CardText({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, i) => {
        const lines = paragraph.split('\n');
        const head = lines[0] ?? '';
        const match = NAMED_EFFECT.exec(head);
        const bullets = lines.slice(1).filter((l) => l.startsWith('- '));
        const rest = lines.slice(1).filter((l) => !l.startsWith('- '));

        return (
          <p key={i} style={{ margin: i === 0 ? 0 : '0.75em 0 0' }}>
            {match ? (
              <>
                <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{match[1]}</strong>
                {': '}
                {head.slice(match[0].length)}
              </>
            ) : (
              head
            )}
            {rest.length > 0 && ` ${rest.join(' ')}`}
            {bullets.map((b) => (
              <span key={b} style={{ display: 'block', marginTop: '0.35em', paddingLeft: '1em', textIndent: '-1em' }}>
                {'\u2022 '}
                {b.slice(2)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

/** The footer's height, shared so the overlay button can stop short of it. */
const FOOTER_HEIGHT = 34;

const tint = (domain: DomainCard['domain']): string =>
  `linear-gradient(155deg, color-mix(in srgb, ${domainColor(domain)} 26%, transparent), color-mix(in srgb, ${domainColor(domain)} 5%, transparent))`;

interface HeadProps {
  card: DomainCard;
  shapes: boolean;
  height: number;
  art: string | null;
}

function CardHead({ card, shapes, height, art }: HeadProps): React.JSX.Element {
  const mark = DOMAIN_MARKS[card.domain];
  const color = domainColor(card.domain);

  // The head gives way before the rules text does. A card in a short grid row
  // still has to say what it *does*; a bigger domain wordmark is worth nothing
  // if the feature underneath it has been squeezed to zero.
  const headBox = { height, maxHeight: '34%', flex: '0 0 auto' } as const;

  if (art !== null) {
    return (
      <div style={{ ...headBox, position: 'relative', overflow: 'hidden' }}>
        <img
          src={art}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 20,
            height: 20,
            background: color,
            clipPath: shapes ? mark.clip : 'none',
            borderRadius: shapes ? mark.radius : '3px',
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...headBox,
        position: 'relative',
        overflow: 'hidden',
        background: tint(card.domain),
        display: 'flex',
        alignItems: 'flex-end',
        padding: 10,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: -14,
          right: -16,
          width: height * 0.9,
          height: height * 0.9,
          background: color,
          opacity: 0.16,
          clipPath: shapes ? mark.clip : 'none',
          borderRadius: shapes ? mark.radius : '6px',
        }}
      />
      <span style={{ position: 'relative' }}>
        <span
          style={{
            display: 'block',
            font: `900 ${Math.round(height * 0.26)}px/0.88 var(--sans)`,
            letterSpacing: '-0.025em',
            color,
            textTransform: 'uppercase',
          }}
        >
          {card.domain}
        </span>
        <span
          className="t-meta"
          style={{ display: 'block', marginTop: 6, letterSpacing: '0.2em', color, opacity: 0.75 }}
        >
          {card.type}
        </span>
      </span>
    </div>
  );
}

interface Props {
  card: DomainCard;
  shapes?: boolean;
  onOpen?: () => void;
  /** A number for a fixed card, or '100%' to fill a grid cell. */
  height?: number | string;
  headHeight?: number;
  /**
   * Line clamp. Omit it - which is the normal case - and the text simply
   * fills whatever height the card has and fades out. A fixed line count
   * cannot be right at two card sizes at once: it leaves a gap above the
   * footer in a tall card and eats the first sentence in a short one.
   */
  clamp?: number;
  dimmed?: boolean;
  footer?: React.ReactNode;
}

export function DomainCardView({
  card,
  shapes = true,
  onOpen,
  height = 322,
  headHeight = 98,
  clamp,
  dimmed = false,
  footer,
}: Props): React.JSX.Element {
  const art = useArt(card.artKey);
  const color = domainColor(card.domain);

  // The card used to be one big <button> with the footer's own buttons inside
  // it. That is invalid HTML - a button may not contain interactive content -
  // and in practice it means a keyboard cannot reach "to vault" or "take" at
  // all, and a screen reader announces one control where there are three. The
  // root is now a plain element and "open the card" is an overlay button that
  // covers everything except the footer, so both gestures still land where a
  // finger expects.
  return (
    <div
      style={{
        position: 'relative',
        height,
        width: '100%',
        borderRadius: 'var(--r4)',
        overflow: 'hidden',
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderTop: `3px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        opacity: dimmed ? 0.42 : 1,
      }}
    >
      {onOpen !== undefined && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${card.name} — ${card.domain} level ${card.level} ${card.type}`}
          style={{
            position: 'absolute',
            inset: `0 0 ${FOOTER_HEIGHT}px 0`,
            zIndex: 1,
            width: '100%',
            cursor: 'pointer',
          }}
        />
      )}
      <CardHead card={card} shapes={shapes} height={headHeight} art={art} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '10px 11px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="row" style={{ gap: 6 }}>
          <span
            className="chip"
            style={{
              background: `color-mix(in srgb, ${color} 16%, transparent)`,
              color,
              fontWeight: 700,
            }}
          >
            LV{card.level}
          </span>
          <span className="t-meta" style={{ letterSpacing: '0.1em' }}>
            {card.type.toUpperCase()}
          </span>
        </div>

        <div className="t-card" style={{ marginTop: 8 }}>
          {card.name}
        </div>

        <div style={{ marginTop: 8, flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
          <div
            className="t-dense"
            style={
              clamp === undefined
                ? undefined
                : {
                    display: '-webkit-box',
                    WebkitLineClamp: clamp,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }
            }
          >
            <CardText text={card.text} />
          </div>
          <span
            style={{
              position: 'absolute',
              inset: 'auto 0 0 0',
              height: 26,
              background: 'linear-gradient(180deg, transparent, var(--panel))',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <div
        className="spread"
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 'none',
          height: FOOTER_HEIGHT,
          padding: '0 11px',
          alignItems: 'center',
          borderTop: '1px solid var(--line-soft)',
        }}
      >
        {footer ?? (
          <>
            <span className="t-meta" style={{ letterSpacing: '0.1em' }}>
              {card.text.length > 150 ? 'TAP FOR FULL TEXT' : ''}
            </span>
            <span className="row" style={{ gap: 5 }}>
              <span className="t-meta">RECALL</span>
              <span style={{ font: '800 13px/1 var(--sans)', color: 'var(--text)' }}>
                {card.recallCost}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** The reader overlay: the whole card, always, without a scrollbar. */
export function CardReader({
  card,
  shapes = true,
  onClose,
}: {
  card: DomainCard;
  shapes?: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const art = useArt(card.artKey);
  const mark = DOMAIN_MARKS[card.domain];
  const color = domainColor(card.domain);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'rgb(10 11 15 / 0.86)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="stack"
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '100%',
          borderRadius: 'var(--r5)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          borderTop: `4px solid ${color}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 18px',
            position: 'relative',
            overflow: 'hidden',
            background: art !== null ? undefined : tint(card.domain),
          }}
        >
          {art !== null && (
            <img
              src={art}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.35,
              }}
            />
          )}
          <span
            style={{
              position: 'absolute',
              top: -24,
              right: -18,
              width: 118,
              height: 118,
              background: color,
              opacity: 0.16,
              clipPath: shapes ? mark.clip : 'none',
              borderRadius: shapes ? mark.radius : '8px',
            }}
          />
          <div className="t-meta" style={{ position: 'relative', letterSpacing: '0.18em', color }}>
            {card.domain.toUpperCase()} · LV{card.level} · {card.type.toUpperCase()}
          </div>
          <div
            style={{
              position: 'relative',
              marginTop: 9,
              font: '900 clamp(24px,4vw,30px)/1.02 var(--sans)',
              letterSpacing: '-0.02em',
            }}
          >
            {card.name}
          </div>
        </div>

        <div className="scroll" style={{ padding: '16px 18px 0', flex: 1, minHeight: 0 }}>
          <div className="t-body" style={{ color: 'var(--text-2)' }}>
            <CardText text={card.text} />
          </div>
          {card.flavorText !== undefined && (
            <p
              className="t-dense"
              style={{ marginTop: 14, fontStyle: 'italic', color: 'var(--muted)' }}
            >
              {card.flavorText}
            </p>
          )}
        </div>

        <div
          className="spread"
          style={{ padding: '14px 18px 18px', alignItems: 'center', flex: 'none' }}
        >
          <button type="button" className="t-meta" onClick={onClose} style={{ letterSpacing: '0.1em' }}>
            TAP ANYWHERE TO CLOSE
          </button>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            RECALL COST {card.recallCost}
          </span>
        </div>
      </div>
    </div>
  );
}
