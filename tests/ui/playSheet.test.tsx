// @vitest-environment jsdom
/**
 * The Play screen as the character sheet.
 *
 * `PlayPhone` used to render nine of the sheet's sections and `PlayDesktop`
 * rendered thirteen, with Identity, the trait grid, the defences and the vault
 * defined in the same file and called only from the desktop branch. So on the
 * width the README says is used ninety per cent of the time, the app did not
 * show Evasion, the damage thresholds, Proficiency, the class, the subclass,
 * the ancestry, the community, the vault or the gold. Nothing was broken;
 * four sections of the sheet were absent, which is the shape of every defect
 * this project has shipped.
 *
 * These tests ask what is on the screen, at a phone width, of a character who
 * has been played. They are deliberately about presence and order rather than
 * about pixels: what went wrong was absence.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Play } from '../../src/ui/player/Play.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { useConditions } from '../../src/ui/player/conditionsStore.ts';
import { ActiveConditions } from '../../src/ui/player/Conditions.tsx';
import type { Character } from '@shared/types.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setViewport(393);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

function seed(patch: Partial<Character> = {}): Character {
  const character = { ...playedCharacter(), ...patch };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  return character;
}

const play = (c: Character): void => {
  render(createElement(Play, { stats: playedStats(c) }));
};

/**
 * The same sheet, edited under the screen - what Build does to a character the
 * player then comes back to.
 *
 * It keeps the id and it keeps the mounted tree, because that is the whole
 * point: `Play` holds the armed declaration in its own state, so a fixture that
 * unmounted and remounted would answer a question nobody is asking.
 */
function rebuild(patch: Partial<Character>): Character {
  const next = { ...useApp.getState().characters[0]!, ...patch };
  act(() => {
    useApp.setState({ characters: [next] });
  });
  play(next);
  return next;
}

/**
 * The header's character picker, as the store sees it: another sheet arrives
 * beside this one and becomes the active one, with `Play` never unmounting.
 */
function switchTo(c: Character): void {
  act(() => {
    useApp.setState((s) => ({ characters: [...s.characters, c], activeId: c.id }));
  });
  play(c);
}

const text = (): string => container.textContent ?? '';

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

