/**
 * The prose the reflow left behind, held to the code that disproved it.
 *
 * WHAT THIS FILE IS FOR. The phone reflow was seven commits over one afternoon
 * (`8def497`..`3dff11f`), and each of them moved a number that four or five
 * docblocks in other files had already written down. An adversarial pass over
 * that day found the commonest defect by a distance was not a broken control:
 * it was a sentence the code had made false and nobody had gone back for - a
 * comment describing a defect that was fixed, a docblock quoting a size another
 * file had stepped, one measurement living in three places with two values.
 *
 * The precedent for the shape is the contrast test, which computes its ratios
 * from the tokens rather than pinning a table of them, on the argument that "a
 * table of numbers goes stale the moment somebody nudges a hex value; a
 * function does not". So THERE IS NO TABLE OF EXPECTED NUMBERS HERE. Every
 * claim below names a sentence in a file and an ANCHOR - a token resolved out
 * of `tokens.css` by `tokens.ts`, or a declaration read out of the component
 * that makes it - and asserts that the number written in the sentence is the
 * number the anchor holds. Change the token and the sentence goes red until it
 * is re-written; re-write the sentence with the wrong number and it goes red
 * the same way.
 *
 * ## What it can hold, and what it cannot
 *
 * IT HOLDS a claim of the form "this size is N", where N is a token, a declared
 * length, or arithmetic over those. That is most of what went stale here: a
 * counter cell, the number inside it, the maximum under that, the damage
 * field's width, the block's own height, the floor ROLL and MODS declare.
 *
 * IT CANNOT HOLD a number that came out of a browser. `11` measures 47.64px at
 * 38, `4 ITEMS · 1 CHEST · 3 BAGS · 7 HANDFULS` measures 257.41, the folded
 * sheet is 592 at 393x852, a 95th-percentile thumb sweeps about 330px: jsdom
 * has no layout engine, so nothing in this suite can check any of them, and an
 * assertion that pretended to would be checking arithmetic this file did rather
 * than a fact about the app. Those live in the docblocks with the fixture and
 * the viewport named beside them, and the only thing that keeps them true is
 * somebody driving the rig again. Say so out loud rather than writing a green
 * assertion over them: a test that cannot fail is worse than no test.
 *
 * IT ALSO CANNOT HOLD the two budget tables - `the budget the pin came off for`
 * and `the width this sheet is laid out for` - which already read their terms
 * off the DOM and off `tokens.css`. Restating their totals here would be a
 * second copy of a measurement, which is the exact defect this file exists for.
 *
 * ## How to fix a failure
 *
 * A red line here means one of two things and the message says which. Either
 * the number in the sentence and the number in the code disagree - fix the
 * sentence, and grep for the other files that state the same thing - or the
 * sentence has been re-worded and this file can no longer find it, in which
 * case re-point the claim at the new wording. Deleting the claim is a third
 * option and it is the wrong one: the sentence is why the claim exists.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NARROW, PHONE, px as resolve, type Device } from './tokens.ts';

/** A mouse-driven desktop, which is where `tokens.css` takes the steps back. */
const COCKPIT: Device = { glass: 1280, coarse: false };

/**
 * A file as one line of prose.
 *
 * Comment furniture and line breaks go, because a docblock re-wraps every time
 * a word is added to it and a claim that broke on re-wrapping would be a claim
 * nobody could keep. What is left is the sentence as it reads.
 */
const cache = new Map<string, string>();
function prose(file: string): string {
  const hit = cache.get(file);
  if (hit !== undefined) return hit;
  const flat = readFileSync(file, 'utf8')
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/^\s*\/\/\s?/gm, ' ')
    .replace(/\s+/g, ' ');
  cache.set(file, flat);
  return flat;
}

/** The raw file, for anchors that are read out of code rather than prose. */
const source = (file: string): string => readFileSync(file, 'utf8');

/**
 * A length a component declares, found by the code around it rather than by
 * line number.
 *
 * The anchor is a string that occurs exactly once in the file and belongs to
 * the control being measured - a handler, a template - so that this reads the
 * height of the button it names and not of the next one down the file. If the
 * anchor stops being unique the extraction throws by name, which is the loud
 * failure this whole file prefers to a quiet pass.
 */
