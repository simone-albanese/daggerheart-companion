# Audit delle 80 voci aperte di BACKLOG.md (wf_38ebbe09-1e3)

Fatto il 19 agosto 2026. Le 10 corsie di audit hanno finito tutte e 80 le voci; la fase di
confutazione era a **8 lenti su 10** quando l'onda e' stata fermata per pausa.

> **NESSUNA di queste chiusure e' stata applicata a `BACKLOG.md`.** Il file e' intatto. Questo
> documento e' materiale grezzo da verificare, non un verdetto da eseguire.

Come leggere le marcature, sulle sole righe `ALREADY_DONE` / `PREMISE_FALSE`:

| marca | significa |
|---|---|
| `[retto]` | uno scettico indipendente ha provato a smontarla e non ci e' riuscito. **30 voci.** |
| `[CONFUTATO: ...]` | lo scettico l'ha smontata: la voce **resta aperta**. **1 voce** (`:1653`). |
| `[NON verificato]` | e' delle due corsie la cui confutazione non ha fatto in tempo a girare. **10 voci — da non chiudere senza rifare quel giro.** |

La confutazione di `:1653` e' la ragione per cui il giro avversariale esiste: la voce sembrava
chiusa da `ScreenBoundary.tsx`, e `AppBoundary.tsx` porta ancora il difetto identico — la frase
citata verbatim, `componentStack` consegnato a `console.error` e scartato, `{error.message}` da
solo senza modo di copiarlo. Va **spezzata**, non spuntata.


## PREMISE_FALSE — 6

- **:975** "188 px on a tall phone is workable but not generous." If it grates, the levers are letting the Experience rows join the top of the scroll on short viewports, or unpinning Stress — neither without ask [NON verificato]
- **:983** Opens "**The header character picker is painted over and un-clickable from exactly 720 px up.**" — claims the left row is over-subscribed at 768 and the status caption wins the hit test at the select' [retto]
- **:1834** Opens "**A `counterStyle` preference, defaulting to numbers.**" — boxes stay available, scoped to Play on phone and tablet only, with the desktop cockpit keeping pips. [retto]
- **:1852** Opens "**The advantage / disadvantage / reaction row moves behind a disclosure**" — collapsed by default, showing the net modifier on its closed header, because collapsing reclaims the band that was a [retto]
- **:2148** "SEARCH is not in the bar, and that is a decision" — the wireframe's fourth verb is absent because full-text rule search is deferred to 1.1 and table searching is already the Bestiary's filter. [retto]
- **:3321** "**The damage row's face grid still has one way out** — the open half of P3-12, above." [retto]

## ALREADY_DONE — 35

