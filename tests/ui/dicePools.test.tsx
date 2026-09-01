// @vitest-environment jsdom
/**
 * The dice pools on the screen: who gets one, both ways of getting a face onto
 * a die, and the one question the app has to ask before it writes anything.
 *
 * THE QUESTION IS THE POINT OF THIS FILE. A Seraph's Prayer Dice are spent "to
 * aid yourself **or an ally within Far range**", and one of the things a spent
 * die may do is "gain Hope equal to the result". An app that read that and
 * added the Hope to the character in front of it would be writing the wrong
 * sheet every time the die was for somebody else, silently, on the screen a
 * player trusts to keep their numbers. So the spend sheet asks first, and the
 * ally branch writes nothing at all - it shows the number to read out loud.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DicePools } from '../../src/ui/player/DicePools.tsx';
import { rollAffordance } from '../../src/ui/shared/rollAffordance.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { usePools } from '../../src/ui/player/poolStore.ts';
import { MAX_HELD, useHeldDice } from '../../src/ui/player/heldDice.ts';
import type { Character } from '@shared/types.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // The pools are session state in localStorage and this store is a module
  // singleton, so one test's dice would otherwise be the next one's.
  act(() => usePools.setState({ byCharacter: {} }));
  // And the tray is the other one, now that a Patron Die is bought into it.
  act(() => useHeldDice.setState({ byCharacter: {} }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

/**
 * A sheet with its pools, and the two dice switches it is holding.
 *
 * The prefs are a parameter because this surface reads them now. It did not,
 * which is the defect the last block of this file is about: it offered
 * `cryptoRng` and a numeric entry to every table alike, including the one whose
 * onboarding answer was "Real dice, and the app stays out of it". Anything not
 * passed here gets `DEFAULT_PREFS`, which is the roller on and typing off.
 */
function mount(
  patch: Partial<Character> = {},
  prefs: Partial<typeof DEFAULT_PREFS> = {},
): Character {
  const character = { ...playedCharacter(), ...patch };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS, ...prefs },
    log: [],
    openCard: null,
  });
  render(createElement(DicePools, { stats: deriveStats(character, dataset, index) }));
  return character;
}

/** The three combinations `Onboarding` writes and `rollAffordance` branches on. */
const TYPED = { digitalDice: false, manualDice: true };
const OFF = { digitalDice: false, manualDice: false };

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
function named(fragment: string): HTMLButtonElement {
  const found = buttons().find(
    (b) =>
      (b.textContent ?? '').includes(fragment) ||
      (b.getAttribute('aria-label') ?? '').includes(fragment),
  );
  if (found === undefined) {
    throw new Error(
      `no control matching "${fragment}". Controls: ${buttons()
        .map((b) => (b.textContent ?? '').trim() || b.getAttribute('aria-label'))
        .join(' | ')}`,
    );
  }
  return found;
}
/**
 * Every die drawn, by what its face says.
 *
 * Matched on BOTH accessible names, which is the difference between this and
 * the version that quietly counted zero: an unrolled die says "An unrolled d6
 * of your Rally Die" and a rolled one says "Rally Die showing 5", so a filter
 * that knew only the first went blind the moment anything was rolled - which is
 * the state every assertion here is about.
 */
const isDie = (b: HTMLButtonElement): boolean => {
  const label = b.getAttribute('aria-label') ?? '';
  return label.includes('of your') || label.includes('showing');
};
const faces = (): string[] =>
  buttons()
    .filter(isDie)
    .map((b) => (b.textContent ?? '').trim());
/** The first die of a pool, rolled or not. */
const die = (poolName: string): HTMLButtonElement => {
  const found = buttons().filter(isDie).find((b) => (b.getAttribute('aria-label') ?? '').includes(poolName));
  if (found === undefined) {
    throw new Error(
      `no die of the ${poolName}. Controls: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim())
        .join(' | ')}`,
    );
  }
  return found;
};

const character = (): Character => useApp.getState().characters[0]!;

/** Type `value` onto one die of a pool, the way the spend sheet asks for it. */
const type = (target: HTMLButtonElement, value: string): void => {
  click(target);
  click(named('Type what you rolled'));
  const field = container.querySelector('input')!;
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  click(named('SET'));
};

