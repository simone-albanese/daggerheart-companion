// @vitest-environment jsdom
/**
 * A character can hold a transformation.
 *
 * SRD 2.0 prints six cards on folios 43-45 - DEMIGOD, GHOST, REANIMATED,
 * SHAPESHIFTER, VAMPIRE, WEREWOLF - and until this lane nothing could point at
 * one. `Dataset.transformations` carried them, `shared/parsers/transformations.ts`
 * read them, and the field on `Character` that would have made them reachable
 * was the thing `shared/types.ts` explicitly declined to add.
 *
 * This file proves the five claims the field makes, and the one it must not.
 *
 *   1. it is HELD - `Character.transformationRef`, one nullable `Ref`, seeded
 *      by a converter on every schema-6 sheet;
 *   2. it is SHOWN, NEVER APPLIED - the derived stats of a sheet holding a
 *      transformation are equal, field for field, to the same sheet without it;
 *   3. it TRAVELS - `CODEC_VERSION` 4 carries it, a format-2 payload written by
 *      the previous build still decodes, and a receiver that cannot name the
 *      card parks the id rather than dropping it;
 *   4. it uses the EXACT lookup at both ends, because SRD 2.0 prints `vampire`
 *      twice and `BANDED_COLLECTIONS` did not move;
 *   5. it is FINDABLE, and REACHABLE from the sheet.
 *
 * ## The measurement this file is built on
 *
 * `npx tsx` over `shared/parsers/*` against `Manuali/DH_SRD_2_2026_08_25.pdf`,
 * 2026-09-01:
 *
 *   transformations 6: demigod, ghost, reanimated, shapeshifter, vampire,
 *   werewolf - two features and six questions each, folios 43/43/44/44/45/45
 *   slug clashes with adversaries: vampire
 *
 * That last line is the whole reason this file tests lookups rather than
 * assuming them. The fixtures below therefore give the adversary and the card
 * *different names* under one slug, for the reason `byRefPrecedence.test.ts`
 * gives about Hold the Line: a test using the book's own names could not tell
 * which of the two records it was holding.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Character, type Dataset, type Transformation } from '../shared/types.ts';
import { MIGRATIONS, migrateCharacterRecord } from '../shared/migrations.ts';
import { deriveStats, indexDataset, newCharacter } from '../src/engine/character.ts';
import { characterRefs } from '../src/engine/holdings.ts';
import {
  CODEC_VERSION,
  READABLE_CODEC_VERSIONS,
  decodeCharacter,
  encodeCharacter,
  missingSlugs,
  resolvePlaceholders,
} from '../src/transfer/codec.ts';
import {
  BANDED_COLLECTIONS,
  REGISTRY_VERSION,
  bandFor,
  createRegistry,
  registry,
  registryKey,
  unresolvedRef,
  type Registry,
} from '../src/transfer/registry.ts';
import { SRD_KINDS, SRD_KIND_LABELS, searchSrd, srdIndex } from '../src/ui/shared/srdIndex.ts';
import { useApp } from '../src/store/state.ts';
import { Edit } from '../src/ui/build/Edit.tsx';
import { feature, makeAdversary, makeDataset } from './fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const card = (p: Partial<Transformation> = {}): Transformation => ({
  id: 'vampire',
  name: 'The Card',
  description: 'Something took your blood and gave you back a hunger.',
  features: [
    { name: 'Fangs', text: 'When you Attack with your fangs, mark a Stress to deal extra damage.' },
    { name: 'Feed', text: 'You may drink from a willing or Restrained creature to clear a Hit Point.' },
  ],
  questions: ['Who made you?', 'What do you refuse to drink?'],
  sourcePage: 45,
  ...p,
});

/** The book's own collision: one slug, an adversary and a transformation. */
const adversary = makeAdversary({ id: 'vampire', name: 'The Adversary' });

