// @vitest-environment jsdom
/**
 * One Minion entry, five surfaces, and the number they have to agree on.
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
 *     shut session row said "3 PLANNED" about the same twelve, until this one;
 *   - the scene builder's `TAKE THE n` summed `count` raw and was the last one
 *     genuinely counting the wrong thing; it reads `CARRY THE n INTO THIS
 *     SCENE` now and counts what the row it mints will say.
 *
 * So the property is asserted across the surfaces at once rather than one file
 * at a time: the same roster, read five ways, has to carry the same two
 * numbers. A sixth surface that forgets is the whole point of the file.
 *
 * The fifth arrived with campaign schema 5 and had nothing to press before it:
 * `START THIS FIGHT` on a scene row's own arm, which spawns that row's roster
 * into that row. It reads the same `entry.count` through the same `spawn`, one
 * file over from the builder, and until the fight moved off the board the arm's
 * verbs moved a fight rather than starting one.
 *
 * AND THERE IS ONE THAT IS NOT WRONG, WHICH IS THE HARDER HALF. `SEND n TO THE
 * SCENE` - or `TO A NEW SCENE`, depending on whether a row is open - was read
 * as a further defect and it is not one: `spawn` runs once per `count` and
 * `makeCombatant` puts `minionsRemaining: partySize` on each, so three groups
 * of four are three CARDS holding twelve rats. SEND predicts cards; the shut
 * row counts rats; both are right, in different units, about different
 * questions. A reader who "corrected" SEND to 12 would put three cards on the
 * table under a label promising twelve.
 *
 * That near-miss is why the SEND block below pins the UNIT and not the number:
 * it reads the label off the glass, taps it, and counts what arrives. Nothing
 * in it writes 3 or 12 down, because a literal is exactly what made the wrong
 * reading look verified.
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
import { hydrateGm, openCombatants, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { sceneWith } from '../fixtures/factories.ts';

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

/** The builder's primary control, found by the words either side of its number. */
const sendButton = (): HTMLButtonElement => {
  const found = buttons().filter((b) => (b.textContent ?? '').startsWith('SEND '));
  if (found.length !== 1) throw new Error(`${String(found.length)} SEND controls`);
  return found[0]!;
};

/**
 * The roster panel's own line for one adversary - `T1 · MINION · 2 GROUPS OF 4`.
 *
 * Scoped to the row rather than read out of the whole screen, and that is not
 * fussiness: `container.textContent` carries the picker's `IN ×1` badge too, so
 * an assertion looking for `×1` anywhere passed while the roster row beside it
 * called every entry a group. The mutant proved it before this helper existed.
 */
const rosterLine = (name: string): string => {
  // Anchored on the row's own stepper, because the picker cell above is the
  // same shape - a name with a `t-meta` under it - and a selector that matched
  // both threw before it could assert anything. This is the row with the ✕ on
  // it: the one in the roster panel.
  const stepper = [...container.querySelectorAll('button')].filter(
    (b) => (b.getAttribute('aria-label') ?? '') === `One fewer ${name}`,
  );
  if (stepper.length !== 1) throw new Error(`${String(stepper.length)} roster rows name ${name}`);
  const meta = stepper[0]?.closest('div.row')?.querySelector('span.t-meta');
  if (meta == null) throw new Error(`no roster line for ${name}`);
  return (meta.textContent ?? '').replace(/\s+/g, ' ').trim();
};

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

