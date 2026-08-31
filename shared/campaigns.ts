/**
 * A campaign: what the GM brings to the table, and what it is stored as.
 *
 * ## Why this exists at all
 *
 * Until now the whole of the GM's state was one `dhc.gm.v1` key in
 * localStorage, rewritten synchronously on every `+1` of Fear. That store is
 * the least durable thing the platform has - iOS clears it first, the ceiling
 * is about five megabytes for the origin's whole share of it, and every write
 * blocks the tap that caused it. `src/ui/gm/party.ts` says out loud that a
 * `PartyMember` holds `sheet: Character`, the player's entire sheet, stored
 * whole and on purpose. So the app was keeping other people's characters in
 * the one place Architecture 6 spends a page explaining is not safe to keep
 * anything in.
 *
 * Campaigns therefore get an IndexedDB object store of their own, beside
 * `characters`, and this module is its data model.
 *
 * ## What a campaign owns, and what it deliberately does not
 *
 * It owns its name, its session list, its Fear, its countdowns (as items in
 * that list, one of which may be primary), its imported party and the live
 * board in front of the GM right now.
 *
 * It does **not** own the characters the user plays. Those stay in
 * `characters` and in the header, untouched, and no `campaignId` is added to
 * `Character`. Two consequences, both wanted: a sheet can sit in two campaigns
 * without either one contradicting the other, and switching campaign can never
 * cost anybody a character, because switching campaign does not touch that
 * store at all.
 *
 * ## Its own version, its own chain
 *
 * `SCHEMA_VERSION` in `shared/types.ts` governs `.dhchar`, `.dhbackup` and the
 * `characters` store. It is deliberately *not* bumped for this: a campaign is
 * a different record in a different store with a different history, and
 * folding it into the character version would mean every future campaign
 * change forced a character migration, and every character fixture would have
 * to be rewritten for a field no character has.
 *
 * So there is a second number here - and, per Architecture 6.1, exactly the
 * same policy around it rather than a second policy. The machinery is the one
 * in `shared/migrations.ts`: same `Migration` shape, same one-step-at-a-time
 * chain, same two refusals at the ends, same test asking what would be missing
 * if the constant went up by one.
 *
 * ## The first bump, and what it is actually for
 *
 * `CAMPAIGN_MIGRATIONS` was empty until 2026-08-18, and its emptiness was
 * argued here at length: the machinery had to be in place before the first
 * bump, because after it it is too late. That argument was right and it has
 * now been cashed. The version is 5 now and the chain has four entries; this
 * section is about the first of them, and each of the other three argues for
 * itself at its own entry below. This read "the version is 2, and the chain has
 * one entry in it" until 2026-08-31, having gone stale three bumps earlier - a
 * bare present tense in a paragraph about a number whose whole job is to move.
 *
 * **The converter changes no field, and that is the point rather than an
 * embarrassment.** A v1 record is not wrong. Nothing in it needs repairing,
 * nothing in it is missing, and this build reads every byte of one correctly.
 * The version moved so that **old builds refuse new records**, which is a thing
 * only the *number* can do:
 *
 * `readSessionItem` wraps a row whose `kind` it does not know as `unreadable` -
 * on purpose, so the row is kept and named rather than dropped. But `gmStore`
 * writes the campaign back 400ms later, and what it writes back is the reading.
 * A build that predates the `url` and `note` rows would therefore open a
 * campaign written by this one, wrap two good rows as unreadable, and *save
 * that*. The GM loses a row they can still see on the newer device, and nothing
 * anywhere says why. Bumping the number turns that path off at the top:
 * `readCampaigns` quarantines a record stamped above its own build's version
 * and never reaches the reader, `putCampaign` and `deleteCampaign` throw
 * `StaleBuildError` rather than writing over one, and the old build says out
 * loud that it is the old build.
 *
 * That is the whole justification, and it is why one bump covers both the URL
 * row and the note row rather than one bump each: two new kinds create exactly
 * one hazard, and the hazard is answered once.
 */
import { readExternalUrl } from './externalLink.ts';
import {
  applyChain,
  checkReadable,
  migrateCharacterRecord,
  versionOf,
  type Migration,
  type MigrationResult,
} from './migrations.ts';
import { readNoteDoc, type NoteDoc } from './richText.ts';
import {
  MAX_FEAR,
  TRAITS,
  type Countdown,
  type CountdownKind,
  type EncounterAdjustments,
  type PartyMember,
  type PartySource,
  type PartyTracks,
  type Ref,
  type RosterEntry,
  type SceneCombatant,
  type Tier,
} from './types.ts';

export const CAMPAIGN_SCHEMA_VERSION = 5;

/**
 * The lowest campaign schema any build has ever written.
 *
 * One, because that is where this schema started: unlike `OLDEST_READABLE`,
 * which is 3 in order not to invent a history to be compatible with, there is
 * genuinely nothing older here.
 *
 * It stays 1 across the bump to 2, exactly as `OLDEST_READABLE` stayed 3
 * across P1-7, and it stays 1 across the bump to 3 for the same reason. Every
 * campaign already in an IndexedDB and every `.dhcampaign` already on a disk is
 * a schema-1 or schema-2 record, and 1 is precisely the version the chain below
 * still starts from.
 *
 * It stays 1 across the bump to 4 as well. Nothing older than 1 exists, and no
 * schema-1 field changes in that bump either - the two fields it adds are new
 * ones, and both readers below supply `null` for them.
 *
 * It stays 1 across the bump to 5, and that bump is the first where the second
 * half of the sentence above does not hold: `board.combatants` is a schema-1
 * field and this bump takes it away. That changes nothing here, because this
 * constant is a fact about what has been WRITTEN and never about what survives
 * a read. Every campaign in an IndexedDB and every `.dhcampaign` on a disk is a
 * v1-v4 record, the chain below still starts at 1, and its fourth entry is
 * precisely what carries a schema-1 field across its own removal. Raising this
 * to 2 would make `checkReadable` tell a GM holding one of those files that no
 * released version of this app has ever written schema 1, which is false.
 */
export const OLDEST_READABLE_CAMPAIGN = 1;

/**
 * The chain, one entry per campaign schema this build has left behind.
 *
 * **A converter may MOVE. It may not INVENT and it may not REINTERPRET.**
 *
 * That is the rule, and it is written as a rule because the first three entries
 * were never enough to need one. *"All three entries are deliberately empty of
 * work, and that is the point rather than an omission"* stood here, and it was
 * true of those three and read as the policy when it was only ever the
 * arithmetic: no field was renamed and none was dropped in any of those bumps,
 * so the honest converter was the one that copied and said why. The `from: 4`
 * entry moves a fight off the board and onto the row it was fought in. It is
 * the first that has to be judged rather than counted, and this is what it is
 * judged against.
 *
 * Three tests separate a move from a repair. An entry that fails any of them
 * does not belong in this chain:
 *
 * 1. **Could a reader supply it?** If yes, the reader supplies it and this
 *    chain does not - a default written in two places is one place nobody
 *    notices has gone stale, which is the `from: 2` entry's rule and the whole
 *    reason the first three are copies. If no, what the converter carries is
 *    *data*, not a default, and the readers below still decide what it means.
 * 2. **Does it decide what the record means?** A converter may not change the
 *    kind of a thing the GM named, nor a name, an id, a count or a mark. The
 *    `encounter` arm below refuses exactly that, in its own words, and the next
 *    migration that wants to rewrite somebody's data will cite whatever this
 *    chain did.
 * 3. **Is there anywhere else it could be done?** A key that goes away has
 *    exactly one place its contents can cross, and that place is here. Doing it
 *    in `readCampaignRecord` instead would mean the reader keeps naming the
 *    dead key for ever - the field hidden rather than deleted, the whole
 *    simplification undone - and the move re-running on every read instead of
 *    once.
 *
 * Underneath all three, a converter in this chain exists to make an *older*
 * build refuse a record it would otherwise truncate in silence. That has not
 * changed, and it is why an entry that has nothing to do is still an entry.
 *
 * The 2 -> 3 entry carries the largest of the truncation hazards, and it is
 * worth being exact about what a schema-2 build would do to a schema-3
 * campaign if the version had not moved. Every reader in this file rebuilds
 * its object field by field and drops what it does not name, so that build
 * would not fail - it would succeed, quietly, and then write its reading back
 * on the next 400 ms save:
 *
 * - a `scene` row's `roster`, `adjustments` and `combatants` - **the fight**
 *   - erased, because a schema-2 `scene` arm names only `environmentRef`;
 * - a countdown's Activation / Advancement / Effect, its owner and every
 *   per-tick beat - erased by `readCountdown`;
 * - `archive` and `register` - **every closed sitting and the whole durable
 *   record** - erased by `readCampaignRecord`, which builds a `Campaign`
 *   literal naming its own keys.
 *
 * That is a GM losing a season of notes by opening their campaign on a device
 * that has not updated. `checkReadable` turns it into a sentence asking them to
 * update instead, which is the entire job of the number.
 *
 * The `from: 4` entry's hazard is not that shape at all, and it is argued where
 * it lives rather than here: what moves the number there is a *newer* record
 * that an older build reads successfully, plays, and then destroys.
 */
/**
 * A raw record's own object, or an empty one.
 *
 * Local to the chain rather than the reader's `isRecord` far below in the
 * reading half of this file. The converter runs on bytes and the reader runs on
 * a reading, and the chain - the block in here that gets read most and edited
 * least - should not forward-reference a helper whose job is the other half.
 */
const chainRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * The id the `from: 4` converter gives a fight whose row is gone.
 *
 * A literal and NOT `crypto.randomUUID()`, for two reasons that are both
 * load-bearing.
 *
 * The chain is pure, and `tests/store/campaignSchema.test.ts` asserts it by
 * walking a frozen fixture forward and requiring `JSON.stringify` equality -
 * which a fresh uuid per run makes unassertable.
 *
 * And `readCampaigns` hands a version-moved record to `scheduleAside` to be
 * written back. If that write fails - quota, a private window, a device with no
 * room - the converter runs again on the next launch, and a random id would
 * mint a *second* row holding a *second* copy of the same fight, every time.
 * `LEGACY_CAMPAIGN_ID` in `src/store/campaignMigration.ts` is this repo's
 * precedent and gives this exact argument for this exact failure.
 */
const RESCUED_FIGHT_ROW = 'board-fight-v4';

/**
 * `RESCUED_FIGHT_ROW`, or the first free suffix of it in this session list.
 *
 * The stable id above is only stable if nothing else already answers to it, and
 * a record converted, written back, hand-edited and converted again is a way it
 * could. Colliding would give the list two rows with one id, which the reader
 * repairs by re-numbering - so the cost is not corruption, it is the rescued
 * fight arriving under an id nothing points at. Cheaper to not collide.
 */
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

