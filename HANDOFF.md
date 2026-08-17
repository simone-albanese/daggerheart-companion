# Handoff — resuming this work with an empty context

> **Read `AUDIT-HANDOFF.md` first.** It is newer than this file and it
> contradicts it on purpose: it is the state of the resolution audit, which has
> merged eleven lanes over this file's head and moved most of the numbers in the
> Play budget below. Where the two disagree, that one measured later.

Everything below is true at `HEAD` on `main`, with every lane of this pass
merged. The tree is clean, `npx tsc --noEmit` is clean, and the suite is
**2481 passing in 108 files** — measured at `HEAD` with `npx vitest run`, not
remembered. For scale:
1333 in 62 at the start of the session that opened P5, 1947 in 89 when P5-2 was
called done, 2230 in 96 when the five lanes were merged, 2237 after the seven
tests the honesty pass below added, 2247 after P5-5's first commit replaced the
eight assertions that pinned the Play screen's pinned block, 2252 with P5-5
finished, 2255 after the verifier pass on P5-5, 2266 with P5-6 — the three
savings that close the reflow, plus the sweep that catches the defect P5-6
found by rendering the screen instead of summing it — 2284 with P5-7, the
licence notice at the end of every screen's scroll, **2289 with P5-8**, which is
the pass that finally made the whole folded sheet fit, and **2481 in 108 files**
after the resolution audit's eleven lanes.

**Push state, re-measured rather than remembered.** `origin/main` is at
`dd66d35`, which is **138 commits** behind `main` — `git rev-list --count
origin/main..HEAD`, counting the commit that wrote this line, because a
handoff's own edit moves this number and the last one was left one short (it
said twenty-six before the audit) — so
the "nothing is pushed,
`87b9238`, 172 commits behind" that stood here through the whole P1-P5 pass is
no longer true and the warning below about worktrees being cut from a stale
`origin/main` no longer bites the way it did. A push still triggers a live
GitHub Pages deploy, so it still waits to be asked for.

**Where the numbers that matter stand.** `SCHEMA_VERSION` is **4**, with exactly
one converter in `MIGRATIONS` (`from: 3`) and `OLDEST_READABLE` still 3, because
3 is the version of the files already on people's disks. `DB_VERSION` is 2,
`CODEC_VERSION` is 2, `CAMPAIGN_SCHEMA_VERSION` is 1. `package.json` is
**`0.2.0`** and that is deliberate: nothing here is a 1.0 and no document in this
repository says it is.

## Read these first, in this order

0. `AUDIT-HANDOFF.md` — the resolution audit's state. It is newer than this file
   and contradicts it where the audit moved a number, and its §7 is the only
   place that says what a human on real hardware still has to check.
1. `BACKLOG.md` — the work list. Struck through with a commit hash beside it
   means done; open `- [ ]` bullets mean not. **Start at the `P5` section**: it
   holds the two redesigns, and it records eight decisions the owner took by
   hand. Those are settled — build them, do not re-open them. Then read the
   section at the very foot of that file, *Done since `87b9238`*: the P1 to P4
   entries were closed by the nineteen-lane pass and never struck one by one, so
   that table is what tells you whether the item you are about to build already
   exists. **Note the numbering collision at the foot of P5**: the owner's
   decision file for the licence footer is titled "P5-6", but P5-6 was already
   the savings pass by the time it landed, so it is **P5-7** in the backlog and
   the collision is written down there rather than tidied away.
2. `CHANGELOG.md` — one `0.2.0` entry, grouped by what a user would notice.
   Nothing above it: there is no `Unreleased` section, because `0.2.0` itself is
   not released.
3. This file.

## Working rules that are in force

- **Reason about screen ergonomics explicitly before writing UI.** Thumb arc,
  target size (44 px floor), read-vs-touch. Say the numbers.
