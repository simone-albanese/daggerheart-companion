/**
 * Environments - the tail of the "Adversaries and Environments" chapter.
 *
 * Each stat block is a display banner, a slab "Tier N Type" line, an italic
 * one-line summary, the Impulses / Difficulty / Potential Adversaries labels,
 * a FEATURES banner, then named features that carry their kind in the heading
 * ("Name - Action:") and usually trail a slab-set question prompt.
 *
 * ## Where the section starts and stops, in a book that does not index it
 *
 * The contents page names the chapter but not this section inside it, so the
 * near end has to come from the page. The anchor is the section's own index
 * heading, `ENVIRONMENT STAT BLOCKS BY TIER`, set in the Thin display face and
 * printed verbatim in both books. The far end is the chapter's: the folio
 * before `Additional GM Guidance`.
 *
 *   SRD 1.0  folios 103-111   SRD 2.0  folios 159-182
 *
 * The `USING ENVIRONMENTS` rules that precede the index are deliberately
 * outside the range, and they are also where the boundary with `adversaries.ts`
 * lies. In SRD 1.0 they own folio 102 outright, so the two sections never share
 * a page. In SRD 2.0 they start HALFWAY DOWN folio 158, under the PERFECTED
 * ZOMBIE and ZOMBIE LEGION stat blocks - so folio 158 belongs to the
 * adversaries, and this range still begins cleanly on the next folio. Stated as
 * a rule the other side can be reconciled against: **environments own every
 * folio from the one carrying the index heading to the end of the chapter, and
 * nothing before it.**
 *
 * The tier banners ("TIER 2 ENVIRONMENTS (LEVELS 2-4)") are skipped because
 * each block states its own tier on the slab line.
 */
import type { BookPage, Line } from '../textLayout.ts';
import type { Environment, Feature, Tier } from '../types.ts';
import { slugify } from '../slugify.ts';
import { parseContents, rangeBetween } from './contents.ts';
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

/**
 * The Thin display heading that opens the section's own index of stat blocks.
 * Its folio is the section's first folio in both books.
 */
const INDEX_HEADING = 'ENVIRONMENT STAT BLOCKS BY TIER';

/**
 * Point tolerance for "this line starts at the column's left edge".
 *
 * The single-page SRD 2.0 layout still satisfies it, with the same margin SRD
 * 1.0 had. Measured exhaustively rather than sampled: across all 78 feature
 * headings in SRD 1.0 and all 197 in SRD 2.0, EVERY heading sits at offset
 * 0.000 +/- 0.001pt from its own block's banner. The nearest thing to a false
 * positive is the wrapped line under it, indented 5.6pt in SRD 1.0 (folio 103:
 * banner and headings at 687.9, continuations at 693.5) and 5.7pt in SRD 2.0
 * (folio 160: 62.5 vs 68.2; folio 161 col 2: 325.2 vs 330.8).
 *
 * The test is against the block's own banner rather than a page constant
 * because SRD 2.0 alternates its margins folio by folio - column edges at
 * 62.5/311.0 on an even folio, 77.3/325.2 on an odd one.
 */
const FLUSH = 3;

/**
 * Ambushed and Ambushers print `Difficulty: Special`: their Difficulty is
 * whatever the adversaries present bring. `Environment.difficulty` is a
 * number, so 0 stands for "no fixed Difficulty" - the Relative Strength
 * feature in the same block carries the rule. SRD 2.0 adds a THIRD - Duel, on
 * folio 168, whose Relative Strength reads "the adversary who issued the
 * challenge" rather than "the adversary with the highest Difficulty". All 47
 * Difficulty lines in that book were read: 44 integers and those three.
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

/**
 * The index shortens one name. Folio 179 of SRD 2.0 heads the block
 * `CONVERGENCE, THE / CITY OF PORTALS`; the index on folio 159 lists
 * "Convergence, City of Portals". The block's own heading wins - it is the
 * name printed on the thing being described, and the same call was already
 * made the other way round for `Outer Realms Corrupter` in `adversaries.ts`.
 * Keyed by the index's spelling, valued by the block's.
 */
const INDEX_TYPOS: Readonly<Record<string, string>> = {
  'Convergence, City of Portals': 'Convergence, the City of Portals',
};

type Sourced = Line & { folio: number };

