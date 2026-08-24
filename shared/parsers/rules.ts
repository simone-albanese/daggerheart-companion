/**
 * The prose the app renders and never executes: the introduction, character
 * creation, the core mechanics, combat, downtime, levelling, the GM chapter
 * and the Witherwild campaign frame.
 *
 * Two things make this harder than reading `page.lines` in order.
 *
 * 1. The XY-cut in `textLayout` is tuned for cards and stat blocks. Where a
 *    page sets two *independent* columns - folio 3's sidebar, folio 102's
 *    stat-block glossary - it walks them band by band and interleaves them,
 *    and where two headings share a baseline in different columns it welds
 *    them into one line ("ENVIRONMENT STAT BLOCK" + "DESCRIPTION"). So this
 *    parser re-assembles lines from `page.runs`, cutting every band at the
 *    gutter before anything else.
 * 2. Section boundaries are typographic, not textual: a heading is a heading
 *    because of its face and size. The manifest below names every heading
 *    that opens a section, in book order, so a layout change fails loudly
 *    instead of silently merging two topics.
 */
import type { BookPage, TextRun } from '../textLayout.ts';
import { WORD_JOIN_RATIO } from '../textLayout.ts';
import type { RulesSection } from '../types.ts';
import { slugify } from '../slugify.ts';
import { ParseError, normalizeText } from './util.ts';

/** Folio ranges that make up the rules stream, in book order. */
const RANGES: ReadonlyArray<readonly [number, number]> = [
  [3, 3],
  [4, 6],
  // Two pages out of the class chapter that are rules and not stat blocks.
  // Folio 12 opens the Beastform list with the paragraphs that say how a form
  // is *used* - the Proficiency sentence among them - and folio 18 is the whole
  // Ranger Companion sheet. Both were unreachable prose until this range
  // existed, and `engine/companion.ts` carried a copy of folio 18 because of
  // it. Folio 19 is deliberately NOT here: it is the Rogue, and the companion
  // text ends with folio 18's second column.
  [12, 12],
  [18, 18],
  [35, 43],
  [62, 74],
  [102, 102],
  [112, 118],
];

/**
 * A section, keyed by the heading text that opens it - exactly as the book
 * sets it. `drop` marks front matter and the stat-block index, which the
 * dataset already models elsewhere.
 */
type Spec =
  | { start: string; id: string; title: string; drop?: undefined }
  | { start: string; drop: true };

/**
 * Every heading that opens a section, in the order the stream produces them.
 * Matching is sequential, so two sections may share a heading text.
 */