- **The Play screen scrolls, and nothing on it is pinned.** The old "no
  scrolling here" rule was overruled at `91097eb`; the fixed block that replaced
  it was overruled at `0ccc857`, and the number that decides whether *that*
  stays true is ROLL's declared lower edge against the usable column — **306 of
  730 at 393×852, and 306 of 545 at 375×667** since the audit's reflow
  (`0cdf42f`; the same 306 at both widths, because everything above it is the
  same height). ~~385 of 730 and 385 of 545 since P5-6~~ — **superseded**:
  decisions 1 to 7 took the identity block off the phone, moved the conditions
  door into the defence band and made the trait chips two lines at a 44px basis,
  and the whole stack above ROLL came down with them. It is a test,
  `playSheet.test.tsx` › "the budget the pin came off for", and it says in its
  own docblock what it can and cannot prove: jsdom has no layout engine, so it
  sums declared heights and never measures. **Anything added to that column has
  to go through it.** The margin at 375×667 is **239px**, where P5-5 had ten and
  had to defend it and P5-6 had 160, and **no** ordinary state the budget cannot
  see costs more than it. The dearest is now typed dice at **+68**, which leaves
  171; a companion is **+58** and not the +50 four documents carried — `WhoSwitch`
  is a 44px button inside `padding: 3` and a 1px border, which is a 52px box,
  plus the 6px gap of the Vitals panel it is added to. That is the same shape as
  the banner correction below: a box counted without the space it is placed in.
  It was pips at
  **+100**, leaving 60 — measured in Chrome, the Vitals block was 94 as numbers
  and 194 as pips, and nothing wrapped at either width — and decision 7 deleted
  `counterStyle`, its Settings switch and every branch on it, so that state is
  unreachable and the list is five things rather than six. The counters are
  numbers on the phone **and** in the desktop cockpit; pips survive on the party
  board, the live scene and the companion.

  **And since P5-8 the whole folded sheet fits — 618 against 730 at 393×852,
  with 112px to spare** after the audit's reflow, where P5-8 measured 697 with
  33. That is the condition P5-5's own decision 1 made the unpinning conditional
  on — 899 at P5-5, 749 at P5-6, 697 at P5-8, 618 now. It fits at 744×1133 with
  454 to spare, is **73px over at 375×667** where it was 152, and **fits a
  360×800 Android for the first time**: 618 against 678, 60 to spare. The report
  predicted 360×800 would not fit because it costed decision 5 without the width
  fix beside it — a taller chip is not a narrower one — and the trait row's
  `flex-basis` went 46 → 44 in the same lane, which puts the row on one line from
  viewport **356** up rather than 368. With two conditions on the sheet is 670 of
  678 and still fits. The last 52 came from the conditions and nowhere else, exactly as
  P5-6 said it would have to: nothing is drawn while nothing is on, and the
  permanent door is a 44×44 `ConditionsControl` — in the identity's class row at
  P5-8, and **at the head of the defence band's fifth cell** since decision 3
  took the identity block off the phone, in a row the number cells already hold
  open at 64. The assertion that used to state the miss now states the fit and
  the slack, so it fails when the sheet stops fitting. **The thing it did not
  cover has stopped binding:** a home-indicator iPhone installed as a PWA pays a
  34px `env(safe-area-inset-bottom)`, which takes the column from 730 to 696 —
  against 697 that was one pixel over, and against 618 it is 78px of room.
  ~~One pixel over in the installed app~~ — **superseded by the reflow**, and
  kept here because the fit was the whole warrant for unpinning and a reader
  should see that it stopped being a hair's breadth. Nobody has still measured
  that inset on the owner's own phone, and it is item 1 of `AUDIT-HANDOFF.md` §7.

  **Two of that describe's assertions are now backed by a layout engine and not
  only by arithmetic.** P5-6 rendered the sheet in Chrome through
  `preview.html` at 393×852, 375×667 and 744×1000, and every section drew at
  exactly the height it declares. That is worth doing again after any change to
  this column, because it is what caught the one defect the suite structurally
  could not see: the roll surface was the only child of the phone column that
  had not declared `flex: none`, so the browser shrank it to 33px around a 66px
  ROLL rather than scrolling the sheet, and the fold header underneath was drawn
  through it. The sweep «lets no section of the column shrink instead of
  scrolling» is the guard now.

  **The column has twelve children with a clear sheet, and the twelfth is
  outside the budget on purpose.** It is the licence notice, and it is the one
  thing on this screen a player never has to reach: it sits below the last shut
  fold, so it moves no term of `STACK`, no term of `INDEX` and neither total.
  The test pins that it is *last* and that it is a `<footer>`, because "outside
  the budget" has to stay a statement about that one element rather than a hole
  anything else can be dropped into. It was thirteen until P5-8; the conditions
  strip is the thirteenth again the moment a condition is on, in its own slot
  below Rest, and the sheet is back to 749 while it is.
- **The licence notice is the last thing in every screen's own scroll, and it is
  not negotiable against pixels.** That is P5-7, and it is the second time this
  defect has been fixed: the first fix gave the shell a footer, the footer was a
  *fixed* strip costing 126px of a 393px phone on every frame, and a cost like
  that gives every later layout pass a reason to argue it away — which P5-1 duly
  did, leaving Play with no notice at all. Inside the scroll it costs a scroll
  position, which nobody has ever needed to reclaim.
  `tests/ui/attribution.test.tsx` is the guard between this project and a DPCGL
  takedown: it asks **all five** screens for the notice, asks that it is inside
  a `.scroll` with nothing drawn after it, and counts the payers of
  `env(safe-area-inset-bottom)` on five screens × two widths plus Build's other
  two modes. Anything added to the bottom of a screen goes through it. Note the
  one mechanical trap it took to make that last sweep possible: **jsdom's CSS
  parser drops a bare `env()`** and drops any shorthand containing one, so every
  payer declares it as `calc(0px + env(...))`; written bare, the declaration
  reads back as `''` and an assertion on it can never fail. The audit rig has
  the same constraint from the other end — it substitutes insets by rewriting
  inline `style` attributes, so a value hidden behind a custom property in
  `tokens.css` could never be measured on hardware either.

  **And the precondition under all of it, which no document stated until the
  audit:** `index.html` declares `width=device-width, initial-scale=1,
  **viewport-fit=cover**`. Without that third term iOS lays out inside the safe
  area and reports every `env()` in this repo as 0, so the home-indicator
  padding, the notch padding and the side-cutout padding would become no-ops
  together and in silence. `maximum-scale` and `user-scalable=no` are absent by
  choice (WCAG 1.4.4). `tests/ui/safeArea.test.ts` asserts the meta now.
- **One commit per step**, with a message that says what was wrong and why the
  fix is shaped the way it is.
- **Every test must fail on the pre-fix code before it counts.** Verify by
  mutation and say so in the commit message.
- Never let the app claim something happened that did not happen.

### If you fan work out across agents, read this first

One session ran 19 lanes in parallel git worktrees and a later one ran five. Two
things cost real time and will cost it again:

