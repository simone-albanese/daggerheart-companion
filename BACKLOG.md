# Backlog to 1.0

What still has to happen before real people trust this app with characters they
have played for months, ordered by what it costs them when it goes wrong.

**Produced by** a seven-lens read-only audit of the tree at `ffd87ce`, plus a
character matrix over all 3240 buildable sheets and a mutation pass that broke
the source on purpose to find out which tests were only decorative. 72 raw
findings went to adversarial verifiers whose instructions were to *refute* them:
33 survived, 7 were killed as not-findings, the rest were downgraded. Only what
survived is written down here.

**Priority is risk, not effort.** P0 can destroy work that exists nowhere else.
P1 tells a player a wrong number they will act on at the table. P2 makes the app
unusable on a device we support. P3 fails without telling anyone. P4 is hygiene.
A trivial P0 outranks a large P3 every time.

**Line numbers** are against `ffd87ce` unless noted. They drift; the file and the
symbol are the durable part.

**Second pass, `91097eb`.** A round of work driven by three reports from a real
phone — no Experiences on the Play screen, missing icons, no weapons or items —
plus a mobile-first redesign of Play. What that pass closed is struck through
below and listed under *Done in this pass*; what it changed about the diagnosis
is corrected in place and marked **[corrected]**. Two of the three reports were
defects nobody had found: neither appears anywhere in the first audit, and one
of them had been shipping since the first commit.

---

## P0 — Can lose a character

There is no server and no second copy. Everything in this section ends with
someone's months of play gone and nothing to restore from. This is the only
section where being wrong cannot be fixed afterwards.

### ~~P0-1 · Importing a file silently overwrites a newer character~~ — **done, `2c176c5`**
`src/store/merge.ts` · `src/ui/shared/ImportConflicts.tsx` · **medium, 2–4 h**

`importCharacter` is an unconditional `db.putCharacter(c)`. IndexedDB `put` is
keyed on `id`, so restoring an August backup **overwrites the September
character in place**. No prompt, no undo, no history. The hint beside the button
actively encourages it and never mentions that a newer local copy is destroyed.

The safe version already exists, is correct, and is tested: `restoreFromText`
(`backup.ts:583`) skips any character whose local copy has a newer `updatedAt`
and reports the counts. **It has zero callers in `src/`.**

For contrast: deleting *one* character requires arm-then-confirm with a full
inventory of what is lost (`Edit.tsx:392`). Overwriting the whole library takes
one tap.

- [x] ~~Route Settings through `restoreFromText`~~ — **done differently, and the
      difference matters.** `restoreFromText` writes straight to IndexedDB, so
      routing the screen through it would update the database behind the store's
      back and leave the library on screen stale. What was shared instead is the
      *rule*: `src/store/merge.ts` holds `decideImport`, and both
      `restoreFromText` and the store's import call it. One implementation, two
      callers, rather than the one correct implementation with no callers that
      this bullet found.
- [x] ~~Make `importCharacter` itself refuse to clobber~~ — **done**. It returns
      the conflict with nothing written; the screen offers KEEP MINE /
      TAKE THEIRS / KEEP BOTH. KEEP BOTH mints a new id *and* a new name,
      because the header picker is a list of names and two characters called
      Ilya are indistinguishable at exactly the moment you need to tell them
      apart. `updatedAt` is left alone so the copy does not look newer than it
      is.
- [x] ~~Same guard on the other blind paths~~ — **done, all four**, including
      `Recovery.tsx`, which was **not** exempt: "only renders on an empty
      library" is not "only renders when the library is empty", and `state.ts`
      empties `characters` whenever the read fails. The storage banner
      promising the characters are still there sat directly above a Paste
      button that wrote over them by id.
- [x] ~~Rewrite the hint~~ — **done**, and it now names the case it used to
      hide: updated in place *unless this device has the newer edit, in which
      case nothing is written over and you are asked.*

### ~~P0-2 · The automatic backup never runs, and Settings says it does~~ — **done, `79632b3`, `fb84a36`**
`src/store/backup.ts:324` · `src/ui/settings/Settings.tsx:561` · **medium, 4–6 h**

`installBackupHooks`, `backupAtSessionEnd`, `integrityCheck` and `noteSession`
have **no callers anywhere in `src/`**. Confirmed at bundle level: the strings
`page-hide`, `session-end` and `knownCharacterIds` do not appear in
`dist/assets/` at all — Rollup tree-shook the entire regime away.

Meanwhile the screen says: *"A copy is written into 'X' at the end of a session
and when the app closes."* The user picks a folder, reads that, stops pressing
the button, and the folder stays empty forever. `backup.ts:16` forbids exactly
this: *"never claim a backup happened."*

Three defects compound, which is why they are one work item:

- [x] ~~**The false claim.**~~ — **done.** The hint now describes what the two
      hooks actually do, including what they cannot: a page in the background is
      not running, so the newest copy is from the last time the user left. The
      no-folder branch splits in two and names iPhone and iPad, where
      `canChooseDirectory()` is permanently false.
- [x] ~~**`lastBackupAt` is destroyed by the next tab tap.**~~ — **done**, but
      **not** the way this line proposed. Merging `setPrefs` onto `loadPrefs()`
      would have made every preference silently revert in a Safari private
      window, where `savePrefs` throws and swallows (`prefs.ts:66`) so
      `loadPrefs()` answers with the defaults. Instead every screen passes
      `appBackupDeps`, whose `writePrefs` goes through the store — leaving one
      writer of `dhc.prefs.v1`, so the two copies cannot drift at all. The same
      clobber existed for `backupTarget` through `chooseBackupFolder` and
      `forgetBackupFolder`, which this line did not mention; those are routed
      too, and `backupSeam.test.ts` fails if any call site takes the defaults
      again.
- [x] ~~**On a phone the nag can never fire.**~~ — **done.** The gate now reads
      the same `urgent` the banner already computes, which includes *never*, and
      takes `NAG_AFTER_DAYS` from `backup.ts` rather than repeating 5 twice.
- [x] ~~Call `installBackupHooks()` … `integrityCheck()` … `noteSession()`~~ —
      **done**, with two corrections. `integrityCheck` runs from an `App` effect
      once `ready` rather than inside `init()`, and deliberately keeps the
      *default* deps: it compares the disk against a list in localStorage, and a
      store-sourced list can never throw, so the one launch where the database
      would not open would be reported as every character having vanished — and
      would then overwrite the record of what used to be here with nothing.
      `noteSession()` runs from inside `installBackupHooks`, on both hidden
      events, for the same reason: reading the disk can fail to notice a loss
      but can never invent one. The restore offer goes to the Settings screen
      that already has one, not to a second restore in the shell — see the
      commit that deletes `restoreFromText`.

      **[found while wiring]** `integrityCheck` appended *"This browser clears
      stored data after about a week of not being used"* to **any** absence,
      with no gate on `triggered` — which had existed there since the module was
      written. Delete a character, have the tab closed before the session note
      ran, come back five minutes later, and the app blamed the browser for
      something the user did. The cause is now claimed only where there is
      evidence for it, and says how many days.
- [x] ~~Add a test asserting the app registers the `pagehide` hook~~ — **done**,
      and stronger than asserted: `appWiring.test.tsx` mounts the real `App`,
      dispatches a real `pagehide`, and asserts a file was written into a folder
      handle — plus that the disposer takes the listeners with it, that the
      session note was recorded, and that the seven-day check reaches the screen.
      `backupSeam.test.ts` keeps the cheap structural guard beside it.

### ~~P0-3 · A failed character write is swallowed with no signal~~ — **done, `fc11442`**
`src/store/state.ts:79-103` · **small, 2–3 h**

`flush()` clears `pending` at line 85 **before** awaiting the writes at line 86,
with no try/catch, and all three call sites are bare `void flush()`. There is no
`unhandledrejection` handler anywhere, and `ScreenBoundary` is a render-phase
boundary that cannot see an async rejection.

At quota — the art pack writes ~20 MB of blobs into the same origin — every
`put` rejects. The UI shows every HP mark, every Hope spent and every level-up
as applied, because zustand state is in memory and nothing ever reads back from
IndexedDB. Three hours later the tab closes and the evening is gone.

The safety net makes it worse: `runBackup` reads from IndexedDB, not the store,
and skips on an unchanged fingerprint — so with all writes failing it reports
*"Nothing has changed since the last backup."*

Every other store in the repo handles this deliberately (`prefs.ts:57`,
`gmStore.ts:161`, `heldDice.ts:74`, `conditionsStore.ts:112` each carry a written
justification for swallowing). The one store `db.ts:4` calls *"the user's work of
months"* is the one with no handler.

