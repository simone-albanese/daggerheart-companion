// @vitest-environment jsdom
/**
 * The one rule two GM screens both have to say, said once.
 *
 * `EncounterAdjustments.damageBump` is a boolean, and what it *does* was
 * written out by hand in three places: the engine's budget line, the note under
 * the builder's toggles, and the chip on a planned session row. Three
 * transcriptions of one sentence, and two of them had already drifted from the
 * book - the SRD says "+1d4 (or a **static** +2)" and both screens had dropped
 * the word. A homebrew rules layer that changed the bump would have changed
 * none of them.
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
    combatants: [],
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
});
