# Handoff — resuming this work with an empty context

Everything below is true at `HEAD` on `main`. The tree is clean, `tsc --noEmit`
is clean, and the suite is **1947 passing in 89 files** — the number this lane
measured with P5-2 finished and its verification pass applied; it was 1932 in 89
when P5-2 was first called done, 1782 in 84 when P5-2 started and 1333 in 62
at the start of the session, and any other lane merged after this one moves it
again. **Nothing is pushed.** `origin/main` is still at `87b9238`, ~80 commits
behind.

## Read these first, in this order

1. `BACKLOG.md` — the work list. Struck through with a commit hash beside it
   means done; open `- [ ]` bullets mean not. **Start at the `P5` section**: it
   is new, it holds the two redesigns, and it records eight decisions the owner
   took by hand. Those are settled — build them, do not re-open them.
2. `CHANGELOG.md` — new this session, derived from the commit log.
3. This file.

## Working rules that are in force

- **Reason about screen ergonomics explicitly before writing UI.** Thumb arc,
  target size (44 px floor), read-vs-touch. Say the numbers.
- **The Play screen scrolls.** The old "no scrolling here" rule is overruled.
- **One commit per step**, with a message that says what was wrong and why the
  fix is shaped the way it is.
- **Every test must fail on the pre-fix code before it counts.** Verify by
  mutation and say so in the commit message.
- Never let the app claim something happened that did not happen.

### If you fan work out across agents, read this first

This session ran 19 lanes in parallel git worktrees. Two things cost real time
and will cost it again:

- **A worktree is cut from `origin/main`, not from local `main`,** and nothing
  is pushed, so it starts ~75 commits stale. Six lanes in the first wave wrote
  against a tree that had no `tests/harness/`, no `tests/ui/screens.test.tsx`
  and no `tests/store/migrations.test.ts`, and truthfully reported that the
  traps they were warned about "do not exist". Make the first two commands in
  every brief, in this order:

      ln -s "<repo>/node_modules" node_modules      # node_modules is gitignored
      git merge --ff-only main

- **`git stash` is repository-wide, not per-worktree.** `refs/stash` is shared.
  One lane stashed, another popped, and the second lane's tree was overwritten
  with the first lane's files. Both were recovered from the dangling stash
  commits, but only because the agent noticed. Tell lanes to `cp -R` aside
  instead of stashing.

Merge the branches back one at a time from the main tree and run the whole
suite once at the end — it is about ten seconds for the whole of it, so there is
no excuse for skipping it. It caught one real cross-lane failure this session
(`tests/pwa/bootFallback.test.ts` had the object-store list written out a third
time; the campaigns store added a fifth and it went red).

## What was finished this session

56 non-merge commits across 19 lanes. **P0 was already closed; P1, P2, P3 and P4
are now nearly closed too.**

| Area | What changed |
|---|---|
| **Play is the sheet** (P5-1) | Rebuilt in the official sheet's order on phone **and** tablet. Everything that was desktop-only is now on a phone: Evasion, thresholds, Proficiency, class/subclass/ancestry/community, the vault, gold. Counters are numbers with a keypad behind a `counterStyle` preference; trait verbs are on the tiles, parsed out of the SRD; four sections fold, and each character remembers its folds; the roll modifier row folds away and names whatever is armed on its closed edge. |
| **P2-1's open half** | Every iPad can roll again. It was measured at 45 px at 744×1133 and 26 px at 1024×768, with ROLL rendered ~228 px past its clip — in the DOM, invisible, still keyboard-reachable. |
| **Campaigns** (P5-2 foundation) | A `campaigns` object store beside `characters`, with its own `CAMPAIGN_SCHEMA_VERSION`, its own converter chain and its own committed fixture. The GM's state left `localStorage` — where it had been holding **other people's whole character sheets**, written synchronously on every `+1` of Fear. Migrated once, read back before the old key was deleted. `DB_VERSION` went 1 → 2, the first time that branch has ever run. |
| **The GM screen** (P5-2) | The session list *is* the screen. Rows open where they sit and reorder by thumb or by arrow key; the five tools open over the list and are unmounted on close, never hidden; ADD, SHOW and SAVE replace the tab bar and MENU carries the way out, the campaigns and the two tools no row can otherwise open; SAVE says when the last write actually landed instead of implying it is the thing that saves; the section and its two browse tools switch off from Settings and the bar redistributes; and everything the disk did or failed to do — a write that did not land, a tap the saved campaign replaced — is said on the screen it happened on, with a retry only where a retry can do something. |
| **P1-2, P1-6, P3-9, P3-11** | Recall no longer silently marks HP when Stress is full. Cards this build cannot name are drawn instead of counted and hidden. A vault card says why it will not recall instead of hiding it in a `title`. Five buttons are no longer all called USE. |
| **P1-4, P1-5** | School of Knowledge's extra card arrives at level-up. One incoming attack marks **one** Armor Slot, not three — the rule was found on the official GM screen, and the cap is a parameter because "unless an ability says otherwise" is part of the sentence. |
| **P3-5** | The flaky test is fixed at its cause. It was the test's statistics, not the engine: a flat 6 % band is 2.24 σ at the ends of a 2d12 triangle, which predicts the measured 5 % failure rate exactly. Now five standard errors per bucket and a seeded sample. 200 runs, 200 green. |
| **P2-5** | A build that will not evaluate now has a voice, and an ES5 inline hatch that opens IndexedDB and hands the library back without the bundle. |
| **P2-4, P2-6, P3-8, P4-10** | Six overlays that claimed `role="dialog"` now trap and restore focus. Settings says honestly whether this device can open offline, in four states. Every settings hint reaches its control — `aria-describedby` appeared **zero** times in the tree before. |
| **P3-10, P4-1..5, P4-12, P4-13** | Attribution survives having a character; the DPCGL and MIT texts ship and are readable offline; a build id; a CHANGELOG; one Node version. |
| **Print sheet** (P5-4) | Reordered to the official sheet, HP and Stress drawn solid to the earned maximum and dashed to twelve. Every string sourced from `data/srd-1.0.json`; no artwork, wording or trade dress copied from the PDF. |