export const CAMPAIGN_MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    note: 'the session list gained a URL row and a note row; no schema-1 field changed',
    /*
     * A copy, not the same object, and not a no-op returning its argument.
     *
     * `applyChain` hands the result on and `migrateCampaignRecord` spreads a
     * `schemaVersion` onto it; returning `r` itself would let that spread be
     * the only thing standing between a caller's record and being restamped in
     * place. One object allocation is a cheap price for the chain staying pure,
     * and purity is what `tests/store/campaignSchema.test.ts` can actually
     * assert - it reads the frozen v1 fixture, walks it forward, and requires
     * every field to come back identical apart from the stamp.
     */
    apply: (r) => ({ ...r }),
  },
  {
    from: 2,
    note: 'the scene row absorbed the fight, countdowns gained the triad, and the campaign gained an archive and a register; no schema-2 field changed',
    /*
     * A copy, for the reason the entry above gives at length.
     *
     * Nothing here seeds the new fields either, and that is not laziness: the
     * readers below already supply every default on the way in - `[]` for a
     * scene's roster, `''` for each of the triad, `[]` for the beats and for
     * both new campaign arrays. Seeding them here as well would put the default
     * in two places, and the one in the converter would be the one nobody
     * notices has gone stale.
     */
    apply: (r) => ({ ...r }),
  },
  {
    from: 3,
    note: 'the board gained the scene its fight came from, and a countdown row gained the scene it belongs to; no schema-3 field changed',
    /*
     * A copy, for the reason the two entries above give at length, and seeding
     * nothing for the reason the `from: 2` entry gives: the readers below
     * already supply `null` for both new fields on the way in, and a default
     * written here as well is the one nobody notices has gone stale.
     *
     * What a schema-3 build would do to a schema-4 campaign, if the number had
     * not moved, is the hazard this entry exists for - and it is *not* the
     * hazard the entry above describes. A schema-3 build reads `board` field by
     * field (`readCampaignRecord` names its own keys) and reads each session
     * item through `readSessionItem`, which does the same. So it would not
     * fail: it would drop `board.liveScene` and every row's `sceneId` in
     * silence, `hydrateGm` would push the reading into `scheduleAside`, and
     * `writeAside` would persist the truncation on the next 400 ms save. The
     * GM would come back to a parked fight that belongs to no row and a set of
     * scene clocks that are all the campaign's again. `checkReadable` turns
     * that into a sentence asking them to update, which is the whole job of
     * the number.
     */
    apply: (r) => ({ ...r }),
  },
  {
    from: 4,
    note: 'the fight left the board and lives on the scene row it was being fought in; the board kept the builder’s workbench and which scene is open',
    /*
     * The first entry in this chain that does work, and it passes the three
     * tests the header states.
     *
     * (1) Could a reader supply it? No. `readSessionItem` supplies
     * `combatants: []` for a scene row that has none, and for a v4 record whose
     * fight is sitting in `board.combatants` that default is *wrong*. What this
     * carries is data. `[]` stays the reader's and stays the reader's alone.
     *
     * (2) Does it decide what the record means? No. No kind, no name, no id, no
     * count and no mark changes. `board.combatants` and a scene row's
     * `combatants` are the same type, written by the same writers and read by
     * the same `readCombatants`; the app itself copied a fight between the two
     * on every resume for as long as both existed. This performs that same park
     * once, on a record instead of on the glass.
     *
     * (3) Is there anywhere else? No. This is the first bump that DELETES a
     * key, and a key that goes away has exactly one place its contents can
     * cross.
     *
     * ## Why the number had to move, and it is a new shape of hazard
     *
     * Every bump before this one guarded against TRUNCATION by an older build.
     * This one guards against DESTRUCTION, and the loss lands on the *newer*
     * record read by the *older* build:
     *
     * 1. A schema-4 `readCampaignRecord` meets a schema-5 record.
     *    `board.combatants` is absent, so `readCombatants(undefined)` gives
     *    `[]`; `board.liveScene` is absent, so `null`. Every scene row reads
     *    whole. **It does not fail.**
     * 2. The screen is coherent-looking and wrong: an empty runner, and every
     *    scene row holding a fight offering to resume it, none of them current.
     * 3. The GM taps one. The schema-4 `runScene` EMPTIES that row into
     *    `board.combatants`, and the 400 ms debounce writes it.
     * 4. They open the campaign on a schema-5 build. The reader names its own
     *    keys and `combatants` is not one of them. **The fight, and every HP and
     *    Stress mark on it, is gone**, with nothing on any screen saying why.
     *
     * `checkReadable` turns all of that into one sentence asking them to update
     * the app, and the three doors behind it are already built: `readCampaigns`
     * quarantines, `putCampaign` and `deleteCampaign` throw, and
     * `parseCampaignFile` refuses the file as a *version* rather than as
     * damage.
     */
    apply: (r) => {
      const board = chainRecord(r['board']);
      const { combatants, liveScene, ...rest } = board;
      const fight = Array.isArray(combatants) ? combatants : [];
      // The pointer is CARRIED, not validated. Converters move; readers decide.
      const pointer = typeof liveScene === 'string' ? liveScene : null;
      const session = Array.isArray(r['session']) ? r['session'] : [];

      /*
       * (1) Nothing on the board. Rename the pointer, drop the two keys, touch
       *     nothing else. Every committed `.campaign.json` fixture takes this
       *     branch, which is why branches (2) and (3) need frozen fixtures of
       *     their own.
       */
      if (fight.length === 0) return { ...r, board: { ...rest, openScene: pointer } };

      /*
       * (2) The pointer names a scene row holding no fight of its own. That is
       *     the invariant the schema-4 `runScene` maintained on every resume, so
       *     it is the ordinary state of a v4 record with a fight on the glass.
       */
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
          session: session.map((i, k) => (k === at ? { ...chainRecord(i), combatants: fight } : i)),
          board: { ...rest, openScene: pointer },
        };
      }

      /*
       * (3) Everything else, and it is the fallback so that no input ends in a
       *     drop: no pointer at all; a pointer at a countdown, an `unreadable`
       *     or an `encounter` row; a pointer at a scene row that ALREADY holds a
       *     fight of its own. One row is minted and the board's fight goes into
       *     it, whole.
       *
       *     NEVER merged. A merge invents a fight that stood at no table, and
       *     `makeCombatant` mints `${adversaryRef}-${index}` from an index that
       *     restarts at 0 in every row - so `acid-burrower-0` is legal in the
       *     dungeon and in the forest at the same time, and a merge would put
       *     two bodies the runner cannot tell apart into one list.
       *
       *     Six keys and no more. `readSessionItem` supplies `roster`,
       *     `adjustments` and `collapsed` on the way in, and a default written
       *     here as well is the one nobody notices has gone stale - the `from:
       *     2` entry's rule, honoured rather than stretched.
       *
       *     `environmentRef` is SEEDED from the board on the MINTED row and
       *     nowhere else, which is what the schema-4 app did with the same
       *     input: a fight on the board belonging to no row got
       *     `newScene('', environmentRef)`. The rescue row is what `openScene`
       *     names, so without it the runner would draw no place for a fight
       *     that had one.
       *
       *     A row that already exists keeps its own place, which is why branch
       *     (2) writes `combatants` and nothing else. The schema-4 app refused
       *     to write the board's environment onto a row when it parked a fight
       *     there - a park that wrote the plan would let one row's
       *     `PUT THIS ENVIRONMENT ON THE BOARD` quietly rewrite another row's
       *     place - and an upgrade must not do what the app declined to do.
       */
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
  },
];

// ---------------------------------------------------------------------------
// The session list
// ---------------------------------------------------------------------------

/**
 * What a `link` row may point at.
 *
 * Every one of these is *inside the app*, and that is still true of this list
 * after 2026-08-18. What changed that day is that it stopped being true of the
 * session list as a whole: backlog item 12 added a `url` row, which is a
 * different kind of row and not a fifth entry here.
 *
 * ### What this docblock used to say, and which half of it survived
 *
 * It said "a link is never an external URL", and argued it: this app's
 * strongest claim is that it makes exactly one kind of network request and it
 * is same-origin, and a session list full of `https://` would quietly end that.
 *
 * **The claim about requests is unchanged and still exact.** A `url` row is a
 * string, and as this build ships it is only a string: `UrlArm` in
 * `src/ui/gm/UrlArm.tsx` draws the address as text and builds no anchor,
 * so there is nothing on it to tap yet. This app never fetches it, never
 * prefetches it, never resolves it, and never puts it in an `<img>`, a
 * `<script>` or an `<iframe>`; the one request the app makes is still the
 * same-origin one. The anchor belongs to a later lane, and when it lands,
 * opening a link is the *browser's* navigation in another tab, not this app's
 * request. So nothing about the offline story, the service worker, or "works
 * on a plane" moved.
 *
 * **What did not survive is the conclusion.** "A GM who wants a web page has a
 * browser" was true of a GM sitting at their own desk and false of the one this
 * app is for: the prep is in the app, the phone is on the table, and the
 * alternative to a stored link was retyping a Discord thread's address by hand
 * mid-session. The owner approved the row.
 *
 * ### What the reader guarantees instead
 *
 * The safety that sentence used to buy is now bought by `shared/externalLink.ts`
 * and bought *in the reader*, where nothing downstream can opt out of it: a
 * scheme allowlist, a length bound, credentials refused, the parser's own
 * normalised output stored rather than the sender's bytes, punycode shown
 * rather than hidden, and one function that owns `target` and `rel`. That file
 * enumerates all six and says which payload each one stops.
 */