function declared(file: string, anchor: string, property: string): number {
  const src = source(file);
  const at = src.indexOf(anchor);
  if (at === -1 || src.indexOf(anchor, at + 1) !== -1) {
    throw new Error(
      `\`${anchor}\` is not unique in ${file}, so nothing here can say which control's ` +
        `${property} it is reading. Re-point the anchor at the control this claim is about.`,
    );
  }
  const found = new RegExp(`${property}: (\\d+(?:\\.\\d+)?)`).exec(src.slice(at));
  if (found === null) throw new Error(`no \`${property}\` follows \`${anchor}\` in ${file}`);
  return Number.parseFloat(found[1]!);
}

/**
 * The same, for a control the anchor sits AFTER rather than before.
 *
 * ROLL and MODS are the two children of one row, in that order, and MODS is the
 * one with a handler unique enough to find. So ROLL's floor is the last one
 * declared before MODS's - which is a statement about the order of the row, and
 * the anchor test below checks that the two come out equal, which is the thing
 * `alignItems: 'stretch'` is there to make true.
 */
function declaredBefore(file: string, anchor: string, property: string): number {
  const src = source(file);
  const at = src.indexOf(anchor);
  if (at === -1 || src.indexOf(anchor, at + 1) !== -1) {
    throw new Error(
      `\`${anchor}\` is not unique in ${file}, so nothing here can say which control's ` +
        `${property} it is reading. Re-point the anchor at the control this claim is about.`,
    );
  }
  const before = [...src.slice(0, at).matchAll(new RegExp(`${property}: (\\d+(?:\\.\\d+)?)`, 'g'))];
  const last = before[before.length - 1];
  if (last === undefined) throw new Error(`no \`${property}\` precedes \`${anchor}\` in ${file}`);
  return Number.parseFloat(last[1]!);
}

/** What `--counter-cell` is worth where, and therefore what the block is. */
const cell = (device: Device): number => resolve('var(--counter-cell)', device);
/** The 2x2 grid's own gap, off `Vitals`'s declaration rather than remembered. */
const gridGap = (): number =>
  declared('src/ui/player/Vitals.tsx', "gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)'", 'gap');
/** Two cells and the one gap between the rows. */
const block = (device: Device): number => 2 * cell(device) + gridGap();

interface Claim {
  /** What the sentence says, for the failure message. */
  says: string;
  file: string;
  /** One capture group, holding the number the sentence states. */
  find: RegExp;
  /** What the tree says it should be. */
  is: () => number;
}

