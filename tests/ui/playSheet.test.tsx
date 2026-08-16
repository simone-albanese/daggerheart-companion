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
import type { Character } from '@shared/types.ts';
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

  it('shows the gold, which was on the printout and on no screen', () => {
    play(seed());
    expect(text()).toContain('1 BAG · 4 HANDFULS');
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

  it('runs top to bottom in the order of the printed sheet', () => {
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
      'EVASION', // the defence band
      'SPRINT', // the traits, with their verbs
      'HP', // the counters
      'Weapons & armour',
      'Loadout',
      'Carried',
      'Gold',
      'Lineage & domains',
    ].map(at);
    expect(
      order,
      `sections are out of order: ${JSON.stringify(order)}`,
    ).toEqual([...order].sort((a, b) => a - b));
  });

  it('keeps only the roll block out of the scroll', () => {
    play(seed());
    // The scrolling region and the pinned block are the phone root's two
    // children. What is pinned is what a thumb must never have to hunt for.
    const rootEl = container.firstElementChild!;
    expect(rootEl.children).toHaveLength(2);
    const pinned = rootEl.children[1]!;
    expect(pinned.textContent ?? '').toContain('ROLL');
    expect(pinned.textContent ?? '').toContain('AGI');
    // and what is not: everything that is a section of the sheet.
    for (const section of ['EVASION', 'Loadout', 'Gold', 'HP']) {
      expect(
        pinned.textContent ?? '',
        `${section} is pinned, and only the roll block should be`,
      ).not.toContain(section);
    }
  });
});

/**
 * What the pinned block costs.
 *
 * jsdom has no layout engine, so this does not measure pixels - it pins every
 * number the arithmetic in the commit message is built out of, which is the
 * part that rots. The sum is: the trait chip row at the touch floor, a 6px
 * gap, and the roll block, which is the control row at the floor, the
 * Experience rows at the floor, and a 66px ROLL bar with 6px between each.
 *
 * 44 + 6 + (44 + 6 + rows*44 + (rows-1)*6 + 6 + 66)
 *
 * which is 266px with two Experiences on one row each, and 316px with five at
 * two across. Against 731px of usable column at 393x852 and 546px at 375x667,
 * that leaves scroll windows of 457/407 and 272/222 - where the previous pass
 * measured 288 and 188 at 393x852 and 88 at 375x667 with the page itself
 * scrolling by 85.
 */
describe('the pinned block', () => {
  const floor = (el: Element): string => (el as HTMLElement).style.minHeight;

  it('is the trait chips and the roll, and nothing else', () => {
    play(seed());
    const pinned = container.firstElementChild!.children[1]!;
    // Two regions: the chip row and the roll block. The death move adds a
    // third only when the character has fallen, which is the one time it is
    // the most important thing on the screen.
    expect(pinned.children).toHaveLength(2);
    expect((pinned as HTMLElement).style.gap).toBe('6px');
  });

  it('holds every one of its targets at the touch floor', () => {
    play(seed());
    const pinned = container.firstElementChild!.children[1]!;
    const targets = [...pinned.querySelectorAll('button')];
    expect(targets.length).toBeGreaterThan(6);
    for (const t of targets) {
      const declared = t.style.height !== '' ? t.style.height : floor(t);
      const value = declared === 'var(--tap)' || declared === 'var(--control)'
        ? 44
        : Number.parseFloat(declared);
      expect(
        value,
        `${t.getAttribute('aria-label') ?? t.textContent ?? '?'} declares ${declared}`,
      ).toBeGreaterThanOrEqual(44);
    }
  });

  it('gives ROLL the 66px it had, at the bottom of the block', () => {
    play(seed());
    const pinned = container.firstElementChild!.children[1]!;
    const rollBar = [...pinned.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('ROLL'),
    );
    expect(rollBar, 'no ROLL bar in the pinned block').toBeDefined();
    expect(rollBar!.style.height).toBe('66px');
  });

  it('never lets the scrolling region be crushed below two rows', () => {
    play(seed());
    const scroll = container.firstElementChild!.children[0] as HTMLElement;
    expect(scroll.style.minHeight).toBe('88px');
    expect((container.firstElementChild as HTMLElement).style.overflowY).toBe('auto');
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

  it('is on the phone at all, one fold away', () => {
    const c = seed();
    play(c);
    expect(fold('Vault').textContent).toContain('3 INACTIVE');
    click(fold('Vault'));
    const names = c.vault.map((ref) => index.cards.get(ref)!.name);
    for (const name of names) {
      expect(text(), `${name} is not in the phone's vault`).toContain(name);
    }
  });

  it('offers a recall that names its price, and pays it', () => {
    const c = seed();
    play(c);
    click(fold('Vault'));
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

  it('says why on the screen when it will not recall, not in a title', () => {
    const c = fullLoadout();
    play(c);
    click(fold('Vault'));
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
    click(fold('Vault'));
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
    click(fold('Vault'));
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
    click(fold('Vault'));
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
    click(fold('Vault'));
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

  it('remembers what was open, per character, across a remount', () => {
    const c = seed();
    play(c);
    click(fold('Loadout'));
    expect(fold('Loadout').getAttribute('aria-expanded')).toBe('false');

    act(() => root.unmount());
    root = createRoot(container);
    play(c);
    expect(
      fold('Loadout').getAttribute('aria-expanded'),
      'the fold reopened itself on the next launch',
    ).toBe('false');
  });

  it('does not carry one character’s arrangement onto another', () => {
    const first = seed();
    play(first);
    click(fold('Loadout'));
    expect(useApp.getState().prefs.playSections[`${first.id}:loadout`]).toBe(false);

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
    expect(fold('Loadout').getAttribute('aria-expanded')).toBe('true');
  });

  it('gives the header the whole width and the touch floor', () => {
    play(seed());
    for (const b of buttons().filter((x) => x.getAttribute('aria-expanded') !== null)) {
      expect(b.style.minHeight, `${b.textContent ?? '?'} is not at the touch floor`).toBe(
        'var(--tap)',
      );
      expect(b.style.width).toBe('100%');
    }
  });
});

describe('the verbs under the traits', () => {
  it('prints all six sets, in the words the SRD uses', () => {
    play(seed());
    const body = text();
    for (const verbs of [
      'SPRINT · LEAP · MANEUVER',
      'LIFT · SMASH · GRAPPLE',
      'CONTROL · HIDE · TINKER',
      'PERCEIVE · SENSE · NAVIGATE',
      'CHARM · PERFORM · DECEIVE',
      'RECALL · ANALYZE · COMPREHEND',
    ]) {
      expect(body, `the trait tiles do not print "${verbs}"`).toContain(verbs);
    }
  });

  it('puts them in the tile’s accessible name too', () => {
    play(seed());
    const tile = [...container.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Agility'),
    );
    expect(tile, 'no trait tile announces itself as Agility').toBeDefined();
    expect(tile!.getAttribute('aria-label')).toContain('use it to Sprint, Leap, Maneuver');
  });
});
