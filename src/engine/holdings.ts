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
import type { DatasetIndex } from './character.ts';

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
  /*
   * The transformation card, which is a reference like any other HERE and is
   * not one to `Registry.idOf`.
   *
   * This walk answers "what does this sheet name?" and the honest answer
   * includes the card. What it does not do - and must not be read as doing -
   * is say which collection a name belongs to: it returns bare slugs, and SRD
   * 2.0 prints `vampire` twice (adversary folio 142, card folio 45). The one
   * caller that turns these into ids, `missingSlugs`, checks this field a
   * second time through `Registry.idIn('transformations', ...)` for exactly
   * that reason, because the bare lookup would answer with the adversary's id
   * and report a card the registry has never seen as present.
   */
  add(c.transformationRef);
  /*
   * The stances, for the same reason and with the same caveat: this walk
   * answers "what does this sheet name?", and the names it returns are bare
   * slugs that say nothing about which collection they belong to.
   * `missingSlugs` asks them a second time through
   * `Registry.idIn('stances', ...)`, because that is how the encoder writes
   * them.
   */
  c.stanceRefs.forEach(add);
  add(c.multiclassRef);
  c.loadout.forEach(add);
  c.vault.forEach(add);
  add(c.activePrimaryWeapon);
  add(c.activeSecondaryWeapon);
  add(c.activeArmor);
  for (const entry of c.inventory) add(entry.ref);
  if (c.beastform !== null) add(c.beastform.ref);
  for (const choice of c.levelUpHistory) {
    // The exchange's two cards ride here too, and a ref this walk misses is a
    // ref the QR pre-flight says nothing about - `encodeCharacter` then throws
    // `UnknownSlugError` on a sheet `missingSlugs` called sendable.
    for (const key of ['cardRef', 'subclassRef', 'classRef', 'fromRef', 'toRef'] as const) {
      const value = choice.detail[key];
      if (typeof value === 'string') add(value);
    }
  }
  return out;
}

/**
 * Which of the two weapon slots holds a ref this build cannot name.
 *
 * ## Why this exists at all, and why it is two fields and not one
 *
 * `deriveStats` already carries `unresolvedArmor` out with the stats, and every
 * screen that would otherwise print the unarmored ladder as though it were this
 * character's reads it: `Play` draws `ARMOR NOT IN THIS BUILD` in the defence
 * band and `Vitals` captions the HP ladder with it. A weapon had no such thing.
 * `Play` and `Edit` both did `index.weapons.get(ref)`, got `undefined`, and
 * drew the empty state - so a sheet holding a weapon this bundle does not print
 * showed no row, and an Edit slot inviting the player to "Search 391 weapons"
 * as though the slot had always been empty. Measured, not argued:
 * `tests/ui/weapons-vanish.test.tsx`.
 *
 * It is a `{ primary, secondary }` PAIR and not a single ref, and that shape is
 * the point. There are two weapon fields, they fail identically, and a caller
 * handed one ref would cover one slot and leave the other exactly as silent as
 * it is today - the half-repair this codebase has been bitten by before.
 * Destructuring this forces the caller to say what it does about both.
 *
 * ## Why it is not a `DerivedStats` field like `unresolvedArmor` is
 *
 * `unresolvedArmor` is on the stats because the ENGINE needs it: with the armor
 * unknown, `thresholds` falls back to the unarmored ladder and `armorScore` has
 * to carry the sheet's own maximum through rather than answer zero, and both of
 * those branches read the ref. A weapon changes no number the engine has to
 * protect - it contributes to the ledger through `collectModifiers`, and a ref
 * that resolves to nothing contributes nothing, which is already the whole of
 * the arithmetic. What is missing is not a number, it is a sentence on a
 * screen, so this is shaped like `missingCardRefs` in `loadout.ts` - the other
 * unresolved-reference fact this app already draws - and not like a stat.
 *
 * Empty strings are refused alongside nulls for the reason `characterRefs`
 * above refuses them: the codec decodes an unreadable ref as `''`, and `''` is
 * an empty slot, not a weapon nobody can name.
 */
export interface UnresolvedWeapons {
  primary: Ref | null;
  secondary: Ref | null;
}

export function unresolvedWeapons(c: Character, index: DatasetIndex): UnresolvedWeapons {
  const missing = (ref: Ref | null): Ref | null =>
    typeof ref === 'string' && ref !== '' && !index.weapons.has(ref) ? ref : null;
  return {
    primary: missing(c.activePrimaryWeapon),
    secondary: missing(c.activeSecondaryWeapon),
  };
}
