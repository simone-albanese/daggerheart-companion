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
 *
 * ## The key is `collection/slug`, and the numbers did not move
 *
 * Version 1 of the file was keyed by the bare slug, one id per slug across the
 * whole dataset. SRD 2.0 ends that: it prints an Event environment called
 * *Hold the Line* (folio 164) beside the Valor domain card of the same name
 * (folio 223), and `slugify` reduces both to `hold-the-line`. Two different
 * records, one key, and `tools/validate.ts` stopped the build.
 *
 * So the key is namespaced. **Every number stayed exactly where it was**: the
 * migration in `tools/buildRegistry.ts` only rewrites keys, which is what makes
 * it safe - the wire carries the integer, so a QR generated before the re-key
 * decodes to the same record after it.
 *
 * ## Bare names still resolve, because a `Ref` is a bare slug
 *
 * A `Character` stores refs as bare slugs and always has; `indexDataset` keys
 * its `byRef` map the same way. Namespacing the registry does not namespace
 * that ref space, and this lane deliberately did not try to - so `idOf` and
 * `slugOf` still speak bare slugs and the codec did not change.
 *
 * When one bare slug carries more than one id, `idOf` hands back the one whose
 * collection comes first in `BANDED_COLLECTIONS`. That order is therefore
 * load-bearing now, where before it only decided which of two colliding slugs
 * got warned about; it runs character-facing content first and GM-only content
 * last, so `hold-the-line` resolves to the domain card a loadout can hold
 * rather than to the environment a sheet can never point at. `idIn` is the
 * exact lookup for a caller that knows its collection.
 *
 * A `Character` field is allowed to want `idIn` rather than `idOf`, and one
 * does: `transformationRef`. See `BANDED_COLLECTIONS` below for why the order
 * was not changed to suit it.
 */
import registryFile from '../../data/registry.json';
import type { Ref } from '../../shared/types.ts';

export interface RegistryFile {
  version: number;
  /**
   * `collection/slug` -> id. The collection is one of `BANDED_COLLECTIONS`;
   * the slug never contains a `/`, because `slugify` only emits `[a-z0-9-]`.
   */
  ids: Record<string, number>;
}

/**
 * What this number gates, now that it gates something.
 *
 * 1 -> 2 is the re-key described above. It has to be a version and not a
 * silent change of shape, because the two files are indistinguishable by type
 * (`Record<string, number>` either way) and a version-1 file read by this
 * build would resolve nothing: every lookup goes through `collection/slug`
 * and every key in that file is a bare slug. The app would come up with an
 * empty-looking registry and export characters with every ref missing.
 *
 * `tests/harness/orphans.test.ts` has said since the constant was written that
 * it is "checked by createRegistry on load". That was not true - `createRegistry`
 * copied `file.version` onto the registry and looked at it no further. It is
 * true now: a file at any other version is refused below, loudly, at load.
 */
export const REGISTRY_VERSION = 2;

/** The one character that separates a key's two halves. Never inside a slug. */
export const KEY_SEPARATOR = '/';

/** `('domainCards', 'hold-the-line')` -> `'domainCards/hold-the-line'`. */
export const registryKey = (collection: string, slug: Ref): string =>
  `${collection}${KEY_SEPARATOR}${slug}`;

/**
 * The inverse. `null` for anything that is not exactly one separator with a
 * non-empty half on each side - a bare version-1 key, or a slug that somehow
 * carries a separator of its own.
 */
export const parseRegistryKey = (key: string): { collection: string; slug: Ref } | null => {
  const cut = key.indexOf(KEY_SEPARATOR);
  if (cut <= 0 || cut === key.length - 1) return null;
  const slug = key.slice(cut + 1);
  if (slug.includes(KEY_SEPARATOR)) return null;
  return { collection: key.slice(0, cut), slug };
};

/** Ids at or above this belong to user content. Never emitted, never assumed. */
export const RESERVED_MIN = 60_000;