## What is open

**P5-2, the DM screen, is finished.** Six commits, in this order: `eab26d8` made
the session list the GM screen and the five tools what a row opens; `f6e264d`
gave the rows a drag, a keyboard path and two buttons; `7b27e57` added `GmBar` —
ADD, SHOW, SAVE — with the three sheets behind it; `68c8cc7` gave MENU the way
out and the campaigns, and took the tab bar off the GM screen; `63a2558` made
the section and its two browse tools switchable from Settings, with the bar
redistributing; `8e0d02f` put the store's `writeError` on the screen it happens
on. Nothing on this item is left to build. `BACKLOG.md` P5-2 is struck through
with those hashes, and its *Left open* list is what these commits decided **not**
to do, with the reason beside each — read it before adding anything to this
screen.

**Then an independent pass read the diff back and found five defects a green
suite had not**, and they are fixed in `1025e08`, `e4505ec`, `0b5326c`,
`af5f235` and `87b2278`. Worth knowing what they were, because four of the five
are the same shape — a sentence in the source that was further along than the
code:

- the screen followed `board.region` on **every** change, so switching campaign
  or making one opened whatever tool that record had last open, over the list of
  the table you had just arrived at; it had no preference guard either, so a
  stored `bestiary` opened a tool the GM had switched off;
- the loading panel promised that nothing changed before the disk answers would
  be lost, in the same sentence as "it is the saved campaign that wins". The
  second half is what the code does. The store's notice about it lived in
  `notices`, which only MENU draws, so a Fear tap reverted by hydration was
  reverted in silence;
- TRY AGAIN called `flushGm` on failures a flush cannot fix — a rejected
  `createCampaign` (clean store, so `if (!dirty)` returned), a failed delete
  (nothing to write), a failed read (`base === undefined`, inert forever). The
  store says what a retry can do now, and where the answer is nothing there is
  no button;
- the arms inside a row gave their controls no row name, on a screen made of
  near-identical rows, where the row itself had solved that for DELETE;
- MENU carried no tools, so the encounter builder and the live scene were
  reachable only by first writing a row.

The lesson for the next lane is the one already in the rules: **the docblock is
the specification**, so when a comment and the code disagree it is a defect and
not a wording nit. Four of these five were found by reading a comment and
checking whether the code did it.

Four things that were carried across on the way, so nobody looks for them again.
`hydrateGm`'s silent `catch` around the first `putCampaign` is **fixed**: it sets
`writeError` and leaves the write dirty, which is what makes TRY AGAIN do
something — as does every other failure that offers one, since `0b5326c`. BESTIARY and PARTY have left the top bar for SHOW. The licence notice
moved **into** the GM scroll rather than off the screen — 111px of the 653 that
is not shell header, and `tests/ui/attribution.test.tsx` is the gate that says it
may not simply go while `tests/gm/gmShell.test.tsx` says *where* it went. And
`prefs.ts` now owns one rule that three callers share: `allowedScreen(prefs,
screen)` substitutes `'play'` for a GM screen whose section is off, and
`openingScreen(prefs, characterCount)` wraps it with the older empty-library
rule. `init()`, `App.tsx`, `TabBar` and `Header` all ask *it* rather than testing
the preference themselves — if a fifth caller ever needs the answer, it goes
through the same function.

