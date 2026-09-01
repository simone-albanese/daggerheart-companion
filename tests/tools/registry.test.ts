/**
 * The re-key: `data/registry.json` version 1 -> 2, bare slug -> `collection/slug`.
 *
 * SRD 2.0 prints an Event environment called *Hold the Line* (folio 164) beside
 * the Valor domain card of the same name (folio 223). `slugify` reduces both to
 * `hold-the-line`, version 1 of the registry had room for one id per slug, and
 * `tools/validate.ts` stopped the build with `duplicate id, already used by
 * domainCards`.
 *
 * The whole safety argument for fixing it by re-keying rather than by renaming
 * one of them is that **the numbers do not move**: the wire carries integers, so
 * a QR generated before this change and a `.dhchar` written before this change
 * decode to exactly the same records after it. These are the tests that make
 * that a property of the repository instead of a sentence in a report.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BANDED_COLLECTIONS,
  BANDS,
  bandOf,
  createRegistry,
  parseRegistryKey,
  registry,
  registryKey,
  REGISTRY_VERSION,
  type RegistryFile,
} from '../../src/transfer/registry.ts';
import { buildRegistry, migrateKeys, type SlugSource } from '../../tools/buildRegistry.ts';
import { validate, type Issue } from '../../tools/validate.ts';
import type { Dataset } from '../../shared/types.ts';

const REPO = new URL('../../', import.meta.url);
const REGISTRY_PATH = fileURLToPath(new URL('data/registry.json', REPO));
const SRD_PATH = fileURLToPath(new URL('data/srd-2.0.json', REPO));
/*
 * The book the app used to ship, still committed and still read HERE.
 *
 * Two checks below need a dataset with no cross-collection slug collision in
 * it, because what they test is what the validator does when one appears - and
 * SRD 2.0 has two real ones, so synthesising a third on top of it proves
 * nothing. And `V1_ROWS` needs the exact row set version 1 of the registry was
 * built from, which is this file's slugs and nothing else.
 */
const SRD1_PATH = fileURLToPath(new URL('data/srd-1.0.json', REPO));

const committed = (): RegistryFile => JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as RegistryFile;

/**
 * A fingerprint of "which number names which thing", and nothing else: the
 * sorted `id<TAB>bare-slug` lines, hashed. It ignores the key, which is the
 * half this change was allowed to move, and it notices any number changing
 * hands, any number disappearing and any number appearing.
 */
const nameDigest = (file: RegistryFile, only?: ReadonlySet<string>): string => {
  const lines = Object.entries(file.ids)
    .filter(([key]) => only === undefined || only.has(key))
    .map(([key, id]) => `${id}\t${parseRegistryKey(key)?.slug ?? key}`)
    .sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex');
};

/**
 * The exact set of rows version 1 of the registry held, DERIVED and not typed.
 *
 * Version 1 was built from `data/srd-1.0.json` and from nothing else, so its
 * row set is that file's slugs keyed by their collection - 771 of them, which
 * is the count version 1 carried. The switch to SRD 2.0 added 581 rows, so the
 * whole-file digest below could not stay a whole-file digest without either
 * being re-pinned (which would assert nothing) or the old rows being named one
 * by one (771 lines of them). This narrows it instead, and the pin survives.
 *
 * It is also the second reason `data/srd-1.0.json` is still in the tree: not
 * only can the 1.0 parse still be checked against it, this suite cannot state
 * "no number moved" without it.
 */
const V1_ROWS = ((): ReadonlySet<string> => {
  const srd = JSON.parse(readFileSync(SRD1_PATH, 'utf8')) as Record<
    string,
    Array<{ id: string }> | undefined
  >;
  const out = new Set<string>();
  for (const collection of BANDED_COLLECTIONS) {
    for (const entity of srd[collection] ?? []) out.add(registryKey(collection, entity.id));
  }
  return out;
})();

