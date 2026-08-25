# Progetto — scene, sezione regole, domanda locale (`wf_d5464f24-a49`)

> Prodotto da 13 agenti in **sola lettura** sul branch `beast-sheets`. Nessuna modifica
> applicata. Tre lettori sul Core Book, un audit di `src/ui/gm/`, tre angoli sulla sezione
> regole, tre sulla domanda locale (incluso uno scettico pagato per demolirla), una lane
> licenza, e un giudice che ha deciso invece di fare la media.
>
> Le domande al proprietario sono in coda a questo file.

---

> **What this is.** Nine lanes read the Core Book, audited the shipped DM section, designed the rules reference three ways, attacked the question box from three sides, and checked the licence. This is one design, with the conflicts decided rather than averaged. Every decision I took myself is marked **DECIDED**; everything left is in `questions`.
>
> **Read only.** Nothing in the repo was changed. I verified five load-bearing claims directly against the tree; they are marked ✓ where they appear.

---

## 1. What a GM does, and where this app helps

The Core Book's loop runs at three clocks. Software should be built around the innermost one, because it fires every 30–90 seconds for four hours:

1. The GM frames a scene and answers questions.
2. A player declares an action. The GM's first decision is **whether a roll happens at all**.
3. If it rolls, the GM sets a Difficulty and the dice resolve into **one of five outcomes**.
4. That one value simultaneously decides: who narrates, whether Fear moves, how hard the GM's move is, how far every standard countdown ticks, and how far every dynamic countdown ticks.
5. The GM turn opens — one move free, more bought with Fear, the same adversary not normally twice.
6. The spotlight returns to a PC.

### What is already good, and should not be re-spent

This matters as much as the gaps, because the temptation with a list this long is to rebuild things that are finished.

- **The rules honesty is total.** Every string on the reference is read out of `data/srd-1.0.json` at draw time with its own page stamp. `TIER_BENCHMARKS` was *deleted* rather than wired, because it had silently dropped a `+`. The four advancement cells the SRD gives no number for are printed and are deliberately not buttons. App-computed figures are drawn in `--dim`, prefixed `≈`, with `COMPUTED BY THIS APP` in the same element.
- **The arithmetic lives in the engine.** `computeBudget` owns battle points, `deriveStats` owns Evasion and thresholds, `severityFor(amount, thresholds)` ✓ exists at `src/engine/damage.ts:163`, a Minion entry is counted as bodies rather than rows in all four places that count it.
- **Records this build cannot read survive it.** An unresolved roster ref costs nothing and says so; an unreadable session row is kept byte-for-byte; the party board's `AS IMPORTED / YOUR COUNT` stamp is the most honest thing in the app.
- **The licence scaffolding is the best-executed part of the legal posture** — version pinned, SHA-256 of the source PDF recorded, both licence texts compiled into the bundle so they work offline, one canonical attribution string enforced by a test.
- **`RuleSearch` covers all 80 sections with no index**, splits title hits from body hits rather than inventing a relevance score, and marks the query in the line's own characters. Its refusal to rank is correct and survives this plan.

### Where the GM is carrying something the app could take

Ranked by how often it bites, minute by minute:

| Moment | What the app does |
|---|---|
| The roll lands | Nothing consumes the outcome. Fear is a `±1` nudge; each standard countdown is a separate manual tap. |
| The GM takes the spotlight | `spotlighted` is a free boolean with no turn boundary, no cost, no link to the pool. |
| The GM needs a move | The move list is a Reference destination — a tab switch, mid-sentence, with five people waiting. |
| The adversary attacks | No d20 exists anywhere in `src/ui/gm/`. Evasion and the attack modifier live in two full-screen dialogs that cannot be open at once. |
| The player says "26" | Three static numbers beside a track the GM taps by hand, while `severityFor` sits unused. |
| "What does this thing want?" | Motives are on the bestiary card. The combatant card — the one actually on screen — has none. |
| The party rests | No rest gesture exists. Worse: `Countdowns.tsx:133` ships the hint *"Advances across downtime and between sessions"* on a kind nothing ever advances. |
| A PC marks their last HP | The board tracks it. Nothing happens. `DeathMove.tsx` and `engine/death.ts` already exist. |

### The one architectural conclusion

**Everything above hangs off a single event the app never receives: which of the five outcomes a roll produced.** Six of the gaps collapse into one build.

**DECIDED — a five-outcome bar does not violate "nothing advances by itself."** I read the docblock ✓. It says, in its own words:

> *"the app still does not know the outcome — so it prints the five outcomes and the GM presses the one that happened. Architecture 3.2's* proposta, mai automatismo*: the proposal is drawn, the decision is a thumb."*

The file already ships six pressable chart cells doing exactly this, per countdown. A bar is that pattern applied once instead of N times. What the rule refuses is the app *guessing that a trigger fired*. A thumb on `SUCCESS WITH FEAR` is not a guess.

With one refinement that keeps the rule exactly: **the press applies only what the SRD states without judgement, and proposes the rest.**

- **Applied:** Fear +1 on any Fear result (SRD `using-fear`, unconditional). Every *standard* countdown +1 (SRD `countdowns`, unconditional, regardless of result).
- **Proposed:** every *dynamic* countdown, drawn with its chart row pre-selected and one tap to confirm or veto — because the chart gives a range, and four of its ten cells give no number at all.

That split is principled, checkable, and stated in one sentence in the docblock.

---

## 2. Scene management

### Build now, regardless of the `:3136` answer

Every one of these is additive to a component both designs keep. None touches the schema.

