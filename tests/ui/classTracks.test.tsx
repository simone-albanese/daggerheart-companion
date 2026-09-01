// @vitest-environment jsdom
/**
 * The Focus and Favor row under the four counters on Play.
 *
 * Both fields have been stored, migrated, capped and carried on the wire since
 * schema 9, and neither had a control on the screen where they are SPENT: Focus
 * could only be moved from Build, and Favor could not be moved anywhere at all.
 * This file is the row that ends that, and the six claims it makes.
 *
 *   1. WHO gets one, asked of the sheet and never of a ref written by hand -
 *      the subclass for Focus, the dataset for Favor, both arms of a multiclass
 *      either way, and a sheet already holding a number whoever it belongs to;
 *   2. a sheet with neither draws NOTHING - no element, no gap;
 *   3. the two glyphs write the store, and the ends of the range refuse rather
 *      than clamp;
 *   4. every target declares the touch floor, which is `--tap` and not a
 *      literal copied out of the stylesheet;
 *   5. the row is a SIBLING of the 2x2 grid and not a fifth and sixth card in
 *      it, which is the owner's decision and the whole reason it exists;
 *   6. the two glyphs are `Counter`'s own `Step` rather than a third stepper.
 *
 * ## What this file cannot prove, and where the proof lives
 *
 * Not the geometry. jsdom computes no layout, so nothing here measures a rect,
 * a thumb arc or a reflow. Those come from the Chrome rig at 393x852, dpr 3,
 * `pointer: coarse` and live in `ClassTracks.tsx`'s own docblock with their
 * viewports attached - including the two-state proof that the strip is
 * 181.5x46 at the same x and y at `0/6`, `2/6` and `6/6` alike, and the cost
 * the cockpit pays for the row out of the roll panel.
 *
 * What jsdom CAN hold is the half that decides whether that geometry is ever
 * reached: who the row is drawn for, what the buttons write, and that the
 * declared floor is declared.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character, Tier } from '@shared/types.ts';
import { MAX_FAVOR, MAX_FOCUS } from '@shared/types.ts';
import {
  STANCE_SUBCLASS,
  drawsFavor,
  drawsFocus,
  indexDataset,
} from '@engine/character.ts';
import { applyLevelUp, tierAchievementFor, type LevelUpPlan } from '@engine/levelUp.ts';
import { useApp } from '../../src/store/state.ts';
import { ClassTracks } from '../../src/ui/player/ClassTracks.tsx';
import { Vitals } from '../../src/ui/player/Vitals.tsx';
import { feature, makeCharacter, makeClass, makeDataset } from '../fixtures/factories.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';
import { NARROW, px as resolve } from './tokens.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
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

// ---------------------------------------------------------------------------
// 1. Who gets a track
// ---------------------------------------------------------------------------

/**
 * A class that grants Favor and one that does not, with the ids swapped round -
 * the pair `tests/favor.test.tsx` invented for `grantsFavor` and reused here
 * for the same reason. `warlockish` is not called `warlock` and `plain` IS
 * reachable by a ref a hand-written check would trust, so a
 * `classRef === 'warlock'` anywhere on this path gets both of them wrong at
 * once.
 */
const WARLOCKISH = makeClass({
  id: 'warlockish',
  name: 'Occultist',
  classFeatures: [
    { name: "Patron's Pact", text: 'Before an action roll you can spend a Favor.' },
    { name: 'Favor', text: 'You start with 3 Favor.' },
  ],
});
const PLAIN = makeClass({ id: 'plain', name: 'Plain', classFeatures: [feature('Rally')] });
const LAYER = indexDataset(makeDataset({ classes: [WARLOCKISH, PLAIN] }));

const sheet = (p: Partial<Character> = {}): Character => makeCharacter({ classRef: 'plain', ...p });

