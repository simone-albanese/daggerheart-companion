// @vitest-environment jsdom
/**
 * The damage row, mounted on its own.
 *
 * The defect class this file exists for is a row that works out the verdict for
 * itself instead of asking `damageOffer`. `succeeded` has three values and the
 * third is `null` - the engine returns it on purpose when the GM has not shared
 * the Difficulty - so an `if (attack.succeeded)` inside the row reads that null
 * as a miss and silently removes the whole feature from every table that keeps
 * its Difficulties hidden. Nothing throws, every unit test on `damageOffer`
 * keeps passing, and the app simply never offers damage to those tables.
 *
 * So the attack is hand-built here rather than rolled, which makes every branch
 * deterministic, and the assertions are about what is on the screen: whether
 * there is a target at all, what it says, what it writes, and what it leaves
 * alone. `tests/ui/attack.test.ts` already pins `damageOffer`'s own rules and
 * their ordering; none of that is restated.
 */
import 'fake-indexeddb/auto';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DamageDice } from '../../src/engine/dice.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import type { ArmedAttack, AttackSource } from '../../src/ui/player/attack.ts';
import { DamageRow } from '../../src/ui/player/DamageRoll.tsx';
import { rollAffordance } from '../../src/ui/player/DualityRoll.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

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
    characters: [playedCharacter()],
    activeId: playedCharacter().id,
    prefs: { ...DEFAULT_PREFS },
    log: [],
    openCard: null,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];
const text = (): string => container.textContent ?? '';
const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const weapon = (damage: DamageDice): AttackSource => ({
  kind: 'weapon',
  ref: 'longsword',
  name: 'Longsword',
  trait: 'agility',
  damage,
  damageType: 'phy',
});

/** Proficiency is already applied: this is the pool the attack actually rolls. */
const attack = (over: Partial<ArmedAttack> = {}): ArmedAttack => ({
  source: weapon({ count: 3, sides: 10, modifier: 3 }),
  critical: false,
  succeeded: true,
  outcome: 'success-hope',
  reaction: false,
  proficiency: 3,
  ...over,
});

function mount(
  a: ArmedAttack | null,
  affordance = rollAffordance(DEFAULT_PREFS.digitalDice, DEFAULT_PREFS.manualDice),
  layout: 'desktop' | 'phone' = 'phone',
): void {
  render(<DamageRow attack={a} affordance={affordance} layout={layout} />);
}

describe('what the row puts in front of the player', () => {
  it('draws one control, carrying the pool the attack actually rolls', () => {
    mount(attack());
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]!.textContent).toContain('3d10+3');
  });

  it('still offers damage when the GM kept the Difficulty to themselves', () => {
    /*
     * The case a truthiness check silently drops, at the surface. It must draw
     * a control, that control must be pressable, and it must not claim the
     * attack hit - `IF IT HIT` is the whole difference between offering a roll
     * and asserting a verdict that belongs to the GM.
     */
    mount(attack({ succeeded: null, outcome: 'undecided-hope' }));
    expect(buttons(), 'the row went dark for every table that hides Difficulties').toHaveLength(1);
    expect(buttons()[0]!.disabled).toBe(false);
    expect((buttons()[0]!.textContent ?? '').trim()).toMatch(/^IF IT HIT/);
  });

  it('draws no target at all on a miss, and says why', () => {
    mount(attack({ succeeded: false, outcome: 'failure-fear' }));
    // Not a disabled button still carrying the word DAMAGE: that says the app
    // could roll this and won't. There is nothing to roll, so there is nothing
    // to press - and the row says so rather than leaving a gap.
    expect(buttons()).toHaveLength(0);
    expect(text()).toMatch(/missed/i);
  });

  it('draws no target on a reaction roll, critical or not', () => {
    mount(attack({ reaction: true, critical: true, outcome: 'critical' }));
    expect(buttons()).toHaveLength(0);
    expect(text()).toMatch(/reaction/i);
  });

  it('refuses a pool that is not a pool', () => {
    // `parseDamage`'s regex is unanchored, so a homebrew weapon written `d0`
    // comes back as one die of zero faces. Rolling it produces a column of
    // zeroes and a total that looks like a real answer.
    mount(attack({ source: weapon({ count: 1, sides: 0, modifier: 0 }) }));
    expect(buttons()).toHaveLength(0);
    expect(text()).toContain('NO DAMAGE');
  });

  it('says the dice are yours when the roller is off', () => {
    // `canRoll` false means this build cannot make the roll. A control labelled
    // ROLL DAMAGE would be promising one anyway.
    mount(attack(), rollAffordance(false, true));
    expect(buttons()).toHaveLength(0);
    expect(text()).toMatch(/yours to roll/i);
    expect(text()).toContain('3d10+3');
  });

  it('draws nothing before a roll has been made', () => {
    mount(null);
    expect(container.children).toHaveLength(0);
  });

  it('clears the 44px floor in both layouts', () => {
    mount(attack(), rollAffordance(true, false), 'phone');
    // 52 on a phone: it clears the floor by 8 and stays under ROLL's 66, so the
    // hierarchy in the pinned block reads by size alone.
    expect(buttons()[0]!.style.minHeight).toBe('52px');
    mount(attack(), rollAffordance(true, false), 'desktop');
    expect(buttons()[0]!.style.minHeight).toBe('44px');
  });
});

describe('what rolling it does, and what it must not do', () => {
  it('writes one log line and leaves the character record untouched', () => {
    const before = structuredClone(useApp.getState().characters[0]);
    mount(attack());
    click(buttons()[0]!);

    const log = useApp.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0]!.kind).toBe('damage');
    // The number on the control is the number in the log: there is no log
    // surface on a phone at all, so the control is where the total is read.
    expect(buttons()[0]!.textContent).toContain(String(log[0]!.total));
    // It offers, and never applies. Nothing on this screen is an adversary.
    expect(
      useApp.getState().characters[0],
      'rolling damage wrote to the character',
    ).toEqual(before);
  });

  it('takes the critical off the attack instead of working it out again', () => {
    // 3d10+3 with the critical: the bonus is the maximum of the dice actually
    // rolled, so 30, and the worst possible total is 3 + 3 + 30. Without it the
    // best possible total is 33.
    mount(attack({ critical: true, outcome: 'critical' }));
    click(buttons()[0]!);
    const entry = useApp.getState().log[0]!;
    expect(entry.total).toBeGreaterThanOrEqual(36);
    expect(entry.detail).toContain('+30 crit');
    expect(entry.label).toMatch(/^CRITICAL/);
  });

  it('does not replace the number on a stray second tap', () => {
    /*
     * This control is the last thing in the phone's pinned block, so it sits at
     * the easiest point on the glass to reach - and there is no log on a phone
     * to show what the number used to be. So the second tap asks first, the way
     * the vault's recall does, and says which number it is about to replace.
     */
    mount(attack());
    click(buttons()[0]!);
    const first = useApp.getState().log[0]!.total!;

    click(buttons()[0]!);
    expect(useApp.getState().log, 'a second tap rolled again with no warning').toHaveLength(1);
    expect(buttons()[0]!.textContent).toContain('TAP AGAIN');
    expect(buttons()[0]!.textContent).toContain(String(first));

    click(buttons()[0]!);
    expect(useApp.getState().log).toHaveLength(2);
    // And the first roll is still on the record: a re-roll does not claim the
    // roll before it never happened.
    expect(useApp.getState().log[1]!.total).toBe(first);
  });
});
