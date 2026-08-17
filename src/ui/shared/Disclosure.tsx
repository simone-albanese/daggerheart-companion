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
 * AND WHERE IT DOES NOT FIT IT SAYS SO, RATHER THAN BEING SAWN OFF. The summary
 * span was `flex: 'none'` with no `minWidth: 0` and no `textOverflow`, so
 * nothing on the header line could give: a header wider than the column simply
 * ran past the edge, and `Play`'s column is `overflow-x: hidden`, so it was cut
 * with no ellipsis and no gesture that brings it back. Measured in Chrome with
 * the `wizard10` fixture, whose purse spans all three denominations: `4 ITEMS ·
 * 1 CHEST · 3 BAGS · 7 HANDFULS` is 257.41px wide with a viewport-invariant
 * right edge of **364.61**, so 4.61px was gone at 360, 20.61 at 344 and 44.61 at
 * 320 - the gold falls off the summary at exactly the widths where the fold
 * stays shut longest. It is `0 1 auto` with `minWidth: 0` and an ellipsis now,
 * so the rule above degrades to "partially said" instead of "silently cut", and
 * the column's `scrollWidth` drops back to the viewport's width. It costs zero
 * vertically: the header is `minHeight: var(--tap)` around one 10px line.
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

/**
 * Whether one section of the sheet is open, remembered per character.
 *
 * Lifted out of the component below because the fold header is no longer the
 * only thing on Play with something to remember. The trait row's verbs control
 * is a 44x44 button at the end of a row of chips - it cannot be a `Disclosure`,
 * which is a full-width header by contract - and a second copy of the
 * `<characterId>:<id>` key format is how the two would eventually disagree
 * about where a player's arrangement is written.
 *
 * Lowercase on purpose. `screens.test.tsx` derives its fixture list from every
 * PascalCase export under `src/ui`, and a hook is not a component; naming this
 * `UsePlaySection` would demand a fixture that mounts a hook.
 */
export function usePlaySection(
  characterId: string | null,
  id: string,
  defaultOpen = false,
): [boolean, () => void] {
  const sections = useApp((s) => s.prefs.playSections);
  const setPrefs = useApp((s) => s.setPrefs);
  const key = `${characterId ?? 'none'}:${id}`;
  const open = sections[key] ?? defaultOpen;
  return [open, () => setPrefs({ playSections: { ...sections, [key]: !open } })];
}

export function Disclosure({
  id,
  characterId,
  label,
  summary,
  defaultOpen = false,
  children,
}: Props): React.JSX.Element {
  const [open, toggle] = usePlaySection(characterId, id, defaultOpen);

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
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
          // The label is `flex: 'none'` and this is not: where the two cannot
          // both fit, the section's name is the half that has to survive whole
          // and its number is the half that can lose its tail. See the note at
          // the top of this file for what that was costing at 360 and below.
          <span
            className="t-meta"
            style={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--muted)',
            }}
          >
            {summary}
          </span>
        )}
      </button>
      {open && children}
    </section>
  );
}
