/**
 * The layered dataset.
 *
 * The SRD is always present and ships with the app. Optional layers resolve
 * **field by field** on top of it - the highest priority layer that defines a
 * property wins, and a layer that only carries `art` and `flavorText` cannot
 * erase anything the SRD already had. Removing a layer therefore restores the
 * SRD exactly, with no re-parsing.
 *
 * There was exactly one source of such a layer, the Core Rulebook importer, and
 * it has been removed: nothing can write a layer or an overlay any more, so on
 * a device that never imported one this composes the SRD with nothing and is a
 * pass-through. It is not dead code. A device that imported before the removal
 * still holds its layer and its overlays in IndexedDB, and this is what still
 * lays them over the SRD - which is why the read half survives the write half,
 * and why the migration that drops those stores has to be a deliberate step
 * rather than a side effect of deleting the importer.
 */
import srd from '../../data/srd-1.0.json';
import type { Dataset, Layer } from '../../shared/types.ts';
import { indexDataset, type DatasetIndex } from '../engine/character.ts';
import { listLayers, listOverlays, type ContentOverlay } from './db.ts';

export const SRD_LAYER: Layer = {
  id: 'srd-1.0-2025-09-09',
  label: 'SRD 1.0',
  priority: 0,
};

export const baseDataset = srd as unknown as Dataset;

/** Collections that an overlay may contribute to, by entity kind. */
const COLLECTIONS = [
  'domains',
  'domainCards',
  'classes',
  'subclasses',
  'beastforms',
  'ancestries',
  'communities',
  'weapons',
  'armors',
  'loot',
  'consumables',
  'adversaries',
  'environments',
  'rules',
] as const;
type CollectionName = (typeof COLLECTIONS)[number];

export interface ResolvedDataset {
  dataset: Dataset;
  index: DatasetIndex;
  layers: Layer[];
  /** Entities an optional layer introduced that the SRD does not have. */
  addedByLayer: Record<string, number>;
}

/**
 * Merge overlays onto the base dataset.
 *
 * Provenance is recorded per field so the UI can show where a value came from
 * and so removing a layer is a pure recompute rather than an undo.
 */
export function resolveDataset(
  base: Dataset,
  layers: Layer[],
  overlays: ContentOverlay[],
): ResolvedDataset {
  const ordered = [...layers].sort((a, b) => a.priority - b.priority);
  const byPriority = new Map(ordered.map((l) => [l.id, l.priority]));

  const merged: Dataset = structuredClone(base);
  const addedByLayer: Record<string, number> = {};

  const buckets = new Map<CollectionName, Map<string, Record<string, unknown>>>();
  for (const name of COLLECTIONS) buckets.set(name, new Map());
  for (const collection of COLLECTIONS) {
    const items = merged[collection] as Array<{ id: string }>;
    for (const item of items) buckets.get(collection)!.set(item.id, item as Record<string, unknown>);
  }

  const winner = new Map<string, number>(); // `${collection}:${id}:${field}` -> priority

  for (const overlay of [...overlays].sort(
    (a, b) => (byPriority.get(a.layerId) ?? 0) - (byPriority.get(b.layerId) ?? 0),
  )) {
    const collection = overlay.kind as CollectionName;
    const bucket = buckets.get(collection);
    if (!bucket) continue;
    const priority = byPriority.get(overlay.layerId) ?? 0;

    let target = bucket.get(overlay.entityId);
    if (!target) {
      // Content present in the manual but not in the SRD. Keep it; the
      // character format only stores refs, so a new ref resolves cleanly.
      target = { id: overlay.entityId, provenance: {} } as Record<string, unknown>;
      bucket.set(overlay.entityId, target);
      (merged[collection] as unknown[]).push(target);
      addedByLayer[overlay.layerId] = (addedByLayer[overlay.layerId] ?? 0) + 1;
    }

    const provenance = (target['provenance'] as Record<string, string> | undefined) ?? {};
    for (const [field, value] of Object.entries(overlay.fields)) {
      if (value === undefined || value === null) continue;
      const key = `${collection}:${overlay.entityId}:${field}`;
      if ((winner.get(key) ?? -1) > priority) continue;
      winner.set(key, priority);
      target[field] = value;
      provenance[field] = overlay.layerId;
    }
    target['provenance'] = provenance;
  }

  return {
    dataset: { ...merged, layers: ordered },
    index: indexDataset(merged),
    layers: ordered,
    addedByLayer,
  };
}

/** Load the dataset for this device: SRD plus whatever has been imported. */
export async function loadDataset(): Promise<ResolvedDataset> {
  const [stored, overlays] = await Promise.all([listLayers(), listOverlays()]);
  const layers = [SRD_LAYER, ...stored.filter((l) => l.id !== SRD_LAYER.id)];
  return resolveDataset(baseDataset, layers, overlays);
}
