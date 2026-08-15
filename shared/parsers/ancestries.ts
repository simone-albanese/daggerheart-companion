/**
 * Ancestries - SRD folios 27-31.
 *
 * Each entry is a display banner, a body description, an ANCESTRY FEATURES
 * banner, then exactly two features. Two 12pt display banners in the range are
 * not ancestries: the "ANCESTRY FEATURES" rules sub-section that opens the
 * chapter, and "MIXED ANCESTRY", which is a character-creation rule and belongs
 * to the rules parser. Both are rejected by checking every banner against the
 * roster the chapter prints in its own intro, so a nineteenth ancestry would
 * fail here rather than be silently dropped.
 */
import { WORD_JOIN_RATIO, type BookPage, type Line, type TextRun } from '../textLayout.ts';
import type { Ancestry, Feature } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBoldSans,
  isDisplay,
  joinLines,
  normalizeText,
  pagesInFolios,
  splitOn,
  titleCase,
} from './util.ts';

const FROM = 27;
const TO = 31;

/** The book states every ancestry grants two ancestry features. */
const FEATURE_COUNT = 2;

/** Display banners in this range that name something other than an ancestry. */
const NOT_ANCESTRIES = new Set(['Ancestry Features', 'Mixed Ancestry']);

/**
 * Word spaces in this book's display type measure 0.26-0.36 of the glyph
 * height; the column gutter measures 9-16. Nothing lands in between.
 */
const GUTTER_GAP_RATIO = 3;

/** A banner is indented ~3pt from the body of its own column. */
const COLUMN_X_TOL = 30;

type Sourced = Line & { folio: number };

export function parseAncestries(pages: BookPage[]): Ancestry[] {
  const lines = sourcedLines(pages);
  const roster = parseRoster(lines);

  const blocks = splitOn(lines, isBanner);
  const out: Ancestry[] = [];
  for (const block of blocks) {
    const name = titleCase(normalizeText(block[0]!.text));
    if (NOT_ANCESTRIES.has(name)) continue;
    if (!roster.has(name)) {
      throw new ParseError('display banner is neither a listed ancestry nor a known rule', name);
    }
    out.push(parseAncestry(block, name));
  }

  const seen = new Set<string>();
  for (const a of out) {
    if (seen.has(a.id)) throw new ParseError('duplicate ancestry id', a.id);
    seen.add(a.id);
  }
  const missing = [...roster].filter((n) => !seen.has(slugify(n)));
  if (missing.length > 0) {
    throw new ParseError('listed ancestry has no banner', missing.join(', '));
  }
  return out;
}

/** The chapter title "ANCESTRIES" is set at 17pt, the entry banners at 12pt. */
function isBanner(l: Line): boolean {
  return isDisplay(l) && l.size < 15;
}

function sourcedLines(pages: BookPage[]): Sourced[] {
  const out: Sourced[] = [];
  for (const page of pagesInFolios(pages, FROM, TO)) {
    for (const l of unmergeBanners(page)) out.push({ ...l, folio: page.folio! });
  }
  return out;
}

/**
 * When the top band of a page holds nothing but the banner of each column, the
 * XY-cut isolates that band and is then left with a single band that has no
 * gutter to cut, so both banners arrive as one line - "ELF FAUN" on folio 28,
 * "HUMAN KATARI" on folio 30. Split them on the gutter-sized gap and move each
 * fragment to the head of the column it was printed in. A no-op on every page
 * the layout got right, and it will quietly stop firing if it is ever fixed
 * upstream.
 */
function unmergeBanners(page: BookPage): Line[] {
  const out: Line[] = [];
  let queued: Array<{ line: Line; column: number }> = [];
  for (const line of page.lines) {
    for (const q of queued.filter((q) => q.column === line.column)) {
      if (Math.abs(line.x - q.line.x) > COLUMN_X_TOL) {
        throw new ParseError(
          'split banner does not line up with its column',
          `${q.line.text} @${q.line.x} vs ${line.text} @${line.x}`,
        );
      }
      out.push(q.line);
    }
    queued = queued.filter((q) => q.column !== line.column);

    if (!isBanner(line)) {
      out.push(line);
      continue;
    }
    const parts = splitAtGutter(line);
    out.push(parts[0]!);
    for (let k = 1; k < parts.length; k++) queued.push({ line: parts[k]!, column: line.column + k });
  }
  if (queued.length > 0) {
    throw new ParseError(
      'split banner has no column to belong to',
      queued.map((q) => q.line.text).join(' | '),
    );
  }
  return out;
}

