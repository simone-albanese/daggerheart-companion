<!--
  Produced 2026-08-27 by a 10-agent design workflow (4 independent designs, a
  4-lens judge panel, one synthesis). Run `wf_03f9674c-648`.

  IT IS A PLAN AND NOT A RECORD. Nothing in it has been executed. Its file:line
  citations were true against `14c995a` and this tree edits fast — check every
  one before building on it. Where it corrects the session brief or this repo's
  own documents, those corrections were themselves verified.
-->

## VERIFICATO — 27 agosto 2026, contro `ab66cf2`

**Everything below this block was written against `14c995a` and has now been measured against the tree it would actually run on.** Fourteen areas, one per section of this document, 224 agents; every verdict of FALSE was then handed to three independent skeptics whose job was to refute it, and only what survived all three is written in (MEMORY: always refute your own corrections). The shape of the result:

- **251 claims confirmed true.** This is not a rewrite. The plan's arguments are, in the main, sound, and the deletions it proposes are the ones the tree supports.
- **34 corrections standing.** Each is marked **in place**, at the line it belongs to, as `CORR-01` … `CORR-34`, and the sentence it corrects is left standing beside it. Nothing here has been silently re-derived and nothing is left for a reader to rediscover — the rule the previous lane's handoff states: *«Le cinque che restano, corrette nel documento del piano e non ri-derivate.»* Two markers are used: **CORRETTO** where the claim is false, **RAGIONE STANTIA** where the conclusion holds but the argument for it does not.
- **64 hazards** the plan could not have known about, because they landed after it was written. They are **§3.5**, grouped by the wave and step they fall on. *A Wave B author reads §3.5 before §1.*
- **36 of 70 challenges were themselves overturned.** That is the number that makes the other 34 worth trusting: the refutation round threw out more than half of what the verifiers called wrong. What is marked below is what survived being argued against three times, not what somebody disliked on a first reading.

**Wave A is DONE and merged** — `ab66cf2`, PR #56, **eight lane commits under five merges**, fourteen files, **+1514 / −51** (`git log --oneline --no-merges 3aa8f23..ab66cf2 | wc -l` → **8**, `--merges` → **5**, 13 revisions in the range together; `git diff 3aa8f23..ab66cf2 --shortstat` → ` 14 files changed, 1514 insertions(+), 51 deletions(-)`). **§3's Wave A table is therefore history, not instructions**, and its acceptance criteria have been superseded by what actually shipped: see *"What Wave A actually changed"*, immediately under that table. What remains of this plan is **Wave B and Wave C**, plus a Lane S that has already landed (`CORR-29`…`CORR-31`).

### The one instruction that changes what you type

**Re-anchor by string, never by number.** Measured in this worktree, not inherited:

| file | what happened to this document's citations |
|---|---|
| `shared/campaigns.ts` | Byte-identical to `14c995a` right up to `3aa8f23` (`git diff 14c995a..3aa8f23 -- shared/campaigns.ts` is empty). **Wave A then wrote into it**, and every hunk begins at or below `:847`. So every citation **at or above `:846` still lands exactly** — the header, `GmBoard`, the `scene` arm, `emptyBoard`, `liveScenes`, `isRecord`. Every citation **into the reader** — `:1475‑1478`, `:1481`, `:1484`, `:1502‑1507`, `:1519`, `:1542`, `:1566‑1577` — has moved **uniformly +160**. |
| `src/ui/gm/gmStore.ts` | **Wave A never opened it** (`git diff 3aa8f23..ab66cf2 -- src/ui/gm/gmStore.ts` is empty); #52 did. The interface block drifted **+2** (`runScene:` 205→**207**, `adoptBoard:` 229→**231**); the action bodies drifted **+77** (`adoptBoard(` 913→**990**, `runScene(` 923→**1000**). The file is 1411 → **1581** lines and now holds a second subsystem this plan never saw (`HAZ-52`). |
| `tests/store/campaignSchema.test.ts` | A3 inserted at `:738`. Citations **above** it land (`:112‑120`, `:136`, `:144`, `:160‑163`, `:192`, `:210`, `:628‑660`, `:645`); citations **below** are **+342** (`:891`→`:1233`, `:899`→`:1241`, `:896`→`:1238`). |
| `src/ui/gm/SessionBody.tsx`, `src/ui/gm/Scene.tsx` | Untouched since `14c995a`. Where a citation into them is wrong it was **wrong when written** — see `CORR-15`, `CORR-16`, `CORR-19`. |

---

# EXECUTABLE PLAN — parallel scenes (campaign schema 5) + the SEARCH topic index

Verified against the working tree on 2026‑08‑27. **The branch is not what the session brief said**: `git branch --show-current` is `search-topic-index`, HEAD is `14c995a` ("The book has five chapters, and the parser was throwing them away"), one commit ahead of `e25db1f` (main). `src/ui/shared/RuleSearch.tsx` (+189/−41) and `src/ui/search/Search.tsx` (+90, docblock only) are **uncommitted work in progress**. `npx tsc --noEmit` is clean; `chapters.test.ts` (10), `searchScreen.test.tsx` (8) and `ruleSearch.test.tsx` (85) all pass. Read §5 before planning any search work — a third of it is already shipped.

---

## 0. The decision

**Winner: Angle 1's model — maximum deletion — with Angle 3's environment model and Angle 4's writer arity grafted in. Angle 2 is rejected outright.**

The judges split 2‑1‑1 (Angles 1, 3, 4). They do not need averaging, because their disagreements are on three separable axes and each axis has a majority with evidence behind it:

| axis | positions | decision | why |
|---|---|---|---|
| Does `board.environmentRef` die? | A1/A4 yes; A2/A3 no | **NO — it stays** | Judges 3 and 4 both call A1's deletion *fatal* and both prescribe A3's model. Judge 2 prescribes it natively. Verified cause: `setEnvironment` has **three** call sites — `SessionBody.tsx:604`, `Bestiary.tsx:296`, and `SessionBody.tsx:1037` (an environment **link row**'s SET ACTIVE, which no angle except A4's file list mentions and which has no scene row to write to). A1 also routes `setEnvironment` through `openOrMint`, so `setEnvironment(null)` — deactivating a chip — would append a scene row holding nothing. Keeping the field costs one converter clause, zero call-site rewrites, and keeps `campaignSchema.test.ts:192` (`expect(campaign.board.environmentRef).toBe('raging-river')`, run against every fixture) green untouched. |
| Does `GmLive` keep a derived `combatants`? | A1/A2 yes; A3/A4 no | **NO — deleted** | Judges 1 and 2 both argue the compiler enumerating the blast radius is the main safety property this change has. Verified: exactly **12** `setState({… combatants …})` seed lines exist in the suite. Under a derived field every one of them typechecks, passes its render assertion, and is then wiped by the next `commit` — a failure far from its cause, in the change whose headline risk is losing HP marks. Deleting the field makes all 12 compile errors. |
| Row-addressed writers? | A4 yes; J2 grafts yes; J4 "yes, but not in this commit" | **YES, in this commit** | Judge 4's objection is lane discipline, not design. It is answered by lane design (§3), not by weakening the arity. `spawn(sceneId, …)` / `patchCombatant(sceneId, id, …)` / `removeCombatant(sceneId, id)` / `clearScene(sceneId)` is what makes "a writer that looks a combatant up by id alone marks the wrong scene" a compile error rather than a test. |

