// @vitest-environment jsdom
/**
 * The name generator on the glass: the door to it, and the four things it
 * reads before it answers.
 *
 * `tests/engine/names.test.ts` is where COLLISION is proved - the whole
 * producible space against every `name` the shipped dataset carries. Nothing
 * here repeats that. What is only provable here is that the screen hands the
 * engine the right `taken`: the engine cannot invent the campaign, and a
 * component that forgets to pass one of the four sources would keep every one
 * of the engine's tests green while handing a GM the name of the adversary
 * standing in front of the party.
 *
 * The trick each of those tests uses is the same. The place space is 336
 * strings, all of them enumerable, so the test fills it through *one* source at
 * a time and then asks what comes out. A draw that ignores `taken` entirely
 * still looks correct 99.7% of the time on a single try, so what makes each of
 * these bite is that there is nothing else it could correctly return.
 *
 * **Two shapes, and the difference is not cosmetic.** Where the source under
 * test is `combatants` - which is also what `fill` uses - one string is left
 * free and one draw settles it. Where it is `session` or `party`, the string
 * that source contributes has to be held out of the filler as well, or the test
 * would pass with the source ignored; that leaves **two** free strings under
 * the mutation, so a single draw is a coin flip. A first pass at this file
 * asserted a single draw in both shapes and claimed in this paragraph that one
 * string was always free: the two tests that need it wrong killed their own
 * mutation half the time. They draw repeatedly instead, which takes the same
 * mutation from 50% to better than the 99.7% the other two get.
 *
 * The rng is the real one. This screen is mounted by `Gm.tsx` without a seed
 * and that is what ships, so seeding it here would be testing a component the
 * app does not build. Nothing below depends on which name comes out, only on
 * which names cannot.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign, SessionItem } from '../../shared/campaigns.ts';
import type { PartyMember, SceneCombatant } from '../../shared/types.ts';
import { enumerateNames } from '../../src/engine/names.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index, playedCharacter } from '../ui/fixture.ts';
import { NO_FIGHT } from '../fixtures/factories.ts';

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
    combatants: [], liveScene: null,
    party: [],
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

const menu = (): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').startsWith('MENU'));
  if (found === undefined) throw new Error('the top bar has no MENU button');
  return found;
};

const openTool = (): string | null =>
  container.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null;

/** MENU, then the generator - the whole route a GM takes to reach it. */
const openNames = (): void => {
  gm();
  click(menu());
  click(named('OPEN THE NAME GENERATOR'));
};

/** The one live region on the screen, which holds the name just drawn. */
const shown = (): string =>
  (
    container.querySelector('[role="dialog"]')?.querySelector('[aria-live="polite"]')?.textContent ??
    ''
  ).trim();

/** DRAW, whichever of its two words it is wearing. */
const drawButton = (): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim().startsWith('DRAW'));
  if (found === undefined) throw new Error('no DRAW control');
  return found;
};

const draw = (times = 1): void => {
  for (let i = 0; i < times; i += 1) click(drawButton());
};

const PLACES = enumerateNames('place');

const sceneRow = (name: string, at: number): SessionItem => ({
  kind: 'scene',
  id: `row-${String(at)}`,
  name,
  order: at,
  collapsed: true,
  environmentRef: null,
  ...NO_FIGHT,
});

const combatant = (name: string, at: number): SceneCombatant => ({
  id: `foe-${String(at)}`,
  adversaryRef: 'srd-1.0/adversaries/acid-burrower',
  name,
  hp: { marked: 0, max: 5 },
  stress: { marked: 0, max: 3 },
  thresholds: [7, 14],
  difficulty: 14,
  spotlighted: false,
  notes: '',
});

const member = (name: string, at: number): PartyMember => ({
  id: `pc-${String(at)}`,
  sheet: { ...playedCharacter(), name },
  importedAt: '2026-08-18T00:00:00.000Z',
  source: 'file',
  tracks: { hp: 0, stress: 0, hope: 2, armor: 0 },
  markedAt: null,
});

/**
 * Take every place name but the ones listed, through the live scene.
 *
 * The bulk goes into `combatants` rather than into `session` because the scene
 * is not drawn while this dialog is over the list - a chip in the top bar
 * counts them and nothing else renders - whereas 336 session rows are 336
 * mounted components behind a dialog nobody is looking at, which cost this file
 * forty seconds of the suite for no assertion at all.
 */
const fill = (keepFree: readonly string[]): void => {
  const free = new Set(keepFree);
  act(() => {
    useGm.setState({
      combatants: PLACES.filter((name) => !free.has(name)).map(combatant),
    });
  });
};

/**
 * Throw the screen away and put a fresh one up, keeping the store.
 *
 * The generator holds the names it has already handed out in its own state, so
 * a second draw on the same mount is asking a different question. Where a test
 * needs the same question more than once - because one draw only has a 50%
 * chance of catching its mutation - it asks it of a new screen each time.
 */
const remount = (): void => {
  act(() => root.unmount());
  container.remove();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
};

/** Open the generator on PLACE, with the campaign already loaded. */
const openOnPlaces = (): void => {
  openNames();
  click(named('Name a place'));
};

// ---------------------------------------------------------------------------

