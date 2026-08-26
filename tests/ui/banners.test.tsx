// @vitest-environment jsdom
/**
 * The two banners the shell draws above every screen.
 *
 * `App.tsx` renders `<UpdateBanner/>` and `<BackupBanner/>` as flex children of
 * `<main>`, above whatever screen is up, so each one shortens the scrolling
 * column of the screen underneath it by its whole border box plus its 8px top
 * margin. Nothing in the suite had ever rendered either of them beyond a smoke
 * mount in `screens.test.tsx`, and two things had been true the whole time:
 *
 *   - the backup warning was truncating itself. `white-space: nowrap` +
 *     `text-overflow: ellipsis` over a single span carrying both its clauses,
 *     so the clause it cut was always the eviction warning - the reason the
 *     banner exists. 115px of 299 hidden at 360, 82 at 393, whole from 476 up;
 *   - and the two banners were two copies of one shape. They agreed on the box
 *     and disagreed on the actions gap, the dismiss glyph, its class, its name
 *     and - the one that mattered - its width: 44px in one banner and **18.28**
 *     in the other, beside a button that swaps the running bundle.
 *
 * `ShellBanner` is the shape now, and the second describe below is what stops
 * it becoming two again.
 *
 * What jsdom can and cannot do here, said plainly. It computes no layout, so
 * nothing below measures a wrap, a line count or a rendered width; every such
 * number in these docblocks came from Chrome against the running app and is
 * quoted, not asserted. What jsdom *can* read back is what the component
 * declares - the absence of the properties that did the truncating - and a
 * declaration is exactly what changed and exactly what could silently change
 * back.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { BackupBanner } from '../../src/ui/shell/BackupBanner.tsx';
import { UpdateBanner } from '../../src/ui/shell/UpdateBanner.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  // A phone: the nag's own gate at BackupBanner.tsx sends it away on a phone
  // unless the state is urgent, and "never backed up" is urgent.
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes('max-width: 719px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;

  /*
   * The eviction clause is drawn only when `persisted()` answers false, which
   * is the case the warning is *for*: storage this browser may reclaim. jsdom
   * ships no `navigator.storage`, so without this stub the second clause never
   * renders and the assertion on the whole sentence would pass vacuously.
   */
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persisted: () => Promise.resolve(false) },
  });
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters: [playedCharacter()],
    activeId: null,
    // No `lastBackupAt` at all: the brand-new user, who is the one the banner
    // is on screen for from first launch until the first export.
    prefs: { ...DEFAULT_PREFS },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Mount, then let the `persisted()` promise settle before reading the DOM. */
