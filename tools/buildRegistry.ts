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
 *
 * ## The re-key, and how the one rule survived it
 *
 * Version 2 of the file keys every row by `collection/slug` rather than by the
 * bare slug, because SRD 2.0 prints an environment and a domain card that both
 * slugify to `hold-the-line`. `migrateKeys` below does that rewrite, and it is
 * built so that it CANNOT move a number: it reads the old map's values and
 * writes them back untouched under a new key. What it decides is the key, and
 * only the key.
 *
 * A retired row - a slug the dataset no longer prints - has no collection to
 * read off the dataset, so its key is derived from the band its id already sits
 * in. That is the only information there is, and it is enough: the id stays
 * reserved either way, and `slugOf` keeps returning the same bare slug, which
 * is the half a stored character actually depends on.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMAINS } from '../shared/types.ts';
import {
  BANDED_COLLECTIONS,
  BANDS,
  bandFor,
  bandOf,
  DOMAIN_CARD_BASES,
  parseRegistryKey,
  registryKey,
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
  /** Kept rows, by key, whose slug no longer appears in the dataset. Never removed. */
  retired: string[];
  warnings: string[];
}

/**
 * Domain cards are sub-banded by domain, a hundred ids each: arcana's window is
 * 5101-5199, so `domainCards/rune-ward` lands at 5117 - the seventeenth arcana
 * card in slug order - and stays legible in a diff. 5001-5099 is the pool for a
 * card whose domain this build does not recognise.
 *
 * That example used to read "`arcana-rune-ward` lands at 5101", which is wrong
 * twice and was wrong before this lane touched anything: there is no slug
 * `arcana-rune-ward` in the dataset or in the registry (`slugify` is given the
 * card's printed name and nothing else, so no domain is prefixed), and 5101 is
 * `domainCards/adjust-reality`, the arcana card that sorts first. Measured
 * against the committed `data/registry.json`. The same sentence is still in
 * Architecture.md twice; see this lane's openQuestions.
 *
 * The base comes from `DOMAIN_CARD_BASES`, which is written down rather than
 * derived from `DOMAINS.indexOf`. That table's docblock carries the argument;
 * the short version is that alphabetical order was deciding wire ids, and the
 * tenth domain's computed window landed inside the beastforms band.
 *
 * A domain this build knows about but that has no base is a HARD ERROR and not
 * a fallback into the unknown pool. Falling back would mint an id for a real
 * card in the window reserved for cards whose domain could not be read - the
 * two are different states and only one of them is recoverable. The message
 * names the next free hundred so that adding the line is mechanical.
 */
function cardWindow(domain: string | undefined): { min: number; max: number } {
  const band = bandFor('domainCards');
  if (domain === undefined || !DOMAINS.includes(domain as (typeof DOMAINS)[number])) {
    return { min: band.min + 1, max: band.min + 99 };
  }
  const base = DOMAIN_CARD_BASES[domain];
  if (base === undefined) {
    throw new Error(
      `Domain "${domain}" has no id window. Add it to DOMAIN_CARD_BASES in ` +
        `src/transfer/registry.ts - the next free hundred is ${nextFreeBase()} - ` +
        `and renumber nothing: every value already in that table is on the wire.`,
    );
  }
  return { min: base + 1, max: base + 99 };
}

/** The lowest hundred in a domain-card band that no domain has claimed yet. */
function nextFreeBase(): number {
  const taken = new Set(Object.values(DOMAIN_CARD_BASES));
  for (const band of BANDS.filter((b) => b.collections.includes('domainCards'))) {
    for (let base = band.min + 100; base + 99 <= band.max; base += 100) {
      if (!taken.has(base)) return base;
    }
  }
  throw new Error('Every domain-card hundred is claimed. Add a band in src/transfer/registry.ts.');
}

/**
 * The band a window actually falls in, which for domain cards is no longer the
 * first band naming the collection: the continuation band holds the tenth
 * domain onwards, and the out-of-band warning below compares against this.
 */
