// @vitest-environment jsdom
/**
 * The features on the Play screen, and the derivation beside the numbers.
 *
 * WHAT WAS ABSENT. Not one word of class, subclass, ancestry or community
 * feature text was reachable from Play. `Identity` and `Lineage` printed names;
 * `Equipped` printed a weapon's dice and its range and deliberately not its
 * `feature`, so a Gambeson's *Flexible: +1 to Evasion* appeared nowhere on the
 * one screen that draws the Evasion it changes. After character creation the
 * only way to reread your own Hope feature was to print the sheet. The owner
 * asked for it directly: «La pagina di play deve avere tutte le caratteristiche
 * di origine e classe. Abilità, abilità che usano hope ecc.»
 *
 * These tests are about PRESENCE, like `playSheet.test.tsx` and for the same
 * reason: what went wrong was absence, and absence is the one defect a
 * screenshot review never catches because there is nothing on screen to look
 * wrong.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Play } from '../../src/ui/player/Play.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { characterFeatures } from '../../src/engine/features.ts';
import { deriveStats } from '../../src/engine/character.ts';
import type { Character } from '@shared/types.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

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
  render(createElement(Play, { stats: deriveStats(c, dataset, index) }));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

function fold(label: string): HTMLButtonElement {
  const found = buttons().find(
    (b) => b.getAttribute('aria-expanded') !== null && (b.textContent ?? '').startsWith(label),
  );
  if (found === undefined) {
    throw new Error(
      `no fold called "${label}". Folds here: ${buttons()
        .filter((b) => b.getAttribute('aria-expanded') !== null)
        .map((b) => (b.textContent ?? '').slice(0, 40))
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

// ---------------------------------------------------------------------------

describe('the features a character actually holds', () => {
  it('puts every one of them on the phone, behind the fold that names them', () => {
    const c = seed();
    play(c);
    const held = characterFeatures(c, index);
    expect(
      held.features.length,
      'the fixture stopped holding features, so this test proves nothing',
    ).toBeGreaterThan(2);

    // Shut, the fold advertises the count rather than the contents.
    const header = fold('Lineage, domains & features');
    expect(header.textContent ?? '').toContain(
      `${String(held.features.length + (held.hopeFeature === null ? 0 : 1))} FEATURES`,
    );

    click(header);
    const screen = text();
    const missing = held.features.filter((f) => !screen.includes(f.name) || !screen.includes(f.text));
    expect(
      missing.map((f) => `${f.source} · ${f.name}`),
      'these features are on the sheet and not on the screen. Before this section existed ' +
        'EVERY one of them was missing, and the only way to read them was to print the sheet:' +
        `\n  ${missing.map((f) => `${f.source} · ${f.name}`).join('\n  ')}`,
    ).toEqual([]);
  });

  it('leads with the class Hope feature, which the printed sheet files elsewhere', () => {
    const c = seed();
    play(c);
    click(fold('Lineage, domains & features'));
    const held = characterFeatures(c, index);
    expect(held.hopeFeature, 'the fixture has no class to take a Hope feature from').not.toBeNull();
    const screen = text();
    expect(screen).toContain(held.hopeFeature!.name);
    expect(screen).toContain(held.hopeFeature!.text);
    // First of the list: `characterFeatures` hands it over separately because
    // the paper sheet prints it beside the Hope track, and a screen has no Hope
    // track next to this list.
    const first = held.features[0]!;
    expect(
      screen.indexOf(held.hopeFeature!.name),
      'the Hope feature is not at the head of the list',
    ).toBeLessThan(screen.indexOf(first.name));
  });

  it('draws the cockpit list open, where the column scrolls', () => {
    setViewport(1280);
    const c = seed();
    play(c);
    // No fold to open: the cockpit's first column scrolls and already carries
    // `Rest`, which this repo measures at about 990px open.
    const held = characterFeatures(c, index);
    const screen = text();
    for (const f of held.features) expect(screen, `${f.source} · ${f.name}`).toContain(f.name);
    expect(screen).toContain(held.hopeFeature!.name);
  });

  it('says nothing rather than something wrong when the sheet has no class', () => {
    const c = seed({ classRef: '', subclassRefs: [], ancestryRefs: [], communityRef: null });
    play(c);
    click(fold('Lineage, domains & features'));
    expect(text()).toContain('No features');
  });
});

describe('what a feature does to a number, beside the feature', () => {
  /*
   * THE CHIP IS THE CHECKABLE CLAIM. A Simiah's +1 reached nothing for as long
   * as it did because Evasion was a bare integer: there was nowhere on the
   * sheet saying what it was made of, so two missing terms looked exactly like
   * a correct answer. A feature that states its own contribution can be checked
   * against the band by eye.
   */
  it('marks a Simiah with the Evasion their ancestry gives them', () => {
    const c = seed({ ancestryRefs: ['simiah'] });
    play(c);
    click(fold('Lineage, domains & features'));
    expect(text()).toContain('Nimble');
    expect(text(), 'Nimble is drawn with no claim about the number it moves').toContain(
      '+1 EVASION',
    );
  });

  it('leaves a spend uncharted, because its number is not true at rest', () => {
    // Rogue's Dodge costs 3 Hope and lasts until an attack succeeds. It is on
    // the screen in full and carries no chip - see the admission rule in
    // `src/engine/modifiers.ts`.
    const c = seed({ classRef: 'rogue', subclassRefs: [], ancestryRefs: [], communityRef: null });
    play(c);
    click(fold('Lineage, domains & features'));
    const screen = text();
    expect(screen).toContain('Rogue’s Dodge');
    expect(screen).toContain('Spend 3 Hope to gain a +2 bonus to your Evasion');
    expect(screen, 'a spend was charted as if it were a standing bonus').not.toContain(
      '+2 EVASION',
    );
  });
});

