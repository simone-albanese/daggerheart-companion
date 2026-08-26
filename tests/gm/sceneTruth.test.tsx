// @vitest-environment jsdom
/**
 * What the live scene tells a GM about the thing and about the place.
 *
 * Four fields the app already held and did not draw where the decision is
 * taken. `AdversaryBlock` printed MOTIVES & TACTICS on the bestiary card while
 * `CombatantCard` - the one on screen during the fight - printed none;
 * `EnvironmentBlock` drew impulses and potential adversaries while
 * `EnvironmentBand`, the other half of the same file, drew neither; and the two
 * environments that print `Difficulty: Special` had their readout suppressed
 * with nothing put in its place, so the field read as absent rather than as
 * special.
 *
 * These read `data/srd-1.0.json` rather than a fixture, the way
 * `tests/gm/bestiaryFilter.test.tsx` does, and for its reason: every claim here
 * is a claim about the book this app ships. A fixture written in this file
 * could be given motives, impulses and a zero Difficulty to order, and would go
 * on passing after a dataset rebuild moved any of them.
 *
 * The Difficulty tests carry their own premise. `it('is Ambushed and Ambushers
 * ...')` asserts which environments print Special before anything asserts what
 * the band does about it, because every other test in that block is only
 * interesting while that is still true of the shipped file.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Adversary, Dataset, Environment } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { makeCombatant } from '../../src/engine/encounter.ts';
import type { SceneCombatant } from '../../src/engine/encounter.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { EnvironmentBand, EnvironmentBlock } from '../../src/ui/gm/StatBlock.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

/** The two the parser stores as 0, found by the property rather than by id. */
const special = (): Environment[] => dataset.environments.filter((e) => e.difficulty <= 0);

