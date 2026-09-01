/**
 * The name generator, and the one of its two promises that a test can keep.
 *
 * `src/engine/names.ts` states two rules in its docblock. PROVENANCE - that no
 * table in it was built out of the Core Book's 128 printed names or their
 * fragments - is deliberately **not** tested here, and cannot be: two people
 * can invent `Ashdale` independently, so no property of the output separates a
 * table that was built honestly from one that was not. That rule is kept by
 * having been written, and the module says so.
 *
 * COLLISION is the other one, and it is tested the only way it is worth
 * testing: by enumerating the entire producible string space and intersecting
 * it with every `name` the shipped dataset carries. The reason it is not
 * sampled is in the module docblock and is worth repeating here, because it is
 * this file that would otherwise have been thirty draws long: an earlier
 * attempt at these tables produced 268,871 strings, ten of which it had no
 * business producing, and a thirty-draw sample of it came back clean. One bad
 * string in 190,000 is invisible to sampling.
 *
 * The enumeration only proves anything about the app if the app cannot reach
 * outside it, so that is asserted too - `reachability` below drives the real
 * generators tens of thousands of times and demands every single result be a
 * member of the enumerated space. Without it the exhaustive test is checking a
 * list that nothing in the app is bound to.
 *
 * The last block reads the Core Book, when the owner's copy happens to be on
 * the machine, and skips itself everywhere else. The reason is that no PDF is
 * committed and none ever will be, so a test that needs one has to be able to
 * find nothing and still pass. `tests/import/coreRulebook.test.ts` used the
 * same arrangement and was the place this borrowed it from; it went with the
 * Core Rulebook importer, which leaves this file as the only one that reads a
 * book the repository does not contain - so the arrangement is described here
 * rather than cited from somewhere else. Nothing it extracts is written
 * anywhere; the four lists exist inside this process for the length of one
 * assertion and are never transcribed into the tree.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import { seededRng } from '../../src/engine/dice.ts';
import {
  drawName,
  enumerateNames,
  NAME_GENERATORS,
  NAME_KINDS,
  PRODUCIBLE,
  type NameKind,
} from '../../src/engine/names.ts';

/** Every `name` field anywhere in the shipped dataset, at any depth. */
function shippedNames(): Set<string> {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'name' && typeof value === 'string') found.add(value);
      walk(value);
    }
  };
  walk(srd);
  return found;
}

const everything = (): string[] => NAME_KINDS.flatMap((kind) => enumerateNames(kind));

