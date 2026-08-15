/**
 * The codec has two jobs and they pull against each other: be small enough for
 * one QR code, and lose nothing. The size tests print real numbers rather than
 * only asserting a bound, because the number is the design.
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '../../shared/types.ts';
import {
  CODEC_VERSION,
  CodecError,
  UnknownSlugError,
  characterRefs,
  decodeCharacter,
  encodeCharacter,
  isDeflated,
  missingSlugs,
  resolvePlaceholders,
} from '../../src/transfer/codec.ts';
import { RESERVED_MIN, unresolvedRef } from '../../src/transfer/registry.ts';
import { framesNeeded, MAX_CHUNK_BYTES } from '../../src/transfer/frames.ts';
import { loadedWizard, normalizeHandles, registryWithout, testRegistry, wizard } from './fixtures.ts';

const roundTrip = async (c: Character): Promise<Character> => {
  const payload = await encodeCharacter(c, testRegistry);
  const { character } = await decodeCharacter(payload, testRegistry);
  return character;
};

describe('round trip', () => {
  it('returns the level 5 wizard unchanged', async () => {
    const original = wizard();
    expect(normalizeHandles(await roundTrip(original))).toEqual(normalizeHandles(original));
  });

  it('returns a sheet with every optional field filled unchanged', async () => {
    const original = loadedWizard();
    expect(normalizeHandles(await roundTrip(original))).toEqual(normalizeHandles(original));
  });

  it('keeps text that is not ASCII', async () => {
    const original = wizard({
      name: 'Ríoghnach',
      pronouns: 'they/them',
      notes: 'Sigil: ✶ — "a door, not a wall". Sworn at the Faerûn gate. 🜁',
      connections: ['Bräunlich owes me a debt', '日本語のメモ'],
      scars: ['Frostbite — two fingers'],
    });
    const back = await roundTrip(original);
    expect(back.name).toBe(original.name);
    expect(back.notes).toBe(original.notes);
    expect(back.connections).toEqual(original.connections);
    expect(back.scars).toEqual(original.scars);
  });

  it('keeps a level-up record the compact form cannot express, by escaping it', async () => {
    const original = wizard({
      levelUpHistory: [
        // A shape from a future version, or a hand-edited file.
        { level: 6, slot: 2, kind: 'domainCard', detail: { cardRef: 'teleport', why: { deep: [1, 2] } } },
        { level: 6, slot: 0, kind: 'trait', detail: { traits: ['knowledge'], optionId: 'traits', optionTier: 3, note: 'GM ruling' } },
      ],
    });
    const back = await roundTrip(original);
    expect(back.levelUpHistory).toEqual(original.levelUpHistory);
  });

  /**
   * An empty note and no note at all are different states of an inventory
   * entry, and the codec has no business choosing between them: the two
   * documented losses are Experience ids and a trait pair's order, and a third
   * one nobody wrote down is how a format stops being trustworthy.
   */
  it('tells an empty note apart from no note', async () => {
    const original = wizard({
      inventory: [
        { ref: 'attune-potion', name: 'Attune Potion', quantity: 1, note: '' },
        { ref: null, name: 'A rock', quantity: 1 },
        { ref: null, name: 'A letter', quantity: 1, note: 'Unopened' },
      ],
    });
    const back = await roundTrip(original);
    expect(back.inventory).toEqual(original.inventory);
    expect(Object.hasOwn(back.inventory[0]!, 'note')).toBe(true);
    expect(Object.hasOwn(back.inventory[1]!, 'note')).toBe(false);
  });

  it('preserves an empty sheet', async () => {
    const blank = wizard({
      classRef: '',
      subclassRefs: [],
      ancestryRefs: [],
      communityRef: null,
      loadout: [],
      vault: [],
      activePrimaryWeapon: null,
      activeArmor: null,
      experiences: [],
      levelUpHistory: [],
      name: '',
      pronouns: '',
    });
    expect(normalizeHandles(await roundTrip(blank))).toEqual(normalizeHandles(blank));
  });
});