/** A place with all three fields filled, for the fields that are not Special. */
const marketplace = (): Environment =>
  dataset.environments.find((e) => e.id === 'bustling-marketplace')!;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({ hydrated: true, combatants: [], environmentRef: null, region: 'scene' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';

const scene = (combatants: SceneCombatant[], environmentRef: string | null = null): void => {
  // Inside the `act`, not before it: the second call in a test finds the tree
  // already mounted, and a `setState` outside `act` re-renders it outside
  // `act`. React says so on stderr, and a warning nobody reads is how the next
  // real one gets missed. (`sceneConfirmation.test.tsx` avoids the same trap
  // by writing to the store inside an explicit `act`.)
  act(() => {
    useGm.setState({ combatants, environmentRef });
    root.render(createElement(Scene, { phone: true }));
  });
};

const band = (environment: Environment, strongestHere?: number): void => {
  act(() =>
    root.render(
      createElement(EnvironmentBand, {
        environment,
        // Spread rather than passed as undefined, so the browsing case is the
        // prop being *absent* - which is the shape `Bestiary.tsx` has.
        ...(strongestHere === undefined ? {} : { strongestHere }),
      }),
    ),
  );
};

/** The band's fold, which is the only `aria-expanded` control it draws. */
const openTheBand = (): void => {
  const fold = container.querySelector('button[aria-expanded]');
  if (fold === null) throw new Error('the band drew no fold');
  act(() => {
    fold.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * The card's own fold, which is the only `aria-expanded` control a card draws.
 *
 * The same selector as `openTheBand` above, and deliberately not the same
 * helper: the two run over different trees - `scene()` renders `Scene`, `band()`
 * renders `EnvironmentBand` on its own - and one helper reaching for whichever
 * control came first is the quiet wrong-target failure this suite refuses by
 * name everywhere else.
 */
const openTheCard = (): void => {
  const fold = container.querySelector('button[aria-expanded]');
  if (fold === null) throw new Error('the card drew no fold');
  act(() => {
    fold.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/*
 * THE MOTIVES ARE BEHIND A FOLD NOW, AND A MEASUREMENT IS WHY.
 *
 * `CombatantCard`'s docblock carries it whole: at 393x852 with 47/34 insets one
 * card measured taller than the entire 498px panel holding it, and the field a
 * GM types damage into landed below the glass. So the two parts a GM does not
 * read while the fight is running - the motives and the features - are shut on
 * mount behind one `Fold`.
 *
 * What changes here is only WHERE, and these tests are written to hold exactly
 * that. The words are unchanged and still the bestiary card's; the assertions
 * that had them on sight now open one control first, and a new one holds that
 * they are NOT on sight before it - because a fold whose contents were
 * unreachable and a fold that had quietly become a deletion would both pass a
 * suite that only ever looked after the tap.
 */
describe('what the card says the thing wants, and where it says it', () => {
  it('keeps the motives and the features shut on mount', () => {
    const a = dataset.adversaries[0]!;
    expect(a.features.length).toBeGreaterThan(0);
    scene([makeCombatant(a, 0, 4)]);

    expect(text()).not.toContain('MOTIVES & TACTICS');
    // Not even the name. The chip row that used to print every feature name
    // under a shut SHOW button is what the fold cost, and the header counts
    // them instead - so a build that kept the chips would fail here.
    expect(text()).not.toContain(a.features[0]!.name);
  });

  it("prints the adversary's own motives, in the words AdversaryBlock uses", () => {
    const a = dataset.adversaries[0]!;
    scene([makeCombatant(a, 0, 4)]);
    openTheCard();

    // Not "some motives": this adversary's, joined and cased the one way the
    // bestiary card already joins and cases them.
    expect(text()).toContain(`MOTIVES & TACTICS · ${a.motives.join(', ').toUpperCase()}`);
  });

  it('prints them for every adversary the book ships, not just the first', () => {
    // 129 of 129 carry motives, which is what makes this one line rather than
    // a line plus an empty arm nobody would ever see.
    expect(dataset.adversaries.filter((a) => a.motives.length > 0)).toHaveLength(
      dataset.adversaries.length,
    );
    const last = dataset.adversaries.at(-1)!;
    scene([makeCombatant(last, 0, 4)]);
    openTheCard();
    expect(text()).toContain(`MOTIVES & TACTICS · ${last.motives.join(', ').toUpperCase()}`);
  });

  it('names both halves on the shut header and counts the features there', () => {
    const a = dataset.adversaries[0]!;
    expect(a.motives.length).toBeGreaterThan(0);
    expect(a.features.length).toBeGreaterThan(0);
    scene([makeCombatant(a, 0, 4)]);

    // The label is built from what is actually inside, so a dataset with one
    // half missing gets a header that does not name the other.
    expect(text()).toContain('Motives & features');
    expect(text()).toContain(`${String(a.features.length)} FEATURES`);
  });

  it('gives the feature text and not just the name when it opens', () => {
    const a = dataset.adversaries[0]!;
    scene([makeCombatant(a, 0, 4)]);
    openTheCard();

    // The whole `FeatureList`, which is the half the old chip row never had:
    // the name was one tap away before and the rules text was the same tap.
    expect(text()).toContain(a.features[0]!.name);
    expect(text()).toContain(a.features[0]!.text);
  });

  it('says nothing about motives for a combatant this dataset cannot resolve', () => {
    scene([
      {
        id: 'gone-0',
        adversaryRef: 'not-a-real-adversary',
        name: 'Something from last week',
        hp: { marked: 0, max: 6 },
        stress: { marked: 0, max: 3 },
        thresholds: [7, 12],
        difficulty: 13,
        spotlighted: false,
        notes: '',
      },
    ]);
    // The card already explains the absence; a MOTIVES label with nothing
    // after it would be the app inventing a second explanation for it.
    expect(text()).toContain('NOT IN THIS DATASET');
    expect(text()).not.toContain('MOTIVES & TACTICS');
    // And no fold either. A header a GM can press onto an empty section is the
    // same invented explanation one control louder.
    expect(container.querySelector('button[aria-expanded]')).toBeNull();
  });
});

/*
 * WHERE A MINION GROUP'S COUNT LIVES, AND WHAT MOVED OUT OF THE WAY FOR IT.
 *
 * The owner settled it on 2026-08-25: how many are still standing is a figure
 * of the creature, like Difficulty, so it sits in the strip with DIF and the
 * thresholds instead of taking a row of its own. `Scene.tsx`'s band comment
 * argues it and costs it; these hold the two consequences a docblock cannot -
 * that the control is still there and still writes to the board, and that the
 * sentence it displaced is only displaced on the cards that have the count.
 *
 * The dataset facts these lean on are asserted rather than assumed: in the
 * shipped book `role === 'Minion'`, `thresholds === null` and a `minionGroup`
 * divisor are the same 16 adversaries, and a card can only reach the displaced
 * arm through that coincidence. A rebuild that broke it would make these tests
 * fail rather than quietly test nothing.
 */
describe('a Minion group counts its bodies in the band, not in a row of its own', () => {
  const minionAdversary = (): Adversary => {
    const found = dataset.adversaries.find((a) => a.role === 'Minion');
    if (found === undefined) throw new Error('the shipped book has no Minion');
    return found;
  };

  const stepper = (which: 'Decrease' | 'Increase'): HTMLButtonElement => {
    const found = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${which} Minions standing"]`,
    );
    if (found === null) throw new Error(`the card drew no ${which} control for Minions`);
    return found;
  };

  it('is the same sixteen adversaries that carry all three Minion facts', () => {
    const byRole = dataset.adversaries.filter((a) => a.role === 'Minion');
    expect(byRole.length).toBeGreaterThan(0);
    expect(
      byRole.every((a) => a.thresholds === null && a.minionGroup !== undefined),
      'a Minion in this book no longer has null thresholds and a divisor, so the band arm these ' +
        'tests exercise is reachable by a different set of cards than they assume.',
    ).toBe(true);
    expect(
      dataset.adversaries.filter((a) => a.thresholds === null),
      'some non-Minion adversary now ships without thresholds, which is the one combination that ' +
        'still draws NO THRESHOLDS · ANY DAMAGE DEFEATS. Give that case a test of its own here.',
    ).toHaveLength(byRole.length);
  });

  it('draws the count in the band with DIF, and drops the sentence for an empty slot', () => {
    const a = minionAdversary();
    scene([makeCombatant(a, 0, 4)]);

    // The band, found through the control rather than through the text: this
    // adversary's role line already reads `T1 · MINION`, so a search for the
    // word in `textContent` would pass on a card that drew no control at all.
    const strip = stepper('Decrease').closest('div');
    expect(strip, 'the Minion control is not inside a band').not.toBeNull();
    expect(strip!.textContent).toContain('DIF');
    expect(strip!.textContent).toContain('MINIONS');
    // The slot is not empty any more, so the sentence that existed to explain
    // an emptiness is not drawn. The rule it stated is still on the card: the
    // damage preview prints it, and the `Minion (N)` feature carries the SRD's
    // own wording behind the fold.
    expect(text()).not.toContain('NO THRESHOLDS');
  });

  it('keeps that sentence for a combatant with no thresholds and no Minion group', () => {
    const a = minionAdversary();
    // The board is the authority, and it can hold a combination the dataset
    // does not: `makeCombatant` only writes `minionsRemaining` for a Minion, so
    // this is the same adversary with the count taken off the board.
    const { minionsRemaining: _dropped, ...noGroup } = makeCombatant(a, 0, 4);
    scene([noGroup]);

    expect(text()).toContain('NO THRESHOLDS · ANY DAMAGE DEFEATS');
    expect(
      container.querySelector('button[aria-label="Decrease Minions standing"]'),
      'a combatant the board gives no Minion count still drew the control',
    ).toBeNull();
  });

  it('has no row of its own left, and no gloss beside one', () => {
    const a = minionAdversary();
    scene([makeCombatant(a, 0, 4)]);

    // The label the old `Stepper` printed over its control, and the sentence
    // that sat beside it. Both went with the row; the aria-labels on the two
    // buttons are where "Minions standing" survives.
    expect(text()).not.toContain('MINIONS STANDING');
    expect(text()).not.toContain('One group.');
  });

  it('still writes both ways to the board it was moved off a row for', () => {
    const a = minionAdversary();
    scene([makeCombatant(a, 0, 4)]);
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(4);

    act(() => stepper('Decrease').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(3);

    act(() => stepper('Increase').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(4);
  });

  it('refuses to count below nothing, the way the row it replaces did', () => {
    const a = minionAdversary();
    scene([{ ...makeCombatant(a, 0, 4), minionsRemaining: 0 }]);

    expect(stepper('Decrease').disabled).toBe(true);
    act(() => stepper('Decrease').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(0);
  });

  it('declares the touch floor on both of its buttons, where a test can read it', () => {
    const a = minionAdversary();
    scene([makeCombatant(a, 0, 4)]);

    // A floor that came from a token under a pointer query, or from a class,
    // is a floor jsdom scores 0 for - which is how this app's sweeps have been
    // fooled before. The band's height IS this number, so it is written inline.
    for (const which of ['Decrease', 'Increase'] as const) {
      expect(stepper(which).style.width).toBe('44px');
      expect(stepper(which).style.minHeight).toBe('44px');
    }
  });
});

describe('what the band says about the place', () => {
  it('shows the impulses without asking for a tap', () => {
    const e = marketplace();
    band(e);
    expect(text()).toContain(`IMPULSES · ${e.impulses.toUpperCase()}`);
  });

  it('keeps the potential adversaries behind the fold, and gives all of them when it opens', () => {
    const e = marketplace();
    expect(e.potentialAdversaries.length).toBeGreaterThan(0);

    band(e);
    for (const line of e.potentialAdversaries) expect(text()).not.toContain(line);

    openTheBand();
    expect(text()).toContain('Potential adversaries');
    for (const line of e.potentialAdversaries) expect(text()).toContain(line);
    // The features are still the other half of the same fold.
    expect(text()).toContain(e.features[0]!.name);
  });

  it('draws both fields in the live scene, which is where the bestiary used to win', () => {
    const e = marketplace();
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)], e.id);
    expect(text()).toContain(`IMPULSES · ${e.impulses.toUpperCase()}`);
    openTheBand();
    expect(text()).toContain(e.potentialAdversaries[0]!);
  });
});

describe('the Difficulty of a place that prints none', () => {
  it('is Ambushed and Ambushers, and only those two', () => {
    // The premise every other test in this block stands on. If a rebuild adds
    // a third or renames one of these, the substitute is being drawn for
    // something nobody reasoned about.
    expect(special().map((e) => e.name).sort()).toEqual(['Ambushed', 'Ambushers']);
    for (const e of special()) expect(e.difficulty).toBe(0);
  });

  it('prints the book’s own word instead of leaving the field absent', () => {
    band(special()[0]!);
    expect(text()).toContain('DIF SPECIAL');
  });

  it('derives it from the strongest adversary on the board, and says the app did the arithmetic', () => {
    const strong = dataset.adversaries.find((a) => a.difficulty === 14)!;
    const weak = dataset.adversaries.find((a) => a.difficulty === 10)!;

    // Both orders, because one order alone cannot tell a maximum from "the
    // last one added" - and adding the tough thing last is the common case, so
    // the test that only did that would be green against either.
    for (const pair of [
      [weak, strong],
      [strong, weak],
    ]) {
      scene([makeCombatant(pair[0]!, 0, 4), makeCombatant(pair[1]!, 1, 4)], special()[0]!.id);
      expect(text()).toContain(`≈ DIF ${strong.difficulty} · FROM THE STRONGEST ADVERSARY HERE`);
      expect(text()).toContain('COMPUTED BY THIS APP');
      expect(text()).not.toContain(`≈ DIF ${weak.difficulty}`);
      // And the header still says what the book says, beside the substitute.
      expect(text()).toContain('DIF SPECIAL');
    }
  });

  /*
   * The board's copy of the number, not the dataset's.
   *
   * `makeCombatant` copies `difficulty` off the adversary at spawn, so a
   * combatant built the normal way carries the two in agreement - and a test
   * built from one cannot tell which of them the band read. Swapping the
   * reduce to `byRef.get(c.adversaryRef)?.difficulty ?? 0` passed every test
   * in this repo. The decision is written down in `Scene.tsx` (the card
   * beneath the band prints the board's copy, so the band has to agree with
   * the board), and these two put the numbers in disagreement so that it is
   * held rather than only stated.
   */
  it('reads the Difficulty on the board, not the one on the adversary behind it', () => {
    // A scene that outlived a dataset rebuild: the persisted combatant keeps
    // the number it was spawned with, and the card under the band prints it.
    const a = dataset.adversaries.find((x) => x.difficulty === 10)!;
    const stale: SceneCombatant = { ...makeCombatant(a, 0, 4), difficulty: 18 };
    expect(stale.difficulty).not.toBe(a.difficulty);

    scene([stale], special()[0]!.id);

    expect(text()).toContain('≈ DIF 18 · FROM THE STRONGEST ADVERSARY HERE');
    expect(text()).not.toContain(`≈ DIF ${a.difficulty}`);
    // The card is the other half of the claim: the two agree because they read
    // the same field, which is the whole reason the field was chosen.
    const card = container.querySelector('article.panel');
    expect(card?.textContent).toContain('DIF18');
  });

  it('reads it off a combatant whose adversary this dataset does not have', () => {
    // `byRef.get` returns undefined here, so a band deriving from the
    // adversary list has nothing to read and falls to a number that is on no
    // card - which is the suppressed-0 lie back by another door.
    scene(
      [
        {
          id: 'gone-0',
          adversaryRef: 'not-a-real-adversary',
          name: 'Something from last week',
          hp: { marked: 0, max: 6 },
          stress: { marked: 0, max: 3 },
          thresholds: [7, 12],
          difficulty: 15,
          spotlighted: false,
          notes: '',
        },
      ],
      special()[0]!.id,
    );

    expect(text()).toContain('NOT IN THIS DATASET');
    expect(text()).toContain('≈ DIF 15 · FROM THE STRONGEST ADVERSARY HERE');
    expect(text()).not.toContain('≈ DIF 0');
  });

  it('claims no number while browsing, where there is no board to read', () => {
    // `Bestiary.tsx` draws this band with no scene in front of the reader, and
    // the store it could have reached into still holds last night's fight.
    useGm.setState({ combatants: [makeCombatant(dataset.adversaries[0]!, 0, 4)] });
    band(special()[0]!);

    expect(text()).toContain('DIF SPECIAL');
    expect(text()).not.toContain('COMPUTED BY THIS APP');
    expect(text()).not.toContain('≈ DIF');
  });

  it('claims no number in a scene with nothing in it', () => {
    scene([], special()[0]!.id);
    expect(text()).toContain('DIF SPECIAL');
    expect(text()).not.toContain('COMPUTED BY THIS APP');
  });

  it('says the same word on the full block, which had a dash there', () => {
    // The sweep half. `EnvironmentBlock` printed '—' on the same 0, which is
    // the field reading as missing rather than as Special, and its comment
    // blamed the type: four of the six Events in the book print a Difficulty.
    act(() =>
      root.render(
        createElement(EnvironmentBlock, {
          environment: special()[0]!,
          active: false,
          onToggle: () => undefined,
        }),
      ),
    );
    expect(text()).toContain('SPECIAL');
    expect(text()).not.toContain('—');
    expect(dataset.environments.filter((e) => e.type === 'Event' && e.difficulty > 0)).toHaveLength(
      4,
    );
  });

  it('leaves a place that prints a Difficulty alone', () => {
    const e = marketplace();
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)], e.id);
    expect(text()).toContain(`DIF ${e.difficulty}`);
    expect(text()).not.toContain('DIF SPECIAL');
    expect(text()).not.toContain('COMPUTED BY THIS APP');
  });
});

/**
 * The four declarations the header row's arithmetic is standing on.
 *
 * `StatBlock.tsx` works out that the shut header row comes to 343.70 in a 339px
 * column and therefore wraps, and that the wrap costs nothing because two lines
 * are 42.60 against the button's own floor. Every term in that is a declaration
 * except the name's width - which is exactly why it can be written down at all,
 * and exactly why it stops being true the moment one of them is edited. jsdom
 * lays nothing out, so what a test can hold is the declarations themselves.
 *
 * The wrap and the name's `minWidth: 0` are the pair that make the outcome a
 * wrap rather than an overflow: without either one, the row's overflow is a
 * defect instead of a second line. `gap` is 27 of the 343.70. `minHeight` is
 * what makes the second line free.
 */
describe('the header row is declared to wrap, and to cost nothing when it does', () => {
  const fold = (): HTMLButtonElement => {
    const found = container.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (found === null) throw new Error('the band drew no fold');
    return found;
  };

  it('wraps the row rather than letting it overflow the column', () => {
    band(special()[0]!);
    expect(fold().style.flexWrap).toBe('wrap');
  });

  it('lets the name give way, so the wrap is the only thing that can happen', () => {
    const e = special()[0]!;
    band(e);
    const name = [...fold().children].find((el) => el.textContent === e.name);
    // `flex: 1` is a basis of 0%, and with this the item can shrink to it
    // instead of pushing the row past its edge.
    expect((name as HTMLElement | undefined)?.style.minWidth).toBe('0px');
  });

  it('keeps the 9px gap the sum counts three of', () => {
    band(special()[0]!);
    expect(fold().style.gap).toBe('9px');
  });

  it('declares the 46px floor that absorbs the second line', () => {
    // 16.10 + 9 + 17.50 = 42.60, so the one-line and the two-line rows are the
    // same height and nothing below the band moves when it wraps.
    band(special()[0]!);
    expect(fold().style.minHeight).toBe('46px');
  });
});

describe('END SCENE names what the second tap takes', () => {
  const endScene = (): HTMLButtonElement => {
    const found = [...container.querySelectorAll('button')].find((b) =>
      ['END SCENE', 'TAP AGAIN TO END'].includes((b.textContent ?? '').trim()),
    );
    if (found === undefined) throw new Error('no END SCENE control');
    return found;
  };
  const arm = (): void => {
    act(() => {
      endScene().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  /** The one `.t-dense` in this screen: the line naming what END SCENE takes. */
  const costLine = (): HTMLParagraphElement => {
    const found = container.querySelectorAll('p.t-dense');
    if (found.length !== 1) throw new Error(`expected one cost line, found ${found.length}`);
    return found[0] as HTMLParagraphElement;
  };

  it('counts the adversaries it is about to clear before anyone arms it', () => {
    const e = marketplace();
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4), makeCombatant(dataset.adversaries[1]!, 1, 4)], e.id);

    // Not armed. The line used to be gated on `armed` and removed again by a
    // 4-second timer, which took the card grid up with it; the geometry that
    // costs is pinned in tests/gm/sceneConfirmation.test.tsx. What is pinned
    // here is that a resting END SCENE already says what it would take.
    //
    // `clearScene` is `commit({ combatants: [] })`, so both halves are read off
    // the same line: what is in the commit goes, what is not stays.
    expect(text()).toContain('Clears 2 adversaries and every HP and Stress mark on them.');
    expect(text()).toContain(`${e.name}, Fear and the countdowns stay.`);
  });

  it('says the same words armed, so arming cannot change the wrap', () => {
    const e = marketplace();
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4), makeCombatant(dataset.adversaries[1]!, 1, 4)], e.id);
    const resting = costLine().textContent;
    arm();
    expect(endScene().textContent).toBe('TAP AGAIN TO END');
    expect(costLine().textContent).toBe(resting);
  });

  it('says one adversary singular', () => {
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)], marketplace().id);
    expect(text()).toContain('Clears 1 adversary and every HP and Stress mark on them.');
  });

  it('tells the truth over an empty table, without echoing the empty state', () => {
    // The unconditional arming is a recorded decision, pinned in
    // tests/gm/sceneConfirmation.test.tsx. This asserts the line is not a lie
    // about clearing something - and that it does not repeat the "Nothing in
    // the scene" heading the empty panel below already carries.
    scene([], marketplace().id);
    expect(costLine().textContent).toContain('Nothing to clear.');
    expect(costLine().textContent).not.toContain('Nothing in the scene');
  });

  it('says no environment is set when none is', () => {
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)], null);
    expect(text()).toContain('No environment is set; Fear and the countdowns stay.');
  });

  it('keeps saying it, and drops to nothing to clear, once the scene is cleared', () => {
    const e = marketplace();
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)], e.id);
    arm();
    arm();
    expect(useGm.getState().combatants).toHaveLength(0);
    expect(useGm.getState().environmentRef).toBe(e.id);
    // The environment survived the clear, so the line still names it - and the
    // count half has become the empty one.
    expect(costLine().textContent).toBe(`Nothing to clear. ${e.name}, Fear and the countdowns stay.`);
  });
});