describe('the producible space', () => {
  it('is the size the module says it is, and every string in it is distinct', () => {
    const all = everything();
    expect(all).toHaveLength(PRODUCIBLE);
    expect(new Set(all).size).toBe(PRODUCIBLE);
  });

  /**
   * CONTROL - labelled as one, because it does not fail against any mutation
   * of this module that the size assertion above does not already fail against.
   * A table blown up until enumeration is slow trips `PRODUCIBLE` first and
   * trips it by a clearer margin. This is here as a ceiling rather than as a
   * guard: the COLLISION promise is only as good as the run that checks it, and
   * an enumeration that took a second is one somebody would eventually move
   * behind a flag.
   */
  it('is small enough to enumerate on every run', () => {
    const started = performance.now();
    everything();
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('COLLISION: nothing producible is already in the shipped dataset', () => {
  it('intersects with no `name` in data/srd-1.0.json, exhaustively', () => {
    const shipped = shippedNames();
    // Guards the harvest itself: a `shippedNames` that walked nothing would
    // make the assertion below pass by knowing about no names at all.
    expect(shipped.size).toBeGreaterThan(1000);

    const collisions = everything().filter((name) => shipped.has(name));
    expect(collisions).toEqual([]);
  });

  it('does not collide case-insensitively either', () => {
    // `Vines` and `vines` are the same name on a screen. The exact check above
    // is the promise; this is the one that catches a table entry that differs
    // from a shipped name only in how it was capitalised.
    const folded = new Set([...shippedNames()].map((name) => name.toLowerCase()));
    const collisions = everything().filter((name) => folded.has(name.toLowerCase()));
    expect(collisions).toEqual([]);
  });
});

describe('reachability: the enumeration is the space the generators actually reach', () => {
  it.each(NAME_KINDS)('every %s the generator draws is in the enumerated space', (kind) => {
    const space = new Set(enumerateNames(kind));
    const rng = seededRng(20_260_818);
    const seen = new Set<string>();
    const outside: string[] = [];
    for (let draw = 0; draw < 30_000; draw += 1) {
      const name = NAME_GENERATORS[kind](rng, new Set());
      seen.add(name);
      if (!space.has(name)) outside.push(name);
    }
    expect(outside).toEqual([]);
    // And it reaches a real spread of it rather than one corner - otherwise a
    // generator wired to a single table entry would satisfy the line above.
    expect(seen.size).toBeGreaterThan(Math.min(space.size, 250));
  });

  it('reaches both halves of a person and both phrasings of a region', () => {
    const rng = seededRng(7);
    const people = Array.from({ length: 4000 }, () => drawName('person', rng, new Set()));
    expect(people.some((name) => !name.includes(' '))).toBe(true);
    expect(people.some((name) => name.includes(' '))).toBe(true);

    const regions = Array.from({ length: 4000 }, () => drawName('region', rng, new Set()));
    expect(regions.some((name) => name.startsWith('The '))).toBe(true);
    expect(regions.some((name) => name.includes(' of '))).toBe(true);
  });
});

describe('taken: the collision construction cannot reach', () => {
  it('never returns a name the caller says is already in play', () => {
    // Everything but one string is taken, so a generator that only rejects a
    // few times and then gives up has nowhere to hide.
    const space = enumerateNames('place');
    const free = space[17] as string;
    const taken = new Set(space.filter((name) => name !== free));
    const rng = seededRng(3);
    for (let draw = 0; draw < 200; draw += 1) {
      expect(drawName('place', rng, taken)).toBe(free);
    }
  });

  it('honours taken across all three kinds', () => {
    for (const kind of NAME_KINDS) {
      const space = enumerateNames(kind);
      const taken = new Set(space.slice(0, space.length - 3));
      const rng = seededRng(11);
      for (let draw = 0; draw < 100; draw += 1) {
        expect(taken.has(drawName(kind, rng, taken))).toBe(false);
      }
    }
  });

  it('repeats rather than refuses when the whole space is taken', () => {
    // The one request it cannot honour. A GM mid-sentence gets a name they can
    // see is a repeat, not an empty string and not a throw.
    const space = enumerateNames('place');
    const taken = new Set(space);
    const name = drawName('place', seededRng(5), taken);
    expect(space).toContain(name);
  });
});

describe('determinism', () => {
  it('gives the same run twice from the same seed', () => {
    const run = (): string[] => {
      const rng = seededRng(99);
      return NAME_KINDS.flatMap((kind) =>
        Array.from({ length: 20 }, () => drawName(kind, rng, new Set())),
      );
    };
    expect(run()).toEqual(run());
  });
});

// ---------------------------------------------------------------------------
// The Core Book, when it is here
// ---------------------------------------------------------------------------

const MANUALI = fileURLToPath(new URL('../../Manuali', import.meta.url));

/**
 * The Core Book's four name lists, read out of the owner's own PDF.
 *
 * Returns null - and the block below skips - whenever anything is missing: no
 * `Manuali/`, no poppler, no page that looks like the four lists. It is a
 * guard that runs on one machine, which is the machine the tables were written
 * on, and that is the machine where an accidental match would be introduced.
 *
 * The heuristic is deliberately shape-based rather than page-based: take the
 * text around the place-name list and keep the paragraphs that are long
 * comma-separated runs. A printing that repaginates moves the page; it does not
 * turn a list of forty-seven names into prose.
 */
function coreBookNames(): Set<string> | null {
  if (!existsSync(MANUALI)) return null;
  const pdfs = readdirSync(MANUALI).filter((file) => file.toLowerCase().endsWith('.pdf'));
  for (const file of pdfs) {
    let text: string;
    try {
      text = execFileSync('pdftotext', ['-q', `${MANUALI}/${file}`, '-'], {
        encoding: 'utf8',
        maxBuffer: 1 << 28,
      });
    } catch {
      return null;
    }
    const at = text.indexOf('PLACE NAMES');
    if (at === -1) continue;
    const window = text.slice(Math.max(0, at - 4000), at + 4000);
    const entries = window
      .split(/\n\s*\n/)
      .map((para) => para.replace(/\n/g, ' ').trim())
      .filter((para) => (para.match(/,/g) ?? []).length >= 10)
      .flatMap((para) => para.split(',').map((word) => word.trim()))
      .filter((word) => word !== '');
    // Deliberately over-inclusive, and this is where that is said rather than
    // implied. The window is 8,000 characters around the PLACE NAMES heading
    // and the paragraph filter is "at least ten commas", so it sweeps in some
    // surrounding prose as well as the four lists - about 150 entries where the
    // lists themselves are 128. That only makes the guard STRICTER, because
    // every extra string is one more thing the generator may not produce. What
    // it means is that this count is not a check on the extraction: the
    // assertion that the extraction really found the lists is the sample below.
    if (entries.length >= 100) return new Set(entries);
  }
  return null;
}

const coreNames = coreBookNames();

describe.skipIf(coreNames === null)('the Core Book, on the machine that has it', () => {
  it('really did find the printed lists, and not some other page', () => {
    /*
     * The guard above is only worth anything if the window it lifted is the one
     * with the names in it, and its entry count cannot tell you that - it is
     * over-inclusive by design and would clear 100 on a page of prose. These
     * five are the strings a first attempt at these tables emitted verbatim,
     * which is why they are the sample: if the extraction has drifted off the
     * lists, the collision test above would pass by looking at nothing.
     */
    const printed = coreNames as Set<string>;
    for (const name of ['Alvyon', 'Hollow Keep', 'Watcher’s Ravine', 'Wicked Smile', 'Idle Fiend']) {
      expect([...printed].some((entry) => entry.includes(name.replace('’', '’'))), name).toBe(true);
    }
  });

  it('shares not one string with anything this module can produce', () => {
    const printed = coreNames as Set<string>;
    const folded = new Set([...printed].map((name) => name.toLowerCase()));
    const collisions = everything().filter(
      (name) => printed.has(name) || folded.has(name.toLowerCase()),
    );
    expect(collisions).toEqual([]);
  });
});

describe('the enumeration is tight, not merely a superset', () => {
  /*
   * The gap the reachability tests structurally cannot close, closed from the
   * other side - and the first attempt at it was decoration, which is worth
   * recording because the reason is not obvious.
   *
   * Reachability asserts generator-output ⊆ enumeration, so an enumeration that
   * GROWS can never fail it; only the pinned `PRODUCIBLE` literal catches that,
   * and a literal is a number somebody has to remember to move. The obvious
   * closure - draw with `taken` growing until the generator repeats, then
   * compare the sets - cannot fail at all: `drawFrom`'s exhaustion fallback
   * picks out of `space(kind)`, which IS the enumeration, so every member of it
   * is reachable by construction however unreachable the composer makes it.
   *
   * So this drives the composer instead, by drawing with `taken` empty, which
   * is the path that never reaches the fallback. Coupon collector: the expected
   * number of draws to see all n is about n(ln n + 0.577), and the cap here is
   * 30n, which for the largest space is three times the expectation. A member
   * only the fallback can produce is missing from the result and named.
   */
  it.each(NAME_KINDS)('%s: every enumerated string is one the composer builds', (kind) => {
    const space = enumerateNames(kind);
    const seen = new Set<string>();
    const rng = seededRng(7);
    const none = new Set<string>();
    const cap = space.length * 30;
    for (let i = 0; i < cap && seen.size < space.length; i += 1) seen.add(drawName(kind, rng, none));

    const unreachable = space.filter((name) => !seen.has(name));
    expect(
      unreachable,
      `${kind}: enumerated but never composed in ${String(cap)} draws`,
    ).toEqual([]);
  });
});

// A kind added to the union but not to `NAME_KINDS` would leave a whole space
// unchecked by every test above, and `Record<NameKind, ...>` is what makes that
// a compile error rather than a silent gap.
const _exhaustive: Record<NameKind, true> = { person: true, place: true, region: true };
void _exhaustive;
