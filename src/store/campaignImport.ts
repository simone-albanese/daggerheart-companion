/**
 * What becomes of a campaign that has arrived from a file.
 *
 * `campaignFile.ts` reads the bytes and refuses the ones it cannot vouch for.
 * This module answers the question that is left: there is a whole table in
 * memory, and a device that already has campaigns on it - now what. It is pure,
 * takes its four capabilities as an argument the way `LegacyDeps` does, and
 * knows nothing about React, zustand or `gmStore`. `TakeIn.tsx` is the door;
 * this is the decision behind it, and the split is so the decision can be tested
 * without a screen and without IndexedDB.
 *
 * ## Add-only. There is no overwrite verb, and that is the whole design.
 *
 * `addCampaign` refuses an occupied key. A file whose id is already here lands
 * *beside* the record that holds it, under a fresh UUID and a minted name, and
 * the record that was here is not read, not compared and not touched. So the
 * destructive outcome is unreachable rather than carefully avoided, and the
 * reversible one - two campaigns in MENU, either removable - is what a mistake
 * costs.
 *
 * The alternative was considered and refused by name: no TAKE THEIRS, no
 * replace-if-newer, no `putCampaign` from this path. A campaign record holds
 * `archive`, `register` and whole copies of sheets belonging to people who are
 * not in the room, and `merge.ts` already records what an in-place restore did
 * to a character - "restoring an August backup overwrote the September
 * character in place, with no prompt, no undo and no history". One record class
 * up, with somebody else's season inside it, is not the place to re-propose it.
 *
 * ## `campaign.id` IS NEVER PROOF OF IDENTITY
 *
 * `campaignMigration.ts` mints every upgraded device's first campaign under the
 * fixed string `LEGACY_CAMPAIGN_ID`, and gives it the shared
 * `FIRST_CAMPAIGN_NAME`. Two GMs who both came off the localStorage build
 * therefore collide on *both*, by construction, on the first table either of
 * them ever had. Nothing here reads id equality as "this is the same table",
 * and any future sync, dedupe or "you already have this" shortcut that does
 * inherits that bug. Same id means one thing only: the key is taken.
 *
 * ## `updatedAt` decides what the preview SAYS, never what happens
 *
 * `merge.ts` already calls it "a wall clock on whichever device wrote it". For
 * one character it decides one sheet's edits. For a campaign, "the file is
 * newer" does not mean the device's copy is a subset of it: the two diverged the
 * moment the file was written, and the copy here may hold three sittings the
 * file has never seen. So it is printed and never branched on.
 *
 * ## Every id except the key is kept byte-identical
 *
 * Only `campaign.id` can collide, because only it is a key of an object store.
 * Session rows, countdowns, archived sittings and their items, register
 * entries, combatants and party rows are all scoped to the campaign, and a
 * blanket remap is prohibited rather than merely unnecessary: `readCampaignRecord`
 * repairs two pointers into the session list - a countdown's `sceneId` and
 * `board.liveScene` - by naming a row id, so renumbering rows would detach the
 * parked fight and every scene clock and report it as data the file no longer
 * has. The archive duplicating live row ids is deliberate too: an archived
 * sitting is a copy of the rows as they stood at closing.
 *
 * ## The `characters` store is unreachable from here, at the type level
 *
 * `CampaignImportDeps` has no character accessor of any kind, and this module
 * imports nothing from the character half of `db.ts`. A party row is a
 * *sighting*, not a subscription: it is never refreshed from the local library
 * (that would claim the GM was handed a newer sheet they were never handed, and
 * put an invented date on a row the board prints ages against) and it is never
 * written into `characters` (that would put another player's character into the
 * owner's own header `<select>`). Staleness is shown by the preview and repaired
 * by the verb `readPartyMember` already prints. There is no spy asserting this -
 * there is no function to call.
 *
 * ## `aside` cannot hold a landed id, and the day that stops being true
 *
 * `gmStore`'s `aside` queue receives ids only from `patchCampaign` and from
 * `hydrateGm`'s repair loop, both for records already in `state.campaigns`. An
 * id that `add` accepted was demonstrably absent from the store, so it cannot be
 * in `aside` and a queued write cannot land on top of the import. **This holds
 * because the path is add-only.** Add a verb that writes onto an id already on
 * this device and `writeAside` fires on that id, `writeAll` reports success, and
 * the campaign the GM just brought in is gone under the board they were on.
 *
 * ## Nothing here throws
 *
 * `applyCampaignImport` returns an outcome in every branch, including a
 * `QuotaExceededError` and including a `deps` that misbehaves. The screen on the
 * other side has three sentences and no fourth; a rejection escaping into it
 * would be a spinner that never stops over a write that may well have landed.
 */
