// @vitest-environment jsdom
/**
 * The GM's bar stays on the glass while a tool is open - all twelve of them.
 *
 * ## What this file is holding, and why presence is not it
 *
 * `FearPool.tsx` gives one reason for the Fear control existing: it "stays
 * there whichever region is open, because Fear is spent from every one of
 * them: to spotlight in the scene, to trigger a feature you are reading in the
 * bestiary". From the commit that turned the five regions into tools drawn over
 * a session list, that sentence named the two regions where the control was
 * gone. ("For over a year" stood here, of a repository whose first commit is
 * nine days old.) Every GM tool mounted as `position: fixed; inset: 0` with
 * `useDialog`'s Tab trap, so with the scene open the pool was under an opaque
 * panel and, to a keyboard, outside the only focus scope on the screen: every
 * focusable outside the overlay - the bar's own seven, MENU, Fear `−`, the Fear
 * readout, Fear `+`, ADD, SHOW and SAVE, plus a pinned countdown's two, plus
 * however many rows the night's plan holds - was `stops.indexOf(...) === -1`,
 * which `useDialog` reads as *outside the dialog* and pulls back in. **Nothing
 * asserted any of it**, and that is the part worth fixing here rather than the
 * pixels. (This paragraph gave the pair as "of the eleven focusables in the
 * document, seven". Eleven is one fixture's count - `Gm` alone on an empty
 * session - and a verifier counting a real screen found thirteen outside. The
 * nine below are named because this file asserts those nine, not because a
 * screen has nine.)
 *
 * SO PRESENCE IS DELIBERATELY NOT THE PROPERTY. Every one of those controls was
 * in the document the whole time; a test that asked whether the button exists
 * would have stayed green through the entire defect and would stay green
 * through its return. What is asserted is REACHABILITY, in the four ways it can
 * be taken away:
 *
 *   1. drawn over        - the panel is not the window any more, it is the band
 *                          between the two bars, so the control is not inside
 *                          the overlay's own box;
 *   2. taken out of the tree - no ancestor is `inert` or `aria-hidden="true"`;
 *   3. not focusable     - `.focus()` lands on it;
 *   4. TRAPPED           - a Tab with focus on it is neither refused nor
 *                          redirected. This is the one that was false, and it
 *                          is the only one of the four that a screenshot could
 *                          not have shown either.
 *
 * ## How a jsdom file is allowed to say "on the glass" at all
 *
 * It is not, and it does not. jsdom has no layout: nothing here measures a
 * pixel and nothing here should be read as having done so. What it asserts is
 * the DECLARATIONS the geometry follows from, which is this repo's standing
 * rule for a number nobody can measure here - `GmSheet`'s overlay is
 * `position: absolute` with `inset: 0`, its parent declares `position:
 * relative`, and that parent is a sibling that comes after `GmTopBar` and
 * before `GmBar` and contains neither. An absolutely-positioned box inset to
 * zero on a relatively-positioned parent is that parent's padding box, so the
 * overlay cannot reach either bar. THE PIXELS ARE STILL OWED TO A BROWSER: the
 * handoff asks for a 393x852 screenshot with the scene open, and no test in
 * this repo can stand in for it.
 *
 * ## Tab, and `defaultPrevented`
 *
 * `tests/ui/dialogs.test.tsx` set the shape and its reasoning is taken whole:
 * jsdom implements neither Tab nor sequential focus navigation, so "focus is
 * still where I put it" is true of a page that traps nothing. The half that is
 * not ambiguous is `defaultPrevented` - it says the app took the keystroke away
 * from the browser. That file uses it to prove a trap; this one uses it to
 * prove there is none, on the same event on the same target. Both directions
 * are pressed, because `useDialog` wraps Shift+Tab through a different branch
 * and a fix that only released one of them would be half a fix.
 *
 * ## Twelve, and the one exception
 *
 * All twelve mount sites are here at both sizes - the eight `full` tools and
 * the four `sheet`s - because the defect was never about `full` alone. A
 * `sheet` caps at 85% of its container: over the window that put its top edge
 * inside the Fear row, and both sizes trapped Tab identically.
 *
 * `countdowns` is the single exception, and it is worth stating precisely
 * because the loose version of it is wrong. `Countdowns.tsx` renders
 * `FearBoard`, so the pool has always been *settable* from inside that one
 * tool. It is not an exception to this file: the board is twelve `Fear N`
 * targets, and the bar's `Spend a Fear` and `Gain a Fear` were absent from all
 * twelve, `countdowns` included. So "every tool covers the pool" overstates by
 * one; "every tool covers this bar" never did.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign, SessionItem } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm, type GmRegion } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { NO_CLOCK_PROSE } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const REAL_EXPORT = useGm.getState().exportActiveCampaign;
let baseCampaigns: Campaign[] = [];
let baseActiveId: string | null = null;
let container: HTMLDivElement;
let root: Root;

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
  await hydrateGm();
  baseCampaigns = useGm.getState().campaigns;
  baseActiveId = useGm.getState().activeCampaignId;
});

const countdownRow = (id: string, name: string, primary: boolean): SessionItem => ({
  id,
  kind: 'countdown',
  name,
  order: 0,
  collapsed: true,
  primary,
  sceneId: null,
  countdown: { id, name, kind: 'standard', start: 6, value: 4, notes: '', ...NO_CLOCK_PROSE },
});

/**
 * A night with rows in it, and one clock pinned.
 *
 * Not an empty session, and that is load-bearing twice. The rows put focusable
 * controls *under* the panel, which is what the Tab trap was protecting against
 * and what `inert` protects against now - an empty list would let a build with
 * neither pass. The pinned clock puts `GmTopBar`'s third row on the screen,
 * which is the case where nine controls are outside the panel rather than
 * seven, and the case where the bar is tallest.
 */