const CLAIMS: Claim[] = [
  // ---------------------------------------------------------------- the cell
  {
    says: 'the counter cell from viewport 390 up',
    file: 'src/ui/tokens.css',
    find: /The cell is \*\*(\d+)\*\* tall/g,
    is: () => cell(PHONE),
  },
  {
    says: 'the counter cell from viewport 390 up',
    file: 'src/ui/shared/Counter.tsx',
    find: /\*\*(\d+) from viewport 390 up\*\*/g,
    is: () => cell(PHONE),
  },
  {
    says: 'the counter cell from viewport 390 up',
    file: 'src/ui/player/Vitals.tsx',
    find: /`--counter-cell` now - (\d+) from viewport 390 up/g,
    is: () => cell(PHONE),
  },
  {
    says: 'the counter cell from viewport 390 up',
    file: 'tests/ui/tokens.ts',
    find: /the counter cell is (\d+) and not \d+/g,
    is: () => cell(PHONE),
  },
  {
    says: 'the counter cell below viewport 390',
    file: 'src/ui/tokens.css',
    find: /Below 390 the cell is \*\*(\d+)\*\*/g,
    is: () => cell(NARROW),
  },
  {
    says: 'the counter cell below viewport 390',
    file: 'src/ui/shared/Counter.tsx',
    find: /`--counter-cell` is the cell's HEIGHT: \*\*(\d+)\*\*/g,
    is: () => cell(NARROW),
  },
  {
    says: 'the counter cell below viewport 390',
    file: 'tests/ui/tokens.ts',
    find: /`--counter-cell` is (\d+) here and \d+ on the phone/g,
    is: () => cell(NARROW),
  },
  {
    says: 'both ends of the counter cell',
    file: 'tests/ui/counters.test.tsx',
    find: /(\d+) on the owner's phone, \d+ below 390/g,
    is: () => cell(PHONE),
  },
  {
    says: 'both ends of the counter cell',
    file: 'tests/ui/counters.test.tsx',
    find: /\d+ on the owner's phone, (\d+) below 390/g,
    is: () => cell(NARROW),
  },
  {
    says: 'the cockpit cell, which takes the step back at 1180',
    file: 'src/ui/shared/Counter.tsx',
    find: /The cockpit's is 198x(\d+)/g,
    is: () => cell(COCKPIT),
  },
  // -------------------------------------------------------------- the number
  {
    says: 'the counter number from 390 up',
    file: 'src/ui/tokens.css',
    find: /It is \*\*(\d+)\*\* from 390 up/g,
    is: () => resolve('var(--counter-num)', PHONE),
  },
  {
    says: 'the counter number from 390 up',
    file: 'src/ui/shared/Counter.tsx',
    find: /(\d+)px from 390 up, \d+ from 380/g,
    is: () => resolve('var(--counter-num)', PHONE),
  },
  {
    says: 'the counter number from 390 up',
    file: 'src/ui/player/Play.tsx',
    find: /a \*\*(\d+)px\*\* number/g,
    is: () => resolve('var(--counter-num)', PHONE),
  },
  {
    says: 'the counter number on the narrowest phone',
    file: 'src/ui/player/Play.tsx',
    find: /keeps an \*\*(\d+)px\*\* number in a \d+px card/g,
    is: () => resolve('var(--counter-num)', NARROW),
  },
  {
    says: 'the counter number on the narrowest phone',
    file: 'src/ui/shared/Counter.tsx',
    find: /\d+ from 380, (\d+) below that/g,
    is: () => resolve('var(--counter-num)', NARROW),
  },
  // ------------------------------------------------------------- the maximum
  {
    says: 'the maximum, which is the one token here that does not step',
    file: 'src/ui/shared/Counter.tsx',
    find: /`--counter-max`, which is `\.t-meta`'s (\d+) at every width/g,
    is: () => resolve('var(--counter-max)', PHONE),
  },
  // --------------------------------------------------------- the whole block
  {
    says: 'the 2x2 block on the owner s phone',
    file: 'src/ui/shared/Counter.tsx',
    find: /\*\*(\d+)px\*\* on the owner's phone/g,
    is: () => block(PHONE),
  },
  {
    says: 'the 2x2 block on the owner s phone',
    file: 'src/ui/player/Vitals.tsx',
    find: /block is \*\*(\d+)\*\* on the owner's phone/g,
    is: () => block(PHONE),
  },
  {
    says: 'the 2x2 block on the owner s phone',
    file: 'src/ui/player/Play.tsx',
    find: /THE COUNTERS ARE (\d+) AND THAT IS THE ONE THING/g,
    is: () => block(PHONE),
  },
  {
    says: 'the 2x2 block on a 360px Android',
    file: 'src/ui/player/Vitals.tsx',
    find: /\*\*(\d+)\*\* on a 360px Android/g,
    is: () => block(NARROW),
  },
  {
    says: 'the 2x2 block on a 360px Android',
    file: 'src/ui/player/Play.tsx',
    find: /a 360px Android both read (\d+) here/g,
    is: () => block(NARROW),
  },
  // ---------------------------------------------------------- the damage box
  {
    says: 'the incoming-damage field from 390 up',
    file: 'src/ui/player/Vitals.tsx',
    find: /\*\*(\d+)x44\*\* from 390 up/g,
    is: () => resolve('var(--damage-w)', PHONE),
  },
  {
    says: 'the incoming-damage field from 390 up',
    file: 'src/ui/tokens.css',
    find: /From 390 up it is (\d+), and the twenty/g,
    is: () => resolve('var(--damage-w)', PHONE),
  },
  // ------------------------------------------------------------ ROLL and MODS
  {
    says: 'the floor MODS declares beside ROLL',
    file: 'src/ui/player/Rest.tsx',
    find: /MODS at 44x(\d+)/g,
    is: () => declared('src/ui/player/DualityRoll.tsx', 'setModifiersOpen(!modifiersOpen)', 'minHeight'),
  },
  {
    says: 'the floor MODS declares beside ROLL',
    file: 'src/ui/player/DualityRoll.tsx',
    find: /the same (\d+)px floor ROLL does/g,
    is: () => declared('src/ui/player/DualityRoll.tsx', 'setModifiersOpen(!modifiersOpen)', 'minHeight'),
  },
  {
    says: 'the floor MODS declares beside ROLL',
    file: 'tests/ui/playSheet.test.tsx',
    find: /MODS declares `minHeight: (\d+)`/g,
    is: () => declared('src/ui/player/DualityRoll.tsx', 'setModifiersOpen(!modifiersOpen)', 'minHeight'),
  },
  {
    says: 'the floor MODS declares beside ROLL',
    file: 'tests/ui/playSheet.test.tsx',
    find: /one 44x(\d+) control at the right end of the roll row/g,
    is: () => declared('src/ui/player/DualityRoll.tsx', 'setModifiersOpen(!modifiersOpen)', 'minHeight'),
  },
  {
    says: 'the floor ROLL declares',
    file: 'src/ui/player/Play.tsx',
    find: /the roll row (\d+), a floor rather than the hard \d+ it was/g,
    is: () =>
      declaredBefore('src/ui/player/DualityRoll.tsx', 'setModifiersOpen(!modifiersOpen)', 'minHeight'),
  },
];

