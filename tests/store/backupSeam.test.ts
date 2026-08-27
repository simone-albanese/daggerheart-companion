/**
 * Which library and which preferences each backup entry point reads.
 *
 * That is a correctness question, not a style one, and both directions of it
 * have already gone wrong.
 *
 * Take the defaults from a screen and `runBackup` stamps `lastBackupAt`
 * straight into localStorage, while `state.setPrefs` merges every later patch
 * onto the store's copy - which never received the stamp - and writes the whole
 * key back. Every `setScreen` calls `setPrefs`, so the manual backup that did
 * run lost its own stamp on the next tab tap, and the phone banner that only
 * appears from five days could never appear at all.
 *
 * Take the *store's* list in `integrityCheck` and the opposite happens: that
 * call can no longer throw, so on the one launch where the database would not
 * open - `init` sets `ready` with an empty library and a rendered banner, not a
 * rejection - the seven-day check would report every character as gone, and
 * then overwrite the only record of what used to be here with nothing.
 *
 * Asserted on source text rather than behaviour, for the reason
 * `tests/pwa/wiring.test.ts` gives: the defect is not in what a function does,
 * it is in which one the app hands it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const read = (path: string): string => stripComments(readFileSync(path, 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Every call to `name(` in `src`, with its argument text, outside comments. */
function callsTo(name: string): Array<{ file: string; args: string }> {
  const found: Array<{ file: string; args: string }> = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join('/');
    // Where these are defined, and the module that defines the deps, are not
    // call sites.
    if (file === 'store/backup.ts' || file === 'store/backupDeps.ts') continue;
    for (const call of read(path).matchAll(new RegExp(String.raw`\b${name}\(([^)]*)\)`, 'g'))) {
      found.push({ file, args: call[1] ?? '' });
    }
  }
  return found;
}

describe('what each backup entry point is allowed to read', () => {
  // Everything that writes a preference, or exports what the user can see.
  for (const name of [
    'runBackup',
    'backupStatus',
    'chooseBackupFolder',
    'forgetBackupFolder',
    'installBackupHooks',
  ]) {
    it(`${name} is never called with the localStorage-only defaults`, () => {
      const sites = callsTo(name);
      expect(
        sites.length,
        `nothing in src calls ${name}, so this guard is guarding nothing`,
      ).toBeGreaterThan(0);
      for (const site of sites) {
        expect(
          site.args,
          `${site.file}: ${name}(${site.args}) takes the defaults, which write straight to localStorage — the next setPrefs then writes the whole key back from a copy that never got the change`,
        ).toMatch(/appBackupDeps/);
      }
    });
  }

  for (const name of ['integrityCheck', 'noteSession']) {
    it(`${name} still reads the disk, because that is the only evidence it has`, () => {
      for (const site of callsTo(name)) {
        expect(
          site.args,
          `${site.file}: ${name}(${site.args}) reads the store, which can never throw — so a launch where the database would not open gets reported as characters having vanished`,
        ).not.toMatch(/appBackupDeps/);
      }
    });
  }
});