/** The disclosure header for a section, by the label it prints. */
function fold(label: string): HTMLButtonElement {
  const found = buttons().find(
    (b) => b.getAttribute('aria-expanded') !== null && (b.textContent ?? '').startsWith(label),
  );
  if (found === undefined) {
    throw new Error(
      `no disclosure called "${label}". Folds here: ${buttons()
        .filter((b) => b.getAttribute('aria-expanded') !== null)
        .map((b) => b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
}

/**
 * The fold index: the sections the phone column owns, in document order.
 *
 * Scoped to the column's own children on purpose. `Modifiers` is a `Disclosure`
 * as well, but it belongs to `DualityRoll` and is drawn inside it above ROLL,
 * and a query that swept the whole tree would count it as part of the index.
 */
/**
 * Open the weapons fold, which starts shut like every other one.
 *
 * Every fold on this sheet defaults shut, because the budget below is computed
 * with every fold shut and a default that contradicted it would make the
 * arithmetic a fiction. Roughly twenty tests reach a weapon row, the Spellcast
 * panel or the unarmed row, and they are about arming rather than about the
 * fold - so the helpers they already use call this rather than each test
 * growing a line.
 *
 * ONE TEST MUST NOT USE THE HELPERS FOR THIS, and it says so where it stands:
 * `draws no panel at all for a character who cannot cast` asserts that the word
 * Spellcast is absent, which a shut fold satisfies for the wrong reason. It
 * opens the fold by hand first.
 */
function openEquipped(): void {
  const header = fold('Weapons & armour');
  if (header.getAttribute('aria-expanded') === 'false') click(header);
}

/** Open the Experiences fold, which is where the chips live now. */
function openExperiences(): void {
  const header = fold('Experiences');
  if (header.getAttribute('aria-expanded') === 'false') click(header);
}

/**
 * Open the vault, which is a tendina inside the cards fold now.
 *
 * The nesting is the point of `Two fewer rows for the same facts`: the loadout
 * and the vault are one section and were costing two headers. Roughly ten tests
 * reach the vault rows, and every one of them goes through here rather than
 * being rewritten, so that what they assert is unchanged and only the way in
 * has moved.
 */
function openVault(): void {
  const cards = fold('Cards');
  if (cards.getAttribute('aria-expanded') === 'false') click(cards);
  const vault = fold('Vault');
  if (vault.getAttribute('aria-expanded') === 'false') click(vault);
}

/**
 * MODS: the door to the roll modifiers, at the right end of the roll row.
 *
 * It replaces `fold('Modifiers')` as the way in. There is no such fold any
 * more - a permanent 44px header saying NONE is exactly what decision 6
 * deletes - so the tests that used to open it open this instead.
 */
function modsButton(): HTMLButtonElement {
  const found = buttons().find((b) =>
    (b.getAttribute('aria-label') ?? '').startsWith('Modifiers for this roll'),
  );
  if (found === undefined) throw new Error('there is no MODS control on the roll row');
  return found;
}

/** The strip that names what is armed, or null when nothing is. */
const armedStrip = (): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Modifiers armed:'));

const indexHeaders = (): HTMLButtonElement[] => [
  ...(container.firstElementChild?.querySelectorAll<HTMLButtonElement>(
    ':scope > section > button[aria-expanded]',
  ) ?? []),
];

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('what a phone shows of the character sheet', () => {
  /*
   * The list is the printed sheet's, section by section. Every one of these
   * was on the desktop layout and absent from the phone, which is the shape
   * of a defect no unit test can see: nothing throws when a section is simply
   * not called.
   */
  it('shows the four defence numbers, not a footnote beside a damage box', () => {
    const c = seed();
    play(c);
    const body = text();
    const s = playedStats(c);
    for (const label of ['EVASION', 'MAJOR', 'SEVERE', 'PROF']) {
      expect(body, `the defence band has no ${label}`).toContain(label);
    }
    // The numbers themselves, and at a size a person can read across a table:
    // the band was 10px --dim text before this, which is what the item is
    // about, so the size is asserted rather than only the presence.
    const cells = [...container.querySelectorAll('.panel')].filter((el) =>
      /^(EVASION|MAJOR|SEVERE|PROF)/.test((el.textContent ?? '').trim()),
    );
    expect(cells, 'the defence band is not four cells').toHaveLength(4);
    for (const cell of cells) {
      const big = [...cell.querySelectorAll('span')].find((el) =>
        el.getAttribute('style')?.includes('26px'),
      );
      expect(big, `${cell.textContent ?? '?'} has no full-size number`).toBeDefined();
    }
    expect(body).toContain(String(s.thresholds[0]));
    expect(body).toContain(String(s.thresholds[1]));
  });

  it('names the class, the subclass and the level', () => {
    play(seed());
    const body = text();
    expect(body).toContain('Fixture');
    expect(body).toContain('LEVEL 3');
    expect(body).toContain(dataset.classes[0]!.name);
    expect(body).toContain(dataset.subclasses.find((s) => s.classRef === dataset.classes[0]!.id)!.name);
  });

  it('carries the ancestry, the community and the domains, one fold away', () => {
    play(seed());
    click(fold('Lineage'));
    const body = text();
    expect(body).toContain(dataset.ancestries[0]!.name);
    expect(body).toContain(dataset.communities[0]!.name);
    for (const domain of playedStats().domains) {
      expect(body, `no ${domain} domain on the lineage fold`).toContain(domain.toUpperCase());
    }
  });

  /*
   * "Domini, ancestry, community. In ordine inverso forse. XD" - the reverse of
   * how a character sheet leads, because by the time you are playing the
   * ancestry is the thing you already know and the domain is the thing you look
   * up. Read off the fold's own contents rather than off the page: the header
   * itself says "Lineage & domains", so a whole-page search would find the word
   * before either subject.
   */
  it('reads domains first, then the ancestry and the community', () => {
    play(seed());
    click(fold('Lineage'));
    const body = fold('Lineage').nextElementSibling!.textContent ?? '';
    const domain = playedStats().domains[0]!;
    const first = body.indexOf(domain.toUpperCase());
    const ancestry = body.indexOf(dataset.ancestries[0]!.name);
    expect(first, `the fold does not name the ${domain} domain at all`).toBeGreaterThanOrEqual(0);
    expect(ancestry, 'the fold does not name the ancestry at all').toBeGreaterThanOrEqual(0);
    expect(
      first,
      'the lineage fold still leads with where you are from rather than with what you can take',
    ).toBeLessThan(ancestry);
  });

  /*
   * Strengthened from `expect(text()).toContain(...)`, which the gold row
   * satisfied and which a total buried inside an open fold would satisfy too.
   * The claim is that the gold is readable with every fold shut, so it is
   * asserted where a shut sheet actually shows it: on the Carried header.
   */
  it('shows the gold with every fold shut, on the header of the thing carrying it', () => {
    play(seed());
    expect(fold('Carried').getAttribute('aria-expanded')).toBe('false');
    expect(
      fold('Carried').textContent,
      'the gold is not on the one row a shut sheet draws for it',
    ).toContain('1 BAG · 4 HANDFULS');
  });

  it('puts the four counters and the damage calculator on the phone', () => {
    play(seed());
    const steppers = buttons().filter((b) =>
      (b.getAttribute('aria-label') ?? '').endsWith('plus one'),
    );
    expect(steppers.map((b) => b.getAttribute('aria-label'))).toEqual([
      'HP plus one',
      'STRESS plus one',
      'HOPE plus one',
      'ARMOR plus one',
    ]);
    expect(
      container.querySelector('input[aria-label="Incoming damage"]'),
      'the damage calculator is not on the phone',
    ).not.toBeNull();
  });

  /*
   * Replaces `runs top to bottom in the order of the printed sheet`, whose
   * list carried 'SPRINT' - now behind the verbs control, so absent from the
   * shut screen - and put 'HP' after the traits, which is the half of
   * Giorgio's order the phone never delivered.
   */
  it("runs top to bottom in Giorgio's order", () => {
    const c = seed();
    play(c);
    const body = text();
    const at = (needle: string): number => {
      const i = body.indexOf(needle);
      expect(i, `"${needle}" is not on the screen at all`).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = [
      'Fixture', // identity
      'EVASION', // the defence band: "threshold bene in vista"
      'HP', // the four counters, second, where the message puts them
      'AGI +', // the traits, as one row of numbers
      'ROLL', // and then the dice, in the flow
      'Weapons & armour',
      'Experiences', // "e fare entrare le armi e le experience"
      'Carried', // "sotto armi e armature..."
      'Cards', // "...e ultime le carte", with the vault folded inside them
      'Rest & downtime',
      'Lineage & domains',
    ].map(at);
    expect(
      order,
      `sections are out of order: ${JSON.stringify(order)}`,
    ).toEqual([...order].sort((a, b) => a - b));
  });

  /*
   * Replaces `keeps only the roll block out of the scroll`, which asserted
   * that the phone root had exactly two children and that the second one held
   * ROLL and AGI.
   *
   * A child count is the weakest form of this claim - it is satisfied by
   * accident and broken by a wrapper - so the replacement says the thing
   * itself: nothing is taken out of the flow, there is one scrolling box, and
   * every fold in the index is inside it and below ROLL.
   */
  it('has nothing pinned: one scrolling box, with ROLL and every fold inside it', () => {
    play(seed());
    const rootEl = container.firstElementChild as HTMLElement;

    const taken = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => el.style.position === 'fixed' || el.style.position === 'sticky')
      .map((el) => `${el.tagName}.${el.className} ${el.style.position}`);
    expect(taken, 'something on Play is out of the flow').toEqual([]);

    expect(rootEl.style.overflowY, 'the sheet is not the scrolling box').toBe('auto');
    const others = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => el !== rootEl && el.style.overflowY === 'auto')
      .map((el) => `${el.tagName}.${el.className}`);
    expect(others, 'there is a second scrolling region inside the sheet').toEqual([]);

    const roll = buttons().find((b) => b.style.height === '66px');
    expect(roll, 'no ROLL control on the phone').toBeDefined();
    expect(rootEl.contains(roll!), 'ROLL is outside the column').toBe(true);

    // The fold index: the sections the column itself owns. `Modifiers` is a
    // `Disclosure` too, but it belongs to `DualityRoll` and lives above ROLL
    // inside it, which is decision 6's business and not this test's.
    const headers = indexHeaders();
    expect(headers.length, 'the fold index is gone').toBe(6);
    for (const header of headers) {
      expect(rootEl.contains(header), `${header.textContent ?? '?'} is outside the column`).toBe(
        true,
      );
      // Node.DOCUMENT_POSITION_FOLLOWING, without the constant, because jsdom's
      // Node is not in scope here.
      expect(
        (roll!.compareDocumentPosition(header) & 4) !== 0,
        `${(header.textContent ?? '?').trim()} is above ROLL`,
      ).toBe(true);
    }
  });
});

/**
 * The two rules that hold for the whole screen, not for one control at a time.
 *
 * Everything a finger lands on is at least 44px, and nothing forces the column
 * wider than the phone. Both were checked control by control while this screen
 * was rebuilt, which is exactly how the eleventh one gets missed - so they are
 * checked here over every element the sheet draws with all its folds open.
 */
describe('the whole sheet, at 393x852', () => {
  /**
   * Open every fold, so nothing is exempt by being hidden.
   *
   * The bound used to be 8 and nothing checked that it was enough, which is a
   * silent failure mode rather than a loud one: the loop simply stops and the
   * 44px sweep below quietly skips whatever stayed shut. Opening `carried`
   * also reveals one more expandable per inventory item with a note, so the
   * count grows with the fixture as well as with the screen. So it drains, and
   * says so.
   */
  function openEverything(): void {
    // 30 rather than 20: the trait row's verbs control answers `aria-expanded`
    // now too, and the drain assertion below is what stops the bound being a
    // silent cap rather than a bound.
    for (let i = 0; i < 30; i += 1) {
      const shut = buttons().find((b) => b.getAttribute('aria-expanded') === 'false');
      if (shut === undefined) break;
      click(shut);
    }
    const stuck = buttons()
      .filter((b) => b.getAttribute('aria-expanded') === 'false')
      .map((b) => (b.textContent ?? '').trim().slice(0, 30));
    expect(stuck, 'these folds are still shut, so the sweeps below never saw them').toEqual([]);
  }

  /** A declared length in px. Tokens resolve as they do below 1180px. */
  function px(value: string): number {
    if (value === 'var(--tap)' || value === 'var(--control)' || value === 'var(--pip-h)') return 44;
    if (value === '') return 0;
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }

  it('has no target under the touch floor', () => {
    play(seed());
    openEverything();
    const small = buttons()
      .map((b) => ({
        name: b.getAttribute('aria-label') ?? (b.textContent ?? '').trim().slice(0, 30),
        h: Math.max(px(b.style.height), px(b.style.minHeight)),
      }))
      .filter((t) => t.h < 44);
    expect(
      small.map((t) => `${t.name} (${String(t.h)}px)`),
      'these declare less than the 44px floor',
    ).toEqual([]);
  });

  it('never forces the column wider than the phone', () => {
    play(seed());
    openEverything();
    // 393 less the 12px page padding either side.
    const COLUMN = 369;
    const wide = [...container.querySelectorAll<HTMLElement>('*')]
      .filter((el) => px(el.style.width) > COLUMN || px(el.style.minWidth) > COLUMN)
      .map((el) => `${el.tagName}.${el.className} ${el.style.width}/${el.style.minWidth}`);
    expect(wide, 'these are wider than the column, so the page scrolls sideways').toEqual([]);
  });

  /*
   * P3-11's other half, on this screen. RECALL is the name of an action and
   * the app has exactly one control that performs it, in the vault. Everywhere
   * else the number is a price and the word is COST.
   */
  it('never prints RECALL as the name of a number', () => {
    play(seed());
    openEverything();
    // A "RECALL" whose whole enclosing group is the word and a number is a
    // price wearing a verb's name. RECALL over COST 2 on the vault's own
    // control is the verb, and is fine.
    const priced = [...container.querySelectorAll<HTMLElement>('.t-meta')].filter(
      (el) =>
        (el.textContent ?? '').trim() === 'RECALL' &&
        /^RECALL\s*\d+$/.test((el.parentElement?.textContent ?? '').trim()),
    );
    expect(
      priced.map((el) => el.parentElement?.textContent ?? ''),
      'RECALL is being used as a label for a cost',
    ).toEqual([]);
    expect(text()).toContain('COST');
  });

  /*
   * Not tested here: that nothing clips. It cannot be, and it should not be -
   * `overflow: hidden` is load-bearing on this screen. It is what gives a long
   * card name an ellipsis instead of a sideways scrollbar, and what keeps the
   * trait tile's accent bar inside its own corners. The clip that mattered was
   * the one *around ROLL*, and that has its own assertion at three widths in
   * the band where it happened.
   */
});

/**
 * The trait row and the roll surface, which used to be the pinned block.
 *
 * These four tests replace the four the pinned block had, one for one. The old
 * ones asserted that the phone root's second child held exactly two regions at
 * a 6px gap, that every target in it cleared 44px, that ROLL declared 66px at
 * the bottom of it, and that the scrolling region beside it kept an 88px floor.
 * The last of those existed only because a fixed block could starve the scroll,
 * and there is no fixed block; it is replaced by the budget below, which is the
 * assertion the reversal actually rests on.
 */
describe('the trait row and the roll surface', () => {
  /** The one control on the phone that fixes its own height. */
  const roll = (): HTMLButtonElement => {
    const found = buttons().find((b) => b.style.height === '66px');
    if (found === undefined) throw new Error('the phone has no roll control');
    return found;
  };

  /**
   * Everything `DualityRoll` draws on a phone.
   *
   * Two levels up from ROLL, not one: ROLL shares a row with MODS now, and the
   * surface is the stack that row sits in.
   */
  const rollSurface = (): HTMLElement => roll().parentElement!.parentElement!;

  /** The six trait chips and the verbs control, as one row. */
  const traitRowEl = (): HTMLElement => {
    const chip = buttons().find((b) => /^AGI [+−]/.test((b.textContent ?? '').trim()));
    if (chip === undefined) throw new Error('no AGI chip on the sheet');
    return chip.parentElement!;
  };

  it('the trait row is one 44px row, and the verbs are behind its own control', () => {
    play(seed());
    const row = traitRowEl();
    const targets = [...row.querySelectorAll('button')];
    // Six chips and the verbs control, and nothing else: the tiles and the
    // pinned strip were two arming surfaces for the same six numbers.
    expect(targets).toHaveLength(7);
    for (const t of targets) {
      expect(t.style.minHeight, `${t.textContent ?? '?'} is under the floor`).toBe('var(--tap)');
    }
    expect(row.style.flexWrap, 'the row cannot wrap, so it will clip instead').toBe('wrap');

    const verbs = targets[6]!;
    expect(verbs.getAttribute('aria-label')).toBe('What each trait is for');
    expect(verbs.getAttribute('aria-expanded')).toBe('false');
    expect(verbs.style.width, 'the verbs control is not square at the floor').toBe('44px');
  });

  it('holds every target on the trait row and the roll surface at the touch floor', () => {
    play(seed());
    const targets = [
      ...traitRowEl().querySelectorAll('button'),
      ...rollSurface().querySelectorAll('button'),
    ];
    expect(targets.length).toBeGreaterThan(6);
    for (const t of targets) {
      const declared = t.style.height !== '' ? t.style.height : t.style.minHeight;
      const value =
        declared === 'var(--tap)' || declared === 'var(--control)'
          ? 44
          : Number.parseFloat(declared);
      expect(
        value,
        `${t.getAttribute('aria-label') ?? t.textContent ?? '?'} declares ${declared}`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  it('gives ROLL the 66px it had, in the column and above every fold', () => {
    play(seed());
    expect(roll().style.height).toBe('66px');
    // It is inside the one scrolling column rather than beside it, and the
    // whole fold index is below it. `has nothing pinned` makes the second half
    // of that claim over every fold; this one is about ROLL itself.
    expect((container.firstElementChild as HTMLElement).contains(roll())).toBe(true);
    expect(text().indexOf('ROLL')).toBeLessThan(text().indexOf('Weapons & armour'));
  });
});

/**
 * THE BUDGET, WHICH IS THE WHOLE WARRANT FOR TAKING THE PIN OFF.
 *
 * P5-5's decision 1 reverses P5-1's pinned block *conditionally*: "This
 * decision is therefore conditional on the arithmetic, and the arithmetic is
 * the deliverable. If the folded sheet does not fit above the tab bar at
 * 393x852, the change has failed on its own terms." Until now that arithmetic
 * lived in a commit message, which is the one place in this repository a number
 * is never checked again. Here it is a test.
 *
 * WHAT THIS CAN PROVE. jsdom has no layout engine, so it measures nothing. What
 * it does is sum the heights the source *declares*, in the order the column
 * draws them, and compare the running total at ROLL against the column the
 * shell leaves for content. Every term that is declared inline is read back off
 * the DOM by `the terms this budget can read, it reads` below, so a change to
 * any of them moves the budget instead of silently invalidating it.
 *
 * WHAT THIS CANNOT PROVE, stated rather than implied. Six of the terms are
 * stylesheet constants that jsdom cannot see - `.t-vital`'s 21px, `.t-meta`'s
 * 10px, the 26px defence numbers, `.panel`'s 1px border - and they are marked
 * `css` in the table. Beyond that it cannot see:
 *
 *   - a character name or a multiclass line that WRAPS, which is one line of
 *     18.9px each time (14px at 1.35). Measured in Chrome: the class cell is
 *     317px at 393 and 299 at 375 - it was 237 and 219 until decision 1 deleted
 *     the 72px RENAME chip and its 8px gutter, and 289 and 271 before P5-8's
 *     conditions control took 52 - the fixture's "Bard — Troubadour" needs
 *     125.6 and clears both, and "Bard / Wizard — Troubadour · School of
 *     Knowledge" needs 326.5 and is still two lines at either width, which adds
 *     18.9 to Identity.
 *   - a class with the Beastform feature, which draws a 44px HUMAN FORM chip at
 *     the head of the column even untransformed: 52 with the gap, so every
 *     Druid is 52px worse off than this table says.
 *   - a companion, which adds a 44px WhoSwitch inside the counters.
 *   - `manualDice`, which puts two 62px faces back above ROLL: +68.
 *   - an armed modifier, which puts a 44px strip back above ROLL: +50.
 *   - `env(safe-area-inset-bottom)`. Every number here follows the arithmetic
 *     already committed in this repo and treats the inset as 0. On a
 *     home-indicator iPhone installed as a PWA it is 34px, which would take the
 *     393x852 column from 730 to 696: ROLL would have 311px of margin instead
 *     of 345, and 126 instead of 160 at 375x667 - and the whole folded sheet,
 *     at 697, would be **one pixel over** instead of 33 under. So the fit this
 *     file now asserts is a fit in a browser, and is lost by a hair in the
 *     installed app. Somebody should check the inset on the owner's own phone.
 *
 * NONE OF THOSE FIVE NOW COSTS MORE THAN THE SLACK AT 375x667, where four of
 * them used to: the margin under ROLL on the small phone went from 10px to
 * **160px** when the counters became a grid, and the dearest of them is now
 * typed dice at +68, which leaves 92. It was six states and the dearest was
 * `counterStyle: 'pips'` at +100, leaving 60; decision 7 deleted the
 * preference and the branch, so the 194px shape is not reachable from this
 * screen at all and the bullet went with it rather than being re-costed. That
 * is the number the grid was bought for, it is asserted below rather than told,
 * and this paragraph said 110 against an assertion of 160 for two passes.
 *
 * ONE THING IN THE COLUMN IS DELIBERATELY NOT IN EITHER TABLE: the licence
 * notice, which P5-6 put at the end of this scroll. Everything `STACK` and
 * `INDEX` sum is something a player has to be able to reach, and the notice is
 * the opposite of that - it is below the last shut fold, it is read once by
 * somebody who is not at a table, and no state of this sheet needs it on the
 * glass. So it moves no term and neither total. `the terms this budget can
 * read, it reads` pins that it is the *last* child and that it is a `<footer>`,
 * which is what stops "outside the budget" from quietly becoming a hole
 * anything else can be dropped into.
 *
 * So this test is a tripwire on the declared arithmetic and not a measurement,
 * and it says which of the two it is in every failure message.
 */
describe('the budget the pin came off for', () => {
  /*
   * The column the shell leaves, derived from the three things that take it
   * rather than hard-coded, so a change to any of them moves this rather than
   * invalidating it.
   *
   *   Header.tsx    height: 52, content-box, borderBottom 1px  -> 53
   *   TabBar.tsx    minHeight: 60 plus borderTop 1px            -> 61
   *   Play.tsx      the phone root's padding: '0 12px 8px'      ->  8
   *
   * That is one pixel tighter than the 731/546 already committed in this repo,
   * which forgot the header's border. It is corrected here rather than carried,
   * because it is the number the reversal is argued from.
   */
  const HEADER = 52 + 1;
  const TABBAR = 60 + 1;
  const FOOT = 8;
  const column = (glass: number): number => glass - HEADER - TABBAR - FOOT;

  /** This column's own gap, between every pair of sections. */
  const GAP = 8;

  /**
   * The stack at 393x852 with every fold shut, default prefs (numbers, digital
   * dice on, typing off), the `playedCharacter` fixture, nothing armed, no roll
   * yet, no Beastform, not fallen, no companion.
   *
   * `from` says where each number comes from: `dom` is declared inline and
   * checked against the DOM below, `css` is a stylesheet constant jsdom cannot
   * read, `sum` is arithmetic over the two.
   */
  const STACK: Array<{ what: string; px: number; from: 'dom' | 'css' | 'sum' }> = [
    { what: 'Identity · the name at .t-vital, clamp() floors at 21', px: 21, from: 'css' },
    { what: 'Identity · the meta row: marginTop 7', px: 7, from: 'dom' },
    { what: 'Identity · the meta row itself, .t-meta at 10/1', px: 10, from: 'css' },
    { what: 'Identity · the class row: marginTop 9', px: 9, from: 'dom' },
    // RENAME held this row open until decision 1 deleted it. `ConditionsControl`
    // is the only 44px thing in the row now, so the term is that control's own
    // `minHeight: var(--control)` and the row would be the 18.9px class line
    // without it - which is what the cockpit, where no door is passed, draws.
    { what: 'Identity · the class row, held open by the conditions door', px: 44, from: 'dom' },
    { what: 'gap', px: GAP, from: 'dom' },
    { what: 'the defence band · .panel padding 8 top and bottom', px: 16, from: 'dom' },
    { what: 'the defence band · the label at .t-meta 10/1', px: 10, from: 'css' },
    { what: 'the defence band · the cell gap 4', px: 4, from: 'dom' },
    { what: 'the defence band · the number at 26/1', px: 26, from: 'css' },
    { what: 'the defence band · .panel border, 1px top and bottom', px: 2, from: 'css' },
    // The fifth cell is TOOK and a 44px field, vertically centred in a row the
    // four number cells already hold open at 58. It is in this table at zero
    // rather than absent from it, because zero is the claim: the box left the
    // counters, where it cost 44 and a 6px gap, and the band did not grow.
    { what: 'the defence band · the TOOK cell, inside the 58 already spent', px: 0, from: 'dom' },
    { what: 'gap', px: GAP, from: 'dom' },
    { what: 'the four counters, a 2x2 grid, both rows at the touch floor', px: 2 * 44, from: 'dom' },
    { what: 'the counters · the one 6px gap between the two rows', px: 6, from: 'dom' },
    { what: 'gap', px: GAP, from: 'dom' },
    { what: 'the trait row, six chips and the verbs control', px: 44, from: 'dom' },
    { what: 'gap', px: GAP, from: 'dom' },
    // The roll surface is ROLL and nothing else with nothing armed: the
    // Experience chips are a fold below it now and the modifier row is not
    // drawn. ROLL and MODS share this row, so MODS costs the column nothing -
    // it is 44 wide inside the 66 ROLL was already holding.
    //
    // An armed *Experience* costs the column nothing either, and that is not
    // an omission from this table. It is named on ROLL's own second line,
    // which exists in every state, so unlike an armed modifier - the +50 in
    // the docblock above, which draws the ARMED strip - it moves no number
    // here. `DualityRoll`'s `rollLine` carries the wrap arithmetic.
    { what: 'the ROLL row', px: 66, from: 'dom' },
  ];

  /** What follows ROLL: the fold index, every one of them shut. */
  const INDEX: Array<{ what: string; px: number }> = [
    { what: 'gap', px: GAP },
    { what: 'Weapons & armour', px: 44 },
    { what: 'gap', px: GAP },
    { what: 'Experiences', px: 44 },
    { what: 'gap', px: GAP },
    { what: 'Carried, with the gold on its header', px: 44 },
    { what: 'gap', px: GAP },
    { what: 'Cards, with the vault folded inside it', px: 44 },
    { what: 'gap', px: GAP },
    { what: 'Rest & downtime', px: 44 },
    { what: 'gap', px: GAP },
    /*
     * THE CONDITIONS ARE NOT IN THIS TABLE, AND THAT IS THE 52PX.
     *
     * They were a permanent strip (44 plus this column's 8px gap), then P5-6's
     * fold (a 44px header plus the same 8px gap - 52 for 52, which is why that
     * pass bought nothing with it). P5-8 draws them only while one is on, with
     * the permanent door moved to a 44x44 control in the identity's class row
     * where RENAME already holds the band open, so the resting sheet spends
     * nothing on them at all.
     *
     * That is the whole difference between 749 and 697, and between missing
     * 393x852 by 19 and fitting it with 33 to spare. `the conditions, drawn
     * only when there are any` below asserts both halves: nothing in this slot
     * with a clear sheet, and 52px back in it - naming what is on - the moment
     * anything is.
     */
    { what: 'Lineage & domains', px: 44 },
  ];

  const total = (items: Array<{ px: number }>): number =>
    items.reduce((sum, item) => sum + item.px, 0);

  const ROLL_BOTTOM = total(STACK);
  const SHEET_BOTTOM = ROLL_BOTTOM + total(INDEX);

  it('puts ROLL above the fold at 393x852, which is what the pin was for', () => {
    // The premise, so a table that has drifted cannot pass by cancelling out.
    expect(ROLL_BOTTOM, 'the itemised stack no longer sums to 385').toBe(385);
    const glass = column(852);
    expect(glass).toBe(730);
    expect(
      ROLL_BOTTOM,
      `ROLL's lower edge is ${String(ROLL_BOTTOM)} against ${String(glass)} of column. ` +
        'Decision 1 made the reversal conditional on exactly this: if ROLL has to be ' +
        'scrolled to at 393x852, the pin has to go back on or something above it has to go.',
    ).toBeLessThanOrEqual(glass);
    expect(glass - ROLL_BOTTOM, 'the slack at 393x852 has moved').toBe(345);
  });

  /*
   * The small phone, where the slack used to be ten pixels and is now 160.
   *
   * ROLL cleared a 545px column by 10px before the counters became a 2x2 grid,
   * and that ten was the number the grid was bought with. It asserts the 160,
   * so that anything spending 161 fails here with the arithmetic in front of it
   * rather than being found on somebody's phone. The docblock above lists five
   * ordinary states this table cannot see, and the dearest of them - typed
   * dice, at +68 - still leaves 92. It was six, and the dearest was pips at
   * +100 leaving 60, until decision 7 took the pip tracks off this sheet.
   */
  it('puts ROLL above the fold at 375x667 too, and no longer by ten pixels', () => {
    const glass = column(667);
    expect(glass).toBe(545);
    expect(
      ROLL_BOTTOM,
      `ROLL's lower edge is ${String(ROLL_BOTTOM)} against ${String(glass)} of column on the ` +
        'small phone.',
    ).toBeLessThanOrEqual(glass);
    expect(glass - ROLL_BOTTOM, 'the slack at 375x667 has moved').toBe(160);
  });

  /*
   * GIORGIO'S STRONGER SENTENCE, AND THE FIRST TIME THIS FILE CAN ASSERT IT
   * RATHER THAN COST IT.
   *
   * "Rendendo quindi la pagina principale un sistema per vedere in una volta
   * sola tutta la scheda." Through P5-5, P5-6 and P5-7 this was an assertion
   * about how far the sheet missed by - 169px, then 19 - and the docblock on
   * that assertion said why the gap was stated rather than shaved: a fit bought
   * by taking the column gap from 8 to 6 is a fit the next honest edit un-buys.
   *
   * Nothing here was shaved. The 19 went the way P5-6 said the last 52 would
   * have to go - the conditions are drawn only while one is on, with the door
   * moved to a band that was already 44px tall - so this now asserts the fit
   * and the slack, and fails the moment the sheet stops fitting. Measured in
   * Chrome at 393x852 with the `playedCharacter` fixture, every fold shut: 697.
   *
   * 375x667 IS STILL A MISS AND IS STILL STATED. The small phone is 152px over,
   * where it was 204. The owner accepted that in advance and no arrangement of
   * this sheet closes it: 152px is three fold headers, and there are only six.
   */
  it('fits the whole folded sheet on a 393x852 phone, with the slack stated', () => {
    expect(SHEET_BOTTOM, 'the fold index no longer sums to 312 below ROLL').toBe(697);
    const glass = column(852);
    expect(glass).toBe(730);
    expect(
      SHEET_BOTTOM,
      `the whole folded sheet is ${String(SHEET_BOTTOM)} against ${String(glass)} of column at ` +
        '393x852, so "vedere in una volta sola tutta la scheda" has stopped being true. It ' +
        'became true at P5-8 and this is the assertion that keeps it true: nothing may be ' +
        'added to this column without taking something out, and a fit bought by shrinking a ' +
        'gap is not a fit.',
    ).toBeLessThanOrEqual(glass);
    expect(glass - SHEET_BOTTOM, 'the whole-sheet slack at 393x852 has moved').toBe(33);
    // Stated, not asserted away: the small phone is still short of it.
    expect(
      SHEET_BOTTOM - column(667),
      'the whole-sheet overflow at 375x667 has moved',
    ).toBe(152);
  });

  it('does fit whole on a tablet, where there is no tab bar to fit above', () => {
    /*
     * 744x1133, and the tab bar is not in the sum because `App.tsx` draws it
     * only below 720px - `phone && screen !== 'gm' && <TabBar />`. So the
     * column is the glass less the header and the root's own foot.
     */
    const glass = 1133 - HEADER - FOOT;
    expect(glass).toBe(1072);
    expect(
      SHEET_BOTTOM,
      'the whole folded sheet no longer fits on an iPad mini either, which was the one ' +
        'width where "tutta la scheda in una volta sola" was literally true',
    ).toBeLessThanOrEqual(glass);
    expect(glass - SHEET_BOTTOM, 'the tablet slack has moved').toBe(375);
  });

  /*
   * WHERE ROLL IS ON THE GLASS, WHICH IS THE ONE THING THE UNPINNING WAS
   * ARGUED FROM AND THE ONE THING NOTHING ASSERTED.
   *
   * `PlayPhone`'s comment above `<DualityRoll>` carried the pre-grid position
   * for two passes after the grid moved it - "y522-588 … 264 to 330px up from
   * the bottom bezel … 203px clear of the tab bar" - while the drawn row was
   * 150px higher, and the conclusion the comment drew from its own numbers
   * inverted with them: at 414-480px above the bezel ROLL is outside the ~330px
   * sweep the comment cited to say it was inside. A number in a comment is
   * never checked again; that is what this file exists to stop, and this is the
   * assertion that should have existed when the pin came off.
   *
   * Everything here is derived from the table above and the shell's own three
   * constants, so it moves when the stack moves instead of going quietly stale.
   * Measured in Chrome with the `playedCharacter` fixture, every fold shut, at
   * both reference widths: the ROLL row is y372-438 on the glass, its lower
   * edge is 414px above the bottom bezel at 393x852 and 229 at 375x667, and it
   * is 353px clear of the tab bar.
   */
  it('says where on the glass ROLL is drawn, and how far that is from the thumb', () => {
    const ROLL_ROW = STACK[STACK.length - 1]!.px;
    expect(ROLL_ROW, 'the last term of the stack is no longer the ROLL row').toBe(66);

    // On the glass: the column starts under the header, which is the only
    // chrome above it.
    const top = HEADER + ROLL_BOTTOM - ROLL_ROW;
    const bottom = HEADER + ROLL_BOTTOM;
    expect([top, bottom], 'the ROLL row has moved on the glass').toEqual([372, 438]);

    /*
     * And how far up from the bottom bezel, which is the number the ergonomic
     * claim is made in. A right thumb pivots at the bottom-right corner, and
     * the 95th-percentile comfortable sweep at these widths is about 330px;
     * both of these are outside it, which the comment on `<DualityRoll>` now
     * says in those words rather than claiming the opposite.
     */
    expect(
      [852 - bottom, 852 - top],
      "ROLL's distance from the bottom bezel at 393x852 has moved",
    ).toEqual([414, 480]);
    expect(
      [667 - bottom, 667 - top],
      "ROLL's distance from the bottom bezel at 375x667 has moved",
    ).toEqual([229, 295]);

    /*
     * The other half of the trade, and the half that is a gain: pinned, ROLL
     * was 8px above a 98x60 control that navigates away mid-turn. It is 353px
     * clear of it now.
     */
    expect(
      852 - TABBAR - bottom,
      'the gap between ROLL and the tab bar that navigates away has moved',
    ).toBe(353);
  });

  /*
   * THE PROPERTY THAT MAKES EVERY NUMBER ABOVE A DRAWN NUMBER RATHER THAN A
   * WISH, and the defect that proved it was missing.
   *
   * The column is `display: flex; flex-direction: column; flex: 1; min-height:
   * 0; overflow-y: auto`. A flex child keeps `flex-shrink: 1` unless it says
   * otherwise, and in that box the browser shrinks whatever can shrink *before*
   * it scrolls anything. So a single section without `flex: none` does not make
   * the sheet 44px taller - it absorbs the whole overflow of the sheet, on its
   * own, and everything else keeps the height this table gives it.
   *
   * That is not hypothetical. Rendered in Chrome at 393x852, `DualityRoll`'s
   * phone surface was the one child that had never declared it: it measured
   * **33px tall holding a 66px ROLL**, which overflowed onto the fold header
   * below - two 44px targets on the same band - and the column's
   * `scrollHeight` equalled its `clientHeight`, so the sheet did not scroll at
   * all. Nothing in this file could see it, because jsdom has no layout engine
   * and every assertion here reads a *declared* height, which was still 66.
   *
   * This is the assertion that would have. It is deliberately a sweep rather
   * than a check on the one section that was wrong.
   */
  it('lets no section of the column shrink instead of scrolling', () => {
    play(seed());
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.style.overflowY, 'this is no longer the scrolling box').toBe('auto');

    const shrinkable = [...rootEl.children]
      .map((el) => el as HTMLElement)
      .filter((el) => {
        const declared = el.style.flex !== '' ? el.style.flex : el.style.flexShrink;
        return !/^(none|0 0 auto|0)$/.test(declared);
      })
      .map((el) => `${el.tagName}.${el.className || '(none)'} "${(el.textContent ?? '').slice(0, 28)}"`);

    expect(
      shrinkable,
      'a section of the phone column can shrink. In a scrolling flex column that means it ' +
        'absorbs the whole overflow of the sheet rather than the sheet scrolling: the section ' +
        'is drawn shorter than its contents, they overlap whatever is under it, and every ' +
        'height this budget sums stops being the height that is drawn.',
    ).toEqual([]);
  });

  it('the terms this budget can read, it reads', () => {
    play(seed());
    const rootEl = container.firstElementChild as HTMLElement;
    const read = new Map<string, number>();

    expect(rootEl.style.gap, 'the column gap moved and the budget did not').toBe(`${String(GAP)}px`);

    /*
     * The one thing that would otherwise slip past this whole describe: a
     * section added to the column that the table above never hears about. The
     * table is arithmetic and cannot notice a thirteenth child, so the child
     * count is asserted directly and the failure says what to do about it.
     *
     * Twelve, with the fixture and a clear sheet: Identity, the defence band,
     * the counters, the trait row, the roll surface, then Weapons & armour,
     * Experiences, Carried, Cards, Rest and Lineage - and, since P5-7, the
     * licence notice. Eleven of those are `STACK` and `INDEX`. The vault is a
     * tendina inside Cards and costs the column no child of its own; the death
     * move, the Beastform banner and - since P5-8 - the conditions strip draw
     * nothing in this state, and all three are named in the docblock as things
     * this budget does not carry.
     *
     * THE TWELFTH IS THE ONE EXCEPTION AND IT IS ASSERTED RATHER THAN WAIVED.
     * `STACK` and `INDEX` sum the sheet, and the sheet is everything a player
     * has to be able to reach; the notice is below the last fold, is read once
     * by somebody who is not at a table, and is never needed on the glass - so
     * it changes no term above and neither total. That claim is only safe while
     * it really is last, which the two lines below check, and while it really
     * is a footer rather than a section, which its tag says.
     */
    expect(
      rootEl.children.length,
      'the phone column gained or lost a section. Every term of STACK and INDEX above ' +
        'has to be re-done, and the three totals with them - this is the budget the pin ' +
        'came off for, and an unaccounted section is how it stops being true quietly.',
    ).toBe(12);
    const last = rootEl.children[rootEl.children.length - 1]!;
    expect(
      last.tagName,
      'the last child of the column is not the licence notice, so either the notice ' +
        'has moved up into the sheet - where it costs the budget 119px nobody has costed - ' +
        'or something new has been added below it and is exempt from the budget by accident',
    ).toBe('FOOTER');

    // Identity: the two margins and the control that holds the third row open.
    const identity = container.querySelector<HTMLElement>('.t-vital')!.parentElement!;
    read.set('meta marginTop', Number.parseFloat((identity.children[1] as HTMLElement).style.marginTop));
    read.set('class marginTop', Number.parseFloat((identity.children[2] as HTMLElement).style.marginTop));
    /*
     * The 44 in the table above used to be RENAME's. Decision 1 deleted that
     * chip, so the class row is held open by `ConditionsControl` and by
     * nothing else - which is why this reads the door rather than the chip,
     * and why the term's name in `STACK` says the door.
     */
    const door = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Conditions:'))!;
    expect(door.style.minHeight).toBe('var(--control)');
    expect(
      identity.children[2]!.contains(door),
      'the only 44px thing in the class row is not in the class row, so nothing holds the ' +
        'third term of the identity block open and the table above is wrong by 25px',
    ).toBe(true);
    expect(read.get('meta marginTop')).toBe(7);
    expect(read.get('class marginTop')).toBe(9);

    // The defence band: the padding and the gap inside one cell.
    const cell = [...container.querySelectorAll<HTMLElement>('.panel')].find((el) =>
      /^EVASION/.test((el.textContent ?? '').trim()),
    )!;
    expect(cell.style.padding, 'the defence cell padding moved').toBe('8px 9px');
    expect(cell.style.gap).toBe('4px');

    /*
     * The damage box is a fifth child of that same grid, not a row of its own.
     * This is the whole of the 50px the counters gave up: if it ever goes back
     * to being a sibling of the band, the table above is wrong by 44 plus a gap
     * and this is the line that says so.
     */
    const damage = container.querySelector<HTMLInputElement>('input[aria-label="Incoming damage"]')!;
    const band = cell.parentElement!;
    expect(
      damage.closest('[style*="grid-template-columns"]'),
      'the incoming-damage box left the defence band',
    ).toBe(band);
    expect(
      (band as HTMLElement).style.gridTemplateColumns,
      'the four numbers went back to equal columns, which the box does not fit beside',
    ).toBe('auto auto auto auto 1fr');
    expect(damage.style.minHeight).toBe('var(--control)');

    // The counters: a 2x2 grid at the floor, at a 6px gap, in a box that no
    // longer draws a box.
    const grid = buttons().find((b) => b.getAttribute('aria-label') === 'HP plus one')!
      .parentElement!.parentElement!;
    const counters = grid.closest<HTMLElement>('.stack')!;
    expect(counters.className, 'the counters got their .panel back').toBe('stack');
    expect(counters.style.gap).toBe('6px');
    expect(grid.style.gridTemplateColumns, 'the four counters stopped being two across').toBe(
      '1fr 1fr',
    );
    expect(grid.style.gap, 'the gap inside the counters grid moved').toBe('6px');
    const rows = [...grid.children].filter((el) => (el as HTMLElement).style.minHeight === '44px');
    expect(rows, 'the four counter cells no longer declare 44px each').toHaveLength(4);
    expect(
      counters.contains(damage),
      'the damage box is back inside the counters, where it costs 50px',
    ).toBe(false);

    // The trait row and the roll surface.
    const chip = buttons().find((b) => /^AGI [+−]/.test((b.textContent ?? '').trim()))!;
    expect(chip.style.minHeight).toBe('var(--tap)');
    // By its label, not by its height: eight `Counter` steppers declare
    // `height: 44` and every one of them is above ROLL in document order, so
    // reading the budget's last term off "the first button with a height" would
    // read it off a stepper and pass whatever ROLL did.
    const roll = buttons().find((b) => (b.textContent ?? '').includes('ROLL'))!;
    expect(
      roll.style.height,
      "ROLL's declared height and the last term of the budget have parted company",
    ).toBe(`${String(STACK[STACK.length - 1]!.px)}px`);
    expect(
      roll.parentElement!.parentElement!.style.gap,
      "the roll surface's own gap moved",
    ).toBe('6px');
    expect(roll.parentElement!.style.gap, 'the ROLL/MODS gutter moved').toBe('8px');
    /*
     * And the roll surface is ROLL's row and nothing else with nothing armed.
     * This is the 100px the Experience fold bought and the 50 the modifier row
     * bought: if either comes back above ROLL, the table above is wrong by that
     * much and this is where it says so.
     */
    expect(
      [...roll.parentElement!.parentElement!.children].map((el) => el.tagName),
      'something is drawn on the roll surface that the budget does not carry',
    ).toEqual(['DIV']);
    expect(
      buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Utilize ')),
      'the Experience chips are back above ROLL, where they cost 100px',
    ).toHaveLength(0);

    // The fold index: every header at the floor, and there are six rows of it
    // now that the conditions have no permanent row at all.
    const headers = indexHeaders();
    for (const header of headers) {
      expect(header.style.minHeight, `${header.textContent ?? '?'} is not at the floor`).toBe(
        'var(--tap)',
      );
    }
    const LABELS = [
      'Weapons & armour',
      'Experiences',
      'Carried',
      'Cards',
      'Rest & downtime',
      'Lineage & domains',
    ];
    expect(
      headers.map((h, i) => ((h.textContent ?? '').startsWith(LABELS[i] ?? '\u0000') ? LABELS[i] : h.textContent)),
      'the budget counts six fold headers below ROLL and the screen draws a different set',
    ).toEqual(LABELS);
  });
});

