/**
 * Communities - SRD folios 32-34.
 *
 * Each entry is a display banner, a body paragraph, one italic "X are often
 * a, b, ... and f." sentence, a COMMUNITY FEATURE banner, then the feature.
 */
import type { BookPage, Line, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import type { Community, Feature } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBoldSans,
  isDisplay,
  isItalic,
  joinLines,
  normalizeText,
  pagesInFolios,
  splitOn,
  titleCase,
} from './util.ts';
import { parseContents, sectionRange, sliceSection } from './contents.ts';

/*
 * The folio range comes from the book's own contents page. It used to be
 * written here, `FROM = 32` / `TO = 34`, which is right for SRD 1.0 and wrong for
 * every other printing - SRD 2.0 reflows 135 printed pages into 224.
 */
const SECTION = 'Communities';

/** The book states each community card lists six adjectives. */
const TRAIT_COUNT = 6;

type Sourced = Line & { folio: number };

export function parseCommunities(pages: BookPage[]): Community[] {
  const range = sectionRange(parseContents(pages), SECTION);
  const all: Sourced[] = [];
  for (const page of pagesInFolios(pages, range.from, range.to)) {
    for (const line of readingOrder(page)) all.push({ ...line, folio: page.folio! });
  }
  // Cut at both ends: the range overlaps a page into the next section, and in
  // SRD 2.0 the page it starts on carries the last ancestry above this banner.
  const lines = sliceSection(all, SECTION, range.next);

  // The section title "COMMUNITIES" is set at 17pt; the banners at 12pt.
  const blocks = splitOn(lines, (l) => isDisplay(l) && l.size < 15);
  if (blocks.length === 0) {
    throw new ParseError('no community banners found', `folios ${range.from}-${range.to}`);
  }

  const out = blocks.map(parseCommunity);

  const seen = new Set<string>();
  for (const c of out) {
    if (seen.has(c.id)) throw new ParseError('duplicate community id', c.id);
    seen.add(c.id);
  }
  return out;
}

/**
 * Folios 33 and 34 open with a banner in each column at the same height. That
 * band is full-width, so the XY-cut takes it before it ever looks for the
 * gutter and both banners arrive as one line ("RIDGEBORNE SLYBORNE") - which
 * loses the right-hand community entirely. Put each run back on the column it
 * was printed in and read the page column by column.
 */
function readingOrder(page: BookPage): Line[] {
  const origins = columnOrigins(page);
  return page.lines
    .flatMap((l) => splitAtGutter(l, origins))
    .map((line, i) => ({ line, i }))
    .sort((a, b) => a.line.column - b.line.column || a.line.y - b.line.y || a.i - b.i)
    .map((e) => e.line);
}

/** Left edge of each column of the page, as the lines that fit it report it. */
function columnOrigins(page: BookPage): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of page.lines) {
    const seen = out.get(l.column);
    if (seen === undefined || l.x < seen) out.set(l.column, l.x);
  }
  return out;
}

/** Nearest column, measured at a piece's left edge - a column starts there. */
function columnAt(x: number, origins: Map<number, number>): number {
  let best = 0;
  let nearest = Infinity;
  for (const [column, origin] of origins) {
    const d = Math.abs(x - origin);
    if (d < nearest) {
      nearest = d;
      best = column;
    }
  }
  return best;
}

/**
 * Across folios 32-34 every genuine word space measures 2.2pt and the two
 * straddling banners leave 132pt and 152pt, so the two populations are nowhere
 * near each other. Anything wider than the type itself is a gutter.
 */
function splitAtGutter(line: Line, origins: Map<number, number>): Line[] {
  const pieces: TextRun[][] = [];
  let current: TextRun[] = [];
  let end = Number.NaN;
  for (const run of line.runs) {
    if (current.length > 0 && run.x - end > 2 * line.size) {
      pieces.push(current);
      current = [];
    }
    current.push(run);
    end = run.x + run.w;
  }
  if (current.length > 0) pieces.push(current);
  if (pieces.length < 2) return [line];
  return pieces.map((runs) => lineFromRuns(runs, columnAt(runs[0]!.x, origins)));
}

