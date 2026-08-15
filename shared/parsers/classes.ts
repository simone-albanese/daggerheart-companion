/**
 * Classes and subclasses, folios 8-26.
 *
 * The Druid and Ranger spreads are interleaved with the Beastform tables and
 * the Ranger Companion rules, which belong to other parsers. Rather than
 * hard-coding folios, a class is cut into segments at its display headings:
 * the class name, its `<CLASS> SUBCLASSES` banner and its two subclass names
 * are the only four the book puts there, so everything from a fifth heading on
 * is foreign and dropped.
 */
import { WORD_JOIN_RATIO, type BookPage, type Line, type TextRun } from '../textLayout.ts';
import { DOMAINS, TRAITS, type CharClass, type DomainId, type Feature, type Subclass, type Trait } from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  isBoldSans,
  isDisplay,
  isSlab,
  normalizeText,
  pagesInFolios,
  ParseError,
  splitOn,
} from './util.ts';

const FROM_FOLIO = 8;
const TO_FOLIO = 26;

/** Sub-section banners are set at 11.3pt against 9.3pt body. */
const HEADING_SIZE = 10.5;

const BULLET = /^•\s*/;

/**
 * Leading, in multiples of the point size, above which a line starts a new
 * paragraph. Wrapped lines sit at 1.2, bullet to bullet at 1.5, a paragraph
 * break at 1.8; nothing anywhere in folios 9-26 lands in between.
 */
const PARAGRAPH_LEADING = 1.6;

type FLine = Line & { folio: number };

const isHeading = (l: Line): boolean => isBoldSans(l) && l.size > HEADING_SIZE;

/**
 * `joinLines` reads any trailing dash as hyphenation and deletes it, which
 * eats the em dash the SRD sets as punctuation ("starting a campfire—at
 * will"). Here a dash that is not a plain hyphen closes up unchanged.
 */
const join = (texts: readonly string[]): string => {
  let out = '';
  for (const raw of texts) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (out.length === 0) out = line;
    else if (/[–—―]$/.test(out)) out += line;
    else if (/[‐‑-]$/.test(out) && /^[a-z]/.test(line)) out = out.replace(/[‐‑-]$/, '') + line;
    else out += ' ' + line;
  }
  return out.replace(/\s+/g, ' ').trim();
};

const headingOf = (l: Line): string | null =>
  isHeading(l) ? normalizeText(l.text).toUpperCase() : null;

const upper = (l: Line): string => normalizeText(l.text).toUpperCase();

/** Join a prefix of a line's runs the way `assembleLines` joined the whole. */
const joinRuns = (runs: readonly TextRun[]): string => {
  let out = '';
  let prevEnd = Number.NaN;
  for (const r of runs) {
    if (out.length > 0) out += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
    out += r.text;
    prevEnd = r.x + r.w;
  }
  return out;
};

/**
 * The bold lead-in that names a feature, e.g. `Gifted Performer:`.
 *
 * The book also sets the activation cost bold - "Make a Scene: **Spend 3
 * Hope** to..." - so the name ends at the first bold word carrying the
 * terminating colon or period, not at the end of the bold run.
 */
const featureLabel = (l: Line): string | null => {
  const parts: TextRun[] = [];
  for (const r of l.runs) {
    // Poppler reports italic=true for the bold QuestaSans face, so the family
    // name is the only usable signal here.
    if (!r.bold || !/^QuestaSans/.test(r.family) || /Light|Italic/.test(r.family)) return null;
    parts.push(r);
    if (/[:.]$/.test(r.text)) return joinRuns(parts);
  }
  return null;
};

/**
 * Rules text, with the book's paragraphing preserved: bullets become `- `
 * items, extra leading starts a new paragraph, and so does a switch to or from
 * the slab face (the "Note:"/"Tip:" callouts). The leading only counts within
 * one column of one page - across a break the two lines' `y` are unrelated.
 */
