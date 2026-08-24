/**
 * The vocabulary of a session row: what it is called, what colour it carries,
 * and the one line that has to say what is inside it while it is shut.
 *
 * It is a module of its own, with no React and no store in it, because the
 * defect this file exists to prevent is the closed row that says nothing
 * useful. `shared/campaigns.ts` deliberately keeps a row this build cannot
 * read rather than dropping it, and keeps a link whose target it has no screen
 * for; a summary that quietly renders those two as an empty string would undo
 * the whole point of that decision one level up. So every arm of both unions is
 * answered here, in a pure function, and `tests/gm/session.test.ts` asks each
 * arm the question directly rather than through a mounted screen.
 *
 * The colour map for countdown kinds moved here from `Countdowns.tsx`. Two
 * screens now draw a countdown - the countdowns board and a session row - and
 * two copies of "dynamic is orange" is how one of them ends up green.
 *
 * The factories at the foot are the other half of the same argument. They were
 * deliberately absent while nothing could add a row, because an exported
 * factory with no caller is what `tests/harness/orphans.test.ts` reports as a
 * feature shipped switched off; `AddSheet.tsx` is the caller, and they arrive
 * with it. There is one per kind ADD offers except the countdown, whose row
 * shares an id with the countdown inside it and is therefore minted in the
 * store - so the count here is never the count of arms `describeItem` answers.
 */
import type {
  Dataset,
  EncounterAdjustments,
  Ref,
  RosterEntry,
} from '../../../shared/types.ts';
import type { CountdownKind } from '../../engine/encounter.ts';
import type { DatasetIndex } from '../../engine/character.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';
import { displayUrl, readExternalUrl } from '../../../shared/externalLink.ts';
import { noteFromPlainText, plainTextOf } from '../../../shared/richText.ts';

export const SESSION_KIND_LABEL: Record<SessionItem['kind'], string> = {
  scene: 'Scene',
  encounter: 'Encounter',
  link: 'Link',
  countdown: 'Countdown',
  // "Link" is already taken by the four in-app ones, and two rows both reading
  // LINK with different behaviour is the worst of both. "Web link" says which.
  url: 'Web link',
  note: 'Note',
  unreadable: 'Unreadable item',
};

/**
 * The 3px stripe down the left of a row.
 *
 * `unreadable` gets `--stress` rather than `--damage`: nothing is wrong with
 * the record, this build simply has no screen for it, and painting it the same
 * colour as a defeated adversary would say the opposite.
 *
 * No two kinds share a token, and `tests/gm/session.test.ts` pins that. The
 * stripe's only job is to let a GM tell one row from another down a scrolling
 * list, so a duplicate is not a smaller version of the feature, it is the
 * feature switched off for that pair - which is why `url` did not simply take
 * `--codex` from `link` when it arrived.
 */
export const SESSION_KIND_COLOR: Record<SessionItem['kind'], string> = {
  scene: 'var(--sage)',
  encounter: 'var(--damage)',
  link: 'var(--codex)',
  countdown: 'var(--muted)',
  url: 'var(--grace)',
  note: 'var(--bone)',
  unreadable: 'var(--stress)',
};

export const COUNTDOWN_KIND_COLOR: Record<CountdownKind, string> = {
  standard: 'var(--muted)',
  dynamic: 'var(--stress)',
  loop: 'var(--codex)',
  'long-term': 'var(--sage)',
};

export const LINK_KIND_LABEL: Record<LinkTarget['kind'], string> = {
  adversary: 'Adversary',
  environment: 'Environment',
  domainCard: 'Card',
  rule: 'Rule',
  unknown: 'Unknown',
};

/** Said once, so the closed row and the open one cannot disagree about it. */
const NOT_HERE = 'NOT IN THIS DATASET';

/**
 * The name to draw, and whether the app made it up.
 *
 * `SessionItemBase.name` says the name is "never generated; an empty one stays
 * empty", and this is the other half of that promise: the row shows the kind
 * word when there is nothing to show, marks it as invented so the row can draw
 * it dimmed, and never writes it back onto the record.
 */