// ---------------------------------------------------------------------------

describe('who gets a pool at all', () => {
  it('draws nothing for a character whose features grant none', () => {
    mount({ classRef: 'ranger', subclassRefs: [], multiclassRef: null });
    expect(
      container.textContent,
      'a Ranger was charged a heading for a Seraph`s dice',
    ).toBe('');
  });

  it('draws the Bard their Rally Die, with the size their level says', () => {
    mount({ classRef: 'bard', level: 5, multiclassRef: null });
    expect(text()).toContain('Rally Die');
    expect(text(), '"At level 5, your Rally Die increases to a d8"').toContain('d8');
  });
});

describe('getting a face onto a die', () => {
  /** A Seraph whose Spellcast trait is worth two, whatever trait that is. */
  function seraph(): Character {
    const trait = dataset.subclasses.find((s) => s.id === 'divine-wielder')!.spellcastTrait!;
    return mount({
      classRef: 'seraph',
      subclassRefs: ['divine-wielder'],
      multiclassRef: null,
      level: 1,
      levelUpHistory: [],
      traits: {
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
        [trait]: 2,
      },
    });
  }

  it('rolls the whole set at once, which is what the start of a session is', () => {
    seraph();
    click(named('Roll 2 d4'));
    const shown = faces();
    expect(shown, 'a Spellcast trait of two did not become two dice').toHaveLength(2);
    for (const f of shown) {
      expect(Number(f), `a d4 came up ${f}`).toBeGreaterThanOrEqual(1);
      expect(Number(f)).toBeLessThanOrEqual(4);
    }
  });

  it('takes a number the player typed, for a table rolling its own dice', () => {
    // The prefs are the point of the sentence: a table rolling its own dice is
    // one that turned typing on, and the numeric entry belongs to that switch.
    // This used to mount the defaults - the roller on, typing off - and get the
    // typed road anyway, which is the whole defect in one line of setup.
    mount({ classRef: 'bard', level: 1, multiclassRef: null }, TYPED);
    click(named('Take your Rally Die'));
    expect(faces(), 'the Rally Die did not arrive blank').toEqual(['d6']);

    click(die('Rally Die'));
    click(named('Type what you rolled'));
    const field = container.querySelector('input')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(field, '5');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(named('SET'));
    expect(faces(), 'the typed face did not reach the die').toEqual(['5']);
  });

  it('refuses a face that is not on the die', () => {
    mount({ classRef: 'bard', level: 1, multiclassRef: null }, TYPED);
    click(named('Take your Rally Die'));
    click(die('Rally Die'));
    click(named('Type what you rolled'));
    const field = container.querySelector('input')!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(field, '9');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(named('SET').disabled, 'a d6 accepted a 9').toBe(true);
  });
});