const withCards = (extra: Partial<Dataset> = {}): Dataset =>
  makeDataset({ transformations: [card()], adversaries: [adversary], ...extra });

/**
 * The committed registry plus the two rows SRD 1.0 cannot supply.
 *
 * Built rather than mocked so `bandFor` decides the band: a transformation id
 * outside 14_000-14_999 is refused by `createRegistry`, and a test that minted
 * one by hand could drift out of the band the build tool uses.
 */
function registryWithVampire(options: { card?: boolean; adversary?: boolean } = {}): Registry {
  const { card: withCard = true, adversary: withAdversary = true } = options;
  const ids: Record<string, number> = {};
  for (const [key, id] of registry.entries()) ids[key] = id;
  /*
   * REMOVED and not merely un-added, and the switch is what made the
   * difference. This read `if (withAdversary) ids[...] = ...` over a copy of
   * the committed registry, which was enough while that registry held neither
   * key: SRD 1.0 printed no Transformations chapter and no adversary called
   * Vampire. The shipped registry now holds both, so `{ card: false }` stopped
   * building a receiver that cannot name the card - it built one that could,
   * and three checks in this describe went green-shaped and red.
   */
  const adversaryKey = registryKey('adversaries', 'vampire');
  const cardKey = registryKey('transformations', 'vampire');
  if (withAdversary) ids[adversaryKey] = bandFor('adversaries').min + 900;
  else delete ids[adversaryKey];
  if (withCard) ids[cardKey] = bandFor('transformations').min + 5;
  else delete ids[cardKey];
  return createRegistry({ version: REGISTRY_VERSION, ids });
}

const CARD_ID = bandFor('transformations').min + 5;
const ADVERSARY_ID = bandFor('adversaries').min + 900;

/** A sheet that can be encoded: every other ref is a real one. */
const sheet = (p: Partial<Character> = {}): Character =>
  newCharacter({
    id: '5f7c2a10-91b4-4d3e-8c07-6a1e2f9b3d45',
    name: 'Kaelith',
    classRef: 'wizard',
    subclassRefs: ['school-of-knowledge'],
    ancestryRefs: ['elf'],
    communityRef: 'loreborne',
    level: 5,
    hp: { marked: 0, max: 7 },
    createdAt: '2026-02-14T19:05:00.000Z',
    updatedAt: '2026-08-15T21:30:00.000Z',
    ...p,
  });

// ---------------------------------------------------------------------------
// 1. Held
// ---------------------------------------------------------------------------

