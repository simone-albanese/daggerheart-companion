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
 * vertically: the header is `minHeight: var(--tap)` around one small line.
 *
 * THAT LINE IS 11px SINCE THE REFLOW, AND CARRIED IS WHY IT IS NOT 11 FOR ALL
 * SIX. A summary inside a 44px touch floor has 34px of headroom doing nothing,
 * so the raise is free down the column - but the 257.41 above is measured at
 * 10, and at 11 it is ~283 with its right edge past 390 in a 369px column. So
 * `Carried` passes `tightSummary` and keeps its 10, which is the difference
 * between a raise and a regression to the very thing the paragraph above
 * describes. See the prop for the arithmetic.
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
  /** The section's one number, shown open and closed alike. */
  summary?: React.ReactNode;
  /**
   * Draw the summary at `.t-meta`'s 10px instead of the 11 every other fold
   * gets, because this one's is the longest on the sheet.
   *
   * The reflow raised these lines by a pixel, and it is free vertically -
   * a 10px line inside a 44px touch floor has 34px of headroom, which is what
   * that headroom was for. It is not free HORIZONTALLY, and exactly one fold
   * proves it: `Carried`'s worst summary, measured in Chrome with the
   * `wizard10` fixture whose purse spans all three denominations, is 257.41px
   * at 10. The row that carries it wants 350.61 of the button's 365px content
   * box - 8 of marker, 53.2 of `CARRIED`, three 8px gaps and the spacer at its
   * 8px minimum - so the slack is **14.39px**, and the summary's own right edge
   * is 379, flush against the column. At 11 the same line is 283.14 and wants
   * 376.34 of that 365, which would land its right edge at 390.34; it
   * ellipsises at the reference width instead, and the gold is the half that
   * goes.
   *
   * FOURTEEN AND NOT FOUR, WHICH THIS SAID FOR TWO PASSES. `364.61` - the
   * number in the paragraph at the top of this file - is where the right edge
   * fell while the span was still `flex: none`, counted from the left of the
   * glass, and it already contains the column's 12px of padding and this
   * button's 2px. Subtracting it from the column's own 369 pays for those 14
   * pixels twice and reports under a third of the room that is there. The two
   * are not comparable: one is an offset and the other is a width.
   *
   * That is the one thing this component exists to prevent, so `Carried` opts
   * back down rather than the raise being abandoned for all six. The exception
   * is a prop and not an `id === 'carried'` branch: this component knows about
   * folds, not about which section of which screen it is drawing.
   */
  tightSummary?: boolean;
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
  tightSummary = false,
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
    // cannot both fit, the section's name is the half that has to survive whole
    // and its number is the half that can lose its tail. See the note at the
    // top of this file for what that was costing at 360 and below. Stacked, the
    // two are on separate lines and this shrinks against the marker instead.
    <span
      className="t-meta"
      style={{
        flex: '0 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--muted)',
        // 11 rather than `.t-meta`'s 10, and inline rather than a new class:
        // `.t-meta` is the app's smallest type and is right at 10 in the twenty
        // other places it is used. This is one line in one component, raised
        // because the reflow's brief was legibility and this line had 34px of
        // unused headroom under it. `tightSummary` is the single measured
        // exception - see the prop.
        fontSize: tightSummary ? undefined : 11,
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
          // rows that happen to be adjacent.
          gap: stacked ? 2 : 8,
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
