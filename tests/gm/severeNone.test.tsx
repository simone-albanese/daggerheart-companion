// @vitest-environment jsdom
/**
 * A Severe threshold the book writes as `None`, on the two screens that print it.
 *
 * Five SRD 2.0 stat blocks print `Thresholds: N/None` - Octopus 3/None (folio
 * 105), Tiny Green Ooze 4/None (105), Tiny Red Ooze 5/None (106), Phantom
 * 5/None (106), Poltergeist 4/None (107) - and `shared/parsers/adversaries.ts`
 * stores that Severe as `Number.MAX_SAFE_INTEGER`, because `[number, number]`
 * has no way to say None. The engine was always right about it (no amount a GM
 * types reaches that rung), but both GM surfaces printed the sentinel verbatim:
 * `SEVERE 9007199254740991` on the bestiary block and on the scene card.
 *
 * These read `data/srd-2.0.json` rather than a fixture, for `sceneTruth.test
 * .tsx`'s reason: the claim is about the book this app ships. The five are
 * found by the property - a Severe at the sentinel - and the premise test says
 * there are exactly five, so a rebuild that changed the count fails here first.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Adversary, Dataset } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { combatantHit, severeIsNone } from '../../src/engine/damage.ts';
import { makeCombatant } from '../../src/engine/encounter.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Scene } from '../../src/ui/gm/Scene.tsx';
import { AdversaryBlock } from '../../src/ui/gm/StatBlock.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';
import { sceneWith } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

const SENTINEL = String(Number.MAX_SAFE_INTEGER);

/** The blocks whose Severe the parser set out of reach, found by the property. */
const unreachableSevere = (): Adversary[] =>
  dataset.adversaries.filter((a) => a.thresholds !== null && severeIsNone(a.thresholds[1]));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({ hydrated: true, session: [], openScene: null, environmentRef: null, region: 'scene' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = (): string => container.textContent ?? '';

describe('a Severe threshold the book writes as None', () => {
  it('is five tier-1 blocks in the shipped book, all with two Hit Points', () => {
    // The premise. Folios 105-107: Octopus, Tiny Green Ooze, Tiny Red Ooze,
    // Phantom, Poltergeist. Every one has HP 2, which is why a Major hit - the
    // highest rung that exists for them - already kills them.
    expect(unreachableSevere().map((a) => a.id).sort()).toEqual([
      'octopus',
      'phantom',
      'poltergeist',
      'tiny-green-ooze',
      'tiny-red-ooze',
    ]);
    for (const a of unreachableSevere()) expect(a.hp).toBe(2);
  });

  it('prints NONE and never the sentinel on the bestiary block', () => {
    for (const a of unreachableSevere()) {
      act(() => root.render(createElement(AdversaryBlock, { adversary: a })));
      expect(text(), a.id).not.toContain(SENTINEL);
      expect(text(), a.id).toContain('SEVERENONE');
      // The Major rung is still a number: 3/None is not None.
      expect(text(), a.id).toContain(`MAJOR${a.thresholds![0]}`);
    }
  });

  it('prints NONE and never the sentinel on the scene card', () => {
    const octopus = dataset.adversaries.find((a) => a.id === 'octopus')!;
    act(() => {
      useGm.setState({
        session: [sceneWith('the-open-scene', [makeCombatant(octopus, 0, 4)])],
        openScene: 'the-open-scene',
      });
      root.render(createElement(Scene, { phone: true }));
    });
    expect(text()).not.toContain(SENTINEL);
    expect(text()).toContain('SEVERENONE');
    expect(text()).toContain('MAJOR3');
  });

  it('explains a hit against 3/None as the book writes it', () => {
    const octopus = dataset.adversaries.find((a) => a.id === 'octopus')!;
    const c = makeCombatant(octopus, 0, 4);
    const hit = combatantHit(3, c, { massiveDamageRule: false });
    expect(hit.explanation).toContain('vs 3/None -> Major');
    expect(hit.explanation).not.toContain(SENTINEL);
    // The ruling itself was never wrong: 3 on a 3/None block is a Major, two
    // Hit Points, and the whole of a two-point track.
    expect(hit.severity).toBe('major');
    expect(hit.marked).toBe(2);
    expect(hit.defeated).toBe(true);
    // And no amount a GM can type reaches Severe, with or without the optional rule.
    expect(combatantHit(50, c, { massiveDamageRule: true }).severity).toBe('major');
  });
});
