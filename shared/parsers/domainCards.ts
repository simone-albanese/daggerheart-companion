/**
 * Domains (folio 7) and the appendix domain card reference (folios 119-135).
 *
 * The only thing the shared line stream does not carry is the vertical rhythm,
 * and this section needs it: a card's rules text is several paragraphs and the
 * book marks them with space alone. Poppler gives every word on a line the same
 * box bottom, so `min(y + h)` over a line's runs is an exact baseline, and the
 * gap histogram across the whole appendix is bimodal with a wide empty band -
 * 9.8-11.0pt within a paragraph, 12.0-13.9pt between two. Hence `PARAGRAPH_GAP`.
 */
import type { BookPage } from '../textLayout.ts';
import { slugify } from '../slugify.ts';
import {
  DOMAINS,
  type Domain,
  type DomainCard,
  type DomainCardType,
  type DomainId,
} from '../types.ts';
import {
  ParseError,
  joinLines,
  joinWithBullets,
  normalizeText,
  pagesInFolios,
  splitOn,
  titleCase,
} from './util.ts';
import { folioOf, parseContents, rangeToEnd } from './contents.ts';

/*
 * The two ranges this file reads come from the book's own contents page rather
 * than from constants here. They used to be `DOMAINS_FOLIO = 7`,
 * `APPENDIX_FROM = 119`, `APPENDIX_TO = 135` - correct for SRD 1.0 and wrong
 * for every other printing. SRD 2.0 puts the appendix on 206-224, and the
 * symptom was this file throwing `no domain cards found in the appendix` over
 * an adversary stat block.
 *
 * `Domains` and `Domain Card Reference` are the titles both books print. Where
 * a title has changed the lookup throws and names every entry the contents does
 * have - a better failure than a range landing on real material that happens to
 * be the wrong chapter.
 */
const DOMAINS_SECTION = 'Domains';
const APPENDIX_SECTION = 'Domain Card Reference';

/** Line leading is 9.8-11pt; a paragraph adds a further 1.5pt or more. */
const PARAGRAPH_GAP = 11.5;

/** Card titles are the only body-face type set this large in the appendix. */
const TITLE_SIZE = 11;

const DOMAIN_WORDS = new Map<string, DomainId>(DOMAINS.map((d) => [d.toUpperCase(), d]));
const CARD_TYPES = new Set<string>(['Ability', 'Spell', 'Grimoire']);

const LEVEL_RE = /^Level (\d{1,2}) ([A-Za-z]+) ([A-Za-z]+)$/;
const RECALL_RE = /^Recall Cost: (\d+)$/;
const BANNER_RE = /^([A-Z]+) DOMAIN$/;
const BULLET_RE = /^[••▪●]/;

interface Row {
  text: string;
  size: number;
  family: string;
  bold: boolean;
  /** Box bottom, which poppler makes identical for every word on a line. */
  bottom: number;
  folio: number;
  /** Page + column. A vertical gap only means anything within one. */
  block: number;
}

/** The shared line stream, plus the baseline and column bookkeeping. */
function readPages(pages: BookPage[], from: number, to: number): Row[] {
  const found = pagesInFolios(pages, from, to);
  if (found.length === 0) {
    throw new ParseError(`no pages in folio range ${from}-${to}`, `${pages.length} pages loaded`);
  }

  const out: Row[] = [];
  let block = 0;
  let previous: { folio: number; column: number; bottom: number } | undefined;
  for (const page of found) {
    const folio = page.folio!;
    for (const line of page.lines) {
      const bottom = Math.min(...line.runs.map((r) => r.y + r.h));
      // A new page, a new column, or text that jumps back up the page: either
      // way the distance to the line before it is not a paragraph gap.
      if (
        previous === undefined ||
        previous.folio !== folio ||
        previous.column !== line.column ||
        bottom < previous.bottom
      ) {
        block += 1;
      }
      previous = { folio, column: line.column, bottom };
      out.push({
        text: normalizeText(line.text),
        size: line.size,
        family: line.family,
        bold: line.bold,
        bottom,
        folio,
        block,
      });
    }
  }
  return out;
}

/**
 * Two repairs on top of the shared `titleCase`, both provoked by real names:
 *
 *   `REAPER’S STRIKE`  it only protects a straight apostrophe and the SRD sets
 *                      a curly one, so the possessive came back as `Reaper’S`.
 *   `GOAD THEM ON`     a title never ends on a lowercased minor word; without
 *                      this the particle of the phrasal verb reads as `on`.
 */
function cardName(caps: string): string {
  const words = titleCase(caps)
    .replace(/’(\p{Lu})/gu, (_m, c: string) => `’${c.toLowerCase()}`)
    .split(' ');
  const last = words.length - 1;
  words[last] = words[last]!.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
  return words.join(' ');
}