export const LINK_KINDS = ['adversary', 'environment', 'domainCard', 'rule'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/**
 * A discriminated union rather than a `{ kind: string; ref: string }`, so that
 * a link this build cannot follow is a *value* the screen can render instead
 * of a hole where an item used to be.
 *
 * This repo has been bitten twice by refs being filtered away in silence - the
 * loadout dropping cards it could not resolve, and P1-6 - and the failure mode
 * is always the same: the user counts the rows, finds one fewer, and has no
 * way to learn which. So the fifth arm is not defensive clutter. It is the
 * only representation in which "this link points at something I do not know
 * about" can be drawn on screen at all.
 *
 * Note what it does *not* try to be: whether the ref resolves against the
 * dataset the GM has loaded today is a different question, asked at render
 * time by whoever holds the index, and answered without changing the record.
 */
export type LinkTarget =
  | { kind: 'adversary'; ref: Ref }
  | { kind: 'environment'; ref: Ref }
  | { kind: 'domainCard'; ref: Ref }
  | { kind: 'rule'; ref: Ref }
  /** A kind this build has no screen for. Kept, named, shown. */
  | { kind: 'unknown'; named: string; ref: Ref };

/**
 * The kinds ADD can mint. **Deliberately not `SessionItem['kind']`.**
 *
 * `AddSheet.tsx` builds its choices out of this list, so a kind in it is a
 * button on a screen and needs a factory, a form and a body to draw. It has
 * never been the same set as the union below - `unreadable` is a reading, not
 * a thing a GM can add - and since 2026-08-18 it is also short of every kind
 * whose form has not been built. Each of those joins this list in the lane
 * that builds its form, and not before: a kind here with nothing to mint is a
 * button on the sheet that does nothing, which is worse than a button that is
 * not there yet.
 *
 * The gap is not a spelling anybody has to keep in step. `ADD_FORMS` in
 * `AddSheet.tsx` is a `Record<SessionItemKind, …>`, so a kind added here with
 * no form does not compile and a form with no kind here does not compile
 * either; `tests/gm/session.test.ts` asserts the same thing at runtime, and
 * asserts the half of the gap that never closes - `unreadable` is never in
 * here. So it stays a decision rather than becoming an oversight, and it needs
 * no second edit when it narrows.
 *
 * **Two names are now permanently outside it rather than one.** `unreadable` is
 * a reading. `encounter` left at `CAMPAIGN_SCHEMA_VERSION` 3, when decision 1
 * gave the scene row the fight: the arm stays in the union because saved
 * campaigns carry it and it is still editable, but nothing may mint one, and
 * the way to say "no longer creatable" in this codebase is to not be in this
 * list. The compiler then removes the form for you - `ADD_FORMS` would not
 * typecheck with a row for a kind that is not here.
 */
export const SESSION_ITEM_KINDS = [
  'scene',
  'link',
  'url',
  'countdown',
  //
  // One kind per line, and the two seats deliberately apart. Item 12 and item
  // 14 are separate lanes, and this literal is the one line in this file both
  // of them have to widen - two insertions at one point in it is the merge
  // conflict the shape exists to avoid.
  //
  'note',
] as const;
export type SessionItemKind = (typeof SESSION_ITEM_KINDS)[number];

export interface SessionItemBase {
  id: string;
  /** The name the GM gave it. Never generated; an empty one stays empty. */
  name: string;
  /** Position in the list. Sparse and re-sorted on read, never trusted blind. */
  order: number;
  collapsed: boolean;
}

/**
 * One row of the GM's spine for a campaign.
 *
 * The first four kinds are the wireframe's. `unreadable` is the same idea as
 * the `unknown` link target one level down: an item this build cannot read is
 * kept exactly as it arrived, wrapped in something renderable, rather than
 * dropped from a list whose length the GM knows by heart.
 *
 * `url` and `note` arrived together on 2026-08-18, with
 * `CAMPAIGN_SCHEMA_VERSION` 2, and they are the reason it moved. See the header:
 * two new kinds create exactly one hazard - an older build wrapping them as
 * `unreadable` and writing that reading back - and the hazard is answered once.
 *
 * Both of them carry a value that came out of somebody else's file and is
 * *acted on* rather than merely displayed, which nothing above them does. So
 * both are validated and bounded here, on the way in, by a module of their own:
 * `shared/externalLink.ts` and `shared/richText.ts`. Neither field is ever
 * trusted as it arrived.
 */
export type SessionItem =
  /**
   * A beat of the evening: a place, and the fight that happens in it.
   *
   * `CAMPAIGN_SCHEMA_VERSION` 3, decision 1 of `DECISIONI-2026-08-23.md`. The
   * scene arm gained the three fields that used to live on `encounter`, so
   * *"this fight happens here"* is a stored fact instead of an adjacency that a
   * drag destroys. The defect it closes was live: `Encounter.tsx:542` sent a
   * fight to the board without carrying an environment, so the brawl opened
   * silently in the **previous** scene's place.
   *
   * The app had been arguing for this shape on its own: `GmBoard` below carried
   * exactly these four fields together, unnamed, from the day it existed until
   * `CAMPAIGN_SCHEMA_VERSION` 5 took the fight off it. That is where the
   * argument finished. The board keeps the builder's workbench; the fight is
   * here, and it is here alone.
   *
   * INVARIANT (the fight is the row's): a scene row's `combatants` is the fight
   * in that scene at all times - planned, being played, or left standing.
   * Nothing empties it but `clearScene` and deleting the row. There is no
   * second copy anywhere for it to fall out of step with, and deleting that
   * second copy is the whole of what schema 5 bought.
   *
   * INVARIANT (row-local ids): a `SceneCombatant.id` is unique inside its own
   * row and means nothing outside it. Two rows may both hold
   * `acid-burrower-0`, and that is the ordinary shape of two rows that opened
   * with the same adversary rather than a collision. Every writer is addressed
   * by `(sceneId, id)`, and no code may look a combatant up by id alone.
   * `readCombatants` below repairs a collision INSIDE one row, and its docblock
   * is written against ever widening that.
   */
  | (SessionItemBase & {
      kind: 'scene';
      environmentRef: Ref | null;
      roster: RosterEntry[];
      adjustments: EncounterAdjustments;
      combatants: SceneCombatant[];
    })
  /**
   * **Legacy. Readable and editable, and no longer creatable.**
   *
   * Kept in the union rather than converted, and the difference matters. The
   * cheaper option was to rewrite every stored `encounter` row into a `scene`
   * row, and it was refused for one reason: it changes the kind of a thing the
   * GM named. This chain has never done that. Three of its four converters copy
   * and change no field at all; the fourth moves a fight from one key to
   * another and changes no kind, no name, no id, no count and no mark - which
   * is the second of the three tests the chain's header states, and this arm is
   * where that test came from. Doing it once sets a precedent that is hard to
   * walk back, because the next migration that wants to rewrite somebody's data
   * will cite this one.
   *
   * So no saved campaign changes shape, nothing in `src/` may construct one,
   * and the arm stays until a build can prove no stored campaign still carries
   * it - which is a fact about other people's disks and therefore never.
   */
  | (SessionItemBase & {
      kind: 'encounter';
      roster: RosterEntry[];
      adjustments: EncounterAdjustments;
      combatants: SceneCombatant[];
    })
  | (SessionItemBase & { kind: 'link'; target: LinkTarget })
  | (SessionItemBase & {
      kind: 'countdown';
      countdown: Countdown;
      primary: boolean;
      /**
       * The scene row this clock belongs to, or null for the campaign's own.
       *
       * On the ROW, beside `primary`, and never a `countdowns: Countdown[]` on
       * the scene row: `countdownsOf`'s docblock refuses the second array by
       * name, and a clock is a plan row with a home already. (`combatants` on
       * the scene row is not the same case - combatants are not plan rows and
       * have no other home.) Not on `Countdown` in `shared/types.ts` either:
       * `primary` is up here for the same reason, and the two are repaired
       * together by `readCampaignRecord`.
       *
       * INVARIANT: `sceneId !== null` implies `primary === false`. A clock
       * cannot be both pinned to the top bar - which is the campaign's - and
       * owned by one scene. It is enforced by the two total writers below and
       * by the reader's repair pass, never by a convention the UI remembers.
       */
      sceneId: string | null;
    })
  /**
   * A link out of the app. Backlog item 12.
   *
   * One field, and `''` when there is no usable address - either because the
   * GM has not typed one yet or because the one in the file was refused. There
   * is deliberately no stored `why` beside it: the sentence explaining a
   * refusal is derived on every read by `readExternalUrl` and handed to the
   * reader's `warnings`, so it is always this build's sentence about the bytes
   * in front of it and never a string somebody else's file got to put on
   * screen. Storing it would also make it stale the moment mitigation 2 threw
   * the offending bytes away, which is on the very same read.
   */
  | (SessionItemBase & { kind: 'url'; href: string })
  /**
   * A note the GM typed, with formatting. Backlog item 14.
   *
   * A `NoteDoc` - an array of block objects - rather than a string of markup.
   * `shared/richText.ts` defends that choice at length, and the short version
   * is that centring has no markdown spelling, so any string format would have
   * needed a sigil invented here and frozen into every exported file for ever.
   */
  | (SessionItemBase & { kind: 'note'; note: NoteDoc })
  | (SessionItemBase & { kind: 'unreadable'; why: string; raw: string });

// ---------------------------------------------------------------------------
// The campaign
// ---------------------------------------------------------------------------

export type GmRegion =
  | 'encounter'
  | 'scene'
  | 'party'
  | 'bestiary'
  | 'countdowns'
  | 'reference'
  | 'names'
  | 'merchant';

/**
 * The same list as a value, because `board.region` arrives off a disk.
 *
 * Adding a value here widens the set one ephemeral navigation field accepts,
 * and `CAMPAIGN_SCHEMA_VERSION` deliberately does not move with it. Architecture
 * 6.1 exists to stop a build reading a record it does not understand and writing
 * its own misreading back in place - and that is precisely what an older build
 * does here: `readBoard` below falls back to `'encounter'`, and the 400ms
 * debounce then rewrites the record with the substituted value, uninvited and
 * unquarantined.
 *
 * That is acceptable for this one field and for no other. What the older build
 * overwrites is "which tool was open when you closed the app" - a value it was
 * going to replace the moment the GM opened anything, carrying no session, no
 * campaign and no roll. Every other field of the record survives the round trip
 * untouched, and the fallback that makes it survivable is the converter this
 * change would otherwise have had to write.
 *
 * **It has now happened three times, and the second time is what made it a rule
 * rather than an exception.** P5-3 added `'reference'`; the name generator added
 * `'names'`; the merchant adds `'merchant'`. ("It has now happened twice"
 * stood here, true when it was written and false the moment a third value was
 * added under it.)
 *
 * The third widening is the first to arrive *under* that rule rather than to
 * build it, so what being covered by it costs is said here instead of being
 * left for a reader to assume the rule covers everything. It covers this
 * because the test the rule states is still met: the widened field holds which
 * tool was open and nothing else, so an older build that meets `'merchant'`
 * substitutes `'encounter'`, writes that back, and has destroyed exactly one
 * thing - the memory of a sheet the GM was going to reopen by hand anyway. The
 * merchant stores nothing else anywhere: its stall is component state that does
 * not survive the sheet closing, deliberately, and `Merchant.tsx` argues why.
 * The clause below that revokes the licence - the moment anything but
 * navigation is stored in this field - is untouched by it, and stays live for
 * whoever widens this a fourth time.
 *
 * **The rewrite this comment used to ask for has happened, and the request
 * outlived it.** What stood here said Architecture §6.1 was titled "The one
 * exception, and why it is only one", that the title was no longer true of this
 * file, and that the section needed rewriting into a standing licence for *this
 * field*. All three were true when they were written and none of them is now.
 * The passage was rewritten on 18 August and is headed «L'eccezione, e perché
 * riguarda un campo e non un conteggio» - it sits inside §6.1, whose own
 * heading is «Regola dello schema: nessuno schema parte senza il suo
 * convertitore» - and it ends on the sentence this change
 * is the first to be governed by: whoever adds the third value must not ask
 * whether the exception is still a single one, but whether they are widening
 * **this** field or a different one.
 *
 * This widening is this field, which is the answer that section asks for. No
 * part of §6.1 is falsified by it. The courtesy that was left for whoever owns
 * the docs - naming `'merchant'` beside `'reference'` and `'names'` in the list
 * of what has actually been added - has been done, in the same change as this
 * one.
 *
 * ## The compiler holds the list against the union now, and could not before
 *
 * `const REGIONS: readonly GmRegion[]` stood here, and it is an annotation that
 * checks exactly one direction: every entry has to be a region, and a region
 * with no entry is nothing at all. So widening the union and forgetting the
 * list typechecked perfectly and lost the new tool on every reload - silently,
 * because the fallback is a real region and the screen simply opened the
 * encounter builder instead. `campaignSchema.test.ts` named that hazard in a
 * comment and could not hold it: a test that loops the list cannot notice a
 * region that never reached the list.
 *
 * Keying a `Record<GmRegion, true>` and taking its keys checks both directions.
 * A region missing from the record is a missing property; a key that is not a
 * region is an excess one. The cast on `Object.keys` is the one unchecked step
 * and it is safe by construction: the keys of a `Record<GmRegion, …>` written
 * as a literal are exactly `GmRegion`.
 */
const REGION_KEYS: Record<GmRegion, true> = {
  encounter: true,
  scene: true,
  party: true,
  bestiary: true,
  countdowns: true,
  reference: true,
  names: true,
  merchant: true,
};

/** Every region this build knows, in the order they are declared above. */
export const GM_REGIONS = Object.keys(REGION_KEYS) as readonly GmRegion[];

/**
 * The builder's workbench, and which scene the runner is showing.
 *
 * **NOT "the live table" any more.** A fight lives on the scene row it is
 * fought in, always, and nothing here holds one. What is left is the encounter
 * builder's draft - a roster, three adjustments, a tier, a place - plus two
 * navigation fields.
 *
 * The one promise `gmStore` has always made is unchanged, and is now kept
 * somewhere else: a GM who reloads mid-combat keeps the combat, because the
 * combat is on the row and the row is in `session`. What that promise stopped
 * needing is a second home for a fight to be copied into and back out of, which
 * is what this interface used to be.
 */
export interface GmBoard {
  region: GmRegion;
  partyTier: Tier;
  roster: RosterEntry[];
  adjustments: EncounterAdjustments;
  /**
   * The place the BUILDER is standing in - never the runner's.
   *
   * The runner reads the open scene row's own `environmentRef`, through
   * `environmentIn` below. This is what `SEND n TO THE SCENE` names before the
   * tap and what a freshly minted scene takes: `PUT THIS ENVIRONMENT ON THE
   * BOARD` writes it, `KEEP THE BOARD'S ENVIRONMENT HERE` reads it onto a row,
   * and an environment link row's SET ACTIVE writes it with no scene row
   * anywhere in reach - which is the reason this field stays when the fight
   * goes. Its writers are unchanged.
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
   * NOT the `board.region` exemption argued above. That exemption bounds
   * itself - "whether they are widening THIS field or a different one" - and
   * this is a different one. Nor is the bump that brought this field a bump for
   * it: what moved the number is the fight leaving the board.
   *
   * Never an index into `session`. `readCampaignRecord` re-sorts by `order`
   * and renumbers on every load, so `order` is not stable identity across a
   * reload and only `id` is.
   */
  openScene: string | null;
}

/**
 * A sitting that has been closed, with what happened in it.
 *
 * `CAMPAIGN_SCHEMA_VERSION` 3, decision 6 of `DECISIONI-2026-08-23.md`.
 *
 * Before this, `Campaign.session` was one flat array edited in place for ever:
 * last week's rows sat there this week, in the same order, with nothing saying
 * which were played, and there was no moment at which a GM would ever write
 * down *"they never went north"* - which is the whole of the between-sessions
 * loop.
 *
 * `items` is a **copy of the rows, never a list of references into the live
 * plan**. A row carried forward into next week's plan and then rewritten must
 * not silently rewrite what the archive says happened last week; an archive
 * that changes under you is not a record.
 *
 * ## NOTHING IN THIS BUILD CLOSES A SITTING
 *
 * Said here because the sentence above used to read "as they stood at the
 * moment of closing", and there is no such moment in the code. `archive` is
 * written in exactly two places - `newCampaign`, which seeds it `[]`, and
 * `readCampaignRecord`, which reads it off a record - and `gmStore.ts` does not
 * name it at all. Its only other readers count it: `TakeIn.tsx`'s diagnostic
 * line and `campaignImport.ts`'s preview. So every sitting in every archive
 * this build has ever seen arrived through the READER, and the reader is the
 * only thing holding the promise.
 *
 * ## Since schema 5 that promise carries the fight
 *
 * A scene row absorbed `combatants`, so an archived sitting can hold every
 * adversary, every HP and Stress mark and every spotlight as they stood. That
 * is what makes the promise worth more and makes breaking it worse: an aliased
 * archive would mean marking this week's Acid Burrower moves a mark in last
 * week's record.
 *
 * It is not aliased, and the line that makes it so is not the one a reader
 * expects. `readArchivedSession` sends every row through `readSessionItem`,
 * which names its fields one at a time and never spreads; and inside that,
 * `readCombatants` rebuilds every body while `readCounter`, `readThresholds`,
 * `readRoster` and `readAdjustments` each CONSTRUCT rather than hand back the
 * input or a shared default. So a record that puts the SAME row object in
 * `session` and in `archive[].items` - the shape a `close()` written as
 * `archive.push({ items: campaign.session })` produces, and the shape
 * `campaignImport.ts` already expects when it says the archive deliberately
 * repeats live row ids - reads back as two independent rows.
 *
 * Proved rather than asserted from the type. Mutating one line of
 * `readCombatants`, `hp: readCounter(entry['hp'])` into
 * `hp: entry['hp'] as { marked: number; max: number }`, leaves the whole suite
 * as it stood before this was written green - 162 files, 4257 tests on
 * `npx vitest run`, Node v24.19.0 - and `npx tsc --noEmit` clean with it. The
 * duplicate-id repair tests do not catch it, because id repair is a different
 * property. `gives an archived sitting its own fight, even when the record
 * hands it the live row`, in `tests/store/campaignSchema.test.ts`, is the one
 * test that dies on it.
 *
 * **Whoever writes the close is who this warns.** The reader runs on a load,
 * not on a write. An aliasing `close()` would alias only until the next
 * reload, and the reload would quietly launder it - so the bug passes every
 * test that saves and reads back, and shows up only as a GM's record of last
 * week changing while they play this week. The copy has to be made at the
 * moment of closing; the reader is a second line, not the first.
 *
 * ## What it weighs
 *
 * Nothing yet, and that is measured rather than assumed: the one archived scene
 * row in `tests/fixtures/schema/v3`, `v4` and `v5.campaign.json` carries
 * `combatants: []` - the key is there and empty, not absent - and all three
 * files' `archive` serialises to the same 425 bytes. Schema 5 bought the
 * archive capacity, not bytes. The only archived rows in this tree holding a
 * body at all are fixtures in `campaignImport.test.ts` and
 * `campaignRoundTrip.test.ts`, and both compare ids on the way back rather than
 * asking whether the bodies are the plan's - which is why the mutant above
 * walks past them.
 *
 * Used, the capacity is not small. `makeCombatant` over the shipped dataset's
 * 129 adversaries mints a body of 171 to 267 bytes of JSON, median 208; the
 * Acid Burrower is 201. A scene row with a roster and no fight is 253 bytes,
 * and the same row with five bodies on it is 1262 - the fight is four times the
 * row it is fought in. A modelled sitting of six rows, four of them fought
 * scenes, goes from 1453 bytes to 5370, and thirty of those are 157 KiB of
 * archive against 43 KiB of the same sittings' plans. A campaign is one
 * IndexedDB value and one `.dhcampaign` file, nothing here bounds the archive,
 * and the close is the only place a bound could go.
 */
export interface ArchivedSession {
  id: string;
  /** What the GM called this sitting. Never generated; an empty one stays empty. */
  name: string;
  /** When it was closed. The archive is ordered by this on read. */
  closedAt: string;
  /**
   * The rows as they stood when it closed. A copy, never a reference - and
   * since schema 5 that copy has to reach every combatant, every counter and
   * every threshold, not just the row.
   */
  items: SessionItem[];
  /** What happened, in the GM's own words. */
  account: NoteDoc;
}

/**
 * The kinds of thing the durable record holds.
 *
 * Decision 7 of `DECISIONI-2026-08-23.md` names them: session-zero agreements,
 * the people and places the table invented, arc notes. They are one list with a
 * kind rather than five lists, for the reason the session list is one list: a
 * GM looking for *"that innkeeper"* does not first decide which array it is in.
 *
 * **This data never shares a scroll with SRD prose**, which is the other half
 * of decision 7 and a constraint on whatever screen draws it, not on this file.
 * REFERENCE means what its heading says; the table's own words live behind
 * their own door.
 */
export const REGISTER_KINDS = ['person', 'place', 'agreement', 'arc', 'fact'] as const;
export type RegisterKind = (typeof REGISTER_KINDS)[number];

export interface RegisterEntryBase {
  id: string;
  /** The name the GM gave it. Never generated; an empty one stays empty. */
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One entry in the durable record.
 *
 * The `unreadable` arm is the same idea as `SessionItem`'s and `LinkTarget`'s,
 * and it is here for the same reason it is there: this list will gain kinds,
 * and an entry a build cannot read must come back out of the file it went into.
 * A GM who wrote down forty people and finds thirty-nine has no way to learn
 * which one left.
 */
export type RegisterEntry =
  | (RegisterEntryBase & { kind: RegisterKind; body: NoteDoc })
  | (RegisterEntryBase & { kind: 'unreadable'; why: string; raw: string });

export interface Campaign {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  fear: number;
  /** Tonight's plan: the rows the GM is editing now. */
  session: SessionItem[];
  /**
   * Sittings that have been closed, oldest first.
   *
   * Separate from `session` and not a prefix of it: the plan is what is being
   * edited, the archive is what happened. Merging them would mean every screen
   * that walks the plan has to remember to skip the past.
   */
  archive: ArchivedSession[];
  /** The durable record beside the plan. Decision 7's home. */
  register: RegisterEntry[];
  /** Whole sheets, on purpose. See the header of `src/ui/gm/party.ts`. */
  party: PartyMember[];
  board: GmBoard;
}

export const emptyBoard = (): GmBoard => ({
  region: 'encounter',
  partyTier: 1,
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  environmentRef: null,
  openScene: null,
});

export function newCampaign(name: string, at: string, id: string): Campaign {
  return {
    id,
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    name,
    createdAt: at,
    updatedAt: at,
    fear: 0,
    session: [],
    archive: [],
    register: [],
    party: [],
    board: emptyBoard(),
  };
}

// ---------------------------------------------------------------------------
// Countdowns, which live in the session list
// ---------------------------------------------------------------------------

/**
 * The campaign's countdowns, in list order.
 *
 * They are session items rather than a second array beside the list, because
 * two arrays would need keeping in step and the wireframe already draws a
 * countdown as a row of the list. A pointer from the campaign to "the primary
 * one" would be a second thing to keep in step too, so primacy is a flag on
 * the row - and `readCampaignRecord` is what stops two rows carrying it.
 */
export const countdownsOf = (session: readonly SessionItem[]): Countdown[] =>
  session.flatMap((item) => (item.kind === 'countdown' ? [item.countdown] : []));

/**
 * The countdowns one scope owns. `null` is the campaign's own.
 *
 * `countdownsOf` above KEEPS its meaning - every clock in the campaign - and
 * that is deliberate, because three callers depend on it: the store's derived
 * `countdowns`, the export, and the long rest. **Scope is an argument at a call
 * site, never a narrowing of what "the campaign's countdowns" means.** A
 * `countdownsOf(session, sceneId)` would quietly take the forest's long-term
 * clock off the list a rest may advance, with no error message anywhere.
 */
export const countdownsIn = (
  session: readonly SessionItem[],
  sceneId: string | null,
): Countdown[] =>
  session.flatMap((item) =>
    item.kind === 'countdown' && item.sceneId === sceneId ? [item.countdown] : [],
  );

/**
 * Give a countdown row to a scene, or hand it back to the campaign.
 *
 * Total, like `withPrimaryCountdown`, and it clears the pin on the way in for
 * the same reason that one refuses to set it: the top bar is the campaign's, so
 * a clock cannot be both pinned there and owned by one scene.
 *
 * **Both writers are needed and neither is redundant.** `withPrimaryCountdown`
 * refuses to pin a clock a scene already owns; this one clears a pin a clock
 * already had when a scene takes it. A single clause in either place leaves the
 * other route open, and the forbidden state would sit on the glass until the
 * next reload repaired it.
 *
 * Giving a clock back to the campaign does NOT re-pin it. A countdown does not
 * become the one on the top bar as a side effect of losing a scope.
 */
export const withSceneScope = (
  session: SessionItem[],
  rowId: string,
  sceneId: string | null,
): SessionItem[] =>
  session.map((item) =>
    item.kind === 'countdown' && item.id === rowId
      ? { ...item, sceneId, primary: sceneId === null ? item.primary : false }
      : item,
  );

/**
 * The scene rows a GM is flipping between.
 *
 * Derived, never stored, and that is the whole of its argument. A row is live
 * because it holds a fight or because it is the one the runner has open - so
 * the set cannot go stale, it survives an export for free, a row that is
 * correctly archived is not in `session` and therefore not live, and deleting a
 * row takes it off the strip with no cleanup anywhere.
 *
 * The second clause now does one job and used to do two. It kept an OPEN row
 * with no fight in it on the strip, and it also covered a state that no longer
 * exists: before `CAMPAIGN_SCHEMA_VERSION` 5, the row being fought in held
 * `combatants: []` - the fight was on the board - so without that clause the
 * live row was the one row the strip dropped. Schema 5 deleted the state rather
 * than the clause: a row being fought in holds its own fight and satisfies the
 * first clause unaided.
 *
 * **Only `kind: 'scene'`, never `encounter`.** That arm has no
 * `environmentRef`, so resuming one would open the fight in the *previous*
 * scene's place - textually the defect the scene row absorbed the fight to
 * close. It is also the arm nothing can mint any more.
 */
export const liveScenes = (
  session: readonly SessionItem[],
  openScene: string | null,
): SessionItem[] =>
  session.filter(
    (i) => i.kind === 'scene' && (i.combatants.length > 0 || i.id === openScene),
  );

/**
 * One array, module-level, so the empty case has a stable identity.
 *
 * Load-bearing rather than tidy. zustand 5 calls `useSyncExternalStore` with no
 * selector memoization (`node_modules/zustand/react.js`), so a selector that
 * built a fresh `[]` on every call would make React declare the snapshot
 * uncached and loop - on the ordinary state of a fresh campaign, which is a
 * campaign with no fight open.
 *
 * **It is not `tests/fixtures/factories.ts`'s `NO_FIGHT`**, which the test
 * suite imports widely and which means something else entirely: the three empty
 * fields a scene row absorbed at campaign schema 3, spread into a row literal.
 * This is one empty combatant list, and its whole point is that it is always
 * the same one. Two names, because one name for two things is how a reader
 * stops trusting either.
 */
const NO_COMBATANTS: SceneCombatant[] = [];

/**
 * The fight in one scene row. `NO_COMBATANTS` when the id names no scene row.
 *
 * Returns the row's OWN array by reference and never a copy. `useGm` compares
 * by identity, so a copy here would repaint the whole runner on every `+1` of
 * Fear. That is safe exactly while every writer rebuilds the array instead of
 * marking it in place, and unsafe the day one does not - so that discipline is
 * not a style preference over in the store, it is the precondition of this one
 * line, and a `combatants` patch that arrives through a general row patcher is
 * the shape that breaks it.
 *
 * The null case and the not-found case return the same object rather than two
 * empty arrays, for the reason `NO_COMBATANTS` exists.
 */
export const combatantsIn = (
  session: readonly SessionItem[],
  sceneId: string | null,
): SceneCombatant[] => {
  if (sceneId === null) return NO_COMBATANTS;
  const row = session.find((i) => i.id === sceneId);
  return row !== undefined && row.kind === 'scene' ? row.combatants : NO_COMBATANTS;
};

/**
 * The place the runner draws: the open row's own, never the board's.
 *
 * `board.environmentRef` is the builder's and stays the builder's. Falling back
 * to it here would rebuild decision 1's original defect one layer down - a
 * fight opening silently in the *previous* scene's place - which is the defect
 * the scene row absorbed the fight to close. A scene with no place of its own
 * draws no place.
 */
export const environmentIn = (
  session: readonly SessionItem[],
  sceneId: string | null,
): Ref | null => {
  if (sceneId === null) return null;
  const row = session.find((i) => i.id === sceneId);
  return row !== undefined && row.kind === 'scene' ? row.environmentRef : null;
};

export const primaryCountdownOf = (session: readonly SessionItem[]): Countdown | null => {
  const item = session.find((i) => i.kind === 'countdown' && i.primary);
  return item !== undefined && item.kind === 'countdown' ? item.countdown : null;
};

/**
 * Mark one countdown as the primary one, and unmark every other.
 *
 * Written here rather than in the store because "at most one primary" is a
 * property of the record, and a caller that sets the flag by hand can break it
 * from anywhere. Passing an id that is not a countdown clears the flag from
 * all of them, which is the honest reading of "make that one primary" when
 * that one cannot be.
 *
 * A clock that belongs to a scene cannot become the primary one, and the
 * refusal is silent for the same reason: the top bar is the campaign's, so
 * "make that one primary" when that one is a scene's clock is another id this
 * writer cannot honour, and it clears the flag from all of them rather than
 * pretending. It is the same reading as the sentence above, applied to a
 * second way of being ineligible.
 */
export const withPrimaryCountdown = (session: SessionItem[], id: string | null): SessionItem[] =>
  session.map((item) =>
    item.kind === 'countdown'
      ? { ...item, primary: item.sceneId === null && item.id === id }
      : item,
  );

// ---------------------------------------------------------------------------
// Reading a record nobody in this build wrote
// ---------------------------------------------------------------------------

/** A campaign record that could not be read at all. */
export class CampaignReadError extends Error {
  override name = 'CampaignReadError';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const clampFear = (n: unknown): number =>
  Math.max(0, Math.min(MAX_FEAR, Math.round(num(n, 0))));

const readCounter = (v: unknown): { marked: number; max: number } => {
  const r = isRecord(v) ? v : {};
  return { marked: num(r['marked'], 0), max: num(r['max'], 0) };
};

const readThresholds = (v: unknown): [number, number] | null =>
  Array.isArray(v) && v.length === 2 ? [num(v[0], 0), num(v[1], 0)] : null;

const readAdjustments = (v: unknown): EncounterAdjustments => {
  const r = isRecord(v) ? v : {};
  return {
    easier: bool(r['easier']),
    harder: bool(r['harder']),
    damageBump: bool(r['damageBump']),
  };
};

const readRoster = (v: unknown): RosterEntry[] =>
  (Array.isArray(v) ? v : []).flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['ref'] !== 'string') return [];
    return [{ ref: entry['ref'], count: Math.max(0, Math.round(num(entry['count'], 1))) }];
  });

