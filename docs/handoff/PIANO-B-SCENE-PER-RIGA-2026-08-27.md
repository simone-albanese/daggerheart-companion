<!--
  Produced 2026-08-27 by a 10-agent design workflow (4 independent designs, a
  4-lens judge panel, one synthesis). Run `wf_03f9674c-648`.

  IT IS A PLAN AND NOT A RECORD. Nothing in it has been executed. Its file:line
  citations were true against `14c995a` and this tree edits fast — check every
  one before building on it. Where it corrects the session brief or this repo's
  own documents, those corrections were themselves verified.
-->

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

> **A converter may MOVE. It may not INVENT and it may not REINTERPRET.**

Three tests separate a move from a repair, and this entry passes all three:

1. **Could the reader supply it?** For every previous bump, yes — which is *why* those converters had nothing to do, and the `from: 2` entry says so at length: the readers supply every default on the way in, so seeding one in a converter puts it in two places. Here the answer is **no**. `readSessionItem` supplies `combatants: []` for a scene row that has none, and for a v4 record whose fight is sitting in `board.combatants` that default is *wrong*. What this converter supplies is **data**, not a default; `[]` stays the reader's and stays the reader's alone.
2. **Does it decide what the record means?** No. The `encounter` arm's rule (`shared/campaigns.ts:376‑386`) is that a converter must not "change the kind of a thing the GM named", because "the next migration that wants to rewrite somebody's data will cite this one". This changes no kind, no name, no id, no count and no mark. `board.combatants` and a scene row's `combatants` are the same type, written by the same writers, read by the same `readCombatants`, and `runScene` has been copying between them verbatim since schema 3. The converter performs exactly the park `runScene` would have performed.
3. **Is there anywhere else it could be done?** No — and this is the clause the old rule never needed. **No previous bump deleted a field.** A key that goes away has exactly one place its contents can cross, and that place is the chain. Doing it in `readCampaignRecord` instead would mean the reader keeps naming `board['combatants']` for ever — the field would be *hidden*, not deleted, the whole simplification undone — and the rescue would re-run on every read of a v4 record rather than once.

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

### `.dhcampaign` and the legacy localStorage path

Nothing in `src/transfer/campaignFile.ts` changes; the window is the record schema's window and moves with it. A v4 file opened by a v5 build verifies its checksum against the payload **as it arrived**, before the chain runs, so the converter cannot make an honest old file look damaged. A v5 file handed to a v4 build throws `SchemaError` wrapped as `ImportError`. `tests/fixtures/schema/v1.dhcampaign` is **untouched** and must not be regenerated; it still walks 1 → 5.

`src/store/campaignMigration.ts` — **take Judge 2's graft and do NOT write a second mint there.** Verified: `campaignFromLegacy` returns `Record<string, unknown>` (`campaignMigration.ts:182‑186`), so its board literal is **not** checked against `GmBoard` and its comment at `campaignMigration.ts:216‑219` claiming "an unnamed field is a compile error, not a default" is already stale prose. Instead:

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

### The byte-for-byte test is no longer trivially true — this is the single most likely place to get it wrong

`campaignSchema.test.ts:899‑923` asserts both `toEqual` and `JSON.stringify` equality of a v1 record walked forward against `{ ...fixture, schemaVersion: CAMPAIGN_SCHEMA_VERSION }`. For the first time the chain's output differs from its input, so the expectation must be **hand-written key by key, key order included**. Verified: v1's board key order is `region, partyTier, roster, adjustments, combatants, environmentRef`, and `const { combatants, liveScene, ...rest } = board` followed by `{ ...rest, openScene }` yields exactly `region, partyTier, roster, adjustments, environmentRef, openScene`. The `JSON.stringify` half is what protects the `.dhcampaign` checksum from a converter that reorders keys; do not drop it, and do not regenerate the expectation from the code.

Also rewrite the title of `campaignSchema.test.ts:891` — *"carries one converter per bump, in order, and none of them is a repair"* — which becomes a lie even though all three of its assertions stay green.

---

## 3. The lanes

**Rules.** Within a wave, lanes are disjoint and may run concurrently. Across waves they are strictly sequential. **No two concurrent lanes write the same file.** Cut every worktree from **local `main` (`e25db1f`)** yourself — not from `origin` — and ignore `node_modules` *without* the trailing slash (MEMORY: worktree lanes, two traps). Run the suite on the repo's own Node 24 (`. ./env.sh`) before pushing; Node 26 hides `localStorage` from jsdom and a green local run is weaker than CI's. `build:srd --check` is a local-only gate and is **skipped in every CI run** — nothing here may lean on it.

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

**Must not touch:** `src/ui/search/**`, `src/ui/shared/**` (Lane S), `src/engine/encounter.ts` (A1 already did it), `.github/**`, `data/**`, `shared/parsers/**`.

**Depends on:** A1, A2, A3, A4 all merged to `main` first. Rebase onto them before starting.

**Internal order — steps, not lanes. Do them in this sequence:**

