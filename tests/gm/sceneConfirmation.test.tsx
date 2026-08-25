// @vitest-environment jsdom
/**
 * END SCENE asks twice, and it asks twice whatever is in the scene.
 *
 * The control used to exist only while `combatants.length > 0`, so the empty
 * table had no END SCENE at all and the arming step was, in effect, conditional
 * on occupancy. The narrower change - keep the button, arm only when there is
 * something to lose - was proposed and turned down: a control whose number of
 * taps depends on state the GM is not looking at trains one habit at a full
 * table and punishes it at an empty one. Confirming always costs a tap at an
 * empty table. That price is the decision, not an oversight, so it is pinned
 * here: the mutation these tests exist to kill is putting `combatants.length >
 * 0 &&` back in front of the button.
 *
 * The height assertion reads an inline style on purpose. jsdom resolves no
 * stylesheet, so a `min-height` that arrives from `.t-meta` or from a stretch
 * measures 0 here; 44 is written on the element, and 44 clears both this
 * project's floors - 44px coarse and 34px fine - at once.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SceneCombatant } from '../../src/engine/encounter.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

const burrower = (): SceneCombatant => ({
  id: 'acid-burrower-0',
  adversaryRef: dataset.adversaries[0]!.id,
  name: dataset.adversaries[0]!.name,
  hp: { marked: 3, max: 8 },
  stress: { marked: 1, max: 3 },
  thresholds: [8, 15],
  difficulty: 14,
  spotlighted: false,
  notes: '',
});

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

const scene = (combatants: SceneCombatant[]): void => {
  useGm.setState({ combatants });
  act(() => root.render(createElement(Scene, { phone: true })));
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const named = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim() === label);
  if (found === undefined) {
    throw new Error(
      `no control called "${label}". Here: ${buttons()
        .map((b) => (b.textContent ?? '').trim())
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

describe('ending a scene', () => {
  it('offers END SCENE, and arms it, with nothing in the scene at all', () => {
    // The whole decision, in one test: the empty table pays the tap too.
    scene([]);
    expect(named('END SCENE')).toBeDefined();
    click(named('END SCENE'));
    expect(named('TAP AGAIN TO END')).toBeDefined();
  });

  it('gives the empty-scene confirmation a 44px inline floor', () => {
    scene([]);
    expect(named('END SCENE').style.minHeight).toBe('44px');
    click(named('END SCENE'));
    // Arming swaps the label and the colour, not the box the thumb aims at.
    expect(named('TAP AGAIN TO END').style.minHeight).toBe('44px');
  });

  it('arms with adversaries in the scene as well [control]', () => {
    // Passes before and after; it is here so a fix that generalised the button
    // by deleting the occupied path cannot pass the other tests in this file.
    scene([burrower()]);
    click(named('END SCENE'));
    expect(named('TAP AGAIN TO END')).toBeDefined();
    expect(useGm.getState().combatants).toHaveLength(1);
  });

  /*
   * The cost line does not move the grid, and cannot be made to.
   *
   * It was `{armed && ...}` once. `armed` is cleared by a 4-second timer, not
   * by a tap, so the line vanished under a hand that had not moved and every
   * card, track, chip and remove control below it came up by its height plus
   * the stack's 10px gap - 25.87px at one line of `.t-dense` and 41.74 at two,
   * which is as far as the shipped wording reaches (`Scene.tsx` costs the
   * characters). That is just *under* the 44px floor the button in the row
   * immediately above declares for a single target, not over it. What makes it
   * a defect is not the size: it is that the grid moved at all, on a timer,
   * for no gesture.
   *
   * The fix is that the line never leaves and its string never depends on
   * `armed`. The three tests below are the three mutations that would bring
   * the jump back: gating the element, changing the words with the state, or
   * changing anything with a size along with the colour. jsdom resolves no
   * stylesheet and lays nothing out, so none of this is measurable here; what
   * is asserted instead is the invariant the measurement rests on - same node,
   * same string, same box.
   */
  const costLine = (): HTMLParagraphElement => {
    const found = container.querySelectorAll('p.t-dense');
    if (found.length !== 1) throw new Error(`expected one cost line, found ${found.length}`);
    return found[0] as HTMLParagraphElement;
  };

  it('states the cost with the control still at rest', () => {
    scene([burrower()]);
    expect(costLine().textContent).toContain('Clears 1 adversary');
  });

  it('is the same node with the same words once armed', () => {
    scene([burrower()]);
    const before = costLine();
    const words = before.textContent;
    click(named('END SCENE'));
    // Same node: React did not unmount and remount it, so nothing reflowed.
    expect(costLine()).toBe(before);
    // Same string: the wrap cannot have moved, whatever the column turns out
    // to be in a browser.
    expect(costLine().textContent).toBe(words);
  });

  it('changes colour and nothing else that has a size', () => {
    scene([burrower()]);
    const resting = costLine().style.color;
    click(named('END SCENE'));
    expect(costLine().style.color).not.toBe(resting);
    // Weight is the one that would widen every glyph and take the wrap with
    // it. Nothing may write it here, in either state.
    expect(costLine().style.fontWeight).toBe('');
    expect(costLine().style.fontSize).toBe('');
    expect(costLine().style.lineHeight).toBe('');
  });

  it('arms to the same control whatever is in the scene, and only the sentence differs', () => {
    // The line naming what the second tap costs reads the scene: "Clears 1
    // adversary ..." against "Nothing to clear." That is a difference in what
    // is *said*, and this file exists to hold that the *gesture* has none.
    // Both are asserted here together so a future pass cannot make the
    // sentence conditional by making the button conditional.
    scene([]);
    click(named('END SCENE'));
    const empty = named('TAP AGAIN TO END');
    expect(empty.style.minHeight).toBe('44px');
    expect(container.textContent).toContain('Nothing to clear.');

    // The second tap on the empty table does nothing and disarms, which is the
    // price the unconditional decision accepts; it is also how this test gets
    // back to a resting control without remounting.
    click(empty);
    // Through the store rather than `scene`, because the tree is already
    // mounted here and a `setState` outside `act` re-renders it outside `act`.
    act(() => {
      useGm.setState({ combatants: [burrower()] });
    });
    click(named('END SCENE'));
    const occupied = named('TAP AGAIN TO END');
    expect(occupied.style.minHeight).toBe('44px');
    expect(occupied.textContent).toBe(empty.textContent);
    expect(container.textContent).toContain('Clears 1 adversary');
  });

  it('clears the scene only on the second tap', () => {
    // Also a control: the two-tap sequence itself never changed.
    scene([burrower()]);
    click(named('END SCENE'));
    expect(useGm.getState().combatants).toHaveLength(1);
    click(named('TAP AGAIN TO END'));
    expect(useGm.getState().combatants).toHaveLength(0);
    // And it goes back to asking, rather than staying armed over an empty table.
    expect(named('END SCENE')).toBeDefined();
  });
});
