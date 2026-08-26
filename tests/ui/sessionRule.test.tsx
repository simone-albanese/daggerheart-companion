// @vitest-environment jsdom
/**
 * `ADD → LINK → Rule`, drawn: the door that offers every shipped SRD section.
 *
 * The row resolved its target and then walked the body itself with
 * `paragraphs()`, which is the one shape the dataset is *not* in. A shipped
 * section carrying a bullet list or a pipe table got a literal `- ` down the
 * left of every list and a wall of raw pipes where a table should be. Twelve
 * tables ship; not one of them was drawn as a table on this surface.
 *
 * Nothing was thrown and nothing was missing, which is why it lasted: the text
 * was all there, in the order the book wrote it, wearing its markup. The only
 * test that would have caught it is one that looks at what reached the DOM, so
 * that is what this does - it mounts the arm and reads the elements.
 *
 * Pinned against the shipped `data/srd-1.0.json` rather than a built fixture.
 * A hand-made section proves the renderer can draw a list; only the shipped
 * file proves the sections a GM can actually reach are drawn, and that is the
 * half that was wrong.
 */
import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SessionItem } from '@shared/campaigns.ts';
import type { Ref } from '@shared/types.ts';
import { SessionBody } from '../../src/ui/gm/SessionBody.tsx';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

const noop = (): void => {};

/** A session row that links to one rules section, open. */
const ruleRow = (id: string): SessionItem => ({
  id: 'r1',
  kind: 'link',
  name: 'A rule to have to hand',
  order: 0,
  collapsed: false,
  target: { kind: 'rule', ref: id as Ref },
});

const draw = async (id: string): Promise<void> => {
  await act(async () => {
    root.render(<SessionBody item={ruleRow(id)} phone={false} onOpenTool={noop} />);
  });
};

/** Every element that carries exactly this text and nothing else. */
const cells = (text: string): Element[] =>
  [...container.querySelectorAll('*')].filter((el) => (el.textContent ?? '').trim() === text);

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('a rules section linked from a GM session', () => {
  it('draws a bullet list as a list, with the dash gone', async () => {
    // `making-gm-moves`, p.64 - one of the 34 sections that carry bullets.
    await draw('making-gm-moves');

    const items = [...container.querySelectorAll('li')].map((li) => (li.textContent ?? '').trim());
    expect(items.length).toBeGreaterThan(0);
    expect(items).toContain('Roll with Fear');
    // The bullet is the `<li>`, not two characters of text inside it.
    expect(items.filter((item) => item.startsWith('-'))).toEqual([]);
    // And nowhere else on the row either: a paragraph beginning `- ` is the
    // whole defect, whichever element it is sitting in.
    expect(container.textContent ?? '').not.toMatch(/(^|\n)\s*-\s/);
  });

  it('draws a pipe table as a table, with the pipes gone', async () => {
    // `giving-out-gold-equipment-and-loot`, p.69 - the Average Costs table. The
    // item asking for it is `HANDOFF-2026-08-18.md`'s number 10, not anything in
    // `BACKLOG.md`, which names neither this table nor an item 10. Twelve rows,
    // two columns.
    await draw('giving-out-gold-equipment-and-loot');

    const text = container.textContent ?? '';
    expect(text).not.toContain('|');
    // Both header cells are on the row, each on its own.
    expect(cells('Expense').length).toBeGreaterThan(0);
    expect(cells('Cost').length).toBeGreaterThan(0);
    // And a row is two cells rather than one string of markup. The two strings
    // below ARE typed in, which `srdReference.ts:29-30` allows for a test - what
    // this pins is that they arrive as separate cells rather than as one piped
    // line, and the last assertion is the one carrying that. An earlier comment
    // here claimed the opposite of the three lines under it.
    const rows = [...container.querySelectorAll('span')].map((el) => (el.textContent ?? '').trim());
    expect(rows).toContain('Luxury inn room per night');
    expect(rows).toContain('1 Bag');
    expect(rows.filter((row) => row.includes('Luxury inn room per night | 1 Bag'))).toEqual([]);
  });

  it('says which page of the SRD it is quoting', async () => {
    await draw('giving-out-gold-equipment-and-loot');
    expect(container.textContent ?? '').toContain('SRD 1.0 · P.69');
  });

  /**
   * CONTROL. `the-golden-rule` is one of the 37 sections that are prose all the
   * way down, and it read correctly before this change and reads correctly
   * after. It is here so a renderer that turned every paragraph into a list
   * item to satisfy the two cases above would still be caught.
   */
  it('leaves a section that is only prose as paragraphs', async () => {
    await draw('the-golden-rule');
    expect(container.querySelectorAll('li')).toHaveLength(0);
    expect(container.querySelectorAll('p').length).toBeGreaterThan(0);
    expect((container.textContent ?? '').trim()).not.toBe('');
  });
});

