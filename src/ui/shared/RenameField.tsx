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
 * IT HAD TWO DOORS AND IT HAS ONE AGAIN, WHICH IS WORTH SAYING OUT LOUD.
 * P5-1(b) put the second door on the Play sheet - a 72x44 RENAME chip on the
 * class row - and the reflow's decision 1 deleted it, because 72px plus an 8px
 * gutter of that row's width and one fewer permanent target on the screen that
 * is open ninety per cent of the time were judged worth more than taking the
 * rename from four gestures to nought. So the paragraph above is in force
 * again, for every layout: `Edit.tsx`'s Identity section is the only way in.
 * The rule this component enforces is not restated here: `judgeName` in
 * `src/store/names.ts` is the single definition of "the same name" and the
 * single source of the words a refusal uses, and this component's whole job is
 * to put that definition in front of a person before they commit rather than
 * after. The wizard's name step and MENU's campaign rename ask the same
 * function and print the same sentence through the same `NameRefusal`.
 *
 * TWO THINGS LOST THEIR PRODUCTION CALLER WITH THAT CHIP AND ONLY ONE WENT WITH
 * IT. `autoFocus` is deleted: Play was its only caller - it existed because a
 * chip had already been tapped to open the field - and focusing this field on
 * arrival at the Build form is the exact failure the backlog bullet forbids, so
 * nothing was left for it to do. `onDone`, and the `×` it draws, are still here
 * and are still exercised: `rename.test.tsx` mounts this component directly
 * through them, and they carry its whole coverage of the cancel path and of the
 * refusal offer. Kept deliberately and named here rather than left to be
 * discovered - the shape any future in-place door needs is this one, and
 * deleting it would delete the tests that prove the naming rule with it.
 *
 * Three things it deliberately does not do.
 *
 *   It never writes on a keystroke. The Name field in `Edit.tsx`'s Identity
 *   section did - `onChange={(name) => patch({ name })}`, where the
 *   `<RenameField>` call now stands - which stamps `updatedAt` once per
 *   character typed, and `updatedAt` is what `decideImport` compares: twenty
 *   stamps make the local copy win twenty comparisons against a sheet that is
 *   genuinely newer. It also makes "that name is taken" fire in the middle of
 *   a word.
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
import { CHARACTER_NAMES, judgeName } from '../../store/names.ts';
import { useActive, useApp } from '../../store/state.ts';
import { NameRefusal } from './NameRefusal.tsx';

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
  commitOnBlur = false,
  onDone,
}: {
  /**
   * A visible caption, for the Build form where every field has one. A caller
   * that replaces a row already saying what it is passes none.
   */
  label?: string;
  /**
   * Commit when the field loses focus.
   *
   * Build passes it and it is the only production caller, so this reads as a
   * flat "yes" today - but it is a prop rather than the behaviour because the
   * two shapes genuinely differ, and the difference is whether a blur can be
   * read rather than whether typing can be lost. Typing can be lost either
   * way: a screen that unmounts with a draft in the field drops it. What Build
   * has is an unambiguous blur - it draws no cancel target, so every way out of
   * the field is a way out of the screen and there is nothing a commit could
   * contradict. Any caller that passes `onDone` gets a `×`, and a `×` is a blur
   * before it is a click, so committing on blur there would write the name the
   * `×` exists to abandon.
   *
   * The other half of Build's case is the company it keeps: every neighbouring
   * field on that form writes on the keystroke, so a Name that took SAVE and
   * nothing else would be the one field there that drops a half-typed value on
   * a tab tap.
   */
  commitOnBlur?: boolean;
  /**
   * Draws the cancel target and is called after a commit.
   *
   * No production caller since the Play chip went - Build passes neither this
   * nor a cancel - and `rename.test.tsx` mounts this component through it. See
   * the docblock above for why it is kept rather than deleted with `autoFocus`.
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
  // The rule, the sentence and the offer, all three from `names.ts`. What is
  // decided here is only where they go: `NameRefusal` carries the sentence in a
  // live region the field points at with `aria-describedby`, plus `aria-invalid`
  // wired the way `settings/parts.tsx:191` wires its hints, so the state and
  // the reason belong to the control being refused.
  //
  // SAVE keeps the reason in its accessible name as well, because touch
  // exploration and a screen reader's browse mode do reach a disabled control.
  // That is a second copy for the readers who get there, not the mitigation -
  // `NameRefusal`'s docblock has the whole argument.
  const { refusal, offer } = judgeName(draft, characters, CHARACTER_NAMES, character.id);

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
    // No `gap` on the stack: `NameRefusal` is mounted whether or not anything is
    // being refused, so a gap here would cost 6px of the sheet permanently, on a
    // row whose whole ergonomic argument is that arming the rename moves
    // nothing. The region carries the 6px itself, when it has something in it.
    <div className="stack">
      <div className="row" style={{ gap: 6 }}>
        <label className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {label !== undefined && <span className="t-label">{label}</span>}
          {/*
           * The keyboard is told to keep its hands off, because it is the one
           * route by which this field could break its own rule.
           *
           * "It never silently rewrites what was typed" is enforced above
           * against the app: the guard refuses and offers, it does not
           * substitute. None of that reaches iOS, which substitutes a
           * dictionary word for a fantasy name on the space or on blur - the
           * player types "Thren" and the record says "Then" - and does it after
           * the character is on the glass, which is what makes it silent. So
           * `autoCorrect` and `spellCheck` are off, and `autoComplete` with
           * them: a field whose accessible name is "Character name" is exactly
           * what a browser offers to fill with the person's own. This is the
           * same pair `settings/About.tsx:307-308` puts on the ERASE
           * confirmation, the other input in this app where the string typed is
           * the whole point of the control.
           *
           * `autoCapitalize` is set rather than removed, and set to `words`
           * rather than `off`, because it is the one of the four that never
           * replaces a character already typed: it is the shift state a virtual
           * keyboard opens in, watched by the person pressing the next key. A
           * name field wants it, and the default on iOS - `sentences` - only
           * offers it for the first word of two.
           */}
          <input
            type="text"
            aria-label="Character name"
            value={draft}
            maxLength={MAX_NAME}
            placeholder="Unnamed"
            aria-invalid={refusal !== null}
            aria-describedby={refusal === null ? undefined : refusalId}
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="words"
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
      <NameRefusal id={refusalId} refusal={refusal} offer={offer} onTake={setDraft} />
    </div>
  );
}
