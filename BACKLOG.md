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

### P0-4 · Press-and-hold inside a track header clears the track
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
- [ ] **One malformed record makes the whole library unreadable.** `db.ts:67`
      sorts with `b.updatedAt.localeCompare(...)`; a record missing that field
      throws and `listCharacters` fails entirely — surfacing as the storage
      banner claiming everything is probably fine. Filter-and-quarantine on read:
      return what parses, collect what does not, offer to export the raw JSON.
      *(small)*
- [ ] **A backup is recorded as successful without ever being read back**
      (`fileIo.ts:549`), and the download route reports success from a click. An
      unverified backup is not a backup: re-open the handle with `getFile()`,
      parse it, assert the character count, and only then `stamp`. *(small)*

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

- [ ] Carry the resolved attack — including `critical` — into a damage roll
      offered on success. Offer, never auto-apply: README promises the app
      *"proposes"* and never applies a declared effect silently.
- [ ] Damage must be typeable as well as rollable, the way the Duality dice
      already are, for tables that roll physical dice.
- [ ] **Spellcast damage is a different rule and is not implemented.** *"Any time
      an effect says to deal damage using your Spellcast trait, you roll a number
      of dice equal to your Spellcast trait"*, and at +0 or lower you roll
      nothing. 77 of the 189 domain cards mention Spellcast and 43 carry a dice
      formula; none is rollable today.
- [ ] **Unarmed attacks** (`[Proficiency]d4`) do not exist in the code — zero
      hits for "unarmed" in `src/`.
- [ ] `Play.tsx:281` rescales Proficiency with an inline regex instead of calling
      `weaponDamage()` — precisely what the comment at `sheetModel.ts:249` warns
      against. Two routes to one number, and this one lacks the engine's clamp.

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

---

## P2 — Unusable on a device we support

### P2-1 · The Play screen collapses below 1180 px wide or 700 px tall
`src/ui/player/DualityRoll.tsx:395` · `src/ui/player/Play.tsx:645, 705` · **medium, 4–6 h**

Measured live in Chrome with a deliberately lean character. In the tablet band
(720–1179 px) `Play.tsx:517` puts Vitals and DualityRoll into a scrolling column;
DualityRoll's root is `flex: 1, minHeight: 0, overflow: 'hidden'`, so it is
crushed to **24 px**. On every iPad, and on every phone held in landscape, **you
cannot roll.**

At 375×667 the loadout region collapses to 0 px and the ROLL button renders at
half height.

- [ ] Pass `layout="phone"` to Vitals and DualityRoll in the two-column branch,
      or give DualityRoll's root `flex: 'none'` there so the column scrolls it
      into view instead of crushing it.
- [ ] Give the loadout region a one-row floor (46 px) and the ROLL button
      `flex: 'none'` so it can never be shrunk below its declared 66 px.

### P2-2 · Contrast below WCAG AA on text people read in a dim room
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
- [ ] **Track density keys off viewport width, not pointer type.**
      `Vitals.tsx:47` uses 44 px only below 720 px, so every iPad gets 32 px pips
      — while `tokens.css:123` *already* resolves `--control` to 44 px for
      `(pointer: coarse)`. Use the token. *(trivial)*
- [ ] **Armor pips are 12–18 px wide on a phone** because `Vitals.tsx:183` pins
      the armor track to a fixed 132 px column: 17.8 px at armor score 6, 12.1 px
      at 8. 13 of 34 SRD armors are score ≥ 6. *(small)*
- [ ] **All typography is in px**, so the OS font-size setting has no effect.
      Convert the type roles to `rem` and leave layout constants in px. *(small)*

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

### P3-2 · Untrusted input, second tier
- [ ] **Decoded counter maxima are unbounded and render one DOM node each**
      (`codec.ts:295`). Clamp on the way in: run `syncCounters` inside
      `importCharacter`, or bound the readers to the engine's own ceilings, which
      are already exported. Belt and braces: have `Track` refuse to render more
      than a sane number of pips. *(small)*

### P3-3 · Offline and weight
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
   broken glyph (that is the `brand/` fix in P3-3).
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
  than producing a plausible-but-wrong character.
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

## Done in this session

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
- **786 → 995 tests**, 38 → 46 files, `tsc` clean.
