// @vitest-environment jsdom
/**
 * The session list, which is the GM screen now.
 *
 * The record has carried a `session: SessionItem[]` since campaigns were built
 * and nothing had ever drawn it. So these are presence tests before they are
 * anything else - the defect shape this repo keeps shipping is absence, and
 * every one of the arms below is a render path no test had executed.
 *
 * The shut list draws seven kinds - every arm of `describeItem` in
 * `src/ui/gm/session.ts` - and this file is laid out by where they came from.
 * Five of them are covered below: the four the wireframe drew - `scene`,
 * `encounter`, `link` and `countdown` - and `unreadable`, which it did not
 * draw. The other two, `url` and `note`, came with campaign schema 2 and have
 * a section of their own at the end of this header.
 *
 * Two of those first five matter more than the other three.
 * `shared/campaigns.ts` keeps an item this build cannot read, and keeps a link
 * whose target this dataset does not carry, instead of dropping either from a
 * list whose length the GM knows by heart. That decision is only worth anything
 * if both can be drawn, so both are drawn here, and both are asserted by their
 * content rather than by a count of rows.
 *
 * ## And the two campaign schema 2 added
 *
 * `url` and `note` landed as a storage layer - a type, a reader, a writer and
 * an export - with their screens left to two later lanes, so what `UrlArm.tsx`
 * and `NoteArm.tsx` drew for them was a placeholder that said so. That is
 * exactly the shape this file exists to catch, because "the arm renders
 * nothing" and "the arm is not built yet" look identical from the outside.
 *
 * Both lanes have since landed and both describes were rewritten by them, as
 * that paragraph expected: `UrlArm.tsx` draws the punycode address and an
 * anchor that opens it, `NoteArm.tsx` walks the block format. The last two
 * describes assert that each draws the value it holds and that neither is
 * silently empty. There are two of them, one per kind, with a fixture each,
 * because they were two lanes and the split is what kept them from rewriting
 * one describe over one shared fixture.
 *
 * The anchor is also why the whole-screen sweep further up seeds a `url` row.
 * It is *not* the only control on this screen that is not a `<button>`, which
 * is what stood here and was false: `SessionBody`'s `SceneArm` draws a
 * `<select>` for the row's environment with a `minHeight: 'var(--tap)'` of its
 * own, `oneOfEach` has seeded a scene row since this file was written, and the
 * `button, a` selector that sentence justified could not see it either. The
 * sweep no longer takes a sentence's word for the set: it reads the declared
 * floors off the DOM and asserts, by exact list, which of them its selector
 * does not reach.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkTarget, SessionItem, SessionItemBase } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { damageBumpRule } from '../../src/ui/shared/ruleText.ts';
import { SessionList } from '../../src/ui/gm/SessionList.tsx';
import { MemoSessionRow, SessionRow } from '../../src/ui/gm/SessionRow.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { NO_FIGHT, NO_CLOCK_PROSE } from '../fixtures/factories.ts';

/**
 * A render counter for the rows, and the reason it is a module mock.
 *
 * `React.memo` cannot be proved by asking whether `memo` was called. That
 * check is true of a memo whose props are rebuilt on every render, which skips
 * nothing and is exactly the defect this list had - so the proof has to be a
 * count of renders that actually happened.
 *
 * `describeItem` is what counts them. `SessionRow` calls it once, at the top
 * of its body, on every arm and with no condition in front of it, so calls to
 * it and renders of a row are the same event one-for-one. The wrapper is a
 * pass-through over the real module: every other test in this file goes on
 * asserting against the real sentences, and this one reads the ids off the
 * side.
 *
 * `vi.hoisted` because `vi.mock` is hoisted above the imports and the factory
 * would otherwise close over a binding that does not exist yet.
 */
const drawn = vi.hoisted(() => [] as string[]);

vi.mock('../../src/ui/gm/session.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/ui/gm/session.ts')>();
  return {
    ...real,
    describeItem: (...args: Parameters<typeof real.describeItem>): string => {
      drawn.push(args[0].id);
      return real.describeItem(...args);
    },
  };
});

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
  useGm.setState({ hydrated: true, session: [], countdowns: [], combatants: [], liveScene: null, environmentRef: null, roster: [] });
  drawn.length = 0;
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
 * The one button whose visible words carry this label.
 *
 * Throws on none and on two, rather than `find(...)!` returning the first of
 * an ambiguous pair: every verb on this screen is drawn once per row, and a
 * test that silently picked row 1's button while meaning row 2's would pass
 * for the wrong reason.
 */
const named = (label: string): HTMLButtonElement => {
  const found = buttons().filter((b) => (b.textContent ?? '').includes(label));
  if (found.length !== 1) throw new Error(`${String(found.length)} buttons say “${label}”`);
  return found[0]!;
};

/**
 * The controls the *arm* draws, without the chrome every row has.
 *
 * The disclosure, the drag handle, RENAME, MOVE UP, MOVE DOWN and DELETE
 * belong to the row rather than to its contents, and counting them would make
 * "this arm offers nothing to do" untestable.
 */
const ROW_CHROME = /^(Reorder |RENAME|MOVE UP|MOVE DOWN|DELETE|TAP AGAIN)/;
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

const press = (el: Element, key: string): void => {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
};

/**
 * jsdom does not notify React when `input.value` is assigned directly, so this
 * goes through the native setter and dispatches the event React listens for.
 * Without it every typing test here would assert against an unchanged field
 * and pass for the wrong reason - the same note `rename.test.tsx` carries.
 */
function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

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
  { ...base({ id: 'a', name: 'Scene one', order: 0 }), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT },
  { ...base({ id: 'b', name: 'The ambush', order: 1 }), kind: 'encounter', roster: [{ ref: adversary.id, count: 2 }], adjustments: NO_ADJUSTMENTS, combatants: [] },
  { ...base({ id: 'c', name: 'Read this', order: 2 }), kind: 'link', target: { kind: 'rule', ref: rule.id } },
  { ...base({ id: 'd', name: 'The ritual', order: 3 }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'd', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE } },
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

  it('does not promise that a change made while it reads will survive', () => {
    /*
     * This panel used to say "nothing you do before it arrives will be lost —
     * it is the saved campaign that wins", which is a contradiction with the
     * false half first. `hydrateGm` adopts the record and drops whatever was
     * changed in the window before it: a Fear tap made here goes back. The
     * store is right to do that and the panel has to say it.
     */
    useGm.setState({ hydrated: false, session: [] });
    list();
    expect(text(), 'the panel promises the tap survives, and it does not').not.toMatch(
      /will be lost/,
    );
    expect(text()).toContain('replaced by the saved campaign');
  });

  it('says the list is empty once it knows, and points at the control that fills it', () => {
    list();
    expect(text()).toContain('Nothing planned yet');
    // It used to end "nothing in this build writes a new one yet", which was
    // true right up until ADD landed - and a limitation the app has lifted is
    // the kind of sentence that outlives its reason in an empty state nobody
    // rereads. It names ADD now, and ADD is on the screen.
    expect(text()).toContain('ADD');
    // Still no control of its own: ADD is in the bar below this list, and a
    // second button here would be two doors onto one sheet.
    expect(buttons(), 'the empty state drew a control').toHaveLength(0);
  });
});

describe('the four arms the wireframe drew and the one it did not, shut', () => {
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

  it('offers nothing to do with its bytes except throw them away, and says what that costs', () => {
    seed(unreadable());
    list();
    // Nothing here can edit what the row *holds*: it exists to be looked at
    // and, if the GM decides so, thrown away. RENAME is not a counterexample -
    // it writes `SessionItemBase.name`, which every row has and this one has
    // empty, and `raw` is untouched by it. That is asserted below.
    expect(armControls()).toHaveLength(0);
    click(buttons().find((b) => (b.textContent ?? '') === 'DELETE')!);
    expect(text()).toContain('TAP AGAIN TO DELETE THE ONLY COPY');
  });
});

