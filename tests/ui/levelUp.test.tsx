// @vitest-environment jsdom
/**
 * What the level-up screen says about slots a player has already spent.
 *
 * The engine half of this is covered in `tests/engine/levelUp.test.ts`, and it
 * is not enough. `LevelUp.tsx` recomputes the count for the row the player has
 * *just selected* — `spentThisPlan` — and that number is not `slotUsage`'s.
 * Measured: with only the engine patched, `tests/engine/levelUp.test.ts` and
 * `tests/engine/matrix.test.ts` both pass in full while the selected
 * Proficiency row still reads "TIER 3 · 1 OF 2 LEFT" and stays pressable. The
 * validator would then refuse a plan the screen had just invited.
 *
 * It has to be jsdom. `renderToStaticMarkup`, which `wizard.test.ts` uses and
 * which is far cheaper, cannot work here: zustand v5 wires `getServerSnapshot`
 * to `getInitialState` (`node_modules/zustand/esm/react.mjs`), so a server
 * render never sees `setState` — `useActive()` returns null and `LevelUp`
 * renders nothing at all.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { deriveStats } from '@engine/character.ts';
import { useApp } from '../../src/store/state.ts';
import { LevelUp } from '../../src/ui/build/LevelUp.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

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

/** A level-up entry as `applyLevelUp` writes one. */
const proficiencyTaking = (level: number, tier: number): Character['levelUpHistory'][number] => ({
  level,
  slot: 0,
  kind: 'proficiency',
  detail: { optionId: 'proficiency', optionTier: tier },
});

function mount(character: Character): void {
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
  });
  act(() => {
    root.render(
      createElement(LevelUp, {
        stats: deriveStats(character, dataset, index),
        onDone: () => {},
      }),
    );
  });
}

const text = (): string => container.textContent ?? '';

/** Every row's accessible slot count, as a screen reader would read it. */
const slotNames = (): string[] =>
  [...container.querySelectorAll('[aria-label$="marked"]')].map(
    (e) => e.getAttribute('aria-label') ?? '',
  );

describe('the level-up screen and its slot counts', () => {
  it('shows a black-boxed option as full after one taking', () => {
    // The rule: "you must spend two advancements and mark BOTH level-up slots
    // in order to take it." One taking fills the tier, so the row must not
    // invite a second.
    const c = playedCharacter();
    mount({ ...c, level: 6, levelUpHistory: [proficiencyTaking(5, 3)] });

    expect(
      text(),
      'the screen offered a second Proficiency in a tier the validator will refuse',
    ).not.toMatch(/TIER 3 · 1 OF 2 LEFT/);
    expect(text()).toMatch(/TIER 3 · 0 OF 2 LEFT/);
    expect(slotNames()).toContain('2 of 2 marked');
  });

  /**
   * The half no engine test can see.
   *
   * `LevelUp.tsx` adds what this plan has spent to what the history spent, and
   * it counted its own picks as one box each. So the moment a player pressed
   * Proficiency the row said "1 OF 2 LEFT" and stayed pressable — inviting a
   * second pick the validator would then refuse. With only the engine patched,
   * both engine suites pass in full and this is still true.
   */
  it('shows the tier as full the moment the black-boxed option is pressed', () => {
    const c = playedCharacter();
    mount({ ...c, level: 5, levelUpHistory: [] });

    const row = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Increase your Proficiency'),
    );
    expect(row, 'no Proficiency row on the level-up screen').toBeDefined();
    act(() => {
      row!.click();
    });

    expect(
      text(),
      'pressing it left a slot on offer that the validator will refuse',
    ).not.toMatch(/TIER 3 · 1 OF 2 LEFT/);
    expect(text()).toMatch(/TIER 3 · 0 OF 2 LEFT/);
  });

  /**
   * A sheet levelled by the build that allowed two takings carries them, and
   * `slotUsage` reports `used: 4` of two boxes — deliberately, because that is
   * what the history says. What must not happen is the app reading that number
   * out as if it described the boxes.
   */
  it('never tells a screen reader that four of two boxes are marked', () => {
    const c = playedCharacter();
    mount({
      ...c,
      level: 7,
      levelUpHistory: [proficiencyTaking(5, 3), proficiencyTaking(6, 3)],
    });

    for (const name of slotNames()) {
      const [marked, of] = name.match(/(\d+) of (\d+)/)!.slice(1).map(Number);
      expect(marked, `"${name}" says more boxes are marked than the tier prints`).toBeLessThanOrEqual(of!);
    }
  });

  /**
   * The control. A screen that showed every option as full would satisfy both
   * assertions above.
   */
  it('still offers an option whose boxes are separate and only half spent', () => {
    const c = playedCharacter();
    mount({
      ...c,
      level: 4,
      levelUpHistory: [{ level: 3, slot: 0, kind: 'hitPoint', detail: { optionId: 'hit-point', optionTier: 2 } }],
    });
    expect(slotNames()).toContain('1 of 2 slots marked');
  });
});
