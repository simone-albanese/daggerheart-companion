<!--
  Produced 2026-08-27 by a 9-agent design workflow (4 independent designs, a
  4-lens judge panel, one synthesis). Run `wf_b1702d82-b2d`.

  IT IS A PLAN AND NOT A RECORD. Nothing in it has been executed. Its file:line
  citations were true against `14c995a`; check every one before building on it.

  IT RUNS BEFORE THE SCHEMA 4->5 BUMP, deliberately: see
  `PIANO-B-SCENE-PER-RIGA-2026-08-27.md`. A bump rewrites the stored record and
  `checkReadable` then makes an older build refuse it, so the import path and
  the automatic backup are the net under it. Today there is no net at all.
-->

# 0. The decision

**Winner: Angle 4's import (add-only, no overwrite verb) + Angle 2's backup lane.** Three of four judges picked Angle 4; the fourth (judge 4) picked Angle 1 but conceded in its own `fatal` that Angle 1 "closes blocker 1 and does not touch blocker 2" and then grafted Angle 2's backup lane wholesale. So the panel is unanimous on the composite, not split.

**Why add-only wins, adjudicated rather than averaged.** `IDBObjectStore.add` throws `ConstraintError` on an occupied key inside the transaction. That makes the destructive outcome unreachable instead of carefully avoided, and it composes with three things already in the tree: `hold()` is exported at `src/store/db.ts:192` *because* `campaigns.ts` hand-writes multi-request transactions; the store is keyed on `id` (`db.ts:118`); and `add` operates on raw keys, so it also refuses a record `readCampaigns` quarantined (`campaigns.ts:96-105`) — a case `putCampaign`'s guard covers with a throw and Angle 1's TAKE THEIRS covers not at all. Angle 1's own `risks[0]` concedes TAKE THEIRS would be "the only irreversible write this app will have outside `clearAll` and `deleteCampaign`", with a copy-then-restore window it cannot close. In a lane whose entire purpose is preventing loss, that is the wrong trade against MENU's armed two-tap REMOVE.

**Rejected outright: Angle 3.** Its D5/D9 route a campaign through a generalised `decideImport` whose `replace` arm `putCampaign`s over a live campaign whenever the file's `updatedAt` is later, reporting after the fact. That is `merge.ts:4-12`'s founding defect ("restoring an August backup overwrote the September character in place, with no prompt, no undo and no history") re-proposed one record class up, where the record holds `archive`, `register` and other people's sheets. And it is not rare: `LEGACY_CAMPAIGN_ID = 'campaign-from-gm-v1'` (`src/store/campaignMigration.ts:59`) plus the shared `FIRST_CAMPAIGN_NAME` (`:72`) means every device upgraded off the localStorage build has an identically-idded, identically-named first table. Its `duplicateFor` widening also breaks seven call sites in `tests/store/import.test.ts` that it promises to leave green.

**The fatal all four judges named, and the fix.** Angle 4's DECISION 8 sources the backup from the disk (`readCampaigns()` after a flush). `writeActive` (`src/ui/gm/gmStore.ts:511-538`) updates `state.campaigns` **only inside the `try` after `putCampaign` resolves**, and on a throw deliberately leaves `dirty = true`. So when writes are failing — the exact case `src/store/backupDeps.ts:9-14` was written about — a flush cannot make the disk fresh, and the evening exists only in the live `GmLive` slice. Angle 4 would have written the stale record, verified it happily (it is a valid `.dhcampaign` of the wrong record) and stamped `lastBackupAt`. **Fix: Angle 2's DECISION 4/5 — `snapshotCampaigns()` in `gmStore.ts` using the module-private `gather`, published through a `campaignSource.ts` seam.** With it comes Angle 2's DECISION 6 as one indivisible fix: the skip fingerprint becomes `campaignChecksum`, because a gathered dirty snapshot keeps `c.updatedAt` stable and an `updatedAt` fingerprint would be blind to it.

**Second fatal, verified, only Angle 1 found it.** `readCampaignRecord` is called at `src/transfer/campaignFile.ts:155`, **outside** the `try` that ends at `:138`. That `try` wraps only the envelope's `SchemaError`. So `CampaignReadError` ("is not a campaign record at all.", `shared/campaigns.ts:1438`; "has no id, so there is nothing to write it back to.", `:1446`) and a second `SchemaError` from the reader's own `checkReadable` at `:1441` escape the one door as themselves. Angle 4's UI enumerates `ImportError` sentences only. Grafted: Angle 1's DECISION 7.

**Third disagreement, adjudicated against judge 1.** Judge 1 wanted Angle 4's D10 kept (a quarantined campaign blocks the backup stamp, with a softer sentence); judge 3 wanted it replaced by Angle 2's union. **Judge 3 is right and D10 is dropped.** A quarantined record is *present on the disk and untouched* (`campaigns.ts:96-105`), not lost — that is the whole reason `countCampaigns` exists (`:213-230`). Worse, `deleteCampaign`'s own docblock records that **nothing in the UI can reach a quarantined campaign** (`:177-180`), so a permanently-red indicator has no remedy inside the app for the damaged-record case. And the 4→5 bump *manufactures* this state on every older tab by design. A net that goes red the day the bump ships trains the GM to ignore the one indicator that matters, which is `backup.ts:16-19` failing from the other direction. Replacement rule in §3.

**Fourth: judge 4's adopt-step trap.** `switchCampaign` early-returns at `gmStore.ts:1237` on `id === activeCampaignId`. Under add-only this can never fire — the landed id is either one the device did not have or a fresh UUID — so `switchCampaign` is safe to reuse, and the reason goes in the docblock so nobody "simplifies" it into a path where it can.

**Fifth, from judge 1: architectural split.** `campaignImport.ts` must not live in `src/store/` and call `useGm` — that contradicts Angle 4's own code-split argument. Pure core with injected deps in `src/store/campaignImport.ts`; the picker, the hydrate/flush ordering and the `setState` in `src/ui/gm/TakeIn.tsx`.

