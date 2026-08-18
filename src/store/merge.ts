/**
 * What to do when a character arrives and one with that id is already here.
 *
 * There was no answer to this question. `importCharacter` was an unconditional
 * `db.putCharacter`, and IndexedDB's `put` is keyed on `id` - so restoring an
 * August backup **overwrote the September character in place**, with no prompt,
 * no undo and no history. The hint beside the button encouraged it and never
 * mentioned that a newer local copy was destroyed. For contrast, deleting
 * *one* character requires arm-then-confirm with a full inventory of what is
 * lost; overwriting the whole library took one tap.
 *
 * The rule itself already existed and was already tested, inside a
 * `restoreFromText` that nothing called, in a module whose other exports were
 * used every day. It lives here now, with one implementation and one caller -
 * the store's import, which every screen goes through - rather than a rule in
 * one place and an unconditional `put` in three others.
 *
 * The comparison is `updatedAt`, which is a wall clock on whichever device
 * wrote it. Two devices with skewed clocks can disagree about which copy is
 * newer, which is why the answer to "the local one is newer" is a question put
 * to the user rather than a decision taken for them.
 */
import type { Character } from '../../shared/types.ts';
import { CHARACTER_NAMES, freeName } from './names.ts';

export type MergeMode = 'merge' | 'replace';

export type MergeDecision =
  /** Nothing here by that id: write it. */
  | 'import'
  /** Here, and older than what arrived: write it. */
  | 'replace'
  /**
   * Here, and the same age or newer. Nothing is written.
   *
   * The two callers label this differently and mean the same thing: a library
   * restore reports it as "skipped", and a single-character import turns it
   * into a question. Neither one overwrites.
   */
  | 'keep-local';

export function decideImport(
  incoming: Character,
  local: Character | undefined,
  mode: MergeMode = 'merge',
): MergeDecision {
  if (local === undefined) return 'import';
  if (mode === 'replace') return 'replace';
  // `>=` and not `>`: equal timestamps mean the same edit, and writing over a
  // record with a copy of itself is churn that the debounce would then
  // replicate into the next backup.
  return local.updatedAt >= incoming.updatedAt ? 'keep-local' : 'replace';
}

/** What the user may do about a `keep-local`. */
export type ImportChoice =
  /** Leave this device alone. The default, and what has already happened. */
  | 'keep-mine'
  /** Overwrite with the copy that arrived. */
  | 'take-theirs'
  /** Keep both, the arriving one under a new id. */
  | 'keep-both';

/**
 * A copy of an arriving character that cannot collide with the local one.
 *
 * The name changes as well as the id, and that is deliberate rather than
 * tidy-mindedness: the character picker in the header is a `<select>` of names,
 * so two characters called "Ilya" would be indistinguishable at exactly the
 * moment the user most needs to tell them apart. The suffix counts up, so
 * doing this twice does not produce two identical names either.
 *
 * The rule itself is no longer written here. It lives in `names.ts`, because
 * this was one of its doors and the others - a person typing a new name on the
 * sheet, the wizard, MENU's campaign list - had no guard at all or had a
 * different one. What was written here could not have served them anyway: it
 * compared `new Set(taken.map((c) => c.name))`, raw stored strings, so "ilya",
 * " Ilya" and two characters both stored as `''` were three collisions it could
 * not see.
 *
 * One consequence worth naming, because it is a change to what this function
 * writes and not only to what it compares: the base is now the *spoken* name,
 * so a character arriving as `'  Ilya  '` produces `'Ilya (imported)'` rather
 * than `'  Ilya   (imported)'`. This function was already minting the name -
 * that is its whole job - and the string it minted before rendered identically
 * to this one in every place the app draws it, while sorting and comparing
 * differently everywhere else.
 *
 * `createdAt` moves to now because this copy is new on this device, while
 * `updatedAt` is left alone: it is a fact about when the *sheet* was last
 * edited, and rewriting it would make the arriving copy look newer than the
 * one it was just judged against.
 */
export function duplicateFor(
  incoming: Character,
  taken: readonly Character[],
  now: Date = new Date(),
): Character {
  return {
    ...incoming,
    id: crypto.randomUUID(),
    name: freeName(incoming.name, taken, CHARACTER_NAMES, { suffix: 'imported' }),
    createdAt: now.toISOString(),
  };
}
