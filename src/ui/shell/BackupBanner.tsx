/**
 * The backup nag.
 *
 * Safari's ITP can evict IndexedDB after roughly seven days of inactivity, and
 * `navigator.storage.persist()` is granted inconsistently. A group that plays
 * every three weeks would lose a character between sessions. So: a quiet line
 * that becomes loud at five days, and an offer to restore after seven.
 *
 * A character is months of someone's work. Losing it is the one unforgivable
 * bug in an app like this, and a discreet indicator is a cheap insurance
 * premium against it.
 */
import { useEffect, useState } from 'react';
import { daysSinceBackup } from '../../store/prefs.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from '../shared/useLayout.ts';

export function BackupBanner(): React.JSX.Element | null {
  const prefs = useApp((s) => s.prefs);
  const characters = useApp((s) => s.characters);
  const setScreen = useApp((s) => s.setScreen);
  const [dismissed, setDismissed] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const phone = useIsPhone();

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (dismissed || characters.length === 0) return null;

  const days = daysSinceBackup(prefs);
  const never = days === null;
  const urgent = never || days >= 5;
  if (!never && days < 3) return null;
  // A phone has no vertical room to spare on Play. The nag waits there until
  // it is genuinely urgent; Settings carries the same state permanently.
  if (phone && !(days !== null && days >= 5)) return null;

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
        background: urgent ? 'var(--hope-wash)' : 'var(--panel)',
        border: `1px solid ${urgent ? 'var(--hope)' : 'var(--line-soft)'}`,
      }}
    >
      <span
        className="t-dense"
        style={{
          color: 'var(--text-2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {never ? 'No backup yet' : `Last backup: ${days} day${days === 1 ? '' : 's'} ago`}
        {persisted === false && ' · this browser may clear local data on its own'}
      </span>
      <span className="row" style={{ flex: 'none', gap: 4 }}>
        <button
          type="button"
          className="chip"
          onClick={() => setScreen('settings')}
          style={{ minHeight: 'var(--control)', background: 'var(--raised)', color: 'var(--text)' }}
        >
          BACK UP
        </button>
        <button
          type="button"
          className="t-meta"
          onClick={() => setDismissed(true)}
          style={{ minHeight: 'var(--control)', minWidth: 'var(--control)' }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </span>
    </div>
  );
}
