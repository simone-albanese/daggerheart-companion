/**
 * Adversaries - the stat blocks inside the "Adversaries and Environments"
 * chapter.
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
 * The chapter prints its own roster before the blocks. Every block is checked
 * against it by name and tier, so a stat block that fails to parse - or a
 * banner mistaken for a name - fails here instead of quietly shrinking the
 * dataset.
 *
 * ## Why the range is three anchors on the page and not four folio numbers
 *
 * This file used to carry `ROSTER_FROM = 73`, `ROSTER_TO = 74`, `FROM = 75`,
 * `TO = 101`. Those are the right pages of SRD 1.0 and the wrong pages of
 * everything else: in SRD 2.0 the same four boundaries fall on 95, 96, 97 and
 * 158. `contents.ts` reads folios off the book's own index, but the index has
 * no entry for the adversaries: they and the environments share one chapter
 * entry ("Adversaries and Environments", folio 71 / 93), and the boundary
 * between them is printed on the page, not in the index.
 *
 * So the chapter comes from the contents and the three cuts inside it come
 * from the book's own headings: the `ADVERSARIES BY TIER` roster heading, the
 * first `TIER n ADVERSARIES` banner, and `USING ENVIRONMENTS`.
 *
 * ## Why the cuts are made on LINES rather than on folios
 *
 * A folio range cannot express the SRD 2.0 boundary. Folio 158 carries the
 * last two stat blocks (PERFECTED ZOMBIE, ZOMBIE LEGION) above the USING
 * ENVIRONMENTS heading, so a range ending at 157 loses two adversaries and a
 * range ending at 158 takes the environment rules in. Cutting the line stream
 * at the heading itself is the only cut that is right on both books; on SRD
 * 1.0, where USING ENVIRONMENTS is the first line of folio 102, it makes no
 * difference at all.
 *
 * ## The role word is NOT the boundary with the environments
 *
 * `environments.ts` reads `Tier N (Exploration|Social|Traversal|Event)` and
 * this file reads `Tier N <role>`, which looks like it tells the two chapters
 * apart. It does not: `Social` is BOTH an adversary role and an environment
 * type, and both books print `Tier 1 Social` in each half of the chapter
 * (Courtier and Merchant against Local Tavern and Outpost Town). Only the
 * heading separates them.
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
  isBody,
  isDisplay,
  isItalic,
  isSlab,
  linesWithFolio,
  normalizeText,
  signedInt,
  titleCase,
} from './util.ts';
import { parseContents, sectionRange } from './contents.ts';

/** Both books print the adversaries and the environments under one entry. */
const CHAPTER = 'Adversaries and Environments';

/** The heading above the chapter's own roster. Thin display, 12pt, both books. */
const ROSTER_HEADING = /^ADVERSARIES BY TIER$/;

/** The heading that opens the environments half and closes this one. */
const ENVIRONMENTS_HEADING = /^USING ENVIRONMENTS$/;

/**
 * The roster misspells one stat block. `OUTER REALMS CORRUPTER` is the block's
 * own heading and wins; the list prints "Corruptor" - in both books.
 */
const ROSTER_TYPOS: Record<string, string> = { 'Outer Realms Corruptor': 'Outer Realms Corrupter' };

/**
 * Display lines in the range that head a tier section rather than a block.
 *
 * SRD 1.0 breaks two of the four onto a second line ("TIER 3 ADVERSARIES" /
 * "(LEVELS 5-7)"); SRD 2.0 sets all four on one. Both shapes are matched.
 */
const TIER_BANNER = /^TIER \d+ ADVERSARIES\b|^\(LEVELS? [\d-]+\)$/;

