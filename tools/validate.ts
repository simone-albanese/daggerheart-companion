/**
 * The gate.
 *
 * A parser that quietly drops a card, mangles a number or leaves a decorative
 * glyph behind produces a dataset that *looks* fine and is wrong at a table,
 * mid-session, on someone else's phone. So the build refuses to emit anything
 * that fails these checks, and CI refuses to merge it.
 *
 * Counts come from the SRD itself, not from folklore: they are asserted, and
 * when the source changes the build stops rather than shipping a guess.
 */
import type { Dataset, DomainId, RulesSection } from '../shared/types.ts';
import { ADVERSARY_ROLES, DOMAINS, RANGES, TRAITS } from '../shared/types.ts';
import { hasPua } from './glyphs.ts';

export interface Issue {
  severity: 'error' | 'warning';
  where: string;
  message: string;
}

// ---------------------------------------------------------------------------
// How much a dataset must contain
// ---------------------------------------------------------------------------

/**
 * Nine numbers used to live here as one `EXPECTED` block - `domains: 9`,
 * `classes: 9`, `ancestries: 18` - and every one of them was an SRD 1.0 fact
 * asserted as a fatal error. A second printing was therefore rejected on
 * arrival with nine failures even when every parser had read it perfectly.
 *
 * The fix is NOT to loosen the gate. A range wide enough to admit both books
 * admits a parser that dropped four ancestries; a `revision === ...` skip is a
 * gate that stops guarding exactly when a new book makes it matter most. Two
 * honest shapes exist, and this file uses both:
 *
 *   (a) THE BOOK STATES IT. Character Creation prints its own rosters, in
 *       prose, in both printings:
 *
 *         SRD 1.0 f4  "There are nine classes in this SRD: Bard, Druid, ...
 *                      Wizard."
 *         SRD 2.0 f4  "There are 13 classes in this SRD: Assassin, Bard, ...
 *                      Witch, and Wizard."
 *         both    f4  "Take the card for one of the following ancestries, then
 *                      write its name in the Heritage field of your character
 *                      sheet: Clank, Drakona, ... Simiah."
 *         both    f4  "... one of the following communities ...: Highborne,
 *                      ... Wildborne."
 *         both    f4  "Each class comprises two subclasses."
 *         SRD 1.0 f6  "two of the nine Domains included in the core set"
 *         SRD 2.0 f6  "two of the ten domains"
 *
 *       Those sentences are already in the dataset, as `rules`, parsed out of
 *       a DIFFERENT chapter from the collections they describe - Character
 *       Creation is folio 4, the ancestries themselves are folio 27 (SRD 1) and
 *       32 (SRD 2). So this is not the dataset agreeing with itself: it is two
 *       independent readings of two separate parts of the book being made to
 *       agree, which is the strongest check available here and the only one
 *       that will still be right for SRD 3 without anybody editing this file.
 *
 *       Measured, this session, on both PDFs: each of those five sentences
 *       occurs EXACTLY ONCE in each book, so a reader that requires one
 *       unambiguous match is not being optimistic.
 *
 *   (b) PARAMETERISED PER REVISION, in `REVISION_COUNTS` below, for the counts
 *       no printing states in words. An unknown revision is a hard error and a
 *       count left `null` is a hard error - a hole in the gate is not a pass.
 *
 * `domainCards` and `subclasses` are then arithmetic on top of (a) and need no
 * number of their own: 21 cards times however many domains THIS BOOK prints,
 * two subclasses times however many classes it prints.
 */

/** Number words the SRD spells out. SRD 2.0 also prints numerals ("13 classes"). */
const NUMBER_WORDS = new Map<string, number>([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
]);

/**
 * The count a printing states, however it states it.
 *
 * Both forms are real and they are in the same sentence in the two books: SRD
 * 1.0 sets "There are nine classes in this SRD", SRD 2.0 sets "There are 13
 * classes in this SRD". Reading only one of them would have made the mechanism
 * work on exactly the book it was written against, which is the defect this
 * whole file is repairing.
 */
function numberFrom(word: string): number | null {
  const w = word.trim().toLowerCase();
  if (/^\d{1,3}$/.test(w)) return Number(w);
  return NUMBER_WORDS.get(w) ?? null;
}

/**
 * Fold what typography does to a name, so two printings of it compare equal.
 *
 * The characters that break a name comparison in these books are invisible:
 * SRD 2.0 carries U+00AD soft hyphens and U+200B zero-width spaces left behind
 * where a word was allowed to break, and they survive extraction. The visible
 * suspects mostly do not matter - SRD 2.0 has 1993 ASCII hyphens against 12
 * U+2011 - but folding them costs nothing and a name is not case-significant.
 */
const nameKey = (s: string): string =>
  s
    .normalize('NFKC')
    .replace(/[­​]/g, '')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * A printed roster, split into names.
 *
 * "Bard, Druid, ... Wizard" in SRD 1.0 and "Assassin, Bard, ... Witch, and
 * Wizard" in SRD 2.0: the serial comma is present in both, and the second book
 * additionally sets an `and` on the last item. So the separator is the comma
 * and the `and` is a prefix to strip, not a separator of its own. A printing
 * that dropped the serial comma would fuse its last two names into one and be
 * caught by the name comparison, loudly, which is the failure to prefer.
 */
const rosterNames = (list: string): string[] =>
  list
    .split(',')
    .map((n) => n.replace(/^\s*(?:and|&)\s+/i, '').trim())
    .filter((n) => n.length > 0);