const bodyText = (lines: readonly FLine[], firstText: string): string => {
  const blocks: string[][] = [];
  let current: string[] = [];
  lines.forEach((l, i) => {
    const text = (i === 0 ? firstText : l.text).trim();
    const bullet = BULLET.test(text);
    const prev = i > 0 ? lines[i - 1]! : null;
    const spaced =
      prev !== null &&
      prev.folio === l.folio &&
      prev.column === l.column &&
      l.y - prev.y > l.size * PARAGRAPH_LEADING;
    if (prev !== null && (bullet || spaced || isSlab(l) !== isSlab(prev))) {
      blocks.push(current);
      current = [];
    }
    current.push(bullet ? '- ' + text.replace(BULLET, '') : text);
  });
  blocks.push(current);
  return blocks
    .map((b) => join(b))
    .filter((b) => b.length > 0)
    .join('\n');
};

const features = (lines: readonly FLine[], what: string): Feature[] => {
  if (lines.length === 0) throw new ParseError(`${what}: no feature text`, what);
  if (featureLabel(lines[0]!) === null) {
    throw new ParseError(`${what}: block does not start with a named feature`, lines[0]!.text);
  }
  return splitOn(lines, (l) => featureLabel(l) !== null).map((block) => {
    const label = featureLabel(block[0]!)!;
    return {
      name: label.replace(/[:.]$/, '').trim(),
      text: bodyText(block, block[0]!.text.slice(label.length)),
    };
  });
};

const questions = (lines: readonly FLine[], what: string): string[] => {
  const start = lines.findIndex((l) => BULLET.test(l.text));
  if (start < 0) throw new ParseError(`${what}: no question bullets`, what);
  const out = bodyText(lines.slice(start), lines[start]!.text)
    .split('\n')
    .map((s) => s.replace(/^- /, '').trim())
    .filter((s) => s.length > 0);
  if (out.length === 0) throw new ParseError(`${what}: no questions`, what);
  return out;
};

interface Group {
  heading: string;
  body: FLine[];
}

/** The `HEADING` / body pairs of a block, ignoring anything before the first. */
const groupByHeading = (lines: readonly FLine[]): Group[] =>
  splitOn(lines, (l) => isHeading(l)).map((g) => ({
    heading: headingOf(g[0]!)!,
    body: g.slice(1),
  }));

const trait = (lines: readonly FLine[], what: string): Trait => {
  const text = join(lines.map((l) => l.text)).toLowerCase().replace(/[^a-z]/g, '');
  const found = TRAITS.find((t) => t === text);
  if (!found) throw new ParseError(`${what}: unknown Spellcast trait`, text);
  return found;
};