- **A worktree is cut from `origin/main`, not from local `main`,** and nothing
  is pushed, so it starts **138 commits stale** as of `HEAD` — it was ~75 when
  this warning was written, and the gap only grows until somebody
  pushes. **Cut it from local `main` yourself**, which is what
  `audit-harness/analysis/mkwt.sh` does, and what every lane of the resolution
  audit did. Six lanes in the first wave wrote
  against a tree that had no `tests/harness/`, no `tests/ui/screens.test.tsx`
  and no `tests/store/migrations.test.ts`, and truthfully reported that the
  traps they were warned about "do not exist". Make the first two commands in
  every brief, in this order:

      ln -s "<repo>/node_modules" node_modules      # node_modules is gitignored
      git merge --ff-only main

- **An ignore rule with a trailing slash does not match a symlink**, and that
  cost this project 321MB of bought PDFs in a near miss. `Manuali/` in
  `.gitignore` does not match the `Manuali` *symlink* a worktree gets, so a lane
  committed a mode-120000 blob for it, and merging that would have replaced the
  real directory with a link to itself. Same trap for `node_modules`. Ignore
  both **without** the slash, and read `git diff --name-only` before every merge.
  Backup of the PDFs: `~/Documents/Manuali-BACKUP-audit`.
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

## What was finished, across everything that is not pushed

**278 non-merge commits since `87b9238`**, across the nineteen-lane pass, the
five lanes merged after it and the resolution audit's eleven. Counted at `HEAD`
with `git rev-list --count
--no-merges 87b9238..HEAD`, counting the commit that writes this line. The 146
that stood here at one point does not reconcile with any
range this repo can produce, so it was replaced with a measurement and the
command that took it rather than adjusted, and every pass since has re-run the
command instead of adding to the number. **P0 is closed;
P1, P2, P3 and P4 are nearly closed.** The table below is that whole span, not
one session of it — which is also the span the next push publishes in one go.

| Area | What changed |
|---|---|
| **Play is the sheet** (P5-1, then P5-5) | Rebuilt in the official sheet's order on phone **and** tablet, then reflowed into Giorgio's (P5-5). Everything that was desktop-only is now on a phone: Evasion, thresholds, Proficiency, class/subclass/ancestry/community, the vault, gold. Counters are numbers with a keypad, on every layout: decision 7 deleted `prefs.counterStyle` and its Settings switch, took the pip tracks off the desktop cockpit as well as the phone — 29 targets 32px tall against a 44px floor, and the preference could never reach them — and gave the cockpit's `DualityRoll` the 70px back (the Vitals block is 428×175 where it was 428×245). Pips survive on the party board, the live scene and the companion. Nothing is pinned; seven tendine below ROLL — weapons & armour, Experiences, Carried, Cards (vault inside), Rest, Conditions, Lineage — all shut by default and each remembered per character. Since P5-6 the four counters are a 2×2 grid and the incoming-damage box is a fifth cell of the defence band, beside the thresholds it is read against. The trait verbs moved off the tiles onto a 44×44 control at the end of a one-row chip strip, and stay in every chip's accessible name with it shut. The roll modifier row is not drawn at all when nothing is armed and is reached from MODS on the roll bar; when something is armed a strip above ROLL names it. **Whatever is armed is named on the ROLL bar itself in every state**, verdict standing or not, prefixed `NEXT:` once there is a total beside it — that sentence is the warrant for the Experiences being behind a fold at all, and it shipped false until `2802d37`. Since P5-7 the licence notice is the last child of the column, below the lineage fold and outside the budget. |
| **P2-1's open half** | Every iPad can roll again. It was measured at 45 px at 744×1133 and 26 px at 1024×768, with ROLL rendered ~228 px past its clip — in the DOM, invisible, still keyboard-reachable. |
| **Campaigns** (P5-2 foundation) | A `campaigns` object store beside `characters`, with its own `CAMPAIGN_SCHEMA_VERSION`, its own converter chain and its own committed fixture. The GM's state left `localStorage` — where it had been holding **other people's whole character sheets**, written synchronously on every `+1` of Fear. Migrated once, read back before the old key was deleted. `DB_VERSION` went 1 → 2, the first time that branch has ever run. |
| **The GM screen** (P5-2) | The session list *is* the screen. Rows open where they sit and reorder by thumb or by arrow key; the five tools open over the list and are unmounted on close, never hidden; ADD, SHOW and SAVE replace the tab bar and MENU carries the way out, the campaigns and the two tools no row can otherwise open; SAVE says when the last write actually landed instead of implying it is the thing that saves; the section and its two browse tools switch off from Settings and the bar redistributes; and everything the disk did or failed to do — a write that did not land, a tap the saved campaign replaced — is said on the screen it happened on, with a retry only where a retry can do something. |
| **P1-2, P1-6, P3-9, P3-11** | Recall no longer silently marks HP when Stress is full. Cards this build cannot name are drawn instead of counted and hidden. A vault card says why it will not recall instead of hiding it in a `title`. Five buttons are no longer all called USE. |
| **P1-4, P1-5** | School of Knowledge's extra card arrives at level-up. One incoming attack marks **one** Armor Slot, not three — the rule was found on the official GM screen, and the cap is a parameter because "unless an ability says otherwise" is part of the sentence. |
| **P3-5** | The flaky test is fixed at its cause. It was the test's statistics, not the engine: a flat 6 % band is 2.24 σ at the ends of a 2d12 triangle, which predicts the measured 5 % failure rate exactly. Now five standard errors per bucket and a seeded sample. 200 runs, 200 green. |
| **P2-5** | A build that will not evaluate now has a voice, and an ES5 inline hatch that opens IndexedDB and hands the library back without the bundle. |
| **P2-4, P2-6, P3-8, P4-10** | Six overlays that claimed `role="dialog"` now trap and restore focus. Settings says honestly whether this device can open offline, in four states. Every settings hint reaches its control — `aria-describedby` appeared **zero** times in the tree before. |
| **P3-10, then P5-7** | Attribution survives having a character — and, since P5-7, is on **every** screen including Play, as the last thing in that screen's own scroll rather than a fixed strip above the tab bar. `BACKLOG.md` P3-10 is struck at last, with the history of both fixes in one place. |
| **P4-1..5, P4-12, P4-13** | The DPCGL and MIT texts ship and are readable offline; a build id; a CHANGELOG; one Node version. |
| **Rename** (P5-1(b)) | Rename is on the sheet, in the Identity block the rebuild created: a 72×44 chip on the class/subclass row with 51 px of clearance below the header's SETTINGS button, **costing 25 px** of the 457 px scroll window measured at 393×852. The name line itself is still not a target — no role, no `tabIndex`, no handler — because that is what the bullet about a keyboard opening under a thumb actually forbids. The unique-name rule left `duplicateFor`'s body and became one comparison in `merge.ts` with two callers: the *keep-both* copy, and one `RenameField` that both Play and Build's Name field go through. Nothing is written while you type; the sheet writes on SAVE or Return, and Build — which has no ✕ and sits among fields that all write on the keystroke — writes on blur as well, which `rename.test.tsx` pins in both directions. A refusal is a `role="status"` sentence with the field pointing at it through `aria-describedby`, not a greyed SAVE, because `disabled` takes the only control carrying the reason out of the tab order. **Enforced at two doors, not everywhere** — creation and a plain import both still write a colliding name, and `characterFileName` still slugifies two distinguishable names to one file. Those three are `BACKLOG.md` P5-1(c), and `Architecture.md` §7 states the limit rather than claiming an invariant. |
| **Damage rolls** (P1-1) | An attack roll leads into the damage roll it earned, which no screen in this app had ever done — `rollDamage` was correct from the first commit and had no caller outside its tests. Unarmed attacks have a row of their own, drawn even with nothing equipped; Spellcast damage counts its dice off the trait and refuses at +0 in the SRD's own sentence; damage dice can be typed the way the Duality faces already could; and a hidden Difficulty gets the offer labelled IF IT HIT rather than no offer at all. |
| **Rests** (P1-7) | The rest engine has the screen it had no caller for, as a fold in the part of Play that scrolls: pick short or long, pick two moves, and every row says what tapping it clears before you tap it. Nothing is rolled or applied until COMMIT. This is also the first `SCHEMA_VERSION` bump this project has ever taken — 3 → 4, one converter, two new fixtures, and the two v3 fixtures left untouched because they are the proof. |
| **The GM reference** (P5-3) | MENU → OPEN THE REFERENCE, seven topics, every word read out of `data/srd-1.0.json` at render time with the page stamped beside the table it came from rather than at the top of the topic. The Fear guidance and the advancement chart are folded into the two controls they belong to — one drawing, two doors. `engine/encounter.ts::TIER_BENCHMARKS` was deleted rather than wired: the same table ships in the dataset and the typed copy had already deformed two cells. |
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
moved **into** the GM scroll rather than off the screen — 126px of the 653 that
is not shell header, and `tests/ui/attribution.test.tsx` is the gate that says it
may not simply go while `tests/gm/gmShell.test.tsx` says *where* it went. (That
was half the fix, and P5-7 finished it: the `marginTop: auto` that floated it to
the foot of a short list is gone, and the other four screens joined it inside
their own scroll.) And
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