describe('the scene arm', () => {
  const scene = (ref: string | null = null): SessionItem[] => [
    { ...base({ id: 's', name: 'Scene one', collapsed: false }), kind: 'scene', environmentRef: ref, ...NO_FIGHT },
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
    // Named for the noun it moves. `named` throws unless exactly one button
    // matches, so this is also the assertion that the four verbs on this strip
    // that talk about the board can be told apart from each other.
    click(named('PUT THIS ENVIRONMENT ON THE BOARD'));
    expect(useGm.getState().environmentRef).toBe(environment.id);
  });

  /*
   * The plan a scene row carries, which it could neither show nor change.
   *
   * `AddSheet`'s CARRY THE n INTO THIS SCENE has written a roster onto a scene
   * row since the scene form grew that button, and the shut row has read
   * `n PLANNED` off it. The open arm read it only to decide whether START THIS
   * FIGHT appeared. So a row planned before the session held adversaries the GM
   * could count and not name, and could not add the one they thought of
   * afterwards - there was no control, on any screen, that wrote a scene row's
   * roster after it was born.
   */
  describe('the roster it plans', () => {
    const planned = (): SessionItem[] => [
      {
        ...base({ id: 's', name: 'Scene one', collapsed: false }),
        kind: 'scene',
        environmentRef: null,
        ...NO_FIGHT,
        roster: [{ ref: adversary.id, count: 2 }],
      },
    ];

    it('names what it is planning, and not only how many', () => {
      seed(planned());
      list();
      // The adversary's own name, off the dataset rather than typed here.
      expect(text()).toContain(adversary.name);
      expect(text()).toContain('ROSTER');
    });

    it('says nothing is planned rather than drawing an empty list', () => {
      seed(scene());
      list();
      expect(text()).toContain('Nothing planned yet.');
      expect(named('PUT THIS ROSTER ON THE BOARD').disabled).toBe(true);
    });

    it('puts its plan on the board, adjustments and all', () => {
      seed(planned());
      list();
      click(named('PUT THIS ROSTER ON THE BOARD'));
      expect(useGm.getState().roster).toEqual([{ ref: adversary.id, count: 2 }]);
    });

    it('takes the board’s roster back, which is what it could never do', () => {
      seed(scene());
      act(() => {
        useGm.setState({ roster: [{ ref: adversary.id, count: 4 }] });
      });
      list();
      click(named('KEEP THE BOARD’S ROSTER HERE'));
      const row = useGm.getState().session[0]!;
      expect(row.kind === 'scene' && row.roster).toEqual([{ ref: adversary.id, count: 4 }]);
      // And the board is left alone: the row is a copy of it, not an alias.
      expect(useGm.getState().roster).toEqual([{ ref: adversary.id, count: 4 }]);
    });

    it('offers nothing to take when the board is empty', () => {
      seed(scene());
      list();
      expect(named('KEEP THE BOARD’S ROSTER HERE').disabled).toBe(true);
    });

    it('says what it was built with, which nothing on this row ever said', () => {
      /*
       * The other half of the same omission. `AddSheet` writes `roster` and
       * `adjustments` onto a scene row in one call; the encounter arm read the
       * flags back and this one did not, so a scene planned with the damage
       * bump on carried it to the table and told nobody. Nothing in the scene
       * applies the bump - a combatant carries HP, Stress and thresholds, never
       * a damage expression - so a GM who is not told simply does not add it.
       */
      seed([
        {
          ...base({ id: 's', name: 'Scene one', collapsed: false }),
          kind: 'scene',
          environmentRef: null,
          ...NO_FIGHT,
          adjustments: { easier: false, harder: false, damageBump: true },
        },
      ]);
      list();
      expect(text()).toContain('Nothing in the scene rolls that for you');
      // And a row built with the flag off says nothing at all about it, which
      // is the rule this app follows everywhere: no apology row for a thing
      // that is not there.
      seed(scene());
      list();
      expect(text()).not.toContain('Nothing in the scene rolls that for you');
    });

    it('gives every verb that names the board a noun of its own', () => {
      seed(planned());
      act(() => {
        useGm.setState({ roster: [{ ref: adversary.id, count: 1 }] });
      });
      list();
      // Four buttons on one strip talk about the board. Each has to say which
      // thing it moves, or a GM opens them one at a time to find out - and one
      // of the four overwrites a plan. `named` throws on an ambiguous match, so
      // these four calls are the assertion.
      for (const label of [
        'PUT THIS ENVIRONMENT ON THE BOARD',
        'KEEP THE BOARD’S ENVIRONMENT HERE',
        'PUT THIS ROSTER ON THE BOARD',
        'KEEP THE BOARD’S ROSTER HERE',
      ]) {
        expect(named(label).textContent, label).toContain(label);
      }
    });
  });

  /*
   * The fight the row holds, decision 18.
   *
   * A scene row can be planned, running, or parked with a fight in it, and the
   * arm has to say which - the only primary verb it offers is a different verb
   * in each case, and one of them destroys marks.
   */
  describe('the fight it is holding', () => {
    const withFight = (n: number, id = 's'): SessionItem[] => [
      {
        ...base({ id, name: 'Scene one', collapsed: false }),
        kind: 'scene',
        environmentRef: null,
        roster: [],
        adjustments: NO_ADJUSTMENTS,
        combatants: Array.from({ length: n }, (_, i) => ({
          id: `${adversary.id}-${String(i)}`,
          adversaryRef: adversary.id,
          name: adversary.name,
          hp: { max: 6, marked: 2 },
          stress: { max: 3, marked: 0 },
          thresholds: [4, 8] as [number, number],
          difficulty: 12,
          spotlighted: false,
          notes: '',
        })),
      },
    ];

    const primary = (): HTMLButtonElement | undefined =>
      buttons().find((b) => b.className.includes('btn-primary'));

    it('never draws two primary verbs, however the conditions overlap', () => {
      /*
       * Two primaries in one row is none, and the conditions overlap on their
       * own: a row that is live still has its roster, and a parked row can
       * have one too. The arm resolves them first-match-wins rather than by
       * drawing every verb whose condition is true.
       *
       * A bare row on an unowned, empty board draws ONE, and that is an
       * overturn of what this test pinned before it.
       *
       * It used to read: "A bare row draws NONE, and that is the decision
       * rather than an oversight: there is nothing of that row's to open, and
       * the only verb that would fit opens somebody else's scene." The second
       * clause is the whole of the argument and it is false in exactly this
       * state - `beforeEach` leaves `liveScene: null` with an empty board, so
       * there is no somebody else's scene for the verb to open. `OPEN THE
       * SCENE` now claims that board for the row it is drawn on, which is what
       * it always looked like it did, so on this state it is the row's own verb
       * and takes the fill. The demotion survives where the sentence is true,
       * and the test below is what holds it there.
       */
      const cases: [SessionItem[], number][] = [
        [scene(), 1],
        [scene(environment.id), 1],
        [withFight(2), 1],
      ];
      for (const [items, expected] of cases) {
        seed(items);
        list();
        expect(buttons().filter((b) => b.className.includes('btn-primary'))).toHaveLength(expected);
      }

      // Live, and holding a roster it could still start: one primary, not two.
      seed([
        {
          ...base({ id: 's', name: 'Scene one', collapsed: false }),
          kind: 'scene',
          environmentRef: null,
          roster: [{ ref: adversary.id, count: 1 }],
          adjustments: NO_ADJUSTMENTS,
          combatants: [],
        },
      ]);
      useGm.setState({ liveScene: 's' });
      list();
      expect(buttons().filter((b) => b.className.includes('btn-primary'))).toHaveLength(1);
    });

    it('says how many are parked, and what bringing them back costs', () => {
      seed(withFight(3));
      list();
      expect(text()).toContain('Parked here: 3 adversaries');
      expect(primary()?.textContent).toBe('BACK TO THIS FIGHT');
    });

    it('says one adversary rather than one adversaries', () => {
      seed(withFight(1));
      list();
      expect(text()).toContain('Parked here: 1 adversary,');
    });

    it('puts a parked fight back on the board, and parks whatever was there', () => {
      seed([...withFight(2, 'dungeon'), ...withFight(1, 'forest').map((i) => ({ ...i, order: 1 }))]);
      useGm.setState({ liveScene: null, combatants: [] });
      list();

      const back = buttons().filter((b) => (b.textContent ?? '') === 'BACK TO THIS FIGHT');
      click(back[0]!);

      expect(useGm.getState().liveScene).toBe('dungeon');
      expect(useGm.getState().combatants).toHaveLength(2);
    });

    it('offers no way to clear a fight that is not there', () => {
      seed(scene());
      list();
      expect(buttons().some((b) => (b.textContent ?? '').includes('CLEAR THIS FIGHT'))).toBe(false);
    });

    it('arms CLEAR THIS FIGHT, because it destroys the only copy of those marks', () => {
      // The flip is one tap and this is two, and that is the whole line:
      // running a scene moves a fight, clearing one ends it.
      seed(withFight(2));
      list();
      const clear = buttons().find((b) => (b.textContent ?? '') === 'CLEAR THIS FIGHT')!;
      click(clear);
      expect(text()).toContain('TAP AGAIN TO CLEAR');
      const row = useGm.getState().session[0]!;
      expect(row.kind === 'scene' && row.combatants, 'one tap cleared it').toHaveLength(2);

      click(buttons().find((b) => (b.textContent ?? '') === 'TAP AGAIN TO CLEAR')!);
      const after = useGm.getState().session[0]!;
      expect(after.kind === 'scene' && after.combatants).toEqual([]);
    });

    it('says what a live row is holding, and does not call it parked', () => {
      seed(scene());
      useGm.setState({ liveScene: 's' });
      list();
      expect(text()).toContain('This scene is on the board');
      expect(text()).not.toContain('Parked here');
      expect(primary()?.textContent).toBe('OPEN THE SCENE');
    });

    it('starts a planned fight in one tap, without arming', () => {
      /*
       * Running a scene destroys nothing - the fight on the board is parked
       * into the row it came from - so this is one tap. «Conferma sempre» was
       * decided about a button that threw marks away, and this is the ratified
       * reading "arm what replaces, not what appends", extended to "nor what
       * moves".
       */
      seed([
        {
          ...base({ id: 's', name: 'Scene one', collapsed: false }),
          kind: 'scene',
          environmentRef: null,
          roster: [{ ref: adversary.id, count: 2 }],
          adjustments: NO_ADJUSTMENTS,
          combatants: [],
        },
      ]);
      list();
      expect(primary()?.textContent).toBe('START THIS FIGHT');
      click(primary()!);
      expect(useGm.getState().liveScene).toBe('s');
      expect(useGm.getState().combatants.length).toBeGreaterThan(0);
    });

    it('does not make OPEN THE SCENE the headline of a row whose scene is elsewhere', () => {
      /*
       * On a row that is neither live nor holding a fight WHILE ANOTHER SCENE
       * IS ON THE TABLE, that button opens a runner showing a DIFFERENT scene -
       * so as the row's primary verb it lies about which row it belongs to. It
       * is still drawn, plainly: the runner's empty state is the only door to
       * the bestiary from here, and the top bar's chip appears only once
       * something is on the board.
       *
       * The second scene is the premise, and it used not to be here. This
       * seeded one bare row on an empty unowned board and asserted the
       * demotion there, which is the one state where the sentence above is not
       * true of anything - and where the missing claim was the defect that made
       * a fight belong to no row at all.
       */
      seed([
        ...scene(),
        {
          ...base({ id: 'other', name: 'Scene two', collapsed: true }),
          kind: 'scene',
          environmentRef: null,
          roster: [],
          adjustments: NO_ADJUSTMENTS,
          combatants: [],
        },
      ]);
      useGm.setState({ liveScene: 'other' });
      list();
      const open = buttons().find((b) => (b.textContent ?? '') === 'OPEN THE SCENE');
      expect(open, 'the only door to the empty runner was walled up').toBeDefined();
      expect(open!.className).not.toContain('btn-primary');
      // And the row says why, in the sentence that shipped on `encounter`.
      expect(text()).toContain('The board is running another scene');
    });

    it('claims an unowned, empty board for the row the GM pressed', () => {
      /*
       * The repair, at the point where it was missing. `OPEN THE SCENE` called
       * `onOpenTool` and wrote no pointer, so a GM who planned a row, opened
       * it, built an encounter and sent it "to the scene" ended with a fight on
       * a board naming no row - and the row they had been looking at the whole
       * time still empty. Nothing anywhere married the two.
       */
      seed(scene());
      list();
      expect(useGm.getState().liveScene).toBeNull();
      act(() => buttons().find((b) => (b.textContent ?? '') === 'OPEN THE SCENE')!.click());
      expect(useGm.getState().liveScene).toBe('s');
      // Claiming an empty board moves nothing and mints nothing.
      expect(useGm.getState().combatants).toEqual([]);
      expect(useGm.getState().session).toHaveLength(1);
    });

    it('gives the fight that belongs to no row a way to become this row’s', () => {
      /*
       * The bestiary and the builder opened out of MENU both spawn onto the
       * board without a row to write to, so `liveScene` stays null with marks
       * on the glass. `liveScenes` returns nothing there, so the runner draws
       * no chip and the plan cannot mark anything: the fight is nobody's until
       * it is ended. This is the verb that state had none of.
       */
      seed(scene());
      useGm.setState({
        combatants: [
          {
            id: `${adversary.id}-0`,
            adversaryRef: adversary.id,
            name: adversary.name,
            hp: { max: 6, marked: 3 },
            stress: { max: 3, marked: 0 },
            thresholds: [4, 8] as [number, number],
            difficulty: 12,
            spotlighted: false,
            notes: '',
          },
        ],
      });
      list();
      const take = buttons().find((b) => (b.textContent ?? '') === 'TAKE THE FIGHT ON THE BOARD');
      expect(take, 'the orphan fight had no door back into the plan').toBeDefined();
      expect(take!.className).toContain('btn-primary');
      expect(text()).toContain('belonging to no row of the plan');
      act(() => take!.click());
      expect(useGm.getState().liveScene).toBe('s');
      // Adoption is the pointer and only the pointer: the marks are untouched.
      expect(useGm.getState().combatants[0]?.hp.marked).toBe(3);
      expect(useGm.getState().session).toHaveLength(1);
    });

    it('says which row is on the table, on the shut header', () => {
      /*
       * The plan never read `liveScene` at all, so two scene rows with a fight
       * running between them read identically - the complaint this whole lane
       * came from. `ON THE TABLE` stands in place of `PLANNED` rather than
       * beside it: a running row's `combatants` is empty by resume's own
       * invariant, so the only other term is a count of what its roster WOULD
       * spawn, about a fight already being marked up on the glass.
       */
      seed([
        {
          ...base({ id: 's', name: 'Scene one', collapsed: true }),
          kind: 'scene',
          environmentRef: environment.id,
          roster: [{ ref: adversary.id, count: 1 }],
          adjustments: NO_ADJUSTMENTS,
          combatants: [],
        },
      ]);
      list();
      expect(text()).toContain('1 PLANNED');
      expect(text()).not.toContain('ON THE TABLE');

      useGm.setState({ liveScene: 's' });
      list();
      expect(text()).toContain('ON THE TABLE');
      expect(text()).not.toContain('1 PLANNED');
    });
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

  it('states a saved fight as a fact, because nothing here can put its marks back', () => {
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
    expect(text()).toContain('No control here brings those marks back');
    /*
     * This used to assert that no verb on the row said the word FIGHT at all,
     * which OPEN THE FIGHT now does. That string was never the point: what
     * cannot be restored is the *marks*, because no action in `gmStore` sets a
     * combatant list wholesale. OPEN THE FIGHT starts the plan again from full
     * HP, and on a row whose plan is empty there is nothing for it to start -
     * so it is disabled here, and the saved fight is still untouched afterwards.
     */
    const fight = named('OPEN THE FIGHT');
    expect(fight.disabled).toBe(true);
    click(fight);
    expect(useGm.getState().combatants).toEqual([]);
    const verbs = buttons()
      .filter((b) => b.getAttribute('aria-expanded') === null)
      .map((b) => (b.textContent ?? '').trim());
    expect(verbs.some((v) => v.includes('COMBATANT') || v.includes('MARK'))).toBe(false);
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
    click(named('PUT THIS ROSTER ON THE BOARD'));
    expect(useGm.getState().roster).toEqual([{ ref: adversary.id, count: 3 }]);
    expect(useGm.getState().adjustments.easier).toBe(true);
  });
});

/*
 * The three things the playtest GM asked the encounter row for.
 *
 * All three are about the row telling the truth about what the dice will do:
 * how many adversaries a count means, what the fight will actually contain, and
 * what every one of them adds to its damage. The first was wrong on the screen,
 * the second could only be reached through the builder, and the third was said
 * in the builder and nowhere a GM reads at the table.
 */
describe('the encounter row at the table', () => {
  const minion = dataset.adversaries.find((a) => a.role === 'Minion')!;

  const plan = (
    roster: Array<{ ref: string; count: number }>,
    adjustments = NO_ADJUSTMENTS,
  ): void => {
    seed([
      {
        ...base({ id: 'e', name: 'The ambush', collapsed: false }),
        kind: 'encounter',
        roster,
        adjustments,
        combatants: [],
      },
    ]);
  };

  /** Every tool this list was asked to open, in order. */
  let opened: string[];
  beforeEach(() => {
    opened = [];
  });
  const listWatching = (): void => {
    render(
      createElement(SessionList, {
        phone: true,
        onOpenTool: (tool) => {
          opened.push(tool);
        },
      }),
    );
  };

  const partyOf = (n: number): void => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartySize: n } });
  };

  // ③(a) -----------------------------------------------------------------

  it('reads a Minion count as groups the size of the party, not as a multiplier', () => {
    /*
     * `EncounterEntry.count` is groups for a Minion, each the size of the
     * party, and `ROLE_COST` charges 1 point for each of them. So `×3` beside a
     * Minion said three rats where the budget had been spent on fifteen, and
     * the builder had been printing "3 GROUPS OF 5" about the very same number.
     */
    partyOf(5);
    plan([{ ref: minion.id, count: 3 }]);
    list();
    expect(text()).toContain('3 GROUPS OF 5');
    expect(text(), 'the row still reads the groups as a multiplier').not.toContain('×3');
  });

  it('says GROUP, not GROUPS, for a single one', () => {
    partyOf(4);
    plan([{ ref: minion.id, count: 1 }]);
    list();
    expect(text()).toContain('1 GROUP OF 4');
    expect(text()).not.toContain('GROUPS');
  });

  it('control — an adversary that is not a Minion keeps its multiplier', () => {
    // Passes before and after the fix, and is here because the fix is one
    // branch away from turning every count on the row into groups.
    expect(adversary.role).not.toBe('Minion');
    plan([{ ref: adversary.id, count: 2 }]);
    list();
    expect(text()).toContain('×2');
    expect(text()).not.toContain('GROUP');
  });

  // ③(b) -----------------------------------------------------------------

  it('says what the damage bump adds, in the book’s own words, on the row', () => {
    plan([{ ref: adversary.id, count: 1 }], { easier: false, harder: false, damageBump: true });
    list();
    const bump = damageBumpRule(dataset.rules);
    expect(bump, 'the shipped dataset no longer carries the line').not.toBeNull();
    expect(text(), 'the dice are still only said inside the builder').toContain(bump!);
    // The chip names the switch; the dice come out of the dataset. The old chip
    // read "+1D4 (OR +2) TO ALL ADVERSARY DAMAGE" - a rule transcribed by hand,
    // and one that had already drifted from the SRD's "or a static +2".
    expect(text()).toContain('ADVERSARY DAMAGE BUMP');
    expect(text()).not.toContain('+1D4 (OR +2)');
  });

  it('does not say it on a row that was not built with it', () => {
    plan([{ ref: adversary.id, count: 1 }]);
    list();
    expect(text()).not.toContain(damageBumpRule(dataset.rules)!);
    expect(text()).not.toContain('ADVERSARY DAMAGE BUMP');
  });

  // ①(a) -----------------------------------------------------------------

  it('opens a stat block under the roster entry, with nothing on it that writes', () => {
    plan([{ ref: adversary.id, count: 2 }]);
    list();
    expect(text(), 'the stat block is open before anybody asked for it').not.toContain(
      adversary.attack.name,
    );

    const entry = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(adversary.name),
    )!;
    expect(entry.getAttribute('aria-expanded')).toBe('false');
    click(entry);

    expect(text()).toContain(adversary.attack.name);
    expect(text()).toContain(String(adversary.difficulty));
    // Read-only is a property of `AdversaryBlock` with no `action`, not a
    // promise: the entry's own disclosure is the only control inside the item.
    const item = entry.closest('li')!;
    expect([...item.querySelectorAll('button, input, select, textarea')]).toEqual([entry]);
    expect(useGm.getState().combatants).toEqual([]);
    expect(useGm.getState().roster).toEqual([]);

    click(entry);
    expect(text()).not.toContain(adversary.attack.name);
  });

  it('gives the preview a thumb-sized target and a name that is not just a number', () => {
    plan([{ ref: adversary.id, count: 2 }]);
    list();
    const entry = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(adversary.name),
    )!;
    // Declared inline, because that is the only place jsdom can read it.
    expect(entry.style.minHeight).toBe('var(--tap)');
    // A night with three encounter rows draws this button many times over.
    expect(entry.getAttribute('aria-label')).toBe(`${adversary.name} — ×2 — The ambush`);
  });

  it('has nothing to open for a ref this dataset cannot resolve', () => {
    plan([{ ref: 'the-gnawing', count: 1 }]);
    list();
    expect(text()).toContain('the-gnawing');
    expect(buttons().some((b) => (b.getAttribute('aria-label') ?? '').startsWith('the-gnawing')))
      .toBe(false);
  });

  // ①(b) -----------------------------------------------------------------

  it('opens the fight from the row, with the roster the row was planned with', () => {
    plan([{ ref: adversary.id, count: 2 }]);
    listWatching();
    click(named('OPEN THE FIGHT'));

    const combatants = useGm.getState().combatants;
    expect(combatants).toHaveLength(2);
    expect(combatants.every((c) => c.adversaryRef === adversary.id)).toBe(true);
    // `spawn` derives an id from an index; two of the same adversary must not
    // collide, or the scene draws one card for both.
    expect(new Set(combatants.map((c) => c.id)).size).toBe(2);
    expect(opened, 'the row spawned the fight and stayed where it was').toEqual(['scene']);
  });

  it('sends a Minion entry as groups of the party, the way the builder does', () => {
    partyOf(5);
    plan([{ ref: minion.id, count: 2 }]);
    listWatching();
    click(named('OPEN THE FIGHT'));

    const combatants = useGm.getState().combatants;
    expect(combatants).toHaveLength(2);
    expect(combatants.map((c) => c.minionsRemaining)).toEqual([5, 5]);
  });

  it('leaves the board’s roster and adjustments exactly where they were', () => {
    /*
     * The one thing this button is deliberately not built on. Folding
     * `putOnBoard` into it would mean one tap quietly overwriting a roster the
     * GM was in the middle of assembling in the builder - the same shape of
     * defect as a control that silently drops a saved fight.
     */
    useGm.setState({
      roster: [{ ref: 'the-gnawing', count: 9 }],
      adjustments: { easier: true, harder: false, damageBump: false },
    });
    plan([{ ref: adversary.id, count: 1 }], { easier: false, harder: true, damageBump: true });
    listWatching();
    click(named('OPEN THE FIGHT'));

    expect(useGm.getState().roster).toEqual([{ ref: 'the-gnawing', count: 9 }]);
    expect(useGm.getState().adjustments).toEqual({
      easier: true,
      harder: false,
      damageBump: false,
    });
    expect(useGm.getState().combatants).toHaveLength(1);
  });

  it('will not open a fight it has no stat block to fill', () => {
    // A roster of refs this dataset cannot resolve would open an empty scene
    // and look like it had worked.
    plan([{ ref: 'the-gnawing', count: 2 }]);
    listWatching();
    const fight = named('OPEN THE FIGHT');
    expect(fight.disabled).toBe(true);
    click(fight);
    expect(useGm.getState().combatants).toEqual([]);
    expect(opened).toEqual([]);
  });

  it('says the scene is not empty before it adds to it', () => {
    useGm.setState({
      combatants: [
        { id: 'x-0', adversaryRef: adversary.id, name: adversary.name, hp: { marked: 3, max: 8 }, stress: { marked: 0, max: 3 }, thresholds: [8, 15], difficulty: 14, spotlighted: false, notes: '' },
      ],
    });
    plan([{ ref: adversary.id, count: 1 }]);
    list();
    expect(text()).toContain('The scene already holds 1 adversary');
    expect(text()).toContain('adds this roster to them');
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
      sceneId: null,
      countdown: { id: 'c', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE },
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

  it('carries the SRD’s advancement chart on a dynamic clock, and not on a loop', () => {
    /*
     * Presence, which is what this file is for. `countdownArm.test.tsx` holds
     * the rest of it - the six pressable cells, the four printed ones, which
     * clock a cell moves and which way - and the reason the assertion here is
     * a fold rather than a table is that the fold is the whole gesture: the
     * chart is five `--tap` rows and a column header behind one shut
     * disclosure, on a row that is already inside a scroller.
     */
    seed([
      ...countdown(),
      { ...base({ id: 'c2', name: 'The tide', collapsed: false }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c2', name: 'The tide', kind: 'loop', start: 4, value: 4, notes: '', ...NO_CLOCK_PROSE } },
    ]);
    list();
    const chart = buttons().filter((b) => (b.textContent ?? '').trim().startsWith('ADVANCE BY A ROLL'));
    expect(chart).toHaveLength(1);
    expect(chart[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(text(), 'the chart is drawn shut, not drawn open').not.toContain('Tick down 3');
    click(chart[0]!);
    expect(text()).toContain('Tick down 3');
  });

  it('pins exactly one countdown to the top bar', () => {
    seed([
      ...countdown(),
      { ...base({ id: 'c2', name: 'The tide', collapsed: false }), kind: 'countdown', primary: true, sceneId: null, countdown: { id: 'c2', name: 'The tide', kind: 'loop', start: 4, value: 4, notes: '', ...NO_CLOCK_PROSE } },
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
    seed([{ ...base({ id: 's', name: 'Scene one', collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT }]);
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

  it('says which row every control in an open arm belongs to, not just DELETE', () => {
    /*
     * The row already argued this for DELETE, MOVE UP, MOVE DOWN and the drag
     * handle - "a list of identical DELETE buttons is a list a screen reader
     * cannot tell apart" - and then the arms made exactly the same list one
     * level down. A planned night with two scenes and two countdowns in it drew
     * OPEN THE SCENE, PUT THIS ENVIRONMENT ON THE BOARD, RESET, PIN IT TO THE TOP BAR and
     * OPEN FEAR AND COUNTDOWNS twice each, with nothing to choose between them,
     * on the one screen whose whole point is an ordered list of similar rows.
     *
     * Asserted over the whole list rather than over a chosen few, because the
     * next arm somebody writes gets the property for free or fails here.
     */
    seed([
      { ...base({ id: 's1', name: 'The Sablewood gate', order: 0, collapsed: false }), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT },
      { ...base({ id: 's2', name: 'The frozen ford', order: 1, collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'e1', name: 'The ambush', order: 2, collapsed: false }), kind: 'encounter', roster: [{ ref: adversary.id, count: 2 }], adjustments: NO_ADJUSTMENTS, combatants: [] },
      { ...base({ id: 'e2', name: 'The bridge', order: 3, collapsed: false }), kind: 'encounter', roster: [{ ref: adversary.id, count: 1 }], adjustments: NO_ADJUSTMENTS, combatants: [] },
      { ...base({ id: 'c1', name: 'The ritual', order: 4, collapsed: false }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c1', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE } },
      { ...base({ id: 'c2', name: 'The tide', order: 5, collapsed: false }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c2', name: 'The tide', kind: 'loop', start: 4, value: 4, notes: '', ...NO_CLOCK_PROSE } },
      // A *second* dynamic clock, and it is here rather than in the pair
      // above because the pair above cannot see the defect: the advancement
      // chart is offered on a dynamic row and on no other, so one dynamic and
      // one loop draw one ADVANCE BY A ROLL header between them and any two
      // identical headers stay hidden. `Fold` names its button with the words
      // it draws, and both of these draw the same three words.
      { ...base({ id: 'c3', name: 'The flood', order: 6, collapsed: false }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c3', name: 'The flood', kind: 'dynamic', start: 6, value: 5, notes: '', ...NO_CLOCK_PROSE } },
      { ...base({ id: 'l1', name: 'The grove', order: 7, collapsed: false }), kind: 'link', target: { kind: 'environment', ref: environment.id } },
      { ...base({ id: 'l2', name: 'The other grove', order: 8, collapsed: false }), kind: 'link', target: { kind: 'environment', ref: dataset.environments[1]!.id } },
    ]);
    list();

    const controls = [...container.querySelectorAll('button, select')];
    const names = controls.map(
      (el) => el.getAttribute('aria-label') ?? (el.textContent ?? '').trim(),
    );
    const duplicated = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    expect(
      duplicated,
      'two controls in this list answer to the same name, on a screen made of similar rows',
    ).toEqual([]);
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

  /**
   * Everything a finger lands on, which is not the set `buttons()` returns.
   *
   * The floor sweep below asked `querySelectorAll('button')`, then
   * `'button, a'`, and both were one file's guess at a set nobody had read off
   * the DOM. `UrlArm`'s OPEN IN A NEW TAB is an `<a className="btn">` carrying
   * a `minHeight: 44` of its own, and it was invisible twice over: `oneOfEach`
   * drew no `url` row either, so the anchor was never on the swept screen. The
   * widening that fixed it was justified by calling that anchor the only
   * non-`<button>` control on this screen, and it was not - `SceneArm`'s
   * environment `<select>` declares `var(--tap)`, and the scene row that draws
   * it has been in `oneOfEach` from the beginning.
   *
   * So the selector names every tag that can carry a control, and
   * `floorsOutsideTheSweep` below closes the loop from the other end.
   */
  const targets = (): HTMLElement[] => [
    ...container.querySelectorAll<HTMLElement>('button, a, select, input, textarea, summary'),
  ];

  /**
   * Every element declaring a minimum height that `targets()` cannot reach.
   *
   * The counterpart to widening the selector, and the reason the next
   * non-`<button>` control cannot hide the way the select did: this reads the
   * declared floors off the rendered screen rather than off a sentence, so a
   * control added in any file turns up here whatever tag it is drawn with.
   *
   * Asserted as an exact list rather than as empty, because one element on this
   * screen declares a minimum height and is legitimately not a target.
   * `DomainCardView` gives a card being read a floor so that a row of cards
   * ends level, and the `card` link arm draws it with no `onOpen`, so it
   * carries no button at all. Anything else that appears in this list is a
   * control the floor sweep is not looking at.
   */
  const floorsOutsideTheSweep = (): string[] => {
    const swept = new Set(targets());
    return [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => px(el.style.minHeight) > 0 && !swept.has(el))
      .map((el) => `${el.tagName} ${el.style.minHeight}`);
  };

  const openEverything = (): void => {
    seed([
      // The countdown is pinned, so the top bar draws its third row too: the
      // sweep has to cover the pinned chrome as well as the list under it.
      ...oneOfEach().map((i) => ({ ...i, collapsed: false, ...(i.kind === 'countdown' ? { primary: true } : {}) })),
      { ...base({ id: 'l2', name: 'The burrower', collapsed: false }), kind: 'link', target: { kind: 'adversary', ref: adversary.id } },
      { ...base({ id: 'l3', name: 'The grove', collapsed: false }), kind: 'link', target: { kind: 'environment', ref: environment.id } },
      { ...base({ id: 'l4', name: 'A card', collapsed: false }), kind: 'link', target: { kind: 'domainCard', ref: card.id } },
      // The row that puts the borrowed anchor on the screen. Not the only
      // non-`<button>` control here - `SceneArm`'s environment select is the
      // other, and it needs no row of its own, because the scene row in
      // `oneOfEach` above has always drawn one.
      { ...base({ id: 'u1', name: 'The map board', collapsed: false }), kind: 'url', href: 'https://example.com/board' },
    ]);
    useGm.setState({ combatants: [], liveScene: null });
    render(createElement(Gm));
    /*
     * The one thing on this screen that is open and still not in the DOM. The
     * countdown arm's advancement chart is behind a `Fold` that starts shut,
     * so with every row open its six cells are still unrendered - and a sweep
     * that never sees them is a sweep that would have gone green on a chart
     * whose cells declared nothing at all. Opened here so both rules below
     * cover it: the cells are targets, and the chart's grid declares no width
     * of its own, which is the second rule's whole question.
     */
    const charts = buttons().filter((b) =>
      (b.textContent ?? '').trim().startsWith('ADVANCE BY A ROLL'),
    );
    expect(charts, 'no advancement chart on the screen for the sweep to open').toHaveLength(1);
    for (const fold of charts) click(fold);
    /*
     * And the cells actually arrived. Both rules below are a filter down to
     * the violators followed by an assertion that the list is empty, which is
     * a shape that passes over an empty population just as well as over a
     * clean one - so the population is asserted here, once, for both of them.
     * Without this the loop above could open nothing and both sweeps would
     * stay green.
     */
    expect(
      buttons().filter((b) => (b.getAttribute('aria-label') ?? '').includes(' — advance by ')),
      'the fold opened but no chart cell reached the DOM',
    ).toHaveLength(6);
    /*
     * And the borrowed anchor arrived, asserted for the same reason and not
     * folded into the count above: `url` is the one kind whose control this
     * fixture has to carry deliberately, and a fixture that stopped drawing it
     * would take the anchor out of both sweeps without either going red.
     */
    expect(
      [...container.querySelectorAll('a')],
      'no anchor on the screen for the floor sweep to cover',
    ).toHaveLength(1);
    /*
     * And the selects, asserted separately again for the same reason. They are
     * the controls here that are not `<button>`s, they arrive on the rows
     * `oneOfEach` seeds rather than on rows added for them, and a fixture that
     * stopped seeding one would take it out of both sweeps without either
     * going red.
     *
     * TWO since decision 18: the scene row's ENVIRONMENT, and the countdown
     * row's BELONGS TO. The count is pinned rather than loosened to "at least
     * one" because the point of this assertion is that the fixture still
     * carries every non-button control the sweeps below have to cover.
     */
    expect(
      [...container.querySelectorAll('select')].map((el) => el.getAttribute('aria-label')),
      'a select the floor sweep covers is no longer on the screen',
    ).toEqual(['ENVIRONMENT — Scene one', 'BELONGS TO — The ritual']);
  };

  it('has no target under the touch floor', () => {
    openEverything();
    /*
     * The selector before the floors. A control declaring a minimum height
     * that this sweep cannot reach is a control it cannot hold, and shrinking
     * one leaves the assertion below green - which is exactly what the
     * environment select did under `button, a`.
     */
    expect(
      floorsOutsideTheSweep(),
      'these declare a minimum height and the sweep does not reach them',
    ).toEqual(['DIV 200px']);
    const small = targets()
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

// ---------------------------------------------------------------------------

/**
 * Decision 6 of `docs/handoff/DECISIONI-2026-08-18.md`, both halves.
 *
 * *Numbers on the type row, not on the name*, and a rename before them. The
 * header used to reserve 130px on the right for `describeItem`'s line, so the
 * one string on this screen a GM chose themselves was ellipsised to make room
 * for "4/6" - and the number sat against the name as though it belonged to it.
 */
describe('the type row carries the numbers, and the name has the header to itself', () => {
  /** The two-line stack inside a row's disclosure: the name, then the type row. */
  const headerStack = (li: HTMLLIElement): HTMLElement =>
    li.querySelector<HTMLElement>('button[aria-expanded] > span.stack')!;

  it('draws the name and the type row, and nothing else, beside the marker', () => {
    seed(oneOfEach());
    list();
    const header = rows()[3]!.querySelector<HTMLElement>('button[aria-expanded]')!;
    // Both halves of "nothing else". The summary used to be a third column of
    // the header, a *sibling* of the stack - so a test that only counts the
    // stack's children cannot see it come back. The header holds the marker and
    // the stack and nothing more; the stack holds the name and the type row.
    expect(header.children, 'the header grew a column beside the stack').toHaveLength(2);
    expect(header.children[1], 'the stack is no longer the marker’s only sibling').toBe(
      headerStack(rows()[3]!),
    );
    const stack = headerStack(rows()[3]!);
    expect(stack.children, 'the header grew a third line or lost one').toHaveLength(2);
  });

  it('puts nothing but the name on the name’s line', () => {
    seed(oneOfEach());
    list();
    // The countdown row, because its summary is the shortest number on this
    // screen and the one most likely to be tucked in beside a name.
    const stack = headerStack(rows()[3]!);
    expect(stack.children[0]!.textContent).toBe('The ritual');
    expect(stack.children[0]!.textContent, 'the number is stuck to the name again').not.toContain(
      '4/6',
    );
  });

  it('puts the number on the type row, opposite the kind word', () => {
    seed(oneOfEach());
    list();
    const typeRow = headerStack(rows()[3]!).children[1]!;
    expect(typeRow.textContent).toContain('COUNTDOWN');
    expect(typeRow.textContent, 'the summary left the type row').toContain('4/6');
  });

  it('holds for every arm, not for the one that was looked at', () => {
    seed(oneOfEach());
    list();
    const expected = [
      [environment.name.toUpperCase(), 'SCENE'],
      ['2 PLANNED', 'ENCOUNTER'],
      [rule.title.toUpperCase(), 'LINK'],
      ['4/6', 'COUNTDOWN'],
      ['KEPT, NOT READ', 'UNREADABLE ITEM'],
    ];
    rows().forEach((li, i) => {
      const [summary, kind] = expected[i]!;
      const stack = headerStack(li);
      expect(stack.children[1]!.textContent, `row ${String(i)} lost its kind word`).toContain(kind);
      expect(stack.children[1]!.textContent, `row ${String(i)} lost its summary`).toContain(summary);
      expect(
        stack.children[0]!.textContent,
        `row ${String(i)} has a number stuck to its name`,
      ).not.toContain(summary);
    });
  });

  it('keeps the whole summary reachable when the line ellipsises it', () => {
    // One line, because a shut row's height has to be a constant and a summary
    // a GM typed has no length limit - see `SessionRow.tsx`, which measures the
    // header's text at 30.00 inside a 44.00 floor. ("Nine rows fit on a phone"
    // stood here and was never the count; it never spent the two `.panel`
    // borders every row carries.) So the string that does not fit is on `title`.
    seed(oneOfEach());
    list();
    const typeRow = headerStack(rows()[0]!).children[1]!;
    const summary = typeRow.children[1] as HTMLElement;
    expect(summary.title).toBe(environment.name.toUpperCase());
    expect(summary.style.whiteSpace).toBe('nowrap');
    expect(summary.style.textOverflow).toBe('ellipsis');
  });
});

// ---------------------------------------------------------------------------

/**
 * The other half of decision 6: the name was the one thing on this row that
 * nothing could change.
 *
 * `AddSheet` types it once and the rows a countdown or an unreadable record
 * mints never had one at all, so a night filled up with rows called "Scene",
 * "Scene" and "Scene" with no way back to them. The control is `NameField`,
 * which the character rename in `Edit.tsx` also calls - what is asserted here
 * is the *door*: which record it writes, which words it uses for an empty
 * name, and that arming it does not move the row under the thumb.
 */
describe('renaming a row', () => {
  const oneScene = (patch: Partial<SessionItemBase> = {}): void => {
    seed([
      {
        ...base({ id: 's', name: 'Scene one', collapsed: false, ...patch }),
        kind: 'scene',
        environmentRef: null,
        ...NO_FIGHT,
      },
    ]);
    list();
  };

  const field = (): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('input[type="text"]')!;
  const save = (): HTMLButtonElement =>
    buttons().find((b) => (b.textContent ?? '').trim() === 'SAVE')!;
  const cancel = (): HTMLButtonElement =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Leave the name as'))!;
  const stored = (): string => useGm.getState().session[0]!.name;
  const footer = (): string[] =>
    buttons()
      .map((b) => (b.textContent ?? '').trim())
      .filter((t) => ['RENAME', 'MOVE UP', 'MOVE DOWN', 'DELETE', 'SAVE'].includes(t));

  it('is a verb in the open row, and says which row it is about', () => {
    seed(oneOfEach().map((i) => ({ ...i, collapsed: false })));
    list();
    const names = buttons()
      .filter((b) => (b.textContent ?? '').trim() === 'RENAME')
      .map((b) => b.getAttribute('aria-label'));
    expect(names).toHaveLength(5);
    expect(names).toContain('RENAME — Scene one');
    // The row with no name of its own is named after the word the list draws
    // for it, because "RENAME — " announces as nothing at all.
    expect(names).toContain('RENAME — Unreadable item');
  });

  it('is not offered on a shut row, which has no footer at all', () => {
    oneScene({ collapsed: true });
    expect(footer(), 'a shut row grew a footer').toEqual([]);
  });

  it('replaces the footer rather than opening above it', () => {
    /*
     * An open encounter row is taller than a 393px phone, so a field drawn
     * beside the name would open off the top of the screen for the person who
     * just tapped for it. It lands where the thumb already is instead, and the
     * destructive verb leaves the band while a name is being typed.
     */
    oneScene();
    expect(footer()).toEqual(['RENAME', 'MOVE UP', 'MOVE DOWN', 'DELETE']);
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    expect(footer(), 'the footer stayed on the screen beside the field').toEqual(['SAVE']);
    expect(field().value, 'the field did not start at the stored name').toBe('Scene one');
  });

  it('declares the touch floor on everything the field draws', () => {
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    // Inline, because jsdom reads only inline styles: a height from a class
    // measures 0 here.
    expect(field().style.minHeight).toBe('var(--tap)');
    expect(save().style.minHeight).toBe('var(--tap)');
    expect(cancel().style.minHeight).toBe('var(--tap)');
    expect(cancel().style.minWidth).toBe('var(--tap)');
  });

  it('writes nothing while the name is being typed, and writes it on SAVE', () => {
    // `patchSessionItem` goes through `commit`, so a keystroke rename would be
    // one debounced campaign write per letter.
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    for (const partial of ['T', 'The', 'The gate']) {
      type(field(), partial);
      expect(stored(), `the record was written after typing "${partial}"`).toBe('Scene one');
    }
    click(save());
    expect(stored()).toBe('The gate');
    expect(footer(), 'the footer did not come back after a commit').toContain('RENAME');
    expect(text()).toContain('The gate');
  });

  it('trims what it writes, and commits on Enter', () => {
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    type(field(), '  The gate  ');
    press(field(), 'Enter');
    expect(stored()).toBe('The gate');
  });

  it('leaves the name alone on the ✕ and on Escape', () => {
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    type(field(), 'The gate');
    click(cancel());
    expect(stored()).toBe('Scene one');
    expect(footer()).toContain('RENAME');

    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    // The field is mounted fresh each time, so the draft the ✕ abandoned is
    // not what the next rename opens on.
    expect(field().value, 'the abandoned draft came back with the field').toBe('Scene one');
    type(field(), 'The gate');
    press(field(), 'Escape');
    expect(stored()).toBe('Scene one');
    expect(footer()).toContain('RENAME');
  });

  it('offers the kind word for an empty name, not the character sheet’s "Unnamed"', () => {
    /*
     * `sessionTitle` stands the kind word in for an empty name and marks it as
     * invented so the row can draw it dimmed and never write it back. The
     * field has to say the same word, or clearing it would promise a row
     * reading "Unnamed" - which is what a *character* reads as, and a word
     * this list never prints.
     */
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    expect(field().placeholder).toBe('Scene');
    expect(field().placeholder).not.toBe('Unnamed');
    expect(cancel().getAttribute('aria-label')).toBe('Leave the name as Scene one');

    type(field(), '  ');
    expect(save().getAttribute('aria-label')).toBe('Save the name Scene — Scene one');
    // Clearing the field moves the placeholder and SAVE and nothing else. The
    // cancel target is built from the *stored* name, not from the draft,
    // because what leaving the field alone leaves is the name already on the
    // record - so it still says "Scene one" with an empty field under it.
    expect(field().placeholder).toBe('Scene');
    expect(
      cancel().getAttribute('aria-label'),
      'the cancel target followed the draft instead of the record',
    ).toBe('Leave the name as Scene one');
    click(save());
    expect(stored(), 'a word the GM never typed was written onto the record').toBe('');
    expect(text()).toContain('Scene');
  });

  it('names the kind word on the cancel target only when the row has no name', () => {
    /*
     * `emptyReads` reaches three places and they are not the same place. The
     * placeholder and SAVE follow the draft; the cancel target follows the
     * record, because "leave the name as" is about what is stored. On a row
     * that never had a name the two coincide - the record's name *is* the kind
     * word - and that coincidence is what makes the docblock easy to misread.
     */
    oneScene({ name: '' });
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    expect(field().value, 'the field opened on the invented word').toBe('');
    expect(field().placeholder).toBe('Scene');
    expect(cancel().getAttribute('aria-label')).toBe('Leave the name as Scene');
    expect(save().getAttribute('aria-label')).toBe('Save the name Scene — Scene');
    // And it still follows the record once something is typed: the cancel
    // target is the way back to the nameless row, not a preview of the draft.
    type(field(), 'The gate');
    expect(cancel().getAttribute('aria-label')).toBe('Leave the name as Scene');
    expect(save().getAttribute('aria-label')).toBe('Save the name The gate — Scene');
  });

  /*
   * What `subject` is and is not, in the two tests below.
   *
   * It appends the row's drawn name to SAVE, so two rows renaming at once say
   * which record each of them would write to. For a row nobody named, that
   * drawn name is the kind word - so two nameless scenes offer a screen reader
   * the same sentence twice, which is exactly the "Scene", "Scene" and "Scene"
   * list `SessionRow` is about. Both halves are pinned so the prop's docblock
   * cannot quietly claim more than the second one allows again.
   */
  const twoScenes = (a: string, b: string): void => {
    seed([
      { ...base({ id: 'a', name: a, order: 0, collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'b', name: b, order: 1, collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
    ]);
    list();
    for (const button of buttons().filter((x) => (x.textContent ?? '').trim() === 'RENAME')) {
      click(button);
    }
  };
  const saveNames = (): (string | null)[] =>
    buttons()
      .filter((b) => (b.textContent ?? '').trim() === 'SAVE')
      .map((b) => b.getAttribute('aria-label'));

  it('says which row each open SAVE would write to', () => {
    twoScenes('The bridge', 'The ford');
    expect(saveNames()).toEqual([
      'Save the name The bridge — The bridge',
      'Save the name The ford — The ford',
    ]);
  });

  it('cannot tell two renaming rows apart when neither has a name', () => {
    twoScenes('', '');
    expect(saveNames()).toEqual(['Save the name Scene — Scene', 'Save the name Scene — Scene']);
  });

  it('refuses nothing, because a night is allowed two rows with one name', () => {
    /*
     * No `judge` is passed, and this is what that decision looks like from the
     * outside. `judgeName`'s sentences are about the header's `<select>` of
     * characters; a GM who wants two rows called "The ambush" is not making a
     * mistake, and an empty name is how three of the four kinds arrive.
     */
    seed([
      { ...base({ id: 'a', name: 'The ambush', order: 0, collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'b', name: 'The bridge', order: 1, collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
    ]);
    list();
    click(buttons().find((b) => (b.getAttribute('aria-label') ?? '') === 'RENAME — The bridge')!);
    type(field(), 'The ambush');
    expect(container.querySelector('[role="status"]'), 'a live region that can never speak').toBeNull();
    expect(save().disabled).toBe(false);
    click(save());
    expect(useGm.getState().session.map((i) => i.name)).toEqual(['The ambush', 'The ambush']);
  });

  it('empties the whole band while DELETE is armed, so the armed target does not move', () => {
    /*
     * Measured in Chrome at 393px with the shipped IBM Plex Mono: RENAME 62 +
     * MOVE UP 69 + MOVE DOWN 83 + DELETE 62 lay out on one 44px line inside the
     * footer's 349px. DELETE armed is "TAP AGAIN TO DELETE" at 153, and the
     * four then measure 391 and wrap - which drops the armed button 52px, out
     * from under the finger that has four seconds to press it again.
     *
     * Decision 18 added a fourth wording and pushed the same defect one step
     * further. A scene row holding a parked fight arms to "TAP AGAIN TO DELETE
     * THE FIGHT" - 29 characters, ~223px at the 7.0px per character this
     * footer's own two measured points give - and 69 + 83 + 223 is 375 of 349,
     * which wraps with the move verbs alone. So they leave too, beside RENAME,
     * and the rule is UNCONDITIONAL: the shape of this footer must not depend
     * on whether the row happens to be holding a fight, which is state the GM
     * is not looking at while their thumb is over the button.
     */
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'DELETE')!);
    expect(text()).toContain('TAP AGAIN TO DELETE');
    expect(
      footer(),
      'a verb stayed beside the armed button, which is what pushes it onto a second line',
    ).toEqual([]);
  });

  it('says it is deleting a fight when the row is holding one', () => {
    /*
     * The third arm of the armed wording, decision 18. Every other row in this
     * list can be rebuilt from the dataset; a scene row holding a parked fight
     * holds HP and Stress marks that exist nowhere else once the row is gone -
     * the same reason the `unreadable` row gets its own sentence.
     */
    seed([
      {
        ...base({ id: 's', name: 'Scene one', collapsed: false }),
        kind: 'scene',
        environmentRef: null,
        roster: [],
        adjustments: NO_ADJUSTMENTS,
        combatants: [
          {
            id: `${adversary.id}-0`,
            adversaryRef: adversary.id,
            name: adversary.name,
            hp: { max: 6, marked: 4 },
            stress: { max: 3, marked: 1 },
            thresholds: [4, 8] as [number, number],
            difficulty: 12,
            spotlighted: false,
            notes: '',
          },
        ],
      },
    ]);
    list();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'DELETE')!);
    expect(text()).toContain('TAP AGAIN TO DELETE THE FIGHT');
  });

  it('says the ordinary thing on a scene row with nothing parked in it', () => {
    seed([
      { ...base({ id: 's', name: 'Scene one', collapsed: false }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
    ]);
    list();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'DELETE')!);
    expect(text()).toContain('TAP AGAIN TO DELETE');
    expect(text()).not.toContain('THE FIGHT');
  });

  it('abandons a rename when the row is shut, rather than hiding the field', () => {
    // `armed` clears itself after four seconds; this does not. A row shut
    // mid-rename and reopened would otherwise come back with a field over its
    // footer - and `collapsed` is on the record, so it could come back on
    // another device.
    oneScene();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    type(field(), 'The gate');
    click(container.querySelector('button[aria-expanded]')!);
    click(container.querySelector('button[aria-expanded]')!);
    expect(footer(), 'the row reopened still renaming').toContain('RENAME');
    expect(stored()).toBe('Scene one');
  });

  it('renames both copies of a countdown’s name, because three screens draw them', () => {
    /*
     * `addCountdown` writes one typed string into `item.name` and into
     * `item.countdown.name` - the row's header reads the first, `countdownsOf`
     * hands the second to the countdowns board, to this arm's own two buttons
     * and to the pinned line in the top bar. Renaming only the row would leave
     * one countdown called two things on three screens, which is the exact
     * defect the store avoids by giving the row and the countdown one id.
     */
    seed([
      {
        ...base({ id: 'c', name: 'The ritual', collapsed: false }),
        kind: 'countdown',
        primary: true,
        sceneId: null,
        countdown: { id: 'c', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE },
      },
    ]);
    list();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    type(field(), 'The gate falls');
    click(save());

    const item = useGm.getState().session[0]!;
    expect(item.name).toBe('The gate falls');
    expect(
      item.kind === 'countdown' && item.countdown.name,
      'the countdown the board draws still answers to the old name',
    ).toBe('The gate falls');
    // `commit` rederives this from `session`, and it is what the board and the
    // pinned top-bar line actually read.
    expect(useGm.getState().countdowns[0]!.name).toBe('The gate falls');
    expect(
      buttons().some((b) => (b.getAttribute('aria-label') ?? '').includes('Advance The gate falls')),
      'the arm’s own advance button still announces the old name',
    ).toBe(true);
  });

  it('renames a row this build cannot read without touching its bytes', () => {
    // The one row in the app whose contents exist nowhere else. `AddSheet` can
    // never have given it a name, so it is the row that most needs one - and
    // `patchSessionItem` must not be a way to lose `raw`.
    seed([
      {
        ...base({ id: 'u', name: '', collapsed: false }),
        kind: 'unreadable',
        why: 'this version of the app has no "photo" item',
        raw: '{"kind":"photo","blob":"AAAA"}',
      },
    ]);
    list();
    click(buttons().find((b) => (b.textContent ?? '').trim() === 'RENAME')!);
    expect(field().placeholder).toBe('Unreadable item');
    type(field(), 'The photo Giorgio sent');
    click(save());
    const item = useGm.getState().session[0]!;
    expect(item.name).toBe('The photo Giorgio sent');
    expect(item.kind).toBe('unreadable');
    expect(item.kind === 'unreadable' && item.raw).toBe('{"kind":"photo","blob":"AAAA"}');
  });
});

/*
 * The last two describes in this file, one per kind, and they are two rather
 * than one on purpose.
 *
 * They were one - `the two rows campaign schema 2 added` - over a fixture that
 * built a `url` row and a `note` row together. The two screens are two separate
 * lanes, so that shape had both lanes rewriting one describe over one shared
 * fixture, in work that has nothing else in common. A describe and a fixture
 * each is a merge.
 */

describe('the web link row campaign schema 2 added', () => {
  const urlRow = (): SessionItem[] => [
    { ...base({ id: 'u', name: 'The map board', order: 0, collapsed: false }), kind: 'url', href: 'https://xn--pple-43d.com/board' },
  ];

  it('draws a row rather than an empty one', () => {
    seed(urlRow());
    list();
    expect(rows()).toHaveLength(1);
    expect(text()).toContain('The map board');
  });

  it('shows the address in the punycode the parser produced, opened and shut', () => {
    // Mitigation 5 reaching glass. `xn--pple-43d.com` is what `аpple.com` with
    // a Cyrillic а normalises to, and the whole defence against a homograph is
    // that no surface decodes it back.
    seed(urlRow());
    list();
    expect(text()).toContain('xn--pple-43d.com/board');
    expect(text()).not.toContain('аpple.com');
  });

  it('opens the address in a new tab, and carries the rel that makes that safe', () => {
    /*
     * This replaces 'offers no anchor yet, and says so rather than looking
     * broken', which pinned the interim state deliberately: the address was
     * stored, exported and read back, and nothing tapped. The anchor exists
     * now, so the assertion moves to the properties that make it safe rather
     * than being deleted with the sentence it was holding.
     *
     * `target` and `rel` are asserted together and by value. They are what
     * `externalLinkAttrs` carries, and a `_blank` without `noopener` hands the
     * opened page a live `window.opener` back into this app.
     */
    seed(urlRow());
    list();
    const anchor = container.querySelector('a');
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(text()).toContain('Nothing here opens on its own');
  });

  it('draws no anchor for a row whose address the reader refused', () => {
    /*
     * The empty-href state is not reachable from the ADD sheet - SUBMIT is
     * disabled while the address is refused - but it is reachable from a
     * campaign somebody sent, which is the case this row exists to survive.
     * A dead `<a>` is a control that looks tappable and is not, so there must
     * be none, and the reader's sentence stands in its place.
     */
    seed([{ ...urlRow()[0]!, kind: 'url', href: '' }]);
    list();
    expect(container.querySelector('a')).toBeNull();
    expect(text()).toContain('no web address on it');
  });
});

describe('the note row campaign schema 2 added', () => {
  const noteRow = (): SessionItem[] => [
    { ...base({ id: 'n', name: 'If they parley', order: 0, collapsed: false }), kind: 'note', note: [
      { type: 'heading', align: 'center', spans: [{ text: 'Terms', bold: true, italic: false }] },
      { type: 'paragraph', align: 'start', spans: [{ text: 'Rhys wants the cargo.', bold: false, italic: false }] },
    ] },
  ];

  it('draws a row rather than an empty one', () => {
    seed(noteRow());
    list();
    expect(rows()).toHaveLength(1);
    expect(text()).toContain('If they parley');
  });

  it('draws the note as text, with its blocks kept apart', () => {
    seed(noteRow());
    list();
    // `plainTextOf`, which is text by construction: no markup is built from a
    // note anywhere in this app, and that absence is the whole defence.
    expect(text()).toContain('Terms');
    expect(text()).toContain('Rhys wants the cargo.');
    expect(text()).not.toContain('**Terms**');
  });
});

/*
 * ---------------------------------------------------------------------------
 * The memo, proved by counting renders
 * ---------------------------------------------------------------------------
 *
 * A `React.memo` whose props are rebuilt on every render skips nothing, and it
 * passes a `$$typeof` check exactly as well as a working one does. This list
 * had that defect waiting for it: `handle={drag.handleProps(item, i)}` minted
 * a fresh object literal per row per render, and `SessionRow` subscribed to
 * the whole `session` array, which no memo can gate because a store read is
 * not a prop. So both were fixed, and both are held here by a count of what
 * actually re-rendered rather than by asking whether `memo` was called.
 *
 * The counter is the `describeItem` wrapper at the head of this file: one call
 * per row render, unconditionally, on every arm.
 *
 * It is not a performance test. It is a test that a change to one row of the
 * night is a change to one row of the night, which is the property the whole
 * plan list is about to depend on: once a fight lives on its scene row, an HP
 * mark rebuilds `session`, and without this every mark would repaint every row
 * under a thumb that is tapping a number.
 */
describe('what a change to one row costs the rest of the list', () => {
  const three = (): SessionItem[] => [
    { ...base({ id: 'a', name: 'The gate', order: 0 }), kind: 'scene', environmentRef: environment.id, ...NO_FIGHT },
    { ...base({ id: 'b', name: 'The bridge', order: 1 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
    { ...base({ id: 'c', name: 'The keep', order: 2 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
  ];

  /** Derived from the seed, so the expectation cannot drift from the fixture. */
  const ids = (items: SessionItem[]): string[] => items.map((i) => i.id);

  it('draws every row once on the first paint, which is what makes the count mean anything', () => {
    // The guard against a vacuous pass: if the counter never fired, every
    // assertion below would read as "nothing re-rendered" and be worthless.
    const items = three();
    seed(items);
    list();
    expect(drawn).toEqual(ids(items));
  });

  it('re-renders only the row that changed, and leaves the others alone', () => {
    const items = three();
    seed(items);
    list();
    drawn.length = 0;

    act(() => {
      useGm.getState().patchSessionItem('b', { name: 'The broken bridge' });
    });

    // Not "fewer than three". Exactly the one row whose record changed, named,
    // so that a memo which starts skipping the WRONG row fails here too.
    expect(drawn).toEqual(['b']);
    expect(text()).toContain('The broken bridge');
  });

  it('re-renders every row when a row is added, and rebuilds the handle each one holds', () => {
    /*
     * A row the memo must NOT skip, and the reason is on the row itself: every
     * drag handle announces `Reorder {name}, {position} of {total}`, and MOVE
     * DOWN is disabled on the last row by comparing the two. So the arrival of
     * a fourth row changes what all four of them say and what one of them
     * offers, and a memo that skipped the three already there would leave a
     * screen reader counting to three on a list of four.
     *
     * `total` is a number, so the default comparison catches it without
     * anybody having to remember. The handle is not, and that is the second
     * half of this test rather than a second test: `useStableHandles` caches a
     * handle on the factory, the row and the index, and an add moves none of
     * the three for a row already in the list - `addSessionItem` appends
     * without restamping anybody's `order`. What moves is the factory:
     * `onKeyDown` is `useCallback`'d on `items.length` and closes over `total`,
     * so the seat's `had.build === build` is the only one of its three
     * comparisons that can miss, and it is the only thing that gets the old
     * rows a handle that knows a fourth row exists.
     *
     * The label above cannot see that. `SessionRow` draws `of {total}` from its
     * own prop, so it reads `of 4` over a handle still closing over three. END
     * is the assertion that reaches inside the cached closure: with a stale one
     * the first row travels to index 2 and the region says `position 3 of 3`.
     */
    const items = three();
    seed(items);
    list();
    drawn.length = 0;

    const arrived: SessionItem = {
      ...base({ id: 'd', name: 'The vault' }),
      kind: 'scene',
      environmentRef: null,
      ...NO_FIGHT,
    };
    act(() => {
      useGm.getState().addSessionItem(arrived);
    });

    expect([...drawn].sort()).toEqual([...ids(items), arrived.id].sort());
    const spoken = buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Reorder '));
    expect(spoken).toHaveLength(useGm.getState().session.length);
    for (const handle of spoken) {
      expect(handle.getAttribute('aria-label')).toContain(
        `of ${String(useGm.getState().session.length)}`,
      );
    }

    press(spoken[0]!, 'End');
    expect(useGm.getState().session.map((i) => i.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(container.querySelector('[aria-live]')?.textContent).toBe(
      'The gate, position 4 of 4.',
    );
  });

  it('re-renders every row when the plan is reordered, because every index moved', () => {
    /*
     * The other half of the same claim, and it has to be stated or the memo
     * looks like it is skipping work it must not skip. `moveSessionItem`
     * rewrites `order` on every row, so every row's record is new and every
     * row's `position` is new - and the drag handle each row holds is built
     * from its index, so a cached handle here would announce the wrong place.
     */
    const items = three();
    seed(items);
    list();
    drawn.length = 0;

    act(() => {
      useGm.getState().moveSessionItem('c', 0);
    });

    expect([...drawn].sort()).toEqual([...ids(items)].sort());
  });

  it('wakes every row when the pointer moves, because that is not a prop', () => {
    /*
     * Stated so that nobody later "fixes" it. Each row reads `liveScene` out
     * of the store for its own shut header - it has to, since each of them
     * draws whether it is the one on the table - and `React.memo` compares
     * props, not store reads. So the pointer moving is a repaint of the whole
     * list on purpose, and the memo is not failing when it happens.
     */
    const items = three();
    seed(items);
    list();
    drawn.length = 0;

    act(() => {
      useGm.setState({ liveScene: 'b' });
    });

    expect([...drawn].sort()).toEqual([...ids(items)].sort());
  });

  it('wakes a scoped clock when its own scene is renamed, and no other row', () => {
    /*
     * The selector that replaced `useGm((s) => s.session)` has to stay live:
     * the clock's row does not change when its scene is renamed, so if the
     * name were read anywhere but out of the store this row would go on
     * naming a scene that no longer answers to it.
     */
    seed([
      { ...base({ id: 's1', name: 'The dungeon', order: 0 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 's2', name: 'The forest', order: 1 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'c1', name: 'The ritual', order: 2 }), kind: 'countdown', primary: false, sceneId: 's1', countdown: { id: 'c1', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE } },
    ]);
    list();
    expect(text()).toContain('4/6 · THE DUNGEON');
    drawn.length = 0;

    act(() => {
      useGm.getState().patchSessionItem('s1', { name: 'The deep dungeon' });
    });

    expect(drawn).toEqual(['s1', 'c1']);
    expect(text()).toContain('4/6 · THE DEEP DUNGEON');

    // And a rename of the scene it does NOT belong to reaches it not at all.
    drawn.length = 0;
    act(() => {
      useGm.getState().patchSessionItem('s2', { name: 'The burnt forest' });
    });
    expect(drawn).toEqual(['s2']);
  });

  it('names the scene a scoped clock belongs to, on the shut header', () => {
    /*
     * The list-level half of `session.test.ts`'s owner-name arm: that file
     * asks `describeItem` for the sentence, and this one asks whether the row
     * resolves the right name to put in it. A clock whose scope names no row
     * says the clock and nothing else - the reader hands such a clock back to
     * the campaign on the next load, and a placeholder for a scene that is not
     * there would be a second thing to keep in step.
     *
     * The pair at the end is the whole reason the selector says
     * `sessionName(owner)` and not `owner.name`, and the empty name is the one
     * input in this app that tells those two spellings apart:
     * `SessionItemBase.name` promises an empty name stays empty, so a scene the
     * GM never named holds `''` and is called `Scene` on its own header. Read
     * raw, that row would hand the clock an empty string and the shut header
     * would ship `4/6 · ` - a separator with nothing after it. Every other
     * fixture in this file gives its scene a name, so nothing else here can
     * fail when that line changes.
     */
    seed([
      { ...base({ id: 's1', name: 'The dungeon', order: 0 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'c1', name: 'The ritual', order: 1 }), kind: 'countdown', primary: false, sceneId: 's1', countdown: { id: 'c1', name: 'The ritual', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE } },
      { ...base({ id: 'c2', name: 'The tide', order: 2 }), kind: 'countdown', primary: false, sceneId: 'gone', countdown: { id: 'c2', name: 'The tide', kind: 'loop', start: 4, value: 4, notes: '', ...NO_CLOCK_PROSE } },
      { ...base({ id: 'c3', name: 'The flood', order: 3 }), kind: 'countdown', primary: false, sceneId: null, countdown: { id: 'c3', name: 'The flood', kind: 'standard', start: 8, value: 8, notes: '', ...NO_CLOCK_PROSE } },
      { ...base({ id: 's2', name: '', order: 4 }), kind: 'scene', environmentRef: null, ...NO_FIGHT },
      { ...base({ id: 'c4', name: 'The water rises', order: 5 }), kind: 'countdown', primary: false, sceneId: 's2', countdown: { id: 'c4', name: 'The water rises', kind: 'dynamic', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE } },
    ]);
    list();
    const shut = rows().map((r) => r.textContent ?? '');
    expect(shut[1], 'a scoped clock did not name its scene').toContain('4/6 · THE DUNGEON');
    expect(shut[2], 'a dangling scope invented a scene').toContain('4/4');
    expect(shut[2]).not.toContain('·');
    expect(shut[3], 'a campaign clock named an owner').toContain('8/8');
    expect(shut[3]).not.toContain('·');
    // The word the unnamed scene's own header draws, said by the clock that
    // belongs to it - not the empty string the record actually holds.
    expect(shut[5], 'an unnamed scene left the separator dangling').toContain('4/6 · SCENE');
  });

  it('mounts the row behind a memo, and that memo is this row', () => {
    /*
     * Kept, but it is not the proof and must never be read as one: this is
     * true of a memo that skips nothing. The counts above are the proof. What
     * this adds is that the seat wraps THIS component and not a copy of it,
     * which the counts cannot see.
     */
    expect((MemoSessionRow as { $$typeof?: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
    expect(MemoSessionRow.type).toBe(SessionRow);
  });
});
