// @vitest-environment jsdom
/**
 * The session list, which is the GM screen now.
 *
 * The record has carried a `session: SessionItem[]` since campaigns were built
 * and nothing had ever drawn it. So these are presence tests before they are
 * anything else - the defect shape this repo keeps shipping is absence, and
 * every one of the five arms below is a render path no test had executed.
 *
 * Two of them matter more than the other three. `shared/campaigns.ts` keeps an
 * item this build cannot read, and keeps a link whose target this dataset does
 * not carry, instead of dropping either from a list whose length the GM knows
 * by heart. That decision is only worth anything if both can be drawn, so both
 * are drawn here, and both are asserted by their content rather than by a count
 * of rows.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LinkTarget, SessionItem, SessionItemBase } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** Answer media queries as a viewport of this width would. */
function setViewport(width: number): void {
  window.matchMedia = ((query: string) => {
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    const coarse = /any-pointer:\s*coarse|pointer:\s*coarse/.test(query);
    return {
      matches:
        (max !== null && width <= Number(max[1])) ||
        (min !== null && width >= Number(min[1])) ||
        (coarse && width < 1180),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  // `gmStore` starts hydrating the moment it is imported, the way it does when
  // the lazy GM chunk arrives. A test that renders against `hydrated: false`
  // draws the "reading this device" state and passes for the wrong reason.
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
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
  useGm.setState({ hydrated: true, session: [], countdowns: [], combatants: [], environmentRef: null, roster: [] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

const list = (phone = true): void => {
  render(createElement(SessionList, { phone, onOpenTool: () => {} }));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const rows = (): HTMLLIElement[] => [...container.querySelectorAll('li')];

/**
 * The controls the *arm* draws, without the chrome every row has.
 *
 * The disclosure, the drag handle, MOVE UP, MOVE DOWN and DELETE belong to the
 * row rather than to its contents, and counting them would make "this arm
 * offers nothing to do" untestable.
 */
const ROW_CHROME = /^(Reorder |MOVE UP|MOVE DOWN|DELETE|TAP AGAIN)/;
const armControls = (): HTMLButtonElement[] =>
  buttons().filter(
    (b) =>
      b.getAttribute('aria-expanded') === null &&
      !ROW_CHROME.test(b.getAttribute('aria-label') ?? (b.textContent ?? '').trim()),
  );

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

function seed(items: SessionItem[]): void {
  useGm.setState({ session: items, countdowns: countdownsOf(items) });
}

const base = (patch: Partial<SessionItemBase> = {}): SessionItemBase => ({
  id: 'i1',
  name: 'A row',
  order: 0,
  collapsed: true,
  ...patch,
});

const NO_ADJUSTMENTS = { easier: false, harder: false, damageBump: false };
const environment = dataset.environments[0]!;
const adversary = dataset.adversaries[0]!;
const card = dataset.domainCards[0]!;
const rule = dataset.rules[0]!;

const oneOfEach = (): SessionItem[] => [
  { ...base({ id: 'a', name: 'Scene one', order: 0 }), kind: 'scene', environmentRef: environment.id },
  { ...base({ id: 'b', name: 'The ambush', order: 1 }), kind: 'encounter', roster: [{ ref: adversary.id, count: 2 }], adjustments: NO_ADJUSTMENTS, combatants: [] },
  { ...base({ id: 'c', name: 'Read this', order: 2 }), kind: 'link', target: { kind: 'rule', ref: rule.id } },
  { ...base({ id: 'd', name: 'The ritual', order: 3 }), kind: 'countdown', primary: false, countdown: { id: 'd', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '' } },
  { ...base({ id: 'e', name: '', order: 4 }), kind: 'unreadable', why: 'this version of the app has no "photo" item', raw: '{"kind":"photo","blob":"AAAA"}' },
];

// ---------------------------------------------------------------------------

describe('what the list says when there is nothing in it', () => {
  it('does not claim the night is empty before the database has answered', () => {
    // `useGm` starts as EMPTY_LIVE with `hydrated: false`. A list that drew its
    // empty state from that first paint would tell a GM their campaign is empty
    // while it is still being read off the disk.
    useGm.setState({ hydrated: false, session: [] });
    list();
    expect(text()).toContain('Reading this device');
    expect(text()).not.toContain('Nothing planned yet');
  });

  it('says the list is empty once it knows, and offers no control it does not have', () => {
    list();
    expect(text()).toContain('Nothing planned yet');
    // The bottom bar has not landed. An empty state that told the GM to press
    // ADD would be pointing at a button that is not on the screen.
    expect(buttons(), 'the empty state drew a control').toHaveLength(0);
  });
});

describe('the five arms, shut', () => {
  it('draws one row per item, in the order the record holds them', () => {
    seed(oneOfEach());
    list();
    expect(rows()).toHaveLength(5);
    const names = rows().map((li) => (li.querySelector('button')?.textContent ?? ''));
    expect(names[0]).toContain('Scene one');
    expect(names[1]).toContain('The ambush');
    expect(names[4]).toContain('Unreadable item');
  });

  it('puts each row’s own summary in its header, without opening it', () => {
    seed(oneOfEach());
    list();
    const headers = rows().map((li) => li.querySelector('button')?.textContent ?? '');
    expect(headers[0]).toContain(environment.name.toUpperCase());
    expect(headers[1]).toContain('2 PLANNED');
    expect(headers[2]).toContain(rule.title.toUpperCase());
    expect(headers[3]).toContain('4/6');
    expect(headers[4]).toContain('KEPT, NOT READ');
  });

  it('keeps a row this build cannot read, rather than showing one fewer', () => {
    seed(oneOfEach());
    list();
    expect(rows()).toHaveLength(5);
    expect(text()).toContain('Unreadable item');
  });
});

describe('the unreadable row, opened', () => {
  const unreadable = (): SessionItem[] => [
    { ...base({ id: 'u', name: '', collapsed: false }), kind: 'unreadable', why: 'this version of the app has no "photo" item', raw: '{"kind":"photo","blob":"AAAA"}' },
  ];

  it('shows why it could not be read and the bytes verbatim', () => {
    seed(unreadable());
    list();
    expect(text()).toContain('this version of the app has no "photo" item');
    const pre = container.querySelector('pre');
    expect(pre, 'the raw record is not on the screen').not.toBeNull();
    expect(pre?.textContent).toBe('{"kind":"photo","blob":"AAAA"}');
  });

  it('cannot make the page scroll sideways with somebody else’s JSON', () => {
    // `raw` is `JSON.stringify(v)`: one unbroken line, and the only text on
    // this screen whose width nothing in this app chose.
    seed(unreadable());
    list();
    const pre = container.querySelector('pre');
    expect(pre?.style.whiteSpace).toBe('pre-wrap');
    expect(pre?.style.overflowWrap).toBe('anywhere');
    expect(pre?.style.overflowX).toBe('auto');
  });

  it('offers nothing to do with it except delete it, and says what that costs', () => {
    seed(unreadable());
    list();
    // Nothing to edit: the row exists to be looked at and, if the GM decides
    // so, thrown away.
    expect(armControls()).toHaveLength(0);
    click(buttons().find((b) => (b.textContent ?? '') === 'DELETE')!);
    expect(text()).toContain('TAP AGAIN TO DELETE THE ONLY COPY');
  });
});

describe('the scene arm', () => {
  const scene = (ref: string | null = null): SessionItem[] => [
    { ...base({ id: 's', name: 'Scene one', collapsed: false }), kind: 'scene', environmentRef: ref },
  ];

  it('offers every environment in the dataset, plus none', () => {
    seed(scene());
    list();
    const select = container.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.options.length).toBe(dataset.environments.length + 1);
  });

  it('writes the environment onto the row and not onto the board', () => {
    seed(scene());
    list();
    const select = container.querySelector('select')!;
    act(() => {
      select.value = environment.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const row = useGm.getState().session[0]!;
    expect(row.kind === 'scene' && row.environmentRef).toBe(environment.id);
    // The row is the plan; the board is the table. Writing through
    // `setEnvironment` here would make every scene row show the same one.
    expect(useGm.getState().environmentRef).toBeNull();
  });

  it('carries the crossing to the board in words as well as in a button', () => {
    seed(scene(environment.id));
    list();
    expect(text()).toContain('This is the plan');
    const put = buttons().find((b) => (b.textContent ?? '').includes('PUT THIS ON THE BOARD'))!;
    click(put);
    expect(useGm.getState().environmentRef).toBe(environment.id);
  });
});

describe('the encounter arm', () => {
  it('names what is in the roster and keeps what this dataset cannot resolve', () => {
    seed([
      {
        ...base({ id: 'e', name: 'The ambush', collapsed: false }),
        kind: 'encounter',
        roster: [
          { ref: adversary.id, count: 2 },
          { ref: 'the-gnawing', count: 1 },
        ],
        adjustments: NO_ADJUSTMENTS,
        combatants: [],
      },
    ]);
    list();
    expect(text()).toContain(adversary.name);
    // Dropping it would quietly lower what the row says is planned.
    expect(text()).toContain('the-gnawing');
    expect(text()).toContain('NOT IN THIS DATASET');
  });

  it('states a saved fight as a fact, because nothing here can put one back', () => {
    seed([
      {
        ...base({ id: 'e', name: 'The ambush', collapsed: false }),
        kind: 'encounter',
        roster: [],
        adjustments: NO_ADJUSTMENTS,
        combatants: [
          { id: 'x', adversaryRef: adversary.id, name: 'Acid Burrower', hp: { marked: 2, max: 8 }, stress: { marked: 0, max: 3 }, thresholds: [8, 15], difficulty: 14, spotlighted: false, notes: '' },
        ],
      },
    ]);
    list();
    expect(text()).toContain('put the plan back on the board but not the fight');
    const verbs = buttons()
      .filter((b) => b.getAttribute('aria-expanded') === null)
      .map((b) => (b.textContent ?? '').trim());
    // No control offers to restore them, because no action in the store can.
    expect(verbs.some((v) => v.includes('COMBATANT') || v.includes('FIGHT'))).toBe(false);
  });

  it('puts a planned roster on the board through the actions that already exist', () => {
    seed([
      {
        ...base({ id: 'e', name: 'The ambush', collapsed: false }),
        kind: 'encounter',
        roster: [{ ref: adversary.id, count: 3 }],
        adjustments: { easier: true, harder: false, damageBump: false },
        combatants: [],
      },
    ]);
    list();
    click(buttons().find((b) => (b.textContent ?? '').includes('PUT THIS ROSTER ON THE BOARD'))!);
    expect(useGm.getState().roster).toEqual([{ ref: adversary.id, count: 3 }]);
    expect(useGm.getState().adjustments.easier).toBe(true);
  });
});

describe('the link arm', () => {
  const link = (target: LinkTarget): SessionItem[] => [
    { ...base({ id: 'l', name: 'Open this', collapsed: false }), kind: 'link', target },
  ];

  it('draws an adversary’s stat block', () => {
    seed(link({ kind: 'adversary', ref: adversary.id }));
    list();
    expect(text()).toContain(adversary.attack.name);
  });

  it('draws an environment with the control that makes it the live one', () => {
    seed(link({ kind: 'environment', ref: environment.id }));
    list();
    const toggle = buttons().find((b) => (b.textContent ?? '').includes('SET ACTIVE'))!;
    click(toggle);
    expect(useGm.getState().environmentRef).toBe(environment.id);
  });

  it('draws a domain card in the row rather than over the sheet', () => {
    seed(link({ kind: 'domainCard', ref: card.id }));
    list();
    expect(text()).toContain(card.name);
    // Deliberately not a READ THIS CARD that opens `CardReader`: two live
    // focus traps would fight over Tab, and one Escape would close both.
    expect(useApp.getState().openCard).toBeNull();
  });

  it('draws a rule’s own words', () => {
    seed(link({ kind: 'rule', ref: rule.id }));
    list();
    expect(text()).toContain(rule.title);
    expect(text().length).toBeGreaterThan(rule.title.length + 40);
  });

  it('says so, and shows the ref, when this dataset cannot resolve the link', () => {
    seed(link({ kind: 'adversary', ref: 'the-gnawing' }));
    list();
    expect(text()).toContain('the-gnawing');
    expect(text()).toContain('not in the dataset this device has loaded');
    expect(armControls(), 'an unresolved link offered a control').toHaveLength(0);
  });

  it('draws a link kind this build has never heard of, named', () => {
    seed(link({ kind: 'unknown', named: 'photo', ref: 'p1' }));
    list();
    expect(text()).toContain('photo');
    expect(text()).toContain('not a kind of thing this version of the app knows');
  });
});

describe('the countdown arm', () => {
  const countdown = (primary = false): SessionItem[] => [
    {
      ...base({ id: 'c', name: 'The ritual', collapsed: false }),
      kind: 'countdown',
      primary,
      countdown: { id: 'c', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '' },
    },
  ];

  it('advances the same way the countdowns board does', () => {
    seed(countdown());
    list();
    // `−` is "Advance … by one" on the board, and it has to mean the same thing
    // here or the app disagrees with itself about which way time goes.
    click(buttons().find((b) => b.getAttribute('aria-label') === 'Advance The ritual by one')!);
    const item = useGm.getState().session[0]!;
    expect(item.kind === 'countdown' && item.countdown.value).toBe(3);
  });

  it('pins exactly one countdown to the top bar', () => {
    seed([
      ...countdown(),
      { ...base({ id: 'c2', name: 'The tide', collapsed: false }), kind: 'countdown', primary: true, countdown: { id: 'c2', name: 'The tide', kind: 'loop', start: 4, value: 4, notes: '' } },
    ]);
    list();
    const pin = buttons().find((b) => (b.textContent ?? '') === 'PIN IT TO THE TOP BAR')!;
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    click(pin);
    const primary = useGm.getState().session.filter((i) => i.kind === 'countdown' && i.primary);
    expect(primary.map((i) => i.id)).toEqual(['c']);
  });
});

describe('opening and deleting a row', () => {
  it('remembers which rows are open, on the record rather than in a component', () => {
    seed(oneOfEach());
    list();
    const header = rows()[0]!.querySelector('button')!;
    expect(header.getAttribute('aria-expanded')).toBe('false');
    click(header);
    expect(useGm.getState().session[0]!.collapsed).toBe(false);

    // The arrangement survives the component being thrown away, which is what
    // "the notebook is still open where you left it" has to mean.
    act(() => root.unmount());
    root = createRoot(container);
    list();
    expect(rows()[0]!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('deletes nothing on one tap', () => {
    seed([{ ...base({ id: 's', name: 'Scene one', collapsed: false }), kind: 'scene', environmentRef: null }]);
    list();
    const del = buttons().find((b) => (b.textContent ?? '') === 'DELETE')!;
    click(del);
    expect(useGm.getState().session).toHaveLength(1);
    expect(text()).toContain('TAP AGAIN TO DELETE');
    click(buttons().find((b) => (b.textContent ?? '').startsWith('TAP AGAIN'))!);
    expect(useGm.getState().session).toHaveLength(0);
  });

  it('says which row it is about to delete, so a screen reader can tell them apart', () => {
    seed(oneOfEach().map((i) => ({ ...i, collapsed: false })));
    list();
    const names = buttons()
      .filter((b) => (b.textContent ?? '') === 'DELETE')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toContain('DELETE — Scene one');
    expect(names).toContain('DELETE — Unreadable item');
  });
});

// ---------------------------------------------------------------------------

/**
 * The two rules that hold for the whole screen rather than for one control.
 *
 * Everything a finger lands on is at least 44px, and nothing forces the column
 * wider than the phone. Both were checked control by control while this screen
 * was built, which is exactly how the eleventh one gets missed.
 */
describe('the whole GM screen, at 393x852, with every row open', () => {
  /** A declared length in px. Tokens resolve as they do below 1180px. */
  function px(value: string): number {
    if (value === 'var(--tap)' || value === 'var(--control)' || value === 'var(--pip-h)') return 44;
    if (value === '') return 0;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  const openEverything = (): void => {
    seed([
      // The countdown is pinned, so the top bar draws its third row too: the
      // sweep has to cover the pinned chrome as well as the list under it.
      ...oneOfEach().map((i) => ({ ...i, collapsed: false, ...(i.kind === 'countdown' ? { primary: true } : {}) })),
      { ...base({ id: 'l2', name: 'The burrower', collapsed: false }), kind: 'link', target: { kind: 'adversary', ref: adversary.id } },
      { ...base({ id: 'l3', name: 'The grove', collapsed: false }), kind: 'link', target: { kind: 'environment', ref: environment.id } },
      { ...base({ id: 'l4', name: 'A card', collapsed: false }), kind: 'link', target: { kind: 'domainCard', ref: card.id } },
    ]);
    useGm.setState({ combatants: [] });
    render(createElement(Gm));
  };

  it('has no target under the touch floor', () => {
    openEverything();
    const small = buttons()
      .map((b) => ({
        name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 40),
        h: Math.max(px(b.style.height), px(b.style.minHeight)),
      }))
      .filter((t) => t.h < 44);
    expect(
      small.map((t) => `${t.name} (${String(t.h)}px)`),
      'these declare less than the 44px floor',
    ).toEqual([]);
  });

  it('never forces the column wider than the phone', () => {
    openEverything();
    // 393 less the 12px page padding either side.
    const COLUMN = 369;
    const wide = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => px(el.style.width) > COLUMN || px(el.style.minWidth) > COLUMN)
      .map((el) => `${el.tagName}.${el.className} ${el.style.width}/${el.style.minWidth}`);
    expect(wide, 'these are wider than the column, so the page scrolls sideways').toEqual([]);
  });
});
