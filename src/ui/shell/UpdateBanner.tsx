/**
 * The update offer.
 *
 * A new worker installs itself and then waits, because swapping the bundle
 * mid-combat is the wrong moment and the browser has no way of knowing that.
 * `registerServiceWorker` hands the app an `apply` and says nothing else; this
 * is where the app decides to ask.
 *
 * It is an offer and not a countdown. Someone three hours into a session should
 * be able to ignore this until they are done, and someone who dismisses it
 * still gets the new build on the next cold start - the worker stays waiting,
 * so nothing is lost by saying no.
 */
import { useState } from 'react';

export function UpdateBanner({ apply }: { apply: (() => void) | null }): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);
  if (apply === null || dismissed) return null;

  return (
    <div
      role="status"
      className="spread"
      style={{
        flex: 'none',
        alignItems: 'center',
        gap: 12,
        margin: '8px 20px 0',
        padding: '6px 6px 6px 12px',
        borderRadius: 'var(--r2)',
        background: 'var(--hope-wash)',
        border: '1px solid var(--hope)',
      }}
    >
      <span className="t-dense" style={{ color: 'var(--text-2)' }}>
        A new version is ready · it installs when you reload, and your characters are untouched
      </span>
      <span className="row" style={{ flex: 'none', gap: 6 }}>
        <button
          type="button"
          className="chip"
          onClick={apply}
          style={{ minHeight: 'var(--control)', color: 'var(--text)' }}
        >
          RELOAD
        </button>
        <button
          type="button"
          className="chip"
          aria-label="Dismiss the update notice"
          onClick={() => setDismissed(true)}
          style={{ minHeight: 'var(--control)', color: 'var(--dim)' }}
        >
          ×
        </button>
      </span>
    </div>
  );
}