const SPECS: readonly Spec[] = [
  { id: 'introduction', title: 'Introduction', start: 'INTRODUCTION' },
  { id: 'the-basics', title: 'The Basics', start: 'THE BASICS' },
  { id: 'the-golden-rule', title: 'The Golden Rule', start: 'THE GOLDEN RULE' },
  { id: 'rulings-over-rules', title: 'Rulings Over Rules', start: 'RULINGS OVER RULES' },

  { id: 'character-creation', title: 'Character Creation', start: 'CHARACTER CREATION' },

  // Folio 12. The preamble only; `TIER 1` opens the stat cards, which are
  // `parseBeastforms`'s and would otherwise flow into this section.
  { id: 'beastform-options', title: 'Beastform Options', start: 'BEASTFORM OPTIONS' },
  { start: 'TIER 1', drop: true },

  // Folio 18, in the order the page is read: the sheet down column one, then
  // the two boxes down column two.
  { id: 'ranger-companion', title: 'Ranger Companion', start: 'RANGER COMPANION' },
  {
    id: 'working-with-your-companion',
    title: 'Working with Your Companion',
    start: 'WORKING WITH YOUR COMPANION',
  },
  {
    id: 'companion-taking-damage',
    title: 'Companion: Taking Damage as Stress',
    start: 'TAKING DAMAGE AS STRESS',
  },
  {
    id: 'leveling-up-your-companion',
    title: 'Leveling Up Your Companion',
    start: 'LEVELING UP YOUR COMPANION',
  },

  { start: 'CORE MECHANICS', drop: true },
  { id: 'flow-of-the-game', title: 'Flow of the Game', start: 'FLOW OF THE GAME' },
  {
    id: 'player-principles-and-best-practices',
    title: 'Player Principles & Best Practices',
    start: 'PLAYER PRINCIPLES & BEST PRACTICES',
  },
  { id: 'core-gameplay-loop', title: 'Core Gameplay Loop', start: 'Core Gameplay Loop' },
  { id: 'the-spotlight', title: 'The Spotlight', start: 'The Spotlight' },
  {
    id: 'turn-order-and-action-economy',
    title: 'Turn Order & Action Economy',
    start: 'Turn Order & Action Economy',
  },
  {
    id: 'making-moves-and-taking-action',
    title: 'Making Moves & Taking Action',
    start: 'MAKING MOVES & TAKING ACTION',
  },
  {
    id: 'gm-moves-and-adversary-actions',
    title: 'GM Moves and Adversary Actions',
    start: 'GM MOVES AND ADVERSARY ACTIONS',
  },
  { id: 'adversary-actions', title: 'Adversary Actions', start: 'ADVERSARY ACTIONS' },
  { id: 'special-rolls', title: 'Special Rolls', start: 'SPECIAL ROLLS' },
  { id: 'group-action-rolls', title: 'Group Action Rolls', start: 'GROUP ACTION ROLLS' },
  { id: 'tag-team-rolls', title: 'Tag Team Rolls', start: 'TAG TEAM ROLLS' },
  {
    id: 'advantage-and-disadvantage',
    title: 'Advantage & Disadvantage',
    start: 'ADVANTAGE & DISADVANTAGE',
  },
  { id: 'hope-and-fear', title: 'Hope & Fear', start: 'HOPE & FEAR' },
  { id: 'combat', title: 'Combat', start: 'COMBAT' },
  { id: 'stress', title: 'Stress', start: 'STRESS' },
  { id: 'attacking', title: 'Attacking', start: 'ATTACKING' },
  {
    id: 'maps-range-and-movement',
    title: 'Maps, Range, and Movement',
    start: 'MAPS, RANGE, AND MOVEMENT',
  },
  { id: 'conditions', title: 'Conditions', start: 'CONDITIONS' },
  { id: 'downtime', title: 'Downtime', start: 'DOWNTIME' },
  { id: 'death', title: 'Death', start: 'DEATH' },
  { id: 'additional-rules', title: 'Additional Rules', start: 'ADDITIONAL RULES' },
  { id: 'leveling-up', title: 'Leveling Up', start: 'LEVELING UP' },
  { id: 'multiclassing', title: 'Multiclassing', start: 'MULTICLASSING' },

  { id: 'gold', title: 'Gold', start: 'GOLD' },

  { start: 'RUNNING AN ADVENTURE', drop: true },
  { id: 'running-an-adventure', title: 'Running an Adventure', start: 'INTRODUCTION' },
  { id: 'gm-guidance', title: 'GM Guidance', start: 'GM GUIDANCE' },
  { id: 'gm-principles', title: 'GM Principles', start: 'GM PRINCIPLES' },
  { id: 'gm-practices', title: 'GM Practices', start: 'GM PRACTICES' },
  { id: 'pitfalls-to-avoid', title: 'Pitfalls to Avoid', start: 'PITFALLS TO AVOID' },
  { id: 'core-gm-mechanics', title: 'Core GM Mechanics', start: 'CORE GM MECHANICS' },
  {
    id: 'guidance-on-action-rolls',
    title: 'Guidance on Action Rolls',
    start: 'GUIDANCE ON ACTION ROLLS',
  },
  { id: 'making-gm-moves', title: 'Making GM Moves', start: 'MAKING MOVES' },
  { id: 'using-fear', title: 'Using Fear', start: 'USING FEAR' },
  { id: 'difficulty-benchmarks', title: 'Difficulty Benchmarks', start: 'DIFFICULTY BENCHMARKS' },
  {
    id: 'giving-advantage-and-disadvantage',
    title: 'Giving Advantage and Disadvantage',
    start: 'GIVING ADVANTAGE AND DISADVANTAGE',
  },
  { id: 'adversary-action-rolls', title: 'Adversary Action Rolls', start: 'ADVERSARY ACTION ROLLS' },
  { id: 'countdowns', title: 'Countdowns', start: 'COUNTDOWNS' },
  {
    id: 'giving-out-gold-equipment-and-loot',
    title: 'Giving Out Gold, Equipment, and Loot',
    start: 'GIVING OUT GOLD, EQUIPMENT, AND LOOT',
  },
  { id: 'running-gm-npcs', title: 'Running GM NPCs', start: 'RUNNING GM NPCS' },
  { id: 'npc-feature-examples', title: 'NPC Feature Examples', start: 'NPC FEATURE EXAMPLES' },
  { id: 'optional-gm-mechanics', title: 'Optional GM Mechanics', start: 'OPTIONAL GM MECHANICS' },
  { start: 'ADVERSARIES AND ENVIRONMENTS', drop: true },
  { id: 'using-adversaries', title: 'Using Adversaries', start: 'USING ADVERSARIES' },
  {
    id: 'example-adversary-features',
    title: 'Example Adversary Features',
    start: 'EXAMPLE ADVERSARY FEATURES:',
  },
  {
    id: 'building-balanced-encounters',
    title: 'Building Balanced Encounters',
    start: 'BUILDING BALANCED ENCOUNTERS',
  },
  {
    id: 'adversary-stat-block-benchmarks',
    title: 'Adversary Stat Block Benchmarks',
    start: 'ADVERSARY STAT BLOCK BENCHMARKS',
  },
  { start: 'ADVERSARIES BY TIER', drop: true },

  { id: 'using-environments', title: 'Using Environments', start: 'USING ENVIRONMENTS' },
  { id: 'adapting-environments', title: 'Adapting Environments', start: 'ADAPTING ENVIRONMENTS' },

  {
    id: 'additional-gm-guidance',
    title: 'Additional GM Guidance',
    start: 'ADDITIONAL GM GUIDANCE',
  },
  { id: 'story-beats', title: 'Story Beats', start: 'STORY BEATS' },
  {
    id: 'preparing-combat-encounters',
    title: 'Preparing Combat Encounters',
    start: 'PREPARING COMBAT ENCOUNTERS',
  },
  { id: 'battles-and-narrative', title: 'Battles and Narrative', start: 'BATTLES AND NARRATIVE' },
  { id: 'session-rewards', title: 'Session Rewards', start: 'SESSION REWARDS' },
  { id: 'crafting-scenes', title: 'Crafting Scenes', start: 'CRAFTING SCENES' },
  { id: 'engaging-your-players', title: 'Engaging Your Players', start: 'ENGAGING YOUR PLAYERS' },
  { id: 'phased-battles', title: 'Phased Battles', start: 'PHASED BATTLES' },
  { id: 'using-downtime', title: 'Using Downtime', start: 'USING DOWNTIME' },

  {
    id: 'projects-during-downtime',
    title: 'Projects During Downtime',
    start: 'PROJECTS DURING DOWNTIME',
  },
  { id: 'extended-downtime', title: 'Extended Downtime', start: 'EXTENDED DOWNTIME' },
  { id: 'campaign-frames', title: 'Campaign Frames', start: 'CAMPAIGN FRAMES' },

  { id: 'witherwild', title: 'The Witherwild', start: 'The Witherwild' },
  { id: 'witherwild-overview', title: 'The Witherwild: Overview', start: 'OVERVIEW' },
  { id: 'witherwild-communities', title: 'The Witherwild: Communities', start: 'COMMUNITIES' },
  { id: 'witherwild-ancestries', title: 'The Witherwild: Ancestries', start: 'ANCESTRIES' },
  { id: 'witherwild-classes', title: 'The Witherwild: Classes', start: 'CLASSES' },
  {
    id: 'witherwild-player-principles',
    title: 'The Witherwild: Player Principles',
    start: 'PLAYER PRINCIPLES',
  },
  { id: 'witherwild-gm-principles', title: 'The Witherwild: GM Principles', start: 'GM PRINCIPLES' },
  { id: 'witherwild-distinctions', title: 'The Witherwild: Distinctions', start: 'DISTINCTIONS' },
  {
    id: 'witherwild-inciting-incident',
    title: 'The Witherwild: The Inciting Incident',
    start: 'THE INCITING INCIDENT',
  },
  {
    id: 'witherwild-campaign-mechanics',
    title: 'The Witherwild: Campaign Mechanics',
    start: 'CAMPAIGN MECHANICS',
  },
  {
    id: 'witherwild-session-zero',
    title: 'The Witherwild: Session Zero Questions',
    start: 'SESSION ZERO QUESTIONS',
  },
];

