// @vitest-environment jsdom
/**
 * Does "reduce motion" reach the one animation CSS does not own?
 *
 * Every other moving thing in this app is a CSS transition timed by
 * `--motion`, and `base.css` zeroes that token twice over: once under
 * `@media (prefers-reduced-motion: reduce)` for the operating system's answer,
 * and once under `:root[data-reduce-motion='true']` for the switch in
 * Settings. Either is a yes.
 *
 * The section jumper is the exception. `scrollIntoView({ behavior: 'smooth' })`
 * is motion decided in JavaScript, no stylesheet can reach it, and it consulted
 * only the switch - so a person who had asked their phone for less motion, and
 * never opened Settings, got a smooth scroll here and nowhere else in the app.
 * That is the app disagreeing with a preference it otherwise honours, which is
 * the same class of defect as a sentence on screen that is not true.
 *
 * So the assertion is about the argument the DOM is actually handed, not about
 * a boolean in a component: `behavior` is the whole of the behaviour, and a
 * test that read the store would have passed against the broken code.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { Settings } from '../../src/ui/settings/Settings.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let scrolled: ReturnType<typeof vi.fn>;

/**
 * A desktop viewport that either does or does not ask for reduced motion.
 *
 * jsdom has no `matchMedia` at all, so this is the only thing standing in for
 * a real device here. Width answers false everywhere, which puts Settings in
 * its desktop layout - the one with the section nav down the left, whose six
 * buttons are what fire the jump.
 */
function setMedia(reducedMotion: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reducedMotion : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled as unknown as Element['scrollIntoView'];
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [],
    activeId: null,
    screen: 'settings',
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

async function mount(): Promise<void> {
  await act(async () => {
    root.render(<Settings />);
  });
  // The backup panel reads storage and the folder permission on mount; let
  // those settle so the click below lands on a tree that has stopped moving.
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** The section nav button that says this, as a reader would find it. */
function jumpTo(label: string): void {
  const button = [...container.querySelectorAll('nav button')].find(
    (el) => (el.textContent ?? '').trim() === label,
  );
  if (!(button instanceof HTMLElement)) throw new Error(`no "${label}" section button rendered`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** What `behavior` the jump actually asked the DOM for. */
function behavior(): string | undefined {
  expect(scrolled, 'the jump never scrolled anything').toHaveBeenCalled();
  const [options] = scrolled.mock.calls.at(-1) as [ScrollIntoViewOptions];
  return options.behavior;
}

describe('the settings section jumper', () => {
  it('scrolls instantly when the device asks for reduced motion', async () => {
    setMedia(true);
    // The app's own switch is off. This is the whole point: the person never
    // opened Settings, they told their phone once, years ago.
    expect(useApp.getState().prefs.reduceMotion).toBe(false);

    await mount();
    jumpTo('Dice');

    expect(behavior()).toBe('auto');
  });

  it('still scrolls smoothly when nobody has asked for less', async () => {
    setMedia(false);

    await mount();
    jumpTo('Dice');

    // Without this the test above would pass just as happily against a jumper
    // that had been hard-coded to 'auto', which is a different app.
    expect(behavior()).toBe('smooth');
  });

  it('honours the app switch on a device that is not asking', async () => {
    setMedia(false);
    act(() => {
      useApp.getState().setPrefs({ reduceMotion: true });
    });
    try {
      await mount();
      jumpTo('Dice');
      expect(behavior()).toBe('auto');
    } finally {
      act(() => {
        useApp.getState().setPrefs({ reduceMotion: false });
      });
    }
  });
});

describe('the reduce motion switch', () => {
  /**
   * A switch reading OFF beside an app that is not animating looks broken, and
   * "OFF" would be a false statement about what the app is doing. It is not
   * off - the device answered the question first - so the row says so.
   */
  it('says the device has already answered, rather than reading OFF into a lie', async () => {
    setMedia(true);
    await mount();

    expect(container.textContent ?? '').toContain('already set to reduce motion');
  });

  it('does not say it on a device that has not', async () => {
    setMedia(false);
    await mount();

    expect(container.textContent ?? '').not.toContain('already set to reduce motion');
    // And the row is still there, so the assertion above is not passing
    // because Display failed to render at all.
    expect(container.textContent ?? '').toContain('Reduce motion');
  });
});
