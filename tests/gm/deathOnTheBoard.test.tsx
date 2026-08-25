// @vitest-environment jsdom
/**
 * A PC marks their last Hit Point, and the board notices.
 *
 * It did not, for as long as the board existed. The drawer's HP track could be
 * filled to its maximum and nothing at all happened - no border, no line, no
 * offer - while `DeathMove.tsx` and `engine/death.ts` sat complete and mounted
 * in exactly one place, the player's own vitals. `grep -rni death src/ui/gm/`
 * was empty.
 *
 * ## What is asserted, and what deliberately is not
 *
 * The condition is not a pure function on a `Character`: the board keeps its
 * own tally in `PartyTracks`, four plain counts beside a maximum derived from
 * the sheet, and nothing held it. `hasFallenAt` is covered in
 * `tests/engine/damage.test.ts`; what only exists here is the *wiring* - that
 * the prompt is on the row whose track is full and off the row beside it.
 *
 * The second member is the whole point of that. A prompt that appeared on every
 * open drawer would pass any test written on one row, and a prompt on the wrong
 * row looks exactly like a prompt that works.
 *
 * The three move names are read off the shipped dataset rather than typed here.
 * They are printed and are not buttons, on purpose: the move is the player's to
 * make, on their own screen, with their own dice - and these numbers are a
 * sighting rather than a live sheet.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '../../shared/types.ts';
import { plainTextOf } from '../../shared/richText.ts';
import { deriveStats } from '../../src/engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { PartyBoard } from '../../src/ui/gm/PartyBoard.tsx';
import { hydrateGm, useGm } from '../../src/ui/gm/gmStore.ts';
import { ruleBullets } from '../../src/ui/shared/ruleText.ts';
import { dataset, index, playedCharacter } from '../ui/fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
});

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
  useGm.setState({ hydrated: true, party: [], session: [] });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const sheet = (id: string, name: string): Character => ({ ...playedCharacter(), id, name });

const board = (): void => {
  act(() => root.render(createElement(PartyBoard, { phone: false })));
};

const text = (): string => container.textContent ?? '';
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** Open the nth row's drawer. The header is the only `aria-expanded` here. */
const openRow = (nth = 0): void => {
  click([...container.querySelectorAll('button[aria-expanded]')][nth]!);
};

const put = (...sheets: Character[]): void => {
  act(() => {
    useGm.getState().importParty(sheets, 'file');
  });
};

const mark = (id: string, patch: Record<string, number>): void => {
  act(() => {
    useGm.getState().markPartyTracks(id, patch);
  });
};

/** The prompt's own field, which is what proves the prompt is on THIS row. */
const worseField = (name: string): HTMLInputElement | null =>
  container.querySelector<HTMLInputElement>(
    `input[aria-label="How the situation gets worse for ${name}"]`,
  );

const maxHp = (c: Character): number => deriveStats(c, dataset, index).maxHp;

const notes = () =>
  useGm.getState().session.filter((i): i is Extract<typeof i, { kind: 'note' }> => i.kind === 'note');

describe('when the track the GM keeps fills up', () => {
  it('offers the prompt on that row, and on no other', () => {
    const ilya = sheet('pc-1', 'Ilya');
    const brann = sheet('pc-2', 'Brann');
    put(ilya, brann);
    mark('pc-1', { hp: maxHp(ilya) });
    // One under, deliberately: the boundary is the whole condition.
    mark('pc-2', { hp: maxHp(brann) - 1 });
    board();

    openRow(0);
    expect(worseField('Ilya')).not.toBeNull();
    expect(text()).toContain('Their last Hit Point is marked');

    openRow(1);
    expect(worseField('Brann')).toBeNull();
  });

  it('goes away again when the GM takes the mark back off', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya) });
    board();
    openRow();
    expect(worseField('Ilya')).not.toBeNull();

    mark('pc-1', { hp: maxHp(ilya) - 1 });
    expect(worseField('Ilya')).toBeNull();
  });

  it('says so on the shut row too, beside the count it is read off', () => {
    const ilya = sheet('pc-1', 'Ilya');
    const brann = sheet('pc-2', 'Brann');
    put(ilya, brann);
    mark('pc-1', { hp: maxHp(ilya) });
    board();

    // Not opened: a GM scanning six shut rows for who is down was reading six
    // fractions and doing the comparison themselves.
    expect((text().match(/DEATH MOVE/g) ?? []).length).toBe(1);
  });

  it('prints the three moves the shipped dataset names, and none of them as a button', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya) });
    board();
    openRow();

    const death = dataset.rules.find((r) => r.id === 'death')!;
    const names = ruleBullets(death.body).map((b) => b.label);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(text(), `the board no longer names ${name}`).toContain(name);
      expect(
        buttons().some((b) => (b.textContent ?? '').trim() === name),
        `${name} is a button on the GM's board. The move is the player's to make, on their own ` +
          'screen, with their own dice.',
      ).toBe(false);
    }
  });

  it('quotes the one sentence of the section that is the GM’s half', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya) });
    board();
    openRow();
    expect(text()).toContain('you work with the GM to describe how the situation worsens');
  });
});

describe('recording how the situation gets worse', () => {
  const type = (name: string, value: string): void => {
    const el = worseField(name);
    if (el === null) throw new Error(`no field for ${name}`);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  const record = (): void => {
    const button = buttons().find((b) => (b.textContent ?? '').trim() === 'RECORD');
    if (button === undefined) throw new Error('no RECORD button');
    click(button);
  };

  it('adds exactly one note row carrying what was typed', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya) });
    board();
    openRow();

    type('Ilya', 'The bridge gives way behind them.');
    record();

    const rows = notes();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toContain('Ilya');
    expect(plainTextOf(rows[0]!.note)).toContain('The bridge gives way behind them.');
  });

  it('leaves all four of the member’s tracks exactly where they were', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya), stress: 2, hope: 3, armor: 1 });
    const before = { ...useGm.getState().party[0]!.tracks };
    board();
    openRow();

    type('Ilya', 'The bridge gives way behind them.');
    record();

    // The prompt describes, it does not resolve. Marking or clearing anything
    // here would be the GM's board making the player's move for them.
    expect(useGm.getState().party[0]!.tracks).toEqual(before);
  });

  it('records nothing at all from an empty field', () => {
    const ilya = sheet('pc-1', 'Ilya');
    put(ilya);
    mark('pc-1', { hp: maxHp(ilya) });
    board();
    openRow();

    const button = buttons().find((b) => (b.textContent ?? '').trim() === 'RECORD')!;
    expect(button.hasAttribute('disabled')).toBe(true);

    type('Ilya', '   ');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(notes()).toHaveLength(0);
  });
});
