/**
 * What "the same name" means, once, for everything on this device that has one.
 *
 * ## Why this module exists at all
 *
 * The rule was written for characters, in `merge.ts`, and it was written there
 * because that was the door it was first needed at: two characters called
 * "Ilya" are indistinguishable in the header's `<select>` at exactly the moment
 * you most need to tell them apart. The same sentence is true of the campaign
 * list in MENU, of the wizard, and of a file arriving from another device - and
 * each of those doors had grown its own answer, or none:
 *
 *   the character rename    the rule, enforced, with an offer beside it
 *   `duplicateFor`          the rule, enforced, on the keep-both copy
 *   the creation wizard     nothing at all; a second Ilya was one tap away
 *   a plain import          `id` compared and the name never looked at
 *   the campaign rename     a *different* rule, in different words: any empty
 *                           name refused, any duplicate allowed
 *   NEW CAMPAIGN            two taps, two campaigns, both "My campaign"
 *
 * Six doors, three answers, and no two of them refusing the same things in the
 * same words. That is what this file is for. The doors keep their own
 * ergonomics - a wizard blocks a step, a rename disables a button, an import
 * mints a name and says so - but every one of them asks *this* module what the
 * name means and takes the sentence from here, so a change to the rule reaches
 * all of them and there is nothing left to drift.
 *
 * ## The one thing that is parameterised, and the one thing that is not
 *
 * `NameKind` carries the noun a refusal uses and the word the screens already
 * print where a name is missing. Nothing else varies: the comparison, the
 * counting-up of a free name and the shape of the two sentences are the same
 * for a character as for a campaign, because the failure is the same failure -
 * a list with two rows in it that a person cannot tell apart.
 */

/** Anything on this device that a person names and then has to pick out of a list. */
export interface Named {
  readonly id: string;
  readonly name: string;
}

/**
 * The two words a refusal needs, and the only thing that differs by kind.
 *
 * `unnamed` is not decoration: it is what the screens *already* print where a
 * name is missing - thirteen sites do `character.name || 'Unnamed'`, and MENU
 * and the GM top bar both draw "Unnamed campaign". So for two records both
 * stored as `''` it is the name, and it is the same name twice.
 */
export interface NameKind {
  /** The noun a refusal uses: "Another **character** is already called…". */
  readonly noun: string;
  /** What a record with no name reads as, everywhere this app draws it. */
  readonly unnamed: string;
}

export const CHARACTER_NAMES: NameKind = { noun: 'character', unnamed: 'Unnamed' };
export const CAMPAIGN_NAMES: NameKind = { noun: 'campaign', unnamed: 'Unnamed campaign' };

/**
 * The name as the app speaks it, rather than the string it happens to store.
 *
 * Trimmed, runs of whitespace collapsed, and empty read as `kind.unnamed`.
 * Every one of those three is a difference the *screen* cannot show. The
 * character picker is a `<select>` at 13px and `min(150px, 38vw)`; HTML
 * collapses a doubled space before it ever reaches the glass, a leading space
 * is invisible against the option's own padding, and an empty name is drawn as
 * the word above. A rule that compares stored strings therefore lets through
 * exactly the collisions the rule exists to prevent.
 */
export function spokenName(name: string, kind: NameKind): string {
  const collapsed = name.trim().replace(/\s+/g, ' ');
  return collapsed === '' ? kind.unnamed : collapsed;
}

/**
 * `spokenName`, case-folded. Two records collide when their keys are equal.
 *
 * This is the single definition of "the same name" in this app, and it stays
 * private on purpose. The defect this module closes is one rule enforced at
 * some of its doors and not others; a second definition somewhere else would be
 * the same defect with better manners.
 */
function nameKey(name: string, kind: NameKind): string {
  return spokenName(name, kind).toLowerCase();
}

