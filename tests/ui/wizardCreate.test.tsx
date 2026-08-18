// @vitest-environment jsdom
/**
 * The last button in the wizard, on the day the device says no.
 *
 * Twelve steps end in one press of "Create character". `create()` writes to
 * IndexedDB *before* it touches the store, so a refused write leaves nothing at
 * all behind: no record on the disk, no entry in the library, and every choice
 * the player made still sitting in the wizard's own `useState`. Until this
 * file, that press produced an unhandled rejection and nothing else - no
 * navigation, no sentence, no second chance that behaved any differently from
 * the first. A person on a full phone would press it, watch nothing happen,
 * press it again, and eventually close the tab.
 *
 * And on a device that says yes but says it slowly, the same unguarded button
 * accepted a second tap while the first write was still in the air, and wrote
 * two characters.
 *
 * It has to be jsdom, and it has to be the whole screen. Both defects are in
 * the wiring between the button and the store - what is awaited, what is
 * disabled, what is rendered afterwards - and none of it is visible to
 * `wizard.test.ts`, which renders this component once with
 * `renderToStaticMarkup` and never presses anything.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexDataset } from '@engine/character.ts';
import * as db from '../../src/store/db.ts';
import { useApp } from '../../src/store/state.ts';
import { STEPS } from '../../src/ui/build/creation.ts';
import { Wizard } from '../../src/ui/build/Wizard.tsx';
import { makeCharacter, makeClass, makeDataset } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/**
 * A dataset with one class and nothing else.
 *
 * `review` warns rather than blocks for every table that is absent, so the
 * only mandatory choices left are the class and the six trait modifiers. That
 * is what makes walking to the twelfth step a dozen clicks instead of a
 * detour through the weapon picker - and the button under test does not care
 * which of the two datasets it is standing on.
 */
const dataset = makeDataset({
  classes: [makeClass()],
  subclasses: [],
  ancestries: [],
  communities: [],
  weapons: [],
  armors: [],
  domainCards: [],
});
const index = indexDataset(dataset);

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // The tablet band: no phone layout, so the desktop nav is the one on screen.
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  // jsdom scrolls nothing, and the wizard scrolls its panel to the top on
  // every step change.
  Element.prototype.scrollTo = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, dataset, index, characters: [], activeId: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

/** The one button whose own text contains this, with nothing ambiguous about it. */
function press(text: string): void {
  const found = buttons().filter((b) => (b.textContent ?? '').includes(text));
  expect(found.length, `expected exactly one button reading "${text}"`).toBe(1);
  const button = found[0]!;
  expect(button.disabled, `"${text}" was disabled`).toBe(false);
  act(() => {
    button.click();
  });
}

function pressLabelled(label: string): void {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button, `no control labelled "${label}"`).not.toBeNull();
  act(() => {
    button?.click();
  });
}

/** The fixed array, placed. Six taps, one per trait. */
function assignTheArray(): void {
  pressLabelled('Agility plus 2');
  pressLabelled('Strength plus 1');
  pressLabelled('Finesse plus 1');
  pressLabelled('Instinct plus 0');
  pressLabelled('Presence plus 0');
  pressLabelled('Knowledge minus 1');
}

/**
 * Walk the wizard the way a player does, and stop on the last step.
 *
 * Driven off STEPS rather than a hardcoded count, so a thirteenth step is
 * walked the day it is added rather than turning this into a silent no-op.
 */
function walkToCreate(props: { onCreated?: () => void } = {}): void {
  act(() => {
    root.render(createElement(Wizard, props));
  });
  for (let i = 0; i < STEPS.length - 1; i += 1) {
    const id = STEPS[i]!.id;
    if (id === 'class') press('Test Class');
    if (id === 'traits') assignTheArray();
    press('Next');
  }
  // Standing on the last step, with the button that does the writing on screen.
  expect(buttons().some((b) => (b.textContent ?? '').includes('Create character'))).toBe(true);
}