/** The roster's own tier headings, which are body type rather than display. */
const ROSTER_TIER = /^TIER ([1-4]) \(LEVELS? /;

const ROLE_LINE = /^Tier ([1-4]) (.+)$/;
/**
 * `Evolution` is new in SRD 2.0 - six blocks carry one (the Phoenix's
 * Resurrection, the Roc's Nest Warden, the Vampire Lord's Hellwing, the
 * Mountain Troll's Enraged form, the Cephilith Titan's "It’s Here…", Adonix's
 * Alpha to Omega). `Feature.kind` in shared/types.ts does not have the word,
 * and this lane may not widen it, so the kind is carried through as the book
 * prints it and reported. Leaving `Evolution` OUT of this alternation is the
 * one option that must not be taken: the heading would then fail to start a
 * feature and its whole body would be appended to the feature above it, which
 * is a wrong record that nothing throws on.
 */
const FEATURE_START = /^(.{1,60}?) - (Action|Reaction|Passive|Evolution):\s*/;

/** `Tier 1 Horde (5/HP)` - the count of creatures each Hit Point represents. */
const HORDE_ROLE = /^Horde \((\d+)\/HP\)$/;
/** `Minion (4) - Passive: ...` - the damage that defeats one extra minion. */
const MINION_FEATURE = /^Minion \((\d+)\)$/;

/** A numbered option inside a feature, e.g. Battle Box's Randomized Tactics. */
const LIST_ITEM = /^\d+\.\s/;

/**
 * How far past its bullet a wrapped roster entry may hang, in points.
 * Measured: the one wrap in either book indents by 9, and the next roster
 * column starts 165 points away (SRD 2.0's three columns; SRD 1.0's two are
 * 248 apart). Anything between the two is a value this cannot get wrong.
 */
const WRAP_INDENT = 40;

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

/** A line of a feature's body, and whether it opens a paragraph of its own. */
interface BodyLine {
  text: string;
  startsBlock: boolean;
}

/** Join a feature body, keeping each flagged line's paragraph separate. */
function joinBody(lines: readonly BodyLine[]): string {
  const blocks: string[][] = [[]];
  for (const line of lines) {
    if (line.startsBlock) blocks.push([]);
    blocks[blocks.length - 1]!.push(line.text);
  }
  return blocks
    .map((b) => joinLines(b))
    .filter((b) => b !== '')
    .join('\n');
}

/** One line of the chapter's own roster: the book's spelling, and its tier. */
interface RosterEntry {
  tier: Tier;
  name: string;
}

interface Block {
  name: string;
  folio: number;
  /** Left edge of the display name: the column its own text is set flush to. */
  x: number;
  lines: Sourced[];
}

/** Point tolerance for "this line starts at the block's own column edge". */
const FLUSH = 3;

export function parseAdversaries(pages: BookPage[]): Adversary[] {
  const { rosterLines, blockLines } = splitChapter(pages);
  const roster = parseRoster(rosterLines);
  const out = blocksIn(blockLines).map((b) => parseBlock(b, roster));

  const seen = new Map<string, string>();
  for (const a of out) {
    const clash = seen.get(a.id);
    if (clash !== undefined) throw new ParseError('duplicate adversary id', `${a.id}: ${clash} / ${a.name}`);
    seen.set(a.id, a.name);
  }

  for (const a of out) {
    const listed = roster.get(fold(a.name));
    if (listed === undefined) throw new ParseError('stat block is not on the chapter roster', a.name);
    if (listed.tier !== a.tier) {
      throw new ParseError(
        'roster tier disagrees with the stat block',
        `${a.name}: roster ${listed.tier}, block ${a.tier}`,
      );
    }
  }
  const missing = [...roster.values()].filter((e) => !seen.has(slugify(e.name)));
  if (missing.length > 0) {
    throw new ParseError('rostered adversary has no stat block', missing.map((e) => e.name).join(', '));
  }

  return out;
}

/**
 * The book prints each name twice and disagrees with itself about the case.
 *
 * The stat block heading is display type set in all caps; the roster is mixed
 * case. Recovering one from the other is `titleCase`, and it is right 129
 * times out of 129 in SRD 1.0 and 262 out of 264 in SRD 2.0 - the two it
 * cannot know are `Will-o’-the-Wisps` and `Jack-o’-Lantern`, where the book
 * keeps the interior words lowercase inside the hyphenated compound.
 *
 * So the case is taken from the roster, which is where the book WRITES it, and
 * `titleCase` is left as the fallback for a heading the roster does not name -
 * which then fails the roster check by name, loudly, as before.
 *
 * The comparison is case-folded ON PURPOSE and no further: `Outer Realms
 * Corrupter` and the roster's `Corruptor` are different LETTERS, not different
 * case, and that one is a printing error the block wins (see `ROSTER_TYPOS`).
 * Folding harder would silently adopt the misprint into the dataset.
 */
const fold = (s: string): string => normalizeText(s).toUpperCase();

/** A display heading of the size the chapter sets its section headings at. */
const isHeading = (l: Line, re: RegExp): boolean =>
  isDisplay(l) && l.size >= 11 && re.test(normalizeText(l.text));

/**
 * The chapter's two adversary halves - the roster, and the stat blocks.
 *
 * The outer bound is the contents entry the two halves share with the
 * environments; the three cuts inside it are the book's own headings. See the
 * file docblock for why they are lines rather than folios.
 */
function splitChapter(pages: BookPage[]): { rosterLines: Sourced[]; blockLines: Sourced[] } {
  const chapter = sectionRange(parseContents(pages), CHAPTER);
  const lines = linesWithFolio(pages, chapter.from, chapter.to);
  const where = (re: RegExp, what: string): number => {
    const at = lines.findIndex((l) => isHeading(l, re));
    if (at < 0) {
      throw new ParseError(
        `"${CHAPTER}" has no ${what} heading`,
        `folios ${chapter.from}-${chapter.to}, up to "${chapter.next}"`,
      );
    }
    return at;
  };
  const rosterAt = where(ROSTER_HEADING, 'roster');
  const firstBanner = where(TIER_BANNER, 'tier');
  const environmentsAt = where(ENVIRONMENTS_HEADING, 'environments');
  if (!(rosterAt < firstBanner && firstBanner < environmentsAt)) {
    throw new ParseError(
      'the chapter headings are not in the printed order',
      `roster ${rosterAt}, first tier banner ${firstBanner}, environments ${environmentsAt}`,
    );
  }
  return {
    rosterLines: lines.slice(rosterAt + 1, firstBanner),
    blockLines: lines.slice(firstBanner, environmentsAt),
  };
}

/**
 * The `ADVERSARIES BY TIER` list, as name -> tier.
 *
 * ## The wrapped entry, which SRD 1.0 does not have and SRD 2.0 does
 *
 * The list is one bullet per adversary and every SRD 1.0 name fits its column.
 * SRD 2.0 prints `• Fallen Warlord: Undefeated` with `Champion` on a second,
 * hanging-indented line, so reading only the bullet lines yields a name the
 * stat block does not have and the block is reported as unrostered.
 *
 * A continuation is recognised on four measured facts at once - same page,
 * body type, the same size as its bullet, and indented past it but by less
 * than the column is wide.
 *
 * This used to say "All four are needed". That was an assertion, not a
 * measurement, and an independent pass refuted it: each of the conditions can
 * be removed ON ITS OWN with the tests still 11/11 and SRD 1.0 still
 * byte-identical. Only removing all of them together goes red. What is true is
 * that the CONJUNCTION is what excludes the intruders below, and that no single
 * one of them is load-bearing against the two books we have. Any of them may be
 * the one that matters on the third, which is why they stay - but nobody should
 * read this and believe there is a test behind each. The conjunction is needed
 * the list: SRD 2.0's benchmark table shares the roster's first page and the
 * layout pass emits its two right-hand columns AFTER the roster heading, so
 * `Tier 3`, `+3` and `Major 20/Severe 32` arrive here indented far past the
 * bullets. They are 8pt where the list is 9.3pt, and they are display or plain
 * QuestaSans where the list is QuestaSans-Light.
 */
function parseRoster(lines: readonly Sourced[]): Map<string, RosterEntry> {
  const out = new Map<string, RosterEntry>();
  let tier: Tier | null = null;
  /** The bullet still open for a hanging-indent continuation. */
  let open: { name: string; x: number; size: number; folio: number } | null = null;
  const flush = (): void => {
    if (open === null) return;
    const name = ROSTER_TYPOS[open.name] ?? open.name;
    out.set(fold(name), { tier: tier!, name });
    open = null;
  };
  for (const l of lines) {
    const text = normalizeText(l.text);
    const head = ROSTER_TIER.exec(text);
    if (head) {
      flush();
      tier = Number(head[1]) as Tier;
      continue;
    }
    if (text.startsWith('•')) {
      flush();
      if (tier === null) throw new ParseError('roster entry before any tier heading', text);
      open = { name: text.replace(/^•\s*/, ''), x: l.x, size: l.size, folio: l.folio };
      continue;
    }
    if (
      open !== null &&
      isBody(l) &&
      l.folio === open.folio &&
      Math.abs(l.size - open.size) < 0.5 &&
      l.x > open.x + 1 &&
      l.x < open.x + WRAP_INDENT
    ) {
      open.name = `${open.name} ${text}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    flush();
  }
  flush();
  if (out.size === 0) throw new ParseError('adversary roster not found', 'no bulleted entries under the roster heading');
  return out;
}

/**
 * The stat blocks, split at their display names.
 *
 * The first line is the tier banner the range starts at, which resets the
 * open block exactly as any later banner does.
 */
function blocksIn(lines: readonly Sourced[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const l of lines) {
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
      current = { name: text, folio: l.folio, x: l.x, lines: [] };
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

function parseBlock(block: Block, roster: ReadonlyMap<string, RosterEntry>): Adversary {
  const name = roster.get(fold(block.name))?.name ?? titleCase(block.name);
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
  const features = parseFeatures(rest.slice(featuresAt + 1), block.x, ctx);
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

/**
 * `Stress: None` - one block in SRD 2.0, none in SRD 1.0.
 *
 * Spellbound Armor (folio 110) prints it, and its own Tireless feature says
 * why: "The Armor can't be forced to mark Stress." `Adversary.stress` is a
 * number and cannot say None, so 0 stands for a creature with no Stress track
 * at all - the same shape environments.ts uses for `Difficulty: Special`, and
 * the rule stays legible because the feature that carries it is in the record.
 * The honest fix is `stress: number | null`, a schema bump and a converter;
 * that is shared/types.ts and belongs to no lane, so it is reported instead.
 */
const NO_STRESS_TRACK = 0;

function parseStats(
  line: string,
  ctx: string,
): Pick<Adversary, 'difficulty' | 'thresholds' | 'hp' | 'stress'> {
  const shape =
    /^(\d+) \| Thresholds: (None|\d+\/(?:\d+|None)) \| HP: (\d+) \| Stress: (None|\d+)$/.exec(line);
  if (!shape) throw new ParseError('unreadable Difficulty line', `${ctx}: Difficulty: ${line}`);
  return {
    difficulty: Number(shape[1]),
    thresholds: parseThresholds(shape[2]!),
    hp: Number(shape[3]),
    stress: shape[4] === 'None' ? NO_STRESS_TRACK : Number(shape[4]),
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

/**
 * The features under the FEATURES banner, split at their headings.
 *
 * ## A heading that is indented belongs to the feature above it
 *
 * SRD 2.0 nests features inside an Evolution: the Roc's `Nest Warden -
 * Evolution` ends "it gains the following features:" and `Wrathful` and
 * `Electrifying Aura` follow, indented. Read as headings they become features
 * the Roc has from the start of the fight, which is a wrong record no check
 * would catch - the block parses, the roster agrees, the text is even correct
 * in isolation.
 *
 * The book separates them by indent and nothing else, so this does too, the
 * same way `environments.ts` keeps Cult Ritual's nested `Relentless (2)` in
 * its parent's body. Measured across both books: 417 of 417 feature headings
 * in SRD 1.0 sit exactly on the block's column, and 905 of 912 in SRD 2.0; the
 * seven that do not are indented by 6pt and every one of them is nested under
 * an Evolution (Mountain Troll, Roc x2, Vampire Lord x2, Adonix x2).
 *
 * The schema has no room for a sub-feature - `Feature` is name, text, kind -
 * so the nested heading stays in the parent's text, on a paragraph of its own.
 */
function parseFeatures(lines: Sourced[], columnX: number, ctx: string): Feature[] {
  const out: Feature[] = [];
  let name = '';
  let kind: Feature['kind'];
  let body: BodyLine[] = [];
  const flush = (): void => {
    if (name !== '') out.push({ name, text: joinBody(body), kind });
  };
  for (const l of lines) {
    const text = normalizeText(l.text);
    const start = FEATURE_START.exec(text);
    if (start && l.x <= columnX + FLUSH) {
      flush();
      name = start[1]!.trim();
      /*
       * `Evolution` is not in `Feature['kind']`; see FEATURE_START. Carrying
       * the book's own word through is the same choice `parseAttack` makes for
       * Spellblade's `phy/mag` damage type: the contract is narrower than the
       * book, and the source wording is kept rather than a nearby lie.
       */
      kind = start[2] as Feature['kind'];
      body = [{ text: text.slice(start[0].length), startsBlock: false }];
      continue;
    }
    if (name === '') throw new ParseError('feature text before any feature heading', `${ctx}: ${text}`);
    body.push({ text, startsBlock: LIST_ITEM.test(text.trim()) || start !== null });
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