> **CORRETTO — 27 ago 2026 · CORR-24.** *"exactly **12** `setState({… combatants …})` seed lines exist in the suite"* counts only the seeds that fit on one physical line. A brace-balanced scan of every `setState(...)` whose argument contains `combatants` finds **29**, all of them on `useGm.setState`, spread over **17 files**; the identical scan at `14c995a` also returns 29, so this is not staleness. The plan's own grep is reproducible — `grep -rn 'setState({.*combatants' tests --include='*.test.ts' --include='*.test.tsx'` returns 12 in this worktree today — and the seventeen it cannot see are multi-line calls. **These line numbers are measured at `ab66cf2`; re-run the scan before you use them** — the list was first taken pre-Wave-A, and A4 has already pushed the two `sessionList` anchors +33 (`git diff 3aa8f23..ab66cf2 --numstat -- tests/gm/sessionList.test.tsx` → 269 insertions, 1 deletion). At `ab66cf2`: `countdownArm:96`, `encounterBump:78`, `fearOnTheGlass:176`, `gmScreen:93` and `:258`, `merchant:111`, `minionGroups:91`, `names:103` and `:231`, `partySizeDisagreement:66`, `reference:85`, `ruleSearch:131`, `sceneClocks:49`, `sceneSwitcher:209`, `sendCarry:97`, `sessionList:737` and `:1080`.
>
> **The axis decision is untouched.** Deleting the field still makes every seed a compile error, which is the whole property the decision rests on — it makes **29** of them, not 12, and 163 further `combatants` tokens live across the test files besides. What changes is the size of the job, and §6's *"Do the 12 seeds through A2's helper"* (marked there) would leave seventeen behind.

**Angle 2 is rejected** and must not be revived as a cheaper subset. Its own risk 5 concedes that `showScene` keeps the `environmentRef !== null` guard, so opening a scene with no place of its own leaves the *previous* scene's environment on the band. That is decision 1's original defect (`shared/campaigns.ts:355‑359`: "`Encounter.tsx:542` sent a fight to the board without carrying an environment, so the brawl opened silently in the **previous** scene's place") reappearing inside the change that was supposed to close it. Judge 1 is right that this is disqualifying.

### What the judges flagged as fatal, and what this plan does about it

1. **A1's `setEnvironment`/`environmentRef` deletion** (Judges 3 and 4). **Fixed**: `GmBoard.environmentRef` and `setEnvironment` are untouched. The *runner* reads the open row's `environmentRef` instead of the board's. `PUT THIS ENVIRONMENT ON THE BOARD` and `KEEP THE BOARD'S ENVIRONMENT HERE` keep their labels and their behaviour; the board's environment narrows to what it already half was — the builder's place, and the place a newly minted scene takes.
2. **A3 has no duplicate-row-id defence** (Judge 2). **Fixed**: verified that `readCampaignRecord` builds `rowIds` as a bare `Set` (`shared/campaigns.ts:1481`) with no dedupe, and `readSessionItem` only fills a *missing* id (`str(r['id']) || newId()`). Under row-addressed writers, two rows sharing an id means `find` reads the first while `map` writes both. Lane A3 adds the repair, **re-id, never drop**, ordered before the countdown-scope repair.
3. **A4's `TAP AGAIN TO DELETE n ADVERSARIES AND THEIR MARKS`** (Judges 1 and 4). **Dropped**. `SessionRow.tsx:86‑107` measures the armed footer at 349px and the current 29‑character label at 223px; the proposed 48–50 characters is 336–350px, i.e. on or over the edge at a metric the file itself says to re-measure. The shipped `TAP AGAIN TO DELETE THE FIGHT` already promises exactly what the new model does, so it is **kept verbatim**, and the count lives where it is already read: the shut row's summary term.
4. **A4's three-segment `describeItem`** (Judge 1). **Fixed**: two segments, always (§4).
5. **A3's `useGm(openCombatants)` zustand trap** (Judge 4). **Verified real** — `node_modules/zustand@5.0.15/react.js` calls `useSyncExternalStore` with no selector memoization, so a selector returning a fresh `[]` loops. **Fixed** by a module-level `NO_FIGHT` constant and by returning the row's own array by reference.
6. **A1's `setEnvironment(null)` minting** (Judge 3). Moot — no mint in the store at all (§1, "the labelled door").

### Corrections to the brief and to the repo's own prose

- **"29 test files of 153"** is wrong in both halves. Counted: **154** test files; **23** mention `combatants`, **22** mention `liveScene`, **25** in the union; the whole suite has **3361** `it(` blocks. The number 29 belongs to `PIANO-SCENE-PARALLELE-2026-08-26.md:700` — *«tutti i 29 seeding site in 15 file di test»* — it is a count of **sites**, not files. Judge 2's figures are the ones to cite. Judge 1's "conflates seeding sites" and Judge 3's "counts src/" are both wrong about *why*, but the corrected numbers stand.

> **CORRETTO — 27 ago 2026 · CORR-23.** *"the whole suite has **3361** `it(` blocks"* was six too high the day it was written, and the suite has grown twice since. **Take the method, not the total.** The plan's `grep -o '\bit('` counts comment occurrences and the anchored `grep -cE '^[[:space:]]*it\('` does not; run over `git ls-files | grep -E '\.test\.(ts|tsx)$'` the two return **3361 / 3355** at `14c995a`, **3508 / 3502** at `3aa8f23`, and **3542 / 3536** at `ab66cf2`. The over-count is 6 at all three commits — only the totals move, so re-derive with the anchored form and never inherit the figure. Add the 39 `it.each(` sites (same file list, `xargs grep -o 'it\.each(' | wc -l`, at `ab66cf2`) for the total number of declarations. The file counts in this bullet have moved too — *"25 in the union"* is **27** at `3aa8f23` and **28** at `ab66cf2`, after Wave A added `tests/fixtures/factories.test.ts` (see `CORR-27` at Wave B's Owns block). The suite itself went **154** (`14c995a`) → **161** (`3aa8f23`) → **162** (`ab66cf2`), the first leg in three days under #51 and #52.
>
> **The reasoning of this bullet stands untouched** — 29 is a count of *sites* and not of files, and the brief was wrong in both halves. Only the four numbers moved, and they moved because the tree did (`HAZ-44`, `HAZ-45`, `HAZ-46`).

- **"~716 test"** (`SCENE-MODEL-2026-08-26.md:174`) is supported by nothing in the tree.
- `PIANO-SCENE-PARALLELE-2026-08-26.md:700` §10.6 **recommends this exact model** — *«Se accetti quel raggio, quello è l'app che non si riapre fra sei mesi»* — while its preamble rejects it. Both must be marked (§3, lane A4).
- Judge 3's TDZ claim about `isRecord` is wrong (it is at `shared/campaigns.ts:816`, referenced only inside a closure that runs after module evaluation). The plan still declares a local helper beside the chain, for lint and for readability, not for TDZ.

---

## 1. The model, exactly

### `shared/campaigns.ts`

```ts
export const CAMPAIGN_SCHEMA_VERSION = 5;   // was 4
export const OLDEST_READABLE_CAMPAIGN = 1;  // unchanged
```

```ts
/**
 * The builder's workbench, and which scene the runner is showing.
 *
 * NOT "the live table" any more. A fight lives on the scene row it is fought
 * in, always, and nothing here holds one. What is left is the encounter
 * builder's draft — a roster, three adjustments, a tier, a place — plus two
 * navigation fields.
 */
export interface GmBoard {
  region: GmRegion;
  partyTier: Tier;
  roster: RosterEntry[];
  adjustments: EncounterAdjustments;
  /**
   * The place the BUILDER is standing in — never the runner's.
   *
   * The runner reads the open scene row's own `environmentRef`; this is what
   * `SEND n TO THE SCENE` names before the tap and what a freshly minted scene
   * takes. `PUT THIS ENVIRONMENT ON THE BOARD` writes it; `KEEP THE BOARD'S
   * ENVIRONMENT HERE` reads it onto a row. Its three writers are unchanged.
   */
  environmentRef: Ref | null;
  /**
   * The scene row the runner is showing, or null when it is showing none.
   *
   * NAVIGATION, beside `region`, and never ownership: nothing is stored here
   * that a row does not already hold. A dangling value costs the GM the memory
   * of which scene was open and never a mark, which is why the reader nulls it
   * in silence where `liveScene` had to warn.
   *
   * NOT the `board.region` exemption argued further down. That exemption bounds
   * itself — "whether they are widening THIS field or a different one" — and
   * this is a different one. The bump below is not for this field anyway.
   */
  openScene: string | null;
}
```

> **CORRETTO — 27 ago 2026 · CORR-02.** In the `openScene` docblock above: *"NOT the `board.region` exemption **argued further down**"* — it is argued **above**, at `shared/campaigns.ts:456‑528`. This is inherited rather than stale: the sentence is copied verbatim from the existing `liveScene` docblock at `shared/campaigns.ts:570`, and the file has not moved at that depth, so the plan reproduces a pre-existing prose defect into the very field that replaces it. **Write "argued above."** Everything else in the paragraph, including the quoted clause and the new sentence *"The bump below is not for this field anyway"*, is sound.

**Removed from `GmBoard`:** `combatants: SceneCombatant[]`, `liveScene: string | null` (and its whole docblock).
**Added:** `openScene: string | null`.
**Unchanged:** `region`, `partyTier`, `roster`, `adjustments`, `environmentRef`.

```ts
export const emptyBoard = (): GmBoard => ({
  region: 'encounter',
  partyTier: 1,
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  environmentRef: null,
  openScene: null,
});
```

**`SessionItem`'s `scene` arm does not change on the wire.** It keeps `{ environmentRef, roster, adjustments, combatants }` byte for byte. What changes is the invariant on `combatants`, stated in its docblock in place of the resume invariant:

> INVARIANT (the fight is the row's): a scene row's `combatants` is the fight in that scene at all times — planned, being played, or left standing. Nothing empties it but `clearScene` and deleting the row.
> INVARIANT (row-local ids): a `SceneCombatant.id` is unique inside its own row and means nothing outside it. Two rows may both hold `acid-burrower-0`. Every writer is addressed by `(sceneId, id)`, and no code may look a combatant up by id alone.

The `encounter` arm is untouched and still uncreatable.

Two helpers, declared beside `countdownsIn`/`liveScenes`:

```ts
/**
 * One array, module-level, so the empty case has a stable identity.
 *
 * Load-bearing rather than tidy. zustand 5 calls `useSyncExternalStore` with no
 * selector memoization (`node_modules/zustand/react.js`), so a selector that
 * built a fresh `[]` on every call would make React declare the snapshot
 * uncached and loop — on the ordinary state of a fresh campaign.
 */
const NO_FIGHT: SceneCombatant[] = [];

/**
 * The fight in one scene row. `NO_FIGHT` when the id names no scene row.
 *
 * Returns the row's OWN array by reference and never a copy: `useGm` compares
 * by identity, so a copy here would repaint the whole runner on every `+1` of
 * Fear. Safe because every writer below rebuilds the array — the rule
 * `SessionBody.tsx:53-58` already states — and unsafe the day one does not,
 * which is why `patchSessionItem` now refuses a `combatants` patch.
 */
export const combatantsIn = (
  session: readonly SessionItem[],
  sceneId: string | null,
): SceneCombatant[] => {
  if (sceneId === null) return NO_FIGHT;
  const row = session.find((i) => i.id === sceneId);
  return row !== undefined && row.kind === 'scene' ? row.combatants : NO_FIGHT;
};

/** The place the runner draws: the open row's own, never the board's. */
export const environmentIn = (
  session: readonly SessionItem[],
  sceneId: string | null,
): Ref | null => {
  if (sceneId === null) return null;
  const row = session.find((i) => i.id === sceneId);
  return row !== undefined && row.kind === 'scene' ? row.environmentRef : null;
};
```

> **CORRETTO — 27 ago 2026 · CORR-01 e CORR-16.** The `combatantsIn` docblock above would ship a false citation: *"every writer below rebuilds the array — the rule `SessionBody.tsx:53-58` already states"*. `SessionBody.tsx` states **no rule about writers rebuilding the array**; `grep -n 'rebuild\|in place\|mutat\|by reference\|identity' src/ui/gm/SessionBody.tsx` returns nothing at all. Lines `53‑57` are about the four crossing verbs each naming the noun it moves (*"four buttons about \"the board\" on one strip are four buttons a GM has to open one at a time to tell apart"*). The rule actually meant begins at **`:58`** and runs to **`:62`** — *"a row's stored `combatants` cannot be put back with their marks, because no action in `gmStore` sets the combatant list wholesale"* — which is a **different claim** (nothing sets the list *wholesale*), and which is itself no longer true (`CORR-22`).
>
> The plan inherited the wrong range honestly: `src/ui/gm/gmStore.ts:199` makes the same `53-58` citation, in `runScene`'s own docblock. If a citation is wanted for the rebuild-by-spread discipline, the writers are `gmStore.ts:983` (`i.kind === 'scene' && i.id === s.liveScene ? { ...i, combatants: [] } : i`) and `gmStore.ts:1061`. **Do not copy this sentence verbatim into a brand-new docblock** — a false file:line inside fresh prose is the defect this repo marks rather than re-derives.

`liveScenes(session, openScene)` keeps its name, its signature and its body (`shared/campaigns.ts:771‑777`). Only the parameter name and the docblock change: the second clause now exists solely to keep an open-but-empty row on the strip, instead of covering an invariant (a live row with `combatants: []`) that no longer exists.

### `src/ui/gm/gmStore.ts`

```ts
export interface GmLive extends GmBoard {
  fear: number;
  session: SessionItem[];
  party: PartyMember[];
  /** Derived from `session`. Never set directly; `commit` recomputes it. */
  countdowns: Countdown[];
}
```

`combatants` leaves the store surface entirely (it was inherited from `GmBoard`). `spread`/`gather` lose one line and gain one — `combatants: c.board.combatants` and `liveScene: c.board.liveScene` go, `openScene: c.board.openScene` arrives. `commit` is **unchanged**: it still derives only `countdowns`, because there is now nothing else to derive.

One exported selector and one private writer:

```ts
/** The fight the runner is showing. Referentially stable; see `combatantsIn`. */
export const openCombatants = (s: GmState): SceneCombatant[] =>
  combatantsIn(s.session, s.openScene);

/** The place the runner is showing. */
export const openEnvironment = (s: GmState): Ref | null =>
  environmentIn(s.session, s.openScene);

/**
 * The ONLY function in this store that writes a scene row's combatants.
 *
 * Total: an id that names no `kind: 'scene'` row commits nothing. Rebuilds only
 * the row it changes, so every other row keeps its object identity and the plan
 * list does not re-render under an HP tap.
 */
const withSceneFight = (
  sceneId: string,
  f: (row: Extract<SessionItem, { kind: 'scene' }>) => SceneCombatant[],
): void => {
  const s = get();
  if (!s.session.some((i) => i.kind === 'scene' && i.id === sceneId)) return;
  commit({
    session: s.session.map((i) =>
      i.kind === 'scene' && i.id === sceneId ? { ...i, combatants: f(i) } : i,
    ),
  });
};
```

**Deleted actions**, with their docblocks: `runScene` (~55 lines, `gmStore.ts:922‑1015`, plus the `copy()` deep-copier, the `parkable`/`minted`/`parkId` block, the park-and-resume `.map`, the renumber and the environment-carry spread) and `adoptBoard` (`gmStore.ts:913‑920` plus its ~25-line interface docblock at `gmStore.ts:206‑229`).

> **CORRETTO — 27 ago 2026 · CORR-03, CORR-04, CORR-05.** Both ranges are stale and both are destructive to execute literally. Measured in this worktree at `ab66cf2`:
>
> - **`runScene`'s implementation is `gmStore.ts:1000‑1092`**, not `922‑1015` — **+77**. Deleting `922‑1015` today destroys eight unrelated actions. (`CORR-03`, STALE_REASON: the conclusion — delete `runScene` — is right.)
> - It is **93 lines**, not *"~55"*, plus **12** more for the interface docblock and declaration at **`gmStore.ts:196‑207`**: **105 lines** in all. This sentence promises *"with their docblocks"* but cites one only for `adoptBoard`. `runScene`'s is the block that names the resume invariant (`gmStore.ts:226`), and it must go with it. (`CORR-04`)
> - **`adoptBoard` is `gmStore.ts:990‑998`** (9 lines, closing brace included), not `913‑920`, and its interface docblock is **`:208‑231`**, not `206‑229`. Deleting `913‑920` today mangles the initial state object and `addToRoster`. (`CORR-05`, STALE_REASON.)
>
> The drift is #52's and not Wave A's — Wave A never opened this file. **Cut by string.**

**New actions:**

```ts
/** Point the runner at a scene row. Writes one string and nothing else. */
showScene: (sceneId: string | null) => void;

/** Mint a scene row, open it, and hand back its id. One commit. */
openNewScene: (name?: string) => string;
```

`showScene` does **not** set `region`; every caller that opens the runner already calls `onOpenTool('scene')`, exactly as `startFight` does today. It refuses an id that names no `kind: 'scene'` row.

**Re-signed actions** (the compiler finds every call site):

```ts
spawn: (sceneId: string, adversary: Adversary, partySize: number, times?: number) => void;
patchCombatant: (sceneId: string, id: string, patch: Partial<SceneCombatant>) => void;
removeCombatant: (sceneId: string, id: string) => void;
clearScene: (sceneId: string) => void;
```

`spawn` scans the free index over **that row's** array only — the same scope the board scan had, now stated instead of accidental. It is total: no mint. `clearScene(sceneId)` is `withSceneFight(sceneId, () => [])` and **keeps `openScene`**: ending the fight in the Foresta leaves you looking at the Foresta.

**`patchSessionItem` gains a second strip beside its existing `kind` strip:**

```ts
item.id === id
  ? ({ ...item, ...patch, kind: item.kind, ...(item.kind === 'scene' ? { combatants: item.combatants } : {}) } as SessionItem)
  : item
```

Same shape, same reason, same kind of test as the `kind` guard: there is exactly one writer of a row's fight and this is not it. It closes `SessionBody.tsx:640`'s `patch(item.id, { combatants: [] })` back door, which becomes `clearScene(item.id)`.

**`removeSessionItem`**: the `liveScene === id ? { liveScene: null }` clause becomes `openScene === id ? { openScene: null }`, and its comment inverts — the fight goes with the row, which is what deleting a scene now means, and which `SessionRow.tsx:191` has always armed as `TAP AGAIN TO DELETE THE FIGHT`.

**Unchanged and not to be touched:** `setEnvironment`, `setRegion`, `setPartyTier`, the whole roster/adjustment block, every countdown action, `withSceneScope`, `withPrimaryCountdown`, the campaign block.

### The labelled door: there is no mint inside the store

The minted-untitled-scene path is deleted, not relocated. `spawn` refuses an id that names no scene row. The three screens that could previously reach a fight with no home each get a labelled button instead, so the app never mints behind the GM's back:

| screen | scene open | nothing open |
|---|---|---|
| `Bestiary.tsx:275` | `ADD TO THE SCENE` → `spawn(openScene, …)` | `ADD TO A NEW SCENE` → `const id = openNewScene(); spawn(id, …)` |
| `Encounter.tsx:767` | `SEND n TO THE SCENE` | `SEND n TO A NEW SCENE` |
| `SessionBody.tsx` EncounterArm | `OPEN THE FIGHT` | `OPEN THE FIGHT IN A NEW SCENE` |

Two commits (mint, then spawn) is correct here and is not a violation of the ONE-commit rule: that rule exists so no frame shows a fight in two places or in neither, and nothing moves here — the intermediate state is an empty, focused scene row, which is exactly what ADD already produces and is perfectly drawable.

### States that cease to exist

1. A fight on the board belonging to no row (`orphan`) — nothing can hold a fight but a row.
2. A live row whose own `combatants` is `[]` while the fight is elsewhere.
3. Two copies of one fight with different marks.
4. **"The board is running another scene, so OPEN THE SCENE shows that one and not this. Run this row instead"** — the owner's defect, unrepresentable.
5. A scene row minted invisibly during a flip, or from a browsing gesture.
6. `claimable`, `orphan`, `adoptBoard`'s refusal branch.
7. A board environment that disagrees with the row being played.
8. A dangling `liveScene` stranding a fight.

---

## 2. The schema story

**`CAMPAIGN_SCHEMA_VERSION` 4 → 5. `OLDEST_READABLE_CAMPAIGN` stays 1. `DB_VERSION` unchanged** — no object store moves.

`OLDEST_READABLE_CAMPAIGN` stays 1 because the chain still leaves 1 correctly, every `.dhcampaign` on a disk is v1–v4, and `checkReadable` would otherwise tell a GM that "no released version of this app has ever written schema 1", which is false. `CAMPAIGN_MIGRATIONS.toHaveLength(CAMPAIGN_SCHEMA_VERSION - OLDEST_READABLE_CAMPAIGN)` (`campaignSchema.test.ts:896`) becomes `4 === 5 - 1` with no edit, which is why it was written that way.

### The converter, written out

Declared immediately above `CAMPAIGN_MIGRATIONS` (`shared/campaigns.ts:151`):

```ts
/**
 * A raw record's own object, or an empty one.
 *
 * Local to the chain rather than the reader's `isRecord` 660 lines below: the
 * converter runs on bytes and the reader runs on a reading, and the chain's
 * most-read block should not forward-reference a helper whose job is the other
 * half of the file.
 */
const chainRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * The id the fourth converter gives a fight whose row is gone.
 *
 * A literal and NOT `crypto.randomUUID()`, for two reasons that are both
 * load-bearing. The chain is pure and `campaignSchema.test.ts` asserts it by
 * walking a frozen fixture forward and requiring `JSON.stringify` equality. And
 * `readCampaigns` writes a version-moved record back through `scheduleAside`;
 * if that write fails — quota, private window — the converter runs again next
 * launch, and a random id would mint a second row holding a second copy of the
 * same fight, every time. `LEGACY_CAMPAIGN_ID` in
 * `src/store/campaignMigration.ts:59` is this repo's precedent and gives this
 * exact argument.
 */
const RESCUED_FIGHT_ROW = 'board-fight-v4';

const freeRescueId = (session: readonly unknown[]): string => {
  const taken = new Set(
    session.flatMap((i) => {
      const row = chainRecord(i);
      return typeof row['id'] === 'string' ? [row['id']] : [];
    }),
  );
  if (!taken.has(RESCUED_FIGHT_ROW)) return RESCUED_FIGHT_ROW;
  let n = 2;
  while (taken.has(`${RESCUED_FIGHT_ROW}-${String(n)}`)) n += 1;
  return `${RESCUED_FIGHT_ROW}-${String(n)}`;
};
```

> **CORRETTO — 27 ago 2026 · CORR-06.** The proposed `chainRecord` docblock pins a distance that is wrong on the day it is committed: *"the reader's `isRecord` 660 lines below"*. `isRecord` is at `shared/campaigns.ts:816` today, unmoved (every Wave A hunk in that file begins at `:847`), so from `CAMPAIGN_MIGRATIONS` at `:151` it is **665** lines below, not 660 — **and this plan's own insertion of ~40 lines of helpers above the chain pushes `isRecord` to roughly `:856`**, making the true distance about **725**. Say *"far below"*, or name the block, and pin no count inside a file the same commit is editing (MEMORY: prose claims go stale in their own commit — never cite a line number in a file still under edit). The argument the docblock makes is unaffected.

The fourth entry:

```ts
{
  from: 4,
  note: 'the fight left the board and lives on the scene row it was being fought in; the board kept the builder’s workbench and which scene is open',
  apply: (r) => {
    const board = chainRecord(r['board']);
    const { combatants, liveScene, ...rest } = board;
    const fight = Array.isArray(combatants) ? combatants : [];
    // The pointer is CARRIED, not validated. Converters move; readers decide.
    const pointer = typeof liveScene === 'string' ? liveScene : null;
    const session = Array.isArray(r['session']) ? r['session'] : [];

    /* (1) Nothing on the board. Rename the pointer, drop the two keys, touch
     *     nothing else. All four committed fixtures take this branch, which is
     *     why branches (2) and (3) need frozen fixtures of their own. */
    if (fight.length === 0) return { ...r, board: { ...rest, openScene: pointer } };

    /* (2) The pointer names a scene row holding no fight of its own. That is
     *     the invariant `runScene` maintained on every resume, so it is the
     *     ordinary state of a v4 record with a fight on the glass. */
    const at = session.findIndex((i) => {
      const row = chainRecord(i);
      return (
        row['kind'] === 'scene' &&
        row['id'] === pointer &&
        (!Array.isArray(row['combatants']) || row['combatants'].length === 0)
      );
    });
    if (at !== -1) {
      return {
        ...r,
        session: session.map((i, k) =>
          k === at ? { ...chainRecord(i), combatants: fight } : i,
        ),
        board: { ...rest, openScene: pointer },
      };
    }

    /* (3) Everything else, and it is the fallback so no input ends in a drop:
     *     no pointer; a pointer at a countdown, an `unreadable` or an
     *     `encounter` row; a pointer at a scene row that ALREADY holds a fight.
     *     One row is minted and the board's fight goes in it, whole.
     *
     *     NEVER merged. A merge invents a fight that stood at no table, and
     *     `spawn` scans one array for a free index, so `acid-burrower-0` is
     *     legal in the dungeon and in the forest at the same time — a merge
     *     would produce two combatants the runner cannot tell apart.
     *
     *     Six keys and no more: `readSessionItem` supplies `roster`,
     *     `adjustments` and `collapsed` on the way in, and a default written
     *     here as well is the one nobody notices has gone stale — the `from: 2`
     *     entry's rule, honoured rather than stretched.
     *
     *     `environmentRef` is SEEDED from the board here and nowhere else. The
     *     rescue row is what `openScene` names, so without it the runner would
     *     draw no place for a fight that had one. A row that already exists
     *     keeps its own place: `runScene` refused to write the plan's
     *     environment and an upgrade must not do what the app declined to do. */
    const id = freeRescueId(session);
    return {
      ...r,
      session: [
        ...session,
        {
          id,
          kind: 'scene',
          name: '',
          order: session.length,
          environmentRef:
            typeof rest['environmentRef'] === 'string' ? rest['environmentRef'] : null,
          combatants: fight,
        },
      ],
      board: { ...rest, openScene: id },
    };
  },
}
```

### Why this converter may do work when the other three do not

The header at `shared/campaigns.ts:141‑147` says *"All three entries are deliberately empty of work, and that is the point rather than an omission… In all three bumps there is no field to rename and none to drop."* **That sentence is not falsified by this entry, but it is not general enough to cover it, so it is rewritten in the same commit rather than left to rot.** The restated rule, which goes into the header:

> **CORRETTO — 27 ago 2026 · CORR-07.** The quoted words are verbatim; the range is not. The header docblock runs **`shared/campaigns.ts:122‑150`**, and the sentence to rewrite is at **`:125‑129`** — not `141‑147`. That file is byte-identical to `14c995a` at this depth, so the citation was **wrong when it was written** rather than drifted. The restated rule below it, and the decision to rewrite the header in the same commit, are unaffected.

> **A converter may MOVE. It may not INVENT and it may not REINTERPRET.**

Three tests separate a move from a repair, and this entry passes all three:

1. **Could the reader supply it?** For every previous bump, yes — which is *why* those converters had nothing to do, and the `from: 2` entry says so at length: the readers supply every default on the way in, so seeding one in a converter puts it in two places. Here the answer is **no**. `readSessionItem` supplies `combatants: []` for a scene row that has none, and for a v4 record whose fight is sitting in `board.combatants` that default is *wrong*. What this converter supplies is **data**, not a default; `[]` stays the reader's and stays the reader's alone.
2. **Does it decide what the record means?** No. The `encounter` arm's rule (`shared/campaigns.ts:376‑386`) is that a converter must not "change the kind of a thing the GM named", because "the next migration that wants to rewrite somebody's data will cite this one". This changes no kind, no name, no id, no count and no mark. `board.combatants` and a scene row's `combatants` are the same type, written by the same writers, read by the same `readCombatants`, and `runScene` has been copying between them verbatim since schema 3. The converter performs exactly the park `runScene` would have performed.
3. **Is there anywhere else it could be done?** No — and this is the clause the old rule never needed. **No previous bump deleted a field.** A key that goes away has exactly one place its contents can cross, and that place is the chain. Doing it in `readCampaignRecord` instead would mean the reader keeps naming `board['combatants']` for ever — the field would be *hidden*, not deleted, the whole simplification undone — and the rescue would re-run on every read of a v4 record rather than once.

> **RAGIONE STANTIA — 27 ago 2026 · CORR-08.** Test #2's conclusion holds — the converter changes no kind, no name, no id, no count and no mark — but the history it leans on is invented. **`runScene` has existed since schema 4, one commit and one day (`25a4d54`)**, not *"since schema 3"*. The scene row's `combatants` field arrived at schema 3 (the `from: 2` note: *«the scene row absorbed the fight…»*), but nothing copied between board and row until `25a4d54`. And **"verbatim" overstates the mechanism**: `gmStore.ts:1016‑1021` copies through `copy()`, which rebuilds `hp`, `stress` and `thresholds` — value-identical, never the same objects. State the precedent's real age, or the *"move, not repair"* test rests on a history the tree does not have.

It also **validates nothing**: it moves the raw array as it found it, and `readCombatants` still decides what a combatant is, in one place.

### Why the bump is not optional — and it is a new shape of hazard

Every previous bump guarded against **truncation**. This one guards against **destruction**, and the loss lands on the *newer* build's read. Write this into the converter's docblock, not only into the commit message:

1. A schema‑4 `readCampaignRecord` meets a schema‑5 record. `board.combatants` is absent → `readCombatants(undefined)` → `[]`; `board.liveScene` is absent → `null`. Every scene row reads whole. **It does not fail.**
2. The v4 screen is coherent-looking and wrong: no `SCENE · n` chip, an empty runner, and `liveScenes(session, null)` returning a chip for every row holding a fight, none of them current. Every scene row says `n PARKED` and offers `BACK TO THIS FIGHT`.
3. The GM taps it. v4's `runScene` **empties that row** into `board.combatants`. The 400 ms debounce writes it.
4. They open the campaign on the v5 build. The reader names its own keys; `combatants` is not one of them. **The fight and every HP and Stress mark on it are gone**, with nothing on any screen saying why.

`checkReadable` turns all of that into one sentence — *"was written by a newer version of the app (schema 5; this app reads 4). Update the app, then open it again — it has not been changed."* — and the three doors it closes are already built: `readCampaigns` quarantines, `putCampaign`/`deleteCampaign` throw `StaleBuildError`, and `parseCampaignFile` refuses the file as a *version* rather than as damage.

### The readers

`readCampaignRecord`'s board literal (`shared/campaigns.ts:1566‑1577`) becomes:

```ts
board: {
  region: GM_REGIONS.includes(region as GmRegion) ? (region as GmRegion) : 'encounter',
  partyTier: (tier >= 1 && tier <= 4 ? tier : 1) as Tier,
  roster: readRoster(board['roster']),
  adjustments: readAdjustments(board['adjustments']),
  environmentRef: typeof board['environmentRef'] === 'string' ? board['environmentRef'] : null,
  openScene,
},
```

with, in the existing single repair pass:

```ts
/*
 * The second pointer, in the same pass and under a DIFFERENT set, and the
 * difference is the point rather than a divergence.
 *
 * A countdown's `sceneId` is checked against EVERY row's id, because an
 * `unreadable` row keeps its id precisely so a build that cannot parse it
 * cannot lose it. `openScene` is checked against SCENE rows only, because it
 * names the row the RUNNER has to draw: pointed at a countdown row it would
 * show an empty scene with no explanation and no way back to the fight.
 *
 * SILENT, where `liveScene` had to warn. `liveScene` owned a fight, so a
 * dangling one meant a fight with no home and the GM had to be told. This owns
 * nothing: what dangles is which screen you were on.
 */
const sceneIds = new Set(session.flatMap((i) => (i.kind === 'scene' ? [i.id] : [])));
const rawOpen = board['openScene'];
const openScene = typeof rawOpen === 'string' && sceneIds.has(rawOpen) ? rawOpen : null;
```

**DELETE** the warning string `'the fight on the board came from a scene this campaign no longer has, so it belongs to no row'` (`shared/campaigns.ts:1542`). A warning that fires when nothing was lost is how a real warning stops being read.

`readSessionItem`'s scene arm is unchanged on the wire and gains one repair (lane A3): **duplicate combatant ids inside one row are re-id'd to the first free `${adversaryRef}-${n}` in that row, every body and every mark kept, warned once.** Re-id, never drop: dropping a body to restore an invariant is the silent loss this whole file is written against.

`readCampaignRecord` gains the second repair (lane A3): **duplicate row ids**, walked once over `session`, the second and later occurrences given a fresh id from `newId()` with a warning, **ordered before** the countdown-scope repair so scopes still resolve to the row that kept its id.

> **RAGIONE STANTIA — 27 ago 2026 · CORR-13.** The ordering is right and the acceptance sentence holds; **the reason given here does not.** Moving the row-id repair to immediately *after* the countdown-scope repair changes no reading and turns no test red — renaming a *later* duplicate cannot take an id out of a set the earlier row already put in. What the ordering is load-bearing against is **`deduped.sort((a, b) => a.order - b.order)`**, which re-orders the list by an `order` field arriving in the same hand-edited file the duplicate did: decided by that field, the *other* row keeps the id and the scope lands on it without a word.
>
> **Lane A3 has since shipped and its commits say exactly this** (`faa1282`, `ff7c54e`): the boundary is stated in `shared/campaigns.ts` at `:1581` and the sort is at `:1679`, proved by a mutant that walks the list in `order` order. Two edges the acceptance sentence still does not cover: the scope set is deliberately **every** row's id and not scene ids (`shared/campaigns.ts:1635‑1640`), so when the row that keeps a duplicated id is a *countdown* row, the scoped clock resolves to a non-scene row and the owner lookup — now `src/ui/gm/SessionRow.tsx:247`, `i.kind === 'scene' && i.id === item.sceneId`, moved there by A4 — silently finds nothing. **Left open**, because the verification did not settle it: whether that lookup should warn, or whether a countdown row keeping a duplicated id is a state the repair should refuse outright.

### `.dhcampaign` and the legacy localStorage path

Nothing in `src/transfer/campaignFile.ts` changes; the window is the record schema's window and moves with it. A v4 file opened by a v5 build verifies its checksum against the payload **as it arrived**, before the chain runs, so the converter cannot make an honest old file look damaged. A v5 file handed to a v4 build throws `SchemaError` wrapped as `ImportError`. `tests/fixtures/schema/v1.dhcampaign` is **untouched** and must not be regenerated; it still walks 1 → 5.

`src/store/campaignMigration.ts` — **take Judge 2's graft and do NOT write a second mint there.** Verified: `campaignFromLegacy` returns `Record<string, unknown>` (`campaignMigration.ts:182‑186`), so its board literal is **not** checked against `GmBoard` and its comment at `campaignMigration.ts:216‑219` claiming "an unnamed field is a compile error, not a default" is already stale prose. Instead:

> **CORRETTO — 27 ago 2026 · CORR-09 e CORR-11.** The quoted sentence is real and unique in the tree, so the anchor is greppable — but the range is wrong twice over. The comment is at **`src/store/campaignMigration.ts:223‑226`** and `liveScene: null,` is `:227`. It was already wrong at `14c995a`: `216‑219` stopped one line short of the quoted sentence even then, so this is a plan defect that drift then made worse. A literal *"delete lines 216‑219"* at `ab66cf2` deletes `board: {`, `region`, `partyTier` and `roster`. **Delete by string.** The instruction — stamp with `LEGACY_BLOB_SCHEMA`, keep the two board fields, let the reader walk it forward, one mint in one place — is unaffected; see `HAZ-17` and `HAZ-21` for what test 26 cannot do as written.

- add `const LEGACY_BLOB_SCHEMA = 4;` and stamp the literal with it rather than `CAMPAIGN_SCHEMA_VERSION`;
- keep `combatants: legacy['combatants']` and `liveScene: null` in the board — the blob **is** a schema-4-shaped record by construction;
- let `readCampaignRecord` walk it forward through the converter above. One mint, one place, one set of tests.
- **Delete the stale comment** and pin the shape with a test (§6).

### Fixtures under `tests/fixtures/schema/`

- `v1/v2/v3/v4.campaign.json` — **frozen, untouched, never regenerated.** Verified: all four carry `board.combatants: []`, so all four exercise branch (1) only.
- **NEW `v5.campaign.json`** — required by `campaignSchema.test.ts:136` (`no committed fixture for campaign v${version}`) and `:144` (stamped at the version its name claims). It is the v4 table with `board.combatants`/`liveScene` replaced by `"openScene": "item-scene-1"`, stamped 5.
- **NEW `v4.parked.campaign.json`** — hand-written to the v4 shape, stamped 4: `liveScene: "item-scene-1"`, `board.combatants` holding two adversaries with real marks (`hp.marked`, `stress.marked`, `thresholds`, `spotlighted`, one `minionsRemaining`), the row's own `combatants: []`. Proves branch (2) against frozen bytes.
- **NEW `v4.orphan.campaign.json`** — the same with `liveScene: null`. Proves branch (3): `board-fight-v4` appears, carries `environmentRef: "raging-river"` off the board, and `openScene` names it.

Both new fixtures carry the same docblock the others do: hand-written to a schema this build has left, never regenerated, because a fixture rewritten by a later build proves only that the current code agrees with its own output.

> **CORRETTO — 27 ago 2026 · CORR-10.** *"Both new fixtures carry the same docblock the others do"* — **the existing fixtures carry no docblock, and no comment of any kind.** They are strict JSON. Top-level keys of `v1.campaign.json`: `id, schemaVersion, name, createdAt, updatedAt, fear, session, party, board` (v3/v4 add `archive, register`); a recursive key scan over all four finds no doc or comment key — only `notes`, a countdown field, and `note`, a row kind. The one `//` in any of them is inside `"href": "https://maps.example.org/…"` at `v4.campaign.json:126`.
>
> The *"never regenerated"* argument lives in the **test file**, where the others put it: `campaignSchema.test.ts:15‑16`, `:142‑143` (*"A fixture rewritten by a later build proves only that the current code can read its own output"*) and `:160‑163` — all three above A3's insertion at `:738` and therefore still landing. **Following this line literally puts a comment block into a `.json` file**, `JSON.parse` throws inside `readFixture` (`:72‑76`), and the whole `the committed fixtures` describe goes red. Write the argument in the test, not in the fixture.

### The byte-for-byte test is no longer trivially true — this is the single most likely place to get it wrong

`campaignSchema.test.ts:899‑923` asserts both `toEqual` and `JSON.stringify` equality of a v1 record walked forward against `{ ...fixture, schemaVersion: CAMPAIGN_SCHEMA_VERSION }`. For the first time the chain's output differs from its input, so the expectation must be **hand-written key by key, key order included**. Verified: v1's board key order is `region, partyTier, roster, adjustments, combatants, environmentRef`, and `const { combatants, liveScene, ...rest } = board` followed by `{ ...rest, openScene }` yields exactly `region, partyTier, roster, adjustments, environmentRef, openScene`. The `JSON.stringify` half is what protects the `.dhcampaign` checksum from a converter that reorders keys; do not drop it, and do not regenerate the expectation from the code.

Also rewrite the title of `campaignSchema.test.ts:891` — *"carries one converter per bump, in order, and none of them is a repair"* — which becomes a lie even though all three of its assertions stay green.

---

## 3. The lanes

**Rules.** Within a wave, lanes are disjoint and may run concurrently. Across waves they are strictly sequential. **No two concurrent lanes write the same file.** Cut every worktree from **local `main` (`e25db1f`)** yourself — not from `origin` — and ignore `node_modules` *without* the trailing slash (MEMORY: worktree lanes, two traps). Run the suite on the repo's own Node 24 (`. ./env.sh`) before pushing; Node 26 hides `localStorage` from jsdom and a green local run is weaker than CI's. `build:srd --check` is a local-only gate and is **skipped in every CI run** — nothing here may lean on it.

> **CORRETTO — 27 ago 2026 · CORR-14.** **Local `main` is not `e25db1f`.** Measured in this worktree: `git rev-parse --short main` → **`ab66cf2`**; `git rev-list --count e25db1f..main` → **50**. A worktree cut at `e25db1f` has neither #51 (the search topic index), nor #52 (campaign import + backup), nor #56 (Wave A itself).
>
> For A3 that was never cosmetic: `shared/campaigns.ts` was byte-identical at `e25db1f` and at `14c995a`, so A3 would have looked green in that worktree while the five files that read `readCampaignRecord().warnings` and landed with #52 were not present at all — the breakage would have surfaced only after the merge (`HAZ-31`, `HAZ-63`). This is exactly the failure MEMORY *"a handoff cannot name the commit it lands at"* and commit `1a3b719` are about. **Cut from local `main`, whatever it is on the day you cut, and re-read it** rather than carrying this number forward (MEMORY: un numero ereditato va rimisurato). Everything else in this Rules paragraph — disjoint lanes, the `node_modules` trap, Node 24, the skipped `build:srd --check` gate — holds.

### Lane S — the SEARCH topic index (runs beside everything, start to finish)

Completely disjoint from every scene file. It is **already in flight on branch `search-topic-index`**; it must stay ONE lane (MEMORY: the search lanes are one lane — four pieces all write `RuleSearch.tsx`).

- **Owns:** `src/ui/search/Search.tsx`, `src/ui/shared/RuleSearch.tsx`, `tests/ui/searchScreen.test.tsx`. (`src/ui/shared/chapters.ts` and `tests/ui/chapters.test.ts` are already committed at `14c995a`; do not reopen them.)
- **Must not touch:** anything under `src/ui/gm/`, `shared/campaigns.ts`, `src/store/`, `tests/gm/`, `tests/store/`.
- **Dependencies:** none.
- **Acceptance:** §5's guard list; `tests/gm/ruleSearch.test.tsx` (85 tests) and `tests/gm/moments.test.ts` pass **untouched** — a diff in either is the signal the lane grew past its own boundary.

### WAVE A — prep (four lanes, concurrent, disjoint, each green on today's model)

| lane | owns | must not touch | acceptance | depends on |
|---|---|---|---|---|
| **A1 — the aliased tuple** | `src/engine/encounter.ts`, `tests/engine/encounter.test.ts` | everything else | `makeCombatant(a, 0, 4).thresholds !== a.thresholds` and mutating the result does not change the dataset adversary | — |
| **A2 — seed helpers** | `tests/fixtures/factories.ts` | everything else | a new `sceneWith(id, combatants, opts)` returning a `kind: 'scene'` row, valid before and after the model change; existing `NO_FIGHT` untouched; full suite green | — |
| **A3 — reader repairs** | `shared/campaigns.ts`, `tests/store/campaignSchema.test.ts` | `src/ui/gm/**`, `src/store/**` | duplicate row ids re-id'd and warned, ordered before the scope repair; duplicate combatant ids inside one row re-id'd and warned; a countdown scoped to a duplicated id still resolves to the row that kept it; no body and no mark ever dropped | — |
| **A4 — the plan list stops re-rendering, and the docs stop lying** | `src/ui/gm/session.ts`, `src/ui/gm/SessionRow.tsx`, `tests/gm/session.test.ts`, `docs/handoff/SCENE-MODEL-2026-08-26.md`, `docs/handoff/PIANO-SCENE-PARALLELE-2026-08-26.md` | `shared/campaigns.ts`, `gmStore.ts`, `SessionBody.tsx` | `describeItem`'s 5th parameter becomes `ownerName: string \| null` (the scoped countdown's owner) instead of the whole `session`; `SessionRow` selects that one string and is wrapped in `React.memo`; `(SessionRow as { $$typeof?: symbol }).$$typeof === Symbol.for('react.memo')` (verified against React 19.2.8); `SCENE-MODEL-2026-08-26.md:173-174` marked superseded with both figures corrected in place; `PIANO-SCENE-PARALLELE-2026-08-26.md:700` §10.6 marked as the decision taken and its §4.13 claim (*«una classe di perdita che prima non c'era»*) corrected — `gather` has always written the whole record, so the class predates parking | — |

### What Wave A actually changed — read this instead of the table above

**Wave A is merged: `ab66cf2`, PR #56.** The table above is now a record of what was *asked for*. What shipped is **eight lane commits under five merges** over fourteen files, **+1514 / −51** (`git log --oneline --no-merges 3aa8f23..ab66cf2 | wc -l` → 8, `--merges` → 5; `git diff 3aa8f23..ab66cf2 --shortstat`), and four things in it change what Wave B writes.

**A3 proved this plan's own ordering reason FALSE, and then repaired a second field the plan never saw.** `faa1282` states the correction in the commit message — *"Both say the row repair must run before the countdown-scope repair «so scopes still resolve to the row that kept its id». The ordering is right; that reason is not."* The real boundary is `deduped.sort` (`CORR-13`, marked at §2). `ff7c54e` then closed a hazard one field down: **a countdown row carries its id twice**, the row repair moved only `item.id`, and `withCountdown` and `removeCountdown` both key on the **inner** `countdown.id` — so after the repair one tap ticked both clocks and one DELETE took both rows, announced to the GM in `warnings` as a fix. The fresh id now travels onto the clock, guarded on the two ids still being equal. `shared/campaigns.ts` is **+182 / −22**, all of it at or below `:847`; `tests/store/campaignSchema.test.ts` is **+342** inserted at `:738`, taking that file 87 → 91 its.

**A4 added a file to its own touched set, and left a guard behind that Wave B must keep passing.** `src/ui/gm/SessionList.tsx` (**+103**) is in neither column of A4's row above. `SessionRow.tsx` keeps **`export function SessionRow`** (`:197`) **and gains `export const MemoSessionRow = memo(SessionRow)` beside it** (`:631`) — because `tests/ui/screens.test.tsx` scans `src/ui` with regexes that `export const Name = memo(` matches neither of; the file writes the reason down at `:586‑591`. `SessionList.tsx:144` imports the memo and `:263` renders it. **And the memo would have been a lie without the second file**: `drag.handleProps(item, i)` inline in the list minted a fresh object with two fresh closures for every row on every render, so React's shallow compare would have skipped nothing. Handles are now cached on factory, row and index, by row id, and returned by reference (`SessionList.tsx:155‑170`) — which is `HAZ-29` answered by what shipped rather than left standing. A render-count guard landed in `tests/gm/sessionList.test.tsx` (*"The memo, proved by counting renders"*, `:2010`, module mock at `:67‑72`); **B7's seed rewrites run straight through it.**

**A4's new tests seed `liveScene`, so Wave B's rename reaches them.** `tests/gm/sessionList.test.tsx` (**+270**) gained `useGm.setState({ liveScene: 'b' })` and a docblock sentence stating that each row reads `liveScene` — *"Stated so that nobody later «fixes» it."* Together with A2's new `tests/fixtures/factories.test.ts` (**+126**), that is why the file inventory moved again after the verification ran: **28**, not 27 and not 25 (`CORR-27`).

**A1 made `makeCombatant` copy the thresholds tuple**, and that is the whole reason Wave B may delete `runScene`'s `copy()`. `src/engine/encounter.ts:230` is now `thresholds: Array.isArray(a.thresholds) ? [...a.thresholds] : null` — `Array.isArray` and not a null check, because 16 of the 129 adversaries have no `thresholds` key at all and `undefined === null` is false. `HAZ-24` is why the ordering was not optional: `gmStore.ts:1016‑1021`'s `copy()` is today's **only** downstream defence against the alias, and Wave B retires it with `runScene`. A2 shipped `sceneWith` and moved `NO_FIGHT` 249 → **251** (`tests/fixtures/factories.ts`, **+138**).

**The acceptance criteria above are superseded by what shipped, not satisfied by it.** A3's cell says the repair must be *"ordered before the scope repair"*; the shipped comment says it must run before `deduped.sort` and states the pointer-pass placement once, as what it is. A4's cell says `SessionRow` *"is wrapped in `React.memo`"*; what shipped is a memo **beside** it, for a reason A4's row could not have known. Read the cells as history — including the paragraph two below this one: *"there is **no `React.memo` anywhere in `src/ui/gm/`**"* was true when it was written and is false at `ab66cf2`. **"A4 is not optional" was right, and A4 has run.** The two documents A4 owed were marked in place: `SCENE-MODEL-2026-08-26.md` (**+31**) and `PIANO-SCENE-PARALLELE-2026-08-26.md` (**+7**).

**A3 and A4 both come before Wave B and neither touches the other's files.** A3 owns `shared/campaigns.ts`; Wave B owns it afterwards. That is sequential contention, which is allowed; concurrent contention is not.

**A4 is not optional.** Verified: `SessionRow.tsx:225` subscribes to the whole `session` array and there is **no `React.memo` anywhere in `src/ui/gm/`**. After Wave B every HP tap allocates a new `session`, so without A4 every mark re-renders every row of the plan.

### WAVE B — the core lane (ONE branch, ONE commit, atomic)

**This lane cannot be split, and saying so is part of the plan.** Deleting `combatants` and `liveScene` from `GmBoard` breaks `GmLive`, and `GmLive` is read by ten components. There is no intermediate state that compiles, and every "keep a mirror so it compiles" variant is the two-homes-for-one-fight defect being deleted. `PIANO-SCENE-PARALLELE-2026-08-26.md` §8 says the same thing from the other side: the schema bump lands on its own.

**Owns (contended files, all of them, exclusively):**

```
shared/campaigns.ts                 src/ui/gm/Names.tsx
src/ui/gm/gmStore.ts                src/ui/gm/Bestiary.tsx
src/ui/gm/SessionBody.tsx           src/ui/gm/Encounter.tsx
src/ui/gm/Scene.tsx                 src/ui/gm/StatBlock.tsx      (a `disabled` prop only)
src/ui/gm/SceneSwitcher.tsx         src/store/campaignMigration.ts
src/ui/gm/session.ts                tests/fixtures/schema/v5.campaign.json          (new)
src/ui/gm/SessionRow.tsx            tests/fixtures/schema/v4.parked.campaign.json   (new)
src/ui/gm/Countdowns.tsx            tests/fixtures/schema/v4.orphan.campaign.json   (new)
src/ui/gm/GmTopBar.tsx              + all 25 test files that mention combatants or liveScene
```

> **CORRETTO — 27 ago 2026 · CORR-27.** *"+ all 25 test files that mention `combatants` or `liveScene`"* was exact at `14c995a` and is not exact now. Measured: `grep -rl "combatants\|liveScene" tests --include="*.test.ts" --include="*.test.tsx"` returns **28** in this worktree (27 when the verification ran; Wave A's own `tests/fixtures/factories.test.ts` is the 28th). At `14c995a` the same greps give 23 / 22 / **25**, so the plan was right on the day.
>
> The two that arrived with #52 are **`tests/store/campaignImport.test.ts`** (26 its) and **`tests/store/campaignRoundTrip.test.ts`** (7 its), and both assert directly on the board keys this lane deletes. Worse, the catch-all cannot reach a third: **`tests/store/campaignBackup.test.ts` breaks under this lane while mentioning neither word** (`HAZ-47`). **A count is not an inventory.** Read §3.5 before sizing this step; and see `CORR-28` — one of the files this gate needs is not a test at all.

**Must not touch:** `src/ui/search/**`, `src/ui/shared/**` (Lane S), `src/engine/encounter.ts` (A1 already did it), `.github/**`, `data/**`, `shared/parsers/**`.

**Depends on:** A1, A2, A3, A4 all merged to `main` first. Rebase onto them before starting.

**Internal order — steps, not lanes. Do them in this sequence:**

1. **B1** `shared/campaigns.ts`: the constant, the fourth converter and its two helpers, the header rewrite, `GmBoard`, `emptyBoard`, `combatantsIn`/`environmentIn`, `liveScenes`' parameter, the reader's board literal and the `openScene` repair, the deleted warning.
2. **B2** `tests/fixtures/schema/*.json` + `tests/store/campaignSchema.test.ts` + `tests/store/campaignFile.test.ts` + `tests/store/campaignMigration.test.ts`. **The converter and its tests are green before a single line of store code is written** — this is the one place in the change that can lose a GM's live fight with no undo.
3. **B3** `src/ui/gm/gmStore.ts`: `GmLive`, `spread`/`gather`, `openCombatants`/`openEnvironment`, `withSceneFight`, the four re-signed actions, `showScene`, `openNewScene`, `patchSessionItem`'s strip, `removeSessionItem`'s clause; delete `runScene` and `adoptBoard`.
4. **B4** `src/store/campaignMigration.ts` (`LEGACY_BLOB_SCHEMA`, the stale comment deleted).
5. **B5** the readers of the store — `Scene.tsx`, `GmTopBar.tsx`, `Countdowns.tsx`, `SceneSwitcher.tsx`, `Names.tsx`, `Bestiary.tsx`, `Encounter.tsx`, `StatBlock.tsx`, `session.ts`, `SessionRow.tsx`. `npx tsc --noEmit` is your worklist; it enumerates every one of them.
6. **B6** `src/ui/gm/SessionBody.tsx` — the verb chain, the Facts, the file header (§4).
7. **B7** the 25 test files, seeds first via A2's `sceneWith`, then assertions.

> **CORRETTO — 27 ago 2026 · CORR-18.** Step **B6** is pointed at `SessionBody.tsx`'s file header with no copy to write: **§4 contains no instruction about that header at all.** Items 1‑9 are `<Fact>` sentences only, and the one header-shaped instruction in §4 is for `AddSheet.tsx`. Meanwhile the header carries two claims this plan inverts — `:46‑48`, *"A campaign has one live board: one roster, one combatant list, one active environment (`GmBoard`). A session row carries its **own** roster, adjustments, combatants and environment ref"*, and `:58‑62`, *"a row's stored `combatants` cannot be put back with their marks, because no action in `gmStore` sets the combatant list wholesale"* (already false — `CORR-22`). **Either §4 gains those two sentences, or B6's "the file header" is a step with no definition.** And see `HAZ-32`: the 16-line comment at `SessionBody.tsx:481‑496` argues the *opposite* of §4's three-branch design and will survive the edit as a live argument against the code beneath it.

**Acceptance (all must hold before the branch is offered):**

- `. ./env.sh && npx tsc --noEmit` clean and `npx vitest run` green on Node 24.
- **The owner's repro, as one test that fails on `main`** (§6, test 1).
- No source or test file anywhere in the tree contains the string `the board is running another scene` (case-insensitive).
- `grep -rn "liveScene\|adoptBoard\|runScene" src shared tests` returns nothing.

> **CORRETTO — 27 ago 2026 · CORR-28.** **This gate cannot pass without editing a file no lane owns.** `src/store/campaignImport.ts:52‑56` states the no-blanket-remap rule in terms of `board.liveScene` **by name** — *"`readCampaignRecord` repairs two pointers into the session list - a countdown's `sceneId` and `board.liveScene` - by naming a row id"* — and Wave B's Owns block names only `src/store/campaignMigration.ts` under `src/store/`. Separately, `tests/store/campaignRoundTrip.test.ts:582` holds a **live** `gm.useGm.getState().runScene('s1')` call, not prose; it reaches this gate only through the (now wrong) *"all 25 test files"* catch-all, and only because it happens to also contain the word `liveScene`.
>
> **Add `src/store/campaignImport.ts` to the Owns block above**, or this atomic single-commit lane ends red at its own acceptance. The rule in that file survives the rename — `openScene` is still a row id — but the sentence justifying a *prohibition* would name a field that no longer exists (`HAZ-13`, `HAZ-59`). The other three acceptance criteria hold as written.

### WAVE C — follow (two lanes, concurrent, disjoint)

| lane | owns | acceptance | depends on |
|---|---|---|---|
| **C1 — Chrome** | measurement only; if a number fails, it owns the wording fix in `src/ui/gm/session.ts` **or** `src/ui/gm/SessionBody.tsx`, not both | the audit rig at 393×852 and 375×667, `pointer: coarse`, insets 47/34, **on a port that is not 5199** and against a fresh IndexedDB (MEMORY: 5199 is the owner's real campaign): SceneArm's verb strip after two verbs leave; the shut row's `12 IN THE FIGHT` and `12 ON THE TABLE` against `RAGING RIVER`; the armed footer at 349; `docOverflowX === 0.00` at both sizes; re-run the whole-screen 44px sweep and **re-read `floorsOutsideTheSweep`** (`tests/gm/sessionList.test.tsx:1302`) rather than assuming its list, because two controls leave the screen | B |
| **C2 — the archive constraint, written where it will be read** | `shared/campaigns.ts`'s `ArchivedSession.items` docblock **only** | verified: `grep -rn "archive" src --include="*.ts" --include="*.tsx"` returns **nothing** — no archive writer exists, so this costs zero today. The obligation is written down: `items` must be `session.map(i => i.kind === 'scene' ? { ...i, combatants: [] } : i)`, or the first archive writer freezes a fight mid-flight as "what happened" | B |

> **CORRETTO — 27 ago 2026 · CORR-33.** **C2's gate fails on `main` as written.** `grep -rn "archive" src --include="*.ts" --include="*.tsx"` returns **10 hits**, across `src/ui/gm/TakeIn.tsx`, `src/store/campaignImport.ts` and `src/store/backup.ts` — not nothing. An agent running it literally may conclude an archive writer now exists, and will then either stall or edit a file C2 does not own (C2 owns the `ArchivedSession.items` docblock **only**). **Restate the gate** as `grep -rn "closedAt\|ArchivedSession" src` — 1 prose hit — or as *"nothing constructs an `ArchivedSession`"*.
>
> The obligation itself is unchanged and `HAZ-62` widens it: since #52 an imported file's `archive` is **persisted whole**, so archived `kind: 'scene'` rows now arrive from outside this device and are read by the same `readSessionItem` Wave B rewrites. C2 and §7 both reason only about the *writer* half; the reader half is live today.

**Contended files, named explicitly, and how they are split:** `shared/campaigns.ts` (A3 → B → C2, sequential, never concurrent), `src/ui/gm/session.ts` and `src/ui/gm/SessionRow.tsx` (A4 → B → C1), `tests/store/campaignSchema.test.ts` (A3 → B), `src/ui/gm/SessionBody.tsx` (B → C1), `tests/gm/session.test.ts` and `tests/gm/sessionList.test.tsx` (A4 → B). Lane S shares no file with any of them.

---

## 3.5 The tree moved: 64 hazards, by the wave they land on

**These are not corrections.** Every one is true of the tree at `ab66cf2` and simply unknown to a document written against `14c995a` — PR #51 (the search topic index), PR #52 (campaign import + backup) and PR #56 (Wave A) all landed after it. They are numbered `HAZ-01` … `HAZ-64` and lead with the ones that change what gets written. **A Wave B author reads this section before §1.**

### The five that will cost you the lane

**1 · `tests/store/campaignBackup.test.ts:144` goes RED under Wave B, and nothing in this plan finds it.** (`HAZ-47`, `HAZ-14`) The line is `expect(back.board).toEqual(raw['board']);`. It mentions **neither `combatants` nor `liveScene`**, so §3's owns-list catch-all cannot reach it and §6's table has no row for the file at all. After the `from: 4` converter, `back.board` is `{region, partyTier, roster, adjustments, environmentRef, openScene}` while `raw['board']` still carries both deleted keys, so the assertion fails on a file Wave B never planned to open. **And the file's own header predicts the opposite**: `:31‑33` says it *"stays green at 5 without being edited - or it goes red, which is precisely what a bump shipping without its `from: 4` converter should do to a backup that is on a GM's disk already."* **That prediction is falsified by the file's own line 144** — this bump deletes two board keys, so :144 goes red *even with a correct converter*. Wave B rewrites :144 to compare only the keys that survive **and rewrites that header sentence in the same commit**, or the next reader reads the red as a missing converter. `:143` (session) stays green, because branch (1) touches no row; `:189` asserts only `schemaVersion`, `name` and `id`.

**2 · 29 `setState` sites carry `combatants`, across 17 files. This plan says 12.** (`CORR-24`, marked at §0's axis-2 row and again at §6) The 12 is reproducible only as a single-line grep; a brace-balanced scan finds 29, all on `useGm.setState`, and the same scan at `14c995a` also returns 29. Deleting the field makes **29** compile errors, not 12. §6's *"Do the 12 seeds through A2's helper"* would leave seventeen unconverted, and they are exactly the ones a one-line grep does not show you.

**3 · 27 test files mention the two words, not 25 — and 28 today.** (`CORR-27`, `HAZ-04`, `HAZ-60`) `tests/store/campaignImport.test.ts` and `tests/store/campaignRoundTrip.test.ts` arrived with #52 and both assert directly on the keys Wave B deletes; `tests/fixtures/factories.test.ts` arrived with Wave A. B7 sizes itself off this figure, and an agent that stops at 25 leaves the two files that would have caught a converter losing a fight — the thing §2 calls *"the one place in the change that can lose a GM's live fight with no undo."*

**4 · Wave B's acceptance grep cannot pass without editing `src/store/campaignImport.ts`, which is in no lane's owns-list.** (`CORR-28`, `HAZ-59`, `HAZ-13`) `:52‑56` states the no-blanket-remap rule in terms of `board.liveScene` by name. Wave B owns only `campaignMigration.ts` under `src/store/`. The lane is atomic and single-commit; this is an acceptance criterion that ends it red at the last step.

**5 · The plan's new module-level `NO_FIGHT` collides in NAME with an already-exported `NO_FIGHT`.** (`HAZ-02`) `tests/fixtures/factories.ts:251` exports `NO_FIGHT = { roster: [], adjustments: {…}, combatants: [] }` — the three empty scene-row fields, spread into row literals — and **eleven** other test files import it (`grep -rl "NO_FIGHT" tests --include="*.test.ts" --include="*.test.tsx"` → 11). §1 introduces `const NO_FIGHT: SceneCombatant[] = []` in `shared/campaigns.ts`. **There is no compile collision** — the new one is module-private, the fixture lives under `tests/` — **and that is precisely what makes it dangerous.** Test 12's acceptance sentence (*"With `openScene === null` it returns the same `NO_FIGHT` object twice"*) will be read in files that already import a `NO_FIGHT` meaning three fields and not one array, and §1's docblock (*"One array, module-level"*) reads there as a description of the existing export. **Rename the new constant, or say in its docblock which `NO_FIGHT` it is not.** A reading collision, not a build one, and this repo pays for those later.

### Wave B · B1 — `shared/campaigns.ts`, the model and the converter

- **`HAZ-01`** A frozen v4 campaign **file** now exists and is a guard on this exact bump: `tests/fixtures/schema/v4.dhcampaign` (458 lines) with its consumer `tests/store/campaignBackup.test.ts`, both from `2334d49` (PR #52). Its payload carries `campaign.schemaVersion: 4`, `board.liveScene: "item-scene-1"` and `board.combatants: []`. §2's fixture inventory names only `v1.dhcampaign`.
- **`HAZ-06`** The **`encounter` arm's own docblock** will be falsified by the fourth converter, and §2 schedules only the `122‑150` header for rewrite. §2's test #2 quotes that very docblock as the rule the converter obeys. Landing a converter that moves data while a sentence three lines below the quoted rule says no converter in this chain changes a field is the failure §2's *"rewritten in the same commit rather than left to rot"* clause exists to prevent — applied to the wrong docblock.
- **`HAZ-16`** **`chainRecord` does not exist anywhere in the tree.** The key-order claim §2 marks *"Verified"* was checked against plain `JSON.parse` output and plain destructuring. If `chainRecord` rebuilds or normalises the board rather than returning it as-is, key order becomes that helper's responsibility, and the `JSON.stringify` half of the byte-for-byte walk is where it will show. The verification does not cover that step.

### Wave B · B2 — the fixtures and the schema tests

- **`HAZ-05` / `HAZ-19`** There is now a **second** frozen `.dhcampaign`, stamped at exactly the schema the new converter reads from, plus a whole test file whose stated purpose is to walk it across the next bump. Plan line 475 names `v1.dhcampaign` and nothing else. It should stay green untouched — but if it goes red the executor has no entry in §6 telling them what it is.
- **`HAZ-10`** That fixture is the **only committed file that drives the `from: 4` converter end-to-end through `parseCampaignFile`**, and the only one carrying a **non-null** `liveScene`; none of the four `.campaign.json` fixtures do. It lands safely on branch (1) — `openScene: 'item-scene-1'`, a real scene row, so the reader keeps it and stays silent — **but that was luck, not design**, and its guardian asserts `warnings` `toEqual([])`, which has no slack.
- **`HAZ-11`** `tests/store/campaignBackup.test.ts:189‑197` feeds a **current-shape** record through the `from: CAMPAIGN_SCHEMA_VERSION - 1` converter, so after the bump a v5-shaped board is handed to the new `from: 4` entry. The test stays green — it asserts only `schemaVersion`, `name`, `id` — while silently exercising the converter on an input shape it was not designed for. Not a shipping bug; a green test that proves less than its title claims. Worth one added assertion on `openScene`.
- **`HAZ-07`** The comment guarding `campaignSchema.test.ts`'s converter-count assertion **claims the test is edit-free on a bump, and it is not**. §2 schedules the two assertions and the `it()` title for edit; nothing touches the comment, which then sits above two lines the bump just proved it wrong about. Two words, same commit (MEMORY: prose claims go stale in their own commit).
- **`HAZ-15`** Two more hard-coded `4`s inside the byte-for-byte test, **one of them in the title**. §6 says only *"the v1 byte-for-byte walk hand-rewritten"*, so the literal is caught by a red test and the stale title is caught by nothing — the same class of defect §2's *"also rewrite the title"* line exists to prevent, one test lower.

### Wave B · B3 — `src/ui/gm/gmStore.ts`

- **`HAZ-52`** The file is **1411 → 1581 lines and holds a second subsystem this plan never saw.** `snapshotCampaigns`, `currentCampaigns` and the manual *"memory first"* read all flow the `GmBoard` change automatically — **no backup, export or import path builds a board literal by hand** — so nothing extra has to be *written*. But B3's worklist is an inventory of a file that is now half backup machinery, and **B3 can no longer be reviewed as "the scene half of `gmStore.ts`".**
- **`HAZ-03`** **`gather` is no longer private to the write path.** #52 added `snapshotCampaigns()` (`gmStore.ts:483‑508`), which folds the live board into every campaign record for the automatic backup, and rewrote `exportActiveCampaign` (`:1410`) to do the same for hand-saves; `publishCampaignSource(snapshotCampaigns)` at `:1541` wires the first into `store/backup.ts`. The moment the board's keys change, the backup folder and every hand-save start emitting schema-5 boards. Correct — and two legs §2's schema story neither enumerates nor schedules a test for.
- **`HAZ-50`** `tests/gm/gmStore.test.ts:705` is a **new** `it` from `b0cb250` asserting `snapshot.campaigns[0]!.board.combatants` after a bare `spawn`, in a describe §6's table does not mention. Under Wave B **both** the call and the assertion are compile errors, and there is no drop-in replacement: the test has no scene row at all, so it must first open one. Its purpose — proving the snapshot folds unwritten board state — is the guard on the leg the whole backup rests on, and has to survive the rewrite.
- **`HAZ-51`** `tests/store/backupSeam.test.ts` seeds **no** board state, so Wave B does not have to touch it — but it holds **two source-text tripwires on files Wave B rewrites**. A reformat that splits `publishCampaignSource(snapshotCampaigns);` (`gmStore.ts:1541`) across lines, renames the export, or wraps it turns a 21-guard file red for a reason unrelated to scenes; and adding any import edge from `campaignSource.ts` toward the GM store trips `:169`.
- **`HAZ-53`** Scoping the `switchCampaign` fold the handoff makes mandatory: one private helper, two call sites, **no existing test pins the defective behaviour and four constrain the repair's shape.** It must run *after* `flushGm()` and *before* the `set` that changes `activeCampaignId` (`writeAside:561‑566`); the folded record must be in `state.campaigns` first (`writeAside:568` looks it up at flush time); it must use `base.updatedAt` and never a fresh stamp (the discipline `snapshotCampaigns:501` and `exportActiveCampaign:1410` both state, and why `backup.ts:548` gates on `campaignChecksum`); and it must clear `dirty`, or `createCampaign:1321` restamps the wrong campaign. Green-must-stay: `gmStore.test.ts:421`, `:398`, `:844`, and above all `:983` — the control against *"a change that sent every patch down the aside path"*.

### Wave B · B4 — `campaignMigration.ts` and the legacy path

- **`HAZ-17`** **Test 26 is placed in a step that cannot make it pass, and the gap between the two steps silently eats a real GM's fight.** Test 26 is red at B2 by construction, so the executor either reorders on their own or weakens the test until it passes. And in the B2→B4 window the legacy path is exactly the defect §2 exists to prevent: a `dhc.gm.v1` blob loses its whole fight with no warning and the localStorage key is then deleted, **because `migrateLegacyGmState` verifies the round-trip of what it built, not of what the blob held.**
- **`HAZ-21`** **`campaignFromLegacy` is not exported**, so test 26 cannot address it directly: `migration.campaignFromLegacy` is `undefined`, and a test written literally against the name passes vacuously or throws. The reachable route is the one the file already uses — and it is the better test anyway, because it exercises the mint and `readCampaignRecord` together.
- **`HAZ-20`** `campaignMigration.test.ts:108` reads `c.board.combatants`, which this plan deletes, and §6's row for that file does not say so. §6 gives exactly that instruction for ten other files, so the omission reads as deliberate. **These two lines are the only assertions in the suite that prove a legacy blob's marks survive the move out of localStorage** — rewriting them onto the scene row is the substance of test 26, not a seed edit.
- **`HAZ-23`** `stable()` is now **exported and shared with the import path** — the sole reason every §2 line number in `campaignMigration.ts` moved, and it explains the uniform **+6**. Any §2 citation into that file not accounted for by +6 was wrong when written, which is the case for the `216‑219` comment range (`CORR-09`, `CORR-11`). B4 now edits a file with a second consumer downstream, though `stable` itself is untouched by the model change.
- **`HAZ-12` / `HAZ-22`** **`parseCampaignFile` now hands out the envelope's own `schemaVersion`, and the import UI turns it into a sentence on screen.** §2's *"Nothing in `src/transfer/campaignFile.ts` changes"* stays true of the source — but after the bump **every `.dhcampaign` a GM already has on disk imports with a conversion notice attached**: *"at campaign schema 4. This app reads 5, so it was converted on the way in."* First time that string ever fires in production, on a screen this plan never mentions, with no test budgeted for it.

### Wave B · the readers and the import surface #52 built

- **`HAZ-08`** #52 added a **fourth** campaign write path and a whole import surface §2's inventory of doors does not name. The version door still holds — `addCampaign` cannot overwrite (`ConstraintError` → `'taken'`, `campaigns.ts:200‑207`) and `parseCampaignFile` refuses a future-schema file before `campaignImport` sees it — so nothing in §2's argument is *wrong*. But §2's *"the three doors it closes are already built"* should say **four**.
- **`HAZ-09` / `HAZ-18` / `HAZ-43`** Two entirely new test files assert directly on the two fields §2 deletes, and **the plan names neither**: `grep -n 'campaignRoundTrip\|campaignImport\|campaignBackup\|TakeIn\|campaignSource' docs/handoff/PIANO-B-SCENE-PER-RIGA-2026-08-27.md` returns nothing. `campaignImport.test.ts:173`/`:175` is a helper that projects both keys, so deleting either is a **compile** error, not a failing assertion; `:385‑399` asserts the repair behaviour for *"a `board.liveScene` that names no row"*, which is exactly the semantic §1 redefines; `:396‑401` is load-bearing for a different lane's decision (no blanket id remap on import), stated in terms of `board.liveScene`. ~1,480 lines of new test the plan budgets nothing for.
- **`HAZ-48`** **`tests/store/campaignRoundTrip.test.ts` calls the deleted verb.** `:582` is `runScene('s1')` — the only `runScene` call outside `tests/gm/`, so B7's *"the 25 test files, seeds first"* will not naturally reach it while the acceptance grep will. It is the file HANDOFF §4 calls *«la cosa che nessuna delle due metà poteva provare»*, and its whole point is the seam mutant — *«far leggere il disco a `currentCampaigns` uccide tutti e 7 i test»*. **Rewriting `runScene('s1')` as `showScene('s1')` changes what the dirty board contains**: today `runScene` MOVES the row's combatants onto the board; under Wave B they stay on the row. `:641` becomes `openScene`, and **the reviewer must confirm the mutant still dies.**
- **`HAZ-49`** `campaignImport.test.ts` builds both board keys by hand and reads them back through `idsOf`, the load-bearing *"every id except the key is kept byte-identical"* assertion of the whole import decision. Under Wave B the `boardCombatants` id space **ceases to exist** and its ids move into `rowCombatants`, so the helper must be **reshaped rather than renamed** — and `:381` is titled *"keeps the two pointers standing"* while one of the two pointers is what this change renames. Separately: `:397` targets the **countdown** warning (`shared/campaigns.ts:1644`) and keeps its teeth; `:398`'s `/live scene|no longer has that scene/i` matches no warning in the tree and **is already vacuous**.
- **`HAZ-13`** `src/store/campaignImport.ts:52‑56` states the no-blanket-remap prohibition **in terms of `board.liveScene` by name**. The rule survives the rename; the sentence justifying it will name a field that no longer exists, in a file the plan never opens. Load-bearing for a prohibition, not decoration.
- **`HAZ-62`** **An imported file's `archive` is now persisted whole**, and archived `kind: 'scene'` rows go through the same `readSessionItem` Wave B rewrites. §7's archive bullet and lane C2 both reason only about the *writer* half. The arrival path is live today and the plan names neither it nor the reader.

### Wave B · B5 — the readers of the store

- **`HAZ-39`** §4's `Scene.tsx` list names `:296‑306`, `:108‑110`, `:402` and a new empty state — but **`Scene.tsx` reads `liveScene` at FOUR places**, and the two it does not name include the **runner's clock filter** at `:38`. An author working the bullets literally renames two sites and leaves the runner drawing the OPEN row's cards above the LIVE row's clocks. It is caught by the compiler only if the field is removed outright rather than kept alongside; §4 does not say which.
- **`HAZ-40`** §4 lists only `src/ui/gm/*`, but **two of the functions its arguments rest on live in `shared/campaigns.ts`**, which the section never names. The SceneSwitcher paragraph's whole argument (*"a fought-and-left row keeps its combatants and therefore keeps its chip"*) is a property of `liveScenes`, whose parameter is literally called `liveScene`. A rename that stops at the `src/ui/gm` boundary leaves the shared predicate contradicting every renamed caller.
- **`HAZ-42`** §4's `SessionRow.tsx` paragraph discusses only `armedLabel` — but **`SessionRow.tsx` is the sole production caller of `describeItem` and passes it the pointer**. §4's `session.ts` rewrite turns that argument's meaning inside out (`ON THE TABLE` now keys on the open row) while quoting the file's *"the signature does not move, and none of `describeItem`'s call sites do either"* as still holding. It holds structurally; the one call site that must now pass a different value sits in a file whose §4 paragraph talks about nothing but a button label. (A4 has since moved that lookup to `SessionRow.tsx:247`.)
- **`HAZ-41`** A **second** sentence in the `AddSheet.tsx` docblock §4 tells the author to edit is already false today, and §4 does not know about it. It is the higher-teeth defect of the two: it is the sentence that would let a future reader believe `encounter` was **never excluded** from `SESSION_ITEM_KINDS` — the one thing MEMORY says still has teeth. §4 walks past it while invoking the very rule it breaks.

### Wave B · B6 — `src/ui/gm/SessionBody.tsx`

- **`HAZ-32`** **The comment at `:481‑496` argues the OPPOSITE of §4's three-branch design, and no plan item names it.** Sixteen lines, sitting directly above the verb strip B6 rewrites, surviving the edit as a live argument against the code beneath it. It also states the reason the demoted verb was kept at all — *"the runner's empty state is the only door in the app to the bestiary from here"* — a constraint §4's replacement chain does not address.
- **`HAZ-33`** The `disabled` guard's own **12-line docblock (`:941‑952`) survives item 9's deletion of the guard it explains**, documenting a guard that no longer exists and citing a decision this plan overturns. Item 9 names neither it nor the fact that `945‑947` **is** that comment (`CORR-15`).
- **`HAZ-34`** A **tenth** EncounterArm `<Fact>` (`:896‑903`) names the label item 8 renames and is not in §4's list — though §4 claims to enumerate *"every `<Fact>` sentence and label that becomes false"* and item 8 establishes the rule that when nothing is open the sentence says so.
- **`HAZ-35`** CountdownArm's `<Fact>` (`:1295‑1299`) uses the exact vocabulary this plan retires — *"while that scene is running"* — and is not in §4's list. §4 handles `Countdowns.tsx` but never looks at the countdown arm **inside** `SessionBody.tsx`, so the word *running* survives in the file B6 is rewriting.
- **`HAZ-36`** **The word "parked" survives on branches §4 explicitly keeps.** `startFight`'s docblock (`:373‑383`) — the docblock of the one branch kept — argues from parking, and the CLEAR comment (`:629‑633`) still says *parked*. Item 3 rules that *"the word «parked» must not survive the mechanism it named"*, then applies it to one `<Fact>` only.
- **`HAZ-37`** **§4's START THIS FIGHT chain writes a call the branch does not make.** `spawn(item.id, …)` drops `byId.get(entry.ref)!`, `partySize` and `entry.count` behind the ellipsis. B6 following §4 literally writes a call that neither typechecks against `spawn` nor preserves the Minion `count`×`partySize` expansion documented at `:874‑876`. The signature change belongs to §3; §4 is where B6 reads the chain.
- **`HAZ-38`** The comment at `:427‑434` is **the changelog of the very sentence item 1 rewrites**, and item 1 does not name it. It documents one rewrite of the `<Fact>` at `:435`; item 1 performs a second. Left untouched it describes a sentence that no longer exists.

### Wave B · B7 — the test inventory and the counts

- **`HAZ-04` / `HAZ-60`** *"all 25 test files"* is 27, and 28 today (`CORR-27`). Two of the three B7 does not know about are the **round-trip and import** suites — the ones that would catch a converter losing a fight.
- **`HAZ-44`** Five further test files landed with #52 that the plan does not name — `gmSave` (17 its), `campaignBackup` (12), `integrityCampaignLeg` (4), `settingsCampaignBackup` (5), `unsavedWorkNote` (2). They do not widen the blast radius, but they are **why §0's four suite-wide numbers all moved** and why §6's closing estimate (*"~25 files touched, ~20 `it()` deleted against ~32 added"*) is sized against a suite that no longer exists: **154 → 161 files and 3355 → 3502 real `it(` blocks** between `14c995a` and `3aa8f23`, and **162 files / 3536 blocks** at `ab66cf2` once Wave A landed (`CORR-23` carries both commands).
- **`HAZ-46`** The plan's counting method (`grep -o '\bit('`) **over-counts by 6 suite-wide**, and by 1 in a file §6 names. It is the sole cause of §6's `sceneTruth` "43" (real: 42) and the row total "59" (real: 58) — `CORR-25`, `CORR-26` — and of the 3361 being 6 too high even at `14c995a`. Any lane re-deriving counts uses the anchored form.
- **`HAZ-45`** **An untracked probe file is sitting in the tree**: `tools/.cache/dbg.test.ts` (25 lines, `describe('dbg', …)`, stubs `localStorage` and calls `backupStatus`). Anyone recounting the suite with a bare `find` gets 162 and matches neither the plan nor a vitest run. Exactly the leftover MEMORY warns about — *check the tree for probe files an audit left behind.*

### What Wave A left standing for Wave B

- **`HAZ-24`** **`gmStore.ts` already carries a deep copy of the thresholds tuple, at the one crossing Wave B deletes**, and A1 was forbidden to touch that file. That `copy()` is today's **only** downstream defence against the alias, and §6 retires it (*«every park/resume deep-copy case»* deleted). **A1's mint-time copy is therefore not redundant with it — it is what has to be in place BEFORE Wave B removes it.** Nobody in Wave A could update that docblock's now-half-stale argument; whoever runs Wave B inherits it.
- **`HAZ-25`** The aliased tuple is **a live handle on the app-wide dataset**, not on a throwaway copy: a mark written on one combatant's thresholds would follow the GM for the rest of the session and into every subsequent spawn of that adversary. A1's teeth are in the shipped app, not only in a test.
- **`HAZ-26`** A reloaded campaign is **already safe**, so A1's test had to exercise the **mint** path specifically — an assertion through the campaign reader would have passed either way and proved nothing.
- **`HAZ-27`** The bare name `scene` is **taken as a local helper in at least fifteen test files**; `sceneWith` is the only free name of the two. It must not be "tidied" to `scene` later, or B7's imports shadow those locals.
- **`HAZ-28`** **A2 could only create the helper, not adopt it** — every seed §6 wants routed through `sceneWith` lives in files A2 was forbidden to touch. A2's *"full suite green"* was therefore satisfiable by a helper nothing imports, so **a green A2 is not evidence the signature fits the call sites.** Check it against a couple of those locals' shapes before B7 depends on it; fixing it later means reopening a Wave B file.
- **`HAZ-29`** A4's fix would **not** have worked as specified — `SessionList` handed each row a freshly-allocated `handle` on every render, so `React.memo` alone would have skipped nothing while the `$$typeof` acceptance passed. **What shipped answers it**: handles are cached on factory/row/index by row id and returned by reference (`SessionList.tsx:155‑170`). Recorded because the acceptance criterion above still cannot detect the difference.
- **`HAZ-30`** The ordering constraint A3 needed is against `deduped.sort`, not the countdown-scope repair — see `CORR-13`. An author who satisfies the plan literally is safe **by accident**; one who reads the reason, sees it does not bind, and relocates the pass silently changes which of two duplicate rows keeps its identity. **A3 has shipped and states the true boundary**; do not restore the plan's version of it.
- **`HAZ-31`** Five files consuming `readCampaignRecord().warnings` landed after `14c995a` and were invisible to A3's boundary, which named `src/store/**` as must-not-touch. Now history — but it is the concrete reason `CORR-14` (the `e25db1f` cut point) had teeth rather than being cosmetic.

### Lane S — already landed; §5 is a record, not a worklist

- **`HAZ-54`** **The sticky SHUT control between the grid and a lit kind's records is not in §5's component tree at all.** §5's tree shows a lit kind going straight to `<RuleSearchResults browse={{ kind }} …>` with nothing between. Anyone rebuilding the screen from that tree **drops the one thing the 11,557px measurement forced**, and a shipped test fails with no explanation in this plan (`CORR-32`).
- **`HAZ-55`** `RuleSearchResults` grew a **`banded` prop §5 never mentions**, and both browse call sites pass `banded={false}`. Without it a chapter's list restates the row two lines above it word for word and count for count; the guard at `:365` is the only thing that catches a plan-faithful rebuild.
- **`HAZ-56`** **`asked` is now hard-nulled under a browse**, so §5's *"harmless today"* loose end is **dead rather than latent** — it is a guarantee written into the code now, not an observation about the shipped data.
- **`HAZ-57`** **`CHAPTER_OPENS` left `src/` and now lives in the test**, defended by the orphans guard. §5 still lists it among `chapters.ts`'s exports: anyone who trusts that list gets a type error, and anyone who "restores" it fails `tests/harness/orphans.test.ts`.
- **`HAZ-58`** **The empty index state scrolls at 375×667, and §5's named remedy was examined and refused.** *"Fits by 30"* and *"delete the lead sentence"* are both superseded: the column always scrolled, and deleting the sentence buys 32px toward a fold this content does not have to meet.
- **`HAZ-64`** §7's *"Curating the search index"* bullet reads as a constraint on work Lane S still has to do; **it is now a description of code already on `main`** (and `CORR-34`: the tripwire was tripped before the guard was written). Anything in §5 that says Lane S *"still has to build"* or *"still owes"* must be re-read against `main` before it is scheduled.

### The boundaries between lanes

- **`HAZ-61`** **Wave B must edit a file Lane S's acceptance declares a tripwire, and the two lanes run concurrently.** Wave B's grep-to-zero requires touching `ruleSearch.test.tsx`; Lane S's acceptance treats *a diff in either* as proof of overreach. §3's *"Lane S shares no file with any of them"* is true of the owns lists and **false of Lane S's own signal file** — the two acceptance criteria contradict each other on one line of one file. Moot only because Lane S has landed; restate it before anyone re-runs this plan from the top.
- **`HAZ-63`** §3's cut point `e25db1f` is **50 commits behind `main`** — see `CORR-14`. Branching there rebuilds on a tree missing `src/store/campaignImport.ts`, `src/store/backup.ts`'s campaign leg, `TakeIn.tsx`, the shipped search index, and all of Wave A, and then meets every token-bearing file above as a merge surprise.

---

## 4. The UI, per state

### SceneArm — five branches become three, all primary, all about this row

| this row | label | what it does |
|---|---|---|
| `item.combatants.length > 0` | **`OPEN THIS FIGHT`** | `showScene(item.id); onOpenTool('scene')` |
| else `spawnable.length > 0` | **`START THIS FIGHT`** | `showScene(item.id); for (…) spawn(item.id, …); onOpenTool('scene')` |
| else | **`OPEN THIS SCENE`** | `showScene(item.id); onOpenTool('scene')` |

There is no `isOpen` branch and **SceneArm no longer reads `openScene` at all** — the chain is idempotent on the row already showing. That removes the last state in which a verb on this row could be about another row, and it is why "never draws two primary verbs" stops being a test and becomes the shape of the code.

- **`OPEN THE SCENE` is retired.** Its "the" meant *the one board's scene*, which is the word that lied. `OPEN THIS SCENE` is one character longer and cannot overflow anything the old label fitted.
- **`BACK TO THIS FIGHT` is deleted.** "Back" named a return trip that no longer happens.
- **`TAKE THE FIGHT ON THE BOARD` is deleted**, with `orphan`, `claimable`, `onTable`, and `adoptBoard`.
- **`CLEAR THIS FIGHT` / `TAP AGAIN TO CLEAR` stays, unconditional on `item.combatants.length > 0`**, and now calls `clearScene(item.id)`. It is deliberately *not* hidden on the open row: making a control appear and disappear according to which screen the GM was last on is exactly the "tap count depending on unseen state" that `Scene.tsx:66‑79` objects to. Two armed destructions reachable from two screens, both arming, both naming the same fight, is not a defect.
- **The four crossing verbs are untouched**, labels, disabled conditions and measured widths (246.41 / 251.23 for the roster pair, 289.06 / 293.89 for the environment pair, against a 363px column): `PUT THIS ENVIRONMENT ON THE BOARD`, `KEEP THE BOARD'S ENVIRONMENT HERE`, `PUT THIS ROSTER ON THE BOARD`, `KEEP THE BOARD'S ROSTER HERE`.

> **CORRETTO — 27 ago 2026 · CORR-19.** `Scene.tsx:66‑79` is the wrong range. The objection to a control whose *"tap count depends on unseen state"* is at **`src/ui/gm/Scene.tsx:75‑86`**, restated at `:105‑106`. Lines `66‑69` are a different paragraph about a different decision entirely — `undefined` on an empty board, never 0, for the environment band's `strongestHere` — and `:70‑73` is the `strongestHere` expression itself. The cited range covers that unrelated paragraph plus only the first five lines of the comment, **cutting the objection sentence in half**. `Scene.tsx` is unchanged since `14c995a`, so this was wrong when written. The argument stands and the file does make it; only the citation moves.

**Ergonomics.** Two 44px verbs leave the strip and none arrives, so the arm returns **88px** of scrollable row content at both sizes (each verb is 44px on a line of its own by `SessionBody.tsx`'s own Chrome measurement; the 104px that file records is what the *roster* pair cost when it landed, and must not be quoted as the environment pair's). The primary is last in the wrapped strip, which keeps it lowest on the row and nearest the thumb, exactly where `EncounterArm` already puts its own. Every remaining control keeps its inline `minHeight: 44`/`var(--tap)`; nothing new is added, so nothing can fall under the floor. Every deletion below is prose — read, never touched, carrying no target, and sitting above the strip and out of the 560–820 band.

> **CORRETTO — 27 ago 2026 · CORR-17.** *"the arm returns **88px** of scrollable row content at both sizes"* — **it returns 0px.** The two verbs being deleted, `BACK TO THIS FIGHT` (`SessionBody.tsx:531`) and `TAKE THE FIGHT ON THE BOARD` (`:560`), are alternate arms of the **same single-slot ternary** as the verbs that survive (`:521‑583`). Exactly one of the five is ever rendered, so removing two branches removes **zero** rendered lines: the strip still draws one primary + the four crossing verbs + the conditional CLEAR, before and after. This was already true at `14c995a`.
>
> **C1 will therefore find no delta to confirm.** Its rig line *"SceneArm's verb strip after two verbs leave"* should be rewritten as a no-change assertion, or dropped, rather than run and read as a failure. The rest of the paragraph is unaffected: the 44px floors, the wrapped-strip order, and the prose sitting above the strip and out of the 560–820 band.

### Every `<Fact>` sentence and label that becomes false

**`src/ui/gm/SessionBody.tsx` — SceneArm**

1. `~435` — *"This is the plan. Running this scene puts its environment on the board; parking it leaves whatever is there."*
   → **REWRITE:** *"This is the plan and the table. This scene keeps its own place and its own fight, with every mark on it, until you clear them — opening another scene moves nothing."*
2. `~441` (`isLive`) — *"This scene is on the board. Its adversaries and their marks are on the table, not in the plan, until you run another scene or end this one."*
   → **DELETE.** It is exactly backwards now — the marks *are* in the plan, on this row, always — and the arm no longer reads `openScene`. Which row the runner is showing is said by the shut row's `ON THE TABLE` and by the switcher's `aria-current` chip.
3. `~448` (`!isLive && parked > 0`) — *"Parked here: {n} adversar(y/ies), with their marks. BACK TO THIS FIGHT puts them back exactly as they were, and parks whatever is on the board into its own row."*
   → **REWRITE:** *"In this scene: {n} adversar(y/ies), with their marks. OPEN THIS FIGHT goes to them exactly as they stand; nothing is parked and nothing is swapped."* The word "parked" must not survive the mechanism it named.
4. `~466` — **the headline.** *"The board is running another scene, so OPEN THE SCENE shows that one and not this. Run this row instead, or end that fight first."*
   → **DELETE.** This is the sentence the owner was shown by an app that offered no verb to obey it. The state is unrepresentable; there is nothing left to describe. Held by an absence test (§6, test 20).
5. `~473` (`orphan`) — *"There {is 1 adversary / are N adversaries} on the board belonging to no row of the plan. TAKE THE FIGHT ON THE BOARD makes them this scene's, exactly as they stand — nothing moves and no mark is lost."*
   → **DELETE**, with its branch and its verb.
6. `~515` — *"To change this plan: put it on the board, edit it in the builder, then bring it back with KEEP THE BOARD'S ROSTER HERE. The board is the campaign's one workbench — this row is a copy, and neither writes to the other until you tap one of these."*
   → **NARROW:** *"To change this plan: put its ROSTER on the board, edit it in the builder, then bring it back with KEEP THE BOARD'S ROSTER HERE. The board is the campaign's one workbench for building an encounter — this row is a copy, and neither writes to the other until you tap one of these. The fight itself is never on the board: it is on this row."*

**`src/ui/gm/SessionBody.tsx` — EncounterArm**

7. `~906` — *"The scene already holds {n} adversar(y/ies). Opening the fight from here adds this roster to them rather than replacing them; END SCENE, in the scene, is what empties it."*
   → **REWRITE** to name the destination: *"{SceneName} already holds {n} adversar(y/ies). Opening the fight from here adds this roster to them rather than replacing them; END SCENE, in that scene, is what empties it."*
8. `~913` — *"The encounter builder works on the campaign's one board, not on this row. OPEN THE FIGHT goes straight to the scene with this row's roster and leaves the board's roster alone."*
   → **KEEP the mechanism, name the room:** *"…OPEN THE FIGHT goes straight to {SceneName} with this row's roster and leaves the board's roster alone."* When nothing is open, the label reads `OPEN THE FIGHT IN A NEW SCENE` and the sentence says so.
9. `~962` — *"The board is running another scene. Run that row instead, or end that fight first."*
   → **DELETE**, together with the `liveScene !== null && liveScene !== item.id` half of `OPEN THE FIGHT`'s `disabled` (`SessionBody.tsx:945‑947`). The remaining guard is `spawnable.length === 0`.

> **CORRETTO — 27 ago 2026 · CORR-15.** **`SessionBody.tsx:945‑947` is prose, not the guard.** The `disabled` expression is eight lines lower, at **`:953‑955`**: `disabled={` / `spawnable.length === 0 || (liveScene !== null && liveScene !== item.id)` / `}`. Lines `945‑947` sit inside the guard's own comment block (`:941‑952`) — *"clearing it, which was harmless when the board was the only fight / there was. With another scene running, pressing it here pours this / row's adversaries into that scene - and the flip would then park"*. **Anyone editing "945‑947" literally edits the comment and leaves the guard standing.** The expression quoted here is verbatim and unique in the file, so cut by string. And see `HAZ-33`: that 12-line docblock survives the deletion of the guard it explains, and item 9 names neither it nor the fact that the cited lines *are* it.

**`src/ui/gm/Scene.tsx`**

10. The END SCENE docblock (`~296‑306`) — *"It used to be `commit({ combatants: [] })` and nothing else; it now empties the scene ROW this fight was parked out of as well, and lets go of the pointer."*
    → **REWRITE:** END SCENE empties the open row and leaves you in it. It no longer lets go of a pointer, and there is no second thing that happens.
11. The cost sentence on the glass — *"Clears {n} adversaries and every HP and Stress mark on them. {Environment}, Fear and the countdowns stay."* → **KEEP verbatim.** Every clause is still exact, and its character budget is unchanged.
12. The disarm effect (`Scene.tsx:108‑110`) keys on `openScene` instead of `liveScene`, and its docblock stays: the runner still swaps rows in place from the switcher, so the arming can still point at a table that is no longer there.
13. The card key (`Scene.tsx:402`) becomes `` key={`${openScene ?? ''}:${c.id}`} `` and its comment stops calling row-local ids "the very fact that makes `liveScene` non-derivable" and starts calling them the stated invariant they now are.
14. **NEW empty state**, drawn when `openScene === null` or names no scene row: *"No scene is open."* plus **`START A NEW SCENE`** (`openNewScene()`), above the existing `BUILD AN ENCOUNTER` / `OPEN THE BESTIARY` doors, whose labels do not change because the buttons on those screens now say `… A NEW SCENE` themselves. The `combatants.length === 0` panel ("Nothing in the scene") is kept, unchanged, for a row that is open and empty.

> **CORRETTO — 27 ago 2026 · CORR-20.** The two doors exist, but **they are not labelled in caps.** They read *"Build an encounter"* and *"Open the bestiary"* — sentence case. A `START A NEW SCENE` written literally as this line spells it would be **the only all-caps label in that `.row`**. Either match the neighbours or change all three deliberately and say why; but *"whose labels do not change"* is describing labels this document has never read. **Left open**, because the verification did not settle it: which case the three should end up in is an ergonomics decision, and C1's rig is where it belongs.

**`src/ui/gm/SceneSwitcher.tsx`** — `liveScene` → `openScene`, `runScene` → `showScene`, and the chip's accessible name changes from `` `Run ${sessionName(item)}` `` to `` `Open ${sessionName(item)}` ``. **Every measured number survives untouched** — 315.00 of strip, 7.00px per character, the 74px floor, the 0.00px vertical cost, the `<span aria-current>` for the current chip — because the strip's shape does not change. Two docblock claims get *stronger* rather than changing: *"No confirmation, and no arming — the flip destroys nothing"* is now true because nothing even moves, and the strip finally shows what its own docblock promised, because a fought-and-left row keeps its combatants and therefore keeps its chip. **Named risk:** the strip now grows by default — holding a fight is the resting state of a played scene rather than the result of a deliberate park, so five simultaneous chips stops being pathological. The 44px floor and the horizontal scroll hold and no geometry changes, but the seven-character truncation bites more often, and `CLEAR THIS FIGHT` on the row is the only pruning gesture. Flagged, not fixed.

**`src/ui/gm/GmTopBar.tsx`** — `SCENE · n` reads `openCombatants(s).length`. It counts the **open** scene, not a total across scenes, because the chip is a door to one runner and a number that does not match what opening it shows is worse than a number narrower than the truth. **Named cost:** a GM who closes the runner while three rows hold fights sees no chip until one is open — acceptable, because the plan list underneath now shows all three with their own counts, which today it could not.

**`src/ui/gm/session.ts` — `describeItem`, two segments always, never three.** The premise at `session.ts:274‑277` — *"The row the GM is playing reads `combatants.length === 0`, because resume empties it"* — **inverts and must be rewritten, not patched**, and without a change the open row would print three segments, which `session.ts:283‑292` measured and refused on a 393px phone. The new second term, one of three:

| state | term |
|---|---|
| this row is `openScene` | `{n} ON THE TABLE` (or `ON THE TABLE` when empty) |
| else `combatants.length > 0` | `{n} IN THE FIGHT` (replacing `{n} PARKED`) |
| else `planned > 0` | `{n} PLANNED` |

`[place, second].filter(s => s !== '').join(' · ')`. Worst realistic row: `RAGING RIVER · 12 IN THE FIGHT`, 30 characters ≈ 210px at the 7.0px/char this repo has measured twice, inside the 363px column. **C1 measures it anyway**; `{n} HERE` is the pre-agreed fallback.

**`src/ui/gm/SessionRow.tsx`** — `armedLabel`'s `TAP AGAIN TO DELETE THE FIGHT` is **kept verbatim** (29 characters, 223px in a 349px footer, already measured) and becomes strictly more correct: deleting the row now takes the fight with it, which is what the label has always promised.

> **RAGIONE STANTIA — 27 ago 2026 · CORR-21.** Keeping the label verbatim is still right, and the literal, the 29, the 223 and the 349 are all in `SessionRow.tsx`. But **the 223 is explicitly not measured** — the file's own last word on it is a standing instruction to re-measure. Only the **349** and the **62 / 69 / 83 / 62** verb widths were read in Chrome; the 223 is extrapolated from two points at 7.0px/char. Do not carry *"already measured"* forward: **C1 measures it, or the parenthesis comes out** (MEMORY: reason about screen ergonomics; un numero ereditato va rimisurato).

**`src/ui/gm/Countdowns.tsx`** — `liveScene` → `openScene` at `:190` and `:283`. The `var(--hope)` heading's meaning restates from "the scene on the board" to "the scene the runner is showing". The `group.id !== null` guard stays for the reason its comment gives.

**`src/ui/gm/Names.tsx:156`** — **the fix no angle but one noticed.** `taken` builds the name pool from `s.combatants`; narrowing that to the open scene would let the generator hand out a name already in use in a scene the GM is not looking at. It must read **every** scene and encounter row's combatants out of `session`:

```ts
const fought = useMemo(
  () => session.flatMap((i) => (i.kind === 'scene' || i.kind === 'encounter' ? i.combatants : [])),
  [session],
);
```

**`src/ui/gm/Encounter.tsx`** — `send()` becomes `openScene !== null ? spawn(openScene, …) : (id = openNewScene(), spawn(id, …))`, then `setRegion('scene')`. The button reads `SEND {n} TO THE SCENE` or `SEND {n} TO A NEW SCENE`. `opensIn` (`Encounter.tsx:576`) reads the **open row's** environment when one is open and the **board's** when none is (because that is what the minted row will take) — which finally makes its sentence exact, and half-answers the open question its docblock names (*"whether an encounter and a scene are the same record, in which case the question dissolves"*). Mark it answered.

**`src/ui/gm/Bestiary.tsx:275`** — `ADD TO THE SCENE` / `ADD TO A NEW SCENE`, same rule. **`EnvironmentBlock` in `StatBlock.tsx` gains an optional `disabled` prop** — not for this, but so the two SET ACTIVE controls can be disabled if a later change ever needs it. `setEnvironment` and both its call sites (`Bestiary.tsx:296`, `SessionBody.tsx:1037`) are **unchanged in signature and in meaning**: they set the board's — the builder's — place, which is what `SEND` names and what `KEEP THE BOARD'S ENVIRONMENT HERE` copies onto a row. **Stated behaviour change, to go in the commit message rather than be discovered:** a GM who toggles an environment in the bestiary while a scene is open no longer sees the runner's band change, because the band belongs to the scene now.

**`src/ui/gm/Gm.tsx`** — expected to need no code change (`Scene` self-selects `openScene`; `SceneSwitcher`'s props are unchanged). **Verify `inert` is still on the session list at `Gm.tsx:305`** before relying on it: it is what makes "a combat tap writes the array the drag reorders" unreachable, because the runner being open means the plan cannot be dragged.

**`src/ui/gm/AddSheet.tsx`** — prose only. Its claim that a row's combatants are "the live fight, no action in gmStore sets a combatant list wholesale" is now false in both halves. Delete it rather than re-derive it. `THERE IS NO ROSTER TO CARRY` and the scene form are unchanged, and `encounter` stays out of `SESSION_ITEM_KINDS` (MEMORY: the ADD sheet gap is closed; what still has teeth is that `encounter` must never go back in).

> **RAGIONE STANTIA — 27 ago 2026 · CORR-22.** The instruction stands — **delete the sentence rather than re-derive it** — but the attribution does not. *"Now false in both halves"* implies this plan is what falsifies it. **The second half is already false at `ab66cf2`, and was already false at `14c995a`: two `gmStore` actions set a combatant list wholesale today.** What is genuinely narrow-and-still-true is the *encounter-row* case — both actions filter to `kind === 'scene'`, so no action writes an `encounter` row's combatants.
>
> And see `HAZ-41`: **a second sentence in this same docblock is already false and is the higher-teeth defect of the two.** It is the one that would let a future reader believe `encounter` was never excluded from `SESSION_ITEM_KINDS` — the exact thing MEMORY says still has teeth. This paragraph invokes that rule and walks past the sentence that breaks it.

---

## 5. The search index

### State of the work — read this before planning any of it

| piece | state |
|---|---|
| `src/ui/shared/chapters.ts` (318 lines: `SRD_CHAPTERS`, `SrdChapter`, `CHAPTER_LABELS`, `CHAPTER_OPENS`, `SECTION_CHAPTER`, `sectionsInChapter`) | **SHIPPED** at `14c995a` |
| `tests/ui/chapters.test.ts` (10 tests, incl. both licence guards) | **SHIPPED** at `14c995a`, green |
| `src/ui/shared/RuleSearch.tsx` — `Belonging`, `Browse`, the `browse` prop, `browsing`, `browsedRecords`, `spoken` rewritten, the band family | **UNCOMMITTED, typechecks, `ruleSearch.test.tsx` (85) green untouched** |
| `src/ui/search/Search.tsx` — the docblock (+90 lines) | **UNCOMMITTED**, ahead of its own body |
| `Search.tsx`'s **body** — `KindGrid`, `ChapterRows`, the lit-kind/lit-chapter state | **NOT WRITTEN** |
| `tests/ui/searchScreen.test.tsx` — the index guards | **NOT WRITTEN** (the file exists, 8 tests, none about the index) |

> **CORRETTO — 27 ago 2026 · CORR-29, CORR-30, CORR-31. Three rows of the table above are behind the tree: the search index SHIPPED.**
>
> - **`src/ui/shared/RuleSearch.tsx` is not uncommitted — it landed**, in `38181de` (*"The empty search field stops being a sentence and becomes an index"*), merged as `f0af890`, PR #51. On `main`: `interface Belonging` `:1146`, `export type Browse = { chapter: SrdChapter } | { kind: SrdKind }` `:1170`, `browse?: Browse | null` `:1312`, `const browsing = moment !== null || browse !== null` `:1395`, `browsedRecords` `:1447`. **The "85 green untouched" half is still true verbatim**: `git diff --stat 14c995a..main -- tests/gm/ruleSearch.test.tsx` is empty and all 85 pass. (`CORR-29`)
> - **`Search.tsx`'s body is written and shipped**, exactly to the shape §5 draws — **plus one control §5's tree does not contain**: the sticky SHUT band, `Search.tsx:521‑566` (`HAZ-54`, `CORR-32`). (`CORR-30`)
> - **`tests/ui/searchScreen.test.tsx` is written.** Eight of §5's nine guards are covered there; guard 8 is half-covered. (`CORR-31`)
>
> **§5 stays.** It is the record of a decision — the five chapters, the licence argument, where the table lives — and none of that is disturbed by the code having landed. What must not survive is the reading that Lane S has this left to build. Read on with `HAZ-54` … `HAZ-58` and `HAZ-64` beside it.

### The chapter table — recomputed this session from `data/srd-1.0.json`, and it is **five** chapters, not six

**The brief's six-chapter derivation is dead and must be struck wherever it is still written.** `THE BASICS 4` is `INTRODUCTION 4` (`the-basics` is one of the four rows *inside* the chapter, not the chapter); `ADVERSARIES AND ENVIRONMENTS 6` and `ADDITIONAL GM GUIDANCE 12` dissolve into `RUNNING AN ADVENTURE`, which goes 17 → 35. Verified independently two ways: `shared/parsers/rules.ts:171` carries `{ start: 'ADVERSARIES AND ENVIRONMENTS', drop: true }` — a *sub*head, at the same typographic rank as `GM GUIDANCE` and `EQUIPMENT` — while `ADDITIONAL GM GUIDANCE` (`:196`) is a **section**, and three real chapter openers (`INTRODUCTION`, `CHARACTER CREATION`, `CORE MATERIALS`) are not drops at all. And the partition below reproduces the shipped `SECTION_CHAPTER` exactly by computing "the last opener at or before `sourcePage`" over the five folios `{3, 4, 7, 35, 63}`.

Counts recomputed from the shipped dataset (`schemaVersion 5`, `revision srd-1.0-2025-09-09`): **849 records** across 14 kinds — domains 9, domainCards 189, classes 9, subclasses 18, beastforms 22, ancestries 18, communities 9, weapons 204, armors 34, loot 60, consumables 60, adversaries 129, environments 19, rules 69. Section bodies total **100,165** characters.

**INTRODUCTION — 4 sections, 4,476 chars, 4.5%** (folio 3)
`introduction` · `the-basics` · `the-golden-rule` · `rulings-over-rules`

**CHARACTER CREATION — 1 section, 10,879 chars, 10.9%** (folios 4–6)
`character-creation`

**CORE MATERIALS — 5 sections, 5,407 chars, 5.4%** (folios 7–34)
`beastform-options` p12 · `ranger-companion` p18 · `working-with-your-companion` p18 · `companion-taking-damage` p18 · `leveling-up-your-companion` p18

**CORE MECHANICS — 24 sections, 38,053 chars, 38.0%** (folios 35–62)
`flow-of-the-game` · `player-principles-and-best-practices` · `core-gameplay-loop` · `the-spotlight` · `turn-order-and-action-economy` · `making-moves-and-taking-action` · `gm-moves-and-adversary-actions` · `adversary-actions` · `special-rolls` · `group-action-rolls` · `tag-team-rolls` · `advantage-and-disadvantage` · `hope-and-fear` · `combat` · `stress` · `attacking` · `maps-range-and-movement` · `conditions` · `downtime` · `death` · `additional-rules` · `leveling-up` · `multiclassing` · **`gold` p62**

**RUNNING AN ADVENTURE — 35 sections, 41,350 chars, 41.3%** (folios 63–118)
`running-an-adventure` · `gm-guidance` · `gm-principles` · `gm-practices` · `pitfalls-to-avoid` · `core-gm-mechanics` · `guidance-on-action-rolls` · `making-gm-moves` · `using-fear` · `difficulty-benchmarks` · `giving-advantage-and-disadvantage` · `adversary-action-rolls` · `countdowns` · `giving-out-gold-equipment-and-loot` · `running-gm-npcs` · `npc-feature-examples` · `optional-gm-mechanics` · `using-adversaries` · `example-adversary-features` · `building-balanced-encounters` · `adversary-stat-block-benchmarks` · **`using-environments` p102** · **`adapting-environments` p102** · `additional-gm-guidance` · `story-beats` · `preparing-combat-encounters` · `battles-and-narrative` · `session-rewards` · `crafting-scenes` · `engaging-your-players` · `phased-battles` · `using-downtime` · `projects-during-downtime` · `extended-downtime` · `campaign-frames`

4 + 1 + 5 + 24 + 35 = **69**, every section in exactly one chapter, no exclusion list and none possible.

**Two shapes that will look like bugs and are the book's:** CHARACTER CREATION opens onto a single row, and that row is the **longest section in the SRD** (10,879 chars — a count is not a weight). RUNNING AN ADVENTURE is 35 rows against CORE MECHANICS' 24 but only 41.3% of the prose against 38.0% — the two big chapters are near-equal by weight. Both are already written into `chapters.ts`'s docblock; do not re-derive them.

### Where it lives — settled, shipped, do not reopen

`src/ui/shared/chapters.ts`, beside `moments.ts`, in `moments.ts`'s shape. Its docblock already carries the whole argument, including the honest note that `moments.ts`'s *"no parser can produce it"* argument does **not** transfer (a chapter is in the PDF; a moment is this app's judgement), and the three grounds the field is refused on instead: the `build:srd --check` gate is **skipped in every CI run** (`.gitignore` ignores `*.pdf` and `Manuali`, so no runner has the PDF — MEMORY: CI non verifica il dataset); a homebrew layer cannot answer which chapter a section it invented is printed in; and the blast radius runs through `shared/types.ts`, `shared/parsers/rules.ts` and `data/srd-1.0.json` for a grouping one screen reads. `data/chapters.json` is refused for `moments.ts`'s own reason, made worse here by the skipped gate.

### The licence question: **YES — naming the five chapters in `src/` is inside the rule.**

The rule `srdIndex.ts` states is narrow and testable: **a label is never in the haystack**, and no preview line may quote one. It governs the search corpus and the quotable text, not every string under `src/`. The app already addresses the book by its own words in three shipped places (`stamp()` prints `SRD 1.0 · P.35`; `SRD_KIND_LABELS` prints the book's names for its collections; `moments.ts` is keyed on the book's own slugs).

The measurable form of the claim, and it is the strongest evidence: **four of the five chapter names are already typed in this repository, verbatim.** Verified — `shared/parsers/rules.ts` carries `'INTRODUCTION'` (`:59`, `:142`), `'CHARACTER CREATION'` (`:64`), `'CORE MECHANICS'` (`:90`) and `'RUNNING AN ADVENTURE'` (`:141`) as `start:` strings, beside all sixty-nine section titles it types by hand. This module adds exactly **one** heading the repo did not already carry: **`CORE MATERIALS`, fourteen characters.** Five headings, seventy-eight characters, **zero sentences**, against 100,165 characters of section prose that live only in `data/`.

The `AskEntry.at.part` precedent is the real objection and it is answered rather than waved (MEMORY: the ask pointer is an index). `at.part` is an integer because *there was an integer to be had* — the part exists inside the section and can be addressed by position. There is no chapter number to point at, because the dataset carries no chapter at all. That left three options and two die on the data: **naming a chapter after its first section** is right for three of five and wrong for two (`CORE MATERIALS` would be called "Beastform Options", `CORE MECHANICS` "Flow of the Game" — a rule right three times in five is not a rule), and **inventing the app's own name** is worse on the licence's own terms, because it is the app *renaming* the book on a surface where every row beside it carries an `SRD 1.0 · P.n` stamp a reader can check. A false claim about the source is a worse honesty failure than a true one.

**And it is held by a guard rather than an intention.** `tests/ui/chapters.test.ts` already asserts (a) that no value of `CHAPTER_LABELS` occurs in any `srdIndex` haystack — the same one-line loop `srdIndex.test.ts` runs over field labels — and (b) that no string literal longer than 40 characters in the modules that draw the index is a substring of any section `body`. Five strings enter `src/`; not one can be searched, and not one can be quoted back to a reader as the book's own words.

### The component tree — what Lane S still has to build

```
Search()                                       src/ui/search/Search.tsx
├─ query === ''  →  the index
│   ├─ <span class="t-label">EVERYTHING THE APP SHIPS · 849</span>   (count from srdIndex, never typed)
│   ├─ one-line <p class="t-body">Search by name or by any words in the text.</p>
│   ├─ <KindGrid>          local, NOT exported — repeat(3, 1fr), 5 rows, 14 cells
│   │     each: <button aria-expanded aria-controls>  .t-label name over .t-meta count
│   ├─ lit kind !== 'rules'  →  <RuleSearchResults browse={{ kind }} …>   BELOW the whole grid
│   └─ lit kind === 'rules'  →  <ChapterRows>   local, NOT exported — 5 full-width rows
│         └─ lit chapter     →  <RuleSearchResults browse={{ chapter }} …>  IN PLACE, under its row
└─ query !== ''  →  <RuleSearchResults query …>          (unchanged)
```

Three ranks drawn three ways so a reader knows which one they are on without reading a word. A lit kind draws **below the whole grid** (`ShowSheet`'s shipped moment-chip behaviour, reused rather than re-decided, so the grid never reflows and stays a map you can re-aim at); a lit chapter draws **in place** under its own row, because a one-column list takes an in-place insert for free. `aria-expanded`, not `aria-pressed` — this component draws the content itself, which is what `Hit`, `RecordHit` and `AskRow` already do. Typing clears the lit block and the lit chapter; CLEAR returns to the index with nothing lit. **Exclusive by construction**, which is the owner's 27‑August decision (MEMORY: the search is global) held from the other side.

**Both components are local and must not be exported**: `tests/ui/screens.test.tsx` derives its fixture list from what `src/ui` exports, so a second exported component would owe it a fixture, and neither of these is a screen.

**The DOM-id hazard** `chapters.ts` names must be honoured: three chapter slugs (`introduction`, `character-creation`, `running-an-adventure`) are **also section ids** and `Ref` is `string`, so `id={`chapter-${chapter}`}` is required or a test can count a chapter row as the `introduction` section row inside it and call it proof.

**Sizing** (all derived from constants this repo measured, all on C1's rig list — `.t-label` is `600 10px/1 var(--mono)` at `0.16em`; `ShowSheet` measured 6.0px of glyph per character, so 7.6px with tracking; columns 369.00 / 351.00): cells `(369−16)/3 = 117.67` and `(351−16)/3 = 111.67`; longest labels `DOMAIN CARDS`/`ENVIRONMENTS` at 12 chars = 91.20 of text, 101.20 with padding and borders, inside the tighter cell by 10.47 — **so this grid does not spend the half-tracking lever `ShowSheet` spent, and `ShowSheet`'s open question about 10px mono at 0.08em at arm's length is not reopened.** Two 10px lines with a 4px gap and 8px padding is 32, so the **44px floor binds**: a cell is 117.67 × 44 / 111.67 × 44 and the grid whole is 5×44 + 4×8 = **252.00**. Band + sentence + gaps + grid = **312.00** against reading windows of 527.00 and 342.00 — fits by 215 at 393×852 and **by 30 at 375×667**. **First lever if Chrome disagrees: delete the lead sentence, which returns 32; the band alone still says what the screen is.** Named now so it is a decision already taken rather than one invented under pressure.

**The one unsettled ergonomic, named rather than hidden: WEAPONS opens onto 204 rows** — ≈9,000px, about seventeen screens at 393×852. Defensible by precedent (`AdversaryList` is a 129-row scroll used as both the bestiary's index and the encounter picker) and by the pinned field at the foot of the screen being a thumb-arc escape. What must be measured is the **return**: whether `scrollTop = 0` gets a thumb back to the grid in one flick. **Pre-agreed remedy if it does not:** the band over the open list becomes `position: sticky; top: 0`, carrying the label, the count and the shut affordance.

> **CORRETTO — 27 ago 2026 · CORR-32.** The row count is right — **204 weapons** — but the pixel figure is roughly **half** the real one, and this ergonomic is **no longer unsettled**. Measurement forced the remedy: it **shipped**, as a *control* rather than a label, and `top: 0` was found **wrong by looking**. It is guarded at `tests/ui/searchScreen.test.tsx:424`, *"opens a kind onto its records, under a sticky row that shuts it again"*, and the file writes down why a sticky child sticks against its scroller's padding (`Search.tsx:197‑209`). Read this paragraph as the record of a decision taken; do not re-derive the ≈9,000px, and do not treat the return as a measurement still owed.

### The guards Lane S still owes (`tests/ui/searchScreen.test.tsx`)

1. The empty field draws **14 blocks**, one per `SRD_KIND`, each carrying its kind's own count **read off `srdIndex(dataset)`** and never typed beside the assertion — so a homebrew layer is followed here too.
2. Every block and every chapter row is on the 44px floor (`style.minHeight === '44px'`), the assertion this file already makes about the field.
3. RULES opens onto exactly 5 chapter rows carrying **4 / 1 / 5 / 24 / 35**, read from `SECTION_CHAPTER` rather than typed; a chapter row opens onto exactly `sectionsInChapter(...).length` section rows, in the dataset's order.
4. Exclusivity in both directions: typing with a block lit clears it and draws results; CLEAR returns to the index with nothing lit.
5. One open at a time, at every rank — two blocks can never be `aria-expanded="true"` together, nor two chapters.
6. A chapter row and the `introduction` **section** row are distinguishable on the namespaced DOM id.
7. **The honest-silence paragraph never appears under a browse, at any rank.** This is the regression this design most easily causes: the sentence *"Nothing in this dataset carries that. …it asks for every word you typed, and not one of those words is in the book"* over a list nobody typed for. Its guard is already `!browsing` in the working tree (`RuleSearch.tsx:1591`) — the test is what keeps it there.
8. A homebrew layer that adds a rules section is searchable but appears in **no** chapter breakdown, and the screen says nothing false about it. This is the property that pays for keeping the table out of the dataset.
9. `tests/gm/ruleSearch.test.tsx` and `tests/gm/moments.test.ts` pass **untouched**.

**One loose end in the working tree to resolve before the lane commits:** `RuleSearch.tsx:1641` still reads `{moment !== null && askedBand}` where `:1599` reads `{!browsing && askedBand}`. It is harmless today (`asked` is `[]` under a chapter or kind browse), but it is the last `moment === null`-shaped guard left, and the `moment`/`browse` redundancy is already labelled a stated debt in the same file. Either make it `browsing` or write down in that comment why it stays `moment`.

---

## 6. Tests

**The two guards this repo insists on, stated once and applying to everything below.** (a) **No test may assert against a literal it also filtered by** — every count comes from the dataset or from `SECTION_CHAPTER`/`srdIndex` first, never typed beside the expectation. (b) **A mutant must be addressed, not hidden** — when a proof runs against an isolated copy, `rsync` the tree, symlink `node_modules`/`.tools`/`Manuali`, and grep the mutant **before and after** each run (MEMORY: mutation proofs go in an isolated copy). And: a deleted line that carried two behaviours needs two mutants, and a proof that starts from a clean panel is not a proof (MEMORY: split mutants, and test the second action).

### New tests required

**The regression that is the deliverable**

1. **The owner's repro, as one test.** Two normally-created scene rows (Foresta, Pub); `showScene('foresta')`; spawn an adversary into it and mark HP. Render Pub's arm: assert its primary verb is present, **enabled**, and opens **Pub**; press it; assert `openScene === 'pub'`, `openCombatants(getState())` is empty, and Foresta's row still holds its adversaries with `hp.marked` intact. **This test fails on `main` and is the proof the fix landed.** (`tests/gm/sessionList.test.tsx`)

**Isolation and addressing**

2. `spawn(sceneId, …)` writes only that row; a second row already holding `acid-burrower-0` comes back deep-equal.
3. `patchCombatant`/`removeCombatant` reach only the named row, with the **same combatant id present in both rows** — the id-collision property that keeps `openScene` non-derivable and `Scene.tsx`'s composite card key necessary.
4. Two fights standing at once: mark HP in A, `showScene(B)`, `showScene(A)` — A's marks are exactly as left and B's are untouched.
5. `showScene` moves nothing: both rows' objects are **`toBe`-identical** before and after a flip, in both directions. One test replaces the three deep-copy tests `runScene` needed.
6. `showScene` refuses an id that is not a scene row (a countdown row, an `unreadable` row, an unknown id) and refuses the row already open.
7. `spawn` with an id that names no scene row commits nothing — it does not mint.
8. `openNewScene()` mints exactly one row, appends it in order, opens it, and returns its id.
9. `clearScene(id)` empties only that row, **keeps `openScene`**, and leaves Fear, the countdowns, the environment and every other row's fight standing.
10. `removeSessionItem` on the open row takes its fight with it and nulls `openScene`; on another row it does not touch the pointer, and a clock scoped to the deleted row becomes the campaign's in the same commit.
11. `patchSessionItem` **cannot** write `combatants` — mirrors the shipped "will not turn one kind of row into another by patching it".
12. **Selector stability (the zustand trap, held by a test):** `openCombatants` returns the **identical array** across a commit that touches neither `session` nor `openScene` (e.g. `nudgeFear`), and a **different** array after `patchCombatant`. With `openScene === null` it returns the same `NO_FIGHT` object twice.
13. **Row identity (what A4's memo rests on):** after `patchCombatant(sceneA, …)`, every other row object in `session` is `toBe`-identical to what it was.
14. Reload: two rows with two fights and a pointer come back with both fights and the same pointer.
15. `.dhcampaign` round trip with two scene rows each holding its own fight, and `board.openScene`.

**The converter, against frozen bytes**

16. Branch (1), `v4.campaign.json`: the two board keys go, `openScene` is `'item-scene-1'`, nothing else moves, nothing is minted.
17. Branch (2), `v4.parked.campaign.json`: the fight lands on `item-scene-1` with every mark (`hp.marked`, `stress.marked`, `thresholds`, `spotlighted`, `minionsRemaining`) intact, `board.combatants` absent, `openScene` names it.
18. Branch (3), `v4.orphan.campaign.json`: exactly one row minted with id `board-fight-v4`, carrying the fight and the board's `environmentRef`, `openScene` naming it — **and a hand-built case where `liveScene` names a scene row that already holds a fight, which must also mint and must NOT merge.**
19. Determinism and idempotence-in-effect: the converter run twice on one v4 record produces byte-identical output; a record already holding `board-fight-v4` gets `board-fight-v4-2`.
20. `applyChain(readFixture(4), 4, 5, CAMPAIGN_MIGRATIONS).record` deep-equals `readFixture(5)` minus the stamp — the converter and the fixture pinning each other.
21. The rewritten v1 byte-for-byte walk, **hand-written including the `JSON.stringify` key-order half**.
22. `checkReadable(5, 4, 1)` throws with the update-the-app sentence; a v4 `.dhcampaign` whose checksum was computed over the v4 payload still verifies after the chain runs.

**The reader**

23. Two rows with one id → the later is re-id'd, warned, and a countdown scoped to that id still resolves to the first.
24. Two combatants with one id in one row → re-id'd, both bodies and all four marks kept, warned once.
25. `openScene` naming a missing row, a countdown row and an `unreadable` row → `null`, **silently**, with `warnings` unchanged.
26. `campaignFromLegacy`: a `dhc.gm.v1` blob carrying combatants comes back as **one** scene row holding them with `openScene` naming it. (This is what replaces the stale "an unnamed field is a compile error" comment that the `Record<string, unknown>` return type has never made true.)

**The glass**

27. `SceneArm` draws exactly **one** primary verb in all three states, and it always targets `item.id`.
28. **Absence test:** no scene or encounter arm, in any state reachable from two rows and one fight, renders the words *"the board is running another scene"*.
29. `SceneSwitcher`: two rows holding fights draw two chips, plus a third for an open-but-empty row; tapping a chip changes only the pointer and no combatant.
30. The runner's band shows the **open row's** environment, and editing that row's `<select>` in the plan changes the band.
31. Bestiary with nothing open: the button reads `ADD TO A NEW SCENE`, one tap mints exactly one row, opens it, and puts the adversary in it.
32. `makeCombatant` does not alias the adversary's `thresholds` tuple (lane A1).

### Existing tests that must change, by file

| file | its | what happens |
|---|---|---|
| `tests/gm/gmStore.test.ts` | 67 | The three fight describes are **22 its**: `running a scene` (`:856`) is **15**, `ending a scene, once a fight can be parked` (`:1135`) is **3**, `deleting a row a fight came from` (`:1194`) is **4**. Roughly **14 are deleted outright** — both `adoptBoard` cases, every park/resume deep-copy case, both mint cases, both environment-carry cases, the "pointer names a non-scene row" case, the homeless-fight cases — because those states cease to exist. The rest are rewritten with inverted expectations. `the fight survives a reload` (`:177`) reads the row instead of the board. **The file should end up smaller.** |
| `tests/gm/sessionList.test.tsx` | 91 | `the scene arm` (`:330`) is 22 its, of which `the fight it is holding` (`:488`) is 12. Delete the `TAKE THE FIGHT ON THE BOARD` cases, the `OPEN THE SCENE` demotion cases and the claim-an-empty-board case; rewrite the verb-chain cases to three branches; rewrite every Fact string this file pins; add tests 1, 27, 28. **Re-run the whole-screen 44px sweep (`:1258`) and re-read `floorsOutsideTheSweep` (`:1302`)** — two controls leave the screen, so its exact list may change and must not be assumed. |
| `tests/store/campaignSchema.test.ts` | 76 | `versions()` gains 5. `carries one converter per bump… and none of them is a repair` (`:891`): `[1,2,3]` → `[1,2,3,4]`, `toBe(4)` → `toBe(5)`, **and the title rewritten** — three of four are empty because none of those bumps deleted a field. The v1 byte-for-byte walk (`:899`) hand-rewritten. `opens the schema 4 record with both of its pointers standing` (`:210`) rewritten for `openScene`. The `emptyBoard()` block (`:628-660`) reshaped, and `lets the fight belong to no row when its row is gone` (`:645`) becomes *"nulls a navigation pointer in silence"* with `warnings` empty. **`expect(campaign.board.environmentRef).toBe('raging-river')` at `:192` stays green untouched** — that is what keeping the field buys. Add tests 16–21, 23–25. |
| `tests/gm/sceneTruth.test.tsx` (43), `sceneConfirmation` (8), `sceneDamage` (8) | 59 | Setup helper rewritten **once each** to seed a scene row + `openScene`; the assertions do not move. `patchCombatant`/`clearScene` call sites gain the row id. |
| `tests/gm/sceneSwitcher.test.tsx` (11), `sceneClocks.test.tsx` (11) | 22 | Helper renames, `runScene` → `showScene`, `Run X` → `Open X` in the accessible name. `sceneClocks`' assertions that clocks follow the scene and that **nothing ticks on a flip** hold unchanged and are load-bearing evidence the flip stayed cheap. Add test 29. |
| `tests/gm/session.test.ts` (34) | | The `describeItem` term tests: `PARKED` → `IN THE FIGHT`, `ON THE TABLE` → `{n} ON THE TABLE`, and the two-segment rule pinned. (Lane A4 already changed its 5th argument.) |
| `tests/store/campaignFile.test.ts` (22) | | `board.liveScene` → `board.openScene` at `:185-192`; add test 15. `OLDEST_READABLE_CAMPAIGN toBe(1)` stays green untouched — cite it as the reason 1 does not move. |
| `tests/store/campaignMigration.test.ts` (21) | | Add test 26; the legacy board literal follows `LEGACY_BLOB_SCHEMA`. |
| `tests/gm/minionGroups` (17), `names` (16), `sendCarry` (10) | | `spawn` call sites gain the row id; `names` seeds via a scene row and gains a case for the cross-row name pool. `sendCarry`'s *"does not empty the board of its environment on the way"* is rewritten as *"sends into the open scene and leaves the builder's place standing"*. |
| `countdownArm` (21), `restControl` (26), `merchant` (26), `reference` (52), `ruleSearch` (85), `partySizeDisagreement` (13), `fearOnTheGlass` (6), `encounterBump` (4), `gmScreen` (74), `tests/ui/screens.test.tsx` (9) | | **One or two seed lines each**: `liveScene: null` → `openScene: null`, and `combatants: []` in a `setState` seed becomes a compile error to be replaced with A2's `sceneWith`. `screens.test.tsx:702` seeds `liveScene: 's1'` with a scene item and needs the fight moved onto the row. `encounterBump` also loses the `OPEN THE FIGHT` guard assertion. |
| `tests/fixtures/factories.ts` | | The board literal drops `combatants`/`liveScene` and gains `openScene` (`:252` is the `NO_FIGHT` block; leave it, it is the row's shape and stays correct). |

> **CORRETTO — 27 ago 2026 · CORR-25, CORR-26, CORR-12. Three cells of the table above.**
>
> - **`tests/gm/sceneTruth.test.tsx` is 42 its, not 43.** The plan's `\bit(` grep counts the prose mention at `sceneTruth.test.tsx:20` (`HAZ-46`). (`CORR-25`)
> - The `sceneTruth` / `sceneConfirmation` / `sceneDamage` row therefore totals **58**, not 59. (`CORR-26`)
> - **`tests/fixtures/factories.ts` has no board literal.** `grep -n 'board:' tests/fixtures/factories.ts` exits 1 — the file declares no `board` key. Use that narrow form and not the wider `grep -in "board"`, which A2's rewrite of this file turned into a false witness: at `ab66cf2` it exits **0**, on the prose word in the new docblock at `:342`. The board literal is `emptyBoard()` at **`shared/campaigns.ts:670‑678`**, a file Wave B already owns exclusively; its other references are `gmStore.ts:40`/`:326`, `gmScreen.test.tsx:335` and `campaignSchema.test.ts:48`/`:244`/`:628`. **The work is covered; the row points at the wrong file.** The parenthesis is still right — `NO_FIGHT` is the row's shape and stays correct — except that A2 moved it to **`:251`**, and it collides in *name* with the constant §1 introduces (`HAZ-02`, and the fifth entry of §3.5). (`CORR-12`)

**Do the 12 seeds through A2's helper, never by hand.** Twelve hand-rewritten seeds is twelve chances to seed a state the store can no longer reach.

> **CORRETTO — 27 ago 2026 · CORR-24 (ripreso).** *"the 12 seeds"* is **29 seeds across 17 files** — the full count and the file list are at the marker on §0's axis-2 row. The sentence's own logic is what condemns the number: twelve hand-rewritten seeds is twelve chances to seed a state the store can no longer reach, and **seventeen seeds left unconverted is worse than any of them** — they are precisely the ones a one-line grep does not show you.

**Rough shape:** ~25 files touched, ~13 of them one-line renames; three files carry the real work and two of them should end up **smaller**. Expect ~20 `it()` deleted against ~32 added. That the suite barely grows for a change this size is the honest measure of B being a simplification — you are removing states, and states are what tests cost.

**The test that must not be weakened:** `missingConverters(CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_SCHEMA_VERSION + 1, …)` (`campaignSchema.test.ts:112‑120`) — *"would fail on a bump that shipped without its converter"*. It keeps its teeth for free.

---

## 7. What is NOT in scope

- **The board's roster, adjustments and party tier stay on the board**, mediated by the same four crossing verbs. The answer to "is this parallel or a rename?" is: **the fight and the place are parallel; the workbench is not.** A builder is not a table. `PUT THIS ROSTER ON THE BOARD` and `KEEP THE BOARD'S ROSTER HERE` are the two verbs that make the plan editable at all, and they are untouched.
- **`GmBoard.environmentRef` is not deleted**, and neither is `setEnvironment`. The board keeps the builder's place; the runner reads the row's. Deleting the field is a second, separate change with its own converter clause, its own fixture churn and its own UI redesign, and three of four judges called doing it here fatal.
- **Two tabs on one campaign.** `gather` has always written the whole record, so a stale tab's flush has been able to overwrite another tab's session rows since schema 3. The record has always been the unit of loss; parking only changed how often a fight sat in it. Accepted and unmitigated — the fix is a per-record write clock and is a feature of its own. (This also corrects `PIANO-SCENE-PARALLELE-2026-08-26.md` §4.13, which calls it *«una classe di perdita che prima non c'era»*.)
- **Undo.** Deleting a row now destroys its fight — the one place this model is strictly worse than today, where the orphaned board kept the marks by accident. It is paid for by the armed DELETE already in place and by the arm and the shut row both naming what is inside before the first tap. This plan does not invent an undo.
- **The archive.** Nothing in `src/` writes `Campaign.archive` — verified by grep — so this costs zero today. Only the constraint is written down (lane C2).
- **`OLDEST_READABLE_CAMPAIGN`, `DB_VERSION`, `shared/types.ts`'s `SCHEMA_VERSION`, `data/srd-1.0.json`, `shared/parsers/**`, and `.github/workflows/ci.yml`** — none of them moves.
- **The `encounter` arm.** Legacy, readable, editable, uncreatable, and it stays exactly that. No converter rewrites an `encounter` row into a `scene` row.
- **The `moment`/`browse` fold in `RuleSearch.tsx`.** Two props that both mean "no query, assemble a list". Folding them is the right end state and is deliberately a **later pass, on its own, with `ShowSheet` in front of it** — the working tree already labels it a stated debt. Doing it here would put the risk of this change on a path that is shipped and working, to save a prop.
- **Curating the search index.** The index lists and does not choose: 14 blocks in the dataset's own order under the dataset's own labels, 849 records, 69 sections. The moment anybody reorders the fourteen, promotes a kind, or hides a chapter, it has become the third reference screen and should be reverted instead.

- **The switcher's chip-label problem** — two unnamed scenes both reading `SCENE`, and `The Dungeon` / `The Dungeon Below` both truncating to seven characters at four chips. `SceneSwitcher.tsx` declines to solve it and this plan does not pretend to either; it only makes it more frequent, which is named as a risk and not as a fix.

> **CORRETTO — 27 ago 2026 · CORR-34 — on §7's penultimate bullet, *"Curating the search index"*.** *"in the dataset's own order under the dataset's own labels"* is not what shipped. **Thirteen of the fourteen are in dataset order; `rules` is moved from position 15 to position 1** and is separately given rank 1. So that bullet's tripwire — *"the moment anybody reorders the fourteen, promotes a kind, or hides a chapter, it has become the third reference screen and should be reverted instead"* — **was already tripped by shipped code before the guard was written.**
>
> It is a scope guard and not a build instruction, so nobody writes wrong code from it; but **as a revert trigger it is unusable as stated**, and the first person to read it literally reverts the index. **Left open**, because the verification did not settle it: whether promoting `rules` was the right call, only that it happened. Restate the tripwire against what shipped — or state that `rules` first is the one deliberate exception and that everything else is the dataset's order.