/**
 * The bodies in one fight, and the one repair that keeps every one of them.
 *
 * ## A combatant id is row-LOCAL, and widening that destroys a legal state
 *
 * `makeCombatant` mints `${adversaryRef}-${index}`, and the index restarts at
 * 0 in every fight it builds. So two different scene rows both holding an
 * `acid-burrower-0` is not a defect: it is the ordinary shape of two rows that
 * each opened with the same adversary, and it is the invariant the whole
 * scene-per-row model is written on. A repair that deduped across rows would
 * renumber a fight nobody had touched, and every id the GM's own notes and
 * every id a countdown or a screen had written down would move under them.
 * Only a collision INSIDE one list is repaired, and that is the reason this
 * repair lives here - in the function that reads exactly one list - rather
 * than in `readCampaignRecord`, which can see all of them at once and would be
 * one careless `flatMap` away from getting it wrong in the widening direction.
 *
 * ## Re-id, never drop
 *
 * Two bodies with one id is not a state a screen can act on. Nothing in the
 * app reads this list by id - `Scene.tsx` maps it and draws BOTH cards - so
 * an id here is only ever a WRITE address, and this one addresses two bodies
 * at once. `patchCombatant` maps on `c.id === id`, so one tap on one card's
 * HP marks both of them; `removeCombatant` filters on the same key, so one
 * REMOVE on one card takes both off the table. That second one is the silent
 * loss, and nothing anywhere says so. Dropping the later body is the one-line
 * repair, and it is that same loss again with this file's name on it: the
 * dropped body is an adversary standing at the table in front of somebody,
 * and no warning could put it back. So the second and later collisions are
 * re-numbered to the first free `${adversaryRef}-${n}` in this same list, and
 * every mark they carry travels with them - `hp.marked`, `stress.marked`,
 * `thresholds`, `spotlighted`, `minionsRemaining`, and the GM's own `notes`.
 * The GM is told once, not once per body: `warn` collapses the repeat, and a
 * sentence printed per adversary is how a real warning stops being read.
 *
 * The free id is searched against every id in the list, given or minted, so
 * the repair can never land on a body further down that had that id first -
 * which would turn one collision into two.
 *
 * ## Both callers, on purpose
 *
 * The scene row and the legacy `encounter` row read their fight through this
 * function, so both get the repair from the one line that writes it. That is
 * deliberate rather than incidental. The legacy row is the arm nothing can mint
 * any more but every saved campaign may still carry, and its bodies are only
 * counted today rather than addressed; the day anything puts one back in play
 * it arrives holding exactly the id this function gave it. An `if` per arm is
 * how two policies for one invariant start.
 *
 * There were three callers until `CAMPAIGN_SCHEMA_VERSION` 5, and the third was
 * the board's own list - the one `patchCombatant` and `removeCombatant` held,
 * which a scene row's list became verbatim on every resume. The argument for
 * repairing it here was that a duplicate left on a row was a duplicate under
 * those two writers one flip later. Both halves of that are gone: the row's
 * list *is* the one the writers hold, and there is no flip. The fight is
 * repaired once, in the only place it lives.
 */