- **:646** "An unresolvable armor ref silently produces wrong thresholds." — deriveStats takes the no-armor branch for a present-but-unresolvable activeArmor, giving [0, level] and armorScore 0. [NON verificato]
- **:651** "'Free during downtime' is printed mid-combat" for the 31 SRD cards whose recallCost is 0 — branch on the downtime option, not on the resulting cost. [NON verificato]
- **:654** "**~~Unarmored thresholds are the app's own invention presented as rules~~**" — the corrected entry: first clause disowned, second clause (Vitals letting one hit spend up to three Armor Slots) to be f [NON verificato]
- **:686** "**`newCharacter` seeds the wrong HP and Stress track for six of nine classes.**" — character.ts hardcodes max: 6 for both; seed from the class or make create() sync. [NON verificato]
- **:751** "Until it does, `codec.ts:851` must not promise a repair that never happens." Wire the resolver or change the sentence. [NON verificato]
- **:1025** Opens "**`prefers-reduced-motion` is honoured in CSS but not by the JS smooth scroll**" — the Settings section jumper ignores the OS preference. [retto]
- **:1204** Opens "**`public/brand/*` is neither precached nor routed** (`sw.js:59`)" — four files matching neither `isShell` nor `isImmutable`, invisible to a `JS_IMPORTS` scanner that only matches `.js`/`.css`. [retto]
- **:1208** Opens "**Activation prunes the cached importer chunk before refetching it**" — accepting an update offline loses the offline importer until the next online launch. [retto]
- **:1533** Opens "**No version or build id anywhere in the UI.**" — put the app version and the SRD revision on the About screen. [retto]
- **:1653** Opens "**A screen crash gives the user one line of text and no way to convey it.**" — the fallback shows `error.message` alone, no stack, no copy affordance. **[CONFUTATO: The ScreenBoundary half is genuinely done and I verified every line of it (report() at :108-121, copyTheReport at :123-131, 'Copy the error report' at :272-274, the WHERE IT HAPPENED <details> at :217-248, 'Save a copy of everything' at :261; 9/9 tests green on Node v24.19.0, including the three quoted test names). But the claim's central assertion is factually wrong. It states 'The quoted sentence at :29-31 is gone.' It is gone from ScreenBoundary.tsx only. `grep -rn "No telemetry anywhere in this app" src/ tests/` returns exactly one hit: src/ui/shell/AppBoundary.tsx:61 -- the item's quoted sentence, verbatim, still in the tree. And the sentence is not all that survived. AppBoundary.tsx:60-62 receives info.componentStack and hands it straight to console.error, never to state -- precisely the defect ScreenBoundary.tsx:55-58 now describes in the past tense ('it used to hand it straight to console.error and drop it - so the fallback structurally could not show the one piece of information that says where the failure was'). AppBoundary.tsx:114 renders {error.message} alone inside a <code> block with no stack and no copy affordance: the item's second sentence, still true, one file over. `copyText` is imported by exactly one file in src/ (ScreenBoundary.tsx:22), and none of appBoundary.test.tsx's 6 tests ask for a report or a stack. I checked the scope question rather than assuming it: at 1c22c91, the commit that authored this bullet, src/ held exactly two console.* calls (App.tsx:72 and ScreenBoundary.tsx:30) and AppBoundary.tsx did not exist -- it arrived in 232d8a9. So AppBoundary is a variant that post-dates the item, not a clause the fix skipped. That argues for splitting the item, not for ticking it: AppBoundary is the boundary above useStats(), Header, TabBar, the storage/quarantine/integrity banners and CardReader, so the item's headline -- 'A screen crash gives the user one line of text and no way to convey it' -- remains true of the app's other boundary, and the item's own rationale ('on iOS reaching a console needs a Mac and a cable... nothing to send back but a retyped sentence') applies to it word for word. The proposed closing text actively camouflages this: it names AppBoundary.tsx:62 only as a correction to the console count, so the next reader sees a file that was looked at and cleared. Recommended resolution: close the ScreenBoundary work explicitly (its evidence is airtight) but keep a bullet open for AppBoundary, the fallback a white-page crash actually reaches. Adjacent, not a reason to reopen: report() takes its version from fileIo.ts:49, a hand-typed `export const APP_VERSION = '0.3.0'`, not from buildInfo.ts -- it matches package.json today, but it is a second source of truth for the exact value item 1533's design exists to keep from drifting.]**
- **:1672** Opens "**The precache test derives its expectations for fonts and icons and not for brand assets.**" — no `/brand/` clause in the service-worker test. [retto]
- **:1682** Opens "**The deployed bundle carries no copy of the MIT notice, and the app never states its own code licence.**" [retto]
- **:1689** Opens "No copy of the DPCGL and no record of which version was accepted." — LICENSE cites the licence by bare URL, nothing in the app lets an offline user read the terms; vendor the text with a retrie [retto]
- **:1797** Opens "**Rebuild `PlayPhone` in sheet order**, with every section above present." — plus a second sentence keeping the pinned block that holds the trait chips and ROLL. [retto]
- **:1827** Opens "**Collapsible sections — the *tendina*.**" — weapons & armour, cards, inventory and lineage each behind a disclosure that remembers whether it was open. [retto]
- **:1831** Opens "**Counters as numbers, with `[−]` and `[+]`**" — and the number itself is a target that opens a numeric entry. [retto]
- **:1845** Opens "**Thresholds prominent**, not 10 px dim text." — they are read under pressure by someone who has just been told a number. [retto]
- **:1847** Opens "**Trait verbs on the trait tiles**" — Sprint/Leap/Manoeuvre and the other five triples, sourced from the shipped SRD rather than the PDF. [retto]
- **:1942** "Creation has no guard at all" — the wizard can mint a second Ilya because nothing on the creation path compares names. [retto]
- **:1948** "A plain import compares `id` and nothing else" — a .dhchar for a different Ilya lands beside the local Ilya with no name comparison. [retto]
- **:2181** "A campaign that failed to write is only said on the GM screen." — a GM who leaves for Play or Cards with a failed campaign write behind them is told nothing. [retto]
- **:2221** "`createCampaign` sets the new campaign active even when `putCampaign` rejected," and `removeCampaign` has no stale-build guard where `putCampaign` has one. [retto]
- **:2348** "The name and place generators" — reopened by the owner 2026-08-18, approved as tables written for this project under a provenance rule and an exhaustively tested collision rule. [retto]
- **:2459** "Compare `src/ui/print/CharacterSheet.tsx` field by field against the official sheet…" — produce a written comparison (missing / named differently / app-only) before changing anything. [NON verificato]
- **:2462** "Match the **information architecture**, not the artwork." — take the paper's field set and order, reproduce none of Darrington Press's layout, frames or class banners. [NON verificato]
- **:2467** "Specifics visible on the paper and worth checking for: *\"Start at 10\"* under Evasion…" — eight named details from the official sheet to check the print sheet against. [NON verificato]
- **:2840** "**Settings prints the notice twice and that is still deliberate.**" — a note recording that the About panel's copy and the shell footer's copy are both wanted, so nobody deletes one. [NON verificato]
- **:3054** The 1.2 h slice of ③ — make the door that prints SRD sections stop rendering them with paragraphs() alone, so the 38 sections carrying lists or tables stop printing literal dashes and raw pipes. [retto]
- **:3076** Arbitrate the Difficulty scale against the SRD where the two GM-screen PDFs disagree, and record which of them was wrong. [retto]
- **:3093** Rules search inside SHOW that scans titles and bodies with no precomputed index. [retto]
- **:3094** Navigation through the search results that does not turn into a second Reference screen. [retto]
- **:3119** The 1→2 campaign schema bump, shared with the URL row. [retto]
- **:3129** Decide the URL row and the note row together so the schema is bumped once, not twice. [retto]
- **:3130** The URL row has to rewrite the campaigns.ts docblock that forbids external URLs outright. [retto]
- **:3132** All six URL security mitigations live in the reader rather than at render. [retto]

