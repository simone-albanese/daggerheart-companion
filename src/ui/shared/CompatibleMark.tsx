/**
 * The "Daggerheart Compatible" mark.
 *
 * `public/brand/` holds four files - the lockup in a light and a dark cut, and
 * the dagger-and-flame icon in both - and every one of them is Darrington
 * Press's own artwork, supplied with the DPCGL for exactly this use. That is
 * worth saying plainly, because it is the one piece of official art in this
 * repository and the previous version of this docblock left a reader with the
 * impression there was none. It is licensed art, not free art: it may be used
 * as a *compatibility* badge and as nothing else.
 *
 * Which is why the app keeps its own two-diamond `AppMark` for identity, and
 * why this one appears only where a reader is asking "what is this thing's
 * relationship to the game". Today that is three places, and this list is the
 * one to keep true:
 *
 *   - `CompatibleIcon` in the header, on every screen, beside the door to
 *     Settings.
 *   - `CompatibleLockup`, under `Attribution`, on the first-run screen and in
 *     the shell's footer.
 *   - The About panel carries the notice as words, without the mark: it sits
 *     inside a settings screen that is already dense, and the lockup is
 *     eighteen inches from the reader there rather than a badge on a shelf.
 *
 * It is deliberately never used as the PWA icon. An app whose home-screen icon
 * is the official logo reads as an official app, which this is not.
 */
import { useApp } from '../../store/state.ts';
import { useMedia } from './useMedia.ts';

function useDark(): boolean {
  const theme = useApp((s) => s.prefs.theme);
  const prefersLight = useMedia('(prefers-color-scheme: light)');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return !prefersLight;
}

/** The full lockup: dagger, flame, "DAGGERHEART COMPATIBLE". */
export function CompatibleLockup({ width = 220 }: { width?: number }): React.JSX.Element {
  const dark = useDark();
  return (
    <img
      src={dark ? './brand/dh-compatible-dark.svg' : './brand/dh-compatible-light.svg'}
      alt="Daggerheart Compatible"
      width={width}
      height={Math.round((width * 155.6) / 638.82)}
      style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
    />
  );
}

/** Just the dagger-and-flame icon, for tight spaces. */
export function CompatibleIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  const dark = useDark();
  return (
    <img
      src={dark ? './brand/dh-icon-dark.png' : './brand/dh-icon-light.png'}
      alt="Daggerheart Compatible"
      title="Daggerheart Compatible — independent community content"
      width={Math.round((size * 288) / 328)}
      height={size}
      style={{ display: 'block', flex: 'none' }}
    />
  );
}

/**
 * The attribution the licence requires, verbatim, and the only copy of it.
 *
 * There used to be two: this array, and a separately typed string constant in
 * `About.tsx` that normalised to the same 342 characters with nothing holding
 * them together. Nothing failed while they agreed, and nothing would have
 * failed while they disagreed either - which is the whole problem, since the
 * text of a licence notice is the one string in this app that is not allowed to
 * drift. Every surface reads this now, and
 * `tests/ui/attribution.test.tsx` fails if a second copy is ever declared.
 *
 * Two elements rather than one paragraph because two surfaces set them as two
 * blocks; `ATTRIBUTION.join(' ')` is the one-paragraph form and is exactly what
 * the deleted constant said.
 */
export const ATTRIBUTION = [
  'This product includes materials from the Daggerheart System Reference Document 1.0, © Critical Role, LLC, under the terms of the Darrington Press Community Gaming License. More information at www.daggerheart.com.',
  'Daggerheart Compatible. Independent community content, not affiliated with or endorsed by Critical Role, LLC or Darrington Press.',
] as const;

export function Attribution({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <CompatibleLockup width={compact ? 168 : 220} />
      {ATTRIBUTION.map((line) => (
        <p
          key={line.slice(0, 24)}
          className="t-dense"
          style={{ margin: 0, color: 'var(--muted)', maxWidth: 560 }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}