const readCombatants = (v: unknown, warn: (s: string) => void): SceneCombatant[] => {
  const entries = (Array.isArray(v) ? v : []).filter(
    (entry): entry is Record<string, unknown> =>
      isRecord(entry) && typeof entry['id'] === 'string',
  );
  const taken = new Set(entries.map((entry) => str(entry['id'])));
  const seen = new Set<string>();
  return entries.map((entry): SceneCombatant => {
    const given = str(entry['id']);
    const adversaryRef = str(entry['adversaryRef']);
    let id = given;
    if (seen.has(given)) {
      warn(
        'two adversaries in the same fight had the same id, so the later ones were re-numbered rather than dropped',
      );
      let n = 0;
      while (taken.has(`${adversaryRef}-${String(n)}`)) n += 1;
      id = `${adversaryRef}-${String(n)}`;
      taken.add(id);
    }
    seen.add(id);
    const minions = entry['minionsRemaining'];
    return {
      id,
      adversaryRef,
      name: str(entry['name']),
      hp: readCounter(entry['hp']),
      stress: readCounter(entry['stress']),
      thresholds: readThresholds(entry['thresholds']),
      difficulty: num(entry['difficulty'], 0),
      spotlighted: bool(entry['spotlighted']),
      ...(typeof minions === 'number' ? { minionsRemaining: minions } : {}),
      notes: str(entry['notes']),
    };
  });
};

const COUNTDOWN_KINDS: readonly CountdownKind[] = ['standard', 'dynamic', 'loop', 'long-term'];

/**
 * The longest a single beat, or one field of the triad, may be.
 *
 * A bound rather than a validation: these are the GM's own words and nothing
 * here judges them. What it stops is a campaign file whose countdown carries a
 * megabyte of text per tick, which is a denial-of-service on the GM's own
 * IndexedDB quota rather than on anything of ours. `richText.ts` bounds the
 * `note` row for the same reason and says so at greater length.
 */
export const COUNTDOWN_TEXT_MAX = 2000;

/**
 * As many beats as any clock could sensibly have ticks, and then some.
 *
 * Both of these are exported because the reader is no longer the only end that
 * has to honour them. `gmStore.writeCountdownBeat` is the first thing in the
 * app that writes a beat, and a writer bounded differently from the reader
 * would let a GM type a sentence that came back cut - "works until you refresh"
 * with the GM's own words as the thing that changes.
 */
export const COUNTDOWN_BEATS_MAX = 100;

