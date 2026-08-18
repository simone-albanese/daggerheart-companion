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
 *   - `CompatibleIcon` at 18px in the header - the one `<CompatibleIcon
 *     size={18} />` inside `Header` (`Header.tsx`), on every screen, beside the
 *     door to Settings.
 *   - `CompatibleLockup` at 168px, inside `Attribution`, on the empty-library
 *     screen and there only: the `<Attribution compact />` in `EmptyState`
 *     (`App.tsx`) is the whole of it.
 *   - `CompatibleIcon` again, at 14px, in the shell's licence footer - the
 *     `<CompatibleIcon size={14} />` inside `LicenceFooter`
 *     (`LicenceFooter.tsx`) - the icon and not the lockup.
 *   - The About panel carries the notice as words, without the mark: it sits
 *     inside a settings screen that is already dense, and the lockup is
 *     eighteen inches from the reader there rather than a badge on a shelf.
 *
 * Named by symbol and not by line, and that is a correction rather than a
 * style. Those three bullets carried `Header.tsx:588`, `App.tsx:631` and
 * `LicenceFooter.tsx:171`, and all three were correct on the day they were
 * written. Repointing them to the then-current lines fixed them for exactly one
 * commit: the next commit on this same branch added lines *above* all three
 * targets, and every repointed number went stale again - the branch invalidated
 * its own corrections. A symbol survives an insertion above it and a line
 * number cannot. When a line is genuinely wanted, the grep below prints all
 * three and is correct by construction.
 *
 * ~~"`CompatibleLockup`, under `Attribution`, on the first-run screen and in
 * the shell's footer."~~ - **superseded, and both halves were false.** The
 * first-run screen is `Onboarding`, which renders no `Attribution` at all; the
 * one that does is `EmptyState`, which is where you land when the library has
 * gone empty, and those are not the same arrival - it is the difference between
 * a new user and somebody who has just lost their characters. The footer draws
 * `CompatibleIcon` at 14, not the lockup, which is the deliberate trade
 * `LicenceFooter.tsx` argues out under its own `## SUPERSEDED: the argument for
 * keeping Play out of it` heading - the block quote ending "That is a
 * deliberate trade and it is the one thing here worth arguing with." (A heading
 * for the same reason as the bullets: the `:40-47` that stood here was a range
 * a later insertion in that file pushed four lines down.) It is the same false
 * claim the audit took out of `README.md`, one file further in, and it survived
 * because a docblock that says "this list is the one to keep true" is exactly
 * the kind a reader trusts without checking. Checked now:
 * `grep -rn 'CompatibleLockup\|<Attribution\|CompatibleIcon' src/` returns the
 * three call sites above and no fourth - the rest of its output is this file's
 * own declarations, the two imports its pattern catches, and two sentences of
 * prose that name the icon without drawing it.
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