**~~P5-3 — what the GM screen could have at hand.~~ Done** — `65de51a`,
`119816f`, `1f9afcc`, `7f19d78`, `81c1df2`, `246f84b`, `32af6b2`, `ce14170`,
`33cffaa`. MENU → OPEN THE REFERENCE, seven topics, every word read out of
`data/srd-1.0.json` at render time with the page stamped beside the table it
came from. The Fear guidance and the countdown chart are also folded into the
two controls they belong to. Three things the item asked for were not in the
shipped SRD and are corrected in `BACKLOG.md` rather than left to be copied
again: the Difficulty ladder ships as the SRD's own worked example at each
number and **not** as the printed screen's five adjectives, which occur zero
times in the dataset; an incidental scene is **0–1 Fear** and not 1–2, which the
backlog had misquoted; and metres are **the app's arithmetic**, computed from
the feet and labelled on screen as computed, because the SRD prints no metric
column. **The name and place generators do not ship, and no commit will make
them**: the SRD carries no generator of any kind, so building one would mean
copying licensed text out of `Manuali/`. Left open on purpose, in the backlog
with its reason: the ladder is not attached to `DualityRoll.tsx`'s DIFF box,
which is the only place a human sets a Difficulty and is on the player's side.

**Then a verifier read P5-3's diff back and found five sentences the code could
not honour, and they are fixed in `fd799f3`, `4701e9f`, `dbfda63`, `caebbc8` and
`2d19292`.** Worth knowing, because four of the five are one shape and it is a
shape this repo will keep producing: **a component drawn behind two doors
describing the door it did not come through.** `ReferenceTables.tsx` renders
three tables in both the reference screen and a fold beside the control they
belong to, and three of its own sentences — the ones it writes rather than the
ones it quotes — were written for one door only.

- `CountdownChart`'s empty state sent the GM to "the − and + above". On the
  reference screen it is mounted `countdown={null}` and there is no −/+ on the
  page. The sentence is now conditional on the same prop that already decides
  whether a cell is a button or print.
- `FearGuide`'s empty state said "the pool above still works" on a screen with no
  pool. It takes `besidePool` now, the same shape, for nothing else.
