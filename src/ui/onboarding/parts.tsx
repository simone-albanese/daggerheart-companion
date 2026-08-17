/**
 * The row every first-run choice is made on.
 *
 * One shape for the answers and for the three import doors, in its own module
 * because `Onboarding` reaches `ImportDoors` through a `lazy()` boundary and a
 * row exported from one and imported by the other would be a cycle across it.
 *
 * ## Why it is this size
 *
 * 64px against this app's 44px floor (`--tap`), and full width. Both are the
 * same argument: this row is the entire business of the screen it is on, there
 * is nothing to share the column with, and the largest target the column can
 * make is the right one for the first thing anybody ever touches. 64 also
 * survives the label wrapping to two lines on a 320px phone, where `minHeight`
 * gives way to content at 75 rather than clipping.
 *
 * The tap on the row is also the tap that advances. There is no Next to find at
 * the bottom of the screen, which is what keeps a two-question flow at two taps
 * and what makes a stray tap cost exactly one Back.
 *
 * Three parts, in reading order and not in touching order, because the whole row
 * is one target: a glyph square that makes the set scannable by shape, the
 * answer, and underneath it the consequence in the app's own words - `ROLL
 * STAYS ON THE SHEET`, not "recommended". A row that only names the choice
 * makes somebody guess what it does; a row that names what it does is a row you
 * can be sure about before you commit to it.
 */

export function AnswerRow({
  glyph,
  label,
  sub,
  onPick,
  selected = false,
}: {
  /** Two to four characters of mono. Never an emoji: this app draws marks. */
  glyph: string;
  label: string;
  /** What the app will do differently, in the words the app itself uses. */
  sub: string;
  onPick: () => void;
  /**
   * Drawn as chosen. Only the import doors use it - the questions advance on
   * the tap, so a question's rows have no state to be in.
   */
  selected?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="row"
      onClick={onPick}
      aria-pressed={selected ? true : undefined}
      style={{
        minHeight: 64,
        width: '100%',
        gap: 14,
        padding: '12px 14px',
        borderRadius: 'var(--r3)',
        background: selected ? 'var(--hope-wash)' : 'var(--raised)',
        border: `1px solid ${selected ? 'var(--hope)' : 'var(--line)'}`,
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        className="t-meta"
        style={{
          flex: 'none',
          width: 34,
          height: 34,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--r2)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          color: 'var(--hope)',
          letterSpacing: '0.02em',
        }}
      >
        {glyph}
      </span>
      <span className="stack" style={{ gap: 3, minWidth: 0 }}>
        {/*
          `balance` because the longest label here wraps at 320px and left to
          itself put the single word "now" on a line of its own - measured, and
          the one thing the audit sweep flagged on this screen at any viewport.
          An orphan under a 218px line is the row looking like a mistake.
        */}
        <span style={{ font: '600 15px/1.2 var(--sans)', color: 'var(--text)', textWrap: 'balance' }}>
          {label}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {sub}
        </span>
      </span>
    </button>
  );
}