describe('the gear that is actually equipped', () => {
  it('prints the weapon and armour features this row never drew', () => {
    const c = seed({
      activePrimaryWeapon: 'greatsword',
      activeSecondaryWeapon: 'tower-shield',
      activeArmor: 'gambeson-armor',
    });
    play(c);
    click(fold('Weapons & armour'));
    const screen = text();
    expect(screen, 'the Greatsword still says only its dice').toContain('Massive: -1 to Evasion');
    expect(screen).toContain('Barrier: +2 to Armor Score; -1 to Evasion');
    expect(screen, 'the armour row still says only its score and thresholds').toContain(
      'Flexible: +1 to Evasion',
    );
  });

  it('states what each piece is worth, from the same ledger the total came from', () => {
    const c = seed({
      activePrimaryWeapon: 'greatsword',
      activeSecondaryWeapon: 'tower-shield',
      activeArmor: 'gambeson-armor',
    });
    play(c);
    click(fold('Weapons & armour'));
    const screen = text();
    expect(screen).toContain('−1 EVASION');
    expect(screen).toContain('+2 ARMOR');
    expect(screen).toContain('+1 EVASION');
  });

  it('draws no chip for a feature that changes a roll rather than the sheet', () => {
    // Broadsword: "Reliable: +1 to attack rolls". A roll, not a sheet number.
    const c = seed({
      activePrimaryWeapon: 'broadsword',
      activeSecondaryWeapon: null,
      activeArmor: null,
    });
    play(c);
    click(fold('Weapons & armour'));
    const screen = text();
    expect(screen).toContain('Reliable: +1 to attack rolls');
    expect(screen, 'an attack-roll bonus was charted as a sheet number').not.toContain(
      '+1 EVASION',
    );
  });
});

