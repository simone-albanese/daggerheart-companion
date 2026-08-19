// @vitest-environment jsdom
/**
 * Is the sentence explaining a setting attached to the setting it explains?
 *
 * A settings row is a name, a sentence and a control, and this app leans on the
 * sentence harder than most: it is where the screen says what persistent
 * storage is for, that an installed iOS app opens with empty storage, and that
 * a whole-library import can overwrite an edit. None of that is decoration -
 * every one of those rows is a choice a person can only make sensibly if they
 * read the sentence first.
 *
 * `aria-describedby` appeared nowhere in `src` or `tests`. The hint was a bare
 * `<div>` with no id, and the control beside it carried an `aria-label` and
 * nothing else, so a screen reader tabbing the settings screen heard "Ask the
 * browser, button" and never the paragraph saying what the browser is being
 * asked. The prose was on the page and unreachable from the control, which is
 * the same defect as prose that is not there.
 *
 * Two halves are tested, because they fail differently:
 *
 *   - the mechanism, on `Field` itself: an id that resolves, a fresh one per
 *     row, and *no* attribute at all when there is no hint or no `Field`,
 *     because an `aria-describedby` pointing at nothing is worse than none;
 *   - the real screen, by mounting `Settings` and reading out what each named
 *     control is actually described by. A test that only exercised `Field`
 *     would pass with every call site still using a bare `<button>`, which is
 *     precisely how most of these rows were built.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { Action, Choice, Field, Rows, Switch } from '../../src/ui/settings/parts.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

const noop = (): void => {};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  Element.prototype.scrollIntoView = (): void => {};
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function render(element: React.ReactElement): Promise<void> {
  await act(async () => {
    root.render(element);
  });
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/**
 * What a screen reader would read out as this control's description.
 *
 * `getElementById` and not a `querySelector`: React 19's `useId` puts
 * guillemets in the value, which are legal in an id and are not legal in a CSS
 * selector. Resolving the ids is the point of the helper anyway - an
 * `aria-describedby` naming an element that is not on the page announces
 * nothing at all, and looks identical in the markup to one that works.
 */
function describedBy(control: Element): string | null {
  const attr = control.getAttribute('aria-describedby');
  if (attr === null) return null;
  return attr
    .split(/\s+/)
    .map((id) => {
      const target = document.getElementById(id);
      expect(target, `aria-describedby names "${id}", which is on no element`).not.toBeNull();
      return target?.textContent ?? '';
    })
    .join(' ');
}

/** The control a person would identify by this word, however it is named. */
function control(name: string): Element {
  const found = [...container.querySelectorAll('button, [role="group"], [role="switch"]')].find(
    (el) => el.getAttribute('aria-label') === name || (el.textContent ?? '').trim() === name,
  );
  if (found === undefined) throw new Error(`no control called "${name}" on the page`);
  return found;
}

// ---------------------------------------------------------------------------
// The mechanism
// ---------------------------------------------------------------------------