describe('size', () => {
  it('puts a level 5 wizard in the neighbourhood of 147 bytes', async () => {
    const c = wizard();
    const full = await encodeCharacter(c, testRegistry);
    const raw = await encodeCharacter(c, testRegistry, { compress: false });
    const withoutIdentity = await encodeCharacter(c, testRegistry, { identity: false });
    const withoutHistory = await encodeCharacter({ ...c, levelUpHistory: [] }, testRegistry, {
      identity: false,
    });
    const asJson = new TextEncoder().encode(JSON.stringify(c)).length;

    console.log(
      [
        '',
        `  level 5 wizard, 5 loadout, 6 vault, 3 experiences`,
        `    JSON with slugs           ${asJson} bytes`,
        `    binary, whole sheet       ${full.length} bytes${isDeflated(full) ? ' (deflated)' : ''}`,
        `    binary, before deflate    ${raw.length} bytes`,
        `    without id and timestamps ${withoutIdentity.length} bytes`,
        `    ...and without level-ups  ${withoutHistory.length} bytes  <- the architecture's 147`,
        `    frames needed             ${framesNeeded(full.length)}`,
      ].join('\n'),
    );

    // The sheet the architecture measured - refs, values and Experiences - is
    // the "without level-ups" line. The other bytes are the id that lets the
    // receiving device update rather than clone, and four levels of history
    // that `deriveStats` reads back for Proficiency and Evasion.
    expect(withoutHistory.length).toBeLessThan(160);
    expect(full.length).toBeLessThan(230);
    expect(full.length).toBeLessThan(asJson / 3);
    // Still one QR at version 12 or two at worst, which is what makes the loop
    // fast enough to hold a phone still for.
    expect(framesNeeded(full.length)).toBeLessThanOrEqual(2);
  });

  it('deflates only when deflating helps, and says which it did', async () => {
    const small = await encodeCharacter(wizard(), testRegistry);
    expect(isDeflated(small)).toBe(false);
    expect(small[0]! & 0x0f).toBe(CODEC_VERSION);

    const chatty = wizard({ notes: 'The tower burned in the spring. '.repeat(20) });
    const big = await encodeCharacter(chatty, testRegistry);
    expect(isDeflated(big)).toBe(true);
    const plain = await encodeCharacter(chatty, testRegistry, { compress: false });
    expect(big.length).toBeLessThan(plain.length);
    expect(normalizeHandles((await decodeCharacter(big, testRegistry)).character)).toEqual(
      normalizeHandles(chatty),
    );
  });

  it('a long sheet still fits a handful of frames', async () => {
    const heavy = loadedWizard();
    const payload = await encodeCharacter(heavy, testRegistry);
    console.log(`  loaded sheet: ${payload.length} bytes, ${framesNeeded(payload.length)} frames`);
    expect(framesNeeded(payload.length)).toBeLessThanOrEqual(15);
    expect(payload.length).toBeGreaterThan(MAX_CHUNK_BYTES / 2);
  });
});