/** What a printing says about its own contents, read out of its rules text. */
export interface BookClaims {
  /** From "two of the nine Domains" / "two of the ten domains". */
  domains: number | null;
  /** From "There are nine classes in this SRD: ..." - the count AND the roster. */
  classes: { count: number; names: string[] } | null;
  /** From "Each class comprises two subclasses." */
  subclassesPerClass: number | null;
  /** From "one of the following ancestries ...: Clank, ..." */
  ancestries: string[] | null;
  /** From "one of the following communities ...: Highborne, ..." */
  communities: string[] | null;
}

/**
 * Where each claim is printed, for an error message that can be acted on.
 *
 * A missing claim is a hard error, and the only useful thing such an error can
 * say is which sentence it looked for and where that sentence lives, so the
 * next person can open the book at that folio rather than reverse-engineer a
 * regular expression.
 */
const CLAIM_SITES: Record<keyof BookClaims, string> = {
  domains: '"...two of the nine|ten domains..." in Character Creation step 8 (folio 6 in both books)',
  classes: '"There are N classes in this SRD: ..." in Character Creation step 1 (folio 4 in both books)',
  subclassesPerClass: '"Each class comprises two subclasses." in Character Creation step 1 (folio 4 in both books)',
  ancestries: '"...one of the following ancestries...: ..." in Character Creation step 2 (folio 4 in both books)',
  communities: '"...one of the following communities...: ..." in Character Creation step 2 (folio 4 in both books)',
};

/**
 * Every match of one claim across the whole rules corpus.
 *
 * All of them, not the first: two sections that both state a count and state it
 * DIFFERENTLY is a real defect - a rules parser that split one chapter's prose
 * across two sections and mangled one copy would otherwise be invisible - and
 * measured on both books each of these sentences occurs exactly once, so
 * requiring agreement costs nothing today and refuses to guess tomorrow.
 */
function claimMatches(rules: readonly RulesSection[], re: RegExp): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = [];
  for (const rule of rules) {
    for (const m of rule.body.matchAll(re)) out.push(m);
  }
  return out;
}

function soleClaim(
  issues: Issue[],
  field: keyof BookClaims,
  rules: readonly RulesSection[],
  re: RegExp,
): RegExpMatchArray | null {
  const hits = claimMatches(rules, re);
  if (hits.length === 0) {
    issues.push({
      severity: 'error',
      where: `counts/${field}`,
      message:
        `this printing does not state it where the gate looks. Expected ${CLAIM_SITES[field]}. ` +
        `Read that page, then WIDEN the pattern in tools/validate.ts to cover both wordings - ` +
        `do not replace the reading with a constant, and do not drop the check.`,
    });
    return null;
  }
  const distinct = new Set(hits.map((h) => nameKey(h[0])));
  if (distinct.size > 1) {
    issues.push({
      severity: 'error',
      where: `counts/${field}`,
      message:
        `the book states it more than once and the statements disagree: ` +
        hits.map((h) => JSON.stringify(h[0].slice(0, 120))).join(' vs '),
    });
    return null;
  }
  return hits[0]!;
}

/**
 * Read a printing's claims about itself.
 *
 * Exported so a test can put a book's literal sentences in and check what comes
 * out, which is how the SRD 2.0 wordings are covered while its rules parser is
 * still being taught the new geometry.
 */
export function readBookClaims(
  rules: readonly RulesSection[],
  issues: Issue[] = [],
): BookClaims {
  const claims: BookClaims = {
    domains: null,
    classes: null,
    subclassesPerClass: null,
    ancestries: null,
    communities: null,
  };

  const domains = soleClaim(issues, 'domains', rules, /two of the (\S+) domains?\b/gi);
  if (domains !== null) {
    const n = numberFrom(domains[1] ?? '');
    if (n === null) {
      issues.push({
        severity: 'error',
        where: 'counts/domains',
        message: `the book says "${domains[0]}" and "${domains[1] ?? ''}" is not a number this reads`,
      });
    } else claims.domains = n;
  }

  const classes = soleClaim(
    issues,
    'classes',
    rules,
    /There (?:are|is) (\S+) classes in this SRD:\s*([^.]+)\./gi,
  );
  if (classes !== null) {
    const n = numberFrom(classes[1] ?? '');
    const names = rosterNames(classes[2] ?? '');
    if (n === null) {
      issues.push({
        severity: 'error',
        where: 'counts/classes',
        message: `the book says "${classes[1] ?? ''}" classes and that is not a number this reads`,
      });
    } else if (n !== names.length) {
      /*
       * The sentence states the count AND lists the names, so they check each
       * other - and they check this file's reading of them. A roster split that
       * fused two names, or a period inside the list that cut it short, shows
       * up here instead of silently lowering the bar the dataset has to clear.
       */
      issues.push({
        severity: 'error',
        where: 'counts/classes',
        message: `the book says ${n} classes and then lists ${names.length}: ${names.join(', ')}`,
      });
    } else claims.classes = { count: n, names };
  }

  const subs = soleClaim(
    issues,
    'subclassesPerClass',
    rules,
    /Each class comprises (\S+) subclasses/gi,
  );
  if (subs !== null) {
    const n = numberFrom(subs[1] ?? '');
    if (n === null) {
      issues.push({
        severity: 'error',
        where: 'counts/subclassesPerClass',
        message: `the book says "${subs[0]}" and "${subs[1] ?? ''}" is not a number this reads`,
      });
    } else claims.subclassesPerClass = n;
  }

  const anc = soleClaim(
    issues,
    'ancestries',
    rules,
    /one of the following ancestries[^:.]*:\s*([^.]+)\./gi,
  );
  if (anc !== null) claims.ancestries = rosterNames(anc[1] ?? '');

  const com = soleClaim(
    issues,
    'communities',
    rules,
    /one of the following communities[^:.]*:\s*([^.]+)\./gi,
  );
  if (com !== null) claims.communities = rosterNames(com[1] ?? '');

  return claims;
}

