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
import srd from '../../data/srd-1.0.json';
import type { Dataset } from '../../shared/types.ts';
import { indexDataset, type DatasetIndex } from '../engine/character.ts';

export const baseDataset = srd as unknown as Dataset;

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
