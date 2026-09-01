// @vitest-environment jsdom
/**
 * Two lists, one sentence, and the retired claim that was in both of them.
 *
 * The `long-term` hint said *"Advances across downtime and between sessions."*
 * That is not what the book says about a clock. `between sessions` occurs twice
 * in all 69 shipped sections and both are in the Hope and Fear prose; the
 * `countdowns` section's own line is about advancing after rests instead of
 * action rolls. So the hint attributed to the clocks a property the SRD gives
 * to another resource - on the one screen whose first paragraph is about not
 * telling a GM something the app cannot know.
 *
 * It lived in **two** places: `KINDS` in `Countdowns.tsx`, which a GM reads
 * after choosing a kind, and `COUNTDOWN_KINDS` in `AddSheet.tsx`, which they
 * read *while* choosing one. Retiring it in one file only would have left it
 * standing where it does the most work.
 *
 * ## Why this reads the DOM and not the source
 *
 * Because a grep over the two source files is got round by rewording one of
 * them. Both surfaces are mounted and both are read for the same two
 * properties, so a fix applied to one file and not the other is red rather than
 * green. Neither list is exported for this: a test-only export is a symbol
 * `tests/harness/orphans.test.ts` would have to be told about, and the screens
 * are what a GM sees anyway.
 *
 * The wording is not pinned verbatim. What is asserted is the property that was
 * wrong - the sentence names the rest, and does not name the thing the book
 * attributes elsewhere - so an editor may improve the sentence without this
 * going red, and cannot reintroduce the defect without it.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import srd from '../../data/srd-2.0.json' with { type: 'json' };
import type { Dataset } from '@shared/types.ts';
import { indexDataset } from '@engine/character.ts';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { AddSheet } from '../../src/ui/gm/AddSheet.tsx';
import { Countdowns } from '../../src/ui/gm/Countdowns.tsx';
import { useGm } from '../../src/ui/gm/gmStore.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const dataset = srd as unknown as Dataset;
const index = indexDataset(dataset);

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
  useGm.setState({ hydrated: true, session: [], region: 'countdowns' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * The menu button that opens one of `AddSheet`'s forms.
 *
 * Found by its own label span rather than by the button's whole text: each
 * button carries the kind's name *and* the sentence describing it, so matching
 * the element's `textContent` would match nothing.
 */
const chooseKind = (label: string): void => {
  const button = [...container.querySelectorAll('button')].find(
    (b) => (b.querySelector('.t-label')?.textContent ?? '').trim() === label,
  );
  if (button === undefined) throw new Error(`no ${label} button on the add menu`);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

/** Every `<option>` of every `<select>` on screen, as one lowercase string. */
const options = (): string =>
  [...container.querySelectorAll('option')]
    .map((o) => o.textContent ?? '')
    .join(' | ')
    .toLowerCase();

/** The hint the board prints under its own `<select>`, whatever is selected. */
const hintFor = (kind: string): string => {
  const select = container.querySelector<HTMLSelectElement>('#cd-kind');
  if (select === null) throw new Error('the board drew no kind select');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, kind);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return (container.textContent ?? '').toLowerCase();
};

describe('what the two kind lists say about a long-term countdown', () => {
  it('names the rest on the board, and no longer the thing the book puts elsewhere', () => {
    act(() => root.render(createElement(Countdowns, { phone: true })));

    const said = hintFor('long-term');
    expect(said, 'the board no longer says what advances a long-term countdown').toContain('rest');
    expect(
      said,
      'the board still tells a GM a long-term countdown advances between sessions, which is ' +
        'what the SRD says about Fear and Hope and never about a clock.',
    ).not.toContain('between sessions');
  });

  it('names the rest in the form that mints one, which is where it is read first', () => {
    act(() => root.render(createElement(AddSheet, { onClose: () => {} })));
    chooseKind('COUNTDOWN');

    const said = options();
    expect(said).toContain('long-term');
    expect(said, "`AddSheet`'s own kind list says nothing about a rest").toContain('rest');
    expect(
      said,
      '`AddSheet.tsx` still carries the sentence `Countdowns.tsx` retired. This is the list a ' +
        'GM reads *before* they choose the kind, so it is the copy that does the most work.',
    ).not.toContain('between sessions');
  });

  it('leaves the other three kinds alone', () => {
    // The section this correction had to answer: correcting one of four looks
    // arbitrary. It is not, and the reason is that the other three describe the
    // right thing - so they are here, unchanged, as the other half of that
    // sentence.
    act(() => root.render(createElement(Countdowns, { phone: true })));
    expect(hintFor('standard')).toContain('the fiction says it does');
    expect(hintFor('dynamic')).toContain('the outcome of a roll');
    expect(hintFor('loop')).toContain('returns to its starting value');
  });
});