const NIGHT: SessionItem[] = [
  countdownRow('clock', 'The ritual', true),
  { ...countdownRow('other', 'The tide', false), order: 1 },
];

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
  useGm.setState({
    hydrated: true,
    session: NIGHT,
    countdowns: countdownsOf(NIGHT),
    combatants: [], liveScene: null,
    roster: [],
    environmentRef: null,
    fear: 3,
    // NOT `encounter`. `Gm`'s effect follows *changes* to the region, so
    // `setRegion('encounter')` on a store already reading `encounter` opens
    // nothing at all - a probe that seeded the default measured a screen with
    // no tool on it and read the numbers off as though there were one.
    region: 'scene',
    writeError: null,
    writeRetry: null,
    replacedOnLoad: false,
    exportActiveCampaign: REAL_EXPORT,
    campaigns: baseCampaigns,
    activeCampaignId: baseActiveId,
    notices: [],
    quarantined: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const gm = (): void => {
  act(() => root.render(createElement(Gm)));
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const leading = (prefix: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim().startsWith(prefix));
  if (found === undefined) {
    throw new Error(`no control starting "${prefix}"`);
  }
  return found;
};
const byLabel = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => b.getAttribute('aria-label') === label);
  if (found === undefined) {
    throw new Error(
      `no control labelled "${label}". Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 24))
        .join(' | ')}`,
    );
  }
  return found;
};

const dialog = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="dialog"]');
  if (el === null) throw new Error('nothing on screen carries role="dialog"');
  return el;
};

/** `Gm`'s root: the flex column the bars and the stage are children of. */
const screen = (): HTMLElement => container.firstElementChild as HTMLElement;

/** The one `position: relative` child, which is where a tool is drawn. */
const stage = (): HTMLElement => {
  const found = [...screen().children].find(
    (el) => (el as HTMLElement).style.position === 'relative',
  );
  if (found === undefined) {
    throw new Error(
      'no child of the GM screen declares `position: relative`, so a `position: absolute` ' +
        'overlay inside it is positioned against the window again and covers both bars.',
    );
  }
  return found as HTMLElement;
};

const bottomBar = (): HTMLElement =>
  container.querySelector<HTMLElement>('nav[aria-label="Session tools"]')!;

/** A verb inside one of the two bars, by the word it starts with. */
const inBar = (bar: HTMLElement, prefix: string): HTMLElement => {
  const found = [...bar.querySelectorAll<HTMLElement>('button')].find((b) =>
    (b.textContent ?? '').trim().startsWith(prefix),
  );
  if (found === undefined) throw new Error(`no "${prefix}" in this bar`);
  return found;
};

/** The pinned top bar, found through a control only it draws. */
const topBar = (): HTMLElement => {
  const found = [...screen().children].find((el) =>
    el.querySelector('[aria-label="Spend a Fear"]'),
  );
  if (found === undefined) throw new Error('the Fear control is not in a child of the GM screen');
  return found as HTMLElement;
};