function lineFromRuns(runs: TextRun[], column: number): Line {
  let text = '';
  let end = Number.NaN;
  for (const run of runs) {
    if (text.length > 0 && (run.x - end) / Math.max(run.h, 1) >= WORD_JOIN_RATIO) text += ' ';
    text += run.text;
    end = run.x + run.w;
  }
  const chars = new Map<string, number>();
  for (const r of runs) chars.set(r.family, (chars.get(r.family) ?? 0) + r.text.length);
  const x = Math.min(...runs.map((r) => r.x));
  return {
    text: text.replace(/\s+/g, ' ').trim(),
    x,
    y: Math.min(...runs.map((r) => r.y)),
    w: Math.max(...runs.map((r) => r.x + r.w)) - x,
    size: Math.max(...runs.map((r) => r.size)),
    family: [...chars.entries()].sort((a, b) => b[1] - a[1])[0]![0]!,
    bold: runs.every((r) => r.bold),
    italic: runs.every((r) => r.italic),
    column,
    runs,
  };
}

const isFeatureBanner = (l: Line): boolean =>
  isBoldSans(l) && /^community feature$/i.test(normalizeText(l.text));

function parseCommunity(block: Sourced[]): Community {
  const banner = block[0];
  if (!banner) throw new ParseError('empty community block', '');
  const rest = block.slice(1);
  const name = titleCase(normalizeText(banner.text));

  const banners = rest.filter(isFeatureBanner).length;
  // Two banners in one block means a neighbouring card was swallowed whole.
  if (banners !== 1) {
    throw new ParseError(
      `${name}: expected 1 COMMUNITY FEATURE banner, found ${banners}`,
      joinLines(rest.map((l) => l.text)),
    );
  }
  const featureAt = rest.findIndex(isFeatureBanner);

  const prose = rest.slice(0, featureAt);
  const traitsAt = prose.findIndex(isItalic);
  if (traitsAt < 0) throw new ParseError('community has no italic adjective sentence', name);

  const description = normalizeText(joinLines(prose.slice(0, traitsAt).map((l) => l.text)));
  if (description.length === 0) throw new ParseError('community has no description', name);

  return {
    id: slugify(name),
    name,
    description,
    traits: parseTraits(normalizeText(joinLines(prose.slice(traitsAt).map((l) => l.text))), name),
    feature: parseFeature(rest.slice(featureAt + 1), name),
    sourcePage: banner.folio,
  };
}

function parseTraits(sentence: string, name: string): string[] {
  // Anchoring on the card's own name catches a sentence scoped to the wrong
  // block, which is otherwise a perfectly plausible-looking list of six words.
  if (!sentence.toLowerCase().startsWith(`${name.toLowerCase()} are often `)) {
    throw new ParseError(`${name}: adjective sentence belongs to another card`, sentence);
  }
  const list = /\bare often\s+(.+)$/.exec(sentence)?.[1];
  if (!list) throw new ParseError(`${name}: adjective sentence lacks "are often"`, sentence);
  const traits = list
    .replace(/\.\s*$/, '')
    .split(/\s*,\s*|\s+and\s+/)
    .map((t) => t.trim().replace(/^and\s+/, ''))
    .filter((t) => t.length > 0);
  if (traits.length !== TRAIT_COUNT) {
    throw new ParseError(`${name}: expected ${TRAIT_COUNT} adjectives, got ${traits.length}`, sentence);
  }
  return traits;
}

/**
 * The feature name is the run before the first colon. It is usually bold, but
 * Highborne's "Privilege:" is set in the light face, so the colon is the only
 * reliable delimiter.
 */
function parseFeature(lines: Sourced[], name: string): Feature {
  const text = normalizeText(joinLines(lines.map((l) => l.text)));
  const colon = text.indexOf(':');
  if (colon < 1 || colon > 60) {
    throw new ParseError(`${name}: community feature has no leading "Name:"`, text);
  }
  const body = text.slice(colon + 1).trim();
  if (body.length === 0) throw new ParseError(`${name}: community feature has no text`, text);
  return { name: text.slice(0, colon).trim(), text: body };
}