async function render(element: ReactElement): Promise<void> {
  await act(async () => {
    root.render(element);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const banner = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('[role="status"]');
  if (el === null) throw new Error('the banner drew nothing');
  return el;
};

const message = (): HTMLElement => {
  const el = banner().querySelector<HTMLElement>('span.t-dense');
  if (el === null) throw new Error('the banner drew no message');
  return el;
};

/** Both of them, up at once, which is a state the shell can be in. */
const both = (): { backup: HTMLElement; update: HTMLElement } => {
  const found = [...container.querySelectorAll<HTMLElement>('[role="status"]')];
  const update = found.find((el) => (el.textContent ?? '').includes('A new version is ready'));
  const backup = found.find((el) => (el.textContent ?? '').includes('No backup yet'));
  if (update === undefined || backup === undefined) {
    throw new Error(`expected both banners, got ${found.length}`);
  }
  return { backup, update };
};

const actionsRow = (el: HTMLElement): HTMLElement => {
  const row = el.querySelector<HTMLElement>('span.row');
  if (row === null) throw new Error('the banner drew no actions');
  return row;
};

const noop = (): void => {};

describe('the backup warning says its whole sentence', () => {
  it('carries both clauses, the state and the eviction warning', async () => {
    await render(<BackupBanner />);

    expect(message().textContent).toBe(
      'No backup yet · this browser may clear local data on its own',
    );
  });

  /*
   * The defect itself, and the only thing about it jsdom can see. The three
   * properties below were declared inline at BackupBanner.tsx:65-70; with them
   * the sentence above reached `textContent` in full and the glass in half.
   */
  it('does not declare the ellipsis that used to eat the warning', async () => {
    await render(<BackupBanner />);

    expect(message().style.whiteSpace).toBe('');
    expect(message().style.textOverflow).toBe('');
  });

  /*
   * `overflow: hidden` is the other half of the same mechanism and its absence
   * is deliberate: a flex item that overflows visibly keeps its automatic
   * min-content minimum, which is the longest word, and that floor is what
   * makes the sentence wrap instead of being squeezed to nothing. Hidden
   * overflow with no ellipsis would cut the text with nothing on screen saying
   * so - the same defect, quieter. Same reason there is no `minWidth: 0`.
   */
  it('keeps the min-content floor that makes it wrap: no hidden overflow, no minWidth', async () => {
    await render(<BackupBanner />);

    expect(message().style.overflow).toBe('');
    expect(message().style.minWidth).toBe('');
  });
});

/**
 * One shape, drawn twice - not two shapes that happen to agree.
 *
 * They agreed on the box and disagreed on four smaller things, one of which was
 * a dismiss target of 18.28×44 next to a button that swaps the running bundle.
 * These assertions are on the declarations, which is what a shared component
 * makes identical by construction and what a copy makes identical only until
 * somebody edits one copy.
 */
describe('the two shell banners', () => {
  it('declare one box and one actions row, to the character', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    expect(backup.getAttribute('style')).toBe(update.getAttribute('style'));
    expect(actionsRow(backup).getAttribute('style')).toBe(
      actionsRow(update).getAttribute('style'),
    );
  });

  /*
   * And one primary chip and one dismiss, down to the class. The dismisses had
   * been a `.t-meta` on the inherited ink in one banner and a `.chip` on
   * `var(--dim)` in the other - two shapes and two contrasts for one job. What
   * they may not share is the accessible name, which the third test below is
   * about.
   */
  it('draw one primary chip and one dismiss, class and declaration alike', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    const controls = (el: HTMLElement): HTMLButtonElement[] => [
      ...actionsRow(el).querySelectorAll<HTMLButtonElement>('button'),
    ];
    const [backupAction, backupDismiss] = controls(backup);
    const [updateAction, updateDismiss] = controls(update);

    expect(backupAction?.className).toBe(updateAction?.className);
    expect(backupAction?.getAttribute('style')).toBe(updateAction?.getAttribute('style'));
    expect(backupDismiss?.className).toBe(updateDismiss?.className);
    expect(backupDismiss?.getAttribute('style')).toBe(updateDismiss?.getAttribute('style'));
    expect(backupDismiss?.textContent).toBe(updateDismiss?.textContent);
  });

  /*
   * `--control` is `--tap` = 44 under `(max-width: 1179px), (pointer: coarse)`
   * and 34 above it, so this is the touch floor everywhere a finger can reach
   * and the project's desktop floor where one cannot. Measured with the app
   * running: BACK UP 55.89×44, RELOAD 49.63×44, both dismisses 44×44 at 320
   * through 430, and 34 tall on a mouse cockpit. The dismiss that was 18.28
   * wide declared `minHeight` and no `minWidth` - one glyph in a `.chip` - so
   * the missing half of the pair is what this asserts.
   */
  it('stand every control on the same floor, in both dimensions', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    const buttons = [
      ...backup.querySelectorAll<HTMLButtonElement>('button'),
      ...update.querySelectorAll<HTMLButtonElement>('button'),
    ];
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      const name = button.getAttribute('aria-label') ?? button.textContent;
      expect(button.style.minHeight, `${name} declares no minimum height`).toBe('var(--control)');
      expect(button.style.minWidth, `${name} declares no minimum width`).toBe('var(--control)');
    }
  });

  /*
   * Both can be on screen at once - `App.tsx` renders them as siblings - so a
   * dismiss called "Dismiss" and nothing else names one of two identical-
   * sounding controls stacked 8px apart.
   */
  it('give each dismiss a name that says what it dismisses', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    const label = (el: HTMLElement): string =>
      actionsRow(el).querySelectorAll('button')[1]?.getAttribute('aria-label') ?? '';

    expect(label(backup).toLowerCase()).toContain('backup');
    expect(label(update).toLowerCase()).toContain('update');
    expect(label(backup)).not.toBe(label(update));
  });
});

