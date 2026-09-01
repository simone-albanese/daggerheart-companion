/**
 * The registry is append-only, and these tests are what makes that true.
 *
 * A changed id silently turns one card into another on every device that ever
 * scanned a QR or opened a `.dhchar`, and nothing in the app would notice. So
 * the invariant is checked from both ends: the generator may only add, and the
 * committed file must satisfy the rules the codec assumes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DOMAINS } from '../../shared/types.ts';
import {
  BANDED_COLLECTIONS,
  BANDS,
  RESERVED_MIN,
  DOMAIN_CARD_BASES,
  bandFor,
  bandOf,
  createRegistry,
  isUnresolvedRef,
  registry,
  registryKey,
  REGISTRY_VERSION,
  unresolvedIdOf,
  unresolvedRef,
  type RegistryFile,
} from '../../src/transfer/registry.ts';
import { buildRegistry, serializeRegistry, type SlugSource } from '../../tools/buildRegistry.ts';
import { SOURCE } from './fixtures.ts';

const EMPTY: RegistryFile = { version: REGISTRY_VERSION, ids: {} };

/** Every row is keyed `collection/slug` since version 2; these read one. */
const idOf = (file: RegistryFile, collection: string, slug: string): number | undefined =>
  file.ids[registryKey(collection, slug)];
const REPO = new URL('../../', import.meta.url);
const SRD_PATH = fileURLToPath(new URL('data/srd-2.0.json', REPO));
const REGISTRY_PATH = fileURLToPath(new URL('data/registry.json', REPO));

describe('bands', () => {
  it('covers every id it hands out and never reaches the reserved range', () => {
    const { file } = buildRegistry(SOURCE, EMPTY);
    for (const [slug, id] of Object.entries(file.ids)) {
      expect(bandOf(id), `${slug} -> ${id}`).not.toBeNull();
      expect(id).toBeLessThan(RESERVED_MIN);
    }
  });

  it('puts each kind in its own band', () => {
    const { file } = buildRegistry(SOURCE, EMPTY);
    const inBand = (collection: string, slug: string, name: string): boolean => {
      const band = BANDS.find((b) => b.name === name)!;
      const id = idOf(file, collection, slug)!;
      return id >= band.min && id <= band.max;
    };
    expect(inBand('classes', 'wizard', 'classes')).toBe(true);
    expect(inBand('subclasses', 'school-of-war', 'subclasses')).toBe(true);
    expect(inBand('ancestries', 'elf', 'ancestries')).toBe(true);
    expect(inBand('communities', 'loreborne', 'communities')).toBe(true);
    expect(inBand('domainCards', 'rune-ward', 'domainCards')).toBe(true);
    expect(inBand('beastforms', 'nimble-grazer', 'beastforms')).toBe(true);
    expect(inBand('weapons', 'improved-wand', 'weapons')).toBe(true);
    expect(inBand('armors', 'chainmail-armor', 'armors')).toBe(true);
    expect(inBand('loot', 'arcane-cloak', 'items')).toBe(true);
    expect(inBand('consumables', 'attune-potion', 'items')).toBe(true);
    expect(inBand('adversaries', 'jagged-knife-lackey', 'adversaries')).toBe(true);
    expect(inBand('environments', 'abandoned-grove', 'environments')).toBe(true);
  });

  it('hands out ids in slug order, so the file reads like an index', () => {
    const { file } = buildRegistry({ classes: [{ id: 'wizard' }, { id: 'bard' }] }, EMPTY);
    expect(idOf(file, 'classes', 'bard')).toBeLessThan(idOf(file, 'classes', 'wizard')!);
  });

  it('sub-bands domain cards by domain', () => {
    const { file } = buildRegistry(SOURCE, EMPTY);
    const band = bandFor('domainCards');
    // arcana is the first domain, so its cards sit in the first hundred.
    expect(idOf(file, 'domainCards', 'rune-ward')).toBeGreaterThan(band.min + 100);
    expect(idOf(file, 'domainCards', 'rune-ward')).toBeLessThan(band.min + 200);
    expect(idOf(file, 'domainCards', 'book-of-ava')).toBeGreaterThan(band.min + 400);
  });

  /*
   * The tenth domain, which is the whole reason the base table exists - and
   * now, at last, testable end to end.
   *
   * While there were nine domains the table and the derivation it replaced
   * (`band.min + (DOMAINS.indexOf(domain) + 1) * 100`) agreed on every value,
   * so no test could tell them apart and a mutant restoring the derivation
   * passed the whole suite. `dread` is the first domain that separates them,
   * and it does so twice over:
   *
   *   - Appended, its index is 9, so the derivation computes base 6000 and a
   *     window of 6001-6099 - inside the BEASTFORMS band, where 6001-6022 are
   *     real ids already on the wire. A domain card would decode as `bear`.
   *   - Inserted alphabetically instead - between `codex` and `grace` - it
   *     would take index 4 and `grace`'s hundred, and shift every later
   *     domain. That is the failure `shared/types.ts` appends to avoid, and
   *     `codec.ts` is where it would have been paid.
   *
   * This mints a real card and looks at the number it got.
   */
  it('mints a dread card in its own hundred, not in the one its spelling implies', () => {
    const { file } = buildRegistry(
      { domainCards: [{ id: 'summon-horror', domain: 'dread' }] },
      EMPTY,
    );
    const id = idOf(file, 'domainCards', 'summon-horror')!;
    expect(id).toBeGreaterThan(12_100);
    expect(id).toBeLessThan(12_200);

    // What the derivation would have produced instead, and why it is not merely
    // a different number: that window is somebody else's.
    const derived = 5000 + (DOMAINS.indexOf('dread') + 1) * 100;
    expect(derived).toBe(6000);
    expect(id).not.toBe(derived + 1);
    expect(bandOf(derived + 1)?.collections, 'the derived window is the beastforms band').toContain(
      'beastforms',
    );
  });

  it('gives every domain this build knows a window of its own', () => {
    /*
     * The GENERIC guard, restored. It was replaced by the two dread-specific
     * tests above when dread arrived, and that was a mistake: those pin the
     * tenth domain and say nothing about an eleventh, which would have reached
     * the wire with no window and nothing red. This is the one that fires the
     * day `DOMAINS` and `DOMAIN_CARD_BASES` stop agreeing, whichever domain
     * does it.
     */
    for (const domain of DOMAINS) {
      expect(DOMAIN_CARD_BASES[domain], `${domain} has no id window`).toBeTypeOf('number');
    }
    const bases = Object.values(DOMAIN_CARD_BASES);
    expect(new Set(bases).size, 'two domains share a hundred').toBe(bases.length);
    for (const base of bases) {
      const home = BANDS.find(
        (b) => b.collections.includes('domainCards') && base + 1 >= b.min && base + 99 <= b.max,
      );
      expect(home, `the hundred at ${base} is not inside any domain-card band`).toBeDefined();
    }
  });

  it('keeps dread out of the beastforms band, which the computed window fell into', () => {
    // The other half of the defect: whatever a tenth domain was called, the
    // computed window was 6001-6099, and 6001-6022 are beastform ids.
    const base = DOMAIN_CARD_BASES['dread']!;
    expect(bandOf(base + 1)?.collections).toContain('domainCards');
    expect(bandOf(base + 99)?.collections).not.toContain('beastforms');
    expect(bandOf(6001)?.collections).toContain('beastforms');
  });

  it('refuses to overflow a band rather than spilling into the next one', () => {
    const many = Array.from({ length: 1200 }, (_u, i) => ({ id: `class-${String(i).padStart(4, '0')}` }));
    expect(() => buildRegistry({ classes: many }, EMPTY)).toThrow(/band is full/);
  });
});

