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
 * The three factories at the foot are the other half of the same argument.
 * They were deliberately absent while nothing could add a row, because an
 * exported factory with no caller is what `tests/harness/orphans.test.ts`
 * reports as a feature shipped switched off; `AddSheet.tsx` is the caller, and
 * they arrive with it.
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
import { displayUrl } from '../../../shared/externalLink.ts';
import { plainTextOf } from '../../../shared/richText.ts';

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

const rosterTotal = (roster: readonly { count: number }[]): number =>
  roster.reduce((sum, entry) => sum + entry.count, 0);

/**
 * The one line a shut row shows on its right.
 *
 * Every arm answers, including the two that exist only because this app refuses
 * to drop what it cannot read. It is never a count that hides a name: a scene
 * says which environment it is set in, not "1 environment", because the reason
 * a GM scans this list is to find the row they are thinking of.
 */
export function describeItem(item: SessionItem, dataset: Dataset, index: DatasetIndex): string {
  switch (item.kind) {
    case 'scene': {
      if (item.environmentRef === null) return 'NO ENVIRONMENT';
      const found: unknown = index.byRef.get(item.environmentRef);
      return namedRecord(found) ? found.name.toUpperCase() : NOT_HERE;
    }
    case 'encounter': {
      const planned = rosterTotal(item.roster);
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
// The three rows ADD mints
// ---------------------------------------------------------------------------

/*
 * Three things are the same in all three, and each is a decision rather than a
 * default.
 *
 * `order` stays 0. `addSessionItem` stamps `session.length` as the row goes in,
 * and a factory that also guessed would be a second opinion about a number only
 * the store can hold - the kind of duplicate authority that ends with two rows
 * claiming position 4.
 *
 * `collapsed` is true. A row that arrived open would push the rest of the night
 * off a 393px phone at the moment it is added, and the GM has just typed
 * everything the open row would show them. `addCountdown` mints its row the
 * same way for the same reason, so the four kinds ADD offers cannot disagree
 * about it.
 *
 * `id` is last with a `crypto.randomUUID()` default - `upsertMember`'s shape -
 * so a test can pin an id and the app never has to.
 */

export function newScene(
  name: string,
  environmentRef: Ref | null,
  id: string = crypto.randomUUID(),
): SessionItem {
  return { id, kind: 'scene', name: name.trim(), order: 0, collapsed: true, environmentRef };
}

/**
 * A planned fight.
 *
 * `combatants` is empty and has to be: the row's combatant list is the *fight*,
 * and nothing in `gmStore` sets one wholesale, so a factory that invented one
 * would write a field no control can ever change again. The roster and the
 * adjustments are copied rather than aliased - they come from the live board,
 * and a plan that changed when the board changed would not be a plan.
 */
export function newEncounter(
  name: string,
  roster: readonly RosterEntry[],
  adjustments: EncounterAdjustments,
  id: string = crypto.randomUUID(),
): SessionItem {
  return {
    id,
    kind: 'encounter',
    name: name.trim(),
    order: 0,
    collapsed: true,
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
