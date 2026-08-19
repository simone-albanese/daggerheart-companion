/**
 * The doors behind SHOW, as data, because four files have to agree about them.
 *
 * `ShowSheet.tsx` draws these as the sheet's choices and is where the argument
 * for the sheet itself lives. What is here is only the list and the two joins
 * that turn it into English, and it is a module of its own for a reason that is
 * not tidiness: **`Settings.tsx` is one of the four readers**, and `Settings`
 * and `Gm` are separate `lazy()` chunks (`App.tsx`).
 *
 * That cost was measured rather than assumed, because the obvious version of
 * the sentence is wrong. Pointing Settings at `ShowSheet.tsx` for this does
 * *not* put the rules search into the Settings chunk - Rollup moves the shared
 * modules into the chunk the two screens both import instead. `npx vite build`,
 * one import changed and nothing else: the shared chunk goes from **13.76 kB to
 * 26.53 kB** (5.44 to 9.66 gzipped) and `Gm` drops from 142.87 to 130.04,
 * because `ShowSheet` and `RuleSearch` leave the GM chunk to sit in the one
 * Settings has to load. A settings screen would pay about 12.8 kB - 4.2
 * gzipped - of a GM bottom sheet it never renders, to answer a question about
 * three booleans. Splitting the list off costs nothing: this module imports
 * only types, so it compiles to no runtime imports at all.
 *
 * The four, and what each asks:
 *
 *   - `ShowSheet.tsx`  which choices to draw
 *   - `GmBar.tsx`      whether the SHOW verb exists at all
 *   - `Gm.tsx`         what to call the dialog a screen reader announces
 *   - `Settings.tsx`   whether to print the "SHOW leaves the bar" notice
 *
 * Every one of those four used to name `gmBestiary` and `gmPartyBoard` for
 * itself, and that held for exactly as long as there were two doors. Adding a
 * third to four hand-written pairs is four edits in four files with nothing but
 * a reviewer between a missed one and a screen claiming a tool it does not
 * offer - and three of the four would have failed *quietly*: a missed `GmBar`
 * hides SHOW from a GM whose only live tool is the new one, a missed `Gm.tsx`
 * announces a sheet that is not there, and a missed `Settings.tsx` simply never
 * prints a notice. Only `ShowSheet` itself would have been obvious. A fourth
 * door is now one row in this array.
 */
import type { Prefs } from '../../store/prefs.ts';
import type { GmRegion } from './gmStore.ts';

/** The three preferences that decide which doors SHOW has. */
export type ShowPref = 'gmBestiary' | 'gmPartyBoard' | 'gmMerchant';

export interface ShowDoor {
  tool: GmRegion;
  pref: ShowPref;
  /** The button, in the strip caps every choice on this screen wears. */
  label: string;
  /**
   * The same door inside a sentence: lowercase, article and all.
   *
   * One case, stored once, because two separate sentences put these words in
   * different positions - `Gm.tsx` names the sheet a screen reader hears, and
   * `MenuSheet.tsx` says where the tools it does not repeat are - and both of
   * them sometimes start a sentence with one. A second field per door for the
   * capitalised form would be two spellings of one name and a place for them to
   * drift apart; `sentenceCase` below is the cost of not having it.
   */
  name: string;
  body: string;
}

/**
 * Each door, and the preference that decides whether it is offered.
 *
 * All three are switchable in Settings, and a door switched off is *absent*
 * from the sheet rather than present and disabled: SHOW exists to be answered
 * in one tap, and a greyed choice makes the GM read a row that was never going
 * to open. With all three off `ShowSheet` is never rendered at all - `GmBar`
 * drops SHOW entirely - so the empty case is a state the screen cannot be in
 * rather than one that component has to draw.
 *
 * The order is the order they arrived in, and it is the order they are drawn,
 * announced and named in. A GM who has been opening the bestiary from the top
 * of that sheet for a month keeps it at the top.
 */
export const SHOW_DOORS: readonly ShowDoor[] = [
  {
    tool: 'bestiary',
    pref: 'gmBestiary',
    label: 'BESTIARY',
    name: 'the bestiary',
    body: 'Read the adversaries and environments this dataset carries, without adding any of them to tonight. An adversary can still be sent straight to the live scene from there.',
  },
  {
    tool: 'party',
    pref: 'gmPartyBoard',
    label: 'THE PARTY BOARD',
    name: 'the party board',
    body: 'The sheets the players sent you, as they arrived, beside whatever you have marked on them since. Nothing here ever writes to their characters.',
  },
  {
    tool: 'merchant',
    pref: 'gmMerchant',
    label: 'THE MERCHANT',
    name: 'the merchant',
    body: 'What a stall has on the counter tonight, over what the SRD says things cost. It draws stock and prints prices; it never spends anybody’s gold, and no character on this device is touched by it.',
  },
];

/** The doors this build is prepared to open, in the array's order. */
export const liveDoors = (prefs: Prefs): ShowDoor[] =>
  SHOW_DOORS.filter((door) => prefs[door.pref] === true);

/**
 * `a`, `a and b`, `a, b and c` - the join the two sentences built from this
 * list need.
 *
 * No serial comma, which is this app's prose everywhere else, and no attempt at
 * anything cleverer: the only lists it is ever handed are door names, and the
 * one fixed tail `Gm.tsx` adds for the rules search.
 */
export function andList(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

/**
 * A door's name at the start of a sentence.
 *
 * Only the first letter moves. Every name in `SHOW_DOORS` is stored lowercase
 * because that is the form used most, and none of them is a proper noun, so
 * there is nothing here for a locale to get wrong.
 */
export const sentenceCase = (text: string): string =>
  text === '' ? '' : text.charAt(0).toUpperCase() + text.slice(1);
