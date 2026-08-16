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

### P0-1 · Importing a file silently overwrites a newer character
`src/store/state.ts:233` · `src/ui/settings/Settings.tsx:468` · **medium, 2–4 h**

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

- [ ] Route `Settings.tsx:468` through `restoreFromText(text, { mode: 'merge' })`
      and surface its `imported / skipped / replaced` counts.
- [ ] Make `importCharacter` itself refuse to clobber: compare `updatedAt` and
      offer keep-mine / take-theirs / keep-both-under-a-new-id.
- [ ] Same guard on the two other blind paths: QR receive (`Transfer.tsx:302`)
      and clipboard paste (`Settings.tsx:675`). `Recovery.tsx:34` is already safe
      — it only renders on an empty library.
- [ ] Rewrite the hint so it describes what actually happens.

### P0-2 · The automatic backup never runs, and Settings says it does
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

- [ ] **The false claim.** Make the hint conditional on the hooks actually being
      installed, and honest that iOS Safari has no `showDirectoryPicker` and can
      therefore never have a folder at all.
- [ ] **`lastBackupAt` is destroyed by the next tab tap.** `runBackup`'s default
      `writePrefs` (`backup.ts:96`) writes straight to localStorage;
      `state.setPrefs` (`state.ts:177`) merges into `get().prefs` — the copy
      loaded at launch, which never received the stamp — and overwrites the whole
      key. Every `setScreen` calls it. Fix: make `setPrefs` merge onto
      `loadPrefs()` instead of `get().prefs`. That one change fixes the clobber
      *and* the stale copy the banner reads.
- [ ] **On a phone the nag can never fire.** `BackupBanner.tsx:36` suppresses the
      banner under 720 px unless `days >= 5`, but `daysSinceBackup` returns
      `null` when `lastBackupAt` is unset — which, because of the bug above, is
      always. Day 1 or day 90, the phone shows nothing.
- [ ] Call `installBackupHooks()` from an `App` mount effect and dispose on
      unmount; run `integrityCheck()` in `init()` and render `report.message`
      plus a restore offer when `!report.healthy`; call `noteSession()` on
      `pagehide`.
- [ ] Add a test asserting the app registers the `pagehide` hook, so this cannot
      regress into decoration again.

### P0-3 · A failed character write is swallowed with no signal
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

- [ ] try/catch in `flush()`; on failure put the batch back into `pending` and
      set a `writeError` the shell renders as a persistent alert with a **Save a
      copy now** button. Special-case `QuotaExceededError`.
- [ ] Do **not** reuse the `storageError` banner — its copy says *"nothing has
      been written in the meantime"*, which would be the opposite of the truth.
- [ ] Make `runBackup` flush first, or source from the in-memory store, so the
      recovery path stops lying.

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

### P0-5 · Second-tier durability
**~4 h total**

- [ ] **Persistent storage is never requested on an import path.** `create()`
      asks when the library is empty (`state.ts:203`); `importCharacter` never
      asks — and the user who just restored a library onto a fresh origin has the
      most at stake. Once populated by import, `first` is false forever, so a
      later `create()` never asks either. *(trivial)*
- [ ] **The IndexedDB connection is never reopened after the browser kills it.**
      `db.ts:47` is `dbPromise ??= openDB(...)` with no `terminated` callback and
      no reset on rejection: one force-closed connection and every write for the
      life of the tab rejects into P0-3's void. Pass
      `terminated: () => { dbPromise = null; }` and clear on rejection —
      `handleStore` in `backup.ts:132` already uses that pattern. Add
      `blocked`/`blocking` before ever bumping `DB_VERSION`. *(trivial)*
- [ ] **A pending debounced write can resurrect a just-deleted character.**
      `remove()` (`state.ts:221`) does not `pending.delete(id)`. *(trivial)*
- [ ] **One malformed record makes the whole library unreadable — usually.**
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
- [ ] **A backup is recorded as successful without ever being read back**
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
- [ ] **`src/engine/rest.ts` has zero callers** — 226 lines, 28 passing tests, and
      no rest or downtime anywhere in the UI; `state.ts:29` declares a `'rest'`
      log kind nothing produces. It is fully tree-shaken, so it costs users
      nothing today. Decide: wire it, or say out loud that rest is not in 1.0.
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
