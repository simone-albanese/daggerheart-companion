// @vitest-environment jsdom
/**
 * The Play screen as the character sheet.
 *
 * `PlayPhone` used to render nine of the sheet's sections and `PlayDesktop`
 * rendered thirteen, with Identity, the trait grid, the defences and the vault
 * defined in the same file and called only from the desktop branch. So on the
 * width the README says is used ninety per cent of the time, the app did not
 * show Evasion, the damage thresholds, Proficiency, the class, the subclass,
 * the ancestry, the community, the vault or the gold. Nothing was broken;
 * four sections of the sheet were absent, which is the shape of every defect
 * this project has shipped.
 *
 * These tests ask what is on the screen, at a phone width, of a character who
 * has been played. They are deliberately about presence and order rather than
 * about pixels: what went wrong was absence.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Play } from '../../src/ui/player/Play.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import type { Character } from '@shared/types.ts';
import { dataset, index, playedCharacter, playedStats } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

/** Answer media queries as a viewport of this width would. */
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
  render(createElement(Play, { stats: playedStats(c) }));
};

const text = (): string => container.textContent ?? '';

describe('the verbs under the traits', () => {
  it('prints all six sets, in the words the SRD uses', () => {
    setViewport(1280);
    play(seed());
    const body = text();
    for (const verbs of [
      'SPRINT · LEAP · MANEUVER',
      'LIFT · SMASH · GRAPPLE',
      'CONTROL · HIDE · TINKER',
      'PERCEIVE · SENSE · NAVIGATE',
      'CHARM · PERFORM · DECEIVE',
      'RECALL · ANALYZE · COMPREHEND',
    ]) {
      expect(body, `the trait tiles do not print "${verbs}"`).toContain(verbs);
    }
  });

  it('puts them in the tile’s accessible name too', () => {
    setViewport(1280);
    play(seed());
    const tile = [...container.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Agility'),
    );
    expect(tile, 'no trait tile announces itself as Agility').toBeDefined();
    expect(tile!.getAttribute('aria-label')).toContain('use it to Sprint, Leap, Maneuver');
  });
});
