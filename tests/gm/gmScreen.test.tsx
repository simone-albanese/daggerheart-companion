// @vitest-environment jsdom
/**
 * The GM screen as a whole: what stays pinned, and how its tools open.
 *
 * The thing most worth pinning here is a negative. `emptyBoard()` sets
 * `region: 'encounter'` and every campaign record carries a region, so an
 * effect that opened whatever it read at mount would put the encounter builder
 * over the session list every single time the GM arrives - which is the
 * five-menus behaviour this whole change exists to remove, reintroduced by the
 * one line that keeps the four existing cross-links working. Both halves are
 * asserted: arriving opens nothing, and a `setRegion` issued from *inside* a
 * tool still swaps to the tool it names.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign, SessionItem } from '../../shared/campaigns.ts';
import { SESSION_ITEM_KINDS, countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import type { SaveResult } from '../../src/transfer/fileIo.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { flushGm, hydrateGm, REPLACED_ON_LOAD, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * The real export, taken before any test replaces it.
 *
 * `useGm.setState` can put a stub in the store's action slot, which is how the
 * SAVE tests drive `SaveResult` without a file picker - and the store is a
 * module singleton, so the stub would otherwise outlive the test that made it.
 */
const REAL_EXPORT = useGm.getState().exportActiveCampaign;

/** The campaign list as hydration left it, restored before every test. */
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
    session: [],
    countdowns: [],
    combatants: [],
    roster: [],
    environmentRef: null,
    fear: 0,
    region: 'encounter',
    writeError: null,
    writeRetry: null,
    replacedOnLoad: false,
    exportActiveCampaign: REAL_EXPORT,
    // MENU makes and removes campaigns, and the store is a module singleton.
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

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const named = (label: string): HTMLButtonElement => {
  const found = buttons().find((b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label);
  if (found === undefined) {
    throw new Error(`no control called "${label}". Here: ${buttons().map((b) => b.getAttribute('aria-label') ?? b.textContent).join(' | ')}`);
  }
  return found;
};

/** The sheet choices carry a label and a sentence, so exact text will not do. */
const leading = (prefix: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim().startsWith(prefix));
  if (found === undefined) {
    throw new Error(`no control starting "${prefix}". Here: ${buttons().map((b) => (b.textContent ?? '').slice(0, 30)).join(' | ')}`);
  }
  return found;
};