describe('the numbers did not move', () => {
  /**
   * PINNED BY HAND, and it is the only pin in this file that could not have been
   * derived from the file it checks.
   *
   * It was computed from the version-1 `data/registry.json` as committed on
   * branch `srd-2` - sha256
   * `dcc8f204de969a8142b56d475ca2ad85c078b720f82c627c9efddeae93582ed5`, 771 bare
   * rows - BEFORE the migration ran. Every other check here feeds the new file
   * into something derived from the new file; this one is the only one that
   * still knows what the old one said.
   */
  const V1_NAME_DIGEST = '136927a271d0f6b69f3b2ee90fd0649a521fe179f464fcb40e3090062c3d1d92';

  it('names every number exactly what version 1 named it', () => {
    // Not vacuous: the row set really is derived, and it really is 771 of the
    // 1352 rows the file now holds, so a digest over the wrong subset fails.
    expect(V1_ROWS.size).toBe(771);
    expect(Object.keys(committed().ids).length).toBeGreaterThan(V1_ROWS.size);
    expect(nameDigest(committed(), V1_ROWS)).toBe(V1_NAME_DIGEST);
  });

  it('kept the nine weapons SRD 2.0 stopped printing, on their own numbers', () => {
    /*
     * The one rule, at the only moment it has ever been load-bearing. These
     * nine slugs are in `data/srd-1.0.json` and in no collection of
     * `data/srd-2.0.json`, so the switch is the first build in which a row had
     * to survive its record leaving the dataset. A recycled id here would turn
     * somebody's Ghostblade into whichever weapon took the number.
     */
    const file = committed();
    const nine = {
      'weapons/axe-of-fortunis': 7039,
      'weapons/blessed-anlace': 7043,
      'weapons/firestaff': 7063,
      'weapons/ghostblade': 7067,
      'weapons/gilded-bow': 7068,
      'weapons/ilmaris-rifle': 7084,
      'weapons/mage-orb': 7164,
      'weapons/runes-of-ruination': 7178,
      'weapons/widogast-pendant': 7203,
    };
    const shipped = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as { weapons: Array<{ id: string }> };
    const printed = new Set(shipped.weapons.map((w) => w.id));
    for (const [key, id] of Object.entries(nine)) {
      expect(printed.has(key.slice('weapons/'.length)), `${key} is still printed`).toBe(false);
      expect(file.ids[key], `${key} lost or moved its id`).toBe(id);
    }
    // And nothing else took those numbers.
    const taken = Object.entries(file.ids).filter(([k, v]) => Object.values(nine).includes(v) && !(k in nine));
    expect(taken).toEqual([]);
  });

  it('still holds the three ids the architecture documents, and the colliding one', () => {
    expect(registry.idOf('wizard')).toBe(1009);
    expect(registry.idOf('elf')).toBe(3004);
    expect(registry.idOf('rune-ward')).toBe(5117);
    // The slug SRD 2.0 collides with. It was 5910 before the re-key and is 5910
    // after it; what changed is that it now says out loud which one it is.
    expect(registry.idOf('hold-the-line')).toBe(5910);
    expect(registry.keyOf(5910)).toBe('domainCards/hold-the-line');
    expect(registry.idIn('domainCards', 'hold-the-line')).toBe(5910);
    /*
     * And now the other half of the collision exists. SRD 1.0 printed no
     * environment by that name and this line read `.toBeNull()`; SRD 2.0
     * prints one, so it has its own row in the environments band - which is
     * the whole point of the version-2 key. The bare `idOf` above still
     * answers with the card, because `BANDED_COLLECTIONS` puts domainCards
     * first and that is what a stored SRD 1.0 character means by the name.
     */
    expect(registry.idIn('environments', 'hold-the-line')).toBe(11_034);
  });

  it('keys every committed row by the collection the dataset actually puts it in', () => {
    const file = committed();
    const srd = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as Record<
      string,
      Array<{ id: string }> | undefined
    >;
    const owners = new Map<string, string[]>();
    for (const collection of BANDED_COLLECTIONS) {
      for (const entity of srd[collection] ?? []) {
        owners.set(entity.id, [...(owners.get(entity.id) ?? []), collection]);
      }
    }
    for (const key of Object.keys(file.ids)) {
      const parsed = parseRegistryKey(key);
      expect(parsed, `"${key}" is not collection/slug`).not.toBeNull();
      const owner = owners.get(parsed!.slug);
      /*
       * A RETIRED row has no owner to disagree with, and that is not a hole.
       * The switch left nine weapons in the registry that no collection of the
       * shipped dataset prints, and the rule is that they keep their ids
       * forever; `buildRegistry` derives their key from the band the id
       * already sits in. So the check is: if the dataset still prints the
       * slug, the key must name a collection that prints it; if it does not,
       * the key's collection must be the one its BAND is for.
       */
      if (owner === undefined) {
        expect(
          bandOf(file.ids[key]!)?.collections,
          `${key} is retired and keyed outside its own band`,
        ).toContain(parsed!.collection);
        continue;
      }
      expect(owner, `${key} is keyed by a collection the dataset disagrees with`)
        .toContain(parsed!.collection);
    }
    // Not vacuous: some rows really are retired, and some really are not.
    const retired = Object.keys(file.ids).filter((k) => !owners.has(parseRegistryKey(k)!.slug));
    expect(retired).toHaveLength(9);
    expect(Object.keys(file.ids)).toHaveLength(1352);
    expect(file.version).toBe(REGISTRY_VERSION);
  });
});