export function parseDomains(pages: BookPage[]): Domain[] {
  const folio = folioOf(parseContents(pages), DOMAINS_SECTION);
  const lines = readPages(pages, folio, folio);
  const isHeading = (f: Row): boolean =>
    f.family.startsWith('Eveleth') && DOMAIN_WORDS.has(f.text.toUpperCase());

  const domains: Domain[] = [];
  for (const group of splitOn(lines, isHeading)) {
    const head = group[0]!;
    const id = DOMAIN_WORDS.get(head.text.toUpperCase())!;
    const body: string[] = [];
    for (const f of group.slice(1)) {
      // The description runs until the next display element; on folio 7 that is
      // either the following domain heading or the `Class Domains` sidebar.
      if (!f.family.startsWith('QuestaSans') || f.size > 10) break;
      body.push(f.text);
    }
    const description = joinLines(body);
    if (description.length === 0) {
      throw new ParseError(`domain ${id} has no description`, head.text);
    }
    domains.push({ id, name: titleCase(head.text), description, sourcePage: head.folio });
  }

  /*
   * Every domain the PAGE announces must have been read, and none twice. What
   * this does NOT require is that the page announce every domain in `DOMAINS`.
   *
   * Those are two different lists and were being treated as one. `DOMAINS` is
   * what this build can represent; the folio is what this printing ships. They
   * are equal for a book the constant was written against and stop being equal
   * the moment the code learns a domain a printing does not have - which is the
   * state every revision lands in, and which made this throw `expected 10
   * domains, found 9` on SRD 1.0, a book it parses perfectly.
   *
   * The guarantee that mattered here - a heading silently skipped - is kept by
   * counting headings on the page rather than members of the constant. How many
   * domains a DATASET ought to contain is `tools/validate.ts`'s question, and
   * it already asks it.
   */
  const headings = lines.filter(isHeading).length;
  if (domains.length !== headings) {
    throw new ParseError(
      `folio ${folio} shows ${headings} domain headings but ${domains.length} were read`,
      domains.map((d) => d.id).join(', '),
    );
  }
  if (domains.length === 0) {
    throw new ParseError(`no domains found on folio ${folio}`, lines.slice(0, 6).map((l) => l.text).join(' | '));
  }
  const dupes = domains.map((d) => d.id).filter((d, i, a) => a.indexOf(d) !== i);
  if (dupes.length > 0) {
    throw new ParseError(`domain read twice on folio ${folio}`, dupes.join(', '));
  }
  return domains;
}

/** Paragraph-aware join: blank line between paragraphs, `- ` for bullets. */
function cardText(body: readonly Row[]): string {
  const paragraphs: string[][] = [];
  let previous: Row | undefined;
  for (const f of body) {
    const broken =
      previous === undefined ||
      previous.block !== f.block ||
      (f.bottom - previous.bottom > PARAGRAPH_GAP && !BULLET_RE.test(f.text));
    if (broken) paragraphs.push([]);
    paragraphs[paragraphs.length - 1]!.push(f.text);
    previous = f;
  }
  return paragraphs
    .map((p) => joinWithBullets(p))
    .filter((p) => p.length > 0)
    .join('\n\n');
}

/** `[from, to)` as indices, for the ownership check below. */
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from }, (_u, k) => from + k);

const isCardTitle = (f: Row): boolean =>
  f.bold && f.size >= TITLE_SIZE && f.family.startsWith('QuestaSans');