/** Let promises and microtasks land. The GM store writes asynchronously. */
async function settle(turns = 6): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Type into a controlled input the way a keyboard does, through the setter. */
function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const choose = (select: HTMLSelectElement, value: string): void => {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const submit = (): void => {
  const form = container.querySelector('form')!;
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

const activeCampaign = (): { id: string; name: string; updatedAt: string } => {
  const state = useGm.getState();
  return state.campaigns.find((c) => c.id === state.activeCampaignId)!;
};

/** Which tool is open, by the dialog's own accessible name. */
const openTool = (): string | null =>
  container.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null;

/** The twelve-diamond strip. It is aria-hidden, so it has no name to ask for. */
const pipStrip = (): Element | null =>
  [...container.querySelectorAll('[aria-hidden="true"]')].find((el) => el.children.length === 12) ?? null;

function seed(items: SessionItem[]): void {
  useGm.setState({ session: items, countdowns: countdownsOf(items) });
}

const countdownRow = (id: string, name: string, primary: boolean, value = 4): SessionItem => ({
  id,
  kind: 'countdown',
  name,
  order: 0,
  collapsed: true,
  primary,
  countdown: { id, name, kind: 'standard', start: 6, value, notes: '' },
});

// ---------------------------------------------------------------------------

describe('the pinned top bar', () => {
  it('names the campaign the GM is in', () => {
    gm();
    const active = useGm.getState().campaigns.find((c) => c.id === useGm.getState().activeCampaignId);
    expect(active).toBeDefined();
    expect(text()).toContain(active!.name);
  });

  it('drops the twelve tokens on a phone and keeps the number', () => {
    // "alla fine non serve vedere i token": twelve diamonds are 210px of a
    // 369px column, and the number is what actually gets read.
    gm();
    expect(pipStrip()).toBeNull();
    expect(named('0 of 12 Fear — open Fear and countdowns')).toBeDefined();
  });

  it('brings the tokens back where there is room for them', () => {
    setViewport(1024);
    gm();
    expect(pipStrip()).not.toBeNull();
  });

  it('opens the Fear board from the number, which is where the eye already is', () => {
    gm();
    click(named('0 of 12 Fear — open Fear and countdowns'));
    expect(openTool()).toBe('Fear and countdowns');
    // Countdowns mounted whole, its board included.
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Fear 7')).toBe(true);
  });

  it('pins the countdown the record marks, not the first one in the list', () => {
    seed([countdownRow('c1', 'The tide', false), countdownRow('c2', 'The ritual', true)]);
    gm();
    expect(text()).toContain('The ritual');
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Advance The ritual by one')).toBe(true);
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Advance The tide by one')).toBe(false);
  });

  it('has no countdown row when nothing is pinned', () => {
    seed([countdownRow('c1', 'The tide', false)]);
    gm();
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Advance The tide by one')).toBe(false);
  });

  it('shows the live scene only while there is one, and opens it', () => {
    gm();
    expect(text()).not.toContain('SCENE ·');
    act(() => root.unmount());
    root = createRoot(container);
    useGm.setState({
      combatants: [
        { id: 'x', adversaryRef: 'a', name: 'Acid Burrower', hp: { marked: 0, max: 8 }, stress: { marked: 0, max: 3 }, thresholds: [8, 15], difficulty: 14, spotlighted: false, notes: '' },
      ],
    });
    gm();
    const chip = buttons().find((b) => (b.textContent ?? '').startsWith('SCENE ·'))!;
    expect(chip).toBeDefined();
    click(chip);
    expect(openTool()).toBe('The live scene');
  });

  it('has handed the two consultation chips over to SHOW', () => {
    // They were on loan here while no bottom bar existed. Keeping them once
    // SHOW carries them would be a second door nobody chose to build - and
    // 134px of the 369px row the campaign name wants.
    gm();
    const labels = buttons().map((b) => (b.textContent ?? '').trim());
    expect(labels).not.toContain('BESTIARY');
    expect(labels).not.toContain('PARTY');
  });
});

describe('the tools, over the list', () => {
  it('opens nothing at all when the GM arrives, whatever the record last had open', () => {
    // `board.region` is a stored field. Reading it as an instruction is how the
    // five-menu screen comes back through the door the cross-links use.
    useGm.setState({ region: 'bestiary' });
    gm();
    expect(openTool()).toBeNull();
    expect(text()).toContain('Nothing planned yet');
  });

  it('still follows a region a tool sets from inside itself', () => {
    // Encounter's "send the roster to the scene", Bestiary's "add to the
    // scene" and Scene's two empty-state buttons all navigate this way, and
    // none of them was edited for this screen.
    gm();
    click(named('SHOW'));
    click(leading('THE PARTY BOARD'));
    expect(openTool()).toBe('The party board');
    act(() => {
      useGm.getState().setRegion('scene');
    });
    expect(openTool()).toBe('The live scene');
  });

  it('reads a change of table as a change of table, and not as a navigation', async () => {
    /*
     * Every campaign record carries a region, and `switchCampaign` replaces the
     * board wholesale out of the one it is opening. A screen that seeded only
     * the *first* region it ever saw therefore read every change of table as a
     * navigation: this is "Open A one-shot" landing the GM in the bestiary of
     * the campaign they just left the encounter builder for.
     */
    const [first] = baseCampaigns;
    useGm.setState({
      campaigns: [
        { ...first!, id: 'c-open', name: 'The Sablewood Winter', board: { ...first!.board, region: 'encounter' } },
        { ...first!, id: 'c-other', name: 'A one-shot', board: { ...first!.board, region: 'bestiary' } },
      ],
      activeCampaignId: 'c-open',
      region: 'encounter',
    });
    gm();
    click(leading('MENU'));
    click(named('Open A one-shot'));
    await settle();

    expect(useGm.getState().activeCampaignId).toBe('c-other');
    // The stored region still arrives - it is the record's field, and the next
    // visit to that table should still know which tool was last open.
    expect(useGm.getState().region).toBe('bestiary');
    expect(openTool(), 'a tool opened over the table the GM had just switched to').toBeNull();
  });

  it('does not open a tool because the GM made a new table', async () => {
    // `emptyBoard()` says `region: 'encounter'`, so a new campaign is the
    // five-menus behaviour arriving through the campaign list instead.
    useGm.setState({ region: 'bestiary' });
    gm();
    click(leading('MENU'));
    click(named('NEW CAMPAIGN'));
    await settle();

    expect(useGm.getState().region).toBe('encounter');
    expect(openTool(), 'NEW CAMPAIGN opened a tool').toBeNull();
  });

  it('will not follow a region into a tool that is switched off', () => {
    // The Settings hint promises that with a tool off "nothing on screen points
    // at a tool that is not there". This effect is the one route into a tool
    // that is not a control, so it is the one that could contradict it.
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmBestiary: false } });
    gm();
    act(() => {
      useGm.getState().setRegion('bestiary');
    });
    expect(openTool(), 'a switched-off tool was opened by a region change').toBeNull();
    // Remembered, though: the field belongs to the record, not to this screen.
    expect(useGm.getState().region).toBe('bestiary');
  });

  it('unmounts a tool when it closes rather than hiding it', () => {
    // The party board's camera - `PartyScanner.tsx`, behind the board's lazy
    // boundary - opens the stream in an effect and stops it on unmount; a
    // sheet kept alive behind `display: none` leaves it running.
    gm();
    click(named('SHOW'));
    click(leading('THE PARTY BOARD'));
    expect(openTool()).toBe('The party board');
    click(named('Close The party board'));
    expect(openTool()).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on Escape, and says so where a keyboard exists', () => {
    gm();
    click(named('SHOW'));
    click(leading('BESTIARY'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(openTool()).toBeNull();
  });

  it('never has two dialogs alive at once, sheet or tool', () => {
    // `useDialog` registers one unconditional window keydown listener per
    // dialog, with no topmost check: two alive at once means one Escape
    // closing both and two Tab handlers fighting. It is why a link row draws a
    // domain card in the row instead of opening `CardReader`, and it is why
    // SHOW hands the screen to the tool rather than stacking it on the sheet.
    gm();
    click(named('SHOW'));
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    click(leading('BESTIARY'));
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(openTool()).toBe('Bestiary');
  });
});

// ---------------------------------------------------------------------------

describe('the bottom bar', () => {
  const bar = (): HTMLElement =>
    [...container.querySelectorAll<HTMLElement>('nav')].find(
      (nav) => nav.getAttribute('aria-label') === 'Session tools',
    )!;

  it('is three verbs, and says they open something rather than go somewhere', () => {
    gm();
    const verbs = [...bar().querySelectorAll('button')];
    expect(verbs.map((b) => (b.textContent ?? '').trim())).toEqual(['ADD', 'SHOW', 'SAVE']);
    for (const verb of verbs) {
      expect(verb.getAttribute('aria-haspopup')).toBe('dialog');
      expect(verb.getAttribute('aria-expanded')).toBe('false');
      // Not a destination. `aria-current="page"` here would describe a dialog
      // as a place, which is the five-menus reading of this screen.
      expect(verb.getAttribute('aria-current')).toBeNull();
    }
  });

  it('reports which sheet is open on the button that opened it', () => {
    gm();
    click(named('ADD'));
    expect(named('ADD').getAttribute('aria-expanded')).toBe('true');
    expect(named('SAVE').getAttribute('aria-expanded')).toBe('false');
  });

  it('declares one column per verb it draws', () => {
    // The grid is written from the verb array's length rather than fixed at
    // three, so a build that drops one redistributes the width instead of
    // leaving a hole.
    gm();
    expect(bar().querySelectorAll('button')).toHaveLength(3);
    expect(bar().style.gridTemplateColumns).toBe('repeat(3, 1fr)');
  });

  it('drops SHOW when both halves of its fork are switched off, and redistributes', () => {
    /*
     * The property the test above could only half state. With the bestiary and
     * the party board both off, SHOW opens a sheet with nothing in it - so it
     * is not drawn, and the two verbs that are left take the width: 196px each
     * on a 393px phone where three were 131. A hard-coded `repeat(3, 1fr)`
     * would leave the third column empty and put ADD and SAVE where neither the
     * eye nor the thumb expects them.
     */
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmBestiary: false, gmPartyBoard: false } });
    gm();

    const verbs = [...bar().querySelectorAll('button')];
    expect(verbs.map((b) => (b.textContent ?? '').trim())).toEqual(['ADD', 'SAVE']);
    expect(bar().style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    // And the two that remain are still the 60px targets they were.
    for (const verb of verbs) expect(verb.style.minHeight).toBe('60px');
  });

  it('keeps SHOW while either half is still there', () => {
    // Half a fork is still something to open, so the verb stays and the bar
    // keeps its three columns. The sheet is what narrows.
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartyBoard: false } });
    gm();
    expect([...bar().querySelectorAll('button')].map((b) => (b.textContent ?? '').trim())).toEqual([
      'ADD',
      'SHOW',
      'SAVE',
    ]);
  });

  it('has no SEARCH, because there is nothing behind one', () => {
    // The wireframe draws four. Full-text rule search is deferred, and the
    // searching a GM does at the table is Bestiary's filter, behind SHOW. A
    // button that opens nothing is worse than a button that is not there.
    gm();
    expect([...bar().querySelectorAll('button')].map((b) => b.textContent)).not.toContain('SEARCH');
  });
});

