/**
 * Helpers shared by every parser. Keeping the fiddly text joining in one place
 * means a fix to hyphenation or quote normalisation lands everywhere at once.
 */
import type { BookPage, Line } from '../textLayout.ts';

/** All lines of the given folio range, in reading order. */
export function linesInFolios(pages: BookPage[], from: number, to: number): Line[] {
  const out: Line[] = [];
  for (const p of pages) {
    if (p.folio === null || p.folio < from || p.folio > to) continue;
    out.push(...p.lines);
  }
  return out;
}

/** Pages of the given folio range. */
export function pagesInFolios(pages: BookPage[], from: number, to: number): BookPage[] {
  return pages.filter((p) => p.folio !== null && p.folio >= from && p.folio <= to);
}

/** Lines with the folio they came from, for `sourcePage` bookkeeping. */
export function linesWithFolio(
  pages: BookPage[],
  from: number,
  to: number,
): Array<Line & { folio: number }> {
  const out: Array<Line & { folio: number }> = [];
  for (const p of pagesInFolios(pages, from, to)) {
    for (const l of p.lines) out.push({ ...l, folio: p.folio! });
  }
  return out;
}

/**
 * Join wrapped lines back into a paragraph.
 *
 * The SRD hyphenates only at genuine hyphens (it is set justified but with
 * hyphenation off), so a trailing `-` is part of the word and is preserved
 * unless the next line starts lowercase and the pair forms one token.
 */
export function joinLines(lines: readonly string[]): string {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (out.length === 0) {
      out = line;
      continue;
    }
    if (/[‐-―-]$/.test(out) && /^[a-z]/.test(line)) {
      out = out.replace(/[‐-―-]$/, '') + line;
    } else {
      out += ' ' + line;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Join lines but keep bullet items on their own line, as `- ` entries. */
export function joinWithBullets(lines: readonly string[]): string {
  const blocks: string[] = [];
  let buffer: string[] = [];
  const flush = (): void => {
    if (buffer.length > 0) blocks.push(joinLines(buffer));
    buffer = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (/^[••▪●]\s*/.test(line)) {
      flush();
      buffer.push('- ' + line.replace(/^[••▪●]\s*/, ''));
      continue;
    }
    // A continuation of a bullet keeps accumulating into it.
    buffer.push(line);
  }
  flush();
  return blocks.join('\n');
}

/** Normalise the typographic characters that make matching brittle. */
export function normalizeText(s: string): string {
  return s
    .replace(/[‘’]/g, '’')
    .replace(/[“”]/g, '"')
    .replace(/–/g, '-')
    .replace(/—/g, '—')
    .replace(/−/g, '-') // minus sign -> hyphen, for Number()
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Parse a signed integer that may use a Unicode minus. */
export function signedInt(s: string): number {
  const m = /[-−+]?\d+/.exec(s.replace(/−/g, '-'));
  return m ? Number(m[0].replace('+', '')) : 0;
}

/** Title Case a display heading that the book sets in all caps. */
export function titleCase(s: string): string {
  const minor = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'nor', 'of',
    'on', 'or', 'the', 'to', 'with',
  ]);
  const words = s.toLowerCase().split(/\s+/);
  return words
    .map((w, i) => {
      if (i > 0 && minor.has(w)) return w;
      // Keep interior punctuation: `arcana-touched` -> `Arcana-Touched`.
      return w.replace(/([a-zà-ÿ])([a-zà-ÿ']*)/g, (_m, a: string, b: string) =>
        a.toUpperCase() + b,
      );
    })
    .join(' ');
}

/** Typographic classification helpers, matching the SRD's type system. */
export const isDisplay = (l: Line): boolean => l.family.startsWith('Eveleth');
export const isBody = (l: Line): boolean => /^QuestaSans-Light/.test(l.family);
export const isBoldSans = (l: Line): boolean => l.family.startsWith('QuestaSans') && l.bold;
export const isItalic = (l: Line): boolean => /Italic/.test(l.family);
export const isSlab = (l: Line): boolean => l.family.startsWith('QuestaSlab');

/** Split a run of lines wherever `isStart` matches, keeping the boundary line. */
export function splitOn<T>(items: readonly T[], isStart: (item: T) => boolean): T[][] {
  const out: T[][] = [];
  let current: T[] | null = null;
  for (const item of items) {
    if (isStart(item)) {
      if (current) out.push(current);
      current = [item];
    } else if (current) {
      current.push(item);
    }
  }
  if (current) out.push(current);
  return out;
}

export class ParseError extends Error {
  constructor(what: string, context: string) {
    super(`${what}\n  near: ${context.slice(0, 220)}`);
    this.name = 'ParseError';
  }
}