export function parseEnvironments(pages: BookPage[]): Environment[] {
  const range = sectionFolios(pages);
  const { body, front } = splitSection(pages, range);
  const blocks = splitOn(joinBanners(body), isBanner);
  if (blocks.length === 0) {
    throw new ParseError('no environment banners found', `folios ${range.from}-${range.to}`);
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
  checkAgainstIndex(front, out, range);
  return out;
}

/**
 * The folios this section occupies, read off the book rather than written down.
 *
 * The far end is the chapter's own, from the contents page. The near end is not
 * on the contents page at all - environments have no entry of their own - so it
 * comes from the page that carries the section's index heading. Searching only
 * inside the chapter keeps the anchor from matching anything the book might
 * print about environments elsewhere.
 */
function sectionFolios(pages: BookPage[]): { from: number; to: number } {
  const entries = parseContents(pages);
  const chapter = rangeBetween(
    entries,
    ['Adversaries and Environments'],
    ['Additional GM Guidance'],
  );
  const opener = pagesInFolios(pages, chapter.from, chapter.to).find((p) =>
    p.lines.some((l) => isDisplay(l) && clean(l.text) === INDEX_HEADING),
  );
  if (opener === undefined) {
    throw new ParseError(
      `no "${INDEX_HEADING}" heading in "Adversaries and Environments"`,
      `folios ${chapter.from}-${chapter.to}`,
    );
  }
  return { from: opener.folio!, to: chapter.to };
}

/**
 * A name set on two display lines is one name.
 *
 * SRD 1.0 fits every environment name on a single line; SRD 2.0 breaks two of
 * them - `ALCHEMIST'S ABANDONED / WORKSHOP` on folio 161 and `CONVERGENCE, THE
 * / CITY OF PORTALS` on folio 179. Left alone, the second line starts a block
 * of its own and the first becomes a block with no stat line.
 *
 * The join is geometric, not lexical: same page, same column edge, and the next
 * line down (the second line sits 12pt below the first, one display line
 * height). That deliberately does not merge the two-line tier banners, which
 * are excluded by name before the geometry is even looked at, and cannot merge
 * across a column or a page because both would fail the x or folio test.
 */
function joinBanners(lines: readonly Sourced[]): Sourced[] {
  const out: Sourced[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const above = lines[i - 1];
    const continues =
      above !== undefined &&
      out.length > 0 &&
      isBanner(line) &&
      isBanner(above) &&
      !TIER_BANNER.test(clean(line.text)) &&
      !TIER_BANNER.test(clean(above.text)) &&
      line.folio === above.folio &&
      Math.abs(line.x - above.x) <= FLUSH &&
      line.y > above.y &&
      line.y - above.y <= above.size * 1.5;
    if (continues) {
      const head = out[out.length - 1]!;
      out[out.length - 1] = { ...head, text: `${head.text} ${line.text}` };
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * The section opens with the book's own index of every stat block in it.
 * Checking the parse against it is the only thing that can catch a block
 * disappearing at a column or page break, which a banner-driven split has no
 * way to notice by itself. It also pins the title-casing to the book's own
 * spelling, since the index sets the names in mixed case and the blocks don't.
 */
function checkAgainstIndex(
  front: Sourced[],
  out: Environment[],
  range: { from: number; to: number },
): void {
  const entries = splitOn(front.filter(isBody), (l) => BULLET.test(l.text)).map((b) =>
    clean(joinLines(b.map((l) => l.text))).replace(BULLET, ''),
  );
  if (entries.length === 0) {
    throw new ParseError('no stat-block index on the section opener', `folio ${range.from}`);
  }
  const expected = entries.map((e) => {
    const m = INDEX_ENTRY.exec(e);
    if (!m) throw new ParseError('unreadable stat-block index entry', e);
    const name = m[1]!;
    return `${INDEX_TYPOS[name] ?? name} (${m[2]})`;
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
 * bullets under them are indented.
 *
 * The indent test rejects nothing in either book, and the comment it replaces
 * said otherwise: it credited the indent with keeping the nested "Relentless
 * (2) - Passive." inside Cult Ritual from starting a feature. That line is the
 * only kind-shaped line in either book that is not a heading (SRD 1.0 folio
 * 106, SRD 2.0 folio 167), and `FEATURE` already excludes it, because it ends
 * in a full stop where a heading ends in a colon. The indent is a second lock
 * on the same door - kept, because a book that sets a nested feature with a
 * colon would walk straight through the regex, but not the reason this works
 * today.
 *
 * The face is not usable as the signal here even though it looks like one: SRD
 * 1.0 sets every feature heading in QuestaSans, while SRD 2.0 sets some of them
 * in QuestaSans-Light and one - "It's Alive!" on folio 161 - in
 * QuestaSans-LightItalic, the same face as a block's flavour line.
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
 * The section's index is separated from its stat blocks by height, not by page.
 *
 * SRD 1.0 sets the index in four narrow columns across the top third of folio
 * 103 and puts the first two stat blocks underneath it. Those columns are a
 * separate grid from the two-column body, so they land in the line stream out
 * of order - the TIER 4 column arrives AFTER the first banner - and only a
 * height test is order-independent enough to separate them.
 *
 * SRD 2.0 gives the index a page of its own (folio 159, sharing it with the
 * "Adapting Environments" rules and the benchmark table) and starts the stat
 * blocks on the next one. That page carries no banner at all, which used to be
 * an error; it is front matter, and it is only an error AFTER the first stat
 * block, where a page without a banner means a block lost its heading.
 *
 * Splitting rather than discarding keeps the index available as the parse's
 * own check, and lets a line that got separated by mistake be caught by shape
 * instead of vanishing.
 */
function splitSection(
  pages: BookPage[],
  range: { from: number; to: number },
): { body: Sourced[]; front: Sourced[] } {
  const body: Sourced[] = [];
  const front: Sourced[] = [];
  let started = false;
  for (const page of pagesInFolios(pages, range.from, range.to)) {
    const banners = page.lines.filter(isBanner);
    if (banners.length === 0) {
      if (started) throw new ParseError('page has no banner', `folio ${page.folio}`);
      for (const l of page.lines) front.push({ ...l, folio: page.folio! });
      continue;
    }
    const top = Math.min(...banners.map((l) => l.y));
    for (const l of page.lines) {
      const line = { ...l, folio: page.folio! };
      if (l.y >= top - 1) body.push(line);
      else front.push(line);
    }
    started = true;
  }
  for (const l of front) {
    const t = clean(l.text);
    if (STAT_LINE.test(t) || LABEL.test(t) || t === 'FEATURES' || FEATURE.test(t)) {
      throw new ParseError('stat-block content above a page banner', `folio ${l.folio}: ${l.text}`);
    }
  }
  return { body, front };
}