/**
 * What a banner costs the screen under it, which nothing had ever counted.
 *
 * `App.tsx` draws both banners as `flex: none` children of `<main>`, which is
 * `minHeight: 0; overflow: hidden`, so the screen below loses each banner's
 * whole border box **and its 8px top margin**. `HANDOFF.md` and the commit that
 * found this carry 58, which is the border box alone; the column loses 66.
 * Measured in Chrome, banner off → on, identical at every iPhone width: 553→487
 * at 375×667, 738→672 at 393×852, 760→694 at 402×874, 818→752 at 430×932, and
 * 729→673 on a mouse cockpit where `--control` is 34 instead of 44.
 *
 * jsdom cannot measure any of that. What it can do is add up the declarations
 * the measurement is *made of* - the margin, the padding, the border and the
 * floor the two controls hold the row open at - and fail when one of them
 * changes, which is the only way 66 stops being 66. The Play budget owes the
 * banner this number: `Play.tsx`'s docblock and `playSheet.test.tsx` compute
 * their 730px column from three constants with no banner term in either, so
 * they assert a fit that only holds for a screen with no banner on it. Neither
 * file is this lane's to edit; the number is here.
 */
describe('the height a banner takes off the screen below it', () => {
  /*
   * Read out of `src/ui/tokens.css` rather than assumed, because the whole
   * arithmetic below rests on `--control` being the touch floor on a phone: if
   * that media query ever goes, 66 is fiction and this file should say so.
   */
  const tokens = readFileSync(join(process.cwd(), 'src/ui/tokens.css'), 'utf8');
  const TAP = 44;
  const CONTROL = 34;

  it('reads its two tokens off the stylesheet, not off memory', () => {
    expect(tokens).toContain(`--tap: ${TAP}px;`);
    expect(tokens).toContain(`--control: ${CONTROL}px;`);
    // The width half only. The pointer half of that query widened from
    // `pointer` to `any-pointer` on 2026-08-26 (`DECISIONI-2026-08-25.md`
    // section 12) and this file failed on the wording, not on the claim: what
    // 66 rests on is `--control` being the tap floor AT PHONE WIDTHS, and the
    // pointer term can only ever add machines to that, never remove one. Pin
    // the half this arithmetic depends on and let the other half move.
    expect(
      /@media[^{]*max-width:\s*1179px[^{]*\{\s*:root\s*\{\s*--control:\s*var\(--tap\)/.test(tokens),
      '`--control` is no longer the tap floor at phone widths, so the 66 below is fiction',
    ).toBe(true);
  });

  /**
   * margin-top + border + padding-top + the control floor + padding-bottom +
   * border. `borderTopWidth` reads back empty in jsdom when the shorthand
   * carries a `var()`, so the width comes off the shorthand string itself.
   */
  const columnCost = (el: HTMLElement, control: number): number => {
    const border = parseFloat(el.style.border);
    return (
      parseFloat(el.style.marginTop) +
      border +
      parseFloat(el.style.paddingTop) +
      control +
      parseFloat(el.style.paddingBottom) +
      border
    );
  };

  it('is 66 on a phone and 56 on the cockpit, for both banners alike', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    expect(columnCost(backup, TAP)).toBe(66);
    expect(columnCost(update, TAP)).toBe(66);
    expect(columnCost(backup, CONTROL)).toBe(56);
    expect(columnCost(update, CONTROL)).toBe(56);

    // The 58 and 48 the documents carry are this less the margin, which is the
    // whole reason the number in circulation is eight short.
    expect(columnCost(backup, TAP) - parseFloat(backup.style.marginTop)).toBe(58);
    expect(columnCost(backup, CONTROL) - parseFloat(backup.style.marginTop)).toBe(48);
  });

  /*
   * A new user with a waiting worker gets both, which is the state where two
   * 8px margins sit on top of each other - the one case where adding the two
   * costs up would be wrong if they collapsed. They do not: `<main>` is a flex
   * container and flex items do not collapse margins. Measured at 393×852: 738
   * of column with neither banner, 672 with the nag, 606 with both.
   */
  it('adds up when both are on screen, because flex items collapse no margins', async () => {
    await render(
      <>
        <UpdateBanner apply={noop} />
        <BackupBanner />
      </>,
    );

    const { backup, update } = both();
    expect(columnCost(backup, TAP) + columnCost(update, TAP)).toBe(132);
    expect(columnCost(backup, CONTROL) + columnCost(update, CONTROL)).toBe(112);
  });
});