describe('spending a die, and whose sheet it is', () => {
  function seraphWithADie(): Character {
    const trait = dataset.subclasses.find((s) => s.id === 'divine-wielder')!.spellcastTrait!;
    const c = mount({
      classRef: 'seraph',
      subclassRefs: ['divine-wielder'],
      multiclassRef: null,
      level: 1,
      levelUpHistory: [],
      hope: { marked: 1, max: 6 },
      traits: {
        agility: 0,
        strength: 0,
        finesse: 0,
        instinct: 0,
        presence: 0,
        knowledge: 0,
        [trait]: 1,
      },
    });
    click(named('Roll 1 d4'));
    // A known face, so the assertion is about the arithmetic and not the RNG.
    const die = usePools.getState().byCharacter[c.id]!['prayer']![0]!;
    act(() => usePools.getState().face(c.id, 'prayer', die.id, 3));
    return c;
  }

  it('asks who it is for before it offers to write anything', () => {
    seraphWithADie();
    click(die('Prayer Dice'));
    expect(text(), 'the spend sheet did not ask').toContain('WHO IS IT FOR?');
    expect(
      buttons().some((b) => (b.textContent ?? '').includes('Gain 3 Hope')),
      'the app offered to move Hope before knowing whose Hope it was',
    ).toBe(false);
  });

  it('writes nothing at all when the die is for an ally', () => {
    const c = seraphWithADie();
    const before = character().hope.marked;
    click(die('Prayer Dice'));
    click(named('An ally'));
    expect(text()).toContain('Nothing is written here');
    expect(
      buttons().some((b) => (b.textContent ?? '').includes('Gain 3 Hope')),
      'the ally branch offered to move this sheet`s Hope',
    ).toBe(false);
    expect(character().hope.marked, 'an ally`s die moved this character`s Hope').toBe(before);
    expect(c.id).toBeDefined();
  });

  it('gains the Hope when the die is for you, and Hope is stored as available', () => {
    seraphWithADie();
    const before = character().hope.marked;
    click(die('Prayer Dice'));
    click(named('Me'));
    click(named('Gain 3 Hope'));
    /*
     * `marked` is AVAILABLE Hope, unlike every other track in this app - a die
     * that gave you three Hope has to raise it. A component that treated it as
     * "used" would have spent the Hope it was meant to grant, and the number
     * would have moved the right distance in the wrong direction.
     */
    expect(character().hope.marked, 'the Hope went the wrong way, or nowhere').toBe(before + 3);
  });

  it('clears the Stress a Rally Die is worth', () => {
    mount({ classRef: 'bard', level: 1, multiclassRef: null, stress: { marked: 4, max: 6 } });
    click(named('Take your Rally Die'));
    const c = character();
    const rallyDie = usePools.getState().byCharacter[c.id]!['rally']![0]!;
    act(() => usePools.getState().face(c.id, 'rally', rallyDie.id, 2));
    click(die('Rally Die'));
    // A Rally Die is yours by the rules, so there is nobody to ask about.
    expect(text(), 'a Rally Die asked who it was for').not.toContain('WHO IS IT FOR?');
    click(named('Clear 2 Stress'));
    expect(character().stress.marked, 'the Stress did not clear').toBe(2);
  });

  it('takes the die out of the pool when it is marked spent', () => {
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
    click(named('Take your Rally Die'));
    expect(faces()).toHaveLength(1);
    click(die('Rally Die'));
    click(named('Spent'));
    expect(faces(), 'the spent die stayed in the pool').toHaveLength(0);
  });
});

describe('the end of a session', () => {
  it('clears every pool, which nothing in this app has ever done', () => {
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
    click(named('Take your Rally Die'));
    expect(faces()).toHaveLength(1);
    click(named('End of session'));
    expect(faces(), 'the pool survived the end of the session').toHaveLength(0);
  });

  it('pays the Slayer a Hope per die cleared, and says so before it is pressed', () => {
    const c = mount({
      classRef: 'warrior',
      subclassRefs: ['call-of-the-slayer'],
      multiclassRef: null,
      level: 5,
      levelUpHistory: [],
      hope: { marked: 0, max: 6 },
    });
    // Bank two, which a Proficiency of 3 at level 5 allows.
    click(named('Bank a d6'));
    click(named('Bank a d6'));
    expect(faces()).toHaveLength(2);

    const end = named('End of session');
    expect(
      end.textContent ?? '',
      'the button did not say what it was about to do to the Hope track',
    ).toContain('+2 Hope');

    click(end);
    expect(character().hope.marked, '"gain a Hope per die cleared" paid nothing').toBe(2);
    expect(faces()).toHaveLength(0);
    expect(c.id).toBeDefined();
  });

  it('says nothing about Hope for a pool whose feature does not pay for the clear', () => {
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
    click(named('Take your Rally Die'));
    expect(
      named('End of session').textContent ?? '',
      'a Rally Die was made to pay a Hope it does not owe',
    ).not.toContain('Hope');
  });
});

/**
 * THE TWO DICE SWITCHES, ON THE SURFACE THAT WAS NOT READING THEM.
 *
 * Both roads to a face were offered unconditionally: `cryptoRng` behind **Roll
 * it** and behind **Roll N dN**, and a numeric entry beside them, whatever the
 * two switches said. Meanwhile `Settings` offers both switches and has a branch
 * for the case where both are off, and `Onboarding`'s dice question writes
 * exactly three combinations - one of which is "Real dice, and the app stays out
 * of it". A table that chose that still got a button here that rolled for them.
 *
 * So both call sites read `rollAffordance` now, and these are the tests per
 * call site per combination that the offer matches what it says. The last two
 * are the other half of the rule: taking the roller away must not take the pool
 * away, so a table that rolls its own dice still gets the dice, still records
 * what they showed, and still spends them.
 */