const readCountdown = (v: unknown, id: string, name: string): Countdown => {
  const r = isRecord(v) ? v : {};
  const kind = r['kind'];
  const start = Math.max(1, Math.round(num(r['start'], 1)));
  const text = (k: string): string => str(r[k]).slice(0, COUNTDOWN_TEXT_MAX);
  /*
   * The beats are bounded in both directions and trimmed of neither end.
   *
   * Not truncated to `start`: a GM who shortens a clock from six to four must
   * not lose the two sentences they had already written for the ticks that went
   * away, because lengthening it again is one tap and retyping them is not.
   * Not padded to `start` either - `beats.length < start` is the normal state of
   * a clock somebody is still writing, and padding would make "unwritten" and
   * "deliberately blank" indistinguishable.
   */
  const beats = Array.isArray(r['beats'])
    ? r['beats'].slice(0, COUNTDOWN_BEATS_MAX).map((b) => str(b).slice(0, COUNTDOWN_TEXT_MAX))
    : [];
  return {
    id: str(r['id'], id),
    name: str(r['name'], name),
    kind: COUNTDOWN_KINDS.includes(kind as CountdownKind) ? (kind as CountdownKind) : 'standard',
    start,
    value: Math.max(0, Math.min(start, Math.round(num(r['value'], start)))),
    notes: str(r['notes']),
    activation: text('activation'),
    advancement: text('advancement'),
    effect: text('effect'),
    /*
     * Read as a string and never checked against the party.
     *
     * See the field's docblock in `shared/types.ts`: a clock may name somebody
     * who has left the party board, and the screen saying so is better than the
     * reader silently emptying a field the GM filled in.
     */
    owner: str(r['owner']),
    beats,
  };
};

/**
 * A link target, including one this build has no name for.
 *
 * The `unknown` arm keeps the original `kind` string in `named` rather than
 * throwing it away, so the screen can say *what* it is that it cannot follow
 * and a later build can recognise it again.
 */
function readLinkTarget(v: unknown): LinkTarget {
  const r = isRecord(v) ? v : {};
  const kind = r['kind'];
  const ref = str(r['ref']);
  if (typeof kind === 'string' && (LINK_KINDS as readonly string[]).includes(kind)) {
    return { kind: kind as LinkKind, ref };
  }
  return { kind: 'unknown', named: typeof kind === 'string' ? kind : '', ref };
}

const PARTY_SOURCES: readonly PartySource[] = ['file', 'code'];

const readTracks = (v: unknown): PartyTracks => {
  const r = isRecord(v) ? v : {};
  return {
    hp: num(r['hp'], 0),
    stress: num(r['stress'], 0),
    hope: num(r['hope'], 0),
    armor: num(r['armor'], 0),
  };
};

/**
 * What `src/ui/gm/` reaches for on a party sheet, and nothing beyond it.
 *
 * Derived by reading the consumers rather than the `Character` type: the union
 * of every field named by `deriveStats` and `collectModifiers` (which the board
 * calls per row), by `findGaps`, and by the `src/ui/gm/` components themselves -
 * the row, its drawer and `CompanionLine`. It is deliberately shorter than
 * `Character`. `gold`, `notes`, `connections`, `traitMarks`, `createdAt` and the
 * rest are absent because no GM screen reads them, and a sheet that is missing
 * one of those renders a board a GM can use. Refusing on a field nobody reads
 * would throw away a usable row to satisfy a type.
 *
 * The predicates answer the question the crash asked, not the question the type
 * asks, and how deep each one goes was MEASURED rather than reasoned about.
 * `tests/store/campaignPartySheet.test.ts` hands each shape below to the
 * consumers themselves and records which ones throw; the depths here are that
 * table, and the same test also holds the other side of it - the shapes that
 * were measured harmless are required to keep their row.
 *
 * THE RULE: an element is checked as deep as some `src/ui/gm/` consumer
 * dereferences it, and no deeper. The first version of this guard checked every
 * list with `Array.isArray` alone, on the reasoning that "a junk element renders
 * wrong, which is a board you can read and disbelieve". That sentence was false
 * for three of the six lists, and a verifier proved it by getting past the guard:
 *
 *   `levelUpHistory`  `advancementCount` reads `a.kind` off every element, and
 *                     `collectModifiers` reads `h.detail['subclassRef']` off the
 *                     ones that say `subclass` - so a hole in the list, or an
 *                     entry with no `detail`, is the original crash again.
 *   `inventory`       `collectModifiers` reads `entry.ref` off every element.
 *   `experiences`     the board's own `Experiences` reads `.name` off every one,
 *                     on first render - which no test saw, because every
 *                     question the suite asked of a sheet deleted a field, and
 *                     a deleted list is refused by the list check itself.
 *
 * The other three are checked as lists and nothing more, and that is measured
 * too: `scars` is only ever `.length`, and `subclassRefs`/`ancestryRefs` are
 * handed to `Map.get`, which is total for anything. Making those deeper would
 * throw away a usable row to satisfy a type, which is the other way to lose a
 * board. `companion.experiences` and `companion.upgrades` stay shallow for the
 * blunter reason that no GM screen reads either one.
 *
 * `levelUpHistory` is the one predicate that is a shade wider than its crash: a
 * missing `detail` is only fatal on a `subclass` entry, and this refuses it on
 * any. Branching on `kind` would put a consumer's internal `if` inside the
 * guard, where it would drift; and the wider rule cannot refuse a real sheet,
 * because `detail` is required by `LevelUpChoice` and every writer of one -
 * `applyLevelUp` and the codec's `readChoice` - sets it.
 *
 * The two records that go deeper are the two the board calls methods through:
 * `traits`, because the six are read by name, and `companion`, because
 * `CompanionLine` calls `.toUpperCase()` on its name and reads `.marked`/`.max`
 * off its Stress - so half an animal is refused here exactly as
 * `checkShapes` in `src/transfer/fileIo.ts` refuses it for a file.
 *
 * A second opinion this is not, and could not have been: `readCharacterRecord`
 * is the reader that already knows this shape, and it lives in `src/`, which
 * `shared/` may not import - `shared/` is used by `tools/` as well as by `src/`
 * (Architecture, the tree at the end). What keeps this list from drifting away
 * from the type is a test rather than a compiler: `tests/store/campaignPartySheet.test.ts`
 * requires every key named here to be present on a blank `newCharacter()`, so a
 * rename in `shared/types.ts` fails there instead of quietly refusing every row.
 * That test writes out the field list by hand, and - since the verifier got past
 * the first version of this guard - the fatal shapes by hand as well, because a
 * guard asked which shapes it stops is a guard that cannot go red.
 */
const isCounter = (v: unknown): boolean =>
  isRecord(v) && typeof v['marked'] === 'number' && typeof v['max'] === 'number';

const isRefOrNull = (v: unknown): boolean => v === null || typeof v === 'string';

/**
 * A list, and nothing is asked of what is in it.
 *
 * Correct only where no consumer dereferences an element: `.length`, or a
 * `Map.get` that is total for any key. Everywhere else it is the hole the
 * verifier walked through, and `isListOf` is the predicate to use instead.
 */
const isList = (v: unknown): boolean => Array.isArray(v);