// ---------------------------------------------------------------------------

describe('ADD', () => {
  it('offers exactly the kinds the record has, in the record’s order', () => {
    // Generated from SESSION_ITEM_KINDS rather than typed out, so a fifth kind
    // cannot be added to the record and silently missing from this menu.
    gm();
    click(named('ADD'));
    const choices = [...container.querySelectorAll('[role="dialog"] button')]
      // The label is the choice's first span; the second is the sentence
      // saying what the kind is for, and `textContent` runs the two together.
      .map((b) => (b.querySelector('span')?.textContent ?? '').trim().toLowerCase())
      .filter((t) => (SESSION_ITEM_KINDS as readonly string[]).includes(t));
    expect(choices).toEqual([...SESSION_ITEM_KINDS]);
  });

  it('writes a scene row, closed, at the end of the night', () => {
    seed([countdownRow('c1', 'The tide', false)]);
    gm();
    click(named('ADD'));
    click(leading('SCENE'));
    type(container.querySelector('[role="dialog"] input')!, 'The Sablewood gate');
    choose(container.querySelector('[role="dialog"] select')!, dataset.environments[1]!.id);
    submit();

    const session = useGm.getState().session;
    expect(session).toHaveLength(2);
    const row = session[1]!;
    expect(row.kind).toBe('scene');
    expect(row.name).toBe('The Sablewood gate');
    expect(row.order).toBe(1);
    // Closed: a row that arrived open would push the rest of the night off a
    // phone at the moment it was added.
    expect(row.collapsed).toBe(true);
    expect(row.kind === 'scene' && row.environmentRef).toBe(dataset.environments[1]!.id);
    // And the sheet is gone, rather than sitting over the row it just made.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('takes the roster that is on the board, and never the fight', () => {
    useGm.setState({
      roster: [{ ref: 'acid-burrower', count: 3 }],
      adjustments: { easier: false, harder: true, damageBump: false },
    });
    gm();
    click(named('ADD'));
    click(leading('ENCOUNTER'));
    click(leading('TAKE THE 3 ON THE BOARD NOW'));
    submit();

    const row = useGm.getState().session[0]!;
    expect(row.kind === 'encounter' && row.roster).toEqual([{ ref: 'acid-burrower', count: 3 }]);
    expect(row.kind === 'encounter' && row.adjustments.harder).toBe(true);
    // No store action sets a combatant list wholesale, so a row that arrived
    // carrying one would show a number nothing could ever change again.
    expect(row.kind === 'encounter' && row.combatants).toEqual([]);
  });

  it('leaves the roster behind when it is not asked for', () => {
    useGm.setState({ roster: [{ ref: 'acid-burrower', count: 3 }] });
    gm();
    click(named('ADD'));
    click(leading('ENCOUNTER'));
    submit();
    const row = useGm.getState().session[0]!;
    expect(row.kind === 'encounter' && row.roster).toEqual([]);
  });

  it('links to a rule, which is the one kind the dataset index cannot answer', () => {
    gm();
    click(named('ADD'));
    click(leading('LINK'));
    const selects = [...container.querySelectorAll<HTMLSelectElement>('[role="dialog"] select')];
    choose(selects[0]!, 'rule');
    choose([...container.querySelectorAll<HTMLSelectElement>('[role="dialog"] select')][1]!, dataset.rules[0]!.id);
    submit();

    const row = useGm.getState().session[0]!;
    expect(row.kind === 'link' && row.target).toEqual({ kind: 'rule', ref: dataset.rules[0]!.id });
  });

  it('refuses to build a link that points at nothing', () => {
    gm();
    click(named('ADD'));
    click(leading('LINK'));
    expect(named('ADD TO THE END OF THE NIGHT').disabled).toBe(true);
    submit();
    expect(useGm.getState().session).toHaveLength(0);
  });

  it('pins the countdown it just made, by the id the store hands back', () => {
    // `addCountdown` mints the id the row and the countdown share, so the
    // caller has no other way to name the row it just appended - and reading
    // `session.at(-1)` would be this form holding an opinion about the store.
    seed([countdownRow('c1', 'The tide', true)]);
    gm();
    click(named('ADD'));
    click(leading('COUNTDOWN'));
    type(container.querySelector('[role="dialog"] input')!, 'The ritual completes');
    click(leading('PIN IT TO THE TOP BAR'));
    submit();

    const countdowns = useGm.getState().session.filter((i) => i.kind === 'countdown');
    expect(countdowns).toHaveLength(2);
    const primary = countdowns.filter((i) => i.kind === 'countdown' && i.primary);
    expect(primary).toHaveLength(1);
    expect(primary[0]!.name).toBe('The ritual completes');
    // And the top bar is drawing it, which is what "pinned" means on screen.
    expect(buttons().some((b) => b.getAttribute('aria-label') === 'Advance The ritual completes by one')).toBe(true);
  });

  it('will not start a nameless countdown, and says why beside the field', () => {
    // The primary countdown's name is what the top bar prints and what its −
    // button is called: an empty one produces "Advance  by one".
    gm();
    click(named('ADD'));
    click(leading('COUNTDOWN'));
    expect(named('ADD TO THE END OF THE NIGHT').disabled).toBe(true);
    expect(text()).toContain('what its − button is called');
    submit();
    expect(useGm.getState().session).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('SHOW', () => {
  it('forks in two, and each side says what it is not', () => {
    gm();
    click(named('SHOW'));
    expect(text()).toContain('without adding any of them');
    expect(text()).toContain('Nothing here ever writes to their characters');
  });

  it('opens the bestiary, which no row can', () => {
    gm();
    click(named('SHOW'));
    click(leading('BESTIARY'));
    expect(openTool()).toBe('Bestiary');
  });

  it('offers only the half that is switched on, and is named for it', () => {
    /*
     * A fork with one arm is still a fork, and the sheet must not be announced
     * as "Bestiary and party board" while it offers one of the two - that is
     * the everyday size of the rule this screen is built on. Absent rather than
     * disabled, for the reason SEARCH is absent from the bar: a choice that
     * cannot be taken is a row the GM reads for nothing.
     */
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmBestiary: false } });
    gm();
    click(named('SHOW'));

    const choices = [...container.querySelectorAll('[role="dialog"] button')]
      // The sheet's own ✕ has no label span; every choice's first span is its
      // heading and its second is the sentence under it.
      .map((b) => (b.querySelector('span')?.textContent ?? '').trim())
      .filter((label) => label !== '');
    expect(choices).toEqual(['THE PARTY BOARD']);
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'The party board',
    );
  });
});

