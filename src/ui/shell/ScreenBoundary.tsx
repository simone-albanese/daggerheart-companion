/**
 * One screen failing must not take the app with it.
 *
 * Play is the screen someone is looking at mid-scene. If a lazily loaded
 * secondary screen throws - a bad import, a corrupt record, a browser that
 * lacks an API - the sheet has to keep working, and the failure has to be
 * legible rather than a white page. So each screen mounts behind its own
 * boundary and reports what actually broke.
 *
 * "Reports" has to mean to the person holding the phone. Both defects this app
 * has shipped were found by someone opening it on their own device, and that is
 * the only bug-finding mechanism this project has: there is no telemetry, and
 * on iOS reaching a console needs a Mac and a cable. So the fallback carries
 * everything the boundary knows - the message, the component stack, the version
 * and the browser - and a button that puts all of it on the pasteboard, because
 * a person who can only retype a sentence sends back a sentence.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { runBackup } from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';
import { APP_VERSION } from '../../transfer/fileIo.ts';
import { copyText } from '../../transfer/pasteboard.ts';

interface Props {
  name: string;
  /**
   * Is there anything around this boundary to go to?
   *
   * `false` for the five screens, which sit inside a shell that keeps drawing a
   * header nav and a tab bar while this fallback is up, so "everything else
   * still works" is a true sentence and a useful one.
   *
   * `true` for the first run, where it is neither. `onboarding` is computed
   * from the store and knows nothing about this boundary, so when the flow
   * throws, the header is still handed `onboarding` and draws no nav and no
   * SETTINGS door, and the tab bar is still suppressed - and every control that
   * could get somebody out, Back and Skip included, lived in the subtree that
   * just died. Measured at 320, 393, 744 and 1280: the whole document holds
   * three buttons, all of them this fallback's own.
   *
   * So the prop exists to stop one sentence being false rather than to change
   * what is drawn. "The app may never claim something happened that did not
   * happen" is the house rule, and the first launch of a new install is the
   * worst place in the app to break it.
   */
  alone?: boolean;
  children: ReactNode;
}

interface State {
  error: Error | null;
  /**
   * Which components were mounted when it threw.
   *
   * Only `componentDidCatch` is ever given this, and it used to hand it
   * straight to `console.error` and drop it - so the fallback structurally
   * could not show the one piece of information that says *where* the failure
   * was, no matter what it wanted to render.
   */
  stack: string | null;
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
  /** What the pasteboard said. Null until the report has been copied. */
  copied: string | null;
}

export class ScreenBoundary extends Component<Props, State> {
  override state: State = {
    error: null,
    stack: null,
    attempts: 0,
    saving: false,
    saved: null,
    copied: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Into state as well as the console. The console is still the only
    // reporter for anyone with a cable; the state is the only one for
    // everybody else.
    this.setState({ stack: info.componentStack ?? null, copied: null });
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  /**
   * Everything this boundary knows, as one block of text to paste into a
   * message.
   *
   * The version and the user agent are in it because the two questions a
   * report always raises are "which build" and "which browser", and a person
   * reading a crash on their own phone can answer neither. No character data:
   * this is sent to someone else, and it is a bug report, not a backup.
   */
  private report(): string {
    const { error, stack } = this.state;
    const agent = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
    return [
      `Duality Companion ${APP_VERSION} — ${this.props.name} could not open`,
      new Date().toISOString(),
      '',
      error?.stack ?? `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
      '',
      stack === null ? 'No component stack was reported.' : `Component stack:${stack}`,
      '',
      agent,
    ].join('\n');
  }

  private readonly copyTheReport = (): void => {
    void copyText(this.report()).then((result) => {
      this.setState({
        copied: result.ok
          ? 'Copied. Paste it into a message to whoever maintains this.'
          : `${result.reason} The details are above — a photograph of this screen works too.`,
      });
    });
  };

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
    const { error, stack, attempts, saving, saved, copied } = this.state;
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
          {this.props.alone === true
            ? // Both halves of the ordinary sentence are false here, and for
              // different reasons: nothing else is drawn, and there are no
              // characters yet to be reassured about. What IS true is that the
              // questions are the only thing that failed and they can be taken
              // again - `Try again` remounts this subtree, and the flow's step,
              // route and answers are local state, so it starts from the first
              // question.
              'Nothing has been saved yet, so there is nothing to lose. Try again starts the questions over.'
            : 'Everything else still works, and nothing has been lost — your characters live in this device’s storage, not in this screen.'}
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
        {/* Folded away, because the message above is the part a player needs
            and this is the part whoever fixes it needs. Open it and it scrolls
            inside its own box rather than stretching the page sideways. */}
        {stack !== null && (
          <details style={{ width: '100%', maxWidth: 520 }}>
            <summary
              className="t-meta"
              style={{
                display: 'flex',
                alignItems: 'center',
                minHeight: 'var(--tap)',
                cursor: 'pointer',
                color: 'var(--muted)',
              }}
            >
              WHERE IT HAPPENED
            </summary>
            <pre
              className="t-dense"
              style={{
                margin: 0,
                padding: 12,
                maxHeight: 220,
                overflow: 'auto',
                borderRadius: 'var(--r2)',
                background: 'var(--panel)',
                border: '1px solid var(--line-soft)',
                color: 'var(--muted)',
                fontFamily: 'var(--mono)',
              }}
            >
              {stack.trim()}
            </pre>
          </details>
        )}
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
          <button type="button" className="btn" onClick={this.copyTheReport}>
            Copy the error report
          </button>
        </div>
        {copied !== null && (
          <span className="t-meta" role="status" style={{ color: 'var(--muted)', maxWidth: 420, textAlign: 'center' }}>
            {copied}
          </span>
        )}
        {saved !== null && (
          <span className="t-meta" role="status" style={{ color: 'var(--muted)' }}>
            {saved}
          </span>
        )}
      </div>
    );
  }
}