- [x] ~~try/catch in `flush()`; put the batch back; a `writeError` the shell
      renders~~ — **done.** Each write is caught on its own so one refusal cannot
      take the batch with it, and a failure is re-queued — never over a newer
      edit made while the write was in flight, and never over a character the
      user deleted in that window. `writeError` clears only when *nothing* is
      outstanding, not when the last batch happened to succeed. Quota is
      recognised through the error's `cause` chain as well as its own name,
      because a transaction that aborts carries the request's error underneath;
      what it cannot classify, it names rather than guesses at.

      **[not in the item]** `flush` also had to be serialised. It cleared
      `pending` synchronously and awaited below, so a second flush found an empty
      map and resolved *before* the first one's writes had landed — `await
      flushPending()` never meant what every caller read it as. `remove()` now
      leans on that to put the delete strictly behind the write it was racing,
      which is the half of P0-5(c) that `pending.delete(id)` never closed.
- [x] ~~Do **not** reuse the `storageError` banner~~ — **done**, and the
      banner's own sentence had to go too: *"nothing has been written in the
      meantime"* is an invitation to reload, and it is only true while every
      write has succeeded. That clause is now conditional on there being no
      write failure.
- [x] ~~Make `runBackup` flush first, or source from the in-memory store~~ —
      **done**, by sourcing from the store (`backupDeps.ts`). Not by flushing:
      the flush would have to happen on `pagehide`, which does not wait for
      promises, and if the store is the freshest copy — which is the reason for
      reading it — the flush buys nothing. This is also what makes the alert's
      **Save a copy now** export the work that did not reach the disk, instead of
      reporting that nothing has changed since the last backup.

### ~~P0-4 · Press-and-hold inside a track header clears the track~~ — **done, `7aa8965`**
`src/ui/shared/Track.tsx:105` · **trivial, 30 min**

The four pointer handlers sit on the Track root, which wraps the pip row **and**
the header. On a phone the damage input lives in that header
(`Vitals.tsx:166`), so a 480 ms press to position the caret zeroes `hp.marked` —
and iOS's own long-press threshold is ~500 ms, while `HOLD_MS` is 480. Worse,
the header button's click still fires afterwards, so a slightly long press on
the "SEVERE · 3 HP" chip leaves `hp.marked = 3` instead of `8`: a
plausible-looking wrong number rather than an obvious wipe.

Anyone whose taps routinely exceed 480 ms — tremor, iOS Touch Accommodations —
triggers it on ordinary taps. The same applies to the GM's PartyBoard, where it
zeroes a *player's* HP.

- [ ] Move the four handlers onto the `role="group"` pip row at `Track.tsx:128`,
      and move `opacity: holding ? 0.75 : 1` with them. `DualityRoll.tsx:557`
      already does this correctly — copy that shape.

### ~~P0-5 · Second-tier durability~~ — **done, `d8e222a`**
**~4 h total**

- [x] ~~**Persistent storage is never requested on an import path.**~~ — **done.** `create()`
      asks when the library is empty (`state.ts:203`); `importCharacter` never
      asks — and the user who just restored a library onto a fresh origin has the
      most at stake. Once populated by import, `first` is false forever, so a
      later `create()` never asks either. *(trivial)*
- [x] ~~**The IndexedDB connection is never reopened after the browser kills it.**~~ — **done**, `terminated` plus a reset on rejection.
      `db.ts:47` is `dbPromise ??= openDB(...)` with no `terminated` callback and
      no reset on rejection: one force-closed connection and every write for the
      life of the tab rejects into P0-3's void. Pass
      `terminated: () => { dbPromise = null; }` and clear on rejection —
      `handleStore` in `backup.ts:132` already uses that pattern. Add
      `blocked`/`blocking` before ever bumping `DB_VERSION`. *(trivial)*
- [x] ~~**A pending debounced write can resurrect a just-deleted character.**~~ — **done**, and before the database delete rather than after.
      `remove()` (`state.ts:221`) does not `pending.delete(id)`. *(trivial)*
- [x] ~~**One malformed record makes the whole library unreadable — usually.**~~ — **done**, by reading database records through the same hardened reader the file path uses. What cannot be read is quarantined by name; what can be repaired is repaired, so a missing `updatedAt` costs a timestamp rather than a character. One clause the item did not anticipate: a record whose `updatedAt` is invented fresh on every launch wins every merge comparison against every backup, forever, so repairs are persisted once.
      `db.ts:67` sorts with `b.updatedAt.localeCompare(...)`; a record missing
      that field throws and `listCharacters` fails entirely — surfacing as the
      storage banner claiming everything is probably fine. Filter-and-quarantine
      on read: return what parses, collect what does not, offer to export the
      raw JSON. *(small)*

      **[corrected]** Measured rather than assumed, over sizes 2–5 with the bad
      record at every index: it throws in **every position except the last**,
      where V8's sort happens never to pass the missing field as the left
      operand — there it silently sorts to the front and is returned. So this is
      worse than "the library will not load": it is *intermittent*, and which
      way it falls depends on where `getAll` puts that record, which is key
      order, which is a UUID. A user would see it come and go for no visible
      reason. (An adversarial verifier claimed the opposite — that it never
      throws — on the strength of one fixture that happened to put the bad
      record last. Both halves were wrong; the sweep is in the session log.)
- [x] ~~**A backup is recorded as successful without ever being read back**~~ — **done.** `writeIntoDirectory` reopens the file and compares the whole text; `runBackup` passes a `verify` callback that parses it and counts the characters. The split is deliberate — the writer knows about text and folders, the caller knows what the bytes mean. Both folder fakes in the suite had to learn to be read back, which is itself the point: a fake that cannot be reopened reports every backup as a failure.
      (`fileIo.ts:549`), and the download route reports success from a click. An
      unverified backup is not a backup: re-open the handle with `getFile()`,
      parse it, assert the character count, and only then `stamp`. *(small)*

### ~~P0-6 · The codec has no integrity check: a corrupted payload decodes into a different character~~ — **done, `4f2ada4`, `57f6cb2`**
`src/transfer/codec.ts` · **medium, 3–5 h**

Measured, not theorised. 8136 single-bit flips across 15 real sheets, one bit
per byte:

| outcome | count | share |
|---|---|---|
| rejected with an error | 5621 | 69.1 % |
| accepted, identical | 3 | 0.04 % |
| **accepted, and a different character** | **2512** | **30.9 %** |

Nearly a third of single-bit corruptions produce a sheet the app takes as
valid. Flipping bit 0 of byte 3 of a real payload changes the decoded `id` to a
different UUID with no error at all. Across a level-10 bard's payload the
altered fields were `inventory` (823 cases), `notes` (386), `levelUpHistory`
(372), `connections` (294), `scars` (255), `experiences` (205), `loadout` (75)
and `level` (8).

This is the format whose entire job is carrying someone's months of play from
an old phone to a new one. A smudged QR frame, a truncated file on a flaky
share, a bad byte on a USB stick — and the receiving device shows a character
that looks right and is not. Silent corruption is worse than a refused import,
because the refusal can be retried and the corruption is discovered weeks later
with no clean copy left.

The decoders are otherwise well hardened — see *Already good* — so this is a
missing layer, not a broken one. Note the frame layer already carries a
per-transfer id and the file layer has its own envelope; what has no checksum of
its own is the encoded character.

**[corrected before building]** The framing above is wrong in one load-bearing
way: the app was **not** exposed. Every route into `decodeCharacter` arrives
through the frame layer, both receive surfaces passed `verify: crc32`, and the
same sweep measures that the frame header's checksum caught **all 2512** of
them. So "a smudged QR frame and the receiving device shows a character that
looks right and is not" was not reachable. What was real is that the *format*
carried no integrity of its own and the check belonged to whoever happened to
call it — `qr.ts` read `if (options.verify !== undefined && ...)` — so anything
feeding bytes in from anywhere else inherited nothing, silently.

- [x] ~~Add a checksum over the encoded body and verify it before decoding.~~ —
      **done.** crc32 over the whole payload with its own four bytes zeroed, so
      the header byte is inside it too: that closes the three header bits
      nothing read, which were a separate written-down finding. Four bytes; no
      payload in the 93-sheet matrix crosses a frame boundary because of them.
- [x] ~~Version the format so an old build meeting a new payload says so rather
      than guessing.~~ — **done**, `CODEC_VERSION = 2`, with format 1 still
      **read** and never written: the hand-off this vector exists for is an old
      phone sending to a new one, so the sender is the build that has not
      updated. The message is deliberately *not* the actionable one the plan
      proposed — "the sending device is newer, update this app" is a confident
      guess in exactly the corruption case the item exists for, since a damaged
      nibble reads as a format number just as well as a real one. It says what
      the code knows: this transfer says it is format N, this app reads 1 and 2,
      either it came from a different version or it is damaged.

      **Known transitional cost, accepted:** an *updated* player sending to a
      *stale* GM's PartyBoard is refused, because the receiver's build is not
      one the sender controls. Nothing is lost — nothing is imported — and the
      message names the disagreement. Weighed against a format that can never
      be adopted wrongly again.
- [x] ~~Re-run the bit-flip sweep as a test and assert the accepted-and-different
      count is **zero**~~ — **done**, and the zero is not empirical: CRC-32
      detects every single-bit error because `x^k` is never divisible by the
      generator. 8196 flips, 100 % refused. The test carries two sets of teeth:
      untouched payloads still round-trip, and a payload tampered with *and
      resealed* decodes into a different character — so the guard is a checksum
      and not a decoder that refuses everything.
- [x] **[not in the item]** ~~The check a receive surface could forget.~~ —
      `createAccumulator`'s `verify` option is gone; every reassembled payload is
      measured against the checksum its own frames declared, always. That was the
      only live exposure this item had, and it was not in the item.

### ~~P0-7 · Imported characters skip the counter sync every other write path runs~~ — **done, `2c176c5`**
`src/store/state.ts:232-238` · **small, 1–2 h**

`importCharacter` persists a character exactly as it arrived, with no
`syncCounters(c, deriveStats(...))` pass — unlike `normalizeActive`
(`state.ts:284`), which every other mutation path goes through.

Concrete: a sheet arrives from a newer device with its class ref parked as
`?60007`. `deriveStats` cannot resolve the class and falls back to
`startingHitPoints ?? 6` (`character.ts:187`), so the build derives `maxHp` 6
while the stored `hp.max` stays at the wire's 12. The two disagree until the
player next levels up or changes armor, and `validatePlan`'s at-maximum warnings
(`levelUp.ts:306`) read the stored one.

Three UI paths call `importCharacter` directly: `Settings.tsx:468` and `:675`,
`Recovery.tsx:34`, `Transfer.tsx:302` — the same four that need the
no-clobber guard in P0-1, so fix them together.

- [x] ~~Sync the counters on the import path~~ — **done**, in `normalizeIncoming`
      (`state.ts`), and it does one thing the item did not ask for: when this
      build cannot resolve the character's class or their armour, it leaves the
      record exactly as it arrived. Clamping against `startingHitPoints ?? 6`
      would have thrown away the numbers the sheet came with, and a ref this
      build cannot name today may well resolve after the next update. Pinned by
      two tests in `tests/store/import.test.ts`.
- [x] ~~Four UI paths~~ — **done**, and it was four sites at three doors: every
      one now goes through `useImportFlow`, so there is one import path.

---

### ~~P0-8 · The first schema bump makes every backup unreadable, and the database path never checks at all~~ — **done, `b514cbc`..`d442ebb`**
`shared/migrations.ts` · `src/store/db.ts` · `tests/store/{migrations,db}.test.ts` · **medium, 3–5 h**

`SCHEMA_VERSION = 3`, and `checkSchema` throws in **both** directions. The
downward branch reads: *"There is no converter for that version yet, so it has
not been imported."* There is no converter. `grep -rn migrat src shared tools
tests` returns one prose comment (`backup.ts:23`) and nothing else — no version
table, no converter chain, no fixture for any historic schema. The refusal is
pinned as intended behaviour by `tests/transfer/fileIo.test.ts:133-145`, so it
cannot drift into working by accident.

The app's whole durability story is "IndexedDB can be evicted, so keep exported
files" (`backup.ts:1-24`, README:136-146). The moment that constant becomes 4,
every `.dhchar` and `.dhbackup` on disk, in a Drive folder, and in the daily
folder P0-2 exists to fill becomes permanently unreadable by the only app that
can read it — and it fails at the worst possible moment, because you reach for
the backup precisely *when* IndexedDB was evicted, by which point no old build
is left on the device to open it with. The error even says *"nothing has been
changed or lost"*, which is true of the file and false of the user's situation.

The database path has the opposite problem: it never looks. `schemaVersion` is
written in three places (`character.ts:270`, `codec.ts:811`, `fileIo.ts:358`)
and read in exactly one — `checkSchema`, on the file path only. `listCharacters`
(`db.ts:65`) is a `getAll` and a sort; `init()` drops the result into the store;
`flush()` writes it straight back. `DB_VERSION = 1` has a single
`upgrade(database)` that only calls `createObjectStore` four times, with no
`oldVersion` branch. And **no test in this repo ever opens a database** —
`tests/store/` is two backup files and there is no `fake-indexeddb` in
`package.json` — so `upgrade`, `listCharacters`, `removeLayer` and `clearAll`
are entirely unexercised.

This bites because this app makes two builds coexist on one device *by design*:
`UpdateBanner` offers the waiting worker rather than swapping the bundle
mid-session. After a bump the old bundle reads a v4 record with no check,
renders it as v3, and writes it back through the 400 ms debounce — degrading the
character in place, in the only copy, with nothing on screen. That is exactly
the silent misinterpretation `fileIo.ts` spends ten lines and a test preventing
on the file path. And `openDB(DB_NAME, 1, …)` against an already-upgraded
version-2 database rejects with `VersionError`, which `state.ts:143-149` catches
into the generic `storageError` — so `App.tsx:152` tells the user to *"close the
other tabs and reload"*, advice that cannot work, because the stale bundle
reloads into the same failure.

Costs nothing today. It is a precondition attached to a version bump, on the
same footing as P0-5's `blocked`/`blocking` bullet — and the only thing that
would currently make a maintainer notice is a `tsc` error, because
`character.ts:270` hardcodes the literal `3` against a `typeof SCHEMA_VERSION`
field. That error points at the wrong file.

- [x] ~~A converter chain keyed by version~~ — **done, `b514cbc`**. A chain and
      not a jump table: each converter reads one version and produces exactly
      that version plus one, so the cost of a bump stays one function forever.
      Converters take a plain record rather than a `Character`, because a v2
      record is not one — that is why it needs converting — and typing it as one
      would let a converter read a field the old build never wrote and get
      `undefined` with the compiler's blessing.

      **`MIGRATIONS` is empty, and that is the correct content.** `SCHEMA_VERSION`
      has read 3 since `8c83f78`, so nothing numbered 1 or 2 has ever left a
      machine and `OLDEST_READABLE` is 3. Writing converters for them would be
      inventing a history to be compatible with. What had to exist *before* the
      first bump is the machinery, the policy and the test.
- [x] ~~Applied on read rather than rejected~~ — **done, `0f6db68`**.
      `readCharacter` converts before it reads, which is the whole change:
      everything below that line reads fields by name. When a converter runs the
      user is told which schema the file came from and what each converter did —
      a sheet quietly rewritten is the same failure as a sheet quietly refused.
      Two refusals survive and they are the only two that can: a file from the
      future, and a version below `OLDEST_READABLE`.
- [x] ~~Read `schemaVersion` in `listCharacters`, quarantine anything newer~~ —
      **done, `23a626e`**, as `readLibrary()`. Quarantined records are named to
      the user one by one rather than counted: *"some characters could not be
      read"* is the sentence that makes a person open every sheet looking for
      the missing one. `putCharacter` reads before it writes and refuses to
      overwrite a stored version ahead of the build — one extra round trip on a
      debounced write, in exchange for an old bundle being unable to flatten a
      newer one's work.
- [x] ~~Give `db()` an `oldVersion` branch and a `VersionError` message~~ —
      **done, `23a626e`**, plus `blocked`/`blocking`. Without the branch the
      first `DB_VERSION` bump throws `ConstraintError` on every device that
      already has a database, which is every device with a character on it.
- [x] ~~A stated policy, and `fake-indexeddb` so a test can prove it~~ —
      **done**. The policy is in `Architecture.md` §6.1 and enforced by
      `tests/store/migrations.test.ts`: bump the constant and change nothing else
      and **nine tests fail**. `tests/store/db.test.ts` is the first test in this
      repository ever to open a database.

Two things worth recording. The `terminated` callback and the reset-on-rejection
that P0-5 asks for are **not** in this change and are still open; only the
version-related half of `db()` was touched. And the new tests found a defect in
this very change: `tx.abort()` makes `tx.done` reject with an `AbortError`
nothing awaits, so a deliberate refusal also emitted an unhandled rejection —
P0-3's failure arriving as a side effect of P0-8's fix, caught because
`fake-indexeddb` finally made the path runnable.

## P1 — Tells a player a wrong number

Nothing here loses data, but each one makes the app confidently wrong about a
rule at the table, which is how a tool like this loses trust permanently.

### ~~P1-1 · Attack rolls do not lead into damage rolls~~ — **done, `9b4053a`, `d708b38`, `5c18104`, `42c4bfa`**
`src/engine/dice.ts:264` · `src/ui/player/DamageRoll.tsx` · `src/ui/player/Play.tsx`
· **medium, 4–6 h** · *requested directly*

Struck at the heading because every box below is ticked and the two paragraphs
after them name what was deliberately left out: extra damage **dice**, and the
`companion` attack source. Neither is this item, and both are written down where
a reader will meet them — the dice in `Architecture.md` §3.2, the companion in
the paragraph below. The verification pass that read the diff back afterwards is
`886fc00`, `c30e51c`, `106445b`, `35d64f9`, `c2962fa`, `5d7737e` and `3041d6f`.

The SRD is explicit (`data/srd-1.0.json`, rule `attacking`, p. 39): *"On a
successful attack, roll damage."* Attack first, then — only on a hit — damage.

The engine is already right and already tested: `applyProficiency` multiplies the
dice count and not the modifier, and `rollDamage`'s critical adds the maximum
possible result of the damage dice (`2d8+1` → `2d8+1+16`), matching the SRD text
word for word.

**But `rollDamage` has zero call sites outside tests.** No screen ever rolls
damage. `DualityRoll` resolves the attack and stops; the equipped-weapon button
in `Play.tsx:285` only `pushLog`s a note with the formula. So the critical the
Duality Roll just determined never reaches the damage roll, which is the exact
link the rule is about.

**[corrected] Half of this is now built.** `src/ui/player/attack.ts` (`3f3637c`)
carries the attack between the two rolls and holds the four rules `damageOffer`
has to get right, including the three-valued `succeeded` that a plain
`if (result.succeeded)` would silently drop — which would mean every table that
keeps its Difficulties hidden could never roll damage. Both traps are pinned by
mutation: each break fails exactly one test. Tapping a weapon on Play now arms
the roll with the weapon's trait (`91097eb`), and `Play.tsx:281`'s inline regex
is gone in favour of `weaponDamage`. **What is still missing is the last link:
nothing calls `rollDamage` yet.** A successful roll does not offer the damage
step, so `rollDamage` still has zero callers outside tests.

**[corrected again, `9b4053a`..] The last link is built.** `rollDamage` has a
caller: `src/ui/player/DamageRoll.tsx`, mounted last in the phone's roll block
and between ROLL and the log on desktop. `DualityRoll` snapshots the attack out
of the `DualityResult` that produced it and hands it over; the row asks
`damageOffer` and never reads `succeeded` for itself. Unarmed attacks have a row
in `Equipped`, and so does Spellcast damage with its refusal at +0. Damage dice
can be typed as well as rolled. **Every box below is ticked; what is left is
named in the two paragraphs after them, and neither is this item.**

**Not built, and out of scope for P1-1.** Extra damage *dice* are still
unsupported: `rollDamage` takes a flat `extraModifier` and has no notion of an
added die, and the held-dice tray feeds `DualityInput.bonusDice`, which is the
attack roll and not the damage roll. So the SRD's own *"Tusks: +1d6"* example
and `Architecture.md` §3.2's promise of a proposal button for it both remain
unbuilt. The `companion` variant of `AttackSource` also stays unreachable:
`companionDamage` exists and `CompanionPanel` prints it, but arming a companion
needs a second armed slot on Play and a decision about whose Proficiency and
whose roll it is.

- [x] ~~Carry the resolved attack — including `critical` — into a damage roll
      offered on success. Offer, never auto-apply~~ — **done, `9b4053a`**. The
      row is `src/ui/player/DamageRoll.tsx`, in its own file so that it cannot
      reach for `succeeded` instead of asking `damageOffer`, and so that
      `rollAffordance.test.ts`'s counts over `DualityRoll.tsx` still mean what
      they say. It imports neither `update` nor `engine/damage.ts`, and a miss,
      a reaction roll, an unrollable pool and a build with the roller switched
      off all draw text with no target rather than a disabled button naming the
      thing it will not do.
- [x] ~~Damage must be typeable as well as rollable, the way the Duality dice
      already are, for tables that roll physical dice.~~ — **done, the commit
      after the one that closed Spellcast damage**. It gates on the same
      `affordance.canType` the Hope and Fear faces gate on, so one switch means
      one thing and the two halves of a roll cannot disagree about whether this
      table types its dice. One slot per die, `Die`'s grid at five faces across
      instead of four, and the roll resolves the moment the last face lands —
      through `rollDamage(pool, { fixed })`, so the engine still does all of the
      arithmetic and the critical bonus cannot be got wrong by a second route. A
      digital roll mirrors its faces back into the slots, the way the Duality bar
      mirrors Hope and Fear, so the dice on screen never sit beside a total they
      do not add up to. With the roller off the control is disabled and wears
      `affordance.label` — ENTER YOUR DICE — rather than a greyed ROLL DAMAGE.
      The face grid's one-way-in-one-way-out problem is P3-12, which is `Die`'s
      as much as it is this row's.
- [x] ~~**Spellcast damage is a different rule and is not implemented.** *"Any
      time an effect says to deal damage using your Spellcast trait, you roll a
      number of dice equal to your Spellcast trait"*, and at +0 or lower you roll
      nothing. 77 of the 189 domain cards mention Spellcast and 43 carry a dice
      formula; none is rollable today.~~ — **done, the commit after `d708b38`**;
      the house form names a sha and a commit cannot name its own. A panel in
      `Equipped`, drawn only for a character who has a Spellcast trait at all.
      The app supplies the one number that is on the sheet — the die count, which
      is the trait and not Proficiency — and the player taps the die and types
      the modifier, which are on the card in their hand: a `DomainCard` carries
      free prose, only three of the 189 say *"using your Spellcast trait"* and
      only preservation-blast pairs the phrase with a formula, so parsing a pool
      out of card text would mean overwriting the `2` a card printed itself. At
      +0 or lower there are no chips, no input and no greyed control — the SRD's
      own sentence stands where the dice would be, in quotation marks because it
      is the book's and not ours.
- [x] ~~**Unarmed attacks** (`[Proficiency]d4`) do not exist in the code — zero
      hits for "unarmed" in `src/`.~~ — **done, the commit after `9b4053a`**;
      the house form names a sha and a commit cannot name its own. A row after
      the weapons in `Equipped`, drawn even when nothing is equipped, and
      arming it moves no trait chip: *"Unarmed attack rolls use either Strength
      or Finesse (GM's choice)"* is the GM's call and not the app's.
- [x] ~~`Play.tsx:281` rescales Proficiency with an inline regex instead of
      calling `weaponDamage()`~~ — **done, `91097eb`**.

### P1-2 · Recall is allowed with every Stress marked, and pays in HP
`src/engine/loadout.ts:47` · `src/ui/player/Play.tsx:354` · `src/ui/player/Cards.tsx:107`
· **small, 1–2 h**

`canAddToLoadout` returns `{ allowed, affordable }`. **No UI reads
`affordable`** — both recall sites gate on `allowed` alone, so `recallCard` runs,
`markStress` finds no free Stress, and marks **HP** instead (`damage.ts:141`).

Reproduced against the real engine: 6/6 Stress, 5/6 HP, recall cost 1 → HP 6/6 →
`hasFallen` true → **the death move offer appears.** 158 of 189 SRD cards have a
recall cost ≥ 1.

The shipped SRD `stress` rule: *"A character can't use a move that requires them
to mark Stress if all of their Stress is marked."*

- [ ] Read `affordable` and require an explicit confirm naming the HP it will
      cost. Do **not** hard-block with `allowed: false` — whether a vault recall
      is a "move" under that sentence is a table ruling, and the Recall Cost text
      is not in the shipped rules layer, so the app cannot cite the rule it would
      be enforcing.

### P1-3 · Proficiency can be taken twice in the same tier
`src/engine/levelUp.ts:102-110, 271-277` · **trivial, 30 min**

The option is `slots: 2, costsBothPicks: true`. `validatePlan` charges
`picksUsed += 2` but counts only **one** unit of slot usage per taking. Executed
against the real engine: taking it at levels 5, 6, 8 and 9 all validate `ok`, and
the result is **level 10 Proficiency 8 instead of 6** — a `d8+2` weapon rolling
`8d8+2` instead of `6d8+2`. `LevelUp.tsx:497` even renders "TIER 3 · 1 OF 2 LEFT"
after the first taking.

The shipped `leveling-up` rule settles it: *"you must spend two advancements and
mark BOTH level-up slots in order to take it."*

- [ ] Count `option.slots` against usage per taking when `costsBothPicks`.
- [ ] Do **not** write two history entries: `deriveStats` computes proficiency as
      `baseProficiency(level) + advancementCount(c, 'proficiency')`
      (`character.ts:145`), so two entries would grant +2.
- [ ] `LevelUp.tsx:104, 283, 325` recomputes `used` independently and needs the
      same change, or the button will disagree with the validator.

### P1-4 · School of Knowledge's extra card at level-up
`src/ui/build/cardAllowance.ts` · **small, 1–2 h**

Creation is fixed (see *Done*), but the same subclass grants an additional domain
card at **specialization** (*Accomplished*) and **mastery** (*Brilliant*) too. The
level-up path does not know that yet.

- [ ] Extend the allowance to the level-up flow, reusing the same table so there
      is one source of truth rather than two.
- [ ] **Beastbound (Ranger)** mastery: *"Choose two additional level-up options
      for your companion."* The only other subclass in the SRD that changes a
      count the app enforces. Same shape, different quantity.

### P1-5 · Rules honesty, second tier
**~4 h total**

- [ ] **An unresolvable armor ref silently produces wrong thresholds.**
      `character.ts:147-157` takes the same branch for a present-but-unresolvable
      `activeArmor` as for no armor at all, giving the unarmored `[0, level]`
      formula and `armorScore` 0. A level-5 character in improved chainmail
      should read 16/29. *(small)*
- [ ] **"Free during downtime" is printed mid-combat** for the 31 SRD cards with
      `recallCost: 0` (`Play.tsx:370`, `Cards.tsx:116`). Branch on the `downtime`
      option, not on the resulting cost. *(trivial)*
- [ ] **~~Unarmored thresholds are the app's own invention presented as rules~~**
      **[corrected — half of this was wrong, and the other half is now sourced]**

      The first clause does not survive checking: an auditor traced
      `character.ts`'s unarmoured formula and it is not an invention. Do not
      label as a house rule something the rules say.

      The second clause is real and now has a citation. `Vitals.tsx` lets one
      incoming attack spend **up to three** Armor Slots; the official GM screen
      states the rule outright: *"You can only mark **ONE** armour slot per
      incoming damage (unless an ability or domain card says otherwise)."* So
      this is not a house rule to label — it is a wrong number the app offers,
      three times too generous, on the control a player reaches for at the
      worst moment of a fight.

      Fix it in `applyDamage`/`markDamage` rather than in the screen, so the cap
      cannot be re-invented by the next surface that spends armour; the
      parenthesis is why the cap must be a parameter with a default of 1 and not
      a hard-coded `1`. Verify the shipped SRD carries the sentence before
      quoting it on screen — if it does not, the app may enforce the cap but
      must not cite a rule the user cannot read in the app.
- [x] ~~**`src/engine/rest.ts` has zero callers** — 226 lines, 28 passing tests, and
      no rest or downtime anywhere in the UI; `state.ts:29` declares a `'rest'`
      log kind nothing produces. It is fully tree-shaken, so it costs users
      nothing today. Decide: wire it, or say out loud that rest is not in 1.0.~~ — **decided: it ships.** See P1-7.
- [ ] **`newCharacter` seeds the wrong HP and Stress track for six of nine
      classes.** `character.ts:282` hardcodes `max: 6` for both, but
      `startingHitPoints` is 5 for bard and wizard and 7 for guardian and seraph.
      Latent rather than live: the only persisting caller is `store.create`
      (`state.ts:188`), whose single call site happens to pass an already-synced
      sheet. The moment a second caller appears — duplicate-character, a template
      flow, a test seed — a wizard is stored with a 6-box track the engine
      derives as 5, and `validatePlan` warns *"Hit Points are already at the
      maximum of 12"* one advancement early. Seed from the class, or make
      `create()` sync. *(trivial)*

---

### P1-6 · A card this build cannot name vanishes from the sheet, the cap still counts it, and the parked ref never heals
`src/engine/loadout.ts:37, 133-142` · `src/transfer/codec.ts:1047` ·
`src/ui/player/Play.tsx:80, 715, 785` · **medium, 3–5 h** · *found independently by two lenses*

Two dead functions, one defect.

`missingCardRefs` (`loadout.ts:140`) is doc-commented *"Refs the current dataset
cannot resolve. Shown, never dropped."* It has five tests and **zero callers in
`src/`**. What both display paths actually use is `resolveCards`
(`loadout.ts:133`), seven lines above it, which is a `.filter()` that drops them
— at `Play.tsx:80-81` for loadout *and* vault, and at `sheetModel.ts:207` for
the printed sheet. Nothing under `src/ui` references `isUnresolvedRef` or
`UNRESOLVED_PREFIX` at all.

Meanwhile the cap gates on the **raw** array: `loadout.ts:37` is
`if (c.loadout.length >= MAX_LOADOUT)`. So a character holding five cards, two
of which this build cannot name, renders `3 / 5 ACTIVE` (`Play.tsx:715`), offers
`2 SLOTS FREE` (`Play.tsx:785`), and then refuses every recall with *"Loadout is
full (5) - move a card to the vault first."* The screen contradicts itself; the
player cannot move the ghosts because no screen renders them and no control
reaches them (`Cards.tsx:100` does `dataset.domainCards.find(...)` and returns
early on `undefined`); the loadout is two slots short for the life of the
character, with no message anywhere naming the cause. The card is missing from
the printed sheet too, which is the paper backup.

The healing half is dead as well. `resolvePlaceholders` (`codec.ts:1047`) has
zero callers in `src/` — only three test files. This is not merely a stale doc
comment: `codec.ts:851-853` builds the warning *"They are kept on the sheet and
will resolve when the missing source is added."*, `Transfer.tsx:301-308` renders
it verbatim to the user, and `Architecture.md:345-346` states the same promise
as a rule. **A sentence on screen promises a repair that no code path in `src/`
can perform** — P3-6's failure on a surface that matters more.

One correction for whoever does this: `resolvePlaceholders` resolves against
`registry.slugOf`, which is the committed append-only `data/registry.json`
compiled into the bundle. It does not change when the dataset reloads, so the
doc comment's *"call it after a dataset reload"* is itself wrong. The real
trigger is app startup after a build whose registry has grown.

Nothing is destroyed — the ref survives on disk and round-trips through the
codec, which `matrix.test.ts:216` pins. This is a wrong number the player acts
on, plus a jammed control, plus a promise the app cannot keep. Note the
precedent: P1-2 is the same defect shape in the same file — `canAddToLoadout`
returns `affordable` and no UI reads it. The audit caught one unread return
value in `loadout.ts` and missed the other.

- [ ] Render what `missingCardRefs` returns, on Play and on the print sheet: a
      ghost row naming the ref, counted against the cap so `n / 5 ACTIVE` and
      `SLOTS FREE` agree with the gate, and removable to the vault by hand.
- [ ] Call `resolvePlaceholders` at startup, after `init()` loads the library,
      and re-persist what it heals — so an update that grows the registry
      repairs the sheets already on the device.
- [ ] Until it does, `codec.ts:851` must not promise a repair that never
      happens. Wire the resolver or change the sentence.

P0-7 already uses this exact scenario — *"a sheet arrives from a newer device
with its class ref parked as `?60007`"* — but only asks for `syncCounters` at
import time, which assumes the ref stays parked forever and fixes the counter
disagreement instead. The backlog cannot accept the scenario as real there and
treat it as hypothetical here.

### ~~P1-7 · Rests and downtime, wired to a screen~~ — **done, `d88289c` · `adeaae4` · `851d04c`**
`src/engine/rest.ts` · `src/ui/player/Rest.tsx` · `shared/types.ts` · **medium, 6–8 h** · *requested directly*

P1-5 left this as a question — wire the rest engine or say out loud that rest
is not in 1.0. It is answered: rest ships, with the arithmetic done for the
player, reachable from the Play screen.

**The engine is already there and is already right.** `src/engine/rest.ts` is
226 lines with 28 passing tests and, still, zero callers: `RestKind`,
`DOWNTIME_MOVES`, `movesFor(rest)`, `takeRest(c, stats, rest, choices, options,
rng)` and `mustTakeLongRest(count)`. Its own header states the rule this feature
turns on — *"The moves that clear a track are pure arithmetic, so the app rolls
and applies them; Work on a Project is narrative, so it only nudges a countdown
the GM already made."* That is the automatic part: nobody at the table should be
adding 1d4+Tier to an Armor track by hand while the scene waits.

What does not exist is the screen, and one piece of state.

**The state is the interesting half.** `mustTakeLongRest` takes
`consecutiveShortRests` as a parameter and **nothing anywhere persists it** —
`grep -rn "consecutiveShort|shortRest|restCount" shared/types.ts src/` returns
only the engine's own two lines. The SRD needs it: *"If a party takes three
short rests in a row, their next rest must be a long rest."* So this feature
adds a field to `Character`, which is a schema change, which is the thing P0-8
says this app currently cannot survive. **P0-8 is a precondition of this item,
not a neighbour of it** — ship a counter into the record before there is a
converter and the first person to bump the schema loses every export.

**What the screen owes the rules**, all of it already in the shipped `downtime`
rule text: two moves per rest and the same move may be taken twice; a different
list for short and long, which `movesFor` already returns; Prepare grants one
Hope alone and two with the party, which is why `takeRest` accepts `partySize`
and why `prefs.gmPartySize` already exists; an interrupted long rest gives only
a short rest's benefits; and moving cards between loadout and vault is free
during a rest, which is a loadout operation the screen has to offer rather than
reimplement.

**Where it goes.** In the scrolling part of the Play screen, not the pinned
block. A rest happens between conflicts and never mid-roll, so it must not take
a pixel from the tokens or the roll path, which is what P2-4 measures the cost
of. It is also the one place a player looks after a fight ends.

- [x] ~~Persist the consecutive-short-rest count on `Character`.~~ — **done**,
      `d88289c`, and it is the first real `SCHEMA_VERSION` bump this repository
      has taken: 3 → 4, one converter writing `0` (a schema-3 build never
      counted, so the app does not know and will not guess), two new committed
      fixtures, and `tests/fixtures/schema/v3.*` left byte-identical, because
      those are the evidence and regenerating them would only prove the new
      code can read its own output. `DB_VERSION` and `CODEC_VERSION` did not
      move; Architecture 6.1 records what that cost. The write itself is
      `adeaae4`, and it lives in `takeRest` rather than on the screen because
      `mustTakeLongRest` reads the number eight lines below it — a screen that
      forgot to increment would leave the refusal permanently unreachable,
      which is the state this field was added out of.
- [x] ~~A rest surface in the Play scroll.~~ — **done**, `851d04c`,
      `src/ui/player/Rest.tsx`, between the vault and the carried items. It
      proposes by calling `takeRest` itself with every `fixedRoll` pinned to 1
      and then to 4 and an `Rng` that **throws**, so the bracket on screen and
      the numbers at the commit come out of one implementation and the preview
      cannot spend a die. Each row is bracketed against the moves that would
      already have run, so a second Tend to Wounds reads what is actually left
      rather than repeating the first one's promise.
- [x] ~~Offer the free loadout/vault swap in the same flow.~~ — **done**,
      through `canAddToLoadout` / `recallCard` with `{ downtime: true }` — the
      flag `loadout.ts` has carried since it was written and this is its first
      caller. *In the same flow* means in the same press: a tap stages the swap
      against the sheet the rest is being proposed against, and COMMIT applies
      the moves and the card moves together and records both in one `'rest'`
      entry. Applied on the tap it was the rest's price for a rest that had not
      happened — and it vanished the moment one did, because COMMIT clears
      `kind`. `useRecall` in `src/ui/player/recall.ts` keeps the *scene* recall
      for the vault and the card browser; MAX_LOADOUT is enforced in one place
      whichever surface is asking.
- [x] ~~Refuse a short rest, in words.~~ — **done**, and the shape matters: the
      SHORT control is *removed* and replaced by the SRD's own sentence, read
      out of `dataset.rules`, plus the count this sheet holds and the fact that
      a sheet arriving by QR arrives at zero. A disabled button with the word
      SHORT still on it says the app could do this and will not.
- [x] ~~Produce the `'rest'` log entry.~~ — **done**. The detail is the
      engine's own lines verbatim, refusals included, plus the Fear that was
      really rolled, plus the rule at the one moment it becomes true.
- [x] ~~The engine takes an injected `rng`.~~ — **done**: `Play.tsx` passes
      `cryptoRng` at both mounts, `tests/ui/rest.test.tsx` passes
      `scriptedRng(3, 4, 2)` and asserts the marks, the log strings and
      `rng.calls`, and every test that does not commit passes `refusingRng`.

**One thing the item asked for and did not get a control:** *"an interrupted
long rest gives only a short rest's benefits."* It is answered with the SRD's
sentence quoted beside the long rest and nothing else, because nothing on the
device can observe an interruption, and the honest route out — a short rest —
is already a button on the same surface. A second control would have resolved
to the same call while implying the app had seen something it cannot see.

## P2 — Unusable on a device we support

### P2-1 · The Play screen collapses below 1180 px wide or 700 px tall — **phone done, tablet open**
`src/ui/player/DualityRoll.tsx:395` · `src/ui/player/Play.tsx:645, 705` · **medium, 4–6 h**

Measured live in Chrome with a deliberately lean character. In the tablet band
(720–1179 px) `Play.tsx:517` puts Vitals and DualityRoll into a scrolling column;
DualityRoll's root is `flex: 1, minHeight: 0, overflow: 'hidden'`, so it is
crushed to **24 px**. On every iPad, and on every phone held in landscape, **you
cannot roll.**

At 375×667 the loadout region collapses to 0 px and the ROLL button renders at
half height.

**[corrected] The tablet number was optimistic.** Re-measured live: the panel
is 45 px at 744×1133 and 26 px at 1024×768, but the button is not merely small —
its children lay out to their natural height and `overflow: hidden` cuts
everything below the crushed box, so ROLL sits 228 px past the clip and is
**in the DOM and invisible**. That is worse than absent, because keyboard focus
still reaches it. At 1024×768 the panel starts at y=862 on a 768 px screen, so
it is off the bottom before it is even clipped.

- [x] ~~The phone half~~ — **done, `91097eb`**, by a different route than
      proposed: the page scrolls now (the owner's call), so the loadout is no
      longer the region that absorbs every shortfall. Measured after: no band
      at 0 px, ROLL at its full 66 px with its bottom edge clear of the tab bar,
      every pip at or above 31 px.
- [ ] **The tablet band, 720–1179 px, is untouched and still cannot roll.** The
      phone rebuild did not reach it. Either give it the phone's stack or the
      two-column split; what it must not keep is `DualityRoll` as a shrinkable
      child of a scrolling column.

### ~~P2-2 · Contrast below WCAG AA on text people read in a dim room~~ — **done, `83c85ae`**
`src/ui/tokens.css:63, 143, 146` · **small, 2 h**

Recomputed from the real hex values:

| token | context | ratio | needs |
|---|---|---|---|
| `--dim` dark `#6b7180` | on `--panel` | 3.41:1 | 4.5:1 |
| `--dim` dark | on `--raised` | 3.05:1 | 4.5:1 |
| `--dim` light `#8990a0` | on `--app` | 2.86:1 | 4.5:1 |
| `--hope` light `#b07b12` | on `hope-wash` (phone verdict) | 2.85:1 | 4.5:1 |
| `--hope` light, 0.75 opacity sub-line | on `--panel` | 2.15:1 | 4.5:1 |
| `--empty` unmarked pip | on `--panel` | 1.47:1 | 3:1 |