describe('the way in', () => {
  it('is a button in MENU, and nothing is open before it is pressed', () => {
    gm();
    expect(openTool()).toBeNull();
    click(menu());
    expect(named('OPEN THE NAME GENERATOR')).toBeDefined();
    click(named('OPEN THE NAME GENERATOR'));
    expect(openTool()).toBe('Names and places');
  });

  it('hands the screen over rather than stacking two dialogs on it', () => {
    openNames();
    expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('remembers itself on the record, the way every other tool does', () => {
    openNames();
    expect(useGm.getState().region).toBe('names');
  });

  it('opens with nothing drawn, and says so rather than showing a stale name', () => {
    openNames();
    expect(shown()).toBe('Nothing drawn yet.');
  });
});

describe('what it draws', () => {
  it('puts a name from the person space on the screen', () => {
    openNames();
    draw();
    expect(enumerateNames('person')).toContain(shown());
  });

  it('draws from the kind the GM chose, not the one it opened on', () => {
    openOnPlaces();
    draw();
    expect(PLACES).toContain(shown());
    click(named('Name a region or a landmark'));
    draw();
    expect(enumerateNames('region')).toContain(shown());
  });

  it('never repeats itself inside one sitting', () => {
    // The sitting's own list is one of the four sources of `taken`, and it is
    // the one a generator written the obvious way forgets: 40 draws out of 336
    // places collide about nine times out of ten by birthday alone.
    openOnPlaces();
    draw(40);
    const listed = [
      shown(),
      ...[...container.querySelectorAll('li')].map((li) => (li.textContent ?? '').trim()),
    ];
    expect(listed).toHaveLength(40);
    expect(new Set(listed).size).toBe(40);
  });

  it('says where the words came from, on the screen and not only in a docblock', () => {
    openNames();
    const text = container.textContent ?? '';
    expect(text).toContain('The Core Book’s name lists are not in this app');
    expect(text).toContain('15,325 names in all');
  });
});

describe('the campaign is what `taken` is made of', () => {
  it('will not hand back a name that is a row in tonight’s session', () => {
    // Twelve draws, not one: `viaRow` is held out of the filler so that the
    // session is the only thing that can take it, which leaves two free strings
    // if the session is ignored. One draw would then be right half the time.
    const [free, viaRow] = [PLACES[100] as string, PLACES[101] as string];
    fill([free, viaRow]);
    act(() => {
      useGm.setState({ session: [sceneRow(viaRow, 0)] });
    });
    // Remounted between draws, not drawn twice: the screen adds its own draws
    // to `taken`, so after the first the space is exhausted and the repeat path
    // returns anything. A fresh mount asks the same question again.
    for (let i = 0; i < 12; i++) {
      openOnPlaces();
      draw();
      expect(shown(), `draw ${String(i + 1)} handed back a session row’s name`).toBe(free);
      remount();
    }
  });

  it('will not hand back the name of something standing on the live scene', () => {
    // The filler is combatants too, so this one is the source proving itself -
    // and it is the source `fill` leans on, which is why it is asserted first
    // of the four rather than taken on trust by the other three.
    const free = PLACES[7] as string;
    fill([free]);
    openOnPlaces();
    draw();
    expect(shown()).toBe(free);
  });

  it('will not hand back a player character’s name', () => {
    // The collision that actually costs the evening something: an NPC named
    // after somebody at the table. Twelve draws for the same reason as the
    // session test above - two strings are free if `party` is dropped.
    const [free, viaSheet] = [PLACES[200] as string, PLACES[201] as string];
    fill([free, viaSheet]);
    act(() => {
      useGm.setState({ party: [member(viaSheet, 0)] });
    });
    for (let i = 0; i < 12; i++) {
      openOnPlaces();
      draw();
      expect(shown(), `draw ${String(i + 1)} handed back a player’s name`).toBe(free);
      remount();
    }
  });

  it('ignores the empty name a session row is allowed to carry', () => {
    // `SessionItemBase.name` may be ''. An empty string left in `taken` is
    // harmless to the generator and would make this test pass for the wrong
    // reason, so the row that carries one is here on purpose.
    const free = PLACES[3] as string;
    fill([free]);
    act(() => {
      useGm.setState({ session: [sceneRow('', 0)] });
    });
    openOnPlaces();
    draw();
    expect(shown()).toBe(free);
  });

  it('repeats rather than refusing when the campaign has used every one', () => {
    fill([]);
    openOnPlaces();
    draw();
    expect(PLACES).toContain(shown());
  });
});

describe('ergonomics, 393 x 852', () => {
  /** A declared length in px. Tokens resolve as they do below 1180px. */
  const px = (value: string): number => {
    if (value === 'var(--tap)' || value === 'var(--control)') return 44;
    if (value === '') return 0;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const inTool = (): HTMLButtonElement[] => [
    ...(container.querySelector('[role="dialog"]')?.querySelectorAll('button') ?? []),
  ];

  it('has no target under the 44px touch floor', () => {
    openNames();
    draw(2);
    const short = inTool()
      .filter((b) => px(b.style.minHeight) < 44)
      .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim());
    // CLOSE is `GmSheet`'s own 44px square and declares width and height
    // rather than minHeight, so it is named rather than measured here.
    expect(short.filter((label) => !label.startsWith('Close'))).toEqual([]);
  });

  it('gives DRAW more than the floor, because it is the tap that repeats', () => {
    openNames();
    // `Names.tsx`'s own docblock says 64: "taller than the 44px floor AND
    // taller than the 56px the sheets use". This read `>= 56`, so shrinking it
    // to exactly the value the docblock rules out by name left the suite green
    // - a test that agreed with the code and disagreed with the sentence
    // beside it. `> 56` is the claim that was actually made.
    expect(px(drawButton().style.minHeight)).toBeGreaterThan(56);
  });

  it('keeps DRAW out of the scroller, so a growing list cannot push it away', () => {
    openNames();
    draw(30);
    const scroller = drawButton().closest('.scroll');
    expect(scroller).toBeNull();
  });
});