/** `BARD` -> `Bard`. Class names in the SRD are all single words. */
const titleCaseName = (s: string): string => {
  const t = normalizeText(s);
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const statLine = (lines: readonly FLine[], i: number, label: RegExp, what: string): FLine => {
  const l = lines[i];
  if (!l || !label.test(normalizeText(l.text))) {
    throw new ParseError(`${what}: expected ${String(label)}`, l ? l.text : '<end of class>');
  }
  return l;
};

const afterDash = (text: string): string => {
  const m = /^[^-–—]+[-–—]\s*(.*)$/.exec(normalizeText(text));
  if (m === null) throw new ParseError('stat line has no value', text);
  return m[1]!.trim();
};

const parseDomains = (text: string, what: string): [DomainId, DomainId] => {
  const parts = afterDash(text)
    .split(/\s*(?:&|\band\b)\s*/i)
    .map((s) => slugify(s));
  if (parts.length !== 2) throw new ParseError(`${what}: expected two domains`, text);
  const out = parts.map((p) => {
    const d = DOMAINS.find((x) => x === p);
    if (!d) throw new ParseError(`${what}: unknown domain "${p}"`, text);
    return d;
  });
  return [out[0]!, out[1]!];
};

const parseSubclass = (
  lines: readonly FLine[],
  name: string,
  classRef: string,
): Subclass => {
  const groups = groupByHeading(lines);
  const sub: Subclass = {
    id: slugify(name),
    name,
    classRef,
    spellcastTrait: null,
    foundationFeatures: [],
    specializationFeatures: [],
    masteryFeatures: [],
    sourcePage: lines[0]!.folio,
  };
  for (const g of groups) {
    const what = `${name} / ${g.heading}`;
    if (g.heading === 'SPELLCAST TRAIT') sub.spellcastTrait = trait(g.body, what);
    else if (/^FOUNDATION FEATURES?$/.test(g.heading)) sub.foundationFeatures = features(g.body, what);
    else if (/^SPECIALIZATION FEATURES?$/.test(g.heading)) sub.specializationFeatures = features(g.body, what);
    else if (/^MASTERY FEATURES?$/.test(g.heading)) sub.masteryFeatures = features(g.body, what);
    else throw new ParseError(`${name}: unexpected subclass section`, g.heading);
  }
  for (const [k, v] of [
    ['foundation', sub.foundationFeatures],
    ['specialization', sub.specializationFeatures],
    ['mastery', sub.masteryFeatures],
  ] as const) {
    if (v.length === 0) throw new ParseError(`${name}: no ${k} features`, name);
  }
  return sub;
};

/** The two subclass names announced by "Choose either the A or B subclass." */
const announcedSubclasses = (lines: readonly FLine[], what: string): [string, string] => {
  const text = normalizeText(join(lines.map((l) => l.text)));
  const m = /Choose either (?:the )?(.+?) or (?:the )?(.+?) subclass\./.exec(text);
  if (m === null) throw new ParseError(`${what}: no "Choose either" line`, text);
  return [m[1]!.trim(), m[2]!.trim()];
};

const parseClass = (
  lines: readonly FLine[],
  name: string,
): { charClass: CharClass; subclasses: Subclass[] } => {
  const id = slugify(name);
  const marks = lines.flatMap((l, i) => (i > 0 && isDisplay(l) ? [i] : []));
  const seg = (n: number): FLine[] =>
    lines.slice(n === 0 ? 0 : (marks[n - 1] ?? lines.length), marks[n] ?? lines.length);

  // seg(0) is the class page; seg(1) the subclass banner; seg(2)/seg(3) the
  // two subclasses. Anything past that is a foreign section (Beastform
  // options, Ranger Companion) that the layout drops between class pages.
  const banner = seg(1);
  if (banner.length === 0 || upper(banner[0]!) !== `${name.toUpperCase()} SUBCLASSES`) {
    throw new ParseError(`${name}: subclass banner not found`, banner[0]?.text ?? '<none>');
  }
  const announced = announcedSubclasses(banner.slice(1), `${name} subclasses`);

  const subLines = [seg(2), seg(3)];
  const subclasses = announced.map((subName, k) => {
    const block = subLines[k]!;
    if (block.length === 0 || upper(block[0]!) !== subName.toUpperCase()) {
      throw new ParseError(`${name}: expected subclass "${subName}"`, block[0]?.text ?? '<none>');
    }
    // The class's closing questions sit at the foot of the second subclass.
    const tail = block.findIndex((l) => headingOf(l) === 'BACKGROUND QUESTIONS');
    return parseSubclass(tail < 0 ? block : block.slice(0, tail), subName, id);
  });

  const tailStart = seg(3).findIndex((l) => headingOf(l) === 'BACKGROUND QUESTIONS');
  if (tailStart < 0) throw new ParseError(`${name}: no background questions`, name);
  const tailGroups = groupByHeading(seg(3).slice(tailStart));

  const head = seg(0);
  let i = 1;
  const description: string[] = [];
  while (i < head.length && !/^DOMAINS\b/.test(normalizeText(head[i]!.text))) {
    description.push(head[i]!.text);
    i++;
  }
  const domains = parseDomains(statLine(head, i++, /^DOMAINS\b/, name).text, name);
  const startingEvasion = Number(afterDash(statLine(head, i++, /^STARTING EVASION\b/, name).text));
  const startingHitPoints = Number(afterDash(statLine(head, i++, /^STARTING HIT POINTS\b/, name).text));
  const itemLines = [statLine(head, i++, /^CLASS ITEMS\b/, name)];
  while (i < head.length && !isHeading(head[i]!)) itemLines.push(head[i++]!);
  if (!Number.isInteger(startingEvasion) || !Number.isInteger(startingHitPoints)) {
    throw new ParseError(`${name}: non-numeric starting Evasion or Hit Points`, name);
  }

  const classItems = join([afterDash(itemLines[0]!.text), ...itemLines.slice(1).map((l) => l.text)])
    .split(/\s+or\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let hopeFeature: Feature | null = null;
  let classFeatures: Feature[] = [];
  for (const g of groupByHeading(head.slice(i))) {
    const what = `${name} / ${g.heading}`;
    const hope = /^(.+)[’']S HOPE FEATURE$/.exec(g.heading);
    if (hope && hope[1] === name.toUpperCase()) {
      const f = features(g.body, what);
      if (f.length !== 1) throw new ParseError(`${name}: expected one Hope feature`, what);
      hopeFeature = f[0]!;
    } else if (/^CLASS FEATURES?$/.test(g.heading)) {
      classFeatures = features(g.body, what);
    } else {
      throw new ParseError(`${name}: unexpected class section`, g.heading);
    }
  }
  if (hopeFeature === null) throw new ParseError(`${name}: no Hope feature`, name);
  if (classFeatures.length === 0) throw new ParseError(`${name}: no class features`, name);

  let backgroundQuestions: string[] = [];
  let connectionQuestions: string[] = [];
  for (const g of tailGroups) {
    if (g.heading === 'BACKGROUND QUESTIONS') backgroundQuestions = questions(g.body, `${name} background`);
    else if (g.heading === 'CONNECTIONS') connectionQuestions = questions(g.body, `${name} connections`);
    else throw new ParseError(`${name}: unexpected trailing section`, g.heading);
  }
  if (connectionQuestions.length === 0) throw new ParseError(`${name}: no connection questions`, name);

  return {
    charClass: {
      id,
      name,
      description: join(description),
      domains,
      startingEvasion,
      startingHitPoints,
      // The SRD carries no per-class equipment list; Step 5 of character
      // creation covers starting gear for every class at once.
      suggestedEquipment: [],
      classItems,
      hopeFeature,
      classFeatures,
      backgroundQuestions,
      connectionQuestions,
      subclasses: subclasses.map((s) => s.id),
      sourcePage: head[0]!.folio,
    },
    subclasses,
  };
};

/**
 * The class folios in reading order.
 *
 * On folio 21 both columns break at the same height, so the layout's XY cut
 * takes the horizontal cut first and emits the left column's lower half after
 * the whole right column - which lands the Winged Sentinel's mastery feature
 * before the subclass it belongs to. Sorting each page by column then depth is
 * the reader's order for a plain two-column page, and a no-op on the other
 * eighteen.
 */
const readingOrder = (pages: BookPage[]): FLine[] =>
  pagesInFolios(pages, FROM_FOLIO, TO_FOLIO).flatMap((p) =>
    [...p.lines]
      .sort((a, b) => a.column - b.column || a.y - b.y || a.x - b.x)
      .map((l) => ({ ...l, folio: p.folio! })),
  );

export function parseClasses(pages: BookPage[]): { classes: CharClass[]; subclasses: Subclass[] } {
  const lines = readingOrder(pages);

  // Every class announces itself twice: once as a page title and once as a
  // `<CLASS> SUBCLASSES` banner. The banner is the unambiguous one.
  const names = new Set<string>();
  for (const l of lines) {
    const m = /^(.+) SUBCLASSES$/.exec(upper(l));
    if (isDisplay(l) && m) names.add(m[1]!);
  }
  if (names.size === 0) throw new ParseError('no class subclass banners found', 'folios 8-26');

  const starts = lines.flatMap((l, i) => (isDisplay(l) && names.has(upper(l)) ? [i] : []));
  if (starts.length !== names.size) {
    throw new ParseError(
      `found ${String(starts.length)} class headings for ${String(names.size)} classes`,
      [...names].join(', '),
    );
  }

  const classes: CharClass[] = [];
  const subclasses: Subclass[] = [];
  starts.forEach((start, k) => {
    const slice = lines.slice(start, starts[k + 1] ?? lines.length);
    const parsed = parseClass(slice, titleCaseName(slice[0]!.text));
    classes.push(parsed.charClass);
    subclasses.push(...parsed.subclasses);
  });

  for (const [what, items] of [
    ['class', classes],
    ['subclass', subclasses],
  ] as const) {
    const seen = new Set<string>();
    for (const it of items) {
      if (seen.has(it.id)) throw new ParseError(`duplicate ${what} id`, it.id);
      seen.add(it.id);
    }
  }

  return { classes, subclasses };
}

