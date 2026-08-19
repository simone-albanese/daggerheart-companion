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
 * now been cashed. The version is 2, and the chain has one entry in it.
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
  versionOf,
  type Migration,
  type MigrationResult,
} from './migrations.ts';
import { readNoteDoc, type NoteDoc } from './richText.ts';
import {
  MAX_FEAR,
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

export const CAMPAIGN_SCHEMA_VERSION = 2;

/**
 * The lowest campaign schema any build has ever written.
 *
 * One, because that is where this schema started: unlike `OLDEST_READABLE`,
 * which is 3 in order not to invent a history to be compatible with, there is
 * genuinely nothing older here.
 *
 * It stays 1 across the bump to 2, exactly as `OLDEST_READABLE` stayed 3
 * across P1-7. Every campaign already in an IndexedDB and every `.dhcampaign`
 * already on a disk is a schema-1 record, and 1 is precisely the version the
 * chain below now leaves.
 */
export const OLDEST_READABLE_CAMPAIGN = 1;

/**
 * The chain, one entry per campaign schema this build has left behind.
 *
 * The first and only entry is 2026-08-18's, and it is deliberately empty of
 * work. See the header: the version moved so that older builds *refuse* a
 * record carrying a `url` or `note` row, not because anything in a v1 record
 * is wrong. There is no field to add, no field to rename and no field to drop,
 * so the honest converter is the one that copies the record and says so.
 */
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
 */
export const SESSION_ITEM_KINDS = [
  'scene',
  'encounter',
  'link',
  // Item 12's `url` joins here, beside the in-app link it is the outward half of.
  'countdown',
  //
  // One kind per line, and the two seats deliberately apart. Item 12 and item
  // 14 are separate lanes, and this literal is the one line in this file both
  // of them have to widen - two insertions at one point in it is the merge
  // conflict the shape exists to avoid.
  //
  // Item 14's `note` joins here, at the end.
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
  | (SessionItemBase & { kind: 'scene'; environmentRef: Ref | null })
  | (SessionItemBase & {
      kind: 'encounter';
      roster: RosterEntry[];
      adjustments: EncounterAdjustments;
      combatants: SceneCombatant[];
    })
  | (SessionItemBase & { kind: 'link'; target: LinkTarget })
  | (SessionItemBase & { kind: 'countdown'; countdown: Countdown; primary: boolean })
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
  | 'names';

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
 * **It has now happened twice, and the second time is what makes it a rule
 * rather than an exception.** P5-3 added `'reference'`; the name generator adds
 * `'names'`. Architecture §6.1 is titled "The one exception, and why it is only
 * one" and argues the case as a single admitted breach - that title is no longer
 * true of this file, and the section needs rewriting into what the argument
 * always actually was: not "one exception", but a standing licence for *this
 * field*, granted because the field is ephemeral navigation state and revocable
 * the moment anything but navigation is stored in it. The rewrite belongs to
 * whoever owns the docs; this comment is here so the contradiction is not
 * discovered by someone trusting the title.
 */
const REGIONS: readonly GmRegion[] = [
  'encounter',
  'scene',
  'party',
  'bestiary',
  'countdowns',
  'reference',
  'names',
];

/**
 * The live table: what is in front of the GM right now, in this campaign.
 *
 * Separate from the session list because it is the *fight*, not the plan. The
 * one promise `gmStore` has always made is that a GM who reloads mid-combat
 * keeps the combat, and that promise now has to survive switching campaign as
 * well - so the board belongs to the campaign rather than to the app.
 */
export interface GmBoard {
  region: GmRegion;
  partyTier: Tier;
  roster: RosterEntry[];
  adjustments: EncounterAdjustments;
  combatants: SceneCombatant[];
  environmentRef: Ref | null;
}

export interface Campaign {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  fear: number;
  session: SessionItem[];
  /** Whole sheets, on purpose. See the header of `src/ui/gm/party.ts`. */
  party: PartyMember[];
  board: GmBoard;
}

export const emptyBoard = (): GmBoard => ({
  region: 'encounter',
  partyTier: 1,
  roster: [],
  adjustments: { easier: false, harder: false, damageBump: false },
  combatants: [],
  environmentRef: null,
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
 */
export const withPrimaryCountdown = (session: SessionItem[], id: string | null): SessionItem[] =>
  session.map((item) =>
    item.kind === 'countdown' ? { ...item, primary: item.id === id } : item,
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

const readCombatants = (v: unknown): SceneCombatant[] =>
  (Array.isArray(v) ? v : []).flatMap((entry) => {
    if (!isRecord(entry) || typeof entry['id'] !== 'string') return [];
    const minions = entry['minionsRemaining'];
    return [
      {
        id: entry['id'],
        adversaryRef: str(entry['adversaryRef']),
        name: str(entry['name']),
        hp: readCounter(entry['hp']),
        stress: readCounter(entry['stress']),
        thresholds: readThresholds(entry['thresholds']),
        difficulty: num(entry['difficulty'], 0),
        spotlighted: bool(entry['spotlighted']),
        ...(typeof minions === 'number' ? { minionsRemaining: minions } : {}),
        notes: str(entry['notes']),
      },
    ];
  });

const COUNTDOWN_KINDS: readonly CountdownKind[] = ['standard', 'dynamic', 'loop', 'long-term'];

const readCountdown = (v: unknown, id: string, name: string): Countdown => {
  const r = isRecord(v) ? v : {};
  const kind = r['kind'];
  const start = Math.max(1, Math.round(num(r['start'], 1)));
  return {
    id: str(r['id'], id),
    name: str(r['name'], name),
    kind: COUNTDOWN_KINDS.includes(kind as CountdownKind) ? (kind as CountdownKind) : 'standard',
    start,
    value: Math.max(0, Math.min(start, Math.round(num(r['value'], start)))),
    notes: str(r['notes']),
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
 * A board row, or nothing.
 *
 * The one place in this file that drops something, and it is the rule
 * `gmStore.load()` already had: a row with no sheet has no numbers to derive
 * and takes the whole screen down on first render. Everything else here is
 * repaired rather than discarded, because everything else can be.
 */
function readPartyMember(v: unknown, warn: (s: string) => void): PartyMember[] {
  if (!isRecord(v) || typeof v['id'] !== 'string') return [];
  const sheet = v['sheet'];
  if (!isRecord(sheet) || typeof sheet['name'] !== 'string') {
    warn('a party row arrived with no character sheet on it, so the row was left out');
    return [];
  }
  const source = v['source'];
  return [
    {
      id: v['id'],
      sheet: sheet as unknown as PartyMember['sheet'],
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
      return {
        ...base,
        kind: 'scene',
        environmentRef: typeof r['environmentRef'] === 'string' ? r['environmentRef'] : null,
      };
    case 'encounter':
      return {
        ...base,
        kind: 'encounter',
        roster: readRoster(r['roster']),
        adjustments: readAdjustments(r['adjustments']),
        combatants: readCombatants(r['combatants']),
      };
    case 'link':
      return { ...base, kind: 'link', target: readLinkTarget(r['target']) };
    case 'countdown':
      return {
        ...base,
        kind: 'countdown',
        countdown: readCountdown(r['countdown'], base.id, base.name),
        primary: bool(r['primary']),
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

  const session = (Array.isArray(record['session']) ? record['session'] : []).map((item, i) =>
    readSessionItem(item, i, newId, warn),
  );
  for (const item of session) {
    if (item.kind === 'unreadable') warn(`one item in the session list could not be read: ${item.why}`);
  }

  /*
   * At most one primary countdown, decided here rather than trusted.
   *
   * Two rows both claiming to be the one the GM is watching is not a state any
   * screen can draw honestly, and it is reachable from a hand-edited file or
   * from two builds writing the same campaign. The first in list order wins,
   * which is at least stable across reads.
   */
  let seenPrimary = false;
  const deduped = session.map((item) => {
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

  const campaign: Campaign = {
    id,
    schemaVersion: CAMPAIGN_SCHEMA_VERSION,
    name: str(record['name']),
    createdAt: str(record['createdAt']),
    updatedAt: str(record['updatedAt']),
    fear,
    session: deduped.map((item, i) => ({ ...item, order: i })),
    party: (Array.isArray(record['party']) ? record['party'] : []).flatMap((m) =>
      readPartyMember(m, warn),
    ),
    board: {
      region: REGIONS.includes(region as GmRegion) ? (region as GmRegion) : 'encounter',
      partyTier: (tier >= 1 && tier <= 4 ? tier : 1) as Tier,
      roster: readRoster(board['roster']),
      adjustments: readAdjustments(board['adjustments']),
      combatants: readCombatants(board['combatants']),
      environmentRef:
        typeof board['environmentRef'] === 'string' ? board['environmentRef'] : null,
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
