// @vitest-environment jsdom
/**
 * The party size the app budgets for, against the sheets actually on the board.
 *
 * `prefs.gmPartySize` and `party.length` are two different facts and they are
 * allowed to disagree: a GM whose fifth player is away keeps that sheet on the
 * board and builds tonight's fight for four. Nothing here derives one from the
 * other, and these tests are as much about that as about the line - half of
 * them assert that a number stayed where the GM put it.
 *
 * What the line fixes is only that the disagreement was invisible. The builder
 * printed `(3 × 4) + 2 = 14 BASE` beside five imported sheets and never
 * mentioned the five.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PartyMember } from '../../shared/types.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Bestiary } from '../../src/ui/gm/Bestiary.tsx';
import { Encounter } from '../../src/ui/gm/Encounter.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { partySizeNote } from '../../src/ui/gm/partySize.ts';
import { dataset, index, playedCharacter } from '../ui/fixture.ts';

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
    openScene: null,
    party: [],
    environmentRef: null,
    region: 'encounter',
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

/** One imported sheet. The board keeps the whole thing; only the count matters here. */
const sheet = playedCharacter();
const board = (n: number): PartyMember[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `pc-${String(i)}`,
    sheet: { ...sheet, name: `Player ${String(i)}` },
    importedAt: '2026-08-24T00:00:00.000Z',
    source: 'file' as const,
    tracks: { hp: 0, stress: 0, hope: 2, armor: 0 },
    markedAt: null,
  }));

const minion = dataset.adversaries.find((a) => a.role === 'Minion')!;
const solo = dataset.adversaries.find((a) => a.role === 'Solo')!;

const clickNamed = (name: string): void => {
  const found = [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes(name),
  );
  if (found === undefined) throw new Error(`no control named ${name}`);
  act(() => {
    found.click();
  });
};

const clickLabelled = (label: string): void => {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (found === null) throw new Error(`no control labelled ${label}`);
  act(() => {
    found.click();
  });
};

describe('the sentence itself', () => {
  it('says both numbers, in the order the GM meets them', () => {
    expect(partySizeNote(4, 5)).toBe('BUDGET FOR 4 · 5 SHEETS ON THE BOARD');
  });

  it('counts one sheet as one sheet', () => {
    expect(partySizeNote(4, 1)).toBe('BUDGET FOR 4 · 1 SHEET ON THE BOARD');
  });

  it('says nothing when the two agree', () => {
    // The whole design of the line. A row that is on the screen every evening
    // is furniture, and furniture is not read.
    expect(partySizeNote(4, 4)).toBeNull();
    expect(partySizeNote(1, 1)).toBeNull();
  });

  it('says nothing about an empty board', () => {
    /*
     * NOT A DISAGREEMENT - AN ABSENCE, and the difference is the whole reason
     * this branch exists separately from the one above. A GM who has never
     * imported a sheet is not in conflict with the app; they are not using the
     * party board. `BUDGET FOR 4 · 0 SHEETS ON THE BOARD` would follow them
     * onto two screens for the length of the campaign saying nothing at all.
     */
    expect(partySizeNote(4, 0)).toBeNull();
    expect(partySizeNote(1, 0)).toBeNull();
  });
});

describe('the builder', () => {
  it('says the disagreement beside the number it spends', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain('BUDGET FOR 4 · 5 SHEETS ON THE BOARD');
  });

  it('is silent when the board and the preference agree', () => {
    act(() => {
      useGm.setState({ party: board(4) });
    });
    render(createElement(Encounter, { phone: false }));
    expect(text()).not.toContain('SHEETS ON THE BOARD');
  });

  it('is silent when nobody has imported a sheet', () => {
    render(createElement(Encounter, { phone: false }));
    expect(text()).not.toContain('ON THE BOARD');
  });

  /*
   * DECIDED - DO NOT DERIVE IT. The line makes the disagreement visible and
   * changes nothing else: the battle-point base is still `(3 × 4) + 2`, on a
   * board holding five sheets. A version of this that quietly followed
   * `party.length` would print 17 here and would have taken the GM's own number
   * away from them to satisfy an invariant nobody at the table asked for.
   */
  it('still budgets for the preference, not for the board', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain('(3 × 4) + 2 = 14 BASE');
    expect(text()).not.toContain('(3 × 5) + 2 = 17 BASE');
    expect(useApp.getState().prefs.gmPartySize).toBe(4);
  });

  it('offers no gesture that sets one number from the other', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Encounter, { phone: false }));

    // The only control over the number is the stepper, and it moves the
    // preference by one - it does not jump to the board's count.
    clickLabelled('Increase PCs');
    expect(useApp.getState().prefs.gmPartySize).toBe(5);
    // And the board did not move to meet the preference either.
    expect(useGm.getState().party).toHaveLength(5);
    // They agree now, so the line has nothing left to say.
    expect(text()).not.toContain('SHEETS ON THE BOARD');
  });
});

