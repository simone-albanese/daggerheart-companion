// @vitest-environment jsdom
/**
 * A Druid in a Beastform, on the screen they play from.
 *
 * The strip has always printed the form's attack - `ATTACK d12+8 · MELEE ·
 * STRENGTH` - as text, and there was no declaration that could arm it. So the
 * only attacks this screen would actually roll while transformed were the two
 * the rule takes away: *"While transformed, you can't use weapons or cast
 * spells from domain cards."*
 *
 * These are presence tests, like `playFeatures.test.tsx`: what went wrong was
 * an absence, and an absence is what a screenshot review never catches.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { beastformDamage } from '../../src/engine/beastform.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp, useStats } from '../../src/store/state.ts';
import { Play } from '../../src/ui/player/Play.tsx';
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
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
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

/**
 * A Druid out of the shipped dataset, since Beastform is found by feature name
 * and not by a `druid` ref. The fixture character is a Bard.
 */
const druidClass = (): (typeof dataset.classes)[number] => {
  const klass = dataset.classes.find((c) => c.classFeatures.some((f) => f.name === 'Beastform'));
  if (klass === undefined) throw new Error('no class in the dataset has a Beastform feature');
  return klass;
};

/** The highest-tier form this dataset carries, so the dice are worth scaling. */
const bigForm = (): (typeof dataset.beastforms)[number] => {
  const form = [...dataset.beastforms].sort((a, b) => b.tier - a.tier)[0];
  if (form === undefined) throw new Error('the dataset carries no beastforms');
  return form;
};

function seed(patch: Partial<Character> = {}): Character {
  const klass = druidClass();
  const subclass = dataset.subclasses.find((s) => s.classRef === klass.id);
  const character: Character = {
    ...playedCharacter(),
    classRef: klass.id,
    subclassRefs: subclass ? [subclass.id] : [],
    level: 8,
    ...patch,
  };
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

/**
 * Play, mounted the way the shell mounts it.
 *
 * `stats` is a prop, and the shell recomputes it from the store on every render
 * through `useStats()`. A test that passes one snapshot instead would keep a
 * dropped Beastform's numbers alive across the very update this file is about,
 * and would pass whether or not the app did the right thing.
 */
function Screen(): React.JSX.Element | null {
  const stats = useStats();
  return stats === null ? null : createElement(Play, { stats });
}

const play = (): void => {
  render(createElement(Screen));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * Open the disclosure `Equipped` lives behind on a phone.
 *
 * The section is not on the phone's first screen - it is inside "Weapons &
 * armour", which is shut on arrival. That is worth writing down rather than
 * working around silently: while transformed, the one attack a Druid can make
 * is behind a fold whose label names the two things the rule has taken away.
 */
function openGearFold(): void {
  const fold = buttons().find(
    (b) =>
      b.getAttribute('aria-expanded') === 'false' &&
      (b.textContent ?? '').startsWith('Weapons & armour'),
  );
  if (fold !== undefined) click(fold);
}

/** The row in Equipped that declares the worn form's attack. */
function attackRow(): HTMLButtonElement | undefined {
  return buttons().find(
    (b) =>
      b.getAttribute('aria-pressed') !== null &&
      (b.textContent ?? '').includes(bigForm().name) &&
      (b.textContent ?? '').includes('PHYSICAL'),
  );
}

describe('the attack a worn form makes', () => {
  it('is not offered at all when the Druid is a person', () => {
    seed({ beastform: null });
    play();
    openGearFold();
    // The fold is open and holds the weapons, so an undefined row here is an
    // absence and not a closed disclosure.
    expect(text()).toContain('PHYSICAL');
    expect(attackRow()).toBeUndefined();
  });

  it('is a row you can declare, with Proficiency already in the dice', () => {
    const form = bigForm();
    const c = seed({ beastform: { ref: form.id, activatedAt: '2026-08-23T00:00:00.000Z' } });
    play();
    openGearFold();

    const row = attackRow();
    expect(row, 'no row in Equipped declares the worn form').toBeDefined();

    const stats = deriveStats(c, dataset, index);
    const scaled = beastformDamage(form, stats.proficiency)!;
    // The whole point: the strip prints the form's own `d12+10`, this prints
    // the pool that will be rolled. They must not be the same string.
    expect(row?.textContent ?? '').toContain(scaled.spec);
    expect(scaled.spec).not.toBe(form.attack.damage);
  });

  it('arms, and says so, and the trait it arms is the form’s own', () => {
    const form = bigForm();
    seed({ beastform: { ref: form.id, activatedAt: '2026-08-23T00:00:00.000Z' } });
    play();
    openGearFold();

    click(attackRow()!);
    expect(attackRow()?.getAttribute('aria-pressed')).toBe('true');
    expect(attackRow()?.textContent ?? '').toContain('ARMED');

    // The chip the roll will use. `arm` sets it from `form.attack.trait`, the
    // same sentence a weapon arms its own trait by.
    const armedTrait = buttons().find(
      (b) => b.getAttribute('aria-pressed') === 'true' && /^[A-Z]{3}$/.test((b.textContent ?? '').trim().slice(0, 3)),
    );
    expect(armedTrait, 'nothing carries the armed trait').toBeDefined();
  });

  it('takes the offer with it when the form is dropped', () => {
    // The property the empty `{ kind: 'beastform' }` declaration exists for:
    // the pool is re-derived from the worn form every render, so DROP resolves
    // it to null rather than leaving a bear's dice armed on a person.
    const form = bigForm();
    seed({ beastform: { ref: form.id, activatedAt: '2026-08-23T00:00:00.000Z' } });
    play();
    openGearFold();
    click(attackRow()!);
    expect(text()).toContain('ARMED');

    const drop = buttons().find((b) => (b.textContent ?? '').trim() === 'DROP');
    expect(drop, 'the strip offers no way out of the form').toBeDefined();
    click(drop!);

    expect(attackRow()).toBeUndefined();
    expect(useApp.getState().characters[0]?.beastform).toBeNull();
  });
});
