/**
 * The codec has two jobs and they pull against each other: be small enough for
 * one QR code, and lose nothing. The size tests print real numbers rather than
 * only asserting a bound, because the number is the design.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Character } from '../../shared/types.ts';
import { stripComments } from '../harness/reachability.ts';
import {
  CODEC_VERSION,
  READABLE_CODEC_VERSIONS,
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
import { crc32 } from '../../src/transfer/crc32.ts';
import { framesNeeded, MAX_CHUNK_BYTES } from '../../src/transfer/frames.ts';
import { loadedWizard, normalizeHandles, registryWithout, testRegistry, wizard } from './fixtures.ts';

/**
 * The checksum rule, recomputed from its description rather than by calling the
 * encoder's own helper. A test that asked the code for the answer it is
 * checking would agree with any answer.
 *
 *   crc32 over the whole payload with bytes 1-4 zeroed, big-endian in 1-4.
 */
const reseal = (payload: Uint8Array): Uint8Array => {
  const out = payload.slice();
  const scratch = out.slice();
  scratch.fill(0, 1, 5);
  const sum = crc32(scratch);
  out[1] = (sum >>> 24) & 0xff;
  out[2] = (sum >>> 16) & 0xff;
  out[3] = (sum >>> 8) & 0xff;
  out[4] = sum & 0xff;
  return out;
};

