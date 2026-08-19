// @vitest-environment jsdom
/**
 * The third door behind SHOW, and the two sentences that had to become general
 * for it.
 *
 * WHAT THIS FILE IS FOR. Adding a switchable tool to this screen is not one
 * change, it is five, and four of them are prose: the sheet has to draw the new
 * door, the bar has to keep the verb alive for it, the dialog has to be
 * *announced* as holding it, MENU has to say where it is, and Settings has to
 * stop claiming SHOW has left the bar while it is still there. Two doors made
 * three live states, and every one of those five named `gmBestiary` and
 * `gmPartyBoard` by hand - five copies of a two-item list in five files. Two of
 * the five wrote a string per state as well: `showLabel` had three and three
 * doors make **seven**, and `whereTheOthersAre` had three sentences for the
 * four states two doors can be switched into - the `EIGHT` table below is what
 * three doors make of that one. Seven hand-written strings is not a table of
 * names - it is seven chances to describe a screen that is not on the glass, in
 * the functions whose whole job is to stop that happening.
 *
 * So the source derives all of them from one array, `SHOW_DOORS`, and this file
 * enumerates the states rather than the code. Every one of the seven is
 * asserted here as the English a GM actually hears, because a join that reads
 * "The party board, and rules search" or "The bestiary the merchant and rules
 * search" is exactly the defect a derived string introduces and exactly the one
 * a two-state screenshot never shows.
 *
 * WHAT IT DELIBERATELY DOES NOT HOLD. Geometry. The numbers in `Merchant.tsx`'s
 * `## The numbers` heading came out of Chrome at 393x852 with a named safe
 * area; jsdom has no layout engine, and an assertion on a measured height here
 * would be checking this file's arithmetic rather than the browser's. What IS
 * held is the one length this component declares for its own repeated control -
 * the 56px draw, full width - because that is an inline style and jsdom reads
 * inline styles; and the `var(--tap)` floor on the guidance fold, which `Fold`
 * declares on its own header button and this screen inherits; and the 367.00
 * column, which is not a measurement either - `describe('the column
 * Merchant.tsx states')` re-derives it from the 1px border `GmSheet.tsx`
 * declares and the 12px padding this component declares, so moving either
 * reddens the sentence instead of leaving a reader with a stale figure.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Campaign } from '../../shared/campaigns.ts';
import { seededRng } from '../../src/engine/dice.ts';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Gm } from '../../src/ui/gm/Gm.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { drawStock, EMPTY_STALL, Merchant } from '../../src/ui/gm/Merchant.tsx';
import { andList, liveDoors, sentenceCase, SHOW_DOORS } from '../../src/ui/gm/showDoors.ts';
import { ruleTables } from '../../src/ui/shared/ruleText.ts';
import { dataset, index } from '../ui/fixture.ts';
import { PHONE } from '../ui/tokens.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let baseCampaigns: Campaign[] = [];
let baseActiveId: string | null = null;
let container: HTMLDivElement;
let root: Root;

/** A phone, and a coarse pointer, which is what `--tap` and `--control` read. */
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
    campaigns: baseCampaigns,
    activeCampaignId: baseActiveId,
    notices: [],
    quarantined: [],
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useApp.setState({ prefs: { ...DEFAULT_PREFS } });
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
        .map((b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').slice(0, 24))
        .join(' | ')}`,
    );
  }
  return found;
};
const leading = (prefix: string): HTMLButtonElement => {
  const found = buttons().find((b) => (b.textContent ?? '').trim().startsWith(prefix));
  if (found === undefined) throw new Error(`no control starting "${prefix}"`);
  return found;
};
const dialog = (): HTMLElement => container.querySelector<HTMLElement>('[role="dialog"]')!;

/** Prefs with exactly the named doors switched on. */
const only = (...on: string[]): Prefs => ({
  ...DEFAULT_PREFS,
  gmBestiary: on.includes('gmBestiary'),
  gmPartyBoard: on.includes('gmPartyBoard'),
  gmMerchant: on.includes('gmMerchant'),
});

/**
 * The seven states SHOW can be drawn in, and the name a screen reader hears in
 * each.
 *
 * Written out as English rather than computed, on purpose. Computing the
 * expectation from the same join the source uses would assert that a function
 * equals itself; what is actually at risk is whether the sentence reads, and
 * only a person reading these seven lines can say that.
 */
const SEVEN: Array<{ on: string[]; label: string }> = [
  {
    on: ['gmBestiary', 'gmPartyBoard', 'gmMerchant'],
    label: 'The bestiary, the party board, the merchant and rules search',
  },
  { on: ['gmBestiary', 'gmPartyBoard'], label: 'The bestiary, the party board and rules search' },
  { on: ['gmBestiary', 'gmMerchant'], label: 'The bestiary, the merchant and rules search' },
  { on: ['gmPartyBoard', 'gmMerchant'], label: 'The party board, the merchant and rules search' },
  { on: ['gmBestiary'], label: 'The bestiary and rules search' },
  { on: ['gmPartyBoard'], label: 'The party board and rules search' },
  { on: ['gmMerchant'], label: 'The merchant and rules search' },
];

// ---------------------------------------------------------------------------

describe('the name SHOW is announced under', () => {
  it('covers every live state, so the enumeration below cannot go short', () => {
    // 2^3 − 1. If a fourth door lands, this fails before any of the strings do,
    // which is the failure that tells somebody to write four more lines rather
    // than to loosen an assertion.
    expect(SEVEN).toHaveLength(2 ** SHOW_DOORS.length - 1);
  });

  for (const state of SEVEN) {
    it(`reads as English with ${state.on.length} door(s): "${state.label}"`, () => {
      useApp.setState({ prefs: only(...state.on) });
      gm();
      click(named('SHOW'));
      expect(dialog().getAttribute('aria-label')).toBe(state.label);
    });
  }

  for (const state of SEVEN) {
    it(`names every live door and no dead one with ${state.on.join(' + ')}`, () => {
      // The other half of the same rule, derived rather than transcribed: the
      // screen does not get to claim something that is not there, and it does
      // not get to leave out something that is.
      const prefs = only(...state.on);
      useApp.setState({ prefs });
      gm();
      click(named('SHOW'));
      // Case-insensitively: the leading name is sentence-cased by design, so
      // "the bestiary" is spelled "The bestiary" whenever it is first.
      const label = (dialog().getAttribute('aria-label') ?? '').toLowerCase();
      for (const door of SHOW_DOORS) {
        const live = prefs[door.pref];
        expect(label.includes(door.name), `${door.name} · live=${String(live)}`).toBe(live);
      }
      // And the search is in all seven, because the field is drawn in all seven.
      expect(label).toContain('rules search');
    });
  }

  it('is not asked at all when every door is off, because there is no SHOW', () => {
    useApp.setState({ prefs: only() });
    gm();
    expect(buttons().map((b) => (b.textContent ?? '').trim())).not.toContain('SHOW');
  });
});

describe('the doors SHOW draws', () => {
  for (const state of SEVEN) {
    it(`draws exactly the live ones with ${state.on.join(' + ')}`, () => {
      const prefs = only(...state.on);
      useApp.setState({ prefs });
      gm();
      click(named('SHOW'));
      const choices = [...dialog().querySelectorAll('button')]
        .map((b) => (b.querySelector('span')?.textContent ?? '').trim())
        .filter((label) => label !== '');
      expect(choices).toEqual(liveDoors(prefs).map((door) => door.label));
    });
  }

  it('opens the merchant, which no session row can', () => {
    gm();
    click(named('SHOW'));
    click(leading('THE MERCHANT'));
    expect(dialog().getAttribute('aria-label')).toBe('The merchant');
  });

  it('says on the door itself that it spends nobody’s gold', () => {
    // A tool named for a shopkeeper invites the assumption that buying here
    // marks a slot on a character. The sentence answers it before the tap.
    gm();
    click(named('SHOW'));
    expect(dialog().textContent).toContain('never spends anybody’s gold');
  });

  it('will not follow a stored region into the merchant while it is switched off', () => {
    // The one route into a tool that is not a control. `offered` used to name
    // two regions by hand and answer `true` for everything else, which would
    // have opened a switched-off merchant on every cross-link into it.
    useApp.setState({ prefs: only('gmBestiary', 'gmPartyBoard') });
    gm();
    act(() => {
      useGm.getState().setRegion('merchant');
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    // Remembered all the same: the field belongs to the record, not the screen.
    expect(useGm.getState().region).toBe('merchant');
  });
});

// ---------------------------------------------------------------------------

describe('what MENU says about where the other tools are', () => {
  const FEAR = 'Fear and the countdowns are behind the Fear number at the top';
  const openMenu = (): void => {
    gm();
    // The MENU button carries the campaign name beside the word, so it is
    // reached by prefix rather than by an exact match.
    click(leading('MENU'));
  };
  const sheet = (): string => dialog().textContent ?? '';

  const EIGHT: Array<{ on: string[]; says: string }> = [
    {
      on: ['gmBestiary', 'gmPartyBoard', 'gmMerchant'],
      says: `The other four already have a way in and are not repeated here: ${FEAR}, and the bestiary, the party board and the merchant are behind SHOW.`,
    },
    {
      on: ['gmBestiary', 'gmPartyBoard'],
      says: `The other three already have a way in and are not repeated here: ${FEAR}, and the bestiary and the party board are behind SHOW. The merchant is switched off in Settings.`,
    },
    {
      on: ['gmBestiary', 'gmMerchant'],
      says: `The other three already have a way in and are not repeated here: ${FEAR}, and the bestiary and the merchant are behind SHOW. The party board is switched off in Settings.`,
    },
    {
      on: ['gmPartyBoard', 'gmMerchant'],
      says: `The other three already have a way in and are not repeated here: ${FEAR}, and the party board and the merchant are behind SHOW. The bestiary is switched off in Settings.`,
    },
    {
      on: ['gmBestiary'],
      says: `The other two already have a way in and are not repeated here: ${FEAR}, and the bestiary is behind SHOW. The party board and the merchant are switched off in Settings.`,
    },
    {
      on: ['gmPartyBoard'],
      says: `The other two already have a way in and are not repeated here: ${FEAR}, and the party board is behind SHOW. The bestiary and the merchant are switched off in Settings.`,
    },
    {
      on: ['gmMerchant'],
      says: `The other two already have a way in and are not repeated here: ${FEAR}, and the merchant is behind SHOW. The bestiary and the party board are switched off in Settings.`,
    },
    {
      on: [],
      says: `The one that is left already has a way in and is not repeated here: ${FEAR}. The bestiary, the party board and the merchant are switched off in Settings, so SHOW is not on the bottom bar at all.`,
    },
  ];

  it('has a case for every state the switches can be in', () => {
    expect(EIGHT).toHaveLength(2 ** SHOW_DOORS.length);
  });

  for (const state of EIGHT) {
    it(`counts, lists and conjugates correctly with ${state.on.length} door(s) on${state.on.length ? `: ${state.on.join(', ')}` : ''}`, () => {
      useApp.setState({ prefs: only(...state.on) });
      openMenu();
      expect(sheet()).toContain(state.says);
    });
  }
});

// ---------------------------------------------------------------------------

describe('the merchant', () => {
  const merchant = (rng = seededRng(7)): void => {
    act(() => root.render(createElement(Merchant, { phone: true, rng })));
  };
  const stall = (): HTMLElement => container.querySelector<HTMLElement>('[aria-live="polite"]')!;
  const stock = (): HTMLElement[] => [...stall().querySelectorAll('article')];
  const text = (): string => container.textContent ?? '';

  it('opens with an empty counter and says why it will still be empty next time', () => {
    // The tool is unmounted when its sheet closes, so a stall drawn on mount
    // would be a different shop every time the GM reopened it - replacing one
    // they had already described to four players.
    merchant();
    expect(stock()).toHaveLength(0);
    expect(text()).toContain(EMPTY_STALL);
    expect(named('STOCK THE STALL')).toBeTruthy();
  });

  it('draws six, three of each kind, with nothing drawn twice', () => {
    merchant();
    click(named('STOCK THE STALL'));

    const drawn = stock().map((el) => el.querySelector('span')?.textContent ?? '');
    expect(drawn).toHaveLength(6);
    expect(new Set(drawn).size, 'the same item was on the counter twice').toBe(6);

    const lootNames = new Set(dataset.loot.map((i) => i.name));
    const consumableNames = new Set(dataset.consumables.map((i) => i.name));
    expect(drawn.filter((n) => lootNames.has(n))).toHaveLength(3);
    expect(drawn.filter((n) => consumableNames.has(n))).toHaveLength(3);
  });

  it('replaces the counter rather than adding to it, and renames the control', () => {
    merchant();
    click(named('STOCK THE STALL'));
    expect(stock()).toHaveLength(6);
    click(named('DRAW A NEW STALL'));
    expect(stock(), 'a redraw appended instead of replacing').toHaveLength(6);
  });

  it('puts no target on the counter at all', () => {
    // There is no "sell": the gold is on a character sheet this tool cannot
    // write, and a control that cannot act is a control that lies.
    merchant();
    click(named('STOCK THE STALL'));
    expect(stall().querySelectorAll('button')).toHaveLength(0);
  });

  it('prints the SRD’s own prices, cell for cell, rather than a copy of them', () => {
    /*
     * The assertion that kills a transcription. The expected strings are read
     * out of `data/srd-1.0.json` here, so retyping a single price into
     * `Merchant.tsx` - or drawing a table this app wrote - goes red, and a
     * rules layer that changes a cost changes both sides of this at once.
     */
    const section = dataset.rules.find((r) => r.id === 'giving-out-gold-equipment-and-loot');
    expect(section, 'the fixture dataset has no Average Costs section').toBeDefined();
    const table = ruleTables(section?.body ?? '')[0];
    expect(table, 'the Average Costs section carries no pipe table').toBeDefined();

    merchant();
    for (const cell of [...(table?.header ?? []), ...(table?.rows ?? []).flat()]) {
      expect(text(), `the costs table dropped "${cell}"`).toContain(cell);
    }
    expect(text()).toContain(`P.${String(section?.sourcePage ?? 0)}`);
  });

  it('prints the denominations out of the gold section, not out of this app', () => {
    const gold = dataset.rules.find((r) => r.id === 'gold');
    const first = (gold?.body ?? '').split('\n\n')[0] ?? '';
    expect(first).not.toBe('');
    merchant();
    expect(text()).toContain(first);
    /*
     * And only that paragraph. The rest of the section is the two worked
     * examples, the one-chest cap and an optional coin denomination - slots on
     * a sheet this screen cannot write - and reprinting any of it would be the
     * GM screen explaining a track it cannot touch.
     *
     * The guard is a sentence out of a paragraph the component would have to
     * *print* to fail it, and both excluded paragraphs are named. `not
     * .toContain('Optional Rule: Gold Coins')` stood here and could not fire:
     * that string is a `## ` subhead, so `ruleBlocks` lifts it into
     * `block.heading` and strips it from the text, and `proseOf` returns only
     * `part.kind === 'text'` - no path through this component can print it.
     * Both mutations the comment forbids were run against it and both stayed
     * green: `proseOf(gold?.blocks[0]?.parts ?? []).join(' ')`, which prints
     * the whole intro block, and `proseOf(gold?.blocks.flatMap((b) => b.parts)
     * ?? []).join(' ')`, which prints the optional rule as well. Both go red
     * against the two lines below.
     */
    const rest = (gold?.body ?? '').split('\n\n').slice(1).join('\n\n');
    expect(rest, 'the fixture no longer carries the paragraphs this excludes').toContain(
      'For example, if you have 9 handfuls',
    );
    expect(rest, 'the fixture no longer carries the optional rule this excludes').toContain(
      '10 coins equal 1 handful',
    );
    expect(text()).not.toContain('For example, if you have 9 handfuls');
    expect(text()).not.toContain('10 coins equal 1 handful');
    // And exactly one paragraph under that heading, so a second one added by
    // any route at all is caught even if its wording is not named above.
    const section = [...container.querySelectorAll('section')].find((s) =>
      (s.textContent ?? '').includes(first),
    );
    expect(section?.querySelectorAll('p')).toHaveLength(1);
  });

  it('draws no heading at all when the dataset carries no such section', () => {
    // A heading over nothing is the screen claiming a rule it does not have.
    useApp.setState({
      dataset: {
        ...dataset,
        rules: dataset.rules.filter(
          (r) => r.id !== 'gold' && r.id !== 'giving-out-gold-equipment-and-loot',
        ),
      },
    });
    merchant();
    expect(text()).not.toContain('WHAT THINGS COST');
    expect(text()).not.toContain('GOLD');
    // The stall is untouched by a missing rules section.
    click(named('STOCK THE STALL'));
    expect(stock()).toHaveLength(6);
  });

  it('declares its one repeated target inline, above the coarse floor', () => {
    // jsdom reads inline styles and nothing else, which is why every floor on
    // this screen is declared inline rather than in a class.
    merchant();
    expect(named('STOCK THE STALL').style.minHeight).toBe('56px');
    expect(named('STOCK THE STALL').style.width).toBe('100%');
  });

  it('puts the SRD guidance behind a shut fold at the tap floor', () => {
    merchant();
    const fold = buttons().find((b) => b.getAttribute('aria-expanded') !== null);
    expect(fold, 'the guidance is not behind a fold at all').toBeDefined();
    expect(fold?.getAttribute('aria-expanded')).toBe('false');
    expect(fold?.style.minHeight).toBe('var(--tap)');
    expect(text()).not.toContain('It’s up to you and your players');
    click(fold!);
    expect(text()).toContain('It’s up to you and your players');
  });
});

