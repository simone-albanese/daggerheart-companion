/**
 * The boundary above everything, whose fallback is an export.
 *
 * `ScreenBoundary` wraps each of the five screens, and that covers the code a
 * session spends its time in - but it is mounted *by* `App`, which means
 * everything at or above `App`'s own render is outside every boundary in this
 * app: `useStats()`, which runs in App's render and derives a whole sheet out
 * of the store; `Header`; `TabBar`; the storage, quarantine and integrity
 * banners; `CardReader`; and the licence footer. A throw in any of those is a
 * white page with a character sheet trapped behind it.
 *
 * No reachable throw was found up there. This is hardening rather than a fix,
 * which is exactly why the fallback is shaped the way it is: nobody knows what
 * will land here, so it cannot assume anything about the state it is rendered
 * in.
 *
 * **Why the fallback is an export and not an apology.** A white page is
 * survivable; a white page that a user responds to by clearing site data is
 * not, and "clear the cache and reload" is the first advice anyone will find.
 * IndexedDB goes with it and the characters are gone. So the one control here
 * writes a `.dhbackup` the app can read back, and it is offered
 * unconditionally - not gated on a folder having been chosen, not on
 * `characters.length`, not on `ready`. `runBackup` reports honestly when there
 * is nothing to write, and "there was nothing to save" is a far better answer
 * than a button that was not drawn.
 *
 * It reads through `appBackupDeps`, the same deps the unsaved-work alert uses:
 * the store is the freshest copy the app has and includes anything a failing
 * write never got to the disk, and `listCharacters` there falls back to
 * IndexedDB on its own while `ready` is false. The store is plain module state,
 * so reading it does not need the React tree that has just failed.
 *
 * Ergonomics. Both controls are `.btn`, which carries `min-height: var(--tap)`
 * = 44px unconditionally - not `--control`, which is 34px on a precise pointer.
 * They sit in a centred column with 12px between them, well clear of each
 * other's targets, and the export is `.btn-primary` so the important one is the
 * one the eye lands on. Nothing here is in a thumb arc on purpose: this screen
 * is read before it is touched, it appears perhaps once in the life of an
 * install, and a reflex tap is the last thing it wants.
 */
import { Component, useCallback, useState, type ErrorInfo, type ReactNode } from 'react';
import { runBackup } from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry anywhere in this app; the console is the only reporter.
    console.error('[app]', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return <Fallback error={error} onRetry={() => this.setState({ error: null })} />;
  }
}

/**
 * A function component rather than more of the class, so it can hold the state
 * of the export it runs. A class boundary cannot use hooks, and the alternative
 * - a button that says nothing back - is the failure mode this whole screen
 * exists to avoid.
 */
function Fallback({ error, onRetry }: { error: Error; onRetry: () => void }): React.JSX.Element {
  return (
    <div
      className="app"
      style={{ placeContent: 'center', justifyItems: 'center', gridTemplateRows: '1fr' }}
    >
      <div
        role="alert"
        className="stack"
        style={{ alignItems: 'center', gap: 16, padding: 24, maxWidth: 480, textAlign: 'center' }}
      >
        <span className="t-label" style={{ color: 'var(--text)' }}>
          THE APP COULD NOT DRAW THIS
        </span>
        <p className="t-body" style={{ margin: 0 }}>
          Your characters are still on this device — this is the screen failing, not the storage.
          Take a copy before you do anything else, and especially before clearing this
          site&rsquo;s data, which is the one thing that would delete them.
        </p>
        <ExportEverything />
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
        <code
          className="t-dense"
          style={{
            maxWidth: 460,
            padding: 12,
            borderRadius: 'var(--r2)',
            background: 'var(--panel)',
            border: '1px solid var(--line-soft)',
            color: 'var(--muted)',
            fontFamily: 'var(--mono)',
            overflowWrap: 'anywhere',
          }}
        >
          {error.message}
        </code>
      </div>
    </div>
  );
}

/**
 * Its own component, with its own state, because the sentence underneath has to
 * come from `runBackup`'s answer rather than from the click. A button that
 * turns reassuring on being pressed would be this project's founding rule
 * broken on the one screen where a user has the least reason to trust it - and
 * `runBackup` has three honest ways to write nothing: no characters, a
 * cancelled picker, and a write that failed.
 */
function ExportEverything(): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = useCallback(() => {
    setBusy(true);
    setNote(null);
    void runBackup('manual', { interactive: true }, appBackupDeps)
      .then((outcome) => {
        setNote(
          outcome.wrote
            ? `Saved ${outcome.fileName ?? 'the copy'} — ${outcome.characters} character${outcome.characters === 1 ? '' : 's'}.`
            : outcome.reason,
        );
      })
      .catch((cause: unknown) => {
        setNote(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setBusy(false));
  }, []);

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
        {busy ? 'Exporting…' : 'Export everything'}
      </button>
      {note !== null && (
        <span className="t-dense" style={{ color: 'var(--muted)' }}>
          {note}
        </span>
      )}
    </>
  );
}
