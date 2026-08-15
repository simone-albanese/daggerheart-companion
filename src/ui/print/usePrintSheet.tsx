/**
 * Getting one character onto paper, without the app noticing.
 *
 * A React app has no second document to print, so the sheet is portalled to
 * `<body>` as a sibling of `#root` and the print stylesheet swaps which of the
 * two the printer sees. Both halves of that switch are deliberately narrow:
 *
 *   - the sheet is only in the DOM while a print the user asked for is in
 *     flight, so there is nothing to print by accident and nothing extra in
 *     the tree the rest of the time;
 *   - `body.dhc-printing` is added around that same window, so a Cmd+P at any
 *     other moment prints exactly what it printed before this feature existed.
 *
 * Nothing here is visible on screen. `.dhc-sheet` is `display: none` outside
 * `@media print`, which is why mounting it costs the running app no layout
 * and no pixels.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Character } from '../../../shared/types.ts';
import { useApp } from '../../store/state.ts';
import { CharacterSheet } from './CharacterSheet.tsx';
import { buildSheet } from './sheetModel.ts';
import sheetCss from './sheet.css?inline';

/** The class `sheet.css` keys every one of its print rules off. */
export const PRINTING_CLASS = 'dhc-printing';

const STYLE_ID = 'dhc-print-style';

/**
 * The print stylesheet is a string, injected, rather than an imported module.
 *
 * `import './sheet.css'` would be the ordinary way, and it is wrong here for
 * two reasons. The document one: it would put `@page` and the print rules in
 * the page for good the moment the Settings chunk loads, when the whole point
 * is that they exist only while a print is running. The build one: Settings is
 * a lazily loaded chunk, so its CSS becomes an async stylesheet that Vite names
 * only inside its own `__vite__mapDeps` table - and the service worker, which
 * reads chunk names back out of the build because there is no plugin to hand
 * them over, does not look there. The sheet would have precached everything
 * except itself, and printing offline would come out unstyled.
 */
function mountStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = sheetCss;
  document.head.append(style);
}

const unmountStyle = (): void => document.getElementById(STYLE_ID)?.remove();

export interface PrintHandle {
  /** Ask for a character's sheet. Opens the browser's own print dialog. */
  print: (character: Character) => void;
  printing: boolean;
  /** Render this once, anywhere in the tree. It portals to `<body>`. */
  sheet: React.ReactNode;
}

interface Job {
  character: Character;
  /** Stamped when the print is asked for, not when it renders. */
  printedAt: string;
}

export function usePrintSheet(): PrintHandle {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const massiveDamageRule = useApp((s) => s.prefs.massiveDamageRule);
  const [job, setJob] = useState<Job | null>(null);

  const print = useCallback((character: Character) => {
    // The stylesheet goes in before the sheet does. It is the rule that makes
    // `.dhc-sheet` display:none, so a commit with the markup and without the
    // rule would flash the whole printout across the running app.
    mountStyle();
    setJob({ character, printedAt: new Date().toLocaleDateString() });
  }, []);

  useEffect(() => {
    if (job === null) return;
    const { body } = document;
    body.classList.add(PRINTING_CLASS);

    let live = true;
    let fallback: ReturnType<typeof setTimeout> | null = null;
    const finish = (): void => {
      if (live) setJob(null);
    };
    window.addEventListener('afterprint', finish);

    void (async () => {
      /*
       * Two waits, and both are load-bearing.
       *
       * Fonts, because a page measured in the fallback face repaginates the
       * instant Archivo arrives - and a sheet that was two pages when the
       * dialog opened does not become three while the user is looking at it.
       *
       * Frames, because `window.print()` snapshots whatever the compositor
       * has right now, and one tick after a commit it has nothing.
       */
      try {
        await document.fonts.ready;
      } catch {
        // A browser without the Font Loading API prints with what it has.
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!live) return;
      window.print();
      /*
       * Chrome and Safari both return from `print()` only once the dialog is
       * gone and both fire `afterprint`, so either would do. Firefox has been
       * unreliable about the event; the sheet comes down on whichever lands
       * first, and a short delay covers the engines that queue the job rather
       * than blocking on it.
       */
      fallback = setTimeout(finish, 500);
    })();

    return () => {
      live = false;
      if (fallback !== null) clearTimeout(fallback);
      window.removeEventListener('afterprint', finish);
      body.classList.remove(PRINTING_CLASS);
      unmountStyle();
    };
  }, [job]);

  return {
    print,
    printing: job !== null,
    sheet:
      job === null
        ? null
        : createPortal(
            <CharacterSheet
              sheet={buildSheet(job.character, dataset, index, { massiveDamageRule })}
              printedAt={job.printedAt}
            />,
            document.body,
          ),
  };
}