describe('who the Focus track is drawn for', () => {
  it('is the Martial Artist, by the subclass the book ties the sheet to', () => {
    expect(drawsFocus(sheet({ subclassRefs: [STANCE_SUBCLASS] }))).toBe(true);
    expect(drawsFocus(sheet({ subclassRefs: ['school-of-knowledge'] }))).toBe(false);
    expect(drawsFocus(sheet())).toBe(false);
  });

  it('is also anyone already carrying a stance or holding Focus, whoever they are', () => {
    /*
     * The Build screen's stance section is built on this rule and the reason is
     * the same one: a sheet that arrived by QR or by file from a build with a
     * different subclass goes on writing `focus` and `stanceRefs` to storage,
     * and a screen that refuses to show a number the sheet is holding is a
     * resource that cannot be spent. Hidden is how a thing becomes unspendable.
     */
    expect(drawsFocus(sheet({ stanceRefs: ['favored'] }))).toBe(true);
    expect(drawsFocus(sheet({ focus: { marked: 1, max: MAX_FOCUS } }))).toBe(true);
    // And an empty track on a sheet with no stance is still nothing to draw.
    expect(drawsFocus(sheet({ focus: { marked: 0, max: MAX_FOCUS } }))).toBe(false);
  });

  it('follows a multiclass, because the level-up writes the subclass ref', () => {
    /*
     * `drawsFocus` reads `subclassRefs` and has no `multiclassRef` arm, unlike
     * `drawsFavor` below - and that is a claim about `applyLevelUp` rather than
     * a shortcut. Folio 54: a multiclass "acquires its class feature" and takes
     * a foundation card from one of its subclasses, and the engine's
     * `multiclass` case pushes that subclass ref onto `subclassRefs`. If it ever
     * stops doing so, a Warlock who multiclassed into Brawler loses the Focus
     * row and nothing else in the app would say why - so it is pinned here,
     * where the consequence is, and not only in the level-up suite.
     */
    const plan = (toLevel: number, picks: LevelUpPlan['picks']): LevelUpPlan => ({
      fromLevel: toLevel - 1,
      toLevel,
      tier: 3 as Tier,
      achievement: tierAchievementFor(toLevel),
      picks,
      newCardRef: null,
      exchange: null,
    });
    const before = makeCharacter({ classRef: 'warlockish', level: 4 });
    expect(drawsFocus(before)).toBe(false);

    const after = applyLevelUp(
      before,
      plan(5, [
        {
          optionId: 'multiclass',
          optionTier: 3 as Tier,
          detail: { classRef: 'brawler', domain: 'valor', subclassRef: STANCE_SUBCLASS },
        },
      ]),
    );
    expect(after.subclassRefs).toContain(STANCE_SUBCLASS);
    expect(drawsFocus(after)).toBe(true);
  });
});

describe('who the Favor track is drawn for', () => {
  it('asks the dataset for the class feature, not the ref', () => {
    expect(drawsFavor(sheet({ classRef: 'warlockish' }), LAYER)).toBe(true);
    expect(drawsFavor(sheet({ classRef: 'plain' }), LAYER)).toBe(false);
  });

  it('reads the multiclass too, which is the arm `grantsFavor` deliberately has not got', () => {
    // A Plain who took a patron at level 5 has Favor. `grantsFavor` answers what
    // a sheet is CREATED holding and so reads one class; this answers what a
    // sheet SHOWS and has to read both, or the level-5 pact is invisible.
    const pact = sheet({ classRef: 'plain', multiclassRef: 'warlockish' });
    expect(drawsFavor(pact, LAYER)).toBe(true);
  });

  it('draws a track the sheet is already holding, even with a class this build cannot name', () => {
    const stranger = sheet({ classRef: 'from-a-later-book', favor: { marked: 2, max: MAX_FAVOR } });
    expect(drawsFavor(stranger, LAYER)).toBe(true);
    // The empty track on the same unnameable class is nothing to draw.
    expect(drawsFavor({ ...stranger, favor: { marked: 0, max: MAX_FAVOR } }, LAYER)).toBe(false);
  });

  it('says no rather than throwing when there is no class at all', () => {
    expect(drawsFavor(sheet({ classRef: '', multiclassRef: null }), LAYER)).toBe(false);
  });
});

describe('the address this row writes down', () => {
  it('resolves in the shipped dataset, so a rename reddens here instead of deleting the row', () => {
    /*
     * The repo's rule for writing a slug into `src/`: it is checked against the
     * dataset every run. `IGNORES_BURDEN_FEATURE` is held to the same
     * condition. Without this, a printing that renamed the subclass would make
     * `drawsFocus` quietly answer false for everybody the book gave Focus to.
     */
    expect(index.subclasses.get(STANCE_SUBCLASS)?.name).toBe('Martial Artist');
  });

  it('is the same string the Build screen writes down, which is the only other copy', () => {
    /*
     * `src/ui/build/Edit.tsx` declares `STANCE_SUBCLASS` of its own. That
     * duplication is deliberate for exactly one round - that file belongs to
     * another lane this pass - and this is what stops it drifting. Two copies
     * of one address is how the Build screen and this row come to disagree
     * about whose sheet the stances are, drawing the Focus track in one place
     * and refusing it in the other, with nothing red anywhere to say so. The
     * next hand to open Edit.tsx should delete its copy and import the engine's;
     * this assertion goes green either way, because the import carries the same
     * literal into the file it reads.
     */
    const editSource = readFileSync('src/ui/build/Edit.tsx', 'utf8');
    expect(editSource).toContain(`'${STANCE_SUBCLASS}'`);
  });
});