**Preview: yes, one exists.** Angle 4 shipped none; Angle 1 shipped a mandatory one. Adjudicated to Angle 1's *screen* with Angle 4's *semantics*: a read, then one verb. It is not a confirm dialog for a destructive act (there isn't one) — it exists because `readCampaignRecord`'s warnings include `readPartyMember`'s dropped-row sentence naming a player whose sheet will not be on the board (`shared/campaigns.ts:1214`), and reading that after the record has landed is the counting-not-naming failure `campaigns.ts:16-22` was written against.

**Measured, in this tree, not quoted from a design** (script: `/private/tmp/claude-501/-Users-simonealbanese-Documents-Daggerheart-Companion/019875a2-a870-435d-b088-4ecaa6a0f7f5/scratchpad/measure.js`, built from `tests/fixtures/schema/v4.campaign.json` components with a real `v5.dhchar` in each party row). Figures in §3.

---

# 1. The two answers

`src/ui/gm/SaveSheet.tsx:45-51` deferred two questions. Both are answered below as rules, and both docblocks that state them as open (`SaveSheet.tsx:43-52` and `src/transfer/campaignFile.ts:31-36`) are rewritten in the same commit as the code that falsifies them.

## 1a. "A campaign whose id is already on this device"

**The rule: nine of the ten id spaces in a `.dhcampaign` are never compared against anything outside the record and are kept byte-identical. The tenth — `campaign.id` — is decided by IndexedDB, not by code, and never by a timestamp.**

| # | id space | scope | verdict |
|---|---|---|---|
| 1 | `campaign.id` | DEVICE — keyPath of the `campaigns` store (`db.ts:118`) | the only one that can collide. Decided by `add`. |
| 2 | `session[].id` | campaign — two pointers name it (`board.liveScene`, a countdown's `sceneId`) | KEPT |
| 3 | `session[].countdown.id` | campaign | KEPT |
| 4 | `archive[].id` | campaign | KEPT |
| 5 | `archive[].items[].id` | campaign, **deliberately duplicates live row ids** — an archived sitting is a copy of the rows as they stood at closing | KEPT |
| 6 | `register[].id` | campaign | KEPT |
| 7 | `board.combatants[].id`, scene-row combatant ids | scene, ambiguous across scenes on purpose (`shared/campaigns.ts:562-563`) | KEPT — and never named by this lane's code |
| 8 | `party[].id` | CROSS-STORE: it *is* the character's own id (`shared/types.ts:651-655`; `party.ts:63-65` sets `id = sheet.id`) | KEPT — see §1b |
| 9 | ids nested in a party sheet | character | KEPT, untouched |
| 10 | `environmentRef`, `roster[].ref`, `LinkTarget.ref`, `adversaryRef` | dataset slugs, resolved at read time | not device ids; no collision possible |

**A blanket remap is prohibited, and this is a load-bearing prohibition rather than a preference.** `readCampaignRecord` builds `rowIds` from `session` alone and then runs one pointer-repair pass: a countdown whose `sceneId` names no row becomes the campaign's, with a warning (`shared/campaigns.ts:1479-1490`), and a `board.liveScene` naming no row is detached, with a warning (`:1539-1541`). A remap that renumbered rows before renumbering the two pointers would hand the GM a campaign whose parked fight belongs to no row and whose scene clocks have all come loose, reported as data the file no longer has. #5 is a second, independent reason: the archive shares ids with the live plan on purpose.

**The decision on #1, case by case:**

- **Case A — no record on this device holds that id.** `addCampaign` returns `'added'`. Every field, `campaign.id` included, is byte-identical to what `readCampaignRecord` produced. `createdAt` is **not** rewritten: a restore that does not give back what was backed up is worse than any collision.
- **Case B — a record already holds that id (a duplicate, a restore, or an unrelated table).** `add` returns `'taken'`. The arriving campaign lands **beside** the local one under `crypto.randomUUID()`, with `createdAt` moved to now and `updatedAt` left exactly as the file carried it — `duplicateFor`'s reasoning at `merge.ts:89-92`, verbatim: rewriting `updatedAt` would make the arriving copy look newer than the one it was judged against, and `readCampaigns` sorts on that field.
- **Case C — the id is held by a record a newer build wrote (quarantined).** Indistinguishable from B at the `add`, and correctly so: `add` sees raw keys, returns `'taken'`, the arriving copy lands beside it and the quarantined record is never touched. This is strictly better than `putCampaign`, which would throw `StaleBuildError`.
- **Case D — `add` returns `'taken'` on a freshly minted UUID.** Retry with a new UUID, at most three attempts, then report `write-failed`. This is not reachable in practice and is specified so it is not discovered.

**The ID IS NEVER PROOF OF IDENTITY, and the reason must be in the new module's docblock.** `campaignMigration.ts:59` mints every upgraded device's first campaign under the fixed string `campaign-from-gm-v1`, and `:72` gives it the shared `FIRST_CAMPAIGN_NAME`. Two GMs who both came off the localStorage build collide on both, by construction, on the first table either of them ever had. Any future sync, dedupe or "you already have this" shortcut that reads `campaign.id` equality as identity inherits that bug.

**`updatedAt` is used for what the preview SAYS, never for what happens.** `merge.ts:18-21` already warns that it is "a wall clock on whichever device wrote it". For a character that decides one sheet's edits. For a campaign, "the file is newer" does not mean the device's copy is a subset — the two diverged the moment the file was written, and the device's copy may hold three sittings the file has never seen.

**The name is minted, not refused.** `nameHolder(incoming.name, campaigns, CAMPAIGN_NAMES)` with **no `except`** (add-only always creates a second row, so the same-id local record must be collided against). On a hit, `freeName(incoming.name, campaigns, CAMPAIGN_NAMES, { suffix: 'imported' })`, and the sentence names both. That is `state.ts:608-631`'s judgement transferred: there is nobody at a keyboard to refuse to, and dropping somebody's table over a name is the worst answer on the list. On a `'taken'` where the preview saw no name collision (a race with another tab), mint anyway — two rows a GM cannot tell apart is the failure `names.ts` exists to stop.

**There is no merge, and it is refused by name.** Merging two campaigns means reconciling one `fear` integer and one `board`, and there is no honest answer for either. `gmStore.ts:693-698` has already ruled on inventing a state that was never true, in this exact store. Two tables side by side in MENU is the offer instead.

## 1b. "Party sheets meeting newer copies of the same people"

**The premise is false in today's code, and this lane's job is to prove it and retract the sentence, not to invent a policy.**

`src/store/db.ts:12-15`: *"a campaign holds whole copies of other people's sheets, and the one thing that must never happen is a campaign write reaching the store those sheets actually live in. Nothing here writes across the two."* `src/ui/gm/party.ts:4-8`: *"A PC on this board is a *sighting*, not a subscription."* Verified: `grep -rn "putCharacter\|importCharacters" src/ui/gm/` returns **zero hits**.

So an imported campaign writes one record into the `campaigns` object store and **cannot reach the `characters` store at all**. The three consequences, each a rule:

1. **A party row whose id matches a character in the local library is NOT refreshed from it.** Doing so would claim the GM was handed a newer sheet they were never handed, and would put an invented date on a row the board prints ages against (`PartyMember.importedAt`).
2. **A party row is NEVER written into `characters`.** That would put another player's character into the owner's own header `<select>` — the forbidden cross-store write, arriving through the door that had never been built.
3. **Staleness is SHOWN, never resolved.** The preview names the party count and the oldest `importedAt` in the file. The repair verb already exists and `readPartyMember` already prints it: *"Import that character again, from its file or its code, to put the row back."* (`shared/campaigns.ts:1214`).

This is enforced at the **type level, not by a spy**: `CampaignImportDeps` has no character accessor of any kind, and `src/store/campaignImport.ts` imports nothing from the character half of `db.ts`. A source-level test asserts that (§6).

**Is `merge.ts` reusable?** Three-part answer, and the plan takes none of it as code:
- `decideImport` — **wrong question.** It answers "shall I write this record into a store keyed on this id", and the answer here is decided by `add`, atomically, without a clock.
- `duplicateFor` — **wrong shape, and dangerous.** It re-mints a *character* id. `PartyMember.id` is the character's id and `upsertMember` matches re-imports on it (`party.ts:73-75`); a party-level id mint would permanently break that.
- `names.ts` — **genuinely reusable, unchanged.** `freeName`, `nameHolder`, `spokenName`, `CAMPAIGN_NAMES` are the one definition and this is one of its doors.
- **`merge.ts` is not edited by this work at all.** Its three words are borrowed as vocabulary only where the UI needs them, and the campaign path never grows a `take-theirs`.

---

# 2. The import path

**Where the verb lives: `src/ui/gm/SaveSheet.tsx`, a new third block below A COPY TO KEEP.** Not MENU — `MenuSheet.tsx:86-110` measures the campaign row at 363.00 / 277.00 / 62.00 in Chrome at 393×852 and refuses a third target on it. Not Settings — `ACCEPT` (`fileIo.ts:537`) offers `.dhchar`/`.dhbackup` and stays untouched, and `prefs.gmSection` can switch the GM section off entirely. SAVE is where `.dhcampaign` is named at all and where the false sentence is printed.

## 2a. Module layout

**`src/store/campaignImport.ts` (new).** No React, no zustand, no `gmStore` import. Deps injected the way `LegacyDeps` is (`campaignMigration.ts:127-148`), so it is testable with no IndexedDB.

```ts
export interface CampaignImportDeps {
  add: (c: Campaign) => Promise<'added' | 'taken'>;   // store/campaigns.ts::addCampaign
  read: (id: string) => Promise<Campaign | null>;      // store/campaigns.ts::getCampaign
  newId: () => string;
  now: () => string;
}

export interface CampaignImportPreview {
  incoming: Campaign;              // exactly readCampaignRecord's output
  app: string | null;
  exportedAt: string | null;
  schemaVersion: number;           // the ENVELOPE's stamp
  converted: boolean;              // schemaVersion !== CAMPAIGN_SCHEMA_VERSION
  warnings: string[];              // readCampaignRecord's, verbatim, never counted
  counts: { session: number; archive: number; register: number; party: number };
  oldestPartyImportedAt: string | null;
  localSameId: Campaign | null;    // informs the sentence; never decides
  quarantinedSameId: boolean;
  mintedName: string | null;       // freeName result, or null when the name is free
  taken: readonly Named[];         // {id,name} of every campaign here, for a re-mint
}

export type CampaignImportOutcome =
  | { kind: 'landed'; campaign: Campaign; asCopy: boolean; renamedFrom: string | null; warnings: string[] }
  | { kind: 'write-failed'; message: string }
  | { kind: 'not-verified'; campaign: Campaign; message: string };

export function previewCampaignImport(
  parsed: ImportedCampaign,
  here: { campaigns: readonly Campaign[]; quarantined: readonly { id: string }[] },
): CampaignImportPreview;

export function applyCampaignImport(
  preview: CampaignImportPreview,
  deps: CampaignImportDeps,
): Promise<CampaignImportOutcome>;   // never throws, in any branch
```

**`src/store/campaigns.ts` gains `addCampaign` and nothing else.**

```ts
/**
 * Write a campaign only if that id is free, and say which happened.
 *
 * `put` is what the import must not reach, and this is why it is a separate
 * function rather than a flag: an occupied key is answered by IndexedDB inside
 * the transaction, atomically, so no read-then-write window exists for a second
 * tab to drive through. It also refuses a record a newer build wrote, which
 * `readCampaigns` hides from every list (:96-105) and which `putCampaign` can
 * only answer with a throw.
 */
export async function addCampaign(campaign: Campaign): Promise<'added' | 'taken'> {
  const database = await db();
  const tx = hold(database.transaction('campaigns', 'readwrite'));
  try {
    await tx.store.add(campaign);
  } catch (error) {
    await tx.done.catch(() => {});
    if ((error as { name?: string }).name === 'ConstraintError') return 'taken';
    throw error;
  }
  await tx.done;
  return 'added';
}
```
Name the error by `.name`, not `instanceof DOMException`: `fake-indexeddb` ships its own shim and the tests run against it.

**`src/store/campaignMigration.ts`: `function stable` at `:159` becomes `export function stable`.** One word. Two implementations of "did what came back match what went in" would be two answers to the question the whole verified-write standard rests on, and the docblock at `:150-158` explaining why `JSON.stringify` compares key order would then exist in one of the two places.

**`src/transfer/campaignFile.ts`, two changes.**
1. Wrap the `readCampaignRecord` call at `:155`:
```ts
  let campaign: Campaign;
  let warnings: string[];
  try {
    ({ campaign, warnings } = readCampaignRecord(payload));
  } catch (error) {
    if (error instanceof CampaignReadError || error instanceof SchemaError) {
      throw new ImportError(`That campaign file ${error.message}`);
    }
    throw error;
  }
```
Same phrasing as the envelope branch at `:136`. Fixed here, not at the UI, because the format's error contract belongs behind the format's one door — which is what `:15-17`'s "there is exactly one way in" paragraph is about.
2. `ImportedCampaign` gains `schemaVersion: number`, bound from the envelope value currently consumed inline at `:131`. This is not a violation of "a successful conversion says nothing" (`shared/campaigns.ts:1140`): that same docblock names the exception at `:1144` — *"The character import path announces its own conversions, at the moment the user is actually doing something about a file."* This is that moment.
3. The `## What this is not` section at `:31-36` is rewritten. It is false the moment this lands.

**`src/ui/gm/TakeIn.tsx` (new).** The door. Reaches the store only through already-public exports: `useGm`, `useGm.setState`, `flushGm`, `hydrateGm`, and the `switchCampaign` action. **It adds nothing to `gmStore.ts`.**

## 2b. The order of operations, and the race each step kills

```
1  await hydrateGm()                       // memoized at gmStore.ts:596
2  const picked = await pickFile({ extensions: ['.dhcampaign'],
                                   description: 'Daggerheart campaign' })
3  const parsed  = parseCampaignFile(picked.text)     // the ONE door
4  const preview = previewCampaignImport(parsed, useGm.getState())
   ── the GM reads the preview and presses BRING IT IN ──
5  await flushGm()
6  const out = await applyCampaignImport(preview, { add: addCampaign,
                                                    read: getCampaign,
                                                    newId: crypto.randomUUID,
                                                    now: () => new Date().toISOString() })
7  if (out.kind === 'landed') {
     useGm.setState({ campaigns: [out.campaign, ...useGm.getState().campaigns] })
     await useGm.getState().switchCampaign(out.campaign.id)
   }
```

- **Step 1** because hydration's own `setState({ campaigns, ... })` would otherwise land after step 7 and drop the import, and because its `if (dirty)` branch would push `REPLACED_ON_LOAD` about a tap nobody made.
- **Step 5** because a debounced write still holding the *old* board must land before anything else runs. It cannot touch the imported record: `writeActive` gathers `activeCampaignId` only, and `writeAside` writes only queued ids.
- **Step 6 is `add`, and that is what makes `aside` a non-issue.** `aside` receives ids only from `patchCampaign` and from `hydrateGm`'s repair loop (`gmStore.ts:627`), both for records already in `state.campaigns`. A landed id was demonstrably absent from the store, so it cannot be in `aside`. **Write this reason into `campaignImport.ts`'s docblock**, because the day anyone adds a verb that writes onto an id already on the device, `writeAside` will fire on that id and `writeAll` will report success.
- **Step 7 is last, so a tab that dies mid-import can leave a whole campaign but never a false claim.** One `add` in one transaction either commits or does not; "half an import" is not a reachable state on the disk. What *is* reachable is a sentence printed for a write that never committed, and putting the sentence after the read-back means the worst outcome of a `pagehide` or a service-worker reload at any instant is a whole campaign that appears in the list next launch without an announcement.
- **`switchCampaign` is safe to call and must not be replaced by a hand-rolled `set`.** Its early return at `gmStore.ts:1237` (`id === get().activeCampaignId`) can never fire here, because the landed id was either absent from the device or freshly minted. Record that in the docblock: under any future verb that writes onto an existing id, this call becomes a no-op and the pre-import board would be gathered straight back over the record.

## 2c. Write → read back → compare, applied

Inside `applyCampaignImport`, after `add` returns `'added'`:

```ts
const back = await deps.read(written.id);
if (back === null) return notVerified(written, 'it could not be read back afterwards');
if (stable(back) !== stable(written))
  return notVerified(written, 'what came back was not what was written');
```

Three rules, each with its reason:
- **`stable()`, not `campaignChecksum` and not `JSON.stringify`.** A structured clone need not preserve key order (`campaignMigration.ts:150-158`).
- **Compare against what the reader produced, not against the file's payload.** `readCampaignRecord` legitimately renumbers `order`, clamps Fear, sorts the archive by `closedAt` and drops an unwhole party row. Comparing to the file would fail every import that had a warning. What is verified is "the record I decided to write is the record now on the disk".
- **A disagreement leaves the record and names it; it does not delete it.** `campaignMigration.ts:26-36`: *"this app does not delete what it could not read."* `deleteCampaign` can itself throw, and a record that came back different is far more likely a reader disagreement than a corrupt write.

## 2d. The screen — every state and every sentence

Layout: a new third block in the same 363px column (`SaveSheet.tsx:57-63`), `gap: 9`, one full-width `.btn` at `minHeight: var(--tap)` = 44. The sheet's root is already `className="scroll stack"` (`:167`), so the preview can grow without clipping. Reading above, touching below, in that order. Label: **A COPY, BACK IN**.

**State 0 — resting.** Button `OPEN A CAMPAIGN FILE`. Under it, `.t-dense --muted`:
> A campaign file from this app, on any device. It arrives as a campaign of its own and never writes over one that is already here — if this table is already on this device you get both, and REMOVE in MENU takes either one away. The players' sheets come back exactly as this table saw them; your own characters are a separate backup and this does not touch them.

**State 0-blocked — the store has not answered (`hydrated === false`) or the read failed (`writeRetry === 'read'`).** Button disabled. `hydrated === false`: *"This device is still being read."* `writeRetry === 'read'`: *"This device's storage could not be read, so nothing can be brought in yet. TRY AGAIN above reads it again."*

**State 1 — picking.** `READING THE FILE…`, disabled.

**State 2 — cancelled picker.** Nothing is said. Cancelling is not an error (`ImportDoors`/`describeSave` precedent, `SaveSheet.tsx:99-101`).

**State 3 — refused.** `role="alert"`, `color: var(--stress)`, the parser's sentence **verbatim**. The complete set, none of it composed here:
- `That file is not valid JSON, so it is not a Daggerheart campaign.`
- `That file does not contain a campaign.`
- `That is a "dhchar" file, not a Daggerheart campaign (.dhcampaign).` — and for `dhchar`/`dhbackup` only, one appended sentence, because it is the one wrong file a GM will actually pick: *"Characters come in through Settings."*
- `That file is not a Daggerheart campaign: it has no "format" field. Expected "dhcampaign".`
- `That campaign file was written by a newer version of the app (schema 5; this app reads 4). Update the app, then open it again - it has not been changed.`
- `That campaign file uses schema 0, which no released version of this app has ever written (the oldest is 1). It has not been imported and nothing has been changed.`
- `That campaign file carries no checksum, so there is no way to tell whether it arrived whole. It has not been imported.`
- `That campaign file is damaged: its checksum does not match what is inside it, so nothing has been imported. If you edited it by hand, that will do this too.`
- `That campaign file is not a campaign record at all.` — **new, from the §2a fix**
- `That campaign file has no id, so there is nothing to write it back to.` — **new**
- `The file could not be opened: <reason>.` — from `pickFile`

**State 4 — the preview, id not on this device.** Read block, then warnings, then two buttons.
> **"The Sablewood Winter"** — saved 12 Mar 21:40 by version 0.6.0, at campaign schema 4. This app reads 5, so it was converted on the way in.
> 14 rows in the plan · 6 closed sittings · 31 entries in the record · 4 in the party, the oldest sheet handed over 5 weeks ago.
> Nothing on this device has that campaign, so nothing here will be written over.

If `mintedName !== null`: *"Another campaign is already called "The Sablewood Winter", so this one will be called "The Sablewood Winter (imported)"."*

Then **every string in `preview.warnings`, verbatim, one per line**, `color: var(--stress)`. These are the loudest thing on the screen: they include the dropped-party-row sentence naming a player whose sheet will not be on the board.

Buttons: `BRING IT IN` (primary) and `NOT NOW`.

**State 5 — the preview, id already here.** Two-column read block:
> That file and a campaign already on this device carry the same id. It may be the same table, or an unrelated one that started life on an upgraded device — only you can tell.
> **ARRIVING** — "The Sablewood Winter", saved 12 Mar 21:40 · 14 rows · 6 sittings · 31 entries · 4 in the party
> **ALREADY HERE** — "Winter (Ana's table)", last written 2 Apr 19:05 · 21 rows · 8 sittings · 44 entries · 5 in the party
> The one here was written last, by three weeks. Nothing here will be written over either way: the file arrives as a second campaign, under a new name, and REMOVE in MENU takes either one away.

Warnings as above. Buttons: `BRING IT IN` and `NOT NOW`.

**State 5q — the id is held by a quarantined record.** Same two buttons; the sentence changes:
> A campaign written by a newer version of this app is on this device under that id. It is left exactly as it is — this build must not touch it — and the file arrives as a second campaign beside it.

**State 6 — writing.** All buttons disabled, the pressed one reads `BRINGING IT IN…`.

**State 7 — landed.** `role="status"`, `color: var(--sage)`.
- no collision: *""The Sablewood Winter" is on this device and open. It came from a file exported by app 0.6.0 on 16 Aug."*
- landed as a copy: *"That campaign is already on this device, so the copy from the file has been added beside it as "The Sablewood Winter (imported)" and opened. Nothing that was already here has been changed, and REMOVE in MENU takes either one away."*
- renamed only: append *"Another campaign was already called "X", so the one that arrived is now "Y"."*

Warnings are repeated under it, because they are now facts about a campaign the GM is holding rather than about a file they were considering.

**State 8 — the write failed.** `role="alert"`, `var(--damage)`.
- `write-failed`: *""The Sablewood Winter" could not be written to this device's storage (QuotaExceededError). Nothing has been changed: the file on your disk is untouched, and OPEN A CAMPAIGN FILE tries again."* No retry button of its own — the door is the retry, which is `removeCampaign`'s argument at `gmStore.ts:1298-1307`.
- `not-verified`: *""The Sablewood Winter (imported)" was written to this device but did not come back the same when it was read again, so it has not been opened and nothing else has changed. It is still on this device under that name; nothing has been deleted."*

**Prose that becomes false and is rewritten in the same commit:** `SaveSheet.tsx:250-254` (the paragraph saying nothing can read a campaign file back in) is **deleted**; `SaveSheet.tsx:43-52` (`## The copy, and what it is not`) is rewritten to state what the import does, that the id question is answered by `add` and that the party question was answered by a prohibition; `campaignFile.ts:31-36` likewise.

---

# 3. The automatic backup

## 3a. What is stored, and where

One dated `.dhcampaign` per campaign, in the **same folder** the `.dhbackup` goes to. No subdirectory — that adds an API surface and a "could not create the folder" failure mode to the one subsystem whose rule is never to claim an unprovable success.

**Not a `campaigns` field inside `.dhbackup`.** That envelope carries the *character* `SCHEMA_VERSION` (`fileIo.ts:93`) and `checkEnvelopeSchema` validates against character numbers (`:134-142`); it also has **no checksum at all** (`grep -c checksum src/transfer/fileIo.ts` = 0). An older build meeting a combined file would pass the envelope check, restore the characters and drop the campaigns in silence — half an import, arriving by the back door. Separate files also keep the daily-rotation property intact: a `pagehide` write cut short can only spoil today's copy of *one* campaign.

**Not a new `.dhcampaigns` format** (Angle 3's proposal, rejected by three judges and by me). A fifth format is a fifth door, against `campaignFile.ts:15-17`'s "exactly one way in". See §7 for what that costs and when it should be revisited.

**File name: `daggerheart-<slug>-<crc8>-YYYY-MM-DD.dhcampaign`**, minted in `backup.ts` (not in `campaignFile.ts` — the undated `campaignFileName` at `:89` is the *hand-off* name and stays untouched; a dated per-campaign name is a rule of the backup regime).
```ts
const campaignBackupFileName = (c: Campaign, at: Date): string =>
  `daggerheart-${slugify(c.name) || 'campaign'}-${crc32(new TextEncoder().encode(c.id))
    .toString(16).padStart(8, '0')}-${at.toISOString().slice(0, 10)}${CAMPAIGN_EXTENSION}`;
```
The 8 hex of the id is not decoration. `slugify` (`shared/slugify.ts`) collapses to `[a-z0-9]+` → `-`, so "The Sablewood, Winter" and "The Sablewood Winter" both become `the-sablewood-winter`, and a name written entirely in non-Latin script becomes `''` → `campaign`. Two campaigns colliding on one backup file name is a silent loss *inside the backup*, the one place this app must not have one. The id itself cannot go in a filename — it is any string (`campaign-from-gm-v1` today, whatever a hand-edited file carries tomorrow). A crc32 collision is caught anyway: the verify step parses the file back and compares `campaign.id`. Date last, so a listing groups by campaign and orders by day.

## 3b. Measured bytes

Compact record / bytes on disk after `serializeCampaign`'s indent-2 pretty print (`campaignFile.ts:75-87`), built from the real components of `tests/fixtures/schema/v4.campaign.json` with a real `v5.dhchar` sheet in each party row:

| case | compact | on disk |
|---|---:|---:|
| the committed `v4.campaign.json` fixture | 5,082 | **9,702 B** |
| fresh campaign (0 party, 0 rows, no archive) | 423 | **794 B** |
| first night (3 party, 6 rows, 0 archived, 2 register) | 7,936 | **15,255 B** |
| session 3 (4 party, 10 rows, 2 archived, 6 register) | 16,686 | **32,999 B** |
| one season (5 party, 14 rows, 24 archived, 40 register) | 71,399 | **142,831 B** |
| two seasons (6 party, 20 rows, 60 archived, 120 register) | 167,553 | **335,749 B** |

Components, compact: one party member with a real sheet **1,757 B**; one archived sitting of six rows **1,944 B**; one register entry **265 B**; one session row **~386 B** average. For scale, `tests/fixtures/schema/v5.dhbackup` with one character is **2,883 B** on disk.

One-season breakdown, compact: `archive` 46,779 · `register` 10,671 · `party` 8,791 · `session` 4,743 · `board` 216. **The archive is the term that grows without bound** and it is rewritten whole every play night. Pretty-printing roughly doubles every figure and is deliberate (`campaignFile.ts:6-8`: readable JSON that can be opened in a text editor when everything else has gone wrong) — not changed.

**Folder cost, simulated over 52 play nights for one campaign growing from a first night to a season: 4,134,025 B = 3.94 MB across 52 files.**

## 3c. Generations and eviction

**None are evicted. Nothing in the backup subsystem has ever deleted a file, and this lane does not start.** The count stays sane because of the fingerprint gate, not because of pruning: a campaign not played today produces no file today, so the folder grows by roughly one file per campaign per *play night*, not per app launch. A delete in the backup folder is its own lane with its own argument (§7).

## 3d. The trigger, and where the bytes come from

Triggers are unchanged: `installBackupHooks` (`backup.ts:346-377`, wired at `App.tsx:182`) on `pagehide` and `visibilitychange`→hidden, plus `backupAtSessionEnd` and the manual button, all through the one `running` flag.

**The source is memory, through a publish seam — this is the fatal fix.**

`src/store/campaignSource.ts` (new, mirrors `src/ui/shell/campaignAlert.ts` inverted):
```ts
let live: (() => Campaign[]) | null = null;
export const publishCampaignSource = (f: (() => Campaign[]) | null): void => { live = f; };
/** The freshest campaigns this app has: the GM store's when it exists, the disk's otherwise. */
export const currentCampaigns = async (): Promise<Campaign[]> =>
  live === null ? (await readCampaigns()).campaigns : live();
```

`src/ui/gm/gmStore.ts`, immediately after `flushGm` (`:422-427`):
```ts
/** Every campaign as it stands right now, the live board folded into the open one. */
export function snapshotCampaigns(): Campaign[] {
  const state = useGm.getState();
  return state.campaigns.map((c) =>
    c.id === state.activeCampaignId && dirty ? gather(c, state, c.updatedAt) : c,
  );
}
```
and one line beside the existing `useGm.subscribe(...)` at `:1393`: `publishCampaignSource(snapshotCampaigns);`

`gather` (`:347`) and `dirty` (`:382`) are module-private, so this cannot live anywhere else. **Gathering with `c.updatedAt` rather than a fresh stamp is deliberate**: `writeActive` (`:516`) stamps `new Date().toISOString()` when the record actually reaches the disk, and inventing a different stamp here would put a time in the file that no write ever happened at.

**Why not the disk, and why a flush does not save it.** `backupDeps.ts:9-14` states the rule for characters: *"A backup read from IndexedDB is a backup of what survived the last write. When writes are failing — a full disk, an older build refusing to flatten a newer record — that is precisely the work the user is about to lose."* `writeActive` updates `state.campaigns` only inside the `try` after `putCampaign` resolves and leaves `dirty = true` on a throw (`:527-537`). So `flushGm()` cannot make the disk fresh in the failing case, and a disk-sourced backup would write the stale record and stamp "last backup: today" over the evening that exists nowhere.

**Why not `import { useGm } from gmStore` in `backupDeps.ts`.** `gmStore.ts:1411` is a bare `void hydrateGm()` at module scope, and `backupDeps.ts` is imported eagerly by `App.tsx`, `Settings.tsx` and both error boundaries. That import would drag the lazy GM chunk into first paint and start a campaign read for every player who never opens the GM screen — and from a *crashed* screen, via the boundaries. `campaignAlert.ts:16-21` states this rule in the other direction and `gmStore.ts:71` already imports it. `backupDeps.ts` gets a docblock paragraph saying why it does **not** reach for `gmStore`, so the next person does not add the import.

## 3e. The skip fingerprint

Per campaign, **content**, not `updatedAt`:
```ts
BackupRecord.campaigns?: Record<string, { checksum: number; fileName: string; at: string }>
```
using `campaignChecksum` (`campaignFile.ts:72`). Forced by 3d: a gathered dirty snapshot deliberately keeps `updatedAt` stable, so an `updatedAt` fingerprint would look unchanged and skip exactly the board the GM has been editing. The global gate at `backup.ts:257` becomes **per target**, so an unchanged campaign cannot block the character write and an unchanged library cannot block a campaign write. Cost: one `JSON.stringify` + crc32 per campaign per trigger — ~1 ms at season size; the text has to be produced on the write path anyway.

## 3f. The verify hook

`writeIntoDirectory` (`fileIo.ts:781`) already compares the whole text byte-for-byte at `:790-796` and calls `options.verify` at `:795`. The campaign leg passes a verify that **inlines** the parse, exactly as the character leg does at `backup.ts:273-284`:
```ts
verify: (written) => {
  try {
    const back = parseCampaignFile(written).campaign;
    return back.id === c.id ? null
      : `${fileName} came back holding a different campaign`;
  } catch (error) {
    return `${fileName} was written but could not be read back (${error instanceof Error ? error.message : String(error)})`;
  }
}
```
This is stronger than the character leg's count, because the CRC is inside the reader. No extraction from `exportCampaign` — inlining is the existing precedent and it keeps `campaignFile.ts` out of lane B's file list.

## 3g. Stamping, partial failures, and the quarantine rule

- `runBackup`'s early return at `:253` becomes `if (characters.length === 0 && campaigns.length === 0) return none('There is nothing to back up yet.')`. The character file is written only when there are characters. **A GM who runs the table and plays nobody is a normal user of this app, and today they are told there is nothing to back up and get nothing.** Same fix at `Settings.tsx:922`: `disabled={busy || (characters.length === 0 && campaignCount === 0)}`.
- Order: **characters first** (`db.ts:4` — "the only truly precious data"), then one campaign file per changed campaign.
- `stamp()` (`:310-322`) is reached **only when everything that needed writing wrote**. A run where 4 characters landed and one campaign did not sets `lastError` naming that campaign, leaves `lastBackupAt` alone, and `backupStatus` reports `level: 'failing'` with the sentence in `detail`. Stamping on partial success would let "last backup: today" sit over a campaign that has never reached the folder, which is exactly the lie `backup.ts:16-19` forbids.
- **A quarantined campaign does NOT block the stamp and is NOT reported as missing.** It is named as a *notice*, not as `lastError`. `BackupOutcome` gains `notReadable: string[]`; the outcome's `reason` on an otherwise clean run reads:
  > Saved daggerheart-backup-2026-08-27.dhbackup and 2 campaign files — 4 characters, "The Sablewood Winter", "Bones of the Reach". One campaign on this device was written by a newer version of this app and is not in the backup: close every tab of this app and open it again, then back up.

  Adjudication (§0): the record is on the disk and untouched, `countCampaigns` exists precisely because "readable" is the wrong number for a sentence about what is on this device, **nothing in the UI can clear such a record** (`campaigns.ts:177-180`), and the 4→5 bump creates this state on every older tab by design. Both halves of the sentence are true and neither is a failure claim.
- `integrityCheck` (`:488`) gains `missingCampaignIds`, and `BackupRecord` gains `knownCampaignIds`. **The "here" set is `campaigns.map(c => c.id) ∪ quarantined.map(q => q.id)`** — verified: `readCampaigns` pushes `{ id, name, schemaVersion, reason }` into `quarantined` (`campaigns.ts:96-99`), so no new export is needed. Without the union, the day a second tab writes schema 5 the older tab announces that the GM's campaign has vanished and blames ITP for behaviour this app has on purpose.
- `integrityCheck` and `noteSession` read the **disk** (`readCampaigns()`), never `snapshotCampaigns`. `backupDeps.ts:26-33` is explicit: a store-sourced list can never throw, which would make the "storage could not be opened" branch unreachable and turn one bad launch into a fabricated loss. The existing `readable` guard at `:563-567` extends to a campaign read that threw: record the timestamp, never overwrite the known list with an empty one.
- `App.tsx:399` — the heading condition becomes `integrity.missingIds.length + integrity.missingCampaignIds.length > 0`. Today a device that lost only its campaigns is headed "THE LIBRARY DID NOT OPEN", which names the wrong problem. `integrity.message` is already rendered verbatim at `:402`, so the campaign sentence needs no JSX. One conditional chip beside RESTORE FROM A BACKUP, drawn only when campaigns are missing and `prefs.gmSection` is on: `OPEN THE GM TOOLS` → `setScreen('gm')`, because the campaign restore lives behind SAVE inside that section and the shell must not grow a second copy of it.

## 3h. The manual copy, recorded

On `SaveResult.ok`, `exportActiveCampaign` (`gmStore.ts:1259-1282`) writes `{ lastCopyAt, route }` for that campaign into the same `BackupRecord.campaigns` entry — **and does not set the checksum that suppresses a folder write.** A `download` or `share` route means the click happened, not that a file exists: `saveTextFile` reads nothing back. Only `writeIntoDirectory`, which reads the file back, sets the skip fingerprint. Leaving it unrecorded (today's behaviour) leaves an iOS GM who dutifully saves a copy every week reading "no backup yet" for ever, which trains them to ignore the one indicator that matters.

**Shipped, with one correction to §3i.3 below.** The write alone does nothing — for a while it landed in a field no line of the app read, which is the "no backup yet" it was written to stop, one indirection along. Its reader is `backupStatus`, which carries the newest of those notes as `lastCopyAt`/`copyDaysSince`/`copyRoute`, and Settings prints them as the last sentence of the backup panel's why-line. That clock must never touch `level`, `daysSince`, `label` or `lastBackupAt`, and a test asserts it does not.

## 3i. The restore

`pickFile({ extensions: ['.dhcampaign'], description: 'Daggerheart campaign' })` in SAVE (§2). `pickFile` already parameterises this (`fileIo.ts:842-848`), so the shared `ACCEPT` list at `:537` does not change and Settings' "Import a file" keeps offering exactly `.dhchar`/`.dhbackup`.

**The picker, not a directory listing, and that is deliberate.** The folder handle lives in the separate `daggerheart-backup` IndexedDB (`backup.ts:105-107`) and ITP eviction is per-origin — so on the one day the restore is needed the handle may be gone while the files are not. Listing the directory would only help in the case where the handle survived, which is not the case the restore exists for.

## 3j. **Does this survive ITP eviction of IndexedDB? Stated plainly.**

**On Chromium desktop with a chosen folder: YES.** The backup folder is a File System Access handle, so the files live in the user's own filesystem, outside the origin's storage bucket. ITP or any quota eviction of IndexedDB does not touch them. The *handle* lives in the `daggerheart-backup` IndexedDB, which is evictable — so the handle can go while the files stay. In that state the app reports "No backup folder has been chosen", stops backing up, and **nothing already written is lost**; the GM re-picks the folder and the files are all still there.

**On Safari desktop, iOS and iPadOS: NO. There is no automatic backup at all, and this lane does not change that in either direction.** `canChooseDirectory()` is `pickers().showDirectoryPicker !== undefined` (`fileIo.ts:708`). Safari does not have it. `Settings.tsx:946` already says so on screen: *"iPhone and iPad have no folder picker at all."* Firefox has the picker but will not structured-clone the handle (`backup.ts:175-177`), so it re-asks every session and is not automatic across sessions either. **The automatic backup does not run on the browser whose eviction the entire subsystem was built for.** That is a platform fact, not a gap this design can close; campaigns joining the folder neither helps nor hurts it.

**What the design does instead, on that platform, and it is three concrete things:**
1. `navigator.storage.persist()` is already asked (`db.ts:428-431`) and is granted far more often once the app is installed to the home screen. Unchanged by this lane.
2. **The nag stops lying.** Today `grep -ci campaign src/store/backup.ts` = 0, so a GM with three campaigns and no characters is told *"There are no characters to back up yet"* and the indicator never moves. After §3g it counts campaigns, the button is pressable, and the sentence is true.
3. **SAVE A COPY becomes a backup the app can see.** §3h records it and `backupStatus` reads it, so an iOS GM who exports each campaign into Files/iCloud reads *"A copy of a campaign was saved by hand 3 days ago, through the share sheet. The app cannot check that it arrived, so it does not count as a backup."* instead of nothing at all. The shipped sentence does not name the campaign the plan named it with: `BackupRecord.campaigns` is keyed on the id and a `CampaignNote` carries no name, and the newest copy may well belong to a campaign that is no longer on the device — which is exactly the case this line is read in. And §2 makes that copy readable again, which is the half that was missing.

**What does NOT work and must not be proposed as a fix:** OPFS and Cache Storage are the same origin bucket and are evicted together. localStorage has different eviction rules in practice — `backup.ts:478-486` leans on exactly that asymmetry — but it is capped near 5 MB, is the store iOS clears first, and is precisely the store `shared/campaigns.ts` and `gmStore.ts:300-320` moved campaigns *out* of. Re-parking a copy there would re-introduce what that lane deleted, and a two-season campaign is 335 KB pretty-printed against a 5 MB origin ceiling shared with everything else.

**One disclosure that belongs on the screen, not in a release note:** `PartyMember.sheet` is a whole `Character`, on purpose (`party.ts:4-14`, `shared/campaigns.ts:669`). After this lands, a folder the GM picked once for their own backups silently accumulates their *players'* sheets, once per play night, possibly into a synced Drive/iCloud folder. That is a real change in what the app does with data that is not the user's. The mitigation is a sentence beside the folder picker, not a code change — stripping party sheets would make the backup unable to restore the thing it exists to restore.

---

# 4. Schema

**A `.dhcampaign` written at campaign schema 4 and restored by a build at schema 5 walks the migration chain automatically. No restore-side migration exists, and none should be written.**

The mechanism, confirmed by reading, not argued:

```
parseCampaignFile(text)                              src/transfer/campaignFile.ts:111
  ├─ format check                                    :120-127
  ├─ ENVELOPE version: checkReadable(versionOf({schemaVersion}), 4, 1)   :129-138
  ├─ checksum, over the payload AS IT ARRIVED        :140-153
  └─ readCampaignRecord(payload)                     :155
       ├─ versionOf(value, CAMPAIGN_SCHEMA_VERSION)  shared/campaigns.ts:1440
       ├─ checkReadable(version, 4, 1)               shared/campaigns.ts:1441
       ├─ applyChain(value, version, CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_MIGRATIONS)
       │                                             shared/campaigns.ts:1442
       ├─ readPartyMember → migrateCharacterRecord(sheet)
       │                                             shared/campaigns.ts:1157
       └─ returns the record restamped CAMPAIGN_SCHEMA_VERSION   :1548
```

So **both chains run inside the reader**: the campaign chain in `applyChain`, and the *character* chain, per party sheet, inside `readPartyMember`. `getCampaign` (`campaigns.ts:158-166`) and `readCampaigns` (`:72`) call the same reader, so the disk path and the file path cannot diverge.

**The order is not incidental, and it is already a committed claim.** The checksum is verified against `parsed['campaign']` raw, *before* the chain runs (`campaignFile.ts:147-153`), which `tests/store/campaignFile.test.ts:330-335` states in words: *"it is verified against the payload as it arrived, before the chain runs, so a migration that changes a field cannot make an honest old file look damaged."*

**What the net depends on, and cannot itself supply:** the 4→5 lane must add a `CAMPAIGN_MIGRATIONS` entry keyed `from: 4`. Without it `applyChain` throws `SchemaError` (`shared/migrations.ts:224-231`) and **every schema-4 `.dhcampaign` already on a GM's disk becomes unrestorable**. That gate already exists and is not this lane's to duplicate: `tests/store/campaignSchema.test.ts:97-119` asserts `missingConverters(CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_SCHEMA_VERSION + 1, CAMPAIGN_MIGRATIONS)` equals `[CAMPAIGN_SCHEMA_VERSION]` today, which is exactly "a bump without its converter fails". **Do not add to that file.**

**What this lane adds instead: proof by committed bytes.** `tests/fixtures/schema/v4.dhcampaign` (new, lane B) — the v4 record inside a real envelope with its real crc32, written by this build once and never regenerated, the discipline `shared/migrations.ts:19-24` states and `tests/fixtures/schema/v1.dhcampaign` (3,759 B, already committed) follows. It goes green today at 4 and stays green at 5 **without being edited**, because the chain runs inside the reader. And `v1.dhcampaign` is routed through the *store* import path as well (lane A), so the four-step walk is asserted end to end and not only through the parser.

**Nothing in this work names a `GmBoard` field.** `campaignImport.ts` compares `id` and `name` and walks whatever keys `stable()` finds; the backup serialises whatever `Campaign` shape the build defines and checksums whatever that serialises to; `snapshotCampaigns` calls `gather`, which the 4→5 lane owns, so the day `combatants` moves onto scene rows the snapshot follows by construction. **Nothing here blocks the field's removal.** No test in this plan pins a campaign schema number — every assertion is written against `CAMPAIGN_SCHEMA_VERSION`, never against `4`.

**What `checkReadable` does to a too-new file, in the UI.** `SchemaError` from either the envelope check (`campaignFile.ts:130-134`) or the payload check (`shared/campaigns.ts:1441`, now wrapped per §2a) becomes an `ImportError` prefixed `"That campaign file "`, and State 3 prints it verbatim:

> **That campaign file was written by a newer version of the app (schema 5; this app reads 4). Update the app, then open it again - it has not been changed.**

Not a corruption sentence, and the remedy is in it. **This is the 4→5 bump's own message arriving through the new door, and it is a reason the door must exist before the bump does.** The envelope check runs *before* the checksum precisely so a future format is not reported as a bad disk (`campaignFile.ts:105-109`).

---

# 5. The lanes

**Rule enforced absolutely: two lanes never write one file.** The file lists below are disjoint. `shared/campaigns.ts` is written by **nobody here** — it is imported only (`readCampaignRecord`, `Campaign`, `CAMPAIGN_SCHEMA_VERSION`, `CAMPAIGN_MIGRATIONS`, `newCampaign`). If a reviewer finds an edit to it in either diff, it is a mistake; take it out.

### Lane A — the import path

**Owns, exclusively:**
| file | change |
|---|---|
| `src/transfer/campaignFile.ts` | try/catch around `readCampaignRecord` at `:155` (§2a); `schemaVersion` on `ImportedCampaign`; rewrite `## What this is not` at `:31-36` |
| `src/store/campaigns.ts` | `addCampaign` (new); a docblock paragraph on `putCampaign` saying why the import path may not reach it |
| `src/store/campaignMigration.ts` | one word: `export function stable` at `:159` |
| `src/store/campaignImport.ts` | NEW — preview, verified add, no React, deps injected |
| `src/ui/gm/TakeIn.tsx` | NEW — the door, the ten states, every sentence |
| `src/ui/gm/SaveSheet.tsx` | mount `<TakeIn/>`; delete `:250-254`; rewrite `:43-52` |
| `tests/store/campaignFile.test.ts` | a NEW describe block **appended at the end of the file** |
| `tests/store/campaignDb.test.ts` | `addCampaign` cases |
| `tests/store/campaignImport.test.ts` | NEW |
| `tests/gm/gmSave.test.tsx` | NEW |

**Touches `gmStore.ts` not at all.** `TakeIn.tsx` reaches the store through `useGm`, `useGm.setState`, `flushGm` (`:422`), `hydrateGm` (`:596`) and the `switchCampaign` action — all already public.

### Lane B — the automatic backup

**Owns, exclusively:**
| file | change |
|---|---|
| `src/store/backup.ts` | the whole campaign leg (§3), `campaignBackupFileName`, the per-target fingerprint, the both-empty return, the stamp rule, `integrityCheck`/`noteSession` with the quarantine union |
| `src/store/backupDeps.ts` | docblock only — why this module does **not** reach for `gmStore` |
| `src/store/campaignSource.ts` | NEW — `publishCampaignSource` / `currentCampaigns` |
| `src/ui/gm/gmStore.ts` | `snapshotCampaigns()` after `flushGm` (`:427`); `publishCampaignSource(snapshotCampaigns)` beside `useGm.subscribe` (`:1393`); `{lastCopyAt, route}` inside `exportActiveCampaign` (`:1259-1282`) |
| `src/ui/settings/Settings.tsx` | status sentence counts campaigns; `disabled` at `:922`; the three "Automatic backup" hint branches gain their campaign clause; the folder-picker disclosure sentence |
| `src/ui/shell/App.tsx` | heading condition at `:399`; the conditional GM chip |
| `tests/store/backup.test.ts` | `fakeFolder` rewrite + new cases |
| `tests/store/backupSeam.test.ts` | new source assertions |
| `tests/store/campaignBackup.test.ts` | NEW |
| `tests/fixtures/schema/v4.dhcampaign` | NEW, frozen |
| `tests/gm/gmStore.test.ts` | `snapshotCampaigns` cases |

### Contention, listed and resolved

| file | who wants it | resolution |
|---|---|---|
| `shared/campaigns.ts` | 4→5 scene lane **only** | Neither A nor B edits it. Import-only. **Flagged as required.** |
| `src/ui/gm/gmStore.ts` | **B** and the 4→5 lane | B's three hunks are at `:427`, `:1259` and `:1393`; the scene lane's are `GmLive` (`:117`), `EMPTY_LIVE` (`:323`), `spread` (`:332`), `gather` (`:347`), the combatant actions (~`:1064-1090`) and `runScene`/`adoptBoard`. Disjoint regions, same file → **B merges to main before the 4→5 lane cuts its worktree.** Do not run both in one worktree. |
| `src/store/campaignMigration.ts` | **A** and the 4→5 lane | A's hunk is the word `export` at `:159`; the scene lane must edit the `board: {…combatants…}` literal at `:210-222` (its own comment at `:217-221` says an unnamed field there is a compile error). ~50 lines apart → **A merges before the 4→5 lane cuts.** Fallback if refused: copy `stable` into `campaignImport.ts` — rejected as the default, because two definitions of "the same record" is the defect the whole verified-write standard rests on. |
| `tests/store/campaignFile.test.ts` | **A** and the 4→5 lane | The scene lane must edit the "version window the bump moved" block (`:309-408`); A appends a separate block at the end. Clean as long as neither reflows the other's block. |
| `tests/store/campaignSchema.test.ts` | 4→5 lane **only** | Neither A nor B adds an assertion. Its `missingConverters` test at `:97-119` is already the net under the bump. |
| `tests/fixtures/schema/` | both | A adds nothing (it reuses the committed `v1.dhcampaign`); B adds `v4.dhcampaign`; the scene lane adds `v5.campaign.json`. Append-only, different names. |

### Ordering

- **A and B are independent of each other** — disjoint files, no shared symbol, no import edge except that `backup.ts` calls `parseCampaignFile`, which already exists. **Run them in parallel. Do not barrier them.**
- **Both must merge to main before the 4→5 lane cuts its worktree**, because of the two rows above. Per the repo memory, cut that worktree from local `main` after both merges, not from `origin`.
- If the schedule forces the bump first instead: **A and B rebase, never the scene lane** — its edits are semantic and theirs are additive. `snapshotCampaigns` calls `gather` rather than copying it, so it stays correct across the bump by construction. **Never hand-roll a copy of `gather`.**

---

# 6. Tests

Two repo guards apply to everything below and are stated once:

- **No test may assert against a literal it also filtered by.** Concretely: `expect(warnings.filter(w => w.includes('Ilya'))).toContain('Ilya')` is vacuous. Where a warning list is narrowed to isolate a known noise line, the assertion must be about a *different* string, as `campaignFile.test.ts:340-348` already does (it filters on `'not a whole character'` and then asserts on `'Ilya of the Ninth'`).
- **A surviving mutant is addressed, not hidden.** Each new module below names the mutation its tests must kill. If a mutant survives, the test is strengthened or the code is deleted; it is never allowlisted.

### `tests/store/campaignImport.test.ts` (NEW, lane A) — injected deps, no IndexedDB

1. **never writes over a campaign that is already here, even when the file says it is newer.** Local record with an older `updatedAt`; file carries the same id and a newer one. Assert: two campaigns exist, the local record is byte-identical to before (`stable()` on both sides), the arriving one has a different id. *Kills: `add` → `put`.*
2. **lands beside a record a newer build wrote, and leaves it alone.** Seed a raw record stamped `CAMPAIGN_SCHEMA_VERSION + 1` (which `readCampaigns` quarantines, so `state.campaigns` cannot see it); import a file carrying that id. Assert `add` returned `'taken'`, the quarantined record is untouched, the arrival landed under a fresh id. *Kills: deleting the `'taken'` branch.*
3. **every internal id survives byte-identical.** `session[].id`, `session[].countdown.id`, `archive[].id`, `archive[].items[].id`, `register[].id`, `board.combatants[].id`, `party[].id` all equal after the round trip. *Kills: any future blanket remap.*
4. **the two pointers still stand, and `readCampaignRecord` issues no repair warning.** A file with `board.liveScene` naming a row and a countdown with `sceneId` set. Assert both pointers survive and `warnings` contains neither of the two repair strings from `shared/campaigns.ts:1483` / `:1541`. **This is the load-bearing assertion of the whole id decision.**
5. **the read-back compare catches a one-field difference.** Injected `read` returns a record with one countdown's `value` mutated. Assert `kind === 'not-verified'`, the sentence, and that the record is **not** deleted (no delete dep exists — a type-level guarantee). *Kills: dropping the `stable()` compare; kills a count-based compare, which is exactly what `campaignMigration.ts:293-300` argues would pass.*
6. **the name is minted and named.** A file colliding with a differently-idded local campaign lands as `"X (imported)"`; a second import gives `"X (imported 2)"`; the outcome carries `renamedFrom`.
7. **`campaign-from-gm-v1`, both sides.** Two records with that id, different names, different `updatedAt`. Assert the preview carries both sides' counts and that the write produces two whole campaigns with two distinguishable names.
8. **quota.** `add` rejects with `QuotaExceededError`. Assert `kind === 'write-failed'`, the message quotes it, and the file text was never mutated.
9. **the character store is never touched.** `CampaignImportDeps` has no character accessor, asserted at the type level *and* by a source-text assertion (in `backupSeam.test.ts`'s style) that `src/store/campaignImport.ts` imports neither `putCharacter` nor `importCharacters` nor `state.ts`. Plus: a file whose party row id equals a character in an injected local library imports with `sheet`, `importedAt`, `tracks` and `markedAt` byte-identical.
10. **the frozen v1 file walks all the way through the store path.** Read `tests/fixtures/schema/v1.dhcampaign` (committed, 3,759 B, envelope and payload both stamped 1), run it through `importCampaignText`. Assert the record on the fake disk comes back stamped `CAMPAIGN_SCHEMA_VERSION` (never the literal 4), five session rows in order, `fear === 7`, `board.environmentRef === 'raging-river'`. **Green today at 4, green at 5 without an edit.**
11. **a file from a build ahead of this one is refused, and `add` is never called.** Assert the `ImportError` text matches `/newer version of the app.*Update the app/s` and `add` call count is 0.
12. **two importers of one file produce two whole campaigns and destroy neither** (concurrent `applyCampaignImport` against one fake store).
13. **the retry ceiling.** `add` returns `'taken'` three times running. Assert `kind === 'write-failed'` rather than an infinite loop.

### `tests/store/campaignDb.test.ts` (lane A, appended)

14. `addCampaign` returns `'added'` on a free id and `'taken'` on an occupied one, leaving the occupant byte-identical. 15. It returns `'taken'` on an id held by a quarantined record. 16. A non-`ConstraintError` write failure is **thrown**, not swallowed as `'taken'`. *Kills: catching every error as `'taken'`, which would silently drop imports.*

### `tests/store/campaignFile.test.ts` (lane A, NEW block appended at the end)

17. A checksum-correct payload that is not an object comes back as `ImportError` matching `/is not a campaign record at all/`. 18. A checksum-correct payload with no `id` comes back as `ImportError` matching `/has no id/`. 19. A payload whose own `schemaVersion` is ahead of the envelope's comes back as `ImportError`, not as a raw `SchemaError`. 20. `ImportedCampaign.schemaVersion` equals the envelope's stamp for `v1.dhcampaign` (1) and for a file this build writes (`CAMPAIGN_SCHEMA_VERSION`). *Kills: removing the try/catch at `:155`; kills reading `schemaVersion` off the record instead of the envelope.*

### `tests/gm/gmSave.test.tsx` (NEW, lane A)

21. **SAVE no longer says a campaign file cannot be read back in** — assert the retracted sentence is absent from the rendered sheet. 22. A landed import names the campaign and the sheet's ALREADY ON THIS DEVICE stamp is now about it. 23. A cancelled picker changes nothing and says nothing. 24. Every warning in the preview is rendered on its own line, verbatim (assert count, not just presence — *kills: counting warnings instead of naming them*).

### `tests/store/backup.test.ts` (lane B)

**Do this first, before any other backup assertion:** `fakeFolder` at `:46-70` sets `files.set('latest', text)` and its `getFileHandle` **takes no arguments**. It cannot tell two files apart, so every multi-file assertion below is vacuous until it becomes `getFileHandle: (name) => …` keyed on the name. Add `listCampaigns` to the injected `deps()` helper at `:35-43`.

25. One changed campaign produces one dated `.dhcampaign`; two produce two files under two names. 26. Two campaigns with **identical names and different ids** produce two distinct keys. *Kills: dropping the crc8 from the file name.* 27. A campaign whose checksum matches the record is skipped, and skipping it does not stop the `.dhbackup`; and the converse. *Kills: the global fingerprint gate.* 28. A campaign that fails to write leaves `prefs.lastBackupAt` unchanged, sets `lastError` naming that campaign, `backupStatus().level === 'failing'` — while the characters still landed. 29. Zero characters plus one campaign still writes and the reason does **not** say "no characters to back up". 30. Zero of both says "There is nothing to back up yet." 31. A folder that returns different bytes is not counted (extends the existing `.dhbackup` case through the campaign `verify`). 32. A campaign file whose bytes were edited fails the CRC through `verify` and is not counted. 33. **The seven-day check names a campaign that is gone.** 34. **A quarantined campaign is NOT reported missing and does NOT block the stamp.** *Kills: dropping the union — and this is the case the 4→5 bump creates, so it is the most valuable test in the file.* 35. A campaign store that throws does not overwrite `knownCampaignIds` with an empty list. 36. On a device with no folder, `saveTextFile` is called **exactly once** and the reason names the campaigns that are not in the backup. *Kills: firing N share sheets.*

### `tests/store/campaignBackup.test.ts` (NEW, lane B)

37. **The cross-bump proof.** Read the new frozen `tests/fixtures/schema/v4.dhcampaign`, run `parseCampaignFile`. Assert (a) no throw, (b) `campaign.schemaVersion === CAMPAIGN_SCHEMA_VERSION`, (c) `campaign.party[0].sheet.schemaVersion === SCHEMA_VERSION`, (d) every schema-4 field survives apart from the stamp. Passes trivially today; the day `CAMPAIGN_SCHEMA_VERSION` becomes 5 it either walks the new `from: 4` converter or goes red. 38. A record stamped one *below* current comes back with its `schemaVersion` moved (proves `applyChain` is reached). 39. A record stamped one *above* current is refused with `checkReadable`'s sentence, not truncated. 40. `campaignBackupFileName` is deterministic and filesystem-safe for a name that slugifies to `''`.

### `tests/store/backupSeam.test.ts` (lane B, source-level)

41. `backup.ts` imports **nothing** from `src/ui/gm/gmStore.ts`. *Kills the code-split regression that would hydrate campaigns for every player at launch.* 42. `runBackup`'s campaign source is `currentCampaigns`, not `readCampaigns`. *Kills the fatal from §0.* 43. `integrityCheck` and `noteSession` still read the disk for campaigns as well as characters.

### `tests/gm/gmStore.test.ts` (lane B)

44. **`snapshotCampaigns` returns the gathered live board when `dirty`, and the stored record when not.** Make a change, do not flush, assert the snapshot holds it and `readCampaigns()` does not. *Kills the fatal directly.* 45. The snapshot's `updatedAt` equals the stored `updatedAt` — it does not invent a time. *Kills: `gather(c, state, new Date().toISOString())`, which would also make an `updatedAt` fingerprint look changed on every trigger.* 46. `exportActiveCampaign` records `{lastCopyAt, route}` on `ok` and does **not** set the campaign's skip checksum. *Kills: trusting a share sheet as a verified write.*

### Gate before pushing

```
. ./env.sh && npx tsc --noEmit
npx vitest run tests/store/campaignImport.test.ts tests/store/campaignFile.test.ts \
  tests/store/campaignDb.test.ts tests/store/campaignSchema.test.ts \
  tests/store/backup.test.ts tests/store/backupFolder.test.ts tests/store/backupSeam.test.ts \
  tests/store/campaignBackup.test.ts tests/store/import.test.ts \
  tests/gm/gmStore.test.ts tests/gm/gmSave.test.tsx tests/harness/orphans.test.ts
```
`backupFolder.test.ts` re-imports `backup.ts` under `vi.resetModules()`, so it is the test that catches an import lane B should not have added. Run the repo's own Node 24 via `env.sh`, not the system Node 26 — jsdom loses `localStorage` there and `backup.ts` is a localStorage module end to end, so a green local run under 26 is weaker than CI's.

**`tests/harness/orphans.test.ts` is a gate, not a formality.** Every new export must be reachable from `src/` **in the same commit**: this repo has shipped a whole subsystem switched off — `installBackupHooks`, `integrityCheck` and `noteSession` had no caller in `src` and Rollup tree-shook the regime out of the bundle while Settings told the user copies were being written. Lane A's new exports are all reached by `TakeIn.tsx` ← `SaveSheet.tsx`; lane B's are reached by `backup.ts` and `gmStore.ts`. **No `DELIBERATE` entry is added by either lane.** Note that this work makes `parseCampaignFile` reachable from `src/` for the first time — verified there is no allowlist entry for it today (`grep -n campaignFile tests/harness/orphans.test.ts` → none), so nothing goes stale.

---

# 7. Not in scope

- **`shared/campaigns.ts`, in any form.** Owned by the 4→5 scene lane. Import-only here.
- **The 4→5 converter itself, and any assertion in `tests/store/campaignSchema.test.ts`.** That file's `missingConverters` test is already the net under the bump; adding to it is the collision this work must not create.
- **Any overwrite verb — TAKE THEIRS, replace-if-newer, `putCampaign` from an import path.** Refused by name, not left unbuilt. Reasons: `merge.ts:18-21` (a wall clock decides nothing about a record holding a season), `campaigns.ts:117-119` (a campaign carries copies of sheets belonging to people not in the room), and the reversible outcome — two campaigns, MENU's armed REMOVE — is strictly safer. **Named cost:** importing the same file twice makes two campaigns, counting up as `(imported)`, `(imported 2)`. Annoying, never destructive.
- **Merging two campaigns.** Refused by name, citing `gmStore.ts:693-698`.
- **A fifth format (`.dhcampaigns`, or a `.dhdevice` holding both schemas).** It is the right answer for iOS — one gesture, one file, every table — and it is a lane of its own, because two schemas in one envelope needs its own version policy and a second door past `campaignFile.ts:15-17`'s "exactly one way in". Recorded here as a decision, not an omission: the day the iOS manual route needs to cover N campaigns in one gesture, that is the shape, and it starts by answering how one envelope carries a campaign version and a character version without one drifting behind the other.
- **Pruning old backup files.** A delete in the backup subsystem is a lane with its own argument: the folder belongs to the user, the character backup has never deleted a file, and a delete bug there destroys the only copies. If it ever ships it is a manual "tidy old backups" verb in Settings that lists what it would remove — never `removeEntry` on `pagehide`.
- **Listing the backup directory to offer "restore the newest".** New API surface whose only value is in the case where the folder handle survived eviction — which is not the case the restore exists for.
- **Refreshing a party row from the local `characters` library, in either direction.** §1b. This is a prohibition, not a deferral.
- **Fixing `listCharacters` (`db.ts:305`) dropping quarantined characters.** The character integrity check has the same latent false alarm the campaign union closes, and it self-heals after one launch because `noteSession` drops the same id — but it fires once. **Observed, named here, and left to its own lane** rather than fixed by a backup change.
- **Two tabs colliding on `createWritable()`'s lock in the folder.** `backup.ts:348` guards within one tab only; this lane multiplies the number of files that can hit it. The dated file name means only today's copy can be spoiled and `verify` catches a bad one. Not fixed here.
- **`Prefs` versioning.** `lastBackupAt` becomes a two-file claim, so a device that downgrades to a build without the campaign leg reads the same stamp and reports a backup that only covers characters. Mitigated honestly — the sentence beside the stamp names both files, so the claim degrades to a stale sentence rather than a false one.
- **Ergonomics measurement.** No new tap target in Settings and no layout change there, so nothing is owed. **SAVE grows from two blocks to three and is owed one measured pass in Chrome at 393×852 against the rig in `AUDIT-HANDOFF.md`** before it is called finished: the longest state-5 preview (two records, four counts each, one warning per dropped party row) can run past a screen, and the sheet's root already scrolls (`SaveSheet.tsx:167`) so nothing clips — but the verb then sits below a scroll the thumb has travelled. Read-above/touch-below and wrap-don't-shrink are the mitigation; the measurement is still owed.