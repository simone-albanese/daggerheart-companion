/**
 * The one shape a typed name gets in this app, and the character door onto it.
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
 * Two exports, and the split is the point. `NameField` is the control - a
 * draft, a SAVE, an optional cancel, the keyboard hardening, and the region a
 * refusal lands in. `RenameField` is the character rename wired onto it: the
 * store reads, the naming rule, the words. The split arrived with the GM
 * session row's RENAME, which renames a different record in a different store
 * under a different rule, and could not have called this file at all while the
 * control read `useActive()` for itself.
 *
 * THE CHARACTER RENAME HAD TWO DOORS AND IT HAS ONE AGAIN, WHICH IS WORTH
 * SAYING OUT LOUD. P5-1(b) put the second door on the Play sheet - a 72x44
 * RENAME chip on the class row - and the reflow's decision 1 deleted it,
 * because 72px plus an 8px gutter of that row's width and one fewer permanent
 * target on the screen that is open ninety per cent of the time were judged
 * worth more than taking the rename from four gestures to nought. So the
 * paragraph this file opens with is in force again, for every layout: `Edit.tsx`'s Identity
 * section is the only way to a *character's* name. `SessionRow`'s RENAME is
 * not a second door onto it - it writes a `SessionItem.name` through
 * `patchSessionItem`, and no character store is anywhere near it.
 *
 * The rule the character door enforces is not restated here: `judgeName` in
 * `src/store/names.ts` is the single definition of "the same name" and the
 * single source of the words a refusal uses, and this file's whole job is to
 * put that definition in front of a person before they commit rather than
 * after. The wizard's name step and MENU's campaign rename ask the same
 * function and print the same sentence through the same `NameRefusal`.
 *
 * ONE THING LOST ITS PRODUCTION CALLER WITH THAT CHIP AND HAS SINCE FOUND
 * ANOTHER. `autoFocus` is deleted: Play was its only caller - it existed
 * because a chip had already been tapped to open the field - and focusing this
 * field on arrival at the Build form is the exact failure the backlog bullet
 * forbids, so nothing was left for it to do. `onDone`, and the `✕` it draws,
 * outlived the chip on the strength of `rename.test.tsx`, which mounts the
 * control directly through them and carries its whole coverage of the cancel
 * path and of the refusal offer; the note kept here said "the shape any future
 * in-place door needs is this one". The session row's RENAME is that door, and
 * it passes `onDone` because it can be dismissed without renaming anything.
 *
 * Three things the control deliberately does not do.
 *
 *   It never writes on a keystroke. The Name field in `Edit.tsx`'s Identity
 *   section did - `onChange={(name) => patch({ name })}`, where the
 *   `<RenameField>` call now stands - which stamps `updatedAt` once per
 *   character typed, and `updatedAt` is what `decideImport` compares: twenty
 *   stamps make the local copy win twenty comparisons against a sheet that is
 *   genuinely newer. It also makes "that name is taken" fire in the middle of
 *   a word. The session row has the same shape of cost on the other side of
 *   the app: `patchSessionItem` goes through `commit`, so a keystroke rename
 *   would be one debounced campaign write per letter.
 *
 *   It never silently rewrites what was typed. When a door refuses a name it
 *   says so, names who has it, and *offers* the next free name in a control the
 *   person has to press. Renaming someone and quietly calling them something
 *   else is the honesty rule failing on the one string the user chose
 *   personally.
 *
 *   It never writes a stand-in word onto a record. Clearing the field stores
 *   `''`. For a character that reads as "Unnamed", which thirteen display sites
 *   already produce out of an empty name; for a session row it reads as the
 *   kind word, dimmed, which is `sessionTitle`'s whole promise. Which word an
 *   empty name reads as is therefore the caller's to say - `emptyReads` - and
 *   the control only has to be able to say it, on the placeholder and on the
 *   cancel target, so that clearing the field shows what the record will read
 *   as before anything is committed.
 *
 * `judge` is optional, and its absence is a decision each door makes rather
 * than a default nobody looked at. The character door passes `judgeName`,
 * because two characters called Ilya are one `<select>` a person cannot use.
 * The session row passes none: a night is *expected* to hold rows with no name
 * at all - `AddSheet` mints them that way - and `judgeName`'s empty-name
 * sentence, "Another row already reads Unnamed", would be a sentence about a
 * word that list never prints. With no judge there is nothing that can ever be
 * refused, so `NameRefusal` is not mounted either: an `aria-live` region that
 * can never speak is a promise to a screen reader that nothing keeps.
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
 *
 * The session row takes the same cap rather than growing a second number. Its
 * title is one ellipsised line too, nothing about that row wants a longer name
 * than a character's, and two caps would be two things to keep in step for no
 * gain either of them can point at.
 */
const MAX_NAME = 40;

/** What a door with no rule to enforce gets back, in place of a verdict. */
const NOTHING_REFUSED = { refusal: null, offer: null } as const;