## PARTLY_DONE — 6

- **:745** "Render what `missingCardRefs` returns, on Play and on the print sheet:" a ghost row naming the ref, counted against the cap so the ACTIVE/SLOTS FREE numbers agree with the gate, and removable to the 
  - resta: The print half. The printed sheet's loadout header still counts only resolved cards, so it disagrees with the recall gate exactly as Play used to; the unreadable refs get an aggregate footnote that predates this item rat
- **:1590** Opens "**Nothing in the pipeline objects to unused code, and the free compiler flags find nine hits today.**" — turn on `noUnusedLocals`/`noUnusedParameters` and add an unused-exports pass.
  - resta: The two tsconfig lines, and nothing else about them has been started — no flags, no lint script, no eslint/biome/knip. Seven unused locals/params sit in the tree unremarked. Also worth correcting when it is closed: the b
- **:1663** Opens "**Settings hints are never tied to the control they explain.**" — no `id` on the hint, no `aria-describedby` anywhere in `src/`.
  - resta: About's five bare `<button>`s need to become `Action` (or otherwise consume `useFieldHint()`), so the *Reset everything* row's warning — "There is no undo and no copy anywhere else", `About.tsx:392` — is announced with t
- **:2728** "**The counter cell has no cushion between the value and the steppers…**" — the grid left ~4px where the full-width row left ~105; the mistakes are recoverable but nobody has watched a real thumb.
  - resta: The observation itself: nobody has watched a thumb miss in the cell (drill 8, still unrun). And the item's arithmetic needs correcting — the cell has 0px, not 4, and the item does not mention the pressed-stepper ring the
