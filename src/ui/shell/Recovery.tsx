/**
 * The screen an installed iOS app shows instead of "no character yet".
 *
 * A phone that has just installed the app and finds no characters is almost
 * never a new user - a new user would not have installed it. It is far more
 * likely someone who built a character in Safari, liked it enough to add it to
 * the Home Screen, and has just been handed an empty app by a platform rule
 * they have no reason to know about.
 *
 * Telling them "create a character" there would be the app confidently giving
 * the wrong instruction at the worst possible moment. So it offers the bridge
 * first and creation second.
 */
import { useState } from 'react';
import { pasteLibrary } from '../../transfer/pasteboard.ts';
import { useApp } from '../../store/state.ts';
import { AppMark } from '../shared/DomainMark.tsx';

export function Recovery(): React.JSX.Element {
  const importCharacter = useApp((s) => s.importCharacter);
  const setScreen = useApp((s) => s.setScreen);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const paste = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    const result = await pasteLibrary();
    if (!result.ok) {
      setStatus(result.reason);
      setBusy(false);
      return;
    }
    for (const c of result.characters) await importCharacter(c);
    setStatus(
      `Brought over ${result.characters.length} character${result.characters.length === 1 ? '' : 's'}.`,
    );
    setBusy(false);
    setScreen('play');
  };

  return (
    <div
      className="stack scroll"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}
    >
      <AppMark size={26} />
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div className="t-vital">Nothing here yet</div>
        <p className="t-body" style={{ marginTop: 10 }}>
          If you made a character in Safari before adding this to your Home Screen, it is still
          there — iOS keeps an installed app&rsquo;s data separate from the browser&rsquo;s, so it
          did not come across on its own.
        </p>
        <p className="t-dense" style={{ marginTop: 10, color: 'var(--muted)' }}>
          In Safari: <strong style={{ color: 'var(--text-2)' }}>Menu → Characters → Copy all
          characters</strong>. Then come back here and tap Paste.
        </p>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={() => void paste()} disabled={busy}>
          {busy ? 'Reading…' : 'Paste from Safari'}
        </button>
        <button type="button" className="btn" onClick={() => setScreen('settings')}>
          Import a file
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('build')}>
          Start fresh
        </button>
      </div>

      {status !== null && (
        <p className="t-dense" role="status" style={{ maxWidth: 440, textAlign: 'center' }}>
          {status}
        </p>
      )}
    </div>
  );
}
