/**
 * The `.dhchar` file: the reliable half of Architecture 5.3.
 *
 * Readable JSON holding only refs and values - no rules text, no card text, no
 * art - so it is safe to send to anyone, survives a dataset update untouched,
 * and can be opened in a text editor when everything else has gone wrong. The
 * QR is the convenient vector; this is the one that has to work.
 *
 * `.dhbackup` is the same idea for the whole library at once, which is what
 * the automatic export in `store/backup.ts` writes.
 *
 * Three ways out of the browser, tried in that order:
 *   1. File System Access API - the only one that can write the same file again
 *      without asking, which is what makes an automatic backup possible
 *   2. Web Share - the share sheet, which is how a phone saves anything
 *   3. a download - always there, never silent
 *
 * When none of them works, say so. A backup that quietly did not happen is
 * worse than no backup at all, because the user stops worrying.
 */
import {
  checkReadable,
  migrateCharacterRecord,
  SchemaError,
  versionOf,
} from '../../shared/migrations.ts';
import { slugify } from '../../shared/slugify.ts';
import {
  SCHEMA_VERSION,
  TRAITS,
  type Character,
  type Counter,
  type Experience,
  type LevelUpChoice,
  type Trait,
} from '../../shared/types.ts';
import { newCharacter } from '../engine/character.ts';

export const CHARACTER_FORMAT = 'dhchar';
export const BACKUP_FORMAT = 'dhbackup';
export const CHARACTER_EXTENSION = '.dhchar';
export const BACKUP_EXTENSION = '.dhbackup';
export const FILE_MIME = 'application/json';

/**
 * Stamped into every file so a bug report can name the writer. Kept as a
 * constant rather than read from package.json: the app version is a fact about
 * the build, and the build is what ships this file.
 */
export const APP_VERSION = '0.6.0';

export interface CharacterFile {
  format: typeof CHARACTER_FORMAT;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  character: Character;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  characters: Character[];
}

export class ImportError extends Error {
  override name = 'ImportError';
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export const serializeCharacter = (c: Character, at: Date = new Date()): string =>
  `${JSON.stringify(
    {
      format: CHARACTER_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      app: APP_VERSION,
      exportedAt: at.toISOString(),
      character: c,
    } satisfies CharacterFile,
    null,
    2,
  )}\n`;

export const serializeBackup = (characters: Character[], at: Date = new Date()): string =>
  `${JSON.stringify(
    {
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      app: APP_VERSION,
      exportedAt: at.toISOString(),
      characters,
    } satisfies BackupFile,
    null,
    2,
  )}\n`;

export const characterFileName = (c: Character): string =>
  `${slugify(c.name) || 'character'}${CHARACTER_EXTENSION}`;

/** One file per day: a folder of backups stays useful and stays small. */
export const backupFileName = (at: Date = new Date()): string =>
  `daggerheart-backup-${at.toISOString().slice(0, 10)}${BACKUP_EXTENSION}`;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export interface ImportedFile {
  kind: 'character' | 'backup';
  characters: Character[];
  app: string | null;
  exportedAt: string | null;
  /** Things worth telling the user that did not stop the import. */
  warnings: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The envelope's own version.
 *
 * Only the two ends are refusals: a file from the future cannot be guessed at,
 * and a version below `OLDEST_READABLE` is one no released build ever wrote.
 * Everything in between is converted rather than rejected, per character,
 * inside `readCharacter` - the envelope and the characters carry the stamp
 * separately, and it is the characters that hold the work of months.
 */
function checkEnvelopeSchema(value: unknown, where: string): void {
  if (value === undefined) return;
  try {
    checkReadable(versionOf({ schemaVersion: value }));
  } catch (error) {
    if (error instanceof SchemaError) throw new ImportError(`${where} ${error.message}`);
    throw error;
  }
}

/**
 * Parse a `.dhchar` or `.dhbackup`.
 *
 * A bare character object is accepted too, with a warning: somebody who pulls
 * the `character` field out of a file in a text editor should get their sheet
 * back, not a lecture.
 */
export function parseTransferFile(text: string): ImportedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportError('That file is not valid JSON, so it is not a Daggerheart export.');
  }
  if (!isRecord(parsed)) throw new ImportError('That file does not contain a Daggerheart export.');

  const warnings: string[] = [];
  const format = parsed['format'];
  const app = typeof parsed['app'] === 'string' ? parsed['app'] : null;
  const exportedAt = typeof parsed['exportedAt'] === 'string' ? parsed['exportedAt'] : null;

