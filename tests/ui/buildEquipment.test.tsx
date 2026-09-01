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

/*
 * The four tier 1 weapons the burden cases are built on, plus one weapon and
 * one set of armor at tier 4.
 *
 * The tier 4 pair is what the refusal cases need and nothing else uses them:
 * every character on this file is level 1, so `canEquip` is false for them on
 * both screens and true for everything else, with no level arithmetic in the
 * way of reading the assertion. Their names are deliberately unlike the
 * others' - `named()` matches on substring, and a `Legendary Longsword` beside
 * a `Longsword` would make every press in this file ambiguous.
 */
const dataset: Dataset = makeDataset({
  classes: [IGNORER, PLAIN],
  weapons: [
    makeWeapon({ id: 'greatsword', name: 'Greatsword', slot: 'primary', burden: 2 }),
    makeWeapon({ id: 'longsword', name: 'Longsword', slot: 'primary', burden: 1 }),
    makeWeapon({ id: 'small-dagger', name: 'Small Dagger', slot: 'secondary', burden: 1 }),
    makeWeapon({ id: 'round-shield', name: 'Round Shield', slot: 'secondary', burden: 1 }),
    makeWeapon({ id: 'star-pike', name: 'Star Pike', slot: 'primary', burden: 1, tier: 4 }),
    makeWeapon({ id: 'moon-fang', name: 'Moon Fang', slot: 'secondary', burden: 1, tier: 4 }),
  ],
  armors: [
    makeArmor({ id: 'gambeson', name: 'Gambeson' }),
    makeArmor({ id: 'dragon-plate', name: 'Dragon Plate', tier: 4 }),
  ],
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

/**
 * A fresh key every time, so a second `mount` in one test really is a second
 * character and not the first one's `useState` surviving the re-render. That
 * cost half an hour once: two mounts, one draft, and an assertion about the
 * SECOND that was reading the first.
 */
let mounts = 0;

function mount(start: Partial<Draft>, klass: CharClass = PLAIN): void {
  mounts += 1;
  act(() => {
    root.render(createElement(Harness, { start, klass, key: String(mounts) }));
  });
}

/**
 * The same two weapons on the finished sheet, so the pair of screens can be
 * compared rather than each trusted on its own.
 */
function mountSheet(
  held: { primary: Ref | null; secondary: Ref | null; armor?: Ref | null },
  klass: CharClass = PLAIN,
): void {
  const character: Character = makeCharacter({
    classRef: klass.id,
    activePrimaryWeapon: held.primary,
    activeSecondaryWeapon: held.secondary,
    activeArmor: held.armor ?? null,
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

/** The live region under a slot, mounted whether or not it has anything in it. */
function noteRegion(label: string): HTMLElement {
  const heading = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  expect(heading, `no slot labelled ${label}`).toBeDefined();
  const found = [...heading!.parentElement!.children].find(
    (el) => el.getAttribute('role') === 'status',
  );
  expect(found, `the ${label} slot draws no live region`).toBeDefined();
  return found as HTMLElement;
}

/** Every ✕ on the screen, by the slot it clears. */
const clears = (): string[] =>
  buttons()
    .map((b) => b.getAttribute('aria-label') ?? '')
    .filter((l) => l.startsWith('Clear '))
    .sort();

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

/**
 * Tap the open picker's Slot chip over to "Any" - the one gesture that puts a
 * main-hand weapon in front of somebody filling the off-hand.
 */
function widenSlotFilter(): void {
  const group = [...container.querySelectorAll('[role="group"]')].find(
    (g) => g.getAttribute('aria-label') === 'Slot',
  );
  expect(group, 'the picker draws no Slot control').toBeDefined();
  press(
    [...group!.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Any') as
      | HTMLButtonElement
      | undefined,
  );
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

describe('a weapon in the hand the book did not file it under', () => {
  it('is a state the picker really reaches, in two taps', () => {
    /*
     * The premise, proved rather than assumed. `weaponQuery(slot)` opens the
     * off-hand picker pre-set to off-hand weapons, and that chip is a DEFAULT:
     * one tap on Any and the whole armoury is on the list, Greatsword included.
     * No `onPick` compares `weapon.slot` with the slot it is filling, so the
     * pick goes through - and until now nothing anywhere said so afterwards.
     */
    mount({ primary: 'longsword' });
    press(slot('Secondary weapon'));
    expect(named('Greatsword'), 'the picker opened on the whole armoury').toBeUndefined();

    widenSlotFilter();
    press(named('Greatsword'));

    expect(draft.secondary, 'the pick was refused after all').toBe('greatsword');
    expect(noteOf('Secondary weapon')).toContain('THE BOOK LISTS GREATSWORD AS A PRIMARY WEAPON');
  });

  it('says it in the other direction too', () => {
    mount({ primary: 'small-dagger' });
    expect(noteOf('Primary weapon')).toBe('THE BOOK LISTS SMALL DAGGER AS A SECONDARY WEAPON');
  });

  it('says nothing when the hand and the book agree', () => {
    mount({ primary: 'greatsword', secondary: 'small-dagger' });
    expect(noteOf('Primary weapon')).toBe('');
    expect(noteOf('Secondary weapon')).not.toContain('THE BOOK LISTS');
  });

  it('says both true things at once when a main-hand weapon is also over the limit', () => {
    mount({ primary: 'greatsword', secondary: 'greatsword' });
    expect(noteOf('Secondary weapon')).toBe(
      'GREATSWORD AND GREATSWORD ARE 4 HANDS — YOUR MAXIMUM BURDEN IS 2 · ' +
        'THE BOOK LISTS GREATSWORD AS A PRIMARY WEAPON',
    );
  });

  it('still says which hand the book meant to a character who ignores burden', () => {
    mount({ primary: 'greatsword', secondary: 'greatsword' }, IGNORER);
    expect(noteOf('Secondary weapon')).toBe('THE BOOK LISTS GREATSWORD AS A PRIMARY WEAPON');
  });

  it('says the same on the sheet, which never had the sentence either', () => {
    // Both hands wrong, and the pair is over the limit at 1 + 2 - which the
    // old `primary.burden === 2` test could not have seen either.
    mountSheet({ primary: 'small-dagger', secondary: 'greatsword' });
    expect(noteOf('Primary weapon')).toBe('THE BOOK LISTS SMALL DAGGER AS A SECONDARY WEAPON');
    expect(noteOf('Secondary weapon')).toBe(
      'SMALL DAGGER AND GREATSWORD ARE 3 HANDS — YOUR MAXIMUM BURDEN IS 2 · ' +
        'THE BOOK LISTS GREATSWORD AS A PRIMARY WEAPON',
    );
  });
});

describe('putting something down, and being able to see that you can', () => {
  it('offers a ✕ on all three wizard slots, as the sheet always has', () => {
    /*
     * The capability was never missing - `WeaponPicker` draws `Unequip` and
     * `ArmorPicker` draws `Unarmored`, both calling `onPick(null)`, and the
     * wizard's `onPick` has always taken a null. What was missing is that the
     * way out was inside the room you were trying to leave, on two of three
     * slots, while the third one and all three on the sheet showed a ✕.
     */
    mount({ primary: 'greatsword', secondary: 'small-dagger', armor: 'gambeson' });
    expect(clears()).toEqual(['Clear Armor', 'Clear Primary weapon', 'Clear Secondary weapon']);

    mountSheet({ primary: 'greatsword', secondary: 'small-dagger', armor: 'gambeson' });
    expect(clears()).toEqual(['Clear Armor', 'Clear Primary weapon', 'Clear Secondary weapon']);
  });

  it('empties the slot it names, and no other', () => {
    mount({ primary: 'greatsword', secondary: 'small-dagger', armor: 'gambeson' });
    const clear = (label: string): void =>
      press(buttons().find((b) => b.getAttribute('aria-label') === `Clear ${label}`));

    clear('Primary weapon');
    expect(draft).toMatchObject({ primary: null, secondary: 'small-dagger', armor: 'gambeson' });
    clear('Armor');
    expect(draft).toMatchObject({ primary: null, secondary: 'small-dagger', armor: null });
    clear('Secondary weapon');
    expect(draft).toMatchObject({ primary: null, secondary: null, armor: null });
  });

  it('draws no ✕ over a slot that is already empty', () => {
    // There is nothing to clear, and a control that would do nothing is worse
    // than none: it is a second thing to try before believing the slot.
    mount({});
    expect(clears()).toEqual([]);
  });

  it('clears one slot at a 44px target', () => {
    mount({ primary: 'greatsword' });
    const x = buttons().find((b) => b.getAttribute('aria-label') === 'Clear Primary weapon')!;
    // jsdom lays nothing out, so this is the DECLARATION the layout engine acts
    // on. `var(--tap)` is the 44px floor this project holds every control to.
    expect(x.style.minWidth).toBe('var(--tap)');
  });
});

describe('the sentence under a slot, spoken as well as printed', () => {
  it('is a live region on every slot, mounted before it has anything to say', () => {
    /*
     * The wizard's own blocking reason is `role="status"` in both places it is
     * drawn; this one was a bare `<span>`, so the line that changes when the
     * OTHER hand is filled reached a screen reader as nothing at all.
     * Mounted empty rather than conditionally, because a live region has to
     * exist before its contents change for the change to be spoken -
     * `NameRefusal` writes that rule down.
     */
    mount({});
    for (const label of ['Primary weapon', 'Secondary weapon', 'Armor']) {
      expect(noteRegion(label).textContent).toBe('');
    }
  });

  it('costs nothing while it is empty', () => {
    /*
     * The reason `NameRefusal` carries its own margin instead of sitting under
     * a `gap`: an always-mounted region under a 6px gap would charge every slot
     * on both screens 6px permanently, for the empty case that is almost every
     * slot almost always.
     */
    mount({ primary: 'longsword' });
    const region = noteRegion('Primary weapon');
    expect(region.style.marginTop).toBe('0px');
    expect(region.parentElement!.style.gap, 'a gap would charge the empty case').toBe('');

    mount({ primary: 'small-dagger' });
    expect(noteRegion('Primary weapon').style.marginTop).toBe('6px');
  });
});

/**
 * The other limit in the same chapter, and the one that is a refusal.
 *
 * THE DEFECT, in the shipped build's own words. The Equipment chapter this app
 * renders on its own rules screen says *"You can't equip weapons or armor with
 * a higher tier than you."* Both pickers dimmed the row, printed `TIER 4 —
 * USABLE FROM LEVEL 8` on it, and equipped it on the tap. The UI contradicted
 * the text, in one build, one screen away from it.
 *
 * ## Why it is asked on both screens here, again
 *
 * The refusal lives in `WeaponPicker` and `ArmorPicker`, which both screens
 * share - so one implementation covers four combinations and looks right from
 * either call site alone. That is the same shape as the burden defect at the
 * top of this file, where two screens wrote one rule two ways, and it is the
 * reason this file exists rather than two. The four cases are walked here
 * rather than reasoned about from the shared dialog.
 *
 * ## And what is NOT refused, which is half the decision
 *
 * Nothing is taken off a sheet that already carries it. The last two cases are
 * that half: a character holding tier 4 gear at level 1 keeps every ref, and
 * is told - `slotTierNote` - rather than quietly stripped. `Edit.tsx` refuses
 * the stripping shape in writing, one section up, about the off-hand.
 */
describe('the tier the book says a character cannot equip', () => {
  const KEPT = 'TIER 4 — KEPT; YOU CANNOT EQUIP IT AGAIN UNTIL LEVEL 8';
  const stored = (): Character => useApp.getState().characters[0]!;

  /** A picker row, and the fact that it is drawn as one that cannot be taken. */
  function refusedRow(name: string): HTMLButtonElement {
    const found = named(name);
    expect(found, `no row for ${name} in the open picker`).toBeDefined();
    expect(found!.getAttribute('aria-disabled'), `${name} is offered as takeable`).toBe('true');
    // Shown, and still carrying the list's own sentence: the refusal is not an
    // excuse to hide the row or to stop saying when it opens up.
    expect(found!.textContent, `${name} lost its reason`).toContain('TIER 4 — USABLE FROM LEVEL 8');
    return found!;
  }

  it('refuses a tier 4 weapon in the wizard, and takes the tier 1 one beside it', () => {
    mount({});
    press(slot('Primary weapon'));
    press(refusedRow('Star Pike'));
    expect(draft.primary, 'the wizard equipped what the book refuses').toBeNull();

    // The control, in the same open dialog: the refusal is about the tier and
    // not about the picker having stopped working.
    press(named('Longsword'));
    expect(draft.primary).toBe('longsword');
  });

  it('refuses one in the off-hand too, where the burden sentence lives', () => {
    mount({ primary: 'longsword' });
    press(slot('Secondary weapon'));
    press(refusedRow('Moon Fang'));
    expect(draft.secondary, 'the off-hand took what the main hand would not').toBeNull();
    expect(draft.primary, 'the other hand moved on its own').toBe('longsword');
  });

  it('refuses tier 4 armor in the wizard', () => {
    mount({});
    press(slot('Armor'));
    press(refusedRow('Dragon Plate'));
    expect(draft.armor).toBeNull();

    press(named('Gambeson'));
    expect(draft.armor).toBe('gambeson');
  });

  it('refuses the same weapon and the same armor on the sheet', async () => {
    mountSheet({ primary: null, secondary: null });
    press(slot('Primary weapon'));
    press(refusedRow('Star Pike'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(stored().activePrimaryWeapon, 'the sheet equipped what the wizard refused').toBeNull();

    press(named('Longsword'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(stored().activePrimaryWeapon).toBe('longsword');

    press(slot('Armor'));
    press(refusedRow('Dragon Plate'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(stored().activeArmor).toBeNull();
  });

  it('keeps what a sheet arrived carrying, and says so under the slot', () => {
    /*
     * The half that is not a refusal. This state is reachable without any
     * picker: a file or QR from a level 10 character, a level typed back down
     * on this very screen. Stripping it on sight would be the app making a
     * decision behind the player at the moment they can least see it happen.
     */
    mountSheet({ primary: 'star-pike', secondary: null, armor: 'dragon-plate' });
    expect(stored().activePrimaryWeapon, 'the sheet was quietly disarmed').toBe('star-pike');
    expect(stored().activeArmor, 'the armor came off on its own').toBe('dragon-plate');
    expect(noteOf('Primary weapon')).toBe(KEPT);
    expect(noteOf('Armor')).toBe(KEPT);
    // And the way out is the one it has always been: the ✕ the player presses.
    expect(clears()).toContain('Clear Primary weapon');
  });

  it('says the same thing on the wizard, for the same held gear', () => {
    // The draft can no longer reach this state through the picker, and it can
    // still arrive in one - `Wizard.tsx` restores a saved draft. Both screens
    // print one sentence, which is the standing promise of this file.
    mount({ primary: 'star-pike', armor: 'dragon-plate' });
    expect(noteOf('Primary weapon')).toBe(KEPT);
    expect(noteOf('Armor')).toBe(KEPT);
  });

  it('says nothing at all about a tier the character has reached', () => {
    // The control on all six above: the sentence is the tier's, not the slot's.
    mount({ primary: 'longsword', armor: 'gambeson' });
    expect(noteOf('Primary weapon')).toBe('');
    expect(noteOf('Armor')).toBe('');
    expect(container.textContent).not.toContain('KEPT');
  });
});