- `TierBenchmarks` explained the marked column unconditionally. `benchmarkTable`
  reads the tier off the column header and refuses to guess, so a rules layer
  whose headers carry no number marks nothing — and the paragraph explained a
  mark that was not on the screen.
- the metric legend promised metres "where they give one in feet" over a
  `rangeEntry` that only matched a **span** inside a labelled bullet. The first
  paragraph under that legend is the SRD's own "about 5 feet of fictional space",
  printed bare. **Decided: narrow the legend and then make the narrower promise
  true.** The legend is scoped to the range lines and says outright that prose is
  quoted untouched; `rangeEntry` now reads a lone figure as well as a span, span
  first, because the single-figure pattern run over `20 - 40 feet` matches the
  40. Prose is deliberately not annotated — doing it means either rewriting a
  quoted sentence, which `srdReference.ts` exists never to do, or hanging an
  app-authored ≈ line off a paragraph where nothing says which figure it
  converted.
- and three comments the code had disproved: "three principles out of eight" over
  a seven-subhead section, "the strip is not drawn while there is only one topic"
  over a guard that cannot fire on a seven-element const, and a chip row computed
  at 284px that is 302 because a three-character `.t-label` chip is ~47px and the
  44 of `var(--tap)` is a floor it clears.

The four behavioural fixes carry seven tests between them, each proved by
mutation and named in its commit message; the comment corrections carry none,
because nothing they touch renders and a test of a comment is a test of nothing.

**Then a verifier read P5-5's diff back the same way and found three more —
`2802d37`, `959db01`, `d72f8bf`, with `bd7bc66` writing down what the first one
cost.** All three are the shape this repo keeps producing, and it is worth
naming it a third time: **a sentence in the source that the code does not do.**

- **The ROLL bar stopped naming the armed Experiences the moment a verdict
  stood**, which is every roll of an evening after the first. Roll, arm one for
  the next roll, shut the fold, and the surface read the old verdict and nothing
  else — the next roll silently +2 and a Hope, with only the shut fold's header
  saying so, and that header is below the fold at 375×667. This is not an
  ordinary miss: `PlayPhone` moves the chips behind a fold **on the warrant of**
  "whatever is armed is spelled out in full on the ROLL bar itself", so either
  the sentence was true or the fold was not safe to make. It is true now, and
  what is armed after a roll is prefixed `NEXT:` so a +2 beside a standing total
  cannot read as a total that counted it. The cockpit had the unlabelled half of
  the same thing; both layouts read one expression now.
- **Both roll surfaces announced a Hope that a reaction roll does not give.**
  They indexed `OUTCOME_DETAIL` directly, and that table has no reaction case —
  "You gain a Hope" for every `success-hope`, reaction or not — while
  `rollDuality` returns three zeroes in `effects` and no counter moves. The
  honest reader has been in `dice.ts` since P4 with nothing calling it.
- **Eight comments still argued from the pinned block, the closed modifier row
  or the trait strip**, none of which exist. Every behaviour they justify is
  still right; a warrant citing its own casualty is how a correct thing gets
  deleted by the next reader who checks it.

**Then P5-6 closed the reflow, and the third saving was not worth what it was
costed at** — `379a20a`, `899fbeb`, `fcda966`, plus `4608328`. The owner named
three savings worth ~198px between them, to make the folded sheet fit the 730px
a 393×852 phone leaves. They are worth **150**, and the miss is stated rather
than bought:

- **The four counters are a 2×2 grid**, 194 → 94, worth the 100 it was costed
  at. What it costs is inside the cell: the value target used to stand about
  105px clear of `−` and now stands 4, because 88 of a 172.5px cell is the two
  steppers. Both mistakes that allows are recoverable and neither is silent.
  Pips deliberately did **not** get the grid — a 12-box track in a 172px cell
  wraps under WCAG's 24px floor — so they kept the full width and were the
  dearest thing the budget cannot see, at **+100**: 194 as pips against 94 as
  numbers, measured in Chrome, nothing wrapping at either reference width. This
  file said +149 in two places and so did `Play.tsx` and `Architecture.md`;
  P5-8 corrected all four and turned the arithmetic into an assertion. **Past
  tense since decision 7:** the pip mode is deleted, the assertion with it, and
  the dearest state the budget cannot see is typed dice at +68.
- **The incoming-damage box is the fifth cell of the defence band**, worth 50
  rather than 46: a 44px field fits inside a row the number cells already hold
  open at 58, so the band did not grow at all. `IncomingDamage` came out of
  `Vitals` — the one component on the player's screen that writes Hit Points,
  and it had no surface test until this pass gave it four.
- **The conditions strip went behind its own fold, and that saved nothing.** A
  shut `Disclosure` is 44px plus this column's 8px gap, which is exactly what
  the strip was. It was a better row and not a cheaper one, so the folded sheet
  came out **749 against 730** — 19px over, which is the 52 that did not arrive
  less the 33 the other two overshot by. **P5-8 took the door P5-6 named** and
  the fold is gone: see below.

**And rendering it found a defect three passes of tests could not.** See the
working rule above: the roll surface was the one child of the phone column
without `flex: none`, so at 393×852 it was drawn 33px tall around a 66px ROLL
and the sheet did not scroll at all. If you change this column, open
`preview.html` in a browser and compare what is drawn against what is declared.
Note that the dev server will hand you `index.html` for `/preview.html` until
you unregister the service worker — its shell rules answer the navigation — so
run `navigator.serviceWorker.getRegistrations()` and unregister first, or you
will read the app screen and think the harness is broken.

