/**
 * The two fixture helpers that have an *order*, run at least once.
 *
 * `sceneWith` and `combatant` are not called anywhere else yet: the dozen
 * `tests/gm/` seeds they were written for are still in flight. Until those
 * land, `tsc` is the only thing that looks at either helper, and `tsc` checks
 * the shape - a row with every required field, of the right types. It does not
 * check which write lands last, and that is the whole of what these two
 * helpers promise beyond their defaults. A `sceneWith` that returned
 * `combatants: []` for every call typechecks; so does one whose positional id
 * loses to the options bag. Both would have been found by the twelve call
 * sites at once, weeks from here, with twelve seeds already written on top of
 * the wrong behaviour.
 *
 * So this file is small on purpose. It does not re-test the defaults - a
 * default that is wrong is wrong visibly, in the literal, and the call sites
 * are about to argue with every one of them. It pins the orderings, which are
 * invisible.
 */
import { describe, expect, it } from 'vitest';
import { combatant, sceneWith, type SceneRow } from './factories.ts';

describe('sceneWith', () => {
  /**
   * The shape every per-file wrapper takes, and the reason the id is written
   * after the bag rather than before it.
   *
   * `Omit<SceneRow, 'kind' | 'id' | 'combatants'>` turns away `{ id: … }`
   * written out at a call site, and nothing else. `over` here is a *variable*,
   * so excess-property checking never runs on it and `id` rides through the
   * signature - no cast, no `any`, this file compiles. If the helper spread
   * `opts` over its own id, this wrapper would ignore the argument it is
   * called with and two rows would come back sharing one id, which
   * `readCampaignRecord` accepts in silence.
   */
  it('keeps the positional id when an options bag carries one', () => {
    const seedScene = (id: string, over: Partial<SceneRow> = {}): SceneRow =>
      sceneWith(id, [], over);

    const a = seedScene('wave-1', { id: 'wave-2', name: 'First wave' });
    const b = seedScene('wave-2', { id: 'wave-2' });

    expect(a.id).toBe('wave-1');
    expect(b.id).toBe('wave-2');
    expect(a.id).not.toBe(b.id);
    // The bag still owns the six it is for.
    expect(a.name).toBe('First wave');
  });

  /**
   * The other half of "last wins": a bag widened past its own type. A cast is
   * the only way to write this one, and the cast IS the case - it is what a
   * seed reaches for when it is passing a row it got from somewhere else.
   */
  it('keeps kind and id when the bag has been widened past its type', () => {
    const widened = { kind: 'countdown', id: 'not-this-one', order: 4 } as unknown as Partial<
      Omit<SceneRow, 'kind' | 'id' | 'combatants'>
    >;

    const row = sceneWith('wave-1', [], widened);

    expect(row.kind).toBe('scene');
    expect(row.id).toBe('wave-1');
    expect(row.order).toBe(4);
  });

  it('puts the bodies it was handed on the row', () => {
    const bodies = [combatant('goblin-0'), combatant('goblin-1')];

    const row = sceneWith('wave-1', bodies);

    expect(row.combatants).toEqual(bodies);
  });

  /**
   * Two rows seeded from one array are two fights. The array is the argument,
   * so a caller holding it would otherwise be holding both rows' fight at
   * once, and a test that damages a body in one row would damage it in the
   * other.
   */
  it('copies the fight rather than sharing it', () => {
    const bodies = [combatant('goblin-0')];

    const a = sceneWith('wave-1', bodies);
    const b = sceneWith('wave-2', bodies);

    expect(a.combatants).not.toBe(bodies);
    expect(a.combatants).not.toBe(b.combatants);

    a.combatants.push(combatant('goblin-1'));
    expect(b.combatants).toHaveLength(1);
    expect(bodies).toHaveLength(1);
  });
});

describe('combatant', () => {
  /**
   * The patch a seed actually writes: another body, spread, with one field
   * moved. The spread carries an `id`, `Omit<…, 'id'>` does not see it - only
   * a fresh literal is checked for excess properties - so the id has to be
   * written after the patch or the body comes back under the wrong name while
   * the seed reads as though it asked for the right one.
   */
  it('keeps the positional id when the patch carries one', () => {
    const goblin = combatant('goblin-0');

    const hurt = combatant('goblin-1', { ...goblin, hp: { marked: 3, max: 8 } });

    expect(hurt.id).toBe('goblin-1');
    expect(hurt.hp).toEqual({ marked: 3, max: 8 });
  });

  it('lets the patch write the fields that say the fight has started', () => {
    const c = combatant('goblin-0', {
      hp: { marked: 2, max: 5 },
      spotlighted: true,
      minionsRemaining: 3,
      adversaryRef: 'not-in-this-dataset',
    });

    expect(c.id).toBe('goblin-0');
    expect(c.spotlighted).toBe(true);
    expect(c.minionsRemaining).toBe(3);
    expect(c.adversaryRef).toBe('not-in-this-dataset');
  });
});