  if (format === BACKUP_FORMAT) {
    checkEnvelopeSchema(parsed['schemaVersion'], 'That backup');
    const list = parsed['characters'];
    if (!Array.isArray(list)) throw new ImportError('That backup has no characters in it.');
    const characters = list.map((value, i) => readCharacterRecord(value, `Character ${i + 1}`, warnings));
    return { kind: 'backup', characters, app, exportedAt, warnings };
  }

  if (format === CHARACTER_FORMAT) {
    checkEnvelopeSchema(parsed['schemaVersion'], 'That character file');
    return {
      kind: 'character',
      characters: [readCharacterRecord(parsed['character'], 'That character file', warnings)],
      app,
      exportedAt,
      warnings,
    };
  }

  if (typeof format === 'string') {
    throw new ImportError(
      `That is a "${format}" file, not a Daggerheart character (${CHARACTER_EXTENSION}) or backup (${BACKUP_EXTENSION}).`,
    );
  }

  if (typeof parsed['name'] === 'string' && isRecord(parsed['traits'])) {
    warnings.push('That file had no export header, so it was read as a bare character.');
    return {
      kind: 'character',
      characters: [readCharacterRecord(parsed, 'That file', warnings)],
      app,
      exportedAt,
      warnings,
    };
  }

  throw new ImportError(
    `That file is not a Daggerheart export: it has no "format" field. Expected "${CHARACTER_FORMAT}" or "${BACKUP_FORMAT}".`,
  );
}

/** Convenience for the single-character path. Throws if the file holds a library. */
export function parseCharacterFile(text: string): Character {
  const file = parseTransferFile(text);
  const first = file.characters[0];
  if (file.kind === 'backup' || first === undefined) {
    throw new ImportError(
      `That is a backup of ${file.characters.length} characters, not a single character file.`,
    );
  }
  return first;
}

export function parseBackupFile(text: string): Character[] {
  const file = parseTransferFile(text);
  return file.characters;
}

function readCounter(value: unknown, field: string, where: string): Counter {
  if (!isRecord(value) || typeof value['marked'] !== 'number' || typeof value['max'] !== 'number') {
    throw new ImportError(`${where} has no readable ${field} track.`);
  }
  return { marked: value['marked'], max: value['max'] };
}

/**
 * The structured fields, checked before they are believed.
 *
 * A `.dhchar` arrives from another person's device, or from a backup that a
 * filesystem half-wrote. Copying `"gold": null` or `"inventory": 42` into the
 * store because the name and the traits looked right turns one bad file into a
 * sheet that throws on every render - and, once it is in IndexedDB, into a
 * character the user cannot open to delete. Anything present has to have the
 * right shape; anything absent falls back to the blank sheet, because a file
 * without an empty `scars` array is just terse.
 */