/** A list whose every element survives being dereferenced by the board. */
const isListOf =
  (each: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    Array.isArray(v) && v.every(each);

/**
 * An advancement the board can count and read a `detail` off.
 *
 * Both halves are the crash: a hole in the list throws in `advancementCount`,
 * and an entry with no `detail` throws in `collectModifiers` the moment the
 * character's subclass resolves.
 */
const isAdvancement = (v: unknown): boolean => isRecord(v) && isRecord(v['detail']);

const COMPANION_FIELDS: ReadonlyArray<readonly [string, (v: unknown) => boolean]> = [
  ['name', (v) => typeof v === 'string'],
  ['description', (v) => typeof v === 'string'],
  ['evasion', (v) => typeof v === 'number'],
  ['stress', isCounter],
  ['damage', (v) => typeof v === 'string'],
  ['range', (v) => typeof v === 'string'],
  ['damageType', (v) => v === 'phy' || v === 'mag'],
  ['experiences', isList],
  ['upgrades', isList],
];

const BOARD_FIELDS: ReadonlyArray<readonly [string, (v: unknown) => boolean]> = [
  ['id', (v) => typeof v === 'string'],
  ['name', (v) => typeof v === 'string'],
  ['level', (v) => typeof v === 'number'],
  ['classRef', (v) => typeof v === 'string'],
  ['traits', (v) => isRecord(v) && TRAITS.every((t) => typeof v[t] === 'number')],
  ['hp', isCounter],
  ['stress', isCounter],
  ['hope', isCounter],
  ['armorSlots', isCounter],
  ['evasionOverride', (v) => v === null || typeof v === 'number'],
  [
    'thresholdOverride',
    (v) => v === null || (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number')),
  ],
  ['communityRef', isRefOrNull],
  ['multiclassRef', isRefOrNull],
  ['multiclassDomain', isRefOrNull],
  ['activePrimaryWeapon', isRefOrNull],
  ['activeSecondaryWeapon', isRefOrNull],
  ['activeArmor', isRefOrNull],
  // Handed to `Map.get`, which is total for anything: a list is the whole check.
  ['subclassRefs', isList],
  ['ancestryRefs', isList],
  // Dereferenced per element: by `collectModifiers`, and by the row itself.
  ['inventory', isListOf(isRecord)],
  ['experiences', isListOf(isRecord)],
  ['levelUpHistory', isListOf(isAdvancement)],
  // Only ever `.length`, in `deriveStats`.
  ['scars', isList],
  ['beastform', (v) => v === null || isRecord(v)],
  ['companion', (v) => v === null || (isRecord(v) && COMPANION_FIELDS.every(([k, ok]) => ok(v[k])))],
];

/** The board fields this sheet does not have, in the order they are listed. */
export const boardShortfall = (sheet: Record<string, unknown>): string[] =>
  BOARD_FIELDS.filter(([key, ok]) => !ok(sheet[key])).map(([key]) => key);

/**
 * A board row, or nothing.
 *
 * The one place in this file that drops something, and it now drops for three
 * reasons rather than one: a row with no sheet, a sheet the character migration
 * chain refuses, and - since this commit - a sheet that arrived whole enough to
 * store and not whole enough to draw. All three are the same rule
 * `gmStore.load()` already had: a row the board cannot derive numbers from takes
 * the whole screen down on first render. Everything else here is repaired rather
 * than discarded, because everything else can be.
 */
function readPartyMember(v: unknown, warn: (s: string) => void): PartyMember[] {
  if (!isRecord(v) || typeof v['id'] !== 'string') return [];
  const sheet = v['sheet'];
  if (!isRecord(sheet) || typeof sheet['name'] !== 'string') {
    warn('a party row arrived with no character sheet on it, so the row was left out');
    return [];
  }
  /*
   * The sheet goes through the character migration chain, and until schema 3
   * it did not.
   *
   * This is the cast the pre-merge gate's proof (f) found: a player's sheet
   * inside a campaign was the one road into this app that never passed
   * `migrateCharacterRecord`, so a campaign carrying a schema-3 character
   * handed schema-3 fields to code that reads schema 5. Proof (f) also
   * established, by executing it, that **no test held the old behaviour in
   * either direction** - so the change was free of test resistance and the old
   * behaviour was covered by nothing. It is decided here because this is the
   * bump that opens the file, exactly as `DECISIONI-2026-08-23.md` said it
   * should be.
   *
   * **A successful conversion says nothing**, and that is the same judgement the
   * `url` arm makes a few lines down: a campaign whose party was imported before
   * the last schema bump would otherwise warn on every single launch, for ever,
   * about something that worked. That is how a real warning stops being read.
   * The character import path announces its own conversions, at the moment the
   * user is actually doing something about a file.
   *
   * A throw is caught rather than propagated, because this reader's contract is
   * that it warns and never refuses a campaign. A sheet from a *newer* build,
   * or from a schema older than any release wrote, drops its row and says so -
   * which is the disposal the clause above already uses for a row that arrived
   * with no sheet at all. Keeping an unreadable sheet would be the worse
   * answer: it is precisely the shape that lets `src/ui/gm/` call a method on a
   * field that is not there.
   */
  let migrated: Record<string, unknown>;
  try {
    migrated = migrateCharacterRecord(sheet).record;
  } catch (e) {
    warn(
      `a party row's character sheet could not be read, so the row was left out: ${e instanceof Error ? e.message : 'unknown reason'}`,
    );
    return [];
  }

  /*
   * AND THE CHAIN IS NOT A CHECK. This is the clause the paragraph above kept
   * promising and did not have.
   *
   * `migrateCharacterRecord` converts a record from an older schema; handed one
   * that already claims the current schema it returns it untouched, converter
   * and all. So a stub stamped `schemaVersion: 5` walks through the `try` above
   * with nothing having looked at it, and the cast below then calls it a
   * `Character`. That is not a hypothetical: the party sheet in the committed
   * campaign fixtures is nine fields long, and opening a campaign holding one
   * took the GM screen down with `Cannot read properties of undefined (reading
   * 'filter')` - `levelUpHistory.filter`, inside `deriveStats`, called by the
   * board's row.
   *
   * REFUSAL, NOT REPAIR - which is the decision `PartyBoard.tsx` said was
   * scheduled for this file. Repair would mean filling the holes from a blank
   * sheet, and a blank sheet has a level, no class and no armour: a GM would
   * read out an Evasion of 10 and thresholds off the unarmored ladder for a
   * character who has neither, with nothing on screen saying the numbers were
   * invented. Refusing costs one row and says why; repairing costs the GM's
   * trust in every number on the board.
   *
   * AND THE WORD IS NOT QUARANTINE, WHICH IS WHAT THIS SAID FIRST. Quarantine
   * is a thing this codebase already does, one layer out: `readCampaigns`
   * leaves a record a newer build wrote exactly where it is on disk, and
   * `tests/store/campaignDb.test.ts` measures the bytes. This is not that. The
   * row is dropped from the campaign the GM is then holding, so the next thing
   * that saves - marking Fear, adding a scene, the debounce in `gmStore` -
   * writes that campaign back over the record the sheet was in, and the sheet
   * is gone from the device. `campaignDb.test.ts` measures that too, in the
   * test named for it. The price is real and it is paid here: a row the board
   * *could* have drawn a name and four tracks for is gone for good, and the
   * only way back is re-importing that character - which is why the warning
   * below says so rather than merely apologising.
   */
  const missing = boardShortfall(migrated);
  if (missing.length > 0) {
    /*
     * The warning names the character, not the row id, and it names what to do.
     * A GM reading "a party row was left out" can act on nothing; a GM reading
     * that Ilya's sheet is missing its traits knows which player to ask for the
     * file. The field list is capped because the interesting case - a stub, a
     * hand-written record, a sheet from a build this one has never met - is
     * missing twenty of them, and twenty field names is a sentence nobody
     * finishes reading.
     */
    const named = missing.slice(0, 3).join(', ');
    const rest = missing.length - 3;
    warn(
      `a party row's character sheet is not a whole character, so the row was left out: "${sheet['name'].slice(0, 60)}" is missing ${rest > 0 ? `${named} and ${String(rest)} more` : named}. Import that character again, from its file or its code, to put the row back.`,
    );
    return [];
  }

  const source = v['source'];
  return [
    {
      id: v['id'],
      /*
       * The cast, and what now stands behind it.
       *
       * It is still a cast - `shared/` cannot reach `readCharacterRecord`, so
       * nothing here can hand back a `Character` the compiler believes in. What
       * changed is that it is no longer unbacked: `boardShortfall` has checked
       * every field any `src/ui/gm/` consumer reads, which is the set that
       * decides whether the board draws or dies. What it does not vouch for is
       * the rest of `Character`, and that is the honest limit of this line.
       */
      sheet: migrated as unknown as PartyMember['sheet'],
      importedAt: str(v['importedAt']),
      source: PARTY_SOURCES.includes(source as PartySource) ? (source as PartySource) : 'file',
      tracks: readTracks(v['tracks']),
      markedAt: typeof v['markedAt'] === 'string' ? v['markedAt'] : null,
    },
  ];
}

/**
 * One row of the session list, whatever arrived.
 *
 * `index` is the fallback order, so a list written without one keeps the order
 * it was stored in rather than collapsing to a single position.
 *
 * ## Field by field, and never a spread
 *
 * Every arm below names the fields it keeps. That is not style: it is the
 * clause of mitigation 5 that says the reader hands back data and never an
 * affordance. `{ ...r }` here would carry a `target`, an `onclick`, a `srcdoc`
 * or an `autoOpen` straight out of somebody else's JSON, through the store, and
 * onto whatever a future screen spreads onto an element. Naming the fields is
 * what makes that impossible rather than unlikely, and
 * `tests/store/campaignUrlRow.test.ts` mutates this arm into a spread to prove
 * the difference is real.
 *
 * `warn` is how a repair reaches the GM. It is the reader's own list, so a
 * sentence added here comes out of `readCampaignRecord().warnings` beside the
 * ones about Fear and duplicate primaries.
 */
function readSessionItem(
  v: unknown,
  index: number,
  newId: () => string,
  warn: (s: string) => void,
): SessionItem {
  const raw = JSON.stringify(v) ?? 'null';
  const r = isRecord(v) ? v : {};
  const base: SessionItemBase = {
    id: str(r['id']) || newId(),
    name: str(r['name']),
    order: num(r['order'], index),
    collapsed: bool(r['collapsed']),
  };

  switch (r['kind']) {
    case 'scene':
      /*
       * The three fight fields read exactly as the `encounter` arm below reads
       * them, and through the same three functions rather than a copy of them.
       * A schema-2 scene row carries none of the three and gets `[]`, the
       * shipped defaults and `[]` - which is what a scene with no fight in it
       * is, so nothing has to know whether it was written before the bump.
       *
       * That sharing has since become load-bearing rather than tidy:
       * `readCombatants` carries the duplicate-id repair, so the legacy row
       * below - the arm nothing can mint any more and every saved campaign may
       * still hold - is defended by the same line as the row this build mints,
       * and neither arm can drift into a second policy for one invariant.
       */
      return {
        ...base,
        kind: 'scene',
        environmentRef: typeof r['environmentRef'] === 'string' ? r['environmentRef'] : null,
        roster: readRoster(r['roster']),
        adjustments: readAdjustments(r['adjustments']),
        combatants: readCombatants(r['combatants'], warn),
      };
    case 'encounter':
      return {
        ...base,
        kind: 'encounter',
        roster: readRoster(r['roster']),
        adjustments: readAdjustments(r['adjustments']),
        combatants: readCombatants(r['combatants'], warn),
      };
    case 'link':
      return { ...base, kind: 'link', target: readLinkTarget(r['target']) };
    case 'countdown':
      return {
        ...base,
        kind: 'countdown',
        countdown: readCountdown(r['countdown'], base.id, base.name),
        primary: bool(r['primary']),
        /*
         * `null` for a schema-3 row, which carried no scope at all - a clock
         * written before the bump is the campaign's, which is what every one
         * of them was. Whether the id names a row that still exists is not
         * decided here: this function reads one item and cannot see the list.
         * `readCampaignRecord` answers that, once, for both pointers.
         */
        sceneId: typeof r['sceneId'] === 'string' ? r['sceneId'] : null,
      };
    case 'url': {
      /*
       * The one field, and the one sentence.
       *
       * A row whose address was refused keeps its name, its order and its
       * place in the list - the GM added it and would notice it gone - and
       * loses only the address, which is the thing that was hostile. The
       * warning fires on a *refusal* and not on an empty row: a row a GM has
       * just added and not typed into yet has no address either, and warning
       * about that on every launch is how a real warning stops being read.
       */
      const given = r['href'];
      const { href, why } = readExternalUrl(given);
      if (href === '' && typeof given === 'string' && given.trim() !== '') {
        warn(`a web link in the session list was not usable, so its address was left out: ${why}`);
      }
      return { ...base, kind: 'url', href };
    }
    case 'note':
      return { ...base, kind: 'note', note: readNoteDoc(r['note'], warn) };
    case 'unreadable':
      // Already wrapped once, by an earlier read. Do not wrap it twice.
      return { ...base, kind: 'unreadable', why: str(r['why']), raw: str(r['raw'], raw) };
    default:
      return {
        ...base,
        kind: 'unreadable',
        why:
          typeof r['kind'] === 'string'
            ? `this version of the app has no "${r['kind']}" item`
            : 'it does not say what kind of item it is',
        raw,
      };
  }
}

/**
 * One closed sitting.
 *
 * The rows inside go through `readSessionItem`, the same function the live plan
 * uses, so an archived row gets exactly the same defence: field by field, never
 * a spread, and an unreadable row wrapped rather than dropped. An archive that
 * read its rows more loosely than the plan would be a way in through the back.
 *
 * Since campaign schema 5 that sharing does a second job, and `ArchivedSession`
 * argues it at length: a scene row carries its fight, so this is also the
 * function that decides whether an archived sitting holds its OWN bodies or a
 * handle on the live plan's. It holds its own, because `readSessionItem` and
 * `readCombatants` construct rather than pass through - not because anything
 * here copies.
 */
function readArchivedSession(
  v: unknown,
  index: number,
  newId: () => string,
  warn: (s: string) => void,
): ArchivedSession {
  const r = isRecord(v) ? v : {};
  const items = (Array.isArray(r['items']) ? r['items'] : []).map((item, i) =>
    readSessionItem(item, i, newId, warn),
  );
  return {
    id: str(r['id']) || newId(),
    name: str(r['name']),
    closedAt: str(r['closedAt']),
    items: items.map((item, i) => ({ ...item, order: i })),
    account: readNoteDoc(r['account'], warn),
  };
}

/** One entry of the durable record, including one this build has no kind for. */
function readRegisterEntry(v: unknown, newId: () => string, warn: (s: string) => void): RegisterEntry {
  const raw = JSON.stringify(v) ?? 'null';
  const r = isRecord(v) ? v : {};
  const base: RegisterEntryBase = {
    id: str(r['id']) || newId(),
    name: str(r['name']),
    createdAt: str(r['createdAt']),
    updatedAt: str(r['updatedAt']),
  };
  const kind = r['kind'];
  if (REGISTER_KINDS.includes(kind as RegisterKind)) {
    return { ...base, kind: kind as RegisterKind, body: readNoteDoc(r['body'], warn) };
  }
  if (kind === 'unreadable') {
    // Already wrapped once, by an earlier read. Do not wrap it twice.
    return { ...base, kind: 'unreadable', why: str(r['why']), raw: str(r['raw'], raw) };
  }
  return {
    ...base,
    kind: 'unreadable',
    why:
      typeof kind === 'string'
        ? `this version of the app has no "${kind}" entry`
        : 'it does not say what kind of entry it is',
    raw,
  };
}

export interface CampaignRead {
  campaign: Campaign;
  /** Repairs worth telling the GM about. Never a reason to refuse the record. */
  warnings: string[];
}

/**
 * Read a campaign record, and refuse to misread one.
 *
 * Two refusals and nothing else. A record with no id has no handle and cannot
 * be written back without inventing one - and inventing one is how a record
 * gets duplicated on every launch. A record from a newer schema is left alone
 * for the same reason `readLibrary` quarantines a character from the future:
 * this app makes two builds coexist on one device on purpose, and the old one
 * reading a new record, rendering it as its own shape and writing it back is
 * the exact failure Architecture 6.1 exists to prevent.
 *
 * Everything else is repaired and reported, because the alternative - a
 * campaign that will not open because one countdown had a bad number in it -
 * is a worse outcome for the person holding the phone at the table.
 *
 * And every repair here keeps the thing it repairs. Where two things collide -
 * two rows carrying one id, two bodies in one fight carrying one id - the
 * later one is re-numbered, never removed. Removing it is the one-line repair
 * and it costs a row the GM typed, or an adversary standing at the table in
 * front of somebody, with no warning able to bring either back. That silent
 * loss is what this whole file is written against, and no invariant is worth
 * buying at that price.
 */
export function readCampaignRecord(
  value: unknown,
  newId: () => string = () => crypto.randomUUID(),
): CampaignRead {
  if (!isRecord(value)) {
    throw new CampaignReadError('is not a campaign record at all.');
  }
  const version = versionOf(value, CAMPAIGN_SCHEMA_VERSION);
  checkReadable(version, CAMPAIGN_SCHEMA_VERSION, OLDEST_READABLE_CAMPAIGN);
  const { record } = applyChain(value, version, CAMPAIGN_SCHEMA_VERSION, CAMPAIGN_MIGRATIONS);

  const id = record['id'];
  if (typeof id !== 'string' || id === '') {
    throw new CampaignReadError('has no id, so there is nothing to write it back to.');
  }

  const warnings: string[] = [];
  const warn = (s: string): void => {
    if (!warnings.includes(s)) warnings.push(s);
  };

  const rows = (Array.isArray(record['session']) ? record['session'] : []).map((item, i) =>
    readSessionItem(item, i, newId, warn),
  );
  for (const item of rows) {
    if (item.kind === 'unreadable') warn(`one item in the session list could not be read: ${item.why}`);
  }

  /*
   * Two rows with one id, repaired before anything is allowed to ask "which
   * row is that?".
   *
   * `readSessionItem` fills a MISSING id and cannot do more than that: it
   * reads one row and cannot see the list. So a list where two rows carry the
   * same id arrives intact, and every id in this record is a question with two
   * answers. `find` returns the first and `map` returns both - one row read,
   * two rows written - and every pointer below, every countdown scope and
   * every screen that goes looking for "the row with this id" is downstream of
   * that disagreement. It is reachable the ordinary ways: a hand-edited file,
   * two builds writing one campaign, a copy gesture that took the id along
   * with everything else.
   *
   * RE-ID, NEVER DROP. Deleting the later row would restore the invariant in
   * one line and cost the GM something they typed, with no warning able to put
   * it back. The FIRST occurrence keeps the id - it is the one every pointer
   * already written in this record resolves to, and the one `find` would have
   * returned - and each later one gets a fresh id of its own. The fresh id is
   * checked against every id in the list, so the repair cannot collide with a
   * row further down that had it first.
   *
   * A countdown row carries its id TWICE, and the inner one is the one the
   * store writes through. `gmStore.addCountdown` mints `item.id` and
   * `item.countdown.id` as the same string on purpose, and `readCountdown`
   * hands the row's id down to a clock that arrived without one - while
   * `withCountdown`, behind advance and reset, and `removeCountdown` both key
   * on `item.countdown.id`, and that is the id every screen passes them. So a
   * pass that re-ids the row alone leaves the hazard one field down, and lies
   * about it: two clocks still answer to one id, one tap ticks both, and one
   * DELETE takes both - a row the GM typed, gone, seconds after `warnings`
   * told them it had been repaired. The fresh id goes onto the clock as well,
   * and only where the two ids still match: a clock already carrying an id of
   * its own is a pointer somebody else minted, and this pass has no business
   * moving it.
   *
   * **It runs before `deduped.sort`, and the order is not a preference.** The
   * walk is over the list AS IT ARRIVED, and arrival is what decides which of
   * two rows keeps the id. Run it after that sort and the decision is made
   * instead by an `order` field that arrived in the same hand-edited file the
   * duplicate did: the rows swap, the later one keeps the id, and every
   * pointer already written against the list as it was stored - a countdown's
   * `sceneId`, the board's own - lands on the other row without a word.
   *
   * The pointer passes below are NOT that boundary, and saying which is which
   * is the point of saying it at all. Renaming a LATER duplicate cannot take
   * an id out of a set the earlier row already put in, so moving this below
   * the scope pass alone changes no reading and leaves the suite green. It
   * stays up here regardless, so that every pass after this point - both
   * pointers, the primary dedupe, the sort, and the third pointer this file
   * says is coming - reads a list whose ids are already unique, instead of
   * each having to decide for itself which of two rows a pointer meant.
   *
   * The archive is deliberately left out. Its rows go through
   * `readSessionItem` for the same defence, but nothing points into an
   * archived sitting: `sceneId` and `board.openScene` are resolved against the
   * live plan and nothing else, so there is no question there to answer yet.
   */
  const takenRowIds = new Set(rows.map((i) => i.id));
  const seenRowIds = new Set<string>();
  const session = rows.map((item) => {
    if (!seenRowIds.has(item.id)) {
      seenRowIds.add(item.id);
      return item;
    }
    warn('two rows in the session list had the same id, so the later ones were given new ones');
    let fresh = newId();
    for (let n = 2; takenRowIds.has(fresh); n += 1) fresh = `${newId()}-${String(n)}`;
    takenRowIds.add(fresh);
    seenRowIds.add(fresh);
    if (item.kind === 'countdown' && item.countdown.id === item.id) {
      return { ...item, id: fresh, countdown: { ...item.countdown, id: fresh } };
    }
    return { ...item, id: fresh };
  });

  /*
   * Two pointers into this list, answered under one policy.
   *
   * A countdown row's `sceneId` and `board.openScene` both name a row by id,
   * and both are reachable dangling: a hand-edited file, a row deleted by a
   * build that did not know about the pointer, two builds writing one
   * campaign. ONE policy rather than an `if` beside each field deciding for
   * itself, because the third pointer is coming - an archived sitting's source,
   * a nested row's parent - and three policies in three places is how they
   * diverge.
   *
   * DEGRADE, NEVER VANISH: a clock whose scene is gone becomes the campaign's,
   * visible everywhere, which is `readLinkTarget`'s `unknown` policy and
   * `Countdown.owner`'s.
   *
   * This pointer's set is EVERY row's id, not every scene row's. An
   * `unreadable` row keeps its id precisely so a build that cannot parse it
   * still cannot lose it; nulling a pointer at one, and letting `writeAside`
   * write that back, is how that arm's whole purpose gets defeated. The board's
   * pointer below takes a NARROWER set, and the two differing is the policy
   * being applied rather than abandoned - the argument for the difference is
   * written where that pointer is repaired.
   */
  const rowIds = new Set(session.map((i) => i.id));
  const scoped = session.map((item) => {
    if (item.kind !== 'countdown' || item.sceneId === null) return item;
    if (!rowIds.has(item.sceneId)) {
      warn('a countdown belonged to a scene this campaign no longer has, so it is the campaign’s again');
      return { ...item, sceneId: null };
    }
    if (item.primary) {
      warn('a countdown was both pinned to the top bar and given to a scene, so the pin was cleared');
      return { ...item, primary: false };
    }
    return item;
  });

  /*
   * At most one primary countdown, decided here rather than trusted.
   *
   * Two rows both claiming to be the one the GM is watching is not a state any
   * screen can draw honestly, and it is reachable from a hand-edited file or
   * from two builds writing the same campaign. The first in list order wins,
   * which is at least stable across reads.
   *
   * **It runs on `scoped`, and the order is not a preference.** The dedupe
   * keeps the FIRST primary row in array order and clears every later one. If
   * that first row is one a scene owns, deduping first would keep it and clear
   * a legitimate pin further down - and then the scope repair would clear the
   * first one too. Zero primary rows, an empty top bar, and the GM's real pin
   * destroyed. So: strip the scoped primaries, then dedupe what is left.
   */
  let seenPrimary = false;
  const deduped = scoped.map((item) => {
    if (item.kind !== 'countdown' || !item.primary) return item;
    if (seenPrimary) {
      warn('more than one countdown was marked as the primary one, so only the first was kept');
      return { ...item, primary: false };
    }
    seenPrimary = true;
    return item;
  });
  deduped.sort((a, b) => a.order - b.order);

  const rawFear = record['fear'];
  const fear = clampFear(rawFear);
  if (typeof rawFear === 'number' && Number.isFinite(rawFear) && Math.round(rawFear) !== fear) {
    warn(`the Fear pool held ${String(rawFear)}, which is outside 0-${String(MAX_FEAR)}, so it was brought back inside`);
  }

  const board = isRecord(record['board']) ? record['board'] : {};
  const region = board['region'];
  const tier = Math.round(num(board['partyTier'], 1));

  /*
   * The second pointer, in this same repair pass and under a DIFFERENT set, and
   * the difference is the point rather than a divergence.
   *
   * A countdown's `sceneId` is checked against EVERY row's id, because an
   * `unreadable` row keeps its id precisely so a build that cannot parse it
   * cannot lose it. `openScene` is checked against SCENE rows only, because it
   * names the row the RUNNER has to draw: pointed at a countdown row, or at an
   * `unreadable` one, it would open an empty scene with no explanation on it
   * and no way back.
   *
   * SILENT, where `liveScene` had to warn. `liveScene` owned a fight, so a
   * dangling one meant a fight with no home and the GM had to be told about it.
   * This owns nothing at all: what dangles is which screen you were on, and
   * every fight is on its own row either way. The sentence that stood here -
   * *"the fight on the board came from a scene this campaign no longer has, so
   * it belongs to no row"* - is deleted rather than reworded, because a warning
   * that fires when nothing was lost is how a real warning stops being read.
   */
  const sceneIds = new Set(session.flatMap((i) => (i.kind === 'scene' ? [i.id] : [])));
  const rawOpen = board['openScene'];
  const openScene = typeof rawOpen === 'string' && sceneIds.has(rawOpen) ? rawOpen : null;

  const campaign: Campaign = {
    id,
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    name: str(record['name']),
    createdAt: str(record['createdAt']),
    updatedAt: str(record['updatedAt']),
    fear,
    session: deduped.map((item, i) => ({ ...item, order: i })),
    /*
     * Ordered by `closedAt` here rather than trusted, the same way the session
     * list's `order` is re-sorted rather than believed. A file whose archive
     * arrived shuffled still reads back as a history in the order it happened.
     */
    archive: (Array.isArray(record['archive']) ? record['archive'] : [])
      .map((a, i) => readArchivedSession(a, i, newId, warn))
      .sort((a, b) => a.closedAt.localeCompare(b.closedAt)),
    register: (Array.isArray(record['register']) ? record['register'] : []).map((e) =>
      readRegisterEntry(e, newId, warn),
    ),
    party: (Array.isArray(record['party']) ? record['party'] : []).flatMap((m) =>
      readPartyMember(m, warn),
    ),
    board: {
      region: GM_REGIONS.includes(region as GmRegion) ? (region as GmRegion) : 'encounter',
      partyTier: (tier >= 1 && tier <= 4 ? tier : 1) as Tier,
      roster: readRoster(board['roster']),
      adjustments: readAdjustments(board['adjustments']),
      environmentRef:
        typeof board['environmentRef'] === 'string' ? board['environmentRef'] : null,
      openScene,
    },
  };

  return { campaign, warnings };
}

/** Walk a campaign record forward to this build's campaign schema. */
export function migrateCampaignRecord(record: Record<string, unknown>): MigrationResult {
  const from = versionOf(record, CAMPAIGN_SCHEMA_VERSION);
  checkReadable(from, CAMPAIGN_SCHEMA_VERSION, OLDEST_READABLE_CAMPAIGN);
  const { record: converted, applied } = applyChain(
    record,
    from,
    CAMPAIGN_SCHEMA_VERSION,
    CAMPAIGN_MIGRATIONS,
  );
  return { record: { ...converted, schemaVersion: CAMPAIGN_SCHEMA_VERSION }, from, applied };
}