interface TableSpec {
  folio: number;
  /** Box whose runs belong to the table and never to the prose stream. */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /**
   * Left edge of the cells, when the box has to reach further left to catch
   * something that is not one: the trait benchmarks set their trait name
   * sideways, and a rotated word's box is tall enough to swallow a whole row.
   */
  cellX0?: number;
  cols: number;
  /** Rows the grid must yield, header rows included. */
  rows: number;
  /** Column whose presence in a band opens a new row; other bands wrap it. */
  anchor: number;
  /** Cells of the first row, to pin the box to the table it is meant for. */
  verify?: readonly string[];
  /** Leading rows that are the book's own header, and are replaced by it. */
  headerRows?: number;
  header?: readonly string[];
  /** `## ` line emitted above the table. */
  heading?: string;
  /** A list flowed into columns, not a table: read column by column. */
  list?: true;
}

/**
 * One trait's difficulty benchmarks: a roll column and three action columns,
 * under a trait name the book sets sideways down the left edge.
 */
function trait(
  folio: number,
  heading: string,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cellX0: number,
  head: readonly string[],
): TableSpec {
  return {
    folio,
    x0,
    x1,
    y0,
    y1,
    cellX0,
    cols: 4,
    rows: 7,
    anchor: 0,
    verify: head,
    headerRows: 1,
    header: ['Roll', ...head.slice(1).map((h) => h[0]!.toUpperCase() + h.slice(1))],
    heading,
  };
}