describe('the automatic backup is reached at all', () => {
  // `installBackupHooks`, `backupAtSessionEnd`, `noteSession` and
  // `integrityCheck` had no caller anywhere in `src`, and Rollup tree-shook the
  // whole regime out: `page-hide` and `knownCharacterIds` appeared in no file
  // under `dist/assets`. The settings screen said a copy was written at the end
  // of every session the entire time.
  const app = read(join(SRC, 'ui/shell/App.tsx'));

  it('installs the hooks the settings screen says are running', () => {
    expect(app).toMatch(/\binstallBackupHooks\s*\(/);
  });

  it('runs the seven-day check the architecture describes', () => {
    expect(app).toMatch(/\bintegrityCheck\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// The campaigns, and the edge that must keep pointing the other way
// ---------------------------------------------------------------------------

/**
 * Every module a static import reaches from an entry point, following relative
 * specifiers only. Type-only imports are skipped: they are erased and drag no
 * chunk with them, and the whole question here is what arrives at first paint.
 */
function reachedFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = read(file);
    for (const found of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+([^;]*?)from\s+'([^']+)'/g)) {
      const clause = found[1] ?? '';
      const specifier = found[2] ?? '';
      if (/^type\s/.test(clause.trim())) continue;
      if (!specifier.startsWith('.')) continue;
      const resolved = resolve(dirname(file), specifier);
      if (existsSync(resolved)) stack.push(resolved);
    }
  }
  return seen;
}

const GM_STORE = join(SRC, 'ui/gm/gmStore.ts');

/**
 * One body of a function in `backup.ts`, from its signature to the next
 * top-level `export`. Which door each entry point holds is the correctness
 * question; a grep over the whole file would answer it for the file rather
 * than for the function.
 */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} is not in backup.ts any more`).toBeGreaterThan(-1);
  const rest = source.slice(start + signature.length);
  const end = rest.indexOf('\nexport ');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('the backup never reaches into the GM store', () => {
  /*
   * `gmStore.ts` ends in a bare `void hydrateGm()` at module scope, on purpose,
   * so that the GM chunk arriving *is* the hydration starting. `backup.ts` and
   * `backupDeps.ts` are pulled into the first paint by `App.tsx`, `Settings.tsx`
   * and both error boundaries - so an import from here into the GM store would
   * drag that whole lazy chunk into the launch of every player who never opens
   * the GM screen, and start a campaign read from a screen that has just
   * crashed. The edge is inverted through `campaignSource.ts` instead: that
   * module owns a slot and `gmStore` fills it.
   */
  for (const entry of ['store/backup.ts', 'store/backupDeps.ts', 'store/campaignSource.ts']) {
    it(`${entry} cannot pull the GM chunk into the first paint`, () => {
      const reached = [...reachedFrom(join(SRC, entry))];
      expect(reached.length, `${entry} resolved no imports at all`).toBeGreaterThan(1);
      expect(
        reached.filter((file) => file === GM_STORE),
        `${entry} reaches ui/gm/gmStore.ts, whose last line starts a campaign read`,
      ).toEqual([]);
    });
  }

  it('publishes the seam from the GM store, which is the only place that can', () => {
    // The inversion is only real if the other end exists: a slot nobody fills
    // silently falls back to the disk for ever, which is the fatal this whole
    // design was built to close.
    expect(read(GM_STORE)).toMatch(/\bpublishCampaignSource\s*\(\s*snapshotCampaigns\s*\)/);
  });
});

describe('which campaign door each entry point holds', () => {
  const backup = read(join(SRC, 'store/backup.ts'));

  /*
   * Two doors, and they answer different questions.
   *
   * `liveCampaigns` is memory, through the publish seam, and it is what a
   * backup is written from: `writeActive` updates `state.campaigns` only after
   * `putCampaign` resolves, so on the evening writes are failing a flush cannot
   * make the disk fresh and a disk-sourced backup would write the stale record,
   * verify it happily and stamp "last backup: today" over an evening that
   * exists nowhere.
   *
   * `listCampaigns` is the disk, and the seven-day check may read nothing else:
   * its only evidence is the difference between a read that can throw and a
   * list in localStorage, and a store-sourced list can never throw.
   */
  it('writes a backup from the published seam, not from the disk', () => {
    expect(backup).toMatch(/liveCampaigns:\s*currentCampaigns/);
    expect(bodyOf(backup, 'export async function runBackup(')).toMatch(/d\.liveCampaigns\(\)/);
  });

  it('reads the disk for the seven-day check and for the session note', () => {
    expect(backup).toMatch(/listCampaigns:\s*\(\)\s*=>\s*readCampaigns\(\)/);
    for (const signature of [
      'export async function integrityCheck(',
      'export async function noteSession(',
    ]) {
      const body = bodyOf(backup, signature);
      expect(body).toMatch(/d\.listCampaigns\(\)/);
      expect(
        body,
        `${signature} takes the published snapshot, which can never throw — so a launch where the campaign store would not open gets reported as campaigns having vanished`,
      ).not.toMatch(/liveCampaigns/);
    }
  });

  it('never writes a backup from the door the seven-day check reads', () => {
    expect(bodyOf(backup, 'export async function runBackup(')).not.toMatch(/listCampaigns/);
  });
});

/**
 * One sentence about what a run wrote, in one place, reached by all four.
 *
 * Settings, the unsaved-work strip, `ScreenBoundary` and `AppBoundary` each
 * printed their own copy of `Saved ${outcome.fileName ?? 'the copy'} -
 * ${outcome.characters} characters`. That was true only while a run that wrote
 * anything had written the library: `runBackup` returned early on an empty
 * one, so `fileName` could not be null on a success. The campaign leg makes it
 * null twice over - a GM who plays nobody, and an unchanged library beside a
 * board that moved - and all four would then have named a `.dhbackup` that was
 * never written and counted characters into it.
 *
 * Source text rather than behaviour for this file's own reason: three of the
 * four are crash screens, the sentence is one line inside a `.then`, and the
 * defect is not in what the function does but in which one the screen reaches
 * for. `savedFiles` is asserted on its own in `backup.test.ts`.
 */
describe('what a run wrote is said in one place', () => {
  const SCREENS = [
    'ui/settings/Settings.tsx',
    'ui/shell/App.tsx',
    'ui/shell/ScreenBoundary.tsx',
    'ui/shell/AppBoundary.tsx',
  ];

  for (const screen of SCREENS) {
    it(`${screen} says what was written through savedFiles`, () => {
      const source = read(join(SRC, screen));
      expect(source, `${screen} calls runBackup and is not in this list`).toMatch(
        /\brunBackup\s*\(/,
      );
      expect(source).toMatch(/\bsavedFiles\s*\(\s*outcome\s*\)/);
      for (const field of ['fileName', 'characters']) {
        expect(
          source,
          `${screen} reads outcome.${field} to build its own sentence again. Both fields are null-blind on their own: a run that wrote a campaign and no library file has no file name, and a character count belonging to a file it did not write`,
        ).not.toMatch(new RegExp(`outcome\\.${field}`));
      }
    });
  }

  it('leaves no fifth caller printing its own', () => {
    const others = sourceFiles(SRC)
      .filter((file) => /\brunBackup\s*\(/.test(read(file)))
      .map((file) => relative(SRC, file).split(sep).join('/'))
      .filter((file) => file !== 'store/backup.ts' && file !== 'store/backupDeps.ts');
    expect(others.sort()).toEqual([...SCREENS].sort());
  });
});
