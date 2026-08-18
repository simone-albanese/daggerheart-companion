# Phone reflow — handoff, paused mid-build at the owner's request

**Read this, then ASK THE OWNER THE FOUR QUESTIONS IN §5, IN ITALIAN, BEFORE BUILDING ANYTHING.**
They asked for exactly that. Do not resume the build until they have answered.

---

## 1. Where the repository is

`main` is pushed and green. The audit round deployed successfully:
**https://simone-albanese.github.io/daggerheart-companion/** — CI green, Deploy green,
`sw.js` stamped `94fecda`. 2492 tests in 108 files, `tsc` clean, tree clean, 0 unpushed.

**Run the suite on Node 24, not the system Node:**

    PATH="/Users/simonealbanese/Documents/Daggerheart Companion/.tools/node/bin:$PATH" npx vitest run

Under jsdom `localStorage` works on Node 24 (CI, `.nvmrc`) and is `undefined` on Node 26 (this
laptop). A green run on the newer Node is weaker than CI's, and it already cost one red deploy.

## 2. What the owner asked for

They opened the app on their own **iPhone Pro, in a Safari tab**, and said:

> «puoi spaziare e usare meglio lo spazio?»

Given three directions they chose **"troppo spazio sprecato"** and added:

> «La 1, testo leggermente più grande sfruttando meglio lo spazio pensando sempre a livello
> ergonomico»

Asked Safari tab or installed: **"per entrambi"**.

Three terms, and the third is what binds: larger type costs height, so it must pay for itself out
of the reclaimed waste, in **both** columns.

## 3. What was measured — the part worth keeping

**The columns, and both figures were wrong in the documents before this.**

| Context | Column | How |
|---|---|---|
| Installed, no home indicator | **730** | measured; `Play.tsx`'s budget was right for this case only |
| **Installed, home-indicator iPhone** | **696** | measured — `TabBar` pays `env(safe-area-inset-bottom)`, 34px |
| **Safari tab, default iOS 26 bottom layout** | **536** | `100svh` = 658 on an iPhone 16 Pro, less header 53, tab bar 61, foot 8 |
| Safari, Top layout | 546 | same method |
| Safari, Compact layout | 596 | same method |

**So the folded sheet (618) is 82px OVER in a Safari tab today.** The owner's complaint was not
"it wastes space" — it does not fit at all. Tell them that; it reframes the whole request.

**Where the waste actually is — not where either of us guessed:**

| Block | Declared | Ink | Wasted |
|---|---|---|---|
| **Six fold headers** | 44 each | **10** | **34 × 6 = 204** |
| ROLL row | 66 | 31 | 35 |
| The nine 8px column gaps | 72 | 0 | 72 |

The owner pointed at the counters and the ROLL block. ROLL was confirmed — the measurer wrote
"THE OWNER IS RIGHT AND THIS IS THE WORST BLOCK ON THE SHEET". The counters were **not** the main
waste. The fold headers are, and nobody had looked at them.

**One number nobody could close, stated rather than invented:** `env(safe-area-inset-bottom)` in an
iOS **Safari tab**. An Apple forum thread reports 21px with the bottom toolbar visible. If true the
Safari column is **515**, not 536. Only somebody holding the phone can read it.

## 4. The plan that was chosen, and how far it got

Judge took proposal 1's spine, corrected on ROLL, with a surgical graft from proposal 3.
**618 → 438.** Safari: 438 against 536, 98 spare. Binding case (folded + a companion): 488, fits by
48. Headline type raise: **counter value 22 → 26px**, plus eight steppers 44×44 → 48×48.

Nine steps. **Three landed, the fourth was in flight when the owner paused it.**

Worktree `~/Documents/dh-wt3/reflow2`, branch **`a3-reflow2`**, cut from `main`:

    eb142a6  Bring the trait chip down to the floor and its number up      (step 3, -14)
    8a179f0  Take eight pixels of padding out of the phone's defence band  (step 2,  -8)
    8def497  Give ROLL back the ten pixels its own content does not want   (step 1, -10)

**Uncommitted step 4** (the counter raise, `--counter-num` gains a third step, +8): saved to
`analysis/reflow2-step4-WIP.patch`, 446 lines, touching `Counter.tsx`, `tokens.css`, `Vitals.tsx`,
`tests/ui/stylesheets.test.ts`. `tsc` was clean at the pause. The patch is also still sitting in the
worktree as unstaged changes.

Steps not started: 5 (fold summaries 10→11px), 6 (companion strip as a rule not a box),
**7 (Lineage & domains leaves the Play column, −52)**, **8 (fold headers paired 2-up, −104)**,
9 (severable, zero-px, Vitals cockpit sum).

The full inventory, the three proposals and the judge's plan with its whole budget are in the
workflow journal:
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/4f27ec59-595d-4c28-8dc0-1b7adee07e7c/subagents/workflows/wf_9b24d4ec-36b/journal.jsonl`
(run id `wf_9b24d4ec-36b`; script at `.../workflows/scripts/dh-phone-space-wf_9b24d4ec-36b.js`).
Resuming that workflow with `resumeFromRunId` replays measure/propose/judge from cache.

## 5. THE FOUR QUESTIONS TO ASK, IN ITALIAN, BEFORE RESUMING

Two of the nine steps are product decisions wearing pixel clothing, and the judge said so itself.
Ask with `AskUserQuestion`, in Italian, one screen:

1. **Passo 7 — «Lineage & domains» esce dalla colonna Play (−52px).** Togliere contenuto da una
   schermata non è spaziatura. Tenerlo o toglierlo?
2. **Passo 8 — intestazioni delle tendine appaiate a due a due sul telefono (−104px).** Due coppie,
   non sei. Cambia *cosa vedi*, non solo quanto spazio prende. È il singolo risparmio più grande del
   piano; senza di esso il caso Safari con un compagno si stringe parecchio.
3. **Quanto più grande.** Il rialzo scelto è il valore dei contatori 22 → 26 e gli stepper 44 → 48.
   Basta, o vogliono di più (e quindi meno margine), o meno?
4. **`env(safe-area-inset-bottom)` in una scheda Safari.** Chiedere se possono leggerlo sul loro
   telefono, perché è l'unica cifra ereditata invece che misurata e sposta la colonna da 536 a 515.

## 6. Rules that still apply to whoever builds this

- Floor **44px coarse / 34px fine** (`--control`/`--tap`), never WCAG 2.5.8.
- The Play screen scrolls; what must not happen is a control at 0px or off the glass silently.
- Licence notice last in the scroll; `env(safe-area-inset-bottom)` paid exactly once,
  spelled `calc(0px + env(...))` so jsdom keeps it.
- **ROLL must not drift up out of the thumb's arc.** The chosen plan lifts it 24px and that was a
  deciding factor against the other two proposals. There is a **contested reach figure**: whether a
  Safari tab's bottom toolbar counts as ~130px of glass below the viewport. Two proposals used
  opposite conventions and nobody measured it. One line from the owner settles it.
- Six docblocks become false on landing and all six are named in the judge's plan, `PlayPhone`'s
  budget first. A docblock the code disproves is a defect here.
- Every test must fail against the pre-fix code; mutate and say which mutation it kills.
- Never `git add -A` — `node_modules` and `Manuali` are symlinks in that worktree.