- **:3027** Slice 0 of request ① minus the insets — draw the SCENE chip unconditionally, fix the empty-state copy, and correct the four docblocks that say "five" over a list of four.
  - resta: The SCENE chip is still conditional and the test at `tests/gm/gmScreen.test.tsx:251` has to move with it; `Gm.tsx:17` is the fourth docblock and still says five regions open from a row when three do. The empty-state half
- **:3118** Build the note block itself — formatted text (bold, italic, bullets, centring) on a session row of its own.
  - resta: The editor and the formatted rendering — the whole 16 h. Nothing draws `spans`, `bold`, `italic` or `align`; `NoteArm` shows plain text only. And `note` is still absent from `SESSION_ITEM_KINDS`, so there is no ADD form,

## OPEN — 19

- **:748** "Call `resolvePlaceholders` at startup, after `init()` loads the library," and re-persist what it heals.
  - resta: Everything. `resolvePlaceholders` has no caller in `src/`; `store.init()` does not run it after the library loads, and there is no path that writes a healed character back to disk. A device whose registry grew in an upda
- **:999** Opens "**All typography is in px**, so the OS font-size setting has no effect" — convert the type roles to `rem`, after turning every fixed height that contains type into a `min-height`.
  - resta: All of it. Nine type roles in `src/ui/tokens.css` are still px-denominated, and the precondition the bullet names — turning every fixed height that contains type into a `min-height` first — has not been started either.
- **:1014** Opens "**The roll result is never announced on desktop.**" — no `aria-live` in `DualityRoll`, focus stays on a button whose name never contains the outcome, verdict renders in an inert div.
  - resta: Everything. The desktop verdict is still an inert div with no `aria-live`/`role="status"`, and no control's accessible name carries the outcome, so a desktop screen-reader user is told nothing when a roll resolves.
- **:1211** Opens "**The \"no skipWaiting, the user decides\" comment is not what the code does**" (`sw.js:85`) — make it true or correct the comment.
  - resta: The wording. "No skipWaiting" still stands as a flat two-word claim in a file that calls `self.skipWaiting()` at `sw.js:230`; the lifecycle it describes is correct, so the remedy is the second of the two the bullet offer
- **:1213** Opens "**The SRD is a static import of the entry chunk**" — a large dataset on the boot critical path before the app can paint its loading mark.
  - resta: All of it. The dataset is still fetched and evaluated before first paint. Note that making it lazy is not a one-line change: `sw.js:573-577` says a chunk named only by a dynamic `import()` is dropped by the prune and ref
- **:1615** Opens "**The browser floor is stated nowhere, and nine `color-mix()` values sit where no build target can reach them.**"
  - resta: The floor itself is still written down nowhere authoritative. It is derivable only from a docblock in `Header.tsx` (Safari 16.2 / Chrome 111, from `color-mix()`, with `svh` at 15.4/108 below it), which is prose inside on
