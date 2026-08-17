// @vitest-environment jsdom
/**
 * The one control on the Play screen that destroys something on a tap.
 *
 * `86f4a0e` removed a `mask-image` from the Play phone column. That mask had
 * been clipping the paint *and the hit-testing* of the four `position: fixed`
 * dialogs mounted inside that column, and taking it off was right - it is what
 * made those dialogs usable on a phone at all. What it also did was hand CLEAR
 * ALL its first real target, in the worst place on the glass. Measured in
 * Chrome at 393x852 with three conditions on:
 *
 *   the conditions panel runs y12-840 and the shell's tab bar runs y791-852, so
 *   the panel covers 49 of the tab bar's 61px and all four tab centres at y822
 *   land inside this footer. PLAY's centre (x49.2) landed on CLOSE, CARDS
 *   (x147.5) and BUILD (x245.7) on the footer's own background - and GM (x344)
 *   on CLEAR ALL, at x283.6-364, y781-825. Two synthetic taps at (344, 822)
 *   emptied the store.
 *
 * So the most practised gesture this app has - reaching for a tab at the bottom
 * of the screen - wiped every marker on the sheet, on one tap, with no
 * confirmation, no undo and no log line. `conditionsStore.ts` says what that
 * costs: the state "is set and cleared a dozen times a session, and losing it
 * costs one fight".
 *
 * ## WHAT THIS FILE CAN AND CANNOT PROVE
 *
 * Not the geometry. jsdom computes no layout, so nothing here measures a rect,
 * a hit-test or a thumb arc; the numbers above and in `Conditions.tsx`'s
 * docblock come from the Chrome harness and stay there. What is testable in
 * jsdom is the half that decides whether that geometry can hurt anyone:
 *
 *   - one tap does not destroy anything;
 *   - the control left in the box the GM centre lands on is the *cancel*, in
 *     the same DOM node, so the repeat of the mis-reach puts the conditions
 *     down rather than committing them - which is the whole reason a plain
 *     arm-in-place was not enough here;
 *   - the commit is not in that row at all;
 *   - the armed state is announced and not only drawn, because this is a
 *     `role="dialog"` and a screen-reader user gets no colour change;
 *   - and the sentence it announces is true: it names the named state that is
 *     switched off, which clearing deletes, and it does not claim the derived
 *     Vulnerable, which clearing cannot touch.
 *
 * Every assertion below fails on the pre-fix component.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { useApp } from '../../src/store/state.ts';
import { ConditionsControl } from '../../src/ui/player/Conditions.tsx';
import {
  NO_CONDITIONS,
  useConditions,
  type Conditions,
} from '../../src/ui/player/conditionsStore.ts';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;
let character: Character;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useConditions.setState({ byCharacter: {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The sheet, plus whatever conditions the case is about, plus the door. */
function open(conditions: Partial<Conditions> = {}, sheet?: Partial<Character>): void {
  character = { ...playedCharacter(), ...sheet };
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
    log: [],
    openCard: null,
  });
  useConditions.setState({
    byCharacter: { [character.id]: { ...NO_CONDITIONS, ...conditions } },
  });
  act(() => {
    root.render(<ConditionsControl />);
  });
  click(byLabelStartingWith('Conditions'));
}

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const buttons = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>('button')];

const name = (el: Element): string =>
  el.getAttribute('aria-label') ?? (el.textContent ?? '').trim();

function byLabelStartingWith(prefix: string): HTMLElement {
  const found = buttons().find((b) => name(b).startsWith(prefix));
  if (found === undefined) {
    throw new Error(
      `no control whose name starts with "${prefix}". On screen: ${buttons().map(name).join(' | ')}`,
    );
  }
  return found;
}

const maybe = (prefix: string): HTMLElement | undefined =>
  buttons().find((b) => name(b).startsWith(prefix));

/**
 * Anything that offers to clear the lot, by face *or* by name.
 *
 * Both, and this is not belt and braces. The control that shipped carried the
 * words CLEAR ALL and no `aria-label` at all, so "is there a control called
 * `Clear all conditions`" is a question the broken build answers `no` to - an
 * assertion phrased that way passes on the defect it was written to catch. The
 * face is what the old build had and the name is what this one has, and neither
 * may be present when there is nothing to clear.
 */
const clearAllOffer = (): HTMLElement | undefined =>
  buttons().find(
    (b) =>
      name(b).startsWith('Clear all conditions') || (b.textContent ?? '').trim() === 'CLEAR ALL',
  );

const dialog = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="dialog"]');
  if (el === null) throw new Error('nothing on screen carries role="dialog"');
  return el;
};

/**
 * The footer's last row - the one the tab bar is drawn under.
 *
 * Found by walking to the row CLOSE is in rather than by a class or an index,
 * because "the row a thumb reaching for a tab arrives in" is a fact about where
 * CLOSE and its neighbour are, and CLOSE has been the left end of it since the
 * dialog was written.
 */
const bottomRow = (): HTMLElement => {
  const close = buttons().find((b) => name(b) === 'CLOSE');
  if (close?.parentElement == null) throw new Error('the footer has no CLOSE');
  return close.parentElement;
};