function checkShapes(value: Record<string, unknown>, where: string): void {
  const wrong = (key: string, expected: string): never => {
    throw new ImportError(`${where} has a damaged "${key}" field: expected ${expected}.`);
  };
  const list = (key: string, each: (v: unknown) => boolean, expected: string): void => {
    const v = value[key];
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every(each)) wrong(key, expected);
  };

  const gold = value['gold'];
  if (gold !== undefined) {
    if (
      !isRecord(gold) ||
      ['handfuls', 'bags', 'chests'].some((k) => typeof gold[k] !== 'number')
    ) {
      wrong('gold', 'handfuls, bags and chests as numbers');
    }
  }

  list(
    'experiences',
    (e) => isRecord(e) && typeof e['name'] === 'string' && typeof e['bonus'] === 'number',
    'a list of Experiences with a name and a bonus',
  );
  list(
    'inventory',
    (e) => isRecord(e) && typeof e['name'] === 'string' && typeof e['quantity'] === 'number',
    'a list of items with a name and a quantity',
  );
  list(
    'levelUpHistory',
    (e) => isRecord(e) && typeof e['level'] === 'number' && typeof e['kind'] === 'string',
    'a list of advancements with a level and a kind',
  );
  list('unresolvedRefs', (id) => typeof id === 'number', 'a list of numeric ids');

  // `companion` and `beastform` are nullable on the character; `traitMarks` is
  // not, and a null there is read as an object by everything downstream.
  for (const key of ['companion', 'beastform'] as const) {
    const v = value[key];
    if (v !== undefined && v !== null && !isRecord(v)) wrong(key, 'an object or null');
  }

  /*
   * An animal is whole, or there is no animal.
   *
   * The object-ness check above is where this stopped, and `companion: {}` went
   * through it and came out the other side identical. That is not a shape
   * anything downstream is ready for, and there is no blank fallback for it the
   * way there is for `scars`: `readCharacterRecord` spreads this object
   * wholesale, so a field missing here is a field missing on the sheet. What
   * then reads it: `PartyBoard`'s companion line calls `.toUpperCase()` on the
   * name and reads `.marked`/`.max` off the stress track; `companionDamage`
   * hands `damage` to `parseDamage`, which is total for a junk string and fatal
   * for an absent one; the printed sheet calls `.toLowerCase()` on the range;
   * and `damageTypeOf` is `.toUpperCase()`d on the first damage roll.
   *
   * The converters do not save you here either. `migrateCharacterRecord` has
   * run by now, so a companion out of a schema-4 file already has its
   * `damageType` - but it is filled, never coerced, and a file stamped 5 or not
   * stamped at all reaches this line with whatever it was written with.
   *
   * `range` is checked for text and not for membership of `RANGES`: an
   * unrecognised range prints as itself, which is a sheet you can read and
   * correct, while a missing one is a call on `undefined`.
   */
  const companion = value['companion'];
  if (isRecord(companion)) {
    const fields: Array<[string, (v: unknown) => boolean, string]> = [
      ['name', (v) => typeof v === 'string', 'text'],
      ['description', (v) => typeof v === 'string', 'text'],
      ['evasion', (v) => typeof v === 'number', 'a number'],
      [
        'stress',
        (v) => isRecord(v) && typeof v['marked'] === 'number' && typeof v['max'] === 'number',
        'a track with marked and max as numbers',
      ],
      ['damage', (v) => typeof v === 'string', 'a damage die, as text'],
      ['range', (v) => typeof v === 'string', 'a range, as text'],
      ['damageType', (v) => v === 'phy' || v === 'mag', '"phy" or "mag"'],
      [
        'experiences',
        (v) =>
          Array.isArray(v) &&
          v.every((e) => isRecord(e) && typeof e['name'] === 'string' && typeof e['bonus'] === 'number'),
        'a list of Experiences with a name and a bonus',
      ],
      ['upgrades', (v) => Array.isArray(v) && v.every((u) => typeof u === 'string'), 'a list of option slugs'],
    ];
    for (const [key, ok, expected] of fields) {
      if (!ok(companion[key])) wrong(`companion.${key}`, expected);
    }
  }
  const marks = value['traitMarks'];
  if (marks !== undefined && !isRecord(marks)) wrong('traitMarks', 'an object');
  for (const key of ['classRef', 'communityRef', 'multiclassRef', 'multiclassDomain'] as const) {
    const v = value[key];
    if (v !== undefined && v !== null && typeof v !== 'string') wrong(key, 'a reference or null');
  }
  for (const key of ['activePrimaryWeapon', 'activeSecondaryWeapon', 'activeArmor'] as const) {
    const v = value[key];
    if (v !== undefined && v !== null && typeof v !== 'string') wrong(key, 'a reference or null');
  }
  for (const key of ['pronouns', 'notes'] as const) {
    const v = value[key];
    if (v !== undefined && typeof v !== 'string') wrong(key, 'text');
  }
  const evasion = value['evasionOverride'];
  if (evasion !== undefined && evasion !== null && typeof evasion !== 'number') {
    wrong('evasionOverride', 'a number or null');
  }
  // Stricter than `evasionOverride`'s bare typeof, on purpose. This number is
  // read for one thing only - deciding whether to refuse a short rest - so a
  // 2.5 or a -1 would have `mustTakeLongRest` answering about a count no rest
  // could ever have produced, and the answer would look like a rule.
  const rests = value['consecutiveShortRests'];
  if (
    rests !== undefined &&
    (typeof rests !== 'number' || !Number.isInteger(rests) || rests < 0)
  ) {
    wrong('consecutiveShortRests', 'a whole number of rests, zero or more');
  }
  const thresholds = value['thresholdOverride'];
  if (thresholds !== undefined && thresholds !== null) {
    if (
      !Array.isArray(thresholds) ||
      thresholds.length !== 2 ||
      thresholds.some((n) => typeof n !== 'number')
    ) {
      wrong('thresholdOverride', 'two numbers or null');
    }
  }
}

