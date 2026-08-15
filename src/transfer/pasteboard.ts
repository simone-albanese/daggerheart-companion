/**
 * The one bridge that crosses iOS's storage boundary.
 *
 * On Apple platforms a web app added to the Home Screen is a separate entity
 * from Safari, with its own storage. WebKit bug 181849, marked NEW and
 * answered by Apple: *"The current behavior (on Apple platforms) is by design.
 * Home Screen apps are created as isolated entities without shared state with
 * the browser."* From iOS 26 every add-to-Home-Screen opens as a web app, so
 * the boundary is now crossed by everyone who installs.
 *
 * Which means the most committed user - the one who builds a character and
 * *then* installs, because they liked it - is the one who opens the installed
 * app and finds it empty. That is the app's own worst failure mode arriving by
 * way of a platform decision.
 *
 * The file and the QR do not help here: both contexts are the same phone, so
 * there is no second screen to point a camera at, and a file picker cannot see
 * Safari's storage either. The system pasteboard is the only channel both
 * sides share. A character is about 123 bytes, so it fits comfortably.
 */
import type { Character } from '../../shared/types.ts';
import { parseTransferFile, serializeBackup, ImportError } from './fileIo.ts';

/** True when the page is running as an installed app rather than in a tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS is the only platform with this split, and it is the only platform where
 * the recovery offer is worth showing. Elsewhere an empty installed app really
 * is a new user.
 */
export function needsPasteboardBridge(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return iOS && isStandalone();
}

export type CopyOutcome =
  | { ok: true; characters: number; bytes: number }
  | { ok: false; reason: string };

/** Put every character on the pasteboard, in the same JSON a backup file uses. */
export async function copyLibrary(characters: readonly Character[]): Promise<CopyOutcome> {
  if (characters.length === 0) return { ok: false, reason: 'There is nothing to copy yet.' };
  const text = serializeBackup([...characters]);
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, characters: characters.length, bytes: text.length };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error && /denied|permission/i.test(error.message)
          ? 'The browser would not give this page the clipboard. Export a file instead.'
          : 'The clipboard is not available here. Export a file instead.',
    };
  }
}

export type PasteOutcome =
  | { ok: true; characters: Character[] }
  | { ok: false; reason: string };

/**
 * Read characters back off the pasteboard.
 *
 * Must be called from inside a user gesture: iOS shows its own paste
 * confirmation, and outside a gesture the read is simply refused.
 */
export async function pasteLibrary(): Promise<PasteOutcome> {
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return {
      ok: false,
      reason:
        'The clipboard could not be read. Tap the button again and allow the paste, ' +
        'or bring the characters over as a file instead.',
    };
  }

  if (text.trim() === '') {
    return { ok: false, reason: 'The clipboard is empty. Copy from Safari first.' };
  }

  try {
    const file = parseTransferFile(text);
    return { ok: true, characters: file.characters };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof ImportError
          ? error.message
          : 'That is not a Daggerheart character. Copy from Safari with "Copy all characters".',
    };
  }
}
