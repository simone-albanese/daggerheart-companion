# Quello che è rimasto nei journal — recuperato il 24 agosto 2026

> **Due dei tre workflow del 23 agosto sono atterrati e i loro documenti sono committati.** Ma un
> documento è una *sintesi*, e una sintesi butta via. Questo file raccoglie ciò che i loro
> `journal.jsonl` contengono e i documenti committati **non** riproducono — a cominciare da
> trentun kilobyte di markdown già scritto per `BACKLOG.md`, che altrimenti qualcuno riscriverebbe
> da capo senza sapere che esisteva.
>
> Il terzo workflow, `wf_226cd659-47e`, non è qui: non era mai atterrato affatto, e il suo rapporto
> intero sta in **`docs/handoff/VERIFICA-BRANCH-2026-08-23.md`**.

---

## Due difetti vivi nel codice dei tiri, che nessun documento porta

Trovati dalla lane `scope:damage-pools` di `wf_6a80a4c1-7a8`. **Verificati oggi leggendo il
codice**, non ripetendo l'agente:

**1. Il tiro con dadi digitati continua a tirare i dadi bonus da solo.** `engine/dice.ts:142` legge
`input.fixed?.bonus?.[i]` — il supporto c'è. Ma `DualityRoll.tsx:791` dichiara il parametro come
`(fixed?: { hope: number; fear: number })`: **`bonus` non esiste in quel tipo**, quindi non viene
mai passato. Chi ha scelto di digitare i propri dadi si vede comunque il dado Rally tirato da
`cryptoRng`.

**2. «Roll it» nelle riserve non legge nessuna preferenza.** `DicePools.tsx:191` chiama
`cryptoRng(pool.sides)` direttamente dentro l'`onClick`. Non consulta alcuna impostazione di
tiratore.

E un terzo, non verificato oggi: `setFace` ri-passa da `record()`, che aggiunge una riga di log a
ogni chiamata senza API di correzione (`store/state.ts:665`), quindi **una spesa piazzata dentro
`record()` scatta due volte** su una faccia corretta.

---

## Come usare questo file

La **§1** è lavoro da applicare, non da leggere: gli undici blocchi hanno già la loro forma di casa
e le istruzioni di inserimento. Attenzione alla riga in cima — *«7 spuntabili»* è più generoso dei
verdetti veri, che sono **cinque spunte, uno split e un reword**.

Le **§2 e §3** sono un indice di ciò che resta nei journal: se una di quelle voci ti serve, il
journal è ancora lì e vale la pena aprirlo. Se nessuna ti serve, adesso lo sai, e i journal possono
morire con la loro cartella di sessione senza portarsi via niente che qualcuno rimpiangerà.

I journal stanno in
`~/.claude/projects/-Users-simonealbanese-Documents-Daggerheart-Companion/b9563823-72a2-4816-be80-b8e823d1a7e4/subagents/workflows/<runId>/`,
e gli **script** in `.../b9563823-.../workflows/scripts/` — **non** in `workflows/scripts/` dentro
il repo, che non esiste e che i due handoff indicavano per errore.

---

# 1. THE ELEVEN READY-TO-APPLY `BACKLOG.md` BLOCKS

*Recovered verbatim from `wf_6a80a4c1-7a8`'s journal. House-style markdown with insertion instructions. Roughly 31 KB of finished work that no committed document reproduces.*

> Note the honest counts before applying any of these: `action` is not always `tick`. Of the seven items whose
> refutation lane closed them, **five are plain ticks** (`:651`, `:654`, `:686`, `:751`, and `:975` **as an
> expiry, not as done**), one is a **split** (`:2459`) and one is a **reword** (`:2840`). Three stay open
> (`:646`, `:2462`, `:2467`), and `:1653` was always a split.


## `BACKLOG.md:651` — action **tick**, confidence **certain**, still open: **False**

```markdown
- [x] ~~**"Free during downtime" is printed mid-combat** for the 31 SRD cards with
      `recallCost: 0` (`Play.tsx:370`, `Cards.tsx:116`). Branch on the `downtime`
      option, not on the resulting cost. *(trivial)*~~
      — **done, `5ed3def`** — though not by the means this bullet prescribed, and the
      difference is worth writing down. Both surfaces now go through one hook,
      `src/ui/player/recall.ts:39-67`, and no path into it has ever carried
      `downtime` (`recall.ts:11-17`: a recall during a rest is deliberately staged by
      `Rest.tsx` instead), so branching on the option *there* would be dead code. The
      zero-cost branch stays at `recall.ts:63` and now writes the sentence that is
      true of it — *"This card costs nothing to recall"*. The other zero is written
      where it is earned: `Rest.tsx:464`, *"free during this rest"*, inside the rest's
      own log entry. The quoted string survives nowhere in `src/` except the two
      comments that explain its removal (`recall.ts:55`, `Cards.tsx:174`). Pinned by
      `tests/ui/playSheet.test.tsx:2877` and `tests/ui/cards.test.tsx:138`.
```


## `BACKLOG.md:975` — action **tick**, confidence **certain**, still open: **False**