/**
 * Dataset collections that get ids. Domains and rules are never referenced by a
 * character.
 *
 * **This order is load-bearing.** It is the order `buildRegistry` walks, and
 * since the re-key it is also the precedence `idOf` uses when one bare slug
 * carries several ids: first entry wins the bare name. It runs the collections
 * a `Character` can point at first and the GM-only ones last, which is why
 * `hold-the-line` resolves to the Valor domain card and not to the SRD 2.0
 * environment - a loadout can hold the card, and no field on a sheet has ever
 * been able to hold an environment.
 *
 * `transformations` is appended rather than placed beside `communities`, where
 * `Dataset` keeps it, following the book's contents page.
 *
 * ## The reason it is last has changed, and the position has not
 *
 * This docblock used to say "nothing on a character references one yet, so it
 * must not be able to take a bare name away from something that is referenced".
 * That premise is **false as of `SCHEMA_VERSION` 7**: `Character` carries a
 * `transformationRef`, and it is on the wire as of `CODEC_VERSION` 4.
 *
 * The position still stands, and now it stands on a measurement instead. SRD
 * 2.0 prints an adversary VAMPIRE on folio 142 and a VAMPIRE transformation
 * card on folio 45; run over the 2026-08-25 book, `parseAdversaries` and
 * `parseTransformations` both emit the slug `vampire`. Moving
 * `transformations` above `adversaries` would hand the bare name `vampire` to
 * the card for every caller in the app - the GM's bestiary lookups included -
 * in exchange for one field's convenience. Every id in this file is on the
 * wire, and precedence decides which record a bare name resolves to; neither is
 * a thing to change for a caller that has an exact lookup available.
 *
 * **So the one field that points here does not use the bare lookup at all.**
 * `src/transfer/codec.ts` writes it with `idIn('transformations', slug)` and
 * reads it back through `keyOf`, checking the collection half of the key; the
 * runtime index does the same with `DatasetIndex.collections.transformations`
 * rather than `byRef`. What that costs is two methods in the codec's ref
 * writer and reader. What reordering would have cost is every other lookup of
 * `vampire` in the app.
 */
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
  'transformations',
  /*
   * `stances` is appended, and for a different reason than `transformations`
   * was. That one is last because moving it up would take the bare name
   * `vampire` off an adversary. This one has no such fight to lose: measured on
   * both committed datasets, not one of the sixteen stance slugs appears in any
   * other collection.
   *
   * So the position is chosen for what it PREVENTS rather than for what it
   * resolves. Last is the position from which a new collection can never take a
   * bare name away from a collection that already had it, which is the only way
   * appending a collection can change what an existing `Ref` on a saved sheet
   * means. `Character.stanceRefs` reaches its records through
   * `Registry.idIn('stances', ...)` and `DatasetIndex.collections.stances`
   * anyway, so the precedence decides nothing for the one field that points
   * here - which is exactly why it costs nothing to put it where it is safest.
   */
  'stances',
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
  /*
   * Domain cards, continued. A second band rather than a wider first one,
   * because the first one cannot be widened: 5000-5999 is exactly full at nine
   * hundreds, and 6001-6022 are beastforms that are already on the wire. There
   * is no room above `domainCards` and there is nothing to move - an id that
   * changes invalidates every QR ever scanned.
   *
   * 12_000 rather than anywhere nearer: everything from 60_000 is reserved for
   * user content, nothing has ever been minted above 11_019, and starting the
   * continuation on a fresh ten-thousand keeps a domain-card id recognisable at
   * a glance in a diff, which is what the bands are for.
   */
  { name: 'domainCards+', min: 12_000, max: 13_999, collections: ['domainCards'] },
  /*
   * Transformations, the collection SRD 2.0 adds (folios 42-45, six cards).
   *
   * 14_000-14_999 because it is the first thousand no band claims: the bands
   * above run to 13_999 and the reserved range starts at 60_000. Nothing is
   * squeezed in below, and nothing needed to be - the highest id ever minted is
   * 11_019 (`max(data/registry.json)`, measured, not remembered), so the gap
   * between 11_019 and 14_000 is empty on purpose and stays that way.
   *
   * A band of its own rather than a lodger in somebody else's: a transformation
   * is not an item and not a card, and the whole point of the bands is that a
   * wrong-kind reference is obvious in a diff.
   */
  { name: 'transformations', min: 14_000, max: 14_999, collections: ['transformations'] },
  /*
   * Martial stances, the collection SRD 2.0 adds inside its Classes chapter
   * (folio 13, sixteen stances over four tiers).
   *
   * 15_000-15_999 because it is the first thousand no band claims: the bands
   * above run to 14_999 and the reserved range starts at 60_000. Measured, not
   * remembered: `max(data/registry.json)` before this lane is 14_006, so
   * 14_007-14_999 is transformations’ own headroom and 15_000 is the next free
   * thousand rather than the next free number.
   *
   * A band of its own rather than a lodger in `transformations`: they are not
   * the same kind of thing - one is a card the GM grants, the other a technique
   * one subclass learns - and the whole point of the bands is that a wrong-kind
   * reference is obvious in a diff. Sixteen records in a thousand is the same
   * ratio `transformations` has with six, and both are cheap: the file carries
   * only the rows that exist.
   */
  { name: 'stances', min: 15_000, max: 15_999, collections: ['stances'] },
];

