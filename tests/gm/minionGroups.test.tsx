// @vitest-environment jsdom
/**
 * One Minion entry, three surfaces, and the number they have to agree on.
 *
 * `EncounterEntry.count` is *groups* for a Minion, each the size of the party,
 * and `ROLE_COST` charges one battle point per group - "per group of Minions
 * equal to the party size". Every screen that draws that entry has to expand it
 * or say something false about a fight, and three of them have now got it wrong
 * one at a time:
 *
 *   - the builder's roster panel has spelled it out - "3 GROUPS OF 4" - since
 *     the first commit;
 *   - the open session row said "×3" until `ecf8017` brought it into line;
 *   - the picker's 46px add button said `IN ×3` about twelve rats, and the
 *     shut session row said "3 PLANNED" about the same twelve, until this one.
 *
 * So the property is asserted across the surfaces at once rather than one file
 * at a time: the same roster, read three ways, has to carry the same two
 * numbers. A fourth surface that forgets is the whole point of the file.
 *
 * The party size is driven rather than defaulted in most of these, because the
 * defect a fixed party of four cannot catch is the one where somebody folds
 * `partySize` into a literal 4 and every assertion still passes.
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
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const minion = dataset.adversaries.find((a) => a.role === 'Minion')!;
/** The Acid Burrower: a Solo, so one count is one adversary. */
const solo = dataset.adversaries[0]!;

/** The picker's add button for one adversary, found by the name it announces. */
const addButton = (name: string): HTMLButtonElement => {
  const found = buttons().filter((b) => (b.getAttribute('aria-label') ?? '').includes(`${name} for `));
  if (found.length !== 1) throw new Error(`${String(found.length)} add buttons name ${name}`);
  return found[0]!;
};

const builder = (roster: { ref: string; count: number }[], partySize: number): void => {
  // Inside `act`, because two of these tests drive the same mounted builder
  // twice to prove the party size is read rather than written down.
  act(() => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: partySize } });
    useGm.setState({ roster });
  });
  render(createElement(Encounter, { phone: false }));
};

const plannedRow = (roster: { ref: string; count: number }[]): SessionItem => ({
  id: 'e',
  kind: 'encounter',
  name: 'The ambush',
  order: 0,
  collapsed: true,
  roster,
  adjustments: { easier: false, harder: false, damageBump: false },
  combatants: [],
});

describe('the 46px add button in the picker', () => {
  it('says the groups and their size, where it used to say the groups alone', () => {
    builder([{ ref: minion.id, count: 3 }], 4);
    const badge = addButton(minion.name).textContent ?? '';
    expect(badge).toContain('IN 3×4');
    // The string this replaced, and the reason: three groups of four is twelve
    // rats, and `×3` is what a GM reads as "three of them".
    expect(badge, 'the badge is back to counting groups as bodies').not.toContain('IN ×3');
  });

  it('reads the party size rather than carrying a four of its own', () => {
    // The mutation this exists for: fold `partySize` into a literal and a
    // fixture that never leaves four keeps passing.
    builder([{ ref: minion.id, count: 3 }], 7);
    expect(addButton(minion.name).textContent ?? '').toContain('IN 3×7');
    expect(addButton(minion.name).textContent ?? '').not.toContain('IN 3×4');
  });

  it('leaves every other role reading as a multiplier, because that is what it is', () => {
    builder([{ ref: solo.id, count: 3 }], 4);
    expect(solo.role, 'the first adversary in the dataset became a Minion').not.toBe('Minion');
    const badge = addButton(solo.name).textContent ?? '';
    expect(badge).toContain('IN ×3');
    expect(badge, 'a Solo grew a party size it does not have').not.toContain('×4');
  });

  it('shows the points, and only the points, before anything is picked', () => {
    builder([], 4);
    expect(addButton(minion.name).textContent ?? '').toContain('PTS');
    expect(addButton(minion.name).textContent ?? '').not.toContain('IN');
  });

  it('tells a listener that one tap adds a whole group, which the cell has no room for', () => {
    builder([{ ref: minion.id, count: 3 }], 4);
    expect(addButton(minion.name).getAttribute('aria-label')).toBe(
      `Add a group of 4 ${minion.name} for 1 battle point`,
    );
    // Same mutation, on the other string.
    builder([{ ref: minion.id, count: 3 }], 7);
    expect(addButton(minion.name).getAttribute('aria-label')).toContain('a group of 7');
  });

  it('does not offer a group to somebody adding one adversary', () => {
    builder([], 4);
    const label = addButton(solo.name).getAttribute('aria-label') ?? '';
    expect(label).toBe(`Add ${solo.name} for 5 battle points`);
    expect(label, 'a Solo was announced as a group').not.toContain('group');
  });
});

describe('the badge and the roster panel, on the same screen', () => {
  it('carry the same two numbers, in the same order, in different words', () => {
    /*
     * They are both on the phone layout at once, one under the other. The
     * panel has room for the sentence and the 46px cell has room for neither
     * word - so the cell says the sentence's two numbers rather than a third
     * way of counting, and this is what stops them drifting apart again.
     */
    builder([{ ref: minion.id, count: 3 }], 4);
    expect(text(), 'the roster panel stopped spelling the groups out').toContain('3 GROUPS OF 4');
    expect(addButton(minion.name).textContent ?? '').toContain('3×4');
  });

  it('says GROUP in the singular for one group, on both of them', () => {
    builder([{ ref: minion.id, count: 1 }], 5);
    expect(text()).toContain('1 GROUP OF 5');
    expect(text()).not.toContain('1 GROUPS OF 5');
    expect(addButton(minion.name).textContent ?? '').toContain('IN 1×5');
  });
});

describe('the shut session row, which reads the same roster', () => {
  it('counts the adversaries the plan holds, not the lines in it', () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: 4 } });
    useGm.setState({ session: [plannedRow([{ ref: minion.id, count: 3 }])] });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
    expect(text()).toContain('12 PLANNED');
    // What it said before, about a fight that opens with twelve bodies in it.
    expect(text(), 'the shut row is back to counting roster lines').not.toContain('3 PLANNED');
  });

  it('reads the party size off the preferences rather than assuming four', () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: 6 } });
    useGm.setState({ session: [plannedRow([{ ref: minion.id, count: 3 }])] });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
    expect(text()).toContain('18 PLANNED');
  });

  it('leaves a roster with no Minion in it counting exactly as it did', () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: 6 } });
    useGm.setState({ session: [plannedRow([{ ref: solo.id, count: 2 }])] });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
    expect(text()).toContain('2 PLANNED');
  });
});
