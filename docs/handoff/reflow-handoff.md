# Handoff — the phone reflow is shipped; what is open is listed here

**Read this before doing anything on this project.** It replaces the "paused mid-build, ask the
four questions" handoff of the same name, which was true on 2026-08-17 and is now false. The old
text is kept beside this file as `reflow-handoff.SUPERSEDED-2026-08-17.md` and should not be acted
on: all four of its questions were asked and answered.

The owner's instruction on pausing: **when the conversation resumes, go back over every open
question and every open part below, and decide what to do with each.** That is what §4, §5 and §6
are for. Nothing in them is started.

---

## 1. Where the repository is

`main` is at **`3dff11f`**, pushed, CI green, Deploy green, `sw.js` stamped `3dff11f`.
**2499 tests in 108 files**, `tsc` clean, tree clean, nothing unpushed.

    https://simone-albanese.github.io/daggerheart-companion/

**Run the suite on Node 24, not the system Node:**

    PATH="/Users/simonealbanese/Documents/Daggerheart Companion/.tools/node/bin:$PATH" npx vitest run

Under jsdom `localStorage` works on Node 24 (CI, `.nvmrc`) and is `undefined` on Node 26 (this
laptop). A green run on the newer Node is weaker than CI's and it has already cost one red deploy.

**Owed cleanup:** the worktree `~/Documents/dh-wt3/reflow2` and its branch `a3-reflow2` are merged
into `main` by fast-forward and can both be deleted. Nothing else lives in them.

---

## 2. What shipped, and the order the owner decided it in

Five commits, `8def497` through `3dff11f`. Every visual decision was made by the owner from
**rendered alternatives**, not from description — see §3.

- ROLL given its own content's height back (−10), 8px of padding out of the defence band (−8),
  the trait chip down to the floor (−14).
- The counter number **22 → 26 → 38**. 26 was a width ceiling, not a taste one: beside the value,
  `11 / 11` measures **68.92** of the 74 the target has. Moving the maximum onto its own line made
  the widest drawn thing `11` at 47.65, and the ceiling moved with it.
- Each track is **one card**: the border, fill and radius moved from the value button to the row,
  `−` takes its left edge and `+` its right, and the two 4px gutters between the three old boxes
  are gone — which handed the number 6px of width and took 8 off the row's minimum. It costs no
  height.
- A press **answers**: the number takes a short step up and settles. A *transition* driven by
  `--motion`, never a keyframe — `base.css` zeroes `--motion` for both the OS preference and the
  app's own switch, but its blanket `animation: none` only covers the OS one.
- Four folds **paired two-up** (Weapons | Experiences, Cards | Rest), −104. `Carried` and
  `Lineage & domains` keep whole rows.
- 8px of top padding where the sheet used to share an edge with the header, and 14px between the
  four head-of-column blocks against 8 between the folds. Two rhythms saying two things.
- The defence band is `auto repeat(3, minmax(min-content, 1fr)) auto`, which ends the 45.4px hole
  at its right-hand end, and `--damage-w` goes 44 → 64 from viewport 390.
- The cockpit keeps everything it had: `tokens.css` puts `--counter-cell` and `--counter-num` back
  to 48 and 26 at 1180 and `Vitals` passes `tall` only for the phone.

**Two owner decisions that override the original plan and must not be quietly reversed:**

1. **«Lineage & domains» stays on the Play column.** It was step 7 of the plan and worth 52px. It
   cannot be paired — the only free partner is `Carried`, whose 257.41px summary will not take a
   181.5px half cell.
2. **PROF stays in the defence band.** Step 9 wanted it moved to pay for a wider damage field; the
   band's own hole paid for it instead, so the content move was never needed.

**Measured in Chrome at five widths, not summed.** Folded sheet **592** at 393, **524** at 375 and
360, **610** at 344 and 320; the column's 8px of top padding takes those to **600 / 532 / 618**.

| Context | Column | Sheet | |
|---|---|---|---|
| Installed, no home indicator | 730 | 600 | 130 spare |
| Installed, home-indicator iPhone | 696 | 600 | 96 spare |
| First launch, backup banner up | 664 | 600 | 64 spare |
| **Two shell banners at once** | 598 | 600 | **2 over — scrolls** |
| **Safari tab (inset assumed 21)** | 515 | 600 | **85 over — scrolls, by decision** |
| 375×667 | 545 | 532 | **13 spare — fits for the first time** |
| 360×800 Android | 678 | 532 | 146 spare |
| 320×568 | 446 | 618 | 172 over |
| Tablet 744×1133 | 1072 | 600 | 472 spare |