/**
 * Domain -> the first id of its hundred. **Append-only: every value here is on
 * the wire.**
 *
 * This used to be computed, `DOMAINS.indexOf(domain) * 100`, and that was a
 * defect waiting for its tenth domain. Two of them, in fact. A domain that
 * sorts into the MIDDLE of the list - `dread`, between codex and grace - would
 * have shifted the window of every domain after it, so the same card would be
 * minted at a different id depending on which book the build had read. And the
 * tenth window computed to 6001-6099 whatever its name, which is inside the
 * beastforms band: a domain card would have decoded as a beastform on the
 * receiving device.
 *
 * Neither failure announces itself. The wire format carries integers precisely
 * so it can be small, which means there is nothing in a scanned frame to say
 * that 6007 was meant as a card rather than as `bear`.
 *
 * So the mapping is written down instead of derived. Alphabetical order is a
 * display concern; it has no business deciding what goes on the wire. Adding a
 * domain is now one deliberate line here, and `buildRegistry` refuses to mint a
 * card for a domain that has not got one.
 *
 * ## No test can currently tell this table from what it replaced
 *
 * Measured, not assumed: restoring `DOMAINS.indexOf(domain) * 100` in
 * `buildRegistry` passes all 4264 tests. With nine domains the two agree on
 * every value, so the change is preventive and the suite is blind to it. Both
 * of the other mutants do die - deleting the `domainCards+` band reddens one
 * named test, moving `valor` off 5900 reddens four - which pins the band and
 * pins the values, but not the mechanism.
 *
 * The mechanism becomes testable the moment `dread` joins `DOMAINS`, because
 * that is the first domain whose alphabetical position and whose id window
 * disagree. The test that must exist by then: build a registry from a fixture
 * carrying a `dread` card and assert its id is in 12_101-12_199. Until then the
 * guard is `gives every domain this build knows a window of its own`, which
 * goes red the moment the two lists stop agreeing.
 */
export const DOMAIN_CARD_BASES: Readonly<Record<string, number>> = Object.freeze({
  arcana: 5100,
  blade: 5200,
  bone: 5300,
  codex: 5400,
  grace: 5500,
  midnight: 5600,
  sage: 5700,
  splendor: 5800,
  valor: 5900,
  /*
   * Dread's hundred is in the continuation band, not at 6000.
   *
   * 5000-5999 was exactly full at nine hundreds when this domain arrived, and
   * the computed window a tenth domain would have taken - 6001-6099 - is inside
   * the beastforms band, where 6001-6022 are real ids already on the wire. This
   * is the first entry that could not have been derived, which is the whole
   * reason the table stopped deriving them.
   */
  dread: 12_100,
});

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
  /** Rows in the file, which is keys and not bare slugs. */
  size: number;
  /**
   * The exact lookup, for a caller that knows which collection it means. This
   * is the one the build tool and the dataset speak.
   */
  idIn(collection: string, slug: Ref): number | null;
  /**
   * The bare-slug lookup the codec speaks, because a `Ref` on a character is a
   * bare slug. When several collections carry the slug, the one that comes
   * first in `BANDED_COLLECTIONS` wins; see that array's docblock.
   */
  idOf(slug: Ref): number | null;
  /** id -> the BARE slug, which is what a `Ref` field can hold. */
  slugOf(id: number): Ref | null;
  /** id -> the full `collection/slug`, for diagnostics and for tests. */
  keyOf(id: number): string | null;
  has(slug: Ref): boolean;
  /** Every row, keyed as the file is. For the build tool and for tests. */
  entries(): ReadonlyMap<string, number>;
}

/**
 * Where a collection sits in the bare-name precedence. An unknown collection -
 * a row left over from a collection this build no longer has - sorts last, so
 * it can never take a bare name from a collection that still exists.
 */
