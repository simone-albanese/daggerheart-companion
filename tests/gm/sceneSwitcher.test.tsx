// @vitest-environment jsdom
/**
 * The strip of scenes in the runner's title row.
 *
 * Two things are asserted here that a browser cannot: which rows are on the
 * strip and what each one announces itself as. The two that a browser CAN
 * measure - the per-character cost of a chip and the scroller's height - are a
 * Chrome gate on this lane and are recorded in the PR, not here: a width
 * asserted in jsdom is a width nobody measured.
 *
 * What IS asserted here about geometry is the one number that must not bend -
 * `minHeight: 44` on every chip, declared inline - because that is a
 * declaration rather than a layout, and jsdom can read a declaration.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';
import type { SessionItem } from '@shared/campaigns.ts';
import { indexDataset } from '@engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { SceneSwitcher } from '../../src/ui/gm/SceneSwitcher.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';
import { NO_FIGHT } from '../fixtures/factories.ts';

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

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
  useGm.setState({ hydrated: true, session: [], combatants: [], liveScene: null, environmentRef: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const fighter = (id: string) => ({
  id,
  adversaryRef: 'acid-burrower',
  name: 'Acid Burrower',
  hp: { max: 8, marked: 0 },
  stress: { max: 3, marked: 0 },
  thresholds: [8, 15] as [number, number],
  difficulty: 14,
  spotlighted: false,
  notes: '',
});

const scene = (id: string, name: string, order: number, fighters = 0): SessionItem => ({
  id,
  kind: 'scene',
  name,
  order,
  collapsed: true,
  environmentRef: null,
  ...NO_FIGHT,
  combatants: Array.from({ length: fighters }, (_, i) => fighter(`acid-burrower-${String(i)}`)),
});

const show = (session: SessionItem[], liveScene: string | null): void => {
  act(() => {
    useGm.setState({ session, liveScene });
    root.render(createElement(SceneSwitcher));
  });
};

const chips = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('button, [aria-current]'),
];

describe('what the strip draws', () => {
  it('draws nothing at all when there is no scene to flip to', () => {
    // The title row keeps the word it has always had, and the strip costs
    // nothing rather than drawing an empty box.
    show([scene('a', 'The dungeon', 0)], null);
    expect(container.textContent).toBe('');
  });

  it('puts a row on it because it holds a fight, or because it is the live one', () => {
    show(
      [scene('a', 'The dungeon', 0, 2), scene('b', 'The forest', 1), scene('c', 'The gate', 2)],
      'b',
    );
    expect(chips().map((c) => c.textContent)).toEqual(['THE DUNGEON', 'THE FOREST']);
  });

  it('keeps list order, never the order they were last played', () => {
    /*
     * A strip that re-sorts under a thumb is the one thing muscle memory
     * cannot use, so the order is the plan's and nothing reorders it. The
     * plan cannot even be dragged while this is on the glass: `Gm.tsx` marks
     * the session list `inert` whenever a tool is open.
     */
    show([scene('a', 'Alpha', 0, 1), scene('b', 'Bravo', 1, 1), scene('c', 'Charlie', 2, 1)], 'c');
    expect(chips().map((c) => c.textContent)).toEqual(['ALPHA', 'BRAVO', 'CHARLIE']);
  });

  it('draws the live chip as a label and not as a button that does nothing', () => {
    /*
     * "A button that can be pressed and does nothing is the worse of the two
     * lies." Inside the runner the current scene has no action, so it is not a
     * button - and not a DISABLED button either, because some screen readers do
     * not announce `aria-current` on a disabled control, and none of them
     * decline to announce text.
     */
    show([scene('a', 'The dungeon', 0, 1), scene('b', 'The forest', 1)], 'b');
    const current = container.querySelector('[aria-current="true"]')!;
    expect(current.tagName).toBe('SPAN');
    expect(current.textContent).toBe('THE FOREST');
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('has no disabled control anywhere on it', () => {
    show([scene('a', 'The dungeon', 0, 1), scene('b', 'The forest', 1)], 'b');
    expect([...container.querySelectorAll('button')].some((b) => b.disabled)).toBe(false);
  });

  it('announces a parked chip with the whole name, as text rather than as a title', () => {
    // A `title` is a mouse affordance on a device with no mouse.
    show([scene('a', 'The dungeon below the mill', 0, 1), scene('b', 'The forest', 1)], 'b');
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Run The dungeon below the mill');
    expect(button.getAttribute('title')).toBe(null);
  });

  it('calls a row with no name what the rest of the app calls it', () => {
    show([scene('a', '', 0, 1), scene('b', 'The forest', 1)], 'b');
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('SCENE');
    expect(button.getAttribute('aria-label')).toBe('Run Scene');
  });

  it('flips in one tap, with no confirmation and no arming', () => {
    // The flip destroys nothing - that is the whole reason the storage exists -
    // and a confirmation would double the cost of the one gesture this file is
    // for.
    show([scene('a', 'The dungeon', 0, 2), scene('b', 'The forest', 1)], 'b');
    act(() => {
      container.querySelector('button')!.click();
    });
    expect(useGm.getState().liveScene).toBe('a');
    expect(useGm.getState().combatants).toHaveLength(2);
  });

  it('declares a 44px floor on every chip, at every width', () => {
    /*
     * The one number that must not bend, and it is asserted as a DECLARATION
     * rather than as a measurement - jsdom lays nothing out, so a width read
     * here would be a number nobody measured. The per-character cost and the
     * cap it feeds are a Chrome gate on this lane.
     */
    show(
      Array.from({ length: 4 }, (_, i) => scene(`s${String(i)}`, `Scene ${String(i)}`, i, 1)),
      's0',
    );
    expect(chips()).toHaveLength(4);
    for (const chip of chips()) {
      expect(chip.style.minHeight).toBe('44px');
    }
  });

  it('scrolls sideways rather than wrapping onto a second line', () => {
    // Wrapping would cost the scroller 44px and reflow the fight under a thumb
    // at the worst possible moment. The degradation is a swipe, and it is
    // declared rather than hidden.
    show(
      Array.from({ length: 6 }, (_, i) => scene(`s${String(i)}`, `Scene ${String(i)}`, i, 1)),
      's0',
    );
    const strip = container.firstElementChild as HTMLElement;
    expect(strip.style.overflowX).toBe('auto');
    expect(strip.style.flexWrap).toBe('');
  });

  it('never puts a legacy encounter row on the strip', () => {
    // That arm has no `environmentRef`, so resuming one would open the fight in
    // the previous scene's place.
    act(() => {
      useGm.setState({
        session: [
          {
            id: 'legacy',
            kind: 'encounter',
            name: 'The ambush',
            order: 0,
            collapsed: true,
            roster: [],
            adjustments: { easier: false, harder: false, damageBump: false },
            combatants: [fighter('acid-burrower-0')],
          },
          scene('b', 'The forest', 1, 1),
        ],
        liveScene: 'b',
      });
      root.render(createElement(SceneSwitcher));
    });
    expect(chips().map((c) => c.textContent)).toEqual(['THE FOREST']);
  });
});