The Safari overflow is **the owner's explicit choice**, in their words: *«aria vera, e pazienza se
scrolla»*. Everything a turn touches — thresholds, tracks, traits, ROLL — is above the fold there.
No target is under 44px at any of the five widths.

**And ROLL ended up closer to the thumb than it started.** 493-559 above the bezel before any of
this, **407-463** now. The 24px lift the first four steps cost is not merely repaid but reversed by
86, most of it bought by the card's own height. At 375×667 it is back inside the ~330px sweep it
had left. That was a side effect of answering «è tutto attaccato sopra», not a plan, and the next
edit to those gaps will move it again.

---

## 3. The method that worked, and should be reused

Do not describe a design decision to this owner. **Build it as a runtime override on the live app,
screenshot it, and let them choose from pictures.** Every good decision in this pass came that way,
and two bad ones died in the picture before they cost anything.

The rig: the audit harness's `cdp.mjs` + `fixtures.json`, pointed at a local `vite --port 5199`.
Scripts from this pass are in the session scratchpad; the pattern is

1. seed IndexedDB + `localStorage` with a fixture (`played` for realism, `wizard10` for the worst
   case: two digits over two digits, a full purse),
2. inject a `<style>` overriding tokens plus any DOM surgery,
3. measure, then `Page.captureScreenshot` with a `clip` around the block,
4. compose the variants into one comparison image and send it.

**Measure text with a `Range`, never `scrollWidth`.** `scrollWidth` on an inline span reports the
box it sits in, so it returns the same number at every font size and will tell you nothing is
clipped when everything is. `document.createRange().selectNodeContents(el).getBoundingClientRect()`
reports the text's own laid-out extent. This reproduced the repo's own 68.94 figure to 0.02.

**Two traps this pass hit, both twice:**

- A height that moves into a token, or comes from `align-self: stretch`, is a height **no jsdom
  test can read**. The floor sweeps scored twelve targets 0 and reported them as under 44. Always
  declare `minHeight` as well as stretching, and resolve tokens through `tests/ui/tokens.ts`.
- `playSheet.test.tsx`'s **width budget** is the assertion that catches a change which only breaks
  360. It caught `--damage-w: 64` needing a 372.47px viewport. Do not weaken it.

---

## 4. OPEN QUESTIONS — reopen every one of these

Nothing here is decided. Each says what it costs to settle.

1. **`env(safe-area-inset-bottom)` in an iOS Safari tab has still never been measured.** The whole
   budget assumes **21px**, inherited from an Apple forum thread, which is what makes the Safari
   column 515. If it is really 0 the column is 536 and the sheet is 64 over instead of 85. The
   owner was offered the measurement twice and chose the prudential assumption both times. It is
   the only figure in the entire budget that is inherited rather than measured. **30 seconds on the
   owner's phone settles it.**

2. **The contested reach figure.** Whether a Safari tab's bottom toolbar counts as ~130px of glass
   *below* the viewport. Two of the three original proposals used opposite conventions and nobody
   measured it; 130px is larger than anything this reflow traded. It blocks nothing today — ROLL
   ended closer than it started — but every ergonomic sentence in `Play.tsx` rests on the other
   convention. **One line from somebody holding the phone.**

3. **`Carried`'s summary at 360 — two numbers disagree and one is wrong.** `Disclosure`'s docblock
   says 4.61px is lost at 360; I measured **18px** of overflow with the `wizard10` purse. They may
   be measuring different things. In this repo a docblock the code disproves is a defect, so this
   is owed either a correction or an explanation. **Half an hour.**

4. **The steppers are 44 wide by the card's full height (90px).** Easy to hit, and visually
   heavier than the number they serve — two tall near-empty regions per card. Capping them at
   ~60px centred vertically was offered and never decided; it costs no column either way. **A
   rendered A/B would settle it in one pass.**

5. **344 and 320 still scroll** (618 of column against 446 at 320×568) and the defence band and
   trait row reflow onto two lines there. This has always been true and is documented, but it is
   now the only phone size that does not fit at all.

6. **Two shell banners at once is 2px over.** A first launch on a second visit gets both, so it is
   not exotic. It scrolls, on a column that already scrolls in Safari. Worth knowing before anyone
   spends those two pixels somewhere else.

---

## 5. The GM screen — what is open, verbatim from `BACKLOG.md`

Six items, none started. My read on each is the italic line.

- **~1949 · `Countdown.notes` is persisted, read by `readCountdown`, and rendered nowhere.** The
  open countdown row is now the obvious place for it. It needs a keyboard inside a scrolling list
  and a history, and a row that starts showing the field must not imply it was ever editable
  before.
  *Real feature work, and the history requirement is the expensive half.*

