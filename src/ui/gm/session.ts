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
 * What is deliberately **not** here yet: the `newScene` / `newEncounter` /
 * `newLink` factories the ADD sheet will need. Nothing in this build can add a
 * row of those three kinds, so a factory for them would be an exported symbol
 * with no caller - which `tests/harness/orphans.test.ts` reports, correctly, as
 * a feature shipped switched off. They land with the sheet that calls them.
 */
import type { Dataset } from '../../../shared/types.ts';
import type { CountdownKind } from '../../engine/encounter.ts';
import type { DatasetIndex } from '../../engine/character.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';

export const SESSION_KIND_LABEL: Record<SessionItem['kind'], string> = {
  scene: 'Scene',
  encounter: 'Encounter',
  link: 'Link',
  countdown: 'Countdown',
  unreadable: 'Unreadable item',
};

/**
 * The 3px stripe down the left of a row.
 *
 * `unreadable` gets `--stress` rather than `--damage`: nothing is wrong with
 * the record, this build simply has no screen for it, and painting it the same
 * colour as a defeated adversary would say the opposite.
 */
export const SESSION_KIND_COLOR: Record<SessionItem['kind'], string> = {
  scene: 'var(--sage)',
  encounter: 'var(--damage)',
  link: 'var(--codex)',
  countdown: 'var(--muted)',
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
    case 'unreadable':
      // Deliberately says nothing about `raw`. The bytes are shown in full when
      // the row is opened; a summary that tried to preview them would be the
      // one line on this screen made of somebody else's JSON.
      return 'KEPT, NOT READ';
  }
}