import { CAMPAIGN_SCHEMA_VERSION, type Campaign } from '../../shared/campaigns.ts';
import type { ImportedCampaign } from '../transfer/campaignFile.ts';
import { stable } from './campaignMigration.ts';
import { CAMPAIGN_NAMES, freeName, nameHolder, spokenName, type Named } from './names.ts';

/** The pieces this needs from the device, so a test can supply its own. */
export interface CampaignImportDeps {
  /** `store/campaigns.ts::addCampaign`. There is deliberately no `put` here. */
  add: (c: Campaign) => Promise<'added' | 'taken'>;
  /** `store/campaigns.ts::getCampaign`. Read-back, and nothing else. */
  read: (id: string) => Promise<Campaign | null>;
  newId: () => string;
  now: () => string;
}

/** Everything the screen needs to describe a file before anything is written. */
export interface CampaignImportPreview {
  /** Exactly what `readCampaignRecord` produced. Not the file's raw payload. */
  incoming: Campaign;
  app: string | null;
  exportedAt: string | null;
  /** The ENVELOPE's stamp, not the record's - the record has been restamped. */
  schemaVersion: number;
  converted: boolean;
  /** `readCampaignRecord`'s, verbatim, in order. Rendered, never counted. */
  warnings: string[];
  counts: { session: number; archive: number; register: number; party: number };
  /** The oldest `PartyMember.importedAt` in the file, or null when nobody has one. */
  oldestPartyImportedAt: string | null;
  /** Informs the sentence. Never decides anything. */
  localSameId: Campaign | null;
  quarantinedSameId: boolean;
  /** `freeName`'s answer, or null when nothing here answers to that name. */
  mintedName: string | null;
  /** Every campaign here, for a re-mint if the id turns out to be taken. */
  taken: readonly Named[];
}

export type CampaignImportOutcome =
  | {
      kind: 'landed';
      campaign: Campaign;
      /** The id was taken, so this arrived beside what held it. */
      asCopy: boolean;
      /** The name it came in under, when it had to be minted. */
      renamedFrom: string | null;
      warnings: string[];
    }
  | { kind: 'write-failed'; message: string }
  | { kind: 'not-verified'; campaign: Campaign; message: string };

/**
 * How many times an id is offered before this gives up.
 *
 * The first offer is the file's own id. Every one after it is a fresh UUID, and
 * a fresh UUID colliding is not reachable in practice - it is specified so that
 * it is not *discovered*, by somebody reading a loop with no ceiling in it at
 * three in the morning.
 */
const ATTEMPTS = 3;

/** The oldest sheet in the party, by the date it was handed over. */
function oldestHandover(campaign: Campaign): string | null {
  let oldest: string | null = null;
  for (const member of campaign.party) {
    const at = member.importedAt;
    if (at === '') continue;
    if (oldest === null || at.localeCompare(oldest) < 0) oldest = at;
  }
  return oldest;
}

/**
 * Whatever went wrong, in one clause a sentence can hold.
 *
 * By `.name` and `.message` rather than `instanceof`, for the reason
 * `addCampaign` gives: an IndexedDB rejection is a `DOMException` whose class
 * depends on which global made the request, and the name is the part that
 * survives the crossing. `QuotaExceededError` is the word the GM needs; losing
 * it to "an error occurred" is losing the only actionable thing in the sentence.
 */
