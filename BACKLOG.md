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

### P0-6 · The codec has no integrity check: a corrupted payload decodes into a different character
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

- [ ] Add a checksum over the encoded body (CRC-32 is enough, and cheap at
      these sizes — median payload is 540 bytes) and verify it before decoding.
- [ ] Version the format so an old build meeting a new payload says so rather
      than guessing.
- [ ] Re-run the bit-flip sweep as a test and assert the accepted-and-different
      count is **zero**, not merely low. The sweep already exists in
      `tests/adversarial.test.ts`; it currently pins the honest number.

### P0-7 · Imported characters skip the counter sync every other write path runs
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

### P1-1 · Attack rolls do not lead into damage rolls
`src/engine/dice.ts:264` · `src/ui/player/DualityRoll.tsx` · `src/ui/player/Play.tsx:285`
· **medium, 4–6 h** · *requested directly; validated, not yet applied*

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

- [ ] Carry the resolved attack — including `critical` — into a damage roll
      offered on success. Offer, never auto-apply: README promises the app
      *"proposes"* and never applies a declared effect silently.
      *(`attack.ts` is ready and tested; this is the wiring inside
      `DualityRoll` plus the damage row itself.)*
- [ ] Damage must be typeable as well as rollable, the way the Duality dice
      already are, for tables that roll physical dice.
- [ ] **Spellcast damage is a different rule and is not implemented.** *"Any time
      an effect says to deal damage using your Spellcast trait, you roll a number
      of dice equal to your Spellcast trait"*, and at +0 or lower you roll
      nothing. 77 of the 189 domain cards mention Spellcast and 43 carry a dice
      formula; none is rollable today.
- [ ] **Unarmed attacks** (`[Proficiency]d4`) do not exist in the code — zero
      hits for "unarmed" in `src/`.
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
- [ ] **Unarmored thresholds are the app's own invention presented as rules**
      (`character.ts:149`), and the damage calculator lets one attack spend up to
      3 armor slots (`Vitals.tsx:99`). Label them as house rules or gate them.
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

### P1-7 · Rests and downtime, wired to a screen — *decided: it ships*
`src/engine/rest.ts` · `src/ui/player/Play.tsx` · `shared/types.ts` · **medium, 6–8 h** · *requested directly*

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

- [ ] Persist the consecutive-short-rest count on `Character`. **After P0-8**,
      or behind it in the same change.
- [ ] A rest surface in the Play scroll: choose short or long, pick two moves
      with repeats allowed, see what each will clear *before* committing, then
      commit. Propose and then apply, the way the incoming-damage calculator
      does — never apply on open, because `takeRest` rolls dice and a roll that
      happens because you looked at a screen is a roll you cannot refuse.
- [ ] Offer the free loadout/vault swap in the same flow, through the existing
      loadout operations rather than a second implementation of the cap.
- [ ] Refuse a short rest, in words, when `mustTakeLongRest` says the next one
      must be long — and say why, citing the rule rather than just disabling.
- [ ] Produce the `'rest'` log entry. `state.ts:29` has declared that kind since
      the first commit and nothing has ever written one.
- [ ] The engine takes an injected `rng`; the screen must pass the real one and
      the test must pass a scripted one, so the numbers in a test are the
      numbers on screen.

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

### P2-4 · Screen reader and focus
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
as a whole it fails **today** on `TIER_BENCHMARKS`, `resolvePlaceholders`,
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
- [ ] Changelog and a release process. Version is still `0.1.0`.
- [ ] Sweep the remaining `TODO`/`FIXME`/`HACK` comments and decide which are
      real gaps.

---

- [ ] **Nothing in the pipeline objects to unused code, and the free compiler
      flags find nine hits today.** `tsconfig.json` sets `strict`,
      `noUncheckedIndexedAccess`, `noImplicitOverride` and
      `noFallthroughCasesInSwitch` — and neither `noUnusedLocals` nor
      `noUnusedParameters`. There is no eslint/biome/knip config and no `lint`
      script. Measured at `7815030`, not assumed:
      `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` reports **9
      errors** — `GearPicker.tsx:84`, `Play.tsx:87` (`stats`, accepted by
      `Identity` and never read), `:835 shapes`, `:836 setOpenCard`,
      `:840 klass`, `:844 modLabel`, `:848 modValue` (all leftovers of the phone
      Play rebuild), `Settings.tsx:33`, `tools/simulate.ts:22`. Two tsconfig
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
- [ ] **The section numbering has collided.** Two headings are `### P2-4` (`:438`
      the fixed block, `:493` screen reader and focus), the P2 items run 1, 2, 4,
      3, 4, and *Already good* points at "the `brand/` fix in P3-3" when it is
      P3-4. Cheap, and this document is the thing everything else is tracked
      against.

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
  prevented. Fix the `brand/` gap in P3-3 and this file is finished.
- **The transfer format has room to spare.** Over all 3240 buildable characters:
  median 540 bytes, p95 687, max 842. Not one needs more than 5 QR frames of the
  15 the architecture allows — the worst case would have to grow 221 % to reach
  the offer-a-file line.

---

## Done in this pass (`a241d32`..`91097eb`)

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

## Done in the pass before that

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