/**
 * Check the fields a character cannot be a character without, then fill the
 * rest from the blank sheet. A file missing its traits is not a character and
 * says so; a file missing an empty `scars` array is just terse.
 */
export function readCharacterRecord(
  raw: unknown,
  where: string,
  warnings: string[] = [],
): Character {
  if (!isRecord(raw)) throw new ImportError(`${where} does not contain a character.`);

  // Convert first, read second. Everything below this line reads fields by
  // name, so a record from an older schema has to arrive at this build's shape
  // before any of it is believed - and a converter that ran is something the
  // user is told about rather than a silent rewrite of their sheet.
  let value: Record<string, unknown>;
  try {
    const migrated = migrateCharacterRecord(raw);
    value = migrated.record;
    if (migrated.from !== SCHEMA_VERSION) {
      warnings.push(
        `${where} was written by an older version of the app (schema ${migrated.from}) and was converted: ${migrated.applied.join('; ')}.`,
      );
    }
  } catch (error) {
    if (error instanceof SchemaError) throw new ImportError(`${where} ${error.message}`);
    throw error;
  }

  if (typeof value['name'] !== 'string') throw new ImportError(`${where} has no name.`);
  if (typeof value['level'] !== 'number') throw new ImportError(`${where} has no level.`);
  const rawTraits = value['traits'];
  if (!isRecord(rawTraits)) throw new ImportError(`${where} has no traits.`);

  const traits = {} as Record<Trait, number>;
  for (const t of TRAITS) {
    const v = rawTraits[t];
    if (typeof v !== 'number') throw new ImportError(`${where} is missing the ${t} trait.`);
    traits[t] = v;
  }

  checkShapes(value, where);

  const base = newCharacter();
  const strings = (key: string): string[] | undefined => {
    const v = value[key];
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      throw new ImportError(`${where} has a damaged "${key}" list.`);
    }
    return v as string[];
  };

  if (typeof value['id'] !== 'string') {
    warnings.push(`${where} had no id, so it was imported as a new character.`);
  }

  // An Experience id is a local handle, the same one the codec regenerates on
  // decode. A hand-written file will not have one, and two Experiences sharing
  // `undefined` is a sheet that renders wrong rather than a file to reject.
  const rawExperiences = value['experiences'] as Experience[] | undefined;
  const experiences = rawExperiences?.map((e) =>
    typeof e.id === 'string' && e.id !== '' ? e : { ...e, id: crypto.randomUUID() },
  );
  if (rawExperiences?.some((e) => typeof e.id !== 'string' || e.id === '') === true) {
    warnings.push(`${where} had Experiences without ids, so new ones were given.`);
  }

  /*
   * An advancement with no `detail`, filled rather than refused.
   *
   * `checkShapes` above requires a `level` and a `kind` off every entry and
   * says nothing about `detail`, so a hand-written file - or one from a build
   * that did not write the field - came through here silently and then took the
   * GM's party board down: `collectModifiers` reads `h.detail['subclassRef']`
   * off every `subclass` entry the moment the character's subclass resolves.
   * `tests/transfer/fileIo.test.ts` measures both halves of that.
   *
   * Filled, not refused, for the reason the Experience ids a few lines up are
   * filled: `{}` is exactly what "this advancement recorded no detail" means,
   * it grants nothing, and it is already how `collectModifiers` treats a detail
   * that has no `subclassRef` in it. Rejecting a whole character file over a
   * missing sub-field would cost a player their sheet to protect a lookup.
   *
   * This is also the sentence `PartyBoard.tsx` leans on when it declines to
   * defend itself a second time - that `importParty` is a door with a check on
   * it. Until this clause, that was true of `companion` and not of this.
   */
  // After `checkShapes`, which has already refused a list holding anything
  // that is not a record - so `h.detail` below is a read that cannot throw.
  const rawHistory = value['levelUpHistory'] as LevelUpChoice[] | undefined;
  const detailless = rawHistory?.some((h) => !isRecord(h.detail)) === true;
  const levelUpHistory = detailless
    ? rawHistory?.map((h) => (isRecord(h.detail) ? h : { ...h, detail: {} }))
    : rawHistory;
  if (detailless) {
    warnings.push(`${where} had advancements with no detail recorded, so they were read as granting nothing.`);
  }

  return {
    ...base,
    ...(value as Partial<Character>),
    ...(experiences === undefined ? {} : { experiences }),
    ...(levelUpHistory === undefined ? {} : { levelUpHistory }),
    id: typeof value['id'] === 'string' ? value['id'] : base.id,
    schemaVersion: SCHEMA_VERSION,
    name: value['name'],
    level: value['level'],
    traits,
    hp: readCounter(value['hp'], 'HP', where),
    stress: readCounter(value['stress'], 'Stress', where),
    hope: readCounter(value['hope'], 'Hope', where),
    armorSlots: readCounter(value['armorSlots'], 'armor', where),
    loadout: strings('loadout') ?? [],
    vault: strings('vault') ?? [],
    subclassRefs: strings('subclassRefs') ?? [],
    ancestryRefs: strings('ancestryRefs') ?? [],
    connections: strings('connections') ?? [],
    scars: strings('scars') ?? [],
    createdAt: typeof value['createdAt'] === 'string' ? value['createdAt'] : base.createdAt,
    updatedAt: typeof value['updatedAt'] === 'string' ? value['updatedAt'] : base.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Getting a file out of the browser
// ---------------------------------------------------------------------------

/** The File System Access API, which TypeScript's DOM library does not declare. */
interface PickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface FilePickers {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: PickerAcceptType[];
    id?: string;
  }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options?: {
    types?: PickerAcceptType[];
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    id?: string;
  }) => Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
    id?: string;
  }) => Promise<FileSystemDirectoryHandle>;
}

