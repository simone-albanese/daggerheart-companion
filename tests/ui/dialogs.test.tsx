// @vitest-environment jsdom
/**
 * Six overlays that said they were dialogs, and the three things they did not do.
 *
 * `role="dialog"` and `aria-modal="true"` were on all six. Neither attribute
 * does anything on its own: `aria-modal` is a claim made to a screen reader
 * that nothing outside the node exists, and the browser was never told the same
 * thing. So Tab walked out of the panel and off down the page underneath it -
 * the tab bar, the header, every control the overlay was drawn over - opening
 * one left focus on the button behind it, and closing one dropped focus to the
 * top of the document. That is the app claiming something that is not true of
 * the code behind it, in the markup, six times.
 *
 * `useDialog` is one hook and it is not what this file tests. A hook that is
 * right and reaches four of the six overlays is the exact defect this repo has
 * shipped four times over, so the claim under test is per dialog and it is
 * "this one is routed through it": each is opened the way a person opens it,
 * through the exported component that owns the control, and then asked the same
 * four questions. Nothing here imports the hook.
 *
 * What each question means:
 *
 *   - focus moves in. Five of the six land on the dialog element itself, so a
 *     screen reader announces the dialog's name and Tab then walks the panel
 *     from the top; the gear picker lands on its own search box, which carries
 *     `autoFocus` on a desktop and is a decision the picker gets to keep.
 *   - Tab wraps at the last stop and Shift+Tab wraps at the first. Between the
 *     two there is no way out of the panel with the keyboard, which is what
 *     `aria-modal` had been promising.
 *   - Escape closes it and focus goes back to the control that opened it, still
 *     on screen, rather than to the top of the document.
 *   - and it still SAYS `aria-modal="true"`, which is the sentence the two Tab
 *     questions above make true.
 *
 * That fourth question is here because the guard that used to hold it was a
 * type and the type was widened. `DialogProps['aria-modal']` was the literal
 * `true` until `GmSheet` needed a dialog that deliberately does not own the
 * document; widening it to `boolean` left nothing at all asserting the
 * attribute on these six - a build returning `false` for every caller was green
 * across the whole suite. `useDialog` carries a narrowed type again for the
 * call sites, but a type cannot watch the line that builds the object, so the
 * attribute is asked for HERE, per dialog, through the component a person
 * opens, on the same six this file already enumerates. It is one list, not two:
 * a second enumeration somewhere else is how the seventh dialog gets missed.
 *
 * It is asserted as the string `"true"` rather than as truthiness. `aria-modal`
 * is an ARIA attribute, not a boolean DOM one: `"false"` and an omission are
 * both different from `"true"` and only one of the three is the claim, so
 * `getAttribute` is what can tell all three apart.
 *
 * jsdom moves no focus of its own - it implements neither Tab nor the browser's
 * sequential navigation - so everything asserted here is the app's own work.
 * The flip side is that a Tab in the middle of the list does nothing at all in
 * this environment, which is why the two assertions are at the edges: the edges
 * are the only places the app is meant to intervene.
 */