describe('what the two dice switches leave the pools able to do', () => {
  /** Whether a control with this word on it is on the screen at all. */
  const has = (fragment: string): boolean =>
    buttons().some(
      (b) =>
        (b.textContent ?? '').includes(fragment) ||
        (b.getAttribute('aria-label') ?? '').includes(fragment),
    );

  /** A Bard's Rally Die, blank, with its spend sheet open. */
  function openBlankDie(prefs: Partial<typeof DEFAULT_PREFS> = {}): void {
    const c = mount({ classRef: 'bard', level: 1, multiclassRef: null }, prefs);
    act(() =>
      usePools.getState().set(c.id, 'rally', [{ id: 'rally-1', face: null }]),
    );
    click(die('Rally Die'));
  }

  describe('the die with no face yet', () => {
    it('offers the roller alone on the default install', () => {
      openBlankDie();
      expect(has('Roll it'), 'the roller is off on a build that has it on').toBe(true);
      expect(
        has('Type what you rolled'),
        'typing is offered by a build whose typing switch is off',
      ).toBe(false);
    });

    it('offers the numeric entry alone when the table rolls its own dice', () => {
      openBlankDie(TYPED);
      expect(
        has('Roll it'),
        'the app offered to roll a die for a table that turned the roller off',
      ).toBe(false);
      expect(has('Type what you rolled')).toBe(true);
    });

    it('offers neither, and names the switch, when the app was told to stay out', () => {
      openBlankDie(OFF);
      expect(has('Roll it'), 'ONBOARDING`s third answer still got a roller').toBe(false);
      expect(has('Type what you rolled')).toBe(false);
      // Not a blank where two buttons were: a dead end with no exit is not an
      // honest state either, so it says where the switch is.
      expect(text(), 'nothing on screen says why there is nothing to press').toMatch(
        /Settings/,
      );
    });

    it('keeps the pool, the die and the spend with both switches off', () => {
      openBlankDie(OFF);
      // The face is the only thing the switches govern. A die you already have
      // is still a die you can put down, and the pool is still a pool.
      expect(has('Spent'), 'taking the button away took the die away').toBe(true);
      expect(has('Clear the pool')).toBe(true);
      click(named('Spent'));
      expect(faces(), 'the die could not be spent').toHaveLength(0);
    });
  });

  describe('the start-of-session roll', () => {
    /** A Seraph whose Spellcast trait is worth two, whatever trait that is. */
    function seraph(prefs: Partial<typeof DEFAULT_PREFS> = {}): Character {
      const trait = dataset.subclasses.find((s) => s.id === 'divine-wielder')!.spellcastTrait!;
      return mount(
        {
          classRef: 'seraph',
          subclassRefs: ['divine-wielder'],
          multiclassRef: null,
          level: 1,
          levelUpHistory: [],
          traits: {
            agility: 0,
            strength: 0,
            finesse: 0,
            instinct: 0,
            presence: 0,
            knowledge: 0,
            [trait]: 2,
          },
        },
        prefs,
      );
    }

    it('rolls the whole set for a table that asked the app to', () => {
      seraph();
      expect(has('Roll 2 d4')).toBe(true);
      click(named('Roll 2 d4'));
      expect(faces().every((f) => Number(f) >= 1 && Number(f) <= 4)).toBe(true);
    });

    it('hands the set out blank instead, when the roller is off', () => {
      seraph(TYPED);
      expect(
        has('Roll 2 d4'),
        '"At the start of each session, roll your Prayer Dice" was rolled BY THE APP ' +
          'for a table that turned the roller off',
      ).toBe(false);
      click(named('Take your Prayer Dice'));
      // Two dice, and not one face between them: what a table rolling its own
      // dice needs is somewhere to put the numbers, not the numbers.
      expect(faces(), 'the pool did not arrive').toEqual(['d4', 'd4']);
    });

    it('lets those blank dice be filled in by hand, which is the whole point', () => {
      seraph(TYPED);
      click(named('Take your Prayer Dice'));
      click(die('Prayer Dice'));
      click(named('Type what you rolled'));
      const field = container.querySelector('input')!;
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(field, '3');
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
      click(named('SET'));
      expect(faces(), 'the face the player rolled on the table never reached the die').toEqual([
        '3',
        'd4',
      ]);
    });

    it('goes away once the set has been handed out, so a second press cannot eat it', () => {
      /*
       * D1. `seed` builds a whole new array of blank dice and hands it to
       * `setPool`, and this button had no `dice.length === 0` on it - unlike
       * the spend-rolled sibling eleven lines below, which has had one from the
       * start. So it stayed on the screen after the pool had arrived, in the
       * row directly under the dice it had just made, and a second press
       * replaced every one of them with a blank.
       *
       * Driven exactly the way it was found: a Divine Wielder's Prayer Dice,
       * `rolledAt: 'grant'`, two d4, the roller off, both faces typed in.
       */
      seraph(TYPED);
      click(named('Take your Prayer Dice'));
      type(die('Prayer Dice'), '3');
      expect(faces()).toEqual(['3', 'd4']);
      expect(
        has('Take your Prayer Dice'),
        'the button that hands the pool out is still there with the pool on the screen',
      ).toBe(false);
      // And the way back is the one that says what it does, drawn exactly when
      // there is something to clear.
      expect(has('Clear the pool')).toBe(true);
      click(named('Clear the pool'));
      expect(faces()).toEqual([]);
      expect(has('Take your Prayer Dice'), 'the pool cannot be taken again').toBe(true);
    });

    it('takes the session roll away with it too, for the same reason', () => {
      /*
       * The sweep: `rollAll` is the other unconditional `setPool` in this file
       * and it was reachable twice as well. Its second press is a re-roll of a
       * set the table has been reading off the sheet all session - and with
       * typing on, of faces the player typed onto them. All three buttons that
       * hand a pool out are `dice.length === 0` now.
       */
      seraph();
      click(named('Roll 2 d4'));
      expect(faces()).toHaveLength(2);
      expect(has('Roll 2 d4'), 'the session roll can be pressed again mid-session').toBe(
        false,
      );
      click(named('Clear the pool'));
      expect(has('Roll 2 d4')).toBe(true);
    });

    it('hands them out blank with both switches off too, and rolls nothing', () => {
      seraph(OFF);
      expect(has('Roll 2 d4')).toBe(false);
      click(named('Take your Prayer Dice'));
      expect(
        faces(),
        'the app put a number on a die for a table that told it to stay out of it',
      ).toEqual(['d4', 'd4']);
    });
  });

  it('offers exactly what rollAffordance says it may, over all four states', () => {
    /*
     * The property rather than the four cases: whatever this surface draws, the
     * roller is on the screen exactly when `canRoll`, and the numeric entry
     * exactly when `canType`. That is the invariant the file had no answer to
     * at all - it had no opinion about the switches, which is how the offer and
     * the preference could disagree.
     */
    for (const digitalDice of [true, false]) {
      for (const manualDice of [true, false]) {
        const want = rollAffordance(digitalDice, manualDice);
        openBlankDie({ digitalDice, manualDice });
        expect(has('Roll it'), `canRoll=${String(want.canRoll)}`).toBe(want.canRoll);
        expect(has('Type what you rolled'), `canType=${String(want.canType)}`).toBe(
          want.canType,
        );
        // And the pool itself is not a roll, so it survives every one of them.
        expect(has('Spent'), 'the die went away with the switches').toBe(true);
        act(() => root.unmount());
        root = createRoot(container);
        act(() => usePools.setState({ byCharacter: {} }));
      }
    }
  });
});