```markdown
- [x] ~~188 px on a tall phone is workable but not generous. If it grates, the
      levers are: let the Experience rows join the top of the scroll on short
      viewports, or unpin Stress. Both cost something already asked for, so
      neither happens without asking.~~
      — **closed as expired, 2026-08-23. Not as done, and not by a `[y/n]`** —
      which is the disposal the note at the head of this section reserved for
      exactly this outcome. Nothing was built for this bullet; its premise left.
      The fixed block it is a reading of does not exist: `Play.tsx:3475-3479`,
      "One column, and it is the only thing on this screen that scrolls…
      there is nothing pinned for them to be arranged around - and with them
      went the 88px floor that existed only to stop a fixed block starving the
      scroll." `playSheet.test.tsx:475-488` holds it there rather than trusting
      the comment: it fails if *any* element on Play declares `position: fixed`
      or `sticky`, and if any element other than the root declares a second
      `overflowY: auto` (132/132 green on Node v24.19.0). The seven `position:
      fixed` left in `src/` are all `inset: 0` dialog overlays.
      So both levers are spent or meaningless. The Experience rows are already
      inside the scroll — a `Disclosure` fold in the column, `Play.tsx:3424`
      and `:3683` — which is more than the lever asked for; and Stress cannot be
      unpinned because nothing is. There is no 188 px window left to be generous
      or mean with: the number survives nowhere in `src/` or `tests/`. What
      replaced it is asserted rather than remembered, in `playSheet.test.tsx`'s
      budget: the folded sheet sums to 600 in a 730px column at 393×852, and the
      margin under ROLL on the 375×667 phone went from 10 px to **221**, still
      96 to spare with a 34 px home-indicator inset.
      **The table and the two paragraphs above expire with it** — they still say
      "keeps two things out of the scroll" and "All four tracks are pinned" about
      a screen that does neither, and left standing they read as current.
```


## `BACKLOG.md:686` — action **tick**, confidence **certain**, still open: **False**

```markdown
- [x] ~~**`newCharacter` seeds the wrong HP and Stress track for six of nine
      classes.** `character.ts:282` hardcodes `max: 6` for both, but
      `startingHitPoints` is 5 for bard and wizard and 7 for guardian and seraph.
      Latent rather than live: the only persisting caller is `store.create`
      (`state.ts:188`), whose single call site happens to pass an already-synced
      sheet. The moment a second caller appears — duplicate-character, a template
      flow, a test seed — a wizard is stored with a 6-box track the engine
      derives as 5, and `validatePlan` warns *"Hit Points are already at the
      maximum of 12"* one advancement early. Seed from the class, or make
      `create()` sync.~~ *(trivial)*
      — **done, and half of it was never true.** The Hit Point half was real and
      is fixed at `character.ts:511`: the track is
      `Math.min(MAX_HP, startingHitPoints(klass))`, off the same
      `startingHitPoints` helper (`character.ts:89-90`) and the same
      `HIT_POINTS_WITHOUT_A_CLASS` fallback that `deriveStats` reads at
      `character.ts:388`, so the seeder and the engine cannot drift. Both
      remedies landed, not one: `state.ts:426` passes `get().index`, and
      `Wizard.tsx:296-297` passes it *and* calls `syncCounters`. Pinned by
      `tests/engine/character.test.ts:359-370` and by the dataset-read
      `describe` at :400-430, which reads the nine numbers off `srd-1.0.json`
      rather than trusting either count.
      The Stress half is **premise-false** and should not be repeated: there is
      no per-class Stress in the game. The SRD prints STARTING HIT POINTS for
      each class and nothing else; `shared/types.ts:161` carries
      `startingHitPoints` alone; `character.ts:512` and `:392` both read one
      `BASE_STRESS`. And it was **four** of nine, not six — bard 5, wizard 5,
      guardian 7, seraph 7.
      Not a reason to reopen, but the one place the no-index call still lives:
      `fileIo.ts:368` builds its blank sheet with `newCharacter()`, so a record
      with a resolvable class and no `hp` key would inherit the 6. Every store
      write path re-syncs it (`state.ts:797-802`), so it is unreachable today.
```


## `BACKLOG.md:2459` — action **split**, confidence **probable**, still open: **False**

```markdown
- [x] Compare `src/ui/print/CharacterSheet.tsx` field by field against the
      official sheet and list what is missing, what is named differently, and
      what the app has that the paper does not. Report before changing.
      — **done, `b64a52e`**, whose message *is* the report: ten findings (eight
      fields missing, two misfiled), the app-only extras named (the loadout,
      the domain cards printed in full, the features), and **nothing** left
      named differently — the page says *Heritage*, the paper's own word
      (`sheetModel.ts:126`, `CharacterSheet.tsx:76`). Re-checked 23 Aug: the
      only commit to touch `src/ui/print/` since is `bf3b6a2`, which swapped
      `collectFeatures` for `engine/features.ts` and added, removed and renamed
      no field. Verified against the tree, not against the audit.
- [ ] **The companion block was never put through that comparison, and it is in
      the same file.** `eef8f19` (branch `beast-sheets`, unmerged) added
      `SheetCompanion` (`sheetModel.ts:189-213`), `printedCompanion`
      (`sheetModel.ts:263-290`) and a Companion section
      (`CharacterSheet.tsx:354-430`) *after* the report above was written; its
      commit message is a rationale for the shape, not a field-by-field list,
      and it names no missing field. Against the SRD's own companion sheet
      (folio 16, *"RANGER COMPANION"*, steps 1–4) the block carries name,
      Evasion, Stress, the two Experiences with their ruled lines, range,
      physical/magic, the damage with Proficiency in it, and all eight level-up
      options with the taken ones marked. Two gaps, one of them real:
      - step 4's *"describe your companion's method of dealing damage (their
        standard attack) and record it in the 'Attack & Damage' section"* has
        no field anywhere — `CompanionState` (`shared/types.ts:386-407`) holds
        `description` as the species, not the attack — so the page prints
        `Attack — melee, physical` with the attack unnamed. Closing it is a
        change to `shared/types.ts`, the companion editor and the schema, which
        is the same "not this lane" `b64a52e` invoked for Inventory Weapons;
      - step 1's *"add a picture of them"* is absent and always will be, since
        this app holds no images. Say so on the page or in the model, rather
        than leaving the omission silent.
      None of the eight companion tests in `tests/ui/printSheet.test.ts`
      asserts against the paper's field set, so nothing in the suite stands in
      for the missing comparison.
```


## `BACKLOG.md:646` — action **split**, confidence **certain**, still open: **True**