/** Every source file under `src/`, for the copy check on the warning below. */
const SRC = fileURLToPath(new URL('../../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry) ? [path] : [];
  });
}

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
   * entry, and the codec has no business choosing between them: the documented
   * losses are Experience ids, a trait pair's order and the rest count, and one
   * more that nobody wrote down is how a format stops being trustworthy.
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

  /**
   * The third deliberate loss, held still in both directions.
   *
   * `consecutiveShortRests` stays off the wire, and the reason is not the byte
   * - it is one varint in 0..3. Carrying it needs a new format number, and the
   * next one is 3, which `tests/adversarial.test.ts` shows is the one number
   * this header cannot take: from 3 a single-bit flip of the version nibble
   * gives 2 and 1, both readable, one of them the format with no checksum. The
   * file header of `src/transfer/codec.ts` carries the whole argument.
   *
   * So the pair of assertions is the point. The first says the count does not
   * survive; the second says the payload is byte-identical either way, which is
   * what proves nothing was quietly appended to carry it. Add a write and the
   * second fails; add the matching read as well and the first fails.
   */
  it('does not carry the rest count, and costs not one byte for not carrying it', async () => {
    const rested = wizard({ consecutiveShortRests: 3 });
    const { character } = await decodeCharacter(
      await encodeCharacter(rested, testRegistry),
      testRegistry,
    );
    expect(character.consecutiveShortRests).toBe(0);

    expect(await encodeCharacter(rested, testRegistry)).toEqual(
      await encodeCharacter(wizard({ consecutiveShortRests: 0 }), testRegistry),
    );
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

describe('the sentence the player reads about a parked reference', () => {
  /**
   * This warning is the one string in the codec that a person reads, and for
   * most of this file's life it ended *"They are kept on the sheet and will
   * resolve when the missing source is added."* - a repair no code path in
   * `src/` performs. `resolvePlaceholders` is the only code that turns a
   * placeholder back into a slug, its callers are the three test files that
   * import it, and `tests/harness/orphans.test.ts` holds it as a declared,
   * still-unwired seam. `Transfer.tsx` renders this text verbatim through the
   * import report, so the promise was made on screen, to the person least able
   * to check it.
   *
   * BACKLOG P1-6's third box says it: until the resolver is wired, this
   * sentence must not promise a repair that never happens. So these tests pin
   * the honest half - what the codec does do - and forbid the promise in any
   * user-visible string anywhere in `src/`, which is the way it would creep
   * back.
   */
  const decodeWithout = async (
    slug: string,
  ): Promise<{ warning: string; unresolvedId: number }> => {
    const payload = await encodeCharacter(wizard(), testRegistry);
    const { warnings } = await decodeCharacter(payload, registryWithout(slug));
    expect(warnings).toHaveLength(1);
    return { warning: warnings[0]!, unresolvedId: testRegistry.idOf(slug)! };
  };

  it('promises no repair, because nothing in src performs one', async () => {
    const { warning } = await decodeWithout('book-of-korvax');
    expect(warning).not.toMatch(/will resolve/i);
    expect(warning).not.toMatch(/resolves? (?:itself|themselves|when)/i);
    expect(warning).not.toMatch(/missing (?:source|content) (?:is added|turns up|arrives)/i);
  });

  it('says what does happen: the ids stay, they travel, they are drawn, and this build cannot name them', async () => {
    const { warning, unresolvedId } = await decodeWithout('book-of-korvax');
    expect(warning).toContain(String(unresolvedId));
    expect(warning).toMatch(/could not be found/);
    // Kept, and forwarded - the two properties the tests below actually pin.
    expect(warning).toMatch(/stay on the sheet/);
    expect(warning).toMatch(/passed on unchanged/);
    // And the limits, said out loud: no card is drawn for one, and no later
    // event repairs it.
    // Not "they do not appear as cards", which a draft of this said and which
    // is false: every parked ref gets a row on both surfaces that list cards -
    // `GhostRow` on Play (and the cockpit's own copy of it in `PlayDesktop`),
    // `SwapRow` on Rest, which has never imported `GhostRow`. What is missing
    // is the name, and the sentence has to be about that.
    expect(warning).toMatch(/CARD NOT IN THIS BUILD/);
    expect(warning).toMatch(/cannot do is name them/);
    // Nor "nothing repairs them later" full stop: `readBody` resolves an
    // incoming `?id` when the receiving registry knows it, so another device
    // does name them. It is *this* device that waiting does not help.
    expect(warning).toMatch(/adding the content here later will not/);
    expect(warning).not.toMatch(/do not appear as cards/);
  });

  it('leaves no user-visible string in src promising a parked ref will heal', () => {
    // Comments are stripped first: the codec's own comment quotes the old
    // sentence to say why it is gone, and history is not a promise. Only
    // strings that can reach a screen count.
    const promise = /will resolve when|resolves? (?:itself|themselves) when|will (?:heal|repair)/i;
    const offenders = sourceFiles(SRC)
      .filter((path) => promise.test(stripComments(readFileSync(path, 'utf8'))))
      .map((path) => relative(SRC, path).split(sep).join('/'));
    expect(
      offenders,
      'these promise a parked reference will heal, and no code in src heals one:\n' +
        offenders.map((f) => `  ${f}`).join('\n') +
        '\n\nWire resolvePlaceholders (BACKLOG P1-6) or keep the copy honest.',
    ).toEqual([]);
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

  it('carries a parked id that no field on the sheet still points at', async () => {
    // Every other parking test above leaves the placeholder somewhere the
    // decoder can find it - in the loadout, in a level-up record - and the
    // decoder rebuilds unresolvedRefs from those refs. So the list the encoder
    // writes is redundant in exactly the cases that are tested, and could be
    // sent as "nothing parked" without a single one of them noticing.
    //
    // It stops being redundant the moment the player deletes the card they
    // could not name. The placeholder leaves the loadout; the id survives only
    // in unresolvedRefs, which is the sheet's own record that it is carrying
    // someone else's content. Lose it on the wire and the character arrives
    // looking complete, with nothing left for resolvePlaceholders to repair on
    // the day the homebrew finally shows up.
    const dropped = wizard({ unresolvedRefs: [RESERVED_MIN, RESERVED_MIN + 41] });
    expect(characterRefs(dropped).filter((r) => r.startsWith('?'))).toEqual([]);

    const payload = await encodeCharacter(dropped, testRegistry);
    const { character, unresolved } = await decodeCharacter(payload, testRegistry);

    expect(character.unresolvedRefs).toEqual([RESERVED_MIN, RESERVED_MIN + 41]);
    // No field points at them, so nothing was newly discovered as unresolvable:
    // these ids were carried across, not re-derived from a placeholder.
    expect(unresolved).toEqual([]);
    expect(character.loadout).toEqual(dropped.loadout);

    // And the next hop carries them again, byte for byte.
    expect([...(await encodeCharacter(character, testRegistry))]).toEqual([...payload]);
  });

  it('stops parking an id the receiving device turns out to know', async () => {
    // The mirror of the test above: a list entry is a claim about the SENDER's
    // content, not a permanent label. A device that can name the id resolves it
    // and hands back a sheet with nothing parked at all.
    const known = testRegistry.idOf('book-of-korvax')!;
    const stale = wizard({ unresolvedRefs: [known] });
    const { character } = await decodeCharacter(
      await encodeCharacter(stale, testRegistry),
      testRegistry,
    );
    expect(known).toBeGreaterThan(0);
    expect(character.unresolvedRefs).toBeUndefined();
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

    // The checksum is in front of the structure now, and gets there first.
    await expect(decodeCharacter(withTail, testRegistry)).rejects.toThrow(/checksum/);
    // Sealed as if the sender had really written those three bytes, the
    // structural guard is what refuses - which is what keeps it reachable, and
    // proves the checksum is not the only thing standing between a tail and a
    // character.
    await expect(decodeCharacter(reseal(withTail), testRegistry)).rejects.toThrow(
      /3 bytes left over/,
    );
  });
});

/**
 * The one count in the payload that drives no loop.
 *
 * Every other count here is self-limiting and that is deliberate: a declared
 * 2^50 experiences has to be followed by 2^50 strings, so the reader walks off
 * the end of the buffer and throws a CodecError long before it allocates
 * anything. A counter maximum is two varints and nothing follows them, so it
 * costs the decoder nothing to declare 2^20 - and then costs `Track.tsx` a
 * million `<button>` elements when the sheet is drawn, on the device whose only
 * copy of those characters is the tab that just stopped responding.
 *
 * The payloads below are sealed by the encoder, so the format-2 checksum passes
 * and it really is the ceiling that refuses them. A test that got its refusal
 * from the checksum would prove nothing about this at all.
 */
describe('counter maxima', () => {
  const enormous = 1_048_576;

  const overflowing: Array<[string, Partial<Character>, number]> = [
    ['HP', { hp: { marked: 2, max: enormous } }, 12],
    ['Stress', { stress: { marked: 3, max: enormous } }, 12],
    ['Hope', { hope: { marked: 4, max: enormous } }, 6],
    ['Armor Slot', { armorSlots: { marked: 1, max: enormous } }, 12],
  ];

  for (const [track, patch, ceiling] of overflowing) {
    it(`refuses a ${track} maximum of ${enormous} and says which track and what the top is`, async () => {
      const payload = await encodeCharacter(wizard(patch), testRegistry);
      // Not the checksum: the encoder sealed these bytes, so they arrived
      // exactly as they were sent and the structure is intact.
      await expect(decodeCharacter(payload, testRegistry)).rejects.toBeInstanceOf(CodecError);
      await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(
        new RegExp(`${track} track has a maximum of ${enormous}, and ${ceiling} is the most`),
      );
      await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(/nothing has been imported/i);
    });
  }

  it('refuses a marked count past the ceiling too, not only the maximum', async () => {
    // `marked` drives no loop either, and a sheet reading "1048576 / 6 MARKED"
    // is no more a character than one with a million boxes.
    const payload = await encodeCharacter(wizard({ stress: { marked: enormous, max: 6 } }), testRegistry);
    await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(
      /Stress track has a marked count of 1048576/,
    );
  });

  it('refuses the companion’s Stress track, which the character’s own sync never reaches', async () => {
    const beastbound = loadedWizard();
    const payload = await encodeCharacter(
      { ...beastbound, companion: { ...beastbound.companion!, stress: { marked: 0, max: enormous } } },
      testRegistry,
    );
    await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(
      /companion Stress track has a maximum of 1048576/,
    );
  });

  it('takes the ceiling itself, because a level 10 veteran really has twelve of each', async () => {
    // The bound has to be the engine's number and not one below it: a character
    // who bought every Hit Point and every Stress advancement is a legal sheet,
    // and refusing them would be this file inventing a stricter game.
    const veteran = wizard({
      hp: { marked: 12, max: 12 },
      stress: { marked: 12, max: 12 },
      hope: { marked: 6, max: 6 },
      armorSlots: { marked: 12, max: 12 },
    });
    const back = await roundTrip(veteran);
    expect(back.hp).toEqual({ marked: 12, max: 12 });
    expect(back.stress).toEqual({ marked: 12, max: 12 });
    expect(back.hope).toEqual({ marked: 6, max: 6 });
    expect(back.armorSlots).toEqual({ marked: 12, max: 12 });
  });

  it('refuses one past the ceiling, so the bound is exactly where the rules put it', async () => {
    for (const [patch, sentence] of [
      [{ hp: { marked: 0, max: 13 } }, /HP track has a maximum of 13, and 12 is the most/],
      [{ hope: { marked: 0, max: 7 } }, /Hope track has a maximum of 7, and 6 is the most/],
    ] as const) {
      const payload = await encodeCharacter(wizard(patch), testRegistry);
      await expect(decodeCharacter(payload, testRegistry)).rejects.toThrow(sentence);
    }
  });
});

describe('the format number', () => {
  /*
   * A nibble holds sixteen formats and two are spent. The point of writing that
   * down here is that a version bump is a compatibility decision - a payload
   * this build writes cannot be read by any build that shipped before it - and
   * the place to be reminded of that is the file where the constant changes.
   */
  it('writes the newest format it knows and reads every one before it', async () => {
    expect(CODEC_VERSION).toBe(READABLE_CODEC_VERSIONS.at(-1));
    expect([...READABLE_CODEC_VERSIONS].sort((a, b) => a - b)).toEqual([
      ...READABLE_CODEC_VERSIONS,
    ]);
    expect(CODEC_VERSION).toBeLessThanOrEqual(0x0f);
    expect((await encodeCharacter(wizard(), testRegistry))[0]! & 0x0f).toBe(CODEC_VERSION);
  });

  it('has no reader for a format that does not exist yet', async () => {
    const payload = await encodeCharacter(wizard(), testRegistry);
    const next = reseal(
      Uint8Array.from(payload, (b, i) => (i === 0 ? (b & 0xf0) | (CODEC_VERSION + 1) : b)),
    );
    await expect(decodeCharacter(next, testRegistry)).rejects.toThrow(/different version/);
  });

  /**
   * The old format is still readable, and carries no checksum of its own.
   *
   * That is not an oversight to be fixed later: the hand-off this vector exists
   * for is an old phone sending to a new one, so the *sender* is the build that
   * has not updated. Refusing it would break the transfer exactly when it is
   * the only thing between a player and their months of play.
   */
  it('reads a format-1 payload, which has no checksum, and says so', async () => {
    const v2 = await encodeCharacter(wizard(), testRegistry);
    const v1 = new Uint8Array(v2.length - 4);
    v1[0] = (v2[0]! & 0xf0) | 1;
    v1.set(v2.subarray(5), 1);

    const { character } = await decodeCharacter(v1, testRegistry);
    expect(character.name).toBe(wizard().name);

    // UNGUARDED (finding, by design). A format-1 payload has no integrity field,
    // so a flip inside a number can still decode into a different character -
    // the measurement in `adversarial.test.ts` is what format 2 exists for. On
    // the QR vector the frame header's crc32 covers it; anything else feeding
    // format-1 bytes in inherits nothing, which is the reason format 1 is read
    // and never written.
    let differed = 0;
    for (let at = 1; at < v1.length; at += 1) {
      const bad = v1.slice();
      bad[at] = bad[at]! ^ 0x01;
      try {
        const decoded = await decodeCharacter(bad, testRegistry);
        if (JSON.stringify(normalizeHandles(decoded.character)) !== JSON.stringify(normalizeHandles(character))) {
          differed += 1;
        }
      } catch {
        /* refused by structure, which is most of them */
      }
    }
    expect(differed, 'format 1 has no checksum; this records that, it does not approve of it').toBeGreaterThan(0);

    // And the same flips against format 2 are all refused, which is the whole
    // difference between the two numbers.
    let escaped = 0;
    for (let at = 1; at < v2.length; at += 1) {
      const bad = v2.slice();
      bad[at] = bad[at]! ^ 0x01;
      try {
        await decodeCharacter(bad, testRegistry);
        escaped += 1;
      } catch {
        /* every one of them */
      }
    }
    expect(escaped, 'a single-bit flip got past the format-2 checksum').toBe(0);
  });
});

describe('the fixture is a real character', () => {
  it('references only content the committed registry knows', () => {
    expect(missingSlugs(wizard(), testRegistry)).toEqual([]);
    expect(missingSlugs(loadedWizard(), testRegistry)).toEqual([]);
    expect(characterRefs(wizard()).length).toBeGreaterThan(15);
  });
});