function splitAtGutter(line: Line): Line[] {
  const groups: TextRun[][] = [[]];
  let prev: TextRun | null = null;
  for (const r of line.runs) {
    if (prev && (r.x - (prev.x + prev.w)) / Math.max(r.h, 1) > GUTTER_GAP_RATIO) groups.push([]);
    groups[groups.length - 1]!.push(r);
    prev = r;
  }
  if (groups.length === 1) return [line];
  return groups.map((runs, i) => {
    const x = Math.min(...runs.map((r) => r.x));
    return {
      ...line,
      text: joinRuns(runs),
      x,
      y: Math.min(...runs.map((r) => r.y)),
      w: Math.max(...runs.map((r) => r.x + r.w)) - x,
      size: Math.max(...runs.map((r) => r.size)),
      column: line.column + i,
      runs,
    };
  });
}

/** Join runs the way `assembleLines` does, so ligature-split words survive. */
function joinRuns(runs: readonly TextRun[]): string {
  let out = '';
  let prevEnd = Number.NaN;
  for (const r of runs) {
    if (out.length > 0) out += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
    out += r.text;
    prevEnd = r.x + r.w;
  }
  return normalizeText(out);
}

/**
 * "The core ruleset includes the following ancestries: Clank, ... and Mixed
 * Ancestry." - the chapter's own manifest, used to tell banners apart from
 * sub-section headings set in the same face and size.
 */
function parseRoster(lines: Sourced[]): Set<string> {
  const at = lines.findIndex((l) => /following ancestries:/i.test(l.text));
  if (at < 0) throw new ParseError('ancestry roster sentence not found', `folios ${FROM}-${TO}`);
  const sentence = normalizeText(joinLines(lines.slice(at, at + 8).map((l) => l.text)));
  const m = /following ancestries:\s*([^.]+)\./i.exec(sentence);
  if (!m) throw new ParseError('ancestry roster sentence does not end in a period', sentence);

  const names = m[1]!
    .split(/\s*,\s*/)
    .map((n) => n.replace(/^and\s+/i, '').trim())
    .filter((n) => n.length > 0);
  const roster = new Set(names.filter((n) => !NOT_ANCESTRIES.has(n)));
  if (roster.size !== names.length - 1) {
    throw new ParseError('ancestry roster does not list Mixed Ancestry exactly once', sentence);
  }
  return roster;
}

function parseAncestry(block: Sourced[], name: string): Ancestry {
  const [banner, ...rest] = block as [Sourced, ...Sourced[]];
  // Faerie's banner reads "ANCESTRY FEATURE", singular - a typo in the SRD.
  const featureAt = rest.findIndex(
    (l) => isBoldSans(l) && /^ancestry features?$/i.test(normalizeText(l.text)),
  );
  if (featureAt < 0) throw new ParseError('ancestry has no ANCESTRY FEATURES banner', name);

  const description = normalizeText(joinLines(rest.slice(0, featureAt).map((l) => l.text)));
  if (description.length === 0) throw new ParseError('ancestry has no description', name);

  return {
    id: slugify(name),
    name,
    description,
    features: parseFeatures(rest.slice(featureAt + 1), name),
    sourcePage: banner.folio,
  };
}

function parseFeatures(lines: Sourced[], name: string): [Feature, Feature] {
  const groups = splitOn(lines, startsFeature);
  if (groups.length !== FEATURE_COUNT) {
    throw new ParseError(
      `${name}: expected ${FEATURE_COUNT} ancestry features, got ${groups.length}`,
      lines.map((l) => l.text).join(' '),
    );
  }
  const [first, second] = groups.map((g) => toFeature(g, name)) as [Feature, Feature];
  return [first, second];
}

/**
 * A feature opens with its name in bold, but bold is also used for inline
 * emphasis, which sometimes lands at the start of a continuation line ("2 Hope
 * to reroll your Hope Die."). The colon is what separates a name from emphasis.
 * It can sit mid-way through the bold lead-in, because the emphasis may run
 * straight on from the name ("**Increased Fortitude: Spend 3 Hope** to halve").
 */
function startsFeature(l: Line): boolean {
  return boldLeadIn(l).indexOf(':') > 0;
}

/** The line's leading bold runs. */
function boldLeadIn(l: Line): string {
  const lead: TextRun[] = [];
  for (const r of l.runs) {
    if (!r.bold) break;
    lead.push(r);
  }
  return joinRuns(lead);
}

function toFeature(group: Sourced[], ancestry: string): Feature {
  const text = normalizeText(joinLines(group.map((l) => l.text)));
  const colon = text.indexOf(':');
  if (colon < 1) throw new ParseError(`${ancestry}: feature has no leading "Name:"`, text);
  const body = text.slice(colon + 1).trim();
  if (body.length === 0) throw new ParseError(`${ancestry}: feature has no text`, text);
  return { name: text.slice(0, colon).trim(), text: body };
}
