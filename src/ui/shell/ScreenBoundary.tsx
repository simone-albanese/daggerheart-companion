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

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ScreenBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // No telemetry anywhere in this app; the console is the only reporter.
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

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
        <button
          type="button"
          className="btn"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