**Then P5-7 made the licence notice one behaviour instead of three** —
`965d419`. It was a fixed strip above the tab bar on Cards, Build and Settings
(126px of a 393px phone, permanently), floated to the foot of the GM scroll with
`marginTop: auto` (which on a short list costs the same 126), and **absent from
Play**. It is now the last thing in each screen's own scrolling content on all
five. Three things a cold start should know about it:

- **It costs the Play budget nothing and that is asserted, not assumed.** It is
  below the last shut fold, so ROLL's edge and the sheet's total are unchanged
  by it — 385 and 697 when this was written, 306 and 618 after the audit's
  reflow, and the point is that the footer moves neither; the budget test counts
  the column's children and pins the last one as a `<footer>`.
- **`env(safe-area-inset-bottom)` is paid exactly once per screen**, and the
  prop that arranges it is `pinnedBelow` rather than `bottomMost` — each screen
  declares the one fact only it holds ("I have a bar under this scroll"), and
  `LicenceFooter` does the arithmetic once. `GmBar` says it, and so do Build's
  wizard and level-up navs, **which now pay the inset themselves above 720px for
  the first time** — the shell's licence strip used to be underneath them and
  pay it. Nobody has seen any of this on real glass; it is item 7 in *Needs a
  human*.
- **The guard was strengthened rather than adjusted**, and two assertions were
  reversed with their old text quoted in place: `attribution`'s "stays out of
  Play" and `gmShell`'s "is still pinned on Cards". Both were true and
  deliberate when written. Both are the opposite now.

**Then P5-8 closed the last 19px and corrected three numbers the suite could not
see** — `4b3d816`, `039b757`, `93a3e91`. An independent verifier measured the
built screen in Chrome and found four things; all four are closed.

- **The whole folded sheet fits, for the first time: 697 of 730 at 393×852, 33
  to spare.** The conditions are not a permanent row any more — nothing is drawn
  while nothing is on, which is decision 6's shape on a second surface — and the
  door that pays for it is `ConditionsControl`, 44×44 at the end of the
  identity's class row beside RENAME, in a band RENAME already holds open at 44.
  It costs the column zero and it costs the class cell 52 of its width, which
  leaves the fixture's line 111px of slack at 393 and 93 at 375 before it wraps.
  Nothing was shaved. **The rule this could have broken and does not:** the
  moment anything is on — the Vulnerable full Stress derives included — the
  strip is back in its own slot naming it, and the control fills in, counts it
  and reads it out in its accessible name. A condition is a state the GM
  inflicted; the sheet may never be silent about one. Five behavioural
  assertions cover that, each proved by mutation. The desktop cockpit is
  untouched: one `role="group" aria-label="Active conditions"`, one door.
- **`PlayPhone`'s comment above `<DualityRoll>` was 150px stale and its
  conclusion had inverted.** It read "y522-588 … 264 to 330px up from the bottom
  bezel — inside a 95th-percentile right-thumb sweep of about 330px". Measured:
  the ROLL row is y372-438 on the glass, **414 to 480px above the bezel** at
  393×852 and 229-295 at 375×667, and 353px clear of the tab bar. At 414-480 it
  is *outside* the arc the comment cited to say it was inside — so unpinning
  plus the grid moved ROLL further from a one-handed thumb on the larger phone,
  which is a real cost of what was asked for and is now written as one. The
  verdict is written down too: the trade stands, because the column scrolls and
  the reach is the player's to choose at the moment of rolling, while 88px of
  pinned chrome was nobody's. «says where on the glass ROLL is drawn» derives
  all six numbers from the budget table so they cannot go stale again.
- **Pips cost +100, not +149**, and the "144 base" they were computed from
  contradicted `STACK`'s own 2×44 + 6 = 94. Measured in Chrome: 94 as numbers,
  194 as pips, nothing wrapping at either width. The conclusion was wrong in the
  other direction too — with pips ROLL landed at 485 of 545 at 375×667, 60px of
  slack, where `Play.tsx` told the reader pips cost the small phone its margin.
  **Superseded by decision 7**, which deleted the mode rather than re-costing
  it; the corrected number is kept here because the *shape* of that defect — a
  figure carried by four documents that no document had re-measured — is the
  thing worth remembering.
- **Three prose numbers in the budget's own docblock contradicted the assertions
  below them**, all computed against an obsolete `ROLL_BOTTOM` of 435: the
  safe-area bullet's 261/295 and 76/110 (they are 311/345 and 126/160), "went
  from 10px to 110px" against an assertion of 160, and a "~171px cell" that
  matches no width this sheet has.

**The one thing P5-8 did not close, and the reflow closed for it:** a
home-indicator iPhone installed as a PWA pays a 34px
`env(safe-area-inset-bottom)`, which takes the 393×852 column from 730 to 696.
Against P5-8's 697 that was **one pixel over**; against the 618 the sheet
declares now it is 78px of room. Nobody has measured that inset on the owner's
own phone even so; it is item 1 of `AUDIT-HANDOFF.md` §7.

**And a second thing, found by opening the app rather than by measuring it.**
Every figure in this section is computed for a screen with no banner on it. The
shell draws banners above the scroll, and `BackupBanner` is on screen from first
launch until the first backup is taken.

~~`BackupBanner` is **58px**, so the column is 672 and the 697px sheet is 25px
over.~~ — **superseded, and the number was wrong in a way worth naming.** 58 is
the banner's border box; what the screen under it loses is the border box **and
its 8px top margin**, because `<main>` is a flex column and a banner is a
`flex: none` child of it. The cost is **66**, measured banner off → on and
identical at all four iPhone widths: 553→487 at 375×667, 738→672 at 393×852,
760→694 at 402×874, 818→752 at 430×932. On a mouse cockpit the box is 48 and the
column loses 56. Where a sentence takes a third or fourth line it is 70 or 85.

