/**
 * The question catalogue: what a GM asks under pressure, and where the book
 * answers it.
 *
 * ## An entry stores a question and a pointer. It has no answer field.
 *
 * That is the whole reason this is shippable at all, and it is a licence
 * property before it is a design one. `AskEntry` below carries `ask`, `also`,
 * `at` and `moment` and nothing else: no `answer`, no `page`, no `title`. The
 * words of the rule come out of `dataset.rules` at draw time through
 * `ruleSection`, and the page stamp comes off `sourcePage` the same way, so
 * nothing of the SRD is ever retyped into this repository and no stamp is a
 * number somebody here believed. `tests/gm/ask.test.ts` asserts the shape of
 * every shipped entry against that list of four keys, because a `answer:` added
 * with a cast would typecheck at the call site that added it.
 *
 * What this repo writes, then, is the *question* - the sentence a GM says to
 * themselves at the table - and an address. The book keeps the answer.
 *
 * ## Twelve, and why twelve is not a smaller forty-eight
 *
 * `DECISIONI-2026-08-23.md` §9 fixed the size at 48 and left the growth rule to
 * the table: entry 49 is written when a GM notices themselves reaching for
 * something twice, not chosen from a list drawn up in advance.
 * `DECISIONI-2026-08-25.md` §4 answered the question that one left open - who
 * writes them - with a seed of ten to twelve, and gave the seed a criterion
 * that is not coverage: **the questions the SRD does not answer.**
 *
 * That criterion is measurable, and it was measured rather than felt. Grepped
 * against the shipped rules text: `surrender` 0 hits, `concede` 0, `chase` 0,
 * `difficulty roll` 0, `nearly impossible` 0, `lines and veils` 0. A GM who
 * types any of those into the field above gets the honest silence
 * `RuleSearch.tsx` draws - the search reads every word of every section and
 * those words are not in it - and that silence is correct and useless. Each of
 * the twelve below turns one of those dead ends into the nearest thing the book
 * *does* say, which is the ruling a GM is actually going to make.
 *
 * The floor is the reason there are twelve rather than four. `PROGETTO-GM` §4
 * puts it plainly: below about a dozen entries a catalogue "only answers what
 * you already have memorised", because the questions rare enough to be worth
 * writing down are the ones a short list will not contain. Twelve is the top of
 * the range the owner set, and it is the top rather than the bottom for that
 * reason.
 *
 * ## English, decided rather than defaulted
 *
 * `HANDOFF-2026-08-25.md` §2.2: the questions are written in English, against
 * English SRD answers. The question was real - the app's documents are in
 * Italian and its screens are not - and it was the owner's to settle, not the
 * implementer's. What the repo already did is the supporting evidence rather
 * than the decision: the field's own placeholder reads `Search N rules
 * sections`, and `ShowSheet.tsx` states the standing rule for this surface in
 * as many words, that the words on the buttons are English because the rest of
 * the app is. (A refutation of the plan behind this file said that sentence
 * existed in no file of the repository. It exists; it is in `ShowSheet.tsx`,
 * not in `showDoors.ts` where the plan looked for it. The attribution was
 * wrong, not the quotation.)
 *
 * A question is also matched against the answer it points at, and the answers
 * are the book's, which are English. A catalogue in Italian would have been an
 * index in one language over a text in another - workable for `also`, which
 * this file writes, and not for the phrase a GM half-remembers off the page.
 *
 * ## The data is behind a dynamic `import()`, and the specifier is literal
 *
 * `ASK_CATALOGUE` lives in `askCatalogue.ts` and is reached from `loadAsk`
 * below by `import('./askCatalogue.ts')` - one module, one literal string. That
 * is `PROGETTO-GM` §4's one hard constraint on how this ships, and it is a
 * constraint about the service worker rather than about weight: `public/sw.js`
 * infers its precache by regexing the built chunks, and its `JS_IMPORTS`
 * pattern matches **only `.js` and `.css`**. A catalogue kept as JSON and
 * fetched, or reached through a computed specifier, is invisible to that walk -
 * it would be absent offline, which is the one condition this whole app is for.
 *
 * At twelve entries the split buys no bytes worth counting; it is here now
 * because the shape is what the constraint is about, and a catalogue that grows
 * toward the ~150 §4 imagines should not have to be split on the day it gets
 * heavy. The matcher stays on this side of the boundary because it runs on
 * every keystroke; the strings stay on the other side because they are only
 * wanted once the sheet is open.
 *
 * `loadAsk` resolves `[]` if that import fails rather than throwing. A missing
 * chunk means the GM has the search and not the questions, which is the state
 * this surface was in before this file existed; a rejected promise inside a
 * render path would mean no search either.
 */
import type { Ref } from '../../../shared/types.ts';
import { ruleTerms } from './srdReference.ts';