/**
 * THE ONE THING ON THIS CARD THAT NOTHING WAS HOLDING.
 *
 * Found by mutation and not by reading: swapping the chip's two labels, so an
 * unspotlit adversary reads SPOTLIT and a spotlit one reads SPOTLIGHT, passed
 * all 136 files and all 3327 tests. `aria-pressed` was guarded by nothing here
 * either. The chip is the control a GM touches most often in a fight and the
 * only thing on the card that says which adversary the spotlight is on, so a
 * suite that cannot tell its two states apart is not holding the card.
 *
 * The sibling mutant on the same component - `motives.length > 0` widened to
 * `>= 0` - also survives the whole suite, re-run this round at 136 files and
 * 3334 tests, and is still deliberately left alone - but not for the reason
 * that stood here. "`Scene.tsx` only ever resolves
 * adversaries out of that dataset", meaning `data/srd-1.0.json`, was false:
 * `Scene` reads `useApp((s) => s.dataset.adversaries)`, and `state.ts` fills
 * `dataset` from `resolveDataset` in `src/store/dataset.ts` - the SRD merged
 * field by field with every imported layer. That merge can introduce an
 * adversary the SRD has never heard of: an overlay whose `entityId` misses the
 * bucket gets `{ id, provenance: {} }` pushed into the collection. So the
 * premise has to be about the merged dataset, and it survives there:
 *
 * - The SRD half is as counted - 129 of 129 carry motives, and the test above
 *   asserts that rather than trusting it.
 * - The layer half cannot contribute an empty one. The adversary parser in
 *   `shared/parsers/adversaries.ts` will not produce it: `requireText` throws
 *   "stat block has no motives" when the `Motives & Tactics:` line is absent,
 *   and `splitList` throws "empty motives list" when it is there with nothing
 *   in it. And even if one arrived, `contributedFields` in
 *   `src/import/reconcile.ts` drops every empty array before an overlay is
 *   written, for the reason its own comment gives - a defined-but-empty field
 *   reads downstream as "the manual says this is blank". `putOverlays` has
 *   exactly one caller, the import worker, so there is no third way in.
 *
 * So no adversary this component can resolve has `motives.length === 0`, the
 * two forms cannot differ on any reachable input, and it is an equivalent
 * mutant rather than a hole. (A layer-added adversary with no `motives` field
 * at all would throw on `.length` under both forms alike, which is a different
 * subject and not this one's.) A test written to kill it would still be
 * asserting on a combatant neither the book nor an import can produce.
 */