export function sessionTitle(item: SessionItem): { text: string; invented: boolean } {
  const given = item.name.trim();
  return given === ''
    ? { text: SESSION_KIND_LABEL[item.kind], invented: true }
    : { text: given, invented: false };
}

/**
 * The accessible name of a row, for the controls that act on it.
 *
 * Never an empty string, which is what "Delete " would announce as. It is the
 * GM's name when there is one, and otherwise the same kind word the eye sees.
 */
export const sessionName = (item: SessionItem): string => sessionTitle(item).text;

/** Anything in the dataset that has a name to print. */
const namedRecord = (value: unknown): value is { name: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { name?: unknown }).name === 'string';

/**
 * What this link points at, named, or null when this build cannot resolve it.
 *
 * Three of the four kinds are in `index.byRef`, which `indexDataset` fills from
 * adversaries, environments and domain cards among others - so they cost one
 * map lookup rather than a scan of 129 adversaries and 189 cards per row per
 * render. Rules are the exception: `indexDataset` never calls `put` on
 * `ds.rules`, so a rule has to be found in `dataset.rules` itself. That is a
 * property of the index rather than of this function, and it is checked by
 * `tests/gm/session.test.ts` so that a future index which does carry rules does
 * not leave this branch silently scanning a list it no longer needs to.
 */
export function linkName(
  target: LinkTarget,
  dataset: Dataset,
  index: DatasetIndex,
): string | null {
  if (target.kind === 'unknown') return null;
  if (target.kind === 'rule') {
    return dataset.rules.find((r) => r.id === target.ref)?.title ?? null;
  }
  const found: unknown = index.byRef.get(target.ref);
  return namedRecord(found) && found.name !== '' ? found.name : null;
}

/**
 * Whether the record this ref resolves to is a Minion, without asserting a type.
 *
 * `index.byRef` hands back `unknown` - it carries adversaries, environments and
 * domain cards in one map - so the role is read the same defensive way
 * `namedRecord` above reads a name. A ref this dataset cannot resolve answers
 * `false`, which is the arm below counting it as one adversary: there is no
 * role to read, and guessing that a missing ref was a Minion would multiply a
 * number nothing on this device can check.
 */
const minionRecord = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && (value as { role?: unknown }).role === 'Minion';

/**
 * How many adversaries a roster plans, which is not the sum of its counts.
 *
 * For a Minion the count is *groups*, each the size of the party.
 * `EncounterEntry.count` says so, `ROLE_COST` prices it that way - "per group
 * of Minions equal to the party size" - and both screens that draw a roster
 * spell it out: the builder's roster panel and the open encounter row both
 * read "3 GROUPS OF 4" where every other role reads "×3". So a roster holding
 * one Minion entry at 3 with a party of four plans twelve adversaries, and 3
 * is the number of groups.
 *
 * The party size is a parameter rather than a read, because this module has
 * neither React nor a store in it on purpose.
 */
const plannedAdversaries = (
  roster: readonly RosterEntry[],
  index: DatasetIndex,
  partySize: number,
): number =>
  roster.reduce(
    (sum, entry) => sum + entry.count * (minionRecord(index.byRef.get(entry.ref)) ? partySize : 1),
    0,
  );

/**
 * The one line a shut row shows under its name, beside the kind word.
 *
 * Every arm answers, including the two that exist only because this app refuses
 * to drop what it cannot read. It is never a count that hides a name: a scene
 * says which environment it is set in, not "1 environment", because the reason
 * a GM scans this list is to find the row they are thinking of.
 *
 * `partySize` is here for one arm. An encounter's Minion entries are groups
 * that size, so the count of adversaries cannot be reached without it - the
 * caller reads `prefs.gmPartySize`, which is the same number the open arm and
 * the builder expand those groups with.
 */
