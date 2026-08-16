// @vitest-environment jsdom
/**
 * The GM screen as a whole: what stays pinned, and how the five tools open.
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
import type { SessionItem } from '../../shared/campaigns.ts';
import { countdownsOf } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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

  it('reaches the two tools no row can open', () => {
    // Until the bottom bar's SHOW exists, these are the only route to them,
    // and dropping them while rebuilding the screen would be a regression.
    gm();
    click(named('BESTIARY'));
    expect(openTool()).toBe('Bestiary');
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
    click(named('PARTY'));
    expect(openTool()).toBe('The party board');
    act(() => {
      useGm.getState().setRegion('scene');
    });
    expect(openTool()).toBe('The live scene');
  });

  it('unmounts a tool when it closes rather than hiding it', () => {
    // PartyBoard's scanner opens the camera in an effect and stops it on
    // unmount; a sheet kept alive behind `display: none` leaves it running.
    gm();
    click(named('PARTY'));
    expect(openTool()).toBe('The party board');
    click(named('Close The party board'));
    expect(openTool()).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes on Escape, and says so where a keyboard exists', () => {
    gm();
    click(named('BESTIARY'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(openTool()).toBeNull();
  });

  it('never has two dialogs alive at once', () => {
    // The reason a link row draws a domain card in the row instead of opening
    // `CardReader`: `useDialog` registers one unconditional window keydown
    // listener per dialog, with no topmost check.
    gm();
    click(named('BESTIARY'));
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });
});
