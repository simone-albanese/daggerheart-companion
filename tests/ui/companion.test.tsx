// @vitest-environment jsdom
/**
 * The companion, drawn.
 *
 * `tests/engine/companion.test.ts` is the arithmetic and `srdReference.test.ts`
 * is the text; this file is the wiring between them, which neither of those can
 * see. The eight level-up options moved out of a constant in `src/engine/` and
 * into the dataset, and every assertion about them passed both before and after
 * that move - because nothing mounted the sheet. Emptying the hook that reads
 * them left 3149 tests green.
 *
 * So what this file asserts is what reached the DOM.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { newCompanion } from '../../src/engine/companion.ts';
import { useApp, useStats } from '../../src/store/state.ts';
import { CompanionPanel } from '../../src/ui/player/Companion.tsx';
import { Play } from '../../src/ui/player/Play.tsx';
import { companionUpgrades } from '../../src/ui/shared/srdReference.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

let container: HTMLDivElement;
let root: Root;

const useDesktopViewport = (): void => {
  window.matchMedia = ((query: string) =>
    ({
      matches: /min-width/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
};

beforeAll(() => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useDesktopViewport();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function seed(character: Character): void {
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
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const text = (): string => container.textContent ?? '';

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

/**
 * The phone, for the tests that need a control the cockpit does not draw.
 *
 * `ExperienceRow` is mounted by `PlayPhone` and by nothing else - the cockpit
 * draws its chips from inside `DualityRoll` - so the chips are reachable at 393
 * and not at desktop widths. Restored by the `beforeEach` above on the next
 * test rather than left set.
 */
