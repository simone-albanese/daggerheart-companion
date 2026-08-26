// @vitest-environment jsdom
/**
 * The one rule two GM screens both have to say, said once.
 *
 * `EncounterAdjustments.damageBump` is a boolean, and what it *does* was
 * written out by hand in three places: the engine's budget line, the note under
 * the builder's toggles, and the chip on a planned session row. Three
 * transcriptions of one sentence, and all three had already drifted from the
 * book the same way - the SRD says "+1d4 (or a **static** +2)" and every one of
 * them had dropped the word, the engine as `+1d4 (or +2)` and the two screens
 * as the same parenthesis uppercased. A homebrew rules layer that changed the
 * bump would have changed none of them, and no copy was right enough to catch
 * the others.
 *
 * The engine's is not a fourth quotation and never became one: it names the
 * switch (`'Adversaries deal extra damage'`) because a module that computes
 * points has no rules layer to read. A first pass at this left it quoting the
 * stale copy while the note under it quoted the book, which is a contradiction
 * on one screen where there had only been an error - so there is a test below
 * that no adjustment label carries dice at all.
 *
 * `damageBumpRule` is the single read they now share. These tests are here
 * rather than in `ruleText.test.ts` because that file can only prove the
 * selector finds the line; what matters at the table is that the two surfaces
 * a GM actually reads print it, and print the *same* one.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SessionItem } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Encounter } from '../../src/ui/gm/Encounter.tsx';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { damageBumpRule } from '../../src/ui/shared/ruleText.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
    combatants: [], liveScene: null,
    environmentRef: null,
    roster: [],
    adjustments: { easier: false, harder: false, damageBump: false },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};
const text = (): string => container.textContent ?? '';

/** The book's own words for the bump, as the shipped dataset carries them. */
const BUMP = damageBumpRule(dataset.rules);

const plannedRow = (damageBump: boolean): SessionItem => ({
  id: 'e',
  kind: 'encounter',
  name: 'The ambush',
  order: 0,
  collapsed: false,
  roster: [{ ref: dataset.adversaries[0]!.id, count: 1 }],
  adjustments: { easier: false, harder: false, damageBump },
  combatants: [],
});

describe('what the builder says the bump does', () => {
  it('quotes the dataset rather than a sentence typed into the screen', () => {
    expect(BUMP, 'the shipped dataset no longer carries the line').not.toBeNull();
    useGm.setState({ adjustments: { easier: false, harder: false, damageBump: true } });
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain(BUMP!.toUpperCase());
    // The line this replaced. It said "(OR +2)" where the book says "(or a
    // static +2)", which is the drift a hand-typed rule always ends in.
    expect(text()).not.toContain('ALL ADVERSARIES DEAL +1d4 (OR +2) DAMAGE THIS FIGHT');
    /*
     * AND NOT ANYWHERE ELSE ON THE SCREEN EITHER, which is the assertion this
     * test's name always claimed and did not make. It passed for a while with
     * the engine's own toggle label still printing `+1d4 (or +2)` eleven lines
     * above the quotation - one screen saying the same rule two ways. The check
     * is now on the drifted string wherever it falls, not on the one deleted
     * line that happened to carry it.
     */
    expect(text()).not.toContain('+1d4 (or +2)');
    expect(text()).not.toContain('+1D4 (OR +2)');
  });

  it('says the derived line instead when the bump is off', () => {
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain('DERIVED FROM THE ROSTER');
    expect(text()).not.toContain(BUMP!.toUpperCase());
  });
});

describe('what the session row says the bump does', () => {
  it('is the same read, so the plan and the builder cannot drift apart', () => {
    useGm.setState({ session: [plannedRow(true)] });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
    const row = text();

    act(() => {
      useGm.setState({ adjustments: { easier: false, harder: false, damageBump: true } });
    });
    render(createElement(Encounter, { phone: false }));
    const builder = text();

    // Case is a matter of register - the builder's line is set in the meta
    // face, the row's is a sentence - so the comparison is on the words.
    expect(row.toLowerCase()).toContain(BUMP!.toLowerCase());
    expect(builder.toLowerCase()).toContain(BUMP!.toLowerCase());
  });

  /*
   * THE ONE ABOVE PROVES THE WORDS AGREE TODAY. THIS PROVES THE MECHANISM.
   *
   * Both surfaces containing `damageBumpRule(dataset.rules)` is satisfied by two
   * verbatim copies of the shipped sentence typed into two files - replacing the
   * interpolation in either screen with the literal string leaves it green, so
   * on its own it pins content equality and not the shared read that is the
   * whole point. What only a shared read survives is the sentence *changing*:
   * a homebrew layer moves it, and both screens have to move with it.
   */
  it('follows a rules layer that changes the bump, on both surfaces at once', () => {
    // In FRONT of the shipped sections, not behind them: the selector takes the
    // first line it finds, which is how a layer overrides rather than appends.
    const houseRules = [
      {
        id: 'house-rules',
        title: 'House rules',
        body: 'Preamble.\n\n- -3 if you add +2d6 (or a static +7) to all adversaries\u2019 damage rolls',
      },
      ...dataset.rules,
    ];
    const moved = damageBumpRule(houseRules);
    expect(moved, 'the fixture stopped moving the sentence').not.toBe(BUMP);

    useApp.setState({ dataset: { ...dataset, rules: houseRules } });
    useGm.setState({ session: [plannedRow(true)] });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
    const row = text();

    act(() => {
      useGm.setState({ adjustments: { easier: false, harder: false, damageBump: true } });
    });
    render(createElement(Encounter, { phone: false }));
    const builder = text();

    for (const [where, seen] of [
      ['the session row', row],
      ['the builder', builder],
    ] as const) {
      expect(seen.toLowerCase(), `${where} ignored the layer`).toContain(moved!.toLowerCase());
      expect(seen.toLowerCase(), `${where} still prints the shipped sentence`).not.toContain(
        BUMP!.toLowerCase(),
      );
    }
  });
});