**Both banners at once is 132, and that state was never counted at all.** A new
user with a waiting worker gets the update nag and the backup nag together, and
two stacked 8px margins are exactly the case where adding it up would be wrong
if they collapsed — flex items do not collapse margins, so it is 132 and it was
measured rather than doubled: 738 → 672 → **606** at 393×852, 553 → 487 → 417 at
375×667, 454 → 384 → 299 at 320×568, where the two extra costs are the update
sentence's third and fourth lines.

Against the sheet, net of the phone root's own 8px foot the way this budget
states its column: **one banner leaves 664 and the 618px sheet fits with 46 to
spare; both leave 598 and it is 20px over.** So the at-a-glance sheet now
survives the ordinary new-user state and fails the double-banner one. The
banners are honest and must not be deleted — they are P0-2's remedy — but
neither `Play.tsx`'s table nor `playSheet.test.tsx` knows one exists.
`ShellBanner.tsx` is where the number is measured and `tests/ui/banners.test.tsx`
adds it up out of the declarations so it cannot drift; the budget can take 66
from there.

**P1-1 damage rolls and P1-7 rests are both built.** Both were held back because
they touch `Play.tsx` and `DualityRoll.tsx`, which the Play rebuild was
rewriting; both landed in this pass, in parallel worktrees, and were merged here.

An attack roll now offers the damage roll it earned, unarmed attacks have a row,
Spellcast damage counts its dice off the trait and refuses at +0 in the SRD's own
sentence, and damage dice can be typed the way the Duality dice already could.

What P1-1 deliberately did **not** build, so nobody goes looking for it: extra
damage *dice* — `rollDamage` takes a flat `extraModifier` and the held-dice tray
feeds the attack roll, so the SRD's "Tusks: +1d6" still has nowhere to go — the
`companion` attack source, which needs a second armed slot on Play, and a way
out of an opened die-face grid that is not answering it, **which is still true
of the damage row alone**. `4c99b84` gave the Duality faces a labelled exit and
an Escape key; `DamageRoll`'s typed slots did not take it in the same commit the
way P3-12 asked, so the two gestures have diverged and P3-12 is **half ticked**.
Closing it is a `DamageRoll.tsx` change.

 **P1-7** left four things a cold start needs to know before touching the rest
surface or anything near the schema.

- **The free card swap is proposed, not applied on the tap.** Cards move at no
  cost *because* a rest is happening, so a tap stages a `Swap`, `applySwaps`
  builds the sheet the rest is proposed against, and COMMIT applies the moves
  and the card moves together in one write and one `'rest'` entry. Applied on
  the tap it charged the rest's price before the rest — and COMMIT then cleared
  `kind` and removed the section, so the free swap was reachable exactly while
  no rest existed. `useRecall` no longer takes `downtime`: it is the *scene*
  recall, for the vault shelf and the card browser.

- **`SCHEMA_VERSION` is 4, and `MIGRATIONS` is no longer empty.** There is one
  converter, `from: 3`, and `OLDEST_READABLE` is still 3 because 3 is exactly
  the version of the files already on people's disks. `Architecture.md` §6.1
  now records what the bump cost rather than what it would cost.
- **`tests/fixtures/schema/v3.dhchar` and `v3.dhbackup` are evidence, not
  fixtures to be refreshed.** They were written by the build being superseded
  and their *not* carrying `consecutiveShortRests` is the entire test. Do not
  regenerate them, and do not "tidy them up" by adding the field: the existing
  'keeps the fixture at the version its name claims' test would not catch that,
  because a hand-added field leaves the stamp at 3. A test added with the bump
  does. The `v4.*` pair beside them is this build's own output, committed so
  whoever bumps to 5 has real schema-4 bytes to convert.
- **The count does not ride the QR.** `CODEC_VERSION` stays 2 — the next format
  number would be 3, and `adversarial.test.ts` pins that a single-bit flip of
  the version nibble from 2 can never land on a readable format, which stops
  being true from 3. So a sheet handed over by QR arrives having counted
  nothing, and **no screen may present that number as the history of the
  table**. It is why the fold's summary reads NONE COUNTED rather than READY.

**Smaller, and still open at `HEAD` — none of them was built in this pass.**
Re-measured rather than remembered, because all three are the kind of item a
reader assumes has quietly happened:

- **P2-3(d), typography in `rem`.** Not one type role in `src/ui/tokens.css` is
  in `rem`, so the OS font-size setting still does nothing to this app. Note the
  order it has to happen in: every fixed height containing type becomes a
  `min-height` first, or a user at a 125 % root gets a clipped verdict bar.
- **P4-7(a), `noUnusedLocals` / `noUnusedParameters`.** Still absent from
  `tsconfig.json`. Turning them on today costs **five** errors, not the nine the
  backlog measured — `GearPicker.tsx:85`, `Settings.tsx:39`,
  `tools/simulate.ts:22` and two in tests. The Play rebuild swept its own
  leftovers on the way past; nothing stops the next five arriving unremarked.
- **P4-8, the browser floor.** No `browserslist`, no `@supports` anywhere, eight
  `color-mix()` uses in `src/`, and `base.css:172` is still `height: 100svh`.

All three were blocked on the Play rebuild and are unblocked now.

**Two more the resolution audit opened and deliberately did not close.** Both
are written up in full in `AUDIT-HANDOFF.md` §2a and §2b, and both are here so
that a reader of this file does not conclude the audit closed everything it
found:

