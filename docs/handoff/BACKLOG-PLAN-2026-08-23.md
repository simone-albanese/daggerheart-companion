# Piano di applicazione di `BACKLOG.md` — 23 agosto 2026 (`wf_6a80a4c1-7a8`)

> Prodotto da 24 agenti in **sola lettura** sul branch `beast-sheets` @ `c88bd21`.
> **Nessuna modifica e' stata applicata**: `BACKLOG.md` e' ancora intatto. Questo e'
> materiale da eseguire con l'approvazione del proprietario, non un verdetto applicato.

**Il giro di confutazione che mancava e' stato fatto.** Le 10 voci `[NON verificato]`
dell'audit del 19 agosto hanno finalmente avuto il loro scettico:

- giudicate spuntabili: `:975`, `:651`, `:654`, `:686`, `:751`, `:2459`, `:2840`
- restano aperte: `:646`, `:2462`, `:2467`

**Nessuno dei 30 verdetti `[retto]` e' scaduto.** L'albero si e' mosso due volte dal 19
agosto (0.5.0 e questo branch) e nessuno di quei verdetti e' caduto: `verdictsThatMoved`
e' vuoto.

Attenzione: la lista `stayOpen` qui sopra e' piu' grossolana del piano. Per `:2459`,
`:2462` e `:2467` il piano raccomanda uno **split** — spuntare la meta' fatta e aprire una
voce sola per la sezione compagno del foglio stampato — non di lasciarle aperte cosi' come
sono.

