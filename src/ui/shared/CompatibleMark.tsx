/**
 * The "Daggerheart Compatible" mark.
 *
 * These are Darrington Press's own community-content logos, supplied with the
 * DPCGL for exactly this use. They are a *compatibility* badge, not a brand for
 * this app: the app keeps its own two-diamond mark in the header, and this one
 * appears where a reader is asking "what is this thing's relationship to the
 * game" - the About panel and the first-run screen.
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

/** The attribution the licence requires, verbatim. */
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
