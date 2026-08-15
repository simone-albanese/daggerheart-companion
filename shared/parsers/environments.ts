/**
 * Environments - SRD folios 103-111.
 *
 * Each stat block is a display banner, a slab "Tier N Type" line, an italic
 * one-line summary, the Impulses / Difficulty / Potential Adversaries labels,
 * a FEATURES banner, then named features that carry their kind in the heading
 * ("Name - Action:") and usually trail a slab-set question prompt.
 *
 * Folio 102 is the "Using Environments" rules and is deliberately outside the
 * range; the tier banners ("TIER 2 ENVIRONMENTS (LEVELS 2-4)") are skipped
 * because each block states its own tier on the slab line.
 *
 * Folio 103 opens with the book's own index of the section, which the parse is
 * checked against at the end - see `checkAgainstIndex`.
 */
import type { BookPage, Line } from '../textLayout.ts';
import type { Environment, Feature, Tier } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isBody,
  isDisplay,
  isSlab,
  joinLines,
  normalizeText,
  pagesInFolios,
  splitOn,
  titleCase,
} from './util.ts';

const FROM = 103;
const TO = 111;

/** Point tolerance for "this line starts at the column's left edge". */
const FLUSH = 3;

/**
 * Ambushed and Ambushers print `Difficulty: Special`: their Difficulty is
 * whatever the adversaries present bring. `Environment.difficulty` is a
 * number, so 0 stands for "no fixed Difficulty" - the Relative Strength
 * feature in the same block carries the rule.
 */
const SPECIAL_DIFFICULTY = 0;

/**
 * The slab-italic question prompts are the only text in the SRD that arrives
 * as real ligature codepoints (29 of them, all in this section), so folding
 * them belongs here rather than in `normalizeText`.
 */
const LIGATURES: Readonly<Record<string, string>> = {
  'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'ft', 'ﬆ': 'st',
};
const clean = (s: string): string =>
  normalizeText(s).replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c);