`--dim` carries 44 of 61 `.t-label`s, all at 10 px.

- [ ] Lift dark `--dim` to ~`#8b93a3` and darken light `--dim` to ~`#5f6673`.
      Keep the old value as a separate `--dim-ui` for dividers and inactive icon
      fills, so the text token can move without flattening the hierarchy.
- [ ] Darken light `--hope` to ~`#8a5f06`; keep the current value as
      `--hope-fill` for pips and chips, which only need 3:1. Drop the 0.75/0.8
      opacity on the verdict sub-lines in favour of a tuned token.
- [ ] Raise `--empty` to ~`#495062` dark / `#b9b3a4` light — at 1.47:1 you cannot
      see how big a track is.

### P2-4 · The fixed block leaves a 375px phone almost no scroll
**a constraint, not yet a defect** · *measured in this pass*

The phone Play screen keeps two things out of the scroll: the tokens and the
roll. Measured with a level 8 character:

All four tracks are pinned, on an explicit instruction. Measured with a level 8
character after the Armor track joined them:

| viewport | Experiences | scroll window | page also scrolls |
|---|---|---|---|
| 393 × 852 | 2 | 288 | no |
| 393 × 852 | 5 | **188** | no |
| 375 × 667 | 5 | **88** (the floor) | yes, by 85 px |

Before the floor existed, the last row measured **3 px** for 943 px of content —
cards, weapons and items present and unreachable. That is P2-1's failure wearing
the other hat, one region absorbing every shortfall, so the fix is the same in
both directions: the scrolling region can never go below two rows, and when the
sum overflows, the page itself takes up the slack. On any phone with room the
outer scroller never engages.

Nothing is clipped anywhere: every Experience shows its whole name, every pip
clears 31 px, ROLL keeps its full 66 px clear of the tab bar.

- [ ] 188 px on a tall phone is workable but not generous. If it grates, the
      levers are: let the Experience rows join the top of the scroll on short
      viewports, or unpin Stress. Both cost something already asked for, so
      neither happens without asking.

### P2-3 · Touch targets and the tablet header
**~3 h total**

- [ ] **The header character picker is painted over and un-clickable from exactly
      720 px up.** `Header.tsx:46`: the left row needs 480 px and is allotted 338
      at 768 px, and nothing inside shrinks. `elementsFromPoint` at the select's
      centre returns the status caption, not the select. *(trivial)*
- [x] ~~**Track density keys off viewport width, not pointer type.**~~ —
      **done, `83c85ae` + `c7ad022`**. Not by widening `--control`, which would
      have been a bug: that token gates 96 call sites including the chips inside
      the desktop cockpit's roll panel, and the panel clips its own overflow, so
      catching touchscreens there would crush it from the inside — P2-1's
      failure arriving on the desktop as a side effect of P2-1's fix. A separate
      `--pip-h` answers `any-pointer: coarse` instead, and a test asserts
      `--control` never follows it.
- [x] ~~**Armor pips are 12–18 px wide on a phone**~~ — **done, `91097eb`**.
      Measured before: 18 px at score 6 on a 393 px phone. Measured after: 43 px.
      Fixed by giving every track its own full-width row rather than by resizing
      anything.
- [ ] **All typography is in px**, so the OS font-size setting has no effect.
      Convert the type roles to `rem` and leave layout constants in px. *(small)*
      Note the order this has to happen in: every fixed height that contains
      type must become a `min-height` first, or a user at a 125 % root gets a
      clipped verdict bar.
      **Still open at HEAD**: not one type role in `src/ui/tokens.css` is in
      `rem`. It was blocked on the Play rebuild, which has landed, so it is
      unblocked — but it was not built in this pass and nothing about it has
      moved.

### P2-6 · Screen reader and focus
*(was a second `P2-4`; renumbered — the id collided with the scroll-budget item
above, and this document is what everything else is tracked against.)*
**~3 h total**

- [ ] **The roll result is never announced on desktop.** No `aria-live` anywhere
      in `DualityRoll`; focus stays on a button whose name never contains the
      outcome, and the verdict renders in an inert div (`:428-452`). On phone the
      verdict is inside the focused button, so it is one gesture away — desktop
      has nothing.
- [ ] **Five modal dialogs never move, trap or restore focus**
      (`DomainCardView.tsx:366` and four others). One ~20-line shared `useDialog`
      hook covers all of them.
- [ ] **`prefers-reduced-motion` is honoured in CSS but not by the JS smooth
      scroll** (`Settings.tsx:64`). *(trivial)*

---

### P2-5 · If the bundle does not evaluate, the app is a blank rectangle with no words and no escape
`index.html:30-31` · `src/main.tsx:8` · `public/sw.js:151, 478-490` · **small, 1–2 h**

`<body>` is the inline theme script and `<div id="root"></div>`. No static text,
no `<noscript>`, nothing inside `#root` for React to replace. `main.tsx:8`
throws at module scope. On accepting an update, `sw.js:151` calls
`pruneAssets()`, which deletes every hashed asset the new document does not name
— so the previous build's chunks are gone from Cache Storage, by design.

P3-1's last bullet — *"No boundary above the screen level… wrap `.app` in a
boundary whose fallback is an unconditional 'Export everything'"* — is a React
boundary and cannot see a module graph that never evaluated. `init()`'s 8 s
deadline (`state.ts:134-149`) genuinely covers the adjacent case, where init
hangs and the app renders a failure state. The residual is strictly *the bundle
did not run*, and it has no observer at all: nothing in `tests/` boots the
document, and none of the six *Needs a human* drills exercises the update path
against a second real deploy.

When it lands, the app is unbootable on every device at once with not one word
on screen saying so. The character is intact in IndexedDB and unreachable, and
the remedy every support page gives — clear site data, delete and reinstall the
PWA — destroys the only copy that exists. Rare per deploy; note that the deploy
gate is the same suite P3-5 records as failing about one run in five, and there
is no post-deploy check of any kind.

- [ ] Static text inside `#root` that React overwrites on mount: what the app
      is, that the character is still in the browser's storage, and what to do —
      explicitly *not* "clear site data".
- [ ] Better: an escape that does not need the bundle. A small inline script
      that opens IndexedDB, reads `characters` and offers the JSON turns a
      broken build into a bad evening rather than a lost character.
- [ ] Write down the un-ship lever, which today exists only in a code comment:
      bumping `sw.js:29`'s `VERSION` renames both caches so `takeOver()` sweeps
      them and rebuilds from the network, at the cost of a full re-download for
      every installed client.

## P3 — Fails without telling anyone