describe('the prose the reflow left behind', () => {
  for (const claim of CLAIMS) {
    it(`${claim.file} says ${claim.says}`, () => {
      const found = [...prose(claim.file).matchAll(claim.find)].map((m) =>
        Number.parseFloat(m[1]!),
      );
      /*
       * A claim that matches nothing is the decoration this file is written
       * against: it would pass for ever, over a sentence somebody deleted.
       */
      expect(
        found.length,
        `no sentence in ${claim.file} matches \`${claim.find.source}\` any more. It said ` +
          `${claim.says}, and either the wording moved - re-point this claim at it - or the ` +
          'sentence was deleted, in which case say here that it was and why.',
      ).toBeGreaterThan(0);
      for (const number of found) {
        expect(
          number,
          `${claim.file} says ${claim.says} is ${String(number)}. The tree says ` +
            `${String(claim.is())}. One of the two has moved and the other has not: correct the ` +
            'sentence, then grep the whole tree for the other files stating the same thing.',
        ).toBe(claim.is());
      }
    });
  }

  /*
   * The anchors themselves, so that a claim cannot pass because its anchor
   * quietly resolved to zero or to the wrong control.
   */
  it('reads its anchors out of the tree rather than out of a table', () => {
    expect(cell(PHONE), '--counter-cell no longer resolves on the phone').toBeGreaterThan(0);
    expect(cell(NARROW), '--counter-cell no longer resolves on a narrow phone').toBeGreaterThan(0);
    expect(cell(PHONE)).not.toBe(cell(NARROW));
    expect(gridGap(), "the counter grid's gap is no longer declared where this reads it").toBe(6);
    expect(block(PHONE)).toBe(2 * cell(PHONE) + gridGap());
    const mods = declared(
      'src/ui/player/DualityRoll.tsx',
      'setModifiersOpen(!modifiersOpen)',
      'minHeight',
    );
    const roll = declaredBefore(
      'src/ui/player/DualityRoll.tsx',
      'setModifiersOpen(!modifiersOpen)',
      'minHeight',
    );
    expect(mods, 'MODS stopped declaring the floor ROLL declares').toBe(roll);
    expect(roll, 'the roll row went under the touch floor').toBeGreaterThanOrEqual(44);
  });
});