/**
 * The conditions, drawn only when there are any.
 *
 * P5-6 asked for a fold here and costed it at −52. A fold is not worth −52: a
 * shut `Disclosure` is a 44px header plus this column's 8px gap, which is what
 * the permanent strip was to the pixel, and `Conditions · NONE` is still a row
 * spent saying nothing is happening. P5-8 takes the 52 the only way it can be
 * taken - nothing is drawn while nothing is on - and pays for the door out of a
 * band that was already 44px tall.
 *
 * These tests exist because that trade has exactly one way to go wrong, and it
 * is the founding rule: a sheet that goes quiet about a condition the GM
 * inflicted. So they assert the saving *and* the thing the saving must not
 * cost, at the same time and in the same file as the budget it buys.
 */
describe('the conditions, drawn only when there are any', () => {
  const strips = (): NodeListOf<Element> =>
    container.querySelectorAll('[role="group"][aria-label="Active conditions"]');
  const control = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Conditions:'));

  it('spends no row on a clear sheet, and no fold either', () => {
    play(seed());
    expect(
      strips(),
      'the strip is drawn with nothing on, which is the 52px this pass was for',
    ).toHaveLength(0);
    expect(
      indexHeaders().find((h) => (h.textContent ?? '').startsWith('Conditions')),
      'the conditions fold is back, and a shut fold costs this column exactly what the ' +
        'permanent strip cost it - 44 plus the gap, 52 for 52',
    ).toBeUndefined();
  });

  it('puts the permanent door in the class row, which it now holds open by itself', () => {
    play(seed());
    const door = control();
    expect(
      door,
      'nothing on the sheet opens the conditions, so a clear sheet is a sheet you cannot ' +
        'set Hidden on',
    ).toBeDefined();

    /*
     * In the class row, which it used to share with RENAME. Decision 1 deleted
     * that chip, so this control is the whole of the row's 44px rather than a
     * free rider on it - the budget's third identity term is this element's
     * `minHeight` and nothing else's.
     */
    const identity = container.querySelector<HTMLElement>('.t-vital')!.parentElement!;
    expect(
      door!.parentElement,
      'the conditions control left the identity class row',
    ).toBe(identity.children[2]);
    expect(
      buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rename ')),
      'the RENAME chip is back on the sheet, which decision 1 deleted',
    ).toHaveLength(0);
    expect(door!.style.minHeight, 'the door is below the touch floor').toBe('var(--control)');
    expect(door!.style.width, 'the door is not the 44 wide the budget assumes').toBe('44px');
    expect(door!.getAttribute('aria-label'), 'a clear sheet does not say so').toBe(
      'Conditions: none',
    );
  });

  it('says what is on, in the strip and on the door, the moment anything is', () => {
    const c = seed();
    play(c);

    act(() => {
      useConditions.getState().toggle(c.id, 'restrained');
    });

    expect(
      strips(),
      'a condition the GM inflicted is on and this column draws nothing about it, which is ' +
        'the one way "nothing is drawn to say nothing" can become a defect',
    ).toHaveLength(1);
    expect(strips()[0]!.textContent, 'the strip is drawn and does not name it').toContain(
      'RESTRAINED',
    );
    expect(
      control()!.getAttribute('aria-label'),
      'the door at the top of the sheet does not name it, so a listening player has to ' +
        'scroll 650px to a strip to be told they are Restrained',
    ).toBe('Conditions: Restrained');
    expect(
      control()!.textContent,
      'the door does not count what is on, so the only thing on the glass above the fold ' +
        'saying something is wrong is a border colour',
    ).toContain('1');

    act(() => {
      useConditions.getState().toggle(c.id, 'hidden');
    });
    expect(control()!.getAttribute('aria-label')).toBe('Conditions: Hidden, Restrained');
    expect(control()!.textContent).toContain('2');
  });

  /*
   * The Vulnerable the app derives from full Stress is not one the player set,
   * and it is the state most likely to be true without anybody having touched
   * a chip. If "draw nothing when nothing is on" read the manual flags only, it
   * would be silent on exactly that.
   */
  it('counts the Vulnerable that full Stress derives, which nobody switched on', () => {
    const c = seed();
    play(c);
    expect(strips(), 'the fixture has Stress left and something is drawn').toHaveLength(0);

    rebuild({ stress: { marked: c.stress.max, max: c.stress.max } });
    expect(
      strips(),
      'every Stress box is marked, so this character is Vulnerable and the sheet says nothing',
    ).toHaveLength(1);
    expect(control()!.getAttribute('aria-label')).toBe('Conditions: Vulnerable');
  });

  /*
   * Two doors into one dialog is what this arrangement is most likely to
   * produce by accident, and `ActiveConditions`' docblock has refused it once
   * already for the cockpit. On the phone the door is the identity control, so
   * the strip's own `+ NAME` chip is not drawn - and the desktop, which has no
   * such control, keeps it.
   */
  it('has one door on the phone and one on the desktop, never two on either', () => {
    const c = seed();
    play(c);
    act(() => {
      useConditions.getState().toggle(c.id, 'restrained');
    });

    const doors = buttons().filter(
      (b) =>
        (b.getAttribute('aria-label') ?? '').startsWith('Conditions:') ||
        (b.getAttribute('aria-label') ?? '') === 'Condition rules, and states you name yourself',
    );
    expect(
      doors.map((b) => b.getAttribute('aria-label')),
      'the phone has two ways into ConditionsDialog on one screen',
    ).toEqual(['Conditions: Restrained']);

    render(createElement(ActiveConditions));
    expect(
      buttons().filter(
        (b) =>
          (b.getAttribute('aria-label') ?? '') === 'Condition rules, and states you name yourself',
      ),
      'the desktop strip lost the only door it has',
    ).toHaveLength(1);
  });
});

