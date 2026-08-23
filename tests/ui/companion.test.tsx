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
import { useApp } from '../../src/store/state.ts';
import { CompanionPanel } from '../../src/ui/player/Companion.tsx';
import { companionUpgrades } from '../../src/ui/shared/srdReference.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: /min-width/.test(query),
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

function seed(character: Character): void {
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
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const text = (): string => container.textContent ?? '';

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