// ---------------------------------------------------------------------------

describe('a tool that is switched off', () => {
  const sceneRow = (id: string, name: string): SessionItem => ({
    id,
    kind: 'scene',
    name,
    order: 0,
    collapsed: false,
    environmentRef: null,
  });

  /** Reach the scene runner the way a GM does: from a row, with nothing in it. */
  const openEmptyScene = (): void => {
    seed([sceneRow('s1', 'The Sablewood gate')]);
    gm();
    click(named('OPEN THE SCENE'));
    expect(openTool()).toBe('The live scene');
  };

  it('is not offered by the one empty state that cross-links to it', () => {
    /*
     * SHOW is not the only door to the bestiary: the scene runner's empty state
     * offers it too, and that button is a `setRegion('bestiary')` which this
     * screen turns into an open tool. Left unguarded it would be the single
     * control in the app that opens something the GM has switched off - and the
     * sentence above it would name a tool that is not there, which is the same
     * defect one step quieter.
     */
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmBestiary: false } });
    openEmptyScene();

    expect(buttons().map((b) => (b.textContent ?? '').trim())).not.toContain('Open the bestiary');
    expect(text()).not.toContain('open the bestiary and drop a single adversary');
    // Never buttonless: the encounter builder is a session row's content and is
    // deliberately not switchable, so this state always has one way forward.
    expect(buttons().map((b) => (b.textContent ?? '').trim())).toContain('Build an encounter');
  });

  it('is offered there, and works, while it is on', () => {
    openEmptyScene();
    expect(text()).toContain('open the bestiary and drop a single adversary');
    click(named('Open the bestiary'));
    expect(openTool()).toBe('Bestiary');
  });
});