import 'fake-indexeddb/auto';
import { useState, act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { deriveStats, newCharacter } from '@engine/character.ts';
import { newCompanion } from '../../src/engine/companion.ts';
import { useApp } from '../../src/store/state.ts';
import type { Rng } from '../../src/engine/dice.ts';
import { WeaponPicker } from '../../src/ui/build/GearPicker.tsx';
import { Beastform } from '../../src/ui/player/Beastform.tsx';
import { CompanionPanel } from '../../src/ui/player/Companion.tsx';
import { ActiveConditions } from '../../src/ui/player/Conditions.tsx';
import { DeathMoveOffer } from '../../src/ui/player/DeathMove.tsx';
import { CardReader } from '../../src/ui/shared/DomainCardView.tsx';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // A desktop, so the gear picker's search box takes its `autoFocus` - the one
  // case here where the dialog itself decides where focus lands.
  window.matchMedia = ((query: string) =>
    ({
      matches: /min-width/.test(query),
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
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The dice the gear picker requires, which this file never rolls: it walks
 * focus stops and presses Escape. Throwing keeps a tab order sweep that starts
 * clicking from equipping a weapon by accident, the way `Rest.tsx`'s preview
 * RNG does for a render.
 */
const neverRolls: Rng = () => {
  throw new Error('nothing in this file may roll for gear');
};

function seed(character: Character): void {
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/**
 * Returns the event, because half of what a trap does is refuse the key.
 *
 * jsdom moves no focus on Tab, so "focus is still where I put it" is true of a
 * page that traps nothing at all. `defaultPrevented` is the part that is not
 * ambiguous: it says the app took the keystroke away from the browser, which in
 * a browser is the difference between wrapping and walking out.
 */
const press = (key: string, shiftKey = false): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, shiftKey, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

/**
 * What this file means by a tab stop. Stated here rather than imported from the
 * hook on purpose: if the two ever disagree about what a keyboard can land on,
 * that is worth a failure rather than a shared constant hiding it.
 */
const STOPS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const dialog = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="dialog"]');
  if (el === null) throw new Error('nothing on screen carries role="dialog"');
  return el;
};

const stops = (): HTMLElement[] => [...dialog().querySelectorAll<HTMLElement>(STOPS)];

/**
 * A button and something behind it, for the two dialogs that are handed their
 * open state rather than owning it - the reader is opened by the shell and the
 * gear picker by Edit and the wizard, and both are already covered as screens.
 * The shape is theirs: a control, and `{open && <Dialog onClose={close} />}`.
 */
function Harness({
  children,
}: {
  children: (close: () => void) => ReactElement;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        OPEN
      </button>
      {open && children(() => setOpen(false))}
    </>
  );
}

interface Case {
  /** Seeds the store and returns what to mount. */
  mount: () => ReactElement;
  /** The control a person presses to open it, once mounted. */
  opener: () => HTMLElement;
  /** Where focus is supposed to be the moment it is open. */
  lands: () => Element;
}

const byLabel = (label: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (el === null) throw new Error(`no control labelled "${label}"`);
  return el;
};

const byText = (text: string): HTMLElement => {
  const el = [...container.querySelectorAll<HTMLElement>('button')].find((b) =>
    (b.textContent ?? '').includes(text),
  );
  if (el === undefined) throw new Error(`no button saying "${text}"`);
  return el;
};

/** A Druid, because Beastform is a Druid class feature and the fixture is a Bard. */
function druid(): Character {
  const klass = dataset.classes.find((c) => c.classFeatures.some((f) => f.name === 'Beastform'));
  if (!klass) throw new Error('no class in the dataset has a Beastform feature');
  const subclass = dataset.subclasses.find((s) => s.classRef === klass.id);
  return newCharacter(
    {
      name: 'Ilya',
      classRef: klass.id,
      subclassRefs: subclass ? [subclass.id] : [],
      level: 3,
      traits: { agility: 1, strength: 0, finesse: 2, instinct: 1, presence: 0, knowledge: -1 },
    },
    index,
  );
}

const CASES: Record<string, Case> = {
  'the card reader': {
    mount: () => {
      seed(playedCharacter());
      const card = dataset.domainCards[0]!;
      return (
        <Harness>{(close) => <CardReader card={card} shapes={false} onClose={close} />}</Harness>
      );
    },
    opener: () => byText('OPEN'),
    lands: () => dialog(),
  },

  'the gear picker': {
    mount: () => {
      const character = playedCharacter();
      seed(character);
      return (
        <Harness>
          {(close) => (
            <WeaponPicker
              rng={neverRolls}
              slot="primary"
              value={null}
              sheet={character}
              stats={playedStats(character)}
              onPick={() => {}}
              onClose={close}
            />
          )}
        </Harness>
      );
    },
    opener: () => byText('OPEN'),
    // The one dialog that overrides the default, and the override is older than
    // the hook: the search box focuses on a desktop and never on a phone,
    // because a phone keyboard would eat half the list before it was read.
    lands: () => {
      const search = dialog().querySelector('input[type="search"]');
      if (search === null) throw new Error('the picker has no search box');
      return search;
    },
  },

  'the companion sheet': {
    mount: () => {
      const character = playedCharacter();
      seed({ ...character, companion: newCompanion('Sable', 'A grey wolf') });
      return <CompanionPanel stats={playedStats(character)} layout="desktop" />;
    },
    opener: () => byText('SHEET'),
    lands: () => dialog(),
  },

  'the conditions dialog': {
    mount: () => {
      seed(playedCharacter());
      return <ActiveConditions />;
    },
    opener: () => byLabel('Condition rules, and states you name yourself'),
    lands: () => dialog(),
  },

  'the death move dialog': {
    mount: () => {
      const character = playedCharacter();
      seed({ ...character, hp: { marked: character.hp.max, max: character.hp.max } });
      return <DeathMoveOffer />;
    },
    opener: () => byText('Last Hit Point marked'),
    lands: () => dialog(),
  },

  'the beastform picker': {
    mount: () => {
      const character = druid();
      seed(character);
      return <Beastform stats={deriveStats(character, dataset, index)} layout="desktop" />;
    },
    opener: () => byLabel('Human form — choose a Beastform'),
    lands: () => dialog(),
  },
};

for (const [name, c] of Object.entries(CASES)) {
  describe(name, () => {
    let opener: HTMLElement;

    beforeEach(() => {
      act(() => {
        root.render(c.mount());
      });
      opener = c.opener();
      // A real pointer or a real Tab leaves the control focused before the
      // click lands, and that is the element the dialog has to give it back to.
      opener.focus();
      click(opener);
    });

    it('is a focus scope, and focus is in it rather than on the button behind', () => {
      // A container with no tabindex cannot hold focus at all, which is why
      // every one of these left it outside: the box the trap is drawn around
      // was not itself a place focus could be.
      expect(dialog().getAttribute('tabindex'), 'the dialog cannot hold focus').toBe('-1');
      expect(document.activeElement, 'focus never entered the dialog').toBe(c.lands());
      expect(dialog().contains(document.activeElement)).toBe(true);
    });

    it('says `aria-modal="true"`, the sentence the wrap below makes true', () => {
      // The whole point of the two Tab tests under this one. A dialog that
      // trapped and did not say it would merely be quiet; one that says it and
      // does not trap is the defect this file was written for, and one that
      // trapped while saying `false` - which is what the widened type allowed -
      // tells a screen reader the page behind is reachable while the keyboard
      // proves it is not.
      expect(
        dialog().getAttribute('aria-modal'),
        'this dialog traps Tab and no longer claims to. `useDialog` returning anything but ' +
          '`true` here, or the attribute coming off, is a screen reader being told the page ' +
          'behind this panel is still there while the keyboard cannot reach it.',
      ).toBe('true');
    });

    it('takes Tab at the last control and wraps, rather than letting it out', () => {
      const list = stops();
      expect(list.length, 'the dialog has no controls to trap').toBeGreaterThan(0);
      list[list.length - 1]!.focus();
      const event = press('Tab');
      expect(event.defaultPrevented, 'Tab was left to the browser, which walks out').toBe(true);
      expect(document.activeElement, 'Tab escaped the dialog').toBe(list[0]);
    });

    it('takes Shift+Tab at the first control and wraps the other way', () => {
      const list = stops();
      list[0]!.focus();
      const event = press('Tab', true);
      expect(event.defaultPrevented, 'Shift+Tab was left to the browser').toBe(true);
      expect(document.activeElement, 'Shift+Tab escaped the dialog').toBe(list[list.length - 1]);
    });

    it('gives focus back to the control that opened it when Escape closes it', () => {
      // From inside, which is the only case that means anything: with focus
      // still on the opener - where all six used to leave it - the assertion
      // below is true of a dialog that restores nothing.
      stops()[0]!.focus();
      press('Escape');
      expect(container.querySelector('[role="dialog"]'), 'Escape did not close it').toBeNull();
      expect(document.activeElement, 'focus was dropped to the top of the document').toBe(opener);
    });
  });
}