/** Permission querying is part of the API but not of the DOM typings either. */
interface PermissionCapable {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

const pickers = (): FilePickers => globalThis as unknown as FilePickers;

const ACCEPT: PickerAcceptType[] = [
  {
    description: 'Daggerheart character or backup',
    accept: { [FILE_MIME]: [CHARACTER_EXTENSION, BACKUP_EXTENSION] },
  },
];

export type SaveRoute = 'file-system' | 'share' | 'download';

export interface SaveResult {
  ok: boolean;
  route: SaveRoute | null;
  fileName: string;
  /** True when the user closed the picker or the share sheet. Not a failure. */
  cancelled: boolean;
  /** Plain English, shown as-is when `ok` is false. */
  reason: string | null;
}

export interface SaveOptions {
  /** Force one route instead of taking the first that works. */
  route?: SaveRoute;
  /** Write straight into a directory already granted (the backup folder). */
  directory?: FileSystemDirectoryHandle;
}

const isAbort = (err: unknown): boolean =>
  err instanceof DOMException ? err.name === 'AbortError' : (err as Error)?.name === 'AbortError';

/**
 * Write and close, and if either fails let go of the stream.
 *
 * A `FileSystemWritableFileStream` holds a lock on the file and a swap file
 * beside it until it is closed or aborted. Dropping the reference on an error
 * leaves both behind, and the next backup into the same folder then fails on a
 * file that is still locked by the attempt before it.
 */
async function writeAndClose(writable: FileSystemWritableFileStream, text: string): Promise<void> {
  try {
    await writable.write(text);
    await writable.close();
  } catch (err) {
    try {
      await writable.abort?.();
    } catch {
      // The stream was already broken; the original failure is the one to tell.
    }
    throw err;
  }
}

const why = (err: unknown): string =>
  err instanceof Error && err.message !== '' ? err.message : String(err);

/**
 * Write text out by whichever route this browser has. Never throws: the caller
 * gets a result it can show, including "your browser would not let me".
 */
export async function saveTextFile(
  fileName: string,
  text: string,
  options: SaveOptions = {},
): Promise<SaveResult> {
  const fail = (reason: string, route: SaveRoute | null = null): SaveResult => ({
    ok: false,
    route,
    fileName,
    cancelled: false,
    reason,
  });

  if (options.directory !== undefined) {
    return writeIntoDirectory(options.directory, fileName, text);
  }

  const wanted = options.route;
  const api = pickers();

  if ((wanted === undefined || wanted === 'file-system') && api.showSaveFilePicker !== undefined) {
    try {
      const handle = await api.showSaveFilePicker({
        suggestedName: fileName,
        types: ACCEPT,
        id: 'daggerheart-export',
      });
      await writeAndClose(await handle.createWritable(), text);
      return { ok: true, route: 'file-system', fileName: handle.name, cancelled: false, reason: null };
    } catch (err) {
      if (isAbort(err)) {
        return { ok: false, route: 'file-system', fileName, cancelled: true, reason: null };
      }
      if (wanted === 'file-system') return fail(why(err), 'file-system');
      // Otherwise fall through: a download still gets the file to the user.
    }
  } else if (wanted === 'file-system') {
    return fail('This browser cannot save files to a folder you choose.', 'file-system');
  }

  const file = new File([text], fileName, { type: FILE_MIME });
  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (navigator.canShare?.({ files: [file] }) ?? false);

  // On a phone the share sheet *is* how a file gets saved (Architecture 5.3),
  // and `<a download>` drops it into a Downloads folder the user may never
  // find. On a desktop the share sheet has no "save to disk", so a download is
  // the right answer there even when the browser could share.
  const preferShare = wanted === 'share' || (wanted === undefined && (looksLikeAPhone() || !hasDownload()));

  if (preferShare && canShare) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return { ok: true, route: 'share', fileName, cancelled: false, reason: null };
    } catch (err) {
      if (isAbort(err)) return { ok: false, route: 'share', fileName, cancelled: true, reason: null };
      if (wanted === 'share') return fail(why(err), 'share');
    }
  } else if (wanted === 'share') {
    return fail('This browser cannot share files.', 'share');
  }

  if (!hasDownload()) {
    return fail('There is no way to save a file from this browser. Copy the text out by hand.');
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: FILE_MIME }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { ok: true, route: 'download', fileName, cancelled: false, reason: null };
  } catch (err) {
    return fail(why(err), 'download');
  }
}

