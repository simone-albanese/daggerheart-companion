/**
 * The held dice tray is the one piece of player state that is not the
 * character, so the things worth testing are the seams: that it survives a
 * reload, that two characters on one device do not share a Rally Die, and that
 * a hand-edited record cannot put a d7 in the pool.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private readonly map = new Map<string, string>();
  getItem = (k: string): string | null => this.map.get(k) ?? null;
  setItem = (k: string, v: string): void => void this.map.set(k, v);
  removeItem = (k: string): void => void this.map.delete(k);
  clear = (): void => this.map.clear();
}

const KEY = 'dhc.dice.v1';

/** A fresh module registry, so the store reads localStorage again on import. */
const reload = async (): Promise<typeof import('../../src/ui/player/heldDice.ts')> => {
  vi.resetModules();
  return import('../../src/ui/player/heldDice.ts');
};

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the tray', () => {
  it('holds dice per character', async () => {
    const { useHeldDice } = await reload();
    useHeldDice.getState().add('kaelith', 6);
    useHeldDice.getState().add('kaelith', 12);
    useHeldDice.getState().add('brann', 4);

    expect(useHeldDice.getState().byCharacter['kaelith']?.map((d) => d.sides)).toEqual([6, 12]);
    expect(useHeldDice.getState().byCharacter['brann']?.map((d) => d.sides)).toEqual([4]);
  });

  it('survives a reload', async () => {
    const first = await reload();
    first.useHeldDice.getState().add('kaelith', 8);

    const second = await reload();
    expect(second.useHeldDice.getState().byCharacter['kaelith']?.map((d) => d.sides)).toEqual([8]);
  });

  it('discards the die you held down and not its twin', async () => {
    const { useHeldDice } = await reload();
    useHeldDice.getState().add('kaelith', 6);
    useHeldDice.getState().add('kaelith', 6);
    const [first, second] = useHeldDice.getState().byCharacter['kaelith'] ?? [];

    useHeldDice.getState().discard('kaelith', first!.id);
    expect(useHeldDice.getState().byCharacter['kaelith']).toEqual([second]);
  });

  it('stops at the ceiling instead of overflowing the row', async () => {
    const { useHeldDice, MAX_HELD } = await reload();
    for (let i = 0; i < MAX_HELD + 4; i += 1) useHeldDice.getState().add('kaelith', 6);
    expect(useHeldDice.getState().byCharacter['kaelith']).toHaveLength(MAX_HELD);
  });

  it('drops anything that is not a die on the way in', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        kaelith: [{ id: 'a', sides: 6 }, { id: 'b', sides: 7 }, { sides: 8 }, null, 'd20'],
        brann: 'not a list',
      }),
    );
    const { useHeldDice } = await reload();
    expect(useHeldDice.getState().byCharacter['kaelith']).toEqual([{ id: 'a', sides: 6 }]);
    expect(useHeldDice.getState().byCharacter['brann']).toBeUndefined();
  });

  it('shrugs off a record that is not JSON at all', async () => {
    localStorage.setItem(KEY, '{oh no');
    const { useHeldDice } = await reload();
    expect(useHeldDice.getState().byCharacter).toEqual({});
  });

  it('keeps the tray live when storage refuses to write', async () => {
    const { useHeldDice } = await reload();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    });
    expect(() => useHeldDice.getState().add('kaelith', 10)).not.toThrow();
    expect(useHeldDice.getState().byCharacter['kaelith']?.map((d) => d.sides)).toEqual([10]);
  });
});