function windowFor(collection: BandedCollection, entity: { domain?: string }): {
  band: Band;
  min: number;
  max: number;
} {
  if (collection === 'domainCards') {
    const window = cardWindow(entity.domain);
    const band = BANDS.find(
      (b) => b.collections.includes('domainCards') && window.min >= b.min && window.max <= b.max,
    );
    if (band === undefined) {
      throw new Error(
        `Domain "${entity.domain}" is mapped to ${window.min}-${window.max}, which is not inside ` +
          `any domain-card band. Fix DOMAIN_CARD_BASES or add a band in src/transfer/registry.ts.`,
      );
    }
    return { band, ...window };
  }
  const band = bandFor(collection);
  return { band, min: band.min + 1, max: band.max };
}


/**
 * Version 1 (bare slug) -> version 2 (`collection/slug`). Keys only: every
 * value is copied across by reference, which is what makes "the numbers do not
 * move" a property of the code and not a promise about it.
 *
 * Which collection a bare slug belonged to is read from the dataset it was
 * minted from, walking `BANDED_COLLECTIONS` in order so that the collection
 * that owned the slug under version 1 - the first one to claim it, which is
 * what the old build loop did - owns it again.
 *
 * A slug the dataset no longer prints falls back to its id's band. Bands name
 * one collection each, except `items`, which is `loot` and `consumables`
 * together; for a retired row in that band the first is taken and the choice is
 * reported. Getting it wrong costs one wasted id and nothing else: if the slug
 * comes back as the other collection it is minted a fresh id in the same band,
 * the old id stays reserved forever, and `idOf` still hands back the older
 * (lower-ranked) collection's number, so no stored reference changes meaning.
 */
export function migrateKeys(
  existing: RegistryFile,
  source: SlugSource,
): { file: RegistryFile; notes: string[] } {
  if (existing.version === REGISTRY_VERSION) return { file: existing, notes: [] };
  if (existing.version !== 1) {
    throw new Error(
      `data/registry.json is version ${String(existing.version)}; this build knows 1 and ${REGISTRY_VERSION}.`,
    );
  }

  const owner = new Map<string, BandedCollection>();
  for (const collection of BANDED_COLLECTIONS) {
    for (const entity of source[collection] ?? []) {
      if (!owner.has(entity.id)) owner.set(entity.id, collection);
    }
  }

  const notes: string[] = [];
  const ids: Record<string, number> = {};
  for (const [slug, id] of Object.entries(existing.ids)) {
    let collection = owner.get(slug);
    if (collection === undefined) {
      const band = bandOf(id);
      if (band === undefined || band === null) {
        throw new Error(
          `"${slug}" holds id ${id}, which is in no band, and it is not in the dataset either. ` +
            `There is nothing to key it by. Fix it by hand before re-keying.`,
        );
      }
      collection = band.collections[0]!;
      notes.push(
        `retired "${slug}" (${id}) keyed as ${collection} from the ${band.name} band` +
          (band.collections.length > 1 ? ` (which also holds ${band.collections.slice(1).join(', ')})` : ''),
      );
    }
    const key = registryKey(collection, slug);
    if (ids[key] !== undefined) {
      throw new Error(`Re-key collision: "${slug}" and another row both want "${key}".`);
    }
    ids[key] = id;
  }

  return { file: { version: REGISTRY_VERSION, ids }, notes };
}

