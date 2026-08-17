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
 *
 * It outranks the first-run questions for the same reason, and `App.tsx` checks
 * `needsPasteboardBridge()` before the onboarding gate to make that so. An empty
 * library is the state onboarding claims too, and on this device it has an
 * explanation - so being asked whether you are a player or a GM would be the app
 * answering a question nobody asked while ignoring the one they did.
 */
import { useState } from 'react';
import { pasteLibrary } from '../../transfer/pasteboard.ts';
import { useApp } from '../../store/state.ts';
import { AppMark } from '../shared/DomainMark.tsx';
import { ImportConflicts, useImportFlow } from '../shared/ImportConflicts.tsx';

export function Recovery(): React.JSX.Element {
  const setScreen = useApp((s) => s.setScreen);
  const { conflicts, run, choose } = useImportFlow();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * This screen was exempted from the no-clobber rule on the grounds that it
   * "only renders on an empty library". That is not the same as "only renders
   * when the library is empty": `App.tsx` renders it whenever
   * `needsCharacter` is true, and `state.ts` sets `characters` to `[]`
   * whenever `db.readLibrary()` rejects or blows its eight-second deadline -
   * an upgrade blocked by another tab, a private window that denies the
   * database, an iOS eviction caught mid-flight. So the storage banner saying
   * "your characters are almost certainly still there" could sit directly
   * above a Paste button that wrote over them by id.
   */
  const paste = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await pasteLibrary();
      if (!result.ok) {
        setStatus(result.reason);
        return;
      }
      const message = await run(result.characters);
      setStatus(message);
      if (useApp.getState().characters.length > 0) setScreen('play');
    } catch (cause) {
      // Without this the button stayed on "Reading…" forever and the user was
      // left holding a clipboard they had no way to try again with.
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
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

      <div style={{ width: '100%', maxWidth: 460 }}>
        <ImportConflicts
          conflicts={conflicts}
          busy={busy}
          onChoose={(conflict, choice) => void choose(conflict, choice)}
        />
      </div>
    </div>
  );
}
