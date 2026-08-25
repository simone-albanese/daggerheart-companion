// @vitest-environment jsdom
/**
 * The rest, from the GM's side, and the four numbers it is allowed to produce.
 *
 * `downtime` p.41 gives the GM 1d4 Fear on a short rest, 1d4 + PCs on a long
 * one, and one long-term countdown of their choice on the long one. Until this
 * panel none of it arrived on the GM's screen: `Rest.tsx` computed the Fear and
 * wrote it into a log line on the player's phone.
 *
 * `fearFromRest` is covered in `tests/engine/rest.test.ts` and is not
 * re-derived here. What a pure test cannot see is the four things that only
 * exist once the panel is on glass:
 *
 *   - **the dice switches.** A d4 is a die, and this app has one answer to what
 *     a surface may offer. All four combinations of `{digitalDice, manualDice}`
 *     are enumerated, the shipped default `{true, false}` included, because
 *     three of them are reachable in two taps from Settings and the fourth is
 *     the one that used to be got wrong;
 *   - **which party size is read.** The preference, never the number of sheets
 *     on the board. A board with four sheets and a preference of six makes
 *     those two numbers different, which is the only way to tell them apart;
 *   - **the clamp.** `nudgeFear` runs through `clampFear`, so above ten a long
 *     rest's +7 is not +7. An assertion on the "Fear delta range" alone would
 *     be false in the top third of the scale;
 *   - **that nothing is written until something is pressed.** The whole tool is
 *     built on *proposta, mai automatismo*, and a panel that moved the pool by
 *     existing would be the thing the file it mounts in refuses in its first
 *     paragraph.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SessionItem } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import type { Countdown } from '../../shared/types.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { RestControl } from '../../src/ui/gm/RestControl.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { NO_CLOCK_PROSE } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await hydrateGm();
});

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
  useGm.setState({ hydrated: true, session: [], countdowns: [], fear: 0 });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

const panel = (): void => render(createElement(RestControl, { phone: true }));

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const press = (label: string): void => {
  const found = buttons().filter((b) => (b.textContent ?? '').trim() === label);
  if (found.length !== 1) throw new Error(`${String(found.length)} controls read “${label}”`);
  act(() => {
    found[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const faceField = (): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>('input[aria-label="The d4 you rolled"]');

const typeFace = (value: string): void => {
  const el = faceField();
  if (el === null) throw new Error('no face field on the panel');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const prefs = (patch: Partial<typeof DEFAULT_PREFS>): void => {
  act(() => useApp.setState({ prefs: { ...DEFAULT_PREFS, ...patch } }));
};

const clock = (id: string, name: string, kind: Countdown['kind'], value = 6): SessionItem => ({
  id,
  kind: 'countdown',
  name,
  order: 0,
  collapsed: false,
  primary: false,
  countdown: { id, name, kind, start: 6, value, notes: '', ...NO_CLOCK_PROSE },
});

const seed = (items: SessionItem[]): void => {
  act(() => useGm.setState({ session: items, countdowns: countdownsOf(items) }));
};

const fear = (): number => useGm.getState().fear;
const valueOf = (id: string): number =>
  useGm.getState().countdowns.find((c) => c.id === id)!.value;

// ---------------------------------------------------------------------------

describe('what the two dice switches leave the rest control able to do', () => {
  it('rolls and does not take a face on the shipped default', () => {
    // `{ digitalDice: true, manualDice: false }` - what every table has until
    // somebody goes and changes it.
    expect(DEFAULT_PREFS.digitalDice).toBe(true);
    expect(DEFAULT_PREFS.manualDice).toBe(false);
    panel();
    press('SHORT REST');
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'ROLL 1D4')).toBe(true);
    expect(faceField()).toBeNull();
  });

  it('rolls and takes a face with both switches on', () => {
    prefs({ digitalDice: true, manualDice: true });
    panel();
    press('SHORT REST');
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'ROLL 1D4')).toBe(true);
    expect(faceField()).not.toBeNull();
  });

  it('takes a face and offers no roller with the roller off', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();
    press('SHORT REST');
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'ROLL 1D4')).toBe(false);
    expect(faceField()).not.toBeNull();
  });

  /*
   * The fourth state, which is the one this helper exists for. Nothing on the
   * device can produce the die, so the panel says which switch is missing
   * instead of offering a disabled ROLL - and it says it in `rollAffordance`'s
   * own words, so a GM who has read them on the Play screen does not have to
   * learn a second phrasing.
   */
  it('offers neither, and names the missing switch, with both off', () => {
    prefs({ digitalDice: false, manualDice: false });
    panel();
    press('SHORT REST');
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'ROLL 1D4')).toBe(false);
    expect(faceField()).toBeNull();
    expect(text()).toContain('NO DICE TURNED ON');
    expect(text()).toContain('TURN ON DIGITAL OR TYPED DICE IN SETTINGS');
    // And no APPLY either: there is no number to apply.
    expect(buttons().some((b) => (b.textContent ?? '').trim() === 'APPLY')).toBe(false);
  });
});