/**
 * Returns the event, because half of what a trap does is refuse the key.
 *
 * Taken from `tests/ui/dialogs.test.tsx`, which uses the same event on the same
 * target to prove the opposite property on the six overlays that ARE modal.
 */
const press = (key: string, shiftKey = false): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

const hiddenAncestor = (el: Element): string | null => {
  for (let at: Element | null = el; at !== null; at = at.parentElement) {
    if (at.hasAttribute('inert')) return `${at.tagName} is inert`;
    if (at.getAttribute('aria-hidden') === 'true') return `${at.tagName} is aria-hidden`;
  }
  return null;
};

/**
 * The controls that have to survive a tool being open, by their accessible
 * names. Nine, because the fixture pins a countdown; the other seven are there
 * with or without one.
 */
const ON_THE_GLASS: Array<[what: string, find: () => HTMLElement]> = [
  // Scoped to the bar that draws them, not looked up across the document.
  // Three of the twelve panels draw a verb of their own that starts with the
  // same word - `Countdowns` has ADD A COUNTDOWN, `Scene` has ADD ADVERSARY,
  // the SAVE sheet has SAVE A COPY - and a document-wide search finds those
  // first, which would have this file asserting that a button inside the panel
  // is outside it.
  ['MENU', () => inBar(topBar(), 'MENU')],
  ['Fear −', () => byLabel('Spend a Fear')],
  ['the Fear readout', () => byLabel('3 of 12 Fear — open Fear and countdowns')],
  ['Fear +', () => byLabel('Gain a Fear')],
  ['the countdown −', () => byLabel('Advance The ritual by one')],
  ['the countdown +', () => byLabel('Move The ritual back by one')],
  ['ADD', () => inBar(bottomBar(), 'ADD')],
  ['SHOW', () => inBar(bottomBar(), 'SHOW')],
  ['SAVE', () => inBar(bottomBar(), 'SAVE')],
];

/** The twelve mount sites, both sizes, each with the name its dialog carries. */
const TOOLS: Array<[GmRegion, string]> = [
  ['encounter', 'Encounter builder'],
  ['scene', 'The live scene'],
  ['party', 'The party board'],
  ['bestiary', 'Bestiary'],
  ['countdowns', 'Fear and countdowns'],
  ['reference', 'The rules at hand'],
  ['names', 'Names and places'],
  ['merchant', 'The merchant'],
];

const SHEETS: Array<[string, string]> = [
  ['MENU', 'Menu and campaigns'],
  ['ADD', 'Add to the night'],
  ['SHOW', 'The bestiary, the party board, the merchant and rules search'],
  ['SAVE', 'Where this campaign is kept'],
];

const SITES: Array<[what: string, open: () => void, label: string]> = [
  ...TOOLS.map(
    ([tool, label]): [string, () => void, string] => [
      `the ${label} tool (size="full")`,
      () => {
        // Twice, and the first one is not decoration. `Gm`'s effect follows
        // *changes* to `region` and returns on `unchanged`, so a `setRegion`
        // naming the region the store is already in opens nothing at all - and
        // the site would then be measured with the session list on screen and
        // no panel over it. Parking somewhere else first makes the second call
        // a change whichever of the eight this is.
        act(() => {
          useGm.getState().setRegion(tool === 'scene' ? 'names' : 'scene');
        });
        act(() => {
          useGm.getState().setRegion(tool);
        });
      },
      label,
    ],
  ),
  ...SHEETS.map(
    ([verb, label]): [string, () => void, string] => [
      `the ${verb} sheet (size="sheet")`,
      () => {
        click(leading(verb));
      },
      label,
    ],
  ),
];

