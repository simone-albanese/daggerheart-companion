import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_LABEL,
  MAX_NAMED,
  NO_CONDITIONS,
  isEmpty,
  prune,
  useConditions,
} from '../../src/ui/player/conditionsStore.ts';

const ID = 'char-1';
const read = (): (typeof NO_CONDITIONS) => useConditions.getState().byCharacter[ID] ?? NO_CONDITIONS;

beforeEach(() => {
  useConditions.setState({ byCharacter: {} });
});

describe('the standard three', () => {
  it('toggles independently and starts clear', () => {
    expect(isEmpty(read())).toBe(true);
    useConditions.getState().toggle(ID, 'restrained');
    expect(read()).toMatchObject({ hidden: false, restrained: true, vulnerable: false });
    useConditions.getState().toggle(ID, 'restrained');
    expect(isEmpty(read())).toBe(true);
  });

  it('keeps two characters apart', () => {
    useConditions.getState().toggle(ID, 'hidden');
    useConditions.getState().toggle('char-2', 'vulnerable');
    expect(useConditions.getState().byCharacter[ID]!.hidden).toBe(true);
    expect(useConditions.getState().byCharacter['char-2']!.hidden).toBe(false);
  });
});

describe('states the player names', () => {
  it('trims, caps the label and refuses an empty one', () => {
    const { addNamed } = useConditions.getState();
    addNamed(ID, '   ');
    expect(read().named).toHaveLength(0);
    addNamed(ID, `  ${'x'.repeat(MAX_LABEL + 10)}  `);
    expect(read().named[0]!.label).toHaveLength(MAX_LABEL);
  });

  it('holds no more than the strip can show', () => {
    const { addNamed } = useConditions.getState();
    for (let i = 0; i < MAX_NAMED + 3; i++) addNamed(ID, `state ${i}`);
    expect(read().named).toHaveLength(MAX_NAMED);
  });

  it('toggles, renames and removes one without disturbing the other', () => {
    const store = useConditions.getState();
    store.addNamed(ID, 'Cloaked');
    store.addNamed(ID, 'Focus');
    const [first, second] = read().named;
    store.toggleNamed(ID, first!.id);
    store.renameNamed(ID, second!.id, 'No Mercy');
    expect(read().named.map((n) => [n.label, n.on])).toEqual([
      ['Cloaked', false],
      ['No Mercy', true],
    ]);
    store.removeNamed(ID, first!.id);
    expect(read().named.map((n) => n.label)).toEqual(['No Mercy']);
  });

  it('clears everything at once', () => {
    const store = useConditions.getState();
    store.toggle(ID, 'hidden');
    store.addNamed(ID, 'Cloaked');
    store.clear(ID);
    expect(isEmpty(read())).toBe(true);
  });
});

describe('what reaches localStorage', () => {
  it('drops the rows that say nothing, so deleted characters leave nothing behind', () => {
    const kept = { ...NO_CONDITIONS, hidden: true };
    expect(prune({ a: NO_CONDITIONS, b: kept })).toEqual({ b: kept });
  });
});