/**
 * The counts no printing states in words, per revision.
 *
 * Shape (b). Each key is a `Dataset.revision` exactly as `tools/loadSrd.ts`
 * mints it, and each number was measured on that book rather than carried
 * forward from the one before it.
 *
 * A revision that is not here is an ERROR, not a free pass, and a `null` is an
 * error too - "nobody has counted this yet" must fail the build rather than
 * pass it, or the first wrong number goes through on the day a parser lands.
 *
 * No field is null today. The sentence that stood here said `null` was "the
 * truth about SRD 2.0's transformations, environments and adversaries", and it
 * has been overtaken twice: environments (47) and adversaries (264) were
 * counted last wave and transformations (6) this one. It is corrected rather
 * than deleted because the rule it states is still the rule, and because a
 * docblock naming three holes that are all closed is how a gate stops being
 * read.
 */
export interface RevisionCounts {
  /**
   * Cards per domain. Not stated anywhere in either book, so it is counted.
   *
   * Measured twice this session, and the second time WITHOUT the card parser:
   * counting the printed `Level N <Domain> <Type>` lines in the appendix folios
   * gives 21 per domain in both books - 189 over 9 domains in SRD 1.0
   * (f119-135), 210 over 10 in SRD 2.0 (f206-224) - with the identical ladder
   * of three level-1 cards and two at each of levels 2 to 10, and exactly as
   * many `Recall Cost:` lines as level lines.
   */
  domainCardsPerDomain: number | null;
  /**
   * Beastforms.
   *
   * The sentence that stood here - "SRD 2.0 moves these into a
   * `Transformations` chapter of its own (f42)" - was wrong, and wrong in a way
   * worth leaving a scar on. SRD 2.0 reprints the Druid's beastform cards where
   * they were, inside `Classes`, word for word: folios 15-18 against SRD 1.0's
   * 12-15, the same 22 records, the same book typo ("rough terain"). Folios
   * 42-45 are a genuinely NEW chapter with six unrelated cards - DEMIGOD,
   * GHOST, REANIMATED, SHAPESHIFTER, VAMPIRE, WEREWOLF - that no parser reads
   * and no collection holds. Two different things with adjacent names.
   */
  beastforms: number | null;
  environments: number | null;
  /**
   * Transformation cards. Zero is a MEASUREMENT here, not a default.
   *
   * SRD 1.0 has no Transformations chapter: its contents page carries no such
   * entry and no page in it prints a `TRANSFORMATION FEATURES` banner, or any
   * heading matching /transformation/i at all. SRD 2.0 opens the chapter on
   * folio 42 and prints six cards over folios 43-45, two to a page, one per
   * column.
   *
   * Six was counted three ways before it was written down: the display banners
   * on folios 43-45 (DEMIGOD, GHOST, REANIMATED, SHAPESHIFTER, VAMPIRE,
   * WEREWOLF), the six pairs of `TRANSFORMATION FEATURES` /
   * `TRANSFORMATION QUESTIONS` banners those folios carry, and the parser.
   *
   * The zero earns its own gate rather than being skipped. `null` here would
   * mean "nobody has counted this", and on a book with no chapter that reads
   * exactly like the count that IS zero - so a parser that started returning
   * cards for SRD 1.0, or that stopped returning them for SRD 2.0, would have
   * nothing to fail against. Unlike `beastforms` or `environments` there is no
   * printed roster sentence to derive this from: folio 42 says "A PC can\'t
   * have more than one transformation" and never says how many there are.
   */
  transformations: number | null;
  /**
   * Adversaries as a range, because the chapter's own roster - not the contents
   * page - is the thing that actually pins the count, and it is checked where
   * it is readable: `shared/parsers/adversaries.ts` refuses a stat block that
   * is not rostered AND a rostered name with no stat block. This range is the
   * coarse second belt on a number that is not in the dataset to be derived.
   */
  adversariesMin: number | null;
  adversariesMax: number | null;
  /**
   * Records carrying `Sourced.module`: the equipment the optional-module
   * chapters print, which is in the `weapons` and `armors` collections beside
   * the base rules and marked with the chapter it came from.
   *
   * `0` is a real measurement here and not an unfilled hole, which is why these
   * two are not `number | null` like the four above. `shared/parsers/equipment.ts`
   * finds module equipment by looking for an equipment table header outside the
   * three main equipment ranges, and a book with no such chapter yields none:
   * a correct empty answer that no throw inside the parser can distinguish from
   * a broken selection. This is the thing that can tell them apart, so a book
   * whose module haul silently went to zero fails the build here.
   */
  moduleWeapons: number;
  moduleArmors: number;
}

