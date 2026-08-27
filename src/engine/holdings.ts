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
 * **What moved it has since been removed, and that is worth saying rather than
 * leaving to be inferred from the git log.** The search screen briefly narrowed
 * its results to one character's own material and needed this walk; importing
 * it from the codec put 33.83 kB of QR machinery behind a screen that wanted
 * twenty-five lines of it, so it came here. The owner then made that search
 * global, and `holdingsOf` - the set-shaped wrapper this file also carried -
 * went with it.
 *
 * The walk stays here anyway, and not out of inertia. The reason it does not
 * belong in the codec never depended on who the second caller was: it reads a
 * `Character` and returns `Ref`s, and it knows nothing about frames,
 * registries or encoding. `codec.ts` re-exports the name, so its own callers
 * and tests never saw the move either way.
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