- **:1955** "`characterFileName` slugifies two distinguishable names to one file" — "Ilya!" and "Ilya?" both export as ilya.dhchar.
  - resta: Nothing in the tree disambiguates exported file names. A second character whose name differs only in characters `slugify` drops still overwrites the first `.dhchar` in a folder — and the directory-backup path (`backupFol
- **:2122** "A session encounter row can put its plan back on the board, but not its fight" — no gmStore action sets the combatant list wholesale, so stored combatants are a fact with no control.
  - resta: The store change the bullet names: an action that replaces `combatants` with a stored list (marks, HP, stress, spotlight intact), and then the control on the encounter arm that calls it. Neither exists.
- **:2171** "The shell substitutes the GM screen rather than correcting the store." — `allowedScreen` makes App draw Play while the store still holds `screen: 'gm'`, and that divergence is accepted rather than fi
  - resta: Everything the bullet describes is still exactly the tree's behaviour — the store is never corrected, only the render is filtered. It is a standing record of an accepted divergence with no work attached, so it stays unti
- **:2195** "A scene added from ADD records an environment and does not put it on the board." — the plan/table split, with the row carrying the verbs that cross it.
  - resta: Nothing is missing in code — the bullet describes the shipped design accurately, including the two verbs it says the row carries. Its own condition for revisiting is a GM reporting they expected otherwise, which has not 
- **:2272** "The campaign list is not re-sorted while it is open." — `readCampaigns` sorts once on the way in and MENU keeps that order for the life of the sheet.
  - resta: The behaviour is unchanged and is the behaviour the bullet describes and defends. No refresh control has been built, and none is being asked for until a GM wants one. It stays unticked as a record of a deliberate choice.
- **:2397** "The reference is not one of the switchable GM tools." — only the three doors of SHOW are switchable; `prefs.gmSection` still removes the whole section.
  - resta: The reference has no switch and none is being added; the bullet describes the shipped state and the reason for it. It stays unticked as a record of a deliberate reduction, not as work.
- **:2613** "**The death-move offer can now be off screen when it appears…**" — a recall that spends the last Hit Point from far down the scroll renders the banner above the viewport; make it a dialog, or have th
  - resta: Pick one of the item's two answers and build it: either make the offer itself a dialog (the shape `DeathMoveDialog` already has), or make `RecallButton` say on its own row that this tap spends the last Hit Point. Nothing
- **:2833** "**Nobody has seen the home-indicator inset on real glass.**" — every number treats `env(safe-area-inset-bottom)` as 0; on an installed PWA it is 34px and the two Build navigation rows now pay it.
  - resta: The measurement: read `env(safe-area-inset-bottom)` off an installed PWA on the owner's own phone (and an iPad, where the Build nav rows are the ones paying), and check for the two failure modes — 34px of empty panel bet
- **:2980** "**Nobody has watched a thumb reach for ROLL at the top of the scroll**" — the reflow sharpened the reach question instead of answering it; the row's position against the ~330px sweep is argued, never
  - resta: The observation: one player, one evening, a 393×852 phone and a 375×667 phone, answering whether reaching ROLL at the top of the scroll is a shrug, a grip shuffle or a two-hander — and whether the player scrolls it down 
- **:3040** Choose a replacement name for the SHOW verb that is not LOOK UP and that names what is behind it.
  - resta: Everything. No name has been chosen and nothing has been renamed. One clause of the item is stale: it quotes the sheet as "SHOW: the two tools no row can open", and the sheet now says three (`showDoors.ts` plus `ShowShee
- **:3041** Read all 114 SHOW occurrences by hand rather than sed'ing them — 47 in src, 39 in tests, 28 in documentation.
  - resta: The whole sweep, and it is roughly twice the size the bullet prices. The 114/47/39/28 figures should be re-derived before anyone starts; note also that not every hit is the verb — `src/ui/gm/Scene.tsx` carries at least o
- **:3077** Build the two GM-screen PDFs as panels on the DM's home; the layout is called undecided because the panels and the session list compete for the same space.
  - resta: All of it. The panels are unbuilt and the home is not tabbed. The bullet should lose "Layout is undecided and needs pixels" — Layout B (tabbed, THE NIGHT / REFERENCE) was decided on 19 Aug — and should carry the constrai
- **:3079** Make `rest.ts:35-99` read its downtime move text from `rules['downtime']` instead of keeping a typed copy of it.
  - resta: All of it. `DOWNTIME_MOVES` must stop carrying the SRD prose and derive each move's `text` from the `downtime` rules section (the `id`, `name`, `rest` and `mechanical` fields can stay), with `Rest.tsx:638` and any test r

## OWNER_DECISION — 7

- **:1574** Opens "~~Sweep the remaining `TODO`/`FIXME`/`HACK` comments and decide which are real gaps.~~ — **no subject, measured 2026-08-18.**"
  - resta: Nothing in the tree. What is open is a bookkeeping decision only the owner can make: the bullet's premise is already recorded as false in the bullet, and two sentences in this same file say it stays unticked. One small d
- **:2117** "`Countdown.notes` is persisted, read by `readCountdown`, and rendered nowhere" — the open countdown row should show it, with a keyboard and a history.
  - resta: No code work is pending and none is proposed: the field stays undrawn by decision. What is left is an owner call on whether to keep the bullet as an open ask (in which case types.ts's dated decision has to be overturned)
- **:2134** "Not all five regions are reachable from the top MENU" — only the encounter builder and the live scene are repeated there; the other three are behind the Fear readout and SHOW, and MENU says so.
  - resta: Nothing is buildable here: the bullet is its own answer and the tree implements it, including the sentence that names where the other three are. The owner call is only whether the literal reading (all five repeated in ME
- **:2159** "Three tools of six are not switchable, where the item asked for 'each'" — the encounter builder, the scene runner and Fear/countdowns have no Settings switch, each for a stated reason.
  - resta: No pending code: the reduction from "each" to three switches is the decision this bullet exists to record, and the tree enforces it. If it is ever revisited, the bullet already names the shape — hide the countdowns board
- **:2386** "The difficulty ladder is not attached to `DualityRoll.tsx`'s DIFF box." — narrowing the struck bullet's "wherever a difficulty is set", left open for the owner rather than struck.
  - resta: Nothing has changed and nothing should be changed by an implementer. The open question is whether the owner accepts the narrowing of the parent bullet's "wherever a difficulty is set" to "everywhere except the player's o
- **:3056** The remaining 10.4 h of ③ (tips in English on the rules and on the app) needs an owner decision and has not had one.
  - resta: The owner has to say yes or no to the remaining 10.4 h. If `HANDOFF-2026-08-18.md:834`'s `B3 = a` is the real answer, this bullet should be reworded from "needs a decision" to the approved work rather than ticked — the w
- **:3136** "**Is a "scene" a place or a fight?**" — the code keeps a scene with an `environmentRef` and an encounter with a `roster` as two different things, Giorgio has written both versions, and the next actio
  - resta: The owner's answer. No code change is available until it comes, and the item blocks the nesting question below it.

## GATED — 7

- **:3028** The two horizontal safe-area insets on GmBar, explicitly blocked on H-9 and part of item 19 rather than its closure.
- **:3140** "**If it nests, nesting is a real preference**" — both renderings, both reorder models, and a nested-written campaign correct when read back flat; decided but parked behind the scene question above.
  - resta: Everything: both renderings, both reorder models, and the flat read-back guarantee. All of it waits on whether a scene is a place or a fight.
- **:3249** "**`--control` is 34px under a finger on a touchscreen laptop.**" — widen its media query to the `(any-pointer: coarse)` form `--pip-h` already uses.
- **:3294** "**The Play column does not pay it either, and it is the big one.**" — `<main>`'s other child pays no horizontal safe-area inset; ROLL 2d12, the trait buttons, MODS and the three `+` steppers sit in t
- **:3307** "**The Cards filter rails do not pay it.**" — `Cards.tsx`'s full-width horizontal scrollers start at x=0 whatever the inset.
- **:3309** "**`GmBar` does not pay it**" — it pays the bottom inset but wants the two horizontals in the same `calc(0px + env(...))` form, and it is drawn at every width.
- **:3313** "**Six overlays hide an `env()` inside a `padding` shorthand.**" — DomainCardView, Companion, Conditions, DeathMove, Beastform, GearPicker pay nothing horizontally and are invisible to jsdom.