```markdown
- [ ] **An unresolvable armor ref silently produces wrong thresholds.**
      **[split — the engine half is closed, three surfaces still print the fallback as fact]**

      **Closed** (`97fd2d9`, 16 Aug): `deriveStats` no longer swallows the ref.
      `character.ts:256-258` computes `unresolvedArmor` and `:421` carries it out
      with the stats, so a caller can finally tell "wearing armor this build
      cannot name" from "wearing nothing"; and `character.ts:298-302` keeps the
      sheet's own `armorSlots.max` rather than answering Armor Score 0, which
      kills the second clause of the sentence above and stops `syncCounters`
      emptying a passing sheet's Armor track. Two surfaces branch on it —
      `Play.tsx:1436, 1499-1503` and `Vitals.tsx:621` — and the GM's board
      reaches the same answer by its own route, `party.ts:135-142` with
      `PartyBoard.tsx:388-389, 686-696`. The `character.ts:147-157` anchor above
      is stale; the code is `character.ts:256-302` now.

      **Still open**, and `97fd2d9`'s own message says so: *"Not done,
      deliberately: the print sheet, the wizard's review, Edit's readout, the
      gear picker's per-armor preview and the party board's own figures still
      show the fallback ladder without qualification."* Of those five, the
      wizard and the gear picker are not reachable — they only ever hold armor
      this dataset supplied — and the party board has since been qualified. The
      other three have not. `grep -rn unresolvedArmor src/ui/` returns `Play.tsx`
      and `Vitals.tsx` and nothing else.

      Executed at level 5 with `activeArmor: 'improved-chainmail'` absent from
      the dataset and `armorSlots.max` 4, where the sheet the file came from
      reads 16/29 (SRD: Improved Chainmail 11/24, Score 5):

      - **The printed sheet is the worst of the three, because paper cannot be
        tapped to check.** `sheetModel.ts:346-349` has two branches — override,
        or not — so it prints Major 5 / Severe 10 under the caption **"Level 5
        is already added to both"**: not silence, a false derivation.
        `buildLadder` (`sheetModel.ts:463`) turns the same numbers into "below 5
        / 5+ / 10+", and `sheetModel.ts:360` resolves the ref to `undefined`, so
        `CharacterSheet.tsx:213-215` prints **"Nothing worn."** next to an Armor
        cell (`CharacterSheet.tsx:116-125`) reading 4 with four pips — the page
        contradicting itself.
      - `Edit.tsx:104` shows `THRESHOLDS 5/10` with no qualification, and the
        Armor `GearSlot` at `Edit.tsx:219-224` falls to its `empty` state,
        *"Search N sets of armor"*, for a character who is wearing some.
      - `LevelUp.tsx:326-333` shows `5/10 → 5/12` captioned **"THRESHOLDS ARE
        YOUR ARMOR'S BASE PLUS YOUR LEVEL"** — reached from Edit's own "Level up
        to N" button on that same imported sheet.

      This state is reachable by design, not by accident: `state.ts:797-802`
      deliberately returns an arriving sheet unsynced when its armor will not
      resolve, so that the numbers it came with survive.

      Correct one line while here: `PartyBoard.tsx:694` still tells the GM the
      sheet's *"thresholds and Armor Slots are the unarmored ones"*. Since
      `character.ts:298-302` the Armor Slots are no longer the unarmored ones.

      And pin it. No test anywhere builds a sheet with an unresolvable armor ref
      — `tests/ui/printSheet.test.ts` is 48 green cases and none of them is this
      one — which is why the gap survived an audit. *(small: the branch already
      exists, these are three read surfaces and a sentence)*
```


## `BACKLOG.md:654` — action **tick**, confidence **certain**, still open: **False**

```markdown
Two edits.

1) Line 654, change the marker only — the body below it is already written as history and is the citation that settled it:

- [x] **~~Unarmored thresholds are the app's own invention presented as rules~~**

2) Append, after the item's last paragraph (currently line 680, ending "…must not cite a rule the user cannot read in the app."):

      — **done, and verified against the moved tree 2026-08-23.** The cap lives in the engine
      in both halves the bullet named: `damage.ts:186` reads it from `armorSlotCap`, whose
      default `DEFAULT_ARMOR_SLOT_CAP` (`damage.ts:93`) is 1 and is deliberately not exported;
      `damage.ts:198-199` cuts the spend to `min(cap, available, rungs)`; and `markDamage`
      re-clamps against the cap the outcome carries (`damage.ts:240-242`), so an object literal
      with `armorSlotsUsed: 3` cannot forge a spend. `Vitals.tsx:737` reads
      `preview.armorSlotsSpendable` and `Vitals.tsx:762` cycles against it; both layouts render
      the one `{armor}` node (`Vitals.tsx:829, 886`). There is no second surface to re-invent
      it: `applyDamage`/`markDamage` have exactly one caller in `src/` (`Vitals.tsx:11`), and
      the companion added on `beast-sheets` touches no armour at all despite the SRD's *Armored*
      upgrade. Pinned at `tests/engine/damage.test.ts` (54 green, caps of 2/3/4/∞) and
      `tests/ui/playSheet.test.tsx:2654` (132 green), the latter written against the old
      `n + 1 > available || n >= 3`. The SRD instruction was carried out: `data/srd-1.0.json`
      does not carry the sentence, nothing on screen cites one, and the app says only what it
      does.

      **Spun off, not left open here:** `damage.ts:52-54` concludes "evidence is not a
      quotation". True of the app, false of the book — the SRD states the cap outright on p54,
      under ARMOR › REDUCING INCOMING DAMAGE: *"When you take damage, you can mark one Armor
      Slot to reduce the severity of the damage by one threshold (Severe to Major, Major to
      Minor, Minor to Nothing)."* The same paragraph carries the unarmored formula that settles
      this bullet's struck first clause. Neither is quotable in the app because the shipped
      dataset's 80 `rules` sections include no Equipment chapter at all. See the new item.

And a new bullet, wherever rules-data coverage belongs:

- [ ] **The shipped rules text drops the whole Equipment chapter, and the app enforces two of
      its rules anyway.** `data/srd-1.0.json`'s `rules` array has 80 sections and none of them
      is Equipment, Weapons, Armor or Inventory: `"REDUCING INCOMING DAMAGE"`,
      `"mark one Armor Slot"`, `"While unarmored"` and `"Armor Score of 0"` all return zero
      matches. So the one-slot-per-hit cap the engine enforces and the unarmored threshold
      formula `deriveStats` computes are both unreadable in the app and unfindable in
      `RuleSearch`, which is the only reason `damage.ts:43-54` forbids citing either. Extend the
      parser to the Equipment chapter; the citation can then be lifted through the existing
      find-by-sentence pattern in `ruleText.ts` rather than typed into a source file. *(small)*
```