**Where the GM screen's own switches are, for whoever touches Settings next:**
Settings → GM tools, third section, three switches — `gmSection`, `gmBestiary`,
`gmPartyBoard` on `Prefs` (so `localStorage`, no schema move). Their names on
screen are deliberately not "GM tools": `tests/ui/settingsHints.test.tsx`
resolves a control by its accessible name and the desktop section nav carries
each section's *title* as a button, so a switch sharing its section's name
resolves to the nav button and the row fails for the wrong reason.

**P5-3 — what the GM screen could have at hand.** The improvised-adversary table
by tier, difficulty as a labelled ladder, Fear per scene type, dynamic countdown
advancement, distances in metres, the name generators. Source every word from
`data/srd-1.0.json`; anything the shipped SRD does not carry does not ship.

**P1-7 rests.** Held back alongside P1-1 because both touch `Play.tsx` and
`DualityRoll.tsx`, which the rebuild was rewriting. **P1-1 is built** — an
attack roll offers the damage roll it earned, unarmed attacks have a row,
Spellcast damage counts its dice off the trait and refuses at +0 in the SRD's
own sentence, and damage dice can be typed the way the Duality dice already
could — so what is left of that pair is the rest. P1-7 adds a field to
`Character`, so it is a schema change: the machinery exists, the policy is
`Architecture.md` §6.1.

What P1-1 deliberately did **not** build, so nobody goes looking for it: extra
damage *dice* — `rollDamage` takes a flat `extraModifier` and the held-dice tray
feeds the attack roll, so the SRD's "Tusks: +1d6" still has nowhere to go — the
`companion` attack source, which needs a second armed slot on Play, and a way
out of an opened die-face grid that is not answering it. That last one is
`Die`'s behaviour as much as the damage row's and is written up as P3-12.

**P5-1(b) rename.** Renaming a character already works and is four gestures deep
in the tab visited least, and the rename path does not enforce the unique-name
rule that `merge.ts:63-75` argues for and `duplicateFor` enforces on the import
path. Decided: it goes in the Identity block the rebuild just created.

**Smaller:** P2-3(d) typography in `rem`, P4-7(a) `noUnusedLocals`, P4-8 the
browser floor. All three were blocked on the Play rebuild and are unblocked now.

**Deferred to 1.1, deliberately:** photos shown to the table, link rows that open
external URLs, full-text rule search. Written into `BACKLOG.md` P5-2, each with
its reason. SEARCH is the visible one — the wireframe draws four verbs in the GM
bar and 1.0 ships three — so it is worth knowing that the absence is a decision:
the search a GM does at the table is the Bestiary's filter behind SHOW, and when
there is an index behind SEARCH it goes in as a fourth entry in `GmBar`'s `VERBS`
and the grid redistributes on its own.

## The fastest way to see what is still unwired

`tests/harness/orphans.test.ts` holds `DELIBERATE`, and every entry names the
backlog item that deletes it. It is the honest inventory: **28 exported symbols
nothing in the shipped app reaches** — counted off the list rather than
remembered, because the figure here said 43 when the list held 35, which is the
one number in this file nobody can check by reading it. P1-1's seven are gone:
`rollDamage`, `damageOffer`, `isRollableDamage`, `sourceFromWeapon`,
`sourceName`, `unarmedSource` and `DAMAGE_SIDES` all have callers now. The four
`rest.ts` exports are P1-7; `resolvePlaceholders`, `characterRefs` and
`missingSlugs` are P1-6's *healing* half, which is still open even though its
*display* half shipped. **Wiring one of them fails the suite until its line is
removed. That is the intended behaviour.**

## Loose ends left deliberately

- **`Transfer.tsx` still promises a repair no code performs.** P1-6's ghost rows
  now render, but `resolvePlaceholders` has no caller, so the sentence *"They
  are kept on the sheet and will resolve when the missing source is added"* is
  still a promise the app cannot keep. This is the founding rule failing on a
  surface a user reads.
- `tests/import/coreRulebook.test.ts` needs the PDFs in `Manuali/`, which are
  gitignored. It skips itself when they are absent, so CI runs one file fewer
  than this machine does.
- `Giorgio modifiche DM/` is now gitignored, same rule as `Manuali/`: source
  material stays on the machine that owns it. Everything extracted from it is
  written into `BACKLOG.md` P5, including the transcripts' load-bearing lines.
