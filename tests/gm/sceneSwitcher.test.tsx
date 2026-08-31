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
import { openCombatants, useGm } from '../../src/ui/gm/gmStore.ts';
import { combatant, sceneWith } from '../fixtures/factories.ts';

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
  useGm.setState({ hydrated: true, session: [], openScene: null, environmentRef: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const fighter = (id: string) => combatant(id);

/*
 * A row that IS its fight, through the shared constructor rather than a literal
 * with `...NO_FIGHT` and a `combatants:` written over the top - which is two
 * contradictory sentences about the same three lines, and which is what this
 * helper used to be. The strip reads `combatants.length` and nothing else off
 * a body, so the bodies are whatever the factory mints.
 */
const scene = (id: string, name: string, order: number, fighters = 0): SessionItem =>
  sceneWith(
    id,
    Array.from({ length: fighters }, (_, i) => fighter(`acid-burrower-${String(i)}`)),
    { name, order, collapsed: true },
  );

const show = (session: SessionItem[], openScene: string | null): void => {
  act(() => {
    useGm.setState({ session, openScene });
    root.render(createElement(SceneSwitcher, { label: 'THE LIVE SCENE' }));
  });
};

const chips = (): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('button, [aria-current]'),
];

describe('what the strip draws', () => {
  it('keeps the title row’s own word when there is no scene to flip to', () => {
    /*
     * It used to return `null` here, and this test asserted the row's text was
     * empty - which it was, and which is the defect rather than the decision.
     *
     * `Gm.tsx` passes `title={tool === 'scene' ? <SceneSwitcher/> : undefined}`,
     * so for the runner `title` is an ELEMENT whatever this component goes on
     * to render. `GmSheet`'s `{title ?? label}` therefore never falls through
     * for this tool, and a strip that rendered nothing left the header as a
     * bare `ESC ✕` - on the very state a GM reaches by opening the runner
     * before any fight exists. No value a component can return makes `??` fall
     * through, so the word is drawn here.
     */
    show([scene('a', 'The dungeon', 0)], null);
    expect(container.textContent).toBe('THE LIVE SCENE');
    expect(chips()).toHaveLength(0);
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

  it('announces the chip it is not showing with the whole name, as text rather than as a title', () => {
    // A `title` is a mouse affordance on a device with no mouse.
    //
    // `Open`, not `Run`. There is no mode a scene is put INTO any more: every
    // row on this strip is holding its own fight the whole time and the tap
    // only changes which one is drawn, so a verb promising to START something
    // would promise the one thing this control has stopped doing.
    show([scene('a', 'The dungeon below the mill', 0, 1), scene('b', 'The forest', 1)], 'b');
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Open The dungeon below the mill');
    expect(button.getAttribute('title')).toBe(null);
  });

  it('calls a row with no name what the rest of the app calls it', () => {
    show([scene('a', '', 0, 1), scene('b', 'The forest', 1)], 'b');
    const button = container.querySelector('button')!;
    expect(button.textContent).toBe('SCENE');
    expect(button.getAttribute('aria-label')).toBe('Open Scene');
  });

  it('flips in one tap, with no confirmation and no arming', () => {
    // The flip destroys nothing, and the reason is stronger than the one that
    // used to be written here. It was that the parking storage put back what
    // the swap took away, so nothing was lost on the round trip. Now nothing is
    // taken away at all: `showScene` writes one string and no fight moves, so
    // there is no round trip to make whole and a confirmation would double the
    // cost of the one gesture this file is for to guard a write that does not
    // happen.
    show([scene('a', 'The dungeon', 0, 2), scene('b', 'The forest', 1)], 'b');
    act(() => {
      container.querySelector('button')!.click();
    });
    expect(useGm.getState().openScene).toBe('a');
    expect(openCombatants(useGm.getState())).toHaveLength(2);
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
    // `liveScenes` asks for `kind === 'scene'` before it asks anything about a
    // fight, and an `encounter` row holding bodies is exactly the state that
    // makes the two questions differ. It is also the row with no
    // `environmentRef` at all, so a strip that let one on would offer the GM a
    // chip that opens a fight into no place.
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
        openScene: 'b',
      });
      root.render(createElement(SceneSwitcher, { label: 'THE LIVE SCENE' }));
    });
    expect(chips().map((c) => c.textContent)).toEqual(['THE FOREST']);
  });

  /*
   * Two fights standing at once, and the tap that moves neither of them.
   *
   * This is the state schema 5 exists for and the one the strip could not
   * reach before: two rows each holding their own adversaries while a third,
   * empty one is the one being drawn. Under schema 4 the fight was the board's,
   * so two rows carrying bodies at the same time meant somebody had parked one
   * on purpose, and the open row was on the strip only through the pointer.
   *
   * The flip test above proves the pointer moves and the newly-open row's fight
   * arrives with it. What is proved here is the other half - that NOTHING else
   * did - and it is asserted on object identity rather than on lengths: a
   * `showScene` that rebuilt the rows it did not open would still hand back two
   * arrays of the right size. `toBe` is what tells a copy from the row itself.
   */
  it('draws a fight-holding row, another, and the empty one being shown, and moves no body on the tap', () => {
    const rows = [scene('a', 'The dungeon', 0, 2), scene('b', 'The forest', 1, 1), scene('c', 'The gate', 2)];
    show(rows, 'c');
    expect(chips().map((c) => c.textContent)).toEqual(['THE DUNGEON', 'THE FOREST', 'THE GATE']);

    const before = useGm.getState().session;
    act(() => {
      container.querySelector('button')!.click();
    });

    const after = useGm.getState().session;
    expect(useGm.getState().openScene).toBe('a');
    // Every row object, not just its contents: the tap wrote `openScene` and
    // touched no row at all.
    for (const [i, row] of after.entries()) expect(row).toBe(before[i]);
    // And the runner is now looking at the fight that was already standing on
    // the row it opened, with the bodies it already had.
    expect(openCombatants(useGm.getState()).map((c) => c.id)).toEqual([
      'acid-burrower-0',
      'acid-burrower-1',
    ]);
  });
});
