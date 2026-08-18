// @vitest-environment jsdom
/**
 * `ADD → LINK → Rule`, drawn: the door that offers all 75 SRD sections.
 *
 * The row resolved its target and then walked the body itself with
 * `paragraphs()`, which is the one shape the dataset is *not* in. 38 of the 75
 * shipped sections carry a bullet list or a pipe table - 34 lists, 7 tables, 3
 * of them both - so a GM who linked any of those 38 got a literal `- ` down the
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