- **~1954 · A session encounter row can put its plan back on the board, but not its fight.**
  `combatants` on the row are stated as a fact with no control, because no action in `gmStore` sets
  the combatant list wholesale. **Adding one is a store change, not a screen change.**
  *The backlog names the shape of the work itself, which is unusual and useful.*

- **~2003 · The shell substitutes the GM screen rather than correcting the store.** `allowedScreen`
  makes `App` *draw* Play while `screen` is still `'gm'`. Nothing user-facing can produce it, and
  both alternatives are worse — correcting from a render is a write during render.
  *Probably a "document it and close it" rather than a fix. Worth an explicit decision.*

- **~2013 · A campaign that failed to write is only said on the GM screen.** A GM who leaves for
  Play or Cards with a failed write behind them is told nothing; `App.tsx`'s unsaved-work banner is
  about the character store and has never known about campaigns.
  *This is a data-loss-adjacent silence and I would rank it first of the six.*

- **~2157 · The reference is not one of the switchable GM tools.** The bestiary and party board are
  switchable because they are the two forks of SHOW; the reference is the SRD the app already
  ships. `prefs.gmSection` still takes the whole section away.
  *A product call, not a bug.*

- **~2916 · `GmBar` and the horizontal insets.** It already pays
  `calc(0px + env(safe-area-inset-bottom))` at `GmBar.tsx:127` and **wants the two horizontals in
  the same form**; unlike `TabBar` it is drawn at every width, so it is on screen in exactly the
  landscape case. Immediately below it: **six overlays hide an `env()` inside a `padding`
  shorthand** — `DomainCardView`, `Companion`, `Conditions`, `DeathMove`, `Beastform`, `GearPicker`.
  *The smallest, most verifiable, and visible on the owner's own phone. Good first move.*

---

## 6. Sync between a player's sheet and the GM's board

**The constraint is written in the code**, `src/ui/gm/party.ts`, first paragraph: *"A PC on this
board is a **sighting**, not a subscription."* The board keeps the sheet whole as it arrived plus
the moment it did, and derives every number from those two. That follows from "local-first, no
accounts, no network" — it is a consequence, not an oversight.

What already exists to build on: `src/transfer/` has `qr.ts`, `codec.ts`, `frames.ts`,
`pasteboard.ts`, `fileIo.ts`, `campaignFile.ts`; `PartyTracks` (hp, stress, hope, armor) is already
persisted on the campaign record.

Options put to the owner, none chosen yet:

1. **The GM edits the tracks on the board.** `PartyTracks` is persisted already; only the controls
   are missing. It is what happens at a real table — the player says "I'm at 3" and the GM marks
   it. *Cheapest, solves most of it, betrays no principle. My recommendation as the first move.*
2. **A "delta" QR**: the four tracks plus a timestamp, not the whole sheet. Tiny payload, reuses
   `qr.ts`/`codec.ts`/`frames.ts`, refreshes the sighting and its date. *The deliberate catch-up
   gesture, which is exactly what "sighting" promises.*
3. **A self-refreshing QR beacon** on the player's screen with the GM's camera open. *Technically
   fine, socially bad — it holds a player's phone hostage all evening. Listed so nobody proposes it
   twice.*
4. **Accept the network**: an ephemeral room, six-digit code, no accounts, data only while the
   session is open. *A product decision, not a code one — it changes the app from "works on a
   plane" to "works if there's signal". Would need costing as its own project.*
5. **Rejected outright: bidirectional sync.** It needs conflict resolution, history and an
   authority, and it changes the game — a character's HP belong to the player. `merge.ts` exists
   for backups and using it here would be solving a trust problem with an algorithm.

Real-time without a server is not available: WebRTC needs signalling, WebSockets need a server,
Web Bluetooth does not exist in Safari on iOS.

---

## 7. Rules that still bind whoever builds here

- Floor **44px coarse / 34px fine** (`--control`/`--tap`), never WCAG 2.5.8. Declare it; never
  inherit it from a parent's stretch.
- The Play screen scrolls. What must not happen is a control at 0px or off the glass silently.
- Licence notice last in the scroll; `env(safe-area-inset-bottom)` paid exactly once, spelled
  `calc(0px + env(...))` so jsdom keeps it.
- **Every test must fail against the pre-fix code; mutate it and say which mutation it kills.**
- **A docblock the code disproves is a defect here**, and this pass falsified several of its own
  before catching them. When a number moves, grep for it.
- Never `git add -A` in a worktree — `node_modules` and `Manuali` are symlinks.
- The owner reads and answers in Italian, and asks for choices as questions with the cost of each
  stated. Give the arithmetic, then a recommendation.