## `BACKLOG.md:751` — action **tick**, confidence **certain**, still open: **False**

```markdown
- [x] ~~Until it does, `codec.ts:851` must not promise a repair that never
      happens. Wire the resolver or change the sentence.~~ — **done,
      `3076dac` · `f33a14b`**, second branch taken. `codec.ts:1022-1028` (the
      old `:851`) now says only what the codec does — the ids stay, they are
      drawn as rows marked CARD NOT IN THIS BUILD with a way to the vault, they
      are forwarded unchanged — and then denies the repair out loud: *"What
      this build cannot do is name them, and adding the content here later will
      not: a device that already has it names them when the sheet arrives
      there."* `codec.ts:986-989` keeps the retired wording as history, and
      `Transfer.tsx` never had a copy of its own — it renders the codec's
      `warnings` through `ImportConflicts.tsx:57`. Three tests at
      `tests/transfer/codec.test.ts:230-303` pin it, the third sweeping every
      file in `src/` for the promise so it cannot creep back.
      **Not closed by this, and not this box's work:** `Architecture.md:477-478`
      still states the repair as a rule, and `CHANGELOG.md:970` still quotes the
      retired sentence under *Known to be wrong*. Both move to the box above.

- [ ] Call `resolvePlaceholders` at startup, after `init()` loads the library,
      and re-persist what it heals — so an update that grows the registry
      repairs the sheets already on the device. When it lands, correct
      `Architecture.md:477-478` — *"I riferimenti ignoti restano nella scheda
      come `unresolvedRefs` e si risolvono da soli quando arriva la fonte
      mancante"* — which names the wrong trigger in exactly the way this item's
      preamble already diagnoses: the registry is compiled into the bundle and
      grows with a build, not when the missing content arrives, so that rule is
      false even after this box is ticked. Correct `CHANGELOG.md:970` in the
      same pass; its *Known to be wrong* entry has quoted a string that no
      longer exists since `3076dac`.
```


## `BACKLOG.md:2462` — action **split**, confidence **certain**, still open: **True**

