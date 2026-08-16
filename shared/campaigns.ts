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
 * if the constant went up by one. `CAMPAIGN_MIGRATIONS` is empty today for the
 * same reason `MIGRATIONS` is, and for the same reason that is the correct
 * content rather than an omission: the machinery has to be in place before the
 * first bump, because after it it is too late.
 */
import {
  applyChain,
  checkReadable,
  versionOf,
  type Migration,
  type MigrationResult,
} from './migrations.ts';
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

export const CAMPAIGN_SCHEMA_VERSION = 1;

/**
 * The lowest campaign schema any build has ever written.
 *
 * One, because this is the first: unlike `OLDEST_READABLE`, which is 3 in
 * order not to invent a history to be compatible with, there is genuinely
 * nothing older here.
 */
export const OLDEST_READABLE_CAMPAIGN = 1;

/** Empty, and correct. See the header, and `MIGRATIONS` in `migrations.ts`. */
export const CAMPAIGN_MIGRATIONS: readonly Migration[] = [];

// ---------------------------------------------------------------------------
// The session list
// ---------------------------------------------------------------------------

/**
 * What a link may point at.
 *
 * Every one of these is *inside the app*. A link is never an external URL, and
 * that is a decision rather than an omission: this app's strongest claim is
 * that it makes exactly one kind of network request and it is same-origin, and
 * a session list full of `https://` would quietly end that. A GM who wants a
 * web page has a browser.
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

export const SESSION_ITEM_KINDS = ['scene', 'encounter', 'link', 'countdown'] as const;
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
 * The four kinds are the wireframe's. The fifth is the same idea as the
 * `unknown` link target one level down: an item this build cannot read is kept
 * exactly as it arrived, wrapped in something renderable, rather than dropped
 * from a list whose length the GM knows by heart.
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
  | (SessionItemBase & { kind: 'unreadable'; why: string; raw: string });

// ---------------------------------------------------------------------------
// The campaign
// ---------------------------------------------------------------------------

export type GmRegion = 'encounter' | 'scene' | 'party' | 'bestiary' | 'countdowns';

const REGIONS: readonly GmRegion[] = ['encounter', 'scene', 'party', 'bestiary', 'countdowns'];

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
export const countdownsOf = (c: Campaign): Countdown[] =>
  c.session.flatMap((item) => (item.kind === 'countdown' ? [item.countdown] : []));

export const primaryCountdownOf = (c: Campaign): Countdown | null => {
  const item = c.session.find((i) => i.kind === 'countdown' && i.primary);
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
 */
function readSessionItem(v: unknown, index: number, newId: () => string): SessionItem {
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
    readSessionItem(item, i, newId),
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