describe('append-only', () => {
  it('keeps every existing id byte for byte when new content arrives', () => {
    const first = buildRegistry(SOURCE, EMPTY).file;
    const grown: SlugSource = {
      ...SOURCE,
      classes: [...SOURCE.classes!, { id: 'aardvark-tamer' }, { id: 'zealot' }],
      domainCards: [...SOURCE.domainCards!, { id: 'aaa-first-alphabetically', domain: 'arcana' }],
    };
    const second = buildRegistry(grown, first);

    for (const [key, id] of Object.entries(first.ids)) {
      expect(second.file.ids[key], `${key} moved`).toBe(id);
    }
    // Even a slug that sorts first gets a new id, at the end of its sub-band.
    const arcana = ['rune-ward', 'unleash-chaos'].map((slug) => idOf(first, 'domainCards', slug)!);
    expect(idOf(second.file, 'domainCards', 'aaa-first-alphabetically')).toBeGreaterThan(
      Math.max(...arcana),
    );
    expect(second.added.map((a) => a.slug).sort()).toEqual([
      'aaa-first-alphabetically',
      'aardvark-tamer',
      'zealot',
    ]);
  });

  it('keeps the id of content that has left the dataset', () => {
    const first = buildRegistry(SOURCE, EMPTY).file;
    const shrunk: SlugSource = { ...SOURCE, classes: [{ id: 'wizard' }] };
    const second = buildRegistry(shrunk, first);

    expect(idOf(second.file, 'classes', 'bard')).toBe(idOf(first, 'classes', 'bard'));
    expect(second.retired).toContain('classes/bard');
    // And the freed number is never handed to somebody else.
    const third = buildRegistry({ ...shrunk, classes: [{ id: 'wizard' }, { id: 'newcomer' }] }, second.file);
    expect(idOf(third.file, 'classes', 'newcomer')).not.toBe(idOf(first, 'classes', 'bard'));
  });

  it('is idempotent: running it twice writes the same bytes', () => {
    const once = buildRegistry(SOURCE, EMPTY).file;
    const twice = buildRegistry(SOURCE, once).file;
    expect(serializeRegistry(twice)).toBe(serializeRegistry(once));
  });

  /*
   * Rewritten for version 2. This used to assert that a slug in two collections
   * got ONE id and a warning, which is exactly what SRD 2.0's `hold-the-line`
   * broke: a Valor domain card and an Event environment are two records and
   * cannot share a number. Now each gets its own, and what is worth pinning is
   * which of them the BARE name still resolves to.
   */
  it('gives a slug in two collections two ids, and the bare name to the first collection', () => {
    const clash: SlugSource = {
      classes: [{ id: 'shared-name' }],
      weapons: [{ id: 'shared-name' }],
    };
    const result = buildRegistry(clash, EMPTY);
    const asClass = idOf(result.file, 'classes', 'shared-name')!;
    const asWeapon = idOf(result.file, 'weapons', 'shared-name')!;
    expect(asClass).not.toBe(asWeapon);
    expect(bandOf(asClass)!.name).toBe('classes');
    expect(bandOf(asWeapon)!.name).toBe('weapons');

    // `classes` comes before `weapons` in BANDED_COLLECTIONS, so it wins.
    const loaded = createRegistry(result.file);
    expect(loaded.idOf('shared-name')).toBe(asClass);
    expect(loaded.idIn('weapons', 'shared-name')).toBe(asWeapon);
    expect(result.warnings.join(' ')).toMatch(/each keeps its own id/);
  });
});

