/**
 * The shell's side gutter, spelled once.
 *
 * Two things paint or sit directly against the left and right edges of the
 * window at every width: this app's `<header>`, and the six shell-chrome blocks
 * `App.tsx` renders inside `<main>` above whichever screen is drawn - the
 * write-failure alert, the storage alert, the integrity alert, the quarantine
 * alert, and `UpdateBanner` and `BackupBanner` through `ShellBanner`. They are
 * meant to share one gutter, and for most of this app's life they did: 20px,
 * hard-coded in both places.
 *
 * Then the header started paying the display cutout and they stopped agreeing.
 * `Header.tsx` documents the cutout at length; the short version is that a
 * notched or Dynamic-Island iPhone held in landscape reports
 * `env(safe-area-inset-left)` and `-right` at the same non-zero value, and the
 * header now insets its contents past that while the six blocks stayed at a
 * flat 20.
 *
 * MEASURED, in Chrome through the audit rig at 852x393 with 59px substituted on
 * both sides, `BackupBanner` up:
 *
 *   - the header's content runs [79, 773]; with the insets at 0 it runs
 *     [20, 832]. It moves, correctly.
 *   - the banner's box is [20, 832] in BOTH runs. It does not move at all, so
 *     its gutter is 59px inside the header's on each side - the two used to line
 *     up and no longer did.
 *   - the cost is not only the misalignment. The right strip starts at 793 and
 *     the banner's dismiss ✕ is a 44x44 target at [781, 825], so **32 of its 44
 *     pixels - 72.7% - sit inside the cutout**, leaving 12px of aimable glass.
 *     That is worse than the SETTINGS casualty the header's own fix was written
 *     for, which kept 15.4. The BACK UP chip at [719.1, 775] clears the strip
 *     and was never the casualty.
 *
 * ## Why a constant and not two literals that happen to match
 *
 * The two gutters have to be the same gutter, and "the same" was being kept by
 * eye across five call sites in two files. `Header.tsx`'s docblock even proposed
 * the repair - and proposed it as a `margin` shorthand, which would have been
 * wrong for the reason the file states thirty lines further down: jsdom drops a
 * shorthand carrying an `env()` **whole**, so `margin: '8px calc(20px + env(...))
 * 0 calc(...)'` would take the 8px top margin down with it in every test and
 * read back as four empty strings. Longhands, therefore, exactly as the header
 * pays its padding.
 *
 * `calc(20px + env(...))` rather than a bare `env()` for the two reasons
 * `TabBar.tsx` established: jsdom keeps the calc form so the suite can assert
 * it, and the audit rig substitutes insets by rewriting inline `style`
 * attributes, so a value hidden behind a custom property in `tokens.css` could
 * never be measured in Chrome again.
 *
 * On every device without a cutout `env()` is 0px and both of these are the bare
 * 20 they have always been. Nothing anybody can see on this machine changes.
 */

/** The left gutter of anything that sits against the window's left edge. */
export const GUTTER_LEFT = 'calc(20px + env(safe-area-inset-left))';

/** The right gutter of anything that sits against the window's right edge. */
export const GUTTER_RIGHT = 'calc(20px + env(safe-area-inset-right))';

/**
 * The margin every shell-chrome block inside `<main>` carries.
 *
 * Was `margin: '8px 20px 0'`, and the top and bottom are unchanged: 8px of air
 * under the header, nothing below, because the block above the next one already
 * pays its own 8.
 */
export const SHELL_BLOCK_MARGIN = {
  marginTop: 8,
  marginRight: GUTTER_RIGHT,
  marginBottom: 0,
  marginLeft: GUTTER_LEFT,
} as const;