describe('the bestiary', () => {
  it('says the disagreement where a Minion group is sized by the number', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Bestiary, { phone: false }));
    clickNamed(minion.name);
    const seen = text();
    expect(seen).toContain('ONE GROUP OF 4');
    expect(seen).toContain('BUDGET FOR 4 · 5 SHEETS ON THE BOARD');
  });

  it('leaves it off an adversary the number has nothing to do with', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Bestiary, { phone: false }));
    clickNamed(solo.name);
    const seen = text();
    expect(seen).toContain('ONE ADVERSARY, FULL HP');
    // `ONE ADVERSARY, FULL HP` spends no party size. A line about a number that
    // nothing beside it spends is exactly the furniture this item is written
    // against.
    expect(seen).not.toContain('SHEETS ON THE BOARD');
  });

  /*
   * WHERE IT IS DRAWN, NOT ONLY THAT IT IS.
   *
   * The line first shipped inside the `action` column of `AdversaryBlock`'s
   * header - the `.spread` in `StatBlock.tsx` holding the `<h2 class="t-card">`
   * and whatever the host passes as `action`. This screen's `action` is a
   * `flex: 'none'` column, so its base size is the max-content width of its
   * widest child, and every pixel it takes comes off the name beside it.
   * `BUDGET FOR 4 · 5 SHEETS ON THE BOARD` is more than twice the length of
   * anything else that column holds.
   *
   * That direction - a wider child in a `flex: 'none'` column is a narrower
   * name - is the whole mechanism claimed here, and it needs no browser. How
   * far the name gives before the header overflows instead is a separate
   * question, and this comment does not answer it.
   *
   * **Retracted, and this was the second copy.** An earlier draft answered that
   * question backwards: it said `.spread` grants the `<h2>` beside it "no
   * `min-width: 0` to stop at", naming the absence of a floor as the cause of
   * one. A flex item's default `min-width: auto` *is* the floor; `min-width: 0`
   * is what removes it - which the `base.css` note above `.app` states in as
   * many words, where it explains that a grid item keeps `min-width: auto` and
   * overflows its `minmax(0, 1fr)` track anyway. The `.spread` rule itself
   * declares only `display`, `align-items`, `justify-content` and a `gap`, and
   * that same note lists `.row`, `.spread` and `.stack` as deliberately left
   * without minimum-zero, so it grants nothing either way. The box carrying no
   * `minWidth: 0` override is `StatBlock.tsx`'s own `<h2 className="t-card">`;
   * the two other flex children in that file that want it - the `stack` beside
   * the attack bonus and the `flex: 1` name span in the environment band -
   * write the declaration out by hand. `Bestiary.tsx` deleted this sentence
   * rather than write it a fourth time, and it does not get to survive here.
   *
   * jsdom lays nothing out and cannot see a width; what it can see is the box
   * tree, and a note that is not inside the header cannot charge the header for
   * one. That is what this pins.
   */
  it('draws the line outside the header, where it costs the name nothing', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Bestiary, { phone: false }));
    clickNamed(minion.name);

    const note = [...container.querySelectorAll('span')].find(
      (s) => (s.textContent ?? '') === 'BUDGET FOR 4 · 5 SHEETS ON THE BOARD',
    );
    expect(note, 'the line is not on the screen at all').not.toBeUndefined();

    const title = container.querySelector('h2.t-card');
    expect(title, 'the stat block drew no title for it to compete with').not.toBeNull();
    const header = title!.closest('.spread');
    expect(header, 'the title is no longer inside a `.spread`').not.toBeNull();
    expect(
      header!.contains(note!),
      'the line is back inside the header, taking the name’s width',
    ).toBe(false);
  });

  it('still sizes the group by the preference, not by the board', () => {
    act(() => {
      useGm.setState({ party: board(5) });
    });
    render(createElement(Bestiary, { phone: false }));
    clickNamed(minion.name);
    expect(text()).not.toContain('ONE GROUP OF 5');
    expect(useGm.getState().party).toHaveLength(5);
  });
});
