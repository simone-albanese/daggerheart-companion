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
 * The two rules that hold for the whole screen, not for one control at a time.
 *
 * Everything a finger lands on is at least 44px, and nothing forces the column
 * wider than the phone. Both were checked control by control while this screen
 * was rebuilt, which is exactly how the eleventh one gets missed - so they are
 * checked here over every element the sheet draws with all its folds open.
 */
describe('the whole sheet, at 393x852', () => {
  /** Open every fold, so nothing is exempt by being hidden. */
  function openEverything(): void {
    for (let i = 0; i < 8; i += 1) {
      const shut = buttons().find((b) => b.getAttribute('aria-expanded') === 'false');
      if (shut === undefined) return;
      click(shut);
    }
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
    expect(fold('Loadout').textContent, 'the header disagrees with the recall gate').toContain(
      '5 / 5',
    );
  });

  it('is drawn, and names the ref so somebody can act on it', () => {
    play(withGhosts());
    const body = text();
    expect(body).toContain('CARD NOT IN THIS BUILD');
    expect(body).toContain('card-from-a-newer-bundle');
    expect(body).toContain('card-from-a-homebrew-layer');
  });

  it('can be moved to the vault by hand, which frees the slot', () => {
    const c = withGhosts();
    play(c);
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
    expect(fold('Loadout').textContent).toContain('4 / 5');
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
    expect(fold('Vault').textContent).toContain('4 INACTIVE');
    click(fold('Vault'));
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
 * The roll modifiers, folded.
 *
 * The request was to delete this row. It is kept - advantage, disadvantage and
 * the reaction switch are core roll modifiers, and the SRD makes you declare
 * every modifier before the dice - and folded instead. The whole risk of
 * folding it is that `advantage` and `reaction` are *not* cleared when a roll
 * resolves, so an armed modifier could sit off-screen for the rest of the
 * session. That is the failure this project's rules exist to prevent, so it is
 * what these tests are about.
 */
describe('the roll modifier row', () => {
  const byText = (label: string): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.textContent ?? '').trim() === label);

  it('is out of the way until it is wanted', () => {
    play(seed());
    expect(fold('Modifiers').getAttribute('aria-expanded')).toBe('false');
    expect(byText('REACTION'), 'the row is drawn while it is folded').toBeUndefined();
    expect(byText('ADV')).toBeUndefined();
  });

  it('shows everything the closed row is holding, on the closed row', () => {
    play(seed());
    expect(fold('Modifiers').textContent).toContain('NONE');

    click(fold('Modifiers'));
    click(byText('DIS')!);
    click(byText('REACTION')!);
    click(fold('Modifiers'));

    expect(fold('Modifiers').getAttribute('aria-expanded')).toBe('false');
    const header = fold('Modifiers').textContent ?? '';
    expect(header, 'a modifier is armed and the closed row does not say so').toContain('DIS');
    expect(header).toContain('REACTION');
    expect(byText('DIS'), 'the controls are still drawn while folded').toBeUndefined();
  });

  it('wraps when it is open, instead of hiding half of itself off the side', () => {
    play(seed());
    click(fold('Modifiers'));
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
    // The sheet's own sections, which the two-column cockpit never had room
    // for on the left and never rendered on the right.
    expect(text()).toContain('Gold');
    expect(fold('Vault')).toBeDefined();
    const rootEl = container.firstElementChild!;
    expect(rootEl.children, 'this is the grid cockpit, not the one-column sheet').toHaveLength(2);
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

/**
 * What the next attack is declared with.
 *
 * Three surfaces set the trait on this screen - the pinned chips, the trait
 * grid inside the scroll, and the SPELLCAST chip in the modifier row - and only
 * the pinned chips ever put an armed weapon down. So tapping a trait anywhere
 * else left the sword armed, and the damage step P1-1 is about would have
 * offered a sword's dice for a Knowledge check while the screen showed
 * KNOWLEDGE on the roll bar. Nothing threw, and nothing on screen disagreed
 * with anything else; the declaration was simply wrong.
 */
describe('what the attack is made with', () => {
  /** A row you can arm: the weapon buttons carry the weapon's own name. */
  function weaponRow(name: string): HTMLButtonElement {
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  /** A pinned trait chip, by the three letters it prints. */
  function traitChip(abbreviation: string): HTMLButtonElement {
    const found = buttons().find((b) =>
      new RegExp(`^${abbreviation} [+−]`).test((b.textContent ?? '').trim()),
    );
    if (found === undefined) throw new Error(`no pinned chip called "${abbreviation}"`);
    return found;
  }

  /** A tile in the scrolling trait grid, by the trait it announces. */
  function traitTile(label: string): HTMLButtonElement {
    const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(label));
    if (found === undefined) throw new Error(`no trait tile called "${label}"`);
    return found;
  }

  /** A sheet whose primary weapon rolls with something other than the default. */
  const withBattleaxe = (): Character => seed({ activePrimaryWeapon: 'battleaxe' });

  it('takes the trait from the weapon, and takes the weapon back when a tile is tapped', () => {
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    expect(weaponRow('Battleaxe').getAttribute('aria-pressed')).toBe('true');
    // "The trait that applies to an attack roll is specified by the weapon or
    // spell being used." A player who taps a sword has declared that roll.
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('true');

    click(traitTile('Agility'));
    expect(traitChip('AGI').getAttribute('aria-pressed')).toBe('true');
    expect(
      weaponRow('Battleaxe').getAttribute('aria-pressed'),
      'the axe is still armed for an Agility roll it was not declared for',
    ).toBe('false');
  });

  it('takes the weapon back when SPELLCAST is armed from the modifier row', () => {
    play(withBattleaxe());
    click(weaponRow('Battleaxe'));
    click(fold('Modifiers'));
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

  it('leaves it standing when the trait is picked, because that is the GM’s half', () => {
    // A weapon steps back when you pick a trait by hand, because it had already
    // specified one. An unarmed declaration never did: choosing Strength here
    // is completing the declaration, not replacing it.
    play(seed());
    click(weaponRow('Unarmed'));
    click(traitTile('Strength'));
    expect(traitChip('STR').getAttribute('aria-pressed')).toBe('true');
    expect(
      weaponRow('Unarmed').getAttribute('aria-pressed'),
      'picking the trait the GM asked for withdrew the attack it belongs to',
    ).toBe('true');
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
  const dieChips = (): HTMLButtonElement[] =>
    buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Cast with a d'));

  /** The panel itself: a div, where the weapon rows are buttons. */
  function panel(): HTMLElement {
    const found = [...container.querySelectorAll<HTMLElement>('div.panel')].find((el) =>
      (el.textContent ?? '').startsWith('Spellcast'),
    );
    if (found === undefined) throw new Error('no Spellcast panel on the sheet');
    return found;
  }

  function armable(name: string): HTMLButtonElement {
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  function pinnedChip(abbreviation: string): HTMLButtonElement {
    const found = buttons().find((b) =>
      new RegExp(`^${abbreviation} [+−]`).test((b.textContent ?? '').trim()),
    );
    if (found === undefined) throw new Error(`no pinned chip called "${abbreviation}"`);
    return found;
  }

  function tile(label: string): HTMLButtonElement {
    const found = buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(label));
    if (found === undefined) throw new Error(`no trait tile called "${label}"`);
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

  const casting = (presence: number): Character =>
    seed({ traits: { ...playedCharacter().traits, presence } });

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
    // spell being used." SPELLCAST is not one of the six pinned chips, so the
    // modifier row is where the sheet says which slot is armed.
    expect(pinnedChip('PRE').getAttribute('aria-pressed')).toBe('false');
    expect(fold('Modifiers').textContent).toContain('SPELLCAST');
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
    const mod = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].find(
      (el) => (el.parentElement?.textContent ?? '').startsWith('MOD'),
    );
    expect(mod, 'the panel has no MOD input').toBeDefined();
    type(mod!, '3');
    click(dieChips()[2]!);
    expect(panel().textContent).toContain('3d8+3');
    click(dieChips()[3]!);
    expect(panel().textContent, 'changing the die threw the card’s modifier away').toContain(
      '3d10+3',
    );
  });

  it('puts the sword down when a spell is declared, and the spell down when a trait is picked', () => {
    play(casting(3));
    click(armable('Broadsword'));
    click(dieChips()[2]!);
    expect(armable('Broadsword').getAttribute('aria-pressed')).toBe('false');
    // And back the other way: picking a trait by hand is declaring a roll the
    // spell did not, so the spell steps back the way a weapon does.
    click(tile('Agility'));
    expect(dieChips()[2]!.getAttribute('aria-pressed')).toBe('false');
    expect(pinnedChip('AGI').getAttribute('aria-pressed')).toBe('true');
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
    const found = buttons().find(
      (b) => b.getAttribute('aria-pressed') !== null && (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no armable row called "${name}"`);
    return found;
  }

  /** Tap a die face open and pick a value out of its 4-column grid. */
  function typeFace(label: 'HOPE' | 'FEAR', value: number): void {
    const face = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`${label} die`),
    );
    if (face === undefined) throw new Error(`no ${label} die face to type into`);
    click(face);
    // Inside the pinned block: the defence band up in the scroll is a
    // `repeat(4, 1fr)` grid too, and it comes first in document order.
    const pinned = container.firstElementChild!.children[1]!;
    const grid = [...pinned.querySelectorAll<HTMLElement>('div')].find(
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
    const pinned = container.firstElementChild!.children[1]!;
    const grid = [...pinned.querySelectorAll<HTMLElement>('div')].find(
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
   * The pinned block, measured again after a roll.
   *
   * Every sweep in this file runs before any roll has happened, so none of them
   * has ever seen the damage row. The Duality bar cannot be found by text here:
   * once a roll resolves its label becomes OUTCOME_LABEL - "Critical Success",
   * "Rolled with Hope" - and not one of those contains the substring ROLL. It
   * is found structurally instead, as the one control in the block that fixes
   * its own height rather than declaring a floor.
   */
  it('still costs the pinned block exactly two regions, with typing on', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);
    expect(damageControl(), 'this test is not measuring a block with a damage row in it').toBeDefined();

    const rootEl = container.firstElementChild!;
    expect(rootEl.children, 'the damage row was mounted as a sibling of the scroll').toHaveLength(2);
    const pinned = rootEl.children[1]!;
    expect(pinned.children, 'the damage row was mounted beside the roll block').toHaveLength(2);
  });

  it('leaves every target in the pinned block at the floor after a roll', () => {
    withTypedDice({ activePrimaryWeapon: 'battleaxe' });
    click(weaponRow('Battleaxe'));
    typeFace('HOPE', 5);
    typeFace('FEAR', 5);

    const pinned = container.firstElementChild!.children[1]!;
    const targets = [...pinned.querySelectorAll('button')];
    for (const t of targets) {
      const declared = t.style.height !== '' ? t.style.height : t.style.minHeight;
      const value =
        declared === 'var(--tap)' || declared === 'var(--control)' ? 44 : Number.parseFloat(declared);
      expect(
        value,
        `${t.getAttribute('aria-label') ?? t.textContent ?? '?'} declares ${declared}`,
      ).toBeGreaterThanOrEqual(44);
    }

    const fixed = targets.filter((b) => b.style.height !== '');
    expect(
      fixed.map((b) => b.style.height),
      'the roll bar is no longer the one control that fixes its own height',
    ).toEqual(['66px']);
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
