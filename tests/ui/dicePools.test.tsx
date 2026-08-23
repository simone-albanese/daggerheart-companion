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
import { deriveStats } from '../../src/engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { usePools } from '../../src/ui/player/poolStore.ts';
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

function mount(patch: Partial<Character> = {}): Character {
  const character = { ...playedCharacter(), ...patch };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  render(createElement(DicePools, { stats: deriveStats(character, dataset, index) }));
  return character;
}

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
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
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
    mount({ classRef: 'bard', level: 1, multiclassRef: null });
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