export function buildRegistry(source: SlugSource, existing: RegistryFile): BuildResult {
  const migration = migrateKeys(existing, source);
  const ids = new Map<string, number>(Object.entries(migration.file.ids));
  const taken = new Set<number>(ids.values());
  const added: BuildResult['added'] = [];
  const warnings: string[] = [...migration.notes];
  const seen = new Set<string>();
  /** Bare slug -> the keys carrying it, in `BANDED_COLLECTIONS` order. */
  const bare = new Map<string, string[]>();
  for (const key of ids.keys()) {
    const parsed = parseRegistryKey(key);
    if (parsed !== null) bare.set(parsed.slug, [...(bare.get(parsed.slug) ?? []), key]);
  }

  for (const collection of BANDED_COLLECTIONS) {
    const entities = [...(source[collection] ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    for (const entity of entities) {
      const slug = entity.id;
      const key = registryKey(collection, slug);
      if (seen.has(key)) {
        // The same slug twice inside ONE collection. Two records, one key, and
        // no way to tell them apart - which is a parser problem, not a registry
        // problem, and `tools/validate.ts` reports it as an error. Say so and
        // keep the first id.
        warnings.push(`"${slug}" appears twice in ${collection}; keeping id ${ids.get(key)!}`);
        continue;
      }
      seen.add(key);

      /*
       * The same slug in ANOTHER collection is no longer a problem to warn
       * about - each row has its own key and its own id, which is the whole
       * point of version 2. What is still worth saying is which of them the
       * BARE name resolves to, because `Character` refs and `indexDataset`'s
       * `byRef` map are both still keyed by the bare slug alone.
       */
      const others = (bare.get(slug) ?? []).filter((k) => k !== key);
      if (others.length > 0 && !ids.has(key)) {
        warnings.push(
          `"${slug}" is in ${collection} as well as ${others.join(', ')}; each keeps its own id, ` +
            `and the bare name resolves to ${[...others, key].sort((a, b) => rankOfKey(a) - rankOfKey(b))[0]!}`,
        );
      }

      const { band, min, max } = windowFor(collection, entity);
      const current = ids.get(key);
      if (current !== undefined) {
        if (current < band.min || current > band.max) {
          warnings.push(
            `"${key}" holds id ${current}, outside the ${band.name} band (${band.min}-${band.max}). Kept: ids never move.`,
          );
        }
        continue;
      }

      let next = min;
      while (taken.has(next)) next += 1;
      if (next > max) {
        throw new Error(
          `The ${band.name} band is full: no free id in ${min}-${max} for "${key}". Widen the band in src/transfer/registry.ts and renumber nothing.`,
        );
      }
      ids.set(key, next);
      taken.add(next);
      bare.set(slug, [...(bare.get(slug) ?? []), key]);
      added.push({ slug, id: next, collection });
    }
  }

  /*
   * The one way a re-keyed registry could still change what a bare slug means:
   * a NEW row whose collection outranks the collection that already held the
   * name. Every id is still exactly where it was, but `idOf` would start
   * handing back the new one, and a device on the previous registry - which
   * does not have that id at all - would park the reference instead of
   * resolving it. Nothing in this dataset does it; this is here so that the day
   * something does, it is a line of output and not a silent change.
   */
  for (const { slug, collection } of added) {
    const keys = bare.get(slug) ?? [];
    if (keys.length < 2) continue;
    const winner = [...keys].sort((a, b) => rankOfKey(a) - rankOfKey(b))[0]!;
    if (winner !== registryKey(collection, slug)) continue;
    const previous = keys.filter((k) => k !== winner);
    warnings.push(
      `the bare name "${slug}" now resolves to ${winner} (${ids.get(winner)!}); it resolved to ` +
        `${previous.map((k) => `${k} (${ids.get(k)!})`).join(', ')} before this build. No id moved, ` +
        `but a device on the previous registry writes the older number for the same sheet.`,
    );
  }

  const retired = [...ids.keys()].filter((key) => !seen.has(key)).sort();

  const sorted = [...ids.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  return {
    file: { version: REGISTRY_VERSION, ids: Object.fromEntries(sorted) },
    added,
    retired,
    warnings,
  };
}

/** Bare-name precedence for a whole key: see `BANDED_COLLECTIONS`. */
function rankOfKey(key: string): number {
  const parsed = parseRegistryKey(key);
  if (parsed === null) return Number.MAX_SAFE_INTEGER;
  const i = (BANDED_COLLECTIONS as readonly string[]).indexOf(parsed.collection);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export const serializeRegistry = (file: RegistryFile): string =>
  `${JSON.stringify(file, null, 2)}\n`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SRD_PATH = fileURLToPath(new URL('../data/srd-2.0.json', import.meta.url));
const REGISTRY_PATH = fileURLToPath(new URL('../data/registry.json', import.meta.url));

function main(): void {
  const check = process.argv.includes('--check');

  if (!existsSync(SRD_PATH)) {
    console.error(
      `data/srd-2.0.json not found.\n` +
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

  if (existing.version !== REGISTRY_VERSION) {
    console.log(
      `re-keying registry version ${String(existing.version)} -> ${REGISTRY_VERSION}: ` +
        `${Object.keys(existing.ids).length} row(s) get a "collection/slug" key and keep their id`,
    );
  }
  for (const w of result.warnings) console.warn(`  warning: ${w}`);
  if (result.retired.length > 0) {
    console.log(`  ${result.retired.length} row(s) kept for slugs no longer in the dataset`);
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