describe('migrateKeys', () => {
  const source: SlugSource = { classes: [{ id: 'wizard' }, { id: 'bard' }] };

  it('rewrites keys and copies every value untouched', () => {
    const v1: RegistryFile = { version: 1, ids: { wizard: 1009, bard: 1001 } };
    const { file } = migrateKeys(v1, source);
    expect(file.version).toBe(REGISTRY_VERSION);
    expect(file.ids).toEqual({ 'classes/wizard': 1009, 'classes/bard': 1001 });
    expect(Object.values(file.ids).sort()).toEqual(Object.values(v1.ids).sort());
  });

  it('leaves a file that is already version 2 exactly as it found it', () => {
    const v2: RegistryFile = { version: REGISTRY_VERSION, ids: { 'classes/wizard': 1009 } };
    expect(migrateKeys(v2, source).file).toBe(v2);
  });

  it('refuses a version it does not know rather than guessing at the keys', () => {
    expect(() => migrateKeys({ version: 7, ids: {} }, source)).toThrow(/knows 1 and 2/);
  });

  /*
   * FIRST COLLECTION WINS, and this is the assertion that says so.
   *
   * Under version 1 a slug had one id, so when two collections printed the same
   * name the build warned and the first one kept it. Under version 2 both get a
   * key, and the migration still has to decide which collection owns the id the
   * OLD file minted - because that id is on somebody's saved character.
   *
   * An independent verifier deleted the `!owner.has()` guard, making the LAST
   * collection win instead. Every test passed. Fed the committed version-1 file
   * it moves 681 rows, and it flips both of the book's real collisions:
   * `hold-the-line` becomes the environment and `vampire` the transformation.
   * The pinned digest cannot see it either, because it hashes id -> BARE slug
   * and the bare slug is exactly what does not change.
   */
  it('gives a colliding slug to the first collection, so an old id keeps its meaning', () => {
    const both: SlugSource = {
      domainCards: [{ id: 'hold-the-line', domain: 'valor' }],
      environments: [{ id: 'hold-the-line' }],
    };
    const v1: RegistryFile = { version: 1, ids: { 'hold-the-line': 5910 } };
    const { file } = migrateKeys(v1, both);
    expect(file.ids).toEqual({ 'domainCards/hold-the-line': 5910 });
    expect(file.ids['environments/hold-the-line']).toBeUndefined();
  });

  it('does the same for the second collision the book prints', () => {
    const both: SlugSource = {
      adversaries: [{ id: 'vampire' }],
      transformations: [{ id: 'vampire' }],
    };
    const v1: RegistryFile = { version: 1, ids: { vampire: 10117 } };
    expect(migrateKeys(v1, both).file.ids).toEqual({ 'adversaries/vampire': 10117 });
  });

  /*
   * The rule `tools/buildRegistry.ts` opens with: a slug that has left the
   * dataset keeps its id forever. It has to survive the re-key too, and a
   * retired slug is the one case where the dataset cannot say which collection
   * it belonged to - so the id's own band answers instead.
   */
  it('carries a retired row across, keyed from the band its id sits in', () => {
    const v1: RegistryFile = { version: 1, ids: { wizard: 1009, 'gone-forever': 9042 } };
    const { file, notes } = migrateKeys(v1, source);
    expect(file.ids['loot/gone-forever']).toBe(9042);
    expect(notes.join(' ')).toMatch(/retired "gone-forever" \(9042\) keyed as loot/);
    // The items band is the one band that names two collections, so the note
    // says so rather than pretending the choice was free.
    expect(notes.join(' ')).toMatch(/consumables/);
  });

  it('keeps a retired row through a rebuild, and never hands its number out again', () => {
    const v1: RegistryFile = { version: 1, ids: { wizard: 1009, 'gone-forever': 9042 } };
    const result = buildRegistry(source, v1);
    expect(result.file.ids['loot/gone-forever']).toBe(9042);
    expect(result.retired).toContain('loot/gone-forever');

    const grown = buildRegistry({ ...source, loot: [{ id: 'newcomer' }] }, result.file);
    expect(grown.file.ids['loot/newcomer']).not.toBe(9042);
    expect(grown.file.ids['loot/gone-forever']).toBe(9042);
  });

  /*
   * The price of keying a retired row by band, stated in the docblock and
   * measured here: if the guess was wrong the slug comes back with a NEW id in
   * the same band, and the bare name still resolves to the older number - so
   * nothing a character already stores changes meaning.
   */
  it('costs one id and no meaning when the band guess was wrong', () => {
    // Retired at the moment of the re-key, so the band has to answer: `loot`.
    const v1: RegistryFile = { version: 1, ids: { 'gone-forever': 9042 } };
    const migrated = migrateKeys(v1, {}).file;
    expect(migrated.ids).toEqual({ 'loot/gone-forever': 9042 });

    // And then it comes back, as the other collection in that band.
    const back = buildRegistry({ consumables: [{ id: 'gone-forever' }] }, migrated);
    const minted = back.file.ids['consumables/gone-forever']!;
    expect(minted).not.toBe(9042);
    expect(back.file.ids['loot/gone-forever']).toBe(9042);
    // One id wasted, no meaning changed: the bare name still resolves to the
    // number that was already on the wire.
    expect(createRegistry(back.file).idOf('gone-forever')).toBe(9042);
  });
});