/*
 * The two things this row does NOT ask of the block it draws.
 *
 * `BlockView` took `{ block }` and nothing else until SHOW's rule search needed
 * to land on one paragraph or one bullet inside a block and to light the words
 * the GM had typed. It grew two optional props for that - `land` and `mark` -
 * and four callers pass neither. Three of them are asserted from the outside in
 * `tests/gm/reference.test.tsx`; this row is the fourth, and its docblock in
 * `ReferenceTables.tsx` names this file as the place its case goes.
 *
 * Why it is worth a case at all: this row draws SRD prose inside the plan for
 * the evening, where a GM is reading rather than searching. Nobody typed a
 * query, so no word here is anybody's hit, and nothing on this row has any
 * business moving the page under a GM who was reading the row above it.
 *
 * It goes red on the two ways a GM would feel that stopping: `BlockView`
 * scrolling or marking on its own account, and this row being handed a `land`
 * whose ref moves the page or a `mark` that lights a word - which is what an
 * invented argument would be, if either prop stopped being optional and this
 * call site had to pass something.
 *
 * The prop ceasing to be optional is not this file's to catch and is not
 * claimed here: `tsc` fails at the call site before any of this runs. Nor is a
 * `land` whose ref does nothing - that is a prop passed for no reason, not a
 * page that moved, and what is asserted below is what a GM would see.
 */
describe('what that row asks of the block, which is nothing', () => {
  /**
   * Run `run` with a `scrollIntoView` on the prototype that records rather than
   * scrolls, and give back what it was asked to bring into view.
   *
   * jsdom implements no `scrollIntoView` at all, so what this installs is the
   * only one there is while it runs; the descriptor is saved and put back
   * rather than deleted blind, because this file installing no no-op of its own
   * is true today and is not this helper's to decide for the tests after it.
   */
  const whileWatching = async (run: () => Promise<void>): Promise<Element[]> => {
    const seen: Element[] = [];
    const proto = Element.prototype as unknown as { scrollIntoView?: unknown };
    const was = Object.getOwnPropertyDescriptor(proto, 'scrollIntoView');
    proto.scrollIntoView = function scrollIntoView(this: Element): void {
      seen.push(this);
    };
    try {
      await run();
    } finally {
      if (was === undefined) delete proto.scrollIntoView;
      else Object.defineProperty(proto, 'scrollIntoView', was);
    }
    return seen;
  };

  it('brings nothing into view, on bullets or on a table', async () => {
    const asked = await whileWatching(async () => {
      await draw('making-gm-moves');
      // Not vacuous: the bullets are on screen, so a `BlockView` really drew.
      expect(container.querySelectorAll('li').length).toBeGreaterThan(0);

      // And again on the section whose blocks carry a table, since that is the
      // one part `BlockView` hands to somebody else to draw.
      await draw('giving-out-gold-equipment-and-loot');
      expect(cells('Expense').length).toBeGreaterThan(0);
    });
    expect(asked).toEqual([]);
  });

  it('lights not one word, because nobody here typed one', async () => {
    await draw('making-gm-moves');
    /*
     * All three of the places `BlockView` draws a string in its own words are
     * on screen before the count below means anything: a subhead, a paragraph
     * and a bullet. `making-gm-moves` carries all three and no table, and the
     * section drawn after it carries the table and none of the three, so the
     * two together are what puts every word of this row under the count -
     * a table cell included, though those are `RuleTableView`'s to draw and
     * not among the three strings `mark` is handed.
     */
    const subheads = [...container.querySelectorAll('span.t-label')].map((el) =>
      (el.textContent ?? '').trim(),
    );
    expect(subheads).toContain('WHEN TO MAKE A MOVE');
    expect(container.querySelectorAll('p.t-read').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('li').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);

    await draw('giving-out-gold-equipment-and-loot');
    expect(cells('1 Handful').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });
});
