/**
 * Does the file reader actually run the converter, or merely import it?
 *
 * `MIGRATIONS` is empty today and will stay empty until the first schema bump,
 * so nothing in this repo can produce a record that needs converting. That
 * leaves the wiring unexercised - and an unexercised seam is the one class of
 * defect this project has now shipped to users four times.
 *
 * So the converter is replaced with one that does something visible, and the
 * questions are the ones that matter on the day of the bump: does
 * `readCharacter` read the *converted* record rather than the one that arrived,
 * and does the user get told a conversion happened rather than having their
 * sheet silently rewritten?
 *
 * Mocking the module rather than injecting a list is deliberate. The list is a
 * default parameter resolved inside `shared/migrations.ts`, so replacing the
 * export would not change what `migrateCharacterRecord` walks; replacing the
 * function is the only substitution that reaches the code under test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION } from '../../shared/types.ts';

const migrate = vi.hoisted(() => vi.fn());

/*
 * Two substitutions, and the second one needs a word.
 *
 * `OLDEST_READABLE` equals `SCHEMA_VERSION` today, so there is no version that
 * is both older than this build and readable by it - which means the envelope's
 * range gate would refuse every fixture this file can construct before the
 * converter was ever reached. The gate itself is tested against the real
 * constants in `tests/store/migrations.test.ts`; here it is stood down so the
 * wiring behind it can be seen at all.
 */
vi.mock('../../shared/migrations.ts', async () => {
  const actual = await vi.importActual<typeof import('../../shared/migrations.ts')>(
    '../../shared/migrations.ts',
  );
  return { ...actual, migrateCharacterRecord: migrate, checkReadable: () => {} };
});

const { ImportError, parseTransferFile, serializeCharacter } = await import(
  '../../src/transfer/fileIo.ts'
);
const { SchemaError } = await import('../../shared/migrations.ts');
const { makeCharacter } = await import('../fixtures/factories.ts');

/** A v2-looking file: an old name field the current build does not read. */
const oldFile = (): string => {
  const text = serializeCharacter(makeCharacter({ name: 'Wrong', level: 4 }));
  const parsed = JSON.parse(text) as Record<string, unknown>;
  parsed['schemaVersion'] = 2;
  (parsed['character'] as Record<string, unknown>)['schemaVersion'] = 2;
  (parsed['character'] as Record<string, unknown>)['legacyName'] = 'Right';
  return JSON.stringify(parsed);
};

beforeEach(() => {
  migrate.mockReset();
});

describe('a file from an older schema', () => {
  it('is read as the converter left it, not as it arrived', () => {
    migrate.mockImplementation((record: Record<string, unknown>) => ({
      record: { ...record, name: record['legacyName'], schemaVersion: SCHEMA_VERSION },
      from: 2,
      applied: ['name moved out of legacyName'],
    }));

    const file = parseTransferFile(oldFile());
    const character = file.characters[0]!;

    // Every field below this point in `readCharacter` is read by name off the
    // record. Reading the pre-conversion one would give "Wrong".
    expect(character.name).toBe('Right');
    expect(character.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrate).toHaveBeenCalled();
  });

  it('says out loud that it was converted, and what the converter did', () => {
    migrate.mockImplementation((record: Record<string, unknown>) => ({
      record: { ...record, schemaVersion: SCHEMA_VERSION },
      from: 2,
      applied: ['gold became three denominations', 'scars moved off the death move'],
    }));

    const file = parseTransferFile(oldFile());
    expect(file.warnings.join(' ')).toMatch(/older version of the app \(schema 2\)/);
    expect(file.warnings.join(' ')).toMatch(/gold became three denominations/);
    expect(file.warnings.join(' ')).toMatch(/scars moved off the death move/);
  });

  it('says nothing at all when no converter ran', () => {
    migrate.mockImplementation((record: Record<string, unknown>) => ({
      record,
      from: SCHEMA_VERSION,
      applied: [],
    }));

    const file = parseTransferFile(serializeCharacter(makeCharacter({ name: 'Current' })));
    expect(file.warnings).toEqual([]);
  });

  it('turns a schema refusal into an import error the screen can render', () => {
    migrate.mockImplementation(() => {
      throw new SchemaError('uses a schema nothing here can read.', 1);
    });

    // Not a bare SchemaError: every caller of `parseTransferFile` catches
    // `ImportError` and renders its message, so a SchemaError escaping here
    // would reach the user as an unhandled rejection instead of a sentence.
    expect(() => parseTransferFile(oldFile())).toThrow(ImportError);
    expect(() => parseTransferFile(oldFile())).toThrow(
      /That character file uses a schema nothing here can read/,
    );
  });

  it('does not swallow an error that is not about the schema', () => {
    migrate.mockImplementation(() => {
      throw new TypeError('something else went wrong');
    });
    expect(() => parseTransferFile(oldFile())).toThrow(TypeError);
  });

  it('converts every character in a backup, not only the first', () => {
    migrate.mockImplementation((record: Record<string, unknown>) => ({
      record: { ...record, name: `${String(record['name'])}!`, schemaVersion: SCHEMA_VERSION },
      from: 2,
      applied: ['exclaimed'],
    }));

    const library = JSON.stringify({
      format: 'dhbackup',
      schemaVersion: 2,
      app: '0.0.1',
      exportedAt: '2020-01-01T00:00:00.000Z',
      characters: [makeCharacter({ name: 'One' }), makeCharacter({ name: 'Two' })],
    });

    const file = parseTransferFile(library);
    expect(file.characters.map((c) => c.name)).toEqual(['One!', 'Two!']);
    expect(migrate).toHaveBeenCalledTimes(2);
  });
});