const stored = (): Conditions => useConditions.getState().byCharacter[character.id] ?? NO_CONDITIONS;

const announcement = (): string =>
  (dialog().querySelector('[role="alert"]')?.textContent ?? '').replace(/\s+/g, ' ').trim();

const TWO_AND_A_NAME: Partial<Conditions> = {
  hidden: true,
  restrained: true,
  named: [
    { id: 'n1', label: 'Strange Patterns', on: true },
    { id: 'n2', label: 'No Mercy', on: false },
  ],
};

describe('CLEAR ALL is where a thumb goes by accident', () => {
  it('destroys nothing on the first tap', () => {
    open(TWO_AND_A_NAME);
    click(byLabelStartingWith('Clear all conditions'));
    expect(
      stored(),
      'one tap on CLEAR ALL emptied the sheet - this is the tap a reach for the GM tab makes',
    ).toMatchObject({ hidden: true, restrained: true });
    expect(stored().named).toHaveLength(2);
  });

  /*
   * The assertion this whole shape exists for.
   *
   * A player reaching for GM cannot see the tab bar - the panel is drawn over
   * it - so they reach again, at the same coordinates. An arm-in-place would
   * have committed on that second reach, which is the same accident twice. The
   * two controls trade places instead: while it is armed the box is the cancel.
   *
   * `toBe` on the element, not a lookup by name: "the same box" is a claim
   * about one node keeping its place in the row, and a re-implementation that
   * swapped in a different element there would move the target on a real phone
   * while still passing a test that only asked what the label says.
   */
  it('leaves the cancel, not the commit, in the box the GM tab’s centre lands on', () => {
    open(TWO_AND_A_NAME);
    const box = byLabelStartingWith('Clear all conditions');
    click(box);

    expect(name(box), 'the armed box does not read as the way out').toBe('Keep them');
    expect(box.textContent).toBe('KEEP THEM');
    expect(
      buttons().find((b) => name(b) === 'Keep them'),
      'arming replaced the control instead of re-labelling it, so the box moved',
    ).toBe(box);

    click(box);
    expect(
      stored(),
      'the second tap in the same place committed - that is the mis-reach repeated',
    ).toMatchObject({ hidden: true, restrained: true });
    expect(stored().named).toHaveLength(2);
    expect(name(box), 'the second tap did not put the confirmation down').toBe(
      'Clear all conditions',
    );
  });

  it('puts the commit outside the row the tab bar covers', () => {
    open(TWO_AND_A_NAME);
    click(byLabelStartingWith('Clear all conditions'));

    const commit = byLabelStartingWith('Confirm: clear');
    expect(
      bottomRow().contains(commit),
      'the commit is in the same row as CLOSE, which is the row the four tab centres land in',
    ).toBe(false);
    expect(
      commit.compareDocumentPosition(bottomRow()) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the commit is drawn after the bottom row rather than above it',
    ).toBeTruthy();
  });

  it('takes it on the second tap, and takes exactly what it named', () => {
    open(TWO_AND_A_NAME);
    click(byLabelStartingWith('Clear all conditions'));
    click(byLabelStartingWith('Confirm: clear'));
    expect(stored()).toEqual(NO_CONDITIONS);
    expect(
      maybe('Confirm: clear'),
      'the commit is still on screen with nothing left to commit',
    ).toBeUndefined();
    expect(clearAllOffer(), 'CLEAR ALL survived having nothing to clear').toBeUndefined();
  });

  /*
   * The founding rule of this component, on a third surface. The door into this
   * dialog is permanent, so the state it is opened in most often is the one
   * where there is nothing to clear - and in that state the GM centre now lands
   * on an inert footer rather than on a destructive control.
   */
  it('draws no CLEAR ALL when there is nothing to clear', () => {
    open();
    expect(dialog(), 'the dialog did not open').not.toBeNull();
    expect(
      clearAllOffer(),
      'a control that destroys nothing is offered in the place a mis-reach lands',
    ).toBeUndefined();
    expect(buttons().find((b) => name(b) === 'CLOSE'), 'CLOSE went with it').toBeDefined();
  });
});