- **`--control` is 34px under a finger on a touchscreen laptop.**
  `tokens.css:214` is `@media (max-width: 1179px), (pointer: coarse)`, and
  `pointer` describes the *primary* pointer only — so a touchscreen laptop and
  an iPad in a keyboard case, both `pointer: fine` with `any-pointer: coarse`,
  get 34 at 1180 and up. Measured on the rig's `hybrid` profile at 1280×800 and
  1440×900: `--control` 34, `--pip-h` 44. Every die key in the cockpit's keypad
  and every chip in its modifier shelf is 10px under this project's own 44px
  coarse floor with a finger on the glass. The cockpit lane declined to move it
  and was right to: `--control` gates every chip, nav item and stepper on the GM
  screens too, so the fix wants its own pass with its own measurements of
  `Gm.tsx` and `Build` at `hybrid`, then the query `--pip-h` already uses,
  `(max-width: 1179px), (any-pointer: coarse)`. The old blocker — the roll panel
  was `overflow: hidden` and widening the controls would have crushed them
  against its clip — died at `fbd4884`, and `tokens.css` says so beside
  `--pip-h` rather than leaving the stale reason standing.
- **The six shell-chrome blocks inside `<main>` do not pay the side cutout.**
  `App.tsx:293`, `:328`, `:404`, `:572` and `ShellBanner.tsx:168` are all
  `margin: '8px 20px 0'` while the header 8px above them now insets to
  `calc(20px + env(safe-area-inset-left))`. Measured at 852×393 with 59 on both
  sides, `BackupBanner` renders at [20, 832] and its box is identical with the
  insets at 0 — it does not move, so its first 39px sit under the left strip
  while the bar above it correctly starts at 79. Not a regression (they were
  unpaid before too), one line each, and left out because those lines live in
  two files that want a commit able to test them.

**Deferred past the 1.0 this backlog is aimed at, deliberately:** photos shown to
the table, link rows that open external URLs, full-text rule search. Written into
`BACKLOG.md` P5-2, each with its reason. (The build in hand is `0.2.0`; 1.0 is
the target `BACKLOG.md` is titled after, not something that has shipped.) SEARCH
is the visible one — the wireframe draws four verbs in the GM bar and the plan
ships three — so it is worth knowing that the absence is a decision:
the search a GM does at the table is the Bestiary's filter behind SHOW, and when
there is an index behind SEARCH it goes in as a fourth entry in `GmBar`'s `VERBS`
and the grid redistributes on its own.

## The fastest way to see what is still unwired

`tests/harness/orphans.test.ts` holds `DELIBERATE`, and every entry names the
backlog item that deletes it. It is the honest inventory: **22 exported symbols
nothing in the shipped app reaches** — counted off the list at `HEAD` rather than
remembered, because the figure here once said 43 when the list held 35, and it
is the one number in this file nobody can check by reading it.

Thirteen came off in this pass. Eleven in the same commit that gave the symbol a
caller — P1-1's seven (`rollDamage`, `damageOffer`, `isRollableDamage`,
`sourceFromWeapon`, `sourceName`, `unarmedSource`, `DAMAGE_SIDES`) and P1-7's
four (`takeRest`, `movesFor`, `mustTakeLongRest`, `DOWNTIME_MOVES`) — which is
the mechanism working as designed for the first time on this scale. A twelfth,
`outcomeDetail`, was adopted at `d72f8bf` to fix the bug its absence was
causing: it is the only reader of the outcome table that knows a reaction roll
pays nothing, and both roll surfaces were indexing the raw table and announcing
a Hope the app then did not hand over. The thirteenth,
`TIER_BENCHMARKS`, came off the other way: P5-3 **deleted** it
(`1f9afcc`) rather than wiring it, because the same table ships in
`data/srd-1.0.json` and the typed copy had already lost the `+` from `+1` and
split `Major 7/Severe 12`. Two copies under one SRD stamp is one copy too many.

What is left that is a feature rather than a seam: `reorderLoadout` still has no
control, and `resolvePlaceholders`, `characterRefs` and `missingSlugs` are
P1-6's *healing* half, which is still open even though its *display* half
shipped. **Wiring one of them fails the suite until its line is removed. That is
the intended behaviour.**

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
- **`BACKLOG.md`'s P1 to P4 entries have not been re-adjudicated**, and several
  of them shipped in the nineteen-lane pass without being struck. The table at
  the foot of that file names each one with the commit that closed it, and
  three that are only half closed. Read it before you build anything from that
  band; do not trust an unticked `- [ ]` there on its own.

## What the five documents are for, now that sixteen lanes have edited them

They were written by lanes that could not see one another and then merged, so
each pass reads them end to end against the tree. Where they now overlap they
are meant to, and the division is:

- **`AUDIT-HANDOFF.md`** — newer than this file and authoritative where the two
  disagree. It is the resolution audit: what merged, what each lane deliberately
  did not take, and §7, the list of what only a human with the owner's own iPhone
  and iPad can measure. Read it before this one.
- **`HANDOFF.md`** — this file. State at `HEAD`, the working rules, and what a
  cold start needs before touching anything. Numbers here are measured at the
  moment of writing and are the first thing to distrust.
- **`BACKLOG.md`** — what is still to do, ordered by what it costs a person when
  it goes wrong, plus the record of what closed and why. It is the only one of
  the four that is authoritative about whether something is built.
- **`CHANGELOG.md`** — one `0.2.0` entry, grouped by what a user would notice.
  Not a commit log and not a plan.
- **`Architecture.md`** — the decisions and the shapes, in Italian. §10 is the GM
  section; §6.1 is the schema rule and the one deliberate exception to it; §3.1
  and §3.2 are the boundary between what the engine computes and what it prints.