const collectionRank = (collection: string): number => {
  const i = (BANDED_COLLECTIONS as readonly string[]).indexOf(collection);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

/**
 * Wrap a registry file, checking the invariants the codec depends on. A broken
 * registry is a build-time mistake and must stop the app loudly: silently
 * tolerating a duplicate id would send two different cards to the same wire
 * value and quietly corrupt somebody's character.
 */
export function createRegistry(file: RegistryFile): Registry {
  /*
   * The version gate. It is first because every check below reads a key, and a
   * version-1 file has no keys - only bare slugs. Letting one through would
   * not throw anywhere: `parseRegistryKey` would return null for every row and
   * the app would come up with a registry that resolves nothing, which is the
   * failure that looks like working software right up until somebody exports a
   * character and every reference is missing.
   */
  if (file.version !== REGISTRY_VERSION) {
    throw new RegistryError(
      `data/registry.json is version ${String(file.version)}, this build reads version ${REGISTRY_VERSION}. ` +
        `Version 2 keys every row by "collection/slug" instead of by the bare slug; no id changed. ` +
        `Run: npm run build:registry`,
    );
  }

  const byKey = new Map<string, number>();
  const bySlug = new Map<Ref, number>();
  const rankOfSlug = new Map<Ref, number>();
  const byId = new Map<number, Ref>();
  const keyById = new Map<number, string>();

  for (const [key, id] of Object.entries(file.ids)) {
    const parsed = parseRegistryKey(key);
    if (parsed === null) {
      throw new RegistryError(
        `Registry key "${key}" is not "collection/slug". Every row is namespaced since version 2.`,
      );
    }
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new RegistryError(`Registry id for "${key}" is not a positive integer: ${String(id)}`);
    }
    if (isReserved(id)) {
      throw new RegistryError(
        `Registry id ${id} for "${key}" is in the reserved range (>= ${RESERVED_MIN}), which is kept free for user content.`,
      );
    }
    if (bandOf(id) === null) {
      throw new RegistryError(`Registry id ${id} for "${key}" falls outside every band.`);
    }
    const clash = keyById.get(id);
    if (clash !== undefined) {
      throw new RegistryError(`Registry id ${id} is used by both "${clash}" and "${key}".`);
    }
    byKey.set(key, id);
    keyById.set(id, key);
    byId.set(id, parsed.slug);

    /*
     * The bare name. Lowest collection rank wins, and a tie - which can only
     * happen if the same collection somehow appears twice - falls to the lower
     * id, so the result never depends on `Object.entries` order.
     */
    const rank = collectionRank(parsed.collection);
    const heldRank = rankOfSlug.get(parsed.slug);
    const held = bySlug.get(parsed.slug);
    if (heldRank === undefined || rank < heldRank || (rank === heldRank && id < held!)) {
      rankOfSlug.set(parsed.slug, rank);
      bySlug.set(parsed.slug, id);
    }
  }

  return {
    version: file.version,
    size: byKey.size,
    idIn: (collection, slug) => byKey.get(registryKey(collection, slug)) ?? null,
    idOf: (slug) => bySlug.get(slug) ?? null,
    slugOf: (id) => byId.get(id) ?? null,
    keyOf: (id) => keyById.get(id) ?? null,
    has: (slug) => bySlug.has(slug),
    entries: () => byKey,
  };
}

/**
 * The committed registry. Empty until `tools/buildRegistry.ts` has run.
 *
 * ## Why this is built on first use and not at import
 *
 * It used to be `createRegistry(...)` at module scope, and the version gate
 * turned that into a trap door the moment the gate had something to reject:
 * `tools/buildRegistry.ts` imports `BANDS` and `REGISTRY_VERSION` from this
 * file, so importing it evaluated this line, so the one tool that can bring an
 * out-of-date `data/registry.json` up to date crashed on the very file it
 * exists to rewrite - with a message telling the developer to run the tool
 * that had just crashed. Measured, not imagined: that is exactly what
 * `npm run build:registry` did on the first run after the gate went in.
 *
 * Deferring to first use costs the app nothing it was actually getting. The
 * registry is read on the first encode, decode or pre-flight, all of which
 * happen long after start-up, and a throw there is every bit as loud as a
 * throw at import - `createRegistry` is still the only thing that builds it
 * and it still refuses everything it refused before.
 */
let committed: Registry | null = null;
const loadCommitted = (): Registry =>
  (committed ??= createRegistry(registryFile as unknown as RegistryFile));

export const registry: Registry = {
  get version(): number {
    return loadCommitted().version;
  },
  get size(): number {
    return loadCommitted().size;
  },
  idIn: (collection, slug) => loadCommitted().idIn(collection, slug),
  idOf: (slug) => loadCommitted().idOf(slug),
  slugOf: (id) => loadCommitted().slugOf(id),
  keyOf: (id) => loadCommitted().keyOf(id),
  has: (slug) => loadCommitted().has(slug),
  entries: () => loadCommitted().entries(),
};
