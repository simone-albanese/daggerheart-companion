/**
 * "My character is on another device" is not a question. It is a door, and
 * there are three of them.
 *
 * Somebody who already has a character has nothing to tell this app about how
 * they play - it is about to arrive on the sheet they made. So this route asks
 * exactly one question, the first one, and its answer opens onto a file, a
 * camera and the clipboard.
 *
 * ## Three existing entry points, wired rather than rebuilt
 *
 *   FILE    `importFromPicker` (fileIo.ts), which is the File System Access API
 *           where it exists and a synthetic `<input type="file">` on iOS. This
 *           is Settings' own import call, verbatim.
 *   CAMERA  `<Receiver/>` (Transfer.tsx), which owns the scanner, the frame
 *           pips, the payload decode and the camera stop on unmount.
 *   PASTE   `pasteLibrary` (pasteboard.ts), which is what the iOS recovery
 *           screen already calls, and which has to run inside the gesture.
 *
 * Two of the three end in `useImportFlow`, which is the module that exists
 * because four doors each used to roll their own unconditional `put` and
 * quietly overwrite a newer local copy. The camera does not: `Receiver` owns
 * the whole scan, calls `importCharacters` itself and draws its own conflict
 * rows. What all three genuinely share is the store's `importCharacters` /
 * `resolveImport` pair, which is where the no-clobber rule actually lives - a
 * conflict comes back as a question rather than a write, on every door.
 *
 * This paragraph used to say all three ended in `useImportFlow`, and that
 * sentence is what invited the reader to assume the camera door's completion
 * was handled for it. It was not, for a year, and nothing here said so.
 *
 * ## Nothing is handed off from here
 *
 * There is no `onArrived` and no completion callback of any kind. The flow that
 * mounts this ends when a character is on the device, so it watches the store
 * for one - see the subscription in `Onboarding.tsx`. A door that forgets to
 * report itself is the defect that shipped; a door that has nothing to report
 * cannot repeat it.
 *
 * ## Nothing is claimed that did not happen
 *
 * Each door has a failure and each failure is said on this screen in the
 * register the rest of the app uses. A file that will not parse says what
 * `ImportError` says. A file picker closed without a choice says nothing at all,
 * because cancelling is not an error and a message would be the app inventing
 * one. A clipboard that cannot be read, or that holds something that is not a
 * character, says what `pasteLibrary` returns. A camera that is missing, denied
 * or already in use says what `cameraError` writes - "No camera was found on
 * this device. Import the file instead." - which is why the camera door is not a
 * dead button on a laptop with the lens taped over: it is a button that opens
 * onto a sentence.
 *
 * And an import that succeeds says which characters arrived, by name, through
 * `describeImport`. A count on its own is what let "Imported 1 character" stand
 * over a newer copy that had just been destroyed.
 *
 * The camera is mounted on the tap and not before, so the permission prompt
 * arrives with the reason for it on screen, and unmounting the door stops the
 * track - the indicator light never outlives the screen.
 *
 * ## Why this is a `lazy()` chunk of its own
 *
 * It reaches `Transfer.tsx`, which pulls `src/transfer/qr.ts` and
 * `src/transfer/fileIo.ts`. `App.tsx` splits Settings out of the shell for
 * exactly that reason and says so. Importing this from `Onboarding.tsx`
 * directly would drag the QR codec into the chunk that draws the first frame on
 * every device that ever opens the app, and no test in this suite could see it -
 * it shows only in `dist/assets`. The questions themselves ship in the shell,
 * because a spinner on the first screen anybody sees is not acceptable; this is
 * behind a tap, where a frame of "opening" is what a tap looks like anyway.
 *
 * ## Ergonomics
 *
 * Three doors at 64px with two 10px gaps is 212px, in the same 369px column and
 * against the same 44px floor as every other row in this flow. The camera door
 * expands `Receiver` in place beneath the rows, and its `<video>` is capped at
 * 360 wide at 4/3 - 270px tall - plus the progress row and the status line, so
 * this screen scrolls where the questions do not. That is the whole reason the
 * pinned nav pays the home-indicator inset and the notice does not: what is
 * pinned stays reachable while the doors grow.
 *
 * A first-time user who taps the wrong door gets out two ways. Tapping another
 * door replaces the open one - the camera stops on unmount when it does - and
 * Back in the pinned nav returns to the question, where the other three answers
 * are.
 */