function usePhoneViewport(): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse|pointer:\s*coarse/.test(query);
    const width = 393;
    return {
      matches:
        (max !== null && width <= Number(max[1])) ||
        (min !== null && width >= Number(min[1])) ||
        coarse,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const byText = (needle: string): HTMLElement => {
  const el = [...container.querySelectorAll<HTMLElement>('button')].find((b) =>
    (b.textContent ?? '').includes(needle),
  );
  if (el === undefined) throw new Error(`no button reads "${needle}"`);
  return el;
};

/** A companion panel on a played character, with the sheet dialog shut. */
function mountPanel(companion = newCompanion('Sable', 'A grey wolf')): Character {
  const character = { ...playedCharacter(), companion };
  seed(character);
  act(() => {
    root.render(<CompanionPanel stats={playedStats(character)} layout="desktop" />);
  });
  return character;
}

const openSheet = (): void => click(byText('SHEET'));

/**
 * Play, mounted the way the shell mounts it - through `useStats()`, so the
 * numbers move when the store does. The panel-only harness above cannot reach
 * the roll, and arming is the half of this file that needs it.
 */
function PlayScreen(): React.JSX.Element | null {
  const stats = useStats();
  return stats === null ? null : <Play stats={stats} />;
}

describe('the level-up options reach the sheet from the dataset', () => {
  it('draws one box per option the dataset carries, by name', () => {
    mountPanel();
    openSheet();
    const options = companionUpgrades(dataset.rules);
    expect(options).toHaveLength(8);
    for (const option of options) {
      expect(text()).toContain(option.name);
      // The text too, not just the label: a box whose rule is missing is a box
      // a player cannot decide about.
      expect(text()).toContain(option.text);
    }
  });

  it('counts the boxes against the dataset, not against a literal 8', () => {
    mountPanel();
    openSheet();
    expect(text()).toContain('0 OF 8 OPTIONS MARKED');
  });

  it('marks a box, and the chip on the panel counts it', () => {
    mountPanel();
    openSheet();
    click(byText('Vicious'));
    expect(text()).toContain('1 OF 8 OPTIONS MARKED');
    expect(useApp.getState().characters[0]?.companion?.upgrades).toEqual(['vicious']);
  });

  it('keeps a box marked from a slug the sheet arrived with', () => {
    // The compatibility case the ids exist for: a sheet saved before the
    // options moved into the dataset marks its boxes by these strings.
    mountPanel({ ...newCompanion('Sable', ''), upgrades: ['light-in-the-dark', 'bonded'] });
    openSheet();
    expect(text()).toContain('2 OF 8 OPTIONS MARKED');
    const marked = [...container.querySelectorAll('button[aria-pressed="true"]')].map(
      (b) => b.textContent ?? '',
    );
    expect(marked.some((t) => t.includes('Light in the Dark'))).toBe(true);
    expect(marked.some((t) => t.includes('Bonded'))).toBe(true);
  });
});

/**
 * A full Stress track means two different things on the two sheets.
 *
 * On the player's own it means Vulnerable. On the companion's it means the
 * animal has gone: *"they drop out of the scene (by hiding, fleeing, or a
 * similar action). They remain unavailable until the start of your next long
 * rest."* Leaving a player to tell those apart by looking at a row of filled
 * pips is the app knowing something and not saying it.
 */
describe('a companion out of the scene', () => {
  const withStress = (marked: number, max = 3): void => {
    mountPanel({ ...newCompanion('Sable', 'A grey wolf'), stress: { marked, max } });
  };

  it('says so, and says when they are back', () => {
    withStress(3);
    expect(text()).toContain('OUT OF THE SCENE');
    expect(text()).toContain('BACK AT YOUR NEXT LONG REST, WITH 1 STRESS CLEARED');
  });

  it('says nothing while they still have a slot open', () => {
    withStress(2);
    expect(text()).not.toContain('OUT OF THE SCENE');
  });

  it('goes away again the moment a Stress is cleared', () => {
    withStress(3);
    expect(text()).toContain('OUT OF THE SCENE');
    // Through the track, which is the control a player uses.
    act(() => {
      useApp.getState().update((c) => ({
        ...c,
        companion: c.companion === null ? null : { ...c.companion, stress: { marked: 2, max: 3 } },
      }));
    });
    expect(text()).not.toContain('OUT OF THE SCENE');
  });
});

/**
 * Step 4's other half, which the sheet had no field for.
 *
 * *"Choose whether they deal physical or magic damage."* The app answered
 * physical for every companion there has ever been, under a comment in
 * `attack.ts` calling it the SRD's default - true of an unarmed attack and
 * never true of this sheet, where the book asks outright.
 */
describe('a companion’s damage type', () => {
  const byLabel = (label: string): HTMLElement => {
    const el = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    if (el === null) throw new Error(`nothing is labelled "${label}"`);
    return el;
  };

  it('starts physical, and the panel says which it is', () => {
    mountPanel();
    expect(text()).toContain('PHYSICAL');
    expect(useApp.getState().characters[0]?.companion?.damageType).toBe('phy');
  });

  it('is a choice, and the panel follows it', () => {
    mountPanel();
    openSheet();
    click(byLabel('Magic damage'));
    expect(useApp.getState().characters[0]?.companion?.damageType).toBe('mag');
    expect(byLabel('Magic damage').getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('MAGIC');
    expect(text()).not.toContain('· PHYSICAL ·');
  });

  it('goes back, because a choice you cannot undo is a trap', () => {
    mountPanel({ ...newCompanion('Sable', ''), damageType: 'mag' });
    openSheet();
    click(byLabel('Physical damage'));
    expect(useApp.getState().characters[0]?.companion?.damageType).toBe('phy');
  });
});

/**
 * Commanding the companion, on the screen a Ranger plays from.
 *
 * `BACKLOG.md` P1-1 shipped without this and said why: arming a companion
 * "needs a second armed slot on Play and a decision about whose Proficiency and
 * whose roll it is". Folio 19 makes both decisions, and it was prose no build
 * could reach until `parseRules` was pointed at it.
 *
 * The control is on the companion's own panel and not in `Equipped`, because a
 * player who switched to COMPANION is operating the animal and should not be
 * sent to another section to make it bite.
 */
describe('declaring the companion’s attack from Play', () => {
  const beastbound = (): Character => {
    const subclass = dataset.subclasses.find((s) =>
      [...s.foundationFeatures, ...s.specializationFeatures, ...s.masteryFeatures].some(
        (f) => f.name === 'Companion',
      ),
    );
    if (subclass === undefined) throw new Error('no subclass in the dataset grants a Companion');
    return {
      ...playedCharacter(),
      classRef: subclass.classRef,
      subclassRefs: [subclass.id],
      companion: {
        ...newCompanion('Ash', 'A one-eyed raven'),
        damage: 'd6+2',
        experiences: [{ id: 'ce-1', name: 'Sharp eyes', bonus: 2 }],
      },
    };
  };

  const showCompanion = (over: Partial<Character> = {}): Character => {
    const character = { ...beastbound(), ...over };
    seed(character);
    act(() => {
      root.render(<PlayScreen />);
    });
    const toggle = buttons().find((b) => (b.textContent ?? '').trim() === 'ASH');
    if (toggle === undefined) throw new Error('no COMPANION segment on the vitals panel');
    click(toggle);
    return character;
  };

  const attackBox = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('to attack'));

  it('offers the attack as a control, with Proficiency already in it', () => {
    const c = showCompanion();
    const stats = deriveStats(c, dataset, index);
    const row = attackBox();
    expect(row, 'the companion panel offers no way to declare their attack').toBeDefined();
    expect(row?.textContent ?? '').toContain(`${String(stats.proficiency)}d6+2`);
  });

  it('arms a Spellcast Roll, because that is the roll the rule names', () => {
    showCompanion();
    click(attackBox()!);
    expect(attackBox()?.getAttribute('aria-pressed')).toBe('true');
    expect(text()).toContain('ARMED');
    // The trait slot the roll will use. "Make a Spellcast Roll to connect with
    // your companion and command them to take action."
    expect(text()).toContain('SPELLCAST');
  });

  it('offers no attack while they are out of the scene', () => {
    showCompanion({
      companion: {
        ...newCompanion('Ash', ''),
        damage: 'd6+2',
        stress: { marked: 3, max: 3 },
      },
    });
    expect(attackBox()).toBeUndefined();
    expect(text()).toContain('OUT OF THE SCENE');
  });

  it('offers no attack when the die will not parse', () => {
    showCompanion({
      companion: { ...newCompanion('Ash', ''), damage: 'a peck' },
    });
    expect(attackBox()).toBeUndefined();
    expect(text()).toContain('NO DIE');
  });
});

/**
 * *"Spend a Hope to add an applicable **Companion** Experience to the roll."*
 *
 * The chips are the half of folio 19 that is easy to leave out, because the
 * roll works without them. It would just be the wrong roll: "Ran with the
 * wolves" is not a thing the raven did.
 */
describe('whose Experience chips the roll offers', () => {
  const beastbound = (): Character => {
    const subclass = dataset.subclasses.find((s) =>
      [...s.foundationFeatures, ...s.specializationFeatures, ...s.masteryFeatures].some(
        (f) => f.name === 'Companion',
      ),
    )!;
    return {
      ...playedCharacter(),
      classRef: subclass.classRef,
      subclassRefs: [subclass.id],
      experiences: [{ id: 'mine', name: 'Ran with the wolves', bonus: 2 }],
      companion: {
        ...newCompanion('Ash', 'A one-eyed raven'),
        damage: 'd6+2',
        experiences: [{ id: 'theirs', name: 'Sharp eyes', bonus: 2 }],
      },
    };
  };

  const openExperiences = (): void => {
    const fold = buttons().find(
      (b) =>
        b.getAttribute('aria-expanded') === 'false' &&
        (b.textContent ?? '').startsWith('Experiences'),
    );
    if (fold !== undefined) click(fold);
  };

  /**
   * The chip row only, and not the whole screen.
   *
   * The companion panel prints their Experiences as a summary line of its own,
   * so `text()` carries "SHARP EYES" whenever the panel is showing the
   * companion - which is always, here, because that is where the attack is
   * armed from. A screen-wide assertion passes for the wrong reason and then
   * fails for the wrong reason, which is how the third of these was written the
   * first time.
   */
  const chips = (): string => {
    const fold = buttons().find((b) => (b.textContent ?? '').startsWith('Experiences'));
    return fold?.parentElement?.textContent ?? '';
  };

  const armCompanion = (): void => {
    const toggle = buttons().find((b) => (b.textContent ?? '').trim() === 'ASH')!;
    click(toggle);
    click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('to attack'))!);
  };

  it('offers the character’s while nothing of theirs is armed', () => {
    usePhoneViewport();
    seed(beastbound());
    act(() => root.render(<PlayScreen />));
    openExperiences();
    expect(chips()).toContain('RAN WITH THE WOLVES');
    expect(chips()).not.toContain('SHARP EYES');
  });

  it('offers theirs the moment the companion is commanded', () => {
    usePhoneViewport();
    seed(beastbound());
    act(() => root.render(<PlayScreen />));
    armCompanion();
    openExperiences();
    expect(chips()).toContain('SHARP EYES');
    expect(chips()).not.toContain('RAN WITH THE WOLVES');
  });

  it('hands them back when the command is withdrawn', () => {
    usePhoneViewport();
    seed(beastbound());
    act(() => root.render(<PlayScreen />));
    armCompanion();
    // Disarm from the same control.
    click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').includes('to attack'))!);
    openExperiences();
    expect(chips()).toContain('RAN WITH THE WOLVES');
    expect(chips()).not.toContain('SHARP EYES');
  });
});