/**
 * The incoming-damage box, now that it can see the ladder.
 *
 * It moved out of the counters and into the defence band, which is a refactor
 * of the one component on the player's screen that writes Hit Points - and
 * that component had no surface test at all. `attack.test.ts` and the engine's
 * own tests cover `applyDamage` and `markDamage`; nothing covered the path a
 * player actually takes, which is type a number, read a verdict, and tap it.
 * So the move brings the coverage the move needs: what is drawn, what is not
 * drawn, what is written, and when.
 *
 * The rule the last two assertions are here for is the founding one. This
 * control *proposes* - it shows what marking the damage would cost - and it
 * must not write anything until the tap. A calculator that applied on keystroke
 * would be the app marking Hit Points nobody agreed to.
 */
describe('the incoming-damage box, where the ladder is', () => {
  const damageField = (): HTMLInputElement | null =>
    container.querySelector<HTMLInputElement>('input[aria-label="Incoming damage"]');

  /** Type the way a keyboard does; React ignores a bare `.value` assignment. */
  function type(field: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('sits in the band and stops restating the ladder in 10px beside itself', () => {
    const c = seed();
    play(c);
    const s = playedStats(c);

    const box = damageField();
    expect(box, 'the damage box is not on the phone at all').not.toBeNull();
    const band = [...container.querySelectorAll<HTMLElement>('.panel')]
      .find((el) => /^EVASION/.test((el.textContent ?? '').trim()))!
      .parentElement!;
    expect(band.contains(box!), 'the damage box is not in the defence band').toBe(true);

    /*
     * The whole argument for the move, as an assertion. Inside the counters
     * the box printed `8/16` - the two thresholds, in the smallest type on the
     * screen - because it needed them and could not see them. They are two
     * 26px numbers three cells to its left now, so the restatement is deleted
     * rather than duplicated.
     */
    expect(
      text(),
      'the box still prints the ladder beside itself, which is what having it in the band is for',
    ).not.toContain(`${String(s.thresholds[0])}/${String(s.thresholds[1])}`);
  });

  it('offers a verdict across the band, and writes nothing until it is tapped', () => {
    const c = seed();
    play(c);
    const s = playedStats(c);
    const before = structuredClone(useApp.getState().characters[0]!);

    // Over Severe, so the verdict is unambiguous whatever the fixture's armor
    // resolves to and the arithmetic below cannot be satisfied by a Minor.
    type(damageField()!, String(s.thresholds[1] + 1));

    const verdict = buttons().find((b) => /·\s*\d+ HP$/.test((b.textContent ?? '').trim()));
    expect(verdict, 'typing a number offered nothing to tap').toBeDefined();
    expect(verdict!.textContent).toContain('SEVERE');
    expect(verdict!.style.minHeight, 'the verdict is below the touch floor').toBe('var(--control)');
    expect(
      verdict!.parentElement!.style.gridColumn,
      'the verdict does not span the band, so it is squeezed into the 114px the box has',
    ).toBe('1 / -1');

    expect(
      useApp.getState().characters[0],
      'typing a number marked Hit Points before anybody agreed to it',
    ).toEqual(before);

    click(verdict!);
    expect(useApp.getState().characters[0]!.hp.marked, 'the tap marked no Hit Points').toBe(
      before.hp.marked + 3,
    );
    expect(useApp.getState().log[0]!.kind).toBe('incoming');
    expect(damageField()!.value, 'the box kept the number it had already spent').toBe('');
  });

  it('draws no box when the armor is not in this build, because the band says so once', () => {
    const c = seed({ activeArmor: '?60007', thresholdOverride: null });
    play(c);
    expect(
      damageField(),
      'the calculator is asking for a number it cannot read a verdict from',
    ).toBeNull();
    expect(text()).toContain('ARMOR NOT IN THIS BUILD');
    expect(
      (text().match(/ARMOR NOT IN THIS BUILD/g) ?? []).length,
      'the sentence is on the screen twice, which is 44px of saying it again',
    ).toBe(1);
  });
});

/**
 * The vault, which had never been on a phone.
 *
 * It was defined in `Play.tsx` and called from `PlayDesktop` only, so on a
 * phone a card you owned and were not carrying did not exist. And on the
 * desktop shelf, a card that could not be recalled said why in a `title`
 * attribute and faded to 55% - which on a touchscreen is a dimmed card, a tap,
 * and no explanation of either. That is P3-9(a).
 */
describe('the vault', () => {
  /** A sheet whose loadout is full, so recall has a real reason to refuse. */
  function fullLoadout(): Character {
    const base = playedCharacter();
    return seed({
      loadout: [...base.loadout, ...base.vault.slice(0, 2)],
      vault: base.vault.slice(2),
    });
  }

  it('is on the phone at all, two folds away, and counted on the shut one', () => {
    const c = seed();
    play(c);
    /*
     * The nesting must not hide the count. The vault's own header is inside
     * the cards fold now, so the number that used to be on it has to be on
     * the header a shut sheet actually shows - otherwise folding the two
     * together cost a tap to find out something that used to be readable.
     */
    expect(fold('Cards').textContent, 'the shut cards fold does not say how many are where').toContain(
      '3 INACTIVE',
    );
    expect(fold('Cards').textContent).toContain('3 / 5');
    openVault();
    const names = c.vault.map((ref) => index.cards.get(ref)!.name);
    for (const name of names) {
      expect(text(), `${name} is not in the phone's vault`).toContain(name);
    }
    // And it is genuinely nested rather than merely adjacent, which is the
    // 52px this step buys: one section of the index, not two.
    expect(
      fold('Cards').closest('section')!.contains(fold('Vault')),
      'the vault is beside the cards again, so the index is back to two headers for one subject',
    ).toBe(true);
  });

  it('offers a recall that names its price, and pays it', () => {
    const c = seed();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    const recall = buttons().find(
      (b) => (b.getAttribute('aria-label') ?? '') === `Recall ${card.name} for ${card.recallCost} Stress`,
    );
    expect(recall, 'no recall control on the vault row').toBeDefined();
    expect(recall!.textContent).toContain(`COST ${card.recallCost}`);

    const before = useApp.getState().characters[0]!.stress.marked;
    click(recall!);
    const after = useApp.getState().characters[0]!;
    expect(after.loadout).toContain(card.id);
    expect(after.vault).not.toContain(card.id);
    expect(after.stress.marked).toBe(before + card.recallCost);
  });

  it('does not call a recall that cost nothing a downtime', () => {
    // The log line read "Free during downtime" whenever the price was zero,
    // and nothing had ever passed `{ downtime: true }` - so the only way to
    // reach it was one of the 31 SRD cards whose Recall Cost is 0, in the
    // middle of a scene. Two zeroes, two reasons, and now two sentences.
    const free = dataset.domainCards.find((k) => k.recallCost === 0);
    expect(free, 'the shipped dataset has no card with a Recall Cost of 0').toBeDefined();
    const c = seed({ vault: [free!.id] });
    play(c);
    openVault();
    click(
      buttons().find(
        (b) => (b.getAttribute('aria-label') ?? '') === `Recall ${free!.name} for 0 Stress`,
      )!,
    );
    expect(useApp.getState().characters[0]!.loadout).toContain(free!.id);
    expect(useApp.getState().log[0]!.detail).toBe('This card costs nothing to recall');
  });

  it('says why on the screen when it will not recall, not in a title', () => {
    const c = fullLoadout();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    const recall = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${card.name} cannot be recalled`),
    );
    expect(recall, 'the blocked vault row has no control at all').toBeDefined();
    expect(recall!.disabled).toBe(true);
    // The reason is text a thumb can read, not a hover.
    expect(recall!.textContent).toContain('FULL');
    expect(recall!.getAttribute('aria-label')).toContain('Loadout is full');
  });

  it('does not fade the shelf on a desktop either — it says FULL', () => {
    setViewport(1280);
    const c = fullLoadout();
    play(c);
    const card = index.cards.get(c.vault[0]!)!;
    const chip = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${card.name} - Loadout is full`),
    );
    expect(chip, 'the shelf card does not name its own refusal').toBeDefined();
    expect(chip!.textContent).toContain('FULL');
    expect(chip!.style.opacity, 'the shelf still dims instead of saying').toBe('');
  });
});

/**
 * P1-2, at the surface.
 *
 * `canAddToLoadout` has answered `affordable` since it was written and no UI
 * read it, so a recall with the Stress track full marked Hit Points instead
 * and said nothing until the log line afterwards. Reproduced against the real
 * engine: 6/6 Stress, 5/6 HP, a recall cost of 1, and the sixth Hit Point goes
 * with `hasFallen` behind it.
 */
