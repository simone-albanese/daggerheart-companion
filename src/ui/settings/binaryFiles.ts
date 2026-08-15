/**
 * Two file seams the settings screen needs and neither `fileIo` nor `import`
 * owns: getting a binary file in, and handing one back out.
 *
 * `fileIo` is the `.dhchar` module - text in, text out - and everything here is
 * bytes: a 319 MB PDF going in, a 20 MB art pack coming back. If `fileIo` grows
 * a binary pair, this file becomes two re-exports.
 */

/**
 * Take a binary file from the user.
 *
 * `fileIo.pickFile` hands back the untouched `File` alongside its text, so it
 * would not corrupt anything - but it reads that text eagerly, and `.text()` on
 * the 319 MB Core Rulebook materialises a ~640 MB string before the caller ever
 * sees the handle. That is the out-of-memory crash this whole section exists to
 * avoid, so the picker here never reads what it opens.
 */
export function pickBinaryFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.append(input);
    input.click();
  });
}

/**
 * Hand a binary file to the user.
 *
 * `fileIo.saveTextFile` covers the text formats; an art pack is a 20 MB Blob
 * that must never be turned into a string, so it takes the same two routes -
 * share sheet on a phone, download everywhere else - without going through one.
 * If `fileIo` grows a blob saver, this should call that instead.
 */
export async function saveBlobFile(fileName: string, blob: Blob): Promise<string> {
  const file = new File([blob], fileName, { type: blob.type });
  const share = navigator.share?.bind(navigator);
  if (share !== undefined && navigator.canShare?.({ files: [file] }) === true) {
    try {
      await share({ files: [file], title: fileName });
      return `Shared ${fileName}.`;
    } catch (cause) {
      // A cancelled share sheet is a decision, not a failure.
      if (cause instanceof Error && cause.name === 'AbortError') return 'Cancelled.';
    }
  }
  if (typeof URL.createObjectURL !== 'function') {
    return 'This browser will not let a page hand a file back. Make the pack on a computer instead.';
  }
  // Never claim a write that did not happen: the same rule the backup module is
  // built on, and the reason this returns the browser's complaint rather than a
  // cheerful "Saved" when the download is refused.
  try {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    // Appended before the click: a detached anchor is ignored by some browsers.
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20_000);
    return `Saved ${fileName} (${formatBytes(blob.size)}).`;
  } catch (cause) {
    return `${fileName} was not saved: ${cause instanceof Error ? cause.message : String(cause)}`;
  }
}

/** Sizes a person can read. Rounded whole megabytes call a 400 KB pack "0 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}
