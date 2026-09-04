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
 * stays shut longest. It became `0 1 auto` with `minWidth: 0` and an ellipsis,
 * so the rule above degraded to "partially said" instead of "silently cut", and
 * the column's `scrollWidth` dropped back to the viewport's width.
 *
 * SAID WHOLE, ON A SECOND LINE, SINCE THE READABILITY RAMP. The summary takes
 * the `.t-meta` role - 12px on a phone, 11 on a desk - and the one-line header
 * wraps: where the summary does not fit after the name it goes under it,
 * whole, at the same right edge (`marginLeft: auto`), and where it is wider
 * than the row on its own it wraps inside its box. The name's 13.2px line, the
 * 2px row gap and a 15px summary line are 30.2 inside the 44px floor, so at
 * the 16px root this costs the column nothing. Measured on the rig with
 * `wizard10` at 393, 360 and 320:
 * `4 ITEMS · 1 CHEST · 3 BAGS · 7 HANDFULS` is 300px at 12, the row after
 * `CARRIED` has 269.55 of the header's 365 content box, and the line goes
 * under the name at 393 and 360 with its right edge flush at the column (379
 * and 346) and the header at 44; at 320 it is two lines of 292 and the header
 * is 45.19. At a 125% root the same line is 374 in 365 and takes two lines
 * under the name for a 56px header; `8 FEATURES` at 96 no longer fits beside
 * `LINEAGE, DOMAINS & FEATURES` at 267.31 and goes under it at 44. Nothing is
 * ellipsised and nothing runs past the column at any of the six.
 *
 * WHY THIS AND NOT A SMALLER SIZE FOR THE LONG ONE. `Carried` was the one fold
 * held under the role - at 10, then at 11 in rem - so that its line would fit
 * in one, and it did not: 283.14 at 11 against the 269.55 above, ellipsised by
 * 5px at 393. A size cannot hold a line that scales with the root inside a
 * column that does not; the headroom under the line can, and it is what the
 * 44px floor has been carrying all along. Two errors in that arithmetic are
 * worth keeping: whether a line fits is a comparison of two **widths**, the
 * line against the room the row actually has, and this file once made it
 * against `364.61` and `390`, which are offsets from the left of the glass -
 * subtracting an offset from the column's own width pays for the column's 12px
 * of padding and the button's 2 twice, and reports 4.39 of slack where there
 * were 14.39 at the 10px line. A measurement copied to a second site is a
 * measurement that will disagree with itself, which is why `Play` no longer
 * carries one.
 *
 * The whole header is the target, not the chevron. It is 44px tall - `--tap`,
 * a floor rather than a height - and as wide as the row it is handed, which
 * since the reflow is two numbers and not one. `Carried` and `Lineage &
 * domains` get the column whole: 369px on a 393px phone, and there the header
 * is the largest target on the screen and the only one that can be hit without
 * looking. The four folds this column pairs two-up get half a cell - 181.5px
 * at 393 and 165 at 360, measured rather than divided out - which is under
 * half of that and smaller than ROLL (317x56) on both axes.
 *
 * That second number is not a footnote to this rule, it is the reason
 * `stacked` exists: a header with half the width has to spend the headroom
 * under its line to go on saying what is inside it. See the prop.
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
  /**
   * The section's one number, shown open and closed alike. It takes the
   * `.t-meta` role and wraps where the row is short of it; there is no
   * per-fold size any more - see WHERE IT DOES NOT FIT at the top of the
   * file for the fold that used to have one, and the arithmetic that went
   * wrong twice while it did.
   */
  summary?: React.ReactNode;
  /**
   * Draw the header as two lines instead of one, for a header that is sharing
   * its row with another one.
   *
   * The phone pairs four of its folds two-up, which is where the reflow's
   * biggest saving comes from: six 44px rows around a 10px line each were 264px
   * of column carrying 60px of ink, and the owner's own words for it were «è
   * tutto attaccato sopra» - dense where the content is, empty where it is not.
   * A pair halves the rows and doubles the ink in each.
   *
   * It has to be two lines, and that is measured rather than chosen. A cell is
   * (393 - 24 - 6) / 2 = 181.5 at the owner's width and 165 at 360, and a
   * one-line header is the marker, the name, a spacer and the summary: `Weapons
   * & armour` beside `ARMED · LONGSWORD` does not fit either, so the summary -
   * the half with the ellipsis - would lose its tail at rest rather than at the
   * bottom of the width range. That is the failure this whole component exists
   * to prevent, so the header stacks instead: the name on its own line at the
   * cell's full width, then the marker and the summary under it.
   *
   * THE MARKER GOES WITH THE SUMMARY AND NOT WITH THE NAME. On the second line
   * it sits beside the thing that changes when you press the header, which is
   * what a disclosure marker is for. On one line it leads, because there it is
   * the first thing under the thumb.
   *
   * The name may ellipsise here where it never does on one line. In a half cell
   * there is no half of the header that can be sacrificed instead, and a name
   * cut at the tail still says which section it is; the alternative is a row
   * that overflows the column, which is worse and is what the note at the top
   * of this file is about.
   */
  stacked?: boolean;
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
  stacked = false,
  defaultOpen = false,
  children,
}: Props): React.JSX.Element {
  const [open, toggle] = usePlaySection(characterId, id, defaultOpen);

  /*
   * A triangle, rotated. Not a character from the font: the arrow glyphs sit on
   * wildly different baselines across the two families this app ships, and a
   * marker that jumps by three pixels when a section opens reads as the row
   * moving.
   */
  const marker = (
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
  );

  const theSummary = summary !== undefined && (
    // On one line the label is `flex: 'none'` and this is not: where the two
    // cannot both fit, the section's name keeps its line and this one takes a
    // second, inside the headroom of the 44px floor - see the note at the top
    // of this file for what it used to lose instead. Stacked, the two are on
    // separate lines and this wraps against the marker.
    //
    // The role's own size and nothing inline: 12px on a phone and 11 on a
    // desk since the readability ramp, which is what lets the OS text setting
    // reach it. The one fold that was held down - Carried, at 10 and then 11
    // - was held down so that its line would fit in one; wrapping is what
    // fits it, at the role, and at a 125% root as well.
    <span
      className="t-meta"
      style={{
        flex: '0 1 auto',
        minWidth: 0,
        whiteSpace: 'normal',
        // A readout at the right edge of the row keeps that edge on whichever
        // line it lands on - the auto margin is what puts a wrapped summary
        // at the right rather than under the marker; on the stacked header
        // it sits beside the marker and reads from it.
        marginLeft: stacked ? undefined : 'auto',
        textAlign: stacked ? undefined : 'right',
        color: 'var(--muted)',
      }}
    >
      {summary}
    </span>
  );

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={stacked ? 'stack' : 'row'}
        style={{
          flex: 'none',
          minHeight: 'var(--tap)',
          width: '100%',
          // 2 between the two lines and 8 along the one. The stacked gap is
          // small on purpose: two 11px lines and a 2px gap is 24 of ink in a
          // 44px floor, so the pair still reads as one block rather than as two
          // rows that happen to be adjacent. The one-line header keeps the 8
          // along its line and takes the same 2 between lines, because it can
          // have two as well now: where the summary does not fit after the
          // name it wraps under it, whole, rather than losing its tail - see
          // the top of the file for the widths.
          columnGap: 8,
          rowGap: 2,
          flexWrap: stacked ? undefined : 'wrap',
          // The two lines sit in the middle of the 44px floor rather than at
          // its top, so a cell whose partner is taller does not look hung.
          justifyContent: stacked ? 'center' : undefined,
          padding: '0 2px',
          textAlign: 'left',
        }}
      >
        {stacked ? (
          <>
            <span
              className="t-label"
              style={{
                // The name gets the cell's full width and may lose its tail
                // here, which it never does on one line - see `stacked`.
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--text-2)',
              }}
            >
              {label}
            </span>
            <span className="row" style={{ gap: 6, minWidth: 0 }}>
              {marker}
              {theSummary}
            </span>
          </>
        ) : (
          <>
            {marker}
            <span className="t-label" style={{ flex: 'none', color: 'var(--text-2)' }}>
              {label}
            </span>
            <span style={{ flexGrow: 1, flexBasis: 0, minWidth: 8 }} />
            {theSummary}
          </>
        )}
      </button>
      {open && children}
    </section>
  );
}