/**
 * The tables, by geometry. Column boundaries are found from the whitespace
 * inside each box, so only the box and the shape have to be stated here.
 */
const TABLES: readonly TableSpec[] = [
  {
    folio: 66,
    x0: 50,
    x1: 300,
    y0: 92,
    y1: 400,
    cols: 3,
    rows: 5,
    anchor: 0,
    header: ['Scene', 'Examples', 'Fear to Spend'],
  },
  trait(66, 'Agility', 55, 575, 505, 700, 85, ['roll', 'sprint', 'leap', 'Maneuver']),
  trait(67, 'Strength', 675, 1185, 50, 205, 712, ['roll', 'lift', 'smash', 'grapple']),
  trait(67, 'Finesse', 675, 1185, 205, 400, 712, ['roll', 'control', 'hide', 'tinker']),
  trait(67, 'Instinct', 675, 1185, 405, 600, 712, ['roll', 'perceive', 'sense', 'navigate']),
  trait(68, 'Presence', 55, 575, 50, 250, 85, ['roll', 'charm', 'perform', 'deceive']),
  trait(68, 'Knowledge', 55, 575, 250, 450, 85, ['roll', 'recall', 'analyze', 'comprehend']),
  {
    folio: 69,
    x0: 680,
    x1: 915,
    y0: 308,
    y1: 425,
    cols: 3,
    rows: 7,
    anchor: 2,
    verify: ['Roll Result', 'Progress', 'Consequence'],
    headerRows: 2,
    header: ['Roll Result', 'Progress Advancement', 'Consequence Advancement'],
  },
  {
    folio: 69,
    x0: 925,
    x1: 1170,
    y0: 118,
    y1: 315,
    cols: 2,
    rows: 12,
    anchor: 1,
    header: ['Expense', 'Cost'],
  },
  { folio: 71, x0: 925, x1: 1170, y0: 285, y1: 392, cols: 3, rows: 6, anchor: 0, list: true },
  {
    folio: 73,
    x0: 675,
    x1: 1185,
    y0: 75,
    y1: 180,
    cols: 5,
    rows: 5,
    anchor: 0,
    verify: ['Adversary Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    headerRows: 1,
    header: ['Adversary Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
  },
  {
    folio: 112,
    x0: 300,
    x1: 590,
    y0: 222,
    y1: 495,
    cols: 2,
    rows: 13,
    anchor: 0,
    verify: ['1d12', 'Objective'],
    headerRows: 1,
    header: ['1d12', 'Objective'],
  },
  {
    folio: 102,
    x0: 55,
    x1: 560,
    y0: 545,
    y1: 600,
    cols: 5,
    rows: 3,
    anchor: 0,
    verify: ['Environment Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    headerRows: 1,
    header: ['Environment Statistic', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
  },
];

/**
 * Pages that stack two independent multi-column regions. Everywhere else a
 * page is one region and reads left column then right column; on these the
 * lower region would otherwise be pulled up into the left column's stream.
 */
const REGION_SPLITS: Record<number, readonly number[]> = {
  66: [400, 500],
  102: [400, 520],
};

/** Points of whitespace that separate two cells of a table. */
const MIN_CELL_GUTTER = 6;
/**
 * Whitespace across the gutter, in points, below which a band is one line and
 * not two. The two populations do not overlap anywhere in these folios: a
 * full-width line leaves at most 9pt there, a genuine gutter at least 12.
 */
const MIN_COLUMN_GUTTER = 11;
/**
 * Leading, as a multiple of point size, above which a paragraph ends. The
 * book sets its 9.3pt body far tighter than its 12pt standfirsts, so one
 * ratio cannot serve both.
 */
const paragraphGap = (size: number): number => size * (size >= 11 ? 1.5 : 1.34);
/** Leading, as a multiple of point size, below which two headings are one. */
const HEADING_GAP = 1.7;
/** The book labels a step on its own line and names it on the next one. */
const STEP_LABEL = /^STEP\b/i;
/** Bullet glyphs the book uses, plus the arrow of the tier list on folio 42. */
const BULLET = /^\s*[•‣▪●→]\s*/;
/**
 * The SRD is set with hyphenation off, so a line-final hyphen, slash or dash
 * is part of the word: "two-" + "handed", "(she/" + "her)".
 */
const NO_SPACE = /[-‐-―/]$/;

interface Unit {
  folio: number;
  /** Page column, 0 or 1. A spanning band is 0. */
  column: number;
  x: number;
  y: number;
  size: number;
  /** Eveleth: a section title or a banner, at any size. */
  display: boolean;
  /** Set across the gutter, so it belongs to no column. */
  spans: boolean;
  /** Every word set bold: a banner, or the book's "Notes:" label. */
  bold: boolean;
  heading: boolean;
  text: string;
  /** Rendered markdown, for a table unit. */
  table?: string;
}

export function parseRules(pages: BookPage[]): RulesSection[] {
  const stream: Unit[] = [];
  for (const [from, to] of RANGES) {
    const inRange = pages
      .filter((p) => p.folio !== null && p.folio >= from && p.folio <= to)
      .sort((a, b) => a.index - b.index);
    for (const page of inRange) stream.push(...pageUnits(page));
  }
  if (stream.length === 0) throw new ParseError('no rules pages found', RANGES.join(' '));

  const out: RulesSection[] = [];
  let spec = 0;
  let current: Spec | null = null;
  let units: Unit[] = [];

  const close = (): void => {
    if (current !== null && current.drop !== true) out.push(section(current, units));
    units = [];
  };

  for (const unit of stream) {
    const next = SPECS[spec];
    if (next && unit.heading && unit.text === next.start) {
      close();
      current = next;
      spec += 1;
      continue;
    }
    if (!current) throw new ParseError('rules text before the first section', unit.text);
    units.push(unit);
  }
  close();

  if (spec !== SPECS.length) {
    throw new ParseError('section heading never found', SPECS[spec]!.start);
  }

  const seen = new Set<string>();
  for (const s of out) {
    if (seen.has(s.id)) throw new ParseError('duplicate rules section id', s.id);
    seen.add(s.id);
  }
  return out;
}

function section(spec: Spec & { id: string; title: string }, units: Unit[]): RulesSection {
  const id = slugify(spec.id);
  if (id !== spec.id) throw new ParseError('rules section id is not a slug', spec.id);
  const body = render(units);
  const folio = units[0]?.folio;
  if (body.length === 0 || folio === undefined) {
    throw new ParseError('rules section has no body', spec.title);
  }
  return { id, title: spec.title, body, sourcePage: folio };
}

// ---------------------------------------------------------------------------
// Page -> ordered units
// ---------------------------------------------------------------------------

/** x of the gutter between the two text columns of a book page. */
function gutterX(page: BookPage): number {
  if (page.side === 'right') return 920;
  if (page.side === 'left') return 294;
  return page.width / 2;
}

function pageUnits(page: BookPage): Unit[] {
  const folio = page.folio!;
  const boxes = TABLES.filter((t) => t.folio === folio);
  const inBox = (r: TextRun): boolean =>
    boxes.some((b) => r.x >= b.x0 && r.x <= b.x1 && r.y >= b.y0 && r.y <= b.y1);

  // 8pt is the book's table face; every 8pt grid on these folios is either
  // parsed as a table below or belongs to another parser's dataset.
  const runs = page.runs.filter((r) => r.size >= 9 && !inBox(r));
  const cut = gutterX(page);
  const splits = REGION_SPLITS[folio] ?? [];

  const tables: Unit[] = boxes.map((b) => ({
    folio,
    column: b.x0 >= cut ? 1 : 0,
    x: b.x0,
    y: b.y0,
    size: 0,
    display: false,
    spans: false,
    bold: false,
    heading: false,
    text: '',
    table: table(page, b),
  }));

  const ordered: Unit[] = [];
  const bounds = [-Infinity, ...splits, Infinity];
  for (let i = 0; i + 1 < bounds.length; i++) {
    const lo = bounds[i]!;
    const hi = bounds[i + 1]!;
    const region = runs.filter((r) => r.y >= lo && r.y < hi);
    const here = tables.filter((t) => t.y >= lo && t.y < hi);
    ordered.push(...orderRegion(bands(region), here, cut, folio));
  }
  return mergeHeadings(indentX(markHeadings(ordered)));
}

/** Group runs into visual lines by their mid-height, as `textLayout` does. */
function bands(runs: TextRun[]): TextRun[][] {
  if (runs.length === 0) return [];
  const tol = Math.max(2, median(runs.map((r) => r.h)) * 0.6);
  const sorted = [...runs].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const out: TextRun[][] = [];
  let group: TextRun[] = [];
  let anchor = Number.NaN;
  for (const r of sorted) {
    const mid = r.y + r.h / 2;
    if (group.length === 0 || Math.abs(mid - anchor) <= tol) {
      if (group.length === 0) anchor = mid;
      group.push(r);
    } else {
      out.push(group);
      group = [r];
      anchor = mid;
    }
  }
  if (group.length > 0) out.push(group);
  return out.sort((a, b) => Math.min(...a.map((r) => r.y)) - Math.min(...b.map((r) => r.y)));
}

/**
 * Left column, then right column - except that a band whose words run
 * uninterrupted across the gutter is genuinely full width and acts as a
 * barrier, flushing what came before it.
 */
function orderRegion(
  regionBands: TextRun[][],
  tables: Unit[],
  cut: number,
  folio: number,
): Unit[] {
  const out: Unit[] = [];
  const cols: Unit[][] = [[], []];
  const flush = (): void => {
    out.push(...cols[0]!.splice(0), ...cols[1]!.splice(0));
  };

  const items: Array<{ y: number; unit?: Unit; band?: TextRun[] }> = [
    ...regionBands.map((band) => ({ y: Math.min(...band.map((r) => r.y)), band })),
    ...tables.map((unit) => ({ y: unit.y, unit })),
  ].sort((a, b) => a.y - b.y);

  for (const item of items) {
    if (item.unit) {
      cols[item.unit.column]!.push(item.unit);
      continue;
    }
    const band = item.band!;
    const left = band.filter((r) => r.x + r.w / 2 < cut);
    const right = band.filter((r) => r.x + r.w / 2 >= cut);
    const spans =
      left.length > 0 &&
      right.length > 0 &&
      Math.min(...right.map((r) => r.x)) - Math.max(...left.map((r) => r.x + r.w)) <
        MIN_COLUMN_GUTTER;
    if (spans) {
      flush();
      out.push({ ...lineUnit(band, folio, 0), spans: true });
      continue;
    }
    if (left.length > 0) cols[0]!.push(lineUnit(left, folio, 0));
    if (right.length > 0) cols[1]!.push(lineUnit(right, folio, 1));
  }
  flush();
  return out;
}

function lineUnit(runs: TextRun[], folio: number, column: number): Unit {
  const ordered = [...runs].sort((a, b) => a.x - b.x);
  let text = '';
  let prevEnd = Number.NaN;
  for (const r of ordered) {
    if (text.length > 0) {
      text += (r.x - prevEnd) / Math.max(r.h, 1) < WORD_JOIN_RATIO ? '' : ' ';
    }
    text += r.text;
    prevEnd = r.x + r.w;
  }
  const byFamily = new Map<string, number>();
  for (const r of ordered) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + r.text.length);
  const family = [...byFamily].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return {
    folio,
    column,
    x: Math.min(...ordered.map((r) => r.x)),
    y: Math.min(...ordered.map((r) => r.y)),
    size: Math.max(...ordered.map((r) => r.size)),
    display: family.startsWith('Eveleth'),
    spans: false,
    bold: ordered.every((r) => r.bold),
    heading: false,
    text: normalizeText(text),
  };
}

/**
 * A heading is display type at any size, or bold at 10pt and up. The book
 * also sets a few 9.3pt bold labels ("Optional Rule: Massive Damage", each
 * character-creation step, "Notes:"); those only count when extra leading
 * sets them off, because the same face turns up mid-paragraph on folio 113.
 */
function markHeadings(units: Unit[]): Unit[] {
  let prev: Unit | null = null;
  for (const u of units) {
    if (u.table) {
      prev = null;
      continue;
    }
    const bold = u.bold && !BULLET.test(u.text);
    const apart =
      prev === null || prev.column !== u.column || u.y - prev.y > paragraphGap(u.size);
    u.heading = u.display || (bold && (u.size > 9.9 || apart));
    prev = u;
  }
  return units;
}

/**
 * Restate x as an indent from the column's own left edge, so the renderer can
 * tell an indented block from body text. Headings and full-width lines set
 * their own margins and never define the edge.
 */
function indentX(units: Unit[]): Unit[] {
  const edge = new Map<number, number>();
  for (const u of units) {
    if (u.heading || u.spans || u.table !== undefined) continue;
    edge.set(u.column, Math.min(edge.get(u.column) ?? Infinity, u.x));
  }
  for (const u of units) u.x -= edge.get(u.column) ?? u.x;
  return units;
}

/** Two-line headings: the book breaks long ones, and labels its steps. */
function mergeHeadings(units: Unit[]): Unit[] {
  const out: Unit[] = [];
  for (const u of units) {
    const prev = out[out.length - 1];
    const joinable =
      prev !== undefined &&
      prev.heading &&
      u.heading &&
      prev.column === u.column &&
      prev.folio === u.folio &&
      u.y - prev.y < prev.size * HEADING_GAP &&
      (Math.abs(prev.size - u.size) < 0.5 || STEP_LABEL.test(prev.text));
    if (joinable) {
      prev.text = `${prev.text} ${u.text}`;
      continue;
    }
    out.push(u);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Units -> markdown
// ---------------------------------------------------------------------------

interface Para {
  lines: Unit[];
  indented: boolean;
  /** Opened with a bullet glyph, rather than by indentation alone. */
  glyph: boolean;
  bullet: boolean;
}

const ENDS_SENTENCE = /[.!?:;)"'’”]$/;

function render(units: Unit[]): string {
  const blocks: Array<{ text: string } | { para: Para }> = [];
  let para: Para | null = null;

  for (const u of units) {
    if (u.table !== undefined) {
      para = null;
      blocks.push({ text: u.table });
      continue;
    }
    if (u.heading) {
      para = null;
      blocks.push({ text: `## ${u.text}` });
      continue;
    }
    const prev = para?.lines[para.lines.length - 1];
    const bullet = BULLET.test(u.text);
    const broken =
      prev === undefined ||
      bullet ||
      (prev.column === u.column && prev.folio === u.folio
        ? u.y - prev.y > paragraphGap(u.size)
        : // Prose runs on into the next column when it was cut mid-sentence
          // and picks up at the same indent. A list item never does.
          para!.glyph || ENDS_SENTENCE.test(prev.text) || Math.abs(prev.x - u.x) > 3);
    if (broken) {
      para = { lines: [], indented: u.x > 3, glyph: bullet, bullet };
      blocks.push({ para });
    }
    para!.lines.push(u);
  }

  // An indented paragraph is a list item only where the book stacks several
  // of them; a lone one is a note or an example.
  const paras = blocks.flatMap((b) => ('para' in b ? [b.para] : [null]));
  const listy = (p: Para | null | undefined): boolean => p?.indented === true && !p.glyph;
  for (let i = 0; i < paras.length; i++) {
    const p = paras[i];
    if (listy(p) && (listy(paras[i - 1]) || listy(paras[i + 1]))) p!.bullet = true;
  }

  const rendered = blocks
    .map((b) => ({
      bullet: 'para' in b && b.para.bullet,
      text: 'text' in b ? b.text : paragraph(b.para),
    }))
    .filter((b) => b.text.length > 0);

  let body = '';
  for (const [i, b] of rendered.entries()) {
    if (i > 0) body += b.bullet && rendered[i - 1]!.bullet ? '\n' : '\n\n';
    body += b.text;
  }
  return body;
}

function paragraph(para: Para): string {
  let text = '';
  for (const line of para.lines) {
    if (text.length > 0 && !NO_SPACE.test(text)) text += ' ';
    text += line.text;
  }
  text = text.replace(/\s+/g, ' ').trim();
  return para.bullet ? `- ${text.replace(BULLET, '')}` : text;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

function table(page: BookPage, spec: TableSpec): string {
  const runs = page.runs.filter(
    (r) =>
      r.x >= (spec.cellX0 ?? spec.x0) && r.x <= spec.x1 && r.y >= spec.y0 && r.y <= spec.y1,
  );
  if (runs.length === 0) throw new ParseError('table box is empty', `folio ${spec.folio}`);

  const cuts = cellCuts(runs);
  if (cuts.length + 1 !== spec.cols) {
    throw new ParseError(
      `folio ${spec.folio} table: expected ${spec.cols} columns, found ${cuts.length + 1}`,
      cuts.map((c) => c.toFixed(0)).join(', '),
    );
  }

  const rows: string[][] = [];
  for (const band of bands(runs)) {
    const cells: TextRun[][] = Array.from({ length: spec.cols }, () => []);
    for (const r of band) {
      let i = 0;
      while (i < cuts.length && r.x + r.w / 2 >= cuts[i]!) i++;
      cells[i]!.push(r);
    }
    const text = cells.map((cell) => (cell.length === 0 ? '' : lineUnit(cell, 0, 0).text));
    const last = rows[rows.length - 1];
    if (text[spec.anchor]!.length > 0 || last === undefined) rows.push(text);
    else last.forEach((cell, i) => (last[i] = join(cell, text[i]!)));
  }
  if (rows.length !== spec.rows) {
    throw new ParseError(
      `folio ${spec.folio} table: expected ${spec.rows} rows, found ${rows.length}`,
      rows.map((r) => r[spec.anchor]).join(' / '),
    );
  }
  if (spec.verify && rows[0]!.join('|').toLowerCase() !== spec.verify.join('|').toLowerCase()) {
    throw new ParseError(`folio ${spec.folio} table: unexpected header`, rows[0]!.join(' | '));
  }

  const body = rows.slice(spec.headerRows ?? 0);
  const heading = spec.heading === undefined ? '' : `## ${spec.heading}\n\n`;

  if (spec.list) {
    const items: string[] = [];
    for (let c = 0; c < spec.cols; c++) {
      for (const row of body) if (row[c]!.length > 0) items.push(`- ${row[c]!}`);
    }
    return heading + items.join('\n');
  }

  const header = spec.header!;
  return (
    heading +
    [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...body.map((row) => `| ${row.join(' | ')} |`),
    ].join('\n')
  );
}

/** Join a wrapped cell's lines, with the same hyphen rule the prose uses. */
const join = (a: string, b: string): string =>
  a.length === 0 ? b : b.length === 0 ? a : NO_SPACE.test(a) ? `${a}${b}` : `${a} ${b}`;

/** Cell boundaries, from the whitespace columns inside the table's box. */
function cellCuts(runs: TextRun[]): number[] {
  const x0 = Math.floor(Math.min(...runs.map((r) => r.x)));
  const x1 = Math.ceil(Math.max(...runs.map((r) => r.x + r.w)));
  const filled = new Uint8Array(x1 - x0 + 1);
  for (const r of runs) {
    filled.fill(1, Math.max(0, Math.floor(r.x - x0)), Math.min(filled.length, Math.ceil(r.x + r.w - x0) + 1));
  }
  const cuts: number[] = [];
  let gap = 0;
  for (let i = 0; i < filled.length; i++) {
    if (filled[i]) {
      if (gap >= MIN_CELL_GUTTER) cuts.push(x0 + i - gap / 2);
      gap = 0;
    } else gap++;
  }
  return cuts;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length === 0 ? 0 : s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