describe('a character can hold one', () => {
  it('carries the field, nullable, seeded null on a blank sheet', () => {
    expect(newCharacter().transformationRef).toBeNull();
    expect(sheet({ transformationRef: 'vampire' }).transformationRef).toBe('vampire');
  });

  it('is the schema this bump is for, with the converter that leaves 6', () => {
    /*
     * The converter, not the constant. This read `expect(SCHEMA_VERSION).toBe(7)`
     * and went red on the next bump for a reason that has nothing to do with
     * transformations - the schema is 8 now, for the martial stances. What this
     * file is entitled to pin is that the step it shipped is still in the
     * chain and still says what it did.
     */
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(7);
    expect(MIGRATIONS.map((m) => m.from)).toContain(6);
    expect(MIGRATIONS.find((m) => m.from === 6)?.note).toBe(
      'a character can hold one transformation card, starting with none',
    );
  });

  it('gives a schema-6 record the field it never had, and changes nothing else', () => {
    const before: Record<string, unknown> = {
      schemaVersion: 6,
      name: 'Fixture',
      communityRef: 'highborne',
      scars: ['A ledger of names'],
    };
    const after = migrateCharacterRecord(before);

    expect(after.from).toBe(6);
    // The whole walk to the CURRENT schema, so the step this block is about
    // stays identifiable when a later one is appended behind it.
    expect(after.applied[0]).toBe('a character can hold one transformation card, starting with none');
    expect(after.record['transformationRef']).toBeNull();
    // Converting is not rewriting.
    expect(after.record['name']).toBe('Fixture');
    expect(after.record['communityRef']).toBe('highborne');
    expect(after.record['scars']).toEqual(['A ledger of names']);
    // And it does not mutate what it was handed.
    expect(before['transformationRef']).toBeUndefined();
  });

  it('believes the header over the field, the way the 3 -> 4 converter does', () => {
    // A record stamped 6 that already carries a schema-7 field is a record whose
    // own header is wrong. Overwriting is what stops a hand-edited file deciding
    // what the schema means.
    const migrated = migrateCharacterRecord({ schemaVersion: 6, transformationRef: 'werewolf' });
    expect(migrated.record['transformationRef']).toBeNull();
  });

  it('has committed fixtures on both sides of the bump', () => {
    // `process.cwd()` and not `import.meta.url`: under the jsdom environment
    // this file runs in, `import.meta.url` resolves against the document rather
    // than the module, which is the same footgun `attribution.test.tsx` names.
    const at = (name: string): Record<string, unknown> =>
      JSON.parse(
        readFileSync(join(process.cwd(), 'tests/fixtures/schema', name), 'utf8'),
      ) as Record<string, unknown>;

    const six = at('v6.dhchar')['character'] as Record<string, unknown>;
    const seven = at('v7.dhchar')['character'] as Record<string, unknown>;
    expect(Object.keys(six), 'the v6 fixture must not carry the field').not.toContain(
      'transformationRef',
    );
    expect(Object.keys(seven)).toContain('transformationRef');
    expect(seven['transformationRef']).toBeNull();
    expect(at('v7.dhchar')['schemaVersion']).toBe(7);
    expect(at('v7.dhbackup')['schemaVersion']).toBe(7);
  });

  it('is a reference the sheet walk knows about', () => {
    expect(characterRefs(sheet({ transformationRef: 'vampire' }))).toContain('vampire');
    expect(characterRefs(sheet())).not.toContain('vampire');
  });
});

// ---------------------------------------------------------------------------
// 2. Shown, never applied
// ---------------------------------------------------------------------------

