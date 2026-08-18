/**
 * The camera half of the party board.
 *
 * The receiving half of the animated-QR transfer, pointed at the board instead
 * of at the character store. Every byte of it belongs to `transfer/`; what is
 * here is a preview, a count and where the finished sheet goes.
 *
 * ## Why this is a module of its own
 *
 * `qr.ts` carries jsQR and `qrcode-generator`: 194.92 KB raw, 71.86 KB gzip -
 * `vite build` in this tree, and the one place the figure is written down - and
 * `frames.ts` and `codec.ts` behind it. `PartyBoard.tsx` used to import
 * `createQrScanner` at the top of the file, so every one of those bytes was a
 * *static* dependency of the GM chunk - opening the GM screen at all downloaded
 * the whole decoder, whether or not the GM ever pointed a camera at anything.
 * The measurement: before this split, `dist/assets/Gm-*.js` carried
 * `import … from "./qr-*.js"`; after it, it does not.
 *
 * This is the same move `Onboarding.tsx` makes for `ImportDoors` and `App.tsx`
 * makes for Settings, and it is made here for the same reason both of those
 * give. The board itself is the screen a GM opens every session; the camera is
 * behind a deliberate tap, which is exactly where a chunk boundary is free.
 *
 * `tests/harness/staticImports.test.ts` fails if a static QR import comes back
 * anywhere in the GM screen's own graph, because the bundler splitting it
 * *anyway* is luck rather than a property, and luck is not something a reader
 * of the source can check.
 */
import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../../shared/types.ts';
import { characterFromPayload } from '../../transfer/frames.ts';
import { createQrScanner, type TransferProgress } from '../../transfer/qr.ts';

export function PartyScanner({
  onArrived,
}: {
  onArrived: (sheet: Character, warnings: string[]) => void;
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Held in a ref, not read as a dependency: the callback is a fresh closure on
  // every render of the board, and a camera that reopens on every render is a
  // camera that never gets far enough to read a frame.
  const arrived = useRef(onArrived);
  arrived.current = onArrived;

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;

    const scanner = createQrScanner({
      video,
      onFrame: (result) => setProgress(result.progress),
      onComplete: (transfer) => {
        void characterFromPayload(transfer.payload)
          .then(({ character, warnings }) => arrived.current(character, warnings))
          .catch((cause: unknown) =>
            setError(cause instanceof Error ? cause.message : String(cause)),
          );
      },
      onError: (cause) => setError(cause.message),
    });
    void scanner.start().catch(() => {});

    // A camera left running after the GM has moved on burns battery and keeps
    // the indicator light on.
    return () => scanner.stop();
  }, []);

  return (
    <div className="panel row" style={{ flex: 'none', gap: 14, padding: 12, flexWrap: 'wrap' }}>
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera preview"
        style={{
          width: 200,
          aspectRatio: '4 / 3',
          objectFit: 'cover',
          background: '#000',
          borderRadius: 'var(--r3)',
          border: '1px solid var(--line)',
          flex: 'none',
        }}
      />
      <div className="stack" style={{ gap: 7, flex: 1, minWidth: 180 }}>
        <span style={{ font: '800 18px/1 var(--sans)' }}>
          {error !== null ? 'Cannot read' : (progress?.label ?? 'Waiting for a code')}
        </span>
        <p className="t-dense" style={{ margin: 0, maxWidth: '52ch' }}>
          {error ??
            'Have the player open Transfer on their own device and show the codes. Frames arrive in any order; a missed one comes round again.'}
        </p>
      </div>
    </div>
  );
}