const hasDownload = (): boolean =>
  typeof document !== 'undefined' && typeof URL.createObjectURL === 'function';

/**
 * The same conservative test `import/index.ts` uses, and for the same reason:
 * a device counts as a phone when it says so, or when the only pointer it has
 * is a finger. Never a user-agent string.
 */
function looksLikeAPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile === true) return true;
  if (typeof matchMedia !== 'function') return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

export const exportCharacter = (c: Character, options?: SaveOptions): Promise<SaveResult> =>
  saveTextFile(characterFileName(c), serializeCharacter(c), options);

export const exportBackup = (
  characters: Character[],
  options?: SaveOptions & { at?: Date },
): Promise<SaveResult> =>
  saveTextFile(backupFileName(options?.at), serializeBackup(characters, options?.at), options);

// ---------------------------------------------------------------------------
// Directories, for the automatic backup
// ---------------------------------------------------------------------------

export const canChooseDirectory = (): boolean => pickers().showDirectoryPicker !== undefined;

export interface DirectoryChoice {
  ok: boolean;
  handle: FileSystemDirectoryHandle | null;
  name: string | null;
  cancelled: boolean;
  reason: string | null;
}

/** Ask for a folder to keep backups in. Read-write, because we write into it. */
export async function chooseDirectory(): Promise<DirectoryChoice> {
  const show = pickers().showDirectoryPicker;
  if (show === undefined) {
    return {
      ok: false,
      handle: null,
      name: null,
      cancelled: false,
      reason: 'This browser cannot pick a folder. Backups have to be saved by hand here.',
    };
  }
  try {
    const handle = await show({ mode: 'readwrite', id: 'daggerheart-backups' });
    return { ok: true, handle, name: handle.name, cancelled: false, reason: null };
  } catch (err) {
    if (isAbort(err)) return { ok: false, handle: null, name: null, cancelled: true, reason: null };
    return { ok: false, handle: null, name: null, cancelled: false, reason: why(err) };
  }
}

export type DirectoryAccess = 'granted' | 'prompt' | 'denied' | 'unsupported';

/**
 * Can we still write there? A handle survives in IndexedDB across sessions but
 * the permission does not always survive with it, and asking again needs a
 * user gesture - which an automatic backup does not have.
 */
export async function directoryAccess(
  handle: FileSystemDirectoryHandle,
  options: { request?: boolean } = {},
): Promise<DirectoryAccess> {
  const capable = handle as unknown as PermissionCapable;
  if (capable.queryPermission === undefined) return 'unsupported';
  try {
    let state = await capable.queryPermission({ mode: 'readwrite' });
    if (state === 'prompt' && options.request === true && capable.requestPermission !== undefined) {
      state = await capable.requestPermission({ mode: 'readwrite' });
    }
    return state;
  } catch {
    return 'denied';
  }
}

