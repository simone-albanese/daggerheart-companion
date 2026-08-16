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
import type { Campaign, SessionItem } from '../../shared/campaigns.ts';
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

/**
 * Every topic in turn, with every fold on it opened, and the check run on each.
 *
 * The two whole-screen properties below - the 44px floor and the column width -
 * are only worth having if they cover the topic a builder added last, so they
 * are swept rather than pointed at the one the region opens on.
 */
const eachTopic = (check: (topic: string) => void): void => {
  const strip = container.querySelector('[aria-label="What to look up"]')!;
  const topics = [...strip.querySelectorAll('button')].map(
    (b) => b.getAttribute('aria-label') ?? '',
  );
  for (const topic of topics) {
    click(named(topic));
    // Only the folds inside the reference: the GM bar behind the sheet carries
    // `aria-expanded` on ADD, SHOW and SAVE, and opening one of those would
    // close the very dialog this is sweeping.
    for (let i = 0; i < 40; i++) {
      const shut = folds().find((b) => b.getAttribute('aria-expanded') === 'false');
      if (shut === undefined) break;
      click(shut);
    }
    check(topic);
  }
};

/** The folds of whatever the reference is currently drawing. */
const folds = (): HTMLButtonElement[] =>
  [
    ...(container.querySelector('[role="dialog"]')?.querySelectorAll('button') ?? []),
  ].filter((b) => b.getAttribute('aria-expanded') !== null);

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

  it('offers nothing to press in the body, because a benchmark is a number you copy down', () => {
    openReference();
    // Everything but the sheet's CLOSE and the strip that chooses the subject.
    const inside = container.querySelector('[role="dialog"]')!;
    const strip = inside.querySelector('[aria-label="What to look up"]')!;
    const pressable = [...inside.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') !== 'Close The rules at hand' && !strip.contains(b),
    );
    expect(pressable.map((b) => b.textContent)).toEqual([]);
  });
});