describe('SEND, and the unit it is in', () => {
  /*
   * THE TRAP THIS BLOCK EXISTS FOR, WHICH CAUGHT A READER OF THIS VERY FILE.
   *
   * A handoff read the surfaces above, saw the shut row say `12 PLANNED` where
   * SEND says 3, and called SEND the liar. It is not. `spawn` runs once per
   * `count`, and `makeCombatant` hands a Minion `minionsRemaining: partySize`,
   * so three groups of four are three CARDS holding twelve rats - and
   * `Scene.tsx` prints that four on each card as a MINIONS stepper. SEND
   * predicts cards, the shut row counts rats, and both are right.
   *
   * So this block pins the unit rather than the number: whatever SEND says is
   * what a GM finds on the table after tapping it. Nothing here writes 3 or 12
   * down, because a literal is what let the wrong reading look verified.
   */
  const said = (): number => {
    const found = /SEND (\d+) /.exec(sendButton().textContent ?? '');
    if (found === null) throw new Error(`SEND prints no number: ${sendButton().textContent ?? ''}`);
    return Number(found[1]);
  };

  /*
   * Press it and count what arrives, in ONE scene row.
   *
   * `send` is `const sceneId = openScene ?? openNewScene()` followed by one
   * `spawn` per entry, so there are two ways it can leave more rows behind than
   * it promised, and they are NOT caught by the same line. The claim that the
   * row count caught both is withdrawn rather than patched: what follows is
   * what each mutant did, run as `npx vitest run tests/gm/minionGroups.test.tsx`
   * in an rsync'd copy.
   *
   * A mint moved INSIDE the loop needs no help from the row count. A roster of
   * two entries lands in two rows holding one card each, `openCombatants` reads
   * the open one, so the count of what arrived fails on its own - measured with
   * the row count deleted, same test, same message about a length of 3. And
   * only the mixed roster can see it at all: three of the four presses in this
   * block send a single-entry roster, and a single entry mints once either way.
   *
   * A SECOND mint left standing BESIDE the first is what the row count is for,
   * and nothing else in the file sees it. Every spawn still lands in the open
   * row, so every count stays right and an empty row is left behind: `void
   * openNewScene()` above the `sceneId` line fails all four presses here at the
   * row count, and takes the file green the moment the row count is deleted.
   * That stray row is the failure the comment over `send` warns about.
   */
  const tapped = (): number => {
    const promised = said();
    act(() => {
      sendButton().click();
    });
    const after = useGm.getState();
    expect(after.session.filter((i) => i.kind === 'scene')).toHaveLength(1);
    expect(after.openScene).toBe(after.session[0]?.id);
    expect(openCombatants(after)).toHaveLength(promised);
    return promised;
  };

  it('promises the cards a Minion roster puts on the table, not the rats in them', () => {
    builder([{ ref: minion.id, count: 3 }], 4);
    expect(tapped()).toBe(3);
    // Every card carries the group, which is where the twelve is.
    const rats = openCombatants(useGm.getState()).map((c) => c.minionsRemaining);
    expect(rats).toEqual([4, 4, 4]);
  });

  it('does not move when the party does, because a card is a card', () => {
    // The mutation that would break it: reaching for `adversaryBodies` here.
    // A party of seven makes each group bigger, never adds a fourth card.
    builder([{ ref: minion.id, count: 3 }], 7);
    expect(tapped()).toBe(3);
    expect(openCombatants(useGm.getState()).map((c) => c.minionsRemaining)).toEqual([7, 7, 7]);
  });

  it('keeps its promise for a roster with no Minion in it', () => {
    builder([{ ref: solo.id, count: 3 }], 4);
    expect(tapped()).toBe(3);
    expect(openCombatants(useGm.getState())[0]?.minionsRemaining).toBeUndefined();
  });

  it('keeps its promise for a roster that mixes the two', () => {
    // The case neither unit survives on its own: two cards holding four rats
    // each, plus one Solo, is three cards and nine bodies.
    builder(
      [
        { ref: minion.id, count: 2 },
        { ref: solo.id, count: 1 },
      ],
      4,
    );
    expect(tapped()).toBe(3);
  });

  it('is bare because no noun is true of a roster with both in it', () => {
    /*
     * The owner's open question of 2026-08-26, and the measurement that closes
     * it: **should the button spell the groups itself?**
     *
     * `SEND n` counts cards, and a card is a group only when the adversary is a
     * Minion. On a mixed roster the panel above says both things at once, in
     * two different words, on one screen - so `SEND 3 GROUPS` would be false
     * about the Solo, and a label that is false on a mixed roster is worse than
     * a number that is bare on every roster. `SEND 3 CARDS` names this app's
     * furniture rather than the fiction.
     *
     * This is the assertion the decision rests on, so it is here rather than in
     * a docblock: if a future roster panel ever calls every row a group, this
     * goes red and the reasoning written beside the button stops being true in
     * a test rather than in a paragraph.
     */
    builder(
      [
        { ref: minion.id, count: 2 },
        { ref: solo.id, count: 1 },
      ],
      4,
    );
    expect(rosterLine(minion.name), 'the Minion row stopped reading as groups').toContain(
      '2 GROUPS OF 4',
    );
    expect(rosterLine(solo.name), 'the Solo row stopped reading as a multiplier').toContain('×1');
    expect(rosterLine(solo.name), 'the Solo row started calling itself a group').not.toContain(
      'GROUP',
    );
    // Three cards, two of which are groups. There is no one noun for that, so
    // the button uses none.
    //
    // Whole string, not a substring. The tail is conditional now - `TO A NEW
    // SCENE` with nothing open, `TO THE SCENE` with a row open - and a
    // `toContain` on a conditional label is how a label ends up with no proof
    // at all. Which tail belongs to which state is `sendCarry.test.tsx`'s
    // claim; what is asserted here is that nothing has been inserted between
    // the number and it.
    expect(sendButton().textContent).toBe('SEND 3 TO A NEW SCENE');
    expect(sendButton().textContent).not.toContain('GROUP');
    expect(sendButton().textContent).not.toContain('CARD');
  });

  it('stands beside a panel that spells the group out, which is where the four is', () => {
    // SEND is bare, and the rule this repo states for the picker cell is that
    // a bare number reads as bodies. What keeps it honest is not the label but
    // its neighbour: the sentence is on the glass a few pixels above it.
    builder([{ ref: minion.id, count: 3 }], 4);
    expect(text()).toContain('3 GROUPS OF 4');
    expect(sendButton().textContent).toBe('SEND 3 TO A NEW SCENE');
  });
});

