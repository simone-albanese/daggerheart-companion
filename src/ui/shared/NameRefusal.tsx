/**
 * How a refused name looks and what it offers instead - once, for every door.
 *
 * `names.ts` decides what "the same name" means and writes the sentence.
 * This decides how that sentence reaches somebody standing at a keyboard, and
 * it is a component rather than three copies of a `<p>` for the same reason the
 * rule is one module: the character rename put the refusal in a live region
 * with an offer beside it, MENU printed a differently-worded sentence with no
 * offer at all, and the wizard printed nothing. Three doors, three answers to
 * "you cannot have that name".
 *
 * ## Why the sentence is a region that is always mounted
 *
 * The refusal is a sentence, not a dimmed button. The `Vault` docblock in
 * `Play.tsx` writes the rule down as P3-9(a) and `playSheet.test.tsx` pins it:
 * a control that will not act says why in text a thumb can read, because 45%
 * opacity announces nothing at all.
 *
 * Opacity announces nothing to a screen reader either, and putting the reason
 * into the refused control's own accessible name does not answer that on its
 * own: a disabled SAVE is stepped over by Tab, so the next thing a keyboard
 * reaches is the offer - a different name being suggested, with nothing
 * anywhere having said the typed one was refused. So the sentence is carried by
 * something reachable from where the person actually is, which is the field:
 *
 *   `role="status"`, on a region mounted **empty** and filled when the name
 *   collides - the pattern the creation wizard's blocking reasons use. Mounted
 *   empty rather than mounted with the sentence in it, because a live region
 *   has to exist before its contents change for the change to be spoken.
 *
 *   `aria-describedby` from the field to that region, which is the caller's
 *   half: it owns the input, so it passes `id` in and points at it.
 *
 * ## The offer is a control, never a rewrite
 *
 * It puts the free name in the field and stops. Renaming something and quietly
 * calling it something else is the honesty rule failing on the one string the
 * user chose personally - and it is the half of this defect that is easiest to
 * ship by accident, because "just fix it up for them" looks like helpfulness
 * right until somebody's Ilya is silently stored as Ilya (2).
 */

export function NameRefusal({
  id,
  refusal,
  offer,
  onTake,
}: {
  /** The region's id, so the caller's field can `aria-describedby` it. */
  id: string;
  /** The sentence from `judgeName`, or `null` when nothing is refused. */
  refusal: string | null;
  /** The nearest free name, or `null`. */
  offer: string | null;
  /** Put the offer in the field. Never called with anything else. */
  onTake: (name: string) => void;
}): React.JSX.Element {
  return (
    // No `gap` on the caller's stack and `marginTop` here instead: this region
    // is mounted whether or not anything is being refused - that is what makes
    // it a live region rather than a sentence that appears - so a gap above it
    // would cost 6px of every screen that uses it, permanently. It carries the
    // 6px itself, when it has something in it.
    <div
      className="row"
      style={{
        gap: 8,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        marginTop: refusal === null ? 0 : 6,
      }}
    >
      <p id={id} role="status" className="t-dense" style={{ flex: 1, minWidth: 0, margin: 0 }}>
        {refusal}
      </p>
      {refusal !== null && offer !== null && (
        <button
          type="button"
          className="btn"
          onClick={() => onTake(offer)}
          aria-label={`Put ${offer} in the name field`}
          style={{
            flex: 'none',
            minWidth: 104,
            maxWidth: '100%',
            minHeight: 'var(--tap)',
            padding: '6px 10px',
            overflowWrap: 'anywhere',
          }}
        >
          {offer}
        </button>
      )}
    </div>
  );
}
