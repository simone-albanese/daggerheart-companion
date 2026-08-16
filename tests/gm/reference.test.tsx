// @vitest-environment jsdom
/**
 * The GM reference: the door to it, and what it draws.
 *
 * Two properties are worth more than the rest here.
 *
 * The first is provenance. Every string on this surface is read out of
 * `data/srd-1.0.json` at render time, and the page stamp beside a table has to
 * be *that table's* page - the improvise topic composes one table from page 73
 * and another from page 102, so a single stamp for the screen would print a
 * page number over text that is not on it. `srdReference.test.ts` pins the
 * values; this pins that they reach the glass with the right number beside
 * them.
 *
 * The second is that the door exists at all. The defect class this repo keeps
 * shipping is code that works and is never reached, and a reference region
 * mounted behind no button would be the purest example of it yet.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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
    partyTier: 1,
    region: 'encounter',
    writeError: null,
    replacedOnLoad: false,
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
  const found = buttons().find(
    (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label,
  );
  if (found === undefined) {
    throw new Error(
      `no control called "${label}". Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
};

/** The top bar's MENU button, whose name is the word plus the campaign's. */
const menu = (): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').startsWith('MENU'));
  if (found === undefined) throw new Error('the top bar has no MENU button');
  return found;
};

/** Which dialog is over the list, by its own accessible name. */
const openTool = (): string | null =>
  container.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null;

/** MENU, then the reference — the whole route a GM takes to reach it. */
const openReference = (): void => {
  gm();
  click(menu());
  click(named('OPEN THE REFERENCE'));
};

/** A declared length in px. Tokens resolve as they do below 1180px. */
function px(value: string): number {
  if (value === 'var(--tap)' || value === 'var(--control)') return 44;
  if (value === '') return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------

describe('the way in', () => {
  it('is a button in MENU, and nothing is open before it is pressed', () => {
    gm();
    expect(openTool()).toBeNull();
    click(menu());
    expect(openTool()).toBe('Menu and campaigns');
    expect(named('OPEN THE REFERENCE')).toBeDefined();
    click(named('OPEN THE REFERENCE'));
    expect(openTool()).toBe('The rules at hand');
  });

  it('hands the screen over rather than stacking two dialogs on it', () => {
    // `useDialog` registers one unconditional keydown listener per dialog with
    // no topmost check, so two alive at once is one Escape closing both.
    openReference();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('remembers itself on the record, the way every other tool does', () => {
    openReference();
    expect(useGm.getState().region).toBe('reference');
  });
});

describe('what the reference draws', () => {
  it('puts the adversary benchmarks on the screen, from the dataset', () => {
    openReference();
    // Delete the `tool === 'reference'` branch in Gm.tsx and the sheet opens
    // with an empty body: every one of these is gone.
    expect(text()).toContain('Adversary Stat Block Benchmarks');
    expect(text()).toContain('4d8+10 to 4d12+15');
    expect(text()).toContain('Major 25/Severe 45');
  });

  it('stamps each table with its own page, not the screen with one page', () => {
    openReference();
    const stamps = [...container.querySelectorAll<HTMLElement>('span')]
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t.startsWith('SRD 1.0'));
    // 73 is the adversary table, 102 is the environment table thirty pages
    // away. One stamp for the topic would put one of these over the other.
    expect(stamps).toEqual(['SRD 1.0 · P.73', 'SRD 1.0 · P.102']);
  });

  it('draws the campaign’s own tier first, and marks it as the app’s own note', () => {
    act(() => {
      useGm.setState({ partyTier: 3 });
    });
    openReference();
    const headings = [...container.querySelectorAll<HTMLElement>('.t-label')]
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t.startsWith('Tier '));
    expect(headings.slice(0, 4)).toEqual(['Tier 3', 'Tier 1', 'Tier 2', 'Tier 4']);
    expect(text()).toContain('PARTY TIER');
    // The marking is the app noting where the campaign is. It says so.
    expect(text()).toContain('the tier this campaign is set to');
  });

  it('offers nothing to press, because a benchmark is a number you copy down', () => {
    openReference();
    const inside = container.querySelector('[role="dialog"]')!;
    const pressable = [...inside.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') !== 'Close The rules at hand',
    );
    expect(pressable.map((b) => b.textContent)).toEqual([]);
  });
});

describe('the shape of it on a phone', () => {
  it('never declares a target under the 44px floor', () => {
    openReference();
    const small = buttons()
      .map((b) => ({
        name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 30),
        h: Math.max(px(b.style.height), px(b.style.minHeight)),
      }))
      .filter((t) => t.h < 44);
    expect(small.map((t) => `${t.name} (${String(t.h)}px)`)).toEqual([]);
  });

  it('never forces the column wider than the phone', () => {
    openReference();
    // 393 less the 12px this region pads either side.
    const COLUMN = 369;
    const wide = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => px(el.style.width) > COLUMN || px(el.style.minWidth) > COLUMN)
      .map((el) => `${el.tagName}.${String(el.className)} ${el.style.width}/${el.style.minWidth}`);
    expect(wide, 'these are wider than the column, so the page scrolls sideways').toEqual([]);
  });

  it('carries its own scroller, because the sheet it opens in clips', () => {
    openReference();
    const region = container.querySelector<HTMLElement>('[role="dialog"] .scroll.stack')!;
    expect(region.style.flex).toBe('1 1 0%');
    expect(region.style.minHeight).toBe('0px');
  });

  it('mounts at 744, 1024 and 1180 without React complaining', () => {
    for (const width of [744, 1024, 1180]) {
      act(() => root.unmount());
      container.remove();
      container = document.createElement('div');
      document.body.append(container);
      root = createRoot(container);
      setViewport(width);
      openReference();
      expect(text(), `nothing drawn at ${String(width)}`).toContain('Attack Modifier');
    }
  });
});
