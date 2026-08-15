/**
 * Adversaries - SRD folios 75-101.
 *
 * Each stat block is a 12pt display name, a QuestaSlab "Tier N Role" line, an
 * italic description, four labelled header lines, a FEATURES banner and then
 * one or more `Name - Kind:` features.
 *
 * Tier and role come from the slab line rather than the printed tier banners:
 * the banner is a page-width element that the layout pass turns into a segment
 * boundary, so blocks either side of it can be emitted out of banner order,
 * while the slab line always sits inside the block it belongs to.
 *
 * The chapter prints its own roster on folios 73-74. Every block is checked
 * against it by name and tier, so a stat block that fails to parse - or a
 * banner mistaken for a name - fails here instead of quietly shrinking the
 * dataset.
 */
import type { BookPage, Line } from '../textLayout.ts';
import {
  ADVERSARY_ROLES,
  RANGES,
  type Adversary,
  type AdversaryAttack,
  type AdversaryRole,
  type Feature,
  type Range,
  type Tier,
} from '../types.ts';
import { slugify } from '../slugify.ts';
import {
  ParseError,
  isDisplay,
  isItalic,
  isSlab,
  linesWithFolio,
  normalizeText,
  signedInt,
  titleCase,
} from './util.ts';

const FROM = 75;
const TO = 101;

const ROSTER_FROM = 73;
const ROSTER_TO = 74;

/**
 * The roster misspells one stat block. `OUTER REALMS CORRUPTER` is the block's
 * own heading and wins; the list on folio 74 prints "Corruptor".
 */
const ROSTER_TYPOS: Record<string, string> = { 'Outer Realms Corruptor': 'Outer Realms Corrupter' };

/** Display lines in the range that head a tier section rather than a block. */
const TIER_BANNER = /^TIER \d+ ADVERSARIES\b|^\(LEVELS? [\d-]+\)$/;

const ROLE_LINE = /^Tier ([1-4]) (.+)$/;
const FEATURE_START = /^(.{1,60}?) - (Action|Reaction|Passive):\s*/;

/** `Tier 1 Horde (5/HP)` - the count of creatures each Hit Point represents. */
const HORDE_ROLE = /^Horde \((\d+)\/HP\)$/;
/** `Minion (4) - Passive: ...` - the damage that defeats one extra minion. */
const MINION_FEATURE = /^Minion \((\d+)\)$/;

/** A numbered option inside a feature, e.g. Battle Box's Randomized Tactics. */
const LIST_ITEM = /^\d+\.\s/;

type Sourced = Line & { folio: number };

/**
 * `joinLines` treats a hyphen at a line end as hyphenation and deletes it when
 * the next line starts lowercase. This chapter is set with hyphenation off, so
 * the two lines that break on a hyphen break inside a real compound
 * ("piston-driven", "Secret-Keeper") and must close up with the hyphen intact.
 */