describe('createRegistry', () => {
  const V = REGISTRY_VERSION;

  it('rejects a duplicate id', () => {
    expect(() => createRegistry({ version: V, ids: { 'classes/a': 1001, 'classes/b': 1001 } })).toThrow(
      /used by both/,
    );
  });

  it('rejects an id in the reserved range', () => {
    expect(() => createRegistry({ version: V, ids: { 'classes/a': RESERVED_MIN } })).toThrow(/reserved/);
  });

  it('rejects an id outside every band', () => {
    expect(() => createRegistry({ version: V, ids: { 'classes/a': 42 } })).toThrow(/outside every band/);
  });

  it('resolves both ways', () => {
    const r = createRegistry({ version: V, ids: { 'classes/wizard': 1009 } });
    expect(r.idOf('wizard')).toBe(1009);
    expect(r.idIn('classes', 'wizard')).toBe(1009);
    expect(r.slugOf(1009)).toBe('wizard');
    expect(r.keyOf(1009)).toBe('classes/wizard');
    expect(r.idOf('nobody')).toBeNull();
    expect(r.slugOf(9999)).toBeNull();
    expect(r.idIn('weapons', 'wizard')).toBeNull();
  });
});

describe('unresolvable references', () => {
  it('parks an id in a shape no slug can collide with', () => {
    // `slugify` only ever emits [a-z0-9-], so a leading "?" is always ours.
    expect(unresolvedRef(5123)).toBe('?5123');
    expect(isUnresolvedRef('?5123')).toBe(true);
    expect(unresolvedIdOf('?5123')).toBe(5123);
    expect(isUnresolvedRef('rune-ward')).toBe(false);
    expect(isUnresolvedRef('?not-a-number')).toBe(false);
    expect(unresolvedIdOf('rune-ward')).toBeNull();
  });
});

