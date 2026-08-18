// @vitest-environment jsdom
/**
 * Countdown templates: a template of a countdown, not a countdown with state.
 *
 * The whole design is one sentence and most of this file is a clause of it. A
 * template has a name, a kind and a starting number and no `value`, so there is
 * nothing on it that can be wrong. Dropping one produces an *instance* — a live
 * clock, a row of the session list — whose `name`, `kind` and `start` come from
 * the template and whose identity does not. Two drops of one template are two
 * independent clocks; forgetting the template leaves both of them running.
 *
 * Two halves would be silent if they broke, and they are what the first four
 * describes are for.
 *
 * The identity. A drop that reused the template's id would look completely
 * correct on screen for exactly as long as the GM dropped it once, and would
 * then produce two rows the store treats as one - `advanceCountdown` maps over
 * every matching id, so moving one would move both. So the ids are asserted
 * three ways: different from each other, different from the template's, and the
 * row's equal to the countdown's.
 *
 * The disk. A `keep` or a `forget` that set the store without writing it looks
 * completely correct until the tab is reloaded, and then the template the GM
 * deleted is back and the one they kept is gone. Both are read back through
 * `loadTemplates`, which is the call the next launch makes, rather than through
 * the store that has just been asked.
 *
 * The last two describes are neither of them. `the shelf on screen` is layout:
 * that there is nothing where the shelf would be until something is on it, and
 * which of the two size tokens each of its controls declares - inline, because
 * a size set in a class measures 0 here and a floor nothing can read is not a
 * floor. `KEEP AS TEMPLATE` is what the GM is told: KEEP has to say that it
 * landed, because the row it produces is above a form whose bottom the button
 * sits at.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SessionItem } from '../../shared/campaigns.ts';
import { Countdowns } from '../../src/ui/gm/Countdowns.tsx';
import {
  COUNTDOWN_TEMPLATES_KEY,
  loadTemplates,
  readTemplates,
  useCountdownTemplates,
  type CountdownTemplate,
} from '../../src/ui/gm/countdownTemplates.ts';
import { useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  /*
   * `activeCampaignId: null` is what keeps this suite off IndexedDB entirely:
   * `schedule` returns before arming a flush when nothing is open, so every
   * `addCountdown` here is a pure store write.
   */
  useGm.setState({ session: [], countdowns: [], fear: 0, activeCampaignId: null });
  useCountdownTemplates.setState({ templates: [] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const board = (): void => {
  act(() => root.render(createElement(Countdowns, { phone: true })));
};

const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const named = (label: string): HTMLButtonElement => {
  const found = buttons().find(
    (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label,
  );
  if (found === undefined) {
    throw new Error(
      `no control called "${label}". Here: ${buttons()
        .map((b) => b.getAttribute('aria-label') ?? b.textContent)
        .join(' | ')}`,
    );
  }
  return found;
};

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** Type into a controlled input the way a keyboard does, through the setter. */
function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const nameField = (): HTMLInputElement =>
  container.querySelector<HTMLInputElement>('input[aria-label="Countdown name"]')!;

const kindField = (): HTMLSelectElement => container.querySelector<HTMLSelectElement>('#cd-kind')!;

const choose = (select: HTMLSelectElement, value: string): void => {
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const rows = (): Array<Extract<SessionItem, { kind: 'countdown' }>> =>
  useGm.getState().session.flatMap((i) => (i.kind === 'countdown' ? [i] : []));

const shelf = (): CountdownTemplate[] => useCountdownTemplates.getState().templates;

/*
 * Inside `act` because a mounted `TemplateShelf` is subscribed to this store,
 * and a `setState` from outside makes React warn that the render it caused was
 * never flushed - a warning that would then sit in this suite's output being
 * ignored, which is how a real one gets missed.
 */
const put = (t: CountdownTemplate): void => {
  act(() => {
    useCountdownTemplates.setState({ templates: [t] });
  });
};

const RITUAL: CountdownTemplate = {
  id: 'tpl-ritual',
  name: 'The ritual completes',
  kind: 'dynamic',
  start: 6,
};

// ---------------------------------------------------------------------------

describe('a template is a template, not a clock', () => {
  it('carries no value, even when the stored record has one', () => {
    // The one property that separates the two things. A stored entry written by
    // some future build that put a `value` on a template must not bring it
    // through: `readTemplates` names the four fields it wants and drops the
    // rest, so the shape a screen gets can never have a number to be wrong.
    const [t] = readTemplates([{ id: 'a', name: 'Tide', kind: 'loop', start: 4, value: 1 }]);
    expect(t).toEqual({ id: 'a', name: 'Tide', kind: 'loop', start: 4 });
    expect(Object.hasOwn(t!, 'value')).toBe(false);
  });

  it('holds start at 1 and above, and rounds it, the way readCountdown does', () => {
    const read = readTemplates([
      { id: 'a', name: 'Zero', start: 0 },
      { id: 'b', name: 'Negative', start: -3 },
      { id: 'c', name: 'Fractional', start: 2.5 },
      { id: 'd', name: 'Missing' },
      { id: 'e', name: 'Nonsense', start: 'six' },
    ]);
    expect(read.map((t) => t.start)).toEqual([1, 1, 3, 1, 1]);
  });

  it('falls back to standard for a kind it does not know, and keeps the row', () => {
    const read = readTemplates([{ id: 'a', name: 'From the future', kind: 'spiral', start: 4 }]);
    expect(read).toHaveLength(1);
    expect(read[0]!.kind).toBe('standard');
  });

  it('drops an entry with no usable name, because the shelf draws the name', () => {
    const read = readTemplates([
      { id: 'a', name: '', start: 4 },
      { id: 'b', name: '   ', start: 4 },
      { id: 'c', start: 4 },
      'not an object',
      null,
      { id: 'd', name: 'Kept', start: 4 },
    ]);
    expect(read.map((t) => t.name)).toEqual(['Kept']);
  });

  it('reads a shelf that is not an array as an empty one', () => {
    expect(readTemplates({ name: 'Tide' })).toEqual([]);
    expect(readTemplates(null)).toEqual([]);
    expect(readTemplates('[]')).toEqual([]);
  });

  it('mints an id for an entry that has none, rather than dropping it', () => {
    // The one field a template can lose without losing what it *is*: the id is
    // a React key and the argument to `forget`, and nothing outside this module
    // has ever stored one. The name is what the GM typed, so the entry stays.
    const [t] = readTemplates([{ name: 'Idless', kind: 'loop', start: 3 }]);
    expect(t?.name).toBe('Idless');
    expect(t?.id).toMatch(/./);
    const [again] = readTemplates([{ name: 'Idless', kind: 'loop', start: 3 }]);
    expect(again?.id).not.toBe(t?.id);
  });

  it('reads a key that is not JSON at all as an empty shelf', () => {
    // A half-written key is the one failure mode localStorage really has, and
    // an exception out of `loadTemplates` runs at module load of the GM chunk -
    // so it would not empty the shelf, it would take the GM screen down.
    localStorage.setItem(COUNTDOWN_TEMPLATES_KEY, '[{"name":"Trunc');
    expect(loadTemplates()).toEqual([]);
  });

  it('has nothing to migrate, and reading the absence does not end it', () => {
    /*
     * There are no templates a GM already has - this is the first build with
     * the idea and no build has ever written this key - so the empty result on
     * its own asserts only what `beforeEach` already did, and the branch it
     * looks like it covers survives being deleted (`JSON.parse(null)` is
     * `null`, and `readTemplates(null)` is `[]` by the `reads a shelf that is
     * not an array` case above). What is actually at stake is the third line.
     * `loadTemplates` runs at module load of the GM chunk on every launch, so
     * a converter that seeded the key - the obvious shape for the migration
     * that is missing here to take - would put a record on the disk of every
     * device that never opened the shelf, and About's erase, the backup and
     * the quota would all carry it from then on. The read stays a read, and
     * the assertion that it does is the one thing here that can fail.
     */
    expect(localStorage.getItem(COUNTDOWN_TEMPLATES_KEY)).toBeNull();
    expect(loadTemplates()).toEqual([]);
    expect(localStorage.getItem(COUNTDOWN_TEMPLATES_KEY)).toBeNull();
  });
});

describe('keeping one', () => {
  it('writes it under its own key, apart from the preferences record', () => {
    const id = useCountdownTemplates.getState().keep('The ritual completes', 'dynamic', 6);
    expect(id).not.toBeNull();
    expect(loadTemplates()).toEqual([
      { id, name: 'The ritual completes', kind: 'dynamic', start: 6 },
    ]);
    expect(localStorage.getItem('dhc.prefs.v1')).toBeNull();
  });

  it('refuses a blank name and writes nothing at all', () => {
    expect(useCountdownTemplates.getState().keep('   ', 'standard', 4)).toBeNull();
    expect(shelf()).toEqual([]);
    expect(localStorage.getItem(COUNTDOWN_TEMPLATES_KEY)).toBeNull();
  });

  it('is idempotent on the same three fields, and is not on a different one', () => {
    const keep = useCountdownTemplates.getState().keep;
    const first = keep('The ritual completes', 'dynamic', 6);
    const again = keep('  The ritual completes  ', 'dynamic', 6);
    expect(again).toBe(first);
    expect(shelf()).toHaveLength(1);

    expect(keep('The ritual completes', 'dynamic', 8)).not.toBe(first);
    expect(shelf()).toHaveLength(2);
  });
});

describe('forgetting one', () => {
  it('writes the shorter shelf to the disk, not only to the screen', () => {
    // The half that would be silent: a `forget` that set the store without
    // saving looks completely correct until the tab is reloaded, and then the
    // template the GM deleted is back. Read through `loadTemplates`, which is
    // the same call the next launch makes.
    const keep = useCountdownTemplates.getState().keep;
    const gone = keep('The tide turns', 'loop', 3);
    keep('The ritual completes', 'dynamic', 6);
    expect(loadTemplates()).toHaveLength(2);

    useCountdownTemplates.getState().forget(gone!);

    expect(loadTemplates().map((t) => t.name)).toEqual(['The ritual completes']);
  });

  it('is a no-op for an id that is not on the shelf', () => {
    useCountdownTemplates.getState().keep('The tide turns', 'loop', 3);
    useCountdownTemplates.getState().forget('nothing-by-that-name');
    expect(loadTemplates()).toHaveLength(1);
  });
});

describe('dropping one', () => {
  it('produces a clock whose start and kind are the template’s', () => {
    put(RITUAL);
    board();
    click(named('Drop a countdown from the template The ritual completes'));

    expect(rows()).toHaveLength(1);
    const dropped = rows()[0]!.countdown;
    expect(dropped.name).toBe(RITUAL.name);
    expect(dropped.kind).toBe(RITUAL.kind);
    expect(dropped.start).toBe(RITUAL.start);
    // Born full: a clock that arrived already part-spent would be state the
    // template does not have and cannot have given it.
    expect(dropped.value).toBe(RITUAL.start);
  });

  it('produces an identity the template did not give it, twice over', () => {
    put(RITUAL);
    board();
    const drop = (): void => click(named('Drop a countdown from the template The ritual completes'));
    drop();
    drop();

    const [a, b] = rows();
    expect(rows()).toHaveLength(2);
    expect(a!.countdown.id).not.toBe(b!.countdown.id);
    expect(a!.countdown.id).not.toBe(RITUAL.id);
    expect(b!.countdown.id).not.toBe(RITUAL.id);
    // The row and its countdown share one id on purpose; see `addCountdown`.
    expect(a!.id).toBe(a!.countdown.id);
    expect(b!.id).toBe(b!.countdown.id);
  });

  it('leaves the other clock alone when one of the two is advanced', () => {
    // The consequence of the ids above, stated as behaviour: `withCountdown`
    // matches on the countdown's id, so two drops sharing one would move
    // together and the GM would have one clock wearing two rows.
    put(RITUAL);
    board();
    const drop = (): void => click(named('Drop a countdown from the template The ritual completes'));
    drop();
    drop();

    const [a, b] = rows();
    act(() => useGm.getState().advanceCountdown(a!.countdown.id, -2));
    const after = rows();
    expect(after.find((r) => r.id === a!.id)!.countdown.value).toBe(4);
    expect(after.find((r) => r.id === b!.id)!.countdown.value).toBe(6);
  });

  it('leaves the pin where it was rather than moving it or clearing it', () => {
    /*
     * The shelf never touches the top bar. Asserted against a pin that is
     * already set, because "nothing is primary" after a drop onto an empty
     * session is also what a drop that *cleared* the pin would produce, and
     * clearing it is the other half of the mistake: a GM who pinned the clock
     * that matters and then dropped a second one must still be looking at the
     * first.
     */
    put(RITUAL);
    board();
    let already = '';
    act(() => {
      already = useGm.getState().addCountdown('The bridge holds', 'standard', 4);
      useGm.getState().setPrimaryCountdown(already);
    });

    click(named('Drop a countdown from the template The ritual completes'));

    expect(rows()).toHaveLength(2);
    expect(rows().filter((r) => r.primary).map((r) => r.id)).toEqual([already]);
  });

  it('leaves the clocks running when the template is forgotten', () => {
    put(RITUAL);
    board();
    click(named('Drop a countdown from the template The ritual completes'));
    click(named('Forget the template The ritual completes'));

    expect(shelf()).toEqual([]);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.countdown.name).toBe(RITUAL.name);
  });
});

describe('the shelf on screen', () => {
  it('draws nothing where it would be until something is on it', () => {
    board();
    expect(container.textContent).not.toContain('Templates');
    put(RITUAL);
    board();
    expect(container.textContent).toContain('Templates');
  });

  it('declares both of its heights inline, where a test can read them', () => {
    // A height set in a class measures 0 in jsdom, so a floor declared there is
    // a floor nothing can check. `--tap` is 44px on every pointer. `--control`
    // is 34px only where both halves of one condition hold - a window at least
    // 1180px wide *and* a fine pointer - because `tokens.css` declares the 34px
    // base and then hands the token back to `--tap` under
    // `@media (max-width: 1179px), (pointer: coarse)`. A narrow window with a
    // mouse gets 44px too, which is the part a "34px for a mouse" gloss gets
    // wrong.
    put(RITUAL);
    board();
    const drop = named('Drop a countdown from the template The ritual completes');
    expect(drop.style.minHeight).toBe('var(--tap)');

    const forget = named('Forget the template The ritual completes');
    expect(forget.style.minHeight).toBe('var(--control)');
    // Both axes on the forget: a 34px-wide target under a thumb is under this
    // project's own floor even when it is 44px tall. The token carries the
    // condition, so declaring it on the width is how the width gets the same
    // 44px the height already has everywhere a finger can land.
    expect(forget.style.width).toBe('var(--control)');
  });

  it('gives the drop the width and the forget the corner', () => {
    // The asymmetry is the safety argument: a mis-tap on DROP costs one tap to
    // undo, a mis-tap on forget costs something the GM typed.
    put(RITUAL);
    board();
    expect(named('Drop a countdown from the template The ritual completes').style.flex).toBe(
      '1 1 0%',
    );
    expect(named('Forget the template The ritual completes').style.flex).toBe('0 0 auto');
  });
});

describe('KEEP AS TEMPLATE, on the form that already has the three fields', () => {
  it('keeps what is typed without starting a countdown', () => {
    board();
    type(nameField(), 'Reinforcements arrive');
    choose(kindField(), 'loop');
    click(named('KEEP AS TEMPLATE'));

    expect(shelf()).toHaveLength(1);
    expect(shelf()[0]!.name).toBe('Reinforcements arrive');
    expect(shelf()[0]!.kind).toBe('loop');
    // The form's own default start, untouched.
    expect(shelf()[0]!.start).toBe(4);
    // The half that would be silent: a submit button here would have started a
    // clock as well, and the shelf row would have hidden it.
    expect(rows()).toEqual([]);
  });

  it('clears nothing, so ADD can follow it with the fields still filled', () => {
    board();
    type(nameField(), 'Reinforcements arrive');
    click(named('KEEP AS TEMPLATE'));
    expect(nameField().value).toBe('Reinforcements arrive');

    click(named('ADD'));
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.countdown.name).toBe('Reinforcements arrive');
  });

  it('says KEPT once the shelf holds this exact triple, and goes back when one field moves', () => {
    /*
     * The receipt has to be on the button. A keep puts its row on the shelf,
     * which is above this whole form - so on a phone the only thing that
     * changed is off the top of the fold this button sits at the bottom of,
     * and a GM who pressed it has no way to tell from here that it landed.
     *
     * The second half is the half that would be silent: a label that latched
     * on the first keep and never came back would say KEPT over a name that
     * has never been kept, which is worse than saying nothing.
     */
    board();
    type(nameField(), 'Reinforcements arrive');
    expect(named('KEEP AS TEMPLATE').disabled).toBe(false);

    click(named('KEEP AS TEMPLATE'));

    expect(named('KEPT AS A TEMPLATE').disabled).toBe(true);
    expect(container.textContent).not.toContain('KEEP AS TEMPLATE');

    // One field away is a different template, and the button offers to keep it.
    choose(kindField(), 'loop');
    expect(named('KEEP AS TEMPLATE').disabled).toBe(false);
  });

  it('is dead until there is a name to keep', () => {
    board();
    expect(named('KEEP AS TEMPLATE').disabled).toBe(true);
    type(nameField(), '   ');
    expect(named('KEEP AS TEMPLATE').disabled).toBe(true);
    type(nameField(), 'The tide turns');
    expect(named('KEEP AS TEMPLATE').disabled).toBe(false);
  });
});