export function describeItem(
  item: SessionItem,
  dataset: Dataset,
  index: DatasetIndex,
  partySize: number,
): string {
  switch (item.kind) {
    case 'scene': {
      /*
       * A scene is a place *and* the fight in it since campaign schema 3, so a
       * shut row has to be able to say both. The two halves are joined only
       * when both exist: a row that read "NO ENVIRONMENT · NOTHING PLANNED"
       * would spend the whole width of a phone saying nothing twice.
       *
       * The order is place first because that is the half a GM scans for - the
       * plan is a list of *where tonight goes* - and because the fight half is
       * the one that is usually absent.
       */
      const planned = plannedAdversaries(item.roster, index, partySize);
      const fight = planned === 0 ? '' : `${String(planned)} PLANNED`;
      let place: string;
      if (item.environmentRef === null) {
        place = fight === '' ? 'NO ENVIRONMENT' : '';
      } else {
        const found: unknown = index.byRef.get(item.environmentRef);
        place = namedRecord(found) ? found.name.toUpperCase() : NOT_HERE;
      }
      if (place === '') return fight;
      return fight === '' ? place : `${place} · ${fight}`;
    }
    case 'encounter': {
      // Adversaries, not roster rows and not the sum of the counts. A Minion
      // entry at 3 is three *groups*, so a shut row that added the counts up
      // said "3 PLANNED" about a fight that opens with twelve bodies in it -
      // the same number saying the same wrong thing that `×3` said beside the
      // Minion's name on the open row until `ecf8017` corrected that one.
      const planned = plannedAdversaries(item.roster, index, partySize);
      return planned === 0 ? 'NOTHING PLANNED' : `${String(planned)} PLANNED`;
    }
    case 'link': {
      if (item.target.kind === 'unknown') {
        const word = item.target.named.trim();
        const tail = 'NOT A KIND THIS BUILD KNOWS';
        return word === '' ? tail : `${word.toUpperCase()} · ${tail}`;
      }
      const kind = LINK_KIND_LABEL[item.target.kind].toUpperCase();
      const name = linkName(item.target, dataset, index);
      return `${kind} · ${name === null ? NOT_HERE : name.toUpperCase()}`;
    }
    case 'countdown':
      // Not "0/6". A countdown at zero is the thing happening, and the word for
      // it is the word the countdowns board already uses out loud.
      return item.countdown.value === 0
        ? 'SPENT'
        : `${String(item.countdown.value)}/${String(item.countdown.start)}`;
    case 'url':
      // The host, not the whole address, and never the raw stored string:
      // `displayUrl` prints the parsed hostname, which is punycode, so a
      // homograph domain reads as `xn--pple-43d.com` on the shut row exactly
      // as it does on the open one. See mitigation 5 in `shared/externalLink.ts`.
      return item.href === '' ? 'NO ADDRESS' : displayUrl(item.href, 32).toUpperCase();
    case 'note': {
      // The note's own first words rather than a character count. A GM scans
      // this list to find the row they are thinking of, and "412 CHARACTERS"
      // is true of every note they have ever written.
      const text = plainTextOf(item.note).replace(/\s+/g, ' ').trim();
      return text === '' ? 'EMPTY NOTE' : text.slice(0, 40).toUpperCase();
    }
    case 'unreadable':
      // Deliberately says nothing about `raw`. The bytes are shown in full when
      // the row is opened; a summary that tried to preview them would be the
      // one line on this screen made of somebody else's JSON.
      return 'KEPT, NOT READ';
  }
}

// ---------------------------------------------------------------------------
// The rows ADD mints through a factory
// ---------------------------------------------------------------------------

/*
 * Three things are the same in every one of them, and each is a decision rather
 * than a default.
 *
 * `order` stays 0. `addSessionItem` stamps `session.length` as the row goes in,
 * and a factory that also guessed would be a second opinion about a number only
 * the store can hold - the kind of duplicate authority that ends with two rows
 * claiming position 4.
 *
 * `collapsed` is true. A row that arrived open would push the rest of the night
 * off a 393px phone at the moment it is added, and the GM has just typed
 * everything the open row would show them. `addCountdown` mints its row the
 * same way for the same reason, so no two kinds ADD offers can disagree about
 * it.
 *
 * `id` is last with a `crypto.randomUUID()` default - `upsertMember`'s shape -
 * so a test can pin an id and the app never has to.
 */

