// @vitest-environment jsdom
/**
 * What the sheet does when an equipped weapon has left the build.
 *
 * This is the cost of road two in `DECISIONI-SRD-2-2026-08-31.md` §3 - "let
 * them vanish and rely on the unresolved reference" - measured on the screen
 * rather than argued from the code.
 *
 * ## What this file used to assert, and why that is worth keeping in the header
 *
 * An ABSENCE. For a weapon there was no unresolved reference to rely on:
 * `Play` and `Edit` both read `index.weapons.get(ref)`, got `undefined`, and
 * rendered the empty state. Play drew no row at all, Edit's slot invited the
 * player to "Search 391 weapons" over a sheet still holding the ref, and on a
 * phone the only trace in the whole app was a fold label going `3 WORN` ->
 * `2 WORN`. The contrast is what made that a finding rather than an
 * observation: this app already knows how to say it - an armor that has left
 * the build draws `ARMOR NOT IN THIS BUILD` and a domain card draws
 * `CARD NOT IN THIS BUILD`. Only the two weapon slots were silent, and they are
 * the slots that carry a damage die.
 *
 * The assertions below are the new truth. The CONTRAST is kept, because the
 * point of the repair is that the two paths are symmetrical and a test that
 * stopped watching the armor could not tell symmetry from coincidence; the
 * positive CONTROLS are kept for the reason the first version of this file
 * needed them, written out at the control itself.
 *
 * The dataset here is the shipped one with the nine SRD 2.0 drops removed,
 * which is exactly what switching `src/store/dataset.ts` to SRD 2.0 would do to
 * a character who has one equipped.
 */
import { readFileSync } from 'node:fs';
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character, Dataset } from '@shared/types.ts';
import { deriveStats, indexDataset } from '@engine/character.ts';
import { unresolvedWeapons } from '@engine/holdings.ts';
import { Play } from '../../src/ui/player/Play.tsx';
import { Edit } from '../../src/ui/build/Edit.tsx';
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
 * Seed the store with a dataset and a character, then draw a screen into a
 * fresh root.
 *
 * Fresh rather than reused, because two of these run twice in one test: pushing
 * a new dataset through the store under a mounted tree updates it outside
 * `act`, and `useLayout` would still be holding the `MediaQueryList` objects
 * that `setViewport` replaced.
 */
function drawOn(which: 'play' | 'edit', ds: Dataset, patch: Partial<Character>): string {
  act(() => root.unmount());
  root = createRoot(container);
  const ix = indexDataset(ds);
  const character = { ...playedCharacter(), ...patch };
  const stats = deriveStats(character, ds, ix);
  const element: ReactElement =
    which === 'play'
      ? createElement(Play, { stats })
      : createElement(Edit, { stats, onLevelUp: () => undefined });
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

const draw = (ds: Dataset, patch: Partial<Character>): string => drawOn('play', ds, patch);
const drawEdit = (ds: Dataset, patch: Partial<Character>): string => drawOn('edit', ds, patch);

/** Every `<button>` on the page, so a control can be found by what it says. */
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const click = (el: HTMLElement): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};

const times = (body: string, what: string): number =>
  body.split(what).length - 1;

/**
 * The shipped dataset. It IS the one without the nine now.
 *
 * This used to build the "after" by filtering the nine out of SRD 1.0, because
 * the app still shipped SRD 1.0 and the loss was hypothetical. The switch made
 * it the shipped file, so the "after" is simply the bundle and the "before" is
 * the book that is still committed beside it - which is a better test in both
 * directions: the loss is real, and the control resolves a record that a real
 * saved character really holds.
 */
const withoutTheNine = (): Dataset => shipped;