describe('a settings row', () => {
  it('describes its switch with its own hint', async () => {
    await render(
      <Field label="Reduce motion" hint="This removes what is left.">
        <Switch checked={false} onChange={noop} label="Reduce motion" />
      </Field>,
    );

    expect(describedBy(control('Reduce motion'))).toBe('This removes what is left.');
  });

  it('describes its choice with its own hint', async () => {
    await render(
      <Field label="Theme" hint="System follows whatever the device is doing.">
        <Choice value="a" onChange={noop} options={[['a', 'A']]} label="Theme" />
      </Field>,
    );

    expect(describedBy(control('Theme'))).toBe('System follows whatever the device is doing.');
  });

  it('describes a button with its own hint, which no context reaches on its own', async () => {
    // The case that decided the shape of the fix. A DOM `<button>` consumes no
    // React context, so a Field that only fed Switch and Choice would have
    // covered seven rows here and skipped seventeen.
    await render(
      <Field label="Import a file" hint="A .dhchar or a .dhbackup.">
        <Action onClick={noop}>Choose a file</Action>
      </Field>,
    );

    expect(describedBy(control('Choose a file'))).toBe('A .dhchar or a .dhbackup.');
  });

  it('gives each row its own id rather than one shared between them', async () => {
    await render(
      <Rows>
        <Field label="First" hint="The first sentence.">
          <Action onClick={noop}>One</Action>
        </Field>
        <Field label="Second" hint="The second sentence.">
          <Action onClick={noop}>Two</Action>
        </Field>
      </Rows>,
    );

    expect(describedBy(control('One'))).toBe('The first sentence.');
    expect(describedBy(control('Two'))).toBe('The second sentence.');
  });

  it('leaves the attribute off entirely when there is no hint to point at', async () => {
    await render(
      <Field label="No characters yet">
        <Action onClick={noop}>Export</Action>
      </Field>,
    );

    // Not an empty string and not a dangling id: an `aria-describedby` naming
    // nothing is announced as nothing, and hides the absence in the markup.
    expect(
      control('Export').hasAttribute('aria-describedby'),
      'a hintless row still handed its control an id, which points at no element on the page',
    ).toBe(false);
  });

  it('leaves it off for a control mounted with no row above it', async () => {
    // `tests/ui/screens.test.tsx` mounts all three of these on their own. The
    // context default has to survive that without a provider and without a
    // React warning.
    await render(
      <>
        <Switch checked onChange={noop} label="Loose switch" />
        <Choice value="a" onChange={noop} options={[['a', 'A']]} label="Loose choice" />
        <Action onClick={noop}>Loose button</Action>
      </>,
    );

    for (const name of ['Loose switch', 'Loose choice', 'Loose button']) {
      expect(control(name).hasAttribute('aria-describedby'), name).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// The real screen
// ---------------------------------------------------------------------------

describe('the settings screen', () => {
  beforeEach(() => {
    const character = playedCharacter();
    useApp.setState({
      ready: true,
      storageError: null,
      dataset,
      index,
      characters: [character],
      activeId: character.id,
      screen: 'settings',
      log: [],
      openCard: null,
    });
  });

  /**
   * Control, and a phrase from the sentence that has to reach it.
   *
   * Named by the words on screen rather than by an index, so this list stays
   * legible next to the screen it describes - and so a row that is renamed
   * fails here rather than silently stopping being covered.
   */
  const ROWS: Array<[control: string, sentence: string]> = [
    ['Theme', 'System follows whatever the device is doing'],
    ['Reduce motion', 'Nothing in this app animates'],
    ['Show the shapes', 'Each domain has a silhouette'],
    ['Keep the screen awake', 'no wake lock'],
    ['Digital dice', 'the app rolls 2d12 for you'],
    ['Type your own dice', 'Tap either die on the Play screen'],
    ['Massive Damage rule', 'twice your Severe threshold'],
    /*
     * The four GM switches - the section and the three doors behind SHOW. Their
     * names are deliberately not the words on the
     * section heading: `control()` below takes the first match in DOM order and
     * the desktop section nav - which this file renders, because its
     * `matchMedia` answers false to every query - carries each section's title
     * as the text of a button. A switch labelled "GM tools" under a section
     * called "GM tools" would resolve to that nav button, which carries no
     * description at all, and the row would fail for a reason that has nothing
     * to do with the hint being attached.
     */
    ['The GM section', 'Nothing is deleted'],
    ['Bestiary', 'without adding any of them to tonight'],
    ['The party board', 'the player sheets sent to this device'],
    ['The merchant', 'never spends anybody’s gold'],
    ['Choose a file', 'A .dhchar or a .dhbackup'],
    ['Ask the browser', 'Browsers reclaim storage from sites'],
    ['Paste from clipboard', 'Copying from here is the first half'],
    ['Copy to clipboard', 'Puts every character on the clipboard'],
  ];

  for (const [name, sentence] of ROWS) {
    it(`reads "${name}" out with the sentence that explains it`, async () => {
      await render(<Settings />);
      const heard = describedBy(control(name));
      expect(
        heard,
        `"${name}" carries no aria-describedby at all, so a screen reader announces the ` +
          'control and never the sentence beside it',
      ).not.toBeNull();
      expect(heard).toContain(sentence);
    });
  }

  it('names the character an Export button belongs to, and says what it is', async () => {
    await render(<Settings />);
    // Two characters in a library give two buttons reading "Export", and the
    // row's own hint is the only thing saying which sheet is which.
    const button = control('Export Fixture');
    expect(describedBy(button)).toContain('level 3');
  });

  it('tells the backup button how old the backup it is replacing is', async () => {
    await render(<Settings />);
    // This button is not in a row - it is in the health panel above them - so
    // it takes its two ids by hand. Without them "Back up everything, button"
    // is the whole announcement, and the forty-days-ago that is the entire
    // reason to press it is on screen and unreachable.
    expect(describedBy(control('Back up everything'))).toContain('Last backup');
  });

  it('leaves no description pointing at an element that is not there', async () => {
    await render(<Settings />);
    // `describedBy` asserts each id resolves, so this is the sweep: every
    // reference on the whole screen, including the ones in sections this
    // change did not touch.
    const referring = [...container.querySelectorAll('[aria-describedby]')];
    expect(referring.length, 'nothing on the settings screen is described at all').toBeGreaterThan(
      10,
    );
    for (const el of referring) {
      expect(describedBy(el)?.trim(), el.outerHTML.slice(0, 120)).not.toBe('');
    }
  });
});