// ---------------------------------------------------------------------------

describe('SAVE', () => {
  const OLD = '2020-01-01T00:00:00.000Z';

  const stampCampaign = (updatedAt: string): void => {
    act(() => {
      const state = useGm.getState();
      useGm.setState({
        campaigns: state.campaigns.map((c) =>
          c.id === state.activeCampaignId ? { ...c, updatedAt } : c,
        ),
      });
    });
  };

  const stubExport = (result: SaveResult): void => {
    useGm.setState({ exportActiveCampaign: () => Promise.resolve(result) });
  };

  it('lands the change the GM just made before it says anything about it', async () => {
    // Without the flush the sheet reads the `updatedAt` of the write *before*
    // this change - up to 400ms of debounce behind the thumb - and stamps it
    // as though it were current.
    await act(async () => {
      await flushGm();
    });
    stampCampaign(OLD);
    act(() => {
      useGm.getState().setFear(3);
    });

    gm();
    click(named('SAVE'));
    await settle();

    expect(activeCampaign().updatedAt).not.toBe(OLD);
    expect(text()).toContain('just now');
  });

  it('names the moment the last write actually landed', async () => {
    await act(async () => {
      await flushGm();
    });
    stampCampaign(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
    gm();
    click(named('SAVE'));
    await settle();
    expect(text()).toContain('2 hr ago');
  });

  it('never implies the GM has to press it', async () => {
    gm();
    click(named('SAVE'));
    await settle();
    expect(text()).toContain('You never have to press anything');
  });

  it('says a write has not landed instead of stamping one that did not', async () => {
    // Both fields, because the store never sets one without the other: a
    // `writeError` seeded on its own is a state this app cannot be in, and a
    // test that asserts a TRY AGAIN over it is asserting against fiction.
    useGm.setState({
      writeError: 'The quota has been exceeded. What is on this screen is only in this tab.',
      writeRetry: 'write',
    });
    gm();
    click(named('SAVE'));
    await settle();
    // Inside the dialog, deliberately: the screen behind it now carries an
    // alert of its own with the same sentence in it, and a bare
    // `querySelector('[role="alert"]')` would find that one and pass whatever
    // this sheet did.
    const alert = container.querySelector('[role="dialog"] [role="alert"]');
    expect(alert?.textContent ?? '').toContain('only in this tab');
    expect(text()).not.toContain('ALREADY ON THIS DEVICE');
    expect(named('TRY AGAIN')).toBeDefined();
  });

  it('does not say a cancelled export was saved', async () => {
    stubExport({ ok: false, route: null, fileName: 'x.dhcampaign', cancelled: true, reason: null });
    gm();
    click(named('SAVE'));
    await settle();
    click(named('SAVE A COPY'));
    await settle();
    expect(text()).toContain('no copy was made');
    expect(text()).not.toContain('Saved');
  });

  it('names the file when there is one, and where it went', async () => {
    stubExport({ ok: true, route: 'download', fileName: 'the-hollow.dhcampaign', cancelled: false, reason: null });
    gm();
    click(named('SAVE'));
    await settle();
    click(named('SAVE A COPY'));
    await settle();
    expect(text()).toContain('Saved as the-hollow.dhcampaign');
    expect(text()).toContain('with your downloads');
  });

  it('gives the failure’s own words when the write failed for a reason', async () => {
    stubExport({ ok: false, route: null, fileName: 'x.dhcampaign', cancelled: false, reason: 'The disk is full.' });
    gm();
    click(named('SAVE'));
    await settle();
    click(named('SAVE A COPY'));
    await settle();
    expect(text()).toContain('The disk is full.');
    expect(text()).not.toContain('Saved');
  });

  it('says out loud that nothing here can read a campaign file back in', async () => {
    // `campaignFile.ts` has a parser and no import path, deliberately. A GM
    // handed a file and not told will find out on the day they need it.
    gm();
    click(named('SAVE'));
    await settle();
    expect(text()).toContain('read a campaign file back in');
  });
});

// ---------------------------------------------------------------------------

describe('a write that did not happen', () => {
  const FAILED =
    'This device is out of space, so the campaign could not be written. What is on this screen is only in this tab, so closing it now loses it.';

  it('is on the screen it happened on, with nothing opened to find it', () => {
    /*
     * The store has carried `writeError` since it was written; for most of that
     * time nothing read it, and since SAVE existed one sheet read it. The GM
     * this sentence is for is the one who has *not* opened anything: three
     * hours in, adding rows, watching them appear, with a tab that is about to
     * close on all of it. A warning behind a button is a warning for the person
     * who already suspected.
     */
    useGm.setState({ writeError: FAILED });
    gm();

    const alerts = [...container.querySelectorAll('[role="alert"]')];
    expect(alerts, 'the failed write is not visible without opening something').toHaveLength(1);
    expect(container.querySelector('[role="dialog"]'), 'a sheet was open').toBeNull();
    expect(alerts[0]!.closest('[role="dialog"]')).toBeNull();
    expect(alerts[0]!.textContent ?? '').toContain('closing it now loses it');
    expect(text()).toContain('NOT ON THIS DEVICE');
  });

  it('is not something a sheet can cover', () => {
    // MENU is over the list and the strip is under the top bar; opening one
    // must not be the thing that takes the other away.
    useGm.setState({ writeError: FAILED });
    gm();
    click(leading('MENU'));

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const strip = [...container.querySelectorAll('[role="alert"]')].filter(
      (el) => el.closest('[role="dialog"]') === null,
    );
    expect(strip).toHaveLength(1);
  });

  it('retries the write from there, and goes when it lands', async () => {
    /*
     * The whole point of the button. `flushGm` returns early when nothing is
     * dirty, so the retry is only worth drawing where the store says there is
     * something for it to write - which is what `writeRetry` carries. `setFear`
     * is the change that makes this campaign dirty; the seeded pair stands in
     * for the write that failed with it.
     */
    act(() => {
      useGm.getState().setFear(3);
    });
    useGm.setState({ writeError: FAILED, writeRetry: 'write' });
    gm();
    click(named('TRY AGAIN'));
    await settle(10);

    expect(useGm.getState().writeError, 'the retry never wrote anything').toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    // And the write that landed is the one that was on screen.
    expect(activeCampaign()).toBeDefined();
    expect(useGm.getState().fear).toBe(3);
  });

  it('draws no retry where a retry can do nothing, and says what does', () => {
    /*
     * A delete that threw. `flushGm` writes the open campaign, which is not
     * what failed and - when the doomed campaign is the open one - is the
     * opposite of what was asked for. The old strip drew TRY AGAIN over it
     * anyway: the GM pressed a red button, watched it say TRYING…, and got the
     * same strip back with nothing done. The store's sentence names the control
     * that does help instead.
     */
    useGm.setState({
      writeError:
        'That campaign could not be deleted (The database is closed). It is still on this device and still in the list, and nothing else has changed — REMOVE tries again.',
      writeRetry: null,
    });
    gm();

    expect(text()).toContain('NOT ON THIS DEVICE');
    expect(text()).toContain('REMOVE tries again');
    expect(
      buttons().map((b) => (b.textContent ?? '').trim()),
      'a retry was offered for a failure it cannot fix',
    ).not.toContain('TRY AGAIN');
  });

  it('says a retry did not land, instead of flashing and leaving the same strip', async () => {
    /*
     * The other half of the same button. On success the strip goes, which is
     * visible; on failure it stayed exactly as it was, so a retry that failed
     * and a button that was never wired looked identical.
     *
     * The retry is made to fail by pointing the store at a campaign that is not
     * in the list: `writeActive` returns at `base === undefined` with the store
     * still dirty, which is one of the shapes the real failure has.
     */
    act(() => {
      useGm.getState().setFear(3);
    });
    useGm.setState({ writeError: FAILED, writeRetry: 'write', activeCampaignId: 'nobody' });
    gm();
    click(named('TRY AGAIN'));
    await settle(10);

    expect(useGm.getState().writeError).not.toBeNull();
    expect(text()).toContain('THAT TRY DID NOT LAND EITHER');
  });
});

// ---------------------------------------------------------------------------

describe('a change the disk replaced', () => {
  it('is said on the screen, and not only behind MENU', () => {
    /*
     * `hydrateGm` drops whatever the GM changed while the campaign was being
     * read and adopts the record - the right call, argued in the store - and
     * pushed its one sentence into `notices`, which only MENU draws. So the GM
     * who pressed Fear `+` during the read watched it go back down with nothing
     * on screen to say why: a reversal performed on purpose and reported to
     * whoever opens a sheet is a reversal performed quietly.
     */
    useGm.setState({ replacedOnLoad: true });
    gm();

    expect(container.querySelector('[role="dialog"]'), 'a sheet was open').toBeNull();
    expect(text()).toContain('what was saved on this device has been used instead');
  });

  it('can be put away, and MENU still has it', () => {
    // Dismissible where the failed write is not, and the difference is the
    // tense: this one is over, and nothing is still at risk behind it. The
    // sentence stays in `notices`, so the ✕ is not an erasure.
    useGm.setState({ replacedOnLoad: true, notices: [REPLACED_ON_LOAD] });
    gm();
    click(named('Dismiss'));

    expect(useGm.getState().replacedOnLoad).toBe(false);
    expect(text()).not.toContain('has been used instead');

    click(leading('MENU'));
    expect(text()).toContain('has been used instead');
  });
});

// ---------------------------------------------------------------------------

describe('MENU', () => {
  const openMenu = (): void => {
    gm();
    click(leading('MENU'));
  };

  /** Two campaigns, the first one open, both named. */
  const twoCampaigns = (): void => {
    const [first] = baseCampaigns;
    useGm.setState({
      campaigns: [
        { ...first!, id: 'c-open', name: 'The Sablewood Winter' },
        { ...first!, id: 'c-other', name: 'A one-shot' },
      ],
      activeCampaignId: 'c-open',
    });
  };

  it('is the whole top row, not a word beside a name', () => {
    // The Disclosure lesson: a 44px word next to 300px of dead text teaches the
    // hand to aim, and the other hand is holding the phone.
    gm();
    const menu = leading('MENU');
    expect(menu.textContent).toContain(activeCampaign().name);
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog');
    // The accessible name is the visible text, so WCAG 2.5.3 holds by
    // construction rather than by a string somebody keeps in step.
    expect(menu.getAttribute('aria-label')).toBeNull();
  });

  it('carries the way out the tab bar used to be', () => {
    openMenu();
    click(named('CARDS'));
    expect(useApp.getState().screen).toBe('cards');
    // And it closes behind itself: a dialog left open over a screen the GM has
    // just left is a dialog they have to dismiss to see where they went.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('opens the two tools nothing else on this screen can', () => {
    /*
     * The five regions are the content of a row now, which is the point of the
     * rebuild - but three of them kept a fixed control and two did not. A GM
     * improvising a fight had to ADD an encounter, name it, submit it, open the
     * row and press OPEN THE BUILDER, creating a plan row they may not want,
     * where the old screen had a tab.
     */
    openMenu();
    click(named('THE ENCOUNTER BUILDER'));
    expect(openTool()).toBe('Encounter builder');

    // And the sheet handed the screen over rather than stacking under it.
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('leaves the three that already have a door where they are', () => {
    // The rule that keeps Settings out of this sheet: a second route to a
    // destination that already has one is a door nobody chose to build. The
    // sentence says where they are, so the absence is an answer, not a gap.
    openMenu();
    const labels = buttons().map((b) => (b.textContent ?? '').trim());
    expect(labels).not.toContain('BESTIARY');
    expect(labels).not.toContain('THE PARTY BOARD');
    expect(labels).not.toContain('FEAR AND COUNTDOWNS');
    expect(text()).toContain('behind the Fear number at the top');
    expect(text()).toContain('behind SHOW');
  });

  /*
   * The same sentence, in the two preference states it used to be false in.
   *
   * `GmBar` opens SHOW only while one half of its fork is switched on and drops
   * the verb entirely when both are off, and Settings already says so in words:
   * "With both off SHOW has nothing left to open, so it leaves the GM screen's
   * bottom bar". This sheet named SHOW unconditionally, so with the bestiary
   * and the party board switched off it sent the GM to a control that was not
   * on the screen - the app contradicting itself about its own bar, two
   * settings apart.
   */
  const sheetText = (): string =>
    container.querySelector('[role="dialog"]')?.textContent ?? '';

  it('names all three doors while both halves of SHOW are switched on', () => {
    openMenu();
    expect(sheetText()).toContain('The other three already have a way in');
    expect(sheetText()).toContain('the bestiary and the party board are behind SHOW');
  });

  it('names only the half of SHOW that is still on the screen', () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmPartyBoard: false } });
    openMenu();
    expect(sheetText()).toContain('The other two already have a way in');
    expect(sheetText()).toContain('the bestiary is behind SHOW');
    expect(
      sheetText(),
      'the sheet sent the GM to SHOW for a tool this build does not offer',
    ).not.toContain('the party board are behind SHOW');
    // And the tool that is gone is accounted for, so its absence is an answer
    // rather than a gap - the same rule the sentence exists to keep.
    expect(sheetText()).toContain('The party board is switched off in Settings');
  });

  it('does not point at SHOW when SHOW is not on the bar', () => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, gmBestiary: false, gmPartyBoard: false } });
    openMenu();
    expect(
      sheetText(),
      'MENU named a verb the GM can look down at the bar and not find',
    ).not.toContain('behind SHOW');
    expect(sheetText()).toContain('behind the Fear number at the top');
    expect(sheetText()).toContain('SHOW is not on the bottom bar at all');
  });

  it('does not offer Settings, because the header already does on every screen', () => {
    openMenu();
    expect(buttons().map((b) => (b.textContent ?? '').trim())).not.toContain('SETTINGS');
  });

  it('marks the open campaign and switches to another', async () => {
    twoCampaigns();
    openMenu();
    expect(named('The Sablewood Winter — open').getAttribute('aria-current')).toBe('true');
    click(named('Open A one-shot'));
    await settle();
    expect(useGm.getState().activeCampaignId).toBe('c-other');
  });

  it('makes a new campaign', async () => {
    twoCampaigns();
    openMenu();
    click(named('NEW CAMPAIGN'));
    await settle();
    expect(useGm.getState().campaigns).toHaveLength(3);
  });

  it('removes nothing on one tap', async () => {
    twoCampaigns();
    openMenu();
    click(named('REMOVE — A one-shot'));
    await settle();
    expect(useGm.getState().campaigns).toHaveLength(2);
    expect(text()).toContain('TAP AGAIN TO REMOVE');
    click(named('TAP AGAIN TO REMOVE — A one-shot'));
    await settle();
    expect(useGm.getState().campaigns.map((c) => c.id)).toEqual(['c-open']);
  });

  it('offers the rename on the open campaign alone, and says why', () => {
    /*
     * One control, and the sentence beside it says what to do instead.
     *
     * This used to be a wall around a broken write - `patchCampaign` scheduled
     * nothing for an id that was not the active one - and the copy on screen
     * said so, in those words. The store honours it now (`scheduleAside`), so
     * that sentence would be a promise of a defect that no longer exists, on a
     * screen whose whole argument is that it does not say untrue things. The
     * copy is now the one thing the user can act on: open the other campaign.
     * Where renaming finally lives is a design question with its own item.
     */
    twoCampaigns();
    openMenu();
    expect(buttons().filter((b) => (b.textContent ?? '').trim() === 'RENAME')).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>('[role="dialog"] input')!.value).toBe(
      'The Sablewood Winter',
    );
    expect(text()).toContain('Only the open campaign can be renamed here');
  });

  it('renames the open campaign', () => {
    twoCampaigns();
    openMenu();
    type(container.querySelector('[role="dialog"] input')!, 'The Long Winter');
    click(named('RENAME'));
    expect(activeCampaign().name).toBe('The Long Winter');
  });

  it('refuses a name that is nothing at all, in words', () => {
    // Two campaigns both reading "Unnamed campaign" are two rows in the list
    // above that nobody can tell apart - and quietly restoring the old name is
    // the other half of the same defect.
    twoCampaigns();
    openMenu();
    type(container.querySelector('[role="dialog"] input')!, '   ');
    expect(named('RENAME').disabled).toBe(true);
    click(named('RENAME'));
    expect(activeCampaign().name).toBe('The Sablewood Winter');
    expect(text()).toContain('A campaign needs a name');
  });

  it('names a campaign a newer build wrote, rather than counting it', () => {
    // `quarantined` and `notices` have been computed and tested since campaigns
    // were built, and drawn nowhere. "One campaign could not be read" is a
    // sentence nobody can act on.
    useGm.setState({
      notices: ['"A one-shot": the Fear pool held 40, which is outside 0-12, so it was brought back inside.'],
      quarantined: [
        { id: 'q1', name: 'Next Winter', schemaVersion: 9, reason: 'That campaign was written by a newer version of this app.' },
      ],
    });
    openMenu();
    expect(text()).toContain('Next Winter');
    expect(text()).toContain('written by a newer version');
    expect(text()).toContain('Nothing has been deleted');
    expect(text()).toContain('brought back inside');
  });

  it('says the campaigns are still being read, before they are', () => {
    useGm.setState({ hydrated: false });
    openMenu();
    expect(text()).toContain('still being read');
  });
});