/**
 * The six moments, in the order they are drawn.
 *
 * They are `PROGETTO-GM` §4's own six, verbatim, and the argument for them is
 * §4's: **a GM knows what just happened, not what the rule is called.** The
 * spine of the SRD is a table of contents - *Attacking*, *Conditions*,
 * *Optional GM Mechanics* - and none of those is the sentence in a GM's head
 * while five people wait. `DAMAGE` is.
 *
 * `Moment` is the union of the ids rather than of the labels, so a chip's
 * wording can be repaired without rewriting twelve entries; the label is what
 * the screen draws and what a query is matched against.
 */
export const MOMENTS: readonly { id: Moment; label: string }[] = [
  { id: 'before-the-roll', label: 'BEFORE THE ROLL' },
  { id: 'the-dice-landed', label: 'THE DICE LANDED' },
  { id: 'my-turn', label: 'MY TURN' },
  { id: 'damage', label: 'DAMAGE' },
  { id: 'this-place', label: 'THIS PLACE' },
  { id: 'between-scenes', label: 'BETWEEN SCENES' },
];

/** Which of the six a question belongs to. `null` is search-only. */
export type Moment =
  | 'before-the-roll'
  | 'the-dice-landed'
  | 'my-turn'
  | 'damage'
  | 'this-place'
  | 'between-scenes';

export interface AskEntry {
  /** Stable, and never drawn: `q-surrender`. Renaming one is a diff. */
  id: string;
  /** The app's own words, and they end in `?`. */
  ask: string;
  /**
   * The app's own words again, and this half is the index.
   *
   * `ask` is one phrasing of the question and a GM will not use it. These are
   * the other ways in - the word they will actually type, including the ones
   * the SRD does not contain at all, which is the whole reason the entry
   * exists. They are never drawn.
   */
  also: readonly string[];
  /**
   * Where the book comes nearest to answering it.
   *
   * `heading: null` means the section whole, which is right for the
   * thirty-three sections the SRD writes with no `## ` in them at all and for
   * the ones whose opening paragraphs are the answer.
   */
  at: { section: Ref; heading: string | null };
  moment: Moment | null;
}

/** The label a query is matched against, or `''` for a search-only entry. */
const momentLabel = (moment: Moment | null): string =>
  MOMENTS.find((m) => m.id === moment)?.label ?? '';

/**
 * The questions carrying every word the GM typed, in the catalogue's order.
 *
 * ## The same words `searchRules` throws away, thrown away here too
 *
 * `ruleTerms` is imported rather than reimplemented, so `how do I set the
 * difficulty` asks these entries for `set` and `difficulty` exactly as it asks
 * the sections for them, and a query of nothing but stopwords keeps its words
 * on both sides. Two matchers with two stopword lists would mean a phrase that
 * finds a question and no section, or the reverse, for a reason nobody could
 * see on the glass.
 *
 * ## Substring, where `searchRules` insists on a whole word
 *
 * The haystack is `ask`, `also` and the moment's label; a term has to be a
 * substring of it, and the sharper whole-word pass that `quoteFrom` runs over
 * the book is not run here. The two are different kinds of text. A section body
 * is a hundred thousand characters of prose the app did not write, where
 * `cover` inside `discover` is a false hit twelve sections wide. `also` is a
 * short list this repo wrote on purpose: `surrender` inside `surrenders` is the
 * same word, and there is nothing in these strings for a substring to collide
 * with that was not put there.
 *
 * ## No ranking, for the reason `searchRules` gives
 *
 * The catalogue's order is the answer's order. Weighting one question over
 * another would be the app deciding which question the GM meant, which is the
 * move the search beside it refuses; twelve entries and a band header that
 * prints the count is a list a GM reads rather than trusts.
 */
export function searchAsk(
  entries: readonly AskEntry[],
  query: string,
): readonly AskEntry[] {
  const needle = query.trim();
  if (needle === '') return [];
  const terms = ruleTerms(needle);
  return entries.filter((entry) => {
    const hay = `${entry.ask} ${entry.also.join(' ')} ${momentLabel(entry.moment)}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

/** Nothing, with a stable identity, so a render that has none does not churn. */
const NONE: readonly AskEntry[] = [];

let loaded: readonly AskEntry[] | null = null;
let arriving: Promise<readonly AskEntry[]> | null = null;

/**
 * The catalogue, fetched once per session and remembered.
 *
 * The promise is memoised rather than the call: `ShowSheet` warms this the
 * moment the sheet opens and the results ask for it again on the first
 * keystroke, and those are two calls that must not be two requests.
 */
export function loadAsk(): Promise<readonly AskEntry[]> {
  arriving ??= import('./askCatalogue.ts').then(
    (mod) => {
      loaded = mod.ASK_CATALOGUE;
      return loaded;
    },
    () => {
      loaded = NONE;
      return NONE;
    },
  );
  return arriving;
}

/**
 * The catalogue if it is already here, and `null` while it is not.
 *
 * A synchronous peek, so a component that mounts after the chunk has landed
 * draws the questions in its first render instead of in a second one. The
 * distinction between `null` and `[]` is the one that matters: `[]` is a
 * catalogue that arrived and is empty, `null` is one that has not arrived, and
 * only the second is worth waiting for.
 */
export const askLoaded = (): readonly AskEntry[] | null => loaded;
