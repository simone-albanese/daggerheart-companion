// @vitest-environment jsdom
/**
 * Clocks that belong to a scene, on the three surfaces that read them.
 *
 * Decision 18's third part. What a scope buys is REACH: the runner draws the
 * running scene's clocks, so a GM with a split party stops scrolling the whole
 * campaign's list to find the one that is about the room they are in.
 *
 * What it must NOT buy is a filter anywhere else. The board still shows every
 * clock, grouped; the long rest still offers every long-term clock, labelled.
 * Narrowing either would take a clock off a list with no error message, which
 * is the regression that has no symptom.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-1.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';
import type { SessionItem } from '@shared/campaigns.ts';
import { countdownsOf } from '@shared/campaigns.ts';
import { indexDataset } from '@engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { Countdowns } from '../../src/ui/gm/Countdowns.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';
import { NO_CLOCK_PROSE, NO_FIGHT } from '../fixtures/factories.ts';

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
  useGm.setState({
    hydrated: true,
    session: [],
    countdowns: [],
    combatants: [],
    liveScene: null,
    environmentRef: null,
    region: 'scene',
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const scene = (id: string, name: string, order: number): SessionItem => ({
  id,
  kind: 'scene',
  name,
  order,
  collapsed: true,
  environmentRef: null,
  ...NO_FIGHT,
});

const clock = (
  id: string,
  name: string,
  order: number,
  sceneId: string | null,
  kind: 'standard' | 'long-term' = 'standard',
): SessionItem => ({
  id,
  kind: 'countdown',
  name,
  order,
  collapsed: true,
  primary: false,
  sceneId,
  countdown: { id, name, kind, start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE },
});

const show = (session: SessionItem[], liveScene: string | null, what: 'scene' | 'board'): void => {
  act(() => {
    useGm.setState({ session, countdowns: countdownsOf(session), liveScene });
    root.render(createElement(what === 'scene' ? Scene : Countdowns, { phone: true }));
  });
};

describe('the runner draws the running scene’s clocks, and only those', () => {
  it('puts a scoped clock on the glass while its scene is running', () => {
    show(
      [scene('s1', 'The dungeon', 0), clock('c1', 'The ritual', 1, 's1')],
      's1',
      'scene',
    );
    expect(text()).toContain('The ritual');
  });

  it('takes it off the glass when another scene is running', () => {
    // This is the whole feature: the tide is not in the dungeon.
    show(
      [
        scene('s1', 'The dungeon', 0),
        scene('s2', 'The forest', 1),
        clock('c1', 'The tide', 2, 's2'),
      ],
      's1',
      'scene',
    );
    expect(text()).not.toContain('The tide');
  });

  it('never draws the campaign’s own clocks in the runner', () => {
    // Those are the top bar's and the board's. A campaign clock in the runner
    // would put every clock in every scene, which is the state this part of
    // decision 18 exists to end.
    show([scene('s1', 'The dungeon', 0), clock('c1', 'The war', 1, null)], 's1', 'scene');
    expect(text()).not.toContain('The war');
  });

  it('draws nothing at all when the running scene owns no clock', () => {
    show([scene('s1', 'The dungeon', 0), clock('c1', 'The war', 1, null)], 's1', 'scene');
    expect(buttons().some((b) => (b.getAttribute('aria-label') ?? '').startsWith('Advance'))).toBe(
      false,
    );
  });

  it('moves a clock by hand, in the direction every other control moves it', () => {
    show([scene('s1', 'The dungeon', 0), clock('c1', 'The ritual', 1, 's1')], 's1', 'scene');
    const minus = buttons().find(
      (b) => b.getAttribute('aria-label') === 'Advance The ritual by one',
    )!;
    act(() => minus.click());
    expect(useGm.getState().countdowns.find((c) => c.id === 'c1')!.value).toBe(3);
  });

  it('advances nothing on its own when a scene starts or ends', () => {
    /*
     * "A countdown that ticks on its own is one you stop trusting. So: plus and
     * minus, and nothing else." Scope changes reach and attention, never
     * arithmetic - and this is the first optimisation somebody will propose.
     */
    const session = [
      scene('s1', 'The dungeon', 0),
      scene('s2', 'The forest', 1),
      clock('c1', 'The ritual', 2, 's1'),
    ];
    show(session, 's1', 'scene');
    const before = useGm.getState().countdowns.find((c) => c.id === 'c1')!.value;

    act(() => {
      useGm.getState().runScene('s2');
    });
    act(() => {
      useGm.getState().runScene('s1');
    });
    act(() => {
      useGm.getState().clearScene();
    });

    expect(useGm.getState().countdowns.find((c) => c.id === 'c1')!.value).toBe(before);
  });

  it('keeps the cost line the only dense paragraph in the tree', () => {
    // Two tests elsewhere assert exactly one `p.t-dense` in the whole of
    // `Scene`, so the clock block must never use it.
    show([scene('s1', 'The dungeon', 0), clock('c1', 'The ritual', 1, 's1')], 's1', 'scene');
    expect(container.querySelectorAll('p.t-dense')).toHaveLength(1);
  });

  it('gives every control on the block a 44px floor in both axes', () => {
    show([scene('s1', 'The dungeon', 0), clock('c1', 'The ritual', 1, 's1')], 's1', 'scene');
    const controls = buttons().filter((b) =>
      (b.getAttribute('aria-label') ?? '').includes('The ritual'),
    );
    expect(controls).toHaveLength(2);
    for (const c of controls) {
      expect(c.style.width).toBe('44px');
      expect(c.style.minHeight).toBe('44px');
    }
  });
});

describe('the board shows every clock, grouped by whose it is', () => {
  it('keeps a parked scene’s clocks findable, under that scene’s name', () => {
    /*
     * Scope changes where a clock is reachable in a hurry, not whether it
     * exists. Hiding a parked scene's clocks here would make them findable
     * only by running that scene, which is worse than the scrolling this
     * feature set out to end.
     */
    show(
      [
        scene('s1', 'The dungeon', 0),
        scene('s2', 'The forest', 1),
        clock('c1', 'The war', 2, null),
        clock('c2', 'The ritual', 3, 's1'),
        clock('c3', 'The tide', 4, 's2'),
      ],
      's1',
      'board',
    );
    expect(text()).toContain('The war');
    expect(text()).toContain('The ritual');
    expect(text()).toContain('The tide');
    expect(text()).toContain('THE CAMPAIGN');
    expect(text()).toContain('THE DUNGEON');
    expect(text()).toContain('THE FOREST');
  });

  it('gives a scene that owns no clock no heading at all', () => {
    // An empty section is a promise of something that is not there.
    show(
      [scene('s1', 'The dungeon', 0), scene('s2', 'The forest', 1), clock('c1', 'The war', 2, null)],
      's1',
      'board',
    );
    expect(text()).not.toContain('THE FOREST');
  });

  it('draws no heading at all when every clock is the campaign’s', () => {
    show([clock('c1', 'The war', 0, null), clock('c2', 'The siege', 1, null)], null, 'board');
    expect(text()).not.toContain('THE CAMPAIGN');
    expect(text()).toContain('The war');
    expect(text()).toContain('The siege');
  });
});