export function parseDomainCards(pages: BookPage[]): DomainCard[] {
  const appendix = rangeToEnd(parseContents(pages), pages, APPENDIX_SECTION);
  const lines = readPages(pages, appendix.from, appendix.to);

  /*
   * A card is announced by its `Level N <Domain> <Type>` / `Recall Cost: N`
   * pair; the title is what stands above it. Nothing else in the appendix
   * matches, so the boundaries need no font heuristics.
   *
   * The title is a RANGE and not a line, which SRD 2 is what taught: its
   * columns are narrower, and `SUMMON HORROR` sets over two. Reading only the
   * line directly above the pair would have named that card `HORROR` - not a
   * crash, a wrong name, on a card the search and every saved loadout key by
   * slug. So the title walks upward while the face still says title.
   *
   * For SRD 1 every title fits one line, the walk stops immediately, and the
   * output is byte-identical - which is the check that says this is a widening
   * and not a change.
   */
  interface Start {
    /** First line of the title. */
    title: number;
    /** The `Level N ...` line; the title is everything from `title` to here. */
    level: number;
  }
  const starts: Start[] = [];
  for (let i = 1; i + 1 < lines.length; i++) {
    if (!LEVEL_RE.test(lines[i]!.text) || !RECALL_RE.test(lines[i + 1]!.text)) continue;
    let title = i - 1;
    while (title > 0 && isCardTitle(lines[title - 1]!)) title -= 1;
    starts.push({ title, level: i });
  }
  if (starts.length === 0) {
    throw new ParseError(
      'no domain cards found in the appendix',
      lines.slice(0, 6).map((l) => l.text).join(' | '),
    );
  }
  /*
   * Losing a card silently is the failure that matters: a title that never
   * paired with a level line would be swallowed by the card above it. The title
   * face is used nowhere else in the appendix, so every title-face line must be
   * accounted for by exactly one card - which is the same guarantee as before,
   * now counted over multi-line titles rather than assuming one line each.
   */
  const titleLines = lines.filter(isCardTitle).length;
  const claimed = starts.reduce((n, st) => n + (st.level - st.title), 0);
  if (titleLines !== claimed) {
    const owned = new Set(starts.flatMap((st) => range(st.title, st.level)));
    throw new ParseError(
      `found ${titleLines} title lines but ${claimed} belong to the ${starts.length} cards`,
      lines.filter((l, i) => isCardTitle(l) && !owned.has(i)).map((l) => l.text).join(', '),
    );
  }

  // The domain a card belongs to is the banner it is printed under; the card's
  // own `Level N <Domain>` line is then a cross-check on the reading order.
  /*
   * A banner claims everything BELOW IT ON THE PAGE, in both columns - it is a
   * rule across the full measure, not a heading inside one column. So a card's
   * domain is the last banner at or above it on its own folio, and reading
   * order is the wrong question to ask.
   *
   * This used to walk the de-columnised lines and remember the last banner
   * seen, which is the same thing only when no banner falls mid-page with cards
   * beside it. Measured on both books: in SRD 1.0 the two rules agree on every
   * appendix page - 5 and 5 on folio 122, 4 and 4 on 126, 1 and 1 on 132 - so
   * this is a widening and `data/srd-1.0.json` does not move. In SRD 2.0 they
   * disagree on five of ten: folio 209 has 2 cards before the BONE banner in
   * reading order and 5 above it on the page, and the three in between are
   * Blade cards sitting in the right-hand column, which the old rule handed to
   * Bone. It threw - `card sits under the bone banner but reads blade` - and
   * that throw is the only reason this was not a silent mis-filing.
   */
  const flags = lines.map((f) => {
    const m = f.family.startsWith('Eveleth') ? BANNER_RE.exec(f.text) : null;
    if (m === null) return null;
    const domain = DOMAIN_WORDS.get(m[1]!);
    if (!domain) throw new ParseError('unknown domain banner', f.text);
    return { domain, folio: f.folio, bottom: f.bottom };
  });
  const flagged = flags.filter((b): b is NonNullable<typeof b> => b !== null);

  const banners: Array<DomainId | undefined> = [];
  for (const f of lines) {
    let current: DomainId | undefined;
    for (const b of flagged) {
      if (b.folio < f.folio || (b.folio === f.folio && b.bottom <= f.bottom)) current = b.domain;
      else break;
    }
    banners.push(current);
  }

  const cards: DomainCard[] = [];
  const seen = new Map<string, string>();
  starts.forEach((start, n) => {
    const titleLine = lines[start.title]!;
    const titleText = lines
      .slice(start.title, start.level)
      .map((l) => l.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const level = lines[start.level]!;
    const recall = lines[start.level + 1]!;
    const title = { ...titleLine, text: titleText };

    if (!isCardTitle(titleLine)) {
      throw new ParseError('card title is not bold sans', `${titleText} / ${titleLine.family}`);
    }
    if (titleText !== titleText.toUpperCase()) {
      throw new ParseError('card title is not set in caps', titleText);
    }

    const banner = banners[start.title];
    if (!banner) throw new ParseError('card appears before any domain banner', title.text);

    const lm = LEVEL_RE.exec(level.text)!;
    const domain = DOMAIN_WORDS.get(lm[2]!.toUpperCase());
    if (!domain) throw new ParseError('unknown domain on card', `${title.text}: ${level.text}`);
    if (domain !== banner) {
      throw new ParseError(
        `card sits under the ${banner} banner but reads ${domain}`,
        `${title.text}: ${level.text}`,
      );
    }
    if (!CARD_TYPES.has(lm[3]!)) {
      throw new ParseError('unknown card type', `${title.text}: ${level.text}`);
    }
    const levelNumber = Number(lm[1]);
    if (levelNumber < 1 || levelNumber > 10) {
      throw new ParseError('card level out of range', `${title.text}: ${level.text}`);
    }

    const end = starts[n + 1]?.title ?? lines.length;
    const body = lines.slice(start.level + 2, end).filter((f) => !f.family.startsWith('Eveleth'));
    const text = cardText(body);
    if (text.length === 0) throw new ParseError('card has no rules text', title.text);

    const name = cardName(title.text);
    const id = slugify(name);
    const clash = seen.get(id);
    if (clash !== undefined) {
      throw new ParseError(`duplicate domain card id ${id}`, `${clash} and ${name}`);
    }
    seen.set(id, name);

    cards.push({
      id,
      name,
      domain,
      level: levelNumber,
      type: lm[3] as DomainCardType,
      recallCost: Number(RECALL_RE.exec(recall.text)![1]),
      text,
      sourcePage: title.folio,
    });
  });

  return cards;
}
