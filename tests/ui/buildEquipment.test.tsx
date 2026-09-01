// @vitest-environment jsdom
/**
 * The two build screens, the burden limit, and the class the book excuses.
 *
 * A tester reported three things about this step and the sheet beside it, and
 * all three were true. One cause: the burden limit was applied by code that
 * never asked which class was holding the weapon.
 *
 *   - the off-hand slot was DISABLED whenever the primary was two-handed, and
 *     picking a two-handed primary DELETED whatever was already in the off-hand
 *     - silently, as a side effect of filling a different slot;
 *   - the sentence that explained it fired on `twoHanded && primary`, without
 *     ever looking at the off-hand, so it appeared over an empty optional slot;
 *   - and none of it is true for a Warrior, whose Combat Training reads *"You
 *     ignore burden when equipping weapons."*
 *
 * `Edit.tsx` had already refused the same enforcement in writing - *"Said, not
 * enforced. A sheet that quietly unequipped the off-hand when a greatsword
 * arrived would be the app making a call the table gets to make"* - so the two
 * build screens were answering one question two ways, and the wizard's answer
 * was the one that could not be undone.
 *
 * ## Both screens, in one file, on purpose
 *
 * The defect is that the wizard and the sheet answered one question two ways.
 * Split across two files each half can be repaired to a different sentence and
 * both files stay green, which is how the pair got here; the last describe
 * below renders the SAME character on both and compares the strings.
 *
 * ## Why this mounts the step and not the whole wizard
 *
 * The wizard's half lives in the wiring between a picker's `onPick` and the
 * draft, inside `StepEquipment`. Driving the whole `Wizard` here would add
 * eleven presses of Next to every case and exercise nothing extra;
 * `wizardCreate.test.tsx` is the file that walks the whole flow. The step is
 * exported for this, the way `StepCards` and `StepExperiences` already are.
 *
 * ## Why the dataset is synthetic
 *
 * The cases here need a class that carries Combat Training under an id that is
 * NOT `warrior`, and a class called `warrior` that does not carry it. The
 * shipped book has neither, and it is the shipped book that
 * `tests/engine/burden.test.ts` holds the address against. Here what matters is
 * that the screens read the predicate rather than a class name they recognise.
 */
import { act, createElement, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CharClass, Character, Dataset, Ref } from '@shared/types.ts';
import { deriveStats, indexDataset } from '@engine/character.ts';
import { IGNORES_BURDEN_FEATURE } from '@engine/burden.ts';
import { useApp } from '../../src/store/state.ts';
import { emptyDraft, type Draft } from '../../src/ui/build/creation.ts';
import { Edit } from '../../src/ui/build/Edit.tsx';
import { StepEquipment } from '../../src/ui/build/Wizard.tsx';
import {
  feature,
  makeArmor,
  makeCharacter,
  makeClass,
  makeDataset,
  makeWeapon,
} from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const COMBAT_TRAINING = {
  name: IGNORES_BURDEN_FEATURE,
  text: 'You ignore burden when equipping weapons.',
};

/**
 * The class that ignores burden is not called `warrior`, and the class called
 * `warrior` does not ignore it. A screen that matched the id passes nothing
 * here.
 */
const IGNORER = makeClass({
  id: 'a-class-by-another-name',
  name: 'Renamed Warrior',
  classFeatures: [COMBAT_TRAINING],
});
const PLAIN = makeClass({ id: 'warrior', name: 'Not The Warrior', classFeatures: [feature()] });

const dataset: Dataset = makeDataset({
  classes: [IGNORER, PLAIN],
  weapons: [
    makeWeapon({ id: 'greatsword', name: 'Greatsword', slot: 'primary', burden: 2 }),
    makeWeapon({ id: 'longsword', name: 'Longsword', slot: 'primary', burden: 1 }),
    makeWeapon({ id: 'small-dagger', name: 'Small Dagger', slot: 'secondary', burden: 1 }),
    makeWeapon({ id: 'round-shield', name: 'Round Shield', slot: 'secondary', burden: 1 }),
  ],
  armors: [makeArmor({ id: 'gambeson', name: 'Gambeson' })],
});
const index = indexDataset(dataset);

let container: HTMLDivElement;
let root: Root;
/** The draft as the step last left it, so a press can be read as a write. */
let draft: Draft;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, storageError: null, dataset, index, log: [], openCard: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The step with a draft that actually changes, because every defect here is a
 * write: what `onPick` puts in the draft, and what it leaves alone.
 */