// ---------------------------------------------------------------------------

describe('the sheets, at 393x852', () => {
  /** A declared length in px. Tokens resolve as they do below 1180px. */
  const px = (value: string): number => {
    if (value === 'var(--tap)' || value === 'var(--control)') return 44;
    if (value === '') return 0;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const undersized = (): string[] =>
    [...container.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] input, [role="dialog"] select')]
      .filter((el) => Math.max(px(el.style.height), px(el.style.minHeight)) < 44)
      .map((el) => `${el.tagName} ${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30)}`);

  it('puts no target under the touch floor in any of the four', async () => {
    gm();
    for (const verb of ['ADD', 'SHOW', 'SAVE']) {
      click(named(verb));
      // SAVE flushes on mount and speaks when that resolves, so the sweep has
      // to look at the sheet it settles into rather than the one it opens as.
      await settle(2);
      expect(undersized(), `${verb} has a target under 44px`).toEqual([]);
    }
    // MENU opens from the top of the screen rather than from the bar.
    click(leading('MENU'));
    expect(undersized(), 'MENU has a target under 44px').toEqual([]);
  });

  it('puts no target under the touch floor in any of ADD’s four forms', () => {
    gm();
    click(named('ADD'));
    for (const kind of ['SCENE', 'ENCOUNTER', 'LINK', 'COUNTDOWN']) {
      click(leading(kind));
      expect(undersized(), `ADD → ${kind} has a target under 44px`).toEqual([]);
      click(named('← THE FOUR KINDS'));
    }
  });
});