// ---------------------------------------------------------------------------

describe('drawing stock', () => {
  const pool = dataset.loot;

  it('never hands the same thing over twice', () => {
    // Every seed, not one: a selection that spliced the wrong index would fail
    // on a minority of seeds and pass the one a test happened to pick.
    for (let seed = 1; seed <= 200; seed += 1) {
      const drawn = drawStock(pool, 6, seededRng(seed));
      expect(drawn).toHaveLength(6);
      expect(new Set(drawn.map((i) => i.id)).size, `seed ${String(seed)} repeated`).toBe(6);
    }
  });

  it('reaches every item in the pool rather than a corner of it', () => {
    // An off-by-one in either direction would leave the first or the last item
    // unreachable for ever, which no "no repeats" assertion can see.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 4000; seed += 1) {
      for (const item of drawStock(pool, 6, seededRng(seed))) seen.add(item.id);
    }
    expect(seen.size).toBe(pool.length);
  });

  it('hands over the whole pool when asked for more than it has', () => {
    const three = pool.slice(0, 3);
    expect(drawStock(three, 6, seededRng(1))).toHaveLength(3);
    expect(drawStock([], 6, seededRng(1))).toHaveLength(0);
    expect(drawStock(pool, 0, seededRng(1))).toHaveLength(0);
  });
});

