/**
 * The one control that changes a character's name.
 *
 * Renaming already worked before this existed - `Edit.tsx` had a `LabelledInput`
 * bound to `character.name` - and it was unguarded and unreachable at the same
 * time. Unguarded: `merge.ts` spends a paragraph explaining that two characters
 * called "Ilya" are indistinguishable in the header's `<select>` at exactly the
 * moment you need to tell them apart, and enforced that on the import path
 * only. Rename Marek to Ilya by hand and the app produced precisely the state
 * that paragraph prevents when a file arrives. Unreachable: the field sat in
 * the Identity section of the Build tab's edit screen, below a header, a
 * level-up button and six derived stats, four gestures deep in the tab visited
 * least - for the first field on the paper sheet and the most-shown string in
 * the app.
 *
 * So there is one control and two doors, rather than two implementations. The
 * rule it enforces is not restated here: `freeName` and `nameHolder` in
 * `src/store/merge.ts` are the single definition of "the same name", and this
 * component's whole job is to put that definition in front of a person before
 * they commit rather than after.
 *
 * Three things it deliberately does not do.
 *
 *   It never writes on a keystroke. `Edit.tsx:115` did - `onChange={(name) =>
 *   patch({ name })}` - which stamps `updatedAt` once per character typed, and
 *   `updatedAt` is what `decideImport` compares: twenty stamps make the local
 *   copy win twenty comparisons against a sheet that is genuinely newer. It
 *   also makes "that name is taken" fire in the middle of a word.
 *
 *   It never silently rewrites what was typed. When the name is taken it says
 *   so, names who has it, and *offers* the next free name in a control the
 *   person has to press. Renaming someone and quietly calling them something
 *   else is the honesty rule failing on the one string the user chose
 *   personally.
 *
 *   It never writes the word "Unnamed" onto a record. Clearing the field
 *   stores `''`, which thirteen display sites already read as "Unnamed". The
 *   guard is strictly stricter than the write: it refuses an empty name when
 *   somebody else is already showing as "Unnamed", and otherwise stores the
 *   emptiness the person asked for rather than a word they did not type.
 */
import { useId, useState } from 'react';
import { freeName, nameHolder } from '../../store/merge.ts';
import { useActive, useApp } from '../../store/state.ts';

/**
 * The cap on a name a person types.
 *
 * The header's single-character span is capped at `min(168px, 42vw)`, which at
 * 393px is 165px, and 13px/700 Archivo averages about 7.4px a character - so
 * roughly 22 characters are legible before the ellipsis. Forty is comfortably
 * past that: it bounds the record and the filename `characterFileName`
 * slugifies out of it without truncating a name anyone would actually type.
 * The *offer* may run past it by its own suffix, because that is the app's
 * string and not the user's typing.
 *
 * This is a bound on typing, not on the record. `Character.name` is unchanged
 * and `SCHEMA_VERSION` does not move; a longer name arriving in a file is
 * still a longer name.
 */
const MAX_NAME = 40;

