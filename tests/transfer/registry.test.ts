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
import {
  BANDED_COLLECTIONS,
  BANDS,
  RESERVED_MIN,
  bandFor,
  bandOf,
  createRegistry,
  isUnresolvedRef,
  registry,
  unresolvedIdOf,
  unresolvedRef,
  type RegistryFile,
} from '../../src/transfer/registry.ts';
import { buildRegistry, serializeRegistry, type SlugSource } from '../../tools/buildRegistry.ts';
import { SOURCE } from './fixtures.ts';

const EMPTY: RegistryFile = { version: 1, ids: {} };
const REPO = new URL('../../', import.meta.url);
const SRD_PATH = fileURLToPath(new URL('data/srd-1.0.json', REPO));
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
    const inBand = (slug: string, name: string): boolean => {
      const band = BANDS.find((b) => b.name === name)!;
      const id = file.ids[slug]!;
      return id >= band.min && id <= band.max;
    };
    expect(inBand('wizard', 'classes')).toBe(true);
    expect(inBand('school-of-war', 'subclasses')).toBe(true);
    expect(inBand('elf', 'ancestries')).toBe(true);
    expect(inBand('loreborne', 'communities')).toBe(true);
    expect(inBand('rune-ward', 'domainCards')).toBe(true);
    expect(inBand('nimble-grazer', 'beastforms')).toBe(true);
    expect(inBand('improved-wand', 'weapons')).toBe(true);
    expect(inBand('chainmail-armor', 'armors')).toBe(true);
    expect(inBand('arcane-cloak', 'items')).toBe(true);
    expect(inBand('attune-potion', 'items')).toBe(true);
    expect(inBand('jagged-knife-lackey', 'adversaries')).toBe(true);
    expect(inBand('abandoned-grove', 'environments')).toBe(true);
  });

  it('hands out ids in slug order, so the file reads like an index', () => {
    const { file } = buildRegistry({ classes: [{ id: 'wizard' }, { id: 'bard' }] }, EMPTY);
    expect(file.ids['bard']).toBeLessThan(file.ids['wizard']!);
  });

  it('sub-bands domain cards by domain', () => {
    const { file } = buildRegistry(SOURCE, EMPTY);
    const band = bandFor('domainCards');
    // arcana is the first domain, so its cards sit in the first hundred.
    expect(file.ids['rune-ward']).toBeGreaterThan(band.min + 100);
    expect(file.ids['rune-ward']).toBeLessThan(band.min + 200);
    expect(file.ids['book-of-ava']).toBeGreaterThan(band.min + 400);
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

    for (const [slug, id] of Object.entries(first.ids)) {
      expect(second.file.ids[slug], `${slug} moved`).toBe(id);
    }
    // Even a slug that sorts first gets a new id, at the end of its sub-band.
    const arcana = ['rune-ward', 'unleash-chaos'].map((slug) => first.ids[slug]!);
    expect(second.file.ids['aaa-first-alphabetically']).toBeGreaterThan(Math.max(...arcana));
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

    expect(second.file.ids['bard']).toBe(first.ids['bard']);
    expect(second.retired).toContain('bard');
    // And the freed number is never handed to somebody else.
    const third = buildRegistry({ ...shrunk, classes: [{ id: 'wizard' }, { id: 'newcomer' }] }, second.file);
    expect(third.file.ids['newcomer']).not.toBe(first.ids['bard']);
  });

  it('is idempotent: running it twice writes the same bytes', () => {
    const once = buildRegistry(SOURCE, EMPTY).file;
    const twice = buildRegistry(SOURCE, once).file;
    expect(serializeRegistry(twice)).toBe(serializeRegistry(once));
  });

  it('reports a slug claimed by two collections instead of renumbering it', () => {
    const clash: SlugSource = {
      classes: [{ id: 'shared-name' }],
      weapons: [{ id: 'shared-name' }],
    };
    const result = buildRegistry(clash, EMPTY);
    expect(result.warnings.join(' ')).toMatch(/more than one collection/);
    expect(bandOf(result.file.ids['shared-name']!)!.name).toBe('classes');
  });
});

describe('createRegistry', () => {
  it('rejects a duplicate id', () => {
    expect(() => createRegistry({ version: 1, ids: { a: 1001, b: 1001 } })).toThrow(/used by both/);
  });

  it('rejects an id in the reserved range', () => {
    expect(() => createRegistry({ version: 1, ids: { a: RESERVED_MIN } })).toThrow(/reserved/);
  });

  it('rejects an id outside every band', () => {
    expect(() => createRegistry({ version: 1, ids: { a: 42 } })).toThrow(/outside every band/);
  });

  it('resolves both ways', () => {
    const r = createRegistry({ version: 1, ids: { wizard: 1009 } });
    expect(r.idOf('wizard')).toBe(1009);
    expect(r.slugOf(1009)).toBe('wizard');
    expect(r.idOf('nobody')).toBeNull();
    expect(r.slugOf(9999)).toBeNull();
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
   * `wizard` and `elf` are the two Architecture 5.1 prints; `rune-ward` is the
   * `arcana-rune-ward -> 5101` example, and arcana's window is where it sits.
   */
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

      for (const [slug, id] of Object.entries(committed.ids)) {
        expect(rebuilt.ids[slug], `${slug} disappeared`).toBeDefined();
        expect(rebuilt.ids[slug], `${slug} moved from ${id} to ${rebuilt.ids[slug]}`).toBe(id);
      }
    });

    it('gives every slug in the dataset an id in its own band', () => {
      const source = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as Record<
        string,
        Array<{ id: string }> | undefined
      >;
      const committed = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;
      for (const collection of BANDED_COLLECTIONS) {
        const band = bandFor(collection);
        for (const entity of source[collection] ?? []) {
          const id = committed.ids[entity.id];
          expect(id, `${collection}/${entity.id} has no id`).toBeDefined();
          expect(
            id! >= band.min && id! <= band.max,
            `${entity.id} holds ${id}, outside the ${band.name} band`,
          ).toBe(true);
        }
      }
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
