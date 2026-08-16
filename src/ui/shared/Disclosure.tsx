/**
 * The tendina: a section of the sheet that folds away and stays folded.
 *
 * "Sempre con la tendina, clicco e via." The whole character sheet does not
 * fit on a 393x852 phone and never will - the paper one is two sides of A4 -
 * so the choice is between showing part of it and letting the player say which
 * part. A closed section costs one 44px row, which is the difference between
 * a sheet you scroll through and a sheet you scroll past.
 *
 * Three rules make that honest rather than merely tidy.
 *
 * The header always says what is inside it. A count, a total, whatever the
 * section's one number is - because a fold that hides how many cards you are
 * carrying has not saved you a scroll, it has cost you a tap to find out.
 * `summary` is drawn open and closed alike, so opening a section never changes
 * what the header claims.
 *
 * The whole header is the target, not the chevron. It is 44px tall and the
 * full width of the column - about 369px on a 393px phone - which is the
 * largest target on the screen and the only one that can be hit without
 * looking.
 *
 * And the state is remembered per character, in `prefs`, so the sheet a player
 * arranged is the sheet they come back to. It is deliberately not on the
 * character record: see the note on `Prefs.playSections`.
 */
import { useApp } from '../../store/state.ts';

interface Props {
  /** Stable id for this section. Stored under `<characterId>:<id>`. */
  id: string;
  /** Character the remembered state belongs to. Null forgets between mounts. */
  characterId: string | null;
  label: string;
  /** The section's one number, shown open and closed alike. */
  summary?: React.ReactNode;
  /** What it costs to be wrong about the default, per section. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Disclosure({
  id,
  characterId,
  label,
  summary,
  defaultOpen = false,
  children,
}: Props): React.JSX.Element {
  const sections = useApp((s) => s.prefs.playSections);
  const setPrefs = useApp((s) => s.setPrefs);
  const key = `${characterId ?? 'none'}:${id}`;
  const open = sections[key] ?? defaultOpen;

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setPrefs({ playSections: { ...sections, [key]: !open } })}
        className="row"
        style={{
          flex: 'none',
          minHeight: 'var(--tap)',
          width: '100%',
          gap: 8,
          padding: '0 2px',
          textAlign: 'left',
        }}
      >
        {/*
         * A triangle, rotated. Not a character from the font: the arrow
         * glyphs sit on wildly different baselines across the two families
         * this app ships, and a marker that jumps by three pixels when a
         * section opens reads as the row moving.
         */}
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 8,
            height: 8,
            background: 'var(--muted)',
            clipPath: open ? 'polygon(0 25%,100% 25%,50% 100%)' : 'polygon(25% 0,100% 50%,25% 100%)',
          }}
        />
        <span className="t-label" style={{ flex: 'none', color: 'var(--text-2)' }}>
          {label}
        </span>
        <span style={{ flexGrow: 1, flexBasis: 0, minWidth: 8 }} />
        {summary !== undefined && (
          <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
            {summary}
          </span>
        )}
      </button>
      {open && children}
    </section>
  );
}
