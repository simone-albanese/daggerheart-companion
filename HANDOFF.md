# Handoff — resuming this work with an empty context

Everything below is true at `e61dbed`. The tree is clean, `tsc --noEmit` is
clean, and the suite is **1289 passing in 56 files**. Nothing is pushed yet.

## Read these first, in this order

1. `BACKLOG.md` — the work list. Anything struck through with a commit hash
   beside it is done; anything with open `- [ ]` bullets is not.
2. `.blueprints/production-gaps.md` — the audit of the backlog itself.
3. This file.

## Working rules that are in force

- **Reason about screen ergonomics explicitly before writing UI.** Thumb arc,
  target size (44 px floor), read-vs-touch. Say the numbers.
- **The Play screen scrolls.** The old "no scrolling here" rule is overruled.
- **One commit per step**, with a message that says what was wrong and why the
  fix is shaped the way it is.
- **Every test must fail on the pre-fix code before it counts.** Verify it by
  mutation and say so in the commit message.
- Never let the app claim something happened that did not happen.

## What was finished this session

| Item | Commits | Note |
|---|---|---|
| P3-7 harness | `c226a09`, `7416ab4`, `4047a39`, `03de58b`, `1394b4d` | `.tsx` collection, whole-tree orphan check, 76-component mount, React warnings fail the run |
| P0-8 schema | `b514cbc`, `0f6db68`, `23a626e`, `d442ebb`, `7a9379b` | converter chain, file path converts on read, database path quarantines, policy in `Architecture.md` §6.1 |
| P0-1 + P0-7 | `2c176c5`, `e61dbed` | no import writes over a newer local copy; counters synced on import |
| P0-5 | `d8e222a`, `e61dbed` | persistence asked on every first character, no resurrection after delete, malformed records quarantined, backups verified by reading back |

### Three new guards a newcomer will meet immediately

- **`tests/harness/orphans.test.ts`** holds `DELIBERATE`, an allowlist of every
  exported symbol in `src/` that nothing reaches, each with the reason and the
  backlog item that deletes the line. **Wiring one of them fails the suite until
  its line is removed.** That is the intended behaviour, not an obstacle.
- **`tests/ui/screens.test.tsx`** mounts every exported component in `src/ui`.
  **Adding an exported component without a fixture fails the suite.** Any React
  console warning during a mount also fails it.
- **`tests/store/migrations.test.ts`** enforces the schema policy. Bumping
  `SCHEMA_VERSION` without a converter and a committed fixture fails nine tests.

## What is open, in priority order

**P0**
- **P0-2** — the automatic backup never runs and Settings says it does.
  `installBackupHooks` / `backupAtSessionEnd` / `noteSession` / `integrityCheck`
  still have no callers. Includes the `setPrefs`/`loadPrefs` clobber of
  `lastBackupAt` and the phone banner that can never fire.
- **P0-3** — a failed character write is swallowed. `flush()` clears `pending`
  before awaiting the writes, with no try/catch and no `unhandledrejection`
  handler. Note `db.putCharacter` can now throw `StaleBuildError` deliberately,
  so this handler has a real case to render.
- **P0-6** — the codec has no integrity check: 30.9 % of single-bit corruptions
  decode into a *different* character.

**P1** — P1-1 (damage rolls), P1-2, P1-3, P1-4, P1-5, P1-6, P1-7 (rests).
**P2** — P2-1 (the tablet band cannot roll), P2-3, P2-4, P2-5 (blank rectangle).
**P3** — P3-1, P3-2, P3-3, P3-4, P3-5 (the flaky test), P3-6, P3-8..P3-11.
**P4** — the whole hygiene section.

## In flight when this paused

A background workflow, run id **`wf_ddfcd395-1da`**, was still running. It
produces adversarially-verified implementation blueprints for every open
backlog item above, plus a hunt for the P3-5 flaky test in an isolated
worktree. Its transcripts are at

    ~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/
      75012554-eedc-40eb-8508-d94548713981/subagents/workflows/wf_ddfcd395-1da/

`journal.jsonl` there records each agent's return value. The blueprints are
worth reading before starting any P1 or P2 item, but nothing depends on them:
every item is fully described in `BACKLOG.md`.

## Loose ends left deliberately

- `restoreFromText` and `restoreFromPicker` still have no callers and are still
  on the orphan allowlist. The *rule* they held is now shared
  (`src/store/merge.ts`), but the functions themselves are redundant with the
  store's import path. Decide in P0-2: wire `restoreFromPicker` as the Settings
  "restore a backup" action, or delete both.
- `FrameCollector` / `toFrameBytes` and `parseCharacterFile` / `parseBackupFile`
  are exercised by tests as though they were the paths the app takes. They are
  not. Recorded in the orphan allowlist; not yet resolved.
- The unarmoured thresholds and the three-slot armour spend are still the app's
  own invention presented as rules (P1-5).