Il journal completo, con il valore di ritorno di ogni agente, e':
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/b9563823-72a2-4816-be80-b8e823d1a7e4/subagents/workflows/wf_6a80a4c1-7a8/journal.jsonl`

---

# THE PLAN — 23 August 2026

Written from `beast-sheets` @ `c88bd21`, read-only. Everything below is a decision plus the reason; the evidence is in the lane reports and is cited, not repeated.

---

## 0. Two decisions that gate everything else

**0.1 — Land `beast-sheets` on `main` before touching `BACKLOG.md`.** The backlog is a document about the shipped app. Three of the new bullets below (the printed companion, the companion attack field, the companion Evasion caption) describe code that exists only on 13 unmerged commits carrying a `SCHEMA_VERSION` 4→5 converter. Writing them as open items against `main` makes the file lie in the new direction while we are fixing it lying in the old one. If the merge is not imminent, every bullet marked **(bs)** below must carry the words *"branch `beast-sheets`, unmerged"* in its text.

**0.2 — The edit pass is one commit, and it ships before any code.** ~90 minutes. It removes 13 false "open" rows and adds 7 true ones. Doing it after the next feature means re-deriving all of this against a tree that has moved a third time.

---

## 1. THE `BACKLOG.md` EDIT LIST

### 1a. Certain — apply as written, no owner input

| Line | Action | Becomes | Authority |
|---|---|---|---|
| `:975` | **close as expired, not `[x]` with a sha** | struck, with *"closed as expired — nothing was built for this bullet; its premise left"* | `Play.tsx:3475-3479`; `playSheet.test.tsx:475-488` fails if *any* element on Play is `fixed`/`sticky` — 132/132 green on Node 24 |
| `:953-973` | **strike with it** — the P2-4 table and its two lead paragraphs | struck as expired | They assert in the present tense that Play "keeps two things out of the scroll", that "all four tracks are pinned", and print a 288/188/88 table. The source contradicts every clause. A correct closure that leaves false prose standing is the failure mode this whole audit exists to avoid. |
| `:651` | `[x] done, 5ed3def` | + the note that the fix branches on `stressCost === 0`, not on `downtime`, **and why that is right** (no path into `useRecall` carries `downtime`; `Rest.tsx:464` writes the downtime sentence where it is earned) | verbatim sweep clean; pinned at `playSheet.test.tsx:2877`, `cards.test.tsx:138` |
| `:654` | `[x]`, marker only | body below it is already the citation that settles it; append the "verified against the moved tree" paragraph | cap in **both** `applyDamage` and `markDamage` (`damage.ts:186,198,240`); one caller in all of `src/`; 54 + 132 green |
| `:686` | `[x]` **with a correction, not a bare tick** | HP half done `941f312`; **Stress half is premise-false — there is no per-class Stress in the game**; it was **four** of nine, not six | `shared/types.ts:161` has `startingHitPoints` alone; SRD prints nine STARTING HIT POINTS lines and no STARTING STRESS line |
| `:751` | `[x] done, 3076dac · f33a14b` | second branch of the disjunction taken; move the `Architecture.md:477-478` and `CHANGELOG.md:970` corrections **onto `:748`**, where the wrong trigger has to be fixed anyway | `codex.test.tsx:230-303` sweeps every file in `src/` for the promise and fails the build if it returns |
| `:2840` | **reword — take the checkbox off** | a paragraph, not a `- [ ]` | It names no change and no file. An unticked box advertises work that does not exist (it has now consumed a lane in the 19 Aug audit *and* a skeptic run today); a bare `[x]` reads as "the duplication was addressed", the exact opposite of what it says. Also drop "about two thousand pixels" — unmeasured — and quote `Settings.tsx:229`, which states the location correctly, rather than `About.tsx:327`, which does not. |
| `:3054` | `[x] done, 4bdf694` | link arm draws lists and tables through `ruleSection`/`BlockView` | `SessionBody.tsx:125,128,550,563`; 73 green. **Cite narrowly:** `paragraphs` still has ten call sites in shipped source — the true claim is only that the session link arm no longer calls it. |
| `:3056` | **reword, do not tick** | as `BACKLOG-AUDIT-2026-08-19.md:138-139` already instructs | — |

**Splits — tick one half, open the other. All certain.**

| Line | Ticked half | New open bullet |
|---|---|---|
| `:1653` | ScreenBoundary, `3dc3d82`/`ac54a8d`/`69ac8b5` — struck **around** `AppBoundary.tsx`, not through it, with the grep that proves the quoted sentence moved rather than went away | **(i)** `AppBoundary.tsx:60-62` still hands the component stack to `console.error` under the verbatim sentence and renders `{error.message}` alone. **(ii)** the crash report names a version and cannot name a build (`report()` stamps `APP_VERSION`; `BUILD_ID` reaches only `About.tsx`). Correct the entry's own arithmetic: three `console.*` in `src/`, not two. |
| `:646` | engine half, `97fd2d9` — `unresolvedArmor` exists, `armorScore` is no longer 0, that clause of the sentence is dead | **three read surfaces still print the fallback as fact** — `sheetModel.ts:346-349,360,463` + `CharacterSheet.tsx:133-143,213-215`; `Edit.tsx:104,219-224`; `LevelUp.tsx:326-333`. Plus correct `PartyBoard.tsx:694`. |
| `:2459` | the field-by-field comparison, `b64a52e` — the commit message *is* the report; nothing named differently; re-verified against `bf3b6a2` which renamed no field | folded into the merged companion item below |
| `:2462` | the no-artwork constraint **and** the character sheet's information architecture — `sheet.css:35-39` is five inks and hairlines, `marks.tsx` uses this app's own polygons, `public/brand/*` never reaches the page | folded into the merged companion item, **plus** a standalone one-liner: correct the false sentence at `CharacterSheet.tsx:362` ("where the paper sheet's own reading order puts it" — no paper puts it anywhere) |
| `:2467` | all eight specifics, `b64a52e`, each pinned by a named test — **and correct "filled" to "outlined" in the struck text**, because `printSheet.test.ts:323` asserts `not.toContain('fill="black"')` on purpose and someone will otherwise reopen this over one stale word | folded into the merged companion item |

**Merge decision (mine, and I'd defend it):** `:2459`, `:2462` and `:2467` each independently produced the same finding — the printed companion section has never been held against the official companion sheet. Three bullets saying that is three bullets that will be closed by one afternoon's work and then disagree about whether they were closed. **Write it once**, cite all three ancestors, and put the four concrete deviations in it.

I resolved the citation the three lanes disagreed on. It is **page 10 of `Manuali/Character-Sheets-and-Guides-Daggerheart-May212025.pdf`** (extracted and paged directly; the "page 4" reading is wrong, the "folio 16" reading is the SRD, a different document). Its order and its four gaps, confirmed by extraction:

- top row is **COMPANION NAME** beside **evasion / "Start at 10"** — the app prints `Evasion 10` bare (`CharacterSheet.tsx:372-375`), with none of the derivation note the character's own Evasion carries, and the number moves (*Aware: +2 permanent*);
- **companion Experience comes before Attack & damage**; the app transposes them;
- *"Give them a name and draw or attach a picture of them in the space above"* — absent, and always will be, since this app holds no images. **Say so on the page rather than leaving it silent**;
- *"describe their method of dealing damage (their standard attack) and record it in the 'Attack & Damage' section"* — `CompanionState` (`shared/types.ts:386-407`) has no field for it, so the page prints `Attack — melee, physical` with the attack unnamed.

**Three brand-new bullets, all certain:**

1. **The shipped rules text drops the whole Equipment chapter.** `data/srd-1.0.json`'s 80 `rules` sections contain no Equipment/Weapons/Armor/Inventory; `"REDUCING INCOMING DAMAGE"`, `"mark one Armor Slot"`, `"While unarmored"` and `"Armor Score of 0"` all return zero. The engine enforces two rules whose text the app cannot show and `RuleSearch` cannot find — which is the *only* reason `damage.ts:43-54` forbids citing them. Extend the parser; then lift the ban through `ruleText.ts`'s existing find-by-sentence pattern. *(small)*
2. **The stale-prose sweep.** The dataset went 75→80 sections and 38→42 lists on `beast-sheets`, and four spelled-out counts were missed: `srdReference.ts:993` (also `"131,127 bytes"`, ~7% under, the figure the no-index decision at `:3093` rests on — conclusion unaffected, number not), `RuleSearch.tsx:12`, `ReferenceTables.tsx:11`, `tests/gm/ruleSearch.test.tsx:193`. Same pass: `:1942`'s anchors (`Wizard.tsx:583` → `:762`), `:3130`'s anchor (`campaigns.ts:89-98` → `:155-180`), `:646`'s anchor (`character.ts:147-157` → `:256-302`), `:2840`/`:1653`'s console arithmetic, and `GmSheet.tsx:14-15`'s *"eight of them now"* (it is seven, and that docblock has already been wrong about its own count twice — **write it without a count**). *(trivial, but it is what stops the file lying)*
3. **`:2181`'s trailing paragraph is now false.** It argues that "inventing a second, quieter shell-level alert for the GM store is how two banners end up disagreeing" — and `bfdc0d8` went and built exactly that, with a `!gmOnScreen` mutual exclusion instead of two disagreeing banners. The verdict is done; the prose beside it needs one sentence.

### 1b. The 30 upheld verdicts

**All 30 hold.** No re-verification is owed. Two carry a caveat the owner should read once and not re-derive:

- **`:1797`** — every reach figure in its SUPERSEDED block was measured on `main`, and `beast-sheets` adds height *inside* the first fold (a Beastform attack button, a seal line on each weapon row and on `SpellcastPanel`). The block already documents its numbers as historical, so the verdict is untouched; but nobody should quote those numbers about this tree.
- **`:1834`** — verdict is reinforced (the branch added two more `<Track>` families a deleted preference could not reach), but its *stated reason* — "there you are reading someone else's state rather than marking your own" — is weaker now that the companion's Stress is marked from the player's own Play screen and its attack is armable there. Not a reopening. Worth one sentence when that row is next touched.

`:2348`, `:3054`, `:3076`, `:3093`, `:3094` all rest on assertions about the shipped dataset, which the branch **changed**. All were re-run on the enlarged file and all pass. That is the one class where "the tree moved" could have broken a verdict without any code moving, and it did not.

### 1c. Needs the owner before anything is written

1. **`:2840`'s shape** — checkbox removed (my recommendation) or `[x]` with a *"recorded, nothing to do"* suffix. Either ends the loop; the bare `[x]` must not happen.
2. **The companion attack field** — a `CompanionState` field + editor + schema change, or a deliberate blank ruled line the way Inventory weapons already get one. The blank is the cheaper honest answer and I'd take it; it is the owner's, because `b64a52e` set the precedent for refusing exactly this scope creep on the print lane.
3. **③'s remainder** — see §3.
4. **The `BROWSE` contradiction.** `DECISIONI-2026-08-18.md:153` and `HANDOFF-2026-08-18.md:1008,1200` record that the owner chose BROWSE and that its precondition is met on `main`; `BACKLOG.md` ② still reads *"Choose a name that is not LOOK UP"*. One of the two is stale, and it is load-bearing for Layout B stage 2 (a 114-occurrence rename).
5. **③'s framing** — `BACKLOG.md:3043` says "11.6 h, and NOT approved"; `HANDOFF-2026-08-18.md:834` records `B3 = a`. Chronology corrected: `1a89fa2` (16:35) is **not** an ancestor of `4bdf694` (16:49) — the estimate was written while a parallel lane was closing it, not before.

**Not filed, recorded so it is not filed a third time:** the duplicate `APP_VERSION` (`fileIo.ts:49` hand-typed vs `buildInfo.ts:31` compiled from `package.json`). `tests/transfer/fileIo.test.ts` pins it to `package.json` and the pin has already survived a release unaided (0.3.0 → 0.5.0). The hazard has a working guard.

---

## 2. THE WORK, IN ORDER OF VALUE AT A TABLE

**#1 — The printed sheet lies about armor.** (`:646` remainder.) A player with an armor ref this build cannot name prints a page that says **"Level 5 is already added to both"** over 5/10 when the sheet it came from reads 16/29, and **"Nothing worn."** beside an Armor cell reading 4 with four pips. Paper is the one artefact in this app that cannot be tapped to check, and this is the only place where the app doesn't merely omit a caveat — it asserts a false derivation. The state is reachable *by design* (`state.ts:797-802` deliberately keeps such a sheet unsynced so its numbers survive). The branch to display already exists; this is three read surfaces and a sentence. **Pin it** — no test anywhere builds a sheet with an unresolvable armor ref, which is exactly why an audit missed it. *(small)*

**#2 — `AppBoundary` gives one line of text and no way to convey it.** (`:1653` open half.) This is the boundary a **white page** actually reaches — mounted at `App.tsx:106-108` above `useStats()`, the Header, the TabBar, `CardReader` and five banners. `ScreenBoundary` only ever catches a screen that failed while the shell kept drawing. The three pieces already exist one file over (`stack` in state, `report()`, `copyText`) — **lift them into something both boundaries call**, because `copyText` having exactly one import site in `src/` is precisely what made this look finished. The rescue half of that fallback is already right and must survive: `role="alert"`, **Export everything** unconditional, **Try again**. Then one import and one line for the build id, because an app that holds its bundle in Cache Storage serves `0.5.0` across several deploys while `deploy.yml:94-95` fails a deploy outright when the build id is missing. *(small–medium)*

**#3 — The damage roll cannot spend a die.** (§E.) A Bard, a Seraph and a Slayer do this arithmetic in their head every fight. `usePools` has **two consumers and neither is a roll control** — the pools are read by no roll in this app. Design **C**, and the finding that makes it cheap:

> **Every one of the four features adds a *result* to the *total*, never a die to the pool.** "adding the result to their damage roll", "adding their result to the roll", "add to a roll's result", "add the current value". `BACKLOG.md:517-522` and `Architecture.md:306-310` record this item as blocked on unbuilt "extra damage dice" — **it is not blocked.** That facility is what Sharp, Sneak Attack and the venoms need; this needs a number added to a total.

Shape: one control inside `DamageRoll.tsx` (keep it there — `rollAffordance.test.ts:106-153` reads `DualityRoll.tsx` *as text* and counts `<Die` occurrences), drawn only when this character actually holds something, armed before ROLL **or** added after via the recompute-from-fixed-faces path `setFace` already uses — which is why Prayer's *"after the roll is made"* costs nothing extra and the base dice are not re-rolled. Engine: `extras: {label,value}[]`, summed into total; `criticalBonus` stays `dice.count * dice.sides`; **`spec` stays `formatDamage(dice)`** — folding an extra into `modifier` prints a `2d8+2` weapon as `2d8+7` and launders the addition into the weapon's own spec. Then `damageArithmetic` prints `+5 (Slayer d6)`, the idiom `DualityRoll.tsx:849` already uses.

Four rules the app must offer and not enforce: whether a tray die is legal here at all (the tray is amnesiac **by design** and holds three incompatible kinds — an ally's Rally d6 that may be added, a Help an Ally d6 that may not, an Unstoppable die that is a standing value; print the caution, do not filter, do not guess); whether the attack hit when `succeeded` is `null` (add the number, **do not consume the die**); whether an added die's max counts toward a critical (default no, stated, not enforced); whether Rally/Slayer must be declared before the roll (STEP 3) or may be added after (Prayer's own words). Roll pool dice through `rollPool`, not a bare rng, so `dropLowest` stays in one place. `damageRow.test.tsx:104`'s `buttons()).toHaveLength(1)` **must keep passing untouched** — the fixture is a Bard, i.e. a character *with* a pool, so that assertion is the proof the control costs nothing to someone holding nothing. *(engine ~15 lines + tests; `attack.ts` two functions; `DamageRoll.tsx` ~60–80 lines)*

**#4 — Layout B.** §2 below. Mid-scene lookup, five taps to three.

**#5 — The printed companion section against page 10.** The merged item. Do it the way `b64a52e` did the character sheet: read, report, then change.

**#6 — The document pass** (§1) and **#7 — the Equipment chapter parser**, both small, both any time.

---

## 3. LAYOUT B — BUILD ORDER

Spine is **Design C**: it is the only one that supplies a rule for what a tab is *for* — THE NIGHT is everything this evening changes, REFERENCE is everything that is identical next Tuesday — and therefore the only one that still answers bestiary, merchant and names after this build. A and B design the switch; C designs the tabs.

**Decisions where the three conflicted, and why:**

- **`GmRegion` is not narrowed.** *(A.)* B and C both narrow it and both then have to extend a licence in `shared/campaigns.ts:326-380` that is argued three times over, explicitly, for **widenings** — and B's stated reason for narrowing does not survive reading the docblock it cites (`REGION_KEYS` at `:384-398` is about a union value missing from the list typechecking silently, a compiler problem, not a UI-reachability one). Keep `'reference'` in the union, delete only the render branch, map the value in `openTool` and the follow-effect. `TOOL_LABEL` becomes `Record<Exclude<GmRegion,'reference'>, string>` — the pattern `SHEET_LABEL` uses one declaration below it. This is the single largest reduction in the plan.
- **The strip is `aria-current="true"`.** *(Neither design.)* Not `aria-pressed` — these are destinations, not toggles, the mislabel `GmBar.tsx:8-11` spends a paragraph refusing. Not `role="tablist"` — it obliges a roving tabindex and arrow-key handling that exists nowhere in this codebase, for two buttons on a phone whose users have no keyboard at the table. The house already has a third idiom for "which of several places within a screen you are looking at": `MenuSheet.tsx:449`, `Bestiary.tsx:287`, `AdversaryList.tsx:149`, `Settings.tsx:147`. `aria-current="page"` stays reserved for real screens.
- **The rules search stays behind SHOW in this build.** *(A and B, over C.)* Moving it falsifies five paragraphs of `ShowSheet.tsx:57-98`, a user-facing sentence printed at `Settings.tsx:555`, and — the disqualifier — turns `ruleSearch.test.tsx:393` into **a test that cannot fail rather than one that fails**, which is the defect class this repo audits for. Remedy: one line of text at the foot of the REFERENCE scroll saying where the search is. No new control.
- **Bestiary, merchant and names do not move.** Stage 2; it retires SHOW and re-opens the 114-occurrence rename.
- **`GmBar` is identical on both tabs** — the bottom 95px of glass never changes, so the switch costs no relearning. ADD from REFERENCE jumps back to THE NIGHT on successful submit (verified safe: `onClose` reaches `AddSheet` only as `<Chosen onDone={onClose} />` and all six forms call it after a write).
- **No new component and no new headings for `:3077`'s panels.** ④'s own heading says "surface not content"; decision 2 of 19 Aug put the last missing piece in as the eighth `REFERENCE_TOPICS` chip. The REFERENCE tab **is** the surface ④ was waiting for. Building panel-shaped blocks means panel *headings* out of `pdftotext`, which is a licence defect caught once already. **For the audit half: after this build, ④'s "layout is undecided and needs pixels" clause is dead.**

**The order.** *(Commit 1 is steps 1–3 together — a commit that adds the tab without removing MENU's button ships two doors to one destination; one that removes the button first strands the reference.)*

1. **`src/ui/gm/GmTabs.tsx`** (new). Two buttons, `grid` `repeat(2,1fr)`, full-bleed, `flex:'none'`, `minHeight:'var(--tap)'` — **never `--control`**, which is 34px and itself gated. Selected marked three ways: `aria-current="true"`, weight 700 vs 600, 2px bottom rule. Labels `THE NIGHT` / `REFERENCE`, `.t-label`, no glyphs. Export `GmTab` here, mirroring `GmBar.tsx`'s `GmSheetId`. Docblock states why the top and not the arc, why `aria-current`, and **that it pays no horizontal safe-area inset for the same reason `GmBar` does not — it joins item 19 / `:3309`'s list behind H-9 rather than claiming an exemption.**
2. **`Gm.tsx`.** `useState<GmTab>('night')`; strip after `NotSaved`/`ReplacedOnLoad`, before the region; delete the `tool === 'reference'` branch at `:285`; `Exclude` at `:123`; `'reference' → setTab` guard in both `openTool` and the follow-effect; `TOOL_TAB` (one line, and the line stage 2 needs); `AddSheet`'s `onClose` becomes `() => { setTab('night'); closeSheet(); }`. Rewrite the head docblock — its opening argument is "the session list *is* the screen" and it is now one of two — and **fold `:3027`'s "five over four" correction into the same pass**, because two passes over one paragraph is how the last sweep went 11 → 8 → 13.
3. **`MenuSheet.tsx`.** Delete the THE RULES AT HAND block (`:343-346`); six blocks → five; `:139`'s ergonomics row (`363×44`) is **load-bearing for the campaign-row arithmetic** and needs a surviving witness or an explicit retirement note; `:179-180` is now false. **`whereTheOthersAre` is untouched — verified, it names Fear and the SHOW doors only — and the commit should say so**, so a reviewer does not go looking.
4. **`Reference.tsx`.** Add `<LicenceFooter pinnedBelow />` as the last child of the scroll. Rewrite `## Why it opens from MENU` (do not delete — it holds the argument that chose B). The whole `## Ergonomics, 393×852` section retires at once. **Re-measure; do not patch by subtraction.**
5. **`SessionList.tsx`.** No code change. `## Scroll` moves wholesale, including the pinned-countdown case dropping from eight rows to **seven**. Re-measure.
6. **`GmSheet.tsx`, `GmBar.tsx`, `GmTopBar.tsx`, `ShowSheet.tsx`** — docblocks only.
7. **`Settings.tsx:555`** — a **printed** sentence, "the reference behind MENU does not", must change; the `gmSection` hint gains the reference.
8. **Tests.** `reference.test.tsx`: `describe('the way in')` rewritten, `openReference()` presses a tab, `:234` retires, `:241` **inverts** to assert the region is *not* written. `gmGeometryProse.test.ts`: `:565`/`:583` lose their premise; the "2px wider" invariant becomes **0** and needs a replacement invariant or the next sweep will "correct" the wrong one; **`sheetBorder()` at `:380-385` must be re-anchored on `Names.tsx` or `Merchant.tsx`** — tools still inside the sheet — or it keeps passing on a reason that has become false (the sharpest single catch in any of the three designs). Retired figures go into the scan **in double quotes, not deleted**. Verify `sessionDrag.test.tsx` rather than assuming (it works on a delta, so it should be fine).
9. **Docs.** `Architecture.md`, `README.md:118`, `reflow-handoff.md:187-188`. Grep separately for `MENU`, `Reference`, `behind`; the list will be short by two or three, because it always is.

**Two hazards to have in hand before step 1:** `attribution.test.tsx:300` mounts the GM screen in its default state, so **a REFERENCE tab with no licence notice ships green**; and `:313-315` asserts exactly one `<footer>`, which **forces mount/unmount rather than `display:none`**.

**Corrected before you start:** Design A's claim that the strip "eats the 50px of slack under the eighth row" is wrong unpinned — `SessionList.tsx:50-56` puts the eighth row's end at 752.00 inside a 757.00 fold. Use B and C's arithmetic, which agree. And A's hedge on the 369 column is over-cautious: `SessionList.tsx:81` already records 369 measured for a region outside the sheet with the same padding. The prior is strong. Measure anyway.

**Owner's, before or during:** the rules search; stage 2; **the party board's tab** (C puts it on THE NIGHT because tonight changes it; "read rather than pressed" puts it on REFERENCE; nobody has watched a GM use it — this is the one I'd put to you directly); desktop at 1180+ (side-by-side instead of tabbed is a redecision of §5.1 none of the three took, and REFERENCE may want `SessionList`'s 820 cap now that the 1100 sheet cap is going); whether the tab is remembered across leaving the GM screen (all three say no, I agree, one line to reverse); and **the reading area REFERENCE loses** — 609px of body inside `GmSheet size="full"`, ~359 as a tab. That is the honest price of a tab over an overlay and belongs in the docblock rather than being discovered.

---

## 4. THE TWO SMALLER ITEMS

### 4a. Item ③ — "tips in English, GM side"

**10.4 h → 0 h + (2 to 6) h.**

**Half (a), tips on the rules: 0 h, and it is not buildable as written.** A "tip on a rule" that is not an SRD quotation is the app writing a rule, which this project forbids itself (`src/engine/rest.ts:35-99` is the standing example of the violation; ④ refuses the metric column on the same grounds). Everything that *is* quotation is already on the GM side three ways over: eight curated topics with bespoke renderers, all 80 sections searchable from the foot of SHOW (request ⑤, shipped, `878429c`), the five GM-chapter folds, Fear guidance under the Fear board, the advancement chart under a countdown. The 11.6 h rested on the SRD sections being unreachable, and that premise was already false when it was written.

**Half (b), tips on the app: 2–6 h.** ~15 explainable subjects, most of which already say what they do in place — the empty states carry instructional copy on purpose (`SessionList.tsx:161`, `Scene.tsx:99`, `PartyBoard.tsx:108`). A real help panel behind MENU: component 1–1.5 h (`Fold` + `BlockView` exist), copy at this project's prose standard 2–3 h, a test that reddens when a named screen or verb disappears ~1 h, Chrome at 393 ~0.5 h, docs ~0.5 h → **≈5–6 h**. Tightening what exists instead → **≈2 h**.

**Sequencing:** (b) waits for Layout B, which re-shapes the surface it would sit on. Building it first means placing it twice. H-9 does not gate it.

**The question for the owner, stated plainly:** does the GM side get a written help surface — what SHOW's three doors are, how a LINK row differs from a URL row, that campaigns live only on this device — or do the empty states and MENU labels already do that job where each thing stands? Five hours after Layout B, two hours now, or ③ closes. **`B3 = a` is not the answer to this** — it approved a 10.4 h figure that included the rules half, and that half is gone.

### 4b. The damage roll — see §2 #3. Scoped there in full.

---

## 5. BLOCKED, AND ON WHOM

| Blocked | On | Note |
|---|---|---|
| The three new print-companion / companion-attack bullets | **the `beast-sheets` merge** | they are false of `main` until it lands (§0.1) |
| Layout B steps 4 and 5 | **Chrome** | every figure in two docblock sections retires at once and must be re-measured, not subtracted |
| `GmTabs`' horizontal safe-area inset | **H-9 / `:3309`** | joins that list; does not gate the build |
| Layout B stage 2 | **owner** — and on the BROWSE/② contradiction being resolved first, since it is a 114-occurrence rename |
| ③ half (b) | **Layout B**, then owner | placing it before Layout B means placing it twice |
| The companion attack line on paper | **owner** — new `CompanionState` field vs a deliberate blank ruled line |
| Lifting `damage.ts:43-54`'s citation ban | **the Equipment-chapter parser** (new item 1) |
| `:2840`, `:2467`'s "filled" word, `:3056` | **owner** — wording only, but all three are ways a correct closure gets reopened by the next reader |

Nothing is blocked on a test run. Everything cited above was verified on the repo's own Node 24.19.0, not the system 26.

---

## 6. WHAT ONLY A BROWSER CAN SETTLE

Nothing in this list is settled, and none of these numbers may be quoted as measured. jsdom measures nothing. The rig is at `~/.claude/projects/.../audit-harness/cdp.mjs` — **reuse it, do not rebuild it.**

1. **Landscape phone, first.** `useLayout.ts:61-62` puts 852×393 in the tablet band *by width*, so a rotated phone takes `GmTopBar`'s wider padding: 100 + 109 + 45 + 95 = **349 of 393**, leaving ~44px of panel. It is already at 304 today. **This is the only measurement that could send Layout B back to the drawing board.**
2. **The tab strip's real height.** 45.00 is a *declaration* (44 + hairline, `.stack` declares no gap), not a measurement — and the 57px budget the decision was taken against came from a runtime override on a `dist/` that no longer exists.
3. **Every row count in Layout B.** Eight whole and no ninth unpinned; **eight down to seven** with a primary countdown pinned. At 47/34 insets and again at zero.
4. **The REFERENCE column outside the sheet.** Predicted 369.00, corroborated by `SessionList.tsx:81`'s measured 369 for the same region shape, still unmeasured for this one.
5. **Whether the topic strip still wraps to three rows / 144.00 at 369.** Probably — 369 sits below the 373..412 band `Reference.tsx`'s own sweep found losing. "Probably" is not a docblock.
6. **Total chrome above the first rule on REFERENCE** (~200px: tab strip, 144.00 topic strip, table) — and whether two selection strips in different visual grammars stacked ~6px apart read as two levels or one confused one.
7. **Whether a strip at the top of a 393×852 phone is a comfortable press** for a gesture made twice an evening. Drill-shaped, not test-shaped.
8. **The selection rule under light theme and `prefers-contrast`.**
9. **Every reach figure in `:1797`'s SUPERSEDED block on this branch** — they were taken on `main`, and the branch adds height inside the first fold.
10. **The damage roll block's real height** once the extras strip exists. `playSheet.test.tsx`'s vertical budget stops at ROLL and `DamageRow` sits below it, appearing only after a roll — so nothing added *inside* the row charges the folded-sheet fit. That reasoning is source-level; the resulting block height is not.
