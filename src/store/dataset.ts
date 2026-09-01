/**
 * The dataset: the SRD, and nothing else.
 *
 * It was layered. Optional layers resolved **field by field** over the SRD -
 * highest priority wins a property, and a layer that carried only art and
 * flavour text could not erase anything the SRD already had - so removing one
 * was a pure recompute rather than an undo. There was exactly one source of
 * such a layer, the Core Rulebook importer, and it is gone; version 3 of the
 * database deletes the three stores it wrote, so there is nothing left to
 * compose and no way to write one again.
 *
 * The merge survived the importer by one step on purpose. Deleting the write
 * half while a device still held the read half's input would have been the
 * difference between removing a feature and abandoning its data, and the
 * stores are the device's, not this file's. Now that the migration takes them,
 * keeping the resolver would be the other half of the same dishonesty: a
 * function that can be proven to return its argument, sitting where a reader
 * would look to find out how the dataset is composed.
 *
 * What it took with it, for anyone reading a page stamp and wondering: an
 * overlay's `sourcePage` overwrote the SRD's unconditionally, so a device that
 * had imported printed Core Rulebook folios under the hardcoded `SRD 1.0`
 * label the reference screens draw. That was the stamp claiming a provenance
 * it did not have, which is the one thing `srdReference.ts` says it must never
 * do. The migration ends it.
 *
 * `Dataset.layers` stays, and is not this file's to remove: it is written by
 * the SRD build into `data/srd-1.0.json`, it names the SRD's own revision, and
 * it is part of `SCHEMA_VERSION`. Taking it out is a dataset rebuild and a
 * schema bump, which is a different change from removing an importer.
 */
import srd from '../../data/srd-2.0.json';
import type { Dataset } from '../../shared/types.ts';
import { indexDataset, type DatasetIndex } from '../engine/character.ts';

export const baseDataset = srd as unknown as Dataset;

/**
 * The book's own name for itself, for the provenance stamp beside every folio
 * this app quotes.
 *
 * ## This existed as the literal string `'SRD 1.0'`, nineteen times
 *
 * `ReferenceTables.tsx` alone carried eight of them, and `RuleSearch.tsx`,
 * `SessionBody.tsx` (2), `Wizard.tsx` (2), `Merchant.tsx` (2), `Countdowns.tsx`,
 * `FearPool.tsx`, `DeathMove.tsx` and `Conditions.tsx` the rest - each one
 * beside a `sourcePage` READ FROM THE DATASET. So the moment the shipped
 * dataset became SRD 2.0, every one of them drew `SRD 1.0 · P.95` over folio 95
 * OF A DIFFERENT BOOK. Nine of `tests/gm/reference.test.tsx`'s checks and five
 * of `tests/gm/ruleSearch.test.tsx`'s went red on it, which is the only reason
 * it was found: a grep for `srd-1.0` does not find `SRD 1.0`.
 *
 * That is precisely the defect the docblock above this file records having
 * removed once already - "the stamp claiming a provenance it did not have,
 * which is the one thing `srdReference.ts` says it must never do" - and it is
 * an attribution claim, not a cosmetic one. `srdReference.ts`'s header stakes
 * the licence position on the stamp being checkable against the named book.
 *
 * Read off `layers[0]`, which `tools/build-srd.ts` writes from the BOOK's own
 * `label`, so it moves with the dataset and cannot be edited apart from it.
 * `?? 'SRD'` is the honest degenerate answer for a dataset with no layer: a
 * book with no name still has pages, and stamping a name nobody wrote would be
 * the same lie in a new place.
 */
export const SRD_LABEL: string = baseDataset.layers[0]?.label ?? 'SRD';

/**
 * `SRD 2.0 · P.95`, or just `SRD 2.0` when the record carries no folio.
 *
 * `null` and `undefined` are both the no-folio answer because the dataset uses
 * both: `RulesSection.sourcePage` is `number | null` and the `Sourced` records
 * declare `sourcePage?: number`. A caller that had to remember which would
 * eventually print `P.undefined`.
 */
export const srdStamp = (page: number | null | undefined): string =>
  page === null || page === undefined ? SRD_LABEL : `${SRD_LABEL} · P.${String(page)}`;

export interface ResolvedDataset {
  dataset: Dataset;
  index: DatasetIndex;
}

/**
 * The dataset for this device.
 *
 * Synchronous, and that is the point rather than an optimisation: it reads no
 * storage, so it cannot be slow, cannot fail and cannot be raced. `state.ts`
 * used to await it behind the same eight-second deadline it gives the library,
 * with a catch that fell back to the SRD - a fallback whose value was already
 * equal to the success case for every device that had not imported.
 */
export function loadDataset(): ResolvedDataset {
  return { dataset: baseDataset, index: indexDataset(baseDataset) };
}
