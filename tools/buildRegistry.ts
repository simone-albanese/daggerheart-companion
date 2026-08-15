/**
 * Generate `data/registry.json` from the built SRD dataset.
 *
 *   npx tsx tools/buildRegistry.ts            # write the registry
 *   npx tsx tools/buildRegistry.ts --check    # fail if it would change (CI)
 *
 * The one rule: **existing ids never move.** New slugs get the next free id in
 * their band, everything already present is copied across untouched, and a
 * slug that has left the dataset keeps its id forever - somebody's character
 * may still reference it, and a recycled id would silently turn their Rune
 * Ward into a Chain Lightning.
 *
 * Ids are handed out in slug order inside each band, so the file reads like an
 * index and a new SRD revision produces a small, obvious diff.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAINS } from '../shared/types.ts';
import {
  BANDED_COLLECTIONS,
  BANDS,
  bandFor,
  REGISTRY_VERSION,
  type Band,
  type BandedCollection,
  type RegistryFile,
} from '../src/transfer/registry.ts';

/** Just enough of the dataset to hand out ids: slugs, plus a card's domain. */
export type SlugSource = {
  readonly [K in BandedCollection]?: ReadonlyArray<{ id: string; domain?: string }>;
};

export interface BuildResult {
  file: RegistryFile;
  added: Array<{ slug: string; id: number; collection: BandedCollection }>;
  /** Kept ids that no longer appear in the dataset. Never removed. */
  retired: string[];
  warnings: string[];
}

/**
 * Domain cards are sub-banded by domain, a hundred ids each: `arcana-rune-ward`
 * lands at 5101 and stays legible in a diff. 5001-5099 is the pool for a card
 * whose domain this build does not recognise.
 */
function cardWindow(domain: string | undefined): { min: number; max: number } {
  const band = bandFor('domainCards');
  const index = DOMAINS.indexOf(domain as (typeof DOMAINS)[number]);
  if (index < 0) return { min: band.min + 1, max: band.min + 99 };
  const base = band.min + (index + 1) * 100;
  return { min: base + 1, max: base + 99 };
}

function windowFor(collection: BandedCollection, entity: { domain?: string }): {
  band: Band;
  min: number;
  max: number;
} {
  const band = bandFor(collection);
  if (collection === 'domainCards') return { band, ...cardWindow(entity.domain) };
  return { band, min: band.min + 1, max: band.max };
}

export function buildRegistry(source: SlugSource, existing: RegistryFile): BuildResult {
  const ids = new Map<string, number>(Object.entries(existing.ids));
  const taken = new Set<number>(ids.values());
  const added: BuildResult['added'] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const collection of BANDED_COLLECTIONS) {
    const entities = [...(source[collection] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    for (const entity of entities) {
      const slug = entity.id;
      if (seen.has(slug)) {
        // Two collections, one slug: the dataset itself cannot tell them apart
        // either (`indexDataset` keys everything by ref), so this is a parser
        // problem, not a registry problem. Say so and keep the first id.
        warnings.push(`"${slug}" appears in more than one collection; keeping id ${ids.get(slug)!}`);
        continue;
      }
      seen.add(slug);

      const { band, min, max } = windowFor(collection, entity);
      const current = ids.get(slug);
      if (current !== undefined) {
        if (current < band.min || current > band.max) {
          warnings.push(
            `"${slug}" is a ${collection} entry but holds id ${current}, outside the ${band.name} band (${band.min}-${band.max}). Kept: ids never move.`,
          );
        }
        continue;
      }

      let next = min;
      while (taken.has(next)) next += 1;
      if (next > max) {
        throw new Error(
          `The ${band.name} band is full: no free id in ${min}-${max} for "${slug}". Widen the band in src/transfer/registry.ts and renumber nothing.`,
        );
      }
      ids.set(slug, next);
      taken.add(next);
      added.push({ slug, id: next, collection });
    }
  }

  const retired = [...ids.keys()].filter((slug) => !seen.has(slug)).sort();

  const sorted = [...ids.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return {
    file: { version: existing.version || REGISTRY_VERSION, ids: Object.fromEntries(sorted) },
    added,
    retired,
    warnings,
  };
}

export const serializeRegistry = (file: RegistryFile): string =>
  `${JSON.stringify(file, null, 2)}\n`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SRD_PATH = fileURLToPath(new URL('../data/srd-1.0.json', import.meta.url));
const REGISTRY_PATH = fileURLToPath(new URL('../data/registry.json', import.meta.url));

function main(): void {
  const check = process.argv.includes('--check');

  if (!existsSync(SRD_PATH)) {
    console.error(
      `data/srd-1.0.json not found.\n` +
        `The registry is generated from the built dataset, so build it first:\n` +
        `  npm run build:srd`,
    );
    process.exitCode = 1;
    return;
  }

  const source = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as SlugSource;
  const existing: RegistryFile = existsSync(REGISTRY_PATH)
    ? (JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile)
    : { version: REGISTRY_VERSION, ids: {} };

  const result = buildRegistry(source, existing);
  const text = serializeRegistry(result.file);
  const unchanged = existsSync(REGISTRY_PATH) && readFileSync(REGISTRY_PATH, 'utf8') === text;

  for (const w of result.warnings) console.warn(`  warning: ${w}`);
  if (result.retired.length > 0) {
    console.log(`  ${result.retired.length} id(s) kept for slugs no longer in the dataset`);
  }

  if (check) {
    if (unchanged) {
      console.log(`registry up to date: ${Object.keys(result.file.ids).length} ids`);
      return;
    }
    console.error(
      `data/registry.json is out of date: ${result.added.length} id(s) would be added.\n` +
        `Run: npm run build:registry`,
    );
    process.exitCode = 1;
    return;
  }

  if (!unchanged) writeFileSync(REGISTRY_PATH, text);
  const perBand = BANDS.map((b) => {
    const n = Object.values(result.file.ids).filter((id) => id >= b.min && id <= b.max).length;
    return `${b.name} ${n}`;
  }).join(' · ');
  console.log(
    `${unchanged ? 'unchanged' : 'wrote'} data/registry.json: ` +
      `${Object.keys(result.file.ids).length} ids (+${result.added.length})\n  ${perBand}`,
  );
}

// Only when run as a script: the tests import `buildRegistry` from here.
const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) main();
