/**
 * What the backup subsystem should read and write once the app has booted.
 *
 * `backup.ts` takes its library and its preferences through `BackupDeps` so it
 * can be tested without a database, and its defaults go straight to IndexedDB
 * and straight to localStorage. Every screen used those defaults, and both
 * halves of that were wrong once there was a running app:
 *
 *   - **the library.** A backup read from IndexedDB is a backup of what
 *     survived the last write. When writes are failing - a full disk, an older
 *     build refusing to flatten a newer record - that is precisely the work the
 *     user is about to lose, and the fingerprint check would then report
 *     *"Nothing has changed since the last backup"* over an evening of play.
 *     The store is the freshest copy the app has, and it is what is on screen.
 *   - **the preferences.** `runBackup` stamped `lastBackupAt` into localStorage
 *     directly, while `state.setPrefs` merges patches onto the copy the store
 *     loaded at launch - which never received the stamp - and writes the whole
 *     key back. Every `setScreen` calls `setPrefs`. So the manual backup that
 *     did run lost its own stamp on the next tab tap, `daysSinceBackup` stayed
 *     `null` forever, and the phone banner that only appears at five days could
 *     never appear at all.
 *
 * Routing both through the store leaves exactly one writer of `dhc.prefs.v1`,
 * so the in-memory copy and localStorage cannot drift apart again.
 *
 * Deliberately **not** given to `integrityCheck` or `noteSession`. Those two
 * compare what is on the *disk* against a list kept in localStorage, and that
 * is the whole evidence they have. A store-sourced list can never throw, so the
 * "the character store could not be opened" branch would become unreachable and
 * an unreadable launch would be reported as characters having vanished - and
 * would then overwrite the only record of what used to be here. Reading the
 * disk is also the conservative direction: it can only ever fail to notice a
 * loss, never invent one.
 *
 * Its own module rather than a block in `backup.ts`: `backupFolder.test.ts`
 * re-imports `backup.ts` under `vi.resetModules()`, and an import of `state.ts`
 * there would drag `dataset.ts` and the whole compiled SRD into it.
 */
import type { BackupDeps } from './backup.ts';
import * as db from './db.ts';
import { useApp } from './state.ts';

export const appBackupDeps: Partial<BackupDeps> = {
  listCharacters: async () => {
    const state = useApp.getState();
    // Before `ready` there is no store to read; `init` has not answered yet.
    return state.ready ? state.characters : db.listCharacters();
  },
  readPrefs: () => useApp.getState().prefs,
  writePrefs: (patch) => useApp.getState().setPrefs(patch),
};
