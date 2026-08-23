/**
 * Every feature a character actually has, in the order they were acquired.
 *
 * WHY IT IS IN THE ENGINE AND NOT IN A SCREEN. This was `collectFeatures`
 * inside `src/ui/print/sheetModel.ts`, and for as long as it lived there the
 * printed sheet was the ONLY place a player could read their own ancestry,
 * community, class or subclass features after character creation. The Play
 * screen showed names and no feature text at all - not the class's Hope
 * feature, not Simiah's Nimble, not even the `feature` string on the armour
 * they were wearing - which is what the owner reported: «La pagina di play deve
 * avere tutte le caratteristiche di origine e classe.»
 *
 * Two screens needed the same list, so the list moved to where both can reach
 * it. There is a second reason and it is the stronger one: `modifiers.ts`
 * decides which ancestry SLOT a bonus sits in, and this file decides which
 * ancestry slot a printed feature sits in. Those two answers have to be the
 * same answer - a sheet that prints Nimble but does not count it, or counts it
 * without printing it, is a sheet disagreeing with itself - so they are now
 * neighbours with one rule between them.
 *
 * `.ts` and not `.tsx`, deliberately: `tests/ui/screens.test.tsx` derives a
 * fixture requirement from PascalCase exports in `.tsx` files, and this exports
 * no component.
 */
import type { Ancestry, CharClass, Character, Community, Ref, Subclass } from '../../shared/types.ts';
import type { DatasetIndex } from './character.ts';

/**
 * Where a feature came from, at the granularity the sheet groups by.
 *
 * Finer than the printed `source` string, which is prose. A screen that wants
 * to draw the ancestry features together and the subclass features together
 * needs a key, and a key parsed back out of `"School of War · Mastery"` is a
 * string rule waiting to be wrong about a subclass with a `·` in its name.
 */
export type FeatureSite =
  | 'class'
  | 'class-hope'
  | 'multiclass'
  | 'subclass-foundation'
  | 'subclass-specialization'
  | 'subclass-mastery'
  | 'ancestry'
  | 'community';

export interface HeldFeature {
  site: FeatureSite;
  /** The dataset ref that granted it - the ancestry, the subclass, the class. */
  ref: Ref;
  /** Where it came from, in the sheet's own words: `School of War · Mastery`. */
  source: string;
  name: string;
  /** Rules text, verbatim. Rendered, never executed. */
  text: string;
}

export interface HeldFeatures {
  /**
   * The class's Hope feature, kept apart from the rest.
   *
   * The printed sheet puts it beside the Hope track, where it is actually read,
   * and printing it in both places would be the same feature twice on a page
   * that is already tight. A screen with more room may draw it at the head of
   * the list instead - it is handed over separately so that each surface can
   * decide, rather than one of them having to filter it back out by name.
   */
  hopeFeature: HeldFeature | null;
  features: HeldFeature[];
}

/**
 * What this character holds, resolved against the dataset.
 *
 * Which subclass cards are held is read out of `levelUpHistory` rather than
 * inferred from the level: the advancement that takes a Specialization is a
 * choice, and a character who spent those two slots elsewhere does not have the
 * card. A mixed ancestry takes the first feature of the first ancestry and the
 * second of the second, which is the SRD's own wording for it - and is the rule
 * `modifiers.ts` gates Simiah's Nimble on.
 */
export function characterFeatures(c: Character, index: DatasetIndex): HeldFeatures {
  const out: HeldFeature[] = [];
  const push = (
    site: FeatureSite,
    ref: Ref,
    source: string,
    list: ReadonlyArray<{ name: string; text: string }>,
  ): void => {
    for (const f of list) out.push({ site, ref, source, name: f.name, text: f.text });
  };

  const klass: CharClass | undefined = index.classes.get(c.classRef);
  const multiclass: CharClass | undefined =
    c.multiclassRef === null ? undefined : index.classes.get(c.multiclassRef);

  if (klass) push('class', klass.id, klass.name, klass.classFeatures);
  // Multiclassing grants the second class's class feature, not its Hope one.
  if (multiclass) push('multiclass', multiclass.id, `${multiclass.name} · Multiclass`, multiclass.classFeatures);

  const subclasses = c.subclassRefs
    .map((r) => index.subclasses.get(r))
    .filter((s): s is Subclass => s !== undefined);
  for (const sub of subclasses) {
    const cards = new Set(
      c.levelUpHistory
        .filter((h) => h.kind === 'subclass' && h.detail['subclassRef'] === sub.id)
        .map((h) => String(h.detail['card'] ?? '')),
    );
    push('subclass-foundation', sub.id, `${sub.name} · Foundation`, sub.foundationFeatures);
    if (cards.has('specialization')) {
      push('subclass-specialization', sub.id, `${sub.name} · Specialization`, sub.specializationFeatures);
    }
    if (cards.has('mastery')) {
      push('subclass-mastery', sub.id, `${sub.name} · Mastery`, sub.masteryFeatures);
    }
  }

  const ancestries = c.ancestryRefs
    .map((r) => index.byRef.get(r) as Ancestry | undefined)
    .filter((a): a is Ancestry => a !== undefined);
  if (ancestries.length === 1) {
    push('ancestry', ancestries[0]!.id, ancestries[0]!.name, ancestries[0]!.features);
  } else if (ancestries.length > 1) {
    const [top, bottom] = ancestries;
    if (top?.features[0]) push('ancestry', top.id, `${top.name} · Mixed`, [top.features[0]]);
    if (bottom?.features[1]) push('ancestry', bottom.id, `${bottom.name} · Mixed`, [bottom.features[1]]);
  }

  const community = index.byRef.get(c.communityRef ?? '') as Community | undefined;
  if (community) push('community', community.id, community.name, [community.feature]);

  const hopeFeature: HeldFeature | null = klass
    ? {
        site: 'class-hope',
        ref: klass.id,
        source: klass.name,
        name: klass.hopeFeature.name,
        text: klass.hopeFeature.text,
      }
    : null;

  return { hopeFeature, features: out };
}