describe('degraded import', () => {
  it('keeps an id it cannot resolve instead of dropping the card', async () => {
    const original = wizard();
    const payload = await encodeCharacter(original, testRegistry);

    // The receiving device has never heard of two of these.
    const older = registryWithout('book-of-korvax', 'manifest-wall');
    const missingIds = [testRegistry.idOf('book-of-korvax')!, testRegistry.idOf('manifest-wall')!];
    const { character, unresolved, warnings } = await decodeCharacter(payload, older);

    expect(unresolved.sort()).toEqual([...missingIds].sort());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/could not be found/);

    // Nothing was dropped: the counts are identical and the ids are parked.
    expect(character.loadout).toHaveLength(original.loadout.length);
    expect(character.vault).toHaveLength(original.vault.length);
    expect(character.loadout).toContain(unresolvedRef(missingIds[0]!));
    expect(character.vault).toContain(unresolvedRef(missingIds[1]!));
    expect(character.unresolvedRefs?.sort()).toEqual([...missingIds].sort());

    // Everything the device does know is exactly where it was.
    expect(character.loadout.filter((r) => !r.startsWith('?'))).toEqual(
      original.loadout.filter((r) => r !== 'book-of-korvax'),
    );
    expect(character.classRef).toBe('wizard');
    expect(character.experiences.map((e) => e.name)).toEqual(
      original.experiences.map((e) => e.name),
    );
  });

  it('passes an unknown id on untouched, so a chain of devices erodes nothing', async () => {
    const older = registryWithout('book-of-korvax');
    const parkedId = testRegistry.idOf('book-of-korvax')!;

    const first = await encodeCharacter(wizard(), testRegistry);
    const middle = (await decodeCharacter(first, older)).character;
    // The middle device re-sends what it holds, placeholder and all.
    const second = await encodeCharacter(middle, older);
    const last = (await decodeCharacter(second, testRegistry)).character;

    expect(last.loadout).toEqual(wizard().loadout);
    expect(last.unresolvedRefs).toBeUndefined();
    expect(parkedId).toBeGreaterThan(0);
  });

  it('resolves a parked reference once the content arrives', async () => {
    const older = registryWithout('safe-haven');
    const payload = await encodeCharacter(wizard(), testRegistry);
    const degraded = (await decodeCharacter(payload, older)).character;
    expect(degraded.unresolvedRefs).toHaveLength(1);

    const { character, resolved } = resolvePlaceholders(degraded, testRegistry);
    expect(resolved).toEqual([testRegistry.idOf('safe-haven')]);
    expect(character.vault).toEqual(wizard().vault);
    expect(character.unresolvedRefs).toBeUndefined();
  });

  it('keeps a level-up record that refers to content this device lacks', async () => {
    const older = registryWithout('teleport');
    const payload = await encodeCharacter(wizard(), testRegistry);
    const { character } = await decodeCharacter(payload, older);
    const advancement = character.levelUpHistory.find((h) => h.kind === 'domainCard')!;
    expect(advancement.detail['cardRef']).toBe(unresolvedRef(testRegistry.idOf('teleport')!));
  });

  it('treats a reserved id as unresolvable rather than guessing', async () => {
    // 60000 and up is user content: no build of this app can name one.
    const fromTheFuture = wizard({ loadout: [unresolvedRef(RESERVED_MIN + 7), 'book-of-ava'] });
    const payload = await encodeCharacter(fromTheFuture, testRegistry);
    const { character, unresolved } = await decodeCharacter(payload, testRegistry);
    expect(unresolved).toEqual([RESERVED_MIN + 7]);
    expect(character.loadout).toEqual([unresolvedRef(RESERVED_MIN + 7), 'book-of-ava']);
  });
});

describe('refusing to guess', () => {
  it('names every slug it cannot put on the wire', async () => {
    const homebrew = wizard({ loadout: ['grandmas-cantrip', 'book-of-ava', 'zzz-unknown'] });
    expect(missingSlugs(homebrew, testRegistry)).toEqual(['grandmas-cantrip', 'zzz-unknown']);
    await expect(encodeCharacter(homebrew, testRegistry)).rejects.toBeInstanceOf(UnknownSlugError);
    await expect(encodeCharacter(homebrew, testRegistry)).rejects.toThrow(/\.dhchar/);
  });

  it('says so when the sheet was written by another version', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);
    payload[0] = (payload[0]! & 0xf0) | 9;
    await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(/different version/);
  });

  it('says so when the transfer is cut short', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);
    await expect(decodeCharacter(payload.slice(0, 40), testRegistry)).rejects.toBeInstanceOf(
      CodecError,
    );
    await expect(decodeCharacter(new Uint8Array([1]), testRegistry)).rejects.toThrow(/empty/);
  });

  it('says so when there are bytes left over', async () => {
    // The body is written to an exact length. Anything after it means these are
    // not the bytes that were sent, and a plausible-looking character read out
    // of them would be a quiet lie.
    const payload = await encodeCharacter(wizard(), testRegistry);
    const withTail = new Uint8Array(payload.length + 3);
    withTail.set(payload);
    await expect(decodeCharacter(withTail, testRegistry)).rejects.toThrow(/3 bytes left over/);
  });
});

describe('the fixture is a real character', () => {
  it('references only content the committed registry knows', () => {
    expect(missingSlugs(wizard(), testRegistry)).toEqual([]);
    expect(missingSlugs(loadedWizard(), testRegistry)).toEqual([]);
    expect(characterRefs(wizard()).length).toBeGreaterThan(15);
  });
});
