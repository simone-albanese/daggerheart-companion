/**
 * Screen to camera, with no network in between.
 *
 * The sender loops its frames forever and never learns whether anyone is
 * watching; the receiver collects indices in whatever order they arrive and
 * says how many it still needs. That asymmetry is the whole design - two phones
 * that have never met need no pairing, no channel and no agreement about
 * anything except which way to point.
 *
 * Past about fifteen frames the loop takes longer than most people will hold a
 * phone steady, so the file stops being the fallback and becomes the offer.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from '../../../shared/types.ts';
import { exportCharacter } from '../../transfer/fileIo.ts';
import { characterFromPayload, framesForCharacter } from '../../transfer/frames.ts';
import {
  createFrameCycler,
  createQrScanner,
  describeTransfer,
  encodeFrames,
  FRAME_RATE,
  requestMaxBrightness,
  type CompletedTransfer,
  type QrMatrix,
  type ScreenBoost,
  type TransferAdvice,
  type TransferProgress,
} from '../../transfer/qr.ts';
import { useApp, type ImportConflict } from '../../store/state.ts';
import { describeImport, ImportConflicts } from '../shared/ImportConflicts.tsx';
import { Field, Note, Rows, Section } from './parts.tsx';

type Mode = 'idle' | 'send' | 'receive';

export function Transfer({
  innerRef,
}: {
  innerRef?: (el: HTMLElement | null) => void;
}): React.JSX.Element {
  const characters = useApp((s) => s.characters);
  const activeId = useApp((s) => s.activeId);
  const [mode, setMode] = useState<Mode>('idle');
  const [pick, setPick] = useState<string | null>(null);

  const chosen = characters.find((c) => c.id === (pick ?? activeId)) ?? characters[0] ?? null;

  return (
    <Section
      id="transfer"
      title="Transfer"
      lead="Move a character between two devices at the table with no network, no account and no cable. One phone shows a loop of codes, the other watches it."
      innerRef={innerRef}
    >
      <Rows>
        <Field
          label="Show a character"
          hint="The codes cycle five times a second and never stop. There is nothing to press when it is done — the other device decides that."
        >
          <button
            type="button"
            className="btn"
            onClick={() => setMode((m) => (m === 'send' ? 'idle' : 'send'))}
            disabled={characters.length === 0}
          >
            {mode === 'send' ? 'Stop showing' : 'Show the codes'}
          </button>
        </Field>

        {mode === 'send' && chosen !== null && (
          <div style={{ background: 'var(--panel)', padding: 14 }}>
            {characters.length > 1 && (
              <label className="row" style={{ gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="t-label">Character</span>
                <select
                  value={chosen.id}
                  onChange={(e) => setPick(e.target.value)}
                  style={{ flex: '1 1 180px', maxWidth: 280 }}
                >
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <Sender character={chosen} />
          </div>
        )}

        <Field
          label="Receive a character"
          hint="Point this camera at the other screen. Frames can arrive in any order and a missed one just comes round again."
        >
          <button
            type="button"
            className="btn"
            onClick={() => setMode((m) => (m === 'receive' ? 'idle' : 'receive'))}
          >
            {mode === 'receive' ? 'Close the camera' : 'Open the camera'}
          </button>
        </Field>

        {mode === 'receive' && (
          <div style={{ background: 'var(--panel)', padding: 14 }}>
            <Receiver />
          </div>
        )}
      </Rows>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

function Sender({ character }: { character: Character }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [matrices, setMatrices] = useState<QrMatrix[] | null>(null);
  const [advice, setAdvice] = useState<TransferAdvice | null>(null);
  const [frame, setFrame] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [manualBrightness, setManualBrightness] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMatrices(null);
    setAdvice(null);
    setError(null);
    void (async () => {
      try {
        const frames = await framesForCharacter(character);
        const encoded = encodeFrames(frames);
        if (cancelled) return;
        setMatrices(encoded);
        setAdvice(describeTransfer(frames.length));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [character]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || matrices === null) return;

    // A fixed target rather than a measured one. The white card shrinks to fit
    // the canvas, so measuring it to size the canvas is circular - and
    // renderMatrix pins the element to a whole number of pixels per module, so
    // re-measuring it every frame would walk the code smaller.
    const cycler = createFrameCycler(canvas, matrices, {
      fps: FRAME_RATE,
      cssSize: Math.max(180, Math.min(320, window.innerWidth - 80)),
      onFrame: setFrame,
    });
    cycler.start();

    let released = false;
    let boost: ScreenBoost | null = null;
    void requestMaxBrightness().then((handle: ScreenBoost) => {
      // The section can close while the wake lock request is still in flight.
      if (released) {
        void handle.release();
        return;
      }
      boost = handle;
      setManualBrightness(handle.manual);
    });

    return () => {
      released = true;
      cycler.stop();
      void boost?.release();
    };
  }, [matrices]);

  const sendFile = useCallback(() => {
    void exportCharacter(character).then((result) => {
      setSaved(result.ok ? `Saved ${result.fileName}.` : (result.reason ?? 'The file was not saved.'));
    });
  }, [character]);

  if (error !== null) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <Note tone="warn" role="alert">
          This character cannot travel as a code: {error} The file carries anything the codes
          cannot.
        </Note>
        <button type="button" className="btn btn-primary" onClick={sendFile}>
          Send the file instead
        </button>
        {saved !== null && <Note role="status">{saved}</Note>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {advice?.preferFile === true && (
        <Note tone="warn">
          {advice.message} A file arrives in one go and cannot be misread.
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-primary" onClick={sendFile}>
              Send the file instead
            </button>
          </div>
        </Note>
      )}

      <div
        style={{
          alignSelf: 'flex-start',
          // White, always. A QR tinted to match a dark theme is a QR most
          // scanners will not see.
          background: '#fff',
          padding: 8,
          borderRadius: 'var(--r3)',
          lineHeight: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label={`Transfer code for ${character.name || 'this character'}`}
          role="img"
          style={{ display: 'block', width: 300, height: 300 }}
        />
      </div>

      {matrices !== null && advice !== null && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
            {matrices.map((_m, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background: i === frame ? 'var(--hope)' : 'var(--empty)',
                }}
              />
            ))}
          </div>
          {/* A one-frame set is a still picture and the cycler schedules nothing
              for it, so claiming a rate and a loop would describe machinery that
              is not running - and it is the common case, not the corner one. */}
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {matrices.length === 1
              ? 'ONE FRAME · HOLDS STILL UNTIL YOU STOP'
              : `FRAME ${frame + 1} OF ${matrices.length} · ${FRAME_RATE} PER SECOND · LOOPS FOREVER`}
          </span>
          {!advice.preferFile && (
            <p className="t-dense" style={{ margin: 0, maxWidth: '58ch' }}>
              {advice.message}
            </p>
          )}
        </div>
      )}

      {manualBrightness && (
        <Note>
          Turn your screen brightness up. No browser will let an app do it, and a dim screen is
          the usual reason a code will not read.
        </Note>
      )}
      {saved !== null && <Note role="status">{saved}</Note>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

function Receiver(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [session, setSession] = useState(0);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Arrivals the store refused to write over. Not the frame conflict above. */
  const [alreadyHere, setAlreadyHere] = useState<ImportConflict[]>([]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;

    setProgress(null);
    setConflict(false);
    setError(null);
    setDone(null);
    setAlreadyHere([]);

    const receive = async (transfer: CompletedTransfer): Promise<void> => {
      try {
        const { character, warnings } = await characterFromPayload(transfer.payload);
        const report = await useApp.getState().importCharacters([character], { warnings });
        setAlreadyHere(report.conflicts);
        setDone(describeImport(report));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    const scanner = createQrScanner({
      video,
      onFrame: (result) => {
        setProgress(result.progress);
        if (result.reason === 'other-transfer') setConflict(true);
      },
      onComplete: (transfer) => void receive(transfer),
      onError: (cause) => setError(cause.message),
    });

    // start() rejects with the same error it reports, so the throw is noise.
    void scanner.start().catch(() => {});

    // The one bug that matters here: a camera left running after the user has
    // moved on burns battery and keeps the indicator light on.
    return () => scanner.stop();
  }, [session]);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera preview"
        style={{
          width: '100%',
          maxWidth: 360,
          aspectRatio: '4 / 3',
          objectFit: 'cover',
          background: '#000',
          borderRadius: 'var(--r3)',
          border: '1px solid var(--line)',
        }}
      />

      <div className="stack" style={{ gap: 6 }}>
        <span style={{ font: '800 20px/1 var(--sans)', letterSpacing: '-0.01em' }}>
          {done !== null ? 'Received' : (progress?.label ?? 'Waiting for a code')}
        </span>
        {progress !== null && progress.total !== null && done === null && (
          <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
            {Array.from({ length: progress.total }, (_unused, i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 4,
                  borderRadius: 2,
                  background: progress.missing.includes(i) ? 'var(--empty)' : 'var(--ok)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {conflict && done === null && (
        <Note tone="warn">
          Another transfer is in view. This one keeps the set it started with — move the camera, or
          start over.
        </Note>
      )}
      {error !== null && <Note tone="danger" role="alert">{error}</Note>}
      {done !== null && <Note role="status">{done}</Note>}

      <ImportConflicts
        conflicts={alreadyHere}
        onChoose={(conflict_, choice) => {
          void useApp
            .getState()
            .resolveImport(conflict_, choice)
            .then(() => {
              setAlreadyHere((open) => open.filter((c) => c.incoming.id !== conflict_.incoming.id));
            });
        }}
      />

      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn" onClick={() => setSession((n) => n + 1)}>
          {done === null ? 'Start over' : 'Scan another'}
        </button>
      </div>
    </div>
  );
}