describe('the derivation under the number', () => {
  /*
   * THE PHONE DOES NOT GET THIS LINE AND THAT IS A MEASUREMENT, NOT AN
   * OVERSIGHT. The phone's defence band is 4 + 10 + 4 + 32 + 4 + 2 = 56, and a
   * third line with its own gap makes it 70. `playSheet.test.tsx` holds the
   * whole folded sheet to 532 against 545 of column at 375x667 - thirteen
   * pixels - so fourteen more would take the small phone out of the fit the
   * reflow bought. jsdom measures nothing, so this assertion is what stands in
   * for the ruler.
   */
  it('is on the cockpit band and off the phone one', () => {
    const c = seed({ ancestryRefs: ['simiah'], activeArmor: 'gambeson-armor' });
    // The fixture's class is whichever the dataset lists first, so the base is
    // read off the engine rather than typed: a bard starts at 10 and a rogue at
    // 12, and a literal here would rot the day `tools/build-srd.ts` reorders.
    const stats = deriveStats(c, dataset, index);
    const base = stats.evasion - stats.modifiers.evasion.reduce((n, r) => n + r.amount, 0);
    const sum = `${String(base)}+1+1`;
    expect(stats.modifiers.evasion, 'the fixture stopped carrying two Evasion terms').toHaveLength(
      2,
    );

    setViewport(1280);
    play(c);
    expect(
      text(),
      'the cockpit stopped showing what Evasion is a sum of, which is the one place ' +
        'a player can check the total by looking',
    ).toContain(sum);

    setViewport(393);
    play(c);
    expect(
      text(),
      'the phone grew a third line in the defence band. It is 56px and measured; the ' +
        'small phone has thirteen pixels of slack and this line costs fourteen.',
    ).not.toContain(sum);
  });

  it('says nothing when the number has only one term', () => {
    const c = seed({
      ancestryRefs: [],
      activeArmor: null,
      activeSecondaryWeapon: null,
      activePrimaryWeapon: null,
    });
    setViewport(1280);
    play(c);
    const stats = deriveStats(c, dataset, index);
    expect(stats.modifiers.evasion, 'this sheet still has an Evasion term on it').toEqual([]);
    /*
     * Asked of the CELL and not of the page: the screen is full of `d8+3` and
     * `2d6+1`, and a page-wide regex for a digit-plus-digit reads a damage
     * formula as a derivation. The band's Evasion cell is the only place this
     * line can be, so it is the only place worth asking.
     */
    // The innermost match: the band's wrapper also starts with EVASION, and
    // asking it would read MAJOR, SEVERE and PROF as part of the cell.
    const cell = [...container.querySelectorAll('div')]
      .filter((el) => (el.textContent ?? '').trim().startsWith('EVASION'))
      .sort((a, b) => (a.textContent ?? '').length - (b.textContent ?? '').length)[0];
    expect(cell, 'there is no EVASION cell on the screen at all').toBeDefined();
    expect(
      (cell!.textContent ?? '').trim(),
      'a base was printed under a total it is equal to, which is noise',
    ).toBe(`EVASION${String(stats.evasion)}`);
  });
});

/**
 * Which trait a Spellcast Roll uses, said where a player asks what their
 * character is.
 *
 * It is a property of the subclass - the SRD prints "SPELLCAST TRAIT" on every
 * subclass page - and the only place on Play that said so was the hint under
 * the trait grid, which is read while choosing a trait rather than while
 * reading the class line. Asked for directly: «inserisci per ogni classe la
 * spellcastTrait visibile nelle info sulla classe».
 */
describe('the Spellcast trait, in the class info', () => {
  const subclassWith = (want: boolean) => {
    const found = dataset.subclasses.find((s) => (s.spellcastTrait !== null) === want);
    if (found === undefined) throw new Error(`no subclass ${want ? 'with' : 'without'} a Spellcast trait`);
    return found;
  };

  const asSubclass = (sub: (typeof dataset.subclasses)[number]): Character =>
    seed({ classRef: sub.classRef, subclassRefs: [sub.id] });

  const openLineage = (): void => {
    click(fold('Lineage, domains & features'));
  };

  it('names the trait on the phone, in the fold that carries the class line', () => {
    const sub = subclassWith(true);
    const c = asSubclass(sub);
    play(c);
    openLineage();
    expect(text()).toContain(`SPELLCAST · ${sub.spellcastTrait!.toUpperCase()}`);
  });

  it('names it in the cockpit too, where the class line is not behind a fold', () => {
    setViewport(1280);
    const sub = subclassWith(true);
    const c = asSubclass(sub);
    play(c);
    expect(text()).toContain(`SPELLCAST · ${sub.spellcastTrait!.toUpperCase()}`);
  });

  it('says a class has none rather than leaving an absence to explain itself', () => {
    // Four of the eighteen shipped subclasses carry no Spellcast trait - both
    // Guardian subclasses and both Warrior ones - and for those characters the
    // whole Spellcast row is missing from Equipped. A blank explains nothing.
    setViewport(1280);
    const c = asSubclass(subclassWith(false));
    play(c);
    expect(text()).toContain('NO SPELLCAST TRAIT');
    expect(text()).not.toContain('SPELLCAST ·');
  });
});