export const REVISION_COUNTS: Record<string, RevisionCounts> = {
  'srd-1.0-2025-09-09': {
    domainCardsPerDomain: 21,
    beastforms: 22,
    environments: 19,
    transformations: 0,
    adversariesMin: 120,
    adversariesMax: 140,
    /*
     * Zero, measured rather than assumed absent. SRD 1.0's contents page names
     * no `Supplemental Campaign Mechanics` chapter, and - the check that does
     * not depend on a title - not one of its 135 folios prints a `Name`-led
     * equipment table header outside folios 44-57, where the Weapons, Combat
     * Wheelchair and Armor chapters are.
     */
    moduleWeapons: 0,
    moduleArmors: 0,
  },
  'srd-2.0-2026-08-25': {
    domainCardsPerDomain: 21,
    /*
     * These three were null when this table was written, and the note here said
     * they would stay null "until they are counted in the book". They have been.
     *
     * The null was right at the time and for the stated reason: the parsers
     * were broken on this book, so any number written here would have agreed
     * with whatever the first working parser happened to produce. The numbers
     * below were measured the other way round - on the page first, and by more
     * than one route - and the parser then agreed with them.
     *
     * beastforms 22: the book prints 24 cards on folios 15-18. LEGENDARY BEAST
     * and MYTHIC BEAST are `(Upgraded ...)` templates with no trait, Evasion,
     * attack or advantage line, so they are not `Beastform`s and are dropped -
     * in BOTH books, which is why 22 is also SRD 1.0's number. That they are
     * dropped at all is an open question, not a settled one.
     *
     * environments 47: three counts agree - the book's own index on folio 159
     * (16+12+11+8 by tier), a hand count of the display banners on folios
     * 160-182, and the parser.
     */
    beastforms: 22,
    environments: 47,
    transformations: 6,
    /*
     * 264, exactly, where SRD 1.0 carries a 20-wide band.
     *
     * The band exists because it is "the coarse second belt on a number that is
     * not in the dataset to be derived". On this book it can be tight, because
     * the chapter prints its own roster and `shared/parsers/adversaries.ts`
     * checks it in both directions: a stat block not on the roster throws, and
     * a rostered name with no stat block throws. Four independent counts agree
     * on 264 - the roster entries, the stat-block banners, the parser, and an
     * independent verifier's re-count.
     *
     * SRD 1.0's 120-140 is left alone. It is an inherited number, and widening
     * or tightening it is a measurement nobody in this wave made.
     */
    adversariesMin: 264,
    adversariesMax: 264,
    /*
     * 76 and 16, from 43 and 7 printed rows. Both halves were counted on the
     * page before the parser was allowed to agree with them.
     *
     * The four folios that carry module equipment are 191, 192, 197 and 201 -
     * every folio of the book was checked for a `Name`-led equipment header
     * outside the main ranges, and those are the only ones. The rows on them:
     * Everyday Hero 15 + 10 primary and 7 secondary weapons and 4 armors
     * (folios 191-192), Western 3 primary and 2 secondary weapons and NO armor
     * (folio 197), Monster Hunting 3 primary and 3 secondary weapons and 3
     * armors (folio 201). That is 43 weapon rows and 7 armor rows.
     *
     * The record counts are larger than the row counts because Western and
     * Monster Hunting print the whole tier ladder inside one cell - `Tier 1:
     * d8+1 phy Tier 2: d8+4 phy ...` - where the main chapter prints four rows
     * in four tier tables. Their 11 weapon rows and 3 armor rows are therefore
     * 44 and 12 records, and Everyday Hero's 32 and 4 are 32 and 4, because it
     * prints no tier at all. 32 + 44 = 76, 4 + 12 = 16.
     *
     * The 7 armor rows are worth a sentence, because the number this wave was
     * handed was 4. Four is the Everyday Hero table alone (folio 192); Monster
     * Hunting prints three more on folio 201 under its own `Armor` banner -
     * Coffinwood Armor, Leather Longcoat, Silverweave Armor.
     */
    moduleWeapons: 76,
    moduleArmors: 16,
  },
};

const UNMEASURED = (revision: string, field: string, actual: string): string =>
  `revision "${revision}" has no measured ${field}: REVISION_COUNTS['${revision}'].${field} ` +
  `is null in tools/validate.ts. This build produced ${actual}. Count it in the printed ` +
  `book, then replace the null - a null is a hole in the gate, not a pass.`;

/** Ligature damage from the extractor, in the form it actually takes. */
const LIGATURE_TRAPS =
  /\b(diculty|benets|modier|nesse|specic|reect|Diffi culty|profi t|benefi ts|fi rst|fl ying)\b/i;

function checkText(issues: Issue[], where: string, text: string | undefined): void {
  if (text === undefined || text === '') return;
  if (hasPua(text)) {
    issues.push({
      severity: 'error',
      where,
      message: `contains an unmapped Private Use Area glyph: ${JSON.stringify(text.slice(0, 80))}`,
    });
  }
  const lig = LIGATURE_TRAPS.exec(text);
  if (lig) {
    issues.push({
      severity: 'error',
      where,
      message: `ligature damage: "${lig[0]}" in ${JSON.stringify(text.slice(0, 80))}`,
    });
  }
  if (/�/.test(text)) {
    issues.push({ severity: 'error', where, message: 'contains U+FFFD replacement character' });
  }
}

/**
 * A count, against a number and against WHERE THAT NUMBER CAME FROM.
 *
 * The provenance is in the message rather than in a comment because the message
 * is what a failing build prints, and `expected 18, got 17` sends the reader to
 * this file to find out who decided 18. `expected 18 (the book's own roster in
 * Character Creation), got 17` sends them to the book, which is where the
 * answer is.
 */
function expectCount(
  issues: Issue[],
  where: string,
  actual: number,
  expected: number,
  source: string,
): void {
  if (actual !== expected) {
    issues.push({
      severity: 'error',
      where,
      message: `expected ${expected} (${source}), got ${actual}`,
    });
  }
}

/**
 * A collection against the roster the book prints for it, by name.
 *
 * Strictly stronger than counting, and it costs the same read: `Elemental Kin`
 * was once attached to twenty ancestries by a parser that threw nothing, and a
 * count of 18 would have gone on being 18 while the wrong entry rode along. The
 * comparison is on SETS - the ancestries chapter in SRD 2.0 prints Earthkin,
 * Emberkin, Skykin and Tidekin together under their family heading while the
 * Character Creation roster lists them alphabetically, so order is a property
 * of the page and not of the book.
 */