describe('the version gate', () => {
  it('refuses a version-1 file instead of resolving nothing', () => {
    expect(() => createRegistry({ version: 1, ids: { wizard: 1009 } })).toThrow(
      /version 1, this build reads version 2/,
    );
  });

  it('refuses a row that is not collection/slug', () => {
    expect(() => createRegistry({ version: REGISTRY_VERSION, ids: { wizard: 1009 } })).toThrow(
      /is not "collection\/slug"/,
    );
    expect(() =>
      createRegistry({ version: REGISTRY_VERSION, ids: { 'classes/a/b': 1009 } }),
    ).toThrow(/is not "collection\/slug"/);
  });
});

describe('the collision SRD 2.0 prints', () => {
  /** Both records, at the numbers a build of SRD 2.0 would hand them. */
  const both = createRegistry({
    version: REGISTRY_VERSION,
    ids: { 'domainCards/hold-the-line': 5910, 'environments/hold-the-line': 11_020 },
  });

  it('gives the two records two ids in two bands', () => {
    expect(both.idIn('domainCards', 'hold-the-line')).toBe(5910);
    expect(both.idIn('environments', 'hold-the-line')).toBe(11_020);
    expect(both.size).toBe(2);
  });

  it('gives the bare name to the domain card, which is the one a loadout can hold', () => {
    expect(both.idOf('hold-the-line')).toBe(5910);
    expect(both.keyOf(5910)).toBe('domainCards/hold-the-line');
    expect(both.keyOf(11_020)).toBe('environments/hold-the-line');
    // Both directions still name the bare slug, because a `Ref` is a bare slug.
    expect(both.slugOf(5910)).toBe('hold-the-line');
    expect(both.slugOf(11_020)).toBe('hold-the-line');
  });

  it('does not depend on the order the file happens to list them in', () => {
    const reversed = createRegistry({
      version: REGISTRY_VERSION,
      ids: { 'environments/hold-the-line': 11_020, 'domainCards/hold-the-line': 5910 },
    });
    expect(reversed.idOf('hold-the-line')).toBe(5910);
  });

  it('warns when a new row takes a bare name off an existing one', () => {
    const existing: RegistryFile = {
      version: REGISTRY_VERSION,
      ids: { 'environments/hold-the-line': 11_020 },
    };
    const result = buildRegistry(
      {
        environments: [{ id: 'hold-the-line' }],
        domainCards: [{ id: 'hold-the-line', domain: 'valor' }],
      },
      existing,
    );
    expect(result.file.ids['environments/hold-the-line']).toBe(11_020);
    expect(result.warnings.join('\n')).toMatch(/now resolves to domainCards\/hold-the-line/);
  });
});