### P3-1 · UI chains with no catch
**~2 h total**

- [ ] **"Create character" can do nothing after a twelve-step wizard.**
      `Wizard.tsx` `finish()` awaits `create()` with no try/catch and is invoked
      as `void finish()`; `create()` awaits `db.putCharacter` before any state
      update. With a rejecting `openDB`, two presses produce only unhandled
      rejections and no navigation. The draft is plain `useState` with no
      persistence. Also: no in-flight disabled state, so a double-tap on a slow
      phone persists two duplicates. `Edit.tsx:426` handles the identical risk
      correctly for delete — copy it.
- [ ] **`Recovery.tsx:25` `paste()` has no try/catch or finally** — the button
      locks on "Reading…", and a partial import drops the user onto Play with a
      success-shaped outcome and no count.
- [ ] **`Settings.tsx:671` paste chain has no `.catch`/`.finally`** — `busy`
      stays true and greys out the whole backup section until a tab switch.
- [ ] **`ScreenBoundary`'s "Try again" retries the identical render and loops
      forever** (`:65`). After one failed retry, offer "Go to Settings" so the way
      out points at the export.
- [ ] **No boundary above the screen level.** `useStats()` runs in App's own
      render; Header, TabBar, the storage banner and CardReader sit outside every
      boundary. No reachable throw found today, so this is hardening: wrap `.app`
      in a boundary whose fallback is an unconditional "Export everything".

### P3-6 · The card reader says "tap anywhere to close" and means "tap outside"
`src/ui/shared/DomainCardView.tsx:613, 531, 518` · **trivial, 20 min** · *reported from a phone*

The reader's footer reads **TAP ANYWHERE TO CLOSE**. The backdrop carries
`onClick={onClose}` at `:518`, and the card panel itself carries
`onClick={(e) => e.stopPropagation()}` at `:531` — which exists precisely to
stop a tap on the card from reaching that handler, so that scrolling and
selecting inside the card do not dismiss it.

Both halves are defensible on their own. Together they put a sentence on screen
that is not true of the thing it describes, on the surface a player reads most:
somebody follows the instruction, taps the card, nothing happens, and the app
has taught them that its words are unreliable. That is the failure this
project's own rule is written against, and it is worse than a missing hint.

Note the footer text is itself a button and does close, so a tap on those exact
words works — which is how it survived: whoever tested it tapped the label.

- [ ] Decide which half is the truth and make the other match. Either close on
      a tap anywhere on the card that is not a scroll or a text selection, or
      change the copy to say what it does — "TAP OUTSIDE TO CLOSE", with the
      footer button staying as the explicit control.
- [ ] Whichever way it goes, the Escape handler at `:507` is already correct and
      undocumented on screen; a keyboard user is told nothing.

### P3-5 · One test fails about one run in five, and nothing knows which
**small, 1–2 h** · *found in this pass, not in the first audit*

Verifying each commit in isolation, `3f3637c` came back `1 failed | 1068
passed`. Re-run immediately at the same commit: 1069 passed. Three further
full runs: green. So a test in this suite is not deterministic, and the suite
is the thing this project leans on hardest — a repo that has already caught two
decorative tests by mutation cannot also afford one that lies at random.

- [ ] Run the suite in a loop until it reproduces, with `--reporter=verbose`,
      and name the test. The engine tests inject their RNG and the transfer
      tests are hermetic, so the likely candidates are the ones that touch a
      clock or a shared module-level cache: `backup.test.ts` (dates),
      `heldDice`/`conditionsStore` (localStorage across files), or a `sw.js`
      test racing its own fixture.
- [ ] Fix the source of the nondeterminism rather than the assertion.

### P3-2 · The gear search does not read the axes players type
`src/ui/build/gear.ts:112` · **small, 1–2 h** · *a decision, not a defect*

The search box reads only `name` and `feature`. Measured against the real
dataset:

| typed | rows returned | rows that actually match |
|---|---|---|
| `melee` | 26 | 100 weapons are Melee |
| `far` | 2 | 43 are Far |
| `magic` | 1 | 71 are Magic |
| `instinct` | 0 | 24 use that trait |
| `d8` | 5 | 66 roll d8 |

Nothing is unreachable — the chips cover every one of those axes, and the
behaviour matches the module's documented contract. But a player who types
`melee` gets a list that looks like the dataset is missing weapons, and that is
the same failure the honesty rule exists to prevent: the screen implying an
absence that is not real. The tests now pin these numbers, so the behaviour is
an explicit choice rather than an accident.

- [ ] Either fold range, trait, category, burden and the damage die into the
      searched text, or say on screen that the box searches names and features
      and the chips do the rest.

### P3-3 · Untrusted input, second tier
- [ ] **Decoded counter maxima are unbounded and render one DOM node each**
      (`codec.ts:295`). Clamp on the way in: run `syncCounters` inside
      `importCharacter`, or bound the readers to the engine's own ceilings, which
      are already exported. Belt and braces: have `Track` refuse to render more
      than a sane number of pips. *(small)*

### P3-4 · Offline and weight
**~6 h total**

- [ ] **`public/brand/*` is neither precached nor routed** (`sw.js:59`). Four
      shipped files, 66 KB, matching neither `isShell` nor `isImmutable`, and
      `JS_IMPORTS` only matches `.js`/`.css` so the scanner never sees them.
      Offline, the compatibility mark in the header is a broken image.
- [ ] **Activation prunes the cached importer chunk before refetching it**
      (`sw.js:106`), so accepting an update while offline loses the offline
      importer until the next online launch.
- [ ] **The "no skipWaiting, the user decides" comment is not what the code
      does** (`sw.js:85`). Make it true or correct the comment.
- [ ] **The SRD is a static import of the entry chunk**: 909,900 B raw /
      250,348 B gzip on the boot critical path before the app can paint its
      loading mark. Evaluation itself is cheap; the download is not.
- [ ] **The QR stack** (194 KB raw / 71 KB gzip, 130 KB of it jsQR) is a static
      import of both Gm and Settings. Load it when the transfer screen opens.

---

### ~~P3-7 · The harness cannot see the class of defect this project keeps shipping~~ — **done, `c226a09`..`03de58b`**
`tests/harness/` · `tests/ui/screens.test.tsx` · `vitest.config.ts` · **small, 2–3 h**

Four defects have now reached users with the same shape — code that exists,
typechecks, is tested, and is never reached: the service worker was never
registered, the wake lock was never taken, four navigation icons were never
painted, and creation discarded both Experiences. The only guard against
recurrence anywhere on this page is instance-shaped: P0-2's *"Add a test
asserting the app registers the `pagehide` hook."* One hook, one instance.

**The orphan test is one file wide, and its own docblock says it should not be.**
`wiring.test.ts:29` is `const REGISTER = join(SRC, 'pwa/register.ts')`, while
the last test already walks all of `src/` for callers. The docblock claims the
general property: *"It does not name the seams; it derives them, so a seam added
next year and forgotten is caught by a test written today."* Pointed at `src/`
as a whole it fails **today** on ~~`TIER_BENCHMARKS`~~ (**gone, P5-3**: deleted
rather than wired — the same table ships inside `data/srd-1.0.json` and the GM
reference reads it from there), `resolvePlaceholders`,
`missingCardRefs`, `reorderLoadout`, `takeRest`/`movesFor`/`mustTakeLongRest`,
`rollDamage`, and `installBackupHooks`/`backupAtSessionEnd`/`noteSession`/
`integrityCheck` — every instance this backlog lists, plus P1-6. One caveat
measured rather than assumed: the extractor is `/^export function (\w+)/gm`, so
it is blind to `export const f = () => …`, which is how `dice.ts:206`,
`fileIo.ts:574` and `:763`, `db.ts:70` and `state.ts:263` are all written.
Generalising the path alone still misses those.

**No test has ever mounted a screen.** Exactly two test files carry
`// @vitest-environment jsdom` and `createRoot` — `tests/ui/tabBar.test.ts` and
`tests/ui/track.test.ts` — and both were written *after* a person found the bug
on their own phone (`9454289`, `7aa8965`). Four more render through
`renderToStaticMarkup`, which does not run `useEffect`, and every act of wiring
in this app lives in an effect. Six `.tsx` files are imported by any test at
all; `App.tsx` appears only as a `readFileSync` path and `Play.tsx` only inside
a comment, on the screen the README says is used 90 % of the time.

**And the natural fix would pass CI at zero tests.** `vitest.config.ts:9`
includes `tests/**/*.test.ts` and no `.tsx` pattern. There are no `.test.tsx`
files today, so nothing is skipped right now — but `tests/ui/play.test.tsx`, the
obvious filename for the first real component test, is collected by nothing,
reported by nothing, and exits green.

- [x] ~~Lift `REGISTER` out and walk all of `src/`~~ — **done, `7416ab4`**, and
      further than proposed. It reaches through the *call graph* rather than
      stopping at the module boundary, which is the clause that catches
      `restoreFromText`: called by `restoreFromPicker`, called by nothing, in a
      file whose other exports run every session. A per-file check would have
      called it alive. Both hard-won decisions are kept verbatim, and imports
      are stripped too — the original only looked for calls, and `import { f }`
      is not one, but a bare-reference rule needs it or every symbol looks
      alive. The analysis is its own module with ten tests of its own.
      **42 symbols**, each allowlisted with the reason and the item that
      deletes the line; a second test fails when an entry outlives its reason.
- [x] ~~Add `.tsx` to `include` **first**~~ — **done, `c226a09`**, with a guard
      that walks the disk rather than restating the config: every `*.test.ts`
      and `*.test.tsx` present must be matched by some include pattern.
- [x] ~~One parameterised smoke mount~~ — **done, `4047a39` + `03de58b`**. All
      **76** exported components, in jsdom, under `act()`, against a level-3
      Bard built from the shipped SRD rather than a synthetic dataset. Three
      questions each: it mounts, it draws something (or is written down as
      drawing nothing, with the reason), and every control it draws has a name.
      Plus one the proposal did not ask for and that has already earned its
      place: **any React console warning fails the run.**
      The colour clause was dropped deliberately — jsdom computes no layout, so
      "resolves to a non-transparent colour" is unanswerable there, and
      `tabBar.test.ts` already fails on the `background` +
      `backgroundColor: undefined` pattern anywhere in the tree, which is the
      mechanism rather than the instance.
- [x] ~~Coverage is not the tool for this~~ — agreed and not bought. The
      allowlist answers the actual question: not whether a test executed the
      line, but whether the shipped app has a path to it.

Two things this found that the audit had not, both recorded in the allowlist:
`FrameCollector` and `toFrameBytes` are exercised by tests as though they were
the QR receive path, and the app reassembles through `createAccumulator`
instead; the same holds for `parseCharacterFile`/`parseBackupFile` against
`parseTransferFile`. Four modules' tests are testing a road the app never takes.

`fake-indexeddb` arrives here, which P0-8 also needs: the mount runs the real
`init()` against a real database, so the boot path is exercised rather than
stubbed. Until this commit **no test in this repo had ever opened a database.**

### P3-8 · Nothing tells the user whether the app is actually offline-ready
`src/ui/shell/App.tsx:72` · `src/pwa/register.ts:45-46, 87-94` · **trivial, 1 h**

A failed registration becomes `console.warn('[pwa] service worker', error)` and
nothing else. `register.ts:45-46` returns an inert handle silently when the
context is not secure or a Firefox private window refuses. `register.ts:87-94`
catches an install that threw on a chunk 404 against a half-published deploy,
and its own comment reads: *"The previous worker stays in charge, so the app is
still offline-capable — on the old bundle, indefinitely, and nothing else would
ever say so."* A grep across `src/ui/` for serviceWorker / controller /
precache / offline returns only prose in comments.

The README's headline claim is *offline*. This is the only place the app could
tell the truth about it, and it says nothing — so someone walks into a basement
believing an app is installed that is not, and the sheet does not open at all.
The right pattern already exists one screen away: `Settings.tsx:672-674` renders
persistence as GRANTED / NOT GRANTED / UNKNOWN.

- [ ] One line beside the persistence indicator: whether a worker controls this
      page (`navigator.serviceWorker.controller`, a one-liner) and whether the
      precache is filled — `sw.js:158` already has a message handler that could
      answer with its cache counts.

### P3-9 · Three controls on the phone say the wrong thing, or nothing
**~1 h total** · *same class as P3-6*

- [ ] **A vault card that will not recall says why only in a `title`.**
      `Play.tsx:545` is `title={check.reason ?? …}` and `:555` is
      `opacity: check.allowed ? 1 : 0.55`. For a card in the vault,
      `loadout.ts:37-44` makes `allowed` false for exactly one reachable reason
      — *"Loadout is full (5) - move a card to the vault first"* — and
      `Play.tsx:529-531` makes the tap open the card reader instead. A
      touchscreen has no hover, so the player taps a vault card, gets the card's
      rules text, and never learns the loadout was full. A full loadout is the
      normal state past level 4. `91097eb`'s own commit message fixes this exact
      mechanism one file over: *"An unaffordable chip now says NO HOPE instead of
      fading to 45 % opacity, which… read as absent while hiding the one fact the
      player needed."* Two surfaces were left. *(trivial)*
- [ ] **Every USE button in the carried-items list has the same accessible
      name.** `Play.tsx:459-484` — the button's whole content is the literal
      `USE`, no `aria-label`. The sibling row button carrying the item's name is
      `disabled={entry.note === undefined}` (`:443`), so for any item without a
      note the name is not reachable as a focusable label at all. Five carried
      items announce as five buttons called "USE", and the player spends the
      wrong consumable mid-scene. `aria-label={`Use ${entry.name}`}`. *(trivial)*
- [ ] **On a phone the only route to Settings is a button labelled with the name
      of the current theme.** `Header.tsx:186` renders
      `{theme === 'light' ? 'LIGHT' : 'MENU'}` inside a button whose `onClick` is
      `setScreen('settings')`. `Header.tsx:49` hides the desktop nav under 720 px
      and `TabBar` has only play/cards/build/gm, so below that width this is the
      sole door to export, import, backup, persistent storage, print and About.
      The `aria-label` is correct, which is exactly why nothing has caught it: a
      light-theme user scanning the header for their backups reads a theme name
      on a control that looks like a toggle. `theme: 'system'` renders MENU on a
      light OS too, so the label is not even a reliable indicator of the thing it
      appears to indicate. Shipped in `8c83f78`; `rg -l Header tests/` returns
      nothing. *(trivial)*

### P3-11 · The card's only action does not look like one, and shares its word with the cost
`src/ui/player/Cards.tsx:239, 241-242` · **small, 1–2 h** · *reported from a phone*

The footer of every card in the browser carries the one thing you can do with
it — TAKE, RECALL, or IN LOADOUT — and it is drawn as text. It really is a
`<button>` and it really does have `minHeight: 'var(--control)'`, so the target
is there and it works; what is missing is any signal that it is pressable. No
background, no border, `className="t-meta"`, and a colour of `var(--muted)`.

That last part is what finishes it: the readout beside it at `:241` is also
`t-meta`, and its colour is `var(--dim)`. Two small grey capitals at opposite
ends of the same row read as a matched pair of labels, which is exactly what
one of them is. A player scanning 189 cards has no reason to try tapping
either.

The words make it worse. The button says **RECALL** — an action, "bring this
back into the loadout" — and eleven characters to its right the app prints
**RECALL 2**, which is not that action but its price, the Recall Cost from the
card. The same word, twice, in one row, meaning two different things. Nothing
on screen distinguishes them.

- [ ] Give the action the shape of a control: the chip treatment the rest of
      the app uses, or a border. It already has the height; it needs the
      affordance.
- [ ] Separate the two senses of "recall". The cost is a property of the card
      and reads fine as `COST 2`; the action can keep the verb. Whatever is
      chosen, the same row must not use one word for both.
- [ ] The disabled state is `'—'`, which says nothing about why a card cannot
      be taken. `row.reason` already exists and is rendered in the cost slot —
      check whether it can carry that instead.

### P3-12 · A die face grid, once opened, can only be closed by answering it
`src/ui/player/DualityRoll.tsx:148-187` · `src/ui/player/DamageRoll.tsx` ·
**trivial, 30 min** · *noticed while building P1-1's typed damage*

`Die` turns into a twelve-face grid when it is tapped, and the grid has exactly
one way out: pick a number. There is no cancel, no backdrop, and no second tap
on the die that puts it back. A thumb that brushes the HOPE die on a scrolling
screen has to enter a value it did not roll, and then re-open the die and enter
the right one — which in the damage row means two log lines for one attack, the
second one silently replacing a number the first one already announced.

The typed damage slots copy the same idiom deliberately: inventing a cancel for
one of the two and not the other would be two gestures for one gesture's job.
So this is one fix in two places, not a divergence.

- [ ] Give the open grid a way back that is not an answer — a tap on the die's
      own label, or a CLEAR cell in the grid itself. Whatever it is, both the
      Duality faces and the damage slots take it in the same commit.

### P3-10 · The licence notice is on screen only for a user who has no characters
`src/ui/shell/App.tsx:170, 175, 237` · `Architecture.md:163, 629` · **small, 1–2 h**

`<Attribution compact />` lives inside `EmptyState`, and `App.tsx:170` and `:175`
render `EmptyState` only when `needsCharacter` is true. So the DPCGL notice and
the Daggerheart Compatible lockup are on screen only for a user who has *no*
character, and disappear permanently the moment someone creates one — which is
every real user at every real table. The only other in-app copy is
`About.tsx:111`, at the bottom of Settings, behind the button in P3-9. Meanwhile
`Architecture.md:163` says *"Attribuzione richiesta, sempre visibile nel footer e
nel README"* and `:629` repeats it, and there is no `<footer>` anywhere in the
app shell — the only one in `src/` is `print/CharacterSheet.tsx:259`, on paper.

Nothing fails at a table. What it costs is the project: if the licence requires
the notice to be *displayed* rather than merely available, the app is out of
compliance on every install past the first character, and the remedy for that is
a takedown demand, which loses nobody's data but ends updates and the URL. Same
shape as the four defects already found — a spec that promises, code that exists
and looks right, and a rendering path nobody exercises — sitting on the one axis
where being wrong stops the project rather than costing a character.

- [ ] Put the attribution somewhere that survives having a character. A footer on
      Settings and About is the minimum; `Architecture.md` asks for the shell.
- [ ] Delete `About.tsx:18-22` and import the copy at `CompatibleMark.tsx:54-57`.
      They are two independent literals that both normalise to the same 342
      characters today with nothing pinning them together — and `About.tsx` is
      already on the P4 work list, so the next refactor drops the notice with CI
      green. The repo learned this exact lesson for a lower-stakes duplicate:
      *"the two duplicated light palettes are now pinned to each other."*