describe('what the armed state says out loud', () => {
  it('announces itself in a live region rather than only in colour', () => {
    open(TWO_AND_A_NAME);
    const live = dialog().querySelector('[role="alert"]');
    expect(
      live,
      'nothing in this dialog is a live region, so arming is silent to a screen reader',
    ).not.toBeNull();
    expect(announcement(), 'the region was mounted with its sentence already in it').toBe('');

    click(byLabelStartingWith('Clear all conditions'));
    expect(
      dialog().querySelector('[role="alert"]'),
      'the region was re-mounted rather than filled, so the change is not spoken',
    ).toBe(live);
    expect(announcement()).toBe(
      'CLEAR THEM removes Hidden, Restrained, Strange Patterns and No Mercy, and there is no undo. KEEP THEM leaves them alone.',
    );
  });

  /*
   * A named state that is switched off is still deleted: `clear` writes
   * `NO_CONDITIONS`, whose `named` is `[]`. The strip's own list filters on
   * `n.on`, because it answers "what is true of you"; this one answers "what
   * will not exist afterwards", and the two are different lists.
   */
  it('names the switched-off state, because clearing deletes the label too', () => {
    open({ named: [{ id: 'n2', label: 'No Mercy', on: false }] });
    click(byLabelStartingWith('Clear all conditions'));
    expect(announcement()).toContain('removes No Mercy,');
    expect(name(byLabelStartingWith('Confirm: clear'))).toBe('Confirm: clear No Mercy');

    click(byLabelStartingWith('Confirm: clear'));
    expect(stored().named, 'the label the sentence promised to remove survived').toHaveLength(0);
  });

  /*
   * The honesty rule, on the one condition this control cannot take. A full
   * Stress track derives Vulnerable; `clear` writes `NO_CONDITIONS` and the
   * derivation is not in that record, so it is back on the next render.
   */
  it('does not claim the Vulnerable a full Stress track derives', () => {
    const played = playedCharacter();
    open({ hidden: true }, { stress: { marked: played.stress.max, max: played.stress.max } });
    click(byLabelStartingWith('Clear all conditions'));

    const said = announcement();
    expect(said).toContain('CLEAR THEM removes Hidden, and there is no undo.');
    expect(said, 'the sentence lists a condition this control cannot remove').not.toContain(
      'removes Hidden, Vulnerable',
    );
    expect(said).toContain('The Vulnerable your full Stress derives stays');

    click(byLabelStartingWith('Confirm: clear'));
    expect(stored()).toEqual(NO_CONDITIONS);
    expect(
      name(byLabelStartingWith('Conditions:')),
      'the sheet went quiet about a condition that is still true',
    ).toBe('Conditions: Vulnerable');
  });

  it('puts the confirmation down when the list it was armed against changes', () => {
    open(TWO_AND_A_NAME);
    click(byLabelStartingWith('Clear all conditions'));
    expect(maybe('Confirm: clear')).toBeDefined();

    // The SET/ACTIVE chip for Hidden, inside the dialog's own scroll.
    const setChip = buttons().find((b) => b.textContent === 'ACTIVE');
    expect(setChip, 'no ACTIVE chip to turn a condition off with').toBeDefined();
    click(setChip!);

    expect(
      maybe('Confirm: clear'),
      'the commit is still armed against a list that no longer says what it said',
    ).toBeUndefined();
    expect(name(byLabelStartingWith('Clear all conditions'))).toBe('Clear all conditions');
  });
});

/**
 * The other control in this dialog, and the axis it never declared a floor on.
 *
 * Here rather than in a file of its own because this is the only harness in the
 * suite that opens `ConditionsDialog`, and because the SET/ACTIVE chip is
 * already the control the cases above reach for when they need the armed state
 * put down. The claim is not about CLEAR ALL, and it says so.
 *
 * The arithmetic is the class's, written out once in `gearPicker.test.tsx`
 * beside the same assertion: `.chip` is IBM Plex Mono at 9.5px with
 * `letter-spacing: 0.06em`, the shipped face is a flat 600/1000 advance, so a
 * character is 6.27px. This button declares `padding: '0 12px'` and no border
 * (`base.css:42-50` zeroes it), so `SET` measured 3 x 6.27 + 24 = **42.81px**
 * inside a 44px-tall box, at every viewport under 1180 and under any coarse
 * pointer. `ACTIVE` is six characters and 61.62, so it was only ever the *off*
 * state that was under the floor - which is the state the chip is in whenever
 * a player is aiming at it to switch a condition on. It clears WCAG 2.5.8's
 * 24px; the floor it breaks is this project's own.
 *
 * jsdom computes no layout, so 42.81 cannot be measured here. The assertion is
 * the declaration that produces 44, over every chip in the standard-conditions
 * list rather than over the one that was caught, and it is checked in both
 * states because they are two different labels in one button.
 */
describe('the SET chip is a whole target', () => {
  const setChips = (): HTMLElement[] =>
    buttons().filter((b) => {
      const face = (b.textContent ?? '').trim();
      return face === 'SET' || face === 'ACTIVE';
    });

  it('states the control floor on both axes, in both of its states', () => {
    open({ hidden: true });
    const chips = setChips();
    // Three standard conditions, so three chips, and the fixture has one on -
    // both faces on screen at once, which is the point of seeding one.
    expect(chips.length, 'the standard conditions list has no SET chips').toBe(3);
    const faces = chips.map((c) => (c.textContent ?? '').trim());
    expect(faces, 'no chip is drawn in its off state').toContain('SET');
    expect(faces, 'no chip is drawn in its on state').toContain('ACTIVE');

    for (const chip of chips) {
      const face = (chip.textContent ?? '').trim();
      expect(chip.style.minHeight, `the ${face} chip declares no height floor`).toBe(
        'var(--control)',
      );
      expect(chip.style.minWidth, `the ${face} chip declares no width floor`).toBe(
        'var(--control)',
      );
    }
  });
});
