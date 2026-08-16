/**
 * The domain card, in the two jobs it has to do, plus the reader.
 *
 * SHOWCASE is a card you are looking at. It has two appearances - with the
 * manual's illustration, and text only - and both have to look deliberate.
 * Without the manual, text-only *is* the normal state, so it gets a real
 * design of its own: an oversized domain wordmark and the domain's silhouette
 * bled off the corner, not an apologetic grey box where a picture should be.
 *
 * READING is a card you are choosing between. That is a different job and the
 * banner is actively in the way of it: it announces a domain the player has
 * already filtered by, in display type, across the top third of the one panel
 * where the answer to "what does this do" was supposed to go. So the reading
 * card has no banner. The domain becomes a mark and a word on one line, the
 * rules text moves up to `.t-read` and takes everything that is left, and the
 * card grows to fit its text instead of ellipsising it after three lines.
 *
 * The third state is the reader: the full text, never clamped, scrolling when
 * the card is longer than the screen. (That last clause read "no scrolling"
 * until the footer was corrected, and it was never true - the body has carried
 * `.scroll` for as long as it has existed. It matters here rather than being a
 * stale comment: the panel scrolling is the reason a tap on it cannot be a
 * dismissal, which is the whole argument beside the footer below.)
 */
import { useEffect, useRef, useState } from 'react';
import type { DomainCard } from '../../../shared/types.ts';
import { getArt } from '../../store/db.ts';
import { DOMAIN_MARKS, DomainMark, domainColor } from './DomainMark.tsx';

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

/**
 * The footer's height, shared so the overlay button can stop short of it.
 *
 * 34px on a mouse, and the touch floor wherever there is a finger. The footer
 * is where the card's one action lives - TAKE, RECALL, TO VAULT - and a 44px
 * button inside a 34px band is not a 44px target, it is a button overflowing
 * its own strip. `--control` is already the token that answers "how tall is an
 * ordinary control here", and it resolves to 34 on a fine pointer and to
 * `--tap` at 1179px and below or under `pointer: coarse`, so the mouse layout
 * is unchanged to the pixel and every touchscreen gains ten.
 */
const FOOTER_HEIGHT = 'max(34px, var(--control))';

/**
 * Which of the two jobs this card is doing. See the file header.
 *
 * `showcase` is what every existing screen asks for and is the default, so
 * nothing changes anywhere until a call site says otherwise.
 */
export type CardVariant = 'showcase' | 'reading';

/**
 * How many lines of rules text a card being chosen shows before it stops.
 *
 * Counted in lines rather than pixels because the thing that decides whether a
 * card fits is its measure, not its height, and the measure is set by whatever
 * grid the card lands in. Measured against the real SRD - 189 cards, median
 * 275 characters, longest 655 - at 13px Archivo:
 *
 *   text column                | 10 lines |  12  |  14  |  16
 *   -------------------------- | -------- | ---- | ---- | ----
 *   155px (2 up on a phone)         41%   |  56% |  63% |  67%
 *   295px (3 up on a desktop)       81%   |  89% |  96% | 100%
 *   342px (1 up on a phone)         81%   |  93% | 100% | 100%
 *
 * (share of the 27 level 1 cards - the ones creation actually offers - shown
 * whole.) Fourteen is where a one-column phone shows every candidate entire
 * and a three-column desktop shows all but one, and it costs about 264px of
 * text: roughly the height the card already occupied, spent on the card
 * instead of on its banner. Two of the 189 - the two longest Grimoires - still
 * run over at any measure a card grid can give them, which is why the reader
 * stays and why the "there is more" line is not dead code.
 */
export const READING_LINES = 14;

/** The line budget as a length, in the tokens that define the line. */
const READING_MAX = `calc(${READING_LINES} * var(--read-lh) * var(--read-size))`;

/**
 * Whether a box is showing less than it holds.
 *
 * Pure and exported because it is the whole truncation story: the fade, the
 * "there is more" line and the reader are all this one answer, and it is the
 * only part of the story a test without a layout engine can reach.
 *
 * The one-pixel slack is not superstition. A fractional line height rounds
 * `scrollHeight` and `clientHeight` a hair apart on a card that is in fact
 * showing everything, and a card that claims to be hiding text it is not is
 * worse than one that says nothing at all.
 */
