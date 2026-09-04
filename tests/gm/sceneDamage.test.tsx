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
 * already written down: one line carrying two behaviours. `applyHit` writes
 * the HP track *and* takes bodies off the stepper - on a Minion group the
 * track stays where it was and the bodies move - and a test that read only
 * one of the two would pass on a card that had forgotten the other entirely.
 *
 * These read `data/srd-2.0.json` rather than a fixture, for `sceneTruth.test
 * .tsx`'s reason: every claim here is a claim about the book this app ships. A
 * fixture written in this file could be given a threshold pair and a Minion
 * divisor to order and would go on passing after a rebuild moved either.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Adversary, Dataset } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { makeCombatant, type SceneCombatant } from '../../src/engine/encounter.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { openCombatants, useGm } from '../../src/ui/gm/gmStore.ts';
import { sceneWith } from '../fixtures/factories.ts';

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
  useGm.setState({ hydrated: true, session: [], openScene: null, environmentRef: null, region: 'scene' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The one scene row the damage is done in, and the pointer that draws it. */
const OPEN = 'the-open-scene';

/*
 * A row and a pointer, in one write. `Scene` draws its cards only for the row
 * `openScene` names, so the fight and the pointer are the same seed - and every
 * write the card makes below goes back to that row, through
 * `patchCombatant(sceneId, ...)`, which is why `hpOf` reads it there.
 */
const scene = (combatants: SceneCombatant[]): void => {
  act(() => {
    useGm.setState({ session: [sceneWith(OPEN, combatants)], openScene: OPEN });
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
  const c = openCombatants(useGm.getState()).find((x) => x.id === id)!;
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
  it('takes the overkill off a Minion group’s stepper and leaves its HP track alone', () => {
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
    // 0, where this pinned `a.hp` (the whole track). The track is the one box
    // each body has and the hit is a group's: p94's "defeated when they take
    // any damage" is the body leaving the count, not a wound on the ones
    // still standing. Filling the box here is what made the card read
    // DEFEATED with two Minions left.
    expect(hpOf(c.id).marked).toBe(0);
    // Exactly two: `1 + floor(N / N)`. One would be the `+ 1` gone, three an
    // off-by-one the other way.
    expect(openCombatants(useGm.getState())[0]!.minionsRemaining).toBe(2);
  });

  /*
   * The DEFEATED state of a Minion card, which is the count and not the box.
   *
   * Both halves of the same defect: a hit that left bodies standing put the
   * card in the defeated state (meta line, 0.72 opacity, red stripe) because
   * the engine filled its one HP box; and the count stepped down to 0 by hand
   * never did, because the box was empty. `card()` reads the article the way
   * the GM does - the meta line and the two styles `down` sets.
   */
  const card = (): { meta: string; opacity: string; stripe: string } => {
    const article = container.querySelector<HTMLElement>('article.panel')!;
    const meta = article.querySelector<HTMLElement>('.t-meta')!;
    return { meta: meta.textContent ?? '', opacity: article.style.opacity, stripe: article.style.borderLeft };
  };

  it('keeps a Minion card standing after a hit that leaves bodies standing', () => {
    const a = minion();
    const c = makeCombatant(a, 0, 4);
    scene([c]);
    expect(card().meta).not.toContain('DEFEATED');

    type(a.name, '1');
    press('APPLY');
    expect(openCombatants(useGm.getState())[0]!.minionsRemaining).toBe(3);
    expect(hpOf(c.id).marked).toBe(0);
    expect(card().meta).toContain('MINION');
    expect(card().meta).not.toContain('DEFEATED');
    expect(card().opacity).toBe('1');
    expect(card().stripe).not.toContain('var(--damage)');
  });

  it('reads a Minion card as DEFEATED when the count reaches 0, by hand or by damage', () => {
    const a = minion();
    scene([{ ...makeCombatant(a, 0, 4), minionsRemaining: 1 }]);
    expect(card().meta).not.toContain('DEFEATED');

    // By aria-label, not by glyph: the HP counter above the band draws the same −.
    act(() => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Decrease Minions standing"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(openCombatants(useGm.getState())[0]!.minionsRemaining).toBe(0);
    expect(card().meta).toContain('DEFEATED');
    expect(card().opacity).toBe('0.72');
    expect(card().stripe).toContain('var(--damage)');

    // And by damage: a hit big enough for the whole group.
    scene([{ ...makeCombatant(a, 1, 4), minionsRemaining: 2 }]);
    expect(card().meta).not.toContain('DEFEATED');
    type(a.name, String(a.minionGroup! * 10));
    press('APPLY');
    expect(card().meta).toContain('DEFEATED');
  });

  it('still reads an ordinary card as DEFEATED off its HP track', () => {
    const a = withThresholds();
    scene([{ ...makeCombatant(a, 0, 4), hp: { marked: a.hp, max: a.hp } }]);
    expect(card().meta).toContain('DEFEATED');
    expect(card().opacity).toBe('0.72');
  });

  it('never takes more Minions off the stepper than are standing', () => {
    const a = minion();
    const c = { ...makeCombatant(a, 0, 4), minionsRemaining: 2 };
    scene([c]);
    type(a.name, String(a.minionGroup! * 10));
    press('APPLY');
    expect(openCombatants(useGm.getState())[0]!.minionsRemaining).toBe(0);
  });

  /*
   * A combatant whose adversary this dataset cannot resolve. The card already
   * says NOT IN THIS BOOK; what it must not do is invent a divisor, and what
   * it must still do is apply the HP, because the thresholds are on the
   * combatant's own copy and are the GM's own number.
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