describe('the transformations band', () => {
  const band = BANDS.find((b) => b.name === 'transformations')!;

  it('is 14000-14999 and overlaps nothing', () => {
    expect([band.min, band.max]).toEqual([14_000, 14_999]);
    for (const other of BANDS) {
      if (other === band) continue;
      expect(other.min > band.max || other.max < band.min, `overlaps ${other.name}`).toBe(true);
    }
  });

  it('mints a transformation there, and nowhere near a domain card or a beastform', () => {
    const { file } = buildRegistry(
      { transformations: [{ id: 'werewolf' }, { id: 'vampire' }] },
      { version: REGISTRY_VERSION, ids: {} },
    );
    const werewolf = file.ids[registryKey('transformations', 'werewolf')]!;
    expect(werewolf).toBeGreaterThanOrEqual(14_001);
    expect(werewolf).toBeLessThanOrEqual(14_999);
    expect(file.ids['transformations/vampire']).toBeLessThan(werewolf);
  });

  it('is last in the precedence, because nothing on a character points at one', () => {
    expect(BANDED_COLLECTIONS[BANDED_COLLECTIONS.length - 1]).toBe('transformations');
    const r = createRegistry({
      version: REGISTRY_VERSION,
      ids: { 'transformations/vampire': 14_001, 'domainCards/vampire': 5601 },
    });
    expect(r.idOf('vampire')).toBe(5601);
  });

  it('holds exactly the six cards the shipped book prints, and no more', () => {
    /*
     * This read "adds no row to the committed registry, because SRD 1.0 has no
     * such chapter". SRD 2.0 has one, so the empty band was the SHIPPED BOOK's
     * answer and not the band's - which is exactly what the check was for. It
     * now asks the same question of the book that is actually shipped.
     */
    const shipped = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as {
      transformations: Array<{ id: string }>;
    };
    const rows = Object.keys(committed().ids).filter((k) => k.startsWith('transformations/'));
    expect(rows.sort()).toEqual(shipped.transformations.map((t) => `transformations/${t.id}`).sort());
    expect(rows).toHaveLength(6);
    for (const key of rows) {
      const id = committed().ids[key]!;
      expect(id).toBeGreaterThanOrEqual(14_001);
      expect(id).toBeLessThanOrEqual(14_999);
    }
  });
});

describe('what the re-key did not touch', () => {
  it('still warns about an id outside its band instead of moving it', () => {
    const existing: RegistryFile = { version: REGISTRY_VERSION, ids: { 'classes/wizard': 7001 } };
    const result = buildRegistry({ classes: [{ id: 'wizard' }] }, existing);
    expect(result.file.ids['classes/wizard']).toBe(7001);
    expect(result.warnings.join(' ')).toMatch(/outside the classes band/);
  });

  it('still refuses to spill out of a full band', () => {
    const many = Array.from({ length: 1200 }, (_u, i) => ({
      id: `class-${String(i).padStart(4, '0')}`,
    }));
    expect(() =>
      buildRegistry({ classes: many }, { version: REGISTRY_VERSION, ids: {} }),
    ).toThrow(/band is full/);
  });

  it('still sub-bands by domain, and still parks an unreadable domain in the pool', () => {
    const { file } = buildRegistry(
      {
        domainCards: [
          { id: 'summon-horror', domain: 'dread' },
          { id: 'rune-ward', domain: 'arcana' },
          { id: 'mystery-card', domain: 'not-a-domain' },
        ],
      },
      { version: REGISTRY_VERSION, ids: {} },
    );
    // dread's hundred is the one that could not be derived; arcana's is the first.
    expect(file.ids['domainCards/summon-horror']).toBeGreaterThan(12_100);
    expect(file.ids['domainCards/summon-horror']).toBeLessThan(12_200);
    expect(file.ids['domainCards/rune-ward']).toBeGreaterThan(5100);
    expect(file.ids['domainCards/rune-ward']).toBeLessThan(5200);
    // A domain this build cannot read gets the pool at the foot of the band,
    // never a real domain's hundred.
    expect(file.ids['domainCards/mystery-card']).toBeGreaterThanOrEqual(5001);
    expect(file.ids['domainCards/mystery-card']).toBeLessThanOrEqual(5099);
  });
});