/*
 * VULNERABLE, DERIVED FROM THE STRESS TRACK THE GM IS TAPPING.
 *
 * The condition is what a full Stress track MEANS, and until 2026-08-26 this
 * app only knew that on the player's side: `Conditions.tsx` derives it through
 * `isVulnerableFromStress`, and `src/ui/gm/` did not contain the word once,
 * while `makeCombatant` had been carrying `stress: { marked, max }` all along.
 * A table that switched to the GM screen lost a rule the same app applied to
 * their own PCs, with nothing saying so - the silent shape the Massive Damage
 * decision was taken to avoid, and this is that decision's sibling.
 *
 * It is asserted on the BAND rather than anywhere else because that is where
 * it changes something: the condition reads "all rolls targeting them have
 * advantage", so what it costs is a fact about the roll being made against the
 * Difficulty two spans to its left.
 *
 * Never stored, always derived. There is no `vulnerable` field to fall out of
 * step with the counter - which is what the second test here proves, by moving
 * the track rather than by seeding two scenes.
 */
describe('a full Stress track says so on the band, on the GM side too', () => {
  const withStress = (marked: number, max: number): SceneCombatant => ({
    ...makeCombatant(dataset.adversaries.find((a) => a.thresholds !== null)!, 0, 4),
    stress: { marked, max },
  });

  it('draws VULNERABLE when every Stress slot is marked, and not before', () => {
    scene([withStress(2, 3)]);
    expect(text(), 'a track one short of full is not Vulnerable').not.toContain('VULNERABLE');

    scene([withStress(3, 3)]);
    expect(text(), 'the last Stress is marked and the band says nothing').toContain('VULNERABLE');
  });

  it('is derived, so clearing a Stress takes it away again', () => {
    scene([withStress(3, 3)]);
    expect(text()).toContain('VULNERABLE');
    scene([withStress(2, 3)]);
    expect(
      text(),
      'the word survived the track going down, so something is storing it instead of reading it',
    ).not.toContain('VULNERABLE');
  });

  it('says nothing about a track the dataset could not size', () => {
    // `max: 0` is a record with no Stress at all. Calling it Vulnerable would
    // put the condition on every row of an unresolved import - the same clause
    // `hasFallenAt` keeps, for the same reason.
    scene([withStress(0, 0)]);
    expect(text()).not.toContain('VULNERABLE');
  });

  it('takes the divider\'s place rather than a line of its own', () => {
    /*
     * Measured in Chrome on the audit rig, 393x852 with insets 47/34 and a
     * coarse pointer, two Acid Burrowers one Stress apart: the card is
     * **471.00** with the word and **471.00** without it, and the band is
     * **31** in both - which is the `8 + 15 + 8` this file's own docblock
     * states for a card with no Minion group.
     *
     * That is the whole argument for where it went. The band is `flexWrap`,
     * and the docblock over the Minion arm has already costed what a second
     * band line does: it takes the shut Minion card to 500.00, two pixels past
     * the panel. So the word could not be ADDED to that row - it had to
     * replace something, and the divider is what it replaces.
     *
     * jsdom computes no layout, so what is held here is the swap itself: the
     * two cannot both be drawn, because that is the version that costs a
     * wrap.
     */
    scene([withStress(3, 3)]);
    const bands = [...container.querySelectorAll('div.row')].filter((d) =>
      (d.textContent ?? '').trim().startsWith('DIF'),
    );
    expect(bands, 'the band no longer starts with DIF').toHaveLength(1);
    const band = bands[0]!;
    const dividers = [...band.children].filter(
      (el) => (el as HTMLElement).style.width === '1px' && (el as HTMLElement).style.height === '13px',
    );
    expect(
      dividers,
      'VULNERABLE was added beside the divider instead of in its place. Both on one line is ' +
        'the version that wraps, and a second band line puts the shut Minion card at 500.00 ' +
        'against a 498 panel.',
    ).toHaveLength(0);

    scene([withStress(2, 3)]);
    const plain = [...container.querySelectorAll('div.row')].filter((d) =>
      (d.textContent ?? '').trim().startsWith('DIF'),
    )[0]!;
    expect(
      [...plain.children].filter(
        (el) =>
          (el as HTMLElement).style.width === '1px' && (el as HTMLElement).style.height === '13px',
      ),
      'the divider is gone from a card that is not Vulnerable, so the band lost its separator',
    ).toHaveLength(1);
  });
});

describe('the chip says which state the adversary is in', () => {
  const chip = (): HTMLButtonElement => {
    const found = container.querySelector<HTMLButtonElement>('button[aria-pressed]');
    if (found === null) throw new Error('the card drew no spotlight chip');
    return found;
  };

  it('offers the verb while the adversary is not spotlit', () => {
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)]);

    expect(chip().textContent).toBe('SPOTLIGHT');
    expect(chip().getAttribute('aria-pressed')).toBe('false');
  });

  it('states the state once the adversary is spotlit', () => {
    const c = { ...makeCombatant(dataset.adversaries[0]!, 0, 4), spotlighted: true };
    scene([c]);

    expect(chip().textContent).toBe('SPOTLIT');
    expect(chip().getAttribute('aria-pressed')).toBe('true');
  });

  it('turns over on the tap, label and pressed state together', () => {
    scene([makeCombatant(dataset.adversaries[0]!, 0, 4)]);
    act(() => {
      chip().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useGm.getState().combatants[0]!.spotlighted).toBe(true);
    expect(chip().textContent).toBe('SPOTLIT');
    expect(chip().getAttribute('aria-pressed')).toBe('true');
    // And the count above the list, which reads the same field.
    expect(text()).toContain('1 SPOTLIT');
  });
});