export function RenameField({
  label,
  autoFocus = false,
  commitOnBlur = false,
  onDone,
}: {
  /**
   * A visible caption, for the Build form where every field has one. Play
   * passes none: the field replaces a row that already says what it is.
   */
  label?: string;
  /**
   * Focus the field on mount. True on Play, where a chip has already been
   * tapped to get here; false in Build, where the field is simply part of a
   * form and focusing it would open a keyboard on arrival at the screen.
   */
  autoFocus?: boolean;
  /**
   * Commit when the field loses focus. Build passes this because it has no
   * cancel target and no other way to not lose the typing: tap a tab with a
   * name half-entered and the component unmounts. Play must not, because Play
   * *has* a cancel target - blurring by tapping the `×` would commit the thing
   * the `×` exists to abandon.
   */
  commitOnBlur?: boolean;
  /**
   * Draws the cancel target and is called after a commit. Build passes
   * neither, so Build has no `×`.
   */
  onDone?: () => void;
}): React.JSX.Element | null {
  const character = useActive();
  const characters = useApp((s) => s.characters);
  const update = useApp((s) => s.update);
  const [draft, setDraft] = useState(character?.name ?? '');
  const refusalId = useId();

  if (!character) return null;

  const stored = character.name || 'Unnamed';
  const holder = nameHolder(draft, characters, character.id);
  const blank = draft.trim() === '';
  // The refusal is a sentence, not a dimmed button. `Play.tsx:1082-1085` writes
  // the rule down for the vault's blocked recall and `playSheet.test.tsx:452`
  // pins it: a control that will not act says why in text a thumb can read,
  // because 45% opacity announces nothing at all.
  //
  // Opacity announces nothing to a screen reader either, and putting the reason
  // into the refused control's own accessible name does not answer that on its
  // own: SAVE is `disabled`, so Tab from the field steps straight over the
  // label carrying the reason and lands on the offer - a different name being
  // suggested, with nothing anywhere having said the typed one was refused. So
  // the sentence is carried by the two things that are reachable from where the
  // person actually is, which is the field:
  //
  //   `role="status"`, on a region mounted empty and filled when the name
  //   collides - the pattern `Wizard.tsx:274` uses for the creation wizard's
  //   blocking reason. Mounted empty rather than mounted with the sentence in
  //   it, because a live region has to exist before its contents change for the
  //   change to be spoken.
  //
  //   `aria-describedby` from the field to that region, plus `aria-invalid`,
  //   wired the way `settings/parts.tsx:191` wires its hints. The state and the
  //   reason then belong to the control being refused, for a reader who arrives
  //   at the field after the announcement rather than during it.
  //
  // SAVE keeps the reason in its accessible name because touch exploration and
  // a screen reader's browse mode do reach a disabled control. That is a second
  // copy for the readers who get there, not the mitigation.
  const refusal =
    holder === undefined
      ? null
      : blank
        ? 'Another character already reads "Unnamed", so both would read "Unnamed".'
        : `Another character is already called "${holder.name || 'Unnamed'}".`;
  const offer =
    refusal === null ? null : freeName(draft, characters, { except: character.id });

  const commit = (): void => {
    if (refusal !== null) return;
    // Trimmed, and nothing else. The guard collapses inner runs of space to
    // decide whether two names are the same; the write does not, so "Il  ya"
    // is stored the way it was typed. Being stricter about collisions than
    // about storage is the safe direction: it can refuse a name nobody would
    // have confused, never accept two a person cannot tell apart.
    const next = draft.trim();
    if (next !== character.name) update((c) => ({ ...c, name: next }));
    onDone?.();
  };

  return (
    // No `gap` on the stack. The refusal region below is mounted whether or not
    // anything is being refused - that is what makes it a live region rather
    // than a sentence that appears - so a gap here would cost 6px of the sheet
    // permanently, on a row whose whole ergonomic argument is that arming the
    // rename moves nothing. The region carries the 6px itself, when it has
    // something in it.
    <div className="stack">
      <div className="row" style={{ gap: 6 }}>
        <label className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {label !== undefined && <span className="t-label">{label}</span>}
          <input
            type="text"
            aria-label="Character name"
            value={draft}
            maxLength={MAX_NAME}
            placeholder="Unnamed"
            aria-invalid={refusal !== null}
            aria-describedby={refusal === null ? undefined : refusalId}
            autoFocus={autoFocus}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitOnBlur ? commit : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(character.name);
                onDone?.();
              }
            }}
            style={{ width: '100%', minHeight: 'var(--tap)' }}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={commit}
          disabled={refusal !== null}
          aria-label={refusal === null ? `Save the name ${draft.trim() || 'Unnamed'}` : `Cannot save: ${refusal}`}
          style={{ flex: 'none', minWidth: 62, minHeight: 'var(--tap)', padding: '0 10px' }}
        >
          SAVE
        </button>
        {onDone !== undefined && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onDone}
            aria-label={`Leave the name as ${stored}`}
            style={{ flex: 'none', minWidth: 'var(--tap)', minHeight: 'var(--tap)', padding: 0 }}
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="row"
        style={{
          gap: 8,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginTop: refusal === null ? 0 : 6,
        }}
      >
        <p
          id={refusalId}
          role="status"
          className="t-dense"
          style={{ flex: 1, minWidth: 0, margin: 0 }}
        >
          {refusal}
        </p>
        {refusal !== null && offer !== null && (
          <button
            type="button"
            className="btn"
            onClick={() => setDraft(offer)}
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
    </div>
  );
}