/**
 * Write a file into the chosen folder, then open it again and check.
 *
 * The write used to be reported as successful the moment `close()` resolved.
 * That is not the same thing as a file on disk being readable: a `pagehide`
 * write can be cut short when the phone freezes the page, a full disk can
 * accept a stream and truncate it, and a sync client can be halfway through
 * the file when the app reads back what it thinks it wrote. An unverified
 * backup is not a backup, and this app's first rule about backups is never to
 * claim one happened.
 *
 * The check here is the whole text, not a character count: byte equality
 * catches a truncation at any offset. What the bytes *mean* is the caller's
 * business - this function knows about text and folders, not about character
 * sheets - so a caller that wants the file parsed passes `verify`, and
 * `runBackup` does, because a backup is only a backup once it has been read
 * back and counted.
 */
export async function writeIntoDirectory(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  text: string,
  options: { verify?: (written: string) => string | null } = {},
): Promise<SaveResult> {
  try {
    const file = await handle.getFileHandle(fileName, { create: true });
    await writeAndClose(await file.createWritable(), text);

    const written = await (await file.getFile()).text();
    const disagreement =
      written !== text
        ? `${fileName} was written but came back different when it was read again (${String(written.length)} characters instead of ${String(text.length)})`
        : (options.verify?.(written) ?? null);

    if (disagreement !== null) {
      return {
        ok: false,
        route: 'file-system',
        fileName,
        cancelled: false,
        reason: `${disagreement}, so it has not been counted as a backup.`,
      };
    }

    return { ok: true, route: 'file-system', fileName, cancelled: false, reason: null };
  } catch (err) {
    return {
      ok: false,
      route: 'file-system',
      fileName,
      cancelled: false,
      reason: `Could not write ${fileName} to the backup folder: ${why(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Getting a file in
// ---------------------------------------------------------------------------

export interface PickedFile {
  name: string;
  /** Decoded as text, which is what both file formats here are. */
  text: string;
  /** The file itself, for callers whose payload is binary (an art pack). */
  file: File;
}

export interface PickOptions {
  /** Extensions offered in the picker, e.g. `['.dhart']`. */
  extensions?: string[];
  description?: string;
  mime?: string;
}

/**
 * Open the file picker. Uses the File System Access API when it is there and a
 * plain `<input type="file">` otherwise, which is what iOS gets.
 */
export async function pickFile(options: PickOptions = {}): Promise<PickedFile | null> {
  const extensions = options.extensions ?? [CHARACTER_EXTENSION, BACKUP_EXTENSION];
  const mime = options.mime ?? FILE_MIME;
  const types: PickerAcceptType[] = [
    {
      description: options.description ?? 'Daggerheart character or backup',
      accept: { [mime]: extensions },
    },
  ];

  const api = pickers();
  if (api.showOpenFilePicker !== undefined) {
    try {
      const [handle] = await api.showOpenFilePicker({
        types,
        multiple: false,
        id: 'daggerheart-export',
      });
      if (handle === undefined) return null;
      const file = await handle.getFile();
      return { name: file.name, text: await file.text(), file };
    } catch (err) {
      if (isAbort(err)) return null;
      throw new ImportError(`The file could not be opened: ${why(err)}`);
    }
  }

  if (typeof document === 'undefined') {
    throw new ImportError('There is no file picker in this environment.');
  }

  const file = await promptForFile([...extensions, mime].join(','));
  if (file === null) return null;
  return { name: file.name, text: await file.text(), file };
}

function promptForFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    let settled = false;
    const finish = (file: File | null): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    // Coming back to the window with an empty picker is the only signal a
    // browser without the `cancel` event gives. It is a guess - the user may
    // have merely switched apps mid-pick - so it is used *only* where the
    // alternative is a promise that never settles and an input element that
    // stays attached to the body for the life of the page.
    function onFocus(): void {
      setTimeout(() => {
        if ((input.files?.length ?? 0) === 0) finish(null);
      }, 500);
    }

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    if ('oncancel' in input) {
      input.addEventListener('cancel', () => finish(null));
    } else {
      window.addEventListener('focus', onFocus, { once: true });
    }
    document.body.append(input);
    input.click();
  });
}

/** Pick a file and read it. Null when the user closed the picker. */
export async function importFromPicker(): Promise<ImportedFile | null> {
  const picked = await pickFile();
  if (picked === null) return null;
  return parseTransferFile(picked.text);
}

export const readFile = async (file: File): Promise<ImportedFile> =>
  parseTransferFile(await file.text());