export const overflows = (box: { scrollHeight: number; clientHeight: number }): boolean =>
  box.scrollHeight - box.clientHeight > 1;

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
  /**
   * A number for a fixed card, or '100%' to fill a grid cell.
   *
   * In the reading variant this is a floor rather than a height: the card
   * grows past it to fit its text, because a card being chosen that is the
   * same height as its neighbours but shows a quarter of what they show has
   * not told you anything you can compare.
   */
  height?: number | string;
  headHeight?: number;
  /**
   * Line clamp, showcase only. Omit it - which is the normal case - and the
   * text simply fills whatever height the card has and fades out. A fixed
   * line count cannot be right at two card sizes at once: it leaves a gap
   * above the footer in a tall card and eats the first sentence in a short
   * one. The reading variant ignores it and uses READING_LINES.
   */
  clamp?: number;
  dimmed?: boolean;
  footer?: React.ReactNode;
  /** See CardVariant. Defaults to the card every existing screen renders. */
  variant?: CardVariant;
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
  variant = 'showcase',
}: Props): React.JSX.Element {
  const reading = variant === 'reading';
  // No head, so no illustration to fetch. Asking for one anyway would decode a
  // blob and mint an object URL for a picture this variant never draws.
  const art = useArt(reading ? undefined : card.artKey);
  const color = domainColor(card.domain);

  // Whether the rules text ran past its budget. Only a browser knows - it
  // depends on the column the card landed in - so the card starts by claiming
  // nothing and is corrected once there is a layout to ask.
  const textRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  useEffect(() => {
    const box = textRef.current;
    if (!reading || box === null) return;
    const measure = (): void => setClipped(overflows(box));
    measure();
    // A phone that rotates re-flows the grid, and the answer changes with it.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [reading, card.text]);

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
        // Reading: a floor, and `flex` so that a card sitting in a flex column
        // beside a commit button still reaches the bottom of its grid row -
        // otherwise the buttons under a row of cards end up at six different
        // heights. A grid item ignores `flex`, so the showcase call sites that
        // put the card straight into a grid are unaffected either way.
        ...(reading ? { minHeight: height, flex: '1 1 auto' } : { height }),
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
            inset: `0 0 ${FOOTER_HEIGHT} 0`,
            zIndex: 1,
            width: '100%',
            cursor: 'pointer',
          }}
        />
      )}
      {!reading && <CardHead card={card} shapes={shapes} height={headHeight} art={art} />}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: reading ? 'var(--s4) var(--s4) 0' : '10px 11px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {reading ? (
          // The whole banner, on one line. The mark is the same shape-coded
          // silhouette the loadout and the filters use, so the domain is
          // readable without colour; the word beside it says so in letters, so
          // it is readable with the shapes switched off too.
          <div className="row" style={{ gap: 'var(--s2)' }}>
            <DomainMark domain={card.domain} size={12} shapes={shapes} />
            <span className="t-meta" style={{ letterSpacing: '0.1em' }}>
              {card.domain.toUpperCase()} · LV{card.level} · {card.type.toUpperCase()}
            </span>
          </div>
        ) : (
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
        )}

        <div className="t-card" style={{ marginTop: reading ? 'var(--s2)' : 8 }}>
          {card.name}
        </div>

        {reading ? (
          // The box hugs the text rather than filling the card, so the "there
          // is more" line lands on the cut and not somewhere below it. The
          // fade is the shared `.scroll-fade` mask and appears only when
          // something is actually behind it - an unconditional fade over the
          // last line of a card that ends there just makes it harder to read.
          <div style={{ marginTop: 'var(--s3)', flex: '0 0 auto', position: 'relative' }}>
            <div
              ref={textRef}
              className={clipped ? 't-read scroll-fade' : 't-read'}
              style={{ maxHeight: READING_MAX, overflow: 'hidden' }}
            >
              <CardText text={card.text} />
            </div>
            {clipped && (
              <span
                className="t-meta"
                style={{
                  position: 'absolute',
                  right: 0,
                  bottom: 0,
                  letterSpacing: '0.1em',
                  color: 'var(--text-2)',
                  background: 'var(--panel)',
                  paddingLeft: 'var(--s3)',
                  // Inside the overlay button's area, so the words are the
                  // target. In the footer they were a label on the one strip
                  // that deliberately is not tappable.
                  pointerEvents: 'none',
                }}
              >
                MORE — TAP TO READ
              </span>
            )}
          </div>
        ) : (
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
        )}
      </div>

      <div
        className="spread"
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 'none',
          height: FOOTER_HEIGHT,
          // Lined up with whichever body sits above it.
          padding: reading ? '0 var(--s4)' : '0 11px',
          alignItems: 'center',
          borderTop: '1px solid var(--line-soft)',
        }}
      >
        {footer ?? (
          <>
            {/* Reading cards say "there is more" on the cut, where the text
                stopped, and only when there is. The showcase default guesses
                from length because a showcase card measures nothing. */}
            <span className="t-meta" style={{ letterSpacing: '0.1em' }}>
              {!reading && card.text.length > 150 ? 'TAP FOR FULL TEXT' : ''}
            </span>
            {/* COST, not RECALL. RECALL is the name of an action, and this
                number is its price; printing the same word for both is how
                "RECALL" and "RECALL 2" ended up eleven characters apart on
                the card browser, reading as a matched pair of labels. */}
            <span className="row" style={{ gap: 5 }}>
              <span className="t-meta">COST</span>
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

/**
 * The reader overlay: the whole card, always, scrolled if it does not fit.
 *
 * Three ways out, and they are not equal. Escape is the keyboard's, declared
 * to a screen reader with `aria-keyshortcuts` and drawn as a key cap wherever
 * there is a pointer precise enough to imply a keyboard. A tap outside is the
 * convention, unadvertised, and on a phone it is a 12px band. The footer's
 * CLOSE is the one that is named, and it is the one sized for a thumb - see
 * the note above it for why the card itself is not a fourth.
 */
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

        {/*
          The footer used to read TAP ANYWHERE TO CLOSE, and a tap on the card
          does not close it - the panel above stops the click on purpose, so
          that dragging the rules text does not throw the card away. Two ways
          out of that, and the one not taken is the interesting one: the card
          could have closed on any tap that was not a drag. It must not. This
          panel scrolls, every gesture that lands on it is presumptively a
          reading gesture, and telling a scroll from a tap is a threshold
          somebody's tremor or Touch Accommodations will sit exactly on top of
          - the same window `Track` already had to move a long press out of.
          The two failures are not the same size either: a hint that overstates
          costs a second tap, and a reader that dismisses under a slightly
          dragged thumb loses the card mid-scene and the player's place in it.

          So the copy gives way, and it names the control rather than the
          gesture: this button is what closes the reader, and it says so, in
          the same word and the same corner as the five other overlays in the
          app. Tapping outside still closes - it is the convention and it is
          how every one of those overlays behaves - but it is not advertised,
          because on a 390px phone "outside" is the two 12px gutters beside a
          366px panel and the 12px band above and below a card tall enough to
          need reading. That is under WCAG 2.5.8's 24px floor, let alone this
          project's 44px one, and pointing a thumb at it would be a true
          sentence and a worse screen.

          Which leaves the target. The old control was `.t-meta` - 10px mono -
          in a button whose padding base.css zeroes: a hit box about 118 x 10px,
          the smallest target in the reader and the only thing in it that
          closes. It is now 44px tall and at least 44 wide, with the 12px of
          padding pulled straight back out again so the word still begins on
          the panel's own 18px gutter. The footer grows 42px -> 64px; that comes
          off a column that scrolls, so nothing is lost, only moved down, and it
          buys the one control a thumb has to hit. It stays bottom-left, where
          the bottom edge is the widest part of either thumb's arc and where
          this app has put CLOSE five times already.
        */}
        <div
          className="spread"
          style={{ padding: '8px 18px 12px', alignItems: 'center', flex: 'none' }}
        >
          <button
            type="button"
            className="t-meta row"
            onClick={onClose}
            aria-keyshortcuts="Escape"
            style={{
              gap: 8,
              minHeight: 'var(--tap)',
              minWidth: 'var(--tap)',
              padding: '0 12px',
              marginLeft: -12,
              letterSpacing: '0.1em',
            }}
          >
            CLOSE
            <span className="keycap" aria-hidden="true">
              ESC
            </span>
          </button>
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            RECALL COST {card.recallCost}
          </span>
        </div>
      </div>
    </div>
  );
}