describe('the shape of it on a phone', () => {
  it('never declares a target under the 44px floor, on any topic', () => {
    openReference();
    eachTopic((topic) => {
      const small = buttons()
        .map((b) => ({
          name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 30),
          h: Math.max(px(b.style.height), px(b.style.minHeight)),
        }))
        .filter((t) => t.h < 44);
      expect(small.map((t) => `${t.name} (${String(t.h)}px)`), topic).toEqual([]);
    });
  });

  it('never forces the column wider than the phone, on any topic', () => {
    openReference();
    // 393 less the 12px this region pads either side.
    const COLUMN = 369;
    eachTopic((topic) => {
      const wide = [...container.querySelectorAll<HTMLElement>('*')]
        .filter((el) => px(el.style.width) > COLUMN || px(el.style.minWidth) > COLUMN)
        .map((el) => `${el.tagName}.${String(el.className)} ${el.style.width}/${el.style.minWidth}`);
      expect(wide, `${topic}: wider than the column, so the page scrolls sideways`).toEqual([]);
    });
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

describe('the Fear guidance, beside the Fear counter', () => {
  /** The Fear board lives inside the countdowns tool, reached from the readout. */
  const openFearBoard = (): void => {
    gm();
    click(named('0 of 12 Fear — open Fear and countdowns'));
  };

  /** The fold header carries its label and its summary, so exact text will not do. */
  const fold = (): HTMLButtonElement => {
    const found = buttons().find((b) =>
      (b.textContent ?? '').trim().startsWith('WHAT TO SPEND IT ON'),
    );
    if (found === undefined) throw new Error('the Fear board has no guidance fold');
    return found;
  };

  it('is shut on mount, and its contents are not on the page until it is opened', () => {
    openFearBoard();
    expect(fold().getAttribute('aria-expanded')).toBe('false');
    expect(text()).not.toContain('0-1 Fear');
    expect(text()).not.toContain('steal the spotlight');

    click(fold());
    expect(fold().getAttribute('aria-expanded')).toBe('true');
    expect(text()).toContain('0-1 Fear');
    expect(text()).toContain('Interrupt the players to steal the spotlight and make a move');
    expect(text()).toContain('SRD 1.0 · P.65');
  });

  it('says what is behind it open and closed alike', () => {
    openFearBoard();
    expect((fold().textContent ?? '')).toContain('SRD 1.0');
    click(fold());
    expect((fold().textContent ?? '')).toContain('SRD 1.0');
  });

  it('leaves the twelve targets exactly where they were, at 52px', () => {
    openFearBoard();
    click(fold());
    const pips = [...Array(12).keys()].map((i) => named(`Fear ${String(i + 1)}`));
    expect(pips).toHaveLength(12);
    expect(new Set(pips.map((b) => b.style.height))).toEqual(new Set(['52px']));
    // The fold is below them: the gesture made forty times an evening does not
    // move because a reference was attached to the board.
    expect(pips[11]!.compareDocumentPosition(fold()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the same guidance on the reference screen, from the same component', () => {
    openReference();
    click(named('Fear'));
    expect(text()).toContain('0-1 Fear');
    expect(text()).toContain('SRD 1.0 · P.65');
    // The whole section, not the two parts a screen might have picked: the
    // large-pool advice and the anatomy of a Fear move are here too.
    expect(text()).toContain('Spending Fast');
    expect(text()).toContain('Fear carries over between sessions.');
  });
});

describe('the topic strip', () => {
  it('names every subject and presses exactly one', () => {
    openReference();
    const strip = container.querySelector('[aria-label="What to look up"]')!;
    const chips = [...strip.querySelectorAll('button')];
    expect(chips.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Improvise an adversary',
      'Set a Difficulty',
      'Fear',
      'Advancing a countdown',
      'Range and distance',
      'GM moves and principles',
      'Adversary Experiences',
    ]);
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    click(chips[2]!);
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([chips[2]]);
  });

  it('shows one subject at a time, so the other is gone rather than below', () => {
    openReference();
    expect(text()).toContain('Attack Modifier');
    click(named('Fear'));
    expect(text()).not.toContain('Attack Modifier');
  });
});

describe('the advancement chart, on a dynamic countdown', () => {
  const row = (kind: 'standard' | 'dynamic', value = 4): SessionItem => ({
    id: 'c1',
    kind: 'countdown',
    name: 'The ritual',
    order: 0,
    collapsed: true,
    primary: false,
    countdown: { id: 'c1', name: 'The ritual', kind, start: 6, value, notes: '' },
  });

  const openBoard = (item: SessionItem): void => {
    act(() => {
      useGm.setState({ session: [item], countdowns: countdownsOf([item]) });
    });
    gm();
    click(named('0 of 12 Fear — open Fear and countdowns'));
  };

  const chartFold = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.textContent ?? '').trim().startsWith('ADVANCE BY A ROLL'));

  it('is shut on mount, below a −/+ row that has not moved or shrunk', () => {
    openBoard(row('dynamic'));
    const fold = chartFold();
    expect(fold?.getAttribute('aria-expanded')).toBe('false');
    // The one-tap gesture keeps its 48px and its place above the fold.
    const minus = named('Advance The ritual by one');
    const plus = named('Move The ritual back by one');
    expect([minus.style.minHeight, plus.style.minHeight]).toEqual(['48px', '48px']);
    expect(minus.compareDocumentPosition(fold!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers exactly the six cells the SRD gives a number for', () => {
    openBoard(row('dynamic'));
    click(chartFold()!);
    const cells = buttons()
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((label) => label.startsWith('The ritual: '));
    expect(cells).toEqual([
      'The ritual: Failure with Fear, Consequence Advancement — advance by 3',
      'The ritual: Failure with Hope, Consequence Advancement — advance by 2',
      'The ritual: Success with Fear, Progress Advancement — advance by 1',
      'The ritual: Success with Fear, Consequence Advancement — advance by 1',
      'The ritual: Success with Hope, Progress Advancement — advance by 2',
      'The ritual: Critical Success, Progress Advancement — advance by 3',
    ]);
    // The four the SRD gives no number for are printed and are not pressable.
    expect(text()).toContain('No advancement');
  });

  it('moves the countdown by what the cell says, and only when pressed', () => {
    openBoard(row('dynamic'));
    click(chartFold()!);
    expect(useGm.getState().countdowns[0]!.value).toBe(4);
    click(named('The ritual: Failure with Fear, Consequence Advancement — advance by 3'));
    // Pass `+3` instead of `-3` and it goes the wrong way to 6, clamped at
    // `start`; take the Progress column's delta for this row and there is
    // nothing to take, because that cell is `No advancement` and is not a
    // button at all. Only `-3` gives 1.
    expect(useGm.getState().countdowns[0]!.value).toBe(1);
  });

  it('names the sentence that tells the two columns apart, because the app cannot', () => {
    openBoard(row('dynamic'));
    click(chartFold()!);
    expect(text()).toContain('Progress countdowns');
    expect(text()).toContain('Consequence countdowns');
    expect(text()).toContain('SRD 1.0 · P.69');
  });

  it('is not offered on a standard countdown, whose rule this is not', () => {
    openBoard(row('standard'));
    expect(chartFold()).toBeUndefined();
  });

  it('draws every cell and no button on the reference screen, which has no countdown', () => {
    openReference();
    click(named('Advancing a countdown'));
    expect(text()).toContain('Failure with Fear');
    expect(text()).toContain('Critical Success');
    expect(text()).toContain('Tick down 3');
    expect(text()).toContain('No advancement');
    const inside = container.querySelector('[role="dialog"]')!;
    const strip = inside.querySelector('[aria-label="What to look up"]')!;
    const pressable = [...inside.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') !== 'Close The rules at hand' && !strip.contains(b),
    );
    expect(pressable.map((b) => b.textContent)).toEqual([]);
  });
});

describe('the distances, and the metres the SRD does not print', () => {
  const distance = (): void => {
    openReference();
    click(named('Range and distance'));
  };

  it('prints the SRD’s own sentence for every range', () => {
    distance();
    expect(text()).toContain('Close enough to see fine details, about 5-10 feet away.');
    expect(text()).toContain('SRD 1.0 · P.40');
    // The six names, including the two the SRD gives no distance for.
    for (const name of ['Melee', 'Very Close', 'Close', 'Far', 'Very Far', 'Out of Range']) {
      expect(text(), name).toContain(name);
    }
  });

  it('never prints a metric figure without saying whose arithmetic it is', () => {
    distance();
    const figures = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
      /≈ [\d.]+(-[\d.]+)? m/.test(el.textContent ?? ''),
    );
    expect(figures.length).toBeGreaterThan(0);
    // Every element that carries a figure carries the label too, down to the
    // innermost one - a metric number on its own beside an SRD stamp is the
    // app quoting itself as the book.
    for (const el of figures) {
      expect(el.textContent, el.textContent ?? '').toContain('COMPUTED BY THIS APP');
    }
    // And the legend states the multiplication and the rounding in full.
    expect(text()).toContain('0.3048');
    expect(text()).toContain('nearest half metre below ten');
  });

  it('converts what the SRD gives, at the figures the arithmetic actually yields', () => {
    distance();
    expect(text()).toContain('≈ 1.5-3 m');
    expect(text()).toContain('≈ 30-91 m');
    // 0.3 instead of 0.3048 and 300 feet reads 90 m; whole metres everywhere
    // and 5 feet reads 2 m.
    expect(text()).not.toContain('≈ 30-90 m');
  });

  it('gives Melee no metric figure, because the SRD gives it no number', () => {
    distance();
    const melee = [...container.querySelectorAll<HTMLElement>('article')].find((el) =>
      (el.textContent ?? '').startsWith('Melee'),
    )!;
    expect(melee.textContent).toContain('up to a few feet away');
    expect(melee.textContent).not.toContain('≈');
  });

  it('folds away the four subheads that are read once, and opens shut', () => {
    distance();
    expect(folds().map((b) => (b.textContent ?? '').trim())).toEqual([
      'Optional Rule: Defined Ranges',
      'MOVEMENT UNDER PRESSURE',
      'AREA OF EFFECT',
      'LINE OF SIGHT & COVER',
    ]);
    expect(folds().map((b) => b.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(text()).not.toContain('3 squares');
    click(folds()[0]!);
    expect(text()).toContain('3 squares');
  });
});

describe('setting a Difficulty, with the SRD’s worked examples', () => {
  const difficulty = (): void => {
    openReference();
    click(named('Set a Difficulty'));
  };

  it('opens on a trait, every verb, and the six numbers', () => {
    difficulty();
    expect(text()).toContain('SRD 1.0 · P.66');
    // Every verb by default: the question a GM arrives with is a scan, not a
    // lookup, and the filter is for the one who already knows the verb.
    expect(text()).toContain('Sprint within Close range across an open field with an enemy present.');
    expect(text()).toContain('Make a running jump of half your height (about 3 feet for a human).');
    expect(text()).toContain('Walk slowly across a narrow beam.');
    const rolls = [...container.querySelectorAll<HTMLElement>('article .t-num')].map(
      (el) => (el.textContent ?? '').trim(),
    );
    expect(rolls).toEqual(['5', '10', '15', '20', '25', '30']);
  });

  it('says whose ladder this is and who does not set it, in the SRD’s own words', () => {
    difficulty();
    // The first sentence is what the app's six read-only DIF displays already
    // show; the second is the only case the ladder covers.
    expect(text()).toContain('equal to the adversary');
    expect(text()).toContain('without a specified Difficulty');
  });

  it('names the trait chips for ears as well as eyes', () => {
    difficulty();
    const traits = container.querySelector('[aria-label="Which trait"]')!;
    const chips = [...traits.querySelectorAll('button')];
    // AGI is a name for eyes only, so the accessible name is the whole word.
    expect(chips.map((b) => (b.textContent ?? '').trim())).toEqual([
      'Agi',
      'Str',
      'Fin',
      'Ins',
      'Pre',
      'Kno',
    ]);
    expect(chips.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Agility',
      'Strength',
      'Finesse',
      'Instinct',
      'Presence',
      'Knowledge',
    ]);
    expect(chips.map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('switches the whole table, verbs and all, when a trait is pressed', () => {
    difficulty();
    click(named('Knowledge'));
    expect(text()).toContain('Recall uncommon facts about your community.');
    expect(text()).not.toContain('Walk slowly across a narrow beam.');
    const verbs = container.querySelector('[aria-label="Which kind of roll"]')!;
    // Read off the table's own header, so a layer that renames a verb renames
    // the chip - which is why they are not `TRAIT_VERBS` from shared/types.ts.
    expect([...verbs.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim())).toEqual([
      'ALL',
      'Recall',
      'Analyze',
      'Comprehend',
    ]);
  });

  it('narrows to one verb, and drops the choice when the trait changes under it', () => {
    difficulty();
    click(named('Maneuver'));
    expect(text()).toContain('Walk slowly across a narrow beam.');
    expect(text()).not.toContain('Make a running jump of half your height (about 3 feet for a human).');
    // A verb belongs to one trait's table. Carry it across and the new table is
    // filtered by a column it does not have, which draws six empty panels.
    click(named('Strength'));
    expect(text()).toContain('Lift a chair.');
    expect(text()).toContain('Destroy a glass cup.');
    expect(text()).toContain('Subdue a child.');
  });

  it('puts each sentence under the verb it belongs to, not the one beside it', () => {
    difficulty();
    click(named('Leap'));
    // `cells` excludes the roll value, so cells[i] lines up with verbs[i]. Push
    // the roll into the row and everything shifts one column left: this panel
    // would show the Sprint sentence under the heading Leap.
    const first = container.querySelector<HTMLElement>('article')!;
    expect(first.textContent).toContain('Leap');
    expect(first.textContent).toContain('Make a running jump of half your height');
    expect(first.textContent).not.toContain('Sprint within Close range');
  });
});

describe('the GM chapter, behind five folds', () => {
  const moves = (): void => {
    openReference();
    click(named('GM moves and principles'));
  };

  it('names the five sections and opens none of them', () => {
    moves();
    expect(folds().map((b) => (b.textContent ?? '').trim())).toEqual([
      'GM PrinciplesSRD 1.0 · P.63',
      'GM PracticesSRD 1.0 · P.63',
      'Making GM MovesSRD 1.0 · P.64',
      'GM Moves and Adversary ActionsSRD 1.0 · P.37',
      'Pitfalls to AvoidSRD 1.0 · P.64',
    ]);
    // Four pages between them, so the stamp sits on each fold and never on the
    // topic: one number over the other four would be false four times.
    expect(folds().every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(text()).not.toContain('Use the fiction to drive mechanics');
  });

  it('draws a whole section when one is opened, headings and bullets alike', () => {
    moves();
    click(folds()[0]!);
    expect(text()).toContain('BEGIN AND END WITH THE FICTION');
    expect(text()).toContain('Use the fiction to drive mechanics, then connect the mechanics back');
    click(folds()[4]!);
    // Five of the six pitfalls are in capitals and this one is not. Match
    // headings as all-caps and the app decides one of the SRD's warnings is
    // not worth reading.
    expect(text()).toContain('Overplanning');
    expect(text()).toContain('HOARDING FEAR');
  });

  it('gives the p.37 restatement a home, which nothing in the app had', () => {
    moves();
    click(folds()[3]!);
    expect(text()).toContain('Gives them a golden opportunity.');
    expect(text()).toContain('Fear Features');
  });
});

describe('the adversary Experiences', () => {
  const experiences = (): void => {
    openReference();
    click(named('Adversary Experiences'));
  };

  it('lists all eighteen with the rule that makes them do anything', () => {
    experiences();
    expect(text()).toContain('EXPERIENCE (OPTIONAL)');
    expect(text()).toContain('spend a Fear');
    expect(text()).toContain('SRD 1.0 · P.71');
    for (const name of ['Acrobatics', 'Hunt from Above', 'Magical Knowledge', 'Tracker']) {
      expect(text(), name).toContain(name);
    }
  });

  it('offers not one of them as a tap, because there is no adversary to edit', () => {
    experiences();
    const inside = container.querySelector('[role="dialog"]')!;
    const strip = inside.querySelector('[aria-label="What to look up"]')!;
    const pressable = [...inside.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') !== 'Close The rules at hand' && !strip.contains(b),
    );
    expect(pressable.map((b) => b.textContent)).toEqual([]);
  });
});
