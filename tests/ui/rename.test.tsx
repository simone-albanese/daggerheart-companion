// @vitest-environment jsdom
/**
 * The unique-name rule, seen through the control that enforces it.
 *
 * `merge.ts:63-75` states the rule and argues for it: the character picker in
 * the header is a `<select>` of names, so two characters called "Ilya" are
 * indistinguishable at exactly the moment you most need to tell them apart.
 * `duplicateFor` enforced it on the import path. The rename path - the one
 * where a person types a name deliberately - enforced nothing, so renaming
 * Marek to Ilya produced by hand precisely the state that paragraph prevents
 * when a file arrives.
 *
 * `tests/store/import.test.ts` tests the rule. This tests the door: that
 * nothing is written until SAVE, that a refusal is a sentence rather than a
 * dimmed button, that the offer goes into the field instead of onto the record,
 * and that renaming to nothing stores nothing rather than the word "Unnamed".
 *
 * Two harness notes, because both have bitten this repo before.
 *
 *   `screens.test.tsx`'s `nameless()` sweeps `button, [role="button"]` and
 *   nothing else. It has never looked at an `<input>`, so this file is the only
 *   thing standing between the rename field and a control a screen reader
 *   announces as "edit text, blank".
 *
 *   jsdom does not notify React when `input.value` is assigned directly, so
 *   `type()` below goes through the native setter and dispatches the event
 *   React actually listens for. Without that every typing test here would
 *   assert against an unchanged field and pass for the wrong reason.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Edit } from '../../src/ui/build/Edit.tsx';
import { RenameField } from '../../src/ui/shared/RenameField.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let done = 0;

/** Answer media queries as a 393px phone would: coarse pointer, --control = 44. */
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
  done = 0;
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
 * A library, first character active.
 *
 * `playSheet.test.tsx`'s `seed()` sets exactly one character, which is why the
 * refusal cannot be exercised through it: a name collides with nobody in a
 * library of one. Every field the store is booted with is set explicitly rather
 * than left to a default, so a change to the store's initial state cannot
 * quietly change what these tests are running against.
 */
function seed(...names: string[]): Character[] {
  const characters = names.map((name, i) => ({ ...playedCharacter(), id: `sheet-${i}`, name }));
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters,
    activeId: characters[0]!.id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
  return characters;
}

/** The Play door: a field, a SAVE and a cancel. */
const openRename = (): void => {
  render(createElement(RenameField, { onDone: () => (done += 1) }));
};

const field = (): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('input[aria-label="Character name"]')!;

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const byLabel = (prefix: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(prefix));

const save = (): HTMLButtonElement =>
  buttons().find((b) => (b.textContent ?? '').trim() === 'SAVE')!;

const cancel = (): HTMLButtonElement => byLabel('Leave the name as')!;

const offer = (): HTMLButtonElement | undefined => byLabel('Put ');

const text = (): string => container.textContent ?? '';

const stored = (): string => useApp.getState().characters[0]!.name;

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const press = (el: Element, key: string): void => {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
};

