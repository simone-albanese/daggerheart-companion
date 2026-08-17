// @vitest-environment jsdom
/**
 * The two banners the shell draws above every screen.
 *
 * `App.tsx` renders `<UpdateBanner/>` and `<BackupBanner/>` as flex children of
 * `<main>`, above whatever screen is up, so each one shortens the scrolling
 * column of the screen underneath it by its whole border box plus its 8px top
 * margin. Nothing in the suite had ever rendered either of them beyond a smoke
 * mount in `screens.test.tsx`, and the backup warning had been truncating
 * itself the whole time: `white-space: nowrap` + `text-overflow: ellipsis` over
 * a single span carrying both its clauses, so the clause it cut was always the
 * eviction warning - the reason the banner exists. 115px of 299 hidden at 360,
 * 82 at 393, whole only from 476px up.
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
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { BackupBanner } from '../../src/ui/shell/BackupBanner.tsx';
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
