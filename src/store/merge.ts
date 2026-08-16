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
 * The word every screen in this app already prints where a name is missing.
 *
 * Thirteen display sites do `character.name || 'Unnamed'`, the header's
 * `<select>` among them. So the string is not a placeholder the comparison can
 * ignore: for two characters both stored as `''` it is the name, and it is the
 * same name twice.
 */
const UNNAMED = 'Unnamed';

/**
 * The name as the app speaks it, rather than the string it happens to store.
 *
 * Trimmed, runs of whitespace collapsed, and empty read as `UNNAMED`. Every
 * one of those three is a difference the *screen* cannot show. The picker is a
 * `<select>` at 13px and `min(150px, 38vw)`; HTML collapses a doubled space
 * before it ever reaches the glass, a leading space is invisible against the
 * option's own padding, and an empty name is drawn as the word above. A rule
 * that compares stored strings therefore lets through exactly the collisions
 * the rule exists to prevent - two rows a person cannot tell apart.
 */
function spokenName(name: string): string {
  const collapsed = name.trim().replace(/\s+/g, ' ');
  return collapsed === '' ? UNNAMED : collapsed;
}

/**
 * `spokenName`, case-folded. Two characters collide when their keys are equal.
 *
 * This is the single definition of "the same name" in this app, and it stays
 * private on purpose. The defect P5-1(b) is about is one rule enforced at one
 * of its doors; a second definition somewhere else would be the same defect
 * with better manners.
 */
function nameKey(name: string): string {
  return spokenName(name).toLowerCase();
}

/**
 * Who else already answers to this name, or `undefined` when nobody does.
 *
 * It returns the character rather than a boolean because a refusal has to name
 * them. "That name is taken", with no owner, is the app knowing something the
 * person reading the screen cannot - and the character it names may be one
 * they had forgotten they still had.
 *
 * `except` is the character being renamed. Without it every rename would
 * collide with itself and SAVE could never be pressed.
 */
function nameHolder(
  name: string,
  taken: readonly Character[],
  except?: string,
): Character | undefined {
  const key = nameKey(name);
  return taken.find((c) => c.id !== except && nameKey(c.name) === key);
}

/**
 * The first name in this base's sequence that nobody on this device answers to.
 *
 * Two sequences, one counter. With no `suffix` the sequence opens with the base
 * itself - "Ilya", "Ilya (2)", "Ilya (3)" - which is what a person renaming a
 * character wants: the nearest free name, and the bare one when it is free.
 * With a suffix the base is never offered - "Ilya (imported)", "Ilya (imported
 * 2)" - because that caller's job is a copy that provably differs from the
 * original, not the nearest free name. That difference is the reason the
 * rename path cannot simply call `duplicateFor`.
 *
 * `except` has no caller in this commit: `duplicateFor` is minting a character
 * that is not in `taken` yet and never needs it. It is here for the second
 * caller, the rename control, which arrives in the next commit and would
 * otherwise be offered "Ilya (2)" for a character already called Ilya.
 */
export function freeName(
  base: string,
  taken: readonly Character[],
  options: { except?: string; suffix?: string } = {},
): string {
  const { except, suffix } = options;
  const spoken = spokenName(base);
  const candidate = (n: number): string => {
    if (suffix === undefined) return n === 1 ? spoken : `${spoken} (${String(n)})`;
    return n === 1 ? `${spoken} (${suffix})` : `${spoken} (${suffix} ${String(n)})`;
  };
  for (let n = 1; ; n += 1) {
    const name = candidate(n);
    if (nameHolder(name, taken, except) === undefined) return name;
  }
}

/**
 * A copy of an arriving character that cannot collide with the local one.
 *
 * The name changes as well as the id, and that is deliberate rather than
 * tidy-mindedness: the character picker in the header is a `<select>` of names,
 * so two characters called "Ilya" would be indistinguishable at exactly the
 * moment the user most needs to tell them apart. The suffix counts up, so
 * doing this twice does not produce two identical names either.
 *
 * The rule itself is no longer written here. It lives in `freeName`, because
 * this was one of its two doors and the other one - a person typing a new name
 * on the sheet - had no guard at all. What was written here could not have
 * served that door anyway: it compared `new Set(taken.map((c) => c.name))`,
 * raw stored strings, so "ilya", " Ilya" and two characters both stored as `''`
 * were three collisions it could not see.
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
    name: freeName(incoming.name, taken, { suffix: 'imported' }),
    createdAt: now.toISOString(),
  };
}