- [ ] A render test asserting the string reaches the DOM on the screens that must
      carry it. Across 50 test files the only assertion is
      `printSheet.test.ts:236`, which covers the paper sheet.

## P4 — Release hygiene

- [ ] **No version or build id anywhere in the UI.** A user on a stale cached
      build has no way to say which one, and no way for us to ask. Put the app
      version and the SRD revision on the About screen.
- [ ] **README describes features that do not exist**: the automatic export and
      the seven-day integrity check (P0-2). Either wire them or delete the
      claims — shipping a README that overpromises is its own bug.
- [ ] **Node version drift**: CI pins `24`, `package.json` says `>=22`, `env.sh`
      documents a project-local `24.19.0`, and the dev machine now runs `26.7.0`.
      Pick one and say so.
- [ ] **`env.sh` explains that the toolchain exists because Homebrew Node is
      broken.** That was repaired this session; the rationale is now stale.
- [x] ~~Changelog and a release process. Version is still `0.1.0`.~~ — **done,
      `8afc144`**. `CHANGELOG.md` exists and `package.json` is `0.2.0`. The
      release process itself is not written down anywhere and is not claimed to
      be; what this bullet asked for was the file and a version the project
      chose rather than the scaffold's default. **`0.2.0` is deliberate and
      stays.** Nothing this project has shipped is a 1.0, and no document may
      say it is.
- [ ] Sweep the remaining `TODO`/`FIXME`/`HACK` comments and decide which are
      real gaps.

---

- [ ] **Nothing in the pipeline objects to unused code, and the free compiler
      flags find nine hits today.** `tsconfig.json` sets `strict`,
      `noUncheckedIndexedAccess`, `noImplicitOverride` and
      `noFallthroughCasesInSwitch` — and neither `noUnusedLocals` nor
      `noUnusedParameters`. There is no eslint/biome/knip config and no `lint`
      script. Measured at `7815030`, not assumed:
      `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` reported **9
      errors** — `GearPicker.tsx:84`, `Play.tsx:87` (`stats`, accepted by
      `Identity` and never read), `:835 shapes`, `:836 setOpenCard`,
      `:840 klass`, `:844 modLabel`, `:848 modValue` (all leftovers of the phone
      Play rebuild), `Settings.tsx:33`, `tools/simulate.ts:22`.
      **Re-measured at HEAD: five, and none of them is a `Play.tsx` leftover** —
      `GearPicker.tsx:85 a`, `Settings.tsx:39 isStandalone`,
      `tools/simulate.ts:22 CharClass`, plus two in tests
      (`tests/gm/gmStore.test.ts:23 Campaign`,
      `tests/ui/dialogs.test.tsx:40 createElement`). The Play rebuild swept its
      own leftovers on the way past; the flags are still not on, so the next five
      arrive unremarked. **Still open.** Two tsconfig
      lines, and `tsc --noEmit` already runs in CI. Add an unused-*exports* pass
      as well (`knip` or `ts-prune`): it catches `exportBackup`
      (`fileIo.ts:574`), `readFile` (`:763`), `getCharacter` (`db.ts:70`) and
      `outcomeLabel` (`dice.ts:206`), all zero callers, all pure dead weight.
      Note what it would *not* have caught: the `background` +
      `backgroundColor: undefined` collision. That one is already covered by a
      test that fails on the pattern.
- [ ] **The browser floor is stated nowhere, and eight `color-mix()` values sit
      where no build target can reach them.** No `browserslist`, no browser
      section in the README, no version in `Architecture.md` §13, no `@supports`
      anywhere in `src/` or `public/` — zero hits. The single statement of intent
      is `vite.config.ts:20` `build.target: 'es2022'`, which governs JS only.
      Against it, eight `color-mix(in srgb, …)` uses, every one an inline React
      style string that esbuild never sees as CSS — `Beastform.tsx:31`,
      `Play.tsx:216`, `Companion.tsx:554`, `Conditions.tsx:116`,
      `DeathMove.tsx:105` and `:484`, `DomainCardView.tsx:153` and `:375` — so
      setting `cssTarget` would be a false sense of control. Also `base.css:159`
      `height: 100svh`, load-bearing for the no-document-scroll layout. Below the
      floor (Safari before 16.2 — an iPhone 7 capped at iOS 15) the app loses its
      colour coding and keeps its legibility: every site keeps a border and a
      text colour, and domains carry shape-coding independently. The cost is that
      a contributor has nothing to check a change against, and no CI check can
      exist for a floor nobody wrote down.
      **Re-measured at HEAD and still open, at the same numbers**: eight
      `color-mix()` uses in `src/`, `base.css:172` still `height: 100svh`, and
      `browserslist` plus `@supports` together return zero across `src/`,
      `public/`, `package.json` and `index.html`.
- [ ] **A screen crash gives the user one line of text and no way to convey it.**
      `ScreenBoundary.tsx:29-31` — *"No telemetry anywhere in this app; the
      console is the only reporter"* — then `console.error`. The fallback renders
      `error.message` alone (`:60`) in a `<code>` block with no stack and no copy
      affordance. Those two `console.*` calls are the only ones in all of `src/`,
      and on iOS reaching a console needs a Mac and a cable. The two defects that
      shipped for months were found by a person opening the app on their own
      phone; that channel is this project's only working bug-finding mechanism,
      and it gives that person nothing to send back but a retyped sentence.
      `pasteboard.ts:54` already does `navigator.clipboard.writeText`.
- [ ] **Settings hints are never tied to the control they explain.**
      `settings/parts.tsx:94-101` renders `label` and `hint` as bare `<div>`s
      with no `id`; `Switch` (`:117-178`) is a sibling carrying only
      `aria-label={label}`. `rg aria-describedby src/` returns **zero** across
      the tree. The hint is adjacent visible text and reachable by swipe, so this
      costs the fast path rather than all paths — but the prose in question is
      `Settings.tsx:670` (what persistent storage is for), `:761` (*"the
      installed app gets its own storage and will open empty"*) and
      `About.tsx:196` (*"no undo and no copy anywhere else"*).
- [ ] **The precache test derives its expectations for fonts and icons and not
      for brand assets.** `tests/pwa/serviceWorker.test.ts:245-246` compares the
      shell against what Vite actually emitted for `.woff2` and `/icons/`; there
      is no equivalent clause for `/brand/`. That is the mechanism by which
      P3-4's first bullet shipped, and without the clause the identical gap
      returns the next time an asset directory is added. Precision the backlog
      understates: `Header.tsx:141` renders `<CompatibleIcon size={18} />`
      *outside* the `{!phone && …}` guard, so the mark is on every screen at
      every width, and a broken `<img>` still paints its alt text — offline the
      statement survives and the licensed mark does not.
- [ ] **The deployed bundle carries no copy of the MIT notice, and the app never
      states its own code licence.** `dist/` is 28 files and `LICENSE` is not
      among them; `deploy.yml:89` uploads `path: dist` verbatim and its only
      file-shuffling step is `cp dist/index.html dist/404.html` (`:83`).
      `LICENSE:12-13` requires the notice in all copies. No adverse party — it is
      the author's own copyright — but it is one line beside the existing `cp`,
      and one line on About in the same commit as the version string above.
- [ ] **No copy of the DPCGL and no record of which version was accepted.**
      `LICENSE:27-30` cites it by bare URL with no version or retrieval date, and
      `find . -maxdepth 2 -iname "*licen*"` outside `node_modules` returns only
      `./LICENSE`. The contrast is inside the same file: `LICENSE:32-33` says of
      the fonts *"each licence text sits beside the files it covers"*, and it
      does. `About.tsx:139` is the only outbound link in the app and it points at
      `daggerheart.com/buy`; `rg darringtonpress src/ public/ index.html` returns
      nothing, so a user of an offline-first app has no way to read the terms
      under which the content they are looking at was published. Vendor the text
      with a retrieval date and link it beside the About attribution panel.
- [x] ~~**The section numbering has collided.**~~ — **done.** Two headings were
      `### P2-4`; the second, *Screen reader and focus*, is now **P2-6**. The
      stale *Already good* pointer at "the `brand/` fix in P3-3" is corrected to
      P3-4 and struck through, because that gap is now closed.

      **Deliberately not done: the headings are not reordered.** P2 runs 1, 4, 3,
      6, 5 and P3 runs 1, 6, 5, 2, 3, 4, 7, 8, 9, 11, 10, and that is not rot —
      **this file is ordered by priority within a band, not by id.** Sorting it
      by number would put the cheapest item above the one that costs a character
      and would silently rewrite the judgement the order encodes. Ids identify;
      position ranks. Recorded here so the next reader does not "fix" it.

      One thing that made this safe to do at all, measured rather than assumed:
      `grep -rnoE "P[0-9]-[0-9]+"` across `tests/`, `src/`, `shared/` and
      `Architecture.md` shows backlog ids are cited in 25 places — most of them
      in `tests/harness/orphans.test.ts`, where each allowlist entry names the
      item that deletes it — but **`P2-3` and `P2-4` appear in none of them**,
      only in `HANDOFF.md`. Renumbering any *other* id would have broken a test's
      stated reason. Check that grep before touching one.

---

# P5 — The two screens that were redrawn from outside

Everything above this line was found by reading the code. Everything below it
was found by two people using the app and drawing what they wanted instead: a
WhatsApp exchange about the Play screen, and a pencil wireframe plus two
recorded walkthroughs about the GM screen. Both are the same class of finding
as the four defects that shipped for months — the kind no lens pointed at the
source can produce, because the source is not wrong, it is *incomplete against
what a person at a table needs*.

Both were **decided by the owner in the session that opened this section**, so
the choices below are settled and are recorded here as decisions rather than as
options. Where a decision overrules something written above, the older text is
marked.

## ~~P5-1 · The Play screen is not the sheet, and on a phone it is not close~~ — **done, `e2670ba`, `a0a389e`, `5be7384`, `52da38c`, `d80bb51`, `9035b2b`**

**decided: it becomes the sheet** · `src/ui/player/Play.tsx` · `src/ui/player/Vitals.tsx` ·
`src/ui/player/DualityRoll.tsx` · **large, 12–16 h**

The boxes below were never ticked one by one; they were all answered, and the
tree says so. `e2670ba` put the whole sheet on a phone in the paper's order —
Evasion, thresholds, Proficiency, class/subclass/ancestry/community and gold are
on a phone for the first time; `d80bb51` added the vault and made a card that
will not recall say why; `a0a389e` gave it five `Disclosure` folds that each
character remembers; `5be7384` made the counters numbers with a keypad behind
`prefs.counterStyle`, defaulting to numbers, on phone and tablet only; `52da38c`
put the trait verbs on the tiles, read out of the SRD rather than typed in; and
`9035b2b` carried the same stack to every iPad, which is P2-1's tablet half.

**Superseded, and left below as the record of what was measured.** The
`[corrected]` note at the foot of this item says `Play.tsx`'s docblock still
opens *"No scrolling on this screen"*. It does not: it now opens *"The screen
scrolls. It used to say here that it did not"*, and `Architecture.md` §0 and
§9.1 have both been brought into line.

Measured against the phone layout at HEAD, not asserted. `PlayPhone` renders
Beastform, the loadout rows, Equipped, the damage calculator, conditions, items,
the four tracks, the trait chips and the roll block. What it therefore **does
not render at all** is:

| missing on a phone | where it exists | why it matters |
|---|---|---|
| Evasion | `Defenses`, desktop only | the number the GM asks for on every attack against you |
| Damage thresholds | 10 px `--dim` text beside the damage input | the ladder every incoming hit is read against |
| Proficiency | `Defenses`, desktop only | how many damage dice you roll |
| Class, subclass, ancestry, community | `Identity`, desktop only | who the character is |
| The vault | `Vault`, desktop only | half the cards you own |
| Gold | nowhere in Play at any width | it is on the printed sheet and in the type |

`Identity`, `TraitGrid`, `Defenses` and `Vault` are all defined in `Play.tsx`
and all four are called only from `PlayDesktop`. Nothing is broken; four
sections of the character sheet are simply absent from the width the README says
is used ninety percent of the time.

**The outside reading, verbatim:** *"puoi sempre mettere le robe in piccolo,
quindi Hope armour e hp non a token ma a numero. E fare entrare le armi e le
experience. […] metterei le stat in alto, i counter Hope, armour (e threshold
bene in vista) stress e hp, sotto armi e armature e ultime le carte. […] Sempre
con la tendina, clicco e via."*

**That order is not an opinion, it is the official sheet.** Checked against the
Darrington Press character sheet PDF: class banner and identity, then Evasion,
Armor and the six traits with their verbs, then the threshold ladder with HP and
Stress under it, then Hope, then Experiences, then Gold; and in the right column
Active Weapons with Proficiency, then Active Armor, then Inventory. Reflow that
one column and it is the wireframe the message describes. The redesign is
therefore not a new invention to be argued about — it is the app finally showing
what the paper shows.

- [ ] **Rebuild `PlayPhone` in sheet order**, with every section above present.
      The pinned block at the bottom stays: it holds the trait chips and ROLL,
      because those are touched on every single action and a control you have to
      scroll to find is a control that stops being used.

      **[SUPERSEDED by P5-5, `0ccc857` … `b11c423`]** — left standing rather
      than edited, because the reasoning above is the best short statement of
      what had to be true for the reversal to be safe. What changed is the
      premise, not the argument: with the four counters and the thresholds moved
      to the top where Giorgio's message puts them, the Experiences moved into a
      fold below ROLL and the permanent MODIFIERS row deleted, ROLL's own lower
      edge lands above the fold on both reference phones *without* a pin. P5-6
      then took another 150px out of the two bands above it, and the figure is
      now **385 of 730px** of usable column at 393×852 and **385 of 545** at
      375×667 — a margin of 345 and 160 where P5-5 left 195 and ten. The pin was
      buying a reach the order provides and charging 266px for it. The
      arithmetic is an executable assertion — `playSheet.test.tsx`, «the budget
      the pin came off for» — and P5-6 measured it in a real layout engine as
      well: every section draws at exactly the height it declares.
- [ ] **Collapsible sections — the *tendina*.** Weapons & armour, cards,
      inventory, and lineage each behind a disclosure that remembers whether it
      was open. This is what makes "the whole sheet at once" fit: a closed
      section costs one row.
- [ ] **Counters as numbers, with `[−]` and `[+]`** — and the number itself is a
      target that opens a numeric entry, because five taps to go from 2 to 7 is
      the one thing a stepper is worse at than a pip row.
- [ ] **A `counterStyle` preference, defaulting to numbers.** Boxes stay
      available for people who want them. **Scope, decided:** the Play screen on
      phone and tablet only. The desktop cockpit keeps pips — it has the room
      and a precise pointer — and the GM's PartyBoard and the Companion panel
      keep them too, because there you are reading someone else's state rather
      than marking your own.
- [ ] **Thresholds prominent**, not 10 px dim text. They are read under pressure
      by someone who has just been told a number.
- [ ] **Trait verbs on the trait tiles** — Sprint/Leap/Manoeuvre, Lift/Smash/
      Grapple, Control/Hide/Tinker, Perceive/Sense/Navigate, Charm/Perform/
      Deceive, Recall/Analyse/Comprehend. They are on the official sheet under
      every trait, and they are what tells a new player which trait a thing is.
      Source them from the shipped SRD, not from the PDF.
- [ ] **The advantage / disadvantage / reaction row moves behind a disclosure**,
      collapsed by default, showing the net modifier on its closed header. The
      request was to delete it; it is kept because advantage and disadvantage
      are core roll modifiers and an app that cannot roll with them is wrong at
      the table. Collapsing reclaims the band that was actually being asked for.

      **[SUPERSEDED by P5-5 decision 6, `598c07f`]** — the refusal holds and the
      answer does not. Collapsing reclaimed nothing: a 44px header reading
      «▶ MODIFIERS … NONE» is the same band, spent on announcing that nothing is
      happening, which is what the owner's screenshot shows. What shipped
      instead: the row is not drawn at all when nothing is armed, and is reached
      from a 44×66 MODS control at the right end of the roll bar, which costs no
      height because ROLL is already 66 tall. When something *is* armed a 44px
      strip appears above ROLL and names it — `advantage` and `reaction` are
      deliberately not cleared when a roll resolves, so a modifier the player
      cannot see would be the founding rule failing on a number — and tapping
      that strip opens the row it is naming.

**Five items above are folded into this rebuild rather than done before it**,
because they all live in `Play.tsx` and doing them first means building them
twice: **P1-2** (recall with every Stress marked), **P1-6** (the ghost cards and
the cap that counts them), **P3-9(a)** (the vault card whose reason is only in a
`title`), **P3-9(b)** (five buttons all called USE), **P2-1** (the tablet band
cannot roll — it gets the phone stack) and **P2-4** (the scroll budget, which
stops being a fixed-block problem once the page is a document).

**[corrected]** `Play.tsx:1-9`'s docblock still opens *"No scrolling on this
screen. The content is bounded and known"*. It has not been true since
`91097eb`. It is the founding rule failing inside a comment.

### ~~P5-1(b) · Renaming a character exists, is unreachable, and is unguarded~~ — **done, `14c4118`, `077c5e5`, `aa21391`**

**requested directly** · `src/ui/build/Edit.tsx:113` · `src/store/merge.ts:77` ·
**small, 2–3 h** · *lands after the rebuild, in the block the rebuild creates*

Asked for as a missing feature; it is not missing. `Edit.tsx:113-118` is a
`LabelledInput` bound to `character.name` calling `patch({ name })`, and it
works. What is true is that nobody can find it: it sits in the Identity section
of the Build tab's edit screen, below a header, a level-up button and six
derived stats, on a screen a player opens to change their gear. The name is the
first field on the paper sheet and the most-shown string in the app — it is in
the top bar on every screen — and the way to change it is four gestures deep in
the tab visited least.

**And the entrance that exists has no guard, while the entrance that needs one
least has.** `merge.ts:63-75` states the rule and argues for it: *"the character
picker in the header is a `<select>` of names, so two characters called 'Ilya'
would be indistinguishable at exactly the moment the user most needs to tell
them apart."* `duplicateFor` enforces it, counting a suffix up so that doing it
twice does not collide either. That is the **import** path. The **rename** path
— the one where a person types a name deliberately — enforces nothing. Rename
Marek to Ilya and the app produces by hand precisely the state it spends a
paragraph preventing when a file arrives.

One defect wearing two hats: a real capability nobody can reach, and a written
invariant defended at one of its two doors.

- [x] ~~Put rename where the name is.~~ — **done, `077c5e5`.** The Identity
      block, on a 72×44 RENAME chip on the class/subclass row, 51 px clear of
      the header's SETTINGS button (95 px centre to centre, against a ~38–40 px
      fingertip). The name line itself is still a `<div>` with no role, no
      `tabIndex` and no handler, because the failure this bullet describes
      requires the name to be the target. Arming swaps one 44 px row for
      another inside the same wrapper, so nothing above it moves; the block
      grows 25 px against a 457 px scroll window, once, permanently.