describe.each(SITES)('%s', (_what, open, label) => {
  beforeEach(() => {
    gm();
    open();
    // The site has to have actually opened, or every assertion below is a
    // assertion about the session list with nothing over it.
    expect(dialog().getAttribute('aria-label'), 'this mount site did not open').toBe(label);
  });

  it.each(ON_THE_GLASS)('leaves %s outside the panel, in the tree and tabbable', (what, find) => {
    const control = find();
    expect(
      dialog().contains(control),
      `${what} is inside the overlay, so it moves and hides with the tool`,
    ).toBe(false);
    expect(hiddenAncestor(control), `${what} is not in the accessibility tree`).toBeNull();

    control.focus();
    expect(document.activeElement, `${what} cannot take focus`).toBe(control);

    for (const shift of [false, true]) {
      const event = press('Tab', shift);
      expect(
        event.defaultPrevented,
        `${shift ? 'Shift+Tab' : 'Tab'} on ${what} was taken away from the browser, which is a ` +
          'focus trap pulling the keyboard back into the panel',
      ).toBe(false);
      expect(
        document.activeElement,
        `${shift ? 'Shift+Tab' : 'Tab'} on ${what} moved focus somewhere else`,
      ).toBe(control);
    }
  });

  it('does not tell a screen reader that the bar it excludes does not exist', () => {
    // `aria-modal="true"` on a node drawn so that live controls sit outside it
    // is a false sentence, and `useDialog`'s docblock is the argument for why
    // that matters. Written `false` rather than left off, so that a dialog that
    // simply forgot the attribute is not mistaken for this decision.
    expect(dialog().getAttribute('aria-modal')).toBe('false');
    expect(dialog().getAttribute('role')).toBe('dialog');
  });

  it('is drawn against the stage between the bars, not against the window', () => {
    // jsdom measures nothing. This is the declaration the geometry follows
    // from: an `inset: 0` absolute box on a relative parent IS that parent's
    // padding box, so an overlay that cannot reach outside the stage cannot
    // reach either bar. The pixels are owed to a browser.
    expect(
      dialog().style.position,
      '`GmSheet` is `position: fixed` again, which is the whole defect: a fixed overlay is ' +
        'positioned against the window and covers both bars.',
    ).toBe('absolute');
    expect(dialog().style.inset).toBe('0px');
    expect(dialog().parentElement, 'the overlay is not a child of the stage').toBe(stage());
    expect(stage().contains(topBar()), 'the top bar is inside the stage a tool fills').toBe(false);
    expect(stage().contains(bottomBar()), 'the bottom bar is inside the stage').toBe(false);
    const order = [...screen().children];
    expect(
      [order.indexOf(topBar()) < order.indexOf(stage()), order.indexOf(stage()) < order.indexOf(bottomBar())],
      'the stage is no longer between the two bars in the flex column',
    ).toEqual([true, true]);
  });

  it('takes the list under it out of the keyboard and the tree', () => {
    // The half of the trap worth keeping. Under `full` the list is not visible
    // at all; under `sheet` it is behind a 55% wash where a tap closes the
    // sheet rather than reaching a row. Either way it is not somewhere Tab
    // should be able to go, and without the trap something has to say so.
    const row = [...container.querySelectorAll<HTMLElement>('button')].find(
      (b) => !dialog().contains(b) && stage().contains(b),
    );
    expect(row, 'the fixture has no control under the panel, so this asserts nothing').toBeDefined();
    expect(hiddenAncestor(row!), 'the list under the panel is still a tab stop').toBe(
      'DIV is inert',
    );
  });
});

describe('with nothing open', () => {
  it('leaves the list live', () => {
    gm();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[inert]'), 'the list is inert with no tool over it').toBeNull();
  });
});

describe('the one tool that carries a Fear control of its own', () => {
  it('is `countdowns`, and it is the board rather than this bar', () => {
    // Stated precisely because the loose version is wrong. `Countdowns.tsx`
    // renders `FearBoard`, which is twelve `Fear N` targets; the bar's own
    // `−`/`+` are in none of the twelve panels, `countdowns` included.
    gm();
    act(() => {
      useGm.getState().setRegion('countdowns');
    });
    expect(dialog().querySelectorAll('[aria-label^="Fear "]')).toHaveLength(12);
    expect(dialog().querySelector('[aria-label="Spend a Fear"]')).toBeNull();
    expect(dialog().querySelector('[aria-label="Gain a Fear"]')).toBeNull();
  });

  it('is the only one', () => {
    for (const [tool] of TOOLS) {
      if (tool === 'countdowns') continue;
      gm();
      act(() => {
        useGm.getState().setRegion(tool);
      });
      expect(dialog().querySelectorAll('[aria-label^="Fear "]'), tool).toHaveLength(0);
      act(() => root.unmount());
      root = createRoot(container);
    }
  });
});