describe('a recall that would be paid in Hit Points', () => {
  /** Stress full, one Hit Point from falling, and a card in the vault. */
  function onTheEdge(): Character {
    const base = playedCharacter();
    return seed({
      stress: { marked: base.stress.max, max: base.stress.max },
      hp: { marked: base.hp.max - 1, max: base.hp.max },
    });
  }

  it('says the number of Hit Points before the first tap', () => {
    const c = onTheEdge();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    const recall = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Recall ${card.name} - no Stress left`),
    );
    expect(recall, 'the recall does not warn that it would cost HP').toBeDefined();
    expect(recall!.textContent).toContain('1 HP');
  });

  it('does not take it on one tap', () => {
    const c = onTheEdge();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    const before = useApp.getState().characters[0]!;

    const warned = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Recall ${card.name} - no Stress left`),
    );
    expect(warned, 'the recall does not warn that it would cost HP').toBeDefined();
    click(warned!);

    const after = useApp.getState().characters[0]!;
    expect(after.hp.marked, 'one tap spent a Hit Point').toBe(before.hp.marked);
    expect(after.loadout, 'one tap moved the card').toEqual(before.loadout);
    // and the control now says what the second tap will do.
    const armedBtn = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Confirm: recall ${card.name}`),
    );
    expect(armedBtn, 'nothing on screen is asking for a confirmation').toBeDefined();
    expect(armedBtn!.textContent).toContain('MARK 1 HP');
  });

  it('takes it on the second, and marks exactly what it said', () => {
    const c = onTheEdge();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    const find = (prefix: string): HTMLButtonElement => {
      const found = buttons().find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith(prefix),
      );
      expect(found, `no control whose name starts "${prefix}"`).toBeDefined();
      return found!;
    };

    const before = useApp.getState().characters[0]!;
    click(find(`Recall ${card.name} - no Stress left`));
    click(find(`Confirm: recall ${card.name}`));

    const after = useApp.getState().characters[0]!;
    expect(after.loadout).toContain(card.id);
    // The button said MARK 1 HP because one Hit Point is all that is left to
    // mark; `markStress` stops at the end of the track and so does the price.
    expect(after.hp.marked).toBe(Math.min(before.hp.max, before.hp.marked + card.recallCost));
    expect(after.hp.marked).toBe(before.hp.marked + 1);
  });

  it('leaves an affordable recall a single tap', () => {
    const c = seed();
    play(c);
    openVault();
    const card = index.cards.get(c.vault[0]!)!;
    click(
      buttons().find(
        (b) =>
          (b.getAttribute('aria-label') ?? '') ===
          `Recall ${card.name} for ${card.recallCost} Stress`,
      )!,
    );
    expect(useApp.getState().characters[0]!.loadout).toContain(card.id);
  });
});

/**
 * P1-6, at the surface.
 *
 * `resolveCards` is a `.filter()`, so a ref this build cannot name vanished
 * from every display path while `canAddToLoadout` went on gating against the
 * raw array. Five held, two unreadable: the screen said "3 / 5", offered "2
 * SLOTS FREE", and refused every recall with "Loadout is full (5)". Three
 * numbers, one sheet, no two of them agreeing - and no way to move the ghosts,
 * because nothing drew them.
 */
describe('a card this build cannot read', () => {
  /** Five held, two of them refs from a bundle this device has not got. */
  function withGhosts(): Character {
    const base = playedCharacter();
    return seed({
      loadout: [...base.loadout, 'card-from-a-newer-bundle', 'card-from-a-homebrew-layer'],
    });
  }

  it('is counted the way the gate counts it', () => {
    play(withGhosts());
    expect(fold('Cards').textContent, 'the header disagrees with the recall gate').toContain(
      '5 / 5',
    );
  });

  it('is drawn, and names the ref so somebody can act on it', () => {
    play(withGhosts());
    // Through the fold, and the count above it is asserted separately: the
    // rows are what this test is about, and the fold defaults shut.
    click(fold('Cards'));
    const body = text();
    expect(body).toContain('CARD NOT IN THIS BUILD');
    expect(body).toContain('card-from-a-newer-bundle');
    expect(body).toContain('card-from-a-homebrew-layer');
  });

  it('can be moved to the vault by hand, which frees the slot', () => {
    const c = withGhosts();
    play(c);
    click(fold('Cards'));
    const move = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(
        'Move the unreadable card card-from-a-newer-bundle',
      ),
    );
    expect(move, 'there is no way to move the ghost out of the loadout').toBeDefined();
    click(move!);

    const after = useApp.getState().characters[0]!;
    expect(after.loadout).not.toContain('card-from-a-newer-bundle');
    expect(after.vault, 'the ref was deleted rather than vaulted').toContain(
      'card-from-a-newer-bundle',
    );
    expect(fold('Cards').textContent).toContain('4 / 5');
  });

  it('is never dropped on its own', () => {
    const c = withGhosts();
    play(c);
    // Rendering the screen must not tidy anything away: a ref this bundle does
    // not know today is very often one it will know after the next update.
    expect(useApp.getState().characters[0]!.loadout).toEqual(c.loadout);
  });

  it('stops the desktop gallery offering slots the gate will refuse', () => {
    setViewport(1280);
    play(withGhosts());
    const body = text();
    expect(body).toContain('5 / 5 ACTIVE');
    expect(body, 'the gallery still offers a slot the recall gate will refuse').not.toContain(
      'SLOTS FREE',
    );
    expect(body).toContain('CARD NOT IN THIS BUILD');
  });

  it('shows in the vault too, so that count agrees as well', () => {
    const base = playedCharacter();
    seed({ vault: [...base.vault, 'card-from-a-newer-bundle'] });
    play(useApp.getState().characters[0]!);
    expect(fold('Cards').textContent).toContain('4 INACTIVE');
    openVault();
    expect(text()).toContain('card-from-a-newer-bundle');
  });
});

/**
 * P3-9(b). Every USE button announced as "USE", and the sibling row button
 * carrying the item's name was `disabled` whenever the item had no note - so
 * for a rope with no printed text the name was on no reachable element at all,
 * and five carried items were five buttons called "USE".
 */
describe('the carried items, out loud', () => {
  it('gives every USE the name of what it uses', () => {
    const c = seed();
    play(c);
    click(fold('Carried'));
    const uses = buttons().filter((b) => (b.textContent ?? '').trim() === 'USE');
    expect(uses.length, 'the fixture carries two items').toBe(2);
    const names = uses.map((b) => b.getAttribute('aria-label') ?? '');
    expect(new Set(names).size, `two buttons announce the same: ${names.join(' | ')}`).toBe(2);
    for (const entry of c.inventory) {
      expect(names.some((n) => n.includes(entry.name)), `no USE names ${entry.name}`).toBe(true);
    }
  });

  it('does not hide an item’s name behind a disabled control', () => {
    // The rope has no note, so there is nothing to expand and nothing that
    // should look expandable - but its name still has to be on the page.
    const c = seed();
    play(c);
    click(fold('Carried'));
    const rope = c.inventory.find((e) => e.note === undefined)!;
    expect(text()).toContain(rope.name);
    const dead = buttons().filter((b) => b.disabled);
    expect(
      dead.map((b) => b.outerHTML.slice(0, 90)),
      'a disabled control is still standing where a name should be',
    ).toEqual([]);
  });
});

/**
 * The roll modifiers, which are not drawn when nothing is armed.
 *
 * Giorgio asked twice for this row to be removed. It was kept and folded, and
 * what shipped is what decision 6 is about: a permanent 44px band reading
 * `▶ MODIFIERS … NONE`, the band Giorgio wanted back, spent on announcing that
 * nothing is happening.
 *
 * The capability stays - 38 adversaries and 9 environments call for a reaction
 * roll, and an app you cannot roll with advantage in is wrong at the table -
 * so the controls move behind MODS on the roll bar, which costs no height at
 * all beside a 66px ROLL. The whole risk of that is the same as the fold's:
 * `advantage` and `reaction` are *not* cleared when a roll resolves, so an
 * armed modifier could sit off screen for the rest of the session. That is
 * what these tests are about, in both directions - nothing drawn when nothing
 * is armed, and a row that names whatever is.
 */
describe('the roll modifier row', () => {
  const byText = (label: string): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.textContent ?? '').trim() === label);

  /** ROLL: the one control on this surface that declares its own height. */
  const rollControl = (): HTMLButtonElement => {
    const found = buttons().find((b) => b.style.height === '66px');
    if (found === undefined) throw new Error('the phone has no roll control');
    return found;
  };

  /*
   * Replaces `is out of the way until it is wanted`, which asserted that a
   * header saying MODIFIERS … NONE was collapsed. This is the stronger claim
   * decision 6 actually makes: the words are nowhere on the screen, and the
   * whole surface costs one 44px column of a row ROLL was already holding.
   */
  it('draws no modifier row at all when nothing is armed', () => {
    play(seed());
    /*
     * Scoped to the roll surface, because the word NONE is not this file's to
     * ban outright: `Rest.tsx` prints NONE COUNTED on its own header when no
     * short rests have been taken, and that is a fact rather than a placeholder
     * for one.
     */
    const roll = buttons().find((b) => b.style.height === '66px')!;
    const surface = roll.parentElement!.parentElement!.textContent ?? '';
    expect(surface, 'the band is still spending a row on its own name').not.toContain('MODIFIERS');
    expect(surface, 'the band is still spending a row on the word NONE').not.toContain('NONE');
    for (const label of ['REACTION', 'ADV', 'DIS', '+ DIE']) {
      expect(byText(label), `${label} is drawn with nothing armed`).toBeUndefined();
    }
    expect(armedStrip(), 'the armed strip is drawn with nothing armed').toBeUndefined();

    // What there is instead: one 44x66 control at the right end of the roll
    // row, which costs no height because ROLL is already 66 tall.
    const mods = modsButton();
    expect(mods.getAttribute('aria-expanded')).toBe('false');
    expect(mods.style.width).toBe('44px');
    expect(mods.style.minHeight, 'MODS fixes a height, which ROLL is meant to be alone in').toBe(
      '66px',
    );
    expect(mods.style.height, 'MODS declares height, not minHeight').toBe('');
    expect(mods.parentElement, 'MODS is not on the roll row').toBe(roll.parentElement);
    // And it is the second child, not the first: the bottom-right is where an
    // idle thumb rests, and the control it fires by accident has to be the one
    // that costs nothing.
    expect([...roll.parentElement!.children]).toEqual([roll, mods]);
  });

  /*
   * Replaces `shows everything the closed row is holding, on the closed row`.
   * Same arming, same claim that the shut surface names it, plus the half that
   * is new: disarm and the row is gone from the DOM rather than emptied.
   */
  it('names what is armed on a row that exists only while something is', () => {
    play(seed());
    click(modsButton());
    click(byText('DIS')!);
    click(byText('REACTION')!);
    click(modsButton());

    const strip = armedStrip();
    expect(strip, 'two modifiers are armed and nothing on the screen says so').toBeDefined();
    expect(strip!.textContent).toContain('DIS');
    expect(strip!.textContent).toContain('REACTION');
    expect(strip!.getAttribute('aria-label')).toContain('DIS');
    expect(byText('DIS'), 'the controls are still drawn while the row is shut').toBeUndefined();
    // MODS says it too, for somebody who is listening rather than looking.
    expect(modsButton().getAttribute('aria-label')).toBe(
      'Modifiers for this roll: REACTION, DIS',
    );

    // The strip is a way back in as well as a readout.
    click(strip!);
    expect(byText('DIS'), 'tapping the armed strip did not open the row').toBeDefined();

    // Disarm both and the row goes, rather than staying as an empty band.
    click(byText('—')!);
    click(byText('REACTION')!);
    click(modsButton());
    expect(armedStrip(), 'the strip survives with nothing armed').toBeUndefined();
    const roll = buttons().find((b) => b.style.height === '66px')!;
    expect(
      roll.parentElement!.parentElement!.textContent ?? '',
      'the strip was emptied rather than removed',
    ).not.toContain('ARMED');
  });

  it('wraps when it is open, instead of hiding half of itself off the side', () => {
    play(seed());
    click(modsButton());
    const row = byText('REACTION')!.parentElement!;
    expect(row.style.flexWrap, 'the open row still scrolls sideways').toBe('wrap');
    expect(row.style.overflowX).not.toBe('auto');
    // Every control in it is still a real target.
    for (const b of [...row.querySelectorAll('button')]) {
      expect(b.style.minHeight, `${b.textContent ?? '?'} is under the floor`).toBe(
        'var(--control)',
      );
    }
  });

  /**
   * What the bar says a reaction roll paid.
   *
   * SRD, and `rollDuality` implements it: a reaction roll grants no Hope,
   * gives the GM no Fear and clears no Stress on a critical - `effects` is
   * three zeroes - so `resolve` moves no counter. Both roll surfaces were
   * indexing `OUTCOME_DETAIL` directly, and that table says "You gain a Hope"
   * for every `success-hope` and "Gain a Hope and clear a Stress" for every
   * critical, reaction or not. So the one line whose whole job is to say what
   * the roll cost or granted announced a Hope the app then did not hand over,
   * with the Hope counter four rows up disagreeing with it.
   *
   * `dice.ts` has had the honest reader since P4 - `outcomeDetail`, whose own
   * docblock says "promising a Hope the rules do not give is the same error as
   * handing one over" - and it was in the orphan list with nothing calling it.
   */
  it('does not promise a Hope a reaction roll never gives', () => {
    play(seed());
    const before = useApp.getState().characters[0]!;
    click(modsButton());
    click(byText('REACTION')!);
    click(modsButton());
    click(rollControl());

    const after = useApp.getState().characters[0]!;
    // The premise, asserted rather than assumed: nothing was paid.
    expect(after.hope.marked, 'a reaction roll moved Hope').toBe(before.hope.marked);
    expect(after.stress.marked, 'a reaction roll cleared Stress').toBe(before.stress.marked);

    const bar = rollControl().textContent ?? '';
    expect(bar, 'the bar hands over a Hope the roll did not').not.toContain('You gain a Hope');
    expect(bar, 'the bar hands the GM a Fear the roll did not').not.toContain(
      'The GM gains a Fear',
    );
    expect(bar, 'the bar clears a Stress the roll did not').not.toContain('clear a Stress');
    // Either honest sentence. A critical is 1 in 12 of 2d12, so which one it
    // is cannot be asserted without making this test a coin flip.
    expect(bar).toMatch(
      /A reaction roll pays nothing either way|Ignore what a success would have cost you/,
    );
  });
});

/**
 * The Experiences, which are declared before the dice and spent by them.
 *
 * The ids live in `Play` rather than in `DualityRoll`, because Giorgio's fold
 * order puts the chips below ROLL and the component that draws them there is
 * not the component that rolls. That move is invisible on the glass, which is
 * exactly why it needs an assertion: the rule it carries - declared for one
 * roll, disarmed by it - is the difference between a Hope spent once and a
 * roll silently two points high for the rest of the session.
 */
describe('the Experiences a roll is declared with', () => {
  /** The chip for one Experience, by the name `ExperienceChip` announces. */
  const chip = (name: string): HTMLButtonElement => {
    openExperiences();
    const found = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Utilize ${name},`),
    );
    if (found === undefined) throw new Error(`no Experience chip for "${name}"`);
    return found;
  };

  const rollControl = (): HTMLButtonElement => {
    const found = buttons().find((b) => b.style.height === '66px');
    if (found === undefined) throw new Error('the phone has no roll control');
    return found;
  };

  it('is declared for one roll, and the roll disarms it', () => {
    play(seed());
    click(chip('Ran with the wolves'));
    expect(chip('Ran with the wolves').getAttribute('aria-pressed')).toBe('true');

    click(rollControl());
    // The log is the deterministic half: the dice are random, the declaration
    // is not, and the line says what the Experience added and what it cost.
    expect(useApp.getState().log[0]!.detail).toContain('+2 exp (−1 Hope)');
    expect(
      chip('Ran with the wolves').getAttribute('aria-pressed'),
      'the Experience is still armed after the roll that spent it',
    ).toBe('false');

    click(rollControl());
    expect(
      useApp.getState().log[0]!.detail,
      'the second roll was paid for by an Experience nobody declared',
    ).not.toContain('exp');
  });

  it('does not follow the player onto the next sheet', () => {
    play(seed());
    click(chip('Ran with the wolves'));
    switchTo({ ...playedCharacter(), name: 'The other one' });
    expect(
      chip('Ran with the wolves').getAttribute('aria-pressed'),
      'the arriving sheet is holding somebody else’s Experience',
    ).toBe('false');
  });

  /**
   * The sentence the fold was granted on, asserted in the state that broke it.
   *
   * `PlayPhone` moves the chips behind a tendina on the warrant that "whatever
   * is armed is spelled out in full on the ROLL bar itself - so a declaration
   * is never behind a tap even when the fold is". That was true only while no
   * verdict was standing, which is the first roll of the evening and nothing
   * after it: roll, arm an Experience for the next one, shut the fold, and the
   * roll surface read the previous verdict and nothing else. The next roll was
   * +2 and a Hope with the whole screen silent about it, and the only survivor
   * was the shut header's `2 · 1 ARMED`, which at 375x667 is below the fold.
   */
  it('is named on the shut ROLL bar before the first roll and after one', () => {
    play(seed());
    const shutFold = (): void => {
      const header = fold('Experiences');
      if (header.getAttribute('aria-expanded') === 'true') click(header);
    };

    click(chip('Ran with the wolves'));
    shutFold();
    expect(fold('Experiences').getAttribute('aria-expanded')).toBe('false');
    expect(
      rollControl().textContent,
      'the chips are behind a tap and the bar does not say what is armed',
    ).toContain('RAN WITH THE WOLVES +2');
    expect(rollControl().textContent, 'the Hope it will cost is unsaid').toContain('1 HOPE');

    // The roll spends it, so the bar stops claiming it. Nothing is declared
    // for the roll after this one, and the bar must not imply otherwise.
    click(rollControl());
    const verdict = useApp.getState().log[0]!;
    expect(rollControl().textContent).not.toContain('RAN WITH THE WOLVES');

    // The state this shipped broken: a verdict standing, and an Experience
    // armed for the roll after it.
    click(chip('Ran with the wolves'));
    shutFold();
    const bar = rollControl().textContent ?? '';
    expect(bar, 'the next roll is +2 and a Hope, and the roll surface says nothing').toContain(
      'RAN WITH THE WOLVES +2',
    );
    // And it is not readable as part of the number standing beside it: a +2
    // printed next to a total is a total that counted the +2.
    expect(bar, 'the declaration reads as though the standing verdict counted it').toContain(
      'NEXT: RAN WITH THE WOLVES +2',
    );
    // The verdict is still reported. The declaration takes the detail line,
    // which restates a consequence already applied, and nothing else.
    expect(bar, 'naming the declaration cost the player their result').toContain(verdict.label);
    expect(bar).toContain(String(verdict.total));
  });

  it('is labelled the same way on the cockpit, which prints it beside the total too', () => {
    setViewport(1280);
    play(seed());
    // No fold here: the cockpit keeps the chips inline in the control row.
    const inlineChip = (): HTMLButtonElement => {
      const found = buttons().find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith('Utilize Ran with the wolves,'),
      );
      if (found === undefined) throw new Error('the cockpit has no Experience chip');
      return found;
    };
    const rollButton = (): HTMLButtonElement => {
      const found = buttons().find((b) => (b.textContent ?? '').includes('2d12'));
      if (found === undefined) throw new Error('the cockpit has no roll button');
      return found;
    };

    click(rollButton());
    click(inlineChip());
    expect(
      text(),
      'the verdict strip prints the next roll’s +2 as though this roll had it',
    ).toContain('NEXT: RAN WITH THE WOLVES +2');
  });
});

/**
 * A verdict belongs to the sheet that rolled it.
 *
 * `App` renders `<Play />` unkeyed and `Play` renders `<DualityRoll />` unkeyed
 * inside it, so the header's character picker swaps the character underneath a
 * component that keeps every piece of its own state. The armed declaration was
 * cleared on that switch and the resolved *result* was not, so the roll
 * control - the largest object on the phone's roll surface, and the one thing
 * on it that reports an outcome - went on showing the previous player's total
 * and "Success with Fear" over the arriving player's sheet. Nothing on the
 * screen said whose roll it was, because until the switch there had only ever
 * been one candidate.
 */