1. **B1** `shared/campaigns.ts`: the constant, the fourth converter and its two helpers, the header rewrite, `GmBoard`, `emptyBoard`, `combatantsIn`/`environmentIn`, `liveScenes`' parameter, the reader's board literal and the `openScene` repair, the deleted warning.
2. **B2** `tests/fixtures/schema/*.json` + `tests/store/campaignSchema.test.ts` + `tests/store/campaignFile.test.ts` + `tests/store/campaignMigration.test.ts`. **The converter and its tests are green before a single line of store code is written** — this is the one place in the change that can lose a GM's live fight with no undo.
3. **B3** `src/ui/gm/gmStore.ts`: `GmLive`, `spread`/`gather`, `openCombatants`/`openEnvironment`, `withSceneFight`, the four re-signed actions, `showScene`, `openNewScene`, `patchSessionItem`'s strip, `removeSessionItem`'s clause; delete `runScene` and `adoptBoard`.
4. **B4** `src/store/campaignMigration.ts` (`LEGACY_BLOB_SCHEMA`, the stale comment deleted). **Corrected 2026-08-31, during B4's repair pass: on `wave-b` this step is VERIFY-ONLY, because its code landed one step early, in B2's commit `0f74ed0`.** The plan puts test 26 in `tests/store/campaignMigration.test.ts` — a file step 2 above owns, and which must be *green before a single line of store code is written* — while putting the line that test needs here, two steps later. B2 could not be green without pulling it forward, so it did: `git show 0f74ed0 -- src/store/campaignMigration.ts` holds the whole change (the `CAMPAIGN_SCHEMA_VERSION` import dropped, `const LEGACY_BLOB_SCHEMA = 4;` declared, the board literal restamped, the "an unnamed field is a compile error" comment deleted), and `git diff -U0 d4ca5bd^ d4ca5bd -- src/store/campaignMigration.ts` — B4's own commit — returns no changed line outside a comment. Pulling it forward was the correct call and not a skipped step. Leaving the line here opens a two-step window in which B1 has already set `CAMPAIGN_SCHEMA_VERSION = 5` while this file still stamps its legacy blob with it: the blob is minted already labelled 5, `applyChain` walks 5 → 5 and runs no converter, the v5 board reader names six keys and `combatants` is not one of them, and `migrateLegacyGmState` then compares what came BACK against what it BUILT (`stable(readBack) !== stable(built)`) — never against what the blob HELD — and removes `dhc.gm.v1`. That is this lane's one unrecoverable loss, arriving through the step order rather than through any line of code. **So do not gate this step on a behaviour-changing commit, and do not re-do the work.** What B4 owes is the reading — the constant is 4, `combatants` and `liveScene` are still in the literal, no second mint, no mirror field, no `combatants?` — and the mutants that say which of those the suite actually holds.
5. **B5** the readers of the store — `Scene.tsx`, `GmTopBar.tsx`, `Countdowns.tsx`, `SceneSwitcher.tsx`, `Names.tsx`, `Bestiary.tsx`, `Encounter.tsx`, `StatBlock.tsx`, `session.ts`, `SessionRow.tsx`. `npx tsc --noEmit` is your worklist; it enumerates every one of them.
6. **B6** `src/ui/gm/SessionBody.tsx` — the verb chain, the Facts, the file header (§4).
7. **B7** the 25 test files, seeds first via A2's `sceneWith`, then assertions.

**Acceptance (all must hold before the branch is offered):**

- `. ./env.sh && npx tsc --noEmit` clean and `npx vitest run` green on Node 24.
- **The owner's repro, as one test that fails on `main`** (§6, test 1).
- No source or test file anywhere in the tree contains the string `the board is running another scene` (case-insensitive).
- `grep -rn "adoptBoard\|runScene" src shared tests` returns nothing **outside the five named survivors below**.

  **Corrected 2026-08-30, during B2's repair pass.** This bullet said `grep -rn "liveScene\|adoptBoard\|runScene" src shared tests` returns nothing, and no correct execution of this plan can satisfy that — the plan itself mandates every surviving hit, so the gate as written either blocks the wave or pushes whoever runs it into deleting a line this lane exists to protect. Measured against `wave-b` at B2. The named survivors:

  1. **The `from: 4` converter's own destructure** — `shared/campaigns.ts:351,354` (`const { combatants, liveScene, ...rest } = board`), which is §5's own listing at plan line 332. Deleting it is deleting the converter.
  2. **The exported helper `liveScenes`** — `shared/campaigns.ts`, plus its import and call sites in `src/ui/gm/SceneSwitcher.tsx` and `tests/store/campaignSchema.test.ts`. Line 161 of this plan keeps its name, signature and body on purpose.
  3. **The frozen schema-4 fixtures** — `tests/fixtures/schema/v4.campaign.json`, `v4.dhcampaign`, `v4.parked.campaign.json`, `v4.orphan.campaign.json`. Lines 486 and 491 forbid regenerating them; a fixture edited to satisfy a grep proves only that the later build agrees with itself.
  4. **Live source this plan orders KEPT** — `liveScene: null` in `src/store/campaignMigration.ts`'s `LEGACY_BLOB_SCHEMA`, mandated at plan line 480 because the blob is a schema-4-shaped record by construction; and the converter's proofs, which must NAME the old field to assert its absence (`not.toHaveProperty('liveScene')` in `tests/store/campaignSchema.test.ts`, the frozen-board destructure in `tests/store/campaignBackup.test.ts`). This is the load-bearing one: `campaignMigration.ts`'s own comment records that deleting that line leaves the suite green, so the grep's wording is the only thing standing between an executor and removing it.
  5. **Prose naming a schema-4 field or verb** — the `from: 4` converter's docblock in `shared/campaigns.ts`, which argues about what the schema-4 `runScene` did; `src/store/campaignImport.ts`; the docblocks in B2's own store tests; and `src/engine/encounter.ts`, which line 545 puts on this wave's **Must not touch** list and which mentions `runScene` in a comment. A wave cannot be gated on a string it is forbidden to edit.

  Anything outside those five is a leak and the gate still catches it.