- [x] ~~Enforce uniqueness on the rename path *through* `duplicateFor`'s
      logic.~~ — **done, `14c4118`.** The rule left `duplicateFor`'s body and
      became `freeName`/`nameHolder`, over one private `nameKey`. The
      comparison also changed: it was `new Set(taken.map((c) => c.name))`,
      which could not see "ilya", " Ilya", or two characters both stored as
      `''`. Nothing is silently rewritten — the refusal names who holds the
      name and offers the next free one in a control you have to press.
- [x] ~~Renaming *to* empty must not produce two characters both displaying
      `Unnamed`.~~ — **done, `14c4118`, `077c5e5`.** `spokenName` reads `''` as
      `Unnamed`, so the empty case is the same collision as any other and is
      refused with "both would read \"Unnamed\"". Clearing the field on a lone
      character still stores `''` and never the word.

### P5-1(c) · The unique-name rule is now enforced at two doors, and there are five

**found while closing P5-1(b)** · `src/store/state.ts:413`, `:508-541` ·
`src/transfer/fileIo.ts:101-102` · **small, 2–3 h**

P5-1(b) put one comparison behind two callers — the rename control, which Play
and Build both reach, and `duplicateFor`'s *keep-both* copy. That is not the
same thing as an invariant, and `Architecture.md` §7 now says so rather than
claiming one. Three doors are still open, listed separately so that none of
them becomes silence:

- [ ] **Creation has no guard at all.** `Wizard.tsx:583` sets the draft name,
      `creation.ts:362` only warns when it is empty, and `state.ts:413`'s
      `create()` compares nothing. Make a second Ilya from the wizard and both
      rows of the header's `<select>` read "Ilya". The control already exists —
      the wizard's name step could go through `RenameField`, or through
      `nameHolder` for the warning line it already draws.
- [ ] **A plain import compares `id` and nothing else.** `importCharacters`
      (`state.ts:508-541`) runs `decideImport` on the id; for an arriving
      character whose id is new it does `db.putCharacter` with no name
      comparison. So a `.dhchar` for a genuinely *different* character called
      Ilya still lands beside the local Ilya. Only the *conflict* path — same
      id, keep both — is guarded. This is the door `merge.ts`'s own paragraph
      reads as if it covered, and it does not.
- [ ] **`characterFileName` slugifies two distinguishable names to one file.**
      `fileIo.ts:101-102` is `slugify(c.name) || 'character'`, so "Ilya!" and
      "Ilya?" both export as `ilya.dhchar` and the second silently replaces the
      first in a folder. The picker can now tell those two apart; the file
      system still cannot.

## ~~P5-2 · The GM screen is five menus, and a session is not a menu~~ — **done, `eab26d8`, `f6e264d`, `7b27e57`, `68c8cc7`, `63a2558`, `8e0d02f`**

**decided: it becomes one composable session, with multiple campaigns** ·
`src/ui/gm/` · **large, 16–20 h**

Every decision below is taken and shipped. What is still unticked under *Left
open* is not the item: it is the list of things these six commits decided **not**
to do, each with the reason, so that none of them is a silence somebody has to
rediscover from the source.

`Gm.tsx` switches between five regions — encounter, scene, party, bestiary,
countdowns — each of which works. What no region does is *be the night*: a GM
running a session has scene one, then an encounter, then scene two, in an order
they decided beforehand and change on the fly, and this app makes them navigate
a menu to reach each one.