1. **Motives on `CombatantCard`.** All 129 adversaries carry them; `AdversaryBlock` already prints `MOTIVES & TACTICS`. The card that decides what the monster does has none. One line, one component that already receives the whole `Adversary`.
2. **Impulses and potential adversaries in `EnvironmentBand`.** `EnvironmentBlock`, forty lines below in the same file, draws both. The bestiary currently shows the GM more about a place than the live scene does.
3. **The derived Difficulty for Ambushed and Ambushers.** Both store `difficulty: 0` and the band suppresses the readout — correct, since 0 is a lie — but prints no substitute, so the field reads as absent. Print `DIF 13 — FROM THE STRONGEST ADVERSARY HERE`, or say the place has none of its own.
4. **`SEND` names the environment it carried over.** `Encounter.tsx:542` spawns to the board and calls `setRegion('scene')` without touching `environmentRef`, so a fight silently opens in the *previous* scene's place. Under design B this becomes a bug to fix; under design A the call disappears. **The on-screen sentence naming the carried-over place is correct under both and can ship today** — and it is the thing most likely to make the owner's answer obvious at the table rather than in a document.
5. **`END SCENE` says what it ends.** `clearScene` empties combatants and leaves the environment standing ✓ — the app quietly answering the owner's own question in the direction of "a scene is the fight," in the one control whose docblock argues hardest about everything else.
6. **The damage field.** A number entry on the card → `severityFor(amount, thresholds)` → marks 1/2/3 HP, with the existing `NO THRESHOLDS · ANY DAMAGE DEFEATS` branch honoured. The same field does Minion overkill division when the target is a Minion group.
7. **The GM turn as an object.** Start/end, who has acted, what it has cost. The once-per-turn cap is Core-Book-only, so it ships as *structure*: the control simply does not offer an adversary that already acted this turn. No text quoted. `Relentless (X)` raises the cap.
8. **Fear spent from the thing being paid for.** `spend 2 · Group Attack` on the card, decrementing by the printed cost, with the SRD's scene-intensity budget (0-1 / 1-3 / 2-4 / 4-8, `using-fear` p.65) beside the pool as an intent and a spent-this-scene readout against it.
9. **The party-size disagreement made visible.** `prefs.gmPartySize` ✓ drives the battle-point base, every Minion expansion, and long-rest Fear, and is read in six places while `party.length` never feeds it. **DECIDED — do not derive it** (a GM may keep an absent player's sheet on the board); make the disagreement visible where the number is used: `BUDGET FOR 4 · 5 SHEETS ON THE BOARD`.

### What waits on the answer

Linking a fight to a place; nesting; turning `potentialAdversaries` into a tap that adds to *this* scene's roster; environment features that summon a named adversary or shift to another environment; the social-conflict track; the encounter objective field. All of these need to know which record owns what.

### My reading of the question itself

The SRD answers it, quotably, at p.102: *"Environments represent everything in a scene beyond the PCs and adversaries."* **The scene is the container; the environment is one of three things in it.** And the app already works that way in one place — `GmBoard` holds `environmentRef` + `combatants` + `roster` together. Neither *stored row* is a scene. **The board is.** Design A is that reading given a name; design B keeps the plan's existing vocabulary and pays for it with a cross-reference.

I recommend A, with the converter that keeps `encounter` readable rather than rewriting it. Reasons in `questions`.

---

## 3. The rules reference

### Stated first and plainly: almost none of this is new work

**The reading half is finished and good. What is missing is an index.**

- `ruleBlocks(body)` already splits every section at its `## ` subheads. `blockNamed` already fetches one. `ruleSection` already returns `SectionView.blocks[]`. `BlockView` already draws one, handling prose, bullets and pipe tables. All of it is in production, used by the Reference topics, `Conditions.tsx`, `DeathMove.tsx` and the `LINK → Rule` session row.
- 80 sections carry 189 `##` subheads across 44 of them → **259 addressable units**, median ~47 words, ~201 under 120 words. That is answer-length text, already written, already page-stamped.
- The complete enumeration of the corpus already exists in the product — as a native `<select>` seven taps deep inside the ADD form. It is the sharpest "built and not findable" fact in the exercise.

So the build is: **a stable unit id, a browse tree over ids the book already wrote, and a search that returns units instead of sections.** No new parser, no new renderer, not one new line of rules text.

### The taxonomy — DECIDED

Two lanes proposed two trees. I take the cheaper and more honest one.

**Browse is the book's own order, cut on page runs.** Six groups, 80 of 80 sections placed, zero editorial judgement, zero app-authored taxonomy sitting over SRD prose:

| group | pages | sections |
|---|---|---|
| THE BASICS | 3 | 4 |
| MAKING A CHARACTER | 4–18 | 6 |
| PLAYING | 35–43 | 23 |
| GOLD | 62 | 1 |
| RUNNING THE GAME | 63–113 | 35 |
| THE WITHERWILD | 113–118 | 11 |

One caveat that must go in the docblock rather than be discovered later: five cuts are pure page runs, but **p.113 holds both `campaign-frames`/`projects-during-downtime`/`extended-downtime` and the Witherwild opener**, so that one boundary needs an id-prefix tiebreak.

**I rejected the ten-category semantic tree** (THE ROLL / HARM / YOUR MOVE / …). It is a better answer to "I don't know what it's called," but it requires app-authored category names, a cross-reference mechanism for the four entries with two homes, an alias list, and a hot/cold band that is a judgement rather than a measurement — all of it the app's words sitting in the same list as the book's, which is precisely the confusion the citation rule exists to prevent. **The "I don't know the word" case is answered by the question catalogue in §4 instead**, which is honest about being the app's words because it asks rather than asserts.

**I rejected the hand-curated 131-entry explode list.** A list of "which 19 sections split" is editorial maintenance that must be reviewed on every dataset rebuild. Split mechanically at `##` — the SRD already wrote its own index. The taxonomy lane's real objection (some blocks are items of one list, and nobody looks up `HOLD ON GENTLY` alone) is answered by browse's second level being the *section*, not the unit: you reach a section, and short subheads read as a scannable list inside it.

### The fragment problem, and its fix

Splitting at `##` can hand back a fragment whose meaning lived in the lead. `difficulty-benchmarks` is exactly this: two lead paragraphs carry the "Difficulty score, plus one relevant Experience modifier" rule, above six subheaded trait tables. A GM who opens `## Agility` alone has the table and not the rule.

**A non-lead unit always draws its section's lead above it, folded shut** — one 44px row labelled with the section title. `Fold` with a `summary`. No new component.

### The search — DECIDED

Three changes, none of which rank:

1. **Multi-term.** ✓ Confirmed at `srdReference.ts:1031`: the whole query is normalised and passed to `.includes()`, so it matches a *phrase*. Measured by two lanes independently: **10 of 10, and 11 of 17, natural GM phrasings return zero hits.** `falling damage` returns nothing while the SRD carries a subhead reading `FALLING AND COLLISION DAMAGE`. A blank screen is the worst possible answer, because it reads as *"the SRD does not cover this."* Fix: split on whitespace, drop stopwords, require all remaining terms. On zero results from AND, fall back to OR **with the group header saying so** — `NO SECTION CARRIES ALL OF THOSE WORDS · THESE CARRY SOME`. That is honest and needs no relevance score.
2. **A heading band.** Three groups: `IN A HEADING` / `IN THE TEXT` / `IN A TABLE`, each with a count, each the data's own split. One weighting only, inside the heading band: word-boundary matches sort above mid-word ones. **This is not the app deciding which rule you meant — it is `rest` being a word and `RESTRAINED` not being that word.** Measured: `rest` currently produces zero title hits, so `downtime` (whose title contains no "rest") sits somewhere in a flat list of 20; and `vulnerable` returns `character-creation` first, matching inside *Invulnerable*, in a list of Experience names the SRD says are too broad to allow.
3. **A hit opens at its unit**, not at the top of a 10,879-character section.

### Field placement — the two lanes were both right

`RuleSearch.tsx` argues at length, correctly, that the field must be the last element of the SHOW sheet: the sheet is bottom-anchored, grows upward from the thumb that just pressed SHOW, and the field does not move as hits fill in above it.

**DECIDED: that argument is sheet-specific and does not transfer.** The SHOW sheet's field stays exactly where it is. The REFERENCE surface's field goes top and pinned, because a tab body is top-anchored and a field at its foot moves as results arrive. Two doors, one renderer — the codebase's own rule. The docblock must be rewritten to say the argument is about the sheet, rather than be silently contradicted by code above it.

### Memory — DECIDED

- **The query: remembered nowhere.** A half-typed phrase from an hour ago is worse than an empty field.
- **Open/closed folds: component state.** `Fold.tsx`'s argument verbatim — nobody arranges a lookup.
- **RECENT (last 8 unit ids) and PINNED (ordered ids): `prefs`.** The `playSections` precedent settles it: a device fact, small, synchronous, free to lose, must not ride out in a `.dhchar` export, must not bump `CAMPAIGN_SCHEMA_VERSION`. Written when a unit is *opened*, not scrolled past; opening a pinned unit does not push it into RECENT.
- **The eight curated renderers become eight seeded pins.** `DifficultyLadder`, `CountdownChart`, `FearGuide` et al. all survive as components — they are genuinely better than the raw block. What retires is `REFERENCE_TOPICS`: a `const` **whose order is a function of its labels' pixel widths**, whose widths are pinned by `gmGeometryProse.test.ts`, and whose ninth entry costs a re-measurement of all eight. Its own docblock records that the width sort costs 50px of scroll at 400/412/414/428/430 and buys nothing at 393. Full-width pin rows delete the apparatus. `gmGeometryProse.test.ts` goes **red rather than stale** — that is the designed signal that the retirement was done properly.

### Orphaned ids

`${sectionId}#${slug(heading)}`, lead unit = bare `${sectionId}`. `tools/build-srd.ts` derives headings from the PDF, so a rebuild can rename one. **A pin that no longer resolves must fail visibly** — *"this pin no longer resolves — remove it"* — never vanish silently. `prefs.playSections` documents two dead keys it deliberately does not migrate, but those were booleans nobody reads; a pin is something the GM put there on purpose.

### The searchability finding that outweighs the taxonomy

`AdversaryList.tsx` filters on name, description, motives and **feature names** — never `f.text`. Same for environments. That is **69,622 characters of adversary feature text across 495 named features searchable by nothing in this app.** Measured: 17 adversaries and 2 environments impose Restrained; 26 and 3 impose Vulnerable; 10 knock a target over. A GM asking "which of these things on my board can Restrain someone?" has no path at all.

**One `||` clause. Highest value-per-line change in the whole exercise.**

---

## 4. The question box

### Verdict

**Yes, there is a way. No, it is not a chat box. The skeptic was right about the mechanism and wrong about the appetite — the owner is feeling a real defect, and it is not an AI-shaped defect.**

Split the idea in two and judge each half.

#### The generative half: ruled out, and not on grounds of caution

Two disqualifying arguments, both upstream of the megabytes:

1. **It cannot carry a stamp, and without a stamp it is an uncited rules claim.** `src/engine/damage.ts:45` — *"Do not print a citation the reader cannot go and check."* Generated prose is by construction not in the dataset.
2. **It makes DPCGL §4.1(e) unanswerable.** The licence requires *"a statement indicating whether you have modified the Public Game Content."* Today the app can answer: every rules string is read out of the dataset at render time. A box that rewrites SRD sentences per query, per device, offline, generates its modification at render time, differently on every tap. **You cannot write a true modification statement about output you have never seen.**

And the practical objection has teeth: a 0.5–1.5B model at Q4 is 350 MB–1 GB against a 3.4 MB app, needs WebGPU, needs sustained GPU load on the device that is also the table's clock, and the weights are invisible to `sw.js` — so the feature does not exist at play time, which is the only time it matters.

The failure mode is the decisive one, though. **A model will answer "how do I run a social conflict" with the Core Book's Stress-track procedure absorbed from training data** — content the owner may read and may not ship — offline, unlogged, confidently, in a dim room, mid-scene. Grepped against the shipped rules text: `surrender` 0 hits, `concede` 0, `chase` 0, `difficulty roll` 0, `nearly impossible` 0, `lines and veils` 0. Those are exactly the questions asked under pressure and exactly the ones the SRD does not answer.

**This project has already shipped a house rule by paraphrase. Twice. By careful humans.** `Wizard.tsx:1539` — *"the caution against a too-broad Experience was a paraphrase of a rule — which is how a house rule gets written by accident."* Both were deterministic, written once, visible in a diff, catchable by a test. Both shipped anyway and had to be reverted. A generated answer is a paraphrase composed fresh on every tap, with no diff, no review, and no test that can see it.

#### BM25 and embeddings: measured, and rejected

- **BM25**: 31.6 KB gzip, +6.8% wire, works *well enough to be dangerous* — 7 of 10 on realistic questions. The three failures are the finding: *"how do I set a difficulty for jumping a chasm"* returned `witherwild-communities`; *"my player is at zero hit points what now"* missed the `death` section entirely, because the SRD says "marks their last Hit Point," never "zero." **A wrong section under a correct-looking `SRD 1.0 · P.n` stamp is the worst artefact this app can produce, because the stamp checks out.** It also reverses a documented position in the exact file it would change.
- **Embeddings**: measured, and the assumption people skip is false — **quantised embeddings do not compress; gzip returns 100.03% of input.** 656 blocks × 384 dims = 252 KB at int8, +54% on a 464 KB app, and it buys nothing alone, because embedding the *typed question* needs the encoder: ~23 MB ONNX + ~10 MB `onnxruntime-web`, roughly 20× the whole application. The only surviving variant — embedding a fixed question list at build time — *is* the curated index with extra steps.

#### What to build: the curated question catalogue

**The governing rule, and the reason this is shippable at all: a catalogue entry stores a question and a pointer. It has no answer field.** There is nowhere in the feature for app-authored rules prose to live, so nothing can drift out of step with the dataset and nothing can carry a stamp it did not earn. The licence constraint is satisfied by the type, not by a reviewer.

```ts
interface AskEntry {
  id: string;                 // stable, e.g. 'q-thresholds'
  ask: string;                // the app's own words, ends in '?'
  also: readonly string[];    // the app's own words — the index
  at: { section: Ref; heading: string | null };   // null = the section whole
  moment: Moment | null;      // null = search-only
}
```

No `answer`. No `page`. No `title`. The page and the title come from the dataset at draw time, so a stamp is never a number typed into this repo.

**Verified against the shipped file:** no section has a duplicate `##` heading, so `{section, heading}` is a unique address; 36 of 80 sections carry no subheads and take `heading: null`; all 80 carry a `sourcePage`, so every anchor prints a true stamp. One lane wrote and machine-checked 48 entries: **48 entries, 0 broken anchors, 0 duplicate ids, covering 30 distinct sections.**

**Where it appears:** as a third group above the two that already exist in the SHOW sheet, which is one tap from `GmBar` and reachable from both Layout B tabs without navigating.

```
  QUESTIONS · 3          ← new, matched on ask + also
  IN A HEADING · 1       ← new band (§3)
  IN THE TEXT · 6        ← unchanged
  [ Search 80 rules sections ]   ← unchanged placeholder
```

**Six moment chips when the field is empty** — `BEFORE THE ROLL` / `THE DICE LANDED` / `MY TURN` / `DAMAGE` / `THIS PLACE` / `BETWEEN SCENES` — because the GM knows what just happened, not what the rule is called. A chip fills the field, so it creates no new state and no new overlay. **Plus the last five entries opened this sitting**, which at minute 140 is the fastest index that exists and costs one in-memory array. That is the half of "chat" that actually helps: the transcript, not the input box.

**Bundle cost.** ~150 entries × ~150 B ≈ 23 KB raw. The corpus's own measured gzip ratio is 35% → **~8 KB gzip, +1.7% on the current 464 KB phone download.** Zero cold start (it is a JS literal).

**One hard constraint on how it ships.** `public/sw.js` infers its precache by regexing built chunks; `JS_IMPORTS` matches **only `.js` and `.css`**. A catalogue shipped as `.json`/`.bin` is never precached — it works on the sofa and is a dead feature in a basement, which is the identical live bug already logged for `public/brand/*` at `BACKLOG.md` P3-4. **It must be a `.js` module reached by an `import()` with a literal specifier.** Confirmed safe: the entry chunk contains literals like `import("./Gm-YPiOsRlH.js")`, so `reachableFrom` walks them and `pruneAssets` keeps them. Note for whoever builds it: **`pruneAssets`' own docblock says the opposite and is wrong** — a separate small correction, but an index author who trusts that comment will wrongly put the catalogue on the boot critical path.

#### The honest failure mode

**Silence, falling through to what exists today.** Words that match no question still run the (now multi-term) section search; the QUESTIONS group simply does not render. Words that match nothing reach the sentence `RuleSearch.tsx` already prints, which is already the right sentence and should not be touched:

> *"No rule in this dataset carries that. The search reads every section's title and its whole text, so a phrase that is not here is not in the rules the app is holding."*

**The placeholder must not become "Ask me anything."** A box that promises comprehension and returns nothing has taught the GM the app is broken. A box that promises coverage and returns nothing has told them the truth. And no *"I have no question for that"* line when the QUESTIONS group is empty but rule hits exist — that would be the app apologising for a result no worse than today's.

#### The rot test

`tests/gm/ask.test.ts`, against the shipped dataset, following `tests/ui/srdReference.test.ts`'s stated principle: pin the book's values in the tests, never in `src`. Seven assertions, each catching a distinct rot: section id exists; heading matches the SRD's own `##` string byte-for-byte; the block resolves with at least one non-empty part; `sourcePage` pinned per entry as a reflow tripwire; ids unique, `ask` ends in `?` and fits one line; every mid-scene section has ≥1 entry; catalogue length pinned so adding one is a deliberate diff.

**What no test can catch, and must be written in the docblock rather than glossed:** content moving from one heading to another while both keep their names. All seven pass and the answer is quietly wrong. The only mitigation is that the card prints the section title, the heading and the page above text the app did not write, so a wrong answer is *visible in one glance* rather than silent. That is the best this shape can do.

---

## 5. The licence boundary

### Permitted

- **The SRD 1.0, verbatim, in whole or in part** (§1.6, §2.1(a)) — which is `data/srd-1.0.json` and every string drawn from it at runtime. Every GM-craft section any lane wanted is in there with a real page number: `making-gm-moves` p.64, `using-fear` p.65, `countdowns` p.69, `guidance-on-action-rolls` p.64, `difficulty-benchmarks` p.66, `engaging-your-players` p.112, `session-rewards` p.112, `downtime` p.41, `projects-during-downtime` p.113, `death` p.42, `optional-gm-mechanics` p.70.
- **Implementing a rule without printing it** (§1.3: "game rules… mechanics, systems, toolsets, reference cards, and stat blocks"). This is what lets every Core-Book-only item in this plan ship as *structure*: the GM turn boundary, the Activation/Advancement/Effect triad, per-tick beats, linked chase pairs, the social Stress track, session-zero records. **The licence is not the obstacle to any of it.**
- **An index, a rearrangement, a composition of two sections** (§1.7 Adaptive Content: "translated, altered, rearranged, transformed"). The dataset is already one.
- **Paraphrase** (§1.3 explicitly licenses game rules "but not a copy/paste"). Permitted by the licence, restricted by the project's own better rule — see below.
- **Owner-authored questions and navigation words**, freely. They assert nothing.
- **Core Rulebook text the user imported themselves**, on that user's own devices only, never across a share boundary. `src/transfer/fileIo.ts`'s invariant — transfer files hold "only refs and values — no rules text, no card text, no art" — is load-bearing and any new export must preserve it.
- **Core Rulebook *page numbers* without the text**, labelled as the Core Rulebook and shown only when the imported layer is present.

### Forbidden

- Shipping the exact text of any manual, handbook or **Campaign Frame** (§1.5(c)).
- Shipping DRP artwork (§1.5(b)); the Compatible mark is the sole exception, as a badge.
- Printing a citation the reader cannot open inside the app.
- Stating or implying endorsement (§2.3, §6.4).
- Any new share/QR/export/backup route that carries imported text or `.dhart` art.

### The three rules an implementer applies without thinking

1. **App-authored text may sit beside SRD text only when it asks or navigates — never when it asserts a rule.** That single line settles the REFERENCE-tab worry three lanes raised, and it settles it in favour of shipping the question catalogue.
2. **A composed screen gets no single page stamp.** `ReferenceTables.tsx` already solved this exactly right for the improvise topic (adversaries p.73 + environments p.102): *"the stamp sits on the table, never on the screen."*
3. **App-computed figures are drawn in `--dim`, prefixed `≈`, with `COMPUTED BY THIS APP` in the same element.** A bare metric figure beside an `SRD 1.0 · P.40` stamp would be the app quoting itself as the book.

### Four things wrong in the tree today

I verified all four ✓.

| | Finding | Cost to fix |
|---|---|---|
| **A** | **The attribution omits §4.1(e).** ✓ `ATTRIBUTION` is two lines — a copyright/attribution sentence and a non-affiliation sentence. No modification statement, and the dataset is plainly a modification (`tools/build-srd.ts` extracted the PDF, slugified ids, split 80 sections, normalised tables). It also gives no URL for the licence itself (§4.1(d)); only About does. **DECIDED — append one sentence** carrying both. One array, one test, six surfaces at once. | trivial |
| **B** | **`manifest.short_name` is the bare Name Mark.** ✓ `name: "Daggerheart Companion"`, `short_name: "Daggerheart"`, `description` uses the mark twice with no "Compatible". §2.5: a Name Mark "cannot be used in the title of a work", "cannot appear on the front cover", and "must include 'Compatible' adjacent to it in marketing and descriptive text." `CompatibleMark.tsx` reasoned about exactly this for the *icon* and never applied it to the *words*. | small — but it is the app's name |
| **C** | **The Witherwild is in the shipped dataset.** ✓ 12 sections, **28,549 of 127,844 characters — 22% of the corpus**, pp.113–118, extracted deliberately by `shared/parsers/rules.ts`, reachable through `RuleSearch` on a public GitHub Pages deploy. | see `questions` |
| **D** | **A homebrew layer can rewrite a rules section and the SRD page stamp survives.** `rules` is in `dataset.ts`'s mergeable `COLLECTIONS`, and the stamp is drawn from the section's own `sourcePage`. **DECIDED — the stamp is drawn only when the section is unmodified by any layer; otherwise the surface names the layer it came from.** | medium, and it changes the stamp API |

**On C, both readings deserve airing before money is spent.** The licence lane's reading: §1.5(c) names Campaign Frames as Prohibited Content, §1.9.3 confines them to actual-play streams, video and podcasts, and §1.5's "unless expressly addressed elsewhere" makes §1.9.3 that address — so a web app is not a licensed channel for them. The counter-reading: DRP put the Witherwild *inside the SRD 1.0*, which §1.6 names in whole as Public Game Content, and §2.1(a) licenses reproducing PGC "in whole or in part" — so §1.9.3 plausibly governs Campaign Frames from the Core Book, not the one they published in the SRD. I cannot settle this and neither should an implementer. It is `questions` item 4.

---

## 6. Build order

Each step names what would prove it. Steps 1 and 3 are independent and can run in parallel; step 2 gates step 4.

### Step 1 — Truth on the glass *(days, no schema, no Layout B dependency)*

- Append the §4.1(e) modification statement and the licence URL to `ATTRIBUTION`.
- `searchRules`: multi-term, stopwords dropped, honest AND→OR fallback with a labelled header. Add the `IN A HEADING` band with word-boundary preference.
- Extend the adversary and environment filters by one `||` to reach `f.text`.
- Motives on `CombatantCard`; impulses + potential adversaries in `EnvironmentBand`; the derived-Difficulty line.
- `SEND` names the environment it carried over; `END SCENE` says what it ends.
- The advancement chart onto `SessionBody`'s `CountdownArm` — the surface a GM opens *because* they are thinking about that clock.
- Party-size disagreement made visible.

**Proves it:** `tests/ui/attribution.test.tsx` extended to assert the string satisfies all five clauses of §4.1 rather than only that it reaches the DOM (today it would pass on a notice that said nothing). A search test asserting all ten natural phrasings that currently return zero now return the right section. A test asserting a Restrain-imposing adversary is findable by the word `restrained`.

### Step 2 — The bar stays on the glass *(the gate)*

> **DONE, 24 August 2026, on `schema-wave-v3`.** Everything below describes the state before
> the fix and is kept as the record of why it was made. The tools now mount `absolute; inset: 0`
> inside a `relative` band between the two bars, `useDialog` no longer traps, and `aria-modal`
> is off the twelve. The present tense below is no longer true of the code. See
> `WAVE3-2026-08-24.md` §5.

`GmSheet` mounts every tool at `size="full"` ✓ — `position: fixed; inset: 0; z-index: 30`, a 55% backdrop, a panel from `env(safe-area-inset-top)+8px` to the bottom. `GmTopBar` and `GmBar` are in normal flow underneath, and `useDialog` traps Tab. **So while the live scene is open, Fear, the pinned countdown, MENU, ADD, SHOW and SAVE are all covered and keyboard-unreachable** — and `FearPool.tsx`'s own docblock asserts the opposite as the reason it exists. That sentence was true before P5-2 made tools dialogs; nothing was moved, and no test asserts it.

This is a constraint for the Layout B lane, not a redesign of Layout B: **whatever THE NIGHT is, it cannot be a `size="full"` modal**, because that is the thing that takes the Fear pool off the glass. Everything live in step 4 is blocked on it.

**Proves it:** a test that mounts a GM tool and asserts the Fear control is in the accessibility tree and tabbable. A real-browser screenshot at 393×852 with the scene open.

### Step 3 — The engine's arithmetic reaches the GM *(parallel with 2; small, high frequency)*

- The damage field on the combatant card → `severityFor`, with the no-thresholds branch, and Minion overkill from the same number.
- The rest control: short → 1d4 Fear; long → 1d4 + PCs and the option to advance one long-term countdown. Every number quotable from `downtime` p.41. This retires the standing lie that a "long-term" kind advances across downtime when nothing in the app ever advances one.
- The death-move prompt on `PartyBoard` when a track fills. `DeathMove.tsx` and `engine/death.ts` already exist; the SRD `death` section is quotable; the GM-side craft (make space, keep them in play, worsen the situation) ships as structure — a row offering *"and the situation gets worse"* as a thing to record.

**Proves it:** engine tests already cover `severityFor`; new ones assert the card marks the right HP for a boundary amount and for the no-thresholds branch. A rest test asserting the Fear delta range and that exactly one long-term countdown is offered.

### Step 4 — The roll-outcome pulse *(the spine; gated on step 2)*

One five-button bar on THE NIGHT. `gmStore` gains one action. Applies Fear +1 on Fear results and +1 to every standard countdown; proposes every dynamic countdown with its chart row pre-selected; sorts the move list soft-first or hard-first. On a success-with-Fear, surface *new obstacle / new enemy / mark a Stress* and bury *clear a condition / take away an opportunity*, so the consequence cannot cancel the success. Beside it, the four ways to answer "do they even need to roll?", quotable verbatim from `guidance-on-action-rolls`.

**Proves it:** a store test asserting one outcome event moves Fear by exactly 1 on the two Fear rows and 0 otherwise; moves every standard countdown by exactly 1 on all five; and moves no dynamic countdown until a second, explicit confirmation. That last assertion is the one that pins *proposta, mai automatismo*.

### Step 5 — The reference index *(no Layout B dependency; ships inside the existing region and moves with it)*

`ruleUnits()` and stable ids → re-point search at units → the six-group browse tree with the p.113 tiebreak → `prefs.gmRecentRules` / `gmPinnedRules` seeded with the eight → retire `REFERENCE_TOPICS` and its width sort.

**Proves it:** a test asserting 259 units with unique ids and that every unit resolves through `ruleSection`. `gmGeometryProse.test.ts` goes red — that is the designed signal, not a regression.

### Step 6 — The question catalogue

48 entries + the seven-assertion rot test → the QUESTIONS group → moment chips and the sitting's recents → grow toward ~150.

**Proves it:** the rot test, run in CI against the shipped dataset. A test asserting the catalogue chunk is precached (build, install the worker, go offline, hard-reload, confirm it is served from `dhc-assets-v1`) — **this one must be run in a real browser, because the claim contradicts `pruneAssets`' own docblock.**

### Step 7 — The schema wave *(one migration, everything at once)*

`CAMPAIGN_SCHEMA_VERSION` 2→3 is a converter, fixtures, exported files and three test suites. **Do it once.** Whatever the owner answers to the scene question, the session-lifecycle question and the countdown-triad question, they land in the same bump:

- the scene/fight resolution;
- `Campaign.session` gaining a lifecycle — a plan that can be closed and a durable record beside it, which six other items have nowhere to write to until it exists;
- the countdown triad (Activation / Advancement / Effect), an owner field, per-tick beats for long-term clocks, and the linked progress/consequence pair with a plain numeric head start;
- the encounter objective;
- the durable record of people, places, facts and the table's agreements.

**Proves it:** a `v2 → v3` fixture pair; `campaignSchema.test.ts` asserting an unreadable row survives byte-for-byte; a round-trip export test asserting no rules text, card text or art enters the file.

---

## 7. The pixel claims that need a real browser

**jsdom measures nothing.** Every item below is unmeasured and must not be treated as settled.

**Blocking — these decide whether a design works at all:**

1. That a `size="full"` `GmSheet` actually occludes `GmTopBar` and `GmBar` at 393×852, and by how much. The structure is certain from the CSS ✓; the pixel band is not.
2. Whether a five-outcome bar (Crit / S+Hope / S+Fear / F+Hope / F+Fear) fits one row at 393px beside or above ADD/SHOW/SAVE without dropping below the 44px floor — and what it costs the session list underneath.
3. Whether a `CombatantCard` carrying a motives line **and** a damage-entry field still leaves two cards legible on one screen, and stays under the ~330px one-handed sweep.
4. Whether the service worker actually precaches a dynamically imported catalogue chunk. Build, install, go offline, hard-reload. **This contradicts `pruneAssets`' own docblock and must be tested, not trusted.**

**Layout and reach:**

5. Whether six browse-group rows plus a pinned 44px field plus the tab bar leave the tree reachable without a scroll on first paint.
6. Whether a third QUESTIONS group pushes the first rule hit below the fold. The sheet caps at 717.4px at 393×852 with nine of twenty-two hits visible before the first scroll; a group header plus N question rows eats into that nine.
7. Whether six moment chips fit the sheet's 363px inner column. Arithmetic only: six chips at an 8px gap is 53.8px each — clears the tap floor for width but will not hold `BETWEEN SCENES`, so it is probably a 2×3 grid whose wrap height is unmeasured. **H-9 forbids a rail, so overflow is not a fallback.**
8. Whether the 256px advancement chart is reachable one-handed once it moves onto a session countdown row.
9. Whether a derived-Difficulty readout fits the environment band's header row at 393px alongside tier, type and the features chip.
10. Whether an open scene row carrying an environment select, a roster with stat-block folds and OPEN THE SCENE is usable. `useSessionDrag` measures the shut pitch at 62.00px and the first open scene row at 384.72px; design A roughly triples what that arm draws, and 384.72 is the number that moves.

**Legibility and input:**

11. Whether the six `difficulty-benchmarks` trait tables (widest raw line 213 chars) read at 393px without the page body scrolling horizontally.
12. What a phone keyboard does to a top-pinned field, and whether an answer card lands above or behind it. `RuleSearch.tsx` records that its own measurements stopped at exactly this line for want of a device.
13. Whether `<mark>` at `--text` weight 700 with a cleared background is findable at a glance in a dim room across three result bands rather than one.
14. `--control` at 34px on hybrid pointers across the GM screens — already open in `BACKLOG` as blocked on measuring at the `hybrid` profile.
15. Whether the licence footer is actually *readable* at the end of each screen's scroll on the deployed build, and how `short_name` renders as the installed home-screen label on iOS and Android. The jsdom sweep proves the string is in the DOM, not that a person can read it — and the home-screen label is the §2.5 question, answerable only by installing the PWA.

---

# Le domande al proprietario


## 1. Is a row in tonight's plan "the Sablewood gate, with six goblins in it" — one row that is a place and its fight together — or is it "the Sablewood gate" and, separately, "six goblins", two rows you put next to each other? (BACKLOG :3136)

**Perché:** This is the block. It gates the social-conflict track, the encounter objective field, whether environment features can act on the fight beside them, what END SCENE means, whether `describeItem` has one arm or two, whether nesting is worth building at all, and whether adjacency-destroyed-by-a-drag is a defect or the design. Guessing it wrong means writing a schema migration twice. The SRD answers the rules question at p.102 — the scene is the container, the environment is one of three things in it beside the PCs and adversaries — and the app's own `GmBoard` already works exactly that way, unnamed. But that is a fact about the board, not about your plan, and the plan is what you type into.

- **A — one row. The scene arm gains the encounter's three fields; keep `encounter` in the union as a legacy kind you can still read and edit but no longer create.** **(consigliata)** — One row per beat of the night. "This fight happens here" becomes a stored fact instead of an adjacency a drag destroys. `Relative Strength` becomes computable, potential adversaries become one tap into this scene's roster, END SCENE gets one meaning, and the nesting question largely evaporates — what people wanted to nest stops being two rows. Cost: schema 2→3, a much fatter open arm (the 384.72px measurement moves and needs re-measuring), and a permanently wider `SESSION_ITEM_KINDS` union. No saved campaign changes the kind of a thing you named.
- **A′ — one row, and rewrite existing encounter rows into scene rows with `environmentRef: null`.** — Cleaner union, no legacy arm to maintain. But it changes the kind of a thing you named, which the migration chain has never done — today's sole converter changes no field at all. It sets a precedent for future migrations that is hard to walk back.
- **B — two rows. `encounter` gains an `environmentRef`.** — The cheapest real improvement on the table: one field kills the silent-wrong-place defect and makes `Relative Strength` computable. The converter fits the existing precedent exactly and the v3 fixture is v2 plus one key. But nesting stays fully live and gets harder, and it opens the app's first dangling *internal* reference — a scene row deleted while an encounter still names it.

## 2. Under Layout B, is THE NIGHT a tab that keeps the Fear pool, the pinned countdown and ADD/SHOW/SAVE on the glass — or does the live scene stay a full-screen modal?

**Perché:** *(Answered and fixed on 2026-08-24; this records the reasoning, not the code.)* Verified in the CSS at the time: every GM tool mounted at `position: fixed; inset: 0; z-index: 30` with `useDialog` trapping Tab, so while the scene is open Fear is covered and keyboard-unreachable — and `FearPool.tsx`'s docblock asserts the opposite as the reason the bar exists. That sentence was true before P5-2 and was never revisited. It costs three gestures per Fear spend, forty-odd times an evening, and it blocks the roll-outcome bar entirely (the bar fires on every roll and lands its effects on three regions, so it must act without navigating). No test asserts it, which is why it went unnoticed. Layout B is being designed by another workflow right now, so this needs to reach them as a constraint before they finish.

- **A tab. Hand this to the Layout B lane as a hard constraint: THE NIGHT is not a modal, and the bar stays on the glass beneath it.** **(consigliata)** — The correct end state and the one Layout B was chosen for. Everything live — the outcome bar, the Fear ledger, the rest control, the death prompt — unblocks. Cost: step 4 of the build order waits for Layout B to land.
- **A tab, plus a minimal fix now so the pulse is not blocked — raise `GmBar` above the sheet, or make the scene region non-modal ahead of the tab work.** — Unblocks the highest-value build immediately and the fix is thrown away when Layout B lands. Risk: it is work in territory another workflow is actively designing, and two hands on the same layout is how a merge conflict becomes a design conflict.
- **The scene stays a modal and the Fear controls are duplicated inside it.** — Fastest, and against the pattern used everywhere else in this app — there is one drawing of every control, and "a fold is a second door, never a second copy" is a written rule. Two Fear steppers is exactly the confusion that rule exists to prevent.

## 3. Is this app Shared under the DPCGL, or is it private play?

**Perché:** This is the root of all three licence questions and it changes what the other two cost. §1.8 is explicit that "public" excludes "private, non-commercial play among friends, family, or gaming groups in a personal setting", and content used only there "is not considered Shared under this License." A public GitHub repo and a GitHub Pages deploy are Shared. If it is private-only, the format question and most of the Witherwild question dissolve. If it is Shared, a PWA is not among §1.9's Permitted Formats — not print, not stream, not podcast, not a whitelisted VTT — and §2.1(b) licenses Adaptive Content "solely in the Permitted Formats." Nothing in the repo has ever reasoned about this; README's Legal section reaches attribution and the Core Rulebook and stops.

- **Shared, and resolve the format question — check the current Whitelisted VTT list, then write to DRP for written approval.** **(consigliata)** — Slowest to certainty and the only path that ends with a written answer. Costs an email and a wait. Nothing in this plan is blocked while you wait, because none of it makes the exposure worse.
- **Shared, and proceed knowingly on the reading that §2.1(a) — "reproduce and Share the Public Game Content in whole or in part", with no format limit stated — covers verbatim SRD reproduction in any medium, and that the app is a §1.3 "toolset".** — Defensible, and it is the reading the app has implicitly operated under since day one. Records the risk as accepted rather than unexamined, which is itself worth something. Leaves the §1.9 argument unmade if it is ever tested.
- **Private play. Take the Pages deploy down and keep the build for your own table.** — Resolves the format question, the Witherwild question and the §2.5 naming question at a stroke — §1.8 says none of it is Shared. Costs the public deploy and the public repo, which is most of what makes the project a project.

## 4. The Witherwild campaign frame — 12 sections, 28,549 characters, 22% of the shipped corpus, pp.113–118 — is in `data/srd-1.0.json` and reachable through rules search on a public deploy. Strip it, ask DRP, or keep it knowingly?

**Perché:** Verified: 12 sections totalling 28,549 of 127,844 characters, extracted deliberately by `shared/parsers/rules.ts`. Two readings and I cannot settle between them. Against keeping: §1.5(c) names Campaign Frames as Prohibited Content, §1.9.3 confines them to actual-play streams, video and podcasts, and §1.5's "unless expressly addressed elsewhere" makes §1.9.3 that address. For keeping: DRP published the Witherwild *inside* the SRD 1.0, which §1.6 names in whole as Public Game Content, and §2.1(a) licenses reproducing PGC "in whole or in part" — so §1.9.3 plausibly governs Core Book frames, not the one they put in the SRD. This is the only item in the whole exercise that could end the project, and it is also the one where a wrong pre-emptive strip costs a fifth of your corpus for nothing.

- **Ask DRP in writing, keep the sections in place meanwhile, and put the Witherwild last in the browse tree so its presence is visible rather than buried.** **(consigliata)** — The only path to an answer. Keeps a fifth of the corpus while you wait, and the browse tree makes the exposure obvious to you rather than hidden behind a search box. Do this in the same message as the format question.
- **Strip now from `data/srd-1.0.json` and from `shared/parsers/rules.ts`, and ask afterwards.** — Zero risk immediately. Costs 22% of the corpus, a dataset rebuild, and the re-stamping and test churn that comes with one — possibly for nothing, if the answer comes back permissive.
- **Keep it, record the reading in README's Legal section, and proceed.** — Free, and it at least converts an unexamined position into a stated one. Leaves the strongest objection unanswered on the item with the highest downside.

## 5. Does `Campaign.session` get a lifecycle — a plan that can be closed and a durable record beside it?

**Perché:** `Campaign` is `{ name, fear, session, party, board }` and `session` is one flat array edited in place forever. Fear and countdowns carry, which is correct and is the half that already works. Nothing else does: `gmStore`'s action list runs `setRegion` to `removePartyMember` with no `endSession`, no archive, no rollover. So last week's rows are still sitting there this week, in the same order, with no mark saying which were played — and there is no moment at which a GM would ever write down "they never went north", which is the whole of the between-sessions loop. Six items have nowhere to write until this exists: the people and places the table invented, the table's agreements, the arc/plot state, what tonight was meant to give, what the party walked past, what levelled. It is the same 2→3 bump as the scene question, so the two decisions should be taken together and shipped once.

- **Yes — a session can be closed, its rows archived with what happened, and a durable campaign record sits beside the plan.** **(consigliata)** — Unblocks roughly half the durable-record work in one migration. Costs the converter, new fixtures, three test suites, and every exported file. Take it in the same bump as the scene answer.
- **Yes, but minimally — a session boundary and an archive of played rows, with no new record fields yet.** — The smallest change that makes "tonight" a real thing. The people/places/agreements record then needs a second bump later, which means paying the migration ceremony twice.
- **No — the plan stays one editable list.** — No migration, no risk, and the between-sessions half of a GM's work stays on paper somewhere else. Six items on this plan are closed permanently rather than deferred, and that should be a decision rather than a backlog entry.

## 6. §2.5 says a Name Mark cannot be used in the title of a work, cannot appear on a front cover, and must carry "Compatible" adjacent in descriptive text. `manifest.short_name` is the bare word "Daggerheart". Rename?

**Perché:** Verified: `name: "Daggerheart Companion"`, `short_name: "Daggerheart"`, `description` uses the mark twice with no "Compatible" anywhere. `short_name` is the label under the icon on a home screen — the bare mark alone, which is the closest thing a PWA has to a cover. `CompatibleMark.tsx` reasoned about exactly this hazard for the *icon* — "an app whose home-screen icon is the official logo reads as an official app, which this is not" — and the same reasoning was never applied to the words. This is the most concrete, most easily-checked non-compliance in the tree, and it is on the outside of the product where anyone can see it. It is also your app's name, which is why it is yours and not mine.

- **Change `short_name` away from the bare mark and add "Compatible" to the description; leave `name` and the repo alone.** **(consigliata)** — Fixes the sharpest half — the home-screen label and the descriptive text — for the cost of two strings and a manifest test. Leaves the "in the title of a work" argument open, which is the arguable half.
- **Full rename: a title that does not lead with the mark, with "Daggerheart Compatible" as the descriptor.** — Unambiguously compliant. Costs the name, the repo, the deploy URL, and whatever recognition the project has.
- **Leave it, on the reading that an app's title is not a "work's title" in §2.5's sense.** — Free, and the reading is not absurd. But `short_name` is hard to defend under any reading — it is the mark, alone, under an icon, with nothing adjacent.

## 7. Where do your own words live — session-zero agreements, the people and places the table invented, arc notes?

**Perché:** Three separate lanes proposed putting owner-authored prose on the REFERENCE tab, and `Reference.tsx`'s header currently means one specific thing by that word: "the SRD, drawn live from the dataset, never transcribed." Mixing owner prose into that scroll is the exact confusion the citation rule exists to prevent. I have already decided the rule that covers the question catalogue — app-authored text may sit beside SRD text when it *asks or navigates*, never when it *asserts* — and a question carries no stamp and asserts nothing, so the catalogue is fine. But lines and veils, an NPC's description and an arc note all assert something, and they are also the material a GM most needs one tap from a live scene. This decides where six items in the durable-record wave get built, so it should be settled before the schema bump, not after.

- **A third home. The table's own record is campaign data behind its own door, never in the same scroll as SRD prose, with a fast door from THE NIGHT for lines and veils.** **(consigliata)** — Keeps REFERENCE meaning exactly what its header says, and gives the record a shape of its own rather than making it a guest on a tab built for something else. Costs a third destination in a two-tab layout, which the Layout B lane needs to hear about.
- **On REFERENCE, with a visible and permanent type separation between quoted and owner-authored text.** — One fewer destination and it matches how a GM thinks — "the stuff I look up." The separation has to be designed before anything is built and has to survive every future contributor, which is a standing cost rather than a one-time one.
- **Only lines and veils get a home; the rest stays on paper.** — The smallest thing that closes the sharpest gap — a GM checking an agreement mid-scene in under two seconds, editable at the table because lines and veils are explicitly a living document. Leaves the NPC and arc records unbuilt.

## 8. Does a countdown record more than a name, a kind and a number? (This reopens BACKLOG :2117, where you decided `Countdown.notes` stays undrawn.)

**Perché:** `Countdown.notes` is persisted, read back by `readCountdown`, and drawn by nothing — your recorded decision, and I am not treating it as an oversight. The case for reopening is that what was rejected was a *plain second free-text box*, and three named fields are a different shape doing a different job: Activation / Advancement / Effect are the three questions that keep a clock legible an hour later and let you resume one next session. Alongside it sit two more fields with the same character: an owner on a project clock (you made this exact correction once already, at eb4c60e, "ask whose sheet a die is for"), and a written beat per tick on a long-term clock so a rest can advance it and you immediately know what to narrate. All three are structure — nothing quoted, no Core Book text. All three are the same schema bump as the scene and session questions, so they should be decided in the same breath.

- **The triad plus an owner field plus per-tick beats on long-term clocks — all of it, in the one bump.** **(consigliata)** — A clock stops being a number. It also makes the rest control worth having, because advancing a long-term clock produces a sentence rather than a decrement. Costs form length on the NewCountdown surface, which is already the busiest sheet in the section.
- **The owner field only.** — The cheapest real improvement — with three or four projects running, unowned clocks are indistinguishable — and it does not reopen :2117 at all, since an owner is a ref rather than prose.
- **Nothing. :2117 was about the whole subject.** — The decision stands and the form stays short. The Activation/Advancement/Effect triad and the per-tick beats are closed permanently, and long-term countdowns remain a kind whose own hint promises behaviour the app does not have.

## 9. The question catalogue: 48 entries or ~150, and who writes and maintains them?

**Perché:** The catalogue is the only part of the answer surface whose citations are *guaranteed* true rather than probably true, because each anchor is checked by a person once at build time and by seven assertions on every run. But the entries are writing, not code: ~48 covers 30 sections and is a weekend; ~150 reaches every mid-scene anchor and is something you add to for months. The failure mode of stopping too early is not danger, it is irrelevance — below about a dozen entries it only answers what you already have memorised. And the maintenance question is real: `tools/build-srd.ts` derives headings from the PDF, so a rebuild can rename one, and the one rot no test can catch is content moving between headings that keep their names.

- **Ship 48 with the moment chips and the rot test, and grow it when you notice yourself reaching for something twice.** **(consigliata)** — Gets the mechanism, the tests and the honest-silence behaviour in place at low cost, and lets real use decide what entry 49 is — which is better evidence than a list written in advance. The catalogue is data, so growing it never touches code.
- **Write all ~150 up front, covering every mid-scene anchor.** — No GM question falls through to raw search. Costs a sustained body of writing before anything ships, and half of it will be entries for anchors your table never asks about.
- **Skip the catalogue. Ship only the multi-term search fix and the browse tree.** — Fixes the actual measured defect — 10 of 10 natural phrasings currently return zero — for a fraction of the effort, and it is genuinely most of the value. Leaves the GM who cannot phrase the question with a tree to walk instead of a question to tap.