import { useCallback, useState } from 'react';
import { ImportError, importFromPicker } from '../../transfer/fileIo.ts';
import { pasteLibrary } from '../../transfer/pasteboard.ts';
import { ImportConflicts, useImportFlow } from '../shared/ImportConflicts.tsx';
import { Receiver } from '../settings/Transfer.tsx';
import { AnswerRow } from './parts.tsx';

type Door = 'file' | 'camera' | 'paste';

export function ImportDoors(): React.JSX.Element {
  const { conflicts, run, choose } = useImportFlow();
  const [open, setOpen] = useState<Door | null>(null);
  const [busy, setBusy] = useState(false);
  /** What happened, and whether it was a refusal. Never both, never neither. */
  const [status, setStatus] = useState<{ text: string; failed: boolean } | null>(null);

  const fromFile = useCallback(async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await importFromPicker();
      // Null is the picker being closed. Nothing happened, so nothing is said:
      // a message here would be the app reporting an error the user committed.
      if (file === null) return;
      const message = await run(file.characters, file.warnings);
      setStatus({ text: message, failed: false });
    } catch (cause) {
      setStatus({
        text: cause instanceof ImportError || cause instanceof Error ? cause.message : String(cause),
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  }, [run]);

  const fromClipboard = useCallback(async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await pasteLibrary();
      if (!result.ok) {
        setStatus({ text: result.reason, failed: true });
        return;
      }
      const message = await run(result.characters);
      setStatus({ text: message, failed: false });
    } catch (cause) {
      // Without this the door stayed on "Reading…" for ever and the person was
      // left holding a clipboard with no way to try again.
      setStatus({ text: cause instanceof Error ? cause.message : String(cause), failed: true });
    } finally {
      setBusy(false);
    }
  }, [run]);

  /*
   * One handler, so that opening a door always closes the last one.
   *
   * That is what stops the camera outliving a change of mind: `Receiver` stops
   * its track on unmount, and unmounting it is what `setOpen` does here.
   */
  const openDoor = (door: Door): void => {
    setStatus(null);
    setOpen(door);
    if (door === 'file') void fromFile();
    if (door === 'paste') void fromClipboard();
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="stack" role="group" aria-label="Three ways in" style={{ gap: 10 }}>
        <AnswerRow
          glyph="FILE"
          label={busy && open === 'file' ? 'Reading the file…' : 'Choose a file'}
          sub=".DHCHAR OR .DHBACKUP"
          selected={open === 'file'}
          onPick={() => openDoor('file')}
        />
        <AnswerRow
          glyph="CAM"
          label="Open the camera"
          sub="POINT IT AT THE OTHER SCREEN"
          selected={open === 'camera'}
          onPick={() => openDoor('camera')}
        />
        <AnswerRow
          glyph="COPY"
          label={busy && open === 'paste' ? 'Reading the clipboard…' : 'Paste what you copied'}
          sub="FOR A PHONE THAT WILL NOT HAND OVER FILES"
          selected={open === 'paste'}
          onPick={() => openDoor('paste')}
        />
      </div>

      {open === 'camera' && <Receiver />}

      {status !== null && (
        <p
          className="t-dense"
          role={status.failed ? 'alert' : 'status'}
          style={{ margin: 0, color: status.failed ? 'var(--stress)' : 'var(--text-2)' }}
        >
          {status.text}
        </p>
      )}

      <ImportConflicts
        conflicts={conflicts}
        busy={busy}
        onChoose={(conflict, choice) => void choose(conflict, choice)}
      />

      <p className="t-meta" style={{ margin: 0, color: 'var(--dim)' }}>
        NONE OF THE THREE USES THE NETWORK
      </p>
    </div>
  );
}
