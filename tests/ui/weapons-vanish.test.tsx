// @vitest-environment jsdom
/**
 * What the sheet does when an equipped weapon has left the build.
 *
 * This is the cost of road two in `DECISIONI-SRD-2-2026-08-31.md` §3 - "let
 * them vanish and rely on the unresolved reference" - measured on the screen
 * rather than argued from the code. The answer is that for a WEAPON there is no
 * unresolved reference to rely on: `Play` and `Edit` both read
 * `index.weapons.get(ref)`, get `undefined`, and render the empty state. The
 * slot reads as though the player never equipped anything.
 *
 * The contrast is what makes that a finding rather than an observation. This
 * app already knows how to say it: an armor that has left the build draws
 * `ARMOR NOT IN THIS BUILD` and a domain card draws `CARD NOT IN THIS BUILD`.
 * Only the two weapon slots are silent, and they are the slots that carry a
 * damage die.
 *
 * The dataset here is the shipped one with the nine SRD 2.0 drops removed,
 * which is exactly what switching `src/store/dataset.ts` to SRD 2.0 would do to
 * a character who has one equipped.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character, Dataset } from '@shared/types.ts';
import { deriveStats, indexDataset } from '@engine/character.ts';
import { Play } from '../../src/ui/player/Play.tsx';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { dataset as shipped, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** The nine records SRD 2.0 does not print. See `tests/tools/weapons-succession.test.ts`. */
const DROPPED = [
  'axe-of-fortunis',
  'blessed-anlace',
  'ghostblade',
  'runes-of-ruination',
  'widogast-pendant',
  'gilded-bow',
  'firestaff',
  'mage-orb',
  'ilmaris-rifle',
] as const;

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
  setViewport(1280);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The shipped dataset with some records taken out of one collection. */
function thinned(patch: Partial<Dataset>): Dataset {
  return { ...shipped, ...patch };
}

/**
 * Seed the store with a dataset and a character, then draw `Play` into a fresh
 * root.
 *
 * Fresh rather than reused, because two of these run twice in one test: pushing
 * a new dataset through the store under a mounted tree updates it outside
 * `act`, and `useLayout` would still be holding the `MediaQueryList` objects
 * that `setViewport` replaced.
 */
function draw(ds: Dataset, patch: Partial<Character>): string {
  act(() => root.unmount());
  root = createRoot(container);
  const ix = indexDataset(ds);
  const character = { ...playedCharacter(), ...patch };
  const element: ReactElement = createElement(Play, { stats: deriveStats(character, ds, ix) });
  act(() => {
    useApp.setState({
      ready: true,
      storageError: null,
      dataset: ds,
      index: ix,
      characters: [character],
      activeId: character.id,
      prefs: { ...DEFAULT_PREFS },
      log: [],
      openCard: null,
    });
    root.render(element);
  });
  return container.textContent ?? '';
}

/** The shipped dataset minus the nine, which is what the switch would ship. */
const withoutTheNine = (): Dataset =>
  thinned({ weapons: shipped.weapons.filter((w) => !(DROPPED as readonly string[]).includes(w.id)) });

describe('an equipped weapon that the next dataset does not print', () => {
  it('is what the Axe of Fortunis becomes: the record is real today', () => {
    expect(shipped.weapons.find((w) => w.id === 'axe-of-fortunis')?.damage).toBe('d10+8');
    expect(DROPPED.every((id) => shipped.weapons.some((w) => w.id === id))).toBe(true);
  });

  /*
   * The positive control, and it is not decoration: the first version of this
   * file ran at 393px, where `Play` folds the whole `Weapons & armour` section
   * away. The absence assertion below passed on a screen that was not drawing
   * the weapon EITHER WAY. Desktop width is where the slot is actually on the
   * page, so an absence there means something.
   */
  it('CONTROL: is drawn on the sheet, with its name and its damage, while it is in the build', () => {
    const body = draw(shipped, { activePrimaryWeapon: 'axe-of-fortunis' });
    expect(body).toContain('Axe of Fortunis');
    expect(body).toContain('d10+8');
  });

  it('LEAVES NO TRACE once it is not: no name, no marker, no warning', () => {
    const body = draw(withoutTheNine(), { activePrimaryWeapon: 'axe-of-fortunis' });
    expect(body).not.toContain('Axe of Fortunis');
    expect(body.toLowerCase()).not.toContain('fortunis');
    // The banner this app uses when a reference cannot be resolved. The weapon
    // slot gets none, and there is no third form it gets instead:
    // `character.activePrimaryWeapon` still holds the ref and nothing says so.
    expect(body).not.toContain('NOT IN THIS BUILD');
  });

  it(
    'CONTRAST: in the SAME render an armor that has left the build announces itself, so the ' +
      'silence at the weapon slot is a gap and not a house style',
    () => {
      const armorRef = playedCharacter().activeArmor!;
      const ds = {
        ...withoutTheNine(),
        armors: shipped.armors.filter((a) => a.id !== armorRef),
      };
      const body = draw(ds, { activePrimaryWeapon: 'axe-of-fortunis' });
      expect(body).toContain('ARMOR NOT IN THIS BUILD');
      expect(body).not.toContain('WEAPON NOT IN THIS BUILD');
      expect(body).not.toContain('Axe of Fortunis');
    },
  );

  it('and on a phone the only trace at all is a count in a folded label', () => {
    setViewport(393);
    const before = draw(shipped, { activePrimaryWeapon: 'axe-of-fortunis' });
    expect(before).toContain('Weapons & armour');
    expect(before).toContain('3 WORN');
    const after = draw(withoutTheNine(), { activePrimaryWeapon: 'axe-of-fortunis' });
    expect(after).toContain('2 WORN');
    expect(after).not.toContain('3 WORN');
  });
});