// ---------------------------------------------------------------------------
// 2-6. The row itself
// ---------------------------------------------------------------------------

const seed = (p: Partial<Character>): Character => {
  const character = { ...playedCharacter(), ...p };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  return character;
};

const render = (p: Partial<Character>): Character => {
  const character = seed(p);
  act(() => root.render(<ClassTracks />));
  return character;
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named = (name: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '') === name);
  if (found === undefined) {
    throw new Error(
      `no control called "${name}". Controls here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
};
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const stored = (): Character => useApp.getState().characters[0]!;
const strips = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('[role="group"]'),
];
const stripNames = (): string[] => strips().map((g) => g.getAttribute('aria-label') ?? '');

/** The touch floor as the stylesheet declares it, at the narrowest glass. */
const px = (value: string): number => resolve(value, NARROW);

describe('a sheet with neither track', () => {
  it('draws nothing at all - not an empty row, not a gap', () => {
    // The Bard fixture: no Favor feature, no Martial Artist, both tracks empty.
    render({});
    expect(container.innerHTML).toBe('');
  });
});

describe('a sheet with one track', () => {
  it('draws that one, full width, and not a hole where the other would be', () => {
    render({ favor: { marked: 3, max: MAX_FAVOR } });
    expect(stripNames()).toEqual(['FAVOR']);
    // One column, so the single strip takes the row. The Chrome rig measures it
    // at 369x46 on a 393px phone; here the claim is only that the template asks
    // for one track rather than two.
    const row = container.firstElementChild as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
  });

  it('draws FOCUS for a Martial Artist who has no patron', () => {
    render({ subclassRefs: [STANCE_SUBCLASS] });
    expect(stripNames()).toEqual(['FOCUS']);
  });
});

describe('a sheet with both', () => {
  it('draws Focus first and Favor second, in two tracks', () => {
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 2, max: MAX_FOCUS },
      favor: { marked: 3, max: MAX_FAVOR },
    });
    expect(stripNames()).toEqual(['FOCUS', 'FAVOR']);
    const row = container.firstElementChild as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('reads out n of max in a fixed number of glyphs, at both ends of the range', () => {
    /*
     * The reflow property, as far as jsdom can carry it: the value is three
     * characters at 0 and three at 6, in a tabular face, so nothing under a
     * thumb that is already coming down can change width between two taps. The
     * pixels are in the Chrome rig - 28.81 wide at every one of the three
     * states measured - and this is the half that will still be true after a
     * font changes.
     */
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 0, max: MAX_FOCUS },
      favor: { marked: 6, max: MAX_FAVOR },
    });
    const readouts = strips().map((g) => (g.textContent ?? '').replace(/[−+]/g, '').trim());
    expect(readouts).toEqual(['FOCUS0/6', 'FAVOR6/6']);
  });
});

describe('the two glyphs', () => {
  it('spend and gain, writing the sheet the store is holding', () => {
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 2, max: MAX_FOCUS },
      favor: { marked: 3, max: MAX_FAVOR },
    });

    click(named('FAVOR minus one'));
    expect(stored().favor.marked).toBe(2);

    click(named('FOCUS plus one'));
    expect(stored().focus.marked).toBe(3);
  });

  it('refuses the seventh box rather than clamping it, which is what the rules cap means', () => {
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: MAX_FOCUS, max: MAX_FOCUS },
      favor: { marked: MAX_FAVOR, max: MAX_FAVOR },
    });
    expect(named('FAVOR plus one').disabled).toBe(true);
    click(named('FAVOR plus one'));
    expect(stored().favor.marked).toBe(MAX_FAVOR);
  });

  it('refuses to spend what is not there', () => {
    render({ subclassRefs: [STANCE_SUBCLASS], focus: { marked: 0, max: MAX_FOCUS } });
    expect(named('FOCUS minus one').disabled).toBe(true);
    click(named('FOCUS minus one'));
    expect(stored().focus.marked).toBe(0);
  });

  it('keeps every target at the touch floor the stylesheet declares', () => {
    /*
     * `--tap` through `tokens.ts` rather than the number 44 written here: a copy
     * of the stylesheet kept by hand goes on passing this sweep the day the
     * stylesheet moves. NARROW, because 320 is where a floor breaks if it is
     * going to.
     */
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 2, max: MAX_FOCUS },
      favor: { marked: 3, max: MAX_FAVOR },
    });
    const floor = px('var(--tap)');
    expect(buttons()).toHaveLength(4);
    for (const b of buttons()) {
      expect(px(b.style.width), `${b.getAttribute('aria-label') ?? '?'} width`).toBe(floor);
      expect(px(b.style.minHeight), `${b.getAttribute('aria-label') ?? '?'} height`).toBe(floor);
    }
  });
});

describe('the floor this file declares for itself', () => {
  it('is the stylesheet\u2019s, on the strip and on the readout between the steppers', () => {
    /*
     * The sweep in `the two glyphs` reads the two STEPPERS, and those are
     * `Counter`\u2019s own `Step`: they carry their 44 whatever this file says, so
     * they cannot redden for anything this file gets wrong. The two boxes this
     * file declares ITSELF had nothing on them - `const TAP = 44` cut to 24 and
     * the readout\u2019s `minWidth` cut to 0 both survived the whole suite green -
     * and they are the two the Chrome rig\u2019s width sweep rests on.
     *
     * The strip\u2019s `minHeight` is what makes it 46 tall - 44 of target and its
     * own 1px border top and bottom - rather than as short as its text. The
     * readout\u2019s `minWidth` is the declared 44 the docblock measures holding
     * down to viewport 298, and it is why the strip OVERFLOWS below that floor
     * instead of squeezing the number: measured in Chrome, dropping it lets the
     * readout collapse to 35 at viewport 280 and 25 at 260, which is this row
     * quietly disagreeing with the 2x2 grid above it, whose own `+` is pushed
     * off the glass at exactly the same widths.
     *
     * `var(--tap)` and not the number, for the reason the stepper sweep gives.
     */
    render({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 2, max: MAX_FOCUS },
      favor: { marked: 3, max: MAX_FAVOR },
    });
    const floor = px('var(--tap)');
    expect(strips()).toHaveLength(2);
    for (const strip of strips()) {
      const name = strip.getAttribute('aria-label') ?? '?';
      expect(px(strip.style.minHeight), `${name} strip height`).toBe(floor);
      const readout = strip.children[1] as HTMLElement;
      expect(readout.textContent, `${name} middle child is the label over the value`).toMatch(
        /^[A-Z]+\d\/\d$/,
      );
      expect(px(readout.style.minWidth), `${name} readout floor`).toBe(floor);
    }
  });
});

describe('where the row sits', () => {
  it('is a sibling of the 2x2 grid and never a fifth and sixth card in it', () => {
    /*
     * The owner's decision and the arithmetic behind it: the four counters are
     * `minmax(0, 1fr)` tracks over items whose min-content is 44 + 44 of
     * steppers, so six cards in that grid is one wrap and the four that were
     * already there pay for it in width. Mounted here rather than asserted
     * about a file, because the thing that could go wrong is a later hand
     * moving the row INTO the grid to tidy it, which reads fine in a diff.
     */
    const character = seed({
      subclassRefs: [STANCE_SUBCLASS],
      focus: { marked: 2, max: MAX_FOCUS },
      favor: { marked: 3, max: MAX_FAVOR },
    });
    expect(character.id).not.toBe('');
    act(() => root.render(<Vitals stats={playedStats()} layout="phone" showState={false} bare />));

    const focus = strips().find((g) => g.getAttribute('aria-label') === 'FOCUS');
    expect(focus, 'the Focus strip is not on the sheet at all').toBeDefined();

    const hp = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('HP '));
    expect(hp, 'the HP counter is not on the sheet at all').toBeDefined();
    const grid = hp!.closest('div[style*="grid-template-columns"]');
    expect(grid, 'the four counters are not in a grid any more').not.toBeNull();
    expect(grid!.contains(focus!)).toBe(false);

    // And it is UNDER them: the row follows the grid in document order.
    expect(
      grid!.compareDocumentPosition(focus!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('the stepper it presses', () => {
  it('is `Counter`’s own, so there is not a third one in this app', () => {
    /*
     * `src/ui/build/parts.tsx` already has a `Stepper` with a different shape
     * and a different floor. A third would be a third set of measurements - the
     * 44px floor, the `flex: none` that a 0.5px overflow at 360 once ate, the
     * ring that outlives the finger - kept by hand in three places. The import
     * is the claim; the floor sweep above is what it buys.
     */
    const source = readFileSync('src/ui/player/ClassTracks.tsx', 'utf8');
    expect(source).toMatch(/import \{ Step \} from '\.\.\/shared\/Counter\.tsx';/);
  });
});