describe('holding one moves no number on the sheet', () => {
  /*
   * The whole of owner decision 5, asked of every field `deriveStats` returns
   * rather than of the three the decision names. Evasion, thresholds and Stress
   * are the ones a player would notice; `maxHp`, `armorScore`, `proficiency`,
   * `maxHope`, `cardLevelCap` and the whole modifier ledger are the ones a
   * later edit would move without anybody looking.
   */
  it('derives the same stats with and without a transformation, field for field', () => {
    const ds = withCards();
    const ix = indexDataset(ds);
    const bare = sheet({ classRef: 'test-class', subclassRefs: [], ancestryRefs: [], communityRef: null });
    const held = { ...bare, transformationRef: 'vampire' };

    // The card really is resolvable, or this test proves nothing: an unresolved
    // ref would derive the same stats for the boring reason.
    expect(ix.collections.transformations.get('vampire')).toBeDefined();

    const without = deriveStats(bare, ds, ix);
    const with_ = deriveStats(held, ds, ix);
    expect(JSON.stringify(with_)).toBe(JSON.stringify(without));
    expect(with_.evasion).toBe(without.evasion);
    expect(with_.thresholds).toEqual(without.thresholds);
    expect(with_.maxStress).toBe(without.maxStress);
    expect(with_.maxHp).toBe(without.maxHp);
    expect(with_.armorScore).toBe(without.armorScore);
  });

  it('holds even when the card would be flattering to apply', () => {
    // A card whose text is full of the words a modifier collector might look
    // for. Nothing reads it, so nothing moves.
    const loud = card({
      id: 'demigod',
      features: [
        { name: 'Gifted', text: 'Gain a +3 bonus to your Evasion and your damage thresholds.' },
        { name: 'Weight of Divinity', text: 'Your Stress maximum increases by 2.' },
      ],
    });
    const ds = withCards({ transformations: [card(), loud] });
    const ix = indexDataset(ds);
    const bare = sheet({ classRef: 'test-class', subclassRefs: [], ancestryRefs: [], communityRef: null });
    expect(JSON.stringify(deriveStats({ ...bare, transformationRef: 'demigod' }, ds, ix))).toBe(
      JSON.stringify(deriveStats(bare, ds, ix)),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. It travels
// ---------------------------------------------------------------------------

describe('the wire', () => {
  it('keeps format 4 readable, and never makes 3 readable', () => {
    /*
     * This read `expect(CODEC_VERSION).toBe(4)`, which is a claim about
     * whatever this build writes rather than about the card. The build writes 8
     * now, for the martial stances. What THIS file is entitled to pin is that
     * the format the card shipped in is still readable - a format-4 QR in
     * somebody's photo roll still decodes - and the arithmetic that skipped 3.
     *
     * The version is the low nibble of byte 0, so what matters is which formats
     * a single bit flip can reach: from 3 that is 2 and 1, and 1 is the format
     * that carries no checksum of its own. `tests/adversarial.test.ts` is the
     * file that goes red on a wrong choice; this states why in one place a
     * reader will find it.
     */
    const readable = new Set<number>(READABLE_CODEC_VERSIONS);
    expect(readable.has(4)).toBe(true);
    for (const bit of [0, 1, 2, 3]) {
      expect(readable.has(CODEC_VERSION ^ (1 << bit)), `flipping bit ${bit}`).toBe(false);
    }
    expect(readable.has(3)).toBe(false);
  });

  it('carries the card, and back', async () => {
    const reg = registryWithVampire();
    const payload = await encodeCharacter(sheet({ transformationRef: 'vampire' }), reg);
    expect(payload[0]! & 0x0f).toBe(CODEC_VERSION);
    const { character, warnings } = await decodeCharacter(payload, reg);
    expect(character.transformationRef).toBe('vampire');
    expect(warnings).toEqual([]);
  });

  it('carries a null as a null', async () => {
    const reg = registryWithVampire();
    const { character } = await decodeCharacter(await encodeCharacter(sheet(), reg), reg);
    expect(character.transformationRef).toBeNull();
  });

  /**
   * The exact lookup, which is the trap this lane was warned about.
   *
   * `BANDED_COLLECTIONS` runs `adversaries` before `transformations`, so the
   * bare lookup answers `vampire` with the ADVERSARY. That order is not this
   * lane's to change - it decides what the bare name means for the whole app -
   * so the codec asks `idIn` instead, at both ends.
   */
  it('puts the CARD on the wire and not the adversary that shares its slug', async () => {
    const reg = registryWithVampire();
    expect(reg.idOf('vampire'), 'the bare lookup still answers with the adversary').toBe(
      ADVERSARY_ID,
    );
    expect(reg.idIn('transformations', 'vampire')).toBe(CARD_ID);

    const payload = await encodeCharacter(sheet({ transformationRef: 'vampire' }), reg, {
      compress: false,
    });
    // The card's id is in the bytes and the adversary's is not. Read off the
    // payload rather than trusted: a varint under 128 is one byte, and both ids
    // are far above that, so this is a search for the two-byte LEB128 encodings.
    const leb = (n: number): number[] => {
      const out: number[] = [];
      let v = n;
      while (v >= 0x80) {
        out.push((v % 0x80) + 0x80);
        v = Math.floor(v / 0x80);
      }
      out.push(v);
      return out;
    };
    const has = (needle: number[]): boolean =>
      [...payload].some((_, i) => needle.every((b, j) => payload[i + j] === b));
    expect(has(leb(CARD_ID)), `the card's id ${CARD_ID} is on the wire`).toBe(true);
    expect(has(leb(ADVERSARY_ID)), `the adversary's id ${ADVERSARY_ID} is not`).toBe(false);
  });

  it('refuses to guess when the id in the slot belongs to another collection', async () => {
    /*
     * The other half of exactness. A sender whose registry has only the
     * adversary writes nothing here - `writeIn` reports the slug missing - so
     * this is inbound traffic that was not written by this app. `slugOf` would
     * have answered `vampire` and the sheet would have drawn the CARD, with
     * nothing anywhere saying an adversary's number had been read as one.
     */
    const withBoth = registryWithVampire();
    const payload = await encodeCharacter(sheet({ transformationRef: 'vampire' }), withBoth);
    // A receiver whose registry knows the adversary and not the card.
    const receiver = registryWithVampire({ card: false });
    const { character, unresolved, warnings } = await decodeCharacter(payload, receiver);
    expect(character.transformationRef).toBe(unresolvedRef(CARD_ID));
    expect(unresolved).toEqual([CARD_ID]);
    expect(warnings.join(' ')).toMatch(/could not be found in this device's content/);
    // Nothing is discarded: the id is still on the sheet, and the next hop
    // forwards it untouched.
    expect(character.unresolvedRefs).toEqual([CARD_ID]);
    const again = await decodeCharacter(await encodeCharacter(character, receiver), receiver);
    expect(again.character.transformationRef).toBe(unresolvedRef(CARD_ID));
  });

  /*
   * THE COLLECTION CHECK ITSELF, which the test above does not reach.
   *
   * That one hands the receiver an id its registry does not hold at all, so
   * `keyOf` answers null and the guard is never consulted. Measured: delete
   * `parsed.collection === collection` from `readIn`, or
   * `parsed.collection !== collection` from `fixIn`, and the whole suite stays
   * green - 185 files, 4557 tests, both times. These two are what go red.
   *
   * The traffic is real rather than hypothetical. A parked id is opaque: it is
   * a number and nothing on the sheet says which collection it was minted in.
   * It is forwarded untouched from device to device, and the registry that
   * finally resolves it may be one where that number means something else.
   * SRD 2.0 prints `vampire` twice - a Transformation and an adversary - which
   * is the collision the bands exist to survive.
   */
  it('parks an id that resolves in ANOTHER collection instead of reading it as this one', async () => {
    const reg = registryWithVampire();
    // Encoding a parked ref is how such a payload is built without hand-writing
    // bytes: the format forwards the number untouched, checksum and all.
    const forwarded = sheet({
      transformationRef: unresolvedRef(ADVERSARY_ID),
      unresolvedRefs: [ADVERSARY_ID],
    });
    const { character, unresolved } = await decodeCharacter(
      await encodeCharacter(forwarded, reg),
      reg,
    );
    // `reg` DOES know this id - as `adversaries|vampire`. The slot is a
    // transformation, so parked is the only honest answer.
    expect(character.transformationRef).toBe(unresolvedRef(ADVERSARY_ID));
    expect(character.transformationRef).not.toBe('vampire');
    expect(unresolved).toEqual([ADVERSARY_ID]);
  });

  it('does not resolve a parked id against a slug that lives in another collection', () => {
    // The same guard on the other door: `resolvePlaceholders`, which is what
    // runs when a sheet reaches a device that has since gained the content.
    const parked = sheet({
      transformationRef: unresolvedRef(ADVERSARY_ID),
      unresolvedRefs: [ADVERSARY_ID],
    });
    const { character, resolved } = resolvePlaceholders(parked, registryWithVampire());
    expect(character.transformationRef).toBe(unresolvedRef(ADVERSARY_ID));
    expect(character.transformationRef).not.toBe('vampire');
    expect(resolved).toEqual([]);
  });

  it('names the card again on a device that has it', async () => {
    const receiver = registryWithVampire({ card: false });
    const parked = sheet({ transformationRef: unresolvedRef(CARD_ID), unresolvedRefs: [CARD_ID] });
    const { character, resolved } = resolvePlaceholders(parked, registryWithVampire());
    expect(character.transformationRef).toBe('vampire');
    expect(resolved).toEqual([CARD_ID]);
    // And it does not "resolve" against a registry that only has the adversary.
    expect(resolvePlaceholders(parked, receiver).character.transformationRef).toBe(
      unresolvedRef(CARD_ID),
    );
  });

  it('says so before the QR is offered, through the same exact lookup', () => {
    const noCard = registryWithVampire({ card: false });
    // The bare lookup would have found the adversary and reported nothing
    // missing, and `encodeCharacter` would then have thrown.
    expect(noCard.idOf('vampire')).toBe(ADVERSARY_ID);
    expect(missingSlugs(sheet({ transformationRef: 'vampire' }), noCard)).toEqual(['vampire']);
    expect(missingSlugs(sheet({ transformationRef: 'vampire' }), registryWithVampire())).toEqual([]);
  });

  /**
   * A payload written by the build before this one, read off disk.
   *
   * `tests/fixtures/codec/*.codec2.b64` are the bytes `encodeCharacter`
   * produced at `CODEC_VERSION = 2`. Re-encoding here would prove only that
   * this build can read its own output, which is not the question a
   * compatibility claim asks.
   */
  it('still decodes a format-2 QR written by the previous build', async () => {
    for (const name of ['wizard.codec2.b64', 'loadedWizard.codec2.b64']) {
      const bytes = Uint8Array.from(
        Buffer.from(
          readFileSync(join(process.cwd(), 'tests/fixtures/codec', name), 'utf8').trim(),
          'base64',
        ),
      );
      expect(bytes[0]! & 0x0f, name).toBe(2);
      const { character, warnings } = await decodeCharacter(bytes, registry);
      expect(character.name, name).toBe('Kaelith');
      expect(character.level, name).toBe(5);
      expect(character.classRef, name).toBe('wizard');
      expect(character.loadout.length, name).toBeGreaterThan(0);
      expect(warnings, name).toEqual([]);
      // The field a format-2 payload does not have, read as the absence it is
      // rather than as a hole. Nothing was dropped: there was nothing there.
      expect(character.transformationRef, name).toBeNull();
    }
  });

  it('fails loudly on a build that reads only 1 and 2, rather than dropping the field', async () => {
    /*
     * The old build is defined by its readable list, which was `[1, 2]`. What
     * this asserts is the two halves that make its refusal loud:
     *
     *   - the format number this build stamps is not in that list, so the
     *     version gate rejects the payload whole;
     *   - the gate is a THROW and it is read before the checksum, so an
     *     unreadable nibble is reported as an unreadable nibble.
     *
     * The second half is asked of this build with a nibble this build does not
     * read - 3 - because that is the same code path an old build ran.
     */
    const OLD_BUILD_READ = [1, 2];
    expect(OLD_BUILD_READ).not.toContain(CODEC_VERSION);

    const reg = registryWithVampire();
    const payload = await encodeCharacter(sheet({ transformationRef: 'vampire' }), reg);
    const future = payload.slice();
    future[0] = (future[0]! & 0xf0) | 3;
    await expect(decodeCharacter(future, reg)).rejects.toThrow(
      /says it is format 3, and this app reads 1 and 2 and 4/,
    );
    await expect(decodeCharacter(future, reg)).rejects.toThrow(
      /Either it came from a different version of the app, or it is damaged/,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Precedence, unmoved
// ---------------------------------------------------------------------------

describe('the registry order the field did not change', () => {
  it('leaves transformations below adversaries, so no bare name moves', () => {
    /*
     * This read `BANDED_COLLECTIONS.at(-1)` and went red when `stances` was
     * appended below it, which is not a change to what this block is about:
     * the position's whole job is that `vampire` keeps meaning the adversary.
     * That is the assertion, and it fails for exactly the change it always
     * would have.
     */
    expect(BANDED_COLLECTIONS.indexOf('adversaries')).toBeLessThan(
      BANDED_COLLECTIONS.indexOf('transformations'),
    );
  });

  it('resolves the bare slug to the adversary and the exact one to the card', () => {
    const ds = withCards();
    const ix = indexDataset(ds);
    expect((ix.byRef.get('vampire') as { name?: string }).name).toBe('The Adversary');
    expect(ix.collections.transformations.get('vampire')?.name).toBe('The Card');
    expect(ix.collections.adversaries.get('vampire')?.name).toBe('The Adversary');
  });
});

// ---------------------------------------------------------------------------
// 5. Findable
// ---------------------------------------------------------------------------

describe('the search', () => {
  const ds = withCards();
  const ix = srdIndex(ds);

  it('has a kind, a label and a place in the order', () => {
    expect(SRD_KINDS).toContain('transformation');
    expect(SRD_KIND_LABELS.transformation).toBe('TRANSFORMATIONS');
    // The dataset's own order: `Dataset` keeps `transformations` between
    // `communities` and `weapons`, following the book's contents page.
    expect(SRD_KINDS.indexOf('transformation')).toBe(SRD_KINDS.indexOf('community') + 1);
    // `stance` sits between it and `weapon` since schema 8, exactly where
    // `Dataset` keeps the collection. The claim here is the ORDER, so it is
    // stated as an order rather than as an offset that a neighbour can break.
    expect(SRD_KINDS.indexOf('transformation')).toBeLessThan(SRD_KINDS.indexOf('weapon'));
  });

  it('finds it by name', () => {
    const hits = searchSrd(ix, 'The Card');
    expect(hits.map((h) => h.kind)).toContain('transformation');
    expect(hits[0]?.where).toBe('title');
  });

  it('finds it by a word inside a feature, and quotes the line', () => {
    const [hit] = searchSrd(ix, 'fangs');
    expect(hit?.kind).toBe('transformation');
    expect(hit?.where).toBe('text');
    expect(hit?.line).toBe('Fangs');
  });

  it('finds it by one of its questions', () => {
    const [hit] = searchSrd(ix, 'refuse to drink');
    expect(hit?.id).toBe('vampire');
    expect(hit?.line).toBe('What do you refuse to drink?');
  });

  it('quotes only the book, never the app furniture', () => {
    const record = ix.find((r) => r.kind === 'transformation')!;
    const own = new Set(record.fields.flatMap((f) => f.lines));
    const source = card();
    const strings = new Set<string>([
      source.description,
      ...source.features.flatMap((f) => [f.name, f.text]),
      ...source.questions,
    ]);
    for (const line of record.fields.flatMap((f) => f.lines)) {
      expect(strings.has(line), `"${line}" is not one of the record's own strings`).toBe(true);
    }
    // The labels are the app's word and are never in the haystack.
    expect(record.haystack).not.toContain('QUESTIONS');
    expect(own.size).toBeGreaterThan(0);
  });

  it('stamps the folio the card is printed on', () => {
    expect(ix.find((r) => r.kind === 'transformation')?.page).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// 6. The door on the sheet
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(character: Character, ds: Dataset): void {
  const ix = indexDataset(ds);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset: ds,
    index: ix,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  act(() => {
    root.render(<Edit stats={deriveStats(character, ds, ix)} onLevelUp={() => {}} />);
  });
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim().toLowerCase().includes(text.toLowerCase()));
const press = (b: HTMLButtonElement | undefined): void => {
  expect(b, 'no such control on the sheet').toBeDefined();
  act(() => b!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};
const active = (): Character => useApp.getState().characters[0]!;

describe('adding and removing one from the sheet', () => {
  const withSix: Dataset = withCards({
    transformations: [
      card({ id: 'demigod', name: 'Demigod' }),
      card({ id: 'ghost', name: 'Ghost' }),
      card({ id: 'reanimated', name: 'Reanimated' }),
      card({ id: 'shapeshifter', name: 'Shapeshifter' }),
      card(),
      card({ id: 'werewolf', name: 'Werewolf' }),
    ],
  });

  it('draws no section at all on a dataset with no transformations', () => {
    mount(sheet({ classRef: 'test-class' }), makeDataset());
    expect(container.textContent).not.toContain('Transformation');
  });

  it('opens a picker of six, and every row is a full-width 44px target', () => {
    mount(sheet({ classRef: 'test-class' }), withSix);
    press(named('Add a transformation'));
    for (const name of ['Demigod', 'Ghost', 'Reanimated', 'Shapeshifter', 'The Card', 'Werewolf']) {
      expect(named(name), name).toBeDefined();
    }
    // jsdom computes no layout, so this is the DECLARATION the layout engine
    // then acts on - `var(--tap)` is the 44px floor, and `Choice` sets it.
    const row = named('Werewolf')!;
    expect(row.style.minHeight).toBe('var(--tap)');
    expect(row.style.width).toBe('100%');
    expect(row.getAttribute('aria-pressed')).toBe('false');
  });

  it('writes the ref and nothing else, and draws the features it wrote', async () => {
    const before = sheet({ classRef: 'test-class' });
    mount(before, withSix);
    press(named('Add a transformation'));
    press(named('Werewolf'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(active().transformationRef).toBe('werewolf');
    // Shown, never applied: the store's own sheet has one field different.
    const after = active();
    expect({ ...after, transformationRef: null, updatedAt: before.updatedAt }).toEqual(before);

    expect(container.textContent).toContain('Fangs');
    expect(container.textContent).toContain('mark a Stress to deal extra damage');
  });

  /**
   * Features above the prose, and the prose folded.
   *
   * Owner decision 5 is that the features are READABLE, and the book's own
   * order does not deliver that on a phone: measured in Chrome on the real
   * VAMPIRE card, printing the card's 1055 characters first put the `Fangs`
   * heading 371.79px below the top of the section against 92.05px with the
   * features first. This is the assertion that keeps the two in that order.
   */
  it('draws the features before anything else, and folds the card’s prose', () => {
    mount(sheet({ classRef: 'test-class', transformationRef: 'vampire' }), withSix);
    const panel = container.querySelector('.panel')!;
    const text = panel.textContent ?? '';
    expect(text).toContain('Fangs');
    expect(text, 'the prose is behind a fold').not.toContain('Something took your blood');
    expect(text.indexOf('Fangs')).toBeLessThan(text.indexOf('Read the card'));

    press(named('Read the card'));
    expect((container.querySelector('.panel')!.textContent ?? '')).toContain(
      'Something took your blood',
    );
  });

  it('removes it again, and the questions fold', async () => {
    mount(sheet({ classRef: 'test-class', transformationRef: 'vampire' }), withSix);
    expect(container.textContent).toContain('The Card');
    expect(container.textContent).not.toContain('Who made you?');
    press(named('Show 2 questions'));
    expect(container.textContent).toContain('Who made you?');

    press(named('Remove'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(active().transformationRef).toBeNull();
  });

  /**
   * The defect owner decision 2 names, refused in advance.
   *
   * A sheet that arrives by QR from a build shipping SRD 2.0 carries a ref this
   * build cannot name. Hiding the section then would leave a reference on the
   * character with no trace of it anywhere on the glass - which is exactly what
   * a dropped weapon does today and exactly what an armor does not.
   */
  it('shows a ref it cannot name, in the armor path’s own words', () => {
    mount(sheet({ classRef: 'test-class', transformationRef: unresolvedRef(CARD_ID) }), makeDataset());
    expect(container.textContent).toContain('TRANSFORMATION NOT IN THIS BUILD');
    expect(container.textContent).toContain(unresolvedRef(CARD_ID));
    expect(named('Drop it')).toBeDefined();
  });
});