/**
 * The gate that used to say "ids must be unique across the whole dataset", and
 * that stopped the SRD 2.0 build. It now says what it always meant.
 */
describe('the duplicate-id check in tools/validate.ts', () => {
  /*
   * SRD 1.0 on purpose. The two checks that synthesise a collision need a
   * dataset that has none, and SRD 2.0 has two real ones - `vampire`
   * (adversary folio 142 vs transformation folio 45) and `hold-the-line`
   * (environment vs Valor card). The check directly below asserts on those two
   * against the shipped file; everything after it bends this one.
   */
  const dataset = (): Dataset => JSON.parse(readFileSync(SRD1_PATH, 'utf8')) as Dataset;
  const errors = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === 'error');
  const warnings = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === 'warning');

  it('passes the SRD 1.0 dataset with no id complaint at all', () => {
    const said = validate(dataset())
      .filter((i) => /duplicate id|the slug is also/.test(i.message))
      .map((i) => `${i.severity} ${i.where}: ${i.message}`);
    expect(said).toEqual([]);
  });

  it('warns about the shipped dataset\'s two real collisions, and errors on neither', () => {
    /*
     * The gate that used to say "ids must be unique across the whole dataset"
     * is what stopped the SRD 2.0 build. This is the shipped book going
     * through it: two warnings, both naming the other collection, zero errors.
     * If it ever went quiet, the build would be shipping a byRef lookup that
     * silently answers with the wrong kind and nothing would say so.
     */
    const shipped = JSON.parse(readFileSync(SRD_PATH, 'utf8')) as Dataset;
    const issues = validate(shipped).filter((i) => /duplicate id|the slug is also/.test(i.message));
    expect(errors(issues)).toEqual([]);
    expect(warnings(issues).map((i) => i.where).sort()).toEqual([
      'adversaries/vampire',
      'environments/hold-the-line',
    ]);
  });

  it('still errors when ONE collection prints the same slug twice', () => {
    const ds = dataset();
    ds.environments = [...ds.environments, { ...ds.environments[0]! }];
    const said = errors(validate(ds)).filter((i) => /duplicate id inside/.test(i.message));
    expect(said).toHaveLength(1);
    expect(said[0]!.where).toBe(`environments/${ds.environments[0]!.id}`);
  });

  /*
   * The SRD 2.0 case, reproduced on SRD 1.0's own records: the Valor card
   * `hold-the-line` (which is really in this dataset, at id 5910) plus an
   * environment of the same name. This is what used to be a fatal error.
   */
  it('lets two collections share a slug, and warns instead of failing the build', () => {
    const ds = dataset();
    expect(ds.domainCards.some((c) => c.id === 'hold-the-line')).toBe(true);
    ds.environments = [...ds.environments, { ...ds.environments[0]!, id: 'hold-the-line' }];

    const issues = validate(ds);
    expect(errors(issues).filter((i) => /duplicate id/.test(i.message))).toEqual([]);
    const warned = warnings(issues).filter((i) => i.where === 'environments/hold-the-line');
    expect(warned).toHaveLength(1);
    expect(warned[0]!.message).toMatch(/also domainCards\/hold-the-line/);
    expect(warned[0]!.message).toMatch(/indexDataset keys byRef by the slug alone/);
  });
});