function Harness({ start, klass }: { start: Partial<Draft>; klass: CharClass }): ReactElement {
  const [d, setD] = useState<Draft>(() => ({ ...emptyDraft(), ...start }));
  draft = d;
  return createElement(StepEquipment, {
    draft: d,
    klass,
    set: (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p })),
  });
}

function mount(start: Partial<Draft>, klass: CharClass = PLAIN): void {
  act(() => {
    root.render(createElement(Harness, { start, klass }));
  });
}

/**
 * The same two weapons on the finished sheet, so the pair of screens can be
 * compared rather than each trusted on its own.
 */
function mountSheet(
  held: { primary: Ref | null; secondary: Ref | null },
  klass: CharClass = PLAIN,
): void {
  const character: Character = makeCharacter({
    classRef: klass.id,
    activePrimaryWeapon: held.primary,
    activeSecondaryWeapon: held.secondary,
  });
  useApp.setState({ characters: [character], activeId: character.id });
  act(() => {
    root.render(
      createElement(Edit, { stats: deriveStats(character, dataset, index), onLevelUp: () => {} }),
    );
  });
}

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const named = (text: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').trim().toLowerCase().includes(text.toLowerCase()));
const press = (b: HTMLButtonElement | undefined): void => {
  expect(b, 'no such control on the step').toBeDefined();
  expect(b!.disabled, 'the control is on the page but refuses the press').toBe(false);
  act(() => b!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

/** The slot's own button - the one that opens the picker - by its label. */
function slot(label: string): HTMLButtonElement {
  const heading = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  expect(heading, `no slot labelled ${label}`).toBeDefined();
  const found = heading!.parentElement?.querySelector('button');
  expect(found, `the ${label} slot draws no button`).not.toBeNull();
  return found as HTMLButtonElement;
}

/**
 * The line under a slot: whatever `GearSlot` prints beneath the row, and
 * nothing from the neighbouring slots. Read as one string because the
 * composer joins its lines with `·` into one element.
 */
function noteOf(label: string): string {
  const heading = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  expect(heading, `no slot labelled ${label}`).toBeDefined();
  const box = heading!.parentElement!;
  return [...box.children]
    .filter((el) => el.tagName === 'SPAN' && el !== heading)
    .map((el) => (el.textContent ?? '').trim())
    .join(' ')
    .trim();
}

/** Open a picker from its slot and take the named weapon out of it. */
function equip(label: string, weapon: string): void {
  press(slot(label));
  press(named(weapon));
}

describe('a two-handed primary, and the off-hand the wizard used to empty', () => {
  it('leaves the off-hand slot open, and shows what is in it', () => {
    mount({ primary: 'greatsword', secondary: 'small-dagger' });

    const off = slot('Secondary weapon');
    expect(off.disabled, 'the off-hand was refused rather than described').toBe(false);
    expect(off.textContent, 'the slot drew its empty state over a weapon that is in it').toContain(
      'Small Dagger',
    );
    // The gate inside `GearSlot` is `title !== null`, so a nulled title took
    // the ✕ with it: the state had no way out except equipping over the top.
    expect(
      buttons().some((b) => b.getAttribute('aria-label') === 'Clear Secondary weapon'),
      'no way to put the off-hand down',
    ).toBe(true);
  });

  it('keeps a weapon already in the off-hand when a two-handed primary arrives', () => {
    mount({ primary: 'longsword', secondary: 'small-dagger' });
    equip('Primary weapon', 'Greatsword');

    expect(draft.primary).toBe('greatsword');
    expect(draft.secondary, 'the wizard threw away a choice the player had made').toBe(
      'small-dagger',
    );
  });

  it('fills the off-hand while a two-handed primary is already held', () => {
    mount({ primary: 'greatsword' });
    equip('Secondary weapon', 'Round Shield');

    expect(draft.secondary).toBe('round-shield');
    expect(draft.primary, 'the other hand moved on its own').toBe('greatsword');
  });

  it('still puts one weapon in one slot, and touches no other', () => {
    // The control on the change above: a pick must not become a no-op either.
    mount({ primary: 'greatsword', secondary: 'small-dagger' });
    equip('Secondary weapon', 'Round Shield');
    expect(draft).toMatchObject({ primary: 'greatsword', secondary: 'round-shield' });

    equip('Primary weapon', 'Longsword');
    expect(draft).toMatchObject({ primary: 'longsword', secondary: 'round-shield' });
  });
});

describe('the sentence about hands, and who it is true of', () => {
  const OVER = 'GREATSWORD AND SMALL DAGGER ARE 3 HANDS — YOUR MAXIMUM BURDEN IS 2';

  it('says nothing over an empty off-hand, however the main hand is filled', () => {
    /*
     * THE DEFECT. The note fired on `twoHanded && primary` and never looked at
     * the off-hand, so this slot - optional, empty, nothing chosen - carried
     * "there is no hand left for an off-hand weapon" as a permanent warning
     * about a weapon nobody had picked.
     */
    mount({ primary: 'greatsword' });
    expect(noteOf('Secondary weapon')).toBe('');
    expect(container.textContent).not.toContain('HANDS');
  });

  it('says it once the off-hand is actually holding something', () => {
    mount({ primary: 'greatsword', secondary: 'small-dagger' });
    expect(noteOf('Secondary weapon')).toBe(OVER);
    // Under the off-hand, and not under the hand that is not the subject.
    expect(noteOf('Primary weapon')).toBe('');
  });

  it('says nothing at all to a character who ignores burden', () => {
    mount({ primary: 'greatsword', secondary: 'small-dagger' }, IGNORER);
    expect(noteOf('Secondary weapon')).toBe('');
    expect(container.textContent).not.toContain('MAXIMUM BURDEN');
  });

  it('is not fooled by the class id either way', () => {
    // `PLAIN` is the one called `warrior`, and it does not carry the feature.
    mount({ primary: 'greatsword', secondary: 'small-dagger' }, PLAIN);
    expect(noteOf('Secondary weapon')).toBe(OVER);
  });

  it('appears and disappears as the main hand changes, without a remount', () => {
    mount({ primary: 'longsword', secondary: 'small-dagger' });
    expect(noteOf('Secondary weapon')).toBe('');
    equip('Primary weapon', 'Greatsword');
    expect(noteOf('Secondary weapon')).toBe(OVER);
    equip('Primary weapon', 'Longsword');
    expect(noteOf('Secondary weapon')).toBe('');
  });
});

describe('the sheet, saying the same thing about the same character', () => {
  const OVER = 'GREATSWORD AND SMALL DAGGER ARE 3 HANDS — YOUR MAXIMUM BURDEN IS 2';

  it('stops telling a Warrior there is no hand left for what they are holding', () => {
    /*
     * THE FALSE SENTENCE. `${primary.name} is two-handed — no hand left for
     * this` was the general rule with the book's own exception left out, and it
     * was printed hardest at the one class the exception belongs to.
     */
    mountSheet({ primary: 'greatsword', secondary: 'small-dagger' }, IGNORER);
    expect(noteOf('Secondary weapon')).toBe('');
    expect(container.textContent).not.toContain('MAXIMUM BURDEN');
    expect(container.textContent).not.toContain('NO HAND LEFT');
  });

  it('still says it to everybody the rule does bind', () => {
    mountSheet({ primary: 'greatsword', secondary: 'small-dagger' }, PLAIN);
    expect(noteOf('Secondary weapon')).toBe(OVER);
  });

  it('says nothing over an off-hand nobody has filled', () => {
    mountSheet({ primary: 'greatsword', secondary: null }, PLAIN);
    expect(noteOf('Secondary weapon')).toBe('');
  });

  it('does not enforce it - the off-hand stays live and stays clearable', () => {
    mountSheet({ primary: 'greatsword', secondary: 'small-dagger' }, PLAIN);
    expect(slot('Secondary weapon').disabled).toBe(false);
    expect(
      buttons().some((b) => b.getAttribute('aria-label') === 'Clear Secondary weapon'),
    ).toBe(true);
  });

  it('agrees with the wizard, string for string, on every case here', () => {
    /*
     * The assertion the split into two files could not make. Each screen builds
     * its own inputs - the wizard from a draft and an assembled sheet, the
     * sheet from a stored character - and the point of the repair is that the
     * two arrive at one sentence.
     */
    const cases: Array<[Ref | null, Ref | null, CharClass]> = [
      ['greatsword', 'small-dagger', PLAIN],
      ['greatsword', 'small-dagger', IGNORER],
      ['longsword', 'small-dagger', PLAIN],
      ['greatsword', null, PLAIN],
      ['greatsword', 'greatsword', PLAIN],
      [null, 'small-dagger', PLAIN],
    ];
    for (const [primary, secondary, klass] of cases) {
      mount({ primary, secondary }, klass);
      const fromWizard = [noteOf('Primary weapon'), noteOf('Secondary weapon')];
      mountSheet({ primary, secondary }, klass);
      const fromSheet = [noteOf('Primary weapon'), noteOf('Secondary weapon')];
      expect(fromSheet, `${String(primary)} + ${String(secondary)} as ${klass.id}`).toEqual(
        fromWizard,
      );
    }
  });
});