/**
 * The one figure out of `## The numbers` this file can hold, and it is not a
 * measurement.
 *
 * `Merchant.tsx` states its column as 367.00, and that number is the panel's
 * content box less this region's own padding. jsdom cannot measure either, but
 * both are *declared* in source that can be read - so what is held here is that
 * the sentence still names the subtraction the two files still make. Change the
 * padding from 12 to 14 and this goes red, which is the moment somebody has to
 * go back to the rig rather than the moment a reader is misled.
 *
 * `tests/ui/gmGeometryProse.test.ts` does this for the rest of the GM screen
 * and would be the natural home; it is not extended here because another lane
 * is editing it, and a lane that edits a file it does not own is how two
 * branches spend an hour on one merge.
 */
describe('the column Merchant.tsx states', () => {
  const src = (file: string): string => readFileSync(file, 'utf8');

  it('is still what its own padding and the sheet border leave', () => {
    const sheet = /border: '(\d+)px solid var\(--line\)'/.exec(src('src/ui/gm/GmSheet.tsx'));
    expect(sheet, 'GmSheet no longer paints the border the 367 is short by').not.toBeNull();
    const merchant = src('src/ui/gm/Merchant.tsx');
    const pad = /padding: phone \? '\d+px (\d+)px \d+px'/.exec(merchant);
    expect(pad, 'the merchant region no longer declares a phone padding triple').not.toBeNull();

    const column = PHONE.glass - 2 * Number(sheet?.[1]) - 2 * Number(pad?.[1]);
    const stated = /the column\s+\*?\*?(\d+\.\d\d)/.exec(merchant.replace(/\n \* /g, ' '));
    expect(stated, 'the docblock no longer states a column at all').not.toBeNull();
    expect(Number(stated?.[1])).toBe(column);
  });
});

describe('the two joins the door names go through', () => {
  it('makes a list a person would say out loud', () => {
    expect(andList([])).toBe('');
    expect(andList(['one'])).toBe('one');
    expect(andList(['one', 'two'])).toBe('one and two');
    expect(andList(['one', 'two', 'three'])).toBe('one, two and three');
    expect(andList(['one', 'two', 'three', 'four'])).toBe('one, two, three and four');
  });

  it('starts a sentence without touching the rest of it', () => {
    expect(sentenceCase('the party board')).toBe('The party board');
    expect(sentenceCase('')).toBe('');
    // Only the first character: a name that already starts a sentence is
    // unchanged, and nothing further along is re-cased.
    expect(sentenceCase('The party board')).toBe('The party board');
  });

  it('stores every door name in one case, so nothing has two spellings', () => {
    for (const door of SHOW_DOORS) {
      expect(door.name, `${door.label} is not stored lowercase`).toBe(door.name.toLowerCase());
    }
  });
});