/** Everything the wizard has on the page, ready to search for a sentence. */
const shown = (): string => container.textContent ?? '';

describe('a device that refuses to save the character', () => {
  it('says so, instead of leaving twelve steps of work behind a dead button', async () => {
    const refused = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    vi.spyOn(db, 'putCharacter').mockRejectedValue(refused);
    let created = 0;
    walkToCreate({
      onCreated: () => {
        created += 1;
      },
    });

    press('Create character');
    await act(async () => {
      await Promise.resolve();
    });

    expect(shown(), 'the refusal never reached the screen').toContain('NOTHING WAS CREATED');
    expect(shown(), 'the device’s own words were dropped').toContain('The quota has been exceeded.');
    // The whole point of saying it: the choices are still here, and the screen
    // has to still be the wizard for that to be worth anything.
    expect(shown(), 'the wizard navigated away from work it had not saved').toContain(
      'Create character',
    );
    expect(created, 'the screen reported a character it had not created').toBe(0);
    expect(useApp.getState().characters, 'a character reached the library anyway').toEqual([]);
  });

  it('leaves Create pressable again, and answers the second press too', async () => {
    // `press` refuses a disabled button, so this also pins the in-flight guard
    // being released on the failing side: a button that stayed disabled after
    // a refusal would be a wizard nobody can ever finish.
    const put = vi
      .spyOn(db, 'putCharacter')
      .mockRejectedValueOnce(new Error('the disk fell off'))
      .mockRejectedValueOnce(new Error('the socket came loose'));
    walkToCreate();

    press('Create character');
    await act(async () => {
      await Promise.resolve();
    });
    expect(shown()).toContain('the disk fell off');

    press('Create character');
    await act(async () => {
      await Promise.resolve();
    });

    expect(put.mock.calls.length, 'the second attempt never reached the disk').toBe(2);
    expect(shown(), 'the second refusal was not reported').toContain('the socket came loose');
    expect(shown(), 'the first refusal was still on screen after a second attempt').not.toContain(
      'the disk fell off',
    );
  });
});

