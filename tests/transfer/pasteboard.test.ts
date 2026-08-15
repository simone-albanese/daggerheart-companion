/**
 * The pasteboard bridge is the only path across iOS's storage boundary, and it
 * is the path a user reaches for at their most anxious moment - an installed
 * app that looks empty. It has to be right about what it accepts and honest
 * about what it cannot do.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyLibrary, pasteLibrary } from '../../src/transfer/pasteboard.ts';
import { serializeBackup, serializeCharacter } from '../../src/transfer/fileIo.ts';
import { wizard } from './fixtures.ts';

const clipboard = (impl: Partial<Clipboard>): void => {
  vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: impl });
};

afterEach(() => vi.unstubAllGlobals());

describe('copyLibrary', () => {
  it('writes a backup the importer can read back', async () => {
    let written = '';
    clipboard({ writeText: async (t: string) => void (written = t) });

    const result = await copyLibrary([wizard()]);
    expect(result.ok).toBe(true);
    const back = await (async () => {
      clipboard({ readText: async () => written });
      return pasteLibrary();
    })();
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.characters[0]?.name).toBe(wizard().name);
  });

  it('refuses to claim it copied an empty library', async () => {
    clipboard({ writeText: async () => undefined });
    const result = await copyLibrary([]);
    expect(result.ok).toBe(false);
  });

  it('says the clipboard was refused rather than pretending it worked', async () => {
    clipboard({
      writeText: async () => {
        throw new Error('Write permission denied.');
      },
    });
    const result = await copyLibrary([wizard()]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/clipboard|export a file/i);
  });
});

describe('pasteLibrary', () => {
  it('accepts a single character as well as a whole backup', async () => {
    clipboard({ readText: async () => serializeCharacter(wizard()) });
    const one = await pasteLibrary();
    expect(one.ok).toBe(true);

    clipboard({ readText: async () => serializeBackup([wizard()]) });
    const many = await pasteLibrary();
    expect(many.ok).toBe(true);
  });

  it('tells the truth about an empty clipboard', async () => {
    clipboard({ readText: async () => '   ' });
    const result = await pasteLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/empty/i);
  });

  it('does not import someone else’s JSON', async () => {
    clipboard({ readText: async () => '{"hello":"world"}' });
    const result = await pasteLibrary();
    expect(result.ok).toBe(false);
  });

  it('survives a browser that refuses the read', async () => {
    clipboard({
      readText: async () => {
        throw new Error('NotAllowedError');
      },
    });
    const result = await pasteLibrary();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/again|file/i);
  });
});