/**
 * A beat of the evening: a place, and the fight that happens in it.
 *
 * Since `CAMPAIGN_SCHEMA_VERSION` 3 this is the only factory ADD has for the
 * two, because decision 1 gave the scene row the encounter's three fields.
 * `newEncounter` is **gone rather than deprecated**: a factory nothing calls is
 * how a kind that is supposed to be uncreatable gets created again.
 *
 * `combatants` is empty and has to be: the row's combatant list is the *fight
 * as it is being fought*, and nothing in `gmStore` sets one wholesale, so a
 * factory that invented one would write a field no control can ever change
 * again. The roster and the adjustments are **copied rather than aliased** -
 * they come from the live board, and a plan that changed when the board changed
 * would not be a plan.
 *
 * Both default to empty, which is what a scene with no fight in it is. That is
 * the common case - most rows of a night are a place somebody talks in - and it
 * keeps "I planned a fight here" an explicit act rather than a side effect of
 * whatever happened to be on the board when the GM typed a name.
 *
 * ## Why this one takes a bag where its siblings take positions
 *
 * The note above says `id` is last with a `crypto.randomUUID()` default, and
 * that convention holds for every factory in this file that has three
 * parameters or fewer. This one grew to five at campaign schema 3, two of them
 * defaulted and in the middle, and five positional arguments is how a roster
 * ends up where the adjustments go - or how `newScene('The gate', null, 's1')`
 * silently passes an id as a roster. The compiler catches that one; it does not
 * catch two arguments of the same shape swapped.
 *
 * So `id` stays optional and stays last *inside the bag*, which keeps the
 * property the convention was protecting - a test can pin an id and the app
 * never has to - and drops the property that had stopped paying for itself.
 */
export function newScene(
  name: string,
  environmentRef: Ref | null,
  opts: {
    roster?: readonly RosterEntry[];
    adjustments?: EncounterAdjustments;
    id?: string;
  } = {},
): SessionItem {
  const {
    roster = [],
    adjustments = { easier: false, harder: false, damageBump: false },
    id = crypto.randomUUID(),
  } = opts;
  return {
    id,
    kind: 'scene',
    name: name.trim(),
    order: 0,
    collapsed: true,
    environmentRef,
    roster: roster.map((entry) => ({ ...entry })),
    adjustments: { ...adjustments },
    combatants: [],
  };
}

export function newLink(
  name: string,
  target: LinkTarget,
  id: string = crypto.randomUUID(),
): SessionItem {
  return { id, kind: 'link', name: name.trim(), order: 0, collapsed: true, target };
}

/**
 * A row pointing outside the app.
 *
 * The href is stored as `readExternalUrl` normalised it and never as the bytes
 * that were typed: the row, the export and the anchor all read the same string,
 * so there is no second spelling for a later reader to disagree about. A value
 * the reader refuses becomes `''`, which is the state `UrlArm` prints the
 * warning for - `readExternalUrl`'s invariant is that `href` is non-empty
 * exactly when `why` is empty, so storing `''` loses nothing a row can show.
 */
export function newUrl(name: string, raw: string, id: string = crypto.randomUUID()): SessionItem {
  return {
    id,
    kind: 'url',
    name: name.trim(),
    order: 0,
    collapsed: true,
    href: readExternalUrl(raw).href,
  };
}

/*
 * The two seats above and below are apart on purpose.
 *
 * Item 12 and item 14 are separate lanes; the two functions they add have
 * nothing to do with each other and are an additive change to this file either
 * way. What is not additive is both of them appending at one point, which is a
 * conflict in the last file either lane would expect to have one in. The same
 * shape is marked in `AddSheet.tsx` and in `SESSION_ITEM_KINDS`, and the ADD
 * sheet's header says it once for all of them.
 */

/**
 * A note row.
 *
 * `noteFromPlainText` and not a hand-built `NoteDoc`: it runs the text through
 * `readNoteDoc`, which is the same gate an imported campaign passes, so a note
 * this build writes and a note it reads back cannot be two different shapes.
 * The emphasis, headings and bullets the format carries are not typed here -
 * this mints paragraphs, and `NoteArm` draws whatever a stored note holds.
 */
export function newNote(name: string, text: string, id: string = crypto.randomUUID()): SessionItem {
  return { id, kind: 'note', name: name.trim(), order: 0, collapsed: true, note: noteFromPlainText(text) };
}
