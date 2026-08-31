/**
 * The book's own table of contents, read as data.
 *
 * Every other parser in this directory selects its material by a folio number
 * written into its source: `const FROM = 27` for ancestries, `APPENDIX_FROM =
 * 119` for the domain-card reference. Those numbers are correct and were
 * measured, and they are correct **for one book**. SRD 2.0 reflows 135 printed
 * pages into 224, so every one of them points somewhere else - and the failure
 * is not always loud. `parseDomainCards` throws, because an adversary where the
 * appendix should be does not look like a card; a range that happens to land on
 * plausible material would not throw at all.
 *
 * Both books print a contents page, and both print it in the same shape: a
 * title, a run of leaders, and the folio. So the numbers do not have to be
 * carried in the source at all - the book states them, and this reads them.
 *
 * ## Why the folio is taken from the runs and not from the line
 *
 * `line.text` is truncated before the number on every sub-entry: the leaders
 * are wide enough that the text is cut while the runs are not. Measured on both
 * books - SRD 1 line "Classes . . . ." with a final run `".8"`, SRD 2 line
 * "Ancestries........" with a final run `"32"`. The last run is where the folio
 * is, in both, and in SRD 1 it may arrive fused to the last leader dot.
 *
 * ## What this deliberately does not do
 *
 * It does not decide any parser's range. A chapter's material does not always
 * end where the next TOC entry begins - `loot.ts` covers Loot and Consumables
 * together, so its range runs from one sub-entry to the next top-level chapter -
 * and guessing that from indentation would be a rule with exceptions nobody
 * wrote down. `rangeBetween` takes both ends by name and each parser says which
 * two it means.
 */
import type { BookPage } from '../textLayout.ts';
import { ParseError } from './util.ts';

export interface ChapterEntry {
  /** As printed, minus the leaders. */
  title: string;
  /** The printed folio, which is what every parser's range is expressed in. */
  folio: number;
}

/** Fold the punctuation the two books disagree about, so a title can be matched. */
const key = (s: string): string =>
  s
    .normalize('NFKC')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[­​]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Read the contents page. Order is the book's, which is reading order. */
export function parseContents(pages: BookPage[]): ChapterEntry[] {
  const page = pages.find((p) => p.lines.some((l) => /^contents$/i.test(l.text.trim())));
  if (page === undefined) throw new ParseError('no contents page found', 'looked for a line reading CONTENTS');

  const out: ChapterEntry[] = [];
  for (const line of page.lines) {
    /*
     * The whole line, rebuilt from its runs, then split at the tail.
     *
     * Not "the last run is the folio, the rest is the title": that is what this
     * did first and it lost two entries per book. How a line divides into runs
     * is the extractor's business, not the book's - SRD 1 breaks every leader
     * dot into its own run and fuses the last one to the digit (`".8"`), while
     * SRD 2 can put title, leaders and folio in a SINGLE run
     * (`"INTRODUCTION.....3"`), which left nothing before it to be the title.
     * Rebuilding first and splitting on the shape of the text is the same rule
     * for both.
     */
    const joined = line.runs
      .map((r) => r.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const m = /^(.*?)[\s.]*(\d{1,3})$/.exec(joined);
    if (m === null) continue;

    const title = m[1]!.replace(/[.\s]+$/, '').trim();
    if (title.length === 0) continue;
    out.push({ title, folio: Number(m[2]) });
  }

  if (out.length === 0) throw new ParseError('contents page has no entries', 'no line ended in a folio');
  return out;
}

/**
 * The folio a titled section starts on. Throws rather than guessing.
 *
 * Takes ALTERNATIVES because the books do not always agree on a title: SRD 1.0
 * prints `Loot` where SRD 2.0 prints `Loot & Items`. That is the only rename
 * between the two contents pages - every other shared section keeps its
 * wording - and listing both at the call site keeps the fact where the caller
 * can see it, rather than in a translation table one indirection away.
 *
 * The first alternative that exists wins, so the order is oldest-first and a
 * later book's rename never shadows the name a current one still uses.
 */
export function folioOf(entries: readonly ChapterEntry[], ...titles: string[]): number {
  for (const title of titles) {
    const hit = entries.find((e) => key(e.title) === key(title));
    if (hit !== undefined) return hit.folio;
  }
  throw new ParseError(
    `contents has no entry ${titles.map((t) => `"${t}"`).join(' or ')}`,
    entries.map((e) => `${e.title} ${e.folio}`).join(' | '),
  );
}

/**
 * A section, from its folio to the one before whatever comes next.
 *
 * For the common case, where a chapter really does end where the next contents
 * entry begins - and where WHICH entry that is differs between books. SRD 1.0
 * follows Communities with CORE MECHANICS and SRD 2.0 follows it with
 * Transformations, so naming the far end explicitly would need a different call
 * per book. Reading it off the contents needs neither.
 *
 * `rangeBetween` stays for the case this cannot serve: a range that spans
 * several entries, like `loot.ts` covering Loot and Consumables together.
 */
export function sectionRange(
  entries: readonly ChapterEntry[],
  ...titles: string[]
): { from: number; to: number } {
  const at = entries.findIndex((e) => titles.some((t) => key(e.title) === key(t)));
  if (at < 0) {
    throw new ParseError(
      `contents has no entry ${titles.map((t) => `"${t}"`).join(' or ')}`,
      entries.map((e) => `${e.title} ${e.folio}`).join(' | '),
    );
  }
  const next = entries.slice(at + 1).find((e) => e.folio > entries[at]!.folio);
  if (next === undefined) {
    throw new ParseError(
      `"${entries[at]!.title}" is the last entry in the contents`,
      'use rangeToEnd for a section that runs to the back of the book',
    );
  }
  return { from: entries[at]!.folio, to: next.folio - 1 };
}

/**
 * From one section's first folio to the folio before another's.
 *
 * Both ends are named because a chapter does not always end where the next TOC
 * entry begins - see the docblock. `to` is inclusive, matching the `FROM`/`TO`
 * constants this replaces.
 */
export function rangeBetween(
  entries: readonly ChapterEntry[],
  from: readonly string[],
  before: readonly string[],
): { from: number; to: number } {
  const start = folioOf(entries, ...from);
  const end = folioOf(entries, ...before) - 1;
  if (end < start) {
    throw new ParseError(
      `"${before.join('/')}" (folio ${end + 1}) does not follow "${from.join('/')}" (folio ${start})`,
      'the two ends are in the wrong order, or name the wrong sections',
    );
  }
  return { from: start, to: end };
}

/**
 * From one section's first folio to the last folio in the book.
 *
 * For the section that has no next one. The domain-card appendix is the whole
 * tail of both books - folios 119-135 of SRD 1, 206-224 of SRD 2 - so there is
 * no entry to stop before, and taking the end from the contents page is not
 * possible. It comes from the pages instead, which is the only place that knows
 * where the book stops.
 */
export function rangeToEnd(
  entries: readonly ChapterEntry[],
  pages: readonly BookPage[],
  from: string,
): { from: number; to: number } {
  const start = folioOf(entries, from);
  let last = -1;
  for (const page of pages) if (page.folio !== null && page.folio > last) last = page.folio;
  if (last < start) {
    throw new ParseError(
      `"${from}" starts on folio ${start}, past the last folio read (${last})`,
      'the contents and the pages disagree about how long the book is',
    );
  }
  return { from: start, to: last };
}
