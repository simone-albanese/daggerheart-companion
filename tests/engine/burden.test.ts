/**
 * The one class that ignores burden, and the address that finds it.
 *
 * Two halves, and they fail for different reasons.
 *
 * The SYNTHETIC half proves the predicate reads a feature rather than a class
 * id, and that it reads both class refs. Those are the two ways the same defect
 * comes back: a `warrior` literal takes the exception away from anybody whose
 * dataset spells the class differently, and reading `classRef` alone takes it
 * away from every multiclassed Warrior - silently, in both cases, because a
 * missing sentence looks exactly like a sentence that was never true.
 *
 * The SHIPPED half is the condition this repo puts on writing an address into
 * `src/` at all: `IGNORES_BURDEN_FEATURE` is checked against the book every
 * run, the way `stances.test.tsx` checks `STANCE_SUBCLASS`. A printing that
 * renames Combat Training, moves it off the Warrior, or rewrites it so it no
 * longer lifts the limit reddens here, instead of the exception quietly ceasing
 * to exist for everybody the book gave it to.
 */
import { describe, expect, it } from 'vitest';
import { indexDataset } from '@engine/character.ts';
import { IGNORES_BURDEN_FEATURE, ignoresBurden } from '@engine/burden.ts';
import type { Dataset } from '@shared/types.ts';
import { baseDataset } from '../../src/store/dataset.ts';
import { feature, makeCharacter, makeClass, makeDataset } from '../fixtures/factories.ts';

/*
 * The feature is on a class that is NOT called `warrior`, and there is a class
 * called `warrior` that does not have it. A predicate matching the id passes
 * every other test in this file and fails both of these.
 */
const ds: Dataset = makeDataset({
  classes: [
    makeClass({
      id: 'a-class-by-another-name',
      name: 'Renamed Warrior',
      classFeatures: [feature('Attack of Opportunity'), { name: IGNORES_BURDEN_FEATURE, text: 'You ignore burden when equipping weapons.' }],
    }),
    makeClass({ id: 'warrior', name: 'Not The Warrior', classFeatures: [feature('Something Else')] }),
    makeClass({ id: 'plain-class', classFeatures: [] }),
  ],
});
const ix = indexDataset(ds);

describe('ignoresBurden', () => {
  it('reads the class feature rather than a hardcoded class ref', () => {
    expect(ignoresBurden(makeCharacter({ classRef: 'a-class-by-another-name' }), ix)).toBe(true);
    expect(ignoresBurden(makeCharacter({ classRef: 'warrior' }), ix)).toBe(false);
    expect(ignoresBurden(makeCharacter({ classRef: 'plain-class' }), ix)).toBe(false);
  });

  it('finds it through a multiclass too', () => {
    // Folio 54: "you choose an additional class, gain access to one of its
    // domains, and acquire its class feature."
    const c = makeCharacter({ classRef: 'plain-class', multiclassRef: 'a-class-by-another-name' });
    expect(ignoresBurden(c, ix)).toBe(true);
  });

  it('says no for a class this build cannot name, rather than throwing', () => {
    // Both real states: the codec decodes an unreadable class as `''`, and a
    // sheet imported from a later dataset arrives holding a ref nothing here
    // resolves. Neither may crash a screen, and neither is a Warrior.
    expect(ignoresBurden(makeCharacter({ classRef: '' }), ix)).toBe(false);
    expect(ignoresBurden(makeCharacter({ classRef: 'not-in-this-build' }), ix)).toBe(false);
    expect(ignoresBurden(makeCharacter({ classRef: '', multiclassRef: null }), ix)).toBe(false);
  });
});

describe('the address, against the book the app ships', () => {
  const carriers = baseDataset.classes.filter((k) =>
    k.classFeatures.some((f) => f.name === IGNORES_BURDEN_FEATURE),
  );

  it('names a class feature this printing actually prints', () => {
    expect(
      carriers.map((k) => k.id),
      `no class feature called ${IGNORES_BURDEN_FEATURE} in this build`,
    ).toEqual(['warrior']);
  });

  it('still says the thing the predicate is named after', () => {
    /*
     * The half a rename cannot catch: the feature could keep its name and lose
     * the sentence. If that happens the app must stop making an exception for
     * the Warrior, and this is the only place that would notice.
     */
    const text = carriers[0]?.classFeatures.find((f) => f.name === IGNORES_BURDEN_FEATURE)?.text;
    expect(text, 'the feature lost its text').toBeDefined();
    expect(text?.toLowerCase()).toContain('ignore burden');
  });

  it('answers true for a Warrior built out of the shipped dataset', () => {
    const ship = indexDataset(baseDataset);
    expect(ignoresBurden(makeCharacter({ classRef: 'warrior' }), ship)).toBe(true);
    // A control from the same book, so a predicate stuck at `true` fails here.
    expect(ignoresBurden(makeCharacter({ classRef: 'bard' }), ship)).toBe(false);
  });
});