/**
 * THE ONE POOL THE BOOK CHARGES FOR, and the two states it must not reach.
 *
 * *"Before making an action roll that relates to your patron's sphere of
 * influence, you can spend a Favor to call upon their aid, rolling your Patron
 * Die and adding its result to the total."* One Favor, one die, one decision -
 * so a Favor taken with no die handed over, and a die handed over for nothing,
 * are both states this screen must not be able to produce. `heldDice.test.ts`
 * proves that of the store; these prove it of the control the player actually
 * presses, which is the half a rewrite of this file could break on its own.
 *
 * The die goes into the ROLL'S TRAY and not into `poolStore`, because there is
 * nothing to hold: it is bought at the moment of the roll and gone after it.
 * That is why every assertion below reads `useHeldDice` rather than `faces()`.
 */
describe('the Warlock`s Patron Die, which costs a Favor', () => {
  /** A Warlock holding `favor` Favor and nothing else out of the ordinary. */
  function warlock(
    favor: number,
    patch: Partial<Character> = {},
    prefs: Partial<typeof DEFAULT_PREFS> = {},
  ): Character {
    return mount(
      {
        classRef: 'warlock',
        subclassRefs: [],
        multiclassRef: null,
        level: 1,
        levelUpHistory: [],
        favor: { marked: favor, max: 6 },
        ...patch,
      },
      prefs,
    );
  }

  /**
   * Tear the mounted tree down before mounting another sheet.
   *
   * `mount` writes `useApp` BEFORE it renders, so a `DicePools` still on the
   * screen from the previous sheet sees that write outside `act` and React says
   * so. The loop at the end of this file has done this from the start; these
   * tests mount twice as well, so they do it too.
   */
  const fresh = (): void => {
    act(() => root.unmount());
    root = createRoot(container);
  };

  /** The sizes in the roll's tray for this character, in order. */
  const tray = (c: Character): number[] =>
    (useHeldDice.getState().byCharacter[c.id] ?? []).map((d) => d.sides);

  const has = (fragment: string): boolean =>
    buttons().some(
      (b) =>
        (b.textContent ?? '').includes(fragment) ||
        (b.getAttribute('aria-label') ?? '').includes(fragment),
    );

  it('draws the die, its price and its size, and none of the held-pool controls', () => {
    warlock(3);
    expect(text()).toContain('Patron Die');
    expect(text(), 'the price is not on the control that charges it').toContain('1 FAVOR');
    expect(text(), 'a Patron Die starts as a d6').toContain('d6');
    // Nothing is held, so nothing is handed out, banked or cleared. A block
    // that offered those would be offering to store a die that is spent the
    // moment it is bought.
    expect(has('Take your'), 'a pool with nothing to hold offered to hand itself out').toBe(
      false,
    );
    expect(has('Bank a d')).toBe(false);
    expect(has('Clear the pool')).toBe(false);
  });

  it('takes exactly one Favor and puts exactly one die in the roll`s tray', () => {
    const c = warlock(3);
    click(named('Spend a Favor'));
    expect(character().favor.marked, 'the Favor did not come off the track').toBe(2);
    expect(tray(c), 'the die that was paid for never arrived').toEqual([6]);

    click(named('Spend a Favor'));
    expect(character().favor.marked).toBe(1);
    expect(tray(c)).toEqual([6, 6]);
  });

  it('says where the die went, and does not claim it is in the roll', () => {
    /*
     * `DualityRoll` keeps its own `armedDice` list and a tray die starts OFF
     * it: the player taps the chip to put it in the roll. A confirmation
     * reading "in your next roll" would be disproved one tap later, on the
     * screen below this one, by a player who trusted it.
     */
    const c = warlock(2);
    click(named('Spend a Favor'));
    expect(text()).toContain('DICE TRAY');
    expect(text(), 'the player is not told the die still needs arming').toContain(
      'TAP IT THERE',
    );
    expect(tray(c)).toEqual([6]);
  });

  it('answers the tap above the refusal, and not the other way round', () => {
    /*
     * Found on the screen, at 393px, and not in the source: spending the LAST
     * Favor shows both lines at once, and with the refusal written first the
     * answer to the gesture sat two paragraphs below the gesture with an
     * unrelated "No Favor to spend" in the gap. Order is the only thing under
     * test here, so it is asserted as an index and not as a rendering.
     */
    warlock(1);
    click(named('Spend a Favor'));
    const taken = text().indexOf('TAKEN');
    const refused = text().indexOf('No Favor to spend');
    expect(taken, 'the confirmation is missing').toBeGreaterThan(-1);
    expect(refused, 'the last Favor was spent and the button did not say why it is now dead').toBeGreaterThan(-1);
    expect(taken, 'the refusal was put between the button and its own confirmation').toBeLessThan(
      refused,
    );
  });

  it('refuses with an empty track, and says what to do about it', () => {
    const c = warlock(0);
    const call = named('Spend a Favor');
    expect(call.disabled, 'a patron was called on with nothing to pay them').toBe(true);
    // The control keeps its place rather than vanishing, and the reason is
    // under it - the remedy is on this sheet, not two screens away.
    expect(text(), 'nothing on screen says why the button is dead').toMatch(/No Favor to spend/);
    expect(text(), 'the way to get Favor is not named').toMatch(/tribute/);
    click(call);
    expect(tray(c), 'a die was armed for free').toEqual([]);
    expect(character().favor.marked).toBe(0);
  });

  it('takes no Favor when the roll has no room for the die', () => {
    /*
     * The direction that COSTS something. `add` drops a die silently at
     * `MAX_HELD` and tells nobody, so a screen that paid first and added
     * second would take a Favor for a die that never arrives. The button is
     * shut, and the store would refuse it anyway.
     */
    const c = warlock(3);
    act(() => {
      for (let i = 0; i < MAX_HELD; i += 1) useHeldDice.getState().add(c.id, 12);
    });
    // Re-render against the full tray. No `fresh()`: this is the same sheet
    // rendered again, and no store write happens outside `act`.
    render(createElement(DicePools, { stats: deriveStats(character(), dataset, index) }));

    const call = named('Spend a Favor');
    expect(call.disabled, 'a Favor could be spent on a die with nowhere to go').toBe(true);
    expect(text()).toMatch(/already holding/);
    click(call);
    expect(character().favor.marked, 'a Favor was taken for a die that was dropped').toBe(3);
    expect(tray(c)).toHaveLength(MAX_HELD);
  });

  it('grows to a d8 at level 5, and buys the size it is drawing', () => {
    const c = warlock(3, { level: 5 });
    expect(text(), '"increases to a d8 at level 5"').toContain('d8');
    click(named('Spend a Favor'));
    expect(tray(c), 'the block drew a d8 and bought something else').toEqual([8]);
  });

  it('is offered whatever the two dice switches say, because buying is not rolling', () => {
    /*
     * `PoolBlock` reads `rollAffordance` because it puts FACES on dice. This
     * block puts a die in the tray, which is what the tray's own `+ DIE`
     * control does for every table. A table that told the app to stay out of
     * it still spends the Favor, picks up their own d6 and types the face into
     * the roll panel - a road that already exists.
     */
    for (const prefs of [{}, TYPED, OFF]) {
      const c = warlock(2, {}, prefs);
      expect(named('Spend a Favor').disabled, JSON.stringify(prefs)).toBe(false);
      click(named('Spend a Favor'));
      expect(tray(c), JSON.stringify(prefs)).toEqual([6]);
      fresh();
      act(() => useHeldDice.setState({ byCharacter: {} }));
    }
  });

  it('draws no end-of-session control for a sheet with nothing held between sessions', () => {
    /*
     * A Warlock's only pool puts nothing in `poolStore`, so the button would
     * clear an entry that was never written and report CLEARED for it. The
     * sentence it comes from - "At the end of each session, clear all unspent
     * Rally Dice" - is not written about this die anywhere in the book.
     */
    warlock(3);
    expect(has('End of session'), 'a control that clears nothing said it had').toBe(false);

    // And the three that DO hold something still have it.
    fresh();
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
    expect(has('End of session')).toBe(true);
  });

  it('gives the die to a Ranger who multiclassed into Warlock, with no Favor to spend', () => {
    /*
     * `characterFeatures` grants a multiclass's class features, so this sheet
     * holds `Patron’s Pact` and has the die. `newCharacter` seeds three Favor
     * only for a FIRST class, on the argument it makes about the word "start",
     * so the sheet arrives with a die it cannot yet pay for - and the screen
     * has to be honest about that rather than hide either half.
     */
    const c = mount({
      classRef: 'ranger',
      multiclassRef: 'warlock',
      subclassRefs: [],
      level: 5,
      levelUpHistory: [],
      favor: { marked: 0, max: 6 },
    });
    expect(text()).toContain('Patron Die');
    expect(text(), 'the multiclass source is not named').toContain('MULTICLASS');
    expect(named('Spend a Favor').disabled).toBe(true);
    expect(text()).toMatch(/No Favor to spend/);
    expect(tray(c)).toEqual([]);
  });
});