const TIER_BANNER = /^(TIER \d|\(LEVELS?\b)/;
const STAT_LINE = /^Tier ([1-4]) (Exploration|Social|Traversal|Event)$/;
const FEATURE = /^(.+?)\s+[-—]\s+(Action|Reaction|Passive)\s*:\s*(.*)$/;
const LABEL = /^(Impulses|Difficulty|Potential Adversaries):/;
const BULLET = /^[••▪●]\s*/;
const INDEX_ENTRY = /^(.+?)\s+\((Exploration|Social|Traversal|Event)\)$/;

type Sourced = Line & { folio: number };

export function parseEnvironments(pages: BookPage[]): Environment[] {
  const { body, front } = splitSection(pages);
  const blocks = splitOn(body, isBanner);
  if (blocks.length === 0) {
    throw new ParseError('no environment banners found', `folios ${FROM}-${TO}`);
  }

  const out: Environment[] = [];
  for (const block of blocks) {
    const banner = clean(block[0]!.text);
    if (TIER_BANNER.test(banner)) {
      // A tier banner is a lone heading; anything else under one means the
      // block split went wrong.
      if (block.length > 1) {
        throw new ParseError('content under a tier banner', `${banner}: ${block[1]!.text}`);
      }
      continue;
    }
    out.push(parseEnvironment(block));
  }

  const seen = new Set<string>();
  for (const e of out) {
    if (seen.has(e.id)) throw new ParseError('duplicate environment id', e.id);
    seen.add(e.id);
  }
  checkAgainstIndex(front, out);
  return out;
}

/**
 * Folio 103 prints the book's own index of every stat block in the section.
 * Checking the parse against it is the only thing that can catch a block
 * disappearing at a column or page break, which a banner-driven split has no
 * way to notice by itself. It also pins the title-casing to the book's own
 * spelling, since the index sets the names in mixed case and the blocks don't.
 */
function checkAgainstIndex(front: Sourced[], out: Environment[]): void {
  const entries = splitOn(front.filter(isBody), (l) => BULLET.test(l.text)).map((b) =>
    clean(joinLines(b.map((l) => l.text))).replace(BULLET, ''),
  );
  if (entries.length === 0) {
    throw new ParseError('no stat-block index on the section opener', `folio ${FROM}`);
  }
  const expected = entries.map((e) => {
    const m = INDEX_ENTRY.exec(e);
    if (!m) throw new ParseError('unreadable stat-block index entry', e);
    return `${m[1]} (${m[2]})`;
  });

  const got = out.map((e) => `${e.name} (${e.type})`);
  const missing = expected.filter((e) => !got.includes(e));
  const extra = got.filter((g) => !expected.includes(g));
  if (missing.length > 0 || extra.length > 0) {
    throw new ParseError(
      `parse disagrees with the stat-block index (${expected.length} listed, ${got.length} parsed)`,
      `missing: ${missing.join('; ') || 'none'} | unlisted: ${extra.join('; ') || 'none'}`,
    );
  }
}

const isBanner = (l: Line): boolean => isDisplay(l) && !/Thin/.test(l.family);

function parseEnvironment(block: Sourced[]): Environment {
  const banner = block[0]!;
  // `titleCase` does not know the typographic apostrophe, so "NECROMANCER’S"
  // would come back as "Necromancer’S". Fold it for the pass, then restore.
  const name = titleCase(clean(banner.text).replace(/’/g, "'")).replace(/'/g, '’');
  const rest = block.slice(1);

  const stat = STAT_LINE.exec(clean(rest[0]?.text ?? ''));
  if (!stat) {
    throw new ParseError(`${name}: no "Tier N Type" line`, rest[0]?.text ?? '(end of block)');
  }

  const featuresAt = rest.findIndex((l) => clean(l.text) === 'FEATURES');
  if (featuresAt < 0) throw new ParseError(`${name}: no FEATURES banner`, name);

  const head = rest.slice(1, featuresAt);
  const label = (prefix: string): number =>
    head.findIndex((l) => clean(l.text).startsWith(prefix));
  const impulsesAt = label('Impulses:');
  const difficultyAt = label('Difficulty:');
  const adversariesAt = label('Potential Adversaries:');
  if (impulsesAt < 0 || difficultyAt < 0 || adversariesAt < 0) {
    throw new ParseError(
      `${name}: stat block is missing a label`,
      head.map((l) => l.text).join(' | '),
    );
  }
  if (!(impulsesAt < difficultyAt && difficultyAt < adversariesAt)) {
    throw new ParseError(`${name}: stat block labels out of order`, name);
  }

  const join = (from: number, to: number): string =>
    clean(joinLines(head.slice(from, to).map((l) => l.text)));
  const description = join(0, impulsesAt);
  if (description.length === 0) throw new ParseError(`${name}: no description`, name);

  const impulses = join(impulsesAt, difficultyAt).replace(/^Impulses:\s*/, '');
  const adversaries = join(adversariesAt, head.length).replace(/^Potential Adversaries:\s*/, '');

  return {
    id: slugify(name),
    name,
    tier: Number(stat[1]) as Tier,
    type: stat[2] as Environment['type'],
    description,
    impulses,
    difficulty: parseDifficulty(join(difficultyAt, adversariesAt), name),
    potentialAdversaries: splitTopLevel(adversaries),
    features: parseFeatures(rest.slice(featuresAt + 1), banner.x, name),
    sourcePage: banner.folio,
  };
}

function parseDifficulty(text: string, name: string): number {
  const value = text.replace(/^Difficulty:\s*/, '').trim();
  if (/^\d+$/.test(value)) return Number(value);
  if (/^Special\b/i.test(value)) return SPECIAL_DIFFICULTY;
  throw new ParseError(`${name}: unreadable Difficulty`, text);
}

/** Split a list on commas that are not inside a parenthesised sub-list. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buffer = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      out.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  if (buffer.trim().length > 0) out.push(buffer.trim());
  return out.filter((s) => s.length > 0);
}

/**
 * Feature headings sit flush with the column edge; every wrapped line and the
 * bullets under them are indented, which is what keeps the nested
 * "Relentless (2) - Passive." inside Cult Ritual from starting a feature.
 */
function parseFeatures(lines: Sourced[], columnX: number, name: string): Feature[] {
  const isStart = (l: Line): boolean =>
    l.x <= columnX + FLUSH && FEATURE.test(clean(l.text));
  if (lines.length === 0) throw new ParseError(`${name}: FEATURES banner with no features`, name);
  if (!isStart(lines[0]!)) {
    throw new ParseError(`${name}: text before the first feature`, lines[0]!.text);
  }

  return splitOn(lines, isStart).map((block) => {
    const m = FEATURE.exec(clean(block[0]!.text))!;
    const rest = block.slice(1);

    // The question prompts are the only slab-set lines in a feature and always
    // close it.
    const promptAt = rest.findIndex(isSlab);
    const body = promptAt < 0 ? rest : rest.slice(0, promptAt);
    const prompts = promptAt < 0 ? [] : rest.slice(promptAt);
    const stray = prompts.find((l) => !isSlab(l));
    if (stray) throw new ParseError(`${name}: prose after a question prompt`, stray.text);

    const text = clean(joinBody(m[3]!, body));
    const asked = clean(joinLines(prompts.map((l) => l.text)));
    if (text.length === 0) throw new ParseError(`${name}: empty feature`, m[1]!);

    return {
      name: m[1]!.trim(),
      kind: m[2] as Feature['kind'],
      text: asked.length > 0 ? `${text}\n${asked}` : text,
    };
  });
}

/**
 * Bullet-aware paragraph joining, decided on indent rather than on text.
 * `joinWithBullets` folds every following line into the bullet, which is right
 * for wrapped bullet text but wrong for the paragraph that closes Cliffside
 * Ascent's "The Climb". The book distinguishes them by hanging indent: a
 * continuation sits inside the bullet, a new paragraph returns to the margin.
 */
function joinBody(head: string, lines: readonly Line[]): string {
  const blocks: string[] = [];
  let buffer: string[] = [head];
  let bulletX = Infinity;
  const flush = (): void => {
    const joined = joinLines(buffer);
    if (joined.length > 0) blocks.push(joined);
    buffer = [];
  };
  for (const l of lines) {
    if (BULLET.test(l.text)) {
      flush();
      bulletX = l.x;
      buffer.push('- ' + l.text.replace(BULLET, ''));
    } else if (l.x > bulletX + 1) {
      buffer.push(l.text);
    } else {
      if (Number.isFinite(bulletX)) flush();
      bulletX = Infinity;
      buffer.push(l.text);
    }
  }
  flush();
  return blocks.join('\n');
}

/**
 * Folio 103 opens with the "stat blocks by tier" index. Its four narrow
 * columns are a separate grid from the two-column body, so they land in the
 * line stream out of order; everything above the page's first banner is that
 * index, and separating it by height is order-independent.
 *
 * Splitting rather than discarding keeps the index available as the parse's
 * own check, and lets a line that got separated by mistake be caught by shape
 * instead of vanishing.
 */
function splitSection(pages: BookPage[]): { body: Sourced[]; front: Sourced[] } {
  const body: Sourced[] = [];
  const front: Sourced[] = [];
  for (const page of pagesInFolios(pages, FROM, TO)) {
    const banners = page.lines.filter(isBanner);
    if (banners.length === 0) throw new ParseError('page has no banner', `folio ${page.folio}`);
    const top = Math.min(...banners.map((l) => l.y));
    for (const l of page.lines) {
      const line = { ...l, folio: page.folio! };
      if (l.y >= top - 1) body.push(line);
      else front.push(line);
    }
  }
  for (const l of front) {
    const t = clean(l.text);
    if (STAT_LINE.test(t) || LABEL.test(t) || t === 'FEATURES' || FEATURE.test(t)) {
      throw new ParseError('stat-block content above a page banner', `folio ${l.folio}: ${l.text}`);
    }
  }
  return { body, front };
}
