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

const DOMAINS_FOLIO = 7;
const APPENDIX_FROM = 119;
const APPENDIX_TO = 135;

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
  const lines = readPages(pages, DOMAINS_FOLIO, DOMAINS_FOLIO);
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

  const missing = DOMAINS.filter((d) => !domains.some((x) => x.id === d));
  if (missing.length > 0) {
    throw new ParseError(`missing domains on folio ${DOMAINS_FOLIO}`, missing.join(', '));
  }
  if (domains.length !== DOMAINS.length) {
    throw new ParseError(
      `expected ${DOMAINS.length} domains on folio ${DOMAINS_FOLIO}, found ${domains.length}`,
      domains.map((d) => d.id).join(', '),
    );
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

const isCardTitle = (f: Row): boolean =>
  f.bold && f.size >= TITLE_SIZE && f.family.startsWith('QuestaSans');

export function parseDomainCards(pages: BookPage[]): DomainCard[] {
  const lines = readPages(pages, APPENDIX_FROM, APPENDIX_TO);

  // A card is announced by its `Level N <Domain> <Type>` / `Recall Cost: N`
  // pair; the line above the pair is the title. Nothing else in the appendix
  // matches, so this needs no font heuristics to find the boundaries.
  const starts: number[] = [];
  for (let i = 1; i + 1 < lines.length; i++) {
    if (LEVEL_RE.test(lines[i]!.text) && RECALL_RE.test(lines[i + 1]!.text)) starts.push(i - 1);
  }
  if (starts.length === 0) {
    throw new ParseError(
      'no domain cards found in the appendix',
      lines.slice(0, 6).map((l) => l.text).join(' | '),
    );
  }
  // Losing a card silently is the failure that matters here: a title that never
  // paired with a level line would just be swallowed by the card above it. The
  // title face is used nowhere else in the appendix, so counting it catches that.
  const titles = lines.filter(isCardTitle).length;
  if (titles !== starts.length) {
    throw new ParseError(
      `found ${titles} card titles but ${starts.length} cards`,
      lines.filter((l, i) => isCardTitle(l) && !starts.includes(i)).map((l) => l.text).join(', '),
    );
  }

  // The domain a card belongs to is the banner it is printed under; the card's
  // own `Level N <Domain>` line is then a cross-check on the reading order.
  const banners: Array<DomainId | undefined> = [];
  let current: DomainId | undefined;
  for (const f of lines) {
    const m = f.family.startsWith('Eveleth') ? BANNER_RE.exec(f.text) : null;
    if (m) {
      current = DOMAIN_WORDS.get(m[1]!);
      if (!current) throw new ParseError('unknown domain banner', f.text);
    }
    banners.push(current);
  }

  const cards: DomainCard[] = [];
  const seen = new Map<string, string>();
  starts.forEach((start, n) => {
    const title = lines[start]!;
    const level = lines[start + 1]!;
    const recall = lines[start + 2]!;

    if (!isCardTitle(title)) {
      throw new ParseError('card title is not bold sans', `${title.text} / ${title.family}`);
    }
    if (title.text !== title.text.toUpperCase()) {
      throw new ParseError('card title is not set in caps', title.text);
    }

    const banner = banners[start];
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

    const end = starts[n + 1] ?? lines.length;
    const body = lines.slice(start + 3, end).filter((f) => !f.family.startsWith('Eveleth'));
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