### WAVE C — follow (two lanes, concurrent, disjoint)

| lane | owns | acceptance | depends on |
|---|---|---|---|
| **C1 — Chrome** | measurement only; if a number fails, it owns the wording fix in `src/ui/gm/session.ts` **or** `src/ui/gm/SessionBody.tsx`, not both | the audit rig at 393×852 and 375×667, `pointer: coarse`, insets 47/34, **on a port that is not 5199** and against a fresh IndexedDB (MEMORY: 5199 is the owner's real campaign): SceneArm's verb strip after two verbs leave; the shut row's `12 IN THE FIGHT` and `12 ON THE TABLE` against `RAGING RIVER`; the armed footer at 349; `docOverflowX === 0.00` at both sizes; re-run the whole-screen 44px sweep and **re-read `floorsOutsideTheSweep`** (`tests/gm/sessionList.test.tsx:1302`) rather than assuming its list, because two controls leave the screen | B |
| **C2 — the archive constraint, written where it will be read** | `shared/campaigns.ts`'s `ArchivedSession.items` docblock **only** | verified: `grep -rn "archive" src --include="*.ts" --include="*.tsx"` returns **nothing** — no archive writer exists, so this costs zero today. The obligation is written down: `items` must be `session.map(i => i.kind === 'scene' ? { ...i, combatants: [] } : i)`, or the first archive writer freezes a fight mid-flight as "what happened" | B |

**Contended files, named explicitly, and how they are split:** `shared/campaigns.ts` (A3 → B → C2, sequential, never concurrent), `src/ui/gm/session.ts` and `src/ui/gm/SessionRow.tsx` (A4 → B → C1), `tests/store/campaignSchema.test.ts` (A3 → B), `src/ui/gm/SessionBody.tsx` (B → C1), `tests/gm/session.test.ts` and `tests/gm/sessionList.test.tsx` (A4 → B). Lane S shares no file with any of them.

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

**Ergonomics.** Two 44px verbs leave the strip and none arrives, so the arm returns **88px** of scrollable row content at both sizes (each verb is 44px on a line of its own by `SessionBody.tsx`'s own Chrome measurement; the 104px that file records is what the *roster* pair cost when it landed, and must not be quoted as the environment pair's). The primary is last in the wrapped strip, which keeps it lowest on the row and nearest the thumb, exactly where `EncounterArm` already puts its own. Every remaining control keeps its inline `minHeight: 44`/`var(--tap)`; nothing new is added, so nothing can fall under the floor. Every deletion below is prose — read, never touched, carrying no target, and sitting above the strip and out of the 560–820 band.

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

**`src/ui/gm/Scene.tsx`**

10. The END SCENE docblock (`~296‑306`) — *"It used to be `commit({ combatants: [] })` and nothing else; it now empties the scene ROW this fight was parked out of as well, and lets go of the pointer."*
    → **REWRITE:** END SCENE empties the open row and leaves you in it. It no longer lets go of a pointer, and there is no second thing that happens.
11. The cost sentence on the glass — *"Clears {n} adversaries and every HP and Stress mark on them. {Environment}, Fear and the countdowns stay."* → **KEEP verbatim.** Every clause is still exact, and its character budget is unchanged.
12. The disarm effect (`Scene.tsx:108‑110`) keys on `openScene` instead of `liveScene`, and its docblock stays: the runner still swaps rows in place from the switcher, so the arming can still point at a table that is no longer there.
13. The card key (`Scene.tsx:402`) becomes `` key={`${openScene ?? ''}:${c.id}`} `` and its comment stops calling row-local ids "the very fact that makes `liveScene` non-derivable" and starts calling them the stated invariant they now are.
14. **NEW empty state**, drawn when `openScene === null` or names no scene row: *"No scene is open."* plus **`START A NEW SCENE`** (`openNewScene()`), above the existing `BUILD AN ENCOUNTER` / `OPEN THE BESTIARY` doors, whose labels do not change because the buttons on those screens now say `… A NEW SCENE` themselves. The `combatants.length === 0` panel ("Nothing in the scene") is kept, unchanged, for a row that is open and empty.

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

**Do the 12 seeds through A2's helper, never by hand.** Twelve hand-rewritten seeds is twelve chances to seed a state the store can no longer reach.

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