describe('the row’s own verb, which is the fifth surface', () => {
  /*
   * THE SURFACE THE HEADER PREDICTED, NOW THAT A ROW CAN HOLD ITS OWN FIGHT.
   *
   * `SEND` is the builder's road onto the table and the block above presses it.
   * `START THIS FIGHT` is the other road - a scene row's own roster, spawned
   * into that row - and it reads the same `EncounterEntry.count` through the
   * same `spawn(sceneId, adversary, partySize, count)`. Two writers of one
   * arithmetic is exactly the shape this file was opened for, and until the
   * fight moved onto the row there was nothing here to press: the arm's verbs
   * moved a fight between the board and a row instead of starting one.
   *
   * The mutation it kills is `entry.count` → `1` at `SessionBody.tsx`'s spawn
   * loop, which turns three groups into one card and leaves every count above
   * green, because every count above goes through `Encounter.tsx` instead.
   *
   * A party of five throughout, never four: a `partySize` folded into a literal
   * 4 is the other defect this file's header names, and a fixture of four
   * cannot see it.
   */
  const PARTY = 5;

  const plannedScene = (roster: { ref: string; count: number }[]): SessionItem =>
    sceneWith('s1', [], { name: 'The ambush', order: 0, collapsed: false, roster });

  const plan = (roster: { ref: string; count: number }[]): void => {
    act(() => {
      useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: PARTY } });
      useGm.setState({ session: [plannedScene(roster)] });
    });
    render(createElement(SessionList, { phone: true, onOpenTool: () => {} }));
  };

  /** By accessible name: three planned scenes draw the same three words. */
  const start = (): void => {
    const found = buttons().find(
      (b) => b.getAttribute('aria-label') === 'START THIS FIGHT — The ambush',
    );
    if (found === undefined) {
      throw new Error(
        `no START THIS FIGHT on the row. Here: ${buttons()
          .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim())
          .join(' | ')}`,
      );
    }
    act(() => {
      found.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };

  it('puts one card per group on the row, each holding the party’s worth of bodies', () => {
    plan([{ ref: minion.id, count: 3 }]);
    start();

    const after = useGm.getState();
    expect(after.openScene).toBe('s1');
    // Cards, in the unit SEND uses - and the group size on each of them, in the
    // unit the shut row counts. Both from the one press.
    expect(openCombatants(after)).toHaveLength(3);
    expect(openCombatants(after).map((c) => c.minionsRemaining)).toEqual([PARTY, PARTY, PARTY]);
  });

  it('spends every entry of a mixed roster, rather than one card per line', () => {
    plan([
      { ref: minion.id, count: 2 },
      { ref: solo.id, count: 1 },
    ]);
    start();

    const bodies = openCombatants(useGm.getState());
    expect(bodies).toHaveLength(3);
    // Two groups and a Solo: the Solo carries no group at all, which is what
    // says the count was spent per entry and not per row.
    expect(bodies.filter((c) => c.minionsRemaining !== undefined)).toHaveLength(2);
    expect(bodies.filter((c) => c.minionsRemaining === undefined)).toHaveLength(1);
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
