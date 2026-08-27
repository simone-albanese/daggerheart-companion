/**
 * What a character carries, as references.
 *
 * ## Why this is not in `transfer/codec.ts`, where it was written
 *
 * `characterRefs` was written for the QR codec - to check a sheet can be
 * encoded before offering to, and to re-resolve parked ids when content
 * arrives - and it lived there for as long as that was its only caller. It is
 * not a transfer concern: it reads `Character` and returns `Ref`s, it knows
 * nothing about frames, registries or encoding, and the question it answers -
 * *what does this sheet name?* - is asked by anything that wants to line a
 * character up against the dataset.
 *
 * The second caller is what moved it, and the cost of leaving it was
 * measurable rather than aesthetic. `src/ui/search/Search.tsx` needs this walk
 * to narrow the SRD search to one player's own material; importing it from the
 * codec put the codec's whole chunk - 33.83 kB, and the QR machinery with it -
 * behind a screen that wants twenty-five lines of it. Here it is its own small
 * module that both sides share, and `codec.ts` re-exports the name so its own
 * callers and tests are untouched.
 */
import type { Character, Ref } from '../../shared/types.ts';
import type { DerivedStats } from './character.ts';

/**
 * Every reference on a character, in one pass.
 *
 * Duplicates are kept: a card can be in the loadout and named again by the
 * level-up choice that granted it, and the callers that care about counts want
 * to see that. `holdingsOf` is the one that wants a set.
 *
 * Empty strings are refused as well as nulls, and that is not defensive
 * dressing. `classRef` is declared non-nullable on `Character`, but the codec
 * decodes it as `refs.read() ?? ''` - so a sheet that arrived with an
 * unreadable class really does carry `''`, and it must not become a lookup.
 */
export function characterRefs(c: Character): Ref[] {
  const out: Ref[] = [];
  const add = (ref: Ref | null | undefined): void => {
    if (typeof ref === 'string' && ref !== '') out.push(ref);
  };
  add(c.classRef);
  c.subclassRefs.forEach(add);
  c.ancestryRefs.forEach(add);
  add(c.communityRef);
  add(c.multiclassRef);
  c.loadout.forEach(add);
  c.vault.forEach(add);
  add(c.activePrimaryWeapon);
  add(c.activeSecondaryWeapon);
  add(c.activeArmor);
  for (const entry of c.inventory) add(entry.ref);
  if (c.beastform !== null) add(c.beastform.ref);
  for (const choice of c.levelUpHistory) {
    for (const key of ['cardRef', 'subclassRef', 'classRef'] as const) {
      const value = choice.detail[key];
      if (typeof value === 'string') add(value);
    }
  }
  return out;
}

/**
 * Everything this character holds, as a set of dataset ids.
 *
 * The domains are added beside the walk because they are the one piece of a
 * character's material that is not stored *on* the character: a class's two
 * domains, plus the multiclass domain if there is one, are computed into
 * `DerivedStats.domains`. `characterRefs` cannot know them and should not be
 * taught to - it takes a `Character` and nothing else.
 *
 * ## What is in here that names nothing, and why that is left alone
 *
 * Three kinds of entry survive into this set without a record behind them, and
 * all three are harmless because of the direction the caller filters in: the
 * index is asked which of *its* records this set names, not the set which
 * records it wants. A reference to something that does not exist selects
 * nothing.
 *
 * - **Free-text inventory** has `ref: null` and never gets in at all.
 * - **Companion upgrade slugs** are minted at runtime from list items inside a
 *   rules section and are not ids of any record; they are not walked here.
 * - **Unresolved refs** - the `?12` placeholders a sheet carries when it
 *   arrived by QR before its content did - do get in, and match nothing. They
 *   are deliberately not filtered with `isUnresolvedRef`: that would put a
 *   `transfer/` import into an engine module to buy a result the caller
 *   already gets for free.
 */
export function holdingsOf(c: Character, stats: DerivedStats): ReadonlySet<Ref> {
  return new Set<Ref>([...characterRefs(c), ...stats.domains]);
}