export interface NameFieldProps {
  /** The name as the record holds it. The draft starts here and Escape returns to it. */
  value: string;
  /** The input's accessible name. There is no visible one unless `label` is passed. */
  fieldLabel: string;
  /**
   * What an empty name reads as on screen once it is stored.
   *
   * "Unnamed" for a character, the kind word for a session row. It is the
   * placeholder and it is what the cancel target names, so a person who has
   * just cleared the field can see what the record will read as before they
   * commit it.
   */
  emptyReads: string;
  /** Called with the trimmed name, only when it differs from `value`. */
  onCommit: (name: string) => void;
  /**
   * The rule this door enforces, or none.
   *
   * Absent means nothing can ever be refused - see the docblock, and say why
   * at the call site rather than leaving it off silently.
   */
  judge?: (draft: string) => { refusal: string | null; offer: string | null };
  /**
   * A visible caption, for the Build form where every field has one. A caller
   * that replaces a row already saying what it is passes none.
   */
  label?: string;
  /**
   * What is being renamed, for SAVE's accessible name.
   *
   * The session list draws one row per item and every row can arm its own
   * rename, so two open at once would otherwise offer a screen reader two
   * buttons called "Save the name Marek" - the defect `sessionList.test.tsx`
   * calls "a screen made of similar rows". Build draws exactly one and passes
   * nothing.
   *
   * The cancel target does not take it and does not need it: "Leave the name
   * as Scene one" is followed by the name the list already draws for that row,
   * so it identifies the row by saying what it is for. SAVE names a name the
   * record does not have yet, which is exactly why it has to say whose.
   */
  subject?: string;
  /**
   * Commit when the field loses focus.
   *
   * Build passes it and it is the only caller that does, so this reads as a
   * flat "yes" today - but it is a prop rather than the behaviour because the
   * two shapes genuinely differ, and the difference is whether a blur can be
   * read rather than whether typing can be lost. Typing can be lost either
   * way: a screen that unmounts with a draft in the field drops it. What Build
   * has is an unambiguous blur - it draws no cancel target, so every way out of
   * the field is a way out of the screen and there is nothing a commit could
   * contradict. Any caller that passes `onDone` gets a `✕`, and a `✕` is a blur
   * before it is a click, so committing on blur there would write the name the
   * `✕` exists to abandon.
   *
   * The other half of Build's case is the company it keeps: every neighbouring
   * field on that form writes on the keystroke, so a Name that took SAVE and
   * nothing else would be the one field there that drops a half-typed value on
   * a tab tap.
   */
  commitOnBlur?: boolean;
  /** Draws the cancel target and is called after a commit. */
  onDone?: () => void;
}

export function NameField({
  value,
  fieldLabel,
  emptyReads,
  onCommit,
  judge,
  label,
  subject,
  commitOnBlur = false,
  onDone,
}: NameFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const refusalId = useId();

  const stored = value.trim() || emptyReads;
  const on = subject === undefined ? '' : ` — ${subject}`;
  // The rule, the sentence and the offer all come from the caller's judge - for
  // a character that is `names.ts`, which the wizard and MENU's campaign rename
  // also ask. What is decided here is only where they go: `NameRefusal` carries
  // the sentence in a live region the field points at with `aria-describedby`,
  // plus `aria-invalid` wired the way `settings/parts.tsx:191` wires its hints,
  // so the state and the reason belong to the control being refused.
  //
  // SAVE keeps the reason in its accessible name as well, because touch
  // exploration and a screen reader's browse mode do reach a disabled control.
  // That is a second copy for the readers who get there, not the mitigation -
  // `NameRefusal`'s docblock has the whole argument.
  const { refusal, offer } = judge?.(draft) ?? NOTHING_REFUSED;

  const commit = (): void => {
    if (refusal !== null) return;
    // Trimmed, and nothing else. A guard that collapses inner runs of space to
    // decide whether two names are the same does not make the write collapse
    // them too, so "Il  ya" is stored the way it was typed. Being stricter
    // about collisions than about storage is the safe direction: it can refuse
    // a name nobody would have confused, never accept two a person cannot tell
    // apart.
    const next = draft.trim();
    if (next !== value) onCommit(next);
    onDone?.();
  };

  return (
    // No `gap` on the stack: where there is a rule at all, `NameRefusal` is
    // mounted whether or not anything is being refused - a live region has to
    // exist before its contents change for the change to be spoken - so a gap
    // here would cost 6px of the sheet permanently, on a row whose whole
    // ergonomic argument is that arming the rename moves nothing. The region
    // carries the 6px itself, when it has something in it.
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
            aria-label={fieldLabel}
            value={draft}
            maxLength={MAX_NAME}
            placeholder={emptyReads}
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
                setDraft(value);
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
          aria-label={
            refusal === null
              ? `Save the name ${draft.trim() || emptyReads}${on}`
              : `Cannot save: ${refusal}`
          }
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
      {judge !== undefined && (
        <NameRefusal id={refusalId} refusal={refusal} offer={offer} onTake={setDraft} />
      )}
    </div>
  );
}

/**
 * The character door: the rule, the word an empty name reads as, and the store.
 *
 * Everything a *character* brings to the control is here and nothing else is.
 * `judgeName` is asked with the whole library and the character's own id, so a
 * character can keep its own name; "Unnamed" is the word thirteen display sites
 * already produce for an empty one, and this is the one place that word is
 * handed to a field rather than written onto a record.
 */
export function RenameField({
  label,
  commitOnBlur = false,
  onDone,
}: Pick<NameFieldProps, 'label' | 'commitOnBlur' | 'onDone'>): React.JSX.Element | null {
  const character = useActive();
  const characters = useApp((s) => s.characters);
  const update = useApp((s) => s.update);

  if (!character) return null;

  return (
    <NameField
      value={character.name}
      fieldLabel="Character name"
      emptyReads="Unnamed"
      judge={(draft) => judgeName(draft, characters, CHARACTER_NAMES, character.id)}
      onCommit={(name) => update((c) => ({ ...c, name }))}
      label={label}
      commitOnBlur={commitOnBlur}
      onDone={onDone}
    />
  );
}
