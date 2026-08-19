// @vitest-environment jsdom
/**
 * Can a player actually switch the GM section off, and does the screen say what
 * that costs?
 *
 * Four preferences belong to the GM screen - the section itself and the three
 * doors behind SHOW. None of them is as old as the screen: the GM screen
 * shipped with no switch at all, three of the four arrived a day later with the
 * section switch that this file arrived with, and the merchant's arrived with
 * the merchant. A preference nothing can change is the same defect as a feature
 * nothing calls: it typechecks, it has a default, and no person in the world
 * can reach it. So the first question here is the dull one, asked of all four:
 * does the control on the screen write the field.
 *
 * The second is about the three that depend on the first. With the section off,
 * the bestiary, the party board and the merchant decide nothing at all, and a
 * live switch that decides nothing is a control making a promise the app cannot
 * keep. They are disabled, and the row says what they are waiting for rather
 * than leaving a person to work out why nothing happened.
 *
 * `tests/ui/settingsHints.test.tsx` covers the sentence-to-control wiring for
 * the same four rows; this file is about what the switches do. ("The same
 * three rows" was true and was widened to "the same rows" when the merchant
 * arrived without being added there, which made it false; the row is there
 * now, so the count is back and it is four.)
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, type Prefs } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

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
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [],
    activeId: null,
    screen: 'settings',
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  // The store is a module singleton and `setPrefs` also writes localStorage.
  useApp.setState({ prefs: { ...DEFAULT_PREFS } });
});

async function mount(prefs: Partial<Prefs> = {}): Promise<void> {
  act(() => {
    useApp.setState({ prefs: { ...DEFAULT_PREFS, ...prefs } });
  });
  await act(async () => {
    root.render(<Settings />);
  });
  // The backup section probes storage, the folder permission and the service
  // worker on mount; let all of that land before anything is read back.
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** The switch a person would find by this name, wherever it sits on the page. */
function toggle(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find(
    (el) => el.getAttribute('aria-label') === label,
  );
  if (found === undefined) {
    throw new Error(
      `no switch called "${label}". Here: ${[...container.querySelectorAll('[role="switch"]')]
        .map((el) => el.getAttribute('aria-label'))
        .join(' | ')}`,
    );
  }
  return found;
}

const press = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const text = (): string => container.textContent ?? '';

describe('the GM tools section', () => {
  it('writes each of its four preferences from its own switch', async () => {
    await mount();

    press(toggle('The GM section'));
    expect(useApp.getState().prefs.gmSection).toBe(false);

    // Back on, so the three below are live controls rather than disabled ones.
    press(toggle('The GM section'));
    expect(useApp.getState().prefs.gmSection).toBe(true);

    press(toggle('Bestiary'));
    expect(useApp.getState().prefs.gmBestiary).toBe(false);

    press(toggle('The party board'));
    expect(useApp.getState().prefs.gmPartyBoard).toBe(false);

    press(toggle('The merchant'));
    expect(useApp.getState().prefs.gmMerchant).toBe(false);
  });

  it('reports the state it is in, in words as well as position', async () => {
    await mount({ gmSection: false });
    expect(toggle('The GM section').getAttribute('aria-checked')).toBe('false');
    expect(toggle('The GM section').textContent).toContain('OFF');
  });

  it('stops the three tools deciding anything while the section is off, and says so', async () => {
    await mount({ gmSection: false });

    expect(toggle('Bestiary').disabled, 'a switch that changes nothing was left live').toBe(true);
    expect(toggle('The party board').disabled).toBe(true);
    expect(toggle('The merchant').disabled).toBe(true);
    expect(text()).toContain('these three decide nothing until it is back on');
  });

  it('leaves them live while the section is on', async () => {
    await mount();
    expect(toggle('Bestiary').disabled).toBe(false);
    expect(toggle('The party board').disabled).toBe(false);
    expect(toggle('The merchant').disabled).toBe(false);
  });

  it('says what the GM screen loses when every door is off', async () => {
    // The same idiom as the two dice switches: the honest case where every one
    // of a set is off is stated rather than quietly prevented - and here it is a
    // visible consequence, because SHOW leaves the bar the GM presses all
    // evening and the other two verbs take the width.
    await mount({ gmBestiary: false, gmPartyBoard: false, gmMerchant: false });
    expect(text()).toContain('SHOW has nothing left to open');
    // And the rules search is on that sheet, so this has to say that it goes
    // with it: a GM who reads only this row would otherwise switch the tools
    // off and lose a third thing nobody mentioned.
    expect(text()).toContain('The rules search lives on that sheet, so it goes with it');

    // Two off is not all off, and this is the assertion that would have caught
    // the notice being left on a hardcoded pair when the third door arrived:
    // `!gmBestiary && !gmPartyBoard` is true here and the notice must not be.
    await mount({ gmBestiary: false, gmPartyBoard: false });
    expect(
      text(),
      'the notice claimed SHOW had left the bar while the merchant was still behind it',
    ).not.toContain('SHOW has nothing left to open');

    await mount({ gmBestiary: false });
    expect(text()).not.toContain('SHOW has nothing left to open');
  });
});
