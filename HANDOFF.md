# Handoff — resuming this work with an empty context

Everything below is true at `HEAD` on `main`. The tree is clean, `tsc --noEmit`
is clean, and the suite is **1782 passing in 84 files**, up from 1333 in 62 at
the start of this session. **Nothing is pushed.** `origin/main` is still at
`87b9238`, ~75 commits behind.

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
suite once at the end — it is about ten seconds for 1782 tests, so there is no
excuse for skipping it. It caught one real cross-lane failure this session
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
| **P1-2, P1-6, P3-9, P3-11** | Recall no longer silently marks HP when Stress is full. Cards this build cannot name are drawn instead of counted and hidden. A vault card says why it will not recall instead of hiding it in a `title`. Five buttons are no longer all called USE. |
| **P1-4, P1-5** | School of Knowledge's extra card arrives at level-up. One incoming attack marks **one** Armor Slot, not three — the rule was found on the official GM screen, and the cap is a parameter because "unless an ability says otherwise" is part of the sentence. |
| **P3-5** | The flaky test is fixed at its cause. It was the test's statistics, not the engine: a flat 6 % band is 2.24 σ at the ends of a 2d12 triangle, which predicts the measured 5 % failure rate exactly. Now five standard errors per bucket and a seeded sample. 200 runs, 200 green. |
| **P2-5** | A build that will not evaluate now has a voice, and an ES5 inline hatch that opens IndexedDB and hands the library back without the bundle. |
| **P2-4, P2-6, P3-8, P4-10** | Six overlays that claimed `role="dialog"` now trap and restore focus. Settings says honestly whether this device can open offline, in four states. Every settings hint reaches its control — `aria-describedby` appeared **zero** times in the tree before. |
| **P3-10, P4-1..5, P4-12, P4-13** | Attribution survives having a character; the DPCGL and MIT texts ship and are readable offline; a build id; a CHANGELOG; one Node version. |
| **Rename** (P5-1(b)) | Rename is on the sheet, in the Identity block the rebuild created: a 72×44 chip on the class/subclass row with 51 px of clearance below the header's SETTINGS button, **costing 25 px** of the 457 px scroll window measured at 393×852. The name line itself is still not a target — no role, no `tabIndex`, no handler — because that is what the bullet about a keyboard opening under a thumb actually forbids. The unique-name rule left `duplicateFor`'s body and became one comparison in `merge.ts` with two callers: the *keep-both* copy, and one `RenameField` that both Play and Build's Name field go through. Nothing is written while you type; the sheet writes on SAVE or Return, and Build — which has no ✕ and sits among fields that all write on the keystroke — writes on blur as well, which `rename.test.tsx` pins in both directions. A refusal is a `role="status"` sentence with the field pointing at it through `aria-describedby`, not a greyed SAVE, because `disabled` takes the only control carrying the reason out of the tab order. **Enforced at two doors, not everywhere** — creation and a plain import both still write a colliding name, and `characterFileName` still slugifies two distinguishable names to one file. Those three are `BACKLOG.md` P5-1(c), and `Architecture.md` §7 states the limit rather than claiming an invariant. |
| **Print sheet** (P5-4) | Reordered to the official sheet, HP and Stress drawn solid to the earned maximum and dashed to twelve. Every string sourced from `data/srd-1.0.json`; no artwork, wording or trade dress copied from the PDF. |

## What is open

**The DM screen itself (P5-2).** The store, the migration, multi-campaign and
the export are built. **The screen is not.** Still to build: the session list
with drag-to-reorder, ADD (countdown / encounter / scene / link), the bottom bar
that replaces the tab bar inside the GM section, MENU as the way back out,
SHOW → Consulta and Gruppo, and the per-tool switches in Settings. `BACKLOG.md`
P5-2 has the decided shape.

**P5-3 — what the GM screen could have at hand.** The improvised-adversary table
by tier, difficulty as a labelled ladder, Fear per scene type, dynamic countdown
advancement, distances in metres, the name generators. Source every word from
`data/srd-1.0.json`; anything the shipped SRD does not carry does not ship.

**P1-1 damage rolls** and **P1-7 rests**. Both were deliberately held back
because they touch `Play.tsx` and `DualityRoll.tsx`, which the rebuild was
rewriting. They are unblocked now. P1-7 adds a field to `Character`, so it is a
schema change — the machinery exists, the policy is `Architecture.md` §6.1.

**Smaller:** P2-3(d) typography in `rem`, P4-7(a) `noUnusedLocals`, P4-8 the
browser floor. All three were blocked on the Play rebuild and are unblocked now.

**Deferred to 1.1, deliberately:** photos shown to the table, link rows that open
external URLs, full-text rule search. Written into `BACKLOG.md` P5-2.

## The fastest way to see what is still unwired

`tests/harness/orphans.test.ts` holds `DELIBERATE`, and every entry names the
backlog item that deletes it. It is the honest inventory: 43 exported symbols
nothing in the shipped app reaches. `rollDamage` and the five `attack.ts`
helpers are P1-1; the four `rest.ts` exports are P1-7; `resolvePlaceholders`,
`characterRefs` and `missingSlugs` are P1-6's *healing* half, which is still
open even though its *display* half shipped. **Wiring one of them fails the
suite until its line is removed. That is the intended behaviour.**

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