```markdown
- [x] Match the **information architecture**, not the artwork — **on the character
      sheet's own fields**, done in `b64a52e`. The field set and its order are
      functional and mostly SRD; the layout, the frames and the class banners are
      Darrington Press's design. Reproducing the look is a licensing question this
      project cannot afford to get wrong — P3-10 exists because the attribution is
      already thinner than the licence asks for. Verified 23 Aug against page 1 of
      `Manuali/Character-Sheets-and-Guides-Daggerheart-May212025.pdf`: the section
      order follows the paper's groupings (`CharacterSheet.tsx:13-19`), and none of
      the look is reproduced — `sheet.css:35-39` holds five ink values and 0.4pt
      hairlines and nothing else, `marks.tsx:9-11` converts this app's own
      `DOMAIN_MARKS` polygons rather than DP's icons, and the one piece of official
      artwork in the repository (`public/brand/*`, via `CompatibleMark.tsx`) never
      reaches the page: the footer prints `ATTRIBUTION` as words
      (`CharacterSheet.tsx:454`) and `sheet.css:81` removes the header's icon.
- [ ] **The companion section has never been held against the companion sheet.**
      `eef8f19` (beast-sheets, 23 Aug) added it — 78 lines in `CharacterSheet.tsx`
      — after the box above was judged done, and its message argues only "a section
      rather than a second page"; `c88bd21`'s pass over the same block changed
      glyphs, not architecture. Page 10 of the same PDF runs COMPANION NAME (with a
      space to *"draw or attach a picture of them"*) → evasion, captioned *"Start
      at 10"* → companion Experience → Attack & damage (Standard Attack | Range |
      d6 d8 d10 d12) → stress → TRAINING. `CharacterSheet.tsx:364-429` runs name →
      Evasion/Attack/Stress as one list → Companion Experience → Level-up options.
      So: Experience and the attack block are transposed against the paper, the
      *"Start at 10"* caption is absent, and the paper's two write-in affordances —
      the picture space and the Standard Attack line — have nothing on the page,
      on the one sheet that already rules blank lines for Inventory weapons
      precisely so it can offer room without claiming data. `CompanionState`
      (`shared/types.ts:386-407`) has no attack-name field, so that line is either
      a new field or a deliberate blank, and the blank is the cheaper honest answer.
- [ ] Correct `CharacterSheet.tsx:362`. *"It sits after the character's own
      Experience and before the features, which is where the paper sheet's own
      reading order puts it"* is not a fact about any paper: the companion is a
      separate sheet, as the two lines above it already say, and page 1 has no
      companion block in its reading order at all. Keep the placement if it is
      wanted — give it its real reason.
```


## `BACKLOG.md:2840` — action **reword**, confidence **certain**, still open: **False**

```markdown
Replace BACKLOG.md:2840-2846 (the whole `- [ ]` bullet) with the following paragraph, placed immediately AFTER the "Not done, and named rather than hidden:" list, leaving :2833 as that list's only member:

**Recorded rather than outstanding — Settings prints the notice twice, and that
is still deliberate.** Nothing is pending here; it is written down so the next
reader does not "fix" it by deleting the copy the other one depends on. The
About panel opens with the same 342 characters, from the same array —
`CompatibleMark.tsx:127` is the only declaration, and `About.tsx:210` and
`LicenceFooter.tsx:185` both render `ATTRIBUTION.join(' ')` — and `About.tsx:326`
says the notice is "at the top of this screen and in the shell's footer,
unconditionally", meaning the top of the About panel, which is the last of the
seven sections on this screen. `Settings.tsx:227-236` carries the same decision
as a comment beside the footer it renders, authored by the same commit,
`965d419`, so the record is in the source and not only here. Settings is the
only surface that doubles: every other screen renders `LicenceFooter` once, and
`EmptyState` replaces Play and Cards rather than joining them —
`attribution.test.tsx:559` pins that at *"still carries it, and does not print it
twice"*. Seven `Field` rows, the device-stats grid and the reset panel sit
between the two copies, so nobody reads the paragraph twice in one glance; the
"roughly two thousand pixels" this bullet used to assert was an estimate, and
nobody has measured it.
```


## `BACKLOG.md:2467` — action **split**, confidence **probable**, still open: **True**

```markdown
- [x] Specifics visible on the paper and worth checking for: *"Start at 10"* under
      Evasion, *"Add your current level to your damage thresholds"*,
      the `Mark 1 HP / 2 HP / 3 HP` labels on the ladder, HP and Stress drawn as
      ~~filled~~ **outlined** boxes up to the current maximum and dashed to twelve, six Hope
      diamonds, five Experience lines, the class feature printed in full, and
      inventory weapons carrying primary/secondary checkboxes.
      — **done, `b64a52e`**, all eight, and each one pinned rather than merely present:
      the two captions at `sheetModel.ts:340-349` (`printSheet.test.ts:172`), the ladder at
      `CharacterSheet.tsx:153` (`:343`), `growth` to `MAX_HP`/`MAX_STRESS` = 12 at
      `sheetModel.ts:392-406` with the dashes at `marks.tsx:178` (`:138`, `:152`, `:332`),
      the diamond at `marks.tsx:98` with `crossed: min(scars, 6)` (`:162`),
      `EXPERIENCE_LINES` derived to five at `sheetModel.ts:237-241` (`:209`), the feature
      text through `CardText` at `CharacterSheet.tsx:171-181` and `432-451` (`:195`), and
      three ruled weapon rows each with both ticks at `CharacterSheet.tsx:297-313` (`:375`).
      **One word of the item is stale and was overruled on purpose:** the boxes are
      *outlined*, never filled — `printSheet.test.ts:323` asserts `not.toContain('fill="black"')` —
      because a printed track is somewhere to make a mark, not a picture of one.
      Do not reopen this on the strength of the word "filled".
- [ ] **The companion page was never held against its own official sheet.** The block at
      `src/ui/print/CharacterSheet.tsx:354-430` arrived on `beast-sheets`, after `b64a52e`
      closed the box above, so no pass of this checklist has ever seen it — and the box
      above's *first* quoted caption is printed on the official Ranger companion sheet
      verbatim ("evasion / Start at 10", page 4 of
      `Manuali/Character-Sheets-and-Guides-Daggerheart-May212025.pdf`). The app prints
      `Evasion 10` bare at `CharacterSheet.tsx:372-375`, with none of the derivation note
      the character's Evasion carries — and the number moves, because *"Aware: Your
      companion gains a permanent +2 bonus to their Evasion"*. That is the one gap found;
      the rest of the block already follows the page's conventions (derived Experience
      lines, outlined `TickRow`s, no ballot glyphs). Read the companion sheet through
      once, the way `b64a52e` read the character sheet, and report before changing.
      Not in scope: dashing the companion's Stress — it has no rules ceiling to dash toward.
```


## `BACKLOG.md:1653 — "A screen crash gives the user one line of text and no way to convey it."` — action **split**, confidence **certain**, still open: **True**

```markdown
- [x] ~~**A screen crash gives the user one line of text and no way to convey it.**
      `ScreenBoundary.tsx:29-31` — *"No telemetry anywhere in this app; the
      console is the only reporter"* — then `console.error`. The fallback renders
      `error.message` alone (`:60`) in a `<code>` block with no stack and no copy
      affordance. Those two `console.*` calls are the only ones in all of `src/`,
      and on iOS reaching a console needs a Mac and a cable. The two defects that
      shipped for months were found by a person opening the app on their own
      phone; that channel is this project's only working bug-finding mechanism,
      and it gives that person nothing to send back but a retyped sentence.
      `pasteboard.ts:54` already does `navigator.clipboard.writeText`.~~ —
      **done for `ScreenBoundary`, `3dc3d82`, `ac54a8d`, `69ac8b5`; re-verified
      line by line 23 August 2026. Struck around `AppBoundary.tsx`, not through
      it — the half that is still true is the bullet below.**

      The change the rest rests on is `componentDidCatch`
      (`ScreenBoundary.tsx:91-97`): `info.componentStack` now goes into *state*
      as well as the console — *"the console is still the only reporter for
      anyone with a cable; the state is the only one for everybody else"* — so
      the fallback can show where the failure was instead of being structurally
      unable to. On top of that, `report()` (`:108-121`) assembles the version,
      an ISO timestamp, `error.stack`, the component stack and
      `navigator.userAgent` into one block and deliberately no character data;
      `copyTheReport` (`:123-131`) puts it on the pasteboard through `copyText`
      (`pasteboard.ts:62`, the one place in the app that touches
      `navigator.clipboard.writeText`) behind a **Copy the error report** button
      (`:272-274`); the stack is on screen under a **WHERE IT HAPPENED**
      `<details>` that scrolls inside its own box (`:217-248`); and **Save a copy
      of everything** (`:261`) appears once a retry has been disproven. The
      refusal path is held as well — a clipboard the browser denied says so and
      points at a photograph of the screen rather than reporting a copy that did
      not happen. `tests/ui/screenBoundary.test.tsx` is 9 tests, green on the
      project's Node 24.19.0, among them *"puts the whole report on the
      pasteboard, version and browser included"*, *"shows where it happened, not
      only what it said"* and *"does not claim a copy the browser refused"*.

      **The quoted sentence did not go away; it moved.** `grep -rn "No telemetry
      anywhere in this app" src/ tests/` returns exactly one hit, and it is
      `AppBoundary.tsx:61`. Do not read this tick as a file that was looked at
      and cleared.
- [ ] **The boundary a white page actually reaches still gives one line of text
      and no way to convey it.** `AppBoundary.tsx:60-62` takes
      `info.componentStack` and hands it straight to `console.error` under the
      verbatim sentence this item was filed against, and never to state — which
      is precisely the defect `ScreenBoundary.tsx:55-58` now describes in the
      past tense. `AppBoundary.tsx:114` renders `{error.message}` alone in a
      `<code>` block with no stack and no copy affordance. `copyText` is imported
      by exactly one file in `src/` (`ScreenBoundary.tsx:22`), and none of
      `tests/ui/appBoundary.test.tsx`'s six tests asks for a report or a stack.

      **Not a clause the fix skipped — a variant that post-dates the item.** At
      `1c22c91`, the commit that authored the bullet above, `src/` held two
      `console.*` calls and `AppBoundary.tsx` did not exist; it arrived in
      `232d8a9`. That is why this is a new bullet rather than a reopening.

      **And it is the harder half.** `ScreenBoundary` wraps the five screens.
      `AppBoundary` is mounted at `App.tsx:106-108`, above `useStats()` — which
      derives a whole sheet inside the shell's own render — the `Header`, the
      `TabBar`, `CardReader`, the licence footer and five alert banners
      (`App.tsx:96-98`). A throw in any of those is the white page, and this
      fallback is the only thing standing between it and a user whose next move
      is to clear site data. The rescue half of that screen is already right and
      has to survive the fix: `role="alert"`, **Export everything** offered
      unconditionally, **Try again**. What is missing is the report.

      Correcting this entry's own arithmetic while it is open: `src/` now holds
      **three** `console.*` calls, not two — `App.tsx:210` (`console.warn`, the
      service worker), `ScreenBoundary.tsx:96` and `AppBoundary.tsx:62` — and the
      reason is unchanged, because on iOS reaching any of them needs a Mac and a
      cable. The fix is the three pieces `ScreenBoundary` already has (`stack` in
      state, a `report()`, `copyText`); lift them into something both boundaries
      call rather than copying them, because `copyText`'s single import site is
      exactly what made this look finished.
- [ ] **The crash report names the version and cannot name the build.**
      `ScreenBoundary.report()` stamps `APP_VERSION` (`:112`) and nothing else
      about the build; `grep -rnE "BUILD_ID|shortBuildId" src/` shows the build id
      reaching exactly one screen, `About.tsx:237, 246`. `buildInfo.ts` exists
      for one stated reason (`:4-10`) — *"A user on a stale cached build had no
      way to tell us which one and we had no way to ask"* — and an app that holds
      its bundle in Cache Storage until the user accepts an update can sit on
      `0.5.0` across several deploys. So the one artefact in this app that is
      designed to be sent to a maintainer answers *which build* with the value
      that cannot tell two builds of `0.5.0` apart, while `deploy.yml:94-95`
      fails the deploy outright when the real answer is missing from the bundle.
      One import and one line in `report()`.

      **Deliberately not filed: the duplicate `APP_VERSION`.** `report()` takes
      its version from `fileIo.ts:49`, a hand-typed `export const APP_VERSION =
      '0.5.0'`, rather than from `buildInfo.ts:31`, which vite compiles out of
      `package.json` — a second source of truth for the exact value P4's *No
      version or build id anywhere in the UI* exists to keep from drifting. It is
      still not a bullet, because the drift is already held and has already been
      exercised: `tests/transfer/fileIo.test.ts`, *"stamps the version this build
      actually is"*, asserts `APP_VERSION === pkg.version` and fails CI
      otherwise, and the constant read `0.3.0` when this was raised on 19 August
      2026 and reads `0.5.0` today without anyone having to be reminded. The
      constant is also deliberate and says why (`fileIo.ts:46-50`): a file stamps
      the build that wrote it. Recorded here so it is not filed a third time.
```


---

# 2. WHAT ELSE EXISTS ONLY IN `wf_6a80a4c1-7a8`'s JOURNAL

- The 11 `proposedText` blocks (~31 KB total) — finished, house-style BACKLOG.md markdown for :651, :975, :686, :2459, :646, :654, :751, :2462, :2840, :2467 and :1653, including exact insertion instructions (e.g. :2840's 'Replace BACKLOG.md:2840-2846 … placed immediately AFTER the "Not done, and named rather than hidden:" list, leaving :2833 as that list's only member', and :654's two-edit form: marker only at :654, then append after the item's last paragraph at line 680). Nothing in the repo reproduces any of them.

- 97fd2d9's commit message refuting the :646 audit verdict in the author's own words ('Not done, deliberately: the print sheet, the wizard's review, Edit's readout, the gear picker's per-armor preview and the party board's own figures still show the fallback ladder without qualification'), plus the executed vite-node probe output that proves the printed sheet's false derivation, plus the finding that the wizard and gear picker are unreachable and therefore not part of the remainder.

- The latent seed bug at tests/fixtures/factories.ts:147 — `makeCharacter()` carries hp.max 6 against a fixture class of 5 — and the surviving no-index call at src/transfer/fileIo.ts:368 that reaches the IndexedDB boot read via src/store/db.ts:267.

- Two live defects in shipped roll code found by the damage-pools lane: `DualityRoll.resolve()` (DualityRoll.tsx:790) never passes `fixed.bonus` although engine/dice.ts:142 supports it, so a typed-only build still rolls the player's Rally die with `cryptoRng`; and `DicePools.tsx:191`'s 'Roll it' button calls `cryptoRng` while reading no roller preference at all.

- The double-spend hazard: `setFace` re-resolves through `record()`, which pushes a log line each time with no amend API (store/state.ts:665), so a spend placed inside `record()` fires twice on a corrected face.

- Slayer's 'reroll any 1s' specialization is modelled nowhere — `UPGRADES` at dicePools.ts:209-215 holds only Epic Poetry and Devout.

- The full SRD sourcing for the damage-roll design: dataset addresses for Rally (`classes[0].classFeatures[0]`), Slayer (`subclasses[15].foundationFeatures[0]` and `.masteryFeatures[0]`), Prayer (`classes[5].classFeatures[0]`), Special Rolls (`rules[18]`), Help an Ally (`rules[22]`) and its unmodelled stacking rule (`rules[21]`), Unstoppable (`classes[2].classFeatures[0]`), critical + multiple sources (`rules[25]`), STEP 3 (`rules[15]`).

- Damage-roll design Options A and B with their costs — the plan reports only the chosen Option C, so the rejected alternatives and the reasons for rejecting them are unrecoverable from the repo.

- The complete 367→369 blast radius: ReferenceTables.tsx:101, RuleTableView.tsx:53-61, PartyBoard.tsx:226/232, Names.tsx:48/54, Merchant.tsx:177/182 and GmSheet.tsx:45 all keep 367 correctly, and RuleTableView.tsx's current sentence inverts — plus the row arithmetic proving the topic strip still wraps to three rows at 369 (337.61/438.02, 350.03/412.44).

- Layout B's per-step proof clauses, step 4's retiring figures (391.00, 367.00, 702/982/1058, the 1100 cap, 744.05), step 5's exact SessionList moves (548.00→503.00, 209.00–757.00→254.00–757.00, 259.00–757.00→304.00–757.00), and the retired-figure batch to add to the scan in double quotes (367.00, 391.00, 217.00, 209.00, 304.00, 548.00, 'eight rows whole').

- The judge's tree-verification pass: prefs.gmSection is a boolean at src/store/prefs.ts:48,146,185; CAMPAIGN_SCHEMA_VERSION = 2 at shared/campaigns.ts:99; Reference.tsx:244-262 drops into a slot with no wrapper; zero `role="tab"` anywhere in src/; SHEET_LABEL's Exclude pattern at Gm.tsx:145; base.css:300's gapless `.stack`; whereTheOthersAre at MenuSheet.tsx:242-264 confirmed to name only Fear and the SHOW doors.

- Two Layout B hazards: the invisible empty `GmSheet` from an unmapped 'reference' value, and the session list's scroll position lost on every return from REFERENCE (a direct consequence of the mount/unmount rule the plan adopts) with `scrollTop` named as the follow-up.

- The third surviving carrier of :751's retired promise, HANDOFF.md:793-797, and the stale anchor codec.ts:851 → codec.ts:1023.

- The rule that governs the companion-Evasion gap — sheetModel.ts:329-338, 'an app that prints the answer without the derivation has taken away the only way to check it' — and the test that currently blocks the fix, printSheet.test.ts:525-534, which pins `companion.evasion === 10` and asks for no note.

- Nine of the thirty staleness rows' adjacent observations, notably: companion Stress and level-up boxes drawn as pips rather than `Counter` (Companion.tsx, PartyBoard.tsx); the companion Spellcast Roll already surfacing through `armedMods`; `externalLinkAttrs` having no production caller so mitigation 4 protects nothing shipping; the character SCHEMA_VERSION 4→5 converter at shared/migrations.ts:94-116 seeding `companion.damageType='phy'`; and :1025's three-site scroll sweep.

- The item-③ lane's supporting detail: the raw request at docs/handoff/DECISIONI-2026-08-18.md:84; that 4bdf694 also gave Average Costs (p.69) and the p.112 objectives roll their first drawing anywhere in src (10 of 12 tables → 12 of 12); the ten shipped call sites of `paragraphs` (ruleText.ts:197, srdReference.ts:192/292/438/608/657, DeathMove.tsx:65, Conditions.tsx:159/168/892) that make the narrow claim true and the broad one false; and the enumeration of the ~15 explainable subjects behind the 2–6 h figure.

- Per-lane executed test output under Node v24.19.0 (132, 66, 54, 39, 223, 48, 31, 15, 114, 73, 69 passed) and, most pointedly, the :646 lane's demonstration that the suite has ZERO coverage of the unresolvable-armor state — 'the green suite proves nothing here'.


---

# 3. WHAT ELSE EXISTS ONLY IN `wf_d5464f24-a49`'s JOURNAL

- The full adversary attack procedure and the case for building a roller: d20 (+ second d20 for adv/dis) + attack modifier, optionally + an Experience bought for 1 Fear, vs the target PC's Evasion; nat-20 = auto-success plus max damage dice AND a normal damage roll on top; adversary crits on reaction rolls give no bonus; adversaries otherwise do not make action rolls — the GM converts an adversary's uncertain action into a PC reaction roll to keep agency with the players. Three lanes ranked this the most-repeated act of the night; the committed doc names the gap in one table cell and builds nothing.

- The Fear numbers and the stacking rule: start at 1 per PC, cap 12, carries between sessions; +1d4 short rest, +1d4+PCs long rest; five spends whose costs stack, with the Core Book's four-Fear worked example; an Experience costs 1 Fear and can be spent on an attack roll, a reaction roll, or the Difficulty of a PC's roll against that adversary.

- The chapter-head categorisation source: shared/parsers/rules.ts lines 90, 141, 171, 188 recognise CORE MECHANICS / RUNNING AN ADVENTURE / ADVERSARIES AND ENVIRONMENTS / ADVERSARIES BY TIER and mark them {drop: true}; the SRD's own two-level table of contents on folio 2 is never extracted; every second-level entry under RUNNING AN ADVENTURE already exists as a section id. This is a licence-clean taxonomy the shipped build already sees and discards.

- The 'decided against, do not fix' inventory: :2148 no fourth SEARCH verb (survived rebuttal), :2397 the reference is not switchable, :2386 the Difficulty ladder is deliberately not attached to the player's DIFF box, the merchant not persisting its stall, END SCENE armed unconditionally, Fear pips off on a phone, the 34px ✕ knowingly under the tap floor; plus :2122 (no store action sets the combatant list wholesale) as the store change the roll-outcome build must ride on, :2613 and :3079.

- Three settings switches delete the app's only rules search — GmBar.tsx:145 drops SHOW when liveDoors(prefs) is empty, so turning off bestiary + party board + merchant removes RuleSearch entirely; prefs.gmSection (prefs.ts:185) removes the whole GM half; and no screen outside src/ui/gm/ has any route into dataset.rules.

- The alias/synonym measurement: a 22-entry table at 424 bytes fixed exactly one of BM25's three failures; 33 of 75 natural GM words (44%) appear nowhere in the SRD rules text. And the two mechanisms the doc dropped from lane 04's three-tier cascade — the keyword+synonym tier (~3 KB) and the decision tree (~1–2 KB), the latter argued as the only thing that can answer 'what Difficulty?' because it asks the question retrieval cannot.

- The catalogue's runtime degradation ladder — heading gone → draw the section whole and say so, never fuzzy-match; section gone → the Unresolved pattern at SessionBody.tsx:601 PLUS pre-filling the search field with the question's own `also` terms so a dead pointer becomes a live search — and its coverage arithmetic (269 anchors across 80 sections, 145 across the 46 mid-scene ones, a toy below about twelve entries).

- The seventeen- and ten-phrasing measurement tables in itemised form, and the two prototype search fixes with their named failure cases (term-AND ranks `death` above `downtime` because 'get' became required; idf-OR ranks `witherwild-session-zero` first for 'a PC hits zero HP').

- Lane 11's twenty-question tap test with its score (6 of 20 in one tap, 14 in two) and its two useful breakages — that the SRD does not answer the once-per-turn spotlight question, and that the 1d12 objectives table is a hot answer trapped in a cold category — plus the `cover`/`discover` 12-section collision.

- The out-of-fight campaign layer: session zero's timetable and CATS with the 12-tone list, Lines and Veils and the X-Card and their third-party credits (Ron Edwards, John Stavropoulos) with the open question of whether the app may name them at all; Backstory Notes and Tying Backstories Together; the A/B/C plot promotion rule; the four-question battle prep order; the six new-character connection questions; and the Core Book's paper action tracker whose SRD label 'Using Visual Aids' (engaging-your-players p.112) is quotable with a true stamp.

- The environment's mechanical identity: no HP/Stress/thresholds, a source of GM moves, the SRD's fourth type being Events 'rather than physical spaces', 6 of 19 shipped environments being Events and four of those being fights, trivial re-tiering (Difficulty 11/14/17/20 by tier) as an affordance an adversary cannot have, Castle Siege's Reinforcements! / Collateral Damage / Siege Weapons cross-references, and 74 of 93 potentialAdversaries resolving by exact name.

- Social conflict, chases and long-term clocks in their actual content: 1 Stress per successful social action (2 on a crit), a filled track concedes, a consequence countdown as NPC patience, and engine/encounter.ts pricing a Social adversary at 1 Battle Point on a Bruiser's card; the chase pair's 1/3/5 lead offsets and the open question of whether shipping 3-lower as an unexplained default is smuggling; 4–12 boxes with an authored beat each, alternating softer and harder, with ticks pre-marked as where news reaches the party.

- 58 of the 73 unmeasured-pixel claims, including: FearPool already dropping its twelve pips at 369px; GmBar's verbs occupying 560–820px so a fourth REST verb must be measured against that band; Reference.tsx's 367.00px measured column; the session list's 54.00px shut row and 62.00px step measured over a 24-row six-kind fixture; lane 11's 308px / 1100px / 880px / 704px category arithmetic; the 0.172 ms / 3000-iteration searchRules baseline needing re-measurement at 259 units; the open scene row's flexWrap strip whose wrapped height has never been measured; and the warning that a part-open list breaks useSessionDrag's absolute-target arithmetic.

- 69 of the 78 raw owner questions, notably: whether one extra tap per roll for four hours is acceptable at all; whether labelled Fear spends are unwanted because they remove the GM's ability to fudge silently; whether the app may ENFORCE an uncitable Core-Book rule; whether a between-sessions prep mode is a needed third surface Layout B does not have; whether an ended session is archived or cleared given IndexedDB has no ceiling and no eviction story; whether the existing `note` SessionItem is promoted or a second scoped kind is added; whether the +4% bundle should wait BEHIND the open P3-4 precache lane rather than land on top of it; and whether the catalogue's questions should be written in Italian against English SRD answers.

- Lane 12's [LICENCE]/[READING] marking discipline and three licence points: §11.1/§11.3 making the pinned SHA-256 the evidence of which licence version this release shipped under (keep pinning it every release); §2.2 forbidding downstream terms, so the JSON dataset must never be presented as MIT even though the code is; and the [READING] against charging money, paywalling, or accepting access-tied donations.

- The numeric disagreements between lanes that the judge resolved silently: 127,844 vs 127,923 corpus characters; 259 vs 269 vs 131 vs 656 addressable units depending on the atom; the Witherwild at 11 vs 12 sections and 4,539 words vs 27,679 vs ~28,000 vs 28,549 characters; 417 vs 495 adversary features. Anyone turning one of these into a test fixture needs to know which lane measured what.