**The outside reading**, from a pencil wireframe and two walkthroughs. Top: the
campaign name and a menu; then Fear as `− N +` (*"alla fine non serve vedere i
token"*) and the **primary countdown**. Body: one ordered list the GM composes —
scene, encounter, link, countdown — each row with a *tendina* that opens it in
place. Bottom bar, replacing the player tab bar: **ADD**, **SHOW**, **SEARCH**,
**SAVE**.

Decisions taken:

- [x] ~~**The session list becomes the GM home; the five regions become its
      content.**~~ — **done.** The five-tab strip is gone: the list is the
      screen, a row opens its tool over it inside `GmSheet`, and a closed tool
      is **unmounted** rather than hidden, because PartyBoard's scanner holds
      the camera in an effect. `board.region` is kept and reinterpreted as *the
      tool last opened*, and is followed only when it **changes**, only when the
      campaign under it did not, and only into a tool that is switched on — an
      effect that acted on the value it finds at mount would reopen the
      encounter builder every time the GM arrives, and one that ignored the
      campaign id would do it on every switch of table, which is the menu
      behaviour this item exists to remove. The top MENU carries the way out,
      the campaigns, and the two tools that are the content of a row and nothing
      else: the encounter builder and the live scene. Bestiary and PartyBoard
      are behind SHOW, where the wireframe puts them, and Fear and the
      countdowns is behind the readout that is always in the top bar — so all
      five are reachable without writing a row, but not all five from MENU, and
      that deviation is recorded under *Left open*.
- [x] ~~**ADD** → countdown, encounter, scene (environment), link.~~ — **done.**
      The four choices are generated from `SESSION_ITEM_KINDS`, so a fifth kind
      added to the record cannot be silently missing from the menu. A countdown
      is pinned from the form itself, through the id `addCountdown` now hands
      back — the row and the countdown share one id and the store mints it, so
      reading `session.at(-1)` would have been the caller holding an opinion
      about how the store appends. An encounter can take the roster that is on
      the board right now and never the combatants, because no store action
      sets a combatant list wholesale. Every row arrives closed and at the end,
      and the sheet says so rather than letting the sheet close over a row the
      GM cannot see.
- [x] ~~**Rows reorder by drag.**~~ *"Sarebbe fighissimo se tu potessi fare oui,
      oui, e te li metti dove vuoi."* — **done**, and with a keyboard path
      beside it rather than behind it. Hold the handle 250 ms with under 8 px of
      travel to lift, then a step per 60 px; `touch-action: none` is on the
      44 px handle alone so the other 88% of the row still scrolls the list.
      `pointercancel` is handled, because iOS fires it with no `pointerup` to
      follow and the alternative is a row lifted for the life of the screen.
      ArrowUp/ArrowDown/Home/End on the focused handle do the same thing, and
      an open row carries MOVE UP and MOVE DOWN as plain buttons — a 250 ms
      hold plus 60 px of accurate travel is not a gesture everybody has. One
      polite live region for the whole list: assertive interrupts itself five
      times across a four-row drag.
- [x] ~~**SHOW** forks in two: **Consulta** and **Gruppo**.~~ — **done.** The
      two tools no row can open, and the only two, which is why they are the
      fork. Each choice says what it is *not*: the bestiary adds nothing to
      tonight, the party board never writes to anyone's character. The chips
      that carried them in the top bar are gone with it.
- [x] ~~**SAVE** writes the campaign: the list, Fear, the countdowns, and the
      party.~~ — **done, and it is not a verb.** The campaign is written 400 ms
      after the last change and again on `pagehide`, so a sheet that implied the
      GM had to press anything would teach them to distrust the thing that is
      actually keeping their table. It flushes, then says *when* the last write
      reached the disk; it shows `writeError` instead of that stamp when there
      is one, with a retry that now does something because `hydrateGm` leaves a
      failed first write dirty; and it offers the `.dhcampaign` copy while
      saying out loud that nothing in this build can read one back in.
- [x] ~~**Multiple campaigns.**~~ — **the record and the store were built
      earlier in this session; MENU is the door.** Switch, make and remove, with
      the removal behind two taps. Switching still never touches the characters
      you play, because a campaign has never owned them — the sheet on two
      boards is two sightings, not one shared record, and the sheet says so.
      The list is drawn in the order the database handed it over and is **not**
      re-sorted live by `updatedAt`: the open campaign is written every 400 ms,
      so that would move exactly one row — always the open one — to the top,
      under a thumb reaching for REMOVE on the row below it.
- [x] ~~**Campaigns move to their own IndexedDB store**, with their own schema
      version and their own converter chain, so `Character` is untouched and
      `SCHEMA_VERSION` is not bumped. The existing GM state migrates out of
      `localStorage` once and the old key is dropped.~~ — **done before the
      screen was built, which is why the screen could be built at all.**
      `DB_VERSION` went to 2 for the new store; `SCHEMA_VERSION` and
      `CAMPAIGN_SCHEMA_VERSION` did not move, because the record's shape did
      not. The migration reads the old key once, writes what it finds, and
      proves the campaign before dropping it. It was the load-bearing change:
      `gmStore.ts` used to write the whole of the GM's state to `localStorage`
      synchronously on every mutation — every `+1` of Fear, whole character
      sheets belonging to other people — in the least durable store the platform
      has, and the first thing iOS clears. This entry was left unticked while it
      was true; it is ticked here with the rest of the item's bookkeeping.
- [x] ~~**The bottom bar swaps to the GM tools inside the GM section**, and the
      way back to Play, Cards and Build moves into the top MENU.~~ — **done,
      both halves in one commit**, because a tab bar removed before MENU existed
      would strand a phone in the GM section with the header's SETTINGS button
      as its only way anywhere. MENU is the whole top row rather than a word
      beside the campaign name — the `Disclosure` lesson — and it does not carry
      Settings, because the header does on every screen. The licence notice
      moved *into* the session list's scroll rather than off the screen: it is
      a licence obligation and a layout budget is not a reason to drop one.
- [x] ~~**Each tool is switchable in Settings**, plus one master switch that
      hides the GM section entirely — most people using this app are players. A
      tool that is off leaves the bar, and the bar redistributes across what is
      left rather than leaving a hole.~~ — **done as three switches rather than
      six, and the reduction is written down below.** The master switch takes
      the GM tab off the phone's bar, the entry off the desktop header, and the
      screen out of the app: `openingScreen` refuses to *open* on a stored
      `'gm'` with the section off, and `allowedScreen` refuses to *draw* one, so
      neither a boot nor a stray `setScreen` can leave a header over an empty
      `<main>`. The two tool switches are the bestiary and the party board; with
      both off SHOW leaves the bar and ADD and SAVE go from 131 px each to 196
      on a 393 px phone. Nothing anywhere still offers a tool that is off — the
      SHOW sheet narrows to one choice and is renamed for it, and the scene
      runner's empty state drops both its bestiary button and the clause naming
      it.

**Deferred to 1.1, written down so they are not lost:**

- **Photos attached to a scene and shown to the table** (*"se posso aggiungere
  delle foto e mostrarle a loro"*). It needs a quota story before it needs a
  screen: P0-3 exists because quota failures were being swallowed, and a photo
  is the first thing in this app that could fill a device on its own.
- **Link rows that open external URLs.** It would put a second outbound link in
  an app whose strongest claim is that it has exactly one. The LINK row ships
  now resolving only to something already inside the app — an adversary, an
  environment, a card, a rule — so it works with the radio off and changes no
  promise.
- **Full-text rule search, behind SEARCH.** This is the one the wireframe draws
  and 1.0 does not have: the bar ships three verbs where the drawing has four.
  It is a 1.1 entry rather than a gap because what a GM actually searches for at
  the table is already the Bestiary's filter behind SHOW — name, description,
  motives, feature names — and a second, weaker SEARCH beside it would make the
  bar claim a capability the app has in one place and not the other. When there
  is an index behind it, it goes in as a fourth entry in `GmBar`'s `VERBS`
  array and the grid redistributes to four on its own; nothing else has to
  move.

**Left open by the commits that built this screen, so none of it is a
silence:**

- [x] ~~**Nothing in this build writes a new scene, encounter or link row.**~~ —
      **closed by the ADD sheet.** The three factories are in `session.ts` now
      because there is a caller.
- [ ] **`Countdown.notes` is persisted, read by `readCountdown`, and rendered
      nowhere.** The open countdown row is now the obvious place for it, which
      makes the absence louder than it was. It needs a keyboard inside a
      scrolling list and a history, and a row that starts showing the field must
      not imply it was ever editable before.
- [ ] **A session encounter row can put its plan back on the board, but not its
      fight.** `combatants` on the row are stated as a fact with no control,
      because no action in `gmStore` sets the combatant list wholesale. Adding
      one is a store change, not a screen change.
- [x] ~~**BESTIARY and PARTY are chips in the top bar.**~~ — **gone with SHOW,**
      which is where the wireframe put them.
- [x] ~~**`hydrateGm` still swallows a failed first `putCampaign`.**~~ —
      **fixed in the store, not in the sentence.** It sets `writeError` and
      leaves the write dirty, so SAVE's retry, the next change and `pagehide`
      all try it again. Nothing is dirty at that moment otherwise, so
      `writeActive` returned at `if (!dirty)` and no later write would ever have
      reported it.
- [ ] **Not all five regions are reachable from the top MENU, where the first
      decision above said they stay.** Two of them are: the encounter builder
      and the live scene, which are the content of a session row and had no
      other door — improvising a fight meant writing a plan row first, which is
      the menu behaviour this item exists to remove wearing different clothes.
      The other three are not repeated there, and the rule keeping them out is
      the one that keeps Settings out of the same sheet: a second route to a
      destination that already has one is a door nobody chose to build. Fear and
      the countdowns is behind the Fear readout, drawn at every width; the
      bestiary and the party board are behind SHOW, which is where *"SHOW forks
      in two"* put them. What that decision was protecting — a tool you cannot
      reach without writing a row — is closed; its literal reading is not, and
      the sentence in MENU says where the other three are, so the absence is an
      answer rather than a gap.
- [ ] **SEARCH is not in the bar, and that is a decision.** The wireframe draws
      four verbs; this build ships three. Full-text rule search is deferred to
      1.1, and the searching a GM does at the table is already the Bestiary's
      filter behind SHOW — name, description, motives, feature names. A second,
      weaker SEARCH beside it would make the bar claim a capability the app has
      in one place and not in the other. It goes in as a fourth entry in
      `GmBar`'s array when there is an index behind it.
- [x] ~~**The bar cannot yet be made to redistribute.**~~ — **it can now, and
      the test proves the property rather than the instance.** Switching the
      bestiary and the party board both off drops SHOW and leaves
      `repeat(2, 1fr)`; a grid hard-coded at three fails that case.
- [ ] **Three tools of five are not switchable, where the item asked for
      "each".** The encounter builder and the scene runner are the *content of a
      session row*, and a switch that hid either would make a row the GM has
      already written unopenable — a preference that breaks the list is not the
      preference that was asked for. Fear and the countdowns is the one that
      does not fit that defence: it is reached from the Fear readout rather than
      from a row. It is left on because Fear is not optional at a Daggerheart
      table — the pool is spent from every corner of the app, and the board
      behind that readout is the only place it can be set outright rather than
      one point at a time. A switch there would leave the GM a number they can
      spend and nowhere to set it. If it is ever wanted, it hides the board and
      not the pool, and the readout goes back to being the span it was.
- [ ] **The shell substitutes the GM screen rather than correcting the store.**
      `allowedScreen` makes `App` *draw* Play while `useApp.getState().screen` is
      still `'gm'`, which is the state a `setScreen('gm')` with the section off
      leaves behind. Nothing user-facing can produce it — no tab, no header
      entry, and `init` folds the stored value on the way in — and the two
      alternatives are both worse than the divergence: correcting the store from
      a render is a write during render, and correcting it in an effect makes
      the first paint the very blank screen the substitution exists to prevent.
      If a third caller of `setScreen` ever appears, it should go through
      `allowedScreen` rather than have this widened.
- [ ] **A campaign that failed to write is only said on the GM screen.** The
      strip under the top bar is `Gm.tsx`'s, so a GM who leaves for Play or
      Cards with a failed write behind them is told nothing — `App.tsx`'s own
      unsaved-work banner is about the *character* store and has never known
      about campaigns. The two stores would have to agree on what a failure is
      before one banner could carry both, and inventing a second, quieter
      shell-level alert for the GM store is how two banners end up disagreeing
      about the same disk. Until then the honest reading is: the sentence is on
      the screen the work is on.
- [x] ~~**`GmBar` does not pay `env(safe-area-inset-bottom)`.**~~ — **it does
      now,** and it is the only thing on the screen that does, because the tab
      bar has gone and the notice is inside the scroll. No test reads it from
      the DOM: jsdom drops `env(...)`, so an assertion on `style.paddingBottom`
      could never fail. `gmShell.test` reads the source and says why there.
- [ ] **A scene added from ADD records an environment and does not put it on the
      board.** That is the same split the open scene row already draws — the row
      is the plan, `GmBoard` is the table — and the row carries the two verbs
      that cross it. Worth revisiting only if a GM reports expecting otherwise.
- [ ] **`renameCampaign` on a campaign that is not the open one never reaches
      the disk.** `patchCampaign` schedules a write only when the id is the
      active one and `writeActive` gathers only the active record, so the rename
      would sit in the window looking right and be gone on the next reload. MENU
      therefore offers the control on the open campaign alone, with the reason
      beside it. Fixing it is a store change — gather and write the one record
      that was patched — and nothing covers it today.
- [ ] **`createCampaign` sets the new campaign active even when `putCampaign`
      rejected,** and `removeCampaign` has no stale-build guard where
      `putCampaign` has one. MENU's NEW CAMPAIGN and its armed REMOVE both sit
      on top of that. The first is *said*, said where it happens, and now
      **retried**: `createCampaign` sets `writeError`, leaves the store dirty so
      the next flush writes the campaign that did not land, and the GM screen
      draws the sentence under the top bar with no sheet open. What is still
      open is that the campaign is made active either way. The second is a store
      asymmetry this work does not touch.
- [ ] **`readCampaigns().repaired` is computed, tested and consumed by nobody,**
      so a repaired campaign is repaired again on every launch. The notices it
      produces are in MENU rather than in a banner precisely because they recur.
      One is the exception and is on the screen as well: the one saying the disk
      replaced something the GM had already changed. That one is about a tap
      rather than about a record, it happens once, and it carries its own flag
      (`replacedOnLoad`) so the recurring ones are not dragged onto the screen
      beside it.
- [ ] **The campaign list is not re-sorted while it is open.** `readCampaigns`
      sorts newest-played first once, on the way in; MENU keeps that order for
      the life of the sheet. Live sorting would move the open campaign to the
      top every 400 ms, under the thumb. If a GM ever wants the order refreshed
      it should be a control, not a side effect of the debounce.

## ~~P5-3 · What the GM screen could have at hand, and does not~~ — **done, `65de51a`, `119816f`, `1f9afcc`, `7f19d78`, `81c1df2`, `246f84b`, `32af6b2`, `ce14170`, `33cffaa`**

**source: the official GM screen** · `src/ui/gm/Reference.tsx`,
`src/ui/gm/ReferenceTables.tsx`, `src/ui/shared/srdReference.ts` ·
**medium, 4–6 h**

Read off the portrait GM screen and checked against what the app already does.
**None of this text may be copied into the repo** — `Manuali/` is gitignored
precisely because source material stays on the machine that owns it, and the
licensed wording belongs to Darrington Press. What ships is the *structure*,
with the words sourced from `data/srd-1.0.json`, which is already carried under
the DPCGL. Anything the shipped SRD does not contain does not ship.

That last sentence did the deciding. Every string on the reference is read out
of the dataset at render time and stamped with the section's own page; the only
number the app adds is the foot-to-metre conversion, which says on the same line
that it is the app's. **Three of the bullets below asked for something the
shipped SRD does not carry, and they are corrected before they are struck** — a
record that preserves the error is a record the next builder copies.

The whole reference opens from MENU → OPEN THE REFERENCE, as seven topics.

- [x] ~~**The improvised-adversary table by tier**~~ — **done, `119816f`.**
      Attack modifier, damage dice, difficulty, damage thresholds, read out of
      `rules['adversary-stat-block-benchmarks']` (p.73) with the environment
      table from p.102 beside it, and the campaign's own tier drawn first and
      marked. `engine/encounter.ts::TIER_BENCHMARKS` was the same table typed
      by hand and was **deleted** rather than wired (`1f9afcc`): it had already
      dropped the `+` from `+1` and split `Major 7/Severe 12`, so a screen built
      on it would have carried an `SRD 1.0 · P.73` stamp over text that is not
      the dataset's.
- [x] ~~**Difficulty as a labelled ladder** (5 · 10 · 15 · 20 · 25 · 30, Very
      Easy to Very Hard) wherever a difficulty is set~~ — **corrected, then
      done, `32af6b2`.** The five adjectives are on the printed GM screen and
      occur **zero times** in `data/srd-1.0.json`, so shipping them would mean
      typing Darrington Press's wording into this repository. The SRD gives
      something better and the app now prints it: for each of the eighteen trait
      verbs, a concrete worked example at every one of the six numbers — "walk
      slowly across a narrow beam" rather than "Medium".
      `tests/ui/srdReference.test.ts` pins that neither adjective is in the
      dataset and sweeps `src/` for both.
- [x] ~~**Fear per scene type** — incidental 1–2~~ — **corrected, then done,
      `7f19d78`.** The dataset says **0–1 Fear** for an incidental scene, not
      1–2; the rest (1–3, 2–4, 4–8, 6–12) was right. A builder copying this
      bullet would have shipped the wrong number under an SRD stamp. The whole
      of `rules['using-fear']` (p.65) is drawn, and a shut fold under the Fear
      board's twelve targets carries it beside the control it is about.
- [x] ~~**Dynamic countdown advancement**~~ — **done, `81c1df2`.** The five-row
      chart from `rules['countdowns']` (p.69), read-only on the reference and
      pressable on a dynamic countdown's own row: six of the ten advancement
      cells carry a number and become buttons, and the four reading *No
      advancement* are printed and are not. The app never decides that a trigger
      fired — the GM presses the outcome that happened.
- [x] ~~**Range and distance in squares, feet *and metres*.**~~ — **corrected,
      then done, `246f84b`.** The SRD carries feet and the optional 1-inch-grid
      squares and **no metric column at all**, so the metres are not text to
      quote — they are arithmetic the app does. Feet × 0.3048, rounded to the
      nearest half metre below ten and the nearest whole metre above, drawn in
      `--dim` with COMPUTED BY THIS APP in the same element as the figure, under
      a legend stating the multiplication and the rounding. The two ranges the
      SRD gives no number for get no figure here.
- [x] ~~**the Experience examples** — the improvising GM's other half~~ —
      **done, `ce14170`, `33cffaa`.** Both halves. The GM's eighteen from
      `rules['using-adversaries']` (p.71) are a reference topic; the player's
      seventy-nine from `rules['character-creation']` (p.4) replace the five
      that were **typed by hand into `Wizard.tsx`** beside a paraphrase of the
      SRD's caution. That paraphrase was the defect: it kept one of the rule's
      four worked examples.
- [ ] ~~**The name and place generators**~~ — **does not ship, and no commit
      will make it.** The shipped SRD contains no generator of any kind — no
      name list, no place list, no table to roll on. Building one would mean
      transcribing it out of `Manuali/`, which is the one thing this item's own
      preamble forbids. Recorded here rather than left as an absence: an
      omission written down is a decision, an omission unrecorded is a silence
      somebody has to rediscover. If the owner wants generators, they are a new
      item with their own source, and that source cannot be the licensed books.
- [x] ~~**GM moves, principles and best practices** as reference the MENU can
      reach~~ — **done, `ce14170`.** Five sections, five shut folds, each with
      its own page stamp: `gm-principles` and `gm-practices` (63),
      `making-gm-moves` (64), `gm-moves-and-adversary-actions` (37) and
      `pitfalls-to-avoid` (64). All of it is in the shipped SRD; nothing was
      added to it.

**Left open, deliberately, with the reason.**

- [ ] **The difficulty ladder is not attached to `DualityRoll.tsx`'s DIFF box.**
      That input is the only control in the app where a human sets a Difficulty,
      and it is on the *player's* screen. The SRD's own lead paragraph — printed
      above the ladder — says the GM sets it, and a table of numbers to pick
      from under the player's input invites the player to choose their own,
      which is the app implying an authority it does not have. The six places
      that *display* a Difficulty without setting one (`StatBlock.tsx`,
      `Bestiary.tsx`, `AdversaryList.tsx`, `Scene.tsx`) are already showing the
      SRD's answer for the case it covers. This narrows the bullet's original
      "wherever a difficulty is set", so it is left ticked open for the owner
      rather than struck.
- [ ] **The reference is not one of the switchable GM tools.** The bestiary and
      the party board are switchable because they are the two forks of SHOW and
      a GM may genuinely have no use for either. This is the SRD the app already
      ships and already quotes on the player's screens, reached from a menu that
      has no switches in it at all. `prefs.gmSection` still takes the whole
      section away.

**Then a verifier read the diff back and found five sentences the code could not
honour**, all of them in the half of P5-3 that is drawn twice. They are fixed in
`fd799f3`, `4701e9f`, `dbfda63`, `caebbc8` and `2d19292`, and they are worth
keeping because four of the five are one shape — *a component behind two doors
describing the door it did not come through*:

- the empty advancement chart said *"Move the countdown by hand with the − and +
  above"* on the reference screen, which is mounted `countdown={null}` and has no
  −/+ on it anywhere;
- the empty Fear guidance said *"The pool above still works"* on the reference
  screen, which has no pool. The component now takes `besidePool`, the same shape
  as `countdown`;
- `TierBenchmarks` closed with *"The marked column is the tier this campaign is
  set to"* unconditionally, with nothing checking that a column had been marked —
  and a rules layer whose headers carry no number marks none;
- the metric legend promised *"Where they give one in feet, this app multiplies
  it by 0.3048"* over a `rangeEntry` that only ever matched a **span** inside a
  labelled bullet, so the very first paragraph under the legend — the SRD's own
  *"about 5 feet of fictional space"* — printed with no metres. The legend is now
  scoped to the range lines and says outright that prose is left as written, and
  `rangeEntry` reads a lone figure as well as a span so the narrower promise
  holds for every line. Prose is **not** annotated, deliberately: doing it means
  either rewriting a quoted sentence or hanging an app-authored line off a
  paragraph where nothing says which figure it converted;
- and three comments the code had already disproved — "three principles out of
  eight" over a seven-subhead section, "the strip is not drawn while there is
  only one topic" over a guard that cannot fire on a seven-element const, and a
  chip row computed at 284px that is 302.

## ~~P5-4 · The printed sheet against the official one~~ — **done, `8680f1b`**

**source: the official character sheet** · `src/ui/print/` · **medium, 4–6 h**

The three boxes below were done in one commit, and its message is the report the
first of them asked for: eight fields missing, two misfiled, the sections
reordered to the paper's own order, and every string on the page sourced from
`data/srd-1.0.json` — no artwork, frame, banner, colour or lettering reproduced,
which is the second box. HP and Stress now draw twelve boxes always, solid to the
maximum the character has earned and broken beyond it; Hope draws six with the
scarred ones struck through and **no** dashes, because its ceiling can only fall
and a broken diamond would offer room the rules never give back.

Four things the item asked for and the commit deliberately did not do, each with
its reason in the commit message: no Proficiency pip row (the app derives it and
has already multiplied it into the printed damage), no two-column page (grouping
is the information architecture, the column count is layout), Inventory Weapons
as three blank ruled lines rather than data (`Character` has two weapon slots and
`inventory` holds loot and consumables, so there is nothing to print and the
sheet must not imply there is), and `MAX_CHESTS` left at 1.

The comparison the owner asked for, and it is favourable: `Gold` is already
`{ handfuls, bags, chests }`, exactly the paper model, and the level-up tier
boxes in `LevelUp.tsx` already mirror the guide page — including the black box
that `33a7d92` and `0fb3365` just made behave.

- [ ] Compare `src/ui/print/CharacterSheet.tsx` field by field against the
      official sheet and list what is missing, what is named differently, and
      what the app has that the paper does not. Report before changing.
- [ ] Match the **information architecture**, not the artwork. The field set and
      its order are functional and mostly SRD; the layout, the frames and the
      class banners are Darrington Press's design. Reproducing the look is a
      licensing question this project cannot afford to get wrong — P3-10 exists
      because the attribution is already thinner than the licence asks for.
- [ ] Specifics visible on the paper and worth checking for: *"Start at 10"*
      under Evasion, *"Add your current level to your damage thresholds"*,
      the `Mark 1 HP / 2 HP / 3 HP` labels on the ladder, HP and Stress drawn as
      filled boxes up to the current maximum and dashed to twelve, six Hope
      diamonds, five Experience lines, the class feature printed in full, and
      inventory weapons carrying primary/secondary checkboxes.

## ~~P5-5 · The whole sheet in one look — the reflow~~ — **done, `0ccc857`, `2d7b1d2`, `65da3eb`, `d049ac0`, `a1ff3c3`, `0fb61d0`, `598c07f`, `b11c423`; verified and corrected in `2802d37`, `959db01`, `d72f8bf`, `bd7bc66`**

**Decisions taken by the owner on 2026-08-17**, two of them overruling P5-1
above, which is why those two bullets are marked SUPERSEDED there rather than
edited away. Giorgio's message in full: *"rendendo quindi la pagina principale
un sistema per vedere in una volta sola tutta la scheda"* — with every fold
shut, a player looks once and sees the whole sheet.

**What was built.** The phone sheet is one scrolling column with nothing pinned
(`0ccc857`), in Giorgio's order: identity, the four defence numbers, the four
counters with the incoming-damage box, the six traits as one 44px row of chips
with the SRD verbs behind its own 44×44 control, ROLL — and then the folds, all
of them shut by default: **weapons & armour, Experiences, Carried, Cards, Rest &
downtime, Lineage & domains**. `Vitals.part` is gone and the counters lost their
`.panel` box. The armed Experiences moved out of `DualityRoll` into `Play`
(`d049ac0`) so the fold below ROLL could hold them (`b11c423`); the vault is a
tendina inside Cards and the gold rides on the Carried header (`a1ff3c3`); the
lineage fold opens with the domains (`0fb61d0`); the permanent MODIFIERS row is
gone in favour of a 44×66 MODS control on the roll bar and a strip that exists
only while something is armed (`598c07f`).

**THE ARITHMETIC, AS BUILT** — declared heights, every fold shut, default prefs,
nothing armed, the `playedCharacter` fixture. Column = glass − 53 header − 61 tab
bar − 8 foot.

| | px | after P5-6 |
|---|---|---|
| Identity (21 name + 7 + 10 meta + 9 + 44 RENAME) | 91 | 91 |
| gap | 8 | 8 |
| the defence band (16 padding + 10 label + 4 + 26 number + 2 border) | 58 | 58 |
| gap | 8 | 8 |
| the four counters and the TOOK row (4×44 + 3×6 + 44 + 6) | 244 | **94** |
| gap | 8 | 8 |
| the trait row | 44 | 44 |
| gap | 8 | 8 |
| the ROLL row (MODS is 44 wide *inside* it) | 66 | 66 |
| **ROLL's lower edge** | **535** | **385** |
| the six fold headers and the conditions strip, with their gaps | 364 | 364 |
| **the whole folded sheet** | **899** | **749** |

The right-hand column is P5-6 below, which took 150px out of the counters: the
four rows became a 2×2 grid and the damage box moved into the defence band,
which did not have to grow for it. The three bullets under this table are the
numbers **as P5-5 left them**, kept because the reversal was argued from them;
P5-6 restates them.

- **393×852** — column 730. ROLL is above the fold with **195px to spare**. The
  whole folded sheet is **169px over**: the conditions strip and the last three
  fold headers are below the glass.
- **375×667** — column 545. ROLL is above the fold **by ten pixels**. The whole
  folded sheet is **354px over**.
- **744×1133** — column 1072, because `App.tsx` draws the tab bar only below
  720px. The whole folded sheet **fits, with 173px to spare**. "Tutta la scheda
  in una volta sola" is literally true on a tablet and nowhere else.

Every one of those numbers is an executable assertion in `playSheet.test.tsx`,
describe «the budget the pin came off for», whose own docblock says what it can
and cannot prove: jsdom has no layout engine, so it sums *declared* heights and
never measures. It also lists six things it cannot see, four of which cost more
than the ten pixels of margin at 375×667 — typed dice (+68), pips instead of
numbers (+49), a companion (+50), a Beastform banner (+52) — plus the
`env(safe-area-inset-bottom)` question, which this repo has always treated as 0
and which is 34px on a home-indicator iPhone installed as a PWA.

**What the verifier pass found, and fixed.** Three defects a green suite had not
seen, all of them a sentence in the source that the code did not do.

- ~~**The ROLL bar named the armed Experiences only while `result === null`.**~~
  — **fixed, `2802d37`.** Once a roll had resolved, an Experience armed for the
  next one was named nowhere on the roll surface: reproduce by rolling, opening
  the Experiences fold, arming one and shutting it. The next roll was silently
  +2 and a Hope, and the only statement left was the shut header's `2 · 1
  ARMED`, which at 375×667 is below the fold. The ARMED strip does not cover
  this and must not — it is a door into the modifier row, and on a phone the
  Experiences are deliberately not in that row, so naming them on a control
  that opens it would be an offer the tap cannot keep. **This is worse than an
  ordinary miss because `PlayPhone` argues the fold on exactly that sentence**
  — "whatever is armed is spelled out in full on the ROLL bar itself, so a
  declaration is never behind a tap even when the fold is" — so either it was
  true or the fold was not safe to make. What is armed after a roll now reads
  `NEXT: …` on the bar's second line, because a +2 printed beside a standing
  total is a total that counted it. The desktop verdict strip had the
  unlabelled half of the same problem; both layouts read one expression now.
  The line costs the budget above **nothing** — it exists in every state — and
  `bd7bc66` records the wrap arithmetic beside it.
- ~~**Both roll surfaces announced a Hope a reaction roll does not give.**~~ —
  **fixed, `d72f8bf`.** They indexed `OUTCOME_DETAIL` directly, and that table
  has no reaction case: "You gain a Hope" for every `success-hope` and "Gain a
  Hope and clear a Stress" for every critical. `rollDuality` returns three
  zeroes in `effects` for a reaction roll and no counter moves, so the one line
  whose job is to say what the roll cost or granted was announcing a payment
  the app then did not make. `engine/dice.ts::outcomeDetail` is the honest
  reader, has said so in its own docblock since P4, and was in the orphan list
  with nothing calling it; adopting it took its line off that list.
- ~~**Eight comments argued from surfaces this reflow deleted.**~~ — **fixed,
  `959db01`.** `DualityRoll`'s `[characterId]` effect kept advantage, the
  reaction switch and the Difficulty across a character swap because "they are
  printed on the closed modifier row whether they are armed or not" — the row
  decision 6 deleted. `Reference.tsx` argued the GM topic strip is not pinned by
  contrast with "Play's roll block, which is pinned". `DamageRoll`'s
  confirm-before-re-roll rested on being hard against the bottom edge of the
  pinned block. Every behaviour is still right; the warrants now cite things
  that exist, and the reversals are named rather than quietly swapped.

**Not done, and named rather than hidden:**

- ~~**The conditions strip is still permanent**~~ — **behind its own fold,
      `fcda966`, and it saved nothing.** See P5-6 below: a shut `Disclosure` is
      44px plus this column's 8px gap, which is what the strip was. The fold is
      still the better row — the shut header names what is on rather than
      showing one filled chip among seven empty ones — but the **−52 this was
      costed at is not available from a fold**, and the shape that would buy it
      is still the one written here: draw nothing when nothing is on, with the
      door somewhere that costs the column nothing. That door is still unplaced.
      MODS is the wrong one for the reason given above, and the candidate P5-6
      measured and did **not** take, because it is a decision and not an
      implementation, is a 44×44 control at the end of the identity's class row
      beside RENAME — a row that is already 44px tall, so it would cost zero.
- ~~**The incoming-damage box is not in the defence band**~~ — **done,
      `899fbeb`, and worth 50 rather than 46.** `IncomingDamage` came out of
      `Vitals`; the phone draws it as a fifth cell of the band and the desktop
      row is unchanged. It rides for free: a 44px field sits inside a row the
      number cells already hold open at 58, so the band does not grow and the
      counters lose the whole 44 + 6. The `8/16` restatement is deleted. The
      cost is the equal columns — `EVASION` at `.t-meta` is 47.75px, so four
      equal cells plus the box overflow even a 393px phone (386.29 against 369)
      — and while a number is standing in the box the verdict spans the band
      underneath, taking it from 58 to 108.

- [ ] **The death-move offer can now be off screen when it appears, and that is
      a regression `0ccc857` introduced.** It used to be in the pinned block, so
      it could not be. It leads the column now, which is the right *place* - when
      you have fallen it is the only thing that matters - but position is not
      visibility on a screen that scrolls. Marking HP by hand or committing
      damage is fine: both controls are within 400px of the top. The path that
      strands it is P1-2's, `RecallButton` in the vault, which is now a tendina
      inside Cards and further down still: the confirming tap can mark the last
      Hit Point from about 600px down the column, and the banner then renders
      above the viewport with nothing on screen saying it appeared. Two honest
      answers - make the offer a dialog the way its own `DeathMoveDialog`
      already is, or have the recall that spends the last Hit Point say so on
      its own row - and neither of the P5-5 commits picks one.

## ~~P5-6 · The three savings, and what they were actually worth~~ — **done, `379a20a`, `899fbeb`, `fcda966`; a defect found by rendering it, `4608328`**

P5-5 shipped the reflow and failed its own stated condition: the folded sheet
was 899px against 730 of column at 393×852. The owner chose to close it and
named three savings, costed at ~198px between them. **They are worth 150**, and
this section says which one was not worth what it was costed at and why.

| | costed | actual | why |
|---|---|---|---|
| the four counters as a 2×2 grid | −100 | **−100** | 4×44 + 3×6 = 194 → 2×44 + 6 = 94 |
| the damage box into the defence band | −46 | **−50** | the band did not have to grow: a 44px field fits inside a row the number cells already hold open at 58 |
| the conditions strip behind a fold | −52 | **0** | a shut `Disclosure` is 44px + the column's 8px gap, which is exactly what the strip was |
| | **−198** | **−150** | |

**THE ARITHMETIC AS BUILT**, declared heights, every fold shut, default prefs,
nothing armed, the `playedCharacter` fixture. Column = glass − 53 header − 61
tab bar − 8 foot.

| | px |
|---|---|
| Identity | 91 |
| gap | 8 |
| the defence band, **with the TOOK cell inside it** | 58 |
| gap | 8 |
| the four counters, a 2×2 grid (2×44 + 6) | 94 |
| gap | 8 |
| the trait row | 44 |
| gap | 8 |
| the ROLL row | 66 |
| **ROLL's lower edge** | **385** |
| seven fold headers, with their gaps (7×44 + 7×8) | 364 |
| **the whole folded sheet** | **749** |

- **393×852** — column 730. ROLL clears the fold with **345px to spare**, where
  P5-5 left 195. The whole folded sheet is **19px over**: the bottom edge of the
  lineage header. The target was a fit and this is a miss, stated rather than
  bought — the 19 is exactly the 52 the conditions fold did not save, less the
  33 the other two overshot by.
- **375×667** — column 545. ROLL clears the fold **by 160px**, where P5-5 left
  ten and had to defend it. The whole sheet is 204px over, which the owner
  accepted in advance. Of the states the budget cannot see, none now costs the
  small phone its margin except pips (+149).
- **744×1133** — column 1072. The whole folded sheet **fits with 323px to
  spare**.

**MEASURED, NOT ONLY SUMMED.** Every number above is an assertion in
`playSheet.test.tsx` over *declared* heights, because jsdom has no layout
engine. This pass also rendered it: Chrome, `preview.html`, all three widths,
the same fixture. Every section drew at exactly the height it declares, ROLL's
lower edge landed at **385** and the sheet at **749**. Two things that only a
layout engine could answer were settled the same way, before the code was
written and again after:

- **The counter cell.** The widest readout a counter ever draws is `12 / 12` at
  800 20px Archivo plus `.t-meta`: **59.5px**. The narrowest cell the grid hands
  it is 172.5 at 375, less two 44px steppers and two 4px gutters, less 10px of
  padding and 2 of border: **64.5px of room**. Five pixels, `nowrap` and
  clipped, because a wrap is a third line and a third line is the 100px back.
- **The defence band.** `EVASION` at `.t-meta` is 47.75px, so four equal cells
  plus a 91.29px `TOOK [ ]` plus four 6px gaps is 386.29 against 369px of column
  at 393 — over at the *wider* phone. Sized to their contents the four numbers
  come to 230.08 and the box takes the remainder: 114.92 at 393 and 96.92 at
  375. No overflow at either.

**A DEFECT THE SUITE COULD NOT SEE, FOUND BY RENDERING IT** (`4608328`). The
phone column is a scrolling flex column, and a flex child keeps `flex-shrink: 1`
unless it says otherwise — so the browser takes the sheet's overflow out of
whatever can shrink *before* it scrolls anything. Every section declared
`flex: none` except `DualityRoll`'s phone surface, which had never said it. At
393×852 it was drawn **33px tall holding a 66px ROLL**, overflowing onto the
Weapons & armour header below it — two 44px targets on the same band — and the
column's `scrollHeight` equalled its `clientHeight`, so the sheet did not scroll
at all. It has been that way since P5-5 unpinned the block. Nothing could catch
it: every height this repo asserts is a declared height, and ROLL's declared
height was 66 the whole time it was being drawn at 33. The test that replaces
that blindness is a sweep — no child of the phone column may be shrinkable —
because that property is the premise the whole budget rests on.

**Not done, and named rather than hidden:**

- [ ] **The last 19px, and the door that would buy them.** The conditions fold
      is a better row than the strip and a free one; it is not a cheaper one.
      The only shape that removes the 52 is decision 6's — draw nothing when
      nothing is on — and that needs a permanent door somewhere that costs the
      column no height. Two candidates, neither taken here because both are
      placements and this pass was asked for a fold: a 44×44 control at the end
      of the identity's class row, beside RENAME, in a row that is already 44px
      tall and has the width spare at both reference widths; or the same
      treatment MODS got, which the owner has already objected to on the grounds
      that a condition is a state the GM inflicted rather than a modifier the
      player declared. Taking either one lands the folded sheet at **697 of
      730**, with 33px to spare.
- [ ] **The counter cell has no cushion between the value and the steppers, and
      that is the price of the grid rather than an oversight.** The full-width
      row put about 105px of dead space between them at 393; the cell has 4.
      Both mistakes it makes possible are recoverable and neither is silent — a
      miss onto the value opens numeric entry, which writes nothing and closes
      on one tap — but nobody has watched a real thumb do it at a table yet. It
      belongs in the list of things that need a human, below.

## Needs a human, two devices and a dim room

None of this can be proved by any test in this repo. Run it after P0 and P2
land. About 40 minutes total. You have an iPhone and an iPad, which covers the
two-device tests.

1. **QR hand-off, dim room** (5 min). Send from one device, receive on the other,
   at table lighting. *Pass:* decode without raising the lights; the brightness
   boost fires on the sender; HP, Stress, Hope, gold, loadout and level all
   match. *Watch for:* a decode that hangs at a fixed frame count, or a silent
   overwrite of a newer copy (P0-1).
2. **iOS Add to Home Screen and the pasteboard bridge** (5 min).
   `beforeinstallprompt` does not exist on iOS and cannot be simulated. *Pass:*
   the icon is labelled "Daggerheart", not the full document title; the installed
   app offers the paste route and reports a count; the persistence request
   appears, or the app says honestly that it did not.
3. **Offline, cold** (5 min). Load once online, airplane mode, force-quit,
   reopen. *Pass:* all four tabs work, all 189 cards and 129 adversaries browse,
   the print sheet renders, and the compatibility mark is an image and not a
   broken glyph (that is the `brand/` fix in P3-4).
4. **Backup actually writes a file** (3 min, desktop Chrome). Choose a folder,
   play two minutes, switch tabs, come back, close the tab. *Pass:* a
   `daggerheart-backup-YYYY-MM-DD.dhbackup` exists and parses; then tap three
   tabs and reopen Settings — "Last backup" must still say Today (that is the
   `lastBackupAt` clobber in P0-2).
5. **Restore does not eat newer work** (3 min). Export, play a session on that
   character, then import the old export. *Pass:* the app says the local copy is
   newer and asks, or skips and says so.
6. **Seven-day iOS eviction.** Install, create a character, do not open it for
   more than a week, then open it. The one test that cannot be hurried.

---

## Already good — do not spend time here

Verified, and listed so effort goes where it is needed.

- **The privacy promise is literally true.** Exactly one `fetch()` family in the
  whole tree (`public/sw.js:189, 209, 385`), all inside the service worker, all
  gated on same-origin and same-path. Zero `XMLHttpRequest`, `WebSocket`,
  `sendBeacon`, `EventSource`, remote `import()`, external fonts, external
  images, analytics. pdf.js is given a range transport with no `cMapUrl` and no
  `standardFontDataUrl`, so it never fetches either. The strongest claim in the
  README, and it holds.
- **Not one HTML injection sink.** Zero hits for `dangerouslySetInnerHTML`,
  `innerHTML`, `insertAdjacentHTML`, `DOMParser`, `document.write`, `eval`,
  `new Function`. Every decoded string reaches the DOM as a React child. Art
  blobs are pinned to `image/webp` before `createObjectURL`.
- **The binary decoders resist the classic attacks.** Every count-driven loop
  consumes at least one byte, so a declared count of 2^50 terminates with a
  `CodecError` instead of allocating. Offsets are checked against the payload
  size before slicing, and the codec refuses a payload with leftover bytes rather
  than producing a plausible-but-wrong character. *(This is about hostile input,
  which it survives. Accidental corruption is a different problem and is not
  covered — see P0-6.)*
- **`public/sw.js` is the best-engineered file in the repo.** It derives its
  scope from `self.location`, splits shell from content-hashed assets, discovers
  the chunk graph from what Vite actually emitted rather than trusting a
  manifest, and **refuses to adopt an `index.html` whose bundle it could not
  fetch** — the classic half-update PWA breakage, explicitly and testably
  prevented. ~~Fix the `brand/` gap in P3-3~~ — **done, `d413e35`..`c313d60`**
  (the reference was to P3-4, not P3-3). `brand/` is precached and routed, the
  precache test now derives its expectation from what Vite emitted rather than
  from three guesses, and the importer chunk is refetched before it is pruned.
  This file is finished.
- **The transfer format has room to spare.** Over all 3240 buildable characters:
  median 540 bytes, p95 687, max 842. Not one needs more than 5 QR frames of the
  15 the architecture allows — the worst case would have to grow 221 % to reach
  the offer-a-file line.

---

## Done since `87b9238`, which is everything not yet pushed

`origin/main` is at `dd66d35` and everything above it is still on this machine.
The suite is **2252 passing in 96 files** and `tsc --noEmit` is clean. (This
heading's `87b9238` is the commit the not-yet-pushed run *started* from; the
remote has since moved to `dd66d35`, which `HANDOFF.md` re-measured.)

**Closed and struck above, with their commits on the heading:** P0-1 through
P0-8 (the whole band), P1-7 (rests, and the first `SCHEMA_VERSION` bump this
project has ever made), P1-1 (attack rolls into damage rolls), P3-7 (the
orphan harness), P5-1 (Play is the sheet), P5-1(b) (rename), P5-2 (the GM
session screen), P5-3 (the GM reference), P5-4 (the printed sheet) and P5-5
(the reflow into Giorgio's order).

**The P1 to P4 entries below `P1-1` have not been re-adjudicated in this pass,
and several of them have shipped.** That is a known gap in this file, written
down rather than left to be discovered: the nineteen-lane pass that closed them
updated `HANDOFF.md` and `CHANGELOG.md` and did not come back here. Verified
against the tree while writing this, so a cold start does not rebuild them:

| item | shipped in | check |
|---|---|---|
| P1-2 recall pays in HP | `1a7ba19` | `Play.tsx` and `Cards.tsx` both read `check.affordable` |
| P1-3 Proficiency twice in a tier | `33a7d92`, `0fb3365` | `levelUp.ts:206` charges `option.slots` |
| P1-4 School of Knowledge, Beastbound | `1ae3ca1`, `7af6392` | `cardAllowance.ts` carries `Accomplished` and `Brilliant` |
| P1-5 armour ref, downtime label, one armour slot, seeded HP | `29d9c7f`, `851d04c`, `37c46e3`, `8f187d4` | `character.ts` carries `unresolvedArmor`; `newCharacter` seeds from the class; `Cards.tsx` branches on the rest, not on the cost |
| P2-1 the tablet band | `9035b2b` | every iPad gets the one-column sheet |
| P2-5 a bundle that will not evaluate | `8f9751a` | `index.html` carries an inline IndexedDB hatch |
| P3-2 the gear search | `9722e26` | |
| P3-3 unbounded counter maxima | `8908b46` | |
| P3-5 the one-in-five flaky test | `57023b1`, `ac7177e` | |
| P3-6 the card reader's footer | `9857e03` | |
| P3-8 offline readiness in Settings | `aa37467` | |
| P3-9 three controls that said the wrong thing | `d80bb51`, `ac8a92c`, `962fbee` | |
| P3-10 the licence notice | `905a23c`, `17b4f1c`, `d413e35` | |
| P3-11 the card's action, and RECALL the price | `ac8a92c`, `e434605` | |
| P4-1 to P4-5, P4-9 to P4-13 | `51cc7ea`, `894e1a2`, `21d9e64`, `2ccbc08`, `8afc144`, `4626a0c`, `da5e4dd`, `8914da6`, `15456c9` | |

**Part-done, so the entry stays open and this is which half.** P1-6's *display*
half shipped (`e9f150b`, `4a99811`) and its *healing* half did not:
`resolvePlaceholders` still has no caller in `src/`, and `Transfer.tsx` still
prints a promise no code performs — it is in `tests/harness/orphans.test.ts`'s
`DELIBERATE` list naming this item. P2-6's dialogs and reduced-motion halves
shipped (`8428ddc`, `79a4e54`); the desktop roll result is still announced by
nothing, since `aria-live` appears nowhere in `src/ui/player/`. P3-4's brand
assets are precached and routed (`d413e35`, and `sw.js`'s `STATIC_DIRS` now
holds `brand/`); the SRD's weight on the boot path and the QR stack's are not
touched.

**Not built in this pass, and not to be marked done by anybody reading this
table:** P2-3(d) typography in `rem`, P4-6 the TODO sweep, P4-7 the unused-code
flags and P4-8 the browser floor. All four were re-measured at HEAD and are
recorded as open in their own entries, with the current numbers.

---

## Done in the pass before that (`a241d32`..`91097eb`)

Ten commits, each green on its own. Three of these came from someone opening
the app on their own phone and saying what was wrong, which found two defects
that seven lenses of read-only audit had not.

- **Four navigation icons had never been painted.** Reported as "some icons do
  not load"; they were not loading because they were never drawn. The glyph's
  style object set `background` — a shorthand — and then
  `backgroundColor: undefined` for every tab but Cards, and React applies style
  properties in key order, where an `undefined` longhand is a *removal*. It
  deleted the colour the shorthand had just set. Measured in the browser: all
  four computed `rgba(0, 0, 0, 0)`, the active one included. Cards was visible
  only because it also draws a border, which is why this read as "some". A
  sweep of every `.tsx` for the same shorthand/longhand collision found exactly
  one occurrence, and a test now fails on the pattern rather than on the
  instance.
- **Creation threw both Experiences away.** `assemble` filtered out every
  Experience with an empty name, two lines below a review-step warning that
  says *"Both Experiences are worth +2 whether or not you have named them."*
  The screen promised and the next line of code did the opposite, so anyone who
  left the naming for play — which the SRD invites — reached Play with no
  Experiences and no hint that the mechanic existed. Both are created now; an
  unnamed one reads UNNAMED and is still armable.
- **Typed dice moved behind their own switch**, off by default, freeing the
  62 px band the two faces held above ROLL to show two em dashes. The old
  "Digital dice" hint described a behaviour that switch never had. The four
  states now come out of one pure function both layouts read — the desktop
  verdict strip was quietly keeping its own copy and saying READY and "tap
  ROLL" beside a control that could not roll.
- **The Play screen scrolls**, on the owner's call, and the two blocks that do
  not scroll are the tokens and the roll. Weapons, armour and carried items are
  on a phone for the first time; tapping a weapon arms the roll with its trait.
  Tracks are ordered by measured use rather than by the printed sheet, one to a
  row, which took the armour pip from 18 px to 43 px.
- **`attack.ts`**, the carrier between an attack roll and a damage roll, with
  the three-valued `succeeded` that a truthiness check would have dropped.
  Wired to the weapon-arming half; the damage step itself is still open (P1-1).
- **Contrast** — the six failing pairs, recomputed rather than trusted. One
  proposed value did not survive checking: the new boundary colour cleared 3:1
  on `--panel` and sat at 2.88 on `--raised`, which the tracks also render on.
  The test computes ratios from the tokens themselves, and the two duplicated
  light palettes are now pinned to each other.
- **1039 → 1094 tests**, `tsc` clean throughout.

**Also worth recording: the P0 blueprints were rejected.** Four were produced
for P0-1/2/3/5/6/7 and all four came back `NEEDS_REVISION` from adversarial
verifiers — among other things, one proposed committing a comment into the
source that was factually false, and another proposed a test that passes
against unmodified HEAD. They are parked in `.blueprints/` and must be reworked
before anything in P0 is built from them.

---

## Done two passes before that

Kept for context on what the numbers above are measured against.

- **The service worker was never registered.** `registerServiceWorker()` had
  eight passing tests and zero callers, so the app shipped with its entire
  offline story switched off. Wired in `App.tsx`, with `UpdateBanner` offering
  the waiting worker instead of swapping the bundle mid-session.
- **The wake lock was never taken.** `prefs.wakeLock` defaults to true and the
  only code reading it was the checkbox rendering its own state. Wired.
- **`tests/pwa/wiring.test.ts`** guards both. Its last test *derives* the seams
  from `register.ts`'s exports rather than naming them, so the next seam added
  and forgotten fails a test written today.
- **The precache could never rebuild itself.** `install` is the only thing that
  fills a cache, and a browser only installs when `sw.js`'s bytes change — so an
  evicted Cache Storage left an activated worker on an empty cache with no way
  back. `ensurePrecached()` now refills before pruning.
- **Character creation is gated.** Next refuses while a mandatory choice is
  unmade, and says which one. Verified at the handler, not just the styling:
  forcing `disabled = false` and clicking still does not advance.
- **Step 1 was three steps wearing one hat.** Split; the wizard is now 12 steps
  and the subclass has its own screen instead of living below the fold.
- **School of Knowledge takes three cards, not two.** Derived by
  `startingCardAllowance` from an explicit table, guarded by a test that scans
  the whole dataset for any feature granting an additional card and fails if the
  table does not account for it.
- **Domain cards are readable while you choose them.**
- **The matrix found a path tests could never reach.** The sampler read
  domain-card eligibility from the level being *left*, while `LevelUp.tsx:97`
  hands its picker the level being *arrived at*. No climb could ever take a
  level-10 card, so all 18 of them had never been round-tripped by any test.
  Card coverage went 171/189 → **189/189**, and every other axis is at 100 %:
  204/204 weapons, 34/34 armors, 18/18 subclasses and ancestries, 9/9 classes
  and communities, plus loot, consumables and beastforms entire.
- **A mutation pass found two tests that proved nothing** — the loadout cap and
  the encoder's unresolved references could both be broken with the suite still
  green. Both now fail loudly; re-verified by hand after the fact.
- **786 → 1039 tests**, 38 → 46 files, `tsc` clean.
