// @vitest-environment jsdom
/**
 * The wizard's read-only numbers are the numbers Create writes.
 *
 * `StepRecord` (Level, Evasion & HP) and `StepEquipment`'s armor line print
 * `deriveStats` of a preview sheet, and the preview used to be built from the
 * class and the armor alone - no ancestry, subclass, traits or weapons - while
 * Create assembles the whole draft. The modifier register reads all of them:
 * Simiah's Nimble (+1 Evasion), Giant's Endurance (+1 HP), Human's High
 * Stamina (+1 Stress), a Tower Shield's Barrier (+2 Armor Score, -1 Evasion),
 * Galapa's Shell and Mage Robes' Enchanted on the thresholds. So step 6 said
 * EVASION 11 to a Simiah Warrior whose sheet reads 12, under a caption saying
 * the class decides it.
 *
 * Every expected number here is asked of the engine for the sheet `finish`
 * would create, never typed - the assertion is that the two agree.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CharClass } from '@shared/types.ts';
import { deriveStats, newCharacter, type DerivedStats } from '@engine/character.ts';
import { useApp } from '../../src/store/state.ts';
import { assemble, emptyDraft, type Draft } from '../../src/ui/build/creation.ts';
import { StepEquipment, StepRecord } from '../../src/ui/build/Wizard.tsx';
import { dataset, index } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
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
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({ ready: true, dataset, index, log: [], openCard: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const klassOf = (id: string): CharClass => {
  const k = dataset.classes.find((c) => c.id === id);
  expect(k, `no class ${id} in the shipped dataset`).toBeDefined();
  return k!;
};

const draftFor = (p: Partial<Draft>): Draft => {
  const klass = klassOf(p.classRef ?? 'warrior');
  return {
    ...emptyDraft(),
    classRef: klass.id,
    subclassRef: dataset.subclasses.find((s) => s.classRef === klass.id)?.id ?? null,
    primary: dataset.weapons.find((w) => w.slot === 'primary' && w.tier === 1)?.id ?? null,
    armor: 'leather-armor',
    ...p,
  };
};

/** What `finish` creates from this draft, as the engine reads it. */
const created = (draft: Draft): DerivedStats => {
  const sheet = newCharacter(assemble(draft, klassOf(draft.classRef), dataset.consumables), index);
  return deriveStats(sheet, dataset, index);
};

const text = (): string => container.textContent ?? '';

/** The big number under a readout label. */
function readout(label: string): string {
  const span = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  expect(span, `no readout labelled ${label}`).toBeDefined();
  return (span!.nextElementSibling?.textContent ?? '').trim();
}

/** The line under a readout - the note, the last span in the panel. */
function noteOf(label: string): string {
  const span = [...container.querySelectorAll('span')].find(
    (s) => (s.textContent ?? '').trim() === label,
  );
  expect(span, `no readout labelled ${label}`).toBeDefined();
  const panel = span!.parentElement!;
  return (panel.lastElementChild?.textContent ?? '').trim();
}

function mountRecord(draft: Draft): void {
  act(() => {
    root.render(createElement(StepRecord, { draft, klass: klassOf(draft.classRef) }));
  });
}

function mountEquipment(draft: Draft): void {
  act(() => {
    root.render(
      createElement(StepEquipment, { draft, klass: klassOf(draft.classRef), set: () => {} }),
    );
  });
}

describe('step 6 reads the whole draft (B5-2, folio 5 and the modifier register)', () => {
  it('prints the Evasion a Simiah Warrior will actually have', () => {
    const draft = draftFor({ ancestryTop: 'simiah' });
    const sheet = created(draft);
    // Control on the fixture: the ancestry must actually move the number, or
    // the case below could pass with the ancestry ignored.
    expect(sheet.evasion).toBe(created(draftFor({ ancestryTop: null })).evasion + 1);

    mountRecord(draft);
    expect(readout('EVASION'), 'the readout ignores the ancestry').toBe(String(sheet.evasion));
    expect(noteOf('EVASION'), 'the note credits the class alone').toMatch(/SIMIAH/);
  });

  it('prints the Hit Points of a Giant, and the Stress of a Human', () => {
    const giant = draftFor({ classRef: 'rogue', ancestryTop: 'giant' });
    mountRecord(giant);
    expect(readout('HIT POINTS')).toBe(String(created(giant).maxHp));
    expect(created(giant).maxHp).toBe(created(draftFor({ classRef: 'rogue' })).maxHp + 1);

    const human = draftFor({ classRef: 'guardian', ancestryTop: 'human' });
    mountRecord(human);
    expect(readout('STRESS')).toBe(String(created(human).maxStress));
    expect(noteOf('STRESS'), 'every PC does not start the same here').toMatch(/HUMAN/);
  });

  it('counts a Tower Shield into the Armor Score and out of the Evasion', () => {
    const draft = draftFor({ ancestryTop: 'human', secondary: 'tower-shield' });
    const sheet = created(draft);
    const bare = created({ ...draft, secondary: null });
    expect(sheet.armorScore).toBe(bare.armorScore + 2);
    expect(sheet.evasion).toBe(bare.evasion - 1);

    mountRecord(draft);
    expect(readout('EVASION')).toBe(String(sheet.evasion));
    expect(text()).toContain(`ARMOR SCORE ${sheet.armorScore}`);
    expect(text()).not.toContain(`ARMOR SCORE ${bare.armorScore}`);
  });

  it('no longer says the class decides numbers a modifier moved', () => {
    mountRecord(draftFor({ ancestryTop: 'simiah' }));
    expect(text()).not.toContain('the class decides these');
  });
});

describe('the equipment step’s armor line (B5-2)', () => {
  it('prints the shield’s Armor Score, the number the created sheet has', () => {
    const draft = draftFor({ ancestryTop: 'human', secondary: 'tower-shield' });
    const sheet = created(draft);
    mountEquipment(draft);
    expect(text(), 'the armor slot prices the armor alone').toContain(`SCORE ${sheet.armorScore}`);
  });

  it('prints a Galapa’s thresholds with the Shell in them', () => {
    const draft = draftFor({ classRef: 'guardian', ancestryTop: 'galapa', armor: 'gambeson-armor' });
    const sheet = created(draft);
    const bare = created({ ...draft, ancestryTop: null });
    // Shell: thresholds up by Proficiency, which is 1 at level 1.
    expect(sheet.thresholds).toEqual([bare.thresholds[0] + 1, bare.thresholds[1] + 1]);

    mountEquipment(draft);
    expect(text()).toContain(`${sheet.thresholds[0]}/${sheet.thresholds[1]} THRESHOLDS`);
  });
});