function expectRoster(
  issues: Issue[],
  where: string,
  actual: ReadonlyArray<{ name: string }>,
  claimed: readonly string[] | null,
  source: string,
): void {
  if (claimed === null) return;
  expectCount(issues, where, actual.length, claimed.length, source);
  const have = new Map(actual.map((a) => [nameKey(a.name), a.name]));
  const want = new Map(claimed.map((n) => [nameKey(n), n]));
  const missing = [...want].filter(([k]) => !have.has(k)).map(([, n]) => n);
  const extra = [...have].filter(([k]) => !want.has(k)).map(([, n]) => n);
  if (missing.length > 0) {
    issues.push({
      severity: 'error',
      where,
      message: `${source} names ${missing.length} the dataset does not have: ${missing.join(', ')}`,
    });
  }
  if (extra.length > 0) {
    issues.push({
      severity: 'error',
      where,
      message: `the dataset has ${extra.length} the book's roster does not name: ${extra.join(', ')}`,
    });
  }
}

export function validate(ds: Dataset): Issue[] {
  const issues: Issue[] = [];

  /*
   * (a) What this printing says about itself, and (b) what had to be counted.
   *
   * Both are fatal when absent. A dataset whose rules text does not carry the
   * Character Creation rosters cannot be checked against the book at all, and
   * "cannot be checked" is the state this gate exists to refuse.
   */
  const claims = readBookClaims(ds.rules, issues);
  const counts = REVISION_COUNTS[ds.revision];
  if (counts === undefined) {
    issues.push({
      severity: 'error',
      where: 'revision',
      message:
        `no counts for revision "${ds.revision}". Add an entry to REVISION_COUNTS in ` +
        `tools/validate.ts keyed by that exact string, with domainCardsPerDomain, beastforms, ` +
        `environments, transformations, adversariesMin and adversariesMax measured on THIS ` +
        `printing. This build produced beastforms ${ds.beastforms.length}, environments ` +
        `${ds.environments.length}, transformations ${ds.transformations.length}, ` +
        `adversaries ${ds.adversaries.length} - check each against the book before writing it ` +
        `down. domains, classes, subclasses, ancestries and communities need no entry: they are ` +
        `read from the book's own Character Creation text.`,
    });
  }

  if (claims.domains !== null) {
    expectCount(
      issues,
      'domains',
      ds.domains.length,
      claims.domains,
      "the book's own \"two of the N domains\"",
    );
  }
  expectRoster(
    issues,
    'classes',
    ds.classes,
    claims.classes?.names ?? null,
    "the book's own \"There are N classes in this SRD\" roster",
  );
  if (claims.subclassesPerClass !== null) {
    /*
     * Times the number of classes THE BOOK has, not the number the parser
     * returned. Multiplying by `ds.classes.length` looks equivalent and is not:
     * a class parser that dropped a class drops its two subclasses with it, so
     * both sides of the comparison move together and the subclass check goes
     * quiet on exactly the dataset it exists to reject. Anchoring on the
     * printed roster keeps the two failures independent.
     */
    const classCount = claims.classes?.count ?? ds.classes.length;
    expectCount(
      issues,
      'subclasses',
      ds.subclasses.length,
      claims.subclassesPerClass * classCount,
      `${claims.subclassesPerClass} per class, which the book states, times the ${classCount} classes it lists`,
    );
  }
  expectRoster(
    issues,
    'ancestries',
    ds.ancestries,
    claims.ancestries,
    "the book's own \"one of the following ancestries\" roster",
  );
  expectRoster(
    issues,
    'communities',
    ds.communities,
    claims.communities,
    "the book's own \"one of the following communities\" roster",
  );

  /*
   * A card may only name a domain THIS PRINTING opens a chapter for.
   *
   * The third reading of the same roster: folio 7 sets the domain chapter, the
   * appendix sets a banner per domain, and the card's own `Level N <Domain>`
   * line names it a third time. `parseDomainCards` already reconciles the last
   * two. This reconciles them with the first, and it is the `DOMAINS` versus
   * `ds.domains` distinction again - `DOMAINS` has known `dread` since before
   * any book in this repo printed it, so a stray Dread card in an SRD 1.0 build
   * passes the constant and fails here, which is the right way round.
   */
  const printedDomains = new Set<string>(ds.domains.map((d) => d.id));
  for (const domain of new Set(ds.domainCards.map((c) => c.domain))) {
    if (!printedDomains.has(domain)) {
      issues.push({
        severity: 'error',
        where: `domainCards/${domain}`,
        message: `cards name domain "${domain}", which this printing's domain chapter does not open`,
      });
    }
  }

  const perDomainExpected = counts?.domainCardsPerDomain ?? null;
  if (counts !== undefined && perDomainExpected === null) {
    issues.push({
      severity: 'error',
      where: 'domainCards',
      message: UNMEASURED(ds.revision, 'domainCardsPerDomain', `${ds.domainCards.length} cards`),
    });
  }
  if (perDomainExpected !== null) {
    expectCount(
      issues,
      'domainCards',
      ds.domainCards.length,
      perDomainExpected * ds.domains.length,
      `${perDomainExpected} per domain times the ${ds.domains.length} domains this book prints`,
    );
  }

  if (counts !== undefined && counts.beastforms === null) {
    issues.push({
      severity: 'error',
      where: 'beastforms',
      message: UNMEASURED(ds.revision, 'beastforms', `${ds.beastforms.length}`),
    });
  } else if (counts !== undefined && counts.beastforms !== null) {
    expectCount(
      issues,
      'beastforms',
      ds.beastforms.length,
      counts.beastforms,
      `counted in ${ds.revision}`,
    );
  }

  if (counts !== undefined && counts.environments === null) {
    issues.push({
      severity: 'error',
      where: 'environments',
      message: UNMEASURED(ds.revision, 'environments', `${ds.environments.length}`),
    });
  } else if (counts !== undefined && counts.environments !== null) {
    expectCount(
      issues,
      'environments',
      ds.environments.length,
      counts.environments,
      `counted in ${ds.revision}`,
    );
  }

  if (counts !== undefined && counts.transformations === null) {
    issues.push({
      severity: 'error',
      where: 'transformations',
      message: UNMEASURED(ds.revision, 'transformations', `${ds.transformations.length}`),
    });
  } else if (counts !== undefined && counts.transformations !== null) {
    expectCount(
      issues,
      'transformations',
      ds.transformations.length,
      counts.transformations,
      `counted in ${ds.revision}`,
    );
  }

  for (const t of ds.transformations) {
    /*
     * Shape, not a number. Every card THIS printing sets carries two features
     * and six questions, and that is in the test file where it can be read
     * against the page; what is checked here is that a card is a card at all -
     * a mis-split leaves one side empty, and an empty side is not something a
     * count of six cards can see.
     */
    if (t.features.length === 0) {
      issues.push({
        severity: 'error',
        where: `transformations/${t.id}`,
        message: 'no features under TRANSFORMATION FEATURES',
      });
    }
    if (t.questions.length === 0) {
      issues.push({
        severity: 'error',
        where: `transformations/${t.id}`,
        message: 'no questions under TRANSFORMATION QUESTIONS',
      });
    }
    if (t.description.trim().length < 20) {
      issues.push({
        severity: 'error',
        where: `transformations/${t.id}`,
        message: `description is only ${t.description.trim().length} characters - the parser probably stopped early`,
      });
    }
    checkText(issues, `transformations/${t.id}`, t.description);
    checkText(issues, `transformations/${t.id}/name`, t.name);
    for (const f of t.features) {
      checkText(issues, `transformations/${t.id}/${f.name}`, f.text);
      checkText(issues, `transformations/${t.id}/${f.name}/name`, f.name);
    }
    for (const q of t.questions) checkText(issues, `transformations/${t.id}/questions`, q);
  }

  if (counts !== undefined && (counts.adversariesMin === null || counts.adversariesMax === null)) {
    issues.push({
      severity: 'error',
      where: 'adversaries',
      message: UNMEASURED(ds.revision, 'adversariesMin/adversariesMax', `${ds.adversaries.length}`),
    });
  } else if (counts !== undefined && counts.adversariesMin !== null && counts.adversariesMax !== null) {
    if (
      ds.adversaries.length < counts.adversariesMin ||
      ds.adversaries.length > counts.adversariesMax
    ) {
      issues.push({
        severity: 'error',
        where: 'adversaries',
        message: `expected ${counts.adversariesMin}-${counts.adversariesMax} (counted in ${ds.revision}), got ${ds.adversaries.length}`,
      });
    }
  }
  /*
   * Every domain THE BOOK SHIPS must carry as many cards as this revision was
   * measured to carry, on levels 1 to 10.
   *
   * Seeded from `ds.domains` and not from the `DOMAINS` constant, which are two
   * different lists and were being treated as one. `DOMAINS` is what this build
   * can represent; `ds.domains` is what this printing contains. They are equal
   * today and stop being equal the moment the code learns a domain before the
   * committed dataset has it - which is exactly the state a revision lands in,
   * and seeding from the constant turned that state into
   * `domainCards/dread: expected 21 cards, got 0` on a dataset that is correct.
   *
   * The check that a card's domain is one this build KNOWS stays against
   * `DOMAINS` below, because that one really is about the constant: a card
   * naming a domain the code cannot represent is unrenderable.
   */
  const perDomain = new Map<DomainId, number>();
  for (const d of ds.domains) perDomain.set(d.id as DomainId, 0);
  for (const card of ds.domainCards) {
    if (!DOMAINS.includes(card.domain)) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `unknown domain "${card.domain}"`,
      });
      continue;
    }
    perDomain.set(card.domain, (perDomain.get(card.domain) ?? 0) + 1);
    if (card.level < 1 || card.level > 10) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `level ${card.level} out of range`,
      });
    }
    if (card.recallCost < 0 || card.recallCost > 5) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `recallCost ${card.recallCost} out of range`,
      });
    }
    if (card.text.trim().length < 20) {
      issues.push({
        severity: 'error',
        where: `domainCards/${card.id}`,
        message: `text is only ${card.text.trim().length} characters - the parser probably stopped early`,
      });
    }
    checkText(issues, `domainCards/${card.id}`, card.text);
    checkText(issues, `domainCards/${card.id}/name`, card.name);
  }
  if (perDomainExpected !== null) {
    for (const [domain, n] of perDomain) {
      if (n !== perDomainExpected) {
        issues.push({
          severity: 'error',
          where: `domainCards/${domain}`,
          message: `expected ${perDomainExpected} cards (counted in ${ds.revision}), got ${n}`,
        });
      }
    }
  }

  /*
   * Every domain's ladder must be the SAME ladder, and this one the book does
   * state - by printing it, ten times over in SRD 2.0 and nine in SRD 1.0.
   *
   * Measured off the printed `Level N <Domain> <Type>` lines in both appendices
   * without going through the card parser: three level-1 cards and two at each
   * of levels 2 to 10, identically, for all nineteen domain-printings across
   * the two books. So this is not a house rule imposed on the SRD, it is the
   * shape the SRD sets.
   *
   * It is here because the per-domain COUNT cannot see a swap: 21 cards that
   * are two level-3s and no level-4 still counts 21. And because it is derived
   * from the book rather than from a number in this file, it keeps working on a
   * printing whose ladder is a different one - it only insists the domains
   * agree with each other.
   */
  const ladderOf = (domain: DomainId): Map<number, number> => {
    const h = new Map<number, number>();
    for (const c of ds.domainCards) {
      if (c.domain !== domain) continue;
      h.set(c.level, (h.get(c.level) ?? 0) + 1);
    }
    return h;
  };
  const show = (h: Map<number, number>): string =>
    [...h]
      .sort((a, b) => a[0] - b[0])
      .map(([lvl, n]) => `L${lvl}:${n}`)
      .join(' ');
  const first = ds.domains[0];
  if (first !== undefined) {
    const reference = ladderOf(first.id);
    for (const d of ds.domains.slice(1)) {
      const mine = show(ladderOf(d.id));
      if (mine !== show(reference)) {
        issues.push({
          severity: 'error',
          where: `domainCards/${d.id}`,
          message: `level ladder ${mine} does not match ${first.id}'s ${show(reference)}`,
        });
      }
    }
  }

  for (const klass of ds.classes) {
    if (klass.domains.length !== 2) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `expected 2 domains, got ${klass.domains.length}`,
      });
    }
    for (const d of klass.domains) {
      if (!DOMAINS.includes(d)) {
        issues.push({
          severity: 'error',
          where: `classes/${klass.id}`,
          message: `unknown domain "${d}"`,
        });
      }
    }
    if (klass.subclasses.length !== 2) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `expected 2 subclasses, got ${klass.subclasses.length}`,
      });
    }
    if (klass.startingEvasion < 5 || klass.startingEvasion > 15) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `startingEvasion ${klass.startingEvasion} is implausible`,
      });
    }
    if (klass.startingHitPoints < 4 || klass.startingHitPoints > 8) {
      issues.push({
        severity: 'error',
        where: `classes/${klass.id}`,
        message: `startingHitPoints ${klass.startingHitPoints} is implausible`,
      });
    }
    checkText(issues, `classes/${klass.id}`, klass.description);
  }

  for (const sub of ds.subclasses) {
    if (sub.spellcastTrait !== null && !TRAITS.includes(sub.spellcastTrait)) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: `unknown spellcastTrait "${sub.spellcastTrait}"`,
      });
    }
    if (sub.foundationFeatures.length === 0) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: 'no foundation features',
      });
    }
  }

  for (const a of ds.ancestries) {
    if (a.features.length !== 2) {
      issues.push({
        severity: 'error',
        where: `ancestries/${a.id}`,
        message: `expected 2 features, got ${a.features.length}`,
      });
    }
    for (const f of a.features) checkText(issues, `ancestries/${a.id}/${f.name}`, f.text);
  }

  for (const c of ds.communities) {
    if (c.feature.text.trim().length < 20) {
      issues.push({
        severity: 'error',
        where: `communities/${c.id}`,
        message: 'feature text is suspiciously short',
      });
    }
  }

  if (counts !== undefined) {
    expectCount(
      issues,
      'weapons/module',
      ds.weapons.filter((w) => w.module !== undefined).length,
      counts.moduleWeapons,
      `counted in ${ds.revision}`,
    );
    expectCount(
      issues,
      'armors/module',
      ds.armors.filter((a) => a.module !== undefined).length,
      counts.moduleArmors,
      `counted in ${ds.revision}`,
    );
  }

  for (const w of ds.weapons) {
    // "spellcast" is legitimate: the arcane-frame wheelchairs defer to
    // whatever Spellcast trait the wielder's subclass names.
    if (w.trait !== 'spellcast' && !TRAITS.includes(w.trait)) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `unknown trait "${w.trait}"` });
    }
    if (!RANGES.includes(w.range)) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `unknown range "${w.range}"` });
    }
    if (!/^\d*d\d+([+-]\d+)?$/.test(w.damage.replace(/\s+/g, ''))) {
      issues.push({
        severity: 'error',
        where: `weapons/${w.id}`,
        message: `damage "${w.damage}" is not a dice expression`,
      });
    }
    if (w.tier < 1 || w.tier > 4) {
      issues.push({ severity: 'error', where: `weapons/${w.id}`, message: `tier ${w.tier} out of range` });
    }
  }

  for (const a of ds.armors) {
    if (a.baseThresholds[0] >= a.baseThresholds[1]) {
      issues.push({
        severity: 'error',
        where: `armors/${a.id}`,
        message: `thresholds ${a.baseThresholds.join('/')} are not increasing`,
      });
    }
    if (a.baseScore < 1 || a.baseScore > 12) {
      issues.push({
        severity: 'error',
        where: `armors/${a.id}`,
        message: `baseScore ${a.baseScore} out of range`,
      });
    }
  }

  const byTier = new Map<number, number>();
  for (const adv of ds.adversaries) {
    byTier.set(adv.tier, (byTier.get(adv.tier) ?? 0) + 1);
    if (!ADVERSARY_ROLES.includes(adv.role)) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: `unknown role "${adv.role}"`,
      });
    }
    if (adv.difficulty < 1 || adv.difficulty > 30) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: `difficulty ${adv.difficulty} is implausible`,
      });
    }
    if (adv.hp < 1) {
      issues.push({ severity: 'error', where: `adversaries/${adv.id}`, message: `hp is ${adv.hp}` });
    }
    if (adv.role === 'Minion' && adv.thresholds !== null) {
      issues.push({
        severity: 'warning',
        where: `adversaries/${adv.id}`,
        message: 'a Minion should have no damage thresholds',
      });
    }
    if (adv.features.length === 0) {
      issues.push({
        severity: 'error',
        where: `adversaries/${adv.id}`,
        message: 'no features - the stat block was probably truncated',
      });
    }
    checkText(issues, `adversaries/${adv.id}`, adv.description);
    for (const f of adv.features) checkText(issues, `adversaries/${adv.id}/${f.name}`, f.text);
  }
  for (const tier of [1, 2, 3, 4]) {
    if ((byTier.get(tier) ?? 0) === 0) {
      issues.push({ severity: 'error', where: 'adversaries', message: `no tier ${tier} adversaries` });
    }
  }

  for (const env of ds.environments) {
    if (env.features.length === 0) {
      issues.push({ severity: 'error', where: `environments/${env.id}`, message: 'no features' });
    }
    checkText(issues, `environments/${env.id}`, env.description);
  }

  /*
   * Ids must be unique WITHIN a collection, and each (collection, slug) pair
   * must name one record. Across collections they may repeat, and since SRD 2.0
   * one does: the Valor domain card *Hold the Line* (folio 223) and the Event
   * environment of the same name (folio 164) both slugify to `hold-the-line`.
   *
   * This check used to say "unique across the whole dataset", which was true of
   * `data/registry.json` version 1 - one id per bare slug - and stopped the
   * SRD 2.0 build dead. Version 2 keys the registry by `collection/slug`, so
   * the two are two rows with two numbers and nothing is aliased on the wire.
   * What WOULD alias two entities is one collection printing the same slug
   * twice, and that is what is an error below.
   *
   * The cross-collection case is still worth a warning rather than silence:
   * `indexDataset` in src/engine/character.ts keys its `byRef` map by the bare
   * slug, so the two records still collapse into one entry there. What has
   * changed is which one survives and whether a caller has to accept it. It
   * used to be whichever collection `indexDataset` happened to write LAST -
   * environments after domain cards, so `byRef.get('hold-the-line')` returned
   * the Event environment and the Valor card a loadout can hold was the one
   * lost. It is now the first collection in `INDEXED_COLLECTIONS`, which is
   * `BANDED_COLLECTIONS` order, so `byRef` and the registry agree about the
   * bare name; and `index.collections` gives every caller that knows its kind
   * a map that cannot answer with the other one.
   *
   * So the warning no longer describes a wrong answer. It describes a slug
   * whose bare-name resolution is decided by a precedence rather than by the
   * book, which is worth saying out loud once per pair, and it names the pair
   * rather than guessing what anyone should do about it.
   */
  const seen = new Map<string, string>();
  const collections: Array<[string, Array<{ id: string }>]> = [
    ['domains', ds.domains],
    ['domainCards', ds.domainCards],
    ['classes', ds.classes],
    ['subclasses', ds.subclasses],
    ['beastforms', ds.beastforms],
    ['ancestries', ds.ancestries],
    ['communities', ds.communities],
    /*
     * `transformations` is in this list, and putting it here found a second
     * cross-collection collision on the wire: SRD 2.0 prints an ADVERSARY
     * called Vampire (folio 142) and a TRANSFORMATION card called VAMPIRE
     * (folio 45), and both slugify to `vampire`. That is the same defect as
     * `hold-the-line` - a Valor domain card in SRD 1.0 and an Event
     * environment in SRD 2.0 - and it is reported here rather than avoided by
     * leaving the new collection out, because a collection exempt from the
     * dataset's own uniqueness check is exactly the silent hole this file
     * exists to close. Both errors are the registry's to resolve; neither is
     * resolvable by renaming a card the book names.
     */
    ['transformations', ds.transformations],
    ['weapons', ds.weapons],
    ['armors', ds.armors],
    ['loot', ds.loot],
    ['consumables', ds.consumables],
    ['adversaries', ds.adversaries],
    ['environments', ds.environments],
    ['rules', ds.rules],
  ];
  for (const [name, items] of collections) {
    const within = new Set<string>();
    for (const item of items) {
      if (item.id === '' || item.id === undefined) {
        issues.push({ severity: 'error', where: name, message: 'an entry has an empty id' });
        continue;
      }
      if (within.has(item.id)) {
        issues.push({
          severity: 'error',
          where: `${name}/${item.id}`,
          message: `duplicate id inside ${name}: two records, one key, and no way to tell them apart`,
        });
      }
      within.add(item.id);
      const prior = seen.get(item.id);
      if (prior !== undefined && prior !== name) {
        issues.push({
          severity: 'warning',
          where: `${name}/${item.id}`,
          message:
            `the slug is also ${prior}/${item.id}; the registry gives each its own id, but ` +
            `indexDataset keys byRef by the slug alone, so a bare lookup resolves to whichever ` +
            `comes first in INDEXED_COLLECTIONS - index.collections is the exact lookup for a ` +
            `caller that knows its kind`,
        });
      }
      seen.set(item.id, name);
    }
  }

  // Every class must point at subclasses that exist, and vice versa.
  const subclassIds = new Set(ds.subclasses.map((s) => s.id));
  const classIds = new Set(ds.classes.map((c) => c.id));
  for (const klass of ds.classes) {
    for (const ref of klass.subclasses) {
      if (!subclassIds.has(ref)) {
        issues.push({
          severity: 'error',
          where: `classes/${klass.id}`,
          message: `dangling subclass ref "${ref}"`,
        });
      }
    }
  }
  for (const sub of ds.subclasses) {
    if (!classIds.has(sub.classRef)) {
      issues.push({
        severity: 'error',
        where: `subclasses/${sub.id}`,
        message: `dangling class ref "${sub.classRef}"`,
      });
    }
  }

  return issues;
}

export function formatIssues(issues: Issue[]): string {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const lines: string[] = [];
  for (const i of errors) lines.push(`  ERROR   ${i.where}: ${i.message}`);
  for (const i of warnings) lines.push(`  warning ${i.where}: ${i.message}`);
  lines.push(`\n  ${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join('\n');
}
