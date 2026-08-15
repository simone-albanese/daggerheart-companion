/**
 * Stable integer ids for dataset slugs.
 *
 * The wire format carries integers, never slugs: the same level 5 wizard is
 * 604 base64 characters as slug JSON and 147 bytes as registry ids. That is
 * the whole reason this file exists.
 *
 * `data/registry.json` is committed and **append-only**. An id that changes
 * invalidates every QR ever scanned and every `.dhchar` ever written, so the
 * build tool only ever adds, and a test in `tests/transfer/registry.test.ts`
 * fails if an existing entry moves or disappears.
 *
 * Bands make a wrong-kind reference obvious in a diff and leave each kind room
 * to grow. Everything from 60000 up is reserved for the user content that does
 * not exist yet (Architecture 4): the encoder must never mint an id there, and
 * the decoder treats one as unresolvable rather than guessing.
 */
import registryFile from '../../data/registry.json';
import type { Ref } from '../../shared/types.ts';

export interface RegistryFile {
  version: number;
  /** slug -> id. */
  ids: Record<string, number>;
}

export const REGISTRY_VERSION = 1;

/** Ids at or above this belong to user content. Never emitted, never assumed. */
export const RESERVED_MIN = 60_000;

/** Dataset collections that get ids. Domains and rules are never referenced by a character. */
export const BANDED_COLLECTIONS = [
  'classes',
  'subclasses',
  'ancestries',
  'communities',
  'domainCards',
  'beastforms',
  'weapons',
  'armors',
  'loot',
  'consumables',
  'adversaries',
  'environments',
] as const;

export type BandedCollection = (typeof BANDED_COLLECTIONS)[number];

export interface Band {
  name: string;
  min: number;
  /** Inclusive. */
  max: number;
  collections: readonly BandedCollection[];
}

export const BANDS: readonly Band[] = [
  { name: 'classes', min: 1000, max: 1999, collections: ['classes'] },
  { name: 'subclasses', min: 2000, max: 2999, collections: ['subclasses'] },
  { name: 'ancestries', min: 3000, max: 3999, collections: ['ancestries'] },
  { name: 'communities', min: 4000, max: 4999, collections: ['communities'] },
  { name: 'domainCards', min: 5000, max: 5999, collections: ['domainCards'] },
  { name: 'beastforms', min: 6000, max: 6999, collections: ['beastforms'] },
  { name: 'weapons', min: 7000, max: 7999, collections: ['weapons'] },
  { name: 'armors', min: 8000, max: 8999, collections: ['armors'] },
  // Loot and consumables share a band: both are inventory entries and the SRD
  // prints them as one pair of tables.
  { name: 'items', min: 9000, max: 9999, collections: ['loot', 'consumables'] },
  { name: 'adversaries', min: 10_000, max: 10_999, collections: ['adversaries'] },
  { name: 'environments', min: 11_000, max: 11_999, collections: ['environments'] },
];

export const bandFor = (collection: BandedCollection): Band =>
  BANDS.find((b) => b.collections.includes(collection))!;

export const bandOf = (id: number): Band | null =>
  BANDS.find((b) => id >= b.min && id <= b.max) ?? null;

export const isReserved = (id: number): boolean => id >= RESERVED_MIN;

export class RegistryError extends Error {
  override name = 'RegistryError';
}

// ---------------------------------------------------------------------------
// Unresolvable references
// ---------------------------------------------------------------------------

/**
 * A reference this device cannot name. `slugify` only ever emits `[a-z0-9-]`,
 * so a leading `?` can never collide with a real slug - which is exactly what
 * makes it safe to park an unknown id inside a `Ref` field instead of dropping
 * the reference (Architecture 5.3: never discard anything).
 */
export const UNRESOLVED_PREFIX = '?';

export const unresolvedRef = (id: number): Ref => `${UNRESOLVED_PREFIX}${id}`;

export const isUnresolvedRef = (ref: string): boolean =>
  ref.startsWith(UNRESOLVED_PREFIX) && /^\?\d+$/.test(ref);

export const unresolvedIdOf = (ref: string): number | null =>
  isUnresolvedRef(ref) ? Number(ref.slice(1)) : null;

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export interface Registry {
  version: number;
  size: number;
  idOf(slug: Ref): number | null;
  slugOf(id: number): Ref | null;
  has(slug: Ref): boolean;
  /** Every entry, for the build tool and for tests. */
  entries(): ReadonlyMap<Ref, number>;
}

/**
 * Wrap a registry file, checking the invariants the codec depends on. A broken
 * registry is a build-time mistake and must stop the app loudly: silently
 * tolerating a duplicate id would send two different cards to the same wire
 * value and quietly corrupt somebody's character.
 */
export function createRegistry(file: RegistryFile): Registry {
  const bySlug = new Map<Ref, number>();
  const byId = new Map<number, Ref>();

  for (const [slug, id] of Object.entries(file.ids)) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new RegistryError(`Registry id for "${slug}" is not a positive integer: ${String(id)}`);
    }
    if (isReserved(id)) {
      throw new RegistryError(
        `Registry id ${id} for "${slug}" is in the reserved range (>= ${RESERVED_MIN}), which is kept free for user content.`,
      );
    }
    if (bandOf(id) === null) {
      throw new RegistryError(`Registry id ${id} for "${slug}" falls outside every band.`);
    }
    const clash = byId.get(id);
    if (clash !== undefined) {
      throw new RegistryError(`Registry id ${id} is used by both "${clash}" and "${slug}".`);
    }
    bySlug.set(slug, id);
    byId.set(id, slug);
  }

  return {
    version: file.version,
    size: bySlug.size,
    idOf: (slug) => bySlug.get(slug) ?? null,
    slugOf: (id) => byId.get(id) ?? null,
    has: (slug) => bySlug.has(slug),
    entries: () => bySlug,
  };
}

/** The committed registry. Empty until `tools/buildRegistry.ts` has run. */
export const registry: Registry = createRegistry(registryFile as unknown as RegistryFile);