function type(value: string): void {
  const input = field();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('what the rename control writes, and when', () => {
  it('writes nothing while the name is being typed', () => {
    // The Name field in `Edit.tsx`'s Identity section bound `onChange` straight
    // to `patch({ name })`, which stamps `updatedAt` once per character typed -
    // and `updatedAt` is what `decideImport` compares, so one rename made the
    // local copy win twenty comparisons against a sheet that was genuinely
    // newer. It also makes "that name is taken" fire in the middle of a word.
    seed('Fixture');
    openRename();
    for (const partial of ['M', 'Ma', 'Marek']) {
      type(partial);
      expect(stored(), `the store was written after typing "${partial}"`).toBe('Fixture');
    }
    click(save());
    expect(stored()).toBe('Marek');
    expect(done).toBe(1);
  });

  it('trims what it writes, so a trailing space is not a second name', () => {
    seed('Fixture');
    openRename();
    type('  Marek  ');
    click(save());
    expect(stored()).toBe('Marek');
  });

  it('stores an inner run of spaces the way it was typed', () => {
    // The guard collapses inner runs to decide whether two names are the same;
    // the write does not. Being stricter about collisions than about storage
    // can only refuse a name nobody would have confused - never the reverse.
    seed('Fixture');
    openRename();
    type('Il  ya');
    click(save());
    expect(stored()).toBe('Il  ya');
  });

  it('tells the keyboard not to rewrite the name after it has been typed', () => {
    // The guard refuses and offers; it never substitutes. None of that reaches
    // iOS, which puts a dictionary word in place of a fantasy name on the space
    // or on blur - "Thren" typed, "Then" stored - after the characters are
    // already on the glass, which is what makes it silent. It is the one route
    // by which this field can break its own rule, and the rule is the reason
    // the field exists.
    seed('Fixture');
    openRename();
    expect(field().getAttribute('autocorrect')).toBe('off');
    expect(field().getAttribute('autocomplete')).toBe('off');
    expect(field().getAttribute('spellcheck')).toBe('false');
    // Set, not removed, and not `off`: a virtual keyboard's shift state is the
    // one hint here that never replaces a character already typed.
    expect(field().getAttribute('autocapitalize')).toBe('words');
  });

  it('lets a character keep its own name', () => {
    // Without `except`, the character collides with itself and SAVE can never
    // be pressed at all.
    seed('Fixture');
    openRename();
    expect(save().disabled).toBe(false);
    click(save());
    expect(stored()).toBe('Fixture');
    expect(done).toBe(1);
  });

  it('leaves the name alone on cancel', () => {
    seed('Fixture');
    openRename();
    type('Marek');
    click(cancel());
    expect(stored()).toBe('Fixture');
    expect(done).toBe(1);
  });

  it('writes nothing when the sheet’s field loses focus, because that blur may be the ✕', () => {
    // The asymmetry with the Build door, from the side nothing was asking
    // about. On the sheet the `×` is a blur before it is a click, so a commit
    // on blur would write the name the `×` exists to abandon. The draft is
    // therefore discarded when focus leaves - the cost of that is real and is
    // written down where `commitOnBlur` is declared, rather than argued away.
    seed('Fixture');
    openRename();
    type('Marek');
    act(() => {
      field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(stored(), 'the sheet committed a name nobody pressed SAVE on').toBe('Fixture');
    expect(done, 'blurring closed the editor as though it had been finished').toBe(0);
  });

  it('leaves the name alone on Escape, and puts back what is stored', () => {
    seed('Fixture');
    openRename();
    type('Marek');
    press(field(), 'Escape');
    expect(stored()).toBe('Fixture');
    expect(done).toBe(1);
  });

  it('commits on Enter, because a name field with a keyboard open has a return key', () => {
    seed('Fixture');
    openRename();
    type('Marek');
    press(field(), 'Enter');
    expect(stored()).toBe('Marek');
  });
});

describe('a name somebody else already has', () => {
  it('refuses it, and says whose it is', () => {
    seed('Fixture', 'Ilya');
    openRename();
    type('Ilya');
    expect(text()).toContain('already called "Ilya"');
    expect(save().disabled).toBe(true);
    // The reason is on the screen, not in a hover: the `Vault` docblock in
    // `Play.tsx` writes that rule down as P3-9(a), and "says why on the screen
    // when it will not recall, not in a title" pins it on the vault.
    expect(save().getAttribute('title')).toBeNull();
    click(save());
    expect(stored()).toBe('Fixture');
  });

  it('refuses a name that differs only in case', () => {
    seed('Fixture', 'Ilya');
    openRename();
    type('ilya');
    expect(text(), 'a difference the picker cannot show was read as a difference').toContain(
      'already called "Ilya"',
    );
    expect(save().disabled).toBe(true);
  });

  it('refuses a name that differs only in space', () => {
    seed('Fixture', 'Ilya');
    openRename();
    type(' Ilya ');
    expect(text()).toContain('already called "Ilya"');
    expect(save().disabled).toBe(true);
  });

  it('says why somewhere a keyboard and a screen reader arrive, not only on the glass', () => {
    // `.btn:disabled` is `opacity: 0.45` and nothing else, which announces
    // nothing at all. This test used to ask for the sentence on the glass and
    // the same sentence in SAVE's `aria-label`, and both were true while the
    // refusal was still unreachable: SAVE is `disabled`, so Tab from the field
    // steps over it and lands on the offer - a different name suggested, with
    // nothing having said the typed one was refused. What has to hold is that
    // the refusal reaches the field the person is standing on, and that it
    // lands in a region that existed before it did.
    seed('Fixture', 'Ilya');
    openRename();

    const region = (): HTMLElement =>
      container.querySelector<HTMLElement>('[role="status"]')!;
    expect(
      container.querySelector('[role="status"]'),
      'nothing is listening when a refusal arrives under a typing thumb',
    ).not.toBeNull();
    expect(region().textContent, 'the region was mounted already refusing').toBe('');
    expect(
      field().getAttribute('aria-describedby'),
      'the field points at a refusal nobody has made',
    ).toBeNull();
    expect(field().getAttribute('aria-invalid')).toBe('false');

    type('Ilya');
    expect(text()).toContain('already called "Ilya"');
    expect(region().textContent, 'the refusal landed outside the live region').toContain(
      'already called "Ilya"',
    );
    expect(field().getAttribute('aria-invalid'), 'the field does not say it is refusing').toBe(
      'true',
    );
    const describedBy = field().getAttribute('aria-describedby');
    expect(describedBy, 'the field does not point at the reason it is refusing').not.toBeNull();
    expect(
      document.getElementById(describedBy!)?.textContent,
      'the description points at something that does not carry the reason',
    ).toContain('already called "Ilya"');

    expect(save().disabled).toBe(true);
    expect(save().getAttribute('aria-label')).toContain('already called "Ilya"');
  });

  it('takes the refusal back off the field when the name stops colliding', () => {
    // The same defect pointing the other way: a field left saying it is
    // invalid after the collision is gone is the app claiming something is
    // wrong when nothing is.
    seed('Fixture', 'Ilya');
    openRename();
    type('Ilya');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    type('Marek');
    expect(field().getAttribute('aria-invalid')).toBe('false');
    expect(field().getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('[role="status"]')!.textContent).toBe('');
  });

  it('offers the first free name and puts it in the field rather than on the record', () => {
    seed('Fixture', 'Ilya');
    openRename();
    type('Ilya');
    expect(offer(), 'the refusal offers no way forward').toBeDefined();
    expect(offer()!.getAttribute('aria-label')).toBe('Put Ilya (2) in the name field');

    click(offer()!);
    expect(field().value).toBe('Ilya (2)');
    expect(stored(), 'the offer wrote itself onto the character').toBe('Fixture');
    expect(save().disabled).toBe(false);

    click(save());
    expect(stored()).toBe('Ilya (2)');
  });

  it('does not offer the import path’s wording to somebody typing by hand', () => {
    // `duplicateFor` says "Ilya (imported)" because its job is a copy. Nothing
    // was imported here.
    seed('Fixture', 'Ilya');
    openRename();
    type('Ilya');
    expect(text()).not.toContain('imported');
  });
});

describe('renaming to nothing', () => {
  it('will not produce a second character reading Unnamed', () => {
    // P5-1(b)'s third bullet. The old comparison held raw stored strings, so
    // two characters both stored as '' collided with nothing - and both rows of
    // the header's `<select>` read "Unnamed".
    seed('Fixture', '');
    openRename();
    type('');
    expect(text()).toContain('both would read "Unnamed"');
    expect(save().disabled).toBe(true);
    expect(offer()!.getAttribute('aria-label')).toBe('Put Unnamed (2) in the name field');
  });

  it('goes through when nobody else is unnamed, and stores nothing rather than the word', () => {
    // The honesty rule on the one string the user chose personally: the app
    // prints "Unnamed" in thirteen places and does not put that word in
    // somebody's mouth by writing it onto their record.
    seed('Fixture');
    openRename();
    type('');
    expect(save().disabled).toBe(false);
    click(save());
    expect(stored()).toBe('');
    expect(stored()).not.toBe('Unnamed');
    expect(field().placeholder).toBe('Unnamed');
  });
});

/**
 * The Build sheet's Name field, which is the second door and not a second rule.
 *
 * It used to be a `LabelledInput` calling `patch({ name })` on every keystroke,
 * with no guard of any kind: renaming Marek to Ilya here produced by hand the
 * two-identical-names state `merge.ts` spends a paragraph preventing when a
 * file arrives. It is the same component as the sheet's now, so what these
 * assert is that it really is the same one - a field this query can find, a
 * refusal that appears, and nothing written while a taken name is on screen.
 */
describe('the Build sheet, the second door', () => {
  const openEdit = (): void => {
    const c = useApp.getState().characters[0]!;
    render(createElement(Edit, { stats: playedStats(c), onLevelUp: () => undefined }));
  };

  it('is the second door, not the second rule', () => {
    seed('Fixture', 'Ilya');
    openEdit();
    expect(
      container.querySelector('input[aria-label="Character name"]'),
      'Build draws no field the rename control would recognise',
    ).not.toBeNull();
    expect(text(), 'the form field lost its caption').toContain('Name');

    type('Ilya');
    expect(text()).toContain('already called "Ilya"');
    expect(save().disabled).toBe(true);
    expect(stored(), 'Build wrote a name the sheet would have refused').toBe('Fixture');
  });

  it('draws no cancel, because there is nothing here to cancel back to', () => {
    seed('Fixture');
    openEdit();
    expect(byLabel('Leave the name as')).toBeUndefined();
  });

  it('does not open a keyboard just because the screen arrived', () => {
    // The other half of the `autoFocus` argument, and the half only this door
    // can make. Play passes it because a chip was tapped to get to the field;
    // here the field is one of a form of fields nobody has pointed at yet, and
    // focusing it on mount would open a software keyboard on arrival and scroll
    // the form to wherever Identity happens to sit.
    seed('Fixture');
    openEdit();
    expect(container.querySelector('input[aria-label="Character name"]')).not.toBeNull();
    expect(document.activeElement, 'the Build form took focus on arrival').toBe(document.body);
  });

  it('does not lose a typed name to a tab tap', () => {
    // Every other field on this screen writes on the keystroke. A Name that
    // needed SAVE and nothing else would let a half-entered name disappear
    // when the component unmounts, silently, which is the one thing this
    // project's rules never allow a screen to do.
    seed('Fixture');
    openEdit();
    type('Marek');
    expect(stored(), 'Build is back to writing on every keystroke').toBe('Fixture');
    act(() => {
      field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(stored()).toBe('Marek');
  });

  it('will not commit a refused name on the way out either', () => {
    seed('Fixture', 'Ilya');
    openEdit();
    type('Ilya');
    act(() => {
      field().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(stored()).toBe('Fixture');
  });
});

describe('what the control announces', () => {
  it('names the field, the save and the cancel', () => {
    seed('Fixture');
    openRename();
    expect(field().getAttribute('aria-label')).toBe('Character name');
    expect(cancel().getAttribute('aria-label')).toBe('Leave the name as Fixture');
    type('Marek');
    expect(save().getAttribute('aria-label')).toBe('Save the name Marek');
  });

  it('says Unnamed rather than nothing when the field is empty', () => {
    seed('Fixture');
    openRename();
    type('');
    expect(save().getAttribute('aria-label')).toBe('Save the name Unnamed');
  });

  it('names the cancel after a character with no name, rather than trailing off', () => {
    seed('');
    openRename();
    expect(cancel().getAttribute('aria-label')).toBe('Leave the name as Unnamed');
  });
});
