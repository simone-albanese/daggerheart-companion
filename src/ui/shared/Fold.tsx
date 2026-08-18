/**
 * A section that folds away and forgets it did.
 *
 * `Disclosure` beside this is the same gesture with a memory: it keys its open
 * state on `<characterId>:<id>` and writes it into `prefs.playSections`, which
 * that field's own doc comment defines as *the Play screen's per-character
 * folds*. Neither half of that key exists here. The GM screen has no character,
 * and a rules reference is nobody's sheet - storing its folds under `'none:'`
 * would put a growing set of keys nothing ever reads into a preferences record
 * that is written to disk, to remember whether a table was open last Tuesday.
 *
 * So the state is a local `useState` and the fold opens shut every time. That
 * is the right default for what goes in these: something you consult, act on,
 * and close. `Disclosure` remembers because a player arranges their sheet once
 * and comes back to it; nobody arranges a lookup.
 *
 * Everything else is `Disclosure`'s contract, deliberately, because the two
 * appear on screens the same person uses:
 *
 *   - the whole header is the target, 44px tall and the full width of the
 *     column. **That is Fold's own shape, not a quotation of Disclosure's any
 *     more.** This bullet used to read as both, and since the reflow paired
 *     four of `Disclosure`'s six folds two-up it is true of only two of them:
 *     the paired headers are 181.5px at 393 and 165 at 360, which is under half
 *     a column and smaller than ROLL on both axes. `Fold` has no `stacked`, its
 *     button is `width: '100%'`, and it is drawn one to a row - so the sentence
 *     survives here and had to be qualified there. Attributing it to
 *     `Disclosure` whole is the half that went false;
 *   - `summary` is drawn open and closed alike, so opening a section never
 *     changes what its header claimed;
 *   - the marker is a rotated triangle rather than a font glyph, because the
 *     arrow characters in the two families this app ships sit on different
 *     baselines and a marker that jumps three pixels reads as the row moving.
 */
import { useState } from 'react';

export function Fold({
  label,
  summary,
  defaultOpen = false,
  children,
}: {
  label: string;
  /** Drawn open and closed alike. Say what is inside, not how much of it. */
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
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
