// @vitest-environment jsdom
/**
 * The number a player says out loud, and the two things it does to a card.
 *
 * `engine/damage.ts` is covered on its own in `tests/engine/damage.test.ts`, so
 * nothing here re-derives a severity. What a pure test cannot say is whether
 * the card is *wired*: whether APPLY writes `hit.marked` and not `hit.hp`,
 * whether the Minion half of the same hit reaches the stepper beside it, and
 * whether the optional rule arrives from the table's preference or from a
 * `false` somebody typed into the call. Every one of those is a whole feature
 * that ships switched off while the engine's unit tests stay green.
 *
 * The Minion case is the one that matters most and it is the trap this repo has
 * already written down: one line carrying two behaviours. `applyHit` marks HP
 * *and* takes bodies off the stepper, and a test that read only the HP would
 * pass on a card that had forgotten the second half entirely.
 *
 * These read `data/srd-1.0.json` rather than a fixture, for `sceneTruth.test
 * .tsx`'s reason: every claim here is a claim about the book this app ships. A
 * fixture written in this file could be given a threshold pair and a Minion
 * divisor to order and would go on passing after a rebuild moved either.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Adversary, Dataset } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { makeCombatant, type SceneCombatant } from '../../src/engine/encounter.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

/**
 * An adversary with real thresholds, found by the property and not by id.
 *
 * The HP floor is what makes a Major hit legible: on a two-point track a Major
 * and a Severe both fill it, and the assertion would pass on either.
 */
const withThresholds = (): Adversary =>
  dataset.adversaries.find((a) => a.thresholds !== null && a.hp >= 4)!;

/** A shipped Minion: no thresholds, and a divisor the parser read off its text. */
const minion = (): Adversary =>
  dataset.adversaries.find((a) => a.thresholds === null && a.minionGroup !== undefined)!;

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

const scene = (combatants: SceneCombatant[]): void => {
  act(() => {
    useGm.setState({ combatants });
    root.render(createElement(Scene, { phone: true }));
  });
};

const field = (name: string): HTMLInputElement => {
  const el = container.querySelector<HTMLInputElement>(`input[aria-label="Damage to ${name}"]`);
  if (el === null) throw new Error(`no damage field for ${name}`);
  return el;
};