describe('the roll surface, when the header swaps the sheet', () => {
  /** The one control on the phone that both rolls and reports. */
  const rollControl = (): HTMLButtonElement => {
    const found = buttons().find((b) => b.style.height === '66px');
    if (found === undefined) throw new Error('the phone has no roll control');
    return found;
  };

  it('does not read the last character’s total as this one’s', () => {
    play(seed());
    // Digital dice are on by default, so ROLL resolves; which faces come up
    // does not matter here, only that a verdict exists to be carried over.
    click(rollControl());
    expect(rollControl().textContent, 'nothing resolved, so there is nothing to test').not.toContain(
      'ROLL',
    );
    expect(rollControl().textContent).not.toContain('—');

    switchTo({ ...playedCharacter(), name: 'The other one' });
    expect(
      rollControl().textContent,
      'the arriving sheet was handed a verdict it never rolled',
    ).toContain('ROLL');
    expect(
      rollControl().textContent,
      'the arriving sheet was handed a total it never rolled',
    ).toContain('—');
  });

  it('does not leave the last character’s dice in the faces a table types into', () => {
    // With typing on, the two faces are the readout as well as the input, and
    // `manual` is written from every resolve. Left standing, the arriving
    // player sees somebody else's 9 and 4, and typing over one of the two
    // re-resolves against the other one.
    const c = seed();
    useApp.setState({ prefs: { ...DEFAULT_PREFS, manualDice: true } });
    play(c);
    click(rollControl());
    // `Die` puts the value into its own accessible name - "HOPE die: 9" - and
    // leaves it out entirely when there is none, so the label answers this
    // without reading a number off the glass.
    const faces = (): string[] =>
      buttons()
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter((label) => /^(HOPE|FEAR) die/.test(label));
    expect(faces(), 'the roll did not fill the faces').toHaveLength(2);
    expect(faces().every((f) => f.includes(': ')), 'the roll left the faces empty').toBe(true);

    switchTo({ ...playedCharacter(), name: 'The other one' });
    expect(
      faces().filter((f) => f.includes(': ')),
      'the arriving sheet inherited somebody else’s dice',
    ).toEqual([]);
  });
});

/**
 * P2-1's open half: the tablet band.
 *
 * Below 1180px the app used to run the cockpit at two columns, with `Vitals`
 * and `DualityRoll` inside a scrolling column and `DualityRoll`'s own root at
 * `flex: 1, minHeight: 0, overflow: hidden`. Its children lay out to their
 * natural height, so the panel was crushed - 45px at 744x1133, 26px at
 * 1024x768 - and ROLL rendered about 228px past the clip: present in the DOM,
 * invisible on the glass, and still reachable by keyboard focus. On every
 * iPad, and every phone in landscape, you could not roll.
 */
describe('every width below the cockpit', () => {
  const sizes: Array<[string, number]> = [
    ['an iPad mini in portrait', 744],
    ['an iPad in landscape', 1024],
    ['a phone in landscape', 852],
  ];

  for (const [what, width] of sizes) {
    it(`can roll on ${what}`, () => {
      setViewport(width);
      play(seed());

      const roll = buttons().find((b) => (b.textContent ?? '').includes('ROLL'));
      expect(roll, 'there is no ROLL control at all').toBeDefined();

      // Nothing between it and the screen clips. The failure was never a
      // missing button: it was a button drawn outside its parent's box, still
      // in the DOM and still reachable by keyboard focus.
      const clipped: string[] = [];
      for (let el = roll!.parentElement; el !== null && el !== container; el = el.parentElement) {
        const s = el.style;
        if (s.overflow === 'hidden' || s.overflowY === 'hidden') {
          clipped.push(el.className || el.tagName);
        }
      }
      expect(clipped, `ROLL is inside a clipped box: ${clipped.join(', ')}`).toEqual([]);

      // And it states its own height, in a block that is `flex: none`, so
      // nothing above it can take the pixels back.
      expect(roll!.style.height).toBe('66px');
    });
  }

  it('draws the one-column sheet, not the two-column cockpit', () => {
    setViewport(744);
    play(seed());
    /*
     * The sheet's own sections, which the two-column cockpit never had room
     * for on the left and never rendered on the right.
     *
     * The gold used to be looked for as the word "Gold", which was the label
     * on a row of its own. That row is gone and the total rides on the Carried
     * header instead, so the assertion asks for the total - which is the thing
     * this test was ever really about - rather than for a label that no longer
     * exists.
     */
    expect(fold('Carried').textContent).toContain('1 BAG · 4 HANDFULS');
    expect(fold('Cards')).toBeDefined();
    /*
     * This used to assert `rootEl.children` had length 2 - the scroll and the
     * pinned block - which distinguished the sheet from the cockpit only by
     * accident. It is the same claim said properly now: the cockpit is a grid
     * of three named columns and the sheet is one scrolling flex column.
     */
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.style.display, 'this is the grid cockpit, not the one-column sheet').not.toBe(
      'grid',
    );
    expect(rootEl.className).toContain('stack');
    expect(rootEl.style.overflowY).toBe('auto');
  });

  it('still gives the cockpit to a real desktop', () => {
    setViewport(1280);
    play(seed());
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.style.display).toBe('grid');
    expect(rootEl.style.gridTemplateColumns).toContain('minmax(300px, 336px)');
  });
});

