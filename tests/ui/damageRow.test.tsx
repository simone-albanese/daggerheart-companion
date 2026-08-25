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
import { rollAffordance } from '../../src/ui/shared/rollAffordance.ts';
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

  it('says the dice are yours when neither switch is on', () => {
    // Both off is a real state, reachable from Settings in two taps: this build
    // can neither roll the dice nor take a number for them. A control labelled
    // ROLL DAMAGE would be promising one anyway, so there is no control - and
    // the row still says what the pool is, and where the switch is.
    mount(attack(), rollAffordance(false, false));
    expect(buttons()).toHaveLength(0);
    expect(text()).toMatch(/yours to roll/i);
    expect(text()).toMatch(/settings/i);
    expect(text()).toContain('3d10+3');
  });

  it('draws nothing before a roll has been made', () => {
    mount(null);
    expect(container.children).toHaveLength(0);
  });

  it('clears the 44px floor in both layouts', () => {
    mount(attack(), rollAffordance(true, false), 'phone');
    // 52 on a phone: it clears the floor by 8 and stays under ROLL's 66, so the
    // hierarchy in the roll block reads by size alone.
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
     * This control is the last thing in the phone's roll block, directly under
     * ROLL, so it sits in the arc ROLL was placed in - and there is no log on a
     * phone to show what the number used to be. So the second tap asks first,
     * the way the vault's recall does, and says which number it is about to
     * replace. It used to be the last thing in a block that was pinned there;
     * P5-5 unpinned it, and the argument never rested on the pin.
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

/**
 * The dice a table rolls on the table.
 *
 * The Duality dice have taken typed values since the roller was built, and the
 * damage dice could not - so a table that rolls physical dice could resolve
 * half of an attack in the app and had to do the other half in their head. It
 * gates on the same `affordance.canType` the Hope and Fear faces gate on, so
 * one switch means one thing and the two halves of a roll cannot disagree about
 * whether this table types its dice.
 *
 * The engine still does all of the arithmetic: the faces go in as `fixed` and
 * the total comes back out of `rollDamage`. A row that summed them itself would
 * be a second route to a damage total, and the first thing a second route does
 * is get the critical bonus wrong.
 */
describe('typing the dice in, for a table that rolls its own', () => {
  const typing = rollAffordance(true, true);

  /** Open slot `index` and pick a face off its grid, the way a thumb does. */
  function typeFace(index: number, value: number): void {
    const slot = buttons().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Damage die ${index + 1} of `),
    );
    if (slot === undefined) throw new Error(`no slot ${index + 1} to type into`);
    click(slot);
    const face = buttons().find((b) => b.textContent === String(value));
    if (face === undefined) throw new Error(`the face grid has no ${String(value)}`);
    click(face);
  }

  const slots = (): HTMLButtonElement[] =>
    buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Damage die '));

  /**
   * The one button in the row that is not a die slot.
   *
   * Found structurally rather than by its name, because the name is the thing
   * under test: it changes three times over the life of this row, and a helper
   * that searched for one of them could only ever see the state it named.
   */
  const control = (): HTMLButtonElement => {
    const found = buttons().find(
      (b) => !(b.getAttribute('aria-label') ?? '').startsWith('Damage die '),
    );
    if (found === undefined) throw new Error('no control beside the dice slots');
    return found;
  };

  it('draws one slot per die, each one saying which die it is', () => {
    mount(attack({ source: weapon({ count: 3, sides: 20, modifier: 2 }) }), typing);
    expect(slots()).toHaveLength(3);
    expect(slots().map((s) => s.getAttribute('aria-label'))).toEqual([
      'Damage die 1 of 3, not entered',
      'Damage die 2 of 3, not entered',
      'Damage die 3 of 3, not entered',
    ]);
    // 44 square. The face grid it opens is `Die`'s idiom at five across.
    expect(slots()[0]!.style.minHeight).toBe('var(--tap)');
    expect(slots()[0]!.style.minWidth).toBe('var(--tap)');
  });

  it('sends every face to the engine, and resolves on the last one', () => {
    /*
     * A d20 pool on purpose: the mutation this is written against is a `fixed`
     * that loses entries, and with twenty faces a lost die cannot land on the
     * same total by luck.
     */
    mount(attack({ source: weapon({ count: 3, sides: 20, modifier: 2 }) }), typing);
    typeFace(0, 3);
    typeFace(1, 4);
    expect(useApp.getState().log, 'it resolved before every die had a value').toHaveLength(0);

    typeFace(2, 5);
    const log = useApp.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0]!.total).toBe(14);
    expect(log[0]!.detail).toContain('3 + 4 + 5 +2 = 14');
    expect(slots().map((s) => s.textContent)).toEqual(['3', '4', '5']);
  });

  it('adds the critical bonus to typed dice, the way the book’s example does', () => {
    // "if an attack would normally deal 2d8+1 damage, a critical success would
    // deal 2d8+1+16." The SRD's own worked example, arriving through the
    // screen rather than through the engine's own test.
    mount(
      attack({
        source: weapon({ count: 2, sides: 8, modifier: 1 }),
        critical: true,
        outcome: 'critical',
      }),
      typing,
    );
    typeFace(0, 3);
    typeFace(1, 5);
    expect(useApp.getState().log[0]!.total).toBe(3 + 5 + 1 + 16);
  });

  it('shows what a digital roll rolled, so the dice never contradict the total', () => {
    // The Duality bar mirrors its result onto the Hope and Fear faces for the
    // same reason: a row of dice sitting beside a total they do not add up to
    // is the screen disagreeing with itself.
    mount(attack({ source: weapon({ count: 3, sides: 20, modifier: 2 }) }), typing);
    click(buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Roll '))!);
    const entry = useApp.getState().log[0]!;
    const shown = slots().map((s) => Number(s.textContent));
    expect(shown.filter((n) => Number.isFinite(n))).toHaveLength(3);
    expect(shown.reduce((a, b) => a + b, 0) + 2).toBe(entry.total);
  });

  it('names the switch that is off instead of greying out ROLL DAMAGE, before the dice and after', () => {
    /*
     * Typed dice on, digital dice off: the slots are the only way in, and the
     * button knows it. It takes its word from the affordance - ENTER YOUR DICE,
     * the same word the Duality bar wears in this state - because a disabled
     * control still saying ROLL DAMAGE is the app naming the thing it will not
     * do.
     *
     * And it has to hold on both sides of the roll. The control stays
     * `disabled` for the whole of this build, so the accessible name after the
     * dice land is on exactly the same dead target as the name before them -
     * and it is the one nobody looks at, because the visible text is right.
     */
    mount(attack({ source: weapon({ count: 2, sides: 8, modifier: 2 }) }), rollAffordance(false, true));
    expect(slots()).toHaveLength(2);
    expect(control().disabled).toBe(true);
    expect(control().getAttribute('aria-label')).toBe('Enter each of the 2d8+2 dice above');
    expect(control().textContent).toContain('ENTER YOUR DICE');
    expect(control().textContent).not.toContain('ROLL DAMAGE ·');

    // And it still works: the roll this build cannot make is made by hand.
    typeFace(0, 6);
    typeFace(1, 7);
    expect(useApp.getState().log[0]!.total).toBe(15);

    // Typing a total does not turn the roller on. The visible text is honest
    // here - DAMAGE · 2d8+2 over 6 + 7 +2 = 15 - so the name is the only place
    // this can lie, and it told the one user who cannot see the button is dead
    // to press it.
    expect(control().disabled, 'the control woke up when the last die landed').toBe(true);
    const named = control().getAttribute('aria-label') ?? '';
    expect(named).toContain('15 damage');
    expect(named, 'a disabled control asked for a tap it cannot take').not.toMatch(/tap/i);
    click(control());
    expect(useApp.getState().log, 'the dead control rolled after all').toHaveLength(1);

    // The way out this build does have: correct a face and the pool resolves
    // again, which is what the name now says.
    expect(named).toMatch(/change one/i);
    typeFace(1, 8);
    expect(useApp.getState().log[0]!.total).toBe(16);
  });

  it('leaves the character record alone on the typed path too', () => {
    const before = structuredClone(useApp.getState().characters[0]);
    mount(attack({ source: weapon({ count: 2, sides: 8, modifier: 2 }) }), typing);
    typeFace(0, 6);
    typeFace(1, 7);
    expect(useApp.getState().log[0]!.total).toBe(15);
    expect(useApp.getState().characters[0], 'typing damage wrote to the character').toEqual(before);
  });
});

/**
 * THE WAY OUT OF THE FACE GRID — BACKLOG P3-12's other half.
 *
 * A slot turns into a grid of faces when it is tapped, and the grid used to
 * have exactly one way out: pick a number. No cancel, no backdrop, no Escape,
 * and no second tap on the slot, because the slot row is unmounted while the
 * grid is open. A thumb that brushed a slot on a scrolling screen had to enter
 * a value it had not rolled, and then re-open the die and enter the right one -
 * which in this row means two log lines for one attack, the second silently
 * replacing a number the first already announced, on a phone where `RecentLog`
 * is not drawn and nothing on screen contradicts it.
 *
 * `4c99b84` gave the Duality faces their exit and left these without one, so
 * the two die grids on the same screen answered a stray thumb differently.
 * These assertions are deliberately the ones `cockpitRoll.test.tsx` makes of
 * `DieKeypad`, restated against this grid, because the fix is a shared pattern
 * and not a second invention of one: a `var(--tap)` column at the head of the
 * row, Escape on `window` with a `[role="dialog"]` guard over it, focus taken
 * on open and handed back on close.
 *
 * jsdom lays nothing out, so the widths are arithmetic over declared terms read
 * back off the DOM, and the rest are declaration and behaviour reads.
 */
describe('the way out of a face grid that was opened by accident', () => {
  const typing = rollAffordance(true, true);
  const COLUMNS = 5;
  /** Grid outer width -> key width, from the declared padding, gap and border. */
  const key = (outer: number): number => (outer - 2 - 12 - 3 * (COLUMNS - 1)) / COLUMNS;

  const slots = (): HTMLButtonElement[] =>
    buttons().filter((b) => (b.getAttribute('aria-label') ?? '').startsWith('Damage die '));
  const grid = (): HTMLElement | null =>
    container.querySelector<HTMLElement>('div[style*="repeat(5, 1fr)"]');
  const exit = (): HTMLButtonElement | undefined =>
    buttons().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Stop typing damage die'));
  const slot = (index: number): HTMLButtonElement => {
    const found = slots().find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith(`Damage die ${String(index + 1)} of `),
    );
    if (found === undefined) throw new Error(`no slot ${String(index + 1)}`);
    return found;
  };
  const escape = (): void => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  };
  const d10 = (): void => {
    mount(attack({ source: weapon({ count: 3, sides: 10, modifier: 3 }) }), typing);
  };

  it('has a cancel, and it says which die it is cancelling', () => {
    d10();
    expect(grid(), 'the grid is open before anything was tapped').toBeNull();

    click(slot(1));
    expect(grid(), 'tapping a slot opened no grid').not.toBeNull();
    expect(slots(), 'the slot row is still drawn beside the grid').toHaveLength(0);

    const out = exit();
    expect(out, 'the damage grid still has no cancel: BACKLOG P3-12').toBeDefined();
    // It carries the label the unmounted slot row was carrying, so it says
    // which die is being typed as well as how to stop.
    expect(out!.textContent).toContain('DIE 2');
    expect(out!.getAttribute('aria-label')).toBe('Stop typing damage die 2 of 3');
    expect(out!.getAttribute('aria-keyshortcuts')).toBe('Escape');
    // Both floors, declared inline: the height arrives from `align-items:
    // stretch` and would measure zero without this.
    expect(out!.style.width).toBe('var(--tap)');
    expect(out!.style.minWidth).toBe('var(--tap)');
    expect(out!.style.minHeight).toBe('var(--tap)');

    // And it is where the keyboard already is. Opening the grid unmounts the
    // slot that had focus, so without this focus falls to `<body>` and the way
    // out is however many tabs deep the roll block happens to be.
    expect(document.activeElement, 'the grid opens with focus on nothing').toBe(out);

    click(out!);
    expect(grid(), 'the cancel did not shut the grid').toBeNull();
    expect(useApp.getState().log, 'cancelling wrote a damage roll').toHaveLength(0);
    expect(
      slot(1).getAttribute('aria-label'),
      'the cancel entered a value the player never rolled',
    ).toBe('Damage die 2 of 3, not entered');
    expect(document.activeElement, 'the way out fired the keyboard into nothing').toBe(slot(1));
  });

  it('closes on Escape, and commits nothing when it does', () => {
    d10();
    click(slot(0));
    expect(grid()).not.toBeNull();
    escape();
    expect(grid(), 'Escape does nothing, which was half of P3-12').toBeNull();
    expect(slot(0).getAttribute('aria-label')).toBe('Damage die 1 of 3, not entered');
    expect(useApp.getState().log).toHaveLength(0);
    expect(document.activeElement, 'Escape left focus on the body').toBe(slot(0));
  });

  it('leaves Escape to whatever is on top of it', () => {
    /*
     * `useDialog` registers its own unconditional window keydown per dialog and
     * does not `stopPropagation`, so without a topmost check one Escape closes
     * the dialog AND this grid underneath it - and the player comes back to a
     * roll surface that silently reverted. `6c57c01` is that bug on the Duality
     * keypad; this listener is the same listener and needs the same guard.
     */
    d10();
    click(slot(2));
    expect(grid()).not.toBeNull();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    escape();
    expect(grid(), 'one Escape closed a dialog and the grid under it').not.toBeNull();

    dialog.remove();
    escape();
    expect(grid(), 'the guard swallowed the key for good').toBeNull();
  });

  it('still commits a face, and still hands focus back when it does', () => {
    // The control: picking a number was the only way out before this and it is
    // still a way out, so this passes in both directions on everything but the
    // focus read on the last line.
    d10();
    click(slot(1));
    click(buttons().find((b) => b.textContent === '7')!);
    expect(grid()).toBeNull();
    expect(slot(1).getAttribute('aria-label')).toBe('Damage die 2 of 3, showing 7');
    expect(document.activeElement, 'committing a face left focus on the body').toBe(slot(1));
  });

  it('puts every key over the floor at every width in the sweep', () => {
    /*
     * The grid is `flex: 1` where the slot row was, less the 44px exit column
     * and the gap that separates it - and that gap is 4 rather than
     * `DieKeypad`'s 8, because five columns eat a gutter harder than four do.
     * The 4 is not a new number: it is the gap the slot row above already puts
     * between its own 44px targets.
     *
     * Phone: the column is the viewport less 24 of region padding.
     * Cockpit: the roll panel's content box is 402.
     */
    d10();
    click(slot(0));
    const row = grid()!.parentElement!;
    expect(row.style.gap, 'the gap the arithmetic below is over').toBe('4px');
    expect(row.style.alignItems, 'the exit no longer stretches to the grid').toBe('stretch');
    expect(exit()!.style.width).toBe('var(--tap)');

    const EXIT = 44 + 4;
    const phone = (vw: number): number => key(vw - 24 - EXIT);
    for (const [vw, want] of [
      [320, 44.4],
      [360, 52.4],
      [375, 55.4],
      [393, 59],
    ] as Array<[number, number]>) {
      expect(phone(vw), `a key at ${String(vw)}px`).toBeCloseTo(want, 2);
      expect(
        phone(vw),
        `a key at ${String(vw)}px is under the 44px coarse floor`,
      ).toBeGreaterThanOrEqual(44);
    }

    expect(key(402 - EXIT)).toBeCloseTo(65.6, 2);
    // The cockpit panel scrolls and an open grid is a state that can overflow
    // it, so `scrollbar-gutter: stable` reserves a bar that `.scroll` bounds at
    // 8px. Worst case is still over both floors.
    expect(key(402 - 8 - EXIT)).toBeCloseTo(64, 2);

    // And what `DieKeypad`'s 8px gutter would have cost at the narrow end: a
    // quarter of a pixel under the coarse floor, which is why it is 4 here.
    expect(key(320 - 24 - 44 - 8)).toBeCloseTo(43.6, 2);
  });

  // CONTROL. Every term here was already declared before the exit column
  // existed and is unchanged by it; it passes in both directions on purpose,
  // and it is here so that the arithmetic above cannot quietly go stale.
  it('still declares the terms that arithmetic is derived from', () => {
    d10();
    click(slot(0));
    const open = grid()!;
    expect(open.style.gridTemplateColumns).toBe('repeat(5, 1fr)');
    expect(open.style.gap).toBe('3px');
    expect(open.style.padding).toBe('6px');
    for (const k of [...open.querySelectorAll<HTMLElement>('button')]) {
      expect(k.style.minHeight, `key ${k.textContent ?? '?'} lost its floor`).toBe('var(--control)');
    }
  });
});