const type = (name: string, value: string): void => {
  const el = field(name);
  act(() => {
    // The setter React's synthetic `onChange` listens to; assigning `.value`
    // directly leaves the tracker thinking nothing changed.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const press = (label: string): void => {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (button === undefined) throw new Error(`no ${label} button`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** The HP counter's own readout, which is what a GM actually reads. */
const hpOf = (id: string): { marked: number; max: number } => {
  const c = useGm.getState().combatants.find((x) => x.id === id)!;
  return { marked: c.hp.marked, max: c.hp.max };
};

describe('the damage field on the combatant card', () => {
  it('turns a Major amount into the HP the ladder says, and not before APPLY', () => {
    const a = withThresholds();
    const c = makeCombatant(a, 0, 4);
    scene([c]);

    type(a.name, String(a.thresholds![0]));
    // The preview is on the screen and the track has not moved: proposta, mai
    // automatismo, the same rule the countdowns board states for itself.
    expect(container.textContent).toContain('MAJOR · 2 HP');
    expect(hpOf(c.id).marked).toBe(0);

    press('APPLY');
    expect(hpOf(c.id).marked).toBe(2);
    // `hit.marked` and not `hit.hp`: one point below the boundary is a Minor,
    // and a card writing `hp` would land on 1 from either amount.
    expect(field(a.name).value).toBe('');
  });

  it('reads one point under the boundary as the rung below', () => {
    const a = withThresholds();
    const c = makeCombatant(a, 0, 4);
    scene([c]);
    type(a.name, String(a.thresholds![0] - 1));
    press('APPLY');
    expect(hpOf(c.id).marked).toBe(1);
  });

  it('adds to a track that is already marked rather than replacing it', () => {
    const a = withThresholds();
    const c = { ...makeCombatant(a, 0, 4), hp: { marked: 1, max: a.hp } };
    scene([c]);
    type(a.name, String(a.thresholds![1]));
    press('APPLY');
    expect(hpOf(c.id).marked).toBe(Math.min(a.hp, 4));
  });

  /*
   * The no-thresholds branch, and the second behaviour on the same line.
   *
   * One hit does two things to a Minion group: it defeats the body the card is
   * standing for, and it defeats `floor(amount / N)` more beside it. Asserting
   * only the first would pass on a card that never wired the stepper, which is
   * exactly the "one line, two behaviours" trap.
   */
  it('marks the whole track of a Minion and takes the overkill off the stepper', () => {
    const a = minion();
    const c = makeCombatant(a, 0, 4);
    expect(c.thresholds).toBeNull();
    expect(c.minionsRemaining).toBe(4);
    scene([c]);

    // Counted rather than contained, and the count is now 0 -> 1 where it was
    // 1 -> 2. The band above the field used to print NO THRESHOLDS · ANY DAMAGE
    // DEFEATS on this card, which is why `toContain` would have passed on a
    // card that drew no preview at all; it stopped printing it when the Minion
    // count moved into that slot (`Scene.tsx`, the band's comment, under
    // `## What gave way for it`). The device is unchanged and the guard is if
    // anything sharper - a card with no preview reads 0 both times.
    const says = (needle: string): number => (container.textContent ?? '').split(needle).length - 1;
    expect(says('ANY DAMAGE DEFEATS')).toBe(0);
    type(a.name, String(a.minionGroup));
    expect(says('ANY DAMAGE DEFEATS')).toBe(1);
    expect(container.textContent).toContain('2 MINIONS');

    press('APPLY');
    expect(hpOf(c.id).marked).toBe(a.hp);
    // Exactly two: `1 + floor(N / N)`. One would be the `+ 1` gone, three an
    // off-by-one the other way.
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(2);
  });

  it('never takes more Minions off the stepper than are standing', () => {
    const a = minion();
    const c = { ...makeCombatant(a, 0, 4), minionsRemaining: 2 };
    scene([c]);
    type(a.name, String(a.minionGroup! * 10));
    press('APPLY');
    expect(useGm.getState().combatants[0]!.minionsRemaining).toBe(0);
  });

  /*
   * A combatant whose adversary this dataset cannot resolve. The card already
   * says NOT IN THIS DATASET; what it must not do is invent a divisor, and what
   * it must still do is apply the HP, because the thresholds are on the board
   * copy and are the GM's own number.
   */
  it('still applies HP for a combatant the dataset has lost, and offers no Minion arithmetic', () => {
    const a = withThresholds();
    const c: SceneCombatant = { ...makeCombatant(a, 0, 4), adversaryRef: 'not-in-this-dataset' };
    scene([c]);

    type(c.name, String(a.thresholds![1]));
    expect(container.textContent).not.toContain('MINION');
    press('APPLY');
    expect(hpOf(c.id).marked).toBe(3);
  });

  /*
   * The owner's decision of 2026-08-25, asserted where it can actually go
   * wrong. `combatantHit`'s own tests cover both settings; this one covers the
   * wire, because the failure being avoided is a `false` written into the call
   * site, and a `false` there passes every engine test in the tree.
   */
  it('follows the table’s Massive Damage preference against an adversary', () => {
    const a = withThresholds();
    const c = makeCombatant(a, 0, 4);
    const twiceSevere = String(a.thresholds![1] * 2);

    scene([c]);
    type(a.name, twiceSevere);
    expect(container.textContent).toContain('SEVERE');
    expect(container.textContent).not.toContain('MASSIVE');

    act(() => {
      useApp.setState({ prefs: { ...DEFAULT_PREFS, massiveDamageRule: true } });
    });
    type(a.name, twiceSevere);
    expect(container.textContent).toContain('MASSIVE');
  });

  it('offers nothing to press until there is a number to apply', () => {
    const a = withThresholds();
    scene([makeCombatant(a, 0, 4)]);
    const apply = [...container.querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'APPLY',
    )!;
    expect(apply.hasAttribute('disabled')).toBe(true);

    type(a.name, '0');
    expect(apply.hasAttribute('disabled')).toBe(true);

    type(a.name, '1');
    expect(apply.hasAttribute('disabled')).toBe(false);
  });
});