describe('the tendina', () => {
  it('says what is inside a section it has folded away', () => {
    const c = seed();
    play(c);
    // Carried is closed by default, and its header still carries the count -
    // a fold that hides how many potions you have costs a tap rather than
    // saving a scroll.
    expect(fold('Carried').getAttribute('aria-expanded')).toBe('false');
    expect(fold('Carried').textContent).toContain('2 ITEMS');
    expect(text(), 'a closed section drew its contents').not.toContain('Minor Health Potion');

    click(fold('Carried'));
    expect(text()).toContain('Minor Health Potion');
  });

  /*
   * The direction is flipped from what it was, and that is the point: every
   * fold on this sheet defaults shut now, so the arrangement worth remembering
   * is the one a player opened rather than the one they closed.
   */
  it('remembers what was open, per character, across a remount', () => {
    const c = seed();
    play(c);
    expect(fold('Cards').getAttribute('aria-expanded')).toBe('false');
    click(fold('Cards'));
    expect(fold('Cards').getAttribute('aria-expanded')).toBe('true');

    act(() => root.unmount());
    root = createRoot(container);
    play(c);
    expect(
      fold('Cards').getAttribute('aria-expanded'),
      'the fold shut itself again on the next launch',
    ).toBe('true');
  });

  it('does not carry one character’s arrangement onto another', () => {
    const first = seed();
    play(first);
    click(fold('Cards'));
    expect(useApp.getState().prefs.playSections[`${first.id}:cards`]).toBe(true);

    const second = seed({ id: 'other-sheet' });
    // A fresh sheet, keeping whatever the first one recorded.
    useApp.setState({
      prefs: { ...useApp.getState().prefs },
      characters: [second],
      activeId: second.id,
    });
    act(() => root.unmount());
    root = createRoot(container);
    play(second);
    expect(
      fold('Cards').getAttribute('aria-expanded'),
      'the second sheet arrived holding the first one’s arrangement',
    ).toBe('false');
  });

  /*
   * This used to demand `var(--tap)` AND `width: 100%` of every button on Play
   * carrying `aria-expanded`, and `Rest.tsx`'s docblock cites it by name as the
   * reason that file never sets the attribute.
   *
   * The touch-floor half is kept whole-screen, because that is the half the
   * rule is about and the half other files are written against. The width half
   * is scoped to what it was always really claiming - a section header, which
   * `Disclosure` renders as a `<button>` directly inside its own `<section>` -
   * because the trait row's verbs control is a 44x44 button at the end of a row
   * of chips and a full-width one there would cost the row this whole change
   * saved. Its own dimensions are asserted below rather than exempted.
   */
  it('gives every expandable the touch floor, and every section header the whole width', () => {
    play(seed());
    const expandables = buttons().filter((x) => x.getAttribute('aria-expanded') !== null);
    expect(expandables.length, 'nothing on the sheet expands').toBeGreaterThan(5);
    for (const b of expandables) {
      /*
       * `var(--tap)` or a number at or above it. MODS declares `minHeight: 66`
       * because it stands beside a 66px ROLL, and the rule this sweep is about
       * is the floor rather than the token: a control that clears 44 by
       * twenty-two pixels has not weakened it.
       */
      const declared = b.style.minHeight;
      const value = declared === 'var(--tap)' ? 44 : Number.parseFloat(declared);
      expect(
        value,
        `${b.getAttribute('aria-label') ?? b.textContent ?? '?'} declares ${declared}`,
      ).toBeGreaterThanOrEqual(44);
    }
    for (const b of [...container.querySelectorAll<HTMLButtonElement>('section > button')].filter(
      (x) => x.getAttribute('aria-expanded') !== null,
    )) {
      expect(b.style.width, `${b.textContent ?? '?'} is not the whole column`).toBe('100%');
    }
  });

  it('gives the two in-row expandables 44px in both directions instead', () => {
    play(seed());
    const inRow = buttons().filter(
      (b) => b.getAttribute('aria-expanded') !== null && b.closest('section') === null,
    );
    /*
     * Two, and the list is asserted whole rather than filtered: a third in-row
     * expandable appearing would be a full-width fold header's worth of screen
     * spent somewhere this sweep does not check the width, and the way to find
     * that out is here rather than on a phone.
     */
    expect(
      inRow.map((b) => b.getAttribute('aria-label')),
      'the expandables that are not section headers have changed',
    ).toEqual(['What each trait is for', 'Modifiers for this roll']);
    for (const b of inRow) {
      const declared = b.style.minHeight;
      const value = declared === 'var(--tap)' ? 44 : Number.parseFloat(declared);
      expect(value, `${b.getAttribute('aria-label') ?? '?'} declares ${declared}`).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(b.style.width)).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * What the next attack is declared with.
 *
 * Three surfaces set the trait on this screen when this was written - a strip
 * of chips in the block that was pinned then, the trait grid inside the scroll,
 * and the SPELLCAST chip in the modifier row - and only the chips ever put an
 * armed weapon down. So tapping a trait anywhere
 * else left the sword armed, and the damage step P1-1 is about would have
 * offered a sword's dice for a Knowledge check while the screen showed
 * KNOWLEDGE on the roll bar. Nothing threw, and nothing on screen disagreed
 * with anything else; the declaration was simply wrong.
 */
describe('what the attack is made with', () => {
  /** A row you can arm: the weapon buttons carry the weapon's own name. */
  function weaponRow(name: string): HTMLButtonElement {
    openEquipped();
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  /**
   * A trait chip, by the three letters it prints.
   *
   * There used to be a `traitTile` beside this, because the phone drew the six
   * traits twice - a grid in the scroll and a strip in the pinned block - and a
   * test could arm one and read the other. There is one row now, so the helper
   * that found the tile is gone and its five callers point here; the tiles
   * survive in the desktop cockpit, which these tests do not render.
   */
  function traitChip(abbreviation: string): HTMLButtonElement {
    const found = buttons().find((b) =>
      new RegExp(`^${abbreviation} [+−]`).test((b.textContent ?? '').trim()),
    );
    if (found === undefined) throw new Error(`no trait chip called "${abbreviation}"`);
    return found;
  }

  /** A sheet whose primary weapon rolls with something other than the default. */
  const withBattleaxe = (): Character => seed({ activePrimaryWeapon: 'battleaxe' });

  it('takes the trait from the weapon, and takes the weapon back when a trait is tapped', () => {
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    expect(weaponRow('Battleaxe').getAttribute('aria-pressed')).toBe('true');
    // "The trait that applies to an attack roll is specified by the weapon or
    // spell being used." A player who taps a sword has declared that roll.
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('true');

    // The same scenario the tile version drove, on the one row. Tapping AGI is
    // declaring a roll the axe did not specify, so the axe steps back - and
    // because there is one surface now, the chip that is pressed and the chip
    // that was tapped are necessarily the same object.
    click(traitChip('AGI'));
    expect(traitChip('AGI').getAttribute('aria-pressed')).toBe('true');
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('false');
    expect(
      weaponRow('Battleaxe').getAttribute('aria-pressed'),
      'the axe is still armed for an Agility roll it was not declared for',
    ).toBe('false');
  });

  it('takes the weapon back when SPELLCAST is armed from the modifier row', () => {
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    click(modsButton());
    const spellcast = buttons().find((b) => (b.textContent ?? '').trim() === 'SPELLCAST');
    expect(spellcast, 'the fixture is a Troubadour and has no SPELLCAST chip').toBeDefined();
    click(spellcast!);
    expect(
      weaponRow('Battleaxe').getAttribute('aria-pressed'),
      'the axe is still armed for a Spellcast roll',
    ).toBe('false');
  });

  it('says what is armed on the closed fold, so a declaration is never off screen', () => {
    play(withBattleaxe());
    expect(fold('Weapons & armour').textContent).toContain('3 WORN');
    click(weaponRow('Battleaxe'));
    expect(
      fold('Weapons & armour').textContent,
      'the fold can be shut with a weapon armed and nothing would say which',
    ).toContain('ARMED · BATTLEAXE');
  });

  it('lets go of a weapon that comes off in Build', () => {
    /*
     * The declaration is a ref, and a ref has to be resolved against something.
     * Resolved against `index.weapons` - the 204 shipped weapons, which is
     * where a weapon's dice live and therefore the obvious place to look - the
     * lookup answers "yes, a Battleaxe exists" to the question "is this
     * character holding a Battleaxe". So the fold went on saying ARMED ·
     * BATTLEAXE directly above its own section saying nothing is equipped, and
     * the offer under the next roll stood at 2d10+3.
     */
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    expect(fold('Weapons & armour').textContent).toContain('ARMED · BATTLEAXE');

    rebuild({ activePrimaryWeapon: null, activeSecondaryWeapon: null, activeArmor: null });
    expect(text()).toContain('Nothing equipped');
    expect(
      fold('Weapons & armour').textContent,
      'the fold names a weapon the section beneath it says is not there',
    ).not.toContain('BATTLEAXE');
    expect(fold('Weapons & armour').textContent).toContain('NOTHING');
  });

  it('does not hand the next sheet the last one’s declaration', () => {
    /*
     * `Play` is rendered unkeyed and holds the declaration in its own state, so
     * the header's picker swaps the character under a component that keeps
     * whatever was armed. This other sheet carries the same kit on purpose:
     * resolving against what the character is holding cannot catch this one,
     * because the arriving character genuinely is holding a Battleaxe. It is
     * still an attack nobody declared on this sheet, and the trait chip beside
     * it is the one the previous player picked.
     */
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));

    switchTo({ ...playedCharacter(), name: 'The other one', activePrimaryWeapon: 'battleaxe' });
    expect(
      fold('Weapons & armour').textContent,
      'the arriving sheet was handed an attack it never declared',
    ).not.toContain('ARMED');
    expect(weaponRow('Battleaxe').getAttribute('aria-pressed')).toBe('false');
  });

  it('does not hand the next sheet the fists either', () => {
    // Unarmed resolves off the arriving character's own Proficiency, so it
    // never renders a wrong number - which is exactly why it would have gone
    // unnoticed. It is still an attack this player did not declare.
    play(seed());
    click(weaponRow('Unarmed'));
    switchTo({ ...playedCharacter(), name: 'The other one' });
    expect(weaponRow('Unarmed').getAttribute('aria-pressed')).toBe('false');
  });


  /*
   * Unarmed attacks, which existed nowhere in `src/` at all - the word did not
   * appear in a single rendered file, so a character who had lost their weapon
   * had no attack on this screen and `[Proficiency]d4` was a rule the app had
   * no way to reach.
   */
  it('carries a row for being empty-handed, at [Proficiency]d4', () => {
    play(seed());
    const row = weaponRow('Unarmed');
    // Proficiency 2 at level 3, so 2d4 - the count is the Proficiency itself.
    expect(row.textContent).toContain('2d4');
    expect(row.textContent).toContain('STRENGTH OR FINESSE');
  });

  it('keeps that row when there is no gear at all', () => {
    // Having nothing equipped is the state the rule is written for, so this is
    // the one row that must not disappear with the loadout.
    play(seed({ activePrimaryWeapon: null, activeSecondaryWeapon: null, activeArmor: null }));
    openEquipped();
    expect(text()).toContain('Nothing equipped');
    expect(weaponRow('Unarmed').textContent).toContain('d4');
  });

  it('does not pick the trait for the GM when it is armed', () => {
    play(seed());
    click(weaponRow('Unarmed'));
    expect(weaponRow('Unarmed').getAttribute('aria-pressed')).toBe('true');
    expect(fold('Weapons & armour').textContent).toContain('ARMED · UNARMED');
    // "Unarmed attack rolls use either Strength or Finesse (GM's choice)", so
    // the chips are exactly where they were.
    expect(traitChip('AGI').getAttribute('aria-pressed')).toBe('true');
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('false');
    expect(traitChip('FIN').getAttribute('aria-pressed')).toBe('false');
  });

  it('leaves it standing under either of the two the rule names', () => {
    // A weapon steps back when you pick a trait by hand, because it had already
    // specified one. An unarmed declaration never did: choosing Strength here
    // is completing the declaration, not replacing it.
    play(seed());
    click(weaponRow('Unarmed'));
    click(traitChip('STR'));
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('true');
    expect(
      weaponRow('Unarmed').getAttribute('aria-pressed'),
      'picking the trait the GM asked for withdrew the attack it belongs to',
    ).toBe('true');

    // And the other half of "either Strength or Finesse".
    click(traitChip('FIN'));
    expect(weaponRow('Unarmed').getAttribute('aria-pressed')).toBe('true');
  });

  it('withdraws it under a trait the rule does not name', () => {
    /*
     * *"Unarmed attack rolls use either Strength or Finesse (GM's choice)"* is
     * the whole warrant for the fists surviving a trait tap, and it offers two
     * traits. Under Knowledge the exemption is quoting a sentence that does not
     * cover it - the fists stay declared for a Recall check and the damage
     * offer says 2d4 PHY.
     */
    play(seed());
    click(weaponRow('Unarmed'));
    click(traitChip('KNO'));
    expect(traitChip('KNO').getAttribute('aria-pressed')).toBe('true');
    expect(
      weaponRow('Unarmed').getAttribute('aria-pressed'),
      'the fists are declared for a Knowledge check, which is not a punch',
    ).toBe('false');
  });

  it('withdraws it under SPELLCAST, which is not one of the six at all', () => {
    /*
     * The one that shows on screen. The SPELLCAST chip in the modifier row is
     * the third surface that picks a trait by hand, and it went through the
     * same flat `kind === 'unarmed'` exemption - so the roll bar read SPELLCAST
     * while the damage offer under it read 2d4 physical, which is a punch.
     */
    play(seed());
    click(weaponRow('Unarmed'));
    click(modsButton());
    const spellcast = buttons().find((b) => (b.textContent ?? '').trim() === 'SPELLCAST');
    expect(spellcast, 'the fixture is a Troubadour and has no SPELLCAST chip').toBeDefined();
    click(spellcast!);
    expect(
      weaponRow('Unarmed').getAttribute('aria-pressed'),
      'the fists are declared for a Spellcast roll',
    ).toBe('false');
  });

  it('puts a weapon down when the fists come up', () => {
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    click(weaponRow('Unarmed'));
    expect(weaponRow('Battleaxe').getAttribute('aria-pressed')).toBe('false');
    expect(weaponRow('Unarmed').getAttribute('aria-pressed')).toBe('true');
  });
});

/**
 * The spell, which is the one attack this sheet cannot read off a card.
 *
 * *"Any time an effect says to deal damage using your Spellcast trait, you roll
 * a number of dice equal to your Spellcast trait"* - so the count is the app's
 * to supply and the die and the modifier are the player's, because a domain
 * card carries free prose and parsing a pool out of it would mean overwriting
 * the `2` on a card that prints its own `2d8+4`.
 *
 * The fixture is a Bard/Troubadour, whose Spellcast trait is Presence, and the
 * fixture's Presence is +0. So the default sheet is the refusal, and the
 * rollable panel needs the trait raised.
 */
describe('the spell, and the +0 that rolls nothing', () => {
  /** Every die chip in the Spellcast panel, in the order they are drawn. */
  const dieChips = (): HTMLButtonElement[] => {
    openEquipped();
    return buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Cast with a d'));
  };

  /** The panel itself: a div, where the weapon rows are buttons. */
  function panel(): HTMLElement {
    openEquipped();
    const found = [...container.querySelectorAll<HTMLElement>('div.panel')].find((el) =>
      (el.textContent ?? '').startsWith('Spellcast'),
    );
    if (found === undefined) throw new Error('no Spellcast panel on the sheet');
    return found;
  }

  function armable(name: string): HTMLButtonElement {
    openEquipped();
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  /** A trait chip on the one trait row. Was `pinnedChip`; nothing is pinned. */
  function traitChip(abbreviation: string): HTMLButtonElement {
    const found = buttons().find((b) =>
      new RegExp(`^${abbreviation} [+−]`).test((b.textContent ?? '').trim()),
    );
    if (found === undefined) throw new Error(`no trait chip called "${abbreviation}"`);
    return found;
  }

  /** The MOD field, which is the `+3` a player reads off the card in their hand. */
  function modInput(): HTMLInputElement {
    openEquipped();
    const found = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(
      (el) => (el.parentElement?.textContent ?? '').startsWith('MOD'),
    );
    if (found === undefined) throw new Error('the panel has no MOD input');
    return found;
  }

  /**
   * Type into a controlled input the way a keyboard does: React tracks the
   * last value it wrote on the node, so assigning `.value` looks like no
   * change at all and `onChange` never runs.
   */
  function type(field: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /*
   * The same caster at a different Presence, and the id is pinned because it
   * has to be the same caster: `playedCharacter()` mints a fresh
   * `crypto.randomUUID()` on every call, so re-seeding without pinning it is a
   * character switch - and a declaration does not follow the player onto
   * another sheet.
   */
  const casting = (presence: number): Character =>
    seed({ id: 'the-caster', traits: { ...playedCharacter().traits, presence } });

  it('refuses at +0 in the book’s own words, with nothing to press', () => {
    // Not a disabled chip row, and not a greyed control still saying ROLL
    // DAMAGE: at +0 there is no roll to make, and a target that cannot do
    // anything is the app saying it could and won't.
    play(seed());
    expect(dieChips(), 'the +0 panel offered dice to tap').toHaveLength(0);
    expect(panel().textContent).toContain('NO DICE');
    expect(panel().textContent).toMatch(/\+0 or lower/);
    // In quotation marks, because these are the SRD's words and not ours. The
    // app's own fallback sentence, for a rules layer that does not carry it,
    // is deliberately not quoted.
    expect(panel().textContent).toContain('“');
    // And it names which of the six numbers is the one at +0, since "Spellcast
    // trait" is not printed anywhere on the trait chips.
    expect(panel().textContent).toContain('PRESENCE +0');
  });

  it('counts the dice off the trait, not off Proficiency', () => {
    // Presence +3 with Proficiency 2. Reading the count off Proficiency - the
    // rule every other pool on this screen follows - would say 2d8.
    play(casting(3));
    expect(dieChips()).toHaveLength(6);
    click(dieChips()[2]!);
    expect(panel().textContent, 'the die count came from somewhere else').toContain('3d8');
    expect(panel().textContent).toContain('PRESENCE +3');
    expect(panel().textContent).toContain('3 DICE');
  });

  it('arms the Spellcast slot with the same tap, since the spell specifies it', () => {
    play(casting(3));
    click(dieChips()[2]!);
    expect(dieChips()[2]!.getAttribute('aria-pressed')).toBe('true');
    // "The trait that applies to an attack roll is specified by the weapon or
    // spell being used." SPELLCAST is not one of the six trait chips, so the
    // armed strip is where the sheet says which slot is armed - and the strip
    // exists at all only because something is.
    expect(traitChip('PRE').getAttribute('aria-pressed')).toBe('false');
    expect(armedStrip()!.textContent).toContain('SPELLCAST');
    expect(fold('Weapons & armour').textContent).toContain('ARMED · SPELLCAST');
  });

  it('keeps the modifier the card printed when the die changes', () => {
    /*
     * A card prints one formula. Clearing the +3 because the player corrected
     * the die would be the app forgetting a thing it was told two seconds
     * before, and it is typed rather than parsed because a DomainCard carries
     * prose: only three shipped cards say "using your Spellcast trait" at all,
     * and only one of them pairs it with a formula.
     */
    play(casting(3));
    type(modInput(), '3');
    click(dieChips()[2]!);
    expect(panel().textContent).toContain('3d8+3');
    click(dieChips()[3]!);
    expect(panel().textContent, 'changing the die threw the card’s modifier away').toContain(
      '3d10+3',
    );
  });

  it('keeps the unknown die’s dash off the modifier’s sign', () => {
    /*
     * Two dashes in a row. The em-dash stands in for the die nobody has picked
     * yet and the hyphen is the sign of the modifier off the card, so a spell
     * written d?-3 printed `3d—-3` and a player reading their own damage had to
     * work out which dash was which first.
     */
    play(casting(3));
    type(modInput(), '-3');
    expect(dieChips().every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(panel().textContent, 'the placeholder ran into the sign').not.toContain('—-');
    expect(panel().textContent).toContain('3d— -3');
  });

  it('puts the sword down when a spell is declared, and the spell down when a trait is picked', () => {
    play(casting(3));
    click(armable('Broadsword'));
    click(dieChips()[2]!);
    expect(armable('Broadsword').getAttribute('aria-pressed')).toBe('false');
    // And back the other way: picking a trait by hand is declaring a roll the
    // spell did not, so the spell steps back the way a weapon does.
    click(traitChip('AGI'));
    expect(dieChips()[2]!.getAttribute('aria-pressed')).toBe('false');
    expect(traitChip('AGI').getAttribute('aria-pressed')).toBe('true');
  });

  it('stops calling a spell armed when the trait that counted its dice is gone', () => {
    /*
     * The declaration outlives the pool. It is a die and a modifier, and the
     * count is re-derived from the trait every render - so a spell armed at
     * Presence +3 is still declared when something takes Presence to +0, and it
     * now resolves to nothing at all. Read off the declaration rather than off
     * what it resolves to, this panel would draw ARMED and a hope-washed border
     * around the words NO DICE: the sheet saying a spell is ready to cast in
     * the same breath as the rule that says it is not.
     */
    play(casting(3));
    click(dieChips()[2]!);
    expect(panel().textContent).toContain('ARMED');
    expect(panel().textContent).toContain('3d8');

    play(casting(0));
    expect(panel().textContent).toContain('NO DICE');
    expect(panel().textContent, 'a spell with no dice under it still says ARMED').not.toContain(
      'ARMED',
    );
  });

  it('draws no panel at all for a character who cannot cast', () => {
    // A Guardian/Stalwart has no Spellcast trait. Four lines explaining that
    // would be the sheet answering a question this character never asked.
    play(seed({ classRef: 'guardian', subclassRefs: ['stalwart'], loadout: [], vault: [] }));
    /*
     * The fold is opened BEFORE the assertion, and that is the whole
     * difference between this test working and this test lying. Weapons &
     * armour defaults shut, so `text()` does not contain 'Spellcast' for a
     * Bard either - the claim here is that the panel is not drawn, not that it
     * is not currently visible.
     */
    openEquipped();
    expect(text()).not.toContain('Spellcast');
    expect(dieChips()).toHaveLength(0);
  });
});

/**
 * The link the app has never had: an attack roll leading into its damage roll.
 *
 * `rollDamage` has been correct since the first commit and has never had a
 * caller, so this is the first test in the repo that can watch a damage roll
 * happen on a screen. Typing is switched on for these, because it is the only
 * way to decide what the Duality dice show - a critical needs matching faces,
 * and an undecided roll needs two that do not match.
 */
describe('rolling the damage the attack earned', () => {
  /** A sheet at 393px with typed dice on, so the faces can be dictated. */
  function withTypedDice(patch: Partial<Character> = {}): Character {
    const c = seed(patch);
    useApp.setState({ prefs: { ...DEFAULT_PREFS, manualDice: true } });
    play(c);
    return c;
  }

  function weaponRow(name: string): HTMLButtonElement {
    openEquipped();
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  /**
   * Everything `DualityRoll` draws on a phone.
   *
   * This used to be `container.firstElementChild.children[1]`, the pinned
   * block, with a comment explaining that the defence band up in the scroll is
   * a `repeat(4, 1fr)` grid too and comes first in document order. That is
   * still true and the block is gone, so the surface is found from the one
   * control that fixes its own height instead of from a child index - and two
   * levels up rather than one, because ROLL shares its row with MODS.
   */
  const rollSurface = (): HTMLElement => {
    const roll = buttons().find((b) => b.style.height === '66px');
    if (roll === undefined) throw new Error('the phone has no roll control');
    return roll.parentElement!.parentElement!;
  };

  /** Tap a die face open and pick a value out of its 4-column grid. */
  function typeFace(label: 'HOPE' | 'FEAR', value: number): void {
    const face = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${label} die`),
    );
    if (face === undefined) throw new Error(`no ${label} die face to type into`);
    click(face);
    const grid = [...rollSurface().querySelectorAll<HTMLElement>('div')].find(
      (d) => d.style.gridTemplateColumns === 'repeat(4, 1fr)',
    );
    if (grid === undefined) throw new Error('the die did not open its face grid');
    const cell = [...grid.querySelectorAll('button')].find((b) => b.textContent === String(value));
    if (cell === undefined) throw new Error(`the face grid has no ${String(value)}`);
    click(cell);
  }

  /** The damage control, which is the only thing here that announces a roll. */
  const damageControl = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Roll '));

  /** The damage dice, which only exist when this table types its own. */
  const damageSlots = (): HTMLButtonElement[] =>
    buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Damage die '));

  /** The same gesture as `typeFace`, on a grid that is five across, not four. */
  function typeDamageFace(index: number, value: number): void {
    const slot = damageSlots()[index];
    if (slot === undefined) throw new Error(`no damage slot ${String(index + 1)}`);
    click(slot);
    const grid = [...rollSurface().querySelectorAll<HTMLElement>('div')].find(
      (d) => d.style.gridTemplateColumns === 'repeat(5, 1fr)',
    );
    if (grid === undefined) throw new Error('the damage die did not open its face grid');
    const cell = [...grid.querySelectorAll('button')].find((b) => b.textContent === String(value));
    if (cell === undefined) throw new Error(`the face grid has no ${String(value)}`);
    click(cell);
  }

  it('offers the scaled pool, and the critical bonus that pool earns', () => {
    // Battleaxe is d10+3, and the fixture is Proficiency 2 - so the pool is
    // 2d10+3 and the critical adds 20, not 10. Matching faces are a critical.
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);

    const damage = damageControl();
    expect(damage, 'a successful attack offered no damage roll').toBeDefined();
    const label = damage!.textContent ?? '';
    expect(label).toContain('CRITICAL');
    expect(label).toContain('2d10+3');
    expect(label, 'the bonus was read off the unscaled weapon').toContain('+20');
    expect(label).not.toContain('+10');
  });

  it('offers it with no Difficulty typed, which is the default and the common case', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);

    const damage = damageControl();
    expect(damage, 'no Difficulty meant no offer at all').toBeDefined();
    expect((damage!.textContent ?? '').trim()).toMatch(/^IF IT HIT/);
  });

  it('offers it even when arming the weapon moves nothing else', () => {
    /*
     * The Broadsword rolls with Agility, and Agility is already the armed
     * trait - so arming it changes the declaration and not one other thing on
     * this screen. That is exactly where a stale `resolve` closure hides: every
     * other value that callback depends on stays put, so if `source` is not
     * among them the snapshot is taken from the first render, where nothing was
     * declared, and the offer never appears with nothing on screen saying why.
     * There is no eslint in this repo to notice a missing dependency.
     */
    withTypedDice();
    click(weaponRow('Broadsword'));
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);

    const damage = damageControl();
    expect(damage, 'the declaration never reached the roll that resolved').toBeDefined();
    expect(damage!.textContent).toContain('2d8');
  });

  it('offers [Proficiency]d4 for a roll made with the fists', () => {
    withTypedDice();
    click(weaponRow('Unarmed'));
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);

    const damage = damageControl();
    expect(damage, 'an unarmed attack offered no damage roll').toBeDefined();
    expect(damage!.textContent).toContain('2d4');
  });

  it('offers nothing for a roll made with nothing declared', () => {
    // A persuasion check is a Duality Roll too. It carries no source, and a
    // damage offer standing under it would be the sheet inventing an attack.
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);
    expect(damageControl()).toBeUndefined();
  });

  it('offers nothing for a weapon the character is no longer holding', () => {
    // The founding rule at its narrowest: the log line this used to write was
    // `Battleaxe 2d10+3 · 9 + 4 +3 = 16` for a character with empty hands.
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    rebuild({ activePrimaryWeapon: null, activeSecondaryWeapon: null });
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);

    expect(
      damageControl(),
      'the sheet offered damage for a weapon it had already said was not equipped',
    ).toBeUndefined();
    expect(useApp.getState().log.some((e) => e.kind === 'damage')).toBe(false);
  });

  it('rolls it, and puts the total where a phone can read it', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);
    // Held, rather than looked up again after the tap: the control renames
    // itself once it has rolled, and a search for the word "damage" now also
    // finds the Spellcast chips, which name the damage they would cast for.
    const control = damageControl()!;
    click(control);

    const entry = useApp.getState().log.find((e) => e.kind === 'damage');
    expect(entry, 'no damage was written to the log').toBeDefined();
    expect(entry!.label, 'the log claims a hit the GM never gave').toMatch(/^IF IT HIT/);
    // There is no log surface on a phone, so the number has to be on the
    // control itself.
    expect(control.textContent).toContain(String(entry!.total));
  });

  it('takes the damage dice by hand, for a table that rolls them on the table', () => {
    /*
     * The whole path, through the real screen: arm the axe, type the two
     * Duality faces, then type the two damage faces the same way. Typing was
     * half-built before this - the Duality dice took a typed value and the
     * damage dice had nowhere to put one - so a table with real dice resolved
     * the attack in the app and did the damage in their heads.
     */
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 6);
    typeFace('FEAR', 3);
    expect(damageSlots(), 'the axe rolls 2d10+3 and drew no slots for it').toHaveLength(2);
    // Held before the dice land, because the control renames itself the moment
    // it has a total to announce.
    const control = damageControl()!;

    typeDamageFace(0, 7);
    expect(useApp.getState().log.some((e) => e.kind === 'damage')).toBe(false);
    typeDamageFace(1, 9);

    const entry = useApp.getState().log.find((e) => e.kind === 'damage');
    expect(entry, 'the typed dice never reached a damage roll').toBeDefined();
    // 7 + 9 + 3 on a 2d10+3 pool, and the engine did the addition.
    expect(entry!.total).toBe(19);
    expect(entry!.detail).toContain('7 + 9 +3 = 19');
    expect(control.textContent).toContain('19');
  });

  /*
   * The roll surface, measured again after a roll.
   *
   * Every sweep in this file runs before any roll has happened, so none of them
   * has ever seen the damage row. The Duality bar cannot be found by text here:
   * once a roll resolves its label becomes OUTCOME_LABEL - "Critical Success",
   * "Rolled with Hope" - and not one of those contains the substring ROLL. It
   * is found structurally instead, as the one control on this surface that
   * fixes its own height rather than declaring a floor.
   */
  it('lands the damage row under ROLL, inside the one column', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);
    const damage = damageControl();
    expect(damage, 'this test is not measuring a surface with a damage row on it').toBeDefined();

    /*
     * Replaces `still costs the pinned block exactly two regions, with typing
     * on`, which asserted the root had two children and the pinned one had two
     * of its own. The claim it was making is the one below: the damage row is
     * not a third pinned region, it is drawn inside the scrolling column, after
     * ROLL - everything above ROLL is declared before the dice and this is the
     * only thing here that comes after them.
     */
    const rootEl = container.firstElementChild as HTMLElement;
    expect(rootEl.contains(damage!), 'the damage row is outside the column').toBe(true);
    const roll = buttons().find((b) => b.style.height === '66px')!;
    expect(
      (roll.compareDocumentPosition(damage!) & 4) !== 0,
      'the damage row is above ROLL, where only declarations belong',
    ).toBe(true);
    // And it costs the fold index rather than ROLL: every fold is still below.
    for (const header of indexHeaders()) {
      expect(
        (damage!.compareDocumentPosition(header) & 4) !== 0,
        `${(header.textContent ?? '?').trim()} is above the damage row`,
      ).toBe(true);
    }
  });

  it('leaves every target on the roll surface at the floor after a roll', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);

    const targets = [...rollSurface().querySelectorAll('button')];
    for (const t of targets) {
      const declared = t.style.height !== '' ? t.style.height : t.style.minHeight;
      const value =
        declared === 'var(--tap)' || declared === 'var(--control)' ? 44 : Number.parseFloat(declared);
      expect(
        value,
        `${t.getAttribute('aria-label') ?? t.textContent ?? '?'} declares ${declared}`,
      ).toBeGreaterThanOrEqual(44);
    }

    /*
     * Scoped to the roll surface, and that is a correction rather than a
     * narrowing. `Counter.tsx`'s stepper declares `height: 44` and there are
     * eight of them on the sheet, so this assertion has never been true of the
     * whole screen - it passed because the pinned block did not contain the
     * counters. What it is really about is that nothing on the roll surface
     * fixes its height except ROLL, and that is what it now says.
     */
    const fixed = targets.filter((b) => b.style.height !== '');
    expect(
      fixed.map((b) => b.style.height),
      'the roll bar is no longer the one control on this surface that fixes its own height',
    ).toEqual(['66px']);
  });
});

/**
 * P5-1(b), reversed on this screen by the reflow's decision 1.
 *
 * The rename was on the sheet from P5-1(b) until now: a 72x44 chip at the right
 * end of the class row, with the name line beside it deliberately not a target.
 * Decision 1 deletes the chip. Both halves of that are asserted here, because
 * both can regress and they regress in opposite directions - the chip coming
 * back is 72px plus an 8px gutter of a row the budget above has been re-costed
 * without it, and the *name* becoming a target is the failure the backlog
 * bullet names as worse than no rename at all: "a name at the top of a
 * scrolling screen that opens a keyboard when a thumb brushes it".
 *
 * WHAT REPLACED THE TESTS THAT WERE HERE. They covered the chip, the field it
 * opened, the refusal row, the `autoFocus` that put a cursor in it, and the
 * reset that stopped an armed editor riding the header's character picker onto
 * another sheet. Every one of those described a control that no longer exists
 * on any layout. The control itself is unchanged and is still covered end to
 * end by `rename.test.tsx`, which mounts `RenameField` directly and drives
 * Build's door: nothing about the naming rule lost coverage here, only the door
 * did.
 */
describe('the rename that is not on this sheet', () => {
  const chip = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Rename '));

  const nameField = (): HTMLInputElement | null =>
    container.querySelector<HTMLInputElement>('input[aria-label="Character name"]');

  it('draws no rename control, on the phone or in the cockpit', () => {
    play(seed());
    expect(
      chip(),
      'the RENAME chip is back on the phone sheet. It costs the class row 72px plus an 8px ' +
        'gutter, which the identity block above is no longer costed with',
    ).toBeUndefined();

    setViewport(1280);
    play(seed());
    expect(
      chip(),
      'the RENAME chip is back in the desktop cockpit. There is one Identity component, so ' +
        'this is the same deletion and not a second one',
    ).toBeUndefined();
  });

  it('leaves the name a readout that cannot open a keyboard', () => {
    play(seed());
    const name = container.querySelector('.t-vital')!;
    expect(name.tagName).toBe('DIV');
    expect(name.closest('button'), 'the name line is inside a button').toBeNull();
    expect(name.getAttribute('role')).toBeNull();
    expect(name.getAttribute('tabindex')).toBeNull();
    /*
     * And there is no way to reach the field from this screen at all - not
     * before a tap, which was already true, and not after every one of them.
     * Scoped to the rename field by its own accessible name: a bare `input`
     * query is non-null on this screen either way, because the
     * incoming-damage box is one.
     */
    expect(nameField(), 'a rename field is on the sheet').toBeNull();
    for (const b of buttons()) click(b);
    expect(nameField(), 'something on the sheet opens a rename field').toBeNull();
  });
});

/**
 * The verbs, which are the whole reason the six tiles were 210px tall.
 *
 * Decision 3 moves them behind a control on the trait row rather than deleting
 * them: they are what tells a new player which of the six a thing is, and P5-1
 * read them out of the SRD on purpose. So both of these assert both directions
 * - the 150px this change buys, and the fact that it buys it from the eye and
 * not from the ear.
 */
describe('the verbs under the traits', () => {
  const VERBS = [
    'SPRINT · LEAP · MANEUVER',
    'LIFT · SMASH · GRAPPLE',
    'CONTROL · HIDE · TINKER',
    'PERCEIVE · SENSE · NAVIGATE',
    'CHARM · PERFORM · DECEIVE',
    'RECALL · ANALYZE · COMPREHEND',
  ];

  const verbsControl = (): HTMLButtonElement => {
    const found = buttons().find(
      (b) => b.getAttribute('aria-label') === 'What each trait is for',
    );
    if (found === undefined) throw new Error('the trait row has no verbs control');
    return found;
  };

  /*
   * Replaces `prints all six sets, in the words the SRD uses`, which asserted
   * only that they were on the screen - true when each of six tiles was 92px
   * tall.
   */
  it('are behind the trait row’s own control, and all six are still there', () => {
    play(seed());
    expect(verbsControl().getAttribute('aria-expanded')).toBe('false');
    for (const verbs of VERBS) {
      expect(text(), `"${verbs}" is on the shut sheet, so the 150px was not saved`).not.toContain(
        verbs,
      );
    }

    click(verbsControl());
    expect(verbsControl().getAttribute('aria-expanded')).toBe('true');
    const body = text();
    for (const verbs of VERBS) {
      expect(body, `the trait row does not print "${verbs}"`).toContain(verbs);
    }
  });

  it('remembers per character which way the verbs were left', () => {
    const first = seed();
    play(first);
    click(verbsControl());
    expect(useApp.getState().prefs.playSections[`${first.id}:traitverbs`]).toBe(true);

    const second = seed({ id: 'other-sheet' });
    useApp.setState({
      prefs: { ...useApp.getState().prefs },
      characters: [second],
      activeId: second.id,
    });
    act(() => root.unmount());
    root = createRoot(container);
    play(second);
    expect(
      verbsControl().getAttribute('aria-expanded'),
      'one character’s verbs were opened on another character’s sheet',
    ).toBe('false');
  });

  /*
   * Replaces `puts them in the tile's accessible name too`, and is the stronger
   * claim: all six rather than one, and with the control SHUT. A listening user
   * loses nothing at all from this change and gains the same 150px.
   */
  it('stay in every chip’s accessible name with the control shut', () => {
    play(seed());
    expect(verbsControl().getAttribute('aria-expanded')).toBe('false');
    const named = buttons()
      .map((b) => b.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes('use it to '));
    expect(named, 'the six trait chips do not announce what they are for').toHaveLength(6);
    for (const [i, phrase] of [
      'Agility +1 - use it to Sprint, Leap, Maneuver',
      'Strength +2 - use it to Lift, Smash, Grapple',
      'Finesse +0 - use it to Control, Hide, Tinker',
      'Instinct +1 - use it to Perceive, Sense, Navigate',
      'Presence +0 - use it to Charm, Perform, Deceive',
      'Knowledge −1 - use it to Recall, Analyze, Comprehend',
    ].entries()) {
      expect(named[i], `chip ${String(i)} announces "${named[i] ?? ''}"`).toBe(phrase);
    }
  });
});

/**
 * The column may not carry a paint effect, because it hosts four modals.
 *
 * `PlayPhone`'s root carried `.scroll-fade` - `mask-image` - and that one class
 * made every dialog opened from this screen unusable on every phone. A mask is
 * an effect node applied to the element's whole *painted subtree*, and its
 * painting area is confined by the initial `mask-clip: border-box`. A
 * `position: fixed` descendant escapes for layout and is still clipped for
 * paint and hit-testing, so the dialogs measured their full 852 at 393x852 and
 * had everything outside the column's box, y 53-791, given mask alpha 0: CLOSE
 * drew 9-10px of its 44 and its centre tapped the PLAY tab, CLEAR ALL tapped
 * GM, and two 10px titles drew 0 of 10.
 *
 * These assertions are about DOM ancestry and stylesheet text, not geometry.
 * jsdom computes no layout and can no more see a mask clip than it can see the
 * 738-of-852 that states the defect; that half stays with the Chrome harness.
 * What they can do is stop the class coming back, and stop the next one - the
 * set below is every property that creates an effect node or a containing
 * block, not just the one that bit.
 */
describe('nothing above an open dialog may clip it', () => {
  /** Every property whose presence on an ancestor breaks a fixed descendant. */
  const EFFECTS = [
    'mask-image',
    '-webkit-mask-image',
    'mask',
    'filter',
    'backdrop-filter',
    '-webkit-backdrop-filter',
    'transform',
    'perspective',
    'will-change',
    'contain',
  ];

  /**
   * The class names `src/ui/*.css` declares one of those on, read off the
   * stylesheets rather than listed here, so a rule added tomorrow is covered
   * without anybody remembering to add it. jsdom applies no stylesheet, which
   * is exactly why the class has to be matched by name.
   */
  const effectClasses = (): string[] => {
    const found = new Set<string>();
    for (const file of readdirSync('src/ui').filter((f) => f.endsWith('.css'))) {
      const css = readFileSync(join('src/ui', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const declares = EFFECTS.some((p) =>
          new RegExp(`(^|[;\\s])${p}\\s*:`).test(body ?? ''),
        );
        if (!declares) continue;
        for (const [, cls] of (selector ?? '').matchAll(/\.([\w-]+)/g)) found.add(cls!);
      }
    }
    return [...found];
  };

  /** Walk from an element to the test container, collecting anything that clips. */
  const clippers = (from: HTMLElement): string[] => {
    const classes = effectClasses();
    const out: string[] = [];
    for (let el = from.parentElement; el !== null && el !== container; el = el.parentElement) {
      const inline = EFFECTS.filter((p) => el!.style.getPropertyValue(p) !== '');
      const byClass = [...el.classList].filter((c) => classes.includes(c));
      if (inline.length > 0 || byClass.length > 0) {
        out.push(`${el.tagName}.${el.className} [${[...inline, ...byClass].join(' ')}]`);
      }
    }
    return out;
  };

  it('leaves the conditions dialog its whole box', () => {
    setViewport(393);
    play(seed());

    const door = buttons().find(
      (b) => (b.getAttribute('aria-label') ?? '') === 'Conditions: none',
    );
    expect(door, 'no door into the conditions dialog').toBeDefined();
    act(() => door!.click());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog, 'the door did not open a dialog').not.toBeNull();

    const found = clippers(dialog as HTMLElement);
    expect(
      found,
      `an ancestor clips the dialog's paint and hit-testing: ${found.join(', ')}`,
    ).toEqual([]);
  });

  /*
   * The second lock, and the cheap one. The walk above is the statement; this
   * is what fails loudly if the walk is ever refactored into something that
   * cannot reach the column. Source-text assertions have precedent in
   * `domainCardView.test.ts`.
   */
  it('does not put a fade back on the column', () => {
    const src = readFileSync('src/ui/player/Play.tsx', 'utf8');
    // The class in a `className`, not the word in the prose: the docblock
    // above that element names `scroll-fade` on purpose, to say why it may
    // never come back, and a test that forbade the word would delete the
    // explanation along with the bug.
    const applied = [...src.matchAll(/className="([^"]*)"/g)].map((m) => m[1] ?? '');
    expect(
      applied.filter((c) => c.split(/\s+/).includes('scroll-fade')),
      'Play.tsx applies `scroll-fade` again - it masks the four dialogs mounted in that column',
    ).toEqual([]);
  });

  /*
   * And the class itself stays defined, because `DomainCardView` still applies
   * it - conditionally, to card text, where nothing is fixed and where the
   * "disappears once you reach the end" it was written for is actually true.
   */
  it('keeps the fade for the one region that has no modal in it', () => {
    expect(readFileSync('src/ui/base.css', 'utf8')).toContain('.scroll-fade');
    expect(readFileSync('src/ui/shared/DomainCardView.tsx', 'utf8')).toContain('scroll-fade');
  });
});