function why(error: unknown): string {
  const e = error as { name?: unknown; message?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : '';
  if (name !== '' && name !== 'Error') return message === '' ? name : `${name}: ${message}`;
  return message === '' ? String(error) : message;
}

/**
 * Everything worth reading about a file, before a single byte is written.
 *
 * The preview exists because the reader's warnings include the dropped-party-row
 * sentence, which names a player whose sheet will not be on the board. Reading
 * that *after* the record has landed is counting instead of naming, which is the
 * failure the campaigns store was written against. It is not a confirmation
 * dialog for a destructive act - there is no destructive act on this path.
 *
 * `nameHolder` is asked with NO `except`. Every other door passes the record
 * being renamed, so that a rename does not collide with itself; here there is no
 * such record. Add-only always creates a *second* row, so the campaign that
 * shares the arriving id is exactly the one that must be collided against - it
 * is about to be sitting next to it in the same list.
 */
export function previewCampaignImport(
  parsed: ImportedCampaign,
  here: { campaigns: readonly Campaign[]; quarantined: readonly { id: string }[] },
): CampaignImportPreview {
  const incoming = parsed.campaign;
  const taken: Named[] = here.campaigns.map((c) => ({ id: c.id, name: c.name }));
  const holder = nameHolder(incoming.name, taken, CAMPAIGN_NAMES);

  return {
    incoming,
    app: parsed.app,
    exportedAt: parsed.exportedAt,
    schemaVersion: parsed.schemaVersion,
    converted: parsed.schemaVersion !== CAMPAIGN_SCHEMA_VERSION,
    warnings: parsed.warnings,
    counts: {
      session: incoming.session.length,
      archive: incoming.archive.length,
      register: incoming.register.length,
      party: incoming.party.length,
    },
    oldestPartyImportedAt: oldestHandover(incoming),
    localSameId: here.campaigns.find((c) => c.id === incoming.id) ?? null,
    quarantinedSameId: here.quarantined.some((q) => q.id === incoming.id),
    mintedName:
      holder === undefined
        ? null
        : freeName(incoming.name, taken, CAMPAIGN_NAMES, { suffix: 'imported' }),
    taken,
  };
}

/**
 * Write the campaign the preview described, and prove it arrived.
 *
 * ## The name is minted, never refused
 *
 * There is nobody at a keyboard to refuse to - the GM is holding a file, not
 * typing a name - and dropping somebody's table over a name is the worst answer
 * on the list. So a collision counts up, "X (imported)", "X (imported 2)", and
 * the outcome carries `renamedFrom` so the screen can say both halves. On a
 * `'taken'` where the preview saw the name as free - another tab landed one in
 * between - it mints anyway: two rows a GM cannot tell apart is the failure
 * `names.ts` exists to stop, and it does not become acceptable because it
 * arrived through a race.
 *
 * ## What changes on the copy path, and what deliberately does not
 *
 * `id` becomes a fresh UUID and `createdAt` becomes now, because this record
 * really was created on this device just now and there is a second record
 * holding the original id. `updatedAt` is left exactly as the file carried it -
 * `duplicateFor`'s reasoning, one record class up: rewriting it would make the
 * arriving copy look newer than the one it was judged against, and
 * `readCampaigns` sorts the list on that field. On the *plain* path nothing at
 * all is rewritten, `createdAt` included: a restore that does not give back what
 * was backed up is worse than any collision.
 *
 * ## Write, read back, compare - against the reader, not against the file
 *
 * `readCampaignRecord` legitimately renumbers `order`, clamps Fear, sorts the
 * archive by `closedAt` and drops an unwhole party row. Comparing what came back
 * to the file's payload would therefore fail every import that had a warning.
 * What is checked is the only claim being made: *the record I decided to write is
 * the record now on the disk*. Through `stable()` and not `JSON.stringify`,
 * because a structured clone is not obliged to preserve key order; and not
 * through a checksum or a count, because a count is exactly what would pass.
 *
 * **A disagreement leaves the record and names it.** This app does not delete
 * what it could not read, `deleteCampaign` can itself throw, and a record that
 * came back different is far more likely a reader disagreement than a corrupt
 * write. There is no delete in `CampaignImportDeps`, so this is a guarantee of
 * the type and not of this function's good manners.
 */
export async function applyCampaignImport(
  preview: CampaignImportPreview,
  deps: CampaignImportDeps,
): Promise<CampaignImportOutcome> {
  try {
    const original = spokenName(preview.incoming.name, CAMPAIGN_NAMES);
    let minted = preview.mintedName;
    let candidate: Campaign =
      minted === null ? preview.incoming : { ...preview.incoming, name: minted };
    let asCopy = false;

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const answer = await deps.add(candidate);

      if (answer === 'added') {
        let back: Campaign | null;
        try {
          back = await deps.read(candidate.id);
        } catch {
          back = null;
        }
        if (back === null) {
          return {
            kind: 'not-verified',
            campaign: candidate,
            message: 'could not be read back afterwards',
          };
        }
        if (stable(back) !== stable(candidate)) {
          return {
            kind: 'not-verified',
            campaign: candidate,
            message: 'did not come back the same when it was read again',
          };
        }
        return {
          kind: 'landed',
          campaign: candidate,
          asCopy,
          renamedFrom: minted === null ? null : original,
          warnings: preview.warnings,
        };
      }

      asCopy = true;
      minted ??= freeName(preview.incoming.name, preview.taken, CAMPAIGN_NAMES, {
        suffix: 'imported',
      });
      candidate = { ...candidate, id: deps.newId(), name: minted, createdAt: deps.now() };
    }

    return {
      kind: 'write-failed',
      message: `${String(ATTEMPTS)} ids in a row were already taken on this device`,
    };
  } catch (error) {
    return { kind: 'write-failed', message: why(error) };
  }
}
