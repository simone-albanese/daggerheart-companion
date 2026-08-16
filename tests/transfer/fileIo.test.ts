/**
 * The file is the vector that has to work. It is also the one a user can open
 * in a text editor at midnight when something has gone wrong, so the tests care
 * as much about what the errors say as about what the parser accepts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OLDEST_READABLE } from '../../shared/migrations.ts';
import { SCHEMA_VERSION, type Character } from '../../shared/types.ts';
import {
  APP_VERSION,
  BACKUP_EXTENSION,
  CHARACTER_EXTENSION,
  ImportError,
  backupFileName,
  characterFileName,
  chooseDirectory,
  directoryAccess,
  exportCharacter,
  parseBackupFile,
  parseCharacterFile,
  parseTransferFile,
  saveTextFile,
  serializeBackup,
  serializeCharacter,
  writeIntoDirectory,
} from '../../src/transfer/fileIo.ts';
import { loadedWizard, wizard } from './fixtures.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A directory handle that remembers what was written into it. */
function fakeDirectory(options: { failOn?: string } = {}): {
  handle: FileSystemDirectoryHandle;
  files: Map<string, string>;
} {
  const files = new Map<string, string>();
  const handle = {
    name: 'Daggerheart',
    kind: 'directory',
    getFileHandle: (fileName: string) => {
      if (options.failOn === fileName) {
        return Promise.reject(new DOMException('Not allowed', 'NotAllowedError'));
      }
      return Promise.resolve({
        name: fileName,
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              files.set(fileName, text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
        // The real handle can be opened again, and `writeIntoDirectory` does:
        // a write is not a backup until the file has been read back.
        getFile: () =>
          Promise.resolve({ text: () => Promise.resolve(files.get(fileName) ?? '') }),
      });
    },
  };
  return { handle: handle as unknown as FileSystemDirectoryHandle, files };
}

describe('the .dhchar format', () => {
  it('is readable JSON carrying refs and values only', () => {
    const text = serializeCharacter(wizard(), new Date('2026-08-15T21:30:00.000Z'));
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed['format']).toBe('dhchar');
    expect(parsed['schemaVersion']).toBe(SCHEMA_VERSION);
    expect(parsed['app']).toBe(APP_VERSION);
    expect(parsed['exportedAt']).toBe('2026-08-15T21:30:00.000Z');
    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  '); // indented, for the text editor at midnight

    // No rules text ever leaves this app inside a character: nothing but the
    // fields of Character, which are refs, numbers and the player's own words.
    expect(Object.keys(parsed['character'] as object).sort()).toEqual(
      Object.keys(wizard()).sort(),
    );
    expect(text).not.toMatch(/recallCost|"domain"\s*:\s*"codex"/);
  });

  it('stamps the version this build actually is', () => {
    // The constant is deliberate - the app version is a fact about the build -
    // but a stamp that lies about which app wrote a file is worse than none.
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
    ) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('round-trips a character exactly', () => {
    const original = loadedWizard();
    expect(parseCharacterFile(serializeCharacter(original))).toEqual(original);
  });

  it('names the file after the character', () => {
    expect(characterFileName(wizard())).toBe(`kaelith${CHARACTER_EXTENSION}`);
    expect(characterFileName(wizard({ name: "  Ríoghnach O'Neill " }))).toBe(
      `rioghnach-oneill${CHARACTER_EXTENSION}`,
    );
    expect(characterFileName(wizard({ name: '' }))).toBe(`character${CHARACTER_EXTENSION}`);
  });
});

describe('the whole-library backup', () => {
  it('round-trips every character', () => {
    const library = [wizard(), loadedWizard(), wizard({ id: 'third', name: 'Bram' })];
    const back = parseBackupFile(serializeBackup(library));
    expect(back).toEqual(library);
  });

  it('is named by the day, so a folder of them stays useful', () => {
    expect(backupFileName(new Date('2026-08-15T23:59:00.000Z'))).toBe(
      `daggerheart-backup-2026-08-15${BACKUP_EXTENSION}`,
    );
  });

  it('reports which character in the file is damaged', () => {
    const library = [wizard(), loadedWizard()];
    const parsed = JSON.parse(serializeBackup(library)) as { characters: Character[] };
    delete (parsed.characters[1] as unknown as Record<string, unknown>)['traits'];
    expect(() => parseBackupFile(JSON.stringify(parsed))).toThrow(/Character 2 has no traits/);
  });
});

describe('refusing a file it does not understand', () => {
  it('says so when the file is not JSON', () => {
    expect(() => parseTransferFile('not a file')).toThrow(ImportError);
    expect(() => parseTransferFile('not a file')).toThrow(/not valid JSON/);
  });

  it('names the schema in both directions', () => {
    const newer = JSON.parse(serializeCharacter(wizard())) as Record<string, unknown>;
    newer['schemaVersion'] = SCHEMA_VERSION + 1;
    expect(() => parseTransferFile(JSON.stringify(newer))).toThrow(
      new RegExp(`newer version.*schema ${SCHEMA_VERSION + 1}.*reads ${SCHEMA_VERSION}`),
    );

    // Downward is no longer a blanket refusal - `shared/migrations.ts` converts
    // anything back to `OLDEST_READABLE`. What is left below that line is a
    // version no released build ever wrote, and the message now says that
    // instead of "there is no converter yet", which was true of the file and
    // false of the user's situation.
    const older = JSON.parse(serializeCharacter(wizard())) as Record<string, unknown>;
    older['schemaVersion'] = OLDEST_READABLE - 1;
    expect(() => parseTransferFile(JSON.stringify(older))).toThrow(
      /no released version of this app has ever written/i,
    );
    expect(() => parseTransferFile(JSON.stringify(older))).toThrow(/nothing has been changed/i);
  });

  it('refuses a schema version that is not a whole number', () => {
    const odd = JSON.parse(serializeCharacter(wizard())) as Record<string, unknown>;
    odd['schemaVersion'] = '3';
    expect(() => parseTransferFile(JSON.stringify(odd))).toThrow(/not a whole number/);
  });

  it('reads a file with no schema stamp at all, which is what a text editor leaves', () => {
    const bare = JSON.parse(serializeCharacter(wizard())) as Record<string, unknown>;
    delete bare['schemaVersion'];
    delete (bare['character'] as Record<string, unknown>)['schemaVersion'];
    const file = parseTransferFile(JSON.stringify(bare));
    expect(file.characters[0]!.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('says what kind of file it actually got', () => {
    expect(() => parseTransferFile('{"format":"dhart","art":[]}')).toThrow(
      /"dhart" file, not a Daggerheart character/,
    );
    expect(() => parseTransferFile('{"hello":"world"}')).toThrow(/no "format" field/);
    expect(() => parseTransferFile('[1,2,3]')).toThrow(/does not contain a Daggerheart export/);
  });

  it('will not accept a character with no traits or no level', () => {
    const file = JSON.parse(serializeCharacter(wizard())) as { character: Record<string, unknown> };
    delete file.character['level'];
    expect(() => parseTransferFile(JSON.stringify(file))).toThrow(/has no level/);
  });

  it('refuses to call a backup a character', () => {
    expect(() => parseCharacterFile(serializeBackup([wizard(), loadedWizard()]))).toThrow(
      /backup of 2 characters/,
    );
  });

  it('takes a bare character out of a text editor, and says that it did', () => {
    const result = parseTransferFile(JSON.stringify(wizard()));
    expect(result.kind).toBe('character');
    expect(result.characters[0]!.name).toBe('Kaelith');
    expect(result.warnings.join(' ')).toMatch(/no export header/);
  });

  it('fills in what a terse file left out, but never invents a character', () => {
    const bare = { ...wizard(), scars: undefined, connections: undefined };
    const result = parseTransferFile(JSON.stringify(bare));
    expect(result.characters[0]!.scars).toEqual([]);
    expect(result.characters[0]!.connections).toEqual([]);
  });

  /**
   * A file that looks like a character where the parser happens to check, and
   * is nonsense everywhere else, used to be copied into the store field for
   * field. The sheet then threw on every render - and being unopenable, could
   * not be deleted either.
   */
  it('refuses a field that is the wrong shape rather than storing it', () => {
    const damaged = (patch: Record<string, unknown>): (() => Character) =>
      () => parseCharacterFile(JSON.stringify({ ...wizard(), ...patch }));

    expect(damaged({ gold: null })).toThrow(/damaged "gold" field/);
    expect(damaged({ gold: { handfuls: 1, bags: 'two', chests: 0 } })).toThrow(/damaged "gold"/);
    expect(damaged({ experiences: 'none' })).toThrow(/damaged "experiences" field/);
    expect(damaged({ experiences: [{ name: 'Bookish' }] })).toThrow(/damaged "experiences"/);
    expect(damaged({ inventory: 42 })).toThrow(/damaged "inventory" field/);
    expect(damaged({ levelUpHistory: {} })).toThrow(/damaged "levelUpHistory" field/);
    expect(damaged({ companion: 'yes' })).toThrow(/damaged "companion" field/);
    expect(damaged({ unresolvedRefs: ['5101'] })).toThrow(/damaged "unresolvedRefs" field/);
    expect(damaged({ thresholdOverride: [9] })).toThrow(/damaged "thresholdOverride" field/);
    expect(damaged({ activeArmor: 7 })).toThrow(/damaged "activeArmor" field/);
    expect(damaged({ notes: { text: 'hi' } })).toThrow(/damaged "notes" field/);
    expect(damaged({ traitMarks: null })).toThrow(/damaged "traitMarks" field/);
    expect(damaged({})).not.toThrow();

    // Nullable on the character, so null is a value and not damage.
    expect(damaged({ companion: null, beastform: null, activeArmor: null })).not.toThrow();
  });

  it('gives a hand-written Experience the id it is missing', () => {
    const written = {
      ...wizard(),
      experiences: [{ name: 'Bookish', bonus: 3 }, { name: 'Astronomer', bonus: 2 }],
      levelUpHistory: [],
    };
    const result = parseTransferFile(JSON.stringify(written));
    const [first, second] = result.characters[0]!.experiences;

    expect(first!.name).toBe('Bookish');
    expect(first!.id).toEqual(expect.any(String));
    expect(first!.id).not.toBe(second!.id);
    expect(result.warnings.join(' ')).toMatch(/Experiences without ids/);
  });
});

describe('getting the file out', () => {
  it('uses the File System Access API when the browser has one', async () => {
    const written: string[] = [];
    const handle = {
      name: 'kaelith.dhchar',
      createWritable: () =>
        Promise.resolve({
          write: (text: string) => {
            written.push(text);
            return Promise.resolve();
          },
          close: () => Promise.resolve(),
        }),
    };
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    vi.stubGlobal('showSaveFilePicker', showSaveFilePicker);

    const result = await exportCharacter(wizard());
    expect(result).toMatchObject({ ok: true, route: 'file-system', fileName: 'kaelith.dhchar' });
    expect(showSaveFilePicker.mock.calls[0]![0]).toMatchObject({ suggestedName: 'kaelith.dhchar' });
    expect(parseCharacterFile(written[0]!).name).toBe('Kaelith');
  });

  it('treats a closed picker as a cancellation, not a failure', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('nope', 'AbortError')),
    );
    const result = await saveTextFile('kaelith.dhchar', 'x');
    expect(result).toMatchObject({ ok: false, cancelled: true, reason: null });
  });

  it('admits it when there is no way to save at all', async () => {
    // No picker, no share sheet, no document: exactly what a locked-down or
    // headless environment looks like. Saying so beats pretending.
    const result = await saveTextFile('kaelith.dhchar', 'x');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no way to save a file/i);
  });

  it('shares the file when that is the only route', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const result = await saveTextFile('kaelith.dhchar', 'hello');
    expect(result).toMatchObject({ ok: true, route: 'share' });
    expect((share.mock.calls[0]![0] as { files: File[] }).files[0]!.name).toBe('kaelith.dhchar');
  });

  /**
   * Architecture 5.3: share sheet on iOS/Android, download on desktop. A phone
   * can technically click an `<a download>`, so preferring the download
   * wherever one exists means the share sheet never opens on the device that
   * was the whole reason for having it.
   */
  it('prefers the share sheet on a phone and the download on a desktop', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const anchor = { href: '', download: '', rel: '', click: vi.fn(), remove: vi.fn() };
    const withDownload = (): void => {
      vi.stubGlobal('document', {
        createElement: () => anchor,
        body: { append: vi.fn() },
      });
      vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    };

    vi.stubGlobal('navigator', { share, canShare: () => true, userAgentData: { mobile: true } });
    withDownload();
    expect(await saveTextFile('kaelith.dhchar', 'hello')).toMatchObject({ route: 'share' });

    vi.stubGlobal('navigator', { share, canShare: () => true, userAgentData: { mobile: false } });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    withDownload();
    expect(await saveTextFile('kaelith.dhchar', 'hello')).toMatchObject({ route: 'download' });

    // A tablet reports no fine pointer at all: still a share sheet.
    vi.stubGlobal('navigator', { share, canShare: () => true });
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('(pointer: coarse)') }));
    withDownload();
    expect(await saveTextFile('kaelith.dhchar', 'hello')).toMatchObject({ route: 'share' });
  });
});

describe('writing into a chosen folder', () => {
  it('writes the file and says where it went', async () => {
    const { handle, files } = fakeDirectory();
    const result = await writeIntoDirectory(handle, 'backup.dhbackup', 'contents');
    expect(result).toMatchObject({ ok: true, route: 'file-system', fileName: 'backup.dhbackup' });
    expect(files.get('backup.dhbackup')).toBe('contents');
  });

  it('reports a refused write instead of swallowing it', async () => {
    const { handle } = fakeDirectory({ failOn: 'backup.dhbackup' });
    const result = await writeIntoDirectory(handle, 'backup.dhbackup', 'contents');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Could not write backup.dhbackup to the backup folder/);
  });

  it('reports the permission state, and "unsupported" when it cannot ask', async () => {
    const { handle } = fakeDirectory();
    expect(await directoryAccess(handle)).toBe('unsupported');

    const asking = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemDirectoryHandle;
    expect(await directoryAccess(asking)).toBe('prompt');
    expect(await directoryAccess(asking, { request: true })).toBe('granted');
  });

  it('says plainly when the browser cannot pick a folder', async () => {
    const choice = await chooseDirectory();
    expect(choice.ok).toBe(false);
    expect(choice.reason).toMatch(/cannot pick a folder/);
  });
});