describe('two taps on a slow phone', () => {
  it('writes one character, not two', async () => {
    // A write that never answers: exactly the window a double-tap lands in.
    const put = vi.spyOn(db, 'putCharacter').mockReturnValue(new Promise<void>(() => {}));
    walkToCreate();

    const button = buttons().find((b) => (b.textContent ?? '').includes('Create character'))!;
    // Both inside one act(), which is what a double-tap is: React has not
    // re-rendered between them, so `disabled` is not yet on the element and
    // nothing but a synchronous guard can tell the second tap apart.
    act(() => {
      button.click();
      button.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(put.mock.calls.length, 'a double-tap persisted the character twice').toBe(1);
  });

  it('says the write is happening while it is happening', async () => {
    vi.spyOn(db, 'putCharacter').mockReturnValue(new Promise<void>(() => {}));
    walkToCreate();

    press('Create character');
    await act(async () => {
      await Promise.resolve();
    });

    const button = buttons().find((b) => (b.textContent ?? '').includes('Creating'));
    expect(button, 'the button said nothing about the write it had started').toBeDefined();
    expect(button?.disabled, 'the button was still pressable mid-write').toBe(true);
  });
});

/**
 * The name, against the library this character is about to join.
 *
 * Creation was the door with no guard of any kind. `Wizard.tsx` set the draft
 * name, `creation.ts` warned only when it was empty, and `state.create()`
 * compared nothing - so making a second Ilya from the wizard took one tap and
 * the header's `<select>` grew two rows nobody can tell apart. That is the
 * exact state `merge.ts` spends a paragraph preventing when a *file* arrives.
 *
 * What is asserted here is that this door refuses the same things as the rename
 * control in `rename.test.tsx`, in the same words - both call `judgeName` - and
 * that it refuses them where the typing is rather than only at step twelve.
 */
describe('a name the library already has', () => {
  const nameField = (): HTMLInputElement => {
    const label = [...container.querySelectorAll('label')].find(
      (l) => l.querySelector('span')?.textContent === 'Name',
    );
    expect(label, 'the wizard draws no field captioned "Name"').toBeDefined();
    return label!.querySelector('input')!;
  };

  /** Through the native setter, or React never hears the change. */
  const type = (value: string): void => {
    const input = nameField();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const seed = (...names: string[]): void => {
    act(() => {
      useApp.setState({
        characters: names.map((name, i) => makeCharacter({ id: `sheet-${String(i)}`, name })),
      });
    });
  };

  const open = (): void => {
    act(() => {
      root.render(createElement(Wizard));
    });
  };

  const next = (): HTMLButtonElement =>
    buttons().find((b) => (b.textContent ?? '').trim() === 'Next')!;

  it('refuses it in the same words the rename control uses, and holds the step', () => {
    seed('Ilya');
    open();
    press('Test Class');
    expect(next().disabled, 'the step was already refusing before a name was typed').toBe(false);

    type('  ILYA ');
    expect(shown()).toContain('Another character is already called "Ilya".');
    expect(next().disabled, 'Next let a duplicate name past the step it is typed on').toBe(true);
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
    const describedBy = nameField().getAttribute('aria-describedby');
    expect(describedBy, 'the field points at no reason for refusing').not.toBeNull();
    expect(document.getElementById(describedBy!)?.textContent).toContain('already called "Ilya"');
  });

  it('takes the refusal back off when the name stops colliding', () => {
    seed('Ilya');
    open();
    press('Test Class');
    type('Ilya');
    expect(next().disabled).toBe(true);
    type('Marek');
    expect(next().disabled).toBe(false);
    expect(nameField().getAttribute('aria-invalid')).toBe('false');
  });

  it('offers the next free name into the field, and writes nothing on its own', () => {
    seed('Ilya');
    open();
    press('Test Class');
    type('Ilya');
    pressLabelled('Put Ilya (2) in the name field');
    expect(nameField().value).toBe('Ilya (2)');
    expect(useApp.getState().characters, 'the offer created something').toHaveLength(1);
    expect(next().disabled).toBe(false);
  });

  it('will not create a second character reading Unnamed, and leaves the first alone', () => {
    // The same strictness the rename door has, from the same function: an empty
    // name is a name like any other. Refused when something else already reads
    // that way, and left alone when nothing does - the app never writes its own
    // word onto somebody's record.
    seed('');
    open();
    press('Test Class');
    expect(shown()).toContain('both would read "Unnamed"');
    expect(next().disabled).toBe(true);

    seed('Ilya');
    open();
    press('Test Class');
    expect(shown(), 'an unnamed draft was refused against a library with no unnamed character in it')
      .not.toContain('both would read "Unnamed"');
    expect(next().disabled).toBe(false);
  });

  it('refuses the last button too, and says which step the name belongs to', () => {
    /*
     * Next answers for the step you are standing on; Create answers for every
     * blocker at once. They are not the same guard and the difference is
     * reachable: the library can change while the wizard is open - an import
     * lands, another tab writes - and the person is then on step twelve with a
     * name that was free when they typed it and is not any more. Nothing on
     * that screen is the Name field, so the refusal has to name the step.
     */
    seed();
    open();
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      const id = STEPS[i]!.id;
      if (id === 'class') {
        press('Test Class');
        type('Ilya');
      }
      if (id === 'traits') assignTheArray();
      press('Next');
    }
    seed('Ilya');

    const create = buttons().find((b) => (b.textContent ?? '').includes('Create character'))!;
    expect(create.disabled, 'Create wrote a character the first step would have refused').toBe(
      true,
    );
    expect(shown()).toContain('Another character is already called "Ilya".');
    expect(shown(), 'the blocker never named the step it belongs to').toContain('Step 1');
  });
});
