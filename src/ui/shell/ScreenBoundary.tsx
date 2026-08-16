/**
 * One screen failing must not take the app with it.
 *
 * Play is the screen someone is looking at mid-scene. If a lazily loaded
 * secondary screen throws - a bad import, a corrupt record, a browser that
 * lacks an API - the sheet has to keep working, and the failure has to be
 * legible rather than a white page. So each screen mounts behind its own
 * boundary and reports what actually broke.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { runBackup } from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  /**
   * How many times Try again has been pressed since this screen last rendered.
   *
   * Reset the moment the children come back, in `componentDidUpdate`, so
   * "retrying did not help" means two failures in a row rather than two
   * failures at any point in the life of the tab.
   */
  attempts: number;
  /** An export is running. */
  saving: boolean;
  /** What the export said, in its own words. Null until one has been run. */
  saved: string | null;
}

export class ScreenBoundary extends Component<Props, State> {
  override state: State = { error: null, attempts: 0, saving: false, saved: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry anywhere in this app; the console is the only reporter.
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  override componentDidUpdate(): void {
    // The retry worked. Whatever fails here next is entitled to its own first
    // attempt; leaving the counter up would offer the escape hatch to a screen
    // that has only just crashed for the first time.
    if (this.state.error === null && this.state.attempts !== 0) {
      this.setState({ attempts: 0 });
    }
  }

  /**
   * Write the whole library out, from inside a screen that will not render.
   *
   * Not a jump to Settings, which is the screen that owns the export: Settings
   * is itself behind one of these boundaries, and if it is the screen that
   * crashed then pointing at it is pointing at the crash. `runBackup` is what
   * that screen's button calls anyway, and `appBackupDeps` is what makes the
   * file contain what is in the store rather than what last reached the disk.
   */
  private readonly saveACopy = (): void => {
    this.setState({ saving: true, saved: null });
    void runBackup('manual', { interactive: true }, appBackupDeps)
      .then((outcome) => {
        this.setState({
          saved: outcome.wrote
            ? `Saved ${outcome.fileName ?? 'the copy'} — ${String(outcome.characters)} character${outcome.characters === 1 ? '' : 's'}.`
            : (outcome.reason ?? 'Nothing was written.'),
        });
      })
      .catch((cause: unknown) => {
        this.setState({ saved: cause instanceof Error ? cause.message : String(cause) });
      })
      .finally(() => this.setState({ saving: false }));
  };

  override render(): ReactNode {
    const { error, attempts, saving, saved } = this.state;
    if (error === null) return this.props.children;

    /*
     * Try again re-renders the same children from the same state, so on its own
     * it is a loop: the second failure is the first one again, and the button
     * that promised a way out is the thing keeping the user in. Once a retry
     * has been disproven the screen stops leading with it and leads with the
     * export instead, because a character that cannot be reached through a
     * broken screen can still be written to a file and opened somewhere else.
     */
    const retried = attempts > 0;

    return (
      <div
        className="stack"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}
      >
        <span className="t-label">{this.props.name} could not open</span>
        <p className="t-body" style={{ maxWidth: 420, textAlign: 'center' }}>
          Everything else still works, and nothing has been lost — your characters live in this
          device&rsquo;s storage, not in this screen.
        </p>
        <code
          className="t-dense"
          style={{
            maxWidth: 520,
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
        {retried && (
          <p className="t-dense" style={{ maxWidth: 420, margin: 0, textAlign: 'center' }}>
            Trying again gave the same failure, so this one is not passing. Write your characters
            out to a file before you do anything else — the file opens in any copy of this app, and
            on any device.
          </p>
        )}
        <div
          className="row"
          style={{ gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          {retried && (
            <button type="button" className="btn btn-primary" onClick={this.saveACopy} disabled={saving}>
              {saving ? 'Saving…' : 'Save a copy of everything'}
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => this.setState((s) => ({ error: null, attempts: s.attempts + 1 }))}
          >
            Try again
          </button>
        </div>
        {saved !== null && (
          <span className="t-meta" role="status" style={{ color: 'var(--muted)' }}>
            {saved}
          </span>
        )}
      </div>
    );
  }
}
