/**
 * What the backup subsystem should read and write once the app has booted.
 *
 * `backup.ts` takes its library, its campaigns and its preferences through
 * `BackupDeps` so it can be tested without a database, and its defaults go
 * straight to IndexedDB and straight to localStorage. Every screen used those
 * defaults, and both of the halves this file overrides were wrong once there
 * was a running app:
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
 *
 * ## Why there is no campaign entry here, and why adding one is a regression
 *
 * The campaigns want exactly the same treatment as the library - memory, not
 * disk, for the reason the first bullet gives - and they deliberately do **not**
 * get it through this file. There is no `import { useGm } from '../ui/gm/gmStore.ts'`
 * below and there must not be one.
 *
 * `gmStore.ts` ends in a bare `void hydrateGm()` at module scope, on purpose, so
 * that the GM chunk arriving *is* the hydration starting. This module is
 * imported eagerly by `App.tsx`, `Settings.tsx` and both error boundaries. An
 * import from here into the GM store would therefore drag the whole lazy GM
 * chunk into the first paint and start a campaign read for every player who
 * never opens the GM screen at all - including from a screen that has just
 * crashed, which is the one moment the app has least to spare.
 *
 * So the edge is inverted instead: `store/campaignSource.ts` owns a slot,
 * `gmStore` fills it with `snapshotCampaigns` from its own module-scope
 * epilogue - beside `publishCampaignAlert`, which is the same inversion for the
 * other half of this problem - and `backup.ts` reads the slot through its own
 * default deps. `campaignAlert.ts` states the rule in that direction and
 * `gmStore.ts` already obeys it.
 *
 * The two campaign doors are therefore both defaulted in `backup.ts` and
 * neither is overridden below. Nothing about them is a decision this file gets
 * to make; what it owns is the reason it must not make one.
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