describe('the committed data/registry.json', () => {
  it('satisfies every rule the codec assumes', () => {
    expect(existsSync(REGISTRY_PATH)).toBe(true);
    const file = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
    // createRegistry throws on duplicates, reserved ids and out-of-band ids.
    const loaded = createRegistry(file);
    expect(loaded.size).toBe(Object.keys(file.ids).length);
    expect(registry.size).toBe(loaded.size);
  });

  /**
   * Pinned by hand, because every other check in this file compares the
   * registry against something derived from the registry: feed the committed
   * file back into the generator and of course the ids come out unchanged.
   * Only a literal written down here fails when somebody edits the file.
   *
   * `wizard` and `elf` are the two Architecture 5.1 prints. The third print in
   * that section, `arcana-rune-ward -> 5101`, is fiction: no such slug is in
   * the dataset or the registry, and 5101 is `domainCards/adjust-reality`. The
   * real card is `rune-ward` at 5117, and arcana's window is where it sits.
   */
  it('agrees with DOMAIN_CARD_BASES, which is what makes that table the wire', () => {
    /*
     * The table is only true if the committed file already says so. Every base
     * here was read off `data/registry.json` rather than chosen, so this test is
     * the one that would have caught the transcription going wrong - and it is
     * the guard that keeps a later edit from moving a hundred that is already
     * on scanned frames.
     */
    const committed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
    const srd = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as {
      domainCards: { id: string; domain: string }[];
    };
    const seen = new Map<string, Set<number>>();
    for (const card of srd.domainCards) {
      const id = committed.ids[registryKey('domainCards', card.id)];
      if (id === undefined) continue;
      const bases = seen.get(card.domain) ?? new Set<number>();
      bases.add(Math.floor(id / 100) * 100);
      seen.set(card.domain, bases);
    }
    for (const [domain, bases] of seen) {
      expect([...bases], `${domain} cards are spread over more than one hundred`).toHaveLength(1);
      expect(DOMAIN_CARD_BASES[domain], `${domain} is not in DOMAIN_CARD_BASES`).toBe([...bases][0]);
    }
    /*
     * A superset, not an equality. The table may know a domain the committed
     * dataset does not have yet - which is exactly where `dread` is: it has a
     * hundred reserved and no cards minted, because `data/srd-1.0.json` is
     * still SRD 1.0. Requiring equality would make reserving a window ahead of
     * the book impossible, and reserving it ahead is the entire point.
     */
    for (const domain of seen.keys()) expect(Object.keys(DOMAIN_CARD_BASES)).toContain(domain);
  });

  it('still holds the ids the architecture documents', () => {
    expect(registry.idOf('wizard')).toBe(1009);
    expect(registry.idOf('elf')).toBe(3004);
    expect(registry.slugOf(1009)).toBe('wizard');
    expect(registry.slugOf(3004)).toBe('elf');

    const runeWard = registry.idOf('rune-ward')!;
    expect(runeWard).toBeGreaterThanOrEqual(5101);
    expect(runeWard).toBeLessThanOrEqual(5199);
  });

  const built = existsSync(SRD_PATH);
  describe.skipIf(!built)('against the built dataset', () => {
    // This one guards the *generator*, not the file: `buildRegistry` copies
    // what it is given, so it fails only if a future edit teaches it to
    // renumber. The hand-written pins above are what guard the file.
    it('never renumbers what it is handed', () => {
      const source = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as SlugSource;
      const committed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
      const rebuilt = buildRegistry(source, committed).file;

      for (const [key, id] of Object.entries(committed.ids)) {
        expect(rebuilt.ids[key], `${key} disappeared`).toBeDefined();
        expect(rebuilt.ids[key], `${key} moved from ${id} to ${rebuilt.ids[key]}`).toBe(id);
      }
    });

    it('gives every slug in the dataset an id in its own band', () => {
      const source = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as Record<
        string,
        Array<{ id: string }> | undefined
      >;
      const committed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
      /*
       * "A band for this kind", not "the first band naming this kind".
       * `bandFor('domainCards')` answers 5000-5999 and there is a second one,
       * `domainCards+` at 12000-13999, for the tenth domain onwards. SRD 2.0
       * opens ten domains, so `domainCards/blighting-strike` holds 12102 - a
       * correct id that the old form of this check called out of band.
       */
      let checked = 0;
      const continuation: string[] = [];
      for (const collection of BANDED_COLLECTIONS) {
        for (const entity of source[collection] ?? []) {
          const id = committed.ids[registryKey(collection, entity.id)];
          expect(id, `${collection}/${entity.id} has no id`).toBeDefined();
          const band = bandOf(id!);
          expect(band, `${collection}/${entity.id} holds ${id}, which is in no band at all`).not.toBeNull();
          expect(
            band!.collections,
            `${collection}/${entity.id} holds ${id}, in the ${band?.name ?? '?'} band`,
          ).toContain(collection);
          checked += 1;
          if (band !== bandFor(collection)) continuation.push(`${collection}/${entity.id}`);
        }
      }
      /*
       * Not vacuous, and this is the half that would have caught the bug
       * earlier: the shipped book really does put cards in the second band, so
       * a check that only ever looked at the first was passing by luck.
       */
      expect(checked).toBe(1359);
      expect(continuation).toHaveLength(21);
      expect(continuation.every((k) => k.startsWith('domainCards/'))).toBe(true);
    });

    it('is up to date with the dataset', () => {
      const source = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as SlugSource;
      const committed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
      const result = buildRegistry(source, committed);
      expect(
        result.added,
        `data/registry.json is missing ${result.added.length} id(s). Run: npm run build:registry`,
      ).toEqual([]);
    });
  });
});