function joinLines(lines: readonly string[]): string {
  let out = '';
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (out.length === 0) out = line;
    else if (/[‐‑-]$/.test(out) && /^\p{L}/u.test(line)) out += line;
    else out += ' ' + line;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Join a feature body, keeping a numbered option list one item per line. */
function joinBody(lines: readonly string[]): string {
  const blocks: string[][] = [[]];
  for (const line of lines) {
    if (LIST_ITEM.test(line.trim())) blocks.push([]);
    blocks[blocks.length - 1]!.push(line);
  }
  return blocks
    .map((b) => joinLines(b))
    .filter((b) => b !== '')
    .join('\n');
}

interface Block {
  name: string;
  folio: number;
  lines: Sourced[];
}

export function parseAdversaries(pages: BookPage[]): Adversary[] {
  const roster = parseRoster(pages);
  const out = blocksInRange(pages).map((b) => parseBlock(b));

  const seen = new Map<string, string>();
  for (const a of out) {
    const clash = seen.get(a.id);
    if (clash !== undefined) throw new ParseError('duplicate adversary id', `${a.id}: ${clash} / ${a.name}`);
    seen.set(a.id, a.name);
  }

  for (const a of out) {
    const listed = roster.get(a.name);
    if (listed === undefined) throw new ParseError('stat block is not on the chapter roster', a.name);
    if (listed !== a.tier) {
      throw new ParseError('roster tier disagrees with the stat block', `${a.name}: roster ${listed}, block ${a.tier}`);
    }
  }
  const missing = [...roster.keys()].filter((n) => !seen.has(slugify(n)));
  if (missing.length > 0) throw new ParseError('rostered adversary has no stat block', missing.join(', '));

  return out;
}

/** The `ADVERSARIES BY TIER` list, as name -> tier. */
function parseRoster(pages: BookPage[]): Map<string, Tier> {
  const out = new Map<string, Tier>();
  let tier: Tier | null = null;
  for (const l of linesWithFolio(pages, ROSTER_FROM, ROSTER_TO)) {
    const text = normalizeText(l.text);
    const head = /^TIER ([1-4]) \(LEVELS? /.exec(text);
    if (head) {
      tier = Number(head[1]) as Tier;
      continue;
    }
    if (!text.startsWith('•')) continue;
    if (tier === null) throw new ParseError('roster entry before any tier heading', text);
    const name = text.replace(/^•\s*/, '');
    out.set(ROSTER_TYPOS[name] ?? name, tier);
  }
  if (out.size === 0) throw new ParseError('adversary roster not found', `folios ${ROSTER_FROM}-${ROSTER_TO}`);
  return out;
}

function blocksInRange(pages: BookPage[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const l of linesWithFolio(pages, FROM, TO)) {
    const text = normalizeText(l.text);
    const display = isDisplay(l) && l.size >= 11;
    if (display && TIER_BANNER.test(text)) {
      current = null; // nothing under a banner belongs to the block above it
      continue;
    }
    if (display) {
      // `FALLEN WARLORD:` and `VOLCANIC DRAGON:` set their epithet on a second
      // display line; nothing else in the range ends a name with a colon.
      if (current !== null && current.lines.length === 0 && current.name.endsWith(':')) {
        current.name += ' ' + text;
        continue;
      }
      current = { name: text, folio: l.folio, lines: [] };
      blocks.push(current);
      continue;
    }
    if (current !== null) current.lines.push(l);
  }
  return blocks;
}

interface Header {
  description: string[];
  motives: string[];
  stats: string[];
  attack: string[];
  experience: string[];
}

const LABELS: Array<[keyof Header, RegExp]> = [
  ['motives', /^Motives & Tactics:\s*/],
  ['stats', /^Difficulty:/],
  ['attack', /^ATK:/],
  ['experience', /^Experience:\s*/],
];

function parseBlock(block: Block): Adversary {
  const name = titleCase(block.name);
  const ctx = `${name} (folio ${block.folio})`;

  const roleLine = block.lines[0];
  if (!roleLine || !isSlab(roleLine)) throw new ParseError('stat block has no "Tier N Role" line', ctx);
  const roleMatch = ROLE_LINE.exec(normalizeText(roleLine.text));
  if (!roleMatch) throw new ParseError('unreadable "Tier N Role" line', `${ctx}: ${roleLine.text}`);
  const tier = Number(roleMatch[1]) as Tier;
  const roleText = roleMatch[2]!.trim();
  const role = roleText.split(/[\s(]/)[0] as AdversaryRole;
  if (!ADVERSARY_ROLES.includes(role)) throw new ParseError('unknown adversary role', `${ctx}: ${roleText}`);
  const horde = HORDE_ROLE.exec(roleText);
  if (!horde && role === 'Horde') throw new ParseError('Horde role without a (N/HP) count', `${ctx}: ${roleText}`);

  const rest = block.lines.slice(1);
  const featuresAt = rest.findIndex((l) => normalizeText(l.text) === 'FEATURES');
  if (featuresAt < 0) throw new ParseError('stat block has no FEATURES banner', ctx);

  const header = parseHeader(rest.slice(0, featuresAt), ctx);
  const features = parseFeatures(rest.slice(featuresAt + 1), ctx);
  if (features.length === 0) throw new ParseError('stat block has no features', ctx);

  const stats = parseStats(joinLines(header.stats), ctx);
  const minion = features
    .map((f) => MINION_FEATURE.exec(f.name))
    .find((m): m is RegExpExecArray => m !== null);

  return {
    id: slugify(name),
    name,
    tier,
    role,
    description: requireText(header.description, 'description', ctx),
    motives: splitList(requireText(header.motives, 'motives', ctx), ctx),
    ...stats,
    attackBonus: parseAttackBonus(header.attack, ctx),
    attack: parseAttack(header.attack, ctx),
    experiences: parseExperiences(header.experience, ctx),
    features,
    ...(horde ? { hordeThreshold: Number(horde[1]) } : {}),
    ...(minion ? { minionGroup: Number(minion[1]) } : {}),
    sourcePage: block.folio,
  };
}

function parseHeader(lines: Sourced[], ctx: string): Header {
  const header: Header = { description: [], motives: [], stats: [], attack: [], experience: [] };
  let section: keyof Header = 'description';
  for (const l of lines) {
    const text = normalizeText(l.text);
    const label = LABELS.find(([, re]) => re.test(text));
    if (label) {
      section = label[0];
      header[section].push(text.replace(label[1], ''));
      continue;
    }
    // Only the flavour line is italic; anything else unlabelled above the
    // stats means the block did not come through the layout pass intact.
    if (section === 'description' && !isItalic(l)) {
      throw new ParseError('unlabelled roman line in a stat block header', `${ctx}: ${text}`);
    }
    header[section].push(text);
  }
  return header;
}

function parseStats(
  line: string,
  ctx: string,
): Pick<Adversary, 'difficulty' | 'thresholds' | 'hp' | 'stress'> {
  const shape = /^(\d+) \| Thresholds: (None|\d+\/(?:\d+|None)) \| HP: (\d+) \| Stress: (\d+)$/.exec(line);
  if (!shape) throw new ParseError('unreadable Difficulty line', `${ctx}: Difficulty: ${line}`);
  return {
    difficulty: Number(shape[1]),
    thresholds: parseThresholds(shape[2]!),
    hp: Number(shape[3]),
    stress: Number(shape[4]),
  };
}

/**
 * `4/None` means damage never reaches Severe. The contract has no way to say
 * that, so the Severe threshold is set out of reach rather than fabricated;
 * both creatures that print it die to a Major hit anyway.
 */
function parseThresholds(text: string): [number, number] | null {
  if (text === 'None') return null;
  const [major, severe] = text.split('/');
  return [Number(major), severe === 'None' ? Number.MAX_SAFE_INTEGER : Number(severe)];
}

function attackParts(lines: string[], ctx: string): string[] {
  const parts = joinLines(lines).split('|').map((p) => p.trim());
  if (parts.length !== 3) throw new ParseError('ATK line is not three fields', `${ctx}: ATK: ${lines.join(' ')}`);
  return parts;
}

/**
 * Outer Realms Abomination prints `ATK: +2d4` - its Chaotic Form feature rolls
 * the modifier. `attackBonus: number` cannot hold a die, so `NdM` stores N, the
 * lowest the roll can come out at. Any other non-integer is a shape this parser
 * has not seen and must not be truncated behind the reader's back.
 */
function parseAttackBonus(lines: string[], ctx: string): number {
  const raw = attackParts(lines, ctx)[0]!;
  if (!/^[-+]?\d+$/.test(raw) && !/^\+\d+d\d+$/.test(raw)) {
    throw new ParseError('unreadable ATK bonus', `${ctx}: ${raw}`);
  }
  return signedInt(raw);
}

function parseAttack(lines: string[], ctx: string): AdversaryAttack {
  const parts = attackParts(lines, ctx);
  const weapon = /^(.+):\s*(.+)$/.exec(parts[1]!);
  if (!weapon) throw new ParseError('unreadable attack name/range', `${ctx}: ${parts[1]}`);
  const range = weapon[2]!.trim() as Range;
  if (!RANGES.includes(range)) throw new ParseError('unknown attack range', `${ctx}: ${range}`);

  const damage = /^(\S+)\s+(.+)$/.exec(parts[2]!);
  if (!damage) throw new ParseError('unreadable attack damage', `${ctx}: ${parts[2]}`);
  return {
    name: weapon[1]!.trim(),
    range,
    damage: damage[1]!,
    // `phy/mag` (Spellblade) is outside the declared union but is what the
    // book prints; the type is too narrow, so keep the source wording.
    damageType: damage[2]!.trim() as AdversaryAttack['damageType'],
  };
}

function parseExperiences(lines: string[], ctx: string): Array<{ name: string; bonus: number }> {
  if (lines.length === 0) return [];
  return joinLines(lines)
    .split(',')
    .map((entry) => {
      const m = /^(.+?)\s*([-+]\d+)$/.exec(entry.trim());
      if (!m) throw new ParseError('unreadable Experience entry', `${ctx}: ${entry}`);
      return { name: m[1]!.trim(), bonus: signedInt(m[2]!) };
    });
}

function parseFeatures(lines: Sourced[], ctx: string): Feature[] {
  const out: Feature[] = [];
  let name = '';
  let kind: Feature['kind'];
  let body: string[] = [];
  const flush = (): void => {
    if (name !== '') out.push({ name, text: joinBody(body), kind });
  };
  for (const l of lines) {
    const text = normalizeText(l.text);
    const start = FEATURE_START.exec(text);
    if (start) {
      flush();
      name = start[1]!.trim();
      kind = start[2] as Feature['kind'];
      body = [text.slice(start[0].length)];
      continue;
    }
    if (name === '') throw new ParseError('feature text before any feature heading', `${ctx}: ${text}`);
    body.push(text);
  }
  flush();
  return out;
}

function requireText(lines: string[], what: string, ctx: string): string {
  const text = joinLines(lines);
  if (text === '') throw new ParseError(`stat block has no ${what}`, ctx);
  return text;
}

function splitList(text: string, ctx: string): string[] {
  const items = text.split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (items.length === 0) throw new ParseError('empty motives list', ctx);
  return items;
}