describe('the Fear a rest hands the GM', () => {
  it('is the face itself on a short rest', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();
    press('SHORT REST');
    typeFace('3');
    expect(text()).toContain('+3 FEAR');
    press('APPLY');
    expect(fear()).toBe(3);
  });

  /*
   * The party size is the preference and never the board. Six is chosen so it
   * cannot be confused with the default of four, and nothing here puts a sheet
   * on the board at all - `gmPartySize` is not derived from `party.length` and
   * `partySize.ts` argues why.
   */
  it('is the face plus the party size from the preference on a long rest', () => {
    prefs({ digitalDice: false, manualDice: true, gmPartySize: 6 });
    panel();
    press('LONG REST');
    typeFace('2');
    expect(text()).toContain('+8 FEAR');
    press('APPLY');
    expect(fear()).toBe(8);
  });

  it('takes nothing from a face that is not a face of this die', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();
    press('SHORT REST');
    for (const bad of ['0', '5', '2.5', '-1', 'x']) {
      typeFace(bad);
      expect(buttons().some((b) => (b.textContent ?? '').trim() === 'APPLY')).toBe(false);
    }
  });

  /*
   * The half a "Fear delta range" assertion would miss. `clampFear` stops at
   * MAX_FEAR, so a long rest that rolls into the ceiling does not apply what it
   * says - and a readout promising +8 on a pool of ten is lying exactly where a
   * GM most needs it not to.
   */
  it('says how much of the roll the pool will actually take', () => {
    prefs({ digitalDice: false, manualDice: true, gmPartySize: 4 });
    act(() => useGm.setState({ fear: 10 }));
    panel();
    press('LONG REST');
    typeFace('4');

    expect(text()).toContain('+8 FEAR');
    expect(text()).toContain('The pool stops at 12, so 2 of those 8 will land.');
    press('APPLY');
    expect(fear()).toBe(12);
  });

  it('says nothing about a ceiling the roll does not reach', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();
    press('SHORT REST');
    typeFace('2');
    expect(text()).not.toContain('The pool stops at');
  });
});

describe('the clock a long rest may advance', () => {
  it('offers the long-term clocks and no other kind', () => {
    prefs({ digitalDice: false, manualDice: true });
    seed([
      clock('c1', 'The ritual', 'dynamic'),
      clock('c2', 'The winter', 'long-term'),
      clock('c3', 'The siege', 'standard'),
      clock('c4', 'The debt', 'long-term'),
    ]);
    panel();
    press('LONG REST');

    const offered = buttons()
      .map((b) => (b.textContent ?? '').trim())
      .filter((t) => t.includes('·'));
    expect(offered).toEqual(['The winter · 6', 'The debt · 6']);
  });

  it('offers none at all on a short rest, which advances no clock', () => {
    prefs({ digitalDice: false, manualDice: true });
    seed([clock('c2', 'The winter', 'long-term')]);
    panel();
    press('SHORT REST');
    expect(text()).not.toContain('ADVANCE ONE LONG-TERM COUNTDOWN');
  });

  /*
   * "A long-term countdown of THEIR CHOICE" - one, and chosen. So tapping one
   * moves that one toward zero and shuts the others for this rest; a panel that
   * let a GM tap two would be handing them a rest the book does not describe.
   */
  it('advances exactly the one that was tapped, once', () => {
    prefs({ digitalDice: false, manualDice: true });
    seed([clock('c2', 'The winter', 'long-term'), clock('c4', 'The debt', 'long-term')]);
    panel();
    press('LONG REST');

    press('The winter · 6');
    expect(valueOf('c2')).toBe(5);
    expect(valueOf('c4')).toBe(6);

    const other = buttons().find((b) => (b.textContent ?? '').trim().startsWith('The debt'))!;
    expect(other.hasAttribute('disabled')).toBe(true);
  });

  it('says so rather than drawing an empty list when none is running', () => {
    prefs({ digitalDice: false, manualDice: true });
    seed([clock('c1', 'The ritual', 'dynamic')]);
    panel();
    press('LONG REST');
    expect(text()).toContain('No long-term countdowns are running');
  });
});

describe('nothing moves that a hand did not move', () => {
  it('writes nothing at mount, and nothing on choosing a rest or a face', () => {
    prefs({ digitalDice: false, manualDice: true });
    seed([clock('c2', 'The winter', 'long-term')]);

    panel();
    expect(fear()).toBe(0);
    expect(valueOf('c2')).toBe(6);

    press('LONG REST');
    typeFace('4');
    expect(fear()).toBe(0);
    expect(valueOf('c2')).toBe(6);
  });

  it('puts the rest away again when the same button is pressed twice', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();
    press('SHORT REST');
    typeFace('3');
    expect(text()).toContain('+3 FEAR');

    press('SHORT REST');
    expect(text()).not.toContain('+3 FEAR');
    expect(fear()).toBe(0);
  });

  it('quotes the book for the rest that is on the table, and not the other one', () => {
    prefs({ digitalDice: false, manualDice: true });
    panel();

    press('SHORT REST');
    expect(text()).toContain('On a short rest, the GM gains 1d4 Fear.');
    expect(text()).not.toContain('advance a long-term countdown of their choice');

    press('LONG REST');
    expect(text()).toContain('advance a long-term countdown of their choice');
    expect(text()).not.toContain('On a short rest, the GM gains 1d4 Fear.');
  });
});