/**
 * The shipped book with the nine put back, taken from the committed
 * `data/srd-1.0.json` - real records the app really used to draw, not
 * reconstructed ones.
 *
 * The nine RESTORED rather than SRD 1.0 whole, and that is not laziness: this
 * fixture's other refs come from the shipped book (its off-hand is a Hatchet,
 * which SRD 1.0 does not print), so swapping the entire weapon list would
 * empty the secondary slot and put a second WEAPON NOT IN THIS BUILD on the
 * page - the control would fail for a reason that has nothing to do with what
 * it controls for.
 */
const before = (): Dataset => {
  const one = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as Dataset;
  const restored = one.weapons.filter((w) => (DROPPED as readonly string[]).includes(w.id));
  expect(restored, 'the nine are not in data/srd-1.0.json any more').toHaveLength(DROPPED.length);
  return thinned({ weapons: [...shipped.weapons, ...restored] });
};

/** Two of the nine, so the primary and the secondary slot can both be lost. */
const AXE = 'axe-of-fortunis';
const ANLACE = 'blessed-anlace';

describe('an equipped weapon that the next dataset does not print', () => {
  it('CONTROL: the nine are real in the book a saved character was built from, and in no other', () => {
    const one = JSON.parse(readFileSync('data/srd-1.0.json', 'utf8')) as Dataset;
    expect(one.weapons.find((w) => w.id === AXE)?.damage).toBe('d10+8');
    expect(DROPPED.every((id) => one.weapons.some((w) => w.id === id))).toBe(true);
    // And gone from the one the app now ships, which is what this file is for.
    expect(DROPPED.filter((id) => shipped.weapons.some((w) => w.id === id))).toEqual([]);
  });

  /*
   * The positive control, and it is not decoration: the first version of this
   * file ran at 393px, where `Play` folds the whole `Weapons & armour` section
   * away, and its assertion passed on a screen that was not drawing the weapon
   * EITHER WAY. Desktop width is where the slot is actually on the page, so
   * what is said there means something. It is kept now for the mirror-image
   * reason: it is what proves an empty render cannot green this file.
   */
  it('CONTROL: is drawn on the sheet, with its name and its damage, while it is in the build', () => {
    const body = draw(before(), { activePrimaryWeapon: AXE });
    expect(body).toContain('Axe of Fortunis');
    expect(body).toContain('d10+8');
    expect(body).not.toContain('WEAPON NOT IN THIS BUILD');
  });

  it('SAYS SO on Play once it is not, in the house words, naming the ref', () => {
    const body = draw(withoutTheNine(), { activePrimaryWeapon: AXE });
    expect(body).toContain('WEAPON NOT IN THIS BUILD');
    // The ref, because it is the whole of what is knowable: it is what a newer
    // bundle, or the device this sheet came from, would resolve.
    expect(body).toContain(AXE);
    // And which of the two slots it was, because there are two of them.
    expect(body).toContain('PRIMARY');
    // The name is gone, and that is correct - this build cannot read it. What
    // changed is that its absence is now announced instead of being silent.
    expect(body).not.toContain('Axe of Fortunis');
  });

  /*
   * THE HALF-REPAIR TEST, and the reason it is a separate `it`.
   *
   * `activePrimaryWeapon` and `activeSecondaryWeapon` are two fields that fail
   * identically, and a repair that covered the first and left the second is the
   * exact shape of mistake this repository has been bitten by. So the second
   * slot is asserted alone, not only alongside the first.
   */
  it('SAYS SO for the SECONDARY slot on its own, not only for the primary', () => {
    const body = draw(withoutTheNine(), {
      activePrimaryWeapon: null,
      activeSecondaryWeapon: ANLACE,
    });
    expect(body).toContain('WEAPON NOT IN THIS BUILD');
    expect(body).toContain(ANLACE);
    expect(body).toContain('SECONDARY');
  });

  it('SAYS SO TWICE when both slots are lost - one row per slot, not one row for the pair', () => {
    const body = draw(withoutTheNine(), {
      activePrimaryWeapon: AXE,
      activeSecondaryWeapon: ANLACE,
    });
    expect(times(body, 'WEAPON NOT IN THIS BUILD')).toBe(2);
    expect(body).toContain(AXE);
    expect(body).toContain(ANLACE);
  });

  /*
   * READ, NOT TOUCH, and it is asserted rather than described.
   *
   * Every other row in `Equipped` is a `<button>` you arm: tapping one declares
   * it and `DualityRoll` then offers its damage. There is nothing to declare
   * here - no trait, no range, no dice - so a control would be a `var(--tap)`
   * target in the middle of the thumb arc that answers a tap with nothing,
   * which teaches the player that the ROW is broken rather than that the WEAPON
   * is missing.
   *
   * And the dash, because `shapeCoding` is this codebase's standing refusal of
   * colour as a sole signal: the three sides are dashed where a real row's are
   * solid, and the damage-coloured spine only agrees with that.
   */
  it('is a paragraph and not a control, and is marked by shape and not by colour alone', () => {
    draw(withoutTheNine(), { activePrimaryWeapon: AXE });
    const rows = [...container.querySelectorAll('div')].filter(
      (d) => (d.textContent ?? '').includes('WEAPON NOT IN THIS BUILD'),
    );
    const row = rows[rows.length - 1]!;
    expect(row.tagName).toBe('DIV');
    expect(row.closest('button'), 'the unreadable row is inside a control').toBeNull();
    expect(row.querySelector('button'), 'the unreadable row contains a control').toBeNull();
    // Read off the shorthand, not the longhand: jsdom does not decompose a
    // per-side shorthand that carries a `var()`, so `borderTopStyle` is the
    // empty string while `borderTop` is the whole declaration. Measured.
    for (const sideOf of [row.style.borderTop, row.style.borderRight, row.style.borderBottom]) {
      expect(sideOf).toContain('dashed');
    }
    expect(row.style.borderLeft).toBe('3px solid var(--damage)');
  });

  it(
    'CONTRAST: in the SAME render the armor that has left the build announces itself in the ' +
      'same words, which is what makes the two paths one path',
    () => {
      const armorRef = playedCharacter().activeArmor!;
      const ds = {
        ...withoutTheNine(),
        armors: shipped.armors.filter((a) => a.id !== armorRef),
      };
      const body = draw(ds, { activePrimaryWeapon: AXE });
      expect(body).toContain('ARMOR NOT IN THIS BUILD');
      expect(body).toContain('WEAPON NOT IN THIS BUILD');
      expect(body).toContain(armorRef);
      expect(body).toContain(AXE);
      expect(body).not.toContain('Axe of Fortunis');
    },
  );

  /*
   * The other half of the control, and the one a mutant that always draws the
   * banner would fail. A slot that is genuinely empty is a different fact and
   * must not read as this one.
   */
  it('CONTROL: says nothing of the kind over a slot that is genuinely empty', () => {
    const body = draw(withoutTheNine(), {
      activePrimaryWeapon: null,
      activeSecondaryWeapon: null,
    });
    expect(body).not.toContain('WEAPON NOT IN THIS BUILD');
    expect(body).not.toContain('NOT IN THIS BUILD');
  });

  it('is still not dropped: the ref stays on the sheet, and the engine is what reports it', () => {
    const ds = withoutTheNine();
    const ix = indexDataset(ds);
    const c = { ...playedCharacter(), activePrimaryWeapon: AXE, activeSecondaryWeapon: ANLACE };
    expect(unresolvedWeapons(c, ix)).toEqual({ primary: AXE, secondary: ANLACE });
    // Both halves, so neither can be answered by luck - the same two refs,
    // against the book that still prints them.
    expect(unresolvedWeapons(c, indexDataset(before()))).toEqual({ primary: null, secondary: null });
    // Nothing rewrites the sheet. The ref is what a later bundle resolves.
    draw(ds, { activePrimaryWeapon: AXE });
    expect(useApp.getState().characters[0]!.activePrimaryWeapon).toBe(AXE);
  });

  // -------------------------------------------------------------------------
  // Build, where the false sentence was
  // -------------------------------------------------------------------------

  it('CONTROL: Edit says "Search N weapons" over a slot that is really empty', () => {
    const ds = withoutTheNine();
    const body = drawEdit(ds, { activePrimaryWeapon: null });
    expect(body).toContain(`Search ${ds.weapons.length} weapons`);
  });

  it('Edit stops saying "Search N weapons" over a ref the sheet is still holding', () => {
    const ds = withoutTheNine();
    const body = drawEdit(ds, { activePrimaryWeapon: AXE });
    expect(body).not.toContain(`Search ${ds.weapons.length} weapons`);
    expect(body).toContain('WEAPON NOT IN THIS BUILD');
    expect(body).toContain(AXE);
    // «REPLACE», not «CHOOSE»: there is something in the slot.
    expect(body).toContain('REPLACE');
  });

  it('Edit says it for the SECONDARY slot too, and its empty word is not the weapon count', () => {
    const body = drawEdit(withoutTheNine(), {
      activePrimaryWeapon: null,
      activeSecondaryWeapon: ANLACE,
    });
    expect(body).toContain('WEAPON NOT IN THIS BUILD');
    expect(body).toContain(ANLACE);
  });

  /*
   * The capability that was missing rather than the sentence that was wrong.
   * The ✕ is gated on a resolved name, so the one control that clears the
   * stored ref was withheld from precisely the state a player needs it in: the
   * slot could only be got out of by equipping something over the top of it.
   */
  it('Edit offers the ✕, and it empties the slot', () => {
    drawEdit(withoutTheNine(), { activePrimaryWeapon: AXE });
    const clear = buttons().find((b) => b.getAttribute('aria-label') === 'Clear Primary weapon');
    expect(clear, 'no way to clear a slot holding an unreadable ref').toBeDefined();
    click(clear!);
    expect(useApp.getState().characters[0]!.activePrimaryWeapon).toBeNull();
  });

  it('CONTRAST: Edit says the same about an armor that has left the build', () => {
    const armorRef = playedCharacter().activeArmor!;
    const ds = { ...withoutTheNine(), armors: shipped.armors.filter((a) => a.id !== armorRef) };
    const body = drawEdit(ds, { activePrimaryWeapon: AXE });
    expect(body).toContain('ARMOR NOT IN THIS BUILD');
    expect(body).toContain('WEAPON NOT IN THIS BUILD');
    expect(body).not.toContain(`Search ${ds.armors.length} sets of armor`);
  });

  // -------------------------------------------------------------------------
  // The phone, where the only trace used to be a number
  // -------------------------------------------------------------------------

  it('on a phone the fold no longer quietly loses a count, and names it once opened', () => {
    setViewport(393);
    const before = draw(shipped, { activePrimaryWeapon: AXE });
    expect(before).toContain('Weapons & armour');
    expect(before).toContain('3 WORN');

    const after = draw(withoutTheNine(), { activePrimaryWeapon: AXE });
    // The count is what the fold DRAWS, and it now draws the unreadable slot,
    // so the number stops sliding from under the player. This is the assertion
    // that used to read `2 WORN`.
    expect(after).toContain('3 WORN');
    expect(after).not.toContain('2 WORN');

    // Shut, the fold's children are not rendered at all; the sentence is behind
    // the same tap the weapons themselves are behind, and the tap reaches it.
    expect(after).not.toContain('WEAPON NOT IN THIS BUILD');
    const header = buttons().find((b) => (b.textContent ?? '').includes('Weapons & armour'));
    expect(header, 'no disclosure header to open').toBeDefined();
    click(header!);
    const opened = container.textContent ?? '';
    expect(opened).toContain('WEAPON NOT IN THIS BUILD');
    expect(opened).toContain(AXE);
  });
});