/**
 * Who else already answers to this name, or `undefined` when nobody does.
 *
 * It returns the record rather than a boolean because a refusal has to name
 * them. "That name is taken", with no owner, is the app knowing something the
 * person reading the screen cannot - and the one it names may be a character
 * they had forgotten they still had, or a table they have not opened in months.
 *
 * `except` is the record being renamed. Without it every rename would collide
 * with itself and SAVE could never be pressed.
 */
export function nameHolder<T extends Named>(
  name: string,
  taken: readonly T[],
  kind: NameKind,
  except?: string,
): T | undefined {
  const key = nameKey(name, kind);
  return taken.find((c) => c.id !== except && nameKey(c.name, kind) === key);
}

/**
 * The first name in this base's sequence that nothing on this device answers to.
 *
 * Two sequences, one counter. With no `suffix` the sequence opens with the base
 * itself - "Ilya", "Ilya (2)", "Ilya (3)" - which is what a person renaming
 * something wants: the nearest free name, and the bare one when it is free.
 * With a suffix the base is never offered - "Ilya (imported)", "Ilya (imported
 * 2)" - because that caller's job is a copy that provably differs from the
 * original, not the nearest free name. That difference is the reason the rename
 * path cannot simply call `duplicateFor`.
 *
 * `except` is only ever passed by a rename door: `duplicateFor` is minting a
 * record that is not in `taken` yet and never needs it, while a rename that did
 * not exclude the record being renamed would offer "Ilya (2)" to something
 * already called Ilya.
 */
export function freeName<T extends Named>(
  base: string,
  taken: readonly T[],
  kind: NameKind,
  options: { except?: string; suffix?: string } = {},
): string {
  const { except, suffix } = options;
  const spoken = spokenName(base, kind);
  const candidate = (n: number): string => {
    if (suffix === undefined) return n === 1 ? spoken : `${spoken} (${String(n)})`;
    return n === 1 ? `${spoken} (${suffix})` : `${spoken} (${suffix} ${String(n)})`;
  };
  for (let n = 1; ; n += 1) {
    const name = candidate(n);
    if (nameHolder(name, taken, kind, except) === undefined) return name;
  }
}

/** What a door has to say and what it can offer instead. */
export interface NameVerdict<T extends Named> {
  /** Who holds it, or `undefined` when the name is free. */
  holder: T | undefined;
  /** The sentence to put on the screen, or `null` when there is nothing to refuse. */
  refusal: string | null;
  /** The nearest free name, or `null` when nothing is being refused. */
  offer: string | null;
}

/**
 * The rule and the words for it, which is what every typed-name door needs.
 *
 * The two sentences are here rather than at the doors for the reason the whole
 * module is here: MENU used to say *"A campaign needs a name"* while the rename
 * field said *"both would read Unnamed"*, and they were not two wordings of one
 * rule - they were two different rules. A door that composed its own sentence
 * could drift back into that on the next edit even with the comparison shared.
 *
 * The holder is quoted as it is *spoken*, not as it is stored: the sentence
 * exists to point at a row on the screen, and the row reads "Ilya" whether the
 * record says "Ilya" or " Ilya ".
 *
 * Nothing here rewrites anything. A refusal is a sentence plus an offer the
 * person has to press - renaming something and quietly calling it something
 * else is the honesty rule failing on the one string the user chose personally.
 */
export function judgeName<T extends Named>(
  name: string,
  taken: readonly T[],
  kind: NameKind,
  except?: string,
): NameVerdict<T> {
  const holder = nameHolder(name, taken, kind, except);
  if (holder === undefined) return { holder: undefined, refusal: null, offer: null };
  const refusal =
    name.trim() === ''
      ? `Another ${kind.noun} already reads "${kind.unnamed}", so both would read "${kind.unnamed}".`
      : `Another ${kind.noun} is already called "${spokenName(holder.name, kind)}".`;
  return { holder, refusal, offer: freeName(name, taken, kind, { except }) };
}
